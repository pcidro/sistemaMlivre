import { z } from "zod";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { summarySelect, type ImportSummary } from "./ImportRepository";
import { MercadoLivreImportService, type MercadoLivreImportInput } from "./MercadoLivreImportService";

const DAY_MS = 86_400_000;
const OVERLAP_MS = 3_600_000;
const STALE_MS = 10 * 60_000;

export interface RegisteredSync {
  summary: ImportSummary;
  input: MercadoLivreImportInput | null;
}
export interface MercadoLivreSyncStorage {
  register(accountId: string, userId: string, days: number, now: Date): Promise<RegisteredSync>;
  checkpoint(accountId: string, userId: string, dateTo: Date): Promise<void>;
  fail(id: string): Promise<void>;
  get(id: string, userId: string): Promise<ImportSummary | null>;
  list(userId: string): Promise<ImportSummary[]>;
}

/** Import é o registro durável; o processamento continua no processo Node atual. */
export class MercadoLivreSyncRepository implements MercadoLivreSyncStorage {
  constructor(private readonly database = prisma) {}

  private async recover(userId: string, accountId?: string) {
    await this.database.import.updateMany({
      where: {
        platform: "MERCADO_LIVRE", status: "PROCESSING",
        updatedAt: { lt: new Date(Date.now() - STALE_MS) },
        marketplaceAccount: { userId },
        ...(accountId ? { marketplaceAccountId: accountId } : {}),
      },
      data: { status: "ERROR", finishedAt: new Date(), errorsCount: { increment: 1 } },
    });
  }

  async register(accountId: string, userId: string, days: number, now: Date): Promise<RegisteredSync> {
    await this.recover(userId, accountId);
    try {
      return await this.database.$transaction(async tx => {
        // A trava de linha serializa reconexões simultâneas da mesma conta.
        const owned = await tx.marketplaceAccount.updateMany({
          where: { id: accountId, userId, platform: "MERCADO_LIVRE", isActive: true },
          data: { updatedAt: now },
        });
        if (!owned.count) throw new AppError("Conta do Mercado Livre não encontrada ou inativa", 404);
        const current = await tx.import.findFirst({
          where: { marketplaceAccountId: accountId, platform: "MERCADO_LIVRE", status: "PROCESSING" }, select: summarySelect,
        });
        if (current) return { summary: current, input: null };
        const account = await tx.marketplaceAccount.findUniqueOrThrow({ where: { id: accountId }, select: { lastSyncAt: true } });
        const previous = await tx.import.findFirst({
          where: { marketplaceAccountId: accountId, platform: "MERCADO_LIVRE", automatic: true },
          orderBy: { startedAt: "desc" }, select: { dateFrom: true, status: true },
        });
        // Sem sucesso, mantém o início anterior, mesmo quando a tentativa foi parcial.
        const start = account.lastSyncAt
          ? account.lastSyncAt.getTime() - OVERLAP_MS
          : previous?.dateFrom?.getTime() ?? now.getTime() - days * DAY_MS;
        const dateFrom = new Date(Math.min(start, now.getTime()));
        const summary = await tx.import.create({
          data: { marketplaceAccountId: accountId, platform: "MERCADO_LIVRE", automatic: true, dateFrom, dateTo: now },
          select: summarySelect,
        });
        return { summary, input: { marketplaceAccountId: accountId, userId, dateFrom, dateTo: now } };
      });
    } catch (error) {
      // A importação manual também participa da constraint de exclusão.
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        const current = await this.database.import.findFirst({
          where: { marketplaceAccountId: accountId, platform: "MERCADO_LIVRE", status: "PROCESSING", marketplaceAccount: { userId } },
          select: summarySelect,
        });
        if (current) return { summary: current, input: null };
      }
      throw error;
    }
  }

  async checkpoint(accountId: string, userId: string, dateTo: Date) {
    await this.database.marketplaceAccount.updateMany({
      where: {
        id: accountId, userId, platform: "MERCADO_LIVRE", isActive: true,
        OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: dateTo } }],
      }, data: { lastSyncAt: dateTo },
    });
  }
  async fail(id: string) {
    await this.database.import.updateMany({
      where: { id, platform: "MERCADO_LIVRE", status: "PROCESSING" },
      data: { status: "ERROR", finishedAt: new Date(), errorsCount: { increment: 1 } },
    });
  }
  async get(id: string, userId: string) {
    await this.recover(userId);
    return this.database.import.findFirst({
      where: { id, platform: "MERCADO_LIVRE", marketplaceAccount: { userId } }, select: summarySelect,
    });
  }
  async list(userId: string) {
    await this.recover(userId);
    // Um registro por conta, suficiente para retomar o polling após recarregar.
    const accounts = await this.database.marketplaceAccount.findMany({
      where: { platform: "MERCADO_LIVRE", userId, isActive: true },
      select: { imports: {
        where: { platform: "MERCADO_LIVRE" }, orderBy: { startedAt: "desc" }, take: 1, select: summarySelect,
      } },
    });
    return accounts.flatMap(account => account.imports);
  }
}

export class MercadoLivreSyncService {
  constructor(
    private readonly storage: MercadoLivreSyncStorage = new MercadoLivreSyncRepository(),
    private readonly importer: Pick<MercadoLivreImportService, "execute"> = mercadoLivreImportService,
    private readonly schedule: (work: () => Promise<void>) => void = work => { setImmediate(() => { void work(); }); },
    private readonly nowFn: () => Date = () => new Date(),
  ) {}

  async start(accountId: string, userId: string): Promise<ImportSummary> {
    const days = z.coerce.number().int().min(1).max(365).safeParse(process.env.MERCADO_LIVRE_INITIAL_SYNC_DAYS ?? "90");
    if (!days.success) throw new AppError("MERCADO_LIVRE_INITIAL_SYNC_DAYS deve ser um inteiro de 1 a 365", 500);
    const registered = await this.storage.register(accountId, userId, days.data, this.nowFn());
    if (registered.input) {
      const input = registered.input;
      this.schedule(async () => {
        try {
          const result = await this.importer.execute(input, registered.summary);
          if (result.status === "SUCCESS") await this.storage.checkpoint(accountId, userId, input.dateTo);
        } catch {
          // Só a importação falha; a conexão e os dados persistidos são preservados.
          console.error("mercadolivre_sync_failed", { importId: registered.summary.id });
          try { await this.storage.fail(registered.summary.id); } catch {
            console.error("mercadolivre_sync_status_failed", { importId: registered.summary.id });
          }
        }
      });
    }
    return registered.summary;
  }
  async get(id: string, userId: string) {
    const summary = await this.storage.get(id, userId);
    if (!summary) throw new AppError("Importação não encontrada", 404);
    return summary;
  }
  list(userId: string) { return this.storage.list(userId); }
}

export const mercadoLivreImportService = new MercadoLivreImportService();
export const mercadoLivreSyncService = new MercadoLivreSyncService();

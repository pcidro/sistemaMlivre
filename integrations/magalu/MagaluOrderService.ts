import { createHash } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../errors/AppError";
import type { MarketplaceOrder } from "../types";
import { MagaluClient } from "./MagaluClient";
import { MagaluHttpError } from "./magaluHttpError";
import { magaluOrderResponseSchema } from "./magaluOrder.types";
import { MagaluOrderMapper } from "./MagaluOrderMapper";
import { magaluTokenStorage } from "./magaluTokenStorage";
import type { MagaluTokenAccount } from "./magaluTokenStorage";

const DEFAULT_PAGE_SIZE = 20;
// Limite local de memória por lote, independentemente do máximo do provedor.
const MAX_BATCH_SIZE = 100;
const inputSchema = z.object({
  marketplaceAccountId: z.string().trim().min(1),
  dateFrom: z.date(),
  dateTo: z.date(),
}).refine(input => input.dateFrom <= input.dateTo);
const pageSchema = magaluOrderResponseSchema.extend({
  // Validar cada pedido no mapper, sem compartilhar payload externo com callers.
  results: z.array(z.unknown()).max(MAX_BATCH_SIZE),
});

export interface GetMagaluOrdersInput {
  marketplaceAccountId: string;
  dateFrom: Date;
  dateTo: Date;
  /** O importador pode isolar falhas de mapeamento e contabilizá-las por ocorrência. */
  onOrderError?: (error: MagaluHttpError) => void;
}

interface MagaluOrderServiceDependencies {
  findAccount?: (id: string) => Promise<MagaluTokenAccount | null>;
  createClient?: (account: MagaluTokenAccount) => Pick<MagaluClient, "get">;
  mapper?: Pick<MagaluOrderMapper, "map">;
  pageSize?: number;
}

/** Consulta em lotes para um usuário autenticado, sem persistência de pedidos. */
export class MagaluOrderService {
  private readonly userId: string;
  private readonly findAccount: NonNullable<MagaluOrderServiceDependencies["findAccount"]>;
  private readonly createClient: NonNullable<MagaluOrderServiceDependencies["createClient"]>;
  private readonly mapper: Pick<MagaluOrderMapper, "map">;
  private readonly pageSize: number;

  constructor(userId: string, dependencies: MagaluOrderServiceDependencies = {}) {
    if (typeof userId !== "string" || !userId.trim()) {
      throw new AppError("Usuário autenticado necessário para consultar pedidos Magalu", 401);
    }
    this.userId = userId;
    this.pageSize = dependencies.pageSize ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(this.pageSize) || this.pageSize < 1 || this.pageSize > MAX_BATCH_SIZE) {
      throw new AppError("O tamanho do lote Magalu deve estar entre 1 e 100", 400);
    }
    this.findAccount = dependencies.findAccount ?? (id => magaluTokenStorage.findAccount(id));
    this.createClient = dependencies.createClient ?? (account => new MagaluClient(account));
    this.mapper = dependencies.mapper ?? new MagaluOrderMapper();
  }

  async *getOrders(input: GetMagaluOrdersInput): AsyncGenerator<MarketplaceOrder[]> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Conta ou período de consulta de pedidos Magalu inválido", 400);
    const { marketplaceAccountId, dateFrom, dateTo } = parsed.data;
    // Fixar o intervalo antes dos awaits/yields, sem arredondar dias ou offsets.
    const from = dateFrom.toISOString();
    const to = dateTo.toISOString();
    const account = await this.findAccount(marketplaceAccountId);
    if (!account || account.id !== marketplaceAccountId || account.userId !== this.userId ||
      account.platform !== "MAGALU" || !account.isActive) {
      throw new MagaluHttpError("Conta Magalu não encontrada para este usuário ou inativa.", 404, "invalid_account");
    }
    const client = this.createClient(account);
    let offset = 0;
    let limit = this.pageSize;
    let previousPageSignature: string | null = null;

    for (;;) {
      // Refresh, 401, 403, 429 e indisponibilidade são tratados pelo client.
      // Não adicionar outro loop de retries em torno da paginação.
      const response = await client.get<unknown>("/seller/v1/orders", { query: {
        _offset: offset,
        _limit: limit,
        _sort: "purchased_at:asc",
        purchased_at__gte: from,
        purchased_at__lte: to,
      } });
      const page = pageSchema.safeParse(response.data);
      if (!page.success) throw this.invalidPage("uma lista de pedidos inválida", response.requestId, response.status);
      const { results, meta } = page.data;
      const paging = meta.page;
      if (paging.offset !== offset || paging.count !== results.length ||
        !Number.isSafeInteger(paging.offset) || !Number.isSafeInteger(paging.max_limit) ||
        paging.limit <= 0 || paging.max_limit <= 0 || results.length > limit) {
        throw this.invalidPage("metadados de paginação inconsistentes", response.requestId);
      }
      if (results.length === 0) return;

      const orders: MarketplaceOrder[] = [];
      const identities: string[] = [];
      for (const payload of results) {
        try {
          const order = this.mapper.map(payload);
          orders.push(order);
          identities.push(order.externalOrderId);
        } catch {
          const error = this.invalidPage("um pedido com formato inválido", response.requestId);
          if (!input.onOrderError) throw error;
          input.onOrderError(error);
          // Apenas o hash transita entre páginas; não expor dados pessoais ou XML.
          identities.push(createHash("sha256").update(JSON.stringify(payload)).digest("hex"));
        }
      }
      // Detectar a repetição da última página sem manter todos os IDs na memória.
      const signature = createHash("sha256")
        .update(JSON.stringify(identities.sort())).digest("hex");
      if (signature === previousPageSignature) {
        throw this.invalidPage("uma página de pedidos repetida sem progresso", response.requestId);
      }
      previousPageSignature = signature;
      const nextOffset = offset + results.length;
      if (!Number.isSafeInteger(nextOffset) || nextOffset <= offset) {
        throw this.invalidPage("um offset de paginação inválido", response.requestId);
      }
      offset = nextOffset;
      limit = Math.min(this.pageSize, paging.max_limit);

      // A próxima consulta só ocorre quando o consumidor pedir o próximo lote.
      yield orders;
    }
  }

  private invalidPage(reason: string, requestId: string, providerStatus = 200): MagaluHttpError {
    return new MagaluHttpError(`A Magalu retornou ${reason}.`, 502, "invalid_response", providerStatus, requestId);
  }
}

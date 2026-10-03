import { createHash } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../errors/AppError";
import { NFeParserService, NFeParserError } from "../../services/invoices/NFeParserService";
import type { ParsedNFeData } from "../../services/invoices/NFeParserService";
import { normalizeCustomerDocument } from "../../utils/normalizeDocument";
import { normalizePhone } from "../../utils/normalizePhone";
import type { MarketplaceCustomer, MarketplaceDelivery } from "../types";
import { MagaluClient } from "./MagaluClient";
import type { MagaluResponse } from "./MagaluClient";
import { getMagaluConfig } from "./magaluConfig";
import type { MagaluConfig } from "./magaluConfig";
import { MagaluHttpError } from "./magaluHttpError";
import { magaluInvoiceResponseSchema } from "./magaluInvoice.types";
import type { MagaluInvoice, MagaluProcessedInvoice } from "./magaluInvoice.types";
import { magaluTokenStorage } from "./magaluTokenStorage";
import type { MagaluTokenAccount } from "./magaluTokenStorage";

const deliverySchema = z.object({
  marketplaceAccountId: z.string().trim().min(1),
  externalDeliveryId: z.string().trim().min(1).max(200).refine(id => id !== "." && id !== ".."),
  platform: z.literal("MAGALU"),
  channelId: z.uuid().transform(id => id.toLowerCase()),
});
const issuedAtSchema = z.iso.datetime({ offset: true, local: true });

export interface GetMagaluInvoiceInput {
  /** Referência normalizada produzida pelo MagaluDeliveryService. */
  delivery: MarketplaceDelivery;
  /** Customer normalizado do pedido, usado para conferir o destinatário. */
  customer?: MarketplaceCustomer;
  /** Diagnóstico seguro de notas inválidas, sem XML ou dados pessoais. */
  onInvoiceError?: (error: MagaluHttpError) => void;
}

interface MagaluInvoiceServiceDependencies {
  findAccount?: (id: string) => Promise<MagaluTokenAccount | null>;
  createClient?: (account: MagaluTokenAccount) => Pick<MagaluClient, "get">;
  getConfig?: () => MagaluConfig;
  parser?: Pick<NFeParserService, "parse">;
  pageSize?: number;
}

/** Consulta a coleção inteira em pequenos lotes, retendo somente a melhor candidata. */
export class MagaluInvoiceService {
  private readonly findAccount: NonNullable<MagaluInvoiceServiceDependencies["findAccount"]>;
  private readonly createClient: NonNullable<MagaluInvoiceServiceDependencies["createClient"]>;
  private readonly getConfig: () => MagaluConfig;
  private readonly parser: Pick<NFeParserService, "parse">;
  private readonly pageSize: number;

  constructor(private readonly userId: string, dependencies: MagaluInvoiceServiceDependencies = {}) {
    if (typeof userId !== "string" || !userId.trim()) {
      throw new AppError("Usuário autenticado necessário para consultar notas Magalu", 401);
    }
    // XMLs podem ser grandes. Não acumular todas as páginas em memória.
    this.pageSize = dependencies.pageSize ?? 5;
    if (!Number.isInteger(this.pageSize) || this.pageSize < 1 || this.pageSize > 20) {
      throw new AppError("O tamanho do lote de notas Magalu deve estar entre 1 e 20", 400);
    }
    this.findAccount = dependencies.findAccount ?? (id => magaluTokenStorage.findAccount(id));
    this.createClient = dependencies.createClient ?? (account => new MagaluClient(account));
    this.getConfig = dependencies.getConfig ?? getMagaluConfig;
    this.parser = dependencies.parser ?? new NFeParserService();
  }

  async getInvoice(input: GetMagaluInvoiceInput): Promise<MagaluProcessedInvoice | null> {
    const parsed = deliverySchema.safeParse(input?.delivery);
    if (!parsed.success) throw new AppError("Entrega ou canal Magalu inválido", 400);
    const { marketplaceAccountId, externalDeliveryId, channelId } = parsed.data;
    const account = await this.findAccount(marketplaceAccountId);
    if (!account || account.id !== marketplaceAccountId || account.userId !== this.userId ||
      account.platform !== "MAGALU" || !account.isActive) {
      throw new MagaluHttpError("Conta Magalu não encontrada para este usuário ou inativa.", 404, "invalid_account");
    }
    const config = this.getConfig();
    if (config.environment === "sandbox" && channelId !== config.channelId) {
      throw new AppError("A entrega não pertence ao canal configurado do sandbox Magalu", 400);
    }
    // Em produção, utilizar o canal da entrega obtido na API, nunca um canal de exemplo.
    const client = this.createClient(account);
    const expected = normalizeCustomerDocument(input.customer?.document, input.customer?.documentType);
    let selected: MagaluProcessedInvoice | null = null;
    let ambiguous = false;
    let unavailableApprovedXml = false;
    let firstFailure: MagaluHttpError | null = null;
    let offset = 0;
    let limit = this.pageSize;
    let previousSignature: string | null = null;

    for (;;) {
      let response: MagaluResponse<unknown>;
      try {
        response = await client.get<unknown>(`/seller/v1/deliveries/${encodeURIComponent(externalDeliveryId)}/invoices`, {
          headers: { "X-Channel-Id": channelId },
          query: { _offset: offset, _limit: limit, _sort: "created_at:asc" },
        });
      } catch (error) {
        // Apenas ausência no endpoint de notas, nunca falhas na conta/autorização.
        if (offset === 0 && error instanceof MagaluHttpError && error.code === "not_found") return null;
        throw error;
      }
      if (response.status === 204 && offset === 0) return null;
      const page = magaluInvoiceResponseSchema.safeParse(response.data);
      if (!page.success) throw this.invalidResponse("uma coleção de notas inválida", response.requestId, response.status);
      const { results, meta } = page.data;
      const paging = meta.page;
      if (paging.offset !== offset || paging.count !== results.length ||
        !Number.isSafeInteger(paging.offset) || !Number.isSafeInteger(paging.max_limit) ||
        paging.limit <= 0 || paging.max_limit <= 0 || results.length > limit) {
        throw this.invalidResponse("paginação de notas inconsistente", response.requestId, response.status);
      }
      if (results.length === 0) break;
      const signature = createHash("sha256").update(JSON.stringify(
        results.map(invoice => [invoice.key, invoice.status, invoice.issued_at]).sort(),
      )).digest("hex");
      if (signature === previousSignature) {
        throw this.invalidResponse("uma página de notas repetida sem progresso", response.requestId, response.status);
      }
      previousSignature = signature;

      for (const invoice of results) {
        if (invoice.status !== "approved") continue;
        if (!invoice.xml?.trim()) {
          unavailableApprovedXml = true;
          continue;
        }
        let candidate: MagaluProcessedInvoice;
        try {
          candidate = this.parseInvoice(invoice, response.requestId, response.status);
        } catch (error) {
          if (!(error instanceof MagaluHttpError)) throw error;
          firstFailure ??= error;
          input.onInvoiceError?.(error);
          continue;
        }
        if (expected.document && (candidate.document !== expected.document || candidate.documentType !== expected.documentType)) continue;
        if (!expected.document && selected && (!candidate.document || !selected.document ||
          candidate.document !== selected.document || candidate.documentType !== selected.documentType)) {
          ambiguous = true;
        }
        if (!selected || this.isBetter(candidate, selected)) selected = candidate;
      }
      const nextOffset = offset + results.length;
      if (!Number.isSafeInteger(nextOffset) || nextOffset <= offset) {
        throw this.invalidResponse("um offset de notas inválido", response.requestId, response.status);
      }
      offset = nextOffset;
      limit = Math.min(this.pageSize, paging.max_limit);
    }
    // Sem documento do pedido, XML inválido impede conferir todos os destinatários.
    if (firstFailure && (!selected || !expected.document)) throw firstFailure;
    return ambiguous || (!expected.document && unavailableApprovedXml) ? null : selected;
  }

  private parseInvoice(invoice: MagaluInvoice, requestId: string, status: number): MagaluProcessedInvoice {
    if (!invoice.key || !/^\d{44}$/.test(invoice.key) ||
      (invoice.issued_at != null && !issuedAtSchema.safeParse(invoice.issued_at).success)) {
      throw this.invalidResponse("metadados de NF-e inválidos", requestId, status);
    }
    let parsed: ParsedNFeData;
    try {
      parsed = this.parser.parse(invoice.xml!);
    } catch (error) {
      if (!(error instanceof NFeParserError)) throw error;
      throw this.invalidResponse("um XML de NF-e inválido", requestId, status);
    }
    if (parsed.invoiceKey !== invoice.key) {
      throw this.invalidResponse("uma chave de NF-e incompatível com o XML", requestId, status);
    }
    return { ...parsed, phone: normalizePhone(parsed.phone), issuedAt: invoice.issued_at ?? null, status: "approved" };
  }

  private isBetter(candidate: MagaluProcessedInvoice, current: MagaluProcessedInvoice): boolean {
    const candidateScore = Number(Boolean(candidate.phone)) * 2 + Number(Boolean(candidate.customerName));
    const currentScore = Number(Boolean(current.phone)) * 2 + Number(Boolean(current.customerName));
    return candidateScore > currentScore || (candidateScore === currentScore && candidate.invoiceKey < current.invoiceKey);
  }

  private invalidResponse(reason: string, requestId: string, providerStatus: number): MagaluHttpError {
    return new MagaluHttpError(`A Magalu retornou ${reason}.`, 502, "invalid_response", providerStatus, requestId);
  }
}

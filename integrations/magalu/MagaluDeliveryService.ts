import { createHash } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../errors/AppError";
import type { MarketplaceDelivery } from "../types";
import { MagaluClient } from "./MagaluClient";
import { getMagaluConfig } from "./magaluConfig";
import type { MagaluConfig } from "./magaluConfig";
import { magaluDeliveryResponseSchema, magaluOrderChannelSchema } from "./magaluDelivery.types";
import { MagaluHttpError } from "./magaluHttpError";
import { magaluTokenStorage } from "./magaluTokenStorage";
import type { MagaluTokenAccount } from "./magaluTokenStorage";

const inputSchema = z.object({
  marketplaceAccountId: z.string().trim().min(1),
  externalOrderId: z.string().trim().min(1).max(200).refine(code => code !== "." && code !== ".."),
});

export interface GetMagaluDeliveriesInput {
  marketplaceAccountId: string;
  /** MarketplaceOrder.externalOrderId, que na Magalu corresponde a order.code. */
  externalOrderId: string;
}

interface MagaluDeliveryServiceDependencies {
  findAccount?: (id: string) => Promise<MagaluTokenAccount | null>;
  createClient?: (account: MagaluTokenAccount) => Pick<MagaluClient, "get">;
  getConfig?: () => MagaluConfig;
  pageSize?: number;
}

/** Leitura dos pacotes de um pedido, sem buscar NF-e ou persistir entregas. */
export class MagaluDeliveryService {
  private readonly findAccount: NonNullable<MagaluDeliveryServiceDependencies["findAccount"]>;
  private readonly createClient: NonNullable<MagaluDeliveryServiceDependencies["createClient"]>;
  private readonly getConfig: () => MagaluConfig;
  private readonly pageSize: number;

  constructor(private readonly userId: string, dependencies: MagaluDeliveryServiceDependencies = {}) {
    if (typeof userId !== "string" || !userId.trim()) {
      throw new AppError("Usuário autenticado necessário para consultar entregas Magalu", 401);
    }
    this.pageSize = dependencies.pageSize ?? 20;
    if (!Number.isInteger(this.pageSize) || this.pageSize < 1 || this.pageSize > 100) {
      throw new AppError("O tamanho do lote Magalu deve estar entre 1 e 100", 400);
    }
    this.findAccount = dependencies.findAccount ?? (id => magaluTokenStorage.findAccount(id));
    this.createClient = dependencies.createClient ?? (account => new MagaluClient(account));
    this.getConfig = dependencies.getConfig ?? getMagaluConfig;
  }

  async *getDeliveries(input: GetMagaluDeliveriesInput): AsyncGenerator<MarketplaceDelivery[]> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Conta ou código do pedido Magalu inválido", 400);
    const { marketplaceAccountId, externalOrderId } = parsed.data;
    const account = await this.findAccount(marketplaceAccountId);
    if (!account || account.id !== marketplaceAccountId || account.userId !== this.userId ||
      account.platform !== "MAGALU" || !account.isActive) {
      throw new MagaluHttpError("Conta Magalu não encontrada para este usuário ou inativa.", 404, "invalid_account");
    }
    const config = this.getConfig();
    const client = this.createClient(account);
    let channelId: string;
    if (config.environment === "sandbox") {
      channelId = config.channelId;
    } else {
      // O endpoint de pedido não exige canal; ele resolve o canal real da venda.
      // Nunca usar config.channelId de produção como fallback ou presumir Magalu.
      const response = await client.get<unknown>(`/seller/v1/orders/${encodeURIComponent(externalOrderId)}`);
      const order = magaluOrderChannelSchema.safeParse(response.data);
      if (!order.success || order.data.code !== externalOrderId) {
        throw this.invalidResponse("um pedido sem canal válido ou com código incompatível", response.requestId, response.status);
      }
      channelId = order.data.channel.id;
    }

    let offset = 0;
    let limit = this.pageSize;
    let previousPageSignature: string | null = null;
    for (;;) {
      const response = await client.get<unknown>("/seller/v1/deliveries", {
        headers: { "X-Channel-Id": channelId },
        query: { code: externalOrderId, _offset: offset, _limit: limit, _sort: "purchased_at:asc" },
      });
      const page = magaluDeliveryResponseSchema.safeParse(response.data);
      if (!page.success) throw this.invalidResponse("uma lista de entregas inválida", response.requestId, response.status);
      const { results, meta } = page.data;
      const paging = meta.page;
      if (paging.offset !== offset || paging.count !== results.length ||
        !Number.isSafeInteger(paging.offset) || !Number.isSafeInteger(paging.max_limit) ||
        paging.limit <= 0 || paging.max_limit <= 0 || results.length > limit) {
        throw this.invalidResponse("metadados de paginação de entregas inconsistentes", response.requestId, response.status);
      }
      if (results.length === 0) return;
      if (results.some(delivery => delivery.order.code !== externalOrderId || delivery.order.channel.id !== channelId)) {
        throw this.invalidResponse("uma entrega de outro pedido ou canal", response.requestId, response.status);
      }

      const signature = createHash("sha256").update(JSON.stringify(results.map(delivery => delivery.id).sort())).digest("hex");
      if (signature === previousPageSignature) {
        throw this.invalidResponse("uma página de entregas repetida sem progresso", response.requestId, response.status);
      }
      previousPageSignature = signature;
      const nextOffset = offset + results.length;
      if (!Number.isSafeInteger(nextOffset) || nextOffset <= offset) {
        throw this.invalidResponse("um offset de entregas inválido", response.requestId, response.status);
      }
      offset = nextOffset;
      limit = Math.min(this.pageSize, paging.max_limit);

      yield results.map(delivery => ({
        externalDeliveryId: delivery.id,
        externalDeliveryCode: delivery.code ?? null,
        externalOrderId: delivery.order.code,
        marketplaceAccountId,
        platform: "MAGALU",
        channelId: delivery.order.channel.id,
        status: delivery.status ?? null,
      }));
    }
  }

  private invalidResponse(reason: string, requestId: string, providerStatus: number): MagaluHttpError {
    return new MagaluHttpError(`A Magalu retornou ${reason}.`, 502, "invalid_response", providerStatus, requestId);
  }
}

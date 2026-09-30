import type {
  GetMarketplaceOrdersOptions,
  MarketplaceAccountData,
  MarketplaceIntegration,
  MarketplaceInvoice,
  MarketplaceOrder,
  MarketplaceOrderPage,
} from "../types";

export class MercadoLivreIntegration implements MarketplaceIntegration {
  async getAccount(): Promise<MarketplaceAccountData> {
    throw new Error("Integração com o Mercado Livre ainda não implementada");
  }

  async getOrders(
    _options: GetMarketplaceOrdersOptions,
  ): Promise<MarketplaceOrderPage> {
    throw new Error("Integração com o Mercado Livre ainda não implementada");
  }

  async getOrderDetails(
    _externalOrderId: string,
  ): Promise<MarketplaceOrder | null> {
    throw new Error("Integração com o Mercado Livre ainda não implementada");
  }

  async getInvoice(
    _externalOrderId: string,
  ): Promise<MarketplaceInvoice | null> {
    throw new Error("Integração com o Mercado Livre ainda não implementada");
  }
}

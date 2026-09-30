import type {
  GetMarketplaceOrdersOptions,
  MarketplaceAccountData,
  MarketplaceInvoice,
  MarketplaceOrder,
  MarketplaceOrderPage,
} from "./marketplace.types";

export interface MarketplaceIntegration {
  getAccount(): Promise<MarketplaceAccountData>;

  getOrders(
    options: GetMarketplaceOrdersOptions,
  ): Promise<MarketplaceOrderPage>;

  getOrderDetails(externalOrderId: string): Promise<MarketplaceOrder | null>;

  getInvoice(externalOrderId: string): Promise<MarketplaceInvoice | null>;
}

import type { GetMarketplaceOrdersOptions, MarketplaceAccountData, MarketplaceIntegration, MarketplaceInvoice, MarketplaceOrder, MarketplaceOrderPage } from "../types";
export declare class MercadoLivreIntegration implements MarketplaceIntegration {
    getAccount(): Promise<MarketplaceAccountData>;
    getOrders(_options: GetMarketplaceOrdersOptions): Promise<MarketplaceOrderPage>;
    getOrderDetails(_externalOrderId: string): Promise<MarketplaceOrder | null>;
    getInvoice(_externalOrderId: string): Promise<MarketplaceInvoice | null>;
}
//# sourceMappingURL=MercadoLivreIntegration.d.ts.map
export type MarketplacePlatform = "MERCADO_LIVRE" | "MAGALU";
export interface MarketplaceAccountData {
    externalAccountId: string;
    name: string | null;
    cnpj: string | null;
}
export interface MarketplaceCustomer {
    name: string | null;
    phone: string | null;
}
export interface MarketplaceOrderItem {
    externalProductId: string | null;
    productName: string;
    quantity: number;
    unitPrice: string | null;
}
export interface MarketplaceInvoice {
    invoiceKey: string | null;
    invoiceNumber: string | null;
    customerName: string | null;
    phone: string | null;
    xml: string | null;
}
export interface MarketplaceOrder {
    externalOrderId: string;
    platform: MarketplacePlatform;
    orderDate: Date | null;
    status: string | null;
    customer: MarketplaceCustomer;
    items: MarketplaceOrderItem[];
}
export interface GetMarketplaceOrdersOptions {
    from: Date | null;
    to: Date | null;
    cursor: string | null;
    limit: number;
}
export interface MarketplaceOrderPage {
    orders: MarketplaceOrder[];
    nextCursor: string | null;
}
//# sourceMappingURL=marketplace.types.d.ts.map
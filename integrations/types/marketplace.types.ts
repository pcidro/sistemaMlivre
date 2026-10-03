export type MarketplacePlatform = "MERCADO_LIVRE" | "MAGALU";

export interface MarketplaceAccountData {
  externalAccountId: string;
  name: string | null;
  cnpj: string | null;
}

export interface MarketplaceCustomer {
  name: string | null;
  phone: string | null;
  document?: string | null;
  documentType?: "CPF" | "CNPJ" | null;
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

/** Referência normalizada de um pacote; não contém dados pessoais ou NF-e. */
export interface MarketplaceDelivery {
  externalDeliveryId: string;
  externalDeliveryCode: string | null;
  externalOrderId: string;
  marketplaceAccountId: string;
  platform: MarketplacePlatform;
  channelId: string;
  status: string | null;
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

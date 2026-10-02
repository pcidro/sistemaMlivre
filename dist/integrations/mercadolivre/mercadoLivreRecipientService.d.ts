import type { MarketplaceCustomer, MarketplaceOrder } from "../types";
interface AccessTokenProvider {
    getValidAccessToken(marketplaceAccountId: string): Promise<string>;
    refreshAccessToken(marketplaceAccountId: string): Promise<string>;
}
interface MercadoLivreRecipientServiceDependencies {
    tokenService?: AccessTokenProvider;
    fetchFn?: typeof globalThis.fetch;
    sleepFn?: (milliseconds: number) => Promise<void>;
}
export declare class MercadoLivreRecipientService {
    private readonly tokenService;
    private readonly fetchFn;
    private readonly sleepFn;
    constructor(dependencies?: MercadoLivreRecipientServiceDependencies);
    getRecipient(marketplaceAccountId: string, order: Pick<MarketplaceOrder, "externalOrderId" | "customer">): Promise<MarketplaceCustomer>;
    private findForwardShipmentId;
    private requestJson;
}
export {};
//# sourceMappingURL=mercadoLivreRecipientService.d.ts.map
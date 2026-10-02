export interface GetMercadoLivreInvoiceInput {
    marketplaceAccountId: string;
    userId: string;
    externalOrderId: string;
}
interface AccessTokenProvider {
    getValidAccessToken(marketplaceAccountId: string): Promise<string>;
    refreshAccessToken(marketplaceAccountId: string): Promise<string>;
}
interface MercadoLivreInvoiceServiceDependencies {
    tokenService?: AccessTokenProvider;
    fetchFn?: typeof globalThis.fetch;
    findOwnedAccount?: (marketplaceAccountId: string, userId: string) => Promise<{
        externalAccountId: string;
    } | null>;
    sleepFn?: (milliseconds: number) => Promise<void>;
}
/** Consulta apenas NF-e de venda; o XML retornado é transitório e não é persistido. */
export declare class MercadoLivreInvoiceService {
    private readonly tokenService;
    private readonly fetchFn;
    private readonly findOwnedAccount;
    private readonly sleepFn;
    constructor(dependencies?: MercadoLivreInvoiceServiceDependencies);
    getInvoiceXml(input: GetMercadoLivreInvoiceInput): Promise<string | null>;
    private getOfficialXmlUrl;
    private request;
    private discardResponse;
    private readXml;
    private waitBeforeRetry;
}
export {};
//# sourceMappingURL=mercadoLivreInvoiceService.d.ts.map
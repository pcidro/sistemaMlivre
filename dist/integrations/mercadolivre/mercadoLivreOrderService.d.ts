import { z } from "zod";
import type { MarketplaceOrder } from "../types";
declare const orderSchema: z.ZodObject<{
    id: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    status: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    date_created: z.ZodString;
    order_items: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        item: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
            title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        quantity: z.ZodNumber;
        unit_price: z.ZodNullable<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export interface GetMercadoLivreOrdersInput {
    marketplaceAccountId: string;
    userId: string;
    dateFrom: Date;
    dateTo: Date;
}
interface OwnedMarketplaceAccount {
    id: string;
    externalAccountId: string;
}
interface AccessTokenProvider {
    getValidAccessToken(marketplaceAccountId: string): Promise<string>;
    refreshAccessToken(marketplaceAccountId: string): Promise<string>;
}
interface MercadoLivreOrderServiceDependencies {
    tokenService?: AccessTokenProvider;
    fetchFn?: typeof globalThis.fetch;
    findOwnedAccount?: (marketplaceAccountId: string, userId: string) => Promise<OwnedMarketplaceAccount | null>;
    sleepFn?: (milliseconds: number) => Promise<void>;
    randomFn?: () => number;
    nowFn?: () => Date;
}
export declare function normalizeMercadoLivreOrder(rawOrder: z.infer<typeof orderSchema>): MarketplaceOrder;
export declare class MercadoLivreOrderService {
    private readonly tokenService;
    private readonly fetchFn;
    private readonly findOwnedAccount;
    private readonly sleepFn;
    private readonly randomFn;
    private readonly nowFn;
    constructor(dependencies?: MercadoLivreOrderServiceDependencies);
    getOrders(input: GetMercadoLivreOrdersInput): AsyncGenerator<MarketplaceOrder[]>;
    private getWindowOrders;
    private requestPage;
    private waitBeforeRetry;
    private parseRetryAfter;
    private validatePeriod;
}
export {};
//# sourceMappingURL=mercadoLivreOrderService.d.ts.map
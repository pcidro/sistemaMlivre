import { type MagaluConfig } from "./magaluConfig";
import { type MagaluOAuthConfig } from "./magaluOAuthConfig";
import { MagaluTokenService } from "./MagaluTokenService";
import { MagaluRequestLimiter } from "./MagaluRequestLimiter";
import type { MagaluTokenAccount } from "./magaluTokenStorage";
export interface MagaluRequestOptions {
    method?: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";
    query?: Readonly<Record<string, string | number | boolean | undefined>>;
    headers?: Readonly<Record<string, string>>;
    body?: unknown;
    responseType?: "json" | "text";
    signal?: AbortSignal;
    maxRetries?: number;
}
export interface MagaluResponse<T> {
    data: T | null;
    status: number;
    requestId: string;
}
interface ClientDependencies {
    fetchFn?: typeof globalThis.fetch;
    tokenService?: Pick<MagaluTokenService, "getAccessToken">;
    limiter?: MagaluRequestLimiter;
    getConfig?: () => MagaluConfig;
    getOAuthConfig?: () => MagaluOAuthConfig;
    nowFn?: () => number;
}
export declare class MagaluClient {
    private readonly account;
    private readonly config;
    private readonly fetchFn;
    private readonly tokens;
    private readonly limiter;
    private readonly getOAuthConfig;
    private readonly now;
    constructor(account: MagaluTokenAccount, dependencies?: ClientDependencies);
    get<T = unknown>(path: string, options?: Omit<MagaluRequestOptions, "method" | "body">): Promise<MagaluResponse<T>>;
    request<T = unknown>(path: string, options?: MagaluRequestOptions): Promise<MagaluResponse<T>>;
    private buildUrl;
    private readResponse;
}
export {};
//# sourceMappingURL=MagaluClient.d.ts.map
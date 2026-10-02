type Sleep = (milliseconds: number) => Promise<void>;
interface RequestLimiterDependencies {
    fetchFn?: typeof globalThis.fetch;
    sleepFn?: Sleep;
    nowFn?: () => number;
    intervalMs?: number;
}
/** Compartilhado pelas consultas da importação, inclusive suas tentativas repetidas. */
export declare class MercadoLivreRequestLimiter {
    private queue;
    private nextRequestAt;
    private blockedUntil;
    private readonly fetchFn;
    private readonly sleepFn;
    private readonly nowFn;
    private readonly intervalMs;
    constructor(dependencies?: RequestLimiterDependencies);
    readonly fetch: typeof globalThis.fetch;
}
export {};
//# sourceMappingURL=MercadoLivreRequestLimiter.d.ts.map
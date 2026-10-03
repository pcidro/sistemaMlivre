import { MagaluHttpError } from "./magaluHttpError";
export interface MagaluLimiterDependencies {
    nowFn?: () => number;
    sleepFn?: (delay: number, signal?: AbortSignal) => Promise<void>;
    intervalMs?: number;
}
export declare class MagaluRequestLimiter {
    private readonly states;
    private readonly now;
    private readonly sleep;
    private readonly interval;
    constructor(dependencies?: MagaluLimiterDependencies);
    block(key: string, delayMs: number, requestId: string | null, error?: MagaluHttpError | null): void;
    acquire(key: string, deadline: number, signal?: AbortSignal): Promise<void>;
    private state;
}
export declare const magaluRequestLimiter: MagaluRequestLimiter;
//# sourceMappingURL=MagaluRequestLimiter.d.ts.map
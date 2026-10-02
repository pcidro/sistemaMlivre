"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoLivreRequestLimiter = void 0;
/** Compartilhado pelas consultas da importação, inclusive suas tentativas repetidas. */
class MercadoLivreRequestLimiter {
    queue = Promise.resolve();
    nextRequestAt = 0;
    blockedUntil = 0;
    fetchFn;
    sleepFn;
    nowFn;
    intervalMs;
    constructor(dependencies = {}) {
        this.fetchFn = dependencies.fetchFn ?? globalThis.fetch;
        this.sleepFn = dependencies.sleepFn ??
            ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
        this.nowFn = dependencies.nowFn ?? Date.now;
        this.intervalMs = dependencies.intervalMs ?? 250;
    }
    fetch = async (input, init) => {
        const turn = this.queue.then(async () => {
            let delay;
            while ((delay = Math.max(this.nextRequestAt, this.blockedUntil) - this.nowFn()) > 0) {
                await this.sleepFn(Math.min(delay, 30_000));
            }
            this.nextRequestAt = this.nowFn() + this.intervalMs;
        });
        this.queue = turn.catch(() => { });
        await turn;
        const timeout = AbortSignal.timeout(15_000);
        const response = await this.fetchFn(input, {
            ...init,
            redirect: "error",
            signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
        });
        if (response.status === 429) {
            const retryAfter = response.headers.get("retry-after");
            const seconds = retryAfter === null ? NaN : Number(retryAfter);
            const until = Number.isFinite(seconds) && seconds >= 0
                ? this.nowFn() + seconds * 1000
                : Date.parse(retryAfter ?? "");
            // Sem Retry-After, reduzir a frequência por pelo menos dois segundos.
            this.blockedUntil = Math.max(this.blockedUntil, this.nowFn() + 2000, Number.isFinite(until) ? until : 0);
        }
        return response;
    };
}
exports.MercadoLivreRequestLimiter = MercadoLivreRequestLimiter;
//# sourceMappingURL=MercadoLivreRequestLimiter.js.map
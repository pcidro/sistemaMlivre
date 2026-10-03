"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.magaluRequestLimiter = exports.MagaluRequestLimiter = void 0;
const magaluHttpError_1 = require("./magaluHttpError");
class MagaluRequestLimiter {
    states = new Map();
    now;
    sleep;
    interval;
    constructor(dependencies = {}) {
        this.now = dependencies.nowFn ?? Date.now;
        this.interval = dependencies.intervalMs ?? 250;
        if (!Number.isFinite(this.interval) || this.interval < 0)
            throw new Error("Intervalo de consultas Magalu inválido");
        this.sleep = dependencies.sleepFn ?? ((delay, signal) => new Promise((resolve, reject) => {
            const finish = () => { signal?.removeEventListener("abort", abort); resolve(); };
            const timer = setTimeout(finish, delay);
            const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(new magaluHttpError_1.MagaluHttpError("Consulta Magalu cancelada.", 499, "cancelled")); };
            if (signal?.aborted)
                abort();
            else
                signal?.addEventListener("abort", abort, { once: true });
        }));
    }
    block(key, delayMs, requestId, error = null) {
        const state = this.state(key);
        const until = this.now() + delayMs;
        if (until >= state.blockedUntil) {
            state.blockedUntil = until;
            state.requestId = requestId;
            state.blockedError = error;
        }
    }
    async acquire(key, deadline, signal) {
        const state = this.state(key);
        const turn = state.queue.then(async () => {
            for (;;) {
                if (signal?.aborted)
                    throw new magaluHttpError_1.MagaluHttpError("Consulta Magalu cancelada.", 499, "cancelled");
                const now = this.now();
                const delay = Math.max(state.nextAt, state.blockedUntil) - now;
                if (now >= deadline || now + Math.max(delay, 0) >= deadline) {
                    if (state.blockedUntil > now) {
                        if (state.blockedError) {
                            const error = state.blockedError;
                            throw new magaluHttpError_1.MagaluHttpError(error.message, error.statusCode, error.code, error.providerStatus, error.requestId, state.blockedUntil - now, error.retryable);
                        }
                        throw new magaluHttpError_1.MagaluHttpError("A Magalu ainda está limitando consultas. Aguarde antes de tentar novamente.", 429, "rate_limited", 429, state.requestId, state.blockedUntil - now, true);
                    }
                    throw new magaluHttpError_1.MagaluHttpError("O tempo limite da consulta Magalu foi atingido.", 504, "timeout");
                }
                if (delay <= 0)
                    break;
                await this.sleep(Math.min(delay, 1000), signal);
            }
            state.nextAt = this.now() + this.interval;
        });
        state.queue = turn.catch(() => { });
        await turn;
    }
    state(key) {
        let state = this.states.get(key);
        if (!state) {
            state = { queue: Promise.resolve(), nextAt: 0, blockedUntil: 0, requestId: null, blockedError: null };
            this.states.set(key, state);
        }
        return state;
    }
}
exports.MagaluRequestLimiter = MagaluRequestLimiter;
exports.magaluRequestLimiter = new MagaluRequestLimiter();
//# sourceMappingURL=MagaluRequestLimiter.js.map
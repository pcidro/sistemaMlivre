import { MagaluHttpError } from "./magaluHttpError";

interface LimiterState {
  queue: Promise<void>;
  nextAt: number;
  blockedUntil: number;
  requestId: string | null;
  blockedError: MagaluHttpError | null;
}

export interface MagaluLimiterDependencies {
  nowFn?: () => number;
  sleepFn?: (delay: number, signal?: AbortSignal) => Promise<void>;
  intervalMs?: number;
}

export class MagaluRequestLimiter {
  private readonly states = new Map<string, LimiterState>();
  private readonly now: () => number;
  private readonly sleep: (delay: number, signal?: AbortSignal) => Promise<void>;
  private readonly interval: number;

  constructor(dependencies: MagaluLimiterDependencies = {}) {
    this.now = dependencies.nowFn ?? Date.now;
    this.interval = dependencies.intervalMs ?? 250;
    if (!Number.isFinite(this.interval) || this.interval < 0) throw new Error("Intervalo de consultas Magalu inválido");
    this.sleep = dependencies.sleepFn ?? ((delay, signal) => new Promise<void>((resolve, reject) => {
      const finish = () => { signal?.removeEventListener("abort", abort); resolve(); };
      const timer = setTimeout(finish, delay);
      const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(new MagaluHttpError("Consulta Magalu cancelada.", 499, "cancelled")); };
      if (signal?.aborted) abort(); else signal?.addEventListener("abort", abort, { once: true });
    }));
  }

  block(key: string, delayMs: number, requestId: string | null, error: MagaluHttpError | null = null) {
    const state = this.state(key);
    const until = this.now() + delayMs;
    if (until >= state.blockedUntil) {
      state.blockedUntil = until;
      state.requestId = requestId;
      state.blockedError = error;
    }
  }

  async acquire(key: string, deadline: number, signal?: AbortSignal) {
    const state = this.state(key);
    const turn = state.queue.then(async () => {
      for (;;) {
        if (signal?.aborted) throw new MagaluHttpError("Consulta Magalu cancelada.", 499, "cancelled");
        const now = this.now();
        const delay = Math.max(state.nextAt, state.blockedUntil) - now;
        if (now >= deadline || now + Math.max(delay, 0) >= deadline) {
          if (state.blockedUntil > now) {
            if (state.blockedError) {
              const error = state.blockedError;
              throw new MagaluHttpError(error.message, error.statusCode, error.code, error.providerStatus,
                error.requestId, state.blockedUntil - now, error.retryable);
            }
            throw new MagaluHttpError("A Magalu ainda está limitando consultas. Aguarde antes de tentar novamente.", 429,
              "rate_limited", 429, state.requestId, state.blockedUntil - now, true);
          }
          throw new MagaluHttpError("O tempo limite da consulta Magalu foi atingido.", 504, "timeout");
        }
        if (delay <= 0) break;
        await this.sleep(Math.min(delay, 1000), signal);
      }
      state.nextAt = this.now() + this.interval;
    });
    state.queue = turn.catch(() => {});
    await turn;
  }

  private state(key: string) {
    let state = this.states.get(key);
    if (!state) {
      state = { queue: Promise.resolve(), nextAt: 0, blockedUntil: 0, requestId: null, blockedError: null };
      this.states.set(key, state);
    }
    return state;
  }
}

export const magaluRequestLimiter = new MagaluRequestLimiter();

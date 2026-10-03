import { randomUUID } from "node:crypto";
import { getMagaluConfig, type MagaluConfig } from "./magaluConfig";
import { getMagaluOAuthConfig, type MagaluOAuthConfig } from "./magaluOAuthConfig";
import { MagaluTokenService, magaluTokenService } from "./MagaluTokenService";
import { MagaluRequestLimiter, magaluRequestLimiter } from "./MagaluRequestLimiter";
import { MagaluHttpError, magaluHttpFailure, safeMagaluRequestId, discardMagaluResponse } from "./magaluHttpError";
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

export class MagaluClient {
  private readonly account: MagaluTokenAccount;
  private readonly config: MagaluConfig;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly tokens: Pick<MagaluTokenService, "getAccessToken">;
  private readonly limiter: MagaluRequestLimiter;
  private readonly getOAuthConfig: () => MagaluOAuthConfig;
  private readonly now: () => number;

  constructor(account: MagaluTokenAccount, dependencies: ClientDependencies = {}) {
    if (account.platform !== "MAGALU" || !account.isActive || !account.userId) {
      throw new MagaluHttpError("Conta Magalu não encontrada, inativa ou sem acesso autorizado.", 404, "invalid_account");
    }
    this.account = { ...account };
    this.config = (dependencies.getConfig ?? getMagaluConfig)();
    this.fetchFn = dependencies.fetchFn ?? globalThis.fetch;
    this.tokens = dependencies.tokenService ?? magaluTokenService;
    this.limiter = dependencies.limiter ?? magaluRequestLimiter;
    this.getOAuthConfig = dependencies.getOAuthConfig ?? getMagaluOAuthConfig;
    this.now = dependencies.nowFn ?? Date.now;
  }

  get<T = unknown>(path: string, options: Omit<MagaluRequestOptions, "method" | "body"> = {}) {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  async request<T = unknown>(path: string, options: MagaluRequestOptions = {}): Promise<MagaluResponse<T>> {
    const maxRetries = options.maxRetries ?? 2;
    if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 3) {
      throw new MagaluHttpError("O limite de tentativas Magalu deve estar entre zero e três.", 400, "bad_request");
    }
    const method = options.method ?? "GET";
    const safeToRepeat = method === "GET" || method === "HEAD";
    const url = this.buildUrl(path, options.query);
    const deadline = this.now() + 60_000;
    const key = `${this.config.apiBaseUrl}:${this.account.externalAccountId}`;
    let retries = 0;
    let renewed = false;
    let rejectedToken: string | undefined;
    let body: string | undefined;
    let baseHeaders: Headers;
    try {
      baseHeaders = new Headers(options.headers);
      if (options.body !== undefined) {
        if (safeToRepeat) throw new MagaluHttpError("Consultas GET/HEAD Magalu não aceitam body.", 400, "bad_request");
        body = JSON.stringify(options.body);
      }
    } catch (error) {
      if (error instanceof MagaluHttpError) throw error;
      throw new MagaluHttpError("O conteúdo da requisição Magalu é inválido.", 400, "bad_request");
    }
    for (;;) {
      if (options.signal?.aborted) throw new MagaluHttpError("Consulta Magalu cancelada.", 499, "cancelled");
      const oauthConfig = this.getOAuthConfig();
      if (oauthConfig.environment !== this.config.environment || oauthConfig.audience !== this.config.apiBaseUrl) {
        throw new MagaluHttpError("O ambiente Magalu mudou. Crie novamente o client para a conta.", 409, "invalid_account");
      }
      const accessToken = await this.tokens.getAccessToken(this.account, oauthConfig, rejectedToken);
      // Reservar o horário da chamada depois de eventuais esperas de refresh,
      // evitando que chamadas liberadas pela renovação saiam todas juntas.
      await this.limiter.acquire(key, deadline, options.signal);
      const requestId = randomUUID();
      let response: Response;
      const timeout = AbortSignal.timeout(Math.max(1, Math.min(15_000, deadline - this.now())));
      try {
        const headers = new Headers(baseHeaders);
        headers.delete("Cookie");
        headers.delete("Host");
        headers.set("Authorization", `Bearer ${accessToken}`);
        headers.set("X-Request-ID", requestId);
        if (!headers.has("Accept")) headers.set("Accept", options.responseType === "text" ? "application/xml, text/plain" : "application/json");
        if (body !== undefined) headers.set("Content-Type", "application/json");
        response = await this.fetchFn(url, {
          method, headers, redirect: "error",
          signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
          ...(body === undefined ? {} : { body }),
        });
      } catch {
        const error = options.signal?.aborted
          ? new MagaluHttpError("Consulta Magalu cancelada.", 499, "cancelled", null, requestId)
          : timeout.aborted ? new MagaluHttpError("O tempo limite de comunicação com a Magalu foi atingido.", 504, "timeout", null, requestId, null, true)
          : new MagaluHttpError("Não foi possível comunicar com a Magalu no tempo permitido.", 503, "network", null, requestId, null, true);
        if (safeToRepeat && error.retryable && retries < maxRetries) {
          this.limiter.block(key, 500 * 2 ** retries++, requestId, error);
          continue;
        }
        throw error;
      }
      const responseId = safeMagaluRequestId(response.headers) ?? requestId;
      if (response.ok) return this.readResponse<T>(response, responseId, method, options.responseType);
      const error = magaluHttpFailure(response, this.now(), requestId);
      await discardMagaluResponse(response);
      if (response.status === 401 && safeToRepeat && !renewed) {
        renewed = true;
        rejectedToken = accessToken;
        continue;
      }
      if (error.retryable) this.limiter.block(key,
        Math.max(error.retryAfterMs ?? 0, response.status === 429 ? 2000 : 500 * 2 ** retries), responseId, error);
      if (safeToRepeat && error.retryable && retries < maxRetries) { retries++; continue; }
      throw error;
    }
  }

  private buildUrl(path: string, query: MagaluRequestOptions["query"]) {
    try {
      if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) throw new Error("Invalid path");
      const url = new URL(path, this.config.apiBaseUrl);
      if (url.origin !== this.config.apiBaseUrl || url.username || url.password || url.hash) throw new Error("Invalid destination");
      for (const [name, value] of Object.entries(query ?? {})) if (value !== undefined) url.searchParams.set(name, String(value));
      return url.toString();
    } catch { throw new MagaluHttpError("O endereço do recurso Magalu é inválido.", 400, "bad_request"); }
  }

  private async readResponse<T>(response: Response, requestId: string, method: string, responseType: MagaluRequestOptions["responseType"]): Promise<MagaluResponse<T>> {
    if (response.status === 204 || method === "HEAD") {
      await discardMagaluResponse(response);
      return { data: null, status: response.status, requestId };
    }
    try {
      const data = responseType === "text" ? await response.text() : await response.json();
      return { data: data as T, status: response.status, requestId };
    } catch {
      throw new MagaluHttpError("A Magalu retornou uma resposta inválida ou incompleta.", 502, "invalid_response", response.status, requestId);
    }
  }
}

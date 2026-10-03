"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MagaluClient = void 0;
const node_crypto_1 = require("node:crypto");
const magaluConfig_1 = require("./magaluConfig");
const magaluOAuthConfig_1 = require("./magaluOAuthConfig");
const MagaluTokenService_1 = require("./MagaluTokenService");
const MagaluRequestLimiter_1 = require("./MagaluRequestLimiter");
const magaluHttpError_1 = require("./magaluHttpError");
class MagaluClient {
    account;
    config;
    fetchFn;
    tokens;
    limiter;
    getOAuthConfig;
    now;
    constructor(account, dependencies = {}) {
        if (account.platform !== "MAGALU" || !account.isActive || !account.userId) {
            throw new magaluHttpError_1.MagaluHttpError("Conta Magalu não encontrada, inativa ou sem acesso autorizado.", 404, "invalid_account");
        }
        this.account = { ...account };
        this.config = (dependencies.getConfig ?? magaluConfig_1.getMagaluConfig)();
        this.fetchFn = dependencies.fetchFn ?? globalThis.fetch;
        this.tokens = dependencies.tokenService ?? MagaluTokenService_1.magaluTokenService;
        this.limiter = dependencies.limiter ?? MagaluRequestLimiter_1.magaluRequestLimiter;
        this.getOAuthConfig = dependencies.getOAuthConfig ?? magaluOAuthConfig_1.getMagaluOAuthConfig;
        this.now = dependencies.nowFn ?? Date.now;
    }
    get(path, options = {}) {
        return this.request(path, { ...options, method: "GET" });
    }
    async request(path, options = {}) {
        const maxRetries = options.maxRetries ?? 2;
        if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 3) {
            throw new magaluHttpError_1.MagaluHttpError("O limite de tentativas Magalu deve estar entre zero e três.", 400, "bad_request");
        }
        const method = options.method ?? "GET";
        const safeToRepeat = method === "GET" || method === "HEAD";
        const url = this.buildUrl(path, options.query);
        const deadline = this.now() + 60_000;
        const key = `${this.config.apiBaseUrl}:${this.account.externalAccountId}`;
        let retries = 0;
        let renewed = false;
        let rejectedToken;
        let body;
        let baseHeaders;
        try {
            baseHeaders = new Headers(options.headers);
            if (options.body !== undefined) {
                if (safeToRepeat)
                    throw new magaluHttpError_1.MagaluHttpError("Consultas GET/HEAD Magalu não aceitam body.", 400, "bad_request");
                body = JSON.stringify(options.body);
            }
        }
        catch (error) {
            if (error instanceof magaluHttpError_1.MagaluHttpError)
                throw error;
            throw new magaluHttpError_1.MagaluHttpError("O conteúdo da requisição Magalu é inválido.", 400, "bad_request");
        }
        for (;;) {
            if (options.signal?.aborted)
                throw new magaluHttpError_1.MagaluHttpError("Consulta Magalu cancelada.", 499, "cancelled");
            const oauthConfig = this.getOAuthConfig();
            if (oauthConfig.environment !== this.config.environment || oauthConfig.audience !== this.config.apiBaseUrl) {
                throw new magaluHttpError_1.MagaluHttpError("O ambiente Magalu mudou. Crie novamente o client para a conta.", 409, "invalid_account");
            }
            const accessToken = await this.tokens.getAccessToken(this.account, oauthConfig, rejectedToken);
            // Reservar o horário da chamada depois de eventuais esperas de refresh,
            // evitando que chamadas liberadas pela renovação saiam todas juntas.
            await this.limiter.acquire(key, deadline, options.signal);
            const requestId = (0, node_crypto_1.randomUUID)();
            let response;
            const timeout = AbortSignal.timeout(Math.max(1, Math.min(15_000, deadline - this.now())));
            try {
                const headers = new Headers(baseHeaders);
                headers.delete("Cookie");
                headers.delete("Host");
                headers.set("Authorization", `Bearer ${accessToken}`);
                headers.set("X-Request-ID", requestId);
                if (!headers.has("Accept"))
                    headers.set("Accept", options.responseType === "text" ? "application/xml, text/plain" : "application/json");
                if (body !== undefined)
                    headers.set("Content-Type", "application/json");
                response = await this.fetchFn(url, {
                    method, headers, redirect: "error",
                    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
                    ...(body === undefined ? {} : { body }),
                });
            }
            catch {
                const error = options.signal?.aborted
                    ? new magaluHttpError_1.MagaluHttpError("Consulta Magalu cancelada.", 499, "cancelled", null, requestId)
                    : timeout.aborted ? new magaluHttpError_1.MagaluHttpError("O tempo limite de comunicação com a Magalu foi atingido.", 504, "timeout", null, requestId, null, true)
                        : new magaluHttpError_1.MagaluHttpError("Não foi possível comunicar com a Magalu no tempo permitido.", 503, "network", null, requestId, null, true);
                if (safeToRepeat && error.retryable && retries < maxRetries) {
                    this.limiter.block(key, 500 * 2 ** retries++, requestId, error);
                    continue;
                }
                throw error;
            }
            const responseId = (0, magaluHttpError_1.safeMagaluRequestId)(response.headers) ?? requestId;
            if (response.ok)
                return this.readResponse(response, responseId, method, options.responseType);
            const error = (0, magaluHttpError_1.magaluHttpFailure)(response, this.now(), requestId);
            await (0, magaluHttpError_1.discardMagaluResponse)(response);
            if (response.status === 401 && safeToRepeat && !renewed) {
                renewed = true;
                rejectedToken = accessToken;
                continue;
            }
            if (error.retryable)
                this.limiter.block(key, Math.max(error.retryAfterMs ?? 0, response.status === 429 ? 2000 : 500 * 2 ** retries), responseId, error);
            if (safeToRepeat && error.retryable && retries < maxRetries) {
                retries++;
                continue;
            }
            throw error;
        }
    }
    buildUrl(path, query) {
        try {
            if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\"))
                throw new Error("Invalid path");
            const url = new URL(path, this.config.apiBaseUrl);
            if (url.origin !== this.config.apiBaseUrl || url.username || url.password || url.hash)
                throw new Error("Invalid destination");
            for (const [name, value] of Object.entries(query ?? {}))
                if (value !== undefined)
                    url.searchParams.set(name, String(value));
            return url.toString();
        }
        catch {
            throw new magaluHttpError_1.MagaluHttpError("O endereço do recurso Magalu é inválido.", 400, "bad_request");
        }
    }
    async readResponse(response, requestId, method, responseType) {
        if (response.status === 204 || method === "HEAD") {
            await (0, magaluHttpError_1.discardMagaluResponse)(response);
            return { data: null, status: response.status, requestId };
        }
        try {
            const data = responseType === "text" ? await response.text() : await response.json();
            return { data: data, status: response.status, requestId };
        }
        catch {
            throw new magaluHttpError_1.MagaluHttpError("A Magalu retornou uma resposta inválida ou incompleta.", 502, "invalid_response", response.status, requestId);
        }
    }
}
exports.MagaluClient = MagaluClient;
//# sourceMappingURL=MagaluClient.js.map
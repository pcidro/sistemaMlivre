"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.magaluTokenService = exports.MagaluTokenService = void 0;
const tokenEncryption_1 = require("../../utils/tokenEncryption");
const magaluOAuthClient_1 = require("./magaluOAuthClient");
const magaluHttpError_1 = require("./magaluHttpError");
const magaluTokenResponse_1 = require("./magaluTokenResponse");
const magaluTokenStorage_1 = require("./magaluTokenStorage");
/** Compartilhar uma instância entre clients para coordenar refresh e recuperação. */
class MagaluTokenService {
    oauthClient;
    storage;
    now;
    refreshes = new Map();
    pendingSaves = new Map();
    constructor(oauthClient = new magaluOAuthClient_1.MagaluOAuthClient(), storage = magaluTokenStorage_1.magaluTokenStorage, now = Date.now) {
        this.oauthClient = oauthClient;
        this.storage = storage;
        this.now = now;
    }
    async getAccessToken(expected, config, rejectedToken) {
        const key = `${config.clientId}:${config.environment}:${expected.id}:${expected.userId}`;
        try {
            this.assertAccount(expected, expected);
            const account = await this.storage.findAccount(expected.id);
            this.assertAccount(account, expected);
            const startedWhileReading = this.refreshes.get(key);
            if (startedWhileReading)
                return this.decrypt((await startedWhileReading).accessTokenEncrypted);
            const accessToken = this.decrypt(account.accessTokenEncrypted);
            if (!this.pendingSaves.has(key) && this.usable(account, accessToken, config, rejectedToken))
                return accessToken;
            const refresh = this.refresh(expected, config, key, rejectedToken);
            this.refreshes.set(key, refresh);
            try {
                return this.decrypt((await refresh).accessTokenEncrypted);
            }
            finally {
                if (this.refreshes.get(key) === refresh)
                    this.refreshes.delete(key);
            }
        }
        catch (error) {
            if (error instanceof magaluHttpError_1.MagaluHttpError)
                throw error;
            throw new magaluHttpError_1.MagaluHttpError("Não foi possível carregar ou salvar os tokens Magalu. Tente novamente.", 503, "token_persistence");
        }
    }
    async refresh(expected, config, key, rejectedToken) {
        const result = await this.storage.withLockedAccount(expected.id, async (account, save) => {
            this.assertAccount(account, expected);
            const pending = this.pendingSaves.get(key);
            if (pending) {
                if (this.sameTokens(account, pending.tokens))
                    return pending.tokens; // Commit pode ter ocorrido antes da falha de comunicação.
                if (this.sameTokens(account, pending.source)) {
                    await save(pending.tokens); // Recuperar sem enviar novamente o refresh antigo.
                    return pending.tokens;
                }
                this.pendingSaves.delete(key); // Reconexão ou mudança externa: nunca sobrescrever novos tokens.
            }
            const accessToken = this.decrypt(account.accessTokenEncrypted);
            if (this.usable(account, accessToken, config, rejectedToken))
                return account;
            if (!account.refreshTokenEncrypted) {
                throw new magaluHttpError_1.MagaluHttpError("A conta Magalu precisa ser conectada novamente para renovar a autorização.", 409, "unauthorized");
            }
            const refreshed = await this.oauthClient.refreshAccessToken(this.decrypt(account.refreshTokenEncrypted), config);
            if (refreshed.externalAccountId !== account.externalAccountId) {
                throw new magaluHttpError_1.MagaluHttpError("O ID Magalu retornou credenciais de outra conta.", 502, "invalid_response");
            }
            const tokens = {
                accessTokenEncrypted: (0, tokenEncryption_1.encryptToken)(refreshed.accessToken),
                refreshTokenEncrypted: refreshed.refreshToken ? (0, tokenEncryption_1.encryptToken)(refreshed.refreshToken) : account.refreshTokenEncrypted,
                tokenExpiresAt: refreshed.tokenExpiresAt,
            };
            // Reter o resultado criptografado antes de salvar. Se UPDATE/COMMIT falhar,
            // a próxima chamada tenta persistir o mesmo resultado sem repetir OAuth.
            this.pendingSaves.set(key, { source: account, tokens });
            await save(tokens);
            return tokens;
        });
        // withLockedAccount só retorna após COMMIT; o token novo só pode ser utilizado depois dele.
        this.pendingSaves.delete(key);
        return result;
    }
    usable(account, accessToken, config, rejectedToken) {
        let claims;
        try {
            claims = (0, magaluTokenResponse_1.readMagaluTokenClaims)(accessToken, config.audience);
        }
        catch {
            throw new magaluHttpError_1.MagaluHttpError("Os tokens Magalu não correspondem ao ambiente configurado. Conecte a conta novamente.", 409, "unauthorized");
        }
        if (claims.sub !== account.externalAccountId)
            throw new magaluHttpError_1.MagaluHttpError("As credenciais Magalu não correspondem à conta.", 409, "unauthorized");
        const expiry = Math.min(account.tokenExpiresAt?.getTime() ?? Number.NEGATIVE_INFINITY, claims.exp * 1000);
        return expiry > this.now() + 60_000 && accessToken !== rejectedToken;
    }
    assertAccount(account, expected) {
        if (!account || account.platform !== "MAGALU" || !account.isActive || !account.userId ||
            account.id !== expected.id || account.userId !== expected.userId || account.externalAccountId !== expected.externalAccountId) {
            throw new magaluHttpError_1.MagaluHttpError("Conta Magalu não encontrada, inativa ou sem acesso autorizado.", 404, "invalid_account");
        }
    }
    decrypt(value) {
        try {
            return (0, tokenEncryption_1.decryptToken)(value);
        }
        catch {
            throw new magaluHttpError_1.MagaluHttpError("Não foi possível acessar os tokens protegidos da Magalu. Verifique a configuração de criptografia.", 500, "token_protection");
        }
    }
    sameTokens(account, other) {
        return account.accessTokenEncrypted === other.accessTokenEncrypted && account.refreshTokenEncrypted === other.refreshTokenEncrypted;
    }
}
exports.MagaluTokenService = MagaluTokenService;
exports.magaluTokenService = new MagaluTokenService();
//# sourceMappingURL=MagaluTokenService.js.map
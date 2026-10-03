"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MagaluOAuthService = exports.MAGALU_STATE_MAX_AGE = exports.MAGALU_STATE_COOKIE_PATH = exports.MAGALU_STATE_COOKIE = void 0;
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const tokenEncryption_1 = require("../../utils/tokenEncryption");
const magaluOAuthClient_1 = require("./magaluOAuthClient");
const magaluOAuthConfig_1 = require("./magaluOAuthConfig");
const magaluOAuthStorage_1 = require("./magaluOAuthStorage");
exports.MAGALU_STATE_COOKIE = "magalu_oauth_state";
exports.MAGALU_STATE_COOKIE_PATH = "/api/marketplace-accounts/magalu/callback";
exports.MAGALU_STATE_MAX_AGE = 10 * 60 * 1000;
const statePattern = /^[a-f0-9]{64}$/;
class MagaluOAuthService {
    client;
    storage;
    getConfig;
    constructor(client = new magaluOAuthClient_1.MagaluOAuthClient(), storage = magaluOAuthStorage_1.magaluOAuthStorage, getConfig = magaluOAuthConfig_1.getMagaluOAuthConfig) {
        this.client = client;
        this.storage = storage;
        this.getConfig = getConfig;
    }
    async createAuthorization(userId) {
        try {
            const config = this.getConfig();
            if (!zod_1.z.string().uuid().safeParse(userId).success || !await this.storage.userExists(userId)) {
                throw new AppError_1.AppError("Usuário que iniciou a conexão não encontrado", 401);
            }
            const state = (0, node_crypto_1.randomBytes)(32).toString("hex");
            await this.storage.createState({
                stateHash: this.hashState(state), userId,
                configFingerprint: (0, magaluOAuthConfig_1.magaluOAuthConfigFingerprint)(config),
                expiresAt: new Date(Date.now() + exports.MAGALU_STATE_MAX_AGE),
            });
            return { authorizationUrl: this.client.getAuthorizationUrl(state, config), stateCookieValue: state };
        }
        catch (error) {
            throw this.safeError(error);
        }
    }
    async completeAuthorization(query, cookieValue) {
        try {
            const { state, code, error } = query;
            if (!statePattern.test(state) || !cookieValue || !statePattern.test(cookieValue) ||
                !(0, node_crypto_1.timingSafeEqual)(Buffer.from(state), Buffer.from(cookieValue))) {
                throw new AppError_1.AppError("State OAuth inválido ou expirado. Inicie uma nova conexão.", 400);
            }
            const config = this.getConfig();
            const session = await this.storage.consumeState(this.hashState(state), (0, magaluOAuthConfig_1.magaluOAuthConfigFingerprint)(config), new Date());
            if (!session)
                throw new AppError_1.AppError("State OAuth inválido, expirado ou já utilizado. Inicie uma nova conexão.", 400);
            if (error)
                throw new AppError_1.AppError("A autorização Magalu não foi concedida. Inicie uma nova conexão.", 400);
            if (!code)
                throw new AppError_1.AppError("Código de autorização Magalu ausente", 400);
            if (!await this.storage.userExists(session.userId))
                throw new AppError_1.AppError("Usuário que iniciou a conexão não encontrado", 401);
            const tokens = await this.client.exchangeAuthorizationCode(code, config);
            await this.storage.saveAccount({
                userId: session.userId,
                externalAccountId: tokens.externalAccountId,
                accessTokenEncrypted: (0, tokenEncryption_1.encryptToken)(tokens.accessToken),
                refreshTokenEncrypted: (0, tokenEncryption_1.encryptToken)(tokens.refreshToken),
                tokenExpiresAt: tokens.tokenExpiresAt,
            });
        }
        catch (error) {
            throw this.safeError(error);
        }
    }
    hashState(state) { return (0, node_crypto_1.createHash)("sha256").update(state).digest("hex"); }
    safeError(error) {
        if (error instanceof AppError_1.AppError)
            return error;
        if (error instanceof tokenEncryption_1.TokenEncryptionConfigurationError) {
            return new AppError_1.AppError("Configuração de proteção dos tokens inválida", 500);
        }
        return new AppError_1.AppError("Não foi possível salvar a autorização Magalu. Inicie uma nova conexão.", 500);
    }
}
exports.MagaluOAuthService = MagaluOAuthService;
//# sourceMappingURL=MagaluOAuthService.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAGALU_OAUTH_SCOPES = void 0;
exports.getMagaluOAuthConfig = getMagaluOAuthConfig;
exports.magaluOAuthConfigFingerprint = magaluOAuthConfigFingerprint;
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const magaluConfig_1 = require("./magaluConfig");
exports.MAGALU_OAUTH_SCOPES = [
    "open:order-order-seller:read",
    "open:order-delivery-seller:read",
    "open:order-invoice-seller:read",
];
const configSchema = zod_1.z.object({
    MAGALU_CLIENT_ID: zod_1.z.string().trim().min(1),
    MAGALU_CLIENT_SECRET: zod_1.z.string().min(1),
    MAGALU_REDIRECT_URI: zod_1.z.string().url(),
    MAGALU_AUTH_URL: zod_1.z.string().trim().url().default("https://id.magalu.com"),
});
function getMagaluOAuthConfig(env = process.env) {
    const parsed = configSchema.safeParse(env);
    if (!parsed.success)
        throw new AppError_1.AppError("Configuração OAuth da Magalu ausente ou inválida", 500);
    const values = parsed.data;
    const auth = new URL(values.MAGALU_AUTH_URL);
    const redirect = new URL(values.MAGALU_REDIRECT_URI);
    const localHttp = env.NODE_ENV !== "production" && redirect.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(redirect.hostname);
    if (auth.origin !== "https://id.magalu.com" || auth.pathname !== "/" ||
        auth.search || auth.hash || auth.username || auth.password ||
        (redirect.protocol !== "https:" && !localHttp) || redirect.username ||
        redirect.password || redirect.search || redirect.hash ||
        redirect.pathname !== "/api/marketplace-accounts/magalu/callback") {
        throw new AppError_1.AppError("URLs de autenticação ou callback da Magalu inválidas", 500);
    }
    const { environment, apiBaseUrl } = (0, magaluConfig_1.getMagaluConfig)(env);
    return {
        clientId: values.MAGALU_CLIENT_ID,
        clientSecret: values.MAGALU_CLIENT_SECRET,
        redirectUri: values.MAGALU_REDIRECT_URI,
        authorizationUrl: new URL("/login", auth).toString(),
        tokenUrl: new URL("/oauth/token", auth).toString(),
        environment,
        audience: apiBaseUrl,
    };
}
function magaluOAuthConfigFingerprint(config) {
    return (0, node_crypto_1.createHash)("sha256").update(JSON.stringify([
        config.clientId, config.redirectUri, config.environment, config.tokenUrl,
    ])).digest("hex");
}
//# sourceMappingURL=magaluOAuthConfig.js.map
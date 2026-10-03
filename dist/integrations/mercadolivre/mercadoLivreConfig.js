"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMercadoLivreConfig = getMercadoLivreConfig;
const zod_1 = require("zod");
const mercadoLivreOAuthError_1 = require("./mercadoLivreOAuthError");
const mercadoLivreConfigSchema = zod_1.z.object({
    MERCADO_LIVRE_CLIENT_ID: zod_1.z.string().trim().min(1),
    MERCADO_LIVRE_CLIENT_SECRET: zod_1.z.string().trim().min(1),
    MERCADO_LIVRE_REDIRECT_URI: zod_1.z.url(),
});
function getMercadoLivreConfig() {
    const result = mercadoLivreConfigSchema.safeParse(process.env);
    if (!result.success) {
        throw new mercadoLivreOAuthError_1.MercadoLivreOAuthError("Configuração OAuth do Mercado Livre ausente ou inválida", 500, "oauth_configuration");
    }
    return {
        clientId: result.data.MERCADO_LIVRE_CLIENT_ID,
        clientSecret: result.data.MERCADO_LIVRE_CLIENT_SECRET,
        redirectUri: result.data.MERCADO_LIVRE_REDIRECT_URI,
    };
}
//# sourceMappingURL=mercadoLivreConfig.js.map
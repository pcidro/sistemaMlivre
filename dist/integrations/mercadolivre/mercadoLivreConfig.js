"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMercadoLivreConfig = getMercadoLivreConfig;
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const mercadoLivreConfigSchema = zod_1.z.object({
    MERCADO_LIVRE_CLIENT_ID: zod_1.z.string().trim().min(1),
    MERCADO_LIVRE_CLIENT_SECRET: zod_1.z.string().trim().min(1),
    MERCADO_LIVRE_REDIRECT_URI: zod_1.z.url(),
});
function getMercadoLivreConfig() {
    const result = mercadoLivreConfigSchema.safeParse(process.env);
    if (!result.success) {
        throw new AppError_1.AppError("Configuração OAuth do Mercado Livre ausente ou inválida", 500);
    }
    return {
        clientId: result.data.MERCADO_LIVRE_CLIENT_ID,
        clientSecret: result.data.MERCADO_LIVRE_CLIENT_SECRET,
        redirectUri: result.data.MERCADO_LIVRE_REDIRECT_URI,
    };
}
//# sourceMappingURL=mercadoLivreConfig.js.map
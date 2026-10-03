"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.magaluTokenStorage = void 0;
exports.createMagaluTokenStorage = createMagaluTokenStorage;
const prisma_1 = require("../../lib/prisma");
const magaluHttpError_1 = require("./magaluHttpError");
const credentialsSelect = {
    id: true, platform: true, externalAccountId: true, userId: true, isActive: true,
    accessTokenEncrypted: true, refreshTokenEncrypted: true, tokenExpiresAt: true,
};
function createMagaluTokenStorage(database = prisma_1.prisma) {
    return {
        findAccount: (id) => database.marketplaceAccount.findUnique({ where: { id }, select: credentialsSelect }),
        async withLockedAccount(id, work) {
            return database.$transaction(async (tx) => {
                // Serializa refresh por conta também entre processos. Parametrização evita
                // interpolação de IDs em SQL; nenhuma transação do Mercado Livre é alterada.
                await tx.$queryRaw `SELECT id FROM marketplace_accounts WHERE id = ${id} FOR UPDATE`;
                const account = await tx.marketplaceAccount.findUnique({ where: { id }, select: credentialsSelect });
                return work(account, async (tokens) => {
                    if (!account)
                        throw new magaluHttpError_1.MagaluHttpError("Conta Magalu não encontrada ou inativa.", 404, "invalid_account");
                    const updated = await tx.marketplaceAccount.updateMany({
                        where: { id, platform: "MAGALU", isActive: true, userId: account.userId,
                            accessTokenEncrypted: account.accessTokenEncrypted, refreshTokenEncrypted: account.refreshTokenEncrypted },
                        // Uma única atualização atômica: nunca limpar o refresh antes de salvar.
                        data: tokens,
                    });
                    if (updated.count !== 1)
                        throw new magaluHttpError_1.MagaluHttpError("A conta Magalu foi alterada durante a renovação.", 409, "account_changed");
                });
            }, { maxWait: 10_000, timeout: 25_000 });
        },
    };
}
exports.magaluTokenStorage = createMagaluTokenStorage();
//# sourceMappingURL=magaluTokenStorage.js.map
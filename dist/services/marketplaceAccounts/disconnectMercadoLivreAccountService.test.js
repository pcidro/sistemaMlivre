"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const AppError_1 = require("../../errors/AppError");
const disconnectMercadoLivreAccountService_1 = require("./disconnectMercadoLivreAccountService");
(0, node_test_1.test)("revoga a autorização antes de limpar os tokens da conta", async () => {
    const operations = [];
    const service = new disconnectMercadoLivreAccountService_1.DisconnectMercadoLivreAccountService({
        findOwnedAccount: async (accountId, userId) => {
            strict_1.default.equal(accountId, "account-id");
            strict_1.default.equal(userId, "user-id");
            return { id: accountId, externalAccountId: "123456789" };
        },
        getValidAccessToken: async (accountId) => {
            operations.push(`token:${accountId}`);
            return "access-token";
        },
        revokeAuthorization: async (externalAccountId, accessToken) => {
            operations.push(`revoke:${externalAccountId}:${accessToken}`);
        },
        clearCredentials: async (accountId) => {
            operations.push(`clear:${accountId}`);
        },
    });
    await service.execute("account-id", "user-id");
    strict_1.default.deepEqual(operations, [
        "token:account-id",
        "revoke:123456789:access-token",
        "clear:account-id",
    ]);
});
(0, node_test_1.test)("não revoga uma conta que não pertence ao usuário", async () => {
    let authorizationWasRevoked = false;
    const service = new disconnectMercadoLivreAccountService_1.DisconnectMercadoLivreAccountService({
        findOwnedAccount: async () => null,
        getValidAccessToken: async () => "access-token",
        revokeAuthorization: async () => {
            authorizationWasRevoked = true;
        },
        clearCredentials: async () => undefined,
    });
    await strict_1.default.rejects(() => service.execute("another-account", "user-id"), (error) => error instanceof AppError_1.AppError && error.statusCode === 404);
    strict_1.default.equal(authorizationWasRevoked, false);
});
(0, node_test_1.test)("não limpa os tokens locais quando a revogação externa falha", async () => {
    let credentialsWereCleared = false;
    const service = new disconnectMercadoLivreAccountService_1.DisconnectMercadoLivreAccountService({
        findOwnedAccount: async () => ({
            id: "account-id",
            externalAccountId: "123456789",
        }),
        getValidAccessToken: async () => "access-token",
        revokeAuthorization: async () => {
            throw new AppError_1.AppError("Mercado Livre indisponível", 503);
        },
        clearCredentials: async () => {
            credentialsWereCleared = true;
        },
    });
    await strict_1.default.rejects(() => service.execute("account-id", "user-id"), AppError_1.AppError);
    strict_1.default.equal(credentialsWereCleared, false);
});
//# sourceMappingURL=disconnectMercadoLivreAccountService.test.js.map
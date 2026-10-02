"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_crypto_1 = require("node:crypto");
const node_test_1 = require("node:test");
const tokenEncryption_1 = require("../../utils/tokenEncryption");
const mercadoLivreOAuthClient_1 = require("./mercadoLivreOAuthClient");
const mercadoLivreTokenService_1 = require("./mercadoLivreTokenService");
for (const failFirst of [false, true]) {
    (0, node_test_1.test)(`renovação concorrente compartilha uma chamada e libera após ${failFirst ? "erro" : "sucesso"}`, async () => {
        const previousKey = process.env.TOKEN_ENCRYPTION_KEY;
        process.env.TOKEN_ENCRYPTION_KEY = (0, node_crypto_1.randomBytes)(32).toString("base64");
        let calls = 0;
        let writes = 0;
        class FakeOAuthClient extends mercadoLivreOAuthClient_1.MercadoLivreOAuthClient {
            async refreshAccessToken(_refreshToken) {
                calls++;
                await new Promise((resolve) => setTimeout(resolve, 2));
                if (failFirst && calls === 1)
                    throw new Error("falha fictícia de renovação");
                return { accessToken: "novo-access-ficticio", refreshToken: "novo-refresh-ficticio", userId: "123", expiresInSeconds: 3600 };
            }
        }
        try {
            const service = new mercadoLivreTokenService_1.MercadoLivreTokenService(new FakeOAuthClient(), {
                findAccount: async () => ({
                    id: "account-ficticio", externalAccountId: "123", platform: "MERCADO_LIVRE", isActive: true,
                    tokenExpiresAt: new Date(0), accessTokenEncrypted: (0, tokenEncryption_1.encryptToken)("access-ficticio"),
                    refreshTokenEncrypted: (0, tokenEncryption_1.encryptToken)("refresh-ficticio"),
                }),
                saveCredentials: async () => { writes++; },
            });
            const results = await Promise.allSettled(Array.from({ length: 3 }, () => service.getValidAccessToken("account-ficticio")));
            strict_1.default.equal(calls, 1);
            strict_1.default.equal(writes, failFirst ? 0 : 1);
            strict_1.default.ok(results.every((result) => result.status === (failFirst ? "rejected" : "fulfilled")));
            await service.refreshAccessToken("account-ficticio");
            strict_1.default.equal(calls, 2);
            strict_1.default.equal(writes, failFirst ? 1 : 2);
        }
        finally {
            if (previousKey === undefined)
                delete process.env.TOKEN_ENCRYPTION_KEY;
            else
                process.env.TOKEN_ENCRYPTION_KEY = previousKey;
        }
    });
}
//# sourceMappingURL=mercadoLivreTokenService.test.js.map
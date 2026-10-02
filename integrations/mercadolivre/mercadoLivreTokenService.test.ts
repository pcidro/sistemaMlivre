import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

import { encryptToken } from "../../utils/tokenEncryption";
import { MercadoLivreOAuthClient } from "./mercadoLivreOAuthClient";
import { MercadoLivreTokenService } from "./mercadoLivreTokenService";

for (const failFirst of [false, true]) {
  test(`renovação concorrente compartilha uma chamada e libera após ${failFirst ? "erro" : "sucesso"}`, async () => {
    const previousKey = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    let calls = 0;
    let writes = 0;
    class FakeOAuthClient extends MercadoLivreOAuthClient {
      override async refreshAccessToken(_refreshToken: string) {
        calls++;
        await new Promise((resolve) => setTimeout(resolve, 2));
        if (failFirst && calls === 1) throw new Error("falha fictícia de renovação");
        return { accessToken: "novo-access-ficticio", refreshToken: "novo-refresh-ficticio", userId: "123", expiresInSeconds: 3600 };
      }
    }
    try {
      const service = new MercadoLivreTokenService(new FakeOAuthClient(), {
        findAccount: async () => ({
          id: "account-ficticio", externalAccountId: "123", platform: "MERCADO_LIVRE", isActive: true,
          tokenExpiresAt: new Date(0), accessTokenEncrypted: encryptToken("access-ficticio"),
          refreshTokenEncrypted: encryptToken("refresh-ficticio"),
        }),
        saveCredentials: async () => { writes++; },
      });
      const results = await Promise.allSettled(Array.from({ length: 3 }, () => service.getValidAccessToken("account-ficticio")));
      assert.equal(calls, 1);
      assert.equal(writes, failFirst ? 0 : 1);
      assert.ok(results.every((result) => result.status === (failFirst ? "rejected" : "fulfilled")));
      await service.refreshAccessToken("account-ficticio");
      assert.equal(calls, 2);
      assert.equal(writes, failFirst ? 1 : 2);
    } finally {
      if (previousKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
      else process.env.TOKEN_ENCRYPTION_KEY = previousKey;
    }
  });
}

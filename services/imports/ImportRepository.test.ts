import assert from "node:assert/strict";
import { test } from "node:test";

import type { prisma } from "../../lib/prisma";
import type { MarketplacePlatform } from "../../integrations/types";
import { ImportRepository } from "./ImportRepository";
import type { ImportSummary } from "./ImportRepository";

const summary: ImportSummary = {
  id: "import-test", marketplaceAccountId: "account-test", status: "PROCESSING",
  startedAt: new Date(), finishedAt: null, ordersFound: 0, ordersProcessed: 0,
  customersWithPhone: 0, customersWithoutPhone: 0, errorsCount: 0,
};

function database(accountExists = true) {
  const calls: { method: string; input: unknown }[] = [];
  const mock = {
    marketplaceAccount: { async findFirst(input: unknown) {
      calls.push({ method: "findFirst", input }); return accountExists ? { id: "account-test" } : null;
    } },
    import: {
      async create(input: unknown) { calls.push({ method: "create", input }); return summary; },
      async update(input: unknown) { calls.push({ method: "update", input }); return summary; },
    },
  };
  return { calls, mock: mock as unknown as Pick<typeof prisma, "marketplaceAccount" | "import"> };
}

for (const platform of ["MAGALU", "MERCADO_LIVRE"] as const satisfies readonly MarketplacePlatform[]) {
  test(`repository ${platform}: verifica dono, plataforma e atividade antes de selecionar somente id`, async () => {
    const db = database();
    const repository = new ImportRepository(platform === "MAGALU" ? platform : undefined, db.mock);
    assert.equal(await repository.ownsActiveAccount("account-test", "session-user"), true);
    assert.deepEqual(db.calls, [{ method: "findFirst", input: {
      where: { id: "account-test", userId: "session-user", platform, isActive: true }, select: { id: true },
    } }]);
  });

  test(`repository ${platform}: cria PROCESSING com plataforma correta e resumo sem credenciais`, async () => {
    const db = database();
    await new ImportRepository(platform === "MAGALU" ? platform : undefined, db.mock).create("account-test");
    assert.deepEqual(db.calls[0], { method: "create", input: {
      data: { marketplaceAccountId: "account-test", platform, status: "PROCESSING" },
      select: Object.fromEntries(Object.keys(summary).map(key => [key, true])),
    } });
  });
}

test("repository: conta ausente, inativa ou de outro usuário/plataforma não autoriza importação", async () => {
  const db = database(false);
  assert.equal(await new ImportRepository("MAGALU", db.mock).ownsActiveAccount("account-test", "session-user"), false);
});

test("repository: progresso/finalização atualizam os cinco contadores e selecionam somente o resumo", async () => {
  const db = database();
  const update = { ordersFound: 3, ordersProcessed: 2, customersWithPhone: 1, customersWithoutPhone: 1,
    errorsCount: 1, status: "PARTIAL_SUCCESS" as const, finishedAt: new Date() };
  await new ImportRepository("MAGALU", db.mock).update("import-test", update);
  assert.deepEqual(db.calls[0], { method: "update", input: {
    where: { id: "import-test" }, data: update, select: Object.fromEntries(Object.keys(summary).map(key => [key, true])),
  } });
});

test("finalização ML exige PROCESSING: execução interrompida não pode sobrescrever ERROR", async () => {
  const db = database();
  await new ImportRepository("MERCADO_LIVRE", db.mock).update("import-test", {
    ordersFound: 0, ordersProcessed: 0, customersWithPhone: 0, customersWithoutPhone: 0, errorsCount: 0,
    status: "SUCCESS", finishedAt: new Date(),
  });
  assert.deepEqual((db.calls[0]?.input as { where: unknown }).where, { id: "import-test", status: "PROCESSING" });
});

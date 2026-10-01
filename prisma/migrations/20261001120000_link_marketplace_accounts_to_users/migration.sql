ALTER TABLE "marketplace_accounts"
  ADD COLUMN "user_id" TEXT;

-- The initial version of the system did not store who connected an account.
-- A legacy account can be assigned safely when the installation has one user.
UPDATE "marketplace_accounts"
SET "user_id" = (SELECT "id" FROM "users" LIMIT 1)
WHERE (SELECT COUNT(*) FROM "users") = 1;

CREATE INDEX "marketplace_accounts_user_id_idx"
  ON "marketplace_accounts"("user_id");

ALTER TABLE "marketplace_accounts"
  ADD CONSTRAINT "marketplace_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

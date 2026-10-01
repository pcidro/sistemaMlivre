-- Existing marketplace accounts must be reviewed and their tokens encrypted
-- before this migration is applied. At this stage, OAuth is not implemented,
-- so this table is expected to be empty.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "marketplace_accounts" LIMIT 1) THEN
    RAISE EXCEPTION 'marketplace_accounts contains records; encrypt existing tokens before renaming token columns';
  END IF;
END $$;

ALTER TABLE "marketplace_accounts"
  RENAME COLUMN "access_token" TO "access_token_encrypted";

ALTER TABLE "marketplace_accounts"
  RENAME COLUMN "refresh_token" TO "refresh_token_encrypted";

ALTER TABLE "marketplace_accounts" ADD COLUMN "last_sync_at" TIMESTAMP(3);
ALTER TABLE "imports"
  ADD COLUMN "date_from" TIMESTAMP(3),
  ADD COLUMN "date_to" TIMESTAMP(3),
  ADD COLUMN "automatic" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Instâncias antigas só bloqueavam concorrência em memória. Preserva o mais recente.
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY marketplace_account_id ORDER BY started_at DESC, id
  ) AS position FROM imports
  WHERE platform = 'MERCADO_LIVRE' AND status = 'PROCESSING'
)
UPDATE imports SET status = 'ERROR', finished_at = CURRENT_TIMESTAMP,
  errors_count = errors_count + 1
WHERE id IN (SELECT id FROM duplicates WHERE position > 1);

-- Inclui importações manuais; Magalu conserva o comportamento existente.
CREATE UNIQUE INDEX "imports_one_processing_mercadolivre_account"
  ON "imports" ("marketplace_account_id")
  WHERE "platform" = 'MERCADO_LIVRE' AND "status" = 'PROCESSING';

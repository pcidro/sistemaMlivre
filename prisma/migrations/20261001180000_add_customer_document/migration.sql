CREATE TYPE "DocumentType" AS ENUM ('CPF', 'CNPJ');

ALTER TABLE "customers"
  ADD COLUMN "document" TEXT,
  ADD COLUMN "document_type" "DocumentType";

CREATE INDEX "customers_document_idx" ON "customers"("document");

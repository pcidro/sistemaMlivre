-- As integrações podem não disponibilizar nome do destinatário ou preço unitário.
-- Ausência de informação não deve ser substituída por um nome fictício ou preço zero.
ALTER TABLE "customers" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "order_items" ALTER COLUMN "unit_price" DROP NOT NULL;

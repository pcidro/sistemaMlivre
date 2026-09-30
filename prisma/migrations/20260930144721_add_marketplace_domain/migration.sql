-- CreateEnum
CREATE TYPE "MarketplacePlatform" AS ENUM ('MERCADO_LIVRE', 'MAGALU');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PROCESSING', 'SUCCESS', 'ERROR');

-- CreateTable
CREATE TABLE "marketplace_accounts" (
    "id" TEXT NOT NULL,
    "platform" "MarketplacePlatform" NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "external_account_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "normalized_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "external_order_id" TEXT NOT NULL,
    "platform" "MarketplacePlatform" NOT NULL,
    "order_date" TIMESTAMP(3),
    "status" TEXT,
    "customer_id" TEXT NOT NULL,
    "marketplace_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoice_key" TEXT NOT NULL,
    "invoice_number" TEXT,
    "customer_name" TEXT,
    "phone" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "order_id" TEXT NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "external_product_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "order_id" TEXT NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imports" (
    "id" TEXT NOT NULL,
    "platform" "MarketplacePlatform" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "orders_found" INTEGER NOT NULL DEFAULT 0,
    "orders_processed" INTEGER NOT NULL DEFAULT 0,
    "customers_with_phone" INTEGER NOT NULL DEFAULT 0,
    "customers_without_phone" INTEGER NOT NULL DEFAULT 0,
    "errors_count" INTEGER NOT NULL DEFAULT 0,
    "marketplace_account_id" TEXT NOT NULL,

    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_accounts_platform_is_active_idx" ON "marketplace_accounts"("platform", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_accounts_platform_external_account_id_key" ON "marketplace_accounts"("platform", "external_account_id");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_normalized_phone_idx" ON "customers"("normalized_phone");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_platform_order_date_idx" ON "orders"("platform", "order_date");

-- CreateIndex
CREATE UNIQUE INDEX "orders_marketplace_account_id_external_order_id_key" ON "orders"("marketplace_account_id", "external_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_key_key" ON "invoices"("invoice_key");

-- CreateIndex
CREATE INDEX "invoices_order_id_idx" ON "invoices"("order_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "imports_marketplace_account_id_started_at_idx" ON "imports"("marketplace_account_id", "started_at");

-- CreateIndex
CREATE INDEX "imports_status_idx" ON "imports"("status");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_marketplace_account_id_fkey" FOREIGN KEY ("marketplace_account_id") REFERENCES "marketplace_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_marketplace_account_id_fkey" FOREIGN KEY ("marketplace_account_id") REFERENCES "marketplace_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

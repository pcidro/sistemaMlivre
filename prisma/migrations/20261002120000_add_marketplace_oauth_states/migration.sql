CREATE TABLE "marketplace_oauth_states" (
    "state_hash" TEXT NOT NULL,
    "platform" "MarketplacePlatform" NOT NULL,
    "user_id" TEXT NOT NULL,
    "config_fingerprint" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "marketplace_oauth_states_pkey" PRIMARY KEY ("state_hash")
);

CREATE INDEX "marketplace_oauth_states_expires_at_idx" ON "marketplace_oauth_states"("expires_at");
ALTER TABLE "marketplace_oauth_states" ADD CONSTRAINT "marketplace_oauth_states_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

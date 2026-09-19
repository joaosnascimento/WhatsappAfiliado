ALTER TABLE marketplace_accounts ADD COLUMN IF NOT EXISTS provider_account_id TEXT;
CREATE INDEX IF NOT EXISTS idx_marketplace_accounts_provider_account ON marketplace_accounts(marketplace, provider_account_id);

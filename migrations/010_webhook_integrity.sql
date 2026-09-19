ALTER TABLE marketplace_accounts ADD COLUMN IF NOT EXISTS provider_application_id TEXT;
CREATE INDEX IF NOT EXISTS idx_marketplace_accounts_provider_app ON marketplace_accounts(marketplace, provider_application_id);
CREATE TABLE IF NOT EXISTS processed_webhooks (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(workspace_id,event_id)
);

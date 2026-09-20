CREATE TABLE IF NOT EXISTS audit_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_title TEXT NOT NULL,
  original_price NUMERIC,
  final_price NUMERIC NOT NULL,
  affiliate_account_id TEXT NOT NULL,
  original_url TEXT NOT NULL,
  affiliate_url TEXT NOT NULL,
  campaign_id TEXT,
  destination_id TEXT NOT NULL,
  destination_name TEXT NOT NULL,
  ai_message TEXT NOT NULL,
  publication_id TEXT NOT NULL,
  publication_status TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  tracking_subids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, publication_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_records_workspace_created
  ON audit_records(workspace_id, created_at DESC);

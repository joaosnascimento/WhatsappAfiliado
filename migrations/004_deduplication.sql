CREATE TABLE IF NOT EXISTS publication_deduplication (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  dedup_key TEXT NOT NULL,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('MERCADOLIVRE','SHOPEE')),
  destination_id TEXT NOT NULL,
  publication_id TEXT NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, dedup_key)
);
CREATE INDEX IF NOT EXISTS idx_publication_dedup_published_at ON publication_deduplication(published_at);

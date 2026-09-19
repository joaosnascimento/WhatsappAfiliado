CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('CLICK','CONVERSION','WEBHOOK')),
  marketplace TEXT CHECK (marketplace IN ('MERCADOLIVRE','SHOPEE')),
  publication_id TEXT REFERENCES publications(id) ON DELETE SET NULL,
  offer_id TEXT,
  destination_id TEXT,
  external_id TEXT,
  sub_id TEXT,
  value_brl NUMERIC(14,2),
  commission_brl NUMERIC(14,2),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_workspace_time ON analytics_events(workspace_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_click_subid ON analytics_events(workspace_id, sub_id);
CREATE INDEX IF NOT EXISTS idx_analytics_marketplace ON analytics_events(workspace_id, marketplace, event_type);

CREATE TABLE IF NOT EXISTS tracked_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  affiliate_link_id TEXT,
  affiliate_url TEXT NOT NULL,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('MERCADOLIVRE','SHOPEE')),
  offer_id TEXT,
  destination_id TEXT,
  sub_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, affiliate_url, destination_id, sub_id)
);
CREATE INDEX IF NOT EXISTS idx_tracked_links_workspace ON tracked_links(workspace_id);

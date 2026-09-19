CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('MERCADOLIVRE','SHOPEE')),
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT CHECK (discount_type IN ('PERCENTAGE','FIXED','UNKNOWN')),
  discount_value NUMERIC(14,2),
  minimum_order_value NUMERIC(14,2),
  max_discount_value NUMERIC(14,2),
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  source_url TEXT,
  product_external_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, marketplace, code, COALESCE(product_external_id,''))
);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(workspace_id,is_active,expires_at);

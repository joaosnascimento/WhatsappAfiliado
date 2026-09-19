ALTER TABLE publications ADD COLUMN IF NOT EXISTS affiliate_link_id TEXT;
ALTER TABLE publications ADD COLUMN IF NOT EXISTS affiliate_url TEXT;
ALTER TABLE publications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE publications ADD COLUMN IF NOT EXISTS tracking_subids JSONB;

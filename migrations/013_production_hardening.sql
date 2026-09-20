-- Production hardening: publication lifecycle, retries, cancellation and workspace timezone.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Maceio';
ALTER TABLE publications ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE publications ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3;
ALTER TABLE publications ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE publications ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE publications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE publications ADD COLUMN IF NOT EXISTS last_error_code TEXT;
CREATE INDEX IF NOT EXISTS idx_publications_retry ON publications(status,next_retry_at);
CREATE INDEX IF NOT EXISTS idx_publications_offer_status ON publications(workspace_id,offer_id,status);

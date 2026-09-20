-- Destination lifecycle hardening: user deletion is soft-delete so publication history remains auditable.
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_destinations_workspace_active ON destinations(workspace_id,is_active,deleted_at);

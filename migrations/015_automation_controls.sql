ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS automation_enabled BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_workspaces_automation_enabled ON workspaces(automation_enabled);

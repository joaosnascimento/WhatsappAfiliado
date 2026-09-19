CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'LOW' CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  ip_address INET,
  user_agent TEXT,
  path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_events_workspace_created ON security_events(workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type_created ON security_events(event_type,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_created ON security_events(ip_address,created_at DESC);

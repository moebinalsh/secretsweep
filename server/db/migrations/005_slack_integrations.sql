-- Slack integrations for alert notifications

BEGIN;

CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'slack' CHECK (type IN ('slack')),
  name VARCHAR(255) NOT NULL,
  encrypted_webhook TEXT NOT NULL,
  iv VARCHAR(32) NOT NULL,
  auth_tag VARCHAR(32) NOT NULL,
  config JSONB NOT NULL DEFAULT '{
    "onScanComplete": true,
    "onScanFailed": true,
    "onFinding": true,
    "severities": ["critical", "high"]
  }'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integrations_org_id ON integrations(org_id);
CREATE INDEX idx_integrations_org_active ON integrations(org_id, is_active) WHERE is_active = true;

-- RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_integrations ON integrations
  USING (
    CASE WHEN coalesce(current_setting('app.current_org_id', true), '') = '' THEN false
    ELSE org_id = current_setting('app.current_org_id', true)::UUID END
  );

CREATE POLICY system_access_integrations ON integrations
  USING (current_setting('app.system_context', true) = 'true');

COMMIT;

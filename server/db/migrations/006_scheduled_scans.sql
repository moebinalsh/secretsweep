-- Scheduled scans for recurring automated scanning

BEGIN;

CREATE TABLE scan_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  github_org VARCHAR(255) NOT NULL,
  scan_mode VARCHAR(20) NOT NULL DEFAULT 'full' CHECK (scan_mode IN ('full', 'selective')),
  repo_filter JSONB,
  cron_expression VARCHAR(100) NOT NULL,
  cron_label VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_schedules_org_id ON scan_schedules(org_id);
CREATE INDEX idx_scan_schedules_next_run ON scan_schedules(next_run_at) WHERE is_active = true;

-- RLS
ALTER TABLE scan_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_schedules FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_scan_schedules ON scan_schedules
  USING (
    CASE WHEN coalesce(current_setting('app.current_org_id', true), '') = '' THEN false
    ELSE org_id = current_setting('app.current_org_id', true)::UUID END
  );

CREATE POLICY system_access_scan_schedules ON scan_schedules
  USING (current_setting('app.system_context', true) = 'true');

COMMIT;

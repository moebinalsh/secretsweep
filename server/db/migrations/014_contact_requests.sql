-- Contact form submissions from landing page + super admin Slack webhook

BEGIN;

CREATE TABLE contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_requests_created ON contact_requests(created_at DESC);
CREATE INDEX idx_contact_requests_status ON contact_requests(status);

-- No RLS needed — only super admin accesses this table via withSuperAdminContext
-- But add system access policy so the public API can insert
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY system_access_contact_requests ON contact_requests
  USING (current_setting('app.system_context', true) = 'true');
CREATE POLICY super_admin_contact_requests ON contact_requests
  USING (current_setting('app.is_super_admin', true) = 'true');

-- Super admin settings table (for Slack webhook etc.)
CREATE TABLE system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS — only super admin accesses via withSuperAdminContext
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY super_admin_system_settings ON system_settings
  USING (current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY system_access_system_settings ON system_settings
  USING (current_setting('app.system_context', true) = 'true');

COMMIT;

-- Super admin support + invite-only registration

BEGIN;

-- Add super admin flag to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Add active flag to organizations (for disabling customer orgs)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- RLS bypass policy for super admins on all tenant tables
CREATE POLICY super_admin_users ON users
  USING (current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY super_admin_organizations ON organizations
  USING (current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY super_admin_scans ON scans
  USING (current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY super_admin_findings ON findings
  USING (current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY super_admin_audit_logs ON audit_logs
  USING (current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY super_admin_integrations ON integrations
  USING (current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY super_admin_github_connections ON github_connections
  USING (current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY super_admin_gitlab_connections ON gitlab_connections
  USING (current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY super_admin_invitations ON invitations
  USING (current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY super_admin_refresh_tokens ON refresh_tokens
  USING (current_setting('app.is_super_admin', true) = 'true');
CREATE POLICY super_admin_scan_schedules ON scan_schedules
  USING (current_setting('app.is_super_admin', true) = 'true');

COMMIT;

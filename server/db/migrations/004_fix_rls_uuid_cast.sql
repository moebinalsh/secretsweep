-- Fix RLS policies to safely handle empty/null app.current_org_id
-- The UUID cast fails when the setting is empty string, which breaks
-- system context operations that don't set an org_id.

BEGIN;

-- Drop and recreate all tenant isolation policies with safe UUID handling
DROP POLICY IF EXISTS tenant_isolation_users ON users;
CREATE POLICY tenant_isolation_users ON users
  USING (
    CASE WHEN coalesce(current_setting('app.current_org_id', true), '') = '' THEN false
    ELSE org_id = current_setting('app.current_org_id', true)::UUID END
  );

DROP POLICY IF EXISTS tenant_isolation_invitations ON invitations;
CREATE POLICY tenant_isolation_invitations ON invitations
  USING (
    CASE WHEN coalesce(current_setting('app.current_org_id', true), '') = '' THEN false
    ELSE org_id = current_setting('app.current_org_id', true)::UUID END
  );

DROP POLICY IF EXISTS tenant_isolation_github_connections ON github_connections;
CREATE POLICY tenant_isolation_github_connections ON github_connections
  USING (
    CASE WHEN coalesce(current_setting('app.current_org_id', true), '') = '' THEN false
    ELSE org_id = current_setting('app.current_org_id', true)::UUID END
  );

DROP POLICY IF EXISTS tenant_isolation_scans ON scans;
CREATE POLICY tenant_isolation_scans ON scans
  USING (
    CASE WHEN coalesce(current_setting('app.current_org_id', true), '') = '' THEN false
    ELSE org_id = current_setting('app.current_org_id', true)::UUID END
  );

DROP POLICY IF EXISTS tenant_isolation_findings ON findings;
CREATE POLICY tenant_isolation_findings ON findings
  USING (
    CASE WHEN coalesce(current_setting('app.current_org_id', true), '') = '' THEN false
    ELSE org_id = current_setting('app.current_org_id', true)::UUID END
  );

DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (
    CASE WHEN coalesce(current_setting('app.current_org_id', true), '') = '' THEN false
    ELSE org_id = current_setting('app.current_org_id', true)::UUID END
  );

DROP POLICY IF EXISTS tenant_isolation_refresh_tokens ON refresh_tokens;
CREATE POLICY tenant_isolation_refresh_tokens ON refresh_tokens
  USING (
    CASE WHEN coalesce(current_setting('app.current_org_id', true), '') = '' THEN false
    ELSE org_id = current_setting('app.current_org_id', true)::UUID END
  );

COMMIT;

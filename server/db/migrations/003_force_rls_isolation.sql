-- FORCE Row-Level Security on all tenant tables.
-- With FORCE, even the table owner (secretsweep_app) is subject to RLS.
-- System operations (auth, recovery) must set app.system_context = 'true'
-- to bypass tenant filtering.

BEGIN;

-- ============================================================
-- FORCE RLS: table owner is now subject to policies too
-- ============================================================
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE github_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE scans FORCE ROW LEVEL SECURITY;
ALTER TABLE findings FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;

-- ============================================================
-- System bypass policies: allow access when app.system_context = 'true'
-- Only server-internal code can set this variable.
-- ============================================================

-- users: system needs to lookup by email for login, create for register
CREATE POLICY system_access_users ON users
  USING (current_setting('app.system_context', true) = 'true');

-- invitations: system needs to lookup by token for accept-invite
CREATE POLICY system_access_invitations ON invitations
  USING (current_setting('app.system_context', true) = 'true');

-- refresh_tokens: system needs to lookup by hash, create, revoke
CREATE POLICY system_access_refresh_tokens ON refresh_tokens
  USING (current_setting('app.system_context', true) = 'true');

-- scans: system needs to mark orphaned scans on startup
CREATE POLICY system_access_scans ON scans
  USING (current_setting('app.system_context', true) = 'true');

-- audit_logs: system inserts audit entries within tenant context already,
-- but add bypass for edge cases
CREATE POLICY system_access_audit_logs ON audit_logs
  USING (current_setting('app.system_context', true) = 'true');

COMMIT;

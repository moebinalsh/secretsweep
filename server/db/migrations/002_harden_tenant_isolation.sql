-- Harden multi-tenant isolation
-- Adds RLS to refresh_tokens, org_id column, and org-level RLS

BEGIN;

-- ============================================================
-- Add org_id to refresh_tokens for tenant scoping
-- ============================================================
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill org_id from the user's org
UPDATE refresh_tokens rt
SET org_id = u.org_id
FROM users u
WHERE rt.user_id = u.id AND rt.org_id IS NULL;

-- For any remaining orphans without a valid user, delete them
DELETE FROM refresh_tokens WHERE org_id IS NULL;

-- Make org_id NOT NULL going forward
ALTER TABLE refresh_tokens ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_org_id ON refresh_tokens(org_id);

-- Enable RLS on refresh_tokens
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_refresh_tokens ON refresh_tokens
  USING (org_id = current_setting('app.current_org_id', true)::UUID);

-- ============================================================
-- Prevent UUID parameter tampering by validating org_id
-- matches the JWT-derived org in all tenant-scoped tables
-- (RLS policies already enforce this at the DB level)
-- ============================================================

-- Add NOT NULL constraints where missing (defense in depth)
ALTER TABLE scans ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE findings ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE github_connections ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN org_id SET NOT NULL;

COMMIT;

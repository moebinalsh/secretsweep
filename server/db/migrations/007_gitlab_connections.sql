-- GitLab integration support

BEGIN;

CREATE TABLE gitlab_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gitlab_username VARCHAR(255) NOT NULL,
  gitlab_url VARCHAR(500) NOT NULL DEFAULT 'https://gitlab.com',
  encrypted_token TEXT NOT NULL,
  iv VARCHAR(32) NOT NULL,
  auth_tag VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_gitlab_connections_org_id ON gitlab_connections(org_id);

-- RLS
ALTER TABLE gitlab_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE gitlab_connections FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_gitlab_connections ON gitlab_connections
  USING (
    CASE WHEN coalesce(current_setting('app.current_org_id', true), '') = '' THEN false
    ELSE org_id = current_setting('app.current_org_id', true)::UUID END
  );

CREATE POLICY system_access_gitlab_connections ON gitlab_connections
  USING (current_setting('app.system_context', true) = 'true');

COMMIT;

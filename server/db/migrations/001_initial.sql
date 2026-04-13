-- SecretSweep: Initial schema with multi-tenant isolation
-- Run with: node server/db/migrate.js

BEGIN;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ORGANIZATIONS (tenant container)
-- ============================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- INVITATIONS
-- ============================================================
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id),
  token VARCHAR(64) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_org_id ON invitations(org_id);

-- ============================================================
-- GITHUB CONNECTIONS (encrypted PAT storage)
-- ============================================================
CREATE TABLE github_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_username VARCHAR(255) NOT NULL,
  encrypted_token TEXT NOT NULL,
  iv VARCHAR(32) NOT NULL,
  auth_tag VARCHAR(32) NOT NULL,
  scopes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);
CREATE INDEX idx_github_connections_org_id ON github_connections(org_id);
CREATE INDEX idx_github_connections_user_id ON github_connections(user_id);

-- ============================================================
-- SCANS
-- ============================================================
CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  started_by UUID NOT NULL REFERENCES users(id),
  github_org VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  scan_mode VARCHAR(20) NOT NULL DEFAULT 'full' CHECK (scan_mode IN ('full', 'selective')),
  repo_filter JSONB,
  total_repos INTEGER,
  repos_scanned INTEGER,
  total_findings INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scans_org_id ON scans(org_id);
CREATE INDEX idx_scans_org_started ON scans(org_id, started_at DESC);
CREATE INDEX idx_scans_started_by ON scans(started_by);

-- ============================================================
-- FINDINGS
-- ============================================================
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  repo VARCHAR(255) NOT NULL,
  repo_url TEXT,
  file TEXT NOT NULL,
  file_url TEXT,
  line INTEGER,
  matching_lines JSONB,
  secret_type VARCHAR(100) NOT NULL,
  secret_type_id VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  description TEXT,
  commit_sha VARCHAR(64),
  commit_author VARCHAR(255),
  commit_author_login VARCHAR(255),
  commit_author_avatar TEXT,
  commit_date TIMESTAMPTZ,
  commit_message TEXT,
  commit_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'false_positive')),
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_findings_org_id ON findings(org_id);
CREATE INDEX idx_findings_scan_id ON findings(scan_id);
CREATE INDEX idx_findings_org_severity ON findings(org_id, severity);
CREATE INDEX idx_findings_org_repo ON findings(org_id, repo);
CREATE INDEX idx_findings_org_status ON findings(org_id, status);

-- ============================================================
-- REFRESH TOKENS
-- ============================================================
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100),
  resource_id UUID,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_org_created ON audit_logs(org_id, created_at DESC);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies: filter by org_id matching the session variable
CREATE POLICY tenant_isolation_users ON users
  USING (org_id = current_setting('app.current_org_id', true)::UUID);

CREATE POLICY tenant_isolation_invitations ON invitations
  USING (org_id = current_setting('app.current_org_id', true)::UUID);

CREATE POLICY tenant_isolation_github_connections ON github_connections
  USING (org_id = current_setting('app.current_org_id', true)::UUID);

CREATE POLICY tenant_isolation_scans ON scans
  USING (org_id = current_setting('app.current_org_id', true)::UUID);

CREATE POLICY tenant_isolation_findings ON findings
  USING (org_id = current_setting('app.current_org_id', true)::UUID);

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (org_id = current_setting('app.current_org_id', true)::UUID);

COMMIT;

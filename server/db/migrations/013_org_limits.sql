-- Organization limits/quotas

BEGIN;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS limits JSONB NOT NULL DEFAULT '{
  "maxUsers": -1,
  "maxRepos": -1,
  "maxScansPerMonth": -1
}'::jsonb;

-- -1 means unlimited

COMMIT;

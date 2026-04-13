-- Enforce unique organization names (case-insensitive)

BEGIN;

CREATE UNIQUE INDEX idx_organizations_name_unique ON organizations (LOWER(name));

COMMIT;

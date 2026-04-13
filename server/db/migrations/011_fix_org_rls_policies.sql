-- Fix: organizations table was missing system_access and tenant_isolation policies
-- This caused login/refresh to fail because the JOIN with organizations returned 0 rows

BEGIN;

-- Only create if not exists (may already be applied via manual fix)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'system_access_organizations' AND tablename = 'organizations') THEN
    CREATE POLICY system_access_organizations ON organizations
      USING (current_setting('app.system_context', true) = 'true');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_organizations' AND tablename = 'organizations') THEN
    CREATE POLICY tenant_isolation_organizations ON organizations
      USING (
        CASE WHEN coalesce(current_setting('app.current_org_id', true), '') = '' THEN false
        ELSE id = current_setting('app.current_org_id', true)::UUID END
      );
  END IF;
END $$;

COMMIT;

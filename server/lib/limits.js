import { withTenant } from '../db/pool.js';

/**
 * Check if an org has exceeded a limit.
 * Returns { allowed: true } or { allowed: false, error: '...' }
 */
export async function checkLimit(orgId, limitKey) {
  const result = await withTenant(orgId, async (client) => {
    // Get org limits — need system context since org table has RLS
    // But we're within withTenant so we can query users/scans
    const { rows: [org] } = await client.query(
      'SELECT limits FROM organizations WHERE id = $1', [orgId]
    );

    if (!org) return { allowed: false, error: 'Organization not found' };
    const limits = org.limits || {};

    if (limitKey === 'maxUsers') {
      const max = limits.maxUsers ?? -1;
      if (max === -1) return { allowed: true };
      const { rows: [{ count }] } = await client.query(
        "SELECT COUNT(*) FROM users WHERE is_active = true"
      );
      if (parseInt(count) >= max) return { allowed: false, error: `User limit reached (${max}). Contact your administrator.` };
    }

    if (limitKey === 'maxScansPerMonth') {
      const max = limits.maxScansPerMonth ?? -1;
      if (max === -1) return { allowed: true };
      const { rows: [{ count }] } = await client.query(
        "SELECT COUNT(*) FROM scans WHERE started_at >= date_trunc('month', now())"
      );
      if (parseInt(count) >= max) return { allowed: false, error: `Monthly scan limit reached (${max}). Contact your administrator.` };
    }

    if (limitKey === 'maxRepos') {
      const max = limits.maxRepos ?? -1;
      if (max === -1) return { allowed: true };
      // This is checked against the repos being scanned, not a DB count
      return { allowed: true, max };
    }

    return { allowed: true };
  });

  return result;
}

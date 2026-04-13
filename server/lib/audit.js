import { withTenant } from '../db/pool.js';

/**
 * Insert an audit log entry within tenant context (RLS enforced).
 */
export async function auditLog({ orgId, userId, action, resource, resourceId, metadata, ipAddress }) {
  await withTenant(orgId, async (client) => {
    await client.query(
      `INSERT INTO audit_logs (org_id, user_id, action, resource, resource_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orgId, userId || null, action, resource || null, resourceId || null, metadata ? JSON.stringify(metadata) : null, ipAddress || null]
    );
  });
}

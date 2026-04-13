import { Router } from 'express';
import { z } from 'zod';
import { extractUser, requireAdmin } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { withTenant, withSuperAdminContext } from '../db/pool.js';

const router = Router();

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().optional(),
  userId: z.string().uuid().optional(),
  search: z.string().optional(),
});

router.get('/', extractUser, requireAdmin, validateQuery(listQuery), async (req, res) => {
  const { page, limit, action, userId, search } = req.validatedQuery;
  const offset = (page - 1) * limit;

  try {
    // Super admins see all logs across all orgs
    const queryFn = req.user.isSuperAdmin ? withSuperAdminContext : (cb) => withTenant(req.user.orgId, cb);

    const result = await queryFn(async (client) => {
      const conditions = [];
      const params = [];
      let idx = 1;

      if (action) { conditions.push(`a.action ILIKE $${idx++}`); params.push(`%${action}%`); }
      if (userId) { conditions.push(`a.user_id = $${idx++}`); params.push(userId); }
      if (search) {
        conditions.push(`(a.action ILIKE $${idx} OR u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR a.ip_address::text ILIKE $${idx} OR a.metadata::text ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit, offset);

      const { rows: logs } = await client.query(
        `SELECT a.id, a.org_id, a.action, a.resource, a.resource_id, a.metadata, a.ip_address, a.created_at,
                u.name as user_name, u.email as user_email,
                o.name as org_name
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN organizations o ON o.id = a.org_id
         ${where}
         ORDER BY a.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        params
      );

      const countParams = params.slice(0, -2);
      const { rows: [{ count }] } = await client.query(
        `SELECT COUNT(*) FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN organizations o ON o.id = a.org_id ${where}`,
        countParams
      );

      return { logs, total: parseInt(count) };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ---- Export audit logs as CSV ----

router.get('/export', extractUser, requireAdmin, async (req, res) => {
  try {
    const queryFn = req.user.isSuperAdmin ? withSuperAdminContext : (cb) => withTenant(req.user.orgId, cb);

    const logs = await queryFn(async (client) => {
      const { rows } = await client.query(
        `SELECT a.action, a.resource, a.resource_id, a.metadata, a.ip_address, a.created_at,
                u.name as user_name, u.email as user_email, o.name as org_name
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN organizations o ON o.id = a.org_id
         ORDER BY a.created_at DESC
         LIMIT 10000`
      );
      return rows;
    });

    const header = 'Timestamp,Organization,User,Email,Action,Resource,Resource ID,IP Address,Metadata\n';
    const rows = logs.map(l => {
      const esc = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
      return [
        esc(l.created_at), esc(l.org_name), esc(l.user_name), esc(l.user_email), esc(l.action),
        esc(l.resource), esc(l.resource_id), esc(l.ip_address),
        esc(l.metadata ? JSON.stringify(l.metadata) : ''),
      ].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

export default router;

import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { extractUser, requireSuperAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { withSuperAdminContext, withSystemContext } from '../db/pool.js';
import { auditLog } from '../lib/audit.js';
import logger from '../logger.js';

const router = Router();
const BCRYPT_ROUNDS = 12;

// All routes require super admin
router.use(extractUser, requireSuperAdmin);

// ---- System Stats ----

router.get('/stats', async (req, res) => {
  try {
    const stats = await withSuperAdminContext(async (client) => {
      const { rows: [counts] } = await client.query(`
        SELECT
          (SELECT COUNT(*) FROM organizations WHERE slug != '__system__') as total_orgs,
          (SELECT COUNT(*) FROM users WHERE is_super_admin = false) as total_users,
          (SELECT COUNT(*) FROM scans) as total_scans,
          (SELECT COUNT(*) FROM findings) as total_findings,
          (SELECT COUNT(*) FROM organizations WHERE is_active = true AND slug != '__system__') as active_orgs
      `);
      return counts;
    });
    res.json(stats);
  } catch (err) {
    logger.error('Super admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ---- List All Organizations ----

router.get('/orgs', async (req, res) => {
  try {
    const orgs = await withSuperAdminContext(async (client) => {
      const { rows } = await client.query(`
        SELECT o.id, o.name, o.slug, o.is_active, o.limits, o.created_at,
               COUNT(DISTINCT u.id) FILTER (WHERE u.is_active = true) as user_count,
               COUNT(DISTINCT s.id) as scan_count,
               COUNT(DISTINCT f.id) as finding_count,
               (SELECT u2.email FROM users u2 WHERE u2.org_id = o.id AND u2.role = 'admin' LIMIT 1) as admin_email
        FROM organizations o
        LEFT JOIN users u ON u.org_id = o.id
        LEFT JOIN scans s ON s.org_id = o.id
        LEFT JOIN findings f ON f.org_id = o.id
        WHERE o.slug != '__system__'
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `);
      return rows;
    });
    res.json(orgs);
  } catch (err) {
    logger.error('Super admin list orgs error:', err);
    res.status(500).json({ error: 'Failed to list organizations' });
  }
});

// ---- Create Organization + Admin ----

const createOrgSchema = z.object({
  orgName: z.string().min(2).max(100),
  adminEmail: z.string().email().max(255),
  adminName: z.string().min(1).max(255),
  adminPassword: z.string().min(8).max(128).optional(),
});

router.post('/orgs', validate(createOrgSchema), async (req, res) => {
  const { orgName, adminEmail, adminName, adminPassword } = req.validated;

  try {
    const result = await withSystemContext(async (client) => {
      // Check email uniqueness
      const { rows: existing } = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail.toLowerCase()]);
      if (existing.length > 0) return { error: 'Email already registered', status: 409 };

      // Check org name uniqueness
      const { rows: orgExists } = await client.query('SELECT id FROM organizations WHERE LOWER(name) = LOWER($1)', [orgName]);
      if (orgExists.length > 0) return { error: 'Organization name already taken', status: 409 };

      // Create slug
      let slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
      const { rows: slugCheck } = await client.query('SELECT id FROM organizations WHERE slug = $1', [slug]);
      if (slugCheck.length > 0) slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;

      // Create org
      const { rows: [org] } = await client.query(
        'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id, slug',
        [orgName, slug]
      );

      // Create admin user with generated or provided password
      const password = adminPassword || crypto.randomBytes(16).toString('hex');
      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const { rows: [user] } = await client.query(
        'INSERT INTO users (org_id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [org.id, adminEmail.toLowerCase(), hash, adminName, 'admin']
      );

      // Create invitation token so admin can set their own password
      const inviteToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await client.query(
        'INSERT INTO invitations (org_id, email, invited_by, token, role, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [org.id, adminEmail.toLowerCase(), req.user.userId, inviteToken, 'admin', expiresAt]
      );

      return { org: { id: org.id, name: orgName, slug: org.slug }, user: { id: user.id }, inviteToken, password: adminPassword ? undefined : password };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });

    await auditLog({
      orgId: result.org.id, userId: req.user.userId,
      action: 'org.created', resource: 'organization', resourceId: result.org.id,
      metadata: { orgName, adminEmail: adminEmail.toLowerCase() }, ipAddress: req.ip,
    });

    const inviteUrl = `/invite/${result.inviteToken}`;
    res.status(201).json({ ...result, inviteUrl });
  } catch (err) {
    logger.error('Super admin create org error:', err);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// ---- Enable/Disable Organization ----

const updateOrgSchema = z.object({
  isActive: z.boolean().optional(),
  limits: z.object({
    maxUsers: z.number().int().min(-1).optional(),
    maxRepos: z.number().int().min(-1).optional(),
    maxScansPerMonth: z.number().int().min(-1).optional(),
  }).optional(),
});

router.patch('/orgs/:orgId', validate(updateOrgSchema), async (req, res) => {
  const { isActive, limits } = req.validated;
  try {
    await withSuperAdminContext(async (client) => {
      const sets = ['updated_at = now()'];
      const params = [];
      let idx = 1;

      if (isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(isActive); }
      if (limits) { sets.push(`limits = limits || $${idx++}::jsonb`); params.push(JSON.stringify(limits)); }

      params.push(req.params.orgId);
      await client.query(`UPDATE organizations SET ${sets.join(', ')} WHERE id = $${idx}`, params);
    });

    const actions = [];
    if (isActive !== undefined) actions.push(isActive ? 'org.enabled' : 'org.disabled');
    if (limits) actions.push('org.limits_updated');

    for (const action of actions) {
      await auditLog({
        orgId: req.params.orgId, userId: req.user.userId,
        action, resource: 'organization', resourceId: req.params.orgId,
        metadata: limits ? { limits } : undefined, ipAddress: req.ip,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// ---- Delete Organization ----

router.delete('/orgs/:orgId', async (req, res) => {
  try {
    await withSuperAdminContext(async (client) => {
      // CASCADE will delete all related data (users, scans, findings, etc.)
      const { rowCount } = await client.query('DELETE FROM organizations WHERE id = $1 AND slug != $2', [req.params.orgId, '__system__']);
      if (rowCount === 0) return res.status(404).json({ error: 'Organization not found' });
    });

    await auditLog({
      orgId: req.params.orgId, userId: req.user.userId,
      action: 'org.deleted', resource: 'organization', resourceId: req.params.orgId, ipAddress: req.ip,
    });

    res.json({ ok: true });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// ---- List Users in an Org ----

router.get('/orgs/:orgId/users', async (req, res) => {
  try {
    const users = await withSuperAdminContext(async (client) => {
      const { rows } = await client.query(
        'SELECT id, email, name, role, is_active, created_at, last_login_at FROM users WHERE org_id = $1 ORDER BY created_at',
        [req.params.orgId]
      );
      return rows;
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// ---- Add User to Org ----

const addUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(255),
  role: z.enum(['admin', 'member']).default('member'),
  password: z.string().min(8).max(128).optional(),
});

router.post('/orgs/:orgId/users', validate(addUserSchema), async (req, res) => {
  const { email, name, role, password } = req.validated;
  const { orgId } = req.params;

  try {
    const result = await withSystemContext(async (client) => {
      const { rows: existing } = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (existing.length > 0) return { error: 'Email already registered', status: 409 };

      const pwd = password || crypto.randomBytes(16).toString('hex');
      const hash = await bcrypt.hash(pwd, BCRYPT_ROUNDS);
      const { rows: [user] } = await client.query(
        'INSERT INTO users (org_id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role',
        [orgId, email.toLowerCase(), hash, name, role]
      );
      return { user, tempPassword: password ? undefined : pwd };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });

    // Get org name for audit
    const org = await withSuperAdminContext(async (client) => {
      const { rows } = await client.query('SELECT name FROM organizations WHERE id = $1', [orgId]);
      return rows[0];
    });

    await auditLog({
      orgId, userId: req.user.userId,
      action: 'user.created_by_admin', resource: 'user', resourceId: result.user.id,
      metadata: { email: email.toLowerCase(), name, role, orgName: org?.name }, ipAddress: req.ip,
    });

    res.status(201).json(result);
  } catch (err) {
    logger.error('Super admin add user error:', err);
    res.status(500).json({ error: 'Failed to add user' });
  }
});

// ---- Delete User from Org ----

router.delete('/orgs/:orgId/users/:userId', async (req, res) => {
  const { orgId, userId } = req.params;

  try {
    // Get user info before deleting (for audit)
    const userInfo = await withSuperAdminContext(async (client) => {
      const { rows } = await client.query('SELECT email, name, role FROM users WHERE id = $1 AND org_id = $2', [userId, orgId]);
      return rows[0];
    });

    if (!userInfo) return res.status(404).json({ error: 'User not found' });

    await withSuperAdminContext(async (client) => {
      await client.query('DELETE FROM users WHERE id = $1 AND org_id = $2', [userId, orgId]);
    });

    const org = await withSuperAdminContext(async (client) => {
      const { rows } = await client.query('SELECT name FROM organizations WHERE id = $1', [orgId]);
      return rows[0];
    });

    await auditLog({
      orgId, userId: req.user.userId,
      action: 'user.deleted_by_admin', resource: 'user', resourceId: userId,
      metadata: { deletedEmail: userInfo.email, deletedName: userInfo.name, deletedRole: userInfo.role, orgName: org?.name },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error('Super admin delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;

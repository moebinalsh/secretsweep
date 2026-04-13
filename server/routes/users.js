import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { extractUser, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { withTenant } from '../db/pool.js';
import { auditLog } from '../lib/audit.js';
import { revokeAllUserTokens } from '../lib/jwt.js';
import logger from '../logger.js';

const router = Router();

// ---- List Org Users (admin) ----

router.get('/', extractUser, requireAdmin, async (req, res) => {
  try {
    const users = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query(
        'SELECT id, email, name, role, is_active, created_at, last_login_at FROM users ORDER BY created_at'
      );
      return rows;
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// ---- Update User Role (admin) ----

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

router.patch('/:userId', extractUser, requireAdmin, validate(updateRoleSchema), async (req, res) => {
  const { userId } = req.params;
  const { role } = req.validated;

  if (userId === req.user.userId) {
    return res.status(400).json({ error: 'Cannot change your own role' });
  }

  try {
    const targetUser = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query('SELECT email, name, role FROM users WHERE id = $1', [userId]);
      return rows[0];
    });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    await withTenant(req.user.orgId, async (client) => {
      await client.query('UPDATE users SET role = $1, updated_at = now() WHERE id = $2', [role, userId]);
    });

    await auditLog({
      orgId: req.user.orgId, userId: req.user.userId,
      action: 'user.role_changed', resource: 'user', resourceId: userId,
      metadata: { targetEmail: targetUser.email, targetName: targetUser.name, previousRole: targetUser.role, newRole: role },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: 'Failed to update user' });
  }
});

// ---- Deactivate User (admin) ----

router.delete('/:userId', extractUser, requireAdmin, async (req, res) => {
  const { userId } = req.params;

  if (userId === req.user.userId) {
    return res.status(400).json({ error: 'Cannot remove yourself' });
  }

  try {
    // Get user info before deactivating
    const targetUser = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query('SELECT email, name, role FROM users WHERE id = $1', [userId]);
      return rows[0];
    });

    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    await withTenant(req.user.orgId, async (client) => {
      await client.query('UPDATE users SET is_active = false, updated_at = now() WHERE id = $1', [userId]);
    });

    await revokeAllUserTokens(userId);

    await auditLog({
      orgId: req.user.orgId, userId: req.user.userId,
      action: 'user.deactivated', resource: 'user', resourceId: userId,
      metadata: { deactivatedEmail: targetUser.email, deactivatedName: targetUser.name, deactivatedRole: targetUser.role },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: 'Failed to remove user' });
  }
});

// ---- Admin Reset User Password ----

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(128).regex(/[a-zA-Z]/).regex(/[0-9]/),
});

router.post('/:userId/reset-password', extractUser, requireAdmin, validate(resetPasswordSchema), async (req, res) => {
  const { userId } = req.params;
  const { newPassword } = req.validated;

  if (userId === req.user.userId) {
    return res.status(400).json({ error: 'Use profile settings to change your own password' });
  }

  try {
    const hash = await bcrypt.hash(newPassword, 12);
    await withTenant(req.user.orgId, async (client) => {
      const { rowCount } = await client.query(
        'UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
        [hash, userId]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'User not found' });
    });

    // Revoke all their sessions so they have to re-login
    await revokeAllUserTokens(userId);

    await auditLog({
      orgId: req.user.orgId, userId: req.user.userId,
      action: 'user.password_reset', resource: 'user', resourceId: userId, ipAddress: req.ip,
    });

    res.json({ ok: true });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ---- Get Current User Profile ----

router.get('/me', extractUser, async (req, res) => {
  try {
    const user = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query(
        `SELECT u.id, u.email, u.name, u.role, u.job_title, u.created_at, o.name as org_name, o.slug as org_slug
         FROM users u JOIN organizations o ON o.id = u.org_id WHERE u.id = $1`,
        [req.user.userId]
      );
      return rows[0];
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// ---- Update Own Profile ----

const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  jobTitle: z.string().max(255).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(128).regex(/[a-zA-Z]/).regex(/[0-9]/).optional(),
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) return false;
  return true;
}, { message: 'Current password required to set new password' });

router.patch('/me', extractUser, validate(updateProfileSchema), async (req, res) => {
  const { name, jobTitle, currentPassword, newPassword } = req.validated;

  try {
    if (newPassword) {
      const { rows } = await withTenant(req.user.orgId, async (client) => {
        return client.query('SELECT password_hash FROM users WHERE id = $1', [req.user.userId]);
      });
      const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

      const hash = await bcrypt.hash(newPassword, 12);
      await withTenant(req.user.orgId, async (client) => {
        await client.query('UPDATE users SET password_hash = $1, name = COALESCE($2, name), job_title = COALESCE($3, job_title), updated_at = now() WHERE id = $4',
          [hash, name, jobTitle, req.user.userId]);
      });
    } else if (name || jobTitle !== undefined) {
      await withTenant(req.user.orgId, async (client) => {
        await client.query('UPDATE users SET name = COALESCE($1, name), job_title = COALESCE($2, job_title), updated_at = now() WHERE id = $3',
          [name, jobTitle, req.user.userId]);
      });
    }

    res.json({ ok: true });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;

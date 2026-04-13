import { Router } from 'express';
import { z } from 'zod';
import { extractUser, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { withTenant } from '../db/pool.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { auditLog } from '../lib/audit.js';
import { sendTestMessage } from '../lib/notifications.js';
import logger from '../logger.js';

const router = Router();

// ---- Create Integration ----

const createSchema = z.object({
  name: z.string().min(1).max(255),
  webhookUrl: z.string().url().startsWith('https://hooks.slack.com/'),
  config: z.object({
    onScanComplete: z.boolean().default(true),
    onScanFailed: z.boolean().default(true),
    onFinding: z.boolean().default(true),
    severities: z.array(z.enum(['critical', 'high', 'medium', 'low'])).default(['critical', 'high']),
  }).default({}),
});

router.post('/', extractUser, requireAdmin, validate(createSchema), async (req, res) => {
  const { name, webhookUrl, config } = req.validated;

  try {
    // Validate webhook by sending test message
    try {
      await sendTestMessage(webhookUrl);
    } catch (err) {
      return res.status(400).json({ error: `Invalid webhook: ${err.message}` });
    }

    // Encrypt webhook URL
    const { encrypted, iv, authTag } = encrypt(webhookUrl);

    const integration = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO integrations (org_id, type, name, encrypted_webhook, iv, auth_tag, config, created_by)
         VALUES ($1, 'slack', $2, $3, $4, $5, $6, $7)
         RETURNING id, name, config, is_active, created_at`,
        [req.user.orgId, name, encrypted, iv, authTag, JSON.stringify(config), req.user.userId]
      );
      return rows[0];
    });

    await auditLog({
      orgId: req.user.orgId, userId: req.user.userId,
      action: 'integration.created', resource: 'integration', resourceId: integration.id,
      metadata: { type: 'slack', name }, ipAddress: req.ip,
    });

    res.status(201).json({ ...integration, type: 'slack' });
  } catch (err) {
    logger.error('Create integration error:', err);
    res.status(500).json({ error: 'Failed to create integration' });
  }
});

// ---- List Integrations ----

router.get('/', extractUser, async (req, res) => {
  try {
    const integrations = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query(
        `SELECT i.id, i.type, i.name, i.config, i.is_active, i.created_at, i.updated_at, u.name as created_by_name
         FROM integrations i JOIN users u ON u.id = i.created_by
         ORDER BY i.created_at DESC`
      );
      return rows;
    });

    res.json(integrations);
  } catch (err) {
    logger.error('List integrations error:', err);
    res.status(500).json({ error: 'Failed to list integrations' });
  }
});

// ---- Update Integration ----

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.object({
    onScanComplete: z.boolean().optional(),
    onScanFailed: z.boolean().optional(),
    onFinding: z.boolean().optional(),
    severities: z.array(z.enum(['critical', 'high', 'medium', 'low'])).optional(),
  }).optional(),
  isActive: z.boolean().optional(),
});

router.patch('/:id', extractUser, requireAdmin, validate(updateSchema), async (req, res) => {
  const { id } = req.params;
  const { name, config, isActive } = req.validated;

  try {
    const updated = await withTenant(req.user.orgId, async (client) => {
      // Build dynamic update
      const sets = ['updated_at = now()'];
      const params = [];
      let idx = 1;

      if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(name); }
      if (config !== undefined) {
        // Merge with existing config
        sets.push(`config = config || $${idx++}::jsonb`);
        params.push(JSON.stringify(config));
      }
      if (isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(isActive); }

      params.push(id);
      const { rows } = await client.query(
        `UPDATE integrations SET ${sets.join(', ')} WHERE id = $${idx}
         RETURNING id, name, config, is_active, updated_at`,
        params
      );
      return rows[0] || null;
    });

    if (!updated) return res.status(404).json({ error: 'Integration not found' });

    await auditLog({
      orgId: req.user.orgId, userId: req.user.userId,
      action: 'integration.updated', resource: 'integration', resourceId: id,
      metadata: { name, isActive }, ipAddress: req.ip,
    });

    res.json(updated);
  } catch (err) {
    logger.error('Update integration error:', err);
    res.status(500).json({ error: 'Failed to update integration' });
  }
});

// ---- Delete Integration ----

router.delete('/:id', extractUser, requireAdmin, async (req, res) => {
  try {
    const deleted = await withTenant(req.user.orgId, async (client) => {
      const { rowCount } = await client.query('DELETE FROM integrations WHERE id = $1', [req.params.id]);
      return rowCount > 0;
    });

    if (!deleted) return res.status(404).json({ error: 'Integration not found' });

    await auditLog({
      orgId: req.user.orgId, userId: req.user.userId,
      action: 'integration.deleted', resource: 'integration', resourceId: req.params.id,
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

// ---- Test Integration ----

router.post('/:id/test', extractUser, requireAdmin, async (req, res) => {
  try {
    const row = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query(
        'SELECT encrypted_webhook, iv, auth_tag FROM integrations WHERE id = $1',
        [req.params.id]
      );
      return rows[0] || null;
    });

    if (!row) return res.status(404).json({ error: 'Integration not found' });

    const webhookUrl = decrypt({
      encrypted: row.encrypted_webhook, iv: row.iv, authTag: row.auth_tag,
    });

    await sendTestMessage(webhookUrl);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Test integration error:', err);
    res.status(400).json({ error: `Test failed: ${err.message}` });
  }
});

export default router;

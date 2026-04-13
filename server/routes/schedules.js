import { Router } from 'express';
import { z } from 'zod';
import { extractUser, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { withTenant } from '../db/pool.js';
import { auditLog } from '../lib/audit.js';
import { getNextRun } from '../lib/scheduler.js';
import logger from '../logger.js';

const router = Router();

const CRON_PRESETS = {
  daily: '0 2 * * *',
  weekly: '0 2 * * 1',
  biweekly: '0 2 1,15 * *',
  monthly: '0 2 1 * *',
};

// ---- Create Schedule ----

const createSchema = z.object({
  githubOrg: z.string().min(1).max(255),
  scanMode: z.enum(['full', 'selective']).default('full'),
  repos: z.array(z.string().max(200)).max(500).optional(),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'custom']).default('weekly'),
  cronExpression: z.string().max(100).optional(),
});

router.post('/', extractUser, requireAdmin, validate(createSchema), async (req, res) => {
  const { githubOrg, scanMode, repos, frequency, cronExpression } = req.validated;

  const cron = frequency === 'custom' && cronExpression ? cronExpression : CRON_PRESETS[frequency] || CRON_PRESETS.weekly;
  const nextRun = getNextRun(cron);
  const label = frequency === 'custom' ? cronExpression : frequency.charAt(0).toUpperCase() + frequency.slice(1);

  try {
    const schedule = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO scan_schedules (org_id, created_by, github_org, scan_mode, repo_filter, cron_expression, cron_label, next_run_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, github_org, scan_mode, cron_expression, cron_label, is_active, next_run_at, created_at`,
        [req.user.orgId, req.user.userId, githubOrg, scanMode, repos ? JSON.stringify(repos) : null, cron, label, nextRun]
      );
      return rows[0];
    });

    await auditLog({
      orgId: req.user.orgId, userId: req.user.userId,
      action: 'schedule.created', resource: 'schedule', resourceId: schedule.id,
      metadata: { githubOrg, frequency, cron }, ipAddress: req.ip,
    });

    res.status(201).json(schedule);
  } catch (err) {
    logger.error('Create schedule error:', err);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// ---- List Schedules ----

router.get('/', extractUser, async (req, res) => {
  try {
    const schedules = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query(
        `SELECT ss.*, u.name as created_by_name
         FROM scan_schedules ss JOIN users u ON u.id = ss.created_by
         ORDER BY ss.created_at DESC`
      );
      return rows;
    });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list schedules' });
  }
});

// ---- Update Schedule ----

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'custom']).optional(),
  cronExpression: z.string().max(100).optional(),
});

router.patch('/:id', extractUser, requireAdmin, validate(updateSchema), async (req, res) => {
  const { isActive, frequency, cronExpression } = req.validated;

  try {
    const updated = await withTenant(req.user.orgId, async (client) => {
      const sets = ['updated_at = now()'];
      const params = [];
      let idx = 1;

      if (isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(isActive); }

      if (frequency) {
        const cron = frequency === 'custom' && cronExpression ? cronExpression : CRON_PRESETS[frequency] || CRON_PRESETS.weekly;
        const label = frequency === 'custom' ? cronExpression : frequency.charAt(0).toUpperCase() + frequency.slice(1);
        const nextRun = isActive === false ? null : getNextRun(cron);
        sets.push(`cron_expression = $${idx++}`); params.push(cron);
        sets.push(`cron_label = $${idx++}`); params.push(label);
        sets.push(`next_run_at = $${idx++}`); params.push(nextRun);
      } else if (isActive === true) {
        // Re-activating: recompute next run from existing cron
        sets.push(`next_run_at = $${idx++}`);
        // We need the current cron — fetch it first
        const { rows: current } = await client.query('SELECT cron_expression FROM scan_schedules WHERE id = $1', [req.params.id]);
        if (current[0]) {
          params.push(getNextRun(current[0].cron_expression));
        } else {
          params.push(null);
        }
      } else if (isActive === false) {
        sets.push(`next_run_at = NULL`);
      }

      params.push(req.params.id);
      const { rows } = await client.query(
        `UPDATE scan_schedules SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
      );
      return rows[0] || null;
    });

    if (!updated) return res.status(404).json({ error: 'Schedule not found' });
    res.json(updated);
  } catch (err) {
    logger.error('Update schedule error:', err);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// ---- Delete Schedule ----

router.delete('/:id', extractUser, requireAdmin, async (req, res) => {
  try {
    const deleted = await withTenant(req.user.orgId, async (client) => {
      const { rowCount } = await client.query('DELETE FROM scan_schedules WHERE id = $1', [req.params.id]);
      return rowCount > 0;
    });
    if (!deleted) return res.status(404).json({ error: 'Schedule not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

export default router;

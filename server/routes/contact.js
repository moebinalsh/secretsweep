import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { withSystemContext, withSuperAdminContext } from '../db/pool.js';
import { extractUser, requireSuperAdmin } from '../middleware/auth.js';
import logger from '../logger.js';

const router = Router();

// ---- Public: Submit Contact Form ----

const contactSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  company: z.string().max(255).optional(),
  message: z.string().max(2000).optional(),
});

router.post('/', validate(contactSchema), async (req, res) => {
  const { name, email, company, message } = req.validated;

  try {
    const request = await withSystemContext(async (client) => {
      const { rows } = await client.query(
        'INSERT INTO contact_requests (name, email, company, message) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
        [name, email, company || null, message || null]
      );
      return rows[0];
    });

    // Try to send Slack notification
    try {
      const { rows: settings } = await withSystemContext(async (client) => {
        return client.query("SELECT value FROM system_settings WHERE key = 'contact_slack_webhook'");
      });
      const webhook = settings[0]?.value?.url;
      if (webhook) {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blocks: [
              { type: 'section', text: { type: 'mrkdwn', text: `:incoming_envelope: *New Demo Request*` } },
              { type: 'section', fields: [
                { type: 'mrkdwn', text: `*Name:*\n${name}` },
                { type: 'mrkdwn', text: `*Email:*\n${email}` },
                { type: 'mrkdwn', text: `*Company:*\n${company || '—'}` },
                { type: 'mrkdwn', text: `*Message:*\n${message || '—'}` },
              ]},
            ],
          }),
          signal: AbortSignal.timeout(5000),
        });
      }
    } catch (slackErr) {
      logger.warn('Failed to send contact Slack notification:', slackErr.message);
    }

    res.status(201).json({ ok: true, id: request.id });
  } catch (err) {
    logger.error('Contact form error:', err);
    res.status(500).json({ error: 'Failed to submit. Please try again.' });
  }
});

// ---- Super Admin: List Contact Requests ----

router.get('/', extractUser, requireSuperAdmin, async (req, res) => {
  try {
    const requests = await withSuperAdminContext(async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM contact_requests ORDER BY created_at DESC LIMIT 200'
      );
      return rows;
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// ---- Super Admin: Update Request Status ----

router.patch('/:id', extractUser, requireSuperAdmin, validate(
  z.object({ status: z.enum(['new', 'contacted', 'closed']).optional(), notes: z.string().max(2000).optional() })
), async (req, res) => {
  const { status, notes } = req.validated;
  try {
    await withSuperAdminContext(async (client) => {
      const sets = [];
      const params = [];
      let idx = 1;
      if (status) { sets.push(`status = $${idx++}`); params.push(status); }
      if (notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(notes); }
      if (sets.length === 0) return;
      params.push(req.params.id);
      await client.query(`UPDATE contact_requests SET ${sets.join(', ')} WHERE id = $${idx}`, params);
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update' });
  }
});

// ---- Super Admin: Delete Request ----

router.delete('/:id', extractUser, requireSuperAdmin, async (req, res) => {
  try {
    await withSuperAdminContext(async (client) => {
      await client.query('DELETE FROM contact_requests WHERE id = $1', [req.params.id]);
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ---- Super Admin: Get/Set Slack Webhook for Contacts ----

router.get('/settings/slack', extractUser, requireSuperAdmin, async (req, res) => {
  try {
    const result = await withSuperAdminContext(async (client) => {
      const { rows } = await client.query("SELECT value FROM system_settings WHERE key = 'contact_slack_webhook'");
      return rows[0]?.value || {};
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings/slack', extractUser, requireSuperAdmin, validate(
  z.object({ url: z.string().url().startsWith('https://hooks.slack.com/').optional().or(z.literal('')) })
), async (req, res) => {
  try {
    await withSuperAdminContext(async (client) => {
      await client.query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ('contact_slack_webhook', $1, now())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
        [JSON.stringify({ url: req.validated.url || '' })]
      );
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;

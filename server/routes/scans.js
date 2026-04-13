import { Router } from 'express';
import { z } from 'zod';
import { extractUser } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { withTenant } from '../db/pool.js';
import { auditLog } from '../lib/audit.js';
import { scanManager } from '../lib/scanManager.js';
import { checkLimit } from '../lib/limits.js';
import logger from '../logger.js';

const router = Router();
const MAX_CONCURRENT_SCANS = 3;

// ---- Create Scan ----

const createScanSchema = z.object({
  githubOrg: z.string().min(1).max(255),
  scanMode: z.enum(['full', 'selective']).default('full'),
  repos: z.array(z.string().max(200)).max(500).optional(),
});

router.post('/', extractUser, validate(createScanSchema), async (req, res) => {
  const { githubOrg, scanMode, repos } = req.validated;

  try {
    // Check monthly scan limit
    const scanLimit = await checkLimit(req.user.orgId, 'maxScansPerMonth');
    if (!scanLimit.allowed) return res.status(429).json({ error: scanLimit.error });

    // Check concurrent scan limit
    const running = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query(
        "SELECT COUNT(*) as count FROM scans WHERE status = 'running'"
      );
      return parseInt(rows[0].count);
    });

    if (running >= MAX_CONCURRENT_SCANS) {
      return res.status(429).json({ error: `Maximum ${MAX_CONCURRENT_SCANS} concurrent scans per organization` });
    }

    // Create scan record
    const scan = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO scans (org_id, started_by, github_org, scan_mode, repo_filter)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, status, started_at`,
        [req.user.orgId, req.user.userId, githubOrg, scanMode, repos ? JSON.stringify(repos) : null]
      );
      return rows[0];
    });

    await auditLog({
      orgId: req.user.orgId, userId: req.user.userId,
      action: 'scan.started', resource: 'scan', resourceId: scan.id,
      metadata: { githubOrg, scanMode }, ipAddress: req.ip,
    });

    // Start scan in background (fire-and-forget)
    scanManager.start(scan.id, req.user.orgId, req.user.userId);

    res.status(201).json({ scanId: scan.id });
  } catch (err) {
    logger.error('Create scan error:', err);
    res.status(500).json({ error: 'Failed to create scan' });
  }
});

// ---- Stream Scan (SSE) — read-only observer ----

router.get('/:scanId/stream', extractUser, async (req, res) => {
  const { scanId } = req.params;
  const fromIndex = parseInt(req.query.fromIndex) || 0;

  try {
    // Verify scan belongs to user's org
    const scan = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query('SELECT id, status FROM scans WHERE id = $1', [scanId]);
      return rows[0];
    });

    if (!scan) return res.status(404).json({ error: 'Scan not found' });

    // If scan is already finished and not in memory, send terminal status
    if (scan.status !== 'running' && !scanManager.getState(scanId)) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(`data: ${JSON.stringify({ type: 'status', status: scan.status })}\n\n`);
      res.end();
      return;
    }

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Subscribe to live events
    const send = (event) => {
      try {
        res.write(`id: ${event._idx}\ndata: ${JSON.stringify(event)}\n\n`);
      } catch {}
    };

    const unsubscribe = scanManager.subscribe(scanId, fromIndex, send);

    if (!unsubscribe) {
      // Scan not in memory — send terminal status and close
      res.write(`data: ${JSON.stringify({ type: 'status', status: scan.status })}\n\n`);
      res.end();
      return;
    }

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      try { res.write(': heartbeat\n\n'); } catch {}
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (err) {
    logger.error('Scan stream error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Stream failed' });
  }
});

// ---- List Scans ----

const listScansQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']).optional(),
});

router.get('/', extractUser, validateQuery(listScansQuery), async (req, res) => {
  const { page, limit, status } = req.validatedQuery;
  const offset = (page - 1) * limit;

  try {
    const result = await withTenant(req.user.orgId, async (client) => {
      let whereClause = '';
      const params = [limit, offset];

      if (status) {
        whereClause = 'WHERE s.status = $3';
        params.push(status);
      }

      const { rows: scans } = await client.query(
        `SELECT s.id, s.github_org, s.status, s.scan_mode, s.total_repos, s.total_findings,
                s.started_at, s.completed_at, u.name as started_by_name, u.email as started_by_email
         FROM scans s JOIN users u ON u.id = s.started_by
         ${whereClause}
         ORDER BY s.started_at DESC LIMIT $1 OFFSET $2`,
        params
      );

      const countParams = status ? [status] : [];
      const countWhere = status ? 'WHERE status = $1' : '';
      const { rows: [{ count }] } = await client.query(`SELECT COUNT(*) FROM scans ${countWhere}`, countParams);

      return { scans, total: parseInt(count) };
    });

    res.json({ scans: result.scans, total: result.total, page, limit });
  } catch (err) {
    logger.error('List scans error:', err);
    res.status(500).json({ error: 'Failed to list scans' });
  }
});

// ---- Get Scan Detail ----

router.get('/:scanId', extractUser, async (req, res) => {
  try {
    const scan = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query(
        `SELECT s.*, u.name as started_by_name, u.email as started_by_email
         FROM scans s JOIN users u ON u.id = s.started_by WHERE s.id = $1`,
        [req.params.scanId]
      );
      return rows[0];
    });

    if (!scan) return res.status(404).json({ error: 'Scan not found' });
    res.json(scan);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get scan' });
  }
});

// ---- Get Scan Findings ----

const findingsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  severity: z.string().optional(),
  repo: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
});

router.get('/:scanId/findings', extractUser, validateQuery(findingsQuery), async (req, res) => {
  const { page, limit, severity, repo, status, search } = req.validatedQuery;
  const offset = (page - 1) * limit;

  try {
    const result = await withTenant(req.user.orgId, async (client) => {
      const conditions = ['scan_id = $1'];
      const params = [req.params.scanId];
      let paramIdx = 2;

      if (severity) {
        conditions.push(`severity = $${paramIdx++}`);
        params.push(severity);
      }
      if (repo) {
        conditions.push(`repo ILIKE $${paramIdx++}`);
        params.push(`%${repo}%`);
      }
      if (status) {
        conditions.push(`status = $${paramIdx++}`);
        params.push(status);
      }
      if (search) {
        conditions.push(`(repo ILIKE $${paramIdx} OR file ILIKE $${paramIdx} OR secret_type ILIKE $${paramIdx})`);
        params.push(`%${search}%`);
        paramIdx++;
      }

      const where = conditions.join(' AND ');
      params.push(limit, offset);

      const { rows: findings } = await client.query(
        `SELECT * FROM findings WHERE ${where} ORDER BY
           CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
           created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        params
      );

      const countParams = params.slice(0, -2);
      const { rows: [{ count }] } = await client.query(`SELECT COUNT(*) FROM findings WHERE ${where}`, countParams);

      return { findings, total: parseInt(count) };
    });

    res.json({ findings: result.findings, total: result.total, page, limit });
  } catch (err) {
    logger.error('Get findings error:', err);
    res.status(500).json({ error: 'Failed to get findings' });
  }
});

// ---- Cancel Scan ----

router.patch('/:scanId/cancel', extractUser, async (req, res) => {
  try {
    await withTenant(req.user.orgId, async (client) => {
      await client.query(
        "UPDATE scans SET status = 'cancelled', completed_at = now() WHERE id = $1 AND status = 'running'",
        [req.params.scanId]
      );
    });

    // Signal background scan to stop
    scanManager.cancel(req.params.scanId);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel scan' });
  }
});

export default router;

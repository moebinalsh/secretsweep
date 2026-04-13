import { Router } from 'express';
import { z } from 'zod';
import { extractUser } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { withTenant } from '../db/pool.js';
import { auditLog } from '../lib/audit.js';
import { getDecryptedToken } from './github.js';
import { getFileContent } from '../github.js';
import patterns from '../patterns.js';
import logger from '../logger.js';

const router = Router();

// ---- List All Findings (cross-scan) ----

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  severity: z.string().optional(),
  repo: z.string().optional(),
  status: z.string().optional(),
  secretType: z.string().optional(),
  search: z.string().optional(),
});

router.get('/', extractUser, validateQuery(listQuery), async (req, res) => {
  const { page, limit, severity, repo, status, secretType, search } = req.validatedQuery;
  const offset = (page - 1) * limit;

  try {
    const result = await withTenant(req.user.orgId, async (client) => {
      const conditions = [];
      const params = [];
      let idx = 1;

      if (severity) { conditions.push(`f.severity = $${idx++}`); params.push(severity); }
      if (repo) { conditions.push(`f.repo ILIKE $${idx++}`); params.push(`%${repo}%`); }
      if (status) { conditions.push(`f.status = $${idx++}`); params.push(status); }
      if (secretType) { conditions.push(`f.secret_type_id = $${idx++}`); params.push(secretType); }
      if (search) {
        conditions.push(`(f.repo ILIKE $${idx} OR f.file ILIKE $${idx} OR f.secret_type ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit, offset);

      // Deduplicate: same repo+file+secret_type_id = one finding (latest wins)
      const dedupCte = `WITH deduped AS (
        SELECT DISTINCT ON (f.repo, f.file, f.secret_type_id) f.*, s.github_org, s.started_at as scan_started_at
        FROM findings f JOIN scans s ON s.id = f.scan_id
        ${where}
        ORDER BY f.repo, f.file, f.secret_type_id, f.created_at DESC
      )`;

      const { rows: findings } = await client.query(
        `${dedupCte}
         SELECT * FROM deduped
         ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        params
      );

      const countParams = params.slice(0, -2);
      const { rows: [{ count }] } = await client.query(
        `${dedupCte} SELECT COUNT(*) FROM deduped`,
        countParams
      );

      return { findings, total: parseInt(count) };
    });

    res.json({ findings: result.findings, total: result.total, page, limit });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list findings' });
  }
});

// ---- Update Finding Status (triage) ----

const updateSchema = z.object({
  status: z.enum(['open', 'acknowledged', 'resolved', 'false_positive']),
});

router.patch('/:findingId', extractUser, validate(updateSchema), async (req, res) => {
  const { findingId } = req.params;
  const { status } = req.validated;

  try {
    await withTenant(req.user.orgId, async (client) => {
      const resolved = ['resolved', 'false_positive'].includes(status);
      const { rowCount } = await client.query(
        `UPDATE findings SET status = $1, resolved_by = $2, resolved_at = $3 WHERE id = $4`,
        [status, resolved ? req.user.userId : null, resolved ? new Date() : null, findingId]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'Finding not found' });
    });

    await auditLog({
      orgId: req.user.orgId, userId: req.user.userId,
      action: 'finding.status_changed', resource: 'finding', resourceId: findingId,
      metadata: { status },
    });

    res.json({ ok: true });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: 'Failed to update finding' });
  }
});

// ---- Findings Stats ----

router.get('/stats', extractUser, async (req, res) => {
  try {
    const stats = await withTenant(req.user.orgId, async (client) => {
      // Deduplicate: same repo+file+secret_type_id across scans = one finding.
      // Use the most recent status (latest scan wins).
      const dedup = `
        WITH unique_findings AS (
          SELECT DISTINCT ON (repo, file, secret_type_id)
            id, repo, file, secret_type_id, severity, status, scan_id, created_at
          FROM findings
          ORDER BY repo, file, secret_type_id, created_at DESC
        )`;

      const { rows: bySeverity } = await client.query(
        `${dedup} SELECT severity, COUNT(*) as count FROM unique_findings WHERE status IN ('open', 'acknowledged') GROUP BY severity`
      );
      const { rows: byStatus } = await client.query(
        `${dedup} SELECT status, COUNT(*) as count FROM unique_findings GROUP BY status`
      );
      const { rows: byRepo } = await client.query(
        `${dedup} SELECT repo, COUNT(*) as count FROM unique_findings WHERE status IN ('open', 'acknowledged') GROUP BY repo ORDER BY count DESC LIMIT 10`
      );
      const { rows: recentScans } = await client.query(
        `SELECT id, github_org, status, total_findings, total_repos, started_at, completed_at
         FROM scans ORDER BY started_at DESC LIMIT 5`
      );
      const { rows: [totals] } = await client.query(
        `${dedup}
         SELECT
           COUNT(*) FILTER (WHERE status IN ('open', 'acknowledged')) as total_findings,
           COUNT(*) FILTER (WHERE status IN ('resolved', 'false_positive')) as remediated_findings,
           COUNT(*) as all_findings,
           COUNT(DISTINCT scan_id) as total_scans,
           COUNT(DISTINCT repo) as total_repos
         FROM unique_findings`
      );
      const { rows: [scanTotals] } = await client.query(
        `SELECT COUNT(DISTINCT repo) as total_repos_scanned FROM findings`
      );

      return { bySeverity, byStatus, byRepo, recentScans, totals, scanTotals };
    });

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ---- Validate Remediation (re-check specific findings against current repo state) ----

// ---- Validate Remediation ----
// Fetches the raw file from GitHub for each finding and re-runs the pattern regex.
// Only findings that are confirmed gone get marked as 'resolved'.

router.post('/validate-remediation', extractUser, validate(
  z.object({ scanId: z.string().uuid().optional(), findingIds: z.array(z.string().uuid()).max(200).optional() })
), async (req, res) => {
  const { scanId, findingIds } = req.validated;

  try {
    const ghToken = await getDecryptedToken(req.user.orgId, req.user.userId);
    if (!ghToken) return res.status(400).json({ error: 'GitHub not connected' });

    // Get all findings except false_positive (re-check even resolved ones)
    const findings = await withTenant(req.user.orgId, async (client) => {
      if (findingIds?.length > 0) {
        const placeholders = findingIds.map((_, i) => `$${i + 1}`).join(',');
        const { rows } = await client.query(
          `SELECT f.id, f.repo, f.file, f.file_url, f.repo_url, f.secret_type_id, f.severity, f.status, f.scan_id
           FROM findings f WHERE f.id IN (${placeholders}) AND f.status != 'false_positive'`,
          findingIds
        );
        return rows;
      }
      if (scanId) {
        const { rows } = await client.query(
          `SELECT f.id, f.repo, f.file, f.file_url, f.repo_url, f.secret_type_id, f.severity, f.status, f.scan_id
           FROM findings f WHERE f.scan_id = $1 AND f.status != 'false_positive'`,
          [scanId]
        );
        return rows;
      }
      return [];
    });

    if (findings.length === 0) {
      return res.json({ total: 0, remediated: 0, stillPresent: 0, errors: 0 });
    }

    const patternMap = new Map(patterns.map(p => [p.id, p]));

    // Use JSON response (not SSE) for reliability
    let remediated = 0;
    let stillPresent = 0;
    let errors = 0;
    const results = [];

    // Group by repo/file to minimize API calls
    const fileGroups = new Map();
    for (const f of findings) {
      const key = `${f.repo}:${f.file}`;
      if (!fileGroups.has(key)) fileGroups.set(key, []);
      fileGroups.get(key).push(f);
    }

    for (const [, group] of fileGroups) {
      const { repo, file } = group[0];

      try {
        // Determine owner and repo name for the API call
        // repo field can be "org/repo-name" (from code search) or just "repo-name" (from content scan)
        let owner, repoName;
        if (repo.includes('/')) {
          [owner, repoName] = repo.split('/');
        } else {
          // Look up the github_org from the scan
          const scan = await withTenant(req.user.orgId, async (client) => {
            const { rows } = await client.query('SELECT github_org FROM scans WHERE id = $1', [group[0].scan_id]);
            return rows[0];
          });
          owner = scan?.github_org?.replace('__user__:', '') || '';
          repoName = repo;
        }

        // Fetch current file content from GitHub
        const content = await getFileContent(ghToken, owner, repoName, file);

        for (const finding of group) {
          const pattern = patternMap.get(finding.secret_type_id);

          let status;
          if (content === null) {
            // File deleted or inaccessible — remediated
            status = 'remediated';
          } else if (pattern?.regex) {
            // Reset regex lastIndex (in case it's global/sticky)
            pattern.regex.lastIndex = 0;
            const matched = pattern.regex.test(content);
            // Reset again for next use
            pattern.regex.lastIndex = 0;
            status = matched ? 'still_present' : 'remediated';
          } else {
            status = 'error';
          }

          if (status === 'remediated') {
            remediated++;
            if (finding.status !== 'resolved') {
              await withTenant(req.user.orgId, async (client) => {
                await client.query(
                  "UPDATE findings SET status = 'resolved', resolved_by = $1, resolved_at = now() WHERE id = $2",
                  [req.user.userId, finding.id]
                );
              });
            }
          } else if (status === 'still_present') {
            stillPresent++;
            // If previously marked as resolved but secret is back, reopen it
            if (finding.status === 'resolved') {
              await withTenant(req.user.orgId, async (client) => {
                await client.query(
                  "UPDATE findings SET status = 'open', resolved_by = NULL, resolved_at = NULL WHERE id = $1",
                  [finding.id]
                );
              });
            }
          } else {
            errors++;
          }

          results.push({ findingId: finding.id, status, repo, file: finding.file, severity: finding.severity });
        }
      } catch (err) {
        errors += group.length;
        for (const finding of group) {
          results.push({ findingId: finding.id, status: 'error', error: err.message });
        }
      }
    }

    await auditLog({
      orgId: req.user.orgId, userId: req.user.userId,
      action: 'findings.validation', metadata: { total: findings.length, remediated, stillPresent, scanId },
      ipAddress: req.ip,
    });

    res.json({ total: findings.length, remediated, stillPresent, errors, results });
  } catch (err) {
    logger.error('Validate remediation error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Validation failed' });
  }
});

export default router;

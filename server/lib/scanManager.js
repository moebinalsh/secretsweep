import { withTenant, withSystemContext } from '../db/pool.js';
import { getDecryptedToken } from '../routes/github.js';
import { getOrgRepos, getUserRepos } from '../github.js';
import { scanOrg } from '../scanner.js';
import { maskSecret } from './mask.js';
import { auditLog } from './audit.js';
import { notifySlack } from './notifications.js';
import logger from '../logger.js';

const MAX_BUFFER = 500;
const CLEANUP_DELAY = 5 * 60 * 1000; // 5 minutes after completion

class ScanManager {
  constructor() {
    this.scans = new Map();
  }

  /** Mark orphaned running scans as failed on startup.
   *  Uses bare query() intentionally — this is a system-level recovery
   *  operation that runs before any user context exists. RLS does not
   *  apply to the table owner (secretsweep_app), so this is safe. */
  async init() {
    try {
      const { rows } = await withSystemContext(async (client) => {
        return client.query(
          "UPDATE scans SET status = 'failed', error_message = 'Server restarted during scan', completed_at = now() WHERE status = 'running' RETURNING id"
        );
      });
      if (rows.length > 0) {
        logger.warn(`Marked ${rows.length} orphaned scan(s) as failed: ${rows.map(r => r.id).join(', ')}`);
      }
    } catch (err) {
      logger.error('ScanManager init error:', err);
    }
  }

  /** Fire-and-forget: start a scan in the background */
  start(scanId, orgId, userId) {
    const state = {
      scanId,
      orgId,
      userId,
      cancelled: false,
      status: 'running',
      eventBuffer: [],
      eventIndex: 0,
      listeners: new Set(),
      findingCount: 0,
      promise: null,
    };

    this.scans.set(scanId, state);
    state.promise = this._runScan(state).catch(err => {
      logger.error(`ScanManager: unhandled error in scan ${scanId}:`, err);
    });
  }

  /** Signal a scan to cancel */
  cancel(scanId) {
    const state = this.scans.get(scanId);
    if (state) {
      state.cancelled = true;
    }
  }

  /** Subscribe to live events. Returns unsubscribe fn, or null if scan not in memory. */
  subscribe(scanId, fromIndex, callback) {
    const state = this.scans.get(scanId);
    if (!state) return null;

    // Replay buffered events from fromIndex
    for (const event of state.eventBuffer) {
      if (event._idx >= fromIndex) {
        callback(event);
      }
    }

    state.listeners.add(callback);
    return () => state.listeners.delete(callback);
  }

  isRunning(scanId) {
    const state = this.scans.get(scanId);
    return state?.status === 'running';
  }

  getState(scanId) {
    return this.scans.get(scanId) || null;
  }

  shutdownAll() {
    for (const [scanId, state] of this.scans) {
      if (state.status === 'running') {
        state.cancelled = true;
        logger.info(`ScanManager: cancelling scan ${scanId} for shutdown`);
      }
    }
  }

  /** Emit an event to all listeners and buffer it */
  _emit(state, event) {
    event._idx = state.eventIndex++;
    state.eventBuffer.push(event);
    if (state.eventBuffer.length > MAX_BUFFER) {
      state.eventBuffer.shift();
    }
    for (const listener of state.listeners) {
      try { listener(event); } catch {}
    }
  }

  /** Schedule cleanup of scan state after completion */
  _scheduleCleanup(scanId) {
    setTimeout(() => {
      this.scans.delete(scanId);
    }, CLEANUP_DELAY);
  }

  /** Core scan execution — runs in background */
  async _runScan(state) {
    const { scanId, orgId, userId } = state;

    try {
      // Get GitHub token
      const ghToken = await getDecryptedToken(orgId, userId);
      if (!ghToken) {
        await withTenant(orgId, async (client) => {
          await client.query(
            "UPDATE scans SET status = 'failed', error_message = 'GitHub not connected', completed_at = now() WHERE id = $1",
            [scanId]
          );
        });
        state.status = 'failed';
        this._emit(state, { type: 'error', message: 'GitHub not connected' });
        this._scheduleCleanup(scanId);
        return;
      }

      // Load scan record
      const scan = await withTenant(orgId, async (client) => {
        const { rows } = await client.query('SELECT * FROM scans WHERE id = $1', [scanId]);
        return rows[0];
      });

      if (!scan) {
        state.status = 'failed';
        this._scheduleCleanup(scanId);
        return;
      }

      // Fetch repos
      const githubOrg = scan.github_org;
      const isUserAccount = githubOrg.startsWith('__user__:');
      const displayName = isUserAccount ? githubOrg.replace('__user__:', '') : githubOrg;

      this._emit(state, { type: 'progress', message: `Fetching repositories for ${displayName}...`, phase: 'search', patternIndex: 0, totalPatterns: 1 });

      let repos = isUserAccount ? await getUserRepos(ghToken) : await getOrgRepos(ghToken, githubOrg);

      // Apply repo filter for selective scans
      if (scan.scan_mode === 'selective' && scan.repo_filter) {
        const filterSet = new Set(scan.repo_filter.map(r => r.toLowerCase()));
        repos = repos.filter(r => filterSet.has(r.name.toLowerCase()));
      }

      // Update scan with repo count
      await withTenant(orgId, async (client) => {
        await client.query('UPDATE scans SET total_repos = $1 WHERE id = $2', [repos.length, scanId]);
      });

      this._emit(state, {
        type: 'repos',
        count: repos.length,
        repos: repos.map(r => ({ name: r.name, full_name: r.full_name, html_url: r.html_url, private: r.private })),
      });

      // Run scanner
      const scanOrgName = isUserAccount ? githubOrg.replace('__user__:', '') : githubOrg;

      for await (const event of scanOrg(ghToken, scanOrgName, repos)) {
        if (state.cancelled) break;

        if (event.type === 'finding') {
          const maskedLines = (event.matchingLines || []).map(maskSecret);

          await withTenant(orgId, async (client) => {
            await client.query(
              `INSERT INTO findings (org_id, scan_id, repo, repo_url, file, file_url, line, matching_lines, secret_type, secret_type_id, severity, description)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [orgId, scanId, event.repo, event.repoUrl, event.file, event.fileUrl, event.line,
               JSON.stringify(maskedLines), event.secretType, event.secretTypeId, event.severity, event.description]
            );
          });

          state.findingCount++;
          this._emit(state, { ...event, matchingLines: maskedLines });
          // Notify Slack (fire-and-forget, don't block scan)
          notifySlack(orgId, { type: 'finding', severity: event.severity, secretType: event.secretType, repo: event.repo, file: event.file, description: event.description }).catch(() => {});
        } else if (event.type === 'enrich') {
          this._emit(state, event);
        } else if (event.type === 'complete') {
          await withTenant(orgId, async (client) => {
            await client.query(
              `UPDATE scans SET status = 'completed', completed_at = now(), total_findings = $1,
               repos_scanned = $2, summary = $3 WHERE id = $4`,
              [state.findingCount, event.totalRepos, JSON.stringify(event), scanId]
            );
          });

          await auditLog({
            orgId, userId,
            action: 'scan.completed', resource: 'scan', resourceId: scanId,
            metadata: { totalFindings: state.findingCount, totalRepos: event.totalRepos },
          });

          state.status = 'completed';
          this._emit(state, event);
          notifySlack(orgId, { type: 'complete', githubOrg: displayName, totalRepos: event.totalRepos, totalFindings: state.findingCount, reposWithFindings: event.reposWithFindings }).catch(() => {});
        } else {
          // progress, rate_limit, etc.
          this._emit(state, event);
        }
      }

      // Handle cancellation
      if (state.cancelled) {
        await withTenant(orgId, async (client) => {
          await client.query(
            "UPDATE scans SET status = 'cancelled', completed_at = now(), total_findings = $1 WHERE id = $2",
            [state.findingCount, scanId]
          );
        });
        state.status = 'cancelled';
        this._emit(state, { type: 'cancelled', message: 'Scan cancelled' });
      }
    } catch (err) {
      logger.error(`Scan ${scanId} execution error:`, err);
      state.status = 'failed';
      this._emit(state, { type: 'error', message: err.message });
      notifySlack(orgId, { type: 'failed', githubOrg: 'Unknown', message: err.message }).catch(() => {});

      try {
        await withTenant(orgId, async (client) => {
          await client.query(
            "UPDATE scans SET status = 'failed', error_message = $1, completed_at = now() WHERE id = $2",
            [err.message, scanId]
          );
        });
      } catch (dbErr) {
        logger.error(`Failed to update scan ${scanId} status:`, dbErr);
      }
    } finally {
      this._scheduleCleanup(scanId);
    }
  }
}

export const scanManager = new ScanManager();

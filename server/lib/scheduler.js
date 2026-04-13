import { withSystemContext, withTenant } from '../db/pool.js';
import { scanManager } from './scanManager.js';
import logger from '../logger.js';

const CHECK_INTERVAL = 60 * 1000; // Check every minute
let intervalId = null;

/**
 * Parse a simple cron expression and compute the next run time.
 * Supports: minute hour dayOfMonth month dayOfWeek
 * Returns a Date or null if no match in the next 7 days.
 */
function getNextRun(cronExpr, after = new Date()) {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minExpr, hourExpr, domExpr, monExpr, dowExpr] = parts;

  function matches(expr, value, max) {
    if (expr === '*') return true;
    if (expr.startsWith('*/')) {
      const step = parseInt(expr.slice(2));
      return value % step === 0;
    }
    const values = expr.split(',').map(Number);
    return values.includes(value);
  }

  // Check each minute in the next 7 days
  const candidate = new Date(after.getTime() + 60000);
  candidate.setSeconds(0, 0);

  const limit = new Date(after.getTime() + 7 * 24 * 60 * 60 * 1000);

  while (candidate < limit) {
    const min = candidate.getMinutes();
    const hour = candidate.getHours();
    const dom = candidate.getDate();
    const mon = candidate.getMonth() + 1;
    const dow = candidate.getDay(); // 0=Sun

    if (matches(minExpr, min) && matches(hourExpr, hour) &&
        matches(domExpr, dom) && matches(monExpr, mon) &&
        matches(dowExpr, dow)) {
      return candidate;
    }

    candidate.setTime(candidate.getTime() + 60000);
  }

  return null;
}

/**
 * Check for due schedules and start scans.
 */
async function checkSchedules() {
  try {
    const now = new Date();

    // Find due schedules using system context
    const schedules = await withSystemContext(async (client) => {
      const { rows } = await client.query(
        "SELECT * FROM scan_schedules WHERE is_active = true AND next_run_at IS NOT NULL AND next_run_at <= $1",
        [now]
      );
      return rows;
    });

    for (const schedule of schedules) {
      try {
        logger.info(`Scheduler: starting scan for schedule ${schedule.id} (${schedule.github_org})`);

        // Create scan record
        const scan = await withTenant(schedule.org_id, async (client) => {
          const { rows } = await client.query(
            `INSERT INTO scans (org_id, started_by, github_org, scan_mode, repo_filter)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [schedule.org_id, schedule.created_by, schedule.github_org, schedule.scan_mode, schedule.repo_filter]
          );
          return rows[0];
        });

        // Start background scan
        scanManager.start(scan.id, schedule.org_id, schedule.created_by);

        // Update schedule: set last_run_at and compute next_run_at
        const nextRun = getNextRun(schedule.cron_expression, now);
        await withTenant(schedule.org_id, async (client) => {
          await client.query(
            'UPDATE scan_schedules SET last_run_at = $1, next_run_at = $2, updated_at = now() WHERE id = $3',
            [now, nextRun, schedule.id]
          );
        });
      } catch (err) {
        logger.error(`Scheduler: failed to run schedule ${schedule.id}:`, err);
      }
    }
  } catch (err) {
    logger.error('Scheduler check error:', err);
  }
}

export function startScheduler() {
  if (intervalId) return;
  intervalId = setInterval(checkSchedules, CHECK_INTERVAL);
  logger.info('Scan scheduler started (checking every 60s)');
}

export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export { getNextRun };

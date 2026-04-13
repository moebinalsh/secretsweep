import { withTenant } from '../db/pool.js';
import { decrypt } from './crypto.js';
import logger from '../logger.js';

/**
 * Send notifications to all matching Slack integrations for an org.
 * @param {string} orgId
 * @param {object} event - { type: 'finding'|'complete'|'failed', ...data }
 */
export async function notifySlack(orgId, event) {
  try {
    const integrations = await withTenant(orgId, async (client) => {
      const { rows } = await client.query(
        "SELECT id, name, encrypted_webhook, iv, auth_tag, config FROM integrations WHERE is_active = true AND type = 'slack'"
      );
      return rows;
    });

    if (integrations.length === 0) return;

    for (const integration of integrations) {
      try {
        if (!shouldNotify(integration.config, event)) continue;

        const webhookUrl = decrypt({
          encrypted: integration.encrypted_webhook,
          iv: integration.iv,
          authTag: integration.auth_tag,
        });

        const message = formatSlackMessage(event);
        if (!message) continue;

        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          logger.warn(`Slack notification failed for integration ${integration.id}: ${res.status}`);
        }
      } catch (err) {
        logger.warn(`Slack notification error for integration ${integration.id}:`, err.message);
      }
    }
  } catch (err) {
    logger.error('notifySlack error:', err);
  }
}

/**
 * Send a test message to a specific webhook URL (not encrypted).
 */
export async function sendTestMessage(webhookUrl) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: ':white_check_mark: *SecretSweep Connected*\nThis Slack webhook is working correctly.' },
        },
      ],
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Slack returned ${res.status}: ${text}`);
  }
}

function shouldNotify(config, event) {
  if (!config) return false;

  if (event.type === 'complete' && config.onScanComplete) return true;
  if (event.type === 'failed' && config.onScanFailed) return true;
  if (event.type === 'finding' && config.onFinding) {
    const severities = config.severities || ['critical', 'high'];
    return severities.includes(event.severity);
  }

  return false;
}

function formatSlackMessage(event) {
  if (event.type === 'complete') {
    const findings = event.totalFindings || 0;
    const emoji = findings > 0 ? ':warning:' : ':white_check_mark:';
    return {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} *Scan Complete: ${event.githubOrg || 'Unknown'}*`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Repos Scanned:*\n${event.totalRepos || 0}` },
            { type: 'mrkdwn', text: `*Findings:*\n${findings}` },
          ],
        },
        ...(event.reposWithFindings > 0
          ? [{
              type: 'context',
              elements: [{ type: 'mrkdwn', text: `${event.reposWithFindings} repo(s) with findings` }],
            }]
          : []),
      ],
    };
  }

  if (event.type === 'failed') {
    return {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:x: *Scan Failed: ${event.githubOrg || 'Unknown'}*\n${event.message || 'Unknown error'}`,
          },
        },
      ],
    };
  }

  if (event.type === 'finding') {
    const severityEmoji = {
      critical: ':red_circle:',
      high: ':large_orange_circle:',
      medium: ':large_yellow_circle:',
      low: ':white_circle:',
    };
    const emoji = severityEmoji[event.severity] || ':white_circle:';

    return {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} *${event.severity?.toUpperCase()} — ${event.secretType || 'Secret Found'}*`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Repo:*\n${event.repo || 'Unknown'}` },
            { type: 'mrkdwn', text: `*File:*\n\`${event.file || 'Unknown'}\`` },
          ],
        },
        ...(event.description
          ? [{ type: 'context', elements: [{ type: 'mrkdwn', text: event.description }] }]
          : []),
      ],
    };
  }

  return null;
}

import { Router } from 'express';
import { z } from 'zod';
import { extractUser, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { withTenant } from '../db/pool.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { auditLog } from '../lib/audit.js';
import { getGitLabUser, getGitLabGroups, getGitLabGroupProjects, getGitLabUserProjects } from '../gitlab.js';
import logger from '../logger.js';

const router = Router();

/**
 * Decrypt the current user's GitLab token from DB.
 */
export async function getDecryptedGitLabToken(orgId, userId) {
  const row = await withTenant(orgId, async (client) => {
    const { rows } = await client.query(
      'SELECT encrypted_token, iv, auth_tag, gitlab_url FROM gitlab_connections WHERE user_id = $1',
      [userId]
    );
    return rows[0] || null;
  });
  if (!row) return null;
  return {
    token: decrypt({ encrypted: row.encrypted_token, iv: row.iv, authTag: row.auth_tag }),
    baseUrl: row.gitlab_url || 'https://gitlab.com',
  };
}

// ---- Connect GitLab PAT ----

const connectSchema = z.object({
  token: z.string().min(1).max(500),
  gitlabUrl: z.string().url().default('https://gitlab.com'),
});

router.post('/connect', extractUser, requireAdmin, validate(connectSchema), async (req, res) => {
  const { token, gitlabUrl } = req.validated;
  const baseUrl = gitlabUrl.replace(/\/+$/, '');

  try {
    const glUser = await getGitLabUser(token.trim(), baseUrl);
    const { encrypted, iv, authTag } = encrypt(token.trim());

    await withTenant(req.user.orgId, async (client) => {
      await client.query(
        `INSERT INTO gitlab_connections (org_id, user_id, gitlab_username, gitlab_url, encrypted_token, iv, auth_tag)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (org_id, user_id) DO UPDATE SET
           gitlab_username = EXCLUDED.gitlab_username,
           gitlab_url = EXCLUDED.gitlab_url,
           encrypted_token = EXCLUDED.encrypted_token,
           iv = EXCLUDED.iv,
           auth_tag = EXCLUDED.auth_tag,
           updated_at = now()`,
        [req.user.orgId, req.user.userId, glUser.username, baseUrl, encrypted, iv, authTag]
      );
    });

    await auditLog({
      orgId: req.user.orgId, userId: req.user.userId,
      action: 'gitlab.connected', metadata: { username: glUser.username, baseUrl }, ipAddress: req.ip,
    });

    res.json({ connected: true, username: glUser.username });
  } catch (err) {
    logger.error('GitLab connect error:', err);
    if (err.message?.includes('GitLab API error')) {
      return res.status(401).json({ error: 'Invalid GitLab token.' });
    }
    res.status(500).json({ error: 'Failed to connect GitLab' });
  }
});

// ---- Disconnect ----

router.delete('/disconnect', extractUser, requireAdmin, async (req, res) => {
  try {
    await withTenant(req.user.orgId, async (client) => {
      await client.query('DELETE FROM gitlab_connections WHERE user_id = $1', [req.user.userId]);
    });
    await auditLog({ orgId: req.user.orgId, userId: req.user.userId, action: 'gitlab.disconnected', ipAddress: req.ip });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ---- Status ----

router.get('/status', extractUser, async (req, res) => {
  try {
    const row = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query(
        'SELECT gitlab_username, gitlab_url, updated_at FROM gitlab_connections WHERE user_id = $1',
        [req.user.userId]
      );
      return rows[0] || null;
    });
    if (!row) return res.json({ connected: false });
    res.json({ connected: true, username: row.gitlab_username, baseUrl: row.gitlab_url, updatedAt: row.updated_at });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// ---- List Groups ----

router.get('/groups', extractUser, async (req, res) => {
  try {
    const creds = await getDecryptedGitLabToken(req.user.orgId, req.user.userId);
    if (!creds) return res.status(400).json({ error: 'GitLab not connected.' });
    const groups = await getGitLabGroups(creds.token, creds.baseUrl);
    res.json(groups);
  } catch (err) {
    logger.error('GitLab groups error:', err);
    res.status(500).json({ error: 'Failed to fetch GitLab groups' });
  }
});

// ---- List Projects ----

router.get('/projects/:groupId', extractUser, async (req, res) => {
  try {
    const creds = await getDecryptedGitLabToken(req.user.orgId, req.user.userId);
    if (!creds) return res.status(400).json({ error: 'GitLab not connected' });

    let projects;
    if (req.params.groupId === '__user__') {
      projects = await getGitLabUserProjects(creds.token, creds.baseUrl);
    } else {
      projects = await getGitLabGroupProjects(creds.token, req.params.groupId, creds.baseUrl);
    }
    res.json(projects);
  } catch (err) {
    logger.error('GitLab projects error:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

export default router;

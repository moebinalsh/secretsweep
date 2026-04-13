import { Router } from 'express';
import { z } from 'zod';
import { extractUser, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { withTenant } from '../db/pool.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { auditLog } from '../lib/audit.js';
import { getUser, getUserOrgs, getOrgRepos, getUserRepos, getRateLimit } from '../github.js';
import logger from '../logger.js';

const router = Router();

/**
 * Helper: decrypt the current user's GitHub token from DB.
 */
export async function getDecryptedToken(orgId, userId) {
  const row = await withTenant(orgId, async (client) => {
    const { rows } = await client.query(
      'SELECT encrypted_token, iv, auth_tag FROM github_connections WHERE user_id = $1',
      [userId]
    );
    return rows[0] || null;
  });

  if (!row) return null;
  return decrypt({ encrypted: row.encrypted_token, iv: row.iv, authTag: row.auth_tag });
}

// ---- Connect GitHub PAT ----

const connectSchema = z.object({
  token: z.string().min(1).max(500),
});

router.post('/connect', extractUser, requireAdmin, validate(connectSchema), async (req, res) => {
  const { token } = req.validated;

  try {
    // Validate token against GitHub
    const ghUser = await getUser(token.trim());

    // Encrypt token
    const { encrypted, iv, authTag } = encrypt(token.trim());

    await withTenant(req.user.orgId, async (client) => {
      // Upsert: insert or update if connection already exists
      await client.query(
        `INSERT INTO github_connections (org_id, user_id, github_username, encrypted_token, iv, auth_tag)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (org_id, user_id) DO UPDATE SET
           github_username = EXCLUDED.github_username,
           encrypted_token = EXCLUDED.encrypted_token,
           iv = EXCLUDED.iv,
           auth_tag = EXCLUDED.auth_tag,
           updated_at = now()`,
        [req.user.orgId, req.user.userId, ghUser.login, encrypted, iv, authTag]
      );
    });

    await auditLog({
      orgId: req.user.orgId, userId: req.user.userId,
      action: 'github.connected', metadata: { username: ghUser.login }, ipAddress: req.ip,
    });

    res.json({ connected: true, username: ghUser.login });
  } catch (err) {
    logger.error('GitHub connect error:', err);
    if (err.message?.includes('GitHub API error')) {
      return res.status(401).json({ error: 'Invalid GitHub token. For classic tokens: repo + read:org scopes. For fine-grained tokens: Contents + Metadata read access.' });
    }
    res.status(500).json({ error: 'Failed to connect GitHub' });
  }
});

// ---- Disconnect GitHub ----

router.delete('/disconnect', extractUser, requireAdmin, async (req, res) => {
  try {
    await withTenant(req.user.orgId, async (client) => {
      await client.query('DELETE FROM github_connections WHERE user_id = $1', [req.user.userId]);
    });

    await auditLog({
      orgId: req.user.orgId, userId: req.user.userId,
      action: 'github.disconnected', ipAddress: req.ip,
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error('GitHub disconnect error:', err);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ---- GitHub Connection Status ----

router.get('/status', extractUser, async (req, res) => {
  try {
    const row = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query(
        'SELECT github_username, scopes, updated_at FROM github_connections WHERE user_id = $1',
        [req.user.userId]
      );
      return rows[0] || null;
    });

    if (!row) {
      return res.json({ connected: false });
    }

    res.json({ connected: true, username: row.github_username, scopes: row.scopes, updatedAt: row.updated_at });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// ---- Proxy GitHub API: List Orgs ----

router.get('/orgs', extractUser, async (req, res) => {
  try {
    const token = await getDecryptedToken(req.user.orgId, req.user.userId);
    if (!token) return res.status(400).json({ error: 'GitHub not connected. Connect in Settings.' });

    const orgs = await getUserOrgs(token);
    res.json(orgs);
  } catch (err) {
    logger.error('GitHub orgs error:', err);
    res.status(500).json({ error: 'Failed to fetch GitHub organizations' });
  }
});

// ---- Proxy GitHub API: List Repos ----

router.get('/repos/:githubOrg', extractUser, async (req, res) => {
  try {
    const token = await getDecryptedToken(req.user.orgId, req.user.userId);
    if (!token) return res.status(400).json({ error: 'GitHub not connected' });

    const org = req.params.githubOrg;
    let repos;
    if (org.startsWith('__user__:')) {
      repos = await getUserRepos(token);
    } else {
      repos = await getOrgRepos(token, org);
    }
    res.json(repos);
  } catch (err) {
    logger.error('GitHub repos error:', err);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// ---- Proxy GitHub API: Rate Limit ----

router.get('/rate-limit', extractUser, async (req, res) => {
  try {
    const token = await getDecryptedToken(req.user.orgId, req.user.userId);
    if (!token) return res.status(400).json({ error: 'GitHub not connected' });

    const limit = await getRateLimit(token);
    res.json(limit);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rate limit' });
  }
});

export default router;

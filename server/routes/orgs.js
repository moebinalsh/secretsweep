import { Router } from 'express';
import { extractUser, requireAdmin } from '../middleware/auth.js';
import { withTenant } from '../db/pool.js';

const router = Router();

// ---- Get Current Org ----

router.get('/', extractUser, async (req, res) => {
  try {
    const org = await withTenant(req.user.orgId, async (client) => {
      const { rows } = await client.query(
        'SELECT id, name, slug, created_at FROM organizations WHERE id = $1',
        [req.user.orgId]
      );
      return rows[0];
    });
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json(org);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get organization' });
  }
});

export default router;

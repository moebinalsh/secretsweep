import { verifyAccessToken } from '../lib/jwt.js';

/**
 * Extract and verify JWT from Authorization header.
 * Sets req.user = { userId, orgId, role, email, isSuperAdmin }
 */
export function extractUser(req, res, next) {
  const authHeader = req.headers.authorization;
  let token;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.userId,
      orgId: payload.orgId,
      role: payload.role,
      email: payload.email,
      isSuperAdmin: payload.isSuperAdmin || false,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Require admin role. Must be used after extractUser.
 */
export function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && !req.user.isSuperAdmin)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Require super admin. Must be used after extractUser.
 */
export function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

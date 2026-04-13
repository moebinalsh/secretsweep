/**
 * Middleware to set tenant context for RLS.
 * Must be used after extractUser.
 * For routes that need automatic tenant scoping.
 */
export function setTenantContext(req, res, next) {
  if (!req.user || !req.user.orgId) {
    return res.status(401).json({ error: 'No tenant context' });
  }
  // Store orgId for use in route handlers with withTenant()
  req.orgId = req.user.orgId;
  next();
}

import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import { withSystemContext, withTenant } from '../db/pool.js';
import { signAccessToken, createRefreshToken, verifyRefreshToken, revokeRefreshToken } from '../lib/jwt.js';
import { auditLog } from '../lib/audit.js';
import { validate } from '../middleware/validate.js';
import { extractUser } from '../middleware/auth.js';
import logger from '../logger.js';

const router = Router();
const BCRYPT_ROUNDS = 12;
const REFRESH_COOKIE = 'ss_refresh';
const INVITE_EXPIRY_HOURS = 72;

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/auth',
  });
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
}

// ---- Register (create org + admin user) ----

const registerSchema = z.object({
  orgName: z.string().min(2).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128).regex(/[a-zA-Z]/, 'Must contain at least one letter').regex(/[0-9]/, 'Must contain at least one number'),
  name: z.string().min(1).max(255),
});

router.post('/register', validate(registerSchema), async (req, res) => {
  // Public registration is disabled — orgs are created by super admin
  return res.status(403).json({ error: 'Registration is invite-only. Contact your administrator.' });

  const { orgName, email, password, name } = req.validated;

  try {
    const result = await withSystemContext(async (client) => {
      // Check if email already exists
      const { rows: existing } = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (existing.length > 0) return { error: 'Email already registered', status: 409 };

      // Check if org name already taken (case-insensitive)
      const { rows: orgExists } = await client.query('SELECT id FROM organizations WHERE LOWER(name) = LOWER($1)', [orgName]);
      if (orgExists.length > 0) return { error: 'Organization name already taken', status: 409 };

      // Create org
      let slug = slugify(orgName);
      const { rows: slugCheck } = await client.query('SELECT id FROM organizations WHERE slug = $1', [slug]);
      if (slugCheck.length > 0) {
        slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
      }

      const { rows: [org] } = await client.query(
        'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id',
        [orgName, slug]
      );

      // Create admin user
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const { rows: [user] } = await client.query(
        'INSERT INTO users (org_id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [org.id, email.toLowerCase(), passwordHash, name, 'admin']
      );

      return { org, user, slug };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });

    const { org, user, slug } = result;

    const accessToken = signAccessToken({ userId: user.id, orgId: org.id, role: 'admin', email: email.toLowerCase() });
    const refreshToken = await createRefreshToken(user.id, org.id);
    setRefreshCookie(res, refreshToken);

    await auditLog({ orgId: org.id, userId: user.id, action: 'user.registered', resource: 'user', resourceId: user.id, ipAddress: req.ip });

    logger.info(`New org registered: ${orgName} (${slug})`);
    res.status(201).json({
      accessToken,
      user: { id: user.id, email: email.toLowerCase(), name, role: 'admin' },
      org: { id: org.id, name: orgName, slug },
    });
  } catch (err) {
    logger.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ---- Login ----

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.validated;

  try {
    const user = await withSystemContext(async (client) => {
      const { rows } = await client.query(
        `SELECT u.id, u.org_id, u.email, u.password_hash, u.name, u.role, u.is_active, u.is_super_admin,
                o.name as org_name, o.slug as org_slug, o.is_active as org_active
         FROM users u JOIN organizations o ON o.id = u.org_id
         WHERE u.email = $1`,
        [email.toLowerCase()]
      );
      return rows[0] || null;
    });

    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.is_active) return res.status(401).json({ error: 'Account is deactivated' });
    if (!user.org_active && !user.is_super_admin) return res.status(403).json({ error: 'Your organization has been disabled. Contact support.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const accessToken = signAccessToken({
      userId: user.id, orgId: user.org_id, role: user.role, email: user.email,
      isSuperAdmin: user.is_super_admin || false,
    });
    const refreshToken = await createRefreshToken(user.id, user.org_id);
    setRefreshCookie(res, refreshToken);

    // Update last login
    await withSystemContext(async (client) => {
      await client.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    });

    await auditLog({ orgId: user.org_id, userId: user.id, action: 'user.login', ipAddress: req.ip });

    res.json({
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, isSuperAdmin: user.is_super_admin || false },
      org: { id: user.org_id, name: user.org_name, slug: user.org_slug },
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ---- Refresh Token ----

router.post('/refresh', async (req, res) => {
  if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'Missing CSRF header' });
  }

  const oldToken = req.cookies?.[REFRESH_COOKIE];
  if (!oldToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const tokenRow = await verifyRefreshToken(oldToken);
    if (!tokenRow) {
      res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    await revokeRefreshToken(oldToken);

    // Fetch full user data for JWT
    const user = await withSystemContext(async (client) => {
      const { rows } = await client.query(
        `SELECT u.id, u.email, u.name, u.role, u.is_super_admin, o.id as org_id, o.name as org_name, o.slug as org_slug
         FROM users u JOIN organizations o ON o.id = u.org_id WHERE u.id = $1`,
        [tokenRow.user_id]
      );
      return rows[0];
    });

    const accessToken = signAccessToken({
      userId: user.id, orgId: user.org_id, role: user.role, email: user.email,
      isSuperAdmin: user.is_super_admin || false,
    });
    const newRefreshToken = await createRefreshToken(user.id, user.org_id);
    setRefreshCookie(res, newRefreshToken);

    res.json({
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, isSuperAdmin: user.is_super_admin || false },
      org: { id: user.org_id, name: user.org_name, slug: user.org_slug },
    });
  } catch (err) {
    logger.error('Refresh error:', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ---- Logout ----

router.post('/logout', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      await revokeRefreshToken(token);
    } catch { /* ignore */ }
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  res.json({ ok: true });
});

// ---- Invite User (admin only) ----

const inviteSchema = z.object({
  email: z.string().email().max(255),
  role: z.enum(['admin', 'member']).default('member'),
});

router.post('/invite', extractUser, validate(inviteSchema), async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { email, role } = req.validated;

  try {
    // Check user limit
    const { checkLimit } = await import('../lib/limits.js');
    const userLimit = await checkLimit(req.user.orgId, 'maxUsers');
    if (!userLimit.allowed) return res.status(429).json({ error: userLimit.error });

    // Use tenant context for invite operations (scoped to this org)
    const result = await withTenant(req.user.orgId, async (client) => {
      // Check for pending invite in this org
      const { rows: pendingInvites } = await client.query(
        'SELECT id FROM invitations WHERE email = $1 AND accepted_at IS NULL AND expires_at > now()',
        [email.toLowerCase()]
      );
      if (pendingInvites.length > 0) return { error: 'An invitation is already pending for this email', status: 409 };

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

      await client.query(
        'INSERT INTO invitations (org_id, email, invited_by, token, role, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [req.user.orgId, email.toLowerCase(), req.user.userId, token, role, expiresAt]
      );

      return { token };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });

    // Check if email exists globally (system context needed — cross-org check)
    const emailExists = await withSystemContext(async (client) => {
      const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      return rows.length > 0;
    });
    if (emailExists) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    await auditLog({
      orgId: req.user.orgId, userId: req.user.userId,
      action: 'user.invited', metadata: { email: email.toLowerCase(), role }, ipAddress: req.ip,
    });

    const inviteUrl = `/invite/${result.token}`;
    res.status(201).json({ message: 'Invitation created', inviteUrl, token: result.token });
  } catch (err) {
    logger.error('Invite error:', err);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

// ---- Accept Invite ----

const acceptInviteSchema = z.object({
  token: z.string().length(64),
  password: z.string().min(8).max(128).regex(/[a-zA-Z]/, 'Must contain at least one letter').regex(/[0-9]/, 'Must contain at least one number'),
  name: z.string().min(1).max(255),
});

router.post('/accept-invite', validate(acceptInviteSchema), async (req, res) => {
  const { token, password, name } = req.validated;

  try {
    const result = await withSystemContext(async (client) => {
      const { rows } = await client.query(
        `SELECT i.*, o.name as org_name, o.slug as org_slug
         FROM invitations i JOIN organizations o ON o.id = i.org_id
         WHERE i.token = $1`,
        [token]
      );

      if (rows.length === 0) return { error: 'Invalid invitation', status: 404 };

      const invite = rows[0];
      if (invite.accepted_at) return { error: 'Invitation already used', status: 400 };
      if (new Date(invite.expires_at) < new Date()) return { error: 'Invitation has expired', status: 400 };

      // Check email not already registered
      const { rows: existing } = await client.query('SELECT id FROM users WHERE email = $1', [invite.email]);
      if (existing.length > 0) return { error: 'Email already registered', status: 409 };

      // Create user
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const { rows: [user] } = await client.query(
        'INSERT INTO users (org_id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [invite.org_id, invite.email, passwordHash, name, invite.role]
      );

      // Mark invite as accepted
      await client.query('UPDATE invitations SET accepted_at = now() WHERE id = $1', [invite.id]);

      return { invite, user };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });

    const { invite, user } = result;

    const accessToken = signAccessToken({ userId: user.id, orgId: invite.org_id, role: invite.role, email: invite.email });
    const refreshToken = await createRefreshToken(user.id, invite.org_id);
    setRefreshCookie(res, refreshToken);

    await auditLog({ orgId: invite.org_id, userId: user.id, action: 'user.registered', metadata: { via: 'invite' }, ipAddress: req.ip });

    res.status(201).json({
      accessToken,
      user: { id: user.id, email: invite.email, name, role: invite.role },
      org: { id: invite.org_id, name: invite.org_name, slug: invite.org_slug },
    });
  } catch (err) {
    logger.error('Accept invite error:', err);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// ---- Get invite info (for the accept-invite page) ----

router.get('/invite/:token', async (req, res) => {
  try {
    const invite = await withSystemContext(async (client) => {
      const { rows } = await client.query(
        `SELECT i.email, i.expires_at, i.accepted_at, o.name as org_name
         FROM invitations i JOIN organizations o ON o.id = i.org_id
         WHERE i.token = $1`,
        [req.params.token]
      );
      return rows[0] || null;
    });

    if (!invite) return res.status(404).json({ error: 'Invalid invitation' });
    if (invite.accepted_at) return res.status(400).json({ error: 'Invitation already used' });
    if (new Date(invite.expires_at) < new Date()) return res.status(400).json({ error: 'Invitation expired' });

    res.json({ email: invite.email, orgName: invite.org_name });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invitation' });
  }
});

export default router;

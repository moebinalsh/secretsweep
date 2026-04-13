import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { withSystemContext } from '../db/pool.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.SESSION_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.SESSION_SECRET;
const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY_DAYS = 7;

/**
 * Sign a short-lived access token.
 */
export function signAccessToken({ userId, orgId, role, email, isSuperAdmin }) {
  return jwt.sign({ userId, orgId, role, email, ...(isSuperAdmin ? { isSuperAdmin: true } : {}) }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
}

/**
 * Verify an access token. Returns payload or throws.
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/**
 * Create a refresh token: generate random bytes, hash for storage, persist to DB.
 * Returns the raw token (to send to client).
 */
export async function createRefreshToken(userId, orgId) {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await withSystemContext(async (client) => {
    await client.query(
      'INSERT INTO refresh_tokens (user_id, org_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [userId, orgId, tokenHash, expiresAt]
    );
  });

  return rawToken;
}

/**
 * Verify a refresh token: hash it, look up in DB, check expiry/revocation.
 * Returns the DB row or null.
 */
export async function verifyRefreshToken(rawToken) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return withSystemContext(async (client) => {
    const { rows } = await client.query(
      'SELECT rt.*, u.org_id, u.role, u.email, u.is_active FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = $1',
      [tokenHash]
    );

    if (rows.length === 0) return null;
    const row = rows[0];

    if (row.revoked_at) return null;
    if (new Date(row.expires_at) < new Date()) return null;
    if (!row.is_active) return null;

    return row;
  });
}

/**
 * Revoke a refresh token by hash.
 */
export async function revokeRefreshToken(rawToken) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await withSystemContext(async (client) => {
    await client.query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1',
      [tokenHash]
    );
  });
}

/**
 * Revoke all refresh tokens for a user.
 */
export async function revokeAllUserTokens(userId) {
  await withSystemContext(async (client) => {
    await client.query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
  });
}

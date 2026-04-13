import pg from 'pg';
import logger from '../logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected pool error:', err);
});

/**
 * Execute a callback within a tenant-scoped transaction.
 * Sets RLS context so queries only see rows for this org.
 * This is the ONLY way application code should access tenant data.
 */
export async function withTenant(orgId, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_org_id', orgId]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute a callback with system-level access (bypasses tenant RLS).
 * ONLY for auth operations (login, register, token refresh) and
 * system recovery (orphaned scan cleanup on startup).
 * Sets app.system_context = 'true' which activates the system bypass policies.
 */
export async function withSystemContext(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.system_context', 'true']);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute a callback with super admin access (bypasses ALL tenant RLS).
 * For super admin panel operations that need to see/manage all orgs.
 */
export async function withSuperAdminContext(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.is_super_admin', 'true']);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * @deprecated Use withTenant() for tenant data or withSystemContext() for auth/system ops.
 * This is only kept for the migration runner which needs raw access.
 */
export async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Get a raw client for manual transaction management.
 */
export async function getClient() {
  return pool.connect();
}

export default pool;

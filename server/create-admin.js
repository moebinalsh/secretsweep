#!/usr/bin/env node
/**
 * Create a super admin account interactively.
 * Usage: node server/create-admin.js
 *
 * Prompts for email and password — nothing stored in config files.
 */
import 'dotenv/config';
import readline from 'readline';
import bcrypt from 'bcrypt';
import { withSystemContext } from './db/pool.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  console.log('\n  SecretSweep — Create Super Admin\n');

  const email = (await ask('  Email: ')).trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.error('  Invalid email.');
    process.exit(1);
  }

  const name = (await ask('  Name: ')).trim() || 'Super Admin';

  // Read password without echoing (basic approach for Node)
  const password = (await ask('  Password (min 8 chars): ')).trim();
  if (password.length < 8) {
    console.error('  Password must be at least 8 characters.');
    process.exit(1);
  }

  const confirm = (await ask('  Confirm password: ')).trim();
  if (password !== confirm) {
    console.error('  Passwords do not match.');
    process.exit(1);
  }

  rl.close();

  try {
    await withSystemContext(async (client) => {
      // Check if already exists
      const { rows: existing } = await client.query('SELECT id, is_super_admin FROM users WHERE email = $1', [email]);
      if (existing.length > 0) {
        if (existing[0].is_super_admin) {
          console.log(`\n  Super admin already exists: ${email}`);
          console.log('  Updating password...');
          const hash = await bcrypt.hash(password, 12);
          await client.query('UPDATE users SET password_hash = $1, name = $2 WHERE email = $3', [hash, name, email]);
          console.log('  Password updated.\n');
          return;
        }
        const promote = (await ask(`\n  User ${email} exists. Promote to super admin? (y/n): `)).trim().toLowerCase();
        if (promote === 'y') {
          const hash = await bcrypt.hash(password, 12);
          await client.query('UPDATE users SET is_super_admin = true, is_active = true, password_hash = $1, name = $2 WHERE email = $3', [hash, name, email]);
          console.log('  Promoted to super admin with new password.\n');
          return;
        }
        console.log('  Aborted.\n');
        process.exit(0);
      }

      // Create or find system org
      const { rows: sysOrg } = await client.query("SELECT id FROM organizations WHERE slug = '__system__'");
      let sysOrgId;
      if (sysOrg.length > 0) {
        sysOrgId = sysOrg[0].id;
      } else {
        const { rows: [newOrg] } = await client.query(
          "INSERT INTO organizations (name, slug) VALUES ('System', '__system__') RETURNING id"
        );
        sysOrgId = newOrg.id;
      }

      // Create super admin
      const hash = await bcrypt.hash(password, 12);
      await client.query(
        'INSERT INTO users (org_id, email, password_hash, name, role, is_super_admin) VALUES ($1, $2, $3, $4, $5, $6)',
        [sysOrgId, email, hash, name, 'admin', true]
      );

      console.log(`\n  Super admin created: ${email}`);
      console.log('  You can now log in at /login\n');
    });
  } catch (err) {
    console.error('\n  Error:', err.message);
    process.exit(1);
  }

  process.exit(0);
}

main();

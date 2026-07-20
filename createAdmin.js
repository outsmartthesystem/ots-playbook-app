'use strict';
// Create (or update the password of) the single admin, Jay, from ADMIN_* env vars.
// Script-only, never a public signup route (plan 5.1.4 / 6.4).
require('dotenv').config();
const { query } = require('./lib/db');
const { hashPassword } = require('./lib/auth');
const migrate = require('./migrate');

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const name = process.env.ADMIN_NAME || 'Jay';
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env, then rerun.');
    process.exit(1);
  }
  await migrate();
  const hash = await hashPassword(password);
  const { rows } = await query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (rows[0]) {
    await query(
      `UPDATE users SET password_hash = $1, role = 'admin', first_name = $2,
              account_state = 'active', token_version = token_version + 1, deleted_at = NULL
        WHERE email = $3`,
      [hash, name, email]
    );
    console.log(`[createAdmin] updated admin ${email} (sessions revoked).`);
  } else {
    await query(
      `INSERT INTO users (role, email, password_hash, first_name, account_state, has_onboarded)
       VALUES ('admin', $1, $2, $3, 'active', TRUE)`,
      [email, hash, name]
    );
    console.log(`[createAdmin] created admin ${email}.`);
  }
  process.exit(0);
}

main().catch((err) => { console.error('[createAdmin] FAILED', err); process.exit(1); });

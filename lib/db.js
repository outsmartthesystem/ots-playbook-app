'use strict';
// Single Postgres pool for the app. Mirrors the outsmart-app house pattern.
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString && process.env.NODE_ENV !== 'test') {
  console.warn('[db] DATABASE_URL is not set. Set it in .env before running migrate/server.');
}

const pool = new Pool({
  connectionString,
  // Render Postgres needs SSL in production; local usually does not.
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[db] idle client error', err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

// Run fn inside a transaction. Rolls back on throw.
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* noop */ }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, tx };

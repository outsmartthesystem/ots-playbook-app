'use strict';
// Auth: bcrypt password hashing, HS256 7-day JWT with token_version revocation,
// and a per-request DB re-check so the DB is the source of truth for role and
// account state (plan 6.2). Deleted or paused accounts and bumped token_versions
// drop live sessions immediately.
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET is required in production.');
}
const SECRET = JWT_SECRET || 'dev-only-insecure-secret-change-me';
const TOKEN_TTL = '7d';
const BCRYPT_ROUNDS = 12;

async function hashPassword(pw) {
  return bcrypt.hash(pw, BCRYPT_ROUNDS);
}
async function verifyPassword(pw, hash) {
  if (!hash) return false;
  return bcrypt.compare(pw, hash);
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, tv: user.token_version },
    SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Per-request re-check. Loads the user fresh, trusts the DB over the token.
async function loadUserFromToken(token) {
  let payload;
  try { payload = jwt.verify(token, SECRET); } catch (_) { return null; }
  const { rows } = await query(
    `SELECT id, role, email, username, first_name, last_initial, is_adult_student,
            token_version, has_onboarded, account_state, review_day, call_group,
            deleted_at
       FROM users WHERE id = $1`,
    [payload.id]
  );
  const u = rows[0];
  if (!u) return null;
  if (u.deleted_at) return null;
  if (u.token_version !== payload.tv) return null;      // revoked
  if (u.account_state === 'closed') return null;
  return u;
}

// Express middleware. Optional=true attaches req.user if present but never 401s.
function authRequired(optional = false) {
  return async (req, res, next) => {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) {
      if (optional) return next();
      return res.status(401).json({ error: 'not authenticated' });
    }
    try {
      const user = await loadUserFromToken(token);
      if (!user) {
        if (optional) return next();
        return res.status(401).json({ error: 'session invalid' });
      }
      req.user = user;
      next();
    } catch (err) {
      console.error('[auth] loadUser error', err.message);
      res.status(500).json({ error: 'auth check failed' });
    }
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    // A paused account is read-only (plan 5.1.6): block writes.
    if (req.user.account_state === 'paused' && req.method !== 'GET') {
      return res.status(403).json({ error: 'account paused: read-only access' });
    }
    next();
  };
}

// parentOf: verify an active family link before a parent reads a student's data.
async function parentOf(parentId, studentId) {
  const { rows } = await query(
    `SELECT 1 FROM family_links
      WHERE parent_id = $1 AND student_id = $2 AND status = 'active' LIMIT 1`,
    [parentId, studentId]
  );
  return rows.length > 0;
}

// Simple in-memory login rate limiter (per IP+identifier). Good enough for a
// single web dyno; a shared store is a later concern. Copies outsmart-app intent.
const attempts = new Map();
function loginRateLimit(maxPerWindow = 8, windowMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    const key = `${req.ip}:${(req.body && (req.body.email || req.body.username)) || ''}`.toLowerCase();
    const now = Date.now();
    const rec = attempts.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > rec.resetAt) { rec.count = 0; rec.resetAt = now + windowMs; }
    rec.count += 1;
    attempts.set(key, rec);
    if (rec.count > maxPerWindow) {
      return res.status(429).json({ error: 'too many attempts, wait a few minutes' });
    }
    next();
  };
}

module.exports = {
  hashPassword, verifyPassword, signToken, randomToken, hashToken,
  loadUserFromToken, authRequired, requireRole, parentOf, loginRateLimit,
};

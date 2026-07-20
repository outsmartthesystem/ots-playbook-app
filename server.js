'use strict';
require('dotenv').config();
const path = require('path');
const express = require('express');
const compression = require('compression');
const cors = require('cors');

const fs = require('fs');
const crypto = require('crypto');
const { query, tx } = require('./lib/db');
const migrate = require('./migrate');
const artifacts = require('./lib/artifacts');
const family = require('./lib/family');
const {
  hashPassword, verifyPassword, signToken, randomToken, hashToken,
  authRequired, requireRole, loginRateLimit, parentOf,
} = require('./lib/auth');

function nonEmpty(v) { return v != null && String(v).trim() !== ''; }

// The starter publish gate: the 00 non-negotiables (plan 4.4). Swapped for the
// student's own rules-file definition after chapter 11.
const GATE_DEFINITION = [
  { q: 'Nothing here is fabricated: no made-up numbers, quotes, reviews, or results.' },
  { q: 'Every claim is something I can prove. Anything I cannot prove is flagged "verify before publishing".' },
  { q: 'No fake scarcity and no fake urgency. Any limit or deadline is real and I will honor it.' },
  { q: 'Education, not advice. No income promises and no promised results.' },
  { q: 'Consent: any real person in this has given permission (a parent too if they are under 18).' },
  { q: 'A trusted adult is in the loop for anything with money or accounts.' },
];

async function notify(userId, kind, body, link) {
  try { await query(`INSERT INTO notifications (user_id, kind, body, link) VALUES ($1,$2,$3,$4)`, [userId, kind, body, link || null]); }
  catch (err) { console.error('[notify] failed', err.message); }
}

const app = express();
app.set('trust proxy', 1);
app.use(compression());
app.use(cors());
// Stripe needs the RAW body for signature verification, so mount it BEFORE express.json().
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '256kb' }));

const LAUNCH_MODE = process.env.LAUNCH_MODE || 'preview';
const QUESTIONS_ENABLED = process.env.QUESTIONS_ENABLED === '1';
const COUNSEL_KEYS = ['COUNSEL_SIGNOFF_TOS', 'COUNSEL_SIGNOFF_PRIVACY', 'COUNSEL_SIGNOFF_MESSAGING', 'COUNSEL_SIGNOFF_REPORTING'];

// small async wrapper (express 5 also catches, but explicit is clearer)
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function logEvent({ student_id = null, actor_id = null, type, entity_type = null, entity_id = null, detail = {} }) {
  try {
    await query(
      `INSERT INTO events (student_id, actor_id, type, entity_type, entity_id, detail) VALUES ($1,$2,$3,$4,$5,$6)`,
      [student_id, actor_id, type, entity_type, entity_id, JSON.stringify(detail)]
    );
  } catch (err) { console.error('[events] write failed', err.message); }
}

function publicUser(u) {
  return {
    id: u.id, role: u.role, email: u.email, username: u.username,
    first_name: u.first_name, last_initial: u.last_initial,
    has_onboarded: u.has_onboarded, account_state: u.account_state,
    is_adult_student: u.is_adult_student, review_day: u.review_day, call_group: u.call_group,
    link_pending: u.link_pending || false,
  };
}

// ---------- health / version (plan 5.6 counsel gate) ----------
app.get('/health', h(async (req, res) => {
  const missingCounsel = LAUNCH_MODE === 'production' ? COUNSEL_KEYS.filter((k) => !process.env[k]) : [];
  // backup-responder health gate (plan 5.2.6 / 6.6): production needs a responder AND a backup
  const missingResponders = LAUNCH_MODE === 'production' ? ['SAFETY_ALERT_TO', 'SAFETY_ALERT_BACKUP_TO'].filter((k) => !process.env[k]) : [];
  const missingStripe = LAUNCH_MODE === 'production' && !process.env.STRIPE_WEBHOOK_SECRET ? ['STRIPE_WEBHOOK_SECRET'] : [];
  const ready = missingCounsel.length === 0 && missingResponders.length === 0 && missingStripe.length === 0;
  let db = 'unknown';
  try { await query('SELECT 1'); db = 'ok'; } catch (_) { db = 'error'; }
  res.status(ready && db === 'ok' ? 200 : 503).json({
    ready: ready && db === 'ok',
    launch_mode: LAUNCH_MODE,
    questions_enabled: QUESTIONS_ENABLED,
    counsel_signoff_complete: missingCounsel.length === 0,
    missing_counsel_signoffs: missingCounsel,
    missing_responders: missingResponders,
    missing_stripe: missingStripe,
    db,
  });
}));

app.get('/version', (req, res) => {
  res.json({ app: 'ots-playbook-app', phase: 'P3b', launch_mode: LAUNCH_MODE });
});

// ---------- auth ----------
app.post('/api/login', loginRateLimit(), h(async (req, res) => {
  const { email, username, password } = req.body || {};
  if ((!email && !username) || !password) return res.status(400).json({ error: 'email or username and password required' });
  const { rows } = await query(
    `SELECT * FROM users WHERE (email = $1 OR username = $2) AND deleted_at IS NULL LIMIT 1`,
    [email || null, username || null]
  );
  const u = rows[0];
  if (!u || !(await verifyPassword(password, u.password_hash))) {
    return res.status(401).json({ error: 'wrong email/username or password' });
  }
  if (u.account_state === 'closed') return res.status(403).json({ error: 'account closed' });
  await logEvent({ student_id: u.role === 'student' ? u.id : null, actor_id: u.id, type: 'login' });
  res.json({ token: signToken(u), user: publicUser(u) });
}));

// teen claims a student account with the single-use link (plan 6.4). Reuse -> 410.
app.post('/api/claim', h(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'token and password required' });
  if (String(password).length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
  const th = hashToken(token);
  const { rows } = await query(`SELECT * FROM invites WHERE token_hash = $1 AND kind = 'student_claim' LIMIT 1`, [th]);
  const inv = rows[0];
  if (!inv) return res.status(404).json({ error: 'claim link not found' });
  if (inv.used_at) return res.status(410).json({ error: 'this link was already used' });
  if (new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: 'this link expired' });
  const hash = await hashPassword(password);
  await query(
    `UPDATE users SET password_hash = $1, account_state = 'active', token_version = token_version + 1 WHERE id = $2`,
    [hash, inv.target_user_id]
  );
  await query(`UPDATE invites SET used_at = now() WHERE id = $1`, [inv.id]);
  const { rows: urows } = await query(`SELECT * FROM users WHERE id = $1`, [inv.target_user_id]);
  const u = urows[0];
  await logEvent({ student_id: u.id, actor_id: u.id, type: 'account_claimed' });
  res.json({ token: signToken(u), user: publicUser(u) });
}));

app.get('/api/me', authRequired(), h(async (req, res) => {
  res.json({ user: publicUser(req.user) });
}));

// ---------- content (any authenticated user may read the playbook) ----------
app.get('/api/chapters', authRequired(), h(async (req, res) => {
  const { rows } = await query(
    `SELECT stable_key, number, title, walk_away, rough_time, congrats_video_url
       FROM chapters WHERE is_active ORDER BY number`
  );
  res.json({ chapters: rows });
}));

app.get('/api/chapters/:key', authRequired(), h(async (req, res) => {
  const { rows: cr } = await query(`SELECT * FROM chapters WHERE stable_key = $1 AND is_active`, [req.params.key]);
  const ch = cr[0];
  if (!ch) return res.status(404).json({ error: 'chapter not found' });
  const { rows: steps } = await query(
    `SELECT stable_key, position, title, kind FROM steps WHERE chapter_id = $1 AND is_active ORDER BY position`,
    [ch.id]
  );
  const { rows: checklist } = await query(
    `SELECT stable_key, position, text FROM checklist_items WHERE chapter_id = $1 ORDER BY position`, [ch.id]
  );
  // merge student progress if the caller is a student
  let progress = {};
  if (req.user.role === 'student') {
    const { rows: pr } = await query(
      `SELECT s.stable_key, p.status FROM progress p JOIN steps s ON s.id = p.step_id WHERE p.student_id = $1`,
      [req.user.id]
    );
    progress = Object.fromEntries(pr.map((r) => [r.stable_key, r.status]));
  }
  res.json({ chapter: {
    stable_key: ch.stable_key, number: ch.number, title: ch.title,
    walk_away: ch.walk_away, rough_time: ch.rough_time,
    congrats_video_url: ch.congrats_video_url, body_sections: ch.body_sections,
  }, steps: steps.map((s) => ({ ...s, status: progress[s.stable_key] || 'not_started' })), checklist });
}));

app.get('/api/steps/:key', authRequired(), h(async (req, res) => {
  const { rows } = await query(
    `SELECT st.*, ch.stable_key AS chapter_key, ch.number AS chapter_number, ch.title AS chapter_title
       FROM steps st JOIN chapters ch ON ch.id = st.chapter_id WHERE st.stable_key = $1 AND st.is_active`,
    [req.params.key]
  );
  const step = rows[0];
  if (!step) return res.status(404).json({ error: 'step not found' });
  const { rows: templates } = await query(
    `SELECT stable_key, title, body, body_form, is_worksheet FROM templates WHERE step_id = $1 OR stable_key LIKE $2`,
    [step.id, `${step.chapter_key}/template/%`]
  );
  let progress = null;
  if (req.user.role === 'student') {
    const { rows: pr } = await query(`SELECT status, done_note, parked_reason FROM progress WHERE student_id = $1 AND step_id = $2`, [req.user.id, step.id]);
    progress = pr[0] || { status: 'not_started' };
    if (progress.status === 'not_started') {
      await query(
        `INSERT INTO progress (student_id, step_id, status) VALUES ($1,$2,'in_progress')
         ON CONFLICT (student_id, step_id) DO NOTHING`, [req.user.id, step.id]
      );
    }
  }
  res.json({ step: {
    stable_key: step.stable_key, position: step.position, title: step.title, kind: step.kind,
    teach_md: step.teach_md, jay_md: step.jay_md, now_you_md: step.now_you_md,
    chapter_key: step.chapter_key, chapter_number: step.chapter_number, chapter_title: step.chapter_title,
  }, templates, progress });
}));

// ---------- progress (students only) ----------
async function stepByKey(key) {
  const { rows } = await query(`SELECT id, stable_key FROM steps WHERE stable_key = $1 AND is_active`, [key]);
  return rows[0];
}

// P0: every step completes via a required done-note (plan P0 ruling).
app.post('/api/steps/:key/done', authRequired(), requireRole('student'), h(async (req, res) => {
  const note = (req.body && req.body.done_note || '').trim();
  if (!note) return res.status(400).json({ error: 'Write one sentence: what did you actually do?' });
  const step = await stepByKey(req.params.key);
  if (!step) return res.status(404).json({ error: 'step not found' });
  await query(
    `INSERT INTO progress (student_id, step_id, status, done_note, done_at)
     VALUES ($1,$2,'done',$3, now())
     ON CONFLICT (student_id, step_id) DO UPDATE SET status='done', done_note=$3, done_at=now(), parked_reason=NULL, updated_at=now()`,
    [req.user.id, step.id, note]
  );
  await logEvent({ student_id: req.user.id, actor_id: req.user.id, type: 'step_done', entity_type: 'step', entity_id: step.id, detail: { stable_key: step.stable_key } });
  res.json({ ok: true, status: 'done' });
}));

app.post('/api/steps/:key/park', authRequired(), requireRole('student'), h(async (req, res) => {
  const reason = (req.body && req.body.parked_reason || '').trim();
  if (!reason) return res.status(400).json({ error: 'A parked step needs a reason. What is blocking you?' });
  const step = await stepByKey(req.params.key);
  if (!step) return res.status(404).json({ error: 'step not found' });
  await query(
    `INSERT INTO progress (student_id, step_id, status, parked_reason)
     VALUES ($1,$2,'parked',$3)
     ON CONFLICT (student_id, step_id) DO UPDATE SET status='parked', parked_reason=$3, updated_at=now()`,
    [req.user.id, step.id, reason]
  );
  await logEvent({ student_id: req.user.id, actor_id: req.user.id, type: 'step_parked', entity_type: 'step', entity_id: step.id, detail: { stable_key: step.stable_key, reason } });
  res.json({ ok: true, status: 'parked' });
}));

// "You are here" + next move. Progression is ARTIFACT-gated (plan 4.3): a chapter
// is complete when its core artifact is submitted, not when its steps are ticked.
app.get('/api/me/next', authRequired(), requireRole('student'), h(async (req, res) => {
  const chapterKind = {};
  for (const [kind, cfg] of Object.entries(artifacts.KINDS)) chapterKind[cfg.chapter] = kind;
  const { rows: arts } = await query(`SELECT kind, status FROM artifacts WHERE student_id = $1`, [req.user.id]);
  const statusByKind = Object.fromEntries(arts.map((a) => [a.kind, a.status]));
  const { rows: chapters } = await query(`SELECT id, number, title, stable_key FROM chapters WHERE number >= 1 AND is_active ORDER BY number`);
  let next = null;
  for (const ch of chapters) {
    const kind = chapterKind[ch.number];
    const aStatus = statusByKind[kind] || 'not_started';
    if (aStatus === 'submitted' || aStatus === 'verified') continue; // chapter done, advance
    const { rows: steps } = await query(
      `SELECT st.stable_key, st.title, st.kind, COALESCE(p.status,'not_started') AS status
         FROM steps st LEFT JOIN progress p ON p.step_id = st.id AND p.student_id = $1
        WHERE st.chapter_id = $2 AND st.is_active ORDER BY st.position`, [req.user.id, ch.id]
    );
    const pending = steps.find((s) => s.status !== 'done' && s.status !== 'parked');
    if (pending) {
      next = { move_type: 'step', stable_key: pending.stable_key, title: pending.title, kind: pending.kind,
        chapter_key: ch.stable_key, number: ch.number, chapter_title: ch.title };
    } else {
      next = { move_type: 'artifact', kind, title: 'Finish and submit your ' + kind.replace(/_/g, ' '),
        chapter_key: ch.stable_key, number: ch.number, chapter_title: ch.title };
    }
    break;
  }
  const { rows: counts } = await query(
    `SELECT COUNT(*) FILTER (WHERE status='done') AS done, COUNT(*) FILTER (WHERE status='parked') AS parked
       FROM progress WHERE student_id = $1`, [req.user.id]
  );
  res.json({ next, done: Number(counts[0].done), parked: Number(counts[0].parked) });
}));

// ---------- admin ----------
app.get('/api/admin/students', authRequired(), requireRole('admin'), h(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.first_name, u.last_initial, u.username, u.account_state,
            (SELECT MAX(created_at) FROM events   WHERE student_id = u.id) AS last_activity,
            (SELECT COUNT(*) FROM progress WHERE student_id = u.id AND status='done')   AS steps_done,
            (SELECT COUNT(*) FROM progress WHERE student_id = u.id AND status='parked') AS steps_parked
       FROM users u
      WHERE u.role = 'student' AND u.deleted_at IS NULL
      ORDER BY last_activity DESC NULLS LAST`
  );
  res.json({ students: rows });
}));

app.get('/api/admin/students/:id', authRequired(), requireRole('admin'), h(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { rows: u } = await query(`SELECT * FROM users WHERE id = $1 AND role='student'`, [id]);
  if (!u[0]) return res.status(404).json({ error: 'student not found' });
  const { rows: timeline } = await query(
    `SELECT s.stable_key, s.title, s.kind, ch.number AS chapter_number, p.status, p.done_note, p.parked_reason, p.done_at, p.updated_at
       FROM progress p JOIN steps s ON s.id = p.step_id JOIN chapters ch ON ch.id = s.chapter_id
      WHERE p.student_id = $1 ORDER BY p.updated_at DESC`, [id]
  );
  res.json({ student: publicUser(u[0]), timeline });
}));

// P0 demo: admin creates a bare student + single-use claim link (is_adult_student TRUE per P0 ruling).
app.post('/api/admin/students', authRequired(), requireRole('admin'), h(async (req, res) => {
  const first = (req.body && req.body.first_name || '').trim();
  const username = (req.body && req.body.username || '').trim() || null;
  if (!first) return res.status(400).json({ error: 'first_name required' });
  const { rows } = await query(
    `INSERT INTO users (role, first_name, username, is_adult_student, account_state)
     VALUES ('student', $1, $2, TRUE, 'created') RETURNING *`,
    [first, username]
  );
  const student = rows[0];
  const token = randomToken();
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await query(
    `INSERT INTO invites (kind, token_hash, target_user_id, expires_at) VALUES ('student_claim', $1, $2, $3)`,
    [hashToken(token), student.id, expires]
  );
  await query(`INSERT INTO admin_audit_log (actor_id, action, detail) VALUES ($1,'create_student',$2)`,
    [req.user.id, JSON.stringify({ student_id: student.id })]);
  const base = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  res.json({ student: publicUser(student), claim_url: `${base}/#/claim/${token}` });
}));

// ---------- P1: the Business Binder (students) ----------
// short "what Jay is checking for" text per artifact, shown in his review pane (plan 3.3 / P1 task 6)
const ACCEPTANCE_PROOFS = {
  voc_sheet: 'Every quote is a real sentence in the right bucket. All six buckets have at least one. Consent recorded per interview.',
  brandscript: 'Each problem points at one of the student\'s own VoC quotes, or is honestly flagged "no source yet". The one-liner is clear.',
  offer_truth_file: 'The price is real (not $0). The refund promise is specific. Every allowed claim has a proof source.',
  no_brainer_stack: 'Every stack value is defensible with a written "why". No fabricated or inflated numbers. The guarantee promises no results it cannot control.',
};

// read-only: returns the row or null. Never writes (safe for GET and paused accounts).
async function getArtifactRow(studentId, kind) {
  const { rows } = await query(`SELECT * FROM artifacts WHERE student_id = $1 AND kind = $2`, [studentId, kind]);
  return rows[0] || null;
}

// write path only: create the artifact + version 1 atomically, race-safe on UNIQUE(student_id, kind).
async function getOrCreateArtifact(studentId, kind) {
  const cfg = artifacts.getKind(kind);
  if (!cfg) return null;
  const existing = await getArtifactRow(studentId, kind);
  if (existing) return existing;
  return tx(async (client) => {
    const { rows: ch } = await client.query(`SELECT id FROM chapters WHERE number = $1`, [cfg.chapter]);
    const chapterId = ch[0] ? ch[0].id : null;
    const data = cfg.defaultData();
    const ins = await client.query(
      `INSERT INTO artifacts (student_id, chapter_id, kind, data, status) VALUES ($1,$2,$3,$4,'draft')
       ON CONFLICT (student_id, kind) DO NOTHING RETURNING *`,
      [studentId, chapterId, kind, JSON.stringify(data)]
    );
    if (ins.rows[0]) {
      await client.query(
        `INSERT INTO artifact_versions (artifact_id, version, data, status_at_save, edited_by) VALUES ($1,1,$2,'draft',$3)`,
        [ins.rows[0].id, JSON.stringify(data), studentId]
      );
      return ins.rows[0];
    }
    const { rows } = await client.query(`SELECT * FROM artifacts WHERE student_id = $1 AND kind = $2`, [studentId, kind]);
    return rows[0];
  });
}

// lock the artifact row inside a tx and return the next version number
async function claimNextVersion(client, artifactId) {
  const { rows } = await client.query(`SELECT current_version FROM artifacts WHERE id = $1 FOR UPDATE`, [artifactId]);
  return (rows[0] ? rows[0].current_version : 0) + 1;
}

function kindConfigPublic(kind) {
  const cfg = artifacts.getKind(kind);
  return cfg && {
    kind, chapter: cfg.chapter, editor: cfg.editor,
    guided_sections: cfg.guided_sections || null, load_bearing: cfg.load_bearing,
  };
}

// the binder: all 12 documents with status (created or not)
app.get('/api/me/binder', authRequired(), requireRole('student'), h(async (req, res) => {
  const { rows } = await query(
    `SELECT kind, status, current_version, open_flag_count, updated_at, submitted_at FROM artifacts WHERE student_id = $1`,
    [req.user.id]
  );
  const byKind = Object.fromEntries(rows.map((r) => [r.kind, r]));
  const binder = Object.keys(artifacts.KINDS)
    .map((kind) => ({ ...kindConfigPublic(kind), ...(byKind[kind] || { status: 'not_started', open_flag_count: 0 }) }))
    .sort((a, b) => a.chapter - b.chapter);
  res.json({ binder });
}));

// the feeds picker: the student's own VoC quotes, for BrandScript source refs
app.get('/api/me/quotes', authRequired(), requireRole('student'), h(async (req, res) => {
  const { rows } = await query(`SELECT data FROM artifacts WHERE student_id = $1 AND kind = 'voc_sheet'`, [req.user.id]);
  const quotes = (rows[0] && rows[0].data.quotes || []).map((q, i) => ({ ref: `voc:${i}`, bucket: q.bucket, text: q.verbatim_text }));
  res.json({ quotes });
}));

app.get('/api/artifacts/:kind', authRequired(), requireRole('student'), h(async (req, res) => {
  const kind = req.params.kind;
  const cfg = artifacts.getKind(kind);
  if (!cfg) return res.status(404).json({ error: 'unknown artifact' });
  // read-only: never create a row on a GET (paused accounts can read; no side effects)
  const art = await getArtifactRow(req.user.id, kind);
  const data = art ? art.data : cfg.defaultData();
  res.json({
    artifact: art
      ? { kind: art.kind, data: art.data, status: art.status, current_version: art.current_version,
          open_flag_count: art.open_flag_count, review_note: art.review_note, parked_reason: art.parked_reason }
      : { kind, data, status: 'not_started', current_version: 0, open_flag_count: 0, review_note: null, parked_reason: null },
    config: kindConfigPublic(kind),
    presence_missing: cfg.presenceMissing(data),
  });
}));

app.put('/api/artifacts/:kind', authRequired(), requireRole('student'), h(async (req, res) => {
  const kind = req.params.kind;
  const cfg = artifacts.getKind(kind);
  if (!cfg) return res.status(404).json({ error: 'unknown artifact' });
  const newData = (req.body && req.body.data) || {};
  const pivotReason = (req.body && req.body.pivot_reason || '').trim();
  const art = await getOrCreateArtifact(req.user.id, kind);
  if (art.status === 'submitted' || art.status === 'verified') {
    return res.status(409).json({ error: 'This is submitted. Ask Jay to return it before you edit.' });
  }
  const saveErrs = cfg.validateSave(newData);
  if (saveErrs.length) return res.status(422).json({ error: 'fix these first', save_errors: saveErrs });
  const changes = artifacts.loadBearingChanges(kind, art.data, newData);
  if (changes.length && !nonEmpty(pivotReason)) {
    return res.status(422).json({ error: 'pivot_required', pivot_required: true, changes,
      message: 'You changed something load-bearing. Why? (logged to your history, like Jay does)' });
  }
  const flags = cfg.countFlags(newData);
  const nextStatus = art.status === 'parked' || art.status === 'returned' ? 'draft' : art.status;
  let nextV;
  await tx(async (client) => {
    nextV = await claimNextVersion(client, art.id); // locks the row; serializes concurrent writes
    // re-check status under lock: never overwrite a submitted/verified artifact
    const { rows: st } = await client.query(`SELECT status FROM artifacts WHERE id = $1`, [art.id]);
    if (st[0] && (st[0].status === 'submitted' || st[0].status === 'verified')) {
      throw Object.assign(new Error('locked'), { httpStatus: 409, clientMsg: 'This is with Jay now.' });
    }
    await client.query(
      `UPDATE artifacts SET data = $1, current_version = $2, open_flag_count = $3, status = $4,
              parked_reason = NULL, updated_at = now() WHERE id = $5`,
      [JSON.stringify(newData), nextV, flags, nextStatus, art.id]
    );
    await client.query(
      `INSERT INTO artifact_versions (artifact_id, version, data, status_at_save, edited_by, change_note)
       VALUES ($1,$2,$3,'draft',$4,$5)`,
      [art.id, nextV, JSON.stringify(newData), req.user.id, pivotReason || null]
    );
    for (const c of changes) {
      await client.query(
        `INSERT INTO pivot_entries (artifact_id, field, old_value, new_value, reason) VALUES ($1,$2,$3,$4,$5)`,
        [art.id, c.field, c.old, c.new, pivotReason]
      );
    }
  });
  await logEvent({ student_id: req.user.id, actor_id: req.user.id, type: 'artifact_saved', entity_type: 'artifact', entity_id: art.id, detail: { kind, version: nextV, pivots: changes.length } });
  res.json({ ok: true, version: nextV, open_flag_count: flags, presence_missing: cfg.presenceMissing(newData) });
}));

app.post('/api/artifacts/:kind/submit', authRequired(), requireRole('student'), h(async (req, res) => {
  const kind = req.params.kind;
  const cfg = artifacts.getKind(kind);
  if (!cfg) return res.status(404).json({ error: 'unknown artifact' });
  const art = await getOrCreateArtifact(req.user.id, kind);
  if (art.status === 'submitted' || art.status === 'verified') {
    return res.status(409).json({ error: `Already ${art.status}. Ask Jay to return it before you resubmit.` });
  }
  const saveErrs = cfg.validateSave(art.data);
  if (saveErrs.length) return res.status(422).json({ error: 'fix these first', save_errors: saveErrs });
  const missing = cfg.presenceMissing(art.data);
  if (missing.length) return res.status(422).json({ error: 'not ready to submit', missing });
  let nextV; let ok = false;
  await tx(async (client) => {
    nextV = await claimNextVersion(client, art.id);
    const upd = await client.query(
      `UPDATE artifacts SET status='submitted', submitted_at=now(), current_version=$1, updated_at=now()
        WHERE id=$2 AND status IN ('draft','returned','parked') RETURNING id`, [nextV, art.id]
    );
    if (upd.rows[0]) {
      ok = true;
      await client.query(`INSERT INTO artifact_versions (artifact_id, version, data, status_at_save, edited_by) VALUES ($1,$2,$3,'submitted',$4)`, [art.id, nextV, JSON.stringify(art.data), req.user.id]);
    }
  });
  if (!ok) return res.status(409).json({ error: 'Could not submit (it is already with Jay).' });
  await logEvent({ student_id: req.user.id, actor_id: req.user.id, type: 'artifact_submitted', entity_type: 'artifact', entity_id: art.id, detail: { kind } });
  res.json({ ok: true, status: 'submitted',
    on_record: 'ON RECORD. A real business document, in your own words. Most people never write one.' });
}));

app.post('/api/artifacts/:kind/park', authRequired(), requireRole('student'), h(async (req, res) => {
  const reason = (req.body && req.body.parked_reason || '').trim();
  if (!reason) return res.status(400).json({ error: 'A parked document needs a reason. What is blocking you?' });
  if (!artifacts.isKnownKind(req.params.kind)) return res.status(404).json({ error: 'unknown artifact' });
  const art = await getOrCreateArtifact(req.user.id, req.params.kind);
  if (art.status === 'submitted' || art.status === 'verified') {
    return res.status(409).json({ error: 'This is with Jay. Ask him to return it before you park it.' });
  }
  await query(`UPDATE artifacts SET status='parked', parked_reason=$1, updated_at=now() WHERE id=$2 AND status IN ('draft','returned')`, [reason, art.id]);
  await logEvent({ student_id: req.user.id, actor_id: req.user.id, type: 'artifact_parked', entity_type: 'artifact', entity_id: art.id, detail: { kind: req.params.kind, reason } });
  res.json({ ok: true, status: 'parked' });
}));

app.get('/api/artifacts/:kind/versions', authRequired(), requireRole('student'), h(async (req, res) => {
  if (!artifacts.isKnownKind(req.params.kind)) return res.status(404).json({ error: 'unknown artifact' });
  const art = await getArtifactRow(req.user.id, req.params.kind);
  if (!art) return res.json({ versions: [], pivots: [], review_note: null });
  const { rows } = await query(
    `SELECT version, status_at_save, change_note, created_at FROM artifact_versions WHERE artifact_id=$1 ORDER BY version`, [art.id]
  );
  const { rows: pivots } = await query(`SELECT field, old_value, new_value, reason, created_at FROM pivot_entries WHERE artifact_id=$1 ORDER BY id`, [art.id]);
  res.json({ versions: rows, pivots, review_note: art.review_note });
}));

// ---------- publish gate ----------
app.get('/api/gate/definition', authRequired(), h(async (req, res) => res.json({ questions: GATE_DEFINITION })));

app.post('/api/gate-runs', authRequired(), requireRole('student'), h(async (req, res) => {
  const ref = (req.body && req.body.published_thing_ref || '').trim();
  const answers = (req.body && req.body.answers) || [];
  if (!ref) return res.status(400).json({ error: 'what are you publishing?' });
  const passed = answers.length >= GATE_DEFINITION.length && answers.every((a) => a.result === 'pass' || a.result === 'na');
  const { rows } = await query(
    `INSERT INTO gate_runs (student_id, published_thing_ref, answers, passed) VALUES ($1,$2,$3,$4) RETURNING id, passed, created_at`,
    [req.user.id, ref, JSON.stringify(answers), passed]
  );
  await logEvent({ student_id: req.user.id, actor_id: req.user.id, type: 'gate_run', entity_type: 'gate_run', entity_id: rows[0].id, detail: { ref, passed } });
  res.json({ ok: true, passed, run: rows[0],
    message: passed ? 'Gate passed. Clear to publish.' : 'Gate blocked this. Fix the failed lines, then run it again. A blocked bad post is a win.' });
}));

// gated publish: refuse to mark a thing published unless its LATEST gate run passed
// (plan 4.4 acceptance proof: a failing gate actually blocks published status).
app.post('/api/publish', authRequired(), requireRole('student'), h(async (req, res) => {
  const ref = (req.body && req.body.published_thing_ref || '').trim();
  if (!ref) return res.status(400).json({ error: 'what are you publishing?' });
  const { rows } = await query(
    `SELECT passed FROM gate_runs WHERE student_id=$1 AND published_thing_ref=$2 ORDER BY created_at DESC LIMIT 1`,
    [req.user.id, ref]
  );
  if (!rows[0]) return res.status(409).json({ error: 'Run the publish gate first.', need_gate: true });
  if (!rows[0].passed) return res.status(409).json({ error: 'The gate blocked this. Fix the failed lines and run it again. A blocked bad post is a win.' });
  await logEvent({ student_id: req.user.id, actor_id: req.user.id, type: 'published', entity_type: 'publish', detail: { ref } });
  res.json({ ok: true, message: 'Published. The gate passed, so this is honest and on record.' });
}));

// ---------- onboarding (three promises create rules-file v1) ----------
app.post('/api/onboarding/promises', authRequired(), requireRole('student'), h(async (req, res) => {
  if (req.user.has_onboarded) return res.json({ ok: true, already: true });
  const art = await getOrCreateArtifact(req.user.id, 'rules_file');
  // never overwrite a rules file that is already with Jay; just record onboarding
  if (art.status === 'submitted' || art.status === 'verified') {
    await query(`UPDATE users SET has_onboarded = TRUE WHERE id = $1`, [req.user.id]);
    await logEvent({ student_id: req.user.id, actor_id: req.user.id, type: 'onboarded', detail: {} });
    return res.json({ ok: true, on_record: 'Your rules file is already with Jay. You are all set.' });
  }
  const data = art.data || { sections: {} };
  data.sections = data.sections || {};
  data.sections.standing_rules =
    'Never fabricate. Verify before publishing. A trusted adult is in the loop for money and accounts.';
  await tx(async (client) => {
    const nextV = await claimNextVersion(client, art.id);
    await client.query(`UPDATE artifacts SET data=$1, current_version=$2, updated_at=now() WHERE id=$3`, [JSON.stringify(data), nextV, art.id]);
    await client.query(`INSERT INTO artifact_versions (artifact_id, version, data, status_at_save, edited_by, change_note) VALUES ($1,$2,$3,'draft',$4,'three promises')`, [art.id, nextV, JSON.stringify(data), req.user.id]);
    await client.query(`UPDATE users SET has_onboarded = TRUE WHERE id = $1`, [req.user.id]);
  });
  await logEvent({ student_id: req.user.id, actor_id: req.user.id, type: 'onboarded', detail: {} });
  res.json({ ok: true, on_record: 'Your first business document. Most people never write one.' });
}));

// ---------- Elena's demo binder (read-only, non-copyable answers) ----------
let ELENA_CACHE = null;
function loadElena() {
  if (ELENA_CACHE) return ELENA_CACHE;
  try { ELENA_CACHE = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'elena-binder.json'), 'utf8')); }
  catch (_) { ELENA_CACHE = { artifacts: [] }; }
  return ELENA_CACHE;
}
app.get('/api/elena/binder', authRequired(), h(async (req, res) => {
  const e = loadElena();
  res.json({ label: 'Elena is a made-up example. Her answers are here to learn from, not to copy.', artifacts: e.artifacts || [] });
}));

// ---------- admin review loop ----------
app.get('/api/admin/review-queue', authRequired(), requireRole('admin'), h(async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.kind, a.open_flag_count, a.submitted_at, u.id AS student_id, u.first_name, u.last_initial,
            (SELECT number FROM chapters c WHERE c.id = a.chapter_id) AS chapter_number
       FROM artifacts a JOIN users u ON u.id = a.student_id
      WHERE a.status = 'submitted' ORDER BY a.submitted_at ASC`
  );
  const { rows: snips } = await query(`SELECT id, title, body FROM review_snippets ORDER BY id`);
  res.json({ queue: rows, snippets: snips });
}));

app.get('/api/admin/artifacts/:id', authRequired(), requireRole('admin'), h(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { rows } = await query(
    `SELECT a.*, u.first_name, u.last_initial FROM artifacts a JOIN users u ON u.id=a.student_id WHERE a.id=$1`, [id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  const { rows: versions } = await query(`SELECT version, status_at_save, change_note, created_at FROM artifact_versions WHERE artifact_id=$1 ORDER BY version`, [id]);
  const { rows: pivots } = await query(`SELECT field, old_value, new_value, reason FROM pivot_entries WHERE artifact_id=$1 ORDER BY id`, [id]);
  res.json({ artifact: rows[0], versions, pivots, acceptance_proof: ACCEPTANCE_PROOFS[rows[0].kind] || null });
}));

app.post('/api/admin/artifacts/:id/verify', authRequired(), requireRole('admin'), h(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  // checkpoint gate (plan 3.2): an artifact cannot be verified until required parent sign-offs are approved
  const { rows: ar } = await query(
    `SELECT a.student_id, c.number AS chapter_number FROM artifacts a LEFT JOIN chapters c ON c.id = a.chapter_id WHERE a.id = $1`, [id]
  );
  if (ar[0]) {
    const required = family.GATES_VERIFY_BY_CHAPTER[ar[0].chapter_number] || [];
    if (required.length) {
      const { rows: appr } = await query(
        `SELECT checkpoint_key FROM approvals WHERE student_id=$1 AND status='approved' AND checkpoint_key = ANY($2)`,
        [ar[0].student_id, required]
      );
      const approved = new Set(appr.map((r) => r.checkpoint_key));
      const missing = required.filter((k) => !approved.has(k));
      if (missing.length) {
        return res.status(409).json({ error: `A parent sign-off is still open (${missing.join(', ')}). Verify is blocked until the parent approves.`, missing_checkpoints: missing });
      }
    }
  }
  const { rows } = await query(`UPDATE artifacts SET status='verified', reviewed_at=now(), reviewed_by=$1, updated_at=now() WHERE id=$2 AND status='submitted' RETURNING student_id, kind`, [req.user.id, id]);
  if (!rows[0]) return res.status(409).json({ error: 'not in submitted state' });
  await query(`INSERT INTO admin_audit_log (actor_id, action, detail) VALUES ($1,'verify_artifact',$2)`, [req.user.id, JSON.stringify({ id })]);
  await notify(rows[0].student_id, 'artifact_verified', `Coach Jay verified your ${rows[0].kind.replace(/_/g, ' ')}.`, `#/binder`);
  await logEvent({ student_id: rows[0].student_id, actor_id: req.user.id, type: 'artifact_verified', entity_type: 'artifact', entity_id: id, detail: { kind: rows[0].kind } });
  res.json({ ok: true, status: 'verified' });
}));

app.post('/api/admin/artifacts/:id/return', authRequired(), requireRole('admin'), h(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const note = (req.body && req.body.note || '').trim();
  if (note.length < 20) return res.status(400).json({ error: 'Write at least a sentence (20+ chars) so the student knows exactly what to change.' });
  const { rows: cur } = await query(`SELECT student_id, kind, current_version, data FROM artifacts WHERE id=$1 AND status='submitted'`, [id]);
  if (!cur[0]) return res.status(409).json({ error: 'not in submitted state' });
  const nextV = cur[0].current_version + 1;
  await tx(async (client) => {
    await client.query(`UPDATE artifacts SET status='returned', review_note=$1, reviewed_at=now(), reviewed_by=$2, current_version=$3, updated_at=now() WHERE id=$4`, [note, req.user.id, nextV, id]);
    await client.query(`INSERT INTO artifact_versions (artifact_id, version, data, status_at_save, edited_by, change_note) VALUES ($1,$2,$3,'returned',$4,$5)`, [id, nextV, JSON.stringify(cur[0].data), req.user.id, note]);
  });
  await query(`INSERT INTO admin_audit_log (actor_id, action, detail) VALUES ($1,'return_artifact',$2)`, [req.user.id, JSON.stringify({ id })]);
  await notify(cur[0].student_id, 'artifact_returned', `Coach Jay sent your ${cur[0].kind.replace(/_/g, ' ')} back with a note.`, `#/binder`);
  await logEvent({ student_id: cur[0].student_id, actor_id: req.user.id, type: 'artifact_returned', entity_type: 'artifact', entity_id: id, detail: { kind: cur[0].kind } });
  res.json({ ok: true, status: 'returned' });
}));

// ================= P2: the family layer =================
const { sendEmail } = require('./lib/email');
const AGE_GATE_COPY = 'This program is for teens 13 to 17, with a parent account linked. Students 18 and older can hold their own account. Under 13 is not supported, and we do not knowingly collect information from children under 13.';
const PARENT_VISIBILITY = {
  sees: ['Which chapter and step your teen is on', 'The documents your teen submits (you can read them)', 'Coursework questions and Jay\'s answers', 'Jay\'s review notes', 'The weekly scoreboard (self-reported by your teen)', 'Requests for your sign-off'],
  not_sees: ['Unsaved drafts', 'Safety-flagged messages (a trained responder handles those)', 'Your teen\'s password or login activity'],
};
const PRIVACY_TEXT = [
  'What we collect: your name and email (parent), your teen\'s first name, last initial, age, and the work they do in the program.',
  'Why: to run the program and show a parent their teen\'s progress. That is all.',
  'Who sees what: you see your teen\'s progress, submitted work, and coursework questions. A trained OTS responder may review a message that looks like a safety concern.',
  'An automated system reads each question first to route it and to catch safety concerns. A person (Jay or a trained responder) handles anything it flags.',
  'We do not sell your data, and we do not run ads.',
  'You can ask us to delete your teen\'s data. The full Privacy Policy and Terms are separate documents your parent reviews before you start.',
];

function phoenixNow() { return new Date(Date.now() - 7 * 3600 * 1000); } // UTC-7, no DST
function phoenixWeekday() { return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][phoenixNow().getUTCDay()]; }
function mondayOfPhoenix() { const d = phoenixNow(); const diff = (d.getUTCDay() + 6) % 7; const m = new Date(d); m.setUTCDate(d.getUTCDate() - diff); return m.toISOString().slice(0, 10); }
function metricPair(val, unknown) { if (unknown) return [null, true]; if (val === '' || val == null) return [null, false]; const n = parseInt(val, 10); return [Number.isNaN(n) ? null : n, false]; }

app.get('/api/privacy', (req, res) => res.json({ paragraphs: PRIVACY_TEXT }));
app.get('/api/parent-visibility', (req, res) => res.json(PARENT_VISIBILITY));

// ----- parent account setup (from an emailed single-use link) -----
app.post('/api/parent/setup', h(async (req, res) => {
  const { token, password, consents } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'token and password required' });
  if (String(password).length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
  const need = family.CONSENT_KEYS.map((c) => c.key);
  if (!consents || !need.every((k) => consents[k] === true)) {
    return res.status(400).json({ error: 'All four consent boxes are required to continue.' });
  }
  const { rows } = await query(`SELECT * FROM invites WHERE token_hash = $1 AND kind = 'parent_setup' LIMIT 1`, [hashToken(token)]);
  const inv = rows[0];
  if (!inv) return res.status(404).json({ error: 'setup link not found' });
  if (inv.used_at) return res.status(410).json({ error: 'this link was already used' });
  if (new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: 'this link expired' });
  const hash = await hashPassword(password);
  await tx(async (client) => {
    await client.query(`UPDATE users SET password_hash=$1, account_state='active', token_version=token_version+1 WHERE id=$2`, [hash, inv.target_user_id]);
    for (const k of need) await client.query(`INSERT INTO consent_acknowledgements (parent_id, key) VALUES ($1,$2)`, [inv.target_user_id, k]);
    await client.query(`UPDATE invites SET used_at=now() WHERE id=$1`, [inv.id]);
  });
  const { rows: u } = await query(`SELECT * FROM users WHERE id = $1`, [inv.target_user_id]);
  res.json({ token: signToken(u[0]), user: publicUser(u[0]) });
}));

// ----- parent adds a teen (creates the student + family link + claim link) -----
app.post('/api/parent/add-teen', authRequired(), requireRole('parent'), h(async (req, res) => {
  const first = (req.body && req.body.first_name || '').trim();
  const lastInitial = (req.body && req.body.last_initial || '').trim() || null;
  const username = (req.body && req.body.username || '').trim() || null;
  const age = parseInt(req.body && req.body.age, 10);
  if (!first || Number.isNaN(age)) return res.status(400).json({ error: 'first name and age required' });
  if (age < 13) return res.status(400).json({ error: AGE_GATE_COPY });
  const isAdult = age >= 18;
  const { rows } = await query(
    `INSERT INTO users (role, first_name, last_initial, age_at_signup, username, is_adult_student, account_state)
     VALUES ('student',$1,$2,$3,$4,$5,'created') RETURNING *`,
    [first, lastInitial, age, username, isAdult]
  );
  const student = rows[0];
  const claimToken = randomToken();
  await tx(async (client) => {
    await client.query(`INSERT INTO family_links (parent_id, student_id, created_by, status) VALUES ($1,$2,$1,'active')`, [req.user.id, student.id]);
    await client.query(`UPDATE enrollments SET student_id=$1 WHERE parent_id=$2 AND student_id IS NULL AND status='active'`, [student.id, req.user.id]);
    await client.query(`INSERT INTO invites (kind, token_hash, target_user_id, expires_at) VALUES ('student_claim',$1,$2,$3)`,
      [hashToken(claimToken), student.id, new Date(Date.now() + 7 * 864e5)]);
  });
  const base = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  res.json({ student: publicUser(student), claim_url: `${base}/#/claim/${claimToken}` });
}));

// ----- parent dashboard -----
app.get('/api/parent/children', authRequired(), requireRole('parent'), h(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.first_name, u.last_initial, u.account_state
       FROM users u JOIN family_links f ON f.student_id = u.id
      WHERE f.parent_id = $1 AND f.status = 'active' AND u.deleted_at IS NULL ORDER BY u.first_name`,
    [req.user.id]
  );
  res.json({ children: rows });
}));

app.get('/api/parent/children/:id', authRequired(), requireRole('parent'), h(async (req, res) => {
  const sid = parseInt(req.params.id, 10);
  if (!(await parentOf(req.user.id, sid))) return res.status(403).json({ error: 'not your teen' });
  const { rows: su } = await query(`SELECT first_name, last_initial FROM users WHERE id = $1`, [sid]);
  const { rows: arts } = await query(
    `SELECT kind, status, submitted_at, reviewed_at, review_note FROM artifacts
      WHERE student_id = $1 AND status IN ('submitted','verified','returned')
      ORDER BY COALESCE(reviewed_at, submitted_at) DESC`, [sid]
  );
  const { rows: submitted } = await query(`SELECT COUNT(*)::int AS n FROM artifacts WHERE student_id=$1 AND status IN ('submitted','verified')`, [sid]);
  const { rows: last } = await query(`SELECT max(created_at) AS last FROM events WHERE student_id = $1`, [sid]);
  const { rows: appr } = await query(
    `SELECT id, checkpoint_key, subject_ref, created_at FROM approvals WHERE student_id=$1 AND parent_id=$2 AND status='requested' ORDER BY created_at`, [sid, req.user.id]
  );
  const { rows: weeks } = await query(
    `SELECT week_start, clicks, clicks_unknown, leads, leads_unknown, paid, paid_unknown, revenue_cents, revenue_unknown
       FROM scoreboard_weeks WHERE student_id=$1 ORDER BY week_start DESC LIMIT 8`, [sid]
  );
  res.json({
    student: su[0], documents_submitted: submitted[0].n, last_activity: last[0].last,
    artifacts: arts,
    pending_approvals: appr.map((a) => ({ ...a, text: (family.CHECKPOINTS_BY_KEY[a.checkpoint_key] || {}).text })),
    scoreboard: weeks.reverse(),
    visibility: PARENT_VISIBILITY,
  });
}));

app.get('/api/parent/artifact/:studentId/:kind', authRequired(), requireRole('parent'), h(async (req, res) => {
  const sid = parseInt(req.params.studentId, 10);
  if (!(await parentOf(req.user.id, sid))) return res.status(403).json({ error: 'not your teen' });
  const { rows } = await query(
    `SELECT kind, data, status, review_note FROM artifacts WHERE student_id=$1 AND kind=$2 AND status IN ('submitted','verified','returned')`,
    [sid, req.params.kind]
  );
  if (!rows[0]) return res.status(404).json({ error: 'nothing to show yet' });
  res.json({ artifact: rows[0] }); // read-only, no write route exists for parents
}));

// ----- checkpoints (student requests; parent decides) -----
app.get('/api/me/checkpoints', authRequired(), requireRole('student'), h(async (req, res) => {
  const { rows } = await query(`SELECT checkpoint_key, subject_ref, status, note FROM approvals WHERE student_id=$1 ORDER BY created_at DESC`, [req.user.id]);
  res.json({ registry: family.CHECKPOINT_REGISTRY, approvals: rows });
}));

app.post('/api/checkpoints/:key/request', authRequired(), requireRole('student'), h(async (req, res) => {
  const cp = family.CHECKPOINTS_BY_KEY[req.params.key];
  if (!cp) return res.status(404).json({ error: 'unknown checkpoint' });
  const subject = cp.per_subject ? (req.body && req.body.subject_ref || '').trim() : null;
  if (cp.per_subject && !subject) return res.status(400).json({ error: 'name the person this consent is about' });
  const releaseRef = req.params.key === 'CP-STORY-CONSENT' ? (req.body && req.body.release_reference || '').trim() : null;
  const { rows: p } = await query(`SELECT parent_id FROM family_links WHERE student_id=$1 AND status='active' ORDER BY id LIMIT 1`, [req.user.id]);
  const parentId = p[0] ? p[0].parent_id : null;
  // avoid a duplicate open request for the same key+subject
  const { rows: dup } = await query(
    `SELECT id FROM approvals WHERE student_id=$1 AND checkpoint_key=$2 AND COALESCE(subject_ref,'')=$3 AND status='requested'`,
    [req.user.id, req.params.key, subject || '']
  );
  if (dup[0]) return res.json({ ok: true, already: true });
  const { rows: a } = await query(
    `INSERT INTO approvals (checkpoint_key, student_id, parent_id, subject_ref, release_reference, status) VALUES ($1,$2,$3,$4,$5,'requested') RETURNING id`,
    [req.params.key, req.user.id, parentId, subject, releaseRef]
  );
  await query(`INSERT INTO approval_events (approval_id, actor_id, actor_role, event) VALUES ($1,$2,'student','requested')`, [a[0].id, req.user.id]);
  if (parentId) {
    await notify(parentId, 'approval_requested', `${req.user.first_name} asked for your sign-off: ${cp.text}`, '#/approvals');
    const { rows: pu } = await query(`SELECT email FROM users WHERE id=$1`, [parentId]);
    if (pu[0] && pu[0].email) await sendEmail({ to: pu[0].email, subject: 'Your teen needs a sign-off', text: cp.text, html: null });
  }
  await logEvent({ student_id: req.user.id, actor_id: req.user.id, type: 'checkpoint_requested', detail: { key: req.params.key } });
  res.json({ ok: true });
}));

app.get('/api/parent/approvals', authRequired(), requireRole('parent'), h(async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.checkpoint_key, a.subject_ref, a.release_reference, a.created_at, u.first_name, a.student_id
       FROM approvals a JOIN users u ON u.id = a.student_id
       JOIN family_links f ON f.student_id = a.student_id AND f.parent_id = $1 AND f.status='active'
      WHERE a.status = 'requested' ORDER BY a.created_at`, [req.user.id]
  );
  // record an append-only 'viewed' event once per parent+approval (plan 3.2 trail: requested/viewed/decided)
  for (const r of rows) {
    await query(
      `INSERT INTO approval_events (approval_id, actor_id, actor_role, event, ip, user_agent)
       SELECT $1,$2,'parent','viewed',$3,$4
        WHERE NOT EXISTS (SELECT 1 FROM approval_events WHERE approval_id=$1 AND actor_id=$2 AND event='viewed')`,
      [r.id, req.user.id, req.ip, (req.headers['user-agent'] || '').slice(0, 300)]
    );
  }
  res.json({ approvals: rows.map((r) => ({ ...r, text: (family.CHECKPOINTS_BY_KEY[r.checkpoint_key] || {}).text })) });
}));

app.post('/api/parent/approvals/:id/:action', authRequired(), requireRole('parent'), h(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const action = req.params.action; // approve | decline | revoke
  if (!['approve', 'decline', 'revoke'].includes(action)) return res.status(400).json({ error: 'bad action' });
  const note = (req.body && req.body.note || '').trim();
  if (action === 'decline' && !note) return res.status(400).json({ error: 'Add a short note so your teen knows why.' });
  const { rows: a } = await query(
    `SELECT a.* FROM approvals a JOIN family_links f ON f.student_id=a.student_id AND f.parent_id=$1 AND f.status='active' WHERE a.id=$2`,
    [req.user.id, id]
  );
  if (!a[0]) return res.status(404).json({ error: 'not found' });
  const status = action === 'approve' ? 'approved' : action === 'decline' ? 'declined' : 'revoked';
  await tx(async (client) => {
    await client.query(`UPDATE approvals SET status=$1, note=$2, parent_id=$3, resolved_at=now() WHERE id=$4`, [status, note || null, req.user.id, id]);
    await client.query(
      `INSERT INTO approval_events (approval_id, actor_id, actor_role, event, note, ip, user_agent) VALUES ($1,$2,'parent',$3,$4,$5,$6)`,
      [id, req.user.id, status, note || null, req.ip, (req.headers['user-agent'] || '').slice(0, 300)]
    );
  });
  const cp = family.CHECKPOINTS_BY_KEY[a[0].checkpoint_key] || {};
  await notify(a[0].student_id, 'approval_' + status,
    action === 'decline' ? `Your parent said "not yet" on: ${cp.text} (${note})` : `Your parent ${status} your sign-off: ${cp.text}`, '#/checkpoints');
  if (action === 'revoke') {
    await query(
      `INSERT INTO notifications (user_id, kind, body) SELECT id, 'consent_revoked', $1 FROM users WHERE role='admin' AND deleted_at IS NULL`,
      [`A CP-STORY-CONSENT was revoked for student ${a[0].student_id}. Check any content that references them.`]
    );
  }
  res.json({ ok: true, status });
}));

// ----- scoreboard (student) -----
app.get('/api/me/scoreboard', authRequired(), requireRole('student'), h(async (req, res) => {
  const { rows } = await query(`SELECT * FROM scoreboard_weeks WHERE student_id=$1 ORDER BY week_start DESC LIMIT 12`, [req.user.id]);
  res.json({ weeks: rows, review_day: req.user.review_day, today_is_review_day: phoenixWeekday() === req.user.review_day, this_monday: mondayOfPhoenix() });
}));

app.post('/api/me/scoreboard', authRequired(), requireRole('student'), h(async (req, res) => {
  const b = req.body || {};
  const week = (b.week_start || mondayOfPhoenix()).slice(0, 10);
  if (!nonEmpty(b.leak) || !nonEmpty(b.learning) || !nonEmpty(b.dial_in)) {
    return res.status(400).json({ error: 'Leak, learning, and dial-in are all required. Numbers first, feelings second.' });
  }
  const dial = String(b.dial_in).replace(/\s*\n\s*/g, ' ').trim().slice(0, 240); // one sentence
  const [clicks, cu] = metricPair(b.clicks, b.clicks_unknown);
  const [leads, lu] = metricPair(b.leads, b.leads_unknown);
  const [paid, pu] = metricPair(b.paid, b.paid_unknown);
  // revenue is entered in dollars and may have cents; parse as a decimal, do not truncate.
  const ru = !!b.revenue_unknown;
  let revenueCents = null;
  if (!ru && b.revenue != null && String(b.revenue).trim() !== '') {
    const fdollars = parseFloat(b.revenue);
    revenueCents = Number.isNaN(fdollars) ? null : Math.round(fdollars * 100);
  }
  const filledLate = week < mondayOfPhoenix();
  await query(
    `INSERT INTO scoreboard_weeks (student_id, week_start, front_door, clicks, clicks_unknown, leads, leads_unknown,
       paid, paid_unknown, revenue_cents, revenue_unknown, posts_shipped, best_post, hand_counted_extras,
       leak, learning, dial_in, filled_late)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (student_id, week_start) DO UPDATE SET front_door=$3, clicks=$4, clicks_unknown=$5, leads=$6, leads_unknown=$7,
       paid=$8, paid_unknown=$9, revenue_cents=$10, revenue_unknown=$11, posts_shipped=$12, best_post=$13,
       hand_counted_extras=$14, leak=$15, learning=$16, dial_in=$17, updated_at=now()`,
    [req.user.id, week, (b.front_door || '').trim() || null, clicks, cu, leads, lu, paid, pu, revenueCents, ru,
      metricPair(b.posts_shipped, false)[0], (b.best_post || '').trim() || null, (b.hand_counted_extras || '').trim() || null,
      b.leak.trim(), b.learning.trim(), dial, filledLate]
  );
  await logEvent({ student_id: req.user.id, actor_id: req.user.id, type: 'scoreboard_week_logged', detail: { week } });
  res.json({ ok: true, filled_late: filledLate });
}));

// ----- admin cohort v2 -----
app.get('/api/admin/cohort', authRequired(), requireRole('admin'), h(async (req, res) => {
  const { rows: cfg } = await query(`SELECT key, value FROM app_config WHERE key LIKE 'attn_weight_%'`);
  const w = Object.fromEntries(cfg.map((r) => [r.key, parseFloat(r.value)]));
  const { rows } = await query(`
    SELECT u.id, u.first_name, u.last_initial, u.account_state, u.call_group,
      (SELECT max(created_at) FROM events e WHERE e.student_id=u.id) AS last_activity,
      (SELECT count(*) FROM artifacts a WHERE a.student_id=u.id AND a.status='submitted') AS pending_review,
      (SELECT min(submitted_at) FROM artifacts a WHERE a.student_id=u.id AND a.status='submitted') AS oldest_submitted,
      (SELECT count(*) FROM approvals ap WHERE ap.student_id=u.id AND ap.status='requested') AS pending_approvals,
      (SELECT count(*) FROM artifacts a WHERE a.student_id=u.id AND a.status='returned') AS returned_untouched
     FROM users u WHERE u.role='student' AND u.deleted_at IS NULL`);
  const now = Date.now();
  const days = (t) => (t ? (now - new Date(t).getTime()) / 86400000 : 999);
  const students = rows.map((r) => {
    const idle = days(r.last_activity);
    const oldestReview = r.oldest_submitted ? days(r.oldest_submitted) : 0;
    const score = (w.attn_weight_days_idle || 1) * idle
      + (w.attn_weight_returned_untouched_age || 1) * (Number(r.returned_untouched) > 0 ? 3 : 0)
      + (w.attn_weight_pending_approval_age || 1) * (Number(r.pending_approvals) > 0 ? 2 : 0)
      + oldestReview;
    let flag = 'green';
    if (idle >= 10 || (r.returned_untouched > 0 && idle >= 7)) flag = 'red';
    else if (idle >= 5 || oldestReview >= 5) flag = 'yellow';
    const reason = idle >= 5 ? `${Math.floor(idle)} days quiet` : r.pending_review > 0 ? 'work to review' : r.pending_approvals > 0 ? 'parent sign-off pending' : 'ok';
    return { ...r, days_idle: Math.floor(idle), attention: Math.round(score * 10) / 10, flag, reason };
  }).sort((a, b) => b.attention - a.attention);
  const queues = {
    review: students.reduce((s, x) => s + Number(x.pending_review), 0),
    approvals: students.reduce((s, x) => s + Number(x.pending_approvals), 0),
  };
  // scoreboard grid: last 8 week_starts x students filled/not
  const { rows: grid } = await query(
    `SELECT student_id, week_start FROM scoreboard_weeks WHERE week_start >= (CURRENT_DATE - INTERVAL '8 weeks')`);
  res.json({ students, queues, scoreboard_grid: grid });
}));

// ----- admin: manual family provisioning (the launch path, plan 6.5) -----
app.post('/api/admin/invite-family', authRequired(), requireRole('admin'), h(async (req, res) => {
  const email = (req.body && req.body.parent_email || '').trim().toLowerCase();
  const program = (req.body && req.body.program || 'mastermind_995').trim();
  if (!email) return res.status(400).json({ error: 'parent email required' });
  let parentId;
  const { rows: ex } = await query(`SELECT id FROM users WHERE email=$1`, [email]);
  if (ex[0]) parentId = ex[0].id;
  else {
    const { rows } = await query(`INSERT INTO users (role, email, account_state) VALUES ('parent',$1,'created') RETURNING id`, [email]);
    parentId = rows[0].id;
  }
  await query(`INSERT INTO enrollments (parent_id, program, source, status) VALUES ($1,$2,'admin_invite','active')`, [parentId, program]);
  const token = randomToken();
  await query(`INSERT INTO invites (kind, token_hash, target_user_id, expires_at) VALUES ('parent_setup',$1,$2,$3)`,
    [hashToken(token), parentId, new Date(Date.now() + 3 * 864e5)]);
  await query(`INSERT INTO admin_audit_log (actor_id, action, detail) VALUES ($1,'invite_family',$2)`, [req.user.id, JSON.stringify({ email, program })]);
  const base = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  const setupUrl = `${base}/#/parent-setup/${token}`;
  if ((process.env.LAUNCH_MODE || 'preview') === 'preview') {
    return res.json({ ok: true, preview: true, setup_url: setupUrl, note: 'Preview mode: link not emailed. Hand it over directly.' });
  }
  await sendEmail({ to: email, subject: 'Set up your Outsmart the System parent account', text: `Set your password and link your teen: ${setupUrl}`, html: null });
  res.json({ ok: true, emailed: true });
}));

// ================= P3a: the question channel (behind QUESTIONS_ENABLED) =================
const classifier = require('./lib/classifier');
const CRISIS = classifier.CRISIS_LINES;

// every error on this channel repeats the crisis lines and never dead-ends (plan 5.2.7)
function channelErr(res, status, msg) { return res.status(status).json({ error: msg, crisis_lines: CRISIS }); }
function questionsOpen() { return process.env.QUESTIONS_ENABLED === '1'; }

// rate limit: 10 submissions/day across questions+replies, 5-minute cooldown
async function submitGuard(studentId) {
  const { rows: c } = await query(
    `SELECT (SELECT count(*) FROM questions WHERE student_id=$1 AND created_at > now() - interval '1 day')
          + (SELECT count(*) FROM question_replies WHERE author_id=$1 AND created_at > now() - interval '1 day') AS n,
            GREATEST(
              COALESCE((SELECT max(created_at) FROM questions WHERE student_id=$1),'epoch'),
              COALESCE((SELECT max(created_at) FROM question_replies WHERE author_id=$1),'epoch')) AS last_at`,
    [studentId]
  );
  if (Number(c[0].n) >= 10) return { ok: false, msg: 'That is 10 messages today, the daily limit. Take a breath and come back tomorrow.' };
  if (c[0].last_at && (Date.now() - new Date(c[0].last_at).getTime()) < 5 * 60 * 1000) {
    return { ok: false, msg: 'Give it 5 minutes between messages. Jay reads every one.' };
  }
  return { ok: true };
}

async function raiseSafetyEvent({ questionId = null, replyId = null, verdict, student, threadId }) {
  const { rows } = await query(
    `INSERT INTO safety_events (question_id, reply_id, class, severity, responder_notified_at) VALUES ($1,$2,$3,$4,now()) RETURNING id`,
    [questionId, replyId, verdict.class, verdict.severity]
  );
  const eventId = rows[0].id;
  const to = process.env.SAFETY_ALERT_TO || 'jay@outsmartthesystem.org';
  const backup = process.env.SAFETY_ALERT_BACKUP_TO;
  const instr = verdict.do_not_contact_parent ? 'Do NOT contact the parent.' : verdict.class === 'THREAT' ? 'Escalate to a supervisor immediately.' : 'Follow the SOP; do not contact the parent unless policy permits.';
  const body = `Event ID: ${eventId}\nFlag: ${verdict.class}\nSeverity: ${verdict.severity}\nStudent first name: ${student.first_name}\nStudent age: ${student.age_at_signup || 'n/a'}\nThread ID: ${threadId}\nResponder instructions: ${instr}\nNo student quote is included, by policy.`;
  await sendEmail({ to: backup ? `${to},${backup}` : to, subject: `[OTS SAFETY] ${verdict.class} | Event ${eventId} | ${student.first_name} (age ${student.age_at_signup || '?'})`, text: body, html: null });
  // in-app admin flag, also no quotes
  await query(`INSERT INTO notifications (user_id, kind, body, link) SELECT id,'safety_flag',$1,'#/inbox' FROM users WHERE role='admin' AND deleted_at IS NULL`,
    [`A safety-flagged message needs review (class ${verdict.class}, event ${eventId}). No quotes shown.`]);
  return eventId;
}

// student asks a question
app.post('/api/questions', authRequired(), requireRole('student'), h(async (req, res) => {
  if (!questionsOpen()) return channelErr(res, 403, 'The question channel is not open yet. It opens after a safety review. On the biweekly call you can ask Jay anything.');
  const body = (req.body && req.body.body || '').trim();
  const qtype = (req.body && req.body.qtype || 'other').slice(0, 30);
  if (!body) return channelErr(res, 400, 'Write your question first.');
  if (body.length > 2000) return channelErr(res, 400, 'Keep it under 2000 characters.');
  const guard = await submitGuard(req.user.id);
  if (!guard.ok) return channelErr(res, 429, guard.msg);
  // resolve anchor
  let chapterId = null; let stepId = null;
  if (req.body.step_key) { const { rows } = await query(`SELECT id, chapter_id FROM steps WHERE stable_key=$1`, [req.body.step_key]); if (rows[0]) { stepId = rows[0].id; chapterId = rows[0].chapter_id; } }
  else if (req.body.chapter_key) { const { rows } = await query(`SELECT id FROM chapters WHERE stable_key=$1`, [req.body.chapter_key]); if (rows[0]) chapterId = rows[0].id; }
  const verdict = await classifier.classify({ text: body });
  const status = verdict.serious ? 'quarantined' : 'open';
  const { rows: q } = await query(
    `INSERT INTO questions (student_id, chapter_id, step_id, body, qtype, class, parent_visible, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [req.user.id, chapterId, stepId, body, qtype, verdict.class, verdict.parent_visible, status]
  );
  const qid = q[0].id;
  if (verdict.serious) await raiseSafetyEvent({ questionId: qid, verdict, student: req.user, threadId: qid });
  await logEvent({ student_id: req.user.id, actor_id: req.user.id, type: 'question_asked', entity_type: 'question', entity_id: qid, detail: { class: verdict.held ? 'held' : 'question' } });
  res.json({
    ok: true, id: qid, held: verdict.held,
    message: verdict.held
      ? 'This message was set aside because it looks like it might be about something serious, not coursework. A trained OTS responder may check in. It is not visible in your parent view right now.'
      : 'Sent to Jay. Your parent can see this thread.',
    crisis_lines: CRISIS,
  });
}));

// student replies in their own thread
app.post('/api/questions/:id/reply', authRequired(), requireRole('student'), h(async (req, res) => {
  if (!questionsOpen()) return channelErr(res, 403, 'The question channel is not open yet.');
  const id = parseInt(req.params.id, 10);
  const body = (req.body && req.body.body || '').trim();
  if (!body) return channelErr(res, 400, 'Write your reply first.');
  if (body.length > 2000) return channelErr(res, 400, 'Keep it under 2000 characters.');
  const { rows: qr } = await query(`SELECT id FROM questions WHERE id=$1 AND student_id=$2`, [id, req.user.id]);
  if (!qr[0]) return channelErr(res, 404, 'That thread was not found.');
  const guard = await submitGuard(req.user.id);
  if (!guard.ok) return channelErr(res, 429, guard.msg);
  const verdict = await classifier.classify({ text: body });
  const { rows: r } = await query(
    `INSERT INTO question_replies (question_id, author_id, body, class, parent_visible) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [id, req.user.id, body, verdict.class, verdict.parent_visible]
  );
  if (verdict.serious) {
    // pull the WHOLE thread from the parent view the moment it becomes a safety event
    // (the parent may be the subject). The question stops being parent_visible too.
    await query(`UPDATE questions SET status='quarantined', parent_visible=FALSE WHERE id=$1`, [id]);
    await raiseSafetyEvent({ replyId: r[0].id, verdict, student: req.user, threadId: id });
  } else {
    // a normal (or held-but-not-serious) follow-up reopens the thread so it returns to Jay's inbox
    await query(`UPDATE questions SET status='open' WHERE id=$1 AND status IN ('answered','closed')`, [id]);
  }
  res.json({ ok: true, held: verdict.held, crisis_lines: CRISIS,
    message: verdict.held ? 'This reply was set aside for review and is not in your parent view. If you are in danger, call or text 988, or 911.' : 'Sent.' });
}));

// student reads their own threads (sees their own messages + parent-visible replies from Jay;
// held messages carry the honest notice)
app.get('/api/me/questions', authRequired(), requireRole('student'), h(async (req, res) => {
  if (!questionsOpen()) return res.json({ open: false, threads: [] });
  const { rows: qs } = await query(`SELECT id, body, qtype, class, parent_visible, status, created_at FROM questions WHERE student_id=$1 ORDER BY created_at DESC`, [req.user.id]);
  const threads = [];
  for (const q of qs) {
    const { rows: reps } = await query(`SELECT author_id, body, parent_visible, class, created_at FROM question_replies WHERE question_id=$1 ORDER BY created_at`, [q.id]);
    threads.push({
      id: q.id, qtype: q.qtype, status: q.status, created_at: q.created_at,
      held: classifier.isHeld(q.class),
      body: q.body, // the student always sees their own words
      replies: reps.map((r) => ({ from: r.author_id === req.user.id ? 'you' : 'jay', body: r.body, held: classifier.isHeld(r.class) })),
    });
  }
  res.json({ open: true, threads, visibility: 'Questions here go to Jay. Your parent can see every question and reply, except anything a safety check sets aside.' });
}));

// admin inbox
app.get('/api/admin/questions', authRequired(), requireRole('admin'), h(async (req, res) => {
  const { rows } = await query(
    `SELECT q.id, q.class, q.status, q.qtype, q.created_at, q.first_response_at, u.first_name, u.last_initial,
            (SELECT number FROM chapters c WHERE c.id=q.chapter_id) AS chapter_number
       FROM questions q JOIN users u ON u.id=q.student_id
      WHERE q.status IN ('open','quarantined') ORDER BY (q.status='quarantined') DESC, q.created_at ASC`
  );
  const { rows: sla } = await query(`SELECT value FROM app_config WHERE key='sla_business_days'`);
  res.json({ questions: rows, sla_business_days: sla[0] ? sla[0].value : '2' });
}));

// admin reads a full thread. Reading a held/quarantined message writes an audit row (plan 5.2.5).
app.get('/api/admin/questions/:id', authRequired(), requireRole('admin'), h(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { rows: q } = await query(`SELECT q.*, u.first_name, u.last_initial, u.age_at_signup FROM questions q JOIN users u ON u.id=q.student_id WHERE q.id=$1`, [id]);
  if (!q[0]) return res.status(404).json({ error: 'not found' });
  const { rows: reps } = await query(`SELECT id, author_id, body, class, parent_visible, created_at FROM question_replies WHERE question_id=$1 ORDER BY created_at`, [id]);
  const held = classifier.isHeld(q[0].class) || reps.some((r) => classifier.isHeld(r.class));
  if (held) {
    await query(`INSERT INTO admin_audit_log (actor_id, action, detail) VALUES ($1,'quarantine_read',$2)`, [req.user.id, JSON.stringify({ question_id: id, class: q[0].class })]);
  }
  const { rows: canned } = await query(`SELECT id, title, body FROM canned_answers ORDER BY id`);
  res.json({ question: q[0], replies: reps, canned });
}));

// admin answers (immutable reply)
app.post('/api/admin/questions/:id/reply', authRequired(), requireRole('admin'), h(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const body = (req.body && req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'write your answer' });
  const { rows: q } = await query(`SELECT student_id, class, status FROM questions WHERE id=$1`, [id]);
  if (!q[0]) return res.status(404).json({ error: 'not found' });
  // never answer a flagged/quarantined thread as coursework (defense in depth; SOP handles those)
  if (q[0].class !== 'QUESTION' || q[0].status === 'quarantined') {
    return res.status(409).json({ error: 'This thread is flagged. Handle it per the SAFETY-SOP, not as a coursework answer.' });
  }
  // Jay's reply is parent-visible only if the thread is a clean QUESTION with NO held reply anywhere.
  const { rows: heldRep } = await query(`SELECT 1 FROM question_replies WHERE question_id=$1 AND class <> 'QUESTION' LIMIT 1`, [id]);
  const pv = q[0].class === 'QUESTION' && q[0].status !== 'quarantined' && heldRep.length === 0;
  await tx(async (client) => {
    await client.query(`INSERT INTO question_replies (question_id, author_id, body, class, parent_visible) VALUES ($1,$2,$3,'QUESTION',$4)`, [id, req.user.id, body, pv]);
    await client.query(`UPDATE questions SET status='answered', first_response_at=COALESCE(first_response_at,now()), answered_at=now() WHERE id=$1`, [id]);
  });
  await notify(q[0].student_id, 'question_answered', 'Jay answered your question.', '#/questions');
  await logEvent({ student_id: q[0].student_id, actor_id: req.user.id, type: 'question_answered', entity_type: 'question', entity_id: id });
  res.json({ ok: true });
}));

// parent sees QUESTION-class threads only, for a linked teen
app.get('/api/parent/children/:id/questions', authRequired(), requireRole('parent'), h(async (req, res) => {
  const sid = parseInt(req.params.id, 10);
  if (!(await parentOf(req.user.id, sid))) return res.status(403).json({ error: 'not your teen' });
  const { rows: qs } = await query(`SELECT id, body, created_at FROM questions WHERE student_id=$1 AND parent_visible=TRUE AND class='QUESTION' ORDER BY created_at DESC`, [sid]);
  const threads = [];
  for (const q of qs) {
    const { rows: reps } = await query(`SELECT author_id, body FROM question_replies WHERE question_id=$1 AND parent_visible=TRUE AND class='QUESTION' ORDER BY created_at`, [q.id]);
    threads.push({ id: q.id, body: q.body, created_at: q.created_at, replies: reps.map((r) => ({ body: r.body })) });
  }
  res.json({ threads, note: 'You see coursework questions and answers. Anything a safety check set aside is not shown here.' });
}));

// ================= P3b: application report, first-dollar, exports, Stripe =================
const ACTION_KINDS = ['interview_done', 'voc_sheet_updated', 'offer_shown_to_adult', 'page_shipped', 'email_sent_to_list', 'outreach_sent', 'reply_received', 'call_booked', 'sale_made', 'post_published', 'scoreboard_week_logged', 'consent_collected'];
// copies the outsmart-app csvCell exactly: neutralize spreadsheet formula injection,
// then quote for commas/quotes/newlines. Student free text (names, dial_in) flows here.
function csvCell(v) { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

// student logs a real-world action (self-reported)
app.post('/api/me/actions', authRequired(), requireRole('student'), h(async (req, res) => {
  const kind = (req.body && req.body.action_kind || '').trim();
  if (!ACTION_KINDS.includes(kind)) return res.status(400).json({ error: 'unknown action' });
  const qty = Math.max(1, parseInt(req.body.qty || 1, 10) || 1);
  const note = (req.body.note || '').trim().slice(0, 300) || null;
  let amount = null;
  if (kind === 'sale_made' && req.body.amount_dollars != null && String(req.body.amount_dollars).trim() !== '') {
    const f = parseFloat(req.body.amount_dollars); amount = Number.isNaN(f) ? null : Math.round(f * 100);
  }
  let chapterId = null;
  if (req.body.chapter_key) { const { rows } = await query(`SELECT id FROM chapters WHERE stable_key=$1`, [req.body.chapter_key]); if (rows[0]) chapterId = rows[0].id; }
  const { rows } = await query(
    `INSERT INTO actions_log (student_id, chapter_id, action_kind, qty, amount_cents, note, occurred_on)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::date,CURRENT_DATE)) RETURNING id`,
    [req.user.id, chapterId, kind, qty, amount, note, req.body.occurred_on || null]
  );
  await logEvent({ student_id: req.user.id, actor_id: req.user.id, type: 'action_logged', entity_type: 'action', entity_id: rows[0].id, detail: { kind, qty } });
  if (kind === 'sale_made') {
    // First-Dollar Bell (manual): notify Jay and the linked parent (parent one-tap confirms it happened)
    await query(`INSERT INTO notifications (user_id, kind, body) SELECT id,'first_dollar',$1 FROM users WHERE role='admin' AND deleted_at IS NULL`,
      [`${req.user.first_name} logged a sale${amount ? ' of $' + (amount / 100) : ''}. Congratulate them personally, on the next call or by email.`]);
    const { rows: ps } = await query(`SELECT parent_id FROM family_links WHERE student_id=$1 AND status='active'`, [req.user.id]);
    for (const pr of ps) await notify(pr.parent_id, 'first_dollar', `${req.user.first_name} says they made a sale. Tap to confirm it happened.`, '#/');
  }
  res.json({ ok: true, id: rows[0].id, bell: kind === 'sale_made' });
}));

app.get('/api/me/actions', authRequired(), requireRole('student'), h(async (req, res) => {
  const { rows } = await query(`SELECT action_kind, qty, amount_cents, note, occurred_on, confirmed_at FROM actions_log WHERE student_id=$1 ORDER BY occurred_on DESC, id DESC LIMIT 50`, [req.user.id]);
  res.json({ actions: rows, kinds: ACTION_KINDS });
}));

// the application report: reading progress vs real-world applying, never blended (plan 3.3 / 5.1)
app.get('/api/admin/students/:id/report', authRequired(), requireRole('admin'), h(async (req, res) => {
  const sid = parseInt(req.params.id, 10);
  const { rows: u } = await query(`SELECT first_name, last_initial FROM users WHERE id=$1 AND role='student'`, [sid]);
  if (!u[0]) return res.status(404).json({ error: 'not found' });
  const { rows: reading } = await query(
    `SELECT (SELECT count(*) FROM progress WHERE student_id=$1 AND status='done')::int AS steps_done,
            (SELECT count(*) FROM artifacts WHERE student_id=$1 AND status IN ('submitted','verified'))::int AS docs_submitted,
            (SELECT count(*) FROM artifacts WHERE student_id=$1 AND status='verified')::int AS docs_verified`, [sid]);
  const { rows: applying } = await query(`SELECT action_kind, sum(qty)::int AS n, sum(COALESCE(amount_cents,0))::int AS cents FROM actions_log WHERE student_id=$1 GROUP BY action_kind ORDER BY action_kind`, [sid]);
  const { rows: weekly } = await query(`SELECT to_char(date_trunc('week',occurred_on),'YYYY-MM-DD') AS wk, count(*)::int AS n FROM actions_log WHERE student_id=$1 AND occurred_on >= CURRENT_DATE - INTERVAL '8 weeks' GROUP BY 1 ORDER BY 1`, [sid]);
  const { rows: mom } = await query(
    `SELECT count(*) FILTER (WHERE occurred_on >= date_trunc('week',CURRENT_DATE))::int AS this_wk,
            count(*) FILTER (WHERE occurred_on >= date_trunc('week',CURRENT_DATE) - INTERVAL '7 days' AND occurred_on < date_trunc('week',CURRENT_DATE))::int AS last_wk
       FROM actions_log WHERE student_id=$1`, [sid]);
  const { rows: fd } = await query(`SELECT id, occurred_on, amount_cents, confirmed_at FROM actions_log WHERE student_id=$1 AND action_kind='sale_made' ORDER BY occurred_on LIMIT 1`, [sid]);
  const momentum = mom[0].this_wk > mom[0].last_wk ? 'up' : mom[0].this_wk < mom[0].last_wk ? 'down' : 'flat';
  res.json({ student: u[0], reading: reading[0], applying, weekly, momentum, first_dollar: fd[0] || null, note: 'Every applying number is self-reported by the student.' });
}));

// parent confirms a logged sale (First-Dollar Bell). Writes confirmed_by/at on the row.
app.get('/api/parent/sales-to-confirm', authRequired(), requireRole('parent'), h(async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.amount_cents, a.occurred_on, u.first_name
       FROM actions_log a JOIN users u ON u.id=a.student_id
       JOIN family_links f ON f.student_id=a.student_id AND f.parent_id=$1 AND f.status='active'
      WHERE a.action_kind='sale_made' AND a.confirmed_at IS NULL ORDER BY a.occurred_on DESC`, [req.user.id]);
  res.json({ sales: rows });
}));
app.post('/api/parent/actions/:id/confirm-sale', authRequired(), requireRole('parent'), h(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { rows } = await query(
    `SELECT a.student_id FROM actions_log a JOIN family_links f ON f.student_id=a.student_id AND f.parent_id=$1 AND f.status='active'
      WHERE a.id=$2 AND a.action_kind='sale_made'`, [req.user.id, id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  await query(`UPDATE actions_log SET confirmed_by=$1, confirmed_at=now() WHERE id=$2 AND confirmed_at IS NULL`, [req.user.id, id]);
  await query(`INSERT INTO notifications (user_id, kind, body) SELECT id,'first_dollar_confirmed',$1 FROM users WHERE role='admin' AND deleted_at IS NULL`, [`A parent confirmed a first sale for ${rows[0].student_id}.`]);
  res.json({ ok: true });
}));

// binder export (markdown) + copy-my-brief (closes chapter 12's loop)
app.get('/api/me/binder/export', authRequired(), requireRole('student'), h(async (req, res) => {
  const { rows } = await query(`SELECT a.kind, a.data, a.status, c.number FROM artifacts a LEFT JOIN chapters c ON c.id=a.chapter_id WHERE a.student_id=$1 ORDER BY c.number NULLS LAST`, [req.user.id]);
  let md = `# My Business Binder\n\nExported ${new Date().toISOString().slice(0, 10)}. This is your work. You leave with everything.\n\n`;
  for (const a of rows) md += `## ${a.kind.replace(/_/g, ' ')} (${a.status})\n\n\`\`\`json\n${JSON.stringify(a.data, null, 2)}\n\`\`\`\n\n`;
  res.type('text/markdown').send(md);
}));
app.get('/api/me/brief', authRequired(), requireRole('student'), h(async (req, res) => {
  const { rows } = await query(`SELECT data FROM artifacts WHERE student_id=$1 AND kind='standing_brief'`, [req.user.id]);
  const b = (rows[0] && rows[0].data && rows[0].data.sections) || {};
  const md = `# MY STANDING BRIEF (paste this into any AI chat, first, every session)\n\n`
    + `## Who I am\n${b.who_i_am || '[fill this in]'}\n\n`
    + `## My files\n- MY-OFFER is the single source of truth for my product, price, and promise. If anything disagrees with it, it wins.\n\n`
    + `## Hard rules\n${b.hard_rules || 'Never fabricate. Verify before publishing. No fake scarcity. Education, not advice. A trusted adult is in the loop for money and accounts. I read everything before it ships.'}\n`;
  res.type('text/markdown').send(md);
}));

// CSV exports (audit-logged; quarantined question text is never exported)
async function auditExport(actorId, file) { await query(`INSERT INTO admin_audit_log (actor_id, action, detail) VALUES ($1,'export',$2)`, [actorId, JSON.stringify({ file })]); }
app.get('/api/admin/export/students.csv', authRequired(), requireRole('admin'), h(async (req, res) => {
  await auditExport(req.user.id, 'students');
  const { rows } = await query(`SELECT u.id, u.first_name, u.last_initial, u.account_state, u.call_group, (SELECT count(*) FROM artifacts a WHERE a.student_id=u.id AND a.status='verified') AS verified FROM users u WHERE role='student' AND deleted_at IS NULL ORDER BY u.id`);
  const out = ['id,first_name,last_initial,account_state,call_group,verified_docs'].concat(rows.map((r) => [r.id, r.first_name, r.last_initial, r.account_state, r.call_group, r.verified].map(csvCell).join(',')));
  res.type('text/csv').send(out.join('\n'));
}));
app.get('/api/admin/export/actions.csv', authRequired(), requireRole('admin'), h(async (req, res) => {
  await auditExport(req.user.id, 'actions');
  const { rows } = await query(`SELECT student_id, action_kind, qty, amount_cents, occurred_on, confirmed_at FROM actions_log ORDER BY id`);
  const out = ['student_id,action_kind,qty,amount_cents,occurred_on,confirmed_at'].concat(rows.map((r) => [r.student_id, r.action_kind, r.qty, r.amount_cents, r.occurred_on, r.confirmed_at].map(csvCell).join(',')));
  res.type('text/csv').send(out.join('\n'));
}));
app.get('/api/admin/export/scoreboard.csv', authRequired(), requireRole('admin'), h(async (req, res) => {
  await auditExport(req.user.id, 'scoreboard');
  const { rows } = await query(`SELECT student_id, week_start, clicks, leads, paid, revenue_cents, leak, learning, dial_in FROM scoreboard_weeks ORDER BY student_id, week_start`);
  const out = ['student_id,week_start,clicks,leads,paid,revenue_cents,leak,learning,dial_in'].concat(rows.map((r) => [r.student_id, r.week_start, r.clicks, r.leads, r.paid, r.revenue_cents, r.leak, r.learning, r.dial_in].map(csvCell).join(',')));
  res.type('text/csv').send(out.join('\n'));
}));
app.get('/api/admin/export/approvals.csv', authRequired(), requireRole('admin'), h(async (req, res) => {
  await auditExport(req.user.id, 'approvals');
  const { rows } = await query(`SELECT id, student_id, checkpoint_key, status, created_at, resolved_at FROM approvals ORDER BY id`);
  const out = ['id,student_id,checkpoint_key,status,created_at,resolved_at'].concat(rows.map((r) => [r.id, r.student_id, r.checkpoint_key, r.status, r.created_at, r.resolved_at].map(csvCell).join(',')));
  res.type('text/csv').send(out.join('\n'));
}));
app.get('/api/admin/export/artifacts.csv', authRequired(), requireRole('admin'), h(async (req, res) => {
  await auditExport(req.user.id, 'artifacts');
  const { rows } = await query(`SELECT id, student_id, kind, status, current_version, submitted_at, reviewed_at FROM artifacts ORDER BY id`);
  const out = ['id,student_id,kind,status,current_version,submitted_at,reviewed_at'].concat(rows.map((r) => [r.id, r.student_id, r.kind, r.status, r.current_version, r.submitted_at, r.reviewed_at].map(csvCell).join(',')));
  res.type('text/csv').send(out.join('\n'));
}));
// questions export: SLA/metadata ONLY, coursework (class=QUESTION) only. Never a body; quarantined rows excluded entirely.
app.get('/api/admin/export/questions.csv', authRequired(), requireRole('admin'), h(async (req, res) => {
  await auditExport(req.user.id, 'questions');
  const { rows } = await query(`SELECT id, student_id, qtype, status, created_at, first_response_at, answered_at FROM questions WHERE class='QUESTION' ORDER BY id`);
  const out = ['id,student_id,qtype,status,created_at,first_response_at,answered_at'].concat(rows.map((r) => [r.id, r.student_id, r.qtype, r.status, r.created_at, r.first_response_at, r.answered_at].map(csvCell).join(',')));
  res.type('text/csv').send(out.join('\n'));
}));

// ----- the app's OWN additive Stripe webhook (own secret; the site's webhook is untouched) -----
const MASTERMIND_KEYS = new Set(['entrepreneurship-program', 'investing-mastermind']); // read live from sites\outsmartthesystem-site
function verifyStripeSig(rawBuf, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(String(sigHeader).split(',').map((kv) => kv.split('=')));
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBuf.toString('utf8')}`).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected)); } catch (_) { return false; }
}
app.post('/webhooks/stripe', h(async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const production = (process.env.LAUNCH_MODE || 'preview') === 'production';
  // fail closed in production: never accept an unsigned event
  if (production && !secret) return res.status(503).json({ error: 'webhook secret not configured' });
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (secret && !verifyStripeSig(raw, req.headers['stripe-signature'], secret)) return res.status(400).json({ error: 'bad signature' });
  let evt; try { evt = JSON.parse(raw.toString('utf8')); } catch (_) { return res.status(400).json({ error: 'bad json' }); }
  if (evt.type !== 'checkout.session.completed') return res.json({ received: true, ignored: evt.type });
  const s = evt.data.object || {};
  if (s.payment_status && s.payment_status !== 'paid' && s.payment_status !== 'no_payment_required') return res.json({ received: true, ignored: 'unpaid' });
  const routeKey = (s.client_reference_id || (s.metadata && s.metadata.product) || '').toString().trim();
  const email = ((s.customer_details && s.customer_details.email) || s.customer_email || '').toLowerCase();
  const sessionId = s.id || null;
  if (!MASTERMIND_KEYS.has(routeKey)) {
    // side-hustle etc. take NO provisioning action (D1), just a log
    await query(`INSERT INTO admin_audit_log (actor_id, action, detail) VALUES (NULL,'stripe_logged',$1)`, [JSON.stringify({ routeKey, sessionId, email })]);
    return res.json({ received: true, logged: true, provisioned: false });
  }
  // mastermind provisioning requires a session id (for idempotency) and a real email; else log for manual handling
  if (!sessionId || !email) {
    await query(`INSERT INTO admin_audit_log (actor_id, action, detail) VALUES (NULL,'stripe_needs_manual',$1)`, [JSON.stringify({ routeKey, sessionId, email: email || null })]);
    return res.json({ received: true, provisioned: false, needs_manual: true });
  }
  const preview = !production;
  let setupUrl = null; let enrolled = false;
  await tx(async (client) => {
    const { rows: par } = await client.query(`SELECT id FROM users WHERE email=$1`, [email]);
    let parentId = par[0] ? par[0].id : null;
    if (!parentId) { const { rows } = await client.query(`INSERT INTO users (role, email, account_state) VALUES ('parent',$1,'created') RETURNING id`, [email]); parentId = rows[0].id; }
    // the enrollment write IS the idempotency point: a replay hits ON CONFLICT and no-ops
    const { rows: enr } = await client.query(
      `INSERT INTO enrollments (parent_id, program, source, stripe_session_id, status) VALUES ($1,'mastermind_995','stripe',$2,'active')
       ON CONFLICT (stripe_session_id) DO NOTHING RETURNING id`, [parentId, sessionId]
    );
    if (!enr[0]) return; // replay
    enrolled = true;
    const token = randomToken();
    await client.query(`INSERT INTO invites (kind, token_hash, target_user_id, expires_at) VALUES ('parent_setup',$1,$2,$3)`, [hashToken(token), parentId, new Date(Date.now() + 7 * 864e5)]);
    setupUrl = `${process.env.APP_URL || 'http://localhost:3000'}/#/parent-setup/${token}`;
  });
  if (!enrolled) return res.json({ received: true, idempotent: true });
  if (preview) {
    await query(`INSERT INTO admin_audit_log (actor_id, action, detail) VALUES (NULL,'stripe_provisioned_preview',$1)`, [JSON.stringify({ routeKey, email, setupUrl })]);
    console.log(`[stripe:preview] would email parent setup link to ${email}: ${setupUrl}`);
  } else {
    await sendEmail({ to: email, subject: 'Set up your Outsmart the System parent account', text: `You are in. Set your password and add your teen: ${setupUrl}`, html: null });
  }
  res.json({ received: true, provisioned: true, preview });
}));

// one-click digest unsubscribe (HMAC, plan 3.2). Matches digest.js token.
app.get('/unsubscribe', h(async (req, res) => {
  const p = parseInt(req.query.p, 10);
  const expected = crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev').update('unsub:' + p).digest('hex').slice(0, 32);
  if (!p || req.query.t !== expected) return res.status(400).send('Invalid link.');
  await query(`UPDATE users SET weekly_digest_opt_out=TRUE WHERE id=$1 AND role='parent'`, [p]);
  res.send('<p style="font-family:sans-serif;max-width:480px;margin:40px auto">You are unsubscribed from the weekly digest. You can turn it back on in the app.</p>');
}));

// ---------- static SPA ----------
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.get(/^\/(?!api|health|version|webhooks).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// error handler
app.use((err, req, res, next) => {
  if (err && err.httpStatus) return res.status(err.httpStatus).json({ error: err.clientMsg || 'conflict' });
  console.error('[error]', err.message);
  const bodyOut = { error: 'server error' };
  // the question channel never dead-ends, even on an unexpected error (SOP §5)
  if (req.path && req.path.startsWith('/api/questions')) bodyOut.crisis_lines = classifier.CRISIS_LINES;
  res.status(500).json(bodyOut);
});

const PORT = process.env.PORT || 3000;
async function boot() {
  try { await migrate(); console.log('[boot] migrate ok'); }
  catch (err) { console.error('[boot] migrate failed', err.message); }
  app.listen(PORT, () => {
    console.log(`[boot] ots-playbook-app listening on ${PORT} (LAUNCH_MODE=${LAUNCH_MODE}, QUESTIONS_ENABLED=${QUESTIONS_ENABLED})`);
  });
}
if (require.main === module) boot();
module.exports = app;

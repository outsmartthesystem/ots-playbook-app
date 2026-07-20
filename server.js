'use strict';
require('dotenv').config();
const path = require('path');
const express = require('express');
const compression = require('compression');
const cors = require('cors');

const fs = require('fs');
const { query, tx } = require('./lib/db');
const migrate = require('./migrate');
const artifacts = require('./lib/artifacts');
const {
  hashPassword, verifyPassword, signToken, randomToken, hashToken,
  authRequired, requireRole, loginRateLimit,
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
  };
}

// ---------- health / version (plan 5.6 counsel gate) ----------
app.get('/health', h(async (req, res) => {
  const missingCounsel = LAUNCH_MODE === 'production' ? COUNSEL_KEYS.filter((k) => !process.env[k]) : [];
  const ready = missingCounsel.length === 0;
  let db = 'unknown';
  try { await query('SELECT 1'); db = 'ok'; } catch (_) { db = 'error'; }
  res.status(ready && db === 'ok' ? 200 : 503).json({
    ready: ready && db === 'ok',
    launch_mode: LAUNCH_MODE,
    questions_enabled: QUESTIONS_ENABLED,
    counsel_signoff_complete: missingCounsel.length === 0,
    missing_counsel_signoffs: missingCounsel,
    db,
  });
}));

app.get('/version', (req, res) => {
  res.json({ app: 'ots-playbook-app', phase: 'P0', launch_mode: LAUNCH_MODE });
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
            MAX(e.created_at) AS last_activity,
            COUNT(p.*) FILTER (WHERE p.status='done') AS steps_done,
            COUNT(p.*) FILTER (WHERE p.status='parked') AS steps_parked
       FROM users u
       LEFT JOIN events e ON e.student_id = u.id
       LEFT JOIN progress p ON p.student_id = u.id
      WHERE u.role = 'student' AND u.deleted_at IS NULL
      GROUP BY u.id ORDER BY last_activity DESC NULLS LAST`
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

// ---------- static SPA ----------
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.get(/^\/(?!api|health|version|webhooks).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// error handler
app.use((err, req, res, next) => {
  if (err && err.httpStatus) return res.status(err.httpStatus).json({ error: err.clientMsg || 'conflict' });
  console.error('[error]', err.message);
  res.status(500).json({ error: 'server error' });
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

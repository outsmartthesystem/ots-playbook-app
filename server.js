'use strict';
require('dotenv').config();
const path = require('path');
const express = require('express');
const compression = require('compression');
const cors = require('cors');

const { query } = require('./lib/db');
const migrate = require('./migrate');
const {
  hashPassword, verifyPassword, signToken, randomToken, hashToken,
  authRequired, requireRole, loginRateLimit,
} = require('./lib/auth');

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

// "You are here" + next move for the student home
app.get('/api/me/next', authRequired(), requireRole('student'), h(async (req, res) => {
  const { rows } = await query(
    `SELECT st.stable_key, st.title, st.kind, ch.stable_key AS chapter_key, ch.number, ch.title AS chapter_title,
            COALESCE(p.status,'not_started') AS status
       FROM steps st JOIN chapters ch ON ch.id = st.chapter_id
       LEFT JOIN progress p ON p.step_id = st.id AND p.student_id = $1
      WHERE ch.number >= 1 AND st.is_active
        AND COALESCE(p.status,'not_started') NOT IN ('done')
      ORDER BY ch.number, st.position
      LIMIT 1`,
    [req.user.id]
  );
  const { rows: counts } = await query(
    `SELECT COUNT(*) FILTER (WHERE status='done') AS done, COUNT(*) FILTER (WHERE status='parked') AS parked
       FROM progress WHERE student_id = $1`, [req.user.id]
  );
  res.json({ next: rows[0] || null, done: Number(counts[0].done), parked: Number(counts[0].parked) });
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

// ---------- static SPA ----------
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.get(/^\/(?!api|health|version|webhooks).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// error handler
app.use((err, req, res, next) => {
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

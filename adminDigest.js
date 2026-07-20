'use strict';
// Weekly admin summary (plan P3b task 4). Monday morning: what needs Jay this week.
// DIGEST_DRY-safe. Idempotent per ISO week.
require('dotenv').config();
const { query } = require('./lib/db');
const { sendEmail, emailTemplate, escapeHtml, isDry } = require('./lib/email');

function phoenixNow() { return new Date(Date.now() - 7 * 3600 * 1000); }
function isoWeek() { const d = phoenixNow(); const y = d.getUTCFullYear(); const onejan = new Date(Date.UTC(y, 0, 1)); const wk = Math.ceil((((d - onejan) / 86400000) + onejan.getUTCDay() + 1) / 7); return `${y}-W${wk}`; }

async function run() {
  const dry = isDry();
  const week = isoWeek();
  const { rows: admins } = await query(`SELECT id, email FROM users WHERE role='admin' AND deleted_at IS NULL AND email IS NOT NULL`);
  if (!admins.length) { console.log('[adminDigest] no admin with email'); return; }
  const [students, review, approvals, flagged, dollars, quiet] = await Promise.all([
    query(`SELECT count(*)::int AS n FROM users WHERE role='student' AND account_state='active' AND deleted_at IS NULL`),
    query(`SELECT count(*)::int AS n FROM artifacts WHERE status='submitted'`),
    query(`SELECT count(*)::int AS n FROM approvals WHERE status='requested'`),
    query(`SELECT count(*)::int AS n FROM questions WHERE status='quarantined'`),
    query(`SELECT count(*)::int AS n FROM actions_log WHERE action_kind='sale_made' AND created_at > now() - interval '7 days'`),
    query(`SELECT u.first_name, (SELECT max(created_at) FROM events e WHERE e.student_id=u.id) AS last FROM users u WHERE role='student' AND account_state='active' AND deleted_at IS NULL`),
  ]);
  const quietList = quiet.rows.filter((r) => !r.last || (Date.now() - new Date(r.last).getTime()) / 86400000 >= 5).map((r) => r.first_name);
  const body = `<p><strong>${students.rows[0].n}</strong> active students.</p>
    <ul>
      <li>${review.rows[0].n} documents waiting for your review</li>
      <li>${approvals.rows[0].n} parent sign-offs pending</li>
      <li>${flagged.rows[0].n} safety-flagged messages to handle (per the SOP)</li>
      <li>${dollars.rows[0].n} sales logged this week (confirm + congratulate)</li>
    </ul>
    ${quietList.length ? `<p><strong>Who to call this week:</strong> ${escapeHtml(quietList.join(', '))}</p>` : '<p>Everyone active. Nice.</p>'}`;
  const html = emailTemplate({ heading: 'This week in your cohort', bodyHtml: body });
  for (const a of admins) {
    if (!dry) { try { await query(`INSERT INTO sent (target, kind, occurrence) VALUES ($1,'admin_digest',$2)`, [a.email, week]); } catch (_) { continue; } }
    await sendEmail({ to: a.email, subject: 'This week in your cohort', html, text: 'Your weekly cohort summary (open in an HTML email client).' });
  }
  console.log(`[adminDigest] sent/queued to ${admins.length} admin(s) (DIGEST_DRY=${process.env.DIGEST_DRY || '0'}).`);
}

if (require.main === module) run().then(() => process.exit(0)).catch((e) => { console.error('[adminDigest] failed', e); process.exit(1); });
module.exports = run;

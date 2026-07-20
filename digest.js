'use strict';
// Weekly parent digest (plan 3.2). One email per parent, a section per linked teen:
// progress delta, artifact of the week, Ask tonight, parent moments ahead. Quiet
// weeks 1 to 2 get a gentle nudge; week 3+ stops and raises the admin who-to-call
// flag instead (D10). DIGEST_DRY=1 prints instead of sending. Idempotent per ISO week.
require('dotenv').config();
const crypto = require('crypto');
const { query } = require('./lib/db');
const { sendEmail, emailTemplate, escapeHtml, isDry } = require('./lib/email');
const { ASK_TONIGHT, CHECKPOINTS_BY_KEY } = require('./lib/family');

function phoenixNow() { return new Date(Date.now() - 7 * 3600 * 1000); }
function isoWeek() { const d = phoenixNow(); const y = d.getUTCFullYear(); const onejan = new Date(Date.UTC(y, 0, 1)); const wk = Math.ceil((((d - onejan) / 86400000) + onejan.getUTCDay() + 1) / 7); return `${y}-W${wk}`; }
function days(t) { return t ? (Date.now() - new Date(t).getTime()) / 86400000 : 999; }
function unsubToken(id) { return crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev').update('unsub:' + id).digest('hex').slice(0, 32); }

async function currentChapter(studentId) {
  // chapter = documents submitted + 1 (artifact-gated, simplified for the digest)
  const { rows } = await query(`SELECT COUNT(*)::int AS n FROM artifacts WHERE student_id=$1 AND status IN ('submitted','verified')`, [studentId]);
  return Math.min(12, rows[0].n + 1);
}

async function buildChildSection(child, weekNum, week, dry) {
  const sid = child.id;
  const { rows: last } = await query(`SELECT max(created_at) AS last FROM events WHERE student_id=$1`, [sid]);
  const idle = days(last[0].last);
  // week 3+ of silence: no parent email, raise the admin flag instead (D10). Once per child per ISO week, never in dry.
  if (idle >= 21) {
    if (!dry) {
      let firstThisWeek = true;
      try { await query(`INSERT INTO sent (target, kind, occurrence) VALUES ($1,'who_to_call',$2)`, ['child:' + sid, week]); }
      catch (_) { firstThisWeek = false; }
      if (firstThisWeek) {
        await query(`INSERT INTO notifications (user_id, kind, body) SELECT id,'who_to_call',$1 FROM users WHERE role='admin' AND deleted_at IS NULL`,
          [`${child.first_name} has been quiet ${Math.floor(idle)} days. Worth a call.`]);
      }
    }
    return null; // skip this child in the parent email
  }
  const { rows: doneWk } = await query(`SELECT COUNT(*)::int AS n FROM events WHERE student_id=$1 AND type='step_done' AND created_at > now() - interval '7 days'`, [sid]);
  const { rows: subCount } = await query(`SELECT COUNT(*)::int AS n FROM artifacts WHERE student_id=$1 AND status IN ('submitted','verified')`, [sid]);
  const { rows: verWk } = await query(`SELECT kind FROM artifacts WHERE student_id=$1 AND status='verified' AND reviewed_at > now() - interval '7 days'`, [sid]);
  const { rows: aotw } = await query(`SELECT kind, submitted_at FROM artifacts WHERE student_id=$1 AND status IN ('submitted','verified') ORDER BY COALESCE(reviewed_at,submitted_at) DESC LIMIT 1`, [sid]);
  const { rows: appr } = await query(`SELECT checkpoint_key, created_at FROM approvals WHERE student_id=$1 AND status='requested' ORDER BY created_at LIMIT 1`, [sid]);
  const ch = await currentChapter(sid);
  const prompts = ASK_TONIGHT[ch] || ASK_TONIGHT[1];
  const ask = prompts[weekNum % prompts.length];

  const quiet = idle >= 7;
  const delta = quiet
    ? `${escapeHtml(child.first_name)} did not log anything this week. That is worth one gentle question, not a lecture.`
    : `${escapeHtml(child.first_name)} marked ${doneWk[0].n} step(s) done this week. ${verWk.length ? `Coach Jay verified their ${escapeHtml(verWk[0].kind.replace(/_/g, ' '))}. ` : ''}${subCount[0].n} of 12 documents submitted.`;

  let html = `<h2 style="font-size:15px;color:#1f4e6b">${escapeHtml(child.first_name)}</h2><p>${delta}</p>`;
  if (aotw[0] && !quiet) html += `<p><strong>Document of the week:</strong> ${escapeHtml(aotw[0].kind.replace(/_/g, ' '))}. You can read it in the app.</p>`;
  html += `<p><strong>Ask tonight:</strong> ${escapeHtml(ask)}</p>`;
  if (appr[0]) html += `<p><strong>Waiting on you:</strong> ${escapeHtml((CHECKPOINTS_BY_KEY[appr[0].checkpoint_key] || {}).text || 'a sign-off')} (open ${Math.floor(days(appr[0].created_at))} days).</p>`;
  return html;
}

async function run() {
  const week = isoWeek();
  const weekNum = parseInt(week.split('W')[1], 10) || 0;
  const dry = isDry();
  const { rows: parents } = await query(
    `SELECT id, email, first_name FROM users WHERE role='parent' AND account_state='active' AND weekly_digest_opt_out=FALSE AND deleted_at IS NULL AND email IS NOT NULL`
  );
  let sent = 0;
  for (const p of parents) {
    const { rows: children } = await query(
      `SELECT u.id, u.first_name FROM users u JOIN family_links f ON f.student_id=u.id WHERE f.parent_id=$1 AND f.status='active' AND u.deleted_at IS NULL`, [p.id]
    );
    const sections = [];
    for (const c of children) { const s = await buildChildSection(c, weekNum, week, dry); if (s) sections.push(s); }
    if (!sections.length) continue; // nothing to say (all quiet 3+ weeks)
    if (!dry) {
      // idempotency: once per ISO week per parent (dry runs never persist)
      try { await query(`INSERT INTO sent (target, kind, occurrence) VALUES ($1,'digest',$2)`, [p.email, week]); }
      catch (_) { continue; } // already sent this week
    }
    const base = process.env.APP_URL || 'http://localhost:3000';
    const unsub = `${base}/unsubscribe?p=${p.id}&t=${unsubToken(p.id)}`;
    const body = sections.join('<hr style="border:0;border-top:1px solid #eee">')
      + `<p style="font-size:11px;color:#888;margin-top:20px">You get this weekly. <a href="${unsub}">Unsubscribe</a>.</p>`;
    const html = emailTemplate({ heading: 'This week in the playbook', bodyHtml: body });
    await sendEmail({ to: p.email, subject: 'This week in the playbook', html, text: 'Your weekly teen progress update (open in an HTML email client).' });
    if (!dry) await query(`UPDATE users SET last_weekly_digest_at=now() WHERE id=$1`, [p.id]);
    sent += 1;
  }
  console.log(`[digest] processed ${parents.length} parents, sent/queued ${sent} (DIGEST_DRY=${process.env.DIGEST_DRY || '0'}).`);
}

if (require.main === module) run().then(() => process.exit(0)).catch((e) => { console.error('[digest] failed', e); process.exit(1); });
module.exports = run;

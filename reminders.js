'use strict';
// Scoreboard reminders + approval nudges (plan 3.2 / 4.5). Practices the playbook's
// own one-follow-up rule: on the review day, one reminder; the next morning, one
// nudge; then stop. The `sent` table makes each send once-only (atomic dedup).
require('dotenv').config();
const { query } = require('./lib/db');
const { sendEmail } = require('./lib/email');
const { CHECKPOINTS_BY_KEY } = require('./lib/family');

function phoenixNow() { return new Date(Date.now() - 7 * 3600 * 1000); }
function phoenixWeekday() { return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][phoenixNow().getUTCDay()]; }
function mondayOfPhoenix() { const d = phoenixNow(); const diff = (d.getUTCDay() + 6) % 7; const m = new Date(d); m.setUTCDate(d.getUTCDate() - diff); return m.toISOString().slice(0, 10); }

// send once for (target, kind, occurrence); returns false if already sent
async function onceOnly(target, kind, occurrence) {
  try { await query(`INSERT INTO sent (target, kind, occurrence) VALUES ($1,$2,$3)`, [target, kind, occurrence]); return true; }
  catch (_) { return false; }
}
async function notifyBoth(userId, email, kind, body, occurrence) {
  await query(`INSERT INTO notifications (user_id, kind, body, link) VALUES ($1,$2,$3,'#/score')`, [userId, kind, body]);
  if (email) await sendEmail({ to: email, subject: 'Playbook reminder', text: body, html: null });
}

async function run() {
  const today = phoenixWeekday();
  const monday = mondayOfPhoenix();
  const yesterdayMonday = (() => { const d = phoenixNow(); const y = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][(d.getUTCDay() + 6) % 7]; return y; })();

  // 1) scoreboard reminders: students at/after chapter 10 whose review day is today (reminder)
  //    or was yesterday (nudge), and who have not filled this week's scoreboard.
  const { rows: students } = await query(
    `SELECT u.id, u.email, u.first_name, u.review_day,
            (SELECT count(*) FROM scoreboard_weeks s WHERE s.student_id=u.id AND s.week_start=$1) AS filled
       FROM users u
      WHERE u.role='student' AND u.account_state='active' AND u.deleted_at IS NULL
        -- only students who have reached the scoreboard chapter (ch 10 ~ 9 documents submitted)
        AND (SELECT count(*) FROM artifacts a WHERE a.student_id=u.id AND a.status IN ('submitted','verified')) >= 9`, [monday]
  );
  let reminders = 0;
  for (const s of students) {
    if (Number(s.filled) > 0) continue;
    if (s.review_day === today) {
      if (await onceOnly('student:' + s.id, 'score_reminder', monday)) {
        await notifyBoth(s.id, s.email, 'score_reminder', '20 minutes. Numbers first, feelings second. Fill in your scoreboard.', monday);
        reminders += 1;
      }
    } else if (s.review_day === yesterdayMonday) {
      if (await onceOnly('student:' + s.id, 'score_nudge', monday)) {
        await notifyBoth(s.id, s.email, 'score_nudge', 'One more nudge on your scoreboard, then I will leave it. A true zero beats a comfortable guess.', monday);
        reminders += 1;
      }
    }
  }

  // 2) approval nudges: a parent sign-off open 3+ days gets one reminder.
  const { rows: appr } = await query(
    `SELECT a.id, a.checkpoint_key, a.parent_id, u.email, u.id AS parent_uid
       FROM approvals a JOIN users u ON u.id=a.parent_id
      WHERE a.status='requested' AND a.created_at < now() - interval '3 days' AND u.deleted_at IS NULL`
  );
  let apprNudges = 0;
  for (const a of appr) {
    if (await onceOnly('approval:' + a.id, 'approval_nudge', 'once')) {
      const cp = CHECKPOINTS_BY_KEY[a.checkpoint_key] || {};
      await query(`INSERT INTO notifications (user_id, kind, body, link) VALUES ($1,'approval_nudge',$2,'#/approvals')`, [a.parent_uid, `Still waiting on your sign-off: ${cp.text || ''}`]);
      if (a.email) await sendEmail({ to: a.email, subject: 'A sign-off is waiting', text: cp.text || 'Your teen is waiting on a sign-off.', html: null });
      await query(`INSERT INTO approval_events (approval_id, actor_id, actor_role, event) VALUES ($1,NULL,'system','reminded')`, [a.id]);
      apprNudges += 1;
    }
  }
  console.log(`[reminders] scoreboard=${reminders}, approval_nudges=${apprNudges} (today=${today}).`);
}

if (require.main === module) run().then(() => process.exit(0)).catch((e) => { console.error('[reminders] failed', e); process.exit(1); });
module.exports = run;

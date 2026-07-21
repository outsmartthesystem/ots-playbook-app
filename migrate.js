'use strict';
// The ONE idempotent schema source, run on boot and via `npm run migrate`
// (plan 6.2; schema.sql is a tombstone, per outsmart-app's own lesson).
// P0 tables only. Later phases ADD tables to this same file; never drop.
require('dotenv').config();
const { query } = require('./lib/db');

const STATEMENTS = [
  // --- identity ---
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('admin','student','parent')),
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    password_hash TEXT,
    first_name TEXT NOT NULL DEFAULT '',
    last_initial TEXT,
    age_at_signup INT,
    signup_date DATE DEFAULT CURRENT_DATE,
    is_adult_student BOOLEAN NOT NULL DEFAULT FALSE,
    token_version INT NOT NULL DEFAULT 0,
    has_onboarded BOOLEAN NOT NULL DEFAULT FALSE,
    review_day TEXT NOT NULL DEFAULT 'friday',
    call_group TEXT,
    weekly_digest_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
    last_weekly_digest_at TIMESTAMPTZ,
    reset_token_hash TEXT,
    reset_token_expires TIMESTAMPTZ,
    account_state TEXT NOT NULL DEFAULT 'created'
      CHECK (account_state IN ('created','claimed','active','paused','closed')),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS family_links (
    id SERIAL PRIMARY KEY,
    parent_id INT NOT NULL REFERENCES users(id),
    student_id INT NOT NULL REFERENCES users(id),
    created_by INT REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (parent_id, student_id)
  )`,

  `CREATE TABLE IF NOT EXISTS consent_acknowledgements (
    id SERIAL PRIMARY KEY,
    parent_id INT NOT NULL REFERENCES users(id),
    key TEXT NOT NULL,
    acked_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS invites (
    id SERIAL PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('parent_setup','student_claim')),
    token_hash TEXT NOT NULL,
    target_user_id INT REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS enrollments (
    id SERIAL PRIMARY KEY,
    parent_id INT REFERENCES users(id),
    student_id INT REFERENCES users(id),
    program TEXT NOT NULL CHECK (program IN ('mastermind_995','side_hustle_97','manual_grant')),
    source TEXT NOT NULL CHECK (source IN ('stripe','admin_invite')),
    stripe_session_id TEXT UNIQUE,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','paused','completed','refunded')),
    started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // subscription-lifecycle columns for existing databases (idempotent)
  `ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`,
  `ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`,

  // --- content (populated by ingest.js) ---
  `CREATE TABLE IF NOT EXISTS content_versions (
    id SERIAL PRIMARY KEY,
    git_hash TEXT,
    counts JSONB NOT NULL DEFAULT '{}',
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS chapters (
    id SERIAL PRIMARY KEY,
    stable_key TEXT UNIQUE NOT NULL,
    number INT NOT NULL,
    title TEXT NOT NULL,
    walk_away TEXT,
    rough_time TEXT,
    congrats_video_url TEXT,               -- D12: optional per-chapter Jay congrats clip
    body_sections JSONB NOT NULL DEFAULT '[]',
    source_hash TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
  )`,

  `CREATE TABLE IF NOT EXISTS steps (
    id SERIAL PRIMARY KEY,
    stable_key TEXT UNIQUE NOT NULL,
    chapter_id INT NOT NULL REFERENCES chapters(id),
    position INT NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('read','artifact','action','checklist')),
    teach_md TEXT DEFAULT '',
    jay_md TEXT DEFAULT '',
    now_you_md TEXT DEFAULT '',
    evidence_fields JSONB,
    artifact_section TEXT,
    requires_checkpoint TEXT,
    acceptance_proof TEXT,
    source_hash TEXT,
    content_updated_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
  )`,

  `CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    stable_key TEXT UNIQUE NOT NULL,
    chapter_id INT NOT NULL REFERENCES chapters(id),
    step_id INT REFERENCES steps(id),
    title TEXT,
    body TEXT NOT NULL DEFAULT '',
    body_form TEXT,
    is_worksheet BOOLEAN NOT NULL DEFAULT FALSE
  )`,

  `CREATE TABLE IF NOT EXISTS checklist_items (
    id SERIAL PRIMARY KEY,
    stable_key TEXT UNIQUE NOT NULL,
    chapter_id INT NOT NULL REFERENCES chapters(id),
    position INT NOT NULL,
    text TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS glossary_terms (
    id SERIAL PRIMARY KEY,
    chapter_id INT REFERENCES chapters(id),   -- NULL = master glossary
    term TEXT NOT NULL,
    definition TEXT NOT NULL
  )`,

  // --- progress + activity ---
  `CREATE TABLE IF NOT EXISTS progress (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id),
    step_id INT NOT NULL REFERENCES steps(id),
    status TEXT NOT NULL DEFAULT 'not_started'
      CHECK (status IN ('not_started','in_progress','done','parked')),
    done_note TEXT NOT NULL DEFAULT '',
    evidence JSONB NOT NULL DEFAULT '{}',
    parked_reason TEXT,
    content_version_seen INT,
    done_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, step_id)
  )`,

  // per-student checklist item state (the "Check your work" items become interactive)
  `CREATE TABLE IF NOT EXISTS checklist_progress (
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checklist_key TEXT NOT NULL,
    checked BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (student_id, checklist_key)
  )`,

  // append-only activity log; THIS TABLE is the application report (plan 6.3)
  `CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES users(id),
    actor_id INT REFERENCES users(id),
    type TEXT NOT NULL,
    entity_type TEXT,
    entity_id INT,
    detail JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS admin_audit_log (
    id SERIAL PRIMARY KEY,
    actor_id INT REFERENCES users(id),
    action TEXT NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,

  // reminder dedup (plan 6.3): atomic once-only sends
  `CREATE TABLE IF NOT EXISTS sent (
    id SERIAL PRIMARY KEY,
    target TEXT NOT NULL,
    kind TEXT NOT NULL,
    occurrence TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (target, kind, occurrence)
  )`,

  // --- P1: the Business Binder ---
  `CREATE TABLE IF NOT EXISTS artifacts (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id),
    chapter_id INT REFERENCES chapters(id),
    kind TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft','parked','submitted','returned','verified')),
    current_version INT NOT NULL DEFAULT 1,
    open_flag_count INT NOT NULL DEFAULT 0,
    parked_reason TEXT,
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewed_by INT REFERENCES users(id),
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, kind)
  )`,

  `CREATE TABLE IF NOT EXISTS artifact_versions (
    id SERIAL PRIMARY KEY,
    artifact_id INT NOT NULL REFERENCES artifacts(id),
    version INT NOT NULL,
    data JSONB NOT NULL,
    status_at_save TEXT NOT NULL,
    edited_by INT REFERENCES users(id),
    change_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (artifact_id, version)
  )`,

  `CREATE TABLE IF NOT EXISTS pivot_entries (
    id SERIAL PRIMARY KEY,
    artifact_id INT NOT NULL REFERENCES artifacts(id),
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT NOT NULL,
    evidence TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS gate_runs (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id),
    published_thing_ref TEXT NOT NULL,
    answers JSONB NOT NULL DEFAULT '[]',
    passed BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS review_snippets (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    times_used INT NOT NULL DEFAULT 0
  )`,

  // --- P2: the family layer ---
  `CREATE TABLE IF NOT EXISTS approvals (
    id SERIAL PRIMARY KEY,
    checkpoint_key TEXT NOT NULL,
    student_id INT NOT NULL REFERENCES users(id),
    parent_id INT REFERENCES users(id),
    subject_ref TEXT,
    status TEXT NOT NULL DEFAULT 'requested'
      CHECK (status IN ('requested','approved','declined','revoked')),
    note TEXT,
    release_reference TEXT,                       -- D11: text reference to a signed release; no file upload v1
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
  )`,

  `CREATE TABLE IF NOT EXISTS approval_events (
    id SERIAL PRIMARY KEY,
    approval_id INT NOT NULL REFERENCES approvals(id),
    actor_id INT REFERENCES users(id),
    actor_role TEXT,
    event TEXT NOT NULL,                           -- requested | viewed | approved | declined | revoked | reminded
    note TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()  -- append-only, never UPDATE/DELETE
  )`,

  `CREATE TABLE IF NOT EXISTS scoreboard_weeks (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id),
    week_start DATE NOT NULL,
    front_door TEXT,
    clicks INT, clicks_unknown BOOLEAN NOT NULL DEFAULT FALSE,
    leads INT, leads_unknown BOOLEAN NOT NULL DEFAULT FALSE,
    paid INT, paid_unknown BOOLEAN NOT NULL DEFAULT FALSE,
    revenue_cents INT, revenue_unknown BOOLEAN NOT NULL DEFAULT FALSE,
    posts_shipped INT, best_post TEXT, hand_counted_extras TEXT,
    leak TEXT NOT NULL DEFAULT '', learning TEXT NOT NULL DEFAULT '', dial_in TEXT NOT NULL DEFAULT '',
    filled_late BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, week_start)
  )`,

  // --- P3a: the question channel (stays behind QUESTIONS_ENABLED) ---
  `CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id),
    chapter_id INT REFERENCES chapters(id),
    step_id INT REFERENCES steps(id),
    body TEXT NOT NULL CHECK (length(body) <= 2000),
    artifact_snapshot_version INT,
    qtype TEXT,                                   -- stuck | tool | is_this_honest | scared_to_send | other
    class TEXT NOT NULL DEFAULT 'PENDING',        -- routing table in lib/classifier.js
    parent_visible BOOLEAN NOT NULL DEFAULT FALSE,-- TRUE only when class = QUESTION
    status TEXT NOT NULL DEFAULT 'open'
      CHECK (status IN ('open','answered','closed','quarantined')),
    first_response_at TIMESTAMPTZ,
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS question_replies (
    id SERIAL PRIMARY KEY,
    question_id INT NOT NULL REFERENCES questions(id),
    author_id INT REFERENCES users(id),
    body TEXT NOT NULL,
    class TEXT NOT NULL DEFAULT 'PENDING',
    parent_visible BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()  -- immutable; a correction is a new reply
  )`,

  `CREATE TABLE IF NOT EXISTS canned_answers (
    id SERIAL PRIMARY KEY,
    chapter_id INT REFERENCES chapters(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    times_used INT NOT NULL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS safety_events (
    id SERIAL PRIMARY KEY,
    question_id INT REFERENCES questions(id),
    reply_id INT REFERENCES question_replies(id),
    class TEXT NOT NULL,
    severity TEXT NOT NULL,
    responder_notified_at TIMESTAMPTZ,
    acked_at TIMESTAMPTZ,
    ack_by INT REFERENCES users(id),
    outcome_note_redacted TEXT,                   -- NEVER a student quote
    retention_hold BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_questions_student ON questions(student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_replies_question ON question_replies(question_id)`,

  // --- P3b: the application report (real-world actions) ---
  `CREATE TABLE IF NOT EXISTS actions_log (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id),
    chapter_id INT REFERENCES chapters(id),
    action_kind TEXT NOT NULL,                    -- fixed enum (see lib below); self-reported
    qty INT NOT NULL DEFAULT 1,
    amount_cents INT,                             -- for sale_made
    note TEXT,
    occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
    confirmed_by INT REFERENCES users(id),        -- parent one-tap confirm on sale_made rows
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_actions_student ON actions_log(student_id)`,

  // helpful indexes
  `CREATE INDEX IF NOT EXISTS idx_approvals_student ON approvals(student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_approvals_parent ON approvals(parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_scoreboard_student ON scoreboard_weeks(student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_artifacts_student ON artifacts(student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_artifacts_status ON artifacts(status)`,
  `CREATE INDEX IF NOT EXISTS idx_artifact_versions_artifact ON artifact_versions(artifact_id)`,
  `CREATE INDEX IF NOT EXISTS idx_progress_student ON progress(student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_events_student ON events(student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_steps_chapter ON steps(chapter_id)`,
  `CREATE INDEX IF NOT EXISTS idx_family_parent ON family_links(parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_family_student ON family_links(student_id)`,
];

// seed config (D7 sla, D10 quiet-week, attention weights) idempotently
const CONFIG_SEED = [
  ['sla_business_days', '2'],           // D7
  ['quiet_week_flag_threshold', '3'],   // D10: flag Jay at week 3
  ['attn_weight_days_idle', '1.0'],
  ['attn_weight_open_question_age', '1.0'],
  ['attn_weight_returned_untouched_age', '1.0'],
  ['attn_weight_pending_approval_age', '1.0'],
];

async function migrate() {
  for (const stmt of STATEMENTS) {
    await query(stmt);
  }
  for (const [key, value] of CONFIG_SEED) {
    await query(
      `INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [key, value]
    );
  }
  // seed review snippets once (Jay's reusable Return/Verify notes; plan P1 task 6)
  const { rows: rs } = await query(`SELECT COUNT(*)::int AS n FROM review_snippets`);
  if (rs[0].n === 0) {
    const snippets = [
      ['Add a real quote', 'This is strong. Before I verify it, point each problem at a real quote from your VoC sheet, or flag it "no source yet".'],
      ['Make the price defensible', 'Good progress. Write the "why" next to each value so every number is one you could say out loud and back up.'],
      ['Honest and clear', 'This reads honest and clear. Verified. Nice work.'],
    ];
    for (const [title, body] of snippets) {
      await query(`INSERT INTO review_snippets (title, body) VALUES ($1, $2)`, [title, body]);
    }
  }
  // seed a few canned answers for the question inbox (plan P3a task 4)
  const { rows: ca } = await query(`SELECT COUNT(*)::int AS n FROM canned_answers`);
  if (ca[0].n === 0) {
    const answers = [
      ['Point it at a real quote', 'Good question. Open your VoC sheet and pick the one real quote that fits. If none fits yet, flag it "no source yet" and keep going.'],
      ['Start with one conversation', 'You do not need the whole thing figured out. Line up one real conversation this week. That is the next move.'],
      ['That is honest', 'Yes, that is the honest way to do it. Ship it.'],
    ];
    for (const [title, body] of answers) await query(`INSERT INTO canned_answers (title, body) VALUES ($1,$2)`, [title, body]);
  }
  return STATEMENTS.length;
}

module.exports = migrate;

if (require.main === module) {
  migrate()
    .then((n) => { console.log(`[migrate] applied ${n} statements + config seed. OK.`); process.exit(0); })
    .catch((err) => { console.error('[migrate] FAILED', err); process.exit(1); });
}

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
    status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','paused','completed','refunded')),
    started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

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

  // helpful indexes
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
  return STATEMENTS.length;
}

module.exports = migrate;

if (require.main === module) {
  migrate()
    .then((n) => { console.log(`[migrate] applied ${n} statements + config seed. OK.`); process.exit(0); })
    .catch((err) => { console.error('[migrate] FAILED', err); process.exit(1); });
}

# ots-playbook-app

The Teen Business Playbook as a three-role app (admin, student, parent). The student's
**Business Binder** of typed, versioned artifacts is the data model; progress equals shipped
artifacts and logged real-world actions, never screens viewed.

**Full spec (single source of truth):** `../ots-content/strategy/teen-entrepreneur-app-plan-2026-07-20.md`.
This README covers running the code. When a decision changes, update the plan first, then build.

## Status

- **P0 (walking skeleton): built.** Auth + roles, idempotent schema, content ingest from the
  playbook, student SPA (Home / Playbook / chapter / step with required done-note and park),
  admin cockpit v1 (student list, create demo student + claim link, activity timeline).
- **P1 (Binder): built.** Typed artifacts with version history and pivot logging; the honesty
  engine (BrandScript problems need a quote ref or an explicit "no source yet" flag; offer claims
  need a proof source; D13 one-quote-per-bucket VoC gate); structured editors for chapters 1-3 and
  a guided editor for 4-12; submit with the honesty-mirror confirm and the ON RECORD celebration;
  Jay's review loop (queue, verify, return-with-note, acceptance-proof pane); the publish gate and
  a gated `/api/publish`; artifact-gated progression; three-promises onboarding; Elena's read-only
  demo binder. Adversarially reviewed (18 findings, all fixed, incl. a critical un-verify bug). The
  honesty-engine logic has unit tests (`npm test`, 12 passing, no database needed).
- **P2 (family layer): built.** Parent accounts (setup-link + four consent boxes), "Add your teen"
  with the 13+ age gate, the link-pending hold for unlinked minors (enforced in the per-request auth
  check). Parent dashboard (documents, scoreboard trend, action-needed), read-only with no write path
  into student work. The 12 approval checkpoints (request / approve / decline / revoke, append-only
  events incl. "viewed"), with artifact verify blocked until the required parent sign-off is approved.
  The Chapter 10 scoreboard loop (unknown-vs-zero distinction, skipped weeks shown as gaps, review-day
  home takeover). `digest.js` weekly parent email (four sections, Ask-tonight bank, quiet-week D10
  logic, HMAC unsubscribe, DIGEST_DRY-safe) and `reminders.js` (scoreboard reminder + one nudge, approval
  nudges, `sent`-table dedup) as Render cron jobs. Admin cohort v2 (attention score, flags, queue tiles).
  Privacy page. Adversarially reviewed (10 findings, all fixed).
- **P3a (question channel + safety core): built, and HARD-GATED OFF.** The chapter-anchored Q&A
  channel with the ported 7-class classifier (`lib/classifier.js`: fail-closed to held, a keyword
  safety-net that can only escalate, model call when `CLASSIFIER_API_KEY` is set), parent-visible only
  on class QUESTION, responder alerts that carry no quotes, quarantine-read audit logging, rate limits
  and crisis lines on every error, and the admin inbox. `docs/SAFETY-SOP.md` forked with the routing
  table, the no-DM ban, and preserve-not-purge. `QUESTIONS_ENABLED` stays 0 until the red-team harness
  passes against the live classifier AND counsel signs off (D6). The offline red-team harness
  (`test/redteam.test.js`) proves the fail-closed and keyword-net properties with no database.
  Adversarially reviewed (10 findings, all fixed, incl. a CRITICAL thread-visibility leak on a serious
  reply). Tests: 17 passing.
- P3b (cockpit + Stripe provisioning): not built.
- P4 (AI copilot): deferred per D4 until after P3b.

## Locked decisions (2026-07-20)

D1 mastermind-only ($995). D2 subdomain `hustle.outsmartthesystem.org`. D3 Jay answers questions.
D4 copilot deferred until after P3b. D5 rolling + `call_group` labels. **D6 core app active; the
teen-to-adult QUESTION CHANNEL stays gated behind `QUESTIONS_ENABLED` + the four `COUNSEL_SIGNOFF_*`
vars + a red-team pass. Parent consent does not discharge mandatory-reporting duties; Jay flips the
channel on after counsel signs off.** D7 SLA 2 business days. D8 username login supported. D9 raw,
labeled parent scoreboard. D10 quiet-week: flag Jay at week 3. D11 in-app consent attestation + text.
D12 12 real-Jay HeyGen Avatar V congrats clips (slots ship empty; clip generation is a separate
Jay-reviewed task). D13 VoC presence gate = one quote per bucket.

## Run it locally

Requires Node 20+ and a Postgres 16 database.

```
cp .env.example .env         # set DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm run sync-content         # copy playbook markdown from ../ots-content/sop into content/playbook (committed)
npm run migrate              # create/upgrade the schema (idempotent, also runs on boot)
npm run ingest               # parse content/playbook into the DB (use -- --dry to preview)
npm run createAdmin          # create Jay's admin from ADMIN_* env vars
npm start                    # http://localhost:3000
```

Content is edited only in `../ots-content/sop`. `sync-content.js` copies it here verbatim;
`ingest.js` reads the committed copies (the deployed app cannot see ots-content).

## Verify (P0 acceptance proofs, plan section P0)

- `npm test` — ingest idempotence + the chapter-1 golden parse. **Runs with no database.** (Passing.)
- `node ingest.js --dry` — prints parsed counts (13 chapters, ~126 steps, ~39 templates, ~155
  checklist items, ~394 glossary terms). **No database.** (Passing.)
- With a database: `npm run migrate && npm run createAdmin`, then `curl -s localhost:3000/health`
  (reports launch mode + counsel status), log in as admin in the UI, create a demo student, open the
  claim link, set a password, mark a step done with a note, and confirm it survives a restart and
  shows in the admin activity timeline.

## Safety gates (do not remove)

- `/health` returns `ready:false` when `LAUNCH_MODE=production` and any `COUNSEL_SIGNOFF_*` var is
  unset. Preview mode needs no counsel vars.
- `QUESTIONS_ENABLED=0` until the P3a channel is built, counsel signs off on mandatory reporting,
  and the red-team harness passes. This is the D6 safety hold.
- Paused accounts are read-only. Deleted accounts and bumped `token_version` drop live sessions.

## Do-not-touch (verified every phase)

`outsmart-app`, `ots-teen-agent`, the live site + its Stripe webhook + GHL, and the `ots-content/sop`
originals are never modified by this app. This is a new repo, new database, new Render service, new
subdomain. Patterns are copied from outsmart-app, never linked.

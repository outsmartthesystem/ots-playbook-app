# DEPLOY.md — ots-playbook-app

The build (P0 to P3b) is done. This is the ordered path from a fresh Render account to
real students. It is the **production gate** from the plan (section 5.6), turned into a
checklist. `/health` reports `ready:false` until the gate is fully passed, on purpose.

Legend: **[you]** needs your accounts, credentials, or a decision (do it yourself).
**[safe]** is a mechanical step I can help drive in a browser if you are logged in.
**[counsel]** must not go live until a lawyer signs off.

Timezone note: all cron jobs and dates use America/Phoenix (no DST).

---

## Phase A. Provision infrastructure on Render

1. **[you]** Log in to Render with the account that owns your other apps.
2. **[safe]** New > Blueprint. Point it at the GitHub repo `outsmartthesystem/ots-playbook-app`
   (branch `master`). Render reads `render.yaml` and proposes: one web service
   (`ots-playbook-app`), one Postgres 16 database (`ots-playbook-db`), and three cron jobs
   (`digest`, `reminders`, `admin-digest`). Apply it.
3. Render auto-fills `DATABASE_URL` (from the database) and generates `JWT_SECRET`.
   Leave `LAUNCH_MODE=preview`, `QUESTIONS_ENABLED=0`, `DIGEST_DRY=1` for now (the blueprint sets these).

## Phase B. Set the environment variables

In the web service's Environment tab, add the values below. Anything marked SECRET is **[you]**:
paste it yourself, never share it. The full reference is in `.env.example`.

| Var | Set now? | Value / note |
|---|---|---|
| `APP_URL` | now | `https://hustle.outsmartthesystem.org` (your D2 subdomain) |
| `NODE_ENV` | now | `production` |
| `ADMIN_EMAIL` | now | `jay@outsmartthesystem.org` |
| `ADMIN_NAME` | now | `Jay` |
| `ADMIN_PASSWORD` | now, SECRET | a strong password. Used once by `createAdmin`, then rotate it. |
| `RESEND_API_KEY` | now, SECRET | your Resend key (for setup links, resets, digests) |
| `FROM_EMAIL` | now | `Jay <jay@outsmartthesystem.org>` (verified Resend sender) |
| `DIGEST_DRY` | now | `1` (keep 1 until you have reviewed dry-run digests; then 0) |
| `SAFETY_ALERT_TO` | now | `jay@outsmartthesystem.org` |
| `SAFETY_ALERT_BACKUP_TO` | before production | SECOND responder email. **Required in production** (health-gated). |
| `COUNSEL_SIGNOFF_TOS` | Phase F, **[counsel]** | any non-empty value once counsel signs the ToS |
| `COUNSEL_SIGNOFF_PRIVACY` | Phase F, **[counsel]** | non-empty once the Privacy Policy is signed |
| `COUNSEL_SIGNOFF_MESSAGING` | Phase F, **[counsel]** | non-empty once the minors-messaging review is signed |
| `COUNSEL_SIGNOFF_REPORTING` | Phase F, **[counsel]** | non-empty once the mandatory-reporting SOP is signed |
| `STRIPE_WEBHOOK_SECRET` | Phase D, SECRET | the signing secret Stripe gives you for THIS app's endpoint |
| `CLASSIFIER_API_KEY` | Phase E, SECRET | the model API key for the question-channel classifier |
| `CLASSIFIER_MODEL` | Phase E | e.g. `claude-haiku-4-5-20251001` (verify current id) |
| `CLASSIFIER_TIMEOUT_MS` | Phase E | `8000` |
| `QUESTIONS_ENABLED` | Phase E, after red-team | `0` now; `1` only after the red-team passes AND counsel signs |
| `LAUNCH_MODE` | Phase G, last | `preview` now; `production` only at the very end |

The cron jobs (`digest`, `reminders`, `admin-digest`) each need `DATABASE_URL` (auto),
`RESEND_API_KEY`, `FROM_EMAIL`, `APP_URL`, and `JWT_SECRET` (must MATCH the web service's,
so the unsubscribe links verify). Set those on each cron service too, or use a Render env group.

## Phase C. First boot and content load

1. The web service boots and `migrate.js` runs automatically (creates every table, idempotent).
2. **[you]** Open a Render Shell on the web service and run, in order:
   ```
   npm run ingest          # loads the 13 committed chapters into the DB (reads content/playbook/*.md)
   npm run createAdmin     # creates Jay's admin from ADMIN_* ; then rotate ADMIN_PASSWORD
   ```
   `ingest` should print counts near: 13 chapters, ~126 steps, ~39 templates, ~155 checklist,
   ~394 glossary. `sync-content` is a LOCAL step (it copies from `../ots-content/sop`); the deploy
   uses the copies already committed under `content/playbook/`. Re-run `sync-content` + commit only
   when the playbook itself changes, then `npm run ingest` again on Render.
3. **[safe]** Check `GET /health` and `GET /version`. In preview, `/health` shows
   `ready:false` with the list of missing counsel/responder/stripe vars. That is expected.
4. **[you]** Point DNS for `hustle.outsmartthesystem.org` at the Render service and confirm the
   TLS cert issues. Log in to the app as the admin and click through: create a demo student
   (admin screen), open the claim link, set a password, walk chapters 1 to 3.

## Phase D. The Stripe webhook (the entrepreneurship-program entry point)

The app has its OWN additive endpoint. Your site's existing webhook and GHL are untouched.

1. **[you]** In the Stripe Dashboard > Developers > Webhooks, **Add endpoint**:
   URL `https://hustle.outsmartthesystem.org/webhooks/stripe`, event
   `checkout.session.completed`. This is a SECOND endpoint; do not edit the existing one.
2. **[you]** Copy the endpoint's **Signing secret** into `STRIPE_WEBHOOK_SECRET` on the web service.
3. No change to your payment links is needed: the entrepreneurship-program link already carries
   `client_reference_id=entrepreneurship-program`, and the app provisions only the two $995
   masterminds (`entrepreneurship-program`, `investing-mastermind`). Side-hustle and everything
   else are logged with zero provisioning (D1).
4. **[safe]** While still `LAUNCH_MODE=preview`, send a Stripe **test** `checkout.session.completed`
   (Stripe's "Send test webhook", or a real test-mode purchase). Verify: a parent user and an open
   enrollment (student_id NULL) are created, an `admin_audit_log` row `stripe_provisioned_preview`
   is written, and NO email is sent (preview logs the setup link instead). Re-send the same event:
   it must be ignored (idempotent). Send a side-hustle event: it logs, provisions nothing.

## Phase E. The question channel red-team gate  **[counsel-adjacent]**

The channel stays OFF (`QUESTIONS_ENABLED=0`) until this passes. Do NOT skip.

1. **[you]** Set `CLASSIFIER_API_KEY`, `CLASSIFIER_MODEL`, `CLASSIFIER_TIMEOUT_MS`.
2. **[you]** Run the red-team harness against the LIVE classifier (the offline run in
   `test/redteam.test.js` only proves fail-closed + the keyword net; model judgment must be tested
   live). Extend it with your own phrasings (joking, vague, slang, contradictory) per
   `docs/SAFETY-SOP.md` §6. Every prompt, including reply-based ones, must land in its expected class
   and stay OUT of the parent feed. Archive the run output into the repo
   (e.g. `docs/redteam-runs/<date>.md`) and commit it.
3. Only after it passes AND the counsel messaging + reporting items (Phase F) are signed:
   set `QUESTIONS_ENABLED=1`.

## Phase F. Counsel sign-off  **[counsel]** — the hard gate

A lawyer / licensed child-safety professional must review and sign off on, per plan 5.6 and
`docs/SAFETY-SOP.md` §6:
- **A. Mandatory reporting**: are OTS/its responders mandated reporters, in which states, and what
  is the pathway/timeline for ABUSE / EXPLOITATION disclosures?
- **B. Post-CRISIS parent-contact rule** for self-harm: who decides, on what evidence, in what time,
  with what exact script, and what is never said.
- ToS (minor as user, parent as contracting party, refund terms), Privacy Policy (13+, parent-provided
  data, retention, the safety-hold disclosure), and the minors-messaging review (the channel + the
  future copilot).

When signed, set the four `COUNSEL_SIGNOFF_*` vars. **Parent consent to participate does not replace
this.** This is the D6 hold.

## Phase G. Flip to production

Only when ALL of the following are true:
- [ ] The four `COUNSEL_SIGNOFF_*` vars are set (Phase F).
- [ ] `SAFETY_ALERT_BACKUP_TO` and `STRIPE_WEBHOOK_SECRET` are set.
- [ ] The red-team run passed live and is archived in the repo; `QUESTIONS_ENABLED=1`.
- [ ] A live (real-money) entrepreneurship-program test purchase provisioned a parent + enrollment
      and delivered the setup email end to end.
- [ ] Dry-run digests were reviewed; you are ready to flip `DIGEST_DRY=0`.
- [ ] Do-not-touch re-verified: `outsmart-app`, `ots-teen-agent`, and the live site are unchanged.

Then set `LAUNCH_MODE=production`. `GET /health` must now report `ready:true`. If it still says
`ready:false`, read `missing_counsel_signoffs`, `missing_responders`, and `missing_stripe` in the
response and finish those. In production, provisioning fails closed: an unsigned or unverified Stripe
event is rejected, not accepted.

## Rollback / safety

- Any problem: set `LAUNCH_MODE=preview` (stops real emailing on provisioning) and/or
  `QUESTIONS_ENABLED=0` (closes the channel). Both are single env changes; the app reacts on restart.
- A paused subscription makes an account read-only; it is never deleted on payment failure.
- Data deletion requests and the retention cleanup job are handled per the Privacy Policy; the
  cleanup job is built after counsel confirms the windows (no earlier than month 9 of the first
  enrollment), so nothing is auto-destroyed against an unconfirmed policy.

## Do-not-touch (verify at every deploy)

This app is new and additive. It never modifies `outsmart-app`, `ots-teen-agent`, the live site
(`sites/outsmartthesystem-site`), its Stripe webhook, or its GHL workflows. The only Stripe change
is a NEW endpoint. The only content dependency is read-only copies under `content/playbook/`.

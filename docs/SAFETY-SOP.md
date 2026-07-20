# ots-playbook-app — Question Channel Safety SOP

> **Status: build-stage safety draft. NOT legal advice, NOT a sign-off.** The
> question channel (`QUESTIONS_ENABLED`) stays OFF until (a) counsel signs off on
> the two [NEEDS COUNSEL] items below and (b) the red-team harness passes against
> the live classifier and is archived in this repo. This SOP is forked from the
> ots-teen-agent SAFETY-SOP and adapted for a coursework channel. Where the two
> differ, the differences are called out and must not be "reconciled" away.

## 0. What this channel is (and is not)

- It is a **chapter/step-anchored coursework Q&A thread**. A teen asks a question
  about a specific step; Jay answers in the thread. That is coursework, and a
  parent can see it.
- It is **NOT a private teen-adult DM channel.** There is no free-floating inbox,
  no open chat, no direct message. This is a ban, not an omission. Written rule for
  Jay and any future staff: **never move a student conversation to personal text,
  social DM, email, or phone.** If a student tries, reply in-thread: "Let's keep it
  here so your parent can see it."

## 1. Two differences from ots-teen-agent (deliberate; do not remove)

1. **Parent-visible by design.** The teen-agent is a private diagnostic where the
   teen controls sharing. This channel is coursework a parent paid for, so class
   `QUESTION` messages are visible to the parent by design, disclosed to the teen
   above the compose box before they type. The one carve-out: **safety-flagged
   messages are HELD from the parent view** (§3).
2. **Preserve, not purge.** The teen-agent purges flagged transcripts because it
   promised teen control. This channel's required property is **logged and
   auditable**, so flagged messages are **PRESERVED**, quarantined in a
   restricted store (admin/responder only, every read audit-logged), because a
   mandatory-reporting decision may need the record. Quarantine retention length is
   a [NEEDS COUNSEL] item. A future session must not "fix" this into a purge.

## 2. Classification (server-side, before anyone sees the message)

Every student-authored submission (the question AND every reply) runs through
`lib/classifier.js` before it is visible. Classes and routing:

| Class | Parent feed | Jay / responder | Escalation |
|---|---|---|---|
| `QUESTION` | **Visible** | Answer normally | None |
| `SENSITIVE` | **HELD** | Flagged; resources + redirect, does not counsel | Logged; 3+ pattern = next-business-day review |
| `CRISIS_SELF_HARM` | **HELD** | Responder alert | Immediate email to responder + backup; 988/911 shown in-thread |
| `ABUSE` | **HELD** | Responder alert, **do not contact parent** | Per counsel SOP; parent NEVER auto-notified (may be the source) |
| `EXPLOITATION_SEXTORTION` | **HELD** | Responder alert, **do not contact parent** | Removal/reporting resources (NCMEC Take It Down); counsel pathway |
| `THREAT` | **HELD** | Responder alert | Escalate to supervisor; emergency decision tree |
| `PENDING` | **HELD** | Admin review queue | Fail-closed default for any error/timeout/unrecognized output |

**`parent_visible` is TRUE only for `QUESTION`.** Fail closed: a classifier error,
timeout, or unrecognized output leaves the message `PENDING` and HELD. Ambiguity
never publishes a flagged disclosure into a parent's view. A deterministic keyword
safety-net can only ESCALATE toward a held/serious class, never downgrade.

## 3. What HELD means (honestly)

The channel is disclosed as parent-visible, so a hold is a safety valve, not a
privacy promise. Teen-facing copy on a held message: "This message was set aside
because it looks like it might be about something serious, not coursework. A trained
OTS responder may check in. It is not visible in your parent's view right now. If
you are in danger, call or text 988, or 911 for an emergency." The parent view never
shows "1 hidden message" per thread (that would out the teen); the policy is
disclosed globally.

## 4. Responder alerts (no quotes, ever)

Serious classes write a `safety_events` row and email the responder
(`SAFETY_ALERT_TO`, CC `SAFETY_ALERT_BACKUP_TO`). The email carries **class, event
id, severity, timestamps, student first name + age, thread id, and NEVER a student
quote or the message text.** The quarantined record (admin/responder only,
audit-logged) holds the text. `ABUSE`/`EXPLOITATION` carry a "do NOT contact parent"
instruction; `THREAT` carries "escalate to a supervisor." Ack targets: CRISIS within
15 min staffed hours; ABUSE/EXPLOITATION/THREAT within 30 min; SENSITIVE pattern
review next business day.

## 5. Limits (never a dead end)

Max 10 submissions per student per day across questions and replies, a 5-minute
cooldown, 2000-char plain-text body, links rendered non-clickable, no attachments at
launch. **Every rate-limit, cooldown, and validation-error state repeats the crisis
lines verbatim** ("If you are in crisis, call or text 988. If someone is in danger
right now, call 911.") and never presents a dead end. Jay's replies are immutable
after send (a correction is a new reply).

## 6. The launch gate

`QUESTIONS_ENABLED=1` requires ALL of:
1. The red-team harness (`test/redteam.test.js`, the ots-teen-agent §12 prompts
   extended with reply-based prompts) passes **against the live classifier**, and
   the run output is archived in this repo. The offline harness proves the
   fail-closed and keyword-net behavior; the model's class discrimination must be
   verified live because it exercises model judgment.
2. The four `COUNSEL_SIGNOFF_*` vars are set (LAUNCH_MODE=production gate, §5.6 of
   the plan) and `SAFETY_ALERT_BACKUP_TO` is configured.

**[NEEDS COUNSEL] (the two items that gate production):**
- **A. Mandatory reporting.** Are OTS / its responders mandated reporters, in which
  states, and what is the required pathway/timeline for ABUSE / EXPLOITATION?
- **B. Post-CRISIS parent-contact rule.** For self-harm (not abuse): who decides, on
  what evidence, within what time, with what exact script, and what is never said.

Parent consent to participate does **not** discharge these. This is the D6 hold.

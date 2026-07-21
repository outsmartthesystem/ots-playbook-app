'use strict';
// The question-channel safety classifier (plan 5.2.3), ported from ots-teen-agent's
// SAFETY-SOP taxonomy. Every student-authored message (question AND reply) runs
// through classify() BEFORE it is visible to anyone.
//
// Design invariants (do not weaken):
//   1. parent_visible is TRUE only for class QUESTION. Everything else is HELD.
//   2. Fail closed: any error, timeout, or unrecognized output -> PENDING (held).
//   3. The keyword safety-net can only ESCALATE toward a serious/held class,
//      never downgrade a class toward parent-visibility.
//   4. With no model configured (CLASSIFIER_API_KEY unset), nothing is ever
//      auto-classified QUESTION: normal messages fall to PENDING (held for admin
//      review) and obvious disclosures are caught by the keyword net. Safe by default.

const CLASSES = ['QUESTION', 'SENSITIVE', 'PENDING', 'CRISIS_SELF_HARM', 'ABUSE', 'EXPLOITATION_SEXTORTION', 'THREAT'];
const SERIOUS = new Set(['CRISIS_SELF_HARM', 'ABUSE', 'EXPLOITATION_SEXTORTION', 'THREAT']);
const DO_NOT_CONTACT_PARENT = new Set(['ABUSE', 'EXPLOITATION_SEXTORTION']);

// severity ordering for "escalate only" (higher wins)
const RANK = { QUESTION: 0, SENSITIVE: 1, PENDING: 2, CRISIS_SELF_HARM: 5, THREAT: 5, ABUSE: 5, EXPLOITATION_SEXTORTION: 5 };

const CRISIS_LINES = 'If you are in crisis, call or text 988. If someone is in danger right now, call 911.';

function isParentVisible(cls) { return cls === 'QUESTION'; }
function isHeld(cls) { return cls !== 'QUESTION'; }
function isSerious(cls) { return SERIOUS.has(cls); }
function doNotContactParent(cls) { return DO_NOT_CONTACT_PARENT.has(cls); }
function severity(cls) { return SERIOUS.has(cls) ? 'high' : cls === 'PENDING' ? 'unknown' : 'low'; }

// Keyword safety-net. Conservative, high-recall patterns for obvious disclosures.
// Matching forces a serious class regardless of the model. Never downgrades.
const NET = [
  { cls: 'EXPLOITATION_SEXTORTION', re: /\b(nudes?|naked pic|send pics|sextort|he'?ll post them|leak (my|the) (pics|photos|images)|grooming)\b/i },
  { cls: 'ABUSE', re: /\b((step)?dad|(step)?mom|mom'?s? boyfriend|dad'?s? girlfriend|uncle|aunt|my (mom|dad|parent|guardian))\b[^.!?\n]{0,30}\b(hit|hits|hurt|hurts|touch|touches|touched|beat|beats|slap|punch|kick|molest|abus(e|ed|ing))\b|\b(touches me|molest(ed|ing)? me|beats me|abus(e|ed|ing) me|hits me)\b/i },
  { cls: 'CRISIS_SELF_HARM', re: /\b(kill myself|suicid|end it all|don'?t want to (be here|live|exist)|better off (dead|without me)|hurt myself|self.?harm|cut myself|disappear (forever|and never)|everyone would be better off)\b/i },
  { cls: 'THREAT', re: /\b(hurt (him|her|them|the guy|the kid)|shoot up|kill (him|her|them)|make them pay|bring a (gun|knife)|hurt everyone)\b/i },
];

function keywordNet(text) {
  for (const rule of NET) if (rule.re.test(text)) return rule.cls;
  return null;
}

function escalate(a, b) { return (RANK[b] || 0) > (RANK[a] || 0) ? b : a; }

// Strict, fail-closed parse of the model's output. The model is told to output
// exactly one class token. We accept output that contains EXACTLY ONE distinct
// recognized class token (tolerating whitespace, punctuation, quotes, or code
// fences around it) and reject anything with zero or MORE THAN ONE class token,
// so a malformed "QUESTION CRISIS_SELF_HARM" can never resolve to the
// parent-visible QUESTION. Anything ambiguous -> null -> PENDING (held).
function parseModelClass(raw) {
  const tokens = String(raw || '').toUpperCase().replace(/[^A-Z_]+/g, ' ').split(/\s+/).filter(Boolean);
  const found = [...new Set(tokens.filter((t) => CLASSES.includes(t)))];
  return found.length === 1 ? found[0] : null;
}

// Optional model call. Only used when CLASSIFIER_API_KEY is set. Anthropic-style
// messages call by default (OTS uses Claude); CLASSIFIER_URL can override.
// VERIFY BEFORE PUBLISHING: confirm the endpoint, model id, and prompt match the
// ots-teen-agent classifier before enabling QUESTIONS. Any failure returns null.
async function callModel(text) {
  const key = process.env.CLASSIFIER_API_KEY;
  if (!key) return null;
  const url = process.env.CLASSIFIER_URL || 'https://api.anthropic.com/v1/messages';
  const model = process.env.CLASSIFIER_MODEL || 'claude-haiku-4-5-20251001';
  const timeout = parseInt(process.env.CLASSIFIER_TIMEOUT_MS || '8000', 10);
  const system = `You are a safety router for messages a teenager sends inside a coursework help channel. Output EXACTLY ONE token, nothing else, from this set: ${CLASSES.join(' ')}.
QUESTION = an ordinary coursework or business question. SENSITIVE = general distress, sad but not a safety emergency. CRISIS_SELF_HARM = any hint of self-harm or suicide (do not accept disclaimers). ABUSE = being hurt or abused by an adult or caregiver. EXPLOITATION_SEXTORTION = sexual exploitation, grooming, or image threats. THREAT = wanting to seriously hurt another person. If unsure, output PENDING. Output only the token.`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 8, system, messages: [{ role: 'user', content: text }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parseModelClass(data.content && data.content[0] && data.content[0].text);
  } catch (_) {
    return null; // error or timeout -> fail closed
  } finally {
    clearTimeout(timer);
  }
}

// The one entry point. Returns { class, severity, parent_visible, held, serious }.
async function classify({ text }) {
  const netClass = keywordNet(text || '');
  let modelClass = null;
  try { modelClass = await callModel(text || ''); } catch (_) { modelClass = null; }
  // base: model result, or PENDING if the model gave nothing (fail closed)
  let cls = modelClass || 'PENDING';
  // the net can only escalate (toward held/serious), never downgrade
  if (netClass) cls = escalate(cls, netClass);
  if (!CLASSES.includes(cls)) cls = 'PENDING';
  return {
    class: cls,
    severity: severity(cls),
    parent_visible: isParentVisible(cls),
    held: isHeld(cls),
    serious: isSerious(cls),
    // Derive from EVERY underlying class, not just the merged winner: ABUSE and
    // EXPLOITATION share RANK 5 with CRISIS_SELF_HARM/THREAT, so a same-rank tie
    // (e.g. net=ABUSE, model=THREAT) could otherwise drop the do-not-contact flag
    // and tell a responder to escalate-to-supervisor on a caregiver-abuse disclosure.
    do_not_contact_parent: doNotContactParent(cls) || doNotContactParent(netClass) || doNotContactParent(modelClass),
  };
}

module.exports = { classify, CLASSES, SERIOUS, CRISIS_LINES, isParentVisible, isHeld, isSerious, doNotContactParent, severity, keywordNet, parseModelClass };

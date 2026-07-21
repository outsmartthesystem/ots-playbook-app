'use strict';
// The publish gate (plan 4.4). Each question has a STABLE id and an N/A policy.
// The four honesty questions are pass-required (na_allowed:false). Consent and
// adult-in-loop may be N/A only when genuinely inapplicable. Hardened so an
// all-N/A set, a partial set, or unmatched answers can no longer pass.
const GATE_DEFINITION = [
  { id: 'GATE-FABRICATION', na_allowed: false, q: 'Nothing here is fabricated: no made-up numbers, quotes, reviews, or results.' },
  { id: 'GATE-PROOF', na_allowed: false, q: 'Every claim is something I can prove. Anything I cannot prove is flagged "verify before publishing".' },
  { id: 'GATE-SCARCITY', na_allowed: false, q: 'No fake scarcity and no fake urgency. Any limit or deadline is real and I will honor it.' },
  { id: 'GATE-ADVICE', na_allowed: false, q: 'Education, not advice. No income promises and no promised results.' },
  { id: 'GATE-CONSENT', na_allowed: true, q: 'Consent: any real person in this has given permission (a parent too if they are under 18). Mark N/A only if no real person is featured.' },
  { id: 'GATE-ADULT', na_allowed: true, q: 'A trusted adult is in the loop for anything with money or accounts. Mark N/A only if this involves no money or accounts.' },
];

// Evaluate a submitted answer set against the definition. Passes ONLY when every
// gate question id is answered 'pass', or 'na' where that question permits N/A.
// Missing answers, 'fail', or 'na' on a pass-required question all block.
function evaluateGate(answers) {
  const byId = {};
  for (const a of (Array.isArray(answers) ? answers : [])) { if (a && a.id) byId[a.id] = a.result; }
  const results = GATE_DEFINITION.map((qq) => ({ id: qq.id, result: byId[qq.id] || null, na_allowed: qq.na_allowed }));
  const ok = (r) => r.result === 'pass' || (r.result === 'na' && r.na_allowed);
  return { results, passed: results.every(ok), blocked: results.filter((r) => !ok(r)).map((r) => r.id) };
}

module.exports = { GATE_DEFINITION, evaluateGate };

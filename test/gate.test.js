'use strict';
// Publish-gate integrity: the audit's core finding was that six {result:'na'}
// blobs passed. These lock the hardened per-id / per-policy evaluation.
const test = require('node:test');
const assert = require('node:assert');
const { GATE_DEFINITION, evaluateGate } = require('../lib/gate');

const ids = GATE_DEFINITION.map((q) => q.id);
const all = (result) => ids.map((id) => ({ id, result }));

test('all-N/A is BLOCKED (the audit bypass)', () => {
  assert.equal(evaluateGate(all('na')).passed, false);
});

test('six arbitrary {result:"na"} with no ids is BLOCKED', () => {
  assert.equal(evaluateGate([{ result: 'na' }, { result: 'na' }, { result: 'na' }, { result: 'na' }, { result: 'na' }, { result: 'na' }]).passed, false);
});

test('all pass -> passes', () => {
  assert.equal(evaluateGate(all('pass')).passed, true);
});

test('N/A on a pass-required honesty question is BLOCKED', () => {
  const ans = all('pass').map((a) => a.id === 'GATE-FABRICATION' ? { ...a, result: 'na' } : a);
  const r = evaluateGate(ans);
  assert.equal(r.passed, false);
  assert.ok(r.blocked.includes('GATE-FABRICATION'));
});

test('N/A on consent / adult-in-loop is allowed (passes when honesty lines pass)', () => {
  const ans = all('pass').map((a) => (a.id === 'GATE-CONSENT' || a.id === 'GATE-ADULT') ? { ...a, result: 'na' } : a);
  assert.equal(evaluateGate(ans).passed, true);
});

test('a missing question id is BLOCKED', () => {
  assert.equal(evaluateGate(all('pass').filter((a) => a.id !== 'GATE-PROOF')).passed, false);
});

test('any fail is BLOCKED', () => {
  assert.equal(evaluateGate(all('pass').map((a) => a.id === 'GATE-ADVICE' ? { ...a, result: 'fail' } : a)).passed, false);
});

test('answers with wrong ids do not satisfy the gate', () => {
  assert.equal(evaluateGate([{ id: 'BOGUS-1', result: 'pass' }, { id: 'BOGUS-2', result: 'pass' }]).passed, false);
});

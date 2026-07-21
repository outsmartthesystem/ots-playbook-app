'use strict';
// Adversarial tests for the model-output parser (fail-closed, exactly-one-token).
// Guards the invariant that a malformed multi-token output can never resolve to
// the parent-visible QUESTION class.
const test = require('node:test');
const assert = require('node:assert');
const { parseModelClass } = require('../lib/classifier');

test('parseModelClass: a single clean token resolves', () => {
  assert.equal(parseModelClass('QUESTION'), 'QUESTION');
  assert.equal(parseModelClass('CRISIS_SELF_HARM'), 'CRISIS_SELF_HARM');
  assert.equal(parseModelClass('EXPLOITATION_SEXTORTION'), 'EXPLOITATION_SEXTORTION');
});

test('parseModelClass: tolerates whitespace, case, punctuation, and code fences', () => {
  assert.equal(parseModelClass('  question  '), 'QUESTION');
  assert.equal(parseModelClass('PENDING.'), 'PENDING');
  assert.equal(parseModelClass('```ABUSE```'), 'ABUSE');
  assert.equal(parseModelClass('"THREAT"'), 'THREAT');
});

test('parseModelClass: MULTI-token output fails closed (never picks QUESTION)', () => {
  assert.equal(parseModelClass('QUESTION CRISIS_SELF_HARM'), null);
  assert.equal(parseModelClass('QUESTION\nABUSE'), null);
  assert.equal(parseModelClass('The class is QUESTION or maybe ABUSE'), null);
  assert.equal(parseModelClass('ABUSE THREAT'), null);
});

test('parseModelClass: empty, unknown, truncated, or plural output fails closed', () => {
  assert.equal(parseModelClass(''), null);
  assert.equal(parseModelClass(null), null);
  assert.equal(parseModelClass(undefined), null);
  assert.equal(parseModelClass('QUESTIONS'), null);
  assert.equal(parseModelClass('I am not sure'), null);
  assert.equal(parseModelClass('QUEST'), null);
});

test('parseModelClass: exactly one class token with explanatory text still resolves (safe: only one class named)', () => {
  assert.equal(parseModelClass('The answer is PENDING'), 'PENDING');
  assert.equal(parseModelClass('Class: SENSITIVE'), 'SENSITIVE');
});

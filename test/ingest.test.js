'use strict';
// Adversarial gates on the ingest itself (plan 4.1.4): idempotence + a golden
// pin on chapter 1's parse. No database required. Run: npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { parseAll, counts } = require('../ingest');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'sop-manifest.json'), 'utf8'));

test('ingest is idempotent: parsing twice yields identical output', () => {
  const a = parseAll();
  const b = parseAll();
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b), 'two parses differ');
});

test('all 13 chapters parse with stable, non-shrinking structure', () => {
  const p = parseAll();
  assert.strictEqual(p.chapters.length, 13, 'expected 13 chapter files');
  const c = counts(p);
  assert.ok(c.steps >= 120, `expected >=120 steps, got ${c.steps}`);
  assert.ok(c.glossary_terms >= 300, `expected >=300 glossary terms, got ${c.glossary_terms}`);
  // every step has a stable_key and a valid kind
  const kinds = new Set(['read', 'artifact', 'action', 'checklist']);
  for (const ch of p.chapters) {
    for (const s of ch.steps) {
      assert.ok(s.stable_key, 'step missing stable_key');
      assert.ok(kinds.has(s.kind), `bad step kind ${s.kind} in ${s.stable_key}`);
    }
    // stable keys unique within chapter
    const keys = ch.steps.map((s) => s.stable_key);
    assert.strictEqual(new Set(keys).size, keys.length, `duplicate step keys in chapter ${ch.stable_key}`);
  }
});

test('GOLDEN: chapter 01 (Market Research) parses to the expected shape', () => {
  const p = parseAll();
  const ch1 = p.chapters.find((c) => c.stable_key === '01');
  assert.ok(ch1, 'chapter 01 missing');
  assert.strictEqual(ch1.number, 1);
  assert.match(ch1.title, /Market Research/i);

  // 9 numbered steps + 1 synthesized checklist step
  const numbered = ch1.steps.filter((s) => s.kind !== 'checklist');
  assert.strictEqual(numbered.length, 9, `expected 9 numbered steps, got ${numbered.length}`);
  const check = ch1.steps.find((s) => s.stable_key === '01/checkwork');
  assert.ok(check, 'synthesized checkwork step missing');
  assert.strictEqual(check.kind, 'checklist');

  // manifest kinds applied: step 1 read, step 5 action, step 9 read (D-manifest)
  const byPos = Object.fromEntries(numbered.map((s) => [s.position, s]));
  assert.strictEqual(byPos[1].kind, 'read', 'step 1 should be read');
  assert.strictEqual(byPos[5].kind, 'action', 'step 5 should be action');
  assert.strictEqual(byPos[9].kind, 'read', 'step 9 should be read');
  // an artifact-kind step points at the voc_sheet artifact
  assert.strictEqual(byPos[2].kind, 'artifact');
  assert.strictEqual(byPos[2].artifact_section, 'voc_sheet');

  // step bodies split into teach / now_you
  assert.ok(byPos[3].teach_md.length > 0, 'step 3 teach_md empty');
  assert.ok(byPos[3].now_you_md.length > 0, 'step 3 now_you_md empty');

  // at least one COPY AND ADAPT template captured (the bleed questions etc.)
  assert.ok(ch1.templates.length >= 3, `expected >=3 templates, got ${ch1.templates.length}`);
  assert.ok(ch1.templates.some((t) => /bleed/i.test(t.title)), 'expected a "bleed questions" template');

  // checklist + glossary present
  assert.ok(ch1.checklist.length >= 8, `expected >=8 checklist items, got ${ch1.checklist.length}`);
  assert.ok(ch1.glossary.some((g) => /voice of the customer/i.test(g.term)), 'expected VoC glossary term');
});

test('D13: chapter 01 manifest carries the one-quote-per-bucket presence gate', () => {
  const gate = manifest.chapters['01'].presence_gate;
  assert.ok(gate, 'presence_gate missing for chapter 01');
  assert.strictEqual(gate.kind, 'one_per_bucket');
  assert.deepStrictEqual(
    gate.buckets.slice().sort(),
    ['dream', 'exact_words', 'fears', 'frustrations', 'objections', 'price']
  );
});

test('chapter 00 master glossary is captured as global terms', () => {
  const p = parseAll();
  const ch0 = p.chapters.find((c) => c.stable_key === '00');
  assert.ok(ch0, 'chapter 00 missing');
  assert.ok(ch0.glossary.length >= 100, `expected a big master glossary, got ${ch0.glossary.length}`);
});

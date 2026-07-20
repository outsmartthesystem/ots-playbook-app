'use strict';
// Unit tests for the Binder honesty engine (plan 4.2). Pure logic, no database.
// These verify the P1 acceptance-proof behaviors directly.
const test = require('node:test');
const assert = require('node:assert');
const { getKind, loadBearingChanges, VOC_BUCKETS } = require('../lib/artifacts');

test('BrandScript refuses to save a problem with no quote ref and no explicit flag', () => {
  const bs = getKind('brandscript');
  const data = bs.defaultData();
  data.external_problem.text = 'She tunes him out about money.';
  // neither a source_quote_ref nor no_source: must error
  let errs = bs.validateSave(data);
  assert.ok(errs.length >= 1, 'expected a save error for an unsourced problem');
  // with a quote ref: clean
  data.external_problem.source_quote_ref = 'voc:2';
  assert.strictEqual(bs.validateSave(data).length, 0, 'a sourced problem should save');
  // with the explicit "no source yet" flag: clean, and counts as an open flag
  data.external_problem.source_quote_ref = '';
  data.external_problem.no_source = true;
  assert.strictEqual(bs.validateSave(data).length, 0, 'a flagged problem should save');
  assert.strictEqual(bs.countFlags(data), 1, 'no_source should count as one open flag');
});

test('Offer truth file refuses a claim with no proof source', () => {
  const of = getKind('offer_truth_file');
  const data = of.defaultData();
  data.claims_allowed = [{ claim: 'I have coached 3 real students', proof_source: '' }];
  assert.ok(of.validateSave(data).length >= 1, 'claim without proof must error');
  data.claims_allowed[0].proof_source = 'their names + dates in my tracker';
  assert.strictEqual(of.validateSave(data).length, 0, 'claim with proof should save');
});

test('D13: VoC needs one quote per bucket plus who-my-customer-is before submit', () => {
  const voc = getKind('voc_sheet');
  const data = voc.defaultData();
  let missing = voc.presenceMissing(data);
  assert.ok(missing.length >= 7, 'empty VoC should be missing who + 6 buckets');
  data.who_my_customer_is = 'Parents of teens';
  data.quotes = VOC_BUCKETS.map((b) => ({ bucket: b, verbatim_text: 'a real sentence' }));
  assert.strictEqual(voc.presenceMissing(data).length, 0, 'one quote per bucket + who should pass');
  // drop the price bucket: only that one should be missing
  data.quotes = data.quotes.filter((q) => q.bucket !== 'price');
  missing = voc.presenceMissing(data);
  assert.strictEqual(missing.length, 1);
  assert.match(missing[0], /price/);
});

test('VoC interview rows require recording-consent answer and adult-in-loop', () => {
  const voc = getKind('voc_sheet');
  const data = voc.defaultData();
  data.who_my_customer_is = 'x';
  data.quotes = VOC_BUCKETS.map((b) => ({ bucket: b, verbatim_text: 'q' }));
  data.interviews = [{ date: '2026-07-01', alias: 'Parent A' }]; // no consent, no adult
  const missing = voc.presenceMissing(data);
  assert.ok(missing.some((m) => /consent/i.test(m)), 'should flag missing recording consent');
  assert.ok(missing.some((m) => /adult/i.test(m)), 'should flag missing adult-in-loop');
});

test('load-bearing change detection: offer price change is caught for pivot logging', () => {
  const oldData = getKind('offer_truth_file').defaultData();
  oldData.paid_offer.price_cents = 9700;
  const newData = JSON.parse(JSON.stringify(oldData));
  newData.paid_offer.price_cents = 14700;
  const changes = loadBearingChanges('offer_truth_file', oldData, newData);
  assert.ok(changes.some((c) => c.field === 'paid_offer.price_cents'), 'price change should require a pivot reason');
  // a non-load-bearing change (payment_link) is not flagged
  const n2 = JSON.parse(JSON.stringify(oldData));
  n2.paid_offer.payment_link = 'https://buy.stripe.com/x';
  assert.strictEqual(loadBearingChanges('offer_truth_file', oldData, n2).length, 0);
});

test('guided artifacts require their (req) sections before submit', () => {
  const g = getKind('scoreboard_setup');
  assert.strictEqual(g.editor, 'guided');
  const data = g.defaultData();
  assert.ok(g.presenceMissing(data).length >= 1, 'empty guided artifact is not submittable');
  data.sections = { baseline: 'my numbers', decision_gate_date: '2026-09-01: rework if 0 sales' };
  assert.strictEqual(g.presenceMissing(data).length, 0);
});

test("Elena's demo binder stays valid against the honesty engine", () => {
  const fs = require('fs');
  const path = require('path');
  const e = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'elena-binder.json'), 'utf8'));
  assert.ok(Array.isArray(e.artifacts) && e.artifacts.length >= 3, 'Elena binder should have >=3 artifacts');
  for (const a of e.artifacts) {
    const k = getKind(a.kind);
    assert.ok(k, `Elena artifact has unknown kind ${a.kind}`);
    assert.strictEqual(k.validateSave(a.data).length, 0, `Elena ${a.kind} should save clean`);
    assert.strictEqual(k.presenceMissing(a.data).length, 0, `Elena ${a.kind} should be submit-ready`);
  }
});

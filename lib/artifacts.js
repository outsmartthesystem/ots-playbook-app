'use strict';
// The Business Binder honesty engine (plan 4.2 / 4.6).
// Per-artifact-kind: what blocks SAVE (structural honesty, e.g. a BrandScript
// problem needs a quote ref or an explicit "no source yet" flag), what blocks
// SUBMIT (presence of (req) fields, e.g. D13 one quote per VoC bucket), which
// fields are load-bearing (a change needs a pivot reason), and how many open
// "verify before publishing" flags an artifact carries.

const VOC_BUCKETS = ['fears', 'frustrations', 'dream', 'exact_words', 'objections', 'price'];

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function nonEmpty(v) { return v != null && String(v).trim() !== ''; }

const KINDS = {
  voc_sheet: {
    chapter: 1, editor: 'structured', load_bearing: [],
    defaultData: () => ({ who_my_customer_is: '', interviews: [], quotes: [], top_three: [] }),
    // saving is free while drafting; honesty is enforced at submit
    validateSave(data) {
      const errs = [];
      for (const q of data.quotes || []) {
        if (nonEmpty(q.verbatim_text) && !VOC_BUCKETS.includes(q.bucket)) {
          errs.push(`Every quote needs a bucket (${VOC_BUCKETS.join(', ')}).`);
          break;
        }
      }
      return errs;
    },
    presenceMissing(data) {
      const missing = [];
      if (!nonEmpty(data.who_my_customer_is)) missing.push('Say who your customer is.');
      // D13: at least one quote per bucket
      for (const b of VOC_BUCKETS) {
        const has = (data.quotes || []).some((q) => q.bucket === b && nonEmpty(q.verbatim_text));
        if (!has) missing.push(`Add at least one quote to the "${b}" bucket.`);
      }
      // every interview row must record consent + adult-in-loop (req/row)
      (data.interviews || []).forEach((iv, i) => {
        if (iv.recorded_consent == null) missing.push(`Interview ${i + 1}: did you get recording consent? (yes/no)`);
        if (iv.adult_in_loop !== true) missing.push(`Interview ${i + 1}: a trusted adult must be in the loop.`);
      });
      return missing;
    },
    countFlags() { return 0; },
  },

  brandscript: {
    chapter: 2, editor: 'structured', load_bearing: ['one_liner'],
    defaultData: () => ({
      hero_composite: '',
      external_problem: { text: '', source_quote_ref: '', no_source: false },
      internal_problem: { text: '', source_quote_ref: '', no_source: false },
      philosophical_problem: { text: '', source_quote_ref: '', no_source: false },
      guide: '', plan: '', cta: '', failure: '', success: '',
      one_liner: '', dinner_party_tests: [], voice_memo: '', story_file: [],
    }),
    // the anti-fabrication mechanic: a problem with text must point at a quote
    // OR be explicitly flagged "no source yet". Neither = cannot save.
    validateSave(data) {
      const errs = [];
      for (const key of ['external_problem', 'internal_problem', 'philosophical_problem']) {
        const p = data[key] || {};
        if (nonEmpty(p.text) && !nonEmpty(p.source_quote_ref) && p.no_source !== true) {
          errs.push(`${key.replace('_', ' ')}: point it at one of your own VoC quotes, or check "no source yet, verify before publishing".`);
        }
      }
      return errs;
    },
    presenceMissing(data) {
      const missing = [];
      for (const key of ['external_problem', 'internal_problem', 'philosophical_problem']) {
        if (!nonEmpty((data[key] || {}).text)) missing.push(`Write the ${key.replace('_', ' ')}.`);
      }
      if (!nonEmpty(data.one_liner)) missing.push('Write your one-liner.');
      return missing;
    },
    countFlags(data) {
      return ['external_problem', 'internal_problem', 'philosophical_problem']
        .filter((k) => (data[k] || {}).no_source === true).length;
    },
  },

  offer_truth_file: {
    chapter: 3, editor: 'structured',
    load_bearing: ['paid_offer.name', 'paid_offer.deliverables', 'paid_offer.price_cents', 'paid_offer.refund_promise_exact_words', 'free_front_door.name'],
    defaultData: () => ({
      paid_offer: { name: '', who_for: '', deliverables: '', price_cents: null, refund_promise_exact_words: '', payment_link: '' },
      free_front_door: { name: '', what: '', points_to: '' },
      claims_allowed: [],
      claims_never: ['Made-up numbers or stats', 'Fake reviews or testimonials', 'Fake countdowns or fake "spots left"'],
      scarcity_check: '',
      front_door_history: [],
    }),
    // every allowed claim needs a proof source, or the row cannot save
    validateSave(data) {
      const errs = [];
      (data.claims_allowed || []).forEach((row, i) => {
        if (nonEmpty(row.claim) && !nonEmpty(row.proof_source)) {
          errs.push(`Claim ${i + 1} ("${String(row.claim).slice(0, 30)}...") needs a proof source, or remove it.`);
        }
      });
      return errs;
    },
    presenceMissing(data) {
      const o = data.paid_offer || {};
      const missing = [];
      if (!nonEmpty(o.name)) missing.push('Name your offer.');
      if (!nonEmpty(o.who_for)) missing.push('Who is it for?');
      if (!nonEmpty(o.deliverables)) missing.push('List what they get.');
      if (!(o.price_cents > 0)) missing.push('Set a real price (not $0).');
      if (!nonEmpty(o.refund_promise_exact_words)) missing.push('Write your refund promise in exact words.');
      return missing;
    },
    countFlags() { return 0; },
  },
};

// Guided editor for chapters 4 to 12 in P1 (templated markdown under (req) headings).
// Structured editors replace these chapter by chapter in later tranches (plan P1 task 1).
const GUIDED = {
  no_brainer_stack: { chapter: 4, sections: [['dream_outcome', 'Dream outcome (their words)', true], ['stack', 'Your offer stack (item, honest value, why)', true], ['bonuses', 'Bonuses that answer objections', false], ['guarantee', 'Your honest guarantee', true]] },
  website_record: { chapter: 5, sections: [['live_url', 'Live page URL', true], ['payment_link_test', 'Payment link tested (confirmation seen)', true], ['boring_pages', 'Terms + privacy (parent read the terms)', true]] },
  lead_capture_kit: { chapter: 6, sections: [['welcome_email', 'Welcome email (test send date)', true], ['nurture', 'Three follow-up emails', true]] },
  warm_list: { chapter: 7, sections: [['warm_list', 'Your 20 warm names', true], ['objection_log', 'Objections logged (verbatim)', false] ] },
  content_loop: { chapter: 8, sections: [['week_plan', 'This week: one story, three posts, one long piece', true]] },
  automation_kit: { chapter: 9, sections: [['scheduler', 'Scheduler choice', true], ['real_self_only', 'Real-self-only acknowledged', true]] },
  scoreboard_setup: { chapter: 10, sections: [['baseline', 'Your honest baseline', true], ['decision_gate_date', 'Decision gate date + pre-written outcomes', true]] },
  rules_file: { chapter: 11, sections: [['standing_rules', 'Your standing rules', true], ['credits', 'Who you credit', false]] },
  standing_brief: { chapter: 12, sections: [['who_i_am', 'Who I am', true], ['hard_rules', 'Hard rules (never break)', true]] },
};
for (const [kind, cfg] of Object.entries(GUIDED)) {
  KINDS[kind] = {
    chapter: cfg.chapter, editor: 'guided', load_bearing: [],
    guided_sections: cfg.sections.map(([key, label, req]) => ({ key, label, req })),
    defaultData: () => ({ sections: {} }),
    validateSave() { return []; },
    presenceMissing(data) {
      return cfg.sections.filter(([key, , req]) => req && !nonEmpty((data.sections || {})[key]))
        .map(([, label]) => `Fill in: ${label}.`);
    },
    countFlags() { return 0; },
  };
}

function getKind(kind) { return KINDS[kind] || null; }
function isKnownKind(kind) { return !!KINDS[kind]; }

// which load-bearing fields changed between two data blobs (string compare)
function loadBearingChanges(kind, oldData, newData) {
  const cfg = KINDS[kind];
  if (!cfg) return [];
  const changes = [];
  for (const path of cfg.load_bearing) {
    const before = get(oldData, path);
    const after = get(newData, path);
    // First authorship (empty -> value) is NOT a pivot; only editing an already
    // populated load-bearing field demands a reason.
    const wasEmpty = before == null || String(before).trim() === '';
    if (wasEmpty) continue;
    if (JSON.stringify(before ?? '') !== JSON.stringify(after ?? '')) {
      changes.push({ field: path, old: String(before), new: after == null ? '' : String(after) });
    }
  }
  return changes;
}

module.exports = { KINDS, VOC_BUCKETS, getKind, isKnownKind, loadBearingChanges };

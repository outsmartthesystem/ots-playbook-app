'use strict';
// Parent-in-the-loop data (plan 3.2). The checkpoint registry, the verify-gating
// map, the four consent keys, and the Ask-tonight prompt bank.

// The four consent checkboxes captured at parent account creation (plan 5.1.5).
const CONSENT_KEYS = [
  { key: 'is_guardian', text: 'I am the parent or legal guardian of this teen.' },
  { key: 'consent_use', text: 'I consent to my teen using this program.' },
  { key: 'understand_visibility', text: 'I understand I can see my teen\'s progress, artifacts, and coursework questions.' },
  { key: 'understand_safety_review', text: 'I understand safety-flagged messages may be reviewed by a designated OTS responder and may not appear in my view.' },
];

// The 12 parent checkpoints (plan 3.2 table). per_subject = one approval per named person.
const CHECKPOINT_REGISTRY = [
  { key: 'CP-INTERVIEW-LIST', chapter: 1, text: 'Reviewed the interview list; will help set up calls with adults the teen does not know well.' },
  { key: 'CP-RECORDING-CONSENT', chapter: 1, text: 'Understands recording consent is asked before every recorded call.' },
  { key: 'CP-BRANDSCRIPT-READ', chapter: 2, text: 'Read the finished BrandScript before anything publishes from it.' },
  { key: 'CP-OFFER-REVIEWED', chapter: 3, text: 'Saw the finished offer including price, refund promise, and boundary line.' },
  { key: 'CP-STRIPE-ACCOUNT', chapter: 3, text: 'Opened and co-owns the Stripe account (attestation only; the app never touches credentials).' },
  { key: 'CP-DOMAIN', chapter: 5, text: 'Was present for domain registration.' },
  { key: 'CP-TERMS-READ', chapter: 5, text: 'Read the terms page, and the refund promise matches the sales page word for word.' },
  { key: 'CP-EMAIL-TOOL', chapter: 6, text: 'Created the email tool account; will read emails before real people get them.' },
  { key: 'CP-WARMLIST-REVIEW', chapter: 7, text: 'Reviewed the warm list and read the first outreach batch before sending.' },
  { key: 'CP-SOCIAL-SETUP', chapter: 9, text: 'Set up scheduler and accounts together; knows the review-gate rule.' },
  { key: 'CP-STORY-CONSENT', chapter: 11, per_subject: true, text: 'A signed release exists for this named real person (one approval per subject, revocable).' },
  { key: 'CP-RULES-AND-BRIEF', chapter: 11, text: 'Read the teen\'s rules file and AI standing brief.' },
];
const CHECKPOINTS_BY_KEY = Object.fromEntries(CHECKPOINT_REGISTRY.map((c) => [c.key, c]));

// Which checkpoint(s) must be approved before a chapter's core artifact can be VERIFIED (plan 3.2).
const GATES_VERIFY_BY_CHAPTER = {
  2: ['CP-BRANDSCRIPT-READ'],
  3: ['CP-OFFER-REVIEWED'],
  5: ['CP-TERMS-READ'],
  7: ['CP-WARMLIST-REVIEW'],
  11: ['CP-RULES-AND-BRIEF'],
};

// Ask-tonight dinner-table prompts, 3 per chapter, rotated in the digest (plan 3.2).
// Honest, open questions. No lecture, no income framing.
const ASK_TONIGHT = {
  1: ['Who did you talk to this week, and what surprised you?', 'What is one exact thing a customer said that stuck with you?', 'What was the hardest part of asking for a conversation?'],
  2: ['If you had to describe your business in one sentence, what would it be?', 'Who is the one person your business is really for?', 'What problem do they have that you want to solve?'],
  3: ['What is the one thing you are going to sell first?', 'What would make it fair to refund someone?', 'Why did you pick that price?'],
  4: ['What makes your offer worth more than it costs?', 'What is one thing you could do for them so they do less?', 'What is a real bonus you could add?'],
  5: ['What is the one button on your page supposed to do?', 'Who has tested your page on their phone?', 'What did you have to make sure the terms page says?'],
  6: ['What does your welcome email say?', 'Why ask for the email before showing the result?', 'What is a follow-up email that is useful even if they never buy?'],
  7: ['Who is on your list of 20 people?', 'What is the honest first message you send?', 'What is the hardest "no" you got, and what did you learn?'],
  8: ['What story are you telling this week?', 'Which post are you proudest of?', 'What is the one thing your content points people toward?'],
  9: ['What did you batch this week?', 'What is the rule about using your real self in videos?', 'What did you decide NOT to automate, and why?'],
  10: ['What do your four numbers say this week?', 'What was the leak, and what will you change?', 'What is a true zero you are proud to have written down?'],
  11: ['What is a rule you will never break?', 'Whose story did you get permission to tell?', 'What claim did you decide you could not make?'],
  12: ['What does your AI helper read first, every time?', 'What is one thing you caught the AI getting wrong?', 'Why do you read everything before it ships?'],
};

module.exports = { CONSENT_KEYS, CHECKPOINT_REGISTRY, CHECKPOINTS_BY_KEY, GATES_VERIFY_BY_CHAPTER, ASK_TONIGHT };

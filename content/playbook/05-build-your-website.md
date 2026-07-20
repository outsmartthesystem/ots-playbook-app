# Build Your Website

When this chapter is done you will have one live web page that sells your first offer. It will have a free tool at the top, a working way to get paid, a thank-you page, and a link you can track. You will also have a habit for keeping it all honest.

> **What you need**
>
> - Your BrandScript from the brand chapter (the hero, problem, guide, plan, CTA, and failure/success lines you already wrote).
> - Your offer truth file from the offer chapter (the one file that holds your real price, promise, and refund policy).
> - A domain: your address on the internet, like `yourbusiness.com`. You rent it by the year for a small fee. Check the real renewal price with the company you rent it from, not just the first-year price.
> - A page builder: a tool that turns your words into a web page without code. It also handles hosting, which is the computer that keeps your page on the internet 24/7, so you usually do not pick hosting separately. Jay's setup runs on a hosting service with a free tier. Most beginner page builders have a free or cheap tier too. Any of them work for your first page.
> - A payment account: Jay uses Stripe, a company that handles cards so you never touch card numbers. Opening an account requires an adult, so a parent opens and owns it with you. Stripe takes about 3 percent plus a small fixed fee per sale (check Stripe's current pricing page, fees change). Setting up one payment link takes about 5 minutes.
> - A contact list tool: an app that remembers everyone who signs up. Jay uses one called GoHighLevel, a pro tool with a monthly cost that you do not need yet. Any email list tool that lets you put labels on people will do at the start. Several beginner email tools have free plans for small lists. Search "free email list tool," pick one with a free tier, and have your parent approve it.
> - Time: about one weekend for your first page. Jay shipped whole offer pages in a day each, but he had practice and an AI helper.

A quick promise before we start. Nothing in this chapter requires you to write code. Jay did not hand-code his site either. He wrote words, made decisions, and gave clear instructions to tools and to an AI helper. That is the actual skill.

---

## Step 1: Learn the six parts of a selling website

**What to do.** Before you build anything, learn what the parts are, because every step after this uses these words.

1. **Domain.** Your address on the internet. You rent it, you do not buy it forever.
2. **Landing page.** One web page about one thing you sell, with one main button. Not a whole website. One page, one job.
3. **Form.** The boxes where a visitor types their name and email. When they submit, your contact list tool saves them.
4. **Contact list tool (also called a CRM).** An address book app that remembers every person, what they did, and can email them automatically. It puts **tags** on people, which are just stickers like "took the quiz" or "paid," so you always know who did what.
5. **Checkout link.** A ready-made payment page that Stripe creates for you. You paste the link behind your buy button. No code. When someone pays, Stripe can automatically ping your systems to say "this person paid." That automatic ping is called a **webhook**. You do not need to build one this week. You just need to know the word.
6. **Thank-you and welcome pages.** The page a person lands on right after signing up (thank-you) or right after paying (welcome). Most beginners forget these. They matter more than the homepage.

**How Jay did it.** Jay's commercial site runs on a hosting service where pages live as files and publish automatically when he saves. His contact list tool is GoHighLevel. Every paid offer uses a Stripe Payment Link. And the site itself is edited by an AI helper he calls the "site Claude": a separate AI session that changes the website only when Jay pastes it a complete, self-contained instruction. You will use the same idea at the end of this chapter.

**Now you.** Pick one tool for each slot and write the list down: domain, page builder, contact list tool, payment account. Have your parent with you when you register the domain and open the payment account. The money accounts are theirs to open and supervise. That is not a formality. It is the rule.

---

## Step 2: Write the page before you build the page

**What to do.** A landing page is not a design project. It is your BrandScript, rearranged into page form. You already wrote the hard parts in the brand chapter using Donald Miller's StoryBrand framework. Now you map them onto sections:

| BrandScript piece | Becomes this page section |
|---|---|
| Hero + what they want | The headline and subhead at the top |
| The problem | A short section naming the exact problem, in the customer's words |
| You as the guide | One short founder line: who you are and why you get it |
| The plan | "How it works" in 3 or 4 numbered steps |
| The CTA | The one button, repeated down the page |
| Failure avoided / success gained | Your guarantee, plus one honest picture of what life looks like after |

Write all of it in a plain document first. Not in the page builder. In a doc.

**How Jay did it.** Marketers call the words on a page "copy." Jay never wrote copy inside the website tool. Page copy lives in plain text files in his content folder, and prices and promises live only in the offer truth file. When he built the paid diagnostic page, the build order listed the copy blocks in order: headline, subhead, what you get, and who it's for. Then the price, with the risk reversal (the promise that removes the buyer's risk, like a refund) and the guarantee. Then the founder line. Last, an honesty line: one plain sentence saying what the offer is and is not, like "this is education, not financial advice." The instruction to the site builder said to use the words exactly as written and adjust only for layout.

His founder line, which does the "guide" job on his pages, is a good model because it contains zero brag numbers: "I spent 20 years building businesses and was financially illiterate for most of my career. I learned this the hard way at 38. I built the program I wish someone had run for my own kids."

Two hard rules Jay enforces on every page, and you will too:

- **No fabricated proof.** No made-up reviews, no invented customer counts, no fake "only 3 left" counters. Jay's build prompts literally say zero fabricated proof. When he later put "Only 10 founding-family spots" on a page, it was allowed only after he committed that the cap is real and enrollment actually closes at 10. Real capacity is fine. Fake scarcity is lying.
- **Promises made on the page must exist in your written rules.** Jay's 14-day refund appeared five times on an offer page and zero times in his terms page, and an audit flagged it as a dispute risk. If your page promises a refund, your terms page (the boring "rules of buying from me" page, which your parent should read) must say the same thing in the same words.

**Now you.** Open a doc titled with your offer's name. Write each block from the table above, in order. Pull the price, the promise, and the refund line word for word from your truth file. Read it out loud. If a sentence sounds like an ad, rewrite it like you would say it to a friend's parent.

---

## Step 3: Assemble the page in this order

**What to do.** Build the page top to bottom in the order Jay uses on every offer page:

1. Headline + subhead (from your doc, word for word)
2. **Free tool at the top** (next step explains this)
3. What you get / who it's for (lay this out as your offer stack; see the section below on showing the stack)
4. Price + honest risk reversal (your guarantee, stated plainly)
5. Founder line (the guide)
6. An honesty line near the button: one sentence saying plainly what the offer is and is not. Jay's investing pages say the program is education, not investment advice. A baking page might say "Made in a home kitchen." If you are not sure whether your business needs one, ask your parent what a careful buyer would want stated.
7. The button
8. After the click: a short form, then checkout, then the welcome page

**How Jay did it.** His free opt-in page (a page whose only job is getting a visitor to type in their email, opting in to hear from you) is the simplest full example, and it became the pattern every later page copied. Here is its skeleton.

**COPY AND ADAPT: the one-page opt-in skeleton**

- Small label line at the top (his says "FREE 10-MINUTE READ")
- Headline
- Subhead
- 4 bullets of what's inside
- Form: first name + email only
- Button (his says "Send me the primer")
- Small text under the button, honest about what happens next. His says one email with the PDF, a short series after that, unsubscribe anytime.
- One credibility line
- A thank-you page that immediately offers the next step

Notice what is not on it. No photo gallery. No "About Us" essay. No menu with nine links. Every extra thing on a landing page is an exit door.

One more pattern rule from Jay's build: **make your first page the template for every future page.** Jay's first opt-in page and its form became the explicit pattern. Every later build instruction said to copy that page's look and form handling. His colors and fonts were fixed once and repeated exactly on every page. When he built two big program pages at once, the sections they shared were written one time and dropped into both, so a fix in one place fixed both. Pick your two colors and one font now and never improvise a new look per page. Sameness is what makes a one-person business look like an organization.

**Now you.** Build the opt-in skeleton in your page builder using your doc. Two form fields only. Every extra field costs you signups. Do not add anything the skeleton does not have.

---

## Step 4: Put a free tool at the top, and ask for the email before the result

**What to do.** Cold strangers do not click buy buttons. So the top of your page offers something free and genuinely useful: a short quiz, a checklist, a scorecard, a calculator. This free thing is your **front door**. And the discipline that makes it work: the visitor enters their email before they see their result.

**How Jay did it.** The rule on his site, quoted from his own audit: "the quiz IS the funnel: email captured before the result." A funnel is just the path a stranger walks from finding you to paying you. Jay means the free quiz is the front end of that whole path: nobody gets a result without leaving an email. Each $97 offer got its own free front door. The side hustle program has a short Builder Gap Check. The investing program has an Investor Profile quiz and a shareable calculator. In every case the result arrives after the email, and the result page immediately points to the matching offer.

He learned this the expensive way. His old homepage quiz gave the result away with no email ask. A lead is a person who gave you their email, meaning you can follow up later. The audit called the old quiz "a lead-gen-shaped object that generates no leads." It looked like it collected people. It collected nobody.

Two fairness rules that come with this:

- **Never take a result hostage after showing it.** If the result is already on screen, do not slap an email wall in front of it. That is a trap, and people feel it.
- **Fail open.** If your email-saving tool breaks, show the result anyway. Losing one email is better than burning one human.

And one honesty rule from Jay's foundation site: if your page promises a weekly email, you have to actually send one every week. The promise on the page is a job you now have to do, not decoration.

**Now you.** Design a 5-question check related to your offer. Lawn care business: "Is your yard summer-ready? 5 questions." Baking business: "Which of these 4 party-dessert mistakes are you making?" Keep the version-one tech dumb: a free form tool (Google Forms works and costs nothing) that collects their five answers plus an email, and you personally send each person their result the same day. Manual first is fine. Automate once the pattern proves out.

---

## Show the whole offer as a stack, not a boring list

**What to do.** You already built your no-brainer in "Make Your Offer a No-Brainer (the $100M Offer Method)": a dream outcome in the customer's own words, an offer stack where each item has a defensible value, a real total, a price set below it, a visible gap, a fast first win, objection-killing bonuses, and an honest guarantee. All of it lives in your offer truth file. This section does one job. It puts that stack on the page so the buyer can see it. Lay the offer block out in this order, top to bottom:

1. The dream-outcome headline, in the customer's exact words, at the top of the block.
2. "Everything you get:" and then each stacked item on its own line, with its honest value next to it.
3. The bonuses, listed right under the core items, each one next to the objection it removes.
4. The real total value.
5. Your price, clearly lower.
6. The gap, made obvious.
7. The fast first win, called out in one line so they see they get something on day one.
8. The guarantee, sitting right next to the button.

A boring paragraph buries all of that. A visible stack shows it.

**How it works.** A paragraph makes the buyer do the math in their head. A laid-out stack does the math for them. Each item sits on its own line with its value beside it. The buyer watches the value add up, line by line. Then they see your price sitting under a bigger number. That is the gap, and a stack lets them feel it instead of just reading about it. Take the tutoring stack from the no-brainer chapter. Written as a sentence it is forgettable: "You get eight sessions, a worksheet pack, and updates, for $160." Laid out as a stack, the parent sees $220 of value, then $160, then a $60 gap, and the yes gets easier without a single number changing. The guarantee goes right next to the price and the button on purpose. That spot is where the buyer hesitates, money in hand, thumb over the button. Your risk reversal is the thing that gets the thumb to press.

Now the honesty gates carry straight over from both chapters, and none of them bend for the page:

- Every value you show on the page is the SAME defensible value from your truth file. You never inflate a number to make the page's gap look bigger. A made-up value is a fabricated stat, and this playbook bans those everywhere.
- The guarantee wording on the page matches your truth file and your terms page word for word. Same promise, same window, in all three places. This is the exact "refund on the page must match the terms" rule from Step 2.
- No fake "spots left," no counter that never moves. The "zero fabricated proof" rule from Step 2 applies to your stack too. Only real, defensible numbers go on the page.

And the truth-file discipline runs this whole block. The page pulls the stack items, the values, the total, the price, and the guarantee FROM your truth file. That is the ten things you wrote in the no-brainer chapter's "Put it together." You never retype them from memory, because memory drifts and the truth file does not. When the offer changes, the truth file changes first, then the page.

Here is the layout to copy and adapt.

**COPY AND ADAPT: the offer block on the page**

```
[Dream-outcome headline, in the customer's own words]

Everything you get:
  ______________________________________   $______
  ______________________________________   $______
  ______________________________________   $______
  Bonus: _______________________________   $______   (removes: "____________")

Total value:   $______
Your price:    $______
You save:      $______

In the first [session / 48 hours], you also get: [the fast first win]

[One-line guarantee, word for word from your truth file and terms page]

[  Button label, for example "Start today"  ]
```

A short worked version, using the tutoring stack from the no-brainer chapter:

```
"So my kid walks into the test feeling ready, not panicking."

Everything you get:
  8 one-on-one sessions                  $200
  Custom worksheet pack                  $20
  Two-line update after each session     included

Total value:   $220
Your price:    $160
You save:      $60

In the very first session: we find and fix the one thing they are most stuck on.

Not happy in the first 14 days? Email me and I refund you, no questions.

[  Book the first session  ]
```

Every number there is defensible, because every number came straight from the truth file where you already wrote its "why."

**Now you.** Lay your no-brainer stack onto your page in that order. Pull every item, every value, the total, the price, and the guarantee from your truth file, not your memory. Show the total, show your lower price, and make the gap plain. Call out your fast first win. Put your guarantee right next to the button. Then check one thing: every number and the guarantee wording match your truth file and your terms page exactly. If any of them do not, the truth file is right and the page is the bug.

---

## Step 5: Turn on checkout with a payment link

**What to do.** You do not build a store. You create one Stripe Payment Link per product and paste it behind your button.

**How Jay did it.** His playbook for this is about five minutes long, and it works as a copy-and-adapt checklist.

**COPY AND ADAPT: payment link setup**

1. In Stripe (the account your parent opened), go to the product catalog and add the product: name, one-line description, price, one-time payment.
2. Create a Payment Link for it. Turn on collecting the customer's name and email.
3. Copy the link URL.
4. Paste that URL into your offer truth file immediately, so the truth file, not your memory, holds the real link.
5. Set the after-payment redirect to your welcome page (next step), so buyers land somewhere that tells them what happens next instead of on a dead receipt screen.

Three gotchas from Jay's build, so you do not rediscover them:

- **Give each product its own name tag.** Stripe links can carry a small label called a `client_reference_id`. It is a name tag on the payment so your records know which product was bought. Jay once had two different products at the same $97 price, and his system could not tell the purchases apart by amount alone. The name tag fixed it. Label by product, never by price.
- **One-time vs subscription is permanent per price.** Decide before creating the link whether this charges once or repeats. Jay could not edit that setting later without making a whole new link. If anything about your billing repeats, say so in plain words on the page.
- **The refund promise goes on the page and in the terms.** Same words both places. Parent reads both.

**Now you.** With your parent, create the product and the Payment Link, paste the URL into your truth file, then wire your page button to it. Do a $1 test product first if you want to see the whole flow end to end before your real price goes live, then delete it.

---

## Step 6: Build the thank-you page and the welcome page

**What to do.** Two small pages, one per path.

- **Thank-you page** (after a free signup): "Check your email, your result is on the way." Then immediately offer the natural next step. Jay's opt-in thank-you page offers the paid offer right there, politely, because the moment after someone says a small yes is the best moment to show them the next step. Add a backstop line too: tell people what to do if the email does not arrive within about 15 minutes. Jay's version says to check the spam or promotions folder first, and if it is still missing, write to his contact address. Email delivery fails sometimes. A person staring at an empty inbox should never have to guess what to do next.
- **Welcome page** (after payment): the very first thing a buyer sees. Give them a numbered list. First do this, then this, then this. Jay's paid offers each redirect to their own welcome page that starts delivery immediately.

**How Jay did it, including the mistake.** Jay's paid offers include downloadable resource kits. The first kit shipped at a normal public web address, which means anyone who guessed or shared the URL got the paid product free. His own note on it: a paid kit at a guessable URL is a free kit. The fix on the next offer was a **token-gated** download: the link only works with a secret expiring code that buyers receive, and a bad code bounces you to the sales page instead of the file.

**Now you.** Build both pages. And keep every paid file out of your public site entirely. The zero-tech version of token-gating: do not link paid files anywhere. Email them to each buyer directly from the welcome flow. Nobody can guess a link that does not exist.

---

## The two boring pages you still need

Two more pages before your checkout is honest. Nobody visits them on purpose. They still have to exist, because the checklist below requires them, and because money is changing hands now.

**The terms page.** The written rules of buying from you: what you sell, what it costs, how refunds work. You already met the rule that comes with it, back in Step 2: your refund promise must appear here in the same words as on your sales page. An audit flagged that exact mismatch on Jay's site: the refund showed on the page five times and in the terms zero times. So write the refund line once in your truth file, then paste it into both places. Then a parent reads the whole page before it goes live. A review by a real lawyer is the gold standard, and "verify before publishing" applies to every claim on this page.

**The privacy page.** One honest paragraph is enough at your size. Say what you collect (names and emails), what you do with it (send the emails you promised), and that you never sell it. If that paragraph would be a lie, fix the practice, not the paragraph.

Both are simple pages written in plain sentences, not legal documents you need to decode. And to be clear about what this chapter is: this playbook is education, not legal counsel. When the business grows past a first offer, that is the moment to pay for real legal help.

---

## Step 7: Make every door countable

**What to do.** Never paste your page's raw address into a bio or a post. Every link you publish should pass through one counting doorway on your own domain, so you can see which posts actually send people.

**How Jay did it.** Every link he publishes goes through a `/go` address on his own site. A visitor clicking it gets forwarded to the real page in a blink, and the hop is counted on his side, because the social platforms hide or mangle click data. Each link also carries **UTM labels**: tiny tags on the end of a link, like `?utm_source=instagram`, that record where the visitor came from.

Then he went one better. His bio holds a single permanent short link, `/quiz`, that quietly forwards through the counting doorway to whichever free front door he is featuring that week. His note on why: "This gives you ONE permanent bio link... so you never paste a long UTM URL or swap it weekly again."

Three counting rules he wrote down after getting burned:

- **Counters never backfill.** Attribution just means knowing which post sent which visitor. From his audit: "every week of traffic before these fixes is attribution lost forever." In plain words: clicks you did not count when they happened can never be counted later. Set up counting before your first real promotion week, not after.
- **A typo must not count as a click.** His system once logged misspelled links as real offer clicks. Unknown links now forward to the homepage and get logged as typos.
- **Tag your own test clicks** with a label like `test` and ignore them in your counts, or you will celebrate traffic that was just you checking your work.

**Now you.** Use whatever counting your page builder gives you, but obey the discipline even if the tech is simple: one link per post, labeled by where you posted it. The zero-tech way to label a link: add `?utm_source=instagram` (or tiktok, or youtube) to the end of the link before you paste it into a post. It is just text you type onto the end of the URL. The page still loads. Your page builder's stats will then show which source sent each visitor. For the bio, most free link tools (or your page builder's own short-link feature) let you keep one permanent link and change where it points later, so you never have to edit the bio itself. The chapter on counting what works turns these clicks into a weekly scoreboard.

---

## Step 8: Keep every page in sync with your truth file

**What to do.** Your truth file (from the offer chapter) is the boss of your website, not the other way around. When your price, promise, or refund changes: update the truth file first, then fix every page that mentions it.

**How Jay did it.** The rule at the top of his truth file says every piece of content quotes that file, prices and links are never hardcoded anywhere else, and if the file and any other document conflict, the file wins. The standard he holds himself to: any page or email quoting a retired price or a banned claim "is a bug, not content."

Watch how small and boring this looks in practice, because boring is the point. When he decided his free check should be described as "2-minute" instead of "3-minute," he changed the truth file first, counted every place the old wording appeared, then sent his site helper a one-paragraph instruction to change exactly those instances, ending with "Change nothing else on the page."

Three sync rules that come with this:

- **Fix the paper before the paint.** Jay once had a truth file so out of date that it technically defined his live $97 price as an error. His own warning: any obedient future AI helper reading that file would have deleted the correct price off the live site. Update governing documents in the same sitting as the pages.
- **Retired pages get a forwarding sign, never an error.** When Jay killed an old offer, its page got a **301 redirect**: a permanent "we moved" sign sending old links to the new page. Old links in old posts keep working forever. Never let a retired page turn into an error screen.
- **A page nobody links to gets zero visitors.** Both of Jay's $97 pages launched as complete orphans, meaning no other page on his site linked to them, and an audit caught it. The fix cost almost nothing: links in the site footer and one section on the homepage. Every new page needs at least one link pointing at it from a page people already visit.

**Now you.** After any offer change: truth file first, then list every page and bio that mentions the old fact, then fix each one, then sweep for stragglers. Old wording hides in weird places. When Jay swept his site the day after a pivot, he still found the retired offer living in a PDF print source and in old email templates.

---

## Step 9: Audit with AI, then fix one written prompt at a time

**What to do.** Once your page is live, do not stare at it wondering if it is good. Run the loop Jay runs: audit, get a findings list, verify the findings are real, fix one at a time with written instructions, verify live.

**How Jay did it.** Twice, at full scale. In early July 2026 a multi-agent AI audit of his site produced dozens of findings, and fewer than half survived verification. The confirmed fixes (a terms rewrite, disclosing AI use, fixing a fictitious former price, a proper error page) were deployed the same day. A week later a bigger audit found 66 problems. Jay did not fix them randomly. He ordered them: stop anything harmful first, fix the rule documents second, fix the pages third. And every fix came with its own proof: the thing you would check to know it worked. That ordering is the part you copy. The whole plan was executed in one day.

Each fix was applied through the same instruction pattern, which you can copy.

**COPY AND ADAPT: the fix-prompt pattern**

Every instruction Jay pastes to his site-editing AI has three parts:

1. **Context:** what this change is and what it must not touch.
2. **The exact change:** the precise copy to use, the pattern page to imitate, and explicit prohibitions (his prompts include lines like "Do NOT include any testimonials, client counts... Zero fabricated proof.").
3. **A closing verification order:** check that it worked and report back. His prompts end with the verify list and "Report the deployed URL." That last order just means: send back the live page address once the change is published.

Two warnings before you trust any audit:

- **AI audits fabricate.** One AI audit of Jay's site invented an award he never received, and another suggested fake scarcity and testimonials that did not exist. He took the structural advice and rejected every invented fact. Treat every audit claim about the world as unverified until you check it.
- **Verify findings before fixing them.** Two findings in one of Jay's audits turned out to be flat wrong when checked. Fixing a non-problem wastes a day and can break a working page.

And after every fix, check the live page with a **cache-busted** reload: add a random bit like `?x=123` to the end of the URL so your browser fetches the fresh page instead of showing you a saved old copy. Jay checks every page this way right after publishing a change, because the old version has fooled him before. Keep a short "verified working" list too, so you never waste a session re-fixing something you already proved fine.

**Now you.** Monthly, or after any big change: paste your page text into an AI and ask it to audit against your checklist (the one below is a fine start). Get a numbered findings list. Cross out anything you can prove wrong or that asks you to invent proof. Then fix the real ones one at a time, each with a written three-part prompt, and verify each fix on the live page before starting the next.

---

## Check your work: your first landing page

- [ ] The page is about ONE offer with ONE main button.
- [ ] Headline, problem, guide line, plan, CTA, and success picture all come from your BrandScript.
- [ ] Price, promise, and refund line match your truth file word for word.
- [ ] The offer is shown as a visible stack with honest, defensible values, a real total, my lower price, and the visible gap; the guarantee sits by the button; and every number matches my truth file.
- [ ] A free front door sits at the top, and the email comes before the result.
- [ ] The result is never walled off after being shown, and the free tool fails open.
- [ ] The signup form asks for first name and email only.
- [ ] The refund promise appears on the page AND in your terms page, in the same words.
- [ ] Zero fabricated proof: no invented reviews, counts, or fake "spots left." Any capacity number you show is real and enforced.
- [ ] The buy button opens a tested Payment Link with its own product name tag, opened and supervised by a parent.
- [ ] A thank-you page exists for signups and offers the next step.
- [ ] A welcome page exists for buyers with numbered first steps, and it is the payment redirect.
- [ ] No paid file is reachable at a public link.
- [ ] Every published link is countable and labeled with where it was posted; the bio holds one permanent short link.
- [ ] At least one existing page or bio links to this page (no orphans).
- [ ] You checked the live page with a cache-busted reload.
- [ ] A parent has read the page, the terms, and the refund promise.

## Words you just learned

- **Domain:** your rented address on the internet, like `yourbusiness.com`.
- **Page builder:** a tool that turns words into web pages without code.
- **Hosting:** the computer that keeps your page on the internet 24/7. Beginner page builders usually include it.
- **Landing page:** one page about one offer with one main button.
- **Copy:** the marketing word for the words on a page.
- **CRM / contact list tool:** an address book app that remembers every person and what they did.
- **Tag:** a sticker your contact tool puts on a person ("took the quiz," "paid") so you know who did what.
- **Payment link:** a ready-made checkout page from Stripe; you paste the URL behind your button.
- **Webhook:** the automatic ping sent to your systems when something happens, like "this person just paid."
- **Front door:** the free useful thing (quiz, check, calculator) a stranger meets before any buy button.
- **Opt-in page:** a page whose only job is getting a visitor to type in their email, opting in to hear from you.
- **Funnel:** the path a stranger walks from finding you to paying you. Your free front door is its front end.
- **Lead:** a person who gave you their email, meaning you can follow up.
- **Thank-you page / welcome page:** where people land right after signing up or paying; each one points to the next step.
- **Token-gated:** a paid download that only opens with a secret expiring link, so non-buyers cannot guess the URL.
- **Terms page:** the written rules of buying from you; your refund promise lives here in the same words as on your sales page. A parent reads it before it goes live.
- **Privacy page:** one honest paragraph saying what you collect, what you do with it, and that you never sell it.
- **UTM labels:** tiny tags on the end of a link that record where a visitor came from.
- **/go counting doorway:** routing every published link through one countable hop on your own site.
- **301 redirect:** a permanent "we moved" sign so old links reach the new page instead of an error.
- **Orphan page:** a page nothing links to, which therefore gets no visitors.
- **Truth file:** the one file holding your real price, promise, and links; every page copies it, never the reverse.
- **Cache-busted check:** reloading with a random `?x=123` on the URL so you see the new page, not a saved old copy.
- **Audit:** a structured review of your site that outputs a findings list you verify, then fix one at a time.

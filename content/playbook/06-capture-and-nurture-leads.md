# Capture Leads and Follow Up

When this chapter is done you will have: a place that stores every person who gives you their email, a welcome email that goes out the moment they sign up, and a short follow-up sequence that keeps talking to them after you have gone to bed.

---

## What you need

| Thing | What it is | Rough cost | Time |
|---|---|---|---|
| An email tool | Any tool that can store contacts, put labels (tags) on them, and send automatic email sequences. Jay uses GoHighLevel, a paid all-in-one CRM (defined just below). Plenty of email tools have free or cheap starter plans that do everything in this chapter. Pick one, any one. | $0 to paid, depends on the tool (verify current pricing before you commit) | 1 to 2 hours to set up |
| Your free thing | The quiz, checklist, or PDF from your offer work. You trade it for an email address. | $0 | Already built |
| A real Gmail address | Not your business email. You will use it to test whether your emails land in the inbox or in spam. | $0 | 5 min |
| A parent or mentor | Someone to read your emails before real people get them. | $0 | 20 min |

Total new cost: possibly $0. Total time: one focused weekend to set up, then about 30 minutes a week.

---

## First, two words you need

**A lead is anyone who gave you their email but has not paid yet.** Not a follower. Not a like. An email address you are allowed to use. Followers belong to the platform. Leads belong to you.

**A CRM (customer relationship manager) is one app that stores every person who ever gave you their email.** Think of it as a contacts app with superpowers: it remembers where each person came from, what they clicked, what they bought, and it can send emails automatically based on all of that. Jay's CRM is GoHighLevel (GHL). Yours can be any email tool with contacts, tags, and automations. The brand does not matter. Having ONE place matters.

---

## Step 1: Capture the email BEFORE you show the result

**What to do:** Whatever your free thing is (a quiz, a check, a guide), ask for the email before you hand over the payoff. Someone finishes your quiz, you say "enter your email and I'll send your result," THEN they see it.

**How Jay did it:** Every free front door at Outsmart the System works this way. The 2-minute quizzes on his site collect the email first, then show the result. His notes call the free useful thing a "lead magnet" or "primer": the thing you trade for someone's email. Here is why the order matters. If you show the result first, most people read it, feel good, and leave forever. You have no way to reach them again. The visit taught you nothing and built you nothing. Capture first, and every single person who wanted the result is now someone you can follow up with. One honest rule that goes with this: never trick people. The result must actually arrive, and it must actually be useful.

**Now you:** Look at your free thing. Where does the email box sit? If the payoff comes before the email box, flip the order. If you have no email box at all, add one. You do not need to code this: every email tool in Step 2 gives you a free signup form or a simple page you can link to. If your free thing is a Google Form, just make name and email the first two required questions. Two fields only: name and email. Every extra field costs you signups.

---

## Step 2: Put every contact in one place and label them

**What to do:** Set up your email tool. Heads up: most email tools require the account owner to be 18 or older, so have a parent create the account with you, then do the building yourself inside it. Create your contact list. Then create tags. A **tag** is a sticky label on a contact ("took-the-quiz", "paid") that tells your automations what to do next.

**How Jay did it:** He started from zero and admitted it. An audit of his CRM found nothing set up: no automation at all. His own spec put it bluntly: "a conversion would evaporate on arrival." In plain words: if someone had signed up or paid, nothing would have happened next, and Jay would never have known.

The fix took about 30 minutes of clicking in the CRM (some things cannot be automated; he built this part by hand in the app). He created:

1. **One pipeline with 7 stages.** A **pipeline** is a board that shows how far each person has traveled. His stages mirrored his customer journey at the time: Primer opt-in, Gap Check done, Interview started, Interview completed, Blueprint delivered, 1:1 booked, Client/Alumni. In plain words: got the freebie, took the quiz, started the paid session, finished it, got their report, booked a call, became a customer. One glance told him where everyone was stuck. The stage names change when the offer changes; the structure is what you copy. Your stages will have your own names, but they should tell the same left-to-right story.
2. **A source field on every contact.** A hidden field called `ots_source` records which post or platform each person came from. His spec calls this "the attribution loop." When someone eventually buys, he can trace the sale back to the exact piece of content that started it.
3. **Tags on every entry point.** The primer form stamps `primer-optin`. The quiz stamps its own tag. A payment stamps `side-hustle-paid`. Every door into the business leaves a label.

**Now you:** In your email tool, make one list and three tags to start: one for your free thing ("got-freebie"), one for buyers ("paid"), one for people who replied to you ("replied"). If your tool has no pipeline feature, a plain spreadsheet with a "stage" column works at your size. The system matters, not the software.

---

## Step 3: Wire it so a signup triggers a robot, automatically

**What to do:** Connect the pieces: when the tag appears, an automation starts. An **automation** (also called a workflow) is a robot recipe: WHEN this tag is added, DO these steps (send an email, wait 2 days, check something, send another). The tag being added is called the **trigger**.

**How Jay did it:** One rule runs his whole system: **every capture point stamps a tag, and every automation triggers on the tag, never on the form.** The primer form tags the contact `primer-optin`, and that tag starts the welcome sequence. When someone pays, Stripe (the payment company) sends a **webhook**. A webhook is one tool automatically telling another that something happened. Here it means Stripe tells the CRM "this person paid." That stamps the paid tag, and the tag triggers the delivery email. No human in the loop, no lead waiting overnight.

Why tags and not forms? Because people arrive through many doors (a form, a quiz, a payment, a manually added contact) and you want them all to end up in the same well-built sequences. The tag is the common language.

Two settings from Jay's build worth copying exactly:

- On nurture sequences (the automatic follow-up emails you will build in Step 5), turn ON "stop when they reply" and "stop when they book." The moment a real conversation starts, the robot shuts up.
- On delivery workflows, turn OFF "allow re-entry" so nobody gets the same welcome twice.

**Now you:** In your email tool, build one automation: WHEN tag "got-freebie" is added, SEND the welcome email (you will write it in the next step). Test it by signing yourself up. If your tool cannot trigger on tags, trigger on joining the list. Same idea.

---

## Step 4: Write the welcome email

**What to do:** The welcome email goes out the instant someone signs up. It has two jobs: deliver the free thing they asked for, and start a conversation. One backup to build in: your thank-you page (the page people land on right after they sign up) should tell them what to do if the email has not arrived in about 15 minutes: check spam first, then email you directly. The website chapter covers building the thank-you page itself.

**How Jay did it:** His first email delivers the primer immediately and then asks one question. The actual opener beat, from his sequence: "Here's The 5 Money Stories: [link]" followed by "Then hit reply and tell me which pattern your teen is watching most. I read every answer." (The money-stories idea Jay teaches in the primer builds on work by Tom Farrar.)

Notice what it does NOT do. No pitch. No "buy now." No life story. Deliver, then ask a real question you will actually answer. The reply matters more than it looks: a reply tells the email system this sender is a real human people want to hear from, which helps your future emails land in inboxes. And every reply is free market research.

**Copy and adapt: the welcome email skeleton**

> Subject: Your [free thing] is here
>
> Hey [first name],
>
> Here's the [free thing] you asked for: [LINK]
>
> [One or two sentences on how to use it or what to look at first.]
>
> Then hit reply and tell me [one specific, easy question about their situation]. I read every answer.
>
> [Your name]

The [first name] blank is a **merge field**: a placeholder your email tool fills in with each person's real name automatically.

**Now you:** Write yours. Under 150 words. One link, one question, zero selling.

---

## Step 5: Write the nurture sequence

**What to do:** A **nurture sequence** is a short series of pre-written emails that goes out automatically over about ten days, warming a stranger from "just wanted the free thing" toward one offer.

**How Jay did it:** His primer sequence is 5 emails. The cadence: E1 immediately, E2 on day 2, E3 on day 4, E4 on day 7, E5 on day 10. The writing rules, straight from his spec: 180 to 220 words each, one idea per email, one CTA (call to action, the single thing you ask them to do), and the P.S. carries the mission. Here is the arc, with his real beats:

- **E1, deliver and ask.** The welcome email from Step 4.
- **E2, a story plus a tiny free step.** Jay tells the story of a teen (told with the name changed, so nobody is identifiable) who looks fine on the surface and is quietly learning the wrong money lessons, then ends with one low-pressure ask: "Take the free 2-minute check." Still nothing for sale.
- **E3, reframe the problem and introduce the offer.** His opener: "Your teen doesn't have a knowledge problem." The email argues the real problem is the pattern running underneath, "and the pattern always wins against a worksheet." Then, for the first time, the paid offers appear: Jay presents his two $97 programs and tells the parent which one fits their teen.
- **E4, exactly what you get.** His opener: "I'll be specific about what happens after your teen starts, because most programs are vague here and it matters." Then a plain list of everything in the offer.
- **E5, the honest last call.** It opens by saying it is the last note in the series, gives the honest founder version ("I spent 20 years building businesses and was financially illiterate for most of my career"), and links both programs one final time. The P.S. is the giveaway of how un-pushy this is: "If now isn't the time, keep the primer. The move for your teen's pattern works with or without me."

No fake countdowns. No "price doubles at midnight." The last call is honest: this is the end of the series, here is the offer, no hard feelings either way. Every link in every email carries tracking codes (**UTM parameters**, little labels stuck on the end of a link) so a later sale can be traced back to the exact email.

One trap Jay hit that will save you pain: when his offer changed, he rewrote the email copy in his planning file and the LIVE emails in the CRM still held the old, dead offer, ready to send to the next signup. His note on it: "Editing THIS file does not change GHL." Re-pushing to the live tool is a separate step. Wherever your master copy lives, changing it there changes nothing until you paste the new version into the email tool itself.

**Now you:** You will write a 3-email version in the worksheet at the end: story, offer, honest last call. Same arc, smaller. Keep the length rule (under 220 words) and the one-CTA rule. They are what keep the emails readable.

---

## Step 6: Broadcasts, and when NOT to send one

**What to do:** A **broadcast** is one email you send manually to many people at once, unlike the automatic sequence from Step 5. Use it for real news: a new offer, an event, a genuinely useful thing you made.

**How Jay did it:** This one is a story about restraint. Jay had 225 existing contacts and a re-introduction broadcast written and ready. Then he paused it on purpose. His reasoning: most of those 225 people had not heard from him in a long time (a "cold" list), and mass-emailing them just to collect signups was exactly the lazy move he was trying to quit. His note: "the people worth an email are worth a personal note." He switched to personal, one-at-a-time outreach instead. His fallback rule if he ever does batch: start with about 25 people, then about 50, never the whole list blind.

The lesson for you: a list is not a slot machine. When your list is small, a personal note to ten right people beats a broadcast to a hundred. Save broadcasts for when you truly have news, and even then, small batches first so a mistake (a broken link, a typo, a spam problem) hits 25 people instead of everyone.

**Now you:** Nothing to build. Just write the rule where you will see it: "Small list = personal notes. Broadcasts are for real news, in small batches."

---

## Step 7: The keyword DM trick

**What to do:** Post something useful on social media and end with: "Comment [WORD] and I'll send it to you." When someone comments the word, you send them a direct message (DM) with the link. A public comment becomes a private conversation that you start.

**How Jay did it:** This lane came out of his work with his content coach, James Guldan. On his personal Facebook profile, Jay posts a short story or credibility line, names the gap, mentions the free 2-minute check he built, and ends with "Comment INVEST and I will send it to you" (or HUSTLE, depending on the week). Then, and this matters, **he sends every DM by hand within 24 hours.** His own rule: "You send every DM by hand. No automation on a personal profile (Facebook ToS). About 10 minutes a day." Automating DMs from a personal profile breaks Facebook's terms of service and can get the account banned. Some tools can legally automate this on business pages; if you ever go that route, check the platform's current rules first, because they change. Hand-sent is safer, and at your size it is also better, because it is a real conversation.

**Copy and adapt: Jay's actual DM template (INVEST week)**

> Hey [name], glad that one landed. Here's the free 2-minute Teen Investor Profile I mentioned: [LINK]. Your teen answers a few questions and gets their profile by email, no card, nothing to buy. Reply and tell me what comes up for yours, I read every one. Jay

Notice: it delivers immediately, says plainly there is nothing to buy, and ends with a question. Every Friday Jay hand-counts two numbers: keyword comments received and DMs sent. His reasoning: it is the one number on his warmest surface that needs no tooling and cannot be dropped by a tracking bug.

**Now you:** Write one keyword post for your offer. Formula: your story or credibility line, the gap you noticed, "I made a free [thing]," then "Comment [YOUR WORD] and I'll send it." Pick a word that fits your business. Reply to every comment within 24 hours, by hand, with your version of the DM template. Send the link to your free thing's signup page (the email-first setup from Step 1), not the raw file, so they land in your email system.

---

## Step 8: The masterclass funnel (register, remind, replay)

**What to do:** A masterclass (also called a webinar) is a free live online class. The funnel: a registration page captures emails, reminder emails get people to actually show up, and a replay email catches the ones who missed it. It is a lead capture machine and a trust builder in one.

**How Jay did it:** He built a free parent masterclass funnel in one day (July 11, 2026, for an August 25 event). The parts:

- **A registration page** on his site. Registering stamps the tag `masterclass-registrant`, which triggers everything else.
- **The lead magnet was recycled.** Instead of writing a new bonus, registrants get the existing primer PDF. His build note: no new eBook gets invented, reuse the proven asset. Steal this: never build a new thing when a working thing fits.
- **Free hosting.** The event runs on Google Meet with a Google Calendar event. Zero cost.
- **Four reminder emails**, all triggered by the tag:
  1. **Confirmation, immediately:** the join link plus the primer as pre-reading.
  2. **Day before, 9:00 AM:** a reminder with the join link again.
  3. **One hour before, 4:00 PM:** short and human. His actual line: "One hour out. Grab your coffee and a notebook."
  4. **Next morning, 9:00 AM:** the replay link for everyone who missed it, plus, for the first time in the sequence, the paid offer.

Why so many reminders? Because people register with good intentions and forget. The reminders are not nagging, they are service: the pre-event emails each repeat the join link so nobody has to dig for it. And the replay email means even a no-show becomes a lead who got value and saw the offer.

**Now you:** You do not need this in week one. When you have an offer that works one-on-one (you and one customer at a time, written as 1:1) and you want to talk to many people at once, run a free 45-minute class on what you know. Registration form (name + email, tag them), free video call link, the four-email pattern above. Have a parent in the room or on the call with you when you host it.

---

## Step 9: After they pay, the emails matter MORE

**What to do:** The moment someone pays, they should get an email that says exactly what happens next. This is the **onboarding email**. Buyers who are confused in the first hour become refunds.

**How Jay did it:** Payment triggers everything automatically (the Stripe webhook stamps the paid tag, the tag fires the workflow). His post-purchase system has four pieces:

1. **The instant deliver-access email.** Numbered steps, in order. His skeleton: "Your [program] is confirmed. Here's everything, in the order to use it: 1. [intake form] 2. [resource kit] 3. [book your 1:1]" and it closes with "Just reply to this email if you have any questions." The numbered 1-2-3 is the point. A buyer should never wonder what to do first.
2. **The abandoned checkout rescue.** Someone who starts checkout but does not finish gets tagged. The automation waits 4 hours, checks whether the paid tag appeared, and if not, sends one friendly note: you started checkout and didn't finish, no worries, it happens, here is where you left off. And if now isn't the time, no problem at all. One email, no pressure, no fake urgency.
3. **The nudge.** If a buyer has not done the intake step after 2 days, one gentle reminder goes out. Automations are not just for selling; they are for making sure people actually use what they bought.
4. **A task for the human.** On his most expensive program, the same automation that emails the buyer also creates a task for Jay, due in 1 day: personally welcome this buyer and get them started. The robot handles the instant part, the human handles the relationship. For scheduling his 1:1 sessions, Jay's first version was deliberately manual: the email says "reply to this email with 2-3 times that work for you over the next 7 days" and he confirms one by hand. Manual first, tooling later.

One more hard-won rule: an automation that only notifies YOU is not done. One of Jay's early contact-form workflows pinged him internally and sent the lead nothing, so from the lead's side it looked like the message vanished. He upgraded it to: notify the owner, auto-reply to the lead, assign an owner, create a follow-up task. Every lead-in workflow needs all four.

**Now you:** Write your deliver-access email using the numbered skeleton above, even if "the program" is a babysitting booking or a lawn service slot. Confirmed, here is what happens next, 1-2-3, reply with questions. If your tool can do the abandoned-checkout wait-and-check, add it later. The deliver-access email comes first. One more rule: if you are under 18, a parent sets up and co-owns the payment account, and sees every refund request. Money in and out goes through them.

---

## Step 10: Do not land in spam

This can kill everything above silently, so do not skip it. **Deliverability** means whether your emails reach the inbox at all.

Jay tested his system by signing up with a real personal Gmail before sending to anyone, and his email landed in spam. The cause was technical. His tool was sending through one domain while the From address said another, so Gmail treated it as suspicious. The fix was setting up his sending domain correctly inside his email tool.

What you MUST copy is the test. Before you send your funnel to a single real person:

1. Sign up yourself with a real Gmail address (not your own business domain, which auto-trusts itself and proves nothing).
2. Check that the email lands in Primary or Promotions (not Spam) within a few minutes. That is Jay's pass bar.
3. Click every link and make sure each one works.
4. Confirm the unsubscribe link is present (good email tools add the legally required unsubscribe link automatically).

One caveat on the fix. The exact settings involve DNS records with names like SPF, DKIM, and DMARC, and they differ by tool and domain, so verify the specifics for your own setup before copying anyone's, including Jay's. If you land in spam, do not shrug: check your email tool's support docs about domain setup, re-test until you pass, and get a parent to help with this part.

---

## Worksheet: your welcome email and 3-email follow-up

Write these for YOUR offer, on paper or in a doc, before you touch the email tool. Rules for all four: one idea, one CTA, no fake urgency, no invented numbers. Length rules: the welcome email (Email 0) stays under 150 words, and each of the three follow-up emails stays under 220 words. Have a parent or mentor read them before anyone else does.

**Email 0, the welcome (sends instantly):**

- Subject: Your ______ is here
- Deliver the free thing: "Here's the ______ you asked for: [link]"
- One line on what to do with it first: ______
- One reply question: "Hit reply and tell me ______. I read every answer."

**Email 1, the story (sends day 2):**

- One short true story from your life or your customer's world that shows the problem your offer solves: ______ (if the story is about a real person other than you, get their permission first, or change the details so they cannot be identified)
- The lesson in one sentence: ______
- Soft CTA to a free step (your quiz, a checklist, a question), not the paid offer: ______

**Email 2, the offer (sends day 4):**

- Reframe: "You don't have a ______ problem. You have a ______ problem."
- Introduce the paid offer in plain words: what it is, who it is for, what it costs: ______
- Exactly what they get, as a short list (be specific, most people are vague here and it matters): ______
- One link.

**Email 3, the honest last call (sends day 7):**

- Open with the truth: "This is the last email in this series."
- One honest line about why you built this: ______
- The offer, the price, and the link, one last time.
- P.S. that gives them a graceful out: "If now isn't the time, keep the ______. It works with or without me."

Then build it: load all four into your email tool, set the automation (trigger on your signup tag, with the day waits between emails), turn ON stop-on-reply, and run the Gmail test from Step 10 on the whole sequence. To test the whole sequence without waiting a week, temporarily change every wait from days to 2 minutes, sign up with your test Gmail, watch all four arrive, then set the waits back to days before any real person signs up.

---

## Check your work

- [ ] My free thing captures the email BEFORE showing the result
- [ ] Every contact lands in one tool (or one spreadsheet), with a tag showing where they came from
- [ ] Signing up triggers the welcome email automatically, within a minute
- [ ] Welcome email delivers the free thing and asks one reply question
- [ ] My 3-email follow-up is written, loaded, and follows the rules (under 220 words, one CTA each, no fake urgency)
- [ ] Stop-on-reply is ON for the nurture sequence
- [ ] Buyers get an instant "here's what happens next" email with numbered steps
- [ ] If I am under 18, a parent co-owns the payment account and sees every refund request
- [ ] I tested the whole funnel with a real Gmail and landed in Primary or Promotions, not spam
- [ ] Every email a lead can trigger also does something FOR the lead, not just notify me
- [ ] If I run a keyword post, I answer every comment by hand within 24 hours
- [ ] A parent or mentor read every email before real people got them

---

## Words you just learned

- **Lead:** anyone who gave you their email but has not paid yet.
- **Lead magnet:** the free useful thing you trade for an email address.
- **CRM:** one app that stores every contact and what they have done; a contacts app with superpowers.
- **Tag:** a label on a contact that tells your automations what to do next.
- **Trigger:** the event (usually a tag being added) that starts an automation.
- **Automation / workflow:** a robot recipe: when the trigger fires, do these steps in order.
- **Pipeline:** a board showing how far each person has traveled, from signup to customer.
- **Merge field:** a placeholder like [first name] that the email tool fills in per person.
- **Nurture sequence:** pre-written emails that go out automatically over days, warming a lead toward one offer.
- **CTA (call to action):** the one thing an email asks the reader to do.
- **Broadcast:** one email sent manually to many people at once.
- **Keyword DM:** "comment WORD and I'll send it," turning a public comment into a private conversation.
- **Webhook:** one tool automatically telling another that something happened, like Stripe telling your CRM "this person paid."
- **Onboarding email:** the instant "you're in, here's step 1-2-3" email after a purchase.
- **Abandoned checkout:** they clicked buy but did not finish; a friendly reminder a few hours later.
- **Deliverability:** whether your emails actually reach inboxes instead of spam.
- **Unsubscribe link:** the legally required "stop emailing me" link; good tools add it automatically.
- **UTM parameters:** tracking labels on the end of links so you know which email or post a click came from.

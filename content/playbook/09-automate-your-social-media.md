# Automate Your Social Media

When this chapter is done, you will have a batch-and-schedule system: one locked visual template, one scheduling tool loaded with a full week of posts, and a set of rules that keep the automation honest. You will make content once a week instead of scrambling every day.

---

## What you need

| Item | What it is | Rough cost | Time |
| --- | --- | --- | --- |
| A parent or guardian in the loop | Social accounts and AI tools have age rules and terms of service. Set everything up together. | Free | 30 min once |
| One design tool that saves templates | Any app where you can build a design once and reuse it by swapping the words. Free options exist. | $0 | 1 afternoon to build the template |
| One scheduling tool | An app where you load a week of posts and it publishes them at set times. Jay uses PostEverywhere. Pricing varies by tool, so verify before buying, and check free tiers first. | $0 and up | 1 hour to set up |
| Optional: AI video tools | HeyGen (paid plan, makes AI avatar video and clips long recordings), ElevenLabs (reads your script in a cloned voice; low cost, verify current pricing). Only add these later. | Verify current pricing | Later chapters of this build |
| Weekly time | One batch sitting plus short daily reply windows. | Free | About 1 hour a week for you as a starter |

You do not need money to start. When Jay audited an outside strategy document, seven of the eight production steps it wanted him to buy tools for were already covered by tools he owned, at no extra cost. His written verdict: "Buy nothing." Audit what you already have before you spend a dollar.

---

## Step 1: Understand what automation is for, and what it can never do

**What to do.** Get the idea straight before you touch a tool. Automation moves your work to a better time. It does not remove you from the work. You still make the content. You still show up. The machine just posts it for you.

**How Jay did it.** Jay learned this the expensive way. In late May 2026 he went on a cruise and pre-scheduled a full week of posts. The posts went out on time. The posting rhythm held perfectly. And the week produced zero sign-ups and zero calls, because nobody was home to answer comments. The lesson, written into his runbook: the scheduled posts kept the rhythm going, but produced zero new customers or conversations, because nobody was home.

That lesson became two standing rules:

1. Never schedule a post for a time window you cannot attend. The first hour after a post goes live is when people comment, and replying in that first hour is the part that turns attention into customers. It is never automated.
2. Automate production and publishing. Never automate presence.

**Now you.** Write these two rules at the top of your content notebook before you set up any tool. If you have practice on Tuesday nights, do not schedule posts for Tuesday nights. Schedule for windows when you can be on your phone for 30 minutes replying to comments.

---

## Step 2: Lock one visual template

**What to do.** Build one branded design you will reuse forever. Same colors, same fonts, same layout. Only the words change. This is what a template is: a fill-in-the-blank design. When every post uses it, your feed looks like a real organization instead of a random pile of images.

**How Jay did it.** Jay's whole visual system is four templates, and that is on purpose:

- **Quote card.** Cream background, one big quote in a serif font, maximum of about 14 words.
- **Stat card.** Dark background, one huge number, one line of text under it. A single number that stops the scroll.
- **Engagement card.** Cream with a gold frame, one question.
- **Carousel.** A multi-slide set (cover, body slides, closing slide), 6 to 8 slides, maximum 25 words per slide.

Everything is the same size (1080 by 1350 pixels, the tall 4:5 rectangle feeds prefer) and uses fixed brand constants: Cream #F5F1E8, Ink #1A1A1A, Gold #B89968, with the free Google Fonts Playfair Display and Inter. Jay's team wrote the rule down in their design document, and it is worth copying: "these 4 templates are the ENTIRE visual system." In plain terms, those 4 designs are the entire look. A new design idea waits for the weekly review, gets built to match the brand, and only then joins the set. Nothing improvised ever gets posted. That constraint is what makes the feed look like one organization instead of a random pile of images.

Two more details from Jay's build:

*One design, every platform size.* When Jay needed profile graphics, his team built the design once, then produced it in every size the platforms want (Facebook cover, LinkedIn banner, X header, YouTube banner, profile pictures, feed post, story). Same brand, resized. You never redesign per platform. You render the one design at each size.

*The renderer can be free.* Jay's team first specced Bannerbear, a paid service (about $49 a month) that turns templates into images automatically. Then they replaced it before ever paying: a free script (first using a Python image library, later HTML templates screenshotted by a free browser tool) produced identical output, same fonts, same colors, same templates. Every Monday a small instruction file gets written. It lists which posts need which template and which words. The script reads that file and drops the finished images into a folder. No human opens a design app.

He also tried letting an AI design tool invent graphics for him. Canva's AI design feature got rejected because it ignored the brand rules (wrong accent color, mangled details). The lesson is not "never use Canva." The lesson is: you set the template. The tool only fills it in.

**Now you.** You do not need code. Open any free design tool that lets you save a template. Build ONE card: your two brand colors, one font for headlines, one for body text, your name or logo small at the bottom, sized 1080 by 1350. Save it as a template. From now on, making a post image means duplicating the template and changing the words. Two minutes, not twenty. If you want a second style later (a stat card, a question card), add it deliberately, one at a time, and then lock the set.

---

## Step 3: Batch a week of content in one sitting

**What to do.** Pick one day a week. In one sitting, write every post for the next seven days, make every graphic from your template, and line it all up for review. Batching means you do the same kind of work back to back, which is far faster than switching between writing, designing, and posting every single day.

**How Jay did it.** Jay's batch day is Monday. His weekly mix has been re-cut more than once, so date it honestly. In early July 2026 the planned output was 5 short vertical videos cross-posted to 4 platforms, 3 LinkedIn posts, 2 X threads, 1 long YouTube video, and 1 Substack essay. By mid July 2026 it had settled into the current shape: an 11-slot weekly grid across four platforms (the full grid is in the content chapter), still fed by the same 5 short videos a week and still anchored by the Monday essay. The grid will change again when the numbers say so. The batching system underneath it does not. Either version sounds like a mountain. It is a few hours, because the system does the repetitive parts:

1. An AI assistant runs Jay's weekly checklist (he calls it /plan-week). It looks at last week's numbers and his saved bank of real stories, then drafts every post. Each draft must be built on one real story from that bank, never made up.
2. Every post that needs a graphic gets an entry in the instruction file, the render script runs, and all the images for the week appear at once.
3. Jay then does the one part that is never skipped: the review gate. He reads every single piece, edits the hooks (the first line, the thing AI drafts get wrong most), and approves or rejects. This takes him 25 to 35 minutes. Nothing publishes unapproved.

Compare that to his old life: posting daily by hand, deciding what to say every morning, designing each image from scratch. The batch system compressed a daily scramble into one weekly working session plus short daily reply windows. That is the whole payoff of this chapter. The hours you save go into the two things machines cannot do: making real stuff and talking to real people.

**Now you.** Pick your batch day. Sunday afternoon works for most students. In one sitting: write 3 to 5 posts for the week (each from your own real stories, not generic filler), fill your template for each one, and put everything in one folder or document. Then do your own review gate. Read every post out loud. If a sentence does not sound like something you would say to a friend, rewrite it. If a parent or mentor is your approver, they read the batch now, before anything is scheduled.

---

## Step 4: Load the scheduler

**What to do.** Put the approved batch into a scheduling tool. A scheduler is an app connected to your social accounts; you give it the post, the account, and the time, and it publishes for you. Load once, and your week runs itself.

**How Jay did it.** Jay uses PostEverywhere, which holds six connected accounts in one place (Facebook page, Instagram, LinkedIn, TikTok, X, YouTube). His weekly batch exports as a spreadsheet, a script pushes it into the scheduler, and the week is staged.

Real-world quirks he hit that you will hit too:

- **Video often needs a manual step.** PostEverywhere's automated upload only handles images, so video posts get created as drafts (loaded but not live) and Jay attaches each clip by hand in the app before hitting schedule. Drafts are your friend: everything sits in draft until the batch is approved, then you approve once.
- **Personal Facebook profiles cannot be scheduled by any tool.** Meta blocks it. Jay posts those by hand from a prepared copy file. Some surfaces stay manual, and that is fine.
- **Instagram and TikTok captions do not allow clickable links.** The caption says "link in bio" and the real link lives on your profile. YouTube Shorts descriptions ARE clickable, so the link gets pasted there.
- **One tracked link per post, always.** In June 2026, Jay published 88 posts and got exactly 0 link clicks, partly because links were untracked and scattered. Now every asset carries exactly one link with tracking tags (extra text on the link that reports which post each visitor came from), or it does not ship. Cold viewers (people seeing you for the first time, who do not know or trust you yet) always get sent to a free thing, never a buy button.

**Copy-and-adapt: Jay's posting schedule table.** His clip schedule was a simple 5-column table: post number, date, time, file, voice. Three posts a week at fixed times (Sunday 7:00 PM, Tuesday 7:30 PM, Thursday 12:30 PM), with a written escape hatch: "Dial back to 2/week (drop Thu) if it feels heavy." Steal the format and the escape hatch. A schedule you can actually keep beats an ambitious one you abandon.

**Now you.** Connect your accounts to one scheduler (with your parent, and check each platform's minimum-age rules). Load your approved batch as drafts. To make a tracked link for free, use a link shortener that counts clicks (Bitly and similar tools have free plans; set it up with your parent). Make one short link per post so you can see which post sent each visitor. Set 3 posting times per week that land in windows you can attend, write them in a table, and include your own dial-back rule. Then schedule the batch in one go.

---

## Step 5: Make video without filming every day (the AI avatar rule)

**What to do.** Learn what an AI avatar is before you decide whether to use one. An AI avatar is software that produces a video of "you" speaking from typed text, using a scan of your face and a clone of your voice. It means you can produce talking videos without setting up a camera every time.

**How Jay did it, including what he refused to do.** Jay used HeyGen, a paid AI video platform, to clone his own appearance and his own voice, with his own consent, on his own account. Type a script, get a video of Jay saying it.

Then came three rejections that hardened into standing rules:

1. He rejected cartoon personas outright: "I do not want to use cartoon avatar." A made-up character fronting the brand is a fake person, and the audience can feel it.
2. He rejected his own AI talking-head videos after watching them ("I do not like Jay Avatar videos") and deleted four posts. Passable is not the bar. If you would not share it, it does not ship.
3. He rejected a cut that placed his avatar next to an AI-generated kid. He called it "fake relationships." His community knows his real family, and a synthetic family scene reads as a lie the moment anyone who knows him sees it.

The surviving rules, written down so no future video breaks them: always use the highest-quality avatar engine, Jay's likeness only ever appears solo, and any family scene uses anonymous stock avatars who never look at the camera, clearly illustration, never presented as real people or real results.

The rule under all the rules: **your avatar is your real self or nothing.** Never a fake persona. Never anyone else's face or voice. Never your face next to AI-generated "friends" or "customers."

**Now you.** You probably do not need an avatar yet, and that is the honest answer. If you do go there later: clone only yourself, on an account set up with your parent, and check the tool's age and consent requirements first. Watch every video before it posts and hold it to the same bar Jay used: if you cringe, delete it. And never generate a fake person to appear in your content as if they were real.

---

## Step 6: Turn one long recording into many short clips

**What to do.** Record long once, cut short many times. One 40-minute conversation, presentation, or explanation can become weeks of short vertical clips. AI clipping tools do the first pass: you upload the long video, and the AI finds the strongest 30 to 60 second moments and cuts them into phone-shaped clips.

**How Jay did it.** Jay fed a 40-minute interview (a 637 MB file) into HeyGen's AI Clipping with settings for vertical 9:16 video, burned captions (subtitles printed into the video itself, so they work with the sound off, which is how most people watch), and 30 and 60 second targets. It returned 18 candidate clips, each scored, each with a download link.

Two workarounds you should know about, because you will hit the same walls:

- **The upload-size cap.** HeyGen rejects uploads over 200 MB. The fix was ffmpeg, a free command-line video tool: split the big file losslessly into roughly 8-minute chunks and run one clipping job per chunk. Big-file limits almost always have a split workaround. Look for one before paying for a bigger plan.
- **Download finished videos immediately.** HeyGen's download links expire within hours. Save every finished clip to your own storage the moment it is ready.

Then the honest part: Jay rejected the AI's first batch. The auto-captions landed on top of faces and the cut points could not be steered. So the team built their own free chain instead, using programmer tools (faster-whisper, free software that turns speech into text with timestamps, to find exact cut points, and ffmpeg to crop and caption). Captions went in the bottom strip of the screen where they cover nothing, and every clip ended with a 3-second branded closing card. You will do the same three things with a free phone editor; the tools differ, the recipe is identical. Result: 9 clean clips under 60 seconds from one recording, at zero cost. Anything borderline got a HOLD_ prefix on the filename and waited for review instead of shipping.

**Copy-and-adapt: the per-clip copy block.** For every clip, Jay's team fills one block in a single document: a hook ID, the on-screen hook line (shown in the first 1.5 seconds), an Instagram caption, a TikTok caption, a YouTube title and description with the tracked link pasted in, and 3 to 5 rotating hashtags. Writing all captions for all clips in one sitting is batching again. The conventions header from that file is worth taping to your wall:

> "One CTA per post... No naked links (June lesson: 88 posts → 0 clicks)."
> "Cold traffic goes to the free quiz, never a buy button."
> "Lead every clip with the on-screen hook in the first 1.5s."

**Now you.** Next time you explain your business to anyone (a class presentation, a practice pitch, a conversation with your mentor), record it once, with permission from everyone on camera. Pull 3 short moments from it. Free phone editors can crop to vertical and add captions; you do not need the command-line tools to start. Give every clip a caption written from a copy block like Jay's, one link, one ask.

---

## Step 7: Faceless motion video for stories

**What to do.** Learn the cheapest video format that exists: faceless motion video. No camera, no face. Your branded template cards become the visuals, a voiceover reads the script, and slow zoom on each card makes still images feel like video. That slow-zoom trick is called the Ken Burns effect.

**How Jay did it.** Jay's team codified three video production routes by cost. Route A is the flagship cinematic AI film (AI-generated scenes plus his cloned voice narrating, 30 to 45 minutes of work per video). Route B is voiceover over his own footage or free stock footage from Pexels (near zero cost). Route C is the one to copy first: motion-graphic video built from the same graphic templates used for post images. The chain has three parts. A text-to-speech tool (ElevenLabs) reads the script in Jay's cloned voice and produces the voiceover with timings. The same kind of templates from Step 2 become a series of still cards. Then a small program Jay's team wrote glues it together: it slowly pans across each card, fades from one to the next in time with the voice, and puts the logo in the corner. You will not build that program. Your manual version is below. Cost per video after the one-time build: effectively zero. Time: about 15 to 25 minutes each.

The proof it works: in one day, the team produced a complete 6-video story series this way, each video 29 to 37 seconds, each in a distinct template style. And here is the discipline part: those 6 finished videos were staged into the scheduler as a dry run (the computer checked every caption, link, and length as if posting, with nothing actually fired) and then held. Publishing waited for two checks: proof that people actually wanted the thing the videos pointed to (a small real-world test of the offer first), and Jay personally watching every video. Even a zero-cost pipeline does not get to skip the review gate.

**Now you.** Make one faceless video this month, the manual way. Write a 30-second script (about 70 to 80 words). Make 4 to 5 cards from your template, one per idea. Record yourself reading the script on your phone, or use a text-to-speech tool with your parent's okay. Drop the cards into any free video editor over the audio, add a slow zoom on each, and export vertical (1080 by 1920). That is a story or short, and your face was never on camera.

---

## Step 8: The rule that overrides every tool

**What to do.** Burn this in: automation never excuses fake content. A scheduler posting a lie is worse than you posting a lie, because it lies on time, at scale, while you sleep. Every automated piece must pass the same honesty bar as something you would say to a person's face.

**How Jay did it.** In July 2026 Jay brought in an outside strategy document, written by an AI, for growing a faceless video channel. Instead of running it, he audited it. The audit found the skeleton useful but caught the document inventing a "20-day no-regret guarantee" that did not exist anywhere in his business, plus proposed videos using banned fake scarcity and testimonial slots with no signed permission behind them. All of it was rejected. The lesson got written down as a standing rule: claims come only from one master list of what the business actually sells and actually promises, never from what a web page or an AI says. If a claim is not on the list, it does not go in a post.

So the pipeline has honesty checks built into the machinery itself:

- A sanitization checklist runs on every script before production, with the closing line "A violation is a bug, not content."
- A preflight check runs on every scheduled batch (scanning for broken or missing links, posts that are too long, and style rules the brand has banned) before anything can go out.
- No testimonial or story about a real person ships without signed written permission. For anyone under 18, both the teen and a parent or guardian sign, and until then the person stays anonymous.
- The founder watches or reads everything before it publishes. AI drafts. A human ships.

**Now you.** Adopt the copy-and-adapt preflight below and run it on every batch before you hit schedule. It takes five minutes.

**Copy-and-adapt: teen preflight checklist (run before scheduling each batch)**

- [ ] Every claim in every post is true and provable. No invented numbers, reviews, or results.
- [ ] No fake urgency ("only 2 left!" when there is no real limit).
- [ ] Anyone named or shown gave permission. Under-18s: teen plus parent signed.
- [ ] Each post has exactly one link and one ask, and the link works (click it).
- [ ] Instagram/TikTok captions say "link in bio," and the bio link is current.
- [ ] Every post is scheduled for a window you can attend for replies.
- [ ] You (and your adult approver) read every post in this batch. Nothing ships unread.

---

## The teen starter kit: one template, one scheduler, one hour a week

You do not need Jay's full machine. You need three things:

**1. One template.** Built once in a free design tool, saved, locked. Every image you ever post comes from it.

**2. One scheduler.** One tool, your accounts connected with a parent, batch loaded as drafts, approved once, scheduled once.

**3. One hour a week.** Here is the hour:

| Minutes | Task |
| --- | --- |
| 0-25 | Write 3 posts from your own real stories and results |
| 25-40 | Fill your template for each, save the images |
| 40-50 | Run the preflight checklist; get your approver's read |
| 50-60 | Load and schedule the batch for your attendable windows |

Plus 10 to 15 minutes on each posting day replying to every comment in the first hour. That part is the point. Jay's entire system exists to buy back time for exactly that.

Start at 3 posts a week. Earn more volume the way Jay does: only scale a format after it has produced real results (clicks, sign-ups, conversations) for two straight weeks. That prove-it-first discipline comes from the reliability idea Jay credits to Nic Peterson. Never scale because of views or likes.

---

## Check your work

- [ ] You have one saved, reusable template with fixed colors and fonts.
- [ ] You have one scheduler connected to your accounts, set up with a parent.
- [ ] You batched at least one full week of posts in a single sitting.
- [ ] Every scheduled post passed the preflight checklist.
- [ ] Every post has exactly one tracked or bio link and one ask.
- [ ] Every post is scheduled inside a window you can attend for first-hour replies.
- [ ] No post contains a fake person, fake claim, fake urgency, or unsigned story.
- [ ] If you used any AI voice or avatar tool, it is your own self, with consent, with a parent in the loop.
- [ ] You know your dial-back rule (what you cut first when the week gets heavy).

## Words you just learned

- **Batching:** doing all of one kind of work in one sitting (write everything, then design everything) instead of switching tasks daily.
- **Template:** a fill-in-the-blank design; only the words change, so every post matches.
- **Scheduler:** an app that publishes your loaded posts to your accounts at set times.
- **Draft:** a post loaded into the scheduler but not yet live; you review in draft, then approve the batch once.
- **AI avatar:** software that makes a video of you speaking from typed text, using a scan of your face and a clone of your voice. Rule: your real self or nothing.
- **Text-to-speech (TTS):** software that reads your script out loud, optionally in a clone of your voice.
- **AI clipping:** uploading one long video and letting AI find and cut the best short moments.
- **Burned captions:** subtitles printed into the video itself, so they show with the sound off.
- **Faceless video:** video with no one on camera; cards, footage, or motion graphics plus a voiceover.
- **Ken Burns effect:** slowly zooming or panning on a still image so it feels like video.
- **B-roll:** background footage that plays under a voiceover; free libraries like Pexels supply it.
- **End card:** a short branded closing screen with your name and your ask.
- **Hook:** the first line or first 1.5 seconds; its only job is to stop the scroll.
- **CTA (call to action):** the one thing you ask the viewer to do. One per post.
- **Link in bio:** the workaround for platforms where caption links are not clickable; the caption points to the link on your profile.
- **Tracked link:** a link with tags on the end that report which post and platform each visitor came from.
- **Preflight / dry run:** checking every caption, link, and claim as if posting, before anything real goes out.
- **Review gate:** the rule that nothing publishes until a human has read and approved it. AI drafts; a human ships.

# Guest feedback: what changed from the concepts, and why

Built: screens 1 to 5 from `01-build-first`, plus the two pages the designs link to but don't draw (All tickets and the ripple page). Screens 6 to 10 wait for review.

Rebuilt for Ed's Dunkin demo with Kyle on Kyle's ten real complaints. The demo uses no delivery data: everything comes from customer feedback, plus context from Sales and POS, Menu, and Checklists.

## Where to look

- Angela, district manager: `/feedback` (Ripples), `/feedback/tickets`, `/feedback/tickets/5105`, `/feedback/ripples/r-irmo-board`, `/feedback/settings`
- Marcus, Irmo #358804, on his phone: `/feedback/today`, then `/feedback/today/reply`
- Demo controls, Pret tab: "Angela, district" and "Marcus's phone". Reset walkthrough, under Cash features, clears every reply, ripple and setting.

## The data

- **Eight real stores:** Poughkeepsie #301184, Yonkers #332974, Bronx #340462 and White Plains #302692 in New York; Greenville #302065, Blythewood #350605, Irmo #358804 and Greenville #345207 in South Carolina. Manager and guest names are made up.
- **The ten open complaints are real,** word for word from Dunkin's feedback system (ids 5101 to 5110), with their reason, store, date and origin. Guest first names are made up so the drafts can greet someone.
- **Everything else is made up in the same style:** replied and resolved complaints, compliments, and the no-comment compliments at Irmo that give Marcus "3 thank-yous ready". Reasons use Dunkin's categories. There are no stars, because Dunkin's system gives reasons, not ratings.
- **The context lines on the real complaints are invented** to show the idea (for example, the Irmo drive-thru board showing old prices). Ed should say so, or Kyle may read them as facts about his stores.
- **The week is Sun Nov 15 to Sat Nov 21.** The demo clock is Saturday at 9:30 PM. Last week's figures (`LAST_WEEK` in `dunkinData.ts`) are made up. Engineering: compare against the real previous week.

## Business rules for Ed to check

- **Drafted:** #1 Receipt (till down, no points), #4 Slow Service, #5 Team Member Friendliness (nobody is named, so a draft is allowed), #6 Charges, #8 Order Accuracy.
- **Never drafted:** food safety (#7 paper on the egg, #9 "unsafe", #10 hair in the lid) and refunds (#2 charged with nothing received). These sit together in "Reply in person" on the district page.
- **No reply:** #3 is "Mobile walk-in (FYI only)". It counts in the reasons but never asks for a reply.
- **The own line** is required on every complaint while the setting is on. Compliments don't need one.
- **Simple thank-yous** are for compliments with no comment.

## Ripples

- **Three problem ripples and one praise ripple:** drive-thru prices at Irmo (#5, #6 and two made-up tickets, cause from Menu), the bag check at White Plains (#8 plus made-up tickets, cause from Checklists), and mobile orders after an early close at Greenville (#2 plus made-up tickets, cause from Sales and POS). Jasmine at Yonkers is the praise.
- **Each ripple card shows four things:** what guests said (reason, count, stores), the likely cause and the module it came from, two quotes, and one action.
- **The ripple page has one action at a time.** Mark fixed drafts a follow-up to every guest still open. Send follow-ups is a person's tap. The old "fixed and watching" step and the delivery chart are gone.

## Colour and type

- The designs' hex values are mapped to Edify tokens, not copied. Navy is `--color-text-primary`, the phone background is `--color-bg-nav`, yellow chips are the warning tokens, and the light blue "already done" chips are the review tokens.
- Pages are white, not the designs' cream (Nina's call after the first review). Cards sit on a hairline border instead, and unselected options use the neutral border token rather than pale yellow.
- **Pink is only the Edify mark** beside drafts and follow-ups, the AI signifier. It no longer marks the biggest ripple, a struck price, a chart dot or a phone row.
- **"Reply in person"** has a 2px warning-yellow border and a pale yellow header band with a navy shield. Each row carries a yellow tag for its type (food safety, refund).
- Everything is Poppins. A person's words (guests' quotes and the manager's own line in a sent reply) carry a thin grey bar down the left instead of a different font. Nina found the Merriweather italic harder to read.
- Cards carry a subtle shadow, sections sit 56px apart, and each section heading has its description directly underneath.

## Behaviour

- **Sending is simulated.** Replies save in the browser and the note under each composer says where the real one would go.
- **Voice uses the browser's speech recognition** where it exists (Chrome, Safari). Elsewhere the mic says so and the manager types. "From voice" shows only when the line actually came from the mic.
- **Nothing sends without a person,** except thank-yous for no-comment compliments at stores set to "Edify sends simple thank-yous" (Bronx and White Plains in the demo). Marking a ripple fixed drafts follow-ups; they wait until someone taps Send.
- **Flagged tickets never show a draft.** Allergy, food safety, a named team member and refund requests get an empty box and "Write this one yourself", with no Shorter or Warmer.
- **Settings are live.** Changing a store to automatic thank-yous sends that store's waiting thank-yous, switching sign-off changes every draft, and turning off the own-line rule unblocks Send.
- **The style note is saved but doesn't rewrite the drafts.** The drafts are fixed demo text. Engineering wires the note to the drafting model.
- **Shorter and Warmer** swap instantly between three pre-written versions. On the phone the draft starts at the shorter version.

## Pages

- **District chip.** The top bar shows "NY and SC stores, 8 stores, Angela Ruiz" where the cash pages have the site switcher.
- **District page,** top to bottom: the headline, four numbers (complaints, waiting on a reply, average reply time, compliments), "Reply in person", then "What's going wrong" by reason beside "What's going well" (compliments and the team members guests name), the ripple cards, and the replies waiting. Each reason row opens All tickets filtered to that reason.
- **All tickets** has status, store and reason filters. `/feedback/tickets?reason=Charges` opens filtered.
- **Ticket rows** show the guest, reason, origin and store, with the ripple tag or "FYI only".
- **Send moves you to the next ticket** on the desk, with a confirmation at the top and a line under Send saying which ticket opens next.
- **Reply settings** keep the region-sized store list (`/feedback/settings?stores=50` adds 44 made-up stores, never saved). The live preview uses Chris's reply at Irmo.
- **Phones:** a centred 430px column on a desktop. The district page sends phone-width visitors to Marcus's screen, which reads "Evening, Marcus" because the demo clock is Saturday night, and the huddle card is for tomorrow's 4:45 AM huddle.
- **JSX spacing gotcha.** Turbopack dropped the space between a number and text that contains `&apos;` ("6stores"). Where that happens, use `{' '}`.

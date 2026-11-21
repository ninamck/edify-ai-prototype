# Guest feedback: what changed from the concepts, and why

Built: screens 1 to 5 from `01-build-first`, plus the two pages the designs link to but don't draw (All tickets and the ripple page). Screens 6 to 10 wait for review.

## Where to look

- Angela, district manager: `/feedback` (Ripples), `/feedback/tickets`, `/feedback/tickets/4471`, `/feedback/ripples/r-bakery`, `/feedback/settings`
- Marcus, Fordham Rd, on his phone: `/feedback/today`, then `/feedback/today/reply`
- Demo controls, Pret tab: "Angela, district" and "Marcus's phone". Reset walkthrough clears every reply, ripple and setting.

## Colour and type

- The designs' hex values are mapped to Edify tokens, not copied. Navy is `--color-text-primary`, the phone background is `--color-bg-nav`, yellow chips are the warning tokens, and the light blue "already done" chips are the review tokens.
- Pages are white, not the designs' cream (Nina's call after the first review). Cards sit on a hairline border instead, and unselected options use the neutral border token rather than pale yellow.
- The "Waiting 26h" chip is warning yellow, not the designs' pink. Our token rules keep pink off status, and a wait is a status.
- Pink appears in a few places only: the biggest ripple's marker, the struck old price, the safety banner's border and icon tile, the never-drafted icons in settings, the late dots on the delivery chart, and the Edify mark beside "Your reply". The chart dots and the mark break the token comment ("never charts"); the designs depend on them, and filled-versus-hollow carries the meaning anyway, so colour is never the only signal.
- The safety banner and the "Edify never drafts these" panel have a pink border on white, with no pink fill.
- Merriweather Italic is used only for a person's words: guests' quotes, the manager's own line, and a fully hand-written reply on a never-drafted ticket. Everything Edify writes is Poppins.

## Behaviour

- **Sending is simulated.** Replies save in the browser and the note under each composer says where the real one would go (Dunkin feedback, Google, DoorDash or Uber Eats).
- **Voice uses the browser's speech recognition** where it exists (Chrome, Safari). Elsewhere the mic says so and the manager types. "From voice" shows only when the line actually came from the mic. Nothing fakes a recording.
- **Nothing sends without a person,** except five-star thank-yous at stores set to "Edify sends simple thank-yous" (Pelham Pkwy and Westchester Sq in the demo). Closing a ripple drafts follow-ups; they wait until someone taps Send.
- **Flagged tickets never show a draft.** Allergy, food safety, a named team member and refund requests get an empty box and "Write this one yourself", with no Shorter or Warmer.
- **The own line** is required under 4 stars while the setting is on. Send stays disabled, with a plain sentence saying why.
- **Settings are live.** Changing a store to automatic thank-yous sends that store's waiting thank-yous, switching sign-off changes every draft, and turning off the own-line rule unblocks Send.
- **The style note is saved but doesn't rewrite the drafts.** The drafts are fixed demo text. Engineering wires the note to the drafting model.
- **Shorter and Warmer** swap instantly between three pre-written versions. Pressing one again goes back to the standard draft. On the phone the draft starts at the shorter version, as in screen 4.

## Pages the designs didn't draw

- **District chip.** The top bar has a "BX Bronx district" chip where the cash pages have the site switcher, because this is Angela's view of six stores, not one site.
- **All tickets** is a plain list with status, store and source filters, using the same row as the district page.
- **The ripple page** has the cause, the evidence, stores, owner, status and the "closes when" rule. It carries Mark fixed (moves to Fixed and watching), Close ripple (drafts follow-ups) and Send follow-ups (a person's tap). The praise ripple has Tell Jasmine instead.

## Copy

- **Phone headline:** "9 guests wrote in." The designs say "overnight", but Dana's ticket came in Thursday morning, so I dropped the word.
- **Huddle card:** "For tomorrow's 4:45 AM huddle". It's 9:14 AM in the demo, so today's huddle has passed.
- **"Open the huddle" is left out.** It leads to screen 6, which isn't built yet.
- **"Why this draft" is gone.** The context block already says what Edify knows, so a second explanation was filler.

## Placement

- **Ripples are ranked, not equal rows.** The biggest problem ripple leads with both quotes, the big number and the only primary button. The other problems sit under "Also this week" as compact rows with one quote each, and praise has its own "Going well" row (Nina asked for more hierarchy than the concept's four identical rows).
- **The ticket page reads guest, then reply, then evidence.** The reply has a real heading ("Reply to Pat"), with Send directly under the box. The resolve choice shrinks to one line next to Send ("Stays open until the bakery's back on time · Change"), the same as on the phone, and opens by itself when in store is picked without a fix. Shorter and Warmer are quiet text toggles. The right column uses grey labels and smaller text, so it reads as supporting evidence.
- **Sections sit in their own boxes on a white page.** Every desk page uses the same white box with a light border (`whiteCard`) and more space between sections, following the ripple page. Page headings and the guest's words stay unboxed as the anchor. The phone screens are unchanged, because they already use cards on navy.
- **Send moves you to the next ticket.** On the desk, Send opens the oldest ticket still waiting on a reply, with a confirmation at the top ("Reply sent to Dana… 8 to go · See Dana's reply"). Focus moves to the confirmation. Under Send, a line says which ticket opens next, so nothing jumps without warning. When nobody else is waiting, the page stays put and says so. This replaces the old send, go back to the list, find your place routine, and matches the phone's one-at-a-time flow. We chose this over a Gmail-style reply inside the list, because the evidence ("What Edify knows" and the ripple) needs the room. A split view is still an option if people want the list visible while they work.
- **The store list in Reply settings is built for a region, at every size.** Nina's call: it looks the same whether there are 6 stores or 50. It shows 10 rows at a time ("Show 10 more", "Show all 50"; with 6 stores the footer just says "6 stores"), sorts A to Z, and has search by store or manager, filter pills with counts ("A person sends 42", "Thank-yous 8"), a "Slowest replies first" sort and checkboxes for bulk changes ("Set 3 stores to …"). Slowest first is there because slow stores are where thank-yous save the most time. To see it, open `/feedback/settings?stores=50`. That adds 44 made-up stores, which are never saved, and a banner says so.
- **Reply settings use one pattern: setting rows.** Each section has a heading and a one-line description, then a box of rows. Each row has the label and what it does on the left and a compact control on the right. Rows are the only kind of box on the page. The order is Who sends, How replies sound (with a live preview of Dana's reply), Reply times, Always comes to you (quiet, with a lock, no pink) and Stores last. Save sits in a bar that appears only after a change, with Discard. Fields use the shared `StyledSelect` at 44px (we added an optional `height` prop; the default of 38 is unchanged elsewhere) and 1px grey borders. Type sizes on this page are 28, 17, 14 and 13. This is the pilot for the area-wide refresh.
- **Reply tone inherits Brand voice.** Replies use the "# Brand voice" section from Settings, Context. Reply settings show it read-only with a link to edit, plus an optional "Extra for replies" note. That keeps one place that defines how the brand talks. Engineering: drafting should combine the two. In the demo the drafts are pre-written, so neither changes the text yet.
- **District page reads at a glance.** Top to bottom: the headline, then four numbers for the week (average rating, positive, low ratings, waiting on a reply), then the allergy banner, then two boxes side by side. "What's going wrong" ranks the ripples by how many low ratings each explains, plus a "No pattern" row for one-offs. "What's going well" shows positive counts, the highest-rated store and staff guests named. Each ripple bar jumps to that ripple's card in "The ripples in detail" below. Praise now lives only in "What's going well". Last week's figures (`LAST_WEEK` in `bronxData.ts`) are made up for the demo. Engineering: compare against the real previous week. Staff counts come from guests' words mentioning a known team name, which needs a real staff list per store.
- **JSX spacing gotcha.** Turbopack dropped the space between a number and text that contains `&apos;` ("6stores"). Where that happens, use `{' '}`.
- **Waiting list:** the district page lists waiting tickets without the allergy report, because the safety banner above already shows it. It still counts in the 9.
- **Phones:** the phone screens are a centred 430px column on a desktop. The district page sends phone-width visitors to Marcus's morning brief.
- **Morning briefing:** the guest feedback card on the Pret morning briefing shows only in Dunkin mode.
- **Support Centre:** the old feedback tab is gone, and so are the old Inbox, Insights and Settings screens.

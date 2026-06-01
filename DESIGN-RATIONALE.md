# Edify AI — Design Rationale

A running log of design decisions and the reasoning behind them. The
goal is not exhaustive documentation; it's so we can come back in two
weeks and remember _why_ something is the way it is, and so new
collaborators can ramp without us having to retell the same stories.

## How to use this doc

- One section per coherent decision area. Keep them small.
- Each section uses the same lightweight template:
  - **Decision** — what we chose, in one or two sentences.
  - **Reasoning** — why this beat the alternatives we considered.
  - **Trade-offs / open questions** — what we gave up; what we still
    aren't sure about.
  - **Status** — `live`, `prototyped`, `parked`, or `superseded`.
  - **Last updated** — `YYYY-MM-DD`.
- When we revisit a decision, _amend in place_ rather than starting a
  new section. Bump the `Last updated` line and append a short
  changelog bullet under the relevant subsection so the history is
  visible without a git blame.
- If something is purely an open question (no decision yet), put it in
  the [Open questions](#open-questions) section at the bottom and
  promote it to a full section once we land on an answer.

---

## Chat as the command surface

**Decision.** Operational commands (log waste, count stock, update
recipes / production / menus / suppliers) are invocable from the chat
composer via natural language, prompt chips, and a `/` slash menu.
They all converge on the same pre-filled confirmation card.

**Reasoning.** Operators already live in the chat surface for asking
questions; adding commands there means they don't have to learn the
nav tree to get work done. One execution path (the confirmation card)
keeps the visual vocabulary tight, and makes the "Edify is doing
something on your behalf" moment legible regardless of how it was
triggered.

**Trade-offs / open questions.**

- Discoverability sits on the `+` popover and the slash menu. We
  hide rarely-used commands (`waste` lives in floor actions instead)
  to keep the popover scannable, but that creates two ways to do the
  same thing for some flows.
- Free-text recognition is regex-based right now. Good enough for
  prototype testing; would need an LLM (or at least intent
  classifier) in production.

**Status.** prototyped
**Last updated.** 2026-05-27

---

## Each command starts a fresh chat session

**Decision.** Triggering a command resets the chat thread (messages,
card states, receipts) before running. Ambiguity picks and wizard
continuations explicitly opt out via `freshTask: false`.

**Reasoning.** A previous waste log shouldn't visually live alongside
a brand-new recipe edit — that mixes contexts and makes the receipt
trail confusing. A clean slate per task also makes the history list
meaningful (one task = one thread).

**Trade-offs / open questions.**

- The user loses anything they were mid-typing. Mitigated by
  auto-saving prior threads to history (see _Task history_), so
  nothing is actually destroyed — just moved.
- We may eventually want a "switch back to my previous thread"
  affordance from the composer, especially if free-text chat is in
  progress when a command fires.

**Status.** prototyped
**Last updated.** 2026-05-27

---

## Update-recipe is a wizard, not a single card

**Decision.** Updating a recipe walks the operator through pick
recipe → pick action → pick ingredient → enter new ingredient →
review. Each step is its own card in the chat thread.

**Reasoning.** A single dense form forced operators to decide
everything at once and increased the chance of slipping into the wrong
recipe. The conversational chain mirrors how they'd think about it
("change the milk in the flat white") and surfaces disambiguation at
the moment it matters, not buried in a dropdown.

**Trade-offs / open questions.**

- More cards = more vertical real estate. We mitigate by keeping each
  card short and using state pills (Done / Cancelled) so completed
  steps recede visually.
- The new-ingredient step has a typeahead against the product
  catalogue plus a "create new" escape hatch. We're betting the
  catalogue is comprehensive enough that "create new" is rare; if
  it isn't, we'll need to lean harder on disambiguation here too.

**Status.** prototyped
**Last updated.** 2026-05-27

---

## Confirmation button must read as a button

**Decision.** The terminal "save" action on each command card is
rendered as a rectangular, shadowed button inside a dashed callout
panel with a "NEXT STEP" eyebrow label and a check-circle icon —
explicitly not a pill.

**Reasoning.** Earlier prototype testing showed users missing the
pill-style confirm because it read as a chip. The dashed callout
and the eyebrow label re-frame the affordance as _"this is the
commit"_, which is the moment we most need them to slow down.

**Trade-offs / open questions.**

- Slightly heavier visual weight than the rest of the card. Worth it.
- We probably need a similar treatment on multi-item bulk confirms,
  which currently still use the smaller chip style.

**Status.** prototyped
**Last updated.** 2026-05-27

---

## Branding: Edify, not Quinn

**Decision.** All assistant-facing labels read "Edify". Removed the
model-name button entirely from the composer.

**Reasoning.** "Quinn" was an internal codename leaking into the
product. Operators don't pick a model, so a model picker is noise.
One name across header, chat bubble label, and signature reads as one
product.

**Trade-offs / open questions.** none current
**Status.** live
**Last updated.** 2026-05-27

---

## Task history: typed, persistent, two surfaces

**Decision.** Every chat-driven action is logged into a persistent
task history store (localStorage-backed) and surfaced two ways:

1. A compact **inline list** on the chat start surface, with filter
   chips, a pinned section, and a "Recent" section.
2. A portal-rendered **side drawer** for the full audit, opened from
   "View all", the chat-header clock icon, or the resume banner.

The taxonomy covers commands, **questions** (analytics / table
queries), and **chats** (free-form turns). Labels are kind-agnostic
("Recent", not "Recent tasks") so the framing doesn't lie when the
entry is just a question.

**Reasoning.** Operators told us a buried history accordion was easy
to miss and reads as a debug feature. Making history a first-class
surface — but compact by default with an escape hatch into the full
drawer — gives us continuity across sessions without crowding the
start surface.

The taxonomy expanded from "tasks" to include questions and chats
because operators use Edify for both _doing_ and _asking_. Calling
question logs "tasks" would feel wrong; calling them all "history"
is honest.

**Trade-offs / open questions.**

- The drawer and the morning briefing both live to the right of the
  chat. They overlap conceptually but have distinct roles:
  - **Briefing** = curated, time-boxed narrative of "what matters
    right now"
  - **History** = exhaustive, operator-driven audit and replay
  - We keep them distinct; if the briefing ever started showing
    "completed today" lists it would creep into history's territory.
- We auto-pin completed tasks for now. May need to back off if the
  pinned section gets crowded — perhaps auto-pin only when the task
  produced a mutation worth following up on.

**Status.** prototyped
**Last updated.** 2026-05-27

---

## Clicking a history entry replays the conversation

**Decision.** History rows open the saved chat thread in the chat
surface rather than deep-linking to the receipt's canonical page. The
deep-link stays reachable from inside the restored `ReceiptCard`.

**Reasoning.** Operators asking "what did I do?" want to see _the
exchange_, not be teleported to a settings page they then have to
read backwards. Restoring the thread also gives one-click access to
the deep-link, so we lose nothing.

**Implementation note.** Snapshots are baked into each task at
completion / cancellation time. The stored messages carry `cmdState`
and `cmdReceiptData` fields, so restoring is just `setMessages(...)`
— no runtime ref hydration needed. Older tasks without a snapshot
fall back to a synthesised stub built from the task metadata, so
nothing is a dead click.

**Trade-offs / open questions.**

- The restored receipt loses its undo closure (closures don't
  serialise). We hide the Undo chip on restored receipts rather
  than pretending it still works.
- Restored threads are effectively read-only — the wizard's internal
  flow state is gone. Typing in the composer while viewing a
  restored thread will start a fresh task. Worth a visual cue
  ("Viewing past conversation") if testing surfaces confusion.

**Status.** prototyped
**Last updated.** 2026-05-27

---

## Briefing vs history: distinct, not redundant

**Decision.** The morning/afternoon briefing remains a curated
narrative ("here's what matters right now"); the task history drawer
is the audit / replay surface. They share visual neighbourhood (both
live to the right of the chat) but never the same content.

**Reasoning.** A briefing summarising "you did X today" would
duplicate history. A history that opens with "here's what to do
next" would duplicate the briefing. Keeping them in their lanes makes
each one's value obvious.

**Trade-offs / open questions.**

- If automated agents start running tasks on the operator's behalf
  (see _Open questions_), the briefing might be the right place to
  surface them ("Edify ran X for you overnight") with the history
  drawer as the deep-dive. That blurs the line slightly but the
  briefing → history relationship still holds (summary → detail).

**Status.** live
**Last updated.** 2026-05-27

---

## Product wizard (add or replace)

**Decision.** A dedicated multi-step command (`product-swap`) that
lets an operator bring in a new product (from either an existing or
a new supplier) and either **add** it across many recipes or
**replace** an existing product with it, in a single conversational
flow. Surfaced in the `+` popover (chip "Add a product"), the `/`
slash menu (`/add-product`, with `/swap-product` / `/replace-product`
as aliases), and natural language ("add oat milk to all coffees",
"replace whole milk with oat milk across drinks").

**Reasoning.** This is one of the highest-impact, lowest-frequency
workflows we've seen. Two canonical examples:

- **Add** — a coffee shop launching an oat-milk option needs to add
  Oat Milk to every coffee recipe on the menu.
- **Replace** — the same shop changing bean roasters needs to swap
  House Blend (Roaster A) for House Blend (Roaster B) across every
  coffee.

Doing either job without chat is a multi-page, multi-tab slog:
create supplier, create product, then open every affected recipe
one by one. The chat wizard collapses it to "type / paste / tap"
and lets the agent do the matching legwork.

**Why "add or replace" lives in one wizard.** The data captured is
80% identical — new product name, new supplier, pack details, a set
of target recipes. Forking into two separate commands would
duplicate the cards (and the fixes when we change them). Branching
inside a single wizard, with the path made explicit up front, keeps
the surface area small.

**Flow** — up to seven steps; two branch on choice, two are
skippable:

1. **Purpose** — "Adding it to recipes" vs "Replacing another
   product". _Skipped_ when the NL parser can already infer mode
   from the phrasing (e.g. "replace whole milk with oat milk" →
   replace; "add oat milk to all coffees" → add). Asked up front
   when the operator launched from a slash / chip without context.
2. **New product details** — name + supplier (typeahead against
   existing suppliers, with "+ Add as new supplier" for unmatched
   typed names).
3. **New supplier basics** — _only if_ Step 2's supplier was new.
   Email + lead time; everything else defaults. "Skip for now" is
   always available.
4. **Pick the replaced product** — _replace mode only._ Searchable
   catalogue, single pick. Unlocks the agent's matching pass.
5. **Pack details** — pack type, qty, cost, UoM. Pre-filled from
   the replaced product in replace mode; minimal defaults in add
   mode. **Skippable**, and includes a photo-upload affordance.
6. **Pick recipes** — multi-select:
   - _Replace mode_ — list scoped to recipes that use the old
     product, pre-selected, with confidence pills (Linked / Same
     item / Via name).
   - _Add mode_ — list spans every recipe with category filter
     chips. Recipes in categories naturally associated with the new
     product (e.g. milk-like ingredients → Coffee + Tea) are
     pre-selected. The card also collects a per-recipe quantity +
     UoM, since there's no replaced row to inherit one from.
7. **Summary + confirm** — diff card, scope toggle (all sites / one
   site). Replace mode also surfaces a "Treat as the same item"
   checkbox to link both products under one master product; add
   mode hides it (nothing to link against).

**On confirm**, a single transaction:

- _Both modes_ — `upsertSupplier` (if new) → `upsertProduct`
  (defaults inherited from the replaced product in replace mode, or
  safe-empty defaults in add mode).
- _Replace mode_ — `upsertMasterProduct` and link both products (if
  opt-in) → loop `updateRecipe` swapping refs in `ingredientsV2[]`
  and renaming in legacy `ingredients[]`.
- _Add mode_ — loop `updateRecipe` appending a new typed
  `RecipeIngredient` row and a matching legacy row.

An atomic Undo snapshots both stores beforehand and restores them
together if the operator hits Undo on the receipt.

**Trade-offs / open questions.**

- The mode choice is binary, but real workflows are sometimes
  "both" — _add_ the new SKU to every coffee, _and_ replace the old
  SKU in the few recipes that still use it. We don't model that
  yet. Likely answer: run the add flow first (it nets the new SKU
  into the catalogue), then offer a "Also replace anywhere it's
  used?" follow-up on the receipt.
- Add-mode pre-selection uses a keyword heuristic (milk → coffee +
  tea, syrup → coffee + tea, …). Good enough for the prototype but
  brittle. Once we have a real product taxonomy, route this through
  it instead of a regex table.
- The matching pass (replace mode) currently uses three signals
  (product link → master link → name substring). Name-only matches
  are pre-selected but flagged so the operator can review. We may
  want to demote name matches to "suggested, unchecked" once we
  test it with operators — pre-selecting noisy matches risks
  accidental swaps.
- The summary's master-product opt-in is off by default. That's
  the conservative answer ("these are different items"), but it
  means operators switching roasters need to actively tick it. If
  testing shows it's the common case, default it on.
- We currently keep the old product around after a replace — it's
  just no longer referenced. Should we offer to archive it?
  Probably yes, as a follow-up affordance on the receipt, but not
  automatically (operators sometimes keep the old SKU for legacy
  reasons).

**Status.** prototyped
**Last updated.** 2026-05-28

---

## Asking "which job?" up front (the mode-choice pattern)

**Decision.** When a wizard supports materially different jobs (the
product wizard's "add" vs "replace" being the canonical case), ask
the operator which one up front — before collecting any data. We
skip the question when the natural-language phrasing already
disambiguates ("replace whole milk with oat milk" is clearly
replace; "add oat milk to all coffees" is clearly add); otherwise
the first card is the choice.

**Reasoning.** The earlier version of the product wizard always
asked "which existing product is this replacing?" mid-flow. That
worked for replacement but felt wrong for additions — operators
were being asked to name a product they weren't actually replacing.
Front-loading the choice fixes that and has a few side benefits:

- Subsequent cards get to make stronger assumptions (no need to
  defensively check "is this an add or a replace?" in copy or
  defaults).
- The mental model the operator builds matches the data shape:
  "this is an add-flow / replace-flow" maps cleanly onto the
  mutation we'll commit on confirm.
- It surfaces the wizard's two paths visibly — operators can
  discover what the command does without having to run it.

**Generalising the pattern.** Any chat command that has more than
one mode (current candidates: stock count "full count" vs
"variance-only check", menu "84 it" vs "raise price") should
consider the same structure. We're not converting all commands to
this shape yet — for single-job wizards the up-front card is just
ceremony.

**Trade-offs / open questions.**

- One extra tap for users who knew exactly what they wanted but
  didn't phrase it in a way the parser caught. We mitigate by
  inferring mode from common phrasings, but we'll need to monitor
  what slips through.
- The card's tap-targets are big and described with concrete
  examples — important because the choice is the first thing the
  operator sees. Don't be tempted to compress this into a
  segmented control; it makes the decision feel like a UI toggle
  instead of "what job are we doing?".

**Status.** live
**Last updated.** 2026-05-28

---

## Pre-selection vs ask-everything (the "agent picks, you tweak" pattern)

**Decision.** Whenever the wizard can reasonably guess what the
operator wants, default to that guess and let them tweak — instead
of asking. Two examples in the product wizard:

- _Replace mode_ — all matched recipes (rows actually using the old
  product) are pre-selected and labelled with how we matched them,
  rather than rendered as an empty list the operator has to fill in.
- _Add mode_ — recipes in categories naturally associated with the
  new product are pre-selected (e.g. an oat-milk SKU pre-selects
  every Coffee + Tea recipe on the menu). Driven by a keyword →
  category map for now; should move to a real product taxonomy.

**Reasoning.** The operator already gave us the signal we needed
(the product being replaced). Forcing them to redo the work the
system can do is friction without value. Pre-selecting also
reframes the interaction from "do my job for me" to "check my work"
— which is the right mental model for an AI-augmented workflow.

**Trade-offs / open questions.**

- Pre-selection risks silent mistakes. Mitigation: show _why_ each
  row was matched, and use distinct visual treatments for
  high-confidence vs name-only matches.
- We don't yet log "user accepted the agent's pick" vs "user changed
  it" — that signal would be useful for tuning the matching logic
  but isn't tracked.

**Status.** live
**Last updated.** 2026-05-28

---

## Photo capture for data entry

**Decision.** Forms that ask the operator for product-pack data
(pack qty, cost, UoM) include a "Take a photo / Upload image"
affordance. The photo is attached to the product as a reference
image; production will route it through OCR to auto-fill the
fields.

**Reasoning.** The data the operator needs is usually right in
front of them on a phone — a supplier email screenshot, a pack
label, a price list. Asking them to retype it is exactly the kind
of friction that makes operators ignore the catalogue and lets it
rot. Letting them snap a picture means the data lands somewhere
even when they don't have time to transcribe it.

**Trade-offs / open questions.**

- Photo data lives in the message args as a data URL for the
  prototype. Fine for testing, won't scale — production needs a
  proper upload pipeline.
- OCR is not wired up yet. Listed as a "future" in copy so we don't
  over-promise during testing. When we hook it up, the UX should
  shift to "Extracted: 6 per pack · DH 24.50 — edit if I got it
  wrong", framing the system's read as a draft the operator
  confirms.
- Should this affordance exist on every data-capture card, or just
  the product one? My instinct is yes-everywhere (waste counts,
  stock counts, supplier docs) but we'll judge per surface based on
  whether the data is genuinely photographable.

**Status.** prototyped (capture only — OCR pending)
**Last updated.** 2026-05-28

---

## Open questions

These don't have a decision yet. Promote to a full section once we
land on one.

### Agent-run tasks in the history list

Where do automated agent runs ("Edify rebalanced your par levels
overnight") show up? Options on the table:

- A separate `source: agent | user` field on `Task`, with the same
  history surface filtering by it.
- A separate "Agent" filter chip alongside Questions / Commands.
- A dedicated agent feed inside the briefing, with completed agent
  tasks _also_ ending up in history for the audit trail.

The lifecycle is probably also richer: `running`, `needs-review`,
`completed`. Worth sketching the states before committing to a
storage shape.

### Composer behaviour while viewing a restored conversation

Should typing in the composer:

- Append to the restored thread (current behaviour),
- Start a fresh task and drop the restoration,
- Or prompt the operator to choose?

We can probably test both #1 and #2 with users before settling.

### Pin policy

Auto-pinning every completed task fills the Pinned section quickly.
Possible refinements:

- Only auto-pin tasks that produced a mutation (excluding questions /
  chats).
- Auto-pin only for N hours, then demote unless the user pinned it.
- Show pinned + recent as one merged list with a small pin glyph,
  rather than two sections.

### Post-swap "archive the old product?" follow-up

After a product-swap that touches many recipes, the old product is
usually orphaned. Worth offering a one-tap "Archive {oldProduct}"
chip on the receipt — but only when the swap covered the whole
matched set, not a partial subset (operators sometimes keep a
backup SKU around). Open question: where does that chip live in
the receipt card without crowding the existing Undo + Open
affordances?

### Photo capture → OCR auto-fill UX

Once OCR is wired, the cleanest hand-off is probably:

- Snap photo → loading state on the field group ("Reading the
  label…")
- Auto-fill, mark fields as "extracted" with a subtle accent
- Operator edits as normal; an "Got it wrong?" feedback link
  trains the OCR model

Open questions: which fields are confident enough to autofill vs
just suggest; what to do when extraction is partial; whether the
photo should also be searchable later on the product page.

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

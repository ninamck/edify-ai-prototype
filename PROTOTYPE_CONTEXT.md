# Prototype context & handoff notes

_Last updated: 2026-04-18_

Context for future sessions on this prototype. Pair with `AGENTS.md` (which reminds you this is a custom / modified Next.js — check `node_modules/next/dist/docs/` before assuming APIs).

---

## What the prototype is

A mobile-friendly prototype of **Edify's floor-ops + insights experience** for a coffee-shop estate. Scenario is Fitzroy Espresso. All data is fixture-driven, no backend. Aim is to iterate on **how Quinn (the AI assistant) integrates into a real operator's day** — what it surfaces, when, and how actions get logged.

## Core mental model

Three axes combine to drive content across the whole app:

| Axis | Values | Where it lives |
|---|---|---|
| **Role** | `ravi` (Manager), `cheryl` (Admin), `gm` (Employee) | `components/briefing.ts` → `BriefingRole` |
| **Phase** | `morning`, `midday`, `afternoon`, `evening` | `components/briefing.ts` → `BriefingPhase` |
| **Shell view** | `command-centre`, `dashboard` | `components/ShellTopBar.tsx` → `ShellViewMode` |

Role + Phase together select what Quinn shows (briefing items, close nudges, dashboard numbers). Phase also drives the dashboard's "sales so far", bar chart fill, delivery statuses, weather actuals.

**Source of truth for phase lives in `HomeShell`** and flows down. There's a hidden clock-icon switcher in the top bar ([PhaseSwitcher.tsx](components/PhaseSwitcher.tsx)) that lets you override phase for demos (Auto / Morning / Midday / Afternoon / Evening). Dashed teal border = override active.

## Where things live

### Shell + navigation
- [app/page.tsx](app/page.tsx) → `HomeShell`
- [components/HomeShell.tsx](components/HomeShell.tsx) — holds `phaseOverride` + `shellView` + `briefingRole` state; renders MobileShell below 430px
- [components/ShellTopBar.tsx](components/ShellTopBar.tsx) — site switcher, shell view pills (Command centre / Dashboard), role pills, PhaseSwitcher clock icon
- [components/MobileShell/MobileShell.tsx](components/MobileShell/MobileShell.tsx) — mobile-specific shell
- [components/MobileShell/MobileBottomNav.tsx](components/MobileShell/MobileBottomNav.tsx) — bottom tab bar (Receive / Checklists / Tasks / Log waste / Quinn)

### Command centre
- [components/FloorActionsBox.tsx](components/FloorActionsBox.tsx) — "On the floor" strip. `handleActionClick` has route switch for built-ins (checklists, receive-delivery, **log-waste**). Custom/unwired actions fall through — see focus area 1.
- [components/Feed/Feed.tsx](components/Feed/Feed.tsx) — the Quinn chat entry point
- [components/Feed/MorningBriefingTimeline.tsx](components/Feed/MorningBriefingTimeline.tsx) — right-hand briefing panel wrapper. Date + phase-aware title + body.
- [components/Feed/MorningBriefingBody.tsx](components/Feed/MorningBriefingBody.tsx) — the big file. Contains all three role fixtures as `Record<BriefingPhase, InsightGroup[]>`, plus the renderer (`InsightFeed`, `InsightGroup`, `InsightCard`, `PinnedSection`). **Any content change for briefing copy lives here.**

### Dashboard
- [components/Dashboard/ManagerDashboard.tsx](components/Dashboard/ManagerDashboard.tsx) — phase-aware. Accepts `phase: BriefingPhase`, memoizes data via helpers.
- [components/Dashboard/EstateDashboard.tsx](components/Dashboard/EstateDashboard.tsx) — mostly 7d/MTD metrics; phase only tweaks the subtitle + labour-chart label.
- [components/Dashboard/data/managerMockData.ts](components/Dashboard/data/managerMockData.ts) — `HOURLY_TRADING`, `WEATHER_HOURLY`, `DELIVERIES_TODAY`, `WASTE_TODAY`, `WTD_SPEND` + phase helpers (`currentHourIndexForPhase`, `hourlyTradingForPhase`, `weatherHourlyForPhase`, `deliveriesForPhase`, `wasteForPhase`). Full-day actuals for hours 12pm-9pm are in `FULL_DAY_ACTUALS` / `FULL_DAY_WEATHER_ACTUALS` — they're revealed progressively as phase advances.
- [components/Dashboard/parts/*](components/Dashboard/parts) — chart components (`HourlyCombo`, `WeatherStrip`, `WasteCard`, `DeliveriesCard`, `ShiftKpiRow`). Pure data-in, no phase awareness inside — swap the data upstream.

### Waste log (latest addition)
- [app/log-waste/page.tsx](app/log-waste/page.tsx) + [app/log-waste/layout.tsx](app/log-waste/layout.tsx) — route. State is URL-driven: `?itemId=...&qty=N&reason=expired`.
- [components/Waste/wasteData.ts](components/Waste/wasteData.ts) — `WASTE_PRODUCTS` catalog, `PREP_TODAY_BY_PHASE` (for close math), `LOGGED_ENTRIES` (today + 7d history), `WASTE_REASONS`. Helpers: `unaccountedAtPhase`, `likelyToBinAtPhase`, `entriesLoggedToday`, `entriesLast7Days`.
- [components/Waste/WasteLogPicker.tsx](components/Waste/WasteLogPicker.tsx) — tabbed picker: **Log new** / **Today** / **Last 7 days**. Clicking a logged entry re-opens the log card pre-filled.
- [components/Waste/WasteLogCard.tsx](components/Waste/WasteLogCard.tsx) — qty stepper, auto-UoM / pill-UoM, reason pills, Today / Yesterday / Pick-a-date pill (native date input styled as pill).
- [components/Waste/CloseReconciliationCard.tsx](components/Waste/CloseReconciliationCard.tsx) — the "made 12, sold 9 → waste 3?" card at top of evening briefing for Manager + Employee. Deep-links to the log card.

### Entry points for "Log waste"
- Desktop: FloorActionsBox button → `/log-waste`
- Mobile: bottom-nav "Log waste" tab → `/log-waste`
- Close nudge: `[Waste N]` button → `/log-waste?itemId=...&qty=N&reason=expired`
- History tabs: tap an entry → `/log-waste?itemId=...&qty=...&reason=...`

### Other routes
- `/credit-notes` — list + detail slide-in (credit-notes feature). The Quinn banner on the detail panel has navy background — subtext is white there (fixed this session).
- `/receive`, `/checklists/*`, `/order-history`, `/invoices`, `/assisted-ordering` — other floor actions.

---

## Key patterns & conventions

**Phase-keyed fixtures.** When content varies by phase, model it as `Record<BriefingPhase, T>`. Examples: `RAVI_INSIGHTS`, `PREP_TODAY_BY_PHASE`. Not `T[]` with phase as a field.

**Quinn's voice is "drafted → you approve".** Items should lead with what Quinn did, ask for a one-tap decision. Avoid generic reminders.

**Data-grounded nudges > pre-populated lists.** The close reconciliation card fires _only_ where `made - sold > 0`. It doesn't guess; it asks. Any new nudge should have a similar "here's the signal, here's the math" shape.

**URL-driven state on transactional routes** (e.g. `/log-waste?itemId=...`). Makes deep linking from Quinn trivial and keeps React state minimal.

**Pills not dropdowns** for any small fixed set (reasons, UoM when >1, date quick-picks). See `WasteLogCard.Pill`.

**Auto-collapse / summary pattern.** When a section has >3 items and isn't urgent, default it collapsed with a count + one-liner summary. See `InsightGroup`'s `collapsible` + `summary` in MorningBriefingBody.

**Single state source, two views.** If a control affects both Command centre and Dashboard, lift state to `HomeShell` and pass down. Never duplicate demo-only UI across views — put it in the ShellTopBar so it's reachable from everywhere.

**Prototype rules:**
- No persistence — every "save" just navigates + shows a toast.
- No backend / fetch — all data is fixtures.
- No auth.
- `_ = unused var` is fine but Next's strict TS + ESLint will surface anything that breaks builds.

---

## Recent session summary (2026-04-17 / 2026-04-18)

Rough chronology of what shipped:

1. **Unified the Quinn insights panel.** Removed the two tabs (Insights / To Review), collapsed into a single feed with three purpose-based sections: `needs-call` (always open), `handled` (collapsible, green), `worth-knowing` (collapsible, amber). Added per-role seed content including receipts ("Overnight: 11 invoices auto-matched") and loop-narrative items ("Yesterday's warm spell pulled iced-drink cover down 3 days").
2. **Pin an insight.** Pushpin icon top-right of each card. Pinned items float to a teal "Pinned · N" section at the top. State resets on phase change via `key` prop.
3. **Widened the panel** from `clamp(340, 26vw, 420)` to `clamp(380, 30vw, 480)`.
4. **Time-aware briefing label.** Morning / Midday / Afternoon / Evening titles + subtitles. Picks from clock by default.
5. **Hidden demo phase switcher.** Clock icon (originally in briefing header, then moved to ShellTopBar after the Dashboard work). Menu: Auto + 4 phases. Dashed teal border when overridden.
6. **Per-phase briefing content.** Each role × phase combo has its own items (~40 items per role across 4 phases). Same story evolves through the day — e.g. "Bidvest lands 11:10" (morning) → "just landed" (midday) → already done (afternoon/evening).
7. **Phase-aware Dashboard.** `ManagerDashboard` now accepts `phase` prop. Full-day actuals for 12pm-9pm added; `FULL_DAY_ACTUALS` + `FULL_DAY_WEATHER_ACTUALS` reveal as phase advances. Deliveries statuses transition; waste scales morning→evening. Estate dashboard got subtitle tweaks (mostly stays MTD/7d).
8. **Credit notes fix** — white text on navy Quinn banner (was `#6B5E55` which disappeared into the navy).
9. **Log waste flow.**
   - `/log-waste` route with mobile-first design.
   - Picker: Search + mic (placeholder) + "Likely to bin" (Quinn) + All products.
   - Log card: big qty stepper, auto-UoM (pill when multi), reason pills (7), Today / Yesterday / Pick-a-date calendar pill, auto-computed value, Log + Log and add another.
   - Close reconciliation nudge at top of evening briefing: `made 12, sold 9 → [Waste 3] [Not waste]` per item. Uses the app's own prep+sales data.
   - Wired both desktop floor action + mobile bottom nav to route.
10. **Tabs on picker.** Log new / Today (5) / Last 7 days (15). Entries in history tabs re-open the log card pre-filled.

---

## Known loose ends / small annoyances

- **Greeting text on Feed.tsx** uses real clock, not phase override — so "Good evening, Ravi" can show with a "Morning briefing" header. Low priority; demo-aware copy would be a nice tidy-up.
- **Live snapshot bars** in the briefing panel (P&L confidence, labour curve) don't shift with phase — they reflect the fixture as-is. If phase-awareness matters there, extend the same pattern.
- **`MorningBriefingActionsPanel.tsx`** is unused but left in the repo in case the separated "To Review" panel is wanted back. Safe to delete.
- **`CURRENT_HOUR_INDEX`** constant in `managerMockData.ts` is retained for legacy but no longer used by the dashboard — `currentHourIndexForPhase()` is the live path.
- **The waste picker's "Likely to bin"** for morning/midday uses a slow-sell heuristic that shows items >40% under their expected sell-through. The label reads a bit strong for morning ("10 short" when it's really just pacing behind). Consider phase-aware labelling (e.g. "tracking slow" pre-noon, "short" after).
- **Web Speech** — the mic button is a pure visual placeholder with a tooltip. Voice logging isn't wired.

---

## Next session — focus areas

The user's shortlist, ordered as given. Notes on each to prime the next session.

### 1. Link the action buttons
The "On the floor" strip ([FloorActionsBox.tsx](components/FloorActionsBox.tsx)) has 5 default actions plus any the user adds via `EditFloorActionsPopup`. Only three currently route: `checklists`, `receive-delivery`, `log-waste`. Unwired:
- `review-orders` — probably → `/order-history` or a new orders inbox
- `transfer-stock` — needs a new route (see also focus 7 — CPU/production is adjacent)
- Any custom actions the user creates from `EditFloorActionsPopup`

Think about: does every custom action need a route, or can some be Quinn shortcuts (open chat pre-filled)? Consistent back behavior (all go to `/` on close, like log-waste does) will feel right.

### 2. Selecting multiple items to log waste at once
**Open design question.** Worth discussing before building. Two candidate flows:

- **Multi-select on picker**: tick several products, then cycle through the log card for each. Pro: one trip. Con: still many taps total; adds complexity to the picker.
- **Quick-qty list view**: a compact "one row per product, qty input inline" screen — like a grocery shop. Very fast for a sweep but reason gets diluted (would probably default reason per sweep, e.g. "Beyond expiry").
- **Sweep template**: pre-built templates ("End-of-day pastry sweep") that drop into the quick-qty list already populated. Closest to the Close Reconciliation nudge we already have.

Consider: **is the current single-item flow actually a problem?** The close reconciliation nudge already handles the multi-item case well (tap-through). Voice would collapse it further ("log 3 blueberry muffins, 1 croissant, 2 baguettes, all expired"). So maybe the answer is: don't build multi-select; invest in voice.

Worth sketching both and deciding.

### 3. Editing tasks at the top
"Tasks at the top" = the `needs-call` items in the briefing panel. Today they're fixture-rendered with Approve/Dismiss actions only. Editing could mean:
- **Reorder** — drag to change priority
- **Snooze** — push an item until later in the day / tomorrow
- **Add note / reassign** — e.g. "Priya handle this"
- **Mark as done manually** (separate from the Approve action)

Check how this interacts with the Pinned section — pinning is a user override already; maybe snooze should round-trip through pinning too (snoozed = hidden but persisted).

Affected files: [MorningBriefingBody.tsx](components/Feed/MorningBriefingBody.tsx) `InsightCard` (add action affordances), `InsightFeed` (manage snooze/reorder state).

### 4. Recurring orders thinking / logic / week planning
The current fixtures reference recurring orders ("Bidfood basket", "Fresh Direct 11am") but there's no UI model for the **pattern**. Next session ideas:
- **Week-view calendar** — show the next 7-14 days of orders, recurring ones shaded differently, cut-off times marked
- **Pattern editor** — "Bidfood every Mon/Thu by 2pm". Edit frequency, skip-next, change quantities on an instance without breaking the pattern
- **Quinn role** — "You usually order 4 cases of milk on Monday; current stock trend suggests 5 this week"

Affected/new files: probably a new `/orders` or `/schedule` route. Existing `/assisted-ordering` might be the seed — worth reviewing what's there first.

### 5. Making the dashboard more editable
Both parts:
- **Rearrangeable widgets** — drag-to-reorder the KPI row + chart cards. Per-user layouts.
- **Creating new graphs in-view** — right now `AnalyticsCharts.tsx` has 6 fixed chart types. Think about the flow:
  1. Click "Add chart"
  2. Pick a metric (sales, labour, waste, COGS…) — source picker
  3. Pick time window (today / 7d / MTD / custom)
  4. Pick viz type (bar / line / donut / KPI)
  5. Name it, save to dashboard
  
Tradeoff: full builder is a big scope. Alternative is a **curated "add" menu** — pre-built chart templates the user can drop in, not a free-form builder. Probably the right call for the prototype.

Existing pinning (chat → dashboard) at [HomeShell.tsx:166-168](components/HomeShell.tsx) (`pinnedCharts` state) is a related primitive — pinning from analytics chat is already a way to add charts. Maybe extend that rather than build a separate flow.

### 6. Count stock flow
Shape is similar to Log waste: pick products, enter counts. Key differences:
- **Expected count** — Quinn pre-fills par level or projected from yesterday's close + today's deliveries − today's sales
- **Variance flag** — if actual ≠ expected by >tolerance, surface it (Quinn-drafted query to supplier, or waste-entry prompt)
- **Stock take flows** — full vs partial counts, by section (drinks / pastry / lunch)
- **Role** — usually opener or closer, so morning + evening phases matter most

Reuse: `WasteLogPicker`'s tabbed + searchable catalog, pill-select, qty stepper. The `WASTE_PRODUCTS` shape could generalize to "tracked products".

Possible route: `/stock-count`. Entry point: could be a new floor action or a Quinn-triggered flow.

### 7. Production (new world) / CPU
CPU = Central Production Unit. The screenshot the user shared earlier from the live Edify platform showed `(CPU) Blueberry Pecan Donut (Br)` as a product — CPU prefix signalled production-origin. Concepts to model:
- **CPU produces, sites receive.** Production schedule at the CPU; transfers to sites.
- **Site view** — "today's inbound from CPU: 24 donuts, 12 pastries, ETA 09:00"
- **Quinn role** — forecast demand per site → suggest CPU production volumes → auto-build transfer manifests
- **Reconciliation** — what CPU sent vs what site received (transfer GRN, same shape as supplier GRN today)

Big area. Worth a dedicated exploration pass before building — start by mapping the **real** flow the user's existing platform has, then decide what's worth prototyping here vs what's settled.

---

## Quick-start for next session

1. Dev server: `npm run dev` in `edify-ai-prototype` (port 3001 if autoPort or 3000 if free). Preview launch config is at [.claude/launch.json](.claude/launch.json) if using the Claude Preview MCP.
2. To demo different phases: click the clock icon in the top bar (top-right, faint unless overridden).
3. To test mobile: resize the preview to 430px or below.
4. To check the close nudge: switch phase to Evening, Manager role, Command centre view — red card at top of right panel.
5. To hit the log card directly: `/log-waste?itemId=muffin-blueberry&qty=3&reason=expired`.

When iterating on briefing content, the single file to know is [MorningBriefingBody.tsx](components/Feed/MorningBriefingBody.tsx) — long but well-structured.

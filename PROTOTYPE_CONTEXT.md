# Prototype context & handoff notes

_Last updated: 2026-04-22_

Context for future sessions on this prototype. Pair with `AGENTS.md` (which reminds you this is a custom / modified Next.js — check `node_modules/next/dist/docs/` before assuming APIs).

---

## What the prototype is

A mobile-friendly prototype of **Edify's floor-ops + insights experience** for a coffee-shop estate. Scenario is Fitzroy Espresso. All data is fixture-driven, no backend. Aim is to iterate on **how Quinn (the AI assistant) integrates into a real operator's day** — what it surfaces, when, and how actions get logged.

## Core mental model

Three axes combine to drive content across the whole app:

| Axis | Values | Where it lives |
|---|---|---|
| **Role** | `ed` (Manager), `cheryl` (Admin), `gm` (Employee) | `components/briefing.ts` → `BriefingRole` |
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

### Invoice matching + adjacencies (large area, built out across 2026-04-19 → 2026-04-21)
The invoices area has grown into its own mini-app. Five top-level routes, all under `/invoices/*` or `/purchase-orders/*`, sharing the same sidebar + header shell. **Currency throughout is GBP (£).** VAT, not Tax.

- [app/invoices/page.tsx](app/invoices/page.tsx) → `InvoiceList`
- [app/invoices/match/page.tsx](app/invoices/match/page.tsx) → `InvoiceMatchView` (three-way match)
- [app/invoices/approved/page.tsx](app/invoices/approved/page.tsx) → `ApprovedState` (post-approval confirmation)
- [app/invoices/pass-through/page.tsx](app/invoices/pass-through/page.tsx) → `PassThroughDetailView` (rent/utilities/insurance — skips matching)
- [app/invoices/settings/page.tsx](app/invoices/settings/page.tsx) → `RulesView` (Invoicing rules — demo-grade)
- [app/purchase-orders/[id]/page.tsx](app/purchase-orders/[id]/page.tsx) → `PODetailView` (PO-centric view with running total)

**Invoice list ([components/Invoicing/InvoiceList.tsx](components/Invoicing/InvoiceList.tsx))** — lots lives here:
- Tabs: All / Review / Split billing (conditional) / Approved / Pass-through
- Per-row checkbox for bulk sync; header select-all is **indeterminate** when some-but-not-all syncable rows selected
- Non-syncable rows (Variance, Parse Failed, Duplicate, Matching in Progress) show a disabled checkbox with a per-status tooltip (e.g. *"Unresolved variance — resolve before syncing"*)
- `Sync all approved (N)` toolbar button (right-aligned in search row) — auto-hides when no ready invoices
- `⚙ Rules` link sits inline with the "Invoices" h1 header, right-aligned
- Sticky action bar appears when ≥1 row selected: `N selected · £X · M blocked in this view [Clear] [Sync now →]`
- Mock sync flow: 900ms inline spinner per row → flips Matched→Approved, ✓ replaces checkbox, "Synced to Xero" caption under pill; top-centre toast; audit entry via `recordSync()` (console-visible)
- Split-billing `SPLIT` chip next to invoice # on rows where `isSplitBillingInvoice(inv)` — detects invoices that share a PO with another non-duplicate invoice
- Credit-notes column shows a small chip (`CN-007 · Received`) **only on Matched/Approved rows**; hover tooltip lists each CN with ref / status / amount
- Pass-through tab renders a different table (columns: Invoice # · Supplier · Date · Due · Total · VAT · Category · Status) with a helper strip explaining the bucket
- `[components/Invoicing/syncLog.ts](components/Invoicing/syncLog.ts)` — in-memory `recordSync()` log (future: surface in an admin view)

**Three-way match view ([components/Invoicing/InvoiceMatchView.tsx](components/Invoicing/InvoiceMatchView.tsx))** — the big one (~1600 lines). Banner stack above the three-way table, in this order:
- **PO context strip** (`POContextStrip`) — when this invoice is one of several against a PO: `🧾 PO-2907 · invoice 2 of 2`, running-total bar, prior/later invoices, state-aware copy: *"Approving closes PO-2907 — fully invoiced"* / *"stays open: £X remaining"* / *"Over-invoices PO by £X — resolve before approving"*. Click-through `View PO →` to the PO detail page.
- **Auto-accepted banner** (`AutoAppliedBanner`) — green sparkle: *"✨ N variances auto-accepted by rules"* with per-variance reason + `See rules →`. Driven by `AUTO_APPLIED_VARIANCES` registry in [components/InvoicingRules/mockData.ts](components/InvoicingRules/mockData.ts).
- **AI consistency-suggestion banner** (`AISuggestionBanner`) — gradient hero: *"✨ We've spotted a pattern — Milk 2L from Bidfood has invoiced at £4.30 for 5 consecutive weeks"*. Hardcoded to `inv-1`; dismissible. Buttons: Update catalogue / Keep prompting / Create a rule…
- **Awaiting delivery** (`AwaitingDeliveryBanner`) — when no GRN linked: blocks approval, Park-until-delivery action
- **Duplicate invoice** (`DuplicateInvoiceBanner`) — when `status === 'Duplicate'`: blocks approval, *"Not a duplicate · re-open PO"* override
- **SuggestGRN banner** — the original "link missing GRN" nudge (pre-existing)

Inside the table:
- Three-way columns: Invoice (qty, price, total, VAT %, VAT £) / GRN (ordered, received, price, total, VAT £) / PO (ordered, **Prev. inv**, PO price, total). The `Prev. inv` column is new — shows qty already billed against this PO line by earlier invoices; tooltip lists the contributing invoices
- Variance types: `'price' | 'qty' | 'over-invoice'`. Each has its own colour chip + resolution options:
  - Price: Accept & Update Cost / Accept for this delivery / Dispute → Credit Note
  - Qty: Credit Note / Accept Short (Back-order removed)
  - Over-invoice: Request credit note (only — Amend PO removed; supervisor flow out of scope)
- `✨ auto` chip replaces the VarBadge on any variance whose id is in `AUTO_APPLIED_VARIANCES` — those are counted as resolved, don't block approval, and are omitted from the "N of M variances resolved" count (shown as `(N auto ✨)` suffix instead)
- No `View GRN` button — was removed; GRN context lives in the PO context strip / PO detail page instead

**PO detail view ([components/PurchaseOrders/PODetailView.tsx](components/PurchaseOrders/PODetailView.tsx))**:
- Header with PO status pill: `Not Invoiced` / `Partially Invoiced` / `Fully Invoiced` / `Over-invoiced` (derived from coverage math)
- **Running-total card**: big `£X of £Y`, progress bar (green at 100%, red overflow at >100%, accent otherwise), `N of M lines complete · K pending`
- **Invoices on this PO** list with inline coverage breakdown per row ("Covers: Milk 30/30 · Cream 10/10 · Butter 12/12")
- **Line coverage table**: Ordered / Invoiced / Remaining / Invoice(s) link chips / Complete/Partial/Pending/Over status
- All coverage math is in `getPOCoverage(poNumber)` in [components/Invoicing/mockData.ts](components/Invoicing/mockData.ts)

**Pass-through ([components/PassThrough/](components/PassThrough))**:
- [components/PassThrough/mockData.ts](components/PassThrough/mockData.ts) — types, 3 sample invoices (Brighton Energy · Utilities; Landmark Estate · Rent; Hiscox · Insurance), `XERO_ACCOUNT_MAP` per category
- [components/PassThrough/PassThroughDetailView.tsx](components/PassThrough/PassThroughDetailView.tsx) — two-column layout: PDF placeholder on left, editable details + category pills + Send-to-Xero action + activity timeline on right
- Categories: Rent / Utilities / Insurance / Accountant / Marketing / Other (Other prompts for Xero account)
- Activity timeline shows ingest events (`auto-routed`, `fields-reviewed`, `category-set`, `sent`, etc.) with colored dots

**Invoicing rules ([components/InvoicingRules/](components/InvoicingRules))** — demo-grade, not prod:
- 4 rule types: `price-variance` / `qty-variance` / `discount-handling` / `vat-override`
- 3 scopes: `global` / `supplier` / `invoice` — precedence: invoice > supplier > global
- Pre-loaded rules in `INITIAL_RULES` (Global 5%, Bidfood 10%, Fresh Direct 3%, Hiscox 0% VAT override, etc.)
- Inline edit popover per row; scope picker dynamically shows supplier dropdown (from `KNOWN_SUPPLIERS`) or invoice # input
- Rules persist in component state only — lost on reload. Add/save is append-to-array; no backend.
- `AUTO_APPLIED_VARIANCES` is a hardcoded `{ varianceId → { ruleId, note } }` map — no real rule engine; the match view just looks up the id and renders the sparkle chip
- `AI_SUGGESTIONS` is hardcoded to `inv-1` to demonstrate the concept

**Credit notes**:
- [components/CreditNotes/mockData.ts](components/CreditNotes/mockData.ts) — existed already; added `CN-012` linked to `INV-4432` so a Matched invoice demonstrates the chip
- New helper: `getCreditNotesForInvoice(invoiceNumber)`
- Statuses on CNs: `Requested` / `Chasing` / `Overdue` / `Received` / `Applied`

**VAT defaults** (in [components/Invoicing/mockData.ts](components/Invoicing/mockData.ts)):
- `categorizeSku(sku)` returns `'food' | 'alcohol' | 'non-food' | 'unknown'` via SKU prefix lookup
- `defaultVatRate(category)` returns 0 (food, zero-rated), 20 (alcohol / non-food), or `null` (unknown → prompt user)
- SKU prefix sets are hardcoded (`FOOD_SKU_PREFIXES`, `NON_FOOD_SKU_PREFIXES`, `ALCOHOL_SKU_PREFIXES`) — if you add a new SKU, put it in the right set or it'll prompt for VAT
- `TaxSelect` (still named `TaxSelect` internally but user-facing copy is VAT) shows an amber "Set VAT…" state when category is unknown

### Other routes
- `/credit-notes` — list + detail slide-in (credit-notes feature). The Quinn banner on the detail panel has navy background — subtext is white there (fixed in earlier session).
- `/receive`, `/checklists/*`, `/order-history`, `/assisted-ordering` — other floor actions.

---

## Key patterns & conventions

**Phase-keyed fixtures.** When content varies by phase, model it as `Record<BriefingPhase, T>`. Examples: `ED_INSIGHTS`, `PREP_TODAY_BY_PHASE`. Not `T[]` with phase as a field.

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

## Recent session summary (2026-04-22)

Iteration on the invoice match view. Most design work was tone-and-clarity, plus one structural fix (status consistency). Chronology:

1. **Multi-invoice → 1 PO visual stacking.** When a split-billing invoice has siblings, the three-way table now stacks each invoice as its own section below the primary. Section header is two-column (Invoice | GRN) with the column divider running through it — same visual pattern as multi-GRN. Primary gets a `THIS INVOICE` pill.
2. **Sibling rows are editable** (not read-only). VAT dropdowns wire through shared `lineTaxRates`. Right panel header lists all GRNs involved across primary + siblings (`GRN-1248 + GRN-1249`).
3. **Bulk approve siblings** from the match view. When a sibling is clean-matched, the Approve button reads *"Approve 2 invoices & Sync"* and the confirmation page lists both invoices with combined total.
4. **Context chip bar (`MatchContextBar`)** replaces the stacked banners (auto-applied, AI suggestion, auto-link GRN, unmatched) with an accordion — one chip expands at a time. Chips start collapsed on load.
5. **Sticky header.** Invoice # + status pill + "Three-way match · N of M resolved" + Approve button stays pinned to the top of the scroll container.
6. **Auto-link suggested GRN** on mount. Previously required a manual Link click. Now banner says *"Auto-linked GRN-XXXX — we think this belongs here…"*, neutral styling (no heavy green). Unlinking adds the GRN to a dismissed set and the chip switches to *"Try GRN-YYYY instead"* pointing at the next same-supplier candidate.
7. **✨ auto chip** (inline on auto-resolved variance rows) is now neutral, with a custom hover tooltip showing the rule + detail (*"AUTO-ACCEPTED BY RULE — Free range eggs +£0.50/unit — under Bidfood 10% rule."*).
8. **Standalone "All items matched" banner removed.** Summary moved inside the expanded Auto-linked chip as a compact muted line, so it only shows when the user opens the chip.
9. **Auto status note** at the top of the match view, above the Comment section. Rule-set in `getAutoStatusNote(invoice)`:
   - Parse Failed / Duplicate → error
   - Matching in Progress → "Awaiting delivery…"
   - Variance → sub-categorised (over-invoice / qty short / price) with specific copy
   - Matched → "All items matched and ready for approval."
   - Approved → "Approved and synced to Xero."
   - Has `✨ AUTO` label; tooltip shows the rule reason.
10. **Comment section** (formerly "Note") is now explicitly for colleague-to-colleague context. 💬 icon, label `Comment for colleagues`, editable freeform. Mock data: status-style notes on inv-1 and inv-9 rewritten as colleague comments.
11. **Invoice list: PO column.** Between Total and GRN. Split-billing POs get a distinct coloured chip with inline `· SPLIT` label. Rows sharing a split PO get a matching coloured left-border stripe so sibling invoices group visually. Palette is deterministic — first split PO is teal, second blue, third amber, fourth purple.
12. **Layout**: both invoice list and match view bumped to `maxWidth: 1500px`. Invoice #, Date, Total cells `whiteSpace: nowrap` so rows stay one-line.
13. **Dropped**: `Prev. inv` column (the stacked siblings make it redundant).
14. **Status consistency fix** (truth-table audit). `invoice.status` is the single source of truth. Removed the list's local `effectiveStatus` override. Bulk-sync on the list and Approve in the match view both mutate `MOCK_INVOICES[x].status = 'Approved'` (and bulk siblings) before any routing, so list and detail can't disagree. New shared helper `getInvoiceStatusBadgeVariant(status)` used by both surfaces so colour tokens can't drift.

**Demo-grade caveat**: status mutation is in-memory only (mock data array). Hard page reloads reset to the seed statuses. Fine for prototype.

---

## Recent session summary (2026-04-19 → 2026-04-21)

Heavy work on the **invoice matching area** — what was one list + one match view has grown into: bulk-sync, PO detail, pass-through bucket, invoicing rules, VAT defaults, credit-note linkage. Rough chronology:

1. **Currency normalized to GBP (£).** All `$` in invoice views replaced with `£`. Both currency literals (`$${x}` template strings, `${x}` JSX text) and header labels (`Tax $` → `VAT £`).
2. **Split invoice → one PO flow.** We had 1-invoice→many-POs; added the inverse:
   - New mock data: `PO-2907` Bidfood with `GRN-1248` + `GRN-1249` (two partial deliveries), covered by `INV-4432` + `INV-4433`. Both Matched.
   - Also `PO-2910` + `INV-4440` / `INV-4441` for the over-invoice case (6 sacks flour billed vs 5 ordered).
   - New PO detail route `/purchase-orders/[id]` with running-total card, invoice list, per-line coverage table.
   - `POContextStrip` banner on match view, state-aware approval copy ("closes PO / stays open / over-invoices by £X"), `Prev. inv` column in PO tab.
3. **Over-invoice variance type.** Third kind alongside `price` and `qty`. Red styling, single resolution option (`Request credit note`). The `Amend PO` option was designed but cut per user feedback — supervisor flow is out of scope for this view.
4. **Queue chip + Split billing tab.** `SPLIT` chip on rows; new filter tab. `isSplitBillingInvoice()` excludes Duplicate/Parse-Failed so those don't pollute the bucket.
5. **Edge-case banners** for the split flow:
   - `AwaitingDeliveryBanner` (ahead-of-delivery, no GRN yet): blocks approval, Park-until-delivery button. Added `INV-4460` / `PO-2915` mock to demo.
   - `DuplicateInvoiceBanner` (status === Duplicate): blocks approval, requires "Not a duplicate · re-open PO" override.
6. **VAT rename + defaults.** "Tax" → "VAT" across the match view. Default VAT by SKU category (food 0%, alcohol/non-food 20%, unknown prompts with amber "Set VAT…"). Added Dishwasher tablets `DWT-100` to PO-2901/GRN-1244/INV-4421 to demonstrate a non-food line sitting next to food.
7. **Credit notes surfaced on invoice list.** New `Credit notes` column; chip (`CN-XXX · Received`) renders **only on Matched/Approved** rows. Added `CN-012` linked to `INV-4432` in mock data so both an Approved and a Matched invoice show a chip. Chip excludes the amount (hover tooltip carries the detail).
8. **Pass-through invoices.** New `/invoices/pass-through?id=...` route for rent / utilities / insurance bills that have no PO and no Edify supplier. New `components/PassThrough/` module with 3 sample invoices. Category pills map to Xero accounts; `Send to Xero` is a mock action with a confirmation modal; activity timeline logs every event.
9. **Bulk sync with selection.** Per-row checkboxes (disabled on non-syncable with tooltips), header select-all (indeterminate state), sticky action bar, `Sync all approved (N)` toolbar button. Mock sync animation: 900ms spinner → flip Matched→Approved with "Synced to Xero" caption → toast. `syncLog.ts` records batches in memory.
10. **Back-order resolution removed** from qty variance flow. `View GRN` button removed from the match view (PO detail is the canonical place).
11. **Invoicing rules settings screen** — demo-grade settings at `/invoices/settings`. Four sections (Price, Qty, Discount, VAT override) with scope picker, inline edit, ON/OFF toggles, pre-loaded mock rules. Not a real rule engine: `AUTO_APPLIED_VARIANCES` is a hardcoded id → reason map that the match view reads to render `✨ auto` chips. `AI_SUGGESTIONS` hardcoded to `inv-1` for the consistency-pattern banner.
12. **Header tidy.** `⚙ Rules` moved from search-row toolbar up inline with the "Invoices" h1 header (right-aligned). `Sync all approved` now right-aligned in the search row (previously mid-row).

**Design-first cadence.** Most of these landed as a short design doc first → user confirmed ("yes") → build. The doc shape — user flow / key views / microcopy / edge cases — worked well for getting alignment on scope cuts (e.g. the Amend PO cut, Pass-through's skipped edge cases).

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

- **Greeting text on Feed.tsx** uses real clock, not phase override — so "Good evening, Ed" can show with a "Morning briefing" header. Low priority; demo-aware copy would be a nice tidy-up.
- **Live snapshot bars** in the briefing panel (P&L confidence, labour curve) don't shift with phase — they reflect the fixture as-is. If phase-awareness matters there, extend the same pattern.
- **`MorningBriefingActionsPanel.tsx`** is unused but left in the repo in case the separated "To Review" panel is wanted back. Safe to delete.
- **`CURRENT_HOUR_INDEX`** constant in `managerMockData.ts` is retained for legacy but no longer used by the dashboard — `currentHourIndexForPhase()` is the live path.
- **The waste picker's "Likely to bin"** for morning/midday uses a slow-sell heuristic that shows items >40% under their expected sell-through. The label reads a bit strong for morning ("10 short" when it's really just pacing behind). Consider phase-aware labelling (e.g. "tracking slow" pre-noon, "short" after).
- **Web Speech** — the mic button is a pure visual placeholder with a tooltip. Voice logging isn't wired.
- **Invoicing rules don't persist.** Component state only — adding/editing/deleting a rule is lost on reload. Fine for the demo; real persistence would need a backend or localStorage.
- **No real rule engine.** `AUTO_APPLIED_VARIANCES` is a hardcoded id → reason map. If you add new mock invoices/variances and want the sparkle chip to show, add the variance id to that map manually.
- **`AI_SUGGESTIONS` is hardcoded to `inv-1`.** If the demo flow changes and `inv-1` is no longer the first invoice a user clicks, swap the hardcoded `invoiceId` in `components/InvoicingRules/mockData.ts`.
- **`TaxSelect` is still named Tax internally** even though all user-facing copy says VAT. Low-priority rename if someone wants to fully align.
- **Bulk sync is session-local.** `locallySynced` state in `InvoiceList` means a page refresh resets which invoices are "synced". `syncLog.ts` entries also don't persist.
- **Pass-through PDF preview is a placeholder box.** Real PDF rendering isn't wired — the left pane just says "PDF preview placeholder".
- **SKU categorizer is prefix-based.** `categorizeSku()` uses hardcoded prefix arrays. Unknown SKUs fall through to the "Set VAT…" prompt — fine for now, but if the catalogue grows this will need a proper per-SKU category field.
- **"View GRN" button was removed** from the match view. Accessing the GRN now goes through the PO detail page's GRN references. If finance needs direct GRN access from the invoice view, add it back.
- **Status mutation is in-memory only.** `bulk-sync` in the list and `Approve` in the match view both write back to `MOCK_INVOICES[x].status`. This persists through SPA navigation within a session, but a hard reload reverts to the seed statuses. Fine for the prototype — no backend to write through.
- **`invoice.note` now means "colleague comment" only.** Status sentences are auto-generated by `getAutoStatusNote`. If you add a new invoice to the mock, don't write status prose into `note` — it'll appear twice (once auto, once human). Write colleague-context only.
- **Auto-link on mount** seeds `linkedGRNs` with `suggestedGRN.grnNumber`. If a new invoice has a `suggestedGRN` that shouldn't auto-link, leave `suggestedGRN` undefined in the mock.
- **Match view's sibling rows reuse the same `lineTaxRates` map** as primary, keyed by line id. Line ids need to stay unique across all invoices in the mock — they already are.

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
6. Invoice-matching demo paths:
   - `/invoices` — list with tabs, bulk sync, credit-note chips
   - `/invoices/match?id=inv-1` — rich match view with AI suggestion banner + auto-accepted banner + dishwasher-tablets (non-food VAT 20%)
   - `/invoices/match?id=inv-6` (or `inv-7`) — split-billing siblings against PO-2907, PO context strip
   - `/invoices/match?id=inv-9` — over-invoice variance (6 of 5 flour), red banner, Request-credit-note resolution
   - `/invoices/match?id=inv-10` — awaiting-delivery edge case (no GRN)
   - `/invoices/match?id=inv-5` — duplicate-invoice edge case
   - `/invoices/pass-through?id=pt-1` — utilities pass-through, ready to send
   - `/invoices/pass-through?id=pt-3` — awaiting review, no category yet
   - `/purchase-orders/po-5` — PO-2907 coverage view (2 invoices, fully invoiced)
   - `/invoices/settings` — invoicing rules (demo-grade settings)
   - From list: tick invoices with the checkbox column and `Sync now` — watch statuses flip to Approved; reopen one to see the detail view agrees.

When iterating on briefing content, the single file to know is [MorningBriefingBody.tsx](components/Feed/MorningBriefingBody.tsx) — long but well-structured.
When iterating on the invoice match view, [components/Invoicing/InvoiceMatchView.tsx](components/Invoicing/InvoiceMatchView.tsx) is the equivalent — ~1600 lines, well-structured with `/* ──────────── Banner Name ──────────── */` dividers between subcomponents.

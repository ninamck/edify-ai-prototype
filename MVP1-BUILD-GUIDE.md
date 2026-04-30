# MVP 1 — Insights Home Build Guide

> A handoff PRD for a developer building the Edify "Insights Home" (a.k.a. MVP 1) end-to-end. Scoped for use with **Claude Code in a terminal** — broken into phase-sized prompts you can paste one at a time so nothing slips through the cracks.

---

## How to use this document

1. Read **§1 Overview** and **§2 Architecture & conventions** end-to-end before opening Claude Code.
2. For each phase in **§5 Build phases**, paste the whole `Prompt for Claude` block into your terminal session, then iterate on the result before moving to the next phase.
3. After each phase, run `npm run dev` and visit `/insights` (or whatever your route is) to verify the **Acceptance criteria** pass.
4. Use **§6 Functionality checklist** as the final pre-handoff sign-off.
5. **§7 Component reference** is your cheat-sheet for naming and responsibilities — keep it consistent or future you will hate present you.

When Claude Code starts veering off the spec, paste the relevant phase section back in and ask it to "diff your changes against this spec and fix any deviations".

---

## 1. Overview

**What we're building:** a single workspace screen, `Insights Home`, that lives at one route (e.g. `/insights`). It is the operator's daily landing pad — answers to "how are we doing?" without leaving the page.

**Three concentric layers stacked on the same page:**

1. **Greeting + Ask Quinn bar.** Time- and role-aware "Good morning, X". A conversation entry-point bar (Quinn = the AI assistant) with three pre-baked suggestion pills and a primary "Ask Quinn" CTA.
2. **Tab strip.** First tab is the role-specific **Dashboard** (a curated grid of charts/KPIs). Subsequent tabs are user-built **Views** that mix tables and pinned charts. There is one default seeded View ("Reports" with the flash-report table). Users add more, rename via double-click, remove via hover-X.
3. **Content area.** Either renders the dashboard grid (with edit mode for drag/reorder/show-hide/half-or-full-width) or a vertically stacked list of table cards + chart cards belonging to the active View.

**Quinn integration (the headline feature):**

- Anywhere the user might want a new chart or table, an `Add insight` button opens **Quinn as a right-anchored side-sheet**.
- The side-sheet has two modes: **Browse** (a curated question library, filterable by topic + by chart-vs-table) and **Chat** (Quinn replies, can preview a chart or a draft table, user pins it to dashboard / current view / new view).
- The side-sheet keeps the underlying page visible — never a full-screen modal.

**Persistence:** localStorage only for the prototype. Layout (per role) and tabs (with their tables and pinned charts) persist between reloads. Real DB persistence is a follow-up.

**Out of scope for MVP 1:** writing/editing data, mobile (a stub MobileShell is fine but not the focus), real-time updates, multi-user collaboration on layouts, the floor-actions / briefing surfaces (those live in the older "Command centre" view).

---

## 2. Architecture & conventions

### 2.1 Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) | Use the version your repo is pinned to. App Router required for the `app/insights/page.tsx` pattern. |
| Language | TypeScript, **strict mode on** | All component props typed, no `any` unless commented why. |
| Styling | Inline styles + CSS variables for tokens | The prototype intentionally avoids Tailwind classnames in component files because operators copy-paste design snippets between agents — keep token names visible. Tailwind for utility classes is fine if your repo already uses it. |
| Charts | `recharts` | All chart components are Recharts. |
| Tables | `@tanstack/react-table` | Sorting, filtering, pagination, column visibility. |
| Icons | `lucide-react` | Stick to lucide so icon weights and stroke widths stay consistent. |
| Animation | `framer-motion` | Used only for the side-sheet slide-in and a couple of fades. Keep it light. |
| Drag-and-drop | Roll your own with refs + bounding rects | No `react-dnd` or `dnd-kit` dependency — the dashboard grid only needs swap-on-drop. See §5 Phase 5 implementation note. |

### 2.2 Design tokens

Define these as CSS variables in `app/globals.css` (or equivalent) and use them everywhere. **Do not hardcode hex colours in components.**

```css
:root {
  --color-accent-active: #224444;   /* primary buttons, selected pills */
  --color-accent-deep:   #1a3636;   /* Quinn surfaces, hover on primary */
  --color-accent-mid:    #2c5454;   /* mid-accent for chart series */

  --color-bg-surface:    #FFFFFF;   /* page background */
  --color-bg-canvas:     #FAF9F7;   /* warm off-white for content areas */
  --color-bg-hover:      #F5F4F2;   /* row hover, section headers */
  --color-bg-nav:        #F2EFEB;   /* sidebar */

  --color-border-subtle: #E5E1DC;

  --color-text-primary:   #3A3028;
  --color-text-secondary: #6B5E55;
  --color-text-muted:     #8B7E73;

  --color-success: #15803D;
  --color-warning: #92400E;
  --color-error:   #B91C1C;

  --radius-nav:   16px;
  --radius-card:  10px;
  --radius-item:  9px;
  --radius-badge: 8px;

  --font-primary: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

**Typography (Plus Jakarta Sans):**
- Page titles / hero greeting: 28–30px / weight 600 / letter-spacing -0.01em
- H2 / tab content titles: 18px / weight 700
- Card labels: 13px / weight 700
- Body / secondary: 12–13px / weight 500
- Pills / chips / metadata: 11–12px / weight 600
- Section headers (uppercase): 10px / weight 700 / letter-spacing 0.06em

**The palette is warm (warm whites + warm browns), never grey.** This is the single biggest "feel" difference from a generic dashboard.

**Tap targets:** nothing critical smaller than 28×28 (icon buttons) or 32px tall (pills). Buttons get 8–12px horizontal padding minimum.

### 2.3 File structure (target)

```
app/
  insights/
    page.tsx                       # thin Server Component, wraps client shell in <Suspense>
  globals.css                      # design tokens

components/
  Insights/
    InsightsShell.tsx              # the orchestrator (client component)
    InsightsTopBar.tsx             # site switcher + role pills + phase override
    AskQuinnBar.tsx                # greeting-row CTA bar
    DateRangePicker.tsx            # pill dropdown
    Tabs/
      InsightsTabs.tsx             # tab strip + add menu
    Views/
      ViewTab.tsx                  # renders a "View" tab's tables + charts
      DataTable.tsx                # generic Tanstack-table renderer
      TableCard.tsx                # one table card (header + DataTable)
      ChartCard.tsx                # one pinned-chart card
      EmptyState.tsx               # 3-choice card grid
  Dashboard/
    Dashboard.tsx                  # role-aware dashboard wrapper
    ManagerDashboard.tsx
    EstateDashboard.tsx
    layoutTypes.ts                 # entry shape + helpers
    DashboardWidget.tsx            # wraps a widget in edit chrome
    DashboardEditToolbar.tsx       # Add insight + Done editing toggle
    parts/
      KpiCard.tsx
      ShiftKpiRow.tsx
      HourlyCombo.tsx
      WeatherStrip.tsx
      WasteCard.tsx
      DeliveriesCard.tsx
      SalesTrendChart.tsx
      ... (one file per chart type, see §7)
    QuinnInsightButton.tsx         # popover with "why this matters" reasoning
  Quinn/
    AddInsightPopup.tsx            # the side-sheet
    QuestionLibraryPicker.tsx      # browse mode
    ChatPanel.tsx                  # chat mode (Quinn dialogue + preview)
  Analytics/
    AnalyticsCharts.tsx            # ANALYTICS_CONFIG + renderAnalyticsChart()

data/
  sources/                         # one file per data source
    types.ts
    flashReport.ts
    sales.ts
    labour.ts
    waste.ts
    index.ts
  query.ts                         # the in-browser query engine
  questionLibrary.ts               # curated questions metadata
  rolesAndPhases.ts                # type literals + helpers

hooks/
  useInsightsTabs.ts               # tab CRUD + localStorage persistence
  useDashboardLayout.ts            # layout per role + persistence + pinned-chart helpers
  useConversationHistory.ts        # recent Quinn conversations
  useMediaQuery.ts
```

If your existing app uses different conventions, adapt the names — but keep the **boundaries**: orchestrator → tabs → content → side-sheet → data layer.

### 2.4 Roles, phases, and the demo controls

We ship a single page that adapts to **role** + **phase**. These are demo concepts: in production they'd come from auth + a real clock.

- `Role`: `'manager' | 'admin' | 'employee' | 'multi-site-owner'`. Each role has its own default dashboard layout. Manager and Employee share the manager layout; Admin gets the estate layout.
- `Phase`: `'morning' | 'midday' | 'afternoon' | 'evening'`. Drives some dashboard data (e.g. "sales so far") and the greeting copy.

For the prototype, both are user-controlled via top-bar pills/clock-icon. In production, hide these controls behind a feature flag.

### 2.5 Data model — keep it abstract

The query engine and table cards are decoupled from how data actually loads. **Each `DataSource` is just an async loader returning typed rows + a column descriptor.** This means swapping fixtures for `fetch('/api/...')` later is a one-file change per source.

```ts
// data/sources/types.ts
export type ColumnType = 'string' | 'number' | 'currency' | 'percent' | 'date' | 'integer';

export type Column = {
  key: string;
  header: string;
  type: ColumnType;
  defaultVisible?: boolean;
  width?: number;
};

export type DataSourceId = 'flashReport' | 'sales' | 'waste' | 'labour';
// ↑ Add to this union as you add sources. Keep the names stable; everything keys off them.

export type DataSource<Row extends Record<string, unknown> = Record<string, unknown>> = {
  id: DataSourceId;
  label: string;
  description?: string;
  load: () => Promise<Row[]>;
  columns: Column[];
  /** Suggested join keys when this source is mixed with others. */
  joinKey?: { site?: string; date?: string };
};
```

For MVP 1 you need four sources:

| `id` | What it represents | Canonical key | Granularity |
|---|---|---|---|
| `flashReport` | Weekly per-store performance snapshot | `location` (site) + `week_start_date` | Per site per week |
| `sales` | Daily sales | `site_id` + `date` | Per site per day |
| `labour` | Daily labour hours/cost | `site_id` + `date` | Per site per day |
| `waste` | Per-event waste log | `site_id` + `date` (+ `sku`) | Multiple rows per site per day |

Plug each `load()` into a real endpoint (e.g. `fetch('/api/sales?from=...&to=...')`) returning rows in the typed shape. **The in-browser query engine handles join/filter/agg/sort once the rows are loaded** (acceptable up to ~10k rows; if your prod data is larger, push the query down server-side and skip the engine).

> ⚠️ The Column descriptor is the **single source of truth** for headers, types, formatting and default visibility. The DataTable, query engine, and `formatCell()` all read from it.

### 2.6 Persistence

Everything is localStorage with versioned keys:

- `'edify:insights:tabs:v1'` — `{ tabs, activeId }`
- `'edify:insights:layoutByRole:v1'` — `Record<Role, DashboardLayoutEntry[]>`
- `'edify:insights:conversations:v1'` — `ConversationEntry[]` (capped at ~30)

Always validate the stored shape on read (a permissive type guard) and fall back to defaults on parse fail. Bump the version suffix when you change the schema and add a migration path.

---

## 3. Anatomy of the page

```
┌─────┬──────────────────────────────────────────────────────────────────────┐
│ S   │  Top bar: site switcher · phase override (clock) · demo role pills   │
│  i  ├──────────────────────────────────────────────────────────────────────┤
│  d  │                                                                      │
│  e  │   "Good morning, Ed"   ←  hero greeting                               │
│  b  │                                                                      │
│  a  │   ┌─ Ask Quinn bar ─────────────────────────────────────────────┐    │
│  r  │   │ 💬  Add your next chart   [pill] [pill] [pill]   [Ask Quinn]│    │
│     │   └─────────────────────────────────────────────────────────────┘    │
│  ( i│                                                                      │
│  c  │   [Dashboard] [Reports] [View 2] [+]    ←  tab strip                 │
│  o  │   ─────────────────────────────────────────────────                  │
│  n- │                                                                      │
│  o  │   {Active tab content}                                               │
│  n  │     - Dashboard:  KPI row, then 2-col chart grid (drag/edit)         │
│  l  │     - View tab:   stacked TableCards / ChartCards                    │
│  y) │                                                                      │
│     │                                                                      │
└─────┴──────────────────────────────────────────────────────────────────────┘

  ↘ Add insight button → right-anchored side-sheet (540px)
                          [Browse library] ↔ [Chat with Quinn]
                          Pin to: dashboard | current view | new view
```

Key constraints:
- Page max-width **1400px**, centred. Sidebar is fixed 68px (icon-only rail).
- Content gutter 12px around the inner column.
- Top bar fixed height 52px, sticky to top.
- Side-sheet width `min(540px, 100vw)`, full height, slides in from right with framer-motion (`x: '100%'` → `x: 0`, 260ms cubic-bezier `(0.4, 0, 0.2, 1)`).

---

## 4. Quinn's voice & UX rules

Quinn is the AI assistant. The whole product is built around the assumption that **Quinn drafts, the operator approves**. Some rules to keep her behaviour consistent across surfaces:

1. **One question at a time.** No multi-step forms inside a Quinn message.
2. **Tappable choices over typed answers.** Pills, +/− steppers, and inline buttons before free-text inputs.
3. **Show the math.** When Quinn states a number, she also shows where it came from ("£1,842 — that's 9 sites × £204 avg"). The `reasoning` field on each chart entry is rendered through a popover (`QuinnInsightButton`) and supports markdown bold.
4. **Drafts not finals.** Anything Quinn produces is a draft until pinned. Pinning is the commit. The "session pin" state must persist between Browse and Chat modes within one session.
5. **Cancellable.** The side-sheet is dismissable via Esc or backdrop click. Esc within Chat mode goes back to Browse first; another Esc closes.
6. **Recent conversations persist.** A conversation is saved to history if it included ≥1 user message OR ≥1 pin. Picking from history rehydrates the chart preview/table — does not replay messages.

---

## 5. Build phases

Each phase below is a **discrete prompt** you can paste into Claude Code. Each ends in a state where `npm run dev` should produce a working partial. Stop at every "Acceptance criteria" block and verify.

> 🧠 **Universal reminders to put at the top of every Claude Code prompt** (or pin in your repo's `AGENTS.md`):
> - This is a TypeScript codebase, strict mode is on.
> - Use the design tokens from §2.2 — no hardcoded hex.
> - Inline styles are fine; do not introduce a new styling library.
> - Plus Jakarta Sans is the only font.
> - Lucide is the only icon library.
> - Recharts for charts; Tanstack Table for tables.
> - Don't run extra installs without confirming first.

### Phase 0 — Repo prep

**Goal:** the new code lands in a Next.js (App Router) repo with strict TypeScript, the tokens defined, and `Plus Jakarta Sans` loaded.

**Prompt for Claude:**

> Set up the Insights Home foundation in our existing Next.js repo:
> 1. Add `Plus Jakarta Sans` (weights 400, 500, 600, 700) via `next/font` and apply it as the document body font.
> 2. Add the design tokens from this snippet to `app/globals.css` (CSS variables, `:root` block).
> 3. Install runtime deps if missing: `recharts`, `@tanstack/react-table`, `lucide-react`, `framer-motion`. Do not bump existing pinned versions.
> 4. Create empty stub files for `app/insights/page.tsx`, `components/Insights/InsightsShell.tsx` so the route resolves.
> 5. The `page.tsx` should be a Server Component that wraps `<InsightsShell />` in a `<Suspense fallback={null}>`.
> 6. The `InsightsShell` is `'use client'` and renders just `<div>Insights Home placeholder</div>` for now.
>
> Do not touch any other route. Confirm `npm run build` and `npm run dev` succeed before stopping.

**Acceptance criteria:**
- `/insights` renders the placeholder.
- `getComputedStyle(document.body).fontFamily` includes `Plus Jakarta Sans`.
- Tokens resolve in DevTools (`var(--color-accent-active)` evaluates to `#224444`).

---

### Phase 1 — Top bar + Sidebar shell

**Goal:** the surrounding chrome — sidebar (icon-only rail) + top bar (site name, role pills, phase override, demo controls).

**Prompt for Claude:**

> Build the chrome around `InsightsShell`:
>
> **Sidebar** (`components/Insights/Sidebar.tsx`, but if a sidebar exists in our repo already, integrate with it — ask first):
> - 68px wide, full height, background `var(--color-bg-nav)`.
> - Icon-only NavItems with tooltips on hover (lucide icons): Home, Plan production, Stock & ordering group (5 items: Suggested orders, Count stock, Match invoices, Approvals, Order history), Performance group (View dashboard, View analytics, Compare sites, **Build a table**), Setup group.
> - Group headers are visually hidden in compact mode but used for keyboard nav grouping.
> - Active state: filled accent background, white icon. Hover: `var(--color-bg-hover)`.
> - The "Build a table" item routes to `/insights?build=table` — we'll wire the param in Phase 8.
>
> **Top bar** (`InsightsTopBar.tsx`):
> - 52px tall, white bg, 2px bottom border `var(--color-border-subtle)`, sticky.
> - Left: SiteSwitcher pill (site name + chevron, opens a tiny menu — for now just hardcode one site).
> - Right cluster (in this order, gap 8px):
>   - Phase override pill: clock icon, opens menu with `Auto / Morning / Midday / Afternoon / Evening`. When not "Auto", show a dashed teal border to indicate override.
>   - Demo role pills: `Manager`, `Admin`, `Employee` segmented control.
>
> Both pieces share the same `Role` and `PhaseOverride` types — define them in `data/rolesAndPhases.ts`:
>
> ```ts
> export type Role = 'manager' | 'admin' | 'employee';
> export type Phase = 'morning' | 'midday' | 'afternoon' | 'evening';
> export type PhaseOverride = 'auto' | Phase;
>
> export function phaseFromHour(hour: number): Phase { /* <11 morning, <14 midday, <17 afternoon, else evening */ }
> export function timeAwareGreeting(role: Role): string { /* "Good morning, {name}" — name lookup by role */ }
> ```
>
> Lift `role` and `phaseOverride` state into `InsightsShell` and pass them down.

**Acceptance criteria:**
- Sidebar visible, hover tooltips work, active state correctly highlights.
- Phase override clock opens a menu, switching to "Morning" shows dashed teal border.
- Role pills are a segmented control, clicking one updates state (verify with React DevTools).

---

### Phase 2 — Greeting + Ask Quinn bar

**Goal:** the page heading and the conversational entry-point bar.

**Prompt for Claude:**

> Inside the inner content column of `InsightsShell` (max-width 1400px, centred, padding 12px), render two stacked elements:
>
> **Hero greeting:** an `<h1>` showing `timeAwareGreeting(role)`. Style: 30px, weight 600, letter-spacing -0.01em, color `var(--color-text-primary)`, no margin. Wrap in a div with `paddingTop: 20`, `paddingBottom: 4`.
>
> **AskQuinnBar** (`components/Insights/AskQuinnBar.tsx`):
> - Card with 1px border `var(--color-border-subtle)`, radius 12px, padding `10px 14px`, min-height 64px.
> - Layout (left → right): square 36×36 accent-filled icon tile (lucide `MessageSquare`, 18px, white), then a 2-line label block ("Add your next chart" 13px/700 + "Ask me anything about your data — I'll draw it, then you can pin it here." 12px/muted), then a flex spacer, then 3 suggestion pills, then the primary "Ask Quinn" CTA.
> - Suggestion pills: `'Labour % by hour'`, `'Waste trend last 4 weeks'`, `'Site comparison'`. Each is a 100px-radius pill with sparkle icon, hover changes bg to `var(--color-bg-hover)`.
> - Primary CTA: 100px-radius accent-filled button (sparkle icon + "Ask Quinn"), white text, drop shadow `0 2px 8px rgba(34,68,68,0.25)`.
> - Below 900px viewport, hide the suggestion pills (CSS media query, `display: none !important`).
>
> The `onAsk(seed?: string)` prop is called with the suggestion text (or undefined for the main button). Wire it to a no-op for now — we'll hook it to the side-sheet in Phase 8.

**Acceptance criteria:**
- Greeting changes when role changes (different name) and when phase changes (morning vs evening).
- Pills wrap/hide correctly at narrow widths.
- All pill clicks call `onAsk(text)` (verify by logging).

---

### Phase 3 — Tab strip + persistence

**Goal:** the multi-tab system. First tab is the role's Dashboard (locked, can't remove); second is a default "Reports" View. User can add View tabs from a `+` menu, rename via double-click, remove via hover-X.

**Prompt for Claude:**

> Build the tab strip below the AskQuinnBar.
>
> **Types** in `hooks/useInsightsTabs.ts`:
>
> ```ts
> export type TabKind = 'dashboard' | 'view';
> export type Tab =
>   | { id: 'dashboard'; name: 'Dashboard'; kind: 'dashboard' }
>   | { id: string; name: string; kind: 'view'; tables: TableInstance[]; charts: ChartInstance[] };
> ```
>
> `TableInstance` and `ChartInstance` are imported from `components/Insights/Views/types.ts` (define stubs for now; we'll fill them in Phase 6/9):
>
> ```ts
> export type TableInstance = { id: string; title?: string; query: TableQuery; origin?: TableOrigin };
> export type ChartInstance = { id: string; chartId: AnalyticsChartId; title?: string; origin?: { kind: 'quinn'; prompt: string } };
> ```
>
> **Hook:** `useInsightsTabs()` exposes `{ tabs, activeId, setActiveId, addViewTab, removeTab, renameTab, updateTablesForTab, updateChartsForTab, appendChartToTab }`. It hydrates from localStorage `edify:insights:tabs:v1` on mount, persists on every change. Default state is `[{ id: 'dashboard', ... }, { id: 'flash-report', name: 'Reports', kind: 'view', tables: [{ id: 'flash-report-default', query: fullSourceQuery('flashReport') }], charts: [] }]`. Active default is `'dashboard'`.
>
> **Component:** `Tabs/InsightsTabs.tsx`:
> - Pill-shaped tab bar: outer pill bg `var(--color-bg-hover)`, 1px border, padding 4px, gap 4px.
> - Each tab is a 999-radius button. Active: accent bg, white text, drop shadow. Inactive: transparent, muted text, hover bumps to secondary text colour.
> - On hover of removable tabs, show an X icon (lucide) that calls `removeTab`.
> - Double-click tab name to enter rename mode (inline text input, Enter commits, Esc cancels).
> - Dashboard tab and `'flash-report'` View are non-removable.
> - To the right of the tab pill, a circular `+` button. Clicking opens a small dropdown menu with one option: `View — Combine tables and charts`. Clicking it calls `addViewTab()` and selects the new tab.
> - Auto-generated names: first View tab → "View"; second → "View 2"; etc.
>
> Wire the strip into `InsightsShell` and switch the content area to render either the dashboard or the active view (use stubs for now: `<div>Dashboard goes here</div>` or `<div>View {name} goes here</div>`).

**Acceptance criteria:**
- Reload preserves tabs and active selection.
- Add a tab, rename it, remove it — all flows work and persist.
- Cannot remove Dashboard or Reports.
- Active tab visually distinct, click to switch.

---

### Phase 4 — Dashboard tab (manager role first)

**Goal:** the role-aware dashboard grid. KPI row + a curated set of widgets (charts and special cards). For now we'll only ship the **manager** layout end-to-end — estate/admin slot in via the same scaffold in Phase 4b.

**Prompt for Claude:**

> Build the manager dashboard.
>
> **Types** in `components/Dashboard/layoutTypes.ts`:
>
> ```ts
> export type WidgetWidth = 'full' | 'half';
> export interface DashboardLayoutEntry { id: string; visible: boolean; width?: WidgetWidth; }
> export const PINNED_PREFIX = 'pinned:';
> export function pinnedId(chartId: AnalyticsChartId): string;
> export function pinnedChartIdOf(id: string): AnalyticsChartId | null;
> export function isHalfOnlyChart(chartId: AnalyticsChartId): boolean;
> export function defaultWidthForChart(chartId: AnalyticsChartId): WidgetWidth;
> export function widthOf(entry: DashboardLayoutEntry): WidgetWidth;
> export const MANAGER_DEFAULT_LAYOUT: DashboardLayoutEntry[] = [
>   { id: 'shift-kpi', visible: true, width: 'full' },
>   { id: 'hourly-combo', visible: true, width: 'full' },
>   { id: 'weather', visible: true, width: 'full' },
>   { id: 'checklist-compliance', visible: true, width: 'full' },
>   { id: 'waste', visible: true, width: 'half' },
>   { id: 'deliveries', visible: true, width: 'half' },
> ];
> ```
>
> The `id` is either a built-in widget id (in the layout above) **or** a `pinned:<chartId>` id when a Quinn chart has been pinned to the dashboard.
>
> **Hook:** `useDashboardLayout()` exposes `{ layoutByRole, setLayoutForRole, addPinnedChart, removePinnedChart }`, persists to `edify:insights:layoutByRole:v1`. Defaults: `manager` and `employee` use `MANAGER_DEFAULT_LAYOUT`, `admin` uses `ESTATE_DEFAULT_LAYOUT` (define a stub for now).
>
> **ManagerDashboard** (`components/Dashboard/ManagerDashboard.tsx`):
> - Props: `phase`, `layout`, `editing`, `onLayoutChange`, `onToggleEdit`, `onAddInsight`, `onRemovePinned`, `toolbarLeadingControls?`.
> - Renders a header row with `<h1>Fitzroy Espresso · In shift</h1>` and a tiny dummy-data subtitle. To the right, the `DashboardEditToolbar` (toolbarLeading slot for the date picker we'll add later, plus an Edit / Done toggle and an Add insight CTA).
> - Below the header: a 2-column grid (`gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'`, gap 14px, `gridAutoFlow: 'dense'`).
> - For each visible (or every, when editing) layout entry: render a `DashboardWidget` wrapper that gives the right `gridColumn` span based on `widthOf(entry)` and renders the actual widget content via `renderWidget(id)`.
>
> **Widgets to implement** (under `components/Dashboard/parts/`):
> - `ShiftKpiRow` — 4 KPI tiles in a row: Sales so far / Forecast to now / Expected EOD / Full-day forecast. Each tile has a 36×36 accent icon, a big number (24px/700), label, and a comparison line. Auto-derived from `hourlyTrading` data — see **mock helpers** below.
> - `HourlyCombo` — Recharts `ComposedChart`: bars for actual £ (green if ahead of forecast, amber if behind, grey if not yet), a line for forecast £, and a right-axis line for staff headcount (solid for hours worked, dashed for the rest of the roster).
> - `WeatherStrip` — horizontal hour strip with weather icons + temps for "now" vs "later".
> - `WasteCard` — list of top wasted items today with qty + £.
> - `DeliveriesCard` — list of today's deliveries with status pills (Pending / Arrived / Reconciled) and a WTD spend tile at top.
> - `ChecklistComplianceCard` — donut/% summary of opening/closing checklist completion.
>
> **Mock data** to drive the widgets, in `data/managerMockData.ts`:
> - `HOURLY_TRADING: Array<{ hour: string; forecast: number; actual: number | null; staff: number; staffPlanned: number }>` — covers 6am to 9pm. `actual` is `null` for hours after the current phase, populated for past hours.
> - `WEATHER_HOURLY`, `DELIVERIES_TODAY`, `WASTE_TODAY`, `WTD_SPEND`.
> - Phase helpers: `currentHourIndexForPhase(phase)`, `hourlyTradingForPhase(phase)` (zeroes-out actuals after the phase boundary), `weatherHourlyForPhase`, `deliveriesForPhase`, `wasteForPhase`.
> - For now, hardcode plausible numbers for one site (Fitzroy). When wiring to the real DB later, replace each helper with an async loader.
>
> **DashboardWidget wrapper** (`DashboardWidget.tsx`): in normal mode, just renders the child. In edit mode, overlays a small toolbar with: drag handle (cursor: grab), eye / eye-off (toggle visible), expand-collapse arrows (toggle full/half — disabled if `isHalfOnlyChart(pinned)`), trash (only for pinned charts → calls `onRemovePinned(chartId)` then `onRemove`).
>
> **DashboardEditToolbar** (`DashboardEditToolbar.tsx`):
> - `[date picker slot]` ➜ `[Edit / Done]` ➜ `[Add insight]` (sparkle icon, accent button).

**Acceptance criteria:**
- Dashboard tab shows a 2-column grid with the 6 default widgets.
- KPI row reflects whatever phase is selected (more "actual" filled as phase advances).
- Widgets are pure data-in — same component handles any phase.

---

### Phase 4b — Estate (admin) dashboard variant

**Goal:** the admin role's multi-site dashboard.

**Prompt for Claude:**

> Build `EstateDashboard.tsx` analogous to `ManagerDashboard`. It uses a different layout default:
>
> ```ts
> export const ESTATE_DEFAULT_LAYOUT: DashboardLayoutEntry[] = [
>   { id: 'date-filter', visible: true, width: 'full' },
>   { id: 'kpi-grid', visible: true, width: 'full' },
>   { id: 'sales-trend', visible: true, width: 'full' },
>   { id: 'checklist-compliance', visible: true, width: 'full' },
>   { id: 'site-gp', visible: true, width: 'half' },
>   { id: 'wastage', visible: true, width: 'half' },
>   { id: 'cogs-variance', visible: true, width: 'half' },
>   { id: 'labour-vs-sales', visible: true, width: 'half' },
> ];
> ```
>
> Widgets to add (in `parts/`):
> - `KpiCard` — generic KPI tile, used in a `kpi-grid` of 4–6 tiles (Net sales, Gross profit, COGS %, Labour %, Waste %, OOS events).
> - `SalesTrendChart` — daily £k area/line over a date range.
> - `SiteGpChart` — horizontal bars, GP% per site.
> - `WastageChart` — vertical bars, £ by category.
> - `CogsVarianceChart` — diverging bars, % over/under recipe cost.
> - `LabourVsSalesChart` — grouped bars, labour % vs sales £ per site.
>
> Estate also has a built-in `date-filter` widget at the top: From / To date inputs + Reset button. Wire it to filter `SALES_TREND` for the sales-trend widget.
>
> Wrap both manager and estate dashboards in a `Dashboard` orchestrator that picks based on `role`.

**Acceptance criteria:**
- Switching role pill from Manager to Admin swaps the dashboard.
- Date filter on estate dashboard updates the trend chart.

---

### Phase 5 — Edit mode (drag, show/hide, full/half)

**Goal:** make the dashboard rearrangeable.

**Prompt for Claude:**

> Make the dashboard editable.
>
> Add `editing` state to `InsightsShell` (`useState`), pass to `Dashboard` and `DashboardEditToolbar`.
>
> **Edit toolbar behaviour:**
> - `[Edit dashboard]` button toggles state. When editing, it becomes `[Done editing]` with green background.
> - `[Add insight]` always visible.
>
> **DashboardWidget edit chrome:**
> - When editing, add an outer dashed border, a small drag handle in the top-left, and a row of icon buttons in the top-right: `Eye / EyeOff` (toggleVisible), `Maximize2 / Minimize2` (toggleWidth — disabled if `isHalfOnlyChart`), `Trash2` (only for pinned).
> - When a widget is `visible: false`, render it at 40% opacity and disable interactions, but still show it in edit mode so users can re-enable.
>
> **Drag-and-drop (custom, no library):**
> - On `pointerdown` on the drag handle, capture pointer + start tracking pointer position.
> - On `pointermove`, do nothing visual yet (or optionally translate the dragged widget by the delta — keep it simple).
> - On `pointerup`, walk a `Map<id, HTMLElement>` of widget refs, find which one's bounding rect contains the drop point. If found and not the source, swap positions in the layout array.
> - Use `useRef<Map<string, HTMLElement>>` for the refs.
> - Show a "Drop here" outline on the hover-target during the drag.
>
> The drag implementation is intentionally simple — swap-on-drop, not full reorder-by-insertion. That's fine for this spec.

**Acceptance criteria:**
- Edit mode toggles the chrome correctly.
- Hide a widget → reload → still hidden.
- Resize a widget half↔full → grid spans correctly.
- Drag a widget onto another → positions swap. Reload → swap persists.

---

### Phase 6 — View tabs: DataTable + Tables tab content

**Goal:** when the user is on a non-dashboard tab, render the tables and charts that belong to that View.

**Prompt for Claude:**

> Implement the View tab content.
>
> **Generic DataTable** (`components/Insights/Views/DataTable.tsx`):
> - Tanstack `useReactTable` with `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`, `getPaginationRowModel`.
> - Toolbar above the table: search input (icon + `<input>`), columns visibility menu (`Columns3` icon), filter menu (`Filter` icon), an optional `rightSlot` for caller-supplied chips, and a `header` slot (rendered above the toolbar — used for the table title).
> - Sorting indicators in column headers (arrow up/down/up-down).
> - Per-column type-aware filters: string → contains, number → range (min/max), date → range (from/to).
> - Pagination footer with prev/next chevrons + page indicator + page-size dropdown (10/25/50/100).
> - Loading state: skeleton rows. Error state: red-toned alert.
> - Cells formatted via `formatCell(value, column.type)` from §2.5.
>
> **TableCard** (`Views/TableCard.tsx`):
> - Wraps `DataTable` with a header row showing: editable title (double-click to rename, fallback "Sales 2"), a small origin label (`· From: <library question>` or `· Asked Quinn: <prompt>`), a pencil "Edit query" icon button (opens Quinn chat seeded with the table — Phase 9), and a trash icon (when removable).
> - Runs `runQuery(instance.query)` (Phase 7) on mount to load rows + columns. Shows DataTable's loading state while pending.
>
> **ChartCard** (`Views/ChartCard.tsx`):
> - Card wrapper with header (title + origin label + remove) and body that renders the chart via `renderAnalyticsChart(chartId)`. We'll build the analytics charts in Phase 8.
>
> **ViewTab** (`Views/ViewTab.tsx`):
> - Props: `tables`, `charts`, `onChange` (table list), `onChartsChange`, plus action callbacks (`onAskQuinn`, `onBrowseLibrary`, `onOpenBuilder`, `onEditQuery`).
> - When both tables and charts are empty, render an `EmptyState` with three choice cards:
>   - "Ask Quinn" — sparkle icon — "Describe the table you want in your own words." → calls `onAskQuinn`.
>   - "Pick a question" — list-checks icon — "Start from a curated table-shaped question." → calls `onBrowseLibrary`.
>   - "Build from scratch" — database icon — "Quinn opens with a starter table you can refine in chat." → calls `onOpenBuilder`.
>   - Plus a dashed "Or just add a blank table" button below.
> - When non-empty, render the cards in order (tables first, then charts), then a footer row of small `[+ Add table]`, `[Pick a question]`, `[Ask Quinn]` chip buttons.
>
> **Page layout** for an active View tab in `InsightsShell`:
> - H2 with the tab name, on a row with `DashboardEditToolbar` (`editing` is local to tables view; we won't actually use editing mode for tables in MVP 1, but include the toolbar for consistency — it's the entry point for the date picker + Add insight).
> - Below: `<ViewTab .../>`.

**Acceptance criteria:**
- The default "Reports" tab renders an empty `TableCard` shell with title "Flash report" — table loads when Phase 7 lands.
- Add a new View tab → empty state with 3 choice cards renders.

---

### Phase 7 — Data sources + query engine

**Goal:** the loaders for `flashReport`, `sales`, `labour`, `waste`, plus the in-browser query engine that powers every TableCard.

**Prompt for Claude:**

> Build the data layer.
>
> **`data/sources/types.ts`:**
> - `ColumnType`, `Column`, `DataSourceId`, `DataSource` (see §2.5).
> - `formatCell(value, type)`: handles all six types. Currency uses GBP (£) with 2dp. Percent uses 2dp + `%`. Integer uses commas. Date passes through as-is. Null/empty returns `"—"`.
> - `toNumber(s: string | undefined): number | null` helper.
>
> **`data/sources/flashReport.ts`** — wire to your real endpoint:
>
> ```ts
> export type FlashReportRow = {
>   location: string;
>   name: string;
>   dm: string;
>   year: number | null;
>   week_number: number | null;
>   week_start_date: string;
>   week_end_date: string;
>   dd_sales: number | null; dd_ly_pct: number | null;
>   br_sales: number | null; br_ly_pct: number | null;
>   total_sales: number | null; total_sales_ly: number | null; total_sales_ly_pct: number | null;
>   food_supply_cost: number | null; food_supply_cost_sales_pct: number | null;
>   labor_hours: number | null; labor_earnings: number | null; labor_sales_pct: number | null;
>   total_royalty: number | null; royalty_sales_pct: number | null;
>   customer_count: number | null; customer_count_ly_pct: number | null;
>   average_ticket: number | null; average_ticket_ly_pct: number | null;
>   store_margin: number | null; store_margin_sales_pct: number | null;
> };
> // FLASH_REPORT_COLUMNS: Column[] — see prototype's column list, all 27 columns with types
> // loadFlashReport() should fetch from `/api/flash-report` (or your endpoint), cache the promise
> ```
>
> Default visible columns: `name`, `dm`, `week_start_date`, `total_sales`, `food_supply_cost_sales_pct`, `labor_sales_pct`, `customer_count`, `average_ticket`, `store_margin`, `store_margin_sales_pct`.
>
> **`data/sources/sales.ts`** — daily site-level sales:
>
> ```ts
> export type SalesRow = {
>   site_id: string; site_name: string; region: string;
>   date: string;
>   revenue: number; covers: number; avg_ticket: number;
>   breakfast_revenue: number; lunch_revenue: number; dinner_revenue: number;
> };
> // joinKey: { site: 'site_id', date: 'date' }
> ```
>
> **`data/sources/labour.ts`** — daily site-level labour:
>
> ```ts
> export type LabourRow = {
>   site_id: string; site_name: string; date: string;
>   hours: number; cost: number; shifts: number;
>   manager_hours: number; barista_hours: number; kitchen_hours: number;
> };
> ```
>
> **`data/sources/waste.ts`** — per-event waste:
>
> ```ts
> export type WasteRow = {
>   site_id: string; site_name: string; date: string;
>   sku: string; category: string;
>   qty: number; unit_cost: number; cost: number; reason: string;
> };
> ```
>
> Each `loadXxx()` calls a real backend endpoint and returns typed rows. **Cache the promise per source** (don't refetch on every TableCard mount).
>
> **`data/sources/index.ts`:**
>
> ```ts
> export const DATA_SOURCES: Record<DataSourceId, DataSource> = {
>   flashReport: flashReportSource,
>   sales: salesSource,
>   waste: wasteSource,
>   labour: labourSource,
> };
> export const ALL_SOURCE_IDS: DataSourceId[] = ['flashReport', 'sales', 'waste', 'labour'];
> ```
>
> **Query engine** in `data/query.ts`:
>
> ```ts
> export type AggKind = 'sum' | 'avg' | 'count' | 'min' | 'max';
> export type FieldRef = { source?: DataSourceId; key: string };
> export type FilterOp = 'equals' | 'not_equals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in';
> export type Filter = { field: FieldRef; op: FilterOp; value: unknown };
> export type FieldColumnSpec = { kind: 'field'; field: FieldRef; header?: string; type?: ColumnType; width?: number };
> export type AggColumnSpec = { kind: 'agg'; agg: AggKind; field: FieldRef; header: string; type?: ColumnType; width?: number };
> export type ColumnSpec = FieldColumnSpec | AggColumnSpec;
> export type JoinSpec = { rightSource: DataSourceId; on: Array<{ leftKey: string; rightKey: string }> };
> export type SortSpec = { key: string; dir: 'asc' | 'desc' };
> export type TableQuery = {
>   sources: DataSourceId[];
>   prefilter?: Partial<Record<DataSourceId, Filter[]>>;
>   joins?: JoinSpec[];
>   columns?: ColumnSpec[];
>   filters?: Filter[];
>   groupBy?: FieldRef[];
>   sort?: SortSpec[];
>   limit?: number;
> };
> export type RunQueryResult = { columns: Column[]; rows: Record<string, unknown>[] };
>
> export async function runQuery(q: TableQuery): Promise<RunQueryResult>;
> export function fullSourceQuery(id: DataSourceId): TableQuery; // returns { sources: [id] }
> ```
>
> Pipeline inside `runQuery`:
> 1. Load each source (parallelize with `Promise.all`), apply per-source `prefilter`.
> 2. Qualify each row: keep bare keys AND add `<source>.<key>` keys to every row.
> 3. If `joins` is present, do inner joins in the order declared (left = previous accumulator, right = `join.rightSource`). Use a hash map on the composite key.
> 4. Apply post-join `filters`.
> 5. If `groupBy`, group rows by the key tuple, then for each `ColumnSpec`: `field` columns take the first row's value, `agg` columns aggregate per kind.
> 6. Project to the user's requested `columns` (default: all columns of the first source).
> 7. Sort, then limit.
>
> Single-source `fullSourceQuery('sales')` should produce all sales rows + the source's columns. This is the trivial path used for the seeded "Reports" tab.

**Acceptance criteria:**
- Reports tab now shows a fully working flash-report table with sort/filter/pagination.
- Manually constructing a join query (`sources: ['sales','labour'], joins: [{ rightSource: 'labour', on: [{ leftKey: 'site_id', rightKey: 'site_id' }, { leftKey: 'date', rightKey: 'date' }] }]`) returns enriched rows.
- An aggregation query (`groupBy: [{ source: 'sales', key: 'site_name' }], columns: [{ kind: 'agg', agg: 'sum', field: { key: 'revenue' }, header: 'Total revenue', type: 'currency' }]`) collapses correctly.

---

### Phase 8 — Analytics charts library + AddInsightPopup browse mode

**Goal:** the canonical chart catalogue + the side-sheet's question library browser.

**Prompt for Claude:**

> **AnalyticsCharts** (`components/Analytics/AnalyticsCharts.tsx`):
>
> Define `AnalyticsChartId` as a string literal union of every chart we ship. Start with this set (extend later):
>
> ```ts
> export type AnalyticsChartId =
>   | 'sales' | 'hour' | 'trend' | 'growth' | 'labour' | 'cogs'
>   | 'eatin' | 'daypart' | 'lfl'
>   | 'waste-top10' | 'produced-sold' | 'labour-pct'
>   | 'waste-heatmap' | 'oos-pareto' | 'labour-hours'
>   | 'waste-kpi' | 'waste-trend-stacked' | 'prod-avail-scatter'
>   | 'waste-category-treemap' | 'labour-day-radial';
> ```
>
> Hardcode mock data for each chart (rough plausible numbers — real data integration later). For each chart id, export:
> - A render function: `renderAnalyticsChart(id: AnalyticsChartId): ReactNode` (uses Recharts).
> - An entry in `ANALYTICS_CONFIG: Record<AnalyticsChartId, { label: string; chartLabel: string; reasoning: string }>`. `label` is the card title, `chartLabel` is what Quinn says before drawing it ("Here's total sales by site for last week..."), `reasoning` is the markdown-bold explanation popped from the QuinnInsightButton.
>
> Use the prototype's `ANALYTICS_CONFIG` as a starting point — it has good copy for all 20 charts. Charts should be ~220px tall by default.
>
> **Question library** (`data/questionLibrary.ts`):
>
> ```ts
> export type QuestionShape = 'chart' | 'table' | 'both';
> export type QuestionSegment = 'sales' | 'cogs' | 'labour' | 'waste' | 'production';
> export type ProductionSubsegment = 'general' | 'produced-v-sold' | 'availability' | 'closing-range' | 'efficiency';
>
> export interface QuestionEntry {
>   id: string;
>   segment: QuestionSegment;
>   subsegment?: ProductionSubsegment;
>   text: string;
>   suggestedChartId?: AnalyticsChartId;
> }
>
> export const QUESTION_LIBRARY: QuestionEntry[] = [ /* ~80 entries */ ];
> export const SEGMENT_LABELS: Record<QuestionSegment, string> = { /* ... */ };
> export const SEGMENT_ORDER: QuestionSegment[] = [...];
>
> export function searchQuestions(query: string, segment?: QuestionSegment, sub?: ProductionSubsegment, shape?: 'chart' | 'table'): QuestionEntry[];
> export function questionShape(q: QuestionEntry): QuestionShape; // 'chart' if has suggestedChartId, 'table' for site-level breakdowns, 'both' for "show me/list me…" patterns
> export function getQuestionTableQuery(q: QuestionEntry): TableQuery | null; // for table-shaped questions, return a pre-built TableQuery
> export function countsBySegment(): Record<QuestionSegment, number>;
> export function countsByProductionSubsegment(): Record<ProductionSubsegment, number>;
> ```
>
> Seed at least 8 questions per segment. Five tagged as table-shape per segment (return a real `TableQuery`); the rest as chart-shape (with `suggestedChartId`). A handful flagged as `both`.
>
> **AddInsightPopup — Browse mode** (`components/Quinn/AddInsightPopup.tsx`):
>
> - Right-anchored side-sheet (see §3 for dimensions and motion).
> - Backdrop: `rgba(3, 28, 89, 0.08)` (very subtle), no blur.
> - Header (sticky, 14px 18px, bottom border): If in chat mode, show a `< Back` chip first. Otherwise just the panel title and a close X.
> - Body: render `<QuestionLibraryPicker>` (the browse view) when `mode === 'browse'`, else `<ChatPanel>` (Phase 9).
>
> **QuestionLibraryPicker:**
> - Top: a chat input box (large, bordered, with sparkle icon and Send icon). Submitting it transitions to chat mode (Phase 9).
> - Below: shape filter pills (`All / Charts / Tables`).
> - Below: segment tab strip (`All / Sales / COGS / Labour / Waste / Production`). Counts shown in pill format.
> - When `segment === 'production'`, a second row of subsegment pills appears.
> - Below: scrollable list of question chips. Each chip:
>   - Pill row with the question text + a `→` arrow on hover.
>   - If chart-shape, a tiny "chart" icon at the right; if table, "table" icon; if both, both.
>   - If the chart is already pinned in the current view, render greyed out with a "Pinned" tag.
>   - Click → if chart-shape, transition to chat mode seeded with the question text (so Quinn explains and lets the user pin); if table-shape, call `onPickTable(entry, query)` which appends the table to the current View and closes the panel.
>   - If `both`, prompt the user inline: "Which would you like — a chart or a table?" with two buttons.
> - Footer: "Recent" section with a list of past conversations (Phase 12). Click to resume.

**Acceptance criteria:**
- Clicking the Ask Quinn primary button or any suggestion pill opens the side-sheet from the right.
- Browse mode shows the segment + shape filter and updates the list as you change them.
- Clicking a table-shape question adds a TableCard to the active View tab (seeded query) and closes the panel.

---

### Phase 9 — AddInsightPopup chat mode + chart pinning

**Goal:** the conversational half of Quinn — she previews a chart or table and the user decides what to do with it.

**Prompt for Claude:**

> **ChatPanel** (`components/Quinn/ChatPanel.tsx`) — rendered inside `AddInsightPopup` when `mode === 'chat'`:
>
> - Conversation list: alternating Quinn (left, neutral background, sparkle avatar) and User (right, accent bubble).
> - Initial state when entered from a question pick: Quinn says `chartLabel` (or a table-pitch line) and renders the preview inline.
>   - Chart preview: `renderAnalyticsChart(chatChartId)` inside a 220px-tall card.
>   - Table preview: a mini-DataTable showing the first ~10 rows of `runQuery(chatTableQuery)`, with a "Open full table" link.
> - Below the preview, an action row:
>   - **For chart preview:** `[Pin to <target>]` button. If we have multiple pin targets (Phase 10), it's a dropdown. After pinning, swap to `[✓ Pinned]` (disabled) and add an inline "View dashboard" link if pinned to dashboard.
>   - **For table preview:** `[Pin to current view]` (default), `[Open in new view]` (secondary).
> - Sticky chat input at the bottom: textarea-styled input with sparkle icon + Send. Pressing Enter submits.
> - Response simulation: when the user sends a message, append a Quinn reply that acknowledges and either (a) re-renders the same chart with a different parameter, (b) pivots to a different chart, or (c) for the prototype, just appends a canned "Updated — here's the latest cut" with a chart swap.
> - Track `userMessageCount` and `pinnedCount` in local state for the conversation-history rules.
>
> **Pin handlers in InsightsShell:**
>
> Add these to `InsightsShell` and pass to `AddInsightPopup`:
>
> ```ts
> function pinChartToTarget(chartId: AnalyticsChartId, targetId: string) {
>   const target = tabs.find(t => t.id === targetId);
>   if (!target) return;
>   if (target.kind === 'dashboard') {
>     addPinnedChart(role, chartId);
>     return;
>   }
>   if (target.charts.some(c => c.chartId === chartId)) return; // already there
>   appendChartToTab(target.id, { id: genChartId(), chartId });
> }
>
> function pinChartToNewView(chartId: AnalyticsChartId): string {
>   const cfg = ANALYTICS_CONFIG[chartId];
>   const newId = addViewTab({ name: truncate(cfg.label, 24), tables: [] });
>   appendChartToTab(newId, { id: genChartId(), chartId });
>   return newId;
> }
> ```
>
> **Pin-table handler:** `onPinTable({ title, query, prompt })` and `onOpenTableInNewView` — straightforward, see prototype's `Mvp1Shell.tsx` for canonical implementation.
>
> **Auto-chat seed**: when AddInsightPopup is opened with `autoChatTable={ prompt, query, title }`, jump straight to chat mode with that table preloaded as the preview. Used by:
> - The `Build from scratch` empty-state card (seeds with `fullSourceQuery('flashReport')` + prompt `"Help me build a custom table from scratch."`).
> - The TableCard pencil "Edit query" button (seeds with the existing instance's query + prompt `"Help me modify {title}."`, plus a `replacingTableId` so the next pin replaces the original instance instead of appending).

**Acceptance criteria:**
- Clicking a chart-shape question opens chat with the chart preview rendered.
- Clicking pin pins to the current tab; the side-sheet stays open so the user can pin more.
- Esc once: chat → browse. Esc again: closes.
- "Build from scratch" opens chat with a starter table.
- TableCard pencil opens chat with that table pre-loaded.

---

### Phase 10 — Pin-target dropdown (per view)

**Goal:** when there are multiple Views, the chart pin button becomes a dropdown so the user picks which view (and a "+ New view" option).

**Prompt for Claude:**

> Replace the simple `[Pin to <target>]` button in `ChatPanel` with a split button: primary action pins to the **default target** (the active tab), and a chevron opens a dropdown listing all tabs (`pinTargets: { id: string; label: string }[]`) plus a `+ New view` option.
>
> Props on `AddInsightPopup`:
>
> ```ts
> pinTarget: 'dashboard' | 'view';                      // affects post-pin "View dashboard" CTA
> pinTargets?: { id: string; label: string }[];          // populated from tabs in InsightsShell
> defaultPinTargetId?: string;                           // active tab
> onAddChartToTarget?: (chartId, targetId) => void;
> onAddChartToNewView?: (chartId) => string | undefined; // returns new tab id so the dropdown can mark it "Pinned"
> ```
>
> **Already-pinned highlighting in browse mode:** pass an `alreadyPinned: Set<AnalyticsChartId>` derived from the active tab's contents (or the role's dashboard layout if active tab is dashboard). Greys out matching chips with a "Pinned" tag.

**Acceptance criteria:**
- With multiple Views, the pin dropdown lists all of them; selecting one pins there.
- "+ New view" creates a tab and pins; tab activates.

---

### Phase 11 — Date range picker

**Goal:** the global date scope control sitting in the dashboard/view toolbar.

**Prompt for Claude:**

> Build `DateRangePicker.tsx`:
>
> - `value: 'today' | 'week' | 'last_4_weeks' | 'custom'`, `onChange(value)`.
> - Pill button (calendar icon + current label + chevron). Clicking opens a small dropdown menu anchored top-right. Esc + outside-click close it.
> - Options: `Today / This week / Last 4 weeks / Custom…`.
> - Selecting `Custom…` opens a tiny inline From/To date picker (or just toggle to a 2-date input row inside the menu — keep it simple).
>
> Wire `value` into `InsightsShell` state as `dateRange`. Pass it via `toolbarLeadingControls` slot to `DashboardEditToolbar`. **Right now, the picker is purely cosmetic on the dashboard** — the dashboard data is phase-driven not range-driven. Wire it for real on the View tabs (pass into `runQuery` as a prefilter on `date` columns) and the estate `sales-trend` chart.

**Acceptance criteria:**
- Picker renders in both Dashboard and View toolbars.
- Selecting a range updates the `from`/`to` filters used by table queries on the View tab.

---

### Phase 12 — Recent conversations

**Goal:** Quinn remembers what the user asked about across sessions.

**Prompt for Claude:**

> Build `useConversationHistory()`:
>
> ```ts
> export type ConversationEntry = {
>   id: string;
>   timestamp: number;
>   question: string;
>   chartId: AnalyticsChartId | null;
>   tableQuery?: TableQuery;
>   tableTitle?: string;
>   userMessageCount: number;
>   pinnedCount: number;
>   fromLibrary: boolean;
> };
> ```
>
> Store at `edify:insights:conversations:v1`. Cap at 30 entries (drop oldest).
>
> Helpers: `addConversation()`, `removeConversation(id)`, `clearHistory()`, and a pure helper `shouldSaveConversation({ fromLibrary, userMessageCount, pinnedCount })` — returns true if `userMessageCount >= 1 || pinnedCount >= 1`. Library-question-only opens (zero messages, zero pins) are not saved.
>
> Wire into `AddInsightPopup`:
> - On exit (close or back-to-browse), commit the current chat to history if eligible.
> - Render the recent list at the bottom of the QuestionLibraryPicker (footer section, "Recent" header, list of pills). Click to resume — rehydrates chart/table preview but doesn't replay messages.

**Acceptance criteria:**
- Open a question, send a message, close panel → reopen → that conversation appears under "Recent".
- Clicking a recent re-enters chat mode with the right preview.
- Open a library question and immediately close (no messages, no pins) → not saved.

---

### Phase 13 — Build-a-table deep link

**Goal:** the sidebar's "Build a table" entry routes to the Insights page and opens the side-sheet pre-filtered to tables, pointed at the appropriate View.

**Prompt for Claude:**

> Wire the deep-link.
>
> When `useSearchParams()` includes `build=table` on the Insights page mount:
> 1. Find the first `kind: 'view'` tab. If none, call `addViewTab()`.
> 2. Activate that tab.
> 3. Open `AddInsightPopup` with `defaultShape='table'`, targeting that tab id.
> 4. `router.replace('/insights')` to clear the param so a refresh doesn't re-trigger.
> Use a `useRef<boolean>` flag to ensure this only runs once per mount.

**Acceptance criteria:**
- Clicking sidebar "Build a table" from any other route lands on `/insights` with the side-sheet already open in browse mode, shape filter set to "Tables".
- Refreshing the page does not re-trigger.

---

### Phase 14 — Polish & smoke test

**Prompt for Claude:**

> Final pass. Verify each item; fix anything that fails.
>
> 1. **Loading + empty + error states** for every async surface (TableCard, dashboard widgets fed by async loaders, ChatPanel previews).
> 2. **Keyboard:** all interactive elements reachable via Tab; Enter activates buttons; Esc closes the side-sheet (chat → browse → close).
> 3. **Focus visible** rings on tab/pill/button focus states (CSS `:focus-visible`).
> 4. **localStorage migration:** if the schema changes mid-development, bump version suffix and write a migration in the hook's `loadStored()`.
> 5. **Mobile breakpoint:** below 500px, render a stub `<MobileShell />` (a placeholder with a friendly "Insights is desktop-only for now" message; we'll do mobile properly later).
> 6. **Test the demo path:** open `/insights`, switch role pill `Manager → Admin → Manager`, switch phase `Auto → Morning → Evening`, confirm dashboard data shifts. Add a View tab, drop a chart from Quinn into it, drop a table, rename, remove — all persists.
>
> Run `npm run lint` and `npm run build`. Both should pass.

**Acceptance criteria:**
- Lint + build pass.
- All checklist items in §6 are green.

---

## 6. Functionality checklist (final sign-off)

Tick every box before declaring MVP 1 done.

### Shell & navigation
- [ ] `/insights` route renders the full shell (sidebar + top bar + content).
- [ ] Sidebar is icon-only, 68px wide, hover tooltips.
- [ ] Top bar shows site switcher (left), phase override (right cluster), demo role pills (right cluster).
- [ ] Phase override clock icon menu: Auto / Morning / Midday / Afternoon / Evening. Dashed teal border when overridden.
- [ ] Role pills swap dashboard between Manager and Admin (Estate) layouts.
- [ ] Below 500px viewport, a stub MobileShell renders.

### Greeting + Ask Quinn bar
- [ ] Hero greeting `"Good {time-of-day}, {name}"` driven by phase and role.
- [ ] AskQuinnBar: 36px accent icon tile, label, three suggestion pills, primary "Ask Quinn" CTA.
- [ ] Suggestion pills hide below 900px.
- [ ] Clicking the CTA or any pill opens the AddInsightPopup.

### Tabs
- [ ] First tab = Dashboard (locked, can't remove).
- [ ] Second tab = "Reports" View (locked, can't remove) with the seeded flash-report table.
- [ ] `+` menu adds a new View tab; auto-named "View", "View 2", …
- [ ] Double-click a custom tab to rename; Enter commits, Esc cancels.
- [ ] Hover a custom tab to reveal X; click to remove.
- [ ] Tabs persist across reloads (localStorage `edify:insights:tabs:v1`).
- [ ] Active tab is visually distinct (accent bg, white text, drop shadow).

### Dashboard tab — Manager
- [ ] Header row with site name, phase-aware subtitle, and edit toolbar.
- [ ] Edit toolbar: date range picker pill + Edit/Done toggle + Add insight CTA.
- [ ] 2-column grid with default widgets: ShiftKpiRow, HourlyCombo, WeatherStrip, ChecklistComplianceCard, WasteCard, DeliveriesCard.
- [ ] Each widget renders correctly with mock data; updates as phase changes.
- [ ] Pinned charts appear with the `📌 ` prefix and a Quinn reasoning popover.

### Dashboard tab — Estate (Admin)
- [ ] Layout: date filter row, KPI grid, sales trend, checklist compliance, site GP, wastage, COGS variance, labour vs sales.
- [ ] Date filter actually filters the trend chart.

### Dashboard edit mode
- [ ] Edit toggle reveals chrome on every widget (drag handle, eye, resize, trash).
- [ ] Visibility toggle hides/shows the widget (40% opacity in edit mode when hidden).
- [ ] Width toggle swaps between half (1 column) and full (2 columns); disabled for half-only charts.
- [ ] Drag a widget onto another → positions swap. Persists across reloads.
- [ ] Trash icon only on pinned charts; removing also deletes from the role's pin list.

### View tabs
- [ ] Empty state shows three choice cards: Ask Quinn / Pick a question / Build from scratch + dashed "blank table" fallback.
- [ ] Each choice routes to the right side-sheet mode/state.
- [ ] Footer chip row: `+ Add table`, `Pick a question`, `Ask Quinn`.
- [ ] TableCards render with title (double-click to rename), origin label, edit-query pencil, remove icon, and a fully working DataTable.
- [ ] ChartCards render with title, origin label, remove icon, and a Recharts chart.
- [ ] Tables persist across reloads (per tab).

### DataTable
- [ ] Search box filters all string columns.
- [ ] Per-column sort (click header, three-state).
- [ ] Per-column filters (string contains, number range, date range).
- [ ] Column visibility toggle.
- [ ] Pagination footer with page-size dropdown.
- [ ] Loading skeletons + error state.
- [ ] All cell values formatted via `formatCell()` — currency in £, percent with %, dates as-is.

### Data sources & query engine
- [ ] All four sources (`flashReport`, `sales`, `labour`, `waste`) load from real endpoints.
- [ ] `loadXxx()` caches its promise (no re-fetch on remount).
- [ ] `runQuery()` supports prefilter + inner joins + post-join filters + groupBy/agg + sort + limit.
- [ ] `fullSourceQuery(id)` returns the trivial single-source query.
- [ ] Joins handle composite keys correctly.

### AddInsightPopup
- [ ] Side-sheet slides in from the right (260ms, eased).
- [ ] Backdrop is subtle navy 8% opacity, no blur.
- [ ] Esc/outside-click closes; chat-mode Esc returns to browse first.
- [ ] Browse mode: chat input on top, shape filter pills, segment tabs (with subsegment row for Production), question chips.
- [ ] Already-pinned chips render greyed with "Pinned" tag.
- [ ] Recent conversations render at the bottom; clicking resumes.
- [ ] Chat mode: Quinn intro line + chart-or-table preview, action row (Pin / Open in new view / etc.).
- [ ] Pin button (chart): split-button with dropdown of all pin targets + "+ New view".
- [ ] Pin a chart to a View → appears as a ChartCard in that View.
- [ ] Pin a chart to Dashboard → appears as a pinned widget in the role's layout.
- [ ] Pin a table to current View → appears as a TableCard.
- [ ] "Open in new view" creates a tab and switches to it.

### Edit query (table chat refinement)
- [ ] Pencil icon on any TableCard opens the side-sheet in chat mode pre-loaded with that table.
- [ ] Pinning replaces the original table in place (does not append a new card).

### Build-a-table deep link
- [ ] `/insights?build=table` from sidebar opens the panel in browse mode, shape=table, targeting a View tab (creates one if needed).
- [ ] Param is cleared after handling.

### Persistence
- [ ] Tabs persist (`edify:insights:tabs:v1`).
- [ ] Layout per role persists (`edify:insights:layoutByRole:v1`).
- [ ] Recent conversations persist (`edify:insights:conversations:v1`), capped at 30.
- [ ] All readers validate shape and fall back to defaults on parse fail.

### Quinn voice & UX
- [ ] Reasoning popovers (`QuinnInsightButton`) on every pinned chart and dashboard chart, rendering markdown bold.
- [ ] Pin-confirm copy: "Added to {target name}".
- [ ] Drafts are visible (chat preview) before commit (pin).
- [ ] Conversation history rules: saved if ≥1 user message OR ≥1 pin.

### Quality
- [ ] `npm run lint` passes (no errors).
- [ ] `npm run build` passes.
- [ ] No hardcoded hex colours in components — all token-driven.
- [ ] Plus Jakarta Sans is the only font used.
- [ ] Lucide is the only icon library.
- [ ] No `any` types without a justifying comment.
- [ ] Loading + error states present for every async surface.

---

## 7. Component reference (the canon)

| Component | Path | Responsibility | Can it be removed? |
|---|---|---|---|
| `InsightsShell` | `components/Insights/InsightsShell.tsx` | Top-level orchestrator. Owns role, phaseOverride, dateRange, editing flags, AddInsightPopup state. | No — pivot point. |
| `InsightsTopBar` | `components/Insights/InsightsTopBar.tsx` | Site switcher + role pills + phase override. | No |
| `AskQuinnBar` | `components/Insights/AskQuinnBar.tsx` | The conversational entry-point bar. | No |
| `DateRangePicker` | `components/Insights/DateRangePicker.tsx` | Range pill dropdown. | No |
| `InsightsTabs` | `components/Insights/Tabs/InsightsTabs.tsx` | Tab strip with rename/remove/add. | No |
| `Dashboard` | `components/Dashboard/Dashboard.tsx` | Picks ManagerDashboard vs EstateDashboard by role. | Optional wrapper |
| `ManagerDashboard` | `components/Dashboard/ManagerDashboard.tsx` | Manager grid + edit chrome. | No |
| `EstateDashboard` | `components/Dashboard/EstateDashboard.tsx` | Admin grid (multi-site KPIs). | No |
| `DashboardWidget` | `components/Dashboard/DashboardWidget.tsx` | Edit-chrome wrapper around a widget body. | No |
| `DashboardEditToolbar` | `components/Dashboard/DashboardEditToolbar.tsx` | Date picker slot + Edit/Done + Add insight. | No |
| `QuinnInsightButton` | `components/Dashboard/QuinnInsightButton.tsx` | Reasoning popover ("why this matters"). | No |
| `ShiftKpiRow`, `KpiCard` | `components/Dashboard/parts/` | KPI tiles. | No |
| `HourlyCombo`, `WeatherStrip`, `WasteCard`, `DeliveriesCard`, `ChecklistComplianceCard` | `components/Dashboard/parts/` | Manager dashboard widgets. | No |
| `SalesTrendChart`, `SiteGpChart`, `WastageChart`, `CogsVarianceChart`, `LabourVsSalesChart` | `components/Dashboard/parts/` | Estate dashboard charts. | No |
| `AnalyticsCharts` | `components/Analytics/AnalyticsCharts.tsx` | `ANALYTICS_CONFIG` + `renderAnalyticsChart()` (the canonical chart catalogue). | No |
| `ViewTab`, `TableCard`, `ChartCard`, `EmptyState` | `components/Insights/Views/` | View-tab content. | No |
| `DataTable` | `components/Insights/Views/DataTable.tsx` | Generic Tanstack-table renderer. | No |
| `AddInsightPopup` | `components/Quinn/AddInsightPopup.tsx` | Side-sheet shell, mode switch (browse / chat). | No |
| `QuestionLibraryPicker` | `components/Quinn/QuestionLibraryPicker.tsx` | Browse mode — search + filters + chip list + recents. | No |
| `ChatPanel` | `components/Quinn/ChatPanel.tsx` | Chat mode — conversation + preview + pin actions. | No |
| `useInsightsTabs` | `hooks/useInsightsTabs.ts` | Tabs CRUD + persistence. | No |
| `useDashboardLayout` | `hooks/useDashboardLayout.ts` | Layout per role + pin/unpin. | No |
| `useConversationHistory` | `hooks/useConversationHistory.ts` | Recent conversations store. | No |
| `data/sources/*` | — | One file per data source. | No |
| `data/query.ts` | — | In-browser query engine. | Yes (optional — push down to server if you prefer). |
| `data/questionLibrary.ts` | — | Curated question metadata. | No |
| `data/rolesAndPhases.ts` | — | Type literals + greeting/phase helpers. | No |

---

## 8. Things to gotcha-proof

These are the spots Claude tends to get wrong. Watch them.

1. **Currency:** GBP everywhere. `£`, not `$`. The `formatCell` for type `currency` should use `style: 'currency'`, `currency: 'GBP'`.
2. **Don't mix Tailwind utility soup with the inline-style/CSS-variables convention** unless your existing app is already Tailwind-first. If so, pick one and stick to it across the new files.
3. **Pin uniqueness:** a chart can't be pinned twice to the same view. Guard with `target.charts.some(c => c.chartId === chartId)`.
4. **Rename vs remove on tabs:** Dashboard tab is non-removable AND non-renamable. Reports tab is non-removable but renamable (via double-click).
5. **Active-tab fallback:** when removing a tab, if the removed tab was active, fall back to the previous tab in array order — never leave `activeId` pointing at a missing id.
6. **localStorage parse safety:** every read must validate shape. A user pasting garbage into devtools should never crash the page.
7. **Side-sheet portal:** render the popup in a `createPortal(..., document.body)` so it isn't clipped by overflow:hidden ancestors.
8. **Esc precedence:** chat-mode Esc returns to browse, browse-mode Esc closes. Don't let both fire.
9. **Edit-mode + drag interaction:** the drag handle must be the only drag origin. Clicks on other parts of the widget should not start a drag (use `e.stopPropagation()` on inner buttons).
10. **`pinned:` prefix:** dashboard layout entries can be either built-in widget ids or `pinned:<chartId>`. The `pinnedChartIdOf()` helper is your gate; never inline the prefix logic in components.
11. **The `joinKey` field on a DataSource is a hint, not a contract.** The query engine still requires explicit `JoinSpec.on` pairs.
12. **Aggregation column `header` is the projected key.** When `groupBy` runs, agg columns write to `result[col.header]`, not `result[fieldToOutKey(col.field)]`. The `projectColumns` step then maps these back to clean keys.
13. **Conversation save rule:** library-only opens (zero messages, zero pins) are NOT saved. The user opening a question chip and immediately closing should leave no trail.
14. **Phase override default `'auto'`** uses the real clock; everything else is a manual override. The override changes a derived `effectivePhase` but never mutates the system clock.
15. **`addPinnedChart` upsert semantics:** if the chart is already pinned to that role's layout, do nothing (don't duplicate).

---

## 9. Useful patterns to copy from the prototype

If you have access to the original `edify-ai-prototype` codebase, these files are battle-tested implementations of the trickiest bits — feel free to crib:

- **Side-sheet shell with two modes:** `components/Dashboard/AddInsightPopup.tsx` (the framer-motion + portal + mode switch + auto-chat-table seeding pattern).
- **Tabs hook with versioned localStorage migration:** `hooks/useMvp1Tabs.ts` (clean illustration of how to add a v3→v4 migration without losing user state).
- **Query engine reference:** `components/Mvp1/Tables/query.ts` (~380 lines, includes inner-join + agg + projection — copy the algorithm, swap fixtures for fetch).
- **Dashboard layout types:** `components/Dashboard/layoutTypes.ts` (the `pinned:` prefix pattern + half-only-chart helpers).
- **Drag-on-drop swap:** `components/Dashboard/ManagerDashboard.tsx` `handleDragEnd` + `widgetRefs` (custom, no library, ~25 lines).
- **Question library shape:** `components/Dashboard/data/questionLibrary.ts` (segment + subsegment + shape + suggestedChartId).
- **Reasoning popover:** `components/Dashboard/parts/QuinnInsightButton.tsx` (markdown-bold renderer in a popover).

---

## 10. After MVP 1

Out of scope but worth flagging now so the architecture leaves room:

- **Multi-user layouts:** layouts are per-role for now. Real users want per-user. Plan: add a `userId` axis to `useDashboardLayout` once auth is in.
- **Real-time updates:** revalidate on a heartbeat (e.g. SWR with a 30s revalidation) and lift the cache out of each loader.
- **Chart builder UI:** today, custom charts only happen via Quinn chat. A direct "Build chart" form (metric → window → viz) is a fast-follow.
- **Mobile dashboard:** today the page falls back to a stub MobileShell. Real mobile is a card-stack version of the same widgets.
- **Server-side query push-down:** for prod data >10k rows, swap `runQuery(query)` for `fetch('/api/query', { method: 'POST', body: JSON.stringify(query) })` — same shape, different transport.
- **Sharing & export:** "Export this view to CSV", "Share dashboard link with a colleague" — uncomplicated additions once persistence is server-side.

---

*End of build guide. If anything in here contradicts what's in the operating prototype, the prototype wins — flag the diff and we'll update this doc.*

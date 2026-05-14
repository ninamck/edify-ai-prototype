'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Filter, Inbox, Clock, AlertCircle, AlertTriangle, Package, PackagePlus, Sparkles, UtensilsCrossed } from 'lucide-react';
import {
  DEMO_TODAY,
  PRET_SITES,
  effectiveSubmissionsForHub,
  getSite,
  getRecipe,
  productionItemsAt,
  linkedReceiversFor,
  submissionCutoffFor,
  carryOverFor,
  type SiteId,
  type Site,
  type SkuId,
  type ProductionRecipe,
  type ProductionItemId,
  type ProductionMode,
  type SpokeSubmission,
} from './fixtures';
import { productionSiteLabel } from './productionSiteOptions';
import { usePlan, usePlanStore, type PlanLine } from './PlanStore';
import StatusPill from './StatusPill';
import RecipeFocusPanel from './RecipeFocusPanel';
import QtyStepper from './QtyStepper';
import SpokeUnlockControl from './SpokeUnlockControl';
import { useDispatchTransfers } from './dispatchStore';
import { useHubOverrides } from './hubOverrideStore';
import { useHubExtras } from './hubExtrasStore';
import { useShortfallStatus } from './ingredientShortfallStore';
import { useHybridOrder, useHybridOrderActions, sumSlots } from './hybridOrderStore';
import HybridOrderSubmitBar from './HybridOrderSubmitBar';
import StepperLauncher from './StepperLauncher';
import { daySummary } from './salesReport';
import { unitPriceFor, formatCurrency } from '../Forecast/economics';
import { Pencil, Check, RotateCcw, Activity } from 'lucide-react';

/**
 * Recipe-first daily plan grid.
 *
 * One row per recipe; columns vary by site type:
 *   STANDALONE → Carry-over | P1..Pn | VP | Hot Prod | Total
 *   HUB        → Carry-over | P1..Pn | (per-spoke) | Total   (no Hot Prod, no VP)
 *   SPOKE      → Routes to the spoke order workflow (this grid is hub-side
 *                only; the polymorphic /production/plan page handles the swap).
 *   HYBRID     → Carry-over | P1..Pn | VP | Hot Prod | Total + a `Make` /
 *                `Receive` tag per row. Rows tagged `Receive` show source hub
 *                instead of production columns.
 *
 * The "too much info" dropdown that lived inside Bench Summary / Ingredient
 * Summary is replaced by the per-recipe focus panel — tapping a row opens a
 * side drawer with that recipe's ingredients, prep stages, bench, VP math
 * and (for hubs) per-spoke breakdown. No cross-recipe noise.
 *
 * Hot Prod cell is gated by site type (STANDALONE + HYBRID only) and expands
 * inline to a 30-min slot strip for the recipe in question.
 */
export type RecipeFirstGridProps = {
  siteId: SiteId;
  date: string;
  /**
   * 'today' shows live-floor signals; 'plan' is the drafting surface.
   * Currently informational — the grid renders the same in both surfaces;
   * downstream tweaks (live-sales lens, end-of-day lifecycle) hook here.
   */
  surface?: 'today' | 'plan';
};

const CATEGORY_ORDER: ProductionRecipe['category'][] = [
  'Bakery',
  'Sandwich',
  'Salad',
  'Snack',
  'Beverage',
];

/** Cap P-columns at 4 — matches live Edify's P1/P2/P3/P4 ceiling. */
const MAX_P_COLUMNS = 4;

/**
 * View mode for the production grid.
 *  - `all` (default) → high-level overview. P-slot columns are collapsed
 *    into one `Production` column (sum across slots) so the table stays
 *    legible. VP and Hot Prod stay as their own columns since they're
 *    different concepts from P-slot run work.
 *  - `p1` / `p2` / `p3` / `p4` → drill into one specific slot. Other
 *    P-slots, VP and Hot Prod are hidden so the manager focuses on what
 *    runs in that slot only.
 */
type ViewMode = 'all' | 'p1' | 'p2' | 'p3' | 'p4';

const P_INDEX_BY_MODE: Record<Exclude<ViewMode, 'all'>, number> = {
  p1: 0,
  p2: 1,
  p3: 2,
  p4: 3,
};

/**
 * Synthetic "now" anchor for the demo. Drives the On-demand pin on
 * the expanded HotProdDrops strip so the active drop is always
 * visible at the leftmost position when the user is looking at
 * today's plan. Matches the same `'07:30'` value the bench-board
 * surface uses, so the two views stay in sync if the user pivots
 * from plan → board mid-demo.
 */
const DEMO_NOW_HHMM = '07:30';

export default function RecipeFirstGrid({ siteId, date, surface = 'today' }: RecipeFirstGridProps) {
  const site = getSite(siteId) ?? PRET_SITES[0];
  const lines = usePlan(siteId, date);
  const planStore = usePlanStore();

  const isPlanSurface = surface === 'plan';

  const isHub = site.type === 'HUB';
  const isStandalone = site.type === 'STANDALONE';
  const isHybrid = site.type === 'HYBRID';
  // Hot Prod, VP and carry-over are only meaningful on sites with their
  // own retail floor — so STANDALONE + HYBRID. HUB and SPOKE never see
  // them on the live-floor / today surface.
  const baseShowHotProd = isStandalone || isHybrid;
  const baseShowVP = isStandalone || isHybrid;
  const baseShowCarryOver = isStandalone || isHybrid;

  // Plan surface intentionally diverges from today:
  //   • carry-over is always visible — even on a hub, the manager wants
  //     to see leftover dispatch buffer before locking tomorrow's plan
  //   • per-spoke columns drop off (per-spoke allocation lives in the
  //     focus drawer instead — keeps the planning grid uncluttered)
  //   • view-mode tabs and the spoke filter are hidden — planning shows
  //     all P-slots at once because the manager is editing them in place
  //   • VP column drops off on plan — VP rows are planned per-slot in
  //     the P-columns directly (same grid run-mode items use), so a
  //     separate daily VP cell on plan would just duplicate the row
  //     total. VP stays visible on today, where the floor can top up
  //     variable production through the day in real units.
  //   • Hot Prod stays visible on both surfaces — its per-drop strip
  //     is the only place hot-prod items get planned/adjusted, on plan
  //     and today alike.
  const showCarryOver = isPlanSurface ? true : baseShowCarryOver;
  const showSpokeCols = isPlanSurface ? false : isHub;
  // Extras column rides next to the spoke columns — same gating (HUB
  // today only). The column never reads from `perSpokeBySku`, so a
  // bump here can't pollute any spoke's allocation.
  const showExtras = showSpokeCols;
  const showHotProd = baseShowHotProd;
  const showVP = !isPlanSurface && baseShowVP;
  // VP cell is editable on today for self-producing sites (the floor
  // adjusts variable production through the day). Plan hides the
  // column entirely, so this flag only matters on today.
  const editableVP = !isPlanSurface && (isStandalone || isHybrid);
  // "Avail now" column — only for self-producing sites (the only ones
  // with a retail floor) and only on the today/run surface (Plan is
  // forward-looking). Shows planned − sold so far (clamped at zero), so
  // a manager glancing at the grid sees how many units of each recipe
  // are still on the floor without doing the math themselves.
  const showAvailNow = !isPlanSurface && (isStandalone || isHybrid);
  // On-demand column retired — VP and Hot Prod cover that intent
  // directly on the plan surface now. Variable items: VP stepper.
  // Increment (hot prod) items: per-drop strip behind the Hot Prod
  // column button. No more duplicate "On-demand" cell.
  // expandAllPSlots is calculated below — its full definition depends on
  // `viewMode` / `spokeFilter` (HUB-only behaviour), which are declared
  // a few lines down with the other filter state. Placeholder declared
  // there so callers above don't need to know the order of evaluation.

  // P-columns: derive site-wide max from any run line's perRunPlan length.
  // Capped at MAX_P_COLUMNS so wider schedules collapse into the column
  // budget — the focus panel surfaces any extra runs for the focused row.
  const pColumnCount = useMemo(() => {
    let max = 0;
    for (const line of lines) {
      if (line.item.mode !== 'run') continue;
      const len = line.perRunPlan?.length ?? 0;
      if (len > max) max = len;
    }
    return Math.min(MAX_P_COLUMNS, max);
  }, [lines]);

  // HYBRID-only — read the in-flight "receive from hub" order so the
  // grid can render per-slot steppers on receive rows AND surface a
  // submit-to-hub bar at the top of the plan view. Mirrors what spokes
  // do on `/production/spokes`, but inlined here so the hybrid manager
  // never has to context-switch between "ordering" and "planning".
  const showHybridOrder = isHybrid && isPlanSurface && !!site.hubId;
  const hybridHubId = site.hubId ?? null;
  const hybridSlotCount = Math.max(1, pColumnCount);
  const hybridOrder = useHybridOrder(siteId, date, hybridHubId, hybridSlotCount);
  const { setSlotQty: setHybridSlotQty } = useHybridOrderActions();
  const hybridHubLabel = useMemo(
    () => (hybridHubId ? productionSiteLabel(hybridHubId) : 'hub'),
    [hybridHubId],
  );
  // Once submitted (or acknowledged) the per-slot steppers lock so a
  // late edit doesn't silently change the in-flight order without going
  // through a resubmit flow. The bar still shows the current totals.
  const hybridOrderEditable = !!hybridOrder && hybridOrder.status === 'draft';

  // Per-spoke columns for HUB. Sorted by site fixture order so layouts
  // stay stable across renders.
  const spokes = useMemo(
    () => (isHub ? linkedReceiversFor(siteId) : []),
    [isHub, siteId],
  );

  // Hub-side per-spoke override store. The actual edit mode state +
  // selection-gating effect live further down, after `spokeFilter` is
  // declared (the rule: edit is only enabled when a specific spoke is
  // selected, not when viewing "All sites").
  const { getOverride, setOverride, clearOverride, overrideCount } = useHubOverrides();
  const overrideTotal = isHub ? overrideCount(siteId, date) : 0;

  // Hub-side "Extras" — off-list units the manager adds on top of every
  // spoke's allocation. Stored separately from `perSpokeBySku` so a bump
  // here never inflates any spoke's number; it's a hub-only "production
  // for walk-in / off-list demand" lane.
  //
  // The cells live in their own column on the right of the matrix; row
  // totals + footer + headline make-total add them on top of the
  // submitted/allocated spoke numbers.
  const { getExtras, setExtras, clearExtras } = useHubExtras();

  // Per-spoke confirmed-units lookup, keyed `${spokeId}|${skuId}`. Built
  // once per render so each row cell is an O(1) read. Hub overrides
  // win over the spoke's submitted number so totals + cell displays
  // both reflect the override.
  //
  // PAC138 — the effective submissions list for the hub's view of `date`.
  // Combines:
  //   1. Real seeded submissions (`submissionsForHub`).
  //   2. Synthetic 'auto-finalised' submissions, one per linked receiver
  //      whose cutoff has passed without a real submission on file. Quinn
  //      commits Quinn's baseline numbers on their behalf so the hub bake
  //      plan has values for that spoke instead of a blank "No order"
  //      column. The hub Unlock affordance is still available per column
  //      if the spoke calls in to change them.
  // Cutoff state is read live (via Date.now) so the flip is purely time-
  // driven — no fixture edits required.
  const effectiveSubmissions = useMemo<SpokeSubmission[]>(() => {
    if (!isHub) return [];
    return effectiveSubmissionsForHub(siteId, date);
  }, [isHub, siteId, date]);

  // Per-(spoke, sku) quantity lookup. Builds the matrix cells.
  //
  // Draft submissions are intentionally skipped — a spoke that hasn't
  // submitted yet shouldn't be driving hub bake numbers. The spoke
  // column will read "Pending" instead of a stale Quinn proposal.
  // Auto-finalised submissions (PAC138) ARE included: that's the whole
  // point — the system commits Quinn's baseline so the hub has numbers
  // to bake against even when the spoke missed the cutoff.
  const perSpokeBySku = useMemo(() => {
    const map = new Map<string, number>();
    if (!isHub) return map;
    for (const sub of effectiveSubmissions) {
      if (sub.status === 'draft') continue;
      for (const ln of sub.lines) {
        const qty = ln.confirmedUnits ?? ln.quinnProposedUnits;
        const override = getOverride(siteId, sub.fromSiteId, ln.skuId, date);
        map.set(`${sub.fromSiteId}|${ln.skuId}`, override ?? qty);
      }
    }
    return map;
  }, [isHub, effectiveSubmissions, siteId, date, getOverride]);

  // Set of spokes that have actually placed an order for `date`. Used to
  // gate header countdowns and per-cell "—" placeholders. Anything not
  // in this set hasn't submitted yet. Auto-finalised submissions count
  // as "submitted" for this purpose — the cells should render the
  // committed numbers, not the "—" placeholder.
  const submittedSpokeIds = useMemo(() => {
    const set = new Set<SiteId>();
    if (!isHub) return set;
    for (const sub of effectiveSubmissions) {
      if (sub.status !== 'draft') set.add(sub.fromSiteId);
    }
    return set;
  }, [isHub, effectiveSubmissions]);

  // Hub-side per-spoke unlock context — needed to render the inline
  // Lock / Unlock affordance on each spoke column header. Computed
  // once per render so the SpokeUnlockControl component just plugs in.
  const { transferFor } = useDispatchTransfers();
  const spokeSubmissions = useMemo(() => {
    if (!isHub) return new Map<SiteId, SpokeSubmission>();
    const map = new Map<SiteId, SpokeSubmission>();
    for (const sub of effectiveSubmissions) {
      map.set(sub.fromSiteId, sub);
    }
    return map;
  }, [isHub, effectiveSubmissions]);

  // For HYBRID: which SKUs the site bakes itself (everything else is
  // received from the hub). Drives the Make / Receive tag per row.
  const hybridMakeSkus = useMemo(() => {
    if (!isHybrid) return null;
    const set = new Set<SkuId>();
    for (const item of productionItemsAt(siteId)) set.add(item.skuId);
    return set;
  }, [isHybrid, siteId]);

  // Build the row dataset. For HYBRID we also have to surface "receive"
  // rows for SKUs the hub bakes that this site doesn't bake itself —
  // those don't appear in `usePlan(siteId)` because they're not local
  // ProductionItems. We synthesise them from the hub's items.
  type Row = {
    line: PlanLine | null;
    /** Used when no PlanLine exists (HYBRID receive rows). */
    recipe: ProductionRecipe;
    skuId: SkuId;
    itemId: ProductionItemId | null;
    /** 'make' = produced at this site; 'receive' = comes in from hub. */
    hybridSource: 'make' | 'receive' | null;
    /**
     * Production mode of the underlying ProductionItem. For make rows this
     * mirrors `line.item.mode`; for HYBRID receive rows it's sourced from
     * the hub's item so the production-type filter (Run / VP / Hot Prod)
     * can include receive recipes in the right bucket too.
     */
    itemMode: ProductionMode | null;
  };

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    const seenSku = new Set<SkuId>();

    for (const line of lines) {
      // Hubs only do scheduled run + variable production for their spokes —
      // they don't bake hot-prod / increment items (those are floor-side
      // refresh recipes that only make sense at a site that serves
      // walk-in customers). Drop them so the hub plan stays focused on
      // what it actually dispatches.
      if (isHub && line.item.mode === 'increment') continue;
      if (seenSku.has(line.recipe.skuId)) continue;
      seenSku.add(line.recipe.skuId);
      out.push({
        line,
        recipe: line.recipe,
        skuId: line.recipe.skuId,
        itemId: line.item.id,
        hybridSource: isHybrid ? 'make' : null,
        itemMode: line.item.mode,
      });
    }

    // HYBRID receive rows — anything the hub bakes that this site doesn't.
    if (isHybrid && site.hubId) {
      const hubItems = productionItemsAt(site.hubId);
      for (const hi of hubItems) {
        if (seenSku.has(hi.skuId)) continue;
        seenSku.add(hi.skuId);
        const recipe = getRecipe(hi.recipeId);
        if (!recipe) continue;
        out.push({
          line: null,
          recipe,
          skuId: hi.skuId,
          itemId: null,
          hybridSource: 'receive',
          itemMode: hi.mode,
        });
      }
    }

    return out;
  }, [lines, isHub, isHybrid, site.hubId]);

  const [focusedItemId, setFocusedItemId] = useState<ProductionItemId | null>(null);
  const [expandedHotProdId, setExpandedHotProdId] = useState<ProductionItemId | null>(null);

  // ── View-mode + site filters ────────────────────────────────────────────
  // Ed's feedback after the first recipe-first pass: the main overview was
  // showing P1/P2/P3/P4 columns by default and the hub view was dumping
  // every spoke as a column. That's the same "too much info" problem
  // reskinned. Fix: the default view is `All` (one collapsed Production
  // column, no per-slot breakdown), and slot tabs let the user drill in.
  // The site dropdown filters which spoke columns appear (HUB only).
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [spokeFilter, setSpokeFilter] = useState<SiteId | 'all'>('all');
  // Production-type filter (today surface, self-producing sites only):
  // 'all' | 'run' | 'variable' | 'increment'. Lets the floor zero in on
  // VP rows or Hot Prod rows during a live shift.
  const [modeFilter, setModeFilter] = useState<'all' | 'run' | 'variable' | 'increment'>('all');

  // Group by category for the section headers. Production-type filter
  // (today, self-producing only) narrows rows to a single mode so the
  // floor can focus on e.g. just VP rows during a busy push.
  const grouped = useMemo(() => {
    const filteredRows =
      modeFilter === 'all'
        ? rows
        : rows.filter(r => {
            // HYBRID receive rows have no local PlanLine, but their
            // underlying ProductionItem (which lives at the hub) still
            // has a mode. Filter on `itemMode` so VP / Hot Prod / Run
            // filters include receive recipes whose hub-side item
            // matches — e.g. a HYBRID filtering to VP should still see
            // the VP sandwiches it gets from `hub-central`.
            if (!r.itemMode) return false;
            return r.itemMode === modeFilter;
          });
    const map = new Map<ProductionRecipe['category'], Row[]>();
    for (const r of filteredRows) {
      const arr = map.get(r.recipe.category) ?? [];
      arr.push(r);
      map.set(r.recipe.category, arr);
    }
    return CATEGORY_ORDER.filter(c => map.has(c)).map(c => ({
      category: c,
      rows: map.get(c)!,
    }));
  }, [rows, modeFilter]);

  const viewModeTabs = useMemo(() => {
    const out: { id: ViewMode; label: string }[] = [{ id: 'all', label: 'All' }];
    for (let i = 1; i <= pColumnCount; i++) {
      out.push({ id: `p${i}` as ViewMode, label: `P${i}` });
    }
    return out;
  }, [pColumnCount]);

  // If the user switches to a site whose schedule doesn't have the slot
  // they had selected (e.g. P3 → site only has P1/P2), fall back to All.
  useEffect(() => {
    if (viewMode === 'all') return;
    if (!viewModeTabs.some(t => t.id === viewMode)) setViewMode('all');
  }, [viewModeTabs, viewMode]);

  // Same defensive reset when the visible spoke list changes.
  useEffect(() => {
    if (spokeFilter === 'all') return;
    if (!spokes.some(s => s.id === spokeFilter)) setSpokeFilter('all');
  }, [spokes, spokeFilter]);

  // Edit mode (per-spoke override surface) — gated by site selection.
  // The rule: you must pick a specific spoke from the filter before you
  // can override its numbers. Editing across "All sites" is blocked so
  // the manager is always making changes against one site's plan at a
  // time. If the filter slips back to "all" mid-edit, exit edit mode
  // automatically rather than silently break the rule.
  const [editMode, setEditMode] = useState(false);
  const editLocked = spokeFilter === 'all';
  useEffect(() => {
    if (editLocked && editMode) setEditMode(false);
  }, [editLocked, editMode]);

  /** Whether to render every P-slot column inline rather than collapse
   *  them into a single "Production" total.
   *
   *  • Plan surface — always: the manager is editing each slot in place.
   *  • STANDALONE / HYBRID Today — always: a single-shop manager wants
   *    the whole day's shape on screen in one glance.
   *  • HUB Today — whenever the slot filter is on "All". Both "All
   *    sites" and a specific-site selection get the full P1..Pn split
   *    so the manager always sees how the day is shaped under the
   *    "All" tab. Edit mode is implied (it requires a specific site +
   *    All slots and is already covered by this rule).
   */
  const expandAllPSlots =
    isPlanSurface ||
    isStandalone ||
    isHybrid ||
    (isHub && viewMode === 'all');

  /** Which `perRunPlan[i]` indices to render as columns.
   *
   * Plan surface always shows every P-slot (the manager edits them in
   * place, no filtering). Self-producing today views also show every
   * P-slot — single-shop managers want the full day shape in one
   * glance. HUB today follows the active view mode tab so the table
   * doesn't blow out width once per-spoke columns join in. */
  const pColIndices = useMemo(() => {
    if (expandAllPSlots) {
      return Array.from({ length: pColumnCount }, (_, i) => i);
    }
    if (viewMode === 'all') return [] as number[];
    const idx = P_INDEX_BY_MODE[viewMode];
    return idx < pColumnCount ? [idx] : [];
  }, [expandAllPSlots, viewMode, pColumnCount]);

  /** All-view collapses P1..Pn into a single Production column for HUB
   *  Today. Plan surface and self-producing today views show the slots
   *  themselves, so this column is suppressed there. */
  const showProductionTotal =
    !isPlanSurface && !expandAllPSlots && viewMode === 'all' && pColumnCount > 0;

  // VP and Hot Prod are concepts orthogonal to P-slot work. On HUB today
  // we hide them in P-mode so the table is genuinely focused on that
  // slot; on self-producing today we always show them since the
  // production-type filter (modeFilter) handles narrowing instead.
  const showVPInView = showVP && (expandAllPSlots || viewMode === 'all');
  const showHotProdInView = showHotProd && (expandAllPSlots || viewMode === 'all');

  const visibleSpokes = useMemo(
    () => (spokeFilter === 'all' ? spokes : spokes.filter(s => s.id === spokeFilter)),
    [spokes, spokeFilter],
  );

  /** Submission + transfer state for the selected spoke. Only computed
   *  when a specific spoke is filtered to (otherwise there's nothing
   *  to "broadcast" across the P-column headers). Used by the per-P
   *  "Sent" pill: when the order has been dispatched and a single
   *  spoke is in focus, every P-slot header carries a small status
   *  pill so the manager can read top-down "today's runs are out the
   *  door for this spoke" without scanning right to the spoke column. */
  const selectedSpokeStatus = useMemo(() => {
    if (!isHub || spokeFilter === 'all') return null;
    const submission = spokeSubmissions.get(spokeFilter);
    const cutoffISO = submission?.cutoffDateTime ?? submissionCutoffFor(siteId, date);
    const cutoffPassed = new Date(cutoffISO).getTime() < Date.now();
    const hasTransfer = !!transferFor(siteId, spokeFilter, date);
    return { submission, cutoffISO, cutoffPassed, hasTransfer };
  }, [isHub, spokeFilter, spokeSubmissions, siteId, date, transferFor]);

  /** Whether to surface the "Sent" pill above each P-slot header.
   *  Only fires when a single spoke is selected AND the hub has
   *  already dispatched that spoke's order — when nothing's gone
   *  out yet, the existing spoke-column pill carries the read. */
  const showSentBadgeAboveP =
    !!selectedSpokeStatus && selectedSpokeStatus.hasTransfer;

  /** Filter row (tabs + dropdown) is hidden on the plan surface. */
  const showFilterControls = !isPlanSurface;

  // Production-type tabs only meaningful on today + self-producing (the
  // only personas with VP / Hot Prod variety). Auto-hides for HUB.
  const showModeFilter = !isPlanSurface && (isStandalone || isHybrid);

  // Sold-so-far lookup — keyed by skuId so we can join against grid
  // rows. Drives the "Avail now" cell (planned − sold). Builds once
  // per (siteId, date) and only when the column is visible (skipped on
  // Plan / HUB / SPOKE).
  const soldSoFarBySku = useMemo(() => {
    const map = new Map<SkuId, number>();
    if (!showAvailNow) return map;
    const summary = daySummary(siteId, date);
    for (const r of summary.rows) {
      map.set(r.line.item.skuId, r.sold);
    }
    return map;
  }, [showAvailNow, siteId, date]);

  // Per-row Total column. Self-producing sites already need it (the
  // sum across runs / VP / Hot Prod is the only single number that
  // expresses the recipe's commitment for the day). For hub view we
  // also keep it on by default now: when the manager is reading down
  // the bake plan, the per-recipe sum across spokes is the headline
  // number for that recipe, and pairs with the new "Total to make"
  // banner above the table for the day-level total. Edit mode flipped
  // this on previously and keeps doing so — that branch just folds
  // into the always-on rule below.
  const showRowTotal = true;

  // Editable run cells. Plan is the drafting surface so every P-slot is
  // an inline stepper there. On Today we also flip this on once a hub
  // manager has explicitly entered Edit mode — the same surface that
  // already lets them override per-spoke amounts gets the per-run dials
  // alongside, so they can adjust the hub's bake split without
  // bouncing back to the Plan page.
  const editableRuns = isPlanSurface || (isHub && editMode);

  // Total column count for empty-state colSpan.
  const colCount =
    1 /* recipe */ +
    (showCarryOver ? 1 : 0) +
    pColIndices.length +
    (showProductionTotal ? 1 : 0) +
    (showVPInView ? 1 : 0) +
    (showHotProdInView ? 1 : 0) +
    (showSpokeCols ? visibleSpokes.length : 0) +
    (showExtras ? 1 : 0) +
    (showAvailNow ? 1 : 0) +
    (showRowTotal ? 1 : 0);

  // Hub "Total to make" footer — aggregates each visible column across
  // every row so the manager can see at a glance what the hub owes
  // (per P-slot, per spoke, and overall) without summing by eye. Only
  // built for HUB sites; the per-row total / per-spoke split has no
  // analogue on standalone or hybrid surfaces.
  const hubTotals = useMemo(() => {
    if (!isHub) return null;
    let carryOver = 0;
    let production = 0;
    let grand = 0;
    let extras = 0;
    // Team-food units roll into the bake total ('grand') the same way
    // extras do — the bench is making them, so they belong in "Total
    // to make" — but stay out of every sales-aligned read below.
    let teamFood = 0;
    // £ rollups, mirroring the unit aggregates above. Every recipe is
    // priced via `unitPriceFor` (synthesised from category + SKU seed)
    // so the "Total sales" footer reads as projected revenue if every
    // unit on the bake plan sells through. Team food intentionally
    // contributes ZERO £ — staff lunch is a cost line, not revenue.
    let carryOverSales = 0;
    let productionSales = 0;
    let grandSales = 0;
    let extrasSales = 0;
    const pSlots = new Array<number>(pColumnCount).fill(0);
    const pSlotsSales = new Array<number>(pColumnCount).fill(0);
    const spokeTotals = new Map<SiteId, number>();
    const spokeSales = new Map<SiteId, number>();
    for (const sp of visibleSpokes) {
      spokeTotals.set(sp.id, 0);
      spokeSales.set(sp.id, 0);
    }
    for (const group of grouped) {
      for (const r of group.rows) {
        const price = unitPriceFor(r.skuId);
        const co = carryOverFor(siteId, r.skuId);
        const coUnits = co?.carriedUnits ?? 0;
        carryOver += coUnits;
        carryOverSales += coUnits * price;
        const line = r.line;
        if (line) {
          grand += line.planned;
          grandSales += line.planned * price;
          if (line.item.mode === 'run') {
            production += line.runPlanned;
            productionSales += line.runPlanned * price;
            const pr = line.perRunPlan ?? [];
            for (let i = 0; i < pColumnCount; i++) {
              const u = pr[i] ?? 0;
              pSlots[i] += u;
              pSlotsSales[i] += u * price;
            }
          }
          // Team food lifts the bake target only. No `*price` term —
          // we deliberately skip the sales aggregates.
          if (line.teamFoodPlanned > 0) {
            teamFood += line.teamFoodPlanned;
            grand += line.teamFoodPlanned;
          }
        }
        for (const sp of visibleSpokes) {
          const v = perSpokeBySku.get(`${sp.id}|${r.skuId}`) ?? 0;
          spokeTotals.set(sp.id, (spokeTotals.get(sp.id) ?? 0) + v);
          spokeSales.set(sp.id, (spokeSales.get(sp.id) ?? 0) + v * price);
        }
        // Extras roll into the day's grand total because the bench is
        // baking them too — but they stay out of every spoke column by
        // construction (the lookup is hub-scoped, not spoke-scoped).
        if (showExtras) {
          const ex = getExtras(siteId, r.skuId, date);
          if (ex > 0) {
            extras += ex;
            extrasSales += ex * price;
            grand += ex;
            grandSales += ex * price;
          }
        }
      }
    }
    return {
      carryOver,
      production,
      pSlots,
      grand,
      spokeTotals,
      extras,
      teamFood,
      carryOverSales,
      productionSales,
      pSlotsSales,
      grandSales,
      spokeSales,
      extrasSales,
    };
  }, [isHub, grouped, pColumnCount, siteId, visibleSpokes, perSpokeBySku, showExtras, getExtras, date]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Hybrid receive-from-hub submit bar.
          Sits above the toolbar (and outside the same horizontal padding
          so the bar can carry its own margin against the table card).
          Only mounted on the HYBRID Plan view — Today / Hub / standalone
          surfaces don't need it. */}
      {showHybridOrder && hybridHubId && (
        <HybridOrderSubmitBar
          siteId={siteId}
          hubId={hybridHubId}
          hubLabel={hybridHubLabel}
          date={date}
          order={hybridOrder}
        />
      )}

      <div style={{ padding: '16px 30px 32px' }}>
        {/* Toolbar:
              • HUB Today: All / P1..Pn slot tabs + spoke filter + Edit
                + Stepper launcher.
              • Self-producing Today: production-type tabs (All / Run /
                VP / Hot Prod) — slot tabs hidden because every P-slot
                column is already on screen — plus the Stepper launcher.
              • Plan surface: nothing — Plan is "edit everything at
                once" and the Stepper only makes sense as a Run-
                production affordance.
        */}
        {(() => {
          const hasFilters =
            showFilterControls &&
            (viewModeTabs.length > 1 ||
              (showSpokeCols && spokes.length > 1) ||
              isHub ||
              showModeFilter);
          const showStepperHere = !isPlanSurface;
          if (!hasFilters && !showStepperHere) return null;
          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 10,
              }}
            >
              {/* Slot tabs only on HUB Today; self-producing always
                  shows every P-slot inline. */}
              {showFilterControls && !expandAllPSlots && viewModeTabs.length > 1 && (
                <ViewModeTabs
                  tabs={viewModeTabs}
                  value={viewMode}
                  onChange={setViewMode}
                />
              )}
              {showFilterControls && showModeFilter && (
                <ProductionTypeTabs
                  value={modeFilter}
                  onChange={setModeFilter}
                />
              )}
              {showFilterControls && showSpokeCols && spokes.length > 1 && (
                <SpokeFilterDropdown
                  spokes={spokes}
                  value={spokeFilter}
                  onChange={setSpokeFilter}
                />
              )}
              {showFilterControls && isHub && showSpokeCols && (
                <EditHubPlanButton
                  editMode={editMode}
                  overrideCount={overrideTotal}
                  locked={editLocked}
                  onEnter={() => setEditMode(true)}
                  onDone={() => setEditMode(false)}
                />
              )}
              {showStepperHere && (
                <>
                  <div style={{ flex: 1 }} />
                  <StepperLauncher siteId={siteId} date={date} variant="ghost" />
                </>
              )}
            </div>
          );
        })()}

        {/* Hub total — headline number for "what does this hub need to
            make today, all in". Hub view normally hides the per-row Total
            column (it's only shown in edit mode), so without this banner
            there's nowhere on the page that surfaces the day's grand
            total at a glance. The number is independent of any active
            P-slot or spoke filter so the manager has a stable reference
            even while drilling into runs / individual spokes. */}
        {isHub && hubTotals && grouped.length > 0 && (
          <HubMakeTotalChip
            totalUnits={hubTotals.grand}
            extrasUnits={hubTotals.extras}
            recipeCount={grouped.reduce((s, g) => s + g.rows.length, 0)}
            spokeCount={spokes.length}
          />
        )}

        <div
          style={{
            background: '#ffffff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                minWidth: 720,
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontFamily: 'var(--font-primary)',
              }}
            >
              <thead>
                <tr>
                  <th style={headStyle({ left: true, sticky: true, minWidth: 240 })}>
                    Recipe
                  </th>
                  {showCarryOver && (
                    <th style={headStyle({ minWidth: 70 })}>Carry-over</th>
                  )}
                  {showProductionTotal && (
                    <th style={headStyle({ minWidth: 80 })}>
                      Production
                    </th>
                  )}
                  {pColIndices.map(i => (
                    <th key={`p${i + 1}`} style={headStyle({ minWidth: editableRuns ? 110 : 60 })}>
                      {showSentBadgeAboveP && selectedSpokeStatus ? (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {/* Per-P "Sent" pill — same component as the
                              spoke-column header so colour / shape /
                              tooltip are identical, just rendered
                              above each run so the dispatch status
                              reads down the table at a glance. */}
                          <SpokeSubmissionStatus
                            submission={selectedSpokeStatus.submission}
                            cutoffISO={selectedSpokeStatus.cutoffISO}
                            cutoffPassed={selectedSpokeStatus.cutoffPassed}
                            dispatched={selectedSpokeStatus.hasTransfer}
                          />
                          <span style={{ minHeight: 14, lineHeight: '14px' }}>
                            {isPlanSurface ? `Production ${i + 1}` : `P${i + 1}`}
                          </span>
                        </div>
                      ) : (
                        isPlanSurface ? `Production ${i + 1}` : `P${i + 1}`
                      )}
                    </th>
                  ))}
                  {showVPInView && (
                    <th style={headStyle({ minWidth: editableVP ? 100 : 60 })}>VP</th>
                  )}
                  {showHotProdInView && <th style={headStyle({ minWidth: 80 })}>Hot Prod</th>}
                  {showAvailNow && (
                    <th
                      style={headStyle({ minWidth: 90 })}
                      title="Planned production minus units sold so far today. What's still on the floor."
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          justifyContent: 'center',
                        }}
                      >
                        <Package size={11} />
                        Avail now
                      </span>
                    </th>
                  )}
                  {showSpokeCols &&
                    visibleSpokes.map(sp => {
                      const submission = spokeSubmissions.get(sp.id);
                      // For submissions on file we use the submission's
                      // seeded cutoff (matches the dispatch-matrix
                      // logic); for spokes with no draft yet we derive
                      // the cutoff from the hub config so the countdown
                      // pill still has a target to count against.
                      const cutoffISO =
                        submission?.cutoffDateTime ?? submissionCutoffFor(siteId, date);
                      const cutoffPassed =
                        new Date(cutoffISO).getTime() < Date.now();
                      const hasTransfer = !!transferFor(siteId, sp.id, date);
                      return (
                        <th key={sp.id} style={headStyle({ minWidth: 130 })}>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <span style={{ minHeight: 14, lineHeight: '14px' }}>
                              {productionSiteLabel(sp.id) || sp.name}
                            </span>
                            <SpokeSubmissionStatus
                              submission={submission}
                              cutoffISO={cutoffISO}
                              cutoffPassed={cutoffPassed}
                              dispatched={hasTransfer}
                            />
                            {submission && (
                              <SpokeUnlockControl
                                hubId={siteId}
                                spokeId={sp.id}
                                forDate={date}
                                submission={submission}
                                cutoffPassed={cutoffPassed}
                                hasTransfer={hasTransfer}
                                unlockedBy="Hub manager"
                              />
                            )}
                          </div>
                        </th>
                      );
                    })}
                  {showExtras && (
                    <th
                      style={headStyle({ minWidth: 90 })}
                      title="Off-list units the hub bakes on top of every spoke's allocation. Lifts the row total and the day's make total, but never appears on any spoke's column."
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          justifyContent: 'center',
                        }}
                      >
                        <PackagePlus size={11} />
                        Extras
                      </span>
                    </th>
                  )}
                  {showRowTotal && (
                    <th style={headStyle({ minWidth: 70, totalCol: true })}>Total</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {grouped.length === 0 && (
                  <tr>
                    <td
                      colSpan={colCount}
                      style={{
                        padding: '32px 16px',
                        textAlign: 'center',
                        color: 'var(--color-text-muted)',
                        fontSize: 12,
                      }}
                    >
                      Nothing planned for this site on {date}.
                    </td>
                  </tr>
                )}

                {grouped.map(group => (
                  <CategoryGroup
                    key={group.category}
                    category={group.category}
                    rows={group.rows}
                    isPlanSurface={isPlanSurface}
                    editableRuns={editableRuns}
                    showCarryOver={showCarryOver}
                    pColIndices={pColIndices}
                    pColumnCount={pColumnCount}
                    showProductionTotal={showProductionTotal}
                    showVP={showVPInView}
                    showHotProd={showHotProdInView}
                    showSpokeCols={showSpokeCols}
                    showExtras={showExtras}
                    showAvailNow={showAvailNow}
                    soldSoFarBySku={soldSoFarBySku}
                    editableVP={editableVP}
                    spokes={visibleSpokes}
                    perSpokeBySku={perSpokeBySku}
                    submittedSpokeIds={submittedSpokeIds}
                    showRowTotal={showRowTotal}
                    isHybrid={isHybrid}
                    siteId={siteId}
                    date={date}
                    planStore={planStore}
                    editMode={editMode}
                    setOverride={setOverride}
                    clearOverride={clearOverride}
                    getOverride={getOverride}
                    getExtras={getExtras}
                    setExtras={setExtras}
                    clearExtras={clearExtras}
                    focusedItemId={focusedItemId}
                    expandedHotProdId={expandedHotProdId}
                    colCount={colCount}
                    hybridReceiveSlots={
                      showHybridOrder && hybridOrder ? hybridOrder.perSlot : null
                    }
                    hybridReceiveEditable={hybridOrderEditable}
                    onHybridSlotChange={(skuId, slotIndex, qty) =>
                      setHybridSlotQty(siteId, date, skuId, slotIndex, hybridSlotCount, qty)
                    }
                    onSelectRow={r => setFocusedItemId(r.itemId)}
                    onToggleHotProd={r => {
                      if (!r.itemId) return;
                      setExpandedHotProdId(prev => (prev === r.itemId ? null : r.itemId));
                    }}
                  />
                ))}
              </tbody>

              {isHub && hubTotals && grouped.length > 0 && (
                <tfoot>
                  <tr>
                    <td style={footStyle({ left: true, sticky: true })}>
                      Total to make
                    </td>
                    {showCarryOver && (
                      <td style={footStyle()}>
                        <span style={numStyle()}>{hubTotals.carryOver}</span>
                      </td>
                    )}
                    {showProductionTotal && (
                      <td style={footStyle()}>
                        <span style={numStyle()}>{hubTotals.production}</span>
                      </td>
                    )}
                    {pColIndices.map(i => (
                      <td key={`tot-p${i + 1}`} style={footStyle()}>
                        <span style={numStyle()}>{hubTotals.pSlots[i] ?? 0}</span>
                      </td>
                    ))}
                    {showVPInView && <td style={footStyle()}>—</td>}
                    {showHotProdInView && <td style={footStyle()}>—</td>}
                    {showAvailNow && <td style={footStyle()}>—</td>}
                    {showSpokeCols &&
                      visibleSpokes.map(sp => (
                        <td key={`tot-${sp.id}`} style={footStyle()}>
                          <span style={numStyle()}>
                            {hubTotals.spokeTotals.get(sp.id) ?? 0}
                          </span>
                        </td>
                      ))}
                    {showExtras && (
                      <td style={footStyle()}>
                        {hubTotals.extras > 0 ? (
                          <span
                            style={{
                              ...numStyle(),
                              color: 'var(--color-info)',
                              fontWeight: 700,
                            }}
                            title={`${hubTotals.extras} extra unit${hubTotals.extras === 1 ? '' : 's'} on top of every spoke's allocation`}
                          >
                            +{hubTotals.extras}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>
                    )}
                    {showRowTotal && (
                      <td style={footStyle({ totalCol: true })}>
                        {hubTotals.teamFood > 0 ? (
                          // Stacked grand-total: bake target on top, "incl.
                          // N team food" caption underneath. Mirrors the
                          // per-row total treatment so the footer reads
                          // the same way (units on top, what's-in-them
                          // chips underneath).
                          <span
                            style={{
                              display: 'inline-flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              lineHeight: 1.15,
                            }}
                            title={`${hubTotals.grand} total · ${hubTotals.grand - hubTotals.teamFood - hubTotals.extras} sellable + ${hubTotals.extras} extra${hubTotals.extras === 1 ? '' : 's'} + ${hubTotals.teamFood} team food (not sold)`}
                          >
                            <span style={numStyle()}>{hubTotals.grand}</span>
                            <span
                              style={{
                                fontSize: 9,
                                color: 'var(--color-info)',
                                fontVariantNumeric: 'tabular-nums',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2,
                                marginTop: 1,
                              }}
                            >
                              <UtensilsCrossed size={9} />
                              incl. {hubTotals.teamFood} team
                            </span>
                          </span>
                        ) : (
                          <span style={numStyle()}>{hubTotals.grand}</span>
                        )}
                      </td>
                    )}
                  </tr>
                  {/* Projected revenue row — mirrors the unit footer above
                      so the manager can read "what will this bake make us
                      if it all sells through" alongside "how much do we
                      bake". Prices come from `unitPriceFor` (category-based
                      synth, deterministic per SKU), so this is a directional
                      read for the prototype rather than till-grade
                      figures. */}
                  <tr>
                    <td style={footSubStyle({ left: true, sticky: true })}>
                      Total sales
                    </td>
                    {showCarryOver && (
                      <td style={footSubStyle()}>
                        <span style={moneyStyle()}>
                          {formatCurrency(Math.round(hubTotals.carryOverSales))}
                        </span>
                      </td>
                    )}
                    {showProductionTotal && (
                      <td style={footSubStyle()}>
                        <span style={moneyStyle()}>
                          {formatCurrency(Math.round(hubTotals.productionSales))}
                        </span>
                      </td>
                    )}
                    {pColIndices.map(i => (
                      <td key={`tots-p${i + 1}`} style={footSubStyle()}>
                        <span style={moneyStyle()}>
                          {formatCurrency(Math.round(hubTotals.pSlotsSales[i] ?? 0))}
                        </span>
                      </td>
                    ))}
                    {showVPInView && <td style={footSubStyle()}>—</td>}
                    {showHotProdInView && <td style={footSubStyle()}>—</td>}
                    {showAvailNow && <td style={footSubStyle()}>—</td>}
                    {showSpokeCols &&
                      visibleSpokes.map(sp => (
                        <td key={`tots-${sp.id}`} style={footSubStyle()}>
                          <span style={moneyStyle()}>
                            {formatCurrency(
                              Math.round(hubTotals.spokeSales.get(sp.id) ?? 0),
                            )}
                          </span>
                        </td>
                      ))}
                    {showExtras && (
                      <td style={footSubStyle()}>
                        {hubTotals.extras > 0 ? (
                          <span
                            style={{
                              ...moneyStyle(),
                              color: 'var(--color-info)',
                            }}
                          >
                            +{formatCurrency(Math.round(hubTotals.extrasSales))}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>
                    )}
                    {showRowTotal && (
                      <td style={footSubStyle({ totalCol: true })}>
                        <span style={moneyStyle()}>
                          {formatCurrency(Math.round(hubTotals.grandSales))}
                        </span>
                      </td>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <p
          style={{
            fontSize: 10,
            color: 'var(--color-text-muted)',
            marginTop: 10,
            lineHeight: 1.5,
            paddingLeft: 4,
          }}
        >
          {isPlanSurface ? (
            <>
              Each cell is editable — use the steppers to adjust planned
              units. The faded <em>fc</em> number underneath is Edify's
              forecast for that slot, shown for reference.
            </>
          ) : expandAllPSlots ? (
            <>
              Every P-slot shown inline.
              {editableVP && ' VP is editable — adjust variable production through the day.'}
              {showAvailNow && ' Avail now is what\u2019s still on the floor — planned minus sold so far.'}
              {modeFilter !== 'all' && (
                <>
                  {' '}Filtered to{' '}
                  <strong>
                    {modeFilter === 'run' ? 'Run' : modeFilter === 'variable' ? 'VP' : 'Hot Prod'}
                  </strong>{' '}
                  rows — switch to <em>All</em> to see everything.
                </>
              )}
            </>
          ) : viewMode === 'all' ? (
            <>
              Showing each recipe's day total
              {pColumnCount > 0 ? ` (sum of P1${pColumnCount > 1 ? `–P${pColumnCount}` : ''})` : ''}
              {showVP && ', variable production (VP)'}
              {showHotProd && ', and hot production drops'}
              {showCarryOver && ', with yesterday\u2019s carry-over factored in'}.
              {' '}Switch to a P-tab to drill into one slot.
            </>
          ) : (
            <>
              Showing only what runs in <strong>{viewMode.toUpperCase()}</strong>.
              {(showVP || showHotProd) && ' VP and Hot Prod are hidden in slot view — switch to '}
              {(showVP || showHotProd) && <em>All</em>}
              {(showVP || showHotProd) && ' to see them.'}
            </>
          )}
          {!isPlanSurface && showSpokeCols && spokes.length > 1 && (
            <>
              {' '}
              {spokeFilter === 'all'
                ? `All ${spokes.length} linked sites visible — pick one from the filter to focus.`
                : `Filtered to ${productionSiteLabel(spokeFilter) || ''} — clear the filter to see all linked sites.`}
            </>
          )}
          {' '}Tap a row for ingredients, prep, bench and VP math for that
          recipe.
        </p>
      </div>

      <RecipeFocusPanel
        siteId={siteId}
        date={date}
        itemId={focusedItemId}
        onClose={() => setFocusedItemId(null)}
      />
    </div>
  );
}

// ─── Category group + row ─────────────────────────────────────────────────────

type RowDataset = {
  line: PlanLine | null;
  recipe: ProductionRecipe;
  skuId: SkuId;
  itemId: ProductionItemId | null;
  hybridSource: 'make' | 'receive' | null;
};

type PlanStoreApi = ReturnType<typeof usePlanStore>;

/**
 * Compact summary card sitting above the recipe-first grid on hub view.
 * Headline number is the day's grand total (sum of every recipe's
 * planned qty) so the hub manager always has the "how big is today"
 * answer without scanning the table footer or scrolling to find it.
 * The supporting line shows the breadth of the day — how many recipe
 * lines and how many spokes the total covers.
 */
function HubMakeTotalChip({
  totalUnits,
  extrasUnits,
  recipeCount,
  spokeCount,
}: {
  totalUnits: number;
  /** Off-list extras already rolled into `totalUnits` — surfaced as a
   *  small "+N off-list" caption so the headline number's makeup is
   *  legible without scanning the table footer. */
  extrasUnits: number;
  recipeCount: number;
  spokeCount: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        marginBottom: 10,
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderLeft: '3px solid var(--color-info)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          background: 'var(--color-info-light)',
          color: 'var(--color-info)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Package size={18} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Total to make today
        </span>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 8,
            marginTop: 2,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--color-text-primary)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1,
            }}
          >
            {totalUnits.toLocaleString()}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            units
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>·</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            {recipeCount} recipe{recipeCount === 1 ? '' : 's'}
          </span>
          {spokeCount > 0 && (
            <>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {spokeCount} spoke{spokeCount === 1 ? '' : 's'}
              </span>
            </>
          )}
          {extrasUnits > 0 && (
            <>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>·</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--color-info)',
                  fontVariantNumeric: 'tabular-nums',
                }}
                title={`Includes ${extrasUnits} off-list extra${extrasUnits === 1 ? '' : 's'} (not on any spoke's order).`}
              >
                <PackagePlus size={11} />
                +{extrasUnits} off-list
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryGroup({
  category,
  rows,
  isPlanSurface,
  editableRuns,
  showCarryOver,
  pColIndices,
  pColumnCount,
  showProductionTotal,
  showVP,
  showHotProd,
  showSpokeCols,
  showExtras,
  showAvailNow,
  soldSoFarBySku,
  editableVP,
  spokes,
  perSpokeBySku,
  submittedSpokeIds,
  showRowTotal,
  isHybrid,
  siteId,
  date,
  planStore,
  editMode,
  setOverride,
  clearOverride,
  getOverride,
  getExtras,
  setExtras,
  clearExtras,
  focusedItemId,
  expandedHotProdId,
  colCount,
  hybridReceiveSlots,
  hybridReceiveEditable,
  onHybridSlotChange,
  onSelectRow,
  onToggleHotProd,
}: {
  category: ProductionRecipe['category'];
  rows: RowDataset[];
  isPlanSurface: boolean;
  editableRuns: boolean;
  showCarryOver: boolean;
  pColIndices: number[];
  pColumnCount: number;
  showProductionTotal: boolean;
  showVP: boolean;
  showHotProd: boolean;
  showSpokeCols: boolean;
  showExtras: boolean;
  showAvailNow: boolean;
  soldSoFarBySku: Map<SkuId, number>;
  editableVP: boolean;
  spokes: Site[];
  perSpokeBySku: Map<string, number>;
  submittedSpokeIds: Set<SiteId>;
  showRowTotal: boolean;
  isHybrid: boolean;
  siteId: SiteId;
  date: string;
  planStore: PlanStoreApi;
  editMode: boolean;
  setOverride: (
    hubId: SiteId,
    spokeId: SiteId,
    skuId: SkuId,
    forDate: string,
    units: number,
  ) => void;
  clearOverride: (
    hubId: SiteId,
    spokeId: SiteId,
    skuId: SkuId,
    forDate: string,
  ) => void;
  getOverride: (
    hubId: SiteId,
    spokeId: SiteId,
    skuId: SkuId,
    forDate: string,
  ) => number | undefined;
  getExtras: (hubId: SiteId, skuId: SkuId, forDate: string) => number;
  setExtras: (hubId: SiteId, skuId: SkuId, forDate: string, units: number) => void;
  clearExtras: (hubId: SiteId, skuId: SkuId, forDate: string) => void;
  focusedItemId: ProductionItemId | null;
  expandedHotProdId: ProductionItemId | null;
  colCount: number;
  /** HYBRID-only: per-slot units for each receive row, keyed by SKU.
   *  `null` outside the HYBRID Plan view (every row falls through to the
   *  read-only "—" placeholder). */
  hybridReceiveSlots: Record<SkuId, number[]> | null;
  hybridReceiveEditable: boolean;
  onHybridSlotChange: (skuId: SkuId, slotIndex: number, qty: number) => void;
  onSelectRow: (row: RowDataset) => void;
  onToggleHotProd: (row: RowDataset) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={colCount}
          style={{
            padding: '8px 12px',
            background: 'var(--color-bg-hover)',
            borderTop: '1px solid var(--color-border-subtle)',
            borderBottom: '1px solid var(--color-border-subtle)',
            position: 'sticky',
            left: 0,
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              marginRight: 8,
            }}
          >
            {category}
          </span>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
            {rows.length} recipe{rows.length === 1 ? '' : 's'}
          </span>
        </td>
      </tr>

      {rows.map(row => {
        const focused = row.itemId !== null && row.itemId === focusedItemId;
        const expanded = row.itemId !== null && row.itemId === expandedHotProdId;
        return (
          <RecipeRow
            key={row.skuId}
            row={row}
            isPlanSurface={isPlanSurface}
            editableRuns={editableRuns}
            showCarryOver={showCarryOver}
            pColIndices={pColIndices}
            pColumnCount={pColumnCount}
            showProductionTotal={showProductionTotal}
            showVP={showVP}
            showHotProd={showHotProd}
            showSpokeCols={showSpokeCols}
            showExtras={showExtras}
            showAvailNow={showAvailNow}
            soldSoFarBySku={soldSoFarBySku}
            editableVP={editableVP}
            spokes={spokes}
            perSpokeBySku={perSpokeBySku}
            submittedSpokeIds={submittedSpokeIds}
            showRowTotal={showRowTotal}
            isHybrid={isHybrid}
            siteId={siteId}
            date={date}
            planStore={planStore}
            editMode={editMode}
            setOverride={setOverride}
            clearOverride={clearOverride}
            getOverride={getOverride}
            getExtras={getExtras}
            setExtras={setExtras}
            clearExtras={clearExtras}
            focused={focused}
            hotProdExpanded={expanded}
            colCount={colCount}
            hybridReceiveSlots={hybridReceiveSlots?.[row.skuId] ?? null}
            hybridReceiveEditable={hybridReceiveEditable}
            onHybridSlotChange={onHybridSlotChange}
            onSelect={() => onSelectRow(row)}
            onToggleHotProd={() => onToggleHotProd(row)}
          />
        );
      })}
    </>
  );
}

function RecipeRow({
  row,
  isPlanSurface,
  editableRuns,
  showCarryOver,
  pColIndices,
  pColumnCount,
  showProductionTotal,
  showVP,
  showHotProd,
  showSpokeCols,
  showExtras,
  showAvailNow,
  soldSoFarBySku,
  editableVP,
  spokes,
  perSpokeBySku,
  submittedSpokeIds,
  showRowTotal,
  isHybrid,
  siteId,
  date,
  planStore,
  editMode,
  setOverride,
  clearOverride,
  getOverride,
  getExtras,
  setExtras,
  clearExtras,
  focused,
  hotProdExpanded,
  colCount,
  hybridReceiveSlots,
  hybridReceiveEditable,
  onHybridSlotChange,
  onSelect,
  onToggleHotProd,
}: {
  row: RowDataset;
  isPlanSurface: boolean;
  editableRuns: boolean;
  showCarryOver: boolean;
  pColIndices: number[];
  pColumnCount: number;
  showProductionTotal: boolean;
  showVP: boolean;
  showHotProd: boolean;
  showSpokeCols: boolean;
  showExtras: boolean;
  showAvailNow: boolean;
  soldSoFarBySku: Map<SkuId, number>;
  editableVP: boolean;
  spokes: Site[];
  perSpokeBySku: Map<string, number>;
  submittedSpokeIds: Set<SiteId>;
  showRowTotal: boolean;
  isHybrid: boolean;
  siteId: SiteId;
  date: string;
  planStore: PlanStoreApi;
  editMode: boolean;
  setOverride: (
    hubId: SiteId,
    spokeId: SiteId,
    skuId: SkuId,
    forDate: string,
    units: number,
  ) => void;
  clearOverride: (
    hubId: SiteId,
    spokeId: SiteId,
    skuId: SkuId,
    forDate: string,
  ) => void;
  getOverride: (
    hubId: SiteId,
    spokeId: SiteId,
    skuId: SkuId,
    forDate: string,
  ) => number | undefined;
  getExtras: (hubId: SiteId, skuId: SkuId, forDate: string) => number;
  setExtras: (hubId: SiteId, skuId: SkuId, forDate: string, units: number) => void;
  clearExtras: (hubId: SiteId, skuId: SkuId, forDate: string) => void;
  focused: boolean;
  hotProdExpanded: boolean;
  colCount: number;
  /** HYBRID receive rows only — per-slot units for this SKU. `null` for
   *  every other row (make rows on a HYBRID, every row on a non-HYBRID).
   *  Length is normalised to `pColumnCount`; consumers can index safely. */
  hybridReceiveSlots: number[] | null;
  /** Whether the receive steppers should be live (false once the order
   *  has been submitted to the hub). */
  hybridReceiveEditable: boolean;
  onHybridSlotChange: (skuId: SkuId, slotIndex: number, qty: number) => void;
  onSelect: () => void;
  onToggleHotProd: () => void;
}) {
  const carryOver = carryOverFor(siteId, row.skuId);
  const carriedUnits = carryOver?.carriedUnits ?? 0;
  const isReceive = isHybrid && row.hybridSource === 'receive';

  const line = row.line;
  // Per-run cells (P1..Pn) — only run-mode lines populate these.
  const perRun: number[] = line?.perRunPlan ?? [];
  // VP — for run-mode items, vp is the variableAdditions on top of run.
  // For variable-mode items, vp is the whole planned qty.
  const vpQty = line
    ? line.item.mode === 'variable'
      ? line.planned
      : line.variablePlanned
    : 0;
  // Hot Prod — increment-mode items only.
  const isHotProd = line?.item.mode === 'increment';
  const hotProdQty = isHotProd ? line.planned : 0;
  const perDropPlan = isHotProd ? line?.perDropPlan : undefined;

  // Plan-surface helpers — forecast values plus a guarded mutator that
  // always writes a fully-formed perRun array. Computed lazily; only
  // used when isPlanSurface. Steppers move in single-unit increments
  // even when the recipe has a batch `multipleOf` rule — planning is
  // the place to express demand in real units, and the bench-side
  // batching gets resolved when the plan flows into a run.
  const step = 1;
  const slotForecasts = isPlanSurface
    ? buildPerSlotForecast(line, pColumnCount)
    : [];
  const dayForecast = line?.forecast?.projectedUnits ?? 0;

  // Default per-slot split for a variable row before the manager has
  // edited any P-cell. Even split of `line.planned` across the grid's
  // P-column budget with the remainder pushed onto the last cell so
  // the visible numbers still sum to `planned` exactly. Empty if
  // there are no P-columns (the VP column alone covers planning).
  const variableDefaultPerSlot = useMemo<number[]>(() => {
    if (!line || line.item.mode !== 'variable' || pColumnCount <= 0) return [];
    const total = line.planned;
    const base = Math.floor(total / pColumnCount);
    const rem = total - base * pColumnCount;
    const arr = Array<number>(pColumnCount).fill(base);
    if (rem > 0 && arr.length > 0) arr[arr.length - 1] = base + rem;
    return arr;
  }, [line, pColumnCount]);

  // Extras — hub-side off-list units this row carries (manager-typed).
  // Lives in its own column AND lifts the row total. Stored separately
  // from `perSpokeBySku`, so a bump here never inflates any spoke
  // column. Always 0 outside hub today (the column is hidden).
  const extrasUnits = showExtras ? getExtras(siteId, row.skuId, date) : 0;

  // Team-food allocation — recipe-level "we're baking N more for
  // staff lunch". Lifts the bake target (and the row total) the same
  // way extras do, but stays out of every demand-aligned read so
  // sales / forecast comparisons never count team food as sold.
  const teamFoodUnits = line?.teamFoodPlanned ?? 0;

  // Total = customer-facing plan + any hub-side extras + team food.
  // For run items `line.planned` already includes the variable
  // additions; for variable / increment items it's the whole qty.
  // Receive rows (HYBRID receiving from hub) skip the column.
  const totalDisplay: string | number = isReceive
    ? '—'
    : (line ? line.planned : 0) + extrasUnits + teamFoodUnits;

  return (
    <>
      <tr
        onClick={onSelect}
        style={{
          cursor: row.itemId ? 'pointer' : 'default',
          background: focused ? 'var(--color-info-light)' : '#ffffff',
        }}
      >
        <td style={bodyStyle({ left: true, sticky: true, focused })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {row.recipe.name}
              </span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                {isHybrid && row.hybridSource && (
                  <StatusPill
                    tone={row.hybridSource === 'make' ? 'info' : 'neutral'}
                    label={row.hybridSource === 'make' ? 'Make' : 'Receive'}
                    size="xs"
                  />
                )}
                {line?.item.mode === 'variable' && (
                  <StatusPill tone="warning" label="VP" size="xs" />
                )}
                {isHotProd && <StatusPill tone="warning" label="Hot" size="xs" />}
                {!line && !isReceive && (
                  <StatusPill tone="neutral" label="Not planned" size="xs" />
                )}
                {/* Ingredient-shortfall chip — only fires when there's a
                    seeded constraint for this (hub, recipe, date). Two
                    states: warning outline while open, info outline once
                    the manager's accepted the pro-rata cut from the
                    drawer. The drawer hosts the full detail + the
                    Apply/Undo CTAs. */}
                <ShortfallRowChip
                  hubId={siteId}
                  recipeId={row.recipe.id}
                  forDate={date}
                />
              </div>
            </div>
            {row.itemId && (
              <ChevronRight
                size={14}
                style={{
                  flexShrink: 0,
                  color: 'var(--color-text-muted)',
                  opacity: focused ? 1 : 0.4,
                }}
              />
            )}
          </div>
        </td>

        {/* Carry-over (STANDALONE / HYBRID only — hubs have no retail
            case so the column is hidden upstream). */}
        {showCarryOver && (
          <td style={bodyStyle({ focused })}>
            {isReceive ? (
              <span style={{ color: 'var(--color-text-muted)' }}>—</span>
            ) : carriedUnits > 0 ? (
              <span
                style={{ color: 'var(--color-warning)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                title={carryOver?.reason}
              >
                −{carriedUnits}
              </span>
            ) : (
              <span style={{ color: 'var(--color-text-muted)' }}>0</span>
            )}
          </td>
        )}

        {/* Production total (All view) — sum of all P-slot quantities for
            run-mode items. Variable / Hot Prod / Receive rows show "—". */}
        {showProductionTotal && (
          <td style={bodyStyle({ focused })}>
            {isReceive ? (
              <span style={{ color: 'var(--color-text-muted)' }}>—</span>
            ) : line && line.item.mode === 'run' && line.runPlanned > 0 ? (
              <span style={numStyle()}>{line.runPlanned}</span>
            ) : (
              <span style={{ color: 'var(--color-text-muted)' }}>—</span>
            )}
          </td>
        )}

        {/* P-slot columns (only the ones the active view selected). When
            `editableRuns` is set — Plan surface always; Today only for a
            HUB the manager has opted into edit mode on — each cell
            becomes an inline stepper. Plan also overlays a ghost
            forecast number; Today edit mode skips the forecast (the
            day is already in flight, the dial just sets the bake). */}
        {pColIndices.map(i => {
          if (isReceive) {
            // HYBRID receive rows on the Plan view are now editable —
            // they're the manager's "I want N units in slot i" order to
            // the hub. Every other receive context (today / non-plan)
            // still falls back to the read-only "—" because there's
            // nothing to edit there.
            if (hybridReceiveSlots) {
              const value = hybridReceiveSlots[i] ?? 0;
              return (
                <td key={`p${i + 1}`} style={bodyStyle({ focused })}>
                  {hybridReceiveEditable ? (
                    <PlanStepperCell
                      value={value}
                      forecast={isPlanSurface ? slotForecasts[i] : undefined}
                      step={step}
                      onChange={next => onHybridSlotChange(row.skuId, i, next)}
                    />
                  ) : value > 0 ? (
                    <span
                      style={numStyle()}
                      title="Submitted to hub — re-open the day to edit"
                    >
                      {value}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                  )}
                </td>
              );
            }
            return (
              <td key={`p${i + 1}`} style={bodyStyle({ focused })}>
                <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              </td>
            );
          }
          if (editableRuns) {
            const isRunRow = !!line && line.item.mode === 'run';
            // VP rows piggyback on the run-mode P-slot grid so the
            // manager can plan "N units in slot 1, M units in slot 2…"
            // for a variable recipe sitting alongside run items. We
            // distribute `planned` evenly across the column budget for
            // the initial display; the first edit promotes that into a
            // persisted perRunOverrides array (same store, same key).
            const isVariableRow = !!line && line.item.mode === 'variable';
            if (isRunRow || isVariableRow) {
              const stored = perRun;
              const hasStored = stored.length > 0;
              const displaySlots = hasStored
                ? stored
                : isVariableRow && pColumnCount > 0 && line
                  ? variableDefaultPerSlot
                  : [];
              return (
                <td key={`p${i + 1}`} style={bodyStyle({ focused })}>
                  <PlanStepperCell
                    value={displaySlots[i] ?? 0}
                    forecast={isPlanSurface ? slotForecasts[i] : undefined}
                    step={step}
                    onChange={next => {
                      if (!line) return;
                      const seed = hasStored ? stored : displaySlots;
                      const padded = Array.from(
                        { length: pColumnCount },
                        (_, j) => seed[j] ?? 0,
                      );
                      padded[i] = Math.max(0, Math.round(next));
                      planStore.setPerRunPlan(line.item.id, padded, date);
                    }}
                  />
                </td>
              );
            }
            return (
              <td key={`p${i + 1}`} style={bodyStyle({ focused })}>
                <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              </td>
            );
          }
          return (
            <td key={`p${i + 1}`} style={bodyStyle({ focused })}>
              {perRun[i] != null && perRun[i] > 0 ? (
                <span style={numStyle()}>{perRun[i]}</span>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              )}
            </td>
          );
        })}

        {/* VP — today-only column for self-producing sites. The floor
            adjusts variable production through the day, so this cell
            is an inline stepper (variable rows step the whole-day
            planned qty; run rows step the variable add-on on top of
            the run baseline). Plan hides the column upstream because
            variable rows already have per-slot steppers in P1..Pn. */}
        {showVP && (
          <td style={bodyStyle({ focused })}>
            {isReceive ? (
              <span style={{ color: 'var(--color-text-muted)' }}>—</span>
            ) : editableVP && line && line.item.mode === 'variable' ? (
              <PlanStepperCell
                value={line.planned}
                // Forecast under the VP stepper — placeholder for now;
                // proper "VP forecast" logic (forecast minus what's
                // already covered by run plan / carry-over) lands in a
                // later slice. Using the day projection keeps the
                // signal honest at a glance.
                forecast={dayForecast > 0 ? dayForecast : undefined}
                step={step}
                onChange={next => planStore.setPlanned(line.item.id, next, date)}
              />
            ) : editableVP && line && line.item.mode === 'run' ? (
              <PlanStepperCell
                value={line.variablePlanned}
                // Same placeholder treatment as the variable-mode cell —
                // wire the day forecast through so the floor sees a
                // reference number under the VP top-up. Real logic
                // (forecast − run plan − carry-over) to follow.
                forecast={dayForecast > 0 ? dayForecast : undefined}
                step={step}
                onChange={next => planStore.setVariablePlan(line.item.id, next, date)}
              />
            ) : vpQty > 0 ? (
              <span style={numStyle()}>{vpQty}</span>
            ) : (
              <span style={{ color: 'var(--color-text-muted)' }}>—</span>
            )}
          </td>
        )}

        {/* Hot Prod */}
        {showHotProd && (
          <td style={bodyStyle({ focused })}>
            {isReceive ? (
              <span style={{ color: 'var(--color-text-muted)' }}>—</span>
            ) : isHotProd ? (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onToggleHotProd();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--color-warning-border)',
                  background: hotProdExpanded ? 'var(--color-warning-light)' : '#ffffff',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--color-warning)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
                title={hotProdExpanded ? 'Hide drops' : 'Show 30-min drops for this recipe'}
              >
                {hotProdQty}
                {hotProdExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </button>
            ) : (
              <span style={{ color: 'var(--color-text-muted)' }}>—</span>
            )}
          </td>
        )}

        {/* On-demand column retired — variable items live in VP,
            increment items in the Hot Prod per-drop strip. */}

        {/* Per-spoke columns (HUB). Edit mode flips the cell from a
            read-only number to a stepper the hub manager can override
            directly — distinct from unlock (which delegates back to the
            spoke). An override is shown with a coloured outline + a
            small "reset" affordance so manual overrides are easy to
            spot and undo. */}
        {showSpokeCols &&
          spokes.map(sp => {
            const submitted = submittedSpokeIds.has(sp.id);
            const qty = perSpokeBySku.get(`${sp.id}|${row.skuId}`) ?? 0;
            const override = getOverride(siteId, sp.id, row.skuId, date);
            const hasOverride = override !== undefined;
            return (
              <td key={sp.id} style={bodyStyle({ focused })}>
                {editMode ? (
                  <SpokeOverrideCell
                    value={qty}
                    hasOverride={hasOverride}
                    onChange={next => setOverride(siteId, sp.id, row.skuId, date, next)}
                    onReset={() => clearOverride(siteId, sp.id, row.skuId, date)}
                  />
                ) : !submitted ? (
                  // Spoke hasn't placed an order yet — don't drop a stale
                  // Quinn proposal into the cell. The header countdown
                  // tells the manager when (and whether) to expect one.
                  <span
                    style={{ color: 'var(--color-text-muted)', fontSize: 11 }}
                    title="Waiting on the spoke to submit"
                  >
                    —
                  </span>
                ) : qty > 0 ? (
                  <span
                    style={{
                      ...numStyle(),
                      ...(hasOverride
                        ? { color: 'var(--color-warning)', fontWeight: 700 }
                        : null),
                    }}
                    title={
                      hasOverride
                        ? 'Hub override — replaces the spoke\u2019s submitted number'
                        : undefined
                    }
                  >
                    {qty}
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                )}
              </td>
            );
          })}

        {/* Extras — hub-side off-list units. Editable inline stepper.
            Lives outside `perSpokeBySku` so a bump never inflates any
            spoke's column; lifts the row total + day's make total. */}
        {showExtras && (
          <td style={bodyStyle({ focused })}>
            <ExtrasCell
              value={extrasUnits}
              onChange={next => setExtras(siteId, row.skuId, date, next)}
              onReset={() => clearExtras(siteId, row.skuId, date)}
            />
          </td>
        )}

        {/* Avail now — what's still on the floor: planned − sold so far,
            clamped at zero. Self-producing sites only (a hub or pure
            spoke has no retail floor). For HYBRID receive rows we
            don't have a planned figure at this site, so we show "—".
            Sold count is shown as a faded sub-line so the manager can
            still see velocity at a glance without flipping screens. */}
        {showAvailNow && (
          <td style={bodyStyle({ focused })}>
            {isReceive || !line ? (
              <span style={{ color: 'var(--color-text-muted)' }}>—</span>
            ) : (
              (() => {
                const sold = soldSoFarBySku.get(row.skuId) ?? 0;
                const planned = typeof totalDisplay === 'number' ? totalDisplay : 0;
                const availNow = Math.max(0, planned - sold);
                const soldOut = planned > 0 && availNow === 0;
                return (
                  <span
                    style={{
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      lineHeight: 1.15,
                    }}
                    title={
                      planned > 0
                        ? `${availNow} available · ${sold} sold of ${planned} planned`
                        : `${sold} sold today`
                    }
                  >
                    <span
                      style={{
                        ...numStyle(),
                        color: soldOut
                          ? 'var(--color-error)'
                          : availNow === 0
                            ? 'var(--color-text-muted)'
                            : 'var(--color-text-primary)',
                        fontWeight: 700,
                      }}
                    >
                      {availNow}
                    </span>
                    {planned > 0 && (
                      <span
                        style={{
                          fontSize: 9,
                          color: 'var(--color-text-muted)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        of {planned}
                      </span>
                    )}
                  </span>
                );
              })()
            )}
          </td>
        )}

        {/* Total — hidden on HUB (the hub doesn't bake for itself, so
            the row total just duplicates the per-spoke breakdown). Kept
            for self-producing sites where it's the day's commitment. */}
        {showRowTotal && (
          <td style={bodyStyle({ focused, totalCol: true })}>
            {isReceive ? (
              hybridReceiveSlots ? (
                // Live row total of the receive order. Mirrors the make-row
                // total typography so the eye reads down the column without
                // a tonal jump; the inline icon keeps the "from hub" framing.
                (() => {
                  const total = sumSlots(hybridReceiveSlots);
                  return (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        ...numStyle(),
                        fontWeight: 800,
                      }}
                      title={`Receive order total · ${total} units from hub`}
                    >
                      <Inbox size={11} color="var(--color-text-muted)" />
                      {total}
                    </span>
                  );
                })()
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: 'var(--color-text-muted)',
                    fontSize: 11,
                  }}
                  title="Comes in from the hub — no local production"
                >
                  <Inbox size={11} /> via hub
                </span>
              )
            ) : extrasUnits > 0 || teamFoodUnits > 0 ? (
              // Stacked total: the (now-inflated) row total on top, with
              // muted breakdown chips below so the manager can see at a
              // glance how many of those units are extras vs team food
              // vs the customer-facing plan.
              <span
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  lineHeight: 1.15,
                }}
                title={[
                  `${totalDisplay} total`,
                  `${line ? line.planned : 0} for spokes`,
                  extrasUnits > 0
                    ? `${extrasUnits} extra${extrasUnits === 1 ? '' : 's'}`
                    : null,
                  teamFoodUnits > 0
                    ? `${teamFoodUnits} team food (not sold)`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              >
                <span style={{ ...numStyle(), fontWeight: 800 }}>
                  {totalDisplay}
                </span>
                {extrasUnits > 0 && (
                  <span
                    style={{
                      fontSize: 9,
                      color: 'var(--color-info)',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 700,
                    }}
                  >
                    +{extrasUnits} extra
                  </span>
                )}
                {teamFoodUnits > 0 && (
                  <span
                    style={{
                      fontSize: 9,
                      color: 'var(--color-info)',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <UtensilsCrossed size={9} />+{teamFoodUnits} team
                  </span>
                )}
              </span>
            ) : (
              <span style={{ ...numStyle(), fontWeight: 800 }}>
                {totalDisplay}
              </span>
            )}
          </td>
        )}
      </tr>

      {/* Hot Prod expansion — inline 30-min slot strip for THIS recipe only.
          B3 of the plan: "borrows the live Edify Hot Production layout but
          narrowed to a single recipe's view." */}
      {showHotProd && hotProdExpanded && isHotProd && perDropPlan && line?.item.cadence && (
        <tr>
          <td colSpan={colCount} style={{ padding: 0, background: 'var(--color-warning-light)' }}>
            <HotProdDrops
              recipeName={row.recipe.name}
              perDropPlan={perDropPlan}
              cadence={line.item.cadence}
              total={hotProdQty}
              forecastTotal={line.forecast?.projectedUnits ?? 0}
              forecastByPhase={line.forecast?.byPhase}
              // Only pin a "now" cell when the row is showing today's
              // plan — for past or future days the cadence is a draft
              // and the wall clock is irrelevant. The pin advances
              // automatically as `DEMO_NOW_HHMM` ticks through the
              // cadence (it's a constant for now, but a future iteration
              // can make it live-clock driven without changing the
              // rendering contract).
              nowHHMM={date === DEMO_TODAY ? DEMO_NOW_HHMM : undefined}
              onChangeDrop={(idx, next) => {
                const updated = perDropPlan.slice();
                updated[idx] = Math.max(0, Math.round(next));
                planStore.setPerDropPlan(line.item.id, updated, date);
              }}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Plan-surface stepper cell ────────────────────────────────────────────────

/**
 * Editable cell used inside the plan-surface grid. Shows a compact
 * `QtyStepper` with the current planned value and a small ghost
 * forecast number directly below.
 *
 * The forecast is intentionally low-contrast — it's a hint, not a
 * commitment — so the manager can see Quinn's number at a glance
 * without it competing with the value they're editing.
 */
// ─── Hub edit-mode controls ──────────────────────────────────────────────────

/**
 * Toolbar action button for hub-side per-spoke editing. Sits next to the
 * view-mode tabs / spoke filter on HUB grids. Click to enter edit mode
 * (per-spoke cells become steppers); click again — now labelled "Done"
 * — to exit. The optional badge surfaces how many overrides are active
 * so a manager can see at a glance that they've taken manual control.
 *
 * Distinct from unlock: this is the hub overwriting the spoke's number,
 * not asking the spoke to add. Two different intents → two different
 * controls.
 *
 * Locked state: when no spoke is selected from the filter (`locked`
 * true), the button is disabled and shows a custom error tooltip on
 * hover explaining the rule. We render a custom tooltip rather than
 * relying on `title` because the message is the only feedback the
 * manager gets when they try to act, so it needs to look like an
 * error and be readable at a glance.
 */
function EditHubPlanButton({
  editMode,
  overrideCount,
  locked,
  onEnter,
  onDone,
}: {
  editMode: boolean;
  overrideCount: number;
  locked: boolean;
  onEnter: () => void;
  onDone: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  if (editMode) {
    return (
      <button
        type="button"
        onClick={onDone}
        title="Finish editing per-spoke amounts"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
          background: 'var(--color-accent-active)',
          color: 'var(--color-text-on-active)',
          border: '1px solid var(--color-accent-active)',
          cursor: 'pointer',
          letterSpacing: '0.01em',
          marginLeft: 'auto',
        }}
      >
        <Check size={13} />
        Done
        {overrideCount > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.25)',
            }}
          >
            {overrideCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      style={{ position: 'relative', marginLeft: 'auto' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={locked ? undefined : onEnter}
        disabled={locked}
        aria-disabled={locked}
        aria-describedby={locked ? 'edit-hub-plan-error' : undefined}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          background: locked ? 'var(--color-bg-hover)' : '#ffffff',
          color: locked ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
          border: locked
            ? '1px solid var(--color-error-border, var(--color-border))'
            : '1px solid var(--color-border)',
          cursor: locked ? 'not-allowed' : 'pointer',
          letterSpacing: '0.01em',
          opacity: locked ? 0.85 : 1,
        }}
      >
        <Pencil size={12} />
        Edit
        {overrideCount > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'var(--color-warning-bg)',
              color: 'var(--color-warning)',
            }}
            title={`${overrideCount} override${overrideCount === 1 ? '' : 's'} active`}
          >
            {overrideCount}
          </span>
        )}
      </button>

      {locked && hovered && (
        <div
          id="edit-hub-plan-error"
          role="tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 50,
            minWidth: 240,
            maxWidth: 280,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'var(--color-error)',
            color: '#ffffff',
            fontSize: 11,
            lineHeight: 1.4,
            fontFamily: 'var(--font-primary)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>Pick a site first</div>
          <div style={{ opacity: 0.95 }}>
            Editing the hub plan is one site at a time. Use the site
            filter to choose which spoke you want to edit.
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * In-cell stepper used by the per-spoke columns when the hub grid is in
 * edit mode. Highlights overridden values (warning palette + reset
 * affordance) so a manager can spot — and undo — manual overrides at a
 * glance. Click bubbling is stopped so editing never opens the focus
 * drawer.
 */
function SpokeOverrideCell({
  value,
  hasOverride,
  onChange,
  onReset,
}: {
  value: number;
  hasOverride: boolean;
  onChange: (next: number) => void;
  onReset: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
      }}
      onClick={e => e.stopPropagation()}
    >
      <QtyStepper
        size="compact"
        canDecrement={value > 0}
        onDecrement={() => onChange(Math.max(0, value - 1))}
        onIncrement={() => onChange(value + 1)}
        decrementLabel="Decrease spoke amount"
        incrementLabel="Increase spoke amount"
      >
        <input
          type="number"
          value={value}
          onChange={e => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) onChange(Math.max(0, Math.round(next)));
          }}
          min={0}
          step={1}
          style={{
            width: 36,
            border: 'none',
            background: 'transparent',
            fontSize: 13,
            fontWeight: 700,
            textAlign: 'center',
            color: hasOverride ? 'var(--color-warning)' : 'var(--color-text-primary)',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'var(--font-primary)',
            outline: 'none',
            padding: 0,
            MozAppearance: 'textfield',
          }}
        />
      </QtyStepper>
      {hasOverride ? (
        <button
          type="button"
          onClick={onReset}
          title="Reset to the spoke\u2019s submitted amount"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '1px 4px',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-warning)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <RotateCcw size={9} />
          override
        </button>
      ) : (
        <span style={{ height: 12 }} aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * Inline stepper for the hub-side Extras column. Visually distinct from
 * `SpokeOverrideCell` because the semantics are different: an override
 * replaces a spoke's number (warning tone), whereas extras are additive
 * units that never touch a spoke's column (info tone).
 *
 * The "+N" label below the stepper appears once a value is set, so a
 * row that's been bumped reads at a glance even when the manager is
 * scanning down the column. A reset button only surfaces when the
 * value > 0 — keeps the empty state quiet.
 */
function ExtrasCell({
  value,
  onChange,
  onReset,
}: {
  value: number;
  onChange: (next: number) => void;
  onReset: () => void;
}) {
  const hasValue = value > 0;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
      }}
      onClick={e => e.stopPropagation()}
    >
      <QtyStepper
        size="compact"
        canDecrement={value > 0}
        onDecrement={() => onChange(Math.max(0, value - 1))}
        onIncrement={() => onChange(value + 1)}
        decrementLabel="Decrease extras"
        incrementLabel="Increase extras"
      >
        <input
          type="number"
          value={value}
          onChange={e => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) onChange(Math.max(0, Math.round(next)));
          }}
          min={0}
          step={1}
          style={{
            width: 36,
            border: 'none',
            background: 'transparent',
            fontSize: 13,
            fontWeight: 700,
            textAlign: 'center',
            color: hasValue ? 'var(--color-info)' : 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'var(--font-primary)',
            outline: 'none',
            padding: 0,
            MozAppearance: 'textfield',
          }}
        />
      </QtyStepper>
      {hasValue ? (
        <button
          type="button"
          onClick={onReset}
          title="Clear extras for this row"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '1px 4px',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-info)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <RotateCcw size={9} />
          clear
        </button>
      ) : (
        <span style={{ height: 12 }} aria-hidden="true" />
      )}
    </div>
  );
}

// ─── Spoke submission status pill (hub view header) ─────────────────────────

/**
 * Sits under each spoke's name in the hub recipe-first grid header.
 * Surfaces three orthogonal facts the hub manager actually cares about
 * before they look at numbers:
 *
 *  1. Has the spoke submitted? `submitted` / `acknowledged` /
 *     `modified-by-hub` / `auto-finalised` are all "yes". `draft` (or
 *     no submission record at all) is "not yet".
 *  2. If not submitted, how long until they have to? Live-ish countdown
 *     down to the cutoff datetime. Once cutoff passes the message
 *     flips to a hard "missed cutoff" state so it can't be missed.
 *  3. (Hub override actions are still owned by `SpokeUnlockControl`,
 *     which sits below this pill — they speak to a different problem
 *     and shouldn't crowd this status read.)
 *
 * The pill ticks every 30s while a draft is pending so the countdown
 * doesn't lie (and so the pre/past cutoff transition flips on its own).
 */
function SpokeSubmissionStatus({
  submission,
  cutoffISO,
  cutoffPassed,
  dispatched = false,
}: {
  submission: SpokeSubmission | undefined;
  /** Implied cutoff datetime — derived from the hub config when no
   *  submission record exists yet, so the countdown still has something
   *  to count against. */
  cutoffISO: string;
  cutoffPassed: boolean;
  /** True once the hub has actually dispatched the spoke's order
   *  (i.e. a transfer record exists for the date). Promotes the
   *  pill copy from "Submitted" → "Sent" so the manager can tell
   *  at a glance whether the order is just locked-in vs already on
   *  its way / delivered. Pill colour stays the same — both states
   *  are healthy, this is a progression within the success lane. */
  dispatched?: boolean;
}) {
  // Tick once every 30s while a countdown is showing so the time-left
  // text re-evaluates without a parent re-render. Active for both
  // draft submissions and "not started" states (any pre-cutoff state
  // that isn't already submitted).
  const submitted = !!submission && submission.status !== 'draft';
  const isCountingDown = !submitted && !cutoffPassed;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isCountingDown) return;
    const id = window.setInterval(() => setTick(t => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, [isCountingDown]);

  // PAC138 — auto-finalised submissions get their own pill so the hub
  // can tell at a glance which spokes the system committed for. Sits
  // ahead of the regular `submitted` branch because Quinn-on-behalf
  // shouldn't read the same as a manually-submitted order.
  if (submission && submission.status === 'auto-finalised') {
    const sent = dispatched;
    const lineCount = submission.lines.length;
    return (
      <span
        title={
          sent
            ? `Sent — Quinn auto-finalised this spoke's order (${lineCount} line${lineCount === 1 ? '' : 's'}) at the ${formatCutoffClock(submission.cutoffDateTime)} cutoff and the hub has since dispatched it.`
            : `Auto-finalised — the spoke didn't submit before ${formatCutoffClock(submission.cutoffDateTime)}, so Quinn committed the baseline (${lineCount} line${lineCount === 1 ? '' : 's'}) on their behalf. Use Unlock to reopen for the spoke if it's needed.`
        }
        style={pillStyle('auto')}
      >
        <Sparkles size={9} />
        {sent ? 'Sent (auto)' : 'Auto-finalised'}
      </span>
    );
  }

  if (submitted) {
    const sent = dispatched;
    return (
      <span
        title={
          sent
            ? `Sent — order dispatched to the spoke. Locked at ${formatCutoffClock(submission.cutoffDateTime)}.`
            : `Submitted (${submission.status}) — locked at ${formatCutoffClock(submission.cutoffDateTime)}.`
        }
        style={pillStyle('submitted')}
      >
        <Check size={9} />
        {sent ? 'Sent' : 'Submitted'}
      </span>
    );
  }

  if (cutoffPassed) {
    // Reached only when there's no submission record at all — auto-
    // finalisation requires a linked receiver row to anchor against,
    // so the grid populates one upstream and this branch is now
    // effectively a defensive fallback (e.g. a non-receiver site
    // accidentally rendered as a spoke column).
    return (
      <span
        title={`Cutoff passed (${formatCutoffClock(cutoffISO)}) and no submission was sent — the hub won't be ordering for this spoke today. Use Unlock to reopen the order if it's needed.`}
        style={pillStyle('missed')}
      >
        <AlertCircle size={9} />
        No order
      </span>
    );
  }

  // Pre-cutoff and not yet submitted — show a live countdown. Two
  // sub-states share the same visual:
  //   • a draft sitting on the spoke side (they've started but
  //     haven't sent)
  //   • no record at all (they haven't even opened tomorrow's order)
  // Hover copy is what differentiates them — both pills count down
  // to the same cutoff so the hub manager sees the time-pressure at a
  // glance regardless of why it's outstanding.
  const msLeft = new Date(cutoffISO).getTime() - Date.now();
  const tooltip =
    submission && submission.status === 'draft'
      ? `Spoke has a draft started but hasn't submitted. Cutoff at ${formatCutoffClock(cutoffISO)}.`
      : `Spoke hasn't started a draft for this date yet. Cutoff at ${formatCutoffClock(cutoffISO)}.`;
  const label =
    submission && submission.status === 'draft' ? 'Drafting' : 'Not started';

  return (
    <span title={tooltip} style={pillStyle('pending')}>
      <Clock size={9} />
      <span>{label} · {formatTimeLeft(msLeft)}</span>
    </span>
  );
}

function pillStyle(
  variant: 'submitted' | 'pending' | 'missed' | 'auto',
): React.CSSProperties {
  const palette = {
    submitted: {
      bg: 'var(--color-success-light, #e6f6ec)',
      fg: 'var(--color-success, #1f8a4c)',
      border: 'var(--color-success-border, #b5dfc3)',
    },
    pending: {
      bg: 'var(--color-info-light, #eaf2ff)',
      fg: 'var(--color-info, #2156d4)',
      border: 'var(--color-info-border, #c5d6f6)',
    },
    missed: {
      bg: 'var(--color-error-light, #fdecec)',
      fg: 'var(--color-error, #c62b2b)',
      border: 'var(--color-error-border, #f0c2c2)',
    },
    // PAC138 — distinct visual for system-committed orders so the hub
    // manager can tell auto-finalised columns apart from
    // manually-submitted ones at a glance. Warning palette reads as
    // "look at me, you might want to check these numbers" without
    // implying error.
    auto: {
      bg: 'var(--color-warning-light, #fff4dc)',
      fg: 'var(--color-warning, #a16400)',
      border: 'var(--color-warning-border, #f0d496)',
    },
  }[variant];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    background: palette.bg,
    color: palette.fg,
    border: `1px solid ${palette.border}`,
    fontFamily: 'var(--font-primary)',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    cursor: 'help',
  };
}

/** Compact "1d 4h" / "3h 12m" / "14m" formatting for cutoff countdowns. */
function formatTimeLeft(ms: number): string {
  if (ms <= 0) return '—';
  const totalMins = Math.floor(ms / 60_000);
  const days = Math.floor(totalMins / (24 * 60));
  const hoursLeft = Math.floor((totalMins % (24 * 60)) / 60);
  const mins = totalMins % 60;
  if (days > 0) return `${days}d ${hoursLeft}h`;
  if (hoursLeft > 0) return `${hoursLeft}h ${mins}m`;
  return `${mins}m`;
}

function formatCutoffClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PlanStepperCell({
  value,
  forecast,
  step,
  onChange,
}: {
  value: number;
  forecast: number | undefined;
  step: number;
  onChange: (next: number) => void;
}) {
  const safeStep = Math.max(1, step || 1);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
      // The grid row underneath is clickable (opens the focus panel).
      // Block propagation so tapping the stepper buttons or input
      // doesn't also open the drawer.
      onClick={e => e.stopPropagation()}
    >
      <QtyStepper
        size="compact"
        canDecrement={value > 0}
        onDecrement={() => onChange(Math.max(0, value - safeStep))}
        onIncrement={() => onChange(value + safeStep)}
        decrementLabel="Decrease planned units"
        incrementLabel="Increase planned units"
      >
        <input
          type="number"
          value={value}
          onChange={e => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) onChange(Math.max(0, Math.round(next)));
          }}
          min={0}
          step={safeStep}
          style={{
            width: 36,
            border: 'none',
            background: 'transparent',
            fontSize: 13,
            fontWeight: 700,
            textAlign: 'center',
            color: 'var(--color-text-primary)',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'var(--font-primary)',
            outline: 'none',
            padding: 0,
            // Hide the native spinners — we have our own +/− buttons.
            MozAppearance: 'textfield',
          }}
        />
      </QtyStepper>
      {forecast != null && forecast > 0 ? (
        <span
          title="Edify forecast"
          style={{
            fontSize: 10,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--color-text-muted)',
            letterSpacing: '0.02em',
          }}
        >
          fc {forecast}
        </span>
      ) : (
        <span style={{ fontSize: 10, color: 'transparent' }}>·</span>
      )}
    </div>
  );
}

/**
 * Split the day's forecast across the visible P-slot columns.
 *
 * We use `byPhase` (morning / midday / afternoon) as the source of
 * truth when it's available — that's already the way live Edify
 * thinks about a day's demand curve. For slot counts we don't have
 * a perfect mapping for, we fall back to an even split.
 */
function buildPerSlotForecast(
  line: PlanLine | null,
  pColumnCount: number,
): number[] {
  if (!line || pColumnCount === 0) return [];
  const total = line.forecast?.projectedUnits ?? 0;
  const phase = line.forecast?.byPhase;

  if (pColumnCount === 1) return [total];
  if (phase) {
    if (pColumnCount === 2) return [phase.morning, phase.midday + phase.afternoon];
    if (pColumnCount === 3) return [phase.morning, phase.midday, phase.afternoon];
    if (pColumnCount === 4) {
      const half = Math.round(phase.midday / 2);
      return [phase.morning, half, phase.midday - half, phase.afternoon];
    }
  }

  const per = Math.floor(total / pColumnCount);
  return Array.from({ length: pColumnCount }, (_, i) =>
    i === pColumnCount - 1 ? total - per * (pColumnCount - 1) : per,
  );
}

// ─── Hot Prod expansion strip ──────────────────────────────────────────────────

function HotProdDrops({
  recipeName,
  perDropPlan,
  cadence,
  total,
  forecastTotal,
  forecastByPhase,
  nowHHMM,
  onChangeDrop,
}: {
  recipeName: string;
  perDropPlan: number[];
  cadence: { intervalMinutes: number; startTime: string; endTime: string };
  total: number;
  forecastTotal: number;
  forecastByPhase?: { morning: number; midday: number; afternoon: number };
  /** Synthetic wall-clock for the demo. When provided, drives the
   *  pinned On-demand cell at the front of the strip so the manager
   *  can see the active drop without scanning the cadence. Omit on
   *  past or future days — the pin only makes sense for "today". */
  nowHHMM?: string;
  onChangeDrop?: (index: number, next: number) => void;
}) {
  const editable = !!onChangeDrop;
  const forecastPerDrop = useMemo(
    () => buildForecastPerDrop(perDropPlan.length, cadence, forecastTotal, forecastByPhase),
    [perDropPlan.length, cadence, forecastTotal, forecastByPhase],
  );

  const slots = perDropPlan.map((qty, i) => {
    const startMins = parseHHMM(cadence.startTime) + i * cadence.intervalMinutes;
    const endMins = startMins + cadence.intervalMinutes;
    const forecast = forecastPerDrop[i] ?? 0;
    // Coverage caption — how long this drop's planned quantity will
    // hold the floor at the forecast rate. Forecast rate (units/min)
    // = `forecast / intervalMinutes`, so coverage duration =
    // `qty / rate = qty * interval / forecast`. We start the clock
    // at the END of the drop window (product is ready when the bake
    // finishes — the drop window itself is bake time, not selling
    // time). Returns null when there's nothing to project against
    // (no qty, or no demand) — caption is suppressed in that case
    // so we don't pretend a 0/0 ratio is meaningful.
    const coverageEndMins =
      qty > 0 && forecast > 0
        ? endMins + Math.round((qty * cadence.intervalMinutes) / forecast)
        : null;
    return {
      startMins,
      endMins,
      label: `${formatHHMM(startMins)}–${formatHHMM(endMins)}`,
      // Range starts at the drop's end (product ready) and runs to
      // the projected sell-out. Lets the eye scan a column and see
      // immediately whether the bake covers just its own drop, runs
      // past into later slots (over-bake), or falls short (shortage).
      coverageLabel:
        coverageEndMins !== null
          ? `${formatHHMM(endMins)}–${formatHHMM(coverageEndMins)}`
          : null,
      qty,
      forecast,
    };
  });

  // ── On-demand "now" pin ──
  // Locate the cadence slot that the wall clock currently falls into
  // so the strip can pin a duplicated, distinctly-styled cell at the
  // front. Three states surface different copy + behaviour:
  //   - 'pre'  → before the first drop. Pin previews the first slot,
  //              labelled "Up next" so it isn't mistaken for active.
  //   - 'in'   → mid-cadence. Pin mirrors the active drop's qty +
  //              forecast and is labelled NOW; the same drop in the
  //              cadence list gets a thicker accent border so the
  //              eye can join the two.
  //   - 'post' → cadence finished. Pin shows the last drop's qty
  //              for reference, labelled DONE so the manager doesn't
  //              read it as "needs baking now".
  // When `nowHHMM` is undefined (looking at a future or past day),
  // none of this fires and the original strip renders unchanged.
  const nowMins = nowHHMM ? parseHHMM(nowHHMM) : null;
  const cadenceStartMins = parseHHMM(cadence.startTime);
  const cadenceEndMins = parseHHMM(cadence.endTime);
  let activeStatus: 'pre' | 'in' | 'post' | null = null;
  let activeIndex: number | null = null;
  if (nowMins !== null && perDropPlan.length > 0) {
    if (nowMins < cadenceStartMins) {
      activeStatus = 'pre';
      activeIndex = 0;
    } else if (nowMins >= cadenceEndMins) {
      activeStatus = 'post';
      activeIndex = perDropPlan.length - 1;
    } else {
      activeStatus = 'in';
      const idx = Math.floor((nowMins - cadenceStartMins) / cadence.intervalMinutes);
      activeIndex = Math.max(0, Math.min(perDropPlan.length - 1, idx));
    }
  }
  const activeSlot = activeIndex !== null ? slots[activeIndex] : null;

  return (
    <div style={{ padding: '12px 18px 16px', borderLeft: '3px solid var(--color-warning)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
          fontSize: 11,
          color: 'var(--color-text-muted)',
        }}
      >
        <strong style={{ color: 'var(--color-text-primary)' }}>{recipeName}</strong>
        <span>·</span>
        <span>
          {slots.length} drops · {total} units
          {forecastTotal > 0 && (
            <span style={{ marginLeft: 4, color: 'var(--color-text-muted)' }}>
              (fc {forecastTotal})
            </span>
          )}
        </span>
        <span>·</span>
        <span>{cadence.intervalMinutes}-min cadence</span>
      </div>
      {/* Strip = optional On-demand pin on the left + cadence grid on
          the right. We use a flex row (instead of folding the pin
          into the same grid) so the pin's width is independent of
          the cadence cells and a vertical divider can sit between
          them, making the "front of the strip" reading explicit. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 10,
        }}
      >
        {activeSlot && activeStatus && (
          <NowPinCell
            slot={activeSlot}
            status={activeStatus}
            nowHHMM={nowHHMM ?? ''}
            // Only the live ('in') drop is editable from the pin —
            // the 'up next' and 'done' states stay read-only because
            // the manager can scroll to those drops in the cadence
            // grid if they want to edit them. The pin's stepper is
            // explicitly an "add more units NOW" affordance.
            onAddNow={
              editable && activeStatus === 'in' && activeIndex !== null
                ? next => onChangeDrop!(activeIndex, next)
                : undefined
            }
          />
        )}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: 6,
          }}
        >
          {slots.map((s, i) => {
            const isActive = i === activeIndex && activeStatus === 'in';
            const isPast = activeStatus !== null && activeIndex !== null && i < activeIndex;
            // 'in' = currently being baked → accent border so the eye
            //   joins it to the pin; subtle background fill keeps the
            //   highlight from competing with the pin's own emphasis.
            // 'past' = cadence-position-already-elapsed → muted opacity
            //   so the manager's eye glides over the historical drops
            //   towards the live ones. Past drops are still readable
            //   on hover (opacity 0.55 rather than fully ghosted).
            return (
              <div
                key={i}
                style={{
                  padding: '6px 8px',
                  border: `1px solid ${
                    isActive ? 'var(--color-warning)' : 'var(--color-warning-border)'
                  }`,
                  boxShadow: isActive
                    ? '0 0 0 2px rgba(217, 119, 6, 0.18)'
                    : 'none',
                  borderRadius: 6,
                  background: isActive ? 'var(--color-warning-light)' : '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  opacity: isPast ? 0.55 : 1,
                  transition: 'opacity 0.15s, box-shadow 0.15s',
                }}
                onClick={e => e.stopPropagation()}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontVariantNumeric: 'tabular-nums',
                    alignSelf: 'flex-start',
                  }}
                >
                  {s.label}
                </span>
                {editable ? (
                  <PlanStepperCell
                    value={s.qty}
                    forecast={s.forecast}
                    step={1}
                    onChange={next => onChangeDrop!(i, next)}
                  />
                ) : (
                  <>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {s.qty}
                    </span>
                    {s.forecast > 0 && (
                      <span
                        title="Edify forecast for this slot"
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--color-text-muted)',
                          letterSpacing: '0.02em',
                        }}
                      >
                        fc {s.forecast}
                      </span>
                    )}
                  </>
                )}
                {/* Coverage caption — how long this drop's planned qty
                    holds the floor at the forecast sell-through rate. A
                    range that matches the drop-window label format above
                    so the comparison is visually direct: if the two
                    ranges line up the bake is balanced; if the coverage
                    band extends past or stops short of the drop end,
                    it's an over- or under-bake signal at a glance. */}
                {s.coverageLabel && (
                  <span
                    title="Estimated time this drop's product lasts at the forecast sell-through rate"
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '0.02em',
                      textAlign: 'center',
                    }}
                  >
                    covers {s.coverageLabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Pinned "On-demand" cell rendered at the leftmost edge of the
 * HotProdDrops strip. Mirrors the active cadence slot's data so the
 * manager always has a "what's happening right now" reference cell,
 * regardless of how far they've scrolled or how many drops the
 * cadence has.
 *
 * Three modes (driven by `status`):
 *   - 'in'   → NOW pin. Accent border + warning fill + "NOW · HH:MM"
 *              header. Mirrors the active slot's qty/forecast/cover.
 *   - 'pre'  → Up-next pin. Same shape but a quieter info tone, since
 *              the cadence hasn't started — copy reads "UP NEXT" and
 *              the time is the upcoming first slot.
 *   - 'post' → Done pin. Muted neutral tone, copy reads "DONE", qty
 *              shown for reference but not as an action.
 */
function NowPinCell({
  slot,
  status,
  nowHHMM,
  onAddNow,
}: {
  slot: {
    label: string;
    qty: number;
    forecast: number;
    coverageLabel: string | null;
  };
  status: 'pre' | 'in' | 'post';
  nowHHMM: string;
  /** When provided, the planned-qty line becomes a +/− stepper so the
   *  manager can bump the active drop without scrolling to it in the
   *  cadence strip. Only wired in 'in' state — the pin's whole point
   *  is a one-tap "add more units now" affordance. */
  onAddNow?: (next: number) => void;
}) {
  const tone =
    status === 'in'
      ? {
          headerLabel: 'NOW',
          headerBg: 'var(--color-warning)',
          headerColor: '#ffffff',
          border: 'var(--color-warning)',
          background: 'var(--color-warning-light)',
          subtitle: nowHHMM,
        }
      : status === 'pre'
        ? {
            headerLabel: 'UP NEXT',
            headerBg: 'var(--color-info)',
            headerColor: '#ffffff',
            border: 'var(--color-info)',
            background: 'var(--color-info-light)',
            subtitle: `Cadence starts ${slot.label.split('–')[0]}`,
          }
        : {
            headerLabel: 'DONE',
            headerBg: 'var(--color-text-muted)',
            headerColor: '#ffffff',
            border: 'var(--color-border)',
            background: 'var(--color-bg-hover)',
            subtitle: 'Cadence finished',
          };

  return (
    <div
      title={
        status === 'in'
          ? `Active drop at ${nowHHMM} — ${slot.qty} planned, fc ${slot.forecast}`
          : status === 'pre'
            ? 'First drop hasn\u2019t started yet'
            : 'Cadence is over for the day'
      }
      style={{
        flex: '0 0 auto',
        width: 132,
        padding: '6px 8px 8px',
        borderRadius: 8,
        border: `2px solid ${tone.border}`,
        background: tone.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 5,
        position: 'relative',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
          padding: '2px 6px',
          borderRadius: 4,
          background: tone.headerBg,
          color: tone.headerColor,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {tone.headerLabel}
        {status === 'in' && (
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#ffffff',
              boxShadow: '0 0 0 2px rgba(255,255,255,0.45)',
              display: 'inline-block',
            }}
          />
        )}
      </div>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {tone.subtitle}
      </span>
      {onAddNow ? (
        // Inline stepper — replaces the static "X planned" row for the
        // live drop. We use the `emphasized` size so the buttons are
        // tap-targets at-a-glance from across the floor (this pin
        // doubles as a quick-add control during the bake), and keep
        // the centre slot as a read-only span (no keyboard input)
        // because the cadence grid's PlanStepperCell already covers
        // typed entry. "+1 / −1" here is the canonical action.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <QtyStepper
            size="emphasized"
            canDecrement={slot.qty > 0}
            onDecrement={() => onAddNow(Math.max(0, slot.qty - 1))}
            onIncrement={() => onAddNow(slot.qty + 1)}
            decrementLabel="Decrease planned units"
            incrementLabel="Add one unit now"
          >
            <span
              aria-live="polite"
              style={{
                minWidth: 32,
                fontSize: 22,
                fontWeight: 800,
                textAlign: 'center',
                color: 'var(--color-text-primary)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
                fontFamily: 'var(--font-primary)',
              }}
            >
              {slot.qty}
            </span>
          </QtyStepper>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'center',
            }}
          >
            planned
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--color-text-primary)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {slot.qty}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {status === 'post' ? 'baked' : 'planned'}
          </span>
        </div>
      )}
      {slot.forecast > 0 && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          fc {slot.forecast} this slot
        </span>
      )}
      {slot.coverageLabel && status !== 'post' && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          covers {slot.coverageLabel}
        </span>
      )}
    </div>
  );
}

/**
 * Distribute a day's forecast (`projectedUnits` + `byPhase`) across the
 * cadence drop slots so each Hot-Prod cell shows a realistic Quinn
 * proposal next to its editable plan number.
 *
 * Strategy: classify each drop by which phase its midpoint falls into
 * (morning < 11:00, midday 11:00–14:59, afternoon ≥ 15:00 — matches the
 * rest of the codebase) and split that phase's forecast evenly across
 * its drops. Any rounding remainder lands on the last drop in the phase
 * so the per-drop sum still equals the phase total.
 *
 * Falls back to an even split when `byPhase` isn't available.
 */
function buildForecastPerDrop(
  dropsCount: number,
  cadence: { intervalMinutes: number; startTime: string; endTime: string },
  forecastTotal: number,
  byPhase?: { morning: number; midday: number; afternoon: number },
): number[] {
  if (dropsCount <= 0) return [];

  if (!byPhase || forecastTotal <= 0) {
    const per = Math.floor(forecastTotal / dropsCount);
    const rem = forecastTotal - per * dropsCount;
    const out = Array(dropsCount).fill(per);
    if (out.length > 0) out[out.length - 1] = per + rem;
    return out;
  }

  const startMins = parseHHMM(cadence.startTime);
  const idxByPhase: Record<'morning' | 'midday' | 'afternoon', number[]> = {
    morning: [],
    midday: [],
    afternoon: [],
  };
  for (let i = 0; i < dropsCount; i++) {
    const midMins = startMins + i * cadence.intervalMinutes + cadence.intervalMinutes / 2;
    const hour = Math.floor(midMins / 60);
    const phase = hour < 11 ? 'morning' : hour < 15 ? 'midday' : 'afternoon';
    idxByPhase[phase].push(i);
  }

  const out = Array<number>(dropsCount).fill(0);
  (['morning', 'midday', 'afternoon'] as const).forEach(phase => {
    const idxs = idxByPhase[phase];
    if (idxs.length === 0) return;
    const phaseTotal = byPhase[phase];
    const per = Math.floor(phaseTotal / idxs.length);
    const rem = phaseTotal - per * idxs.length;
    idxs.forEach(i => (out[i] = per));
    out[idxs[idxs.length - 1]] = per + rem;
  });
  return out;
}

function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function formatHHMM(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── Cell style helpers ───────────────────────────────────────────────────────

function headStyle({
  left,
  sticky,
  minWidth,
  totalCol,
}: {
  left?: boolean;
  sticky?: boolean;
  minWidth?: number;
  totalCol?: boolean;
}): React.CSSProperties {
  return {
    padding: '10px 8px',
    background: 'var(--color-bg-surface)',
    borderBottom: '1px solid var(--color-border-subtle)',
    textAlign: left ? 'left' : 'center',
    // Anchor titles to the top so columns whose headers are tall (e.g.
    // spokes that also carry an unlock pill below the name) keep their
    // label aligned with the rest of the header row.
    verticalAlign: 'top',
    position: sticky ? 'sticky' : undefined,
    left: sticky ? 0 : undefined,
    zIndex: sticky ? 2 : undefined,
    boxShadow: sticky ? '1px 0 0 var(--color-border-subtle)' : undefined,
    minWidth,
    fontSize: 9,
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-primary)',
    borderLeft: totalCol ? '1px solid var(--color-border-subtle)' : undefined,
  };
}

function bodyStyle({
  left,
  sticky,
  focused,
  totalCol,
}: {
  left?: boolean;
  sticky?: boolean;
  focused?: boolean;
  totalCol?: boolean;
}): React.CSSProperties {
  return {
    padding: '10px 8px',
    background: focused ? 'var(--color-info-light)' : '#ffffff',
    borderBottom: '1px solid var(--color-border-subtle)',
    textAlign: left ? 'left' : 'center',
    position: sticky ? 'sticky' : undefined,
    left: sticky ? 0 : undefined,
    zIndex: sticky ? 1 : undefined,
    boxShadow: sticky ? '1px 0 0 var(--color-border-subtle)' : undefined,
    fontSize: 12,
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-primary)',
    verticalAlign: 'middle',
    borderLeft: totalCol ? '1px solid var(--color-border-subtle)' : undefined,
  };
}

function numStyle(): React.CSSProperties {
  return {
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 700,
    color: 'var(--color-text-primary)',
  };
}

// Footer cell — the "Total to make" summary row at the bottom of the
// hub grid. Visually distinct from body cells (heavier top border, soft
// background, bolder label) so the totals read as a summary band rather
// than another data row.
function footStyle({
  left,
  sticky,
  totalCol,
}: {
  left?: boolean;
  sticky?: boolean;
  totalCol?: boolean;
} = {}): React.CSSProperties {
  return {
    padding: '12px 8px',
    background: 'var(--color-bg-surface)',
    borderTop: '2px solid var(--color-border)',
    textAlign: left ? 'left' : 'center',
    position: sticky ? 'sticky' : undefined,
    left: sticky ? 0 : undefined,
    zIndex: sticky ? 1 : undefined,
    boxShadow: sticky ? '1px 0 0 var(--color-border-subtle)' : undefined,
    fontSize: left ? 11 : 13,
    fontWeight: left ? 700 : 600,
    color: left ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
    textTransform: left ? 'uppercase' : undefined,
    letterSpacing: left ? '0.05em' : undefined,
    fontFamily: 'var(--font-primary)',
    whiteSpace: 'nowrap',
    borderLeft: totalCol ? '1px solid var(--color-border-subtle)' : undefined,
  };
}

// Sub-footer cell — the projected-revenue row that sits directly under
// "Total to make". Same chassis as `footStyle` but without the heavy
// top border (the unit row above already carries the divider) and a
// lighter weight so the £ row reads as a complementary lens on the
// units, not another bold totals band.
function footSubStyle({
  left,
  sticky,
  totalCol,
}: {
  left?: boolean;
  sticky?: boolean;
  totalCol?: boolean;
} = {}): React.CSSProperties {
  return {
    padding: '10px 8px',
    background: 'var(--color-bg-surface)',
    borderTop: '1px solid var(--color-border-subtle)',
    textAlign: left ? 'left' : 'center',
    position: sticky ? 'sticky' : undefined,
    left: sticky ? 0 : undefined,
    zIndex: sticky ? 1 : undefined,
    boxShadow: sticky ? '1px 0 0 var(--color-border-subtle)' : undefined,
    fontSize: left ? 11 : 12,
    fontWeight: left ? 700 : 600,
    color: left ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
    textTransform: left ? 'uppercase' : undefined,
    letterSpacing: left ? '0.05em' : undefined,
    fontFamily: 'var(--font-primary)',
    whiteSpace: 'nowrap',
    borderLeft: totalCol ? '1px solid var(--color-border-subtle)' : undefined,
  };
}

// Currency cell content — same tabular-nums alignment as `numStyle`
// but a touch lighter than the unit totals so the two footer rows
// have a clear visual hierarchy (units = primary, £ = secondary).
function moneyStyle(): React.CSSProperties {
  return {
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
  };
}

// ─── Filter controls ──────────────────────────────────────────────────────────

/**
 * Pill-style tab strip.
 *
 * Mirrors the bench-mode tabs on /production/board and the day-strip pattern
 * elsewhere in the prototype: a single rounded pill background with the
 * active tab in `--color-accent-active`. Keeping the visual grammar
 * consistent so the manager doesn't have to learn another control style.
 */
/**
 * Production-type filter — sits alongside the slot tabs / site filter
 * on Today for self-producing sites. Lets the floor narrow the table
 * to a single mode (Run / VP / Hot Prod) during a busy push without
 * losing the overall structure of the day.
 *
 * Same pill-style chassis as `ViewModeTabs` so the two controls read as
 * a single filter strip when both are present.
 */
function ProductionTypeTabs({
  value,
  onChange,
}: {
  value: 'all' | 'run' | 'variable' | 'increment';
  onChange: (v: 'all' | 'run' | 'variable' | 'increment') => void;
}) {
  const tabs: { id: 'all' | 'run' | 'variable' | 'increment'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'run', label: 'Run' },
    { id: 'variable', label: 'VP' },
    { id: 'increment', label: 'Hot Prod' },
  ];
  return (
    <div
      role="tablist"
      aria-label="Production type filter"
      style={{
        display: 'flex',
        background: 'var(--color-bg-hover)',
        borderRadius: '100px',
        padding: '3px',
        width: 'fit-content',
      }}
    >
      {tabs.map(tab => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            style={{
              padding: '8px 14px',
              borderRadius: '100px',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              background: active ? 'var(--color-accent-active)' : 'transparent',
              color: active ? '#fff' : 'var(--color-text-secondary)',
              transition: 'all 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function ViewModeTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: ViewMode; label: string }[];
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Production slot filter"
      style={{
        display: 'flex',
        background: 'var(--color-bg-hover)',
        borderRadius: '100px',
        padding: '3px',
        width: 'fit-content',
      }}
    >
      {tabs.map(tab => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            style={{
              padding: '8px 18px',
              borderRadius: '100px',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              background: active ? 'var(--color-accent-active)' : 'transparent',
              color: active ? '#fff' : 'var(--color-text-secondary)',
              transition: 'all 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Spoke filter — a pill-shaped dropdown sized to sit alongside the
 * `ViewModeTabs` strip. Same border radius and vertical metrics as the
 * tab pills so the two controls read as a single filter row.
 */
function SpokeFilterDropdown({
  spokes,
  value,
  onChange,
}: {
  spokes: Site[];
  value: SiteId | 'all';
  onChange: (v: SiteId | 'all') => void;
}) {
  const id = 'recipe-grid-spoke-filter';
  const active = value !== 'all';
  return (
    <label
      htmlFor={id}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 14px 0 14px',
        height: 38,
        background: '#ffffff',
        border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`,
        borderRadius: '100px',
        fontFamily: 'var(--font-primary)',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      <Filter size={13} aria-hidden style={{ color: active ? 'var(--color-accent-active)' : 'var(--color-text-muted)' }} />
      <span>Site</span>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value as SiteId | 'all')}
        style={{
          border: 'none',
          background: 'transparent',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-primary)',
          cursor: 'pointer',
          paddingRight: 4,
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
        }}
      >
        <option value="all">All sites ({spokes.length})</option>
        {spokes.map(sp => (
          <option key={sp.id} value={sp.id}>
            {productionSiteLabel(sp.id) || sp.name}
          </option>
        ))}
      </select>
      <ChevronDown size={13} aria-hidden style={{ color: 'var(--color-text-muted)', marginLeft: -4 }} />
    </label>
  );
}

/**
 * Tiny outlined chip that surfaces an ingredient shortfall on a
 * recipe row. Renders nothing when there's no seeded constraint, so
 * it's safe to drop into every row's chip strip without polluting
 * unrelated rows.
 *
 * Two appearances:
 *   • open    → warning outline + AlertTriangle, label "Ingredient
 *               short". Tells the manager there's something to act
 *               on; the drawer carries the Apply CTA.
 *   • applied → info outline + AlertTriangle (muted), label "Cut
 *               applied · -N". Reads as "resolved, see drawer for
 *               undo".
 */
function ShortfallRowChip({
  hubId,
  recipeId,
  forDate,
}: {
  hubId: SiteId;
  recipeId: string;
  forDate: string;
}) {
  const status = useShortfallStatus(hubId, recipeId, forDate);
  if (status.kind === 'none') return null;
  const isApplied = status.kind === 'applied';
  const tone = isApplied ? 'var(--color-info)' : 'var(--color-warning)';
  const label = isApplied
    ? `Cut applied · -${status.record.totalRequestedUnits - status.record.totalAllocatedUnits}`
    : 'Ingredient short';
  return (
    <span
      title={status.seed.detail}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '1px 6px 1px 5px',
        borderRadius: 'var(--radius-badge)',
        background: 'transparent',
        color: tone,
        border: `1px solid ${tone}`,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <AlertTriangle size={10} strokeWidth={2.4} />
      {label}
    </span>
  );
}

'use client';

import { useMemo, useState } from 'react';
import {
  Truck,
  ChevronRight,
  ChevronDown,
  Check,
  Circle,
  CircleDashed,
  RotateCcw,
  Search,
  X,
  Link2,
  AlertTriangle,
} from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import StatusPill from './StatusPill';
import {
  dayOffset,
  dayOfWeek,
  getRecipe,
  getSite,
  hubAvailableSupply,
  productionItemsAt,
  SHORTFALL_REASON_LABELS,
  submissionsForHub,
  type DispatchTransfer,
  type DispatchTransferLine,
  type ProductionRecipe,
  type RecipeId,
  type Site,
  type SiteId,
  type SkuId,
  type SpokeSubmission,
  type SpokeSubmissionLine,
} from './fixtures';
import { useDispatchTransfers, formatSentClock } from './dispatchStore';
import { useSpokeRejects } from './rejectsStore';
import { useAdhocRequests } from './adhocStore';
import ShortfallReallocationModal, {
  type ShortfallReallocationInput,
  type ShortfallReallocationResult,
} from './ShortfallReallocationModal';
import { computeAllocation } from './dispatchShortfall';

/**
 * Manifest line built by the matrix for a single spoke — the unit of work
 * we hand to the parent when the manager clicks Send. The parent uses this
 * to populate the confirm sheet and ultimately persist a `DispatchTransfer`
 * via the dispatch store.
 */
export type SpokeDispatchRequest = {
  spokeId: SiteId;
  forDate: string;
  /** Submission status, surfaced in the confirm sheet header chip. */
  submissionStatus: SpokeSubmission['status'];
  lines: DispatchTransferLine[];
  totalUnits: number;
};

type Props = {
  hubId: SiteId;
  /** ISO date the spokes are ordering FOR. Defaults to tomorrow. */
  forDate?: string;
  /**
   * Fired when the manager clicks Send on a single spoke control card. The
   * parent (`/production/dispatch`) opens the confirm sheet from here.
   */
  onSendSpoke?: (request: SpokeDispatchRequest) => void;
  /**
   * Fired when the manager clicks "Send all submitted". The matrix builds a
   * request per eligible spoke and hands them all up; the parent renders the
   * confirm sheet in bulk mode.
   */
  onSendAll?: (requests: SpokeDispatchRequest[]) => void;
  /**
   * Currently-applied shortfall reallocations, keyed by recipeId. Page-level
   * state — the matrix banner and the request builder both read from this.
   * Empty object on first load; the modal populates entries via
   * `onApplyShortfall` when the manager accepts a reallocation.
   */
  shortfallApplied?: Record<RecipeId, ShortfallReallocationResult>;
  /**
   * Called when the manager applies (or re-applies) a reallocation. Page
   * lifts the result into `shortfallApplied`.
   */
  onApplyShortfall?: (result: ShortfallReallocationResult) => void;
};

// Statuses where the spoke's order is locked-in enough to be safely
// dispatched. Plain `draft` is excluded — the spoke might still be editing.
const SENDABLE_STATUSES = new Set<SpokeSubmission['status']>([
  'submitted',
  'acknowledged',
  'modified-by-hub',
  'auto-finalised',
]);

const CATEGORY_ORDER: ProductionRecipe['category'][] = [
  'Bakery',
  'Sandwich',
  'Salad',
  'Snack',
  'Beverage',
];

type SpokeCell = {
  /** Number of units, or null if the spoke didn't order this recipe. */
  value: number | null;
  /** True when the value is Quinn's proposal (spoke hasn't confirmed). */
  isQuinn: boolean;
};

type RecipeRow = {
  recipe: ProductionRecipe;
  skuId: SkuId;
  /** Cell per spoke, in the same order as `submissions`. */
  cells: SpokeCell[];
  /** Sum of all non-null cells. */
  rowTotal: number;
  /** Number of spokes that asked for this recipe (cell.value > 0). */
  spokeCount: number;
  /**
   * Hub-available supply for this SKU today, if a stubbed shortfall exists.
   * `undefined` means "supply isn't the limiting factor" — no banner fires.
   * When defined AND less than `rowTotal`, the recipe row renders a
   * shortfall banner and the request builder applies the reallocation.
   */
  availableSupply?: number;
};

// ─── Dispatch run breakdown ──────────────────────────────────────────────────
//
// Multi-drop dispatch model — most hub→spoke flows ship in three runs
// across the day (R1 ~05:30 commuter, R2 ~10:00 mid-morning top-up,
// R3 ~13:30 lunch reset). The matrix lets the manager filter to one
// run at a time, or stay in "All" and see a row-level breakdown of
// what's already gone out vs what's on the bench right now vs what's
// still scheduled.
//
// In this prototype the run schedule is mocked: R1 has always been
// sent for every recipe, R2 is ready for roughly half the recipes
// (deterministic by recipe id so the mock is stable across renders),
// and R3 hasn't started baking. Hooking this up to real production
// schedules is a follow-up — the shape of the helper is intentionally
// simple so the swap-in is local to `splitIntoRuns`.

type RunId = 'R1' | 'R2' | 'R3';
type RunStatus = 'sent' | 'ready' | 'pending';
type RunFilter = 'all' | RunId;

const RUN_IDS: RunId[] = ['R1', 'R2', 'R3'];

type RunSlice = {
  runId: RunId;
  units: number;
  status: RunStatus;
};

/** Three-slice projection of a recipe's row total across R1/R2/R3. */
type RunBreakdown = Record<RunId, RunSlice>;

const RUN_SHARES: Record<RunId, number> = { R1: 0.4, R2: 0.35, R3: 0.25 };

/**
 * Stable per-recipe hash → 0..1. Used to decide which recipes have R2
 * ready in the demo (~half do). We avoid `Math.random` so the mock
 * doesn't shimmer when the matrix re-renders.
 */
function recipeHash01(recipeId: string): number {
  let h = 2166136261;
  for (let i = 0; i < recipeId.length; i++) {
    h ^= recipeId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 1000) / 1000;
}

/**
 * Split a recipe-row total into R1/R2/R3 slices and tag each with a
 * mock status. Sum of slice units always equals `total` — the leftover
 * after rounding goes to R3 so R1/R2 stay clean for the "what's gone"
 * vs "what's ready" reading. Returns zero-unit slices when `total === 0`.
 */
function splitIntoRuns(total: number, recipeId: string): RunBreakdown {
  if (total <= 0) {
    return {
      R1: { runId: 'R1', units: 0, status: 'sent' },
      R2: { runId: 'R2', units: 0, status: r2StatusFor(recipeId) },
      R3: { runId: 'R3', units: 0, status: 'pending' },
    };
  }
  const r1 = Math.floor(total * RUN_SHARES.R1);
  const r2 = Math.floor(total * RUN_SHARES.R2);
  const r3 = total - r1 - r2;
  return {
    R1: { runId: 'R1', units: r1, status: 'sent' },
    R2: { runId: 'R2', units: r2, status: r2StatusFor(recipeId) },
    R3: { runId: 'R3', units: r3, status: 'pending' },
  };
}

function r2StatusFor(recipeId: string): RunStatus {
  // ~55% of recipes have R2 ready, the rest are still pending. Picking
  // a slightly-over-half threshold so the matrix shows a clear mix
  // rather than nearly-all-ready or nearly-all-pending.
  return recipeHash01(recipeId) < 0.55 ? 'ready' : 'pending';
}

const RUN_STATUS_COPY: Record<RunStatus, { label: string; tone: string; bg: string; border: string }> = {
  sent: {
    label: 'Sent',
    tone: 'var(--color-success)',
    bg: 'rgba(34, 134, 88, 0.08)',
    border: 'rgba(34, 134, 88, 0.32)',
  },
  ready: {
    label: 'Ready',
    tone: 'var(--color-info)',
    bg: 'rgba(56, 102, 184, 0.08)',
    border: 'rgba(56, 102, 184, 0.32)',
  },
  pending: {
    label: 'Pending',
    tone: 'var(--color-text-muted)',
    bg: 'var(--color-bg-hover)',
    border: 'var(--color-border-subtle)',
  },
};

/**
 * Hub-side dispatch view — answers the question "what's leaving the building
 * tomorrow, for whom?". Two stacked cards:
 *
 *  1. Spoke status bar: one mini-card per spoke with submission status, total
 *     units ordered, and the per-spoke Send action (or Sent pill + Undo).
 *     A "Send all submitted · N" CTA sits on the right.
 *
 *  2. Recipe ledger: every recipe the hub bakes (from `productionItemsAt`,
 *     not just ones a spoke happened to order — the manager sees the full
 *     menu), grouped by category, each row card-styled and expandable. The
 *     expanded panel shows the per-spoke breakdown with status, Quinn-flags,
 *     and sent timestamps.
 */
export default function HubSpokeBreakdown({
  hubId,
  forDate = dayOffset(1),
  onSendSpoke,
  onSendAll,
  shortfallApplied = {},
  onApplyShortfall,
}: Props) {
  // Per-recipe shortfall modal state — null when the modal is closed.
  // Carrying the full modal-input payload (not just recipeId) means we can
  // open the modal without re-deriving inputs from the in-flight state of
  // the matrix, which would jitter if a parent re-renders mid-flow.
  const [shortfallModal, setShortfallModal] = useState<{
    recipeId: RecipeId;
    skuId: SkuId;
    recipeName: string;
    totalRequested: number;
    availableSupply: number;
    inputs: ShortfallReallocationInput[];
  } | null>(null);
  const submissions = useMemo(() => submissionsForHub(hubId, forDate), [hubId, forDate]);
  const { transferFor, undoTransfer } = useDispatchTransfers();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<SkuId>>(new Set());
  // Run filter: 'all' shows totals + a per-row R1/R2/R3 status strip;
  // a specific run narrows every cell to that run's slice with the
  // matching status badge. Drives total roll-ups too so the spoke
  // control card and row totals stay consistent with the picker.
  const [runFilter, setRunFilter] = useState<RunFilter>('all');

  // Pre-index each submission's lines by skuId for O(1) cell lookup, and
  // build a stable map sub.fromSiteId → submission for the column headers
  // and the Send action handlers.
  const linesBySpoke = useMemo(() => {
    const m = new Map<SiteId, Map<SkuId, SpokeSubmissionLine>>();
    for (const sub of submissions) {
      const inner = new Map<SkuId, SpokeSubmissionLine>();
      for (const line of sub.lines) inner.set(line.skuId, line);
      m.set(sub.fromSiteId, inner);
    }
    return m;
  }, [submissions]);

  // Source of truth for "what could be on the dispatch list" — every recipe
  // the hub bakes, not just ones a spoke has already ordered. Mirrors how
  // the spoke order page surfaces the full hub menu.
  const allRows: RecipeRow[] = useMemo(() => {
    const seen = new Map<SkuId, ProductionRecipe>();
    for (const item of productionItemsAt(hubId)) {
      if (seen.has(item.skuId)) continue;
      const recipe = getRecipe(item.recipeId);
      if (recipe) seen.set(item.skuId, recipe);
    }

    const rows: RecipeRow[] = [];
    for (const [skuId, recipe] of seen.entries()) {
      const cells: SpokeCell[] = submissions.map(sub => {
        const line = linesBySpoke.get(sub.fromSiteId)?.get(skuId);
        if (!line) return { value: null, isQuinn: false };
        const confirmed = line.confirmedUnits;
        return {
          value: effectiveUnits(confirmed, line.quinnProposedUnits),
          isQuinn: confirmed === null,
        };
      });
      const rowTotal = cells.reduce((a, c) => a + (c.value ?? 0), 0);
      const spokeCount = cells.filter(c => (c.value ?? 0) > 0).length;
      const availableSupply = hubAvailableSupply(hubId, skuId, forDate);
      rows.push({ recipe, skuId, cells, rowTotal, spokeCount, availableSupply });
    }

    rows.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.recipe.category);
      const bi = CATEGORY_ORDER.indexOf(b.recipe.category);
      if (ai !== bi) return ai - bi;
      return a.recipe.name.localeCompare(b.recipe.name);
    });
    return rows;
  }, [hubId, linesBySpoke, submissions]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(r => r.recipe.name.toLowerCase().includes(q));
  }, [allRows, query]);

  // Effective allocations = auto demand-led for every short row that
  // hasn't been touched by the manager, MERGED with explicit
  // `shortfallApplied` entries (manager edits win). The dispatch send
  // path reads from this so cuts are baked in whether the manager opened
  // the modal or not — the modal becomes an "override" surface rather
  // than a gate. The matrix banner reads from this too, so every short
  // row shows a resolved state on first render.
  const effectiveAllocations = useMemo(() => {
    const merged: Record<RecipeId, ShortfallReallocationResult> = {};
    for (const row of allRows) {
      if (row.availableSupply === undefined) continue;
      if (row.rowTotal <= row.availableSupply) continue;
      const inputs: ShortfallReallocationInput[] = row.cells
        .map((c, i) => ({
          spokeId: submissions[i].fromSiteId,
          skuId: row.skuId,
          requested: c.value ?? 0,
        }))
        .filter(i => i.requested > 0);
      if (inputs.length === 0) continue;
      const allocRows = computeAllocation('demand-led', inputs, row.availableSupply);
      merged[row.recipe.id] = {
        recipeId: row.recipe.id,
        skuId: row.skuId,
        availableSupply: row.availableSupply,
        strategy: 'demand-led',
        rows: allocRows,
        autoApplied: true,
      };
    }
    for (const [id, applied] of Object.entries(shortfallApplied)) {
      merged[id] = applied;
    }
    return merged;
  }, [allRows, submissions, shortfallApplied]);

  // Group filtered rows by category for the section headers.
  const grouped = useMemo(() => {
    const map = new Map<ProductionRecipe['category'], RecipeRow[]>();
    for (const r of filteredRows) {
      const arr = map.get(r.recipe.category) ?? [];
      arr.push(r);
      map.set(r.recipe.category, arr);
    }
    return CATEGORY_ORDER.filter(c => map.has(c)).map(c => ({
      category: c,
      rows: map.get(c)!,
    }));
  }, [filteredRows]);

  // Totals — across rows the spokes have actually ordered (rowTotal > 0).
  const grandTotal = useMemo(() => allRows.reduce((a, r) => a + r.rowTotal, 0), [allRows]);
  const orderedRecipeCount = useMemo(
    () => allRows.filter(r => r.rowTotal > 0).length,
    [allRows],
  );

  function toggleExpand(sku: SkuId) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  // Build a dispatch manifest for a single spoke from its submission. Each
  // line resolves to the confirmed quantity, falling back to Quinn's
  // proposal when the spoke hasn't confirmed (draft/auto-finalised lines
  // can carry confirmed=null). Lines with zero units are dropped so the
  // manifest stays clean.
  //
  // Applied shortfall reallocations are stamped onto matching lines: the
  // line's `units` is replaced with the allocator's suggestion for this
  // spoke, `originalRequested` captures what was asked for, and
  // `shortfallReason` (+ optional `shortfallNote`) carries the
  // spoke-visible justification through to the confirm sheet and the
  // dispatch transfer record.
  const buildRequestFor = (sub: SpokeSubmission): SpokeDispatchRequest => {
    const lines: DispatchTransferLine[] = [];
    let totalUnits = 0;
    for (const l of sub.lines) {
      const wasQuinnProposed = l.confirmedUnits === null;
      const requested = effectiveUnits(l.confirmedUnits, l.quinnProposedUnits);
      if (requested <= 0) continue;
      const allocation = effectiveAllocations[l.recipeId];
      const allocRow = allocation?.rows.find(r => r.spokeId === sub.fromSiteId);
      const units = allocRow ? allocRow.suggested : requested;
      const line: DispatchTransferLine = {
        skuId: l.skuId,
        recipeId: l.recipeId,
        units,
        wasQuinnProposed,
      };
      if (allocRow && allocRow.delta < 0) {
        line.originalRequested = requested;
        line.shortfallReason = allocRow.reason;
        if (allocation?.managerNote) line.shortfallNote = allocation.managerNote;
      }
      lines.push(line);
      totalUnits += units;
    }
    return {
      spokeId: sub.fromSiteId,
      forDate,
      submissionStatus: sub.status,
      lines,
      totalUnits,
    };
  };

  const sendableSubs = submissions.filter(s => SENDABLE_STATUSES.has(s.status));
  const sendableCount = sendableSubs.filter(
    s => !transferFor(hubId, s.fromSiteId, forDate),
  ).length;

  function handleSendOne(sub: SpokeSubmission) {
    if (!onSendSpoke) return;
    onSendSpoke(buildRequestFor(sub));
  }

  function handleSendAll() {
    if (!onSendAll) return;
    const requests = sendableSubs
      .filter(s => !transferFor(hubId, s.fromSiteId, forDate))
      .map(buildRequestFor);
    if (requests.length === 0) return;
    onSendAll(requests);
  }

  if (submissions.length === 0) {
    return (
      <div style={{ padding: '14px 16px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div
            style={{
              padding: '32px 20px',
              borderRadius: 'var(--radius-card)',
              background: '#ffffff',
              border: '1px solid var(--color-border-subtle)',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: 13,
            }}
          >
            No spoke orders for {dayOfWeek(forDate)} {forDate} yet.
          </div>
        </div>
      </div>
    );
  }

  // Column template for the recipe ledger: chevron+name | spoke columns | total
  const cols = `minmax(220px, 1.6fr) ${submissions.map(() => 'minmax(96px, 1fr)').join(' ')} 90px`;

  return (
    <div style={{ padding: '14px 16px 32px' }}>
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* ── Card 1: Spoke status bar ───────────────────────────── */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border-subtle)',
              flexWrap: 'wrap',
            }}
          >
            <Truck size={16} color="var(--color-text-secondary)" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--color-text-muted)',
                }}
              >
                Spoke dispatch
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                }}
              >
                {submissions.length} {submissions.length === 1 ? 'spoke' : 'spokes'} ordering for{' '}
                {dayOfWeek(forDate)} {forDate}
              </span>
            </div>
            <div style={{ flex: 1 }} />
            <SummaryChip label="Recipes" value={orderedRecipeCount} />
            <SummaryChip label="Total units" value={grandTotal} bold />
            {onSendAll && (
              <button
                onClick={handleSendAll}
                disabled={sendableCount === 0}
                title={
                  sendableCount === 0
                    ? 'No submitted orders left to send'
                    : `Send to ${sendableCount} ${sendableCount === 1 ? 'spoke' : 'spokes'} in one go`
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'var(--font-primary)',
                  background:
                    sendableCount === 0
                      ? 'var(--color-bg-hover)'
                      : 'var(--color-accent-active)',
                  color:
                    sendableCount === 0
                      ? 'var(--color-text-muted)'
                      : 'var(--color-text-on-active)',
                  border: '1px solid transparent',
                  cursor: sendableCount === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                <Truck size={12} />
                Send all{sendableCount > 0 ? ` · ${sendableCount}` : ''}
              </button>
            )}
          </div>

          {/* Per-spoke control row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${submissions.length}, minmax(0, 1fr))`,
              gap: 0,
              background: 'var(--color-bg-surface)',
            }}
          >
            {submissions.map((sub, idx) => {
              const transfer = transferFor(hubId, sub.fromSiteId, forDate);
              const sendable = SENDABLE_STATUSES.has(sub.status);
              const spoke = getSite(sub.fromSiteId);
              const total = sub.lines.reduce(
                (a, l) => a + effectiveUnits(l.confirmedUnits, l.quinnProposedUnits),
                0,
              );
              return (
                <div
                  key={sub.fromSiteId}
                  style={{
                    padding: '10px 14px',
                    background: '#ffffff',
                    borderRight:
                      idx < submissions.length - 1
                        ? '1px solid var(--color-border-subtle)'
                        : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                      }}
                    >
                      {spoke?.name ?? sub.fromSiteId}
                    </span>
                    {spoke && <LinkTypeChip site={spoke} />}
                    <DispatchStatusChip status={sub.status} hasTransfer={!!transfer} />
                    <ProvenanceChip status={sub.status} />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: 'var(--color-text-primary)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {total}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--color-text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      units · {sub.lines.filter(l => l.confirmedUnits !== null).length}/
                      {sub.lines.length} confirmed
                    </span>
                    <div style={{ flex: 1 }} />
                    {onSendSpoke && (
                      <SpokeSendControl
                        transfer={transfer}
                        sendable={sendable}
                        onSend={() => handleSendOne(sub)}
                        onUndo={() => undoTransfer(hubId, sub.fromSiteId, forDate)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Card 2: Recipe ledger ───────────────────────────── */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
            overflow: 'hidden',
          }}
        >
          {/* Toolbar (search) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderBottom: '1px solid var(--color-border-subtle)',
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-muted)',
              }}
            >
              Dispatch ledger
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {allRows.length} {allRows.length === 1 ? 'recipe' : 'recipes'} on the hub menu ·{' '}
              {orderedRecipeCount} ordered today
            </span>
            <div style={{ flex: 1 }} />
            {/* Run filter — narrows every cell + total to a single
                dispatch run (R1 / R2 / R3) or stays in "All" with a
                per-row run-status strip. Sits between the ledger
                header and the search box so the manager can filter
                without scrolling. */}
            <RunFilterStrip value={runFilter} onChange={setRunFilter} />
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                background: 'var(--color-bg-hover)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 8,
                minWidth: 200,
              }}
            >
              <Search size={12} color="var(--color-text-muted)" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search recipes…"
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: 12,
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--color-text-primary)',
                  minWidth: 0,
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                    color: 'var(--color-text-muted)',
                    display: 'inline-flex',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Column header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: cols,
              gap: 0,
              padding: '8px 16px',
              background: 'var(--color-bg-hover)',
              borderBottom: '1px solid var(--color-border-subtle)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <span>Recipe</span>
            {submissions.map(sub => {
              const spoke = getSite(sub.fromSiteId);
              const transfer = transferFor(hubId, sub.fromSiteId, forDate);
              return (
                <div
                  key={sub.fromSiteId}
                  style={{
                    textAlign: 'right',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 2,
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      maxWidth: '100%',
                    }}
                  >
                    {spoke?.type === 'STANDALONE' && spoke.linkType === 'linked' && (
                      <Link2
                        size={9}
                        color="var(--color-text-muted)"
                        aria-label="Linked standalone"
                      />
                    )}
                    <span
                      style={{
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        fontSize: 10,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {spoke?.name ?? sub.fromSiteId}
                    </span>
                  </div>
                  {transfer && (
                    <span
                      title={`Sent ${transfer.totalUnits} units at ${formatSentClock(
                        transfer.sentAtISO,
                      )}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 8,
                        fontWeight: 700,
                        color: 'var(--color-success)',
                      }}
                    >
                      <Check size={8} /> Sent
                    </span>
                  )}
                </div>
              );
            })}
            <span style={{ textAlign: 'right', color: 'var(--color-text-primary)' }}>Total</span>
          </div>

          {/* Empty state for current filter */}
          {grouped.length === 0 && (
            <div
              style={{
                padding: '32px 20px',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
                fontSize: 12,
              }}
            >
              {query
                ? `No recipes match “${query}”.`
                : 'Hub has no recipes set up yet.'}
            </div>
          )}

          {/* Grouped sections */}
          {grouped.map(group => {
            const groupTotal = group.rows.reduce((a, r) => a + r.rowTotal, 0);
            const groupOrdered = group.rows.filter(r => r.rowTotal > 0).length;
            return (
              <div key={group.category}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 16px',
                    background: 'var(--color-bg-surface)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    borderTop: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <StatusPill tone="neutral" label={group.category} size="xs" />
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--color-text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    {group.rows.length} SKU{group.rows.length === 1 ? '' : 's'} ·{' '}
                    {groupOrdered} ordered · {groupTotal} units
                  </span>
                </div>
                {group.rows.map(row => (
                  <DispatchRecipeRow
                    key={row.skuId}
                    row={row}
                    cols={cols}
                    submissions={submissions}
                    hubId={hubId}
                    forDate={forDate}
                    runFilter={runFilter}
                    isExpanded={expanded.has(row.skuId)}
                    onToggle={() => toggleExpand(row.skuId)}
                    shortfallResult={effectiveAllocations[row.recipe.id]}
                    onOpenShortfall={() => {
                      if (row.availableSupply === undefined) return;
                      const inputs: ShortfallReallocationInput[] = row.cells
                        .map((c, i) => ({
                          spokeId: submissions[i].fromSiteId,
                          skuId: row.skuId,
                          requested: c.value ?? 0,
                        }))
                        .filter(i => i.requested > 0);
                      setShortfallModal({
                        recipeId: row.recipe.id,
                        skuId: row.skuId,
                        recipeName: row.recipe.name,
                        totalRequested: row.rowTotal,
                        availableSupply: row.availableSupply,
                        inputs,
                      });
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {shortfallModal && (
        <ShortfallReallocationModal
          recipeId={shortfallModal.recipeId}
          skuId={shortfallModal.skuId}
          recipeName={shortfallModal.recipeName}
          totalRequested={shortfallModal.totalRequested}
          availableSupply={shortfallModal.availableSupply}
          inputs={shortfallModal.inputs}
          initial={effectiveAllocations[shortfallModal.recipeId]}
          onCancel={() => setShortfallModal(null)}
          onApply={(result) => {
            onApplyShortfall?.(result);
            setShortfallModal(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Shortfall banner (one per affected recipe row) ────────────────────────

function ShortfallBanner({
  shortBy,
  promised,
  produced,
  result,
  onOpen,
}: {
  shortBy: number;
  promised: number;
  produced: number;
  /**
   * Effective allocation for this row — always present when the row is
   * short (auto demand-led when the manager hasn't touched it; the
   * applied result once they have). The banner uses `autoApplied` to
   * decide between the "Auto-reallocated" copy (subtle) and
   * "Reallocated" copy (manager-confirmed, slightly bolder).
   */
  result?: ShortfallReallocationResult;
  onOpen: () => void;
}) {
  const isAuto = !!result?.autoApplied;
  const isApplied = !!result;
  // Auto = blue/info tone, manager-applied = green/success tone, missing
  // result = warning. In practice `result` is always present for short
  // rows now (auto fills the gap), so the warning branch only kicks in
  // if the auto pass produced no rows — defensive only.
  const tone = !isApplied
    ? { bg: 'var(--color-warning-light)', fg: 'var(--color-warning)' }
    : isAuto
      ? { bg: 'var(--color-info-light)', fg: 'var(--color-info)' }
      : { bg: 'var(--color-success-light)', fg: 'var(--color-success)' };
  const label = !isApplied
    ? `Short by ${shortBy}`
    : isAuto
      ? 'Auto-reallocated'
      : 'Reallocated';
  return (
    <div
      onClick={e => {
        e.stopPropagation();
        onOpen();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px 8px 53px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: tone.bg,
        color: tone.fg,
        fontSize: 11,
        cursor: 'pointer',
      }}
      title={
        isAuto
          ? `Demand-led cut of ${shortBy} applied automatically — click to override`
          : isApplied
            ? 'Reallocation applied — click to edit'
            : 'Tap to reallocate the shortfall'
      }
    >
      <AlertTriangle size={13} style={{ flexShrink: 0 }} />
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{label}</span>
      <span
        style={{
          fontSize: 10,
          color: 'var(--color-text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {produced} produced of {promised} promised
        {isApplied && ` · ${strategyLabel(result.strategy)}`}
        {isAuto && ' (auto)'}
      </span>
      <div style={{ flex: 1 }} />
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {isApplied ? (isAuto ? 'Override ▸' : 'Edit ▸') : 'Reallocate ▸'}
      </span>
    </div>
  );
}

function strategyLabel(s: ShortfallReallocationResult['strategy']): string {
  if (s === 'demand-led') return 'Demand-led';
  if (s === 'pro-rata') return 'Pro-rata';
  return 'Manual';
}

// ─── Recipe row (card-style) ──────────────────────────────────────────────

function DispatchRecipeRow({
  row,
  cols,
  submissions,
  hubId,
  forDate,
  runFilter,
  isExpanded,
  onToggle,
  shortfallResult,
  onOpenShortfall,
}: {
  row: RecipeRow;
  cols: string;
  submissions: SpokeSubmission[];
  hubId: SiteId;
  forDate: string;
  /** Active run filter — drives whether cells show the full row total
   *  or a single run's slice, and toggles the per-row run-status strip. */
  runFilter: RunFilter;
  isExpanded: boolean;
  onToggle: () => void;
  /** Previously-applied reallocation, if any. Drives the banner's state. */
  shortfallResult?: ShortfallReallocationResult;
  /** Opens the reallocation modal. Only meaningful when the row is short. */
  onOpenShortfall: () => void;
}) {
  const { transferFor } = useDispatchTransfers();
  const { unrolledUnitsFor } = useSpokeRejects();
  const { approvedUnitsFor } = useAdhocRequests();
  // PAC142 — the inflated row total includes any unrolled rejects so the
  // header summary stays truthful ("3 spokes · 84 units" includes the +3
  // croissants going back out for Fitzroy Espresso).
  const rejectUnitsBySpoke = submissions.map(sub =>
    unrolledUnitsFor(hubId, sub.fromSiteId, row.skuId),
  );
  // Approved ad-hoc requests for this (hub, spoke, sku, forDate) flow into
  // the matrix the same way as reject roll-forwards, so the hub manager
  // sees the augmented qty they actually need to send.
  const adhocUnitsBySpoke = submissions.map(sub =>
    approvedUnitsFor(hubId, sub.fromSiteId, row.skuId, forDate),
  );
  const totalRejects = rejectUnitsBySpoke.reduce((a, n) => a + n, 0);
  const totalAdhoc = adhocUnitsBySpoke.reduce((a, n) => a + n, 0);
  const hasOrders = row.rowTotal > 0 || totalRejects > 0 || totalAdhoc > 0;

  // ── Run breakdown ──────────────────────────────────────────────────
  // Row-level slice (used by the "All" status strip) and per-cell
  // slices (used to scale the spoke columns when a specific run is
  // active). Per-cell scaling rounds against the cell value with R3
  // soaking the rounding remainder, mirroring `splitIntoRuns` so a
  // sum of cell slices equals the row's slice.
  const rowBreakdown = splitIntoRuns(row.rowTotal, row.recipe.id);
  const isSingleRun = runFilter !== 'all';
  const activeRunStatus: RunStatus | null = isSingleRun
    ? rowBreakdown[runFilter as RunId].status
    : null;

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: cols,
          gap: 0,
          padding: '8px 16px 8px 13px',
          alignItems: 'center',
          borderBottom: '1px solid var(--color-border-subtle)',
          borderLeft: '3px solid transparent',
          background: '#ffffff',
          cursor: 'pointer',
          fontSize: 11,
          opacity: hasOrders ? 1 : 0.55,
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <button
            type="button"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            onClick={e => {
              e.stopPropagation();
              onToggle();
            }}
            style={{
              width: 28,
              height: 28,
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 6,
              background: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              flexShrink: 0,
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
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
            </div>
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginTop: 3,
                alignItems: 'center',
                fontSize: 9,
                color: 'var(--color-text-muted)',
              }}
            >
              {hasOrders ? (
                <StatusPill
                  tone="info"
                  label={`${row.spokeCount} ${row.spokeCount === 1 ? 'spoke' : 'spokes'}`}
                  size="xs"
                />
              ) : (
                <StatusPill tone="neutral" label="Not ordered" size="xs" />
              )}
              {row.recipe.batchRules?.multipleOf && row.recipe.batchRules.multipleOf > 1 && (
                <span>steps of {row.recipe.batchRules.multipleOf}</span>
              )}
              {/* In "All" mode, surface a tiny per-run status strip
                  inline with the recipe meta so the manager can scan
                  what's gone vs what's ready vs what's still on the
                  bench without expanding the row. The strip hides in
                  single-run mode (the cells already say it). */}
              {!isSingleRun && hasOrders && (
                <RunStatusStrip breakdown={rowBreakdown} compact />
              )}
              {isSingleRun && hasOrders && activeRunStatus && (
                <RunStatusBadge status={activeRunStatus} runId={runFilter as RunId} />
              )}
            </div>
          </div>
        </div>

        {row.cells.map((c, i) => {
          const sub = submissions[i];
          const wasSent = !!transferFor(hubId, sub.fromSiteId, forDate);
          const rejects = rejectUnitsBySpoke[i];
          const adhoc = adhocUnitsBySpoke[i];
          const ordered = c.value ?? 0;
          const empty = c.value === null && rejects === 0 && adhoc === 0;
          const fullCellTotal = ordered + rejects + adhoc;
          // When a specific run is active, scale the cell to that run's
          // share. Rejects + ad-hoc are aggregate concepts (they don't
          // belong to a run), so we just suppress those badges in
          // single-run mode and show only the recipe slice.
          const cellValue = isSingleRun
            ? splitIntoRuns(ordered, row.recipe.id)[runFilter as RunId].units
            : fullCellTotal;
          const displayValue = empty
            ? '—'
            : isSingleRun && cellValue === 0
              ? '·'
              : cellValue;
          // R2 pending / R3 pending → cell numbers should look "not
          // ready", so we pull the same muted styling we use for
          // already-sent. Ready (R2 ready) reads as a normal active cell.
          const runMuted = isSingleRun && activeRunStatus === 'pending';
          return (
            <div
              key={sub.fromSiteId}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 1,
              }}
            >
              <div
                style={{
                  textAlign: 'right',
                  fontSize: 13,
                  fontWeight: empty ? 400 : 700,
                  color: empty
                    ? 'var(--color-text-muted)'
                    : wasSent || runMuted
                      ? 'var(--color-text-muted)'
                      : 'var(--color-text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 4,
                  textDecoration:
                    (wasSent || (isSingleRun && activeRunStatus === 'sent')) && !empty
                      ? 'line-through'
                      : 'none',
                  textDecorationColor: 'var(--color-text-muted)',
                  opacity: (wasSent && !empty) || runMuted ? 0.7 : 1,
                }}
                title={
                  empty
                    ? `${getSite(sub.fromSiteId)?.name ?? sub.fromSiteId} did not order this`
                    : wasSent
                      ? 'Already dispatched'
                      : isSingleRun
                        ? `${runFilter} · ${RUN_STATUS_COPY[activeRunStatus!].label.toLowerCase()} · ${cellValue} units`
                        : tooltipFor(ordered, rejects, adhoc, c.isQuinn)
                }
              >
                {displayValue}
                {c.isQuinn && !empty && !wasSent && !isSingleRun && (
                  <EdifyMark size={10} color="var(--color-text-muted)" />
                )}
              </div>
              {/* Reject + ad-hoc augmentation chips are aggregate concepts —
                  they don't slice into per-run buckets. Hide them when a
                  specific run is active so the cell reads cleanly as
                  "this run's units only". */}
              {!isSingleRun && rejects > 0 && !wasSent && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--color-warning)',
                    background: 'var(--color-warning-bg)',
                    border: '1px solid var(--color-warning-border)',
                    padding: '0 4px',
                    borderRadius: 3,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  title="Rejects from prior drop being made up"
                >
                  ↺ +{rejects} rejects
                </span>
              )}
              {!isSingleRun && adhoc > 0 && !wasSent && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--color-info)',
                    background: '#ffffff',
                    border: '1.5px solid var(--color-info)',
                    padding: '0 5px',
                    borderRadius: 999,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  title="Approved ad-hoc top-up from spoke request"
                >
                  + {adhoc} ad-hoc
                </span>
              )}
            </div>
          );
        })}
        <span
          style={{
            textAlign: 'right',
            fontSize: 14,
            fontWeight: 700,
            color: hasOrders
              ? isSingleRun && activeRunStatus === 'pending'
                ? 'var(--color-text-muted)'
                : 'var(--color-text-primary)'
              : 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
            opacity: isSingleRun && activeRunStatus === 'pending' ? 0.7 : 1,
            textDecoration:
              isSingleRun && activeRunStatus === 'sent' && hasOrders ? 'line-through' : 'none',
            textDecorationColor: 'var(--color-text-muted)',
          }}
          title={
            isSingleRun
              ? `${runFilter} · ${RUN_STATUS_COPY[activeRunStatus!].label}`
              : `${row.rowTotal + totalRejects} total units across all runs`
          }
        >
          {hasOrders
            ? isSingleRun
              ? rowBreakdown[runFilter as RunId].units
              : row.rowTotal + totalRejects
            : '—'}
        </span>
      </div>

      {/* Shortfall banner — only rendered when the hub's stubbed supply
          for this SKU is less than the row total. Tap opens the
          reallocation modal. Once applied, the banner flips to a
          "resolved" pill with the chosen strategy + a re-edit affordance. */}
      {row.availableSupply !== undefined && row.rowTotal > row.availableSupply && (
        <ShortfallBanner
          shortBy={row.rowTotal - row.availableSupply}
          promised={row.rowTotal}
          produced={row.availableSupply}
          result={shortfallResult}
          onOpen={onOpenShortfall}
        />
      )}

      {/* Expanded panel — per-spoke breakdown */}
      {isExpanded && (
        <div
          style={{
            padding: '14px 20px 14px 56px',
            background: 'var(--color-bg-surface)',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-muted)',
            }}
          >
            Per-spoke breakdown
          </div>
          {!hasOrders && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              No spoke has ordered {row.recipe.name} for {dayOfWeek(forDate)}. The hub still has
              this recipe on its menu.
            </div>
          )}
          {hasOrders && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {row.cells.map((c, i) => {
                const sub = submissions[i];
                const spoke = getSite(sub.fromSiteId);
                const transfer = transferFor(hubId, sub.fromSiteId, forDate);
                if (c.value === null || c.value === 0) {
                  return (
                    <div
                      key={sub.fromSiteId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      <span style={{ fontWeight: 600, minWidth: 140 }}>
                        {spoke?.name ?? sub.fromSiteId}
                      </span>
                      <span>did not order</span>
                    </div>
                  );
                }
                return (
                  <div
                    key={sub.fromSiteId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 11,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        minWidth: 140,
                      }}
                    >
                      {spoke?.name ?? sub.fromSiteId}
                    </span>
                    <DispatchStatusChip status={sub.status} hasTransfer={!!transfer} />
                    <ProvenanceChip status={sub.status} />
                    {c.isQuinn && (
                      <span
                        title="Edify's proposal — spoke hasn't confirmed"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: 10,
                          color: 'var(--color-warning)',
                        }}
                      >
                        <EdifyMark size={10} /> Edify proposal
                      </span>
                    )}
                    {transfer && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: 10,
                          color: 'var(--color-success)',
                          fontWeight: 700,
                        }}
                      >
                        <Check size={10} /> Sent {formatSentClock(transfer.sentAtISO)}
                      </span>
                    )}
                    <span style={{ flex: 1 }} />
                    <span
                      style={{
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {c.value} units
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

// ─── Run filter UI ───────────────────────────────────────────────────────────

function RunFilterStrip({
  value,
  onChange,
}: {
  value: RunFilter;
  onChange: (next: RunFilter) => void;
}) {
  const opts: Array<{ id: RunFilter; label: string; hint: string }> = [
    { id: 'all', label: 'All', hint: 'Show full row totals + per-run breakdown' },
    { id: 'R1', label: 'R1', hint: 'Filter to first dispatch run (already out)' },
    { id: 'R2', label: 'R2', hint: 'Filter to mid-morning top-up run' },
    { id: 'R3', label: 'R3', hint: 'Filter to lunch reset run' },
  ];
  return (
    <div
      role="tablist"
      aria-label="Filter by dispatch run"
      style={{
        display: 'inline-flex',
        background: 'var(--color-bg-hover)',
        borderRadius: 100,
        padding: 3,
        gap: 2,
      }}
    >
      {opts.map(opt => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            title={opt.hint}
            onClick={() => onChange(opt.id)}
            style={{
              padding: '5px 12px',
              borderRadius: 100,
              border: 'none',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              background: active ? 'var(--color-accent-active)' : 'transparent',
              color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
              transition: 'all 0.15s',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Per-row R1/R2/R3 status strip — shown inline in "All" mode beneath
 * the recipe name. Three tiny chips, one per run, each carrying the
 * unit slice and a status icon. Keeps the same vertical density as
 * the existing meta row so we don't bloat the recipe row.
 */
function RunStatusStrip({
  breakdown,
  compact,
}: {
  breakdown: RunBreakdown;
  compact?: boolean;
}) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {RUN_IDS.map(id => {
        const slice = breakdown[id];
        return (
          <span
            key={id}
            title={`${id} · ${RUN_STATUS_COPY[slice.status].label} · ${slice.units} units`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: compact ? '1px 5px' : '2px 6px',
              borderRadius: 4,
              border: `1px solid ${RUN_STATUS_COPY[slice.status].border}`,
              background: RUN_STATUS_COPY[slice.status].bg,
              color: RUN_STATUS_COPY[slice.status].tone,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.03em',
              fontVariantNumeric: 'tabular-nums',
              textDecoration: slice.status === 'sent' ? 'line-through' : 'none',
              textDecorationColor: 'currentColor',
            }}
          >
            <RunStatusIcon status={slice.status} size={9} />
            {id}
            <span style={{ fontWeight: 600, opacity: 0.85 }}>{slice.units}</span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * Single-run badge shown beside the recipe meta when a specific run
 * is selected — calls out whether THAT run is sent / ready / pending
 * for this recipe at a glance. Different from the per-cell rendering
 * because the badge is recipe-scoped, not spoke-scoped.
 */
function RunStatusBadge({ runId, status }: { runId: RunId; status: RunStatus }) {
  const copy = RUN_STATUS_COPY[status];
  return (
    <span
      title={`${runId} · ${copy.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        border: `1px solid ${copy.border}`,
        background: copy.bg,
        color: copy.tone,
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      <RunStatusIcon status={status} size={9} />
      {runId} · {copy.label}
    </span>
  );
}

function RunStatusIcon({ status, size = 10 }: { status: RunStatus; size?: number }) {
  if (status === 'sent') return <Check size={size} aria-hidden />;
  if (status === 'ready') return <Circle size={size} fill="currentColor" aria-hidden />;
  return <CircleDashed size={size} aria-hidden />;
}

function effectiveUnits(confirmed: number | null, quinn: number): number {
  return confirmed ?? quinn;
}

/**
 * Action area in each spoke control card. Three states:
 *  - already-sent: muted "✓ Sent HH:mm" pill + tiny Undo icon
 *  - sendable    : compact accent button "Send"
 *  - locked      : muted "Send" button with tooltip explaining why
 */
function SpokeSendControl({
  transfer,
  sendable,
  onSend,
  onUndo,
}: {
  transfer: DispatchTransfer | undefined;
  sendable: boolean;
  onSend: () => void;
  onUndo: () => void;
}) {
  if (transfer) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span
          title={`Sent ${transfer.totalUnits} units at ${formatSentClock(transfer.sentAtISO)}${
            transfer.note ? ` — ${transfer.note}` : ''
          }`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '3px 9px',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: '#ffffff',
            color: 'var(--color-success)',
            border: '1.5px solid var(--color-success)',
          }}
        >
          <Check size={10} />
          Sent {formatSentClock(transfer.sentAtISO)}
        </span>
        <button
          onClick={onUndo}
          aria-label="Undo dispatch"
          title="Undo dispatch (demo)"
          style={{
            width: 22,
            height: 22,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            borderRadius: 4,
            padding: 0,
          }}
        >
          <RotateCcw size={12} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={sendable ? onSend : undefined}
      disabled={!sendable}
      title={
        sendable
          ? 'Send this spoke its order'
          : 'Spoke order still draft — wait for submission'
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 10px',
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        background: sendable ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
        color: sendable ? 'var(--color-text-on-active)' : 'var(--color-text-muted)',
        border: '1px solid transparent',
        cursor: sendable ? 'pointer' : 'not-allowed',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <Truck size={11} />
      Send
    </button>
  );
}

function SummaryChip({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 6,
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        fontSize: 11,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <span
        style={{
          color: 'var(--color-text-muted)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontSize: 9,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: 'var(--color-text-primary)',
          fontWeight: bold ? 800 : 700,
          fontVariantNumeric: 'tabular-nums',
          fontSize: bold ? 13 : 12,
        }}
      >
        {value}
      </span>
    </span>
  );
}

/**
 * Compact "what is this site" badge surfaced beside the site name on the
 * spoke status card. Spoke is the implicit default so we leave it bare;
 * STANDALONE-linked sites get a "Linked" tag with a Link2 icon and a
 * tooltip explaining the dark-kitchen pattern; HYBRID sites get a "Hybrid"
 * tag. Helps the hub manager see at a glance which receivers depend
 * entirely on them vs which produce some things themselves.
 */
function LinkTypeChip({ site }: { site: Site }) {
  if (site.type === 'STANDALONE' && site.linkType === 'linked') {
    return (
      <span
        title="Linked standalone — dark kitchen, all bakery production from this hub"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          background: 'var(--color-bg-hover)',
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <Link2 size={9} />
        Linked
      </span>
    );
  }
  if (site.type === 'HYBRID') {
    return (
      <span
        title="Hybrid — produces some items locally, receives the rest from this hub"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          background: 'var(--color-bg-hover)',
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        Hybrid
      </span>
    );
  }
  return null;
}

// ─── Dispatch status + provenance chips ─────────────────────────────────────
//
// The dispatch screen used to surface the spoke's submission status
// directly (`SUBMITTED`, `ACKNOWLEDGED`, etc.). That language is
// spoke-side: it answers "what did the spoke do?" rather than what the
// hub manager actually cares about — "where is this dispatch in MY
// flow?". The chip below collapses the submission states into three
// dispatch-side states the manager works against:
//
//   - Awaiting order → spoke is still drafting; no action available
//   - Ready to send  → order locked; the Send button is live
//   - Dispatched     → manager has hit Send; transfer is in transit
//
// Order provenance (hub-edited, auto-locked, etc.) is still meaningful
// but secondary — it lives on a smaller `ProvenanceChip` rendered
// alongside the primary chip, only when there's a story to tell.
// "Submitted" / "Acknowledged" / vanilla submissions don't deserve a
// chip in the dispatch context — they're the default success path
// and the primary dispatch chip already says "Ready to send".

type DispatchStatus = 'awaiting-order' | 'ready' | 'dispatched';

function deriveDispatchStatus(
  subStatus: SpokeSubmission['status'],
  hasTransfer: boolean,
): DispatchStatus {
  if (hasTransfer) return 'dispatched';
  if (subStatus === 'draft') return 'awaiting-order';
  return 'ready';
}

const DISPATCH_STATUS_TREATMENTS: Record<
  DispatchStatus,
  { label: string; bg: string; color: string; border: string }
> = {
  'awaiting-order': {
    label: 'Awaiting order',
    bg: 'var(--color-warning-light)',
    color: 'var(--color-warning)',
    border: 'var(--color-warning-border)',
  },
  ready: {
    label: 'Ready to send',
    bg: '#ffffff',
    color: 'var(--color-success)',
    border: 'var(--color-success)',
  },
  dispatched: {
    label: 'Dispatched',
    bg: 'var(--color-bg-hover)',
    color: 'var(--color-text-secondary)',
    border: 'var(--color-border-subtle)',
  },
};

function DispatchStatusChip({
  status,
  hasTransfer,
}: {
  status: SpokeSubmission['status'];
  hasTransfer: boolean;
}) {
  const dispatchStatus = deriveDispatchStatus(status, hasTransfer);
  const t = DISPATCH_STATUS_TREATMENTS[dispatchStatus];
  return (
    <span
      title={t.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
      }}
    >
      {dispatchStatus === 'dispatched' ? (
        <Check size={9} aria-hidden />
      ) : dispatchStatus === 'ready' ? (
        <Circle size={9} fill="currentColor" aria-hidden />
      ) : (
        <CircleDashed size={9} aria-hidden />
      )}
      {t.label}
    </span>
  );
}

/**
 * Optional secondary chip — only rendered when the order's provenance
 * is worth surfacing (manager-edited, Quinn auto-locked). Plain
 * `submitted` / `acknowledged` orders deliberately don't render a chip
 * here so the spoke control card stays uncluttered.
 */
function ProvenanceChip({ status }: { status: SpokeSubmission['status'] }) {
  if (status === 'modified-by-hub') {
    return (
      <span
        title="Order was edited by the hub before lock-in"
        style={provenanceStyle()}
      >
        Hub-edited
      </span>
    );
  }
  if (status === 'auto-finalised') {
    return (
      <span
        title="Spoke didn't confirm by deadline — Edify auto-locked the proposal"
        style={provenanceStyle()}
      >
        <EdifyMark size={9} color="var(--color-text-muted)" /> Auto-locked
      </span>
    );
  }
  return null;
}

function provenanceStyle(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    padding: '2px 7px',
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    background: 'transparent',
    color: 'var(--color-text-muted)',
    border: '1px dashed var(--color-border)',
  };
}

/** Build a single-line tooltip explaining where each chunk of the cell qty came from. */
function tooltipFor(ordered: number, rejects: number, adhoc: number, isQuinn: boolean): string {
  const parts: string[] = [];
  if (ordered > 0) parts.push(isQuinn ? `Edify-proposed ${ordered}` : `Spoke ordered ${ordered}`);
  if (rejects > 0) parts.push(`+${rejects} from rejects`);
  if (adhoc > 0)   parts.push(`+${adhoc} approved ad-hoc`);
  return parts.length === 0
    ? (isQuinn ? 'Edify-proposed (not yet confirmed by spoke)' : 'Confirmed by spoke')
    : parts.join(' · ');
}

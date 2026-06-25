'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { ArrowRightLeft, Check, ChevronRight, Clock, Download, GripVertical, Moon, PackagePlus, Repeat, Shuffle, User, UserMinus, UtensilsCrossed, Waves } from 'lucide-react';
import {
  benchesAt,
  type Bench,
  type ProductionItemId,
  type ProductionMode,
  type Site,
} from './fixtures';
import { computeRelatedItems, usePlan, type PlanLine } from './PlanStore';
import {
  ASSIGNEE_BY_BENCH,
  RUN_ASSIGNEES_BY_BENCH,
  STAFF_ROSTER,
  UNASSIGNED,
  DEFAULT_WINDOW_START_MINS,
  DEFAULT_WINDOW_END_MINS,
  buildRowsForBench,
  bucketRowsIntoRuns,
  groupLabelFor,
  windowForGroup,
  runTiming,
  hhmmToMins,
  minsToHHMM,
  formatHMS,
  type RowData,
  type RunBucket,
  type ModeGroup,
  type RunTiming,
} from './benchPlanModel';
import { useNightShiftPolicy } from '@/components/Settings/nightShiftPolicyStore';
import { useHubExtras } from './hubExtrasStore';
import { downloadBenchPdf } from '@/lib/pdf/productionPdfs';

type HighlightMode = 'focus' | 'upstream' | 'downstream' | 'dim' | 'none';

type Props = {
  site: Site;
  date: string;
  /** Current demo time (HH:MM) — used for Remaining-time math when the bench window is in the past. */
  nowHHMM?: string;
  /** Focus a production item's dependency chain across all cards. */
  focusedItemId?: ProductionItemId | null;
  onFocusChange?: (itemId: ProductionItemId | null) => void;
  onClearFocus?: () => void;
  /** When set to a specific mode, only benches whose primaryMode matches are shown. */
  modeFilter?: ProductionMode | 'all';
  /**
   * When set to a specific run label (e.g. 'R1', 'R2', 'N1'), the board
   * scopes to that run only: benches without a matching scheduled run are
   * hidden, secondary mode groups (no run buckets) are hidden, and the
   * remaining cards render just the matching run bucket(s). 'all' is the
   * default and shows every run on every bench, as before.
   */
  runFilter?: string;
  /** Open the bench detail panel for the clicked bench. */
  onBenchClick?: (benchId: string) => void;
};

// ─── Stubbed cleaning & duties times per bench (minutes) ─────────────────────
const CLEANING_MINS_BY_BENCH: Record<string, number> = {
  // hub-central
  'bench-bakery':              30,
  'bench-prep':                20,
  'bench-sandwich-build':      15,
  'bench-salad-build':         15,
  'bench-hot-shelf':           25,
  'bench-variable':            10,
  'bench-cold-chain':          15,
  // site-standalone-north
  'bench-north-bakery':        20,
  'bench-north-prep':          15,
  'bench-north-build':         10,
  'bench-north-hot-shelf':     15,
  // site-hybrid-airport
  'bench-airport-hot-shelf':   20,
  'bench-airport-build':       10,
  'bench-airport-prep':        15,
  'bench-airport-cold-chain':  10,
};

const DEFAULT_CLEANING_MINS = 15;
const DUTIES_MINS = 10;

// ─── Card shape ──────────────────────────────────────────────────────────────
// Row / run-bucket / mode-group shapes + the pure compute helpers live in
// `benchPlanModel` so the bench cards and the per-run Balance view stay on
// the same numbers. CardData is the card-only view model and stays here.
type CardData = {
  bench: Bench;
  assignee: string;
  modeGroups: ModeGroup[];
  /** Sum of all groups' productionMins. */
  productionMins: number;
  cleaningMins: number;
  dutiesMins: number;
  totalMins: number;
  windowStartMins: number;
  windowEndMins: number;
  /** Open window in minutes. Red if totalMins exceeds this. */
  windowCapacityMins: number;
  /** True if any row on this bench exists. */
  hasWork: boolean;
};

/**
 * Reorder `rows` to match a manager's manual drag order. `order` is the
 * saved list of ProductionItemIds; rows present in it lead in that exact
 * order, and any rows not yet seen (newly planned) keep their natural
 * order at the tail. Returns the original array untouched when there's no
 * override so the default (estimated-time) sort is preserved.
 */
function applyRowOrder(rows: RowData[], order: string[] | undefined): RowData[] {
  if (!order || order.length === 0) return rows;
  const rank = new Map(order.map((id, i) => [id, i]));
  const fallback = order.length;
  return [...rows].sort((a, b) => {
    const ra = rank.get(a.line.item.id) ?? fallback;
    const rb = rank.get(b.line.item.id) ?? fallback;
    return ra - rb;
  });
}

export default function BenchCardBoard({
  site,
  date,
  nowHHMM,
  focusedItemId,
  onFocusChange,
  onClearFocus,
  modeFilter = 'all',
  runFilter = 'all',
  onBenchClick,
}: Props) {
  const lines = usePlan(site.id, date);

  // PAC070 / P129 — the night-shift bucketing + ordering uses the live
  // central policy from the Support Centre store. Changes to the
  // policy (via the Night-shift settings tab) flow through here on the
  // next render because `policy` is in the `cards` memo dep array.
  const { policy: nightShiftPolicy } = useNightShiftPolicy();

  // Hub-side off-list extras the GM has stamped on the matrix. Lifts
  // the bench's `totalQty` (and therefore the batch split) so the
  // floor bakes the right number; the chip on each row makes the
  // off-list portion visible to the bench team.
  const { getExtras } = useHubExtras();

  // Local manager-applied assignment overrides. Sentinel `UNASSIGNED`
  // means the manager explicitly cleared the seeded assignee. Lives in
  // local state so the demo can reassign benches around the team
  // without persisting anywhere — closes/reloads return to the stub
  // map. When users + roles ship, this hook is the place to swap to a
  // real store.
  const [assignmentOverrides, setAssignmentOverrides] = useState<Record<string, string>>({});

  const setAssignment = useCallback((benchId: string, name: string) => {
    setAssignmentOverrides(prev => ({ ...prev, [benchId]: name }));
  }, []);

  // Per-run overrides. Keyed by `${benchId}:${runId}` so each run on
  // each bench can have its own person. Falls back through
  // `RUN_ASSIGNEES_BY_BENCH` and finally the bench-level lead. Same
  // demo-scope rationale as `assignmentOverrides`.
  const [runAssignmentOverrides, setRunAssignmentOverrides] = useState<Record<string, string>>({});

  const setRunAssignment = useCallback((benchId: string, runId: string, name: string) => {
    setRunAssignmentOverrides(prev => ({ ...prev, [`${benchId}:${runId}`]: name }));
  }, []);

  // Per-line bench overrides — manager moves work between benches via
  // the row's "move to" picker. Keyed by ProductionItemId → destination
  // benchId. Same demo-scope rationale as `assignmentOverrides`: lives
  // in memory, resets on reload. Wins over the line's natural
  // `primaryBench.id` when bucketing rows into bench cards.
  const [benchOverrides, setBenchOverrides] = useState<Record<string, string>>({});

  const moveLineToBench = useCallback((itemId: string, benchId: string) => {
    setBenchOverrides(prev => ({ ...prev, [itemId]: benchId }));
  }, []);

  // Manual row ordering — manager drags a recipe up/down its list via the
  // row's grip handle. Keyed by a per-list id (one list = a bench's flat
  // mode group, or a single run bucket on a run-mode bench) → the ordered
  // ProductionItemIds. Demo-scoped: lives in memory, resets on reload.
  const [rowOrderOverrides, setRowOrderOverrides] = useState<Record<string, string[]>>({});

  const reorderRows = useCallback((listKey: string, orderedItemIds: string[]) => {
    setRowOrderOverrides(prev => ({ ...prev, [listKey]: orderedItemIds }));
  }, []);

  // Manager-editable bench start/end window. Keyed by benchId → minutes from
  // midnight for the start and/or end. Overrides the computed schedule window
  // shown in the card footer. Demo-scoped: in memory, resets on reload.
  const [windowOverrides, setWindowOverrides] = useState<
    Record<string, { startMins?: number; endMins?: number }>
  >({});

  const setBenchWindow = useCallback(
    (benchId: string, field: 'start' | 'end', mins: number) => {
      const key = field === 'start' ? 'startMins' : 'endMins';
      setWindowOverrides(prev => ({
        ...prev,
        [benchId]: { ...(prev[benchId] ?? {}), [key]: mins },
      }));
    },
    [],
  );

  const siteBenches = useMemo(() => benchesAt(site.id), [site.id]);

  // Group lines by their primary bench.
  const cards = useMemo<CardData[]>(() => {
    const byBench = new Map<string, PlanLine[]>();
    for (const line of lines) {
      if (line.effectivePlanned <= 0) continue;
      const overrideBenchId = benchOverrides[line.item.id];
      const benchId = overrideBenchId ?? line.primaryBench?.id;
      if (!benchId) continue;
      const arr = byBench.get(benchId) ?? [];
      arr.push(line);
      byBench.set(benchId, arr);
    }

    return siteBenches.map(bench => {
      const benchLines = byBench.get(bench.id) ?? [];

      // Convert lines → row data (batch split + est time) via the shared
      // model so the cards and the per-run Balance view never diverge on
      // quantities or estimated bench time.
      const rows: RowData[] = buildRowsForBench(bench, benchLines, site.id, date, getExtras);

      // Group by production mode. Multiple rows with the same mode become one
      // "run" on this bench (e.g. bakery R1, sandwich lunch build).
      const byMode = new Map<ProductionMode, RowData[]>();
      for (const r of rows) {
        const mode = r.line.item.mode;
        const arr = byMode.get(mode) ?? [];
        arr.push(r);
        byMode.set(mode, arr);
      }

      // Emit the bench's primary mode first (its "scheduled runs"), then any
      // secondary modes as after-service tails. A bench with no assigned
      // primaryMode (e.g. front-of-house) falls back to natural order.
      const fallbackOrder: ProductionMode[] = ['run', 'variable', 'increment'];
      const orderedModes: ProductionMode[] = bench.primaryMode
        ? [bench.primaryMode, ...fallbackOrder.filter(m => m !== bench.primaryMode)]
        : fallbackOrder;

      const modeGroups: ModeGroup[] = [];
      for (const mode of orderedModes) {
        const groupRows = byMode.get(mode);
        if (!groupRows || groupRows.length === 0) continue;
        groupRows.sort((a, b) => b.estMinutes - a.estMinutes);
        const productionMins = groupRows.reduce((s, r) => s + r.estMinutes, 0);
        const isPrimary = bench.primaryMode === mode || !bench.primaryMode;
        const { windowStartMins, windowEndMins, throughoutDay } = windowForGroup(
          mode,
          groupRows,
          productionMins,
          isPrimary,
        );
        // If this is a run-mode primary group and the bench has a runs
        // schedule, split rows into R1/R2 buckets by peak demand phase so
        // the card can render per-run subsections and surface "next run".
        const runBuckets =
          isPrimary && mode === 'run' && bench.runs && bench.runs.length > 0
            ? bucketRowsIntoRuns(groupRows, bench.runs, nightShiftPolicy)
            : undefined;

        // Apply any manual drag-reorder the manager has set. Each rendered
        // list keeps its own order: per run bucket on run-mode benches, or
        // the flat group list otherwise.
        if (runBuckets) {
          for (const b of runBuckets) {
            b.rows = applyRowOrder(b.rows, rowOrderOverrides[`${bench.id}::run::${b.run.id}`]);
          }
        }
        const orderedGroupRows = applyRowOrder(groupRows, rowOrderOverrides[`${bench.id}::mode::${mode}`]);

        modeGroups.push({
          mode,
          label: groupLabelFor(mode, bench, groupRows, isPrimary, !!runBuckets),
          isPrimary,
          rows: orderedGroupRows,
          productionMins,
          windowStartMins,
          windowEndMins,
          throughoutDay,
          runBuckets,
        });
      }

      const productionMins = modeGroups.reduce((s, g) => s + g.productionMins, 0);
      const cleaningMins = CLEANING_MINS_BY_BENCH[bench.id] ?? DEFAULT_CLEANING_MINS;
      const dutiesMins = DUTIES_MINS;
      const totalMins = productionMins + cleaningMins + dutiesMins;

      // Bench-level window: earliest group start → latest group end.
      const windowStartMins = modeGroups.length > 0
        ? Math.min(...modeGroups.map(g => g.windowStartMins))
        : DEFAULT_WINDOW_START_MINS;
      const windowEndMins = modeGroups.length > 0
        ? Math.max(...modeGroups.map(g => g.windowEndMins))
        : DEFAULT_WINDOW_END_MINS;
      const windowCapacityMins = Math.max(0, windowEndMins - windowStartMins);

      // Override wins; falls back to the seeded stub; finally Unassigned.
      const overridden = assignmentOverrides[bench.id];
      const assignee =
        overridden !== undefined
          ? overridden === UNASSIGNED
            ? 'Unassigned'
            : overridden
          : ASSIGNEE_BY_BENCH[bench.id] ?? 'Unassigned';

      // Resolve the assignee for each scheduled run bucket. Per-run
      // overrides win, then the seeded `RUN_ASSIGNEES_BY_BENCH` map,
      // and finally the bench's own lead/default. This way a bench can
      // have R1 = Farah, R2 = Bea without forcing the manager to set
      // both — they can also tweak any run from its header chip.
      const runSeeded = RUN_ASSIGNEES_BY_BENCH[bench.id] ?? {};
      for (const group of modeGroups) {
        if (!group.runBuckets) continue;
        for (const b of group.runBuckets) {
          const runOverride = runAssignmentOverrides[`${bench.id}:${b.run.id}`];
          b.assignee =
            runOverride !== undefined
              ? runOverride === UNASSIGNED
                ? 'Unassigned'
                : runOverride
              : runSeeded[b.run.id] ?? assignee;
        }
      }

      return {
        bench,
        assignee,
        modeGroups,
        productionMins,
        cleaningMins,
        dutiesMins,
        totalMins,
        windowStartMins,
        windowEndMins,
        windowCapacityMins,
        hasWork: rows.length > 0,
      };
    });
  }, [lines, siteBenches, assignmentOverrides, runAssignmentOverrides, benchOverrides, rowOrderOverrides, nightShiftPolicy, getExtras, site.id, date]);

  // Dependency-highlight resolver (same machinery as KitchenBoard).
  const highlightFor = useMemo<(itemId: string) => HighlightMode>(() => {
    if (!focusedItemId) return () => 'none';
    const related = computeRelatedItems(site.id, focusedItemId);
    return (itemId: string) => {
      if (itemId === related.focus) return 'focus';
      if (related.upstream.has(itemId)) return 'upstream';
      if (related.downstream.has(itemId)) return 'downstream';
      return 'dim';
    };
  }, [focusedItemId, site.id]);

  const toggleFocus = useCallback(
    (itemId: ProductionItemId) => {
      if (focusedItemId === itemId) {
        onClearFocus?.();
      } else {
        onFocusChange?.(itemId);
      }
    },
    [focusedItemId, onFocusChange, onClearFocus],
  );

  // Download the per-bench PDF using the same `lines` snapshot the cards are
  // rendered from, so any in-session manager overrides are reflected.
  const downloadBench = useCallback(
    (benchId: string) => {
      downloadBenchPdf({ siteId: site.id, date, benchId, lines });
    },
    [site.id, date, lines],
  );

  // Filter cards by selected mode tab — keep benches whose primary mode matches.
  // When a specific batch (P1/P2/N1/...) is selected we keep the FULL roster
  // of run-mode benches visible — not just the ones scheduled for that batch
  // — so the bench count stays consistent across batches (matching the
  // Balance view). A bench that doesn't run the selected batch renders its
  // card with a "no recipes scheduled for {batch} today" placeholder rather
  // than disappearing. Benches with no run schedule at all (e.g. a
  // front-of-house counter) drop out while a batch filter is active.
  const visibleCards = useMemo(() => {
    const byMode = modeFilter === 'all'
      ? cards
      : cards.filter(c => c.bench.primaryMode === modeFilter);
    if (runFilter === 'all') return byMode;
    // Keep run-scheduled benches (they render a per-batch view, or a "no recipes
    // for this batch" placeholder) and increment/make-to-order benches (no run
    // schedule — they stay fully visible across every batch tab). Only a bench
    // with neither a run schedule nor an increment mode drops out.
    return byMode.filter(c => (c.bench.runs?.length ?? 0) > 0 || c.bench.primaryMode === 'increment');
  }, [cards, modeFilter, runFilter]);

  return (
    <div style={{ padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Masonry-style bench card layout via CSS multi-column.
          We use columns (not Grid) so a short card doesn't waste vertical
          space waiting for the tallest card in its row to end — the next
          card simply stacks under it within the same column. `break-inside:
          avoid` keeps each card whole rather than splitting across columns.
          Always two columns on desktop; collapse to one on mobile (<=640px,
          matching the breakpoint used elsewhere). */}
      <style>{`
        .bench-detail-columns { column-count: 2; column-gap: 44px; }
        @media (max-width: 640px) { .bench-detail-columns { column-count: 1; } }
      `}</style>
      <div className="bench-detail-columns">
        {visibleCards.map(card => (
          <div
            key={card.bench.id}
            style={{
              breakInside: 'avoid',
              pageBreakInside: 'avoid',
              marginBottom: 44,
              display: 'block',
            }}
          >
            <BenchCard
              card={card}
              nowHHMM={nowHHMM}
              highlightFor={highlightFor}
              hasFocus={focusedItemId != null}
              onRowClick={toggleFocus}
              onBenchClick={onBenchClick}
              onDownloadBench={downloadBench}
              onAssign={setAssignment}
              onAssignRun={setRunAssignment}
              siteBenches={siteBenches}
              onMoveLine={moveLineToBench}
              onReorder={reorderRows}
              runFilter={runFilter}
              windowOverride={windowOverrides[card.bench.id]}
              onSetWindow={setBenchWindow}
            />
          </div>
        ))}
      </div>
      {visibleCards.length === 0 && (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: 12,
            border: '1px dashed var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
            background: '#ffffff',
          }}
        >
          No benches in this mode at this site.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bench card
// ─────────────────────────────────────────────────────────────────────────────

function BenchCard({
  card,
  nowHHMM,
  highlightFor,
  hasFocus,
  onRowClick,
  onBenchClick,
  onDownloadBench,
  onAssign,
  onAssignRun,
  siteBenches,
  onMoveLine,
  onReorder,
  runFilter = 'all',
  windowOverride,
  onSetWindow,
}: {
  card: CardData;
  nowHHMM?: string;
  highlightFor: (itemId: string) => HighlightMode;
  hasFocus: boolean;
  onRowClick: (itemId: ProductionItemId) => void;
  onBenchClick?: (benchId: string) => void;
  onDownloadBench?: (benchId: string) => void;
  onAssign?: (benchId: string, name: string) => void;
  /** Set the assignee for a specific run on this bench (R1/R2/N1). */
  onAssignRun?: (benchId: string, runId: string, name: string) => void;
  /** All benches at the active site — destinations the row picker offers. */
  siteBenches: Bench[];
  /** Move a planned recipe row from this bench to another bench. */
  onMoveLine?: (itemId: ProductionItemId, benchId: string) => void;
  /** Persist a manual drag-reorder for one list (run bucket or flat group). */
  onReorder?: (listKey: string, orderedItemIds: string[]) => void;
  /** Run-label filter from the board toolbar. 'all' renders every run. */
  runFilter?: string;
  /** Manager-edited start/end window (minutes from midnight), if any. */
  windowOverride?: { startMins?: number; endMins?: number };
  /** Commit an edited start/end time for this bench. */
  onSetWindow?: (benchId: string, field: 'start' | 'end', mins: number) => void;
}) {
  // While a run filter is active, keep the primary run group only if it has a
  // matching scheduled run bucket (ModeGroupSection narrows its buckets to the
  // selected run). Secondary off-mode work (variable / increment tails — e.g.
  // toasties, soups, smoothies, coffees) has no run schedule, so we always
  // show it under the "After service" divider rather than hiding it.
  const visibleModeGroups = useMemo(() => {
    if (runFilter === 'all') return card.modeGroups;
    return card.modeGroups.filter(g =>
      // Secondary off-mode tails always show. A primary group shows if it has a
      // matching run bucket, OR if it isn't batch-scheduled at all (an
      // increment/make-to-order bench) — those run all day, so they stay fully
      // visible under every batch tab rather than disappearing.
      !g.isPrimary || (g.runBuckets ? g.runBuckets.some(b => b.run.label === runFilter) : true)
    );
  }, [card.modeGroups, runFilter]);
  const allRows = useMemo(() => card.modeGroups.flatMap(g => g.rows), [card.modeGroups]);

  // If a focus is active and no row on this card is related, dim the whole card.
  const cardHasRelatedRow = useMemo(() => {
    if (!hasFocus) return true;
    return allRows.some(r => {
      const h = highlightFor(r.line.item.id);
      return h === 'focus' || h === 'upstream' || h === 'downstream';
    });
  }, [allRows, highlightFor, hasFocus]);

  const cardOpacity = hasFocus && !cardHasRelatedRow ? 0.4 : 1;

  // Effective start/end window: manager edits win over the computed schedule
  // window. End defaults to "start + total work" (so default Remaining is 0);
  // Remaining is the slack between the chosen window and the work needed.
  const effectiveStartMins = windowOverride?.startMins ?? card.windowStartMins;
  const effectiveEndMins = windowOverride?.endMins ?? card.windowStartMins + card.totalMins;
  const remainingMins = Math.max(0, effectiveEndMins - effectiveStartMins - card.totalMins);

  // Find the next / active run for the header chip. We use the primary
  // run-mode group's buckets if present. "Active" wins over "upcoming" — the
  // team cares most about the run they're in.
  const primaryGroup = card.modeGroups.find(g => g.isPrimary);
  const nextRunInfo = nowHHMM && primaryGroup?.runBuckets
    ? findNextRun(primaryGroup.runBuckets, nowHHMM)
    : null;

  // The run window (start → end) now lives in the bench header instead of
  // a separate run-bucket header row. With a run filter active we surface
  // the selected run's window; otherwise the first scheduled run.
  const headerRun = useMemo(() => {
    const buckets = primaryGroup?.runBuckets;
    if (!buckets || buckets.length === 0) return null;
    if (runFilter !== 'all') return buckets.find(b => b.run.label === runFilter) ?? null;
    return buckets[0];
  }, [primaryGroup, runFilter]);

  return (
    <section
      style={{
        background: '#ffffff',
        border: '1.5px solid var(--color-accent-active)',
        borderRadius: 'var(--radius-card)',
        padding: 0,
        opacity: cardOpacity,
        transition: 'opacity 120ms ease',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      {/* Header — bench name + its assigned production mode (Pret convention: 1 bench = 1 mode) */}
      <header
        onClick={() => onBenchClick?.(card.bench.id)}
        role={onBenchClick ? 'button' : undefined}
        tabIndex={onBenchClick ? 0 : undefined}
        onKeyDown={
          onBenchClick
            ? e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onBenchClick(card.bench.id);
                }
              }
            : undefined
        }
        title={onBenchClick ? 'View ingredient totals for this bench' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 22px',
          borderBottom: '1px solid var(--color-border-subtle)',
          gap: 16,
          cursor: onBenchClick ? 'pointer' : 'default',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <h3
            style={{
              fontSize: 20,
              fontWeight: 700,
              margin: 0,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.005em',
            }}
          >
            {card.bench.name}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {card.bench.primaryMode && <ModeBadge mode={card.bench.primaryMode} />}
            {nextRunInfo && <NextRunChip info={nextRunInfo} />}
            {headerRun && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: 'var(--color-text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <Clock size={12} />
                {minsToHHMM(headerRun.startMins)} → {minsToHHMM(headerRun.endMins)}
              </span>
            )}
            {!card.bench.online && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--color-error)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                OFFLINE
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <AssigneeChip
            assignee={card.assignee}
            onAssign={onAssign ? name => onAssign(card.bench.id, name) : undefined}
          />
          {onDownloadBench && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onDownloadBench(card.bench.id);
              }}
              onKeyDown={e => e.stopPropagation()}
              aria-label={`Download ${card.bench.name} bench plan PDF`}
              title="Download bench plan PDF"
              style={{
                width: 32,
                height: 32,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                background: '#ffffff',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Download size={15} />
            </button>
          )}
        </div>
      </header>

      {/* Mode groups (runs). Primary first; secondary modes rendered under an
          "After service" divider. When a run filter is active and the bench
          is scheduled for that run but has no recipes assigned to it today,
          show a focused empty state instead of an awkward blank card body. */}
      {runFilter !== 'all' && visibleModeGroups.length === 0 ? (
        <div style={{ padding: '18px 14px', fontSize: 12, color: 'var(--color-text-muted)' }}>
          No recipes scheduled for {runFilter} on this bench today.
        </div>
      ) : card.hasWork ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {visibleModeGroups.map((group, idx, arr) => {
            const prev = idx > 0 ? arr[idx - 1] : null;
            const firstSecondary = !group.isPrimary && (!prev || prev.isPrimary);
            return (
              <div key={`${card.bench.id}-${group.mode}`}>
                {firstSecondary && <AfterServiceDivider />}
                <ModeGroupSection
                  group={group}
                  isFirst={idx === 0}
                  nowHHMM={nowHHMM}
                  highlightFor={highlightFor}
                  onRowClick={onRowClick}
                  currentBenchId={card.bench.id}
                  siteBenches={siteBenches}
                  onMoveLine={onMoveLine}
                  onReorder={onReorder}
                  runFilter={runFilter}
                  onAssignRun={onAssignRun}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: '18px 14px', fontSize: 12, color: 'var(--color-text-muted)' }}>
          No recipes on this bench today.
        </div>
      )}

      {/* Totals */}
      {card.hasWork && (
        <div
          style={{
            padding: '16px 22px',
            borderTop: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-hover)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <TotalRow label="Production time" value={formatHMS(card.productionMins)} />
          <TotalRow label="Cleaning time" value={formatHMS(card.cleaningMins)} />
          <TotalRow label="Duties" value={formatHMS(card.dutiesMins)} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--color-border-subtle)',
              paddingTop: 10,
              marginTop: 4,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              fontSize: 13,
            }}
          >
            <span>Total time</span>
            <span>{formatHMS(card.totalMins)}</span>
          </div>
        </div>
      )}

      {/* Stopwatch row */}
      <footer
        style={{
          padding: '14px 22px',
          borderTop: '1px solid var(--color-border-subtle)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 14,
          fontSize: 11,
          color: 'var(--color-text-muted)',
        }}
      >
        <EditableStopwatchCell
          label="Start"
          mins={effectiveStartMins}
          onCommit={onSetWindow ? mins => onSetWindow(card.bench.id, 'start', mins) : undefined}
        />
        <EditableStopwatchCell
          label="End"
          mins={effectiveEndMins}
          onCommit={onSetWindow ? mins => onSetWindow(card.bench.id, 'end', mins) : undefined}
        />
        <StopwatchCell label="Remaining" value={formatHMS(remainingMins)} emphasis="muted" />
      </footer>

      {nowHHMM && card.windowStartMins > 0 && nowAfterStart(nowHHMM, card.windowStartMins) && (
        <div
          style={{
            padding: '8px 22px',
            fontSize: 10,
            color: 'var(--color-text-muted)',
            borderTop: '1px dashed var(--color-border-subtle)',
          }}
        >
          Started · {nowHHMM}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode group (run) section + Row
// ─────────────────────────────────────────────────────────────────────────────

const MODE_TREATMENT: Record<ProductionMode, {
  icon: typeof Repeat;
  label: string;
  headerBg: string;
  dashedBorder: boolean;
  sectionTint?: string;
}> = {
  run: {
    icon: Repeat,
    label: 'Run',
    headerBg: '#ffffff',
    dashedBorder: false,
  },
  variable: {
    icon: Shuffle,
    label: 'Variable',
    headerBg: '#ffffff',
    dashedBorder: true,
  },
  increment: {
    icon: Waves,
    label: 'Increment',
    headerBg: 'var(--color-bg-hover)',
    dashedBorder: false,
  },
};

function ModeGroupSection({
  group,
  isFirst,
  nowHHMM,
  highlightFor,
  onRowClick,
  currentBenchId,
  siteBenches,
  onMoveLine,
  onReorder,
  runFilter = 'all',
  onAssignRun,
}: {
  group: ModeGroup;
  isFirst: boolean;
  nowHHMM?: string;
  highlightFor: (itemId: string) => HighlightMode;
  onRowClick: (itemId: ProductionItemId) => void;
  currentBenchId: string;
  siteBenches: Bench[];
  onMoveLine?: (itemId: ProductionItemId, benchId: string) => void;
  /** Persist a manual drag-reorder for one list (run bucket or flat group). */
  onReorder?: (listKey: string, orderedItemIds: string[]) => void;
  /** Active run label from the toolbar, or 'all' to show every bucket. */
  runFilter?: string;
  /** Set the assignee for a specific run on the current bench. */
  onAssignRun?: (benchId: string, runId: string, name: string) => void;
}) {
  const treatment = MODE_TREATMENT[group.mode];
  // Secondary (off-mode) groups are rendered muted so they read as
  // "incidental, post-service" work rather than a peer to the main run.
  const sectionOpacity = group.isPrimary ? 1 : 0.7;
  // Narrow the group's scheduled runs to just the selected run when a
  // run filter is active. Done here (rather than at the data layer) so
  // bench-level totals & windows keep representing the full day even
  // while the rendered content is scoped to a single run.
  const visibleRunBuckets = useMemo(() => {
    if (!group.runBuckets || runFilter === 'all') return group.runBuckets;
    return group.runBuckets.filter(b => b.run.label === runFilter);
  }, [group.runBuckets, runFilter]);

  return (
    <div
      style={{
        background: treatment.sectionTint ?? 'transparent',
        borderTop: isFirst ? 'none' : '1px solid var(--color-border-subtle)',
        opacity: sectionOpacity,
      }}
    >
      {/* Mode-group section header (RUN · Scheduled runs · 05:00–18:23 · 12
          recipes, VARIABLE · Snack build · …, etc.) intentionally omitted.
          The header restated the bench card's own framing and made the
          card top read like there were two competing summaries. Run buckets
          (R1/R2) and individual recipe rows below carry the per-section
          context we actually need. */}

      {/* When the group has scheduled runs (R1/R2), render each run as its
          own labelled subsection. Otherwise fall back to a single flat list. */}
      {visibleRunBuckets && visibleRunBuckets.length > 0 ? (
        visibleRunBuckets.map((bucket, idx) => (
          <RunBucketSection
            key={bucket.run.id}
            bucket={bucket}
            isFirst={idx === 0}
            nowHHMM={nowHHMM}
            highlightFor={highlightFor}
            onRowClick={onRowClick}
            currentBenchId={currentBenchId}
            siteBenches={siteBenches}
            onMoveLine={onMoveLine}
            onReorder={onReorder}
            onAssignRun={onAssignRun}
          />
        ))
      ) : (
        <>
          <ColumnHeader />
          <ReorderableRows
            rows={group.rows}
            listKey={`${currentBenchId}::mode::${group.mode}`}
            onReorder={onReorder}
            highlightFor={highlightFor}
            onRowClick={onRowClick}
            currentBenchId={currentBenchId}
            siteBenches={siteBenches}
            onMoveLine={onMoveLine}
          />
        </>
      )}
    </div>
  );
}

function ColumnHeader() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto auto auto',
        gap: 14,
        padding: '10px 22px',
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <span style={{ width: 16 }} />
      <span>Recipe</span>
      <span style={{ textAlign: 'right', minWidth: 36 }}>Qty</span>
      <span style={{ textAlign: 'right', minWidth: 56 }}>Time</span>
      <span style={{ width: 22 }} />
      <span style={{ width: 14 }} />
    </div>
  );
}

/**
 * Drag-to-reorder wrapper around a list of RecipeRows. One instance per
 * rendered list (a run bucket, or a bench's flat mode group). Uses native
 * HTML5 drag-and-drop; a row only becomes draggable while the manager is
 * pressing its grip handle (`armedRef`), so normal clicks, the move-bench
 * picker, and text stay unaffected. On drop it computes the new order of
 * ProductionItemIds and hands it up via `onReorder` to persist.
 */
function ReorderableRows({
  rows,
  listKey,
  onReorder,
  highlightFor,
  onRowClick,
  currentBenchId,
  siteBenches,
  onMoveLine,
}: {
  rows: RowData[];
  listKey: string;
  onReorder?: (listKey: string, orderedItemIds: string[]) => void;
  highlightFor: (itemId: string) => HighlightMode;
  onRowClick: (itemId: ProductionItemId) => void;
  currentBenchId: string;
  siteBenches: Bench[];
  onMoveLine?: (itemId: ProductionItemId, benchId: string) => void;
}) {
  const reorderable = !!onReorder && rows.length > 1;
  const armedRef = useRef(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const ids = rows.map(r => r.line.item.id);

  const finishDrop = (targetId: string) => {
    const from = dragId;
    setDragId(null);
    setOverId(null);
    armedRef.current = false;
    if (!from || from === targetId || !onReorder) return;
    const fromIdx = ids.indexOf(from);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = ids.filter(id => id !== from);
    const insertAt = fromIdx < toIdx ? next.indexOf(targetId) + 1 : next.indexOf(targetId);
    next.splice(insertAt, 0, from);
    onReorder(listKey, next);
  };

  return (
    <>
      {rows.map(row => {
        const itemId = row.line.item.id;
        return (
          <RecipeRow
            key={itemId}
            row={row}
            highlight={highlightFor(itemId)}
            onClick={() => onRowClick(itemId)}
            currentBenchId={currentBenchId}
            siteBenches={siteBenches}
            onMoveLine={onMoveLine}
            reorderable={reorderable}
            dragging={dragId === itemId}
            dragOver={overId === itemId && dragId !== null && dragId !== itemId}
            onHandlePress={() => { armedRef.current = true; }}
            onHandleRelease={() => { armedRef.current = false; }}
            onRowDragStart={e => {
              if (!armedRef.current) { e.preventDefault(); return; }
              setDragId(itemId);
              e.dataTransfer.effectAllowed = 'move';
              try { e.dataTransfer.setData('text/plain', itemId); } catch { /* some browsers throw on setData in tests */ }
            }}
            onRowDragEnd={() => { setDragId(null); setOverId(null); armedRef.current = false; }}
            onRowDragOver={e => { if (dragId) { e.preventDefault(); setOverId(itemId); } }}
            onRowDrop={e => { e.preventDefault(); finishDrop(itemId); }}
          />
        );
      })}
    </>
  );
}

/**
 * Renders one scheduled run (R1, R2, …) inside a run-mode mode group.
 * Header shows the run label + its start→end window + state pill
 * (Upcoming / In progress / Done) relative to the demo clock.
 */
function RunBucketSection({
  bucket,
  isFirst,
  nowHHMM,
  highlightFor,
  onRowClick,
  currentBenchId,
  siteBenches,
  onMoveLine,
  onReorder,
  onAssignRun,
}: {
  bucket: RunBucket;
  isFirst: boolean;
  nowHHMM?: string;
  highlightFor: (itemId: string) => HighlightMode;
  onRowClick: (itemId: ProductionItemId) => void;
  currentBenchId: string;
  siteBenches: Bench[];
  onMoveLine?: (itemId: ProductionItemId, benchId: string) => void;
  /** Persist a manual drag-reorder for this run bucket. */
  onReorder?: (listKey: string, orderedItemIds: string[]) => void;
  /** Reassign just this run on the current bench. */
  onAssignRun?: (benchId: string, runId: string, name: string) => void;
}) {
  // The run-bucket header row (run label, window, duration, recipe count,
  // assignee, state pill) was removed: the assignee duplicated the bench
  // header's, and the run window now lives in the bench header. We keep just
  // the column header + recipe rows here.
  return (
    <div
      style={{
        borderTop: isFirst ? '1px solid var(--color-border-subtle)' : '1px dashed var(--color-border-subtle)',
      }}
    >
      <ColumnHeader />

      <ReorderableRows
        rows={bucket.rows}
        listKey={`${currentBenchId}::run::${bucket.run.id}`}
        onReorder={onReorder}
        highlightFor={highlightFor}
        onRowClick={onRowClick}
        currentBenchId={currentBenchId}
        siteBenches={siteBenches}
        onMoveLine={onMoveLine}
      />
    </div>
  );
}

function ModeBadge({ mode }: { mode: ProductionMode }) {
  const treatment = MODE_TREATMENT[mode];
  const Icon = treatment.icon;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 9px',
        borderRadius: 999,
        background: '#ffffff',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border-subtle)',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={10} />
      {treatment.label}
    </span>
  );
}

function RecipeRow({
  row,
  highlight,
  onClick,
  currentBenchId,
  siteBenches,
  onMoveLine,
  reorderable = false,
  dragging = false,
  dragOver = false,
  onHandlePress,
  onHandleRelease,
  onRowDragStart,
  onRowDragEnd,
  onRowDragOver,
  onRowDrop,
}: {
  row: RowData;
  highlight: HighlightMode;
  onClick: () => void;
  currentBenchId: string;
  siteBenches: Bench[];
  onMoveLine?: (itemId: ProductionItemId, benchId: string) => void;
  /** When true the row can be dragged (by its grip) to reorder the list. */
  reorderable?: boolean;
  /** This row is the one currently being dragged. */
  dragging?: boolean;
  /** A dragged row is hovering over this row (drop target). */
  dragOver?: boolean;
  onHandlePress?: () => void;
  onHandleRelease?: () => void;
  onRowDragStart?: (e: DragEvent) => void;
  onRowDragEnd?: (e: DragEvent) => void;
  onRowDragOver?: (e: DragEvent) => void;
  onRowDrop?: (e: DragEvent) => void;
}) {
  const { line, totalQty, estMinutes, extrasUnits, teamFoodUnits } = row;
  const hasExtras = extrasUnits > 0;
  const hasTeamFood = teamFoodUnits > 0;

  const tone =
    highlight === 'focus'      ? { bg: 'var(--color-bg-hover)',  accent: 'var(--color-accent-active)', opacity: 1 } :
    highlight === 'upstream'   ? { bg: 'var(--color-bg-hover)',  accent: 'var(--color-text-secondary)', opacity: 1 } :
    highlight === 'downstream' ? { bg: 'var(--color-bg-hover)',  accent: 'var(--color-text-muted)',     opacity: 1 } :
    highlight === 'dim'        ? { bg: '#ffffff',                accent: 'var(--color-text-muted)',     opacity: 0.35 } :
                                 { bg: '#ffffff',                accent: 'var(--color-text-muted)',     opacity: 1 };

  const dispatchUnits = line.dispatchDemand;

  // Outer is now a `div role="button"` rather than a real <button>, so it can
  // contain interactive children (the "move to bench" picker). Behaviour
  // matches the previous button: click + Enter / Space fire `onClick`.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      draggable={reorderable}
      onDragStart={onRowDragStart}
      onDragEnd={onRowDragEnd}
      onDragOver={onRowDragOver}
      onDrop={onRowDrop}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto auto auto',
        gap: 14,
        alignItems: 'center',
        padding: '14px 22px',
        fontSize: 13,
        fontFamily: 'var(--font-primary)',
        color: 'var(--color-text-primary)',
        background: dragOver ? 'var(--color-bg-hover)' : tone.bg,
        border: 'none',
        borderBottom: '1px solid var(--color-border-subtle)',
        borderTop: dragOver ? '2px solid var(--color-accent-active)' : '2px solid transparent',
        borderLeft: highlight === 'focus' ? '3px solid var(--color-accent-active)' :
                    highlight === 'upstream' ? '3px solid var(--color-text-secondary)' :
                    highlight === 'downstream' ? '3px solid var(--color-text-muted)' :
                    '3px solid transparent',
        textAlign: 'left',
        width: '100%',
        cursor: 'pointer',
        opacity: dragging ? 0.4 : tone.opacity,
        transition: 'opacity 120ms ease, background 120ms ease',
      }}
    >
      {/* Drag handle ("holder") — press and drag to move this recipe up or
          down its list. Drag only arms from here so row clicks and the
          move-bench picker keep working. */}
      <span
        aria-hidden={!reorderable}
        title={reorderable ? 'Drag to reorder' : undefined}
        onMouseDown={reorderable ? onHandlePress : undefined}
        onMouseUp={reorderable ? onHandleRelease : undefined}
        onClick={e => e.stopPropagation()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          color: 'var(--color-text-muted)',
          cursor: reorderable ? 'grab' : 'default',
          opacity: reorderable ? 0.6 : 0,
          touchAction: 'none',
        }}
      >
        <GripVertical size={14} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontWeight: highlight === 'focus' ? 700 : 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: 'var(--color-text-primary)',
            fontSize: 13.5,
          }}
        >
          {line.recipe.name}
        </span>
      </span>
      <span
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
        title={
          // Stitch the breakdown together from optional fragments so the
          // tooltip reads naturally regardless of which lanes are in
          // play (extras / team food / spoke dispatch — any combination).
          [
            `${totalQty} total`,
            hasExtras
              ? `incl. ${extrasUnits} off-list extra${extrasUnits === 1 ? '' : 's'}`
              : null,
            hasTeamFood
              ? `incl. ${teamFoodUnits} team food (not sold)`
              : null,
            dispatchUnits > 0
              ? `${dispatchUnits} for spoke dispatch`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')
        }
      >
        <span style={{ fontWeight: 700 }}>{totalQty}</span>
        {hasExtras && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--color-info)',
              marginTop: 1,
            }}
          >
            <PackagePlus size={9} />
            +{extrasUnits} off-list
          </span>
        )}
        {hasTeamFood && (
          // Mirrors the "+N off-list" chip — same typography, same
          // info-tone — but with a utensils icon and "team" label so
          // the bench team distinguishes "this is for staff" from
          // "this is for off-list customers" without having to mouse
          // over the tooltip.
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--color-info)',
              marginTop: 1,
            }}
          >
            <UtensilsCrossed size={9} />
            incl. {teamFoodUnits} team food
          </span>
        )}
      </span>
      <span
        style={{
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-text-secondary)',
          minWidth: 56,
        }}
      >
        {formatHMS(estMinutes)}
      </span>
      <MoveBenchButton
        currentBenchId={currentBenchId}
        siteBenches={siteBenches}
        onMove={benchId => onMoveLine?.(line.item.id, benchId)}
      />
      <ChevronRight size={14} color="var(--color-text-muted)" style={{ opacity: highlight === 'focus' ? 1 : 0.4 }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small UI bits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-row "move this work to another bench" picker. Renders as a small
 * arrow icon in the row's action column. Click → popover lists every
 * other bench at the active site, keyed by the line's current bench so
 * the destination it's already on is hidden.
 *
 * Manager flow: open the row, realise the egg cracker queue is jammed →
 * tap the arrow → pick "Bakery prep" → the row hops onto that card.
 * Override lives in BenchCardBoard state; refresh wipes it.
 */
function MoveBenchButton({
  currentBenchId,
  siteBenches,
  onMove,
}: {
  currentBenchId: string;
  siteBenches: Bench[];
  /** Called with the destination benchId. Picker closes automatically. */
  onMove?: (benchId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const destinations = useMemo(
    () => siteBenches.filter(b => b.id !== currentBenchId),
    [siteBenches, currentBenchId],
  );

  if (!onMove || destinations.length === 0) {
    // Reserve grid slot so column alignment doesn't jump.
    return <span style={{ width: 22, height: 22 }} />;
  }

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', width: 22, height: 22, display: 'inline-flex' }}
      onClick={e => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Move recipe to another bench"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          width: 22,
          height: 22,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          borderRadius: 6,
          background: open ? 'var(--color-bg-hover)' : 'transparent',
          border: '1px solid transparent',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
        }}
        title="Move to another bench"
      >
        <ArrowRightLeft size={12} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Pick destination bench"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            zIndex: 60,
            minWidth: 220,
            maxHeight: 280,
            overflowY: 'auto',
            background: '#ffffff',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(10, 20, 25, 0.18)',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <div
            style={{
              padding: '6px 10px 4px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
            }}
          >
            Move to bench
          </div>
          {destinations.map(b => (
            <button
              key={b.id}
              type="button"
              role="option"
              onClick={() => {
                onMove(b.id);
                setOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-primary)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ flex: 1, fontWeight: 600 }}>{b.name}</span>
              {b.capabilities.length > 0 && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {b.capabilities[0]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AssigneeChip({
  assignee,
  onAssign,
  size = 'default',
  pickerLabel = 'Assign bench to',
}: {
  assignee: string;
  /** When provided, the chip becomes a button that opens a staff picker. */
  onAssign?: (name: string) => void;
  /** `compact` shrinks the chip + popover for the per-run run-header use. */
  size?: 'default' | 'compact';
  /** Header text inside the picker popover. */
  pickerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close the popover on outside click + Escape. Mounting the listeners
  // only while open keeps cards without an open picker free of global
  // event handlers.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isUnassigned = assignee === 'Unassigned';
  const interactive = !!onAssign;
  const compact = size === 'compact';

  const chip = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 4 : 6,
        padding: compact ? '2px 7px' : '5px 10px',
        borderRadius: 999,
        background: '#ffffff',
        color: isUnassigned ? 'var(--color-text-secondary)' : 'var(--color-info)',
        fontSize: compact ? 10.5 : 11.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        border: `1.5px solid ${isUnassigned ? 'var(--color-border)' : 'var(--color-info)'}`,
      }}
    >
      <User size={compact ? 10 : 12} />
      {assignee}
    </span>
  );

  if (!interactive) return chip;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        onKeyDown={e => e.stopPropagation()}
        title={isUnassigned ? 'Assign a team member' : `Assigned to ${assignee} — click to change`}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          padding: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
        }}
      >
        {chip}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={pickerLabel}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 50,
            minWidth: 180,
            maxHeight: 280,
            overflowY: 'auto',
            background: '#ffffff',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(12, 20, 44, 0.16)',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            fontFamily: 'var(--font-primary)',
          }}
        >
          <div
            style={{
              padding: '6px 10px 4px',
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
            }}
          >
            {pickerLabel}
          </div>
          <PickerOption
            label="Unassigned"
            icon={<UserMinus size={12} />}
            selected={isUnassigned}
            onSelect={() => {
              onAssign(UNASSIGNED);
              setOpen(false);
            }}
          />
          <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '2px 0' }} />
          {STAFF_ROSTER.map(name => (
            <PickerOption
              key={name}
              label={name}
              icon={<User size={12} />}
              selected={!isUnassigned && name === assignee}
              onSelect={() => {
                onAssign(name);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PickerOption({
  label,
  icon,
  selected,
  onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        background: selected ? 'var(--color-info-light)' : 'transparent',
        color: selected ? 'var(--color-info)' : 'var(--color-text-primary)',
        border: 'none',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: selected ? 700 : 500,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <span style={{ flexShrink: 0, opacity: 0.8 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {selected && <Check size={12} />}
    </button>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** Minutes-from-midnight → "HH:MM", wrapped into a single day for the
 *  native time input (which only accepts 00:00–23:59). */
function toTimeInputValue(mins: number): string {
  const x = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(x / 60);
  const m = x % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** A stopwatch cell whose value is an editable native time input. Falls back
 *  to a read-only cell when no `onCommit` is supplied. */
function EditableStopwatchCell({
  label,
  mins,
  onCommit,
}: {
  label: string;
  mins: number;
  onCommit?: (mins: number) => void;
}) {
  if (!onCommit) {
    return <StopwatchCell label={label} value={minsToHHMM(mins)} />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--color-text-muted)',
        }}
      >
        {label}
      </span>
      <input
        type="time"
        value={toTimeInputValue(mins)}
        onClick={e => e.stopPropagation()}
        onChange={e => {
          const v = e.target.value;
          if (!v) return;
          const [h, m] = v.split(':').map(Number);
          if (Number.isNaN(h) || Number.isNaN(m)) return;
          onCommit(h * 60 + m);
        }}
        style={{
          fontSize: 13,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-primary)',
          background: '#ffffff',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 6,
          padding: '2px 6px',
          width: 'fit-content',
          maxWidth: '100%',
          cursor: 'text',
        }}
      />
    </div>
  );
}

function StopwatchCell({
  label,
  value,
  emphasis = 'muted',
}: {
  label: string;
  value: string;
  emphasis?: 'muted' | 'error';
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--color-text-muted)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: emphasis === 'error' ? 'var(--color-error)' : 'var(--color-text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type NextRunInfo = {
  bucket: RunBucket;
  state: 'active' | 'upcoming' | 'all-done';
};

/**
 * Given the run buckets on a bench and the demo clock, return the bucket the
 * user cares about most right now:
 *  - If a run is currently in progress → that one (state: 'active')
 *  - Else the next upcoming run        → that one (state: 'upcoming')
 *  - Else all runs are done            → the last bucket (state: 'all-done')
 */
function findNextRun(buckets: RunBucket[], nowHHMM: string): NextRunInfo | null {
  if (buckets.length === 0) return null;
  const nowMins = hhmmToMins(nowHHMM);
  const active = buckets.find(b => runTiming(b, nowMins) === 'active');
  if (active) return { bucket: active, state: 'active' };
  const upcoming = buckets.find(b => runTiming(b, nowMins) === 'upcoming');
  if (upcoming) return { bucket: upcoming, state: 'upcoming' };
  return { bucket: buckets[buckets.length - 1], state: 'all-done' };
}

function NextRunChip({ info }: { info: NextRunInfo }) {
  const { bucket, state } = info;
  const copy =
    state === 'active'   ? `In ${bucket.run.label} · ends ${minsToHHMM(bucket.endMins)}` :
    state === 'upcoming' ? `Next: ${bucket.run.label} · ${minsToHHMM(bucket.startMins)}` :
                           `Runs complete · ${bucket.run.label} done`;
  const styles =
    state === 'active'   ? { fg: 'var(--color-success)',         border: 'var(--color-success)' } :
    state === 'upcoming' ? { fg: 'var(--color-text-secondary)', border: 'var(--color-border)' } :
                           { fg: 'var(--color-text-muted)',     border: 'var(--color-border-subtle)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 999,
        background: '#ffffff',
        color: styles.fg,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        border: `1.5px solid ${styles.border}`,
      }}
    >
      <Clock size={10} />
      {copy}
    </span>
  );
}

function AfterServiceDivider() {
  return (
    <div
      style={{
        padding: '6px 14px',
        background: 'var(--color-bg-hover)',
        borderTop: '1px dashed var(--color-border-subtle)',
        borderBottom: '1px dashed var(--color-border-subtle)',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--color-text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Clock size={11} />
      After service · off-mode work
    </div>
  );
}

function nowAfterStart(nowHHMM: string, startMins: number): boolean {
  const [h, m] = nowHHMM.split(':').map(Number);
  return h * 60 + (m || 0) >= startMins;
}

'use client';

import { useCallback, useMemo } from 'react';
import { ChevronRight, Clock, Download, Repeat, Shuffle, User, Waves } from 'lucide-react';
import {
  benchesAt,
  effectiveBatchRules,
  getWorkflow,
  proposeBatchSplit,
  type Bench,
  type ProductionItemId,
  type ProductionMode,
  type RunSchedule,
  type Site,
} from './fixtures';
import { computeRelatedItems, usePlan, type PlanLine } from './PlanStore';
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
  /** Open the bench detail panel for the clicked bench. */
  onBenchClick?: (benchId: string) => void;
};

// ─── Stubbed "assigned to" per bench — placeholder until users/roles are wired in ──
const ASSIGNEE_BY_BENCH: Record<string, string> = {
  'bench-central-proof':    'Farah K.',
  'bench-central-oven':     'Farah K.',
  'bench-central-oven-b':   'Tom R.',
  'bench-central-pack':     'Milan V.',
  'bench-central-prep':     'Amira O.',
  'bench-central-assemble': 'Wojtek P.',
  'bench-central-salad':    'Bea L.',
  'bench-central-bev':      'Sofia G.',
  'bench-central-pot':      'Diana S.',
  'bench-central-hot':      'Marco B.',
  'bench-north-oven':       'Reza A.',
  'bench-north-prep':       'Priya S.',
  'bench-airport-oven':     'Lisa T.',
  'bench-airport-prep':     'Jon F.',
  'bench-airport-assemble': 'Nadia B.',
};

// ─── Stubbed cleaning & duties times per bench (minutes) ─────────────────────
const CLEANING_MINS_BY_BENCH: Record<string, number> = {
  'bench-central-oven':     30,
  'bench-central-oven-b':   30,
  'bench-central-proof':    10,
  'bench-central-pack':     15,
  'bench-central-prep':     20,
  'bench-central-assemble': 20,
  'bench-central-salad':    15,
  'bench-central-bev':      10,
  'bench-central-pot':      15,
  'bench-central-hot':      25,
};

const DEFAULT_CLEANING_MINS = 15;
const DUTIES_MINS = 10;

// ─── Bench open windows (minutes from midnight) ──────────────────────────────
// The window is the bench's available production time. Derived from the
// earliest start / latest end of scheduled work on the bench, but if there's
// no work we fall back to a generous default.
const DEFAULT_WINDOW_START_MINS = 5 * 60;  // 05:00
const DEFAULT_WINDOW_END_MINS   = 20 * 60; // 20:00

// ─── Mode group, Row, Card shapes ────────────────────────────────────────────
type RowData = {
  line: PlanLine;
  /** Batch sizes to be produced for this recipe on this bench. */
  batches: number[];
  totalQty: number;
  /** Estimated bench time for this recipe (minutes). */
  estMinutes: number;
};

/**
 * A single scheduled run on a bench — the concrete R1 / R2 block with its
 * recipes. Only populated for primary run-mode groups on benches that have
 * a `runs` schedule defined. Lets the card surface "Next run · R2 at 10:30"
 * and split the recipe list into labelled subsections.
 */
type RunBucket = {
  run: RunSchedule;
  rows: RowData[];
  productionMins: number;
  startMins: number;
  endMins: number;
};

/**
 * A "run group" on a bench: recipes sharing a production mode, with their
 * own time window and subtotal. A bench has ONE primary mode at a time (Pret
 * convention), so the primary group represents the bench's scheduled runs
 * (R1, R2, ...). Secondary groups are off-mode work — typically next-day prep
 * squeezed in after service — and render muted below the primary group.
 */
type ModeGroup = {
  mode: ProductionMode;
  /** Human label e.g. "Scheduled runs", "Lunch build", "Hot bake". */
  label: string;
  /** True if this group matches the bench's primaryMode. */
  isPrimary: boolean;
  rows: RowData[];
  productionMins: number;
  /** Display window for this group (minutes from midnight). */
  windowStartMins: number;
  windowEndMins: number;
  /** Throughout-day groups (increment) render their window differently. */
  throughoutDay: boolean;
  /**
   * Scheduled run breakdown for primary run-mode groups on benches with a
   * `runs` schedule. Each bucket = one R1/R2/... slot with its rows.
   */
  runBuckets?: RunBucket[];
};

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

export default function BenchCardBoard({
  site,
  date,
  nowHHMM,
  focusedItemId,
  onFocusChange,
  onClearFocus,
  modeFilter = 'all',
  onBenchClick,
}: Props) {
  const lines = usePlan(site.id, date);

  // Group lines by their primary bench.
  const cards = useMemo<CardData[]>(() => {
    const siteBenches = benchesAt(site.id);
    const byBench = new Map<string, PlanLine[]>();
    for (const line of lines) {
      if (line.effectivePlanned <= 0) continue;
      if (!line.primaryBench) continue;
      const arr = byBench.get(line.primaryBench.id) ?? [];
      arr.push(line);
      byBench.set(line.primaryBench.id, arr);
    }

    return siteBenches.map(bench => {
      const benchLines = byBench.get(bench.id) ?? [];

      // Convert lines → row data (batch split + est time).
      const rows: RowData[] = benchLines.map(line => {
        const eff = effectiveBatchRules(line.recipe.batchRules, bench.batchRules);
        const split = proposeBatchSplit(line.effectivePlanned, eff);
        const estMinutes = estimateMinutes(line, split.batches.length);
        return {
          line,
          batches: split.batches,
          totalQty: split.batches.reduce((s, q) => s + q, 0),
          estMinutes,
        };
      });

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
            ? bucketRowsIntoRuns(groupRows, bench.runs)
            : undefined;
        modeGroups.push({
          mode,
          label: groupLabelFor(mode, bench, groupRows, isPrimary, !!runBuckets),
          isPrimary,
          rows: groupRows,
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

      return {
        bench,
        assignee: ASSIGNEE_BY_BENCH[bench.id] ?? 'Unassigned',
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
  }, [lines, site.id]);

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
  const visibleCards = useMemo(() => {
    if (modeFilter === 'all') return cards;
    return cards.filter(c => c.bench.primaryMode === modeFilter);
  }, [cards, modeFilter]);

  return (
    <div style={{ padding: '20px 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Grid of bench cards — 2 per row on wide screens */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))',
          gap: 28,
        }}
      >
        {visibleCards.map(card => (
          <BenchCard
            key={card.bench.id}
            card={card}
            nowHHMM={nowHHMM}
            highlightFor={highlightFor}
            hasFocus={focusedItemId != null}
            onRowClick={toggleFocus}
            onBenchClick={onBenchClick}
            onDownloadBench={downloadBench}
          />
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
}: {
  card: CardData;
  nowHHMM?: string;
  highlightFor: (itemId: string) => HighlightMode;
  hasFocus: boolean;
  onRowClick: (itemId: ProductionItemId) => void;
  onBenchClick?: (benchId: string) => void;
  onDownloadBench?: (benchId: string) => void;
}) {
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

  const remainingMins = Math.max(0, card.windowCapacityMins - card.totalMins);

  // Find the next / active run for the header chip. We use the primary
  // run-mode group's buckets if present. "Active" wins over "upcoming" — the
  // team cares most about the run they're in.
  const primaryGroup = card.modeGroups.find(g => g.isPrimary);
  const nextRunInfo = nowHHMM && primaryGroup?.runBuckets
    ? findNextRun(primaryGroup.runBuckets, nowHHMM)
    : null;

  return (
    <section
      style={{
        background: '#ffffff',
        border: '2px solid var(--color-border)',
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
          padding: '12px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          gap: 12,
          cursor: onBenchClick ? 'pointer' : 'default',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
              {card.bench.name}
            </h3>
            {card.bench.primaryMode && <ModeBadge mode={card.bench.primaryMode} />}
            {nextRunInfo && <NextRunChip info={nextRunInfo} />}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--color-text-muted)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {card.bench.capabilities.join(' · ')}
            {!card.bench.online && <span style={{ color: 'var(--color-error)', marginLeft: 8 }}>OFFLINE</span>}
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <AssigneeChip assignee={card.assignee} />
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
                width: 28,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                background: '#ffffff',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Download size={14} />
            </button>
          )}
        </div>
      </header>

      {/* Mode groups (runs). Primary first; secondary modes rendered under an
          "After service" divider. */}
      {card.hasWork ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {card.modeGroups.map((group, idx, arr) => {
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
            padding: '10px 14px',
            borderTop: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-hover)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
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
              paddingTop: 6,
              marginTop: 2,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
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
          padding: '10px 14px',
          borderTop: '1px solid var(--color-border-subtle)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
          fontSize: 11,
          color: 'var(--color-text-muted)',
        }}
      >
        <StopwatchCell label="Start" value={minsToHHMM(card.windowStartMins)} />
        <StopwatchCell label="End" value={minsToHHMM(card.windowStartMins + card.totalMins)} />
        <StopwatchCell label="Remaining" value={formatHMS(remainingMins)} emphasis="muted" />
      </footer>

      {nowHHMM && card.windowStartMins > 0 && nowAfterStart(nowHHMM, card.windowStartMins) && (
        <div
          style={{
            padding: '4px 14px',
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
}: {
  group: ModeGroup;
  isFirst: boolean;
  nowHHMM?: string;
  highlightFor: (itemId: string) => HighlightMode;
  onRowClick: (itemId: ProductionItemId) => void;
}) {
  const treatment = MODE_TREATMENT[group.mode];
  // Secondary (off-mode) groups are rendered muted so they read as
  // "incidental, post-service" work rather than a peer to the main run.
  const sectionOpacity = group.isPrimary ? 1 : 0.7;

  return (
    <div
      style={{
        background: treatment.sectionTint ?? 'transparent',
        borderTop: isFirst ? 'none' : '1px solid var(--color-border-subtle)',
        opacity: sectionOpacity,
      }}
    >
      {/* Section header: mode badge + label + window */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '8px 14px',
          background: treatment.headerBg,
          borderBottom: `1px ${treatment.dashedBorder ? 'dashed' : 'solid'} var(--color-border-subtle)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <ModeBadge mode={group.mode} />
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
            {group.label}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            <Clock size={11} />
            {group.throughoutDay
              ? `${minsToHHMM(group.windowStartMins)} → ${minsToHHMM(group.windowEndMins)} · throughout day`
              : `${minsToHHMM(group.windowStartMins)}–${minsToHHMM(group.windowEndMins)}`}
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {formatHMS(group.productionMins)} · {group.rows.length} recipe{group.rows.length === 1 ? '' : 's'}
        </span>
      </header>

      {/* When the group has scheduled runs (R1/R2), render each run as its
          own labelled subsection. Otherwise fall back to a single flat list. */}
      {group.runBuckets && group.runBuckets.length > 0 ? (
        group.runBuckets.map((bucket, idx) => (
          <RunBucketSection
            key={bucket.run.id}
            bucket={bucket}
            isFirst={idx === 0}
            nowHHMM={nowHHMM}
            highlightFor={highlightFor}
            onRowClick={onRowClick}
          />
        ))
      ) : (
        <>
          <ColumnHeader />
          {group.rows.map(row => (
            <RecipeRow
              key={row.line.item.id}
              row={row}
              highlight={highlightFor(row.line.item.id)}
              onClick={() => onRowClick(row.line.item.id)}
            />
          ))}
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
        gridTemplateColumns: '1fr auto auto auto auto',
        gap: 12,
        padding: '6px 14px',
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <span>Recipe</span>
      <span style={{ textAlign: 'right', minWidth: 36 }}>Qty</span>
      <span style={{ textAlign: 'right', minWidth: 80 }}>Batches</span>
      <span style={{ textAlign: 'right', minWidth: 56 }}>Time</span>
      <span style={{ width: 14 }} />
    </div>
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
}: {
  bucket: RunBucket;
  isFirst: boolean;
  nowHHMM?: string;
  highlightFor: (itemId: string) => HighlightMode;
  onRowClick: (itemId: ProductionItemId) => void;
}) {
  const nowMins = nowHHMM ? hhmmToMins(nowHHMM) : -1;
  const state: RunTiming | null = nowMins >= 0 ? runTiming(bucket, nowMins) : null;

  const statePillColor =
    state === 'active'   ? { bg: 'var(--color-success-light, rgba(34,197,94,0.15))', fg: 'var(--color-success, #15803d)' } :
    state === 'upcoming' ? { bg: 'var(--color-bg-hover)',                              fg: 'var(--color-text-secondary)' } :
                           { bg: 'var(--color-bg-hover)',                              fg: 'var(--color-text-muted)' };

  return (
    <div
      style={{
        borderTop: isFirst ? '1px solid var(--color-border-subtle)' : '1px dashed var(--color-border-subtle)',
      }}
    >
      {/* Run header: R1 · 05:00 → 08:00 · 3h00 · 6 recipes · [state pill] */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '6px 14px',
          background: 'var(--color-bg-hover)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: 'var(--color-text-primary)',
              padding: '2px 7px',
              borderRadius: 4,
              background: '#ffffff',
              border: '1px solid var(--color-border-subtle)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {bucket.run.label}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            <Clock size={11} />
            {minsToHHMM(bucket.startMins)} → {minsToHHMM(bucket.endMins)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {formatHMS(bucket.productionMins)} · {bucket.rows.length} recipe{bucket.rows.length === 1 ? '' : 's'}
          </span>
        </div>
        {state && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '2px 6px',
              borderRadius: 999,
              background: statePillColor.bg,
              color: statePillColor.fg,
              whiteSpace: 'nowrap',
            }}
          >
            {state === 'active' ? 'In progress' : state === 'upcoming' ? 'Upcoming' : 'Done'}
          </span>
        )}
      </div>

      <ColumnHeader />

      {bucket.rows.map(row => (
        <RecipeRow
          key={row.line.item.id}
          row={row}
          highlight={highlightFor(row.line.item.id)}
          onClick={() => onRowClick(row.line.item.id)}
        />
      ))}
    </div>
  );
}

function ModeBadge({ mode }: { mode: ProductionMode }) {
  const treatment = MODE_TREATMENT[mode];
  const Icon = treatment.icon;
  const styles = { bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 999,
        background: styles.bg,
        color: styles.color,
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
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
}: {
  row: RowData;
  highlight: HighlightMode;
  onClick: () => void;
}) {
  const { line, batches, totalQty, estMinutes } = row;

  const tone =
    highlight === 'focus'      ? { bg: 'var(--color-bg-hover)',  accent: 'var(--color-accent-active)', opacity: 1 } :
    highlight === 'upstream'   ? { bg: 'var(--color-bg-hover)',  accent: 'var(--color-text-secondary)', opacity: 1 } :
    highlight === 'downstream' ? { bg: 'var(--color-bg-hover)',  accent: 'var(--color-text-muted)',     opacity: 1 } :
    highlight === 'dim'        ? { bg: '#ffffff',                accent: 'var(--color-text-muted)',     opacity: 0.35 } :
                                 { bg: '#ffffff',                accent: 'var(--color-text-muted)',     opacity: 1 };

  const isAssembly = !!line.recipe.subRecipes && line.recipe.subRecipes.length > 0;
  const assemblyDemand = line.assemblyDemand.totalUnits;
  const shortfall = assemblyDemand > line.planned;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto auto',
        gap: 12,
        alignItems: 'center',
        padding: '8px 14px',
        fontSize: 12,
        fontFamily: 'var(--font-primary)',
        color: 'var(--color-text-primary)',
        background: tone.bg,
        border: 'none',
        borderBottom: '1px solid var(--color-border-subtle)',
        borderLeft: highlight === 'focus' ? '3px solid var(--color-accent-active)' :
                    highlight === 'upstream' ? '3px solid var(--color-text-secondary)' :
                    highlight === 'downstream' ? '3px solid var(--color-text-muted)' :
                    '3px solid transparent',
        textAlign: 'left',
        width: '100%',
        cursor: 'pointer',
        opacity: tone.opacity,
        transition: 'opacity 120ms ease, background 120ms ease',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontWeight: highlight === 'focus' ? 700 : 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: 'var(--color-text-primary)',
          }}
        >
          {line.recipe.name}
        </span>
        <span style={{ display: 'flex', gap: 6, fontSize: 10, color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
          {isAssembly && <Tag label="Assembly" tone="info" />}
          {line.assemblyDemand.sources.length > 0 && <Tag label="Component" tone="warn" />}
          {line.isOverridden && <Tag label="Manager edit" tone="accent" />}
          {shortfall && <Tag label="Short" tone="error" />}
        </span>
      </span>
      <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {totalQty}
      </span>
      <span
        style={{
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-text-secondary)',
          minWidth: 80,
        }}
      >
        {formatBatches(batches)}
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
      <ChevronRight size={14} color="var(--color-text-muted)" style={{ opacity: highlight === 'focus' ? 1 : 0.4 }} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small UI bits
// ─────────────────────────────────────────────────────────────────────────────

function AssigneeChip({ assignee }: { assignee: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 999,
        background: 'var(--color-bg-hover)',
        color: 'var(--color-text-secondary)',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <User size={12} />
      {assignee}
    </span>
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

function Tag({ label, tone }: { label: string; tone: 'info' | 'warn' | 'accent' | 'error' }) {
  const styles =
    tone === 'error'  ? { bg: 'var(--color-error-light)', color: 'var(--color-error)' } :
                        { bg: 'var(--color-bg-hover)',    color: 'var(--color-text-secondary)' };
  return (
    <span
      style={{
        padding: '1px 6px',
        borderRadius: 4,
        background: styles.bg,
        color: styles.color,
        fontWeight: 600,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function estimateMinutes(line: PlanLine, batchCount: number): number {
  const wf = getWorkflow(line.recipe.workflowId);
  if (!wf) return 0;
  const perBatchMins = wf.stages
    .filter(s => s.leadOffset === 0)
    .reduce((s, stage) => s + Math.max(stage.durationMinutes, 1), 0);
  return perBatchMins * Math.max(batchCount, 0);
}

function categoryStartMins(category: string): number {
  // Mirrors CATEGORY_START_MINS in deriveBoardPlan so cards and Gantt agree.
  switch (category) {
    case 'Bakery':    return 5 * 60;
    case 'Sandwich':  return 7 * 60 + 30;
    case 'Salad':     return 10 * 60;
    case 'Snack':     return 7 * 60;
    case 'Beverage':  return 6 * 60;
    default:          return 6 * 60;
  }
}

/**
 * Compute a display window for a mode group.
 *  - Primary run / variable: anchored at the earliest category start among the
 *    rows, extended by the group's total production time (so the card shows
 *    when the run actually finishes on-bench).
 *  - Secondary (after-service) groups: parked in the late afternoon so they
 *    read as "next-day prep squeezed in after the main run".
 *  - Increment: spans ~05:30 → 17:00 (throughout day) so the card communicates
 *    the cadence window rather than a single start/end.
 */
function windowForGroup(
  mode: ProductionMode,
  rows: RowData[],
  productionMins: number,
  isPrimary: boolean,
): { windowStartMins: number; windowEndMins: number; throughoutDay: boolean } {
  if (mode === 'increment') {
    return { windowStartMins: 5 * 60 + 30, windowEndMins: 17 * 60, throughoutDay: true };
  }
  if (!isPrimary) {
    // After-service tail: nominally 15:00 onward.
    const start = 15 * 60;
    return { windowStartMins: start, windowEndMins: Math.min(start + productionMins, 19 * 60), throughoutDay: false };
  }
  const starts = rows.map(r => categoryStartMins(r.line.recipe.category));
  const windowStartMins = starts.length > 0 ? Math.min(...starts) : DEFAULT_WINDOW_START_MINS;
  const windowEndMins = Math.min(windowStartMins + productionMins, DEFAULT_WINDOW_END_MINS);
  return { windowStartMins, windowEndMins, throughoutDay: false };
}

/**
 * Label a mode group in the context of a bench + whether it's the bench's
 * primary mode. Secondary (off-mode) groups get a "next-day" / "prep"
 * framing. Primary run-mode groups on benches that split into per-run
 * buckets get a neutral "Scheduled runs" label (the individual R1/R2
 * subsections own the specifics); otherwise they fall back to a
 * category-flavoured name.
 */
function groupLabelFor(
  mode: ProductionMode,
  bench: Bench,
  rows: RowData[],
  isPrimary: boolean,
  hasRunBuckets: boolean,
): string {
  const categories = Array.from(new Set(rows.map(r => r.line.recipe.category)));
  const dominant = categories[0] ?? '';

  if (!isPrimary) {
    if (mode === 'variable') return 'Next-day prep';
    if (mode === 'run')      return 'Top-up run';
    if (mode === 'increment') return 'Secondary increments';
  }

  if (mode === 'run') {
    if (hasRunBuckets)           return 'Scheduled runs';
    if (dominant === 'Bakery')   return 'Morning bake';
    if (dominant === 'Sandwich') return 'Component prep';
    if (dominant === 'Salad')    return 'Salad prep';
    if (dominant === 'Beverage') return 'Beverage prep';
    return `${dominant || 'Run'} production`;
  }
  if (mode === 'variable') {
    if (dominant === 'Sandwich') return 'Lunch build';
    if (dominant === 'Salad')    return 'Salad assembly';
    if (dominant === 'Bakery')   return 'Finish & pack';
    return `${dominant || 'Variable'} build`;
  }
  // increment
  if (bench.capabilities.includes('oven')) return 'Hot bake';
  if (dominant === 'Beverage')             return 'Drinks station';
  return 'Throughout day';
}

/**
 * Bucket recipes into the bench's scheduled runs (R1/R2/...). We use the
 * forecast's morning/midday/afternoon phase split as the signal: whichever
 * run's time window overlaps the recipe's peak demand phase wins. If there's
 * only one run, all rows go into it. If phase data is missing we fall back
 * to category heuristics (viennoiserie in R1, loaves in R1, etc.).
 */
function bucketRowsIntoRuns(rows: RowData[], runs: RunSchedule[]): RunBucket[] {
  const buckets: RunBucket[] = runs.map(run => {
    const startMins = hhmmToMins(run.startTime);
    return {
      run,
      rows: [],
      productionMins: 0,
      startMins,
      endMins: startMins + run.durationMinutes,
    };
  });

  if (buckets.length === 0) return buckets;

  for (const row of rows) {
    const idx = pickRunIndex(row, runs);
    const bucket = buckets[idx] ?? buckets[0];
    bucket.rows.push(row);
    bucket.productionMins += row.estMinutes;
  }

  // Drop empty buckets so we don't render ghost sections.
  return buckets.filter(b => b.rows.length > 0);
}

function pickRunIndex(row: RowData, runs: RunSchedule[]): number {
  if (runs.length === 1) return 0;

  const phases = row.line.forecast?.byPhase;
  if (phases) {
    // Map each phase to minutes-from-midnight, pick the phase with the
    // biggest demand, then pick the run whose window is closest.
    const morningMins = 7 * 60 + 30;
    const middayMins  = 12 * 60;
    const afternoonMins = 15 * 60;
    const peakMins = phases.midday + phases.afternoon > phases.morning
      ? (phases.midday >= phases.afternoon ? middayMins : afternoonMins)
      : morningMins;
    let bestIdx = 0;
    let bestDelta = Infinity;
    runs.forEach((r, i) => {
      const start = hhmmToMins(r.startTime);
      const delta = Math.abs(peakMins - start);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIdx = i;
      }
    });
    return bestIdx;
  }

  // Fallback: category-based. Recipes tagged "morning"/"breakfast" go to R1;
  // anything else to the last run.
  const tags = row.line.recipe.selectionTags ?? [];
  if (tags.includes('morning') || tags.includes('breakfast')) return 0;
  return runs.length - 1;
}

/**
 * Decide whether a given run is upcoming / active / done given the demo
 * clock. Used by the card header to surface "Next run · R2 at 10:30".
 */
type RunTiming = 'upcoming' | 'active' | 'done';
function runTiming(bucket: RunBucket, nowMins: number): RunTiming {
  if (nowMins < bucket.startMins) return 'upcoming';
  if (nowMins < bucket.endMins)   return 'active';
  return 'done';
}

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
    state === 'active'   ? { bg: 'var(--color-success-light, rgba(34,197,94,0.14))', fg: 'var(--color-success, #15803d)' } :
    state === 'upcoming' ? { bg: 'var(--color-bg-hover)',                             fg: 'var(--color-text-secondary)' } :
                           { bg: 'var(--color-bg-hover)',                             fg: 'var(--color-text-muted)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        background: styles.bg,
        color: styles.fg,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.03em',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <Clock size={10} />
      {copy}
    </span>
  );
}

function hhmmToMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
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

function formatHMS(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = Math.round(totalMins % 60);
  const hh = h.toString().padStart(2, '0');
  const mm = m.toString().padStart(2, '0');
  return `${hh}:${mm}:00`;
}

function minsToHHMM(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = Math.round(mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatBatches(batches: number[]): string {
  if (batches.length === 0) return '—';
  if (batches.length === 1) return String(batches[0]);
  const allSame = batches.every(b => b === batches[0]);
  if (allSame) return `${batches.length} × ${batches[0]}`;
  return batches.join(' + ');
}

function nowAfterStart(nowHHMM: string, startMins: number): boolean {
  const [h, m] = nowHHMM.split(':').map(Number);
  return h * 60 + (m || 0) >= startMins;
}

'use client';

/**
 * BenchBalanceView — the per-production-run balance lens on the bench board.
 *
 * Where `BenchCardBoard` is bench-centric (one card per bench, its whole
 * day), this view is run-centric: pick a production run and compare every
 * bench side-by-side so a manager can answer, at a glance, the three
 * planning questions for that run:
 *
 *   1. People   — is the right person on this bench for this run?
 *   2. Products — are products allocated evenly across benches? (load bar +
 *                 outlier flag vs the run average)
 *   3. Time     — is bench time balanced, or is one bench at 1h while
 *                 another's at 5h? (time bar + run-average marker + tint)
 *
 * Deliberately per-run: there is never a P1+P2 aggregate. Selecting "All"
 * stacks one independent section per run. Read-only in v1 — assigning and
 * moving work lives in Bench detail (`BenchCardBoard`), which shares the
 * exact same numbers via `benchPlanModel`.
 */

import { useMemo } from 'react';
import { Moon, User } from 'lucide-react';
import { benchesAt, type Site } from './fixtures';
import { usePlan } from './PlanStore';
import { useNightShiftPolicy } from '@/components/Settings/nightShiftPolicyStore';
import { useHubExtras } from './hubExtrasStore';
import {
  buildBenchRunMatrix,
  minsToHHMM,
  type BenchRunCell,
  type BenchRunMatrix,
} from './benchPlanModel';

type Props = {
  site: Site;
  date: string;
  /** A single run label (e.g. "R1") to compare, or 'all' to stack every run. */
  runFilter: 'all' | string;
};

// A bench is flagged an outlier when its value deviates from the run average
// by more than this fraction — the "one bench at 1h while another's at 5h"
// signal. Only meaningful when a run has ≥2 benches to compare.
const OUTLIER_THRESHOLD = 0.4;

/** Compact duration label, e.g. 130 → "2:10". */
function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60)
    .toString()
    .padStart(2, '0');
  return `${h}:${m}`;
}

function deviation(value: number, avg: number): number {
  return avg > 0 ? (value - avg) / avg : 0;
}

export default function BenchBalanceView({ site, date, runFilter }: Props) {
  const lines = usePlan(site.id, date);
  const { policy } = useNightShiftPolicy();
  const { getExtras } = useHubExtras();
  const benches = useMemo(() => benchesAt(site.id), [site.id]);

  const matrices = useMemo(
    () =>
      buildBenchRunMatrix(site, date, lines, benches, {
        nightShiftPolicy: policy,
        getExtras,
      }),
    [site, date, lines, benches, policy, getExtras],
  );

  const shown =
    runFilter === 'all'
      ? matrices
      : matrices.filter(m => m.runLabel === runFilter);

  if (shown.length === 0) {
    return (
      <div
        style={{
          padding: '40px 32px',
          color: 'var(--color-text-muted)',
          fontSize: 13,
        }}
      >
        No scheduled production runs to balance for this site.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '16px 24px 40px' }}>
      {shown.map(run => (
        <RunSection key={run.runLabel} run={run} />
      ))}
    </div>
  );
}

// ─── One production run, all benches compared ────────────────────────────────

function RunSection({ run }: { run: BenchRunMatrix }) {
  const compareCount = run.cells.length;
  // Scale the bars to the busiest bench in this run so the comparison is
  // self-contained (never relative to another run).
  const unitsScale = Math.max(run.maxUnits, 1);
  const timeScale = Math.max(run.maxProductionMins, 1);

  return (
    <section
      style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 12,
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      {/* Run header — the at-a-glance summary line for this run. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: run.isNight ? 'rgba(79, 70, 160, 0.06)' : 'var(--color-bg-hover)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 14,
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            letterSpacing: '0.01em',
          }}
        >
          {run.isNight && <Moon size={13} style={{ color: '#6b63c9' }} />}
          {run.runLabel}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {minsToHHMM(run.startMins)}–{minsToHHMM(run.endMins)}
        </span>
        <span style={{ width: 1, height: 14, background: 'var(--color-border)' }} />
        <HeaderStat label="benches" value={String(compareCount)} />
        <HeaderStat label="units" value={String(run.totalUnits)} />
        <HeaderStat label="recipes" value={String(run.totalRecipes)} />
        <HeaderStat label="bench-time" value={fmtDuration(run.totalProductionMins)} />
      </div>

      {/* Column headers */}
      <BalanceRowGrid
        as="header"
        bench={<ColLabel>Bench</ColLabel>}
        people={<ColLabel>Person</ColLabel>}
        products={<ColLabel>Products · load vs run</ColLabel>}
        time={<ColLabel>Time · vs run avg</ColLabel>}
      />

      {run.cells.map((cell, i) => (
        <BenchBalanceRow
          key={cell.bench.id}
          cell={cell}
          isLast={i === run.cells.length - 1}
          unitsScale={unitsScale}
          timeScale={timeScale}
          avgUnits={run.avgUnits}
          avgProductionMins={run.avgProductionMins}
          comparable={compareCount >= 2}
        />
      ))}
    </section>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>{label}</span>
    </span>
  );
}

function ColLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--color-text-muted)',
      }}
    >
      {children}
    </span>
  );
}

// ─── Layout primitive: the 4-column grid shared by header + each bench row ────

function BalanceRowGrid({
  bench,
  people,
  products,
  time,
  as = 'row',
  tint,
  isLast,
}: {
  bench: React.ReactNode;
  people: React.ReactNode;
  products: React.ReactNode;
  time: React.ReactNode;
  as?: 'header' | 'row';
  tint?: string;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 120px minmax(0, 1fr) 220px',
        alignItems: 'center',
        gap: 12,
        padding: as === 'header' ? '7px 14px' : '8px 14px',
        background: tint ?? (as === 'header' ? '#ffffff' : 'transparent'),
        borderBottom: as === 'header' || !isLast ? '1px solid var(--color-border-subtle)' : 'none',
      }}
    >
      <div style={{ minWidth: 0 }}>{bench}</div>
      <div style={{ minWidth: 0 }}>{people}</div>
      <div style={{ minWidth: 0 }}>{products}</div>
      <div style={{ minWidth: 0 }}>{time}</div>
    </div>
  );
}

// ─── A single bench within a run ─────────────────────────────────────────────

function BenchBalanceRow({
  cell,
  isLast,
  unitsScale,
  timeScale,
  avgUnits,
  avgProductionMins,
  comparable,
}: {
  cell: BenchRunCell;
  isLast: boolean;
  unitsScale: number;
  timeScale: number;
  avgUnits: number;
  avgProductionMins: number;
  comparable: boolean;
}) {
  const idle = cell.recipeCount === 0;
  const unitsDev = deviation(cell.units, avgUnits);
  const timeDev = deviation(cell.productionMins, avgProductionMins);

  const timeOutlier = comparable && Math.abs(timeDev) >= OUTLIER_THRESHOLD;
  const timeHigh = timeOutlier && timeDev > 0;
  const timeLow = timeOutlier && timeDev < 0;

  // A faint row tint when this bench's time is the imbalance: warm when it's
  // overloaded, cool/muted when it's underused, so a 1h-vs-5h spread pops.
  const rowTint = timeHigh
    ? 'rgba(214, 122, 33, 0.05)'
    : timeLow
      ? 'rgba(120, 120, 120, 0.045)'
      : undefined;

  return (
    <BalanceRowGrid
      isLast={isLast}
      tint={rowTint}
      bench={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {cell.bench.name}
          </span>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
            {cell.bench.primaryMode}
          </span>
        </div>
      }
      people={<PersonChip name={cell.assignee} />}
      products={
        <ProductsCell
          cell={cell}
          unitsScale={unitsScale}
          unitsDev={unitsDev}
          comparable={comparable}
          idle={idle}
        />
      }
      time={
        <TimeCell
          mins={cell.productionMins}
          scale={timeScale}
          avgMins={avgProductionMins}
          high={timeHigh}
          low={timeLow}
          idle={idle}
        />
      }
    />
  );
}

function PersonChip({ name }: { name: string }) {
  const unassigned = !name || name === 'Unassigned';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        maxWidth: '100%',
        padding: '3px 8px',
        borderRadius: 999,
        background: unassigned ? 'transparent' : 'var(--color-bg-hover)',
        border: `1px solid ${unassigned ? 'var(--color-border-subtle)' : 'var(--color-border)'}`,
        fontSize: 11.5,
        fontWeight: 600,
        color: unassigned ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      <User size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {unassigned ? 'Unassigned' : name}
      </span>
    </span>
  );
}

function ProductsCell({
  cell,
  unitsScale,
  unitsDev,
  comparable,
  idle,
}: {
  cell: BenchRunCell;
  unitsScale: number;
  unitsDev: number;
  comparable: boolean;
  idle: boolean;
}) {
  const names = cell.rows.map(r => r.line.recipe.name);
  const shownNames = names.slice(0, 3);
  const overflow = names.length - shownNames.length;
  const fill = Math.round((cell.units / unitsScale) * 100);
  const unitsOutlier = comparable && Math.abs(unitsDev) >= OUTLIER_THRESHOLD;

  if (idle) {
    return (
      <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
        Idle this run
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {cell.units} units
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {cell.recipeCount} {cell.recipeCount === 1 ? 'recipe' : 'recipes'}
        </span>
        {unitsOutlier && (
          <OutlierTag high={unitsDev > 0} label={unitsDev > 0 ? 'heavy load' : 'light load'} />
        )}
      </div>

      {/* Load bar — relative to the busiest bench in this run. */}
      <div
        style={{
          position: 'relative',
          height: 5,
          borderRadius: 999,
          background: 'var(--color-border-subtle)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${fill}%`,
            background: 'var(--color-accent-active)',
            opacity: 0.55,
            borderRadius: 999,
          }}
        />
      </div>

      {/* Product name chips with +N overflow. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 0 }}>
        {shownNames.map((n, i) => (
          <span
            key={`${n}-${i}`}
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 5,
              padding: '1px 6px',
              maxWidth: 140,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {n}
          </span>
        ))}
        {overflow > 0 && (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', padding: '1px 4px' }}>
            +{overflow} more
          </span>
        )}
      </div>
    </div>
  );
}

function TimeCell({
  mins,
  scale,
  avgMins,
  high,
  low,
  idle,
}: {
  mins: number;
  scale: number;
  avgMins: number;
  high: boolean;
  low: boolean;
  idle: boolean;
}) {
  const fill = Math.round((mins / scale) * 100);
  const avgPct = Math.min(100, Math.round((avgMins / scale) * 100));
  const barColor = high
    ? 'var(--color-warning)'
    : low
      ? 'var(--color-text-muted)'
      : 'var(--color-success)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <div
        style={{
          position: 'relative',
          flex: 1,
          height: 10,
          borderRadius: 999,
          background: 'var(--color-border-subtle)',
          overflow: 'hidden',
          minWidth: 60,
        }}
      >
        <div
          style={{
            position: 'absolute',
            insetBlock: 0,
            left: 0,
            width: `${fill}%`,
            background: barColor,
            opacity: idle ? 0 : 0.7,
            borderRadius: 999,
          }}
        />
        {/* Run-average marker — the line every bench is balancing against. */}
        <div
          title={`Run average ${fmtDuration(avgMins)}`}
          style={{
            position: 'absolute',
            top: -2,
            bottom: -2,
            left: `${avgPct}%`,
            width: 2,
            background: 'var(--color-text-secondary)',
            opacity: 0.55,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: high ? 'var(--color-warning)' : 'var(--color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          minWidth: 30,
          textAlign: 'right',
        }}
      >
        {fmtDuration(mins)}
      </span>
    </div>
  );
}

function OutlierTag({ high, label }: { high: boolean; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 9.5,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        padding: '1px 5px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        color: high ? 'var(--color-warning)' : 'var(--color-text-muted)',
        background: high ? 'rgba(214, 122, 33, 0.1)' : 'var(--color-bg-hover)',
        border: `1px solid ${high ? 'rgba(214, 122, 33, 0.3)' : 'var(--color-border-subtle)'}`,
      }}
    >
      {label}
    </span>
  );
}

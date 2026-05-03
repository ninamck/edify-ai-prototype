'use client';

import { useMemo, useState } from 'react';
import BenchRow from './BenchRow';
import BatchBlock from './BatchBlock';
import IncrementCadence from './IncrementCadence';
import StatusPill from './StatusPill';
import type {
  Bench,
  ProductionPlan,
  PlannedInstance,
  ProductionBatch,
  ProductionItemId,
  Site,
} from './fixtures';
import {
  getProductionItem,
  getRecipe,
  PRET_BENCHES,
} from './fixtures';
import { computeRelatedItems } from './PlanStore';
import { boardBodyWidth, hourMarks, leftForTime } from './time';

type HighlightMode = 'focus' | 'upstream' | 'downstream' | 'dim' | 'none';

type Props = {
  site: Site;
  plan: ProductionPlan;
  /** Restrict to a single date — the plan's D0. */
  date: string;
  /** Optional current-time marker ('HH:MM'). */
  nowHHMM?: string;
  /** Tap handler for batch detail (future slice). */
  onBatchClick?: (id: string) => void;
  /** Tap handler for an increment cadence strip. */
  onCadenceClick?: (productionItemId: string) => void;
  /** When set, dim unrelated blocks and highlight this item's dependency chain. */
  focusedItemId?: ProductionItemId | null;
  /** Clear the current focus (e.g. the user tapped empty space). */
  onClearFocus?: () => void;
};

export default function KitchenBoard({
  site,
  plan,
  date,
  nowHHMM,
  onBatchClick,
  onCadenceClick,
  focusedItemId,
  onClearFocus,
}: Props) {
  const [mode, setMode] = useState<'desktop' | 'mobile'>(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches ? 'mobile' : 'desktop'
  );

  const siteBenches = PRET_BENCHES.filter(b => b.siteId === site.id);

  // Filter planned + batches to the target date
  const instancesForDate = plan.plannedInstances.filter(pi => pi.date === date);
  const batchesForDate = plan.batches.filter(b => b.date === date);

  // Dependency-graph highlight resolver. Memoized so each row gets a stable fn.
  const highlightFor = useMemo<(productionItemId: string) => HighlightMode>(() => {
    if (!focusedItemId) return () => 'none';
    const related = computeRelatedItems(site.id, focusedItemId);
    return (productionItemId: string) => {
      if (productionItemId === related.focus) return 'focus';
      if (related.upstream.has(productionItemId)) return 'upstream';
      if (related.downstream.has(productionItemId)) return 'downstream';
      return 'dim';
    };
  }, [focusedItemId, site.id]);

  const focusedRecipeName = useMemo(() => {
    if (!focusedItemId) return null;
    const item = getProductionItem(focusedItemId);
    return item ? getRecipe(item.recipeId)?.name ?? null : null;
  }, [focusedItemId]);

  const width = boardBodyWidth();

  if (mode === 'mobile') {
    return (
      <MobileBoard
        site={site}
        benches={siteBenches}
        instances={instancesForDate}
        batches={batchesForDate}
        onBatchClick={onBatchClick}
        onCadenceClick={onCadenceClick}
        onSwitchDesktop={() => setMode('desktop')}
        highlightFor={highlightFor}
      />
    );
  }

  return (
    <div style={{ width: '100%', overflow: 'auto', background: '#ffffff' }}>
      <div style={{ minWidth: 180 + width }}>
        {/* Header strip: site + legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{site.name}</h2>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {site.type} · {new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
            </span>
          </div>
          {focusedRecipeName && onClearFocus ? (
            <FocusBanner recipeName={focusedRecipeName} onClear={onClearFocus} />
          ) : (
            <BoardLegend />
          )}
        </div>

        {/* Time header */}
        <TimeHeader width={width} nowHHMM={nowHHMM} />

        {/* Bench rows */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {siteBenches.map(bench => (
            <BenchRow
              key={bench.id}
              bench={bench}
              plannedInstances={instancesForDate.filter(pi => pi.benchId === bench.id)}
              batches={batchesForDate.filter(b => b.benchId === bench.id)}
              onBatchClick={onBatchClick}
              onCadenceClick={onCadenceClick}
              bodyWidth={width}
              highlightFor={highlightFor}
            />
          ))}
          {siteBenches.length === 0 && (
            <div style={{ padding: '24px 16px', color: 'var(--color-text-muted)', fontSize: 13 }}>
              No benches configured for {site.name}. {site.type === 'SPOKE' ? 'Receive-only site.' : 'Add a bench to start planning.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FocusBanner({ recipeName, onClear }: { recipeName: string; onClear: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-secondary)' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          borderRadius: 999,
          background: 'var(--color-info-light)',
          color: 'var(--color-info)',
          fontWeight: 600,
          fontSize: 11,
        }}
      >
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent-active)' }} />
        {recipeName}
      </span>
      <span style={{ color: 'var(--color-text-muted)' }}>
        Highlighting components (upstream) and assemblies (downstream).
      </span>
      <button
        type="button"
        onClick={onClear}
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-accent-active)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        Clear
      </button>
    </div>
  );
}

function BoardLegend() {
  const items: Array<{ label: string; swatch: React.ReactNode }> = [
    {
      label: 'Run',
      swatch: <span style={{ display: 'inline-block', width: 14, height: 10, border: '1px solid var(--color-border)', borderRadius: 2, background: '#fff' }} />,
    },
    {
      label: 'Variable',
      swatch: <span style={{ display: 'inline-block', width: 14, height: 10, border: '1px dashed var(--color-accent-mid)', borderRadius: 2, background: '#fff' }} />,
    },
    {
      label: 'Increment',
      swatch: <span style={{ display: 'inline-block', width: 14, height: 10, border: '1px solid var(--color-accent-active)', borderRadius: 2, background: 'var(--color-info-light)' }} />,
    },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>
      {items.map(it => (
        <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {it.swatch}
          {it.label}
        </span>
      ))}
    </div>
  );
}

function TimeHeader({ width, nowHHMM }: { width: number; nowHHMM?: string }) {
  const marks = hourMarks();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-hover)',
      }}
    >
      {/* Gutter placeholder */}
      <div
        style={{
          width: 180,
          minWidth: 180,
          borderRight: '1px solid var(--color-border-subtle)',
          padding: '8px 14px',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          position: 'sticky',
          left: 0,
          zIndex: 2,
          background: 'var(--color-bg-hover)',
        }}
      >
        Bench
      </div>
      {/* Hour axis */}
      <div style={{ position: 'relative', height: 32, width, minWidth: width }}>
        {marks.map((mk, i) => {
          const left = leftForTime(mk);
          return (
            <div
              key={mk}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left,
                fontSize: 11,
                color: 'var(--color-text-muted)',
                paddingLeft: 4,
                borderLeft: i === 0 ? 'none' : '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {mk}
            </div>
          );
        })}
        {/* Now marker */}
        {nowHHMM && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: leftForTime(nowHHMM),
              width: 2,
              background: 'var(--color-accent-active)',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: -6,
                left: -18,
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-accent-active)',
                background: '#ffffff',
                borderRadius: 6,
                padding: '2px 4px',
                border: '1px solid var(--color-accent-active)',
                letterSpacing: '0.02em',
              }}
            >
              Now
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile layout — card per bench, batches stacked vertically
// ─────────────────────────────────────────────────────────────────────────────

function MobileBoard({
  site,
  benches,
  instances,
  batches,
  onBatchClick,
  onCadenceClick,
  onSwitchDesktop,
  highlightFor,
}: {
  site: Site;
  benches: Bench[];
  instances: PlannedInstance[];
  batches: ProductionBatch[];
  onBatchClick?: (id: string) => void;
  onCadenceClick?: (productionItemId: string) => void;
  onSwitchDesktop: () => void;
  highlightFor: (productionItemId: string) => HighlightMode;
}) {
  return (
    <div style={{ padding: '12px 12px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{site.name}</h2>
        <button
          onClick={onSwitchDesktop}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-accent-active)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Show grid
        </button>
      </div>
      {benches.map(bench => {
        const benchInstances = instances.filter(pi => pi.benchId === bench.id);
        const benchBatches = batches.filter(b => b.benchId === bench.id);

        // Pair & collect cadences for this bench
        const matchedBatchIds = new Set<string>();
        const slots = benchInstances.map(pi => {
          const batch = benchBatches.find(b => b.plannedInstanceId === pi.id);
          if (batch) matchedBatchIds.add(batch.id);
          return { pi, batch };
        });
        const onDemand = benchBatches.filter(b => !b.plannedInstanceId && !matchedBatchIds.has(b.id));

        const seenItemIds = new Set<string>();
        const cadences = benchInstances
          .map(pi => {
            if (seenItemIds.has(pi.productionItemId)) return null;
            const item = getProductionItem(pi.productionItemId);
            if (!item || item.mode !== 'increment' || !item.cadence) return null;
            seenItemIds.add(item.id);
            const recipe = getRecipe(item.recipeId);
            if (!recipe) return null;
            return { item, recipe };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);

        const progress = computeProgress(slots, benchBatches);

        return (
          <div
            key={bench.id}
            style={{
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-card)',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{bench.name}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {bench.capabilities.join(' · ')}
                </div>
              </div>
              {progress.total > 0 && (
                <StatusPill
                  tone={progress.done === progress.total ? 'success' : 'neutral'}
                  label={`${progress.done}/${progress.total}`}
                  size="xs"
                />
              )}
            </div>
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cadences.map(({ item, recipe }) => (
                <IncrementCadence
                  key={item.id}
                  cadence={item.cadence!}
                  recipe={recipe}
                  overridden={!item.cadence!.quinnProposed}
                  inline
                  onClick={onCadenceClick ? () => onCadenceClick(item.id) : undefined}
                />
              ))}
              {slots.map(({ pi, batch }) => {
                const item = getProductionItem(pi.productionItemId);
                const recipe = item ? getRecipe(item.recipeId) : undefined;
                if (!item || !recipe) return null;
                const targetId = batch?.id ?? pi.id;
                return (
                  <BatchBlock
                    key={pi.id}
                    recipe={recipe}
                    mode={item.mode}
                    plannedInstance={pi}
                    batch={batch}
                    inline
                    onClick={onBatchClick ? () => onBatchClick(targetId) : undefined}
                    highlight={highlightFor(pi.productionItemId)}
                  />
                );
              })}
              {onDemand.map(batch => {
                const item = getProductionItem(batch.productionItemId);
                const recipe = item ? getRecipe(item.recipeId) : undefined;
                if (!item || !recipe) return null;
                return (
                  <BatchBlock
                    key={batch.id}
                    recipe={recipe}
                    mode={item.mode}
                    batch={batch}
                    inline
                    onClick={onBatchClick ? () => onBatchClick(batch.id) : undefined}
                    highlight={highlightFor(batch.productionItemId)}
                  />
                );
              })}
              {slots.length + onDemand.length + cadences.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: 6 }}>
                  No activity on this bench today.
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function computeProgress(
  slots: Array<{ pi: PlannedInstance; batch?: ProductionBatch }>,
  allBatches: ProductionBatch[],
): { done: number; total: number } {
  const total = slots.length;
  const done = slots.filter(s => s.batch && (s.batch.status === 'reviewed' || s.batch.status === 'dispatched')).length;
  // Bump total for on-demand completions (they count toward done, not total unless we want)
  void allBatches;
  return { done, total };
}

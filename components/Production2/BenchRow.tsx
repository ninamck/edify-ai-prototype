'use client';

import BatchBlock from './BatchBlock';
import IncrementCadence from './IncrementCadence';
import type {
  Bench,
  PlannedInstance,
  ProductionBatch,
} from './fixtures';
import {
  getProductionItem,
  getRecipe,
} from './fixtures';
import { leftForTime, widthForSpan, boardBodyWidth } from './time';

type Props = {
  bench: Bench;
  /** Planned instances for this bench on the board's date. */
  plannedInstances: PlannedInstance[];
  /** Batches for this bench on the board's date (incl. on-demand with no plannedInstance). */
  batches: ProductionBatch[];
  onBatchClick?: (id: string) => void;
  onCadenceClick?: (productionItemId: string) => void;
  /** Desktop width of the row body (px). */
  bodyWidth?: number;
  /** Dependency-highlight helper. Returns the highlight mode for a given production item. */
  highlightFor?: (productionItemId: string) => 'focus' | 'upstream' | 'downstream' | 'dim' | 'none';
};

export default function BenchRow({
  bench,
  plannedInstances,
  batches,
  onBatchClick,
  onCadenceClick,
  bodyWidth = boardBodyWidth(),
  highlightFor,
}: Props) {
  const resolveHighlight = (productionItemId: string) =>
    highlightFor ? highlightFor(productionItemId) : 'none';
  // Pair each planned instance with its batch (if any)
  const matchedBatchIds = new Set<string>();
  const slots = plannedInstances.map(pi => {
    const batch = batches.find(b => b.plannedInstanceId === pi.id);
    if (batch) matchedBatchIds.add(batch.id);
    return { pi, batch };
  });
  const onDemand = batches.filter(b => !b.plannedInstanceId && !matchedBatchIds.has(b.id));

  // Collect unique increment-mode cadences touching this bench
  const seenItemIds = new Set<string>();
  const cadences = plannedInstances
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

  const rowHeight = 88;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: bench.online ? '#ffffff' : 'var(--color-bg-hover)',
      }}
    >
      {/* Bench label gutter */}
      <div
        style={{
          width: 180,
          minWidth: 180,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          justifyContent: 'center',
          borderRight: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          position: 'sticky',
          left: 0,
          zIndex: 2,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {bench.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {bench.capabilities.join(' · ')}
        </div>
        {bench.batchRules && (
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            Holds {bench.batchRules.min}–{bench.batchRules.max} · ×{bench.batchRules.multipleOf}
          </div>
        )}
        {!bench.online && (
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-error)' }}>OFFLINE</div>
        )}
      </div>

      {/* Timeline body */}
      <div
        style={{
          position: 'relative',
          height: rowHeight,
          width: bodyWidth,
          minWidth: bodyWidth,
        }}
      >
        {/* Hour grid lines */}
        <HourGridLines width={bodyWidth} />

        {/* Cadence strips first (underneath blocks) */}
        {cadences.map(({ item, recipe }) => (
          <IncrementCadence
            key={`cad-${item.id}`}
            cadence={item.cadence!}
            recipe={recipe}
            overridden={!item.cadence!.quinnProposed}
            onClick={onCadenceClick ? () => onCadenceClick(item.id) : undefined}
          />
        ))}

        {/* Planned + actual blocks */}
        {slots.map(({ pi, batch }) => {
          const item = getProductionItem(pi.productionItemId);
          const recipe = item ? getRecipe(item.recipeId) : undefined;
          if (!item || !recipe) return null;
          const left = leftForTime(batch?.startTime ?? pi.startTime);
          const width = widthForSpan(batch?.startTime ?? pi.startTime, batch?.endTime ?? pi.endTime);
          const targetId = batch?.id ?? pi.id;
          return (
            <BatchBlock
              key={pi.id}
              recipe={recipe}
              mode={item.mode}
              plannedInstance={pi}
              batch={batch}
              leftPx={left}
              widthPx={width}
              onClick={onBatchClick ? () => onBatchClick(targetId) : undefined}
              highlight={resolveHighlight(pi.productionItemId)}
            />
          );
        })}

        {/* On-demand batches (no planned instance) */}
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
              leftPx={leftForTime(batch.startTime)}
              widthPx={widthForSpan(batch.startTime, batch.endTime)}
              onClick={onBatchClick ? () => onBatchClick(batch.id) : undefined}
              highlight={resolveHighlight(batch.productionItemId)}
            />
          );
        })}
      </div>
    </div>
  );
}

function HourGridLines({ width }: { width: number }) {
  const hourPx = 60 * 1.8; // matches PX_PER_MINUTE
  const count = Math.floor(width / hourPx);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Array.from({ length: count + 1 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: i * hourPx,
            width: 1,
            background: i % 2 === 0 ? 'var(--color-border-subtle)' : 'var(--color-border-subtle)',
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}

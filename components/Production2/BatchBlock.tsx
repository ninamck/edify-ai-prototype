'use client';

import type { CSSProperties } from 'react';
import StatusPill from './StatusPill';
import type {
  ProductionBatch,
  PlannedInstance,
  ProductionRecipe,
  ProductionMode,
  BatchStatus,
} from './fixtures';

type Props = {
  recipe: ProductionRecipe;
  mode: ProductionMode;
  /** If a batch exists, use its status + actuals; otherwise show the planned instance. */
  batch?: ProductionBatch;
  plannedInstance?: PlannedInstance;
  /** When laid out inline (mobile card) rather than absolutely positioned. */
  inline?: boolean;
  /** Positioning (used when !inline). */
  leftPx?: number;
  widthPx?: number;
  onClick?: () => void;
  /**
   * Visual emphasis for dependency-aware highlighting on the board.
   *  - 'focus': user clicked this block.
   *  - 'upstream': a component this block depends on (e.g. bread/filling for a sandwich).
   *  - 'downstream': an assembly that consumes this block.
   *  - 'dim': selection is active, this block is unrelated.
   *  - 'none' (default): no selection active.
   */
  highlight?: 'focus' | 'upstream' | 'downstream' | 'dim' | 'none';
};

const MODE_TREATMENT: Record<ProductionMode, { border: string; bg: string; accent: string }> = {
  run:       { border: 'var(--color-border)',       bg: '#ffffff',                 accent: 'var(--color-accent-active)' },
  variable:  { border: 'var(--color-accent-mid)',   bg: '#ffffff',                 accent: 'var(--color-accent-mid)' },
  increment: { border: 'var(--color-accent-active)', bg: 'var(--color-info-light)', accent: 'var(--color-info)' },
};

const MODE_LABEL: Record<ProductionMode, string> = {
  run:       'Run',
  variable:  'Variable',
  increment: 'Increment',
};

export default function BatchBlock({
  recipe,
  mode,
  batch,
  plannedInstance,
  inline = false,
  leftPx = 0,
  widthPx = 120,
  onClick,
  highlight = 'none',
}: Props) {
  const status: BatchStatus = batch?.status ?? 'planned';
  const qty = batch?.actualQty ?? plannedInstance?.plannedQty ?? 0;
  const startTime = batch?.startTime ?? plannedInstance?.startTime ?? '';
  const endTime = batch?.endTime ?? plannedInstance?.endTime ?? '';
  const treatment = MODE_TREATMENT[mode];
  const dashed = mode === 'variable';

  const narrow = !inline && widthPx < 96;
  const veryNarrow = !inline && widthPx < 52;

  const positionStyle: CSSProperties = inline
    ? { width: '100%' }
    : { position: 'absolute', left: leftPx, width: widthPx, top: 8, height: 60 };

  // Dependency-highlight treatment (stacked on top of mode styling).
  const highlightRing =
    highlight === 'focus'      ? '0 0 0 2px var(--color-accent-active), 0 4px 12px rgba(0,0,0,0.12)' :
    highlight === 'upstream'   ? '0 0 0 2px var(--color-info)' :
    highlight === 'downstream' ? '0 0 0 2px var(--color-accent-mid)' :
    status === 'in-progress'   ? '0 0 0 2px var(--color-info-light)' :
                                 'none';

  const dim = highlight === 'dim';
  const opacity = dim ? 0.28 : 1;
  const zIndex = highlight === 'focus' ? 4 : highlight === 'upstream' || highlight === 'downstream' ? 3 : 1;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${recipe.name} · ${qty} · ${startTime}–${endTime} · ${MODE_LABEL[mode]}`}
      style={{
        ...positionStyle,
        minHeight: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        gap: 2,
        padding: veryNarrow ? '4px 4px' : '6px 8px',
        borderRadius: 'var(--radius-card)',
        background: treatment.bg,
        border: `1px ${dashed ? 'dashed' : 'solid'} ${treatment.border}`,
        boxShadow: highlightRing,
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'var(--font-primary)',
        color: 'var(--color-text-primary)',
        overflow: 'hidden',
        opacity,
        zIndex,
        transition: 'opacity 120ms ease, box-shadow 120ms ease',
      }}
    >
      {/* Header row: recipe + qty */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
        {!narrow && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {recipe.name}
          </span>
        )}
        <span
          style={{
            fontSize: veryNarrow ? 14 : 16,
            fontWeight: 700,
            color: treatment.accent,
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
            marginLeft: 'auto',
          }}
        >
          {qty}
        </span>
      </div>

      {/* Footer row: time + status pill */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {!veryNarrow && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--color-text-muted)',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {startTime}{narrow ? '' : `–${endTime}`}
          </span>
        )}
        {!narrow && <StatusPill status={status} size="xs" />}
        {narrow && !veryNarrow && (
          <span
            aria-label={status}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background:
                status === 'reviewed'     ? 'var(--color-success)' :
                status === 'in-progress'  ? 'var(--color-info)' :
                status === 'failed'       ? 'var(--color-error)' :
                status === 'complete'     ? 'var(--color-warning)' :
                status === 'dispatched'   ? 'var(--color-accent-active)' :
                                            'var(--color-border)',
            }}
          />
        )}
      </div>
    </button>
  );
}

'use client';

import {
  WORK_TYPE_LABELS,
  WORK_TYPE_ORDER,
  type WorkType,
} from './fixtures';

/**
 * Compact chip for a single work-type tag (Weigh up · Prep · Cook · Slice
 * · Assemble · Pack · Sanitise). Used on recipe cards, today rows, and
 * bench entries to make the canonical activity vocabulary visible
 * everywhere the same recipe shows up.
 *
 * Two sizes:
 *   - 'xs' — for inline use next to other small pills (kind / mode)
 *   - 'sm' — for the recipe library where chips can breathe
 */
export default function WorkTypeChip({
  workType,
  size = 'xs',
}: {
  workType: WorkType;
  size?: 'xs' | 'sm';
}) {
  const label = WORK_TYPE_LABELS[workType];
  const isXs = size === 'xs';
  return (
    <span
      title={`${label} — kind of work`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: isXs ? '2px 7px' : '3px 9px',
        borderRadius: 100,
        background: 'var(--color-bg-hover)',
        color: 'var(--color-text-secondary)',
        fontSize: isXs ? 10 : 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        fontFamily: 'var(--font-primary)',
        whiteSpace: 'nowrap',
        lineHeight: 1.1,
      }}
    >
      {label}
    </span>
  );
}

/**
 * Renders a list of work-type chips for a recipe / row, deduped and in
 * canonical order. Empty list renders nothing — callers don't need to
 * guard.
 */
export function WorkTypeChips({
  workTypes,
  size = 'xs',
  max,
}: {
  workTypes: WorkType[];
  size?: 'xs' | 'sm';
  /** Truncate to first N chips and append a "+N" overflow indicator. */
  max?: number;
}) {
  if (!workTypes.length) return null;
  const ordered = WORK_TYPE_ORDER.filter(w => workTypes.includes(w));
  const visible = max != null ? ordered.slice(0, max) : ordered;
  const overflow = ordered.length - visible.length;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flexWrap: 'wrap',
      }}
    >
      {visible.map(w => (
        <WorkTypeChip key={w} workType={w} size={size} />
      ))}
      {overflow > 0 && (
        <span
          title={ordered.slice(visible.length).map(w => WORK_TYPE_LABELS[w]).join(', ')}
          style={{
            fontSize: size === 'xs' ? 10 : 11,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}

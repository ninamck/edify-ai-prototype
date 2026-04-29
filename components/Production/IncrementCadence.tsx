'use client';

import type { IncrementCadence as IncrementCadenceType, ProductionRecipe } from './fixtures';
import { hhmmToMinutes, leftForTime, PX_PER_MINUTE } from './time';

type Props = {
  cadence: IncrementCadenceType;
  recipe: ProductionRecipe;
  /** Whether cadence was overridden at the site (hub) level away from Quinn's proposal. */
  overridden?: boolean;
  /** Inline layout (mobile card) vs positioned (desktop grid). */
  inline?: boolean;
  /** Opens the cadence detail panel for this recipe. */
  onClick?: () => void;
};

/** Renders the cadence rhythm as a thin strip with a tick at every interval drop. */
export default function IncrementCadence({ cadence, recipe, overridden = false, inline = false, onClick }: Props) {
  const startMin = hhmmToMinutes(cadence.startTime);
  const endMin = hhmmToMinutes(cadence.endTime);
  const ticks: number[] = [];
  for (let m = startMin; m <= endMin; m += cadence.intervalMinutes) {
    ticks.push(m);
  }
  const count = ticks.length;

  const clickable = !!onClick;

  if (inline) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!clickable}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 'var(--radius-badge)',
          background: 'var(--color-info-light)',
          border: '1px solid var(--color-info)',
          fontSize: 11,
          color: 'var(--color-info)',
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          width: '100%',
          cursor: clickable ? 'pointer' : 'default',
          textAlign: 'left',
        }}
        title={`${recipe.name} · every ${cadence.intervalMinutes}min · ${cadence.startTime}–${cadence.endTime} · ${count} drops`}
      >
        <span style={{ fontWeight: 700 }}>{recipe.name}</span>
        <span>
          every {cadence.intervalMinutes}min · {count} drops
          {overridden && ' · hub override'}
        </span>
      </button>
    );
  }

  const left = leftForTime(cadence.startTime);
  const width = (endMin - startMin) * PX_PER_MINUTE;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      title={`${recipe.name} · every ${cadence.intervalMinutes}min · ${cadence.startTime}–${cadence.endTime} · ${count} drops${overridden ? ' (hub override)' : ''}`}
      style={{
        position: 'absolute',
        left,
        width,
        bottom: 6,
        height: 14,
        display: 'flex',
        alignItems: 'center',
        borderRadius: 7,
        background: 'var(--color-info-light)',
        border: `1px ${overridden ? 'solid' : 'dashed'} var(--color-info)`,
        padding: '0 4px',
        cursor: clickable ? 'pointer' : 'default',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* axis */}
      <div
        style={{
          position: 'absolute',
          left: 6,
          right: 6,
          top: '50%',
          height: 1,
          background: 'var(--color-info)',
          opacity: 0.35,
        }}
      />
      {/* interval ticks */}
      {ticks.map((m) => {
        const tickLeft = ((m - startMin) / (endMin - startMin)) * (width - 12) + 6;
        return (
          <span
            key={m}
            style={{
              position: 'absolute',
              left: tickLeft,
              top: 3,
              width: 4,
              height: 8,
              borderRadius: 2,
              background: 'var(--color-info)',
            }}
          />
        );
      })}
      {/* label bubble (right-aligned) */}
      <span
        style={{
          marginLeft: 'auto',
          marginRight: 2,
          fontSize: 9,
          fontWeight: 600,
          color: 'var(--color-info)',
          background: '#ffffff',
          borderRadius: 6,
          padding: '0 4px',
          position: 'relative',
          zIndex: 1,
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        {recipe.name} · {cadence.intervalMinutes}min
        {overridden && ' · override'}
      </span>
    </button>
  );
}

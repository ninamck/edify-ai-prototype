'use client';

/**
 * Renders a Task's computed downstream impact. Used in two places:
 *   • Inline on each ActivityRow when expanded.
 *   • On the ProductPickRecipesCard preview before confirm (Surface 1
 *     of the audit model — "show blast radius, not just action").
 *
 * Lines are pre-sorted by the differ. We render them as a small table
 * with a coloured delta column so the worst hits read fast.
 */

import type { BlastRadiusLine } from '@/components/Feed/taskHistoryStore';

const METRIC_LABELS: Record<BlastRadiusLine['metric'], string> = {
  gp_pct: 'GP%',
  cogs_daily: 'COGs (daily)',
  allergen_exposure: 'Allergen exposure',
  sites_affected: 'Sites',
  recipes_affected: 'Recipes affected',
};

export default function BlastRadiusBlock({
  lines,
  density = 'comfortable',
}: {
  lines: BlastRadiusLine[];
  density?: 'compact' | 'comfortable';
}) {
  if (lines.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        background: 'transparent',
        border: density === 'compact' ? 'none' : '1px solid var(--color-border-subtle)',
        borderRadius: density === 'compact' ? 0 : 8,
        padding: density === 'compact' ? 0 : '8px 10px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 110px 100px 100px 90px',
          gap: 10,
          padding: '4px 0',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <span>Entity</span>
        <span>Metric</span>
        <span style={{ textAlign: 'right' }}>Before</span>
        <span style={{ textAlign: 'right' }}>After</span>
        <span style={{ textAlign: 'right' }}>Δ</span>
      </div>
      {lines.map((l, i) => {
        const positive = (l.delta ?? 0) > 0;
        const zero = Math.abs(l.delta ?? 0) < 0.05;
        const deltaText = zero
          ? '—'
          : `${positive ? '+' : '−'}${Math.abs(l.delta ?? 0)}${l.unit ? `\u202F${l.unit}` : ''}`;
        const deltaColour = zero
          ? 'var(--color-text-muted)'
          : positive
            ? '#22573F'
            : '#A8401C';
        return (
          <div
            key={`${l.metric}-${l.entityLabel}-${i}`}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 110px 100px 100px 90px',
              gap: 10,
              padding: '6px 0',
              borderTop: '1px dashed var(--color-border-subtle)',
              alignItems: 'center',
              fontSize: 12,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-primary)',
            }}
          >
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {l.entityLabel}
            </span>
            <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: 11.5 }}>
              {METRIC_LABELS[l.metric]}
            </span>
            <span style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
              {String(l.before)}
              {l.unit ? `\u202F${l.unit}` : ''}
            </span>
            <span style={{ textAlign: 'right', fontWeight: 700 }}>
              {String(l.after)}
              {l.unit ? `\u202F${l.unit}` : ''}
            </span>
            <span style={{ textAlign: 'right', color: deltaColour, fontWeight: 700 }}>
              {deltaText}
            </span>
          </div>
        );
      })}
    </div>
  );
}

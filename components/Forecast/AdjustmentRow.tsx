'use client';

/**
 * AdjustmentRow — appears inline beneath the selected cell of the
 * HorizonGrid. It is the surface that makes forecasting feel like the
 * spine of the product: nudge the number here and the cascade across
 * ingredients, hub-spoke allocations, and the bench schedule narrates
 * itself underneath.
 *
 * Three parts, left → right:
 *   1. Stepper       — −/+ buttons + raw value, with a "reset to Quinn"
 *                      affordance when the manager has moved off the
 *                      Quinn-proposed value.
 *   2. Narrative     — a single line capturing the cascade in plain
 *                      English ("+10 chicken caesar → +0.8 kg chicken
 *                      on tomorrow's order · +2 ciabatta…").
 *   3. Chips         — a flat row of impact chips for the cases where
 *                      the narrative compresses too far. Ingredients
 *                      first, then per-spoke allocations.
 *
 * Mutation policy follows the plan's recommendation: this is a pending
 * change only — committing to /prod-2/production/amounts is deferred
 * to v2. Today the surface narrates the effect so the demo can
 * communicate "Quinn would do this" without requiring cross-page
 * plumbing.
 */

import { useMemo } from 'react';
import { Minus, Plus, RotateCcw, ArrowRight, HelpCircle } from 'lucide-react';
import { dayOfWeek, type SiteId } from '@/components/Production/fixtures';
import { computeDownstreamImpact } from './downstream';
import type { ForecastRow } from './accuracy';

type Props = {
  siteId: SiteId;
  row: ForecastRow;
  date: string;
  /** What the cell currently shows. */
  currentValue: number;
  /** Quinn's untouched proposal (so we can render the delta and offer "reset"). */
  baseValue: number;
  onOverride: (qty: number | null) => void;
  /** Explicit opt-in to open the right-side WhyPanel for this (skuId, date). */
  onOpenWhy: () => void;
};

export default function AdjustmentRow({
  siteId,
  row,
  date,
  currentValue,
  baseValue,
  onOverride,
  onOpenWhy,
}: Props) {
  const delta = currentValue - baseValue;
  const hasDelta = delta !== 0;

  const impact = useMemo(
    () => computeDownstreamImpact(siteId, row.skuId, delta),
    [siteId, row.skuId, delta],
  );

  const dow = dayOfWeek(date);

  // The narrative sentence — composed from the impact result. Falls
  // back to the "no effect yet" copy when the manager hasn't moved
  // off baseline, which is the state the row mounts in.
  const narrative = (() => {
    if (!hasDelta) {
      return `Baseline forecast is ${baseValue} ${row.recipe.name.toLowerCase()} for ${dow}. Use −/+ to test alternatives — the cascade will show here.`;
    }
    if (impact.isEmpty) {
      return `${signed(delta)} on ${dow}'s ${row.recipe.name.toLowerCase()} — no ingredient or hub-spoke cascade modelled for this recipe yet.`;
    }
    const parts: string[] = [];
    if (impact.ingredients.length > 0) {
      const top = impact.ingredients.slice(0, 2)
        .map(i => `${i.prettyDelta} ${i.ingredientName.toLowerCase()}`)
        .join(', ');
      const more =
        impact.ingredients.length > 2
          ? `, +${impact.ingredients.length - 2} more`
          : '';
      parts.push(`${top}${more} on ${dow}'s order`);
    }
    if (impact.spokes.length > 0) {
      const top = impact.spokes.slice(0, 2)
        .map(s => `${signedUnits(s.deltaUnits)} to ${s.spokeName}`)
        .join(', ');
      const more =
        impact.spokes.length > 2 ? `, +${impact.spokes.length - 2} more spokes` : '';
      parts.push(`${top}${more}`);
    }
    return `${signed(delta)} ${row.recipe.name.toLowerCase()} → ${parts.join(' · ')}.`;
  })();

  return (
    <div
      style={{
        padding: '14px 16px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Top row — stepper + narrative */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <Stepper
          value={currentValue}
          baseValue={baseValue}
          onChange={v => onOverride(v === baseValue ? null : v)}
        />
        {hasDelta && (
          <button
            type="button"
            onClick={() => onOverride(null)}
            style={resetBtn}
            title="Reset this day's forecast to the baseline."
          >
            <RotateCcw size={12} />
            Reset to {baseValue}
          </button>
        )}
        <button
          type="button"
          onClick={onOpenWhy}
          style={whyBtn}
          title="Open the signals + phase split that drove this number."
        >
          <HelpCircle size={13} />
          Why this number?
        </button>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
          <ArrowRight size={13} />
          <span>Cascade preview</span>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--color-text-primary)',
            flex: 1,
            minWidth: 240,
          }}
        >
          {narrative}
        </p>
      </div>

      {/* Chip row — ingredients + spokes */}
      {hasDelta && !impact.isEmpty && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {impact.ingredients.map(i => (
            <Chip
              key={i.ingredientId}
              tone={i.deltaQty >= 0 ? 'add' : 'remove'}
              label={`${i.prettyDelta} · ${i.ingredientName.toLowerCase()}`}
              title={
                i.via.length > 0
                  ? `Via ${i.via.map(v => v.recipeName).join(', ')}`
                  : i.ingredientName
              }
            />
          ))}
          {impact.spokes.map(s => (
            <Chip
              key={s.spokeId}
              tone="spoke"
              label={`${signedUnits(s.deltaUnits)} → ${s.spokeName}`}
              title={`Allocation derived from sales factor`}
            />
          ))}
          {impact.bench && (
            <Chip
              tone="bench"
              label={impact.bench.caption}
              title={`Bench plan for ${impact.bench.category} recipes`}
            />
          )}
        </div>
      )}

      {/* Pending-change footer — explicit "not yet committed" framing. */}
      {hasDelta && (
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: 'var(--color-text-muted)',
            lineHeight: 1.5,
          }}
        >
          Pending — sits on this page only. To commit, the manager confirms on{' '}
          <span style={{ fontWeight: 600 }}>Plan production</span>; this preview is the cascade
          that would flow downstream.
        </p>
      )}
    </div>
  );
}

function Stepper({
  value,
  baseValue,
  onChange,
}: {
  value: number;
  baseValue: number;
  onChange: (next: number) => void;
}) {
  const minus = () => onChange(Math.max(0, value - 1));
  const plus = () => onChange(value + 1);
  const reset = value === baseValue;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        background: '#ffffff',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button type="button" onClick={minus} style={stepperBtn} aria-label="Decrease forecast">
        <Minus size={15} />
      </button>
      <div
        style={{
          minWidth: 70,
          textAlign: 'center',
          padding: '6px 10px',
          fontSize: 18,
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
          fontVariantNumeric: 'tabular-nums',
          color: reset ? 'var(--color-text-primary)' : 'var(--color-accent-active)',
          borderLeft: '1px solid var(--color-border-subtle)',
          borderRight: '1px solid var(--color-border-subtle)',
        }}
      >
        {value}
      </div>
      <button type="button" onClick={plus} style={stepperBtn} aria-label="Increase forecast">
        <Plus size={15} />
      </button>
    </div>
  );
}

function Chip({
  tone,
  label,
  title,
}: {
  tone: 'add' | 'remove' | 'spoke' | 'bench';
  label: string;
  title?: string;
}) {
  const palette: Record<typeof tone, { bg: string; border: string; color: string }> = {
    add: {
      bg: 'var(--color-success-light)',
      border: 'var(--color-success-border)',
      color: 'var(--color-success)',
    },
    remove: {
      bg: 'var(--color-error-light)',
      border: 'var(--color-error-border)',
      color: 'var(--color-error)',
    },
    spoke: {
      bg: 'var(--color-info-light)',
      border: 'transparent',
      color: 'var(--color-info)',
    },
    bench: {
      bg: 'var(--color-bg-hover)',
      border: 'var(--color-border-subtle)',
      color: 'var(--color-text-secondary)',
    },
  };
  const p = palette[tone];
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 8px',
        background: p.bg,
        border: `1px solid ${p.border}`,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: p.color,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

const stepperBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  border: 'none',
  background: '#ffffff',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};

const resetBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 10px',
  background: '#ffffff',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const whyBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 10px',
  background: '#ffffff',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--color-accent-active)',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

function signed(n: number): string {
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : `${n}`;
}

function signedUnits(n: number): string {
  if (n === 0) return '0 units';
  return n > 0 ? `+${n} units` : `${n} units`;
}

'use client';

/**
 * Shared unit-of-measure input pill used by both the full Stocktake
 * count flow and the inline quick-count panel inside the item detail
 * drawer. Each unit gets its own self-contained box (number on the
 * left, unit tag on the right) so a multi-UOM row reads as N discrete
 * decisions, with the border + tag tone keyed off the unit's
 * *category* (count / mass / volume / other) for fast scanning.
 *
 * The unit-category helper is loose on purpose — fixture values like
 * "kg", "G", "ml", "Each", "BAGS", "Case" all land in the right
 * bucket without callers having to normalise.
 */

import type { CSSProperties } from 'react';

export type UnitCategory = 'count' | 'mass' | 'volume' | 'other';

interface UnitTone {
  /** Outline + tag text colour. */
  tone: string;
  /** Soft fill behind the tag. */
  tagBg: string;
}

export const UNIT_TONES: Record<UnitCategory, UnitTone> = {
  count:  { tone: 'var(--color-success)',         tagBg: 'var(--color-success-light)' },
  mass:   { tone: 'var(--color-info)',            tagBg: 'var(--color-info-light)' },
  volume: { tone: 'var(--color-warning)',         tagBg: 'var(--color-warning-light)' },
  other:  { tone: 'var(--color-text-secondary)',  tagBg: 'var(--color-bg-hover)' },
};

/** Bucket a raw unit string into a category. Loose matching
 *  (case-insensitive, common abbreviations) so callers don't have to
 *  normalise. */
export function unitCategory(unit: string): UnitCategory {
  const u = unit.trim().toLowerCase();
  if (['kg', 'g', 'mg', 'lb', 'lbs', 'oz', 'kilo', 'kilos', 'gram', 'grams'].includes(u)) {
    return 'mass';
  }
  if (['l', 'ml', 'cl', 'fl oz', 'litre', 'litres', 'liter', 'liters'].includes(u)) {
    return 'volume';
  }
  if (
    ['each', 'unit', 'units', 'piece', 'pieces', 'pcs',
     'bag', 'bags', 'case', 'cases', 'box', 'boxes',
     'pack', 'packs', 'dozen', 'tray', 'trays',
     'bottle', 'bottles', 'can', 'cans', 'jar', 'jars'].includes(u)
  ) {
    return 'count';
  }
  return 'other';
}

export interface UnitInputProps {
  unit: string;
  value: string;
  onChange: (next: string) => void;
  /** Input width override. Defaults to 96px which suits the count
   *  flow's wide grid. Use a smaller value (e.g. 72) when stacking
   *  inputs inside a narrower drawer. */
  inputWidth?: number;
  /** Min width for the unit tag column. Defaults to 56. */
  tagMinWidth?: number;
  /** Font size for the number input. Defaults to 18 (intentionally
   *  matched against the "Theoretical" / "Count" readouts on the
   *  count flow so the operator's tally reads as a peer of the
   *  system's figure rather than a smaller scratchpad). Drawer
   *  surfaces with less breathing room can pass a smaller value. */
  inputFontSize?: number;
  /** Optional aria-label override. */
  ariaLabel?: string;
}

export default function UnitInput({
  unit,
  value,
  onChange,
  inputWidth = 96,
  tagMinWidth = 56,
  inputFontSize = 18,
  ariaLabel,
}: UnitInputProps) {
  const { tone, tagBg } = UNIT_TONES[unitCategory(unit)];
  const hasValue = value.trim() !== '' && !Number.isNaN(parseFloat(value));

  const containerStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'stretch',
    border: `1px solid ${tone}`,
    borderRadius: 'var(--radius-item)',
    background: hasValue ? tagBg : '#fff',
    overflow: 'hidden',
  };

  return (
    <div style={containerStyle}>
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0"
        aria-label={ariaLabel ?? `Count in ${unit}`}
        style={{
          width: inputWidth,
          padding: '8px 12px',
          border: 'none',
          outline: 'none',
          fontSize: inputFontSize,
          fontWeight: hasValue ? 700 : 500,
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-primary)',
          background: 'transparent',
          textAlign: 'left',
        }}
      />
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 12px',
          fontFamily: 'var(--font-primary)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: tone,
          background: tagBg,
          borderLeft: `1px solid ${tone}`,
          whiteSpace: 'nowrap',
          minWidth: tagMinWidth,
        }}
      >
        {unit}
      </span>
    </div>
  );
}

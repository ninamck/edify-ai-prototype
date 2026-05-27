'use client';

/**
 * TotalEditor — shared editable KPI tile + small helpers for total-level
 * forecast adjustments.
 *
 * The /forecast page lets the operator nudge the whole-day forecast at
 * the headline ("Revenue / Items / Transactions") level, not just one
 * SKU at a time. Editing any of the three tiles implies a single
 * multiplier vs. Quinn's baseline:
 *
 *   multiplier = newValue / baselineValue
 *
 * All three metrics derive from items (transactions are items ÷ basket
 * size; revenue is items × price), so storing a single per-date items
 * multiplier is sufficient — Revenue and Transactions edits resolve to
 * the same multiplier the items edit would have produced. The downstream
 * SKU grid scales every base unit count by that same multiplier, which
 * is what "cascade to SKUs" looks like in practice.
 *
 * Why a multiplier and not a per-metric override?
 *   - One number → one mental model. "I think today will be ~10% busier"
 *     is the operator-language version of multiplier = 1.10.
 *   - Per-SKU manual overrides (set via AdjustmentRow) still win on top,
 *     because they're stored under the same `overrides` map and are
 *     applied after the multiplier in HorizonGrid.
 *   - Switching dates / re-opening the page keeps the same multiplier,
 *     so the operator's "today" judgement persists.
 */

import { useEffect, useRef, useState } from 'react';
import { Check, Pencil, RotateCcw, X } from 'lucide-react';

export type TotalMultipliers = Record<string, number>;

/** Resolve the active multiplier for a date (1.0 means "use Quinn's baseline"). */
export function multiplierFor(map: TotalMultipliers, date: string): number {
  const v = map[date];
  if (!v || !Number.isFinite(v) || v <= 0) return 1;
  return v;
}

/** True when the operator has nudged this date away from the baseline. */
export function isEdited(map: TotalMultipliers, date: string): boolean {
  return Math.abs(multiplierFor(map, date) - 1) > 0.005;
}

/** Compute a new multiplier such that `baseValue * multiplier == newValue`. */
export function multiplierForNewValue(
  baseValue: number,
  newValue: number,
): number {
  if (baseValue <= 0) return 1;
  if (newValue <= 0) return 0.0001; // guard div-by-zero downstream
  return newValue / baseValue;
}

// ────────────────────────────────────────────────────────────────────────────
// EditableKpiTile — the shared visual the two hero cards both use.
// ────────────────────────────────────────────────────────────────────────────

type Props = {
  icon: React.ReactNode;
  label: string;
  /** Number rendered in the big readout (post-multiplier). */
  value: number;
  /** Pre-formatted big readout. */
  display: string;
  /** Baseline value the operator is nudging vs (used to compute % delta). */
  baseline: number;
  /**
   * Optional sub-line shown beneath the big value — used by the
   * Result-tab tiles to surface "Sold so far" or "Full day forecast"
   * underneath the comparison numbers. Pass `null` to omit.
   */
  subline?: React.ReactNode;
  /**
   * Mini comparison strip rendered just above the delta row. The Result
   * card uses this to show forecast-vs-actual bars; the Forecast card
   * leaves it undefined.
   */
  compareVisual?: React.ReactNode;
  /**
   * Called with the new total when the operator commits an edit.
   * `null` resets the override (back to baseline).
   */
  onCommit: (newValue: number | null) => void;
  /** Parser used to turn the typed string into a number (e.g. strip "£"). */
  parse: (input: string) => number | null;
  /** Whether this tile is currently overridden vs the baseline. */
  isOverridden: boolean;
  /** Currently active multiplier (only used to render the +X% pill). */
  multiplier: number;
  /** Whether editing is allowed at all. Past Result days lock to false. */
  editable?: boolean;
};

export default function EditableKpiTile({
  icon,
  label,
  value,
  display,
  baseline,
  subline,
  compareVisual,
  onCommit,
  parse,
  isOverridden,
  multiplier,
  editable = true,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      // Pre-fill the input with the current displayed number (stripped
      // of currency / locale punctuation) so the operator can tweak
      // rather than retype from scratch.
      setDraft(stringifyForInput(value));
      // Defer focus + select so the input mounts first.
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing, value]);

  const commit = () => {
    const parsed = parse(draft);
    if (parsed == null || !Number.isFinite(parsed) || parsed < 0) {
      setEditing(false);
      return;
    }
    // Treat "same as baseline" (rounding-equal) as a reset so the tile
    // visibly leaves the edited state instead of carrying a 1.00x
    // multiplier the operator can't see.
    if (Math.abs(parsed - baseline) / Math.max(baseline, 1) < 0.002) {
      onCommit(null);
    } else {
      onCommit(parsed);
    }
    setEditing(false);
  };

  const cancel = () => setEditing(false);
  const reset = () => onCommit(null);

  const deltaPct = baseline > 0 ? ((multiplier - 1) * 100) : 0;

  return (
    <div
      style={{
        position: 'relative',
        padding: '14px 14px 12px',
        background: isOverridden
          ? 'color-mix(in srgb, var(--color-accent-active) 5%, white)'
          : 'var(--color-bg-hover)',
        border: `1px solid ${
          isOverridden
            ? 'color-mix(in srgb, var(--color-accent-active) 35%, white)'
            : 'var(--color-border-subtle)'
        }`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {icon}
        <span style={{ flex: 1 }}>{label}</span>
        {editable && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${label}`}
            title="Edit forecast"
            style={iconButtonStyle}
          >
            <Pencil size={12} />
          </button>
        )}
        {editable && isOverridden && !editing && (
          <button
            type="button"
            onClick={reset}
            aria-label={`Reset ${label} to the baseline forecast`}
            title="Reset to the baseline forecast"
            style={iconButtonStyle}
          >
            <RotateCcw size={12} />
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
            inputMode="decimal"
            style={{
              fontSize: 24,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--color-text-primary)',
              lineHeight: 1.1,
              padding: '4px 8px',
              border: '1px solid var(--color-accent-active)',
              borderRadius: 6,
              outline: 'none',
              width: '100%',
              fontFamily: 'inherit',
              background: '#ffffff',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={commit} style={primaryBtnStyle}>
              <Check size={12} /> Save
            </button>
            <button type="button" onClick={cancel} style={ghostBtnStyle}>
              <X size={12} /> Cancel
            </button>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', alignSelf: 'center', marginLeft: 'auto' }}>
              Baseline {stringifyForDisplay(baseline)}
            </span>
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--color-text-primary)',
              lineHeight: 1.1,
            }}
          >
            {display}
          </div>
          {subline}
          {compareVisual}
          {isOverridden && (
            <EditedDeltaPill pct={deltaPct} />
          )}
        </>
      )}
    </div>
  );
}

function EditedDeltaPill({ pct }: { pct: number }) {
  const tone = pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral';
  const palette = {
    up: {
      bg: 'var(--color-success-light)',
      color: 'var(--color-success)',
      border: 'var(--color-success-border)',
    },
    down: {
      bg: 'var(--color-error-light)',
      color: 'var(--color-error)',
      border: 'var(--color-error-border)',
    },
    neutral: {
      bg: '#ffffff',
      color: 'var(--color-text-muted)',
      border: 'var(--color-border-subtle)',
    },
  }[tone];
  const sign = pct > 0 ? '+' : '';
  return (
    <span
      style={{
        alignSelf: 'flex-start',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        background: palette.bg,
        color: palette.color,
        border: `1px solid ${palette.border}`,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      Edited {sign}
      {Math.abs(pct) < 0.5 ? '0' : Math.round(pct)}%
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Parsers / stringifiers — keep currency + count interactions tidy.
// ────────────────────────────────────────────────────────────────────────────

/** Strip non-numeric characters except a single decimal point. */
function stripNumeric(s: string): string {
  // Allow "£1,200" → "1200", "1.2k" → "1.2k" handled below.
  return s.replace(/[^0-9.\-kK]/g, '');
}

/** Parse a currency input like "£1,200", "1.2k", "1500". */
export function parseCurrencyInput(raw: string): number | null {
  const t = stripNumeric(raw.trim());
  if (!t) return null;
  if (/k$/i.test(t)) {
    const n = Number.parseFloat(t.slice(0, -1));
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 1000);
  }
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Parse a count input like "1,200" or "1.2k". */
export function parseCountInput(raw: string): number | null {
  const t = stripNumeric(raw.trim());
  if (!t) return null;
  if (/k$/i.test(t)) {
    const n = Number.parseFloat(t.slice(0, -1));
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 1000);
  }
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function stringifyForInput(n: number): string {
  return String(Math.round(n));
}

function stringifyForDisplay(n: number): string {
  return n.toLocaleString('en-GB');
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const iconButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 6,
  background: '#ffffff',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  padding: 0,
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 11px',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
  border: '1px solid var(--color-accent-active)',
  borderRadius: 6,
  background: 'var(--color-accent-active)',
  color: '#ffffff',
  cursor: 'pointer',
};

const ghostBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 11px',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 6,
  background: '#ffffff',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};

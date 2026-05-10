'use client';

import { Minus, Plus } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * QtyStepper — the canonical "minus / value / plus" control used wherever
 * a manager nudges an integer quantity up or down.
 *
 * Three sizes cover the demo's range of densities:
 *   - compact      — dense lists, ≤ 22px tall buttons   (rejects, adhoc, mini run/var rows)
 *   - default      — primary editing grids               (spoke order grid, PCR form)
 *   - emphasized   — per-slot focus cards                (per-drop expanded editor)
 *
 * Two variants of chrome:
 *   - default       — pill-shaped wrapper with border + bg
 *   - `chromeless`  — buttons + value are siblings only; the caller
 *                     supplies its own row styling. Used in adhoc strips
 *                     where the stepper sits inside a wider grid cell.
 *
 * Value rendering is delegated to children: callers pass either an
 * `<input type="number">` or a read-only `<span>` so each surface keeps
 * its own number formatting / typing behaviour.
 */

export type QtyStepperSize = 'compact' | 'default' | 'emphasized';

type SizeTokens = {
  buttonSize: number;
  buttonRadius: number;
  iconSize: number;
  /** Padding around the wrapper when not chromeless. */
  wrapperPadding: string;
  wrapperRadius: number;
  /** Gap between the three slots. */
  gap: number;
};

const SIZE_TOKENS: Record<QtyStepperSize, SizeTokens> = {
  compact:    { buttonSize: 22, buttonRadius: 5, iconSize: 11, wrapperPadding: '2px 4px',  wrapperRadius: 8,  gap: 4 },
  default:    { buttonSize: 28, buttonRadius: 6, iconSize: 13, wrapperPadding: '4px 6px',  wrapperRadius: 8,  gap: 6 },
  emphasized: { buttonSize: 32, buttonRadius: 6, iconSize: 14, wrapperPadding: '4px 6px',  wrapperRadius: 10, gap: 4 },
};

type Props = {
  size?: QtyStepperSize;
  /** Drop the wrapper chrome (no bg / border / padding around the trio). */
  chromeless?: boolean;
  /** Greys the entire stepper without disabling the buttons individually. */
  disabled?: boolean;
  /** Disables only the minus button (e.g. value is at floor). */
  canDecrement?: boolean;
  /** Disables only the plus button (e.g. value is at ceiling). */
  canIncrement?: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
  /** Centre slot — caller-controlled (input, readonly span, etc.). */
  children: ReactNode;
  /** Wrapper override — merged on top of the size defaults. */
  style?: CSSProperties;
  /** Title text on the minus button (a11y / tooltip). */
  decrementLabel?: string;
  /** Title text on the plus button. */
  incrementLabel?: string;
};

export default function QtyStepper({
  size = 'default',
  chromeless = false,
  disabled = false,
  canDecrement = true,
  canIncrement = true,
  onDecrement,
  onIncrement,
  children,
  style,
  decrementLabel = 'Decrease',
  incrementLabel = 'Increase',
}: Props) {
  const t = SIZE_TOKENS[size];
  const minusDisabled = disabled || !canDecrement;
  const plusDisabled = disabled || !canIncrement;

  // `width: fit-content` keeps the wrapper sized to its content even when
  // the stepper is dropped into a grid or flex parent that would
  // otherwise stretch it (and leave dead space to the right of the +).
  const wrapperStyle: CSSProperties = chromeless
    ? {
        display: 'inline-flex',
        width: 'fit-content',
        alignItems: 'center',
        gap: t.gap,
        opacity: disabled ? 0.55 : 1,
        ...style,
      }
    : {
        display: 'inline-flex',
        width: 'fit-content',
        alignItems: 'center',
        gap: t.gap,
        background: '#ffffff',
        border: '1px solid var(--color-border)',
        borderRadius: t.wrapperRadius,
        padding: t.wrapperPadding,
        opacity: disabled ? 0.55 : 1,
        ...style,
      };

  return (
    <div style={wrapperStyle}>
      <button
        type="button"
        onClick={onDecrement}
        disabled={minusDisabled}
        title={decrementLabel}
        aria-label={decrementLabel}
        style={buttonStyle(t, minusDisabled)}
      >
        <Minus size={t.iconSize} />
      </button>
      {children}
      <button
        type="button"
        onClick={onIncrement}
        disabled={plusDisabled}
        title={incrementLabel}
        aria-label={incrementLabel}
        style={buttonStyle(t, plusDisabled)}
      >
        <Plus size={t.iconSize} />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Public style helpers — exported so surfaces with custom JSX (lock icons,   */
/* presets, mode toggles) can compose their own row while still matching the  */
/* canonical button / value sizing.                                           */
/* -------------------------------------------------------------------------- */

export function getStepperButtonStyle(size: QtyStepperSize, disabled = false): CSSProperties {
  return buttonStyle(SIZE_TOKENS[size], disabled);
}

export function getStepperIconSize(size: QtyStepperSize): number {
  return SIZE_TOKENS[size].iconSize;
}

export function getStepperButtonSize(size: QtyStepperSize): number {
  return SIZE_TOKENS[size].buttonSize;
}

/**
 * Canonical centre-value style for steppers using a read-only span.
 * Sites using an `<input type="number">` should match width manually
 * (compact ≈ 28, default ≈ 44, emphasized ≈ 48) — that detail varies
 * by max digit count.
 */
export function getStepperValueStyle(
  size: QtyStepperSize,
  opts: { muted?: boolean } = {},
): CSSProperties {
  const fontSize = size === 'compact' ? 12 : size === 'default' ? 14 : 16;
  const minWidth = size === 'compact' ? 26 : size === 'default' ? 32 : 36;
  return {
    fontSize,
    fontWeight: 700,
    minWidth,
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
    color: opts.muted ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
    fontFamily: 'var(--font-primary)',
  };
}

/* -------------------------------------------------------------------------- */

function buttonStyle(t: SizeTokens, disabled: boolean): CSSProperties {
  return {
    width: t.buttonSize,
    height: t.buttonSize,
    borderRadius: t.buttonRadius,
    border: '1px solid var(--color-border-subtle)',
    background: disabled ? 'var(--color-bg-hover)' : '#ffffff',
    color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    fontFamily: 'var(--font-primary)',
  };
}

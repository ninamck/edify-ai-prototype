'use client';

import { Minus, Plus } from 'lucide-react';
import type { CSSProperties } from 'react';

const CSS = `
.edify-number-stepper__cap:hover { background: var(--color-bg-hover); }
.edify-number-stepper__cap:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--color-text-primary); }
.edify-number-stepper__input:focus { outline: none; box-shadow: inset 0 0 0 1px var(--color-text-primary); }
`;

// Keeps digits and, when maxDecimals > 0, a single decimal point with at most
// that many fractional digits. A leading minus only when the range allows it.
function sanitize(raw: string, maxDecimals: number, allowNegative: boolean): string {
  const negative = allowNegative && raw.trim().startsWith('-');
  let body: string;
  if (maxDecimals <= 0) {
    body = raw.replace(/\D/g, '');
  } else {
    const cleaned = raw.replace(/[^\d.]/g, '');
    const dot = cleaned.indexOf('.');
    body =
      dot === -1
        ? cleaned
        : `${cleaned.slice(0, dot)}.${cleaned.slice(dot + 1).replace(/\./g, '').slice(0, maxDecimals)}`;
  }
  return negative ? `-${body}` : body;
}

// A number field between 44px − and + buttons, for counting on a phone.
// Steps by one whole unit and keeps any fraction, so 2.5 steps to 3.5.
export function NumberStepper({
  value,
  onValueChange,
  min,
  max,
  maxDecimals,
  ariaLabel,
  decrementLabel,
  incrementLabel,
  step = 1,
  required,
  disabled,
  invalid = false,
  describedBy,
  tone = 'default',
  style,
}: {
  value: string;
  onValueChange: (next: string) => void;
  min: number;
  max: number;
  maxDecimals: number;
  ariaLabel: string;
  decrementLabel: string;
  incrementLabel: string;
  step?: number;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  // `warning` tints the control; callers say why in text too, so colour isn't
  // the only signal.
  tone?: 'default' | 'warning';
  style?: CSSProperties;
}) {
  const current = Number.parseFloat(value);
  const base = Number.isFinite(current) ? current : 0;
  const stepBy = (delta: number) => {
    const next = Math.round((base + delta) * 1000) / 1000;
    onValueChange(String(Math.max(min, Math.min(max, next))));
  };
  const atMin = base <= min;
  const atMax = base >= max;

  const onBlur = () => {
    if (value.trim() === '') return;
    const num = Number(value);
    if (Number.isNaN(num)) {
      onValueChange('');
      return;
    }
    const clamped = Math.max(min, Math.min(max, num));
    if (String(clamped) !== value) onValueChange(String(clamped));
  };

  const cap = (atLimit: boolean): CSSProperties => ({
    display: 'flex',
    width: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: 'var(--color-text-primary)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: atLimit ? 0.4 : 1,
    pointerEvents: atLimit || disabled ? 'none' : undefined,
    transition: 'background-color 120ms ease',
  });

  return (
    <div
      style={{
        display: 'inline-flex',
        height: 48,
        alignItems: 'stretch',
        overflow: 'hidden',
        borderRadius: 8,
        border: `1px solid ${
          invalid
            ? 'var(--color-error)'
            : tone === 'warning'
              ? 'var(--color-warning-border)'
              : 'var(--color-border)'
        }`,
        background: tone === 'warning' && !invalid ? 'var(--color-warning-light)' : 'var(--color-bg-surface)',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <style href="edify-number-stepper" precedence="default">
        {CSS}
      </style>
      <button
        type="button"
        className="edify-number-stepper__cap"
        style={{ ...cap(atMin), borderRight: '1px solid var(--color-border)' }}
        aria-label={decrementLabel}
        disabled={disabled}
        aria-disabled={atMin || undefined}
        onClick={() => {
          if (!atMin) stepBy(-step);
        }}
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <input
        type="text"
        className="edify-number-stepper__input"
        inputMode={maxDecimals > 0 ? 'decimal' : 'numeric'}
        value={value}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        disabled={disabled}
        onChange={(e) => onValueChange(sanitize(e.target.value, maxDecimals, min < 0))}
        onBlur={onBlur}
        style={{
          height: '100%',
          width: 48,
          border: 0,
          borderRadius: 0,
          background: 'transparent',
          padding: '0 4px',
          textAlign: 'center',
          fontFamily: 'inherit',
          fontSize: 16,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-text-primary)',
        }}
      />
      <button
        type="button"
        className="edify-number-stepper__cap"
        style={{ ...cap(atMax), borderLeft: '1px solid var(--color-border)' }}
        aria-label={incrementLabel}
        disabled={disabled}
        aria-disabled={atMax || undefined}
        onClick={() => {
          if (!atMax) stepBy(step);
        }}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export default NumberStepper;

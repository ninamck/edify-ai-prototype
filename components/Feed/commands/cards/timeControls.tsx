'use client';

/**
 * Shared time controls for the site-setup cards, matching the pill
 * inputs on the Production settings page in Edify main: a collapsed
 * range pill ("🕐 05:00 – 07:00") that expands an inline start/end
 * editor. Inline rather than a popover because CardShell clips
 * overflow.
 */

import { Clock, Minus, Plus } from 'lucide-react';
import type { TimeWindow } from '../siteSetupFixtures';

export function Stepper({
  value,
  min,
  disabled,
  onChange,
}: {
  value: number;
  min: number;
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  const btn: React.CSSProperties = {
    width: '22px',
    height: '22px',
    borderRadius: '7px',
    border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
    background: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer',
    color: 'var(--color-text-secondary)',
    padding: 0,
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <button type="button" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} style={btn}>
        <Minus size={12} strokeWidth={2.4} />
      </button>
      <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-primary)', minWidth: '14px', textAlign: 'center' }}>
        {value}
      </span>
      <button type="button" disabled={disabled} onClick={() => onChange(value + 1)} style={btn}>
        <Plus size={12} strokeWidth={2.4} />
      </button>
    </span>
  );
}

export const labelStyle: React.CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
};

export const timeInputStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '3px 6px',
  borderRadius: '8px',
  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
  fontSize: '12px',
  fontWeight: 700,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  background: disabled ? 'rgba(0,28,53,0.03)' : '#fff',
});

export function RangePill({
  text,
  open,
  disabled,
  onClick,
}: {
  text: string;
  open: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '10px',
        border: open
          ? '1.5px solid var(--color-brand, #001c35)'
          : '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
        background: '#fff',
        fontSize: '12px',
        fontWeight: 700,
        fontFamily: 'var(--font-primary)',
        color: 'var(--color-text-primary)',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <Clock size={12} strokeWidth={2.2} style={{ color: 'var(--color-text-muted)' }} />
      {text}
    </button>
  );
}

/** Inline start/end editor shown under an open range pill. */
export function WindowEditor({
  window: win,
  disabled,
  onChange,
  onDone,
}: {
  window: TimeWindow;
  disabled: boolean;
  onChange: (edge: 'start' | 'end', value: string) => void;
  onDone: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        borderRadius: '10px',
        border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.10))',
        background: '#fff',
        alignSelf: 'flex-start',
      }}
    >
      <span style={labelStyle}>Start</span>
      <input
        type="time"
        disabled={disabled}
        value={win.start}
        onChange={(e) => onChange('start', e.target.value)}
        style={timeInputStyle(disabled)}
      />
      <span style={labelStyle}>End</span>
      <input
        type="time"
        disabled={disabled}
        value={win.end}
        onChange={(e) => onChange('end', e.target.value)}
        style={timeInputStyle(disabled)}
      />
      <button
        type="button"
        onClick={onDone}
        style={{
          border: 'none',
          background: 'none',
          fontSize: '11.5px',
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-brand, #001c35)',
          cursor: 'pointer',
          padding: '2px 4px',
        }}
      >
        Done
      </button>
    </div>
  );
}

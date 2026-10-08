'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Check } from 'lucide-react';

export const gbp = (n: number) => `£${n.toFixed(2)}`;

export const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-card)',
  padding: 16,
};

export const sectionLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--color-text-secondary)',
  margin: '0 0 8px',
};

export function PrimaryButton({
  children, onClick, disabled, icon, full = true, testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  full?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: full ? '100%' : undefined,
        minHeight: 48, padding: '0 20px',
        borderRadius: 'var(--radius-item)',
        border: disabled ? '1px solid var(--color-border)' : 'none',
        background: disabled ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
        color: disabled ? 'var(--color-text-secondary)' : 'var(--color-text-on-active)',
        fontFamily: 'var(--font-primary)', fontSize: 15, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children, onClick, icon, full = false, testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  full?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: full ? '100%' : undefined,
        minHeight: 44, padding: '0 16px',
        borderRadius: 'var(--radius-item)',
        border: '1px solid var(--color-border)',
        background: '#fff',
        color: 'var(--color-accent-deep)',
        fontFamily: 'var(--font-primary)', fontSize: 14, fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export interface ChoiceOption {
  id: string;
  label: string;
  hint?: string;
}

/** Single-select pills. One decision per group, 40px tap targets. */
export function ChoiceGroup({
  label, options, value, onChange, stacked = false,
}: {
  label: string;
  options: ChoiceOption[];
  value: string | undefined;
  onChange: (id: string) => void;
  stacked?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', flexDirection: stacked ? 'column' : 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
              minHeight: 40, padding: o.hint ? '8px 14px' : '0 14px',
              borderRadius: 999,
              border: on ? '1.5px solid var(--color-accent-active)' : '1px solid var(--color-border)',
              background: on ? 'var(--color-accent-active)' : '#fff',
              color: on ? 'var(--color-text-on-active)' : 'var(--color-text-primary)',
              fontFamily: 'var(--font-primary)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
              ...(stacked ? { borderRadius: 'var(--radius-item)', width: '100%' } : {}),
            }}
          >
            {on && <Check size={16} aria-hidden />}
            <span>
              {o.label}
              {o.hint && (
                <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: on ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)' }}>
                  {o.hint}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function StepHeading({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>{title}</h1>
      {sub && <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.45 }}>{sub}</p>}
    </div>
  );
}

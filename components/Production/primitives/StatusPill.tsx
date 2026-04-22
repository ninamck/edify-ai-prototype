'use client';

import type { ReactNode } from 'react';

export type PillTone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'accent';

const TONE_STYLES: Record<PillTone, { bg: string; color: string }> = {
  neutral: { bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' },
  success: { bg: 'rgba(21,128,61,0.10)', color: 'var(--color-success)' },
  warning: { bg: 'rgba(146,64,14,0.10)', color: 'var(--color-warning)' },
  error:   { bg: 'rgba(185,28,28,0.08)', color: 'var(--color-error)' },
  info:    { bg: 'rgba(3,28,89,0.08)', color: '#031c59' },
  accent:  { bg: 'rgba(34,68,68,0.10)', color: 'var(--color-accent-active)' },
};

export interface StatusPillProps {
  label: ReactNode;
  tone?: PillTone;
  size?: 'xs' | 'sm';
  icon?: ReactNode;
}

export default function StatusPill({ label, tone = 'neutral', size = 'sm', icon }: StatusPillProps) {
  const style = TONE_STYLES[tone];
  const font = size === 'xs' ? '10px' : '11px';
  const pad = size === 'xs' ? '2px 7px' : '3px 9px';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: pad,
        borderRadius: 'var(--radius-badge)',
        background: style.bg,
        color: style.color,
        fontSize: font,
        fontWeight: 700,
        letterSpacing: '0.02em',
        fontFamily: 'var(--font-primary)',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </span>
  );
}

'use client';

import type { BatchStatus } from './fixtures';

type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'error' | 'brand';

const TONE_STYLES: Record<Tone, { bg: string; color: string; border: string }> = {
  neutral: { bg: 'var(--color-bg-hover)',      color: 'var(--color-text-secondary)', border: 'var(--color-border-subtle)' },
  info:    { bg: 'var(--color-info-light)',    color: 'var(--color-info)',           border: 'var(--color-info-light)' },
  warning: { bg: 'var(--color-warning-light)', color: 'var(--color-warning)',        border: 'var(--color-warning-border)' },
  success: { bg: 'var(--color-success-light)', color: 'var(--color-success)',        border: 'var(--color-success-border)' },
  error:   { bg: 'var(--color-error-light)',   color: 'var(--color-error)',          border: 'var(--color-error-border)' },
  brand:   { bg: 'var(--color-badge-active-bg)', color: 'var(--color-accent-active)', border: 'var(--color-accent-mid)' },
};

const STATUS_TONE: Record<BatchStatus, Tone> = {
  planned:     'neutral',
  'in-progress': 'info',
  complete:    'warning',    // done-but-not-yet-PCR-reviewed -> amber (needs attention)
  failed:      'error',
  reviewed:    'success',
  dispatched:  'brand',
};

const STATUS_LABEL: Record<BatchStatus, string> = {
  planned:     'Planned',
  'in-progress': 'In progress',
  complete:    'Needs review',
  failed:      'Failed',
  reviewed:    'Reviewed',
  dispatched:  'Dispatched',
};

export function StatusPill({
  status,
  size = 'sm',
  label,
  tone: overrideTone,
}: {
  status?: BatchStatus;
  size?: 'xs' | 'sm';
  /** Explicit label overrides the status label. */
  label?: string;
  /** Explicit tone overrides the status-derived tone. */
  tone?: Tone;
}) {
  const tone = overrideTone ?? (status ? STATUS_TONE[status] : 'neutral');
  const text = label ?? (status ? STATUS_LABEL[status] : '');
  const { bg, color, border } = TONE_STYLES[tone];
  const padY = size === 'xs' ? 2 : 3;
  const padX = size === 'xs' ? 6 : 8;
  const fontSize = size === 'xs' ? 10 : 11;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `${padY}px ${padX}px`,
        borderRadius: 'var(--radius-badge)',
        background: bg,
        color,
        border: `1px solid ${border}`,
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      {text}
    </span>
  );
}

export default StatusPill;

'use client';

import type { BatchStatus } from './fixtures';

type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'error' | 'brand';

// Outline pills — see `.cursor/rules/status-pills.mdc`. White background,
// coloured text, 1.5px coloured border. NEVER solid semantic fills.
const TONE_STYLES: Record<Tone, { color: string; border: string }> = {
  neutral: { color: 'var(--color-text-secondary)', border: 'var(--color-border)' },
  info:    { color: 'var(--color-info)',            border: 'var(--color-info)' },
  warning: { color: 'var(--color-warning)',         border: 'var(--color-warning)' },
  success: { color: 'var(--color-success)',         border: 'var(--color-success)' },
  error:   { color: 'var(--color-error)',           border: 'var(--color-error)' },
  brand:   { color: 'var(--color-accent-active)',  border: 'var(--color-accent-active)' },
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
  const { color, border } = TONE_STYLES[tone];
  const padY = size === 'xs' ? 2 : 3;
  const padX = size === 'xs' ? 7 : 9;
  const fontSize = size === 'xs' ? 10 : 11;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `${padY}px ${padX}px`,
        borderRadius: 999,
        background: '#ffffff',
        color,
        border: `1.5px solid ${border}`,
        fontSize,
        fontWeight: 700,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      {text}
    </span>
  );
}

export default StatusPill;

'use client';

import type { ReactNode } from 'react';

export type TaskCardTone = 'pending' | 'in_progress' | 'complete' | 'warning';

const TONE_BORDER: Record<TaskCardTone, string> = {
  pending: 'var(--color-border-subtle)',
  in_progress: 'var(--color-accent-active)',
  complete: 'var(--color-success)',
  warning: 'var(--color-warning)',
};

export interface TaskCardProps {
  title: string;
  /** Big number — qty, minutes, whatever. */
  headline?: number | string;
  headlineLabel?: string;
  subtitle?: ReactNode;
  /** Rows of metadata under the main content (label · value). */
  metaRows?: Array<{ label: string; value: ReactNode }>;
  statusLabel?: string;
  tone?: TaskCardTone;
  priority?: boolean;
  /** Primary CTA — huge tap target, single action. */
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  /** Optional secondary action (smaller, e.g. "+1 reject"). */
  secondaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  /** Custom content area below meta rows, above actions. */
  children?: ReactNode;
}

// Wet-hands friendly: 20px+ text, 56px+ tap targets, bold numbers,
// colour never the only state indicator (statusLabel accompanies tone).
export default function TaskCard({
  title,
  headline,
  headlineLabel,
  subtitle,
  metaRows,
  statusLabel,
  tone = 'pending',
  priority,
  primaryAction,
  secondaryAction,
  children,
}: TaskCardProps) {
  return (
    <article
      style={{
        background: '#fff',
        border: '2px solid',
        borderColor: TONE_BORDER[tone],
        borderRadius: 'var(--radius-card)',
        padding: '18px 16px',
        fontFamily: 'var(--font-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {/* Header: title + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3
              style={{
                margin: 0,
                fontSize: '22px',
                lineHeight: 1.2,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
              }}
            >
              {title}
            </h3>
            {priority && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-badge)',
                  background: 'rgba(146,64,14,0.12)',
                  color: 'var(--color-warning)',
                }}
              >
                Priority
              </span>
            )}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
                marginTop: '4px',
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {statusLabel && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              padding: '5px 10px',
              borderRadius: 'var(--radius-badge)',
              background:
                tone === 'in_progress' ? 'rgba(34,68,68,0.10)' :
                tone === 'complete' ? 'rgba(21,128,61,0.12)' :
                tone === 'warning' ? 'rgba(146,64,14,0.12)' :
                'var(--color-bg-hover)',
              color:
                tone === 'in_progress' ? 'var(--color-accent-active)' :
                tone === 'complete' ? 'var(--color-success)' :
                tone === 'warning' ? 'var(--color-warning)' :
                'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {/* Headline number */}
      {headline !== undefined && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span
            style={{
              fontSize: '44px',
              fontWeight: 700,
              lineHeight: 1,
              color: 'var(--color-text-primary)',
            }}
          >
            {headline}
          </span>
          {headlineLabel && (
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              {headlineLabel}
            </span>
          )}
        </div>
      )}

      {/* Meta rows */}
      {metaRows && metaRows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {metaRows.map(row => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                fontSize: '14px',
                padding: '4px 0',
              }}
            >
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{row.label}</span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 700, textAlign: 'right' }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {children}

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              style={{
                flex: 1,
                minHeight: '56px',
                padding: '14px 18px',
                borderRadius: '12px',
                border: 'none',
                background: primaryAction.disabled ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
                color: primaryAction.disabled ? 'var(--color-text-muted)' : '#fff',
                fontSize: '18px',
                fontWeight: 700,
                fontFamily: 'var(--font-primary)',
                cursor: primaryAction.disabled ? 'not-allowed' : 'pointer',
                transition: 'background 0.12s ease',
              }}
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              style={{
                minHeight: '56px',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1.5px solid var(--color-border-subtle)',
                background: '#fff',
                color: 'var(--color-text-primary)',
                fontSize: '14px',
                fontWeight: 700,
                fontFamily: 'var(--font-primary)',
                cursor: secondaryAction.disabled ? 'not-allowed' : 'pointer',
                opacity: secondaryAction.disabled ? 0.5 : 1,
              }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

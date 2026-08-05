'use client';

/**
 * Shared building blocks for the three starter dashboard templates
 * (Daily / Weekly flash / Period end). Same visual language as the manager
 * and Second Cup dashboards: navy-bordered tiles, recharts, dense tables.
 *
 * Cross-template principles enforced here rather than per-tile:
 *  - Theoretical vs measured figures are always badged, never implied.
 *  - Variance direction is never encoded by colour alone (sign + icon + colour).
 *  - Tiles with an unshipped data dependency carry the dependency on the tile.
 */

import type { CSSProperties, ReactNode } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Lock } from 'lucide-react';

export const NAVY = '#001C35';
export const VALUE_INK = '#1A148A';
export const OK = '#28AFC9';
export const WARN = '#FF0058';
export const OK_TEXT = '#166534';
export const WARN_TEXT = '#B45309';
export const MID = '#4a6cb5';
export const GHOST = '#C9CFD6';

export const tipStyle = {
  background: '#FCF6EE',
  border: `1px solid ${NAVY}`,
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 500,
  color: NAVY,
};

// ─── Badges ───────────────────────────────────────────────────────────────────

/** Small caps pill marking a figure as theoretical / measured / etc. */
export function FigureBadge({ kind }: { kind: 'theoretical' | 'measured' | 'ai' }) {
  const config = {
    theoretical: { text: 'Theoretical', bg: '#FCF6EE', border: '#D9C8A9', color: '#7A5C1E' },
    measured: { text: 'Measured', bg: '#EBF7F0', border: '#A9D9BE', color: OK_TEXT },
    ai: { text: 'Edify AI', bg: '#EEF0FB', border: '#B9C1EE', color: VALUE_INK },
  }[kind];
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '2px 7px',
        borderRadius: 999,
        background: config.bg,
        border: `1px solid ${config.border}`,
        color: config.color,
        whiteSpace: 'nowrap',
      }}
    >
      {config.text}
    </span>
  );
}

/** Names the data capture a tile is waiting on. Shown instead of pretending. */
export function DependencyBadge({ needs }: { needs: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        background: '#FEF6DA',
        border: '1px solid #EAD173',
        color: WARN_TEXT,
        whiteSpace: 'nowrap',
      }}
    >
      <Lock size={10} strokeWidth={2.4} />
      Needs: {needs}
    </span>
  );
}

// ─── Tiles & cards ────────────────────────────────────────────────────────────

export function KpiTile({
  label,
  value,
  delta,
  positive,
  context,
  badge,
  children,
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  context?: string;
  badge?: ReactNode;
  children?: ReactNode;
}) {
  const deltaColor = positive === undefined ? 'var(--color-text-secondary)' : positive ? OK_TEXT : WARN_TEXT;
  const DeltaIcon = positive === undefined ? null : positive ? TrendingUp : TrendingDown;
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: '10px 0 10px 10px',
        border: `1px solid ${NAVY}`,
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0, 28, 53,0.08), 0 0 0 1px rgba(0, 28, 53,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', flex: 1, minWidth: 0 }}>
          {label}
        </span>
        {badge}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color: VALUE_INK, whiteSpace: 'nowrap' }}>{value}</div>
      {(delta || context) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: deltaColor, flexWrap: 'wrap' }}>
          {DeltaIcon && <DeltaIcon size={12} strokeWidth={2.4} />}
          {delta && <span>{delta}</span>}
          {context && <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>· {context}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export function TileCard({
  title,
  subtitle,
  badge,
  actions,
  footer,
  children,
  minHeight,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  /** Chat/Email chips — rendered after the badge in the header row. */
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  minHeight?: number;
}) {
  return (
    <div
      style={{
        borderRadius: '12px 0 12px 12px',
        border: `1px solid ${NAVY}`,
        background: '#fff',
        boxShadow: '0 2px 12px rgba(0, 28, 53,0.1), 0 0 0 1px rgba(0, 28, 53,0.03)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight,
        height: '100%',
      }}
    >
      <div style={{ padding: '14px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', flex: 1, minWidth: 0 }}>{title}</div>
          {badge}
          {actions}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      {footer && (
        <div style={{ padding: '10px 16px 12px', fontSize: 11.5, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-subtle)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

// ─── Table primitives ─────────────────────────────────────────────────────────

export const TH: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  padding: '9px 14px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--color-border-subtle)',
  borderTop: '1px solid var(--color-border-subtle)',
};

export const TD: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  padding: '9px 14px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--color-border-subtle)',
};

/** Signed delta — sign and colour together, never colour alone. */
export function DeltaText({ pct, suffix = '%', goodWhenDown = false }: { pct: number; suffix?: string; goodWhenDown?: boolean }) {
  const up = pct >= 0;
  const good = goodWhenDown ? !up : up;
  return (
    <span style={{ fontWeight: 700, color: good ? OK_TEXT : WARN_TEXT }}>
      {up ? '+' : '−'}{Math.abs(pct).toFixed(1)}{suffix}
    </span>
  );
}

/** Inline flag for a site that hasn't met a compliance condition. */
export function FlagText({ text }: { text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: WARN_TEXT }}>
      <AlertTriangle size={11} strokeWidth={2.4} />
      {text}
    </span>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function Grid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 14,
        gridAutoFlow: 'dense',
      }}
    >
      {children}
    </div>
  );
}

export const FULL: CSSProperties = { gridColumn: 'span 2 / span 2', minWidth: 0 };
export const HALF: CSSProperties = { gridColumn: 'span 1 / span 1', minWidth: 0 };

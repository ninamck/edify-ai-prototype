'use client';

import type { CSSProperties, ReactNode } from 'react';

// Brand-flavoured outlet colours used across the Overview + Flash report.
// Recharts components key by string -> hex/var so we keep these centralised
// to make tweaking the palette a one-line change.
// Assigned strictly in chart-series order (viz-1…viz-6) per the palette
// guidelines; "Other" always takes the stone rollup colour.
export const CC_OUTLET_COLORS: Record<string, string> = {
  Bar: '#001C35',   // viz-1 navy
  Flock: '#4A6CB5', // viz-2 cobalt
  Opa: '#72BBCC',   // viz-3 sky
  Dough: '#0F766E', // viz-4 teal
  Other: '#A89A8E', // viz-6 stone
  Total: '#001C35',
};

// ---------------------------------------------------------------------------
// Number formatting helpers. The spreadsheet renders negatives in parentheses
// (e.g. "(2,627)") and pads currency consistently. We keep that convention
// for the Flash recreation so the visual pattern feels familiar.
// ---------------------------------------------------------------------------

export function formatNumber(value: number | null | undefined, opts: { decimals?: number } = {}): string {
  if (value === null || value === undefined) return '';
  const decimals = opts.decimals ?? 0;
  const abs = Math.abs(value);
  const fixed = abs.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return value < 0 ? `(${fixed})` : fixed;
}

export function formatPounds(value: number | null | undefined, opts: { decimals?: number } = {}): string {
  if (value === null || value === undefined) return '';
  const decimals = opts.decimals ?? 0;
  const abs = Math.abs(value);
  const fixed = abs.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const text = `\u00a3${fixed}`;
  return value < 0 ? `(${text})` : text;
}

export function poundsKShort(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const abs = Math.abs(value);
  const fixed = (abs / 1000).toFixed(1);
  const text = `\u00a3${fixed}k`;
  return value < 0 ? `(${text})` : text;
}

export function formatPct(value: number | null | undefined, opts: { decimals?: number } = {}): string {
  if (value === null || value === undefined) return '';
  const decimals = opts.decimals ?? 1;
  const pct = value * 100;
  const abs = Math.abs(pct);
  const fixed = abs.toFixed(decimals);
  return pct < 0 ? `(${fixed}%)` : `${fixed}%`;
}

export function formatPctSigned(value: number | null | undefined, opts: { decimals?: number } = {}): string {
  if (value === null || value === undefined) return '';
  const decimals = opts.decimals ?? 1;
  const pct = value * 100;
  if (pct >= 0) return `+${pct.toFixed(decimals)}%`;
  return `${pct.toFixed(decimals)}%`;
}

// ---------------------------------------------------------------------------
// Heatmap cell tinting. Diverging green/red palette with intensity scaled by
// the magnitude of the cell relative to the grid's biggest value.
// ---------------------------------------------------------------------------

export function heatmapCellColor(value: number, magnitude: number): string {
  if (!Number.isFinite(value) || magnitude === 0) return 'transparent';
  const ratio = Math.min(1, Math.abs(value) / magnitude);
  // Slight curve so small variances aren't washed out.
  const eased = Math.pow(ratio, 0.6);
  if (value > 0) {
    // green-tinted
    const alpha = 0.08 + 0.45 * eased;
    return `rgba(22, 101, 52, ${alpha.toFixed(3)})`;
  }
  if (value < 0) {
    const alpha = 0.08 + 0.45 * eased;
    return `rgba(176, 16, 56, ${alpha.toFixed(3)})`;
  }
  return 'transparent';
}

// ---------------------------------------------------------------------------
// Reusable card chrome -- mirrors the look used elsewhere in the dashboard
// without having to depend on the EstateDashboard's local ChartCard.
// ---------------------------------------------------------------------------

export function ChartCard({
  title,
  subtitle,
  children,
  height = 220,
  bodyStyle,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: number;
  bodyStyle?: CSSProperties;
}) {
  return (
    <div
      style={{
        padding: '16px 16px 12px',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(0, 28, 53,0.1), 0 0 0 1px rgba(0, 28, 53,0.03)',
        minHeight: 0,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ width: '100%', height, ...bodyStyle }}>{children}</div>
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  rightSlot?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: '16px 18px 14px',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(0, 28, 53,0.07)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                marginTop: 2,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {rightSlot}
      </div>
      <div>{children}</div>
    </div>
  );
}

'use client';

import { TrendingUp, TrendingDown, Clock, Target } from 'lucide-react';
import type { ReactNode } from 'react';

const OK = '#166534';
const WARN = '#B45309';

interface ShiftKpi {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  context?: string;
  icon?: ReactNode;
}

function KpiTile({ label, value, delta, positive, context, icon }: ShiftKpi) {
  const deltaColor = positive === undefined ? 'var(--color-text-secondary)' : positive ? OK : WARN;
  const DeltaIcon = positive === undefined ? null : positive ? TrendingUp : TrendingDown;
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 10,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 8px rgba(58,48,40,0.08), 0 0 0 1px rgba(58,48,40,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        {value}
      </div>
      {(delta || context) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: deltaColor, flexWrap: 'wrap' }}>
          {DeltaIcon && <DeltaIcon size={12} strokeWidth={2.4} />}
          {delta && <span>{delta}</span>}
          {context && <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>· {context}</span>}
        </div>
      )}
    </div>
  );
}

export default function ShiftKpiRow({
  salesSoFar,
  forecastToNow,
  expectedEod,
  fullDayForecast,
  asAt,
}: {
  salesSoFar: number;
  forecastToNow: number;
  expectedEod: number;
  fullDayForecast: number;
  asAt: string;
}) {
  const varianceAbs = salesSoFar - forecastToNow;
  const variancePct = forecastToNow > 0 ? (varianceAbs / forecastToNow) * 100 : 0;
  const varianceAhead = varianceAbs >= 0;
  const eodDelta = expectedEod - fullDayForecast;
  const eodAhead = eodDelta >= 0;

  const accent = 'var(--color-accent-deep)';
  const muted = 'var(--color-text-muted)';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
      }}
    >
      <KpiTile
        label="Sales so far"
        value={`£${salesSoFar.toLocaleString()}`}
        delta={`${varianceAhead ? '+' : ''}£${Math.abs(varianceAbs).toLocaleString()} (${varianceAhead ? '+' : ''}${variancePct.toFixed(1)}%)`}
        positive={varianceAhead}
        context={`as at ${asAt} · vs forecast to now`}
        icon={<Clock size={13} color={muted} strokeWidth={2.2} />}
      />
      <KpiTile
        label="Forecast to now"
        value={`£${forecastToNow.toLocaleString()}`}
        context={`as at ${asAt} · model prediction`}
        icon={<Target size={13} color={muted} strokeWidth={2.2} />}
      />
      <KpiTile
        label="Expected EOD"
        value={`£${expectedEod.toLocaleString()}`}
        delta={`${eodAhead ? '+' : ''}£${Math.abs(eodDelta).toLocaleString()}`}
        positive={eodAhead}
        context="vs full-day forecast"
        icon={<TrendingUp size={13} color={accent} strokeWidth={2.2} />}
      />
      <KpiTile
        label="Full-day forecast"
        value={`£${fullDayForecast.toLocaleString()}`}
        context="baseline target"
        icon={<Target size={13} color={muted} strokeWidth={2.2} />}
      />
    </div>
  );
}

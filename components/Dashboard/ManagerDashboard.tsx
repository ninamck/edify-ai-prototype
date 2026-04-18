'use client';

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  WTD_SPEND,
  currentHourIndexForPhase,
  hourlyTradingForPhase,
  weatherHourlyForPhase,
  deliveriesForPhase,
  wasteForPhase,
} from '@/components/Dashboard/data/managerMockData';
import HourlyCombo from '@/components/Dashboard/parts/HourlyCombo';
import WeatherStrip from '@/components/Dashboard/parts/WeatherStrip';
import DeliveriesCard from '@/components/Dashboard/parts/DeliveriesCard';
import WasteCard from '@/components/Dashboard/parts/WasteCard';
import ShiftKpiRow from '@/components/Dashboard/parts/ShiftKpiRow';
import type { BriefingPhase } from '@/components/briefing';

function ChartCard({
  title,
  subtitle,
  children,
  height = 260,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: number;
}) {
  return (
    <div
      style={{
        padding: '16px 16px 12px',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.03)',
        minHeight: 0,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <div style={{ width: '100%', height }}>{children}</div>
    </div>
  );
}

export default function ManagerDashboard({ phase }: { phase: BriefingPhase }) {
  const hourlyTrading = useMemo(() => hourlyTradingForPhase(phase), [phase]);
  const weatherHourly = useMemo(() => weatherHourlyForPhase(phase), [phase]);
  const deliveries = useMemo(() => deliveriesForPhase(phase), [phase]);
  const waste = useMemo(() => wasteForPhase(phase), [phase]);

  const kpis = useMemo(() => {
    let salesSoFar = 0;
    let forecastToNow = 0;
    let forecastRemaining = 0;
    hourlyTrading.forEach((row) => {
      if (row.actual !== null) {
        salesSoFar += row.actual;
        forecastToNow += row.forecast;
      } else {
        forecastRemaining += row.forecast;
      }
    });
    const pace = forecastToNow > 0 ? salesSoFar / forecastToNow : 1;
    const expectedEod = Math.round(salesSoFar + forecastRemaining * pace);
    const fullDayForecast = Math.round(forecastToNow + forecastRemaining);
    return {
      salesSoFar: Math.round(salesSoFar),
      forecastToNow: Math.round(forecastToNow),
      expectedEod,
      fullDayForecast,
    };
  }, [hourlyTrading]);

  const nowHourLabel = hourlyTrading[currentHourIndexForPhase(phase)]?.hour ?? '11am';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        fontFamily: 'var(--font-primary)',
        maxWidth: 1400,
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Header strip */}
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Fitzroy Espresso <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>· In shift</span>
        </h1>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
          Dummy data · it's {nowHourLabel} · how the day is shaping up so far
        </p>
      </div>

      {/* KPI row */}
      <ShiftKpiRow
        salesSoFar={kpis.salesSoFar}
        forecastToNow={kpis.forecastToNow}
        expectedEod={kpis.expectedEod}
        fullDayForecast={kpis.fullDayForecast}
      />

      {/* Hourly combo */}
      <ChartCard
        title="Sales v staff v forecast · hour by hour"
        subtitle="Bars: actual £ (green = ahead of forecast, amber = behind, grey = not yet). Line: forecast £. Right axis: staff headcount — solid for hours worked, dashed for the rest of the roster."
        height={280}
      >
        <HourlyCombo data={hourlyTrading} />
      </ChartCard>

      {/* Weather */}
      <ChartCard
        title="Weather · now vs forecast"
        subtitle="Today's hourly conditions. Chip shows actual vs what forecast said (+ = warmer than forecast)."
        height={110}
      >
        <WeatherStrip data={weatherHourly} />
      </ChartCard>

      {/* Waste */}
      <WasteCard rows={waste} />

      {/* Deliveries */}
      <DeliveriesCard drops={deliveries} wtd={WTD_SPEND} />
    </div>
  );
}

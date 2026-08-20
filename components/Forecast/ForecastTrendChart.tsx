'use client';

/**
 * ForecastTrendChart — a small "how have we been tracking?" chart that
 * spans the recent past plus (on the Forecast tab) a few days ahead.
 *
 * Three switchable metrics — revenue ($), items, transactions — share
 * the same time axis so the operator can flip between them without
 * losing their place. The line + dots layout is more glanceable than
 * stacked bars when the audience is a manager standing at the bench
 * (the same context the page is designed for).
 *
 * Past days plot both forecast (muted) and actual (accent). Future
 * days plot forecast only and are visually softened with a dashed line
 * + reduced opacity so the operator immediately reads them as
 * "expected, not yet measured".
 *
 * The today line is highlighted with a vertical separator.
 */

import { useMemo, useState } from 'react';
import { dayOfWeek, DEMO_TODAY, dayOffset, type SiteId } from '@/components/Production/fixtures';
import {
  actualTotalsFor,
  compareDay,
  forwardTotalsFor,
  formatCount,
  formatCurrency,
} from './economics';
import type { TotalMultipliers } from './TotalEditor';
import { multiplierFor } from './TotalEditor';

type Metric = 'revenue' | 'items' | 'transactions';

const METRIC_LABEL: Record<Metric, string> = {
  revenue: 'Revenue',
  items: 'Items',
  transactions: 'Transactions',
};

type Props = {
  siteId: SiteId;
  /** Days into the past that will plot forecast + actual. Default 7. */
  pastDays?: number;
  /**
   * Days into the future that will plot forecast only. Pass 0 to hide
   * the future region — the Result tab uses this.
   */
  futureDays?: number;
  /** Date currently highlighted in the rest of the page. */
  highlightDate?: string;
  /** Operator overrides — applied to the forecast line. */
  multipliers: TotalMultipliers;
};

type Point = {
  date: string;
  label: string;
  isPast: boolean;
  isToday: boolean;
  forecast: { revenue: number; items: number; transactions: number };
  actual: { revenue: number; items: number; transactions: number } | null;
};

export default function ForecastTrendChart({
  siteId,
  pastDays = 7,
  futureDays = 3,
  highlightDate,
  multipliers,
}: Props) {
  const [metric, setMetric] = useState<Metric>('revenue');

  const points = useMemo<Point[]>(() => {
    const out: Point[] = [];
    // Past (incl. today, which is partial on its own card but plotted
    // full-day-forecast here so the line is continuous).
    for (let i = pastDays; i >= 1; i--) {
      const date = dayOffset(-i, DEMO_TODAY);
      const fc = forwardTotalsFor(siteId, date);
      const ac = actualTotalsFor(siteId, date);
      const mult = multiplierFor(multipliers, date);
      out.push({
        date,
        label: dayOfWeek(date),
        isPast: true,
        isToday: false,
        forecast: {
          revenue: fc.revenue * mult,
          items: fc.items * mult,
          transactions: fc.transactions * mult,
        },
        actual: {
          revenue: ac.revenue,
          items: ac.items,
          transactions: ac.transactions,
        },
      });
    }
    // Today — partial actual, full-day forecast.
    const todayCmp = compareDay(siteId, DEMO_TODAY);
    const todayMult = multiplierFor(multipliers, DEMO_TODAY);
    out.push({
      date: DEMO_TODAY,
      label: 'Today',
      isPast: false,
      isToday: true,
      forecast: {
        revenue: todayCmp.fullDayForecast.revenue * todayMult,
        items: todayCmp.fullDayForecast.items * todayMult,
        transactions: todayCmp.fullDayForecast.transactions * todayMult,
      },
      // Today's "actual" point uses sold-so-far. We render it as a
      // partial dot (open style) so the operator doesn't mis-read a
      // half-day as a forecast miss.
      actual: {
        revenue: todayCmp.soFar.actual.revenue,
        items: todayCmp.soFar.actual.items,
        transactions: todayCmp.soFar.actual.transactions,
      },
    });
    // Future days — forecast only.
    for (let i = 1; i <= futureDays; i++) {
      const date = dayOffset(i, DEMO_TODAY);
      const fc = forwardTotalsFor(siteId, date);
      const mult = multiplierFor(multipliers, date);
      out.push({
        date,
        label: dayOfWeek(date),
        isPast: false,
        isToday: false,
        forecast: {
          revenue: fc.revenue * mult,
          items: fc.items * mult,
          transactions: fc.transactions * mult,
        },
        actual: null,
      });
    }
    return out;
  }, [siteId, pastDays, futureDays, multipliers]);

  // ───── Geometry ────────────────────────────────────────────────────────
  const width = 720;
  const height = 200;
  const padding = { top: 18, right: 18, bottom: 24, left: 56 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxY = useMemo(() => {
    let m = 0;
    for (const p of points) {
      m = Math.max(m, p.forecast[metric]);
      if (p.actual) m = Math.max(m, p.actual[metric]);
    }
    return m === 0 ? 1 : m * 1.15;
  }, [points, metric]);

  const xFor = (i: number) =>
    points.length === 1
      ? padding.left + innerW / 2
      : padding.left + (i / (points.length - 1)) * innerW;
  const yFor = (v: number) => padding.top + innerH - (v / maxY) * innerH;

  // Build path strings: forecast for all points, actual only for points
  // that have a value (today's actual = sold-so-far is included).
  const forecastPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.forecast[metric])}`)
    .join(' ');

  // Actual path splits at the gap from today → future, so the line
  // doesn't visually run through the unobserved future.
  const actualSegments: string[] = [];
  let current: string[] = [];
  points.forEach((p, i) => {
    if (p.actual) {
      const cmd = current.length === 0 ? 'M' : 'L';
      current.push(`${cmd} ${xFor(i)} ${yFor(p.actual[metric])}`);
    } else if (current.length > 0) {
      actualSegments.push(current.join(' '));
      current = [];
    }
  });
  if (current.length > 0) actualSegments.push(current.join(' '));

  // Y-axis ticks — 4 levels.
  const yTicks = useMemo(() => {
    const arr = [0, maxY * 0.25, maxY * 0.5, maxY * 0.75, maxY];
    return arr.map(v => ({ v, y: yFor(v) }));
  }, [maxY]);

  const format = metric === 'revenue' ? formatCurrency : formatCount;

  // Highlight today (or a manually-picked highlight date).
  const highlightIdx = points.findIndex(p =>
    highlightDate ? p.date === highlightDate : p.isToday,
  );

  return (
    <section
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 14,
        padding: '14px 18px 18px',
        fontFamily: 'var(--font-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
          }}
        >
          Forecast vs actual · last {pastDays} days
          {futureDays > 0 && ` + next ${futureDays}`}
        </h2>
        <MetricTabs value={metric} onChange={setMetric} />
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 12,
            color: 'var(--color-text-secondary)',
          }}
        >
          <LegendDot color="var(--color-text-muted)" label="Forecast" dashed />
          <LegendDot color="var(--color-accent-active)" label="Actual" />
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={`Forecast vs actual ${METRIC_LABEL[metric]} over the last ${pastDays} days`}
          style={{ display: 'block', minWidth: 520 }}
        >
          {/* Grid lines + y-axis labels */}
          {yTicks.map((t, idx) => (
            <g key={idx}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={t.y}
                y2={t.y}
                stroke="var(--color-border-subtle)"
                strokeWidth={1}
                strokeDasharray={idx === 0 ? '0' : '2 4'}
              />
              <text
                x={padding.left - 8}
                y={t.y + 3}
                textAnchor="end"
                fontSize={11}
                fontFamily="var(--font-primary)"
                fill="var(--color-text-muted)"
              >
                {format(Math.round(t.v))}
              </text>
            </g>
          ))}

          {/* Vertical "today" separator */}
          {highlightIdx >= 0 && (
            <line
              x1={xFor(highlightIdx)}
              x2={xFor(highlightIdx)}
              y1={padding.top}
              y2={padding.top + innerH}
              stroke="var(--color-accent-active)"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.35}
            />
          )}

          {/* Future-region soft shade — only when we plot future days */}
          {(() => {
            const firstFuture = points.findIndex(p => !p.isPast && !p.isToday);
            if (firstFuture < 0) return null;
            const startX = xFor(firstFuture) - (xFor(firstFuture) - xFor(firstFuture - 1)) / 2;
            const endX = width - padding.right;
            return (
              <rect
                x={startX}
                y={padding.top}
                width={Math.max(0, endX - startX)}
                height={innerH}
                fill="var(--color-bg-hover)"
                opacity={0.5}
              />
            );
          })()}

          {/* Forecast line — dashed in the future region */}
          <path
            d={forecastPath}
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Actual segments */}
          {actualSegments.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="var(--color-accent-active)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* Forecast dots */}
          {points.map((p, i) => (
            <circle
              key={`f-${p.date}`}
              cx={xFor(i)}
              cy={yFor(p.forecast[metric])}
              r={3}
              fill="#ffffff"
              stroke="var(--color-text-muted)"
              strokeWidth={1.5}
              opacity={p.isPast || p.isToday ? 1 : 0.85}
            />
          ))}

          {/* Actual dots — solid for closed days, open ring for today (partial) */}
          {points.map((p, i) =>
            p.actual ? (
              <circle
                key={`a-${p.date}`}
                cx={xFor(i)}
                cy={yFor(p.actual[metric])}
                r={p.isToday ? 4 : 3.5}
                fill={p.isToday ? '#ffffff' : 'var(--color-accent-active)'}
                stroke="var(--color-accent-active)"
                strokeWidth={2}
              />
            ) : null,
          )}

          {/* Hover capture rects (one per point) */}
          {points.map((p, i) => {
            const x = xFor(i);
            const halfGap =
              points.length > 1
                ? (xFor(1) - xFor(0)) / 2
                : innerW / 2;
            return (
              <rect
                key={`hit-${p.date}`}
                x={x - halfGap}
                y={padding.top}
                width={halfGap * 2}
                height={innerH}
                fill="transparent"
              >
                <title>{buildHoverText(p, metric, format)}</title>
              </rect>
            );
          })}

          {/* X-axis labels */}
          {points.map((p, i) => (
            <text
              key={`xl-${p.date}`}
              x={xFor(i)}
              y={height - 6}
              textAnchor="middle"
              fontSize={11}
              fontFamily="var(--font-primary)"
              fontWeight={p.isToday ? 700 : 500}
              fill={
                p.isToday
                  ? 'var(--color-accent-active)'
                  : p.isPast
                    ? 'var(--color-text-secondary)'
                    : 'var(--color-text-muted)'
              }
            >
              {p.label}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}

function buildHoverText(
  p: Point,
  metric: Metric,
  format: (n: number) => string,
): string {
  const lines: string[] = [`${p.label} (${p.date})`];
  lines.push(`Forecast: ${format(Math.round(p.forecast[metric]))}`);
  if (p.actual) {
    const a = p.actual[metric];
    const f = p.forecast[metric];
    const dPct = f > 0 ? ((a - f) / f) * 100 : 0;
    const sign = dPct > 0 ? '+' : '';
    const tag = p.isToday ? ' (so far)' : '';
    lines.push(
      `Actual${tag}: ${format(Math.round(a))} (${sign}${Math.round(dPct)}%)`,
    );
  } else {
    lines.push('Actual: not yet');
  }
  return lines.join('\n');
}

// Pill switcher — matches the platform tab style (BacktestStrip sort,
// HorizonGrid category filter, Plan view, etc.). Slightly tighter
// padding than the page-level Tabs since this lives inside a card.
function MetricTabs({
  value,
  onChange,
}: {
  value: Metric;
  onChange: (m: Metric) => void;
}) {
  const opts: Metric[] = ['revenue', 'items', 'transactions'];
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        background: 'var(--color-bg-hover)',
        borderRadius: 100,
        padding: 3,
        width: 'fit-content',
      }}
    >
      {opts.map(o => {
        const active = o === value;
        return (
          <button
            key={o}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o)}
            style={{
              padding: '5px 12px',
              border: 'none',
              borderRadius: 100,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              background: active ? 'var(--color-accent-active)' : 'transparent',
              color: active ? '#ffffff' : 'var(--color-text-secondary)',
              transition: 'background 0.15s, color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {METRIC_LABEL[o]}
          </button>
        );
      })}
    </div>
  );
}

function LegendDot({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <svg width={20} height={10} aria-hidden="true">
        <line
          x1={0}
          x2={20}
          y1={5}
          y2={5}
          stroke={color}
          strokeWidth={2}
          strokeDasharray={dashed ? '3 3' : undefined}
        />
        <circle cx={10} cy={5} r={2.5} fill="#ffffff" stroke={color} strokeWidth={1.5} />
      </svg>
      <span>{label}</span>
    </span>
  );
}

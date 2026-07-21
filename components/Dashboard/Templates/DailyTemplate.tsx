'use client';

/**
 * Daily template — "What needs my attention today?"
 *
 * GM / site manager, yesterday's trade, exceptions-first. Theoretical
 * figures only — no actual GP claims (those need a stocktake and belong
 * to the period-end view). Five tiles, no more.
 */

import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, ChevronRight, Sparkles, Trash2 } from 'lucide-react';
import {
  DAILY_ANOMALIES,
  DAILY_DATE_LABEL,
  DAILY_EXCEPTIONS,
  DAILY_SALES_14D,
  DAILY_SITE,
  DAILY_THEO_GP,
  DAILY_WASTE,
  DAILY_WASTE_ITEMS,
  DAILY_YESTERDAY,
  type DailyWasteItem,
} from './templateData';
import {
  DeltaText,
  FigureBadge,
  Grid,
  HALF,
  MID,
  NAVY,
  OK_TEXT,
  TileCard,
  VALUE_INK,
  WARN_TEXT,
  tipStyle,
} from './templateParts';

const vsForecastPct =
  ((DAILY_YESTERDAY.sales - DAILY_YESTERDAY.forecast) / DAILY_YESTERDAY.forecast) * 100;
const vsLastWeekPct =
  ((DAILY_YESTERDAY.sales - DAILY_YESTERDAY.sameDayLastWeek) / DAILY_YESTERDAY.sameDayLastWeek) * 100;

export default function DailyTemplate() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      <TemplateIntro title={`${DAILY_SITE} · yesterday (${DAILY_DATE_LABEL})`} />

      <Grid>
        {/* 1 · Sales anchor — one number, one sparkline */}
        <div style={HALF}>
          <TileCard
            title="Sales · yesterday">
            <div style={{ padding: '0 16px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: VALUE_INK }}>
                  £{DAILY_YESTERDAY.sales.toLocaleString('en-GB')}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                  <DeltaText pct={vsForecastPct} />{' '}
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>vs forecast</span>
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                  <DeltaText pct={vsLastWeekPct} />{' '}
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>vs same day LW</span>
                </span>
              </div>
              <div style={{ width: '100%', height: 88, marginTop: 10 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={DAILY_SALES_14D} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dailySpark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={MID} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={MID} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="d" hide />
                    <Tooltip
                      contentStyle={tipStyle}
                      formatter={(v) => `£${Number(v ?? 0).toLocaleString('en-GB')}`}
                    />
                    <Area dataKey="sales" name="Sales" stroke={NAVY} strokeWidth={2} fill="url(#dailySpark)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TileCard>
        </div>

        {/* 2 · Theoretical GP% flash */}
        <div style={HALF}>
          <TileCard
            title="GP% flash · yesterday"
            badge={<FigureBadge kind="theoretical" />}
            footer={`${DAILY_THEO_GP.posMappedPct}% of yesterday's POS sales are recipe-mapped. Unmapped items are excluded, not guessed.`}
          >
            <div style={{ padding: '0 16px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: VALUE_INK }}>
                  {DAILY_THEO_GP.pct.toFixed(1)}%
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                  <DeltaText pct={DAILY_THEO_GP.vsLastWeekPp} suffix="pp" />{' '}
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>vs same day LW</span>
                </span>
              </div>
            </div>
          </TileCard>
        </div>

        {/* 3 · Waste logged yesterday — Waste watch style, as built in the product */}
        <div style={HALF}>
          <DailyWasteWatch />
        </div>

        {/* 4 · Exceptions queue */}
        <div style={HALF}>
          <TileCard
            title="Exceptions queue">
            <div style={{ padding: '0 8px 10px', display: 'flex', flexDirection: 'column' }}>
              {DAILY_EXCEPTIONS.map((ex) => (
                <Link
                  key={ex.label}
                  href={ex.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 8px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <span
                    style={{
                      minWidth: 26,
                      height: 26,
                      borderRadius: 8,
                      background: ex.count > 0 ? '#FFF1F2' : '#EBF7F0',
                      border: `1px solid ${ex.count > 0 ? '#F3B8C4' : '#A9D9BE'}`,
                      color: ex.count > 0 ? WARN_TEXT : OK_TEXT,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12.5,
                      fontWeight: 700,
                    }}
                  >
                    {ex.count}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>{ex.label}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-text-muted)' }}>{ex.detail}</span>
                  </span>
                  <ChevronRight size={14} color="var(--color-text-muted)" />
                </Link>
              ))}
            </div>
          </TileCard>
        </div>

        {/* 5 · Anomaly flags — the AI layer's slot */}
        <div style={{ gridColumn: 'span 2 / span 2', minWidth: 0 }}>
          <TileCard
            title="Anomaly flags"
            badge={<FigureBadge kind="ai" />}>
            <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
              {DAILY_ANOMALIES.map((a) => (
                <div
                  key={a.headline}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--color-border-subtle)',
                    background: '#FBFBFD',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <Sparkles size={14} color={VALUE_INK} strokeWidth={2.2} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                      {a.headline}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
                      {a.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TileCard>
        </div>
      </Grid>
    </div>
  );
}

// ─── Waste watch (yesterday) — mirrors the product's WasteCard ───────────────

type WasteSeverity = 'ok' | 'watch' | 'flag';

function wasteSeverity(row: DailyWasteItem): WasteSeverity {
  if (row.spendTypical === 0) return row.spendYesterday > 0 ? 'flag' : 'ok';
  const ratio = row.spendYesterday / row.spendTypical;
  if (ratio >= 1.5) return 'flag';
  if (ratio > 1.0) return 'watch';
  return 'ok';
}

function wasteColour(sev: WasteSeverity): string {
  if (sev === 'flag') return '#B45309';
  if (sev === 'watch') return 'var(--color-accent-mid)';
  return OK_TEXT;
}

function DailyWasteWatch() {
  const totalYesterday = DAILY_WASTE_ITEMS.reduce((s, r) => s + r.spendYesterday, 0);
  const totalTypical = DAILY_WASTE_ITEMS.reduce((s, r) => s + r.spendTypical, 0);
  const delta = totalYesterday - totalTypical;
  const deltaPct = totalTypical > 0 ? Math.round((delta / totalTypical) * 100) : 0;
  const overall: WasteSeverity = delta <= 0 ? 'ok' : deltaPct >= 50 ? 'flag' : 'watch';

  const chartData = [...DAILY_WASTE_ITEMS]
    .sort((a, b) => b.spendYesterday - a.spendYesterday)
    .map((r) => ({
      product: r.product,
      yesterday: r.spendYesterday,
      typical: r.spendTypical,
      sev: wasteSeverity(r),
    }));

  const flagged = DAILY_WASTE_ITEMS.filter((r) => r.flag && wasteSeverity(r) === 'flag');

  return (
    <div
      style={{
        padding: '16px 16px 14px',
        borderRadius: '12px 0 12px 12px',
        border: `1px solid ${NAVY}`,
        background: '#fff',
        boxShadow: '0 2px 12px rgba(0, 28, 53,0.1), 0 0 0 1px rgba(0, 28, 53,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        height: '100%',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'var(--color-bg-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Trash2 size={16} color="var(--color-accent-deep)" strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>Waste logged · yesterday</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
            {DAILY_WASTE.pctOfSales.toFixed(1)}% of sales · target ≤ {DAILY_WASTE.targetPct.toFixed(1)}%
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 100,
            background:
              overall === 'flag'
                ? 'rgba(180,83,9,0.12)'
                : overall === 'watch'
                  ? 'rgba(0, 28, 53,0.06)'
                  : 'rgba(22,101,52,0.12)',
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: overall === 'flag' ? '#B45309' : overall === 'ok' ? OK_TEXT : 'var(--color-text-primary)',
            }}
          >
            £{totalYesterday}
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
            vs £{totalTypical} typical {delta === 0 ? '' : `(${delta > 0 ? '+' : ''}${deltaPct}%)`}
          </span>
        </div>
      </div>

      {/* Chart — yesterday £ per item vs typical, coloured by severity */}
      <div style={{ width: '100%', height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            barCategoryGap={6}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(0, 28, 53,0.15)' }}
              tickFormatter={(v) => `£${v}`}
            />
            <YAxis
              type="category"
              dataKey="product"
              tick={{ fontSize: 11, fill: 'var(--color-text-primary)' }}
              tickLine={false}
              axisLine={false}
              width={130}
            />
            <Tooltip
              contentStyle={tipStyle}
              formatter={(value, name) => [`£${value}`, String(name) === 'yesterday' ? 'Yesterday' : 'Typical']}
            />
            <Bar dataKey="typical" name="typical" fill="rgba(0, 28, 53,0.12)" radius={[3, 3, 3, 3]} maxBarSize={10} />
            <Bar dataKey="yesterday" name="yesterday" radius={[3, 3, 3, 3]} maxBarSize={10}>
              {chartData.map((d) => (
                <Cell key={d.product} fill={wasteColour(d.sev)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Flagged list */}
      {flagged.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              marginBottom: 8,
            }}
          >
            Flagged
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {flagged.map((r) => (
              <div
                key={r.product}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(180,83,9,0.06)',
                  border: '1px solid rgba(180,83,9,0.25)',
                }}
              >
                <AlertTriangle size={14} color="#B45309" strokeWidth={2.2} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {r.product}
                    <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>
                      {' '}· {r.unitsYesterday} wasted (typical {r.unitsTypical})
                    </span>
                  </div>
                  {r.flag && (
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                      {r.flag}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#B45309', textAlign: 'right', minWidth: 40 }}>
                  £{r.spendYesterday}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Shared header strip for template views: context line + optional guidance note. */
export function TemplateIntro({ title, note }: { title: string; note?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</span>
      {note && <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', maxWidth: 640 }}>{note}</span>}
    </div>
  );
}

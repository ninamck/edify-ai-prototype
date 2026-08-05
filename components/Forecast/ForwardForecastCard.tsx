'use client';

/**
 * ForwardForecastCard — the "this is what is forecasted, and why" hero.
 *
 * Operators don't scroll 100 SKUs. They read three numbers (currency,
 * items, transactions), one sentence of explanation, and an at-a-glance
 * phase + channel breakdown. SKU-level detail lives behind the "View by
 * menu item" disclosure further down the page.
 *
 * Three KPI tiles → why sentence → phase bars → channel mix.
 * The component is deterministic on its inputs; all numbers come from
 * `economics.ts`.
 */

import { useMemo } from 'react';
import { Cloud, ShoppingBag, Coins, Users, Info, Clock, Bike, CalendarDays, TrendingUp, SlidersHorizontal } from 'lucide-react';
import type { SiteId } from '@/components/Production/fixtures';
import { dayOfWeek } from '@/components/Production/fixtures';
import {
  aggregateForwardSignals,
  channelMixFor,
  CHANNEL_LABEL,
  forwardTotalsFor,
  formatCount,
  formatCurrency,
  narrateForwardWhy,
  PHASE_LABEL,
  SIGNAL_LABEL,
  type AggregatedSignal,
  type ChannelSplit,
  type DayTotals,
  type Phase,
} from './economics';
import EditableKpiTile, {
  multiplierForNewValue,
  parseCountInput,
  parseCurrencyInput,
} from './TotalEditor';

type Props = {
  siteId: SiteId;
  date: string;
  /** Calendar label rendered above the KPIs ("Today · Thu 23 Apr"). */
  dateLabel: string;
  /** Operator-applied total-level multiplier (1.0 = Quinn's baseline). */
  multiplier: number;
  /** Update the multiplier from a new target value on one of the tiles. */
  onMultiplierChange: (multiplier: number | null) => void;
};

export default function ForwardForecastCard({
  siteId,
  date,
  dateLabel,
  multiplier,
  onMultiplierChange,
}: Props) {
  const baseline = useMemo(() => forwardTotalsFor(siteId, date), [siteId, date]);
  const totals = useMemo(() => scaleTotals(baseline, multiplier), [baseline, multiplier]);
  const why = useMemo(() => narrateForwardWhy(siteId, date), [siteId, date]);
  const signals = useMemo(() => aggregateForwardSignals(siteId, date), [siteId, date]);
  const mix = useMemo(() => channelMixFor(siteId, date), [siteId, date]);
  const isOverridden = Math.abs(multiplier - 1) > 0.005;
  const insights = useMemo(
    () => buildForwardInsights({ totals, signals, mix, date, isOverridden, multiplier }),
    [totals, signals, mix, date, isOverridden, multiplier],
  );

  const phases: Phase[] = ['morning', 'midday', 'afternoon'];
  const maxPhaseRevenue = Math.max(
    totals.byPhase.morning.revenue,
    totals.byPhase.midday.revenue,
    totals.byPhase.afternoon.revenue,
    1,
  );

  return (
    <section
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 14,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          What's forecasted
        </h2>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          {dateLabel} · {dayOfWeek(date)}
        </span>
      </div>

      {/* KPI trio — click any tile to override the whole-day forecast. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        <EditableKpiTile
          icon={<Coins size={15} />}
          label="Revenue forecast"
          value={totals.revenue}
          display={formatCurrency(totals.revenue)}
          baseline={baseline.revenue}
          isOverridden={isOverridden}
          multiplier={multiplier}
          parse={parseCurrencyInput}
          onCommit={v =>
            onMultiplierChange(
              v == null ? null : multiplierForNewValue(baseline.revenue, v),
            )
          }
        />
        <EditableKpiTile
          icon={<ShoppingBag size={15} />}
          label="Items forecast"
          value={totals.items}
          display={formatCount(totals.items)}
          baseline={baseline.items}
          isOverridden={isOverridden}
          multiplier={multiplier}
          parse={parseCountInput}
          onCommit={v =>
            onMultiplierChange(
              v == null ? null : multiplierForNewValue(baseline.items, v),
            )
          }
        />
        <EditableKpiTile
          icon={<Users size={15} />}
          label="Transaction forecast"
          value={totals.transactions}
          display={formatCount(totals.transactions)}
          baseline={baseline.transactions}
          isOverridden={isOverridden}
          multiplier={multiplier}
          parse={parseCountInput}
          onCommit={v =>
            onMultiplierChange(
              v == null ? null : multiplierForNewValue(baseline.transactions, v),
            )
          }
        />
      </div>

      {/* Why sentence */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '10px 12px',
          background: 'var(--color-bg-hover)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 10,
        }}
      >
        <Info size={15} color="var(--color-text-secondary)" style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              lineHeight: 1.5,
              color: 'var(--color-text-primary)',
            }}
          >
            {why}
          </p>
          {signals.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {signals.map(s => (
                <span
                  key={s.signal}
                  title={s.note}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    background: '#ffffff',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 999,
                    fontSize: 11.5,
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {signalIcon(s.signal)}
                  <span>{SIGNAL_LABEL[s.signal]}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(s.share * 100)}%
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edify insights — turns the forecast signals into a few concrete,
          act-on-it callouts for the day. */}
      {insights.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={subheading}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <EdifyMark size={13} color="var(--color-accent-active)" /> Edify insights
            </span>
          </h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {insights.map(ins => {
              const tone = INSIGHT_TONE[ins.tone];
              return (
                <div
                  key={ins.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    background: 'var(--color-bg-hover)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 10,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      background: tone.bg,
                      color: tone.fg,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {ins.icon}
                  </span>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-text-primary)' }}>
                    <strong style={{ fontWeight: 700 }}>{ins.lead}.</strong>{' '}
                    <span style={{ color: 'var(--color-text-secondary)' }}>{ins.body}</span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Phase split */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 style={subheading}>Within the day</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}
        >
          {phases.map(p => {
            const ph = totals.byPhase[p];
            const heightPct = (ph.revenue / maxPhaseRevenue) * 100;
            return (
              <div
                key={p}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: 12,
                  background: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {PHASE_LABEL[p]}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {phaseHours(p)}
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: 'var(--color-border-subtle)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${heightPct}%`,
                      background: 'var(--color-accent-active)',
                      borderRadius: 999,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <PhaseLine label="Revenue" value={formatCurrency(ph.revenue)} />
                  <PhaseLine label="Items" value={formatCount(ph.items)} />
                  <PhaseLine label="Trans." value={formatCount(ph.transactions)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Channel mix */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 style={subheading}>By order type</h3>
        <div
          style={{
            display: 'flex',
            height: 10,
            borderRadius: 999,
            overflow: 'hidden',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <span style={{ flex: mix.takeaway, background: 'var(--color-accent-active)' }} />
          <span style={{ flex: mix.eatIn, background: 'var(--color-info)' }} />
          <span style={{ flex: mix.delivery, background: 'var(--color-success)' }} />
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <ChannelLegend
            color="var(--color-accent-active)"
            label={CHANNEL_LABEL.takeaway}
            pct={mix.takeaway}
            revenue={totals.revenue * mix.takeaway}
            items={totals.items * mix.takeaway}
            transactions={totals.transactions * mix.takeaway}
          />
          <ChannelLegend
            color="var(--color-info)"
            label={CHANNEL_LABEL.eatIn}
            pct={mix.eatIn}
            revenue={totals.revenue * mix.eatIn}
            items={totals.items * mix.eatIn}
            transactions={totals.transactions * mix.eatIn}
          />
          <ChannelLegend
            color="var(--color-success)"
            label={CHANNEL_LABEL.delivery}
            pct={mix.delivery}
            revenue={totals.revenue * mix.delivery}
            items={totals.items * mix.delivery}
            transactions={totals.transactions * mix.delivery}
          />
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Small inline pieces
// ────────────────────────────────────────────────────────────────────────────

/**
 * Scale a `DayTotals` by a multiplier. The phase tiles + channel mix
 * are derived from these scaled numbers so a 10% bump on the total
 * shows up everywhere on the card consistently.
 */
function scaleTotals(t: DayTotals, m: number): DayTotals {
  if (Math.abs(m - 1) < 1e-4) return t;
  const sc = (v: number) => Math.round(v * m);
  return {
    ...t,
    revenue: sc(t.revenue),
    items: sc(t.items),
    transactions: sc(t.transactions),
    byPhase: {
      morning: {
        revenue: sc(t.byPhase.morning.revenue),
        items: sc(t.byPhase.morning.items),
        transactions: sc(t.byPhase.morning.transactions),
      },
      midday: {
        revenue: sc(t.byPhase.midday.revenue),
        items: sc(t.byPhase.midday.items),
        transactions: sc(t.byPhase.midday.transactions),
      },
      afternoon: {
        revenue: sc(t.byPhase.afternoon.revenue),
        items: sc(t.byPhase.afternoon.items),
        transactions: sc(t.byPhase.afternoon.transactions),
      },
    },
  };
}

function PhaseLine({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontSize: 12.5,
      }}
    >
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span
        style={{
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ChannelLegend({
  color,
  label,
  pct,
  revenue,
  items,
  transactions,
}: {
  color: string;
  label: string;
  pct: number;
  revenue: number;
  items: number;
  transactions: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 130 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, background: color, borderRadius: 999 }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {label}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(pct * 100)}%
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          fontVariantNumeric: 'tabular-nums',
          paddingLeft: 14,
        }}
      >
        {formatCurrency(Math.round(revenue))} · {formatCount(Math.round(items))} items ·{' '}
        {formatCount(Math.round(transactions))} trans
      </div>
    </div>
  );
}

function signalIcon(signal: string) {
  if (signal === 'weather') return <Cloud size={12} />;
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Edify insights — derive a few act-on-it callouts from the day's forecast
// ────────────────────────────────────────────────────────────────────────────

type InsightTone = 'accent' | 'success' | 'warning' | 'info';
type Insight = { id: string; tone: InsightTone; icon: React.ReactNode; lead: string; body: string };

const INSIGHT_TONE: Record<InsightTone, { fg: string; bg: string }> = {
  accent: { fg: 'var(--color-accent-active)', bg: 'rgba(0, 28, 53, 0.06)' },
  success: { fg: 'var(--color-success)', bg: 'rgba(31, 157, 87, 0.10)' },
  warning: { fg: 'var(--color-warning)', bg: 'rgba(241, 180, 52, 0.16)' },
  info: { fg: 'var(--color-info)', bg: 'rgba(25, 20, 132, 0.10)' },
};

/** Turn the forecast totals + signals + channel mix into 3–4 concrete nudges. */
function buildForwardInsights(p: {
  totals: DayTotals;
  signals: AggregatedSignal[];
  mix: ChannelSplit;
  date: string;
  isOverridden: boolean;
  multiplier: number;
}): Insight[] {
  const { totals, signals, mix, date, isOverridden, multiplier } = p;
  const dow = dayOfWeek(date);
  const out: Insight[] = [];

  // Manual override — call it out first so it's never a surprise.
  if (isOverridden) {
    const pct = Math.round((multiplier - 1) * 100);
    out.push({
      id: 'override',
      tone: 'warning',
      icon: <SlidersHorizontal size={14} />,
      lead: 'Manual override on',
      body: `You've set today ${pct > 0 ? '+' : ''}${pct}% vs Edify's baseline — drops will still be paced to this total.`,
    });
  }

  // Peak phase — where the day concentrates.
  const phaseList: Phase[] = ['morning', 'midday', 'afternoon'];
  const peak = phaseList.reduce((a, b) => (totals.byPhase[b].revenue > totals.byPhase[a].revenue ? b : a));
  const peakPct = Math.round((totals.byPhase[peak].revenue / Math.max(1, totals.revenue)) * 100);
  out.push({
    id: 'peak',
    tone: 'accent',
    icon: <Clock size={14} />,
    lead: `${PHASE_LABEL[peak]} is the peak`,
    body: `${peakPct}% of the day's revenue (${formatCurrency(totals.byPhase[peak].revenue)}) lands ${phaseHours(peak)} — have the cabinet full before it hits.`,
  });

  // Channel — flag delivery when it's a real share, else speed-of-service.
  const deliveryPct = Math.round(mix.delivery * 100);
  if (deliveryPct >= 18) {
    out.push({
      id: 'delivery',
      tone: 'success',
      icon: <Bike size={14} />,
      lead: 'Home delivery runs hot',
      body: `~${deliveryPct}% of orders come through delivery apps today — keep the dispatch lane clear and expect stacked app orders at lunch.`,
    });
  } else {
    const takeawayPct = Math.round(mix.takeaway * 100);
    out.push({
      id: 'channel',
      tone: 'success',
      icon: <Bike size={14} />,
      lead: 'Counter & drive-thru lead',
      body: `${takeawayPct}% of orders are takeaway — front-of-line throughput is what protects speed-of-service today.`,
    });
  }

  // Top non-baseline signal — the thing that makes today different.
  const topSig = signals.find(s => s.signal !== 'sales-history');
  if (topSig && topSig.share >= 0.1) {
    const sigPct = Math.round(topSig.share * 100);
    out.push({
      id: 'signal',
      tone: 'warning',
      icon: topSig.signal === 'weather' ? <Cloud size={14} /> : <CalendarDays size={14} />,
      lead: `${topSig.label} in play`,
      body: `${topSig.note ?? topSig.label} is adding ~${sigPct}% on top of the usual ${dow} — cook ahead on the busy lines so you don't miss sales.`,
    });
  } else {
    const topPct = Math.round((signals[0]?.share ?? 1) * 100);
    out.push({
      id: 'confidence',
      tone: 'info',
      icon: <TrendingUp size={14} />,
      lead: `Stable read for ${dow}`,
      body: `Anchored to your ${topPct}% sales-history pattern — a predictable day with low surprise risk.`,
    });
  }

  return out.slice(0, 4);
}

/** The Edify logo mark, tinted via CSS mask (same asset the sidebar uses). */
function EdifyMark({ size, color }: { size: number; color: string }) {
  return (
    <span
      role="img"
      aria-label="Edify"
      style={{
        display: 'block',
        width: Math.round(size * 0.58),
        height: size,
        backgroundColor: color,
        WebkitMaskImage: 'url(/edify-logo.svg)',
        maskImage: 'url(/edify-logo.svg)',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  );
}

function phaseHours(p: Phase): string {
  if (p === 'morning') return '06\u201311';
  if (p === 'midday') return '11\u201315';
  return '15\u201319';
}

const subheading: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-text-secondary)',
};

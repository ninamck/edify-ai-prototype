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
import { Cloud, ShoppingBag, Coins, Users, Info } from 'lucide-react';
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
  type Phase,
} from './economics';

type Props = {
  siteId: SiteId;
  date: string;
  /** Calendar label rendered above the KPIs ("Today · Thu 23 Apr"). */
  dateLabel: string;
};

export default function ForwardForecastCard({ siteId, date, dateLabel }: Props) {
  const totals = useMemo(() => forwardTotalsFor(siteId, date), [siteId, date]);
  const why = useMemo(() => narrateForwardWhy(siteId, date), [siteId, date]);
  const signals = useMemo(() => aggregateForwardSignals(siteId, date), [siteId, date]);
  const mix = useMemo(() => channelMixFor(siteId, date), [siteId, date]);

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
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          What's forecasted
        </h2>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {dateLabel} · {dayOfWeek(date)}
        </span>
      </div>

      {/* KPI trio */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        <KpiTile
          icon={<Coins size={14} />}
          label="Revenue forecast"
          value={formatCurrency(totals.revenue)}
        />
        <KpiTile
          icon={<ShoppingBag size={14} />}
          label="Items forecast"
          value={formatCount(totals.items)}
        />
        <KpiTile
          icon={<Users size={14} />}
          label="Transaction forecast"
          value={formatCount(totals.transactions)}
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
        <Info size={14} color="var(--color-text-secondary)" style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
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
                    fontSize: 10.5,
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
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {PHASE_LABEL[p]}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
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

function KpiTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: '14px 14px 12px',
        background: 'var(--color-bg-hover)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-text-primary)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PhaseLine({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontSize: 11.5,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 120 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, background: color, borderRadius: 999 }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {label}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(pct * 100)}%
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
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
  if (signal === 'weather') return <Cloud size={11} />;
  return null;
}

function phaseHours(p: Phase): string {
  if (p === 'morning') return '06\u201311';
  if (p === 'midday') return '11\u201315';
  return '15\u201319';
}

const subheading: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-text-secondary)',
};

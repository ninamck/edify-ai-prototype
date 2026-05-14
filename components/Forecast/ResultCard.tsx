'use client';

/**
 * ResultCard — the "this is what we forecasted and why it was wrong" hero.
 *
 * Mirrors ForwardForecastCard's IA: same three operator-language numbers
 * (revenue, items, transactions), now compared forecast → actual with a
 * signed delta. One-sentence "why" beneath; phase + channel breakdowns
 * below with side-by-side bars.
 *
 * Time-awareness — important for the live view:
 *  - For DEMO_TODAY the day is in progress (DEMO_NOW_HHMM = 07:30 in the
 *    prototype), so we compare forecast-so-far to actual-so-far via
 *    `compareDay`. Without this, a phase that hasn't started yet shows
 *    as a -100% miss against a £0 actual — exactly the trap the operator
 *    spots first. Pending phases render as "Not yet" with the full-day
 *    forecast for context; current phases get an "in progress" tag.
 *  - For past dates everything reads full-day for both forecast and
 *    actual, so the card is the same dense comparison surface.
 */

import { useMemo } from 'react';
import { Coins, ShoppingBag, Users, Info, ArrowDownRight, ArrowUpRight, Clock } from 'lucide-react';
import {
  dayOfWeek,
  DEMO_TODAY,
  type SiteId,
} from '@/components/Production/fixtures';
import {
  channelMixFor,
  CHANNEL_LABEL,
  compareDay,
  formatCount,
  formatCurrency,
  formatPct,
  narrateMiss,
  PHASE_LABEL,
  type Phase,
  type PhaseStatus,
} from './economics';
import { DEMO_NOW_HHMM } from '@/components/Production/PlanStore';

type Props = {
  siteId: SiteId;
  date: string;
  /** Pre-formatted label like "Today" or "Yesterday · Wed 22 Apr". */
  dateLabel: string;
};

export default function ResultCard({ siteId, date, dateLabel }: Props) {
  const cmp = useMemo(() => compareDay(siteId, date), [siteId, date]);
  const miss = useMemo(() => narrateMiss(siteId, date), [siteId, date]);
  const mix = useMemo(() => channelMixFor(siteId, date), [siteId, date]);

  const forecast = cmp.soFar.forecast; // so-far for today, full for past
  const actual = cmp.soFar.actual;
  const fullDay = cmp.fullDayForecast;
  const isPartial = cmp.isPartial;
  const phases: Phase[] = ['morning', 'midday', 'afternoon'];

  // Bar scale uses the day's full-day forecast (the canonical "what we
  // expected") so pending phases still render at the right relative
  // height instead of collapsing to nothing.
  const maxPhaseRevenue = Math.max(
    fullDay.byPhase.morning.revenue,
    fullDay.byPhase.midday.revenue,
    fullDay.byPhase.afternoon.revenue,
    actual.byPhase.morning.revenue,
    actual.byPhase.midday.revenue,
    actual.byPhase.afternoon.revenue,
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
          What was forecasted
        </h2>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {dateLabel} · {dayOfWeek(date)}
        </span>
        {isPartial && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 999,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <Clock size={10} />
            Live · as of {DEMO_NOW_HHMM}
          </span>
        )}
      </div>

      {/* KPI trio — forecast-so-far vs actual-so-far. Each tile also shows
          the full-day forecast as a calm sub-line so the operator never
          loses sight of where the day is meant to land. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        <CompareTile
          icon={<Coins size={14} />}
          label="Revenue"
          forecast={formatCurrency(forecast.revenue)}
          actual={formatCurrency(actual.revenue)}
          deltaPct={pctDelta(actual.revenue, forecast.revenue)}
          deltaAbs={formatCurrency(Math.abs(actual.revenue - forecast.revenue))}
          fullDay={isPartial ? formatCurrency(fullDay.revenue) : undefined}
        />
        <CompareTile
          icon={<ShoppingBag size={14} />}
          label="Items"
          forecast={formatCount(forecast.items)}
          actual={formatCount(actual.items)}
          deltaPct={pctDelta(actual.items, forecast.items)}
          deltaAbs={formatCount(Math.abs(actual.items - forecast.items))}
          fullDay={isPartial ? formatCount(fullDay.items) : undefined}
        />
        <CompareTile
          icon={<Users size={14} />}
          label="Transactions"
          forecast={formatCount(forecast.transactions)}
          actual={formatCount(actual.transactions)}
          deltaPct={pctDelta(actual.transactions, forecast.transactions)}
          deltaAbs={formatCount(Math.abs(actual.transactions - forecast.transactions))}
          fullDay={isPartial ? formatCount(fullDay.transactions) : undefined}
        />
      </div>

      {/* Miss narrative */}
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
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            lineHeight: 1.5,
            color: 'var(--color-text-primary)',
          }}
        >
          {miss.sentence}
        </p>
      </div>

      {/* Phase split — forecast vs actual */}
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
            const status: PhaseStatus = cmp.phaseStatus[p];
            const f = forecast.byPhase[p];
            const a = actual.byPhase[p];
            const fullF = fullDay.byPhase[p];
            const fcWidth = (f.revenue / maxPhaseRevenue) * 100;
            const acWidth = (a.revenue / maxPhaseRevenue) * 100;
            // Pending phases plot the full-day forecast as a muted
            // "expected" bar — without it the tile would render empty.
            const expectedWidth = (fullF.revenue / maxPhaseRevenue) * 100;
            const dPct = pctDelta(a.revenue, f.revenue);
            return (
              <div
                key={p}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 12,
                  background: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 10,
                  // Pending phases get a touch less weight so the eye
                  // lands on the live data first.
                  opacity: status === 'pending' ? 0.85 : 1,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 8,
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
                  <PhaseStatusPill status={status} dPct={dPct} />
                </div>

                {status === 'pending' ? (
                  // No actuals yet — show the expected (full-day)
                  // forecast bar in a muted style so the tile reads
                  // "this is what we're expecting" rather than a miss.
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <DualBar
                      label="Expected"
                      color="var(--color-text-muted)"
                      widthPct={expectedWidth}
                      value={formatCurrency(fullF.revenue)}
                    />
                    <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
                      Phase hasn’t opened yet · {phaseHours(p)}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <DualBar
                      label="Forecast"
                      color="var(--color-text-muted)"
                      widthPct={fcWidth}
                      value={formatCurrency(f.revenue)}
                    />
                    <DualBar
                      label="Actual"
                      color="var(--color-accent-active)"
                      widthPct={acWidth}
                      value={formatCurrency(a.revenue)}
                    />
                  </div>
                )}

                {status === 'pending' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <PendingLine label="Items" value={formatCount(fullF.items)} />
                    <PendingLine label="Trans." value={formatCount(fullF.transactions)} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <PhaseLine
                      label="Items"
                      fcText={formatCount(f.items)}
                      acText={formatCount(a.items)}
                    />
                    <PhaseLine
                      label="Trans."
                      fcText={formatCount(f.transactions)}
                      acText={formatCount(a.transactions)}
                    />
                  </div>
                )}
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
            forecast={forecast.revenue * mix.takeaway}
            actual={actual.revenue * mix.takeaway}
          />
          <ChannelLegend
            color="var(--color-info)"
            label={CHANNEL_LABEL.eatIn}
            pct={mix.eatIn}
            forecast={forecast.revenue * mix.eatIn}
            actual={actual.revenue * mix.eatIn}
          />
          <ChannelLegend
            color="var(--color-success)"
            label={CHANNEL_LABEL.delivery}
            pct={mix.delivery}
            forecast={forecast.revenue * mix.delivery}
            actual={actual.revenue * mix.delivery}
          />
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-pieces
// ────────────────────────────────────────────────────────────────────────────

function CompareTile({
  icon,
  label,
  forecast,
  actual,
  deltaPct,
  deltaAbs,
  fullDay,
}: {
  icon: React.ReactNode;
  label: string;
  forecast: string;
  actual: string;
  deltaPct: number;
  deltaAbs: string;
  /** Optional sub-line shown only when the day is partial — keeps the
   *  full-day forecast in view so the so-far reading has context. */
  fullDay?: string;
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
        gap: 8,
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

      {/* Forecast → actual stacked rows. Labels read as "so-far" when
          the parent passed a fullDay value, so the operator never thinks
          they're seeing a verdict on the whole day. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            fontSize: 11,
            color: 'var(--color-text-muted)',
          }}
        >
          <span>{fullDay ? 'Forecast so far' : 'Forecast'}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{forecast}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            {fullDay ? 'Sold so far' : 'Actual'}
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--color-text-primary)',
              lineHeight: 1.1,
            }}
          >
            {actual}
          </span>
        </div>
      </div>

      <DeltaRow pct={deltaPct} abs={deltaAbs} />

      {fullDay && (
        <div
          style={{
            paddingTop: 6,
            borderTop: '1px dashed var(--color-border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            fontSize: 10.5,
            color: 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>Full day forecast</span>
          <span>{fullDay}</span>
        </div>
      )}
    </div>
  );
}

function PhaseStatusPill({ status, dPct }: { status: PhaseStatus; dPct: number }) {
  if (status === 'pending') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 6px',
          background: '#ffffff',
          color: 'var(--color-text-muted)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <Clock size={10} />
        Not yet
      </span>
    );
  }
  if (status === 'current') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 6px',
            background: 'color-mix(in srgb, var(--color-accent-active) 8%, white)',
            color: 'var(--color-accent-active)',
            border: '1px solid color-mix(in srgb, var(--color-accent-active) 30%, white)',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          In progress
        </span>
        <DeltaPill pct={dPct} />
      </span>
    );
  }
  return <DeltaPill pct={dPct} />;
}

function PendingLine({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontSize: 11,
        color: 'var(--color-text-muted)',
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value} <span style={{ color: 'var(--color-text-muted)' }}>expected</span>
      </span>
    </div>
  );
}

function phaseHours(p: Phase): string {
  if (p === 'morning') return '06–11';
  if (p === 'midday') return '11–15';
  return '15–19';
}

function DeltaRow({ pct, abs }: { pct: number; abs: string }) {
  const tone =
    Math.abs(pct) < 1
      ? 'neutral'
      : pct > 0
        ? 'up'
        : 'down';
  const color =
    tone === 'neutral'
      ? 'var(--color-text-muted)'
      : tone === 'up'
        ? 'var(--color-success)'
        : 'var(--color-error)';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        color,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {tone === 'up' ? (
        <ArrowUpRight size={12} />
      ) : tone === 'down' ? (
        <ArrowDownRight size={12} />
      ) : null}
      <span>{formatPct(pct, { sign: true })}</span>
      <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>· {abs}</span>
    </div>
  );
}

function DeltaPill({ pct }: { pct: number }) {
  const tone =
    Math.abs(pct) < 1
      ? 'neutral'
      : pct > 0
        ? 'up'
        : 'down';
  const palette: Record<typeof tone, { bg: string; color: string; border: string }> = {
    neutral: {
      bg: '#ffffff',
      color: 'var(--color-text-muted)',
      border: 'var(--color-border-subtle)',
    },
    up: {
      bg: 'var(--color-success-light)',
      color: 'var(--color-success)',
      border: 'var(--color-success-border)',
    },
    down: {
      bg: 'var(--color-error-light)',
      color: 'var(--color-error)',
      border: 'var(--color-error-border)',
    },
  };
  const p = palette[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        background: p.bg,
        color: p.color,
        border: `1px solid ${p.border}`,
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {formatPct(pct, { sign: true })}
    </span>
  );
}

function DualBar({
  label,
  color,
  widthPct,
  value,
}: {
  label: string;
  color: string;
  widthPct: number;
  value: string;
}) {
  // Text row on top, bar below. Keeping the bar on its own line means
  // long currency values (£4,200, £12.3k, etc.) can't squeeze the
  // progress track or visually overlap the number — a problem the
  // previous side-by-side layout was hitting on narrow tiles.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontWeight: 600,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--color-text-primary)',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
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
            width: `${Math.max(2, Math.min(100, widthPct))}%`,
            background: color,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

function PhaseLine({
  label,
  fcText,
  acText,
}: {
  label: string;
  fcText: string;
  acText: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontSize: 11,
        color: 'var(--color-text-muted)',
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {fcText} <span style={{ color: 'var(--color-text-muted)' }}>→</span>{' '}
        <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{acText}</span>
      </span>
    </div>
  );
}

function ChannelLegend({
  color,
  label,
  pct,
  forecast,
  actual,
}: {
  color: string;
  label: string;
  pct: number;
  forecast: number;
  actual: number;
}) {
  const delta = pctDelta(actual, forecast);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, background: color, borderRadius: 999 }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
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
        {formatCurrency(Math.round(forecast))}{' '}
        <span style={{ color: 'var(--color-text-muted)' }}>→</span>{' '}
        <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          {formatCurrency(Math.round(actual))}
        </span>{' '}
        <span style={{ color: delta >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
          ({formatPct(delta, { sign: true })})
        </span>
      </div>
    </div>
  );
}

function pctDelta(actual: number, forecast: number): number {
  if (forecast === 0) return 0;
  return ((actual - forecast) / forecast) * 100;
}

const subheading: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-text-secondary)',
};

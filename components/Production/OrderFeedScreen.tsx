'use client';

/**
 * OrderFeedScreen — "what's selling, right now" for the Burger King line.
 *
 * A light card dashboard, built to be scanned at a glance: two lanes the floor
 * actually separates — Deliveries vs In-store — each a card with a live feed of
 * incoming orders. Every order is fulfilled from the Pan Holding Unit
 * oldest-first (FIFO) and carries a colour-coded freshness chip + a freshness
 * rail down its left edge, so the freshness state reads straight down the
 * column without reading any text. A green freshness headline proves the line
 * is serving fresh on both channels. Driven by `orderFeedStore`.
 */

import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Bike,
  Store,
  Leaf,
  Timer,
  ChefHat,
} from 'lucide-react';
import {
  useOrderFeed,
  gbp,
  type Order,
  type ChannelSummary,
  type FreshnessTier,
} from './orderFeedStore';
import { minutesToHHMM } from './time';

const FRESH = '#1f9d57';
const GOOD = '#2f6df6';
const LAST_CALL = '#c0860b';
const MTO = '#0e7490';

const TIER_STYLE: Record<FreshnessTier, { color: string; label: string }> = {
  fresh: { color: FRESH, label: 'Fresh' },
  good: { color: GOOD, label: 'Good' },
  'last-call': { color: LAST_CALL, label: 'Last call' },
  'made-to-order': { color: MTO, label: 'Made to order' },
};

export default function OrderFeedScreen() {
  const loop = useOrderFeed();
  const cabinetOldest = Math.max(0, ...loop.cabinet.map(c => c.oldestAgeMin ?? 0));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '18px 24px 40px',
        maxWidth: 1320,
        margin: '0 auto',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Title + transport */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: 'var(--color-text-primary)' }}>Live orders</h1>
        <span style={{ fontSize: 13.5, color: 'var(--color-text-secondary)' }}>Burger King · Stratford</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            background: 'var(--color-bg-hover)',
            borderRadius: 100,
            padding: '4px 11px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {loop.nowHHMM}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" onClick={loop.togglePlay} disabled={loop.atEnd} style={primaryBtn(loop.atEnd)}>
            {loop.playing ? <Pause size={15} /> : <Play size={15} />}
            {loop.playing ? 'Pause' : loop.atEnd ? 'Done' : 'Play'}
          </button>
          <button type="button" onClick={() => loop.step(5)} disabled={loop.atEnd} style={ghostBtn(loop.atEnd)}>
            <SkipForward size={14} /> +5 min
          </button>
          <button type="button" onClick={loop.reset} style={ghostBtn(false)}>
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* Freshness headline */}
      <FreshnessHero
        freshPct={loop.freshPctOverall}
        avgAge={loop.avgAgeOverall}
        burgers={loop.burgersServed}
        cabinetUnits={loop.cabinetUnits}
        cabinetOldest={cabinetOldest}
      />

      {/* Two channel lanes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, alignItems: 'start' }}>
        <ChannelLane
          summary={loop.delivery}
          orders={loop.orders.filter(o => o.channel === 'delivery')}
          icon={<Bike size={17} />}
          title="Deliveries"
          subtitle="Uber Eats · Deliveroo · Just Eat · BK App"
          accent="#191484"
        />
        <ChannelLane
          summary={loop.inStore}
          orders={loop.orders.filter(o => o.channel === 'in-store')}
          icon={<Store size={17} />}
          title="In-store"
          subtitle="Kiosk · Front counter · Drive-thru"
          accent="#d62300"
        />
      </div>
    </div>
  );
}

function FreshnessHero({
  freshPct,
  avgAge,
  burgers,
  cabinetUnits,
  cabinetOldest,
}: {
  freshPct: number;
  avgAge: number;
  burgers: number;
  cabinetUnits: number;
  cabinetOldest: number;
}) {
  return (
    <section
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexWrap: 'wrap',
        background: 'linear-gradient(135deg, #1f7a4d 0%, #2fa36b 100%)',
        color: '#fff',
        borderRadius: 16,
        padding: '18px 22px',
        boxShadow: '0 14px 36px rgba(47,163,107,0.26)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: '1 1 320px', minWidth: 260 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 46,
            height: 46,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.18)',
            flexShrink: 0,
          }}
        >
          <Leaf size={24} />
        </span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 }}>
            Served fresh today
          </div>
          <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.02, fontVariantNumeric: 'tabular-nums' }}>
            {freshPct.toFixed(1)}%
          </div>
          <div style={{ fontSize: 13, opacity: 0.92 }}>
            {burgers.toLocaleString()} burgers out the door · avg {avgAge.toFixed(1)} min off the grill
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, background: 'rgba(255,255,255,0.14)', borderRadius: 12, padding: '12px 16px' }}>
        <HeroStat label="Avg freshness" value={`${avgAge.toFixed(1)} min`} sub="since grilled" />
        <span style={{ width: 1, background: 'rgba(255,255,255,0.25)' }} />
        <HeroStat label="Pan Holding Unit" value={`${cabinetUnits}`} sub={`held · oldest ${cabinetOldest}m`} />
      </div>

      <div style={{ flexBasis: '100%', fontSize: 12.5, opacity: 0.9, lineHeight: 1.5 }}>
        Every order is pulled oldest-first from the Pan Holding Unit, so nothing sits past its hold — and Quinn keeps the unit topped
        to the next 15 minutes of demand, so stock is always there and always fresh. Anything that would go out tired is remade to order.
      </div>
    </section>
  );
}

function HeroStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 110 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.8 }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 11, opacity: 0.78 }}>{sub}</span>
    </div>
  );
}

function ChannelLane({
  summary,
  orders,
  icon,
  title,
  subtitle,
  accent,
}: {
  summary: ChannelSummary;
  orders: Order[];
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      {/* Lane header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 18px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            borderRadius: 10,
            background: hexA(accent, 0.1),
            color: accent,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>{title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{subtitle}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 21, fontWeight: 900, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {gbp(summary.revenue)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {summary.orders} orders · {summary.items} items
          </div>
        </div>
      </div>

      {/* Freshness sub-bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 18px',
          background: 'var(--color-bg-hover)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <Leaf size={14} color={FRESH} />
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {summary.freshPct.toFixed(0)}% fresh
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, fontVariantNumeric: 'tabular-nums' }}>
          <Timer size={13} /> avg {summary.avgAgeMin.toFixed(1)} min off the grill
        </span>
      </div>

      {/* Live feed — one card per order */}
      <div style={{ maxHeight: 560, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: '#f6f7f9' }}>
        {orders.length === 0 ? (
          <div style={{ padding: '24px 4px', fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            No orders yet — press Play.
          </div>
        ) : (
          orders.map(o => <OrderCard key={o.id} order={o} />)
        )}
      </div>
    </section>
  );
}

function OrderCard({ order }: { order: Order }) {
  const tier = TIER_STYLE[order.tier];
  const items = order.lines.map(l => `${l.qty}× ${l.name}`).join('  ·  ');
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '11px 13px 11px 14px',
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 12,
        // Freshness rail — reads the freshness state down the column at a glance.
        borderLeft: `4px solid ${tier.color}`,
      }}
    >
      {/* Top: time + source · freshness chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {minutesToHHMM(order.atMin)}
        </span>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--color-text-secondary)',
            background: 'var(--color-bg-hover)',
            borderRadius: 100,
            padding: '3px 10px',
            whiteSpace: 'nowrap',
          }}
        >
          {order.source}
        </span>
        <span
          title={order.tier === 'made-to-order' ? 'Cooked fresh to order' : `Served ${order.ageMin} min after grilling`}
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11.5,
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: 100,
            background: hexA(tier.color, 0.12),
            color: tier.color,
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {order.tier === 'made-to-order' ? <ChefHat size={12} /> : <Leaf size={12} />}
          {order.tier === 'made-to-order' ? tier.label : `${tier.label} · ${order.ageMin}m`}
        </span>
      </div>

      {/* Items */}
      <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.35 }}>{items}</div>

      {/* Footer: item count · total */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {order.itemsCount} {order.itemsCount === 1 ? 'item' : 'items'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {gbp(order.total)}
        </span>
      </div>
    </div>
  );
}

// ── style helpers ───────────────────────────────────────────────────────────

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '8px 15px',
    borderRadius: 9,
    border: 'none',
    background: disabled ? 'var(--color-border-subtle)' : 'var(--color-accent-active)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    cursor: disabled ? 'default' : 'pointer',
  };
}

function ghostBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 13px',
    borderRadius: 9,
    border: '1px solid var(--color-border)',
    background: '#fff',
    color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    cursor: disabled ? 'default' : 'pointer',
  };
}

function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

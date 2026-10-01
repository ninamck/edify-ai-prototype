'use client';

/**
 * Email orders — the page body for the Menu › Email orders tab.
 *
 * Edify reads the order inboxes, matches each line to a till item and
 * sends the order to the POS so it lands in sales and on the production
 * plan. This screen shows that happening (status strip), the shape of
 * the week (stat tiles), and every order grouped by the day it is for,
 * with a review flow for the ones Edify could not finish on its own.
 */

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { EmailOrder, EmailOrderStatus } from './types';
import { EMAIL_ORDERS_TODAY } from './fixtures';
import { formatPlanDay, useEmailOrders } from './store';
import AgentStatusStrip from './AgentStatusStrip';
import OrderRow from './OrderRow';

type Filter = 'all' | EmailOrderStatus;

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  review: 'Needs review',
  scheduled: 'On the plan',
  sent: 'On the till',
  failed: 'Failed',
  waiting: 'Waiting',
  cancelled: 'Cancelled',
};

const FILTER_ORDER: Filter[] = ['all', 'review', 'scheduled', 'sent', 'failed', 'waiting', 'cancelled'];

export default function EmailOrdersScreen() {
  const orders = useEmailOrders();
  const narrow = useMediaQuery('(max-width: 820px)');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  // Open the one order that needs the operator most, so the page lands
  // on the decision rather than a list of closed rows. An order with an
  // item to match comes before an amendment that only needs a confirm.
  const [openId, setOpenId] = useState<string | null>(() => {
    const review = orders.filter((o) => o.status === 'review');
    const withUnmatched = review.find((o) => o.lines.some((l) => !l.match));
    return (withUnmatched ?? review[0])?.id ?? null;
  });

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: orders.length, review: 0, scheduled: 0, sent: 0, failed: 0, waiting: 0, cancelled: 0 };
    for (const o of orders) c[o.status] += 1;
    return c;
  }, [orders]);

  const collectionsToday = useMemo(
    () => orders.filter((o) => o.fulfilmentDate === EMAIL_ORDERS_TODAY && o.status !== 'cancelled').length,
    [orders],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false;
      if (!q) return true;
      return (
        o.customer.toLowerCase().includes(q)
        || o.ref.toLowerCase().includes(q)
        || (o.sitePart ?? '').toLowerCase().includes(q)
        || o.lines.some((l) => l.itemAsWritten.toLowerCase().includes(q))
      );
    });
  }, [orders, filter, query]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div style={{ padding: '24px 24px 120px', maxWidth: 1120, margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      <AgentStatusStrip />

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(2, minmax(0, 1fr))' : `repeat(${counts.failed + counts.waiting > 0 ? 5 : 4}, minmax(0, 1fr))`, gap: 10, marginTop: 16 }}>
        <StatTile
          label="Needs review"
          value={counts.review}
          hint={counts.review === 0 ? 'Nothing waiting on you' : counts.review === 1 ? '1 order waiting on you' : `${counts.review} orders waiting on you`}
          active={filter === 'review'}
          accent={counts.review > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)'}
          onClick={() => setFilter(filter === 'review' ? 'all' : 'review')}
        />
        <StatTile
          label="On the till"
          value={counts.sent}
          hint="today, no typing"
          active={filter === 'sent'}
          accent="var(--color-success)"
          onClick={() => setFilter(filter === 'sent' ? 'all' : 'sent')}
        />
        <StatTile
          label="On the plan"
          value={counts.scheduled}
          hint="go to the till on the day"
          active={filter === 'scheduled'}
          accent="var(--color-info)"
          onClick={() => setFilter(filter === 'scheduled' ? 'all' : 'scheduled')}
        />
        {/* A "Failed" tile only appears when there is something to show;
            on a clean day it would just be a zero with a red label. */}
        {counts.failed + counts.waiting > 0 && (
          <StatTile
            label="Not on the till"
            value={counts.failed + counts.waiting}
            hint="retry, or wait for the till"
            active={filter === 'failed' || filter === 'waiting'}
            accent="var(--color-error)"
            onClick={() => {
              const target: Filter = counts.failed > 0 ? 'failed' : 'waiting';
              setFilter(filter === 'failed' || filter === 'waiting' ? 'all' : target);
            }}
          />
        )}
        <StatTile
          label="Today"
          value={collectionsToday}
          hint={collectionsToday === 1 ? 'order to fulfil today' : 'orders to fulfil today'}
          active={false}
          accent="var(--color-text-primary)"
          onClick={() => { setFilter('all'); setQuery(''); }}
        />
      </div>

      {/* Filters + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {FILTER_ORDER.filter((f) => f === 'all' || counts[f] > 0 || f === 'review' || f === 'sent' || f === 'scheduled').map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                style={{
                  padding: '6px 12px', borderRadius: 100, minHeight: 32,
                  border: active ? '1px solid transparent' : '1px solid var(--color-border)',
                  background: active ? 'var(--color-accent-active)' : '#fff',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {FILTER_LABELS[f]}
                <span style={{ fontSize: 10.5, fontWeight: 700, color: active ? 'rgba(255,255,255,0.85)' : 'var(--color-text-muted)' }}>
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>
        <div
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 10,
            background: '#fff', border: '1px solid var(--color-border)',
            minWidth: 240, flex: '0 1 320px',
          }}
        >
          <Search size={14} color="var(--color-text-muted)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, refs, items…"
            aria-label="Search orders"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'var(--font-primary)', fontSize: 13, color: 'var(--color-text-primary)',
            }}
          />
        </div>
      </div>

      {/* Orders, grouped by the day they are for */}
      {orders.length === 0 ? (
        <EmptyState text="No email orders yet. When one arrives, it shows here and goes to your till if every item matches." />
      ) : groups.length === 0 ? (
        <EmptyState text="Nothing matches. Try another filter or clear the search." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {groups.map((g) => (
            <section key={g.day} aria-label={g.label}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{g.label}</h2>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {g.orders.length} {g.orders.length === 1 ? 'order' : 'orders'}
                </span>
              </div>
              <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'visible' }}>
                {g.orders.map((o, i) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    first={i === 0}
                    last={i === g.orders.length - 1}
                    open={openId === o.id}
                    onToggle={() => setOpenId(openId === o.id ? null : o.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function groupByDay(orders: EmailOrder[]): { day: string; label: string; orders: EmailOrder[] }[] {
  const byDay = new Map<string, EmailOrder[]>();
  for (const o of orders) {
    const list = byDay.get(o.fulfilmentDate) ?? [];
    list.push(o);
    byDay.set(o.fulfilmentDate, list);
  }
  const tomorrow = addDays(EMAIL_ORDERS_TODAY, 1);
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, list]) => ({
      day,
      label:
        day === EMAIL_ORDERS_TODAY ? `Today, ${formatPlanDay(day)}`
          : day === tomorrow ? `Tomorrow, ${formatPlanDay(day)}`
            : day < EMAIL_ORDERS_TODAY ? `${formatPlanDay(day)} (past)`
              : formatPlanDay(day),
      orders: list.sort((a, b) => a.fulfilmentTime.localeCompare(b.fulfilmentTime)),
    }));
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function StatTile({
  label, value, hint, active, accent, onClick,
}: {
  label: string;
  value: number;
  hint: string;
  active: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        textAlign: 'left', padding: '12px 14px', borderRadius: 12,
        border: active ? '1px solid var(--color-accent-active)' : '1px solid var(--color-border)',
        background: '#fff', cursor: 'pointer', fontFamily: 'var(--font-primary)',
        display: 'flex', flexDirection: 'column', gap: 4,
        boxShadow: active ? '0 0 0 2px rgba(0, 28, 53, 0.08)' : 'none',
        transition: 'box-shadow 120ms ease, border-color 120ms ease',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: accent, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>{hint}</span>
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: 28, textAlign: 'center', background: '#fff',
        border: '1px dashed var(--color-border)', borderRadius: 12,
        color: 'var(--color-text-muted)', fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}

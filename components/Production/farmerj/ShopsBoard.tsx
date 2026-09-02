'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import StatusPill from '@/components/Production/StatusPill';
import { gbp } from './cascade';
import { addDays, FJ_DAY_STRIP_DATES, FJ_DEMO_TODAY, isDeepCleanDay, isProductionDay, isShopOpen, longDate, referenceDaysFor, weekdayLabel } from './calendar';
import { bodyStyle, captionStrip, footStyle, headStyle, Notice, numStyle, PillTabs } from './DayPlan';
import { computeDayPlan, useFjPlanStore, type DayRecord } from './FjPlanStore';
import { SHELF_LIFE_GROUPS, type ShelfLifeGroupId } from './recipes';
import { averageDemand } from './sales';
import { FJ_SHOPS, type Shop } from './shops';

/**
 * Jana's board: every shop's plan for one day on one screen, and a way
 * into any of them. Same table chassis as the day plan. Status comes from
 * each shop's record; shops the demo has not touched carry a modelled
 * status so the board reads like a Wednesday morning.
 */

type Status = 'not-started' | 'draft' | 'approved' | 'counting' | 'counted' | 'closed';

const STATUS: Record<Status, { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'error' | 'brand' }> = {
  'not-started': { label: 'Not started', tone: 'warning' },
  draft: { label: 'Draft', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  counting: { label: 'Counting', tone: 'brand' },
  counted: { label: 'Counted', tone: 'neutral' },
  closed: { label: 'Closed', tone: 'neutral' },
};

type Filter = 'all' | 'attention' | 'approved';
const MAKE_AHEAD: ShelfLifeGroupId[] = ['green3', 'blue4', 'coconut2', 'weekly'];
const GROUP_SHORT: Partial<Record<ShelfLifeGroupId, string>> = { green3: '3-day', blue4: '4-day', coconut2: 'Coconut', weekly: 'Weekly' };

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function statusFor(shop: Shop, date: string, record: DayRecord, open: boolean): Status {
  if (!open) return 'closed';
  if (record.close) return 'counted';
  if (record.approvedAtISO) return 'approved';
  const touched = Object.keys(record.overrides).length > 0 || record.flexPct !== 0 || record.cancelledOrders.length > 0;
  if (touched) return 'draft';
  if (date < FJ_DEMO_TODAY) return 'counted';
  if (shop.id === 'fj-marylebone') return 'draft';
  // Demo-modelled: most shops approved on Monday, a couple still drafting,
  // one not opened yet. Deterministic per shop and day.
  const h = hash(`${shop.id}|${date}`) % 12;
  if (h === 0) return 'not-started';
  if (h <= 2) return 'draft';
  return 'approved';
}

export default function ShopsBoard() {
  const { isFarmerJ } = useActiveSite();
  if (!isFarmerJ) return <Notice>Switch the Brand pill in demo controls to Farmer J to see this screen.</Notice>;
  return <Board />;
}

function Board() {
  const router = useRouter();
  const store = useFjPlanStore();
  const { setActiveSiteId } = useActiveSite();
  const [date, setDate] = useState(FJ_DEMO_TODAY);
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(
    () =>
      FJ_SHOPS.map(shop => {
        const open = isShopOpen(shop.id, date);
        const record = store.get(shop.id, date);
        const plan = open ? computeDayPlan(shop.id, date, record, store.get(shop.id, addDays(date, -1)).close) : null;
        const status = statusFor(shop, date, record, open);
        const makeAhead = open ? MAKE_AHEAD.filter(g => isProductionDay(shop.id, g, date)) : [];
        const yesterday = store.get(shop.id, addDays(date, -1));
        const yOpen = isShopOpen(shop.id, addDays(date, -1));
        const countedYesterday = yOpen && (Boolean(yesterday.close) || (shop.id !== 'fj-marylebone' && hash(`${shop.id}|close|${date}`) % 9 !== 0));
        return { shop, open, plan, status, makeAhead, countedYesterday, yOpen, handSet: plan?.overriddenCount ?? 0, flex: record.flexPct };
      }),
    [date, store],
  );

  const shown = rows.filter(r => filter === 'all' || (filter === 'approved' ? r.status === 'approved' : r.status === 'not-started' || r.status === 'draft' || (r.yOpen && !r.countedYesterday)));
  const openRows = rows.filter(r => r.open);
  const approved = openRows.filter(r => r.status === 'approved' || r.status === 'counted').length;
  const attention = rows.filter(r => r.status === 'not-started' || r.status === 'draft' || (r.yOpen && !r.countedYesterday)).length;
  const totalNet = openRows.reduce((n, r) => n + (r.plan?.demand.net ?? 0), 0);
  const totalBatches = openRows.reduce((n, r) => n + (r.plan?.totals.batches ?? 0), 0);
  const isToday = date === FJ_DEMO_TODAY;

  const openShop = (shopId: string) => {
    setActiveSiteId(shopId);
    router.push(`/production/day?date=${date}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)' }}>
      <AllShopsDayStrip selectedDate={date} onSelect={setDate} />
      <div style={captionStrip}>
        <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>{isToday ? 'Every shop today' : `Every shop, ${longDate(date)}`}</span>
        <span>· {openRows.length} of {FJ_SHOPS.length} open</span>
        <span>· {approved} approved</span>
        {isDeepCleanDay(date) && <span>· deep clean day</span>}
        <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{gbp(totalNet)} forecast · {Math.round(totalBatches)} batches</span>
      </div>

      <div style={{ padding: '16px 30px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <PillTabs
            ariaLabel="Shop filter"
            tabs={[
              { id: 'all' as Filter, label: `All ${FJ_SHOPS.length}` },
              { id: 'attention' as Filter, label: attention ? `Needs a look · ${attention}` : 'Needs a look' },
              { id: 'approved' as Filter, label: `Approved · ${approved}` },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 900, borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={headStyle({ left: true, sticky: true, minWidth: 220 })}>Shop</th>
                  <th style={headStyle({ minWidth: 110 })}>Plan</th>
                  <th style={headStyle({ minWidth: 90 })}>Forecast<div style={sub}>pounds</div></th>
                  <th style={headStyle({ minWidth: 70 })}>Batches</th>
                  <th style={headStyle({ minWidth: 110 })}>Lines<div style={sub}>main · second</div></th>
                  <th style={headStyle({ minWidth: 90 })}>Set by hand</th>
                  <th style={headStyle({ minWidth: 150 })}>Make ahead today</th>
                  <th style={headStyle({ minWidth: 110 })}>Yesterday&apos;s close</th>
                  <th style={headStyle({ minWidth: 60 })} />
                </tr>
              </thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.shop.id} style={{ opacity: r.open ? 1 : 0.6 }}>
                    <td style={bodyStyle({ left: true, sticky: true })}>
                      <div style={{ fontWeight: 600 }}>{r.shop.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 1 }}>
                        {r.shop.area} · {r.shop.breakfast ? `opens ${r.shop.opensAt}, breakfast` : `opens ${r.shop.opensAt}`}
                      </div>
                    </td>
                    <td style={bodyStyle({})}><StatusPill size="xs" tone={STATUS[r.status].tone} label={STATUS[r.status].label} /></td>
                    <td style={bodyStyle({})}>{r.plan ? <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{gbp(r.plan.demand.net)}</span> : '—'}</td>
                    <td style={bodyStyle({})}>{r.plan ? <span style={numStyle}>{Math.round(r.plan.totals.batches * 2) / 2}</span> : '—'}</td>
                    <td style={bodyStyle({})}>{r.plan ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.plan.totals.mainUnits} · {r.plan.totals.secondUnits}</span> : '—'}</td>
                    <td style={bodyStyle({})}>
                      {r.handSet > 0 || r.flex !== 0 ? (
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {r.handSet > 0 ? `${r.handSet} ${r.handSet === 1 ? 'line' : 'lines'}` : ''}
                          {r.handSet > 0 && r.flex !== 0 ? ' · ' : ''}
                          {r.flex !== 0 ? `${r.flex > 0 ? '+' : ''}${r.flex}% day` : ''}
                        </span>
                      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td style={bodyStyle({})}>
                      {r.makeAhead.length ? (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {r.makeAhead.map(g => (
                            <span key={g} style={{ ...groupChip, borderColor: SHELF_LIFE_GROUPS[g].colour, color: SHELF_LIFE_GROUPS[g].colour }}>
                              <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: SHELF_LIFE_GROUPS[g].colour }} />
                              {GROUP_SHORT[g] ?? SHELF_LIFE_GROUPS[g].label}
                            </span>
                          ))}
                        </div>
                      ) : <span style={{ color: 'var(--color-text-muted)' }}>{r.open ? 'Daily only' : '—'}</span>}
                    </td>
                    <td style={bodyStyle({})}>
                      {!r.yOpen ? <span style={{ color: 'var(--color-text-muted)' }}>Closed {weekdayLabel(addDays(date, -1))}</span>
                        : r.countedYesterday ? <span style={{ color: 'var(--color-text-secondary)' }}>Counted</span>
                        : <StatusPill size="xs" tone="warning" label="Not counted" />}
                    </td>
                    <td style={bodyStyle({})}>
                      <button type="button" onClick={() => openShop(r.shop.id)} style={openBtn} aria-label={`Open ${r.shop.name}`}>
                        Open <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={footStyle({ left: true, sticky: true })}>{shown.length === FJ_SHOPS.length ? 'All shops' : `${shown.length} shops`}</td>
                  <td style={footStyle()}>—</td>
                  <td style={footStyle()}><span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{gbp(shown.reduce((n, r) => n + (r.plan?.demand.net ?? 0), 0))}</span></td>
                  <td style={footStyle()}><span style={numStyle}>{Math.round(shown.reduce((n, r) => n + (r.plan?.totals.batches ?? 0), 0))}</span></td>
                  <td style={footStyle()}><span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{shown.reduce((n, r) => n + (r.plan?.totals.mainUnits ?? 0), 0)} · {shown.reduce((n, r) => n + (r.plan?.totals.secondUnits ?? 0), 0)}</span></td>
                  <td style={footStyle()} colSpan={4}>—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Day strip for the whole estate: shops open and the forecast in pounds. */
function AllShopsDayStrip({ selectedDate, onSelect }: { selectedDate: string; onSelect: (d: string) => void }) {
  const cards = useMemo(
    () =>
      FJ_DAY_STRIP_DATES.map(date => {
        const open = FJ_SHOPS.filter(s => isShopOpen(s.id, date));
        const refs = referenceDaysFor(date).filter(r => r.included).map(r => r.date);
        const net = open.reduce((n, s) => n + averageDemand(s.id, refs).net, 0);
        return { date, open: open.length, net };
      }),
    [],
  );
  return (
    <div role="tablist" aria-label="Select day" style={{ display: 'flex', gap: 8, alignItems: 'stretch', padding: '12px 30px', background: '#fff', borderBottom: '1px solid var(--color-border-subtle)', overflowX: 'auto' }}>
      {cards.map(c => {
        const selected = c.date === selectedDate;
        const isToday = c.date === FJ_DEMO_TODAY;
        const isPast = c.date < FJ_DEMO_TODAY;
        return (
          <button
            key={c.date}
            role="tab"
            aria-selected={selected}
            type="button"
            onClick={() => onSelect(c.date)}
            style={{ flex: '0 0 auto', minWidth: 96, padding: '10px 12px', borderRadius: 10, border: `1px solid ${selected ? 'var(--color-accent-active)' : isToday ? 'var(--color-border)' : 'var(--color-border-subtle)'}`, background: selected ? 'var(--color-accent-active)' : '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, fontFamily: 'var(--font-primary)', textAlign: 'left', opacity: isPast && !selected ? 0.85 : 1 }}
          >
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: selected ? '#fff' : isPast ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}>{isToday ? 'Today' : weekdayLabel(c.date)}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: selected ? '#fff' : 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{c.date.slice(8, 10)}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: selected ? 'rgba(255,255,255,0.85)' : 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{c.open} open · {gbp(c.net)}</span>
          </button>
        );
      })}
    </div>
  );
}

const sub: CSSProperties = { fontSize: 8, fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.04em', marginTop: 2 };
const groupChip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, border: '1.5px solid', fontSize: 10, fontWeight: 700, background: '#fff', whiteSpace: 'nowrap' };
const openBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 2, padding: '5px 8px 5px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-primary)' };

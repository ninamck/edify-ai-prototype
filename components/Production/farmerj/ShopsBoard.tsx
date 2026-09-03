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
import { wasteFromClose } from './close';
import { useFjClock } from './fjClock';
import { netToHour, scopeActual } from './forecast';
import { computeDayPlan, useFjPlanStore, type DayRecord } from './FjPlanStore';
import { SHELF_LIFE_GROUPS, type ShelfLifeGroupId } from './recipes';
import { averageDemand } from './sales';
import { FJ_ALL_SHOPS_ID, FJ_SHOPS, type Shop } from './shops';

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
  // Past days: approved and traded; counted once the close is in.
  if (date < FJ_DEMO_TODAY) return closeCounted(shop, date, record) ? 'counted' : 'approved';
  if (shop.id === 'fj-marylebone') return 'draft';
  // Demo-modelled: most shops approved on Monday, a couple still drafting,
  // one not opened yet. Deterministic per shop and day.
  const h = hash(`${shop.id}|${date}`) % 12;
  if (h === 0) return 'not-started';
  if (h <= 2) return 'draft';
  return 'approved';
}

/**
 * Has this shop counted its close for `date`? Real records win; shops the
 * demo has not touched are modelled as counted most nights, the same hash
 * the status column uses, so the two columns never disagree.
 */
function closeCounted(shop: Shop, date: string, record: DayRecord): boolean {
  if (!isShopOpen(shop.id, date)) return false;
  if (record.close) return true;
  if (date >= FJ_DEMO_TODAY) return false;
  return shop.id !== 'fj-marylebone' && hash(`${shop.id}|close|${addDays(date, 1)}`) % 9 !== 0;
}

/**
 * Waste for the day: the saved count where there is one, otherwise a
 * modelled figure for demo shops, 0.6% to 2.4% of what the tills took.
 */
function wasteFor(shop: Shop, date: string, record: DayRecord, getRecord: (s: string, d: string) => DayRecord, soldNet: number): { binnedUnits: number; wastePounds: number } | undefined {
  if (!closeCounted(shop, date, record)) return undefined;
  const real = wasteFromClose(shop.id, date, getRecord);
  if (real) return real;
  const pct = 0.6 + (hash(`${shop.id}|waste|${date}`) % 19) / 10;
  const wastePounds = soldNet * pct / 100;
  return { binnedUnits: Math.round(wastePounds / 9 * 2) / 2, wastePounds };
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
  const clock = useFjClock();
  const hour = Math.floor(clock.mins / 60);
  const isToday = date === FJ_DEMO_TODAY;

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
        const countedYesterday = closeCounted(shop, addDays(date, -1), yesterday);
        // Sold: the tills, cut at the clock hour today so it reads "so far".
        const actual = open && !(date > FJ_DEMO_TODAY) ? scopeActual(shop.id, date) : null;
        const sold = actual ? (date === FJ_DEMO_TODAY ? netToHour(actual, hour) : actual.net) : null;
        const forecastSoFar = plan && actual && date === FJ_DEMO_TODAY ? plan.demand.net * (actual.net > 0 ? netToHour(actual, hour) / actual.net : 1) : plan?.demand.net ?? null;
        const waste = open ? wasteFor(shop, date, record, store.get, actual?.net ?? 0) : undefined;
        return { shop, open, plan, status, makeAhead, countedYesterday, yOpen, handSet: plan?.overriddenCount ?? 0, flex: record.flexPct, settingsChanged: Boolean(record.settingsChanged), sold, forecastSoFar, waste, counted: closeCounted(shop, date, record) };
      }),
    [date, store, hour],
  );

  const shown = rows.filter(r => filter === 'all' || (filter === 'approved' ? r.status === 'approved' : r.status === 'not-started' || r.status === 'draft' || r.settingsChanged || (r.yOpen && !r.countedYesterday)));
  const openRows = rows.filter(r => r.open);
  const approved = openRows.filter(r => r.status === 'approved' || r.status === 'counted').length;
  const attention = rows.filter(r => r.status === 'not-started' || r.status === 'draft' || (r.yOpen && !r.countedYesterday)).length;
  const totalNet = openRows.reduce((n, r) => n + (r.plan?.demand.net ?? 0), 0);
  const totalBatches = openRows.reduce((n, r) => n + (r.plan?.totals.batches ?? 0), 0);
  const showSold = !(date > FJ_DEMO_TODAY);
  const sumSold = (rs: typeof rows) => rs.reduce((n, r) => n + (r.sold ?? 0), 0);
  const sumWaste = (rs: typeof rows) => rs.reduce((n, r) => n + (r.waste?.wastePounds ?? 0), 0);
  const countedRows = (rs: typeof rows) => rs.filter(r => r.waste).length;

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
        {isDeepCleanDay(FJ_ALL_SHOPS_ID, date) && <span>· deep clean day</span>}
        <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
          {gbp(totalNet)} forecast · {Math.round(totalBatches)} batches
          {showSold && ` · ${gbp(sumSold(openRows))} sold${isToday ? ' so far' : ''}`}
          {countedRows(openRows) > 0 && ` · ${gbp(sumWaste(openRows))} waste`}
        </span>
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
                  {showSold && <th style={headStyle({ minWidth: 100 })}>Sold<div style={sub}>{isToday ? `to ${String(hour).padStart(2, '0')}:00` : 'pounds'}</div></th>}
                  <th style={headStyle({ minWidth: 70 })}>Batches</th>
                  <th style={headStyle({ minWidth: 110 })}>Lines<div style={sub}>main · second</div></th>
                  <th style={headStyle({ minWidth: 90 })}>Set by hand</th>
                  <th style={headStyle({ minWidth: 150 })}>Make ahead today</th>
                  <th style={headStyle({ minWidth: 110 })}>Yesterday&apos;s close</th>
                  {showSold && <th style={headStyle({ minWidth: 100 })}>Waste<div style={sub}>{isToday ? 'tonight’s count' : 'from the count'}</div></th>}
                </tr>
              </thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.shop.id} style={{ opacity: r.open ? 1 : 0.6 }}>
                    <td style={{ ...bodyStyle({ left: true, sticky: true }), padding: 0 }}>
                      <button type="button" onClick={() => openShop(r.shop.id)} style={shopBtn} aria-label={`Open ${r.shop.name}`}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontWeight: 600 }}>{r.shop.name}</span>
                          <span style={{ display: 'block', fontSize: 10.5, fontWeight: 400, color: 'var(--color-text-muted)', marginTop: 1 }}>
                            {r.shop.area} · {r.shop.breakfast ? `opens ${r.shop.opensAt}, breakfast` : `opens ${r.shop.opensAt}`}
                          </span>
                        </span>
                        <ChevronRight size={14} style={{ flexShrink: 0, color: 'var(--color-text-muted)' }} aria-hidden />
                      </button>
                    </td>
                    <td style={bodyStyle({})}>
                      <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                        <StatusPill size="xs" tone={STATUS[r.status].tone} label={STATUS[r.status].label} />
                        {r.settingsChanged && <StatusPill size="xs" tone="warning" label="Setup changed" />}
                      </span>
                    </td>
                    <td style={bodyStyle({})}>{r.plan ? <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{gbp(r.plan.demand.net)}</span> : '—'}</td>
                    {showSold && (
                      <td style={bodyStyle({})}>
                        {r.sold !== null && r.forecastSoFar !== null ? <SoldCell sold={r.sold} forecast={r.forecastSoFar} /> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                    )}
                    <td style={bodyStyle({})}>{r.plan ? <span style={numStyle}>{Math.round(r.plan.totals.batches * 2) / 2}</span> : '—'}</td>
                    <td style={bodyStyle({})}>{r.plan ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.plan.totals.fullUnits} · {r.plan.totals.halfUnits}</span> : '—'}</td>
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
                    {showSold && (
                      <td style={bodyStyle({})}>
                        {!r.open ? <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                          : r.waste ? <WasteCell waste={r.waste} />
                          : isToday ? <span style={{ color: 'var(--color-text-muted)' }}>After close</span>
                          : <StatusPill size="xs" tone="warning" label="Not counted" />}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={footStyle({ left: true, sticky: true })}>{shown.length === FJ_SHOPS.length ? 'All shops' : `${shown.length} shops`}</td>
                  <td style={footStyle()}>—</td>
                  <td style={footStyle()}><span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{gbp(shown.reduce((n, r) => n + (r.plan?.demand.net ?? 0), 0))}</span></td>
                  {showSold && <td style={footStyle()}><span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{gbp(sumSold(shown))}</span></td>}
                  <td style={footStyle()}><span style={numStyle}>{Math.round(shown.reduce((n, r) => n + (r.plan?.totals.batches ?? 0), 0))}</span></td>
                  <td style={footStyle()}><span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{shown.reduce((n, r) => n + (r.plan?.totals.fullUnits ?? 0), 0)} · {shown.reduce((n, r) => n + (r.plan?.totals.halfUnits ?? 0), 0)}</span></td>
                  <td style={footStyle()} colSpan={3}>—</td>
                  {showSold && (
                    <td style={footStyle()}>
                      {countedRows(shown) > 0
                        ? <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{gbp(sumWaste(shown))}<span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}> · {countedRows(shown)} counted</span></span>
                        : '—'}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Pounds through the till, with the miss against the forecast for the same hours. */
function SoldCell({ sold, forecast }: { sold: number; forecast: number }) {
  const pct = forecast > 0 ? Math.round(((sold - forecast) / forecast) * 100) : 0;
  const tone = Math.abs(pct) <= 5 ? 'var(--color-text-muted)' : pct > 0 ? 'var(--color-success)' : 'var(--color-warning)';
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{gbp(sold)}</span>
      <span style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums', color: tone }}>{pct === 0 ? 'on forecast' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% vs forecast`}</span>
    </span>
  );
}

/** Waste in pounds from the close count, with what was binned. */
function WasteCell({ waste }: { waste: { binnedUnits: number; wastePounds: number } }) {
  if (waste.binnedUnits <= 0 && waste.wastePounds <= 0) {
    return <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}><span style={{ fontWeight: 600, color: 'var(--color-success)' }}>£0</span><span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>nothing binned</span></span>;
  }
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-error)' }}>{gbp(waste.wastePounds)}</span>
      <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{waste.binnedUnits % 1 === 0 ? waste.binnedUnits : waste.binnedUnits.toFixed(1)} {waste.binnedUnits === 1 ? 'container' : 'containers'}</span>
    </span>
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
/** The shop cell is the way into the shop: the whole cell is the button, the chevron shows it. */
const shopBtn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', padding: '10px 8px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: 12, color: 'var(--color-text-primary)', cursor: 'pointer', fontFamily: 'var(--font-primary)' };

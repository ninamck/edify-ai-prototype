'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, Droplets, Lock, LockOpen, TrendingUp } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import QtyStepper from '@/components/Production/QtyStepper';
import StatusPill from '@/components/Production/StatusPill';
import { batchesLabel, batchesToNumber, gbp } from './cascade';
import { addDays, FJ_DEMO_TODAY, isProductionDay, isShopOpen, planningWindowFor, shortDate, weekdayLabel, type PlanningWindow } from './calendar';
import { bodyStyle, captionStrip, footStyle, footSubStyle, GROUP_ORDER, headStyle, Notice, numStyle, PillTabs } from './DayPlan';
import { computeDayPlan, useFjPlanStore, type DayPlan as DayPlanModel } from './FjPlanStore';
import { computePrepDay, type PrepLine } from './prep';
import { COMPONENTS, PRODUCT_GROUP_LABELS, SHELF_LIFE_GROUPS, WEEKDAY_LABELS, type Component, type ProductGroup } from './recipes';
import { FJ_ALL_SHOPS_ID, getShop } from './shops';

/**
 * Week plan: the twice-weekly session. Monday sets Wednesday to Sunday,
 * Friday sets Monday to Wednesday. One grid, products down, the window's
 * days across, batches in the cells. Each day's flex sits in its column
 * head; a cell opens that day's plan for the line-by-line numbers.
 * Same table chassis as the day plan.
 *
 * Dressings sit in their own block under the products, as they do on
 * ProMap's sheet. They are not sold, so the cascade sizes them from the
 * salads and bowls above: kilos used each day, and on the shop's make-on
 * days the kilos (and bottles) to make, which the GM can type over. The
 * override is the Prep list's own, so the two screens never disagree.
 */

type WindowChoice = 'this' | 'next' | 'after';

export default function WeekPlan() {
  const { isFarmerJ, productionSiteId } = useActiveSite();
  const shopId = productionSiteId ?? FJ_ALL_SHOPS_ID;
  if (!isFarmerJ) return <Notice>Switch the Brand pill in demo controls to Farmer J to see this screen.</Notice>;
  if (shopId === FJ_ALL_SHOPS_ID) return <Notice>Pick a shop in the site switcher to see its week plan.</Notice>;
  return <WeekPlanForShop shopId={shopId} />;
}

function windows(): Record<WindowChoice, PlanningWindow> {
  const w1 = planningWindowFor(FJ_DEMO_TODAY);
  const w2 = planningWindowFor(addDays(w1.to, 1));
  const w3 = planningWindowFor(addDays(w2.to, 1));
  return { this: w1, next: w2, after: w3 };
}

function WeekPlanForShop({ shopId }: { shopId: string }) {
  const router = useRouter();
  const store = useFjPlanStore();
  const shop = getShop(shopId);
  const [choice, setChoice] = useState<WindowChoice>('this');
  const wins = useMemo(() => windows(), []);
  const window = wins[choice];

  const days = useMemo(
    () => window.days.filter(d => isShopOpen(shopId, d)).map(d => ({
      date: d,
      plan: computeDayPlan(shopId, d, store.get(shopId, d), store.get(shopId, addDays(d, -1)).close),
    })),
    [shopId, window, store],
  );

  const rows = useMemo(() => {
    const byProduct = new Map<string, { name: string; group: ProductGroup; cells: Record<string, DayPlanModel['plans'][number] | undefined> }>();
    for (const { date, plan } of days) {
      for (const p of plan.plans) {
        const e = byProduct.get(p.productId) ?? { name: p.product.name, group: p.product.group, cells: {} };
        e.cells[date] = p;
        byProduct.set(p.productId, e);
      }
    }
    return GROUP_ORDER.map(g => ({
      group: g,
      rows: Array.from(byProduct.entries()).filter(([, r]) => r.group === g).map(([id, r]) => ({ id, ...r })),
    })).filter(g => g.rows.length > 0);
  }, [days]);

  // Dressings: usage from each day's explosion, the make from the Prep
  // list on make-on days. The Prep list is computed once per day here.
  const dressings = useMemo(() => {
    const prepByDay = new Map<string, PrepLine[]>();
    const prepFor = (d: string) => {
      if (!prepByDay.has(d)) prepByDay.set(d, computePrepDay(shopId, d, store.get).lines);
      return prepByDay.get(d)!;
    };
    const list = Object.values(COMPONENTS).filter(c => c.kind === 'dressing');
    const rows = list.map(c => {
      const cells: Record<string, DressingCell> = {};
      for (const { date, plan } of days) {
        const usedKg = (plan.explosion.components[c.id]?.netGrams ?? 0) / 1000;
        const makeOn = isProductionDay(shopId, c.shelfLife, date);
        const line = makeOn ? prepFor(date).find(l => l.componentId === c.id) : undefined;
        cells[date] = { usedKg, makeOn, line };
      }
      return { component: c, cells };
    }).filter(r => Object.values(r.cells).some(x => x.usedKg > 0 || x.line));
    rows.sort((a, b) => a.component.name.localeCompare(b.component.name));
    return rows;
  }, [days, shopId, store]);

  const setPrepQty = (date: string, componentId: string, qty: number | undefined) =>
    store.update(shopId, date, r => {
      const prepOverrides = { ...(r.prepOverrides ?? {}) };
      if (qty === undefined) delete prepOverrides[componentId];
      else prepOverrides[componentId] = qty;
      return { ...r, prepOverrides };
    });

  const approvedDays = days.filter(d => d.plan.approved);
  const allApproved = days.length > 0 && approvedDays.length === days.length;
  const handSet = days.reduce((n, d) => n + d.plan.overriddenCount, 0);
  const isPastWindow = window.to < FJ_DEMO_TODAY;

  const approveAll = () => {
    const at = new Date().toISOString();
    for (const d of days) store.update(shopId, d.date, r => ({ ...r, approvedAtISO: at, approvedBy: `${shop?.name} GM` }));
  };
  const reopenAll = () => {
    for (const d of days) store.update(shopId, d.date, r => ({ ...r, approvedAtISO: undefined, approvedBy: undefined }));
  };
  const setFlex = (date: string, pct: number) => store.update(shopId, date, r => ({ ...r, flexPct: pct }));
  const open = (date: string) => router.push(`/production/day?date=${date}`);

  const label = (w: PlanningWindow) => `${weekdayLabel(w.from)} ${Number(w.from.slice(8, 10))} to ${weekdayLabel(w.to)} ${Number(w.to.slice(8, 10))}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)' }}>
      <div style={{ ...captionStrip, gap: 12 }}>
        <PillTabs
          ariaLabel="Planning window"
          tabs={[
            { id: 'this' as WindowChoice, label: label(wins.this) },
            { id: 'next' as WindowChoice, label: label(wins.next) },
            { id: 'after' as WindowChoice, label: label(wins.after) },
          ]}
          value={choice}
          onChange={setChoice}
        />
        <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>Set {shortDate(window.setOn)}</span>
        <span>· {approvedDays.length} of {days.length} days approved</span>
        {handSet > 0 && <span>· {handSet} {handSet === 1 ? 'line' : 'lines'} set by hand</span>}
      </div>

      {!isPastWindow && (
        allApproved ? (
          <div style={confirmedBanner}>
            <Lock size={14} color="var(--color-text-muted)" />
            <span style={bannerTitle}>{label(window)} is approved and in the kitchen.</span>
            <button type="button" onClick={reopenAll} style={reopenButton}>
              <LockOpen size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Reopen the window
            </button>
          </div>
        ) : (
          <div style={draftBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={draftIcon}><ClipboardCheck size={16} /></div>
              <span style={bannerTitle}>Approve {label(window)}</span>
            </div>
            <button type="button" onClick={approveAll} style={primaryButton}>Approve {days.length} days</button>
          </div>
        )
      )}

      <div style={{ padding: '16px 30px 32px' }}>
        <div style={{ background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={headStyle({ left: true, sticky: true, minWidth: 220 })}>Product<div style={headSub}>batches</div></th>
                  {days.map(({ date, plan }) => {
                    const today = date === FJ_DEMO_TODAY;
                    const past = date < FJ_DEMO_TODAY;
                    return (
                      <th key={date} style={{ ...headStyle({ minWidth: 132 }), padding: '8px 8px 10px' }}>
                        <button type="button" onClick={() => open(date)} style={dayHead} title={`Open ${weekdayLabel(date)}'s plan`}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: today ? 'var(--color-accent-active)' : 'var(--color-text-primary)', letterSpacing: 0, textTransform: 'none' }}>
                            {today ? 'Today' : weekdayLabel(date)} {Number(date.slice(8, 10))}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: 0, textTransform: 'none', fontVariantNumeric: 'tabular-nums' }}>
                            {gbp(plan.demand.net)} · {Math.round(plan.demand.trays)} trays
                          </span>
                        </button>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 6 }}>
                          <StatusPill size="xs" tone={plan.approved ? 'success' : 'neutral'} label={plan.approved ? 'Approved' : 'Draft'} />
                          {plan.activeOrders.length > 0 && <StatusPill size="xs" tone="info" label={`${plan.activeOrders.length} catering`} />}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
                          <div title="Flex the whole day" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 4px 0 8px', height: 26, borderRadius: 100, border: `1px solid ${plan.record.flexPct !== 0 ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`, background: '#fff' }}>
                            <TrendingUp size={11} style={{ color: plan.record.flexPct !== 0 ? 'var(--color-accent-active)' : 'var(--color-text-muted)' }} />
                            <QtyStepper
                              size="compact"
                              chromeless
                              disabled={plan.approved || past}
                              onDecrement={() => setFlex(date, Math.max(-50, plan.record.flexPct - 5))}
                              onIncrement={() => setFlex(date, Math.min(50, plan.record.flexPct + 5))}
                              decrementLabel={`${weekdayLabel(date)} down 5%`}
                              incrementLabel={`${weekdayLabel(date)} up 5%`}
                            >
                              <span style={{ minWidth: 34, textAlign: 'center', fontSize: 11, fontWeight: 700, color: plan.record.flexPct !== 0 ? 'var(--color-accent-active)' : 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums', letterSpacing: 0 }}>
                                {plan.record.flexPct > 0 ? '+' : ''}{plan.record.flexPct}%
                              </span>
                            </QtyStepper>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                  <th style={headStyle({ minWidth: 88, totalCol: true })}>Window<div style={headSub}>batches</div></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ group, rows: list }) => [
                  <tr key={`g-${group}`}>
                    <td colSpan={days.length + 2} style={groupRow}>{PRODUCT_GROUP_LABELS[group]}</td>
                  </tr>,
                  ...list.map(r => {
                    const total = days.reduce((n, d) => n + (r.cells[d.date] ? batchesToNumber(r.cells[d.date]!.batches) : 0), 0);
                    return (
                      <tr key={r.id}>
                        <td style={bodyStyle({ left: true, sticky: true })}>
                          <span style={{ fontWeight: 600 }}>{r.name}</span>
                        </td>
                        {days.map(d => {
                          const cell = r.cells[d.date];
                          if (!cell || batchesToNumber(cell.batches) === 0) return <td key={d.date} style={{ ...bodyStyle({}), color: 'var(--color-text-muted)' }}>—</td>;
                          const n = batchesToNumber(cell.batches);
                          const suggested = batchesToNumber(cell.batchesSuggested);
                          return (
                            <td key={d.date} style={bodyStyle({})}>
                              <button type="button" onClick={() => open(d.date)} style={cellBtn} title={`${cell.product.name}, ${weekdayLabel(d.date)}: ${batchesLabel(cell.batches)}${cell.overridden ? `, set by hand (Edify ${batchesLabel(cell.batchesSuggested)})` : ''}`}>
                                <span style={{ ...numStyle, fontSize: 13 }}>{fmtBatches(n)}</span>
                                {cell.overridden && (
                                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)', textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>{fmtBatches(suggested)}</span>
                                )}
                                {cell.overridden && <span aria-label="Set by hand" style={dot} />}
                              </button>
                            </td>
                          );
                        })}
                        <td style={bodyStyle({ totalCol: true })}><span style={numStyle}>{fmtBatches(total)}</span></td>
                      </tr>
                    );
                  }),
                ])}
              </tbody>
              <tfoot>
                <tr>
                  <td style={footStyle({ left: true, sticky: true })}>Total to make</td>
                  {days.map(d => <td key={d.date} style={footStyle()}><span style={numStyle}>{fmtBatches(d.plan.totals.batches)}</span></td>)}
                  <td style={footStyle({ totalCol: true })}><span style={numStyle}>{fmtBatches(days.reduce((n, d) => n + d.plan.totals.batches, 0))}</span></td>
                </tr>
                <tr>
                  <td style={footSubStyle({ left: true, sticky: true })}>Main line · second line</td>
                  {days.map(d => <td key={d.date} style={footSubStyle()}><span style={{ fontVariantNumeric: 'tabular-nums' }}>{d.plan.totals.fullUnits} · {d.plan.totals.halfUnits}</span></td>)}
                  <td style={footSubStyle({ totalCol: true })}><span style={{ fontVariantNumeric: 'tabular-nums' }}>{days.reduce((n, d) => n + d.plan.totals.fullUnits, 0)} · {days.reduce((n, d) => n + d.plan.totals.halfUnits, 0)}</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {dressings.length > 0 && (
          <DressingsBlock
            days={days.map(d => ({ date: d.date, approved: d.plan.approved }))}
            rows={dressings}
            shopId={shopId}
            onQty={setPrepQty}
            onOpen={(date) => router.push(`/production/prep-list?date=${date}`)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Dressings ────────────────────────────────────────────────────────────────

type DressingCell = { usedKg: number; makeOn: boolean; line?: PrepLine };
type DressingRow = { component: Component; cells: Record<string, DressingCell> };

function DressingsBlock({ days, rows, shopId, onQty, onOpen }: {
  days: { date: string; approved: boolean }[];
  rows: DressingRow[];
  shopId: string;
  onQty: (date: string, componentId: string, qty: number | undefined) => void;
  onOpen: (date: string) => void;
}) {
  const madeKg = (r: DressingRow) => days.reduce((n, d) => n + (r.cells[d.date].line?.gramsMade ?? 0), 0) / 1000;
  const usedKg = (r: DressingRow) => days.reduce((n, d) => n + r.cells[d.date].usedKg, 0);
  const bottles = (r: DressingRow) => days.reduce((n, d) => n + (r.cells[d.date].line?.containers?.count ?? 0), 0);
  const groupsHere = Array.from(new Set(rows.map(r => r.component.shelfLife)));
  return (
    <div style={{ marginTop: 16, background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <Droplets size={15} color="var(--color-text-secondary)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>Dressings</span>
        <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
          Kilos the plan above uses each day. Made by the kilo and bottled on the shop&rsquo;s make-on days
          {groupsHere.length > 0 && `: ${groupsHere.map(g => `${SHELF_LIFE_GROUPS[g].short} on ${weekDays(shopId, g)}`).join(', ')}`}. Type over a make and the Prep list follows.
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={headStyle({ left: true, sticky: true, minWidth: 220 })}>Dressing<div style={headSub}>kg to make · kg used</div></th>
              {days.map(d => (
                <th key={d.date} style={headStyle({ minWidth: 132 })}>
                  {d.date === FJ_DEMO_TODAY ? 'Today' : weekdayLabel(d.date)} {Number(d.date.slice(8, 10))}
                </th>
              ))}
              <th style={headStyle({ minWidth: 96, totalCol: true })}>Window<div style={headSub}>kg made</div></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.component.id}>
                <td style={bodyStyle({ left: true, sticky: true })}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: SHELF_LIFE_GROUPS[r.component.shelfLife].colour, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{r.component.name}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 1, paddingLeft: 15 }}>{SHELF_LIFE_GROUPS[r.component.shelfLife].label} · 1 kg a bottle</div>
                </td>
                {days.map(d => {
                  const cell = r.cells[d.date];
                  if (cell.line) {
                    const l = cell.line;
                    const covers = l.covers.length > 1 ? `covers ${weekdayLabel(l.covers[0])} to ${weekdayLabel(l.covers[l.covers.length - 1])}` : 'covers the day';
                    return (
                      <td key={d.date} style={{ ...bodyStyle({}), background: 'var(--color-bg-surface)' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <QtyStepper
                            size="compact"
                            disabled={d.approved || d.date < FJ_DEMO_TODAY}
                            canDecrement={l.plannedQty > l.unit.min}
                            onDecrement={() => onQty(d.date, r.component.id, Math.max(l.unit.min, l.plannedQty - l.unit.step))}
                            onIncrement={() => onQty(d.date, r.component.id, l.unit.max ? Math.min(l.unit.max, l.plannedQty + l.unit.step) : l.plannedQty + l.unit.step)}
                            decrementLabel={`One kilo less ${r.component.name}, ${weekdayLabel(d.date)}`}
                            incrementLabel={`One kilo more ${r.component.name}, ${weekdayLabel(d.date)}`}
                          >
                            <span style={{ minWidth: 44, textAlign: 'center', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: l.overridden ? 'var(--color-accent-active)' : 'var(--color-text-primary)' }}>{fmtKg(l.plannedQty)} kg</span>
                          </QtyStepper>
                          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                            {l.containers ? `${l.containers.count} ${l.containers.count === 1 ? 'bottle' : 'bottles'} · ` : ''}{covers}
                            {l.overridden && ' · '}
                            {l.overridden && (
                              <button type="button" onClick={() => onQty(d.date, r.component.id, undefined)} style={linkBtn} title={`Back to Edify's ${fmtKg(l.suggestedQty)} kg`}>Edify {fmtKg(l.suggestedQty)}</button>
                            )}
                          </span>
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={d.date} style={bodyStyle({})}>
                      {cell.usedKg > 0 ? (
                        <button type="button" onClick={() => onOpen(d.date)} style={cellBtn} title={`${r.component.name}, ${weekdayLabel(d.date)}: ${fmtKg(cell.usedKg)} kg used by the plan`}>
                          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmtKg(cell.usedKg)} kg</span>
                          <span style={{ fontSize: 9.5, color: 'var(--color-text-muted)' }}>used</span>
                        </button>
                      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                  );
                })}
                <td style={bodyStyle({ totalCol: true })}>
                  <span style={numStyle}>{fmtKg(madeKg(r))} kg</span>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {fmtKg(usedKg(r))} kg used{bottles(r) > 0 && ` · ${bottles(r)} ${bottles(r) === 1 ? 'bottle' : 'bottles'}`}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={footStyle({ left: true, sticky: true })}>Dressings to make</td>
              {days.map(d => {
                const kgDay = rows.reduce((n, r) => n + (r.cells[d.date].line?.gramsMade ?? 0), 0) / 1000;
                const btl = rows.reduce((n, r) => n + (r.cells[d.date].line?.containers?.count ?? 0), 0);
                return <td key={d.date} style={footStyle()}>{kgDay > 0 ? <><span style={numStyle}>{fmtKg(kgDay)} kg</span><div style={{ fontSize: 10, fontWeight: 400, color: 'var(--color-text-muted)' }}>{btl} bottles</div></> : <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>no make</span>}</td>;
              })}
              <td style={footStyle({ totalCol: true })}><span style={numStyle}>{fmtKg(rows.reduce((n, r) => n + madeKg(r), 0))} kg</span></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** "Mon, Wed and Fri" for a group at this shop. */
function weekDays(shopId: string, group: Component['shelfLife']): string {
  const days = ([0, 1, 2, 3, 4, 5, 6] as const).filter(wd => isProductionDay(shopId, group, dateForWeekday(wd))).map(wd => WEEKDAY_LABELS[wd]);
  if (days.length === 0) return 'no set day';
  if (days.length === 1) return days[0];
  return `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
}

/** Any date falling on the given weekday (0 = Monday), for weekday-only checks. */
function dateForWeekday(wd: number): string {
  const base = planningWindowFor(FJ_DEMO_TODAY).from; // a Monday or a Wednesday
  const baseWd = (new Date(`${base}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(base, wd - baseWd);
}

function fmtKg(n: number): string {
  const r = Math.round(n * 2) / 2;
  return r % 1 === 0 ? String(r) : r.toFixed(1);
}

function fmtBatches(n: number): string {
  const r = Math.round(n * 2) / 2;
  if (r % 1 === 0) return String(r);
  return `${Math.floor(r) || ''}½`;
}

const headSub: CSSProperties = { fontSize: 8, fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.04em', marginTop: 2 };
const dayHead: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-primary)', width: '100%' };
const groupRow: CSSProperties = { padding: '8px 8px 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)', position: 'sticky', left: 0 };
const cellBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, fontFamily: 'var(--font-primary)' };
const dot: CSSProperties = { width: 6, height: 6, borderRadius: 999, background: 'var(--color-accent-active)', display: 'inline-block' };
const linkBtn: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--color-info)', cursor: 'pointer', textDecoration: 'underline' };

const bannerTitle: CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' };
const confirmedBanner: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 30px', background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)' };
const draftBar: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 30px', background: 'var(--color-info-light)', borderBottom: '1px solid var(--color-border-subtle)' };
const draftIcon: CSSProperties = { width: 30, height: 30, borderRadius: 8, background: '#fff', border: '1px solid var(--color-border-subtle)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-active)' };
const reopenButton: CSSProperties = { marginLeft: 'auto', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-primary)', color: 'var(--color-text-secondary)' };
const primaryButton: CSSProperties = { background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', border: '1px solid var(--color-accent-active)', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-primary)' };

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Calculator, CheckCircle2, ChevronRight, ClipboardCheck, GitBranch, Lock, LockOpen, Package, RotateCcw, Store, TrendingUp, X } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import QtyStepper from '@/components/Production/QtyStepper';
import StatusPill from '@/components/Production/StatusPill';
import { batchesLabel, batchesToNumber, gbp, kg, mainUnitsOf, portionsOf, portionsPerMainUnit, portionsPerSecondUnit, type ProductPlan } from './cascade';
import { boxesLabel, lineGrams, lineLabel, orderBoxesLabel, orderGramsFor, type CateringOrder } from './catering';
import { addDays, FJ_DEMO_TODAY, longDate, shortDate, weekdayLabel } from './calendar';
import { computeDayPlan, useFjDayPlan, useFjPlanStore, useWindowApproval, type DayPlan as DayPlanModel } from './FjPlanStore';
import { COMPONENTS, INGREDIENTS, PRODUCT_BY_ID, PRODUCT_GROUP_LABELS, type ProductGroup } from './recipes';
import { daySales, fohReminders } from './sales';
import { FJ_ALL_SHOPS_ID, getShop } from './shops';

const GROUP_ORDER: ProductGroup[] = ['breakfast', 'bases', 'proteins', 'hot-sides', 'salads'];
type GroupFilter = 'all' | ProductGroup;

/**
 * Farmer J day plan on the same chassis as the Pret Plan surface: day
 * strip, caption, confirm bar, filter toolbar, "total to make" card,
 * recipe-first table with a stepper and a faded `fc` under every number,
 * and a focus panel per row.
 *
 * What changes for Farmer J is what the numbers mean. Rows are finished
 * sellable products only. The two editable columns are the main line (cast
 * irons) and the second make line (gastronorms), catering orders get a
 * column each, and the row total is batches.
 */
export default function DayPlan() {
  const { isFarmerJ, productionSiteId } = useActiveSite();
  const [date, setDate] = useState(FJ_DEMO_TODAY);
  const shopId = productionSiteId ?? FJ_ALL_SHOPS_ID;

  if (!isFarmerJ) return <Notice>Switch the Brand pill in demo controls to Farmer J to see this screen.</Notice>;
  if (shopId === FJ_ALL_SHOPS_ID) {
    return <Notice>Pick a shop in the site switcher to see its day plan. The all-shops view is Jana&apos;s board, on the Plan side under Shops.</Notice>;
  }
  return <DayPlanForShop shopId={shopId} date={date} onDateChange={setDate} />;
}

function DayPlanForShop({ shopId, date, onDateChange }: { shopId: string; date: string; onDateChange: (d: string) => void }) {
  const shop = getShop(shopId);
  const { plan, setOverride, clearOverride, setFlex, toggleOrder, toggleReferenceDay, approve, reopen } = useFjDayPlan(shopId, date);
  const approval = useWindowApproval(shopId, date);
  const [focused, setFocused] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [justCancelled, setJustCancelled] = useState<string | null>(null);
  const [cateringOpen, setCateringOpen] = useState(false);

  useEffect(() => {
    if (!justCancelled) return;
    const t = window.setTimeout(() => setJustCancelled(null), 8000);
    return () => window.clearTimeout(t);
  }, [justCancelled]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setFocused(null);
      setCateringOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<ProductGroup, ProductPlan[]>();
    for (const p of plan.plans) {
      if (groupFilter !== 'all' && p.product.group !== groupFilter) continue;
      const g = p.product.group;
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(p);
    }
    return GROUP_ORDER.filter(g => m.has(g)).map(g => ({ group: g, rows: m.get(g)! }));
  }, [plan.plans, groupFilter]);

  const groupsPresent = useMemo(() => GROUP_ORDER.filter(g => plan.plans.some(p => p.product.group === g)), [plan.plans]);
  const closed = plan.demand.net === 0 && plan.activeOrders.length === 0;
  const isToday = date === FJ_DEMO_TODAY;
  const isPast = date < FJ_DEMO_TODAY;
  const dayName = longDate(date).split(' ')[0];
  const locked = plan.approved;
  const cancelledOrder = plan.orders.find(o => o.id === justCancelled);
  const focusedPlan = focused ? plan.plans.find(p => p.productId === focused) : undefined;
  const strip = [addDays(plan.window.days[0], -1), ...plan.window.days];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)' }}>
      <FjDayStrip shopId={shopId} dates={strip} selectedDate={date} onSelect={d => { onDateChange(d); setFocused(null); }} />

      {/* Selected day caption, with the reference days on the right so the
          GM sees what the draft was averaged from without leaving the row. */}
      <div style={captionStrip}>
        <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>{isToday ? 'Planning today' : `Planning ${weekdayLabel(date)} ${date}`}</span>
        <span>· {plan.window.label.replace(/\.$/, '')}</span>
        {isPast && <span>· historical view</span>}
        {!closed && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <EdifyMark size={10} color="var(--color-text-muted)" /> Drafted from the last four {dayName}s
            </span>
            {plan.referenceDays.map(r => (
              <button
                key={r.date}
                type="button"
                onClick={() => toggleReferenceDay(r.date)}
                aria-pressed={r.included}
                title={r.anomaly ? `${r.anomaly.reason}. ${r.included ? 'Tap to leave out.' : 'Left out. Tap to include.'}` : r.included ? 'In the average. Tap to leave out.' : 'Left out. Tap to include.'}
                style={{
                  ...refChip,
                  color: r.included ? (r.anomaly ? 'var(--color-warning)' : 'var(--color-text-secondary)') : 'var(--color-text-muted)',
                  borderColor: r.included ? (r.anomaly ? 'var(--color-warning)' : 'var(--color-border)') : 'var(--color-border-subtle)',
                  textDecoration: r.included ? 'none' : 'line-through',
                }}
              >
                {shortDate(r.date)}
                {r.anomaly ? ` · ${r.anomaly.reason.split(' ')[0].toLowerCase()}` : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {closed ? (
        <div style={{ padding: '32px 30px', fontSize: 12, color: 'var(--color-text-muted)' }}>
          {shop?.name} is closed on {longDate(date)}. Nothing to plan.
        </div>
      ) : (
        <>
          <FjApproveBar
            plan={plan}
            approval={approval}
            isToday={isToday}
            isPast={isPast}
            onApproveWindow={() => approve(`${shop?.name} GM`, approval.window.days)}
            onApproveDay={() => approve(`${shop?.name} GM`)}
            onReopen={reopen}
          />

          <div style={{ padding: '16px 30px 32px' }}>
            {/* Toolbar: group filter left, whole-day flex right. */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
              <PillTabs
                ariaLabel="Product group filter"
                tabs={[{ id: 'all' as GroupFilter, label: 'All' }, ...groupsPresent.map(g => ({ id: g as GroupFilter, label: PRODUCT_GROUP_LABELS[g] }))]}
                value={groupFilter}
                onChange={setGroupFilter}
              />
              <div style={{ flex: 1 }} />
              <FlexPill pct={plan.record.flexPct} onChange={setFlex} locked={locked} handCount={plan.overriddenCount} />
            </div>

            <TotalCard plan={plan} />

            {cancelledOrder && (
              <div style={undoStrip}>
                <span>
                  <strong>{cancelledOrder.customer}</strong> cancelled.
                </span>
                <button type="button" style={linkButton} onClick={() => { toggleOrder(cancelledOrder.id); setJustCancelled(null); }}>
                  Undo
                </button>
              </div>
            )}

            <div style={{ background: '#ffffff', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 760, borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th style={headStyle({ left: true, sticky: true, minWidth: 240 })}>Product</th>
                      <th style={headStyle({ minWidth: 96 })}>
                        Sold · ref days
                        <HeadSub>portions</HeadSub>
                      </th>
                      <th style={headStyle({ minWidth: 72 })}>
                        Carry-over
                        <HeadSub>main-line containers</HeadSub>
                      </th>
                      <th style={headStyle({ minWidth: 128 })}>
                        Main line
                        <HeadSub>containers</HeadSub>
                      </th>
                      <th style={headStyle({ minWidth: 118 })}>
                        Second make line
                        <HeadSub>small containers</HeadSub>
                      </th>
                      {plan.orders.length > 0 && (
                        <th style={headStyle({ minWidth: 124 })}>
                          Catering
                          <HeadSub>small containers · boxes ordered</HeadSub>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                            <StatusPill
                              tone={plan.activeOrders.length > 0 ? 'info' : 'neutral'}
                              size="xs"
                              label={plan.activeOrders.length > 0 ? `${plan.activeOrders.length} ${plan.activeOrders.length === 1 ? 'order' : 'orders'}` : 'none today'}
                            />
                            <button type="button" onClick={() => setCateringOpen(true)} style={cancelPill} title="See and cancel catering orders">
                              Manage
                            </button>
                          </div>
                        </th>
                      )}
                      <th style={headStyle({ minWidth: 104, totalCol: true })}>Batches</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.map(({ group, rows }) => (
                      <GroupRows
                        key={group}
                        label={PRODUCT_GROUP_LABELS[group]}
                        rows={rows}
                        orders={plan.activeOrders}
                        showCatering={plan.orders.length > 0}
                        colCount={6 + (plan.orders.length > 0 ? 1 : 0)}
                        focused={focused}
                        locked={locked}
                        onSelect={setFocused}
                        onOverride={setOverride}
                        onClear={clearOverride}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={footStyle({ left: true, sticky: true })}>Total to make</td>
                      <td style={footStyle()}><span style={numStyle}>{Math.round(plan.plans.reduce((n, p) => n + p.referencePortions, 0)).toLocaleString('en-GB')}</span></td>
                      <td style={footStyle()}>
                        {plan.plans.some(p => p.carriedGrams > 0) ? <span style={numStyle}>−{plan.plans.reduce((n, p) => n + mainUnitsOf(p.product, p.carriedGrams), 0)}</span> : <span style={{ color: 'var(--color-text-muted)' }}>0</span>}
                      </td>
                      <td style={footStyle()}><span style={numStyle}>{plan.totals.mainUnits}</span></td>
                      <td style={footStyle()}><span style={numStyle}>{plan.totals.secondUnits}</span></td>
                      {plan.orders.length > 0 && (
                        <td style={footStyle()}>
                          <span style={numStyle}>{plan.activeOrders.length ? plan.plans.reduce((n, p) => n + Math.ceil(p.cateringGrams / p.second.gramsPerUnit), 0) : '—'}</span>
                        </td>
                      )}
                      <td style={footStyle({ totalCol: true })}><span style={numStyle}>{Math.round(plan.totals.batches * 2) / 2}</span></td>
                    </tr>
                    <tr>
                      <td style={footSubStyle({ left: true, sticky: true })}>Sales · ref days</td>
                      <td style={footSubStyle()}><span style={moneyStyle}>{gbp(plan.demand.net)}</span></td>
                      <td style={footSubStyle()}>—</td>
                      <td style={footSubStyle()}><span style={moneyStyle}>{gbp(plan.demand.net * (1 - secondShare(plan)))}</span></td>
                      <td style={footSubStyle()}><span style={moneyStyle}>{gbp(plan.demand.net * secondShare(plan))}</span></td>
                      {plan.orders.length > 0 && <td style={footSubStyle()}>—</td>}
                      <td style={footSubStyle({ totalCol: true })}>—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <FohCard shopId={shopId} date={date} isToday={isToday} />
          </div>
        </>
      )}

      {focusedPlan && <FjFocusPanel plan={focusedPlan} day={plan} onClose={() => setFocused(null)} />}
      {cateringOpen && (
        <CateringPanel
          plan={plan}
          locked={locked}
          onToggle={id => { toggleOrder(id); setJustCancelled(plan.record.cancelledOrders.includes(id) ? null : id); }}
          onClose={() => setCateringOpen(false)}
        />
      )}
    </div>
  );
}

function secondShare(plan: DayPlanModel): number {
  const d = plan.demand;
  return d.net > 0 ? (d.netByChannel.deliveroo + d.netByChannel.clickcollect) / d.net : 0;
}

// ─── Day strip ────────────────────────────────────────────────────────────────

function FjDayStrip({ shopId, dates, selectedDate, onSelect }: { shopId: string; dates: string[]; selectedDate: string; onSelect: (d: string) => void }) {
  return (
    <div role="tablist" aria-label="Select day" style={{ display: 'flex', gap: 8, alignItems: 'stretch', padding: '12px 30px', background: '#ffffff', borderBottom: '1px solid var(--color-border-subtle)', overflowX: 'auto' }}>
      {dates.map(d => (
        <FjDayCard key={d} shopId={shopId} date={d} selected={d === selectedDate} onSelect={() => onSelect(d)} />
      ))}
    </div>
  );
}

function FjDayCard({ shopId, date, selected, onSelect }: { shopId: string; date: string; selected: boolean; onSelect: () => void }) {
  const store = useFjPlanStore();
  const record = store.get(shopId, date);
  const yesterday = store.get(shopId, addDays(date, -1));
  const plan = useMemo(() => computeDayPlan(shopId, date, record, yesterday.close), [shopId, date, record, yesterday.close]);
  const isToday = date === FJ_DEMO_TODAY;
  const isPast = date < FJ_DEMO_TODAY;
  const closed = plan.demand.net === 0 && plan.activeOrders.length === 0;
  const batches = Math.round(plan.totals.batches * 2) / 2;
  const borderColor = selected ? 'var(--color-accent-active)' : isToday ? 'var(--color-border)' : 'var(--color-border-subtle)';
  return (
    <button
      role="tab"
      aria-selected={selected}
      type="button"
      onClick={onSelect}
      title={`${weekdayLabel(date)} ${date}${isToday ? ' (today)' : ''} · ${closed ? 'closed' : `${batches} batches`}`}
      style={{
        flex: '0 0 auto',
        minWidth: 96,
        padding: '10px 12px',
        borderRadius: 10,
        border: `1px solid ${borderColor}`,
        background: selected ? 'var(--color-accent-active)' : '#ffffff',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        fontFamily: 'var(--font-primary)',
        textAlign: 'left',
        opacity: isPast && !selected ? 0.85 : 1,
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: selected ? '#fff' : isPast ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}>
        {isToday ? 'Today' : weekdayLabel(date)}
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color: selected ? '#fff' : 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{date.slice(8, 10)}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: selected ? 'rgba(255,255,255,0.85)' : 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {closed ? 'closed' : `${batches} batches`}
        {plan.approved && <CheckCircle2 size={10} color={selected ? '#fff' : 'var(--color-success)'} aria-label="approved" />}
      </span>
    </button>
  );
}

// ─── Approve bar (mirrors PlanConfirmBar) ─────────────────────────────────────

function FjApproveBar({
  plan,
  approval,
  isToday,
  isPast,
  onApproveWindow,
  onApproveDay,
  onReopen,
}: {
  plan: DayPlanModel;
  approval: ReturnType<typeof useWindowApproval>;
  isToday: boolean;
  isPast: boolean;
  onApproveWindow: () => void;
  onApproveDay: () => void;
  onReopen: () => void;
}) {
  const w = approval.window;
  const from = weekdayLabel(w.from);
  const to = weekdayLabel(w.to);
  const dayWord = isToday ? "today's" : `${weekdayLabel(plan.date)}'s`;
  if (isPast) return null;

  if (plan.approved) {
    const at = plan.record.approvedAtISO ? new Date(plan.record.approvedAtISO).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      <div style={confirmedBanner}>
        <Lock size={14} color="var(--color-text-muted)" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={bannerTitle}>{isToday ? 'Today\u2019s plan is approved and in the kitchen.' : `${weekdayLabel(plan.date)}\u2019s plan is approved.`}</span>
          <span style={bannerSub}>
            Approved {at}{plan.record.approvedBy ? ` by ${plan.record.approvedBy}` : ''} · {approval.approvedDays.length} of {w.days.length} days in this window approved.
          </span>
        </div>
        <button type="button" onClick={onReopen} style={reopenButton}>
          <LockOpen size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          Reopen to edit
        </button>
      </div>
    );
  }

  return (
    <div style={draftBar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={draftIcon}>
          <ClipboardCheck size={16} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={bannerTitle}>Approve {dayWord} plan</span>
          {(plan.overriddenCount > 0 || approval.approvedDays.length > 0) && (
            <span style={bannerSub}>
              {[
                plan.overriddenCount > 0 ? `${plan.overriddenCount} ${plan.overriddenCount === 1 ? 'line' : 'lines'} set by hand` : null,
                approval.approvedDays.length > 0 ? `${approval.approvedDays.length} of ${w.days.length} days in this window approved` : null,
              ].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button type="button" onClick={onApproveDay} style={secondaryButton}>Approve {isToday ? 'today' : weekdayLabel(plan.date)} only</button>
        <button type="button" onClick={onApproveWindow} style={primaryButton}>
          <ClipboardCheck size={14} /> Approve {from} to {to}
        </button>
      </div>
    </div>
  );
}

// ─── Toolbar pieces ───────────────────────────────────────────────────────────

function PillTabs<T extends string>({ tabs, value, onChange, ariaLabel }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} style={{ display: 'flex', background: 'var(--color-bg-hover)', borderRadius: 100, padding: 3, width: 'fit-content' }}>
      {tabs.map(t => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            style={{ padding: '8px 14px', borderRadius: 100, border: 'none', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer', background: active ? 'var(--color-accent-active)' : 'transparent', color: active ? '#fff' : 'var(--color-text-secondary)', transition: 'all 0.15s' }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function FlexPill({ pct, onChange, locked, handCount }: { pct: number; onChange: (n: number) => void; locked: boolean; handCount: number }) {
  return (
    <div
      title={`Flex the whole day up or down in 5% steps. Applies to lines still on Edify's number; ${handCount === 0 ? 'no lines are' : `${handCount} ${handCount === 1 ? 'line is' : 'lines are'}`} set by hand and left alone.`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 38, padding: '0 6px 0 14px', background: '#ffffff', border: `1px solid ${pct !== 0 ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`, borderRadius: 100, fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}
    >
      <TrendingUp size={13} style={{ color: pct !== 0 ? 'var(--color-accent-active)' : 'var(--color-text-muted)' }} />
      <span>Whole day</span>
      <QtyStepper
        size="compact"
        chromeless
        disabled={locked}
        onDecrement={() => onChange(Math.max(-50, pct - 5))}
        onIncrement={() => onChange(Math.min(50, pct + 5))}
        decrementLabel="Take 5% off the day"
        incrementLabel="Add 5% to the day"
      >
        <span style={{ minWidth: 44, textAlign: 'center', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: pct !== 0 ? 'var(--color-accent-active)' : 'var(--color-text-primary)' }}>
          {pct > 0 ? '+' : ''}{pct}%
        </span>
      </QtyStepper>
    </div>
  );
}

function TotalCard({ plan }: { plan: DayPlanModel }) {
  const d = plan.demand;
  const products = plan.plans.length;
  const parts = [
    d.netByDayPart.breakfast > 0 ? `${gbp(d.netByDayPart.breakfast)} breakfast` : null,
    `${gbp(d.netByDayPart.lunch)} lunch`,
    d.netByDayPart.dinner > 0 ? `${gbp(d.netByDayPart.dinner)} dinner` : null,
  ].filter(Boolean);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 10, background: '#ffffff', border: '1px solid var(--color-border-subtle)', borderLeft: '3px solid var(--color-info)', borderRadius: 'var(--radius-card)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--color-info-light)', color: 'var(--color-info)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Package size={18} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total to make {plan.date === FJ_DEMO_TODAY ? 'today' : weekdayLabel(plan.date)}</span>
        <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{Math.round(plan.totals.batches * 2) / 2}</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>batches</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>·</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{products} products</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>·</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{plan.totals.mainUnits} containers on the main line, {plan.totals.secondUnits} small containers on the second make line</span>
          {plan.activeOrders.length > 0 && (
            <>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{plan.activeOrders.length} catering {plan.activeOrders.length === 1 ? 'order' : 'orders'} inside that</span>
            </>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
          Reference days: {parts.join(', ')} · {Math.round(d.trays).toLocaleString('en-GB')} trays · {Math.round(secondShare(plan) * 100)}% through Deliveroo and Click &amp; Collect.
        </span>
      </div>
    </div>
  );
}

// ─── Table rows ───────────────────────────────────────────────────────────────

function GroupRows({
  label,
  rows,
  orders,
  showCatering,
  colCount,
  focused,
  locked,
  onSelect,
  onOverride,
  onClear,
}: {
  label: string;
  rows: ProductPlan[];
  orders: CateringOrder[];
  showCatering: boolean;
  colCount: number;
  focused: string | null;
  locked: boolean;
  onSelect: (id: string) => void;
  onOverride: (productId: string, line: 'main' | 'second', units: number | undefined) => void;
  onClear: (productId: string) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={colCount} style={{ padding: '8px 12px', background: 'var(--color-bg-hover)', borderTop: '1px solid var(--color-border-subtle)', borderBottom: '1px solid var(--color-border-subtle)', position: 'sticky', left: 0, zIndex: 1 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginRight: 8 }}>{label}</span>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{rows.length} product{rows.length === 1 ? '' : 's'}</span>
        </td>
      </tr>
      {rows.map(p => (
        <ProductRow key={p.productId} p={p} orders={orders} showCatering={showCatering} focused={focused === p.productId} locked={locked} onSelect={() => onSelect(p.productId)} onOverride={onOverride} onClear={onClear} />
      ))}
    </>
  );
}

function ProductRow({
  p,
  orders,
  showCatering,
  focused,
  locked,
  onSelect,
  onOverride,
  onClear,
}: {
  p: ProductPlan;
  orders: CateringOrder[];
  showCatering: boolean;
  focused: boolean;
  locked: boolean;
  onSelect: () => void;
  onOverride: (productId: string, line: 'main' | 'second', units: number | undefined) => void;
  onClear: (productId: string) => void;
}) {
  const refUnits = mainUnitsOf(p.product, p.referenceGrams);
  return (
    <tr onClick={onSelect} style={{ cursor: 'pointer', background: focused ? 'var(--color-info-light)' : '#ffffff' }}>
      <td style={bodyStyle({ left: true, sticky: true, focused })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, rowGap: 3, minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{p.product.name}</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
              {p.overridden && <StatusPill tone="info" label="Edited" size="xs" />}
            </div>
          </div>
          <ChevronRight size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        </div>
      </td>
      <td style={bodyStyle({ focused })}>
        <span style={numStyle}>{Math.round(p.referencePortions)}</span>
        <div style={cellSub}>≈ {refUnits} {p.main.unitName.toLowerCase()}{refUnits === 1 ? '' : 's'}</div>
      </td>
      <td style={bodyStyle({ focused })}>
        {p.carriedGrams > 0 ? (
          <>
            <span style={{ ...numStyle, color: 'var(--color-success)' }}>−{mainUnitsOf(p.product, p.carriedGrams)}</span>
            <div style={cellSub}>{portionsOf(p.product, p.carriedGrams)} portions in the fridge</div>
          </>
        ) : <span style={{ color: 'var(--color-text-muted)' }}>0</span>}
      </td>
      <td style={bodyStyle({ focused })}>
        <LineStepper p={p} line="main" locked={locked} onOverride={onOverride} />
      </td>
      <td style={bodyStyle({ focused })}>
        <LineStepper p={p} line="second" locked={locked} onOverride={onOverride} />
      </td>
      {showCatering && (
        <td style={bodyStyle({ focused })}>
          {p.cateringGrams > 0 ? (
            <>
              <span style={numStyle}>{Math.ceil(p.cateringGrams / p.second.gramsPerUnit)}</span>
              <div style={cellSub}>{boxesLabel(orders, p.productId)}</div>
            </>
          ) : (
            <span style={{ color: 'var(--color-text-muted)' }}>—</span>
          )}
        </td>
      )}
      <td style={bodyStyle({ focused, totalCol: true })}>
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.15 }}>
          <span style={numStyle}>{batchesLabel(p.batches)}</span>
          <span style={{ ...cellSub, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {p.product.batch.halfG ? 'halves allowed' : 'full batches only'}
            {p.overridden && !locked && (
              <button type="button" onClick={e => { e.stopPropagation(); onClear(p.productId); }} title="Back to Edify's number" style={clearButton}>
                <RotateCcw size={9} /> clear
              </button>
            )}
          </span>
        </span>
      </td>
    </tr>
  );
}

function LineStepper({ p, line, locked, onOverride }: { p: ProductPlan; line: 'main' | 'second'; locked: boolean; onOverride: (productId: string, line: 'main' | 'second', units: number | undefined) => void }) {
  const l = line === 'main' ? p.main : p.second;
  const changed = l.plannedUnits !== l.suggestedUnits;
  if (locked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <span style={{ ...numStyle, color: changed ? 'var(--color-info)' : 'var(--color-text-primary)' }}>{l.plannedUnits}</span>
        <span style={fcStyle} title="Edify's suggestion from the reference days">fc {l.suggestedUnits}{line === 'main' ? ` ${l.unitName.toLowerCase()}s` : ''}</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
      <QtyStepper
        size="compact"
        canDecrement={l.plannedUnits > 0}
        onDecrement={() => onOverride(p.productId, line, l.plannedUnits - 1)}
        onIncrement={() => onOverride(p.productId, line, l.plannedUnits + 1)}
        decrementLabel={`One fewer ${l.unitName.toLowerCase()}`}
        incrementLabel={`One more ${l.unitName.toLowerCase()}`}
      >
        <input
          type="number"
          value={l.plannedUnits}
          onChange={e => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) onOverride(p.productId, line, Math.max(0, Math.round(next)));
          }}
          min={0}
          step={1}
          aria-label={`${p.product.name}, ${line === 'main' ? 'main line' : 'second make line'}`}
          style={{ width: 36, border: 'none', background: 'transparent', fontSize: 13, fontWeight: 700, textAlign: 'center', color: changed ? 'var(--color-info)' : 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-primary)', outline: 'none', padding: 0, MozAppearance: 'textfield' }}
        />
      </QtyStepper>
      <span style={fcStyle} title={`Edify's suggestion from the reference days: ${l.suggestedUnits} ${l.unitName.toLowerCase()}${l.suggestedUnits === 1 ? '' : 's'}, about ${line === 'main' ? portionsPerMainUnit(p.product) : portionsPerSecondUnit(p.product)} portions each`}>
        fc {l.suggestedUnits}{line === 'main' ? ` ${l.unitName.toLowerCase()}s` : ''}
      </span>
    </div>
  );
}

// ─── Front of house ───────────────────────────────────────────────────────────

function FohCard({ shopId, date, isToday }: { shopId: string; date: string; isToday: boolean }) {
  const target = isToday ? addDays(date, 1) : date;
  const reminders = fohReminders(shopId, target);
  if (reminders.length === 0) return null;
  return (
    <div style={{ marginTop: 14, background: '#ffffff', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Store size={13} style={{ color: 'var(--color-text-secondary)' }} />
        <span style={{ fontSize: 12, fontWeight: 700 }}>Front of house, {isToday ? 'tomorrow' : shortDate(target)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {reminders.map(r => (
          <div key={r.id} style={{ fontSize: 12 }}>
            <div style={{ fontWeight: 600 }}>{r.label}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{r.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Focus panel (mirrors RecipeFocusPanel) ───────────────────────────────────

function FjFocusPanel({ plan, day, onClose }: { plan: ProductPlan; day: DayPlanModel; onClose: () => void }) {
  if (typeof window === 'undefined') return null;
  const perDay = day.referenceDays.map(r => ({ ...r, demand: daySales(day.shopId, r.date).products[plan.productId] }));
  const batches = batchesToNumber(plan.batches);
  const mainUnit = plan.main.unitName.toLowerCase();
  const perMain = portionsPerMainUnit(plan.product);
  const perSecond = portionsPerSecondUnit(plan.product);
  const cascade = plan.product.recipe.map(l => {
    const c = COMPONENTS[l.ref];
    const ing = INGREDIENTS[l.ref];
    return { id: l.ref, name: c?.name ?? ing?.name ?? l.ref, grams: l.grams * batches, kind: c ? c.kind : 'ingredient', shared: (day.explosion.components[l.ref]?.consumers.length ?? 0) > 1 };
  });
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end', background: 'rgba(15, 23, 32, 0.18)' }} onClick={onClose}>
      <aside
        role="dialog"
        aria-label={`${plan.product.name} details`}
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(520px, 100vw)', height: '100%', background: '#ffffff', borderLeft: '1px solid var(--color-border)', boxShadow: '-12px 0 36px rgba(10, 20, 25, 0.18)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)', overflow: 'hidden' }}
      >
        <div style={{ flexShrink: 0, padding: '14px 18px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--color-bg-surface)' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Focus · {PRODUCT_GROUP_LABELS[plan.product.group]}</span>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)' }}>{plan.product.name}</h2>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusPill tone="info" label={`${plan.product.unitsPerBatch} ${plan.main.unitName.toLowerCase()}${plan.product.unitsPerBatch === 1 ? '' : 's'} per batch`} size="xs" />
              <StatusPill tone="neutral" label={plan.product.halfBatch ? 'half batches' : 'whole batches'} size="xs" />
              <StatusPill tone="neutral" label={`${Math.round(plan.product.holdMinutes / 60)}h hold`} size="xs" />
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={closeButton}>
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 18px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Section icon={<TrendingUp size={13} />} title="Sold on the reference days">
            {perDay.map(r => (
              <Pair key={r.date} label={`${shortDate(r.date)}${r.anomaly ? ` · ${r.anomaly.reason}` : ''}`} value={`${r.demand ? Math.round(r.demand.portions) : 0} portions`} muted={!r.included} struck={!r.included} />
            ))}
            <Divider />
            <Pair label="Average" value={`${Math.round(plan.referencePortions)} portions`} bold />
          </Section>

          <Section icon={<Calculator size={13} />} title="Production math">
            <Ledger label="Reference days" value={`${Math.round(plan.referencePortions)} portions`} />
            {plan.flexPct !== 0 && (
              <Ledger
                label={`Whole-day flex ${plan.flexPct > 0 ? '+' : ''}${plan.flexPct}%`}
                value={`${plan.flexPct > 0 ? '+' : '−'}${portionsOf(plan.product, Math.abs(plan.referenceGrams * (plan.flexPct / 100)))} portions`}
              />
            )}
            {plan.cateringGrams > 0 && <Ledger label="Catering, second make line" value={`${portionsOf(plan.product, plan.cateringGrams)} portions`} signed />}
            {day.activeOrders
              .filter(o => orderGramsFor(o, plan.productId) > 0)
              .map(o => (
                <Pair
                  key={o.id}
                  label={`　${o.customer}, ${o.time}`}
                  value={o.lines.filter(l => l.productId === plan.productId).map(lineLabel).join(' + ')}
                  muted
                />
              ))}
            {plan.carriedGrams > 0 && <Ledger label="Carried from last night's count" value={`−${portionsOf(plan.product, plan.carriedGrams)} portions`} />}
            <Divider />
            <Ledger label={`Main line · ${mainUnit}s, ${perMain} portions each`} value={`${plan.main.plannedUnits}${plan.main.plannedUnits !== plan.main.suggestedUnits ? ` (fc ${plan.main.suggestedUnits})` : ''}`} edify />
            <Ledger label={`Second make line · ${plan.second.unitName.toLowerCase()}s, ${perSecond} portions each`} value={`${plan.second.plannedUnits}${plan.second.plannedUnits !== plan.second.suggestedUnits ? ` (fc ${plan.second.suggestedUnits})` : ''}`} edify />
            <Divider />
            <Ledger label={`Both lines, in ${mainUnit}s`} value={(plan.main.plannedUnits + plan.second.plannedUnits * plan.product.secondLineFraction).toFixed(1)} />
            <Ledger label={`${mainUnit[0].toUpperCase()}${mainUnit.slice(1)}s per batch`} value={String(plan.product.unitsPerBatch)} />
            <Ledger label="Rounding" value={plan.product.batch.halfG ? 'half batches' : 'whole batches'} />
            <Divider />
            <Ledger label="Final plan" value={batchesLabel(plan.batches)} bold />
          </Section>

          <Section icon={<GitBranch size={13} />} title="Cascades to">
            {cascade.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '5px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                {c.shared && <StatusPill tone="info" label="Shared" size="xs" />}
                <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>{kg(c.grams)}</span>
              </div>
            ))}
          </Section>

          {plan.product.note && (
            <Section icon={<Package size={13} />} title="Recipe note">
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>{plan.product.note}</p>
              {plan.product.provenance === 'invented' && <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>Invented for the demo. Jana corrects it in Setup.</p>}
            </Section>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

// ─── Catering panel: every order for the day, cancel or restore each ──────────

function CateringPanel({ plan, locked, onToggle, onClose }: { plan: DayPlanModel; locked: boolean; onToggle: (id: string) => void; onClose: () => void }) {
  if (typeof window === 'undefined') return null;
  const cancelled = new Set(plan.record.cancelledOrders);
  const active = plan.orders.filter(o => !cancelled.has(o.id));
  const smallContainers = plan.plans.reduce((n, p) => n + Math.ceil(p.cateringGrams / p.second.gramsPerUnit), 0);
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end', background: 'rgba(15, 23, 32, 0.18)' }} onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Catering orders"
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(520px, 100vw)', height: '100%', background: '#ffffff', borderLeft: '1px solid var(--color-border)', boxShadow: '-12px 0 36px rgba(10, 20, 25, 0.18)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)', overflow: 'hidden' }}
      >
        <div style={{ flexShrink: 0, padding: '14px 18px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--color-bg-surface)' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Catering · {longDate(plan.date)}</span>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {active.length} {active.length === 1 ? 'order' : 'orders'}
            </h2>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusPill tone="neutral" label={`${smallContainers} small containers on the second make line`} size="xs" />
              {cancelled.size > 0 && <StatusPill tone="warning" label={`${cancelled.size} cancelled`} size="xs" />}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={closeButton}>
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 18px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {plan.orders.length === 0 && <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>No catering on this day.</p>}
          {plan.orders
            .slice()
            .sort((a, b) => a.time.localeCompare(b.time))
            .map(o => {
              const isCancelled = cancelled.has(o.id);
              return (
                <div key={o.id} style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', padding: '12px 14px', opacity: isCancelled ? 0.6 : 1, background: isCancelled ? 'var(--color-bg-hover)' : '#ffffff' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, textDecoration: isCancelled ? 'line-through' : 'none' }}>{o.customer}</span>
                        <StatusPill tone={isCancelled ? 'neutral' : 'info'} size="xs" label={isCancelled ? 'Cancelled' : o.time} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {o.reference} · {orderBoxesLabel(o)}{o.note ? ` · ${o.note}` : ''}
                      </div>
                    </div>
                    {!locked && (
                      <button type="button" onClick={() => onToggle(o.id)} style={isCancelled ? secondaryButtonSmall : cancelPill} title={isCancelled ? `Restore ${o.customer}` : `Cancel ${o.customer}`}>
                        {isCancelled ? <><RotateCcw size={10} /> Restore</> : <><X size={9} strokeWidth={2.6} /> Cancel</>}
                      </button>
                    )}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' }}>
                    {o.lines.map(l => {
                      const perGn = plan.plans.find(p => p.productId === l.productId)?.second.gramsPerUnit;
                      const small = perGn ? Math.ceil(lineGrams(l) / perGn) : 0;
                      return <Pair key={l.productId} label={PRODUCT_NAME(l.productId)} value={`${lineLabel(l)}${small > 0 ? ` · ${small} small` : ''}`} muted={isCancelled} />;
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function PRODUCT_NAME(id: string): string {
  return PRODUCT_BY_ID[id]?.name ?? id;
}

function Section({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--color-text-secondary)', display: 'inline-flex' }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em' }}>{title}</h3>
      </div>
      {subtitle && <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{subtitle}</p>}
      <div>{children}</div>
    </section>
  );
}

function Ledger({ label, value, bold, signed, edify }: { label: string; value: string; bold?: boolean; signed?: boolean; edify?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12, color: 'var(--color-text-primary)', padding: '3px 0' }}>
      {edify && <EdifyMark size={11} color="var(--color-info)" />}
      <span style={{ fontWeight: bold ? 700 : 500 }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: bold ? 700 : 500 }}>{signed ? `+${value}` : value}</span>
    </div>
  );
}

function Pair({ label, value, bold, muted, struck }: { label: string; value: string; bold?: boolean; muted?: boolean; struck?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '3px 0', color: muted ? 'var(--color-text-muted)' : 'var(--color-text-primary)', textDecoration: struck ? 'line-through' : 'none' }}>
      <span style={{ fontWeight: bold ? 700 : 500 }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: '1px dashed var(--color-border-subtle)', margin: '4px 0' }} />;
}

function HeadSub({ children }: { children: ReactNode }) {
  return <span style={{ display: 'block', fontSize: 9, fontWeight: 500, letterSpacing: 0, textTransform: 'none', color: 'var(--color-text-muted)', marginTop: 2 }}>{children}</span>;
}

function Notice({ children }: { children: ReactNode }) {
  return <div style={{ padding: '32px 30px', fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-primary)' }}>{children}</div>;
}

// ─── Styles (copied from RecipeFirstGrid / PlanConfirmBar so both surfaces read as one) ──

function headStyle({ left, sticky, minWidth, totalCol }: { left?: boolean; sticky?: boolean; minWidth?: number; totalCol?: boolean }): CSSProperties {
  return {
    padding: '10px 8px',
    background: 'var(--color-bg-surface)',
    borderBottom: '1px solid var(--color-border-subtle)',
    textAlign: left ? 'left' : 'center',
    verticalAlign: 'top',
    position: sticky ? 'sticky' : undefined,
    left: sticky ? 0 : undefined,
    zIndex: sticky ? 2 : undefined,
    boxShadow: sticky ? '1px 0 0 var(--color-border-subtle)' : undefined,
    minWidth,
    fontSize: 9,
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-primary)',
    borderLeft: totalCol ? '1px solid var(--color-border-subtle)' : undefined,
  };
}

function bodyStyle({ left, sticky, focused, totalCol }: { left?: boolean; sticky?: boolean; focused?: boolean; totalCol?: boolean }): CSSProperties {
  return {
    padding: '10px 8px',
    background: focused ? 'var(--color-info-light)' : '#ffffff',
    borderBottom: '1px solid var(--color-border-subtle)',
    textAlign: left ? 'left' : 'center',
    position: sticky ? 'sticky' : undefined,
    left: sticky ? 0 : undefined,
    zIndex: sticky ? 1 : undefined,
    boxShadow: sticky ? '1px 0 0 var(--color-border-subtle)' : undefined,
    fontSize: 12,
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-primary)',
    verticalAlign: 'middle',
    borderLeft: totalCol ? '1px solid var(--color-border-subtle)' : undefined,
  };
}

function footStyle({ left, sticky, totalCol }: { left?: boolean; sticky?: boolean; totalCol?: boolean } = {}): CSSProperties {
  return {
    padding: '12px 8px',
    background: 'var(--color-bg-surface)',
    borderTop: '2px solid var(--color-border)',
    textAlign: left ? 'left' : 'center',
    position: sticky ? 'sticky' : undefined,
    left: sticky ? 0 : undefined,
    zIndex: sticky ? 1 : undefined,
    boxShadow: sticky ? '1px 0 0 var(--color-border-subtle)' : undefined,
    fontSize: left ? 11 : 13,
    fontWeight: left ? 700 : 600,
    color: left ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
    textTransform: left ? 'uppercase' : undefined,
    letterSpacing: left ? '0.05em' : undefined,
    fontFamily: 'var(--font-primary)',
    whiteSpace: 'nowrap',
    borderLeft: totalCol ? '1px solid var(--color-border-subtle)' : undefined,
  };
}

function footSubStyle({ left, sticky, totalCol }: { left?: boolean; sticky?: boolean; totalCol?: boolean } = {}): CSSProperties {
  return {
    ...footStyle({ left, sticky, totalCol }),
    padding: '10px 8px',
    borderTop: '1px solid var(--color-border-subtle)',
    fontSize: left ? 11 : 12,
    color: left ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
  };
}

const numStyle: CSSProperties = { fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--color-text-primary)' };
const moneyStyle: CSSProperties = { fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-text-secondary)' };
const cellSub: CSSProperties = { fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' };
const fcStyle: CSSProperties = { fontSize: 10, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-muted)', letterSpacing: '0.02em' };
const captionStrip: CSSProperties = { padding: '8px 30px', background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-muted)', flexWrap: 'wrap' };
const refChip: CSSProperties = { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, border: '1.5px solid', background: '#ffffff', cursor: 'pointer', fontFamily: 'var(--font-primary)', letterSpacing: '0.02em', whiteSpace: 'nowrap' };
const undoStrip: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 14px', marginBottom: 10, background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-card)', fontSize: 12, color: 'var(--color-text-primary)' };
const linkButton: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--color-link)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-primary)', textDecoration: 'underline' };
const cancelPill: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, background: '#ffffff', color: 'var(--color-text-secondary)', border: '1.5px solid var(--color-border)', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer', fontFamily: 'var(--font-primary)', lineHeight: 1 };
const clearButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 4px', border: 'none', background: 'transparent', color: 'var(--color-info)', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-primary)' };
const closeButton: CSSProperties = { width: 32, height: 32, borderRadius: 8, border: '1px solid var(--color-border-subtle)', background: '#ffffff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', flexShrink: 0 };

const bannerTitle: CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' };
const bannerSub: CSSProperties = { fontSize: 11, color: 'var(--color-text-secondary)' };
const confirmedBanner: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', margin: '12px 30px 0', background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', fontFamily: 'var(--font-primary)' };
const draftBar: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', margin: '12px 30px 0', background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', boxShadow: '0 1px 2px rgba(12,20,44,0.06)', fontFamily: 'var(--font-primary)', flexWrap: 'wrap' };
const draftIcon: CSSProperties = { width: 32, height: 32, flexShrink: 0, borderRadius: 9, background: 'var(--color-info-light)', color: 'var(--color-info)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const primaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: 40, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-primary)', background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', border: '1px solid var(--color-accent-active)', cursor: 'pointer', whiteSpace: 'nowrap' };
const secondaryButtonSmall: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', fontFamily: 'var(--font-primary)', background: '#ffffff', color: 'var(--color-text-secondary)', border: '1.5px solid var(--color-border)', cursor: 'pointer', lineHeight: 1 };
const secondaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: 40, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)', background: '#ffffff', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', cursor: 'pointer', whiteSpace: 'nowrap' };
const reopenButton: CSSProperties = { marginLeft: 'auto', flexShrink: 0, padding: '6px 12px', fontSize: 11, fontWeight: 700, background: '#ffffff', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-primary)' };

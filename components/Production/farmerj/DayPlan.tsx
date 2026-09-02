'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, Info, RotateCcw, Sparkles, Store, X } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import QtyStepper, { getStepperValueStyle } from '@/components/Production/QtyStepper';
import { batchesLabel, batchesToNumber, gbp, kg, type ProductPlan } from './cascade';
import { orderGramsFor, orderPortions, type CateringOrder } from './catering';
import { FJ_DEMO_TODAY, longDate, shortDate, weekdayLabel } from './calendar';
import { useFjDayPlan, useWindowApproval, type DayPlan as DayPlanModel } from './FjPlanStore';
import { COMPONENTS, INGREDIENTS, PRODUCT_GROUP_LABELS, type ProductGroup } from './recipes';
import { daySales, fohReminders } from './sales';
import { FJ_ALL_SHOPS_ID, getShop } from './shops';

const GROUP_ORDER: ProductGroup[] = ['breakfast', 'bases', 'proteins', 'hot-sides', 'salads'];

/**
 * The GM's first screen. One row per finished sellable product, nothing
 * else. Suggested cast irons and gastronorms from the reference days, a
 * catering column per order, an override on every number, a whole-day
 * flex, and a plain-words derivation one tap away.
 */
export default function DayPlan() {
  const { isFarmerJ, productionSiteId } = useActiveSite();
  const [date, setDate] = useState(FJ_DEMO_TODAY);
  const shopId = productionSiteId ?? FJ_ALL_SHOPS_ID;

  if (!isFarmerJ) return <Notice title="Day plan">Switch the Brand pill in demo controls to Farmer J to see this screen.</Notice>;
  if (shopId === FJ_ALL_SHOPS_ID) {
    return (
      <Notice title="Day plan">
        Pick a shop in the site switcher to see its day plan. The all-shops view is Jana&apos;s board, on the Plan side under Shops.
      </Notice>
    );
  }
  return <DayPlanForShop shopId={shopId} date={date} onDateChange={setDate} />;
}

function DayPlanForShop({ shopId, date, onDateChange }: { shopId: string; date: string; onDateChange: (d: string) => void }) {
  const shop = getShop(shopId);
  const { plan, setOverride, clearOverride, setFlex, toggleOrder, toggleReferenceDay, approve, reopen } = useFjDayPlan(shopId, date);
  const approval = useWindowApproval(shopId, date);
  const [openProduct, setOpenProduct] = useState<string | null>(null);
  const [justCancelled, setJustCancelled] = useState<string | null>(null);

  useEffect(() => {
    if (!justCancelled) return;
    const t = window.setTimeout(() => setJustCancelled(null), 8000);
    return () => window.clearTimeout(t);
  }, [justCancelled]);

  // Escape closes the derivation drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenProduct(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const byGroup = useMemo(() => {
    const m = new Map<ProductGroup, ProductPlan[]>();
    for (const p of plan.plans) {
      const g = p.product.group;
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(p);
    }
    return GROUP_ORDER.filter(g => m.has(g)).map(g => ({ group: g, rows: m.get(g)! }));
  }, [plan.plans]);

  const closed = plan.demand.net === 0 && plan.activeOrders.length === 0;
  const isToday = date === FJ_DEMO_TODAY;
  const dayWord = isToday ? 'today' : longDate(date).split(' ')[0];
  const reminders = fohReminders(shopId, date === FJ_DEMO_TODAY ? date : date);
  const cancelledOrder = plan.orders.find(o => o.id === justCancelled);
  const shownAnomaly = plan.referenceDays.find(r => r.anomaly);
  const openPlan = openProduct ? plan.plans.find(p => p.productId === openProduct) : undefined;

  return (
    <div style={page}>
      {/* Header: shop, date strip, status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={eyebrow}>
            <Store size={12} /> Farmer J {shop?.name} · {shop?.area}
          </div>
          <h1 style={h1}>Day plan, {longDate(date)}</h1>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>{plan.window.label}. Reviewed the morning of.</div>
        </div>
        <StatusPill plan={plan} approvedDays={approval.approvedDays.length} windowDays={approval.window.days.length} />
      </div>

      <DateStrip days={plan.window.days} date={date} onChange={d => { onDateChange(d); setOpenProduct(null); }} shopId={shopId} />

      {closed ? (
        <Notice title={`${shop?.name} is closed on ${longDate(date)}`}>Nothing to plan. Weekend-closed shops do their Monday chickpeas on Sunday or first thing.</Notice>
      ) : (
        <>
          <Tiles plan={plan} onToggleReferenceDay={toggleReferenceDay} />

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 20, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <FlexControl plan={plan} onChange={setFlex} />
              {cancelledOrder && (
                <div style={undoStrip}>
                  <span>
                    <strong>{cancelledOrder.customer}</strong> cancelled. Every row it touched has re-derived.
                  </span>
                  <button type="button" style={linkButton} onClick={() => { toggleOrder(cancelledOrder.id); setJustCancelled(null); }}>
                    Undo
                  </button>
                </div>
              )}
              <PlanTable
                plan={plan}
                byGroup={byGroup}
                openProduct={openProduct}
                onOpen={setOpenProduct}
                onOverride={setOverride}
                onClear={clearOverride}
                onCancelOrder={id => { toggleOrder(id); setJustCancelled(id); }}
                locked={plan.approved}
              />
              <ApproveBar
                plan={plan}
                approval={approval}
                dayWord={dayWord}
                onApproveWindow={() => approve(`${shop?.name} GM`, approval.window.days)}
                onApproveDay={() => approve(`${shop?.name} GM`)}
                onReopen={reopen}
              />
            </div>

            <aside style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 76 }}>
              <EdifyNote plan={plan} anomalyReason={shownAnomaly?.anomaly?.reason} />
              <FohCard reminders={reminders} dayLabel={isToday ? 'Tomorrow' : shortDate(date)} />
            </aside>
          </div>
        </>
      )}

      <AnimatePresence>
        {openPlan && <DerivationDrawer plan={openPlan} day={plan} onClose={() => setOpenProduct(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header pieces
// ─────────────────────────────────────────────────────────────────────────────

function StatusPill({ plan, approvedDays, windowDays }: { plan: DayPlanModel; approvedDays: number; windowDays: number }) {
  if (plan.approved) {
    const at = plan.record.approvedAtISO ? new Date(plan.record.approvedAtISO).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      <div style={{ ...pill, background: 'var(--color-success-light)', border: '1px solid var(--color-success-border)', color: 'var(--color-success)' }}>
        <CheckCircle2 size={13} /> Approved {at}{plan.record.approvedBy ? ` by ${plan.record.approvedBy}` : ''} · {approvedDays} of {windowDays} days in this window
      </div>
    );
  }
  return (
    <div style={{ ...pill, background: 'var(--color-review-light)', border: '1px solid var(--color-review-border)', color: 'var(--color-review)' }}>
      Draft · {plan.overriddenCount === 0 ? 'all lines suggested by Edify' : `${plan.overriddenCount} ${plan.overriddenCount === 1 ? 'line' : 'lines'} set by hand`}
    </div>
  );
}

function DateStrip({ days, date, onChange, shopId }: { days: string[]; date: string; onChange: (d: string) => void; shopId: string }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }} role="tablist" aria-label="Days in this planning window">
      {days.map(d => {
        const active = d === date;
        const isToday = d === FJ_DEMO_TODAY;
        const closed = daySales(shopId, d).net === 0;
        return (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(d)}
            style={{
              ...dateChip,
              background: active ? 'var(--color-accent-active)' : '#fff',
              color: active ? 'var(--color-text-on-active)' : closed ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
              borderColor: active ? 'var(--color-accent-active)' : 'var(--color-border)',
            }}
          >
            <span style={{ fontWeight: 700 }}>{weekdayLabel(d)}</span>
            <span style={{ opacity: 0.8 }}>{shortDate(d).split(' ').slice(1).join(' ')}</span>
            {isToday && <span style={{ ...miniTag, background: active ? 'rgba(255,255,255,0.18)' : 'var(--color-bg-hover)', color: active ? '#fff' : 'var(--color-text-secondary)' }}>Today</span>}
            {closed && <span style={{ ...miniTag, background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' }}>Closed</span>}
          </button>
        );
      })}
    </div>
  );
}

function Tiles({ plan, onToggleReferenceDay }: { plan: DayPlanModel; onToggleReferenceDay: (d: string) => void }) {
  const d = plan.demand;
  const secondShare = d.net > 0 ? (d.netByChannel.deliveroo + d.netByChannel.clickcollect) / d.net : 0;
  const tiles: { label: string; value: string; sub?: string }[] = [];
  if (d.netByDayPart.breakfast > 0) tiles.push({ label: 'Breakfast', value: gbp(d.netByDayPart.breakfast), sub: 'to 11:00' });
  tiles.push({ label: 'Lunch', value: gbp(d.netByDayPart.lunch), sub: '11:00 to 17:00' });
  if (d.netByDayPart.dinner > 0) tiles.push({ label: 'Dinner', value: gbp(d.netByDayPart.dinner), sub: 'from 17:00' });
  tiles.push({ label: 'Trays', value: Math.round(d.trays).toLocaleString('en-GB'), sub: `${Math.round(d.items).toLocaleString('en-GB')} items` });
  tiles.push({ label: 'Second make line', value: `${Math.round(secondShare * 100)}%`, sub: 'Deliveroo and Click & Collect' });
  if (plan.activeOrders.length) tiles.push({ label: 'Catering', value: `${plan.activeOrders.length} ${plan.activeOrders.length === 1 ? 'order' : 'orders'}`, sub: `${plan.activeOrders.reduce((n, o) => n + orderPortions(o), 0)} covers` });

  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>
      {tiles.map(t => (
        <div key={t.label} style={tile}>
          <div style={tileLabel}>{t.label}</div>
          <div style={tileValue}>{t.value}</div>
          {t.sub && <div style={tileSub}>{t.sub}</div>}
        </div>
      ))}
      <div style={{ ...tile, flex: '1 1 320px', minWidth: 280 }}>
        <div style={tileLabel}>Drafted from the last four {longDate(plan.date).split(' ')[0]}s</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {plan.referenceDays.map(r => {
            const anomaly = r.anomaly;
            const bg = !r.included ? 'var(--color-bg-hover)' : anomaly ? 'var(--color-warning-light)' : '#fff';
            const border = anomaly && r.included ? 'var(--color-warning-border)' : 'var(--color-border)';
            return (
              <button
                key={r.date}
                type="button"
                onClick={() => onToggleReferenceDay(r.date)}
                title={anomaly ? `${anomaly.reason}. ${r.included ? 'Tap to exclude.' : 'Excluded. Tap to include.'}` : r.included ? 'Included. Tap to exclude.' : 'Excluded. Tap to include.'}
                aria-pressed={r.included}
                style={{
                  ...refChip,
                  background: bg,
                  borderColor: border,
                  color: r.included ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  textDecoration: r.included ? 'none' : 'line-through',
                }}
              >
                {shortDate(r.date)}
                {anomaly && <span style={{ fontWeight: 500, marginLeft: 4, color: 'var(--color-text-secondary)' }}>· {anomaly.reason.split(' ').slice(0, 1).join(' ')}</span>}
              </button>
            );
          })}
        </div>
        <div style={{ ...tileSub, marginTop: 6 }}>
          {plan.includedReferenceDates.length} of {plan.referenceDays.length} days in the average. Tap a day to leave it out.
        </div>
      </div>
    </div>
  );
}

function FlexControl({ plan, onChange }: { plan: DayPlanModel; onChange: (pct: number) => void }) {
  const pct = plan.record.flexPct;
  const hand = plan.overriddenCount;
  return (
    <div style={flexRow}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>Whole day</span>
        <QtyStepper
          size="compact"
          onDecrement={() => onChange(Math.max(-50, pct - 5))}
          onIncrement={() => onChange(Math.min(50, pct + 5))}
          decrementLabel="Take 5% off the day"
          incrementLabel="Add 5% to the day"
          disabled={plan.approved}
        >
          <span style={{ ...getStepperValueStyle('compact'), minWidth: 44 }}>{pct > 0 ? '+' : ''}{pct}%</span>
        </QtyStepper>
        {pct !== 0 && (
          <button type="button" style={linkButton} onClick={() => onChange(0)}>
            Back to 0%
          </button>
        )}
      </div>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
        {pct === 0
          ? 'Flex the whole day up or down in 5% steps. Lines you set by hand are never touched.'
          : `Applied to suggested lines. ${hand === 0 ? 'No lines' : `${hand} ${hand === 1 ? 'line' : 'lines'}`} set by hand ${hand === 1 ? 'is' : 'are'} unchanged.`}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The table
// ─────────────────────────────────────────────────────────────────────────────

function PlanTable({
  plan,
  byGroup,
  openProduct,
  onOpen,
  onOverride,
  onClear,
  onCancelOrder,
  locked,
}: {
  plan: DayPlanModel;
  byGroup: { group: ProductGroup; rows: ProductPlan[] }[];
  openProduct: string | null;
  onOpen: (id: string) => void;
  onOverride: (productId: string, line: 'main' | 'second', units: number | undefined) => void;
  onClear: (productId: string) => void;
  onCancelOrder: (id: string) => void;
  locked: boolean;
}) {
  const orders = plan.activeOrders;
  const cols = `minmax(190px, 1.2fr) minmax(130px, 0.8fr) minmax(230px, 1.2fr) minmax(215px, 1.1fr) ${orders.map(() => 'minmax(150px, 0.9fr)').join(' ')} minmax(150px, 0.9fr)`;
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', background: '#fff' }}>
      <div role="table" aria-label="Day plan" style={{ minWidth: 915 + orders.length * 150 }}>
        <div role="row" style={{ ...gridRow(cols), ...headRow }}>
          <div role="columnheader" style={th}>Finished product</div>
          <div role="columnheader" style={th}>Sold on reference days</div>
          <div role="columnheader" style={th}>
            Main line <span style={thSub}>cast irons, theatre kitchen</span>
          </div>
          <div role="columnheader" style={th}>
            Second make line <span style={thSub}>gastronorms, delivery and catering</span>
          </div>
          {orders.map(o => (
            <div role="columnheader" key={o.id} style={{ ...th, position: 'relative', paddingRight: 26 }}>
              <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${o.customer} · ${o.reference}`}>{o.customer}</span>
              <span style={thSub}>{o.time} · {orderPortions(o)} covers</span>
              {!locked && (
                <button type="button" onClick={() => onCancelOrder(o.id)} title={`Cancel ${o.customer}`} aria-label={`Cancel ${o.customer}`} style={cancelX}>
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <div role="columnheader" style={th}>To make</div>
        </div>

        {byGroup.map(({ group, rows }) => (
          <div key={group} role="rowgroup">
            <div role="row" style={groupRow}>{PRODUCT_GROUP_LABELS[group]}</div>
            {rows.map(p => (
              <PlanRow
                key={p.productId}
                p={p}
                orders={orders}
                cols={cols}
                open={openProduct === p.productId}
                onOpen={() => onOpen(p.productId)}
                onOverride={onOverride}
                onClear={onClear}
                locked={locked}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanRow({
  p,
  orders,
  cols,
  open,
  onOpen,
  onOverride,
  onClear,
  locked,
}: {
  p: ProductPlan;
  orders: CateringOrder[];
  cols: string;
  open: boolean;
  onOpen: () => void;
  onOverride: (productId: string, line: 'main' | 'second', units: number | undefined) => void;
  onClear: (productId: string) => void;
  locked: boolean;
}) {
  const hasHand = p.overridden;
  // Bases and sides ride on the tray at £0; the odd "extra side" pound
  // would only confuse a GM, so pounds show on proteins and breakfast.
  const net = p.product.group === 'proteins' || p.product.group === 'breakfast' ? p.referenceNet : 0;
  return (
    <div role="row" style={{ ...gridRow(cols), ...bodyRow, background: open ? 'var(--color-bg-hover)' : '#fff' }}>
      <div role="cell" style={{ ...td, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={onOpen} style={nameButton} aria-expanded={open} title="Why this number">
          <span style={{ fontWeight: 600 }}>{p.product.name}</span>
          <ChevronRight size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
        </button>
        {p.product.provenance === 'invented' && <span style={{ ...miniTag, background: 'var(--chip-stone-bg)', color: 'var(--chip-stone)' }} title="Recipe invented for the demo. Jana to correct.">Demo recipe</span>}
      </div>

      <div role="cell" style={td}>
        <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{Math.round(p.referencePortions)} portions</div>
        <div style={tdSub}>
          {net > 0 ? gbp(net) : 'on trays'} · {kg(p.referenceGrams)}
        </div>
      </div>

      <LineCell p={p} line="main" onOverride={onOverride} locked={locked} />
      <LineCell p={p} line="second" onOverride={onOverride} locked={locked} />

      {orders.map(o => {
        const g = orderGramsFor(o, p.productId);
        const line = o.lines.find(l => l.productId === p.productId);
        return (
          <div role="cell" key={o.id} style={{ ...td, color: g ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
            {g ? (
              <>
                <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{line!.portions} × {line!.gramsEach} g</div>
                <div style={tdSub}>{kg(g)} · {Math.ceil(g / p.second.gramsPerUnit)} {Math.ceil(g / p.second.gramsPerUnit) === 1 ? 'gastronorm' : 'gastronorms'}</div>
              </>
            ) : (
              <span style={{ fontSize: 12 }}>—</span>
            )}
          </div>
        );
      })}

      <div role="cell" style={td}>
        <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{batchesLabel(p.batches)}</div>
        <div style={{ ...tdSub, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{kg(p.gramsMade)}</span>
          {hasHand && (
            <>
              <span style={{ ...miniTag, background: 'var(--color-info-light)', color: 'var(--color-info)' }}>Edited</span>
              {!locked && (
                <button type="button" onClick={() => onClear(p.productId)} style={{ ...iconButton }} title="Back to Edify's number" aria-label="Back to Edify's number">
                  <RotateCcw size={12} />
                </button>
              )}
            </>
          )}
          {p.carriedGrams > 0 && <span style={{ ...miniTag, background: 'var(--color-success-light)', color: 'var(--color-success)' }}>−{kg(p.carriedGrams)} carried</span>}
        </div>
      </div>
    </div>
  );
}

function LineCell({
  p,
  line,
  onOverride,
  locked,
}: {
  p: ProductPlan;
  line: 'main' | 'second';
  onOverride: (productId: string, line: 'main' | 'second', units: number | undefined) => void;
  locked: boolean;
}) {
  const l = line === 'main' ? p.main : p.second;
  const overridden = p.product && ((line === 'main' && p.main.plannedUnits !== p.main.suggestedUnits) || (line === 'second' && p.second.plannedUnits !== p.second.suggestedUnits));
  const unit = l.unitName.replace(' (second make line)', '').toLowerCase();
  const none = l.suggestedUnits === 0 && l.plannedUnits === 0;
  return (
    <div role="cell" style={{ ...td, display: 'flex', alignItems: 'center', gap: 10 }}>
      <QtyStepper
        size="compact"
        disabled={locked}
        canDecrement={l.plannedUnits > 0}
        onDecrement={() => onOverride(p.productId, line, l.plannedUnits - 1)}
        onIncrement={() => onOverride(p.productId, line, l.plannedUnits + 1)}
        decrementLabel={`One fewer ${unit}`}
        incrementLabel={`One more ${unit}`}
      >
        <span style={{ ...getStepperValueStyle('compact', { muted: none }), minWidth: 30, fontSize: 14, color: overridden ? 'var(--color-info)' : undefined }}>{l.plannedUnits}</span>
      </QtyStepper>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{l.plannedUnits === 1 ? unit : `${unit}s`}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {overridden ? `Edify: ${l.suggestedUnits}` : none ? 'none needed' : `about ${kg(l.gramsPerUnit)} each`}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Approve
// ─────────────────────────────────────────────────────────────────────────────

function ApproveBar({
  plan,
  approval,
  dayWord,
  onApproveWindow,
  onApproveDay,
  onReopen,
}: {
  plan: DayPlanModel;
  approval: ReturnType<typeof useWindowApproval>;
  dayWord: string;
  onApproveWindow: () => void;
  onApproveDay: () => void;
  onReopen: () => void;
}) {
  const w = approval.window;
  const from = weekdayLabel(w.from);
  const to = weekdayLabel(w.to);
  if (plan.approved) {
    return (
      <div style={{ ...approveBar, background: 'var(--color-success-light)', border: '1px solid var(--color-success-border)' }}>
        <CheckCircle2 size={16} color="var(--color-success)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Approved. The kitchen runs to these numbers {dayWord}.</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            Prep list, sections and the order sheet follow this plan. Reopen to change a number; anything you change re-derives below it.
          </div>
        </div>
        <button type="button" onClick={onReopen} style={secondaryButton}>Reopen</button>
      </div>
    );
  }
  return (
    <div style={approveBar}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          Main line {plan.totals.mainUnits} cast irons and salad trays. Second make line {plan.totals.secondUnits} gastronorms. {Math.round(plan.totals.batches * 2) / 2} batches, {kg(plan.totals.gramsMade)} cooked.
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Approving the window approves {from} to {to}. Each morning you can still change the day and approve it again.
          {approval.approvedDays.length > 0 && ` ${approval.approvedDays.length} of ${w.days.length} days already approved.`}
        </div>
      </div>
      <button type="button" onClick={onApproveDay} style={secondaryButton}>Approve {dayWord} only</button>
      <button type="button" onClick={onApproveWindow} style={primaryButton}>
        <CheckCircle2 size={14} /> Approve {from} to {to}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right rail
// ─────────────────────────────────────────────────────────────────────────────

function EdifyNote({ plan, anomalyReason }: { plan: DayPlanModel; anomalyReason?: string }) {
  const dayName = longDate(plan.date).split(' ')[0];
  const excluded = plan.referenceDays.filter(r => !r.included);
  const shared = Object.values(plan.explosion.components).filter(c => c.shared).length;
  const orders = plan.activeOrders;
  return (
    <div style={card}>
      <div style={{ ...cardTitle, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={13} color="var(--color-accent-pink)" /> Edify&apos;s note
      </div>
      <p style={cardText}>
        Drafted from the last four {dayName}s at {getShop(plan.shopId)?.name}
        {excluded.length > 0 ? `, skipping ${excluded.map(r => shortDate(r.date)).join(' and ')}${anomalyReason ? ` (${anomalyReason.toLowerCase()})` : ''}` : ''}.
        {plan.record.flexPct !== 0 ? ` Whole day flexed ${plan.record.flexPct > 0 ? '+' : ''}${plan.record.flexPct}%.` : ''}
      </p>
      <p style={cardText}>
        {orders.length > 0
          ? `${orders.map(o => `${o.customer} at ${o.time}`).join(' and ')} ${orders.length === 1 ? 'is' : 'are'} on the second make line as gastronorms.`
          : 'No catering on this day.'}{' '}
        Below the plan: {Object.keys(plan.explosion.components).length} preps and dressings, {shared} of them shared between dishes.
      </p>
      {plan.demand.modelled && (
        <p style={{ ...cardText, color: 'var(--color-text-muted)' }}>
          <Info size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
          Reference days are modelled from one real Marylebone Wednesday (16 April 2025). Labelled on the dashboard.
        </p>
      )}
    </div>
  );
}

function FohCard({ reminders, dayLabel }: { reminders: ReturnType<typeof fohReminders>; dayLabel: string }) {
  if (reminders.length === 0) return null;
  return (
    <div style={card}>
      <div style={cardTitle}>Front of house, {dayLabel.toLowerCase()}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Things the kitchen does not make. Sent to the front-of-house manager the night before.</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {reminders.map(r => (
          <li key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--color-accent-mid)', marginTop: 6, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{r.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Derivation drawer: "why this number", in Farmer J words
// ─────────────────────────────────────────────────────────────────────────────

function DerivationDrawer({ plan, day, onClose }: { plan: ProductPlan; day: DayPlanModel; onClose: () => void }) {
  const perDay = day.referenceDays.map(r => ({ ...r, demand: daySales(day.shopId, r.date).products[plan.productId] }));
  const firstLevel = plan.product.recipe.map(l => {
    const c = COMPONENTS[l.ref];
    const ing = INGREDIENTS[l.ref];
    const grams = l.grams * batchesToNumber(plan.batches);
    return { name: c?.name ?? ing?.name ?? l.ref, grams, kind: c ? c.kind : 'ingredient', shared: (day.explosion.components[l.ref]?.consumers.length ?? 0) > 1 };
  });
  // Portalled: the production page body is its own stacking context under
  // the sticky top bar, so a fixed drawer inside it would sit beneath the
  // chrome.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,28,53,0.35)', zIndex: 1200 }} />
      <motion.aside
        role="dialog"
        aria-label={`Why ${plan.main.plannedUnits} ${plan.main.unitName.toLowerCase()}s of ${plan.product.name}`}
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        style={drawer}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={eyebrow}>{PRODUCT_GROUP_LABELS[plan.product.group]}</div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{plan.product.name}</h2>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {plan.main.plannedUnits} {plan.main.unitName.toLowerCase()}{plan.main.plannedUnits === 1 ? '' : 's'} on the main line, {plan.second.plannedUnits} on the second make line. {batchesLabel(plan.batches)} {batchesToNumber(plan.batches) === 1 ? 'batch' : 'batches'}.
            </div>
          </div>
          <button type="button" onClick={onClose} style={iconButton} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <section style={{ marginTop: 20 }}>
          <div style={cardTitle}>Sold on each reference day</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {perDay.map(r => (
              <div key={r.date} style={{ ...tile, padding: '10px 12px', opacity: r.included ? 1 : 0.5 }}>
                <div style={tileLabel}>{shortDate(r.date)}</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.demand ? Math.round(r.demand.portions) : 0}</div>
                <div style={tileSub}>{r.included ? 'in average' : r.anomaly ? 'left out' : 'left out'}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 20 }}>
          <div style={cardTitle}>How Edify got here</div>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plan.notes.map((n, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-primary)' }}>{n}</li>
            ))}
          </ol>
        </section>

        <section style={{ marginTop: 20 }}>
          <div style={cardTitle}>What this cascades to</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>The team never sees these on the day plan. They arrive as tasks on the prep list and the section cards.</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {firstLevel.map(f => (
              <li key={f.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span>
                  {f.name}
                  {f.shared && <span style={{ ...miniTag, marginLeft: 6, background: 'var(--chip-teal-bg)', color: 'var(--chip-teal)' }}>Shared</span>}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>{kg(f.grams)}</span>
              </li>
            ))}
          </ul>
        </section>

        {plan.product.note && (
          <section style={{ marginTop: 20 }}>
            <div style={cardTitle}>Recipe note</div>
            <p style={cardText}>{plan.product.note}</p>
            {plan.product.provenance === 'invented' && <p style={{ ...cardText, color: 'var(--color-text-muted)' }}>Invented for the demo. Marked so Jana can correct it in Setup.</p>}
          </section>
        )}
      </motion.aside>
    </>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small pieces and styles
// ─────────────────────────────────────────────────────────────────────────────

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ ...page, maxWidth: 720 }}>
      <h1 style={h1}>{title}</h1>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>{children}</p>
    </div>
  );
}

const page: CSSProperties = { padding: '20px 30px 40px', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)' };
const eyebrow: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 };
const h1: CSSProperties = { fontSize: 22, fontWeight: 700, margin: 0 };
const pill: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap' };
const miniTag: CSSProperties = { display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, letterSpacing: '0.02em', lineHeight: '16px' };
const dateChip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999, border: '1px solid', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-primary)' };
const tile: CSSProperties = { background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', padding: '12px 14px', minWidth: 120 };
const tileLabel: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--color-text-muted)' };
const tileValue: CSSProperties = { fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 2 };
const tileSub: CSSProperties = { fontSize: 11, color: 'var(--color-text-secondary)' };
const refChip: CSSProperties = { fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 999, border: '1px solid', cursor: 'pointer', fontFamily: 'var(--font-primary)' };
const flexRow: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '10px 14px', margin: '16px 0 10px', background: 'var(--color-bg-hover)', borderRadius: 'var(--radius-card)', flexWrap: 'wrap' };
const undoStrip: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 14px', marginBottom: 10, background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-card)', fontSize: 12 };
const linkButton: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--color-link)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-primary)', textDecoration: 'underline' };
const headRow: CSSProperties = { background: 'var(--color-bg-hover)', borderBottom: '1px solid var(--color-border-subtle)', position: 'sticky', top: 0, zIndex: 2 };
const th: CSSProperties = { padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' };
const thSub: CSSProperties = { display: 'block', fontSize: 10, fontWeight: 500, letterSpacing: 0, textTransform: 'none', color: 'var(--color-text-muted)', marginTop: 2 };
const groupRow: CSSProperties = { padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', background: '#fff' };
const bodyRow: CSSProperties = { borderBottom: '1px solid var(--color-border-subtle)' };
const td: CSSProperties = { padding: '10px 12px', fontSize: 13, minWidth: 0 };
const tdSub: CSSProperties = { fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 };
const nameButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontSize: 13, color: 'var(--color-text-primary)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-primary)' };
const iconButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, border: '1px solid var(--color-border-subtle)', background: '#fff', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: 0 };
const cancelX: CSSProperties = { position: 'absolute', top: 8, right: 6, width: 20, height: 20, borderRadius: 5, border: '1px solid var(--color-border)', background: '#fff', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 };
const approveBar: CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', marginTop: 14, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', boxShadow: '0 1px 2px rgba(0,28,53,0.06)', flexWrap: 'wrap' };
const primaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', border: '1px solid var(--color-accent-active)', cursor: 'pointer', fontFamily: 'var(--font-primary)', whiteSpace: 'nowrap' };
const secondaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: '#fff', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-primary)', whiteSpace: 'nowrap' };
const card: CSSProperties = { background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', padding: '14px 16px' };
const cardTitle: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 };
const cardText: CSSProperties = { margin: '0 0 8px', fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-primary)' };
const drawer: CSSProperties = { position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(520px, 100vw)', background: '#fff', zIndex: 1201, boxShadow: '-12px 0 40px rgba(0,28,53,0.18)', padding: '24px 24px 40px', overflowY: 'auto', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)' };

function gridRow(cols: string): CSSProperties {
  return { display: 'grid', gridTemplateColumns: cols, alignItems: 'stretch' };
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, ClipboardCheck, Lock, LockOpen, Trash2, Undo2 } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import QtyStepper from '@/components/Production/QtyStepper';
import StatusPill from '@/components/Production/StatusPill';
import { gbp, portionsOf } from './cascade';
import { FJ_DAY_STRIP_DATES, FJ_DEMO_TODAY, longDate, longDay, weekdayLabel } from './calendar';
import {
  closeTotals,
  computeCloseDay,
  draftFromClose,
  draftFromExpected,
  draftToCloseCount,
  tomorrowEffect,
  unitsLabel,
  WASTE_REASONS,
  type CloseDraft,
  type CloseLine,
} from './close';
import { FjDayStrip, Notice } from './DayPlan';
import { useFjPlanStore } from './FjPlanStore';
import { plural, teamFor } from './sections';
import { FJ_ALL_SHOPS_ID, getShop } from './shops';

/**
 * Close. Built on the Pret carry-over chassis: one banner with the count's
 * totals and a confirm button, then one row per counted item with Edify's
 * draft, a stepper, the change it makes to tomorrow, and a waste control.
 * The day strip on top matches the rest of Run.
 */

export default function CloseCount() {
  const { isFarmerJ, productionSiteId } = useActiveSite();
  const [date, setDate] = useState(FJ_DEMO_TODAY);
  const shopId = productionSiteId ?? FJ_ALL_SHOPS_ID;

  if (!isFarmerJ) return <Notice>Switch the Brand pill in demo controls to Farmer J to see this screen.</Notice>;
  if (shopId === FJ_ALL_SHOPS_ID) return <Notice>Pick a shop in the site switcher to see its close.</Notice>;
  return <CloseForShop key={`${shopId}|${date}`} shopId={shopId} date={date} onDateChange={setDate} />;
}

function CloseForShop({ shopId, date, onDateChange }: { shopId: string; date: string; onDateChange: (d: string) => void }) {
  const store = useFjPlanStore();
  const shop = getShop(shopId);
  const record = store.get(shopId, date);
  const day = useMemo(() => computeCloseDay(shopId, date, store.get), [shopId, date, store]);
  const saved = record.close;

  const [draft, setDraft] = useState<CloseDraft>(() => (saved ? draftFromClose(day.lines, saved) : draftFromExpected(day.lines)));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [wasteOpen, setWasteOpen] = useState<Record<string, boolean>>({});

  // When another surface (chat, reset) changes the saved count, follow it.
  useEffect(() => {
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(draftFromClose(day.lines, saved));
    }
  }, [saved, day.lines]);

  const effect = useMemo(() => tomorrowEffect(shopId, date, store.get, day.lines, draft), [shopId, date, store, day.lines, draft]);
  const totals = useMemo(() => closeTotals(day.lines, draft, effect), [day.lines, draft, effect]);
  const locked = Boolean(saved);

  const setCounted = useCallback((id: string, units: number) => {
    setDraft(d => ({ ...d, counted: { ...d.counted, [id]: Math.max(0, units) } }));
    setTouched(t => ({ ...t, [id]: true }));
  }, []);
  const setBinned = useCallback((id: string, units: number, reason?: string) => {
    setDraft(d => {
      const binned = { ...d.binned };
      const current = binned[id];
      const r = reason ?? current?.reason ?? WASTE_REASONS[0];
      if (units <= 0) delete binned[id];
      else binned[id] = { units, reason: r };
      return { ...d, binned };
    });
  }, []);
  const resetLine = useCallback((line: CloseLine) => {
    setDraft(d => {
      const binned = { ...d.binned };
      delete binned[line.productId];
      return { counted: { ...d.counted, [line.productId]: line.expectedUnits }, binned };
    });
    setTouched(t => ({ ...t, [line.productId]: false }));
  }, []);

  const confirm = () => {
    const by = teamFor(shopId).hot;
    store.update(shopId, date, r => ({ ...r, close: draftToCloseCount(day.lines, draft, by, new Date(`${date}T20:${String(10 + (hash(shopId) % 40)).padStart(2, '0')}:00`).toISOString()) }));
  };
  const reopen = () => store.update(shopId, date, r => ({ ...r, close: undefined }));

  const editedCount = day.lines.filter(l => touched[l.productId] || draft.binned[l.productId]).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)' }}>
      <FjDayStrip shopId={shopId} dates={FJ_DAY_STRIP_DATES} selectedDate={date} onSelect={onDateChange} />

      <div style={captionStrip}>
        <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>{date === FJ_DEMO_TODAY ? 'Close tonight' : `Close ${weekdayLabel(date)} ${date}`}</span>
        <span>· {shop?.name ?? shopId}</span>
        <span>· closes {shop?.closesAt ?? ''}</span>
      </div>

      <div style={{ padding: '16px 30px 48px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {locked && saved ? (
          <div style={confirmedBanner}>
            <Lock size={14} color="var(--color-text-muted)" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={bannerTitle}>Count confirmed. {longDay(effect.tomorrow)}&rsquo;s plan is adjusted.</span>
              <span style={bannerSub}>
                Counted {new Date(saved.countedAtISO).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} by {saved.countedBy}
                {' · '}{unitsLabel(totals.carriedUnits, 'container')} carried, about {totals.carriedPortions} portions
                {totals.binnedUnits > 0 && ` · ${unitsLabel(totals.binnedUnits, 'container')} to waste, ${gbp(totals.wastePounds)}`}
              </span>
            </div>
            <button type="button" onClick={reopen} style={reopenButton}>
              <LockOpen size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Reopen count
            </button>
          </div>
        ) : (
          <div style={draftBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={draftIcon}><EdifyMark size={16} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={bannerTitle}>Fridge count</span>
                <span style={bannerSub}>
                  {day.lines.length} items to count
                  {editedCount > 0 && ` · ${editedCount} changed from Edify's draft`}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
              <div style={statRow}>
                <Stat label="Carried" value={fmtUnits(totals.carriedUnits)} sub="containers" />
                <Stat label="To waste" value={totals.binnedUnits > 0 ? gbp(totals.wastePounds) : '£0'} sub={totals.binnedUnits > 0 ? `${fmtUnits(totals.binnedUnits)} containers` : 'nothing binned'} />
                <Stat label={`${weekdayLabel(effect.tomorrow)} main line`} value={totals.tomorrowDelta === 0 ? '0' : `${totals.tomorrowDelta > 0 ? '+' : '−'}${fmtUnits(Math.abs(totals.tomorrowDelta))}`} sub="containers" tone={totals.tomorrowDelta < 0 ? 'success' : undefined} />
              </div>
              <button type="button" onClick={confirm} style={primaryButton}>
                <ClipboardCheck size={14} /> Confirm count
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={rowHead}>
            <span style={colHead}>Item</span>
            <span style={{ ...colHead, textAlign: 'center' }}>In the fridge</span>
            <span style={{ ...colHead, textAlign: 'center' }}>{weekdayLabel(effect.tomorrow)}&rsquo;s plan</span>
            <span style={{ ...colHead, textAlign: 'right' }}>Waste</span>
          </div>
          {day.lines.map(line => (
            <CloseRow
              key={line.productId}
              line={line}
              counted={draft.counted[line.productId] ?? 0}
              binned={draft.binned[line.productId]}
              touched={Boolean(touched[line.productId])}
              effect={effect.byProduct[line.productId]}
              locked={locked}
              wasteOpen={Boolean(wasteOpen[line.productId]) || Boolean(draft.binned[line.productId])}
              onToggleWaste={() => setWasteOpen(w => ({ ...w, [line.productId]: !w[line.productId] }))}
              onCounted={u => setCounted(line.productId, u)}
              onBinned={(u, r) => setBinned(line.productId, u, r)}
              onReset={() => resetLine(line)}
            />
          ))}
          {day.lines.length === 0 && <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 4px' }}>Nothing to count on {longDate(date)}.</div>}
        </div>

        {day.notCarried.length > 0 && (
          <section style={{ marginTop: 10 }}>
            <div style={{ ...colHead, padding: '0 4px 8px' }}>Not carried</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {day.notCarried.map(line => (
                <div key={line.productId} style={{ ...rowCard, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={rowTitle}>{line.product.name}</div>
                    <div style={rowSub}>{made(line)} · {line.notCarriedReason}</div>
                  </div>
                  <StatusPill tone="neutral" size="xs" label="Binned at close" />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function made(line: CloseLine): string {
  const b = batchesSentence(line.plan.batches);
  const carried = line.plan.carriedGrams > 0 ? ` + ${portionsOf(line.product, line.plan.carriedGrams)} portions carried in` : '';
  return `Made ${b}${carried} · about ${portionsOf(line.product, line.soldGrams)} portions sold`;
}

function CloseRow({
  line, counted, binned, touched, effect, locked, wasteOpen, onToggleWaste, onCounted, onBinned, onReset,
}: {
  line: CloseLine;
  counted: number;
  binned?: { units: number; reason: string };
  touched: boolean;
  effect?: { before: number; after: number; unitName: string };
  locked: boolean;
  wasteOpen: boolean;
  onToggleWaste: () => void;
  onCounted: (units: number) => void;
  onBinned: (units: number, reason?: string) => void;
  onReset: () => void;
}) {
  const delta = effect ? effect.after - effect.before : 0;
  const edited = touched || Boolean(binned);
  return (
    <div style={{ ...rowCard, borderColor: edited && !locked ? 'var(--color-accent-active)' : 'var(--color-border-subtle)' }}>
      <div style={rowGrid}>
        <div style={{ minWidth: 0 }}>
          <div style={rowTitle}>{line.product.name}</div>
          <div style={rowSub}>{made(line)} · use by {line.useBy}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            {locked ? (
              <StatusPill tone="success" size="xs" label="Counted" />
            ) : edited ? (
              <>
                <StatusPill tone="info" size="xs" label="Edited" />
                <button type="button" onClick={onReset} style={linkButton} title="Back to Edify's draft"><Undo2 size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Edify&rsquo;s draft {fmtUnits(line.expectedUnits)}</button>
              </>
            ) : (
              <StatusPill tone="neutral" size="xs" label="Edify draft" />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <QtyStepper
            size="default"
            disabled={locked}
            canDecrement={counted > 0}
            onDecrement={() => onCounted(counted - 0.5)}
            onIncrement={() => onCounted(counted + 0.5)}
            decrementLabel={`Half a ${line.unitName.toLowerCase()} less of ${line.product.name}`}
            incrementLabel={`Half a ${line.unitName.toLowerCase()} more of ${line.product.name}`}
          >
            <span style={{ minWidth: 40, textAlign: 'center', fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtUnits(counted)}</span>
          </QtyStepper>
          <span style={cellSub}>{unitsLabel(counted, line.unitName).replace(/^[\d½.]+ /, '')} · {Math.round(counted * line.portionsPerUnit)} portions</span>
        </div>

        {/* What the count does to tomorrow: lead with the action (make
            fewer), then the number it lands on. */}
        <div style={{ textAlign: 'center' }}>
          {effect && delta !== 0 ? (
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: delta < 0 ? 'var(--color-success)' : 'var(--color-warning)', fontVariantNumeric: 'tabular-nums' }}>
                {delta < 0 ? <ArrowDown size={13} /> : <ArrowUp size={13} />} Make {fmtUnits(Math.abs(delta))} {delta < 0 ? 'fewer' : 'more'}
              </span>
              <span style={cellSub}>Main line {effect.after} {plural(effect.after, effect.unitName.toLowerCase())}, was {effect.before}</span>
            </div>
          ) : effect && counted > 0 ? (
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)' }}>Same plan</span>
              <span style={cellSub}>Main line stays {effect.after}, carry is under one</span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Nothing carried</span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {!wasteOpen ? (
            <button type="button" onClick={onToggleWaste} disabled={locked} style={{ ...secondaryButtonSmall, opacity: locked ? 0.5 : 1 }}>
              <Trash2 size={11} /> Waste
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                aria-label={`Waste reason for ${line.product.name}`}
                value={binned?.reason ?? WASTE_REASONS[0]}
                disabled={locked}
                onChange={e => onBinned(binned?.units ?? 0.5, e.target.value)}
                style={selectStyle}
              >
                {WASTE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <QtyStepper
                size="compact"
                disabled={locked}
                canDecrement={(binned?.units ?? 0) > 0}
                onDecrement={() => onBinned((binned?.units ?? 0) - 0.5)}
                onIncrement={() => onBinned((binned?.units ?? 0) + 0.5)}
                decrementLabel={`Half a container less of ${line.product.name} to waste`}
                incrementLabel={`Half a container more of ${line.product.name} to waste`}
              >
                <span style={{ minWidth: 30, textAlign: 'center', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: (binned?.units ?? 0) > 0 ? 'var(--color-error)' : 'var(--color-text-primary)' }}>{fmtUnits(binned?.units ?? 0)}</span>
              </QtyStepper>
              {!locked && !binned && (
                <button type="button" onClick={onToggleWaste} aria-label="Close waste" style={{ ...linkButton, textDecoration: 'none' }}>×</button>
              )}
            </div>
          )}
        </div>
      </div>
      {locked && binned && (
        <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-text-secondary)' }}>
          <CheckCircle2 size={12} color="var(--color-text-muted)" /> {unitsLabel(binned.units, 'container')} binned · {binned.reason}
        </div>
      )}
    </div>
  );
}

/** Three fixed rows (label, value, sub) so the stats sit on one baseline
 *  whatever their content; the sub always renders, blank if there is none. */
function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'success' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, minWidth: 92, padding: '0 16px', borderLeft: '1px solid var(--color-border-subtle)' }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', lineHeight: '12px' }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: '20px', color: tone === 'success' ? 'var(--color-success)' : 'var(--color-text-primary)' }}>{value}</span>
      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', lineHeight: '12px' }}>{sub ?? '\u00a0'}</span>
    </div>
  );
}

function batchesSentence(b: { full: number; half: number }): string {
  const n = b.full + b.half * 0.5;
  if (n === 0) return 'nothing';
  return `${fmtUnits(n)} ${n === 1 ? 'batch' : 'batches'}`;
}

function fmtUnits(n: number): string {
  if (n % 1 === 0) return String(n);
  const whole = Math.floor(n);
  return whole === 0 ? '½' : `${whole}½`;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// ─── Styles (from DayPlan / PlanConfirmBar so Run reads as one product) ──────

const captionStrip: CSSProperties = { padding: '8px 30px', background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-muted)', flexWrap: 'wrap' };
const statRow: CSSProperties = { display: 'flex', alignItems: 'stretch' };
const bannerTitle: CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' };
const bannerSub: CSSProperties = { fontSize: 11, color: 'var(--color-text-secondary)' };
const confirmedBanner: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)' };
const draftBar: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', boxShadow: '0 1px 2px rgba(12,20,44,0.06)', flexWrap: 'wrap' };
const draftIcon: CSSProperties = { width: 32, height: 32, flexShrink: 0, borderRadius: 9, background: 'var(--color-info-light)', color: 'var(--color-info)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const primaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: 40, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-primary)', background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', border: '1px solid var(--color-accent-active)', cursor: 'pointer', whiteSpace: 'nowrap' };
const reopenButton: CSSProperties = { marginLeft: 'auto', flexShrink: 0, padding: '6px 12px', fontSize: 11, fontWeight: 700, background: '#ffffff', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-primary)' };
const secondaryButtonSmall: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', fontFamily: 'var(--font-primary)', background: '#ffffff', color: 'var(--color-text-secondary)', border: '1.5px solid var(--color-border)', cursor: 'pointer', lineHeight: 1 };
const linkButton: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--color-link)', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-primary)', textDecoration: 'underline' };
const rowCard: CSSProperties = { background: '#ffffff', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', boxShadow: '0 1px 2px rgba(12,20,44,0.04)' };
const rowGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px 200px 300px', alignItems: 'center', gap: 16, padding: '12px 16px' };
const rowHead: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px 200px 300px', gap: 16, padding: '0 16px' };
const colHead: CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' };
const rowTitle: CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' };
const rowSub: CSSProperties = { fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 };
const cellSub: CSSProperties = { fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' };
const selectStyle: CSSProperties = { height: 30, padding: '0 8px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#ffffff', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)' };

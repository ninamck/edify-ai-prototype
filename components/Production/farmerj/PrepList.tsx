'use client';

import { useCallback, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { Layers, Printer, RotateCcw, Store } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import QtyStepper from '@/components/Production/QtyStepper';
import StatusPill from '@/components/Production/StatusPill';
import { kg } from './cascade';
import { addDays, FJ_DAY_STRIP_DATES, FJ_DEMO_TODAY, longDate, shortDate, weekdayLabel, weekdayOf } from './calendar';
import { FjDayStrip, Notice } from './DayPlan';
import { useFjPlanStore } from './FjPlanStore';
import { computePrepDay, isDeepClean, qtyLabel, type PrepCard, type PrepDay, type PrepLine } from './prep';
import { WEEKDAY_LABELS } from './recipes';
import { fohReminders, type FohReminder } from './sales';
import { FJ_ALL_SHOPS_ID, getShop } from './shops';

/**
 * Prep list. Built on the Pret Run sheet chassis (sticky toolbar with a
 * segmented switcher and Print, cards tiled in a grid, name left and
 * quantity right) with the Day plan's day strip on top so Run reads as
 * one product. Two views: the make list (what to make, in the unit the
 * label is written in) and the weigh-up (what goes into each make).
 *
 * Front of house sits at the end of the make list: defrost, fridge fill
 * and till tubs are done tonight for tomorrow, the same rhythm as the
 * make-ahead prep, so they print on the same sheet (Nina, 3 Sep 2026).
 */

type ViewMode = 'make' | 'weigh';

export default function PrepList() {
  const searchParams = useSearchParams();
  const linked = searchParams?.get('date') ?? null;
  const { isFarmerJ, productionSiteId } = useActiveSite();
  const [date, setDate] = useState(linked && /^\d{4}-\d{2}-\d{2}$/.test(linked) ? linked : FJ_DEMO_TODAY);
  const shopId = productionSiteId ?? FJ_ALL_SHOPS_ID;

  if (!isFarmerJ) return <Notice>Switch the Brand pill in demo controls to Farmer J to see this screen.</Notice>;
  if (shopId === FJ_ALL_SHOPS_ID) return <Notice>Pick a shop in the site switcher to see its prep list.</Notice>;
  return <PrepListForShop shopId={shopId} date={date} onDateChange={setDate} />;
}

function usePrepDay(shopId: string, date: string) {
  const store = useFjPlanStore();
  const prep = useMemo(() => computePrepDay(shopId, date, store.get), [shopId, date, store]);
  const setQty = useCallback(
    (componentId: string, qty: number | undefined) =>
      store.update(shopId, date, r => {
        const prepOverrides = { ...(r.prepOverrides ?? {}) };
        if (qty === undefined) delete prepOverrides[componentId];
        else prepOverrides[componentId] = qty;
        return { ...r, prepOverrides };
      }),
    [store, shopId, date],
  );
  return { prep, setQty };
}

function PrepListForShop({ shopId, date, onDateChange }: { shopId: string; date: string; onDateChange: (d: string) => void }) {
  const shop = getShop(shopId);
  const { prep, setQty } = usePrepDay(shopId, date);
  const [view, setView] = useState<ViewMode>('make');
  const isToday = date === FJ_DEMO_TODAY;

  const weighLines = prep.lines;
  const fohDate = addDays(date, 1);
  const foh = useMemo(() => fohReminders(shopId, fohDate), [shopId, fohDate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)' }}>
      <FjDayStrip shopId={shopId} dates={FJ_DAY_STRIP_DATES} selectedDate={date} onSelect={onDateChange} />

      <div style={captionStrip}>
        <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>{isToday ? 'Prep today' : `Prep ${weekdayLabel(date)} ${date}`}</span>
        {isDeepClean(shopId, date) && <span>· deep clean, daily prep only</span>}
        <span style={{ marginLeft: 'auto', textAlign: 'right' }}>{makeOnSummary(prep.aheadGroups, date)}</span>
      </div>

      <div style={{ padding: '16px 30px 48px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={toolbar}>
          <ViewSwitcher view={view} onChange={setView} makeCount={prep.lines.length} weighCount={weighLines.length} />
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {prep.lines.length} {prep.lines.length === 1 ? 'item' : 'items'} · {kg(prep.totals.gramsMade)}
            {prep.totals.overridden > 0 && ` · ${prep.totals.overridden} set by hand`}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={() => printPrep(view, prep.cards, date, shop?.name ?? shopId, foh)} style={printButton} title="Print this sheet">
              <Printer size={15} /> Print
            </button>
          </div>
        </div>

        {prep.lines.length === 0 && foh.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Nothing to prep on {longDate(date)}.</div>
        ) : view === 'make' ? (
          <div style={grid}>
            {prep.cards.map(card => (
              <MakeCard key={card.id} card={card} date={date} onQty={setQty} />
            ))}
            {foh.length > 0 && <FohCard reminders={foh} date={fohDate} />}
          </div>
        ) : (
          <div style={grid}>
            {weighLines.map(line => (
              <WeighCard key={line.componentId} line={line} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Make list ────────────────────────────────────────────────────────────────

function coversLabel(card: PrepCard, date: string): string {
  if (card.reason === 'today') return 'today';
  if (card.reason === 'tomorrow') return `${weekdayLabel(card.covers[0])} ${card.covers[0].slice(8, 10)}`;
  const first = card.covers[0];
  const last = card.covers[card.covers.length - 1];
  if (first === last) return first === date ? 'today' : shortDate(first);
  return `${first === date ? 'today' : weekdayLabel(first)} to ${weekdayLabel(last)}`;
}

type AheadGroupDays = PrepDay['aheadGroups'][number];

/** The one-line strip above the cards: which make-ahead groups today covers, and when the rest come round. */
function makeOnSummary(groups: AheadGroupDays[], date: string): string {
  const wd = weekdayOf(date);
  const on = groups.filter(g => g.makeOn).map(g => g.group.short);
  const off = groups.filter(g => !g.makeOn).map(g => {
    const next = g.days.map(d => (d - wd + 7) % 7 || 7).sort((a, b) => a - b)[0];
    return next === undefined ? `${g.group.short} never here` : `${g.group.short} on ${WEEKDAY_LABELS[(wd + next) % 7]}`;
  });
  const a = on.length ? `Make-ahead today: ${on.join(', ')}.` : 'No make-ahead today.';
  const b = off.length ? ` Next: ${off.join(', ')}.` : '';
  return a + b;
}

function MakeCard({ card, date, onQty }: { card: PrepCard; date: string; onQty: (id: string, qty: number | undefined) => void }) {
  return (
    <section style={cardStyle}>
      <header style={cardHeader}>
        {card.group && <span style={{ width: 8, height: 8, borderRadius: 4, background: card.group.colour, flexShrink: 0 }} />}
        <h2 style={cardTitle}>{card.title}</h2>
        <span style={cardMeta}>{card.lines.length} {card.lines.length === 1 ? 'item' : 'items'}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>Covers </span>
          {coversLabel(card, date)}
        </span>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 190px', gap: 10, padding: '4px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <span style={colHead}>Make</span>
        <span style={{ ...colHead, textAlign: 'right' }}>Quantity</span>
      </div>
      {card.lines.map((line, i) => (
        <MakeRow key={line.componentId} line={line} isLast={i === card.lines.length - 1} onQty={onQty} />
      ))}
    </section>
  );
}

function MakeRow({ line, isLast, onQty }: { line: PrepLine; isLast: boolean; onQty: (id: string, qty: number | undefined) => void }) {
  const u = line.unit;
  const changed = line.plannedQty !== line.suggestedQty;
  const consumers = line.consumers.filter(c => c.ref !== 'till').map(c => c.name);
  const dec = () => onQty(line.componentId, Math.max(u.min, round(line.plannedQty - u.step)));
  const inc = () => onQty(line.componentId, u.max ? Math.min(u.max, round(line.plannedQty + u.step)) : round(line.plannedQty + u.step));
  return (
    <div role="listitem" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 190px', gap: 10, alignItems: 'center', padding: '7px 14px', borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)' }}>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>{line.component.name}</span>
          {line.shared && <StatusPill tone="info" size="xs" label="Shared" />}
          {line.overridden && <StatusPill tone="info" size="xs" label="Edited" />}
        </div>
        {consumers.length > 0 && (
          <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
            for {consumers.join(', ')}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <QtyStepper
            size="compact"
            canDecrement={line.plannedQty > u.min}
            canIncrement={u.max === undefined || line.plannedQty < u.max}
            onDecrement={dec}
            onIncrement={inc}
            decrementLabel={`One ${u.step === 0.5 ? 'half ' : ''}${u.noun} fewer`}
            incrementLabel={`One ${u.step === 0.5 ? 'half ' : ''}${u.noun} more`}
          >
            <span style={{ minWidth: 92, textAlign: 'center', fontSize: 12.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: changed ? 'var(--color-info)' : 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
              {qtyLabel(line)}
            </span>
          </QtyStepper>
        </div>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          {changed ? (
            <>
              fc {qtyLabel(line, line.suggestedQty)}
              <button type="button" onClick={() => onQty(line.componentId, undefined)} style={clearButton} title="Back to Edify's number">
                <RotateCcw size={9} /> clear
              </button>
            </>
          ) : (
            <>
              {kg(line.gramsMade)}
              {line.containers && ` · ${line.containers.count} ${line.containers.name.toLowerCase()}${line.containers.count === 1 ? '' : 's'}`}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 2) / 2;
}

// ─── Weigh up ─────────────────────────────────────────────────────────────────

function WeighCard({ line }: { line: PrepLine }) {
  const subs = line.inputs.filter(i => i.kind === 'component');
  const ings = line.inputs.filter(i => i.kind === 'ingredient');
  return (
    <section style={cardStyle}>
      <header style={cardHeader}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: line.group.colour, flexShrink: 0 }} />
        <h2 style={cardTitle}>{line.component.name}</h2>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'baseline', gap: 4, fontSize: 13, fontWeight: 700, color: changedColour(line), fontVariantNumeric: 'tabular-nums' }}>
          {qtyLabel(line)}
          {line.component.yieldLossPct > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              · {kg(line.grossGrams)} in, {kg(line.gramsMade)} out
            </span>
          )}
        </span>
      </header>
      {subs.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 14px', background: 'rgba(0, 28, 53, 0.03)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: 'var(--color-accent-mid)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Layers size={11} /> From the prep list
          </span>
        </div>
      )}
      {subs.map((i, idx) => (
        <InputRow key={i.ref} input={i} isLast={ings.length === 0 && idx === subs.length - 1} />
      ))}
      {subs.length > 0 && ings.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 14px', background: 'rgba(0, 28, 53, 0.03)', borderTop: '1px solid var(--color-border-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Weigh up</span>
        </div>
      )}
      {ings.map((i, idx) => (
        <InputRow key={i.ref} input={i} isLast={idx === ings.length - 1} />
      ))}
    </section>
  );
}

function changedColour(line: PrepLine): string {
  return line.plannedQty !== line.suggestedQty ? 'var(--color-info)' : 'var(--color-text-secondary)';
}

function InputRow({ input, isLast }: { input: PrepLine['inputs'][number]; isLast: boolean }) {
  return (
    <div role="listitem" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 150px', gap: 12, alignItems: 'center', padding: '6px 14px', borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)' }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>{input.name}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{kg(input.grams)}</span>
        {input.packs !== undefined && input.packs > 0 && (
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {input.packs} × {input.packLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Front of house ───────────────────────────────────────────────────────────

/** Tonight-for-tomorrow jobs on the shop floor side: defrost, fridge fill, till tubs. */
function FohCard({ reminders, date }: { reminders: FohReminder[]; date: string }) {
  return (
    <section style={cardStyle} aria-label="Front of house">
      <header style={cardHeader}>
        <Store size={13} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
        <h2 style={cardTitle}>Front of house</h2>
        <span style={cardMeta}>{reminders.length} {reminders.length === 1 ? 'job' : 'jobs'}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>Covers </span>
          {weekdayLabel(date)} {date.slice(8, 10)}
        </span>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', padding: '4px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <span style={colHead}>Tonight, for tomorrow</span>
      </div>
      {reminders.map((r, i) => (
        <div key={r.id} role="listitem" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '7px 14px', borderBottom: i === reminders.length - 1 ? 'none' : '1px solid var(--color-border-subtle)' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>{r.label}</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{r.detail}</span>
        </div>
      ))}
    </section>
  );
}

// ─── View switcher (same segmented control as the Run sheet) ──────────────────

function ViewSwitcher({ view, onChange, makeCount, weighCount }: { view: ViewMode; onChange: (v: ViewMode) => void; makeCount: number; weighCount: number }) {
  const tabs: Array<{ id: ViewMode; label: string; count: number }> = [
    { id: 'make', label: 'Make list', count: makeCount },
    { id: 'weigh', label: 'Weigh up', count: weighCount },
  ];
  return (
    <div role="tablist" aria-label="Prep list view" style={{ display: 'flex', background: 'var(--color-bg-hover)', borderRadius: 100, padding: 3, width: 'fit-content' }}>
      {tabs.map(tab => {
        const active = tab.id === view;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{ padding: '8px 18px', borderRadius: 100, border: 'none', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer', background: active ? 'var(--color-accent-active)' : 'transparent', color: active ? '#fff' : 'var(--color-text-secondary)', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            {tab.label}
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: active ? 'rgba(255,255,255,0.25)' : 'var(--color-border-subtle)', color: active ? '#fff' : 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Print ────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function printPrep(view: ViewMode, cards: PrepCard[], date: string, shopName: string, foh: FohReminder[] = []) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return;
  const title = view === 'make' ? 'Make list' : 'Weigh up';
  const body = view === 'make'
    ? cards.map(card => `
        <section>
          <h2>${esc(card.title)} <span class="meta">covers ${esc(coversLabel(card, date))}</span></h2>
          <table>
            <thead><tr><th>Make</th><th class="r">Quantity</th><th class="r">Made by</th></tr></thead>
            <tbody>${card.lines.map(l => `
              <tr>
                <td>${esc(l.component.name)}<div class="sub">${esc(l.consumers.filter(c => c.ref !== 'till').map(c => c.name).join(', '))}</div></td>
                <td class="r"><strong>${esc(qtyLabel(l))}</strong><div class="sub">${esc(kg(l.gramsMade))}${l.containers ? ` · ${l.containers.count} ${esc(l.containers.name.toLowerCase())}` : ''}</div></td>
                <td class="r line"></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </section>`).join('') + (foh.length === 0 ? '' : `
        <section>
          <h2>Front of house <span class="meta">tonight, for ${esc(weekdayLabel(addDays(date, 1)))} ${Number(addDays(date, 1).slice(8, 10))}</span></h2>
          <table>
            <thead><tr><th>Job</th><th class="r">Done by</th></tr></thead>
            <tbody>${foh.map(r => `
              <tr><td><strong>${esc(r.label)}</strong><div class="sub">${esc(r.detail)}</div></td><td class="r line"></td></tr>`).join('')}
            </tbody>
          </table>
        </section>`)
    : cards.flatMap(c => c.lines).map(l => `
        <section>
          <h2>${esc(l.component.name)} <span class="meta">${esc(qtyLabel(l))}${l.component.yieldLossPct > 0 ? ` · ${esc(kg(l.grossGrams))} in, ${esc(kg(l.gramsMade))} out` : ''}</span></h2>
          <table>
            <tbody>${l.inputs.map(i => `
              <tr><td>${esc(i.name)}</td><td class="r"><strong>${esc(kg(i.grams))}</strong>${i.packs ? `<div class="sub">${i.packs} × ${esc(i.packLabel ?? '')}</div>` : ''}</td></tr>`).join('')}
            </tbody>
          </table>
        </section>`).join('');
  w.document.write(`<!doctype html><html><head><title>${esc(title)} · ${esc(shopName)} · ${esc(longDate(date))}</title>
    <style>
      body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;margin:24px;font-size:12px}
      h1{font-size:18px;margin:0 0 2px} .top{color:#666;margin-bottom:18px}
      section{break-inside:avoid;margin-bottom:18px} h2{font-size:13px;margin:0 0 6px;border-bottom:2px solid #111;padding-bottom:4px}
      .meta{font-weight:400;color:#666;font-size:11px;margin-left:8px} .rule{margin:0 0 6px;color:#666;font-size:10.5px}
      table{width:100%;border-collapse:collapse} th{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#666;text-align:left;padding:4px 6px;border-bottom:1px solid #ccc}
      td{padding:6px;border-bottom:1px solid #e5e5e5;vertical-align:top} .r{text-align:right} .sub{font-size:10px;color:#666} .line{min-width:110px}
      @media print{body{margin:12mm}}
    </style></head><body>
    <h1>${esc(title)} · ${esc(shopName)}</h1><div class="top">${esc(longDate(date))}</div>${body}
    <script>window.onload=function(){window.print();}</script></body></html>`);
  w.document.close();
}

// ─── Styles (Run sheet chassis) ───────────────────────────────────────────────

const toolbar: CSSProperties = { position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)' };
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 12, alignItems: 'start' };
const cardStyle: CSSProperties = { background: '#ffffff', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', display: 'flex', flexDirection: 'column' };
const cardHeader: CSSProperties = { padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-hover)', borderTopLeftRadius: 'var(--radius-card)', borderTopRightRadius: 'var(--radius-card)' };
const cardTitle: CSSProperties = { margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' };
const cardMeta: CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const colHead: CSSProperties = { fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const printButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-primary)', cursor: 'pointer' };
const captionStrip: CSSProperties = { padding: '8px 30px', background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-muted)', flexWrap: 'wrap' };
const clearButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 4px', border: 'none', background: 'transparent', color: 'var(--color-info)', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-primary)' };

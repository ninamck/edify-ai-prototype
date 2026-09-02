'use client';

import { Fragment, useCallback, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Download, Printer } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import QtyStepper from '@/components/Production/QtyStepper';
import StatusPill from '@/components/Production/StatusPill';
import { combineSectionsToCsv, triggerCsvDownload, type CsvSection } from '@/lib/csvExport';
import { gbp, kg } from './cascade';
import { FJ_DEMO_TODAY, shortDate, weekdayLabel } from './calendar';
import { Notice } from './DayPlan';
import { useFjPlanStore } from './FjPlanStore';
import { computeOrderSheet, windowLabel, windowsFrom, type MakeLine, type OrderLine, type OrderSheet as OrderSheetModel, type PlanningWindow } from './ordering';
import { FJ_ALL_SHOPS_ID, getShop } from './shops';

/**
 * Order sheet. The Day plan's table chassis (sticky first column, group
 * header rows, totals foot) with the Prep list's toolbar (segmented
 * switcher, Print). A window selector replaces the day strip because the
 * sheet covers the days a manager set together.
 */

type ViewMode = 'make' | 'order';

export default function OrderSheet() {
  const { isFarmerJ, productionSiteId } = useActiveSite();
  const shopId = productionSiteId ?? FJ_ALL_SHOPS_ID;
  if (!isFarmerJ) return <Notice>Switch the Brand pill in demo controls to Farmer J to see this screen.</Notice>;
  if (shopId === FJ_ALL_SHOPS_ID) return <Notice>Pick a shop in the site switcher to see its order sheet.</Notice>;
  return <OrderSheetForShop shopId={shopId} />;
}

function OrderSheetForShop({ shopId }: { shopId: string }) {
  const store = useFjPlanStore();
  const shop = getShop(shopId);
  const windows = useMemo(() => windowsFrom(FJ_DEMO_TODAY), []);
  const [windowIdx, setWindowIdx] = useState(0);
  const [view, setView] = useState<ViewMode>('make');
  const w = windows[windowIdx];
  const sheet = useMemo(() => computeOrderSheet(shopId, w, store.get, store.get(shopId, w.setOn).stock ?? {}), [shopId, w, store]);

  const setStock = useCallback(
    (ingredientId: string, packs: number) =>
      store.update(shopId, w.setOn, r => {
        const next = { ...(r.stock ?? {}) };
        if (packs <= 0) delete next[ingredientId];
        else next[ingredientId] = packs;
        return { ...r, stock: next };
      }),
    [store, shopId, w.setOn],
  );

  const exportCsv = () => triggerCsvDownload(`farmer-j-order-sheet-${shopId}-${w.from}`, combineSectionsToCsv(csvSections(sheet)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)' }}>
      <WindowStrip windows={windows} selected={windowIdx} onSelect={setWindowIdx} />

      <div style={captionStrip}>
        <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>{windowLabel(w)}</span>
        <span>· set {shortDate(w.setOn)}</span>
        <span>· {sheet.days.length} trading {sheet.days.length === 1 ? 'day' : 'days'}</span>
        <span>· {shop?.name ?? shopId}</span>
      </div>

      <div style={{ padding: '16px 30px 48px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={toolbar}>
          <ViewSwitcher view={view} onChange={setView} makeCount={sheet.totals.makeLines} orderCount={sheet.totals.ingredients} />
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {view === 'make'
              ? `${sheet.totals.makeLines} sub-recipes across ${sheet.days.length} days`
              : `${sheet.totals.packs} packs needed · ${sheet.totals.toOrder} to order · ${gbp(sheet.totals.costPounds)}${sheet.totals.overridden > 0 ? ` · ${sheet.totals.overridden} changed by prep edits` : ''}`}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={exportCsv} style={printButton} title="Download as CSV">
              <Download size={15} /> CSV
            </button>
            <button type="button" onClick={() => printSheet(sheet, view, shop?.name ?? shopId)} style={printButton} title="Print this sheet">
              <Printer size={15} /> Print
            </button>
          </div>
        </div>

        {view === 'make' ? <MakeTable sheet={sheet} /> : <OrderTable sheet={sheet} onStock={setStock} />}
      </div>
    </div>
  );
}

// ─── Window strip ─────────────────────────────────────────────────────────────

function WindowStrip({ windows, selected, onSelect }: { windows: PlanningWindow[]; selected: number; onSelect: (i: number) => void }) {
  return (
    <div role="tablist" aria-label="Planning window" style={{ display: 'flex', gap: 8, padding: '14px 30px 12px', borderBottom: '1px solid var(--color-border-subtle)', background: '#ffffff' }}>
      {windows.map((w, i) => {
        const active = i === selected;
        const current = w.days.includes(FJ_DEMO_TODAY);
        return (
          <button
            key={w.from}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(i)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, minWidth: 170, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`,
              background: active ? 'var(--color-accent-active)' : '#ffffff',
              color: active ? 'var(--color-text-on-active)' : 'var(--color-text-primary)',
              fontFamily: 'var(--font-primary)',
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.8 }}>{current ? 'This window' : i === 1 ? 'Next window' : 'Following'}</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{windowLabel(w)}</span>
            <span style={{ fontSize: 10, opacity: 0.8 }}>Set {shortDate(w.setOn)}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── What to make ─────────────────────────────────────────────────────────────

function MakeTable({ sheet }: { sheet: OrderSheetModel }) {
  const colCount = 2 + sheet.days.length;
  return (
    <div style={tableWrap}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={headStyle({ left: true, sticky: true, minWidth: 260 })}>Sub-recipe</th>
            {sheet.days.map(d => (
              <th key={d} style={headStyle({ minWidth: 110 })}>
                <div>{weekdayLabel(d)}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 2 }}>{Number(d.slice(8, 10))}</div>
              </th>
            ))}
            <th style={headStyle({ minWidth: 110, totalCol: true })}>Window</th>
          </tr>
        </thead>
        <tbody>
          {sheet.make.map(group => (
            <Fragment key={group.kind}>
              <tr>
                <td colSpan={colCount} style={groupRow}>
                  <span style={groupLabel}>{group.label}</span>
                  <span style={groupMeta}>{group.lines.length} {group.lines.length === 1 ? 'item' : 'items'}</span>
                </td>
              </tr>
              {group.lines.map(line => <MakeRow key={line.componentId} line={line} days={sheet.days} />)}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MakeRow({ line, days }: { line: MakeLine; days: string[] }) {
  return (
    <tr>
      <td style={bodyStyle({ left: true, sticky: true })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700 }}>{line.component.name}</span>
          {line.overridden && <StatusPill tone="info" size="xs" label="Edited" />}
        </div>
      </td>
      {days.map(d => {
        const c = line.perDay[d];
        return (
          <td key={d} style={bodyStyle({})}>
            {c ? (
              <>
                <span style={{ ...numStyle, color: c.overridden ? 'var(--color-info)' : 'var(--color-text-primary)' }}>{c.qtyLabel}</span>
                {c.suggestedLabel && <div style={cellSub}>Edify {c.suggestedLabel}</div>}
              </>
            ) : (
              <span style={{ color: 'var(--color-text-muted)' }}>—</span>
            )}
          </td>
        );
      })}
      <td style={bodyStyle({ totalCol: true })}>
        <span style={numStyle}>{kg(line.totalGramsMade)}</span>
      </td>
    </tr>
  );
}

// ─── What to order ────────────────────────────────────────────────────────────

function OrderTable({ sheet, onStock }: { sheet: OrderSheetModel; onStock: (id: string, packs: number) => void }) {
  return (
    <div style={tableWrap}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={headStyle({ left: true, sticky: true, minWidth: 260 })}>Ingredient</th>
            <th style={headStyle({ left: true, minWidth: 220 })}>Used in</th>
            <th style={headStyle({ minWidth: 100 })}>Needed</th>
            <th style={headStyle({ minWidth: 120 })}>Pack</th>
            <th style={headStyle({ minWidth: 90 })}>Packs</th>
            <th style={headStyle({ minWidth: 140 })}>In stock</th>
            <th style={headStyle({ minWidth: 100, totalCol: true })}>To order</th>
          </tr>
        </thead>
        <tbody>
          {sheet.order.map(group => (
            <Fragment key={group.supplier}>
              <tr>
                <td colSpan={7} style={groupRow}>
                  <span style={groupLabel}>{group.supplier}</span>
                  <span style={groupMeta}>{group.lines.length} {group.lines.length === 1 ? 'line' : 'lines'} · {group.toOrder} to order</span>
                </td>
              </tr>
              {group.lines.map(line => <OrderRow key={line.ingredientId} line={line} onStock={onStock} />)}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={footStyle({ left: true, sticky: true })}>Total</td>
            <td style={footStyle({})} />
            <td style={footStyle({})} />
            <td style={footStyle({})} />
            <td style={footStyle({})}>{sheet.totals.packs}</td>
            <td style={footStyle({})} />
            <td style={footStyle({ totalCol: true })}>{sheet.totals.toOrder}</td>
          </tr>
          <tr>
            <td style={footSubStyle({ left: true, sticky: true })}>Cost to order</td>
            <td style={footSubStyle({})} />
            <td style={footSubStyle({})} />
            <td style={footSubStyle({})} />
            <td style={footSubStyle({})} />
            <td style={footSubStyle({})} />
            <td style={footSubStyle({ totalCol: true })}>{gbp(sheet.totals.costPounds)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function OrderRow({ line, onStock }: { line: OrderLine; onStock: (id: string, packs: number) => void }) {
  const ing = line.ingredient;
  return (
    <tr>
      <td style={bodyStyle({ left: true, sticky: true })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700 }}>{ing.name}</span>
          {line.overridden && <StatusPill tone="info" size="xs" label="Edited" />}
          {ing.frozen && <StatusPill tone="neutral" size="xs" label="Frozen" />}
          {ing.daily && <StatusPill tone="neutral" size="xs" label="Daily" />}
        </div>
      </td>
      <td style={{ ...bodyStyle({ left: true }), fontSize: 11, color: 'var(--color-text-secondary)' }} title={line.usedBy.join(', ')}>{usedByLabel(line.usedBy)}</td>
      <td style={bodyStyle({})}><span style={numStyle}>{kg(line.grams)}</span></td>
      <td style={{ ...bodyStyle({}), fontSize: 11, color: 'var(--color-text-secondary)' }}>{ing.pack.label}</td>
      <td style={bodyStyle({})}>
        <span style={{ ...numStyle, color: line.overridden ? 'var(--color-info)' : 'var(--color-text-primary)' }}>{line.packs}</span>
        {line.overridden && <div style={cellSub}>Edify {line.suggestedPacks}</div>}
      </td>
      <td style={bodyStyle({})}>
        <div style={{ display: 'inline-flex' }}>
          <QtyStepper
            size="compact"
            canDecrement={line.inStock > 0}
            onDecrement={() => onStock(line.ingredientId, line.inStock - 1)}
            onIncrement={() => onStock(line.ingredientId, line.inStock + 1)}
            decrementLabel={`One fewer ${ing.pack.label} of ${ing.name} in stock`}
            incrementLabel={`One more ${ing.pack.label} of ${ing.name} in stock`}
          >
            <span style={{ minWidth: 28, textAlign: 'center', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{line.inStock}</span>
          </QtyStepper>
        </div>
      </td>
      <td style={bodyStyle({ totalCol: true })}>
        <span style={{ ...numStyle, fontSize: 14, color: line.toOrder === 0 ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>{line.toOrder}</span>
      </td>
    </tr>
  );
}

// ─── Switcher ─────────────────────────────────────────────────────────────────

function ViewSwitcher({ view, onChange, makeCount, orderCount }: { view: ViewMode; onChange: (v: ViewMode) => void; makeCount: number; orderCount: number }) {
  const tabs: Array<{ id: ViewMode; label: string; count: number }> = [
    { id: 'make', label: 'What to make', count: makeCount },
    { id: 'order', label: 'What to order', count: orderCount },
  ];
  return (
    <div role="tablist" aria-label="Order sheet view" style={{ display: 'flex', background: 'var(--color-bg-hover)', borderRadius: 100, padding: 3, width: 'fit-content' }}>
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

// ─── Export and print ─────────────────────────────────────────────────────────

function csvSections(sheet: OrderSheetModel): CsvSection[] {
  const make: CsvSection = {
    label: `What to make, ${windowLabel(sheet.window)}`,
    filenameSlug: 'make',
    headers: ['Group', 'Sub-recipe', ...sheet.days.map(d => `${weekdayLabel(d)} ${d}`), 'Window (kg)', 'Edited'],
    rows: sheet.make.flatMap(g => g.lines.map(l => [
      g.label,
      l.component.name,
      ...sheet.days.map(d => l.perDay[d]?.qtyLabel ?? ''),
      Math.round(l.totalGramsMade / 100) / 10,
      l.overridden ? 'yes' : '',
    ])),
  };
  const order: CsvSection = {
    label: `What to order, ${windowLabel(sheet.window)}`,
    filenameSlug: 'order',
    headers: ['Supplier', 'Ingredient', 'Used in', 'Needed (kg)', 'Pack', 'Packs needed', 'In stock', 'To order', 'Edited'],
    rows: sheet.order.flatMap(g => g.lines.map(l => [
      g.supplier,
      l.ingredient.name,
      l.usedBy.join('; '),
      Math.round(l.grams / 100) / 10,
      l.ingredient.pack.label,
      l.packs,
      l.inStock,
      l.toOrder,
      l.overridden ? 'yes' : '',
    ])),
  };
  return [make, order];
}

function usedByLabel(names: string[]): string {
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function printSheet(sheet: OrderSheetModel, view: ViewMode, shopName: string) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return;
  const title = view === 'make' ? 'What to make' : 'What to order';
  const body = view === 'make'
    ? sheet.make.map(g => `
        <section>
          <h2>${esc(g.label)}</h2>
          <table>
            <thead><tr><th>Sub-recipe</th>${sheet.days.map(d => `<th class="r">${esc(weekdayLabel(d))} ${Number(d.slice(8, 10))}</th>`).join('')}<th class="r">Window</th></tr></thead>
            <tbody>${g.lines.map(l => `
              <tr>
                <td>${esc(l.component.name)}${l.overridden ? ' <span class="tag">edited</span>' : ''}</td>
                ${sheet.days.map(d => `<td class="r">${esc(l.perDay[d]?.qtyLabel ?? '—')}</td>`).join('')}
                <td class="r"><strong>${esc(kg(l.totalGramsMade))}</strong></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </section>`).join('')
    : sheet.order.map(g => `
        <section>
          <h2>${esc(g.supplier)} <span class="meta">${g.toOrder} to order</span></h2>
          <table>
            <thead><tr><th>Ingredient</th><th>Used in</th><th class="r">Needed</th><th>Pack</th><th class="r">Packs</th><th class="r">In stock</th><th class="r">To order</th></tr></thead>
            <tbody>${g.lines.map(l => `
              <tr>
                <td>${esc(l.ingredient.name)}${l.overridden ? ' <span class="tag">edited</span>' : ''}</td>
                <td class="sub">${esc(l.usedBy.join(', '))}</td>
                <td class="r">${esc(kg(l.grams))}</td>
                <td>${esc(l.ingredient.pack.label)}</td>
                <td class="r">${l.packs}</td>
                <td class="r">${l.inStock}</td>
                <td class="r"><strong>${l.toOrder}</strong></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </section>`).join('');
  w.document.write(`<!doctype html><html><head><title>${esc(title)} · ${esc(shopName)} · ${esc(windowLabel(sheet.window))}</title>
    <style>
      body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;margin:24px;font-size:12px}
      h1{font-size:18px;margin:0 0 4px}
      .meta{font-weight:400;color:#666;font-size:11px;margin-left:8px}
      h2{font-size:13px;margin:18px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}
      table{width:100%;border-collapse:collapse}
      th{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#666;text-align:left;padding:4px 6px;border-bottom:1px solid #ddd}
      td{padding:5px 6px;border-bottom:1px solid #eee;vertical-align:top}
      .r{text-align:right;white-space:nowrap}
      .sub{color:#666;font-size:11px}
      .tag{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#1f5fbf;border:1px solid #1f5fbf;border-radius:999px;padding:0 5px;margin-left:6px}
      @media print{body{margin:12mm}}
    </style></head><body>
    <h1>${esc(title)} <span class="meta">${esc(shopName)} · ${esc(windowLabel(sheet.window))} · set ${esc(shortDate(sheet.window.setOn))}</span></h1>
    ${body}
    <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}

// ─── Styles (from DayPlan / PrepList so Plan reads as one product) ────────────

function headStyle({ left, sticky, minWidth, totalCol }: { left?: boolean; sticky?: boolean; minWidth?: number; totalCol?: boolean }): CSSProperties {
  return {
    padding: '10px 8px', background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)',
    textAlign: left ? 'left' : 'center', verticalAlign: 'top',
    position: sticky ? 'sticky' : undefined, left: sticky ? 0 : undefined, zIndex: sticky ? 2 : undefined,
    boxShadow: sticky ? '1px 0 0 var(--color-border-subtle)' : undefined, minWidth,
    fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
    borderLeft: totalCol ? '1px solid var(--color-border-subtle)' : undefined,
  };
}

function bodyStyle({ left, sticky, totalCol }: { left?: boolean; sticky?: boolean; totalCol?: boolean }): CSSProperties {
  return {
    padding: '10px 8px', background: '#ffffff', borderBottom: '1px solid var(--color-border-subtle)',
    textAlign: left ? 'left' : 'center',
    position: sticky ? 'sticky' : undefined, left: sticky ? 0 : undefined, zIndex: sticky ? 1 : undefined,
    boxShadow: sticky ? '1px 0 0 var(--color-border-subtle)' : undefined,
    fontSize: 12, color: 'var(--color-text-primary)', verticalAlign: 'middle',
    borderLeft: totalCol ? '1px solid var(--color-border-subtle)' : undefined,
  };
}

function footStyle({ left, sticky, totalCol }: { left?: boolean; sticky?: boolean; totalCol?: boolean } = {}): CSSProperties {
  return {
    padding: '12px 8px', background: 'var(--color-bg-surface)', borderTop: '2px solid var(--color-border)',
    textAlign: left ? 'left' : 'center',
    position: sticky ? 'sticky' : undefined, left: sticky ? 0 : undefined, zIndex: sticky ? 1 : undefined,
    boxShadow: sticky ? '1px 0 0 var(--color-border-subtle)' : undefined,
    fontSize: left ? 11 : 13, fontWeight: left ? 700 : 600,
    color: left ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
    textTransform: left ? 'uppercase' : undefined, letterSpacing: left ? '0.05em' : undefined, whiteSpace: 'nowrap',
    borderLeft: totalCol ? '1px solid var(--color-border-subtle)' : undefined,
  };
}

function footSubStyle(opts: { left?: boolean; sticky?: boolean; totalCol?: boolean } = {}): CSSProperties {
  return { ...footStyle(opts), padding: '10px 8px', borderTop: '1px solid var(--color-border-subtle)', fontSize: opts.left ? 11 : 12, color: opts.left ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' };
}

const tableWrap: CSSProperties = { background: '#ffffff', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', overflow: 'auto' };
const groupRow: CSSProperties = { padding: '8px 12px', background: 'var(--color-bg-hover)', borderTop: '1px solid var(--color-border-subtle)', borderBottom: '1px solid var(--color-border-subtle)', position: 'sticky', left: 0, zIndex: 1 };
const groupLabel: CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' };
const groupMeta: CSSProperties = { marginLeft: 8, fontSize: 10, color: 'var(--color-text-muted)' };
const numStyle: CSSProperties = { fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--color-text-primary)' };
const cellSub: CSSProperties = { fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' };
const toolbar: CSSProperties = { position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)' };
const printButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-primary)', cursor: 'pointer' };
const captionStrip: CSSProperties = { padding: '8px 30px', background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-muted)', flexWrap: 'wrap' };

'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ClipboardList, Printer } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import StatusPill from '@/components/Production/StatusPill';
import { gbp, portionsOf } from './cascade';
import { FJ_DAY_STRIP_DATES, FJ_DEMO_TODAY, longDate, longDay, weekdayLabel } from './calendar';
import { FjDayStrip, Notice } from './DayPlan';
import { useFjPlanStore } from './FjPlanStore';
import { CHANNEL_LABELS } from './lines';
import { batchesText, computeProductionRecord, type ProductionRecord as RecordModel, type RecordLine } from './productionRecord';
import { FJ_ALL_SHOPS_ID, getShop } from './shops';
import type { SalesChannel } from './salesDay';

/**
 * Production record. The sheet the kitchen used to fill in by hand, filled
 * in by the day: what was planned, what each person ticked as made, what
 * the till sold, what was left at close. Prints to one page for the
 * kitchen wall or the auditor.
 */

export default function RecordScreen() {
  const { isFarmerJ, productionSiteId } = useActiveSite();
  const [date, setDate] = useState(FJ_DEMO_TODAY);
  const shopId = productionSiteId ?? FJ_ALL_SHOPS_ID;

  if (!isFarmerJ) return <Notice>Switch the Brand pill in demo controls to Farmer J to see this screen.</Notice>;
  if (shopId === FJ_ALL_SHOPS_ID) return <Notice>Pick a shop in the site switcher to see its production record.</Notice>;
  return <RecordForShop key={`${shopId}|${date}`} shopId={shopId} date={date} onDateChange={setDate} />;
}

function RecordForShop({ shopId, date, onDateChange }: { shopId: string; date: string; onDateChange: (d: string) => void }) {
  const store = useFjPlanStore();
  const shop = getShop(shopId);
  const isToday = date === FJ_DEMO_TODAY;
  const rec = useMemo(() => computeProductionRecord(shopId, date, store.get, isToday), [shopId, date, store, isToday]);
  const t = rec.totals;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)' }}>
      <FjDayStrip shopId={shopId} dates={FJ_DAY_STRIP_DATES} selectedDate={date} onSelect={onDateChange} />

      <div style={captionStrip}>
        <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>{isToday ? 'Production record today' : `Production record ${weekdayLabel(date)} ${date}`}</span>
        <span>· {shop?.name ?? shopId}</span>
        <span>· {rec.approved ? `plan approved by ${rec.approvedBy ?? 'the manager'}` : 'plan not yet approved'}</span>
        <span>· {rec.closed ? `close counted by ${rec.closedBy}` : 'close not yet counted'}</span>
        <div style={{ marginLeft: 'auto' }}>
          <button type="button" onClick={() => printRecord(rec, shop?.name ?? shopId)} style={ghostButton}><Printer size={14} /> Print</button>
        </div>
      </div>

      <div style={{ padding: '16px 30px 48px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={summaryBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={summaryIcon}><ClipboardList size={16} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={bannerTitle}>{t.ticked} of {t.tasks} make tasks ticked</span>
              <span style={bannerSub}>
                {t.ticked === 0 ? 'Made fills in as the sections tick their tasks.' : `${batchesText(t.madeBatches)} of ${batchesText(t.plannedBatches)} planned batches recorded.`}
                {rec.closed ? ` Variance is against tonight's count.` : ' Variance shows once the close is counted.'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexShrink: 0, flexWrap: 'wrap' }}>
            <Stat label="Planned" value={`${t.plannedPortions.toLocaleString()}`} sub="portions" />
            <Stat label="Made" value={t.ticked ? `${t.madePortions.toLocaleString()}` : '—'} sub="portions" />
            <Stat label="Sold" value={`${t.soldPortions.toLocaleString()}`} sub={`portions · ${gbp(t.soldNet)}`} />
            <Stat label="Left at close" value={rec.closed ? `${t.leftPortions}` : '—'} sub={rec.closed ? `portions · ${t.binnedPortions} binned, ${gbp(t.wastePounds)}` : undefined} />
            <Stat
              label="Variance"
              value={t.variancePortions === undefined ? '—' : `${t.variancePortions > 0 ? '+' : ''}${t.variancePortions}`}
              sub={t.variancePounds === undefined ? undefined : `portions · ${gbp(Math.abs(t.variancePounds))}`}
              tone={t.variancePortions === undefined ? undefined : Math.abs(t.variancePortions) <= Math.max(10, t.soldPortions * 0.03) ? 'success' : 'warning'}
            />
          </div>
        </div>

        <SalesStrip rec={rec} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={rowHead}>
            <span style={colHead}>Item</span>
            <span style={{ ...colHead, textAlign: 'right' }}>Planned</span>
            <span style={{ ...colHead, textAlign: 'right' }}>Made</span>
            <span style={{ ...colHead, textAlign: 'right' }}>Carried in</span>
            <span style={{ ...colHead, textAlign: 'right' }}>Sold</span>
            <span style={{ ...colHead, textAlign: 'right' }}>Left · binned</span>
            <span style={{ ...colHead, textAlign: 'right' }}>Variance</span>
            <span style={colHead}>Who</span>
          </div>
          {rec.groups.map(g => (
            <section key={g.group} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ ...colHead, padding: '6px 16px 0' }}>{g.label}</div>
              {g.lines.map(l => <RecordRow key={l.productId} line={l} closed={rec.closed} />)}
            </section>
          ))}
          {rec.lines.length === 0 && <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 4px' }}>Nothing planned on {longDate(date)}.</div>}
        </div>
      </div>
    </div>
  );
}

function RecordRow({ line, closed }: { line: RecordLine; closed: boolean }) {
  const p = line.product;
  const por = (g: number) => portionsOf(p, g);
  const madeState = line.ticked === 0 ? 'none' : line.ticked < line.tasks ? 'partial' : 'done';
  const variance = line.varianceGrams === undefined ? undefined : por(line.varianceGrams);
  const varianceTone = variance === undefined ? 'neutral' : Math.abs(variance) <= Math.max(2, line.soldPortions * 0.05) ? 'success' : variance > 0 ? 'warning' : 'error';
  const madeDiff = line.madeBatches !== undefined && line.madeBatches !== line.plannedBatches;
  return (
    <div style={rowCard}>
      <div style={rowGrid}>
        <div style={{ minWidth: 0 }}>
          <div style={rowTitle}>{p.name}</div>
          <div style={rowSub}>
            {line.plannedUnits} {line.plan.lines[0]?.unitName.toLowerCase() ?? 'containers'}{line.plan.lines.length > 1 ? ' across the lines' : ''}
            {line.plan.cateringGrams > 0 && ` · ${por(line.plan.cateringGrams)} portions catering`}
          </div>
        </div>
        <Cell main={`${batchesText(line.plannedBatches)} ${line.plannedBatches === 1 ? 'batch' : 'batches'}`} sub={`${por(line.plannedGrams)} portions`} />
        <Cell
          main={line.madeBatches === undefined ? '—' : `${batchesText(line.madeBatches)} ${line.madeBatches === 1 ? 'batch' : 'batches'}`}
          sub={madeState === 'none' ? (line.tasks ? 'not ticked yet' : 'no make task') : `${por(line.madeGrams)} portions${madeState === 'partial' ? ` · ${line.ticked} of ${line.tasks} tasks` : ''}`}
          tone={madeDiff ? 'warning' : undefined}
        />
        <Cell main={line.carriedInGrams > 0 ? `${por(line.carriedInGrams)}` : '0'} sub="portions" />
        <Cell main={`${line.soldPortions}`} sub={`portions · ${gbp(line.soldNet)}`} />
        <Cell
          main={closed ? `${por(line.closeCarriedGrams ?? 0)} · ${por(line.closeBinnedGrams ?? 0)}` : '—'}
          sub={closed ? 'portions' : 'after close'}
          tone={closed && (line.closeBinnedGrams ?? 0) > 0 ? 'error' : undefined}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {variance === undefined ? (
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>—</span>
          ) : (
            <StatusPill tone={varianceTone} size="xs" label={`${variance > 0 ? '+' : ''}${variance} portions`} />
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          {line.who.length ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>{line.who.join(', ')}</div>
              {line.lastTickISO && <div style={cellSub}>{new Date(line.lastTickISO).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>}
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>—</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Where the till figures stand for the day. Past days are in and final,
 * today is still coming through, and a future day has no sales yet so the
 * figures are the draft the plan was built from.
 */
type TillStatus = { label: string; tone: 'success' | 'info' | 'neutral'; note?: string };

function tillStatus(date: string): TillStatus {
  if (date < FJ_DEMO_TODAY) return { label: 'Confirmed', tone: 'success' };
  if (date === FJ_DEMO_TODAY) return { label: 'Live', tone: 'info', note: 'Sales still coming in through the day.' };
  return { label: 'Forecast', tone: 'neutral', note: `Sales haven't come in yet. Drafted from the last four ${longDay(date)}s.` };
}

function SalesStrip({ rec }: { rec: RecordModel }) {
  const s = rec.sales;
  const status = tillStatus(rec.date);
  const channels = (Object.entries(s.netByChannel) as [SalesChannel, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const parts = (['breakfast', 'lunch', 'dinner'] as const).filter(k => s.netByDayPart[k] > 0);
  return (
    <div style={salesCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={bannerTitle}>Till, {longDate(rec.date)}</span>
        <StatusPill tone={status.tone} size="xs" label={status.label} />
        {status.note && <span style={bannerSub}>{status.note}</span>}
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 6 }}>
        {parts.map(k => <Pair key={k} label={k === 'breakfast' ? 'Breakfast' : k === 'lunch' ? 'Lunch' : 'Dinner'} value={gbp(s.netByDayPart[k])} />)}
        <span style={{ width: 1, background: 'var(--color-border-subtle)' }} />
        {channels.map(([ch, n]) => <Pair key={ch} label={CHANNEL_LABELS[ch]} value={`${gbp(n)} · ${Math.round((n / (s.net || 1)) * 100)}%`} />)}
      </div>
    </div>
  );
}

function Cell({ main, sub, tone }: { main: string; sub?: string; tone?: 'warning' | 'error' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: tone === 'warning' ? 'var(--color-warning)' : tone === 'error' ? 'var(--color-error)' : 'var(--color-text-primary)' }}>{main}</span>
      {sub && <span style={cellSub}>{sub}</span>}
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>{value}</span>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'success' | 'warning' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: tone === 'success' ? 'var(--color-success)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>{value}</span>
      {sub && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{sub}</span>}
    </div>
  );
}

// ─── Print ────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function printRecord(rec: RecordModel, shopName: string) {
  const w = window.open('', '_blank', 'width=1000,height=1000');
  if (!w) return;
  const por = (l: RecordLine, g: number) => portionsOf(l.product, g);
  const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');
  const rows = rec.groups.map(g => `
    <tr class="group"><td colspan="8">${esc(g.label)}</td></tr>
    ${g.lines.map(l => {
      const v = l.varianceGrams === undefined ? '' : por(l, l.varianceGrams);
      return `<tr>
        <td><strong>${esc(l.product.name)}</strong><div class="sub">${l.plannedUnits} ${esc(l.plan.lines[0]?.unitName.toLowerCase() ?? 'containers')}</div></td>
        <td class="r">${batchesText(l.plannedBatches)}<div class="sub">${por(l, l.plannedGrams)} por.</div></td>
        <td class="r">${l.madeBatches === undefined ? '<span class="blank">&nbsp;</span>' : batchesText(l.madeBatches)}<div class="sub">${l.madeBatches === undefined ? '' : `${por(l, l.madeGrams)} por.`}</div></td>
        <td class="r">${l.carriedInGrams > 0 ? por(l, l.carriedInGrams) : '0'}</td>
        <td class="r">${l.soldPortions}<div class="sub">£${Math.round(l.soldNet)}</div></td>
        <td class="r">${rec.closed ? `${por(l, l.closeCarriedGrams ?? 0)} · ${por(l, l.closeBinnedGrams ?? 0)}` : '<span class="blank">&nbsp;</span>'}</td>
        <td class="r">${v === '' ? '<span class="blank">&nbsp;</span>' : `${typeof v === 'number' && v > 0 ? '+' : ''}${v}`}</td>
        <td>${esc(l.who.join(', '))}${l.lastTickISO ? `<div class="sub">${time(l.lastTickISO)}</div>` : ''}${l.who.length ? '' : '<span class="blank">&nbsp;</span>'}</td>
      </tr>`;
    }).join('')}`).join('');
  const t = rec.totals;
  w.document.write(`<!doctype html><html><head><title>Production record · ${esc(shopName)} · ${esc(longDate(rec.date))}</title>
    <style>
      body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;margin:24px;font-size:11px}
      h1{font-size:18px;margin:0 0 2px} .top{color:#666;margin-bottom:12px}
      .totals{display:flex;gap:24px;margin:0 0 14px;padding:10px 12px;border:1px solid #ddd;border-radius:6px}
      .totals div{display:flex;flex-direction:column} .totals b{font-size:14px} .totals span{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#666}
      table{width:100%;border-collapse:collapse} th{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#666;text-align:left;padding:6px;border-bottom:2px solid #111}
      th.r,td.r{text-align:right;white-space:nowrap} td{padding:6px;border-bottom:1px solid #e5e5e5;vertical-align:top}
      tr.group td{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#666;padding-top:10px;border-bottom:none}
      .sub{font-size:9px;color:#666} .blank{display:inline-block;min-width:48px;border-bottom:1px solid #999}
      .sign{margin-top:18px;display:flex;gap:40px} .sign div{flex:1;border-top:1px solid #111;padding-top:4px;font-size:9px;color:#666}
      @media print{body{margin:10mm}}
    </style></head><body>
    <h1>Production record · ${esc(shopName)}</h1>
    <div class="top">${esc(longDate(rec.date))} · ${rec.approved ? `plan approved by ${esc(rec.approvedBy ?? '')}` : 'plan not approved'} · ${rec.closed ? `close counted by ${esc(rec.closedBy ?? '')} at ${time(rec.closedAtISO)}` : 'close not counted'} · till ${tillStatus(rec.date).label.toLowerCase()}</div>
    <div class="totals">
      <div><b>${t.plannedPortions.toLocaleString()}</b><span>planned portions</span></div>
      <div><b>${t.ticked ? t.madePortions.toLocaleString() : '—'}</b><span>made portions</span></div>
      <div><b>${t.soldPortions.toLocaleString()}</b><span>sold portions · £${Math.round(t.soldNet).toLocaleString()}</span></div>
      <div><b>${rec.closed ? t.leftPortions : '—'}</b><span>left at close</span></div>
      <div><b>${rec.closed ? t.binnedPortions : '—'}</b><span>binned · £${Math.round(t.wastePounds)}</span></div>
      <div><b>${t.variancePortions === undefined ? '—' : `${t.variancePortions > 0 ? '+' : ''}${t.variancePortions}`}</b><span>variance, portions</span></div>
    </div>
    <table><thead><tr><th>Item</th><th class="r">Planned</th><th class="r">Made</th><th class="r">Carried in</th><th class="r">Sold</th><th class="r">Left · binned</th><th class="r">Variance</th><th>Who</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="sign"><div>Kitchen lead</div><div>General manager</div><div>Date</div></div>
    <script>window.onload=function(){window.print();}</script></body></html>`);
  w.document.close();
}

// ─── Styles (shared look with Close and Day plan) ─────────────────────────────

const captionStrip: CSSProperties = { padding: '8px 30px', background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-muted)', flexWrap: 'wrap' };
const bannerTitle: CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' };
const bannerSub: CSSProperties = { fontSize: 11, color: 'var(--color-text-secondary)' };
const summaryBar: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', boxShadow: '0 1px 2px rgba(12,20,44,0.06)', flexWrap: 'wrap' };
const summaryIcon: CSSProperties = { width: 32, height: 32, flexShrink: 0, borderRadius: 9, background: 'var(--color-info-light)', color: 'var(--color-info)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const salesCard: CSSProperties = { padding: '10px 16px', background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)' };
const ghostButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-primary)', background: '#ffffff', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', cursor: 'pointer', whiteSpace: 'nowrap' };
const rowCard: CSSProperties = { background: '#ffffff', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', boxShadow: '0 1px 2px rgba(12,20,44,0.04)' };
const gridCols = 'minmax(0, 1.4fr) 110px 130px 90px 110px 120px 120px minmax(0, 1fr)';
const rowGrid: CSSProperties = { display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', gap: 14, padding: '10px 16px' };
const rowHead: CSSProperties = { display: 'grid', gridTemplateColumns: gridCols, gap: 14, padding: '0 16px' };
const colHead: CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' };
const rowTitle: CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' };
const rowSub: CSSProperties = { fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 };
const cellSub: CSSProperties = { fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' };

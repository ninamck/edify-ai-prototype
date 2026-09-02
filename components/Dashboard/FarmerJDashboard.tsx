'use client';

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import DashboardEditToolbar from '@/components/Dashboard/DashboardEditToolbar';
import DashboardWidget from '@/components/Dashboard/DashboardWidget';
import QuinnInsightButton from '@/components/Dashboard/parts/QuinnInsightButton';
import SalesTrendChart from '@/components/Dashboard/parts/SalesTrendChart';
import { ANALYTICS_CONFIG, renderAnalyticsChart, type AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import { isHalfOnlyChart, pinnedChartIdOf, widthOf, type DashboardLayoutEntry, type WidgetWidth } from '@/components/Dashboard/layoutTypes';
import { gbp } from '@/components/Production/farmerj/cascade';
import { FJ_DEMO_TODAY, longDate } from '@/components/Production/farmerj/calendar';
import {
  attachRates,
  channelMix,
  daypartTiles,
  forecastAccuracy,
  groupMix,
  prepHoursPer100,
  salesTrend,
  shopLeague,
  salesByHour,
  wasteByReason,
  wasteWeek,
  yieldVariance,
} from '@/components/Production/farmerj/dashboardData';
import { useFjPlanStore } from '@/components/Production/farmerj/FjPlanStore';
import { PRODUCT_GROUP_LABELS } from '@/components/Production/farmerj/recipes';
import { FJ_ALL_SHOPS_ID, FJ_SHOPS, getShop } from '@/components/Production/farmerj/shops';

/**
 * Farmer J home dashboard. Follows the shop picked in the site switcher
 * (one shop, or All shops for Jana). Two tabs: Sales, the pounds and trays
 * a GM reads; Production, what the kitchen made against what it needed.
 */

type Tab = 'sales' | 'production';
const TABS: { id: Tab; label: string }[] = [
  { id: 'sales', label: 'Sales' },
  { id: 'production', label: 'Production' },
];

const NAVY = '#001C35';
const CHANNEL_COLOURS: Record<string, string> = { instore: '#001C35', kiosk: '#28AFC9', deliveroo: '#1A148A', clickcollect: '#FF0058' };
const PART_COLOURS: Record<string, string> = { breakfast: '#28AFC9', lunch: '#001C35', dinner: '#1A148A' };
const PART_LABELS: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const OK = '#166534';
const WARN = '#B45309';

export default function FarmerJDashboard({
  layout,
  editing,
  onLayoutChange,
  onToggleEdit,
  onAddInsight,
  onRemovePinned,
  toolbarLeadingControls,
}: {
  layout: DashboardLayoutEntry[];
  editing: boolean;
  onLayoutChange: (next: DashboardLayoutEntry[]) => void;
  onToggleEdit: () => void;
  onAddInsight: () => void;
  onRemovePinned: (chartId: AnalyticsChartId) => void;
  toolbarLeadingControls?: ReactNode;
}) {
  const { productionSiteId } = useActiveSite();
  const scope = productionSiteId && (productionSiteId === FJ_ALL_SHOPS_ID || FJ_SHOPS.some(s => s.id === productionSiteId)) ? productionSiteId : FJ_ALL_SHOPS_ID;
  const [tab, setTab] = useState<Tab>('sales');
  const widgetRefs = useRef<Map<string, HTMLElement>>(new Map());
  const scopeName = scope === FJ_ALL_SHOPS_ID ? 'All shops' : getShop(scope)?.name ?? scope;

  const pinnedEntries = layout.filter(e => pinnedChartIdOf(e.id) !== null);
  const visiblePinned = editing ? pinnedEntries : pinnedEntries.filter(e => e.visible);

  function toggleVisible(id: string) {
    onLayoutChange(layout.map(e => (e.id === id ? { ...e, visible: !e.visible } : e)));
  }
  function toggleWidth(id: string) {
    onLayoutChange(layout.map(e => (e.id === id ? { ...e, width: (widthOf(e) === 'full' ? 'half' : 'full') as WidgetWidth } : e)));
  }
  function removeEntry(id: string) {
    onLayoutChange(layout.filter(e => e.id !== id));
  }
  function handleDragEnd(draggedId: string, dropPoint: { x: number; y: number }) {
    let targetId: string | null = null;
    widgetRefs.current.forEach((el, id) => {
      if (id === draggedId || !el) return;
      const r = el.getBoundingClientRect();
      if (dropPoint.x >= r.left && dropPoint.x <= r.right && dropPoint.y >= r.top && dropPoint.y <= r.bottom) targetId = id;
    });
    if (!targetId) return;
    const from = layout.findIndex(e => e.id === draggedId);
    const to = layout.findIndex(e => e.id === targetId);
    if (from === -1 || to === -1 || from === to) return;
    const next = layout.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onLayoutChange(next);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-primary)', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Farmer J <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>· {scopeName}</span>
          </h1>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>{longDate(FJ_DEMO_TODAY)}</p>
        </div>
        <DashboardEditToolbar editing={editing} onToggleEdit={onToggleEdit} onAddInsight={onAddInsight} leadingControls={toolbarLeadingControls} />
      </div>

      <div role="tablist" aria-label="Farmer J dashboard view" style={{ alignSelf: 'flex-start', display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)' }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.id)} style={{ padding: '8px 16px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer', background: active ? 'var(--color-accent-active)' : 'transparent', color: active ? '#fff' : 'var(--color-text-muted)', boxShadow: active ? '0 2px 8px rgba(34,68,68,0.25)' : 'none', whiteSpace: 'nowrap' }}>
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {tab === 'sales' ? <SalesTab scope={scope} /> : <ProductionTab scope={scope} />}
      </div>

      {visiblePinned.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>Pinned insights</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {visiblePinned.map(entry => {
              const chartId = pinnedChartIdOf(entry.id)!;
              const half = isHalfOnlyChart(chartId) || widthOf(entry) === 'half';
              return (
                <div key={entry.id} ref={el => { if (el) widgetRefs.current.set(entry.id, el); else widgetRefs.current.delete(entry.id); }} style={{ gridColumn: half ? 'span 1' : 'span 2' }}>
                  <DashboardWidget id={entry.id} editing={editing} visible={entry.visible} width={widthOf(entry)} onToggleVisible={() => toggleVisible(entry.id)} onToggleWidth={isHalfOnlyChart(chartId) ? undefined : () => toggleWidth(entry.id)} onRemove={() => { removeEntry(entry.id); onRemovePinned(chartId); }} onDragEnd={p => handleDragEnd(entry.id, p)}>
                    <div style={{ padding: '14px 16px 10px', borderRadius: 12, border: '1px solid var(--color-border-subtle)', background: '#fff', boxShadow: '0 2px 12px rgba(0, 28, 53,0.07)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', flex: 1, minWidth: 0 }}>{ANALYTICS_CONFIG[chartId].label}</span>
                        <QuinnInsightButton chartId={chartId} text={ANALYTICS_CONFIG[chartId].reasoning} />
                      </div>
                      {renderAnalyticsChart(chartId)}
                    </div>
                  </DashboardWidget>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)' }}>
        Marylebone today is the till export. Every other shop and day is modelled from it.
      </p>
    </div>
  );
}

// ─── Sales ───────────────────────────────────────────────────────────────────

function SalesTab({ scope }: { scope: string }) {
  const tiles = useMemo(() => daypartTiles(scope), [scope]);
  const hours = useMemo(() => salesByHour(scope), [scope]);
  const trend = useMemo(() => salesTrend(scope), [scope]);
  const channels = useMemo(() => channelMix(scope), [scope]);
  const proteins = useMemo(() => groupMix(scope, 'proteins'), [scope]);
  const bases = useMemo(() => groupMix(scope, 'bases'), [scope]);
  const sides = useMemo(() => groupMix(scope, 'hot-sides'), [scope]);
  const attach = useMemo(() => attachRates(scope), [scope]);
  const league = useMemo(() => (scope === FJ_ALL_SHOPS_ID ? shopLeague() : []), [scope]);
  const parts = (['breakfast', 'lunch', 'dinner'] as const).filter(p => hours.some(h => h[p] > 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {tiles.filter(t => t.net > 0 || t.avg > 0).map(t => {
          const pct = t.avg ? Math.round((t.net / t.avg - 1) * 100) : 0;
          return <Tile key={t.part} label={`${t.label} today`} value={gbp(t.net)} delta={pct === 0 ? 'level' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`} positive={pct >= 0} context="vs last four" />;
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 12 }}>
        <Card title="Sales by hour" subtitle="today, pounds">
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hours} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={v => (Number(v) >= 1000 ? `£${(Number(v) / 1000).toFixed(Number(v) % 1000 === 0 ? 0 : 1)}k` : `£${v}`)} />
                <Tooltip contentStyle={tip} formatter={(v, name) => [gbp(Number(v)), PART_LABELS[String(name)] ?? String(name)]} labelFormatter={(l, payload) => { const t = payload?.[0]?.payload?.trays; return t ? `${l} · ${t} trays` : String(l); }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={v => PART_LABELS[String(v)] ?? v} />
                {parts.map(p => <Bar key={p} dataKey={p} stackId="a" fill={PART_COLOURS[p]} radius={p === parts[parts.length - 1] ? [3, 3, 0, 0] : 0} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Where the money comes from" subtitle="today, by channel">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
            {channels.filter(c => c.net > 0).map(c => (
              <BarRow key={c.channel} label={c.label} value={gbp(c.net)} share={c.share} colour={CHANNEL_COLOURS[c.channel]} />
            ))}
          </div>
        </Card>
      </div>

      <Card title="Six weeks of sales" subtitle="net, thousands">
        <div style={{ height: 200 }}>
          <SalesTrendChart data={trend} />
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <Card title="Protein mix" subtitle="portions today">
          <MixList rows={proteins} colour={NAVY} />
        </Card>
        <Card title="Base mix" subtitle="portions today">
          <MixList rows={bases} colour="#28AFC9" />
        </Card>
        <Card title="Hot side mix" subtitle="portions today">
          <MixList rows={sides} colour="#1A148A" />
        </Card>
        <Card title="On the tray" subtitle="portions per tray sold">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
            {attach.map(a => <BarRow key={a.group} label={a.label} value={a.perTray.toFixed(2)} share={Math.min(1, a.perTray / 1.5)} colour={NAVY} />)}
          </div>
        </Card>
      </div>

      {league.length > 0 && (
        <Card title="Shops today" subtitle={`${league.length} open`}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Shop</th>
                <th style={{ ...th, textAlign: 'right' }}>Net</th>
                <th style={{ ...th, textAlign: 'right' }}>Breakfast</th>
                <th style={{ ...th, textAlign: 'right' }}>Delivery</th>
                <th style={{ ...th, textAlign: 'right' }}>vs last four</th>
              </tr>
            </thead>
            <tbody>
              {league.map(r => {
                const pct = Math.round(r.vsAvg * 100);
                return (
                  <tr key={r.shopId}>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--color-text-primary)' }}>{r.name}{r.real && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>TILL</span>}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{gbp(r.net)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{r.breakfast > 0 ? gbp(r.breakfast) : '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{Math.round(r.deliveryShare * 100)}%</td>
                    <td style={{ ...td, textAlign: 'right', color: pct >= 0 ? OK : WARN, fontWeight: 600 }}>{pct === 0 ? 'level' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ─── Production ──────────────────────────────────────────────────────────────

function ProductionTab({ scope }: { scope: string }) {
  const store = useFjPlanStore();
  const accuracy = useMemo(() => forecastAccuracy(scope, store.get), [scope, store]);
  const week = useMemo(() => wasteWeek(scope, store.get), [scope, store]);
  const reasons = useMemo(() => wasteByReason(scope, store.get, week), [scope, store, week]);
  const yields = useMemo(() => yieldVariance(scope), [scope, store]); // eslint-disable-line react-hooks/exhaustive-deps -- published yield % lives in the recipe book
  const prep = useMemo(() => prepHoursPer100(scope), [scope]);

  const wastePounds = week.reduce((n, d) => n + d.wastePounds, 0);
  const wasteKg = week.reduce((n, d) => n + d.wasteKg, 0);
  const carriedKg = week.reduce((n, d) => n + d.carriedKg, 0);
  const within = accuracy.filter(r => Math.abs(r.variance) <= 0.1).length;
  const over = accuracy.filter(r => r.variance > 0.1).length;
  const under = accuracy.filter(r => r.variance < -0.1).length;
  const worstYield = yields[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Tile label="Lines within 10%" value={`${within} of ${accuracy.length}`} context="yesterday's plan" positive={within >= accuracy.length * 0.7} delta={over || under ? `${over} over, ${under} under` : 'all on plan'} />
        <Tile label="Waste this week" value={gbp(wastePounds)} context={`${wasteKg.toFixed(1)} kg`} />
        <Tile label="Carried over" value={`${carriedKg.toFixed(1)} kg`} context="counted at close, seven days" />
        <Tile label="Yield furthest out" value={worstYield ? `${worstYield.counted}%` : '—'} context={worstYield ? `${worstYield.name}, set ${worstYield.expected}%` : ''} positive={worstYield ? worstYield.counted <= worstYield.expected : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 12 }}>
        <Card title="Made against needed" subtitle="yesterday, batches">
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Product</th>
                <th style={{ ...th, textAlign: 'right' }}>Planned</th>
                <th style={{ ...th, textAlign: 'right' }}>Needed</th>
                <th style={{ ...th, textAlign: 'right' }}>Over / under</th>
              </tr>
            </thead>
            <tbody>
              {accuracy.slice(0, 12).map(r => {
                const pct = Math.round(r.variance * 100);
                const off = Math.abs(pct) > 10;
                return (
                  <tr key={r.productId}>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--color-text-primary)' }}>{r.name}<span style={{ marginLeft: 6, fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 500 }}>{PRODUCT_GROUP_LABELS[r.group]}</span></td>
                    <td style={{ ...td, textAlign: 'right' }}>{half(r.planned)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{half(r.needed)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: off ? (pct > 0 ? WARN : '#B91C1C') : OK }}>{pct === 0 ? 'on plan' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <Card title="Waste by reason" subtitle="seven days, pounds">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
            {reasons.map(r => <BarRow key={r.reason} label={r.reason} value={gbp(r.pounds)} share={r.share} colour={r.reason === 'Over-production' ? '#FF0058' : NAVY} />)}
          </div>
          <div style={{ height: 150, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={tip} formatter={(v, name) => [`${Number(v).toFixed(1)} kg`, name === 'carriedKg' ? 'Carried over' : 'Waste']} />
                <Bar dataKey="carriedKg" fill="#28AFC9" radius={[3, 3, 0, 0]} />
                <Bar dataKey="wasteKg" fill="#FF0058" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 12 }}>
        <Card title={scope === FJ_ALL_SHOPS_ID ? 'Amba chicken yield by shop' : 'Yield loss, set against weighed'} subtitle="loss %">
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>{scope === FJ_ALL_SHOPS_ID ? 'Shop' : 'Component'}</th>
                <th style={{ ...th, textAlign: 'right' }}>Set in Setup</th>
                <th style={{ ...th, textAlign: 'right' }}>Weighed</th>
                <th style={{ ...th, textAlign: 'right' }}>Drift</th>
              </tr>
            </thead>
            <tbody>
              {yields.slice(0, 10).map(r => {
                const drift = r.counted - r.expected;
                return (
                  <tr key={r.key}>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--color-text-primary)' }}>{r.name}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{r.expected}%</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{r.counted}%</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: drift > 1 ? WARN : drift < -1 ? OK : 'var(--color-text-secondary)' }}>{drift === 0 ? 'none' : `${drift > 0 ? '+' : '−'}${Math.abs(drift)} pts`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <Card title="Prep hours per £100" subtitle="last week">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
            {prep.slice(0, 10).map(p => <BarRow key={p.name} label={p.name} value={`${p.hours.toFixed(2)} h`} share={p.hours / 1.8} colour={NAVY} />)}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Parts ───────────────────────────────────────────────────────────────────

function half(n: number): string {
  const r = Math.round(n * 2) / 2;
  return r % 1 === 0 ? String(r) : `${Math.floor(r) || ''}½`;
}

function Tile({ label, value, delta, positive, context }: { label: string; value: string; delta?: string; positive?: boolean; context?: string }) {
  const colour = positive === undefined ? 'var(--color-text-secondary)' : positive ? OK : WARN;
  const Icon = positive === undefined ? null : positive ? TrendingUp : TrendingDown;
  return (
    <div style={{ padding: '14px 16px', borderRadius: 10, border: `1px solid ${NAVY}`, background: '#fff', boxShadow: '0 2px 8px rgba(0, 28, 53,0.08), 0 0 0 1px rgba(0, 28, 53,0.03)', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{label}</span>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#1A148A', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
      {(delta || context) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: colour, flexWrap: 'wrap' }}>
          {Icon && <Icon size={12} strokeWidth={2.4} />}
          {delta && <span>{delta}</span>}
          {context && <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>{delta ? '· ' : ''}{context}</span>}
        </div>
      )}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${NAVY}`, background: '#fff', boxShadow: '0 2px 12px rgba(0, 28, 53,0.1), 0 0 0 1px rgba(0, 28, 53,0.03)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 16px 6px', display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '4px 16px 14px', flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

function BarRow({ label, value, share, colour }: { label: string; value: string; share: number; colour: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'center' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums', marginLeft: 8 }}>{value}</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--color-bg-hover)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(2, Math.min(100, share * 100))}%`, height: '100%', background: colour, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
}

function MixList({ rows, colour }: { rows: { id: string; name: string; portions: number; share: number }[]; colour: string }) {
  const top = rows[0]?.share || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
      {rows.filter(r => r.portions > 0).map(r => <BarRow key={r.id} label={r.name} value={`${Math.round(r.share * 100)}%`} share={r.share / top} colour={colour} />)}
    </div>
  );
}

const tip: CSSProperties = { background: '#FCF6EE', border: `1px solid ${NAVY}`, borderRadius: 8, fontSize: 12, fontWeight: 500, color: NAVY };
const table: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
const th: CSSProperties = { textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', padding: '6px 6px', borderBottom: '1px solid var(--color-border-subtle)' };
const td: CSSProperties = { padding: '7px 6px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' };

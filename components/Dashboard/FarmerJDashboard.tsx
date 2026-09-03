'use client';

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Mail, Radio, TrendingDown, TrendingUp } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import DashboardEditToolbar from '@/components/Dashboard/DashboardEditToolbar';
import DashboardWidget from '@/components/Dashboard/DashboardWidget';
import QuinnInsightButton from '@/components/Dashboard/parts/QuinnInsightButton';
import SalesTrendChart from '@/components/Dashboard/parts/SalesTrendChart';
import PublishDialog from '@/components/Dashboard/permissions/PublishDialog';
import type { Audience } from '@/components/Dashboard/permissions/model';
import ScheduleReportDrawer from '@/components/ScheduledReports/ScheduleReportDrawer';
import { ANALYTICS_CONFIG, renderAnalyticsChart, type AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import { isHalfOnlyChart, pinnedChartIdOf, widthOf, type DashboardLayoutEntry, type WidgetWidth } from '@/components/Dashboard/layoutTypes';
import {
  FJ_AUDIENCE_SITES,
  FJ_PUBLISHER,
  fjAudienceSummary,
  fjDashboardStub,
  setFjAudience,
  useFjAudiences,
  type FjDashboardView,
} from '@/components/Dashboard/farmerJAudience';
import { gbp } from '@/components/Production/farmerj/cascade';
import { FJ_DEMO_TODAY, longDate } from '@/components/Production/farmerj/calendar';
import {
  attachRates,
  baselineLabel,
  channelMix,
  daypartTiles,
  dayTotals,
  forecastAccuracy,
  groupMix,
  peakHour,
  prepHoursPer100,
  salesTrend,
  shopLeague,
  salesByHour,
  wasteByReason,
  wasteWeek,
  weekOnWeek,
  yieldVariance,
  type GroupMix,
} from '@/components/Production/farmerj/dashboardData';
import { useFjPlanStore } from '@/components/Production/farmerj/FjPlanStore';
import { PRODUCT_GROUP_LABELS } from '@/components/Production/farmerj/recipes';
import { FJ_ALL_SHOPS_ID, FJ_SHOPS, getShop } from '@/components/Production/farmerj/shops';

/**
 * Farmer J home dashboard. Follows the shop picked in the site switcher
 * (one shop, or All shops for Jana). Two views, each its own home tab:
 * Sales, the pounds and trays a GM reads; Production, what the kitchen made
 * against what it needed. Every number on it says what it is a share of and
 * what it is read against (the last four same-weekday trading days).
 */

const NAVY = '#001C35';
const CHANNEL_COLOURS: Record<string, string> = { instore: '#001C35', kiosk: '#28AFC9', deliveroo: '#1A148A', clickcollect: '#FF0058', corporate: '#6B7280', citypantry: '#F59E0B', ordit: '#10B981' };
const PART_COLOURS: Record<string, string> = { breakfast: '#28AFC9', lunch: '#001C35', dinner: '#1A148A' };
const PART_LABELS: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const OK = '#166534';
const WARN = '#B45309';

/** Card titles per view, pre-ticked when the dashboard is emailed. */
const SALES_CARD_TITLES = ['Sales by hour', 'Where the money comes from', 'Six weeks of sales', 'Protein mix', 'Base mix', 'Hot side mix', 'On the tray', 'Shops today'];
const PRODUCTION_CARD_TITLES = ['Made against needed', 'Waste by reason', 'Yield loss, set against weighed', 'Prep hours per £100'];
const FJ_EMAIL_SITE_OPTIONS = ['All shops', ...FJ_SHOPS.map(s => s.name)];

const toolbarButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
};

export default function FarmerJDashboard({
  view,
  layout,
  editing,
  onLayoutChange,
  onToggleEdit,
  onAddInsight,
  onRemovePinned,
  toolbarLeadingControls,
}: {
  view: FjDashboardView;
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
  const widgetRefs = useRef<Map<string, HTMLElement>>(new Map());
  const scopeName = scope === FJ_ALL_SHOPS_ID ? 'All shops' : getShop(scope)?.name ?? scope;

  // Who can see each view. One store keyed by view: the same component
  // instance serves both tabs.
  const audiences = useFjAudiences();
  const audience = audiences[view];
  const [publishOpen, setPublishOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  function updateAudience(next: Audience | null) {
    setFjAudience(view, next);
  }

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

  const isShared = !!audience;
  const cardTitles = view === 'sales' ? SALES_CARD_TITLES : PRODUCTION_CARD_TITLES;

  const shareControls = (
    <>
      {toolbarLeadingControls}
      <button
        type="button"
        onClick={() => setPublishOpen(true)}
        title={isShared ? 'Change who can see this dashboard' : 'Share this dashboard with managers or the team at chosen shops'}
        style={toolbarButton}
        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)')}
        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
      >
        <Radio size={14} strokeWidth={2.2} />
        {isShared ? 'Audience…' : 'Publish…'}
      </button>
      <button
        type="button"
        onClick={() => setEmailOpen(true)}
        title="Email this dashboard, once or on a schedule"
        style={toolbarButton}
        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)')}
        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
      >
        <Mail size={14} strokeWidth={2.2} />
        Email…
      </button>
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-primary)', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Farmer J {view === 'sales' ? 'sales' : 'production'} <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>· {scopeName}</span>
          </h1>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
            {longDate(FJ_DEMO_TODAY)} · {fjAudienceSummary(audience)}
          </p>
        </div>
        <DashboardEditToolbar editing={editing} onToggleEdit={onToggleEdit} onAddInsight={onAddInsight} leadingControls={shareControls} />
      </div>

      {view === 'sales' ? <SalesView scope={scope} scopeName={scopeName} /> : <ProductionView scope={scope} />}

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
        Marylebone today is the till export. Every other shop and day is modelled from it. Deltas read against the {baselineLabel()}, skipping any day flagged as an anomaly.
      </p>

      <PublishDialog
        open={publishOpen}
        dashboard={fjDashboardStub(view, audience)}
        viewer={FJ_PUBLISHER}
        sites={FJ_AUDIENCE_SITES}
        onClose={() => setPublishOpen(false)}
        onPublish={next => updateAudience(next)}
        onUnpublish={() => updateAudience(null)}
      />

      <ScheduleReportDrawer
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        initialSelection={cardTitles}
        siteLabel={scopeName}
        siteOptions={FJ_EMAIL_SITE_OPTIONS}
        dataWindowLabel="Today so far, as of send time"
      />
    </div>
  );
}

// ─── Sales ───────────────────────────────────────────────────────────────────

function SalesView({ scope, scopeName }: { scope: string; scopeName: string }) {
  const baseline = baselineLabel();
  const tiles = useMemo(() => daypartTiles(scope), [scope]);
  const totals = useMemo(() => dayTotals(scope), [scope]);
  const hours = useMemo(() => salesByHour(scope), [scope]);
  const peak = useMemo(() => peakHour(hours), [hours]);
  const trend = useMemo(() => salesTrend(scope), [scope]);
  const wow = useMemo(() => weekOnWeek(scope), [scope]);
  const channels = useMemo(() => channelMix(scope), [scope]);
  const proteins = useMemo(() => groupMix(scope, 'proteins'), [scope]);
  const bases = useMemo(() => groupMix(scope, 'bases'), [scope]);
  const sides = useMemo(() => groupMix(scope, 'hot-sides'), [scope]);
  const attach = useMemo(() => attachRates(scope), [scope]);
  const league = useMemo(() => (scope === FJ_ALL_SHOPS_ID ? shopLeague() : []), [scope]);
  const parts = (['breakfast', 'lunch', 'dinner'] as const).filter(p => hours.some(h => h[p] > 0));

  const shopsPhrase = scope === FJ_ALL_SHOPS_ID ? `${totals.shopsOpen} shops open` : scopeName;
  const traysPct = pctDelta(totals.trays, totals.avgTrays);
  const perTrayPct = pctDelta(totals.perTray, totals.avgPerTray);
  const wowPct = pctDelta(wow.thisWeek, wow.lastWeek);
  const activeChannels = channels.filter(c => c.net > 0);
  const maxAttach = Math.max(...attach.rows.map(r => r.perTray), 0.01);
  // A lunch-only shop has one daypart, so the split would repeat the day
  // total. Show the parts only when there is more than one of them.
  const dayparts = tiles.filter(t => t.part !== 'total' && (t.net > 0 || t.avg > 0));
  const dayTile = tiles.find(t => t.part === 'total');
  const visibleTiles = [...(dayparts.length > 1 ? dayparts : []), ...(dayTile ? [dayTile] : [])];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {visibleTiles.map(t => {
          const pct = pctDelta(t.net, t.avg);
          return <Tile key={t.part} label={`${t.label} today`} value={gbp(t.net)} delta={deltaText(pct)} positive={pct >= 0} context={`${baseline} averaged ${gbp(t.avg)}`} />;
        })}
        <Tile label="Trays today" value={totals.trays.toLocaleString('en-GB')} delta={deltaText(traysPct)} positive={traysPct >= 0} context={`${baseline} averaged ${Math.round(totals.avgTrays).toLocaleString('en-GB')}`} />
        <Tile label="Average tray" value={gbp(totals.perTray)} delta={deltaText(perTrayPct)} positive={perTrayPct >= 0} context={`net per tray · ${baseline} ${gbp(totals.avgPerTray)}`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 12 }}>
        <Card title="Sales by hour" subtitle={peak ? `today, pounds · busiest ${peak.label}, ${gbp(peak.net)} on ${peak.trays} trays` : 'today, pounds'}>
          <div style={chartBox(240)}>
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
        <Card title="Where the money comes from" subtitle={`${gbp(totals.net)} today across ${activeChannels.length} channels · ${shopsPhrase}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
            {activeChannels.map(c => {
              const pct = pctDelta(c.net, c.avg);
              return <BarRow key={c.channel} label={c.label} value={`${gbp(c.net)} · ${shareText(c.share)}`} share={c.share} colour={CHANNEL_COLOURS[c.channel]} delta={pct} />;
            })}
          </div>
          <Footnote>Share of today&rsquo;s net. Chips compare each channel with the {baseline}.</Footnote>
        </Card>
      </div>

      <Card title="Six weeks of sales" subtitle={`net, thousands · ${wow.daysSoFar} days of this week ${gbp(wow.thisWeek)}, ${deltaText(wowPct)} on the same days last week (${gbp(wow.lastWeek)})`}>
        <div style={chartBox(200)}>
          <SalesTrendChart data={trend} />
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <MixCard mix={proteins} colour={NAVY} baseline={baseline} shopsPhrase={shopsPhrase} />
        <MixCard mix={bases} colour="#28AFC9" baseline={baseline} shopsPhrase={shopsPhrase} />
        <MixCard mix={sides} colour="#1A148A" baseline={baseline} shopsPhrase={shopsPhrase} />
        <Card title="On the tray" subtitle={`portions per tray · ${attach.trays.toLocaleString('en-GB')} trays today`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
            {attach.rows.map(a => (
              <BarRow key={a.group} label={a.label} value={`${a.perTray.toFixed(2)} per tray · ${a.portions.toLocaleString('en-GB')} portions`} share={a.perTray / maxAttach} colour={NAVY} delta={pctDelta(a.perTray, a.avgPerTray)} />
            ))}
          </div>
          <Footnote>{trayStory(attach.rows)}</Footnote>
        </Card>
      </div>

      {league.length > 0 && (
        <Card title="Shops today" subtitle={`${league.length} open · ranked by net · ${baseline} as the baseline`}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Shop</th>
                <th style={{ ...th, textAlign: 'right' }}>Net</th>
                <th style={{ ...th, textAlign: 'right' }}>Trays</th>
                <th style={{ ...th, textAlign: 'right' }}>Per tray</th>
                <th style={{ ...th, textAlign: 'right' }}>Breakfast</th>
                <th style={{ ...th, textAlign: 'right' }}>Delivery</th>
                <th style={{ ...th, textAlign: 'right' }}>vs baseline</th>
              </tr>
            </thead>
            <tbody>
              {league.map(r => {
                const pct = Math.round(r.vsAvg * 100);
                return (
                  <tr key={r.shopId}>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--color-text-primary)' }}>{r.name}{r.real && <span title="This shop-day is the real till export" style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>TILL</span>}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{gbp(r.net)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{Math.round(r.trays).toLocaleString('en-GB')}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{gbp(r.perTray)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{r.breakfast > 0 ? gbp(r.breakfast) : '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{Math.round(r.deliveryShare * 100)}%</td>
                    <td style={{ ...td, textAlign: 'right', color: pct >= 0 ? OK : WARN, fontWeight: 600 }}>{deltaText(pct)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...tfootCell }}>All {league.length} shops</td>
                <td style={{ ...tfootCell, textAlign: 'right' }}>{gbp(totals.net)}</td>
                <td style={{ ...tfootCell, textAlign: 'right' }}>{Math.round(totals.trays).toLocaleString('en-GB')}</td>
                <td style={{ ...tfootCell, textAlign: 'right' }}>{gbp(totals.perTray)}</td>
                <td style={{ ...tfootCell, textAlign: 'right' }}>{gbp(league.reduce((n, r) => n + r.breakfast, 0))}</td>
                <td style={{ ...tfootCell, textAlign: 'right' }}>{totals.net ? Math.round((league.reduce((n, r) => n + r.deliveryShare * r.net, 0) / totals.net) * 100) : 0}%</td>
                <td style={{ ...tfootCell, textAlign: 'right', color: totals.net >= totals.avgNet ? OK : WARN }}>{deltaText(pctDelta(totals.net, totals.avgNet))}</td>
              </tr>
            </tfoot>
          </table>
          <Footnote>Delivery is the share of net through Deliveroo, Click &amp; Collect and the catering platforms. Breakfast is blank where the shop does not serve it.</Footnote>
        </Card>
      )}
    </div>
  );
}

/** One product group's portions today, with the denominator in the subtitle. */
function MixCard({ mix, colour, baseline, shopsPhrase }: { mix: GroupMix; colour: string; baseline: string; shopsPhrase: string }) {
  const rows = mix.rows.filter(r => r.portions > 0);
  const totalPct = pctDelta(mix.totalPortions, mix.avgPortions);
  const singular = mix.label.replace(/s$/, '').toLowerCase();
  const title = mix.group === 'hot-sides' ? 'Hot side mix' : `${mix.label.replace(/s$/, '')} mix`;
  return (
    <Card title={title} subtitle={`${mix.totalPortions.toLocaleString('en-GB')} portions today · ${mix.perTray.toFixed(2)} per tray · ${shopsPhrase}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
        {rows.map(r => (
          <BarRow key={r.id} label={r.name} value={`${r.portions.toLocaleString('en-GB')} · ${shareText(r.share)}`} share={r.share} colour={colour} delta={pctDelta(r.portions, r.avgPortions)} />
        ))}
      </div>
      <Footnote>
        Percentages are each {singular}&rsquo;s share of the {mix.totalPortions.toLocaleString('en-GB')} portions. The group is {deltaText(totalPct)} on the {baseline} ({Math.round(mix.avgPortions).toLocaleString('en-GB')} portions).
      </Footnote>
    </Card>
  );
}

/** Plain-English reading of the attach rates. */
function trayStory(rows: { group: string; perTray: number }[]): string {
  const by = (g: string) => rows.find(r => r.group === g)?.perTray ?? 0;
  const howOften = (name: string, n: number) => {
    if (n >= 1.05) return `${name} average ${n.toFixed(1)} a tray, so some trays take two`;
    if (n >= 0.95) return `${name} go on nearly every tray`;
    return `${name} go on ${Math.max(0, Math.round(n * 10))} in ten trays`;
  };
  return `A tray carries about ${by('proteins').toFixed(1)} proteins and ${by('bases').toFixed(1)} bases. ${howOften('Hot sides', by('hot-sides'))}; ${howOften('salads', by('salads'))}. Bars are scaled to the biggest group; chips compare with the ${baselineLabel()}.`;
}

// ─── Production ──────────────────────────────────────────────────────────────

function ProductionView({ scope }: { scope: string }) {
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
  const countedDays = week.filter(d => d.real).length;
  const maxPrep = Math.max(...prep.rows.map(p => p.hours), 0.01);
  const overProduction = reasons.find(r => r.reason === 'Over-production');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Tile label="Lines within 10%" value={`${within} of ${accuracy.length}`} context="yesterday's plan against what the close said was needed" positive={within >= accuracy.length * 0.7} delta={over || under ? `${over} over, ${under} under` : 'all on plan'} />
        <Tile label="Waste this week" value={gbp(wastePounds)} context={`${wasteKg.toFixed(1)} kg binned over seven days · ${overProduction ? `${Math.round(overProduction.share * 100)}% of it over-production` : ''}`} />
        <Tile label="Carried over" value={`${carriedKg.toFixed(1)} kg`} context={`counted at close over seven days · ${countedDays} of 7 days counted, the rest modelled`} />
        <Tile label="Yield furthest out" value={worstYield ? `${worstYield.counted}%` : '—'} context={worstYield ? `${worstYield.name} loses ${worstYield.counted}% against ${worstYield.expected}% set in Setup` : ''} positive={worstYield ? worstYield.counted <= worstYield.expected : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 12 }}>
        <Card title="Made against needed" subtitle={`yesterday, batches · ${accuracy.length} lines planned, ${within} within 10% · biggest misses first`}>
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
          <Footnote>Over means the kitchen made more than the day needed (waste or carry-over). Under means it ran short. Needed comes from the close count where a shop counted, modelled otherwise.</Footnote>
        </Card>
        <Card title="Waste by reason" subtitle={`seven days · ${gbp(wastePounds)}, ${wasteKg.toFixed(1)} kg`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
            {reasons.map(r => <BarRow key={r.reason} label={r.reason} value={`${gbp(r.pounds)} · ${Math.round(r.share * 100)}%`} share={r.share} colour={r.reason === 'Over-production' ? '#FF0058' : NAVY} />)}
          </div>
          <div style={{ ...chartBox(160), marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={v => `${v} kg`} />
                <Tooltip contentStyle={tip} formatter={(v, name) => [`${Number(v).toFixed(1)} kg`, name === 'carriedKg' ? 'Carried over' : 'Binned']} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={v => (v === 'carriedKg' ? 'Carried over' : 'Binned')} />
                <Bar dataKey="carriedKg" fill="#28AFC9" radius={[3, 3, 0, 0]} />
                <Bar dataKey="wasteKg" fill="#FF0058" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Footnote>Pounds are the ingredient cost of what went in the bin. Carried over is food kept for the next day, not waste.</Footnote>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 12 }}>
        <Card title={scope === FJ_ALL_SHOPS_ID ? 'Amba chicken yield by shop' : 'Yield loss, set against weighed'} subtitle="loss % · the number set in Setup against what the kitchen weighed">
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
          <Footnote>Drift above the set figure means the kitchen is losing more in cooking than the recipe assumes, so every batch yields fewer portions than planned.</Footnote>
        </Card>
        <Card title="Prep hours per £100" subtitle={`last week · estate average ${prep.estateAverage.toFixed(2)} h`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
            {prep.rows.slice(0, 10).map(p => (
              <BarRow key={p.name} label={p.name} value={`${p.hours.toFixed(2)} h`} share={p.hours / maxPrep} colour={NAVY} delta={pctDelta(p.hours, prep.estateAverage)} invert />
            ))}
          </div>
          <Footnote>Kitchen hours spent on prep for every £100 of net sales. Chips compare each shop with the estate average; lower is better.</Footnote>
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

/** Whole-percent change of `now` against `base`; 0 when there is no base. */
function pctDelta(now: number, base: number): number {
  if (!base) return 0;
  return Math.round((now / base - 1) * 100);
}

function deltaText(pct: number): string {
  if (pct === 0) return 'level';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}

/** Whole-percent share; anything under half a percent reads "<1%" rather than "0%". */
function shareText(share: number): string {
  if (share > 0 && share < 0.005) return '<1%';
  return `${Math.round(share * 100)}%`;
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
    // No explicit height: grid rows stretch cards to match their neighbours,
    // and a lone card in a flex column sizes to its content.
    <div style={{ borderRadius: 12, border: `1px solid ${NAVY}`, background: '#fff', boxShadow: '0 2px 12px rgba(0, 28, 53,0.1), 0 0 0 1px rgba(0, 28, 53,0.03)', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '14px 16px 6px', display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '4px 16px 14px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

/** One line of context at the foot of a card: what the numbers are and how to read them. */
function Footnote({ children }: { children: ReactNode }) {
  return <p style={{ margin: 'auto 0 0', paddingTop: 10, fontSize: 11, lineHeight: 1.45, color: 'var(--color-text-muted)' }}>{children}</p>;
}

/** Small coloured chip: change against the baseline. `invert` when lower is better. */
function DeltaChip({ pct, invert }: { pct: number; invert?: boolean }) {
  const good = pct === 0 ? undefined : invert ? pct < 0 : pct > 0;
  const colour = good === undefined ? 'var(--color-text-muted)' : good ? OK : WARN;
  const bg = good === undefined ? 'var(--color-bg-hover)' : good ? 'rgba(22,101,52,0.08)' : 'rgba(180,83,9,0.1)';
  return (
    <span aria-label={`${deltaText(pct)} against baseline`} style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: bg, color: colour, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      {deltaText(pct)}
    </span>
  );
}

function BarRow({ label, value, share, colour, delta, invert }: { label: string; value: string; share: number; colour: string; delta?: number; invert?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'center' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            {delta !== undefined && <DeltaChip pct={delta} invert={invert} />}
          </span>
          <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--color-bg-hover)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(2, Math.min(100, share * 100))}%`, height: '100%', background: colour, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
}

/** Fixed-height chart box. Inside a flex column a Recharts ResponsiveContainer
 *  can otherwise grow its own parent (min-height: auto), so the box is pinned. */
function chartBox(height: number): CSSProperties {
  return { height, minHeight: 0, flex: `0 0 ${height}px`, overflow: 'hidden' };
}

const tip: CSSProperties = { background: '#FCF6EE', border: `1px solid ${NAVY}`, borderRadius: 8, fontSize: 12, fontWeight: 500, color: NAVY };
const table: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
const th: CSSProperties = { textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', padding: '6px 6px', borderBottom: '1px solid var(--color-border-subtle)' };
const td: CSSProperties = { padding: '7px 6px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' };
const tfootCell: CSSProperties = { padding: '8px 6px', color: 'var(--color-text-primary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${NAVY}` };

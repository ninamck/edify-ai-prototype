'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ChevronDown, ChevronRight, Coins, ExternalLink, Info, ShoppingBag, Users } from 'lucide-react';
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import EditableKpiTile, { multiplierForNewValue, parseCountInput, parseCurrencyInput } from '@/components/Forecast/TotalEditor';
import { gbp } from './cascade';
import { addDays, FJ_DEMO_TODAY, longDay, shortDate, weekdayLabel } from './calendar';
import { Notice } from './DayPlan';
import { useFjClock } from './fjClock';
import { useFjPlanStore } from './FjPlanStore';
import {
  DAY_PART_HOURS, DAY_PART_LABELS, DAY_PARTS, dayPartStatus, forecastTrend, narrateForecast, narrateResult, netToHour,
  productForecastRows, scopeActual, scopeForecast, type ProductForecastRow, type Totals,
} from './forecast';
import { ALL_CHANNELS, CHANNEL_LABELS } from './lines';
import { PRODUCT_GROUP_LABELS, type ProductGroup } from './recipes';
import type { SalesChannel } from './salesDay';
import { FJ_ALL_SHOPS_ID, getShop } from './shops';

/**
 * Forecast page for Farmer J. Same shape as the Pret page (Forecast and
 * Result scopes, a hero with three KPIs, a trend chart, a per-item drill)
 * but every number is read from the Day plan's own forecast, so the two
 * screens agree to the pound. Editing the headline here changes the day's
 * whole-day flex, which is the only lever the Day plan has, and the Day
 * plan shows the edit the moment you open it.
 */

type Scope = 'forecast' | 'result';

const PAST_DAYS = 7;
const FUTURE_DAYS = 3;

const CHANNEL_COLOURS: Record<SalesChannel, string> = {
  instore: '#001C35', kiosk: '#28AFC9', deliveroo: '#1A148A', clickcollect: '#FF0058', corporate: '#6B7280', citypantry: '#F59E0B', ordit: '#10B981',
};

export default function ForecastScreen() {
  const { isFarmerJ, productionSiteId } = useActiveSite();
  const scopeId = productionSiteId ?? FJ_ALL_SHOPS_ID;
  const [scope, setScope] = useState<Scope>('forecast');
  const [forecastDate, setForecastDate] = useState(FJ_DEMO_TODAY);
  const [resultDate, setResultDate] = useState(addDays(FJ_DEMO_TODAY, -1));

  if (!isFarmerJ) return <Notice>Switch the Brand pill in demo controls to Farmer J to see this screen.</Notice>;

  const date = scope === 'forecast' ? forecastDate : resultDate;
  const setDate = scope === 'forecast' ? setForecastDate : setResultDate;
  const dates = scope === 'forecast'
    ? Array.from({ length: 8 }, (_, i) => addDays(FJ_DEMO_TODAY, i))
    : Array.from({ length: PAST_DAYS + 1 }, (_, i) => addDays(FJ_DEMO_TODAY, i - PAST_DAYS));

  return (
    <div style={{ padding: '20px 28px 48px', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Tabs value={scope} onChange={setScope} />
        <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
          {scopeId === FJ_ALL_SHOPS_ID ? 'All shops' : getShop(scopeId)?.name}
        </span>
      </div>

      <DayStrip scopeId={scopeId} dates={dates} selected={date} onSelect={setDate} showActual={scope === 'result'} />

      {scope === 'forecast' ? <ForecastHero scopeId={scopeId} date={date} /> : <ResultHero scopeId={scopeId} date={date} />}

      <TrendChart scopeId={scopeId} highlight={date} futureDays={scope === 'forecast' ? FUTURE_DAYS : 0} />

      <ProductDrill scopeId={scopeId} date={date} withActual={scope === 'result'} />
    </div>
  );
}

// ─── Day strip ────────────────────────────────────────────────────────────────

function DayStrip({ scopeId, dates, selected, onSelect, showActual }: { scopeId: string; dates: string[]; selected: string; onSelect: (d: string) => void; showActual: boolean }) {
  const store = useFjPlanStore();
  const cards = useMemo(
    () => dates.map(d => {
      const f = scopeForecast(scopeId, d, store.get);
      const a = showActual && d <= FJ_DEMO_TODAY ? scopeActual(scopeId, d).net : undefined;
      return { date: d, net: f.forecast.net, open: f.openShops > 0, actual: a };
    }),
    [dates, scopeId, store, showActual],
  );
  return (
    <div role="tablist" aria-label="Select day" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
      {cards.map(c => {
        const isToday = c.date === FJ_DEMO_TODAY;
        const active = c.date === selected;
        return (
          <button
            key={c.date}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onSelect(c.date)}
            style={{
              flex: '0 0 auto', minWidth: 104, padding: '10px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${active ? 'var(--color-accent-active)' : isToday ? 'var(--color-border)' : 'var(--color-border-subtle)'}`,
              background: active ? 'var(--color-accent-active)' : '#ffffff', color: active ? '#fff' : 'var(--color-text-primary)',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>{isToday ? 'Today' : weekdayLabel(c.date)}</div>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>{Number(c.date.slice(8, 10))}</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85, fontVariantNumeric: 'tabular-nums' }}>
              {!c.open ? 'closed' : c.actual !== undefined ? `${gbp(c.actual)} of ${gbp(c.net)}` : gbp(c.net)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Forecast hero ────────────────────────────────────────────────────────────

function ForecastHero({ scopeId, date }: { scopeId: string; date: string }) {
  const store = useFjPlanStore();
  const f = useMemo(() => scopeForecast(scopeId, date, store.get), [scopeId, date, store]);
  const single = f.shops.length === 1 ? f.shops[0] : null;
  const flex = f.flexPct ?? 0;
  const multiplier = 1 + flex / 100;

  const setFlex = useCallback(
    (m: number | null) => {
      if (!single) return;
      const pct = m === null ? 0 : Math.max(-50, Math.min(100, Math.round((m - 1) * 100)));
      store.update(single.shopId, date, r => ({ ...r, flexPct: pct }));
    },
    [store, single, date],
  );
  const toggleRef = useCallback(
    (refDate: string) => {
      if (!single) return;
      store.update(single.shopId, date, r => ({
        ...r,
        excludedReferenceDays: r.excludedReferenceDays.includes(refDate) ? r.excludedReferenceDays.filter(d => d !== refDate) : [...r.excludedReferenceDays, refDate],
      }));
    },
    [store, single, date],
  );

  if (f.openShops === 0) return <Card><p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>Closed on {longDay(date)} {Number(date.slice(8, 10))}. Nothing to forecast.</p></Card>;

  const editable = Boolean(single);
  const overridden = flex !== 0;
  const tile = (icon: React.ReactNode, label: string, value: number, base: number, display: string, parse: (s: string) => number | null) => (
    <EditableKpiTile
      icon={icon}
      label={label}
      value={value}
      display={display}
      baseline={base}
      isOverridden={overridden}
      multiplier={multiplier}
      parse={parse}
      editable={editable}
      onCommit={v => setFlex(v == null ? null : multiplierForNewValue(base, v))}
    />
  );

  return (
    <Card>
      <Header title="What's forecasted" sub={`${date === FJ_DEMO_TODAY ? 'Today' : date === addDays(FJ_DEMO_TODAY, 1) ? 'Tomorrow' : shortDate(date)} · ${longDay(date)}`}>
        <Link href={`/production/day${date ? `?date=${date}` : ''}`} style={linkStyle}>
          Open day plan <ExternalLink size={12} />
        </Link>
      </Header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {tile(<Coins size={15} />, 'Net sales forecast', f.forecast.net, f.baseline.net, gbp(f.forecast.net), parseCurrencyInput)}
        {tile(<Users size={15} />, 'Trays forecast', f.forecast.trays, f.baseline.trays, Math.round(f.forecast.trays).toLocaleString('en-GB'), parseCountInput)}
        {tile(<ShoppingBag size={15} />, 'Portions forecast', f.forecast.portions, f.baseline.portions, Math.round(f.forecast.portions).toLocaleString('en-GB'), parseCountInput)}
      </div>

      <Why>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{narrateForecast(f, weekdayLabel(date))}</p>
        {single && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>Reference days</span>
            {single.referenceDays.map(r => (
              <button
                key={r.date}
                type="button"
                onClick={() => toggleRef(r.date)}
                aria-pressed={r.included}
                title={r.anomaly ? `${r.anomaly.reason}. ${r.included ? 'Tap to leave out.' : 'Left out. Tap to include.'}` : r.included ? 'In the average. Tap to leave out.' : 'Left out. Tap to include.'}
                style={{
                  ...refChip,
                  color: r.included ? (r.anomaly ? 'var(--color-warning)' : 'var(--color-text-secondary)') : 'var(--color-text-muted)',
                  borderColor: r.included ? (r.anomaly ? 'var(--color-warning)' : 'var(--color-border)') : 'var(--color-border-subtle)',
                  textDecoration: r.included ? 'none' : 'line-through',
                }}
              >
                {shortDate(r.date)}{r.anomaly ? ` · ${r.anomaly.reason.split(' ')[0].toLowerCase()}` : ''}
              </button>
            ))}
            {!editable && <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>Pick one shop to edit.</span>}
          </div>
        )}
        {!single && <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{f.openShops} shops open · {f.approved} approved. Pick a shop in the site switcher to edit its flex or reference days.</span>}
        {single && overridden && (
          <span style={{ fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
            Whole-day flex {flex > 0 ? '+' : ''}{flex}% is on the Day plan too. {single.approved ? 'This day is approved; the Day plan will ask the GM to keep or take the new numbers.' : ''}
          </span>
        )}
      </Why>

      <DayParts forecast={f.forecast} />
      <Channels forecast={f.forecast} />
    </Card>
  );
}

// ─── Result hero ──────────────────────────────────────────────────────────────

function ResultHero({ scopeId, date }: { scopeId: string; date: string }) {
  const store = useFjPlanStore();
  const clock = useFjClock();
  const isToday = date === FJ_DEMO_TODAY;
  const hour = Math.floor(clock.mins / 60);
  const f = useMemo(() => scopeForecast(scopeId, date, store.get), [scopeId, date, store]);
  const a = useMemo(() => scopeActual(scopeId, date), [scopeId, date]);

  if (f.openShops === 0) return <Card><p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>Closed on {longDay(date)} {Number(date.slice(8, 10))}.</p></Card>;

  // Today reads "so far": both sides cut at the clock hour so a 10:15
  // result is not a full-day forecast against a morning's takings.
  const soFar = (t: Totals) => (isToday ? netToHour(t, hour) : t.net);
  const fNet = soFar(f.forecast);
  const aNet = soFar(a);
  const fShare = f.forecast.net > 0 ? fNet / f.forecast.net : 1;
  const aShare = a.net > 0 ? aNet / a.net : 1;
  const count = (n: number) => Math.round(n).toLocaleString('en-GB');

  const tile = (icon: React.ReactNode, label: string, forecast: number, actual: number, fullDay: number, fmt: (n: number) => string) => (
    <EditableKpiTile
      icon={icon}
      label={label}
      value={actual}
      display={fmt(actual)}
      baseline={forecast}
      isOverridden={false}
      multiplier={forecast > 0 ? actual / forecast : 1}
      parse={() => null}
      editable={false}
      onCommit={() => undefined}
      subline={<span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{isToday ? `So far. Full-day forecast ${fmt(fullDay)}` : `Forecast ${fmt(forecast)}`}</span>}
      compareVisual={<CompareBars forecast={forecast} actual={actual} />}
    />
  );

  return (
    <Card>
      <Header title="How it landed" sub={`${isToday ? `Today (live, to ${String(hour).padStart(2, '0')}:00)` : date === addDays(FJ_DEMO_TODAY, -1) ? 'Yesterday' : shortDate(date)} · ${longDay(date)}`}>
        <Link href={`/production/record`} style={linkStyle}>
          Open production record <ExternalLink size={12} />
        </Link>
      </Header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {tile(<Coins size={15} />, 'Net sales', fNet, aNet, f.forecast.net, gbp)}
        {tile(<Users size={15} />, 'Trays', f.forecast.trays * fShare, a.trays * aShare, f.forecast.trays, count)}
        {tile(<ShoppingBag size={15} />, 'Portions', f.forecast.portions * fShare, a.portions * aShare, f.forecast.portions, count)}
      </div>

      <Why>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{narrateResult(f.forecast, a, isToday, hour)}</p>
        <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
          Forecast was {gbp(f.forecast.net)} for the day{f.flexPct ? `, with flex ${f.flexPct > 0 ? '+' : ''}${f.flexPct}%` : ''}. {f.approved} of {f.openShops} {f.openShops === 1 ? 'plan' : 'plans'} approved.
        </span>
      </Why>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 style={subheading}>Within the day</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {DAY_PARTS.map(p => {
            const status = dayPartStatus(p, clock.mins, isToday);
            const fp = f.forecast.byDayPart[p];
            const ap = a.byDayPart[p];
            const delta = fp > 0 ? ((ap - fp) / fp) * 100 : 0;
            return (
              <div key={p} style={{ ...tileBox, opacity: status === 'pending' ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={tileLabel}>{DAY_PART_LABELS[p]}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{status === 'current' ? 'in progress' : status === 'pending' ? 'to come' : DAY_PART_HOURS[p]}</span>
                </div>
                <CompareBars forecast={fp} actual={status === 'pending' ? 0 : ap} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Pair label="Forecast" value={gbp(fp)} />
                  <Pair label="Actual" value={status === 'pending' ? '—' : gbp(ap)} />
                  {status === 'complete' && fp > 0 && <Pair label="Delta" value={`${delta >= 0 ? '+' : '−'}${Math.abs(Math.round(delta))}%`} tone={delta >= 0 ? 'good' : 'bad'} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Channels forecast={f.forecast} actual={a} />
    </Card>
  );
}

// ─── Shared hero pieces ───────────────────────────────────────────────────────

function DayParts({ forecast }: { forecast: Totals }) {
  const max = Math.max(...DAY_PARTS.map(p => forecast.byDayPart[p]), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={subheading}>Within the day</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {DAY_PARTS.map(p => {
          const v = forecast.byDayPart[p];
          return (
            <div key={p} style={{ ...tileBox, opacity: v > 0 ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={tileLabel}>{DAY_PART_LABELS[p]}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{DAY_PART_HOURS[p]}</span>
              </div>
              <div style={{ height: 4, background: 'var(--color-border-subtle)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(v / max) * 100}%`, background: 'var(--color-accent-active)', borderRadius: 999 }} />
              </div>
              <Pair label="Net sales" value={v > 0 ? gbp(v) : 'not traded'} />
              <Pair label="Share" value={forecast.net > 0 ? `${Math.round((v / forecast.net) * 100)}%` : '—'} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Channels({ forecast, actual }: { forecast: Totals; actual?: Totals }) {
  const channels = ALL_CHANNELS.filter(c => forecast.byChannel[c] > 0 || (actual?.byChannel[c] ?? 0) > 0);
  const total = Math.max(forecast.net, 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={subheading}>By channel</h3>
      <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', border: '1px solid var(--color-border-subtle)' }}>
        {channels.map(c => <span key={c} style={{ flex: forecast.byChannel[c], background: CHANNEL_COLOURS[c] }} />)}
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {channels.map(c => {
          const fv = forecast.byChannel[c];
          const av = actual?.byChannel[c];
          return (
            <div key={c} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: CHANNEL_COLOURS[c], marginTop: 3, flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{CHANNEL_LABELS[c]} <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{Math.round((fv / total) * 100)}%</span></span>
                <span style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                  {av !== undefined ? `${gbp(av)} of ${gbp(fv)}` : gbp(fv)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompareBars({ forecast, actual }: { forecast: number; actual: number }) {
  const max = Math.max(forecast, actual, 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ height: 4, background: 'var(--color-border-subtle)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(forecast / max) * 100}%`, background: 'var(--color-text-muted)', borderRadius: 999 }} />
      </div>
      <div style={{ height: 4, background: 'var(--color-border-subtle)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(actual / max) * 100}%`, background: actual >= forecast ? 'var(--color-success)' : 'var(--color-warning)', borderRadius: 999 }} />
      </div>
    </div>
  );
}

// ─── Trend ────────────────────────────────────────────────────────────────────

function TrendChart({ scopeId, highlight, futureDays }: { scopeId: string; highlight: string; futureDays: number }) {
  const store = useFjPlanStore();
  const points = useMemo(() => forecastTrend(scopeId, store.get, PAST_DAYS, futureDays), [scopeId, store, futureDays]);
  const data = points.map(p => ({
    d: `${weekdayLabel(p.date).slice(0, 3)} ${Number(p.date.slice(8, 10))}`,
    date: p.date,
    forecast: Math.round(p.forecast),
    actual: p.actual !== undefined ? Math.round(p.actual) : undefined,
    today: p.today,
  }));
  // Today is still trading, so it stays out of the miss average.
  const misses = points.filter(p => !p.today && p.actual !== undefined && p.forecast > 0).map(p => Math.abs(p.actual! - p.forecast) / p.forecast);
  const mape = misses.length ? (misses.reduce((a, b) => a + b, 0) / misses.length) * 100 : 0;
  return (
    <Card>
      <Header title="Forecast against actual" sub={`Last ${PAST_DAYS} days${futureDays ? ` and the next ${futureDays}` : ''}`}>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Average miss <strong>{mape.toFixed(1)}%</strong> over {misses.length} traded days · today shown lighter, still trading</span>
      </Header>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
            <XAxis dataKey="d" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={48} tickFormatter={v => `£${Math.round(Number(v) / 1000)}k`} />
            <Tooltip formatter={(v, name) => [gbp(Number(v)), name === 'actual' ? 'Actual' : 'Forecast']} />
            <Legend formatter={v => (v === 'actual' ? 'Actual' : 'Forecast')} />
            <Bar dataKey="actual" fill="#001C35" radius={[4, 4, 0, 0]} maxBarSize={28}>
              {data.map(d => <Cell key={d.date} fill="#001C35" fillOpacity={d.today ? 0.45 : 1} />)}
            </Bar>
            <Line type="monotone" dataKey="forecast" stroke="var(--color-accent-active)" strokeWidth={2} dot={(props: { cx?: number; cy?: number; payload?: { date: string } }) => (
              <circle key={props.payload?.date} cx={props.cx} cy={props.cy} r={props.payload?.date === highlight ? 5 : 3} fill={props.payload?.date === highlight ? 'var(--color-accent-active)' : '#fff'} stroke="var(--color-accent-active)" strokeWidth={2} />
            )} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ─── Product drill ────────────────────────────────────────────────────────────

function ProductDrill({ scopeId, date, withActual }: { scopeId: string; date: string; withActual: boolean }) {
  const store = useFjPlanStore();
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => (open ? productForecastRows(scopeId, date, store.get, withActual) : []), [open, scopeId, date, store, withActual]);
  const refDates = rows[0]?.perReferenceDay ?? [];
  const groups = Array.from(new Set(rows.map(r => r.group))) as ProductGroup[];
  return (
    <section style={{ background: '#ffffff', border: '1px solid var(--color-border-subtle)', borderRadius: 14, overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
        {open ? <ChevronDown size={16} color="var(--color-text-secondary)" /> : <ChevronRight size={16} color="var(--color-text-secondary)" />}
        <span style={{ fontSize: 14.5, fontWeight: 700 }}>View by product</span>
        <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
          Portions on each reference day, the average, the flexed forecast and the batches the Day plan makes from it{withActual ? ', against what sold' : ''}.
        </span>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={th}>Product</th>
                {refDates.map(r => <th key={r.date} style={{ ...th, textAlign: 'right', textDecoration: r.included ? 'none' : 'line-through', color: r.included ? undefined : 'var(--color-text-muted)' }}>{shortDate(r.date)}</th>)}
                <th style={{ ...th, textAlign: 'right' }}>Average</th>
                <th style={{ ...th, textAlign: 'right' }}>Forecast</th>
                <th style={{ ...th, textAlign: 'right' }}>Batches</th>
                {withActual && <th style={{ ...th, textAlign: 'right' }}>Sold</th>}
                {withActual && <th style={{ ...th, textAlign: 'right' }}>Miss</th>}
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <GroupRows key={g} group={g} rows={rows.filter(r => r.group === g)} withActual={withActual} date={date} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function GroupRows({ group, rows, withActual, date }: { group: ProductGroup; rows: ProductForecastRow[]; withActual: boolean; date: string }) {
  const cols = 4 + (rows[0]?.perReferenceDay.length ?? 0) + (withActual ? 2 : 0);
  return (
    <>
      <tr>
        <td colSpan={cols} style={{ padding: '10px 18px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)' }}>
          {PRODUCT_GROUP_LABELS[group]} · {rows.length}
        </td>
      </tr>
      {rows.map(r => {
        const miss = r.soldPortions !== undefined && r.forecastPortions > 0 ? ((r.soldPortions - r.forecastPortions) / r.forecastPortions) * 100 : null;
        return (
          <tr key={r.productId}>
            <td style={{ ...td, fontWeight: 600 }}>
              {r.product.name}
              {r.overridden && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--color-info)', fontWeight: 700 }}>edited on the day plan</span>}
            </td>
            {r.perReferenceDay.map(x => (
              <td key={x.date} style={{ ...td, textAlign: 'right', color: x.included ? 'var(--color-text-secondary)' : 'var(--color-text-muted)', textDecoration: x.included ? 'none' : 'line-through' }}>{Math.round(x.portions)}</td>
            ))}
            <td style={{ ...td, textAlign: 'right' }}>{Math.round(r.baselinePortions)}</td>
            <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{Math.round(r.forecastPortions)}</td>
            <td style={{ ...td, textAlign: 'right' }}>
              <Link href={`/production/day?date=${date}`} style={{ color: 'var(--color-text-primary)', textDecoration: 'none', borderBottom: '1px dotted var(--color-border)' }} title="Open on the Day plan">
                {r.batches % 1 === 0 ? r.batches : r.batches.toFixed(1).replace('.5', '½')}
              </Link>
            </td>
            {withActual && <td style={{ ...td, textAlign: 'right' }}>{r.soldPortions !== undefined ? Math.round(r.soldPortions) : '—'}</td>}
            {withActual && (
              <td style={{ ...td, textAlign: 'right', color: miss === null ? 'var(--color-text-muted)' : Math.abs(miss) <= 10 ? 'var(--color-text-secondary)' : miss > 0 ? 'var(--color-warning)' : 'var(--color-error)', fontWeight: 600 }}>
                {miss === null ? '—' : `${miss >= 0 ? '+' : '−'}${Math.abs(Math.round(miss))}%`}
              </td>
            )}
          </tr>
        );
      })}
    </>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Tabs({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  const options: Array<{ id: Scope; label: string }> = [{ id: 'forecast', label: 'Forecast' }, { id: 'result', label: 'Result' }];
  return (
    <div role="tablist" style={{ display: 'flex', background: 'var(--color-bg-hover)', borderRadius: 100, padding: 3, width: 'fit-content' }}>
      {options.map(o => {
        const active = o.id === value;
        return (
          <button key={o.id} type="button" role="tab" aria-selected={active} onClick={() => onChange(o.id)} style={{ padding: '7px 16px', border: 'none', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: active ? 'var(--color-accent-active)' : 'transparent', color: active ? '#fff' : 'var(--color-text-secondary)' }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section style={{ background: '#ffffff', border: '1px solid var(--color-border-subtle)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>{children}</section>;
}

function Header({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h2>
      <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{sub}</span>
      <span style={{ marginLeft: 'auto' }}>{children}</span>
    </div>
  );
}

function Why({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)', borderRadius: 10 }}>
      <Info size={15} color="var(--color-text-secondary)" style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function Pair({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: tone === 'good' ? 'var(--color-success)' : tone === 'bad' ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>{value}</span>
    </div>
  );
}

const subheading: CSSProperties = { margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' };
const tileBox: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: 12, background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)', borderRadius: 10 };
const tileLabel: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' };
const linkStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--color-accent-active)', textDecoration: 'none' };
const refChip: CSSProperties = { display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, border: '1.5px solid', background: '#ffffff', fontFamily: 'inherit', letterSpacing: '0.02em', whiteSpace: 'nowrap', cursor: 'pointer' };
const th: CSSProperties = { padding: '8px 18px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', textAlign: 'left', borderBottom: '1px solid var(--color-border-subtle)', whiteSpace: 'nowrap' };
const td: CSSProperties = { padding: '7px 18px', borderBottom: '1px solid var(--color-border-subtle)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

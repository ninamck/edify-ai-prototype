'use client';

// The eight cross-estate charts shown under "Across all sites" on the
// in-shift dashboard. Data and business rules live in
// `data/allSitesMockData.ts`; this file is only how each one is drawn.

import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { ACCENT, ACCENT_MID, OK, WARN, tipStyle } from '@/components/Dashboard/data/estateMockData';
import {
  FORECAST_VS_ACTUAL,
  MENU_ITEMS,
  MENU_MEDIAN_GP,
  MENU_MEDIAN_UNITS,
  PRICE_RISES,
  RECIPE_DRIFT,
  STOCKTAKE_HYGIENE,
  STOCKTAKE_POLICY_DAYS,
  STOCKTAKE_STALE_DAYS,
  SUPPLIER_SPEND,
  USAGE_GAPS,
  WASTE_BY_SITE,
  WASTE_REASONS,
  menuQuadrant,
  wasteTotal,
  type ForecastActualPoint,
  type MenuItemPoint,
  type PriceRisePoint,
  type RecipeDriftPoint,
  type SiteWastePoint,
  type StocktakeHygienePoint,
  type SupplierSpendPoint,
  type UsageGapPoint,
} from '@/components/Dashboard/data/allSitesMockData';

const TICK = { fontSize: 12, fill: 'var(--color-text-muted)' };
const GRID = 'var(--color-border-subtle)';
const VIZ = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--viz-4)', 'var(--viz-5)'];

/** Recharts 3 sorts legend items alphabetically by default; this keeps them
 *  in the same order as the series so the legend reads like the bars. */
const legendOrder =
  (names: readonly string[]) =>
  (item: { value?: string }) =>
    names.indexOf(item.value ?? '');

const gbp = (n: number, dp = 0) =>
  `£${n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
const gbpK = (n: number) => `£${n.toFixed(1)}k`;
const signed = (n: number, suffix: string) => `${n > 0 ? '+' : ''}${n}${suffix}`;

/** Shared tooltip body: bold title, then label/value rows. */
function Tip({ title, rows }: { title: string; rows: Array<[string, ReactNode]> }) {
  return (
    <div style={{ ...tipStyle, padding: '8px 10px', lineHeight: 1.5 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}

// ── 1. Spend by supplier ───────────────────────────────────────────────────

export function SupplierSpendChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart layout="vertical" data={SUPPLIER_SPEND} margin={{ top: 4, right: 16, left: 4, bottom: 4 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} tickFormatter={(v) => `£${v}k`} />
        <YAxis type="category" dataKey="supplier" width={140} tick={TICK} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: 'rgba(0,28,53,0.04)' }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as SupplierSpendPoint | undefined;
            if (!p) return null;
            const change = Math.round(((p.thisMonth - p.lastMonth) / p.lastMonth) * 1000) / 10;
            return (
              <Tip
                title={p.supplier}
                rows={[
                  ['Category', p.category],
                  ['1–6 Sept', gbpK(p.thisMonth)],
                  ['1–6 Aug', gbpK(p.lastMonth)],
                  ['Change', signed(change, '%')],
                ]}
              />
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" itemSorter={legendOrder(['This month', 'Last month'])} />
        <Bar dataKey="thisMonth" name="This month" fill={ACCENT} radius={[0, 4, 4, 0]} maxBarSize={12} />
        <Bar dataKey="lastMonth" name="Last month" fill={ACCENT_MID} fillOpacity={0.55} radius={[0, 4, 4, 0]} maxBarSize={12} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 2. Biggest ingredient price rises ─────────────────────────────────────

const PRICE_RISE_FLAG_PCT = 10;

export function PriceRisesChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart layout="vertical" data={PRICE_RISES} margin={{ top: 4, right: 40, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} unit="%" domain={[0, 'dataMax + 4']} />
        <YAxis type="category" dataKey="ingredient" width={150} tick={TICK} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: 'rgba(0,28,53,0.04)' }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as PriceRisePoint | undefined;
            if (!p) return null;
            return (
              <Tip
                title={p.ingredient}
                rows={[
                  ['Supplier', p.supplier],
                  ['Price', `${gbp(p.before, 2)} → ${gbp(p.now, 2)} per ${p.unit}`],
                  ['Rise', signed(p.risePct, '%')],
                  ['Volume', `${p.monthlyVolume.toLocaleString('en-GB')} ${p.unit} a month`],
                  ['Costs the estate', `${gbp(p.monthlyImpact)} a month more`],
                ]}
              />
            );
          }}
        />
        <ReferenceLine x={PRICE_RISE_FLAG_PCT} stroke={WARN} strokeDasharray="4 3" />
        <Bar dataKey="risePct" name="Rise %" radius={[0, 4, 4, 0]} maxBarSize={16}>
          {PRICE_RISES.map((p) => (
            <Cell key={p.ingredient} fill={p.risePct >= PRICE_RISE_FLAG_PCT ? WARN : ACCENT_MID} />
          ))}
          <LabelList
            dataKey="monthlyImpact"
            position="right"
            formatter={(v: unknown) => `+${gbp(Number(v))}/mo`}
            style={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 3. Recipe cost drift past target GP ───────────────────────────────────

const RECIPE_DRIFT_FLAG_PP = 3;

export function RecipeDriftChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart layout="vertical" data={RECIPE_DRIFT} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} unit="pp" domain={[0, 10]} />
        <YAxis type="category" dataKey="recipe" width={176} tick={TICK} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: 'rgba(0,28,53,0.04)' }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as RecipeDriftPoint | undefined;
            if (!p) return null;
            return (
              <Tip
                title={p.recipe}
                rows={[
                  ['Menu price', gbp(p.menuPrice, 2)],
                  ['Recipe cost', `${gbp(p.costAtTarget, 2)} → ${gbp(p.costNow, 2)}`],
                  ['Target GP', `${p.targetGp}%`],
                  ['GP now', `${p.actualGp}%`],
                  ['Below target', `${p.gapPp}pp`],
                  ['Driven by', p.driver],
                ]}
              />
            );
          }}
        />
        <ReferenceLine x={RECIPE_DRIFT_FLAG_PP} stroke={WARN} strokeDasharray="4 3" />
        <Bar dataKey="gapPp" name="pp below target GP" radius={[0, 4, 4, 0]} maxBarSize={16}>
          {RECIPE_DRIFT.map((p) => (
            <Cell key={p.recipe} fill={p.gapPp >= RECIPE_DRIFT_FLAG_PP ? WARN : ACCENT_MID} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 4. Waste £ by site and reason ─────────────────────────────────────────

export function WasteBySiteChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart layout="vertical" data={WASTE_BY_SITE} margin={{ top: 4, right: 56, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} tickFormatter={(v) => `£${v}`} />
        <YAxis type="category" dataKey="site" width={96} tick={TICK} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: 'rgba(0,28,53,0.04)' }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as SiteWastePoint | undefined;
            if (!p) return null;
            return (
              <Tip
                title={`${p.site} · ${gbp(wasteTotal(p))} month to date`}
                rows={WASTE_REASONS.map((r) => [r, gbp(p[r])])}
              />
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" itemSorter={legendOrder(WASTE_REASONS)} />
        {WASTE_REASONS.map((reason, i) => {
          const last = i === WASTE_REASONS.length - 1;
          return (
            <Bar
              key={reason}
              dataKey={reason}
              name={reason}
              stackId="waste"
              fill={VIZ[i]}
              maxBarSize={14}
              radius={last ? [0, 4, 4, 0] : undefined}
            >
              {last && (
                <LabelList
                  dataKey={(d: unknown) => wasteTotal(d as SiteWastePoint)}
                  position="right"
                  formatter={(v: unknown) => gbp(Number(v))}
                  style={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                />
              )}
            </Bar>
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 5. Stocktake hygiene ──────────────────────────────────────────────────

function stocktakeColour(days: number): string {
  if (days > STOCKTAKE_STALE_DAYS) return WARN;
  if (days > STOCKTAKE_POLICY_DAYS) return ACCENT_MID;
  return OK;
}

export function StocktakeHygieneChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart layout="vertical" data={STOCKTAKE_HYGIENE} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, 'dataMax + 2']} />
        <YAxis type="category" dataKey="site" width={96} tick={TICK} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: 'rgba(0,28,53,0.04)' }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as StocktakeHygienePoint | undefined;
            if (!p) return null;
            return (
              <Tip
                title={p.site}
                rows={[
                  ['Days since count', `${p.daysSince}`],
                  ['Last counted', p.lastCounted],
                  ['By', p.countedBy],
                  ['Policy', `every ${STOCKTAKE_POLICY_DAYS} days`],
                ]}
              />
            );
          }}
        />
        <ReferenceLine
          x={STOCKTAKE_POLICY_DAYS}
          stroke={ACCENT}
          strokeDasharray="4 3"
          label={{ value: 'policy', position: 'insideBottomRight', fontSize: 11, fill: 'var(--color-text-muted)' }}
        />
        <ReferenceLine x={STOCKTAKE_STALE_DAYS} stroke={WARN} strokeDasharray="4 3" />
        <Bar dataKey="daysSince" name="Days since last count" radius={[0, 4, 4, 0]} maxBarSize={14}>
          {STOCKTAKE_HYGIENE.map((p) => (
            <Cell key={p.site} fill={stocktakeColour(p.daysSince)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 6. Forecast vs actual sales by site ───────────────────────────────────

const FORECAST_NOISE_PCT = 3;

export function ForecastVsActualChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={FORECAST_VS_ACTUAL} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="site" tick={{ ...TICK, fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
        <YAxis tick={TICK} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `£${v}k`} domain={[0, 40]} />
        <Tooltip
          cursor={{ fill: 'rgba(0,28,53,0.04)' }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as ForecastActualPoint | undefined;
            if (!p) return null;
            return (
              <Tip
                title={p.site}
                rows={[
                  ['Forecast', gbpK(p.forecast)],
                  ['Actual (POS)', gbpK(p.actual)],
                  ['Variance', signed(p.variancePct, '%')],
                ]}
              />
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" itemSorter={legendOrder(['Forecast £k', 'Actual £k'])} />
        <Bar dataKey="forecast" name="Forecast £k" fill={ACCENT_MID} fillOpacity={0.45} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="actual" name="Actual £k" radius={[4, 4, 0, 0]} maxBarSize={22}>
          {FORECAST_VS_ACTUAL.map((p) => (
            <Cell key={p.site} fill={p.variancePct < -FORECAST_NOISE_PCT ? WARN : ACCENT} />
          ))}
          <LabelList
            dataKey="variancePct"
            position="top"
            formatter={(v: unknown) => signed(Number(v), '%')}
            style={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 7. Theoretical vs actual usage ────────────────────────────────────────

export function UsageGapChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart layout="vertical" data={USAGE_GAPS} margin={{ top: 4, right: 44, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} tickFormatter={(v) => `£${v}`} />
        <YAxis type="category" dataKey="item" width={150} tick={TICK} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: 'rgba(0,28,53,0.04)' }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as UsageGapPoint | undefined;
            if (!p) return null;
            return (
              <Tip
                title={p.item}
                rows={[
                  ['Theoretical (POS × recipe)', `${p.theoretical.toLocaleString('en-GB')} ${p.unit}`],
                  ['Actual (stocktake)', `${p.actual.toLocaleString('en-GB')} ${p.unit}`],
                  ['Gap', `${(p.actual - p.theoretical).toLocaleString('en-GB')} ${p.unit} (${signed(p.gapPct, '%')})`],
                  ['Unit cost', gbp(p.unitCost, 2)],
                  ['£ gap', gbp(p.gapValue)],
                ]}
              />
            );
          }}
        />
        <Bar dataKey="gapValue" name="£ gap" fill={ACCENT} radius={[0, 4, 4, 0]} maxBarSize={14}>
          <LabelList
            dataKey="gapPct"
            position="right"
            formatter={(v: unknown) => signed(Number(v), '%')}
            style={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 8. Menu contribution ──────────────────────────────────────────────────

const QUADRANT_COLOUR: Record<ReturnType<typeof menuQuadrant>, string> = {
  Star: OK,
  'Plough horse': ACCENT,
  Puzzle: ACCENT_MID,
  Dog: WARN,
};

/** Items whose right-hand label would run into a neighbour; these sit above the dot. */
const MENU_LABEL_ABOVE = new Set(['Chicken Caesar wrap']);

function MenuPointLabel(props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: unknown;
}) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const w = Number(props.width ?? 0);
  const h = Number(props.height ?? 0);
  const label = String(props.value ?? '');
  const above = MENU_LABEL_ABOVE.has(label);
  return (
    <text
      x={above ? x + w / 2 : x + w + 6}
      y={above ? y - 6 : y + h / 2}
      dy={above ? 0 : 4}
      textAnchor={above ? 'middle' : 'start'}
      style={{ fontSize: 10, fill: 'var(--color-text-primary)', fontFamily: 'var(--font-primary)' }}
    >
      {label}
    </text>
  );
}

export function MenuContributionChart() {
  const groups = (['Star', 'Plough horse', 'Puzzle', 'Dog'] as const).map((q) => ({
    quadrant: q,
    points: MENU_ITEMS.filter((m) => menuQuadrant(m) === q),
  }));
  const maxUnits = Math.max(...MENU_ITEMS.map((m) => m.units));
  const minGp = Math.min(...MENU_ITEMS.map((m) => m.gpPct));
  const maxGp = Math.max(...MENU_ITEMS.map((m) => m.gpPct));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 24, bottom: 20, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis
          type="number"
          dataKey="units"
          name="Units sold"
          tick={TICK}
          tickLine={false}
          axisLine={false}
          domain={[0, Math.ceil(maxUnits / 1000) * 1000 + 1000]}
          tickFormatter={(v) => `${Number(v) / 1000}k`}
          label={{ value: 'Units sold this week (POS)', position: 'insideBottom', offset: -10, fontSize: 11, fill: 'var(--color-text-muted)' }}
        />
        <YAxis
          type="number"
          dataKey="gpPct"
          name="GP %"
          unit="%"
          tick={TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          domain={[Math.floor(minGp) - 2, Math.ceil(maxGp) + 2]}
        />
        <ZAxis type="number" dataKey="gpValue" range={[60, 420]} name="GP £" />
        <ReferenceLine
          x={MENU_MEDIAN_UNITS}
          stroke={ACCENT_MID}
          strokeDasharray="4 3"
          label={{ value: 'median volume', position: 'insideTopLeft', fontSize: 10, fill: 'var(--color-text-muted)' }}
        />
        <ReferenceLine
          y={MENU_MEDIAN_GP}
          stroke={ACCENT_MID}
          strokeDasharray="4 3"
          label={{ value: 'median GP', position: 'insideBottomRight', fontSize: 10, fill: 'var(--color-text-muted)' }}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as MenuItemPoint | undefined;
            if (!p) return null;
            return (
              <Tip
                title={`${p.item} · ${menuQuadrant(p)}`}
                rows={[
                  ['Units sold', p.units.toLocaleString('en-GB')],
                  ['GP %', `${p.gpPct}%`],
                  ['GP £ this week', gbp(p.gpValue)],
                ]}
              />
            );
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          iconType="circle"
          verticalAlign="top"
          itemSorter={legendOrder(groups.map((g) => `${g.quadrant}s`))}
        />
        {groups.map((g) => (
          <Scatter key={g.quadrant} name={`${g.quadrant}s`} data={g.points} fill={QUADRANT_COLOUR[g.quadrant]} fillOpacity={0.8}>
            <LabelList dataKey="item" content={MenuPointLabel} />
          </Scatter>
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

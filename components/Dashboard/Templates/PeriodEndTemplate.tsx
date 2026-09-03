'use client';

/**
 * Period end template — "What happened to GP, and why?"
 *
 * Finance / ops directors; the report that goes in the board pack.
 * Remit is revenue → gross profit only. No labour, no EBITDA — named in
 * the guidance line so the P&L question dies before it's asked.
 *
 * The GP bridge is the honest launch version: theoretical GP → logged
 * waste → unexplained → actual GP. Two measured ends, one measured cause,
 * one honest bucket. Price variance and sales-mix steps are added later,
 * behind their data dependencies; yield never gets a named step — it lives
 * inside unexplained and the drill-down investigates it.
 */

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Lock, Star, ArrowDownRight } from 'lucide-react';
import {
  BUDGET_DEPENDENCY,
  ESPRESSO_PERIOD,
  SUPPLIER_INFLATION_DEPENDENCY,
  type BridgeDrillItem,
  type PeriodData,
} from './templateData';
import TileActions from '@/components/ScheduledReports/TileActions';
import { TemplateIntro } from './DailyTemplate';
import {
  DependencyBadge,
  FigureBadge,
  FlagText,
  FULL,
  GHOST,
  Grid,
  HALF,
  MID,
  NAVY,
  OK,
  OK_TEXT,
  TD,
  TH,
  TileCard,
  VALUE_INK,
  WARN,
  WARN_TEXT,
  tipStyle,
} from './templateParts';

const PERIOD_INSIGHTS = [
  'GP bridge · theoretical to actual',
  'Data confidence',
  'COGS variance · site × category',
  'Menu profitability · margin vs volume',
  'Stock holding · value and days of cover',
  'Dead and slow-moving stock',
  'Supplier inflation impact',
  'CPU transfer reconciliation',
  'Trend · four periods',
];

function periodActions(insightTitle: string, data: PeriodData) {
  const siblings = data.cpuTransfers ? PERIOD_INSIGHTS : PERIOD_INSIGHTS.filter((t) => !t.startsWith('CPU'));
  return (
    <TileActions
      insightTitle={insightTitle}
      siteLabel={data.scopeLabel}
      siblingInsights={siblings}
      dataWindowLabel="Last complete period as of send date"
    />
  );
}

/** Unexplained once price movement is measured out of the bucket. */
function unexplainedLiveK(data: PeriodData): number {
  return data.gpBridge.unexplained - data.priceVarianceK;
}

/** A £k axis window that keeps the bridge's drop legible whatever the estate's size. */
function bridgeDomain(data: PeriodData): [number, number] {
  const { theoreticalGp, actualGp } = data.gpBridge;
  const span = theoreticalGp - actualGp;
  const step = span >= 100 ? 50 : span >= 20 ? 10 : 5;
  const low = Math.floor((actualGp - span * 0.6) / step) * step;
  const high = Math.ceil((theoreticalGp + span * 0.3) / step) * step;
  return [Math.max(0, low), high];
}

// ─── GP bridge (waterfall) ────────────────────────────────────────────────────

type BridgeStepKey = 'theoretical' | 'price' | 'waste' | 'unexplained' | 'actual';

type BridgeStep = {
  key: BridgeStepKey;
  label: string;
  /** Invisible stacked base that floats the visible bar. */
  base: number;
  value: number;
  kind: 'total' | 'down';
};

/**
 * Bridge steps. With line-level invoice prices live, "upgrade one" applies:
 * a measured price-variance step joins the bridge and the unexplained bucket
 * shrinks by exactly that amount — the ends of the bridge don't move.
 */
function bridgeSteps(data: PeriodData, invoiceMatchingLive: boolean): BridgeStep[] {
  const bridge = data.gpBridge;
  if (!invoiceMatchingLive) {
    return [
      { key: 'theoretical', label: 'Theoretical GP', base: 0, value: bridge.theoreticalGp, kind: 'total' },
      { key: 'waste', label: 'Logged waste', base: bridge.theoreticalGp - bridge.waste, value: bridge.waste, kind: 'down' },
      { key: 'unexplained', label: 'Unexplained', base: bridge.actualGp, value: bridge.unexplained, kind: 'down' },
      { key: 'actual', label: 'Actual GP', base: 0, value: bridge.actualGp, kind: 'total' },
    ];
  }
  const afterPrice = bridge.theoreticalGp - data.priceVarianceK;
  const afterWaste = afterPrice - bridge.waste;
  return [
    { key: 'theoretical', label: 'Theoretical GP', base: 0, value: bridge.theoreticalGp, kind: 'total' },
    { key: 'price', label: 'Price variance', base: afterPrice, value: data.priceVarianceK, kind: 'down' },
    { key: 'waste', label: 'Logged waste', base: afterWaste, value: bridge.waste, kind: 'down' },
    { key: 'unexplained', label: 'Unexplained', base: bridge.actualGp, value: unexplainedLiveK(data), kind: 'down' },
    { key: 'actual', label: 'Actual GP', base: 0, value: bridge.actualGp, kind: 'total' },
  ];
}

const BRIDGE_COLOR: Record<BridgeStepKey, string> = {
  theoretical: MID,
  price: VALUE_INK,
  waste: WARN,
  unexplained: '#B45309',
  actual: NAVY,
};

const DRILL_TITLES: Record<BridgeStepKey, string> = {
  theoretical: 'Theoretical GP by category',
  price: 'Price variance by supplier',
  waste: 'Logged waste by category',
  unexplained: 'Unexplained — usage vs sales mismatch by item',
  actual: 'Actual GP build-up (stock movement)',
};

function drillItemsFor(data: PeriodData, key: BridgeStepKey, invoiceMatchingLive: boolean): BridgeDrillItem[] {
  if (key === 'price') return data.bridgeDrillPrice;
  if (key === 'unexplained' && invoiceMatchingLive) return data.bridgeDrillUnexplainedLive;
  return data.bridgeDrill[key];
}

function BridgeDrill({ stepKey, items }: { stepKey: BridgeStepKey; items: BridgeDrillItem[] }) {
  return (
    <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--color-border-subtle)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
        {DRILL_TITLES[stepKey]}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((row) => (
          <div key={row.item} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 12.5 }}>
            <span style={{ flex: '0 0 180px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{row.item}</span>
            <span style={{ fontWeight: 700, color: VALUE_INK, whiteSpace: 'nowrap' }}>£{row.value.toFixed(1)}k</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 11.5, minWidth: 0 }}>{row.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GpBridgeTile({ data, invoiceMatchingLive }: { data: PeriodData; invoiceMatchingLive: boolean }) {
  const [drill, setDrill] = useState<BridgeStepKey | null>('unexplained');
  const steps = bridgeSteps(data, invoiceMatchingLive);
  const bridge = data.gpBridge;
  // The price step only exists while invoice matching is live — if the flag
  // flips off with that drill open, fall back to no drill rather than
  // rendering a drill for a bar that isn't on the chart.
  const activeDrill = !invoiceMatchingLive && drill === 'price' ? null : drill;

  return (
    <TileCard
      title="GP bridge · theoretical to actual"
      badge={<FigureBadge kind="measured" />}
      actions={periodActions('GP bridge · theoretical to actual', data)}>
      <div style={{ padding: '0 12px', width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={steps} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(0, 28, 53,0.08)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: 'rgba(0, 28, 53,0.15)' }} />
            <YAxis
              domain={bridgeDomain(data)}
              allowDataOverflow
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `£${v}k`}
              width={52}
            />
            <Tooltip
              contentStyle={tipStyle}
              formatter={(value, name) => (name === 'base' ? [null, null] : [`£${Number(value ?? 0).toFixed(1)}k`, undefined])}
            />
            <Bar dataKey="base" stackId="bridge" fill="transparent" isAnimationActive={false} />
            <Bar
              dataKey="value"
              stackId="bridge"
              radius={[4, 4, 0, 0]}
              maxBarSize={92}
              cursor="pointer"
              onClick={(entry) => {
                // recharts passes the datum either directly or under `payload`
                // depending on version — read both.
                const raw = entry as unknown as BridgeStep & { payload?: BridgeStep };
                const step = raw.payload?.key ?? raw.key;
                if (!step) return;
                setDrill((prev) => (prev === step ? null : step));
              }}
            >
              {steps.map((s) => (
                <Cell
                  key={s.key}
                  fill={BRIDGE_COLOR[s.key]}
                  stroke={activeDrill === s.key ? VALUE_INK : undefined}
                  strokeWidth={activeDrill === s.key ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ padding: '4px 16px 10px', display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
        <LegendSwatch color={MID} label="Theoretical (measured from POS + recipes)" />
        {invoiceMatchingLive && (
          <LegendSwatch color={VALUE_INK} label={`Price variance −£${data.priceVarianceK.toFixed(1)}k (measured from matched invoices)`} />
        )}
        <LegendSwatch color={WARN} label={`Logged waste −£${bridge.waste.toFixed(1)}k (measured)`} />
        <LegendSwatch
          color="#B45309"
          label={`Unexplained −£${(invoiceMatchingLive ? unexplainedLiveK(data) : bridge.unexplained).toFixed(1)}k (honest bucket)`}
        />
        <LegendSwatch color={NAVY} label="Actual (measured from stocktakes)" />
      </div>
      {activeDrill && <BridgeDrill stepKey={activeDrill} items={drillItemsFor(data, activeDrill, invoiceMatchingLive)} />}
    </TileCard>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

// ─── Main template ────────────────────────────────────────────────────────────

export default function PeriodEndTemplate({
  invoiceMatchingLive = false,
  data = ESPRESSO_PERIOD,
}: {
  /**
   * Line-level invoice prices + point-in-time WAC captured — unlocks the
   * supplier inflation tile and the bridge's price-variance step together.
   */
  invoiceMatchingLive?: boolean;
  data?: PeriodData;
}) {
  const {
    dataConfidence,
    cogsVariance,
    menuProfitability,
    stockHolding,
    deadStock,
    cpuTransfers,
    supplierInflation,
    periodTrend,
    copy,
    siteNoun,
    unitNoun,
  } = data;
  const sitePlural = siteNoun.toLowerCase() + 's';
  const supplierPriceEffectK = supplierInflation.reduce((s, r) => s + r.priceEffectK, 0);
  const gpValues = periodTrend.map((p) => p.gpPct);
  const trendGpDomain: [number, number] = [Math.floor(Math.min(...gpValues) - 3), Math.ceil(Math.max(...gpValues) + 3)];
  const smallMax = Math.max(...periodTrend.flatMap((p) => [p.wastePct, p.unexplainedPct]));
  const trendSmallDomain: [number, number] = [0, Math.max(4, Math.ceil(smallMax + 1))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      <TemplateIntro title={`${data.scopeTitle} · ${data.periodLabel}`} />

      <Grid>
        {/* Hero: GP bridge */}
        <div style={FULL}>
          <GpBridgeTile data={data} invoiceMatchingLive={invoiceMatchingLive} />
        </div>

        {/* Data confidence panel */}
        <div style={HALF}>
          <TileCard
            title="Data confidence"
            actions={periodActions('Data confidence', data)}>
            <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <ConfidenceRow
                label="Stocktake completion"
                value={`${dataConfidence.stocktakesDone} of ${dataConfidence.stocktakesDue} ${sitePlural}`}
                good={dataConfidence.stocktakesDone === dataConfidence.stocktakesDue}
                detail={`${dataConfidence.stocktakeMissingSite} estimated from theoretical usage — its actual GP carries that caveat`}
              />
              <ConfidenceRow
                label="POS sales recipe-mapped"
                value={`${dataConfidence.posMappedPct}%`}
                good={dataConfidence.posMappedPct >= 95}
                detail="unmapped items are excluded from theoretical GP, not guessed"
              />
              <ConfidenceRow
                label="Invoices matched"
                value={`${dataConfidence.invoicesMatchedPct}%`}
                good={dataConfidence.invoicesMatchedPct >= 95}
                detail="unmatched spend sits in purchases at invoice value"
              />
              <ConfidenceRow
                label="Stocktake adjustment size"
                value={`${dataConfidence.stocktakeAdjustmentPctOfCogs.toFixed(1)}% of COGS`}
                good={dataConfidence.stocktakeAdjustmentPctOfCogs <= 1}
                detail="small adjustments mean counts and the book are close"
              />
            </div>
          </TileCard>
        </div>

        {/* COGS variance by site & category */}
        <div style={HALF}>
          <TileCard
            title="COGS variance · site × category"
            actions={periodActions('COGS variance · site × category', data)}
            footer="Diagnostic order: mapping gaps → count errors → un-logged waste → price movement → yield. Work the list, not the hunch."
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: 'left' }}>{siteNoun}</th>
                  <th style={{ ...TH, textAlign: 'left' }}>Category</th>
                  <th style={TH}>Theoretical</th>
                  <th style={TH}>Actual</th>
                  <th style={TH}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {[...cogsVariance]
                  .sort((a, b) => (b.actualK - b.theoreticalK) - (a.actualK - a.theoreticalK))
                  .map((r) => {
                    const varK = r.actualK - r.theoreticalK;
                    const over = varK > 0;
                    return (
                      <tr key={`${r.site}-${r.category}`}>
                        <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>{r.site}</td>
                        <td style={{ ...TD, textAlign: 'left' }}>{r.category}</td>
                        <td style={TD}>£{r.theoreticalK.toFixed(1)}k</td>
                        <td style={{ ...TD, fontWeight: 600 }}>£{r.actualK.toFixed(1)}k</td>
                        <td style={TD}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: over ? WARN_TEXT : OK_TEXT }}>
                            {over && <ArrowDownRight size={11} strokeWidth={2.6} />}
                            {over ? '+' : '−'}£{Math.abs(varK).toFixed(1)}k
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </TileCard>
        </div>

        {/* Menu profitability */}
        <div style={FULL}>
          <TileCard
            title="Menu profitability · margin vs volume"
            badge={<FigureBadge kind="theoretical" />}
            actions={periodActions('Menu profitability · margin vs volume', data)}>
            <div style={{ padding: '0 12px 12px', width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 12, right: 20, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(0, 28, 53,0.08)" />
                  <XAxis
                    type="number"
                    dataKey="units"
                    name="Units sold"
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(0, 28, 53,0.15)' }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    label={{ value: `${unitNoun} sold this period`, position: 'insideBottom', offset: -2, fontSize: 11, fill: 'var(--color-text-muted)' }}
                  />
                  <YAxis
                    type="number"
                    dataKey="marginPct"
                    name="Margin"
                    domain={[25, 90]}
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}%`}
                    width={44}
                  />
                  <ZAxis range={[70, 71]} />
                  <Tooltip
                    contentStyle={tipStyle}
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(value, name) =>
                      name === 'Units sold'
                        ? [`${Number(value ?? 0).toLocaleString('en-GB')}`, unitNoun]
                        : [`${value}%`, 'Theoretical margin']
                    }
                    labelFormatter={() => ''}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    content={({ payload }: any) => {
                      const p = payload?.[0]?.payload;
                      if (!p) return null;
                      return (
                        <div style={{ ...tipStyle, padding: '8px 10px' }}>
                          <div style={{ fontWeight: 700 }}>{p.item}</div>
                          <div>{p.marginPct}% margin · {p.units.toLocaleString('en-GB')} {unitNoun.toLowerCase()}</div>
                          {p.flag === 'star' && <div style={{ color: OK_TEXT, fontWeight: 700 }}>Star</div>}
                          {p.flag === 'delist' && <div style={{ color: WARN_TEXT, fontWeight: 700 }}>Delist candidate</div>}
                        </div>
                      );
                    }}
                  />
                  <Scatter data={menuProfitability} name="Menu items">
                    {menuProfitability.map((m) => (
                      <Cell
                        key={m.item}
                        fill={m.flag === 'star' ? OK : m.flag === 'delist' ? WARN : MID}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div style={{ padding: '0 16px 12px', display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Star size={11} color={OK_TEXT} strokeWidth={2.6} /> Stars: {menuProfitability.filter((m) => m.flag === 'star').map((m) => m.item).join(', ')}
              </span>
              <span style={{ fontWeight: 600, color: WARN_TEXT }}>
                Delist candidates: {menuProfitability.filter((m) => m.flag === 'delist').map((m) => m.item).join(', ')}
              </span>
            </div>
          </TileCard>
        </div>

        {/* Stock holding */}
        <div style={HALF}>
          <TileCard
            title="Stock holding · value and days of cover"
            actions={periodActions('Stock holding · value and days of cover', data)}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: 'left' }}>{siteNoun}</th>
                  <th style={TH}>Value</th>
                  <th style={TH}>Days of cover</th>
                </tr>
              </thead>
              <tbody>
                {stockHolding.map((s) => (
                  <tr key={s.site}>
                    <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>
                      {s.site}
                      {s.site === dataConfidence.stocktakeMissingSite && (
                        <span style={{ marginLeft: 8 }}><FlagText text="estimated" /></span>
                      )}
                    </td>
                    <td style={{ ...TD, fontWeight: 600 }}>£{s.valueK.toFixed(1)}k</td>
                    <td style={{ ...TD, fontWeight: 700, color: s.daysCover > 10 ? WARN_TEXT : 'var(--color-text-primary)' }}>
                      {s.daysCover.toFixed(1)}{s.daysCover > 10 ? ' · high' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TileCard>
        </div>

        {/* Dead & slow-moving stock */}
        <div style={HALF}>
          <TileCard
            title="Dead and slow-moving stock"
            actions={periodActions('Dead and slow-moving stock', data)}
            footer={copy.deadStockFooter}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: 'left' }}>Item</th>
                  <th style={{ ...TH, textAlign: 'left' }}>{siteNoun}</th>
                  <th style={TH}>Value</th>
                  <th style={TH}>Last used</th>
                </tr>
              </thead>
              <tbody>
                {deadStock.map((r) => (
                  <tr key={r.item}>
                    <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>{r.item}</td>
                    <td style={{ ...TD, textAlign: 'left' }}>{r.site}</td>
                    <td style={{ ...TD, fontWeight: 600 }}>£{r.value}</td>
                    <td style={{ ...TD, color: 'var(--color-text-secondary)' }}>{r.lastUsed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TileCard>
        </div>

        {/* Supplier inflation — live with invoice matching, locked without */}
        <div style={HALF}>
          {invoiceMatchingLive ? (
            <TileCard
              title="Supplier inflation impact"
              badge={<FigureBadge kind="measured" />}
              actions={periodActions('Supplier inflation impact', data)}
              footer={`Total price effect £${supplierPriceEffectK.toFixed(1)}k this period — the same figure the GP bridge deducts. ${copy.supplierFooter}`}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, textAlign: 'left' }}>Supplier</th>
                    <th style={TH}>Spend</th>
                    <th style={TH}>Price effect</th>
                    <th style={TH}>Volume / mix</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierInflation.map((r) => (
                    <tr key={r.supplier}>
                      <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>{r.supplier}</td>
                      <td style={{ ...TD, fontWeight: 600 }}>£{r.spendK.toFixed(1)}k</td>
                      <td style={{ ...TD, fontWeight: 700, color: r.priceEffectK > 0 ? WARN_TEXT : OK_TEXT }}>
                        {r.priceEffectK > 0 ? '+' : '−'}£{Math.abs(r.priceEffectK).toFixed(1)}k
                      </td>
                      <td style={{ ...TD, color: 'var(--color-text-secondary)' }}>
                        {r.volumeMixK >= 0 ? '+' : '−'}£{Math.abs(r.volumeMixK).toFixed(1)}k
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TileCard>
          ) : (
            <TileCard
              title="Supplier inflation impact"
              badge={<DependencyBadge needs={SUPPLIER_INFLATION_DEPENDENCY} />}>
              <div
                style={{
                  margin: '0 16px 14px',
                  padding: '22px 16px',
                  borderRadius: 10,
                  border: '1px dashed var(--color-border-subtle)',
                  background: '#FBFBFD',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'center',
                  flex: 1,
                  justifyContent: 'center',
                }}
              >
                <Lock size={18} color="var(--color-text-muted)" strokeWidth={2} />
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Ships together with the bridge&rsquo;s price-variance step
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', maxWidth: 320, lineHeight: 1.5 }}>
                  Both need line-level invoice prices and point-in-time WAC confirmed queryable.
                  One dependency, two tiles — they land in the same release.
                </div>
              </div>
            </TileCard>
          )}
        </div>

        {/* CPU transfer reconciliation. Brands without a central kitchen have no routes, so no tile. */}
        {cpuTransfers && (
        <div style={HALF}>
          <TileCard
            title="CPU transfer reconciliation"
            actions={periodActions('CPU transfer reconciliation', data)}
            footer={copy.cpuFooter}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: 'left' }}>Route</th>
                  <th style={TH}>Sent</th>
                  <th style={TH}>Received</th>
                  <th style={TH}>Gap</th>
                </tr>
              </thead>
              <tbody>
                {cpuTransfers.map((t) => {
                  const gap = t.sentK - t.receivedK;
                  const balanced = Math.abs(gap) < 0.05;
                  return (
                    <tr key={t.route}>
                      <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>{t.route}</td>
                      <td style={TD}>£{t.sentK.toFixed(1)}k</td>
                      <td style={TD}>£{t.receivedK.toFixed(1)}k</td>
                      <td style={TD}>
                        {balanced ? (
                          <span style={{ fontWeight: 700, color: OK_TEXT }}>Nets out</span>
                        ) : (
                          <FlagText text={`£${(gap * 1000).toFixed(0)} unbooked`} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TileCard>
        </div>
        )}

        {/* Period-on-period trend */}
        <div style={HALF}>
          <TileCard
            title="Trend · four periods"
            actions={periodActions('Trend · four periods', data)}>
            <div style={{ padding: '0 12px 12px', width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={periodTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(0, 28, 53,0.08)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: 'rgba(0, 28, 53,0.15)' }} />
                  <YAxis yAxisId="gp" domain={trendGpDomain} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={42} />
                  <YAxis yAxisId="small" orientation="right" domain={trendSmallDomain} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={36} />
                  <Tooltip contentStyle={tipStyle} formatter={(v) => `${Number(v ?? 0).toFixed(1)}%`} />
                  <Line yAxisId="gp" dataKey="gpPct" name="Actual GP %" stroke={NAVY} strokeWidth={2.4} dot={{ r: 3 }} />
                  <Line yAxisId="small" dataKey="wastePct" name="Waste % of sales" stroke={OK} strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="small" dataKey="unexplainedPct" name="Unexplained % of sales" stroke={WARN} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div style={{ padding: '0 16px 12px', display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
              <LegendSwatch color={NAVY} label="Actual GP % (left)" />
              <LegendSwatch color={OK} label="Waste % of sales (right)" />
              <LegendSwatch color={WARN} label={`Unexplained % of sales (right) — ${copy.trendNote}`} />
            </div>
          </TileCard>
        </div>

        {/* Budget vs actual — reserved slot */}
        <div style={HALF}>
          <TileCard
            title="Budget vs actual"
            badge={<DependencyBadge needs={BUDGET_DEPENDENCY} />}>
            <div
              style={{
                margin: '0 16px 14px',
                padding: '22px 16px',
                borderRadius: 10,
                border: `1px dashed ${GHOST}`,
                background: 'repeating-linear-gradient(-45deg, #FBFBFD, #FBFBFD 8px, #F4F5F8 8px, #F4F5F8 16px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                textAlign: 'center',
                flex: 1,
                justifyContent: 'center',
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Waiting on the budget CSV importer
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', maxWidth: 320, lineHeight: 1.5 }}>
                When budgets ship, this tile fills in and the weekly spend tiles gain a &ldquo;vs plan&rdquo;
                comparator. Nothing else on this page changes.
              </div>
            </div>
          </TileCard>
        </div>
      </Grid>
    </div>
  );
}

function ConfidenceRow({
  label,
  value,
  good,
  detail,
}: {
  label: string;
  value: string;
  good: boolean;
  detail: string;
}) {
  return (
    <div
      style={{
        padding: '9px 12px',
        borderRadius: 10,
        border: '1px solid var(--color-border-subtle)',
        background: '#FBFBFD',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)', flex: 1, minWidth: 0 }}>
          {label}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: good ? OK_TEXT : WARN_TEXT }}>{value}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: good ? OK_TEXT : WARN_TEXT }}>{good ? 'OK' : 'Caveat'}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.45 }}>{detail}</div>
    </div>
  );
}

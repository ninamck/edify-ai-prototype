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
  BRIDGE_DRILL,
  BRIDGE_DRILL_PRICE,
  BRIDGE_DRILL_UNEXPLAINED_LIVE,
  BUDGET_DEPENDENCY,
  COGS_VARIANCE,
  CPU_TRANSFERS,
  DATA_CONFIDENCE,
  DEAD_STOCK,
  DEAD_STOCK_TOTAL,
  GP_BRIDGE,
  GP_BRIDGE_PRICE_VARIANCE_K,
  GP_BRIDGE_UNEXPLAINED_LIVE_K,
  MENU_PROFITABILITY,
  PERIOD_LABEL,
  PERIOD_TREND,
  STOCK_HOLDING,
  SUPPLIER_INFLATION,
  SUPPLIER_INFLATION_DEPENDENCY,
  SUPPLIER_PRICE_EFFECT_TOTAL_K,
  type BridgeDrillItem,
} from './templateData';
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
function bridgeSteps(invoiceMatchingLive: boolean): BridgeStep[] {
  if (!invoiceMatchingLive) {
    return [
      { key: 'theoretical', label: 'Theoretical GP', base: 0, value: GP_BRIDGE.theoreticalGp, kind: 'total' },
      { key: 'waste', label: 'Logged waste', base: GP_BRIDGE.theoreticalGp - GP_BRIDGE.waste, value: GP_BRIDGE.waste, kind: 'down' },
      { key: 'unexplained', label: 'Unexplained', base: GP_BRIDGE.actualGp, value: GP_BRIDGE.unexplained, kind: 'down' },
      { key: 'actual', label: 'Actual GP', base: 0, value: GP_BRIDGE.actualGp, kind: 'total' },
    ];
  }
  const afterPrice = GP_BRIDGE.theoreticalGp - GP_BRIDGE_PRICE_VARIANCE_K;
  const afterWaste = afterPrice - GP_BRIDGE.waste;
  return [
    { key: 'theoretical', label: 'Theoretical GP', base: 0, value: GP_BRIDGE.theoreticalGp, kind: 'total' },
    { key: 'price', label: 'Price variance', base: afterPrice, value: GP_BRIDGE_PRICE_VARIANCE_K, kind: 'down' },
    { key: 'waste', label: 'Logged waste', base: afterWaste, value: GP_BRIDGE.waste, kind: 'down' },
    { key: 'unexplained', label: 'Unexplained', base: GP_BRIDGE.actualGp, value: GP_BRIDGE_UNEXPLAINED_LIVE_K, kind: 'down' },
    { key: 'actual', label: 'Actual GP', base: 0, value: GP_BRIDGE.actualGp, kind: 'total' },
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

function drillItemsFor(key: BridgeStepKey, invoiceMatchingLive: boolean): BridgeDrillItem[] {
  if (key === 'price') return BRIDGE_DRILL_PRICE;
  if (key === 'unexplained' && invoiceMatchingLive) return BRIDGE_DRILL_UNEXPLAINED_LIVE;
  return BRIDGE_DRILL[key];
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

function GpBridgeTile({ invoiceMatchingLive }: { invoiceMatchingLive: boolean }) {
  const [drill, setDrill] = useState<BridgeStepKey | null>('unexplained');
  const steps = bridgeSteps(invoiceMatchingLive);
  // The price step only exists while invoice matching is live — if the flag
  // flips off with that drill open, fall back to no drill rather than
  // rendering a drill for a bar that isn't on the chart.
  const activeDrill = !invoiceMatchingLive && drill === 'price' ? null : drill;

  return (
    <TileCard
      title="GP bridge · theoretical to actual"
      badge={<FigureBadge kind="measured" />}>
      <div style={{ padding: '0 12px', width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={steps} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(0, 28, 53,0.08)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: 'rgba(0, 28, 53,0.15)' }} />
            <YAxis
              domain={[380, 420]}
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
          <LegendSwatch color={VALUE_INK} label={`Price variance −£${GP_BRIDGE_PRICE_VARIANCE_K.toFixed(1)}k (measured from matched invoices)`} />
        )}
        <LegendSwatch color={WARN} label={`Logged waste −£${GP_BRIDGE.waste.toFixed(1)}k (measured)`} />
        <LegendSwatch
          color="#B45309"
          label={`Unexplained −£${(invoiceMatchingLive ? GP_BRIDGE_UNEXPLAINED_LIVE_K : GP_BRIDGE.unexplained).toFixed(1)}k (honest bucket)`}
        />
        <LegendSwatch color={NAVY} label="Actual (measured from stocktakes)" />
      </div>
      {activeDrill && <BridgeDrill stepKey={activeDrill} items={drillItemsFor(activeDrill, invoiceMatchingLive)} />}
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
}: {
  /**
   * Line-level invoice prices + point-in-time WAC captured — unlocks the
   * supplier inflation tile and the bridge's price-variance step together.
   */
  invoiceMatchingLive?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      <TemplateIntro title={`Estate · ${PERIOD_LABEL}`} />

      <Grid>
        {/* Hero: GP bridge */}
        <div style={FULL}>
          <GpBridgeTile invoiceMatchingLive={invoiceMatchingLive} />
        </div>

        {/* Data confidence panel */}
        <div style={HALF}>
          <TileCard
            title="Data confidence">
            <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <ConfidenceRow
                label="Stocktake completion"
                value={`${DATA_CONFIDENCE.stocktakesDone} of ${DATA_CONFIDENCE.stocktakesDue} sites`}
                good={DATA_CONFIDENCE.stocktakesDone === DATA_CONFIDENCE.stocktakesDue}
                detail={`${DATA_CONFIDENCE.stocktakeMissingSite} estimated from theoretical usage — its actual GP carries that caveat`}
              />
              <ConfidenceRow
                label="POS sales recipe-mapped"
                value={`${DATA_CONFIDENCE.posMappedPct}%`}
                good={DATA_CONFIDENCE.posMappedPct >= 95}
                detail="unmapped items are excluded from theoretical GP, not guessed"
              />
              <ConfidenceRow
                label="Invoices matched"
                value={`${DATA_CONFIDENCE.invoicesMatchedPct}%`}
                good={DATA_CONFIDENCE.invoicesMatchedPct >= 95}
                detail="unmatched spend sits in purchases at invoice value"
              />
              <ConfidenceRow
                label="Stocktake adjustment size"
                value={`${DATA_CONFIDENCE.stocktakeAdjustmentPctOfCogs.toFixed(1)}% of COGS`}
                good={DATA_CONFIDENCE.stocktakeAdjustmentPctOfCogs <= 1}
                detail="small adjustments mean counts and the book are close"
              />
            </div>
          </TileCard>
        </div>

        {/* COGS variance by site & category */}
        <div style={HALF}>
          <TileCard
            title="COGS variance · site × category"
            footer="Diagnostic order: mapping gaps → count errors → un-logged waste → price movement → yield. Work the list, not the hunch."
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: 'left' }}>Site</th>
                  <th style={{ ...TH, textAlign: 'left' }}>Category</th>
                  <th style={TH}>Theoretical</th>
                  <th style={TH}>Actual</th>
                  <th style={TH}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {[...COGS_VARIANCE]
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
            badge={<FigureBadge kind="theoretical" />}>
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
                    label={{ value: 'Units sold this period', position: 'insideBottom', offset: -2, fontSize: 11, fill: 'var(--color-text-muted)' }}
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
                        ? [`${Number(value ?? 0).toLocaleString('en-GB')}`, 'Units']
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
                          <div>{p.marginPct}% margin · {p.units.toLocaleString('en-GB')} units</div>
                          {p.flag === 'star' && <div style={{ color: OK_TEXT, fontWeight: 700 }}>Star</div>}
                          {p.flag === 'delist' && <div style={{ color: WARN_TEXT, fontWeight: 700 }}>Delist candidate</div>}
                        </div>
                      );
                    }}
                  />
                  <Scatter data={MENU_PROFITABILITY} name="Menu items">
                    {MENU_PROFITABILITY.map((m) => (
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
                <Star size={11} color={OK_TEXT} strokeWidth={2.6} /> Stars: {MENU_PROFITABILITY.filter((m) => m.flag === 'star').map((m) => m.item).join(', ')}
              </span>
              <span style={{ fontWeight: 600, color: WARN_TEXT }}>
                Delist candidates: {MENU_PROFITABILITY.filter((m) => m.flag === 'delist').map((m) => m.item).join(', ')}
              </span>
            </div>
          </TileCard>
        </div>

        {/* Stock holding */}
        <div style={HALF}>
          <TileCard
            title="Stock holding · value and days of cover">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: 'left' }}>Site</th>
                  <th style={TH}>Value</th>
                  <th style={TH}>Days of cover</th>
                </tr>
              </thead>
              <tbody>
                {STOCK_HOLDING.map((s) => (
                  <tr key={s.site}>
                    <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>
                      {s.site}
                      {s.site === DATA_CONFIDENCE.stocktakeMissingSite && (
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
            footer={`£${DEAD_STOCK_TOTAL} at risk. Seasonal lines dominate — transfer or promote before the value is written off.`}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: 'left' }}>Item</th>
                  <th style={{ ...TH, textAlign: 'left' }}>Site</th>
                  <th style={TH}>Value</th>
                  <th style={TH}>Last used</th>
                </tr>
              </thead>
              <tbody>
                {DEAD_STOCK.map((r) => (
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
              footer={`Total price effect £${SUPPLIER_PRICE_EFFECT_TOTAL_K.toFixed(1)}k this period — the same figure the GP bridge deducts. Brakes carries nearly half of it; La Boulangerie's tier discount is the only deflation.`}
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
                  {SUPPLIER_INFLATION.map((r) => (
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

        {/* CPU transfer reconciliation */}
        <div style={HALF}>
          <TileCard
            title="CPU transfer reconciliation"
            footer="Two routes don't reconcile: £0.8k left the CPU that Kings X and Shoreditch never booked in. Until receipted, that value inflates CPU costs and flatters those sites' GP."
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
                {CPU_TRANSFERS.map((t) => {
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

        {/* Period-on-period trend */}
        <div style={HALF}>
          <TileCard
            title="Trend · four periods">
            <div style={{ padding: '0 12px 12px', width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={PERIOD_TREND} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(0, 28, 53,0.08)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: 'rgba(0, 28, 53,0.15)' }} />
                  <YAxis yAxisId="gp" domain={[60, 70]} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={42} />
                  <YAxis yAxisId="small" orientation="right" domain={[0, 4]} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={36} />
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
              <LegendSwatch color={WARN} label="Unexplained % of sales (right) — down 1.1pp in three periods" />
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

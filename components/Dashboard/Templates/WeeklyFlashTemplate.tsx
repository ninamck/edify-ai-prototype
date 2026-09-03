'use client';

/**
 * Weekly flash template — "Which sites are drifting?"
 *
 * Ops / regional, Monday morning. League-table comparison, not depth.
 * Actual-vs-theoretical variance is only shown for sites with a completed
 * weekly stocktake; sites that didn't count are visibly flagged so
 * compliance is socially enforced. Top price movers ships as a designed
 * locked state until line-level invoice price capture is confirmed.
 *
 * When the CSV importer ships budgets, the two spend tiles gain a
 * "vs plan" comparator column — they are not replaced.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Lock } from 'lucide-react';
import { ESPRESSO_WEEKLY, PRICE_MOVERS_DEPENDENCY, type WeeklyData } from './templateData';
import TileActions from '@/components/ScheduledReports/TileActions';
import { TemplateIntro } from './DailyTemplate';
import {
  DeltaText,
  DependencyBadge,
  FigureBadge,
  FlagText,
  FULL,
  Grid,
  HALF,
  MID,
  NAVY,
  OK,
  OK_TEXT,
  TD,
  TH,
  TileCard,
  WARN,
  WARN_TEXT,
  tipStyle,
} from './templateParts';

const WEEKLY_INSIGHTS = [
  'Site league · sales and GP',
  'Waste as % of sales · by site',
  'Purchasing spend as % of sales · by site',
  'Spend vs trailing 4-week average',
  'Top 5 price movers',
  'Compliance strip',
];

function weeklyActions(insightTitle: string, scopeLabel: string) {
  return (
    <TileActions
      insightTitle={insightTitle}
      siteLabel={scopeLabel}
      siblingInsights={WEEKLY_INSIGHTS}
      dataWindowLabel="Last complete week as of send date"
    />
  );
}

/** Horizontal bar charts need a row of space per site; six sites fit in 230px, nineteen do not. */
function barChartHeight(rows: number): number {
  return Math.max(230, rows * 22 + 40);
}

/** Room for the longest site name on a horizontal bar chart's category axis. */
function labelWidth(names: string[]): number {
  const longest = names.reduce((n, s) => Math.max(n, s.length), 0);
  return Math.min(150, Math.max(82, longest * 6.4 + 12));
}

export default function WeeklyFlashTemplate({
  invoiceMatchingLive = false,
  data = ESPRESSO_WEEKLY,
}: {
  /** Line-level invoice prices captured — unlocks the price-movers tile. */
  invoiceMatchingLive?: boolean;
  data?: WeeklyData;
}) {
  const { sites, compliance, priceMovers, copy, scopeLabel, siteNoun } = data;
  const wasteBySite = [...sites].sort((a, b) => a.wastePctOfSales - b.wastePctOfSales);
  const spendBySite = [...sites].sort((a, b) => a.spendPctOfSales - b.spendPctOfSales);
  const barHeight = barChartHeight(sites.length);
  const axisWidth = labelWidth(sites.map((s) => s.site));
  const wasteMax = Math.max(3.2, Math.ceil(Math.max(...sites.map((s) => s.wastePctOfSales)) * 2) / 2 + 0.2);
  const spendMax = Math.max(36, Math.ceil(Math.max(...sites.map((s) => s.spendPctOfSales)) / 2) * 2 + 2);
  const scopePlural = siteNoun.toLowerCase() + 's';
  const manySites = sites.length > 8;
  const driftBySite = [...sites].sort((a, b) => b.spendVsTrailing4wkPct - a.spendVsTrailing4wkPct);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      <TemplateIntro title={`All ${scopePlural} · last week (${data.weekLabel})`} />

      <Grid>
        {/* 1+2 · Sales & GP league, with gated actual-vs-theoretical variance */}
        <div style={FULL}>
          <TileCard
            title="Site league · sales and GP"
            actions={weeklyActions('Site league · sales and GP', scopeLabel)}
            footer={copy.leagueFooter}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: 'left' }}>{siteNoun}</th>
                  <th style={TH}>Sales</th>
                  <th style={TH}>vs LW</th>
                  <th style={TH}>vs forecast</th>
                  <th style={TH}>Theoretical GP</th>
                  <th style={TH}>Actual GP</th>
                  <th style={TH}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s, i) => (
                  <tr key={s.site}>
                    <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>
                      <span style={{ color: 'var(--color-text-muted)', fontWeight: 700, marginRight: 8 }}>{i + 1}</span>
                      {s.site}
                    </td>
                    <td style={{ ...TD, fontWeight: 600 }}>£{Math.round(s.sales).toLocaleString('en-GB')}</td>
                    <td style={TD}><DeltaText pct={s.vsLwPct} /></td>
                    <td style={TD}><DeltaText pct={s.vsForecastPct} /></td>
                    <td style={TD}>{s.theoGpPct.toFixed(1)}%</td>
                    {s.stocktakeDone && s.actualGpPct !== null ? (
                      <>
                        <td style={{ ...TD, fontWeight: 600 }}>{s.actualGpPct.toFixed(1)}%</td>
                        <td style={TD}>
                          <DeltaText pct={s.actualGpPct - s.theoGpPct} suffix="pp" goodWhenDown={false} />
                        </td>
                      </>
                    ) : (
                      <td style={{ ...TD }} colSpan={2}>
                        <FlagText text="No stocktake — not computable" />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TileCard>
        </div>

        {/* 3 · Waste as % of sales by site */}
        <div style={HALF}>
          <TileCard
            title="Waste as % of sales · by site"
            actions={weeklyActions('Waste as % of sales · by site', scopeLabel)}>
            <div style={{ padding: '0 12px 12px', width: '100%', height: barHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wasteBySite} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(0, 28, 53,0.08)" horizontal={false} />
                  <XAxis type="number" domain={[0, wasteMax]} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="site" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={axisWidth} interval={0} />
                  <Tooltip contentStyle={tipStyle} formatter={(v) => `${Number(v ?? 0).toFixed(1)}% of sales`} />
                  <ReferenceLine x={1.5} stroke={NAVY} strokeDasharray="4 3" />
                  <Bar dataKey="wastePctOfSales" name="Waste % of sales" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {wasteBySite.map((s) => (
                      <Cell key={s.site} fill={s.wastePctOfSales <= 1.5 ? OK : WARN} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TileCard>
        </div>

        {/* 4 · Purchasing spend as % of sales */}
        <div style={HALF}>
          <TileCard
            title="Purchasing spend as % of sales · by site"
            actions={weeklyActions('Purchasing spend as % of sales · by site', scopeLabel)}
            footer="Gains a &ldquo;vs plan&rdquo; comparator when the budget CSV importer ships; the tile itself doesn't change."
          >
            <div style={{ padding: '0 12px 12px', width: '100%', height: barHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendBySite} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(0, 28, 53,0.08)" horizontal={false} />
                  <XAxis type="number" domain={[0, spendMax]} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="site" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={axisWidth} interval={0} />
                  <Tooltip contentStyle={tipStyle} formatter={(v) => `${Number(v ?? 0).toFixed(1)}% of sales`} />
                  <Bar dataKey="spendPctOfSales" name="Spend % of sales" fill={MID} radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TileCard>
        </div>

        {/* 5 · Spend vs trailing 4-week average */}
        <div style={HALF}>
          <TileCard
            title="Spend vs trailing 4-week average"
            actions={weeklyActions('Spend vs trailing 4-week average', scopeLabel)}
            footer={copy.driftFooter}
          >
            <div style={{ padding: '0 12px 12px', width: '100%', height: manySites ? barHeight : 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                {manySites ? (
                  // Nineteen names do not fit along the bottom of a column chart, so wide estates read as rows.
                  <BarChart data={driftBySite} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(0, 28, 53,0.08)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`} />
                    <YAxis type="category" dataKey="site" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={axisWidth} interval={0} />
                    <Tooltip contentStyle={tipStyle} formatter={(v) => `${Number(v ?? 0) >= 0 ? '+' : ''}${Number(v ?? 0).toFixed(1)}% vs own 4-wk avg`} />
                    <ReferenceLine x={0} stroke={NAVY} />
                    <Bar dataKey="spendVsTrailing4wkPct" name="vs trailing 4-wk avg" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {driftBySite.map((s) => (
                        <Cell key={s.site} fill={s.spendVsTrailing4wkPct > 4 ? WARN : OK} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={sites} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(0, 28, 53,0.08)" vertical={false} />
                    <XAxis dataKey="site" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={{ stroke: 'rgba(0, 28, 53,0.15)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`} width={44} />
                    <Tooltip contentStyle={tipStyle} formatter={(v) => `${Number(v ?? 0) >= 0 ? '+' : ''}${Number(v ?? 0).toFixed(1)}% vs own 4-wk avg`} />
                    <ReferenceLine y={0} stroke={NAVY} />
                    <Bar dataKey="spendVsTrailing4wkPct" name="vs trailing 4-wk avg" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {sites.map((s) => (
                        <Cell key={s.site} fill={s.spendVsTrailing4wkPct > 4 ? WARN : OK} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </TileCard>
        </div>

        {/* 6 · Top five price movers — live with invoice matching, locked without */}
        <div style={HALF}>
          {invoiceMatchingLive ? (
            <TileCard
              title="Top 5 price movers"
              badge={<FigureBadge kind="measured" />}
              actions={weeklyActions('Top 5 price movers', scopeLabel)}
              footer={copy.priceMoversFooter}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, textAlign: 'left' }}>Item</th>
                    <th style={{ ...TH, textAlign: 'left' }}>Supplier</th>
                    <th style={TH}>Price</th>
                    <th style={TH}>Change</th>
                    <th style={TH}>£ / week</th>
                  </tr>
                </thead>
                <tbody>
                  {priceMovers.map((m) => (
                    <tr key={m.item}>
                      <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>{m.item}</td>
                      <td style={{ ...TD, textAlign: 'left', color: 'var(--color-text-secondary)' }}>{m.supplier}</td>
                      <td style={{ ...TD, color: 'var(--color-text-secondary)' }}>
                        {m.oldPrice} → <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{m.newPrice}</span>
                      </td>
                      <td style={TD}><DeltaText pct={m.changePct} goodWhenDown /></td>
                      <td style={{ ...TD, fontWeight: 700, color: m.weeklyImpact > 0 ? WARN_TEXT : OK_TEXT }}>
                        {m.weeklyImpact > 0 ? '+' : '−'}£{Math.abs(m.weeklyImpact)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TileCard>
          ) : (
            <TileCard
              title="Top 5 price movers"
              badge={<DependencyBadge needs={PRICE_MOVERS_DEPENDENCY} />}>
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
                  Waiting on line-level invoice price capture
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', maxWidth: 320, lineHeight: 1.5 }}>
                  This tile ships once line-level prices are confirmed queryable. Until then it stays locked —
                  an approximated version would just be wrong in a way nobody could see.
                </div>
              </div>
            </TileCard>
          )}
        </div>

        {/* 7 · Compliance strip */}
        <div style={FULL}>
          <TileCard
            title="Compliance strip"
            actions={weeklyActions('Compliance strip', scopeLabel)}>
            <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <ComplianceStat
                label="Invoices matched"
                value={`${compliance.invoicesMatchedPct}%`}
                good={compliance.invoicesMatchedPct >= 90}
                detail="of last week's invoices matched to a PO or GRN"
              />
              <ComplianceStat
                label="Off-catalogue POs"
                value={`${compliance.offCataloguePos}`}
                good={compliance.offCataloguePos <= 3}
                detail="orders placed outside the agreed catalogue"
              />
              <ComplianceStat
                label="Stocktakes completed"
                value={`${compliance.stocktakesDone} of ${compliance.stocktakesDue}`}
                good={compliance.stocktakesDone === compliance.stocktakesDue}
                detail={copy.stocktakeDetail}
              />
              <ComplianceStat
                label="Waste-logging days"
                value={`${compliance.wasteLoggingDays} of ${compliance.wasteLoggingDaysDue}`}
                good={compliance.wasteLoggingDays >= compliance.wasteLoggingDaysDue - 2}
                detail={`${siteNoun.toLowerCase()}-days with at least one waste log`}
              />
            </div>
          </TileCard>
        </div>
      </Grid>
    </div>
  );
}

function ComplianceStat({
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
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid var(--color-border-subtle)',
        background: '#FBFBFD',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: good ? OK_TEXT : WARN_TEXT }}>{value}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: good ? OK_TEXT : WARN_TEXT }}>
          {good ? 'OK' : 'Attention'}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3, lineHeight: 1.45 }}>{detail}</div>
    </div>
  );
}

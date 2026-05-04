'use client';

/**
 * /production/sales-report — Sales vs Forecast retrospective.
 *
 * Sibling of /production/productivity. Where the live "Sales (live)" tab
 * shows the current day hour-by-hour, this page rolls actuals up across a
 * date range and tells you which recipes consistently outperform their
 * forecast and which are bleeding money on overproduction.
 *
 * Layout:
 *  1. Filter strip   — site + period (Today / Yesterday / Last 7 days)
 *  2. Quinn insight  — single-line headline naming the worst offender
 *  3. Aggregate KPIs — sold, forecast, variance %, accuracy score
 *  4. Daily trend    — sold vs forecast bars per day
 *  5. Forecast accuracy leaderboard — biggest absolute variances first
 *  6. Per-category roll-up
 *  7. Detail table   — sortable, filterable
 */

import { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  ShoppingBag,
  Target,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Lightbulb,
} from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import {
  DEMO_TODAY,
  dayOffset,
  type ProductionRecipe,
} from '@/components/Production/fixtures';
import { useProductionSite } from '@/components/Production/ProductionSiteContext';
import {
  siteSalesReport,
  formatSignedPct,
  formatVarianceUnits,
  type RecipeAccuracy,
  type CategoryRollup,
  type DaySummary,
  type SalesReport,
} from '@/components/Production/salesReport';

type RangeOpt = 'today' | 'yesterday' | 'last7';

export default function SalesReportPage() {
  // Site comes from the shared ProductionSiteContext — picker lives in
  // the production layout above the nav.
  const { siteId } = useProductionSite();
  const [range, setRange] = useState<RangeOpt>('last7');
  const [recipeFilter, setRecipeFilter] = useState<'all' | 'overshoot' | 'undershoot' | 'on-target' | 'mixed'>('all');
  const [recipeSort, setRecipeSort] = useState<{
    by: 'recipe' | 'category' | 'sold' | 'forecast' | 'variance' | 'pct';
    dir: 'asc' | 'desc';
  }>({ by: 'pct', dir: 'desc' });

  const dates = useMemo<string[]>(() => {
    if (range === 'today') return [DEMO_TODAY];
    if (range === 'yesterday') return [dayOffset(-1)];
    return Array.from({ length: 7 }, (_, i) => dayOffset(-i));
  }, [range]);

  const report = useMemo(() => siteSalesReport(siteId, dates), [siteId, dates]);

  const filteredRecipes = useMemo(() => {
    let base = report.recipes;
    if (recipeFilter !== 'all') {
      base = base.filter(r => r.tendency === recipeFilter);
    }
    const dir = recipeSort.dir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      switch (recipeSort.by) {
        case 'recipe': return dir * a.recipe.name.localeCompare(b.recipe.name);
        case 'category': return dir * a.category.localeCompare(b.category);
        case 'sold': return dir * (a.sold - b.sold);
        case 'forecast': return dir * (a.forecast - b.forecast);
        case 'variance': return dir * (a.variance - b.variance);
        case 'pct': return dir * (Math.abs(a.variancePct) - Math.abs(b.variancePct));
      }
    });
  }, [report.recipes, recipeFilter, recipeSort]);

  const headline = quinnHeadline(report);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ─── Filter strip — period only; site is fixed by the active persona */}
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          flexWrap: 'wrap',
        }}
      >
        <span style={LABEL_STYLE}>Period</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {([
            { id: 'today',     label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'last7',     label: 'Last 7 days' },
          ] as Array<{ id: RangeOpt; label: string }>).map(opt => (
            <button key={opt.id} onClick={() => setRange(opt.id)} style={pillStyle(opt.id === range)}>
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)' }}>
          {report.totalSold.toLocaleString()} sold ·{' '}
          {report.totalForecast.toLocaleString()} forecast ·{' '}
          {dates.length === 1 ? formatHumanDate(dates[0]) : `${dates.length} days`}
        </div>
      </div>

      {/* ─── Body ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 16px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Quinn headline */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-card)',
              border: `1px solid ${headline.borderColor}`,
              background: headline.bg,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <EdifyMark size={20} color={headline.iconColor} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{headline.title}</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {headline.body}
              </p>
            </div>
          </div>

          {/* KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <KPICard
              icon={<ShoppingBag size={16} />}
              label="Units sold"
              value={report.totalSold.toLocaleString()}
              sub={`vs ${report.totalForecast.toLocaleString()} forecast`}
            />
            <KPICard
              icon={deltaIcon(report.totalVariancePct)}
              label="Variance"
              value={formatSignedPct(report.totalVariancePct)}
              sub={`${formatVarianceUnits(report.totalVariance)} units`}
              tone={varianceTone(report.totalVariancePct, true)}
            />
            <KPICard
              icon={<Target size={16} />}
              label="Forecast accuracy"
              value={`${report.accuracyScore}%`}
              sub={accuracyVerdict(report.accuracyScore)}
              tone={accuracyTone(report.accuracyScore)}
            />
            <KPICard
              icon={<Activity size={16} />}
              label="Days · recipes"
              value={`${report.days.length} · ${report.recipes.length}`}
              sub={`${report.categories.length} categories`}
            />
          </div>

          {/* Daily trend */}
          {report.days.length > 1 && (
            <Section
              title="Daily trend"
              icon={<Activity size={16} />}
              badge={`${report.days.length} days`}
              subtitle="Each bar pair: sold vs forecast for the day."
            >
              <DailyTrend days={report.days} />
            </Section>
          )}

          {/* Recipe accuracy leaderboard */}
          <Section
            title="Forecast accuracy by recipe"
            icon={<Target size={16} />}
            badge={`${filteredRecipes.length} of ${report.recipes.length}`}
            subtitle="Biggest variances first. Overshoot = real demand higher than forecast."
            actions={
              <div style={{ display: 'flex', gap: 4 }}>
                {(['all', 'overshoot', 'undershoot', 'mixed', 'on-target'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setRecipeFilter(opt)}
                    style={pillStyle(recipeFilter === opt, true)}
                  >
                    {opt === 'all' ? 'All' :
                      opt === 'on-target' ? 'On target' :
                        opt[0].toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            }
          >
            {filteredRecipes.length === 0 ? (
              <EmptyState text="No recipes match this filter." />
            ) : (
              <RecipeTable
                rows={filteredRecipes}
                sort={recipeSort}
                onSort={(by) =>
                  setRecipeSort(prev =>
                    prev.by === by ? { by, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { by, dir: by === 'recipe' || by === 'category' ? 'asc' : 'desc' }
                  )
                }
              />
            )}
          </Section>

          {/* Category roll-up */}
          <Section
            title="By category"
            icon={<ShoppingBag size={16} />}
            badge={`${report.categories.length}`}
            subtitle="Where the volume sits and how each category tracks."
          >
            {report.categories.length === 0 ? (
              <EmptyState text="No category data." />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 10,
                  padding: 12,
                }}
              >
                {report.categories.map(c => (
                  <CategoryCard key={c.category} cat={c} />
                ))}
              </div>
            )}
          </Section>

          {/* Quinn suggestions */}
          {report.recipes.length > 0 && (
            <SuggestionPanel report={report} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  badge,
  subtitle,
  actions,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 32px',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-secondary)' }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{title}</h3>
        {badge && (
          <span style={BADGE_STYLE}>· {badge}</span>
        )}
        {subtitle && (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 4 }}>{subtitle}</span>
        )}
        {actions && <div style={{ marginLeft: 'auto' }}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}

function KPICard({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'bad' | 'warning';
}) {
  const toneColor =
    tone === 'good' ? 'var(--color-success)' :
    tone === 'bad' ? 'var(--color-error)' :
    tone === 'warning' ? 'var(--color-warning)' :
    'var(--color-text-primary)';
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: '14px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)' }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: toneColor, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{sub}</div>}
    </div>
  );
}

function DailyTrend({ days }: { days: DaySummary[] }) {
  const peak = Math.max(1, ...days.flatMap(d => [d.sold, d.forecast]));
  return (
    <div style={{ padding: '24px 32px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 18, fontSize: 11, color: 'var(--color-text-muted)' }}>
        <LegendDot color="var(--color-text-secondary)" label="Sold" />
        <LegendDot color="var(--color-border)" label="Forecast" />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 140 }}>
        {days.map(d => (
          <DayBars key={d.date} day={d} peak={peak} />
        ))}
      </div>
    </div>
  );
}

function DayBars({ day, peak }: { day: DaySummary; peak: number }) {
  const soldH = Math.round((day.sold / peak) * 100);
  const fcH = Math.round((day.forecast / peak) * 100);
  const tone = varianceTone(day.variancePct, true);
  const soldColor =
    tone === 'good' ? 'var(--color-success)' :
    tone === 'bad' ? 'var(--color-error)' :
    'var(--color-text-secondary)';
  return (
    <div style={{ flex: 1, minWidth: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: soldColor }}>
        {formatSignedPct(day.variancePct)}
      </span>
      <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3 }}>
        <div
          title={`Sold: ${day.sold}`}
          style={{
            width: '40%',
            maxWidth: 22,
            height: `${Math.max(2, soldH)}%`,
            background: soldColor,
            borderRadius: '2px 2px 0 0',
          }}
        />
        <div
          title={`Forecast: ${day.forecast}`}
          style={{
            width: '40%',
            maxWidth: 22,
            height: `${Math.max(2, fcH)}%`,
            background: 'var(--color-border)',
            borderRadius: '2px 2px 0 0',
          }}
        />
      </div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center', fontWeight: 600 }}>
        {formatHumanDate(day.date)}
      </div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
        {day.sold} / {day.forecast}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

function RecipeTable({
  rows,
  sort,
  onSort,
}: {
  rows: RecipeAccuracy[];
  sort: { by: string; dir: 'asc' | 'desc' };
  onSort: (by: 'recipe' | 'category' | 'sold' | 'forecast' | 'variance' | 'pct') => void;
}) {
  const cols: Array<{ id: 'recipe' | 'category' | 'sold' | 'forecast' | 'variance' | 'pct'; label: string; align?: 'left' | 'right' }> = [
    { id: 'recipe', label: 'Recipe' },
    { id: 'category', label: 'Category' },
    { id: 'sold', label: 'Sold', align: 'right' },
    { id: 'forecast', label: 'Forecast', align: 'right' },
    { id: 'variance', label: 'Δ units', align: 'right' },
    { id: 'pct', label: 'Δ %', align: 'right' },
  ];
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--color-bg-surface)' }}>
            {cols.map(c => (
              <th
                key={c.id}
                onClick={() => onSort(c.id)}
                style={{
                  textAlign: c.align ?? 'left',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {c.label}
                  {sort.by === c.id ? (
                    sort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                  ) : (
                    <ArrowUpDown size={11} style={{ opacity: 0.3 }} />
                  )}
                </span>
              </th>
            ))}
            <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'left' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Tendency
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <RecipeRow key={r.skuId} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecipeRow({ row }: { row: RecipeAccuracy }) {
  const tone = varianceTone(row.variancePct, true);
  const deltaColor =
    tone === 'good' ? 'var(--color-success)' :
    tone === 'bad' ? 'var(--color-error)' :
    'var(--color-text-secondary)';
  return (
    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.recipe.name}</td>
      <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontSize: 11 }}>{row.category}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.sold.toLocaleString()}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
        {row.forecast.toLocaleString()}
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'right', color: deltaColor, fontVariantNumeric: 'tabular-nums' }}>
        {formatVarianceUnits(row.variance)}
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'right', color: deltaColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {formatSignedPct(row.variancePct)}
      </td>
      <td style={{ padding: '10px 12px' }}>
        <TendencyChip tendency={row.tendency} />
      </td>
    </tr>
  );
}

function TendencyChip({ tendency }: { tendency: RecipeAccuracy['tendency'] }) {
  const map: Record<RecipeAccuracy['tendency'], { label: string; bg: string; color: string; icon: React.ReactNode }> = {
    overshoot:   { label: 'Overshoot every day',  bg: 'var(--color-success-light)', color: 'var(--color-success)', icon: <TrendingUp size={11} /> },
    undershoot:  { label: 'Undershoot every day', bg: 'var(--color-error-light)',   color: 'var(--color-error)',   icon: <TrendingDown size={11} /> },
    'on-target': { label: 'On target',            bg: 'var(--color-bg-hover)',      color: 'var(--color-text-secondary)', icon: <Minus size={11} /> },
    mixed:       { label: 'Mixed',                bg: 'var(--color-warning-light)', color: 'var(--color-warning)', icon: <Activity size={11} /> },
  };
  const c = map[tendency];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 100,
        background: c.bg,
        color: c.color,
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

function CategoryCard({ cat }: { cat: CategoryRollup }) {
  const tone = varianceTone(cat.variancePct, true);
  const color =
    tone === 'good' ? 'var(--color-success)' :
    tone === 'bad' ? 'var(--color-error)' :
    'var(--color-text-secondary)';
  // Bar comparing sold vs forecast
  const peak = Math.max(cat.sold, cat.forecast, 1);
  const soldPct = Math.round((cat.sold / peak) * 100);
  const fcPct = Math.round((cat.forecast / peak) * 100);
  return (
    <div
      style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{cat.category}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
          {formatSignedPct(cat.variancePct)}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 50, fontSize: 10, color: 'var(--color-text-muted)' }}>Sold</div>
          <div style={{ flex: 1, height: 6, background: 'var(--color-bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${soldPct}%`, height: '100%', background: color }} />
          </div>
          <div style={{ width: 56, fontSize: 11, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {cat.sold.toLocaleString()}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 50, fontSize: 10, color: 'var(--color-text-muted)' }}>Fcst</div>
          <div style={{ flex: 1, height: 6, background: 'var(--color-bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${fcPct}%`, height: '100%', background: 'var(--color-border)' }} />
          </div>
          <div style={{ width: 56, fontSize: 11, fontWeight: 700, textAlign: 'right', color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {cat.forecast.toLocaleString()}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
        {cat.recipeCount} recipe{cat.recipeCount === 1 ? '' : 's'}
      </div>
    </div>
  );
}

function SuggestionPanel({ report }: { report: SalesReport }) {
  const overshooters = report.recipes
    .filter(r => r.tendency === 'overshoot' && r.variancePct >= 10 && r.daysSeen >= Math.max(2, Math.floor(report.days.length * 0.5)))
    .slice(0, 3);
  const undershooters = report.recipes
    .filter(r => r.tendency === 'undershoot' && r.variancePct <= -10 && r.daysSeen >= Math.max(2, Math.floor(report.days.length * 0.5)))
    .slice(0, 3);

  if (overshooters.length === 0 && undershooters.length === 0) return null;

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-info)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 32px',
          background: 'var(--color-info-light)',
          borderBottom: '1px solid var(--color-info)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Lightbulb size={16} color="var(--color-info)" />
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Quinn's suggestions</h3>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 4 }}>
          Patterns worth feeding back into your demand model
        </span>
      </div>
      <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
        {overshooters.map(r => (
          <SuggestionCard
            key={r.skuId}
            tone="good"
            icon={<TrendingUp size={14} />}
            headline={`${r.recipe.name} ran ${formatSignedPct(r.variancePct)}`}
            body={`Selling ${formatVarianceUnits(r.variance)} units more than forecast across ${r.daysSeen} day${r.daysSeen === 1 ? '' : 's'}. Worth uplifting the model — you're missing easy revenue.`}
          />
        ))}
        {undershooters.map(r => (
          <SuggestionCard
            key={r.skuId}
            tone="bad"
            icon={<TrendingDown size={14} />}
            headline={`${r.recipe.name} ran ${formatSignedPct(r.variancePct)}`}
            body={`Producing ${formatVarianceUnits(-r.variance)} units more than selling across ${r.daysSeen} day${r.daysSeen === 1 ? '' : 's'}. Scale the forecast back or you'll keep hitting carry-over and waste.`}
          />
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({
  tone, icon, headline, body,
}: {
  tone: 'good' | 'bad';
  icon: React.ReactNode;
  headline: string;
  body: string;
}) {
  const color = tone === 'good' ? 'var(--color-success)' : 'var(--color-error)';
  const bg = tone === 'good' ? 'var(--color-success-light)' : 'var(--color-error-light)';
  return (
    <div
      style={{
        border: `1px solid ${color}`,
        borderRadius: 8,
        padding: '10px 12px',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 4,
            background: bg,
            color,
          }}
        >
          {icon}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {headline}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
        {body}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
      {text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const BADGE_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

function pillStyle(active: boolean, small = false): React.CSSProperties {
  return {
    padding: small ? '4px 8px' : '6px 10px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    background: active ? 'var(--color-accent-active)' : '#ffffff',
    color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
    border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

/**
 * `inverse=true` = overshoot (selling more than forecast) is GOOD (success
 * green). For productivity/timing where over = bad we'd flip this. Sales
 * variance: over-forecast is good (we sold more), under-forecast is bad
 * (we cooked too much).
 */
function varianceTone(pct: number, inverse: boolean): 'good' | 'bad' | undefined {
  if (Math.abs(pct) < 5) return undefined;
  if (inverse) {
    return pct > 0 ? 'good' : 'bad';
  }
  return pct < 0 ? 'good' : 'bad';
}

function deltaIcon(pct: number, size = 16) {
  if (Math.abs(pct) < 5) return <Minus size={size} />;
  if (pct > 0) return <TrendingUp size={size} color="var(--color-success)" />;
  return <TrendingDown size={size} color="var(--color-error)" />;
}

function accuracyTone(score: number): 'good' | 'bad' | 'warning' | undefined {
  if (score >= 90) return 'good';
  if (score >= 80) return undefined;
  if (score >= 70) return 'warning';
  return 'bad';
}

function accuracyVerdict(score: number): string {
  if (score >= 90) return 'Forecast nailing it';
  if (score >= 80) return 'Solid';
  if (score >= 70) return 'Room to tighten';
  return 'Model needs work';
}

function formatHumanDate(iso: string): string {
  if (iso === DEMO_TODAY) return 'Today';
  if (iso === dayOffset(-1)) return 'Yesterday';
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Quinn headline
// ─────────────────────────────────────────────────────────────────────────────

type Headline = { title: string; body: string; bg: string; borderColor: string; iconColor: string };

function quinnHeadline(r: SalesReport): Headline {
  if (r.totalForecast === 0) {
    return {
      title: 'No forecast data for this period.',
      body: 'Once a forecast lands and sales start coming through, this report will compare them line-by-line.',
      bg: 'var(--color-info-light)',
      borderColor: 'var(--color-info)',
      iconColor: 'var(--color-info)',
    };
  }
  const topOver = r.recipes.find(rec => rec.variancePct >= 10 && rec.tendency !== 'on-target');
  const topUnder = [...r.recipes].reverse().find(rec => rec.variancePct <= -10 && rec.tendency !== 'on-target');

  if (topOver && topUnder && Math.abs(topOver.variancePct) > Math.abs(topUnder.variancePct)) {
    return {
      title: `${topOver.recipe.name} is selling ${formatSignedPct(topOver.variancePct)} above forecast.`,
      body: `${formatVarianceUnits(topOver.variance)} units of unmet demand across ${topOver.daysSeen} day${topOver.daysSeen === 1 ? '' : 's'}. Meanwhile ${topUnder.recipe.name} is overproducing — see suggestions below.`,
      bg: 'var(--color-warning-light)',
      borderColor: 'var(--color-warning-border)',
      iconColor: 'var(--color-warning)',
    };
  }
  if (topUnder) {
    return {
      title: `${topUnder.recipe.name} is overproducing — ${formatSignedPct(topUnder.variancePct)} below sales.`,
      body: `${formatVarianceUnits(-topUnder.variance)} units cooked but not sold across ${topUnder.daysSeen} day${topUnder.daysSeen === 1 ? '' : 's'}. Scale the forecast back or expect carry-over and waste.`,
      bg: 'var(--color-error-light)',
      borderColor: 'var(--color-error-border)',
      iconColor: 'var(--color-error)',
    };
  }
  if (topOver) {
    return {
      title: `${topOver.recipe.name} is outperforming — ${formatSignedPct(topOver.variancePct)} above forecast.`,
      body: `Worth feeding into the demand model so we cook enough to capture the upside.`,
      bg: 'var(--color-success-light)',
      borderColor: 'var(--color-success)',
      iconColor: 'var(--color-success)',
    };
  }
  return {
    title: `Forecast on point — ${r.accuracyScore}% accuracy across ${r.recipes.length} recipes.`,
    body: `${r.totalSold.toLocaleString()} sold vs ${r.totalForecast.toLocaleString()} forecast (${formatSignedPct(r.totalVariancePct)}). No outliers worth flagging.`,
    bg: 'var(--color-success-light)',
    borderColor: 'var(--color-success)',
    iconColor: 'var(--color-success)',
  };
}

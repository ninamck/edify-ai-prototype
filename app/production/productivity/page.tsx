'use client';

/**
 * /production/productivity — Pret P013 / P040 / P041 / P058 / P059 / P060 / P132
 *
 * Answers the two questions a GM brings here: was the plan realistic, and
 * who needs support on which recipe.
 *
 * Layout (top → bottom):
 *  1. Period strip
 *  2. One-line headline
 *  3. Three numbers — vs Pret norm, units per labour hour, runs within norm
 *  4. Recipes vs norm — every batch a dot, very slow staff flagged (PAC169 / PAC172)
 *  5. Production runs: spare scheduled time, actual vs Pret norm (PAC088 / PAC089)
 *  6. Four-week kitchen trend (PAC161 / PAC162 / PAC170)
 *  7. All batches, collapsed
 */

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Gauge,
  Users,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ListChecks,
  CookingPot,
  TrendingUp,
  Rows3,
} from 'lucide-react';
import {
  Bar,
  Cell,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { DEMO_TODAY, dayOffset } from '@/components/Production/fixtures';
import { useProductionSite } from '@/components/Production/ProductionSiteContext';
import {
  siteProductivity,
  productivityTrend,
  formatMinutes,
  RUN_OVER_PERCENT,
  type BatchProductivity,
  type RecipeSummary,
  type RunSummary,
  type SiteProductivity,
  type TrendPoint,
} from '@/components/Production/productivity';

type DateRange = 'today' | 'yesterday' | 'last7' | 'last28';

const RANGES: Array<{ id: DateRange; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last28', label: 'Last 4 weeks' },
];

/** Orange is allowed for graphics only (3.6:1 non-text), never for text. */
const OVER_NORM = '#EA580C';
const SLOW_PERCENT = 12;
const RECIPES_SHOWN = 8;

function datesFor(range: DateRange): string[] {
  if (range === 'today') return [DEMO_TODAY];
  if (range === 'yesterday') return [dayOffset(-1)];
  const n = range === 'last7' ? 7 : 28;
  return Array.from({ length: n }, (_, i) => dayOffset(-i));
}

function priorFor(range: DateRange): { dates: string[]; label: string } | undefined {
  if (range === 'today') return { dates: [dayOffset(-1)], label: 'Yesterday' };
  if (range === 'yesterday') return { dates: [dayOffset(-2)], label: 'Day before' };
  if (range === 'last7') return { dates: Array.from({ length: 7 }, (_, i) => dayOffset(-7 - i)), label: 'Previous 7 days' };
  return undefined;
}

export default function ProductivityPage() {
  const { siteId } = useProductionSite();
  const [range, setRange] = useState<DateRange>('yesterday');
  const [showAllRecipes, setShowAllRecipes] = useState(false);
  const [showBatches, setShowBatches] = useState(false);
  const [batchSort, setBatchSort] = useState<{
    by: 'date' | 'recipe' | 'worker' | 'bench' | 'qty' | 'duration' | 'delta';
    dir: 'asc' | 'desc';
  }>({ by: 'date', dir: 'desc' });
  const [batchFilter, setBatchFilter] = useState<'all' | 'fast' | 'on-target' | 'slow' | 'failed'>('all');

  const dates = useMemo(() => datesFor(range), [range]);
  const multiDay = dates.length > 1;
  const summary = useMemo(() => siteProductivity(siteId, dates), [siteId, dates]);
  const prior = useMemo(() => {
    const p = priorFor(range);
    return p ? { label: p.label, summary: siteProductivity(siteId, p.dates) } : undefined;
  }, [siteId, range]);
  const trend = useMemo(() => productivityTrend(siteId), [siteId]);

  const sortedBatches = useMemo(() => {
    const filtered = summary.batches.filter(b => {
      if (b.batch.status === 'planned') return false;
      if (batchFilter === 'all') return true;
      return b.bucket === batchFilter;
    });
    const dir = batchSort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (batchSort.by) {
        case 'date':
          return dir * (a.batch.date.localeCompare(b.batch.date) || a.batch.startTime.localeCompare(b.batch.startTime));
        case 'recipe':
          return dir * a.recipeName.localeCompare(b.recipeName);
        case 'worker':
          return dir * a.workerName.localeCompare(b.workerName);
        case 'bench':
          return dir * a.benchName.localeCompare(b.benchName);
        case 'qty':
          return dir * (a.batch.actualQty - b.batch.actualQty);
        case 'duration':
          return dir * (a.actualMinutes - b.actualMinutes);
        case 'delta': {
          const av = a.deltaPercent ?? Number.POSITIVE_INFINITY;
          const bv = b.deltaPercent ?? Number.POSITIVE_INFINITY;
          return dir * (av - bv);
        }
      }
    });
  }, [summary.batches, batchSort, batchFilter]);

  const headline = headlineFor(summary, multiDay);
  const runsWithinNorm = summary.runs.filter(r => (r.deltaPercent ?? 0) < RUN_OVER_PERCENT).length;
  const worstRun = [...summary.runs]
    .filter(r => (r.deltaPercent ?? 0) >= RUN_OVER_PERCENT)
    .sort((a, b) => runOverMinutes(b) - runOverMinutes(a))[0];
  const recipes = showAllRecipes ? summary.recipes : summary.recipes.slice(0, RECIPES_SHOWN);
  const periodDates = new Set(dates);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ─── Period strip ───────────────────────────────────────────── */}
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
          {RANGES.map(opt => (
            <button
              key={opt.id}
              onClick={() => setRange(opt.id)}
              aria-pressed={opt.id === range}
              style={pillStyle(opt.id === range)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)' }}>
          {summary.batchCount} batch{summary.batchCount === 1 ? '' : 'es'} · {summary.totalUnits} units ·{' '}
          {multiDay ? `${dates.length} days` : formatHumanDate(dates[0])}
        </div>
      </div>

      {/* ─── Body ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 16px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 'var(--radius-card)',
              border: `1px solid ${headline.tone === 'warning' ? 'var(--color-warning-border)' : 'var(--color-info-border)'}`,
              background: headline.tone === 'warning' ? 'var(--color-warning-light)' : 'var(--color-info-light)',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <EdifyMark
              size={20}
              color={headline.tone === 'warning' ? 'var(--color-warning)' : 'var(--color-info)'}
              style={{ flexShrink: 0 }}
            />
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{headline.title}</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <KPICard
              icon={<Gauge size={16} />}
              label="vs Pret norm"
              value={summary.avgDeltaPercent == null ? '—' : vsNorm(summary.avgDeltaPercent)}
              sub={prior ? `${prior.label}: ${vsNorm(prior.summary.avgDeltaPercent)}` : `${summary.batchCount} batches`}
            />
            <KPICard
              icon={<Users size={16} />}
              label="Units per labour hour"
              value={summary.labour.unitsPerLabourHour == null ? '—' : summary.labour.unitsPerLabourHour.toFixed(1)}
              sub={`${formatMinutes(summary.labour.teamHours * 60)} team · ${formatMinutes(summary.labour.managerHours * 60)} manager on duty`}
            />
            <KPICard
              icon={<Clock size={16} />}
              label="Runs within norm"
              value={summary.runs.length === 0 ? '—' : `${runsWithinNorm} of ${summary.runs.length}`}
              sub={
                worstRun
                  ? `${worstRun.benchName} ${worstRun.runLabel}: ${formatMinutes(runOverMinutes(worstRun))} over`
                  : 'Every run within norm'
              }
            />
          </div>

          <Section
            title="Recipes vs norm"
            icon={<CookingPot size={16} />}
            badge={summary.flags.length > 0 ? `${summary.flags.length} flagged` : undefined}
            actions={<RecipeLegend />}
          >
            {summary.recipes.length === 0 ? (
              <EmptyState text="No batches with a Pret norm in this period." />
            ) : (
              <>
                <RecipeAxisHeader />
                {recipes.map(r => (
                  <RecipeRow key={r.productionItemId} recipe={r} />
                ))}
                {summary.recipes.length > RECIPES_SHOWN && (
                  <button onClick={() => setShowAllRecipes(v => !v)} style={LINK_BUTTON_STYLE}>
                    {showAllRecipes ? 'Show fewer recipes' : `Show all ${summary.recipes.length} recipes`}
                  </button>
                )}
              </>
            )}
          </Section>

          <Section
            title="Production runs"
            icon={<ListChecks size={16} />}
            badge={runsBadge(summary.runs, multiDay)}
            actions={<RunLegend />}
          >
            {summary.runs.length === 0 ? (
              <EmptyState text="No runs with a Pret norm in this period." />
            ) : (
              <RunsChart runs={summary.runs} multiDay={multiDay} />
            )}
          </Section>

          <Section title="Kitchen trend" icon={<TrendingUp size={16} />} badge="last 4 weeks">
            <TrendChart points={trend} periodDates={periodDates} />
          </Section>

          <Section
            title="All batches"
            icon={<Rows3 size={16} />}
            badge={`${summary.batchCount}`}
            actions={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {showBatches && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['all', 'fast', 'on-target', 'slow', 'failed'] as const).map(opt => (
                      <button
                        key={opt}
                        onClick={() => setBatchFilter(opt)}
                        aria-pressed={batchFilter === opt}
                        style={pillStyle(batchFilter === opt, true)}
                      >
                        {opt === 'all' ? 'All' : opt === 'on-target' ? 'On norm' : opt[0].toUpperCase() + opt.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowBatches(v => !v)}
                  aria-expanded={showBatches}
                  style={{ ...pillStyle(false, true), display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {showBatches ? 'Hide' : 'Show'}
                  {showBatches ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>
            }
          >
            {showBatches &&
              (sortedBatches.length === 0 ? (
                <EmptyState text="No batches match this filter." />
              ) : (
                <BatchTable
                  rows={sortedBatches}
                  sort={batchSort}
                  onSort={by =>
                    setBatchSort(prev =>
                      prev.by === by ? { by, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { by, dir: 'asc' },
                    )
                  }
                />
              ))}
          </Section>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  badge,
  actions,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section
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
          borderBottom: children ? '1px solid var(--color-border-subtle)' : undefined,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-secondary)' }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{title}</h3>
        {badge && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            · {badge}
          </span>
        )}
        {actions && <div style={{ marginLeft: 'auto' }}>{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function KPICard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
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
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{sub}</div>}
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-text-secondary)' }}>
      {swatch}
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Production runs: bullet chart per run
// ─────────────────────────────────────────────────────────────────────────────

const RUN_GRID = '170px 1fr 90px 120px';

function RunLegend() {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      <LegendItem
        swatch={<span style={{ width: 16, height: 10, borderRadius: 3, background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }} />}
        label="Scheduled"
      />
      <LegendItem swatch={<span style={{ width: 16, height: 6, borderRadius: 2, background: 'var(--viz-2)' }} />} label="Actual" />
      <LegendItem
        swatch={<span style={{ width: 16, height: 6, borderRadius: 2, background: OVER_NORM }} />}
        label={`Over norm (${RUN_OVER_PERCENT}%+)`}
      />
      <LegendItem swatch={<span style={{ width: 2, height: 14, background: 'var(--viz-1)' }} />} label="Pret norm" />
    </div>
  );
}

function RunsChart({ runs, multiDay }: { runs: RunSummary[]; multiDay: boolean }) {
  const max = Math.max(1, ...runs.map(r => Math.max(r.scheduledMinutes ?? 0, r.normMinutes, r.actualMinutes)));
  const tickStep = max > 240 ? 60 : 30;
  const ticks = Array.from({ length: Math.floor(max / tickStep) + 1 }, (_, i) => i * tickStep);
  return (
    <div>
      <div aria-hidden style={{ ...COLUMN_HEADER_STYLE, gridTemplateColumns: RUN_GRID }}>
        <span>Run</span>
        <span>Time used{multiDay ? ' per day' : ''}</span>
        <span style={{ textAlign: 'right' }}>Spare time</span>
        <span style={{ textAlign: 'right' }}>vs norm</span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {runs.map(r => (
          <RunRow key={`${r.benchId}-${r.runLabel}`} run={r} max={max} multiDay={multiDay} />
        ))}
      </ul>
      <div aria-hidden style={{ display: 'grid', gridTemplateColumns: RUN_GRID, gap: 16, padding: '6px 32px 12px' }}>
        <span />
        <div style={{ position: 'relative', height: 14 }}>
          {ticks.map(t => (
            <span
              key={t}
              style={{
                position: 'absolute',
                left: `${(t / max) * 100}%`,
                transform: t === 0 ? undefined : 'translateX(-50%)',
                fontSize: 10,
                color: 'var(--color-text-muted)',
              }}
            >
              {t === 0 ? '0' : formatMinutes(t)}
            </span>
          ))}
        </div>
        <span />
        <span />
      </div>
    </div>
  );
}

function RunRow({ run, max, multiDay }: { run: RunSummary; max: number; multiDay: boolean }) {
  const over = runOverMinutes(run);
  const isOver = (run.deltaPercent ?? 0) >= RUN_OVER_PERCENT;
  const status = isOver ? `${formatMinutes(over)} over` : over <= -1 ? `${formatMinutes(-over)} under` : 'Within norm';
  const spare = runSpareMinutes(run);
  const pct = (m: number) => `${Math.min(100, (m / max) * 100)}%`;
  const spareText =
    spare == null ? '' : spare < 0 ? `${formatMinutes(-spare)} longer than scheduled. ` : `${formatMinutes(spare)} of scheduled time spare. `;
  const description =
    `${run.benchName} ${run.runLabel}: ${spareText}${isOver || over <= -1 ? `${status} norm` : status}. ${formatMinutes(run.actualMinutes)} actual against ${formatMinutes(run.normMinutes)} Pret norm` +
    (run.scheduledMinutes != null ? `, ${formatMinutes(run.scheduledMinutes)} scheduled` : '') +
    (multiDay ? ` (average of ${run.activeDays} days)` : '') +
    `. ${run.batchCount} batch${run.batchCount === 1 ? '' : 'es'}.`;
  return (
    <li
      title={description}
      style={{
        display: 'grid',
        gridTemplateColumns: RUN_GRID,
        gap: 16,
        alignItems: 'center',
        padding: '10px 32px',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <span style={SR_ONLY}>{description}</span>
      <div aria-hidden>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{run.benchName}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {run.runLabel}
          {run.startTime ? ` · ${run.startTime}` : ''}
        </div>
      </div>
      <div aria-hidden style={{ position: 'relative', height: 22 }}>
        {run.scheduledMinutes != null && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 2,
              height: 18,
              width: pct(run.scheduledMinutes),
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              boxSizing: 'border-box',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 7,
            height: 8,
            width: pct(run.actualMinutes),
            background: isOver ? OVER_NORM : 'var(--viz-2)',
            borderRadius: 3,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `calc(${pct(run.normMinutes)} - 1px)`,
            top: 0,
            height: 22,
            width: 2,
            background: 'var(--viz-1)',
          }}
        />
      </div>
      <div aria-hidden style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {spare == null ? '—' : spare < 0 ? `${formatMinutes(-spare)} short` : formatMinutes(spare)}
        </div>
        {run.scheduledMinutes != null && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>of {formatMinutes(run.scheduledMinutes)}</div>
        )}
      </div>
      <div aria-hidden style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {isOver && <AlertTriangle size={12} color={OVER_NORM} />}
          {status}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {formatMinutes(run.actualMinutes)} vs {formatMinutes(run.normMinutes)}
        </div>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recipes vs norm: strip plot per recipe, staff breakdown on expand
// ─────────────────────────────────────────────────────────────────────────────

const RECIPE_GRID = '220px 1fr 100px 190px 16px';
const AXIS_LIMIT = 60;
/** The batch "on-target" bucket in productivity.ts: -8% to +12%. */
const NORM_BAND = { from: -8, to: 12 };

function axisPos(delta: number): number {
  const clamped = Math.max(-AXIS_LIMIT, Math.min(AXIS_LIMIT, delta));
  return ((clamped + AXIS_LIMIT) / (AXIS_LIMIT * 2)) * 100;
}

function RecipeLegend() {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      <LegendItem swatch={<Dot color="var(--viz-2)" />} label="Batch" />
      <LegendItem swatch={<Dot color={OVER_NORM} />} label="Slow batch" />
      <LegendItem swatch={<Dot hollow />} label="Failed" />
      <LegendItem swatch={<span style={{ width: 2, height: 14, background: 'var(--viz-1)' }} />} label="Average" />
    </div>
  );
}

function Dot({ color, hollow, size = 10 }: { color?: string; hollow?: boolean; size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: hollow ? '#ffffff' : color,
        border: hollow ? '2px solid var(--color-error)' : undefined,
        boxSizing: 'border-box',
      }}
    />
  );
}

function RecipeAxisHeader() {
  return (
    <div aria-hidden style={{ ...COLUMN_HEADER_STYLE, gridTemplateColumns: RECIPE_GRID }}>
      <span>Recipe</span>
      <div style={{ position: 'relative' }}>
        <span>{AXIS_LIMIT}% faster</span>
        <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>Norm</span>
        <span style={{ position: 'absolute', right: 0 }}>{AXIS_LIMIT}% slower</span>
      </div>
      <span style={{ textAlign: 'right' }}>Average</span>
      <span>Needs support</span>
      <span />
    </div>
  );
}

function StripTrack({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden style={{ position: 'relative', height: 22 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 10, height: 1, background: 'var(--color-border-subtle)' }} />
      <div
        style={{
          position: 'absolute',
          top: 4,
          bottom: 4,
          left: `${axisPos(NORM_BAND.from)}%`,
          width: `${axisPos(NORM_BAND.to) - axisPos(NORM_BAND.from)}%`,
          background: 'var(--color-bg-hover)',
          borderRadius: 4,
        }}
      />
      <div style={{ position: 'absolute', top: 2, bottom: 2, left: '50%', width: 1, background: 'var(--color-border)' }} />
      {children}
    </div>
  );
}

function RecipeRow({ recipe }: { recipe: RecipeSummary }) {
  const [open, setOpen] = useState(false);
  const flag = recipe.flags[0];
  const description =
    `${recipe.recipeName}: ${recipe.batches.length} batch${recipe.batches.length === 1 ? '' : 'es'}, average ${vsNorm(recipe.avgDeltaPercent)}.` +
    (recipe.flags.length > 0
      ? ` Needs support: ${recipe.flags.map(f => `${f.workerName} ${vsNorm(f.deltaPercent)}`).join(', ')}.`
      : '');
  return (
    <div style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={description}
        style={{
          ...RESET_BUTTON,
          width: '100%',
          display: 'grid',
          gridTemplateColumns: RECIPE_GRID,
          gap: 16,
          alignItems: 'center',
          padding: '10px 32px',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {recipe.recipeName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {recipe.batches.length} batch{recipe.batches.length === 1 ? '' : 'es'}
          </div>
        </div>
        <StripTrack>
          {recipe.batches.map(b => {
            const failed = b.batch.status === 'failed';
            const slow = (b.deltaPercent ?? 0) >= SLOW_PERCENT;
            return (
              <span
                key={b.batch.id}
                title={batchTooltip(b)}
                style={{
                  position: 'absolute',
                  top: 6,
                  left: `calc(${axisPos(b.deltaPercent ?? AXIS_LIMIT)}% - 5px)`,
                  opacity: failed ? 1 : 0.8,
                  lineHeight: 0,
                }}
              >
                <Dot color={slow ? OVER_NORM : 'var(--viz-2)'} hollow={failed} />
              </span>
            );
          })}
          {recipe.avgDeltaPercent != null && (
            <span
              style={{
                position: 'absolute',
                top: 0,
                height: 22,
                width: 2,
                left: `calc(${axisPos(recipe.avgDeltaPercent)}% - 1px)`,
                background: 'var(--viz-1)',
              }}
            />
          )}
        </StripTrack>
        <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'right' }}>{vsNorm(recipe.avgDeltaPercent)}</span>
        <span style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 0 }}>
          {flag && <FlagChip name={flag.workerName} delta={flag.deltaPercent} />}
          {recipe.flags.length > 1 && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>+{recipe.flags.length - 1}</span>
          )}
        </span>
        <span style={{ color: 'var(--color-text-muted)', display: 'flex' }}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      {open && (
        <ul style={{ listStyle: 'none', margin: 0, padding: '0 0 10px', background: '#ffffff' }}>
          {recipe.staff.map(s => {
            const flagged = recipe.flags.some(f => f.userId === s.userId);
            const d = s.avgDeltaPercent ?? 0;
            const from = Math.min(axisPos(0), axisPos(d));
            const width = Math.abs(axisPos(d) - axisPos(0));
            return (
              <li
                key={s.userId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: RECIPE_GRID,
                  gap: 16,
                  alignItems: 'center',
                  padding: '6px 32px',
                }}
              >
                <span style={{ fontSize: 12, paddingLeft: 12, color: 'var(--color-text-primary)' }}>
                  {s.workerName}
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {' '}
                    · {s.batchCount} batch{s.batchCount === 1 ? '' : 'es'}
                  </span>
                </span>
                <StripTrack>
                  <span
                    style={{
                      position: 'absolute',
                      top: 7,
                      height: 8,
                      left: `${from}%`,
                      width: `${Math.max(width, 0.5)}%`,
                      borderRadius: 3,
                      background: d >= SLOW_PERCENT ? OVER_NORM : 'var(--viz-2)',
                    }}
                  />
                </StripTrack>
                <span style={{ fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{vsNorm(s.avgDeltaPercent)}</span>
                <span>{flagged && <FlagChip label="Very slow" />}</span>
                <span />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FlagChip({ name, delta, label }: { name?: string; delta?: number; label?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 'var(--radius-badge)',
        background: 'var(--color-warning-light)',
        border: '1px solid var(--color-warning-border)',
        color: 'var(--color-warning)',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      <AlertTriangle size={11} color={OVER_NORM} style={{ flexShrink: 0 }} />
      {label ?? `${name} · ${vsNorm(delta)}`}
    </span>
  );
}

function batchTooltip(b: BatchProductivity): string {
  const when = `${formatHumanDate(b.batch.date)} ${b.batch.startTime}`;
  const times =
    b.targetMinutes != null
      ? `${formatMinutes(b.actualMinutes)} vs ${formatMinutes(b.targetMinutes)} norm`
      : formatMinutes(b.actualMinutes);
  const status = b.batch.status === 'failed' ? ' · failed' : '';
  return `${b.workerName} · ${when} · ${b.batch.actualQty} units · ${times} (${vsNorm(b.deltaPercent)})${status}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kitchen trend
// ─────────────────────────────────────────────────────────────────────────────

type TrendMetric = 'norm' | 'uplh';

function TrendChart({ points, periodDates }: { points: TrendPoint[]; periodDates: Set<string> }) {
  const [metric, setMetric] = useState<TrendMetric>('norm');
  const data = points.map((p, i) => {
    const value = metric === 'norm' ? p.deltaPercent : p.unitsPerLabourHour;
    const lastWeek = points
      .slice(Math.max(0, i - 6), i + 1)
      .map(w => (metric === 'norm' ? w.deltaPercent : w.unitsPerLabourHour))
      .filter((v): v is number => v != null);
    return {
      date: p.date,
      label: shortDate(p.date),
      value: value == null ? null : Math.round(value * 10) / 10,
      rolling: lastWeek.length === 0 ? null : Math.round((lastWeek.reduce((a, b) => a + b, 0) / lastWeek.length) * 10) / 10,
      inPeriod: periodDates.has(p.date),
    };
  });
  const format = (v: number) => (metric === 'norm' ? normAxisLabel(v) : v.toFixed(1));

  return (
    <div style={{ padding: '12px 32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {([
            { id: 'norm', label: 'vs Pret norm' },
            { id: 'uplh', label: 'Units per labour hour' },
          ] as Array<{ id: TrendMetric; label: string }>).map(opt => (
            <button
              key={opt.id}
              onClick={() => setMetric(opt.id)}
              aria-pressed={metric === opt.id}
              style={pillStyle(metric === opt.id, true)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
          <LegendItem swatch={<span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--viz-2)' }} />} label="Selected period" />
          <LegendItem
            swatch={<span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--viz-2)', opacity: 0.3 }} />}
            label="Other days"
          />
          <LegendItem swatch={<span style={{ width: 16, height: 2, background: 'var(--viz-1)' }} />} label="7-day average" />
        </div>
      </div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={6} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={metric === 'norm' ? 100 : 40}
              tickFormatter={format}
            />
            {metric === 'norm' && <ReferenceLine y={0} stroke="var(--viz-1)" strokeDasharray="4 4" />}
            <Tooltip
              formatter={(v, name) => [
                typeof v === 'number' ? format(v) : '—',
                name === 'rolling' ? '7-day average' : 'Day',
              ]}
              labelFormatter={(_, payload) => {
                const iso = payload?.[0]?.payload?.date as string | undefined;
                return iso ? formatHumanDate(iso) : '';
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false}>
              {data.map(d => (
                <Cell key={d.date} fill="var(--viz-2)" fillOpacity={d.inPeriod ? 1 : 0.3} />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="rolling"
              stroke="var(--viz-1)"
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch table
// ─────────────────────────────────────────────────────────────────────────────

function BatchTable({
  rows,
  sort,
  onSort,
}: {
  rows: BatchProductivity[];
  sort: { by: string; dir: 'asc' | 'desc' };
  onSort: (by: 'date' | 'recipe' | 'worker' | 'bench' | 'qty' | 'duration' | 'delta') => void;
}) {
  const cols: Array<{ id: 'date' | 'recipe' | 'worker' | 'bench' | 'qty' | 'duration' | 'delta'; label: string; align?: 'left' | 'right' }> = [
    { id: 'date', label: 'When' },
    { id: 'recipe', label: 'Recipe' },
    { id: 'worker', label: 'Worker' },
    { id: 'bench', label: 'Bench' },
    { id: 'qty', label: 'Qty', align: 'right' },
    { id: 'duration', label: 'Actual', align: 'right' },
    { id: 'delta', label: 'vs norm', align: 'right' },
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
                aria-sort={sort.by === c.id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
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
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <BatchRow key={r.batch.id} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BatchRow({ row }: { row: BatchProductivity }) {
  const failed = row.batch.status === 'failed';
  return (
    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
        {formatHumanDate(row.batch.date)} · {row.batch.startTime}
      </td>
      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
        {row.recipeName}
        {failed && (
          <span
            style={{
              marginLeft: 6,
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              background: '#ffffff',
              color: 'var(--color-error)',
              border: '1.5px solid var(--color-error)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            failed{row.batch.failureReason ? ` · ${row.batch.failureReason}` : ''}
          </span>
        )}
      </td>
      <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{row.workerName}</td>
      <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontSize: 11 }}>{row.benchName}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{row.batch.actualQty}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
        {formatMinutes(row.actualMinutes)}
        {row.targetMinutes != null && (
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>norm {formatMinutes(row.targetMinutes)}</div>
        )}
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {row.bucket === 'slow' && <Dot color={OVER_NORM} size={8} />}
          {row.deltaPercent == null ? '—' : vsNorm(row.deltaPercent)}
        </span>
      </td>
    </tr>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>{text}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const COLUMN_HEADER_STYLE: React.CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: '8px 32px',
  borderBottom: '1px solid var(--color-border-subtle)',
  background: 'var(--color-bg-hover)',
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

/** Strips button chrome but keeps the browser focus ring (no `all: unset`). */
const RESET_BUTTON: React.CSSProperties = {
  background: 'none',
  border: 'none',
  margin: 0,
  textAlign: 'left',
  color: 'inherit',
  boxSizing: 'border-box',
};

const LINK_BUTTON_STYLE: React.CSSProperties = {
  ...RESET_BUTTON,
  cursor: 'pointer',
  display: 'block',
  padding: '10px 32px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--color-link)',
  fontFamily: 'var(--font-primary)',
};

const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
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

/** From the rounded figures shown beside it, so "52m vs 50m" always reads "2m". */
function runOverMinutes(run: RunSummary): number {
  return Math.round(run.actualMinutes) - Math.round(run.normMinutes);
}

/** Scheduled minus actual; negative when the run outlasted its slot. */
function runSpareMinutes(run: RunSummary): number | undefined {
  if (run.scheduledMinutes == null) return undefined;
  return Math.round(run.scheduledMinutes) - Math.round(run.actualMinutes);
}

function runsBadge(runs: RunSummary[], multiDay: boolean): string | undefined {
  const spare = runs.reduce((a, r) => a + Math.max(0, runSpareMinutes(r) ?? 0), 0);
  if (spare < 1) return multiDay ? 'average per day' : undefined;
  return `${formatMinutes(spare)} scheduled but not needed${multiDay ? ' a day' : ''}`;
}

/** "12% faster" / "8% slower" / "on norm". Mirrors formatDelta in Pret's vocabulary. */
function vsNorm(delta: number | undefined): string {
  if (delta == null) return '—';
  if (delta <= -3) return `${Math.abs(Math.round(delta))}% faster`;
  if (delta >= 3) return `${Math.round(delta)}% slower`;
  return 'on norm';
}

function normAxisLabel(v: number): string {
  if (v === 0) return 'Norm';
  return v > 0 ? `${Math.round(v)}% slower` : `${Math.abs(Math.round(v))}% faster`;
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function formatHumanDate(iso: string): string {
  if (iso === DEMO_TODAY) return 'Today';
  if (iso === dayOffset(-1)) return 'Yesterday';
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Headline
// ─────────────────────────────────────────────────────────────────────────────

function headlineFor(s: SiteProductivity, multiDay: boolean): { title: string; tone: 'info' | 'warning' } {
  if (s.batchCount === 0) return { title: 'No bench activity in this period yet.', tone: 'info' };
  const flag = s.flags[0];
  if (flag) {
    const next = flag.quickest
      ? ` ${flag.quickest.workerName} runs it ${vsNorm(flag.quickest.deltaPercent)}, so pair them on the next run.`
      : ' Worth a five-minute chat before the next run.';
    return { title: `${flag.workerName} is ${vsNorm(flag.deltaPercent)} than norm on ${flag.recipeName}.${next}`, tone: 'warning' };
  }
  const worst = [...s.runs]
    .filter(r => (r.deltaPercent ?? 0) >= RUN_OVER_PERCENT)
    .sort((a, b) => runOverMinutes(b) - runOverMinutes(a))[0];
  if (worst) {
    return {
      title: `${worst.benchName} ${worst.runLabel} ran ${formatMinutes(runOverMinutes(worst))} over norm${multiDay ? ' a day' : ''}.`,
      tone: 'warning',
    };
  }
  const pace = vsNorm(s.avgDeltaPercent);
  return { title: `Kitchen ran ${pace} across ${s.batchCount} batches.`, tone: 'info' };
}

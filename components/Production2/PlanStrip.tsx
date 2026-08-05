'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Truck, Snowflake, Filter } from 'lucide-react';
import {
  benchesAt,
  DEMO_TODAY,
  dayOffset,
  dayOfWeek,
  tierForSiteOnDate,
  getWorkflow,
  type Bench,
  type PlannedInstance,
  type ProductionRecipe,
  type Site,
} from './fixtures';
import { resolvePlan, usePlanStore, type PlanLine } from './PlanStore';

type Props = {
  site: Site;
  /**
   * Anchor of the 5-day window. Defaults to DEMO_TODAY. The strip will
   * render `[anchor-1, anchor, anchor+1, anchor+2, anchor+3]` so the user
   * can scroll the window forward by changing the day-strip selection on
   * the parent Plan page.
   */
  anchorDate?: string;
};

const RELATIVE_DAYS = [-1, 0, 1, 2, 3] as const;

type Category = ProductionRecipe['category'];

const CATEGORY_ORDER: Category[] = ['Bakery', 'Sandwich', 'Salad', 'Snack', 'Beverage'];

const CATEGORY_LABEL: Record<Category, string> = {
  Bakery: 'Bakery & viennoiserie',
  Sandwich: 'Sandwiches, toasties, soups',
  Salad: 'Salads & grain bowls',
  Snack: 'Pots & snacks',
  Beverage: 'Drinks & smoothies',
};

// Categorical chip tints from the palette guidelines — fixed per
// category, never status colours.
const CATEGORY_TINT: Record<Category, string> = {
  Bakery:   '#EFF5E1',  /* olive */
  Sandwich: '#E0F2F7',  /* cyan */
  Salad:    '#DCF2F0',  /* teal */
  Snack:    '#F3EAFB',  /* plum */
  Beverage: '#E9E8F7',  /* indigo */
};

const MODE_LABEL = { run: 'Run', variable: 'Variable', increment: 'Increment' } as const;
const MODE_COLOR = {
  run:       'var(--color-info)',
  variable:  'var(--color-warning)',
  increment: 'var(--color-success)',
} as const;

type DayMeta = { offset: number; iso: string; dow: string; label: string; tier: string };

type DaySummary = {
  day: DayMeta;
  totalUnits: number;
  recipeCount: number;
  dispatchUnits: number;
  dispatchSpokes: number;
  crossDayCount: number;
};

export default function PlanStrip({ site, anchorDate = DEMO_TODAY }: Props) {
  const { overrides, perDropOverrides, perRunOverrides, variableOverrides } = usePlanStore();

  // ─── 5-day window ──────────────────────────────────────────────────────────
  const days: DayMeta[] = useMemo(() => {
    return RELATIVE_DAYS.map(offset => {
      const iso = dayOffset(offset, anchorDate);
      const tier = tierForSiteOnDate(site.id, iso);
      return {
        offset,
        iso,
        dow: dayOfWeek(iso),
        label:
          offset === 0 ? 'Today'
          : offset === -1 ? 'Yesterday'
          : offset === 1 ? 'Tomorrow'
          : '',
        tier: tier?.name ?? '—',
      };
    });
  }, [site.id, anchorDate]);

  // ─── Plans, one per day, all built from the same pipeline as Detailed ─────
  // (resolvePlan -> amountsForSiteOnDate -> every production item + forecast).
  // This is the change that brings every prototyped product into Overview.
  const plansByDay: Record<string, PlanLine[]> = useMemo(() => {
    const out: Record<string, PlanLine[]> = {};
    for (const d of days) {
      out[d.iso] = resolvePlan(
        site.id,
        d.iso,
        overrides,
        perDropOverrides,
        variableOverrides,
        perRunOverrides,
      );
    }
    return out;
  }, [site.id, days, overrides, perDropOverrides, variableOverrides, perRunOverrides]);

  // ─── Per-day stats for the 5-day outlook strip ─────────────────────────────
  const daySummaries = useMemo(() => {
    return days.map(day => {
      const lines = plansByDay[day.iso] ?? [];
      const totalUnits = lines.reduce((a, l) => a + l.effectivePlanned, 0);
      const recipeCount = new Set(
        lines.filter(l => l.effectivePlanned > 0).map(l => l.item.recipeId),
      ).size;
      const dispatchUnits = lines.reduce((a, l) => a + (l.dispatchDemand ?? 0), 0);
      const dispatchSpokes = new Set<string>();
      lines.forEach(l => l.dispatchBySpoke?.forEach(s => dispatchSpokes.add(s.spokeId)));
      // "Cross-day prep" = recipes scheduled for THIS day whose workflow has
      // any stage with leadOffset !== 0 (so part of their pipeline lands on
      // a different day).
      const crossDayRecipes = new Set<string>();
      lines.forEach(l => {
        if (l.effectivePlanned <= 0) return;
        const wf = getWorkflow(l.recipe.workflowId);
        if (wf?.stages.some(s => s.leadOffset !== 0)) crossDayRecipes.add(l.recipe.id);
      });
      return {
        day,
        totalUnits,
        recipeCount,
        dispatchUnits,
        dispatchSpokes: dispatchSpokes.size,
        crossDayCount: crossDayRecipes.size,
      };
    });
  }, [days, plansByDay]);

  // ─── Bench load matrix ─────────────────────────────────────────────────────
  const siteBenches = useMemo(() => benchesAt(site.id), [site.id]);
  const benchLoad = useMemo(() => {
    return siteBenches.map(bench => {
      const cells = days.map(day => {
        const lines = plansByDay[day.iso] ?? [];
        const onBench = lines.filter(l => l.primaryBench?.id === bench.id);
        const total = onBench.reduce((a, l) => a + l.effectivePlanned, 0);
        const recipeIds = new Set(onBench.map(l => l.item.recipeId));
        // Mode mix for the bench/day
        const modes = { run: 0, variable: 0, increment: 0 };
        onBench.forEach(l => {
          modes[l.item.mode] += l.effectivePlanned;
        });
        return { day, total, recipeCount: recipeIds.size, modes };
      });
      const peak = Math.max(0, ...cells.map(c => c.total));
      return { bench, cells, peak };
    });
  }, [siteBenches, days, plansByDay]);

  const benchPeakOverall = useMemo(
    () => Math.max(1, ...benchLoad.flatMap(b => b.cells.map(c => c.total))),
    [benchLoad],
  );

  // ─── Product mix — one row per recipe scheduled at the site ───────────────
  type RecipeRow = {
    recipe: ProductionRecipe;
    mode: PlanLine['item']['mode'];
    benchId: string | undefined;
    benchName: string | undefined;
    perDay: number[];
    total: number;
  };

  const allRows: RecipeRow[] = useMemo(() => {
    const byRecipe = new Map<string, RecipeRow>();
    for (const day of days) {
      const idx = days.findIndex(d => d.iso === day.iso);
      const lines = plansByDay[day.iso] ?? [];
      for (const line of lines) {
        const r = line.recipe;
        const existing = byRecipe.get(r.id);
        if (!existing) {
          byRecipe.set(r.id, {
            recipe: r,
            mode: line.item.mode,
            benchId: line.primaryBench?.id,
            benchName: line.primaryBench?.name,
            perDay: days.map((_, i) => (i === idx ? line.effectivePlanned : 0)),
            total: line.effectivePlanned,
          });
        } else {
          existing.perDay[idx] = line.effectivePlanned;
          existing.total += line.effectivePlanned;
        }
      }
    }
    return Array.from(byRecipe.values()).sort((a, b) => b.total - a.total);
  }, [days, plansByDay]);

  // Filters
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [activeBench, setActiveBench] = useState<string | 'all'>('all');
  const filteredRows = useMemo(() => {
    return allRows.filter(r => {
      if (activeCategory !== 'all' && r.recipe.category !== activeCategory) return false;
      if (activeBench !== 'all' && r.benchId !== activeBench) return false;
      return true;
    });
  }, [allRows, activeCategory, activeBench]);

  // Group filtered rows by category for the table headers
  const groupedRows = useMemo(() => {
    const groups = new Map<Category, RecipeRow[]>();
    for (const row of filteredRows) {
      const arr = groups.get(row.recipe.category) ?? [];
      arr.push(row);
      groups.set(row.recipe.category, arr);
    }
    return CATEGORY_ORDER
      .filter(c => groups.has(c))
      .map(c => ({ category: c, rows: groups.get(c)! }));
  }, [filteredRows]);

  // Expanded row → show workflow trace
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);

  // Cross-day prep insights (HUB feature, but useful at any site that has
  // overnight ferments / D-1 prep on the cold-chain bench).
  const tonightFeedingTomorrow = useMemo(() => {
    const todayPlan = plansByDay[days.find(d => d.offset === 0)!.iso] ?? [];
    const tomorrow = days.find(d => d.offset === 1);
    if (!tomorrow) return [];
    return todayPlan
      .map(line => {
        const wf = getWorkflow(line.recipe.workflowId);
        if (!wf) return null;
        const hasD1Stage = wf.stages.some(s => s.leadOffset === -1);
        if (!hasD1Stage) return null;
        // For the tomorrow plan to have proper feed, find tomorrow's planned
        // qty for the same recipe.
        const tomorrowLine = (plansByDay[tomorrow.iso] ?? []).find(
          l => l.item.recipeId === line.recipe.id,
        );
        if (!tomorrowLine || tomorrowLine.effectivePlanned <= 0) return null;
        const stage = wf.stages.find(s => s.leadOffset === -1)!;
        return {
          recipe: line.recipe,
          stageLabel: stage.label,
          tomorrowQty: tomorrowLine.effectivePlanned,
          benchName: line.primaryBench?.name,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => b.tomorrowQty - a.tomorrowQty)
      .slice(0, 6);
  }, [plansByDay, days]);

  return (
    <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 1. 5-day outlook ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="5-day outlook"
          note={`${site.name} · ${site.type}${site.type === 'HUB' ? ' (you are the hub)' : ''}`}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {daySummaries.map(s => (
            <DayCard key={s.day.iso} summary={s} isHub={site.type === 'HUB'} />
          ))}
        </div>
      </section>

      {/* ── 2. Bench load matrix ─────────────────────────────────────────── */}
      {siteBenches.length > 0 && (
        <section>
          <SectionHeader
            title="Bench load"
            note="Where the work lands across the week."
          />
          <div
            style={{
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-card)',
              background: '#ffffff',
              overflow: 'hidden',
            }}
          >
            <BenchLoadHeader days={days} />
            {benchLoad.map(({ bench, cells }, i) => (
              <BenchLoadRow
                key={bench.id}
                bench={bench}
                cells={cells}
                isFirst={i === 0}
                peakOverall={benchPeakOverall}
                isFiltered={activeBench === bench.id}
                onToggleFilter={() =>
                  setActiveBench(prev => (prev === bench.id ? 'all' : bench.id))
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* ── 3. Product mix ───────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Product mix"
          note={`${allRows.length} recipes scheduled · click any row for the workflow trace`}
        />
        <FilterBar
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          activeBench={activeBench}
          onBenchClear={() => setActiveBench('all')}
          benchName={
            activeBench === 'all'
              ? null
              : siteBenches.find(b => b.id === activeBench)?.name ?? null
          }
          counts={CATEGORY_ORDER.reduce((acc, c) => {
            acc[c] = allRows.filter(r => r.recipe.category === c).length;
            return acc;
          }, {} as Record<Category, number>)}
        />

        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
            background: '#ffffff',
            overflow: 'hidden',
            marginTop: 8,
          }}
        >
          <ProductMixHeader days={days} />
          {groupedRows.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
              No recipes match the current filter.
            </div>
          ) : (
            groupedRows.map(({ category, rows }) => (
              <div key={category}>
                <CategoryHeader category={category} count={rows.length} />
                {rows.map(row => (
                  <ProductMixRow
                    key={row.recipe.id}
                    row={row}
                    days={days}
                    isExpanded={expandedRecipeId === row.recipe.id}
                    onToggle={() =>
                      setExpandedRecipeId(prev => (prev === row.recipe.id ? null : row.recipe.id))
                    }
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── 4. Hub footer: dispatch + tonight's prep ─────────────────────── */}
      {(site.type === 'HUB' || tonightFeedingTomorrow.length > 0) && (
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: site.type === 'HUB' ? '1fr 1fr' : '1fr',
            gap: 12,
          }}
        >
          {site.type === 'HUB' && (
            <DispatchCard daySummaries={daySummaries} />
          )}
          {tonightFeedingTomorrow.length > 0 && (
            <ColdChainCard items={tonightFeedingTomorrow} />
          )}
        </section>
      )}
    </div>
  );
}

// ───── Day card ───────────────────────────────────────────────────────────────

function DayCard({
  summary,
  isHub,
}: {
  summary: DaySummary;
  isHub: boolean;
}) {
  const { day, totalUnits, recipeCount, dispatchUnits, dispatchSpokes, crossDayCount } = summary;
  const dateLabel = new Date(`${day.iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
  const isToday = day.offset === 0;
  return (
    <div
      style={{
        borderRadius: 'var(--radius-card)',
        border: `1px solid ${isToday ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`,
        background: isToday ? 'var(--color-badge-active-bg)' : '#ffffff',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 152,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {day.dow}
        </span>
        {day.label && (
          <span
            style={{
              fontSize: 9,
              color: isToday ? 'var(--color-accent-active)' : 'var(--color-text-muted)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {day.label}
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: 11,
          color: 'var(--color-text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {dateLabel} · {day.tier}
      </span>

      <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          {totalUnits.toLocaleString()}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-muted)',
            fontWeight: 600,
          }}
        >
          units
        </span>
      </div>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
        across {recipeCount} {recipeCount === 1 ? 'recipe' : 'recipes'}
      </span>

      <div style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {isHub && dispatchUnits > 0 && (
          <Pill
            icon={<Truck size={9} />}
            label={`${dispatchUnits} dispatch · ${dispatchSpokes} spoke${dispatchSpokes === 1 ? '' : 's'}`}
            tint="info"
          />
        )}
        {crossDayCount > 0 && (
          <Pill
            icon={<Snowflake size={9} />}
            label={`${crossDayCount} cross-day prep`}
            tint="warning"
          />
        )}
      </div>
    </div>
  );
}

function Pill({
  icon,
  label,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  tint: 'info' | 'warning' | 'success';
}) {
  const TINT = {
    info:    { bg: 'var(--color-info-light)',    fg: 'var(--color-info)' },
    warning: { bg: 'var(--color-warning-light)', fg: 'var(--color-warning)' },
    success: { bg: 'var(--color-success-light)', fg: 'var(--color-success)' },
  }[tint];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 6px',
        background: TINT.bg,
        color: TINT.fg,
        borderRadius: 6,
        fontSize: 9,
        fontWeight: 700,
      }}
    >
      {icon}
      {label}
    </span>
  );
}

// ───── Bench load matrix ──────────────────────────────────────────────────────

function BenchLoadHeader({ days }: { days: DayMeta[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px repeat(5, minmax(0, 1fr))',
        background: 'var(--color-bg-hover)',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Bench
      </div>
      {days.map(d => (
        <div
          key={d.iso}
          style={{
            padding: '8px 10px',
            fontSize: 10,
            fontWeight: 700,
            color: d.offset === 0 ? 'var(--color-accent-active)' : 'var(--color-text-muted)',
            textAlign: 'center',
            borderLeft: '1px solid var(--color-border-subtle)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {d.dow} {d.offset === 0 && '·'}
          <span style={{ opacity: 0.6, marginLeft: 4 }}>
            D{d.offset >= 0 ? `+${d.offset}` : d.offset}
          </span>
        </div>
      ))}
    </div>
  );
}

function BenchLoadRow({
  bench,
  cells,
  isFirst,
  peakOverall,
  isFiltered,
  onToggleFilter,
}: {
  bench: Bench;
  cells: Array<{
    day: DayMeta;
    total: number;
    recipeCount: number;
    modes: { run: number; variable: number; increment: number };
  }>;
  isFirst: boolean;
  peakOverall: number;
  isFiltered: boolean;
  onToggleFilter: () => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px repeat(5, minmax(0, 1fr))',
        borderTop: isFirst ? 'none' : '1px solid var(--color-border-subtle)',
        background: isFiltered ? 'var(--color-badge-active-bg)' : '#ffffff',
      }}
    >
      <button
        type="button"
        onClick={onToggleFilter}
        title="Click to filter the product mix to this bench"
        style={{
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-primary)',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700 }}>{bench.name}</span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {bench.primaryMode ?? 'flex'} · {(bench.workTypes ?? bench.capabilities ?? []).slice(0, 2).join(' / ')}
        </span>
      </button>
      {cells.map(({ day, total, recipeCount, modes }) => {
        const pct = peakOverall > 0 ? (total / peakOverall) * 100 : 0;
        const dominantMode = (Object.entries(modes) as Array<[
          'run' | 'variable' | 'increment',
          number,
        ]>).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'run';
        return (
          <div
            key={day.iso}
            style={{
              padding: 10,
              borderLeft: '1px solid var(--color-border-subtle)',
              background:
                day.offset === 0 ? 'rgba(255, 192, 96, 0.10)' : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {total > 0 ? (
              <>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--color-text-primary)',
                    lineHeight: 1,
                  }}
                >
                  {total.toLocaleString()}
                </span>
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: 'var(--color-bg-hover)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: MODE_COLOR[dominantMode],
                      opacity: 0.85,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 9,
                    color: 'var(--color-text-muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {recipeCount} recipe{recipeCount === 1 ? '' : 's'} · {MODE_LABEL[dominantMode]}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>—</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ───── Filter bar ─────────────────────────────────────────────────────────────

function FilterBar({
  activeCategory,
  onCategoryChange,
  activeBench,
  onBenchClear,
  benchName,
  counts,
}: {
  activeCategory: Category | 'all';
  onCategoryChange: (c: Category | 'all') => void;
  activeBench: string | 'all';
  onBenchClear: () => void;
  benchName: string | null;
  counts: Record<Category, number>;
}) {
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
      }}
    >
      <Filter size={12} color="var(--color-text-muted)" />
      <FilterPill
        label="All"
        count={totalCount}
        active={activeCategory === 'all'}
        onClick={() => onCategoryChange('all')}
      />
      {CATEGORY_ORDER.map(c =>
        counts[c] > 0 ? (
          <FilterPill
            key={c}
            label={c}
            count={counts[c]}
            active={activeCategory === c}
            onClick={() => onCategoryChange(c)}
          />
        ) : null,
      )}
      {activeBench !== 'all' && benchName && (
        <button
          type="button"
          onClick={onBenchClear}
          style={{
            marginLeft: 8,
            padding: '3px 9px',
            fontSize: 10,
            fontWeight: 700,
            background: '#ffffff',
            color: 'var(--color-info)',
            border: '1.5px solid var(--color-info)',
            borderRadius: 999,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--font-primary)',
          }}
        >
          Bench: {benchName} ✕
        </button>
      )}
    </div>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 10px',
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 100,
        background: active ? 'var(--color-accent-active)' : '#ffffff',
        color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
        border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {label}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: '0 5px',
          borderRadius: 8,
          background: active ? 'rgba(255,255,255,0.16)' : 'var(--color-bg-hover)',
          color: active ? 'var(--color-text-on-active)' : 'var(--color-text-muted)',
        }}
      >
        {count}
      </span>
    </button>
  );
}

// ───── Product mix table ──────────────────────────────────────────────────────

function ProductMixHeader({ days }: { days: DayMeta[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 2fr) 90px repeat(5, minmax(0, 1fr)) 80px',
        background: 'var(--color-bg-hover)',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <div style={hdrCell()}>Recipe</div>
      <div style={hdrCell('center')}>Mode</div>
      {days.map(d => (
        <div
          key={d.iso}
          style={{
            ...hdrCell('center'),
            color: d.offset === 0 ? 'var(--color-accent-active)' : 'var(--color-text-muted)',
            borderLeft: '1px solid var(--color-border-subtle)',
          }}
        >
          {d.dow}
        </div>
      ))}
      <div style={{ ...hdrCell('right'), borderLeft: '1px solid var(--color-border-subtle)' }}>
        Total
      </div>
    </div>
  );
}

function CategoryHeader({ category, count }: { category: Category; count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: CATEGORY_TINT[category],
        borderBottom: '1px solid var(--color-border-subtle)',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {CATEGORY_LABEL[category]}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: '1px 6px',
          borderRadius: 8,
          background: '#ffffff',
          color: 'var(--color-text-muted)',
        }}
      >
        {count}
      </span>
    </div>
  );
}

function ProductMixRow({
  row,
  days,
  isExpanded,
  onToggle,
}: {
  row: {
    recipe: ProductionRecipe;
    mode: 'run' | 'variable' | 'increment';
    benchName: string | undefined;
    perDay: number[];
    total: number;
  };
  days: DayMeta[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isAssembly = !!row.recipe.subRecipes && row.recipe.subRecipes.length > 0;
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 2fr) 90px repeat(5, minmax(0, 1fr)) 80px',
          width: '100%',
          background: isExpanded ? 'var(--color-bg-hover)' : '#ffffff',
          border: 'none',
          borderBottom: '1px solid var(--color-border-subtle)',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          textAlign: 'left',
          padding: 0,
        }}
      >
        <div style={{ ...bodyCell(), display: 'flex', alignItems: 'center', gap: 8 }}>
          {isExpanded ? (
            <ChevronDown size={12} color="var(--color-text-muted)" />
          ) : (
            <ChevronRight size={12} color="var(--color-text-muted)" />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {row.recipe.name}
              {isAssembly && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: '#ffffff',
                    color: 'var(--color-info)',
                    border: '1.5px solid var(--color-info)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Assembly
                </span>
              )}
              {row.recipe.isPrep && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: '#ffffff',
                    color: 'var(--color-warning)',
                    border: '1.5px solid var(--color-warning)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Prep
                </span>
              )}
            </span>
            {row.benchName && (
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                {row.benchName}
              </span>
            )}
          </div>
        </div>
        <div style={{ ...bodyCell('center') }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 7px',
              borderRadius: 100,
              background: 'var(--color-bg-hover)',
              color: MODE_COLOR[row.mode],
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {MODE_LABEL[row.mode]}
          </span>
        </div>
        {row.perDay.map((qty, i) => {
          const day = days[i];
          return (
            <div
              key={day.iso}
              style={{
                ...bodyCell('center'),
                background:
                  day.offset === 0 ? 'rgba(255, 192, 96, 0.08)' : 'transparent',
                borderLeft: '1px solid var(--color-border-subtle)',
                fontVariantNumeric: 'tabular-nums',
                fontWeight: qty > 0 ? 600 : 400,
                color: qty > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              }}
            >
              {qty > 0 ? qty.toLocaleString() : '—'}
            </div>
          );
        })}
        <div
          style={{
            ...bodyCell('right'),
            borderLeft: '1px solid var(--color-border-subtle)',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
          }}
        >
          {row.total.toLocaleString()}
        </div>
      </button>
      {isExpanded && <WorkflowTrace recipe={row.recipe} days={days} />}
    </>
  );
}

function WorkflowTrace({ recipe, days }: { recipe: ProductionRecipe; days: DayMeta[] }) {
  const wf = getWorkflow(recipe.workflowId);
  if (!wf) return null;

  return (
    <div
      style={{
        background: 'var(--color-bg-hover)',
        borderBottom: '1px solid var(--color-border-subtle)',
        padding: '12px 16px 16px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 8,
        }}
      >
        Workflow trace · {wf.stages.length} {wf.stages.length === 1 ? 'stage' : 'stages'}
        {recipe.subRecipes && recipe.subRecipes.length > 0 && (
          <span style={{ marginLeft: 8, color: 'var(--color-info)' }}>
            ↳ pulls {recipe.subRecipes.length} sub-recipe{recipe.subRecipes.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '180px repeat(5, minmax(0, 1fr))',
          background: '#ffffff',
          borderRadius: 8,
          border: '1px solid var(--color-border-subtle)',
          overflow: 'hidden',
        }}
      >
        {/* header */}
        <div style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Stage
        </div>
        {days.map(d => (
          <div
            key={d.iso}
            style={{
              padding: '6px 10px',
              fontSize: 10,
              fontWeight: 700,
              textAlign: 'center',
              color: d.offset === 0 ? 'var(--color-accent-active)' : 'var(--color-text-muted)',
              borderLeft: '1px solid var(--color-border-subtle)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {d.dow}
          </div>
        ))}
        {wf.stages.map(stage => (
          <div
            key={stage.id}
            style={{
              display: 'contents',
            }}
          >
            <div
              style={{
                padding: '8px 10px',
                borderTop: '1px solid var(--color-border-subtle)',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600 }}>{stage.label}</span>
              <div style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {stage.capability} · {stage.leadOffset === 0 ? 'D0' : `D${stage.leadOffset}`}
                {stage.requiresEquipment && stage.requiresEquipment.length > 0 && (
                  <> · {stage.requiresEquipment.join(', ')}</>
                )}
              </div>
            </div>
            {days.map(d => {
              const lit = isStageLitForDay(stage.leadOffset, d.offset);
              return (
                <div
                  key={`${stage.id}-${d.iso}`}
                  style={{
                    padding: '8px 10px',
                    borderTop: '1px solid var(--color-border-subtle)',
                    borderLeft: '1px solid var(--color-border-subtle)',
                    background: lit ? 'var(--color-info-light)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: lit ? 'var(--color-info)' : 'var(--color-text-muted)',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {lit ? `D${stage.leadOffset === 0 ? '0' : stage.leadOffset}` : '—'}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * For the workflow trace cells: a stage with leadOffset L "lights up" on a
 * day whose offset (relative to the anchor row's D0) is L. We render every
 * day in the strip, and light the cell whenever that day plays this stage's
 * role in the chain. Because every selectable day has a notion of D0 (its
 * own bake), every day is essentially a different anchor — so we light the
 * column whose own offset equals leadOffset (e.g. ferment lights D-1 only).
 */
function isStageLitForDay(leadOffset: -2 | -1 | 0, dayOffset: number): boolean {
  return dayOffset === leadOffset;
}

// ───── Hub footer cards ───────────────────────────────────────────────────────

function DispatchCard({ daySummaries }: { daySummaries: DaySummary[] }) {
  const max = Math.max(1, ...daySummaries.map(s => s.dispatchUnits));
  return (
    <div
      style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: 14,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Truck size={14} color="var(--color-info)" />
        <span style={{ fontSize: 13, fontWeight: 700 }}>Dispatch to spokes</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
          Units leaving the hub
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
        {daySummaries.map(s => {
          const pct = (s.dispatchUnits / max) * 100;
          const isToday = s.day.offset === 0;
          return (
            <div
              key={s.day.iso}
              style={{
                border: `1px solid ${isToday ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`,
                borderRadius: 8,
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{s.day.dow}</span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {s.dispatchUnits}
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: 'var(--color-bg-hover)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: isToday ? 'var(--color-accent-active)' : 'var(--color-accent-mid)',
                  }}
                />
              </div>
              <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>
                {s.dispatchSpokes} {s.dispatchSpokes === 1 ? 'spoke' : 'spokes'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ColdChainCard({
  items,
}: {
  items: Array<{ recipe: ProductionRecipe; stageLabel: string; tomorrowQty: number; benchName?: string }>;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: 14,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Snowflake size={14} color="var(--color-warning)" />
        <span style={{ fontSize: 13, fontWeight: 700 }}>Crossing into tomorrow</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
          Tonight's prep / cold-chain holds
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(it => (
          <div
            key={it.recipe.id}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 8,
              padding: '6px 8px',
              borderRadius: 6,
              background: 'var(--color-bg-hover)',
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600 }}>{it.recipe.name}</span>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                {it.stageLabel} · D-1 {it.benchName ? `· ${it.benchName}` : ''}
              </span>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--color-text-primary)',
              }}
            >
              {it.tomorrowQty} <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>for tomorrow</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───── Shared bits ────────────────────────────────────────────────────────────

function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}
    >
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, letterSpacing: '0.01em' }}>{title}</h2>
      {note && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{note}</span>}
    </div>
  );
}

function hdrCell(align: 'left' | 'center' | 'right' = 'left'): React.CSSProperties {
  return {
    padding: '8px 12px',
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: align,
  };
}

function bodyCell(align: 'left' | 'center' | 'right' = 'left'): React.CSSProperties {
  return {
    padding: '10px 12px',
    fontSize: 12,
    color: 'var(--color-text-primary)',
    textAlign: align,
    display: 'flex',
    alignItems: 'center',
    justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
  };
}

// ───── (legacy export — kept so any other importer of this module compiles) ──

export type { PlannedInstance };

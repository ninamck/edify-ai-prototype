'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import {
  PRET_PLAN,
  PRET_RECIPES,
  DEMO_TODAY,
  dayOffset,
  dayOfWeek,
  tierForSiteOnDate,
  getProductionItem,
  getRecipe,
  getWorkflow,
  type PlannedInstance,
  type ProductionRecipe,
  type WorkflowStage,
  type Site,
} from './fixtures';

type Props = {
  site: Site;
};

const RELATIVE_DAYS = [-2, -1, 0, 1, 2] as const;

export default function PlanStrip({ site }: Props) {
  const [focusedRecipeId, setFocusedRecipeId] = useState<string>('prec-club-sandwich');

  const days = useMemo(() => {
    return RELATIVE_DAYS.map(offset => {
      const iso = dayOffset(offset);
      return {
        offset,
        iso,
        dow: dayOfWeek(iso),
        label: offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : offset === 1 ? 'Tomorrow' : '',
        tier: tierForSiteOnDate(site.id, iso),
      };
    });
  }, [site.id]);

  // Instances for this site only (all dates)
  const siteInstances = useMemo(() => {
    return PRET_PLAN.plannedInstances.filter(pi => {
      const item = getProductionItem(pi.productionItemId);
      return item && item.siteId === site.id;
    });
  }, [site.id]);

  // Per-day summary stats
  const daySummaries = useMemo(() => {
    return days.map(day => {
      const instances = siteInstances.filter(pi => pi.date === day.iso);
      const totalPlanned = instances.reduce((a, b) => a + b.plannedQty, 0);
      const uniqueRecipes = new Set(
        instances.map(pi => getProductionItem(pi.productionItemId)?.recipeId).filter(Boolean),
      );
      const crossDayStages = instances.filter(pi => {
        const item = getProductionItem(pi.productionItemId);
        const wf = item ? getWorkflow(item.recipeId ? getRecipe(item.recipeId)?.workflowId ?? '' : '') : undefined;
        const stage = wf?.stages.find(s => s.id === pi.stageId);
        return stage && stage.leadOffset !== 0;
      });
      return {
        day,
        totalPlanned,
        recipeCount: uniqueRecipes.size,
        instanceCount: instances.length,
        crossDayCount: crossDayStages.length,
      };
    });
  }, [days, siteInstances]);

  // Recipes that are scheduled at this site
  const scheduledRecipes = useMemo(() => {
    const ids = new Set<string>();
    siteInstances.forEach(pi => {
      const item = getProductionItem(pi.productionItemId);
      if (item) ids.add(item.recipeId);
    });
    return PRET_RECIPES.filter(r => ids.has(r.id));
  }, [siteInstances]);

  const focusedRecipe = scheduledRecipes.find(r => r.id === focusedRecipeId) ?? scheduledRecipes[0];
  const focusedInstances = useMemo(() => {
    if (!focusedRecipe) return [];
    return siteInstances.filter(pi => {
      const item = getProductionItem(pi.productionItemId);
      return item?.recipeId === focusedRecipe.id;
    });
  }, [focusedRecipe, siteInstances]);

  return (
    <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 5-day summary strip */}
      <section>
        <SectionHeader title="5-day outlook" note={`${site.name} · ${site.type}`} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {daySummaries.map(({ day, totalPlanned, recipeCount, instanceCount, crossDayCount }) => (
            <DayCard
              key={day.iso}
              iso={day.iso}
              dow={day.dow}
              relativeLabel={day.label}
              tierName={day.tier?.name ?? '—'}
              totalPlanned={totalPlanned}
              recipeCount={recipeCount}
              instanceCount={instanceCount}
              crossDayCount={crossDayCount}
              isToday={day.offset === 0}
            />
          ))}
        </div>
      </section>

      {/* Recipe selector */}
      <section>
        <SectionHeader title="Trace a recipe across days" note="See how cross-day prep feeds today's sales." />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {scheduledRecipes.map(r => {
            const active = r.id === focusedRecipeId;
            return (
              <button
                key={r.id}
                onClick={() => setFocusedRecipeId(r.id)}
                style={{
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 8,
                  background: active ? 'var(--color-accent-active)' : '#ffffff',
                  color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                  border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                {r.name}
              </button>
            );
          })}
        </div>

        {focusedRecipe && (
          <RecipeChainGrid
            recipe={focusedRecipe}
            instances={focusedInstances}
            days={daySummaries.map(s => s.day)}
          />
        )}
      </section>

      {/* Hub-spoke dispatch strip — only if site is HUB */}
      {site.type === 'HUB' && (
        <section>
          <SectionHeader title="Dispatch load" note="Units leaving the hub by day." />
          <DispatchLoad days={daySummaries.map(s => s.day)} siteInstances={siteInstances} />
        </section>
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function DayCard({
  iso,
  dow,
  relativeLabel,
  tierName,
  totalPlanned,
  recipeCount,
  instanceCount,
  crossDayCount,
  isToday,
}: {
  iso: string;
  dow: string;
  relativeLabel: string;
  tierName: string;
  totalPlanned: number;
  recipeCount: number;
  instanceCount: number;
  crossDayCount: number;
  isToday: boolean;
}) {
  const dateLabel = new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
        minHeight: 128,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {dow}
        </span>
        {relativeLabel && (
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {relativeLabel}
          </span>
        )}
      </div>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
        {dateLabel}
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
        <Stat label="Tier" value={tierName} />
        <Stat label="Units" value={totalPlanned > 0 ? totalPlanned.toString() : '—'} bold />
        <Stat label="Recipes" value={recipeCount > 0 ? recipeCount.toString() : '—'} />
      </div>
      {crossDayCount > 0 && (
        <span
          style={{
            marginTop: 'auto',
            alignSelf: 'flex-start',
            fontSize: 10,
            padding: '2px 6px',
            background: 'var(--color-info-light)',
            color: 'var(--color-info)',
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          {crossDayCount} prep {crossDayCount === 1 ? 'stage' : 'stages'}
        </span>
      )}
    </div>
  );
}

function Stat({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: bold ? 18 : 12,
          fontWeight: bold ? 700 : 600,
          color: 'var(--color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function RecipeChainGrid({
  recipe,
  instances,
  days,
}: {
  recipe: ProductionRecipe;
  instances: PlannedInstance[];
  days: Array<{ iso: string; dow: string; offset: number }>;
}) {
  const workflow = getWorkflow(recipe.workflowId);
  if (!workflow) return null;

  // Map each stage -> instances-per-day
  const stageRows = workflow.stages.map(stage => {
    const cells = days.map(day => {
      const cellInstances = instances.filter(pi => pi.stageId === stage.id && pi.date === day.iso);
      const totalQty = cellInstances.reduce((a, b) => a + b.plannedQty, 0);
      return { day, instances: cellInstances, totalQty };
    });
    return { stage, cells };
  });

  // Detect "chains" — when instance N on day D has forecastRef.date == day D+k, feeding chain into later stage
  const chainHighlights = new Set<string>();
  instances.forEach(pi => {
    if (pi.forecastRef && pi.date !== pi.forecastRef.date) {
      chainHighlights.add(`${pi.date}|${pi.stageId}`);
    }
  });

  return (
    <div
      style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '140px repeat(5, minmax(0, 1fr))',
          background: 'var(--color-bg-hover)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Stage
        </div>
        {days.map(day => (
          <div
            key={day.iso}
            style={{
              padding: '8px 10px',
              fontSize: 11,
              fontWeight: 700,
              color: day.offset === 0 ? 'var(--color-accent-active)' : 'var(--color-text-muted)',
              textAlign: 'center',
              borderLeft: '1px solid var(--color-border-subtle)',
            }}
          >
            {day.dow} {day.offset === 0 && '·'} <span style={{ opacity: 0.7 }}>D{day.offset >= 0 ? `+${day.offset}` : day.offset}</span>
          </div>
        ))}
      </div>

      {/* Stage rows */}
      {stageRows.map(({ stage, cells }, i) => {
        const hasContent = cells.some(c => c.instances.length > 0);
        return (
          <div
            key={stage.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '140px repeat(5, minmax(0, 1fr))',
              borderTop: i === 0 ? 'none' : '1px solid var(--color-border-subtle)',
              opacity: hasContent ? 1 : 0.55,
            }}
          >
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{stage.label}</span>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {stage.capability} · {stage.leadOffset === 0 ? 'D0' : `D${stage.leadOffset}`}
              </span>
            </div>
            {cells.map(({ day, instances: cellInstances, totalQty }) => {
              const chain = chainHighlights.has(`${day.iso}|${stage.id}`);
              const empty = cellInstances.length === 0;
              return (
                <div
                  key={day.iso}
                  style={{
                    padding: 10,
                    borderLeft: '1px solid var(--color-border-subtle)',
                    background: day.offset === 0 ? 'var(--color-badge-active-bg)' : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    minHeight: 56,
                    position: 'relative',
                  }}
                >
                  {empty ? (
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>—</span>
                  ) : (
                    <>
                      <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                        {totalQty}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                        {cellInstances.length} {cellInstances.length === 1 ? 'batch' : 'batches'}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {cellInstances[0].startTime}
                        {cellInstances.length > 1 && ` +${cellInstances.length - 1}`}
                      </span>
                      {chain && (
                        <span
                          title="Feeds into a later day"
                          style={{
                            position: 'absolute',
                            right: 6,
                            top: 6,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2,
                            padding: '2px 4px',
                            background: 'var(--color-info-light)',
                            borderRadius: 4,
                            color: 'var(--color-info)',
                            fontSize: 9,
                            fontWeight: 700,
                          }}
                        >
                          <ArrowRight size={10} />feeds
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Recipe footer summary */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-hover)',
          fontSize: 11,
          color: 'var(--color-text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <ChevronDown size={12} />
        <span>
          {recipe.name} workflow — {workflow.stages.length} {workflow.stages.length === 1 ? 'stage' : 'stages'}.
          {' '}Deepest lead offset: D{Math.min(...workflow.stages.map(s => s.leadOffset))}.
        </span>
      </div>
    </div>
  );
}

function DispatchLoad({
  days,
  siteInstances,
}: {
  days: Array<{ iso: string; dow: string; offset: number }>;
  siteInstances: PlannedInstance[];
}) {
  // A rough proxy for dispatch load: total planned qty for recipes consumed by downstream sites
  // (For slice C we just surface the pack/assemble stage totals.)
  const perDay = days.map(day => {
    const stageQty = siteInstances
      .filter(pi => pi.date === day.iso)
      .filter(pi => {
        const item = getProductionItem(pi.productionItemId);
        const recipe = item ? getRecipe(item.recipeId) : undefined;
        const wf = recipe ? getWorkflow(recipe.workflowId) : undefined;
        const stage = wf?.stages.find((s: WorkflowStage) => s.id === pi.stageId);
        return stage?.capability === 'pack' || stage?.capability === 'assemble';
      })
      .reduce((a, b) => a + b.plannedQty, 0);
    return { day, qty: stageQty };
  });
  const max = Math.max(1, ...perDay.map(p => p.qty));

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        gap: 8,
      }}
    >
      {perDay.map(({ day, qty }) => {
        const pct = (qty / max) * 100;
        return (
          <div
            key={day.iso}
            style={{
              border: `1px solid ${day.offset === 0 ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`,
              borderRadius: 'var(--radius-card)',
              background: '#ffffff',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, fontWeight: 700 }}>{day.dow}</span>
              <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {qty}
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: 'var(--color-bg-hover)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: day.offset === 0 ? 'var(--color-accent-active)' : 'var(--color-accent-mid)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, letterSpacing: '0.01em' }}>{title}</h2>
      {note && (
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{note}</span>
      )}
    </div>
  );
}

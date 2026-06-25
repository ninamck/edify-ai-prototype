'use client';

import { useMemo, useState } from 'react';
import { Printer, Clock, Layers } from 'lucide-react';
import {
  benchesAt,
  benchWorkTypes,
  benchEquipment,
  ingredientUsageFor,
  componentPrepWork,
  getIngredient,
  stageWorkType,
  getWorkflow,
  getRecipe,
  getSite,
  WORK_TYPE_LABELS,
  WORK_TYPE_ORDER,
  WORK_TYPE_COLORS,
  EQUIPMENT_LABELS,
  type Bench,
  type Equipment,
  type IngredientId,
  type RecipeId,
  type SiteId,
  type WorkType,
} from './fixtures';
import { usePlan, type PlanLine } from './PlanStore';
import StepperLauncher from './StepperLauncher';

// ─────────────────────────────────────────────────────────────────────────────
// Run sheet — two layers, one source of truth
// ─────────────────────────────────────────────────────────────────────────────
//
// The day's planned work is split into two deliberately separate views
// rather than one dense merged table:
//
//   1. **Ingredients & quantities** — the "weigh-up" sheet. For each
//      planned recipe (and each of its sub-recipes) it lists every
//      ingredient with the total quantity to prep (e.g. "Roast chicken
//      — 335.2kg") and tags showing what should happen to it (Weigh up,
//      Slice, Sanitise…).
//
//   2. **Task assignment** — the "who does what, where" sheet. For each
//      recipe / sub-recipe it lists the workflow stages as tasks (Slice,
//      Sanitise, Bake, Assemble…) with the bench they run on and a slot
//      to assign a person.
//
// Both views are broken down by recipe → sub-recipe so a chef can read a
// single recipe top-to-bottom. A Print button renders the active view as
// a clean A4 sheet the kitchen can pin up and write names onto.

type ViewMode = 'ingredients' | 'tasks';

type IngredientLine = {
  ingredientId: IngredientId;
  name: string;
  totalQty: number;
  unit: 'g' | 'ml' | 'unit';
  /** Tags for what should happen to this ingredient (Weigh up, Slice…). */
  prepTags: WorkType[];
};

type TaskLine = {
  stageId: string;
  label: string;
  workType: WorkType;
  benchName: string;
  equipment: Equipment[];
  durationMinutes: number;
};

/** A recipe or one of its sub-recipes — the breakdown unit shared by both
 *  views. */
type ComponentNode = {
  recipeId: RecipeId;
  name: string;
  isSubRecipe: boolean;
  ingredients: IngredientLine[];
  tasks: TaskLine[];
};

/** One planned recipe for the day, with its components (self + subs). */
type RecipeGroup = {
  recipeId: RecipeId;
  recipeName: string;
  category: string;
  plannedUnits: number;
  itemId: string;
  primaryBenchName?: string;
  components: ComponentNode[];
  hasIngredients: boolean;
  hasTasks: boolean;
};

function orderWorkTypes(wts: WorkType[]): WorkType[] {
  return WORK_TYPE_ORDER.filter(w => wts.includes(w));
}

function formatQty(q: number, unit: 'g' | 'ml' | 'unit'): string {
  if (unit === 'unit') return Math.round(q).toLocaleString('en-GB');
  if (q >= 1000) {
    const v = q / 1000;
    return `${v.toLocaleString('en-GB', { maximumFractionDigits: 1 })}${unit === 'g' ? 'kg' : 'L'}`;
  }
  return `${Math.round(q).toLocaleString('en-GB')}${unit}`;
}

function formatDuration(mins: number): string {
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Pick the bench a stage should run on. Prefer the recipe's routed
 *  primary bench when it can do the work; otherwise the first online
 *  bench that handles this work type and carries any required equipment. */
function benchForStage(
  workType: WorkType,
  requiresEquipment: Equipment[],
  benches: Bench[],
  primaryBench: Bench | undefined,
): string {
  const eligible = (b: Bench) =>
    benchWorkTypes(b).includes(workType) &&
    requiresEquipment.every(e => benchEquipment(b).includes(e));
  if (primaryBench && eligible(primaryBench)) return primaryBench.name;
  const match = benches.find(eligible);
  if (match) return match.name;
  return primaryBench?.name ?? 'Not routed';
}

// ─────────────────────────────────────────────────────────────────────────────
// Build recipe groups from the day's plan
// ─────────────────────────────────────────────────────────────────────────────

function buildRecipeGroups(plan: PlanLine[], benches: Bench[]): RecipeGroup[] {
  const groups: RecipeGroup[] = [];

  for (const line of plan) {
    if (line.effectivePlanned <= 0) continue;
    const recipe = line.recipe;
    const planned = line.effectivePlanned;
    const primaryBench = line.primaryBench;

    const compMap = new Map<RecipeId, ComponentNode>();
    const componentOrder: RecipeId[] = [];
    const ensureComp = (rid: RecipeId): ComponentNode => {
      let c = compMap.get(rid);
      if (!c) {
        const isSubRecipe = rid !== recipe.id;
        const r = rid === recipe.id ? recipe : getRecipe(rid);
        c = {
          recipeId: rid,
          name: r?.name ?? rid,
          isSubRecipe,
          ingredients: [],
          tasks: [],
        };
        compMap.set(rid, c);
        componentOrder.push(rid);
      }
      return c;
    };

    // Parent first, then sub-recipes — keeps the on-sheet reading order.
    ensureComp(recipe.id);
    const subRecipeIds = (recipe.subRecipes ?? []).map(s => s.recipeId);
    for (const rid of subRecipeIds) ensureComp(rid);

    // ── Ingredients ─────────────────────────────────────────────────────
    // Every ingredient consumed by the recipe + its sub-recipes, with the
    // resolved prep work as tags. We read raw usage (not the prep-only
    // aggregation) so ingredients with no prep work still appear on the
    // weigh-up sheet.
    for (const rid of [recipe.id, ...subRecipeIds]) {
      const comp = ensureComp(rid);
      for (const usage of ingredientUsageFor(rid)) {
        const ingredient = getIngredient(usage.ingredientId);
        const prep = componentPrepWork(usage.prepWorkOverride, ingredient);
        const prepTags = orderWorkTypes(
          Array.from(new Set(prep.map(p => p.workType))),
        );
        const existing = comp.ingredients.find(i => i.ingredientId === usage.ingredientId);
        if (existing) {
          existing.totalQty += usage.quantityPerUnit * planned;
          for (const t of prepTags) if (!existing.prepTags.includes(t)) existing.prepTags.push(t);
          existing.prepTags = orderWorkTypes(existing.prepTags);
        } else {
          comp.ingredients.push({
            ingredientId: usage.ingredientId,
            name: ingredient?.name ?? usage.ingredientId,
            totalQty: usage.quantityPerUnit * planned,
            unit: usage.unit,
            prepTags,
          });
        }
      }
    }

    // ── Tasks (workflow stages) ─────────────────────────────────────────
    const addStages = (rid: RecipeId, workflowId: string | undefined) => {
      if (!workflowId) return;
      const wf = getWorkflow(workflowId);
      if (!wf) return;
      const comp = ensureComp(rid);
      for (const stage of wf.stages) {
        const wt = stageWorkType(stage);
        const reqEq = stage.requiresEquipment ?? [];
        comp.tasks.push({
          stageId: stage.id,
          label: stage.label,
          workType: wt,
          benchName: benchForStage(wt, reqEq, benches, primaryBench),
          equipment: reqEq,
          durationMinutes: stage.durationMinutes ?? 0,
        });
      }
    };
    addStages(recipe.id, recipe.workflowId);
    for (const sub of recipe.subRecipes ?? []) {
      const subRec = getRecipe(sub.recipeId);
      addStages(sub.recipeId, subRec?.workflowId);
    }

    // Sort rows within each component for a stable, readable sheet.
    for (const comp of compMap.values()) {
      comp.ingredients.sort((a, b) => b.totalQty - a.totalQty);
      comp.tasks.sort((a, b) => {
        const oa = WORK_TYPE_ORDER.indexOf(a.workType);
        const ob = WORK_TYPE_ORDER.indexOf(b.workType);
        if (oa !== ob) return oa - ob;
        return a.label.localeCompare(b.label);
      });
    }

    const components = componentOrder.map(rid => compMap.get(rid)!);
    groups.push({
      recipeId: recipe.id,
      recipeName: recipe.name,
      category: recipe.category,
      plannedUnits: planned,
      itemId: line.item.id,
      primaryBenchName: primaryBench?.name,
      components,
      hasIngredients: components.some(c => c.ingredients.length > 0),
      hasTasks: components.some(c => c.tasks.length > 0),
    });
  }

  groups.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.recipeName.localeCompare(b.recipeName);
  });
  return groups;
}

// ─────────────────────────────────────────────────────────────────────────────
// View
// ─────────────────────────────────────────────────────────────────────────────

export default function RunSheetView({
  siteId,
  date,
}: {
  siteId: SiteId;
  date: string;
}) {
  const plan = usePlan(siteId, date);
  const [view, setView] = useState<ViewMode>('ingredients');

  const benches = useMemo(
    () => benchesAt(siteId).filter(b => b.online),
    [siteId],
  );
  const groups = useMemo(() => buildRecipeGroups(plan, benches), [plan, benches]);

  const ingredientGroups = groups.filter(g => g.hasIngredients);
  const taskGroups = groups.filter(g => g.hasTasks);
  const visibleGroups = view === 'ingredients' ? ingredientGroups : taskGroups;

  const totalRecipes = groups.length;
  const totalSubRecipes = groups.reduce(
    (a, g) => a + g.components.filter(c => c.isSubRecipe).length,
    0,
  );

  const handlePrint = () => {
    const siteName = getSite(siteId)?.name ?? siteId;
    printRunSheet(view, visibleGroups, date, siteName);
  };

  if (totalRecipes === 0) {
    return (
      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <StepperLauncher siteId={siteId} date={date} variant="ghost" />
        </div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Nothing planned for {date} yet — once a plan exists for this day it
          will appear here broken down by recipe and sub-recipe.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 24px 48px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Compact toolbar — switcher + summary on the left, actions right.
          Merged into a single sticky bar to keep vertical space tight. */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          padding: '10px 14px',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        <ViewSwitcher
          view={view}
          onChange={setView}
          ingredientCount={ingredientGroups.length}
          taskCount={taskGroups.length}
        />
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-primary)' }}>
          {visibleGroups.length} recipe{visibleGroups.length === 1 ? '' : 's'}
          {totalSubRecipes > 0 && (
            <> · {totalSubRecipes} sub-recipe{totalSubRecipes === 1 ? '' : 's'}</>
          )}
          {view === 'ingredients' ? ' · weigh-up quantities' : ' · benches & assignment'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
            title={`Print the ${view === 'ingredients' ? 'ingredients & quantities' : 'task assignment'} sheet`}
          >
            <Printer size={15} />
            Print
          </button>
          <StepperLauncher siteId={siteId} date={date} variant="ghost" />
        </div>
      </div>

      {/* Recipe cards tile into columns on wide screens to cut scrolling. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))',
          gap: 12,
          alignItems: 'start',
        }}
      >
        {visibleGroups.map(group => (
          <RecipeCard key={group.recipeId + group.itemId} group={group} view={view} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// View switcher (segmented control)
// ─────────────────────────────────────────────────────────────────────────────

function ViewSwitcher({
  view,
  onChange,
  ingredientCount,
  taskCount,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
  ingredientCount: number;
  taskCount: number;
}) {
  const tabs: Array<{ id: ViewMode; label: string; count: number }> = [
    { id: 'ingredients', label: 'Ingredients & quantities', count: ingredientCount },
    { id: 'tasks', label: 'Task assignment', count: taskCount },
  ];
  return (
    <div
      role="tablist"
      aria-label="Run sheet view"
      style={{
        display: 'flex',
        background: 'var(--color-bg-hover)',
        borderRadius: '100px',
        padding: '3px',
        width: 'fit-content',
      }}
    >
      {tabs.map(tab => {
        const active = tab.id === view;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              padding: '8px 18px',
              borderRadius: '100px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              background: active ? 'var(--color-accent-active)' : 'transparent',
              color: active ? '#fff' : 'var(--color-text-secondary)',
              transition: 'all 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {tab.label}
            <ViewTabBadge count={tab.count} active={active} />
          </button>
        );
      })}
    </div>
  );
}

/** Count badge matching the standard production tab badge (see
 *  `AmountsView` mode tabs). */
function ViewTabBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '18px',
        height: '18px',
        padding: '0 5px',
        borderRadius: '100px',
        fontSize: '12px',
        fontWeight: 700,
        background: active ? 'rgba(255,255,255,0.25)' : 'var(--color-border-subtle)',
        color: active ? '#fff' : 'var(--color-text-secondary)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {count}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Work-type tag — colored chip for "what should happen"
// ─────────────────────────────────────────────────────────────────────────────

function WorkTag({ workType }: { workType: WorkType }) {
  const tone = WORK_TYPE_COLORS[workType];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 100,
        background: tone.bg,
        color: tone.color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.02em',
        fontFamily: 'var(--font-primary)',
        whiteSpace: 'nowrap',
        lineHeight: 1.3,
      }}
      title={`${WORK_TYPE_LABELS[workType]} — what should happen to this ingredient`}
    >
      {WORK_TYPE_LABELS[workType]}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recipe card — shared shell for both views
// ─────────────────────────────────────────────────────────────────────────────

function RecipeCard({ group, view }: { group: RecipeGroup; view: ViewMode }) {
  const components = group.components.filter(c =>
    view === 'ingredients' ? c.ingredients.length > 0 : c.tasks.length > 0,
  );
  const showComponentLabels = components.length > 1;

  return (
    <section
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          padding: '9px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-hover)',
          borderTopLeftRadius: 'var(--radius-card)',
          borderTopRightRadius: 'var(--radius-card)',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          {group.recipeName}
        </h2>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {group.category}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 4,
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-primary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          ×{group.plannedUnits.toLocaleString('en-GB')}
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            units
          </span>
        </span>
        {view === 'tasks' && group.primaryBenchName && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-primary)',
            }}
          >
            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Routed to </span>
            <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{group.primaryBenchName}</span>
          </span>
        )}
      </header>

      {view === 'tasks' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.7fr) 54px minmax(0, 1fr) minmax(0, 1fr)',
            gap: 10,
            padding: '4px 14px',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          {['Task', 'Units', 'Bench', 'Who'].map((h, i) => (
            <span
              key={h}
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                textAlign: i === 1 ? 'right' : 'left',
              }}
            >
              {h}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {components.map((comp, ci) => (
          <div key={comp.recipeId}>
            {showComponentLabels && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 14px',
                  background: 'rgba(0, 28, 53, 0.03)',
                  borderTop: ci === 0 ? 'none' : '1px solid var(--color-border-subtle)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
              >
                {comp.isSubRecipe ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--color-accent-mid)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <Layers size={11} />
                    Sub-recipe
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Base recipe
                  </span>
                )}
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {comp.name}
                </span>
              </div>
            )}

            {view === 'ingredients'
              ? comp.ingredients.map((ing, i) => (
                  <IngredientRowView
                    key={ing.ingredientId}
                    row={ing}
                    isLast={ci === components.length - 1 && i === comp.ingredients.length - 1}
                  />
                ))
              : comp.tasks.map((task, i) => (
                  <TaskRowView
                    key={task.stageId + i}
                    row={task}
                    units={group.plannedUnits}
                    isLast={ci === components.length - 1 && i === comp.tasks.length - 1}
                  />
                ))}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingredient row — name + tags on the left, quantity on the right
// ─────────────────────────────────────────────────────────────────────────────

function IngredientRowView({ row, isLast }: { row: IngredientLine; isLast: boolean }) {
  return (
    <div
      role="listitem"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 130px',
        gap: 12,
        alignItems: 'center',
        padding: '6px 14px',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
      }}
    >
      <div style={{ minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          {row.name}
        </span>
        {row.prepTags.length > 0 ? (
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
            {row.prepTags.map(t => (
              <WorkTag key={t} workType={t} />
            ))}
          </span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            No prep
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 4 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'var(--font-primary)',
            lineHeight: 1.1,
          }}
        >
          {formatQty(row.totalQty, row.unit)}
        </span>
        {row.unit === 'unit' && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            units
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Task row — task + tag, units, bench, who
// ─────────────────────────────────────────────────────────────────────────────

function TaskRowView({ row, units, isLast }: { row: TaskLine; units: number; isLast: boolean }) {
  return (
    <div
      role="listitem"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.7fr) 54px minmax(0, 1fr) minmax(0, 1fr)',
        gap: 10,
        alignItems: 'center',
        padding: '6px 14px',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
      }}
    >
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          {row.label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <WorkTag workType={row.workType} />
          {row.durationMinutes > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-text-secondary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <Clock size={10} />~{formatDuration(row.durationMinutes)}
            </span>
          )}
          {row.equipment.length > 0 && (
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)' }}>
              · {row.equipment.map(e => EQUIPMENT_LABELS[e]).join(', ')}
            </span>
          )}
        </div>
      </div>

      <span
        style={{
          textAlign: 'right',
          fontSize: 14,
          fontWeight: 800,
          color: 'var(--color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'var(--font-primary)',
        }}
      >
        {units.toLocaleString('en-GB')}
      </span>

      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: row.benchName === 'Not routed' ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={`Bench · ${row.benchName}`}
      >
        {row.benchName}
      </span>

      <span
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          borderBottom: '1px dashed var(--color-border-subtle)',
          paddingBottom: 1,
          minHeight: 16,
        }}
        title="Assign a person on the printed sheet"
      >
        Unassigned
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Print — opens a popup with a clean A4 sheet of the active view
// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function printRunSheet(view: ViewMode, groups: RecipeGroup[], date: string, siteName: string) {
  if (typeof window === 'undefined') return;
  const html = buildPrintHTML(view, groups, date, siteName);
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) {
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.location.assign(blobUrl);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onload = () => {
    w.focus();
    setTimeout(() => {
      w.print();
      w.onafterprint = () => w.close();
    }, 60);
  };
}

function buildPrintHTML(view: ViewMode, groups: RecipeGroup[], date: string, siteName: string): string {
  const title = view === 'ingredients' ? 'Ingredients & quantities' : 'Task assignment';
  const printedAt = new Date().toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const sections = groups
    .map(group => {
      const comps = group.components.filter(c =>
        view === 'ingredients' ? c.ingredients.length > 0 : c.tasks.length > 0,
      );
      const showLabels = comps.length > 1;
      const compBlocks = comps
        .map(comp => {
          const labelRow = showLabels
            ? `<tr class="comp-row"><td colspan="${view === 'ingredients' ? 3 : 4}">${
                comp.isSubRecipe ? 'Sub-recipe · ' : 'Base recipe · '
              }${escapeHtml(comp.name)}</td></tr>`
            : '';
          if (view === 'ingredients') {
            const rows = comp.ingredients
              .map(
                ing => `<tr>
                  <td class="name">${escapeHtml(ing.name)}</td>
                  <td class="tags">${
                    ing.prepTags.length
                      ? ing.prepTags.map(t => `<span class="tag">${escapeHtml(WORK_TYPE_LABELS[t])}</span>`).join(' ')
                      : '<span class="muted">No prep</span>'
                  }</td>
                  <td class="qty">${escapeHtml(formatQty(ing.totalQty, ing.unit))}</td>
                </tr>`,
              )
              .join('');
            return labelRow + rows;
          }
          const rows = comp.tasks
            .map(
              task => `<tr>
                <td class="name">${escapeHtml(task.label)} <span class="tag">${escapeHtml(WORK_TYPE_LABELS[task.workType])}</span></td>
                <td class="qty">${group.plannedUnits.toLocaleString('en-GB')}</td>
                <td class="bench">${escapeHtml(task.benchName)}</td>
                <td class="who"></td>
              </tr>`,
            )
            .join('');
          return labelRow + rows;
        })
        .join('');

      const head =
        view === 'ingredients'
          ? `<thead><tr><th class="c-name">Ingredient</th><th class="c-tags">What to do</th><th class="c-qty">Quantity</th></tr></thead>`
          : `<thead><tr><th class="c-name">Task</th><th class="c-qty">Units</th><th class="c-bench">Bench</th><th class="c-who">Who</th></tr></thead>`;

      return `<section class="recipe">
        <header class="recipe-head">
          <h2>${escapeHtml(group.recipeName)}</h2>
          <span class="rmeta">${escapeHtml(group.category)} · <strong>×${group.plannedUnits.toLocaleString('en-GB')}</strong> units</span>
        </header>
        <table>${head}<tbody>${compBlocks}</tbody></table>
      </section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Run sheet · ${escapeHtml(title)} · ${escapeHtml(date)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #001C35; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.4; }
    h1, h2 { margin: 0; font-weight: 700; }
    header.page-head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #001C35; padding-bottom: 8px; margin-bottom: 16px; }
    .page-head h1 { font-size: 18pt; letter-spacing: -0.2px; }
    .page-head .meta { text-align: right; font-size: 9pt; color: #6b7280; line-height: 1.5; }
    section.recipe { page-break-inside: avoid; break-inside: avoid; margin-bottom: 18px; }
    .recipe-head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #cbd5e1; padding: 6px 0 4px; margin-bottom: 4px; }
    .recipe-head h2 { font-size: 13pt; }
    .recipe-head .rmeta { font-size: 9.5pt; color: #475569; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    th { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; font-weight: 700; }
    td.name { font-weight: 600; }
    td.qty { text-align: right; font-weight: 700; font-feature-settings: 'tnum'; font-size: 11pt; }
    td.bench { color: #475569; }
    td.who { border-bottom: 1px solid #94a3b8; }
    .c-qty { text-align: right; width: 90px; }
    .c-bench { width: 22%; }
    .c-who { width: 22%; }
    .c-tags { width: 40%; }
    tr.comp-row td { background: #f5f4f2; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; padding: 4px 8px; }
    .tag { display: inline-block; font-size: 8pt; font-weight: 700; color: #4a6cb5; border: 1px solid #d7def0; border-radius: 100px; padding: 1px 7px; margin: 1px 2px 1px 0; }
    .muted { color: #94a3b8; font-style: italic; }
    .footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 8pt; color: #94a3b8; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <header class="page-head">
    <h1>Run sheet · ${escapeHtml(title)}</h1>
    <div class="meta">${escapeHtml(siteName)}<br/>For ${escapeHtml(date)}<br/>Printed ${escapeHtml(printedAt)}</div>
  </header>
  ${sections}
  <div class="footer"><span>${escapeHtml(title)}</span><span>${groups.length} recipes</span></div>
</body>
</html>`;
}

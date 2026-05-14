'use client';

import { useMemo } from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import {
  benchesAt,
  benchWorkTypes,
  benchEquipment,
  recipeIngredientPrep,
  stageWorkType,
  getWorkflow,
  getRecipe,
  dayOffset,
  WORK_TYPE_LABELS,
  WORK_TYPE_ORDER,
  WORK_TYPE_COLORS,
  EQUIPMENT_LABELS,
  type Bench,
  type Equipment,
  type IngredientId,
  type Ingredient,
  type RecipeId,
  type SiteId,
  type WorkType,
} from './fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// Time-of-day windows + per-unit pace per work type
// ─────────────────────────────────────────────────────────────────────────────
//
// The Run sheet's job is to choreograph a kitchen day, so each section and
// row needs a sense of "when". We derive both from light-touch defaults
// rather than from scheduled stage times because the prototype's plan
// data isn't yet rich enough to drive real timestamps. These can be
// pushed into fixtures later if recipes start carrying authored start
// times.
//
// `WORK_TYPE_WINDOWS` is keyed by `(workType, leadOffset)` because the
// same work behaves very differently across days — e.g. `weigh-up` on
// today is a 05:30 task; `weigh-up` for tomorrow happens on the
// previous evening's close-down shift.
//
// `WORK_TYPE_PACE` is minutes-per-canonical-unit (g / ml / unit). It's
// deliberately conservative — better to slightly over-budget on the
// run sheet than under-promise.

type DayWindow = { from: string; to: string; label: string };

const TODAY_WINDOWS: Record<WorkType, DayWindow> = {
  'weigh-up':  { from: '05:30', to: '06:30', label: 'Open shift'    },
  'thaw':      { from: '00:00', to: '06:00', label: 'Overnight'     },
  'mise':      { from: '05:30', to: '07:00', label: 'Open shift'    },
  'wash':      { from: '06:00', to: '07:30', label: 'Open shift'    },
  'sanitise':  { from: '06:00', to: '07:30', label: 'Open shift'    },
  'slice':     { from: '06:30', to: '08:00', label: 'Open shift'    },
  'mix':       { from: '06:00', to: '07:30', label: 'Open shift'    },
  'proof':     { from: '20:00', to: '06:00', label: 'Overnight'     },
  'bake':      { from: '05:30', to: '11:00', label: 'Bake-through'  },
  'grill':     { from: '06:00', to: '11:00', label: 'Hot prep'      },
  'chill':     { from: '07:00', to: '09:00', label: 'After bake'    },
  'assemble':  { from: '07:00', to: '10:30', label: 'Build window'  },
  'portion':   { from: '07:00', to: '10:30', label: 'Build window'  },
  'label':     { from: '08:00', to: '11:00', label: 'Build window'  },
  'pack':      { from: '08:00', to: '11:00', label: 'Build window'  },
  'wash-down': { from: '20:00', to: '22:00', label: 'Close-down'    },
};

/** Window when prep-ahead work for tomorrow happens — typically the
 *  previous evening / close-down shift. */
const PREV_EVENING_WINDOW: DayWindow = {
  from: '20:00', to: '23:00', label: 'Tonight (close-down)',
};

function windowFor(workType: WorkType, leadOffset: -2 | -1 | 0): DayWindow {
  if (leadOffset === 0) return TODAY_WINDOWS[workType];
  // For prep-ahead work (-1 / -2) we prefer "tonight" framing — these
  // tasks happen on the previous shift's close-down regardless of
  // their natural daytime window.
  return PREV_EVENING_WINDOW;
}

/** Minutes per canonical unit (g / ml / unit). */
const WORK_TYPE_PACE: Partial<Record<WorkType, number>> = {
  'weigh-up': 0.02,   // ~2 min per 100g
  'thaw':     0.005,  // passive, but accounts for mises checking trays
  'mise':     0.05,
  'wash':     0.005,  // ~30s per 100g of leaves
  'sanitise': 0.4,    // per produce unit
  'slice':    0.4,    // per produce unit
  'mix':      0.04,
};

/** Minimum minutes shown on a row — a "blip" task still costs a chunk
 *  of human time (set up / clean down). */
const MIN_ROW_MINUTES = 3;

function ingredientRowMinutes(workType: WorkType, totalQty: number): number {
  const pace = WORK_TYPE_PACE[workType];
  if (pace == null) return MIN_ROW_MINUTES;
  return Math.max(MIN_ROW_MINUTES, Math.round(pace * totalQty));
}

function formatDuration(mins: number): string {
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
import { usePlan, type PlanLine } from './PlanStore';
import WorkTypeChip from './WorkTypeChip';
import StepperLauncher from './StepperLauncher';

/**
 * Run sheet — pivots the day's planned work by `WorkType` instead of by
 * recipe or bench. Two flavours of row appear under each work-type
 * section:
 *
 *   1. **Aggregated ingredient prep** — for ingredient-shaped work
 *      (Slice tomatoes, Sanitise lettuce, Weigh-up chicken) we group
 *      by `(ingredientId, workType, leadOffset)` across every recipe
 *      consuming that ingredient. Five sandwiches that all need tomato
 *      sliced today collapse to a single "Slice tomatoes — 17 (Club +5,
 *      BLT +7, Caprese +5)" row.
 *
 *   2. **Per-recipe stage work** — for recipe-shaped work (bake,
 *      assemble, pack, etc.) we keep one row per recipe so the team
 *      knows what they're cooking / assembling / packing.
 *
 * Cross-day pivot: today's view also includes prep-ahead work for
 * tomorrow (`leadOffset: -1`) and the day after (`leadOffset: -2`), so
 * the night-shift weighing for tomorrow's chicken sandwiches lands in
 * today's Weigh-up section labelled "for tomorrow".
 */
export default function RunSheetView({
  siteId,
  date,
}: {
  siteId: SiteId;
  date: string;
}) {
  // We need three days of plan to materialise today's same-day work plus
  // tomorrow's leadOffset=-1 work plus day-after's leadOffset=-2 work.
  // `usePlan` hooks must be called unconditionally at the top level.
  const planToday = usePlan(siteId, date);
  const planTomorrow = usePlan(siteId, dayOffset(1, date));
  const planDayAfter = usePlan(siteId, dayOffset(2, date));

  const sections = useMemo(
    () => buildSections([
      { date, plan: planToday, runOnLeadOffset: 0 },
      { date: dayOffset(1, date), plan: planTomorrow, runOnLeadOffset: -1 },
      { date: dayOffset(2, date), plan: planDayAfter, runOnLeadOffset: -2 },
    ]),
    [date, planToday, planTomorrow, planDayAfter],
  );

  // Suggested benches per work type — derived from `benchWorkTypes` (and
  // intersected with any equipment requirements that show up in the
  // section).
  const benchesByWorkType = useMemo(() => {
    const benches = benchesAt(siteId).filter(b => b.online);
    const map = new Map<WorkType, Bench[]>();
    for (const wt of WORK_TYPE_ORDER) {
      map.set(wt, benches.filter(b => benchWorkTypes(b).includes(wt)));
    }
    return map;
  }, [siteId]);

  const presentWorkTypes = WORK_TYPE_ORDER.filter(
    wt => (sections.byWorkType.get(wt)?.totalRows() ?? 0) > 0,
  );

  if (presentWorkTypes.length === 0) {
    return (
      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <StepperLauncher siteId={siteId} date={date} variant="ghost" />
        </div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Nothing planned for {date} yet — once a plan exists for this day it
          will appear here grouped by stage.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px 64px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Run-sheet toolbar — single-action right now so the launcher
          sits on its own row, aligned with the rest of the run sheet's
          left margin. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <StepperLauncher siteId={siteId} date={date} variant="ghost" />
      </div>
      <DayShapeHeader
        sections={sections}
        presentWorkTypes={presentWorkTypes}
        date={date}
      />

      {presentWorkTypes.map(wt => (
        <StageCard
          key={wt}
          workType={wt}
          section={sections.byWorkType.get(wt)!}
          benches={pickBenchesForSection(
            benchesByWorkType.get(wt) ?? [],
            sections.byWorkType.get(wt)!.equipmentNeeded,
          )}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation
// ─────────────────────────────────────────────────────────────────────────────

/** A single aggregated row for an ingredient-shaped piece of prep work. */
type IngredientRow = {
  kind: 'ingredient';
  key: string;                 // `${ingredientId}|${workType}|${leadOffset}`
  ingredientId: IngredientId;
  ingredient: Ingredient | undefined;
  workType: WorkType;
  /** -2/-1/0 — controls the "for tomorrow / for two days out" label. */
  leadOffset: -2 | -1 | 0;
  /** Total quantity across all sources, in the ingredient's canonical unit. */
  totalQty: number;
  unit: 'g' | 'ml' | 'unit';
  /** Estimated hands-on time for the aggregated quantity, derived from
   *  `WORK_TYPE_PACE`. Computed lazily after totalQty is known. */
  estimatedMinutes: number;
  /** Per-recipe contributions — how much of this prep comes from each
   *  recipe's planned units. Sorted by contribution descending. */
  sources: Array<{
    sourceRecipeId: RecipeId;
    sourceRecipeName: string;
    sourcePlannedUnits: number;
    contributedQty: number;
  }>;
};

/** A per-recipe stage-derived row — one per (recipe, stage) hitting today. */
type StageRow = {
  kind: 'stage';
  key: string;                 // `${recipeId}|${stageId}|${planDate}`
  recipeId: RecipeId;
  recipeName: string;
  category: string;
  workType: WorkType;
  leadOffset: -2 | -1 | 0;
  /** The plan date that drove this row — for "for tomorrow" labelling. */
  planDate: string;
  effectivePlanned: number;
  primaryBenchName: string | undefined;
  itemId: string;              // for deep-linking back to /production/amounts
  requiresEquipment: Equipment[];
  /** Authored stage duration (minutes per batch). Falls back to the
   *  per-work-type `MIN_ROW_MINUTES` if the stage doesn't carry one. */
  estimatedMinutes: number;
};

type RunSheetRow = IngredientRow | StageRow;

type SectionData = {
  ingredientRows: IngredientRow[];
  stageRows: StageRow[];
  /** Set of equipment any row in this section needs — used to filter
   *  the suggested-benches list down to actually-eligible benches. */
  equipmentNeeded: Set<Equipment>;
  totalRows: () => number;
  totalUnits: () => number;
  /** Sum of all rows' `estimatedMinutes` — drives the "team time ~Xh"
   *  badge in the section header so the kitchen can plan staffing. */
  totalMinutes: () => number;
};

type Sections = {
  byWorkType: Map<WorkType, SectionData>;
  totalAggregatedTasks: number;
  totalRecipeStageRows: number;
  totalUnits: number;
  /** True when at least one row has leadOffset != 0 — drives the
   *  "shifted in time" callout in the header. */
  hasCrossDayWork: boolean;
};

function buildSections(
  inputs: Array<{ date: string; plan: PlanLine[]; runOnLeadOffset: -2 | -1 | 0 }>,
): Sections {
  const byWorkType = new Map<WorkType, SectionData>();
  function ensure(wt: WorkType): SectionData {
    let s = byWorkType.get(wt);
    if (!s) {
      s = {
        ingredientRows: [],
        stageRows: [],
        equipmentNeeded: new Set<Equipment>(),
        totalRows: () => (s!.ingredientRows.length + s!.stageRows.length),
        totalUnits: () => (
          s!.ingredientRows.reduce((a, r) => a + r.totalQty, 0)
          + s!.stageRows.reduce((a, r) => a + r.effectivePlanned, 0)
        ),
        totalMinutes: () => (
          s!.ingredientRows.reduce((a, r) => a + r.estimatedMinutes, 0)
          + s!.stageRows.reduce((a, r) => a + r.estimatedMinutes, 0)
        ),
      };
      byWorkType.set(wt, s);
    }
    return s;
  }

  // Bucket ingredient rows by (ingredientId, workType, leadOffset). The
  // map is per work type so we can collapse cleanly into the section.
  const ingredientBuckets = new Map<WorkType, Map<string, IngredientRow>>();

  let hasCrossDayWork = false;

  for (const { date: planDate, plan, runOnLeadOffset } of inputs) {
    for (const line of plan) {
      if (line.effectivePlanned <= 0) continue;
      const recipe = line.recipe;

      // ── Stage-derived rows ──────────────────────────────────────────
      // Walk the recipe's own workflow + sub-recipe workflows. A stage
      // contributes a row to today only if its leadOffset matches the
      // offset at which this plan date sits relative to today.
      const visitedWorkflows = new Set<string>();
      const allWorkflowIds: string[] = [];
      if (recipe.workflowId) allWorkflowIds.push(recipe.workflowId);
      for (const sub of recipe.subRecipes ?? []) {
        const subRec = getRecipe(sub.recipeId);
        if (subRec?.workflowId) allWorkflowIds.push(subRec.workflowId);
      }
      for (const wfId of allWorkflowIds) {
        if (visitedWorkflows.has(wfId)) continue;
        visitedWorkflows.add(wfId);
        const wf = getWorkflow(wfId);
        if (!wf) continue;
        for (const stage of wf.stages) {
          if (stage.leadOffset !== runOnLeadOffset) continue;
          const wt = stageWorkType(stage);
          if (runOnLeadOffset !== 0) hasCrossDayWork = true;
          const section = ensure(wt);
          const reqEq = stage.requiresEquipment ?? [];
          for (const eq of reqEq) section.equipmentNeeded.add(eq);
          section.stageRows.push({
            kind: 'stage',
            key: `${recipe.id}|${stage.id}|${planDate}`,
            recipeId: recipe.id,
            recipeName: recipe.name,
            category: recipe.category,
            workType: wt,
            leadOffset: stage.leadOffset,
            planDate,
            effectivePlanned: line.effectivePlanned,
            primaryBenchName: line.primaryBench?.name,
            itemId: line.item.id,
            requiresEquipment: reqEq,
            estimatedMinutes: Math.max(MIN_ROW_MINUTES, stage.durationMinutes ?? 0),
          });
        }
      }

      // ── Aggregated ingredient prep ──────────────────────────────────
      // Walk every consumed ingredient's effective prep work (master
      // defaults + overrides resolved by `recipeIngredientPrep`). Each
      // entry contributes `quantityPerUnit × effectivePlanned` to the
      // shared bucket for (ingredientId, workType, leadOffset).
      const ingredientPrep = recipeIngredientPrep(recipe);
      for (const entry of ingredientPrep) {
        const lo = (entry.prep.leadOffset ?? 0) as -2 | -1 | 0;
        if (lo !== runOnLeadOffset) continue;
        if (lo !== 0) hasCrossDayWork = true;
        const wt = entry.prep.workType;
        const section = ensure(wt);
        let bucketsForWt = ingredientBuckets.get(wt);
        if (!bucketsForWt) {
          bucketsForWt = new Map();
          ingredientBuckets.set(wt, bucketsForWt);
        }
        const bucketKey = `${entry.ingredientId}|${wt}|${lo}`;
        let bucket = bucketsForWt.get(bucketKey);
        if (!bucket) {
          bucket = {
            kind: 'ingredient',
            key: bucketKey,
            ingredientId: entry.ingredientId,
            ingredient: entry.ingredient,
            workType: wt,
            leadOffset: lo,
            totalQty: 0,
            unit: entry.unit,
            estimatedMinutes: 0,
            sources: [],
          };
          bucketsForWt.set(bucketKey, bucket);
          section.ingredientRows.push(bucket);
        }
        const contributed = entry.quantityPerUnit * line.effectivePlanned;
        bucket.totalQty += contributed;
        // Source attribution — combine same-recipe entries so a recipe
        // with multiple usages of the same ingredient (rare) folds.
        const existingSrc = bucket.sources.find(s => s.sourceRecipeId === recipe.id);
        if (existingSrc) {
          existingSrc.contributedQty += contributed;
        } else {
          bucket.sources.push({
            sourceRecipeId: recipe.id,
            sourceRecipeName: recipe.name,
            sourcePlannedUnits: line.effectivePlanned,
            contributedQty: contributed,
          });
        }
      }
    }
  }

  // Sort sources within each ingredient bucket; sort stage rows within
  // each section by category then name; sort ingredient rows by total
  // qty desc so the biggest mise-en-place tasks lead the section.
  // Also finalise the per-row time estimate now that totals are known.
  for (const section of byWorkType.values()) {
    for (const row of section.ingredientRows) {
      row.sources.sort((a, b) => b.contributedQty - a.contributedQty);
      row.estimatedMinutes = ingredientRowMinutes(row.workType, row.totalQty);
    }
    section.ingredientRows.sort((a, b) => b.totalQty - a.totalQty);
    section.stageRows.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.recipeName.localeCompare(b.recipeName);
    });
  }

  let totalAggregatedTasks = 0;
  let totalRecipeStageRows = 0;
  let totalUnits = 0;
  for (const section of byWorkType.values()) {
    totalAggregatedTasks += section.ingredientRows.length;
    totalRecipeStageRows += section.stageRows.length;
    totalUnits += section.totalUnits();
  }

  return {
    byWorkType,
    totalAggregatedTasks,
    totalRecipeStageRows,
    totalUnits,
    hasCrossDayWork,
  };
}

function pickBenchesForSection(benches: Bench[], equipmentNeeded: Set<Equipment>): Bench[] {
  if (equipmentNeeded.size === 0) return benches;
  const needed = Array.from(equipmentNeeded);
  return benches.filter((b) => {
    const eq = benchEquipment(b);
    return needed.every((e) => eq.includes(e));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Day-shape header
// ─────────────────────────────────────────────────────────────────────────────

function DayShapeHeader({
  sections,
  presentWorkTypes,
  date,
}: {
  sections: Sections;
  presentWorkTypes: WorkType[];
  date: string;
}) {
  const totalMinutes = presentWorkTypes.reduce(
    (a, wt) => a + (sections.byWorkType.get(wt)?.totalMinutes() ?? 0),
    0,
  );
  return (
    <header
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          Day plan by stage
        </h1>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {presentWorkTypes.length} stage{presentWorkTypes.length === 1 ? '' : 's'} ·{' '}
          {sections.totalAggregatedTasks.toLocaleString('en-GB')} mise tasks ·{' '}
          {sections.totalRecipeStageRows.toLocaleString('en-GB')} recipe stages
        </span>
        {totalMinutes > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-primary)',
              fontVariantNumeric: 'tabular-nums',
              padding: '4px 10px',
              borderRadius: 100,
              background: 'var(--color-bg-hover)',
              whiteSpace: 'nowrap',
            }}
            title="Total estimated hands-on time across every section today"
          >
            <Clock size={12} color="var(--color-text-muted)" />
            ~{formatDuration(totalMinutes)} hands-on
          </span>
        )}
        {sections.hasCrossDayWork && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--color-warning)',
              background: 'rgba(241,180,52,0.16)',
              padding: '4px 9px',
              borderRadius: 100,
              fontFamily: 'var(--font-primary)',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
            title={`Today (${date}) includes prep-ahead work for tomorrow and the day after`}
          >
            Includes prep-ahead work
          </span>
        )}
      </div>

      <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {presentWorkTypes.map(wt => {
          const section = sections.byWorkType.get(wt)!;
          const total = section.totalRows();
          return (
            <a
              key={wt}
              href={`#stage-${wt}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 100,
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-subtle)',
                textDecoration: 'none',
                fontFamily: 'var(--font-primary)',
              }}
            >
              <WorkTypeChip workType={wt} size="xs" />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                {total} task{total === 1 ? '' : 's'}
              </span>
            </a>
          );
        })}
      </nav>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage card — one section per WorkType, with two flavoured row groups
// ─────────────────────────────────────────────────────────────────────────────

function StageCard({
  workType,
  section,
  benches,
}: {
  workType: WorkType;
  section: SectionData;
  benches: Bench[];
}) {
  const tone = WORK_TYPE_COLORS[workType];
  const ingredientCount = section.ingredientRows.length;
  const stageCount = section.stageRows.length;
  const allRows: RunSheetRow[] = [
    ...section.ingredientRows,
    ...section.stageRows,
  ];
  const equipmentList = Array.from(section.equipmentNeeded);
  const totalMinutes = section.totalMinutes();
  // If every row in this section is prep-ahead (-1/-2) the work happens
  // on the previous evening's close-down rather than today's morning
  // window. We pick the lead-offset of the *first* row (rows are
  // homogenous within a section in practice — sections shift together).
  const dominantLeadOffset = allRows[0]
    ? (allRows[0].kind === 'ingredient' ? allRows[0].leadOffset : allRows[0].leadOffset)
    : 0;
  const timeWindow = windowFor(workType, dominantLeadOffset);
  return (
    <section
      id={`stage-${workType}`}
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderLeft: `4px solid ${tone.color}`,
        borderRadius: 'var(--radius-card)',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        scrollMarginTop: 130,
      }}
    >
      <header
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: tone.bg,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
            letterSpacing: '0.01em',
          }}
        >
          {WORK_TYPE_LABELS[workType]}
        </h2>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
          {ingredientCount > 0 && (
            <>
              {ingredientCount} mise task{ingredientCount === 1 ? '' : 's'}
              {stageCount > 0 && ' · '}
            </>
          )}
          {stageCount > 0 && (
            <>{stageCount} recipe stage{stageCount === 1 ? '' : 's'}</>
          )}
        </span>

        {/* Time-of-day window for this section — derived from
            `windowFor(workType, leadOffset)`. Pulls double duty as a
            scheduling cue ("do between 06:30 and 08:00") and as a
            phase label ("Open shift", "Close-down"). */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 100,
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            fontSize: 11,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-secondary)',
            whiteSpace: 'nowrap',
          }}
          title={`Suggested time window for ${WORK_TYPE_LABELS[workType].toLowerCase()} work — based on Pret kitchen norms`}
        >
          <Clock size={12} color="var(--color-text-muted)" />
          <span style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {timeWindow.from}–{timeWindow.to}
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>·</span>
          <span style={{ fontWeight: 600 }}>{timeWindow.label}</span>
        </span>

        {/* Section team-time roll-up — sum of every row's
            estimated minutes. Helps a chef budget staff. */}
        {totalMinutes > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-primary)',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
            title="Sum of every row's estimated hands-on time in this section"
          >
            ~{formatDuration(totalMinutes)} hands-on
          </span>
        )}

        {equipmentList.length > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              flexWrap: 'wrap',
              fontSize: 10.5,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-primary)',
            }}
            title="Equipment required by stages in this section"
          >
            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
              Equipment
            </span>
            {equipmentList.map((eq) => (
              <span
                key={eq}
                style={{
                  padding: '2px 7px',
                  borderRadius: 100,
                  background: '#fff',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: 'var(--color-text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {EQUIPMENT_LABELS[eq]}
              </span>
            ))}
          </span>
        )}

        {benches.length > 0 && (
          <span
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-primary)',
              flexWrap: 'wrap',
            }}
            title={
              equipmentList.length > 0
                ? 'Benches at this site that can handle this work AND have the required equipment'
                : 'Benches at this site that can handle this kind of work'
            }
          >
            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Benches
            </span>
            <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              {benches.map(b => b.name).join(' · ')}
            </span>
          </span>
        )}
      </header>

      <div role="list" style={{ display: 'flex', flexDirection: 'column' }}>
        {allRows.map((row, i) => (
          <RunSheetRowView
            key={row.key}
            row={row}
            isLast={i === allRows.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function RunSheetRowView({ row, isLast }: { row: RunSheetRow; isLast: boolean }) {
  if (row.kind === 'ingredient') {
    return <IngredientRowView row={row} isLast={isLast} />;
  }
  return <StageRowView row={row} isLast={isLast} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregated ingredient row — "Slice tomatoes — 17 (Club +5, BLT +7)"
// ─────────────────────────────────────────────────────────────────────────────

function IngredientRowView({ row, isLast }: { row: IngredientRow; isLast: boolean }) {
  const ingredientName = row.ingredient?.name ?? row.ingredientId;
  const sourceCount = row.sources.length;
  const forLabel = row.leadOffset === 0
    ? null
    : row.leadOffset === -1
      ? 'For tomorrow'
      : 'For 2 days out';

  return (
    <div
      role="listitem"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2.4fr) 110px minmax(0, 2fr)',
        gap: 14,
        alignItems: 'center',
        padding: '12px 20px',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
        background: '#ffffff',
      }}
    >
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {ingredientName}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-accent-mid)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
            title={`Aggregated across ${sourceCount} recipe${sourceCount === 1 ? '' : 's'}`}
          >
            Mise · across {sourceCount} recipe{sourceCount === 1 ? '' : 's'}
          </span>
          <DurationPill minutes={row.estimatedMinutes} />
          {forLabel && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-warning)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
              title="Prep-ahead — done now for a future day's plan"
            >
              · {forLabel}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
        <span
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'var(--font-primary)',
            lineHeight: 1.1,
          }}
        >
          {formatQty(row.totalQty, row.unit)}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          total {row.unit === 'unit' ? 'units' : row.unit}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          For
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.4,
          }}
        >
          {row.sources
            .slice(0, 4)
            .map((s) => `${s.sourceRecipeName} +${formatQty(s.contributedQty, row.unit)}`)
            .join(', ')}
          {row.sources.length > 4 && ` +${row.sources.length - 4} more`}
        </span>
      </div>
    </div>
  );
}

function formatQty(q: number, unit: 'g' | 'ml' | 'unit'): string {
  if (unit === 'unit') return Math.round(q).toLocaleString('en-GB');
  // For mass / volume convert to kg/L when large enough.
  if (q >= 1000) {
    const v = q / 1000;
    return `${v.toLocaleString('en-GB', { maximumFractionDigits: 1 })}${unit === 'g' ? 'kg' : 'L'}`;
  }
  return `${Math.round(q).toLocaleString('en-GB')}${unit}`;
}

/** Tiny clock-icon pill used on every Run sheet row to surface the
 *  estimated hands-on minutes. Inline so it sits naturally beside the
 *  category / mise label without wrapping awkwardly. */
function DurationPill({ minutes }: { minutes: number }) {
  if (minutes <= 0) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 100,
        background: 'var(--color-bg-hover)',
        color: 'var(--color-text-secondary)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.02em',
        fontFamily: 'var(--font-primary)',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        lineHeight: 1.1,
      }}
      title="Estimated hands-on time at the suggested kitchen pace"
    >
      <Clock size={10} />
      ~{formatDuration(minutes)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-recipe stage row (kept from the original Run sheet, with a
// "for tomorrow" suffix when leadOffset != 0)
// ─────────────────────────────────────────────────────────────────────────────

function StageRowView({ row, isLast }: { row: StageRow; isLast: boolean }) {
  const todayHref = `/production/amounts#row-${row.itemId}`;
  const forLabel = row.leadOffset === 0
    ? null
    : row.leadOffset === -1
      ? 'For tomorrow'
      : 'For 2 days out';

  return (
    <a
      role="listitem"
      href={todayHref}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2.4fr) 110px minmax(0, 2fr) 24px',
        gap: 14,
        alignItems: 'center',
        padding: '12px 20px',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
        textDecoration: 'none',
        color: 'inherit',
        background: '#ffffff',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; }}
    >
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.recipeName}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {row.category} · Recipe stage
          </span>
          <DurationPill minutes={row.estimatedMinutes} />
          {forLabel && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-warning)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              · {forLabel}
            </span>
          )}
          {row.requiresEquipment.length > 0 && (
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              · {row.requiresEquipment.map((e) => EQUIPMENT_LABELS[e]).join(', ')}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
        <span
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'var(--font-primary)',
            lineHeight: 1.1,
          }}
        >
          {row.effectivePlanned.toLocaleString('en-GB')}
        </span>
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
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, overflow: 'hidden' }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Primary bench
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.primaryBenchName ?? 'Not routed'}
        </span>
      </div>

      <ChevronRight size={14} color="var(--color-text-muted)" />
    </a>
  );
}

/**
 * benchPlanModel — the shared, pure compute layer behind every bench
 * planning surface.
 *
 * Both the bench-detail cards (`BenchCardBoard`) and the per-run Balance
 * view (`BenchBalanceView`) read from these helpers so the two surfaces
 * can never drift on the numbers a manager is trying to balance: the
 * batch split, the estimated bench time, the run bucketing, and the
 * seeded assignees all live here, free of React state.
 *
 * The interactive overrides (reassign a bench, move a recipe to another
 * bench) still live in the card component — this module is the read model
 * those overrides layer on top of.
 */

import {
  effectiveBatchRules,
  getWorkflow,
  isNightShiftHHMM,
  proposeBatchSplit,
  type Bench,
  type NightShiftPolicy,
  type ProductionMode,
  type RunSchedule,
  type Site,
} from './fixtures';
import type { PlanLine } from './PlanStore';

// ─── Window defaults (minutes from midnight) ─────────────────────────────────
// The window is a bench's available production time. Derived from the
// earliest start / latest end of scheduled work on the bench, with a
// generous fallback when a bench has no work.
export const DEFAULT_WINDOW_START_MINS = 5 * 60; // 05:00
export const DEFAULT_WINDOW_END_MINS = 20 * 60; // 20:00

// ─── Stubbed "assigned to" per bench — placeholder until users/roles wire in ──
// Used as the bench-level "lead" or fallback when a specific run doesn't
// have its own assignee (see `RUN_ASSIGNEES_BY_BENCH` below).
export const ASSIGNEE_BY_BENCH: Record<string, string> = {
  // hub-central — 7-bench Pret-style layout
  'bench-bakery': 'Farah K.',
  'bench-prep': 'Amira O.',
  'bench-sandwich-build': 'Wojtek P.',
  'bench-salad-build': 'Bea L.',
  'bench-hot-shelf': 'Marco B.',
  'bench-variable': 'Sofia G.',
  'bench-cold-chain': 'Milan V.',
  // site-standalone-north
  'bench-north-bakery': 'Reza A.',
  'bench-north-prep': 'Priya S.',
  'bench-north-build': 'Olu F.',
  'bench-north-hot-shelf': 'Theo C.',
  // site-hybrid-airport
  'bench-airport-hot-shelf': 'Lisa T.',
  'bench-airport-build': 'Nadia B.',
  'bench-airport-prep': 'Jon F.',
  'bench-airport-cold-chain': 'Hana M.',
};

// Per-run assignees — different people often work R1 (early morning) and
// R2 (mid-morning relief). N1 is the overnight shift and usually continues
// into R1 with the same baker. Anything not seeded here falls back to the
// bench-level lead in `ASSIGNEE_BY_BENCH`.
export const RUN_ASSIGNEES_BY_BENCH: Record<string, Record<string, string>> = {
  // hub-central
  'bench-bakery': { n1: 'Farah K.', r1: 'Farah K.', r2: 'Bea L.' },
  'bench-sandwich-build': { r1: 'Wojtek P.', r2: 'Hana M.' },
  'bench-salad-build': { r1: 'Bea L.', r2: 'Liv R.' },
  // site-standalone-north
  'bench-north-bakery': { n1: 'Reza A.', r1: 'Reza A.', r2: 'Yusuf A.' },
  'bench-north-build': { r1: 'Olu F.', r2: 'Theo C.' },
};

// Sentinel for the "Unassigned" row — empty string means no one.
export const UNASSIGNED = '';

// Roster shown in the assign-to picker. Combines everyone seeded above with
// a few "extras on shift" so the popover always has spare hands to reassign
// work to during a demo.
export const STAFF_ROSTER: string[] = (() => {
  const seeded = Array.from(new Set(Object.values(ASSIGNEE_BY_BENCH)));
  const extras = ['Hana M.', 'Theo C.', 'Yusuf A.', 'Liv R.'];
  const merged = Array.from(new Set([...seeded, ...extras]));
  merged.sort((a, b) => a.localeCompare(b));
  return merged;
})();

// ─── Row / bucket / group shapes ─────────────────────────────────────────────
export type RowData = {
  line: PlanLine;
  /** Batch sizes to be produced for this recipe on this bench. */
  batches: number[];
  totalQty: number;
  /** Estimated bench time for this recipe (minutes). */
  estMinutes: number;
  /** Hub-side off-list units folded into `totalQty` (and the batch split). */
  extrasUnits: number;
  /** Team-food (staff lunch) units folded into `totalQty`. */
  teamFoodUnits: number;
};

/**
 * A single scheduled run on a bench — the concrete R1 / R2 block with its
 * recipes. Only populated for primary run-mode groups on benches that have
 * a `runs` schedule defined.
 */
export type RunBucket = {
  run: RunSchedule;
  rows: RowData[];
  productionMins: number;
  startMins: number;
  endMins: number;
  /** Resolved assignee for this run (override → seeded run → bench lead). */
  assignee: string;
  /** True when this run starts inside the central night-shift window. */
  isNight: boolean;
};

/**
 * A "run group" on a bench: recipes sharing a production mode, with their
 * own time window and subtotal.
 */
export type ModeGroup = {
  mode: ProductionMode;
  label: string;
  isPrimary: boolean;
  rows: RowData[];
  productionMins: number;
  windowStartMins: number;
  windowEndMins: number;
  throughoutDay: boolean;
  runBuckets?: RunBucket[];
};

/** Function shape for the hub off-list extras lookup (from `useHubExtras`). */
export type GetExtras = (siteId: string, skuId: string, date: string) => number;

// ─── Row builder (shared by cards + balance) ─────────────────────────────────

/**
 * Convert a bench's plan lines into row data (batch split + est time). Hub-side
 * extras fold into `effectivePlanned` here so the bench bakes the off-list
 * units as part of the same run. Shared so the cards and the balance view
 * compute identical quantities and times.
 */
export function buildRowsForBench(
  bench: Bench,
  benchLines: PlanLine[],
  siteId: string,
  date: string,
  getExtras: GetExtras,
): RowData[] {
  return benchLines.map(line => {
    const eff = effectiveBatchRules(line.recipe.batchRules, bench.batchRules);
    const extrasUnits = getExtras(siteId, line.recipe.skuId, date);
    const targetUnits = line.effectivePlanned + extrasUnits;
    const split = proposeBatchSplit(targetUnits, eff);
    const estMinutes = estimateMinutes(line, split.batches.length);
    return {
      line,
      batches: split.batches,
      totalQty: split.batches.reduce((s, q) => s + q, 0),
      estMinutes,
      extrasUnits,
      teamFoodUnits: line.teamFoodPlanned,
    };
  });
}

// ─── Time / window helpers ───────────────────────────────────────────────────

export function estimateMinutes(line: PlanLine, batchCount: number): number {
  const wf = getWorkflow(line.recipe.workflowId);
  if (!wf) return 0;
  const perBatchMins = wf.stages
    .filter(s => s.leadOffset === 0)
    .reduce((s, stage) => s + Math.max(stage.durationMinutes, 1), 0);
  return perBatchMins * Math.max(batchCount, 0);
}

export function categoryStartMins(category: string): number {
  // Mirrors CATEGORY_START_MINS in deriveBoardPlan so cards and Gantt agree.
  switch (category) {
    case 'Bakery':
      return 5 * 60;
    case 'Sandwich':
      return 7 * 60 + 30;
    case 'Salad':
      return 10 * 60;
    case 'Snack':
      return 7 * 60;
    case 'Beverage':
      return 6 * 60;
    default:
      return 6 * 60;
  }
}

/**
 * Compute a display window for a mode group.
 *  - Primary run / variable: anchored at the earliest category start among the
 *    rows, extended by the group's total production time.
 *  - Secondary (after-service) groups: parked in the late afternoon.
 *  - Increment: spans ~05:30 → 17:00 (throughout day).
 */
export function windowForGroup(
  mode: ProductionMode,
  rows: RowData[],
  productionMins: number,
  isPrimary: boolean,
): { windowStartMins: number; windowEndMins: number; throughoutDay: boolean } {
  if (mode === 'increment') {
    return { windowStartMins: 5 * 60 + 30, windowEndMins: 17 * 60, throughoutDay: true };
  }
  if (!isPrimary) {
    const start = 15 * 60;
    return {
      windowStartMins: start,
      windowEndMins: Math.min(start + productionMins, 19 * 60),
      throughoutDay: false,
    };
  }
  const starts = rows.map(r => categoryStartMins(r.line.recipe.category));
  const windowStartMins = starts.length > 0 ? Math.min(...starts) : DEFAULT_WINDOW_START_MINS;
  const windowEndMins = Math.min(windowStartMins + productionMins, DEFAULT_WINDOW_END_MINS);
  return { windowStartMins, windowEndMins, throughoutDay: false };
}

/**
 * Label a mode group in the context of a bench + whether it's the bench's
 * primary mode.
 */
export function groupLabelFor(
  mode: ProductionMode,
  bench: Bench,
  rows: RowData[],
  isPrimary: boolean,
  hasRunBuckets: boolean,
): string {
  const categories = Array.from(new Set(rows.map(r => r.line.recipe.category)));
  const dominant = categories[0] ?? '';

  if (!isPrimary) {
    if (mode === 'variable') return 'Next-day prep';
    if (mode === 'run') return 'Top-up run';
    if (mode === 'increment') return 'Secondary increments';
  }

  if (mode === 'run') {
    if (hasRunBuckets) return 'Scheduled runs';
    if (dominant === 'Bakery') return 'Morning bake';
    if (dominant === 'Sandwich') return 'Component prep';
    if (dominant === 'Salad') return 'Salad prep';
    if (dominant === 'Beverage') return 'Beverage prep';
    return `${dominant || 'Run'} production`;
  }
  if (mode === 'variable') {
    if (dominant === 'Sandwich') return 'Lunch build';
    if (dominant === 'Salad') return 'Salad assembly';
    if (dominant === 'Bakery') return 'Finish & pack';
    return `${dominant || 'Variable'} build`;
  }
  // increment
  if (bench.capabilities.includes('oven')) return 'Hot bake';
  if (dominant === 'Beverage') return 'Drinks station';
  return 'Throughout day';
}

// ─── Run bucketing ───────────────────────────────────────────────────────────

/**
 * Bucket recipes into the bench's scheduled runs (R1/R2/...). Uses the
 * forecast's morning/midday/afternoon phase split as the signal; falls back
 * to category heuristics. Drops empty buckets.
 */
export function bucketRowsIntoRuns(
  rows: RowData[],
  runs: RunSchedule[],
  policy: NightShiftPolicy,
): RunBucket[] {
  const buckets: RunBucket[] = runs.map(run => {
    const startMins = hhmmToMins(run.startTime);
    return {
      run,
      rows: [],
      productionMins: 0,
      startMins,
      endMins: startMins + run.durationMinutes,
      assignee: '',
      isNight: isNightShiftHHMM(run.startTime, policy),
    };
  });

  if (buckets.length === 0) return buckets;

  for (const row of rows) {
    const idx = pickRunIndex(row, runs, policy);
    const bucket = buckets[idx] ?? buckets[0];
    bucket.rows.push(row);
    bucket.productionMins += row.estMinutes;
  }

  for (const bucket of buckets) {
    if (bucket.isNight) sortNightBucket(bucket, policy);
  }

  return buckets.filter(b => b.rows.length > 0);
}

export function pickRunIndex(
  row: RowData,
  runs: RunSchedule[],
  policy: NightShiftPolicy,
): number {
  if (runs.length === 1) return 0;

  const skuId = row.line.item.skuId;
  const isNightFirst = policy.firstOrder.includes(skuId);
  if (isNightFirst) {
    const nightIdx = runs.findIndex(r => isNightShiftHHMM(r.startTime, policy));
    if (nightIdx !== -1) return nightIdx;
  }

  const phases = row.line.forecast?.byPhase;
  if (phases) {
    const morningMins = 7 * 60 + 30;
    const middayMins = 12 * 60;
    const afternoonMins = 15 * 60;
    const peakMins =
      phases.midday + phases.afternoon > phases.morning
        ? phases.midday >= phases.afternoon
          ? middayMins
          : afternoonMins
        : morningMins;
    let bestIdx = -1;
    let bestDelta = Infinity;
    runs.forEach((r, i) => {
      if (isNightShiftHHMM(r.startTime, policy)) return;
      const start = hhmmToMins(r.startTime);
      const delta = Math.abs(peakMins - start);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIdx = i;
      }
    });
    if (bestIdx !== -1) return bestIdx;
  }

  const tags = row.line.recipe.selectionTags ?? [];
  const firstDayIdx = runs.findIndex(r => !isNightShiftHHMM(r.startTime, policy));
  if (tags.includes('morning') || tags.includes('breakfast')) {
    return firstDayIdx === -1 ? 0 : firstDayIdx;
  }
  return runs.length - 1;
}

/**
 * Apply the central night-shift policy to a night-shift bucket, in place.
 */
export function sortNightBucket(bucket: RunBucket, policy: NightShiftPolicy): void {
  const firstOrderRank = (skuId: string): number => {
    const idx = policy.firstOrder.indexOf(skuId);
    return idx === -1 ? Infinity : idx;
  };
  const categoryRank = (cat: string): number => {
    const idx = (policy.categoryOrder as readonly string[]).indexOf(cat);
    return idx === -1 ? Infinity : idx;
  };

  bucket.rows.sort((a, b) => {
    const fa = firstOrderRank(a.line.item.skuId);
    const fb = firstOrderRank(b.line.item.skuId);
    if (fa !== fb) return fa - fb;
    const ca = categoryRank(a.line.recipe.category);
    const cb = categoryRank(b.line.recipe.category);
    if (ca !== cb) return ca - cb;
    const sa = a.line.recipe.shelfLifeMinutes ?? 24 * 60;
    const sb = b.line.recipe.shelfLifeMinutes ?? 24 * 60;
    return sa - sb;
  });
}

export type RunTiming = 'upcoming' | 'active' | 'done';
export function runTiming(bucket: RunBucket, nowMins: number): RunTiming {
  if (nowMins < bucket.startMins) return 'upcoming';
  if (nowMins < bucket.endMins) return 'active';
  return 'done';
}

// ─── Per-run balance matrix (powers BenchBalanceView) ────────────────────────

/** One bench's slice of a single production run. */
export type BenchRunCell = {
  bench: Bench;
  assignee: string;
  rows: RowData[];
  /** Total units produced on this bench for this run. */
  units: number;
  recipeCount: number;
  productionMins: number;
};

/** Every bench compared for a single production run (R1, R2, N1, ...). */
export type BenchRunMatrix = {
  runLabel: string;
  /** Earliest start / latest end across the benches that run this label. */
  startMins: number;
  endMins: number;
  isNight: boolean;
  cells: BenchRunCell[];
  totalUnits: number;
  totalRecipes: number;
  totalProductionMins: number;
  /** Balance stats across the cells (used for average markers + outliers). */
  avgProductionMins: number;
  maxProductionMins: number;
  avgUnits: number;
  maxUnits: number;
};

/**
 * Pivot the day's plan into a per-run, cross-bench comparison: for each
 * scheduled production run, the SAME full roster of run-mode benches is
 * compared, with its product load, people, and time. Every run section lists
 * the same benches (so R1 and R2 always show like-for-like) — a bench that
 * isn't scheduled for, or has no recipes in, a given run shows as a 0-load
 * "idle" cell next to the benches that are busy.
 *
 * Deliberately per-run: there is no whole-day aggregate here. The caller
 * renders one section per run.
 */
export function buildBenchRunMatrix(
  site: Site,
  date: string,
  lines: PlanLine[],
  benches: Bench[],
  opts: { nightShiftPolicy: NightShiftPolicy; getExtras: GetExtras },
): BenchRunMatrix[] {
  const { nightShiftPolicy, getExtras } = opts;

  // Group lines by their primary bench (read model — no manager overrides).
  const byBench = new Map<string, PlanLine[]>();
  for (const line of lines) {
    if (line.effectivePlanned <= 0) continue;
    const benchId = line.primaryBench?.id;
    if (!benchId) continue;
    const arr = byBench.get(benchId) ?? [];
    arr.push(line);
    byBench.set(benchId, arr);
  }

  // Only run-mode benches with a runs schedule take part in production runs.
  const runBenches = benches.filter(
    b => b.primaryMode === 'run' && b.runs && b.runs.length > 0,
  );

  // Per bench: build rows, then bucket the run-mode rows into R1/R2/... and
  // index the buckets by run label for fast pivoting.
  const perBench = runBenches.map(bench => {
    const benchLines = byBench.get(bench.id) ?? [];
    const rows = buildRowsForBench(bench, benchLines, site.id, date, getExtras);
    const runRows = rows.filter(r => r.line.item.mode === 'run');
    const buckets = bucketRowsIntoRuns(runRows, bench.runs ?? [], nightShiftPolicy);
    const byLabel = new Map<string, RunBucket>();
    for (const bucket of buckets) byLabel.set(bucket.run.label, bucket);
    return { bench, byLabel };
  });

  // Distinct run labels across the site, ordered by earliest start time.
  const earliestStart = new Map<string, number>();
  for (const bench of runBenches) {
    for (const r of bench.runs ?? []) {
      const cur = earliestStart.get(r.label);
      const startMins = hhmmToMins(r.startTime);
      if (cur === undefined || startMins < cur) earliestStart.set(r.label, startMins);
    }
  }
  const orderedLabels = Array.from(earliestStart.keys()).sort(
    (a, b) => (earliestStart.get(a) ?? 0) - (earliestStart.get(b) ?? 0),
  );

  return orderedLabels.map(label => {
    const cells: BenchRunCell[] = [];
    let startMins = Infinity;
    let endMins = -Infinity;
    let isNight = false;

    for (const { bench, byLabel } of perBench) {
      // Compare the same roster of benches in every run. A bench not
      // scheduled for this label (or with nothing to make) lands as an idle
      // 0-load cell, so R1 and R2 always line up bench-for-bench.
      const scheduled = bench.runs?.find(r => r.label === label);
      const bucket = byLabel.get(label);
      const rows = bucket?.rows ?? [];
      const units = rows.reduce((s, r) => s + r.totalQty, 0);
      const productionMins = bucket?.productionMins ?? 0;

      const runId = scheduled?.id;
      const assignee =
        (runId ? RUN_ASSIGNEES_BY_BENCH[bench.id]?.[runId] : undefined) ??
        ASSIGNEE_BY_BENCH[bench.id] ??
        'Unassigned';

      cells.push({
        bench,
        assignee,
        rows,
        units,
        recipeCount: rows.length,
        productionMins,
      });

      // Run window + night flag come only from benches actually scheduled
      // for this run (idle benches contribute no timing).
      if (scheduled) {
        const sMins = hhmmToMins(scheduled.startTime);
        startMins = Math.min(startMins, sMins);
        endMins = Math.max(endMins, sMins + scheduled.durationMinutes);
        if (isNightShiftHHMM(scheduled.startTime, nightShiftPolicy)) isNight = true;
      }
    }

    const totalUnits = cells.reduce((s, c) => s + c.units, 0);
    const totalRecipes = cells.reduce((s, c) => s + c.recipeCount, 0);
    const totalProductionMins = cells.reduce((s, c) => s + c.productionMins, 0);
    const n = cells.length || 1;

    return {
      runLabel: label,
      startMins: startMins === Infinity ? 0 : startMins,
      endMins: endMins === -Infinity ? 0 : endMins,
      isNight,
      cells,
      totalUnits,
      totalRecipes,
      totalProductionMins,
      avgProductionMins: totalProductionMins / n,
      maxProductionMins: cells.reduce((m, c) => Math.max(m, c.productionMins), 0),
      avgUnits: totalUnits / n,
      maxUnits: cells.reduce((m, c) => Math.max(m, c.units), 0),
    };
  });
}

// ─── Format helpers ──────────────────────────────────────────────────────────

export function hhmmToMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m || 0);
}

export function minsToHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, '0');
  const m = Math.round(mins % 60)
    .toString()
    .padStart(2, '0');
  return `${h}:${m}`;
}

export function formatHMS(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = Math.round(totalMins % 60);
  const hh = h.toString().padStart(2, '0');
  const mm = m.toString().padStart(2, '0');
  return `${hh}:${mm}:00`;
}

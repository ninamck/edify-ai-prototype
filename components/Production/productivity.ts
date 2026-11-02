/**
 * Productivity calculations for PAC169 + PAC172.
 *
 * Source data: ProductionBatch records carry start/end times, an actualQty
 * and an assignedUserId. Each batch's recipe has a targetMinutes stored on
 * ProductionItem, which represents the expected bench-time for one default
 * batch (batchSize). We scale the target linearly with actualQty / batchSize
 * so a half-batch (e.g. 12 instead of 24 croissants) gets a half-target.
 *
 * Outputs:
 *  - batchProductivity(batch)   — per-batch metrics (actual, target, delta%)
 *  - employeeSummary(userId, batches) — totals + average delta vs target
 *  - benchSummary(benchId, batches)   — utilisation, batches/hr, units
 *  - siteProductivity(siteId, dateRange) — top-level aggregate, incl. runs vs
 *    norm (PAC088/089), recipes with slow-staff flags, and rota labour
 *  - productivityTrend(siteId)  — daily kitchen trend (PAC161/162)
 *
 * "Completed" means status ∈ {complete, reviewed}. Failed batches are
 * surfaced separately as a quality signal but excluded from speed averages.
 */

import {
  PRET_PLAN,
  PRET_USERS,
  PRET_BENCHES,
  dayOffset,
  getBench,
  getProductionItem,
  getRecipe,
  getUser,
  type ProductionBatch,
  type ProductionItemId,
  type SiteId,
  type BenchId,
  type UserId,
  type User,
  type Bench,
} from './fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// Date / time helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Convert "HH:MM" → minutes since midnight. Returns 0 on bad input. */
function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function minutesToHhmm(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Difference between two HH:MM strings in minutes (handles overnight). */
export function batchDurationMinutes(startTime: string, endTime: string): number {
  const start = hhmmToMinutes(startTime);
  const end = hhmmToMinutes(endTime);
  // Overnight (e.g. 23:30 → 01:00) — wrap forward 24h.
  return end >= start ? end - start : end + 24 * 60 - start;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-batch
// ─────────────────────────────────────────────────────────────────────────────

export type BatchProductivity = {
  batch: ProductionBatch;
  /** Actual minutes worked (from start/end). */
  actualMinutes: number;
  /** Target minutes scaled to actualQty (or undefined if recipe has no target). */
  targetMinutes: number | undefined;
  /** Percentage delta vs target. -10 = 10% faster than target. Undefined if no target. */
  deltaPercent: number | undefined;
  /** Speed bucket for badging. */
  bucket: 'fast' | 'on-target' | 'slow' | 'no-target' | 'failed';
  /** Site for filtering. */
  siteId: SiteId | undefined;
  /** Recipe name (resolved from item → recipe). */
  recipeName: string;
  /** Bench name (resolved). */
  benchName: string;
  /** Worker name (resolved, falls back to "Unassigned"). */
  workerName: string;
};

/** Compute target minutes for a batch given its actual qty (linear scaling). */
export function targetMinutesFor(batch: ProductionBatch): number | undefined {
  const item = getProductionItem(batch.productionItemId);
  if (!item || item.targetMinutes == null || item.batchSize <= 0) return undefined;
  if (batch.actualQty <= 0) return item.targetMinutes;
  // Allow ±50% scaling but never below 1 minute (handling on-demand singles).
  const scaled = (item.targetMinutes * batch.actualQty) / item.batchSize;
  return Math.max(1, scaled);
}

export function batchProductivity(batch: ProductionBatch): BatchProductivity {
  const item = getProductionItem(batch.productionItemId);
  const recipe = item ? getRecipe(item.recipeId) : undefined;
  const bench = getBench(batch.benchId);
  const user = batch.assignedUserId ? getUser(batch.assignedUserId) : undefined;
  const actualMinutes = batchDurationMinutes(batch.startTime, batch.endTime);
  const target = targetMinutesFor(batch);
  const deltaPercent =
    target != null && target > 0
      ? ((actualMinutes - target) / target) * 100
      : undefined;
  let bucket: BatchProductivity['bucket'];
  if (batch.status === 'failed') bucket = 'failed';
  else if (deltaPercent == null) bucket = 'no-target';
  else if (deltaPercent <= -RUN_OVER_PERCENT) bucket = 'fast';
  else if (deltaPercent >= RUN_OVER_PERCENT) bucket = 'slow';
  else bucket = 'on-target';

  return {
    batch,
    actualMinutes,
    targetMinutes: target,
    deltaPercent,
    bucket,
    siteId: item?.siteId,
    recipeName: recipe?.name ?? batch.productionItemId,
    benchName: bench?.name ?? batch.benchId,
    workerName: user?.name?.split(' — ')[0] ?? 'Unassigned',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregates
// ─────────────────────────────────────────────────────────────────────────────

export type EmployeeSummary = {
  user: User | undefined;
  userId: UserId;
  workerName: string;
  /** Total completed (or reviewed) batches in scope. */
  batchCount: number;
  /** Total units produced. */
  totalUnits: number;
  /** Total minutes worked (actuals). */
  totalMinutes: number;
  /** Weighted average delta vs target across batches with a target. */
  avgDeltaPercent: number | undefined;
  /** Failed batches count (quality signal). */
  failedCount: number;
  /** Per-bench breakdown for the panel. */
  byBench: Array<{ benchId: BenchId; benchName: string; batchCount: number; units: number }>;
};

export type BenchSummary = {
  bench: Bench | undefined;
  benchId: BenchId;
  benchName: string;
  batchCount: number;
  totalUnits: number;
  totalMinutes: number;
  avgDeltaPercent: number | undefined;
  failedCount: number;
  /** Distinct workers who used this bench. */
  workerCount: number;
};

export type SiteProductivity = {
  siteId: SiteId;
  /** Days included in the calculation. */
  dates: string[];
  batchCount: number;
  failedCount: number;
  totalUnits: number;
  totalMinutes: number;
  avgDeltaPercent: number | undefined;
  /** Sorted: best (most negative delta) first, then no-target. */
  employees: EmployeeSummary[];
  /** Sorted by units desc. */
  benches: BenchSummary[];
  /** All batches (for the detail table). */
  batches: BatchProductivity[];
  /** Scheduled vs Pret norm vs actual for each bench run (PAC088 / PAC089). */
  runs: RunSummary[];
  /** Recipes with a norm, flagged first then slowest first. */
  recipes: RecipeSummary[];
  /** Every staff member running very slow on a recipe, worst first. */
  flags: StaffFlag[];
  labour: LabourSummary;
  /** Expected vs actual per product, bench, employee and run. */
  breakdown: Record<BreakdownBy, TimeRow[]>;
  /** All productions: every timed batch in the period. */
  total: TimeRow;
};

// ─────────────────────────────────────────────────────────────────────────────
// Demo history
//
// PRET_PLAN only carries today and yesterday. The productivity trend needs
// four weeks, so we replay yesterday's batches back over the previous 26 days
// with each worker's pace, a gentle improvement over time, and day-to-day
// noise. Seeded per date + batch so every load renders the same numbers.
// Kept here rather than in PRET_PLAN so the board, PCR queue and carry-over
// never see these batches.
// ─────────────────────────────────────────────────────────────────────────────

export const HISTORY_DAYS = 28;

/** Pace vs norm per worker (+0.10 = 10% slower). */
const WORKER_PACE: Record<UserId, number> = {
  'user-staff-central': -0.16,
  'user-staff-central-2': -0.09,
  'user-staff-central-3': 0.08,
  'user-staff-central-4': -0.06,
};

/** Extra pace on specific recipes, keyed `${userId}:${productionItemId}`. */
const WORKER_RECIPE_PACE: Record<string, number> = {
  'user-staff-central-3:pi-central-roast-chicken': 0.34,
  'user-staff-central-3:pi-central-baguette': 0.27,
};

function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isWeekend(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

const historyCache = new Map<SiteId, ProductionBatch[]>();

function generatedHistory(siteId: SiteId): ProductionBatch[] {
  const cached = historyCache.get(siteId);
  if (cached) return cached;
  const templateDate = dayOffset(-1);
  const template = PRET_PLAN.batches.filter(
    b => b.date === templateDate && b.status !== 'planned' && getProductionItem(b.productionItemId)?.siteId === siteId,
  );
  const staff = PRET_USERS.filter(u => u.siteId === siteId && u.role === 'Staff').map(u => u.id);
  const out: ProductionBatch[] = [];
  for (let k = 2; k < HISTORY_DAYS; k++) {
    const date = dayOffset(-k);
    const weekend = isWeekend(date);
    const drift = 0.12 * (k / HISTORY_DAYS);
    for (const t of template) {
      const rand = seededRandom(`${date}:${t.id}`);
      if (rand() < (weekend ? 0.3 : 0.08)) continue;
      let worker = t.assignedUserId;
      if (staff.length > 1 && rand() < 0.15) worker = staff[Math.floor(rand() * staff.length)];
      const qty = weekend ? Math.max(1, Math.round(t.actualQty * 0.75)) : t.actualQty;
      const target = targetMinutesFor({ ...t, actualQty: qty });
      const workerPace = worker
        ? (WORKER_PACE[worker] ?? 0) + (WORKER_RECIPE_PACE[`${worker}:${t.productionItemId}`] ?? 0)
        : 0;
      const pace = workerPace + drift + (rand() - 0.5) * 0.16;
      const base = target ?? batchDurationMinutes(t.startTime, t.endTime);
      const duration = Math.max(2, Math.round(base * (1 + pace)));
      const start = hhmmToMinutes(t.startTime) + Math.round((rand() - 0.5) * 10);
      out.push({
        id: `hist-${date}-${t.id}`,
        productionItemId: t.productionItemId,
        benchId: t.benchId,
        date,
        startTime: minutesToHhmm(start),
        endTime: minutesToHhmm(start + duration),
        actualQty: qty,
        status: rand() < 0.025 ? 'failed' : 'reviewed',
        assignedUserId: worker,
      });
    }
  }
  historyCache.set(siteId, out);
  return out;
}

/** Pull batches for a site within a date range. Includes completed + reviewed + failed. */
function batchesForSiteOnDates(siteId: SiteId, dates: string[]): ProductionBatch[] {
  const dateSet = new Set(dates);
  const seeded = PRET_PLAN.batches.filter(b => {
    if (!dateSet.has(b.date)) return false;
    const item = getProductionItem(b.productionItemId);
    return item?.siteId === siteId;
  });
  return [...seeded, ...generatedHistory(siteId).filter(b => dateSet.has(b.date))];
}

// ─────────────────────────────────────────────────────────────────────────────
// Runs, recipes, labour
// ─────────────────────────────────────────────────────────────────────────────

export type RunSummary = {
  benchId: BenchId;
  benchName: string;
  runLabel: string;
  startTime: string | undefined;
  /** Minutes the run was scheduled for. Undefined on benches without runs. */
  scheduledMinutes: number | undefined;
  /** Pret norm for the work done, averaged per active day. */
  normMinutes: number;
  /** Actual bench-time for the same batches, averaged per active day. */
  actualMinutes: number;
  deltaPercent: number | undefined;
  batchCount: number;
  activeDays: number;
};

export type StaffFlag = {
  userId: UserId;
  workerName: string;
  productionItemId: ProductionItemId;
  recipeName: string;
  deltaPercent: number;
  batchCount: number;
  /** Quickest colleague on the same recipe, if anyone beat the norm. */
  quickest?: { workerName: string; deltaPercent: number };
};

export type RecipeStaffSummary = {
  userId: UserId;
  workerName: string;
  batchCount: number;
  avgDeltaPercent: number | undefined;
};

export type RecipeSummary = {
  productionItemId: ProductionItemId;
  recipeName: string;
  /** Completed and failed batches with a norm. */
  batches: BatchProductivity[];
  avgDeltaPercent: number | undefined;
  staff: RecipeStaffSummary[];
  flags: StaffFlag[];
};

export type LabourSummary = {
  /** Kitchen team hours from the rota (mocked from first/last batch per shift). */
  teamHours: number;
  /** Manager-on-duty hours booked to back of house (PAC157). */
  managerHours: number;
  unitsPerLabourHour: number | undefined;
};

/** A staff member is flagged when this much slower than norm on a recipe. */
export const VERY_SLOW_PERCENT = 25;
/** Tolerance either side of expected: rows and batches inside it are "On track". A placeholder until Pret confirms theirs. */
export const RUN_OVER_PERCENT = 10;
const MOD_BOH_HOURS_PER_DAY = 1.5;
/** On-demand singles carry 1–2 minute norms where a minute's wobble reads as +100%. */
const MIN_NORM_MINUTES = 3;

function hasMeaningfulNorm(it: BatchProductivity): boolean {
  return it.targetMinutes != null && it.targetMinutes >= MIN_NORM_MINUTES;
}

type Run = NonNullable<Bench['runs']>[number];

/** The run a batch belongs to: the one whose slot it started in, else the nearest by start time. */
function runFor(benchId: BenchId, startTime: string): Run | undefined {
  const runs = getBench(benchId)?.runs ?? [];
  const t = hhmmToMinutes(startTime);
  const containing = runs
    .filter(r => {
      const start = hhmmToMinutes(r.startTime);
      return t >= start - 15 && t < start + r.durationMinutes;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  return (
    containing[containing.length - 1] ??
    [...runs].sort(
      (a, b) => Math.abs(hhmmToMinutes(a.startTime) - t) - Math.abs(hhmmToMinutes(b.startTime) - t),
    )[0]
  );
}

function runSummaries(items: BatchProductivity[], benches: BenchId[]): RunSummary[] {
  const out: RunSummary[] = [];
  for (const benchId of benches) {
    const bench = getBench(benchId);
    const runs = [...(bench?.runs ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const onBench = items.filter(it => it.batch.benchId === benchId && hasMeaningfulNorm(it));
    const buckets = new Map<string, BatchProductivity[]>();
    for (const it of onBench) {
      const key = runFor(benchId, it.batch.startTime)?.id ?? 'all-day';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(it);
    }
    const ordered = runs.length > 0 ? runs.map(r => r.id) : ['all-day'];
    for (const key of ordered) {
      const group = buckets.get(key);
      if (!group || group.length === 0) continue;
      const run = runs.find(r => r.id === key);
      const days = new Set(group.map(g => g.batch.date)).size;
      const norm = group.reduce((a, g) => a + (g.targetMinutes ?? 0), 0) / days;
      const actual = group.reduce((a, g) => a + g.actualMinutes, 0) / days;
      out.push({
        benchId,
        benchName: bench?.name ?? benchId,
        runLabel: run?.label ?? 'All day',
        startTime: run?.startTime,
        scheduledMinutes: run?.durationMinutes,
        normMinutes: norm,
        actualMinutes: actual,
        deltaPercent: norm > 0 ? ((actual - norm) / norm) * 100 : undefined,
        batchCount: group.length,
        activeDays: days,
      });
    }
  }
  return out;
}

function recipeSummaries(items: BatchProductivity[], multiDay: boolean): RecipeSummary[] {
  const byItem = new Map<ProductionItemId, BatchProductivity[]>();
  for (const it of items) {
    if (!hasMeaningfulNorm(it)) continue;
    if (!isSpeedRelevant(it.batch) && it.batch.status !== 'failed') continue;
    const id = it.batch.productionItemId;
    if (!byItem.has(id)) byItem.set(id, []);
    byItem.get(id)!.push(it);
  }
  const minBatches = multiDay ? 2 : 1;
  const recipes = Array.from(byItem.entries()).map(([productionItemId, batches]) => {
    const speed = batches.filter(b => isSpeedRelevant(b.batch));
    const staffMap = new Map<UserId, BatchProductivity[]>();
    for (const b of speed) {
      const uid = b.batch.assignedUserId ?? 'unassigned';
      if (!staffMap.has(uid)) staffMap.set(uid, []);
      staffMap.get(uid)!.push(b);
    }
    const staff: RecipeStaffSummary[] = Array.from(staffMap.entries())
      .map(([userId, list]) => ({
        userId,
        workerName: list[0].workerName,
        batchCount: list.length,
        avgDeltaPercent: weightedAvgDelta(list),
      }))
      .sort((a, b) => (a.avgDeltaPercent ?? 0) - (b.avgDeltaPercent ?? 0));
    const quickest = staff[0];
    const recipeName = batches[0].recipeName;
    const flags: StaffFlag[] = staff
      .filter(s => s.userId !== 'unassigned' && (s.avgDeltaPercent ?? 0) >= VERY_SLOW_PERCENT && s.batchCount >= minBatches)
      .map(s => ({
        userId: s.userId,
        workerName: s.workerName,
        productionItemId,
        recipeName,
        deltaPercent: s.avgDeltaPercent as number,
        batchCount: s.batchCount,
        quickest:
          quickest && quickest.userId !== s.userId && (quickest.avgDeltaPercent ?? 0) <= -3
            ? { workerName: quickest.workerName, deltaPercent: quickest.avgDeltaPercent as number }
            : undefined,
      }))
      .sort((a, b) => b.deltaPercent - a.deltaPercent);
    return {
      productionItemId,
      recipeName,
      batches,
      avgDeltaPercent: weightedAvgDelta(speed),
      staff,
      flags,
    };
  });
  return recipes.sort((a, b) => {
    if (a.flags.length !== b.flags.length) return b.flags.length - a.flags.length;
    return (b.avgDeltaPercent ?? -Infinity) - (a.avgDeltaPercent ?? -Infinity);
  });
}

function labourSummary(items: BatchProductivity[]): LabourSummary {
  const shifts = new Map<string, { start: number; end: number }>();
  for (const it of items) {
    if (it.batch.status === 'planned' || !it.batch.assignedUserId) continue;
    const key = `${it.batch.date}:${it.batch.assignedUserId}`;
    const start = hhmmToMinutes(it.batch.startTime);
    const end = start + it.actualMinutes;
    const s = shifts.get(key);
    shifts.set(key, s ? { start: Math.min(s.start, start), end: Math.max(s.end, end) } : { start, end });
  }
  let teamMinutes = 0;
  for (const { start, end } of shifts.values()) {
    const rotaStart = Math.floor((start - 15) / 15) * 15;
    const rotaEnd = Math.ceil((end + 15) / 15) * 15;
    teamMinutes += rotaEnd - rotaStart;
  }
  const activeDays = new Set(items.filter(it => it.batch.status !== 'planned').map(it => it.batch.date)).size;
  const teamHours = teamMinutes / 60;
  const units = items.filter(it => isSpeedRelevant(it.batch)).reduce((a, it) => a + it.batch.actualQty, 0);
  return {
    teamHours,
    managerHours: activeDays * MOD_BOH_HOURS_PER_DAY,
    unitsPerLabourHour: teamHours > 0 ? units / teamHours : undefined,
  };
}

/** Returns true if the batch should count toward speed averages. */
function isSpeedRelevant(b: ProductionBatch): boolean {
  return b.status === 'complete' || b.status === 'reviewed';
}

/** Weighted-by-target average delta. Avoids skew from very short batches. */
function weightedAvgDelta(items: BatchProductivity[]): number | undefined {
  let weightSum = 0;
  let deltaWeightedSum = 0;
  for (const it of items) {
    if (it.deltaPercent == null || it.targetMinutes == null) continue;
    weightSum += it.targetMinutes;
    deltaWeightedSum += it.deltaPercent * it.targetMinutes;
  }
  if (weightSum === 0) return undefined;
  return deltaWeightedSum / weightSum;
}

// ─────────────────────────────────────────────────────────────────────────────
// Expected vs actual breakdown
//
// "Expected" is the product's standard time scaled to the batch size (the
// same figure as targetMinutes). Totals cover the whole period, not a daily
// average, so the rows add up to the site total.
// ─────────────────────────────────────────────────────────────────────────────

export type BreakdownBy = 'product' | 'bench' | 'employee' | 'run';

export type TimeRow = {
  id: string;
  label: string;
  sublabel?: string;
  expectedMinutes: number;
  actualMinutes: number;
  /** +10 = took 10% longer than expected. */
  deltaPercent: number | undefined;
  batchCount: number;
  /** Run rows only: scheduled slot length summed over the days it ran. */
  scheduledMinutes?: number;
  flags: StaffFlag[];
  children?: TimeRow[];
};

function timeRow(id: string, label: string, items: BatchProductivity[], flags: StaffFlag[], extra?: Partial<TimeRow>): TimeRow {
  const expected = items.reduce((a, it) => a + (it.targetMinutes ?? 0), 0);
  const actual = items.reduce((a, it) => a + it.actualMinutes, 0);
  return {
    id,
    label,
    expectedMinutes: expected,
    actualMinutes: actual,
    deltaPercent: expected > 0 ? ((actual - expected) / expected) * 100 : undefined,
    batchCount: items.length,
    flags,
    ...extra,
  };
}

function groupItems(items: BatchProductivity[], key: (it: BatchProductivity) => string): Map<string, BatchProductivity[]> {
  const map = new Map<string, BatchProductivity[]>();
  for (const it of items) {
    const k = key(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return map;
}

function byOverrun(a: TimeRow, b: TimeRow): number {
  return b.actualMinutes - b.expectedMinutes - (a.actualMinutes - a.expectedMinutes);
}

function timeBreakdown(items: BatchProductivity[], flags: StaffFlag[]): Record<BreakdownBy, TimeRow[]> {
  const timed = items.filter(it => isSpeedRelevant(it.batch) && hasMeaningfulNorm(it));
  const userOf = (it: BatchProductivity) => it.batch.assignedUserId ?? 'unassigned';

  const product = Array.from(groupItems(timed, it => it.batch.productionItemId)).map(([id, list]) => {
    const own = flags.filter(f => f.productionItemId === id);
    const children = Array.from(groupItems(list, userOf))
      .map(([uid, sub]) => timeRow(uid, sub[0].workerName, sub, own.filter(f => f.userId === uid)))
      .sort(byOverrun);
    return timeRow(id, list[0].recipeName, list, own, { children });
  });

  const employee = Array.from(groupItems(timed, userOf)).map(([uid, list]) => {
    const own = flags.filter(f => f.userId === uid);
    const children = Array.from(groupItems(list, it => it.batch.productionItemId))
      .map(([id, sub]) => timeRow(id, sub[0].recipeName, sub, own.filter(f => f.productionItemId === id)))
      .sort(byOverrun);
    return timeRow(uid, list[0].workerName, list, own, { children });
  });

  const bench = Array.from(groupItems(timed, it => it.batch.benchId)).map(([id, list]) =>
    timeRow(id, list[0].benchName, list, []),
  );

  const run = Array.from(
    groupItems(timed, it => `${it.batch.benchId}:${runFor(it.batch.benchId, it.batch.startTime)?.id ?? 'all-day'}`),
  ).map(([key, list]) => {
    const r = runFor(list[0].batch.benchId, list[0].batch.startTime);
    const days = new Set(list.map(it => it.batch.date)).size;
    return timeRow(key, `${list[0].benchName} ${r?.label ?? 'All day'}`, list, [], {
      sublabel: r ? `Starts ${r.startTime}` : undefined,
      scheduledMinutes: r ? r.durationMinutes * days : undefined,
    });
  });

  return {
    product: product.sort(byOverrun),
    bench: bench.sort(byOverrun),
    employee: employee.sort(byOverrun),
    run: run.sort(byOverrun),
  };
}

export function siteProductivity(siteId: SiteId, dates: string[]): SiteProductivity {
  const raw = batchesForSiteOnDates(siteId, dates);
  const productivities = raw.map(batchProductivity);

  // Aggregate per employee
  const empMap = new Map<UserId, BatchProductivity[]>();
  for (const p of productivities) {
    const uid = p.batch.assignedUserId ?? 'unassigned';
    if (!empMap.has(uid)) empMap.set(uid, []);
    empMap.get(uid)!.push(p);
  }
  const employees: EmployeeSummary[] = Array.from(empMap.entries()).map(([uid, items]) => {
    const speed = items.filter(it => isSpeedRelevant(it.batch));
    const benchMap = new Map<BenchId, { units: number; batchCount: number; benchName: string }>();
    for (const it of items) {
      const e = benchMap.get(it.batch.benchId) ?? { units: 0, batchCount: 0, benchName: it.benchName };
      e.units += it.batch.actualQty;
      e.batchCount += 1;
      benchMap.set(it.batch.benchId, e);
    }
    return {
      userId: uid,
      user: uid === 'unassigned' ? undefined : getUser(uid),
      workerName: items[0]?.workerName ?? 'Unassigned',
      batchCount: items.filter(it => it.batch.status !== 'planned').length,
      totalUnits: items.reduce((a, b) => a + b.batch.actualQty, 0),
      totalMinutes: items.reduce((a, b) => a + b.actualMinutes, 0),
      avgDeltaPercent: weightedAvgDelta(speed),
      failedCount: items.filter(it => it.batch.status === 'failed').length,
      byBench: Array.from(benchMap.entries())
        .map(([benchId, v]) => ({ benchId, benchName: v.benchName, batchCount: v.batchCount, units: v.units }))
        .sort((a, b) => b.units - a.units),
    };
  });

  // Sort employees: those with a delta first (best→worst), then "no-target" by units
  employees.sort((a, b) => {
    const aHas = a.avgDeltaPercent != null;
    const bHas = b.avgDeltaPercent != null;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    if (aHas && bHas) return (a.avgDeltaPercent as number) - (b.avgDeltaPercent as number);
    return b.totalUnits - a.totalUnits;
  });

  // Aggregate per bench
  const benchMap = new Map<BenchId, BatchProductivity[]>();
  for (const p of productivities) {
    if (!benchMap.has(p.batch.benchId)) benchMap.set(p.batch.benchId, []);
    benchMap.get(p.batch.benchId)!.push(p);
  }
  const benches: BenchSummary[] = Array.from(benchMap.entries()).map(([benchId, items]) => {
    const workerSet = new Set(items.map(i => i.batch.assignedUserId).filter(Boolean));
    const speed = items.filter(it => isSpeedRelevant(it.batch));
    return {
      benchId,
      bench: getBench(benchId),
      benchName: items[0]?.benchName ?? benchId,
      batchCount: items.filter(it => it.batch.status !== 'planned').length,
      totalUnits: items.reduce((a, b) => a + b.batch.actualQty, 0),
      totalMinutes: items.reduce((a, b) => a + b.actualMinutes, 0),
      avgDeltaPercent: weightedAvgDelta(speed),
      failedCount: items.filter(it => it.batch.status === 'failed').length,
      workerCount: workerSet.size,
    };
  }).sort((a, b) => b.totalUnits - a.totalUnits);

  // Site-level aggregate (excludes planned)
  const completed = productivities.filter(p => p.batch.status !== 'planned');
  const speedItems = completed.filter(p => isSpeedRelevant(p.batch));
  const recipes = recipeSummaries(completed, dates.length > 1);
  const flags = recipes.flatMap(r => r.flags).sort((a, b) => b.deltaPercent - a.deltaPercent);
  return {
    siteId,
    dates,
    batchCount: completed.length,
    failedCount: completed.filter(p => p.batch.status === 'failed').length,
    totalUnits: completed.reduce((a, b) => a + b.batch.actualQty, 0),
    totalMinutes: completed.reduce((a, b) => a + b.actualMinutes, 0),
    avgDeltaPercent: weightedAvgDelta(speedItems),
    employees,
    benches,
    batches: productivities.sort((a, b) =>
      b.batch.date.localeCompare(a.batch.date) ||
      a.batch.startTime.localeCompare(b.batch.startTime)
    ),
    runs: runSummaries(speedItems, benches.map(b => b.benchId)),
    recipes,
    flags,
    labour: labourSummary(completed),
    breakdown: timeBreakdown(completed, flags),
    total: timeRow(
      'total',
      'All productions',
      completed.filter(it => isSpeedRelevant(it.batch) && hasMeaningfulNorm(it)),
      flags,
    ),
  };
}

export type TrendPoint = {
  date: string;
  deltaPercent: number | undefined;
  unitsPerLabourHour: number | undefined;
};

/** One point per completed day (today's shift is still running), oldest first. */
export function productivityTrend(siteId: SiteId, days: number = HISTORY_DAYS - 1): TrendPoint[] {
  return Array.from({ length: days }, (_, i) => dayOffset(-(days - i))).map(date => {
    const s = siteProductivity(siteId, [date]);
    return { date, deltaPercent: s.total.deltaPercent, unitsPerLabourHour: s.labour.unitsPerLabourHour };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience for nudges
// ─────────────────────────────────────────────────────────────────────────────

/** Format a delta as a friendly string e.g. "12% faster" / "8% slower" / "on target". */
export function formatDelta(delta: number | undefined): string {
  if (delta == null) return '—';
  if (delta <= -3) return `${Math.abs(Math.round(delta))}% faster`;
  if (delta >= 3) return `${Math.round(delta)}% slower`;
  return 'on target';
}

/** Format minutes as "Xm" or "Xh Ym". */
export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Roll-up of all employees at a site (for cross-site/global use). */
export function allHubStaff(siteId: SiteId): User[] {
  return PRET_USERS.filter(u => u.siteId === siteId);
}

/** Roll-up of all benches at a site. */
export function allBenches(siteId: SiteId): Bench[] {
  return PRET_BENCHES.filter(b => b.siteId === siteId);
}

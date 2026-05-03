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
 *  - siteProductivity(siteId, dateRange) — top-level aggregate
 *
 * "Completed" means status ∈ {complete, reviewed}. Failed batches are
 * surfaced separately as a quality signal but excluded from speed averages.
 */

import {
  PRET_PLAN,
  PRET_USERS,
  PRET_BENCHES,
  getBench,
  getProductionItem,
  getRecipe,
  getUser,
  type ProductionBatch,
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
  else if (deltaPercent <= -8) bucket = 'fast';
  else if (deltaPercent >= 12) bucket = 'slow';
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
};

/** Pull batches for a site within a date range. Includes completed + reviewed + failed. */
function batchesForSiteOnDates(siteId: SiteId, dates: string[]): ProductionBatch[] {
  const dateSet = new Set(dates);
  return PRET_PLAN.batches.filter(b => {
    if (!dateSet.has(b.date)) return false;
    const item = getProductionItem(b.productionItemId);
    return item?.siteId === siteId;
  });
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
  };
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

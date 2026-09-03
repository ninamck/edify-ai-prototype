/**
 * The kit a shop owns, summed across its benches, for the engines.
 *
 * `Bench.kit` says the hot section has two ovens of six trays and two rice
 * cookers. The sections board needs the totals: how many batches of rice
 * go on at once (one per cooker), how many trays of chicken fit (ovens ×
 * trays). `FjPlanProvider` resolves each shop's benches through the site
 * settings store and registers the totals here, next to the lines.
 */

import { EQUIPMENT_CAPACITY_UNIT, kitCapacity, kitCount, type Bench, type Equipment } from '../fixtures';
import { FJ_BENCH_TEMPLATES } from './fjFixtures';

export type ShopKit = {
  /** Units owned, by equipment. */
  count: Partial<Record<Equipment, number>>;
  /** Total capacity (trays, say) for equipment that has one. */
  capacity: Partial<Record<Equipment, number>>;
};

export function kitFromBenches(benches: Pick<Bench, 'kit' | 'online'>[]): ShopKit {
  const live = benches.filter(b => b.online !== false);
  const count: ShopKit['count'] = {};
  const capacity: ShopKit['capacity'] = {};
  const seen = new Set<Equipment>(live.flatMap(b => (b.kit ?? []).map(k => k.equipment)));
  for (const e of seen) {
    count[e] = kitCount(live, e);
    if (EQUIPMENT_CAPACITY_UNIT[e]) capacity[e] = kitCapacity(live, e);
  }
  return { count, capacity };
}

export function defaultKit(): ShopKit {
  return kitFromBenches(FJ_BENCH_TEMPLATES.map(t => ({ ...t, siteId: '' })));
}

/**
 * How many batches of a recipe fit in one load of the kit it needs.
 *
 *  - Kit with a capacity (ovens hold trays) and a recipe that fills
 *    `containersPerLoadUnit` of them a batch: floor(total trays / trays a
 *    batch). Two ovens of six, four trays a batch: three batches a load.
 *  - Kit with a capacity but a recipe that does not say how many it fills:
 *    one batch a load, because we cannot tell whether it fits.
 *  - Kit without one: one batch per unit. Two rice cookers, two kits.
 *  - A recipe that needs nothing the shop counts: one batch at a time.
 */
export function batchesPerLoadFor(kit: ShopKit, requires: string[] | undefined, containersPerBatch: number | undefined): number {
  for (const e of (requires ?? []) as Equipment[]) {
    const units = kit.count[e];
    if (!units) continue;
    if (EQUIPMENT_CAPACITY_UNIT[e]) {
      if (!containersPerBatch || containersPerBatch <= 0) return 1;
      return Math.max(1, Math.floor((kit.capacity[e] ?? units) / containersPerBatch));
    }
    return Math.max(1, units);
  }
  return 1;
}

// ─── Registry ────────────────────────────────────────────────────────────────

let REGISTRY: Record<string, ShopKit> = {};
let REGISTRY_KEY = '';

export function setShopKit(map: Record<string, ShopKit>): string {
  REGISTRY = map;
  REGISTRY_KEY = JSON.stringify(map);
  return REGISTRY_KEY;
}

export function kitFor(shopId: string): ShopKit {
  return REGISTRY[shopId] ?? defaultKit();
}

export function kitKey(): string {
  return REGISTRY_KEY;
}

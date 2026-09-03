/**
 * Make-on days for the planning engine.
 *
 * The truth lives in the site settings store as production windows: each
 * weekday says which shelf-life groups are made and whether it is the deep
 * clean. The engines are plain functions with no access to React state, so
 * the plan provider derives one `MakeOnSchedule` per shop from the store and
 * registers it here (same pattern as lines.ts and kit.ts). Anything that
 * asks "is Wednesday a make-on day for the 3-day dressings at Marylebone?"
 * goes through `productionDaysFor` and `deepCleanDaysFor`.
 */

import type { DayOfWeek } from '../fixtures';
import type { WindowsForDay } from '../../Settings/siteSettingsStore';
import { FJ_DAYS_OF_WEEK, FJ_DEFAULT_WINDOWS, dayToWeekday } from './fjFixtures';
import { SHELF_LIFE_GROUPS, type ShelfLifeGroupId, type Weekday } from './recipes';

export type MakeOnSchedule = {
  /** Weekdays each group is made on, Monday = 0. */
  days: Record<ShelfLifeGroupId, Weekday[]>;
  /** Deep-clean weekdays: nothing made ahead. */
  deepClean: Weekday[];
};

export const GROUP_IDS = Object.keys(SHELF_LIFE_GROUPS) as ShelfLifeGroupId[];

/** Read a schedule off a site's resolved windows. */
export function scheduleFromWindows(windows: Partial<Record<DayOfWeek, WindowsForDay>>): MakeOnSchedule {
  const days = Object.fromEntries(GROUP_IDS.map(g => [g, [] as Weekday[]])) as Record<ShelfLifeGroupId, Weekday[]>;
  const deepClean: Weekday[] = [];
  for (const d of FJ_DAYS_OF_WEEK) {
    const w = dayToWeekday(d);
    const win = windows[d] ?? {};
    for (const g of GROUP_IDS) if (win.makeOn?.[g]) days[g].push(w);
    if (win.deepClean) deepClean.push(w);
  }
  return { days, deepClean };
}

export function defaultSchedule(): MakeOnSchedule {
  return scheduleFromWindows(FJ_DEFAULT_WINDOWS);
}

export function sameSchedule(a: MakeOnSchedule, b: MakeOnSchedule): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ─── Registry ────────────────────────────────────────────────────────────────

const registry = new Map<string, MakeOnSchedule>();
let fallback: MakeOnSchedule = defaultSchedule();

/** Replace every shop's schedule. `company` is the schedule for shops not listed. */
export function setShopSchedules(byShop: Record<string, MakeOnSchedule>, company: MakeOnSchedule): void {
  registry.clear();
  for (const [shopId, s] of Object.entries(byShop)) registry.set(shopId, s);
  fallback = company;
}

export function scheduleFor(shopId: string): MakeOnSchedule {
  return registry.get(shopId) ?? fallback;
}

export function productionDaysFor(shopId: string, group: ShelfLifeGroupId): Weekday[] {
  return scheduleFor(shopId).days[group];
}

export function deepCleanDaysFor(shopId: string): Weekday[] {
  return scheduleFor(shopId).deepClean;
}

/** Cache key so memoised plans recompute when any shop's schedule changes. */
export function scheduleKey(): string {
  return JSON.stringify([fallback, Array.from(registry.entries())]);
}

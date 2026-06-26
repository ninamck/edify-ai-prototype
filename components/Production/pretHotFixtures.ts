/**
 * Pret hot-production fixture bundle — the data behind the Pret hot line
 * crew screen (the toasties / melts / soups / warm bakes shelf).
 *
 * Mirrors the shape of `bkFixtures` but for Pret's hot shelf: a single
 * "Hot kitchen" station that bakes / presses / reheats to a holding shelf
 * on a fixed 30-minute batch cadence. The items are pulled from the real
 * Pret hot-prod menu (see PRET_RECIPES in `fixtures.ts`) so the shelf reads
 * like the actual range a shop holds through lunch service.
 *
 * Self-contained: imports ONLY the `RecipeId` type (erased at compile time)
 * so there's no runtime import cycle with `fixtures.ts`.
 */

import type { RecipeId } from './fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// Demo clock — Pret runs its own lunch-service scenario so the hot line has
// visible movement the moment you open it.
// ─────────────────────────────────────────────────────────────────────────────

/** Service window (minutes from midnight) the hot line schedules across. */
export const PRET_HOT_SERVICE_START_MIN = 7 * 60; // 07:00
export const PRET_HOT_SERVICE_END_MIN = 16 * 60; // 16:00
/** Where the simulated demo clock starts — straight into the lunch rush. */
export const PRET_HOT_DEMO_START_MIN = 12 * 60 + 10; // 12:10
/** The fixed batch cadence the whole hot-line model is built around. */
export const PRET_HOT_BATCH_INTERVAL_MIN = 30;

/** Warm orange accent — "hot" reads at a glance on the floor screen. */
export const PRET_HOT_ACCENT = '#c2410c';

// ─────────────────────────────────────────────────────────────────────────────
// Hot-prod menu items — what the line bakes / presses / reheats + holds.
// Each carries its own batch size, cook time, hold life and a day-total
// forecast so the closed-loop sim (pretHotLoopStore) can drive the screen.
// ─────────────────────────────────────────────────────────────────────────────

export type PretHotItem = {
  recipeId: RecipeId;
  /** Short name the crew reads at a glance (overrides the library name). */
  name: string;
  /** Default batch size the line drops. */
  batchSize: number;
  /** Round drops up to this multiple. */
  multipleOf: number;
  /** Minutes a batch takes to bake / press / reheat. */
  cookMinutes: number;
  /** Hold life on the shelf before it has to be pulled (minutes). */
  shelfLifeMin: number;
  /** Forecast units across the whole service day — drives the demand curve. */
  dayTotal: number;
};

export const PRET_HOT_ITEMS: PretHotItem[] = [
  { recipeId: 'prec-ham-cheese-toastie',     name: 'Ham & cheese toastie',       batchSize: 4, multipleOf: 2, cookMinutes: 5, shelfLifeMin: 45,  dayTotal: 72 },
  { recipeId: 'prec-mozzarella-tomato-melt', name: 'Mozzarella & tomato melt',   batchSize: 4, multipleOf: 2, cookMinutes: 5, shelfLifeMin: 45,  dayTotal: 54 },
  { recipeId: 'prec-mac-cheese-toastie',     name: 'Mac & cheese toastie',       batchSize: 4, multipleOf: 2, cookMinutes: 5, shelfLifeMin: 45,  dayTotal: 40 },
  { recipeId: 'prec-cheddar-pickle-toastie', name: 'Cheddar & pickle toastie',   batchSize: 4, multipleOf: 2, cookMinutes: 5, shelfLifeMin: 45,  dayTotal: 34 },
  { recipeId: 'prec-sausage-roll',           name: 'Sausage roll',               batchSize: 6, multipleOf: 2, cookMinutes: 9, shelfLifeMin: 90,  dayTotal: 64 },
  { recipeId: 'prec-hot-croissant',          name: 'Hot croissant',              batchSize: 6, multipleOf: 2, cookMinutes: 6, shelfLifeMin: 60,  dayTotal: 46 },
  { recipeId: 'prec-mac-cheese-pot',         name: 'Mac & cheese pot',           batchSize: 4, multipleOf: 1, cookMinutes: 7, shelfLifeMin: 120, dayTotal: 30 },
  { recipeId: 'prec-tomato-basil-soup',      name: 'Tomato & basil soup',        batchSize: 3, multipleOf: 1, cookMinutes: 8, shelfLifeMin: 150, dayTotal: 26 },
  { recipeId: 'prec-chicken-soup',           name: 'Free-range chicken soup',    batchSize: 3, multipleOf: 1, cookMinutes: 8, shelfLifeMin: 150, dayTotal: 22 },
];

/** Look up a hot item by recipe id. */
export function pretHotItem(recipeId: RecipeId): PretHotItem | undefined {
  return PRET_HOT_ITEMS.find(i => i.recipeId === recipeId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Holding shelf — initial seed state (counts decay live in pretHotLoopStore).
// A realistic mid-service shelf: a few toasties + a melt going, soup topped up.
// ─────────────────────────────────────────────────────────────────────────────

export type PretHotShelfSeed = {
  recipeId: RecipeId;
  /** Units currently on the shelf. */
  count: number;
  /** How long ago (demo minutes) the batch was made — drives time-to-pull. */
  cookedMinAgo: number;
};

export const PRET_HOT_SHELF_SEED: PretHotShelfSeed[] = [
  { recipeId: 'prec-ham-cheese-toastie',     count: 5, cookedMinAgo: 12 },
  { recipeId: 'prec-mozzarella-tomato-melt', count: 3, cookedMinAgo: 18 },
  { recipeId: 'prec-mac-cheese-toastie',     count: 2, cookedMinAgo: 9 },
  { recipeId: 'prec-sausage-roll',           count: 6, cookedMinAgo: 24 },
  { recipeId: 'prec-hot-croissant',          count: 3, cookedMinAgo: 16 },
  { recipeId: 'prec-tomato-basil-soup',      count: 4, cookedMinAgo: 40 },
  { recipeId: 'prec-chicken-soup',           count: 3, cookedMinAgo: 55 },
];

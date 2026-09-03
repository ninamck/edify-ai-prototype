/**
 * Farmer J in the production fixture graph: every shop as a `Site`, its
 * service lines and its kitchen stations as `Bench` rows.
 *
 * A Farmer J "line" is a bench with `channels`. The main line plates cast
 * irons for the counter; the second make line plates small containers for
 * Deliveroo, Click & Collect and catering. The planner needs two extra
 * facts about a line: which sales channels land on it, and whether it
 * plates in half batches (small containers).
 *
 * The kitchen benches (hot section, salads, basement prep, breakfast) have
 * no channels. They own kit (two ovens of six trays and two rice cookers on
 * the hot section is what sizes cook loads) and they take work by role
 * (`sections`), which is what puts them on the Sections board as cards. A
 * line can take work too: the second make line plates and packs, so it is
 * on the board; the main line is not.
 *
 * The rows below are the company defaults. Jana edits them once on Setup
 * (stored as the `fj-all-shops` overlay in the site settings store) and a
 * shop's GM can override its own on the shop's Benches tab. The resolver
 * in `siteSettingsStore` cascades fixture → company → shop.
 *
 * Imports only types from `../fixtures` so there is no runtime cycle.
 */

import type { Bench, DayOfWeek, Site } from '../fixtures';
import { DEEP_CLEAN_DAY, DEFAULT_PRODUCTION_DAYS, SHOP_PRODUCTION_DAY_OVERRIDES, type Section as WorkRole, type ShelfLifeGroupId, type Weekday } from './recipes';
import { FJ_ALL_SHOPS_ID, FJ_SHOPS } from './shops';

export const FJ_ESTATE_ID = 'estate-farmerj';
export const FJ_FORMAT_ID = 'format-fj-shop';

/** Most lines a shop can run. Jana asked for five for now. */
export const FJ_MAX_LINES = 5;

/**
 * The kinds of work the planner drafts, each of which has to land on a
 * bench. Setup ticks the roles a bench takes; a role nobody takes shows on
 * the board as its own card with a warning.
 */
export const FJ_WORK_ROLES: { id: WorkRole; label: string; what: string }[] = [
  { id: 'hot', label: 'Hot cooking', what: 'Oven and cooker loads for the hot products, timed off the sales curve.' },
  { id: 'breakfast', label: 'Breakfast', what: 'Breakfast cooking and prep for the early open. Breakfast shops only.' },
  { id: 'salads', label: 'Salads', what: 'Salad kits, then dressing and plating in two waves.' },
  { id: 'prep', label: 'Prep', what: 'Today\'s prep in the morning, tomorrow\'s and the make-ahead groups after.' },
  { id: 'second', label: 'Second line', what: 'Plating small containers before open and packing catering orders to time.' },
];
export const FJ_WORK_ROLE_BY_ID: Record<WorkRole, { id: WorkRole; label: string; what: string }> = Object.fromEntries(FJ_WORK_ROLES.map(r => [r.id, r])) as Record<WorkRole, { id: WorkRole; label: string; what: string }>;

/** Bench ids are shared across shops so a company edit lands on every shop. */
export const FJ_MAIN_LINE_ID = 'fj-line-main';
export const FJ_SECOND_LINE_ID = 'fj-line-second';

type LineTemplate = Omit<Bench, 'siteId'>;

/** The two lines every shop opens with, from the calls. */
export const FJ_LINE_TEMPLATES: LineTemplate[] = [
  {
    id: FJ_MAIN_LINE_ID,
    name: 'Main line',
    capabilities: ['assemble', 'front-of-house'],
    workTypes: ['assemble', 'portion'],
    equipment: ['counter'],
    online: true,
    primaryMode: 'variable',
    halfBatches: false,
    channels: ['instore', 'kiosk'],
  },
  {
    id: FJ_SECOND_LINE_ID,
    name: 'Second make line',
    capabilities: ['assemble', 'pack'],
    workTypes: ['assemble', 'portion', 'pack'],
    equipment: ['prep-table'],
    online: true,
    primaryMode: 'variable',
    halfBatches: true,
    channels: ['deliveroo', 'clickcollect', 'corporate', 'citypantry', 'ordit'],
    sections: ['second'],
  },
];

export const FJ_HOT_SECTION_ID = 'fj-kitchen-hot';
export const FJ_PREP_KITCHEN_ID = 'fj-kitchen-prep';
export const FJ_SALADS_ID = 'fj-kitchen-salads';
export const FJ_BREAKFAST_ID = 'fj-kitchen-breakfast';

/** The kitchen benches: they own the kit and take the work. No channels: nothing plates here. */
export const FJ_KITCHEN_TEMPLATES: LineTemplate[] = [
  {
    id: FJ_HOT_SECTION_ID,
    name: 'Hot section',
    capabilities: ['oven', 'prep'],
    workTypes: ['bake', 'grill', 'portion'],
    equipment: ['oven', 'rice-cooker', 'hob'],
    kit: [
      { equipment: 'oven', count: 2, capacity: 6 },
      { equipment: 'rice-cooker', count: 2 },
    ],
    online: true,
    primaryMode: 'variable',
    sections: ['hot'],
  },
  {
    id: FJ_BREAKFAST_ID,
    name: 'Breakfast',
    capabilities: ['oven', 'prep'],
    workTypes: ['bake', 'grill', 'portion'],
    equipment: ['hob', 'oven'],
    kit: [
      { equipment: 'hob', count: 1 },
    ],
    online: true,
    primaryMode: 'variable',
    sections: ['breakfast'],
  },
  {
    id: FJ_SALADS_ID,
    name: 'Salads',
    capabilities: ['prep', 'assemble'],
    workTypes: ['mix', 'assemble', 'portion'],
    equipment: ['prep-table'],
    kit: [],
    online: true,
    primaryMode: 'variable',
    sections: ['salads'],
  },
  {
    id: FJ_PREP_KITCHEN_ID,
    name: 'Basement prep',
    capabilities: ['prep', 'cold-prep'],
    workTypes: ['slice', 'mix', 'portion'],
    equipment: ['food-processor', 'prep-table', 'walk-in-chiller'],
    kit: [
      { equipment: 'food-processor', count: 1 },
    ],
    online: true,
    primaryMode: 'variable',
    sections: ['prep'],
  },
];

export const FJ_BENCH_TEMPLATES: LineTemplate[] = [...FJ_LINE_TEMPLATES, ...FJ_KITCHEN_TEMPLATES];

/** A line is a bench that plates for sales channels; kitchen benches do not. */
export function isFjLine(b: Pick<Bench, 'channels'>): boolean {
  return Array.isArray(b.channels);
}

export const FJ_SITES: Site[] = [
  {
    id: FJ_ALL_SHOPS_ID,
    estateId: FJ_ESTATE_ID,
    formatId: FJ_FORMAT_ID,
    name: 'Farmer J · All shops',
    type: 'STANDALONE',
    brand: 'farmerj',
    openingHours: { open: '07:30', close: '21:00' },
    linkType: 'self',
  },
  ...FJ_SHOPS.map<Site>(shop => ({
    id: shop.id,
    estateId: FJ_ESTATE_ID,
    formatId: FJ_FORMAT_ID,
    name: `Farmer J ${shop.name}`,
    type: 'STANDALONE',
    brand: 'farmerj',
    openingHours: { open: shop.opensAt, close: shop.closesAt },
    linkType: 'self',
  })),
];

export const FJ_BENCHES: Bench[] = FJ_SITES.flatMap(site =>
  FJ_BENCH_TEMPLATES.map<Bench>(t => ({ ...t, siteId: site.id })),
);

// ─── Make-on days as production windows ──────────────────────────────────────
//
// Farmer J does not run Pret's P1/P2/VP windows. What its week looks like is
// which shelf-life groups get made on which day, and the Thursday deep
// clean. Both live in the same `windows` slot of the site settings store, so
// the cascade (company default → shop override) and the Settings tab are the
// ones every other brand already has.

export const FJ_DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Farmer J's recipe book counts Monday as 0; the settings store uses names. */
export const weekdayToDay = (w: Weekday): DayOfWeek => FJ_DAYS_OF_WEEK[w];
export const dayToWeekday = (d: DayOfWeek): Weekday => FJ_DAYS_OF_WEEK.indexOf(d) as Weekday;

export type MakeOnWindow = { makeOn: Record<string, boolean>; deepClean?: boolean };

function makeOnFor(days: Record<ShelfLifeGroupId, Weekday[]>, w: Weekday): Record<string, boolean> {
  return Object.fromEntries(
    (Object.keys(days) as ShelfLifeGroupId[]).map(g => [g, days[g].includes(w)]),
  );
}

/** Company defaults, straight from the recipe book. */
export const FJ_DEFAULT_WINDOWS: Record<DayOfWeek, MakeOnWindow> = Object.fromEntries(
  FJ_DAYS_OF_WEEK.map((d, i) => {
    const w = i as Weekday;
    const win: MakeOnWindow = { makeOn: makeOnFor(DEFAULT_PRODUCTION_DAYS, w) };
    if (w === DEEP_CLEAN_DAY) win.deepClean = true;
    return [d, win];
  }),
) as Record<DayOfWeek, MakeOnWindow>;

/**
 * Shop overrides the book already knows about (Marylebone makes its 3-day
 * dressings Tuesday and Friday). Seeded into the store as the shop's own
 * overlay the first time the demo runs, so they show as overrides and can be
 * reset like any other. An overridden group is written for all seven days so
 * a later company change leaves the shop's week alone.
 */
export const FJ_SEED_WINDOWS: Record<string, Partial<Record<DayOfWeek, MakeOnWindow>>> = Object.fromEntries(
  Object.entries(SHOP_PRODUCTION_DAY_OVERRIDES).map(([shopId, groups]) => {
    const perDay: Partial<Record<DayOfWeek, MakeOnWindow>> = {};
    for (const [g, days] of Object.entries(groups) as [ShelfLifeGroupId, Weekday[]][]) {
      for (let w = 0 as Weekday; w < 7; w = (w + 1) as Weekday) {
        const on = days.includes(w);
        const d = weekdayToDay(w);
        perDay[d] = { makeOn: { ...(perDay[d]?.makeOn ?? {}), [g]: on } };
      }
    }
    return [shopId, perDay];
  }),
);

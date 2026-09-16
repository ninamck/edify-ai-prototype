/**
 * siteSetupFixtures — data for the "set up new sites" Command Centre
 * wizard (Pret UK rollout demo).
 *
 * Three data sets:
 *   • NEW_SITES — shops held in ShopDB (Pret's shop database) that are
 *     not yet in Edify. Sites are NOT held in Workday. ShopDB carries
 *     the property record: name, site code, profit centre, address,
 *     opening date, delivery windows, delivery contact. Step 1 syncs
 *     that record and shows every field filled in and editable. Each
 *     entry also carries the staff roster, which DOES come from
 *     Workday (the HR system) once the shop is matched by name.
 *     (Pret PRD review, 9 Sep 2026: "ShopDB is our database where we
 *     hold information about shops.")
 *   • TEMPLATE_SHOPS — live Pret shops a new site can copy its setup
 *     from: range, tier-per-day pattern, production week, selection
 *     times, permissions.
 *   • RANGES — the range/tier ladders. Tiers are modelled as ordered
 *     supersets (a "floor"): each tier's recipe count is cumulative,
 *     tier N contains everything in tier N−1 plus more. Picking a tier
 *     for a day gives the shop that whole menu — recipes are never
 *     assigned to a site by hand. The only shop-level food choice is
 *     flexible lines (tagged products a shop may opt out of). This is
 *     the target model from the Site Setup at Scale PRD (4.6), not the
 *     folder-per-tier model in the current production codebase.
 *
 * Pure data + tiny lookups. No React.
 */

// ─── Days ────────────────────────────────────────────────────────────────────

export type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export const DAY_KEYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAY_KEYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const WEEKEND_KEYS: DayKey[] = ['Sat', 'Sun'];

// ─── Dates ───────────────────────────────────────────────────────────────────
//
// Opening dates come from ShopDB as ISO days (YYYY-MM-DD). Go-live in
// Edify is a separate date: the team needs access before opening to
// set production and place first orders, so go-live defaults to a few
// days earlier and stays editable.

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** "2026-09-22" → "22 Sep". Unparseable input is returned as typed. */
export function formatDay(iso: string): string {
  const p = parseIso(iso);
  if (!p) return iso;
  return `${p.d} ${MONTHS_SHORT[p.m - 1]}`;
}

/** "2026-09-22" → "22 September". */
export function formatDayLong(iso: string): string {
  const p = parseIso(iso);
  if (!p) return iso;
  return `${p.d} ${MONTHS_LONG[p.m - 1]}`;
}

/** Shift an ISO day by n days (negative = earlier). Uses UTC so the
 *  result never drifts across a DST change. */
export function addDays(iso: string, n: number): string {
  const p = parseIso(iso);
  if (!p) return iso;
  const t = Date.UTC(p.y, p.m - 1, p.d) + n * 86_400_000;
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Whole days from a to b (b − a). 0 when either side is unparseable. */
export function daysBetween(a: string, b: string): number {
  const pa = parseIso(a);
  const pb = parseIso(b);
  if (!pa || !pb) return 0;
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

/** "1 Aug – 31 Aug" for a dated range. */
export function formatDateRange(fromIso: string, toIso: string): string {
  return `${formatDay(fromIso)} – ${formatDay(toIso)}`;
}

/** How many days before ShopDB's opening date the shop goes live in
 *  Edify by default. Natalia (Pret): production must be set the day
 *  before opening at minimum, and first orders placed a couple of days
 *  before that. */
export const DEFAULT_GO_LIVE_OFFSET_DAYS = 3;

// ─── Roles ───────────────────────────────────────────────────────────────────

/** Job title as it appears in Workday. */
export type WorkdayRole =
  | 'General Manager'
  | 'Assistant Manager'
  | 'Area Manager'
  | 'Team Leader'
  | 'Team Member'
  | 'Barista';

/** Edify role, matching Edify main's user roles: Employee, Manager,
 *  Admin. Managers carry the standard shop permission set on top
 *  (suppliers, products, recipes, checklists, dashboards, deliveries,
 *  stocktakes, production settings). */
export type EdifyRole = 'Admin' | 'Manager' | 'Employee';

export const EDIFY_ROLES: EdifyRole[] = ['Employee', 'Manager', 'Admin'];

/** Default Workday job → Edify role mapping. Managers of any flavour
 *  land on Manager; everyone else is an Employee. */
export function defaultEdifyRole(workdayRole: WorkdayRole): EdifyRole {
  if (
    workdayRole === 'General Manager' ||
    workdayRole === 'Assistant Manager' ||
    workdayRole === 'Area Manager'
  ) {
    return 'Manager';
  }
  return 'Employee';
}

export interface WorkdayPerson {
  id: string;
  name: string;
  workdayRole: WorkdayRole;
}

// ─── Ranges & tier ladders ──────────────────────────────────────────────────

export interface RangeLadder {
  id: string;
  name: string;
  /** Fits a day cell in the tier strip ("LW"). */
  short: string;
  /** One line under the name in the range picker. */
  descriptor: string;
  /** Cumulative recipe count per tier, index 0 = tier 1. Tier N is a
   *  superset of tier N−1, so counts only ever grow. */
  tierRecipes: number[];
}

/** Pret runs many ranges, so the picker is a searchable dropdown, not
 *  a pill row. The first three are the ones the copied shops use. */
export const RANGES: RangeLadder[] = [
  { id: 'regional',      name: 'Regional',           short: 'Reg',  descriptor: 'High streets outside London',          tierRecipes: [96, 148, 185, 212, 236, 251] },
  { id: 'london-worker', name: 'London Worker',      short: 'LW',   descriptor: 'Central London, weekday office trade', tierRecipes: [104, 162, 199, 228, 249, 262] },
  { id: 'transport-hub', name: 'Transport Hub',      short: 'TH',   descriptor: 'Stations and interchanges',            tierRecipes: [88, 132, 171, 198, 221, 240] },
  { id: 'london-mix',    name: 'London Mix',         short: 'LMix', descriptor: 'London shops with weekend footfall',   tierRecipes: [102, 158, 194, 224, 246, 260] },
  { id: 'airport',       name: 'Airport',            short: 'Air',  descriptor: 'Airside and landside, long hours',     tierRecipes: [84, 126, 164, 190, 214, 232] },
  { id: 'motorway',      name: 'Motorway Services',  short: 'MSA',  descriptor: 'Roadside, grab and go',                tierRecipes: [72, 110, 142, 168, 188, 204] },
  { id: 'veggie',        name: 'Veggie Pret',        short: 'Veg',  descriptor: 'Vegetarian and vegan only',            tierRecipes: [78, 118, 150, 176, 198, 212] },
  { id: 'scotland',      name: 'Scotland',           short: 'Scot', descriptor: 'Scottish shops, regional lines',       tierRecipes: [92, 142, 180, 206, 230, 246] },
];

export function getRange(id: string): RangeLadder | undefined {
  return RANGES.find((r) => r.id === id);
}

/** Highest tier a shop sits on in the week: the union of its menus. */
export function maxTier(tiers: Record<DayKey, number>): number {
  return Math.max(...DAY_KEYS.map((d) => tiers[d] ?? 1));
}

/**
 * A shop's menu for a day is a range and a tier, and both can change
 * with the day: London Worker Tier 4 Monday to Friday, London Mix
 * Tier 2 at the weekend. `RangeByDay` sits alongside the tier pattern
 * with the same keys.
 */
export type RangeByDay = Record<DayKey, string>;

/** A template shop's range per day, overrides applied. */
export function templateRanges(t: Pick<TemplateShop, 'rangeId' | 'rangeOverrides'>): RangeByDay {
  return { ...allDays(t.rangeId), ...(t.rangeOverrides ?? {}) } as RangeByDay;
}

/** Distinct ranges a shop uses across the week, in day order. */
export function rangeIdsUsed(ranges: RangeByDay): string[] {
  const out: string[] = [];
  for (const d of DAY_KEYS) if (!out.includes(ranges[d])) out.push(ranges[d]);
  return out;
}

/** "London Worker" or "London Worker + London Mix". */
export function describeRanges(ranges: RangeByDay): string {
  return rangeIdsUsed(ranges).map((id) => getRange(id)?.name ?? id).join(' + ');
}

// ─── Dated tier changes ──────────────────────────────────────────────────────
//
// A shop's tier pattern can change for a period and revert: Crown
// Passage sits on Tier 2 Mon–Fri but moved to Tier 1 for August
// (Wojciech, Pret). Each schedule is an effective-from / effective-to
// window with its own day → tier pattern; outside the window the
// shop's regular pattern applies.

export interface TierSchedule {
  id: string;
  /** ISO days, inclusive. */
  from: string;
  to: string;
  ranges: RangeByDay;
  tiers: Record<DayKey, number>;
}

/** Per site → dated changes, in date order. */
export type TierSchedules = Record<string, TierSchedule[]>;

/** "Regional · Tier 1 all week · 1 Aug – 31 Aug". */
export function describeTierSchedule(s: TierSchedule): string {
  return `${describeMenuPattern(s.ranges, s.tiers)} · ${formatDateRange(s.from, s.to)}`;
}

/** Recipe count for a tier (1-based) in a range. */
export function recipesAtTier(rangeId: string, tier: number): number {
  const range = getRange(rangeId);
  if (!range) return 0;
  return range.tierRecipes[Math.min(Math.max(tier, 1), range.tierRecipes.length) - 1] ?? 0;
}

/**
 * Compress a 7-day tier pattern into human-readable runs:
 * { Mon:4,…,Thu:4, Fri:2, Sat:2, Sun:2 } → "Tier 4 Mon–Thu · Tier 2 Fri–Sun".
 */
export function describeTierPattern(tiers: Record<DayKey, number>): string {
  const runs: { from: DayKey; to: DayKey; tier: number }[] = [];
  for (const day of DAY_KEYS) {
    const tier = tiers[day];
    const last = runs[runs.length - 1];
    if (last && last.tier === tier) last.to = day;
    else runs.push({ from: day, to: day, tier });
  }
  if (runs.length === 1) return `Tier ${runs[0].tier} all week`;
  return runs
    .map((r) => `Tier ${r.tier} ${r.from === r.to ? r.from : `${r.from}–${r.to}`}`)
    .join(' · ');
}

/** Runs of identical (range, tier) across the week. */
function menuRuns(ranges: RangeByDay, tiers: Record<DayKey, number>): { from: DayKey; to: DayKey; rangeId: string; tier: number }[] {
  const runs: { from: DayKey; to: DayKey; rangeId: string; tier: number }[] = [];
  for (const day of DAY_KEYS) {
    const rangeId = ranges[day];
    const tier = tiers[day];
    const last = runs[runs.length - 1];
    if (last && last.tier === tier && last.rangeId === rangeId) last.to = day;
    else runs.push({ from: day, to: day, rangeId, tier });
  }
  return runs;
}

const dayspan = (r: { from: DayKey; to: DayKey }) => (r.from === r.to ? r.from : `${r.from}–${r.to}`);

/**
 * Range and tier pattern in one line. One range all week:
 * "London Worker · Tier 4 Mon–Thu · Tier 2 Fri–Sun". Ranges that
 * change with the day: "London Worker Tier 4 Mon–Fri · London Mix
 * Tier 2 Sat–Sun".
 */
export function describeMenuPattern(ranges: RangeByDay, tiers: Record<DayKey, number>): string {
  const used = rangeIdsUsed(ranges);
  if (used.length === 1) return `${getRange(used[0])?.name ?? used[0]} · ${describeTierPattern(tiers)}`;
  return menuRuns(ranges, tiers)
    .map((r) => `${getRange(r.rangeId)?.name ?? r.rangeId} Tier ${r.tier} ${dayspan(r)}`)
    .join(' · ');
}

/** Same run-compression, but rendering recipe counts:
 *  "212 recipes Mon–Thu · 148 Fri–Sun". */
export function describeRecipeCounts(ranges: RangeByDay, tiers: Record<DayKey, number>): string {
  const runs = menuRuns(ranges, tiers);
  if (runs.length === 1) return `${recipesAtTier(runs[0].rangeId, runs[0].tier)} recipes`;
  return runs
    .map((r, i) => `${recipesAtTier(r.rangeId, r.tier)}${i === 0 ? ' recipes' : ''} ${dayspan(r)}`)
    .join(' · ');
}

// ─── Hubs (CPUs) and site types ─────────────────────────────────────────────

export interface Hub {
  id: string;
  name: string;
}

export const HUBS: Hub[] = [
  { id: 'park-royal',   name: 'Park Royal CPU' },
  { id: 'northern-cpu', name: 'Northern CPU · Leeds' },
  { id: 'midlands-cpu', name: 'Midlands CPU · Birmingham' },
];

export function getHub(id: string): Hub | undefined {
  return HUBS.find((h) => h.id === id);
}

/**
 * Hub linking, mirroring Edify main's Settings → Production →
 * Hub & spoke: one kitchen produces for several shops. A shop is
 * either linked to a hub (it plans daily quantities, the hub makes the
 * combined total and transfers the finished items back) or standalone
 * (everything made in the shop). Pret shops don't order products
 * through Edify — the hub relationship is about where food is made.
 *
 * In the hubs record a site maps to a hub id or to STANDALONE.
 */
export const STANDALONE = 'standalone';

/** Plain-language line under the hub pick. */
export function describeHubLink(hubName: string | undefined): string {
  if (!hubName) return 'No hub. Everything is made in the shop.';
  return `The shop plans its daily quantities; ${hubName} makes the combined total and transfers it back. Cutoffs come with the copy.`;
}

/** Short read-back form: "linked to Northern CPU · Leeds", "standalone". */
export function hubLinkSummary(hubName: string | undefined): string {
  return hubName ? `linked to ${hubName}` : 'standalone';
}

// ─── Template shops (copy sources) ──────────────────────────────────────────

export interface TimeWindow {
  start: string;
  end: string;
}

/** One production run in the copied shop's schedule, mirroring Edify
 *  main's Production settings: a bench window (when the run is made)
 *  and a sales-forecast window (the sales period used to predict
 *  quantities), plus the per-category refinements of that forecast
 *  window. All copied with the shop. */
export interface ProductionRun {
  name: string;
  bench: TimeWindow;
  forecast: TimeWindow;
  categories: Record<string, TimeWindow>;
}

/** Per site → per day → that day's runs. */
export type SiteProductionSchedules = Record<string, Record<DayKey, ProductionRun[]>>;

const toMins = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (mins: number): string =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** Category refinements of a run's forecast window, as a copied shop
 *  would have tuned them: bakery sells early, hot food later. */
function deriveCategoryWindows(forecast: TimeWindow): Record<string, TimeWindow> {
  const s = toMins(forecast.start);
  const e = toMins(forecast.end);
  return {
    'Croissants & bakery': { start: forecast.start, end: toTime(Math.min(s + 180, e)) },
    'Sandwiches & baguettes': { ...forecast },
    'Hot food': { start: toTime(Math.min(s + 60, e)), end: forecast.end },
    'Salads & bowls': { ...forecast },
  };
}

// ─── Benches & hot production ────────────────────────────────────────────────
//
// Mirrors the Benches and Hot production tabs on the Production
// settings page: bench count, production stations (hot-food recipes
// made together on a timed batch cycle), full-selection times (at a
// set time, top up the forecast with a fixed extra quantity of chosen
// recipes), the default planner window, Product Control Review, and
// the carry-over adjustment setting. All copied with the shop.
//
// Times differ by day of week. Wojciech (Pret): one setting currently
// applies to the whole week, but weekends have different opening
// hours and expectations. So the planner window, the full-selection
// times and each station's batch cycle are held per day; the
// stations themselves (name, recipes, min / max / multiple) and the
// two review switches are week-wide.

export interface HotStation {
  name: string;
  /** Batch cycle per day: how often a new batch starts. */
  slotMins: Record<DayKey, number>;
  /** Recipes assigned to the station's batch cycle. */
  recipes: string[];
  /** Min / max batch size and rounding multiple. 0 = none. */
  min: number;
  max: number;
  multiple: number;
}

export interface FullSelectionRow {
  time: string;
  recipes: string[];
  qty: number;
}

/** The settings that change with the day. */
export interface HotDaySettings {
  plannerWindow: TimeWindow;
  fullSelectionTimes: FullSelectionRow[];
}

export interface BenchesHotSetup {
  stations: HotStation[];
  byDay: Record<DayKey, HotDaySettings>;
  productControlReview: boolean;
  /** Include bench-assigned productions in carry-over adjustments. */
  carryOverBenchAssigned: boolean;
}

/** Same value every day. */
export function allDays<T>(value: T): Record<DayKey, T> {
  return Object.fromEntries(DAY_KEYS.map((d) => [d, value])) as Record<DayKey, T>;
}

/** Weekday value Mon–Fri, weekend value Sat–Sun. */
export function weekSplit<T>(weekday: T, weekend: T): Record<DayKey, T> {
  return Object.fromEntries(DAY_KEYS.map((d) => [d, WEEKEND_KEYS.includes(d) ? weekend : weekday])) as Record<DayKey, T>;
}

/** Compress a per-day value into runs: "60 min Mon–Fri · 90 min Sat–Sun". */
export function describeByDay<T>(byDay: Record<DayKey, T>, render: (v: T) => string): string {
  const runs: { from: DayKey; to: DayKey; text: string }[] = [];
  for (const day of DAY_KEYS) {
    const text = render(byDay[day]);
    const last = runs[runs.length - 1];
    if (last && last.text === text) last.to = day;
    else runs.push({ from: day, to: day, text });
  }
  if (runs.length === 1) return runs[0].text;
  return runs
    .map((r) => `${r.text} ${r.from === r.to ? r.from : `${r.from}–${r.to}`}`)
    .join(' · ');
}

/** "2 full-selection times weekdays, 1 weekends" (or one figure when
 *  the week is uniform). */
export function describeFullSelectionCounts(byDay: Record<DayKey, HotDaySettings>): string {
  const wk = byDay.Mon.fullSelectionTimes.length;
  const we = byDay.Sat.fullSelectionTimes.length;
  const uniform = DAY_KEYS.every((d) => byDay[d].fullSelectionTimes.length === (WEEKEND_KEYS.includes(d) ? we : wk));
  if (uniform && wk === we) return `${wk} full-selection time${wk === 1 ? '' : 's'}`;
  if (uniform) return `${wk} full-selection time${wk === 1 ? '' : 's'} weekdays, ${we} weekends`;
  return describeByDay(byDay, (d) => `${d.fullSelectionTimes.length} full-selection`);
}

export type SiteBenchesHot = Record<string, BenchesHotSetup>;

/** Hot recipes a station can be assigned, for the add-recipe search. */
export const HOT_RECIPE_POOL = {
  bakery: [
    'All Butter Croissant',
    'Pain au Chocolat',
    'Almond Croissant',
    'Ham & Cheese Croissant',
    'Mozz & Tomato Croissant',
    'Pain aux Raisins',
    'Cinnamon Danish',
    'Chocolate Chunk Cookie',
    'Berry Muffin',
    'Cheese Twist',
    'Sausage Roll',
    'Vegan Sausage Roll',
  ],
  hotChef: [
    'Hot Wrap Swedish Meatball',
    'Hot Wrap Chipotle Chicken',
    'Falafel Hot Wrap',
    'Mac & Cheese',
    'Mac & Cheese Prosciutto',
    'Soup Chicken Laksa',
    'Tomato Soup',
    'Chicken Miso Soup',
    'Leek & Potato Soup',
    'Cheese Toastie',
    'Ham & Cheese Toastie',
    'Tuna Melt Toastie',
    'Chorizo Toastie',
    'Bacon Roll',
    'Sausage Bap',
    'Meatball Baguette',
    'Chicken Katsu Pot',
    'Veggie Chilli Pot',
  ],
};

export const ALL_HOT_RECIPES = [...HOT_RECIPE_POOL.bakery, ...HOT_RECIPE_POOL.hotChef];

/** Station builder. `weekendSlotMins` lets the weekend batch cycle
 *  differ (slower trade, longer cycle). */
const station = (
  name: string,
  slotMins: number,
  recipes: string[],
  min = 0,
  max = 0,
  multiple = 0,
  weekendSlotMins = slotMins,
): HotStation => ({
  name,
  slotMins: weekSplit(slotMins, weekendSlotMins),
  recipes,
  min,
  max,
  multiple,
});

/** Per-day hot settings from a weekday and a weekend definition. */
const hotDays = (weekday: HotDaySettings, weekend: HotDaySettings): Record<DayKey, HotDaySettings> =>
  weekSplit(weekday, weekend);

function cloneDay(d: HotDaySettings): HotDaySettings {
  return {
    plannerWindow: { ...d.plannerWindow },
    fullSelectionTimes: d.fullSelectionTimes.map((r) => ({ ...r, recipes: [...r.recipes] })),
  };
}

/** Hot production for a new site, deep-copied from its copied shop so
 *  edits don't leak between sites or between days. */
export function defaultBenchesHot(templateId: string): BenchesHotSetup {
  const src = getTemplateShop(templateId)?.benchesHot;
  if (!src) {
    const empty: HotDaySettings = { plannerWindow: { start: '05:00', end: '18:00' }, fullSelectionTimes: [] };
    return {
      stations: [],
      byDay: Object.fromEntries(DAY_KEYS.map((d) => [d, cloneDay(empty)])) as Record<DayKey, HotDaySettings>,
      productControlReview: true,
      carryOverBenchAssigned: true,
    };
  }
  return {
    stations: src.stations.map((s) => ({ ...s, slotMins: { ...s.slotMins }, recipes: [...s.recipes] })),
    byDay: Object.fromEntries(DAY_KEYS.map((d) => [d, cloneDay(src.byDay[d])])) as Record<DayKey, HotDaySettings>,
    productControlReview: src.productControlReview,
    carryOverBenchAssigned: src.carryOverBenchAssigned,
  };
}

export interface TemplateShop {
  id: string;
  name: string;
  /** Short human descriptor shown under the pick ("High street · full range"). */
  descriptor: string;
  /** Range most days. */
  rangeId: string;
  /** Days on a different range (Villiers: London Mix at the weekend). */
  rangeOverrides?: Partial<Record<DayKey, string>>;
  hubId: string;
  tierByDay: Record<DayKey, number>;
  /** The production runs the copy brings, per day. */
  productionRuns: ProductionRun[];
  /** Benches the runs are assigned across. */
  benches: number;
  /** Hot production settings the copy brings. */
  benchesHot: BenchesHotSetup;
}

/** Per-day run schedules for a new site, seeded from its copied shop.
 *  Deep-copied per day so edits to one day (or one site) don't leak. */
export function defaultRunSchedules(templateId: string): Record<DayKey, ProductionRun[]> {
  const runs = getTemplateShop(templateId)?.productionRuns ?? [];
  const copy = (): ProductionRun[] => runs.map((r) => ({
    name: r.name,
    bench: { ...r.bench },
    forecast: { ...r.forecast },
    categories: Object.fromEntries(
      Object.entries(r.categories).map(([cat, w]) => [cat, { ...w }]),
    ),
  }));
  return Object.fromEntries(DAY_KEYS.map((d) => [d, copy()])) as Record<DayKey, ProductionRun[]>;
}

const tiers7 = (mon: number, tue: number, wed: number, thu: number, fri: number, sat: number, sun: number): Record<DayKey, number> => ({
  Mon: mon, Tue: tue, Wed: wed, Thu: thu, Fri: fri, Sat: sat, Sun: sun,
});

const run = (name: string, benchStart: string, benchEnd: string, fcStart: string, fcEnd: string): ProductionRun => ({
  name,
  bench: { start: benchStart, end: benchEnd },
  forecast: { start: fcStart, end: fcEnd },
  categories: deriveCategoryWindows({ start: fcStart, end: fcEnd }),
});

export const TEMPLATE_SHOPS: TemplateShop[] = [
  {
    id: 'villiers',
    name: 'Villiers Street',
    descriptor: 'London high street · worker range weekdays, mix at weekends',
    rangeId: 'london-worker',
    rangeOverrides: { Sat: 'london-mix', Sun: 'london-mix' },
    hubId: 'park-royal',
    tierByDay: tiers7(4, 4, 4, 4, 4, 2, 2),
    productionRuns: [
      run('Production 1', '05:00', '07:00', '06:00', '11:00'),
      run('Production 2', '10:30', '12:00', '11:00', '15:00'),
    ],
    benches: 3,
    benchesHot: {
      stations: [
        station('Bakery', 60, HOT_RECIPE_POOL.bakery.slice(0, 10), 2, 12, 0, 90),
        station('Hot Chef', 30, HOT_RECIPE_POOL.hotChef.slice(0, 14), 1, 6, 0, 45),
      ],
      byDay: hotDays(
        {
          plannerWindow: { start: '05:00', end: '18:00' },
          fullSelectionTimes: [
            { time: '05:00', recipes: ['All Butter Croissant', 'Pain au Chocolat'], qty: 2 },
            { time: '07:30', recipes: ['Sausage Roll'], qty: 1 },
          ],
        },
        {
          plannerWindow: { start: '07:00', end: '17:00' },
          fullSelectionTimes: [
            { time: '07:00', recipes: ['All Butter Croissant', 'Pain au Chocolat'], qty: 1 },
          ],
        },
      ),
      productControlReview: true,
      carryOverBenchAssigned: true,
    },
  },
  {
    id: 'crown-passage',
    name: 'Crown Passage',
    descriptor: 'Small London shop · core range',
    rangeId: 'london-worker',
    hubId: 'park-royal',
    tierByDay: tiers7(2, 2, 2, 2, 2, 2, 2),
    productionRuns: [
      run('Production 1', '06:00', '07:30', '07:00', '14:00'),
    ],
    benches: 2,
    benchesHot: {
      stations: [
        station('Bakery', 60, HOT_RECIPE_POOL.bakery.slice(0, 8), 1, 8),
        station('Hot Chef', 30, HOT_RECIPE_POOL.hotChef.slice(0, 10), 1, 4, 0, 45),
      ],
      byDay: hotDays(
        {
          plannerWindow: { start: '06:00', end: '16:00' },
          fullSelectionTimes: [{ time: '06:30', recipes: ['All Butter Croissant'], qty: 1 }],
        },
        {
          plannerWindow: { start: '08:00', end: '15:00' },
          fullSelectionTimes: [],
        },
      ),
      productControlReview: false,
      carryOverBenchAssigned: true,
    },
  },
  {
    id: 'cheapside',
    name: 'Cheapside',
    descriptor: 'City shop · widest weekday range',
    rangeId: 'london-worker',
    hubId: 'park-royal',
    tierByDay: tiers7(5, 5, 5, 5, 5, 3, 3),
    productionRuns: [
      run('Production 1', '05:00', '07:00', '06:00', '11:00'),
      run('Production 2', '10:00', '11:30', '11:00', '14:30'),
      run('Production 3', '14:00', '15:00', '14:30', '18:00'),
    ],
    benches: 4,
    benchesHot: {
      stations: [
        station('Bakery', 60, HOT_RECIPE_POOL.bakery, 2, 12, 2, 90),
        station('Hot Chef', 30, HOT_RECIPE_POOL.hotChef.slice(0, 16), 2, 8, 0, 60),
      ],
      byDay: hotDays(
        {
          plannerWindow: { start: '05:00', end: '18:00' },
          fullSelectionTimes: [
            { time: '05:00', recipes: ['All Butter Croissant', 'Pain au Chocolat', 'Almond Croissant'], qty: 2 },
            { time: '11:30', recipes: ['Mac & Cheese'], qty: 2 },
          ],
        },
        {
          plannerWindow: { start: '07:30', end: '16:00' },
          fullSelectionTimes: [{ time: '07:30', recipes: ['All Butter Croissant'], qty: 1 }],
        },
      ),
      productControlReview: true,
      carryOverBenchAssigned: true,
    },
  },
  {
    id: 'manchester-market-st',
    name: 'Manchester Market Street',
    descriptor: 'Regional high street',
    rangeId: 'regional',
    hubId: 'northern-cpu',
    tierByDay: tiers7(4, 4, 4, 4, 4, 4, 3),
    productionRuns: [
      run('Production 1', '05:30', '07:30', '06:30', '12:00'),
      run('Production 2', '11:00', '12:30', '12:00', '16:00'),
    ],
    benches: 3,
    benchesHot: {
      stations: [
        station('Bakery', 60, HOT_RECIPE_POOL.bakery.slice(0, 9), 2, 10, 0, 90),
        station('Hot Chef', 30, HOT_RECIPE_POOL.hotChef.slice(0, 12), 1, 6, 0, 45),
      ],
      byDay: hotDays(
        {
          plannerWindow: { start: '05:30', end: '17:00' },
          fullSelectionTimes: [
            { time: '06:00', recipes: ['All Butter Croissant', 'Bacon Roll'], qty: 2 },
            { time: '11:30', recipes: ['Tomato Soup', 'Mac & Cheese'], qty: 1 },
          ],
        },
        {
          // Quieter weekend: later start, one morning top-up only.
          plannerWindow: { start: '07:00', end: '17:00' },
          fullSelectionTimes: [{ time: '07:30', recipes: ['All Butter Croissant'], qty: 1 }],
        },
      ),
      productControlReview: true,
      carryOverBenchAssigned: false,
    },
  },
  {
    id: 'st-pancras',
    name: 'St Pancras',
    descriptor: 'Station shop · steady seven-day trade',
    rangeId: 'transport-hub',
    hubId: 'park-royal',
    tierByDay: tiers7(3, 3, 3, 3, 3, 3, 3),
    productionRuns: [
      run('Production 1', '04:30', '06:30', '05:30', '10:30'),
      run('Production 2', '10:00', '11:30', '10:30', '15:00'),
      run('Production 3', '15:00', '16:00', '15:00', '20:00'),
    ],
    benches: 4,
    benchesHot: {
      stations: [
        station('Bakery', 45, HOT_RECIPE_POOL.bakery.slice(0, 11), 2, 12, 2),
        station('Hot Chef', 30, HOT_RECIPE_POOL.hotChef, 2, 10),
      ],
      // Station shop: seven-day trade, so weekends only start later.
      byDay: hotDays(
        {
          plannerWindow: { start: '04:30', end: '20:00' },
          fullSelectionTimes: [
            { time: '04:30', recipes: ['All Butter Croissant', 'Pain au Chocolat'], qty: 3 },
            { time: '16:00', recipes: ['Cheese Toastie'], qty: 2 },
          ],
        },
        {
          plannerWindow: { start: '05:30', end: '20:00' },
          fullSelectionTimes: [
            { time: '05:30', recipes: ['All Butter Croissant', 'Pain au Chocolat'], qty: 2 },
            { time: '16:00', recipes: ['Cheese Toastie'], qty: 2 },
          ],
        },
      ),
      productControlReview: true,
      carryOverBenchAssigned: true,
    },
  },
];

export function getTemplateShop(id: string): TemplateShop | undefined {
  return TEMPLATE_SHOPS.find((t) => t.id === id);
}

// ─── Shop recipes (set by range and tier) ────────────────────────────────────
//
// Recipes are not assigned to a shop by hand. Every product already
// sits in a range at a tier, so giving a shop its range and a tier per
// day gives it the whole menu: the core range is identical for every
// shop on the same range and tier (Wojciech, Pret: "our goal is to
// standardise and control centrally"). The one shop-level choice is
// flexible lines: products carrying the Flexible tag that a shop may
// opt out of after talking to ops. This library is a sample of the
// ladder above (the ladder's counts are the truth for totals); it
// supplies the flexible lines the card lists and the categories the
// read-backs name.

export type RecipeCategory =
  | 'Croissants & bakery'
  | 'Breakfast'
  | 'Sandwiches & baguettes'
  | 'Wraps & flatbreads'
  | 'Hot food & soups'
  | 'Salads & bowls'
  | 'Sweet treats'
  | 'Coffee & drinks';

export const RECIPE_CATEGORIES: RecipeCategory[] = [
  'Croissants & bakery',
  'Breakfast',
  'Sandwiches & baguettes',
  'Wraps & flatbreads',
  'Hot food & soups',
  'Salads & bowls',
  'Sweet treats',
  'Coffee & drinks',
];

export interface ShopRecipe {
  id: string;
  name: string;
  category: RecipeCategory;
  /** Lowest tier that carries it. Tier N includes every tier below. */
  tier: number;
  /** Carries the Flexible tag: a shop may choose not to sell it. */
  flexible: boolean;
}

const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function recipes(category: RecipeCategory, tier: number, names: string[], flexible = false): ShopRecipe[] {
  return names.map((name) => ({ id: slug(name), name, category, tier, flexible }));
}

/** Sample of the ladder. Core lines at tier 1–2; wider lines higher;
 *  flexible lines spread across tiers 2–5. */
export const RECIPE_LIBRARY: ShopRecipe[] = [
  ...recipes('Croissants & bakery', 1, HOT_RECIPE_POOL.bakery.slice(0, 8)),
  ...recipes('Croissants & bakery', 3, HOT_RECIPE_POOL.bakery.slice(8)),
  ...recipes('Breakfast', 1, ['Porridge', 'Bircher Muesli', 'Greek Yoghurt & Granola Pot', 'Egg Mayo Breakfast Baguette']),
  ...recipes('Breakfast', 2, ['Avocado & Egg Brioche', 'Bacon & Egg Brioche', 'Fruit Salad Pot', 'Berry & Yoghurt Pot']),
  ...recipes('Sandwiches & baguettes', 1, [
    'Chicken Caesar & Bacon Baguette',
    'Tuna Mayo & Cucumber Baguette',
    'Egg Mayo & Tomato Baguette',
    'Ham & Greve Baguette',
    'Brie, Tomato & Basil Baguette',
    'Chicken & Avocado Sandwich',
    'Classic Super Club',
    'Posh Cheddar & Pickle Sandwich',
  ]),
  ...recipes('Sandwiches & baguettes', 2, [
    'Egg & Spinach Protein Pot Sandwich',
    'Smoked Salmon & Egg Sandwich',
    'Coronation Chicken Sandwich',
    'Italian Prosciutto Baguette',
    'Falafel & Red Pepper Tapenade Baguette',
    'Roast Chicken & Slaw Sandwich',
    'Chargrilled Chicken & Pesto Baguette',
    'Hummus & Chipotle Veggie Sandwich',
  ]),
  ...recipes('Sandwiches & baguettes', 4, ['Steak & Horseradish Baguette', 'Lobster & Prawn Brioche'], true),
  ...recipes('Sandwiches & baguettes', 3, ['Ham & Cheese Croissant Roll', 'Grab & Go Chicken Wrap Box'], true),
  ...recipes('Wraps & flatbreads', 1, ['Chicken Caesar Wrap', 'Falafel & Halloumi Wrap', 'Tuna Nicoise Wrap', 'Egg & Avocado Wrap']),
  ...recipes('Wraps & flatbreads', 2, ['Chipotle Chicken Flatbread', 'Halloumi & Red Pepper Flatbread', 'Veggie Rainbow Wrap']),
  ...recipes('Wraps & flatbreads', 3, ['Hoisin Duck Wrap'], true),
  ...recipes('Hot food & soups', 1, HOT_RECIPE_POOL.hotChef.slice(0, 10)),
  ...recipes('Hot food & soups', 2, HOT_RECIPE_POOL.hotChef.slice(10, 12)),
  ...recipes('Hot food & soups', 3, HOT_RECIPE_POOL.hotChef.slice(12), true),
  ...recipes('Salads & bowls', 1, ['Chicken Caesar Salad', 'Tuna Nicoise Salad', 'Falafel & Hummus Salad Bowl', 'Greek Salad']),
  ...recipes('Salads & bowls', 2, ['Chef\u2019s Italian Chicken Salad', 'Rainbow Veggie Bowl', 'Chicken & Quinoa Protein Bowl']),
  ...recipes('Salads & bowls', 3, ['Smoked Salmon Salad Bowl', 'Miso Salmon Rice Bowl', 'Superfood Green Bowl'], true),
  ...recipes('Sweet treats', 1, ['Love Bar', 'Chocolate Brownie', 'Lemon Drizzle Slice', 'Carrot Cake Slice', 'Flapjack', 'Millionaire Shortbread']),
  ...recipes('Sweet treats', 2, ['Raspberry & Almond Slice', 'Banana Bread']),
  ...recipes('Sweet treats', 2, ['Popcorn Bar', 'Fruit Scone'], true),
  ...recipes('Coffee & drinks', 1, [
    'Espresso',
    'Americano',
    'Flat White',
    'Latte',
    'Cappuccino',
    'Mocha',
    'Hot Chocolate',
    'Chai Latte',
    'English Breakfast Tea',
    'Fresh Mint Tea',
    'Iced Latte',
  ]),
  ...recipes('Coffee & drinks', 2, ['Matcha Latte', 'Iced Matcha', 'Cold Brew'], true),
];

export function getRecipe(id: string): ShopRecipe | undefined {
  return RECIPE_LIBRARY.find((r) => r.id === id);
}

/** Recipes the shop's week reaches (its highest tier), in category
 *  order. Sample only: totals should come from `coreRecipeCount`. */
export function tierRecipes(tiers: Record<DayKey, number>): ShopRecipe[] {
  const top = maxTier(tiers);
  return RECIPE_LIBRARY.filter((r) => r.tier <= top);
}

/** The flexible lines within the shop's tiers: the only recipes a shop
 *  may untick. */
export function flexibleLines(tiers: Record<DayKey, number>): ShopRecipe[] {
  return tierRecipes(tiers).filter((r) => r.flexible);
}

/** Recipes the shop holds: its biggest day's menu (a tier includes
 *  every tier below it, so the largest day covers the rest). Flexible
 *  lines are part of this number until unticked. */
export function coreRecipeCount(ranges: RangeByDay, tiers: Record<DayKey, number>): number {
  return Math.max(...DAY_KEYS.map((d) => recipesAtTier(ranges[d], tiers[d])));
}

/** Per site → flexible-line recipe ids the operator unticked. Empty =
 *  sell them all. */
export type RecipeExclusions = Record<string, string[]>;

/** "212 recipes · 4 flexible lines" or "210 of 212 recipes · 2 flexible
 *  lines unticked" for one site. */
export function describeFood(ranges: RangeByDay, tiers: Record<DayKey, number>, excluded: string[] | undefined): string {
  const total = coreRecipeCount(ranges, tiers);
  const flex = flexibleLines(tiers).length;
  const dropped = excluded?.length ?? 0;
  if (dropped === 0) return `${total} recipes · ${flex} flexible line${flex === 1 ? '' : 's'}`;
  return `${total - dropped} of ${total} recipes · ${dropped} flexible line${dropped === 1 ? '' : 's'} unticked`;
}

// ─── Forecast Manager check ──────────────────────────────────────────────────
//
// Pret's forecasts come from Forecast Manager (4th) as SKUs per shop,
// not per tier, so the two can drift: a SKU forecast for a shop that
// isn't in its tier would never reach the planner. Natalia (Pret): flag
// it to admins, not GMs, so the office can fix its own set-up. The
// check runs at go-live and is a warning, never a blocker.

const FORECAST_SKUS_OUTSIDE_TIER: Record<string, { name: string; tier: number }[]> = {
  'leeds-trinity': [
    { name: 'Lobster & Prawn Brioche', tier: 5 },
    { name: 'Steak & Horseradish Baguette', tier: 5 },
  ],
  'york-coney-st': [{ name: 'Hoisin Duck Wrap', tier: 4 }],
};

/** SKUs Forecast Manager holds for the shop that sit above the tier
 *  the shop reaches. Empty when the shop's tiers cover them. */
export function forecastMismatches(siteId: string, tiers: Record<DayKey, number>): string[] {
  const top = maxTier(tiers);
  return (FORECAST_SKUS_OUTSIDE_TIER[siteId] ?? []).filter((s) => s.tier > top).map((s) => s.name);
}

// ─── New sites from ShopDB ──────────────────────────────────────────────────

/** Where the shop records come from. Shown as provenance on step 1 and
 *  in the go-live check. */
export const SHOPDB_SOURCE = 'ShopDB';

export interface DeliveryContact {
  name: string;
  position: string;
  phone: string;
}

/**
 * The fields on Edify main's Create site form (Settings → Sites), in
 * the same order. Everything here is editable in step 1. Per-site
 * values come from the ShopDB record; the batch-wide settings ShopDB
 * doesn't hold live in `SharedSiteSettings`.
 */
export interface SiteDetails {
  name: string;
  /** Central Production Unit. ShopDB's shop type: Shop or CPU. */
  isCpu: boolean;
  siteIdentifier: string;
  profitCentre: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  /** ISO day (YYYY-MM-DD) from ShopDB. Go-live defaults to a few days
   *  before it. */
  openingDate: string;
  /** Per day: a window, or null when the shop takes no deliveries. */
  deliveryWindows: Record<DayKey, TimeWindow | null>;
  deliveryContact: DeliveryContact;
  deliveryNotes: string;
  /** PO attachment copies go here. */
  forwardEmails: string[];
}

/** Fields the Create site form marks required. Continue stays off
 *  until every ticked site has them. */
export const REQUIRED_SITE_FIELDS: { key: keyof SiteDetails; label: string }[] = [
  { key: 'name', label: 'Site name' },
  { key: 'addressLine1', label: 'Address line 1' },
  { key: 'city', label: 'City' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'country', label: 'Country' },
];

export function missingRequired(details: SiteDetails): string[] {
  return REQUIRED_SITE_FIELDS
    .filter(({ key }) => String(details[key] ?? '').trim() === '')
    .map(({ label }) => label);
}

/** Non-required fields ShopDB has blank: worth a glance, not a
 *  blocker. */
export function recordGaps(details: SiteDetails): string[] {
  const gaps: string[] = [];
  if (!details.deliveryContact.name.trim()) gaps.push('Delivery contact');
  if (details.deliveryContact.name.trim() && !details.deliveryContact.phone.trim()) gaps.push('Contact phone');
  if (details.forwardEmails.length === 0) gaps.push('Forward email');
  return gaps;
}

/**
 * Settings the Create site form asks for that ShopDB doesn't hold.
 * Assumed once for the whole batch, shown with a one-line why,
 * editable before continue.
 */
export interface SharedSiteSettings {
  timezone: string;
  deliveriesRequireReference: boolean;
  showTheoreticalOnHand: boolean;
  forceTraceabilityTags: boolean;
}

export const DEFAULT_SHARED_SITE_SETTINGS: SharedSiteSettings = {
  timezone: 'Europe/London',
  deliveriesRequireReference: false,
  showTheoreticalOnHand: false,
  forceTraceabilityTags: false,
};

/** "Mon–Sat 05:30–08:00 · Sun none". Same run-compression as tiers. */
export function describeDeliveryWindows(windows: Record<DayKey, TimeWindow | null>): string {
  const key = (w: TimeWindow | null) => (w ? `${w.start}–${w.end}` : 'none');
  const runs: { from: DayKey; to: DayKey; text: string }[] = [];
  for (const day of DAY_KEYS) {
    const text = key(windows[day]);
    const last = runs[runs.length - 1];
    if (last && last.text === text) last.to = day;
    else runs.push({ from: day, to: day, text });
  }
  return runs
    .map((r) => `${r.from === r.to ? r.from : `${r.from}–${r.to}`} ${r.text}`)
    .join(' · ');
}

/** Weekday / Saturday / Sunday delivery windows → the 7-day record.
 *  null = no deliveries that day. */
function deliveries(
  weekday: TimeWindow | null,
  saturday: TimeWindow | null,
  sunday: TimeWindow | null,
): Record<DayKey, TimeWindow | null> {
  const copy = (w: TimeWindow | null) => (w ? { ...w } : null);
  return {
    Mon: copy(weekday), Tue: copy(weekday), Wed: copy(weekday), Thu: copy(weekday), Fri: copy(weekday),
    Sat: copy(saturday), Sun: copy(sunday),
  };
}

export interface NewSite {
  id: string;
  /** ShopDB's own key for the shop. */
  shopDbId: string;
  /** Full name as held in ShopDB (and in Workday, so the roster
   *  matches). */
  name: string;
  /** Short name for card copy ("Leeds Trinity"). */
  shortName: string;
  location: string;
  /** Planned opening, ISO day (YYYY-MM-DD). */
  openingDate: string;
  /** Opening hours from ShopDB — drives full selection defaults. */
  open: { weekday: string; saturday: string; sunday: string };
  /** Edify's suggested copy source + why. */
  suggestedTemplateId: string;
  suggestedReason: string;
  suggestedHubId: string;
  /** The rest of the ShopDB record: what the Create site form needs. */
  record: Omit<SiteDetails, 'name' | 'openingDate'>;
  /** Staff, from Workday, matched to the shop by name. */
  roster: WorkdayPerson[];
}

/** The editable Create-site record for a ShopDB shop. Deep-copied so
 *  edits in one card never leak into the fixture. */
export function detailsFor(site: NewSite): SiteDetails {
  return {
    name: site.name,
    openingDate: site.openingDate,
    ...site.record,
    deliveryWindows: Object.fromEntries(
      DAY_KEYS.map((d) => [d, site.record.deliveryWindows[d] ? { ...site.record.deliveryWindows[d]! } : null]),
    ) as Record<DayKey, TimeWindow | null>,
    deliveryContact: { ...site.record.deliveryContact },
    forwardEmails: [...site.record.forwardEmails],
  };
}

/** Address on one line for registers and read-backs. */
export function oneLineAddress(d: SiteDetails): string {
  return [d.addressLine1, d.addressLine2, `${d.city} ${d.postcode}`.trim()]
    .filter((s) => s && s.trim())
    .join(', ');
}

/** Compact ShopDB-record builder. */
function shopDbRecord(input: {
  code: string;
  profitCentre: string;
  address1: string;
  address2?: string;
  city: string;
  postcode: string;
  deliveries: Record<DayKey, TimeWindow | null>;
  contact: DeliveryContact;
  notes?: string;
  emails?: string[];
}): NewSite['record'] {
  return {
    isCpu: false,
    siteIdentifier: input.code,
    profitCentre: input.profitCentre,
    addressLine1: input.address1,
    addressLine2: input.address2 ?? '',
    city: input.city,
    postcode: input.postcode,
    country: 'United Kingdom',
    deliveryWindows: input.deliveries,
    deliveryContact: input.contact,
    deliveryNotes: input.notes ?? '',
    forwardEmails: input.emails ?? [],
  };
}

/** Compact roster builder — tuples of [name, workdayRole]. */
function roster(siteId: string, people: [string, WorkdayRole][]): WorkdayPerson[] {
  return people.map(([name, workdayRole], i) => ({
    id: `${siteId}-p${i + 1}`,
    name,
    workdayRole,
  }));
}

export const NEW_SITES: NewSite[] = [
  {
    id: 'leeds-trinity',
    shopDbId: 'SHP-4127',
    name: 'Pret Leeds Trinity',
    shortName: 'Leeds Trinity',
    location: 'Trinity Leeds, Albion Street, Leeds LS1',
    openingDate: '2026-09-22',
    open: { weekday: '06:30', saturday: '07:00', sunday: '08:00' },
    suggestedTemplateId: 'manchester-market-st',
    suggestedReason: 'Regional high street, similar footprint',
    suggestedHubId: 'northern-cpu',
    record: shopDbRecord({
      code: '4127',
      profitCentre: '4127-LEEDS-TRI',
      address1: 'Unit 24, Trinity Leeds',
      address2: 'Albion Street',
      city: 'Leeds',
      postcode: 'LS1 5AT',
      deliveries: deliveries({ start: '05:30', end: '08:00' }, { start: '06:00', end: '08:30' }, null),
      contact: { name: 'Hannah Osei', position: 'General Manager', phone: '07700 900412' },
      notes: 'Service yard off Boar Lane. Ring the bell at the roller door.',
      emails: ['leeds.trinity@pret.co.uk'],
    }),
    roster: roster('leeds-trinity', [
      ['Hannah Osei', 'General Manager'],
      ['Marcus Webb', 'Assistant Manager'],
      ['Priya Sharma', 'Area Manager'],
      ['Tom Riley', 'Team Leader'],
      ['Aisha Bello', 'Team Member'],
      ['Jakub Nowak', 'Team Member'],
      ['Sofia Marino', 'Barista'],
      ['Daniel Craven', 'Team Member'],
      ['Leah Whitfield', 'Team Member'],
      ['Omar Haddad', 'Team Member'],
      ['Grace Lindley', 'Barista'],
      ['Callum Doyle', 'Team Member'],
      ['Nadia Ferreira', 'Team Member'],
      ['Ben Ashworth', 'Team Member'],
    ]),
  },
  {
    id: 'manchester-piccadilly',
    shopDbId: 'SHP-4128',
    name: 'Pret Manchester Piccadilly',
    shortName: 'Manchester Piccadilly',
    location: 'Piccadilly Station Approach, Manchester M1',
    openingDate: '2026-09-22',
    open: { weekday: '05:30', saturday: '06:00', sunday: '07:00' },
    suggestedTemplateId: 'st-pancras',
    suggestedReason: 'Station shop, long trading hours',
    suggestedHubId: 'northern-cpu',
    record: shopDbRecord({
      code: '4128',
      profitCentre: '4128-MCR-PICC',
      address1: 'Unit 3, Piccadilly Station Approach',
      city: 'Manchester',
      postcode: 'M1 2PB',
      deliveries: deliveries({ start: '04:30', end: '07:00' }, { start: '05:00', end: '07:30' }, { start: '05:00', end: '07:30' }),
      contact: { name: 'Ryan Fletcher', position: 'General Manager', phone: '07700 900338' },
      notes: 'Station loading bay. Drivers need a Network Rail vehicle pass.',
      emails: ['manchester.piccadilly@pret.co.uk'],
    }),
    roster: roster('manchester-piccadilly', [
      ['Ryan Fletcher', 'General Manager'],
      ['Chioma Eze', 'Assistant Manager'],
      ['David Lindqvist', 'Area Manager'],
      ['Ellie Barrow', 'Team Leader'],
      ['Yusuf Khan', 'Team Member'],
      ['Martyna Kowalczyk', 'Team Member'],
      ['Jordan Pryce', 'Barista'],
      ['Isabella Rossi', 'Team Member'],
      ['Kwame Mensah', 'Team Member'],
      ['Holly Sutcliffe', 'Team Member'],
      ['Andrei Popescu', 'Team Member'],
      ['Megan Tran', 'Barista'],
      ['Lewis Cartwright', 'Team Member'],
      ['Fatima Noor', 'Team Member'],
      ['Sam Ogilvie', 'Team Member'],
    ]),
  },
  {
    id: 'birmingham-grand-central',
    shopDbId: 'SHP-4129',
    name: 'Pret Birmingham Grand Central',
    shortName: 'Birmingham Grand Central',
    location: 'Grand Central, Stephenson Street, Birmingham B2',
    openingDate: '2026-09-29',
    open: { weekday: '06:00', saturday: '06:30', sunday: '07:30' },
    suggestedTemplateId: 'st-pancras',
    suggestedReason: 'Station shop, matching trade pattern',
    suggestedHubId: 'midlands-cpu',
    record: shopDbRecord({
      code: '4129',
      profitCentre: '4129-BHM-GC',
      address1: 'Unit 12, Grand Central',
      address2: 'Stephenson Street',
      city: 'Birmingham',
      postcode: 'B2 4XJ',
      deliveries: deliveries({ start: '05:00', end: '07:30' }, { start: '05:30', end: '08:00' }, { start: '06:00', end: '08:00' }),
      contact: { name: 'Simone Clarke', position: 'General Manager', phone: '07700 900275' },
      notes: 'Goods lift from the Navigation Street dock.',
      emails: ['birmingham.grandcentral@pret.co.uk'],
    }),
    roster: roster('birmingham-grand-central', [
      ['Simone Clarke', 'General Manager'],
      ['Harvey Dunn', 'Assistant Manager'],
      ['Zara Iqbal', 'Team Leader'],
      ['Patrick O\u2019Shea', 'Team Member'],
      ['Lucia Fernandez', 'Team Member'],
      ['Theo Jarvis', 'Barista'],
      ['Amara Diallo', 'Team Member'],
      ['Oliver Stanton', 'Team Member'],
      ['Renata Silva', 'Team Member'],
      ['Josh Whelan', 'Team Member'],
      ['Keira Bowen', 'Barista'],
      ['Adam Szabo', 'Team Member'],
    ]),
  },
  {
    id: 'york-coney-st',
    shopDbId: 'SHP-4130',
    name: 'Pret York Coney Street',
    shortName: 'York Coney Street',
    location: '18 Coney Street, York YO1',
    openingDate: '2026-10-06',
    open: { weekday: '07:00', saturday: '07:00', sunday: '08:00' },
    suggestedTemplateId: 'manchester-market-st',
    suggestedReason: 'Regional high street',
    suggestedHubId: 'northern-cpu',
    // ShopDB gap: no site email on this record.
    record: shopDbRecord({
      code: '4130',
      profitCentre: '4130-YORK-CON',
      address1: '18 Coney Street',
      city: 'York',
      postcode: 'YO1 9NA',
      deliveries: deliveries({ start: '06:00', end: '08:30' }, { start: '06:30', end: '09:00' }, null),
      contact: { name: 'Freya Dalton', position: 'General Manager', phone: '07700 900519' },
      notes: 'Pedestrian zone: vehicles allowed before 10:30 only.',
    }),
    roster: roster('york-coney-st', [
      ['Freya Dalton', 'General Manager'],
      ['Milo Hart', 'Assistant Manager'],
      ['Anya Petrova', 'Team Member'],
      ['George Ferns', 'Team Member'],
      ['Lily Chambers', 'Barista'],
      ['Hassan Farah', 'Team Member'],
      ['Poppy Nield', 'Team Member'],
      ['Ethan Marsh', 'Team Member'],
      ['Carmen Ruiz', 'Team Member'],
      ['Rhys Bevan', 'Team Member'],
    ]),
  },
  {
    id: 'liverpool-one',
    shopDbId: 'SHP-4131',
    name: 'Pret Liverpool One',
    shortName: 'Liverpool One',
    location: 'Liverpool ONE, Paradise Street, Liverpool L1',
    openingDate: '2026-10-06',
    open: { weekday: '06:30', saturday: '07:00', sunday: '08:00' },
    suggestedTemplateId: 'manchester-market-st',
    suggestedReason: 'Regional high street',
    suggestedHubId: 'northern-cpu',
    record: shopDbRecord({
      code: '4131',
      profitCentre: '4131-LPL-ONE',
      address1: 'Unit 8, Liverpool ONE',
      address2: 'Paradise Street',
      city: 'Liverpool',
      postcode: 'L1 8JF',
      deliveries: deliveries({ start: '05:30', end: '08:00' }, { start: '06:00', end: '08:30' }, { start: '07:00', end: '09:00' }),
      contact: { name: 'Niamh Gallagher', position: 'General Manager', phone: '07700 900644' },
      notes: 'Book a slot with Liverpool ONE logistics the day before.',
      emails: ['liverpool.one@pret.co.uk'],
    }),
    roster: roster('liverpool-one', [
      ['Niamh Gallagher', 'General Manager'],
      ['Kofi Antwi', 'Assistant Manager'],
      ['Erin Maddox', 'Team Leader'],
      ['Stefan Ilic', 'Team Member'],
      ['Ruby Latham', 'Team Member'],
      ['Idris Balogun', 'Barista'],
      ['Chloe Winstan', 'Team Member'],
      ['Mateusz Zielinski', 'Team Member'],
      ['Tia Osborne', 'Team Member'],
      ['Finn Docherty', 'Team Member'],
      ['Sana Malik', 'Team Member'],
      ['Jay Herrick', 'Team Member'],
    ]),
  },
  {
    id: 'sheffield-fargate',
    shopDbId: 'SHP-4132',
    name: 'Pret Sheffield Fargate',
    shortName: 'Sheffield Fargate',
    location: '32 Fargate, Sheffield S1',
    openingDate: '2026-10-13',
    open: { weekday: '07:00', saturday: '07:30', sunday: '08:30' },
    suggestedTemplateId: 'manchester-market-st',
    suggestedReason: 'Regional high street',
    suggestedHubId: 'northern-cpu',
    // ShopDB gap: GM named but no phone number on this record.
    record: shopDbRecord({
      code: '4132',
      profitCentre: '4132-SHF-FAR',
      address1: '32 Fargate',
      city: 'Sheffield',
      postcode: 'S1 2HE',
      deliveries: deliveries({ start: '06:00', end: '08:30' }, { start: '06:30', end: '09:00' }, null),
      contact: { name: 'Aaron Blythe', position: 'General Manager', phone: '' },
      emails: ['sheffield.fargate@pret.co.uk'],
    }),
    roster: roster('sheffield-fargate', [
      ['Aaron Blythe', 'General Manager'],
      ['Dina Rashid', 'Assistant Manager'],
      ['Toby Cresswell', 'Team Member'],
      ['Ines Moreau', 'Team Member'],
      ['Zack Palmer', 'Barista'],
      ['Willow Grant', 'Team Member'],
      ['Emeka Obi', 'Team Member'],
      ['Katie Rundle', 'Team Member'],
      ['Luka Horvat', 'Team Member'],
      ['Bea Sanderson', 'Team Member'],
    ]),
  },
  {
    id: 'newcastle-grainger',
    shopDbId: 'SHP-4133',
    name: 'Pret Newcastle Grainger Street',
    shortName: 'Newcastle Grainger Street',
    location: '45 Grainger Street, Newcastle NE1',
    openingDate: '2026-10-13',
    open: { weekday: '06:30', saturday: '07:00', sunday: '08:00' },
    suggestedTemplateId: 'manchester-market-st',
    suggestedReason: 'Regional high street',
    suggestedHubId: 'northern-cpu',
    record: shopDbRecord({
      code: '4133',
      profitCentre: '4133-NCL-GRA',
      address1: '45 Grainger Street',
      city: 'Newcastle upon Tyne',
      postcode: 'NE1 5JE',
      deliveries: deliveries({ start: '05:30', end: '08:00' }, { start: '06:00', end: '08:30' }, null),
      contact: { name: 'Paige Redfern', position: 'General Manager', phone: '07700 900781' },
      notes: 'Rear access via Nun Street. No parking on Grainger Street.',
      emails: ['newcastle.grainger@pret.co.uk'],
    }),
    roster: roster('newcastle-grainger', [
      ['Paige Redfern', 'General Manager'],
      ['Dominic Achebe', 'Assistant Manager'],
      ['Skye Mowbray', 'Team Leader'],
      ['Arjun Nair', 'Team Member'],
      ['Tegan Lowry', 'Team Member'],
      ['Micah Turnbull', 'Barista'],
      ['Elsa Bergstrom', 'Team Member'],
      ['Cormac Quinn', 'Team Member'],
      ['Robyn Faulks', 'Team Member'],
      ['Dev Chauhan', 'Team Member'],
      ['Sadie Whitmore', 'Team Member'],
      ['Leon Marek', 'Team Member'],
    ]),
  },
  {
    id: 'nottingham-clumber',
    shopDbId: 'SHP-4134',
    name: 'Pret Nottingham Clumber Street',
    shortName: 'Nottingham Clumber Street',
    location: '12 Clumber Street, Nottingham NG1',
    openingDate: '2026-10-20',
    open: { weekday: '07:00', saturday: '07:00', sunday: '08:00' },
    suggestedTemplateId: 'manchester-market-st',
    suggestedReason: 'Regional high street',
    suggestedHubId: 'midlands-cpu',
    record: shopDbRecord({
      code: '4134',
      profitCentre: '4134-NOT-CLU',
      address1: '12 Clumber Street',
      city: 'Nottingham',
      postcode: 'NG1 3ED',
      deliveries: deliveries({ start: '06:00', end: '08:30' }, { start: '06:30', end: '09:00' }, { start: '07:30', end: '09:00' }),
      contact: { name: 'Imogen Vasey', position: 'General Manager', phone: '07700 900856' },
      notes: 'Shared yard with the neighbouring units. Keep the gate clear.',
      emails: ['nottingham.clumber@pret.co.uk'],
    }),
    roster: roster('nottingham-clumber', [
      ['Imogen Vasey', 'General Manager'],
      ['Bilal Hussain', 'Assistant Manager'],
      ['Cara Netherton', 'Team Member'],
      ['Rocco Amato', 'Team Member'],
      ['Jess Pemberton', 'Barista'],
      ['Kian Rowbotham', 'Team Member'],
      ['Alba Diaz', 'Team Member'],
      ['Noah Kingsley', 'Team Member'],
      ['Mia Stroud', 'Team Member'],
      ['Felix Anand', 'Team Member'],
      ['Darcy Ellwood', 'Team Member'],
    ]),
  },
];

export function getNewSite(id: string): NewSite | undefined {
  return NEW_SITES.find((s) => s.id === id);
}

// ─── Derived helpers ─────────────────────────────────────────────────────────

/** Role split for a roster given per-person overrides. */
export function roleCounts(
  people: WorkdayPerson[],
  overrides: Record<string, EdifyRole>,
): Record<EdifyRole, number> {
  const counts: Record<EdifyRole, number> = { Employee: 0, Manager: 0, Admin: 0 };
  for (const p of people) {
    counts[overrides[p.id] ?? defaultEdifyRole(p.workdayRole)] += 1;
  }
  return counts;
}

/** "8 Managers · 33 Employees" — omits zero-count roles,
 *  singular/plural aware. */
export function describeRoleCounts(counts: Record<EdifyRole, number>): string {
  const order: EdifyRole[] = ['Manager', 'Employee', 'Admin'];
  return order
    .filter((r) => counts[r] > 0)
    .map((r) => `${counts[r]} ${r}${counts[r] === 1 ? '' : 's'}`)
    .join(' · ');
}

import type { ConfidenceScore, ConfidenceFactors } from '@/app/assisted-ordering/types';

// ─── Item type taxonomy ──────────────────────────────────────────────────────
// What kind of thing this stock row represents. Drives the Type column
// + filter in AllItemsTable, and affects what the drawer offers (e.g.
// "Add to next order" makes sense for a Product but not a Recipe).
//   • product       — a supplier-specific SKU (e.g. "Califa Farms Oat
//                     Milk 1L from Bidvest"). The default case in v1.
//   • master-product — abstract item across suppliers ("Oat Milk").
//   • recipe         — a finished dish made on-site ("Flat White").
//   • sub-recipe     — a prepped component used in other recipes
//                     ("Pesto base", "Espresso shot").
export type StockItemType =
  | 'product'
  | 'master-product'
  | 'recipe'
  | 'sub-recipe';

export interface StockItemTypeConfig {
  label: string;
  chipBg: string;
  chipText: string;
  chipBorder: string;
}

export const STOCK_TYPE_CONFIG: Record<StockItemType, StockItemTypeConfig> = {
  product: {
    label: 'Product',
    chipBg: 'var(--color-info-light)',
    chipText: 'var(--color-info)',
    chipBorder: 'var(--color-info)',
  },
  'master-product': {
    label: 'Master product',
    chipBg: 'var(--color-bg-hover)',
    chipText: 'var(--color-accent-active)',
    chipBorder: 'var(--color-border)',
  },
  recipe: {
    label: 'Recipe',
    chipBg: 'var(--color-success-light)',
    chipText: 'var(--color-success)',
    chipBorder: 'var(--color-success-border)',
  },
  'sub-recipe': {
    label: 'Sub-recipe',
    chipBg: 'var(--color-warning-light)',
    chipText: 'var(--color-warning)',
    chipBorder: 'var(--color-warning-border)',
  },
};

// ─── Categories ───────────────────────────────────────────────────────────────
// Mirrors the supplier-side `ProductCategory` vocabulary
// (components/Suppliers/fixtures.ts) so a stock item's category reads
// the same in both surfaces. Kept as a plain string here rather than a
// hard-coupled import so the Stock surface stays self-contained.
export type StockCategory =
  | 'Beverage'
  | 'Dairy'
  | 'Bakery'
  | 'Produce'
  | 'Meat'
  | 'Seafood'
  | 'Pantry'
  | 'Packaging'
  | 'Cleaning'
  | 'Prepared'
  | 'Other';

export const STOCK_CATEGORIES: StockCategory[] = [
  'Beverage',
  'Dairy',
  'Bakery',
  'Produce',
  'Meat',
  'Seafood',
  'Pantry',
  'Packaging',
  'Cleaning',
  'Prepared',
  'Other',
];

// ─── Storage locations ──────────────────────────────────────────────────────
// Physical zones inside a venue (Front of House, Bar, Kitchen, Dry Store,
// Back of House). Real sites configure these per venue; for the
// prototype we derive a sensible default from each item's category so
// we don't have to seed a `location` field on every fixture row. Powers
// the location tabs in the Stocktake view.

export type StockLocation =
  | 'Front of House'
  | 'Bar'
  | 'Kitchen'
  | 'Dry Store'
  | 'Back of House';

/** Canonical display order — keep tab strips stable regardless of which
 *  locations a site happens to have. */
export const STOCK_LOCATION_ORDER: StockLocation[] = [
  'Front of House',
  'Bar',
  'Kitchen',
  'Dry Store',
  'Back of House',
];

export function locationForItem(item: StockItem): StockLocation {
  switch (item.category) {
    case 'Beverage':
      return 'Bar';
    case 'Bakery':
      return 'Front of House';
    case 'Dairy':
    case 'Produce':
    case 'Meat':
    case 'Seafood':
    case 'Prepared':
      return 'Kitchen';
    case 'Pantry':
    case 'Packaging':
      return 'Dry Store';
    case 'Cleaning':
      return 'Back of House';
    case 'Other':
    default:
      return 'Front of House';
  }
}

// ─── Movements ────────────────────────────────────────────────────────────────
// A timeline of stock-affecting events for a single item. Powers the
// drawer's history section. Quantity is signed: positive = stock in,
// negative = stock out.
export type StockMovementKind =
  | 'sale'
  | 'delivery'
  | 'transfer-in'
  | 'transfer-out'
  | 'waste'
  | 'stocktake'
  | 'production-in'   // recipes/sub-recipes: a production run added units
  | 'production-out'; // recipes/sub-recipes: this item was consumed by a parent recipe

export interface StockMovement {
  id: string;
  kind: StockMovementKind;
  /** ISO date string for sorting; rendered via formatRelativeDate. */
  date: string;
  /** Signed quantity in the item's stock unit. */
  quantity: number;
  /** Short freeform descriptor: "POS sale", "GRN #4821", "Spoke transfer to King's Cross", etc. */
  note: string;
  /** Optional reference to the originating record. Not navigated in v1. */
  ref?: string;
}

// ─── StockItem ────────────────────────────────────────────────────────────────
// Ingredient + the runtime context Monitor stock needs to derive a
// status. Built from the assisted-ordering Ingredient shape but extends
// it with the few extra fields the status taxonomy needs (sales velocity,
// supplier lead time, POS availability, theoretical stock for variance,
// and the confidence factors already used on suggested-order lines).

export interface StockItem {
  id: string;
  name: string;
  variant: string;
  type: StockItemType;
  category: StockCategory;
  /** How many recipes this item appears in (drives the linked-recipes
   *  column). For type = 'recipe' this is the number of recipes that
   *  *contain* this one as a sub-recipe; for 'sub-recipe' it's the
   *  number of parent recipes. */
  linkedRecipeCount: number;

  stockUnit: string;
  /** Alternate units the operator can convert to (e.g. "kg" with
   *  alternates "g", "lb"). Used by the unit-of-measure editor. */
  alternateUnits: string[];
  currentStock: number;
  parLevel: number | null;
  parConfirmed: boolean;
  stockDataAgeDays: number;

  // Demand + supplier context
  salesVelocity7d: number | null;
  supplierId: string;
  supplierName: string;
  supplierLeadTimeDays: number;
  posDataAvailable: boolean;

  // Variance — theoretical stock projected from last stocktake + GRNs −
  // POS depletion. Null when we don't have both stocktake and POS data.
  theoreticalStock: number | null;

  /** Cost per `stockUnit` in the site's currency (currently a single
   *  global currency for the prototype — GBP). For master-products
   *  it's a weighted/blended cost across the linked SKUs; for recipes
   *  and sub-recipes it's the calculated COGS per unit. `null` means
   *  the item hasn't been priced yet (rare — pricing is required to
   *  drive stock-value rollups). */
  unitPrice: number | null;

  // Reuses the assisted-ordering vocabulary so the operator sees the
  // same confidence language across surfaces.
  confidenceScore: ConfidenceScore;
  confidenceFactors: ConfidenceFactors;

  /** Recent movements ordered by date desc. Powers the drawer history. */
  movements: StockMovement[];
}

// ─── Status taxonomy ─────────────────────────────────────────────────────────
// Six derived statuses. Precedence (when multiple could fire):
//   stockout > variance > spoilage > overstock > stale > healthy
// Stockout wins because the operational impact is highest and the
// action is most time-sensitive.

export type StockStatus =
  | 'stockout'
  | 'spoilage'
  | 'variance'
  | 'overstock'
  | 'stale'
  | 'healthy';

export interface StatusConfig {
  label: string;
  chipBg: string;
  chipText: string;
  chipBorder: string;
  /** Severity for sort order — lower = more urgent. */
  severity: number;
}

export const STATUS_CONFIG: Record<StockStatus, StatusConfig> = {
  stockout: {
    label: 'At risk of stockout',
    chipBg: 'var(--color-error-light)',
    chipText: 'var(--color-error)',
    chipBorder: 'var(--color-error-border)',
    severity: 0,
  },
  variance: {
    label: 'Variance',
    chipBg: 'var(--color-warning-light)',
    chipText: 'var(--color-warning)',
    chipBorder: 'var(--color-warning-border)',
    severity: 1,
  },
  spoilage: {
    label: 'At risk of spoilage',
    chipBg: 'var(--color-warning-light)',
    chipText: 'var(--color-warning)',
    chipBorder: 'var(--color-warning-border)',
    severity: 2,
  },
  overstock: {
    label: 'Overstocked',
    chipBg: 'var(--color-bg-hover)',
    chipText: 'var(--color-text-secondary)',
    chipBorder: 'var(--color-border)',
    severity: 3,
  },
  stale: {
    label: 'Stale data',
    chipBg: 'var(--color-bg-hover)',
    chipText: 'var(--color-text-secondary)',
    chipBorder: 'var(--color-border-subtle)',
    severity: 4,
  },
  healthy: {
    label: 'Healthy',
    chipBg: 'var(--color-success-light)',
    chipText: 'var(--color-success)',
    chipBorder: 'var(--color-success-border)',
    severity: 5,
  },
};

// ─── Derivation helpers ───────────────────────────────────────────────────────

/** Days of cover remaining at current velocity. Null when we have no
 *  velocity data (so callers know to suppress the projection). */
export function getDaysCover(item: StockItem): number | null {
  if (item.salesVelocity7d === null || item.salesVelocity7d <= 0) return null;
  return item.currentStock / item.salesVelocity7d;
}

/** Variance as a fraction of theoretical (e.g. 0.18 = 18% gap). Null
 *  when theoretical isn't available. */
export function getVarianceFraction(item: StockItem): number | null {
  if (item.theoreticalStock === null || item.theoreticalStock <= 0) return null;
  return Math.abs(item.theoreticalStock - item.currentStock) / item.theoreticalStock;
}

// Per-item status cache. `getStockStatus` is pure with respect to the
// item reference, and the page hands the same item objects to multiple
// surfaces in a single render (HealthStrip + AttentionList +
// AllItemsTable rows + page-level summaries all status the same items).
// Caching by reference turns those repeated calls into a single map
// lookup, which adds up on a 50-item site where five components each
// loop over the list. WeakMap keys mean the cache is automatically
// freed when the items array is replaced (e.g. on site switch or after
// `applyOverrides` rebuilds the list).
const statusCache = new WeakMap<StockItem, StockStatus>();

/** The core classifier. See STOCK-HEALTH-PLAN.md §5 for the rule set. */
export function getStockStatus(item: StockItem): StockStatus {
  const cached = statusCache.get(item);
  if (cached !== undefined) return cached;
  const result = computeStockStatus(item);
  statusCache.set(item, result);
  return result;
}

function computeStockStatus(item: StockItem): StockStatus {
  const daysCover = getDaysCover(item);
  const variance = getVarianceFraction(item);
  const par = item.parLevel ?? 0;
  // Lead time + 1 day buffer so the operator has time to react to the
  // signal before the supplier's cutoff bites.
  const stockoutThresholdDays = item.supplierLeadTimeDays + 1;

  // Stockout — primary trigger when we have velocity. Fallback to
  // par-fraction when velocity is missing so a brand-new SKU with no
  // sales history still surfaces if it's running painfully low.
  if (daysCover !== null) {
    if (daysCover < stockoutThresholdDays) return 'stockout';
  } else {
    if (par > 0 && item.currentStock < par * 0.25) return 'stockout';
  }

  // Variance — material gap between what the system thinks we have
  // (theoretical) and what we counted. Only fires when we can compute
  // it, i.e. when both stocktake and POS data are present.
  if (variance !== null && variance > 0.15) return 'variance';

  // Spoilage — sitting on more than 1.5× par with below-par velocity.
  // V1 heuristic; real shelf-life data is a v2 ingredient field.
  if (par > 0 && item.currentStock > par * 1.5) {
    if (item.salesVelocity7d !== null && item.salesVelocity7d < par / 7) {
      return 'spoilage';
    }
    // Same threshold but velocity is fine — it's just a cash issue,
    // not a kitchen issue.
    return 'overstock';
  }

  // Stale data — no other status fires but the stocktake is so old the
  // projections are increasingly unreliable.
  if (item.stockDataAgeDays > 7) return 'stale';

  return 'healthy';
}

// ─── Summaries ───────────────────────────────────────────────────────────────

export interface StockSummary {
  stockoutCount: number;
  spoilageCount: number;
  varianceCount: number;
  overstockCount: number;
  staleCount: number;
  healthyCount: number;
  /** Total items needing attention (everything except healthy). */
  attentionCount: number;
}

export function summariseSite(items: StockItem[]): StockSummary {
  const summary: StockSummary = {
    stockoutCount: 0,
    spoilageCount: 0,
    varianceCount: 0,
    overstockCount: 0,
    staleCount: 0,
    healthyCount: 0,
    attentionCount: 0,
  };
  for (const item of items) {
    const status = getStockStatus(item);
    switch (status) {
      case 'stockout': summary.stockoutCount++; break;
      case 'spoilage': summary.spoilageCount++; break;
      case 'variance': summary.varianceCount++; break;
      case 'overstock': summary.overstockCount++; break;
      case 'stale': summary.staleCount++; break;
      case 'healthy': summary.healthyCount++; break;
    }
    if (status !== 'healthy') summary.attentionCount++;
  }
  return summary;
}

export interface SiteStockSnapshot {
  siteId: string;
  siteName: string;
  siteCaption: string;
  items: StockItem[];
  /** Past stocktakes for this site, ordered most recent first.
   *  Powers the "Stocktake history" tab. */
  stocktakeHistory: StocktakeRecord[];
  /** Operator-defined groupings of items (e.g. "High-value items",
   *  "Perishables", "Bar essentials"). Each group becomes a one-tap
   *  count target on the Stocktake list so the operator can spin up
   *  a count of their important subset without picking items each
   *  time. Seeded with sensible defaults per site; the prototype lets
   *  the operator add more, persisted in client state only. */
  itemGroups: ItemGroup[];
}

// ─── Item groups ─────────────────────────────────────────────────────────────
// A saved list of items the operator counts together. Independent of
// `StockLocation` (which is structural) and `StockCategory` (which is
// taxonomic) — groups are *user* slicings of the catalogue: "things I
// care about today", "stuff that walks", "weekly produce check".
//
// Identity is by id. The id is stable per group and used in
// `CountTarget` so the count flow can resolve the items even after
// the group has been edited.

export interface ItemGroup {
  id: string;
  name: string;
  /** Item ids in the group. Items missing from a site (deleted,
   *  migrated) are simply filtered out at render time — no orphan
   *  cleanup required. */
  itemIds: string[];
}

// ─── Stocktake history ────────────────────────────────────────────────────────
// A stocktake is a single counting session. Each record captures what
// was counted (full / section / spot), who did it, how many lines they
// went through, and how many came out at a variance from the system's
// theoretical figure. Powers the Stocktake history tab; also the
// jumping-off point for a Stocktake-view drill-in (out of scope for v1).

export type StocktakeScope = 'Full count' | 'Section count' | 'Spot count';
export type StocktakeStatus = 'completed' | 'in-progress' | 'needs-review';

export interface StocktakeRecord {
  id: string;
  /** ISO date string. */
  date: string;
  counterName: string;
  scope: StocktakeScope;
  /** Optional friendly section label e.g. "Dairy fridge", "Bar". Only
   *  populated for section / spot counts. */
  sectionName?: string;
  itemsCounted: number;
  /** How many lines came out at != theoretical stock. */
  variancesFound: number;
  /** Net £ value of the variance. Negative = shrinkage, positive = found stock. */
  netVarianceValue?: number;
  /** Count of recorded stock movements (sales, deliveries, transfers,
   *  waste) attributable to the period this stocktake covers. Lets
   *  the operator gauge how much activity sat behind the variance —
   *  a stocktake with 4 variances over 200 movements reads very
   *  differently to 4 variances over 20. */
  movementCount: number;
  status: StocktakeStatus;
  /** Denormalised site name. Only populated when the record is
   *  pulled into an aggregated (all-sites) list view; left undefined
   *  for site-scoped reads since the site is already known from the
   *  surrounding context. */
  siteName?: string;
}

export const STOCKTAKE_STATUS_LABEL: Record<StocktakeStatus, string> = {
  completed: 'Completed',
  'in-progress': 'In progress',
  'needs-review': 'Needs review',
};

// ─── Count target ────────────────────────────────────────────────────────────
// The "what am I about to count?" intent the operator chooses when
// entering the count flow. Five cases, modelled as a discriminated
// union so each case carries exactly the data it needs (and no more):
//
//   • continue — picking up a stocktake already in flight; needs the
//     record id so we can show its scope/counter in the header.
//   • full     — count everything at this site, no filter.
//   • area     — count one storage location (Bar, Kitchen, …); needs
//     the chosen location to filter the item list + lock the tab.
//   • quick    — fast spot-check of just the items the system has
//     already flagged as needing attention. No location locked in;
//     these can come from anywhere on site.
//   • group    — count a saved ItemGroup ("High-value items",
//     "Perishables", or whatever the operator built). The group name
//     is denormalised onto the target so the count view can render
//     the header without needing site context (group lookup happens
//     at the boundary in the page).
//
// The Stocktake List surface offers buttons for full / area / quick
// plus one per saved group. `continue` is set when the operator
// clicks the open-stocktake row.

export type CountTarget =
  | { kind: 'continue'; recordId: string }
  | { kind: 'full' }
  | { kind: 'area'; location: StockLocation }
  | { kind: 'quick' }
  | { kind: 'group'; groupId: string; groupName: string };

export function scopeLabel(target: CountTarget): string {
  switch (target.kind) {
    case 'continue': return 'Continuing stocktake';
    case 'full':     return 'Full count';
    case 'area':     return `${target.location} · area count`;
    case 'quick':    return 'Quick count';
    case 'group':    return `${target.groupName} · group count`;
  }
}

export const STOCKTAKE_STATUS_TONE: Record<StocktakeStatus, string> = {
  completed: 'var(--color-success)',
  'in-progress': 'var(--color-info)',
  'needs-review': 'var(--color-warning)',
};

export interface EstateSummary {
  aggregate: StockSummary;
  siteCount: number;
  oldestStocktakeAgeDays: number;
}

export function summariseEstate(sites: SiteStockSnapshot[]): EstateSummary {
  const aggregate: StockSummary = {
    stockoutCount: 0,
    spoilageCount: 0,
    varianceCount: 0,
    overstockCount: 0,
    staleCount: 0,
    healthyCount: 0,
    attentionCount: 0,
  };
  let oldest = 0;
  for (const site of sites) {
    const s = summariseSite(site.items);
    aggregate.stockoutCount += s.stockoutCount;
    aggregate.spoilageCount += s.spoilageCount;
    aggregate.varianceCount += s.varianceCount;
    aggregate.overstockCount += s.overstockCount;
    aggregate.staleCount += s.staleCount;
    aggregate.healthyCount += s.healthyCount;
    aggregate.attentionCount += s.attentionCount;
    for (const item of site.items) {
      if (item.stockDataAgeDays > oldest) oldest = item.stockDataAgeDays;
    }
  }
  return {
    aggregate,
    siteCount: sites.length,
    oldestStocktakeAgeDays: oldest,
  };
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

/** Severity-first, then by within-severity urgency:
 *   stockout: lowest days-cover first
 *   variance: highest variance % first
 *   spoilage / overstock: highest absolute excess over par first
 *   stale: oldest first
 *   healthy: alphabetic
 */
export function sortByUrgency(items: StockItem[]): StockItem[] {
  return [...items].sort((a, b) => {
    const sa = getStockStatus(a);
    const sb = getStockStatus(b);
    const severityDiff = STATUS_CONFIG[sa].severity - STATUS_CONFIG[sb].severity;
    if (severityDiff !== 0) return severityDiff;

    if (sa === 'stockout') {
      const da = getDaysCover(a) ?? Infinity;
      const db = getDaysCover(b) ?? Infinity;
      return da - db;
    }
    if (sa === 'variance') {
      const va = getVarianceFraction(a) ?? 0;
      const vb = getVarianceFraction(b) ?? 0;
      return vb - va;
    }
    if (sa === 'spoilage' || sa === 'overstock') {
      const pa = a.parLevel ?? 0;
      const pb = b.parLevel ?? 0;
      const ea = pa > 0 ? a.currentStock - pa : 0;
      const eb = pb > 0 ? b.currentStock - pb : 0;
      return eb - ea;
    }
    if (sa === 'stale') return b.stockDataAgeDays - a.stockDataAgeDays;
    return a.name.localeCompare(b.name);
  });
}

// ─── Number formatting ───────────────────────────────────────────────────────

export function formatStock(value: number, unit: string): string {
  const isInteger = Number.isInteger(value);
  const formatted = isInteger ? value.toString() : value.toFixed(1);
  return `${formatted} ${unit}`;
}

// ─── Linked recipes ──────────────────────────────────────────────────────────
// Surface-level recipe context for the item drawer: which dishes /
// drinks use this item, and roughly how much they take per serving.
//
// The prototype doesn't carry a real recipe catalogue, so rather
// than asking every fixture entry to list its recipes by hand we
// generate them deterministically from `item.id` + `item.category` +
// `item.linkedRecipeCount`. Same item → same recipes across renders,
// different items in the same category → different recipe names. The
// returned list is empty for categories that don't have recipes
// (Packaging, Cleaning, Other) regardless of count.

export interface LinkedRecipe {
  id: string;
  name: string;
  /** How much of the parent item one serving of this recipe consumes,
   *  expressed in the item's `stockUnit`. */
  usagePerServing: number;
  usageUnit: string;
}

const RECIPE_POOL_BY_CATEGORY: Record<StockCategory, string[]> = {
  Beverage: [
    'Flat White', 'Cappuccino', 'Latte', 'Mocha', 'Iced Latte',
    'Hot Chocolate', 'Matcha Latte', 'Chai Latte', 'Cortado',
    'Long Black', 'Espresso Tonic',
  ],
  Dairy: [
    'Flat White', 'Cappuccino', 'Latte', 'Granola Bowl',
    'Yoghurt & Honey', 'Hot Chocolate', 'Iced Latte', 'Pastry Glaze',
    'Crème Pâtissière', 'Buttercream',
  ],
  Bakery: [
    'Toasted Sourdough', 'Banana Bread', 'Croissant Combo',
    'Sourdough Bowl', 'Avocado Toast', 'Bacon Roll', 'BLT',
    'Ham & Cheese Toastie',
  ],
  Produce: [
    'Avocado Toast', 'Caesar Salad', 'Veggie Wrap', 'Grain Bowl',
    'Pesto Pasta', 'Tomato & Burrata', 'Roast Veg Bowl',
    'Fresh Soup of the Day', 'Smashed Pea Toast',
  ],
  Meat: [
    'Bacon Roll', 'BLT', 'Chicken Caesar', 'Brisket Toastie',
    'Chorizo Bowl', 'Ham & Cheese', 'Roast Chicken Wrap',
  ],
  Seafood: [
    'Smoked Salmon Bagel', 'Tuna Melt', 'Crab Salad',
    'Salmon Bowl', 'Prawn Wrap', 'Fish Cakes',
  ],
  Pantry: [
    'Pesto Pasta', 'Tomato Pasta', 'Curry Bowl', 'Tuna Melt',
    'Roast Veg Bowl', 'Lentil Soup', 'Spiced Granola',
  ],
  Prepared: [
    'Hummus Plate', 'Veggie Bowl', 'Soup of the Day',
    'Roast Veg Wrap', 'Sandwich Special', 'Mezze Box',
  ],
  Packaging: [],
  Cleaning: [],
  Other: [],
};

const USAGE_PER_SERVING_OPTIONS = [
  0.05, 0.08, 0.1, 0.12, 0.15, 0.18, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75,
];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Deterministically picks `count` unique names from `pool`. Same
 *  seed always returns the same ordered subset; different seeds give
 *  visibly different picks. Falls back to the whole pool when the
 *  requested count exceeds what's available. */
function pickStableUnique<T>(pool: T[], count: number, seed: number): T[] {
  if (count <= 0 || pool.length === 0) return [];
  if (count >= pool.length) return [...pool];
  const indices = Array.from({ length: pool.length }, (_, i) => i);
  // Mulberry-style LCG step for the swap RNG — simple, stable, and
  // doesn't need an external dep.
  let s = seed || 1;
  for (let i = indices.length - 1; i > 0; i -= 1) {
    s = (s * 1103515245 + 12345) | 0;
    const j = Math.abs(s) % (i + 1);
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  return indices.slice(0, count).map(idx => pool[idx]);
}

export function getLinkedRecipes(item: StockItem): LinkedRecipe[] {
  const pool = RECIPE_POOL_BY_CATEGORY[item.category] ?? [];
  if (pool.length === 0 || item.linkedRecipeCount <= 0) return [];

  const seed = hashString(item.id);
  const names = pickStableUnique(pool, item.linkedRecipeCount, seed);
  return names.map((name, idx) => {
    const usageSeed = hashString(`${item.id}::${name}::${idx}`);
    const usage = USAGE_PER_SERVING_OPTIONS[usageSeed % USAGE_PER_SERVING_OPTIONS.length];
    return {
      id: `${item.id}-rec-${idx}`,
      name,
      usagePerServing: usage,
      usageUnit: item.stockUnit,
    };
  });
}

/** Site currency. Hard-coded to GBP for the prototype; a future
 *  multi-region build would surface this via SiteSettings. */
export const STOCK_CURRENCY_SYMBOL = '£';

/** Render a price. Returns "—" for null so the UI can drop the field
 *  in cleanly when an item isn't priced yet. Pass `unit` to render
 *  unit-cost format (e.g. "£3.50/L"); omit it for plain totals. */
export function formatPrice(
  value: number | null,
  unit?: string,
): string {
  if (value === null || Number.isNaN(value)) return '—';
  const fixed = value < 10
    ? value.toFixed(2)
    : value < 100
      ? value.toFixed(2)
      : value.toFixed(0);
  return unit
    ? `${STOCK_CURRENCY_SYMBOL}${fixed}/${unit}`
    : `${STOCK_CURRENCY_SYMBOL}${fixed}`;
}

/** Stock value = on-hand quantity × unit price. Convenience because
 *  every surface that shows "what's this stock worth?" computes it the
 *  same way. */
export function stockValue(item: StockItem): number | null {
  if (item.unitPrice === null) return null;
  return item.currentStock * item.unitPrice;
}

export function formatDaysCover(days: number | null): string {
  if (days === null) return 'no velocity data';
  if (days < 1) return 'less than a day';
  if (days < 1.5) return '~1 day';
  return `~${days.toFixed(1)} days`;
}

export function formatStocktakeAge(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

// ─── Movement helpers ─────────────────────────────────────────────────────────

export interface MovementKindConfig {
  label: string;
  /** Sign hint for the icon / colour. */
  sign: 'in' | 'out' | 'neutral';
  iconColour: string;
}

export const MOVEMENT_KIND_CONFIG: Record<StockMovementKind, MovementKindConfig> = {
  delivery:        { label: 'Delivery',     sign: 'in',      iconColour: 'var(--color-success)' },
  'transfer-in':   { label: 'Transfer in',  sign: 'in',      iconColour: 'var(--color-success)' },
  'production-in': { label: 'Produced',     sign: 'in',      iconColour: 'var(--color-success)' },
  sale:            { label: 'Sale',         sign: 'out',     iconColour: 'var(--color-info)' },
  'transfer-out':  { label: 'Transfer out', sign: 'out',     iconColour: 'var(--color-warning)' },
  'production-out':{ label: 'Consumed',     sign: 'out',     iconColour: 'var(--color-warning)' },
  waste:           { label: 'Waste',        sign: 'out',     iconColour: 'var(--color-error)' },
  stocktake:       { label: 'Stocktake',    sign: 'neutral', iconColour: 'var(--color-text-secondary)' },
};

export function formatMovementQuantity(qty: number, unit: string): string {
  const sign = qty > 0 ? '+' : qty < 0 ? '−' : '';
  const abs = Math.abs(qty);
  const value = Number.isInteger(abs) ? abs.toString() : abs.toFixed(1);
  return `${sign}${value} ${unit}`;
}

/** Relative-date formatter for movement timestamps. Cheap and good
 *  enough for the prototype — no Intl.RelativeTimeFormat polyfill
 *  concerns. */
export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr  = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 2) return 'yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

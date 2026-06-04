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

// ─── Supplier variants (master products) ─────────────────────────────────────
// A master product ("Avocado", "Coffee Cup Lids") rolls up several
// supplier-specific SKUs, each of which can arrive in its own
// packaging. On the stocktake count surface each variant gets its own
// sub-row so the counter records what they're physically holding for
// that supplier (a tray of 18 from one, a bag of 12 from another),
// while the master row aggregates the lot into a single on-hand figure.

export interface StockSupplierVariant {
  /** Stable id, unique within the parent item (e.g. "v-freshearth"). */
  id: string;
  /** Supplier / SKU label rendered on the sub-row. */
  label: string;
  /** Countable units in display order. Convention: pack unit(s) first
   *  (tray / bag / box), the loose base unit last (each / units). */
  units: string[];
  /** Pack→base conversions for the pack units in `units` (e.g.
   *  `{ tray: 18 }` — a tray holds 18 of the master `stockUnit`). */
  conv?: Record<string, number>;
  /** Optional display override for a unit's pack-size suffix, for cases
   *  the numeric `conv` can't express cleanly — e.g. a box that holds
   *  10 sleeves renders `box/10sl` via `{ box: '10sl' }`. Falls back to
   *  the numeric pack size from `conv`. */
  packLabels?: Record<string, string>;
  /** This SKU has no countable unit configured yet — the sub-row shows
   *  a prompt to add an alt UOM in supplier settings instead of inputs. */
  noCountingUnit?: boolean;
}

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
  /** Optional explicit conversions from each alternate unit into the
   *  primary `stockUnit`. Value = how many `stockUnit`s one of that
   *  alternate unit equals (e.g. for sourdough with `stockUnit: 'units'`
   *  and an alternate 'loaves' of 1 unit each, `{ loaves: 1 }`; for
   *  eggs in trays of 30, `{ trays: 30 }`).
   *
   *  Used by the stocktake / quick-count flows to roll multi-UOM
   *  entries into a single quantity in the primary unit so the £-value
   *  + variance line up regardless of which unit the operator counted
   *  in. Mass + volume conversions (g↔kg, mL↔L, etc.) are inferred
   *  automatically so only the pack-style alternates (cases, bags,
   *  packs, trays, …) need seeding here. */
  unitConversions?: Record<string, number>;
  /** Master products only: the supplier-specific SKUs rolled under this
   *  item, each with its own packaging. When present, the stocktake
   *  count surface renders one sub-row per variant. */
  supplierVariants?: StockSupplierVariant[];
  /** Master products where every supplier ships the same packaging, so
   *  the counter records one figure for the lot rather than per-SKU
   *  rows. Renders the `packNote` hint + a single count strip. */
  sharedPackaging?: boolean;
  /** Short hint shown under a master-product name (e.g.
   *  "Same packaging — counting for all"). */
  packNote?: string;
  /** No countable unit configured for this item yet — the count
   *  surface flags it and points the operator at supplier settings. */
  noCountingUnit?: boolean;
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

// ─── Unit conversion ─────────────────────────────────────────────────────────
// A stocktake row often has the operator counting in more than one
// unit on the same item ("3 loose bottles + 1 case", "0.5 kg loose +
// 2 bags"). To make those rolling up into a single total in the
// item's primary `stockUnit`, we resolve every entered value via:
//
//   1. Identity, when the entered unit *is* the primary stockUnit.
//   2. Per-item explicit factor in `item.unitConversions`. Seeded in
//      fixtures for pack-style alternates the system can't infer
//      (cases, bags, trays, sleeves, jars …).
//   3. Default mass / volume table (kg↔g↔mg↔lb↔oz, L↔mL↔cl). Inferred
//      automatically when both sides are the same kind of measure,
//      so e.g. items with `stockUnit: 'kg'` and alts `'g'` just work.
//
// Anything outside these three buckets returns null and the caller
// decides whether to skip or surface the unconvertible entry.

interface DefaultUnitMeta {
  kind: 'mass' | 'volume';
  /** Value in the base unit (kg for mass, L for volume). */
  toBase: number;
}

const DEFAULT_UNIT_FACTORS: Record<string, DefaultUnitMeta> = {
  // mass — base kg
  kg:    { kind: 'mass', toBase: 1 },
  kilo:  { kind: 'mass', toBase: 1 },
  kilos: { kind: 'mass', toBase: 1 },
  g:     { kind: 'mass', toBase: 0.001 },
  gram:  { kind: 'mass', toBase: 0.001 },
  grams: { kind: 'mass', toBase: 0.001 },
  mg:    { kind: 'mass', toBase: 0.000001 },
  lb:    { kind: 'mass', toBase: 0.453592 },
  lbs:   { kind: 'mass', toBase: 0.453592 },
  oz:    { kind: 'mass', toBase: 0.0283495 },
  // volume — base L
  l:      { kind: 'volume', toBase: 1 },
  litre:  { kind: 'volume', toBase: 1 },
  litres: { kind: 'volume', toBase: 1 },
  liter:  { kind: 'volume', toBase: 1 },
  liters: { kind: 'volume', toBase: 1 },
  ml:     { kind: 'volume', toBase: 0.001 },
  cl:     { kind: 'volume', toBase: 0.01 },
};

/** Convert `value` of `fromUnit` into the item's primary `stockUnit`.
 *  Returns null when no conversion is available — caller decides
 *  whether to skip, partial-sum, or flag the entry. */
export function convertToPrimary(
  item: StockItem,
  value: number,
  fromUnit: string,
): number | null {
  if (!Number.isFinite(value)) return null;
  if (fromUnit === item.stockUnit) return value;

  const explicit = item.unitConversions?.[fromUnit];
  if (explicit !== undefined && Number.isFinite(explicit)) {
    return value * explicit;
  }

  const fromMeta = DEFAULT_UNIT_FACTORS[fromUnit.toLowerCase()];
  const toMeta = DEFAULT_UNIT_FACTORS[item.stockUnit.toLowerCase()];
  if (fromMeta && toMeta && fromMeta.kind === toMeta.kind) {
    return value * (fromMeta.toBase / toMeta.toBase);
  }

  return null;
}

// Pack-style container units (a "box of N", "bag of N", …) as opposed
// to loose count units (each / units / portions) or measures (kg / L).
// Only these get a "pack size" denominator rendered in the count box,
// since that's the figure the operator actually needs ("how many in a
// box?") to count whole packs without breaking them open.
const PACK_CONTAINER_UNITS = new Set([
  'box', 'boxes', 'bag', 'bags', 'case', 'cases', 'tray', 'trays',
  'sleeve', 'sleeves', 'pack', 'packs', 'carton', 'cartons',
  'crate', 'crates', 'punnet', 'punnets',
]);

function isPackContainerUnit(unit: string): boolean {
  return PACK_CONTAINER_UNITS.has(unit.trim().toLowerCase());
}

const LOOSE_COUNT_UNITS = ['unit', 'units', 'each', 'ea', 'piece', 'pieces', 'pcs'];

/** The "what's in one of these?" label for a pack-style count box —
 *  e.g. a case of 24 units renders as `24`, a bag of 12.5 kg as
 *  `12.5kg`. Returns null for loose units (each / portions) and for
 *  measures (kg / g / L), which don't need a pack denominator.
 *
 *  Drives the `tray/18`, `bag/12`, `cases/24` style chips on the
 *  stocktake count boxes so the counter knows the pack quantity
 *  without leaving the row.
 *
 *  Two ways the pack size is found:
 *    1. The pack unit is an *alternate* with an explicit conversion
 *       into the base stockUnit (e.g. `{ cases: 24 }` → "24").
 *    2. The pack unit IS the primary `stockUnit` (e.g. Croissants
 *       counted in `boxes`, a box of 12, stored inversely as
 *       `{ units: 1/12 }`). We derive how many of a loose alternate
 *       fit in one pack from the inverse of that alternate's
 *       conversion, so a `boxes` cell still reads `boxes/12`. */
export function formatPackSize(item: StockItem, unit: string): string | null {
  if (!isPackContainerUnit(unit)) return null;

  let factor = item.unitConversions?.[unit];
  let baseUnit = item.stockUnit;

  // Case 2 — the pack unit is itself the primary stockUnit, so there's
  // no direct entry in `unitConversions`. Recover the pack size from a
  // loose alternate: if 1 alt = `perAlt` packs, then 1 pack holds
  // `1 / perAlt` of that alt.
  if (
    (factor === undefined || !Number.isFinite(factor)) &&
    unit === item.stockUnit
  ) {
    for (const alt of item.alternateUnits ?? []) {
      if (isPackContainerUnit(alt)) continue; // want a loose unit, not another pack
      const perAlt = convertToPrimary(item, 1, alt); // packs per 1 alt
      if (perAlt === null || !Number.isFinite(perAlt) || perAlt <= 0) continue;
      const perPack = 1 / perAlt; // alts per 1 pack
      if (!Number.isFinite(perPack) || perPack <= 1) continue;
      factor = perPack;
      baseUnit = alt;
      break;
    }
  }

  if (factor === undefined || !Number.isFinite(factor) || factor <= 0) {
    return null;
  }
  const qty = Number.isInteger(factor) ? String(factor) : factor.toFixed(2).replace(/\.?0+$/, '');
  // Append the base unit only when it's a measure (kg / L / g …); a
  // pack of loose counts (each / units) reads cleaner bare: "12" not
  // "12units".
  const baseIsLooseCount = LOOSE_COUNT_UNITS.includes(baseUnit.trim().toLowerCase());
  return baseIsLooseCount ? qty : `${qty}${baseUnit}`;
}

export interface CountRollup {
  /** Sum of every convertible entry, expressed in the item's primary
   *  `stockUnit`. Zero when nothing has been entered. */
  total: number;
  /** True when at least one cell on the row was parseable. */
  hasInput: boolean;
  /** True when at least one entered cell couldn't be converted into
   *  the primary unit (caller may want to surface a warning). */
  hasUnconvertible: boolean;
  /** Distinct unit cells the operator entered into. Useful for
   *  deciding whether to render a "totalled across N units" hint. */
  unitsEntered: number;
}

/** Roll a multi-UOM input map into a single quantity in the item's
 *  primary stockUnit. Empty / invalid cells are ignored; an empty
 *  map returns `{ total: 0, hasInput: false, … }`. */
export function rollupCounts(
  item: StockItem,
  rawByUnit: Record<string, string | number | undefined | null>,
): CountRollup {
  let total = 0;
  let hasInput = false;
  let hasUnconvertible = false;
  let unitsEntered = 0;

  for (const [unit, raw] of Object.entries(rawByUnit)) {
    if (raw === undefined || raw === null) continue;
    const str = typeof raw === 'string' ? raw.trim() : String(raw);
    if (str === '') continue;
    const num = typeof raw === 'number' ? raw : Number.parseFloat(str);
    if (!Number.isFinite(num) || num < 0) continue;
    hasInput = true;
    unitsEntered += 1;
    const converted = convertToPrimary(item, num, unit);
    if (converted === null) {
      hasUnconvertible = true;
    } else {
      total += converted;
    }
  }

  return { total, hasInput, hasUnconvertible, unitsEntered };
}

// ─── Master-product count helpers ─────────────────────────────────────────────
// Master products spread their count across supplier-variant sub-rows.
// These helpers flatten that structure so the count surface (and the
// page-level total / £-value rollups) treat simple items and master
// products through one interface, keyed by a per-item "cell suffix".

/** Resolve the countable units for a single supplier variant, building
 *  a synthetic item whose conversions map the variant's pack units into
 *  the master `stockUnit`. Lets us reuse `rollupCounts` /
 *  `formatPackSize` per variant without special-casing them. */
export function variantAsItem(
  item: StockItem,
  variant: StockSupplierVariant,
): StockItem {
  return {
    ...item,
    alternateUnits: variant.units.filter(u => u !== item.stockUnit),
    unitConversions: variant.conv,
  };
}

/** The countable-cell key suffixes for an item. Simple items: one per
 *  unit ("kg", "bags", …). Master products with supplier variants: one
 *  per (variant, unit) pair, suffixed `${variantId}::${unit}`. The
 *  count surface combines these with the item id to key its state. */
export function countCellKeys(item: StockItem): string[] {
  if (item.supplierVariants?.length) {
    const keys: string[] = [];
    for (const v of item.supplierVariants) {
      if (v.noCountingUnit) continue;
      for (const u of v.units) keys.push(`${v.id}::${u}`);
    }
    return keys;
  }
  return [item.stockUnit, ...(item.alternateUnits ?? [])];
}

/** Master-aware roll-up. `rawBySuffix` maps the suffixes returned by
 *  `countCellKeys` to the operator's entered values. Sums every cell
 *  (across variants, for master products) into a single quantity in the
 *  item's primary `stockUnit`. */
export function rollupItemCounts(
  item: StockItem,
  rawBySuffix: Record<string, string | number | undefined | null>,
): CountRollup {
  if (item.supplierVariants?.length) {
    let total = 0;
    let hasInput = false;
    let hasUnconvertible = false;
    let unitsEntered = 0;
    for (const v of item.supplierVariants) {
      if (v.noCountingUnit) continue;
      const synthetic = variantAsItem(item, v);
      const rawByUnit: Record<string, string | number | undefined | null> = {};
      for (const u of v.units) rawByUnit[u] = rawBySuffix[`${v.id}::${u}`];
      const r = rollupCounts(synthetic, rawByUnit);
      total += r.total;
      hasInput = hasInput || r.hasInput;
      hasUnconvertible = hasUnconvertible || r.hasUnconvertible;
      unitsEntered += r.unitsEntered;
    }
    return { total, hasInput, hasUnconvertible, unitsEntered };
  }
  const rawByUnit: Record<string, string | number | undefined | null> = {};
  for (const u of [item.stockUnit, ...(item.alternateUnits ?? [])]) {
    rawByUnit[u] = rawBySuffix[u];
  }
  return rollupCounts(item, rawByUnit);
}

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
  /** Per-line counts captured during the session. Optional — only
   *  populated for records the prototype surfaces via the variance-
   *  review flow. Summary cards keep using `itemsCounted` +
   *  `variancesFound` directly, so absence here is fine for older
   *  records. */
  lines?: StocktakeLine[];
}

// ─── Stocktake lines (review surface) ────────────────────────────────────────
// A line is "what the counter recorded for one item". Lines are
// denormalised — the line captures the item's name / unit / unit
// price at the moment of count, so a reviewer can close out a count
// even after the item catalogue has shifted underneath it (renamed,
// archived, repriced). The original multi-UOM input map lives on
// `counts` so the review surface can render the same UOM pills the
// counter used. `countedQty` is the pre-rolled-up total in the
// item's primary `stockUnit` so the review view doesn't have to
// re-run `rollupCounts` to render the headline number.

export interface StocktakeLine {
  /** Stable id within the record (e.g. "st-fe-3-l1"). */
  id: string;
  /** Item this line counted. Used by the review submit handler to
   *  apply per-line stock overrides via the page's `onItemEdit`. */
  itemId: string;
  /** Denormalised so the review surface renders without re-resolving
   *  against the live catalogue. */
  itemName: string;
  itemVariant?: string;
  category: StockCategory;
  stockUnit: string;
  unitPrice: number | null;
  /** Counts entered per unit during the original session — mirrors
   *  the shape StocktakeView holds in state, so the review surface
   *  can re-render the breakdown ("4 punnets + 0.5 kg") that drove
   *  the rolled-up total. */
  counts: Record<string, number>;
  /** Roll-up of `counts` in `stockUnit`. Pre-computed at fixture-
   *  build time so the review view doesn't need item-level
   *  conversion factors to render the headline. */
  countedQty: number;
  /** Theoretical at the moment of count — captured here rather than
   *  read from the live item because the live figure drifts with
   *  POS depletion over time and a stocktake review should compare
   *  against the picture the counter saw. */
  theoreticalAtCount: number;
  /** Counter's note from the original session (optional). */
  note?: string;
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

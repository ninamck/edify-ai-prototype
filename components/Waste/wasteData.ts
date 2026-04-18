import type { BriefingPhase } from '@/components/briefing';

export type WasteReasonId =
  | 'expired'
  | 'damaged'
  | 'not-fresh'
  | 'rd'
  | 'food-waste-app'
  | 'staff-used'
  | 'no-reason';

export const WASTE_REASONS: { id: WasteReasonId; label: string }[] = [
  { id: 'expired',        label: 'Beyond expiry date' },
  { id: 'damaged',        label: 'Damaged' },
  { id: 'not-fresh',      label: 'No longer fresh' },
  { id: 'rd',             label: 'R&D' },
  { id: 'food-waste-app', label: 'Third-party food waste app' },
  { id: 'staff-used',     label: 'Used by staff' },
  { id: 'no-reason',      label: 'No reason' },
];

export type WasteCategory = 'pastry' | 'lunch' | 'dairy' | 'fruit' | 'cake' | 'drinks';

export interface WasteProduct {
  id: string;
  name: string;
  category: WasteCategory;
  uomOptions: string[]; // first is default
  unitCost: number;     // £ per primary unit
}

export const WASTE_PRODUCTS: WasteProduct[] = [
  { id: 'muffin-blueberry',    name: 'Blueberry muffin',      category: 'pastry',  uomOptions: ['unit'],             unitCost: 2.50 },
  { id: 'muffin-chocolate',    name: 'Chocolate muffin',      category: 'pastry',  uomOptions: ['unit'],             unitCost: 2.50 },
  { id: 'baguette-hamcheese',  name: 'Ham & cheese baguette', category: 'lunch',   uomOptions: ['unit'],             unitCost: 6.00 },
  { id: 'baguette-veggie',     name: 'Veggie baguette',       category: 'lunch',   uomOptions: ['unit'],             unitCost: 5.80 },
  { id: 'croissant-almond',    name: 'Almond croissant',      category: 'pastry',  uomOptions: ['unit'],             unitCost: 3.50 },
  { id: 'croissant-plain',     name: 'Plain croissant',       category: 'pastry',  uomOptions: ['unit'],             unitCost: 2.80 },
  { id: 'cake-carrot',         name: 'Carrot cake slice',     category: 'cake',    uomOptions: ['slice', 'whole'],   unitCost: 4.50 },
  { id: 'cake-lemon',          name: 'Lemon drizzle slice',   category: 'cake',    uomOptions: ['slice', 'whole'],   unitCost: 4.20 },
  { id: 'milk-whole',          name: 'Whole milk',            category: 'dairy',   uomOptions: ['litre', 'unit'],    unitCost: 1.20 },
  { id: 'milk-oat',            name: 'Oat milk',              category: 'dairy',   uomOptions: ['litre', 'unit'],    unitCost: 1.85 },
  { id: 'cream-single',        name: 'Single cream',          category: 'dairy',   uomOptions: ['litre'],            unitCost: 2.40 },
  { id: 'fruit-banana',        name: 'Banana',                category: 'fruit',   uomOptions: ['unit', 'kg'],       unitCost: 0.35 },
  { id: 'fruit-berry-pot',     name: 'Berry fruit pot',       category: 'fruit',   uomOptions: ['unit'],             unitCost: 3.20 },
  { id: 'drink-cold-brew',     name: 'Cold brew bottle',      category: 'drinks',  uomOptions: ['unit'],             unitCost: 3.50 },
  { id: 'drink-juice',         name: 'Fresh orange juice',    category: 'drinks',  uomOptions: ['unit', 'litre'],    unitCost: 3.80 },
];

export function getProduct(id: string): WasteProduct | undefined {
  return WASTE_PRODUCTS.find((p) => p.id === id);
}

// ── Prep vs sold per phase — drives the close reconciliation math. ─────────────
// Each phase represents what the picture looks like at that point in the day.
// Only the products that actually run a prep cycle today are included.
interface PrepRow {
  made: number;
  sold: number;
}

export const PREP_TODAY_BY_PHASE: Record<BriefingPhase, Record<string, PrepRow>> = {
  morning: {
    'muffin-blueberry':   { made: 12, sold: 2 },
    'muffin-chocolate':   { made: 10, sold: 2 },
    'baguette-hamcheese': { made: 8,  sold: 0 },
    'baguette-veggie':    { made: 6,  sold: 0 },
    'croissant-almond':   { made: 6,  sold: 3 },
    'croissant-plain':    { made: 10, sold: 4 },
  },
  midday: {
    'muffin-blueberry':   { made: 12, sold: 7 },
    'muffin-chocolate':   { made: 10, sold: 6 },
    'baguette-hamcheese': { made: 8,  sold: 5 },
    'baguette-veggie':    { made: 6,  sold: 3 },
    'croissant-almond':   { made: 6,  sold: 5 },
    'croissant-plain':    { made: 10, sold: 8 },
  },
  afternoon: {
    'muffin-blueberry':   { made: 12, sold: 9 },
    'muffin-chocolate':   { made: 10, sold: 8 },
    'baguette-hamcheese': { made: 8,  sold: 8 },
    'baguette-veggie':    { made: 6,  sold: 5 },
    'croissant-almond':   { made: 6,  sold: 6 },
    'croissant-plain':    { made: 10, sold: 9 },
  },
  evening: {
    'muffin-blueberry':   { made: 12, sold: 9 },
    'muffin-chocolate':   { made: 10, sold: 10 },
    'baguette-hamcheese': { made: 8,  sold: 7 },
    'baguette-veggie':    { made: 6,  sold: 6 },
    'croissant-almond':   { made: 6,  sold: 5 },
    'croissant-plain':    { made: 10, sold: 10 },
  },
};

export interface UnaccountedItem {
  productId: string;
  product: WasteProduct;
  made: number;
  sold: number;
  short: number;
}

export function unaccountedAtPhase(phase: BriefingPhase): UnaccountedItem[] {
  const byId = PREP_TODAY_BY_PHASE[phase];
  const items: UnaccountedItem[] = [];
  for (const [productId, { made, sold }] of Object.entries(byId)) {
    const short = made - sold;
    if (short <= 0) continue;
    const product = getProduct(productId);
    if (!product) continue;
    items.push({ productId, product, made, sold, short });
  }
  // Evening feels most relevant for the close nudge — sort by biggest short first.
  return items.sort((a, b) => b.short - a.short);
}

// ── Picker suggestions: "Likely to bin" ────────────────────────────────────────
// Phase-aware heuristic. Evening surfaces the actual shortfall list; earlier
// phases surface at-risk / slower-moving prep.
export function likelyToBinAtPhase(phase: BriefingPhase): UnaccountedItem[] {
  if (phase === 'evening' || phase === 'afternoon') {
    return unaccountedAtPhase(phase).slice(0, 4);
  }
  // Morning / midday — flag items tracking slow vs expected sell-through.
  return unaccountedAtPhase(phase)
    .filter((i) => i.sold / Math.max(1, i.made) < 0.6)
    .slice(0, 4);
}

// ── Logged entries (history) ───────────────────────────────────────────────────
// Static prototype — a mixture of today and prior days to feed the picker tabs.
export interface LoggedEntry {
  id: string;
  productId: string;
  qty: number;
  uom: string;
  reasonId: WasteReasonId;
  isToday: boolean;
  /** Display-ready timestamp, e.g. "09:42" (today) or "Tue 17:22" (earlier). */
  timestamp: string;
}

export const LOGGED_ENTRIES: LoggedEntry[] = [
  // Today
  { id: 'l-t-1', productId: 'cream-single',    qty: 0.5, uom: 'litre', reasonId: 'expired',    isToday: true,  timestamp: '09:42' },
  { id: 'l-t-2', productId: 'fruit-banana',    qty: 2,   uom: 'unit',  reasonId: 'not-fresh',  isToday: true,  timestamp: '11:15' },
  { id: 'l-t-3', productId: 'milk-oat',        qty: 1,   uom: 'litre', reasonId: 'expired',    isToday: true,  timestamp: '13:04' },
  { id: 'l-t-4', productId: 'muffin-chocolate', qty: 1,   uom: 'unit',  reasonId: 'damaged',    isToday: true,  timestamp: '14:20' },
  { id: 'l-t-5', productId: 'croissant-plain', qty: 2,   uom: 'unit',  reasonId: 'not-fresh',  isToday: true,  timestamp: '15:48' },
  // This week
  { id: 'l-w-1', productId: 'muffin-blueberry', qty: 3,   uom: 'unit',  reasonId: 'expired',    isToday: false, timestamp: 'Fri 17:40' },
  { id: 'l-w-2', productId: 'cake-carrot',     qty: 1,   uom: 'slice', reasonId: 'damaged',    isToday: false, timestamp: 'Fri 12:15' },
  { id: 'l-w-3', productId: 'baguette-hamcheese', qty: 2, uom: 'unit',  reasonId: 'expired',    isToday: false, timestamp: 'Thu 17:55' },
  { id: 'l-w-4', productId: 'fruit-berry-pot', qty: 1,   uom: 'unit',  reasonId: 'not-fresh',  isToday: false, timestamp: 'Thu 10:22' },
  { id: 'l-w-5', productId: 'milk-whole',      qty: 1,   uom: 'litre', reasonId: 'expired',    isToday: false, timestamp: 'Wed 18:05' },
  { id: 'l-w-6', productId: 'muffin-blueberry', qty: 2,   uom: 'unit',  reasonId: 'expired',    isToday: false, timestamp: 'Wed 17:48' },
  { id: 'l-w-7', productId: 'drink-cold-brew', qty: 1,   uom: 'unit',  reasonId: 'damaged',    isToday: false, timestamp: 'Tue 14:10' },
  { id: 'l-w-8', productId: 'croissant-almond', qty: 1,   uom: 'unit',  reasonId: 'staff-used', isToday: false, timestamp: 'Tue 11:30' },
  { id: 'l-w-9', productId: 'cream-single',    qty: 0.5, uom: 'litre', reasonId: 'expired',    isToday: false, timestamp: 'Mon 17:12' },
  { id: 'l-w-10', productId: 'baguette-veggie', qty: 1,   uom: 'unit',  reasonId: 'not-fresh',  isToday: false, timestamp: 'Mon 15:40' },
];

export function entriesLoggedToday(): LoggedEntry[] {
  return LOGGED_ENTRIES.filter((e) => e.isToday);
}

export function entriesLast7Days(): LoggedEntry[] {
  return LOGGED_ENTRIES;
}

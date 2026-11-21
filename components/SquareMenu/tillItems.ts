/**
 * Till items: what Edify sells through Square.
 *
 * A till item points at one recipe (sizes come from its variants) or one
 * product (sizes are amounts of that product, e.g. 175ml, 250ml, Bottle).
 * It carries the till-only fields a recipe doesn't need: till name,
 * kitchen name, till category, till price per size, sites and VAT.
 *
 * Three snapshots of the Edify-owned fields drive every status:
 *
 *   current     what Edify says now
 *   published   what Edify last sent to Square (the shared baseline)
 *   inSquare    what Square holds now (read back after a catalogue change)
 *
 *   published ≠ inSquare  → someone changed it in Square
 *   inSquare  ≠ current   → Edify has changes waiting to publish
 */

export type FieldKey =
  | 'name'
  | 'kitchenName'
  | 'category'
  | 'sizes'
  | 'prices'
  | 'groups'
  | 'sites'
  | 'vat'
  | 'description'
  | 'photo';

export const FIELD_KEYS: FieldKey[] = [
  'name', 'kitchenName', 'category', 'sizes', 'prices', 'groups', 'sites', 'vat', 'description', 'photo',
];

export const FIELD_LABELS: Record<FieldKey, string> = {
  name: 'Till name',
  kitchenName: 'Kitchen name',
  category: 'Till category',
  sizes: 'Sizes',
  prices: 'Till price',
  groups: 'Modifier groups',
  sites: 'Sites',
  vat: 'VAT',
  description: 'Description',
  photo: 'Photo',
};

export type TillFields = {
  name: string;
  /** Blank means the kitchen ticket prints the till name. */
  kitchenName: string;
  /** Square category name. Blank is allowed; the item lands uncategorised. */
  category: string;
  /** Size names in till order. At least one. */
  sizes: string[];
  /** Till price including VAT, keyed by size name. `null` = price typed at the till. */
  prices: Record<string, number | null>;
  /** Modifier group ids attached to every size. */
  groups: string[];
  /** Site names. Empty = every site. */
  sites: string[];
  /** Square tax name. Blank = the default for the item's hot or cold setting. */
  vat: string;
  description: string;
  photo: boolean;
};

export type TillSource =
  | { kind: 'recipe'; recipeId: string }
  | { kind: 'product'; productId: string };

export type TillItem = {
  id: string;
  source: TillSource;
  /** Item matching row id, when this item has a till button there. */
  posItemId?: string;
  current: TillFields;
  published?: TillFields;
  inSquare?: TillFields;
  /** Product items only: how much of the product each size uses. */
  amounts?: Record<string, { value: number; unit: string }>;
  /** Size → site → price, where a site charges differently. */
  sitePrices?: Record<string, Record<string, number>>;
  /** Set only when groups differ by size. Square can't take that. */
  sizeGroups?: Record<string, string[]>;
  /** Cost per size, from the recipe or product. Drives the margin line. */
  sizeCosts: Record<string, number>;
  /** Square changes the user chose to look at later. Publish leaves them alone. */
  laterKeys: FieldKey[];
  /** Square changes the user chose to overwrite. Shown as a warning on publish. */
  overwriteKeys: FieldKey[];
  /** Square reports when a change happened, never who made it. */
  squareChangedAt?: string;
  deletedInSquare?: { at: string };
  /** Waiting to be archived in Square on the next publish. */
  takeOff?: boolean;
  /** Edify created this till button, so Item matching shows it as published. */
  publishedByEdify?: boolean;
  /** Created in Square as a regular item, so Square can't show allergens. */
  regularTypeInSquare?: boolean;
  /** Read from Square. Square owns sold out. */
  soldOutAt?: string[];
};

/** A Square item with no Edify recipe or product behind it. */
export type SquareOnlyItem = {
  id: string;
  name: string;
  category: string;
  sizes: string[];
  prices: Record<string, number | null>;
  createdAt: string;
};

/** An option someone added to a published modifier group in Square. */
export type SquareGroupChange = {
  id: string;
  groupId: string;
  optionName: string;
  priceDelta?: number;
  at: string;
  later?: boolean;
};

export type TillStatus = 'in-sync' | 'ready' | 'changed' | 'not-on-till' | 'till-only' | 'blocked';

export const STATUS_LABEL: Record<TillStatus, string> = {
  'in-sync': 'Up to date',
  ready: 'Ready to publish',
  changed: 'Changed in Square',
  'not-on-till': 'Not on the till',
  'till-only': 'On the till only',
  blocked: "Can't publish",
};

export const STATUS_TONE: Record<TillStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  'in-sync': 'success',
  ready: 'info',
  changed: 'warning',
  'not-on-till': 'neutral',
  'till-only': 'neutral',
  blocked: 'error',
};

// ── Field helpers ───────────────────────────────────────────────────────────

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffKeys(a: TillFields | undefined, b: TillFields | undefined): FieldKey[] {
  if (!a || !b) return [];
  return FIELD_KEYS.filter((k) => !same(a[k], b[k]));
}

export function cloneFields(f: TillFields): TillFields {
  return JSON.parse(JSON.stringify(f)) as TillFields;
}

export function pickFields(base: TillFields, from: TillFields, keys: FieldKey[]): TillFields {
  const out = cloneFields(base);
  const src = cloneFields(from);
  for (const k of keys) (out as Record<FieldKey, unknown>)[k] = src[k];
  // Sizes and prices travel together so a price never points at a missing size.
  if (keys.includes('sizes') && !keys.includes('prices')) {
    out.prices = Object.fromEntries(out.sizes.map((s) => [s, src.prices[s] ?? out.prices[s] ?? null]));
  }
  return out;
}

// ── Status rules ────────────────────────────────────────────────────────────

/** Fields someone changed in Square since Edify last published. */
export function squareChangeKeys(item: TillItem): FieldKey[] {
  return diffKeys(item.published, item.inSquare);
}

/** Square changes still waiting for a decision (not marked Decide later). */
export function undecidedSquareKeys(item: TillItem): FieldKey[] {
  return squareChangeKeys(item).filter((k) => !item.laterKeys.includes(k));
}

/** Edify changes the next publish will send. Square changes not yet decided are left alone. */
export function publishKeys(item: TillItem): FieldKey[] {
  if (!item.inSquare) return [];
  const held = squareChangeKeys(item);
  return diffKeys(item.inSquare, item.current).filter((k) => !held.includes(k));
}

/** Square can't hold different modifier groups on different sizes of one item. */
export function isBlocked(item: TillItem): boolean {
  if (!item.sizeGroups) return false;
  const lists = Object.values(item.sizeGroups).map((g) => [...g].sort().join(','));
  return new Set(lists).size > 1;
}

export function statusOf(item: TillItem): TillStatus {
  if (item.deletedInSquare) return 'changed';
  if (squareChangeKeys(item).length > 0) return 'changed';
  if (isBlocked(item)) return 'blocked';
  if (!item.inSquare) return 'not-on-till';
  if (item.takeOff) return 'ready';
  if (item.regularTypeInSquare) return 'ready';
  if (publishKeys(item).length > 0) return 'ready';
  return 'in-sync';
}

/** True when the next publish has something to send for this item. */
export function hasPublishWork(item: TillItem): boolean {
  if (item.deletedInSquare || isBlocked(item)) return false;
  if (!item.inSquare) return true;
  if (item.takeOff) return true;
  if (item.regularTypeInSquare) return true;
  return publishKeys(item).length > 0;
}

// ── Money ───────────────────────────────────────────────────────────────────

export function money(n: number | null | undefined): string {
  if (n == null) return 'Price at the till';
  return `£${n.toFixed(2)}`;
}

export function priceRange(f: TillFields): string {
  const vals = f.sizes.map((s) => f.prices[s]).filter((v): v is number => v != null);
  if (vals.length === 0) return 'Price at the till';
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  return lo === hi ? money(lo) : `${money(lo)} to ${money(hi)}`;
}

export function vatPct(vatName: string): number {
  const m = /(\d+(?:\.\d+)?)%/.exec(vatName);
  return m ? Number(m[1]) : 20;
}

/** Gross profit % on a till price, after VAT. */
export function gpPct(priceInc: number | null | undefined, cost: number | undefined, vatName: string): number | null {
  if (priceInc == null || cost == null || priceInc <= 0) return null;
  const ex = priceInc / (1 + vatPct(vatName) / 100);
  return Math.round(((ex - cost) / ex) * 100);
}

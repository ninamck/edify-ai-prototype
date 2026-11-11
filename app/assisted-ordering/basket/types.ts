import type { CurrencyCode } from '@/lib/currency';

/** One day of expected use, in stock units. */
export type UseDay = {
  date: string;
  quantity: number;
  /** A normal day's use. Shown when it differs from `quantity` by 10% or more. */
  usual: number;
};

/** A delivery already on its way, in stock units. */
export type Delivery = {
  date: string;
  quantity: number;
  orderedOn: string;
};

export type PastOrder = {
  date: string;
  /** In order units. Zero means nothing was ordered that day. */
  quantity: number;
};

export type BasketLine = {
  id: string;
  productId: string;
  name: string;
  /** "bag", "case", "bottle". The pack the supplier sells. */
  orderUnit: string;
  orderUnitPlural: string;
  /** Stock units in one order unit. */
  packSize: number;
  /** "kg", "l", "units". The unit stock is counted in. */
  stockUnit: string;
  /** Per order unit, in the supplier's currency. */
  unitPrice: number;
  /** Edify's suggestion, in order units. Zero for lines the user added. */
  suggested: number;
  /** Stock units on hand. Null when nobody knows. */
  onHand: number | null;
  /** The count is too old to trust. */
  stockWeak: boolean;
  stockAsOf: string;
  stockSource: 'live' | 'stocktake';
  forecast: UseDay[];
  incoming: Delivery[];
  overdue: Delivery[];
  lastOrders: PastOrder[];
  /** Percentage rise since the last order. */
  priceUp?: number;
  /** The line exists only to reach the supplier's minimum. */
  forMinimum?: boolean;
  addedByYou?: boolean;
  rule?: { name: string; from: number; to: number; setBy: string };
  /** Times the user removed this line on the same weekday recently. */
  recentRemovals?: { removed: number; of: number };
  startsRemoved?: boolean;
  lastChangedBy?: string;
};

export type BasketOrder = {
  id: string;
  supplierId: string;
  supplierName: string;
  currency: CurrencyCode;
  minimum: number;
  deliveryDate: string | null;
  /** Edify guessed the date from the supplier's usual days. */
  dateEstimated?: boolean;
  /** The first-choice date whose cut-off passed. */
  movedFrom?: string;
  cutOffAt: Date | null;
  noDeliveryDays?: string;
  /** Built from scratch by the user rather than suggested. */
  builtByYou?: boolean;
  /** Orders over the site's limit wait for an approver. */
  needsApproval?: boolean;
  lines: BasketLine[];
};

export type ForecastTile = {
  date: string;
  amount: number | null;
  /** Percentage change against the same weekday last week. */
  change: number | null;
  stale?: boolean;
};

export type CatalogueProduct = {
  productId: string;
  supplierId: string;
  name: string;
  orderUnit: string;
  orderUnitPlural: string;
  packSize: number;
  stockUnit: string;
  unitPrice: number;
};

export type SupplierSummary = {
  id: string;
  name: string;
  currency: CurrencyCode;
  minimum: number;
  categories: string[];
  deliveryDays: string[];
  cutOffTime: string;
  leadTimeDays: number;
};

export type DemandChange = { name: string; date: string; percent: number };

export type BasketFixtures = {
  today: string;
  siteName: string;
  orders: BasketOrder[];
  forecast: ForecastTile[];
  demandChange: DemandChange | null;
  catalogue: CatalogueProduct[];
  suppliers: SupplierSummary[];
};

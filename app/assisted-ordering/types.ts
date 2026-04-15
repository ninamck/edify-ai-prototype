// ─── Core domain types ───────────────────────────────────────────────────────

export type ConfidenceScore = 'high' | 'medium' | 'low';

export type ConfidenceFactors = {
  stocktake: 'fresh' | 'aging' | 'stale' | 'none';
  pos: 'active' | 'lagged' | 'unavailable';
  par: 'confirmed' | 'suggested' | 'not_set';
  variance: 'stable' | 'moderate' | 'high';
};

export type UserAction = 'accepted' | 'edited' | 'dismissed' | 'manual_add' | null;
export type DismissReason = 'not_needed' | 'already_ordered' | 'wrong_product' | null;
export type OrderState = 'draft' | 'confirmed' | 'queued' | 'sent';
export type GroupBy = 'supplier' | 'day' | 'ingredient';

// ─── Supplier ────────────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  cutOffTime: string;         // e.g. "14:00"
  leadTimeDays: number;
  minimumOrderValue: number;  // 0 = no minimum
  deliveryDays: string[];
  email: string;
  deliveryDate: string;       // ISO date string
  sendTime: string;           // e.g. "13:30" (cutoff minus buffer)
}

// ─── Ingredient ──────────────────────────────────────────────────────────────

export interface Ingredient {
  id: string;
  name: string;
  variant: string;
  stockUnit: string;
  currentStock: number;
  stockDataAgeDays: number;
  parLevel: number | null;
  parConfirmed: boolean;
}

// ─── Supplier Product ─────────────────────────────────────────────────────────

export interface SupplierProduct {
  ingredientId: string;
  supplierId: string;
  isPrimary: boolean;
  unitName: string;
  unitSize: number;
  unitCost: number;
  available: boolean;
}

// ─── Suggested Order Line ─────────────────────────────────────────────────────

export interface SuggestedOrderLine {
  id: string;
  orderId: string;
  ingredientId: string;
  supplierId: string;

  // Suggestion context
  suggestedQty: number;
  suggestedPar: number | null;
  currentStockAtSuggestion: number;
  stockDataAgeDays: number;
  posDataAvailable: boolean;
  salesVelocity7d: number | null;
  salesVelocity14d: number | null;
  confidenceScore: ConfidenceScore;
  confidenceFactors: ConfidenceFactors;
  movAutoAdded: boolean;

  // User action
  userAction: UserAction;
  finalQty: number | null;
  dismissReason: DismissReason;

  // MOV
  movWarnShown: boolean;

  // Optional overrides for the "Why?" panel
  whyOverride?: string[];
  whyHighlight?: boolean;
}

// ─── Suggested Order ─────────────────────────────────────────────────────────

export interface SuggestedOrder {
  id: string;
  supplierId: string;
  state: OrderState;
  deliveryDate: string;
  sendTime: string;
  lines: SuggestedOrderLine[];
}

// ─── Enriched line (joined with ingredient + product data) ───────────────────

export interface EnrichedLine extends SuggestedOrderLine {
  ingredient: Ingredient;
  product: SupplierProduct;
}

// ─── Manually added line ──────────────────────────────────────────────────────

export interface ManualLine {
  id: string;
  ingredientId: string;
  supplierId: string;
  qty: number;
}

// ─── Recurring Order ──────────────────────────────────────────────────────────

export type RecurringFrequency = 'daily' | 'weekly';

export interface RecurringOrderLine {
  id: string;
  ingredientId: string;
  supplierId: string;
  recurringBaseQty: number;
  suggestedQty: number;
  salesVelocity7d: number | null;
  reasons: string[];
}

export interface RecurringOrder {
  id: string;
  supplierId: string;
  frequency: RecurringFrequency;
  lines: RecurringOrderLine[];
}

export function getVariancePercent(base: number, suggested: number): number {
  if (base === 0) return suggested > 0 ? 100 : 0;
  return Math.round(((suggested - base) / base) * 100);
}

export function needsReview(base: number, suggested: number): boolean {
  return Math.abs(getVariancePercent(base, suggested)) > 10;
}

/** e.g. `"draft"` → `"Draft"`, `"daily"` → `"Daily"` */
export function sentenceCase(text: string): string {
  const t = text.trim();
  if (!t) return '';
  return `${t.charAt(0).toUpperCase()}${t.slice(1).toLowerCase()}`;
}

/** e.g. `"daily"` → `"Daily"` (alias for readability at call sites) */
export function sentenceCaseFrequency(frequency: string): string {
  return sentenceCase(frequency);
}

/** e.g. `"daily"` → `"Daily recurring"` */
export function recurringFrequencyBadgeLabel(frequency: string): string {
  return `${sentenceCaseFrequency(frequency)} recurring`;
}

// ─── View state ───────────────────────────────────────────────────────────────

export type View = 'notifications' | 'review' | 'confirmed';

export interface AssistedOrderingState {
  view: View;
  groupBy: GroupBy;
  showDetail: boolean;
  quantities: Record<string, number>;
  removed: Set<string>;
  dismissReasons: Record<string, DismissReason>;
  bannerDismissed: boolean;
}

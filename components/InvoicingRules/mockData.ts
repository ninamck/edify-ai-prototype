export type RuleScope = 'global' | 'supplier' | 'invoice';
export type DiscountMode = 'delivery-only' | 'update-catalogue' | 'prompt';

export interface RuleBase {
  id: string;
  enabled: boolean;
  scope: RuleScope;
  scopeValue?: string;
  note?: string;
}

export interface PriceVarianceRule extends RuleBase {
  type: 'price-variance';
  percent?: number;
  amount?: number;
}

export interface QtyVarianceRule extends RuleBase {
  type: 'qty-variance';
  units?: number;
  percent?: number;
}

export interface DiscountRule extends RuleBase {
  type: 'discount-handling';
  mode: DiscountMode;
}

export interface VatOverrideRule extends RuleBase {
  type: 'vat-override';
  rate: number;
}

export type Rule = PriceVarianceRule | QtyVarianceRule | DiscountRule | VatOverrideRule;

export const KNOWN_SUPPLIERS: readonly string[] = [
  'Bidfood',
  'Fresh Direct',
  'Metro',
  'Urban Fresh',
  'Brighton Energy',
  'Landmark Estate Management',
  'Hiscox',
];

export const INITIAL_RULES: Rule[] = [
  {
    id: 'r-1',
    type: 'price-variance',
    scope: 'global',
    enabled: true,
    percent: 5,
    amount: 2.00,
    note: 'Default for all suppliers.',
  },
  {
    id: 'r-2',
    type: 'price-variance',
    scope: 'supplier',
    scopeValue: 'Bidfood',
    enabled: true,
    percent: 10,
    amount: 5.00,
    note: 'Bidfood runs weekly promo pricing.',
  },
  {
    id: 'r-3',
    type: 'price-variance',
    scope: 'supplier',
    scopeValue: 'Fresh Direct',
    enabled: true,
    percent: 3,
    note: 'Seasonal produce — keep tight.',
  },
  {
    id: 'r-4',
    type: 'qty-variance',
    scope: 'global',
    enabled: false,
    units: 1,
    note: 'Off by default — qty shorts usually need a credit note.',
  },
  {
    id: 'r-5',
    type: 'discount-handling',
    scope: 'supplier',
    scopeValue: 'Bidfood',
    enabled: true,
    mode: 'delivery-only',
  },
  {
    id: 'r-6',
    type: 'discount-handling',
    scope: 'supplier',
    scopeValue: 'Fresh Direct',
    enabled: true,
    mode: 'update-catalogue',
  },
  {
    id: 'r-7',
    type: 'vat-override',
    scope: 'supplier',
    scopeValue: 'Hiscox',
    enabled: true,
    rate: 0,
    note: 'Insurance — no VAT.',
  },
];

export function humanReadableRule(rule: Rule): string {
  if (rule.type === 'price-variance') {
    const parts: string[] = [];
    if (rule.percent !== undefined) parts.push(`< ${rule.percent}%`);
    if (rule.amount !== undefined) parts.push(`< £${rule.amount.toFixed(2)}`);
    if (parts.length === 0) return 'Auto-accept any price change';
    return `Auto-accept when ${parts.join(' or ')}`;
  }
  if (rule.type === 'qty-variance') {
    const parts: string[] = [];
    if (rule.units !== undefined) parts.push(`≤ ${rule.units} unit${rule.units === 1 ? '' : 's'}`);
    if (rule.percent !== undefined) parts.push(`≤ ${rule.percent}%`);
    if (parts.length === 0) return 'Auto-accept any short';
    return `Auto-accept short by ${parts.join(' or ')}`;
  }
  if (rule.type === 'discount-handling') {
    if (rule.mode === 'delivery-only') return 'Accept for this delivery only (catalogue unchanged)';
    if (rule.mode === 'update-catalogue') return 'Accept and update catalogue cost';
    return 'Prompt per variance';
  }
  return `Force ${rule.rate}% VAT on all lines`;
}

export function scopeLabel(rule: Rule): string {
  if (rule.scope === 'global') return 'Global';
  if (rule.scope === 'supplier') return rule.scopeValue ?? 'Supplier';
  return rule.scopeValue ?? 'Invoice';
}

// Demo-only: which variances are "already auto-resolved" by rules on load.
// Keyed by variance id (from Invoicing/mockData).
export const AUTO_APPLIED_VARIANCES: Record<string, { ruleId: string; note: string }> = {
  'v-2': { ruleId: 'r-2', note: 'Free range eggs +£0.50/unit — under Bidfood 10% rule.' },
};

// Demo-only AI suggestion: for a specific invoice id, show a pattern-based banner.
export interface AISuggestion {
  invoiceId: string;
  title: string;
  body: string;
  itemLabel: string;
  observedPrice: string;
  catalogueCost: string;
}

export const AI_SUGGESTIONS: AISuggestion[] = [
  {
    invoiceId: 'inv-1',
    title: "We've spotted a pattern",
    body: 'Milk 2L from Bidfood has invoiced at £4.30 (vs catalogue £4.20) for 5 consecutive weeks. Want us to update the catalogue automatically, or keep prompting?',
    itemLabel: 'Milk 2L (Bidfood)',
    observedPrice: '£4.30',
    catalogueCost: '£4.20',
  },
];

export function getAISuggestion(invoiceId: string): AISuggestion | undefined {
  return AI_SUGGESTIONS.find(s => s.invoiceId === invoiceId);
}

export function getAutoAppliedForVariance(varianceId: string): { ruleId: string; note: string } | undefined {
  return AUTO_APPLIED_VARIANCES[varianceId];
}

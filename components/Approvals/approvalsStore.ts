import { useSyncExternalStore } from 'react';

export type UserRole = 'new_employee' | 'trusted_staff' | 'manager';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export type TriggerRule = 'new_user' | 'weekly_product_cap' | 'supplier_limit' | 'mov_short';

export interface RoleRuleSet {
  role: UserRole;
  description: string;
  rules: TriggerRule[];
}

export const USERS: User[] = [
  { id: 'u-manager', name: 'Priya Naidoo', role: 'manager' },
  { id: 'u-sam',     name: 'Sam Adeyemi',  role: 'new_employee' },
  { id: 'u-jordan',  name: 'Jordan Lee',   role: 'new_employee' },
  { id: 'u-reese',   name: 'Reese Okafor', role: 'trusted_staff' },
];

export const ROLE_RULES: RoleRuleSet[] = [
  {
    role: 'new_employee',
    description: 'All orders reviewed while staff get familiar with ordering patterns.',
    rules: ['new_user', 'weekly_product_cap', 'supplier_limit', 'mov_short'],
  },
  {
    role: 'trusted_staff',
    description: 'Reviews only when spend limits or MOV are triggered.',
    rules: ['weekly_product_cap', 'supplier_limit', 'mov_short'],
  },
  {
    role: 'manager',
    description: 'No review required — can approve own orders.',
    rules: [],
  },
];

export const RULE_LABELS: Record<TriggerRule, string> = {
  new_user: 'New employee — all orders reviewed',
  weekly_product_cap: 'Weekly spend cap on a product exceeded',
  supplier_limit: 'Supplier weekly limit exceeded',
  mov_short: 'Below supplier minimum order value',
};

export interface TriggeredRule {
  rule: TriggerRule;
  detail: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'declined';

export interface PendingApprovalLine {
  description: string;
  sku: string;
  qty: number;
  unitPrice: number;
}

export interface PendingApproval {
  id: string;
  poNumber: string;
  supplier: string;
  submittedById: string;
  submittedAt: string;
  total: number;
  lines: PendingApprovalLine[];
  triggeredRules: TriggeredRule[];
  status: ApprovalStatus;
  reviewedById?: string;
  reviewedAt?: string;
  declineReason?: string;
  /** Lines as originally submitted, captured when the manager edits on approval. */
  originalLines?: PendingApprovalLine[];
  /** Total as originally submitted, captured when the manager edits on approval. */
  originalTotal?: number;
  /** Free-text note from the manager explaining edits (optional). */
  approvalNote?: string;
}

let approvals: PendingApproval[] = [
  {
    id: 'ap-1',
    poNumber: 'PO-2026-042',
    supplier: 'Melbourne Coffee Traders',
    submittedById: 'u-sam',
    submittedAt: '8 Apr 2026 · 09:14',
    total: 612.00,
    lines: [
      { description: 'Espresso blend 1kg', sku: 'EB-1KG', qty: 20, unitPrice: 19.20 },
      { description: 'Decaf blend 1kg', sku: 'DB-1KG', qty: 8, unitPrice: 22.00 },
      { description: 'Takeaway cups 12oz', sku: 'TC-12', qty: 2, unitPrice: 28.00 },
    ],
    triggeredRules: [
      { rule: 'new_user', detail: 'Sam has placed 2 orders so far' },
      { rule: 'weekly_product_cap', detail: 'Espresso blend 1kg: week-to-date $576 of $400 cap' },
    ],
    status: 'pending',
  },
  {
    id: 'ap-2',
    poNumber: 'PO-2026-043',
    supplier: 'The Cheese Board',
    submittedById: 'u-jordan',
    submittedAt: '8 Apr 2026 · 10:32',
    total: 148.00,
    lines: [
      { description: 'Aged cheddar 250g', sku: 'AC-250', qty: 6, unitPrice: 14.00 },
      { description: 'Brie wheel 500g', sku: 'BR-500', qty: 4, unitPrice: 16.00 },
    ],
    triggeredRules: [
      { rule: 'new_user', detail: 'Jordan has placed 1 order so far' },
      { rule: 'mov_short', detail: 'Order is $52 below Cheese Board $200 MOV' },
    ],
    status: 'pending',
  },
  {
    id: 'ap-3',
    poNumber: 'PO-2026-044',
    supplier: 'Fresh Earth Produce',
    submittedById: 'u-reese',
    submittedAt: '8 Apr 2026 · 11:05',
    total: 820.00,
    lines: [
      { description: 'Baby spinach 500g', sku: 'BS-500', qty: 40, unitPrice: 3.80 },
      { description: 'Cherry tomatoes 500g', sku: 'CT-500', qty: 40, unitPrice: 3.80 },
      { description: 'Avocados', sku: 'AVO-EA', qty: 100, unitPrice: 2.10 },
      { description: 'Lemons', sku: 'LEM-EA', qty: 200, unitPrice: 0.55 },
      { description: 'Sourdough loaves', sku: 'SDL-WH', qty: 50, unitPrice: 6.00 },
    ],
    triggeredRules: [
      { rule: 'supplier_limit', detail: 'Fresh Earth Produce: week-to-date $1,640 of $1,500 cap' },
    ],
    status: 'pending',
  },
];

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): readonly PendingApproval[] {
  return approvals;
}

export function useApprovals(): readonly PendingApproval[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function approveApproval(id: string, reviewerId: string, editedLines?: PendingApprovalLine[], note?: string) {
  approvals = approvals.map(a => {
    if (a.id !== id) return a;
    const hasEdits = editedLines !== undefined;
    const lines = editedLines ?? a.lines;
    const total = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
    const trimmedNote = note?.trim();
    return {
      ...a,
      status: 'approved',
      reviewedById: reviewerId,
      reviewedAt: 'Just now',
      lines,
      total,
      originalLines: hasEdits ? a.lines : undefined,
      originalTotal: hasEdits ? a.total : undefined,
      approvalNote: trimmedNote ? trimmedNote : undefined,
    };
  });
  emit();
}

export function declineApproval(id: string, reviewerId: string, reason: string) {
  approvals = approvals.map(a =>
    a.id === id
      ? { ...a, status: 'declined', reviewedById: reviewerId, reviewedAt: 'Just now', declineReason: reason }
      : a,
  );
  emit();
}

export function resubmitApproval(id: string) {
  approvals = approvals.map(a =>
    a.id === id
      ? { ...a, status: 'pending', reviewedById: undefined, reviewedAt: undefined, declineReason: undefined }
      : a,
  );
  emit();
}

export function getUser(id: string): User | undefined {
  return USERS.find(u => u.id === id);
}

export function getRoleRules(role: UserRole): RoleRuleSet {
  return ROLE_RULES.find(r => r.role === role) ?? ROLE_RULES[0];
}

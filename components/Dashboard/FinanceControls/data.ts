export const COMPANY = 'Pizza Pilgrims';
export const SITE_COUNT = 9;
export const PERIOD_LABEL = 'November 2026';
export const AS_AT = 'Wed 11 Nov, 17:00';
export const MONTH_END = 'Mon 30 Nov';
/** Invoices more than this far over the contract price raise an alert. */
export const PRICE_TOLERANCE_PCT = 2;

// ─── Price change alerts ─────────────────────────────────────────────────────

export type AlertStatus = 'new' | 'credit' | 'disputed' | 'accepted';

export type PriceAlert = {
  id: string;
  product: string;
  pack: string;
  supplier: string;
  contractPrice: number;
  invoicedPrice: number;
  /** Packs bought at the higher price this month. */
  quantity: number;
  invoices: number;
  sites: number;
  firstSeen: string;
  contractEnds: string;
  status: AlertStatus;
};

export const PRICE_ALERTS: PriceAlert[] = [
  { id: 'pa-fdl', product: 'Fior di latte', pack: '1 kg', supplier: 'Latteria Fresca', contractPrice: 7.85, invoicedPrice: 8.45, quantity: 640, invoices: 18, sites: 9, firstSeen: 'Mon 2 Nov', contractEnds: '31 Mar 2027', status: 'new' },
  { id: 'pa-peroni', product: 'Peroni Nastro Azzurro', pack: '30 l keg', supplier: 'Northfield Drinks', contractPrice: 118, invoicedPrice: 124.5, quantity: 58, invoices: 11, sites: 9, firstSeen: 'Tue 3 Nov', contractEnds: '30 Jun 2027', status: 'new' },
  { id: 'pa-tomato', product: 'San Marzano tomatoes', pack: '2.5 kg tin', supplier: 'Campania Imports', contractPrice: 4.95, invoicedPrice: 5.4, quantity: 520, invoices: 9, sites: 9, firstSeen: 'Mon 2 Nov', contractEnds: '31 Jan 2027', status: 'disputed' },
  { id: 'pa-boxes', product: 'Pizza boxes, 12 inch', pack: 'case of 100', supplier: 'Kraftpak', contractPrice: 18.5, invoicedPrice: 21.75, quantity: 62, invoices: 4, sites: 9, firstSeen: 'Wed 4 Nov', contractEnds: '31 Dec 2026', status: 'credit' },
  { id: 'pa-oil', product: 'Rapeseed oil', pack: '20 l', supplier: 'Northfield Foodservice', contractPrice: 27.6, invoicedPrice: 31.2, quantity: 40, invoices: 7, sites: 8, firstSeen: 'Thu 5 Nov', contractEnds: '31 Oct 2027', status: 'new' },
  { id: 'pa-flour', product: 'Caputo Pizzeria 00 flour', pack: '25 kg sack', supplier: 'Campania Imports', contractPrice: 21.4, invoicedPrice: 23.1, quantity: 84, invoices: 9, sites: 9, firstSeen: 'Mon 2 Nov', contractEnds: '31 Jan 2027', status: 'credit' },
  { id: 'pa-nduja', product: 'Nduja', pack: '1 kg', supplier: 'Calabria Fine Foods', contractPrice: 14.2, invoicedPrice: 16.9, quantity: 46, invoices: 5, sites: 7, firstSeen: 'Fri 6 Nov', contractEnds: '28 Feb 2027', status: 'new' },
  { id: 'pa-basil', product: 'Fresh basil', pack: '100 g', supplier: 'Market Row Produce', contractPrice: 1.1, invoicedPrice: 1.35, quantity: 380, invoices: 22, sites: 9, firstSeen: 'Mon 2 Nov', contractEnds: 'rolling', status: 'accepted' },
  { id: 'pa-parm', product: 'Parmigiano Reggiano', pack: '1 kg', supplier: 'Latteria Fresca', contractPrice: 18.9, invoicedPrice: 19.6, quantity: 70, invoices: 9, sites: 9, firstSeen: 'Tue 10 Nov', contractEnds: '31 Mar 2027', status: 'new' },
];

export function overContract(alert: PriceAlert): number {
  return (alert.invoicedPrice - alert.contractPrice) * alert.quantity;
}

export function variancePct(alert: PriceAlert): number {
  return ((alert.invoicedPrice - alert.contractPrice) / alert.contractPrice) * 100;
}

// ─── Month-end accruals (goods received, not invoiced) ──────────────────────

export type AccrualRow = {
  supplier: string;
  deliveries: number;
  sites: number;
  /** Received value by age of the oldest un-invoiced delivery note. */
  recent: number;
  month: number;
  older: number;
  oldestDelivery: string;
  note: string;
};

export const ACCRUALS: AccrualRow[] = [
  { supplier: 'Latteria Fresca', deliveries: 26, sites: 9, recent: 7980, month: 3280, older: 0, oldestDelivery: 'Mon 26 Oct', note: 'Invoices weekly, next due Mon 16 Nov' },
  { supplier: 'Campania Imports', deliveries: 18, sites: 9, recent: 6200, month: 3640, older: 0, oldestDelivery: 'Tue 27 Oct', note: 'Holding 2 invoices over the tomato price dispute' },
  { supplier: 'Northfield Foodservice', deliveries: 22, sites: 9, recent: 4120, month: 3050, older: 1240, oldestDelivery: 'Thu 8 Oct', note: '1 delivery at Brighton has no invoice yet' },
  { supplier: 'Northfield Drinks', deliveries: 14, sites: 9, recent: 5100, month: 2830, older: 0, oldestDelivery: 'Fri 30 Oct', note: 'Invoices fortnightly' },
  { supplier: 'Kraftpak', deliveries: 6, sites: 9, recent: 0, month: 1980, older: 2240, oldestDelivery: 'Mon 5 Oct', note: 'Invoice queried: boxes billed over contract' },
  { supplier: 'Market Row Produce', deliveries: 41, sites: 9, recent: 2410, month: 1150, older: 0, oldestDelivery: 'Wed 28 Oct', note: 'Daily deliveries, invoices each Friday' },
  { supplier: 'Calabria Fine Foods', deliveries: 5, sites: 7, recent: 980, month: 880, older: 0, oldestDelivery: 'Thu 22 Oct', note: 'Invoices monthly' },
  { supplier: 'Hygiene Supplies Co.', deliveries: 4, sites: 9, recent: 0, month: 0, older: 1540, oldestDelivery: 'Fri 2 Oct', note: 'Bills quarterly in arrears' },
];

export function accrualTotal(row: AccrualRow): number {
  return row.recent + row.month + row.older;
}

// ─── Approvals and audit trail ───────────────────────────────────────────────

/** Must match the roles and review triggers in components/Approvals/approvalsStore.ts. */
export type OrderingRole = 'New employee' | 'Trusted staff' | 'Manager';

export const ORDERING_RULES: { role: OrderingRole; rule: string }[] = [
  { role: 'New employee', rule: 'Every order is reviewed by a manager' },
  { role: 'Trusted staff', rule: 'Reviewed when a product goes over its weekly cap, a supplier goes over its weekly limit, or the order is below the supplier minimum' },
  { role: 'Manager', rule: 'No review. Can approve their own orders and other people’s' },
];

export type ReviewOutcome = 'Waiting' | 'Approved' | 'Approved with edits' | 'Declined';

export type ReviewedOrder = {
  po: string;
  site: string;
  supplier: string;
  raisedBy: string;
  raisedRole: OrderingRole;
  total: number;
  trigger: string;
  detail: string;
  outcome: ReviewOutcome;
  reviewer?: string;
  reviewerTitle?: string;
  note?: string;
  reviewTime: string;
};

export const REVIEWED_ORDERS: ReviewedOrder[] = [
  { po: 'PO-PP-1187', site: 'Kingly Court', supplier: 'Market Row Produce', raisedBy: 'Jade Morris', raisedRole: 'New employee', total: 386.4, trigger: 'New employee', detail: 'Jade has placed 3 orders so far', outcome: 'Waiting', reviewTime: '2h 10m so far' },
  { po: 'PO-PP-1184', site: 'Soho', supplier: 'Latteria Fresca', raisedBy: 'Chiara Russo', raisedRole: 'Trusted staff', total: 1240, trigger: 'Supplier weekly limit', detail: 'Week to date £ 3,180 of £ 3,000', outcome: 'Approved', reviewer: 'Marco Bellini', reviewerTitle: 'General manager', reviewTime: '48m' },
  { po: 'PO-PP-1179', site: 'Camden', supplier: 'Kraftpak', raisedBy: 'Luca Ferraro', raisedRole: 'Trusted staff', total: 261, trigger: 'Product weekly cap', detail: 'Pizza boxes 12 inch: £ 652 of £ 500 cap', outcome: 'Approved with edits', reviewer: 'Rosa Mancini', reviewerTitle: 'General manager', note: 'Cut from 20 to 12 cases', reviewTime: '1h 05m' },
  { po: 'PO-PP-1176', site: 'Kingly Court', supplier: 'Northfield Drinks', raisedBy: 'Ben Hughes', raisedRole: 'Trusted staff', total: 2980, trigger: 'Supplier weekly limit', detail: 'Week to date £ 5,960 of £ 4,000', outcome: 'Declined', reviewer: 'Giulia Romano', reviewerTitle: 'Area manager', note: 'Duplicate of Friday’s order', reviewTime: '2h 40m' },
  { po: 'PO-PP-1171', site: 'Brighton', supplier: 'Calabria Fine Foods', raisedBy: 'Noah Price', raisedRole: 'New employee', total: 162, trigger: 'New employee', detail: 'Also £ 38 below the £ 200 supplier minimum', outcome: 'Approved', reviewer: 'Kate Lowe', reviewerTitle: 'General manager', reviewTime: '25m' },
  { po: 'PO-PP-1164', site: 'Soho', supplier: 'Campania Imports', raisedBy: 'Chiara Russo', raisedRole: 'Trusted staff', total: 2140, trigger: 'Supplier weekly limit', detail: 'Week to date £ 4,610 of £ 4,000', outcome: 'Approved', reviewer: 'Giulia Romano', reviewerTitle: 'Area manager', reviewTime: '3h 15m' },
];

export const APPROVAL_STATS = {
  reviewed: 41,
  approved: 36,
  edited: 2,
  declined: 2,
  waiting: 1,
};

/** Counts reopened after submit, last 6 weeks. Value is stock moved at cost. */
export const REOPENS_BY_SITE: { site: string; reopens: number; value: number }[] = [
  { site: 'Camden', reopens: 6, value: 640 },
  { site: 'Canary Wharf', reopens: 4, value: 310 },
  { site: 'Soho', reopens: 3, value: 220 },
  { site: 'Shoreditch', reopens: 2, value: 140 },
  { site: 'Brighton', reopens: 2, value: 95 },
  { site: 'Covent Garden', reopens: 1, value: 60 },
  { site: 'Kingly Court', reopens: 1, value: 45 },
  { site: 'Oxford', reopens: 0, value: 0 },
  { site: 'Spitalfields', reopens: 0, value: 0 },
];

export type ChangeType = 'count' | 'price' | 'approval' | 'access';

export const CHANGE_LABELS: Record<ChangeType, string> = {
  count: 'Count',
  price: 'Price',
  approval: 'Approval',
  access: 'Rule or role',
};

export type AuditEntry = {
  id: string;
  when: string;
  who: string;
  role: string;
  site: string;
  type: ChangeType;
  what: string;
  before: string;
  after: string;
  reason: string;
  /** Changed after the count was submitted. */
  afterSubmit?: boolean;
  /** Stock value moved by a count change, at cost. */
  value?: number;
};

export const AUDIT_LOG: AuditEntry[] = [
  { id: 'a1', when: 'Wed 11 Nov, 14:32', who: 'Aisha Khan', role: 'Head chef', site: 'Shoreditch', type: 'count', what: 'Fior di latte, walk-in fridge', before: '18 kg', after: '12 kg', reason: 'Recounted after the delivery was put away', value: 50.7 },
  { id: 'a2', when: 'Wed 11 Nov, 11:05', who: 'Tom Reid', role: 'Finance', site: 'All pizzerias', type: 'price', what: 'Rapeseed oil 20 l, contract price', before: '£ 26.90', after: '£ 27.60', reason: 'New Northfield contract from 1 Nov' },
  { id: 'a3', when: 'Wed 11 Nov, 09:48', who: 'Marco Bellini', role: 'General manager', site: 'Soho', type: 'approval', what: 'PO-PP-1184, Latteria Fresca', before: 'Waiting', after: 'Approved, £ 1,240', reason: 'Latteria Fresca over its £ 3,000 weekly limit' },
  { id: 'a4', when: 'Wed 11 Nov, 08:40', who: 'Rosa Mancini', role: 'General manager', site: 'Camden', type: 'count', what: 'Pizza boxes 12 inch, dry store', before: '14 cases', after: '4 cases', reason: 'Close count was off, recounted before opening', afterSubmit: true, value: 217.5 },
  { id: 'a5', when: 'Tue 10 Nov, 16:20', who: 'Sam Patel', role: 'Ops director', site: 'Brighton', type: 'access', what: 'Fior di latte weekly cap', before: '£ 400', after: '£ 600', reason: 'Christmas trading, until 4 Jan' },
  { id: 'a6', when: 'Tue 10 Nov, 10:02', who: 'Sam Patel', role: 'Ops director', site: 'All pizzerias', type: 'access', what: 'Finance team', before: 'View prices', after: 'Edit contract prices', reason: 'Finance now owns supplier contracts' },
  { id: 'a7', when: 'Mon 9 Nov, 17:40', who: 'Giulia Romano', role: 'Area manager', site: 'Kingly Court', type: 'approval', what: 'PO-PP-1176, Northfield Drinks', before: 'Waiting', after: 'Declined, £ 2,980', reason: 'Duplicate of Friday’s order' },
  { id: 'a8', when: 'Mon 9 Nov, 08:15', who: 'Priya Shah', role: 'Head chef', site: 'Covent Garden', type: 'count', what: 'San Marzano tomatoes, dry store', before: '36 tins', after: '30 tins', reason: 'Six tins dented, moved to waste', value: 32.4 },
  { id: 'a9', when: 'Fri 6 Nov, 15:12', who: 'Tom Reid', role: 'Finance', site: 'All pizzerias', type: 'price', what: 'Fresh basil 100 g, agreed price', before: '£ 1.10', after: '£ 1.35', reason: 'Winter price agreed with Market Row until 31 Dec' },
  { id: 'a10', when: 'Thu 5 Nov, 23:04', who: 'Dan Okoro', role: 'General manager', site: 'Canary Wharf', type: 'count', what: 'Caputo 00 flour, dry store', before: '11 sacks', after: '7 sacks', reason: 'Sacks used for a dough batch before the count', afterSubmit: true, value: 92.4 },
  { id: 'a11', when: 'Wed 4 Nov, 12:30', who: 'Sam Patel', role: 'Ops director', site: 'Oxford', type: 'access', what: 'Ellis Grant', before: 'New employee', after: 'Trusted staff', reason: 'Ten orders placed without changes' },
  { id: 'a12', when: 'Mon 2 Nov, 09:10', who: 'Giulia Romano', role: 'Area manager', site: 'Soho', type: 'approval', what: 'PO-PP-1164, Campania Imports', before: 'Waiting', after: 'Approved, £ 2,140', reason: 'Campania Imports over its £ 4,000 weekly limit' },
];


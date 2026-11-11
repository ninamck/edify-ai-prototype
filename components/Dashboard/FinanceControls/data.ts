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

export type RolePermission = {
  role: string;
  people: number;
  ordering: string;
  /** Per order. Null means no limit. */
  approvalLimit: number | null;
  counts: string;
  prices: string;
};

export const ROLES: RolePermission[] = [
  { role: 'Shift lead', people: 27, ordering: 'Every order needs approval', approvalLimit: 0, counts: 'Own counts, before submit', prices: 'No' },
  { role: 'Head chef', people: 9, ordering: 'Own pizzeria', approvalLimit: 500, counts: 'Own pizzeria, before submit', prices: 'No' },
  { role: 'General manager', people: 9, ordering: 'Own pizzeria', approvalLimit: 1500, counts: 'Reopen within 24 hours, with a reason', prices: 'No' },
  { role: 'Area manager', people: 2, ordering: 'Their pizzerias', approvalLimit: 5000, counts: 'Reopen within 7 days, with a reason', prices: 'No' },
  { role: 'Ops director', people: 1, ordering: 'All pizzerias', approvalLimit: null, counts: 'Reopen any count, with a reason', prices: 'View only' },
  { role: 'Finance', people: 3, ordering: "Can't place orders", approvalLimit: null, counts: 'View only', prices: 'Edit contract prices' },
];

export const APPROVAL_STATS = {
  sent: 41,
  approved: 38,
  rejected: 2,
  waiting: 1,
  medianTime: '1h 25m',
};

export type ChangeType = 'count' | 'price' | 'approval' | 'access';

export const CHANGE_LABELS: Record<ChangeType, string> = {
  count: 'Count',
  price: 'Price',
  approval: 'Approval',
  access: 'Limit or permission',
};

export const CHANGES_BY_WEEK = [
  { week: 'w/c 5 Oct', count: 14, price: 3, approval: 9, access: 1 },
  { week: 'w/c 12 Oct', count: 11, price: 2, approval: 10, access: 0 },
  { week: 'w/c 19 Oct', count: 17, price: 5, approval: 8, access: 2 },
  { week: 'w/c 26 Oct', count: 12, price: 9, approval: 11, access: 1 },
  { week: 'w/c 2 Nov', count: 19, price: 4, approval: 12, access: 3 },
  { week: 'w/c 9 Nov', count: 8, price: 2, approval: 6, access: 2 },
];

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
  /** Changed after the count was submitted or the order was sent. */
  afterSubmit?: boolean;
};

export const AUDIT_LOG: AuditEntry[] = [
  { id: 'a1', when: 'Wed 11 Nov, 14:32', who: 'Aisha Khan', role: 'Head chef', site: 'Shoreditch', type: 'count', what: 'Fior di latte, walk-in fridge', before: '18 kg', after: '12 kg', reason: 'Recounted after the delivery was put away' },
  { id: 'a2', when: 'Wed 11 Nov, 11:05', who: 'Tom Reid', role: 'Finance', site: 'All pizzerias', type: 'price', what: 'Rapeseed oil 20 l, contract price', before: '£ 26.90', after: '£ 27.60', reason: 'New Northfield contract from 1 Nov' },
  { id: 'a3', when: 'Wed 11 Nov, 09:48', who: 'Marco Bellini', role: 'General manager', site: 'Soho', type: 'approval', what: 'Latteria Fresca order', before: 'Waiting', after: 'Approved, £ 1,240', reason: 'Over the head chef’s £ 500 limit' },
  { id: 'a4', when: 'Wed 11 Nov, 08:40', who: 'Rosa Mancini', role: 'General manager', site: 'Camden', type: 'count', what: 'Pizza boxes 12 inch, dry store', before: '14 cases', after: '4 cases', reason: 'Close count was off, recounted before opening', afterSubmit: true },
  { id: 'a5', when: 'Tue 10 Nov, 16:20', who: 'Sam Patel', role: 'Ops director', site: 'Brighton', type: 'access', what: 'Head chef approval limit', before: '£ 500', after: '£ 750', reason: 'Christmas trading, until 4 Jan' },
  { id: 'a6', when: 'Tue 10 Nov, 10:02', who: 'Sam Patel', role: 'Ops director', site: 'All pizzerias', type: 'access', what: 'Finance role', before: 'View prices', after: 'Edit contract prices', reason: 'Finance now owns supplier contracts' },
  { id: 'a7', when: 'Mon 9 Nov, 17:40', who: 'Giulia Romano', role: 'Area manager', site: 'Kingly Court', type: 'approval', what: 'Northfield Drinks order', before: 'Waiting', after: 'Rejected, £ 2,980', reason: 'Duplicate of Friday’s order' },
  { id: 'a8', when: 'Mon 9 Nov, 08:15', who: 'Priya Shah', role: 'Head chef', site: 'Covent Garden', type: 'count', what: 'San Marzano tomatoes, dry store', before: '36 tins', after: '30 tins', reason: 'Six tins dented, moved to waste' },
  { id: 'a9', when: 'Fri 6 Nov, 15:12', who: 'Tom Reid', role: 'Finance', site: 'All pizzerias', type: 'price', what: 'Fresh basil 100 g, agreed price', before: '£ 1.10', after: '£ 1.35', reason: 'Winter price agreed with Market Row until 31 Dec' },
  { id: 'a10', when: 'Thu 5 Nov, 23:04', who: 'Dan Okoro', role: 'General manager', site: 'Canary Wharf', type: 'count', what: 'Caputo 00 flour, dry store', before: '11 sacks', after: '7 sacks', reason: 'Sacks used for a dough batch before the count', afterSubmit: true },
  { id: 'a11', when: 'Wed 4 Nov, 12:30', who: 'Sam Patel', role: 'Ops director', site: 'Oxford', type: 'access', what: 'Ellis Grant', before: 'Shift lead', after: 'Head chef', reason: 'Promotion' },
  { id: 'a12', when: 'Mon 2 Nov, 09:10', who: 'Giulia Romano', role: 'Area manager', site: 'Soho', type: 'approval', what: 'Campania Imports order', before: 'Waiting', after: 'Approved, £ 2,140', reason: 'Over the general manager’s £ 1,500 limit' },
];

export type PassThroughStatus = 'Awaiting review' | 'Ready to send' | 'Sent to Xero' | 'Failed to sync';
export type PassThroughCategory = 'Food & goods' | 'Rent' | 'Utilities' | 'Insurance' | 'Accountant' | 'Marketing' | 'Other';

export interface PassThroughActivity {
  id: string;
  timestamp: string;
  event:
    | 'auto-routed'
    | 'manually-routed'
    | 'fields-reviewed'
    | 'category-set'
    | 'sent'
    | 'sync-failed'
    | 'sync-retried';
  by: string;
  note?: string;
}

export interface PassThroughInvoice {
  id: string;
  invoiceNumber: string;
  supplier: string;
  invoiceDate: string;
  dueDate?: string;
  totalExVat: number;
  vatRate: number | null;
  category: PassThroughCategory | null;
  status: PassThroughStatus;
  xeroAccount?: string;
  xeroReference?: string;
  activity: PassThroughActivity[];
}

export const XERO_ACCOUNT_MAP: Record<PassThroughCategory, string | null> = {
  'Food & goods': 'Food Purchases',
  Rent: 'Rent & Rates',
  Utilities: 'Utilities',
  Insurance: 'Insurance',
  Accountant: 'Accountancy Fees',
  Marketing: 'Marketing & Advertising',
  Other: null,
};

export const CATEGORY_OPTIONS: PassThroughCategory[] = [
  'Food & goods',
  'Rent',
  'Utilities',
  'Insurance',
  'Accountant',
  'Marketing',
  'Other',
];

export function vatAmount(p: PassThroughInvoice): number {
  if (p.vatRate === null) return 0;
  return p.totalExVat * (p.vatRate / 100);
}

export function grandTotal(p: PassThroughInvoice): number {
  return p.totalExVat + vatAmount(p);
}

export const MOCK_PASS_THROUGH_INVOICES: PassThroughInvoice[] = [
  {
    id: 'pt-1',
    invoiceNumber: 'UTIL-8821',
    supplier: 'Brighton Energy',
    invoiceDate: '2 Apr 2026',
    dueDate: '14 Apr 2026',
    totalExVat: 482.40,
    vatRate: 20,
    category: 'Utilities',
    status: 'Ready to send',
    xeroAccount: 'Utilities',
    activity: [
      { id: 'pa-1', timestamp: '2 Apr 2026 · 09:12', event: 'auto-routed', by: 'System', note: 'No matching supplier in Edify catalogue.' },
      { id: 'pa-2', timestamp: '2 Apr 2026 · 09:18', event: 'fields-reviewed', by: 'Priya Naidoo', note: 'Confirmed supplier and due date.' },
      { id: 'pa-3', timestamp: '2 Apr 2026 · 09:18', event: 'category-set', by: 'Priya Naidoo', note: 'Category set to Utilities.' },
    ],
  },
  {
    id: 'pt-2',
    invoiceNumber: 'RENT-04',
    supplier: 'Landmark Estate Management',
    invoiceDate: '1 Apr 2026',
    dueDate: '1 Apr 2026',
    totalExVat: 4200.00,
    vatRate: null,
    category: 'Rent',
    status: 'Sent to Xero',
    xeroAccount: 'Rent & Rates',
    xeroReference: 'XERO-INV-9912',
    activity: [
      { id: 'pa-4', timestamp: '1 Apr 2026 · 08:05', event: 'auto-routed', by: 'System', note: 'No matching supplier in Edify catalogue.' },
      { id: 'pa-5', timestamp: '1 Apr 2026 · 08:30', event: 'fields-reviewed', by: 'Priya Naidoo' },
      { id: 'pa-6', timestamp: '1 Apr 2026 · 08:31', event: 'category-set', by: 'Priya Naidoo', note: 'Category set to Rent.' },
      { id: 'pa-7', timestamp: '1 Apr 2026 · 08:35', event: 'sent', by: 'Priya Naidoo', note: 'Pushed to Xero · account "Rent & Rates" · ref XERO-INV-9912.' },
    ],
  },
  {
    id: 'pt-3',
    invoiceNumber: 'INS-2026',
    supplier: 'Hiscox',
    invoiceDate: '28 Mar 2026',
    dueDate: '30 Apr 2026',
    totalExVat: 1140.00,
    vatRate: 20,
    category: null,
    status: 'Awaiting review',
    activity: [
      { id: 'pa-8', timestamp: '28 Mar 2026 · 07:40', event: 'auto-routed', by: 'System', note: 'No matching supplier in Edify catalogue.' },
    ],
  },
];

export function passThroughCount(status?: PassThroughStatus): number {
  if (!status) return MOCK_PASS_THROUGH_INVOICES.length;
  return MOCK_PASS_THROUGH_INVOICES.filter(p => p.status === status).length;
}

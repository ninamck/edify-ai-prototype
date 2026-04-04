import { MOCK_COMPLETED_DELIVERIES, GRN } from '@/components/Receiving/mockData';
export type { GRN } from '@/components/Receiving/mockData';

export type InvoiceMatchStatus =
  | 'Matched'
  | 'Variance'
  | 'Parse Failed'
  | 'Duplicate'
  | 'Approved'
  | 'Matching in Progress';

export type PriceResolution = 'Accept & Update Cost' | 'Accept This Delivery' | 'Dispute → Credit Note';
export type QtyResolution = 'Credit Note' | 'Accept Short' | 'Back-order';

export interface InvoiceLine {
  id: string;
  description: string;
  sku: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface MatchVariance {
  id: string;
  itemName: string;
  sku: string;
  type: 'price' | 'qty';
  invoiceValue: number;
  grnValue: number;
  poValue: number;
  impact: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  supplier: string;
  date: string;
  total: number;
  grnNumbers: string[];
  suggestedGRN?: string;
  status: InvoiceMatchStatus;
  lines: InvoiceLine[];
  variances: MatchVariance[];
}

export interface GRNMatchLine {
  id: string;
  description: string;
  sku: string;
  receivedQty: number;
  expectedQty: number;
  unitPrice: number;
  lineTotal: number;
  matched: boolean;
}

export interface InvoiceWithGRN {
  invoice: Invoice;
  grn: GRN | null;
  grnMatchLines: GRNMatchLine[];
}

export const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    invoiceNumber: 'INV-4421',
    supplier: 'Bidfood',
    date: '2 Apr 2026',
    total: 918.60,
    grnNumbers: ['GRN-1244'],
    suggestedGRN: 'GRN-1245',
    status: 'Variance',
    lines: [
      { id: 'il-1', description: 'Full cream milk 2L', sku: 'FCM-2L', qty: 18, unitPrice: 4.50, lineTotal: 81.00 },
      { id: 'il-2', description: 'Double cream 1L', sku: 'DC-1L', qty: 8, unitPrice: 8.00, lineTotal: 64.00 },
      { id: 'il-3', description: 'Free range eggs 15pk', sku: 'FRE-15', qty: 12, unitPrice: 8.50, lineTotal: 102.00 },
      { id: 'il-4', description: 'Unsalted butter 500g', sku: 'UB-500', qty: 6, unitPrice: 6.50, lineTotal: 39.00 },
      { id: 'il-5', description: 'Espresso blend 1kg', sku: 'EB-1KG', qty: 10, unitPrice: 19.20, lineTotal: 192.00 },
      { id: 'il-6', description: 'Oat milk 1L', sku: 'OM-1L', qty: 24, unitPrice: 4.00, lineTotal: 96.00 },
      { id: 'il-7', description: 'Takeaway cups 12oz', sku: 'TC-12', qty: 4, unitPrice: 28.00, lineTotal: 112.00 },
    ],
    variances: [
      { id: 'v-1', itemName: 'Full cream milk 2L', sku: 'FCM-2L', type: 'price', invoiceValue: 4.50, grnValue: 4.20, poValue: 4.20, impact: 5.40 },
      { id: 'v-2', itemName: 'Free range eggs 15pk', sku: 'FRE-15', type: 'price', invoiceValue: 8.50, grnValue: 8.00, poValue: 8.00, impact: 6.00 },
      { id: 'v-6', itemName: 'Espresso blend 1kg', sku: 'EB-1KG', type: 'price', invoiceValue: 19.20, grnValue: 18.00, poValue: 18.00, impact: 12.00 },
    ],
  },
  {
    id: 'inv-2',
    invoiceNumber: 'INV-4418',
    supplier: 'Fresh Direct',
    date: '1 Apr 2026',
    total: 239.80,
    grnNumbers: ['GRN-1243'],
    status: 'Variance',
    lines: [
      { id: 'il-8', description: 'Baby spinach 500g', sku: 'BS-500', qty: 6, unitPrice: 3.80, lineTotal: 22.80 },
      { id: 'il-9', description: 'Cherry tomatoes 500g', sku: 'CT-500', qty: 8, unitPrice: 3.80, lineTotal: 30.40 },
      { id: 'il-10', description: 'Sourdough loaves', sku: 'SDL-WH', qty: 20, unitPrice: 6.00, lineTotal: 120.00 },
      { id: 'il-11', description: 'Avocados', sku: 'AVO-EA', qty: 24, unitPrice: 2.10, lineTotal: 50.40 },
      { id: 'il-12', description: 'Lemons', sku: 'LEM-EA', qty: 30, unitPrice: 0.55, lineTotal: 16.50 },
    ],
    variances: [
      { id: 'v-4', itemName: 'Baby spinach 500g', sku: 'BS-500', type: 'price', invoiceValue: 3.80, grnValue: 3.50, poValue: 3.50, impact: 1.80 },
      { id: 'v-5', itemName: 'Cherry tomatoes 500g', sku: 'CT-500', type: 'price', invoiceValue: 3.80, grnValue: 3.50, poValue: 3.50, impact: 2.40 },
      { id: 'v-7', itemName: 'Avocados', sku: 'AVO-EA', type: 'price', invoiceValue: 2.10, grnValue: 2.00, poValue: 2.00, impact: 2.40 },
      { id: 'v-8', itemName: 'Lemons', sku: 'LEM-EA', type: 'price', invoiceValue: 0.55, grnValue: 0.60, poValue: 0.60, impact: -1.50 },
    ],
  },
  {
    id: 'inv-3',
    invoiceNumber: 'INV-4415',
    supplier: 'Metro',
    date: '31 Mar 2026',
    total: 98.00,
    grnNumbers: ['GRN-1240'],
    status: 'Approved',
    lines: [
      { id: 'il-13', description: 'Napkins (white)', sku: 'NAP-W', qty: 10, unitPrice: 3.80, lineTotal: 38.00 },
      { id: 'il-14', description: 'Sugar sachets', sku: 'SUG-S', qty: 5, unitPrice: 12.00, lineTotal: 60.00 },
    ],
    variances: [],
  },
  {
    id: 'inv-4',
    invoiceNumber: 'INV-4422',
    supplier: 'Bidfood',
    date: '2 Apr 2026',
    total: 440.00,
    grnNumbers: [],
    status: 'Parse Failed',
    lines: [],
    variances: [],
  },
  {
    id: 'inv-5',
    invoiceNumber: 'INV-4415',
    supplier: 'Metro',
    date: '2 Apr 2026',
    total: 98.00,
    grnNumbers: ['GRN-1240'],
    status: 'Duplicate',
    lines: [],
    variances: [],
  },
];

export function getGRNsForInvoice(invoice: Invoice, extraGRNs: string[] = []): GRN[] {
  const allNumbers = [...invoice.grnNumbers, ...extraGRNs];
  return allNumbers
    .map(num => MOCK_COMPLETED_DELIVERIES.find(g => g.grnNumber === num))
    .filter((g): g is GRN => g != null);
}

export function getGRNForInvoice(invoice: Invoice): GRN | null {
  const grns = getGRNsForInvoice(invoice);
  return grns[0] ?? null;
}

export function getSuggestedGRN(invoice: Invoice): GRN | null {
  if (!invoice.suggestedGRN) return null;
  return MOCK_COMPLETED_DELIVERIES.find(g => g.grnNumber === invoice.suggestedGRN) ?? null;
}

export function getGRNMatchLines(invoice: Invoice, extraGRNs: string[] = []): GRNMatchLine[] {
  const grns = getGRNsForInvoice(invoice, extraGRNs);
  if (grns.length === 0) return [];
  const allGRNLines = grns.flatMap(grn => grn.lines);
  return allGRNLines.map(gl => ({
    id: gl.id,
    description: gl.name,
    sku: gl.sku,
    receivedQty: gl.receivedQty,
    expectedQty: gl.expectedQty,
    unitPrice: gl.price,
    lineTotal: gl.receivedQty * gl.price,
    matched: !invoice.variances.some(v => v.sku === gl.sku),
  }));
}

export function getUnmatchedInvoiceLines(invoice: Invoice, extraGRNs: string[] = []): InvoiceLine[] {
  const grnLines = getGRNMatchLines(invoice, extraGRNs);
  const grnSkus = new Set(grnLines.map(gl => gl.sku));
  return invoice.lines.filter(il => !grnSkus.has(il.sku));
}

export function invoiceGRNTotal(invoice: Invoice, extraGRNs: string[] = []): number {
  const lines = getGRNMatchLines(invoice, extraGRNs);
  return lines.reduce((sum, l) => sum + l.lineTotal, 0);
}

export function needsReviewCount(): number {
  return MOCK_INVOICES.filter(i => i.status === 'Variance' || i.status === 'Parse Failed' || i.status === 'Duplicate').length;
}

export function autoMatchedCount(): number {
  return MOCK_INVOICES.filter(i => i.status === 'Approved' || i.status === 'Matched').length;
}

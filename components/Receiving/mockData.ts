export type POStatus = 'Draft' | 'Sent' | 'Partially Received' | 'Fully Received' | 'Closed' | 'Cancelled';
export type GRNStatus = 'Created' | 'Pending Invoice' | 'Matched' | 'Variance — Awaiting Resolution' | 'Closed';
export type InvoiceStatus = 'Pending Invoice' | 'Matched' | 'Closed';
export type VarianceResolution = 'Request credit note' | 'Back-order remaining' | 'Accept short';

export interface POLine {
  id: string;
  name: string;
  sku: string;
  unit: string;
  price: number;
  expectedQty: number;
}

export interface PO {
  id: string;
  poNumber: string;
  supplier: string;
  site: string;
  status: POStatus;
  dateSent: string;
  lines: POLine[];
}

export interface GRNLine {
  id: string;
  poLineId: string;
  name: string;
  sku: string;
  unit: string;
  price: number;
  expectedQty: number;
  receivedQty: number;
  varianceResolution?: VarianceResolution;
}

export interface GRN {
  id: string;
  grnNumber: string;
  poNumbers: string[];
  supplier: string;
  site: string;
  status: GRNStatus;
  dateReceived: string;
  receivedBy: string;
  invoiceNumber?: string;
  invoiceStatus: InvoiceStatus;
  lines: GRNLine[];
}

export const MOCK_POS: PO[] = [
  {
    id: 'po-1',
    poNumber: 'PO-2901',
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Sent',
    dateSent: '28 Mar 2026',
    lines: [
      { id: 'pl-1', name: 'Full cream milk 2L', sku: 'FCM-2L', unit: 'EA', price: 4.20, expectedQty: 20 },
      { id: 'pl-2', name: 'Double cream 1L', sku: 'DC-1L', unit: 'EA', price: 8.00, expectedQty: 8 },
      { id: 'pl-3', name: 'Free range eggs 15pk', sku: 'FRE-15', unit: 'EA', price: 8.00, expectedQty: 12 },
      { id: 'pl-4', name: 'Unsalted butter 500g', sku: 'UB-500', unit: 'EA', price: 6.50, expectedQty: 6 },
    ],
  },
  {
    id: 'po-2',
    poNumber: 'PO-2903',
    supplier: 'Fresh Direct',
    site: 'Fitzroy Espresso',
    status: 'Sent',
    dateSent: '29 Mar 2026',
    lines: [
      { id: 'pl-5', name: 'Baby spinach 500g', sku: 'BS-500', unit: 'BAG', price: 3.50, expectedQty: 6 },
      { id: 'pl-6', name: 'Cherry tomatoes 500g', sku: 'CT-500', unit: 'PUN', price: 3.50, expectedQty: 8 },
      { id: 'pl-7', name: 'Sourdough loaves', sku: 'SDL-WH', unit: 'EA', price: 6.00, expectedQty: 20 },
      { id: 'pl-8', name: 'Avocados', sku: 'AVO-EA', unit: 'EA', price: 2.00, expectedQty: 24 },
      { id: 'pl-9', name: 'Lemons', sku: 'LEM-EA', unit: 'EA', price: 0.60, expectedQty: 30 },
    ],
  },
  {
    id: 'po-3',
    poNumber: 'PO-2890',
    supplier: 'Bidfood',
    site: 'City Centre',
    status: 'Partially Received',
    dateSent: '25 Mar 2026',
    lines: [
      { id: 'pl-10', name: 'Espresso blend 1kg', sku: 'EB-1KG', unit: 'BAG', price: 18.00, expectedQty: 10 },
      { id: 'pl-11', name: 'Oat milk 1L', sku: 'OM-1L', unit: 'CTN', price: 4.00, expectedQty: 24 },
      { id: 'pl-12', name: 'Takeaway cups 12oz', sku: 'TC-12', unit: 'CASE', price: 28.00, expectedQty: 4 },
    ],
  },
  {
    id: 'po-4',
    poNumber: 'PO-2895',
    supplier: 'Metro',
    site: 'Fitzroy Espresso',
    status: 'Sent',
    dateSent: '26 Mar 2026',
    lines: [
      { id: 'pl-13', name: 'Napkins (white)', sku: 'NAP-W', unit: 'PKT', price: 3.80, expectedQty: 10 },
      { id: 'pl-14', name: 'Sugar sachets', sku: 'SUG-S', unit: 'BOX', price: 12.00, expectedQty: 5 },
    ],
  },
];

export const MOCK_COMPLETED_DELIVERIES: GRN[] = [
  {
    id: 'grn-1',
    grnNumber: 'GRN-1244',
    poNumbers: ['PO-2880'],
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Pending Invoice',
    dateReceived: '26 Mar 2026',
    receivedBy: 'Ravi Patel',
    invoiceStatus: 'Pending Invoice',
    lines: [
      { id: 'gl-1', poLineId: 'pl-x1', name: 'Full cream milk 2L', sku: 'FCM-2L', unit: 'EA', price: 4.20, expectedQty: 20, receivedQty: 18 },
      { id: 'gl-2', poLineId: 'pl-x2', name: 'Double cream 1L', sku: 'DC-1L', unit: 'EA', price: 8.00, expectedQty: 8, receivedQty: 8 },
      { id: 'gl-2b', poLineId: 'pl-x2b', name: 'Free range eggs 15pk', sku: 'FRE-15', unit: 'EA', price: 8.00, expectedQty: 12, receivedQty: 12 },
      { id: 'gl-2c', poLineId: 'pl-x2c', name: 'Unsalted butter 500g', sku: 'UB-500', unit: 'EA', price: 6.50, expectedQty: 6, receivedQty: 6 },
    ],
  },
  {
    id: 'grn-4',
    grnNumber: 'GRN-1245',
    poNumbers: ['PO-2890'],
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Pending Invoice',
    dateReceived: '27 Mar 2026',
    receivedBy: 'Aisha Nguyen',
    invoiceStatus: 'Pending Invoice',
    lines: [
      { id: 'gl-6', poLineId: 'pl-10', name: 'Espresso blend 1kg', sku: 'EB-1KG', unit: 'BAG', price: 18.00, expectedQty: 10, receivedQty: 10 },
      { id: 'gl-7', poLineId: 'pl-11', name: 'Oat milk 1L', sku: 'OM-1L', unit: 'CTN', price: 4.00, expectedQty: 24, receivedQty: 24 },
      { id: 'gl-8', poLineId: 'pl-12', name: 'Takeaway cups 12oz', sku: 'TC-12', unit: 'CASE', price: 28.00, expectedQty: 4, receivedQty: 4 },
    ],
  },
  {
    id: 'grn-2',
    grnNumber: 'GRN-1243',
    poNumbers: ['PO-2875'],
    supplier: 'Fresh Direct',
    site: 'Fitzroy Espresso',
    status: 'Pending Invoice',
    dateReceived: '24 Mar 2026',
    receivedBy: 'Aisha Nguyen',
    invoiceStatus: 'Pending Invoice',
    lines: [
      { id: 'gl-3', poLineId: 'pl-x3', name: 'Baby spinach 500g', sku: 'BS-500', unit: 'BAG', price: 3.50, expectedQty: 6, receivedQty: 6 },
      { id: 'gl-4', poLineId: 'pl-x4', name: 'Cherry tomatoes 500g', sku: 'CT-500', unit: 'PUN', price: 3.50, expectedQty: 8, receivedQty: 8 },
      { id: 'gl-4b', poLineId: 'pl-x4b', name: 'Sourdough loaves', sku: 'SDL-WH', unit: 'EA', price: 6.00, expectedQty: 20, receivedQty: 20 },
      { id: 'gl-4c', poLineId: 'pl-x4c', name: 'Avocados', sku: 'AVO-EA', unit: 'EA', price: 2.00, expectedQty: 24, receivedQty: 24 },
      { id: 'gl-4d', poLineId: 'pl-x4d', name: 'Lemons', sku: 'LEM-EA', unit: 'EA', price: 0.60, expectedQty: 30, receivedQty: 30 },
    ],
  },
  {
    id: 'grn-3',
    grnNumber: 'GRN-1240',
    poNumbers: ['PO-2860'],
    supplier: 'Metro',
    site: 'City Centre',
    status: 'Closed',
    dateReceived: '21 Mar 2026',
    receivedBy: 'Ravi Patel',
    invoiceNumber: 'INV-4380',
    invoiceStatus: 'Closed',
    lines: [
      { id: 'gl-5', poLineId: 'pl-x5', name: 'Napkins (white)', sku: 'NAP-W', unit: 'PKT', price: 3.80, expectedQty: 10, receivedQty: 10 },
    ],
  },
];

export function poItemCount(po: PO): number {
  return po.lines.length;
}

export function poTotal(po: PO): string {
  const t = po.lines.reduce((sum, l) => sum + l.price * l.expectedQty, 0);
  return `$${t.toFixed(2)}`;
}

export function grnVarianceCount(grn: GRN): number {
  return grn.lines.filter(l => l.receivedQty !== l.expectedQty).length;
}

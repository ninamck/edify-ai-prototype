import { isMultiCurrencyDemo } from '@/lib/demoConfig';
import type { CurrencyCode } from '@/lib/currency';
import { BASE_CURRENCY, formatMoney, fxRate } from '@/lib/currency';

export type POStatus = 'Draft' | 'Sent' | 'Partially Received' | 'Fully Received' | 'Closed' | 'Cancelled';
export type GRNStatus = 'Created' | 'Pending Invoice' | 'Matched' | 'Variance — Awaiting Resolution' | 'Closed';
export type InvoiceStatus = 'Pending Invoice' | 'Matched' | 'Closed';
export type VarianceResolution = 'Request credit note' | 'Coming in another delivery' | 'Accept short';

export interface POLine {
  id: string;
  name: string;
  sku: string;
  unit: string;
  price: number;
  expectedQty: number;
  /** Optional link to the catalogue master product this line rolls up into.
   *  Used to blend the delivered cost into the master's weighted-average cost
   *  and to prefill the master when receiving an alternative SKU. */
  masterProductId?: string;
  /** How many master `unit`s each ordered line item contains (e.g. a "15pk"
   *  egg line = 15 eggs). Lets the WAC math normalise across pack sizes. */
  unitsPerLineItem?: number;
}

export interface PO {
  id: string;
  poNumber: string;
  supplier: string;
  site: string;
  status: POStatus;
  dateSent: string;
  lines: POLine[];
  /**
   * Transaction currency the PO (and its line prices) is denominated in —
   * the supplier's billing currency. Absent = base currency (GBP).
   */
  currency?: CurrencyCode;
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
  alternativeFor?: {
    poLineId: string;
    poName: string;
    poSku: string;
    poExpectedQty: number;
    note: string;
  };
  /** Set when an existing catalogue item was added at receiving without a
   *  PO line — e.g. phoned through to the supplier after the PO was sent. */
  addedAtReceiving?: { note: string };
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
  attachmentUrl?: string;
  lines: GRNLine[];
  /** Transaction currency of the delivery (from the PO). Absent = GBP. */
  currency?: CurrencyCode;
  /**
   * Exchange rate into the base currency locked at goods receipt, so the
   * cost recorded in inventory matches the supplier's invoice. Only set for
   * foreign-currency deliveries.
   */
  lockedFxRate?: number;
}

export interface DeliveryCommitLine {
  poLineId: string;
  receivedQty: number;
  resolution?: VarianceResolution;
}

/** An existing catalogue item received without a PO line (added to the
 *  order after the PO was sent), staged in the receiving screen. */
export interface DeliveryCommitExtra {
  id: string;
  productId: string;
  name: string;
  sku: string;
  unit: string;
  price: number;
  qty: number;
}

export interface DeliveryCommitAlternative {
  id: string;
  originPoLineId?: string;
  masterProductId: string;
  masterName: string;
  masterUnit: string;
  productName: string;
  supplierCode: string;
  packType: 'Pack' | 'Single';
  packQty: number;
  singleUnitType: 'Each' | 'kg' | 'L' | 'g' | 'ml';
  packCost: number;
  receivedQty: number;
  supplierName: string;
  site: string;
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
      { id: 'pl-3', name: 'Free range eggs 15pk', sku: 'FRE-15', unit: 'EA', price: 8.00, expectedQty: 12, masterProductId: 'mp-eggs', unitsPerLineItem: 15 },
      { id: 'pl-4', name: 'Unsalted butter 500g', sku: 'UB-500', unit: 'EA', price: 6.50, expectedQty: 6 },
      { id: 'pl-4b', name: 'Dishwasher tablets 100pk', sku: 'DWT-100', unit: 'BOX', price: 24.00, expectedQty: 2 },
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
  {
    id: 'po-5',
    poNumber: 'PO-2907',
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Partially Received',
    dateSent: '2 Apr 2026',
    lines: [
      { id: 'pl-15', name: 'Full cream milk 2L', sku: 'FCM-2L', unit: 'EA', price: 4.20, expectedQty: 30 },
      { id: 'pl-16', name: 'Double cream 1L', sku: 'DC-1L', unit: 'EA', price: 8.00, expectedQty: 10 },
      { id: 'pl-17', name: 'Free range eggs 15pk', sku: 'FRE-15', unit: 'EA', price: 8.00, expectedQty: 15, masterProductId: 'mp-eggs', unitsPerLineItem: 15 },
      { id: 'pl-18', name: 'Unsalted butter 500g', sku: 'UB-500', unit: 'EA', price: 6.50, expectedQty: 12 },
      { id: 'pl-19', name: 'Plain flour 10kg', sku: 'FLR-10', unit: 'SACK', price: 18.00, expectedQty: 4 },
    ],
  },
  {
    id: 'po-6',
    poNumber: 'PO-2910',
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Partially Received',
    dateSent: '6 Apr 2026',
    lines: [
      { id: 'pl-20', name: 'Full cream milk 2L', sku: 'FCM-2L', unit: 'EA', price: 4.20, expectedQty: 20 },
      { id: 'pl-21', name: 'Plain flour 10kg', sku: 'FLR-10', unit: 'SACK', price: 18.00, expectedQty: 5 },
    ],
  },
  {
    id: 'po-7',
    poNumber: 'PO-2915',
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Sent',
    dateSent: '10 Apr 2026',
    lines: [
      { id: 'pl-22', name: 'Double cream 1L', sku: 'DC-1L', unit: 'EA', price: 8.00, expectedQty: 8 },
      { id: 'pl-23', name: 'Free range eggs 15pk', sku: 'FRE-15', unit: 'EA', price: 8.00, expectedQty: 10, masterProductId: 'mp-eggs', unitsPerLineItem: 15 },
    ],
  },
  // ── Complex-flow demo: one weekly Bidfood order split across two POs,
  //    delivered in three drops (GRN-1260/1261/1262), invoiced three times. ──
  {
    id: 'po-8',
    poNumber: 'PO-2920',
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Fully Received',
    dateSent: '6 Apr 2026',
    lines: [
      { id: 'pl-24', name: 'Full cream milk 2L', sku: 'FCM-2L', unit: 'EA', price: 4.20, expectedQty: 40 },
      { id: 'pl-25', name: 'Oat milk 1L', sku: 'OM-1L', unit: 'CTN', price: 4.00, expectedQty: 30 },
      { id: 'pl-26', name: 'Double cream 1L', sku: 'DC-1L', unit: 'EA', price: 8.00, expectedQty: 12 },
    ],
  },
  {
    id: 'po-9',
    poNumber: 'PO-2921',
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Fully Received',
    dateSent: '6 Apr 2026',
    lines: [
      { id: 'pl-27', name: 'Plain flour 10kg', sku: 'FLR-10', unit: 'SACK', price: 18.00, expectedQty: 6 },
      { id: 'pl-28', name: 'Espresso blend 1kg', sku: 'EB-1KG', unit: 'BAG', price: 18.00, expectedQty: 12 },
      { id: 'pl-29', name: 'Takeaway cups 12oz', sku: 'TC-12', unit: 'CASE', price: 28.00, expectedQty: 6 },
    ],
  },
  // ── Ambiguous-match demo: standing weekly dairy top-up. Two near-identical
  //    drops (GRN-1270, GRN-1271) arrive a day apart against this PO, then an
  //    invoice lands with no PO or delivery reference — the system can't tell
  //    which drop it bills, so the reviewer has to pick manually. ──
  {
    id: 'po-10',
    poNumber: 'PO-2925',
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Partially Received',
    dateSent: '11 Apr 2026',
    lines: [
      { id: 'pl-30', name: 'Full cream milk 2L', sku: 'FCM-2L', unit: 'EA', price: 4.20, expectedQty: 38 },
      { id: 'pl-31', name: 'Double cream 1L', sku: 'DC-1L', unit: 'EA', price: 8.00, expectedQty: 12 },
    ],
  },
  // ── Upload-invoice demo: Fresh Direct produce order received in full on
  //    14 Apr, still awaiting its invoice — the uploaded PDF/photo bills it. ──
  {
    id: 'po-11',
    poNumber: 'PO-2926',
    supplier: 'Fresh Direct',
    site: 'Fitzroy Espresso',
    status: 'Fully Received',
    dateSent: '13 Apr 2026',
    lines: [
      { id: 'pl-32', name: 'Baby spinach 500g', sku: 'BS-500', unit: 'BAG', price: 3.50, expectedQty: 8 },
      { id: 'pl-33', name: 'Cherry tomatoes 500g', sku: 'CT-500', unit: 'PUN', price: 3.50, expectedQty: 10 },
      { id: 'pl-34', name: 'Avocados', sku: 'AVO-EA', unit: 'EA', price: 2.00, expectedQty: 30 },
      { id: 'pl-35', name: 'Lemons', sku: 'LEM-EA', unit: 'EA', price: 0.60, expectedQty: 40 },
      { id: 'pl-36', name: 'Sourdough loaves', sku: 'SDL-WH', unit: 'EA', price: 6.00, expectedQty: 15 },
    ],
  },
  // Second Cup build only: a CAD-denominated PO on the franchisor's Canadian
  // supply base. Prices are in CAD (the supplier's billing currency).
  ...(isMultiCurrencyDemo
    ? ([
        {
          id: 'po-sc-0',
          poNumber: 'PO-2918',
          supplier: 'Second Cup Central Supply (Canada)',
          site: 'Fitzroy Espresso',
          status: 'Fully Received' as POStatus,
          dateSent: '27 Mar 2026',
          currency: 'CAD' as CurrencyCode,
          lines: [
            { id: 'pl-sc-p1', name: 'Espresso Forte whole bean 1kg', sku: 'SC-ESP-1KG', unit: 'BAG', price: 28.00, expectedQty: 12 },
            { id: 'pl-sc-p2', name: 'Second Cup vanilla syrup 1L', sku: 'SC-VAN-1L', unit: 'EA', price: 10.50, expectedQty: 6 },
            { id: 'pl-sc-p3', name: 'Branded hot cup + lid 12oz', sku: 'SC-CUP-12OZ', unit: 'CASE', price: 95.00, expectedQty: 2 },
          ],
        },
        {
          id: 'po-sc-1',
          // PO-2920 is taken by the Bidfood complex-flow demo above.
          poNumber: 'PO-2930',
          supplier: 'Second Cup Central Supply (Canada)',
          site: 'Fitzroy Espresso',
          status: 'Sent' as POStatus,
          dateSent: '9 Apr 2026',
          currency: 'CAD' as CurrencyCode,
          lines: [
            { id: 'pl-sc-1', name: 'Espresso Forte whole bean 1kg', sku: 'SC-ESP-1KG', unit: 'BAG', price: 28.00, expectedQty: 14 },
            { id: 'pl-sc-2', name: 'Paradiso medium roast 1kg', sku: 'SC-PAR-1KG', unit: 'BAG', price: 23.00, expectedQty: 9 },
            { id: 'pl-sc-3', name: 'Second Cup vanilla syrup 1L', sku: 'SC-VAN-1L', unit: 'EA', price: 10.50, expectedQty: 7 },
            { id: 'pl-sc-4', name: 'Branded hot cup + lid 12oz', sku: 'SC-CUP-12OZ', unit: 'CASE', price: 95.00, expectedQty: 3 },
          ],
        },
      ] satisfies PO[])
    : []),
];

export const MOCK_COMPLETED_DELIVERIES: GRN[] = [
  {
    id: 'grn-1',
    grnNumber: 'GRN-1244',
    poNumbers: ['PO-2901'],
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Pending Invoice',
    dateReceived: '26 Mar 2026',
    receivedBy: 'Ed Barry',
    invoiceStatus: 'Pending Invoice',
    attachmentUrl: '/mock-grn-doc.pdf',
    lines: [
      // FCM-2L is split across GRN-1244 and GRN-1245 — the supplier delivered
      // the milk order in two drops (demo: one invoice line ← two deliveries)
      { id: 'gl-1', poLineId: 'pl-1', name: 'Full cream milk 2L', sku: 'FCM-2L', unit: 'EA', price: 4.20, expectedQty: 12, receivedQty: 12 },
      { id: 'gl-2', poLineId: 'pl-2', name: 'Double cream 1L', sku: 'DC-1L', unit: 'EA', price: 8.00, expectedQty: 8, receivedQty: 8 },
      { id: 'gl-2b', poLineId: 'pl-3', name: 'Free range eggs 15pk', sku: 'FRE-15', unit: 'EA', price: 8.00, expectedQty: 12, receivedQty: 12 },
      { id: 'gl-2c', poLineId: 'pl-4', name: 'Unsalted butter 500g', sku: 'UB-500', unit: 'EA', price: 6.50, expectedQty: 6, receivedQty: 6 },
      { id: 'gl-2d', poLineId: 'pl-4b', name: 'Dishwasher tablets 100pk', sku: 'DWT-100', unit: 'BOX', price: 24.00, expectedQty: 2, receivedQty: 2 },
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
      // Balance of the milk order from PO-2901 — second drop, arrived 2 short
      { id: 'gl-8b', poLineId: 'pl-1', name: 'Full cream milk 2L', sku: 'FCM-2L', unit: 'EA', price: 4.20, expectedQty: 8, receivedQty: 6 },
    ],
  },
  {
    id: 'grn-2',
    grnNumber: 'GRN-1243',
    poNumbers: ['PO-2903'],
    supplier: 'Fresh Direct',
    site: 'Fitzroy Espresso',
    status: 'Pending Invoice',
    dateReceived: '24 Mar 2026',
    receivedBy: 'Aisha Nguyen',
    invoiceStatus: 'Pending Invoice',
    attachmentUrl: '/mock-grn-doc.pdf',
    lines: [
      { id: 'gl-3', poLineId: 'pl-5', name: 'Baby spinach 500g', sku: 'BS-500', unit: 'BAG', price: 3.50, expectedQty: 6, receivedQty: 6 },
      { id: 'gl-4', poLineId: 'pl-6', name: 'Cherry tomatoes 500g', sku: 'CT-500', unit: 'PUN', price: 3.50, expectedQty: 8, receivedQty: 8 },
      { id: 'gl-4b', poLineId: 'pl-7', name: 'Sourdough loaves', sku: 'SDL-WH', unit: 'EA', price: 6.00, expectedQty: 20, receivedQty: 20 },
      { id: 'gl-4c', poLineId: 'pl-8', name: 'Avocados', sku: 'AVO-EA', unit: 'EA', price: 2.00, expectedQty: 24, receivedQty: 24 },
      { id: 'gl-4d', poLineId: 'pl-9', name: 'Lemons', sku: 'LEM-EA', unit: 'EA', price: 0.60, expectedQty: 30, receivedQty: 30 },
    ],
  },
  {
    id: 'grn-3',
    grnNumber: 'GRN-1240',
    poNumbers: ['PO-2895'],
    supplier: 'Metro',
    site: 'City Centre',
    status: 'Closed',
    dateReceived: '21 Mar 2026',
    receivedBy: 'Ed Barry',
    invoiceNumber: 'INV-4380',
    invoiceStatus: 'Closed',
    lines: [
      { id: 'gl-5', poLineId: 'pl-13', name: 'Napkins (white)', sku: 'NAP-W', unit: 'PKT', price: 3.80, expectedQty: 10, receivedQty: 10 },
    ],
  },
  {
    id: 'grn-5',
    grnNumber: 'GRN-1248',
    poNumbers: ['PO-2907'],
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Pending Invoice',
    dateReceived: '4 Apr 2026',
    receivedBy: 'Ed Barry',
    invoiceStatus: 'Pending Invoice',
    lines: [
      { id: 'gl-9', poLineId: 'pl-15', name: 'Full cream milk 2L', sku: 'FCM-2L', unit: 'EA', price: 4.20, expectedQty: 30, receivedQty: 30 },
      { id: 'gl-10', poLineId: 'pl-16', name: 'Double cream 1L', sku: 'DC-1L', unit: 'EA', price: 8.00, expectedQty: 10, receivedQty: 10 },
      { id: 'gl-11', poLineId: 'pl-18', name: 'Unsalted butter 500g', sku: 'UB-500', unit: 'EA', price: 6.50, expectedQty: 12, receivedQty: 12 },
    ],
  },
  {
    id: 'grn-6',
    grnNumber: 'GRN-1249',
    poNumbers: ['PO-2907'],
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Pending Invoice',
    dateReceived: '5 Apr 2026',
    receivedBy: 'Aisha Nguyen',
    invoiceStatus: 'Pending Invoice',
    lines: [
      {
        id: 'gl-12',
        poLineId: 'pl-17',
        name: 'Free range eggs 4pk',
        sku: 'FRE-4',
        unit: 'PACK',
        price: 4.00,
        expectedQty: 15,
        receivedQty: 15,
        alternativeFor: {
          poLineId: 'pl-17',
          poName: 'Free range eggs 15pk',
          poSku: 'FRE-15',
          poExpectedQty: 15,
          note: 'Supplier sent alternative egg pack; reconciled during delivery and linked to Free Range Eggs master product.',
        },
      },
      { id: 'gl-13', poLineId: 'pl-19', name: 'Plain flour 10kg', sku: 'FLR-10', unit: 'SACK', price: 18.00, expectedQty: 4, receivedQty: 4 },
    ],
  },
  {
    id: 'grn-7',
    grnNumber: 'GRN-1250',
    poNumbers: ['PO-2910'],
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Pending Invoice',
    dateReceived: '7 Apr 2026',
    receivedBy: 'Ed Barry',
    invoiceStatus: 'Pending Invoice',
    lines: [
      { id: 'gl-14', poLineId: 'pl-20', name: 'Full cream milk 2L', sku: 'FCM-2L', unit: 'EA', price: 4.20, expectedQty: 20, receivedQty: 20 },
    ],
  },
  {
    id: 'grn-8',
    grnNumber: 'GRN-1251',
    poNumbers: ['PO-2910'],
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Pending Invoice',
    dateReceived: '8 Apr 2026',
    receivedBy: 'Aisha Nguyen',
    invoiceStatus: 'Pending Invoice',
    lines: [
      { id: 'gl-15', poLineId: 'pl-21', name: 'Plain flour 10kg', sku: 'FLR-10', unit: 'SACK', price: 18.00, expectedQty: 5, receivedQty: 4 },
    ],
  },
  // ── Complex-flow demo: three drops against PO-2920 + PO-2921 ──
  {
    id: 'grn-9',
    grnNumber: 'GRN-1260',
    poNumbers: ['PO-2920'],
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Pending Invoice',
    dateReceived: '8 Apr 2026',
    receivedBy: 'Ed Barry',
    invoiceStatus: 'Pending Invoice',
    lines: [
      { id: 'gl-16', poLineId: 'pl-24', name: 'Full cream milk 2L', sku: 'FCM-2L', unit: 'EA', price: 4.20, expectedQty: 25, receivedQty: 25 },
      { id: 'gl-17', poLineId: 'pl-25', name: 'Oat milk 1L', sku: 'OM-1L', unit: 'CTN', price: 4.00, expectedQty: 10, receivedQty: 10 },
    ],
  },
  {
    id: 'grn-10',
    grnNumber: 'GRN-1261',
    poNumbers: ['PO-2920', 'PO-2921'],
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Pending Invoice',
    dateReceived: '9 Apr 2026',
    receivedBy: 'Aisha Nguyen',
    invoiceStatus: 'Pending Invoice',
    lines: [
      { id: 'gl-18', poLineId: 'pl-24', name: 'Full cream milk 2L', sku: 'FCM-2L', unit: 'EA', price: 4.20, expectedQty: 15, receivedQty: 15 },
      { id: 'gl-19', poLineId: 'pl-25', name: 'Oat milk 1L', sku: 'OM-1L', unit: 'CTN', price: 4.00, expectedQty: 20, receivedQty: 20 },
      { id: 'gl-20', poLineId: 'pl-26', name: 'Double cream 1L', sku: 'DC-1L', unit: 'EA', price: 8.00, expectedQty: 12, receivedQty: 12 },
      { id: 'gl-21', poLineId: 'pl-27', name: 'Plain flour 10kg', sku: 'FLR-10', unit: 'SACK', price: 18.00, expectedQty: 6, receivedQty: 6 },
    ],
  },
  {
    id: 'grn-11',
    grnNumber: 'GRN-1262',
    poNumbers: ['PO-2921'],
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Pending Invoice',
    dateReceived: '10 Apr 2026',
    receivedBy: 'Ed Barry',
    invoiceStatus: 'Pending Invoice',
    lines: [
      { id: 'gl-22', poLineId: 'pl-28', name: 'Espresso blend 1kg', sku: 'EB-1KG', unit: 'BAG', price: 18.00, expectedQty: 12, receivedQty: 12 },
      { id: 'gl-23', poLineId: 'pl-29', name: 'Takeaway cups 12oz', sku: 'TC-12', unit: 'CASE', price: 28.00, expectedQty: 6, receivedQty: 6 },
    ],
  },
  // ── Ambiguous-match demo: two near-identical drops against PO-2925.
  //    GRN-1270 received the full milk count; GRN-1271 was short by 2. ──
  {
    id: 'grn-12',
    grnNumber: 'GRN-1270',
    poNumbers: ['PO-2925'],
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Pending Invoice',
    dateReceived: '12 Apr 2026',
    receivedBy: 'Ed Barry',
    invoiceStatus: 'Pending Invoice',
    lines: [
      { id: 'gl-24', poLineId: 'pl-30', name: 'Full cream milk 2L', sku: 'FCM-2L', unit: 'EA', price: 4.20, expectedQty: 18, receivedQty: 18 },
      { id: 'gl-25', poLineId: 'pl-31', name: 'Double cream 1L', sku: 'DC-1L', unit: 'EA', price: 8.00, expectedQty: 6, receivedQty: 6 },
    ],
  },
  {
    id: 'grn-13',
    grnNumber: 'GRN-1271',
    poNumbers: ['PO-2925'],
    supplier: 'Bidfood',
    site: 'Fitzroy Espresso',
    status: 'Pending Invoice',
    dateReceived: '13 Apr 2026',
    receivedBy: 'Aisha Nguyen',
    invoiceStatus: 'Pending Invoice',
    lines: [
      { id: 'gl-26', poLineId: 'pl-30', name: 'Full cream milk 2L', sku: 'FCM-2L', unit: 'EA', price: 4.20, expectedQty: 18, receivedQty: 16 },
      { id: 'gl-27', poLineId: 'pl-31', name: 'Double cream 1L', sku: 'DC-1L', unit: 'EA', price: 8.00, expectedQty: 6, receivedQty: 6 },
    ],
  },
  // ── Upload-invoice demo: full delivery against PO-2926, awaiting invoice ──
  {
    id: 'grn-14',
    grnNumber: 'GRN-1275',
    poNumbers: ['PO-2926'],
    supplier: 'Fresh Direct',
    site: 'Fitzroy Espresso',
    status: 'Pending Invoice',
    dateReceived: '14 Apr 2026',
    receivedBy: 'Priya Shah',
    invoiceStatus: 'Pending Invoice',
    lines: [
      { id: 'gl-28', poLineId: 'pl-32', name: 'Baby spinach 500g', sku: 'BS-500', unit: 'BAG', price: 3.50, expectedQty: 8, receivedQty: 8 },
      { id: 'gl-29', poLineId: 'pl-33', name: 'Cherry tomatoes 500g', sku: 'CT-500', unit: 'PUN', price: 3.50, expectedQty: 10, receivedQty: 10 },
      { id: 'gl-30', poLineId: 'pl-34', name: 'Avocados', sku: 'AVO-EA', unit: 'EA', price: 2.00, expectedQty: 30, receivedQty: 30 },
      { id: 'gl-31', poLineId: 'pl-35', name: 'Lemons', sku: 'LEM-EA', unit: 'EA', price: 0.60, expectedQty: 40, receivedQty: 40 },
      { id: 'gl-32', poLineId: 'pl-36', name: 'Sourdough loaves', sku: 'SDL-WH', unit: 'EA', price: 6.00, expectedQty: 15, receivedQty: 15 },
    ],
  },
  // Second Cup build only: an earlier CAD delivery from Central Supply with
  // the FX rate locked at receipt (0.58), so the invoice matches to the
  // penny even if the daily rate has since moved.
  ...(isMultiCurrencyDemo
    ? ([
        {
          id: 'grn-sc-1',
          // GRN-1260/61/62 and 1270/71 are taken by main's demo flows.
          grnNumber: 'GRN-1280',
          poNumbers: ['PO-2918'],
          supplier: 'Second Cup Central Supply (Canada)',
          site: 'Fitzroy Espresso',
          status: 'Pending Invoice' as GRNStatus,
          dateReceived: '6 Apr 2026',
          receivedBy: 'Ed Barry',
          invoiceStatus: 'Pending Invoice' as InvoiceStatus,
          currency: 'CAD' as CurrencyCode,
          lockedFxRate: 0.58,
          lines: [
            { id: 'gl-sc-1', poLineId: 'pl-sc-p1', name: 'Espresso Forte whole bean 1kg', sku: 'SC-ESP-1KG', unit: 'BAG', price: 28.00, expectedQty: 12, receivedQty: 12 },
            { id: 'gl-sc-2', poLineId: 'pl-sc-p2', name: 'Second Cup vanilla syrup 1L', sku: 'SC-VAN-1L', unit: 'EA', price: 10.50, expectedQty: 6, receivedQty: 6 },
            { id: 'gl-sc-3', poLineId: 'pl-sc-p3', name: 'Branded hot cup + lid 12oz', sku: 'SC-CUP-12OZ', unit: 'CASE', price: 95.00, expectedQty: 2, receivedQty: 2 },
          ],
        },
      ] satisfies GRN[])
    : []),
];

export function poItemCount(po: PO): number {
  return po.lines.length;
}

export function poTotal(po: PO): string {
  const t = po.lines.reduce((sum, l) => sum + l.price * l.expectedQty, 0);
  const currency = po.currency ?? BASE_CURRENCY;
  if (currency === BASE_CURRENCY) return formatMoney(t, BASE_CURRENCY);
  // Dual display for foreign-currency POs: supplier amount + base equivalent.
  return `${formatMoney(t, currency)} (${formatMoney(t * fxRate(currency, BASE_CURRENCY), BASE_CURRENCY)})`;
}

export function grnVarianceCount(grn: GRN): number {
  return grn.lines.filter(l => l.receivedQty !== l.expectedQty).length;
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

/**
 * When a PO was split across multiple deliveries (partial receipts),
 * returns the GRN's place in the sequence, e.g. "2nd delivery · PO-2901".
 * Null for single-delivery POs.
 */
export function deliverySequenceTag(grn: GRN): string | null {
  for (const po of grn.poNumbers) {
    const ids = MOCK_COMPLETED_DELIVERIES
      .filter(g => g.poNumbers.includes(po))
      .map(g => g.id);
    if (ids.length > 1) return `${ordinal(ids.indexOf(grn.id) + 1)} delivery · ${po}`;
  }
  return null;
}

/**
 * Close the loop on a confirmed delivery: update the source POs so a
 * partial receipt can be finished later. Lines resolved as
 * "Coming in another delivery" stay on the PO at the remaining quantity and
 * the PO flips to Partially Received — it stays in the Awaiting
 * Delivery list, ready to receive again when the second delivery
 * arrives. Everything else (fully received, substituted, accepted
 * short, credit-noted) is settled and comes off the PO.
 */
export function applyReceiptToPOs(input: {
  pos: PO[];
  lines: DeliveryCommitLine[];
  alternatives: DeliveryCommitAlternative[];
}): void {
  const byLineId = new Map(input.lines.map(l => [l.poLineId, l]));
  const substitutedLineIds = new Set(
    input.alternatives.map(a => a.originPoLineId).filter((id): id is string => !!id),
  );
  for (const po of input.pos) {
    const target = MOCK_POS.find(p => p.id === po.id);
    if (!target) continue;
    const remainingLines: POLine[] = [];
    for (const line of target.lines) {
      const rec = byLineId.get(line.id);
      // Untouched in this session — still expected on the PO.
      if (!rec) { remainingLines.push(line); continue; }
      if (substitutedLineIds.has(line.id)) continue;
      const remaining = line.expectedQty - rec.receivedQty;
      if (remaining > 0 && rec.resolution === 'Coming in another delivery') {
        remainingLines.push({ ...line, expectedQty: remaining });
      }
    }
    target.lines = remainingLines;
    target.status = remainingLines.length > 0 ? 'Partially Received' : 'Fully Received';
  }
}

export function recordCompletedDeliveryFromReceiving(input: {
  pos: PO[];
  lines: DeliveryCommitLine[];
  alternatives: DeliveryCommitAlternative[];
  extras?: DeliveryCommitExtra[];
  invoiceNumber?: string;
  receivedBy?: string;
}): GRN | null {
  if (input.pos.length === 0) return null;
  const poLineById = new Map(input.pos.flatMap(po => po.lines).map(line => [line.id, line]));
  const substitutedLineIds = new Set(input.alternatives.map(a => a.originPoLineId).filter((id): id is string => !!id));
  const supplier = input.pos[0].supplier;
  const site = input.pos[0].site;
  const dateReceived = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const normalLines: GRNLine[] = input.lines
    .filter(line => !substitutedLineIds.has(line.poLineId))
    .flatMap((line, idx): GRNLine[] => {
      const poLine = poLineById.get(line.poLineId);
      if (!poLine) return [];
      return [{
        id: `gl-runtime-${Date.now()}-${idx}`,
        poLineId: poLine.id,
        name: poLine.name,
        sku: poLine.sku,
        unit: poLine.unit,
        price: poLine.price,
        expectedQty: poLine.expectedQty,
        receivedQty: line.receivedQty,
        varianceResolution: line.resolution,
      }];
    });

  const alternativeLines: GRNLine[] = input.alternatives.map((alt, idx) => {
    const origin = alt.originPoLineId ? poLineById.get(alt.originPoLineId) : undefined;
    return {
      id: `gl-runtime-alt-${Date.now()}-${idx}`,
      poLineId: origin?.id ?? alt.id,
      name: alt.productName,
      sku: alt.supplierCode || alt.id.toUpperCase(),
      unit: alt.packType === 'Pack' ? 'PACK' : alt.singleUnitType,
      price: alt.packCost,
      expectedQty: origin?.expectedQty ?? alt.receivedQty,
      receivedQty: alt.receivedQty,
      alternativeFor: origin
        ? {
            poLineId: origin.id,
            poName: origin.name,
            poSku: origin.sku,
            poExpectedQty: origin.expectedQty,
            note: `Supplier sent alternative product; reconciled during delivery and linked to ${alt.masterName} master product.`,
          }
        : undefined,
    };
  });

  // Catalogue items added at receiving without a PO line. Expected is set
  // to the received qty — the item was verbally added to the order, so the
  // GRN should line up with the invoice rather than flag a variance.
  const extraLines: GRNLine[] = (input.extras ?? []).map((extra, idx) => ({
    id: `gl-runtime-extra-${Date.now()}-${idx}`,
    poLineId: extra.id,
    name: extra.name,
    sku: extra.sku,
    unit: extra.unit,
    price: extra.price,
    expectedQty: extra.qty,
    receivedQty: extra.qty,
    addedAtReceiving: {
      note: 'Added to the order after the PO was sent; recorded at receiving so the invoice matches.',
    },
  }));

  const currency = input.pos[0].currency;
  const grn: GRN = {
    id: `grn-runtime-${Date.now()}`,
    grnNumber: `GRN-${1252 + MOCK_COMPLETED_DELIVERIES.filter(g => g.id.startsWith('grn-runtime')).length}`,
    poNumbers: input.pos.map(po => po.poNumber),
    supplier,
    site,
    status: 'Pending Invoice',
    dateReceived,
    receivedBy: input.receivedBy ?? 'Ed Barry',
    invoiceNumber: input.invoiceNumber || undefined,
    invoiceStatus: 'Pending Invoice',
    // Foreign-currency deliveries lock the FX rate at receipt so the
    // inventory value matches the supplier's invoice.
    currency,
    lockedFxRate: currency && currency !== BASE_CURRENCY ? fxRate(currency, BASE_CURRENCY) : undefined,
    lines: [...normalLines, ...alternativeLines, ...extraLines],
  };

  MOCK_COMPLETED_DELIVERIES.push(grn);
  return grn;
}

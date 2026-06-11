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
      { id: 'gl-1', poLineId: 'pl-1', name: 'Full cream milk 2L', sku: 'FCM-2L', unit: 'EA', price: 4.20, expectedQty: 20, receivedQty: 18 },
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
];

export function poItemCount(po: PO): number {
  return po.lines.length;
}

export function poTotal(po: PO): string {
  const t = po.lines.reduce((sum, l) => sum + l.price * l.expectedQty, 0);
  return `£${t.toFixed(2)}`;
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
    lines: [...normalLines, ...alternativeLines, ...extraLines],
  };

  MOCK_COMPLETED_DELIVERIES.push(grn);
  return grn;
}

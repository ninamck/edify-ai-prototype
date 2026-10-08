// Scripted fixtures for the photo delivery capture prototype. There is no
// real OCR: each sample document carries what Edify "reads" from it and how
// each line resolves, so the flow behaves the same every demo.

export type SampleId = 'sainsburys' | 'fresh-direct' | 'menu';
export type DocKind = 'receipt' | 'invoice' | 'menu';

export interface DocLine {
  id: string;
  /** Text exactly as printed on the paper. */
  text: string;
  qty: number;
  unitPrice: number;
}

export interface SampleDocument {
  id: SampleId;
  kind: DocKind;
  /** Label in the "Try a sample" tray. */
  trayLabel: string;
  trayDetail: string;
  pages: number;
  /** Supplier Edify matches the paper to. */
  supplierName: string;
  header: {
    title: string;
    lines: string[];
  };
  docNumber?: string;
  printedDate: string;
  lines: DocLine[];
  footer: string[];
  /** Plain-words progress shown while Edify reads the photo. */
  stages: string[];
}

export const PARSE_STAGE_MS = 700;

/** Price changes at or under this are applied and listed; above it they wait for an admin. */
export const PRICE_TOLERANCE_PCT = 5;

export const RECEIVED_BY = 'Priya Shah';
export const RECEIVED_TIME = '11:04';

// ── Retail suppliers ───────────────────────────────────────────────────
// Shop-bought stock records against a supplier with ordering switched off,
// so it costs into COGS but nobody can raise a PO to it.

export interface RetailSupplier {
  id: string;
  name: string;
  allowOrdering: boolean;
  expenseAccount: string;
}

export const RETAIL_SUPPLIERS: RetailSupplier[] = [
  { id: 'sup-sainsburys', name: "Sainsbury's", allowOrdering: false, expenseAccount: 'Cost of sales: food (5010)' },
  { id: 'sup-tesco', name: 'Tesco', allowOrdering: false, expenseAccount: 'Cost of sales: food (5010)' },
  { id: 'sup-costco', name: 'Costco', allowOrdering: false, expenseAccount: 'Cost of sales: food (5010)' },
  { id: 'sup-booker', name: 'Booker', allowOrdering: true, expenseAccount: 'Cost of sales: food (5010)' },
];

// ── Sample documents ───────────────────────────────────────────────────

const SAINSBURYS_LINES: DocLine[] = [
  { id: 'r1', text: 'JS BRITISH WHOLE MILK 4PT', qty: 2, unitPrice: 1.65 },
  { id: 'r2', text: 'JS UNSALTED BUTTER 250G', qty: 2, unitPrice: 2.10 },
  { id: 'r3', text: 'LOOSE LEMONS', qty: 6, unitPrice: 0.30 },
  { id: 'r4', text: 'CARRIER BAG', qty: 1, unitPrice: 0.10 },
];

const FRESH_DIRECT_LINES: DocLine[] = [
  { id: 'f1', text: 'Baby spinach 500g', qty: 4, unitPrice: 3.50 },
  { id: 'f2', text: 'Vine tomatoes 1kg', qty: 4, unitPrice: 6.80 },
  { id: 'f3', text: 'Sourdough', qty: 20, unitPrice: 6.00 },
  { id: 'f4', text: 'Avocados', qty: 24, unitPrice: 2.10 },
  { id: 'f5', text: 'Lemons', qty: 30, unitPrice: 0.85 },
  { id: 'f6', text: 'Wild rocket 250g', qty: 5, unitPrice: 2.40 },
  { id: 'f7', text: 'Basil 30g', qty: 10, unitPrice: 1.10 },
  { id: 'f8', text: 'Mixed leaves 1kg', qty: 3, unitPrice: 6.50 },
  { id: 'f9', text: 'Red onions 5kg', qty: 2, unitPrice: 5.20 },
  { id: 'f10', text: 'Chestnut mushrooms 2.5kg', qty: 2, unitPrice: 9.00 },
  { id: 'f11', text: 'Cucumbers', qty: 14, unitPrice: 0.70 },
  { id: 'f12', text: 'Flat parsley 100g', qty: 6, unitPrice: 0.95 },
  { id: 'f13', text: 'Fresh mint 30g', qty: 4, unitPrice: 1.20 },
];

export function docTotal(doc: SampleDocument): number {
  return doc.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
}

export const SAMPLE_DOCUMENTS: Record<SampleId, SampleDocument> = {
  sainsburys: {
    id: 'sainsburys',
    kind: 'receipt',
    trayLabel: "Sainsbury's receipt",
    trayDetail: 'Milk, butter and lemons bought at lunch',
    pages: 1,
    supplierName: "Sainsbury's",
    header: {
      title: "Sainsbury's",
      lines: ['Sainsbury\u2019s Local', 'Holborn Circus, London EC1N 2HP', 'VAT No. 660 4548 36'],
    },
    printedDate: '07/10/26 11:02',
    lines: SAINSBURYS_LINES,
    footer: ['CARD  **** **** **** 4417', 'CONTACTLESS  APPROVED', 'Thank you for shopping at Sainsbury\u2019s'],
    stages: [
      'Reading the receipt',
      "Found Sainsbury's, Holborn Circus. Matched to your Sainsbury's supplier",
      '4 lines, £9.40 paid by card',
      'Matching lines to your products',
    ],
  },
  'fresh-direct': {
    id: 'fresh-direct',
    kind: 'invoice',
    trayLabel: 'Fresh Direct invoice',
    trayDetail: 'Came with the morning drop',
    pages: 2,
    supplierName: 'Fresh Direct',
    header: {
      title: 'FRESH DIRECT',
      lines: ['Fresh Direct Ltd, Unit 4 Nine Elms Market, London SW8 5BH', 'Deliver to: Fitzroy Espresso, 12 Charlotte St, W1T 2LS'],
    },
    docNumber: 'INV-5188',
    printedDate: '07/10/2026',
    lines: FRESH_DIRECT_LINES,
    footer: ['Goods remain the property of Fresh Direct Ltd until paid in full.', 'Payment terms: 30 days'],
    stages: [
      'Reading 2 pages',
      'This is an invoice from Fresh Direct, INV-5188',
      '13 lines, £328.30 before VAT',
      'Found 2 open orders from Fresh Direct',
      'Matching lines to order lines',
    ],
  },
  menu: {
    id: 'menu',
    kind: 'menu',
    trayLabel: 'Something else',
    trayDetail: 'See what happens with the wrong paper',
    pages: 1,
    supplierName: '',
    header: {
      title: 'Fitzroy Espresso',
      lines: ['Autumn menu'],
    },
    printedDate: '',
    lines: [
      { id: 'm1', text: 'Flat white', qty: 1, unitPrice: 3.40 },
      { id: 'm2', text: 'Oat cortado', qty: 1, unitPrice: 3.20 },
      { id: 'm3', text: 'Avocado sourdough toast', qty: 1, unitPrice: 8.50 },
      { id: 'm4', text: 'Spinach and feta frittata', qty: 1, unitPrice: 9.00 },
      { id: 'm5', text: 'Lemon drizzle slice', qty: 1, unitPrice: 3.80 },
    ],
    footer: ['Please tell us about any allergies before you order.'],
    stages: ['Reading the document'],
  },
};

export const WRONG_DOC_MESSAGE =
  'This looks like a menu, not a delivery note, invoice or receipt. Nothing has changed.';

// ── Receipt line plans (shop receipt, no PO) ───────────────────────────

export interface PackOption {
  id: string;
  label: string;
  /** Master product units in one item on the receipt. */
  masterQty: number;
}

export type ReceiptLinePlan =
  | {
      lineId: string;
      kind: 'supplier-product';
      productName: string;
      masterName: string;
      lastBought: string;
    }
  | {
      lineId: string;
      kind: 'master';
      suggestedName: string;
      masterId: string;
      masterName: string;
      masterUnit: string;
      masterPack: string;
      packOptions: PackOption[];
      correctPackId: string;
    }
  | {
      lineId: string;
      kind: 'new';
      suggestedName: string;
      category: string;
      unit: string;
      closest: string;
    }
  | {
      lineId: string;
      kind: 'not-stock';
      reason: string;
    };

export const RECEIPT_PLANS: ReceiptLinePlan[] = [
  {
    lineId: 'r1',
    kind: 'master',
    suggestedName: "Sainsbury's British Whole Milk 4 pints",
    masterId: 'mp-whole-milk-1l',
    masterName: 'Whole Milk 1L',
    masterUnit: 'L',
    masterPack: '1L carton',
    packOptions: [
      { id: 'p-2272', label: '2.272 L (4 pints)', masterQty: 2.272 },
      { id: 'p-2', label: '2 L', masterQty: 2 },
      { id: 'p-1', label: '1 L', masterQty: 1 },
    ],
    correctPackId: 'p-2272',
  },
  {
    lineId: 'r2',
    kind: 'supplier-product',
    productName: "Sainsbury's Unsalted Butter 250g",
    masterName: 'Unsalted butter',
    lastBought: '12 Sep',
  },
  {
    lineId: 'r3',
    kind: 'new',
    suggestedName: 'Lemons',
    category: 'Produce',
    unit: 'each',
    closest: 'Lemon juice 1L',
  },
  {
    lineId: 'r4',
    kind: 'not-stock',
    reason: 'Carrier bags are not stock. Edify leaves them out of COGS.',
  },
];

// ── Invoice line plans (supplier invoice against POs) ──────────────────

export interface AmbiguousCandidate {
  poId: string;
  poLineId: string;
  label: string;
  detail: string;
}

export type InvoiceLinePlan =
  | { lineId: string; kind: 'clean'; poId: string; poLineId: string; poPrice: number }
  | { lineId: string; kind: 'short'; poId: string; poLineId: string; ordered: number }
  | { lineId: string; kind: 'over'; poId: string; poLineId: string; ordered: number }
  | {
      lineId: string;
      kind: 'substitute';
      poId: string;
      poLineId: string;
      replacedName: string;
      replacedQty: number;
      replacedPrice: number;
      masterName: string;
      packOptions: PackOption[];
      correctPackId: string;
      masterUnitLabel: string;
    }
  | { lineId: string; kind: 'price-held'; poId: string; poLineId: string; poPrice: number }
  | { lineId: string; kind: 'extra' }
  | { lineId: string; kind: 'ambiguous'; candidates: AmbiguousCandidate[]; suggested: number };

export const INVOICE_PLANS: InvoiceLinePlan[] = [
  { lineId: 'f1', kind: 'short', poId: 'po-2', poLineId: 'pl-5', ordered: 6 },
  {
    lineId: 'f2',
    kind: 'substitute',
    poId: 'po-2',
    poLineId: 'pl-6',
    replacedName: 'Cherry tomatoes 500g',
    replacedQty: 8,
    replacedPrice: 3.50,
    masterName: 'Tomatoes',
    masterUnitLabel: '500g punnets',
    packOptions: [
      { id: 'p-1kg', label: '1 box = 1 kg (2 punnets)', masterQty: 2 },
      { id: 'p-500', label: '1 box = 500 g (1 punnet)', masterQty: 1 },
    ],
    correctPackId: 'p-1kg',
  },
  {
    lineId: 'f3',
    kind: 'ambiguous',
    candidates: [
      { poId: 'po-2', poLineId: 'pl-7', label: 'Sourdough loaves', detail: 'PO-2903 · 20 ordered at £6.00' },
      { poId: 'po-12', poLineId: 'pl-40', label: 'Sourdough rolls 6pk', detail: 'PO-2931 · 6 ordered at £4.50' },
    ],
    suggested: 0,
  },
  { lineId: 'f4', kind: 'clean', poId: 'po-2', poLineId: 'pl-8', poPrice: 2.00 },
  { lineId: 'f5', kind: 'price-held', poId: 'po-2', poLineId: 'pl-9', poPrice: 0.60 },
  { lineId: 'f6', kind: 'clean', poId: 'po-12', poLineId: 'pl-41', poPrice: 2.40 },
  { lineId: 'f7', kind: 'clean', poId: 'po-12', poLineId: 'pl-42', poPrice: 1.10 },
  { lineId: 'f8', kind: 'clean', poId: 'po-12', poLineId: 'pl-43', poPrice: 6.50 },
  { lineId: 'f9', kind: 'clean', poId: 'po-12', poLineId: 'pl-44', poPrice: 5.20 },
  { lineId: 'f10', kind: 'clean', poId: 'po-12', poLineId: 'pl-45', poPrice: 9.00 },
  { lineId: 'f11', kind: 'over', poId: 'po-12', poLineId: 'pl-46', ordered: 12 },
  { lineId: 'f12', kind: 'clean', poId: 'po-12', poLineId: 'pl-47', poPrice: 0.95 },
  { lineId: 'f13', kind: 'extra' },
];

/** Open orders from the same supplier that Edify proposes, pre-ticked. */
export const INVOICE_CANDIDATE_PO_IDS = ['po-2', 'po-12'];

/** Same-supplier POs Edify looked at and left out, with the reason. */
export const INVOICE_SKIPPED_POS = [
  { poNumber: 'PO-2926', reason: 'Already received in full on 14 Apr (GRN-1275). Left out.' },
];

export function priceChangePct(poPrice: number, invoicePrice: number): number {
  return ((invoicePrice - poPrice) / poPrice) * 100;
}

// ── Duplicate check ────────────────────────────────────────────────────
// Session-only fingerprint store: the same document read twice stops at
// "already received" instead of booking the stock again.

export interface Fingerprint {
  grnId: string;
  grnNumber: string;
  time: string;
}

const FINGERPRINTS = new Map<string, Fingerprint>();

export function fingerprintFor(sampleId: SampleId | null): string | null {
  return sampleId ? `doc:${sampleId}` : null;
}

export function findFingerprint(key: string | null): Fingerprint | undefined {
  return key ? FINGERPRINTS.get(key) : undefined;
}

export function saveFingerprint(key: string | null, fp: Fingerprint): void {
  if (key) FINGERPRINTS.set(key, fp);
}

export function clearFingerprint(key: string | null): void {
  if (key) FINGERPRINTS.delete(key);
}

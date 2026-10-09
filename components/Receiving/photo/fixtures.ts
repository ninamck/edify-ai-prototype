// Scripted fixtures for the photo delivery capture prototype. There is no
// real OCR: each sample document carries what Edify "reads" from it and how
// each line resolves, so the flow behaves the same every demo.

import { MOCK_POS } from '@/components/Receiving/mockData';

export type SampleId = 'fd-note-clean' | 'fd-note' | 'fd-invoice' | 'sainsburys' | 'menu' | 'blurry';
export type PoSampleId = 'fd-note-clean' | 'fd-note' | 'fd-invoice';
export type DocKind = 'delivery-note' | 'invoice' | 'receipt' | 'menu' | 'unreadable';

export interface DocLine {
  id: string;
  /** Text exactly as printed on the paper. */
  text: string;
  qty: number;
  /** Price on the paper. Delivery notes print none, so it holds the PO price
   *  and is only used to value stock, never to change a price. */
  unitPrice: number;
  /** Supplier code, printed on delivery notes. */
  code?: string;
}

export interface SampleDocument {
  id: SampleId;
  kind: DocKind;
  /** Label in the "Try a sample" tray. */
  trayLabel: string;
  trayDetail: string;
  pages: number;
  /** Lines printed on page 1; the rest are on page 2. */
  pageBreak?: number;
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
export const SITE = 'Fitzroy Espresso';

export function isPoDocument(id: SampleId): id is PoSampleId {
  return id === 'fd-note-clean' || id === 'fd-note' || id === 'fd-invoice';
}

export function docNoun(doc: SampleDocument): string {
  if (doc.kind === 'delivery-note') return 'delivery note';
  if (doc.kind === 'invoice') return 'invoice';
  return 'receipt';
}

export function linesOnPage(doc: SampleDocument, page: number): DocLine[] {
  if (!doc.pageBreak) return doc.lines;
  return page === 1 ? doc.lines.slice(0, doc.pageBreak) : doc.lines.slice(doc.pageBreak);
}

function poLine(poLineId: string) {
  for (const po of MOCK_POS) {
    const line = po.lines.find(l => l.id === poLineId);
    if (line) return { po, line };
  }
  throw new Error(`Unknown PO line ${poLineId}`);
}

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

// ── Line plans for documents against POs ───────────────────────────────

export interface PackOption {
  id: string;
  label: string;
  /** Master product units in one item on the paper. */
  masterQty: number;
}

export interface AmbiguousCandidate {
  poId: string;
  poLineId: string;
  label: string;
  detail: string;
}

/** Where a substitute goes, in the order Edify tries them. */
export interface SubOption {
  id: string;
  kind: 'supplier-product' | 'under-master' | 'new-master';
  label: string;
  detail: string;
  /** The master product the received line ends up under. */
  masterName: string;
}

export interface SubstitutePlan {
  lineId: string;
  kind: 'substitute';
  poId: string;
  poLineId: string;
  replacedName: string;
  replacedQty: number;
  replacedPrice: number;
  /** What the order counts in, e.g. "cartons". */
  replacedUnit: string;
  /** What the paper counts in, e.g. "cases". */
  deliveredUnit: string;
  masterName: string;
  masterUnitLabel: string;
  options: SubOption[];
  suggestedOption: string;
  packQuestion: string;
  packOptions: PackOption[];
  correctPackId: string;
  /** The pack size the supplier catalogue gives, shown as a hint, never pre-picked. */
  catalogPackId?: string;
  allergenNote: string;
  /** The delivered product's name, without the supplier's "SUB" marker. */
  productName: string;
  newSku: string;
  grnUnit: string;
  singleUnitType: 'Each' | 'kg' | 'L' | 'g' | 'ml';
}

export type PoLinePlan =
  | { lineId: string; kind: 'clean'; poId: string; poLineId: string; poPrice: number }
  | { lineId: string; kind: 'short'; poId: string; poLineId: string; ordered: number; received: number; reported?: boolean }
  | { lineId: string; kind: 'damaged'; poId: string; poLineId: string; delivered: number; damaged: number }
  | { lineId: string; kind: 'over'; poId: string; poLineId: string; ordered: number }
  | SubstitutePlan
  | { lineId: string; kind: 'price-held'; poId: string; poLineId: string; poPrice: number }
  | { lineId: string; kind: 'extra' }
  | { lineId: string; kind: 'ambiguous'; candidates: AmbiguousCandidate[]; suggested: number };

export interface PoDocument {
  plans: PoLinePlan[];
  candidatePoIds: string[];
  /** Other open orders from the same supplier that explain none of the lines.
   *  Listed unticked on Which orders so the GM can see they were considered. */
  otherPoIds?: string[];
  /** Same-supplier POs Edify looked at and left out, with the reason. */
  skippedPos: { poNumber: string; reason: string }[];
  /** False when every line points at exactly one order, so Edify picks the orders itself. */
  askWhichOrders: boolean;
}

// ── Fresh Direct delivery note, 40 lines over two orders ───────────────
// [code, printed text, qty delivered, PO line]

const FD_NOTE_ROWS: [string, string, number, string][] = [
  ['FD-WM2', 'Whole Milk 2Ltr', 24, 'pl-50'],
  ['FD-SS2', 'Semi Skimmed Milk 2Ltr', 12, 'pl-51'],
  ['FD-MFO8', 'Minor Figures Oat Barista 8x1L  SUB', 3, 'pl-52'],
  ['FD-DC1', 'Double Cream 1Ltr', 6, 'pl-53'],
  ['FD-GY1', 'Greek Style Yoghurt 1kg', 6, 'pl-54'],
  ['FD-EGG30', 'Free Range Eggs Tray 30', 8, 'pl-55'],
  ['FD-UB250', 'Unsalted Butter 250g', 20, 'pl-56'],
  ['FD-FETA', 'Feta Block 900g', 3, 'pl-57'],
  ['FD-HAL', 'Halloumi 1kg', 4, 'pl-58'],
  ['FD-CHD', 'Mature Cheddar 2.5kg', 2, 'pl-59'],
  ['FD-AVO20', 'Avocado Hass x20', 2, 'pl-60'],
  ['FD-LEM', 'Lemons Unwaxed', 24, 'pl-61'],
  ['FD-LIM', 'Limes', 20, 'pl-62'],
  ['FD-BS500', 'Baby Spinach 500g', 6, 'pl-63'],
  ['FD-WR250', 'Wild Rocket 250g', 6, 'pl-64'],
  ['FD-VT1', 'Vine Tomatoes 1kg', 6, 'pl-65'],
  ['FD-CT500', 'Cherry Tomatoes 500g', 8, 'pl-66'],
  ['FD-RO5', 'Red Onions 5kg', 2, 'pl-67'],
  ['FD-GAR1', 'Garlic Peeled 1kg', 1, 'pl-68'],
  ['FD-CM25', 'Chestnut Mushrooms 2.5kg', 2, 'pl-69'],
  ['FD-CUC', 'Cucumber', 10, 'pl-70'],
  ['FD-BAS100', 'Basil 100g', 2, 'pl-71'],
  ['FD-FP100', 'Flat Leaf Parsley 100g', 6, 'pl-72'],
  ['FD-MNT100', 'Mint 100g', 3, 'pl-73'],
  ['FD-BAN', 'Bananas (kg)', 6, 'pl-74'],
  ['FD-STR2', 'Strawberries 2kg Tray', 2, 'pl-75'],
  ['FD-BLU', 'Blueberries 12x125g', 1, 'pl-76'],
  ['FD-OJ10', 'Juicing Oranges 10kg', 2, 'pl-77'],
  ['FD-SD800', 'Sourdough Loaf 800g', 10, 'pl-80'],
  ['FD-BB12', 'Brioche Buns 12pk', 4, 'pl-81'],
  ['FD-CRO50', 'Croissant Frozen x50', 1, 'pl-82'],
  ['FD-PAC50', 'Pain au Chocolat Frozen x50', 1, 'pl-83'],
  ['FD-SAL1', 'Smoked Salmon Sliced 1kg', 1, 'pl-84'],
  ['FD-BAC2', 'Streaky Bacon 2kg', 2, 'pl-85'],
  ['FD-SAU2', 'Pork Sausages 2kg', 2, 'pl-86'],
  ['FD-HUM1', 'Houmous 1kg', 2, 'pl-87'],
  ['FD-GRA2', 'Granola 2kg', 1, 'pl-88'],
  ['FD-MAP1', 'Maple Syrup 1Ltr', 1, 'pl-89'],
  ['FD-HON3', 'Honey 3kg', 1, 'pl-90'],
  ['FD-SPW24', 'Sparkling Water 330ml x24', 3, 'pl-91'],
];

const FD_CLEAN_ROWS: [string, string, number, string][] = [
  ['FD-WM2', 'Whole Milk 2Ltr', 18, 'pl-100'],
  ['FD-SS2', 'Semi Skimmed Milk 2Ltr', 8, 'pl-101'],
  ['FD-OAT1', 'Oatly Barista 1L', 24, 'pl-102'],
  ['FD-DC1', 'Double Cream 1Ltr', 4, 'pl-103'],
  ['FD-UB250', 'Unsalted Butter 250g', 12, 'pl-104'],
  ['FD-EGG30', 'Free Range Eggs Tray 30', 6, 'pl-105'],
  ['FD-GY1', 'Greek Style Yoghurt 1kg', 4, 'pl-106'],
  ['FD-CHD', 'Mature Cheddar 2.5kg', 1, 'pl-107'],
  ['FD-AVO20', 'Avocado Hass x20', 2, 'pl-108'],
  ['FD-LEM', 'Lemons Unwaxed', 20, 'pl-109'],
  ['FD-BS500', 'Baby Spinach 500g', 4, 'pl-110'],
  ['FD-SD800', 'Sourdough Loaf 800g', 8, 'pl-111'],
];

function noteLines(prefix: string, rows: [string, string, number, string][]): DocLine[] {
  return rows.map(([code, text, qty, poLineId], i) => ({
    id: `${prefix}${i + 1}`,
    code,
    text,
    qty,
    unitPrice: poLine(poLineId).line.price,
  }));
}

function cleanPlans(prefix: string, rows: [string, string, number, string][]): PoLinePlan[] {
  return rows.map(([, , , poLineId], i): PoLinePlan => {
    const { po, line } = poLine(poLineId);
    return { lineId: `${prefix}${i + 1}`, kind: 'clean', poId: po.id, poLineId, poPrice: line.price };
  });
}

const OAT_SUBSTITUTE: SubstitutePlan = {
  lineId: 'n3',
  kind: 'substitute',
  poId: 'po-13',
  poLineId: 'pl-52',
  replacedName: 'Oatly Barista 1L',
  replacedQty: 24,
  replacedPrice: 1.95,
  replacedUnit: 'cartons',
  deliveredUnit: 'cases',
  masterName: 'Oat milk',
  masterUnitLabel: 'cartons',
  options: [
    {
      id: 'mf-catalogue',
      kind: 'supplier-product',
      label: 'Minor Figures Oat Barista 8x1L',
      detail: "Already in Fresh Direct's catalogue in Edify, under your Oat milk master product.",
      masterName: 'Oat milk',
    },
    {
      id: 'mf-new',
      kind: 'under-master',
      label: 'New Fresh Direct product under Oat milk',
      detail: "If the catalogue product isn't the same thing.",
      masterName: 'Oat milk',
    },
    {
      id: 'mf-master',
      kind: 'new-master',
      label: 'New master product: Minor Figures oat milk',
      detail: "Only if it shouldn't count with your Oat milk.",
      masterName: 'Minor Figures oat milk',
    },
  ],
  suggestedOption: 'mf-catalogue',
  packQuestion: 'How many cartons in one case?',
  packOptions: [
    { id: 'p-6', label: '6 cartons', masterQty: 6 },
    { id: 'p-8', label: '8 cartons', masterQty: 8 },
    { id: 'p-12', label: '12 cartons', masterQty: 12 },
  ],
  correctPackId: 'p-8',
  catalogPackId: 'p-8',
  allergenNote: "Allergens from Fresh Direct's catalogue: cereals containing gluten (oats). Same as Oatly Barista, so no recipe's allergens change.",
  productName: 'Minor Figures Oat Barista 8x1L',
  newSku: 'FD-MFO8',
  grnUnit: 'CASE',
  singleUnitType: 'L',
};

const FD_NOTE_PLANS: PoLinePlan[] = cleanPlans('n', FD_NOTE_ROWS).map(p => {
  if (p.lineId === 'n3') return OAT_SUBSTITUTE;
  if (p.kind !== 'clean') return p;
  if (p.lineId === 'n12') return { lineId: p.lineId, kind: 'short', poId: p.poId, poLineId: p.poLineId, ordered: 30, received: 24 };
  if (p.lineId === 'n22') return { lineId: p.lineId, kind: 'short', poId: p.poId, poLineId: p.poLineId, ordered: 4, received: 2 };
  return p;
});

// ── Fresh Direct invoice, 2 pages, against PO-2903 and PO-2931 ─────────

const FRESH_DIRECT_INVOICE_LINES: DocLine[] = [
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

const TOMATO_SUBSTITUTE: SubstitutePlan = {
  lineId: 'f2',
  kind: 'substitute',
  poId: 'po-2',
  poLineId: 'pl-6',
  replacedName: 'Cherry tomatoes 500g',
  replacedQty: 8,
  replacedPrice: 3.50,
  replacedUnit: 'punnets',
  deliveredUnit: 'boxes',
  masterName: 'Tomatoes',
  masterUnitLabel: '500g punnets',
  options: [
    {
      id: 'tom-master',
      kind: 'under-master',
      label: 'New Fresh Direct product under Tomatoes',
      detail: 'The same master product as the cherry tomatoes you ordered. Used in 4 recipes, so their costs follow.',
      masterName: 'Tomatoes',
    },
    {
      id: 'tom-salad',
      kind: 'under-master',
      label: 'New Fresh Direct product under Salad tomatoes',
      detail: 'Another master product you use, in 1 recipe.',
      masterName: 'Salad tomatoes',
    },
    {
      id: 'tom-new',
      kind: 'new-master',
      label: 'New master product: Vine tomatoes',
      detail: "Only if it shouldn't count with any tomatoes you already have.",
      masterName: 'Vine tomatoes',
    },
  ],
  suggestedOption: 'tom-master',
  packQuestion: 'How big is one box?',
  packOptions: [
    { id: 'p-1kg', label: '1 kg (2 punnets)', masterQty: 2 },
    { id: 'p-500', label: '500 g (1 punnet)', masterQty: 1 },
  ],
  correctPackId: 'p-1kg',
  allergenNote: "No allergens in Fresh Direct's catalogue, the same as the cherry tomatoes. No recipe's allergens change.",
  productName: 'Vine tomatoes 1kg',
  newSku: 'VT-1KG',
  grnUnit: 'BOX',
  singleUnitType: 'kg',
};

const FD_INVOICE_PLANS: PoLinePlan[] = [
  { lineId: 'f1', kind: 'short', poId: 'po-2', poLineId: 'pl-5', ordered: 6, received: 4 },
  TOMATO_SUBSTITUTE,
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

export const PO_DOCUMENTS: Record<PoSampleId, PoDocument> = {
  'fd-note-clean': {
    plans: cleanPlans('c', FD_CLEAN_ROWS),
    candidatePoIds: ['po-15'],
    otherPoIds: ['po-13', 'po-14'],
    skippedPos: [],
    askWhichOrders: false,
  },
  'fd-note': {
    plans: FD_NOTE_PLANS,
    candidatePoIds: ['po-13', 'po-14'],
    skippedPos: [],
    askWhichOrders: false,
  },
  'fd-invoice': {
    plans: FD_INVOICE_PLANS,
    candidatePoIds: ['po-2', 'po-12'],
    skippedPos: [{ poNumber: 'PO-2926', reason: 'Already received in full on 14 Apr (GRN-1275). Left out.' }],
    askWhichOrders: true,
  },
};

// ── Sample documents ───────────────────────────────────────────────────

const SAINSBURYS_LINES: DocLine[] = [
  { id: 'r1', text: 'JS BRITISH WHOLE MILK 4PT', qty: 2, unitPrice: 1.65 },
  { id: 'r2', text: 'JS UNSALTED BUTTER 250G', qty: 2, unitPrice: 2.10 },
  { id: 'r3', text: 'LOOSE LEMONS', qty: 6, unitPrice: 0.30 },
  { id: 'r4', text: 'CARRIER BAG', qty: 1, unitPrice: 0.10 },
];

export function docTotal(doc: SampleDocument): number {
  return doc.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
}

const FD_HEADER_LINES = [
  'Fresh Direct Ltd, Unit 4 Nine Elms Market, London SW8 5BH',
  'Deliver to: Fitzroy Espresso, 12 Charlotte St, W1T 2LS',
];

export const SAMPLE_DOCUMENTS: Record<SampleId, SampleDocument> = {
  'fd-note-clean': {
    id: 'fd-note-clean',
    kind: 'delivery-note',
    trayLabel: 'Delivery note, all as ordered',
    trayDetail: 'Fresh Direct dairy drop, 12 lines',
    pages: 1,
    supplierName: 'Fresh Direct',
    header: { title: 'FRESH DIRECT', lines: [...FD_HEADER_LINES, 'Your order: PO-2950'] },
    docNumber: 'DN-88301',
    printedDate: '08/04/2026',
    lines: noteLines('c', FD_CLEAN_ROWS),
    footer: ['Received in good condition by:', 'Please check goods on delivery. Shortages must be noted on this delivery note.'],
    stages: [
      'Reading the delivery note',
      'Fresh Direct, delivery note DN-88301, 12 lines',
      'Found PO-2950',
      'Matching lines to order lines',
    ],
  },
  'fd-note': {
    id: 'fd-note',
    kind: 'delivery-note',
    trayLabel: 'Delivery note, 40 lines',
    trayDetail: 'Fresh Direct, two orders, a few things off',
    pages: 2,
    pageBreak: 22,
    supplierName: 'Fresh Direct',
    header: { title: 'FRESH DIRECT', lines: [...FD_HEADER_LINES, 'Your orders: PO-2940, PO-2944'] },
    docNumber: 'DN-88214',
    printedDate: '08/04/2026',
    lines: noteLines('n', FD_NOTE_ROWS),
    footer: ['Received in good condition by:', 'Please check goods on delivery. Shortages must be noted on this delivery note.'],
    stages: [
      'Reading 2 pages',
      'This is a delivery note from Fresh Direct, DN-88214',
      '40 lines. Delivery notes have no prices, so prices stay as ordered',
      'Found PO-2940 and PO-2944. Every line belongs to one of them',
      'Matching lines to order lines',
    ],
  },
  'fd-invoice': {
    id: 'fd-invoice',
    kind: 'invoice',
    trayLabel: 'Invoice with price changes',
    trayDetail: 'Fresh Direct, came with the morning drop',
    pages: 2,
    pageBreak: 7,
    supplierName: 'Fresh Direct',
    header: { title: 'FRESH DIRECT', lines: FD_HEADER_LINES },
    docNumber: 'INV-5188',
    printedDate: '07/04/2026',
    lines: FRESH_DIRECT_INVOICE_LINES,
    footer: ['Goods remain the property of Fresh Direct Ltd until paid in full.', 'Payment terms: 30 days'],
    stages: [
      'Reading 2 pages',
      'This is an invoice from Fresh Direct, INV-5188',
      '13 lines, £328.30 before VAT',
      'Found 2 open orders from Fresh Direct',
      'Matching lines to order lines',
    ],
  },
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
  menu: {
    id: 'menu',
    kind: 'menu',
    trayLabel: 'Wrong paper',
    trayDetail: 'A menu, to see what happens',
    pages: 1,
    supplierName: '',
    header: { title: 'Fitzroy Espresso', lines: ['Autumn menu'] },
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
  blurry: {
    id: 'blurry',
    kind: 'unreadable',
    trayLabel: 'Blurry photo',
    trayDetail: 'Too much glare to read',
    pages: 1,
    supplierName: '',
    header: { title: '', lines: [] },
    printedDate: '',
    lines: [],
    footer: [],
    stages: ['Reading the photo'],
  },
};

export const WRONG_DOC_MESSAGE =
  'This looks like a menu, not a delivery note, invoice or receipt. Nothing has changed.';

export const UNREADABLE_MESSAGE =
  "Edify couldn't read this photo. Try again with the whole page in frame, flat, and out of direct light. Nothing has changed.";

// ── Receipt line plans (shop receipt, no PO) ───────────────────────────

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

import type { PO, POLine } from '../mockData';

// The paper behind each demo scenario, and what Edify reads off it. There is
// no real extraction in the prototype: each sample *is* the extraction and
// line-match result, and the matching PO is built from the same lines so the
// two can never disagree.

export type DocKind = 'delivery-note' | 'invoice' | 'receipt' | 'menu';

export type SampleId =
  | 'clean'
  | 'short-sub'
  | 'damaged'
  | 'new-price'
  | 'receipt'
  | 'two-pos'
  | 'blurry'
  | 'menu'
  | 'duplicate';

export type SeedIssue =
  /** The supplier sent something else in place of the ordered product. */
  | {
      kind: 'substitute';
      sentName: string;
      sentCode: string;
      sentPack: string;
      sentPrice?: number;
      /** Master product Edify proposes to put the sent product under. */
      master: string;
      inCatalogue: boolean;
    }
  /** On the paper but on no order. */
  | { kind: 'extra'; inCatalogue: boolean }
  /** The same product is on more than one of the orders this paper covers. */
  | { kind: 'which-po'; options: { poNumber: string; ordered: number; label: string }[] }
  /** A receipt line Edify can't link to any product. */
  | { kind: 'new-product' };

export type UnitType = 'Each' | 'g' | 'kg' | 'ml' | 'L';

/** What Edify reads off the paper to set a product up in the catalogue. */
export interface ProductSeed {
  name: string;
  code?: string;
  packType: 'Single' | 'Pack';
  /** Items in a pack. 1 for a single item. */
  packQty: number;
  /** Size of one item, in unitType. 1 for "Each". */
  unitSize: number;
  unitType: UnitType;
  /** Price of one pack (or one single item), ex VAT. */
  packCost: number;
  vatRate: number;
  /** The master product it sits under, so recipes can use it. */
  master: string;
  masterIsNew: boolean;
}

export interface SupplierSeed {
  name: string;
  branch: string;
  vatNumber?: string;
}

export interface SeedLine {
  id: string;
  /** Edify's name for the line. For a substitute, the product that was ordered. */
  name: string;
  /** As printed on the paper. */
  printed: string;
  code?: string;
  pack: string;
  /** Null when the line isn't on any order (extras, receipts). */
  ordered: number | null;
  /** As read off the paper. */
  got: number;
  /** Quantity the invoice charges for, when the driver corrected it by hand. */
  billed?: number;
  /** What Edify noticed on the paper, in plain words. */
  note?: string;
  /** Unit price on the paper. Delivery notes have none. */
  price?: number;
  /** Unit price on the PO. */
  orderPrice?: number;
  /** Defaults to the sample's first PO. */
  poNumber?: string;
  vatRate?: number;
  /** Receipt line: the master product it links to. */
  links?: string;
  issue?: SeedIssue;
  /** Printed beside the quantity on a delivery note, e.g. "SUB". */
  mark?: string;
  page?: number;
  /** Set when the product on the paper isn't in the catalogue yet. */
  setup?: ProductSeed;
}

export interface PaperStyle {
  brand: string;
  colour: string;
  address: string[];
  footer: string[];
}

export interface Sample {
  id: SampleId;
  /** Demo picker label. */
  label: string;
  /** What to try, for whoever is demoing. */
  hint?: string;
  kind: DocKind;
  supplier: string;
  supplierInEdify: boolean;
  /** Read off the paper when the supplier isn't in Edify yet. */
  supplierSeed?: SupplierSeed;
  docNumber?: string;
  printedDate: string;
  site: string;
  poNumbers: string[];
  pages: number;
  paper: PaperStyle;
  lines: SeedLine[];
  blocked?: 'unreadable' | 'wrong-document' | 'duplicate';
  /** Reuse another sample's photo. */
  photoOf?: SampleId;
  duplicateOf?: { grnNumber: string; time: string };
}

const SITE = 'Fitzroy Espresso';
const DELIVER_TO = 'Deliver to: Fitzroy Espresso, 12 Charlotte St, W1T 2LS';

const clean: Sample = {
  id: 'clean',
  label: 'Clean delivery',
  hint: 'Everything matches: one tap to accept.',
  kind: 'delivery-note',
  supplier: 'Fresh Direct',
  supplierInEdify: true,
  docNumber: 'DN-40311',
  printedDate: '16/10/2026',
  site: SITE,
  poNumbers: ['PO-10476'],
  pages: 1,
  paper: {
    brand: 'FRESH DIRECT',
    colour: '#2f6b2f',
    address: ['Fresh Direct Ltd, Unit 4 Nine Elms Market, London SW8 5BH', DELIVER_TO, 'Your order: PO-10476'],
    footer: ['Received by:', 'Goods remain the property of Fresh Direct Ltd until paid in full.'],
  },
  lines: [
    { id: 'bs', code: 'FD-BS500', printed: 'Baby Spinach 500g', name: 'Baby spinach 500g', pack: '500g bag', ordered: 6, got: 6, orderPrice: 3.5 },
    { id: 'wr', code: 'FD-WR250', printed: 'Wild Rocket 250g', name: 'Wild rocket 250g', pack: '250g bag', ordered: 4, got: 4, orderPrice: 2.4 },
    { id: 'vt', code: 'FD-VT1', printed: 'Vine Tomatoes 1kg', name: 'Vine tomatoes 1kg', pack: '1kg', ordered: 6, got: 6, orderPrice: 3.9 },
    { id: 'ct', code: 'FD-CT500', printed: 'Cherry Tomatoes 500g', name: 'Cherry tomatoes 500g', pack: '500g punnet', ordered: 8, got: 8, orderPrice: 3.5 },
    { id: 'av', code: 'FD-AVO', printed: 'Avocado Hass Each', name: 'Avocados', pack: 'Each', ordered: 20, got: 20, orderPrice: 0.95 },
    { id: 'le', code: 'FD-LEM', printed: 'Lemons Unwaxed', name: 'Lemons', pack: 'Each', ordered: 30, got: 30, orderPrice: 0.3 },
    { id: 'li', code: 'FD-LIM', printed: 'Limes', name: 'Limes', pack: 'Each', ordered: 20, got: 20, orderPrice: 0.25 },
    { id: 'cu', code: 'FD-CUC', printed: 'Cucumber', name: 'Cucumber', pack: 'Each', ordered: 10, got: 10, orderPrice: 0.7 },
  ],
};

const shortSub: Sample = {
  id: 'short-sub',
  label: 'Short and a substitute',
  hint: 'Milk is 2 short, and Alpro came instead of Oatly.',
  kind: 'invoice',
  supplier: 'Northfield Foods',
  supplierInEdify: true,
  docNumber: 'INV-88214',
  printedDate: '16/10/2026',
  site: SITE,
  poNumbers: ['PO-10482'],
  pages: 1,
  paper: {
    brand: 'NORTHFIELD FOODS',
    colour: '#1f4e79',
    address: ['Northfield Foods Ltd, 88 Wharf Road, London N1 7GR', 'VAT reg. GB 284 1937 22', DELIVER_TO, 'Order ref: PO-10482'],
    footer: ['Payment terms: 30 days.', 'Bank: Northfield Foods Ltd 20-45-77 81234567'],
  },
  lines: [
    {
      id: 'wm',
      code: 'NF-WM2',
      printed: 'Whole Milk 2L',
      name: 'Whole milk 2L',
      pack: '2L bottle',
      ordered: 12,
      got: 10,
      billed: 12,
      note: 'The driver changed 12 to 10 by hand.',
      price: 1.9,
      orderPrice: 1.9,
    },
    {
      id: 'ob',
      code: 'NF-OB1',
      printed: 'Alpro Barista Oat 1L (sub)',
      name: 'Oatly Barista 1L',
      pack: '1L carton',
      ordered: 6,
      got: 6,
      price: 1.79,
      orderPrice: 1.95,
      issue: { kind: 'substitute', sentName: 'Alpro Barista Oat 1L', sentCode: 'NF-AB1', sentPack: '1L carton', sentPrice: 1.79, master: 'Oat milk', inCatalogue: false },
      setup: { name: 'Alpro Barista Oat 1L', code: 'NF-AB1', packType: 'Single', packQty: 1, unitSize: 1, unitType: 'L', packCost: 1.79, vatRate: 0, master: 'Oat milk', masterIsNew: false },
    },
    { id: 'sd', code: 'NF-SD8', printed: 'Sourdough Loaf 800g', name: 'Sourdough loaf', pack: '800g loaf', ordered: 8, got: 8, price: 3.2, orderPrice: 3.2 },
    { id: 'eg', code: 'NF-EGG30', printed: 'Free Range Eggs x30', name: 'Free-range eggs x30', pack: 'Tray of 30', ordered: 4, got: 4, price: 7.5, orderPrice: 7.5 },
    { id: 'bu', code: 'NF-BU250', printed: 'Butter Unsalted 250g', name: 'Butter unsalted 250g', pack: '250g block', ordered: 10, got: 10, price: 2.35, orderPrice: 2.35 },
    { id: 'ch', code: 'NF-CH2', printed: 'Mature Cheddar 2kg', name: 'Mature cheddar 2kg', pack: '2kg block', ordered: 2, got: 2, price: 14.8, orderPrice: 14.8 },
    { id: 'hm', code: 'NF-HAM1', printed: 'Ham Sliced 1kg', name: 'Ham, sliced 1kg', pack: '1kg pack', ordered: 3, got: 3, price: 11.2, orderPrice: 11.2 },
    { id: 'ro', code: 'NF-ROC5', printed: 'Rocket 500g', name: 'Rocket 500g', pack: '500g bag', ordered: 4, got: 4, price: 3.6, orderPrice: 3.6 },
    { id: 'vt', code: 'NF-VT5', printed: 'Vine Tomatoes 5kg', name: 'Vine tomatoes 5kg', pack: '5kg box', ordered: 1, got: 1, price: 12.5, orderPrice: 12.5 },
    { id: 'av', code: 'NF-AVO22', printed: 'Avocados x22', name: 'Avocados x22', pack: 'Box of 22', ordered: 1, got: 1, price: 19.8, orderPrice: 19.8 },
    { id: 'cr', code: 'NF-CR60', printed: 'Croissant Frozen x60', name: 'Croissant, frozen x60', pack: 'Box of 60', ordered: 2, got: 2, price: 27, orderPrice: 27 },
    { id: 'sp', code: 'NF-SP1', printed: 'Baby Spinach 1kg', name: 'Baby spinach 1kg', pack: '1kg bag', ordered: 3, got: 3, price: 5.4, orderPrice: 5.4 },
    { id: 'cb', code: 'NF-CB1', printed: 'Coffee Beans 1kg', name: 'Coffee beans 1kg', pack: '1kg bag', ordered: 6, got: 6, price: 16.5, orderPrice: 16.5 },
    { id: 'cp', code: 'NF-CUP12', printed: 'Cups 12oz x1000', name: 'Cups 12oz x1000', pack: 'Case of 1000', ordered: 1, got: 1, price: 48, orderPrice: 48, vatRate: 20 },
  ],
};

const damaged: Sample = {
  id: 'damaged',
  label: 'Damaged at the door',
  hint: 'Two packs of eggs are smashed. Tap the eggs, or type "2 eggs broken".',
  kind: 'delivery-note',
  supplier: 'Bidfood',
  supplierInEdify: true,
  docNumber: 'DN-77120',
  printedDate: '16/10/2026',
  site: SITE,
  poNumbers: ['PO-10485'],
  pages: 1,
  paper: {
    brand: 'BIDFOOD',
    colour: '#c8102e',
    address: ['Bidfood UK, Park Royal Depot, London NW10 7NX', DELIVER_TO, 'Your order: PO-10485'],
    footer: ['Signed for by:', 'Check goods on arrival. Report damages to your account manager within 24 hours.'],
  },
  lines: [
    { id: 'fm', code: 'BF-FCM2', printed: 'Full Cream Milk 2L', name: 'Full cream milk 2L', pack: '2L bottle', ordered: 20, got: 20, orderPrice: 4.2 },
    { id: 'dc', code: 'BF-DC1', printed: 'Double Cream 1L', name: 'Double cream 1L', pack: '1L carton', ordered: 8, got: 8, orderPrice: 8 },
    { id: 'eg', code: 'BF-FRE15', printed: 'Free Range Eggs 15pk', name: 'Free-range eggs 15pk', pack: 'Pack of 15', ordered: 12, got: 12, orderPrice: 8 },
    { id: 'ub', code: 'BF-UB500', printed: 'Unsalted Butter 500g', name: 'Unsalted butter 500g', pack: '500g block', ordered: 6, got: 6, orderPrice: 6.5 },
    { id: 'gy', code: 'BF-GY1', printed: 'Greek Style Yoghurt 1kg', name: 'Greek yoghurt 1kg', pack: '1kg tub', ordered: 6, got: 6, orderPrice: 3.8 },
    { id: 'fl', code: 'BF-FLR10', printed: 'Plain Flour 10kg', name: 'Plain flour 10kg', pack: '10kg sack', ordered: 2, got: 2, orderPrice: 18 },
    { id: 'su', code: 'BF-SUG5', printed: 'Caster Sugar 5kg', name: 'Caster sugar 5kg', pack: '5kg bag', ordered: 2, got: 2, orderPrice: 6.2 },
    { id: 'eb', code: 'BF-EB1', printed: 'Espresso Blend 1kg', name: 'Espresso blend 1kg', pack: '1kg bag', ordered: 6, got: 6, orderPrice: 18 },
    { id: 'om', code: 'BF-OM1', printed: 'Oat Milk 1L', name: 'Oat milk 1L', pack: '1L carton', ordered: 24, got: 24, orderPrice: 2 },
    { id: 'tc', code: 'BF-TC12', printed: 'Takeaway Cups 12oz', name: 'Takeaway cups 12oz', pack: 'Case of 1000', ordered: 1, got: 1, orderPrice: 28 },
  ],
};

const newPrice: Sample = {
  id: 'new-price',
  label: 'New product and a price change',
  hint: 'Burrata came that isn\u2019t on the order, and mozzarella went up.',
  kind: 'invoice',
  supplier: 'La Latteria',
  supplierInEdify: true,
  docNumber: 'INV-LL-3307',
  printedDate: '16/10/2026',
  site: SITE,
  poNumbers: ['PO-10487'],
  pages: 1,
  paper: {
    brand: 'La Latteria',
    colour: '#7a1f2b',
    address: ['La Latteria Ltd, Arch 41, Druid Street, London SE1 2HH', 'VAT reg. GB 301 5521 08', DELIVER_TO, 'Your PO: PO-10487'],
    footer: ['Payment due within 14 days.', 'Grazie!'],
  },
  lines: [
    { id: 'mz', code: 'LL-MOZ1', printed: 'Mozzarella Fior di Latte 1kg', name: 'Mozzarella 1kg', pack: '1kg bag', ordered: 4, got: 4, price: 8.4, orderPrice: 7.9 },
    { id: 'rc', code: 'LL-RIC15', printed: 'Ricotta 1.5kg', name: 'Ricotta 1.5kg', pack: '1.5kg tub', ordered: 2, got: 2, price: 6.9, orderPrice: 6.9 },
    { id: 'ms', code: 'LL-MAS5', printed: 'Mascarpone 500g', name: 'Mascarpone 500g', pack: '500g tub', ordered: 3, got: 3, price: 3.8, orderPrice: 3.8 },
    { id: 'pr', code: 'LL-PAR1', printed: 'Parmigiano Reggiano 1kg', name: 'Parmesan 1kg', pack: '1kg wedge', ordered: 1, got: 1, price: 18.5, orderPrice: 18.5 },
    { id: 'st', code: 'LL-STR25', printed: 'Stracciatella 250g', name: 'Stracciatella 250g', pack: '250g tub', ordered: 4, got: 4, price: 4.2, orderPrice: 4.2 },
    {
      id: 'br',
      code: 'LL-BUR6',
      printed: 'Burrata 125g x6',
      name: 'Burrata 125g x6',
      pack: 'Pack of 6 x 125g',
      ordered: null,
      got: 2,
      price: 9.6,
      issue: { kind: 'extra', inCatalogue: false },
      setup: { name: 'Burrata 125g x6', code: 'LL-BUR6', packType: 'Pack', packQty: 6, unitSize: 125, unitType: 'g', packCost: 9.6, vatRate: 0, master: 'Burrata', masterIsNew: true },
    },
  ],
};

const receipt: Sample = {
  id: 'receipt',
  label: 'Sainsbury\u2019s receipt',
  hint: 'A run to the shop. Sainsbury\u2019s and the mint are new to Edify.',
  kind: 'receipt',
  supplier: 'Sainsbury\u2019s',
  supplierInEdify: false,
  supplierSeed: { name: 'Sainsbury\u2019s', branch: 'Sainsbury\u2019s Local, Goodge Street, London W1T 4NE', vatNumber: '660 4548 36' },
  printedDate: '16/10/26 11:02',
  site: SITE,
  poNumbers: [],
  pages: 1,
  paper: {
    brand: 'Sainsbury\u2019s',
    colour: '#e35205',
    address: ['Sainsbury\u2019s Local', 'Goodge Street, London W1T 4NE', 'VAT No. 660 4548 36'],
    footer: ['CARD **** **** **** 4417', 'CONTACTLESS APPROVED', 'Thank you for shopping at Sainsbury\u2019s'],
  },
  lines: [
    { id: 'mk', printed: 'JS BRITISH WHOLE MILK 4PT', name: 'Whole milk 4 pints', pack: '4 pint bottle', ordered: null, got: 2, price: 1.65, links: 'Whole milk' },
    { id: 'bt', printed: 'JS UNSALTED BUTTER 250G', name: 'Unsalted butter 250g', pack: '250g block', ordered: null, got: 2, price: 2.1, links: 'Unsalted butter' },
    {
      id: 'mt',
      printed: 'FRESH MINT 30G',
      name: 'Fresh mint 30g',
      pack: '30g pack',
      ordered: null,
      got: 1,
      price: 0.85,
      issue: { kind: 'new-product' },
      setup: { name: 'Fresh mint 30g', packType: 'Single', packQty: 1, unitSize: 30, unitType: 'g', packCost: 0.85, vatRate: 0, master: 'Fresh mint', masterIsNew: true },
    },
  ],
};

const twoPos: Sample = {
  id: 'two-pos',
  label: 'Two orders, one delivery',
  hint: 'Your weekly order and a top-up came together, over two pages.',
  kind: 'delivery-note',
  supplier: 'Bidfood',
  supplierInEdify: true,
  docNumber: 'DN-77188',
  printedDate: '16/10/2026',
  site: SITE,
  poNumbers: ['PO-10490', 'PO-10491'],
  pages: 2,
  paper: {
    brand: 'BIDFOOD',
    colour: '#c8102e',
    address: ['Bidfood UK, Park Royal Depot, London NW10 7NX', DELIVER_TO, 'Your orders: PO-10490, PO-10491'],
    footer: ['Signed for by:', 'Check goods on arrival. Report damages to your account manager within 24 hours.'],
  },
  lines: [
    { id: 'fm', code: 'BF-FCM2', printed: 'Full Cream Milk 2L', name: 'Full cream milk 2L', pack: '2L bottle', ordered: 24, got: 24, orderPrice: 4.2, poNumber: 'PO-10490' },
    { id: 'ub', code: 'BF-UB500', printed: 'Unsalted Butter 500g', name: 'Unsalted butter 500g', pack: '500g block', ordered: 6, got: 6, orderPrice: 6.5, poNumber: 'PO-10490' },
    { id: 'gy', code: 'BF-GY1', printed: 'Greek Style Yoghurt 1kg', name: 'Greek yoghurt 1kg', pack: '1kg tub', ordered: 4, got: 4, orderPrice: 3.8, poNumber: 'PO-10490' },
    { id: 'eb', code: 'BF-EB1', printed: 'Espresso Blend 1kg', name: 'Espresso blend 1kg', pack: '1kg bag', ordered: 4, got: 4, orderPrice: 18, poNumber: 'PO-10490' },
    { id: 'om', code: 'BF-OM1', printed: 'Oat Milk 1L', name: 'Oat milk 1L', pack: '1L carton', ordered: 12, got: 12, orderPrice: 2, poNumber: 'PO-10490' },
    { id: 'eg', code: 'BF-FRE15', printed: 'Free Range Eggs 15pk', name: 'Free-range eggs 15pk', pack: 'Pack of 15', ordered: 6, got: 6, orderPrice: 8, poNumber: 'PO-10491', page: 2 },
    { id: 'fl', code: 'BF-FLR10', printed: 'Plain Flour 10kg', name: 'Plain flour 10kg', pack: '10kg sack', ordered: 1, got: 1, orderPrice: 18, poNumber: 'PO-10491', page: 2 },
    {
      id: 'dc',
      code: 'BF-DC1',
      printed: 'Double Cream 1L',
      name: 'Double cream 1L',
      pack: '1L carton',
      ordered: 6,
      got: 6,
      orderPrice: 8,
      page: 2,
      issue: {
        kind: 'which-po',
        options: [
          { poNumber: 'PO-10490', ordered: 6, label: 'weekly order' },
          { poNumber: 'PO-10491', ordered: 6, label: 'top-up' },
        ],
      },
    },
  ],
};

const blurry: Sample = {
  ...clean,
  id: 'blurry',
  label: 'Blurry photo',
  hint: 'Edify can\u2019t read it and asks for another.',
  blocked: 'unreadable',
};

const menu: Sample = {
  id: 'menu',
  label: 'Wrong document',
  hint: 'A menu, not a delivery.',
  kind: 'menu',
  supplier: '',
  supplierInEdify: false,
  printedDate: '',
  site: SITE,
  poNumbers: [],
  pages: 1,
  paper: { brand: 'Fitzroy Espresso', colour: '#1d1d1f', address: ['Brunch, served until 3pm'], footer: ['Ask us about allergens.'] },
  lines: [
    { id: 'm1', printed: 'Smashed avocado on sourdough', name: '', pack: '', ordered: null, got: 1, price: 9.5 },
    { id: 'm2', printed: 'Eggs royale', name: '', pack: '', ordered: null, got: 1, price: 11 },
    { id: 'm3', printed: 'Granola, yoghurt, berries', name: '', pack: '', ordered: null, got: 1, price: 7.5 },
    { id: 'm4', printed: 'Flat white', name: '', pack: '', ordered: null, got: 1, price: 3.6 },
    { id: 'm5', printed: 'Iced oat latte', name: '', pack: '', ordered: null, got: 1, price: 4.1 },
  ],
  blocked: 'wrong-document',
};

const duplicate: Sample = {
  ...clean,
  id: 'duplicate',
  label: 'Already accepted',
  hint: 'The same delivery note photographed twice.',
  blocked: 'duplicate',
  photoOf: 'clean',
  duplicateOf: { grnNumber: 'GRN-1290', time: '07:12 today' },
};

export const SAMPLES: Record<SampleId, Sample> = {
  clean,
  'short-sub': shortSub,
  damaged,
  'new-price': newPrice,
  receipt,
  'two-pos': twoPos,
  blurry,
  menu,
  duplicate,
};

export const SAMPLE_ORDER: SampleId[] = ['short-sub', 'clean', 'damaged', 'new-price', 'receipt', 'two-pos', 'blurry', 'menu', 'duplicate'];

export const DEFAULT_SAMPLE: SampleId = 'short-sub';

export function isSampleId(v: string | null | undefined): v is SampleId {
  return !!v && v in SAMPLES;
}

export function linesOnPage(sample: Sample, page: number): SeedLine[] {
  return sample.lines.filter(l => (l.page ?? 1) === page);
}

export function poFor(sample: Sample, line: SeedLine): string | undefined {
  if (line.issue?.kind === 'which-po') return undefined;
  return line.poNumber ?? sample.poNumbers[0];
}

/** Total printed on the paper. */
export function paperTotal(sample: Sample): number {
  return sample.lines.reduce((sum, l) => sum + (l.price ?? 0) * (l.billed ?? l.got) * (1 + (l.vatRate ?? 0) / 100), 0);
}

export function poIdFor(poNumber: string): string {
  return poNumber.toLowerCase();
}

function poLinesFor(sample: Sample, poNumber: string): POLine[] {
  return sample.lines.flatMap((l): POLine[] => {
    const base = { name: l.name, sku: l.code ?? '', unit: 'EA', price: l.orderPrice ?? l.price ?? 0 };
    if (l.issue?.kind === 'which-po') {
      const o = l.issue.options.find(x => x.poNumber === poNumber);
      return o ? [{ ...base, id: `${sample.id}-${l.id}-${poNumber}`, expectedQty: o.ordered }] : [];
    }
    if (l.ordered == null || poFor(sample, l) !== poNumber) return [];
    return [{ ...base, id: `${sample.id}-${l.id}`, expectedQty: l.ordered }];
  });
}

/** The open orders behind the PO-backed samples, shown on Deliveries. */
export const CAPTURE_POS: PO[] = SAMPLE_ORDER.map(id => SAMPLES[id])
  .filter(s => !s.blocked && s.poNumbers.length > 0)
  .flatMap(s =>
    s.poNumbers.map(poNumber => ({
      id: poIdFor(poNumber),
      poNumber,
      supplier: s.supplier,
      site: s.site,
      status: 'Sent' as const,
      dateSent: '14 Oct 2026',
      lines: poLinesFor(s, poNumber),
    })),
  );

/** The sample a file dropped into the chat stands for. Real extraction would read the file. */
export function sampleForFile(fileName: string): SampleId {
  const f = fileName.toLowerCase();
  if (/sainsbury|receipt|tesco|shop/.test(f)) return 'receipt';
  if (/menu/.test(f)) return 'menu';
  if (/blur/.test(f)) return 'blurry';
  if (/latteria|burrata|mozz/.test(f)) return 'new-price';
  if (/egg|damage/.test(f)) return 'damaged';
  if (/fresh|clean/.test(f)) return 'clean';
  if (/two|pages/.test(f)) return 'two-pos';
  return DEFAULT_SAMPLE;
}

/** The sample a PO's "Take a photo" button opens. */
export function sampleForPo(poId: string): SampleId | null {
  for (const id of SAMPLE_ORDER) {
    const s = SAMPLES[id];
    if (!s.blocked && s.poNumbers.some(p => poIdFor(p) === poId)) return id;
  }
  return null;
}

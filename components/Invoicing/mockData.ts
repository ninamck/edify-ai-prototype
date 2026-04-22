import { MOCK_COMPLETED_DELIVERIES, MOCK_POS, GRN, PO, POLine } from '@/components/Receiving/mockData';
export type { GRN } from '@/components/Receiving/mockData';

export type InvoiceMatchStatus =
  | 'Matched'
  | 'Variance'
  | 'Parse Failed'
  | 'Duplicate'
  | 'Approved'
  | 'Matching in Progress';

export type PriceResolution = 'Accept & Update Cost in Edify' | 'Accept for this delivery' | 'Dispute → Credit Note';
export type QtyResolution = 'Credit Note' | 'Accept Short';
export type OverInvoiceResolution = 'Request credit note';
export type AnyResolution = PriceResolution | QtyResolution | OverInvoiceResolution;

// Module-level store — resolutions captured when the user approves an invoice.
// Lives for the lifetime of the page (cleared on browser refresh, like MOCK_INVOICES).
const approvedResolutionsById = new Map<string, Record<string, AnyResolution>>();

export function saveApprovedResolutions(invoiceId: string, resolutions: Record<string, AnyResolution>): void {
  approvedResolutionsById.set(invoiceId, { ...resolutions });
}

export function getApprovedResolutions(invoiceId: string): Record<string, AnyResolution> | undefined {
  return approvedResolutionsById.get(invoiceId);
}

// Invoices synced via a path other than the InvoiceList bulk-sync flow
// (e.g. parse-failed invoices sent via the pass-through-style recovery view).
// InvoiceList merges these into its locallySynced set on mount.
const externallySyncedIds = new Set<string>();

export function markInvoiceExternallySynced(invoiceId: string): void {
  externallySyncedIds.add(invoiceId);
}

export function getExternallySyncedIds(): string[] {
  return Array.from(externallySyncedIds);
}

// Promotes a parse-failed invoice into a matchable one by linking GRN(s).
// Invoice lines are seeded from GRN received data; the user can then edit any
// line in the match view if the actual PDF shows different values. Variances
// and status are recomputed on demand via recomputeInvoiceVariances.
export function promoteParseFailedToMatched(invoiceId: string, grnNumbers: string[]): void {
  const inv = MOCK_INVOICES.find(i => i.id === invoiceId);
  if (!inv) return;
  const grns = grnNumbers
    .map(n => MOCK_COMPLETED_DELIVERIES.find(g => g.grnNumber === n))
    .filter((g): g is NonNullable<typeof g> => !!g);
  const allLines = grns.flatMap(g => g.lines);
  inv.grnNumbers = grnNumbers;
  inv.lines = allLines.map((gl, i) => ({
    id: `il-${invoiceId}-${i}`,
    description: gl.name,
    sku: gl.sku,
    qty: gl.receivedQty,
    unitPrice: gl.price,
    lineTotal: gl.receivedQty * gl.price,
  }));
  inv.total = inv.lines.reduce((s, l) => s + l.lineTotal, 0);
  inv.editable = true;
  recomputeInvoiceVariances(invoiceId);
}

// Recomputes variances + status for an invoice, given the currently linked GRNs.
// Qty variance: invoice.qty vs GRN received qty for that SKU.
// Price variance: invoice.unitPrice vs PO price for that SKU (PO reached via GRN.poNumbers).
export function recomputeInvoiceVariances(invoiceId: string): void {
  const inv = MOCK_INVOICES.find(i => i.id === invoiceId);
  if (!inv) return;
  const grns = inv.grnNumbers
    .map(n => MOCK_COMPLETED_DELIVERIES.find(g => g.grnNumber === n))
    .filter((g): g is NonNullable<typeof g> => !!g);
  const grnLines = grns.flatMap(g => g.lines);
  const poLines = grns.flatMap(g =>
    g.poNumbers.flatMap(pn => {
      const po = MOCK_POS.find(p => p.poNumber === pn);
      return po?.lines ?? [];
    })
  );
  const variances: MatchVariance[] = [];
  for (const line of inv.lines) {
    const gl = grnLines.find(l => l.sku === line.sku);
    const pl = poLines.find(l => l.sku === line.sku);
    if (gl && line.qty !== gl.receivedQty) {
      variances.push({
        id: `v-${line.id}-qty`,
        itemName: line.description,
        sku: line.sku,
        type: 'qty',
        invoiceValue: line.qty,
        grnValue: gl.receivedQty,
        poValue: pl?.expectedQty ?? gl.expectedQty,
        impact: Math.abs(line.qty - gl.receivedQty) * line.unitPrice,
      });
    }
    if (pl && line.unitPrice !== pl.price) {
      variances.push({
        id: `v-${line.id}-price`,
        itemName: line.description,
        sku: line.sku,
        type: 'price',
        invoiceValue: line.unitPrice,
        grnValue: gl?.price ?? pl.price,
        poValue: pl.price,
        impact: Math.abs(line.unitPrice - pl.price) * line.qty,
      });
    }
  }
  inv.variances = variances;
  inv.total = inv.lines.reduce((s, l) => s + l.lineTotal, 0);
  inv.status = variances.length > 0 ? 'Variance' : 'Matched';
}

// Update a single invoice line's qty or unitPrice, then recompute downstream state.
export function updateInvoiceLine(
  invoiceId: string,
  lineId: string,
  patch: { qty?: number; unitPrice?: number }
): void {
  const inv = MOCK_INVOICES.find(i => i.id === invoiceId);
  if (!inv) return;
  const line = inv.lines.find(l => l.id === lineId);
  if (!line) return;
  if (patch.qty !== undefined) line.qty = patch.qty;
  if (patch.unitPrice !== undefined) line.unitPrice = patch.unitPrice;
  line.lineTotal = line.qty * line.unitPrice;
  recomputeInvoiceVariances(invoiceId);
}

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
  type: 'price' | 'qty' | 'over-invoice';
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
  poNumbers?: string[];
  suggestedGRN?: string;
  status: InvoiceMatchStatus;
  lines: InvoiceLine[];
  variances: MatchVariance[];
  note?: string;
  noteAuthor?: string;
  noteUpdatedAt?: string;
  parked?: boolean;
  // True when this invoice was promoted from a parse-failed state via a GRN,
  // so the user can edit invoice line qty/price inline to match what the PDF shows.
  editable?: boolean;
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
    total: 969.60,
    grnNumbers: ['GRN-1244'],
    suggestedGRN: 'GRN-1245',
    status: 'Variance',
    lines: [
      { id: 'il-1', description: 'Full cream milk 2L', sku: 'FCM-2L', qty: 20, unitPrice: 4.20, lineTotal: 84.00 },
      { id: 'il-2', description: 'Double cream 1L', sku: 'DC-1L', qty: 8, unitPrice: 8.00, lineTotal: 64.00 },
      { id: 'il-3', description: 'Free range eggs 15pk', sku: 'FRE-15', qty: 12, unitPrice: 8.50, lineTotal: 102.00 },
      { id: 'il-4', description: 'Unsalted butter 500g', sku: 'UB-500', qty: 6, unitPrice: 6.50, lineTotal: 39.00 },
      { id: 'il-4b', description: 'Dishwasher tablets 100pk', sku: 'DWT-100', qty: 2, unitPrice: 24.00, lineTotal: 48.00 },
      { id: 'il-5', description: 'Espresso blend 1kg', sku: 'EB-1KG', qty: 10, unitPrice: 19.20, lineTotal: 192.00 },
      { id: 'il-6', description: 'Oat milk 1L', sku: 'OM-1L', qty: 24, unitPrice: 4.00, lineTotal: 96.00 },
      { id: 'il-7', description: 'Takeaway cups 12oz', sku: 'TC-12', qty: 4, unitPrice: 28.00, lineTotal: 112.00 },
    ],
    variances: [
      { id: 'v-1', itemName: 'Full cream milk 2L', sku: 'FCM-2L', type: 'qty', invoiceValue: 20, grnValue: 18, poValue: 20, impact: 8.40 },
      { id: 'v-2', itemName: 'Free range eggs 15pk', sku: 'FRE-15', type: 'price', invoiceValue: 8.50, grnValue: 8.00, poValue: 8.00, impact: 6.00 },
      { id: 'v-6', itemName: 'Espresso blend 1kg', sku: 'EB-1KG', type: 'price', invoiceValue: 19.20, grnValue: 18.00, poValue: 18.00, impact: 12.00 },
    ],
    note: 'Chased Bidfood Tuesday — ETA credit by Thursday close.',
    noteAuthor: 'Sam',
    noteUpdatedAt: '2h ago',
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
    note: 'Price variance on spinach/tomatoes looks like the supplier\u2019s new list \u2014 checking with Priya before accepting.',
    noteAuthor: 'Jordan',
    noteUpdatedAt: 'yesterday',
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
  {
    id: 'inv-6',
    invoiceNumber: 'INV-4432',
    supplier: 'Bidfood',
    date: '4 Apr 2026',
    total: 284.00,
    grnNumbers: ['GRN-1248'],
    status: 'Matched',
    lines: [
      { id: 'il-20', description: 'Full cream milk 2L', sku: 'FCM-2L', qty: 30, unitPrice: 4.20, lineTotal: 126.00 },
      { id: 'il-21', description: 'Double cream 1L', sku: 'DC-1L', qty: 10, unitPrice: 8.00, lineTotal: 80.00 },
      { id: 'il-22', description: 'Unsalted butter 500g', sku: 'UB-500', qty: 12, unitPrice: 6.50, lineTotal: 78.00 },
    ],
    variances: [],
    note: 'First of two deliveries against PO-2907 — dairy run. Eggs + flour arriving tomorrow on a separate truck.',
    noteAuthor: 'Ravi',
    noteUpdatedAt: '4 Apr',
  },
  {
    id: 'inv-7',
    invoiceNumber: 'INV-4433',
    supplier: 'Bidfood',
    date: '5 Apr 2026',
    total: 192.00,
    grnNumbers: ['GRN-1249'],
    status: 'Matched',
    lines: [
      { id: 'il-23', description: 'Free range eggs 15pk', sku: 'FRE-15', qty: 15, unitPrice: 8.00, lineTotal: 120.00 },
      { id: 'il-24', description: 'Plain flour 10kg', sku: 'FLR-10', qty: 4, unitPrice: 18.00, lineTotal: 72.00 },
    ],
    variances: [],
  },
  {
    id: 'inv-8',
    invoiceNumber: 'INV-4440',
    supplier: 'Bidfood',
    date: '7 Apr 2026',
    total: 84.00,
    grnNumbers: ['GRN-1250'],
    status: 'Matched',
    lines: [
      { id: 'il-25', description: 'Full cream milk 2L', sku: 'FCM-2L', qty: 20, unitPrice: 4.20, lineTotal: 84.00 },
    ],
    variances: [],
  },
  {
    id: 'inv-9',
    invoiceNumber: 'INV-4441',
    supplier: 'Bidfood',
    date: '8 Apr 2026',
    total: 90.00,
    grnNumbers: ['GRN-1251'],
    status: 'Variance',
    lines: [
      { id: 'il-26', description: 'Plain flour 10kg', sku: 'FLR-10', qty: 5, unitPrice: 18.00, lineTotal: 90.00 },
    ],
    variances: [
      { id: 'v-9', itemName: 'Plain flour 10kg', sku: 'FLR-10', type: 'qty', invoiceValue: 5, grnValue: 4, poValue: 5, impact: 18.00 },
    ],
    note: 'Bidfood Leyton short by 1 flour sack this delivery — credit note requested Thursday.',
    noteAuthor: 'Priya',
    noteUpdatedAt: 'today',
  },
  {
    id: 'inv-10',
    invoiceNumber: 'INV-4460',
    supplier: 'Bidfood',
    date: '10 Apr 2026',
    total: 144.00,
    grnNumbers: [],
    poNumbers: ['PO-2915'],
    status: 'Matching in Progress',
    lines: [
      { id: 'il-27', description: 'Double cream 1L', sku: 'DC-1L', qty: 8, unitPrice: 8.00, lineTotal: 64.00 },
      { id: 'il-28', description: 'Free range eggs 15pk', sku: 'FRE-15', qty: 10, unitPrice: 8.00, lineTotal: 80.00 },
    ],
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

export function getPOsForInvoice(invoice: Invoice): string[] {
  const grns = getGRNsForInvoice(invoice);
  const viaGRN = grns.flatMap(g => g.poNumbers);
  const explicit = invoice.poNumbers ?? [];
  return Array.from(new Set([...viaGRN, ...explicit]));
}

export interface SiblingInvoice {
  sibling: Invoice;
  sharedPOs: string[];
}

export function getSiblingInvoicesSharingPO(invoice: Invoice): SiblingInvoice[] {
  const thisPOs = new Set(getPOsForInvoice(invoice));
  if (thisPOs.size === 0) return [];
  return MOCK_INVOICES
    .filter(other => other.id !== invoice.id)
    .map(other => {
      const sharedPOs = getPOsForInvoice(other).filter(po => thisPOs.has(po));
      return { sibling: other, sharedPOs };
    })
    .filter(x => x.sharedPOs.length > 0);
}

export type POCoverageStatus =
  | 'Not Invoiced'
  | 'Partially Invoiced'
  | 'Fully Invoiced'
  | 'Over-invoiced';

export interface POLineInvoiceApplication {
  invoice: Invoice;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  priceDelta: number;
}

export interface POLineCoverage {
  poLine: POLine;
  invoicedQty: number;
  invoicedAmount: number;
  remainingQty: number;
  applications: POLineInvoiceApplication[];
  overInvoiced: boolean;
}

export interface POCoverage {
  po: PO;
  invoices: Invoice[];
  poAmount: number;
  invoicedAmount: number;
  percent: number;
  lineCoverage: POLineCoverage[];
  status: POCoverageStatus;
  fullyInvoicedLineCount: number;
}

export function getInvoicesForPO(poNumber: string): Invoice[] {
  return MOCK_INVOICES.filter(inv => getPOsForInvoice(inv).includes(poNumber));
}

export function getPOCoverage(poNumber: string): POCoverage | null {
  const po = MOCK_POS.find(p => p.poNumber === poNumber);
  if (!po) return null;
  const invoices = getInvoicesForPO(poNumber);
  const poAmount = po.lines.reduce((s, l) => s + l.price * l.expectedQty, 0);

  const lineCoverage: POLineCoverage[] = po.lines.map(poLine => {
    const applications: POLineInvoiceApplication[] = invoices
      .map(inv => {
        const il = inv.lines.find(l => l.sku === poLine.sku);
        if (!il) return null;
        return {
          invoice: inv,
          qty: il.qty,
          unitPrice: il.unitPrice,
          lineTotal: il.lineTotal,
          priceDelta: il.unitPrice - poLine.price,
        };
      })
      .filter((x): x is POLineInvoiceApplication => x !== null);
    const invoicedQty = applications.reduce((s, a) => s + a.qty, 0);
    const invoicedAmount = applications.reduce((s, a) => s + a.lineTotal, 0);
    return {
      poLine,
      invoicedQty,
      invoicedAmount,
      remainingQty: poLine.expectedQty - invoicedQty,
      applications,
      overInvoiced: invoicedQty > poLine.expectedQty,
    };
  });

  const invoicedAmount = lineCoverage.reduce((s, l) => s + l.invoicedAmount, 0);
  const percent = poAmount > 0 ? (invoicedAmount / poAmount) * 100 : 0;
  const anyOver = lineCoverage.some(l => l.overInvoiced);
  const allFull = lineCoverage.every(l => l.invoicedQty >= l.poLine.expectedQty);

  let status: POCoverageStatus;
  if (invoices.length === 0) status = 'Not Invoiced';
  else if (anyOver || invoicedAmount > poAmount + 0.01) status = 'Over-invoiced';
  else if (allFull) status = 'Fully Invoiced';
  else status = 'Partially Invoiced';

  const fullyInvoicedLineCount = lineCoverage.filter(l => l.invoicedQty >= l.poLine.expectedQty && !l.overInvoiced).length;

  return { po, invoices, poAmount, invoicedAmount, percent, lineCoverage, status, fullyInvoicedLineCount };
}

export function getPOCoverageByPOId(poId: string): POCoverage | null {
  const po = MOCK_POS.find(p => p.id === poId);
  if (!po) return null;
  return getPOCoverage(po.poNumber);
}

export interface PriorInvoicedOnLine {
  qty: number;
  applications: POLineInvoiceApplication[];
}

function compareInvoicesByArrayOrder(a: Invoice, b: Invoice): number {
  return MOCK_INVOICES.indexOf(a) - MOCK_INVOICES.indexOf(b);
}

export function getPriorInvoicedForInvoiceLine(
  invoice: Invoice,
  sku: string,
): PriorInvoicedOnLine {
  const pos = getPOsForInvoice(invoice);
  if (pos.length === 0) return { qty: 0, applications: [] };
  const applications: POLineInvoiceApplication[] = [];
  for (const poNumber of pos) {
    const coverage = getPOCoverage(poNumber);
    if (!coverage) continue;
    const lineCov = coverage.lineCoverage.find(lc => lc.poLine.sku === sku);
    if (!lineCov) continue;
    for (const app of lineCov.applications) {
      if (app.invoice.id !== invoice.id && compareInvoicesByArrayOrder(app.invoice, invoice) < 0) {
        applications.push(app);
      }
    }
  }
  const qty = applications.reduce((s, a) => s + a.qty, 0);
  return { qty, applications };
}

export interface POContextForInvoice {
  poNumber: string;
  poId: string;
  poAmount: number;
  allInvoices: Invoice[];
  priorInvoices: Invoice[];
  laterInvoices: Invoice[];
  priorInvoicedAmount: number;
  thisInvoiceAmount: number;
  afterThisAmount: number;
  invoiceIndex: number;
  totalInvoices: number;
  closesIfApproved: boolean;
  overInvoiceIfApproved: boolean;
  overBy: number;
}

export function getPOContextForInvoice(invoice: Invoice): POContextForInvoice[] {
  const pos = getPOsForInvoice(invoice);
  const out: POContextForInvoice[] = [];
  for (const poNumber of pos) {
    const coverage = getPOCoverage(poNumber);
    if (!coverage) continue;
    const { po, poAmount, lineCoverage, invoices: allInvoices } = coverage;
    const activeInvoices = allInvoices.filter(i => !EXCLUDED_FROM_SPLIT_BILLING.includes(i.status) || i.id === invoice.id);
    const ordered = [...activeInvoices].sort(compareInvoicesByArrayOrder);
    const idx = ordered.findIndex(i => i.id === invoice.id);
    const priorInvoices = ordered.filter((_, i) => i < idx);
    const laterInvoices = ordered.filter((_, i) => i > idx);

    const thisInvoiceAmount = lineCoverage
      .flatMap(lc => lc.applications.filter(a => a.invoice.id === invoice.id))
      .reduce((s, a) => s + a.lineTotal, 0);
    const priorInvoicedAmount = lineCoverage
      .flatMap(lc => lc.applications.filter(a => priorInvoices.some(p => p.id === a.invoice.id)))
      .reduce((s, a) => s + a.lineTotal, 0);
    const afterThisAmount = priorInvoicedAmount + thisInvoiceAmount;

    const tolerance = 0.01;
    const lineFullyCoveredAfter = lineCoverage.map(lc => {
      const priorQty = lc.applications.filter(a => priorInvoices.some(p => p.id === a.invoice.id)).reduce((s, a) => s + a.qty, 0);
      const thisQty = lc.applications.filter(a => a.invoice.id === invoice.id).reduce((s, a) => s + a.qty, 0);
      return { covered: priorQty + thisQty, expected: lc.poLine.expectedQty };
    });
    const anyOver = lineFullyCoveredAfter.some(l => l.covered > l.expected) || afterThisAmount > poAmount + tolerance;
    const overBy = Math.max(0, afterThisAmount - poAmount);
    const allLinesFull = lineFullyCoveredAfter.every(l => l.covered >= l.expected);
    const closesIfApproved = !anyOver && allLinesFull && afterThisAmount <= poAmount + tolerance;

    out.push({
      poNumber,
      poId: po.id,
      poAmount,
      allInvoices: ordered,
      priorInvoices,
      laterInvoices,
      priorInvoicedAmount,
      thisInvoiceAmount,
      afterThisAmount,
      invoiceIndex: idx + 1,
      totalInvoices: ordered.length,
      closesIfApproved,
      overInvoiceIfApproved: anyOver,
      overBy,
    });
  }
  return out;
}

const EXCLUDED_FROM_SPLIT_BILLING: readonly InvoiceMatchStatus[] = ['Duplicate', 'Parse Failed'];

export function isSplitBillingInvoice(invoice: Invoice): boolean {
  if (EXCLUDED_FROM_SPLIT_BILLING.includes(invoice.status)) return false;
  const pos = getPOsForInvoice(invoice);
  return pos.some(po => {
    const active = getInvoicesForPO(po).filter(i => !EXCLUDED_FROM_SPLIT_BILLING.includes(i.status));
    return active.length > 1;
  });
}

export function splitBillingCount(): number {
  return MOCK_INVOICES.filter(isSplitBillingInvoice).length;
}

export type VatCategory = 'food' | 'alcohol' | 'non-food' | 'unknown';

const FOOD_SKU_PREFIXES = ['FCM', 'DC', 'FRE', 'UB', 'EB', 'OM', 'BS', 'CT', 'SDL', 'AVO', 'LEM', 'SUG', 'FLR'];
const NON_FOOD_SKU_PREFIXES = ['NAP', 'TC', 'DWT', 'CLN'];
const ALCOHOL_SKU_PREFIXES = ['ALC', 'BEER', 'WINE', 'SPIR'];

export function categorizeSku(sku: string): VatCategory {
  const upper = sku.toUpperCase();
  if (ALCOHOL_SKU_PREFIXES.some(p => upper.startsWith(p))) return 'alcohol';
  if (NON_FOOD_SKU_PREFIXES.some(p => upper.startsWith(p))) return 'non-food';
  if (FOOD_SKU_PREFIXES.some(p => upper.startsWith(p))) return 'food';
  return 'unknown';
}

export function defaultVatRate(category: VatCategory): number | null {
  if (category === 'food') return 0;
  if (category === 'alcohol') return 20;
  if (category === 'non-food') return 20;
  return null;
}

export function vatCategoryLabel(category: VatCategory): string {
  if (category === 'food') return 'Food & drink (zero-rated)';
  if (category === 'alcohol') return 'Alcohol';
  if (category === 'non-food') return 'Non-food / cleaning';
  return 'Uncategorised';
}

export function getInvoiceStatusBadgeVariant(status: InvoiceMatchStatus): 'warning' | 'error' | 'success' | 'info' | 'default' {
  switch (status) {
    case 'Variance': return 'warning';
    case 'Parse Failed': return 'error';
    case 'Duplicate': return 'error';
    case 'Matched': return 'success';
    case 'Approved': return 'success';
    case 'Matching in Progress': return 'info';
    default: return 'default';
  }
}

export type StatusNoteTone = 'info' | 'warning' | 'error' | 'success' | 'neutral';
export interface AutoStatusNote {
  text: string;
  tone: StatusNoteTone;
  reason: string;
}

export function getAutoStatusNote(invoice: Invoice): AutoStatusNote | null {
  // Parse failed → blocker
  if (invoice.status === 'Parse Failed') {
    return {
      text: `Parse failed — document couldn't be read. Re-upload the PDF or fix the fields manually before matching.`,
      tone: 'error',
      reason: 'invoice.status=Parse Failed',
    };
  }
  // Duplicate → blocker
  if (invoice.status === 'Duplicate') {
    return {
      text: `Possible duplicate — another invoice with the same number has already been processed. Verify with ${invoice.supplier} before proceeding.`,
      tone: 'error',
      reason: 'invoice.status=Duplicate',
    };
  }
  // Matching in progress → awaiting delivery
  if (invoice.status === 'Matching in Progress') {
    return {
      text: `Awaiting delivery — ${invoice.supplier} has invoiced but no GRN received yet. Parked until the delivery is logged.`,
      tone: 'warning',
      reason: 'invoice.status=Matching in Progress',
    };
  }
  // Variance: subcategorise
  if (invoice.status === 'Variance') {
    const over = invoice.variances.find(v => v.type === 'over-invoice');
    if (over) {
      const extra = over.invoiceValue - over.poValue;
      return {
        text: `Holding — ${invoice.supplier} billed ${over.invoiceValue} ${over.itemName} (${extra > 0 ? '+' : ''}${extra} over PO). Credit note requested for £${Math.abs(over.impact).toFixed(2)}, awaiting confirmation.`,
        tone: 'warning',
        reason: 'variance.type=over-invoice',
      };
    }
    const qtyShort = invoice.variances.find(v => v.type === 'qty' && v.grnValue < v.invoiceValue);
    if (qtyShort) {
      const shortBy = qtyShort.invoiceValue - qtyShort.grnValue;
      return {
        text: `Holding — ${invoice.supplier} short-delivered ${shortBy} unit${shortBy === 1 ? '' : 's'} of ${qtyShort.itemName} (billed ${qtyShort.invoiceValue}, received ${qtyShort.grnValue}). Credit note requested, awaiting confirmation.`,
        tone: 'warning',
        reason: 'variance.type=qty short',
      };
    }
    const priceVariances = invoice.variances.filter(v => v.type === 'price');
    if (priceVariances.length > 0) {
      return {
        text: `${priceVariances.length} price variance${priceVariances.length > 1 ? 's' : ''} pending reviewer resolution on ${invoice.supplier}'s invoice.`,
        tone: 'warning',
        reason: 'variance.type=price',
      };
    }
    return {
      text: `Variance detected — reviewer action required.`,
      tone: 'warning',
      reason: 'invoice.status=Variance (generic)',
    };
  }
  if (invoice.status === 'Matched') {
    return {
      text: `All items matched and ready for approval.`,
      tone: 'success',
      reason: 'invoice.status=Matched',
    };
  }
  if (invoice.status === 'Approved') {
    return {
      text: `Approved and synced to Xero.`,
      tone: 'success',
      reason: 'invoice.status=Approved',
    };
  }
  return null;
}

export function needsReviewCount(): number {
  return MOCK_INVOICES.filter(i => i.status === 'Variance' || i.status === 'Parse Failed' || i.status === 'Duplicate').length;
}

export function autoMatchedCount(): number {
  return MOCK_INVOICES.filter(i => i.status === 'Approved' || i.status === 'Matched').length;
}

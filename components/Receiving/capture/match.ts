import { MOCK_POS, type PO, type POLine } from '../mockData';
import { withAccepted } from './record';
import { freshEdits, ORDER_KEY, SUPPLIER_KEY, type Answers, type LineEdit } from './review';
import { paperLines, SAMPLES, type MatchedBy, type Sample, type SampleId, type SeedLine } from './samples';

// Which order a paper is checked against, and changing it. Edify trusts an
// order number printed on the paper. When the person says it's a different
// order, or no order, every line is matched again by product: by supplier
// code, then by name. What the person counted is kept; answers are not,
// because the questions change.

const OPEN = new Set<PO['status']>(['Sent', 'Partially Received']);
const RECENT_DAYS = 30;

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sameProduct(l: SeedLine, pl: POLine) {
  return (!!l.code && l.code === pl.sku) || norm(l.name) === norm(pl.name);
}

function findPo(poNumber: string) {
  return MOCK_POS.find(p => p.poNumber === poNumber);
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every(x => b.includes(x));
}

function unitWord(unit: string) {
  return unit === 'EA' ? 'Each' : unit.charAt(0) + unit.slice(1).toLowerCase();
}

export function matchedBy(s: Sample): MatchedBy {
  return s.matchedBy ?? (s.poNumbers.length ? 'paper' : 'none');
}

/** A substitute, seen as just the product that came. */
function asSent(l: SeedLine): SeedLine {
  if (l.issue?.kind !== 'substitute') return l;
  const s = l.issue;
  return { ...l, name: s.sentName, code: s.sentCode, pack: s.sentPack, price: s.sentPrice ?? l.price, orderPrice: undefined, issue: { kind: 'extra', inCatalogue: s.inCatalogue } };
}

function matchTo(base: Sample, poNumbers: string[], by: MatchedBy): Sample {
  const pos = poNumbers.map(findPo).filter((p): p is PO => !!p);
  const used = new Set<string>();
  const missing = `Not on the ${base.kind === 'invoice' ? 'invoice' : 'delivery note'}.`;
  const lines: SeedLine[] = paperLines(base).map(l => {
    const hits = pos.flatMap(po => {
      const pl = po.lines.find(x => sameProduct(l, x));
      return pl ? [{ po, pl }] : [];
    });
    hits.forEach(h => used.add(h.pl.id));
    const unlinked = { ordered: null, poNumber: undefined, poLineId: undefined };
    if (hits.length === 0) {
      const sent = asSent(l);
      const keep = sent.issue?.kind === 'extra' || sent.issue?.kind === 'new-product';
      return { ...sent, ...unlinked, issue: keep ? sent.issue : { kind: 'extra', inCatalogue: true } };
    }
    if (hits.length === 1) {
      const { po, pl } = hits[0];
      return { ...l, ordered: pl.expectedQty, orderPrice: pl.price, poNumber: po.poNumber, poLineId: pl.id, issue: l.issue?.kind === 'substitute' ? l.issue : undefined };
    }
    return {
      ...l,
      ...unlinked,
      ordered: hits.reduce((n, h) => n + h.pl.expectedQty, 0),
      orderPrice: hits[0].pl.price,
      issue: { kind: 'which-po', options: hits.map(h => ({ poNumber: h.po.poNumber, ordered: h.pl.expectedQty, label: `order ${h.po.poNumber}`, poLineId: h.pl.id })) },
    };
  });
  for (const po of pos) {
    for (const pl of po.lines) {
      if (used.has(pl.id)) continue;
      lines.push({
        id: `np-${pl.id}`,
        name: pl.name,
        printed: '',
        code: pl.sku,
        pack: unitWord(pl.unit),
        ordered: pl.expectedQty,
        got: 0,
        orderPrice: pl.price,
        poNumber: po.poNumber,
        poLineId: pl.id,
        notOnPaper: true,
        note: missing,
      });
    }
  }
  return { ...base, poNumbers: pos.map(p => p.poNumber), matchedBy: by, matchLines: false, lines };
}

/** Every line as received with no order: products Edify knows go straight in, the rest need setting up. */
function withoutOrder(base: Sample, by: MatchedBy): Sample {
  const lines = paperLines(base).map((l): SeedLine => {
    const sent = asSent(l);
    const issue = sent.issue?.kind === 'new-product' || (sent.issue?.kind === 'extra' && !sent.issue.inCatalogue) ? sent.issue : undefined;
    return { ...sent, ordered: null, poNumber: undefined, poLineId: undefined, issue };
  });
  return { ...base, poNumbers: [], matchedBy: by, matchLines: false, lines };
}

const resolved = new Map<string, Sample>();

/**
 * The sample checked against `orders`: null for the order Edify found, [] for
 * no order. Kept once made, so accepting (which settles the order's lines)
 * doesn't change what the paper was checked against.
 */
export function resolveOrders(base: Sample, orders: string[] | null): Sample {
  const key = `${base.id}|${orders?.join(',') ?? '*'}`;
  let s = resolved.get(key);
  if (!s) {
    s = resolveNow(base, orders);
    resolved.set(key, s);
  }
  return s;
}

function resolveNow(base: Sample, orders: string[] | null): Sample {
  if (base.blocked || base.kind === 'receipt') return base;
  if (orders == null) return base.matchLines ? matchTo(base, base.poNumbers, matchedBy(base)) : base;
  if (orders.length === 0) return base.poNumbers.length === 0 ? base : withoutOrder(base, 'you');
  if (!base.matchLines && sameSet(orders, base.poNumbers)) return { ...base, matchedBy: 'you' };
  return matchTo(base, orders, 'you');
}

/** What the screens show for a photo: matched to its orders, and caught if it was already accepted. */
export function deliverySample(id: SampleId, orders: string[] | null = null): Sample {
  return withAccepted(resolveOrders(SAMPLES[id], orders));
}

/** Counts and answers after the order changes. Counts on the paper carry over. */
export function rematch(id: SampleId, orders: string[], prev: { edits: Record<string, LineEdit>; answers: Answers }) {
  const next = deliverySample(id, orders);
  const edits = freshEdits(next);
  for (const l of next.lines) if (prev.edits[l.id]) edits[l.id] = prev.edits[l.id];
  const answers: Answers = {};
  if (prev.answers[SUPPLIER_KEY]) answers[SUPPLIER_KEY] = prev.answers[SUPPLIER_KEY];
  if (orders.length === 0) answers[ORDER_KEY] = { kind: 'no-order', choice: 'none' };
  return { orders, edits, answers };
}

export interface OrderOption {
  po: PO;
  /** Products on the paper that are on this order. */
  covered: number;
  /** Lines on this order that aren't on the paper. */
  extra: number;
  sameSupplier: boolean;
  recent: boolean;
  current: boolean;
}

/** Open orders at the paper's site, best fit first. */
export function orderOptions(sample: Sample): OrderOption[] {
  const paper = paperLines(SAMPLES[sample.id] ?? sample);
  const now = Date.now();
  return MOCK_POS.filter(p => p.site === sample.site && OPEN.has(p.status))
    .map(po => ({
      po,
      covered: paper.filter(l => po.lines.some(pl => sameProduct(l, pl))).length,
      extra: po.lines.filter(pl => !paper.some(l => sameProduct(l, pl))).length,
      sameSupplier: po.supplier === sample.supplier,
      recent: now - Date.parse(po.dateSent) < RECENT_DAYS * 864e5,
      current: sample.poNumbers.includes(po.poNumber),
    }))
    .sort((a, b) => b.covered - a.covered || a.extra - b.extra || Date.parse(b.po.dateSent) - Date.parse(a.po.dateSent));
}

export function paperLineCount(sample: Sample) {
  return paperLines(SAMPLES[sample.id] ?? sample).length;
}

/**
 * Another open order that fits the paper exactly, when the one it's checked
 * against doesn't: every product on it, nothing missing. Edify suggests it
 * and leaves the switch to the person. Quiet once they've picked an order.
 */
export function betterOrder(sample: Sample): PO | null {
  if (sample.kind === 'receipt' || sample.blocked || sample.matchedBy === 'you' || sample.poNumbers.length > 1) return null;
  const n = paperLineCount(sample);
  const exact = (o: OrderOption) => o.covered === n && o.extra === 0;
  const options = orderOptions(sample);
  if (options.some(o => o.current && exact(o))) return null;
  const fits = options.filter(o => !o.current && o.sameSupplier && exact(o));
  return fits.length === 1 ? fits[0].po : null;
}

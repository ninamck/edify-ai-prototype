import { UOM_SHORT, unitTypeLabel } from './productOptions';
import { poFor, type ProductSeed, type Sample, type SeedLine, type SupplierSeed } from './samples';

// What on a delivery needs a person, the answers they can give, and what each
// answer does. Edify only pre-picks an answer that is about money and can be
// undone (a credit request for a short). Anything that changes the catalogue,
// stock or what you pay needs a tap.

export type IssueKind =
  | 'short'
  | 'over'
  | 'damaged'
  | 'wrong'
  | 'price'
  | 'substitute'
  | 'extra'
  | 'which-po'
  | 'new-product'
  | 'new-supplier'
  | 'no-order'
  | 'unsure';

export interface Choice {
  id: string;
  label: string;
  /** Shown under the label when this choice is picked. */
  note?: string;
  credit?: number;
  /** Heading the choice sits under in a dropdown. */
  group?: string;
  /** Second line under the label in a dropdown. */
  detail?: string;
}

export interface Issue {
  kind: IssueKind;
  title: string;
  detail: string;
  choices: Choice[];
  suggested?: string;
  /** Edify's one guess, offered as a single tap but never picked for the person. */
  guess?: { id: string; label: string };
  /** Shown under the choices until the person answers. */
  hint?: string;
}

/** What the person changed on a line, on top of what Edify read. */
export interface LineEdit {
  got: number;
  damaged: number;
  wrong: boolean;
}

export type Answers = Record<string, { kind: IssueKind; choice: string }>;

/** Products and the supplier the person has checked and saved, keyed by line id. */
export interface Setups {
  products: Record<string, ProductSeed>;
  supplier?: SupplierSeed;
}

export const NO_SETUPS: Setups = { products: {} };

export const SUPPLIER_KEY = '__supplier';
export const ORDER_KEY = '__order';

const PRICE_TOLERANCE = 0.02;

export function gbp(n: number): string {
  return `£${n.toFixed(2)}`;
}

export function hasPrices(sample: Sample): boolean {
  return sample.kind === 'invoice' || sample.kind === 'receipt';
}

/** A supplier's paper with no order behind it. Receipts never have one. */
export function hasNoOrder(sample: Sample): boolean {
  return sample.kind !== 'receipt' && sample.kind !== 'menu' && sample.poNumbers.length === 0;
}

/** "PO-10482, the order number on the invoice". */
export function orderWords(sample: Sample): string {
  const pos = sample.poNumbers.join(' and ');
  const kind = sample.kind === 'invoice' ? 'invoice' : 'delivery note';
  if (sample.matchedBy === 'you') return `${pos}, the order you picked`;
  if (sample.matchedBy === 'start') return `${pos}, the order you took the photo for`;
  return `${pos}, the order ${sample.poNumbers.length > 1 ? 'numbers' : 'number'} on the ${kind}`;
}

export function freshEdits(sample: Sample): Record<string, LineEdit> {
  return Object.fromEntries(sample.lines.map(l => [l.id, { got: l.got, damaged: 0, wrong: false }]));
}

function unitPrice(l: SeedLine): number {
  return l.price ?? l.orderPrice ?? 0;
}

/** One product on several orders: what arrived fills them in the order they were placed. */
export function splitAcrossOrders(options: { poNumber: string; ordered: number; label: string }[], got: number) {
  let left = got;
  const split = options.map(o => {
    const qty = Math.min(left, o.ordered);
    left -= qty;
    return { ...o, qty, owed: o.ordered - qty };
  });
  if (left > 0 && split.length) split[split.length - 1].qty += left;
  return split;
}

export function lineIssue(sample: Sample, l: SeedLine, e: LineEdit): Issue | null {
  const price = unitPrice(l);
  const priced = hasPrices(sample);
  const po = poFor(sample, l) ?? 'the order';
  const seed = l.issue;

  if (seed?.kind === 'substitute') {
    const sentAt = seed.sentPrice != null ? `, ${gbp(seed.sentPrice)} each` : '';
    return {
      kind: 'substitute',
      title: l.name,
      detail: `Ordered ${l.ordered}. Sent ${e.got} ${seed.sentName} instead${sentAt}.`,
      choices: [
        {
          id: 'keep',
          label: `Keep it as ${seed.master.toLowerCase()}`,
          note: seed.inCatalogue ? undefined : `Adds ${seed.sentName} to your catalogue under ${seed.master}.`,
        },
        priced && seed.sentPrice != null
          ? { id: 'return', label: `Send back, ask for ${gbp(e.got * seed.sentPrice)} credit`, credit: e.got * seed.sentPrice }
          : { id: 'return', label: 'Send it back' },
      ],
    };
  }

  if (seed?.kind === 'extra') {
    const at = l.price != null ? ` at ${gbp(l.price)} each` : '';
    return {
      kind: 'extra',
      title: l.name,
      detail: hasNoOrder(sample) ? `Not in your catalogue yet. Got ${e.got}${at}.` : `Not on ${po}. Got ${e.got}${at}.`,
      choices: [
        { id: 'keep', label: seed.inCatalogue ? 'Keep it' : 'Keep it, add to your catalogue' },
        priced
          ? { id: 'return', label: `Send back, ask for ${gbp(e.got * price)} credit`, credit: e.got * price }
          : { id: 'return', label: 'Send it back' },
      ],
    };
  }

  if (seed?.kind === 'which-po') {
    const split = splitAcrossOrders(seed.options, e.got);
    const owed = split.filter(o => o.owed > 0);
    if (owed.length === 0) return null;
    const total = split.reduce((n, o) => n + o.ordered, 0);
    const missing = owed.reduce((n, o) => n + o.owed, 0);
    const filled = split.filter(o => o.owed === 0).map(o => o.label);
    const short = owed.map(o => o.label).join(' and ');
    return {
      kind: 'which-po',
      title: l.name,
      detail:
        `Ordered ${total} across your ${seed.options.map(o => o.label).join(' and ')}. Got ${e.got}` +
        (filled.length ? `, so Edify filled the ${filled.join(' and ')}. The ${short} is ${missing} short.` : `. The ${short} is ${missing} short.`),
      choices: [
        { id: 'later', label: `Keep the ${short} open, ${missing} still to come` },
        { id: 'close', label: `Close the ${short}, the rest isn\u2019t coming` },
      ],
    };
  }

  if (seed?.kind === 'new-product') {
    return {
      kind: 'new-product',
      title: l.name,
      detail: `Not in Edify yet. Got ${e.got} at ${gbp(price)}.`,
      choices: [
        { id: 'add', label: 'Add it to your catalogue' },
        { id: 'skip', label: 'Leave it out of stock', note: 'It still counts in what you spent.' },
      ],
    };
  }

  if (e.wrong) {
    return {
      kind: 'wrong',
      title: l.name,
      detail: 'You said this isn\u2019t what you ordered.',
      choices: [
        { id: 'return', label: `Send back, ask for ${gbp(e.got * price)} credit`, credit: e.got * price },
        { id: 'keep', label: 'Keep it anyway' },
      ],
    };
  }

  if (e.damaged > 0) {
    const d = e.damaged;
    const missing = l.ordered != null ? Math.max(0, l.ordered - e.got) : 0;
    const owed = d + missing;
    return {
      kind: 'damaged',
      title: l.name,
      detail: missing > 0 ? `Got ${e.got}, ordered ${l.ordered}. ${d} of them damaged.` : `${d} of ${e.got} damaged.`,
      choices: [
        { id: 'credit', label: `Send back, ask for ${gbp(owed * price)} credit`, credit: owed * price },
        { id: 'resend', label: `Send back, send ${owed} more next delivery` },
      ],
    };
  }

  if (l.ordered != null && e.got < l.ordered) {
    const missing = l.ordered - e.got;
    const note = e.got === l.got && l.note ? ` ${l.note}` : '';
    if (l.notOnPaper) {
      return {
        kind: 'short',
        title: l.name,
        detail: note ? `${note.trim()} Ordered ${l.ordered}.` : `Got ${e.got}, ordered ${l.ordered}.`,
        choices: [
          { id: 'later', label: 'Coming in the next delivery', note: `The ${missing} stay on ${po}.` },
          { id: 'close', label: 'Not coming, nothing owed' },
        ],
      };
    }
    return {
      kind: 'short',
      title: l.name,
      detail: `Got ${e.got}, ordered ${l.ordered}.${note}`,
      choices: [
        { id: 'credit', label: `Ask for ${gbp(missing * price)} credit`, credit: missing * price },
        { id: 'later', label: 'Coming in the next delivery', note: `The other ${missing} stay on ${po}.` },
        { id: 'close', label: 'Not coming, nothing owed' },
      ],
      suggested: 'credit',
    };
  }

  if (l.ordered != null && e.got > l.ordered) {
    const extra = e.got - l.ordered;
    return {
      kind: 'over',
      title: l.name,
      detail: `Got ${e.got}, ordered ${l.ordered}.`,
      choices: [
        { id: 'keep', label: `Keep the extra ${extra}`, note: priced ? `Adds ${gbp(extra * price)} to what you pay.` : undefined },
        { id: 'return', label: `Send the extra ${extra} back` },
      ],
    };
  }

  if (l.price != null && l.orderPrice != null && Math.abs(l.price - l.orderPrice) / l.orderPrice > PRICE_TOLERANCE) {
    const diff = l.price - l.orderPrice;
    const pct = Math.round((Math.abs(diff) / l.orderPrice) * 100);
    return {
      kind: 'price',
      title: l.name,
      detail: `${gbp(l.price)} each on the invoice, ${gbp(l.orderPrice)} on your order. ${diff > 0 ? 'Up' : 'Down'} ${pct}%.`,
      choices: [
        { id: 'pay', label: 'Update your price' },
        ...(diff > 0 ? [{ id: 'credit', label: `Ask for ${gbp(diff * e.got)} credit`, credit: diff * e.got }] : []),
        { id: 'once', label: 'Ignore', note: `Your price stays ${gbp(l.orderPrice)}. This delivery is costed at ${gbp(l.price)}.` },
      ],
    };
  }

  return null;
}

/** No order to check against: find it, or say there isn't one. Never pre-picked. */
export function orderIssue(sample: Sample): Issue | null {
  if (!hasNoOrder(sample)) return null;
  const kind = sample.kind === 'invoice' ? 'invoice' : 'delivery note';
  return sample.matchedBy === 'you'
    ? { kind: 'no-order', title: 'Not on an order', detail: 'You said this delivery isn\u2019t on any order.', choices: [{ id: 'none', label: 'Receive it with no order' }] }
    : {
        kind: 'no-order',
        title: `No open order from ${sample.supplier}`,
        detail: `Nothing from ${sample.supplier} is due at ${sample.site}, and there\u2019s no order number on the ${kind}.`,
        choices: [{ id: 'none', label: 'Receive it with no order' }],
      };
}

export function supplierIssue(sample: Sample): Issue | null {
  if (sample.supplierInEdify) return null;
  return {
    kind: 'new-supplier',
    title: `${sample.supplier} isn\u2019t in Edify yet`,
    detail: 'Add it once and next time it\u2019s matched for you.',
    choices: [{ id: 'add', label: `Add ${sample.supplier}` }],
  };
}

// ─── Lines Edify couldn't link to the order ─────────────────────────────────

/**
 * What the person said each unsure line is: an order line's id, or 'none'.
 * Order lines already picked, and the ones still in question, are hidden so
 * the same product is never asked about twice.
 */
function pairing(sample: Sample, answers: Answers) {
  const picked = new Map<string, string>();
  const waiting = new Set<string>();
  for (const l of sample.lines) {
    if (l.issue?.kind !== 'unsure') continue;
    const a = answers[l.id];
    if (a?.kind === 'unsure') picked.set(l.id, a.choice);
    else l.issue.candidates.forEach(id => waiting.add(id));
  }
  return { picked, hidden: new Set([...waiting, ...picked.values()]) };
}

/** An unsure line once answered: the order line it is, or a line on no order. */
function asPaired(sample: Sample, l: SeedLine, choice: string): SeedLine {
  if (choice === 'none') return { ...l, issue: { kind: 'extra', inCatalogue: !l.setup } };
  const o = sample.lines.find(x => x.id === choice);
  if (!o) return l;
  return { ...l, name: o.name, pack: o.pack, ordered: o.ordered, orderPrice: o.orderPrice, poNumber: o.poNumber, poLineId: o.poLineId ?? `${sample.id}-${o.id}`, issue: undefined, paired: true };
}

/** Every line as the person's answers leave it: what an unsure line was matched to replaces it. */
export function settledLines(sample: Sample, answers: Answers): SeedLine[] {
  const { picked, hidden } = pairing(sample, answers);
  return sample.lines.filter(l => !hidden.has(l.id)).map(l => (picked.has(l.id) ? asPaired(sample, l, picked.get(l.id)!) : l));
}

/** Which product on the order an unsure line is. Edify's guess comes first but is never picked for the person. */
function unsureIssue(sample: Sample, l: SeedLine, e: LineEdit, picked: Map<string, string>): Issue | null {
  if (l.issue?.kind !== 'unsure') return null;
  const seed = l.issue;
  const po = poFor(sample, l) ?? 'your order';
  const kind = sample.kind === 'invoice' ? 'invoice' : 'delivery note';
  const elsewhere = new Set([...picked].filter(([id]) => id !== l.id).map(([, c]) => c));
  const open = sample.lines.filter(x => x.notOnPaper && !elsewhere.has(x.id));
  const rank = (id: string) => (seed.candidates.includes(id) ? seed.candidates.indexOf(id) : seed.candidates.length);
  const likely = seed.candidates.length === 1 ? 'Most likely' : 'Could be';
  const guess = seed.candidates.length === 1 ? open.find(x => x.id === seed.candidates[0]) : undefined;
  return {
    kind: 'unsure',
    title: `\u201c${l.printed}\u201d`,
    detail: `Got ${e.got}. ${seed.why}`,
    choices: [
      ...[...open]
        .sort((a, b) => rank(a.id) - rank(b.id))
        .map(x => ({
          id: x.id,
          label: x.name,
          detail: `Ordered ${x.ordered} \u00b7 ${x.pack}`,
          group: seed.candidates.includes(x.id) ? likely : `Also on ${po}, not on the ${kind}`,
        })),
      { id: 'none', label: `It isn\u2019t on ${po}`, detail: 'Keep it as an extra, or send it back' },
    ],
    guess: guess && { id: guess.id, label: guess.name },
    hint: seed.candidates.length > 1 ? 'The one you don\u2019t pick shows as not delivered.' : undefined,
  };
}

/** Whether an answer adds something to Edify that has to be set up first. */
export function setupFor(item: CheckItem, choiceId: string | undefined): 'product' | 'supplier' | null {
  if (!choiceId) return null;
  const k = item.issue.kind;
  if (k === 'new-supplier') return 'supplier';
  if (!item.line?.setup) return null;
  if ((k === 'substitute' || k === 'extra') && choiceId === 'keep') return 'product';
  if (k === 'new-product' && choiceId === 'add') return 'product';
  return null;
}

export function setupDone(item: CheckItem, setups: Setups): boolean {
  if (item.issue.kind === 'new-supplier') return !!setups.supplier;
  return !!(item.line && setups.products[item.line.id]);
}

/** Price per kg, L or item, for showing what a pack really costs. */
/** As on the product page: pack cost ÷ pack quantity. */
export function unitCost(p: Pick<ProductSeed, 'packCost' | 'packQty'>): string {
  return p.packQty > 0 && p.packCost > 0 ? gbp(p.packCost / p.packQty) : '\u2014';
}

/** "Pack of 6 × 125g", "1L carton", "30g packet". */
export function packWords(p: ProductSeed): string {
  const size = p.unitSize && p.unitOfMeasure && UOM_SHORT[p.unitOfMeasure] ? `${p.unitSize}${UOM_SHORT[p.unitOfMeasure]}` : '';
  const single = /^(Each|Item)$/.test(p.singleUnitType) ? '' : unitTypeLabel(p.singleUnitType).toLowerCase();
  const item = [size, single].filter(Boolean).join(' ') || 'item';
  return p.packQty > 1 ? `${unitTypeLabel(p.packType)} of ${p.packQty} \u00d7 ${item}` : item;
}

export interface CheckItem {
  key: string;
  line?: SeedLine;
  issue: Issue;
}

export interface ReviewState {
  toCheck: CheckItem[];
  matches: SeedLine[];
  /** Lines shown, across To check and Matches. */
  lineCount: number;
  /** Items still without an answer. */
  open: number;
  credit: number;
}

/** The answer in force for an item: the person's, else Edify's suggestion. */
export function answerFor(answers: Answers, item: CheckItem): string | undefined {
  const a = answers[item.key];
  if (a && a.kind === item.issue.kind) return a.choice;
  return item.issue.suggested;
}

export function isSuggested(answers: Answers, item: CheckItem): boolean {
  const a = answers[item.key];
  return !!item.issue.suggested && !(a && a.kind === item.issue.kind);
}

export function review(sample: Sample, edits: Record<string, LineEdit>, answers: Answers, setups: Setups = NO_SETUPS): ReviewState {
  const toCheck: CheckItem[] = [];
  const matches: SeedLine[] = [];
  const order = orderIssue(sample);
  if (order) toCheck.push({ key: ORDER_KEY, issue: order });
  const sup = supplierIssue(sample);
  if (sup) toCheck.push({ key: SUPPLIER_KEY, issue: sup });
  const { picked, hidden } = pairing(sample, answers);
  for (const l of sample.lines) {
    if (hidden.has(l.id)) continue;
    const pair = unsureIssue(sample, l, edits[l.id], picked);
    if (pair) {
      toCheck.push({ key: l.id, line: l, issue: pair });
      const choice = picked.get(l.id);
      const then = choice ? asPaired(sample, l, choice) : null;
      const next = then && lineIssue(sample, then, edits[l.id]);
      if (then && next) toCheck.push({ key: `${l.id}:${choice}`, line: then, issue: next });
      continue;
    }
    const issue = lineIssue(sample, l, edits[l.id]);
    if (issue) toCheck.push({ key: l.id, line: l, issue });
    else matches.push(l);
  }
  let open = 0;
  let credit = 0;
  for (const item of toCheck) {
    const choice = item.issue.choices.find(c => c.id === answerFor(answers, item));
    if (!choice || (setupFor(item, choice.id) && !setupDone(item, setups))) open++;
    else credit += choice.credit ?? 0;
  }
  const lineCount = new Set([...toCheck.flatMap(i => (i.line ? [i.line.id] : [])), ...matches.map(l => l.id)]).size;
  return { toCheck, matches, lineCount, open, credit };
}

export function acceptLabel(sample: Sample, r: ReviewState): string {
  if (r.open > 0) return `${r.open} to check`;
  if (r.credit > 0) return `Accept and ask for ${gbp(r.credit)} credit`;
  return sample.kind === 'receipt' ? 'Accept receipt' : 'Accept delivery';
}

/** One sentence per thing that happened, for the done screen. */
export function outcomes(sample: Sample, edits: Record<string, LineEdit>, answers: Answers, setups: Setups = NO_SETUPS): string[] {
  const r = review(sample, edits, answers, setups);
  const masterOf = (l: SeedLine | undefined, fallback: string) => (l && setups.products[l.id]?.master) || fallback;
  const out: string[] = [];
  const n = r.matches.length;
  if (sample.kind === 'receipt' || hasNoOrder(sample)) {
    if (n > 0) out.push(`${n} ${n === 1 ? 'line' : 'lines'} linked to your products.`);
  } else if (n > 0) {
    out.push(r.toCheck.length === 0 ? `All ${n} lines received as ordered.` : `${n} ${n === 1 ? 'line' : 'lines'} received as ordered.`);
  }
  for (const item of r.toCheck) {
    const choice = item.issue.choices.find(c => c.id === answerFor(answers, item));
    if (!choice) continue;
    const l = item.line;
    const e = l ? edits[l.id] : undefined;
    const credit = choice.credit != null ? gbp(choice.credit) : '';
    const name = l?.name ?? item.issue.title;
    switch (item.issue.kind) {
      case 'new-supplier':
        out.push(`${setups.supplier?.name ?? sample.supplier} added as a shop. No ordering.`);
        break;
      case 'no-order':
        out.push(`Received with no order from ${sample.supplier}, costed at your prices.`);
        break;
      case 'short':
        if (!l || !e || l.ordered == null) break;
        if (choice.id === 'credit') out.push(`${name}: ${e.got} received, ${credit} credit requested from ${sample.supplier}.`);
        else if (e.got === 0) out.push(choice.id === 'later' ? `${name}: none received, all ${l.ordered} stay on ${poFor(sample, l)}.` : `${name}: none received, closed.`);
        else if (choice.id === 'later') out.push(`${name}: ${e.got} received, the other ${l.ordered - e.got} stay on ${poFor(sample, l)}.`);
        else out.push(`${name}: ${e.got} received, closed short.`);
        break;
      case 'over':
        if (!l || !e || l.ordered == null) break;
        out.push(choice.id === 'keep' ? `${name}: all ${e.got} kept.` : `${name}: ${l.ordered} received, ${e.got - l.ordered} sent back.`);
        break;
      case 'damaged': {
        if (!l || !e) break;
        const missing = l.ordered != null ? Math.max(0, l.ordered - e.got) : 0;
        const what = `${name}: ${e.got - e.damaged} received, ${e.damaged} sent back damaged${missing ? `, ${missing} short` : ''}.`;
        out.push(choice.id === 'credit' ? `${what} ${credit} credit requested.` : `${what} ${e.damaged + missing} more expected next delivery.`);
        break;
      }
      case 'wrong':
        out.push(choice.id === 'return' ? `${name}: sent back, ${credit} credit requested.` : `${name}: kept, though it isn\u2019t what you ordered.`);
        break;
      case 'price':
        if (!l) break;
        out.push(
          choice.id === 'pay'
            ? `${name}: your price is now ${gbp(l.price ?? 0)}.`
            : choice.id === 'once'
              ? `${name}: ${gbp(l.price ?? 0)} on this delivery only. Your price stays ${gbp(l.orderPrice ?? 0)}.`
              : `${name}: ${credit} credit requested for the price difference.`,
        );
        break;
      case 'substitute': {
        const s = l?.issue?.kind === 'substitute' ? l.issue : null;
        if (!s) break;
        out.push(
          choice.id === 'keep'
            ? `${s.sentName} received in place of ${name}${s.inCatalogue ? '' : `, added to your catalogue under ${masterOf(l, s.master)}`}.`
            : `${s.sentName} sent back${credit ? `, ${credit} credit requested` : ''}.`,
        );
        break;
      }
      case 'extra':
        if (!e || l?.issue?.kind !== 'extra') break;
        out.push(
          choice.id === 'keep'
            ? `${name}: ${e.got} kept${l.issue.inCatalogue ? '' : `, added to your catalogue under ${masterOf(l, name)}`}.`
            : `${name}: sent back${credit ? `, ${credit} credit requested` : ''}.`,
        );
        break;
      case 'which-po': {
        if (l?.issue?.kind !== 'which-po' || !e) break;
        const split = splitAcrossOrders(l.issue.options, e.got);
        const owed = split.filter(o => o.owed > 0);
        const missing = owed.reduce((n, o) => n + o.owed, 0);
        const short = owed.map(o => `${o.label} (${o.poNumber})`).join(' and ');
        out.push(choice.id === 'close' ? `${name}: ${e.got} received. The ${short} is closed ${missing} short.` : `${name}: ${e.got} received. The ${short} stays open for ${missing}.`);
        break;
      }
      case 'new-product':
        out.push(choice.id === 'add' ? `${name}: added to your catalogue under ${masterOf(l, name)}.` : `${name}: left out of stock.`);
        break;
      case 'unsure': {
        const o = sample.lines.find(x => x.id === choice.id);
        if (!l || !e || !o) break;
        const asked = r.toCheck.some(i => i.key === `${l.id}:${choice.id}`);
        out.push(asked ? `\u201c${l.printed}\u201d matched to ${o.name}.` : `${o.name}: ${e.got} received, matched by you to \u201c${l.printed}\u201d.`);
        break;
      }
    }
  }
  if (sample.kind === 'receipt') out.push('Marked off-contract, so it shows in off-contract spend.');
  return out;
}

// ─── "Tell Edify a change" ──────────────────────────────────────────────────

const STOP = new Set([
  'x', 'of', 'the', 'a', 'an', 'only', 'just', 'and', 'are', 'is', 'were', 'was', 'we', 'got', 'came', 'arrived',
  'pack', 'packs', 'tray', 'trays', 'bottle', 'bottles', 'box', 'boxes', 'case', 'cases', 'bag', 'bags',
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(t => t && !STOP.has(t))
    .map(t => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));
}

function findLine(lines: SeedLine[], query: string): SeedLine | null {
  const q = tokens(query);
  if (q.length === 0) return null;
  let best: SeedLine | null = null;
  let bestScore = 0;
  let tie = false;
  for (const l of lines) {
    const words = new Set(tokens(`${l.name} ${l.printed}`));
    const score = q.filter(t => words.has(t)).length;
    if (score > bestScore) {
      best = l;
      bestScore = score;
      tie = false;
    } else if (score === bestScore && score > 0) {
      tie = true;
    }
  }
  return bestScore > 0 && !tie ? best : null;
}

export type ParsedChange = { ok: true; lineId: string; patch: Partial<LineEdit>; say: string } | { ok: false; say: string };

const DAMAGE = '(?:broken|damaged|smashed|split|leaking|crushed|off)';

export function parseChange(text: string, lines: SeedLine[], edits: Record<string, LineEdit>): ParsedChange {
  const t = text.trim().toLowerCase();
  if (!t) return { ok: false, say: '' };
  const tryLine = (q: string) => findLine(lines, q);
  const miss = { ok: false as const, say: 'I couldn\u2019t tell which line that is. Try the product name, like \u201conly 3 eggs\u201d.' };

  let m = t.match(new RegExp(`^(\\d+)\\s+(.+?)\\s+(?:are\\s+|were\\s+|is\\s+)?${DAMAGE}$`)) ?? null;
  let qty: number | null = null;
  let query = '';
  if (m) {
    qty = Number(m[1]);
    query = m[2];
  } else if ((m = t.match(new RegExp(`^(\\d+)\\s+${DAMAGE}\\s+(.+)$`)))) {
    qty = Number(m[1]);
    query = m[2];
  }
  if (qty != null) {
    const l = tryLine(query);
    if (!l) return miss;
    const got = edits[l.id].got;
    const n = Math.min(qty, got);
    return { ok: true, lineId: l.id, patch: { damaged: n }, say: `${l.name}: ${n} damaged.` };
  }

  if ((m = t.match(/^(?:no|missing)\s+(.+)$/)) || (m = t.match(/^(.+?)\s+(?:didn'?t come|missing|not delivered|never came)$/))) {
    const l = tryLine(m[1]);
    if (!l) return miss;
    return { ok: true, lineId: l.id, patch: { got: 0, damaged: 0 }, say: `${l.name}: none arrived.` };
  }

  if ((m = t.match(/^(?:only\s+|just\s+)?(\d+)\s+(.+)$/))) {
    qty = Number(m[1]);
    query = m[2];
  } else if ((m = t.match(/^(.+?)\s+(\d+)$/))) {
    qty = Number(m[2]);
    query = m[1];
  }
  if (qty != null) {
    const l = tryLine(query);
    if (!l) return miss;
    return { ok: true, lineId: l.id, patch: { got: qty, damaged: Math.min(edits[l.id].damaged, qty) }, say: `${l.name}: ${qty} arrived.` };
  }

  return { ok: false, say: 'Try something like \u201conly 3 eggs\u201d or \u201c2 eggs broken\u201d.' };
}

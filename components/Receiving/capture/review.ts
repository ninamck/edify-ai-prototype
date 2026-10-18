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
  | 'new-supplier';

export interface Choice {
  id: string;
  label: string;
  /** Shown under the label when this choice is picked. */
  note?: string;
  credit?: number;
}

export interface Issue {
  kind: IssueKind;
  title: string;
  detail: string;
  choices: Choice[];
  suggested?: string;
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

const PRICE_TOLERANCE = 0.02;

export function gbp(n: number): string {
  return `£${n.toFixed(2)}`;
}

export function hasPrices(sample: Sample): boolean {
  return sample.kind === 'invoice' || sample.kind === 'receipt';
}

export function freshEdits(sample: Sample): Record<string, LineEdit> {
  return Object.fromEntries(sample.lines.map(l => [l.id, { got: l.got, damaged: 0, wrong: false }]));
}

function unitPrice(l: SeedLine): number {
  return l.price ?? l.orderPrice ?? 0;
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
      detail: `Not on ${po}. Got ${e.got}${at}.`,
      choices: [
        { id: 'keep', label: seed.inCatalogue ? 'Keep it' : 'Keep it, add to your catalogue' },
        priced
          ? { id: 'return', label: `Send back, ask for ${gbp(e.got * price)} credit`, credit: e.got * price }
          : { id: 'return', label: 'Send it back' },
      ],
    };
  }

  if (seed?.kind === 'which-po') {
    return {
      kind: 'which-po',
      title: l.name,
      detail: `Got ${e.got}. It\u2019s on both orders, and the one you don\u2019t pick stays open.`,
      choices: seed.options.map(o => ({ id: o.poNumber, label: `${o.poNumber}, ${o.label}` })),
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
      choices:
        diff > 0
          ? [
              { id: 'pay', label: `Pay ${gbp(l.price)} and update your price` },
              { id: 'credit', label: `Pay ${gbp(l.orderPrice)}, ask for ${gbp(diff * e.got)} credit`, credit: diff * e.got },
            ]
          : [
              { id: 'pay', label: `Pay ${gbp(l.price)} and update your price` },
              { id: 'once', label: `Pay ${gbp(l.price)} this time only` },
            ],
    };
  }

  return null;
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
export function unitCost(p: ProductSeed): string {
  const items = p.packQty * p.unitSize;
  if (items <= 0) return '';
  if (p.unitType === 'Each') return `${gbp(p.packCost / p.packQty)} each`;
  if (p.unitType === 'g') return `${gbp((p.packCost / items) * 1000)} per kg`;
  if (p.unitType === 'ml') return `${gbp((p.packCost / items) * 1000)} per L`;
  return `${gbp(p.packCost / items)} per ${p.unitType}`;
}

export function packWords(p: ProductSeed): string {
  const size = p.unitType === 'Each' ? 'item' : `${p.unitSize}${p.unitType}`;
  return p.packType === 'Single' ? (p.unitType === 'Each' ? 'Single item' : size) : `Pack of ${p.packQty} \u00d7 ${size}`;
}

export interface CheckItem {
  key: string;
  line?: SeedLine;
  issue: Issue;
}

export interface ReviewState {
  toCheck: CheckItem[];
  matches: SeedLine[];
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
  const sup = supplierIssue(sample);
  if (sup) toCheck.push({ key: SUPPLIER_KEY, issue: sup });
  for (const l of sample.lines) {
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
  return { toCheck, matches, open, credit };
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
  if (sample.kind === 'receipt') {
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
    const name = item.issue.title;
    switch (item.issue.kind) {
      case 'new-supplier':
        out.push(`${setups.supplier?.name ?? sample.supplier} added as a shop. No ordering.`);
        break;
      case 'short':
        if (!l || !e || l.ordered == null) break;
        if (choice.id === 'credit') out.push(`${name}: ${e.got} received, ${credit} credit requested from ${sample.supplier}.`);
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
            ? `${name}: paid at ${gbp(l.price ?? 0)}, your price is updated.`
            : choice.id === 'once'
              ? `${name}: paid at ${gbp(l.price ?? 0)} this time.`
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
        const other = l.issue.options.find(o => o.poNumber !== choice.id);
        out.push(`${name}: received on ${choice.id}.${other ? ` ${other.poNumber} stays open for ${other.ordered}.` : ''}`);
        break;
      }
      case 'new-product':
        out.push(choice.id === 'add' ? `${name}: added to your catalogue under ${masterOf(l, name)}.` : `${name}: left out of stock.`);
        break;
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

/**
 * Voice stocktake engine: the data model, unit vocabulary, utterance
 * parser and session reducer behind the GM-led voice count.
 *
 * Pure functions only. Keep this file free of runtime imports (type-only
 * imports are fine) so `node scripts/check-voice-parser.mjs` can load it
 * directly with Node's TypeScript type stripping.
 *
 * Business rules this file owns:
 *   • Silence is not zero. An item never mentioned has no capture. Only
 *     "none", "no X", "zero X", "out of X" or a confirmed "None in stock"
 *     write a 0.
 *   • Any order. An utterance can name any item in the session; the
 *     current area wins ties, and an item that lives in another area is
 *     asked about, never silently written.
 *   • Naming an item again replaces its count ("the gruyère is five
 *     kilos"). "more" / "another" / "plus" adds to it instead.
 *   • Quantities are stored per unit cell (the same cells the grid
 *     uses), so voice and grid share one count.
 */

import type { StockItem } from '../status';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoiceUnit {
  /** Grid cell suffix: the unit (`cases`) or `${variantId}::${unit}`. */
  cell: string;
  /** Unit as stored on the item (`cases`, `kg`, `tray`). */
  key: string;
  one: string;
  many: string;
  /** How many of the item's stock unit one of these is. */
  toBase: number;
  /** Stemmed spoken forms. */
  words: string[];
  metric: boolean;
  variantLabel?: string;
}

export interface VoiceItem {
  id: string;
  name: string;
  packLine: string;
  areaId: string;
  /** The item's stock unit. Counts display in this first. */
  base: VoiceUnit;
  units: VoiceUnit[];
  /** Stemmed token sequences that name this item outright. */
  phrases: string[][];
  /** Single stemmed tokens that hint at this item ("milk"). */
  weak: string[];
  /** False when the item has no counting unit set up yet. */
  countable: boolean;
}

export interface VoiceArea {
  id: string;
  name: string;
  walkOrder: number;
  items: VoiceItem[];
  /** Stemmed token sequences that name the area ("dry store", "dry"). */
  phrases: string[][];
}

export interface RawQty {
  qty: number;
  /** Stemmed unit word, when one was said. */
  unit?: string;
}

export interface CapturePart {
  cell: string;
  qty: number;
}

export type CaptureSource = 'voice' | 'grid' | 'seed';

export interface Capture {
  itemId: string;
  utterance: string;
  parts: CapturePart[];
  /** Total in the item's stock unit. */
  baseQty: number;
  status: 'counted' | 'none';
  at: string;
  source: CaptureSource;
}

/**
 *   which      several items match ("four litres of milk")
 *   otherArea  the item lives in another storage area
 *   unit       the item isn't counted in the unit that was said
 */
export type QuestionKind = 'which' | 'otherArea' | 'unit';

export interface Question {
  id: string;
  kind: QuestionKind;
  areaId: string;
  utterance: string;
  /** Item ids for which / otherArea, unit cells for unit. */
  candidates: string[];
  itemId?: string;
  raws: RawQty[];
  add: boolean;
  at: string;
}

export type LastEvent = { kind: 'capture'; itemId: string } | { kind: 'question'; id: string };

export interface Session {
  captures: Record<string, Capture>;
  questions: Question[];
  /** areaId → ISO time the GM finished the area. */
  finished: Record<string, string>;
  /** areaId → utterances recorded offline, waiting to be parsed. */
  queued: Record<string, string[]>;
  currentAreaId?: string;
  last?: LastEvent;
}

export function emptySession(): Session {
  return { captures: {}, questions: [], finished: {}, queued: {} };
}

// ─── Text ─────────────────────────────────────────────────────────────────────

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b\d+\s?oz\b/g, ' ')
    .replace(/(\d),(\d{3})/g, '$1$2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/['\u2019]/g, '')
    .replace(/(\d)\.(\d)/g, '$1\u00a7$2')
    .replace(/[^a-z0-9\u00a7\s]/g, ' ')
    .replace(/\u00a7/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stem(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.endsWith('oes')) return w.slice(0, -2);
  if (/(ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('ves')) return `${w.slice(0, -3)}f`;
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function tokens(text: string): string[] {
  const n = normalise(text);
  return n ? n.split(' ') : [];
}

function stems(text: string): string[] {
  return tokens(text).map(stem);
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

// ─── Units ────────────────────────────────────────────────────────────────────

interface UnitWords {
  one: string;
  many: string;
  words: string[];
  metric?: 'mass' | 'volume';
  factor?: number;
}

const UNIT_VOCAB: Record<string, UnitWords> = {
  kg: { one: 'kg', many: 'kg', words: ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms', 'k'], metric: 'mass', factor: 1 },
  g: { one: 'g', many: 'g', words: ['g', 'gram', 'grams'], metric: 'mass', factor: 0.001 },
  l: { one: 'litre', many: 'litres', words: ['l', 'litre', 'litres', 'liter', 'liters', 'ltr'], metric: 'volume', factor: 1 },
  ml: { one: 'ml', many: 'ml', words: ['ml', 'mil', 'mils', 'millilitre', 'millilitres', 'milliliter'], metric: 'volume', factor: 0.001 },
  can: { one: 'can', many: 'cans', words: ['can', 'cans', 'tin', 'tins'] },
  case: { one: 'case', many: 'cases', words: ['case', 'cases', 'crate', 'crates'] },
  bottle: { one: 'bottle', many: 'bottles', words: ['bottle', 'bottles'] },
  unit: { one: 'unit', many: 'units', words: ['unit', 'units', 'each', 'single', 'singles', 'loose'] },
  each: { one: 'each', many: 'each', words: ['each', 'unit', 'units', 'single', 'singles', 'loose'] },
  tray: { one: 'tray', many: 'trays', words: ['tray', 'trays'] },
  box: { one: 'box', many: 'boxes', words: ['box', 'boxes'] },
  bag: { one: 'bag', many: 'bags', words: ['bag', 'bags'] },
  pack: { one: 'pack', many: 'packs', words: ['pack', 'packs', 'packet', 'packets'] },
  sleeve: { one: 'sleeve', many: 'sleeves', words: ['sleeve', 'sleeves'] },
  loaf: { one: 'loaf', many: 'loaves', words: ['loaf', 'loaves'] },
  head: { one: 'head', many: 'heads', words: ['head', 'heads'] },
  punnet: { one: 'punnet', many: 'punnets', words: ['punnet', 'punnets'] },
  jar: { one: 'jar', many: 'jars', words: ['jar', 'jars'] },
  sack: { one: 'sack', many: 'sacks', words: ['sack', 'sacks'] },
  portion: { one: 'portion', many: 'portions', words: ['portion', 'portions', 'serving', 'servings'] },
  block: { one: 'block', many: 'blocks', words: ['block', 'blocks'] },
};

function vocabFor(key: string): UnitWords {
  const k = key.toLowerCase();
  const s = stem(k);
  return UNIT_VOCAB[k] ?? UNIT_VOCAB[s] ?? { one: s, many: k, words: [s, k] };
}

const LOOSE_KEYS = new Set(['unit', 'units', 'each']);

/** Every stemmed word that can name a unit, across all items. */
const ALL_UNIT_STEMS = new Set(
  Object.values(UNIT_VOCAB).flatMap(v => v.words.map(stem)),
);

// ─── Item vocabulary ──────────────────────────────────────────────────────────
// Keyed by `aliasKey(item.id)`, so one entry covers the same item at every
// Fitzroy site (`fe-coke`, `kx-coke`, … and `ing-kx-oatmilk` → `ing-oatmilk`).

export function aliasKey(id: string): string {
  return id.replace(/^(fe|kx|hr|is)-/, '').replace(/^ing-(kx|hr|is)-/, 'ing-');
}

const ALIASES: Record<string, string[]> = {
  coke: ['coke', 'coca cola', 'cola', 'full fat coke'],
  'coke-diet': ['diet coke', 'diet'],
  sparkling: ['sparkling', 'sparkling water', 'fizzy water'],
  'still-water': ['still', 'still water'],
  oj: ['oj', 'orange', 'orange juice'],
  aj: ['apple', 'apple juice'],
  'almond-milk': ['almond', 'almond milk'],
  'espresso-beans': ['beans', 'coffee beans', 'espresso', 'coffee'],
  'whole-milk': ['whole milk', 'full fat milk', 'blue milk'],
  'greek-yogurt': ['yogurt', 'yoghurt', 'greek yogurt', 'greek yoghurt'],
  butter: ['butter'],
  cheddar: ['cheddar'],
  eggs: ['egg', 'eggs'],
  sourdough: ['sourdough'],
  multigrain: ['multigrain'],
  bagels: ['bagel', 'bagels'],
  muffins: ['muffin', 'muffins', 'blueberry muffins'],
  'cherry-toms': ['cherry tomatoes', 'tomatoes', 'toms', 'cherry toms'],
  romaine: ['romaine', 'lettuce'],
  cucumber: ['cucumber'],
  lemon: ['lemon', 'lemons'],
  bananas: ['banana', 'bananas'],
  berries: ['berries', 'mixed berries'],
  'smoked-salmon': ['salmon', 'smoked salmon'],
  bacon: ['bacon', 'streaky'],
  penne: ['penne', 'pasta'],
  basmati: ['rice', 'basmati'],
  mayo: ['mayo', 'mayonnaise'],
  dijon: ['dijon', 'mustard'],
  'tea-eb': ['tea', 'tea bags', 'english breakfast'],
  'cups-12': ['cups', 'coffee cups'],
  'lids-12': ['lids', 'cup lids'],
  'paper-bags': ['paper bags'],
  'hand-soap': ['soap', 'hand soap'],
  sanitiser: ['sanitiser', 'sanitizer', 'surface spray', 'spray'],
  'hummus-base': ['hummus'],
  'caesar-wrap': ['caesar wrap', 'wraps', 'caesar'],
  'ing-oatmilk': ['oat milk', 'oat', 'califia'],
  'ing-croissants': ['croissant', 'croissants'],
  'ing-spinach': ['spinach'],
  'ing-chicken': ['chicken', 'chicken breast'],
  'ing-gruyere': ['gruyere'],
  'ing-coconut-milk': ['coconut', 'coconut milk'],
  'ing-cream': ['cream', 'whipping cream', 'double cream'],
  'ing-tomato-paste': ['tomato paste', 'paste', 'puree', 'tomato puree'],
  'ing-tomato': ['tomato paste', 'paste', 'puree', 'tomato puree'],
  'ing-vanilla': ['vanilla extract', 'vanilla'],
  'mp-olive-oil': ['olive oil', 'oil'],
  'ing-flour': ['flour', 'bread flour'],
  'sr-pesto-base': ['pesto'],
  'rc-chicken-avo': ['sandwich', 'sandwiches', 'chicken avo'],
  'ing-avocado': ['avocado', 'avocados', 'avo', 'avos'],
  'mp-avocado': ['avocado', 'avocados', 'avo', 'avos'],
  'mp-cup-lids': ['lids', 'cup lids'],
  'mp-mozzarella': ['mozzarella', 'mozz'],
  'mp-vanilla-ice-cream': ['ice cream', 'vanilla ice cream'],
  'ing-doughnuts': ['doughnut', 'doughnuts', 'donut', 'donuts'],
  'ing-evoo': ['olive oil', 'evoo', 'extra virgin'],
  'ing-butter': ['butter'],
};

/** What a loose unit is called for this item: "66 eggs", not "66 units". */
const COUNT_NOUNS: Record<string, { one: string; many: string; words?: string[] }> = {
  eggs: { one: 'egg', many: 'eggs' },
  'ing-avocado': { one: 'avocado', many: 'avocados' },
  'mp-avocado': { one: 'avocado', many: 'avocados' },
  lemon: { one: 'lemon', many: 'lemons' },
  cucumber: { one: 'cucumber', many: 'cucumbers' },
  muffins: { one: 'muffin', many: 'muffins' },
  bagels: { one: 'bagel', many: 'bagels' },
  'ing-croissants': { one: 'croissant', many: 'croissants' },
  'ing-doughnuts': { one: 'doughnut', many: 'doughnuts' },
  'ing-coconut-milk': { one: 'tin', many: 'tins' },
  'ing-tomato-paste': { one: 'tin', many: 'tins' },
  'ing-tomato': { one: 'tin', many: 'tins' },
  'ing-vanilla': { one: 'bottle', many: 'bottles' },
  sourdough: { one: 'loaf', many: 'loaves' },
  multigrain: { one: 'loaf', many: 'loaves' },
  romaine: { one: 'head', many: 'heads' },
  'tea-eb': { one: 'tea bag', many: 'tea bags', words: ['bag', 'bags'] },
  'cups-12': { one: 'cup', many: 'cups' },
  'lids-12': { one: 'lid', many: 'lids' },
  'mp-cup-lids': { one: 'lid', many: 'lids' },
  'paper-bags': { one: 'bag', many: 'bags' },
  'caesar-wrap': { one: 'wrap', many: 'wraps' },
  'rc-chicken-avo': { one: 'sandwich', many: 'sandwiches' },
  sanitiser: { one: 'bottle', many: 'bottles' },
};

/** Name words too generic to point at an item on their own. */
const WEAK_STOP = new Set([
  'of', 'the', 'and', 'with', 'for', 'free', 'range', 'large', 'medium', 'small',
  'classic', 'house', 'base', 'mixed', 'plain', 'extra', 'fresh', 'whole', 'baby',
]);

// ─── Numbers ──────────────────────────────────────────────────────────────────

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
};
const TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const ZERO_WORDS = new Set(['no', 'none', 'nothing', 'nil']);
const DIGITS = /^\d+(\.\d+)?$/;

function isNumberWord(w: string | undefined): boolean {
  if (w === undefined) return false;
  return DIGITS.test(w) || w in ONES || w in TEENS || w in TENS || ZERO_WORDS.has(w)
    || w === 'half' || w === 'dozen' || w === 'couple' || w === 'hundred';
}

interface NumRead {
  value: number;
  len: number;
  /** "a" / "an": only a number when a unit follows ("a case"). */
  article: boolean;
}

function readNumber(t: string[], i: number): NumRead | null {
  const w = t[i];
  if (w === undefined) return null;
  if (ZERO_WORDS.has(w)) return { value: 0, len: 1, article: false };
  if (w === 'out' && t[i + 1] === 'of') return { value: 0, len: 2, article: false };
  if (w === 'half') return { value: 0.5, len: t[i + 1] === 'a' || t[i + 1] === 'an' ? 2 : 1, article: false };
  if (w === 'couple') return { value: 2, len: t[i + 1] === 'of' ? 2 : 1, article: false };

  let j = i;
  let total = 0;
  let chunk = 0;
  let seen = false;
  let last: 'digit' | 'ones' | 'teen' | 'tens' | 'hundred' | null = null;

  if (w === 'a' || w === 'an') {
    const n = t[i + 1];
    if (n === 'half') return { value: 0.5, len: 2, article: false };
    if (n === 'dozen') return { value: 12, len: 2, article: false };
    if (n === 'couple') return { value: 2, len: t[i + 2] === 'of' ? 3 : 2, article: false };
    if (n !== 'hundred' && n !== 'thousand') return { value: 1, len: 1, article: true };
    chunk = 1;
    seen = true;
    last = 'ones';
    j = i + 1;
  }

  while (j < t.length) {
    const tok = t[j];
    if (DIGITS.test(tok)) {
      if (seen) break;
      chunk = Number.parseFloat(tok);
      seen = true;
      last = 'digit';
    } else if (tok in ONES) {
      if (seen && last !== 'tens' && last !== 'hundred') break;
      chunk += ONES[tok];
      seen = true;
      last = 'ones';
    } else if (tok in TEENS) {
      if (seen && last !== 'hundred') break;
      chunk += TEENS[tok];
      seen = true;
      last = 'teen';
    } else if (tok in TENS) {
      if (seen && last !== 'hundred') break;
      chunk += TENS[tok];
      seen = true;
      last = 'tens';
    } else if (tok === 'hundred' && seen && last !== 'hundred' && chunk < 100) {
      chunk = (chunk || 1) * 100;
      last = 'hundred';
    } else if (tok === 'thousand' && seen) {
      total += (chunk || 1) * 1000;
      chunk = 0;
      last = 'hundred';
    } else if (tok === 'and' && last === 'hundred' && (t[j + 1] ?? '') in { ...ONES, ...TEENS, ...TENS }) {
      // "a hundred and twenty"
    } else {
      break;
    }
    j += 1;
  }
  if (!seen) return null;
  let value = total + chunk;

  if (t[j] === 'point') {
    let k = j + 1;
    let frac = '';
    while (k < t.length && (t[k] in ONES || /^\d+$/.test(t[k]))) {
      frac += t[k] in ONES ? String(ONES[t[k]]) : t[k];
      k += 1;
    }
    if (frac) {
      value = Number.parseFloat(`${Math.floor(value)}.${frac}`);
      j = k;
    }
  }
  if (t[j] === 'and' && t[j + 1] === 'a' && t[j + 2] === 'half') {
    value += 0.5;
    j += 3;
  } else if (t[j] === 'and' && t[j + 1] === 'half') {
    value += 0.5;
    j += 2;
  }
  if (t[j] === 'dozen') {
    value *= 12;
    j += 1;
  }
  return { value, len: j - i, article: false };
}

/** Spoken form of small whole numbers, for scripted demo lines. */
export function numberWord(n: number): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  return Number.isInteger(n) && n >= 0 && n <= 20 ? words[n] : String(n);
}

// ─── Building voice items ─────────────────────────────────────────────────────

function toBaseFor(item: StockItem, key: string, conv?: Record<string, number>): number | null {
  if (key === item.stockUnit) return 1;
  const c = conv?.[key];
  if (c !== undefined && Number.isFinite(c) && c > 0) return c;
  const a = vocabFor(key);
  const b = vocabFor(item.stockUnit);
  if (a.metric && a.metric === b.metric && a.factor && b.factor) return a.factor / b.factor;
  return null;
}

function makeUnit(
  item: StockItem,
  key: string,
  cell: string,
  toBase: number,
  variantLabel?: string,
): VoiceUnit {
  const v = vocabFor(key);
  const noun = COUNT_NOUNS[aliasKey(item.id)];
  let one = v.one;
  let many = v.many;
  let words = [...v.words];
  if (LOOSE_KEYS.has(key.toLowerCase()) && noun) {
    one = noun.one;
    many = noun.many;
    words = [...words, ...(noun.words ?? [noun.one, noun.many])];
  }
  return {
    cell,
    key,
    one,
    many,
    toBase,
    words: uniq(words.map(normalise).filter(w => w && !w.includes(' ')).map(stem)),
    metric: Boolean(v.metric),
    variantLabel,
  };
}

function packLineFor(item: StockItem): string {
  const supplier = item.supplierName.replace(/\s+\u2014\s+/g, ' ').replace(/[()]/g, '').trim();
  const variant =
    item.type === 'master-product' && /master/i.test(item.variant) ? 'Master product' : item.variant;
  return `${variant} · ${supplier}`;
}

export function buildVoiceItem(item: StockItem, areaId: string): VoiceItem {
  const units: VoiceUnit[] = [];
  if (item.supplierVariants?.length) {
    for (const v of item.supplierVariants) {
      if (v.noCountingUnit) continue;
      for (const u of v.units) {
        const toBase = toBaseFor(item, u, v.conv);
        if (toBase !== null) units.push(makeUnit(item, u, `${v.id}::${u}`, toBase, v.label));
      }
    }
  } else {
    for (const u of [item.stockUnit, ...(item.alternateUnits ?? [])]) {
      const toBase = toBaseFor(item, u, item.unitConversions);
      if (toBase !== null) units.push(makeUnit(item, u, u, toBase));
    }
  }
  const base = units.find(u => u.toBase === 1) ?? makeUnit(item, item.stockUnit, item.stockUnit, 1);

  const aliases = ALIASES[aliasKey(item.id)] ?? [];
  const phrases = uniq([item.name, ...aliases].map(p => stems(p).join(' ')))
    .filter(Boolean)
    .map(p => p.split(' '));
  const weak = uniq(stems(item.name)).filter(
    w => w.length >= 3 && !WEAK_STOP.has(w) && !ALL_UNIT_STEMS.has(w) && !isNumberWord(w),
  );

  return {
    id: item.id,
    name: item.name,
    packLine: packLineFor(item),
    areaId,
    base,
    units,
    phrases,
    weak,
    countable: !item.noCountingUnit && units.length > 0,
  };
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

export function unitLabel(u: VoiceUnit, n: number): string {
  return n === 1 ? u.one : u.many;
}

/** The biggest pack this item comes in (case, tray, box), if any. */
export function largestPack(item: VoiceItem): VoiceUnit | undefined {
  let best: VoiceUnit | undefined;
  for (const u of item.units) {
    if (!u.metric && u.toBase > 1 && (!best || u.toBase > best.toBase)) best = u;
  }
  return best;
}

/** "16 cans" with "2.67 cases" underneath: stock unit first, then the
 *  largest pack as a decimal. */
export function describeQty(item: VoiceItem, baseQty: number): { primary: string; secondary?: string } {
  if (baseQty === 0) return { primary: 'None in stock' };
  const primary = `${fmtNum(baseQty)} ${unitLabel(item.base, baseQty)}`;
  const big = largestPack(item);
  if (!big) return { primary };
  const n = baseQty / big.toBase;
  return { primary, secondary: `${fmtNum(n)} ${unitLabel(big, n)}` };
}

export function describeParts(item: VoiceItem, parts: CapturePart[]): string {
  return parts
    .map(p => {
      const u = item.units.find(x => x.cell === p.cell) ?? item.base;
      return `${fmtNum(p.qty)} ${unitLabel(u, p.qty)}`;
    })
    .join(' + ');
}

// ─── Index ────────────────────────────────────────────────────────────────────

interface Phrase {
  tokens: string[];
  itemId: string;
  strong: boolean;
}

export interface VoiceIndex {
  items: Map<string, VoiceItem>;
  byFirst: Map<string, Phrase[]>;
  areas: VoiceArea[];
}

export function buildIndex(areas: VoiceArea[]): VoiceIndex {
  const items = new Map<string, VoiceItem>();
  const byFirst = new Map<string, Phrase[]>();
  const add = (p: Phrase) => {
    const list = byFirst.get(p.tokens[0]) ?? [];
    list.push(p);
    byFirst.set(p.tokens[0], list);
  };
  for (const area of areas) {
    for (const item of area.items) {
      items.set(item.id, item);
      for (const tokens of item.phrases) add({ tokens, itemId: item.id, strong: true });
      for (const w of item.weak) add({ tokens: [w], itemId: item.id, strong: false });
    }
  }
  return { items, byFirst, areas };
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

interface Mention {
  start: number;
  end: number;
  itemIds: string[];
}

interface QtyGroup extends RawQty {
  start: number;
  end: number;
}

function findMentions(st: string[], raw: string[], index: VoiceIndex): Mention[] {
  const out: Mention[] = [];
  let i = 0;
  while (i < st.length) {
    if (isNumberWord(raw[i])) {
      i += 1;
      continue;
    }
    let bestLen = 0;
    let bestStrong = false;
    let ids = new Set<string>();
    for (const p of index.byFirst.get(st[i]) ?? []) {
      const len = p.tokens.length;
      if (i + len > st.length) continue;
      if (!p.tokens.every((tok, k) => st[i + k] === tok)) continue;
      const better = (p.strong && !bestStrong) || (p.strong === bestStrong && len > bestLen);
      if (better) {
        bestLen = len;
        bestStrong = p.strong;
        ids = new Set([p.itemId]);
      } else if (p.strong === bestStrong && len === bestLen) {
        ids.add(p.itemId);
      }
    }
    if (bestLen > 0) {
      out.push({ start: i, end: i + bestLen, itemIds: Array.from(ids) });
      i += bestLen;
    } else {
      i += 1;
    }
  }
  return out;
}

function findQuantities(raw: string[], st: string[], mentions: Mention[]): QtyGroup[] {
  const covered = new Set<number>();
  for (const m of mentions) for (let k = m.start; k < m.end; k += 1) covered.add(k);
  const out: QtyGroup[] = [];
  let i = 0;
  while (i < raw.length) {
    if (covered.has(i)) {
      i += 1;
      continue;
    }
    const n = readNumber(raw, i);
    if (!n || n.len === 0) {
      i += 1;
      continue;
    }
    let j = i + n.len;
    let unit: string | undefined;
    if (j < raw.length && !covered.has(j) && ALL_UNIT_STEMS.has(st[j])) {
      unit = st[j];
      j += 1;
    }
    if (n.article && !unit) {
      i += 1;
      continue;
    }
    let qty = n.value;
    if (raw[j] === 'and' && raw[j + 1] === 'a' && raw[j + 2] === 'half') {
      qty += 0.5;
      j += 3;
    }
    out.push({ qty, unit, start: i, end: j });
    i = j;
  }
  return out;
}

export interface ParseContext {
  index: VoiceIndex;
  currentAreaId: string;
  /** Item a bare quantity applies to: the Guide me prompt, or an item
   *  the GM tapped "Count it" on. */
  targetItemId?: string;
  /** Candidates of open questions in this area, newest first. */
  openCandidates?: string[];
}

export type VoiceAction =
  | { kind: 'capture'; itemId: string; raws: RawQty[]; add: boolean }
  | { kind: 'which'; candidates: string[]; raws: RawQty[]; add: boolean }
  | { kind: 'otherArea'; itemId: string; raws: RawQty[]; add: boolean }
  | { kind: 'resolve'; itemId: string }
  | { kind: 'noQuantity'; itemId: string }
  | { kind: 'notCountable'; itemId: string }
  | { kind: 'correctLast'; raws: RawQty[] }
  | { kind: 'undo' }
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'skip' }
  | { kind: 'repeat' }
  | { kind: 'switchArea'; areaId: string }
  | { kind: 'nextArea' }
  | { kind: 'unheard' };

const PAUSE = /^(pause|stop listening|hold on|hang on)( please)?$/;
const RESUME = /^(resume|carry on|start listening|unpause|keep going|continue)( please)?$/;
const SKIP = /^(skip|skip it|skip that|skip this( one)?|next item|pass)$/;
const REPEAT = /^(repeat|repeat that|say again|say that again|what was that|again|pardon)$/;
const UNDO = /^(scrap that|cancel that|undo|undo that|delete that|forget that|scratch that|remove that)$/;
const NEXT_AREA = /^(next area|next section|next room|move on|on to the next( area)?|done here|area done)$/;
const SWITCH = /^(?:start|start on|go to|back to|switch to|move to|on to|onto|now|lets do|open)\s+(?:the\s+)?(.+?)(?:\s+(?:area|now|next|please))?$/;
const MAKE_THAT = /^(?:make|change)\s+(?:that|it)(?:\s+to)?\s+/;
const IT_IS = /^(?:its|it is|thats|that is|that was|should be)\s+/;
const ADD_WORDS = /\b(more|another|extra|plus)\b/;

function matchArea(text: string, index: VoiceIndex): string | null {
  const st = stems(text).filter(w => w !== 'the' && w !== 'area');
  const key = st.join(' ');
  if (!key) return null;
  for (const area of index.areas) {
    if (area.phrases.some(p => p.join(' ') === key)) return area.id;
  }
  return null;
}

export function parseUtterance(text: string, ctx: ParseContext): VoiceAction[] {
  let body = normalise(text);
  if (!body) return [{ kind: 'unheard' }];

  if (PAUSE.test(body)) return [{ kind: 'pause' }];
  if (RESUME.test(body)) return [{ kind: 'resume' }];
  if (SKIP.test(body)) return [{ kind: 'skip' }];
  if (REPEAT.test(body)) return [{ kind: 'repeat' }];
  if (NEXT_AREA.test(body)) return [{ kind: 'nextArea' }];

  const sw = SWITCH.exec(body);
  if (sw) {
    const areaId = matchArea(sw[1], ctx.index);
    if (areaId) return [{ kind: 'switchArea', areaId }];
  }
  const bareArea = matchArea(body, ctx.index);
  if (bareArea) return [{ kind: 'switchArea', areaId: bareArea }];

  // Corrections: "actually make that three", "no, three", "sorry, it's four".
  let correction = false;
  for (let pass = 0; pass < 3; pass += 1) {
    const before = body;
    body = body.replace(/^(actually|sorry|correction|wait)\s*/, m => {
      correction = true;
      return m ? '' : m;
    });
    const parts = body.split(' ');
    if (parts[0] === 'no' && parts.length > 1 && isNumberWord(parts[1])) {
      correction = true;
      body = parts.slice(1).join(' ');
    }
    if (MAKE_THAT.test(body)) {
      correction = true;
      body = body.replace(MAKE_THAT, '');
    }
    if (correction) body = body.replace(IT_IS, '');
    if (body === before) break;
  }
  if (!body) return [{ kind: 'unheard' }];
  if (UNDO.test(body)) return [{ kind: 'undo' }];

  const add = ADD_WORDS.test(body);
  const raw = body.split(' ');
  const st = raw.map(stem);
  const mentions = findMentions(st, raw, ctx.index);
  const groups = findQuantities(raw, st, mentions);

  if (mentions.length === 0) {
    const raws = groups.map(({ qty, unit }) => ({ qty, unit }));
    if (raws.length === 0) return [{ kind: 'unheard' }];
    if (correction) return [{ kind: 'correctLast', raws }];
    if (ctx.targetItemId) return [{ kind: 'capture', itemId: ctx.targetItemId, raws, add }];
    return [{ kind: 'unheard' }];
  }

  // Each mention takes the quantities said just before it; if none, the
  // ones said just after it (up to the next item).
  const used = new Set<number>();
  const assigned: QtyGroup[][] = mentions.map(() => []);
  mentions.forEach((m, mi) => {
    const prevEnd = mi > 0 ? mentions[mi - 1].end : 0;
    const nextStart = mi < mentions.length - 1 ? mentions[mi + 1].start : Number.POSITIVE_INFINITY;
    let mine = groups
      .map((g, gi) => ({ g, gi }))
      .filter(({ g, gi }) => !used.has(gi) && g.start >= prevEnd && g.end <= m.start);
    if (mine.length === 0) {
      mine = groups
        .map((g, gi) => ({ g, gi }))
        .filter(({ g, gi }) => !used.has(gi) && g.start >= m.end && g.end <= nextStart);
    }
    for (const { g, gi } of mine) {
      used.add(gi);
      assigned[mi].push(g);
    }
  });
  // Trailing compound parts: "two cases of coke and six cans".
  groups.forEach((g, gi) => {
    if (used.has(gi)) return;
    let owner = -1;
    mentions.forEach((m, mi) => {
      if (m.end <= g.start) owner = mi;
    });
    if (owner >= 0) {
      used.add(gi);
      assigned[owner].push(g);
    }
  });

  const actions: VoiceAction[] = [];
  mentions.forEach((m, mi) => {
    const raws = assigned[mi].map(({ qty, unit }) => ({ qty, unit }));
    const items = m.itemIds
      .map(id => ctx.index.items.get(id))
      .filter((x): x is VoiceItem => Boolean(x));
    let candidates = items.filter(i => i.countable);
    if (candidates.length === 0) {
      if (items[0]) actions.push({ kind: 'notCountable', itemId: items[0].id });
      return;
    }

    if (raws.length === 0) {
      const open = ctx.openCandidates ?? [];
      const hit = candidates.find(c => open.includes(c.id));
      if (hit) {
        actions.push({ kind: 'resolve', itemId: hit.id });
        return;
      }
      if (correction && ctx.targetItemId) return;
      const here = candidates.filter(c => c.areaId === ctx.currentAreaId);
      actions.push({ kind: 'noQuantity', itemId: (here[0] ?? candidates[0]).id });
      return;
    }

    const saidUnits = raws.map(r => r.unit).filter((u): u is string => Boolean(u));
    if (saidUnits.length) {
      const fit = candidates.filter(c => saidUnits.every(u => c.units.some(x => x.words.includes(u))));
      if (fit.length) candidates = fit;
    }
    if (ctx.targetItemId && candidates.some(c => c.id === ctx.targetItemId)) {
      candidates = candidates.filter(c => c.id === ctx.targetItemId);
    }
    const here = candidates.filter(c => c.areaId === ctx.currentAreaId);
    if (here.length) candidates = here;

    if (candidates.length === 1) {
      const only = candidates[0];
      actions.push(
        only.areaId === ctx.currentAreaId
          ? { kind: 'capture', itemId: only.id, raws, add }
          : { kind: 'otherArea', itemId: only.id, raws, add },
      );
    } else {
      actions.push({ kind: 'which', candidates: candidates.slice(0, 6).map(c => c.id), raws, add });
    }
  });
  return actions.length ? actions : [{ kind: 'unheard' }];
}

// ─── Applying actions to the session ──────────────────────────────────────────

export interface Heard {
  utterance: string;
  result: string;
  tone: 'ok' | 'ask' | 'miss';
}

export type VoiceCommand =
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'skip' }
  | { kind: 'repeat' }
  | { kind: 'switchArea'; areaId: string }
  | { kind: 'nextArea' };

export interface ApplyContext {
  index: VoiceIndex;
  currentAreaId: string;
  now: string;
  source?: CaptureSource;
}

export interface ApplyResult {
  session: Session;
  heard: Heard;
  /** Screen-reader announcements, one per capture. */
  announce: string[];
  /** A question Edify asks out loud. */
  speak?: string;
  commands: VoiceCommand[];
  capturedIds: string[];
}

type Resolved = { ok: true; parts: CapturePart[]; baseQty: number } | { ok: false; unit: string };

function resolveParts(item: VoiceItem, raws: RawQty[], fallbackCell?: string): Resolved {
  const byCell = new Map<string, number>();
  for (const r of raws) {
    let unit: VoiceUnit | undefined;
    if (r.unit) {
      unit = item.units.find(u => u.words.includes(r.unit as string));
      if (!unit && fallbackCell) unit = item.units.find(u => u.cell === fallbackCell);
      if (!unit) return { ok: false, unit: r.unit };
    } else {
      unit = (fallbackCell && item.units.find(u => u.cell === fallbackCell)) || item.base;
    }
    byCell.set(unit.cell, (byCell.get(unit.cell) ?? 0) + r.qty);
  }
  const parts = Array.from(byCell, ([cell, qty]) => ({ cell, qty }));
  return { ok: true, parts, baseQty: baseQtyOf(item, parts) };
}

function baseQtyOf(item: VoiceItem, parts: CapturePart[]): number {
  let total = 0;
  for (const p of parts) {
    const u = item.units.find(x => x.cell === p.cell);
    if (u) total += p.qty * u.toBase;
  }
  return Math.round(total * 1000) / 1000;
}

function mergeParts(a: CapturePart[], b: CapturePart[]): CapturePart[] {
  const byCell = new Map<string, number>();
  for (const p of [...a, ...b]) byCell.set(p.cell, (byCell.get(p.cell) ?? 0) + p.qty);
  return Array.from(byCell, ([cell, qty]) => ({ cell, qty }));
}

export function writeCapture(
  session: Session,
  item: VoiceItem,
  parts: CapturePart[],
  utterance: string,
  now: string,
  source: CaptureSource,
  add = false,
): Session {
  const existing = session.captures[item.id];
  const finalParts = add && existing ? mergeParts(existing.parts, parts) : parts;
  const baseQty = baseQtyOf(item, finalParts);
  const capture: Capture = {
    itemId: item.id,
    utterance,
    parts: finalParts,
    baseQty,
    status: baseQty === 0 ? 'none' : 'counted',
    at: now,
    source,
  };
  return {
    ...session,
    captures: { ...session.captures, [item.id]: capture },
    last: { kind: 'capture', itemId: item.id },
  };
}

export function markNone(session: Session, item: VoiceItem, now: string, utterance = 'None in stock'): Session {
  return writeCapture(session, item, [{ cell: item.base.cell, qty: 0 }], utterance, now, 'voice');
}

export function removeCapture(session: Session, itemId: string): Session {
  const captures = { ...session.captures };
  delete captures[itemId];
  return { ...session, captures, last: undefined };
}

function nextQuestionId(session: Session): string {
  let n = session.questions.length + 1;
  while (session.questions.some(q => q.id === `q${n}`)) n += 1;
  return `q${n}-${Date.now().toString(36)}`;
}

function addQuestion(session: Session, q: Omit<Question, 'id'>): { session: Session; question: Question } {
  const question: Question = { ...q, id: nextQuestionId(session) };
  return {
    session: {
      ...session,
      questions: [...session.questions, question],
      last: { kind: 'question', id: question.id },
    },
    question,
  };
}

export function questionPrompt(q: Question, index: VoiceIndex): string {
  const item = q.itemId ? index.items.get(q.itemId) : undefined;
  if (q.kind === 'otherArea' && item) {
    const area = index.areas.find(a => a.id === item.areaId);
    return `${item.name} is in the ${area?.name ?? 'another area'}. Count it there?`;
  }
  if (q.kind === 'unit' && item) {
    const said = q.raws.find(r => r.unit && !item.units.some(u => u.words.includes(r.unit as string)))?.unit;
    return `${item.name} isn't counted in ${said ? `${said}s` : 'that unit'}. Which did you mean?`;
  }
  return 'which one?';
}

function speakFor(q: Question, index: VoiceIndex): string {
  if (q.kind === 'which') {
    const names = q.candidates.map(id => index.items.get(id)?.name ?? '').filter(Boolean);
    return `Which one? ${names.join(', or ')}.`;
  }
  return questionPrompt(q, index);
}

/** Apply a capture-like intent, turning an unknown unit into a question. */
function applyCapture(
  session: Session,
  item: VoiceItem,
  raws: RawQty[],
  add: boolean,
  utterance: string,
  ctx: ApplyContext,
  out: ApplyResult,
  fallbackCell?: string,
): Session {
  const r = resolveParts(item, raws, fallbackCell);
  if (!r.ok) {
    const { session: next, question } = addQuestion(session, {
      kind: 'unit',
      areaId: item.areaId,
      utterance,
      candidates: item.units.slice(0, 3).map(u => u.cell),
      itemId: item.id,
      raws,
      add,
      at: ctx.now,
    });
    out.heard = { utterance, result: questionPrompt(question, ctx.index), tone: 'ask' };
    out.speak = speakFor(question, ctx.index);
    return next;
  }
  const next = writeCapture(session, item, r.parts, utterance, ctx.now, ctx.source ?? 'voice', add);
  const cap = next.captures[item.id];
  const qty = describeQty(item, cap.baseQty).primary;
  out.capturedIds.push(item.id);
  out.announce.push(`${item.name}, ${qty}`);
  return next;
}

export function applyActions(
  session: Session,
  actions: VoiceAction[],
  utterance: string,
  ctx: ApplyContext,
): ApplyResult {
  const out: ApplyResult = {
    session,
    heard: { utterance, result: '', tone: 'ok' },
    announce: [],
    commands: [],
    capturedIds: [],
  };
  let s = session;
  const results: string[] = [];
  let tone: Heard['tone'] = 'ok';

  for (const a of actions) {
    switch (a.kind) {
      case 'capture': {
        const item = ctx.index.items.get(a.itemId);
        if (!item) break;
        const before = out.heard;
        s = applyCapture(s, item, a.raws, a.add, utterance, ctx, out);
        if (out.heard !== before) {
          tone = 'ask';
          results.push(out.heard.result);
        } else {
          results.push(`${item.name} · ${describeQty(item, s.captures[item.id].baseQty).primary}`);
        }
        break;
      }
      case 'which':
      case 'otherArea': {
        // Offer what's still to count when that leaves a real choice;
        // anything already counted can still be re-counted by name.
        const open = a.kind === 'which' ? a.candidates.filter(id => !s.captures[id]) : [];
        const candidates =
          a.kind === 'which' ? (open.length >= 2 ? open : a.candidates).slice(0, 3) : [a.itemId];
        const { session: next, question } = addQuestion(s, {
          kind: a.kind,
          areaId: ctx.currentAreaId,
          utterance,
          candidates,
          itemId: a.kind === 'otherArea' ? a.itemId : undefined,
          raws: a.raws,
          add: a.add,
          at: ctx.now,
        });
        s = next;
        tone = 'ask';
        results.push(a.kind === 'which' ? 'Which one?' : questionPrompt(question, ctx.index));
        out.speak = speakFor(question, ctx.index);
        break;
      }
      case 'resolve': {
        const q = [...s.questions]
          .reverse()
          .find(x => x.areaId === ctx.currentAreaId && x.kind !== 'unit' && x.candidates.includes(a.itemId));
        if (!q) break;
        const r = resolveQuestion(s, q.id, a.itemId, ctx);
        s = r.session;
        out.announce.push(...r.announce);
        out.capturedIds.push(...r.capturedIds);
        results.push(r.heard.result);
        if (r.heard.tone !== 'ok') tone = r.heard.tone;
        break;
      }
      case 'noQuantity': {
        const item = ctx.index.items.get(a.itemId);
        tone = 'miss';
        results.push(`Heard ${item?.name ?? 'that'}, but not how many`);
        break;
      }
      case 'notCountable': {
        const item = ctx.index.items.get(a.itemId);
        tone = 'miss';
        results.push(`${item?.name ?? 'That item'} needs a counting unit first`);
        break;
      }
      case 'correctLast': {
        const lastId = s.last?.kind === 'capture' ? s.last.itemId : undefined;
        const item = lastId ? ctx.index.items.get(lastId) : undefined;
        const prev = lastId ? s.captures[lastId] : undefined;
        if (!item || !prev) {
          tone = 'miss';
          results.push('Nothing to correct yet');
          break;
        }
        const lastCell = prev.parts[prev.parts.length - 1]?.cell;
        const before = out.heard;
        s = applyCapture(s, item, a.raws, false, utterance, ctx, out, lastCell);
        if (out.heard !== before) {
          tone = 'ask';
          results.push(out.heard.result);
        } else {
          results.push(`${item.name} · ${describeQty(item, s.captures[item.id].baseQty).primary}`);
        }
        break;
      }
      case 'undo': {
        if (s.last?.kind === 'question') {
          const id = s.last.id;
          s = { ...s, questions: s.questions.filter(q => q.id !== id), last: undefined };
          results.push('Question removed');
        } else if (s.last?.kind === 'capture') {
          const item = ctx.index.items.get(s.last.itemId);
          s = removeCapture(s, s.last.itemId);
          results.push(`Removed ${item?.name ?? 'the last count'}. Not counted yet`);
          if (item) out.announce.push(`${item.name} removed`);
        } else {
          tone = 'miss';
          results.push('Nothing to scrap yet');
        }
        break;
      }
      case 'unheard':
        tone = 'miss';
        results.push("Didn't catch an item. Say the item and how many");
        break;
      default:
        out.commands.push(a);
    }
  }

  out.session = s;
  out.heard = { utterance, result: results.join('; '), tone };
  return out;
}

/**
 * Answer an open question. `choice` is an item id for which / otherArea
 * and a unit cell for unit questions; `null` dismisses it.
 */
export function resolveQuestion(
  session: Session,
  questionId: string,
  choice: string | null,
  ctx: ApplyContext,
): ApplyResult {
  const q = session.questions.find(x => x.id === questionId);
  const out: ApplyResult = {
    session,
    heard: { utterance: q?.utterance ?? '', result: '', tone: 'ok' },
    announce: [],
    commands: [],
    capturedIds: [],
  };
  if (!q) return out;
  let s: Session = { ...session, questions: session.questions.filter(x => x.id !== questionId) };
  if (choice === null) {
    out.session = s;
    out.heard.result = 'Left uncounted';
    return out;
  }
  const itemId = q.kind === 'unit' ? q.itemId : choice;
  const item = itemId ? ctx.index.items.get(itemId) : undefined;
  if (!item) {
    out.session = s;
    return out;
  }
  const before = out.heard;
  s = applyCapture(s, item, q.raws, q.add, q.utterance, ctx, out, q.kind === 'unit' ? choice : undefined);
  out.session = s;
  if (out.heard === before) {
    out.heard = {
      utterance: q.utterance,
      result: `${item.name} · ${describeQty(item, s.captures[item.id].baseQty).primary}`,
      tone: 'ok',
    };
  }
  return out;
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export type AreaState = 'done' | 'finishedMissing' | 'inProgress' | 'notStarted';

export interface AreaProgress {
  total: number;
  counted: number;
  uncounted: VoiceItem[];
  questions: Question[];
  /** Uncounted items the GM has already walked past (earlier in walk
   *  order than the furthest item they counted). */
  passedOver: number;
  finishedAt?: string;
  queued: number;
  state: AreaState;
}

export function areaProgress(area: VoiceArea, session: Session): AreaProgress {
  let furthest = -1;
  area.items.forEach((item, idx) => {
    if (session.captures[item.id]) furthest = idx;
  });
  const uncounted = area.items.filter(i => !session.captures[i.id]);
  const counted = area.items.length - uncounted.length;
  const passedOver = area.items.slice(0, Math.max(furthest, 0)).filter(i => !session.captures[i.id]).length;
  const questions = session.questions.filter(q => q.areaId === area.id);
  const finishedAt = session.finished[area.id];
  const queued = session.queued[area.id]?.length ?? 0;
  let state: AreaState;
  if (queued > 0) state = 'inProgress';
  else if (finishedAt) state = uncounted.length === 0 && questions.length === 0 ? 'done' : 'finishedMissing';
  else state = counted > 0 || questions.length > 0 ? 'inProgress' : 'notStarted';
  return { total: area.items.length, counted, uncounted, questions, passedOver, finishedAt, queued, state };
}

/** The next area in walk order that isn't done, starting after `fromId`. */
export function nextOpenArea(areas: VoiceArea[], session: Session, fromId?: string): VoiceArea | undefined {
  const start = Math.max(areas.findIndex(a => a.id === fromId), -1);
  const ordered = [...areas.slice(start + 1), ...areas.slice(0, start + 1)];
  return ordered.find(a => a.id !== fromId && !session.finished[a.id]);
}

import { addDaysIso, isoDay } from './format';
import { tokenMatch, tokens } from './resolve';
import type { FloorSnapshot, FloorTurn } from './types';

/**
 * Demo mode: reads floor tasks with patterns when no model is connected,
 * and names the tool call the model would have made. The tools still do
 * every rule, so cards and readbacks are the same. It only knows the
 * phrasings it was written for; anything else goes to the chat.
 */

export type DemoCall = { tool: string; args: Record<string, unknown> } | { say: string } | null;

const NUMBER_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  eleven: '11', twelve: '12', fifteen: '15', twenty: '20', thirty: '30', forty: '40', fifty: '50', hundred: '100',
};

function clean(text: string): string {
  let t = text
    .toLowerCase()
    .replace(/[“”"‘’]/g, (c) => (c === '’' || c === '‘' ? "'" : ''))
    .replace(/[!?.]+$/g, '')
    .trim();
  t = t
    .replace(/\bhalf an?\b/g, '0.5')
    .replace(/\ba couple of\b/g, '2')
    .replace(/\ba dozen\b|\bdozen\b/g, '12');
  t = t.replace(/\b[a-z]+\b/g, (w) => NUMBER_WORDS[w] ?? w);
  return t.replace(/\s+/g, ' ');
}

// ─── Finding names in what was said ─────────────────────────────────────────

const SKIP = new Set(['in', 'on', 'is', 'it', 'at', 'all', 'any', 'with', 'oz', 'up', 'by', 'no', 's', 'c', '12oz', 'hot']);
/** Pack and measure words, which name a unit rather than an item. */
const PACK_WORDS = new Set(['bag', 'box', 'case', 'pack', 'carton', 'block', 'bottle', 'tin', 'tub', 'punnet', 'kg', 'kilo', 'gram', 'litre', 'l', 'ml', 'unit', 'each']);

function nameTokens(name: string): string[] {
  return tokens(name).filter((t) => t.length > 1 && !SKIP.has(t) && !/^\d+$/.test(t));
}

/** score weighs rare words more, for picking within one list. cover is
 *  the share of a name's words that were said, for comparing lists. */
type Mention = { name: string; score: number; cover: number; matched: number; words: string[] };

function mentions(text: string, names: string[]): Mention[] {
  const said = tokens(text.replace(/\bon hand\b/g, ' ')).filter((t) => !PACK_WORDS.has(t));
  const unique = [...new Set(names)];
  // Words shared by many names ("fridge", "milk") say less than rare ones.
  const shared = new Map<string, number>();
  for (const name of unique) for (const tok of new Set(nameTokens(name))) shared.set(tok, (shared.get(tok) ?? 0) + 1);
  const weight = (tok: string) => 1 / (shared.get(tok) ?? 1);
  const out: Mention[] = [];
  for (const name of unique) {
    const nt = nameTokens(name);
    if (!nt.length) continue;
    const words = nt.filter((n) => said.some((s) => tokenMatch(s, n) >= 0.6));
    if (!words.length) continue;
    const score = words.reduce((s, w) => s + weight(w), 0) / nt.reduce((s, w) => s + weight(w), 0);
    out.push({ name, score, cover: words.length / nt.length, matched: words.length, words });
  }
  return out.sort((a, b) => b.score - a.score || b.matched - a.matched || a.name.length - b.name.length);
}

/** The best name, or the words said when two names fit equally, so the
 *  tool asks which. */
function best(text: string, names: string[]): string | null {
  const [top, second] = mentions(text, names);
  if (!top) return null;
  if (second && second.matched === top.matched && second.words.join(' ') === top.words.join(' ')) return top.words.join(' ');
  return top.name;
}

function topCover(text: string, names: string[]): number {
  return Math.max(0, ...mentions(text, names).map((m) => m.cover));
}

const otherSites = (s: FloorSnapshot) => s.sites.filter((x) => x.id !== s.site.id).map((x) => x.name);

/** Take a name's words out of what was said, so "send King's Cross 10
 *  bagels" leaves "send 10 bagels". */
function without(t: string, name: string | null): string {
  if (!name) return t;
  return nameTokens(name).reduce((s, tok) => s.replace(new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}('?s)?\\b`, 'g'), ' '), t);
}

// ─── Quantities and lines ───────────────────────────────────────────────────

const UNIT_WORDS = new Set([
  'kg', 'kgs', 'kilo', 'kilos', 'g', 'grams', 'gram', 'l', 'litre', 'litres', 'liter', 'liters', 'ml',
  'box', 'boxes', 'bag', 'bags', 'case', 'cases', 'pack', 'packs', 'carton', 'cartons', 'block', 'blocks',
  'bottle', 'bottles', 'tin', 'tins', 'tub', 'tubs', 'punnet', 'punnets', 'each', 'units', 'breasts', 'loaves', 'loaf',
]);

type Line = { item: string; quantity?: number; unit?: string };

function qtyOf(segment: string): { quantity?: number; unit?: string } {
  const m = /(\d+(?:\.\d+)?)\s*([a-z]+)?/.exec(segment);
  if (m) {
    const unit = m[2] && UNIT_WORDS.has(m[2]) ? m[2] : undefined;
    return { quantity: Number(m[1]), unit };
  }
  const a = /\b(?:a|an)\s+([a-z]+)/.exec(segment);
  if (a) return { quantity: 1, unit: UNIT_WORDS.has(a[1]) ? a[1] : undefined };
  return {};
}

/** Split "2 muffins and a sourdough loaf" into lines. Pieces that name
 *  nothing, or the same thing again ("ham and cheese"), join the piece
 *  before. */
function linesOf(text: string, names: string[]): Line[] {
  const pieces = text.split(/\s*(?:,|\band\b|\bplus\b|&)\s*/).filter(Boolean);
  const groups: { text: string; name: string | null }[] = [];
  for (const p of pieces) {
    const name = best(p, names);
    const prev = groups[groups.length - 1];
    if (prev && (!name || name === prev.name || !prev.name)) {
      prev.text = `${prev.text} ${p}`;
      prev.name = prev.name ?? name;
    } else {
      groups.push({ text: p, name });
    }
  }
  return groups.filter((g) => g.name).map((g) => ({ item: g.name!, ...qtyOf(g.text) }));
}

// ─── Dates ──────────────────────────────────────────────────────────────────

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function weekday(iso: string): number {
  return new Date(`${iso}T12:00:00`).getDay();
}

function nextWeekday(today: string, day: number): string {
  const ahead = (day - weekday(today) + 7) % 7 || 7;
  return addDaysIso(today, ahead);
}

function lastWeekday(today: string, day: number): string {
  const back = (weekday(today) - day + 7) % 7 || 7;
  return addDaysIso(today, -back);
}

const PAST_DAY = /\b((the )?day before yesterday|yesterday|\d+ days? ago|(last|on|from) (sunday|monday|tuesday|wednesday|thursday|friday|saturday)|(on )?the \d{1,2}(st|nd|rd|th))\b/g;

/** A day in the past from "yesterday", "on Tuesday", "3 days ago" or "the 18th". */
function pastDate(t: string, today: string): string | undefined {
  if (/\bday before yesterday\b/.test(t)) return addDaysIso(today, -2);
  if (/\byesterday\b/.test(t)) return 'yesterday';
  const ago = /\b(\d+) days? ago\b/.exec(t);
  if (ago) return addDaysIso(today, -Number(ago[1]));
  const day = /\b(?:last|on|from) (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.exec(t);
  if (day) return lastWeekday(today, WEEKDAYS.indexOf(day[1]));
  const nth = /\bthe (\d{1,2})(?:st|nd|rd|th)\b/.exec(t);
  if (nth) {
    const [y, m, d] = today.split('-').map(Number);
    const n = Number(nth[1]);
    const when = n <= d ? new Date(y, m - 1, n) : new Date(y, m - 2, n);
    return isoDay(when);
  }
  return undefined;
}

function futureDates(t: string, today: string): { startDate: string; endDate?: string } | null {
  if (/\btoday\b/.test(t)) return { startDate: today };
  if (/\btomorrow\b/.test(t)) return { startDate: addDaysIso(today, 1) };
  if (/\bnext week\b/.test(t)) {
    const mon = nextWeekday(today, 1);
    return { startDate: mon, endDate: addDaysIso(mon, 6) };
  }
  if (/\b(this )?weekend\b/.test(t)) {
    const sat = nextWeekday(today, 6);
    return { startDate: sat, endDate: addDaysIso(sat, 1) };
  }
  const inN = /\bin (\d+) (day|week|month)s?\b/.exec(t);
  if (inN) return { startDate: addDaysIso(today, Number(inN[1]) * (inN[2] === 'day' ? 1 : inN[2] === 'week' ? 7 : 30)) };
  const d = WEEKDAYS.findIndex((w) => new RegExp(`\\b${w}\\b`).test(t));
  if (d >= 0) return { startDate: nextWeekday(today, d) };
  return null;
}

// ─── Patterns ───────────────────────────────────────────────────────────────

const NOT_FLOOR = /\b(chart|graph|report|trend|compare|comparison|by site|by reason|across sites|this month|last month|this week|last week|gp|margin|covers|revenue|sales|cheapest|variance|production plan|new supplier|new recipe|create a|set up|catalogue|forecast)\b/;
const UNDO = /^(undo|scrap|take that back|reverse|cancel|forget|remove|i didn'?t mean|put the .* back)\b/;
const WASTE = /\b(waste|wasted|bin|binned|chuck|chucked|threw|thrown|throw out|dropped|spilt|spilled|burnt|burned|ruined|overcooked|out of date|expired|past (its|their) date|went off|gone off|stale|mouldy|moldy|staff (lunch|meal|food)|too good to go|olio|r ?& ?d)\b/;
const START_WORDS = /\b(start|starting|started|kick off|kicking off|begin|beginning)\b/;
const DONE_WORDS = /\b(done|finished|finish|complete|completed|all made)\b/;

function wasteReason(t: string): string | undefined {
  if (/\b(out of date|expired|past (its|their) date|use by)\b/.test(t)) return 'Beyond expiry date';
  if (/\b(dropped|damaged|broken|spilt|spilled|burnt|burned|ruined|overcooked)\b/.test(t)) return 'Damaged';
  if (/\b(stale|went off|gone off|mouldy|moldy|not fresh)\b/.test(t)) return 'No longer fresh';
  if (/\bstaff\b/.test(t)) return 'Used by Staff';
  if (/\b(too good to go|olio)\b/.test(t)) return 'Third Party food waste app';
  if (/\b(r ?& ?d|testing|trial)\b/.test(t)) return 'R&D';
  return undefined;
}

function rejectionReason(t: string): string | undefined {
  if (/\b(damaged|leaking|leaked|broken|crushed|split)\b/.test(t)) return 'Damaged';
  if (/\b(warm|temperature|not cold|defrosted)\b/.test(t)) return 'Temperature out of range';
  if (/\b(quality|mouldy|gone off|bad)\b/.test(t)) return 'Quality issue';
  if (/\b(didn'?t ask|wrong item|incorrect|send back)\b/.test(t)) return 'Incorrect item';
  if (/\b(missing|didn'?t come)\b/.test(t)) return 'Missing';
  if (/\b(too much|return)\b/.test(t)) return 'Other';
  return undefined;
}

function percentOf(t: string): number | undefined {
  let m = /(\d+)\s*(?:%|percent)\s*more\b/.exec(t);
  if (m) return 100 + Number(m[1]);
  m = /(\d+)\s*(?:%|percent)\s*(?:less|fewer|quieter)\b/.exec(t);
  if (m) return 100 - Number(m[1]);
  m = /(\d+)\s*(?:%|percent)/.exec(t);
  if (m) return Number(m[1]);
  if (/\b(triple|3 times)\b/.test(t)) return 300;
  if (/\b(twice|double)\b/.test(t)) return 200;
  if (/\bhalf\b|\b0\.5\b/.test(t)) return 50;
  if (/\b(normal|usual)\b/.test(t)) return 100;
  if (/\bclosed\b/.test(t)) return 0;
  return undefined;
}

function dayReason(t: string, raw: string): string | undefined {
  const k = /\b(market|event|roadworks|refit|bank holiday|match|festival|concert|school holidays|weather|closed)\b/.exec(t);
  if (k) return k[1][0].toUpperCase() + k[1].slice(1);
  const after = raw.split(',').slice(1).join(',').trim();
  if (!after || /\b(busy|quiet|twice|double|triple|half|normal|usual|percent)\b|%|\d/.test(after.toLowerCase())) return undefined;
  return after;
}

/** The question Edify should ask, when a tool needs something it can't
 *  default and the demo reader didn't hear it. */
const needs = (say: string): DemoCall => ({ say });

// ─── The reader ─────────────────────────────────────────────────────────────

export function readFloorTask(text: string, snap: FloorSnapshot, history: FloorTurn[] = []): DemoCall {
  const lastEdify = [...history].reverse().find((h) => h.role === 'edify');
  const lastUser = [...history].reverse().find((h) => h.role === 'user');
  const short = text.trim().split(/\s+/).length <= 5;
  const alone = read(text, text, snap);
  if (alone && 'tool' in alone) return alone;
  if (lastEdify && /\?\s*$/.test(lastEdify.text) && lastUser && short) {
    const joined = read(`${lastUser.text} ${text}`, text, snap);
    if (joined) return joined;
  }
  return alone;
}

function read(raw: string, said: string, snap: FloorSnapshot): DemoCall {
  const t = clean(raw);
  if (NOT_FLOOR.test(t)) return null;

  const stockNames = snap.stock.map((r) => r.name);
  const sites = otherSites(snap);
  const site = best(t, sites);
  const hasNumber = /\d/.test(t);

  // Undo
  if (UNDO.test(t)) {
    const [head, ...rest] = said.split(',');
    const which = clean(head)
      .replace(UNDO, '')
      .replace(/\b(that|it|this|the last one|the last|the|last)\b/g, '')
      .trim();
    const reason = rest.join(',').trim();
    return { tool: 'undo_last', args: { ...(which ? { which } : {}), ...(reason ? { reason } : {}) } };
  }

  // Ask it
  if (/\b(allergens?|gluten|nuts?|dairy|vegan|sesame|contains?|coeliac)\b/.test(t)) {
    const recipe = best(t, snap.recipes.map((r) => r.name));
    if (!recipe) return needs('Which recipe?');
    return { tool: 'recipe_allergens', args: { recipe } };
  }
  if (/\b(arriving|coming in|due in|due today|deliveries today)\b|when'?s the .*deliver/.test(t)) return { tool: 'whats_arriving', args: {} };
  if (/\bleft to (make|do)\b|\bstill (got )?to (do|make)\b|\bto make today\b/.test(t)) return { tool: 'whats_left_to_make', args: {} };
  if (/^(how much|how many|are we low|do we have any|what'?s on hand|have we got any)\b/.test(t)) {
    const items = linesOf(t, stockNames).map((l) => l.item);
    if (!items.length) return null;
    return { tool: 'look_up_stock', args: { items } };
  }

  // Accept an incoming transfer
  const trNumber = /\btr-?\s?(\d+)\b/.exec(t);
  const incoming = snap.transfers.filter((x) => x.toSiteId === snap.site.id);
  if (
    trNumber ||
    (/\btransfer\b/.test(t) && /\b(accept|is in|arrived|take in|receive|got)\b/.test(t) && !/^(send|start)\b/.test(t) && !/^transfer\s+(\d|some|an?)\b/.test(t)) ||
    (site && /\b(accept|arrived|came|sent|receive|is here|'s here|are here)\b/.test(t))
  ) {
    const fromTr = trNumber ? incoming.find((x) => x.number.endsWith(trNumber[1])) : undefined;
    const fromSite = fromTr?.fromSiteName ?? site ?? undefined;
    const reason = rejectionReason(t);
    const args: Record<string, unknown> = fromSite ? { fromSite } : {};
    if (reason) {
      const tr = incoming.find((x) => x.fromSiteName === fromSite) ?? incoming[0];
      const item = best(t, tr ? tr.lines.map((l) => l.itemName) : stockNames);
      if (item) {
        const { quantity } = qtyOf(t);
        args.rejections = [{ item, ...(quantity ? { quantity } : {}), reason }];
      }
    }
    return { tool: 'accept_transfer', args };
  }

  // Send a transfer
  if (site && !/\bsend us\b/.test(t) && (/^(send|transfer|move|give|start a transfer)\b/.test(t) || /\bneeds .*\bsend\b/.test(t))) {
    const lines = linesOf(without(t, site), stockNames);
    if (!lines.length) return needs(`What do you want to send to ${site}, and how much?`);
    return { tool: 'send_transfer', args: { toSite: site, lines } };
  }

  // Ask another site for stock
  if (/\b(ask|request|borrow|send us|spare|put in a request)\b|\bget .* off\b|\bneed .* from\b/.test(t)) {
    const lines = linesOf(without(t, site), stockNames);
    if (!lines.length) return needs(`What do you want to ask ${site ?? 'them'} for, and how much?`);
    return { tool: 'request_stock', args: { ...(site ? { fromSite: site } : {}), lines } };
  }

  // Accept a delivery
  const suppliers = snap.deliveries.map((d) => d.supplierName);
  const supplier = best(t, suppliers);
  if (/\b(deliver(y|ed)|arrived|is here|'s here|here|came|come in|receive|accept)\b/.test(t) && (supplier || /\bdelivery\b/.test(t))) {
    if (!supplier || !suppliers.includes(supplier)) {
      const due = snap.deliveries.filter((d) => d.due !== 'future').map((d) => d.supplierName);
      return needs(`Which supplier is it? ${due.join(', ')} ${due.length === 1 ? 'is' : 'are'} due.`);
    }
    const args: Record<string, unknown> = { supplier };
    const count = /(\d+)\s*(items|lines|things|products|cases|boxes)/.exec(t);
    if (count) args.itemCount = Number(count[1]);
    if (/\b(none|nothing) (are |is )?missing\b|\ball there\b|\beverything'?s (fine|there|here)\b|\ball fine\b|\bnothing short\b/.test(t)) args.noneMissing = true;
    const ref = /\b(?:inv|invoice|ref|reference|dn|delivery note)[\s#:-]*([a-z]*-?\d[a-z0-9-]*)/.exec(t);
    if (ref) args.supplierReference = (/^\d/.test(ref[1]) ? `INV-${ref[1]}` : ref[1]).toUpperCase();
    const delivery = snap.deliveries.find((d) => d.supplierName === supplier);
    const lineNames = delivery?.lines.map((l) => l.name) ?? [];
    const short: { item: string; received: number }[] = [];
    const missing = /(?:the )?([a-z ]+?) (?:didn'?t|did not|hasn'?t|has not) (?:come|arrive|turn up)/.exec(t);
    if (missing) {
      const item = best(missing[1], lineNames);
      if (item) short.push({ item, received: 0 });
    }
    const shortBy = /short (\d+(?:\.\d+)?) (?:on|of) (?:the )?([a-z ]+)/.exec(t);
    if (shortBy) {
      const item = best(shortBy[2], lineNames);
      const line = delivery?.lines.find((l) => l.name === item);
      if (item && line) short.push({ item, received: Math.max(0, line.ordered - Number(shortBy[1])) });
    }
    if (short.length) args.short = short;
    return { tool: 'accept_delivery', args };
  }

  // A one-off busy or quiet day
  const dates = futureDates(t, snap.today);
  if (dates && (/\b(busy|busier|quiet|quieter|dead|twice|double|triple|half|normal|usual|closed|event|market|plan for)\b/.test(t) || /%|percent/.test(t))) {
    const percentOfUsual = percentOf(t);
    const reason = dayReason(t, said);
    return { tool: 'plan_one_off_day', args: { ...dates, ...(percentOfUsual !== undefined ? { percentOfUsual } : {}), ...(reason ? { reason } : {}) } };
  }

  // Par
  if (/\bpar\b/.test(t)) {
    const [line] = linesOf(t.replace(/\bpar( level)?\b/g, ' '), stockNames);
    if (!line) return needs('Which item is the par for?');
    return { tool: 'set_par_level', args: { item: line.item, par: line.quantity ?? null, unit: line.unit ?? null } };
  }

  // Answer a checklist question: readings first
  const questions = snap.checklists.flatMap((c) => c.questions.filter((q) => !q.parentQuestionId).map((q) => ({ c, q })));
  const checklistCall = (temperatureOnly: boolean): DemoCall => {
    const pool = temperatureOnly ? questions.filter((x) => x.q.type === 'temperature' || x.q.type === 'number') : questions;
    const name = best(t.replace(/\b(temp|temperature|reading|degrees?)\b/g, ' '), pool.map((x) => x.q.name));
    const hit = pool.find((x) => x.q.name === name);
    if (!hit) return name ? { tool: 'answer_checklist', args: { question: name, answer: t } } : null;
    const [head, ...rest] = said.split(',');
    let answer: string;
    if (hit.q.type === 'temperature' || hit.q.type === 'number') answer = /-?\d+(\.\d+)?/.exec(clean(head))?.[0] ?? clean(head);
    else if (hit.q.type === 'checkbox') answer = /\b(no|not|isn'?t|aren'?t|haven'?t)\b/.test(t) ? 'no' : 'yes';
    else answer = said.trim();
    const followUpAnswer = rest.join(',').trim();
    return { tool: 'answer_checklist', args: { question: hit.q.name, answer, checklist: hit.c.name, ...(followUpAnswer ? { followUpAnswer } : {}) } };
  };
  const head = clean(said.split(',')[0]);
  if (/\b(degrees?|°|temp|temperature|reading)\b/.test(t) || (/\b(fridge|freezer|walk-?in|cool room)\b/.test(head) && /\d/.test(head) && !best(head, stockNames))) {
    const call = checklistCall(true);
    if (call) return call;
  }

  // Start or finish production on the bench
  const benchNames = snap.bench?.rows.map((r) => r.recipeName) ?? [];
  const hotNames = [...new Set(snap.hot?.batches.flatMap((b) => b.lines.map((l) => l.recipeName)) ?? [])];
  const benchHit = best(t, benchNames);
  if (benchHit && !hasNumber && (START_WORDS.test(t) || DONE_WORDS.test(t)) && !WASTE.test(t)) {
    return { tool: 'mark_production', args: { recipe: benchHit, action: START_WORDS.test(t) ? 'start' : 'done' } };
  }

  // Add to the basket
  const basketSuppliers = snap.basket.orders.map((o) => o.supplierName);
  const productNames = snap.basket.catalogue.map((p) => p.name);
  if (/\b(basket|order)\b/.test(t) || /^(we )?need \d/.test(t) || /\b\d+ more (case|bag|box|pack|block)s?\b/.test(t) || (/\b(to|for)\b/.test(t) && best(t, basketSuppliers) && /^add\b/.test(t))) {
    const supplierSaid = best(t, basketSuppliers);
    const [line] = linesOf(without(t, supplierSaid).replace(/\b(basket|order)\b/g, ' '), [...productNames, ...stockNames]);
    if (!line) return needs('Which product?');
    return {
      tool: 'add_to_basket',
      args: { product: line.item, quantity: line.quantity ?? null, unit: line.unit ?? null, ...(supplierSaid && basketSuppliers.includes(supplierSaid) ? { supplier: supplierSaid } : {}) },
    };
  }

  // Log waste
  if (WASTE.test(t)) {
    const said = t.replace(PAST_DAY, ' ');
    let lines = linesOf(said, stockNames);
    if (!lines.length) {
      const item = said
        .replace(WASTE, ' ')
        .replace(/\b(mark|log|put|down|as|can you|please|we|i|the|some|were|was|a|an|\d+(\.\d+)?)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!item) return needs('What was wasted, and how many?');
      lines = [{ item, ...qtyOf(said) }];
    }
    const reason = wasteReason(t);
    const date = pastDate(t, snap.today);
    return { tool: 'stage_waste', args: { lines: lines.map((l) => ({ ...l, ...(reason ? { reason } : {}) })), ...(date ? { date } : {}) } };
  }

  // Add to a hot batch
  const hotScore = topCover(t, hotNames);
  const stockScore = topCover(t, stockNames);
  const hotWords = /\b(more|extra|another|add|batch|made|put|throw)\b/.test(t);
  const hotHit = hotScore > 0 && (hotScore > stockScore || (hotScore === stockScore && hotWords)) ? best(t, hotNames) : null;
  const toTheLine = /\b(hot counter|hot station|on the line)\b/.test(t) && /^(add|put|throw)\b/.test(t);
  if ((hotHit || toTheLine) && (hasNumber || /\b(more|another|extra|add)\b/.test(t))) {
    let batch: string | undefined;
    let body = t;
    const named = /\b(?:to|for|on|in) the (\d{1,2}(?::\d{2})?\s*(?:am|pm)?|midday|noon)(?:\s*o'?clock)?(?:\s*batch)?/.exec(t) ?? /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2} o'?clock)\b/.exec(t);
    if (named) {
      batch = named[1].replace(/\s*o'?clock/, '');
      body = t.replace(named[0], ' ');
    } else if (/\bnext (batch|one)\b|^next\b/.test(t)) {
      batch = 'next';
      body = t.replace(/\bnext( batch| one)?\b/, ' ');
    }
    const lines = linesOf(body, hotNames).map((l) => ({ recipe: l.item, quantity: l.quantity ?? null }));
    if (!lines.length) {
      const recipe = body
        .replace(/^(add|put|throw on|throw)\b/, '')
        .replace(/\b(to|on|onto) the (hot counter|hot station|line)\b/, '')
        .replace(/\b(\d+(\.\d+)?|an?|more|another|extra)\b/g, '')
        .trim();
      if (!recipe) return null;
      return { tool: 'add_to_hot_batch', args: { lines: [{ recipe, quantity: qtyOf(body).quantity ?? null }], ...(batch ? { batch } : {}) } };
    }
    return { tool: 'add_to_hot_batch', args: { lines, ...(batch ? { batch } : {}) } };
  }

  // Start a quick count
  if (!hasNumber && /\b(quick count|count the|count of|counting|spot check|open a count|start a count|let'?s count|want to count|walk-?in count|count please)\b/.test(t)) {
    const countList = best(t.replace(/\b(quick|count|counting|spot|check)\b/g, ' '), snap.countLists.map((l) => l.name));
    return { tool: 'start_quick_count', args: countList ? { countList } : {} };
  }

  // Update on hand
  const onHandWords = /\b(on hand|have|got|left|counted|is at|are at|set|update|out of|only|there are|there's|we're at|stock of|is \d|are \d)\b/;
  if (onHandWords.test(t)) {
    if (/\b(out of|run out|none left|no more)\b/.test(t)) {
      const item = best(t, stockNames);
      if (item) return { tool: 'set_on_hand', args: { item, quantity: 0 } };
    }
    const [line] = linesOf(t.replace(/\b(set|update)\b/g, ' '), stockNames);
    if (line && (line.quantity !== undefined || /\bon hand\b/.test(t))) {
      return { tool: 'set_on_hand', args: { item: line.item, quantity: line.quantity ?? null, unit: line.unit ?? null } };
    }
  }

  // Answer a checklist question: ticks and notes
  if (/\b(labels?|checked|stocked|tidy|clean|cleaning|incidents?|stored|labelled|handwash|seating|cash|windows?)\b/.test(t)) {
    const call = checklistCall(false);
    if (call) return call;
  }

  return null;
}

// ─── What Edify says when nothing is staged ─────────────────────────────────

type Out = Record<string, unknown>;

/** Turn a tool result into the sentence the model would have said. */
export function sayFor(tool: string, out: Out): string {
  if (typeof out.refused === 'string') return [out.refused, out.route].filter(Boolean).join(' ');
  if (typeof out.question === 'string') return out.question;
  if (tool === 'look_up_stock') {
    const items = (out.items as Out[]) ?? [];
    return items
      .map((i) => {
        if (i.options) return `Which ${String(i.said)}: ${(i.options as string[]).join(', ')}?`;
        if (i.found === false) return `Edify can't find ${String(i.said)} at this site.`;
        return `${String(i.name)}: ${String(i.onHand)} on hand, par ${String(i.par)}. ${String(i.status)}.`;
      })
      .join(' ');
  }
  if (tool === 'whats_arriving') {
    const d = (out.deliveries as Out[]) ?? [];
    const tr = (out.transfers as Out[]) ?? [];
    const parts = [
      ...d.map((x) => `${String(x.supplier)} ${String(x.po)}, ${String(x.due).toLowerCase()}, ${String(x.lines)} lines.`),
      ...tr.map((x) => `${String(x.number)} from ${String(x.from)}: ${(x.lines as string[]).join(', ')}.`),
    ];
    return parts.length ? parts.join(' ') : 'Nothing is due in today.';
  }
  if (tool === 'whats_left_to_make') {
    const toMake = (out.toMake as Out[]) ?? [];
    const hot = out.hot as { batch: string; lines: Out[] } | null;
    const bench = toMake.length
      ? `${String(out.bench)}: ${toMake.map((r) => `${String(r.recipe)}, ${String(r.planned)}${r.started ? ' (started)' : ''}`).join('; ')}.`
      : 'The bench is done.';
    const hotLine = hot ? ` Hot counter, ${hot.batch}: ${hot.lines.map((l) => `${String(l.recipe)} ${String(l.made)} of ${String(l.planned)}`).join(', ')}.` : '';
    return bench + hotLine;
  }
  if (tool === 'recipe_allergens') {
    const contains = (out.contains as string[]) ?? [];
    const may = (out.mayContain as string[]) ?? [];
    const first = contains.length ? `${String(out.recipe)} contains ${contains.join(', ')}.` : `${String(out.recipe)} contains none of the 14 allergens.`;
    return may.length ? `${first} May contain ${may.join(', ')}.` : first;
  }
  if (typeof out.readback === 'string') return out.readback;
  return 'Nothing has changed.';
}
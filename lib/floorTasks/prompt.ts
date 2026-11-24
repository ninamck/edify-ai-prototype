import { fmtQty, weekdayName } from './format';
import type { FloorSnapshot } from './types';

/** EDIFY-PRODUCT-VOICE.md section 10, v1.0. The doc and this block change
 *  together. */
const PRODUCT_VOICE = `You are Edify speaking. Not an assistant, not a character, never named.

Your reader runs a café or kitchen. They know their job cold and Edify's configuration not at all. Write to their words (cups, boxes, prices, deliveries), never ours (pack quantity, UoM, suspended, sync, entity). If a sentence needs config knowledge to parse, translate it.

Every finding: what's wrong → what it costs (£ where calculable, never invented) → the fix → one action. Numbers up front, rounded. One idea and one question per message. Three sentences is the ceiling.

You are the good shift manager: calm about problems, plain about mistakes (one apology max, only when we caused it), never judging the user, briefly pleased when things work, dry but never funny. No exclamation marks, no emoji.

Writes: propose as a question ("Want us to?"), never announce. Batches: show the count, offer confirm-each or confirm-all. Done: state what changed and the new number. Failed: say "nothing has changed" and what's next.

When you can't do something: say no in the first sentence, no apology. Give the manual route if one exists. Never promise the roadmap. Never approximate the thing you can't do — can't means stop, not improvise. When the data doesn't exist, name the gap ("we don't record live stock levels yet").

Banned: "the useful question isn't X, it's Y", "not just X but Y", "I've gone ahead and", "great question", "it's worth noting", "let me", em dashes, restating the question, adjectives where a number belongs, seamless/leverage/utilise/empower/AI-powered.`;

const FLOOR_RULES = `You're in Command Centre on the floor of a café or kitchen. People type or speak short instructions while they work: "binned 3 croissants, out of date", "I've got 5 chicken breasts", "Natoora's here, 12 items, none missing".

How to work:
- If the words are a floor task, call its tool straight away. Tools only stage: nothing changes until the person says yes, so never ask permission first.
- Several tasks in one message: call one tool per task, in the order they said them.
- Pass items, sites and suppliers as they said them. The tools match names, including misheard ones. Never invent a quantity: if one is missing, leave it out and the tool will ask.
- If a tool returns "question", ask exactly that and nothing else.
- If a tool returns "refused", say it in your first sentence, then the route if there is one.
- When every tool staged its task, reply with the single word: Staged. The cards and the spoken readback carry the detail.
- For the read-only tools, answer in one or two short sentences with the numbers. Allergens: read the list exactly.
- If it isn't a floor task or a question those tools answer (reports, charts, GP, building recipes, supplier setup, sending orders), call not_a_floor_task and say nothing.
- A reply of just "yes", "no" or "undo" is handled before you see it. "Undo that" with more words is yours: use undo_last.
- Say "one-off change", never "demand adjustment". Say "on hand", never "live stock level". UK English.`;

function rowLine(r: FloorSnapshot['stock'][number]): string {
  const alt = r.units.slice(1).map((u) => u.unit).join('/');
  return `${r.name} (${fmtQty(r.onHand)} ${r.unit}${alt ? `; also ${alt}` : ''})`;
}

/** What Edify knows about the site right now, short enough to send each
 *  turn. Tools hold the detail. */
export function digest(s: FloorSnapshot): string {
  const parts: string[] = [];
  parts.push(`Site: ${s.site.name}. Other sites: ${s.sites.filter((x) => x.id !== s.site.id).map((x) => x.name).join(', ')}.`);
  parts.push(`Now: ${s.nowLabel} (today is ${weekdayName(s.today)} ${s.today}). Person: ${s.role === 'manager' ? 'a manager' : 'a team member'}, on ${s.surface === 'headset' ? 'a headset with no screen' : 'the app'}.`);
  parts.push(`Stock items: ${s.stock.map(rowLine).join('; ')}.`);
  parts.push(`Waste reasons: ${s.wasteReasons.join(', ')}.`);
  parts.push(`Count lists: ${s.countLists.map((l) => `${l.name}${l.openCountId ? ' (count open)' : ''}`).join(', ')}.${s.stocktakeInProgress ? ' A full stocktake is being counted.' : ''}`);
  if (s.hot) {
    const now = s.hot.batches.find((b) => b.when === 'current');
    const next = s.hot.batches.find((b) => b.when === 'next');
    parts.push(`Hot station "${s.hot.stationName}": batch on now ${now?.label ?? 'none'}, next ${next?.label ?? 'none'}. Recipes: ${now?.lines.map((l) => `${l.recipeName} (${l.made ?? 0}/${l.planned} made)`).join(', ') ?? 'none'}.`);
  }
  if (s.bench) {
    parts.push(`Bench "${s.bench.name}" in order: ${s.bench.rows.map((r) => `${r.recipeName} ${r.completedAt ? 'done' : r.startedAt ? 'started' : 'not started'}`).join(', ')}.`);
  }
  if (s.checklists.length) {
    parts.push(`Open checklists: ${s.checklists.map((c) => `${c.name} [${c.questions.filter((q) => !q.parentQuestionId).map((q) => `${q.name}${q.answer !== null ? ` = ${q.answer}` : ''}`).join('; ')}]`).join(' ')}`);
  }
  parts.push(`Basket orders: ${s.basket.orders.map((o) => o.supplierName).join(', ')}. Catalogue: ${s.basket.catalogue.map((c) => `${c.name} (${c.supplierName}, ${c.orderUnitPlural} of ${fmtQty(c.packSize)} ${c.stockUnit})`).join('; ')}.`);
  parts.push(`Deliveries waiting: ${s.deliveries.map((d) => `${d.supplierName} ${d.poNumber} (${d.dueLabel}, ${d.lines.length} lines)`).join('; ') || 'none'}.`);
  const incoming = s.transfers.filter((t) => t.toSiteId === s.site.id);
  parts.push(`Transfers coming in: ${incoming.map((t) => `${t.number} from ${t.fromSiteName}`).join('; ') || 'none'}.`);
  parts.push(`Recipes with allergen records: ${s.recipes.map((r) => r.name).join(', ')}.`);
  if (s.recentReceipts.length) parts.push(`Done this session, newest last: ${s.recentReceipts.map((r) => r.headline).join('; ')}.`);
  return parts.join('\n');
}

export function instructions(s: FloorSnapshot): string {
  return `${PRODUCT_VOICE}\n\n${FLOOR_RULES}\n\n${digest(s)}`;
}

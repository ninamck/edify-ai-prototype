import { z } from 'zod';
import { isUnusuallyLarge, WASTE_REASON_NAMES, wasteDates } from '../constants';
import { addDaysIso, daysBetween, fmtQty, isCountUnit, itemPhrase, wasteDayPhrase } from '../format';
import { resolve, resolveStock, resolveUnit } from '../resolve';
import type { RequestLine, SnapStockRow, TransferSendLine, WasteLine } from '../types';
import {
  andNames, ask, listNames, record, refuse, roleRefusal, STAGE_WITHOUT_ASKING, toolFactory, type Scope, type ToolDefinition,
} from './scope';

const tool = toolFactory<string>();

type ItemLine = { item: string; quantity?: number | null; unit?: string | null };

type Picked =
  | { ok: true; row: SnapStockRow; qty: number; unit: string; inStock: number }
  | { ok: false; result: ReturnType<typeof ask> };

/** Resolve one spoken line to a stock item and a quantity in its stock
 *  unit, or the one question that unblocks it. */
export function pickItem(scope: Scope, line: ItemLine, verb = 'How many', allowZero = false): Picked {
  let found = resolveStock(line.item, scope.snap.stock);
  if (found.kind === 'many' && line.unit) {
    const fits = found.options.filter((o) => resolveUnit(o, line.unit).ok);
    if (fits.length === 1) found = { kind: 'one', item: fits[0], score: 1 };
  }
  if (found.kind === 'none') {
    return { ok: false, result: ask(`There's no "${line.item}" in stock at ${scope.snap.site.name}. What's it called on the shelf?`) };
  }
  if (found.kind === 'many') {
    return { ok: false, result: ask(`Which one: ${listNames(found.options.map((o) => `${o.name} (${o.variant})`))}?`) };
  }
  const row = found.item;
  if (line.quantity === undefined || line.quantity === null) {
    return { ok: false, result: ask(`${verb} ${row.name}?`) };
  }
  if (line.quantity < 0 || (!allowZero && line.quantity === 0)) return { ok: false, result: ask(`${verb} ${row.name}? It needs to be more than 0.`) };
  const unit = resolveUnit(row, line.unit);
  if (!unit.ok) return { ok: false, result: ask(unit.question) };
  return { ok: true, row, qty: line.quantity, unit: unit.unit, inStock: line.quantity * unit.inStockUnits };
}

const itemLine = z.object({
  item: z.string().describe('The item as they said it, e.g. "croissants", "chicken breasts".'),
  quantity: z.number().nullable().optional().describe('How many. Leave out if they did not say.'),
  unit: z.string().nullable().optional().describe('The unit they said, e.g. "kg", "boxes". Leave out if none.'),
});

function wasteDate(scope: Scope, said?: string | null): { ok: true; date: string } | { ok: false; result: ReturnType<typeof refuse> } {
  const today = scope.snap.today;
  const date = !said || said === 'today' ? today : said === 'yesterday' ? addDaysIso(today, -1) : said;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, result: ask('Which day was it wasted?') };
  if (daysBetween(today, date) > 0) return { ok: false, result: refuse('Waste can\'t be logged for a future day.') };
  if (wasteDates(scope.snap.role, today).includes(date)) return { ok: true, date };
  if (scope.snap.role === 'manager') return { ok: false, result: refuse('Waste can only be logged for the last 7 days.') };
  return { ok: false, result: refuse('Waste can only be logged for today or yesterday.', 'A manager can log it for up to 7 days back.') };
}

export const stageWaste = (scope: Scope): ToolDefinition =>
  tool(
    'stage_waste',
    'Log waste: things binned, dropped, out of date, used by staff. One line per item. Reason defaults to No Reason, date to today.' +
      STAGE_WITHOUT_ASKING,
    {
      lines: z.array(itemLine.extend({
        reason: z.enum(WASTE_REASON_NAMES).optional().describe('Map their words: "out of date" is Beyond expiry date, "dropped" is Damaged, "stale" or "gone off" is No longer fresh, "staff meal" is Used by Staff, "Too Good To Go" or "Olio" is Third Party food waste app.'),
      })).min(1),
      date: z.string().optional().describe('"today", "yesterday" or YYYY-MM-DD, worked out from what they said ("on Tuesday", "3 days ago", "the 18th"). Default today.'),
    },
    async ({ lines, date }) => {
      const refusal = roleRefusal(scope, 'waste');
      if (refusal) return refusal;
      const when = wasteDate(scope, date);
      if (!when.ok) return when.result;
      const out: WasteLine[] = [];
      const warnings: string[] = [];
      for (const line of lines) {
        const picked = pickItem(scope, line, 'How many');
        if (!picked.ok) return picked.result;
        const { row, qty, unit, inStock } = picked;
        const value = Math.round(inStock * row.unitPrice * 100) / 100;
        const reason = line.reason ?? 'No Reason';
        out.push({
          itemId: row.id, itemName: row.name, kind: row.kind, qty, unit, qtyInStockUnit: inStock, stockUnit: row.unit,
          reason, value, onHand: row.onHand,
        });
        if (isUnusuallyLarge(row.id, inStock, value)) {
          warnings.push(`${itemPhrase(qty, unit, row.name)} is far more than usual for ${row.name}. Check the number.`);
        }
        if (inStock > row.onHand) {
          warnings.push(`That takes ${row.name} below zero: ${fmtQty(row.onHand)} ${row.unit} on hand.`);
        }
      }
      const reasons = [...new Set(out.map((l) => l.reason))];
      const what = andNames(out.map((l) => itemPhrase(l.qty, l.unit, l.itemName)));
      const why = reasons.length === 1 && reasons[0] !== 'No Reason' ? `, ${reasons[0].toLowerCase()}` : '';
      const when2 = wasteDayPhrase(when.date, scope.snap.today);
      return record(
        scope,
        'waste',
        { lines: out, wasteDate: when.date },
        `${what}${why}${when2}`,
        `Waste ${what}${why}${when2}?`,
        warnings,
      );
    },
  );

export const setOnHand = (scope: Scope): ToolDefinition =>
  tool(
    'set_on_hand',
    'Update what is on hand for one item, from "I have 5 chicken breasts" or "there are 3 boxes of croissants left". ' +
      'Managers set it outright. For team members it goes in as a one-item quick count on a count list that holds the item.' +
      STAGE_WITHOUT_ASKING,
    { item: z.string(), quantity: z.number().nullable().optional(), unit: z.string().nullable().optional() },
    async ({ item, quantity, unit }) => {
      const picked = pickItem(scope, { item, quantity, unit }, 'How many', true);
      if (!picked.ok) return picked.result;
      const { row, inStock } = picked;
      const to = Math.round(inStock * 1000) / 1000;
      const shown = `${fmtQty(to)} ${row.unit}`;
      const said = picked.unit === row.unit ? shown : `${shown} (${fmtQty(picked.qty)} ${isCountUnit(picked.unit) ? 'each' : picked.unit})`;
      if (scope.snap.role === 'manager') {
        return record(
          scope,
          'on-hand',
          { itemId: row.id, itemName: row.name, unit: row.unit, from: row.onHand, to, route: 'set-on-hand' },
          `${row.name}: ${fmtQty(row.onHand)} to ${shown}`,
          `Set on hand for ${row.name} to ${said}? It's ${fmtQty(row.onHand)} ${row.unit} now.`,
        );
      }
      if (scope.snap.stocktakeInProgress) {
        return refuse('A stocktake is being counted at this site. Submit it first, then come back to this quick count.');
      }
      const list = scope.snap.countLists.find((l) => l.itemIds.includes(row.id));
      if (!list) {
        return refuse(
          `${row.name} isn't on a count list at ${scope.snap.site.name}, so it can't be counted on its own.`,
          'A manager can set on hand, or add it to a count list.',
        );
      }
      return record(
        scope,
        'on-hand',
        { itemId: row.id, itemName: row.name, unit: row.unit, from: row.onHand, to, route: 'quick-count', countListId: list.id, countListName: list.name },
        `${row.name}: ${shown}, counted on ${list.name}`,
        `Count ${row.name} at ${said} on the ${list.name} list? Only ${row.name} changes.`,
      );
    },
  );

export const setParLevel = (scope: Scope): ToolDefinition =>
  tool(
    'set_par_level',
    'Change the par level (the level Edify orders back up to) for one item.' + STAGE_WITHOUT_ASKING,
    { item: z.string(), par: z.number().nullable().optional(), unit: z.string().nullable().optional() },
    async ({ item, par, unit }) => {
      const refusal = roleRefusal(scope, 'par-level');
      if (refusal) return refusal;
      const picked = pickItem(scope, { item, quantity: par, unit }, 'What par for', true);
      if (!picked.ok) return picked.result;
      const { row, inStock } = picked;
      const to = Math.round(inStock * 1000) / 1000;
      return record(
        scope,
        'par-level',
        { itemId: row.id, itemName: row.name, unit: row.unit, from: row.par, to },
        `Par for ${row.name}: ${row.par === null ? 'none' : fmtQty(row.par)} to ${fmtQty(to)} ${row.unit}`,
        `Set par for ${row.name} to ${fmtQty(to)} ${row.unit}? It's ${row.par === null ? 'not set' : fmtQty(row.par)} now.`,
      );
    },
  );

export const startQuickCount = (scope: Scope): ToolDefinition =>
  tool(
    'start_quick_count',
    'Start (or carry on with) a quick count of one count list, e.g. "start a count of the walk-in".' + STAGE_WITHOUT_ASKING,
    { countList: z.string().optional().describe('The count list or area they named.') },
    async ({ countList }) => {
      const refusal = roleRefusal(scope, 'quick-count-start');
      if (refusal) return refusal;
      if (scope.snap.stocktakeInProgress) {
        return refuse('A stocktake is being counted at this site. Submit it first, then come back to this quick count.');
      }
      const lists = scope.snap.countLists;
      if (!lists.length) return refuse('This site has no count lists yet, and a quick count needs one.', 'A manager can make one on the stock screen.');
      if (!countList) return ask(`Which list: ${listNames(lists.map((l) => l.name))}?`);
      const found = resolve(countList, lists, (l) => [l.name]);
      if (found.kind !== 'one') return ask(`Which list: ${listNames((found.kind === 'many' ? found.options : lists).map((l) => l.name))}?`);
      const list = found.item;
      const resume = !!list.openCountId;
      return record(
        scope,
        'quick-count-start',
        { countListId: list.id, countListName: list.name, itemCount: list.itemIds.length, resume },
        `${resume ? 'Carry on with' : 'Start'} a quick count: ${list.name}, ${list.itemIds.length} items`,
        resume ? `There's a ${list.name} count open. Carry on with it?` : `Start a quick count of the ${list.name}? ${list.itemIds.length} items.`,
      );
    },
  );

function pickSite(scope: Scope, said: string): { ok: true; id: string; name: string } | { ok: false; result: ReturnType<typeof ask> } {
  const others = scope.snap.sites.filter((s) => s.id !== scope.snap.site.id);
  const found = resolve(said, others, (s) => [s.name, s.name.replace(/^Fitzroy\s+/, '')]);
  if (found.kind === 'one') return { ok: true, id: found.item.id, name: found.item.name };
  return { ok: false, result: ask(`Which site: ${listNames((found.kind === 'many' ? found.options : others).map((s) => s.name))}?`) };
}

export const requestStock = (scope: Scope): ToolDefinition =>
  tool(
    'request_stock',
    'Ask another site to send stock, e.g. "ask King\'s Cross for 6 litres of oat milk". Moves nothing until they send it.' +
      STAGE_WITHOUT_ASKING,
    { fromSite: z.string().optional(), lines: z.array(itemLine).min(1), note: z.string().optional() },
    async ({ fromSite, lines, note }) => {
      const refusal = roleRefusal(scope, 'transfer-request');
      if (refusal) return refusal;
      if (!fromSite) return ask('Which site should send it?');
      const site = pickSite(scope, fromSite);
      if (!site.ok) return site.result;
      const out: RequestLine[] = [];
      for (const line of lines) {
        const picked = pickItem(scope, line, 'How many');
        if (!picked.ok) return picked.result;
        out.push({ itemId: picked.row.id, itemName: picked.row.name, qty: Math.round(picked.inStock * 1000) / 1000, unit: picked.row.unit });
      }
      const what = andNames(out.map((l) => itemPhrase(l.qty, l.unit, l.itemName)));
      return record(
        scope,
        'transfer-request',
        { fulfillingSiteId: site.id, fulfillingSiteName: site.name, lines: out, note },
        `Ask ${site.name} for ${what}`,
        `Ask ${site.name} for ${what}?`,
      );
    },
  );

export const sendTransfer = (scope: Scope): ToolDefinition =>
  tool(
    'send_transfer',
    'Send stock from this site to another site, e.g. "send 4 kilos of chicken to Islington". Sending reduces stock here straight away. Always confirmed on screen.' +
      STAGE_WITHOUT_ASKING,
    { toSite: z.string().optional(), lines: z.array(itemLine).min(1) },
    async ({ toSite, lines }) => {
      const refusal = roleRefusal(scope, 'transfer-send');
      if (refusal) return refusal;
      if (!toSite) return ask('Which site is it going to?');
      const site = pickSite(scope, toSite);
      if (!site.ok) return site.result;
      const out: TransferSendLine[] = [];
      const warnings: string[] = [];
      for (const line of lines) {
        const picked = pickItem(scope, line, 'How many');
        if (!picked.ok) return picked.result;
        const qty = Math.round(picked.inStock * 1000) / 1000;
        out.push({ itemId: picked.row.id, itemName: picked.row.name, qty, unit: picked.row.unit, onHand: picked.row.onHand });
        if (qty > picked.row.onHand) warnings.push(`More ${picked.row.name} than you have: ${fmtQty(picked.row.onHand)} ${picked.row.unit} on hand.`);
      }
      const what = andNames(out.map((l) => itemPhrase(l.qty, l.unit, l.itemName)));
      return record(
        scope,
        'transfer-send',
        { toSiteId: site.id, toSiteName: site.name, lines: out, sentAt: scope.snap.nowIso },
        `Send ${what} to ${site.name}`,
        `Send ${what} to ${site.name}? Your stock goes down when it's sent.`,
        warnings,
      );
    },
  );

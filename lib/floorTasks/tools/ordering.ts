import { z } from 'zod';
import { REJECTION_REASONS } from '../constants';
import { dayLabel, daysBetween, fmtQty } from '../format';
import { matchScore, resolve } from '../resolve';
import type { DeliveryLineDraft, SnapDelivery, TransferAcceptLine } from '../types';
import { andNames, ask, listNames, record, refuse, roleRefusal, STAGE_WITHOUT_ASKING, toolFactory, type Scope, type ToolDefinition } from './scope';

const tool = toolFactory<string>();

export const addToBasket = (scope: Scope): ToolDefinition =>
  tool(
    'add_to_basket',
    'Add a product to a supplier order in the basket, e.g. "add 2 bags of chicken to Bidvest". Adding never sends the order. Quantity is in packs (bags, cases, boxes) unless they gave a weight or volume.' +
      STAGE_WITHOUT_ASKING,
    {
      product: z.string(),
      quantity: z.number().nullable().optional(),
      unit: z.string().nullable().optional().describe('Pack word ("bags", "cases") or a stock unit ("kg", "L").'),
      supplier: z.string().optional(),
    },
    async ({ product, quantity, unit, supplier }) => {
      const refusal = roleRefusal(scope, 'basket-add');
      if (refusal) return refusal;
      const { orders, catalogue } = scope.snap.basket;
      let pool = catalogue;
      let named: (typeof orders)[number] | undefined;
      if (supplier) {
        const s = resolve(supplier, orders, (o) => [o.supplierName]);
        if (s.kind !== 'one') return ask(`Which order: ${listNames(orders.map((o) => o.supplierName))}?`);
        named = s.item;
      }
      const found = resolve(product, pool, (c) => [c.name]);
      if (found.kind === 'many') {
        const narrowed = named ? found.options.filter((o) => o.supplierId === named!.supplierId) : [];
        if (narrowed.length !== 1) return ask(`Which one: ${listNames(found.options.map((o) => `${o.name} from ${o.supplierName}`))}?`);
        pool = narrowed;
      } else if (found.kind === 'none') {
        return refuse(`${product} isn't in any supplier's catalogue for ${scope.snap.site.name}.`);
      }
      const item = found.kind === 'one' ? found.item : pool[0];
      if (named && named.supplierId !== item.supplierId) {
        return refuse(`${item.name} is not supplied by this order's supplier.`, `It comes from ${item.supplierName}.`);
      }
      const order = named ?? orders.find((o) => o.supplierId === item.supplierId);
      if (!order) {
        return refuse(`There's no ${item.supplierName} order in the basket today.`, 'Start one from the basket, then add to it.');
      }
      const existing = order.lines.find((l) => l.productId === item.productId);
      if (existing && !existing.removed) {
        return refuse(`${item.name} is already on this order, change its quantity instead.`, `It's at ${existing.packs} ${existing.packs === 1 ? item.orderUnit : item.orderUnitPlural}.`);
      }
      let packs = quantity ?? 1;
      const warnings: string[] = [];
      const u = unit?.toLowerCase().replace(/s$/, '');
      const stockU = item.stockUnit.toLowerCase().replace(/s$/, '');
      if (u && u === stockU && u !== item.orderUnit.toLowerCase()) {
        const asPacks = Math.ceil(packs / item.packSize);
        warnings.push(`Rounded up to ${asPacks} ${asPacks === 1 ? item.orderUnit : item.orderUnitPlural}: ${fmtQty(asPacks * item.packSize)} ${item.stockUnit}.`);
        packs = asPacks;
      }
      if (!Number.isInteger(packs) || packs < 1) {
        return ask(`${item.name} comes in ${item.orderUnitPlural} of ${fmtQty(item.packSize)} ${item.stockUnit}. How many ${item.orderUnitPlural}?`);
      }
      const packWord = packs === 1 ? item.orderUnit : item.orderUnitPlural;
      return record(
        scope,
        'basket-add',
        {
          orderId: order.id,
          supplierId: order.supplierId,
          supplierName: order.supplierName,
          productId: item.productId,
          productName: item.name,
          packs,
          orderUnit: item.orderUnit,
          orderUnitPlural: item.orderUnitPlural,
          packSize: item.packSize,
          stockUnit: item.stockUnit,
          unitPrice: item.unitPrice,
          restoresRemoved: !!existing?.removed,
        },
        `${packs} ${packWord} of ${item.name} on the ${order.supplierName} order`,
        `Add ${packs} ${packWord} of ${item.name} to the ${order.supplierName} order? That's £${(packs * item.unitPrice).toFixed(2)}.`,
        existing?.removed ? [`${item.name} was taken off this order earlier. This puts it back.`, ...warnings] : warnings,
      );
    },
  );

function pickDelivery(scope: Scope, supplier: string): { ok: true; d: SnapDelivery } | { ok: false; result: ReturnType<typeof ask> } {
  const pending = scope.snap.deliveries;
  if (!pending.length) return { ok: false, result: refuse(`Nothing is waiting to be accepted at ${scope.snap.site.name}.`) };
  const scored = pending
    .map((d) => ({ d, score: Math.max(matchScore(supplier, d.supplierName), matchScore(supplier, d.poNumber)) }))
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) {
    return { ok: false, result: ask(`There's no delivery from ${supplier} waiting. Pending: ${listNames(pending.map((d) => `${d.supplierName} ${d.poNumber}`))}. Which one?`) };
  }
  const same = scored.filter((x) => x.d.supplierName === scored[0].d.supplierName);
  if (same.length > 1) {
    const today = same.find((x) => x.d.due === 'today');
    if (today) return { ok: true, d: today.d };
    return { ok: false, result: ask(`${same[0].d.supplierName} has ${same.length} deliveries waiting: ${listNames(same.map((x) => x.d.poNumber))}. Which one?`) };
  }
  return { ok: true, d: scored[0].d };
}

export const acceptDelivery = (scope: Scope): ToolDefinition =>
  tool(
    'accept_delivery',
    'Accept a supplier delivery against its order, e.g. "Natoora\'s here, 12 items, none missing" or "Bidfood came but the cream is 2 short". ' +
      'Pass the number of items they said so it can be checked against the order. Always confirmed on screen.' +
      STAGE_WITHOUT_ASKING,
    {
      supplier: z.string(),
      itemCount: z.number().optional().describe('How many items or lines they said the delivery has.'),
      noneMissing: z.boolean().optional(),
      short: z.array(z.object({
        item: z.string(),
        received: z.number().optional().describe('How many actually arrived. 0 or leave out if missing entirely.'),
      })).optional().describe('Lines that were short or missing.'),
      supplierReference: z.string().optional().describe('The invoice or delivery note number, if they said it.'),
    },
    async ({ supplier, itemCount, noneMissing, short, supplierReference }) => {
      const refusal = roleRefusal(scope, 'delivery-accept');
      if (refusal) return refusal;
      const picked = pickDelivery(scope, supplier);
      if (!picked.ok) return picked.result;
      const d = picked.d;
      const lines: DeliveryLineDraft[] = d.lines
        .filter((l) => l.status === 'pending')
        .map((l) => ({ id: l.id, name: l.name, unit: l.unit, price: l.price, ordered: l.ordered, received: l.ordered }));
      const totalUnits = lines.reduce((s, l) => s + l.ordered, 0);
      const lineCountMatches = itemCount === undefined || itemCount === lines.length || itemCount === totalUnits;
      if (!lineCountMatches) {
        return asMismatch(d, lines, itemCount!);
      }
      for (const s of short ?? []) {
        const found = resolve(s.item, lines, (l) => [l.name]);
        if (found.kind !== 'one') return ask(`Which line is short: ${listNames(lines.map((l) => l.name))}?`);
        const received = Math.max(0, s.received ?? 0);
        if (received > found.item.ordered) return ask(`${found.item.name}: ${found.item.ordered} were ordered. How many arrived?`);
        found.item.received = received;
      }
      const warnings: string[] = [];
      if (d.due === 'future') warnings.push(`This was ${d.dueLabel.toLowerCase()}.`);
      if (d.requiresReference && !supplierReference) warnings.push('This site needs the supplier reference from the delivery note before it can be accepted.');
      const shortLines = lines.filter((l) => l.received < l.ordered);
      if (shortLines.length) warnings.push('Any remaining quantity stays pending.');
      const counted = itemCount !== undefined ? `${lines.length} lines, matches the order` : `${lines.length} lines`;
      const shortText = shortLines.length
        ? ` ${andNames(shortLines.map((l) => `${l.name} ${l.received} of ${l.ordered}`))}.`
        : noneMissing ? ' Nothing missing.' : '';
      return record(
        scope,
        'delivery-accept',
        {
          deliveryId: d.id,
          poNumber: d.poNumber,
          supplierName: d.supplierName,
          lines,
          saidItemCount: itemCount,
          saidNoneMissing: noneMissing,
          lineCountMatches,
          requiresReference: d.requiresReference,
          supplierReference,
          requestCredit: false,
        },
        `Accept ${d.supplierName} ${d.poNumber}: ${counted}${shortLines.length ? `, ${shortLines.length} short` : ''}`,
        `${d.supplierName} ${d.poNumber}: ${counted}.${shortText} Check it on screen to accept.`,
        warnings,
      );
    },
  );

function asMismatch(d: SnapDelivery, lines: DeliveryLineDraft[], said: number) {
  return ask(
    `You said ${said}, but the ${d.supplierName} order has ${lines.length} lines: ${andNames(lines.map((l) => `${l.ordered} ${l.name}`))}. Which are missing?`,
    { mismatch: true, onOrder: lines.length },
  );
}

export const acceptTransfer = (scope: Scope): ToolDefinition =>
  tool(
    'accept_transfer',
    'Accept a transfer coming in from another site, e.g. "the King\'s Cross transfer is here, all fine" or "the oat milk was damaged". Always confirmed on screen.' +
      STAGE_WITHOUT_ASKING,
    {
      fromSite: z.string().optional(),
      rejections: z.array(z.object({
        item: z.string(),
        quantity: z.number().optional().describe('How many to reject. Default: the whole line.'),
        reason: z.enum(REJECTION_REASONS),
        note: z.string().optional(),
      })).optional(),
    },
    async ({ fromSite, rejections }) => {
      const refusal = roleRefusal(scope, 'transfer-accept');
      if (refusal) return refusal;
      const here = scope.snap.site.id;
      const incoming = scope.snap.transfers.filter((t) => t.toSiteId === here);
      if (!incoming.length) {
        const outgoing = scope.snap.transfers.find((t) => t.fromSiteId === here);
        if (outgoing) return refuse(`Only ${outgoing.toSiteName} can accept ${outgoing.number}.`);
        return refuse(`Nothing is on its way to ${scope.snap.site.name}.`);
      }
      let t = incoming[0];
      if (fromSite || incoming.length > 1) {
        const found = fromSite ? resolve(fromSite, incoming, (x) => [x.fromSiteName, x.fromSiteName.replace(/^Fitzroy\s+/, ''), x.number]) : { kind: 'none' as const };
        if (found.kind !== 'one') return ask(`Which transfer: ${listNames(incoming.map((x) => `${x.number} from ${x.fromSiteName}`))}?`);
        t = found.item;
      }
      if (new Date(t.sentAt) > new Date(scope.snap.nowIso)) {
        const when = new Date(t.sentAt).toLocaleString('en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
        return refuse(`${t.number} from ${t.fromSiteName} is dated ${when}. It can't be accepted before then.`);
      }
      const lines: TransferAcceptLine[] = t.lines.map((l) => ({ id: l.id, itemName: l.itemName, unit: l.unit, sent: l.qty, received: l.qty }));
      for (const r of rejections ?? []) {
        const found = resolve(r.item, lines, (l) => [l.itemName]);
        if (found.kind !== 'one') return ask(`Which line: ${listNames(lines.map((l) => l.itemName))}?`);
        const qty = Math.min(found.item.sent, r.quantity ?? found.item.sent);
        found.item.received = found.item.sent - qty;
        found.item.reason = r.reason;
        found.item.note = r.note;
      }
      const rejected = lines.filter((l) => l.reason);
      const what = rejected.length
        ? `${andNames(rejected.map((l) => `${fmtQty(l.sent - l.received)} ${l.unit} ${l.itemName} rejected, ${l.reason!.toLowerCase()}`))}`
        : 'everything received';
      return record(
        scope,
        'transfer-accept',
        { transferId: t.id, transferNumber: t.number, fromSiteName: t.fromSiteName, lines },
        `Accept ${t.number} from ${t.fromSiteName}: ${what}`,
        `${t.number} from ${t.fromSiteName}: ${what}. Check it on screen to accept.`,
      );
    },
  );

export const planOneOffDay = (scope: Scope): ToolDefinition =>
  tool(
    'plan_one_off_day',
    'Plan a busy or quiet day so suggested orders change for those days only, e.g. "we\'ve got a market on Saturday, expect 150%". ' +
      'People call this a one-off change. Never say "demand adjustment". Always confirmed on screen.' +
      STAGE_WITHOUT_ASKING,
    {
      startDate: z.string().describe('YYYY-MM-DD. Work it out from "Saturday", "next Friday" using today\'s date.'),
      endDate: z.string().optional().describe('YYYY-MM-DD. Default: same as startDate.'),
      percentOfUsual: z.number().optional().describe('100 is a usual day. "Twice as busy" is 200, "half" is 50.'),
      reason: z.string().optional(),
    },
    async ({ startDate, endDate, percentOfUsual, reason }) => {
      const refusal = roleRefusal(scope, 'demand-adjustment');
      if (refusal) return refusal;
      const today = scope.snap.today;
      const end = endDate ?? startDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return ask('Which day?');
      if (daysBetween(today, startDate) < 1) return refuse('One-off changes start from tomorrow at the earliest.');
      if (daysBetween(today, startDate) > 28) return refuse('One-off changes can start up to 28 days ahead.');
      if (daysBetween(startDate, end) < 0) return ask('The end is before the start. Which days?');
      if (daysBetween(startDate, end) > 13) return refuse('A one-off change covers 14 days at most.');
      if (percentOfUsual === undefined) return ask(`How busy compared with a usual ${dayLabel(startDate, today)}? Say a percentage, or "twice as busy".`);
      if (percentOfUsual < 0 || percentOfUsual > 300) return refuse('That needs to be between 0 and 300% of usual.');
      if (!reason?.trim()) return ask('What\'s happening? It goes on the change so the next person knows why.');
      const days = startDate === end ? dayLabel(startDate, today) : `${dayLabel(startDate, today)} to ${dayLabel(end, today)}`;
      return record(
        scope,
        'demand-adjustment',
        { siteName: scope.snap.site.name, startDate, endDate: end, percentOfDemand: Math.round(percentOfUsual), reason: reason.trim() },
        `One-off change: ${days} at ${Math.round(percentOfUsual)}% of usual, ${reason.trim()}`,
        `A one-off change for ${days}: ${Math.round(percentOfUsual)}% of usual for ${reason.trim()}. Check it on screen to confirm.`,
        percentOfUsual === 100 ? ['100% cancels any one-off change for those days.'] : [],
      );
    },
  );
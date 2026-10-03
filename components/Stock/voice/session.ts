/**
 * Glue between the stock fixtures and the voice engine: turns a count's
 * scope into walk-order areas, keeps the grid and voice in step through
 * one shared session, and seeds the demo and resumed counts.
 */

import {
  STOCK_LOCATION_ORDER,
  countCellKeys,
  locationForItem,
  scopeLabel,
  type CountTarget,
  type StockItem,
  type StockLocation,
  type StocktakeRecord,
} from '../status';
import {
  buildVoiceItem,
  fmtNum,
  normalise,
  stem,
  unitLabel,
  writeCapture,
  type Capture,
  type Session,
  type VoiceArea,
  type VoiceItem,
} from './engine';

const AREA_PHRASES: Record<StockLocation, string[]> = {
  'Front counter': ['front counter', 'counter', 'front'],
  'Bar fridge': ['bar fridge', 'bar', 'drinks fridge'],
  'Walk-in': ['walk in', 'walkin', 'walk in fridge', 'chiller'],
  Freezer: ['freezer'],
  'Dry store': ['dry store', 'dry', 'store', 'store room'],
  'Cleaning cupboard': ['cleaning cupboard', 'cleaning', 'cupboard'],
};

function phrasesFor(words: string[]): string[][] {
  return words.map(w => normalise(w).split(' ').map(stem)).filter(p => p[0]);
}

export function areaIdFor(location: StockLocation): string {
  return location.toLowerCase().replace(/[^a-z]+/g, '-');
}

function areaFrom(id: string, name: string, walkOrder: number, items: StockItem[], words: string[]): VoiceArea {
  return {
    id,
    name,
    walkOrder,
    phrases: phrasesFor(words),
    items: items.map(i => buildVoiceItem(i, id)),
  };
}

/**
 * Areas for a count, in walk order. Full and resumed counts cover every
 * area at the site; an area count is that one area; quick and group
 * counts become a single list named after the scope, in walk order.
 */
export function buildAreas(items: StockItem[], target: CountTarget): VoiceArea[] {
  const byLocation = new Map<StockLocation, StockItem[]>();
  for (const item of items) {
    const loc = locationForItem(item);
    byLocation.set(loc, [...(byLocation.get(loc) ?? []), item]);
  }

  if (target.kind === 'quick' || target.kind === 'group') {
    const name = target.kind === 'group' ? target.groupName : scopeLabel(target);
    const ordered = STOCK_LOCATION_ORDER.flatMap(loc => byLocation.get(loc) ?? []);
    return [areaFrom('scope', name, 0, ordered, [name])];
  }

  return STOCK_LOCATION_ORDER.filter(loc => byLocation.has(loc))
    .filter(loc => target.kind !== 'area' || loc === target.location)
    .map((loc, i) => areaFrom(areaIdFor(loc), loc, i, byLocation.get(loc) ?? [], AREA_PHRASES[loc]));
}

export function sessionKey(siteId: string, target: CountTarget): string {
  switch (target.kind) {
    case 'continue':
      return `${siteId}|continue|${target.recordId}`;
    case 'area':
      return `${siteId}|area|${target.location}`;
    case 'group':
      return `${siteId}|group|${target.groupId}`;
    default:
      return `${siteId}|${target.kind}`;
  }
}

// ─── Grid sync ────────────────────────────────────────────────────────────────
// The grid keys counts as `${itemId}::${cellSuffix}` strings. Captures
// store parts against the same suffixes, so the two convert losslessly.

export function cellsFromCaptures(captures: Record<string, Capture>): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const cap of Object.values(captures)) {
    for (const p of cap.parts) cells[`${cap.itemId}::${p.cell}`] = fmtNum(p.qty);
  }
  return cells;
}

/** Fold the grid's cell values back into the session. An emptied row
 *  goes back to uncounted; it is never written as zero. */
export function capturesFromCells(
  session: Session,
  cells: Record<string, string>,
  items: StockItem[],
  now: string,
): Session {
  let next = session;
  for (const item of items) {
    const parts = countCellKeys(item)
      .map(cell => ({ cell, raw: (cells[`${item.id}::${cell}`] ?? '').trim() }))
      .filter(c => c.raw !== '')
      .map(c => ({ cell: c.cell, qty: Number.parseFloat(c.raw) }))
      .filter(p => Number.isFinite(p.qty) && p.qty >= 0);
    const prev = next.captures[item.id];
    if (parts.length === 0) {
      if (prev) {
        const captures = { ...next.captures };
        delete captures[item.id];
        next = { ...next, captures };
      }
      continue;
    }
    const same =
      prev &&
      prev.parts.length === parts.length &&
      prev.parts.every(p => parts.some(q => q.cell === p.cell && q.qty === p.qty));
    if (same) continue;
    const voiceItem = buildVoiceItem(item, areaIdFor(locationForItem(item)));
    next = writeCapture(next, voiceItem, parts, 'Entered on the list', now, 'grid');
  }
  return next;
}

// ─── Seeding ──────────────────────────────────────────────────────────────────

function seedQty(item: VoiceItem, stock: StockItem): number {
  const raw = Math.max(stock.currentStock, 0);
  if (item.base.metric) return Math.round(raw * 10) / 10;
  return Math.round(raw);
}

function seedItems(
  session: Session,
  area: VoiceArea,
  stockById: Map<string, StockItem>,
  at: string,
  pick: (item: VoiceItem, index: number) => boolean,
): Session {
  let next = session;
  area.items.forEach((item, i) => {
    const stock = stockById.get(item.id);
    if (!item.countable || !stock || !pick(item, i)) return;
    const qty = seedQty(item, stock);
    const said = qty === 0 ? 'none' : `${fmtNum(qty)} ${unitLabel(item.base, qty)}`;
    next = writeCapture(next, item, [{ cell: item.base.cell, qty }], said, at, 'seed');
  });
  return { ...next, last: undefined };
}

function todayAt(hours: number, minutes: number): string {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

const DEMO_WALK_IN_SEEDED = new Set([
  'ing-spinach', 'ing-cream', 'sr-pesto-base', 'rc-chicken-avo', 'ing-avocado', 'mp-avocado',
  'mp-mozzarella', 'fe-almond-milk', 'fe-greek-yogurt', 'fe-butter', 'fe-cheddar',
]);

/**
 * The `?demo=1` starting point at Fitzroy Espresso: Front counter and
 * Bar fridge done, Freezer finished with one item it can't count, and
 * the Walk-in part-way through, so the strip and sheet show every state.
 */
export function seedDemo(areas: VoiceArea[], stockById: Map<string, StockItem>): Session {
  let s: Session = { captures: {}, questions: [], finished: {}, queued: {} };
  const plan: Array<[string, string]> = [
    ['front-counter', todayAt(9, 15)],
    ['bar-fridge', todayAt(9, 42)],
    ['freezer', todayAt(10, 5)],
  ];
  for (const [id, at] of plan) {
    const area = areas.find(a => a.id === id);
    if (!area) continue;
    s = seedItems(s, area, stockById, at, () => true);
    s = { ...s, finished: { ...s.finished, [id]: at } };
  }
  const walkIn = areas.find(a => a.id === 'walk-in');
  if (walkIn) {
    s = seedItems(s, walkIn, stockById, todayAt(10, 20), item => DEMO_WALK_IN_SEEDED.has(item.id));
  }
  return { ...s, currentAreaId: walkIn?.id ?? areas[0]?.id };
}

/** Resuming an in-progress record picks up where the counter left off:
 *  the first `itemsCounted` items of the first area with stock. */
export function seedResume(
  areas: VoiceArea[],
  stockById: Map<string, StockItem>,
  record: StocktakeRecord | null,
): Session {
  const base: Session = { captures: {}, questions: [], finished: {}, queued: {} };
  if (!record || record.status !== 'in-progress') return { ...base, currentAreaId: areas[0]?.id };
  const area = areas.find(a => a.id === 'walk-in') ?? areas[0];
  if (!area) return base;
  const limit = Math.min(record.itemsCounted, Math.max(area.items.length - 4, 0));
  const s = seedItems(base, area, stockById, record.date, (_item, i) => i < limit);
  return { ...s, currentAreaId: area.id };
}

/** A completed record, rebuilt for viewing: every area finished in walk
 *  order, the last one at the record's time. Completed records only keep
 *  totals, so the counts come from the site's stock levels. */
export function seedCompleted(
  areas: VoiceArea[],
  stockById: Map<string, StockItem>,
  record: StocktakeRecord,
): Session {
  let s: Session = { captures: {}, questions: [], finished: {}, queued: {} };
  const end = new Date(record.date).getTime();
  areas.forEach((area, i) => {
    const at = new Date(end - (areas.length - 1 - i) * 14 * 60_000).toISOString();
    s = seedItems(s, area, stockById, at, () => true);
    s = { ...s, finished: { ...s.finished, [area.id]: at } };
  });
  return { ...s, currentAreaId: areas[0]?.id };
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export interface SubmitSummary {
  counted: number;
  none: number;
  uncounted: Array<{ area: string; items: string[] }>;
  total: number;
}

export function summarise(areas: VoiceArea[], session: Session): SubmitSummary {
  let counted = 0;
  let none = 0;
  let total = 0;
  const uncounted: SubmitSummary['uncounted'] = [];
  for (const area of areas) {
    const missing: string[] = [];
    for (const item of area.items) {
      total += 1;
      const cap = session.captures[item.id];
      if (!cap) missing.push(item.name);
      else if (cap.status === 'none') none += 1;
      else counted += 1;
    }
    if (missing.length) uncounted.push({ area: area.name, items: missing });
  }
  return { counted, none, uncounted, total };
}

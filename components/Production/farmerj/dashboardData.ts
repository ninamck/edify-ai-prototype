import { batchesToNumber, costPerKgOf } from './cascade';
import { addDays, FJ_DEMO_TODAY, isShopOpen, referenceDaysFor, weekdayLabel } from './calendar';
import { computeDayPlan, type DayRecord } from './FjPlanStore';
import { COMPONENTS, PRODUCT_BY_ID, PRODUCTS, PRODUCT_GROUP_LABELS, type ProductGroup } from './recipes';
import { averageDemand, CHANNEL_LABELS, dayPartOfHour, daySales, type DayDemand, type DayPart } from './sales';
import type { SalesChannel } from './salesDay';
import { FJ_ALL_SHOPS_ID, FJ_SHOPS } from './shops';

/**
 * Numbers behind the Farmer J dashboard. Sales come from the same demand
 * model the plans use (Marylebone today is the real till export, every
 * other shop-day is modelled from it). Production figures come from close
 * records where a shop has counted; otherwise they are modelled,
 * deterministically, so the demo reads the same every time.
 */

type GetRecord = (shopId: string, date: string) => DayRecord;

const CHANNELS: SalesChannel[] = ['instore', 'kiosk', 'deliveroo', 'clickcollect'];
export const CHANNEL_ORDER = CHANNELS;
export { CHANNEL_LABELS };

function shopsFor(scope: string): string[] {
  return scope === FJ_ALL_SHOPS_ID ? FJ_SHOPS.map(s => s.id) : [scope];
}

function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function sumDemand(shops: string[], date: string): DayDemand[] {
  return shops.filter(s => isShopOpen(s, date)).map(s => daySales(s, date));
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export type DaypartTile = { part: DayPart | 'total'; label: string; net: number; avg: number };

export function daypartTiles(scope: string, date = FJ_DEMO_TODAY): DaypartTile[] {
  const shops = shopsFor(scope);
  const today = sumDemand(shops, date);
  const refs = referenceDaysFor(date).filter(r => r.included).map(r => r.date);
  const avg = shops.filter(s => isShopOpen(s, date)).map(s => averageDemand(s, refs));
  const part = (list: DayDemand[], p: DayPart) => list.reduce((n, d) => n + d.netByDayPart[p], 0);
  const total = (list: DayDemand[]) => list.reduce((n, d) => n + d.net, 0);
  return [
    { part: 'breakfast', label: 'Breakfast', net: part(today, 'breakfast'), avg: part(avg, 'breakfast') },
    { part: 'lunch', label: 'Lunch', net: part(today, 'lunch'), avg: part(avg, 'lunch') },
    { part: 'dinner', label: 'Dinner', net: part(today, 'dinner'), avg: part(avg, 'dinner') },
    { part: 'total', label: 'Day', net: total(today), avg: total(avg) },
  ];
}

export type HourRow = { hour: number; label: string; breakfast: number; lunch: number; dinner: number; trays: number };

/** Pounds by hour, split by daypart, with trays alongside. */
export function salesByHour(scope: string, date = FJ_DEMO_TODAY): HourRow[] {
  const list = sumDemand(shopsFor(scope), date);
  const hours = new Set<number>();
  for (const d of list) for (const h of Object.keys(d.netByHour)) hours.add(Number(h));
  return Array.from(hours).sort((a, b) => a - b).map(hour => {
    const row: HourRow = { hour, label: `${String(hour).padStart(2, '0')}:00`, breakfast: 0, lunch: 0, dinner: 0, trays: 0 };
    for (const d of list) {
      row[dayPartOfHour(hour)] += Math.round(d.netByHour[hour] ?? 0);
      for (const ch of CHANNELS) row.trays += Math.round(d.traysByHour[hour]?.[ch] ?? 0);
    }
    return row;
  });
}

export type TrendPoint = { d: string; date: string; sales: number; modelled: boolean };

/** Six weeks of daily net sales, in thousands. */
export function salesTrend(scope: string, weeks = 6, to = FJ_DEMO_TODAY): TrendPoint[] {
  const shops = shopsFor(scope);
  const out: TrendPoint[] = [];
  for (let n = weeks * 7 - 1; n >= 0; n--) {
    const date = addDays(to, -n);
    const list = sumDemand(shops, date);
    const net = list.reduce((s, d) => s + d.net, 0);
    out.push({ d: `${weekdayLabel(date).slice(0, 2)} ${Number(date.slice(8, 10))}`, date, sales: Math.round(net / 100) / 10, modelled: list.every(d => d.modelled) });
  }
  return out;
}

export type ChannelShare = { channel: SalesChannel; label: string; net: number; share: number };

export function channelMix(scope: string, date = FJ_DEMO_TODAY): ChannelShare[] {
  const list = sumDemand(shopsFor(scope), date);
  const total = list.reduce((n, d) => n + d.net, 0) || 1;
  return CHANNELS.map(ch => {
    const net = list.reduce((n, d) => n + d.netByChannel[ch], 0);
    return { channel: ch, label: CHANNEL_LABELS[ch], net, share: net / total };
  });
}

export type MixRow = { id: string; name: string; portions: number; share: number };

/** Portions by product within a group, largest first. */
export function groupMix(scope: string, group: ProductGroup, date = FJ_DEMO_TODAY): MixRow[] {
  const list = sumDemand(shopsFor(scope), date);
  const rows = PRODUCTS.filter(p => p.group === group).map(p => ({
    id: p.id,
    name: p.name,
    portions: list.reduce((n, d) => n + (d.products[p.id]?.portions ?? 0), 0),
  }));
  const total = rows.reduce((n, r) => n + r.portions, 0) || 1;
  return rows.map(r => ({ ...r, share: r.portions / total })).sort((a, b) => b.portions - a.portions);
}

export type AttachRate = { group: ProductGroup; label: string; perTray: number };

/** Portions of each group per tray sold. */
export function attachRates(scope: string, date = FJ_DEMO_TODAY): AttachRate[] {
  const list = sumDemand(shopsFor(scope), date);
  const trays = list.reduce((n, d) => n + d.trays, 0) || 1;
  const groups: ProductGroup[] = ['proteins', 'bases', 'hot-sides', 'salads'];
  return groups.map(g => ({
    group: g,
    label: PRODUCT_GROUP_LABELS[g],
    perTray: list.reduce((n, d) => n + PRODUCTS.filter(p => p.group === g).reduce((m, p) => m + (d.products[p.id]?.portions ?? 0), 0), 0) / trays,
  }));
}

export type ShopLeagueRow = { shopId: string; name: string; net: number; breakfast: number; deliveryShare: number; vsAvg: number; real: boolean };

export function shopLeague(date = FJ_DEMO_TODAY): ShopLeagueRow[] {
  const refs = referenceDaysFor(date).filter(r => r.included).map(r => r.date);
  return FJ_SHOPS.filter(s => isShopOpen(s.id, date)).map(s => {
    const d = daySales(s.id, date);
    const a = averageDemand(s.id, refs);
    const second = d.netByChannel.deliveroo + d.netByChannel.clickcollect;
    return { shopId: s.id, name: s.name, net: d.net, breakfast: d.netByDayPart.breakfast, deliveryShare: d.net ? second / d.net : 0, vsAvg: a.net ? d.net / a.net - 1 : 0, real: !d.modelled };
  }).sort((a, b) => b.net - a.net);
}

// ─── Production ──────────────────────────────────────────────────────────────

export type AccuracyRow = {
  productId: string;
  name: string;
  group: ProductGroup;
  /** Batches the plan said to make on the day. */
  planned: number;
  /** Batches the sales needed, from the close count (real) or modelled. */
  needed: number;
  /** Over (positive) or under (negative) as a share of planned. */
  variance: number;
  real: boolean;
};

/** Yesterday's plan against what the close said was needed. Shops that
 *  counted use the count; others are modelled around the plan. */
export function forecastAccuracy(scope: string, getRecord: GetRecord, date = addDays(FJ_DEMO_TODAY, -1)): AccuracyRow[] {
  const shops = shopsFor(scope).filter(s => isShopOpen(s, date));
  const acc = new Map<string, AccuracyRow>();
  for (const shopId of shops) {
    const record = getRecord(shopId, date);
    const plan = computeDayPlan(shopId, date, record, getRecord(shopId, addDays(date, -1)).close);
    for (const p of plan.plans) {
      const planned = batchesToNumber(p.batches);
      if (planned === 0) continue;
      let needed: number;
      let real = false;
      if (record.close) {
        const carried = record.close.carried[p.productId] ?? 0;
        const binned = record.close.binned[p.productId]?.grams ?? 0;
        needed = Math.max(0, planned - (carried + binned) / (p.product.batch.fullG * (1 - p.product.yieldLossPct / 100)));
        real = true;
      } else {
        // Modelled: each product carries a small estate-wide bias (the
        // pattern Jana looks for), and each shop-day adds its own noise.
        // Salads and chicken move more because trade on the day moves them.
        const bias = (seeded(`${p.productId}|bias`) - 0.5) * 0.2;
        const spread = p.product.group === 'salads' || p.product.group === 'proteins' ? 0.14 : 0.08;
        needed = planned * (1 - bias) * (1 - spread + seeded(`${shopId}|${date}|${p.productId}|acc`) * 2 * spread);
      }
      const row = acc.get(p.productId) ?? { productId: p.productId, name: p.product.name, group: p.product.group, planned: 0, needed: 0, variance: 0, real: true };
      row.planned += planned;
      row.needed += needed;
      row.real = row.real && real;
      acc.set(p.productId, row);
    }
  }
  return Array.from(acc.values())
    .map(r => ({ ...r, variance: r.planned ? (r.planned - r.needed) / r.planned : 0 }))
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
}

export type WasteDay = { date: string; label: string; carriedKg: number; wasteKg: number; wastePounds: number; real: boolean };

/** Last seven trading days of carry-over and waste. */
export function wasteWeek(scope: string, getRecord: GetRecord, to = addDays(FJ_DEMO_TODAY, -1)): WasteDay[] {
  const shops = shopsFor(scope);
  const out: WasteDay[] = [];
  for (let n = 6; n >= 0; n--) {
    const date = addDays(to, -n);
    let carriedKg = 0;
    let wasteKg = 0;
    let wastePounds = 0;
    let real = true;
    for (const shopId of shops) {
      if (!isShopOpen(shopId, date)) continue;
      const record = getRecord(shopId, date);
      if (record.close) {
        for (const g of Object.values(record.close.carried)) carriedKg += g / 1000;
        for (const [pid, b] of Object.entries(record.close.binned)) {
          wasteKg += b.grams / 1000;
          const comp = PRODUCT_BY_ID[pid]?.countedAs;
          wastePounds += (b.grams / 1000) * (comp ? costPerKgOf(comp) : 6);
        }
      } else {
        real = false;
        const d = daySales(shopId, date);
        // Modelled: carry-over about 4% of grams sold, waste about 1.6%,
        // priced at a blended £6.40 a kilo.
        const soldKg = Object.values(d.products).reduce((s, p) => s + p.grams, 0) / 1000;
        const c = soldKg * (0.03 + seeded(`${shopId}|${date}|carry`) * 0.02);
        const w = soldKg * (0.011 + seeded(`${shopId}|${date}|waste`) * 0.01);
        carriedKg += c;
        wasteKg += w;
        wastePounds += w * 6.4;
      }
    }
    out.push({ date, label: weekdayLabel(date), carriedKg, wasteKg, wastePounds, real });
  }
  return out;
}

export type WasteReasonRow = { reason: string; pounds: number; share: number };

const REASON_WEIGHTS: Record<string, number> = { 'Over-production': 0.52, 'End of shelf life': 0.28, 'Dropped or spoiled': 0.12, Quality: 0.08 };

export function wasteByReason(scope: string, getRecord: GetRecord, week: WasteDay[]): WasteReasonRow[] {
  const total = week.reduce((n, d) => n + d.wastePounds, 0);
  const counted: Record<string, number> = {};
  let countedTotal = 0;
  for (const shopId of shopsFor(scope)) {
    for (const day of week) {
      const rec = getRecord(shopId, day.date);
      if (!rec.close) continue;
      for (const [pid, b] of Object.entries(rec.close.binned)) {
        const comp = PRODUCT_BY_ID[pid]?.countedAs;
        const pounds = (b.grams / 1000) * (comp ? costPerKgOf(comp) : 6);
        counted[b.reason] = (counted[b.reason] ?? 0) + pounds;
        countedTotal += pounds;
      }
    }
  }
  const modelledTotal = Math.max(0, total - countedTotal);
  return Object.entries(REASON_WEIGHTS).map(([reason, w]) => {
    const pounds = (counted[reason] ?? 0) + modelledTotal * w;
    return { reason, pounds, share: total ? pounds / total : 0 };
  }).sort((a, b) => b.pounds - a.pounds);
}

export type YieldRow = { key: string; name: string; expected: number; counted: number; note?: string; real: boolean };

/** Yield loss as set in Setup against what the kitchen weighed. One row
 *  per shop for Amba chicken on the all-shops view; one row per component
 *  for a single shop. Counted values are modelled; the handover says so. */
export function yieldVariance(scope: string): YieldRow[] {
  if (scope === FJ_ALL_SHOPS_ID) {
    const amba = COMPONENTS['amba-cooked'];
    return FJ_SHOPS.map(s => {
      // Paddington runs hot: Jana's 43% example.
      const drift = s.id === 'fj-paddington' ? 3 : Math.round((seeded(`${s.id}|amba-yield`) - 0.5) * 4);
      return { key: s.id, name: s.name, expected: amba.yieldLossPct, counted: amba.yieldLossPct + drift, real: false };
    }).sort((a, b) => (b.counted - b.expected) - (a.counted - a.expected));
  }
  const watch = ['amba-cooked', 'harissa-cooked', 'kale-prep', 'loose-miso-hispi', 'loose-miso-aubergine', 'broccoli-roasted', 'cucumber-prep', 'parsley-prep', 'salmon-cooked'];
  return watch.filter(id => COMPONENTS[id]).map(id => {
    const c = COMPONENTS[id];
    const drift = scope === 'fj-paddington' && id === 'amba-cooked' ? 3 : Math.round((seeded(`${scope}|${id}|yield`) - 0.5) * 6);
    return { key: id, name: c.name, expected: c.yieldLossPct, counted: Math.max(0, c.yieldLossPct + drift), note: c.yieldNote, real: false };
  }).sort((a, b) => Math.abs(b.counted - b.expected) - Math.abs(a.counted - a.expected));
}

/** Kitchen hours on prep per £100 of sales, seeded per shop. */
export function prepHoursPer100(scope: string): { name: string; hours: number }[] {
  const shops = scope === FJ_ALL_SHOPS_ID ? FJ_SHOPS : FJ_SHOPS.filter(s => s.id === scope);
  return shops.map(s => ({ name: s.name, hours: Math.round((1.05 + seeded(`${s.id}|prep-hours`) * 0.55) * 100) / 100 })).sort((a, b) => b.hours - a.hours);
}

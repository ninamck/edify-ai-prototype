import type { Ingredient as OrderIngredient, SuggestedOrder, SuggestedOrderLine, Supplier, SupplierProduct, TrustPanelData } from '@/app/assisted-ordering/types';
import { registerOrderingDataset, type OrderingDataset } from '@/app/assisted-ordering/data/mockOrders';
import type { ForecastCardData } from '@/app/assisted-ordering/components/OrderReview';
import { kg } from './cascade';
import { addDays, FJ_DEMO_TODAY, isShopOpen, longDay, shortDate, weekdayLabel, weekdayOf } from './calendar';
import { FJ_CLOCK_START } from './fjClock';
import { computeDayPlan, type DayRecord } from './FjPlanStore';
import { computeIngredientNeeds, type IngredientNeed } from './ordering';
import { casesFor, computePackagingNeeds, PACKAGING, PACKAGING_ORDER, PACKAGING_SUPPLIER, type PackagingId, type PackagingNeed } from './packaging';
import { INGREDIENTS, type Ingredient } from './recipes';
import { daySales } from './sales';

/**
 * Farmer J in Predictive ordering.
 *
 * Each supplier has delivery days, a lead time and a cut-off. The next
 * delivery a manager can still order for is worked out from the demo clock;
 * the order covers the days from that delivery up to the one after it. Grams
 * for those days come from the plan cascade (`computeIngredientNeeds`), so
 * prep-list overrides and the flex all land in the order, less what the
 * store-room count says is on the shelf, rounded up to the supplier's pack.
 *
 * Packaging is a supplier like any other. Its lines are counted per tray and
 * per portion from the same day plans (see `packaging.ts`), so a flex or a
 * catering order moves the box count the way it moves the chicken.
 *
 * Supplier profiles and store-room counts are demo-modelled. Supplier names
 * are the ones on Farmer J's recipe sheets (Med Cuisine, H&B, Packaging
 * Environmental) or the category the sheet uses; Ed swaps in the real accounts.
 */

type SupplierProfile = {
  id: string;
  name: string;
  /** Recipe-book supplier string this profile covers. */
  matches: string;
  cutOffTime: string;
  leadTimeDays: number;
  minimumOrderValue: number;
  /** 0 = Monday. */
  deliveryDays: number[];
  email: string;
};

const PROFILES: SupplierProfile[] = [
  { id: 'fj-sup-produce', name: 'Fresh produce', matches: 'Fresh produce', cutOffTime: '15:00', leadTimeDays: 1, minimumOrderValue: 60, deliveryDays: [0, 1, 2, 3, 4, 5], email: 'orders@produce.example' },
  { id: 'fj-sup-butcher', name: 'Butcher', matches: 'Butcher', cutOffTime: '12:00', leadTimeDays: 2, minimumOrderValue: 150, deliveryDays: [1, 3, 5], email: 'orders@butcher.example' },
  { id: 'fj-sup-fish', name: 'Fish', matches: 'Fish', cutOffTime: '11:00', leadTimeDays: 1, minimumOrderValue: 80, deliveryDays: [1, 3, 4], email: 'orders@fish.example' },
  { id: 'fj-sup-chilled', name: 'Chilled', matches: 'Chilled', cutOffTime: '14:00', leadTimeDays: 1, minimumOrderValue: 100, deliveryDays: [0, 2, 4], email: 'orders@chilled.example' },
  { id: 'fj-sup-dry', name: 'Dry goods', matches: 'Dry goods', cutOffTime: '16:00', leadTimeDays: 2, minimumOrderValue: 250, deliveryDays: [0, 3], email: 'orders@drygoods.example' },
  { id: 'fj-sup-frozen', name: 'Frozen', matches: 'Frozen', cutOffTime: '16:00', leadTimeDays: 2, minimumOrderValue: 0, deliveryDays: [3], email: 'orders@frozen.example' },
  { id: 'fj-sup-med', name: 'Med Cuisine', matches: 'Med Cuisine', cutOffTime: '12:00', leadTimeDays: 3, minimumOrderValue: 120, deliveryDays: [2], email: 'orders@medcuisine.example' },
  { id: 'fj-sup-hb', name: 'H&B', matches: 'H&B', cutOffTime: '17:00', leadTimeDays: 3, minimumOrderValue: 0, deliveryDays: [4], email: 'orders@hb.example' },
  // ProMap: "Packaging Environmental, order by 11AM". Two deliveries a week.
  { id: 'fj-sup-packaging', name: PACKAGING_SUPPLIER, matches: PACKAGING_SUPPLIER, cutOffTime: '11:00', leadTimeDays: 2, minimumOrderValue: 100, deliveryDays: [1, 3], email: 'orders@packagingenvironmental.example' },
];

const PACKAGING_PROFILE = PROFILES.find(p => p.matches === PACKAGING_SUPPLIER)!;

const STOCK_COUNTED_DAYS_AGO = 2;

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

function minusMins(hhmm: string, n: number): string {
  const t = Math.max(0, toMins(hhmm) - n);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function plural(noun: string): string {
  if (/(s|x|ch|sh)$/.test(noun)) return `${noun}es`;
  return `${noun}s`;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Delivery cycle for a supplier from the demo clock: send day, delivery, and the delivery after it. */
export type DeliveryCycle = { sendOn: string; deliveryDate: string; nextDeliveryDate: string; coverDays: string[]; urgent: boolean };

export function deliveryCycle(profile: SupplierProfile, today = FJ_DEMO_TODAY, nowMins = FJ_CLOCK_START): DeliveryCycle {
  const beforeCutOff = nowMins < toMins(profile.cutOffTime);
  const sendOn = beforeCutOff ? today : addDays(today, 1);
  let d = addDays(sendOn, profile.leadTimeDays);
  for (let i = 0; i < 8 && !profile.deliveryDays.includes(weekdayOf(d)); i++) d = addDays(d, 1);
  let next = addDays(d, 1);
  for (let i = 0; i < 8 && !profile.deliveryDays.includes(weekdayOf(next)); i++) next = addDays(next, 1);
  const coverDays: string[] = [];
  for (let x = d; x < next; x = addDays(x, 1)) coverDays.push(x);
  const urgent = sendOn === today && toMins(profile.cutOffTime) - nowMins <= 90;
  return { sendOn, deliveryDate: d, nextDeliveryDate: next, coverDays, urgent };
}

// ─── Static catalogue registered with the ordering module ────────────────────

export const FJ_ORDER_SUPPLIERS: Supplier[] = PROFILES.map(p => {
  const cycle = deliveryCycle(p);
  return {
    id: p.id,
    name: p.name,
    cutOffTime: p.cutOffTime,
    leadTimeDays: p.leadTimeDays,
    minimumOrderValue: p.minimumOrderValue,
    deliveryDays: p.deliveryDays.map(d => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][d]),
    email: p.email,
    deliveryDate: shortDate(cycle.deliveryDate),
    sendTime: minusMins(p.cutOffTime, 30),
    urgent: cycle.urgent,
  };
});

const PROFILE_BY_SUPPLIER: Record<string, SupplierProfile> = Object.fromEntries(PROFILES.map(p => [p.matches, p]));

export function orderIngredientId(id: string): string {
  return `fj-${id}`;
}

function stockUnitFor(ing: Ingredient): string {
  return ing.pack.unit === 'ml' ? 'L' : 'kg';
}

/** Packs on the shelf from Monday's store-room count. Demo-modelled, deterministic. */
export function onHandPacks(ing: Ingredient): number {
  if (ing.daily) return 0;
  if (ing.frozen) return 1;
  const h = hash(ing.id);
  if (ing.supplier === 'Dry goods') return h % 3;
  return h % 2;
}

export const FJ_ORDER_INGREDIENTS: OrderIngredient[] = Object.values(INGREDIENTS)
  .filter(i => i.supplier !== 'Tap' && PROFILE_BY_SUPPLIER[i.supplier])
  .map(i => ({
    id: orderIngredientId(i.id),
    name: i.name,
    variant: i.frozen ? 'Frozen' : i.daily ? 'Daily delivery' : '',
    stockUnit: stockUnitFor(i),
    currentStock: Math.round((onHandPacks(i) * i.pack.size) / 100) / 10,
    stockDataAgeDays: STOCK_COUNTED_DAYS_AGO,
    parLevel: null,
    parConfirmed: false,
  }));

export const FJ_ORDER_PRODUCTS: SupplierProduct[] = Object.values(INGREDIENTS)
  .filter(i => i.supplier !== 'Tap' && PROFILE_BY_SUPPLIER[i.supplier])
  .map(i => ({
    ingredientId: orderIngredientId(i.id),
    supplierId: PROFILE_BY_SUPPLIER[i.supplier].id,
    isPrimary: true,
    unitName: i.pack.label,
    unitSize: Math.round((i.pack.size / 1000) * 100) / 100,
    unitCost: Math.round(((i.pack.size / 1000) * i.costPerKg) * 100) / 100,
    available: true,
  }));

export function packagingIngredientId(id: PackagingId): string {
  return `fj-pack-${id}`;
}

/** Cases on the shelf at Monday's count. High-volume lines usually have a case open. */
export function onHandCases(id: PackagingId): number {
  if (id === 'catering-box-x4' || id === 'catering-box-x6') return 0;
  return hash(id) % 2;
}

export const FJ_PACKAGING_INGREDIENTS: OrderIngredient[] = PACKAGING_ORDER.map(id => ({
  id: packagingIngredientId(id),
  name: PACKAGING[id].name,
  variant: 'Packaging',
  // Leading space: the review reads `${stock}${unit}`, so this prints "8.0 cases".
  stockUnit: ' cases',
  currentStock: onHandCases(id),
  stockDataAgeDays: STOCK_COUNTED_DAYS_AGO,
  parLevel: null,
  parConfirmed: false,
}));

export const FJ_PACKAGING_PRODUCTS: SupplierProduct[] = PACKAGING_ORDER.map(id => ({
  ingredientId: packagingIngredientId(id),
  supplierId: PACKAGING_PROFILE.id,
  isPrimary: true,
  unitName: PACKAGING[id].caseLabel,
  // Stock is counted in cases, so one case moves stock by one.
  unitSize: 1,
  unitCost: PACKAGING[id].costPerCase,
  available: true,
}));

export const FJ_ORDERING_DATASET: OrderingDataset = {
  suppliers: FJ_ORDER_SUPPLIERS,
  ingredients: [...FJ_ORDER_INGREDIENTS, ...FJ_PACKAGING_INGREDIENTS],
  products: [...FJ_ORDER_PRODUCTS, ...FJ_PACKAGING_PRODUCTS],
};

registerOrderingDataset(FJ_ORDERING_DATASET);

// ─── Suggested orders from the plan ──────────────────────────────────────────

type GetRecord = (shopId: string, date: string) => DayRecord;

function coverLabel(days: string[]): string {
  if (days.length === 0) return '';
  const first = days[0];
  const last = days[days.length - 1];
  const dayName = (iso: string) => `${weekdayLabel(iso)} ${Number(iso.slice(8, 10))}`;
  return first === last ? dayName(first) : `${dayName(first)} to ${dayName(last)}`;
}

function usedByLabel(names: string[]): string {
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}

function trustFor(need: IngredientNeed, packs: number, cycle: DeliveryCycle, packNoun: string): TrustPanelData {
  const h = hash(need.ingredientId);
  const points = [4, 3, 2, 1].map(n => {
    const date = addDays(cycle.deliveryDate, -7 * n);
    const jitter = 0.8 + ((h + n * 13) % 40) / 100;
    return { date: shortDate(date).slice(4), qty: Math.max(0, Math.round(packs * jitter)) };
  });
  const average = Math.round((points.reduce((s, p) => s + p.qty, 0) / points.length) * 10) / 10;
  return {
    history: { dayOfWeek: `${longDay(cycle.deliveryDate)} deliveries`, points, unit: packNoun, average },
    consumption: {
      value: Math.round(need.grams / 100) / 10,
      unit: 'kg',
      window: `${coverLabel(cycle.coverDays)}, until the ${shortDate(cycle.nextDeliveryDate)} delivery`,
      driver: `day plans for ${coverLabel(cycle.coverDays)} × recipes`,
    },
  };
}

function whyFor(need: IngredientNeed, packs: number, onHandGrams: number, cycle: DeliveryCycle): string[] {
  const ing = need.ingredient;
  const out: string[] = [];
  out.push(`${kg(need.grams)} needed ${coverLabel(cycle.coverDays)} for ${usedByLabel(need.usedBy)}`);
  out.push(onHandGrams > 0 ? `${kg(onHandGrams)} on the shelf at Monday's count` : `Nothing on the shelf at Monday's count`);
  out.push(`${packs} × ${ing.pack.label} = ${kg(packs * ing.pack.size)}`);
  for (const e of need.edits) out.push(`Prep list edited ${weekdayLabel(e.date)}: ${e.component} ${e.planned} (Edify ${e.suggested})`);
  for (const l of need.lossFrom) out.push(`${l.component} loses ${l.pct}% in prep; this is the gross weight`);
  return out;
}

function packagingTrust(need: PackagingNeed, cases: number, cycle: DeliveryCycle): TrustPanelData {
  const h = hash(need.item.id);
  const points = [4, 3, 2, 1].map(n => {
    const date = addDays(cycle.deliveryDate, -7 * n);
    const jitter = 0.8 + ((h + n * 13) % 40) / 100;
    return { date: shortDate(date).slice(4), qty: Math.max(0, Math.round(cases * jitter)) };
  });
  const average = Math.round((points.reduce((s, p) => s + p.qty, 0) / points.length) * 10) / 10;
  return {
    history: { dayOfWeek: `${longDay(cycle.deliveryDate)} deliveries`, points, unit: 'cases', average },
    consumption: {
      value: need.units,
      unit: 'units',
      window: `${coverLabel(cycle.coverDays)}, until the ${shortDate(cycle.nextDeliveryDate)} delivery`,
      driver: `trays and portions on the day plans for ${coverLabel(cycle.coverDays)}`,
    },
  };
}

function packagingWhy(need: PackagingNeed, cases: number, onHand: number, cycle: DeliveryCycle): string[] {
  const out: string[] = [];
  out.push(`${need.units} ${need.item.name.toLowerCase()}${need.units === 1 ? '' : 's'} needed ${coverLabel(cycle.coverDays)}`);
  out.push(...need.drivers);
  out.push(onHand > 0 ? `${onHand} ${onHand === 1 ? 'case' : 'cases'} on the shelf at Monday's count` : `Nothing on the shelf at Monday's count`);
  out.push(`${cases} × ${need.item.caseLabel} = ${cases * need.item.caseSize}`);
  return out;
}

function packagingOrder(shopId: string, getRecord: GetRecord): SuggestedOrder | null {
  const profile = PACKAGING_PROFILE;
  const cycle = deliveryCycle(profile);
  const days = cycle.coverDays.filter(d => isShopOpen(shopId, d));
  if (days.length === 0) return null;
  const lines: SuggestedOrderLine[] = [];
  for (const need of computePackagingNeeds(shopId, days, getRecord)) {
    const onHand = onHandCases(need.item.id);
    const cases = casesFor(need.item, need.units, onHand);
    if (cases <= 0) continue;
    const suggestedCases = casesFor(need.item, need.suggestedUnits, onHand);
    const edited = cases !== suggestedCases;
    const perDay = need.units / days.length;
    lines.push({
      id: `fj-line-${profile.id}-${need.item.id}`,
      orderId: `fj-ord-${profile.id}`,
      ingredientId: packagingIngredientId(need.item.id),
      supplierId: profile.id,
      suggestedQty: cases,
      suggestedPar: Math.ceil(need.units / need.item.caseSize),
      currentStockAtSuggestion: onHand,
      stockDataAgeDays: STOCK_COUNTED_DAYS_AGO,
      posDataAvailable: true,
      salesVelocity7d: Math.round(perDay),
      salesVelocity14d: Math.round(perDay),
      confidenceScore: edited ? 'medium' : 'high',
      confidenceFactors: { stocktake: 'aging', pos: 'active', par: 'suggested', variance: edited ? 'moderate' : 'stable' },
      movAutoAdded: false,
      userAction: null,
      finalQty: null,
      dismissReason: null,
      movWarnShown: false,
      whyOverride: packagingWhy(need, cases, onHand, cycle),
      whyHighlight: edited,
      trust: packagingTrust(need, cases, cycle),
    });
  }
  if (lines.length === 0) return null;
  return {
    id: `fj-ord-${profile.id}`,
    supplierId: profile.id,
    state: 'draft',
    deliveryDate: shortDate(cycle.deliveryDate),
    sendTime: minusMins(profile.cutOffTime, 30),
    lines,
  };
}

export function computeFarmerJOrders(shopId: string, getRecord: GetRecord): SuggestedOrder[] {
  const orders: SuggestedOrder[] = [];
  for (const profile of PROFILES) {
    if (profile === PACKAGING_PROFILE) {
      const o = packagingOrder(shopId, getRecord);
      if (o) orders.push(o);
      continue;
    }
    const cycle = deliveryCycle(profile);
    const days = cycle.coverDays.filter(d => isShopOpen(shopId, d));
    if (days.length === 0) continue;
    const needs = computeIngredientNeeds(shopId, days, getRecord);
    const lines: SuggestedOrderLine[] = [];
    for (const need of Object.values(needs)) {
      const ing = need.ingredient;
      if (ing.supplier !== profile.matches) continue;
      const onHandGrams = onHandPacks(ing) * ing.pack.size;
      const packs = Math.max(0, Math.ceil((need.grams - onHandGrams) / ing.pack.size - 0.001));
      if (packs <= 0) continue;
      const suggestedPacks = Math.max(0, Math.ceil((need.suggestedGrams - onHandGrams) / ing.pack.size - 0.001));
      const edited = need.edits.length > 0 && packs !== suggestedPacks;
      const perDayKg = need.grams / 1000 / days.length;
      const packNoun = ing.pack.label.replace(/^[\d.,]+\s*(kg|g|ml|l|L)\s*/i, '').trim() || 'pack';
      lines.push({
        id: `fj-line-${profile.id}-${ing.id}`,
        orderId: `fj-ord-${profile.id}`,
        ingredientId: orderIngredientId(ing.id),
        supplierId: profile.id,
        suggestedQty: packs,
        suggestedPar: Math.round(need.grams / 100) / 10,
        currentStockAtSuggestion: Math.round(onHandGrams / 100) / 10,
        stockDataAgeDays: STOCK_COUNTED_DAYS_AGO,
        posDataAvailable: true,
        salesVelocity7d: Math.round(perDayKg * 10) / 10,
        salesVelocity14d: Math.round(perDayKg * 10) / 10,
        confidenceScore: edited ? 'medium' : 'high',
        confidenceFactors: { stocktake: 'aging', pos: 'active', par: 'suggested', variance: edited ? 'moderate' : 'stable' },
        movAutoAdded: false,
        userAction: null,
        finalQty: null,
        dismissReason: null,
        movWarnShown: false,
        whyOverride: whyFor(need, packs, onHandGrams, cycle),
        whyHighlight: edited,
        trust: trustFor(need, packs, cycle, plural(packNoun)),
      });
    }
    if (lines.length === 0) continue;
    lines.sort((a, b) => b.suggestedQty * (FJ_ORDER_PRODUCTS.find(p => p.ingredientId === b.ingredientId)?.unitCost ?? 0) - a.suggestedQty * (FJ_ORDER_PRODUCTS.find(p => p.ingredientId === a.ingredientId)?.unitCost ?? 0));
    orders.push({
      id: `fj-ord-${profile.id}`,
      supplierId: profile.id,
      state: 'draft',
      deliveryDate: shortDate(cycle.deliveryDate),
      sendTime: minusMins(profile.cutOffTime, 30),
      lines,
    });
  }
  return orders;
}

/** Suggested pars for the catalogue: the current cycle's need per ingredient. */
export function applySuggestedPars(orders: SuggestedOrder[]): void {
  for (const o of orders) {
    for (const l of o.lines) {
      const ing = FJ_ORDER_INGREDIENTS.find(i => i.id === l.ingredientId) ?? FJ_PACKAGING_INGREDIENTS.find(i => i.id === l.ingredientId);
      if (ing) ing.parLevel = l.suggestedPar;
    }
  }
}

// ─── Forecast strip ──────────────────────────────────────────────────────────

function vsLastWeek(pct: number, date: string): string {
  if (pct === 0) return `level with last ${weekdayLabel(date)}`;
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% vs last ${weekdayLabel(date)}`;
}

export function farmerJForecastCards(shopId: string, getRecord: GetRecord, today = FJ_DEMO_TODAY): ForecastCardData[] {
  const out: ForecastCardData[] = [];
  for (let n = 0; out.length < 6 && n < 9; n++) {
    const date = addDays(today, n);
    if (!isShopOpen(shopId, date)) continue;
    const plan = computeDayPlan(shopId, date, getRecord(shopId, date), getRecord(shopId, addDays(date, -1)).close);
    const lastWeek = daySales(shopId, addDays(date, -7)).net;
    const pct = lastWeek > 0 ? Math.round(((plan.demand.net - lastWeek) / lastWeek) * 100) : 0;
    out.push({
      label: n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : weekdayLabel(date),
      date: shortDate(date),
      netSales: Math.round(plan.demand.net),
      covers: Math.round(plan.demand.trays),
      comparison: vsLastWeek(pct, date),
      detail: `${Math.round(plan.demand.trays)} trays · ${plan.totals.batches} batches · ${vsLastWeek(pct, date)}`,
    });
  }
  return out;
}

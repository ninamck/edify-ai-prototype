import { ESTATE_SITES } from '@/components/Stock/fixtures';
import type { StockItem } from '@/components/Stock/status';
import { MOCK_POS } from '@/components/Receiving/mockData';
import { MOCK_INSTANCES, MOCK_TEMPLATES } from '@/app/checklists/mockData';
import { buildFixtures } from '@/app/assisted-ordering/basket/fixtures';
import type { SnapStockRow, StockKind } from '../types';
import type {
  WorldBench, WorldChecklist, WorldCountList, WorldDelivery, WorldHot, WorldState, WorldTransfer,
} from './worldTypes';

export const HOME_SITE_ID = 'fitzroy-espresso';

const MASS: Record<string, number> = { g: 0.001, kg: 1 };
const VOLUME: Record<string, number> = { mL: 0.001, ml: 0.001, L: 1, l: 1 };

function unitsFor(item: StockItem): SnapStockRow['units'] {
  const out: SnapStockRow['units'] = [{ unit: item.stockUnit, inStockUnits: 1 }];
  for (const alt of item.alternateUnits) {
    const explicit = item.unitConversions?.[alt];
    if (explicit !== undefined) {
      out.push({ unit: alt, inStockUnits: explicit });
      continue;
    }
    if (alt in MASS && item.stockUnit in MASS) out.push({ unit: alt, inStockUnits: MASS[alt] / MASS[item.stockUnit] });
    else if (alt in VOLUME && item.stockUnit in VOLUME) out.push({ unit: alt, inStockUnits: VOLUME[alt] / VOLUME[item.stockUnit] });
  }
  return out;
}

/** The estate data has croissants at 0, which would take the most common
 *  demo phrase ("3 croissants out of date") below zero. */
const DEMO_ON_HAND: Record<string, number> = { 'ing-croissants': 4 };

function stockRow(item: StockItem): SnapStockRow {
  return {
    id: item.id,
    name: item.name,
    variant: item.variant,
    kind: item.type as StockKind,
    unit: item.stockUnit,
    units: unitsFor(item),
    onHand: DEMO_ON_HAND[item.id] ?? item.currentStock,
    par: item.parLevel,
    unitPrice: item.unitPrice ?? 0,
    supplierName: item.supplierName,
  };
}

function hhmm(h: number, m = 0): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function atToday(now: Date, h: number, m = 0): string {
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function isoDay(now: Date, offset = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

const HOT_RECIPES = [
  { recipeId: 'hot-toastie', recipeName: 'Ham & cheese toastie', planned: 8 },
  { recipeId: 'hot-sausage-roll', recipeName: 'Sausage roll', planned: 10 },
  { recipeId: 'hot-chicken-wrap', recipeName: 'Hot chicken wrap', planned: 6 },
  { recipeId: 'hot-tomato-soup', recipeName: 'Tomato soup', planned: 5 },
];

/** Hourly batches from 07:00 to 15:00. The one containing now is
 *  current; outside those hours the nearest one is, so the demo always
 *  has a batch on. */
function seedHot(now: Date): WorldHot {
  const first = 7;
  const last = 15;
  const current = Math.min(last, Math.max(first, now.getHours()));
  const batches = [];
  for (let h = first; h <= last; h += 1) {
    const when = h < current ? 'earlier' : h === current ? 'current' : h === current + 1 ? 'next' : 'later';
    batches.push({
      id: `hb-${h}`,
      label: `${hhmm(h)} batch`,
      when: when as 'earlier' | 'current' | 'next' | 'later',
      lines: HOT_RECIPES.map((r, i) => ({
        ...r,
        made: when === 'earlier' ? r.planned - (i === 1 ? 2 : 0) : when === 'current' && i < 2 ? r.planned - 2 : null,
      })),
    });
  }
  return { stationName: 'Hot counter', pcrOn: false, batches };
}

function seedBench(now: Date): WorldBench {
  return {
    name: 'Sandwich bench',
    rows: [
      { id: 'dp-1', recipeName: 'Chicken Avo Sandwich', planned: 24, startedAt: atToday(now, 6, 30), completedAt: atToday(now, 7, 10) },
      { id: 'dp-2', recipeName: 'Chicken Caesar Wrap', planned: 18, startedAt: atToday(now, 7, 15), completedAt: null },
      { id: 'dp-3', recipeName: 'Hummus & roast veg wrap', planned: 12, startedAt: null, completedAt: null },
      { id: 'dp-4', recipeName: 'Egg mayo sandwich', planned: 16, startedAt: null, completedAt: null },
    ],
  };
}

const COUNT_LISTS: Omit<WorldCountList, 'openCountId'>[] = [
  {
    id: 'cl-walkin',
    name: 'Walk-in fridge',
    itemIds: ['ing-chicken', 'ing-cream', 'fe-whole-milk', 'fe-greek-yogurt', 'fe-butter', 'fe-cheddar', 'mp-mozzarella', 'fe-smoked-salmon', 'fe-bacon', 'ing-spinach', 'ing-gruyere', 'fe-eggs'],
  },
  {
    id: 'cl-dry',
    name: 'Dry store',
    itemIds: ['ing-flour', 'ing-tomato-paste', 'ing-coconut-milk', 'fe-penne', 'fe-basmati', 'mp-olive-oil', 'ing-vanilla', 'fe-mayo', 'fe-dijon', 'fe-tea-eb', 'fe-espresso-beans'],
  },
  {
    id: 'cl-bakery',
    name: 'Bakery shelf',
    itemIds: ['ing-croissants', 'fe-sourdough', 'fe-multigrain', 'fe-bagels', 'fe-muffins'],
  },
  {
    id: 'cl-drinks',
    name: 'Drinks fridge',
    itemIds: ['fe-coke', 'fe-coke-diet', 'fe-sparkling', 'fe-still-water', 'fe-oj', 'fe-aj', 'ing-oatmilk', 'fe-almond-milk'],
  },
];

/** Natoora isn't in the receiving fixtures, so its order lives here: 12
 *  lines, due today, matching the example Nina gave. */
const NATOORA: WorldDelivery = {
  id: 'del-natoora',
  poNumber: 'PO-2918',
  supplierName: 'Natoora',
  due: 'today',
  dueLabel: 'Due today',
  requiresReference: false,
  status: 'pending',
  lines: [
    { id: 'nt-1', name: 'Baby spinach 1kg box', unit: 'box', price: 7.4, ordered: 3, status: 'pending', stockItemId: 'ing-spinach', stockPerUnit: 1 },
    { id: 'nt-2', name: 'Cherry tomatoes 250g punnet', unit: 'punnet', price: 1.6, ordered: 8, status: 'pending', stockItemId: 'fe-cherry-toms', stockPerUnit: 0.25 },
    { id: 'nt-3', name: 'Hass avocados', unit: 'each', price: 0.85, ordered: 24, status: 'pending', stockItemId: 'ing-avocado', stockPerUnit: 1 },
    { id: 'nt-4', name: 'Unwaxed lemons', unit: 'each', price: 0.3, ordered: 20, status: 'pending', stockItemId: 'fe-lemon', stockPerUnit: 1 },
    { id: 'nt-5', name: 'Romaine lettuce', unit: 'head', price: 1.1, ordered: 12, status: 'pending', stockItemId: 'fe-romaine', stockPerUnit: 1 },
    { id: 'nt-6', name: 'Cucumbers', unit: 'each', price: 0.7, ordered: 10, status: 'pending', stockItemId: 'fe-cucumber', stockPerUnit: 1 },
    { id: 'nt-7', name: 'Mixed berries 250g punnet', unit: 'punnet', price: 2.9, ordered: 8, status: 'pending', stockItemId: 'fe-berries', stockPerUnit: 0.25 },
    { id: 'nt-8', name: 'Bananas', unit: 'kg', price: 1.3, ordered: 6, status: 'pending', stockItemId: 'fe-bananas', stockPerUnit: 1 },
    { id: 'nt-9', name: 'Wild rocket 1kg box', unit: 'box', price: 8.2, ordered: 2, status: 'pending' },
    { id: 'nt-10', name: 'Flat-leaf parsley', unit: 'bunch', price: 0.9, ordered: 6, status: 'pending' },
    { id: 'nt-11', name: 'Red onions 5kg sack', unit: 'sack', price: 5.5, ordered: 1, status: 'pending' },
    { id: 'nt-12', name: 'Burrata 125g', unit: 'each', price: 2.4, ordered: 10, status: 'pending' },
  ],
};

const RECEIVING_PICKS: { id: string; due: WorldDelivery['due']; dueLabel: string }[] = [
  { id: 'po-1', due: 'today', dueLabel: 'Due today' },
  { id: 'po-2', due: 'future', dueLabel: 'Due tomorrow' },
  { id: 'po-4', due: 'overdue', dueLabel: 'Overdue, due yesterday' },
];

function seedDeliveries(): WorldDelivery[] {
  const out: WorldDelivery[] = [NATOORA];
  for (const pick of RECEIVING_PICKS) {
    const po = MOCK_POS.find((p) => p.id === pick.id);
    if (!po) continue;
    out.push({
      id: `del-${po.id}`,
      poNumber: po.poNumber,
      supplierName: po.supplier,
      due: pick.due,
      dueLabel: pick.dueLabel,
      requiresReference: false,
      status: 'pending',
      lines: po.lines.map((l) => ({
        id: l.id,
        name: l.name,
        unit: l.unit.toLowerCase(),
        price: l.price,
        ordered: l.expectedQty,
        status: 'pending' as const,
      })),
    });
  }
  return out;
}

function seedTransfers(now: Date): WorldTransfer[] {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(7, 0, 0, 0);
  return [
    {
      id: 'tr-1042',
      number: 'TR-1042',
      fromSiteId: 'fitzroy-kings-cross',
      fromSiteName: "Fitzroy King's Cross",
      toSiteId: HOME_SITE_ID,
      toSiteName: 'Fitzroy Espresso',
      sentAt: atToday(now, 8, 10),
      status: 'pending',
      lines: [
        { id: 'trl-1', itemId: 'ing-oatmilk', itemName: 'Oat Milk', qty: 6, unit: 'L' },
        { id: 'trl-2', itemId: 'ing-coconut-milk', itemName: 'Coconut Milk', qty: 12, unit: 'units' },
      ],
    },
    {
      id: 'tr-1043',
      number: 'TR-1043',
      fromSiteId: 'fitzroy-heathrow',
      fromSiteName: 'Fitzroy Heathrow',
      toSiteId: HOME_SITE_ID,
      toSiteName: 'Fitzroy Espresso',
      sentAt: tomorrow.toISOString(),
      status: 'pending',
      lines: [{ id: 'trl-3', itemId: 'ing-chicken', itemName: 'Chicken Breast', qty: 4, unit: 'kg' }],
    },
  ];
}

function seedChecklists(): WorldChecklist[] {
  const out: WorldChecklist[] = [];
  for (const inst of MOCK_INSTANCES) {
    if (inst.site !== 'Fitzroy Espresso' || inst.status === 'complete') continue;
    const tpl = MOCK_TEMPLATES.find((t) => t.id === inst.templateId);
    if (!tpl) continue;
    if (!tpl.questions.every((q) => ['temperature', 'number', 'text', 'checkbox'].includes(q.responseType))) continue;
    const answers: Record<string, string> = {};
    for (const a of inst.answers) {
      if (a.value === null || a.value === '') continue;
      answers[a.questionId] = typeof a.value === 'boolean' ? (a.value ? 'yes' : 'no') : String(a.value);
    }
    out.push({
      instanceId: inst.id,
      name: tpl.name.replace(/\s+—\s+/g, ': '),
      status: inst.status,
      due: inst.dueLabel ?? '',
      questions: tpl.questions.map((q) => ({
        id: q.id,
        name: q.name,
        type: q.responseType,
        mandatory: q.mandatory,
        parentQuestionId: q.parentQuestionId,
        followUps: q.followUpRules.map((r) => ({
          condition: r.condition.type,
          value: typeof r.condition.value === 'number' ? r.condition.value : undefined,
          questionId: r.followUpQuestionId,
        })),
      })),
      answers,
    });
  }
  return out;
}

/** Main's 14 allergens, rolled up per recipe. "May contain" never
 *  repeats a "contains". */
const RECIPE_ALLERGENS = [
  { id: 'rc-chicken-avo', name: 'Chicken Avo Sandwich', allergens: ['Cereals containing gluten', 'Eggs', 'Mustard'], mayContain: ['Sesame Seeds'] },
  { id: 'fe-caesar-wrap', name: 'Chicken Caesar Wrap', allergens: ['Cereals containing gluten', 'Dairy', 'Eggs', 'Fish', 'Mustard'], mayContain: [] },
  { id: 'sr-pesto-base', name: 'Pesto base', allergens: ['Dairy', 'Nuts'], mayContain: ['Peanuts'] },
  { id: 'fe-hummus-base', name: 'Hummus Base', allergens: ['Sesame Seeds'], mayContain: ['Nuts'] },
  { id: 'hot-toastie', name: 'Ham & cheese toastie', allergens: ['Cereals containing gluten', 'Dairy', 'Mustard'], mayContain: ['Sesame Seeds'] },
  { id: 'hot-sausage-roll', name: 'Sausage roll', allergens: ['Cereals containing gluten', 'Sulphites'], mayContain: ['Eggs'] },
  { id: 'hot-chicken-wrap', name: 'Hot chicken wrap', allergens: ['Cereals containing gluten', 'Dairy', 'Soya'], mayContain: [] },
  { id: 'hot-tomato-soup', name: 'Tomato soup', allergens: ['Celery'], mayContain: ['Dairy'] },
];

export function seedWorld(now: Date): WorldState {
  const stock: Record<string, SnapStockRow[]> = {};
  for (const site of ESTATE_SITES) stock[site.siteId] = site.items.map(stockRow);

  const basket = buildFixtures(now);

  return {
    siteId: HOME_SITE_ID,
    sites: ESTATE_SITES.map((s) => ({ id: s.siteId, name: s.siteName })),
    role: 'manager',
    surface: 'app',
    today: isoDay(now),
    stock,
    wasteLog: [],
    countLists: COUNT_LISTS.map((l) => ({ ...l })),
    quickCounts: [],
    stocktakeInProgress: false,
    hot: seedHot(now),
    bench: seedBench(now),
    checklists: seedChecklists(),
    basket: {
      orders: basket.orders.map((o) => ({
        id: o.id,
        supplierId: o.supplierId,
        supplierName: o.supplierName,
        deliveryDate: o.deliveryDate,
        lines: o.lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          packs: l.startQuantity,
          removed: !!l.startsRemoved,
          addedByYou: !!l.addedByYou,
        })),
      })),
      catalogue: basket.catalogue.map((c) => ({
        productId: c.productId,
        supplierId: c.supplierId,
        supplierName: basket.suppliers.find((s) => s.id === c.supplierId)?.name ?? c.supplierId,
        name: c.name,
        orderUnit: c.orderUnit,
        orderUnitPlural: c.orderUnitPlural,
        packSize: c.packSize,
        stockUnit: c.stockUnit,
        unitPrice: c.unitPrice,
      })),
    },
    deliveries: seedDeliveries(),
    transfers: seedTransfers(now),
    transferRequests: [],
    demandAdjustments: [],
    recipes: RECIPE_ALLERGENS,
    proposals: [],
    receipts: [],
  };
}

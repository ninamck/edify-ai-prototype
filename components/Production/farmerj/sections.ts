/**
 * Sections: each person's list for the day, drafted from the day plan and
 * the prep list. Farmer J's equivalent of Pret benches, named by the site.
 *
 *   Hot section        Cook tasks for the hot products, in oven or cooker
 *                      loads, timed off the hourly sales curve so the
 *                      second rice cooker goes on when the first is about
 *                      to run out, not at 08:00 with the rest.
 *   Salads             Kits, then dressing and plating in two waves
 *                      because a dressed salad holds two hours.
 *   Basement prep      Today's prep in the morning, tomorrow's and the
 *                      make-ahead groups in the afternoon.
 *   Second make line   Plating into small containers before open, and
 *                      packing each catering order against its time.
 *
 * AM is before 12:00, PM after. Times are suggestions; the person ticks
 * tasks off and the manager can move a task to another section.
 */

import { batchesToNumber, inputScale, type ProductPlan } from './cascade';
import { computeDayPlan, type DayPlan, type DayRecord } from './FjPlanStore';
import { computePrepDay, qtyLabel, type PrepDay } from './prep';
import { orderBoxesLabel } from './catering';
import { COMPONENTS, CONTAINERS, EQUIPMENT_LIMITS, INGREDIENTS, PRODUCT_GROUP_LABELS, type Component, type Section as SectionId } from './recipes';
import { getShop } from './shops';
import { hhmm } from './fjClock';

export type TaskKind = 'cook' | 'kit' | 'prep' | 'dress' | 'plate' | 'pack';

export type SectionTask = {
  id: string;
  sectionId: SectionId;
  slot: 'am' | 'pm';
  kind: TaskKind;
  title: string;
  qty: string;
  /** Second line under the title: containers, order reference, hold. */
  detail?: string;
  /** Containers this task fills, shown under the quantity. */
  containers?: string;
  startMins: number;
  /** Hands-on minutes for the person. Oven and cooker time is not theirs. */
  durationMins: number;
  /** When a cook load is ready to go to the line. */
  readyMins?: number;
  componentId?: string;
  productId?: string;
  /** Batches this task cooks, for scaling the method card. */
  batches?: number;
  /** Cook programme minutes, for the timer. */
  cookMins?: number;
  /** True when the time comes from the sales curve rather than the open. */
  timed?: boolean;
  /** Cook load n of m for the day. */
  load?: { n: number; of: number };
};

export type SectionDef = { id: SectionId; name: string; person: string };

export type SectionCard = {
  section: SectionDef;
  am: SectionTask[];
  pm: SectionTask[];
  /** Hands-on minutes for the person. */
  totalMins: number;
  /** Cooker and oven minutes the person is not tied up for. */
  passiveMins: number;
  startMins: number;
  endMins: number;
};

export type Nudge = {
  id: string;
  taskId: string;
  atMins: number;
  title: string;
  body: string;
};

export type SectionsDay = {
  shopId: string;
  date: string;
  cards: SectionCard[];
  tasks: SectionTask[];
  nudges: Nudge[];
  openMins: number;
  closeMins: number;
  team: string[];
};

const SECTION_NAMES: Record<SectionId, string> = { hot: 'Hot section', salads: 'Salads', prep: 'Basement prep', second: 'Second make line' };
const SECTION_ORDER: SectionId[] = ['hot', 'salads', 'prep', 'second'];

const TEAMS: Record<string, Record<SectionId, string>> = {
  'fj-marylebone': { hot: 'Tomasz', salads: 'Aisha', prep: 'Marco', second: 'Priya' },
  'fj-paddington': { hot: 'Deniz', salads: 'Chloe', prep: 'Samuel', second: 'Ines' },
  'fj-leadenhall': { hot: 'Kwame', salads: 'Sofia', prep: 'Luca', second: 'Hana' },
};
const NAME_POOL = ['Amara', 'Ben', 'Carla', 'Dev', 'Elif', 'Femi', 'Greta', 'Hugo', 'Ida', 'Jonas', 'Kaya', 'Leo', 'Mia', 'Noor', 'Oscar', 'Pia'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h >>> 0);
}

export function teamFor(shopId: string): Record<SectionId, string> {
  if (TEAMS[shopId]) return TEAMS[shopId];
  const start = hash(shopId) % NAME_POOL.length;
  const pick = (n: number) => NAME_POOL[(start + n * 3) % NAME_POOL.length];
  return { hot: pick(0), salads: pick(1), prep: pick(2), second: pick(3) };
}

export function toMins(hhmmStr: string): number {
  const [h, m] = hhmmStr.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

function cookMinutes(c: Component): number {
  if (!c.cook) return 0;
  return Array.isArray(c.cook.minutes) ? c.cook.minutes[1] : c.cook.minutes;
}

/** Full time a cook load ties up the person: load, cook, rest, transfer. */
function loadMinutes(c: Component): number {
  return 10 + cookMinutes(c) + (c.restMinutes ?? 0);
}

/** Cooker or oven capacity in batches per load, from the Setup screen's
 *  equipment counts. */
function batchesPerLoad(c: Component): number {
  if (c.container === 'blue-box') return c.id === 'rice-cooked' ? EQUIPMENT_LIMITS.riceCookers : 1;
  if (c.container === 'oven-tray' && c.containersPerBatch) {
    return Math.max(1, Math.floor((EQUIPMENT_LIMITS.ovenTrays * EQUIPMENT_LIMITS.ovens) / c.containersPerBatch));
  }
  return 1;
}

/** Hands-on minutes for one cook load: weigh, tray up, load, probe, transfer. */
const HANDS_ON_PER_LOAD = 15;

export function plural(n: number, noun: string): string {
  if (n === 1) return noun;
  return /(x|s|ch|sh)$/.test(noun) ? `${noun}es` : `${noun}s`;
}

function prepMinutes(kind: Component['kind'], gramsMade: number, c: Component): number {
  const kgs = gramsMade / 1000;
  if (c.cook) return 10 + cookMinutes(c) + 3 * kgs;
  switch (kind) {
    case 'kit': return 5 + 2.5 * kgs;
    case 'prep': return 5 + 8 * kgs;
    case 'dressing': return 6 + 5 * kgs;
    case 'mix': return 3 + 3 * kgs;
    default: return 5 + 5 * kgs;
  }
}

const slotFor = (mins: number): 'am' | 'pm' => (mins < 12 * 60 ? 'am' : 'pm');

/**
 * When cumulative sales for a product reach `grams`, using the hourly
 * curve from the reference days. Returns minutes from midnight.
 */
function timeWhenSold(plan: ProductPlan, day: DayPlan, grams: number, pace = 1): number {
  const byHour = day.demand.products[plan.productId]?.byHour ?? {};
  const hours = Object.keys(byHour).map(Number).sort((a, b) => a - b);
  let cum = 0;
  for (const h of hours) {
    const g = (byHour[h] ?? 0) * pace;
    if (cum + g >= grams) {
      const frac = g > 0 ? (grams - cum) / g : 0;
      return h * 60 + Math.round(frac * 60);
    }
    cum += g;
  }
  return hours.length ? (hours[hours.length - 1] + 1) * 60 : 12 * 60;
}

function cookTasks(day: DayPlan, openMins: number, pace: Record<string, number>): { tasks: SectionTask[]; nudges: Nudge[] } {
  const tasks: SectionTask[] = [];
  const nudges: Nudge[] = [];
  for (const plan of day.plans) {
    if (plan.product.section !== 'hot' || !plan.product.countedAs) continue;
    const comp = COMPONENTS[plan.product.countedAs];
    if (!comp) continue;
    const total = batchesToNumber(plan.batches);
    if (total <= 0) continue;
    const perLoad = batchesPerLoad(comp);
    const lead = loadMinutes(comp);
    const batchG = plan.product.batch.fullG;
    let done = 0;
    let load = 1;
    while (done < total - 0.001) {
      const size = Math.min(perLoad, total - done);
      const firstLoad = load === 1;
      // Ready when the line has sold what the earlier loads made, less a
      // margin so the fresh load lands before the last container empties.
      const readyBy = firstLoad ? openMins : timeWhenSold(plan, day, done * batchG * 0.85);
      const startMins = Math.max(openMins - 150, readyBy - lead);
      const sizeLabel = size % 1 === 0 ? `${size}` : `${Math.floor(size)}½`;
      const nContainers = comp.containersPerBatch ? Math.ceil(size * comp.containersPerBatch) : 0;
      const containers = nContainers && comp.container ? `${nContainers} ${plural(nContainers, CONTAINERS[comp.container].name.toLowerCase())}` : undefined;
      const id = `cook-${plan.productId}-${load}`;
      const loadsTotal = Math.ceil(total / perLoad);
      tasks.push({
        id, sectionId: 'hot', slot: slotFor(startMins), kind: 'cook',
        title: plan.product.name,
        qty: `${sizeLabel} ${size === 1 ? 'batch' : 'batches'}`,
        detail: [loadsTotal > 1 ? `Load ${load} of ${loadsTotal}` : undefined, containers, comp.cook ? `${comp.cook.programme}, ${cookMinutes(comp)} min` : undefined].filter(Boolean).join(' · '),
        containers, load: loadsTotal > 1 ? { n: load, of: loadsTotal } : undefined,
        startMins, durationMins: HANDS_ON_PER_LOAD, readyMins: startMins + lead,
        componentId: comp.id, productId: plan.productId, batches: size, cookMins: cookMinutes(comp),
        timed: !firstLoad,
      });
      const p = pace[plan.productId];
      if (!firstLoad && p && p > 1) {
        // Today is selling faster than the reference days: the load is
        // needed earlier than the sheet says.
        const runsOut = timeWhenSold(plan, day, done * batchG * 0.85, p);
        const actualStart = Math.max(openMins, runsOut - lead);
        if (actualStart < startMins) {
          nudges.push({
            id: `nudge-${id}`, taskId: id, atMins: actualStart,
            title: `${plan.product.name}: start load ${load} of ${loadsTotal} now`,
            body: `Selling ${Math.round((p - 1) * 100)}% ahead of the reference days. The sheet says ${hhmm(startMins)}; at today's pace the line empties about ${hhmm(runsOut)}.`,
          });
        }
      }
      done += size;
      load++;
    }
  }
  return { tasks, nudges };
}

function saladTasks(day: DayPlan, prep: PrepDay, openMins: number): SectionTask[] {
  const tasks: SectionTask[] = [];
  let cursor = openMins - 165;
  for (const line of prep.lines) {
    if (line.component.section !== 'salads') continue;
    const mins = Math.round(prepMinutes(line.component.kind, line.gramsMade, line.component));
    tasks.push({
      id: `prep-${line.componentId}`, sectionId: 'salads', slot: 'am', kind: 'kit',
      title: line.component.name, qty: qtyLabel(line),
      detail: line.containers ? `${line.containers.count} ${plural(line.containers.count, line.containers.name.toLowerCase())}` : undefined,
      containers: line.containers ? `${line.containers.count} ${plural(line.containers.count, line.containers.name.toLowerCase())}` : undefined,
      startMins: cursor, durationMins: mins, componentId: line.componentId, batches: line.plannedQty,
    });
    cursor += mins;
  }
  // Dressed salads hold two hours, so the line is dressed in two waves:
  // half before open, the rest as the first wave times out.
  let wave1 = openMins - 30;
  let wave2 = openMins + 100;
  for (const plan of day.plans) {
    if (plan.product.group !== 'salads') continue;
    const units = plan.main.plannedUnits;
    if (units <= 0) continue;
    const first = Math.ceil(units / 2);
    const second = units - first;
    const unitName = plan.main.unitName.toLowerCase();
    const hold = `${plan.product.holdMinutes / 60} hour hold once dressed`;
    const m1 = 3 + 2 * first;
    tasks.push({
      id: `dress-${plan.productId}-1`, sectionId: 'salads', slot: slotFor(wave1), kind: 'dress',
      title: `Dress and plate ${plan.product.name}`, qty: `${first} ${plural(first, unitName)}`, detail: hold,
      startMins: wave1, durationMins: m1, productId: plan.productId,
    });
    wave1 += m1;
    if (second > 0) {
      const m2 = 3 + 2 * second;
      tasks.push({
        id: `dress-${plan.productId}-2`, sectionId: 'salads', slot: slotFor(wave2), kind: 'dress',
        title: `Dress and plate ${plan.product.name}`, qty: `${second} ${plural(second, unitName)}`, detail: hold,
        startMins: wave2, durationMins: m2, productId: plan.productId, timed: true,
      });
      wave2 += m2;
    }
  }
  return tasks;
}

function prepTasks(prep: PrepDay, openMins: number): SectionTask[] {
  const tasks: SectionTask[] = [];
  let amCursor = openMins - 180;
  let pmCursor = 13 * 60;
  for (const line of prep.lines) {
    if (line.component.section !== 'prep') continue;
    const mins = Math.round(prepMinutes(line.component.kind, line.gramsMade, line.component));
    const am = line.reason === 'today';
    const startMins = am ? amCursor : pmCursor;
    if (am) amCursor += mins; else pmCursor += mins;
    tasks.push({
      id: `prep-${line.componentId}`, sectionId: 'prep', slot: am ? 'am' : 'pm', kind: line.component.kind === 'kit' ? 'kit' : 'prep',
      title: line.component.name, qty: qtyLabel(line),
      detail: line.reason === 'tomorrow' ? 'for tomorrow' : line.reason === 'ahead' ? `covers to ${weekdayShort(line.covers[line.covers.length - 1])}` : undefined,
      containers: line.containers ? `${line.containers.count} ${plural(line.containers.count, line.containers.name.toLowerCase())}` : undefined,
      startMins, durationMins: mins, componentId: line.componentId, batches: line.plannedQty, cookMins: line.component.cook ? cookMinutes(line.component) : undefined,
    });
  }
  return tasks;
}

function weekdayShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
}

function secondLineTasks(day: DayPlan, openMins: number): SectionTask[] {
  const tasks: SectionTask[] = [];
  // Plating into small containers, one task per product group, sequenced
  // so the hot food is plated last (closest to open).
  let cursor = openMins - 75;
  for (const group of ['salads', 'bases', 'hot-sides', 'proteins'] as const) {
    const plating = day.plans.filter(p => p.product.group === group && p.second.plannedUnits > 0);
    if (!plating.length) continue;
    const units = plating.reduce((n, p) => n + p.second.plannedUnits, 0);
    const mins = 5 + Math.round(1.5 * units);
    tasks.push({
      id: `plate-${group}`, sectionId: 'second', slot: slotFor(cursor), kind: 'plate',
      title: `Plate ${PRODUCT_GROUP_LABELS[group].toLowerCase()}`, qty: `${units} ${plural(units, 'small container')}`,
      detail: plating.map(p => `${p.second.plannedUnits} ${p.product.name}`).join(', '),
      startMins: cursor, durationMins: mins,
    });
    cursor += mins;
  }
  for (const order of day.activeOrders) {
    const due = toMins(order.time);
    const boxes = order.lines.reduce((n, l) => n + l.qty, 0);
    const mins = 10 + Math.ceil(boxes * 1.5);
    const startMins = due - mins - 20;
    tasks.push({
      id: `pack-${order.id}`, sectionId: 'second', slot: slotFor(startMins), kind: 'pack',
      title: `Pack ${order.customer}`, qty: orderBoxesLabel(order),
      detail: `${order.reference} · ready by ${hhmm(due - 15)} for ${order.time}`,
      startMins, durationMins: mins, timed: true,
    });
  }
  return tasks;
}

export type GetRecord = (shopId: string, date: string) => DayRecord;

/** Today's sales pace against the reference days, per product. Only the
 *  demo day runs hot so the rice prompt has something to say. */
export function paceFor(shopId: string, date: string, isToday: boolean): Record<string, number> {
  if (!isToday) return {};
  return { rice: 1.22, amba: 1.1 };
}

export function computeSectionsDay(shopId: string, date: string, getRecord: GetRecord, isToday: boolean): SectionsDay {
  const shop = getShop(shopId);
  const openMins = toMins(shop?.opensAt ?? '11:00');
  const closeMins = toMins(shop?.closesAt ?? '19:00');
  const record = getRecord(shopId, date);
  const yesterday = getRecord(shopId, addDaysIso(date, -1));
  const day = computeDayPlan(shopId, date, record, yesterday.close);
  const prep = computePrepDay(shopId, date, getRecord);
  const pace = paceFor(shopId, date, isToday);

  const cook = cookTasks(day, openMins, pace);
  const all = [...cook.tasks, ...saladTasks(day, prep, openMins), ...prepTasks(prep, openMins), ...secondLineTasks(day, openMins)];

  // Manager moves live in the record: task id → section id.
  const moved = record.reassigned ?? {};
  for (const t of all) {
    const to = moved[t.id] as SectionId | undefined;
    if (to && SECTION_ORDER.includes(to)) t.sectionId = to;
  }

  const team = teamFor(shopId);
  const people = record.people ?? {};
  const order = record.taskOrder ?? {};
  const cards: SectionCard[] = SECTION_ORDER.map(id => {
    const mine = all.filter(t => t.sectionId === id).sort((a, b) => a.startMins - b.startMins);
    const am = applyOrder(mine.filter(t => t.slot === 'am'), order[listKey(id, 'am')]);
    const pm = applyOrder(mine.filter(t => t.slot === 'pm'), order[listKey(id, 'pm')]);
    const totalMins = mine.reduce((n, t) => n + t.durationMins, 0);
    const passiveMins = mine.reduce((n, t) => n + (t.readyMins ? Math.max(0, t.readyMins - t.startMins - t.durationMins) : 0), 0);
    const startMins = mine.length ? Math.min(...mine.map(t => t.startMins)) : openMins - 180;
    const endMins = mine.length ? Math.max(...mine.map(t => t.readyMins ?? t.startMins + t.durationMins)) : openMins;
    return { section: { id, name: SECTION_NAMES[id], person: people[id] ?? team[id] }, am, pm, totalMins, passiveMins, startMins, endMins };
  });

  return {
    shopId, date, cards, tasks: all, nudges: cook.nudges, openMins, closeMins,
    team: Array.from(new Set([...Object.values(team), ...NAME_POOL.slice(0, 4)])),
  };
}

export function listKey(sectionId: SectionId, slot: 'am' | 'pm'): string {
  return `${sectionId}::${slot}`;
}

/** Rows the manager has dragged lead in that order; anything new keeps
 *  its time order at the tail. */
function applyOrder(rows: SectionTask[], order: string[] | undefined): SectionTask[] {
  if (!order || order.length === 0) return rows;
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...rows].sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length));
}

export type ScaledInput = { name: string; grams: number; label: string };

/** What goes into this task, scaled to its batches. Sub-recipes stay as
 *  one line (the rice kit, not rice plus za'atar). */
export function inputsForTask(task: SectionTask): ScaledInput[] {
  const comp = task.componentId ? COMPONENTS[task.componentId] : undefined;
  if (!comp) return [];
  const batches = (task.batches ?? 1) * inputScale(comp);
  return comp.inputs.map(l => {
    const grams = l.grams * batches;
    const sub = COMPONENTS[l.ref];
    const ing = INGREDIENTS[l.ref];
    const name = sub?.name ?? ing?.name ?? l.ref.replace(/-/g, ' ');
    return { name, grams, label: gramsLabel(grams) };
  });
}

export function gramsLabel(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(grams >= 10000 ? 0 : 1)} kg`;
  return `${Math.round(grams)} g`;
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Full-batch quantities in a method step, rewritten for a half batch or
 *  several batches. Steps carry "(half: …)" hints from the HTC sheets. */
export function scaleStep(step: string, batches: number): string {
  if (batches === 0.5) {
    // "7000 g (half: 3500 g)" and "one kit (7140 g; half 3570 g)" both
    // become the half figure.
    return kilos(step
      .replace(/(\d[\d,.]*\s?(?:g|kg|ml|L)?)\s*\([^)]*?(?:half|½):?\s*([^);]+?)\s*\)/gi, '$2')
      .replace(/\s*\([^)]*(?:half|½)[^)]*\)/gi, ''));
  }
  // "(7140 g; half 3570 g)" keeps the full figure; "(half: 3500 g)" goes.
  let s = step
    .replace(/\(([^)]*?)\s*;\s*(?:half|½)[^)]*\)/gi, '($1)')
    .replace(/\s*\(\s*(?:half|½):?[^)]*\)/gi, '');
  if (batches !== 1) {
    s = s.replace(/(\d[\d,]*(?:\.\d+)?)\s?(g|kg|ml|L)\b/g, (_m, n: string, u: string) => {
      const v = Number(n.replace(/,/g, '')) * batches;
      return `${Number.isInteger(v) ? v : v.toFixed(1)} ${u}`;
    });
    if (batches > 1) s = s.replace(/\bone (kit|bag|tray|tub|box|can|tin)\b/gi, (_m, w: string) => `${batchWord(batches)} ${w}s`);
  }
  return kilos(s);
}

/** 2 → "2", 1.5 → "1½". */
export function batchWord(batches: number): string {
  if (Number.isInteger(batches)) return `${batches}`;
  return batches === 0.5 ? '½' : `${Math.floor(batches)}½`;
}

/** Gram figures of a kilo or more read as kilos. */
function kilos(s: string): string {
  return s.replace(/(\d[\d,]*(?:\.\d+)?)\s?g\b/g, (_m, n: string) => {
    const v = Number(n.replace(/,/g, ''));
    if (v < 1000) return `${v} g`;
    const k = v / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1).replace(/\.0$/, '')} kg`;
  });
}

/** The method for a task: the HTC steps scaled to its batches, or a
 *  plain sequence built from what the recipe record knows when the sheet
 *  has no steps yet. */
export function stepsForTask(task: SectionTask): string[] {
  const comp = task.componentId ? COMPONENTS[task.componentId] : undefined;
  const batches = task.batches ?? 1;
  if (comp?.steps) return comp.steps.map(s => scaleStep(s, batches));
  const out: string[] = [];
  const into = comp?.container && comp.containersPerBatch
    ? `${Math.ceil(batches * comp.containersPerBatch)} ${plural(Math.ceil(batches * comp.containersPerBatch), CONTAINERS[comp.container].name.toLowerCase())}`
    : undefined;
  if (comp) {
    for (const l of inputsForTask(task)) out.push(`Weigh ${l.label} ${l.name.toLowerCase()}`);
    if (comp.cook) {
      out.push(`Load the ${comp.cook.programme.toLowerCase()}`);
      out.push(`Cook ${Array.isArray(comp.cook.minutes) ? `${comp.cook.minutes[0]} to ${comp.cook.minutes[1]}` : comp.cook.minutes} min${comp.cook.coreTempC ? `, probe to ${comp.cook.coreTempC}°C` : ''}`);
      if (comp.restMinutes) out.push(`Rest ${comp.restMinutes} min`);
    } else if (comp.kind === 'dressing') {
      out.push('Blend until smooth');
    } else if (comp.kind === 'kit' || comp.kind === 'mix') {
      out.push('Mix through');
    }
    out.push(into ? `Into ${into}, lid on, label` : 'Lid on, label');
    return out;
  }
  if (task.kind === 'dress') return ['Dress the kit', `Plate ${task.qty}`, 'Label with the time dressed'];
  if (task.kind === 'plate') return [...(task.detail?.split(', ').map(s => `Plate ${s}`) ?? []), 'Lid on, label, to the second make line fridge'];
  if (task.kind === 'pack') return [`Pack ${task.qty}`, task.detail ?? '', 'Seal and label with the order reference'].filter(Boolean);
  return task.detail ? [task.detail] : [];
}

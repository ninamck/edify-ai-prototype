/**
 * Sections: each person's list for the day, drafted from the day plan and
 * the prep list. The cards are the shop's benches (site settings, edited
 * on Setup > Benches and the shop's own Settings), each taking work by
 * role:
 *
 *   hot          Cook tasks for the hot products, in oven or cooker loads,
 *                timed off the hourly sales curve so the second rice
 *                cooker goes on when the first is about to run out.
 *   salads       Kits, then dressing and plating in two waves because a
 *                dressed salad holds two hours.
 *   prep         Today's prep in the morning, tomorrow's and the
 *                make-ahead groups in the afternoon.
 *   second       Plating into small containers before open, and packing
 *                each catering order against its time. The second make
 *                line takes this, so a line is on the board too.
 *   breakfast    Breakfast shops only. Cooks the shakshuka, eggs, bacon
 *                and porridge for a 07:30 open; the lunch benches start
 *                later.
 *
 * Every task is drafted with a role; the bench that takes the role at this
 * shop is its card. A shop that merges salads into its prep bench ticks
 * both roles on one bench. AM is before 12:00, PM after. Times are
 * suggestions; the person ticks tasks off and the manager can move a task
 * to another bench.
 */

import { batchesToNumber, fullLineUnits, halfLineUnits, inputScale, mainUnitName, type ProductPlan } from './cascade';
import { computeDayPlan, type DayPlan, type DayRecord } from './FjPlanStore';
import { computePrepDay, qtyLabel, type PrepDay } from './prep';
import { orderBoxCount, orderBoxesLabel } from './catering';
import { COMPONENTS, CONTAINERS, INGREDIENTS, PRODUCT_GROUP_LABELS, PRODUCTS, type Component, type Section as SectionId } from './recipes';
import { batchesPerLoadFor, kitFor, type ShopKit } from './kit';
import { bookEquipment } from './recipeBridge';
import { getShop } from './shops';
import { hhmm } from './fjClock';
import { stationForRole, stationsFor, type Station } from './stations';

export type TaskKind = 'cook' | 'kit' | 'prep' | 'dress' | 'plate' | 'pack';

export type SectionTask = {
  id: string;
  /** The bench this task sits on (a bench id from the site settings). */
  sectionId: string;
  /** The kind of work, which is what routed it to the bench. */
  role: SectionId;
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

export type SectionDef = {
  /** Bench id, or `unassigned-<role>` when no bench takes the role. */
  id: string;
  name: string;
  person: string;
  roles: SectionId[];
  /** True when no bench at this shop takes this work. */
  unassigned?: boolean;
  /** Kit on the bench, for the card header. */
  kit?: Station['kit'];
};

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

const ROLE_NAMES: Record<SectionId, string> = { breakfast: 'Breakfast', hot: 'Hot cooking', salads: 'Salads', prep: 'Prep', second: 'Second line' };
const ROLE_ORDER: SectionId[] = ['breakfast', 'hot', 'salads', 'prep', 'second'];

/** The lunch line opens at 11:00 whatever time the shop opens for breakfast. */
const LUNCH_OPEN_MINS = 11 * 60;

const TEAMS: Record<string, Record<SectionId, string>> = {
  'fj-marylebone': { breakfast: 'Nadia', hot: 'Tomasz', salads: 'Aisha', prep: 'Marco', second: 'Priya' },
  'fj-paddington': { breakfast: 'Ruth', hot: 'Deniz', salads: 'Chloe', prep: 'Samuel', second: 'Ines' },
  'fj-leadenhall': { breakfast: 'Omar', hot: 'Kwame', salads: 'Sofia', prep: 'Luca', second: 'Hana' },
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
  return { breakfast: pick(4), hot: pick(0), salads: pick(1), prep: pick(2), second: pick(3) };
}

/** Components only breakfast products use: their prep sits with the breakfast person. */
const BREAKFAST_COMPONENT_IDS: Set<string> = (() => {
  const bf = new Set<string>();
  const other = new Set<string>();
  for (const p of PRODUCTS) for (const l of p.recipe) (p.group === 'breakfast' ? bf : other).add(l.ref);
  return new Set([...bf].filter(id => !other.has(id)));
})();

export function isBreakfastComponent(id: string): boolean {
  return BREAKFAST_COMPONENT_IDS.has(id);
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

/** Cooker or oven capacity in batches per load: the kit the recipe needs
 *  (its class default or its own override) against the kit this shop's
 *  benches own. */
function batchesPerLoad(c: Component, kit: ShopKit): number {
  return batchesPerLoadFor(kit, c.requiresEquipment ?? bookEquipment(c), c.containersPerBatch);
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

function cookTasks(day: DayPlan, lunchOpenMins: number, breakfastOpenMins: number, pace: Record<string, number>, kit: ShopKit): { tasks: SectionTask[]; nudges: Nudge[] } {
  const tasks: SectionTask[] = [];
  const nudges: Nudge[] = [];
  for (const plan of day.plans) {
    const breakfast = plan.product.section === 'breakfast';
    if ((plan.product.section !== 'hot' && !breakfast) || !plan.product.countedAs) continue;
    const comp = COMPONENTS[plan.product.countedAs];
    if (!comp || !comp.cook) continue;
    const openMins = breakfast ? breakfastOpenMins : lunchOpenMins;
    const sectionId: SectionId = breakfast ? 'breakfast' : 'hot';
    const total = batchesToNumber(plan.batches);
    if (total <= 0) continue;
    const perLoad = batchesPerLoad(comp, kit);
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
      const sizeLabel = size % 1 === 0 ? `${size}` : `${Math.floor(size) || ''}½`;
      const nContainers = comp.containersPerBatch ? Math.ceil(size * comp.containersPerBatch) : 0;
      const containers = nContainers && comp.container ? `${nContainers} ${plural(nContainers, CONTAINERS[comp.container].name.toLowerCase())}` : undefined;
      const id = `cook-${plan.productId}-${load}`;
      const loadsTotal = Math.ceil(total / perLoad);
      tasks.push({
        id, sectionId, role: sectionId, slot: slotFor(startMins), kind: 'cook',
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

  // Hot components no product counts as its own (poached eggs go into
  // three breakfast items): one load before open, sized from the cascade.
  const counted = new Set(day.plans.map(p => p.product.countedAs));
  for (const need of Object.values(day.explosion.components)) {
    const comp = need.component;
    if (comp.section !== 'hot' || !comp.cook || counted.has(comp.id)) continue;
    const total = batchesToNumber(need.batches);
    if (total <= 0) continue;
    const breakfast = isBreakfastComponent(comp.id);
    const openMins = breakfast ? breakfastOpenMins : lunchOpenMins;
    const perLoad = batchesPerLoad(comp, kit);
    const lead = loadMinutes(comp);
    const loadsTotal = Math.ceil(total / perLoad);
    let done = 0;
    for (let load = 1; done < total - 0.001; load++) {
      const size = Math.min(perLoad, total - done);
      const startMins = openMins - lead - 10 * (loadsTotal - load);
      const sizeLabel = size % 1 === 0 ? `${size}` : `${Math.floor(size) || ''}½`;
      const nContainers = comp.containersPerBatch ? Math.ceil(size * comp.containersPerBatch) : 0;
      const containers = nContainers && comp.container ? `${nContainers} ${plural(nContainers, CONTAINERS[comp.container].name.toLowerCase())}` : undefined;
      const role: SectionId = breakfast ? 'breakfast' : 'hot';
      tasks.push({
        id: `cook-${comp.id}-${load}`, sectionId: role, role, slot: slotFor(startMins), kind: 'cook',
        title: comp.name,
        qty: `${sizeLabel} ${size === 1 ? 'batch' : 'batches'}`,
        detail: [loadsTotal > 1 ? `Load ${load} of ${loadsTotal}` : undefined, containers, `${comp.cook.programme}, ${cookMinutes(comp)} min`, `for ${need.consumers.map(c => c.name).join(', ')}`].filter(Boolean).join(' · '),
        containers, load: loadsTotal > 1 ? { n: load, of: loadsTotal } : undefined,
        startMins, durationMins: HANDS_ON_PER_LOAD, readyMins: startMins + lead,
        componentId: comp.id, batches: size, cookMins: cookMinutes(comp),
      });
      done += size;
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
      id: `prep-${line.componentId}`, sectionId: 'salads', role: 'salads', slot: 'am', kind: 'kit',
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
    const units = fullLineUnits(plan);
    if (units <= 0) continue;
    const first = Math.ceil(units / 2);
    const second = units - first;
    const unitName = mainUnitName(plan.product);
    const hold = `${plan.product.holdMinutes / 60} hour hold once dressed`;
    const m1 = 3 + 2 * first;
    tasks.push({
      id: `dress-${plan.productId}-1`, sectionId: 'salads', role: 'salads', slot: slotFor(wave1), kind: 'dress',
      title: `Dress and plate ${plan.product.name}`, qty: `${first} ${plural(first, unitName)}`, detail: hold,
      startMins: wave1, durationMins: m1, productId: plan.productId,
    });
    wave1 += m1;
    if (second > 0) {
      const m2 = 3 + 2 * second;
      tasks.push({
        id: `dress-${plan.productId}-2`, sectionId: 'salads', role: 'salads', slot: slotFor(wave2), kind: 'dress',
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
    const role: SectionId = isBreakfastComponent(line.componentId) && am ? 'breakfast' : 'prep';
    tasks.push({
      id: `prep-${line.componentId}`, sectionId: role, role, slot: am ? 'am' : 'pm', kind: line.component.kind === 'kit' ? 'kit' : 'prep',
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
    const plating = day.plans.filter(p => p.product.group === group && halfLineUnits(p) > 0);
    if (!plating.length) continue;
    const units = plating.reduce((n, p) => n + halfLineUnits(p), 0);
    const mins = 5 + Math.round(1.5 * units);
    tasks.push({
      id: `plate-${group}`, sectionId: 'second', role: 'second', slot: slotFor(cursor), kind: 'plate',
      title: `Plate ${PRODUCT_GROUP_LABELS[group].toLowerCase()}`, qty: `${units} ${plural(units, 'small container')}`,
      detail: plating.map(p => `${halfLineUnits(p)} ${p.product.name}`).join(', '),
      startMins: cursor, durationMins: mins,
    });
    cursor += mins;
  }
  for (const order of day.activeOrders) {
    const due = toMins(order.time);
    const boxes = orderBoxCount(order);
    const mins = 10 + Math.ceil(boxes * 1.5);
    const startMins = due - mins - 20;
    tasks.push({
      id: `pack-${order.id}`, sectionId: 'second', role: 'second', slot: slotFor(startMins), kind: 'pack',
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
  const shopOpenMins = toMins(shop?.opensAt ?? '11:00');
  // Lunch sections work to the lunch line's open; a breakfast shop's
  // earlier open only moves the breakfast section.
  const openMins = Math.max(shopOpenMins, LUNCH_OPEN_MINS);
  const closeMins = toMins(shop?.closesAt ?? '19:00');
  const record = getRecord(shopId, date);
  const yesterday = getRecord(shopId, addDaysIso(date, -1));
  const day = computeDayPlan(shopId, date, record, yesterday.close);
  const prep = computePrepDay(shopId, date, getRecord);
  const pace = paceFor(shopId, date, isToday);

  const cook = cookTasks(day, openMins, shopOpenMins, pace, kitFor(shopId));
  const all = [...cook.tasks, ...saladTasks(day, prep, openMins), ...prepTasks(prep, openMins), ...secondLineTasks(day, openMins)];

  // Route each task's role to the bench that takes it at this shop. A role
  // no bench takes gets a card of its own, flagged, so the work still shows.
  const stations = stationsFor(shopId);
  const defs: SectionDef[] = stations.map(st => ({ id: st.id, name: st.name, person: '', roles: st.roles, kit: st.kit }));
  const benchForRole = (role: SectionId): string => {
    const st = stationForRole(stations, role);
    if (st) return st.id;
    const id = `unassigned-${role}`;
    if (!defs.some(d => d.id === id)) defs.push({ id, name: ROLE_NAMES[role], person: '', roles: [role], unassigned: true });
    return id;
  };
  for (const t of all) t.sectionId = benchForRole(t.role);

  // Manager moves live in the record: task id → bench id. Records written
  // before benches carried roles hold a role id; map it to today's bench.
  const moved = record.reassigned ?? {};
  for (const t of all) {
    const to = moved[t.id];
    if (!to) continue;
    if (defs.some(d => d.id === to)) t.sectionId = to;
    else if (ROLE_ORDER.includes(to as SectionId)) t.sectionId = benchForRole(to as SectionId);
  }

  const team = teamFor(shopId);
  const people = record.people ?? {};
  const order = record.taskOrder ?? {};
  // A breakfast-only bench is a card at breakfast shops or when breakfast work exists.
  const breakfastHere = shop?.breakfast || all.some(t => t.role === 'breakfast');
  const shown = defs.filter(d => !(d.roles.length === 1 && d.roles[0] === 'breakfast' && !breakfastHere));
  const cards: SectionCard[] = shown.map(def => {
    const id = def.id;
    const mine = all.filter(t => t.sectionId === id).sort((a, b) => a.startMins - b.startMins);
    const am = applyOrder(mine.filter(t => t.slot === 'am'), order[listKey(id, 'am')]);
    const pm = applyOrder(mine.filter(t => t.slot === 'pm'), order[listKey(id, 'pm')]);
    const totalMins = mine.reduce((n, t) => n + t.durationMins, 0);
    const passiveMins = mine.reduce((n, t) => n + (t.readyMins ? Math.max(0, t.readyMins - t.startMins - t.durationMins) : 0), 0);
    const breakfastOnly = def.roles.length === 1 && def.roles[0] === 'breakfast';
    const open = breakfastOnly ? shopOpenMins : openMins;
    const startMins = mine.length ? Math.min(...mine.map(t => t.startMins)) : open - 180;
    const endMins = mine.length ? Math.max(...mine.map(t => t.readyMins ?? t.startMins + t.durationMins)) : open;
    // Default person: whoever the shop's team has on the bench's first role.
    const lead = def.roles.find(r => team[r]) ?? def.roles[0];
    const person = people[id] ?? people[lead] ?? (lead ? team[lead] : NAME_POOL[hash(id) % NAME_POOL.length]);
    return { section: { ...def, person }, am, pm, totalMins, passiveMins, startMins, endMins };
  });

  return {
    shopId, date, cards, tasks: all, nudges: cook.nudges, openMins: shopOpenMins, closeMins,
    team: Array.from(new Set([...Object.values(team), ...NAME_POOL.slice(0, 4)])),
  };
}

export function listKey(sectionId: string, slot: 'am' | 'pm'): string {
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

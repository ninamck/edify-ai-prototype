/**
 * The pure half of Setup: how the company's kitchen (lines and benches)
 * and make-on days are read from, diffed against and written back to the
 * site settings store. Shared by the Setup screen and the Command Centre
 * so a change typed in chat is the same change, published the same way.
 */

import type { BenchOverlay, EffectiveBench, SiteSettingsOverlay, WindowsOverlay } from '@/components/Settings/siteSettingsStore';
import { EQUIPMENT_CAPACITY_UNIT, EQUIPMENT_LABELS, type BenchKitItem } from '../fixtures';
import { describeMethod, RECIPE_CLASS_BY_ID, resolveEquipment, type RecipeClassId } from '@/components/Recipe/recipeClasses';
import type { SettingsChange } from './fjSettings';
import { FJ_BENCH_TEMPLATES, FJ_DAYS_OF_WEEK, FJ_DEFAULT_WINDOWS, FJ_WORK_ROLE_BY_ID, dayToWeekday, isFjLine } from './fjFixtures';
import { ALL_CHANNELS, CHANNEL_LABELS } from './lines';
import { GROUP_IDS, type MakeOnSchedule } from './makeOn';
import { methodOf, type FjProductionFields } from './recipeBridge';
import { CONTAINERS, SHELF_LIFE_GROUPS, WEEKDAY_LABELS, type ContainerId, type Section as WorkRole, type ShelfLifeGroupId, type Weekday } from './recipes';
import type { SalesChannel } from './salesDay';
import { FJ_ALL_SHOPS_ID, FJ_SHOPS } from './shops';

// ─── Recipes ─────────────────────────────────────────────────────────────────

export const classLabel = (c: RecipeClassId | '') => (c ? RECIPE_CLASS_BY_ID[c].label : '—');
export const kitText = (f: FjProductionFields) => {
  const kit = resolveEquipment(f.recipeClass, f.equipment).map(e => EQUIPMENT_LABELS[e].toLowerCase()).join(', ') || 'none';
  return f.equipment === null ? `${kit} (class default)` : kit;
};
export const groupLabel = (g: ShelfLifeGroupId | '') => (g ? SHELF_LIFE_GROUPS[g].label : '—');
export const containerLabel = (c: ContainerId | '') => (c ? CONTAINERS[c].name : '—');

/** The production fields that differ between two versions of one recipe, as log lines. */
export function diffRecipeFields(name: string, a: FjProductionFields, b: FjProductionFields, shops: string[] = FJ_SHOPS.map(s => s.id)): SettingsChange[] {
  const out: SettingsChange[] = [];
  if (a.yieldLossPct !== b.yieldLossPct) out.push({ field: `${name} yield loss`, from: `${a.yieldLossPct}%`, to: `${b.yieldLossPct}%`, shops });
  if (a.shelfLifeGroup !== b.shelfLifeGroup) out.push({ field: `${name} shelf life`, from: groupLabel(a.shelfLifeGroup), to: groupLabel(b.shelfLifeGroup), shops });
  if (a.halfBatch !== b.halfBatch) out.push({ field: `${name} half batches`, from: a.halfBatch ? 'allowed' : 'not allowed', to: b.halfBatch ? 'allowed' : 'not allowed', shops });
  if (a.outputContainer !== b.outputContainer) out.push({ field: `${name} container`, from: containerLabel(a.outputContainer), to: containerLabel(b.outputContainer), shops });
  if (a.containersPerBatch !== b.containersPerBatch) out.push({ field: `${name} containers per batch`, from: String(a.containersPerBatch || '—'), to: String(b.containersPerBatch || '—'), shops });
  if (a.recipeClass !== b.recipeClass) out.push({ field: `${name} class`, from: classLabel(a.recipeClass), to: classLabel(b.recipeClass), shops });
  const ka = kitText(a);
  const kb = kitText(b);
  if (ka !== kb) out.push({ field: `${name} kit`, from: ka, to: kb, shops });
  if (a.steps.join('\n') !== b.steps.join('\n')) out.push({ field: `${name} method`, from: `${a.steps.length} steps`, to: `${b.steps.length} steps`, shops });
  const ma = describeMethod(methodOf(a));
  const mb = describeMethod(methodOf(b));
  if (ma !== mb) out.push({ field: `${name} method settings`, from: ma, to: mb, shops });
  return out;
}

// ─── Kitchen ─────────────────────────────────────────────────────────────────

/**
 * A station is one entry in the shop's bench list: a line (plates for
 * sales channels, may run half batches) or a bench (cooks or preps). Either
 * can take kinds of work, which puts it on the Sections board, and either
 * can own kit, which sizes cook loads.
 */
export type StationDraft = { id: string; name: string; isLine: boolean; channels: SalesChannel[]; halfBatches: boolean; roles: WorkRole[]; kit: BenchKitItem[] };

export const isChannel = (c: string): c is SalesChannel => (ALL_CHANNELS as string[]).includes(c);
export const isRole = (r: string): r is WorkRole => r in FJ_WORK_ROLE_BY_ID;

export function toStationDraft(b: EffectiveBench): StationDraft {
  return {
    id: b.id, name: b.name, isLine: isFjLine(b),
    channels: (b.channels ?? []).filter(isChannel), halfBatches: Boolean(b.halfBatches),
    roles: (b.sections ?? []).filter(isRole), kit: (b.kit ?? []).map(k => ({ ...k })),
  };
}

export const sameKit = (a: BenchKitItem[] | undefined, b: BenchKitItem[] | undefined) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
export const sameList = (a: string[] | undefined, b: string[] | undefined) => [...(a ?? [])].sort().join() === [...(b ?? [])].sort().join();

/**
 * Write the drafted stations back as a site's overlay, keeping its other
 * settings. Each is diffed against its template so a shop's own overlay
 * still wins where it differs; one without a template is stored whole as
 * an added bench. `siteId` is the company (`fj-all-shops`) from Setup, or
 * one shop when the change is that shop's own.
 */
export function stationsToOverlay(stations: StationDraft[], current: SiteSettingsOverlay | undefined, siteId: string = FJ_ALL_SHOPS_ID): SiteSettingsOverlay {
  const benches: NonNullable<SiteSettingsOverlay['benches']> = {};
  const addedBenches: NonNullable<SiteSettingsOverlay['addedBenches']> = {};
  for (const st of stations) {
    const template = FJ_BENCH_TEMPLATES.find(t => t.id === st.id);
    if (template) {
      const patch: BenchOverlay = { ...(current?.benches?.[st.id] ?? {}) };
      if (st.name === template.name) delete patch.name; else patch.name = st.name;
      if (sameList(st.roles, template.sections)) delete patch.sections; else patch.sections = st.roles;
      if (sameKit(st.kit, template.kit)) delete patch.kit; else patch.kit = st.kit;
      if (st.isLine) {
        if (st.halfBatches === Boolean(template.halfBatches)) delete patch.halfBatches; else patch.halfBatches = st.halfBatches;
        if (st.channels.join() === (template.channels ?? []).join()) delete patch.channels; else patch.channels = st.channels;
      }
      if (Object.keys(patch).length) benches[st.id] = patch;
    } else {
      const added = current?.addedBenches?.[st.id];
      addedBenches[st.id] = st.isLine
        ? {
          id: st.id, siteId, capabilities: ['assemble'], workTypes: ['assemble', 'portion'], equipment: ['prep-table'], online: true, primaryMode: 'variable',
          ...(added ?? {}), name: st.name, halfBatches: st.halfBatches, channels: st.channels, sections: st.roles, kit: st.kit,
        }
        : {
          id: st.id, siteId, capabilities: ['prep'], workTypes: ['mix', 'portion'], online: true, primaryMode: 'variable',
          ...(added ?? {}), name: st.name, sections: st.roles, kit: st.kit,
          equipment: Array.from(new Set([...(added?.equipment ?? ['prep-table']), ...st.kit.map(k => k.equipment)])),
        };
    }
  }
  const next: SiteSettingsOverlay = { ...(current ?? {}) };
  delete next.benches; delete next.benchOrder; delete next.addedBenches;
  if (Object.keys(benches).length) next.benches = benches;
  if (Object.keys(addedBenches).length) next.addedBenches = addedBenches;
  const order = stations.map(st => st.id);
  if (order.join() !== FJ_BENCH_TEMPLATES.map(t => t.id).join()) next.benchOrder = order;
  return next;
}

export function kitLabel(k: BenchKitItem): string {
  const unit = EQUIPMENT_CAPACITY_UNIT[k.equipment];
  return `${k.count}${k.capacity && unit ? ` of ${k.capacity} ${unit}` : ''}`;
}
export const kitSummary = (kit: BenchKitItem[]) => kit.map(k => `${k.count} ${EQUIPMENT_LABELS[k.equipment].toLowerCase()}${k.count === 1 ? '' : 's'}${k.capacity && EQUIPMENT_CAPACITY_UNIT[k.equipment] ? ` of ${k.capacity}` : ''}`).join(', ');
export const rolesText = (roles: WorkRole[]) => (roles.length ? roles.map(r => FJ_WORK_ROLE_BY_ID[r].label.toLowerCase()).join(', ') : 'nothing');
export const channelsText = (channels: SalesChannel[]) => (channels.length ? channels.map(c => CHANNEL_LABELS[c]).join(', ') : 'nothing');

export function diffStations(from: StationDraft[], to: StationDraft[], shops: string[]): SettingsChange[] {
  const out: SettingsChange[] = [];
  const before = new Map(from.map(b => [b.id, b]));
  const after = new Map(to.map(b => [b.id, b]));
  for (const st of to) {
    const prev = before.get(st.id);
    const kind = st.isLine ? 'Line' : 'Bench';
    if (!prev) { out.push({ field: `${kind} added`, from: '—', to: st.name, shops }); continue; }
    if (prev.name !== st.name) out.push({ field: `${kind} name`, from: prev.name, to: st.name, shops });
    if (st.isLine && prev.channels.join() !== st.channels.join()) out.push({ field: `${st.name} plates for`, from: channelsText(prev.channels), to: channelsText(st.channels), shops });
    if (st.isLine && prev.halfBatches !== st.halfBatches) out.push({ field: `${st.name} half batches`, from: prev.halfBatches ? 'on' : 'off', to: st.halfBatches ? 'on' : 'off', shops });
    if (!sameList(prev.roles, st.roles)) out.push({ field: `${st.name} takes`, from: rolesText(prev.roles), to: rolesText(st.roles), shops });
    const a = new Map(prev.kit.map(k => [k.equipment, k]));
    const z = new Map(st.kit.map(k => [k.equipment, k]));
    for (const e of new Set([...a.keys(), ...z.keys()])) {
      const p = a.get(e);
      const n = z.get(e);
      if (p && n && kitLabel(p) === kitLabel(n)) continue;
      out.push({ field: `${st.name} ${EQUIPMENT_LABELS[e].toLowerCase()}s`, from: p ? kitLabel(p) : 'none', to: n ? kitLabel(n) : 'none', shops });
    }
  }
  for (const st of from) if (!after.has(st.id)) out.push({ field: `${st.isLine ? 'Line' : 'Bench'} removed`, from: st.name, to: '—', shops });
  const sameMembers = from.length === to.length && from.every(s => after.has(s.id));
  if (sameMembers && from.map(s => s.id).join() !== to.map(s => s.id).join()) {
    out.push({ field: 'Kitchen order', from: from.map(s => s.name).join(', '), to: to.map(s => s.name).join(', '), shops });
  }
  return out;
}

// ─── Make-on days ────────────────────────────────────────────────────────────

/** A shop's own days, by group. Groups not listed follow the company. */
export type ShopDays = Record<string, Partial<Record<ShelfLifeGroupId, Weekday[]>>>;
export type DaysDraft = { company: MakeOnSchedule; shops: ShopDays };

export const daysLabel = (d: Weekday[]) => (d.length === 7 ? 'Every day' : d.map(x => WEEKDAY_LABELS[x]).join(', ')) || 'None';

const sameDays = (a: Weekday[], b: Weekday[]) => [...a].sort().join() === [...b].sort().join();

export function diffDays(from: DaysDraft, to: DaysDraft): SettingsChange[] {
  const all = FJ_SHOPS.map(s => s.id);
  const out: SettingsChange[] = [];
  for (const g of GROUP_IDS) {
    if (sameDays(from.company.days[g], to.company.days[g])) continue;
    const overridden = Object.entries(to.shops).filter(([, o]) => o[g]).map(([s]) => s);
    out.push({ field: `${SHELF_LIFE_GROUPS[g].label} make-on days`, from: daysLabel(from.company.days[g]), to: daysLabel(to.company.days[g]), shops: all.filter(s => !overridden.includes(s)) });
  }
  if (!sameDays(from.company.deepClean, to.company.deepClean)) {
    out.push({ field: 'Deep clean day', from: daysLabel(from.company.deepClean), to: daysLabel(to.company.deepClean), shops: all });
  }
  const shopIds = new Set([...Object.keys(from.shops), ...Object.keys(to.shops)]);
  for (const shop of shopIds) {
    for (const g of GROUP_IDS) {
      const a = from.shops[shop]?.[g];
      const b = to.shops[shop]?.[g];
      const la = a ? daysLabel(a) : 'default';
      const lb = b ? daysLabel(b) : 'default';
      if (la !== lb) out.push({ field: `${SHELF_LIFE_GROUPS[g].label} make-on days`, from: la, to: lb, shops: [shop] });
    }
  }
  return out;
}

/** Company windows: only what differs from the recipe book's defaults is stored. */
export function withCompanyDays(current: SiteSettingsOverlay | undefined, schedule: MakeOnSchedule): SiteSettingsOverlay {
  const windows: WindowsOverlay = {};
  for (const d of FJ_DAYS_OF_WEEK) {
    const w = dayToWeekday(d);
    const base = FJ_DEFAULT_WINDOWS[d];
    const makeOn: Record<string, boolean> = {};
    for (const g of GROUP_IDS) {
      const on = schedule.days[g].includes(w);
      if (on !== Boolean(base.makeOn[g])) makeOn[g] = on;
    }
    const deep = schedule.deepClean.includes(w);
    const day: WindowsOverlay[typeof d] = {};
    if (Object.keys(makeOn).length) day.makeOn = makeOn;
    if (deep !== Boolean(base.deepClean)) day.deepClean = deep;
    if (Object.keys(day).length) windows[d] = day;
  }
  const next = { ...(current ?? {}) };
  if (Object.keys(windows).length) next.windows = windows; else delete next.windows;
  return next;
}

/** A shop's windows: its overridden groups written for all seven days, the rest inherit. */
export function withShopDays(current: SiteSettingsOverlay | undefined, own: Partial<Record<ShelfLifeGroupId, Weekday[]>>): SiteSettingsOverlay {
  const windows: WindowsOverlay = {};
  for (const d of FJ_DAYS_OF_WEEK) {
    const w = dayToWeekday(d);
    const existing = current?.windows?.[d] ?? {};
    const makeOn: Record<string, boolean> = {};
    for (const [g, list] of Object.entries(own) as [ShelfLifeGroupId, Weekday[]][]) makeOn[g] = list.includes(w);
    const day = { ...existing };
    if (Object.keys(makeOn).length) day.makeOn = makeOn; else delete day.makeOn;
    if (Object.keys(day).length) windows[d] = day;
  }
  const next = { ...(current ?? {}) };
  if (Object.keys(windows).length) next.windows = windows; else delete next.windows;
  return next;
}

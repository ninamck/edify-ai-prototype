import {
  COMPONENTS,
  CONTAINERS,
  DEFAULT_PRODUCTION_DAYS,
  EQUIPMENT_LIMITS,
  PRODUCT_BY_ID,
  SHOP_PRODUCTION_DAY_OVERRIDES,
  type ContainerId,
  type ShelfLifeGroupId,
  type Weekday,
} from './recipes';
import { CHANNEL_LINE } from './sales';
import type { SalesChannel } from './salesDay';
import { FJ_SHOPS } from './shops';

/**
 * Jana's central settings: the rules the recipe book ships with, edited
 * once and published to every shop.
 *
 * Two copies live in the store. `draft` is what Jana is editing on the
 * Setup screen; `published` is what every shop's plan runs on. Publishing
 * copies draft to published and writes a log entry. The engines read the
 * recipe book's module constants, so `applySettings(published)` writes the
 * published values into those constants before anything derives from them
 * (the plan provider does this on every state change). The recipe book's
 * own values are kept in `BASELINE` so a field can be reset.
 */

export type ContainerSetting = { name: string; fillG: number };

export type SettingsValues = {
  /** Trim and cook loss by component id. */
  yieldLossPct: Record<string, number>;
  shelfLife: Record<string, ShelfLifeGroupId>;
  /** Finished products: half batches allowed. */
  halfBatch: Record<string, boolean>;
  productionDays: Record<ShelfLifeGroupId, Weekday[]>;
  shopProductionDays: Record<string, Partial<Record<ShelfLifeGroupId, Weekday[]>>>;
  containers: Record<ContainerId, ContainerSetting>;
  lines: { main: { name: string }; second: { name: string; halfOnly: boolean } };
  channelLine: Record<SalesChannel, 'main' | 'second'>;
  equipment: { riceCookers: number; ovens: number; ovenTrays: number };
};

export type PublishEntry = {
  atISO: string;
  by: string;
  shops: number;
  changes: string[];
};

export type FjSettings = {
  draft: SettingsValues;
  published: SettingsValues;
  log: PublishEntry[];
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function snapshot(): SettingsValues {
  const yieldLossPct: Record<string, number> = {};
  const shelfLife: Record<string, ShelfLifeGroupId> = {};
  for (const c of Object.values(COMPONENTS)) {
    yieldLossPct[c.id] = c.yieldLossPct;
    shelfLife[c.id] = c.shelfLife;
  }
  const halfBatch: Record<string, boolean> = {};
  for (const p of Object.values(PRODUCT_BY_ID)) halfBatch[p.id] = p.halfBatch;
  const containers = Object.fromEntries(
    Object.values(CONTAINERS).map(c => [c.id, { name: c.name, fillG: c.fillG }]),
  ) as Record<ContainerId, ContainerSetting>;
  return {
    yieldLossPct,
    shelfLife,
    halfBatch,
    productionDays: clone(DEFAULT_PRODUCTION_DAYS),
    shopProductionDays: clone(SHOP_PRODUCTION_DAY_OVERRIDES),
    containers,
    lines: { main: { name: 'Main line' }, second: { name: 'Second make line', halfOnly: true } },
    channelLine: clone(CHANNEL_LINE),
    equipment: { riceCookers: EQUIPMENT_LIMITS.riceCookers, ovens: EQUIPMENT_LIMITS.ovens, ovenTrays: EQUIPMENT_LIMITS.ovenTrays },
  };
}

/** What the recipe book ships with. Taken once, before anything is applied. */
export const BASELINE: SettingsValues = snapshot();

export function defaultSettings(): FjSettings {
  return { draft: clone(BASELINE), published: clone(BASELINE), log: [] };
}

/** Fill gaps in a stored settings object (older demos, new fields). */
export function normaliseSettings(s: Partial<FjSettings> | undefined): FjSettings {
  const d = defaultSettings();
  if (!s) return d;
  const merge = (v?: Partial<SettingsValues>): SettingsValues => ({
    ...clone(BASELINE),
    ...(v ?? {}),
    yieldLossPct: { ...BASELINE.yieldLossPct, ...(v?.yieldLossPct ?? {}) },
    shelfLife: { ...BASELINE.shelfLife, ...(v?.shelfLife ?? {}) },
    halfBatch: { ...BASELINE.halfBatch, ...(v?.halfBatch ?? {}) },
    productionDays: { ...clone(BASELINE.productionDays), ...(v?.productionDays ?? {}) },
    containers: { ...clone(BASELINE.containers), ...(v?.containers ?? {}) },
    lines: { main: { ...BASELINE.lines.main, ...(v?.lines?.main ?? {}) }, second: { ...BASELINE.lines.second, ...(v?.lines?.second ?? {}) } },
    channelLine: { ...BASELINE.channelLine, ...(v?.channelLine ?? {}) },
    equipment: { ...BASELINE.equipment, ...(v?.equipment ?? {}) },
  });
  return { draft: merge(s.draft), published: merge(s.published), log: s.log ?? d.log };
}

let appliedJSON = '';

/** Write published values into the recipe book. Idempotent and cheap when nothing changed. */
export function applySettings(v: SettingsValues): void {
  const json = JSON.stringify(v);
  if (json === appliedJSON) return;
  appliedJSON = json;
  for (const c of Object.values(COMPONENTS)) {
    if (v.yieldLossPct[c.id] !== undefined) c.yieldLossPct = v.yieldLossPct[c.id];
    if (v.shelfLife[c.id]) c.shelfLife = v.shelfLife[c.id];
  }
  for (const p of Object.values(PRODUCT_BY_ID)) {
    if (v.halfBatch[p.id] !== undefined) p.halfBatch = v.halfBatch[p.id];
  }
  for (const g of Object.keys(v.productionDays) as ShelfLifeGroupId[]) DEFAULT_PRODUCTION_DAYS[g] = [...v.productionDays[g]];
  for (const k of Object.keys(SHOP_PRODUCTION_DAY_OVERRIDES)) delete SHOP_PRODUCTION_DAY_OVERRIDES[k];
  for (const [shop, o] of Object.entries(v.shopProductionDays)) SHOP_PRODUCTION_DAY_OVERRIDES[shop] = clone(o);
  for (const id of Object.keys(v.containers) as ContainerId[]) {
    if (CONTAINERS[id]) {
      CONTAINERS[id].name = v.containers[id].name;
      CONTAINERS[id].fillG = v.containers[id].fillG;
    }
  }
  for (const ch of Object.keys(v.channelLine) as SalesChannel[]) CHANNEL_LINE[ch] = v.channelLine[ch];
  EQUIPMENT_LIMITS.riceCookers = v.equipment.riceCookers;
  EQUIPMENT_LIMITS.ovens = v.equipment.ovens;
  EQUIPMENT_LIMITS.ovenTrays = v.equipment.ovenTrays;
}

// ─── Diffing, for the publish preview and the log ────────────────────────────

export type SettingsChange = {
  field: string;
  from: string;
  to: string;
  /** Shops affected; every shop unless the change is a per-shop override. */
  shops: string[];
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const daysLabel = (d: Weekday[]) => (d.length === 7 ? 'Every day' : d.map(x => DAYS[x]).join(', ')) || 'None';

export function diffSettings(from: SettingsValues, to: SettingsValues): SettingsChange[] {
  const all = FJ_SHOPS.map(s => s.id);
  const out: SettingsChange[] = [];
  for (const id of Object.keys(to.yieldLossPct)) {
    if (from.yieldLossPct[id] !== to.yieldLossPct[id]) out.push({ field: `${COMPONENTS[id]?.name ?? id} yield loss`, from: `${from.yieldLossPct[id]}%`, to: `${to.yieldLossPct[id]}%`, shops: all });
  }
  for (const id of Object.keys(to.shelfLife)) {
    if (from.shelfLife[id] !== to.shelfLife[id]) out.push({ field: `${COMPONENTS[id]?.name ?? id} shelf life`, from: from.shelfLife[id], to: to.shelfLife[id], shops: all });
  }
  for (const id of Object.keys(to.halfBatch)) {
    if (from.halfBatch[id] !== to.halfBatch[id]) out.push({ field: `${PRODUCT_BY_ID[id]?.name ?? id} half batches`, from: from.halfBatch[id] ? 'allowed' : 'not allowed', to: to.halfBatch[id] ? 'allowed' : 'not allowed', shops: all });
  }
  for (const g of Object.keys(to.productionDays) as ShelfLifeGroupId[]) {
    if (daysLabel(from.productionDays[g]) !== daysLabel(to.productionDays[g])) {
      const overridden = Object.entries(to.shopProductionDays).filter(([, o]) => o[g]).map(([s]) => s);
      out.push({ field: `${g} make-on days`, from: daysLabel(from.productionDays[g]), to: daysLabel(to.productionDays[g]), shops: all.filter(s => !overridden.includes(s)) });
    }
  }
  const shopIds = new Set([...Object.keys(from.shopProductionDays), ...Object.keys(to.shopProductionDays)]);
  for (const shop of shopIds) {
    const groups = new Set([...Object.keys(from.shopProductionDays[shop] ?? {}), ...Object.keys(to.shopProductionDays[shop] ?? {})]) as Set<ShelfLifeGroupId>;
    for (const g of groups) {
      const a = from.shopProductionDays[shop]?.[g];
      const b = to.shopProductionDays[shop]?.[g];
      const la = a ? daysLabel(a) : 'default';
      const lb = b ? daysLabel(b) : 'default';
      if (la !== lb) out.push({ field: `${g} make-on days`, from: la, to: lb, shops: [shop] });
    }
  }
  for (const id of Object.keys(to.containers) as ContainerId[]) {
    const a = from.containers[id];
    const b = to.containers[id];
    if (!a) continue;
    if (a.name !== b.name) out.push({ field: `Container name`, from: a.name, to: b.name, shops: all });
    if (a.fillG !== b.fillG) out.push({ field: `${b.name} fill`, from: `${a.fillG} g`, to: `${b.fillG} g`, shops: all });
  }
  if (from.lines.main.name !== to.lines.main.name) out.push({ field: 'Line name', from: from.lines.main.name, to: to.lines.main.name, shops: all });
  if (from.lines.second.name !== to.lines.second.name) out.push({ field: 'Line name', from: from.lines.second.name, to: to.lines.second.name, shops: all });
  if (from.lines.second.halfOnly !== to.lines.second.halfOnly) out.push({ field: `${to.lines.second.name} half batches only`, from: from.lines.second.halfOnly ? 'on' : 'off', to: to.lines.second.halfOnly ? 'on' : 'off', shops: all });
  for (const ch of Object.keys(to.channelLine) as SalesChannel[]) {
    if (from.channelLine[ch] !== to.channelLine[ch]) out.push({ field: `${ch} plates on`, from: from.channelLine[ch] === 'main' ? to.lines.main.name : to.lines.second.name, to: to.channelLine[ch] === 'main' ? to.lines.main.name : to.lines.second.name, shops: all });
  }
  for (const k of Object.keys(to.equipment) as (keyof SettingsValues['equipment'])[]) {
    if (from.equipment[k] !== to.equipment[k]) out.push({ field: { riceCookers: 'Rice cookers', ovens: 'Ovens', ovenTrays: 'Trays per oven' }[k], from: String(from.equipment[k]), to: String(to.equipment[k]), shops: all });
  }
  return out;
}

export function shopsTouched(changes: SettingsChange[]): string[] {
  return Array.from(new Set(changes.flatMap(c => c.shops)));
}

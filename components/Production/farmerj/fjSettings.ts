import type { SiteSettingsOverlay } from '@/components/Settings/siteSettingsStore';
import { BASELINE_METHOD_DEFAULTS, describeMethod, METHOD_DEFAULTS, METHOD_FIELDS, RECIPE_CLASS_BY_ID, type RecipeClassId, type RecipeMethod } from '@/components/Recipe/recipeClasses';
import { CONTAINERS, type ContainerId } from './recipes';
import type { FjProductionFields } from './recipeBridge';
import { FJ_SHOPS } from './shops';

/**
 * Jana's central settings that are not recipe fields and not site
 * settings: the containers, and the method defaults per recipe class
 * (programme, time, core temp, rest, hold, hand tools) that a recipe
 * inherits unless it sets its own. Recipe-level rules (yield loss,
 * shelf-life group, half batches, output container, class and kit) live on
 * the recipe in the library (see recipeBridge.ts). Lines, kit and make-on
 * days are the shop's benches and production windows in the site settings
 * store (see lines.ts, kit.ts, makeOn.ts and fjFixtures.ts).
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
  containers: Record<ContainerId, ContainerSetting>;
  /** Method a recipe of each class starts from. See `RecipeMethod`. */
  methodDefaults: Record<RecipeClassId, RecipeMethod>;
};

/**
 * Everything a publish touched, as it was before. Revert writes it back.
 * Overlays are keyed by site id; `null` means the site had no overlay.
 */
export type PublishSnapshot = {
  recipes: Record<string, FjProductionFields>;
  overlays: Record<string, SiteSettingsOverlay | null>;
  containers: Record<ContainerId, ContainerSetting>;
  methodDefaults?: Record<RecipeClassId, RecipeMethod>;
};

export type PublishEntry = {
  id: string;
  atISO: string;
  by: string;
  /** The first trading day the change applies to. */
  effectiveFrom: string;
  /** Shops that received the change. */
  shops: string[];
  /** Shops that kept an override of their own, and what. */
  kept: { shopId: string; what: string }[];
  changes: SettingsChange[];
  /** What moved in this window's plans, prep and orders. Filled in after publish. */
  downstream: string[];
  /** Approved shop-days flagged for the GM to re-approve. */
  flagged: { shopId: string; date: string }[];
  before?: PublishSnapshot;
  /** Set when the change was asked for in the Command Centre: what Jana typed. */
  said?: string;
  revertedAtISO?: string;
  /** Set when this entry is itself a revert. */
  revertOf?: string;
};

export type FjSettings = {
  draft: SettingsValues;
  published: SettingsValues;
  log: PublishEntry[];
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function snapshot(): SettingsValues {
  const containers = Object.fromEntries(
    Object.values(CONTAINERS).map(c => [c.id, { name: c.name, fillG: c.fillG }]),
  ) as Record<ContainerId, ContainerSetting>;
  return { containers, methodDefaults: clone(BASELINE_METHOD_DEFAULTS) };
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
    containers: { ...clone(BASELINE.containers), ...(v?.containers ?? {}) },
    methodDefaults: Object.fromEntries(
      (Object.keys(BASELINE.methodDefaults) as RecipeClassId[]).map(id => [id, { ...clone(BASELINE.methodDefaults[id]), ...(v?.methodDefaults?.[id] ?? {}) }]),
    ) as Record<RecipeClassId, RecipeMethod>,
  });
  return { draft: merge(s.draft), published: merge(s.published), log: (s.log ?? d.log).map(normaliseEntry) };
}

/** Entries written before the log carried shops, kept overrides and downstream lines. */
function normaliseEntry(e: Partial<PublishEntry> & { shops?: number | string[]; changes?: string[] | SettingsChange[] }): PublishEntry {
  const changes: SettingsChange[] = ((e.changes ?? []) as Array<string | SettingsChange>).map(c => {
    if (typeof c !== 'string') return c;
    const m = c.match(/^(.*?): (.*?) → (.*)$/);
    return m ? { field: m[1], from: m[2], to: m[3], shops: [] } : { field: c, from: '', to: '', shops: [] };
  });
  return {
    id: e.id ?? `legacy-${e.atISO ?? ''}`,
    atISO: e.atISO ?? '',
    by: e.by ?? 'Jana',
    effectiveFrom: e.effectiveFrom ?? (e.atISO ?? '').slice(0, 10),
    shops: Array.isArray(e.shops) ? e.shops : [],
    kept: e.kept ?? [],
    changes,
    downstream: e.downstream ?? [],
    flagged: e.flagged ?? [],
    before: e.before,
    said: e.said,
    revertedAtISO: e.revertedAtISO,
    revertOf: e.revertOf,
  };
}

let appliedJSON = '';

/** Write published values into the recipe book. Idempotent and cheap when nothing changed. */
export function applySettings(v: SettingsValues): void {
  const json = JSON.stringify(v);
  if (json === appliedJSON) return;
  appliedJSON = json;
  for (const id of Object.keys(v.containers) as ContainerId[]) {
    if (CONTAINERS[id]) {
      CONTAINERS[id].name = v.containers[id].name;
      CONTAINERS[id].fillG = v.containers[id].fillG;
    }
  }
  for (const id of Object.keys(v.methodDefaults) as RecipeClassId[]) {
    if (METHOD_DEFAULTS[id]) METHOD_DEFAULTS[id] = clone(v.methodDefaults[id]);
  }
}

/** One method field as a person reads it, for the log. */
export function methodFieldText(key: keyof RecipeMethod, v: RecipeMethod[keyof RecipeMethod]): string {
  if (key === 'handTools') return (v as string[]).length ? (v as string[]).join(', ') : 'none';
  if (v === '' || v === undefined) return 'not set';
  if (v === 0) return 'off';
  const unit = METHOD_FIELDS.find(f => f.key === key)?.unit;
  if (key === 'holdMinutes' && typeof v === 'number' && v % 60 === 0) return `${v / 60} h`;
  return unit ? `${v}${unit === '°C' ? '' : ' '}${unit}` : String(v);
}

// ─── Diffing, for the publish preview and the log ────────────────────────────

export type SettingsChange = {
  field: string;
  from: string;
  to: string;
  /** Shops affected; every shop unless the change is a per-shop override. */
  shops: string[];
};

export function diffSettings(from: SettingsValues, to: SettingsValues): SettingsChange[] {
  const all = FJ_SHOPS.map(s => s.id);
  const out: SettingsChange[] = [];
  for (const id of Object.keys(to.containers) as ContainerId[]) {
    const a = from.containers[id];
    const b = to.containers[id];
    if (!a) continue;
    if (a.name !== b.name) out.push({ field: `Container name`, from: a.name, to: b.name, shops: all });
    if (a.fillG !== b.fillG) out.push({ field: `${b.name} fill`, from: `${a.fillG} g`, to: `${b.fillG} g`, shops: all });
  }
  for (const id of Object.keys(to.methodDefaults) as RecipeClassId[]) {
    const a = from.methodDefaults[id];
    const b = to.methodDefaults[id];
    if (!a) continue;
    for (const { key, label } of METHOD_FIELDS) {
      if (JSON.stringify(a[key]) === JSON.stringify(b[key])) continue;
      out.push({ field: `${RECIPE_CLASS_BY_ID[id].label} recipes: ${label.toLowerCase()}`, from: methodFieldText(key, a[key]), to: methodFieldText(key, b[key]), shops: all });
    }
  }
  return out;
}

export { describeMethod };

export function shopsTouched(changes: SettingsChange[]): string[] {
  return Array.from(new Set(changes.flatMap(c => c.shops)));
}

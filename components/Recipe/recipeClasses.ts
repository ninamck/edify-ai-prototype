import type { Equipment } from '@/components/Production/fixtures';
import type { Recipe } from './libraryFixtures';

/**
 * Recipe classes: what sort of thing a recipe is in the kitchen, and the
 * kit that sort of thing normally needs. Company-level. A recipe inherits
 * its class's kit and only overrides when it differs (rice is cooked, but
 * in a rice cooker, not an oven).
 *
 * Kit here is the equipment the recipe *needs*; how many of each a shop
 * *owns* lives on the bench (`Bench.kit`), per site. The engine puts the
 * two together: two ovens of six trays and a recipe that fills four trays
 * a batch is three batches a load.
 *
 * Stored on the recipe as `formExtras.advanced.productClass` (the class
 * id) and `formExtras.productionExtras.requiresEquipment` (the override).
 */

export type RecipeClassId = 'cooked' | 'kit' | 'prep' | 'dressing' | 'mix' | 'finished';

export type RecipeClass = {
  id: RecipeClassId;
  label: string;
  /** One line for the picker. */
  description: string;
  /** Kit a recipe of this class needs unless it says otherwise. */
  defaultEquipment: Equipment[];
};

export const RECIPE_CLASSES: RecipeClass[] = [
  { id: 'cooked', label: 'Cooked', description: 'Goes through heat before it is held or plated.', defaultEquipment: ['oven'] },
  { id: 'kit', label: 'Kit', description: 'Weighed and combined ready to cook or plate; no heat.', defaultEquipment: ['prep-table'] },
  { id: 'prep', label: 'Prep', description: 'Washed, cut or sliced ingredients.', defaultEquipment: ['prep-table'] },
  { id: 'dressing', label: 'Dressing', description: 'Blended sauces and dressings.', defaultEquipment: ['food-processor'] },
  { id: 'mix', label: 'Mix', description: 'Dry mixes and seasonings.', defaultEquipment: ['prep-table'] },
  { id: 'finished', label: 'Finished product', description: 'Assembled from components and sold.', defaultEquipment: [] },
];

export const RECIPE_CLASS_BY_ID: Record<RecipeClassId, RecipeClass> = Object.fromEntries(
  RECIPE_CLASSES.map(c => [c.id, c]),
) as Record<RecipeClassId, RecipeClass>;

/** Accepts an id or a label (earlier saves stored the label). */
export function recipeClassFrom(value: string | undefined | null): RecipeClass | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  return RECIPE_CLASSES.find(c => c.id === v || c.label.toLowerCase() === v);
}

export function recipeClassOf(r: Recipe): RecipeClass | undefined {
  return recipeClassFrom(r.formExtras?.advanced?.productClass);
}

/** Kit the recipe needs: its own list when set, else its class's default. */
export function requiredEquipmentOf(r: Recipe): Equipment[] {
  const own = r.formExtras?.productionExtras?.requiresEquipment;
  if (own) return own as Equipment[];
  return recipeClassOf(r)?.defaultEquipment ?? [];
}

/** Kit for a class id with an optional override, for code that holds the
 *  two fields rather than a whole recipe. */
export function resolveEquipment(classId: string | undefined | null, override: Equipment[] | null | undefined): Equipment[] {
  if (override) return override;
  return recipeClassFrom(classId)?.defaultEquipment ?? [];
}

// ─── Method ──────────────────────────────────────────────────────────────────

/**
 * The method settings behind the stepper's chips: which programme the
 * oven runs, how long, the core temperature to probe to, how long it
 * rests, how long it may hold on the line, and the hand tools to get out.
 *
 * Three layers. The company sets a default per class here (Setup, Recipes,
 * Method defaults). A recipe overrides only the fields that differ, on its
 * record (Production settings, Method). The kit the machine is (oven, rice
 * cooker) is the class's `defaultEquipment` and the recipe's kit override,
 * not part of the method.
 *
 * Numbers use '' for "not set". A recipe that sets a number to 0 switches
 * the class default off (a cooked item with no hold).
 */
export type RecipeMethod = {
  /** Oven or cooker programme as the kitchen names it. '' means no cook. */
  programme: string;
  minutesFrom: number | '';
  /** Upper end of a cook range; '' when the time is a single figure. */
  minutesTo: number | '';
  coreTempC: number | '';
  restMinutes: number | '';
  holdMinutes: number | '';
  handTools: string[];
};

export const METHOD_FIELDS: { key: keyof RecipeMethod; label: string; unit?: string }[] = [
  { key: 'programme', label: 'Programme' },
  { key: 'minutesFrom', label: 'Time', unit: 'min' },
  { key: 'minutesTo', label: 'Time, up to', unit: 'min' },
  { key: 'coreTempC', label: 'Core temperature', unit: '°C' },
  { key: 'restMinutes', label: 'Rest', unit: 'min' },
  { key: 'holdMinutes', label: 'Hold', unit: 'min' },
  { key: 'handTools', label: 'Hand tools' },
];

export function emptyMethod(): RecipeMethod {
  return { programme: '', minutesFrom: '', minutesTo: '', coreTempC: '', restMinutes: '', holdMinutes: '', handTools: [] };
}

/** What the recipe book ships with. `METHOD_DEFAULTS` is the live copy Setup publishes into. */
export const BASELINE_METHOD_DEFAULTS: Record<RecipeClassId, RecipeMethod> = {
  cooked: { programme: 'Lunch Program', minutesFrom: 12, minutesTo: '', coreTempC: 75, restMinutes: '', holdMinutes: 120, handTools: ['Tongs', 'Oven gloves', 'Temperature probe'] },
  kit: { ...emptyMethod(), handTools: ['Scale', 'Disposable gloves'] },
  prep: { ...emptyMethod(), handTools: ['Knife', 'Board', 'Scale'] },
  dressing: { ...emptyMethod(), handTools: ['Scale', 'Spatula'] },
  mix: { ...emptyMethod(), handTools: ['Scale', 'Whisk'] },
  finished: emptyMethod(),
};

export const METHOD_DEFAULTS: Record<RecipeClassId, RecipeMethod> = JSON.parse(JSON.stringify(BASELINE_METHOD_DEFAULTS));

/** A recipe's method: its class default with the fields it sets on top. */
export function resolveMethod(classId: string | undefined | null, override: Partial<RecipeMethod> | undefined, defaults: Record<RecipeClassId, RecipeMethod> = METHOD_DEFAULTS): RecipeMethod {
  const cls = recipeClassFrom(classId);
  const base = cls ? defaults[cls.id] : emptyMethod();
  return { ...base, ...(override ?? {}) };
}

/** Only the fields of `m` that differ from the class default. */
export function methodOverrideFor(classId: RecipeClassId, m: RecipeMethod, defaults: Record<RecipeClassId, RecipeMethod> = BASELINE_METHOD_DEFAULTS): Partial<RecipeMethod> {
  const base = defaults[classId];
  const out: Partial<RecipeMethod> = {};
  for (const { key } of METHOD_FIELDS) {
    if (JSON.stringify(m[key]) !== JSON.stringify(base[key])) (out as Record<string, unknown>)[key] = m[key];
  }
  return out;
}

/** A number setting with 0 meaning "off". */
export function methodNumber(v: number | ''): number | undefined {
  return typeof v === 'number' && v > 0 ? v : undefined;
}

/** One line for a chip or a log: "Chicken Program, 12 to 14 min, 78°C core, rest 5 min, hold 2 h". */
export function describeMethod(m: RecipeMethod): string {
  const parts: string[] = [];
  const from = methodNumber(m.minutesFrom);
  const to = methodNumber(m.minutesTo);
  if (m.programme) parts.push(m.programme);
  if (from) parts.push(to && to !== from ? `${from} to ${to} min` : `${from} min`);
  if (methodNumber(m.coreTempC)) parts.push(`${m.coreTempC}°C core`);
  if (methodNumber(m.restMinutes)) parts.push(`rest ${m.restMinutes} min`);
  const hold = methodNumber(m.holdMinutes);
  if (hold) parts.push(hold % 60 === 0 ? `hold ${hold / 60} h` : `hold ${hold} min`);
  if (m.handTools.length) parts.push(m.handTools.join(', '));
  return parts.join(', ') || 'nothing set';
}

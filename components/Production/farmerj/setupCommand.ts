/**
 * Setup from the Command Centre. Jana types what she wants in kitchen
 * language; this works out which Setup setting she means, prefills the
 * same change Setup would make, and publishes it the same way (site
 * settings overlay or recipe field, a Publish log entry, approved days
 * flagged). Setup stays the place to see it all; this is a faster way in.
 *
 *   "move salads onto basement prep"            → the salads work role lands on the prep bench
 *   "Farmers' Rice half batches"                → recipe: half batches allowed
 *   "amba chicken yield loss 35%"               → recipe: yield loss
 *   "coconut chia is a 3-day item"              → recipe: shelf-life group
 *   "broccoli goes in a medium container"       → recipe: output container
 *   "hot section has 3 ovens"                   → bench kit
 *   "add a rice cooker to the hot section"      → bench kit +1
 *   "Deliveroo plates on the second make line"  → line channel
 *   "second make line full batches only"        → line half batches off
 *   "rename basement prep to prep kitchen"      → station name
 *   "add a bench called pastry"                 → new bench
 *   "make 3-day items on Monday and Thursday"   → make-on days
 *   "deep clean on Wednesday"                   → deep clean day
 *   "... at Marylebone"                         → that shop's own setting instead of every shop
 */

import type { Recipe } from '@/components/Recipe/libraryFixtures';
import { MAX_BENCHES, type EffectiveSiteSettings, type SiteSettingsOverlay } from '@/components/Settings/siteSettingsStore';
import type { CommandIntent } from '@/components/Feed/commands/types';
import { EQUIPMENT_LABELS, type BenchKitItem, type Equipment } from '../fixtures';
import { addDays, demoNowISO, FJ_DEMO_TODAY, planningWindowFor } from './calendar';
import type { LineOverride } from './cascade';
import { computeDayPlan, type DayRecord } from './FjPlanStore';
import type { FjSettings, PublishEntry, PublishSnapshot, SettingsChange } from './fjSettings';
import { snapshotImpact, type ImpactSnapshot } from './publishImpact';
import { FJ_BREAKFAST_ID, FJ_HOT_SECTION_ID, FJ_MAIN_LINE_ID, FJ_PREP_KITCHEN_ID, FJ_SALADS_ID, FJ_SECOND_LINE_ID, FJ_WORK_ROLE_BY_ID } from './fjFixtures';
import { CHANNEL_LABELS } from './lines';
import { GROUP_IDS, scheduleFromWindows, type MakeOnSchedule } from './makeOn';
import { productionFieldsOf, withProductionFields, type FjProductionFields } from './recipeBridge';
import { CONTAINERS, SHELF_LIFE_GROUPS, WEEKDAY_LABELS, type ContainerId, type Section as WorkRole, type ShelfLifeGroupId, type Weekday } from './recipes';
import type { SalesChannel } from './salesDay';
import {
  channelsText, containerLabel, daysLabel, diffDays, diffRecipeFields, diffStations, groupLabel, kitSummary, rolesText,
  stationsToOverlay, toStationDraft, withCompanyDays, withShopDays, type DaysDraft, type ShopDays, type StationDraft,
} from './setupModel';
import { FJ_ALL_SHOPS_ID, FJ_SHOPS, getShop } from './shops';

// ─── What Jana can ask for ───────────────────────────────────────────────────

export type FjSetupKind =
  | 'recipe-half' | 'recipe-yield' | 'recipe-shelf' | 'recipe-container' | 'recipe-per-batch' | 'recipe-kit'
  | 'station-role' | 'station-kit' | 'line-channel' | 'line-half' | 'rename' | 'add-station' | 'remove-station'
  | 'make-on' | 'deep-clean';

export type FjSetupArgs = {
  kind?: FjSetupKind;
  /** What was typed, kept for the log. */
  text: string;
  /** One shop's own setting. Undefined means every shop (the company). */
  shopId?: string;
  recipeId?: string;
  /** When the recipe name was close to several, the card asks. */
  recipeOptions?: { id: string; name: string }[];
  on?: boolean;
  pct?: number;
  group?: ShelfLifeGroupId;
  containerId?: ContainerId;
  perBatch?: number;
  equipment?: Equipment;
  /** Bench kit: an absolute count, or a change to it. */
  count?: number;
  delta?: number;
  capacity?: number;
  stationId?: string;
  role?: WorkRole;
  channel?: SalesChannel;
  newName?: string;
  isLine?: boolean;
  days?: Weekday[];
};

export const SETUP_KIND_LABELS: Record<FjSetupKind, string> = {
  'recipe-half': 'Half batches',
  'recipe-yield': 'Yield loss',
  'recipe-shelf': 'Shelf life',
  'recipe-container': 'Container',
  'recipe-per-batch': 'Containers a batch',
  'recipe-kit': 'Kit',
  'station-role': 'Where work lands',
  'station-kit': 'Bench kit',
  'line-channel': 'Where a channel plates',
  'line-half': 'Line half batches',
  'rename': 'Rename',
  'add-station': 'New bench or line',
  'remove-station': 'Remove a bench or line',
  'make-on': 'Make-on days',
  'deep-clean': 'Deep clean day',
};

/** The Setup tab this kind of change lives on. */
export function setupTabFor(kind: FjSetupKind | undefined): 'recipes' | 'kitchen' | 'days' {
  if (!kind) return 'recipes';
  if (kind.startsWith('recipe-')) return 'recipes';
  if (kind === 'make-on' || kind === 'deep-clean') return 'days';
  return 'kitchen';
}

// ─── Vocabulary ──────────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9%]+/g, ' ').replace(/\s+/g, ' ').trim();
const hasWord = (t: string, w: string) => new RegExp(`(^| )${w}( |$)`).test(t);

const STATION_ALIASES: [RegExp, string][] = [
  [/\b(second|2nd|delivery|delivery make) line\b/, FJ_SECOND_LINE_ID],
  [/\b(main|front|first) line\b/, FJ_MAIN_LINE_ID],
  [/\b(hot section|hot bench|hot kitchen)\b/, FJ_HOT_SECTION_ID],
  [/\b(basement prep|prep bench|prep kitchen|prep section|basement)\b/, FJ_PREP_KITCHEN_ID],
  [/\b(salads? bench|salads? section|salads? station)\b/, FJ_SALADS_ID],
  [/\b(breakfast bench|breakfast section|breakfast station)\b/, FJ_BREAKFAST_ID],
];

const ROLE_WORDS: [RegExp, WorkRole][] = [
  [/\b(hot cooking|hot work|hot cooks?|cook loads?|hot)\b/, 'hot'],
  [/\bbreakfast\b/, 'breakfast'],
  [/\bsalads?\b/, 'salads'],
  [/\bprep\b/, 'prep'],
  [/\b(second line work|plating|small containers|catering packing)\b/, 'second'],
];

const CHANNEL_WORDS: [RegExp, SalesChannel][] = [
  [/\bdeliveroo\b/, 'deliveroo'],
  [/\b(click (and|n) collect|click collect|clickcollect|c and c)\b/, 'clickcollect'],
  [/\bcorporate\b/, 'corporate'],
  [/\b(city ?pantry)\b/, 'citypantry'],
  [/\bordit\b/, 'ordit'],
  [/\bkiosk\b/, 'kiosk'],
  [/\b(in store|instore|walk ins?|counter sales|shop floor)\b/, 'instore'],
];

const GROUP_WORDS: [RegExp, ShelfLifeGroupId][] = [
  [/\b(3 day|three day|green)\b/, 'green3'],
  [/\b(4 day|four day|blue)\b/, 'blue4'],
  [/\b(2 day|two day|coconut group)\b/, 'coconut2'],
  [/\b(weekly|7 day|seven day|once a week)\b/, 'weekly'],
  [/\b(daily|same day|1 day|one day|fresh each day)\b/, 'daily'],
];

const CONTAINER_ALIASES: [RegExp, ContainerId][] = [
  [/\b(round cast iron|extra large|xl|x large)\b/, 'round-cast-iron'],
  [/\b(rect(angular)? cast iron|medium cast iron|cast iron|medium)\b/, 'rect-cast-iron'],
  [/\b(large|salad gn|salad tray)\b/, 'salad-gn'],
  [/\b(prep tray|gn 1 1|deep gn)\b/, 'gn-1-1-20'],
  [/\b(small|gn 1 2|half gn|gastronorm)\b/, 'gn-1-2'],
  [/\b(blue box|shari)\b/, 'blue-box'],
  [/\b(10 litre|ten litre|tub)\b/, 'gn-1-6-10'],
  [/\b(squeezy)\b/, 'squeezy-bottle'],
  [/\b(breakfast pot|pot)\b/, 'breakfast-pot'],
  [/\b(oven tray)\b/, 'oven-tray'],
  [/\b(portion)\b/, 'portion'],
  [/\b(dressing bottle|bottle|bottled)\b/, 'dressing-bottle'],
];

const DAY_WORDS: [RegExp, Weekday][] = [
  [/\b(mon|monday|mondays)\b/, 0], [/\b(tue|tues|tuesday|tuesdays)\b/, 1], [/\b(wed|weds|wednesday|wednesdays)\b/, 2],
  [/\b(thu|thur|thurs|thursday|thursdays)\b/, 3], [/\b(fri|friday|fridays)\b/, 4], [/\b(sat|saturday|saturdays)\b/, 5], [/\b(sun|sunday|sundays)\b/, 6],
];

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };

function equipmentIn(t: string): Equipment | undefined {
  // Longest label first so "combi oven" beats "oven", "rice cooker" beats "cooker".
  const labels = (Object.entries(EQUIPMENT_LABELS) as [Equipment, string][])
    .map(([id, label]) => ({ id, w: norm(label) }))
    .sort((a, b) => b.w.length - a.w.length);
  for (const { id, w } of labels) if (new RegExp(`(^| )${w}s?( |$)`).test(t)) return id;
  if (hasWord(t, 'combi')) return 'combi-oven';
  if (hasWord(t, 'cooker') || hasWord(t, 'cookers')) return 'rice-cooker';
  return undefined;
}

export type StationName = { id: string; name: string; isLine: boolean };

/** The station the text points at, preferring one after "on / onto / to / into / at". */
function stationIn(t: string, stations: StationName[]): { id: string; rest: string } | undefined {
  const named = stations.map(s => ({ id: s.id, w: norm(s.name) })).filter(s => s.w.length > 2).sort((a, b) => b.w.length - a.w.length);
  const hits: { id: string; index: number; len: number; afterPrep: boolean }[] = [];
  for (const s of named) {
    const m = new RegExp(`(?:^| )(?:(on|onto|to|into|at|for) (?:the )?)?${s.w}(?: |$)`).exec(t);
    if (m) hits.push({ id: s.id, index: m.index, len: s.w.length, afterPrep: Boolean(m[1]) });
  }
  for (const [re, id] of STATION_ALIASES) {
    const m = new RegExp(`(?:^| )(?:(on|onto|to|into|at|for) (?:the )?)?${re.source.replace(/\\b/g, '')}(?: |$)`).exec(t);
    if (m && stations.some(s => s.id === id) && !hits.some(h => h.id === id)) hits.push({ id, index: m.index, len: m[0].length, afterPrep: Boolean(m[1]) });
  }
  if (!hits.length) return undefined;
  hits.sort((a, b) => Number(b.afterPrep) - Number(a.afterPrep) || b.len - a.len);
  const hit = hits[0];
  const name = named.find(s => s.id === hit.id)?.w;
  const rest = name ? t.replace(new RegExp(`(^| )${name}( |$)`), ' ').replace(/\s+/g, ' ').trim() : t;
  return { id: hit.id, rest: STATION_ALIASES.reduce((acc, [re, id]) => (id === hit.id ? acc.replace(re, ' ') : acc), rest).replace(/\s+/g, ' ').trim() };
}

function shopIn(t: string): { shopId?: string; rest: string; everyShop: boolean } {
  if (/\b(every shop|all shops|all sites|every site|company wide|everywhere)\b/.test(t)) return { rest: t.replace(/\b(every shop|all shops|all sites|every site|company wide|everywhere)\b/, ' ').trim(), everyShop: true };
  const shops = FJ_SHOPS.map(s => ({ id: s.id, w: norm(s.name) })).sort((a, b) => b.w.length - a.w.length);
  for (const s of shops) {
    const re = new RegExp(`(?:^| )(?:(?:at|for|in|only at|just at) (?:the )?)?${s.w}(?: shop| only)?(?: |$)`);
    if (re.test(t)) return { shopId: s.id, rest: t.replace(re, ' ').replace(/\s+/g, ' ').trim(), everyShop: false };
  }
  if (/\b(tcr)\b/.test(t)) return { shopId: 'fj-tottenham-court-rd', rest: t.replace(/\btcr\b/, ' ').trim(), everyShop: false };
  return { rest: t, everyShop: false };
}

const RECIPE_STOP = new Set(['half', 'full', 'batch', 'batches', 'yield', 'loss', 'shelf', 'life', 'container', 'containers', 'tray', 'trays', 'oven', 'cooker', 'make', 'cook', 'cooked', 'roasted', 'item', 'items', 'should', 'goes', 'into', 'with', 'from', 'that', 'this', 'every', 'shop', 'shops', 'line', 'bench', 'section', 'day', 'days', 'group', 'move', 'onto', 'allow', 'allowed', 'turn', 'only', 'medium', 'small', 'large', 'bottle', 'per', 'each', 'dressing', 'kit']);

/**
 * The recipe named in the text: the longest full name that appears, else a
 * component whose first word does. A product and the component behind it
 * share a name ("Amba chicken" / "Amba chicken, cooked"), so both come back
 * as `twins` and the caller picks by what is being set: shelf life and kit
 * live on the component, half batches and containers on the product.
 */
function recipeIn(t: string, recipes: Recipe[]): { id?: string; twins?: Recipe[]; options?: { id: string; name: string }[]; rest: string } {
  const named = recipes.map(r => {
    const full = norm(r.name);
    const core = norm(r.name.split(',')[0]);
    return { r, full, core };
  });
  let best: { r: Recipe; w: string; core: string; score: number } | null = null;
  for (const n of named) {
    for (const [w, bonus] of [[n.full, 10], [n.core, 0]] as [string, number][]) {
      if (w.length < 3 || !hasWord(t, w)) continue;
      const score = w.length + bonus + (n.r.id.startsWith('fj:c:') ? 1 : 0);
      if (!best || score > best.score) best = { r: n.r, w, core: n.core, score };
    }
  }
  if (best) {
    const core = best.core;
    const twins = named.filter(n => n.core === core).map(n => n.r);
    return { id: best.r.id, twins, rest: t.replace(new RegExp(`(^| )${best.w}( |$)`), ' ').replace(/\s+/g, ' ').trim() };
  }
  // A single word Jana would use: "amba", "broccoli", "harissa".
  const tokens = t.split(' ').filter(w => w.length >= 4 && !RECIPE_STOP.has(w));
  const options = new Map<string, Recipe>();
  for (const w of tokens) for (const n of named) if (hasWord(n.core, w)) options.set(n.r.id, n.r);
  const cores = new Set(Array.from(options.values()).map(r => norm(r.name.split(',')[0])));
  if (cores.size === 1) {
    const twins = Array.from(options.values());
    return { id: twins[0].id, twins, rest: t };
  }
  if (options.size > 1) return { options: Array.from(options.values()).slice(0, 8).map(r => ({ id: r.id, name: r.name })), rest: t };
  return { rest: t };
}

/** Of a product and its component, the one the field is set on. */
function pickTwin(kind: FjSetupKind, id: string, twins: Recipe[] | undefined): string {
  if (!twins || twins.length < 2) return id;
  const component = twins.find(r => r.id.startsWith('fj:c:'));
  const product = twins.find(r => r.id.startsWith('fj:p:'));
  const wantsComponent = kind === 'recipe-shelf' || kind === 'recipe-kit' || kind === 'recipe-yield';
  return (wantsComponent ? component?.id ?? product?.id : product?.id ?? component?.id) ?? id;
}

function daysIn(t: string): Weekday[] | undefined {
  if (/\b(every day|all week|each day|daily)\b/.test(t) && /\b(make|made|on|produce)\b/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
  const out = new Set<Weekday>();
  if (/\bweekdays\b/.test(t)) [0, 1, 2, 3, 4].forEach(d => out.add(d as Weekday));
  if (/\bweekends?\b/.test(t)) [5, 6].forEach(d => out.add(d as Weekday));
  for (const [re, d] of DAY_WORDS) if (re.test(t)) out.add(d);
  return out.size ? Array.from(out).sort() : undefined;
}

function numberIn(t: string, after?: RegExp): number | undefined {
  const src = after ? t.replace(after, ' ') : t;
  const m = src.match(/(^| )(\d+(?:\.\d+)?)( |%|$)/);
  if (m) return Number(m[2]);
  for (const [w, n] of Object.entries(NUMBER_WORDS)) if (hasWord(src, w)) return n;
  return undefined;
}

// ─── Parse ───────────────────────────────────────────────────────────────────

export type ParseContext = {
  recipes: Recipe[];
  stations: StationName[];
};

export function parseFjSetup(text: string, ctx: ParseContext): CommandIntent | null {
  const raw = text.trim();
  if (!raw) return null;
  const slash = /^\/setup\b/i.test(raw);
  const body = slash ? raw.replace(/^\/setup\b/i, '').trim() : raw;
  if (slash && !body) return { commandId: 'fj-setup', args: { text: raw } satisfies FjSetupArgs, confidence: 1 };
  let t = norm(body);

  const shop = shopIn(t);
  t = shop.rest;
  const args: FjSetupArgs = { text: raw, shopId: shop.shopId };
  const fjRecipes = ctx.recipes.filter(r => r.brand === 'farmerj');

  // Rename: "rename X to Y", "call the second make line the delivery line".
  const rename = t.match(/^(?:rename|call|name) (?:the )?(.+?) (?:to|as|the) (.+)$/);
  if (rename) {
    const st = stationIn(rename[1], ctx.stations);
    if (st) {
      args.kind = 'rename'; args.stationId = st.id; args.newName = title(rename[2].replace(/^(the|a) /, ''));
      return done(args, slash, true);
    }
  }
  // Add or remove a station.
  const add = t.match(/^(?:add|create|set up|open) (?:a |an |another |new |a new )?(bench|line|station|make line)(?: (?:called|named|for))? ?(.*)$/);
  if (add) {
    args.kind = 'add-station'; args.isLine = /line/.test(add[1]);
    const nm = add[2].replace(/^(called|named|the|a) /, '').trim();
    args.newName = nm ? title(nm) : undefined;
    return done(args, slash, Boolean(nm));
  }
  const remove = t.match(/^(?:remove|delete|drop|take out|close) (?:the )?(.+?)(?: (?:bench|line|station))?$/);
  if (remove && /\b(bench|line|station)\b/.test(t)) {
    const st = stationIn(t, ctx.stations);
    if (st) { args.kind = 'remove-station'; args.stationId = st.id; return done(args, slash, true); }
  }

  // Days.
  const days = daysIn(t);
  if (/\bdeep clean\b/.test(t)) {
    args.kind = 'deep-clean'; args.days = days;
    return done(args, slash, Boolean(days));
  }
  const recipe = recipeIn(t, fjRecipes);
  const group = GROUP_WORDS.find(([re]) => re.test(recipe.rest))?.[1];
  if (days && group && !/\bshelf life\b/.test(t)) {
    args.kind = 'make-on'; args.group = group; args.days = days;
    return done(args, slash, true);
  }
  if (days && /\b(make|made|make on|make ahead|production|produce)\b/.test(t) && !recipe.id) {
    args.kind = 'make-on'; args.days = days;
    return done(args, slash, false);
  }

  // Kitchen: channels, roles and kit on a station.
  const station = stationIn(t, ctx.stations);
  const channel = CHANNEL_WORDS.find(([re]) => re.test(t))?.[1];
  if (channel && station) {
    args.kind = 'line-channel'; args.channel = channel; args.stationId = station.id;
    return done(args, slash, true);
  }
  if (channel && /\b(plate|plates|plating|line|serve|served)\b/.test(t)) {
    args.kind = 'line-channel'; args.channel = channel;
    return done(args, slash, false);
  }
  if (station) {
    const equipment = equipmentIn(station.rest);
    const role = ROLE_WORDS.find(([re]) => re.test(station.rest))?.[1];
    const isLine = ctx.stations.find(s => s.id === station.id)?.isLine;
    if (/\b(half|full) batch(es)?\b/.test(t) && !recipe.id) {
      args.kind = 'line-half'; args.stationId = station.id;
      args.on = /\bhalf\b/.test(t) && !/\b(no|off|stop|not|full|never)\b/.test(t);
      return done(args, slash, Boolean(isLine));
    }
    if (equipment && !recipe.id) {
      args.kind = 'station-kit'; args.stationId = station.id; args.equipment = equipment;
      const eqWord = norm(EQUIPMENT_LABELS[equipment]);
      const capacity = station.rest.match(/(?:of|holds?|holding|takes?) (\d+)(?: (trays?|bags?|kg|litres?))?/);
      if (capacity) args.capacity = Number(capacity[1]);
      const restNoCap = capacity ? station.rest.replace(capacity[0], ' ') : station.rest;
      if (/\b(another|one more|an extra|add an?|add one)\b/.test(restNoCap) || (/\badd\b/.test(restNoCap) && numberIn(restNoCap.replace(new RegExp(eqWord), ' ')) === undefined)) args.delta = 1;
      else if (/\b(remove|take away|lose|take out|drop) (an?|one|the)\b/.test(restNoCap)) args.delta = -1;
      else if (/\b(no|zero|none|remove|without)\b/.test(restNoCap) && numberIn(restNoCap) === undefined) args.count = 0;
      else args.count = numberIn(restNoCap.replace(new RegExp(`(^| )${eqWord}s?( |$)`), ' '));
      return done(args, slash, args.count !== undefined || args.delta !== undefined || args.capacity !== undefined);
    }
    if (role && !recipe.id) {
      args.kind = 'station-role'; args.stationId = station.id; args.role = role;
      args.on = !/\b(off|no longer|stop|take .* off|remove|doesnt|does not)\b/.test(t);
      return done(args, slash, true);
    }
  }
  // "give salads its own bench" style: a role with no station yet.
  const looseRole = ROLE_WORDS.find(([re]) => re.test(recipe.rest))?.[1];
  if (looseRole && !recipe.id && /\b(move|put|lands?|goes|take|takes|handles?|do|does|own bench)\b/.test(t)) {
    args.kind = 'station-role'; args.role = looseRole; args.on = true;
    return done(args, slash, false);
  }

  // Recipe production settings.
  if (recipe.id || recipe.options) {
    args.recipeId = recipe.id; args.recipeOptions = recipe.options;
    const r = recipe.rest;
    const have = Boolean(recipe.id);
    const doneR = (complete: boolean) => {
      if (args.kind && args.recipeId) args.recipeId = pickTwin(args.kind, args.recipeId, recipe.twins);
      return done(args, slash, complete);
    };
    if (/\b(half|full) batch(es)?\b/.test(r) || /\bhalves\b/.test(r)) {
      args.kind = 'recipe-half';
      args.on = (/\bhalf\b|\bhalves\b/.test(r)) && !/\b(no|off|stop|not|never|full|dont|do not|remove)\b/.test(r);
      return doneR(have);
    }
    if (/\byield\b/.test(r) || /\bloss\b/.test(r)) {
      args.kind = 'recipe-yield'; args.pct = numberIn(r);
      return doneR(have && args.pct !== undefined);
    }
    if (group || /\b(shelf life|keeps for|lasts|make ahead group|day item)\b/.test(r)) {
      args.kind = 'recipe-shelf'; args.group = group;
      return doneR(have && Boolean(group));
    }
    const perBatch = r.match(/(\d+|one|two|three|four|five|six) (?:[a-z ]+ )?(?:a|per|each|every) (?:full )?batch/);
    if (perBatch) {
      args.kind = 'recipe-per-batch'; args.perBatch = numberIn(perBatch[0]);
      args.containerId = CONTAINER_ALIASES.find(([re]) => re.test(r))?.[1];
      return doneR(have);
    }
    if (/\b(container|containers|tray|trays|pot|pots|bottle|bottles|box|boxes|tub|tubs|gastronorm|gn|cast iron)\b/.test(r)) {
      args.kind = 'recipe-container'; args.containerId = CONTAINER_ALIASES.find(([re]) => re.test(r))?.[1];
      return doneR(have && Boolean(args.containerId));
    }
    const equipment = equipmentIn(r);
    if (equipment) {
      args.kind = 'recipe-kit'; args.equipment = equipment;
      return doneR(have);
    }
    // A bare recipe with a Setup verb: open its row.
    if (/\b(setting|settings|set up|setup|production)\b/.test(r)) return doneR(false);
  }
  if (slash) return done(args, true, false);
  return null;
}

function done(args: FjSetupArgs, slash: boolean, complete: boolean): CommandIntent {
  return { commandId: 'fj-setup', args, confidence: slash ? 1 : complete ? 0.92 : 0.7 };
}

const title = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());

// ─── Resolve: from args to the change Setup would make ───────────────────────

export type ResolveContext = {
  recipes: Recipe[];
  effectiveFor: (siteId: string) => EffectiveSiteSettings;
  overlayFor: (siteId: string) => SiteSettingsOverlay | undefined;
};

export type ResolvedSetup = {
  /** Short heading for the card: "Salads work lands on Basement prep". */
  title: string;
  /** What the change does, in a sentence. */
  sentence: string;
  /** What follows from it, for the plans. */
  consequence: string;
  changes: SettingsChange[];
  /** Shops that receive the change. */
  shops: string[];
  /** Shops that keep a setting of their own and so do not receive it. */
  kept: { shopId: string; what: string }[];
  scopeLabel: string;
  /** Nothing to do: the setting already reads this way. */
  noop?: boolean;
  /** Something still needed before it can publish. */
  missing?: string;
  /** Recipe production fields touched, by id, before the change. */
  recipeBefore: Record<string, FjProductionFields>;
  /** Overlays touched, by site id, before the change. */
  overlaysBefore: Record<string, SiteSettingsOverlay | null>;
  apply: (io: { replace: (siteId: string, overlay: SiteSettingsOverlay | undefined) => void; updateRecipe: (r: Recipe) => void }) => void;
};

const allShops = () => FJ_SHOPS.map(s => s.id);
const shopName = (id: string) => getShop(id)?.name ?? id;
const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const longDays = (d: Weekday[]) => (d.length === 7 ? 'every day' : d.map(x => LONG_DAYS[x]).join(d.length === 2 ? ' and ' : ', ')) || 'no days';

/** Shops whose kitchen is their own, so a company kitchen change passes them by. */
function shopsWithOwnKitchen(ctx: ResolveContext): string[] {
  return FJ_SHOPS.filter(s => {
    const o = ctx.overlayFor(s.id);
    return Boolean(o?.benchOrder || (o?.addedBenches && Object.keys(o.addedBenches).length) || Object.values(o?.benches ?? {}).some(b => Object.keys(b).length > 0));
  }).map(s => s.id);
}

function shopDaysOf(ctx: ResolveContext, company: MakeOnSchedule): ShopDays {
  const out: ShopDays = {};
  for (const s of FJ_SHOPS) {
    const sched = scheduleFromWindows(ctx.effectiveFor(s.id).windows);
    const own: Partial<Record<ShelfLifeGroupId, Weekday[]>> = {};
    for (const g of GROUP_IDS) if (sched.days[g].join() !== company.days[g].join()) own[g] = sched.days[g];
    if (Object.keys(own).length) out[s.id] = own;
  }
  return out;
}

function missing(args: FjSetupArgs, what: string): ResolvedSetup {
  return {
    title: args.kind ? SETUP_KIND_LABELS[args.kind] : 'Setup change', sentence: '', consequence: '', changes: [], shops: [], kept: [],
    scopeLabel: args.shopId ? `${shopName(args.shopId)} only` : 'Every shop', missing: what, recipeBefore: {}, overlaysBefore: {}, apply: () => {},
  };
}

export function resolveFjSetup(args: FjSetupArgs, ctx: ResolveContext): ResolvedSetup {
  const kind = args.kind;
  if (!kind) return missing(args, 'What to change');
  const scopeLabel = args.shopId ? `${shopName(args.shopId)} only` : 'Every shop';

  // Recipe fields are on the recipe, so they are the company's by nature.
  if (kind.startsWith('recipe-')) {
    if (!args.recipeId) return missing(args, 'Which recipe');
    const r = ctx.recipes.find(x => x.id === args.recipeId);
    if (!r) return missing(args, 'Which recipe');
    const before = productionFieldsOf(r);
    const patch: Partial<FjProductionFields> = {};
    let sentence = '';
    let consequence = '';
    let title = '';
    if (kind === 'recipe-half') {
      const on = args.on ?? true;
      patch.halfBatch = on;
      title = `${r.name}: half batches ${on ? 'allowed' : 'off'}`;
      sentence = on ? `${r.name} can be made as a half batch.` : `${r.name} is always made as a full batch.`;
      consequence = on ? 'Lines with half batches on round this recipe to halves from the next plan. Full-batch lines are unchanged.' : 'Every line rounds this recipe up to whole batches from the next plan.';
    } else if (kind === 'recipe-yield') {
      if (args.pct === undefined) return missing(args, 'The yield loss percentage');
      patch.yieldLossPct = Math.max(0, Math.min(90, Math.round(args.pct)));
      title = `${r.name}: yield loss ${patch.yieldLossPct}%`;
      sentence = `${patch.yieldLossPct}% of what goes in is lost in cooking or trimming, so a batch needs more raw input for the same output.`;
      consequence = 'Batch inputs and the order sheet re-cost from the next order; batch counts do not change.';
    } else if (kind === 'recipe-shelf') {
      if (!args.group) return missing(args, 'Which shelf-life group');
      patch.shelfLifeGroup = args.group;
      const g = SHELF_LIFE_GROUPS[args.group];
      title = `${r.name}: ${g.label} shelf life`;
      sentence = `${r.name} keeps ${g.days === 1 ? 'for the day' : `for ${g.days} days`}, so it joins the ${g.label} group.`;
      consequence = g.days === 1 ? 'Made fresh every day; it leaves the make-ahead groups on the week plan.' : `Made on the ${g.label} group's make-on days; the week plan and prep lists follow.`;
    } else if (kind === 'recipe-container') {
      if (!args.containerId) return missing(args, 'Which container');
      patch.outputContainer = args.containerId;
      const c = CONTAINERS[args.containerId];
      title = `${r.name}: ${c.name.toLowerCase()}`;
      sentence = `${r.name} goes out in the ${c.name.toLowerCase()} (${c.fillG} g).`;
      consequence = 'The line counts it in that container from the next plan; batches per container re-round.';
    } else if (kind === 'recipe-per-batch') {
      if (!args.perBatch) return missing(args, 'How many a batch');
      patch.containersPerBatch = args.perBatch;
      if (args.containerId) patch.outputContainer = args.containerId;
      title = `${r.name}: ${args.perBatch} ${containerLabel(patch.outputContainer ?? before.outputContainer).toLowerCase()}s a batch`;
      sentence = `One full batch of ${r.name} fills ${args.perBatch} ${containerLabel(patch.outputContainer ?? before.outputContainer).toLowerCase()}s.`;
      consequence = 'Batch counts on the day plan re-round from the next plan.';
    } else if (kind === 'recipe-kit') {
      if (!args.equipment) return missing(args, 'Which kit');
      patch.equipment = [args.equipment];
      title = `${r.name}: ${EQUIPMENT_LABELS[args.equipment].toLowerCase()}`;
      sentence = `${r.name} is made in the ${EQUIPMENT_LABELS[args.equipment].toLowerCase()}.`;
      consequence = `Cook loads size off each shop's ${EQUIPMENT_LABELS[args.equipment].toLowerCase()}s from the next plan.`;
    }
    const after = { ...before, ...patch };
    const changes = diffRecipeFields(r.name, before, after);
    return {
      title, sentence, consequence, changes, shops: changes.length ? allShops() : [], kept: [], scopeLabel: 'Every shop',
      noop: changes.length === 0,
      recipeBefore: { [r.id]: before }, overlaysBefore: {},
      apply: io => { if (changes.length) io.updateRecipe(withProductionFields(r, patch)); },
    };
  }

  // Make-on days.
  if (kind === 'make-on' || kind === 'deep-clean') {
    if (!args.days) return missing(args, 'Which days');
    const company = scheduleFromWindows(ctx.effectiveFor(FJ_ALL_SHOPS_ID).windows);
    const shopDays = shopDaysOf(ctx, company);
    const from: DaysDraft = { company, shops: shopDays };
    if (kind === 'deep-clean') {
      const to: DaysDraft = { company: { ...company, deepClean: args.days }, shops: shopDays };
      const changes = diffDays(from, to);
      const overlay = ctx.overlayFor(FJ_ALL_SHOPS_ID);
      return {
        title: `Deep clean on ${longDays(args.days)}`,
        sentence: `Nothing is made ahead on ${longDays(args.days)}; the make-ahead groups shift to the day before.`,
        consequence: 'The week plan and Prep list move that day’s make-ahead work; today’s plan is unchanged.',
        changes, shops: changes.length ? allShops() : [], kept: [], scopeLabel: 'Every shop', noop: !changes.length,
        recipeBefore: {}, overlaysBefore: { [FJ_ALL_SHOPS_ID]: overlay ?? null },
        apply: io => { if (changes.length) io.replace(FJ_ALL_SHOPS_ID, withCompanyDays(overlay, to.company)); },
      };
    }
    if (!args.group) return missing(args, 'Which make-ahead group');
    const g = SHELF_LIFE_GROUPS[args.group];
    if (args.shopId) {
      const own = { ...(shopDays[args.shopId] ?? {}), [args.group]: args.days };
      const to: DaysDraft = { company, shops: { ...shopDays, [args.shopId]: own } };
      const changes = diffDays(from, to);
      const overlay = ctx.overlayFor(args.shopId);
      return {
        title: `${shopName(args.shopId)}: ${g.label} made on ${longDays(args.days)}`,
        sentence: `${shopName(args.shopId)} makes the ${g.label} group on ${longDays(args.days)}. Other shops keep the company days (${daysLabel(company.days[args.group])}).`,
        consequence: `${shopName(args.shopId)}'s week plan and prep lists move the ${g.label} work to those days.`,
        changes, shops: changes.length ? [args.shopId] : [], kept: [], scopeLabel, noop: !changes.length,
        recipeBefore: {}, overlaysBefore: { [args.shopId]: overlay ?? null },
        apply: io => { if (changes.length) io.replace(args.shopId!, withShopDays(overlay, own)); },
      };
    }
    const to: DaysDraft = { company: { ...company, days: { ...company.days, [args.group]: args.days } }, shops: shopDays };
    const changes = diffDays(from, to);
    const overriding = Object.entries(shopDays).filter(([, o]) => o[args.group!]).map(([s]) => s);
    const overlay = ctx.overlayFor(FJ_ALL_SHOPS_ID);
    return {
      title: `${g.label} group made on ${longDays(args.days)}`,
      sentence: `Every shop makes the ${g.label} group (${g.days}-day shelf life) on ${longDays(args.days)}.`,
      consequence: 'The week plan and Prep list at each shop move that group to those days.',
      changes, shops: changes.length ? allShops().filter(s => !overriding.includes(s)) : [],
      kept: overriding.map(s => ({ shopId: s, what: `${daysLabel(shopDays[s][args.group!]!)} for ${g.label.toLowerCase()}` })),
      scopeLabel: 'Every shop', noop: !changes.length,
      recipeBefore: {}, overlaysBefore: { [FJ_ALL_SHOPS_ID]: overlay ?? null },
      apply: io => { if (changes.length) io.replace(FJ_ALL_SHOPS_ID, withCompanyDays(overlay, to.company)); },
    };
  }

  // Kitchen: lines and benches.
  const siteId = args.shopId ?? FJ_ALL_SHOPS_ID;
  const stations = ctx.effectiveFor(siteId).benches.map(toStationDraft);
  const own = args.shopId ? [] : shopsWithOwnKitchen(ctx);
  const shops = args.shopId ? [args.shopId] : allShops().filter(s => !own.includes(s));
  const kept = own.map(s => ({ shopId: s, what: 'its own kitchen' }));
  const overlay = ctx.overlayFor(siteId);
  const finish = (title: string, sentence: string, consequence: string, next: StationDraft[]): ResolvedSetup => {
    const changes = diffStations(stations, next, shops);
    return {
      title, sentence, consequence, changes, shops: changes.length ? shops : [], kept: changes.length ? kept : [], scopeLabel, noop: !changes.length,
      recipeBefore: {}, overlaysBefore: { [siteId]: overlay ?? null },
      apply: io => { if (changes.length) io.replace(siteId, stationsToOverlay(next, overlay, siteId)); },
    };
  };
  const at = args.shopId ? ` at ${shopName(args.shopId)}` : '';

  if (kind === 'add-station') {
    if (!args.newName) return missing(args, `A name for the new ${args.isLine ? 'line' : 'bench'}`);
    if (args.isLine && stations.filter(s => s.isLine).length >= MAX_BENCHES) return { ...missing(args, `Room: a shop has at most ${MAX_BENCHES} lines`), scopeLabel };
    const id = `fj-${args.isLine ? 'line' : 'kitchen'}-${args.newName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
    const next: StationDraft[] = [...stations, { id, name: args.newName, isLine: Boolean(args.isLine), channels: [], halfBatches: false, roles: [], kit: [] }];
    return finish(`New ${args.isLine ? 'line' : 'bench'}: ${args.newName}`, `${args.newName} joins the kitchen${at} with no kit and no work yet.`, 'It shows in Setup and shop Settings. Give it kit or a kind of work and it appears on the Sections board.', next);
  }

  if (!args.stationId) return missing(args, kind === 'station-role' ? 'Which bench or line takes it' : kind === 'line-channel' ? 'Which line' : 'Which bench or line');
  const st = stations.find(s => s.id === args.stationId);
  if (!st) return missing(args, 'Which bench or line');

  if (kind === 'rename') {
    if (!args.newName) return missing(args, 'The new name');
    const next = stations.map(s => (s.id === st.id ? { ...s, name: args.newName! } : s));
    return finish(`${st.name} → ${args.newName}`, `${st.name} is called ${args.newName}${at}.`, 'The Sections board, day plan and settings use the new name. Nothing else moves.', next);
  }
  if (kind === 'remove-station') {
    const next = stations.filter(s => s.id !== st.id);
    const orphanRoles = st.roles;
    const orphanChannels = st.channels;
    const cons = [
      orphanChannels.length ? `${channelsText(orphanChannels)} plate on ${next.find(s => s.isLine)?.name ?? 'the first line'} until a line claims them.` : '',
      orphanRoles.length ? `${rolesText(orphanRoles)} work shows as its own card until a bench takes it.` : '',
      st.kit.length ? `Its ${kitSummary(st.kit)} leave the shop's kit.` : '',
    ].filter(Boolean).join(' ');
    return finish(`Remove ${st.name}`, `${st.name} leaves the kitchen${at}.`, cons || 'Nothing was landing there, so nothing moves.', next);
  }
  if (kind === 'station-role') {
    if (!args.role) return missing(args, 'Which kind of work');
    const role = FJ_WORK_ROLE_BY_ID[args.role];
    const from = stations.find(s => s.roles.includes(args.role!));
    if (args.on === false) {
      const next = stations.map(s => (s.id === st.id ? { ...s, roles: s.roles.filter(r => r !== args.role) } : s));
      return finish(`${st.name} stops taking ${role.label.toLowerCase()}`, `${role.label} work no longer lands on ${st.name}${at}.`, `${role.label} shows as its own card on the Sections board until a bench takes it.`, next);
    }
    const next = stations.map(s => {
      if (s.id === st.id) return { ...s, roles: s.roles.includes(args.role!) ? s.roles : [...s.roles, args.role!] };
      return { ...s, roles: s.roles.filter(r => r !== args.role) };
    });
    const fromText = from && from.id !== st.id ? ` It comes off ${from.name}, which keeps ${rolesText(next.find(s => s.id === from.id)!.roles)}.` : '';
    return finish(
      `${role.label} lands on ${st.name}`,
      `${role.label} work (${role.what.replace(/\.$/, '').toLowerCase()}) lands on ${st.name}${at}.${fromText}`,
      `On the Sections board the ${role.label.toLowerCase()} tasks move onto the ${st.name} card${from && from.id !== st.id && !next.find(s => s.id === from.id)!.roles.length ? `; ${from.name} comes off the board until it takes work again` : ''}.`,
      next,
    );
  }
  if (kind === 'station-kit') {
    if (!args.equipment) return missing(args, 'Which kit');
    const label = EQUIPMENT_LABELS[args.equipment].toLowerCase();
    const cur = st.kit.find(k => k.equipment === args.equipment);
    const count = args.count !== undefined ? args.count : args.delta !== undefined ? Math.max(0, (cur?.count ?? 0) + args.delta) : (cur?.count ?? 1);
    const capacity = args.capacity ?? cur?.capacity;
    const kit: BenchKitItem[] = count === 0
      ? st.kit.filter(k => k.equipment !== args.equipment)
      : cur
        ? st.kit.map(k => (k.equipment === args.equipment ? { ...k, count, ...(capacity ? { capacity } : {}) } : k))
        : [...st.kit, { equipment: args.equipment, count, ...(capacity ? { capacity } : {}) }];
    const next = stations.map(s => (s.id === st.id ? { ...s, kit } : s));
    const title = count === 0 ? `${st.name}: no ${label}` : `${st.name}: ${count} ${label}${count === 1 ? '' : 's'}${args.capacity ? ` of ${args.capacity}` : ''}`;
    return finish(
      title,
      count === 0 ? `${st.name} has no ${label}${at}.` : `${st.name} has ${count} ${label}${count === 1 ? '' : 's'}${capacity ? `, each holding ${capacity}` : ''}${at}.`,
      `Cook loads for ${label} recipes re-plan around that kit from the next plan; the Sections board shows it on the ${st.name} card.`,
      next,
    );
  }
  if (kind === 'line-channel') {
    if (!args.channel) return missing(args, 'Which channel');
    if (!st.isLine) return { ...missing(args, `${st.name} is a bench, not a line. Channels plate on a line`), scopeLabel };
    const from = stations.find(s => s.channels.includes(args.channel!));
    const next = stations.map(s => {
      if (s.id === st.id) return { ...s, channels: s.channels.includes(args.channel!) ? s.channels : [...s.channels, args.channel!] };
      return { ...s, channels: s.channels.filter(c => c !== args.channel) };
    });
    return finish(
      `${CHANNEL_LABELS[args.channel]} plates on ${st.name}`,
      `${CHANNEL_LABELS[args.channel]} orders plate on ${st.name}${at}.${from && from.id !== st.id ? ` They come off ${from.name}.` : ''}`,
      `${CHANNEL_LABELS[args.channel]} demand moves to ${st.name} on the day plan from the next plan${st.halfBatches ? ', rounding to half batches where a recipe allows' : ''}.`,
      next,
    );
  }
  if (kind === 'line-half') {
    if (!st.isLine) return { ...missing(args, `${st.name} is a bench, not a line. Half batches are a line setting`), scopeLabel };
    const on = args.on ?? true;
    const next = stations.map(s => (s.id === st.id ? { ...s, halfBatches: on } : s));
    return finish(
      `${st.name}: half batches ${on ? 'on' : 'off'}`,
      on ? `${st.name} plates half batches${at}.` : `${st.name} plates full batches only${at}.`,
      on ? 'Recipes that allow half batches round to halves on this line from the next plan.' : 'Every recipe rounds up to whole batches on this line from the next plan.',
      next,
    );
  }
  return missing(args, 'What to change');
}

// ─── Publish: the same publish Setup does ────────────────────────────────────

export type PublishIO = {
  get: (shopId: string, date: string) => DayRecord;
  update: (shopId: string, date: string, fn: (r: DayRecord) => DayRecord) => void;
  updateSettings: (fn: (s: FjSettings) => FjSettings) => void;
  recipes: Recipe[];
  replace: (siteId: string, overlay: SiteSettingsOverlay | undefined) => void;
  updateRecipe: (r: Recipe) => void;
};

/**
 * Apply a resolved change the way Setup publishes: flag approved days in
 * the window at the shops it reaches, snapshot for revert, apply, write
 * the Publish log entry with what Jana typed. Returns the entry id, a
 * revert, and the pre-publish impact snapshot so the caller can fill in
 * the downstream line once the engines have re-run.
 */
export function publishFjSetup(resolved: ResolvedSetup, said: string, io: PublishIO, settings: FjSettings): { id: string; revert: () => void; impactBefore: ImpactSnapshot } {
  const at = demoNowISO();
  const id = `pub-${at}-${Math.random().toString(36).slice(2, 7)}`;
  const flagged: PublishEntry['flagged'] = [];
  const window = planningWindowFor(FJ_DEMO_TODAY);
  for (const shopId of resolved.shops) {
    for (const date of window.days) {
      if (date < FJ_DEMO_TODAY) continue;
      const record = io.get(shopId, date);
      if (!record.approvedAtISO) continue;
      const plan = computeDayPlan(shopId, date, record, io.get(shopId, addDays(date, -1)).close);
      const pinned: Record<string, LineOverride> = Object.fromEntries(
        plan.plans.map(p => [p.productId, Object.fromEntries(p.lines.map(l => [l.lineId, l.plannedUnits]))]),
      );
      const fields = resolved.changes.filter(c => c.shops.includes(shopId)).map(c => c.field);
      io.update(shopId, date, r => ({ ...r, settingsChanged: { publishId: id, atISO: at, by: 'Jana', fields, pinned } }));
      flagged.push({ shopId, date });
    }
  }
  const before: PublishSnapshot = {
    recipes: resolved.recipeBefore,
    overlays: resolved.overlaysBefore,
    containers: JSON.parse(JSON.stringify(settings.published.containers)),
    methodDefaults: JSON.parse(JSON.stringify(settings.published.methodDefaults)),
  };
  const impactBefore = snapshotImpact(resolved.shops, FJ_DEMO_TODAY, io.get);
  resolved.apply({ replace: io.replace, updateRecipe: io.updateRecipe });
  const entry: PublishEntry = { id, atISO: at, by: 'Jana', effectiveFrom: FJ_DEMO_TODAY, shops: resolved.shops, kept: resolved.kept, changes: resolved.changes, downstream: [], flagged, before, said };
  io.updateSettings(s => ({ ...s, log: [entry, ...s.log] }));

  const revert = () => {
    for (const [recipeId, fields] of Object.entries(resolved.recipeBefore)) {
      const r = io.recipes.find(x => x.id === recipeId);
      if (r) io.updateRecipe(withProductionFields(r, fields));
    }
    for (const [siteId, overlay] of Object.entries(resolved.overlaysBefore)) io.replace(siteId, overlay ?? undefined);
    for (const f of flagged) io.update(f.shopId, f.date, r => (r.settingsChanged?.publishId === id ? { ...r, settingsChanged: undefined } : r));
    const revAt = demoNowISO();
    const reversed: SettingsChange[] = resolved.changes.map(c => ({ ...c, from: c.to, to: c.from }));
    const revertEntry: PublishEntry = { id: `rev-${revAt}`, atISO: revAt, by: 'Jana', effectiveFrom: FJ_DEMO_TODAY, shops: resolved.shops, kept: [], changes: reversed, downstream: [], flagged: [], revertOf: id, said: 'Undo from the Command Centre' };
    io.updateSettings(s => ({ ...s, log: [revertEntry, ...s.log.map(e => (e.id === id ? { ...e, revertedAtISO: revAt } : e))] }));
  };
  return { id, revert, impactBefore };
}

/** The Setup route that shows this change, so "Open in Setup" lands on the right tab. */
export function setupHrefFor(kind: FjSetupKind | undefined): string {
  return `/production/setup?tab=${setupTabFor(kind)}`;
}

export { WEEKDAY_LABELS, groupLabel };

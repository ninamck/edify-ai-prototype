'use client';

/**
 * In-memory store for Square menu publishing. Same subscription pattern as
 * `components/Modifiers/store.ts`.
 *
 * Holds the publishing settings (on the POS connection), the till items,
 * Square items with nothing behind them in Edify, and what Square changed
 * since Edify last published.
 */

import { useSyncExternalStore } from 'react';
import { SEED_MODIFIER_GROUPS } from '@/components/Modifiers/fixtures';
import { findGroup, upsertGroup, genOptionId } from '@/components/Modifiers/store';
import type { ModifierGroup } from '@/components/Modifiers/types';
import type { Recipe } from '@/components/Recipe/libraryFixtures';
import type { Product } from '@/components/Suppliers/fixtures';
import {
  RECIPE_OPTIONS_OFF,
  SEED_GROUP_CHANGES,
  SEED_GROUP_SITE_PRICES,
  SEED_PUBLISHED_GROUP_IDS,
  SEED_SQUARE_ONLY,
  SEED_TILL_ITEMS,
  SQUARE_LOCATIONS,
  SQUARE_TAXES,
  ALL_DAY_MENU_ID,
  SEED_MENUS,
  SEED_POS_CATEGORIES,
  SPRING_MENU_ITEM_IDS,
  SPRING_SPECIALS_IDS,
  type GroupSitePrices,
  type SquareMenuDef,
} from './squareCatalogFixtures';
import {
  cloneFields,
  hasPublishWork,
  pickFields,
  publishKeys,
  squareChangeKeys,
  statusOf,
  type FieldKey,
  type SquareGroupChange,
  type SquareOnlyItem,
  type TillFields,
  type TillItem,
  type TillSource,
  vatPct,
} from './tillItems';

export type PublishingSettings = {
  enabled: boolean;
  /** Square has granted the extra menu permission. */
  authorised: boolean;
  /** Square location id → Edify site name. */
  locationMap: Record<string, string>;
  vatHot: string;
  vatCold: string;
  lastPublishedAt?: string;
};

export type PublishReceipt = {
  at: string;
  done: string[];
  failed: { id: string; name: string; reason: string }[];
};

/** Where the Square menu page starts after publishing is turned on. */
export type SetupStage = 'done' | 'first-link' | 'empty';

type State = {
  settings: PublishingSettings;
  stage: SetupStage;
  items: TillItem[];
  squareOnly: SquareOnlyItem[];
  groupChanges: SquareGroupChange[];
  /** Till shape of each modifier group as last published. */
  publishedGroups: Record<string, string>;
  /** Groups whose option prices differ by Square location. */
  groupSitePrices: Record<string, GroupSitePrices>;
  menus: SquareMenuDef[];
  /** Every POS category the merchant has, whichever menu uses it. */
  posCategories: string[];
  lastReceipt?: PublishReceipt;
};

/** Only the parts of a group that reach the till. Recipe effects don't. */
export function tillShapeOfGroup(g: ModifierGroup, sitePrices?: GroupSitePrices): string {
  return JSON.stringify({
    sitePrices: sitePrices?.keepInSquare ? sitePrices.prices : null,
    name: g.name,
    selection: g.selection,
    required: g.required,
    max: g.selection === 'many' ? g.maxSelections ?? null : 1,
    options: g.options.map((o) => ({ n: o.name, p: o.priceDelta ?? 0, k: o.kitchenName ?? '', d: !!o.isDefault })),
  });
}

function seedPublishedGroups(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of SEED_PUBLISHED_GROUP_IDS) {
    const g = SEED_MODIFIER_GROUPS.find((x) => x.id === id);
    if (g) out[id] = tillShapeOfGroup(g, SEED_GROUP_SITE_PRICES[id]);
  }
  return out;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function seededState(): State {
  return {
    settings: {
      enabled: true,
      authorised: true,
      locationMap: Object.fromEntries(SQUARE_LOCATIONS.map((l) => [l.id, l.site])),
      vatHot: 'Standard rate 20%',
      vatCold: 'Zero rate 0%',
      lastPublishedAt: '18 Nov, 16:20',
    },
    stage: 'done',
    items: clone(SEED_TILL_ITEMS).map((i) => (
      SPRING_MENU_ITEM_IDS.includes(i.id)
        ? {
          ...i,
          menuIds: [ALL_DAY_MENU_ID, 'menu-spring'],
          ...(SPRING_SPECIALS_IDS.includes(i.id) ? { menuGroups: { 'menu-spring': 'Spring specials' } } : {}),
        }
        : i
    )),
    squareOnly: clone(SEED_SQUARE_ONLY),
    groupChanges: clone(SEED_GROUP_CHANGES),
    publishedGroups: seedPublishedGroups(),
    groupSitePrices: clone(SEED_GROUP_SITE_PRICES),
    menus: clone(SEED_MENUS),
    posCategories: [...SEED_POS_CATEGORIES],
  };
}

let state: State = seededState();

const listeners = new Set<() => void>();
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
function notify() { for (const l of listeners) l(); }
function set(next: Partial<State>) {
  state = { ...state, ...next };
  notify();
}

const getState = () => state;

export function useSquareMenu(): State {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function getSquareMenu(): State {
  return state;
}

export function nowLabel(): string {
  const d = new Date();
  const month = d.toLocaleString('en-GB', { month: 'short' });
  return `${d.getDate()} ${month}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Settings and setup ──────────────────────────────────────────────────────

export function updateSettings(patch: Partial<PublishingSettings>): void {
  set({ settings: { ...state.settings, ...patch } });
}

/** Demo only: start the publishing set-up from scratch. */
export function resetForSetup(squareHasMenu: boolean): void {
  set({
    settings: {
      enabled: false,
      authorised: false,
      locationMap: {},
      vatHot: 'Standard rate 20%',
      vatCold: 'Zero rate 0%',
    },
    stage: squareHasMenu ? 'first-link' : 'empty',
    items: [],
    squareOnly: [],
    groupChanges: [],
    publishedGroups: {},
    groupSitePrices: {},
    menus: [],
    posCategories: [],
    lastReceipt: undefined,
  });
}

export function turnPublishingOn(): void {
  set({ settings: { ...state.settings, enabled: true, authorised: true } });
}

export function turnPublishingOff(): void {
  set({ settings: { ...state.settings, enabled: false } });
}

/** Demo only: put everything back to the seeded Fitzroy state. */
export function resetToSeed(): void {
  state = seededState();
  notify();
}

function toSquareOnly(i: TillItem, name = i.inSquare?.name ?? i.current.name, sizes?: string[]): SquareOnlyItem {
  const f = i.inSquare ?? i.current;
  const use = sizes ?? f.sizes;
  return {
    id: `sq-${i.id}-${use.join('-')}`.replace(/[^a-z0-9-]/gi, '').toLowerCase(),
    name,
    category: f.category,
    sizes: use,
    prices: Object.fromEntries(use.map((s) => [s, f.prices[s] ?? null])),
    createdAt: '',
  };
}

/**
 * Finish the first link. `choices` come from the "Needs your call" band.
 * `skipped` are till item ids the user unticked; they stay on the till only.
 */
export function completeFirstLink(choices: Record<string, string>, skipped: string[]): void {
  const seeded = seededState();
  // Straight after the first link, Edify and Square agree on everything that was linked.
  let items: TillItem[] = seeded.items
    .filter((i) => i.inSquare)
    .map((i) => ({ ...i, menuIds: undefined, menuGroups: undefined }))
    .map((i) => {
      const agreed = cloneFields(i.published ?? i.inSquare!);
      return {
        ...i,
        current: agreed,
        published: cloneFields(agreed),
        inSquare: cloneFields(agreed),
        takeOff: false,
        deletedInSquare: undefined,
        squareChangedAt: undefined,
        publishedByEdify: false,
      };
    });
  const squareOnly = [...seeded.squareOnly];

  for (const id of skipped) {
    const i = items.find((x) => x.id === id);
    if (i) squareOnly.push(toSquareOnly(i));
  }
  items = items.filter((i) => !skipped.includes(i.id));

  if (choices['fl-smirnoff'] === 'separate') {
    const smirnoff = items.find((i) => i.id === 'ti-smirnoff');
    if (smirnoff) {
      squareOnly.push(toSquareOnly(smirnoff, 'Smirnoff 25ml', ['25ml']), toSquareOnly(smirnoff, 'Smirnoff 50ml', ['50ml']));
      items = items.filter((i) => i.id !== 'ti-smirnoff');
    }
  }

  if ((choices['fl-hot-choc'] ?? 'leave') === 'leave') {
    squareOnly.push({
      id: 'sq-hot-choc',
      name: 'Hot choc',
      category: 'Coffee',
      sizes: ['Regular'],
      prices: { Regular: 3.9 },
      createdAt: '14 Mar, 10:02',
    });
  } else {
    const hotChoc: TillFields = {
      name: 'Hot choc', kitchenName: '', category: 'Coffee', sizes: ['Regular'], prices: { Regular: 3.9 },
      groups: ['mg-alt-milks'], sites: [], vat: 'Standard rate 20%', description: '', photo: false,
    };
    items = [
      ...items.filter((i) => i.id !== 'ti-mocha'),
      {
        id: 'ti-mocha',
        source: { kind: 'recipe', recipeId: 'rec-mocha' },
        posItemId: 'mi-mocha',
        current: cloneFields(hotChoc),
        published: cloneFields(hotChoc),
        inSquare: cloneFields(hotChoc),
        sizeCosts: { Regular: 0.95 },
        laterKeys: [],
        overwriteKeys: [],
      },
    ];
  }

  const allDay = seeded.menus.find((m) => m.id === ALL_DAY_MENU_ID)!;
  set({
    stage: 'done',
    items,
    squareOnly,
    menus: [allDay],
    posCategories: [...SEED_POS_CATEGORIES],
    groupChanges: [],
    publishedGroups: seeded.publishedGroups,
    groupSitePrices: Object.fromEntries(
      Object.entries(seeded.groupSitePrices).map(([id, sp]) => [
        id,
        { ...sp, keepInSquare: id !== 'mg-alt-milks' || choices['fl-alt-milks'] !== 'one-price' },
      ]),
    ),
  });
}

export function startFromEmpty(): void {
  set({
    stage: 'done',
    menus: [{ id: ALL_DAY_MENU_ID, name: 'All day menu', status: 'live', onSquare: false, groups: [] }],
  });
}

// ── Menus, menu groups and POS categories ──────────────────────────────────
// A POS category belongs to the item: one each, used for reporting in Square.
// Menu groups belong to a menu: the merchant makes them, and one item can sit
// in a different group on each menu.

export function menuIdsOf(x: { menuIds?: string[] }): string[] {
  return x.menuIds ?? [ALL_DAY_MENU_ID];
}

/** The item's group on this menu, or '' when it isn't in one. */
export function groupOn(x: { menuGroups?: Record<string, string> }, posCategory: string, menu: SquareMenuDef): string {
  const chosen = x.menuGroups?.[menu.id];
  if (chosen !== undefined) return menu.groups.includes(chosen) ? chosen : '';
  return menu.groups.includes(posCategory) ? posCategory : '';
}

export function isOnLiveMenu(i: TillItem, s: State = state): boolean {
  return menuIdsOf(i).some((id) => s.menus.find((m) => m.id === id)?.status === 'live');
}

/** New items wait until a live menu carries them. Changes to items already on the till always go. */
export function readyToPublish(i: TillItem, s: State = state): boolean {
  return hasPublishWork(i) && (!!i.inSquare || isOnLiveMenu(i, s));
}

/** A new item's POS category: the one named like its Edify class, or the class itself. */
export function posCategoryFor(edifyClass: string, s: State = state): string {
  return s.posCategories.find((c) => c.toLowerCase() === edifyClass.toLowerCase()) ?? edifyClass;
}

function patchMenu(id: string, fn: (m: SquareMenuDef) => SquareMenuDef): void {
  set({ menus: state.menus.map((m) => (m.id === id ? fn(m) : m)) });
}

/** Group edits on a menu Square already has go out on the next publish. */
function touchGroups(id: string, fn: (m: SquareMenuDef) => SquareMenuDef): void {
  patchMenu(id, (m) => {
    const next = fn(m);
    return next === m ? m : { ...next, groupsChanged: m.onSquare ? true : m.groupsChanged };
  });
}

export function createMenu(name: string): string {
  const id = `menu-${Math.random().toString(36).slice(2, 8)}`;
  set({ menus: [...state.menus, { id, name: name.trim(), status: 'draft', onSquare: false, groups: [] }] });
  return id;
}

export function renameMenu(id: string, name: string): void {
  if (name.trim()) patchMenu(id, (m) => ({ ...m, name: name.trim() }));
}

/** A released menu goes to Square on the next publish, with its new items. */
export function releaseMenu(id: string): void {
  patchMenu(id, (m) => ({ ...m, status: 'live' }));
}

export function publishMenu(id: string): void {
  patchMenu(id, (m) => ({ ...m, onSquare: true, groupsChanged: false }));
}

export function menusWithPublishWork(s: State = state): SquareMenuDef[] {
  return s.menus.filter((m) => m.status === 'live' && (!m.onSquare || m.groupsChanged));
}

export function addMenuGroup(menuId: string, name: string): string | null {
  const clean = name.trim();
  const menu = state.menus.find((m) => m.id === menuId);
  if (!clean || !menu) return null;
  const existing = menu.groups.find((g) => g.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  touchGroups(menuId, (m) => ({ ...m, groups: [...m.groups, clean] }));
  return clean;
}

/** Renames on this menu only. Items in the group stay in it. */
export function renameMenuGroup(menuId: string, from: string, to: string): void {
  const clean = to.trim();
  const menu = state.menus.find((m) => m.id === menuId);
  if (!clean || clean === from || !menu || menu.groups.includes(clean)) return;
  const pin = <T extends { menuGroups?: Record<string, string>; menuIds?: string[] }>(x: T, cat: string): T =>
    menuIdsOf(x).includes(menuId) && groupOn(x, cat, menu) === from ? { ...x, menuGroups: { ...x.menuGroups, [menuId]: clean } } : x;
  set({
    items: state.items.map((i) => pin(i, i.current.category)),
    squareOnly: state.squareOnly.map((q) => pin(q, q.category)),
  });
  touchGroups(menuId, (m) => ({ ...m, groups: m.groups.map((g) => (g === from ? clean : g)) }));
}

export function moveMenuGroup(menuId: string, group: string, dir: -1 | 1): void {
  touchGroups(menuId, (m) => {
    const list = [...m.groups];
    const idx = list.indexOf(group);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= list.length) return m;
    [list[idx], list[to]] = [list[to], list[idx]];
    return { ...m, groups: list };
  });
}

/** Only for empty groups. Items never lose their place by accident. */
export function deleteMenuGroup(menuId: string, group: string): void {
  touchGroups(menuId, (m) => ({ ...m, groups: m.groups.filter((g) => g !== group) }));
}

/** Makes a group for every POS category on this menu that hasn't got one. */
export function groupsFromPosCategories(menuId: string): number {
  const menu = state.menus.find((m) => m.id === menuId);
  if (!menu) return 0;
  const cats = new Set<string>();
  for (const i of state.items) {
    if (menuIdsOf(i).includes(menuId) && !groupOn(i, i.current.category, menu) && i.current.category) cats.add(i.current.category);
  }
  const add = Array.from(cats).filter((c) => !menu.groups.includes(c));
  if (add.length) touchGroups(menuId, (m) => ({ ...m, groups: [...m.groups, ...add] }));
  return add.length;
}

export function setItemGroup(id: string, menuId: string, group: string): void {
  patchItem(id, (i) => ({ ...i, menuGroups: { ...i.menuGroups, [menuId]: group } }));
  touchGroups(menuId, (m) => ({ ...m }));
}

export function setSquareOnlyGroup(id: string, menuId: string, group: string): void {
  set({ squareOnly: state.squareOnly.map((q) => (q.id === id ? { ...q, menuGroups: { ...q.menuGroups, [menuId]: group } } : q)) });
  touchGroups(menuId, (m) => ({ ...m }));
}

export function setItemMenus(id: string, menuIds: string[]): void {
  const before = menuIdsOf(findTillItem(id) ?? {});
  patchItem(id, (i) => ({ ...i, menuIds }));
  for (const mid of new Set([...before, ...menuIds])) {
    if (before.includes(mid) !== menuIds.includes(mid)) touchGroups(mid, (m) => ({ ...m }));
  }
}

export function addItemToMenu(id: string, menuId: string): void {
  const item = findTillItem(id);
  if (!item) return;
  const ids = menuIdsOf(item);
  if (!ids.includes(menuId)) setItemMenus(id, [...ids, menuId]);
}

export function addPosCategory(name: string): string | null {
  const clean = name.trim();
  if (!clean) return null;
  const existing = state.posCategories.find((c) => c.toLowerCase() === clean.toLowerCase());
  if (!existing) set({ posCategories: [...state.posCategories, clean] });
  return existing ?? clean;
}

export function setPosCategory(id: string, cat: string): void {
  if (cat) addPosCategory(cat);
  updateFields(id, { category: cat });
}

// ── Items ───────────────────────────────────────────────────────────────────

export function findTillItem(id: string): TillItem | undefined {
  return state.items.find((i) => i.id === id);
}

export function tillItemForRecipe(recipeId: string, items: TillItem[] = state.items): TillItem | undefined {
  return items.find((i) => i.source.kind === 'recipe' && i.source.recipeId === recipeId);
}

export function tillItemForProduct(productId: string, items: TillItem[] = state.items): TillItem | undefined {
  return items.find((i) => i.source.kind === 'product' && i.source.productId === productId);
}

function patchItem(id: string, fn: (i: TillItem) => TillItem): void {
  set({ items: state.items.map((i) => (i.id === id ? fn(i) : i)) });
}

export function updateFields(id: string, patch: Partial<TillFields>): void {
  patchItem(id, (i) => ({ ...i, current: { ...i.current, ...patch } }));
}

export function updateItem(id: string, patch: Partial<TillItem>): void {
  patchItem(id, (i) => ({ ...i, ...patch }));
}

/** Put every size on the same groups. Clears the "Can't publish" block. */
export function alignSizeGroups(id: string): void {
  patchItem(id, (i) => {
    if (!i.sizeGroups) return i;
    const all = Array.from(new Set(Object.values(i.sizeGroups).flat()));
    return { ...i, sizeGroups: undefined, current: { ...i.current, groups: all } };
  });
}

/** Drop a size that carries different groups, so the rest can publish. */
export function dropSize(id: string, size: string): void {
  patchItem(id, (i) => {
    const sizes = i.current.sizes.filter((s) => s !== size);
    const prices = { ...i.current.prices };
    delete prices[size];
    const sizeGroups = i.sizeGroups ? { ...i.sizeGroups } : undefined;
    if (sizeGroups) delete sizeGroups[size];
    const groups = sizeGroups ? Array.from(new Set(Object.values(sizeGroups).flat())) : i.current.groups;
    return { ...i, sizeGroups: undefined, current: { ...i.current, sizes, prices, groups } };
  });
}

function genTillId(): string {
  return `ti-${Math.random().toString(36).slice(2, 9)}`;
}

/** Sizes, prices and groups Edify suggests for a recipe going on the till. */
export function suggestFromRecipe(r: Recipe): { fields: TillFields; costs: Record<string, number> } {
  const sizes = r.variants?.length ? r.variants.map((v) => v.name) : ['Regular'];
  const prices: Record<string, number | null> = {};
  const costs: Record<string, number> = {};
  sizes.forEach((s, idx) => {
    const step = sizes.length > 1 ? idx * 0.4 : 0;
    prices[s] = r.priceDineIn ? Math.round((r.priceDineIn + step) * 100) / 100 : null;
    costs[s] = Math.round(r.ingredientCost * (1 + idx * 0.2) * 100) / 100;
  });
  const cold = r.formExtras?.pricing?.hotCold === 'cold' || ['Pastry', 'Bakery'].includes(r.category);
  return {
    fields: {
      name: r.name,
      kitchenName: '',
      category: posCategoryFor(r.category),
      sizes,
      prices,
      groups: r.modifierGroupIds ?? [],
      sites: [],
      vat: cold ? state.settings.vatCold : state.settings.vatHot,
      description: '',
      photo: false,
    },
    costs,
  };
}

export function addRecipeToTill(r: Recipe, menuId: string = ALL_DAY_MENU_ID): string {
  const existing = tillItemForRecipe(r.id);
  if (existing) {
    addItemToMenu(existing.id, menuId);
    return existing.id;
  }
  const { fields, costs } = suggestFromRecipe(r);
  const id = genTillId();
  const item: TillItem = {
    id,
    source: { kind: 'recipe', recipeId: r.id },
    current: fields,
    sizeCosts: costs,
    laterKeys: [],
    overwriteKeys: [],
    menuIds: [menuId],
  };
  set({ items: [...state.items, item] });
  if (fields.category) addPosCategory(fields.category);
  return id;
}

export type ProductSize = { name: string; amount: number; unit: string; price: number | null };

export function defaultProductSizes(p: Product): ProductSize[] {
  if (p.singleUnitType === 'ml' && (p.singleUnitVolumeOrWeight ?? 0) >= 700) {
    return [
      { name: '175ml', amount: 175, unit: 'ml', price: null },
      { name: '250ml', amount: 250, unit: 'ml', price: null },
      { name: 'Bottle', amount: p.singleUnitVolumeOrWeight ?? 750, unit: 'ml', price: null },
    ];
  }
  return [{ name: 'Each', amount: 1, unit: 'each', price: null }];
}

export function addProductToTill(p: Product, sizes: ProductSize[], menuId: string = ALL_DAY_MENU_ID): string {
  const existing = tillItemForProduct(p.id);
  if (existing) {
    addItemToMenu(existing.id, menuId);
    return existing.id;
  }
  const unitCost = p.packQty > 0 ? p.packCost / p.packQty : 0;
  const perMl = p.singleUnitType === 'ml' && p.singleUnitVolumeOrWeight ? unitCost / p.singleUnitVolumeOrWeight : null;
  const id = genTillId();
  const names = sizes.map((s) => s.name);
  const item: TillItem = {
    id,
    source: { kind: 'product', productId: p.id },
    current: {
      name: p.name.replace(/\s+\d+(ml|cl|L)$/i, ''),
      kitchenName: '',
      category: posCategoryFor(p.category),
      sizes: names,
      prices: Object.fromEntries(sizes.map((s) => [s.name, s.price])),
      groups: [],
      sites: [],
      vat: SQUARE_TAXES.find((t) => vatPct(t) === p.taxRatePct) ?? state.settings.vatHot,
      description: '',
      photo: false,
    },
    amounts: Object.fromEntries(sizes.map((s) => [s.name, { value: s.amount, unit: s.unit }])),
    sizeCosts: Object.fromEntries(
      sizes.map((s) => [s.name, Math.round((perMl != null && s.unit === 'ml' ? perMl * s.amount : unitCost * s.amount) * 100) / 100]),
    ),
    laterKeys: [],
    overwriteKeys: [],
    menuIds: [menuId],
  };
  set({ items: [...state.items, item] });
  if (item.current.category) addPosCategory(item.current.category);
  return id;
}

/** Remove an item that never reached the till. */
export function removeFromList(id: string): void {
  set({ items: state.items.filter((i) => i.id !== id) });
}

/** Mark for archiving in Square on the next publish. Undo by passing false. */
export function setTakeOff(id: string, takeOff: boolean): void {
  const item = findTillItem(id);
  if (!item) return;
  if (!item.inSquare) {
    removeFromList(id);
    return;
  }
  updateItem(id, { takeOff });
}

// ── Changed in Square ───────────────────────────────────────────────────────

export type SquareDecision = 'square' | 'edify' | 'later';

export function resolveSquareChange(id: string, key: FieldKey, decision: SquareDecision): void {
  patchItem(id, (i) => {
    if (!i.inSquare || !i.published) return i;
    if (decision === 'later') {
      return { ...i, laterKeys: Array.from(new Set([...i.laterKeys, key])) };
    }
    const laterKeys = i.laterKeys.filter((k) => k !== key);
    const published = pickFields(i.published, i.inSquare, [key]);
    if (decision === 'square') {
      return { ...i, laterKeys, published, current: pickFields(i.current, i.inSquare, [key]) };
    }
    return { ...i, laterKeys, published, overwriteKeys: Array.from(new Set([...i.overwriteKeys, key])) };
  });
}

/** Take every change made in Square, across every item. Skips deletions. */
export function takeAllSquareChanges(): void {
  set({
    items: state.items.map((i) => {
      if (!i.inSquare || !i.published || i.deletedInSquare) return i;
      const keys = squareChangeKeys(i);
      if (keys.length === 0) return i;
      return {
        ...i,
        laterKeys: [],
        published: pickFields(i.published, i.inSquare, keys),
        current: pickFields(i.current, i.inSquare, keys),
      };
    }),
  });
}

export function resolveDeleted(id: string, choice: 'remove' | 'restore'): void {
  if (choice === 'remove') {
    removeFromList(id);
    return;
  }
  patchItem(id, (i) => ({ ...i, deletedInSquare: undefined, inSquare: undefined, published: undefined }));
}

export function resolveGroupChange(changeId: string, choice: 'add' | 'later' | 'remove'): string | undefined {
  const change = state.groupChanges.find((c) => c.id === changeId);
  if (!change) return undefined;
  if (choice === 'later') {
    set({ groupChanges: state.groupChanges.map((c) => (c.id === changeId ? { ...c, later: true } : c)) });
    return undefined;
  }
  const group = findGroup(change.groupId);
  if (!group) return undefined;
  const withOption: ModifierGroup = {
    ...group,
    options: [
      ...group.options,
      { id: genOptionId(group.id), name: change.optionName, priceDelta: change.priceDelta, effects: [] },
    ],
  };
  const rest = state.groupChanges.filter((c) => c.id !== changeId);
  if (choice === 'add') {
    upsertGroup(withOption);
    set({ groupChanges: rest, publishedGroups: { ...state.publishedGroups, [group.id]: tillShapeOfGroup(withOption, state.groupSitePrices[group.id]) } });
    return withOption.options[withOption.options.length - 1].id;
  }
  // Keep Edify's group as it is. Square still has the option until the next publish removes it.
  set({ groupChanges: rest, publishedGroups: { ...state.publishedGroups, [group.id]: tillShapeOfGroup(withOption, state.groupSitePrices[group.id]) } });
  return undefined;
}

// ── Square-only items ───────────────────────────────────────────────────────

export function linkSquareOnly(sqId: string, source: TillSource, costs: Record<string, number> = {}): string | undefined {
  const sq = state.squareOnly.find((s) => s.id === sqId);
  if (!sq) return undefined;
  const fields: TillFields = {
    name: sq.name,
    kitchenName: '',
    category: sq.category,
    sizes: sq.sizes,
    prices: sq.prices,
    groups: [],
    sites: [],
    vat: state.settings.vatHot,
    description: '',
    photo: false,
  };
  const id = genTillId();
  const item: TillItem = {
    id,
    source,
    current: cloneFields(fields),
    published: cloneFields(fields),
    inSquare: cloneFields(fields),
    sizeCosts: costs,
    laterKeys: [],
    overwriteKeys: [],
    menuIds: sq.menuIds,
    menuGroups: sq.menuGroups,
  };
  set({ items: [...state.items, item], squareOnly: state.squareOnly.filter((s) => s.id !== sqId) });
  return id;
}

// ── Modifier groups at the till ─────────────────────────────────────────────

export type GroupTillStatus = 'in-sync' | 'ready' | 'changed' | 'not-on-till' | 'unused';

export function groupTillStatus(g: ModifierGroup, s: State = state): GroupTillStatus {
  if (s.groupChanges.some((c) => c.groupId === g.id)) return 'changed';
  const published = s.publishedGroups[g.id];
  if (!published) {
    const used = s.items.some((i) => i.current.groups.includes(g.id) || Object.values(i.sizeGroups ?? {}).some((l) => l.includes(g.id)));
    return used ? 'not-on-till' : 'unused';
  }
  return published === tillShapeOfGroup(g, s.groupSitePrices[g.id]) ? 'in-sync' : 'ready';
}

/** Keep a group's per-site option prices in Square, or charge one price everywhere. */
export function setKeepSitePrices(groupId: string, keepInSquare: boolean): void {
  const sp = state.groupSitePrices[groupId];
  if (!sp) return;
  set({ groupSitePrices: { ...state.groupSitePrices, [groupId]: { ...sp, keepInSquare } } });
}

export type OptionOffOnSizes = { groupName: string; optionName: string; sizes: string[]; everySize: boolean };

/**
 * Options switched off on some sizes of the recipe. Square can't follow:
 * it offers every option on every size of the item.
 */
export function optionsOffOnSizes(item: TillItem): OptionOffOnSizes[] {
  if (item.source.kind !== 'recipe') return [];
  const off = RECIPE_OPTIONS_OFF[item.source.recipeId];
  if (!off) return [];
  const out: OptionOffOnSizes[] = [];
  for (const gid of item.current.groups) {
    const g = findGroup(gid);
    if (!g) continue;
    for (const o of g.options) {
      const sizes = item.current.sizes.filter((sz) => off[sz]?.includes(o.id));
      if (sizes.length === 0) continue;
      out.push({ groupName: g.name, optionName: o.name, sizes, everySize: sizes.length === item.current.sizes.length });
    }
  }
  return out;
}

export function optionOffCopy(o: OptionOffOnSizes): string {
  const where = o.everySize ? 'on every size' : `for ${o.sizes.join(' and ')}`;
  return `${o.optionName} is off ${where} in the recipe, but Square still offers it there.`;
}

export function groupsWithPublishWork(groups: ModifierGroup[], s: State = state): ModifierGroup[] {
  return groups.filter((g) => {
    const st = groupTillStatus(g, s);
    return st === 'ready' || st === 'not-on-till';
  });
}

// ── Publish ─────────────────────────────────────────────────────────────────

/** Square allows one catalogue write at a time per merchant. The demo fails Latte once. */
const failOnce = new Set<string>(['ti-latte']);

export function publishItem(id: string): { ok: true } | { ok: false; reason: string } {
  const item = findTillItem(id);
  if (!item) return { ok: true };
  if (failOnce.has(id)) {
    failOnce.delete(id);
    return { ok: false, reason: 'Square was busy saving another change. Nothing changed on the till for this item.' };
  }
  if (item.takeOff) {
    removeFromList(id);
    return { ok: true };
  }
  if (!item.inSquare) {
    patchItem(id, (i) => ({
      ...i,
      inSquare: cloneFields(i.current),
      published: cloneFields(i.current),
      publishedByEdify: true,
      regularTypeInSquare: false,
    }));
    return { ok: true };
  }
  const keys = publishKeys(item);
  patchItem(id, (i) => ({
    ...i,
    inSquare: pickFields(i.inSquare!, i.current, keys),
    published: pickFields(i.published ?? i.inSquare!, i.current, keys),
    overwriteKeys: [],
    regularTypeInSquare: false,
  }));
  return { ok: true };
}

export function publishGroup(groupId: string): void {
  const g = findGroup(groupId);
  if (!g) return;
  const sp = state.groupSitePrices[groupId];
  if (sp && !sp.keepInSquare) {
    const rest = { ...state.groupSitePrices };
    delete rest[groupId];
    set({ publishedGroups: { ...state.publishedGroups, [groupId]: tillShapeOfGroup(g) }, groupSitePrices: rest });
    return;
  }
  set({ publishedGroups: { ...state.publishedGroups, [groupId]: tillShapeOfGroup(g, sp) } });
}

export function finishPublish(receipt: PublishReceipt): void {
  set({ lastReceipt: receipt, settings: { ...state.settings, lastPublishedAt: receipt.at } });
}

// ── Counts ──────────────────────────────────────────────────────────────────

export function squareChangeCount(s: State = state): number {
  const fieldChanges = s.items.reduce((n, i) => n + (i.deletedInSquare ? 1 : squareChangeKeys(i).length), 0);
  return fieldChanges + s.groupChanges.length;
}

export function publishCount(s: State, groups: ModifierGroup[]): number {
  return s.items.filter((i) => readyToPublish(i, s)).length + groupsWithPublishWork(groups, s).length + menusWithPublishWork(s).length;
}

export { statusOf };

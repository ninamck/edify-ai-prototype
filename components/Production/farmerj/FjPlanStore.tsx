'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { batchesToNumber, explode, fullBatchGrams, fullLineUnits, halfLineUnits, planProduct, type LineOverride, type PlanOptions, type ProductPlan } from './cascade';
import { cateringFor, cateringGrams, type CateringOrder } from './catering';
import { addDays, demoNowISO, planningWindowFor, referenceDaysFor, type ReferenceDay } from './calendar';
import { PRODUCT_BY_ID, PRODUCTS, type FinishedProduct } from './recipes';
import { averageDemand, type DayDemand } from './sales';
import { applySettings, defaultSettings, normaliseSettings, type FjSettings } from './fjSettings';
import { applyFarmerJRecipes, applyOverridesToRecipes, loadFarmerJOverrides, saveFarmerJOverrides } from './recipeBridge';
import { setRecipes, snapshotRecipes, useRecipes } from '@/components/Recipe/recipeStore';
import type { Recipe } from '@/components/Recipe/libraryFixtures';
import { useSiteSettingsStore } from '@/components/Settings/siteSettingsStore';
import { FJ_MAIN_LINE_ID, FJ_SECOND_LINE_ID } from './fjFixtures';
import { linesFor, linesFromBenches, setShopLines, type PlanLine } from './lines';
import { setShopStations, stationsFromBenches, type Station } from './stations';
import { kitFromBenches, setShopKit, type ShopKit } from './kit';
import { scheduleFromWindows, scheduleKey, setShopSchedules, type MakeOnSchedule } from './makeOn';
import { FJ_ALL_SHOPS_ID, FJ_SHOPS } from './shops';

/**
 * Everything a manager changes on a Farmer J plan, per shop and day, kept
 * in memory and mirrored to localStorage so a demo survives a refresh.
 * Everything else (suggested numbers, the cascade) is recomputed from the
 * rules in `cascade.ts` on every render.
 */

export type { LineOverride };

export type CloseCount = {
  /** Grams counted at close per product, carried to tomorrow. */
  carried: Record<string, number>;
  /** Grams binned per product with a reason. */
  binned: Record<string, { grams: number; reason: string }>;
  countedAtISO: string;
  countedBy: string;
};

export type DayRecord = {
  overrides: Record<string, LineOverride>;
  flexPct: number;
  cancelledOrders: string[];
  excludedReferenceDays: string[];
  approvedAtISO?: string;
  approvedBy?: string;
  /**
   * Set when Jana publishes Setup after this day was approved. The plan
   * below already runs on the new rules; `pinned` holds the units the GM
   * approved, so they can keep their numbers instead.
   */
  settingsChanged?: SettingsChangedFlag;
  close?: CloseCount;
  /** Prep list quantities typed over Edify's suggestion, in the component's own unit. */
  prepOverrides?: Record<string, number>;
  /** Section task ticks (task id → ISO time), tasks moved to another
   *  section (task id → section id) and people set per section. */
  ticks?: Record<string, string>;
  /**
   * What was actually made when a task was ticked (task id → batches,
   * who, when). Defaults to the task's planned batches; the person on the
   * section corrects it on the method card when they made more or less.
   * The Production record reads this against the plan and the till.
   */
  made?: Record<string, MadeEntry>;
  reassigned?: Record<string, string>;
  people?: Record<string, string>;
  /** Manager's drag order per list, keyed `${sectionId}::${slot}`. */
  taskOrder?: Record<string, string[]>;
};

export type MadeEntry = { batches: number; by: string; atISO: string };

export type SettingsChangedFlag = {
  publishId: string;
  atISO: string;
  by: string;
  /** Field names that changed for this shop. */
  fields: string[];
  /** Units per product per line as approved, before the publish. */
  pinned: Record<string, LineOverride>;
};

type StoreState = Record<string, DayRecord>;

const STORAGE_KEY = 'edify.farmerj.plan.v1';
const SETTINGS_KEY = 'edify.farmerj.settings.v1';

const emptyRecord = (): DayRecord => ({ overrides: {}, flexPct: 0, cancelledOrders: [], excludedReferenceDays: [] });

function keyFor(shopId: string, date: string) {
  return `${shopId}|${date}`;
}

type Ctx = {
  state: StoreState;
  get: (shopId: string, date: string) => DayRecord;
  update: (shopId: string, date: string, fn: (r: DayRecord) => DayRecord) => void;
  reset: () => void;
  /** Jana's central settings (draft, published, publish log). */
  settings: FjSettings;
  updateSettings: (fn: (s: FjSettings) => FjSettings) => void;
  /** The recipe library, so anything derived from the book re-runs when a recipe is saved. */
  recipes: Recipe[];
  /** Changes whenever any shop's lines change in site settings, so plans re-derive. */
  linesKey: string;
};

const FjPlanContext = createContext<Ctx | null>(null);

export function FjPlanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>({});
  const [settings, setSettings] = useState<FjSettings>(defaultSettings);
  const [hydrated, setHydrated] = useState(false);
  const recipes = useRecipes();
  const siteStore = useSiteSettingsStore();

  // Each shop's lines and kit are its benches in the site settings store,
  // and its make-on days are its production windows. Resolve them here once
  // per store change and register them for the engines. The key changes
  // when any does, so plans re-derive.
  const linesKey = useMemo(() => {
    const lines: Record<string, PlanLine[]> = {};
    const kit: Record<string, ShopKit> = {};
    const stations: Record<string, Station[]> = {};
    const schedules: Record<string, MakeOnSchedule> = {};
    for (const id of [FJ_ALL_SHOPS_ID, ...FJ_SHOPS.map(s => s.id)]) {
      const eff = siteStore.effectiveFor(id);
      lines[id] = linesFromBenches(eff.benches);
      kit[id] = kitFromBenches(eff.benches);
      stations[id] = stationsFromBenches(eff.benches);
      schedules[id] = scheduleFromWindows(eff.windows);
    }
    setShopSchedules(schedules, schedules[FJ_ALL_SHOPS_ID]);
    return setShopLines(lines) + setShopKit(kit) + setShopStations(stations) + scheduleKey();
  }, [siteStore]);

  // Hydrate once on mount. Reading localStorage in the initialiser would
  // run on the server and mismatch the first client render, so the store
  // starts empty and fills after hydration (same pattern as the other
  // demo stores).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState(migrateOverrides(JSON.parse(raw)));
      const rawSettings = window.localStorage.getItem(SETTINGS_KEY);
      if (rawSettings) setSettings(normaliseSettings(JSON.parse(rawSettings)));
      const overrides = loadFarmerJOverrides();
      if (Object.keys(overrides).length) setRecipes(applyOverridesToRecipes(snapshotRecipes(), overrides));
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      saveFarmerJOverrides(recipes);
    } catch {
      // ignore
    }
  }, [state, settings, recipes, hydrated]);

  // The engines read the recipe book's constants, so the published
  // settings and the library's recipe fields are written into them here,
  // before any child derives a plan.
  applySettings(settings.published);
  applyFarmerJRecipes(recipes);

  const get = useCallback((shopId: string, date: string) => state[keyFor(shopId, date)] ?? emptyRecord(), [state]);
  const update = useCallback((shopId: string, date: string, fn: (r: DayRecord) => DayRecord) => {
    setState(s => {
      const k = keyFor(shopId, date);
      return { ...s, [k]: fn(s[k] ?? emptyRecord()) };
    });
  }, []);
  const reset = useCallback(() => {
    setState({});
    setSettings(defaultSettings());
  }, []);
  const updateSettings = useCallback((fn: (s: FjSettings) => FjSettings) => setSettings(s => fn(s)), []);

  const value = useMemo(
    () => ({ state, get, update, reset, settings, updateSettings, recipes, linesKey }),
    [state, get, update, reset, settings, updateSettings, recipes, linesKey],
  );
  return <FjPlanContext.Provider value={value}>{children}</FjPlanContext.Provider>;
}

/** Older demos stored overrides as `{ main, second }`; they are keyed by line id now. */
function migrateOverrides(state: StoreState): StoreState {
  const legacy: Record<string, string> = { main: FJ_MAIN_LINE_ID, second: FJ_SECOND_LINE_ID };
  for (const rec of Object.values(state)) {
    for (const [pid, o] of Object.entries(rec.overrides ?? {})) {
      const next: LineOverride = {};
      for (const [k, v] of Object.entries(o as Record<string, number | undefined>)) {
        if (typeof v === 'number') next[legacy[k] ?? k] = v;
      }
      rec.overrides[pid] = next;
    }
  }
  return state;
}

export function useFjPlanStore(): Ctx {
  const ctx = useContext(FjPlanContext);
  if (!ctx) throw new Error('useFjPlanStore must be used inside FjPlanProvider');
  return ctx;
}

/** For surfaces shared with other brands (the chat), where the provider
 *  may be absent in tests or storybooks. */
export function useFjPlanStoreOptional(): Ctx | null {
  return useContext(FjPlanContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived plan for one shop-day
// ─────────────────────────────────────────────────────────────────────────────

export type DayPlan = {
  shopId: string;
  date: string;
  record: DayRecord;
  window: ReturnType<typeof planningWindowFor>;
  referenceDays: ReferenceDay[];
  includedReferenceDates: string[];
  demand: DayDemand;
  orders: CateringOrder[];
  activeOrders: CateringOrder[];
  carried: Record<string, number>;
  plans: ProductPlan[];
  /** Products with any demand or override, in group order. */
  products: FinishedProduct[];
  explosion: ReturnType<typeof explode>;
  approved: boolean;
  overriddenCount: number;
  /** The shop's service lines, in column order. */
  lines: PlanLine[];
  totals: {
    /** Planned units per line id. */
    byLine: Record<string, number>;
    /** Units on lines plating the recipe's container, and on small-container lines. */
    fullUnits: number;
    halfUnits: number;
    batches: number;
    gramsMade: number;
  };
};

export function computeDayPlan(shopId: string, date: string, record: DayRecord, yesterdayClose?: CloseCount): DayPlan {
  const window = planningWindowFor(date);
  const referenceDays = referenceDaysFor(date).map(r => ({
    ...r,
    included: r.included && !record.excludedReferenceDays.includes(r.date),
  }));
  const includedReferenceDates = referenceDays.filter(r => r.included).map(r => r.date);
  const demand = averageDemand(shopId, includedReferenceDates);
  const orders = cateringFor(shopId, date);
  const activeOrders = orders.filter(o => !record.cancelledOrders.includes(o.id));
  const carried = yesterdayClose?.carried ?? {};
  const lines = linesFor(shopId);
  const opts: PlanOptions = {
    flexPct: record.flexPct,
    catering: cateringGrams(activeOrders),
    carried,
    overrides: record.overrides,
    lines,
  };
  const products = PRODUCTS.filter(p => {
    const hasDemand = (demand.products[p.id]?.grams ?? 0) > 0;
    const hasCatering = (opts.catering?.[p.id] ?? 0) > 0;
    const hasOverride = record.overrides[p.id] !== undefined;
    return hasDemand || hasCatering || hasOverride;
  });
  const plans = products.map(p => planProduct(p.id, demand, opts));
  const explosion = explode(plans, demand.components);
  const byLine: Record<string, number> = Object.fromEntries(lines.map(l => [l.id, 0]));
  for (const p of plans) for (const l of p.lines) byLine[l.lineId] = (byLine[l.lineId] ?? 0) + l.plannedUnits;
  const totals = {
    byLine,
    fullUnits: plans.reduce((n, p) => n + fullLineUnits(p), 0),
    halfUnits: plans.reduce((n, p) => n + halfLineUnits(p), 0),
    batches: plans.reduce((n, p) => n + batchesToNumber(p.batches), 0),
    gramsMade: plans.reduce((n, p) => n + p.gramsMade, 0),
  };
  return {
    shopId,
    date,
    record,
    window,
    referenceDays,
    includedReferenceDates,
    demand,
    orders,
    activeOrders,
    carried,
    plans,
    products,
    explosion,
    approved: Boolean(record.approvedAtISO),
    overriddenCount: plans.filter(p => p.overridden).length,
    lines,
    totals,
  };
}

/** The plan for one shop-day plus the actions the day plan screen needs. */
export function useFjDayPlan(shopId: string, date: string) {
  const store = useFjPlanStore();
  const record = store.get(shopId, date);
  const yesterday = store.get(shopId, addDays(date, -1));
  const published = store.settings.published;
  const recipes = store.recipes;
  const linesKey = store.linesKey;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- published settings, recipe edits and line changes alter what the plan derives from
  const plan = useMemo(() => computeDayPlan(shopId, date, record, yesterday.close), [shopId, date, record, yesterday.close, published, recipes, linesKey]);

  const setOverride = useCallback(
    (productId: string, lineId: string, units: number | undefined) =>
      store.update(shopId, date, r => {
        const cur: LineOverride = { ...(r.overrides[productId] ?? {}) };
        if (units === undefined) delete cur[lineId];
        else cur[lineId] = Math.max(0, units);
        const overrides = { ...r.overrides };
        if (Object.keys(cur).length === 0) delete overrides[productId];
        else overrides[productId] = cur;
        return { ...r, overrides };
      }),
    [store, shopId, date],
  );

  const clearOverride = useCallback(
    (productId: string) =>
      store.update(shopId, date, r => {
        const overrides = { ...r.overrides };
        delete overrides[productId];
        return { ...r, overrides };
      }),
    [store, shopId, date],
  );

  const setFlex = useCallback((flexPct: number) => store.update(shopId, date, r => ({ ...r, flexPct })), [store, shopId, date]);

  const toggleOrder = useCallback(
    (orderId: string) =>
      store.update(shopId, date, r => ({
        ...r,
        cancelledOrders: r.cancelledOrders.includes(orderId) ? r.cancelledOrders.filter(id => id !== orderId) : [...r.cancelledOrders, orderId],
      })),
    [store, shopId, date],
  );

  const toggleReferenceDay = useCallback(
    (refDate: string) =>
      store.update(shopId, date, r => ({
        ...r,
        excludedReferenceDays: r.excludedReferenceDays.includes(refDate)
          ? r.excludedReferenceDays.filter(d => d !== refDate)
          : [...r.excludedReferenceDays, refDate],
      })),
    [store, shopId, date],
  );

  const approve = useCallback(
    (by: string, dates: string[] = [date]) => {
      const at = demoNowISO();
      for (const d of dates) store.update(shopId, d, r => ({ ...r, approvedAtISO: at, approvedBy: by, settingsChanged: undefined }));
    },
    [store, shopId, date],
  );

  const reopen = useCallback(
    () => store.update(shopId, date, r => ({ ...r, approvedAtISO: undefined, approvedBy: undefined, settingsChanged: undefined })),
    [store, shopId, date],
  );

  /** After a publish: take the re-derived numbers and re-approve. */
  const acceptNewNumbers = useCallback(
    (by: string) => store.update(shopId, date, r => ({ ...r, approvedAtISO: demoNowISO(), approvedBy: by, settingsChanged: undefined })),
    [store, shopId, date],
  );

  /** After a publish: pin the approved units as overrides so the day runs as approved. */
  const keepApprovedNumbers = useCallback(
    (by: string) =>
      store.update(shopId, date, r => {
        const pinned = r.settingsChanged?.pinned ?? {};
        const overrides = { ...r.overrides };
        for (const [productId, units] of Object.entries(pinned)) overrides[productId] = { ...(overrides[productId] ?? {}), ...units };
        return { ...r, overrides, approvedAtISO: demoNowISO(), approvedBy: by, settingsChanged: undefined };
      }),
    [store, shopId, date],
  );

  const setClose = useCallback((close: CloseCount | undefined) => store.update(shopId, date, r => ({ ...r, close })), [store, shopId, date]);

  return { plan, setOverride, clearOverride, setFlex, toggleOrder, toggleReferenceDay, approve, reopen, acceptNewNumbers, keepApprovedNumbers, setClose, record };
}

/** Approval state across a planning window, for the header pill. */
export function useWindowApproval(shopId: string, date: string) {
  const store = useFjPlanStore();
  const window = planningWindowFor(date);
  const approvedDays = window.days.filter(d => Boolean(store.get(shopId, d).approvedAtISO));
  return { window, approvedDays, allApproved: approvedDays.length === window.days.length };
}

/** Grams one main-line unit holds, exposed for the screens. */
export function unitGrams(product: FinishedProduct): number {
  return fullBatchGrams(product) / product.unitsPerBatch;
}

export { PRODUCT_BY_ID };

'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { batchesToNumber, explode, fullBatchGrams, planProduct, type PlanOptions, type ProductPlan } from './cascade';
import { cateringFor, cateringGrams, type CateringOrder } from './catering';
import { addDays, planningWindowFor, referenceDaysFor, type ReferenceDay } from './calendar';
import { PRODUCT_BY_ID, PRODUCTS, type FinishedProduct } from './recipes';
import { averageDemand, type DayDemand } from './sales';
import { applySettings, defaultSettings, normaliseSettings, type FjSettings } from './fjSettings';

/**
 * Everything a manager changes on a Farmer J plan, per shop and day, kept
 * in memory and mirrored to localStorage so a demo survives a refresh.
 * Everything else (suggested numbers, the cascade) is recomputed from the
 * rules in `cascade.ts` on every render.
 */

export type LineOverride = { main?: number; second?: number };

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
  close?: CloseCount;
  /** Prep list quantities typed over Edify's suggestion, in the component's own unit. */
  prepOverrides?: Record<string, number>;
  /** Section task ticks (task id → ISO time), tasks moved to another
   *  section (task id → section id) and people set per section. */
  ticks?: Record<string, string>;
  reassigned?: Record<string, string>;
  people?: Record<string, string>;
  /** Manager's drag order per list, keyed `${sectionId}::${slot}`. */
  taskOrder?: Record<string, string[]>;
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
};

const FjPlanContext = createContext<Ctx | null>(null);

export function FjPlanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>({});
  const [settings, setSettings] = useState<FjSettings>(defaultSettings);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate once on mount. Reading localStorage in the initialiser would
  // run on the server and mismatch the first client render, so the store
  // starts empty and fills after hydration (same pattern as the other
  // demo stores).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState(JSON.parse(raw));
      const rawSettings = window.localStorage.getItem(SETTINGS_KEY);
      if (rawSettings) setSettings(normaliseSettings(JSON.parse(rawSettings)));
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
    } catch {
      // ignore
    }
  }, [state, settings, hydrated]);

  // The engines read the recipe book's constants, so the published
  // settings are written into them here, before any child derives a plan.
  applySettings(settings.published);

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
    () => ({ state, get, update, reset, settings, updateSettings }),
    [state, get, update, reset, settings, updateSettings],
  );
  return <FjPlanContext.Provider value={value}>{children}</FjPlanContext.Provider>;
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
  totals: { mainUnits: number; secondUnits: number; batches: number; gramsMade: number };
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
  const opts: PlanOptions = {
    flexPct: record.flexPct,
    catering: cateringGrams(activeOrders),
    carried,
    overrides: record.overrides,
  };
  const products = PRODUCTS.filter(p => {
    const hasDemand = (demand.products[p.id]?.grams ?? 0) > 0;
    const hasCatering = (opts.catering?.[p.id] ?? 0) > 0;
    const hasOverride = record.overrides[p.id] !== undefined;
    return hasDemand || hasCatering || hasOverride;
  });
  const plans = products.map(p => planProduct(p.id, demand, opts));
  const explosion = explode(plans, demand.components);
  const totals = plans.reduce(
    (t, p) => ({
      mainUnits: t.mainUnits + p.main.plannedUnits,
      secondUnits: t.secondUnits + p.second.plannedUnits,
      batches: t.batches + batchesToNumber(p.batches),
      gramsMade: t.gramsMade + p.gramsMade,
    }),
    { mainUnits: 0, secondUnits: 0, batches: 0, gramsMade: 0 },
  );
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
    totals,
  };
}

/** The plan for one shop-day plus the actions the day plan screen needs. */
export function useFjDayPlan(shopId: string, date: string) {
  const store = useFjPlanStore();
  const record = store.get(shopId, date);
  const yesterday = store.get(shopId, addDays(date, -1));
  const published = store.settings.published;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- published settings change the recipe book the plan derives from
  const plan = useMemo(() => computeDayPlan(shopId, date, record, yesterday.close), [shopId, date, record, yesterday.close, published]);

  const setOverride = useCallback(
    (productId: string, line: 'main' | 'second', units: number | undefined) =>
      store.update(shopId, date, r => {
        const cur = { ...(r.overrides[productId] ?? {}) };
        if (units === undefined) delete cur[line];
        else cur[line] = Math.max(0, units);
        const overrides = { ...r.overrides };
        if (cur.main === undefined && cur.second === undefined) delete overrides[productId];
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
      const at = new Date().toISOString();
      for (const d of dates) store.update(shopId, d, r => ({ ...r, approvedAtISO: at, approvedBy: by }));
    },
    [store, shopId, date],
  );

  const reopen = useCallback(
    () => store.update(shopId, date, r => ({ ...r, approvedAtISO: undefined, approvedBy: undefined })),
    [store, shopId, date],
  );

  const setClose = useCallback((close: CloseCount | undefined) => store.update(shopId, date, r => ({ ...r, close })), [store, shopId, date]);

  return { plan, setOverride, clearOverride, setFlex, toggleOrder, toggleReferenceDay, approve, reopen, setClose, record };
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

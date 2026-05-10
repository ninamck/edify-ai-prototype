'use client';

/**
 * Per-day order state for HYBRID sites.
 *
 * A HYBRID bakes some recipes itself and orders the rest from its hub. This
 * store owns the *receive-from-hub* slice of that workflow — the hybrid
 * manager's draft order, scoped to one (siteId, date) pair, expressed as
 * per-slot quantities (mirrors the spoke order flow on `/production/spokes`
 * so the hub sees both kinds of submission with one shape on the matrix).
 *
 * State shape per (siteId|date):
 *   {
 *     perSlot: { [skuId]: number[] }    // length = pColumnCount, e.g. [4, 6, 2]
 *     status:  'draft' | 'submitted' | 'acknowledged'
 *     submittedAt?: string              // ISO, set when the manager hits Send
 *   }
 *
 * Hydration: fresh `(siteId, date)` keys are seeded from
 * `spokeOrderForDate(siteId, hubId, date)` so the initial steppers carry
 * Quinn's proposal (split across slots using the forecast's phase weights),
 * exactly like the spoke flow's `splitAcrossSlots` helper.
 *
 * The store is intentionally lighter than the full spoke page state — no
 * unlock window, no auto-finalisation timer. Those exist on the spoke page
 * and the hub-side matrix; this is the minimum to let a HYBRID manager
 * draft + submit alongside the bakes they're making locally. We can layer
 * the rest in once the surface earns it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  spokeOrderForDate,
  submissionCutoffFor,
  type SiteId,
  type SkuId,
} from './fixtures';

export type HybridOrderStatus = 'draft' | 'submitted' | 'acknowledged';

export type HybridOrderState = {
  /** Per-slot units keyed by SKU. Length always matches `slotCount` for
   *  this (site, date); resized lazily as `slotCount` changes between
   *  reads (hubs almost never change run cadence within a day, but the
   *  guard keeps the array shape honest). */
  perSlot: Record<SkuId, number[]>;
  status: HybridOrderStatus;
  cutoffISO: string;
  submittedAt?: string;
};

type StoreValue = {
  /** Reads — call from render. Returns `null` when there's nothing
   *  hydrated yet (consumers should use `useHybridOrder` which handles
   *  hydration on the read path). */
  read: (siteId: SiteId, date: string) => HybridOrderState | null;
  /** Initialise (siteId, date) with a default per-slot map + cutoff if
   *  it doesn't already exist. Called from `useHybridOrder`. */
  hydrate: (
    siteId: SiteId,
    date: string,
    seed: { perSlot: Record<SkuId, number[]>; cutoffISO: string },
  ) => void;
  setSlotQty: (
    siteId: SiteId,
    date: string,
    skuId: SkuId,
    slotIndex: number,
    slotCount: number,
    qty: number,
  ) => void;
  /** Set the entire per-slot array for a SKU (used by `Apply Quinn's split`
   *  in the focus panel — not surfaced today but kept for parity with the
   *  spoke flow so we don't have to rewire when it lands). */
  setPerSlot: (siteId: SiteId, date: string, skuId: SkuId, slots: number[]) => void;
  submit: (siteId: SiteId, date: string) => void;
  /** Promote a submitted day to `acknowledged`. Called by the submit bar
   *  on a 800ms delay after `submit` — mirrors the spoke flow's
   *  "submitted → acknowledged" auto-progression so the demo lands at
   *  the same green confirmation state. */
  acknowledge: (siteId: SiteId, date: string) => void;
  /** Reset the day's draft back to Quinn's proposal — wipes any manager
   *  edits and clears the submitted/acknowledged flag. */
  resetToHydration: (siteId: SiteId, date: string) => void;
};

const HybridOrderStoreContext = createContext<StoreValue | null>(null);

const keyFor = (siteId: SiteId, date: string) => `${siteId}|${date}`;

export function HybridOrderStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Record<string, HybridOrderState>>({});

  const read = useCallback<StoreValue['read']>((siteId, date) => state[keyFor(siteId, date)] ?? null, [state]);

  const hydrate = useCallback<StoreValue['hydrate']>((siteId, date, seed) => {
    const k = keyFor(siteId, date);
    setState(prev => {
      if (prev[k]) return prev;
      return {
        ...prev,
        [k]: {
          perSlot: seed.perSlot,
          status: 'draft',
          cutoffISO: seed.cutoffISO,
        },
      };
    });
  }, []);

  const setSlotQty = useCallback<StoreValue['setSlotQty']>(
    (siteId, date, skuId, slotIndex, slotCount, qty) => {
      const k = keyFor(siteId, date);
      const cleanQty = Math.max(0, Math.round(qty));
      setState(prev => {
        const day = prev[k];
        if (!day) return prev;
        const current = day.perSlot[skuId] ?? Array.from({ length: slotCount }, () => 0);
        // Pad / truncate so writes always honour the active slot count
        // even if the hub's run cadence drifted between renders.
        const padded = Array.from({ length: slotCount }, (_, i) => current[i] ?? 0);
        padded[slotIndex] = cleanQty;
        return {
          ...prev,
          [k]: {
            ...day,
            perSlot: { ...day.perSlot, [skuId]: padded },
            // Editing during a "submitted" window flips the status back
            // to draft so the submit affordance reappears — mirrors the
            // spoke flow's resubmit semantics.
            status: day.status === 'acknowledged' ? 'acknowledged' : 'draft',
          },
        };
      });
    },
    [],
  );

  const setPerSlot = useCallback<StoreValue['setPerSlot']>((siteId, date, skuId, slots) => {
    const k = keyFor(siteId, date);
    setState(prev => {
      const day = prev[k];
      if (!day) return prev;
      return {
        ...prev,
        [k]: {
          ...day,
          perSlot: { ...day.perSlot, [skuId]: slots.map(n => Math.max(0, Math.round(n))) },
          status: day.status === 'acknowledged' ? 'acknowledged' : 'draft',
        },
      };
    });
  }, []);

  const submit = useCallback<StoreValue['submit']>((siteId, date) => {
    const k = keyFor(siteId, date);
    setState(prev => {
      const day = prev[k];
      if (!day) return prev;
      return {
        ...prev,
        [k]: { ...day, status: 'submitted', submittedAt: new Date().toISOString() },
      };
    });
  }, []);

  const acknowledge = useCallback<StoreValue['acknowledge']>((siteId, date) => {
    const k = keyFor(siteId, date);
    setState(prev => {
      const day = prev[k];
      if (!day || day.status !== 'submitted') return prev;
      return { ...prev, [k]: { ...day, status: 'acknowledged' } };
    });
  }, []);

  const resetToHydration = useCallback<StoreValue['resetToHydration']>((siteId, date) => {
    const k = keyFor(siteId, date);
    setState(prev => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }, []);

  const value = useMemo<StoreValue>(
    () => ({ read, hydrate, setSlotQty, setPerSlot, submit, acknowledge, resetToHydration }),
    [read, hydrate, setSlotQty, setPerSlot, submit, acknowledge, resetToHydration],
  );

  return (
    <HybridOrderStoreContext.Provider value={value}>{children}</HybridOrderStoreContext.Provider>
  );
}

/** Imperative actions only — call from event handlers. */
export function useHybridOrderActions(): Pick<
  StoreValue,
  'setSlotQty' | 'setPerSlot' | 'submit' | 'acknowledge' | 'resetToHydration'
> {
  const ctx = useContext(HybridOrderStoreContext);
  if (!ctx) {
    return {
      setSlotQty: () => {},
      setPerSlot: () => {},
      submit: () => {},
      acknowledge: () => {},
      resetToHydration: () => {},
    };
  }
  return {
    setSlotQty: ctx.setSlotQty,
    setPerSlot: ctx.setPerSlot,
    submit: ctx.submit,
    acknowledge: ctx.acknowledge,
    resetToHydration: ctx.resetToHydration,
  };
}

/**
 * Read the (siteId, date) order state. Hydrates lazily on first read by
 * pulling Quinn's proposal from `spokeOrderForDate` and splitting it
 * across slots using the same morning/midday/afternoon weights as the
 * spoke page (so a HYBRID manager's first draft already mirrors what
 * Quinn would propose).
 *
 * Returns `null` while there's nothing to read (no hub link). The
 * hydration effect re-runs on (siteId, date, slotCount) changes, so a
 * day-strip flip or a hub run-count tweak repopulates correctly.
 */
export function useHybridOrder(
  siteId: SiteId,
  date: string,
  hubId: SiteId | null,
  slotCount: number,
): HybridOrderState | null {
  const ctx = useContext(HybridOrderStoreContext);
  const current = ctx?.read(siteId, date) ?? null;

  useEffect(() => {
    if (!ctx) return;
    if (!hubId) return;
    if (slotCount <= 0) return;
    // Re-seed whenever there's nothing in the store for this key. The
    // `hydrate` action is idempotent (early-returns when the key already
    // exists), so calling it twice across StrictMode double-effects is
    // safe; a `resetToHydration` clear naturally flows back here because
    // `current` flips to null and the effect re-runs.
    if (current) return;

    const order = spokeOrderForDate(siteId, hubId, date);
    const perSlot: Record<SkuId, number[]> = {};
    for (const ln of order.lines) {
      perSlot[ln.skuId] = splitAcrossSlots(ln.quinnProposed, ln.forecast?.byPhase, slotCount);
    }
    const cutoffISO = order.cutoffDateTime ?? submissionCutoffFor(hubId, date);
    ctx.hydrate(siteId, date, { perSlot, cutoffISO });
  }, [ctx, siteId, date, hubId, slotCount, current]);

  return current;
}

/**
 * Same forecast-weighted distribution as the spoke page so a manager who
 * orders identically across both surfaces gets the same per-slot shape.
 * Pulled inline here (instead of imported) because the spoke page version
 * is page-local and not exported; copying the half-dozen lines is cheaper
 * than refactoring it out for parity.
 */
function splitAcrossSlots(
  total: number,
  byPhase: { morning?: number; midday?: number; afternoon?: number } | undefined,
  slotCount: number,
): number[] {
  if (slotCount <= 0) return [];
  if (total <= 0) return Array.from({ length: slotCount }, () => 0);

  // Default to equal weights; override with the forecast bias when present.
  const weights: number[] = Array.from({ length: slotCount }, () => 1);
  if (byPhase) {
    // Phase → slot mapping: morning → P1, midday → P2 / P3, afternoon → P4
    // (and tail). Mirrors the spoke flow's intuition without adding a new
    // configuration knob.
    if (slotCount >= 1) weights[0] = byPhase.morning ?? weights[0];
    if (slotCount >= 2) weights[1] = byPhase.midday ?? weights[1];
    if (slotCount >= 3) weights[2] = byPhase.afternoon ?? weights[2];
    if (slotCount >= 4) weights[3] = (byPhase.afternoon ?? 1) * 0.5;
  }

  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map(w => (total * w) / sumW);
  const rounded = raw.map(n => Math.floor(n));
  // Distribute rounding remainder onto the slot with the largest fractional
  // part so the array always sums back to `total`.
  let remainder = total - rounded.reduce((a, b) => a + b, 0);
  const fracIdxs = raw
    .map((n, i) => ({ i, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac);
  let idx = 0;
  while (remainder > 0 && fracIdxs.length > 0) {
    rounded[fracIdxs[idx % fracIdxs.length].i] += 1;
    remainder -= 1;
    idx += 1;
  }
  return rounded;
}

/** Convenience: row-level total from a per-slot array. Defensive against
 *  undefined entries so it works during hydration. */
export function sumSlots(arr: number[] | undefined): number {
  if (!arr) return 0;
  let n = 0;
  for (const v of arr) n += Math.max(0, v || 0);
  return n;
}

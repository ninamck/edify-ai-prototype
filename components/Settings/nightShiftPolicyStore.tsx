'use client';

/**
 * NightShiftPolicyStore — Support Centre's single source of truth for the
 * night-shift production rules (P128 / PAC191).
 *
 * Unlike `siteSettingsStore`, this store is **estate-scoped**: one value
 * for the whole Pret estate. Every site running night shift inherits
 * these rules without per-site overrides. That mirrors the PRD:
 *
 *   "A Support Centre tab where night-shift rules are set once: time
 *    window, first-order SKU priority, category priority. Every site
 *    running night shift inherits those rules; the bench order on the
 *    board reflects them."
 *
 * The store hydrates from `localStorage['edify.nightShiftPolicy.v1']` so
 * a Support Centre edit survives reloads — essential for demo flow where
 * the Pret admin sets a rule, then the GM jumps onto the production
 * board and sees the bench order respect it.
 *
 * The default value falls back to `PRET_NIGHT_SHIFT_POLICY` from
 * `components/Production/fixtures.ts` (PAC070's existing seed).
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
  PRET_NIGHT_SHIFT_POLICY,
  type NightShiftPolicy,
} from '@/components/Production/fixtures';

const STORAGE_KEY = 'edify.nightShiftPolicy.v1';

// ─── Defaults ────────────────────────────────────────────────────────────────

/** The seeded policy — what Reset to defaults rolls back to. */
export const DEFAULT_NIGHT_SHIFT_POLICY: NightShiftPolicy = PRET_NIGHT_SHIFT_POLICY;

/** Deep-clone so consumers can mutate freely without poisoning the seed. */
function cloneDefault(): NightShiftPolicy {
  return {
    nightStart: DEFAULT_NIGHT_SHIFT_POLICY.nightStart,
    nightEnd: DEFAULT_NIGHT_SHIFT_POLICY.nightEnd,
    firstOrder: [...DEFAULT_NIGHT_SHIFT_POLICY.firstOrder],
    categoryOrder: [...DEFAULT_NIGHT_SHIFT_POLICY.categoryOrder],
  };
}

/**
 * Sanity-check a parsed blob from localStorage. We don't want a corrupt
 * old version (or someone hand-editing storage) to crash the app — better
 * to silently fall back to the default seed.
 */
function isNightShiftPolicy(x: unknown): x is NightShiftPolicy {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.nightStart === 'string' &&
    typeof o.nightEnd === 'string' &&
    Array.isArray(o.firstOrder) &&
    o.firstOrder.every(v => typeof v === 'string') &&
    Array.isArray(o.categoryOrder) &&
    o.categoryOrder.every(v => typeof v === 'string')
  );
}

// ─── Context ─────────────────────────────────────────────────────────────────

type NightShiftPolicyValue = {
  /** The live, merged policy — never undefined. */
  policy: NightShiftPolicy;
  /** True when the live policy differs from the seeded default. */
  isOverridden: boolean;
  /** Replace the whole policy (used by Save). */
  replace: (next: NightShiftPolicy) => void;
  /** Drop the override, fall back to the seeded default. */
  reset: () => void;
};

const Ctx = createContext<NightShiftPolicyValue | null>(null);

export function NightShiftPolicyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [policy, setPolicy] = useState<NightShiftPolicy>(() => cloneDefault());

  // Hydrate once on mount. We intentionally don't read localStorage in
  // the lazy initialiser because that would run during SSR — Next 16
  // hydrates client-side and we want a deterministic initial render.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (isNightShiftPolicy(parsed)) {
        setPolicy(parsed);
      }
    } catch {
      // ignore — corrupt entry just means we start clean
    }
  }, []);

  // Persist on every change. We compare against the seed and clear
  // storage when the policy is back to defaults so the blob doesn't
  // hang around once a Pret admin has hit Reset.
  useEffect(() => {
    try {
      if (isDefault(policy)) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(policy));
      }
    } catch {
      // ignore — storage may be full / disabled
    }
  }, [policy]);

  const replace = useCallback((next: NightShiftPolicy) => {
    setPolicy({
      nightStart: next.nightStart,
      nightEnd: next.nightEnd,
      firstOrder: [...next.firstOrder],
      categoryOrder: [...next.categoryOrder],
    });
  }, []);

  const reset = useCallback(() => {
    setPolicy(cloneDefault());
  }, []);

  const value = useMemo<NightShiftPolicyValue>(
    () => ({
      policy,
      isOverridden: !isDefault(policy),
      replace,
      reset,
    }),
    [policy, replace, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Read-only access to the live policy. Components outside the provider
 * (e.g. during isolated unit-tests) see the seeded default and their
 * writes are no-ops, matching the `useSiteSettingsStore` fallback.
 */
export function useNightShiftPolicy(): NightShiftPolicyValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      policy: cloneDefault(),
      isOverridden: false,
      replace: () => {},
      reset: () => {},
    };
  }
  return ctx;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isDefault(p: NightShiftPolicy): boolean {
  return (
    p.nightStart === DEFAULT_NIGHT_SHIFT_POLICY.nightStart &&
    p.nightEnd === DEFAULT_NIGHT_SHIFT_POLICY.nightEnd &&
    arraysEqual(p.firstOrder, DEFAULT_NIGHT_SHIFT_POLICY.firstOrder) &&
    arraysEqual(p.categoryOrder, DEFAULT_NIGHT_SHIFT_POLICY.categoryOrder)
  );
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Count differences from the seeded default — used by the tab badge. */
export function countPolicyOverrides(p: NightShiftPolicy): number {
  let n = 0;
  if (p.nightStart !== DEFAULT_NIGHT_SHIFT_POLICY.nightStart) n += 1;
  if (p.nightEnd !== DEFAULT_NIGHT_SHIFT_POLICY.nightEnd) n += 1;
  if (!arraysEqual(p.firstOrder, DEFAULT_NIGHT_SHIFT_POLICY.firstOrder)) n += 1;
  if (!arraysEqual(p.categoryOrder, DEFAULT_NIGHT_SHIFT_POLICY.categoryOrder)) n += 1;
  return n;
}

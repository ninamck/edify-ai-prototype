'use client';

/**
 * CompanyContextStore — a single free-form blob of "what Edify should
 * know about us" that lives once at the company level and is read by
 * every AI surface (briefing panel, Quinn chat, suggested orders,
 * forecasts) when it composes a recommendation.
 *
 * Unlike `siteSettingsStore` (per-site overlays) or `nightShiftPolicyStore`
 * (estate-scoped structured policy), this store is intentionally
 * unstructured: the operator writes prose. Edify treats it as
 * preamble — the way Claude treats a system prompt.
 *
 * Persistence mirrors the other settings stores: hydrate from
 * `localStorage['edify.companyContext.v1']` on mount, write on every
 * change, clear the entry when the body is empty so the blob doesn't
 * linger after a reset.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'edify.companyContext.v1';

// ─── Defaults ────────────────────────────────────────────────────────────────

/**
 * Example seed the operator can pull in via "Restore example". Kept as
 * a single multi-line string so the editor surface stays a single
 * textarea — the structure is communicated by Markdown-style headings
 * rather than schema.
 */
export const EXAMPLE_COMPANY_CONTEXT = `# Business priorities
- Fresh-bake everything customer-facing wherever possible.
- The lunch peak (12:00–14:00) is sacred — staffing, bakes and dispatch must protect it.
- We'd rather sell out at 16:00 than carry waste over 6%.

# Operational constraints
- Bank holiday lead times are 48 hours, not the usual 24.
- The Southern hub overflows to Westgate Central whenever capacity exceeds 90%.
- Night shift never starts a new SKU after 04:30.

# Brand voice
- Confident, practical baker. Short sentences. No marketing jargon.
- Always refer to staff as "team", never "labour" or "headcount".

# What Edify should call out
- Anything that risks customer-facing waste above 6% for two days running.
- Spokes ordering above 110% of forecast two days running.
- Any site whose stocktake variance crosses 4% week-on-week.

# What Edify should never suggest
- Cutting the lunch bake to recover margin.
- Substituting fresh-bake SKUs for thawed equivalents in flagship sites.
`;

// ─── Types ───────────────────────────────────────────────────────────────────

export type CompanyContext = {
  /** Free-form prose. Empty string means "no context set". */
  body: string;
  /** ISO timestamp of the last save, or null if never saved. */
  updatedAt: string | null;
};

type CompanyContextValue = {
  context: CompanyContext;
  /** True when the operator has saved any non-empty body. */
  isCustom: boolean;
  /** Persist a new body and stamp updatedAt = now. */
  save: (body: string) => void;
  /** Clear the body and the timestamp. */
  reset: () => void;
  /** Replace the body with the seeded example and stamp updatedAt = now. */
  restoreExample: () => void;
};

// ─── Storage helpers ─────────────────────────────────────────────────────────

function isStored(x: unknown): x is CompanyContext {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.body === 'string' &&
    (o.updatedAt === null || typeof o.updatedAt === 'string')
  );
}

// ─── Context ─────────────────────────────────────────────────────────────────

const Ctx = createContext<CompanyContextValue | null>(null);

export function CompanyContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Start empty so SSR and the first client render agree. We hydrate
  // from localStorage in a mount effect.
  const [state, setState] = useState<CompanyContext>({
    body: '',
    updatedAt: null,
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (isStored(parsed)) setState(parsed);
    } catch {
      // ignore — corrupt entry just means we start clean
    }
  }, []);

  useEffect(() => {
    try {
      if (state.body === '' && state.updatedAt === null) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch {
      // ignore — storage may be full / disabled
    }
  }, [state]);

  const save = useCallback((body: string) => {
    setState({ body, updatedAt: new Date().toISOString() });
  }, []);

  const reset = useCallback(() => {
    setState({ body: '', updatedAt: null });
  }, []);

  const restoreExample = useCallback(() => {
    setState({
      body: EXAMPLE_COMPANY_CONTEXT,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const value = useMemo<CompanyContextValue>(
    () => ({
      context: state,
      isCustom: state.body.trim().length > 0,
      save,
      reset,
      restoreExample,
    }),
    [state, save, reset, restoreExample],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Read + write access to the company context. Components rendered
 * outside the provider (e.g. in isolated tests) get a no-op fallback so
 * call sites don't need to null-check.
 */
export function useCompanyContext(): CompanyContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      context: { body: '', updatedAt: null },
      isCustom: false,
      save: () => {},
      reset: () => {},
      restoreExample: () => {},
    };
  }
  return ctx;
}

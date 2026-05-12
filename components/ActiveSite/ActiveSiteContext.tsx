'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/**
 * Active "persona" site shown in the top-bar SiteSwitcher.
 *
 * Distinct from the production fixtures' `PRET_SITES`:
 *  - PRET_SITES models the production data graph (hubs, spokes, recipes,
 *    submissions). It's domain data.
 *  - ActiveSite is a UX-level "who am I logged in as right now" toggle for
 *    the demo. Switching it flips the sidebar nav set, the top-bar label,
 *    and any other shell-wide UI that should adapt per persona.
 *
 * Persisted in localStorage so the choice survives reloads / route
 * changes during a demo session.
 */

export type ActiveSiteType = 'HUB' | 'SPOKE' | 'HYBRID' | 'STANDALONE' | 'ALL';

export type ActiveSite = {
  id: string;
  name: string;
  type: ActiveSiteType;
  /** Short descriptor shown under the name in the dropdown row. */
  caption: string;
};

const STORAGE_KEY = 'edify.activeSiteId';

export const ACTIVE_SITES: ActiveSite[] = [
  {
    id: 'all-sites',
    name: 'All sites',
    type: 'ALL',
    // Meta-persona: aggregates every site for the cross-estate views
    // (currently only the Monitor stock → Estate grid). Other surfaces
    // treat this as STANDALONE so the rest of the app keeps working
    // without per-route gating — see `isStandalone` below.
    caption: 'Estate roll-up · All sites',
  },
  {
    id: 'fitzroy-espresso',
    name: 'Fitzroy Espresso',
    type: 'HUB',
    caption: 'Hub kitchen · Bakes for the network',
  },
  {
    id: 'fitzroy-kings-cross',
    name: "Fitzroy King's Cross",
    type: 'SPOKE',
    caption: 'Commuter spoke · Receives from Fitzroy Espresso',
  },
  {
    id: 'fitzroy-heathrow',
    name: 'Fitzroy Heathrow',
    type: 'HYBRID',
    // Hybrid = makes some items here on the bench, receives the rest
    // from the hub. Heathrow T5 is the canonical hybrid in the fixture
    // graph (see `site-hybrid-airport`).
    caption: 'Hybrid airport site · Makes + receives',
  },
  {
    id: 'fitzroy-islington',
    name: 'Fitzroy Islington',
    type: 'STANDALONE',
    // Standalone = self-producing. Bakes on its own benches, no hub
    // dependency. The persona uses the Plan tab as their daily landing
    // surface (steppers + forecast + carry-over) — no Today screen
    // because the manager actively shapes the day rather than
    // monitoring an automated bake.
    caption: 'Standalone site · Self-producing',
  },
];

const DEFAULT_ACTIVE_SITE_ID = 'fitzroy-espresso';

type ActiveSiteContextValue = {
  sites: ActiveSite[];
  activeSiteId: string;
  activeSite: ActiveSite;
  setActiveSiteId: (id: string) => void;
  /** Convenience flags so consumers don't have to compare strings. */
  isHub: boolean;
  isSpoke: boolean;
  isHybrid: boolean;
  // NOTE: `isStandalone` is intentionally `true` for the ALL meta-site
  // too. The user-facing intent is "treat All sites like a standalone
  // for every page except the surfaces that genuinely roll up across
  // sites" — so most consumers can keep their existing standalone
  // branch and not have to grow an `isAllSites` arm. Surfaces that
  // *do* care about the cross-site case check `isAllSites` explicitly.
  isStandalone: boolean;
  isAllSites: boolean;
};

const ActiveSiteContext = createContext<ActiveSiteContextValue | null>(null);

export function ActiveSiteProvider({ children }: { children: React.ReactNode }) {
  const [activeSiteId, setActiveSiteIdState] = useState<string>(DEFAULT_ACTIVE_SITE_ID);

  // Hydrate from localStorage on mount (client-only — SSR keeps the default
  // so we don't get a hydration mismatch warning).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && ACTIVE_SITES.some(s => s.id === stored)) {
        setActiveSiteIdState(stored);
      }
    } catch {
      // ignore — localStorage unavailable, just stay on default
    }
  }, []);

  const setActiveSiteId = useCallback((id: string) => {
    if (!ACTIVE_SITES.some(s => s.id === id)) return;
    setActiveSiteIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore — localStorage unavailable, the choice just won't persist
    }
  }, []);

  const value = useMemo<ActiveSiteContextValue>(() => {
    const activeSite =
      ACTIVE_SITES.find(s => s.id === activeSiteId) ?? ACTIVE_SITES[0];
    return {
      sites: ACTIVE_SITES,
      activeSiteId,
      activeSite,
      setActiveSiteId,
      isHub: activeSite.type === 'HUB',
      isSpoke: activeSite.type === 'SPOKE',
      isHybrid: activeSite.type === 'HYBRID',
      isStandalone:
        activeSite.type === 'STANDALONE' || activeSite.type === 'ALL',
      isAllSites: activeSite.type === 'ALL',
    };
  }, [activeSiteId, setActiveSiteId]);

  return <ActiveSiteContext.Provider value={value}>{children}</ActiveSiteContext.Provider>;
}

export function useActiveSite(): ActiveSiteContextValue {
  const ctx = useContext(ActiveSiteContext);
  if (!ctx) {
    // Safe defaults so components used outside the provider (e.g. in
    // isolated tests) don't crash. Reads as the default hub persona.
    const fallback = ACTIVE_SITES[0];
    return {
      sites: ACTIVE_SITES,
      activeSiteId: fallback.id,
      activeSite: fallback,
      setActiveSiteId: () => {},
      isHub: fallback.type === 'HUB',
      isSpoke: fallback.type === 'SPOKE',
      isHybrid: fallback.type === 'HYBRID',
      isStandalone:
        fallback.type === 'STANDALONE' || fallback.type === 'ALL',
      isAllSites: fallback.type === 'ALL',
    };
  }
  return ctx;
}

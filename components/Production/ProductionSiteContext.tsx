'use client';

/**
 * ProductionSiteContext — single source of truth for the active site
 * across every page under /production. Lifted out of per-page state so
 * the shared <ProductionSiteSelector /> in the layout drives every
 * sub-page consistently and a switch persists across navigation.
 *
 * Persona-aware:
 *  - Hub persona: free choice between any site in
 *    `PRODUCTION_SITE_OPTIONS`. Selection persisted to localStorage so
 *    a manager's last context survives reloads.
 *  - Spoke persona: locked to `site-spoke-south` (the spoke persona's
 *    home site); the picker is hidden via `canPickSite=false`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { SiteId } from './fixtures';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import {
  PRODUCTION_SITE_OPTIONS,
  type ProductionSiteOption,
} from './productionSiteOptions';

const STORAGE_KEY = 'edify.production.siteId';
const HUB_DEFAULT: SiteId = 'hub-central';
const SPOKE_LOCKED: SiteId = 'site-spoke-south';

type ProductionSiteContextValue = {
  siteId: SiteId;
  setSiteId: (id: SiteId) => void;
  options: ProductionSiteOption[];
  /** Picker UI visible only when the user can actually choose a site. */
  canPickSite: boolean;
};

const Context = createContext<ProductionSiteContextValue | null>(null);

export function ProductionSiteProvider({ children }: { children: React.ReactNode }) {
  const { isSpoke } = useActiveSite();
  const [siteId, setSiteIdState] = useState<SiteId>(HUB_DEFAULT);

  // Hydrate from localStorage on mount (client only — keep SSR default
  // so we don't get a hydration mismatch warning).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && PRODUCTION_SITE_OPTIONS.some(o => o.id === stored)) {
        setSiteIdState(stored as SiteId);
      }
    } catch {
      // ignore — no localStorage
    }
  }, []);

  // Snap to the persona's home site whenever the persona flips. Spokes
  // are locked; hub persona returns to default if it was previously
  // viewing the spoke's site, otherwise keeps whatever was last picked.
  useEffect(() => {
    if (isSpoke) {
      setSiteIdState(SPOKE_LOCKED);
    } else {
      setSiteIdState(prev => (prev === SPOKE_LOCKED ? HUB_DEFAULT : prev));
    }
  }, [isSpoke]);

  const setSiteId = useCallback((id: SiteId) => {
    if (!PRODUCTION_SITE_OPTIONS.some(o => o.id === id)) return;
    setSiteIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore — selection just won't persist
    }
  }, []);

  const value = useMemo<ProductionSiteContextValue>(
    () => ({
      siteId,
      setSiteId,
      options: PRODUCTION_SITE_OPTIONS,
      canPickSite: !isSpoke,
    }),
    [siteId, setSiteId, isSpoke],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useProductionSite(): ProductionSiteContextValue {
  const ctx = useContext(Context);
  if (!ctx) {
    // Safe default for callers used outside of /production (e.g. tests).
    return {
      siteId: HUB_DEFAULT,
      setSiteId: () => {},
      options: PRODUCTION_SITE_OPTIONS,
      canPickSite: true,
    };
  }
  return ctx;
}

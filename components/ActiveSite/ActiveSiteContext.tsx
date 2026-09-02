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

import type { Brand } from '@/components/Production/bkFixtures';
import { BK_SITE_ID } from '@/components/Production/bkFixtures';
import {
  FJ_ALL_SHOPS_ID,
  FJ_DEFAULT_SHOP_ID,
  FJ_SHOPS,
  shopCaption,
} from '@/components/Production/farmerj/shops';
import { isFarmerJDemo } from '@/lib/demoConfig';

export type ActiveSiteType = 'HUB' | 'SPOKE' | 'HYBRID' | 'HYBRID_HUB' | 'STANDALONE' | 'ALL';

export type ActiveSite = {
  id: string;
  name: string;
  type: ActiveSiteType;
  /** Short descriptor shown under the name in the dropdown row. */
  caption: string;
  /**
   * Brand this persona belongs to. Defaults to `'pret'` when omitted. Drives
   * brand-specific shells (e.g. the Burger King crew line display).
   */
  brand?: Brand;
  /**
   * Explicit production-fixture site this persona maps to. Needed when two
   * personas share the same `type` (e.g. Pret Islington and Burger King are
   * both STANDALONE) so the production site can't be derived from type alone.
   */
  productionSiteId?: string;
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
    id: 'fitzroy-gatwick',
    name: 'Fitzroy Gatwick',
    type: 'HYBRID_HUB',
    // Producing hybrid = the union of hybrid + hub. It makes + sells on
    // its own floor, receives a linked range from the central hub, AND
    // bakes for / dispatches to its own two Gatwick spokes. Maps to the
    // `site-hybrid-hub-gatwick` fixture row.
    caption: 'Hybrid hub · Makes, receives + supplies spokes',
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
  {
    id: 'burger-king-stratford',
    name: 'Burger King — Stratford',
    type: 'STANDALONE',
    brand: 'bk',
    // Burger King is a standalone hot-production restaurant: no hub, no
    // dispatch. Plan = how many of each component to drop per 15 min;
    // Make = the crew line display reading the holding cabinet live.
    productionSiteId: BK_SITE_ID,
    caption: 'Burger King · Hot production',
  },
  // Farmer J. Nineteen self-producing shops plus Jana's "All shops" meta
  // persona. Every shop is STANDALONE: scratch kitchen in the basement,
  // main line and second make line upstairs, no hub anywhere. The shop
  // list itself lives in `farmerj/shops.ts` so the production fixtures
  // and the shell read the same 19 rows.
  {
    id: FJ_ALL_SHOPS_ID,
    name: 'All shops',
    type: 'ALL',
    brand: 'farmerj',
    productionSiteId: FJ_ALL_SHOPS_ID,
    caption: 'Farmer J · Every shop at once (Jana)',
  },
  ...FJ_SHOPS.map<ActiveSite>(shop => ({
    id: shop.id,
    name: `Farmer J ${shop.name}`,
    type: 'STANDALONE',
    brand: 'farmerj',
    productionSiteId: shop.id,
    caption: shopCaption(shop),
  })),
];

/** Personas visible for a given brand. Farmer J shops only ever appear
 *  when a Farmer J shop is active (or on the Farmer J demo build); the
 *  Pret + Burger King personas keep sharing one list as before. */
export function sitesForBrand(brand: Brand): ActiveSite[] {
  if (brand === 'farmerj' || isFarmerJDemo) {
    return ACTIVE_SITES.filter(s => s.brand === 'farmerj');
  }
  return ACTIVE_SITES.filter(s => s.brand !== 'farmerj');
}

const DEFAULT_ACTIVE_SITE_ID = isFarmerJDemo ? FJ_DEFAULT_SHOP_ID : 'fitzroy-espresso';

type ActiveSiteContextValue = {
  sites: ActiveSite[];
  activeSiteId: string;
  activeSite: ActiveSite;
  setActiveSiteId: (id: string) => void;
  /** Convenience flags so consumers don't have to compare strings. */
  isHub: boolean;
  isSpoke: boolean;
  isHybrid: boolean;
  /** The producing hybrid (HYBRID_HUB) — makes, receives AND supplies spokes. */
  isProducingHybrid: boolean;
  // NOTE: `isStandalone` is intentionally `true` for the ALL meta-site
  // too. The user-facing intent is "treat All sites like a standalone
  // for every page except the surfaces that genuinely roll up across
  // sites" — so most consumers can keep their existing standalone
  // branch and not have to grow an `isAllSites` arm. Surfaces that
  // *do* care about the cross-site case check `isAllSites` explicitly.
  isStandalone: boolean;
  isAllSites: boolean;
  /** Active brand (defaults to Pret). */
  brand: Brand;
  /** True when the active persona is the Burger King restaurant. */
  isBurgerKing: boolean;
  /** True when the active persona is a Farmer J shop or Jana's All shops. */
  isFarmerJ: boolean;
  /** Explicit production-fixture site id for the persona, when it pins one. */
  productionSiteId?: string;
};

function deriveValue(
  activeSite: ActiveSite,
  activeSiteId: string,
  setActiveSiteId: (id: string) => void,
): ActiveSiteContextValue {
  const brand: Brand = activeSite.brand ?? 'pret';
  return {
    sites: sitesForBrand(brand),
    activeSiteId,
    activeSite,
    setActiveSiteId,
    isHub: activeSite.type === 'HUB',
    isSpoke: activeSite.type === 'SPOKE',
    isHybrid: activeSite.type === 'HYBRID',
    isProducingHybrid: activeSite.type === 'HYBRID_HUB',
    isStandalone: activeSite.type === 'STANDALONE' || activeSite.type === 'ALL',
    isAllSites: activeSite.type === 'ALL',
    brand,
    isBurgerKing: brand === 'bk',
    isFarmerJ: brand === 'farmerj',
    productionSiteId: activeSite.productionSiteId,
  };
}

const ActiveSiteContext = createContext<ActiveSiteContextValue | null>(null);

export function ActiveSiteProvider({ children }: { children: React.ReactNode }) {
  const [activeSiteId, setActiveSiteIdState] = useState<string>(DEFAULT_ACTIVE_SITE_ID);

  // Hydrate from localStorage on mount (client-only — SSR keeps the default
  // so we don't get a hydration mismatch warning).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const match = stored ? ACTIVE_SITES.find(s => s.id === stored) : undefined;
      // The Farmer J demo build never shows another brand's persona, even
      // if one was left in localStorage by an internal session.
      if (match && (!isFarmerJDemo || match.brand === 'farmerj')) {
        setActiveSiteIdState(match.id);
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
      ACTIVE_SITES.find(s => s.id === activeSiteId) ??
      ACTIVE_SITES.find(s => s.id === DEFAULT_ACTIVE_SITE_ID) ??
      ACTIVE_SITES[0];
    return deriveValue(activeSite, activeSiteId, setActiveSiteId);
  }, [activeSiteId, setActiveSiteId]);

  return <ActiveSiteContext.Provider value={value}>{children}</ActiveSiteContext.Provider>;
}

export function useActiveSite(): ActiveSiteContextValue {
  const ctx = useContext(ActiveSiteContext);
  if (!ctx) {
    // Safe defaults so components used outside the provider (e.g. in
    // isolated tests) don't crash. Reads as the default hub persona.
    const fallback =
      ACTIVE_SITES.find(s => s.id === DEFAULT_ACTIVE_SITE_ID) ?? ACTIVE_SITES[0];
    return deriveValue(fallback, fallback.id, () => {});
  }
  return ctx;
}

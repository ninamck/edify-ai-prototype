/**
 * Franchise area — types + seed fixtures for the demo "group view".
 *
 * Models a franchisor (the GROUP) that sits above several franchises of the
 * same Fitzroy Coffee Co. brand — different regional operators (London, the
 * South West, and a single US outpost in New York), each its own "instance"
 * of Edify. Each franchise owns its own stores, but they all draw from one
 * shared group library (recipes / suppliers / products). Production + CPU
 * sharing is roadmap.
 *
 * Pure data only — no React imports — so it can be consumed by the
 * FranchiseContext, the top-bar switcher, and the /franchise overview.
 *
 * Demo-only: metrics are static illustrative values, not real aggregates.
 */

import { ALL_LIBRARY_RECIPES } from '@/components/Recipe/libraryFixtures';
import { SEED_SUPPLIERS, SEED_MASTER_PRODUCTS } from '@/components/Suppliers/fixtures';

export type FranchiseStore = {
  id: string;
  name: string;
  location: string;
  /**
   * When set, selecting this single store drops the franchise admin into
   * that store's normal view by driving `ActiveSiteContext`. Only the
   * Fitzroy brand maps to the real persona sites today; the other brands
   * are visual-only fixtures for the demo.
   */
  activeSiteId?: string;
  needsAttention?: boolean;
};

export type FranchiseMetrics = {
  /** Pre-formatted, brand-local currency string (e.g. "$6.4k"). */
  salesToday: string;
  storesNeedingAttention: number;
};

export type Franchise = {
  id: string;
  /** Each franchise is a regional operator of the shared Fitzroy brand. */
  name: string;
  /** Short avatar label (region code) so same-brand cards stay distinct. */
  code?: string;
  tagline: string;
  /** Brand colour used for the avatar / accents on the overview + switcher. */
  brandColor: string;
  category: string;
  stores: FranchiseStore[];
  metrics: FranchiseMetrics;
  /** Whether this franchise draws from the shared group library. */
  sharesLibrary: boolean;
};

export type FranchiseGroup = {
  id: string;
  name: string;
  franchises: Franchise[];
};

export const FRANCHISES: Franchise[] = [
  {
    id: 'fitzroy-london',
    name: 'Fitzroy Coffee Co. — London',
    code: 'LDN',
    tagline: 'Flagship London franchise',
    brandColor: '#2F5D50',
    category: 'Coffee & bakery',
    sharesLibrary: true,
    metrics: { salesToday: '$6.4k', storesNeedingAttention: 1 },
    stores: [
      {
        id: 'fitzroy-espresso',
        name: 'Fitzroy Espresso',
        location: 'London Central · Hub kitchen',
        activeSiteId: 'fitzroy-espresso',
      },
      {
        id: 'fitzroy-kings-cross',
        name: "Fitzroy King's Cross",
        location: "London · King's Cross",
        activeSiteId: 'fitzroy-kings-cross',
      },
      {
        id: 'fitzroy-heathrow',
        name: 'Fitzroy Heathrow',
        location: 'Heathrow T5 · Airport',
        activeSiteId: 'fitzroy-heathrow',
        needsAttention: true,
      },
      {
        id: 'fitzroy-gatwick',
        name: 'Fitzroy Gatwick',
        location: 'Gatwick · Airport',
        activeSiteId: 'fitzroy-gatwick',
      },
      {
        id: 'fitzroy-islington',
        name: 'Fitzroy Islington',
        location: 'London · Islington',
        activeSiteId: 'fitzroy-islington',
      },
    ],
  },
  {
    id: 'fitzroy-south-west',
    name: 'Fitzroy Coffee Co. — South West',
    code: 'SW',
    tagline: 'South West England franchise',
    brandColor: '#3E7C68',
    category: 'Coffee & bakery',
    sharesLibrary: true,
    metrics: { salesToday: '$3.8k', storesNeedingAttention: 1 },
    stores: [
      { id: 'fitzroy-bristol', name: 'Fitzroy Bristol', location: 'Bristol · Clifton' },
      { id: 'fitzroy-bath', name: 'Fitzroy Bath', location: 'Bath · City centre', needsAttention: true },
      { id: 'fitzroy-cardiff', name: 'Fitzroy Cardiff', location: 'Cardiff · The Hayes' },
      { id: 'fitzroy-exeter', name: 'Fitzroy Exeter', location: 'Exeter · High Street' },
    ],
  },
  {
    id: 'fitzroy-us',
    name: 'Fitzroy Coffee Co. — New York',
    code: 'NYC',
    tagline: 'US franchise · first overseas store',
    brandColor: '#225B7A',
    category: 'Coffee & bakery',
    sharesLibrary: true,
    metrics: { salesToday: '$11.6k', storesNeedingAttention: 1 },
    stores: [
      { id: 'fitzroy-new-york', name: 'Fitzroy SoHo', location: 'New York · SoHo, Manhattan' },
      { id: 'fitzroy-ny-midtown', name: 'Fitzroy Midtown', location: 'New York · Midtown, Manhattan' },
      { id: 'fitzroy-ny-williamsburg', name: 'Fitzroy Williamsburg', location: 'New York · Williamsburg, Brooklyn', needsAttention: true },
      { id: 'fitzroy-ny-upper-west', name: 'Fitzroy Upper West Side', location: 'New York · Upper West Side, Manhattan' },
      { id: 'fitzroy-ny-jfk', name: 'Fitzroy JFK', location: 'New York · JFK Airport, Terminal 4' },
    ],
  },
];

export const FRANCHISE_GROUP: FranchiseGroup = {
  id: 'fitzroy-group',
  name: 'Fitzroy Group',
  franchises: FRANCHISES,
};

/** Total store count across every franchise in the group. */
export const TOTAL_STORE_COUNT: number = FRANCHISES.reduce(
  (n, f) => n + f.stores.length,
  0,
);

export type SharedLibraryCounts = {
  recipes: number;
  suppliers: number;
  products: number;
};

/**
 * Counts for the "Shared across the group" tiles, drawn from the same
 * fixtures the rest of the app renders so the numbers line up with the
 * recipes / suppliers screens the demo links into.
 */
export const SHARED_LIBRARY_COUNTS: SharedLibraryCounts = {
  recipes: ALL_LIBRARY_RECIPES.length,
  suppliers: SEED_SUPPLIERS.length,
  products: SEED_MASTER_PRODUCTS.length,
};

export function getFranchise(id: string): Franchise | undefined {
  return FRANCHISES.find((f) => f.id === id);
}

export function getFranchiseStore(
  storeId: string,
): { franchise: Franchise; store: FranchiseStore } | undefined {
  for (const franchise of FRANCHISES) {
    const store = franchise.stores.find((s) => s.id === storeId);
    if (store) return { franchise, store };
  }
  return undefined;
}

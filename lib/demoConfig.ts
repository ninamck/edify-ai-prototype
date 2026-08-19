/**
 * demoConfig — per-customer branding for gated external demos.
 *
 * A single build serves every customer; which brand it wears is chosen at
 * build/deploy time via `NEXT_PUBLIC_DEMO_CUSTOMER`. Unset (or "edify")
 * means the normal internal prototype — no branding overrides, no gate,
 * demo controls visible. Any other id switches the prototype into a
 * customer-facing "demo build": branded, and (when a passcode is set) gated.
 *
 * On the internal build the brand can additionally be switched at runtime
 * from the demo-controls panel: the choice persists in localStorage and the
 * page reloads so module-scope fixture data (which reads the brand at import
 * time) re-evaluates. Customer deployments ignore the override — the env var
 * always wins there, so a gated build can never be flipped to another brand.
 *
 * This module is deliberately client-safe: it reads only NEXT_PUBLIC_*
 * values (plus localStorage, guarded) so it can be imported from client
 * components and from middleware. Secrets (the gate passcode) live in
 * `lib/demoGate.ts`, never here.
 */

export type DemoCustomer = {
  /** Stable id, also sent to analytics as the `customer` super-property. */
  id: string;
  /** Brand name shown in the gate and demo surfaces. */
  name: string;
  /** One-line descriptor shown under the name on the gate screen. */
  tagline: string;
  /** Primary accent (hex) driving the headline forecast demo. */
  accent: string;
  /** Site/context label under the forecast demo header. */
  demoSiteLabel: string;
  /**
   * Per-brand feature switches. Demo-only capabilities are opted into per
   * customer so other builds render byte-for-byte unchanged.
   */
  features?: {
    /** Per-supplier currency + dual-display purchasing journey (Second Cup). */
    multiCurrency?: boolean;
  };
};

const CUSTOMERS: Record<string, DemoCustomer> = {
  edify: {
    id: 'edify',
    name: 'Edify',
    tagline: 'Hospitality operations platform',
    accent: '#2f6df6',
    demoSiteLabel: 'Burger King · Stratford — lunch service, replayed',
  },
  chagee: {
    id: 'chagee',
    name: 'CHAGEE',
    tagline: 'Modern tea, made to order',
    // Placeholder brand red — swap for the exact CHAGEE hex once confirmed.
    accent: '#A4123F',
    demoSiteLabel: 'CHAGEE · flagship — afternoon service, replayed',
  },
  normas: {
    id: 'normas',
    name: "Norma's Cafe",
    tagline: 'Texas comfort food since 1956',
    // Diner red taken from normascafe.com; swap if they share exact brand hex.
    accent: '#C8102E',
    demoSiteLabel: "Norma's Cafe · Oak Cliff — breakfast service, replayed",
  },
  secondcup: {
    id: 'secondcup',
    name: 'Second Cup',
    tagline: 'Canadian coffee, served worldwide',
    // Placeholder Second Cup red — swap for the exact brand hex once confirmed.
    accent: '#C8102E',
    demoSiteLabel: 'Second Cup · international franchise — morning service, replayed',
    features: { multiCurrency: true },
  },
};

/** Brand baked in at build/deploy time. */
const ENV_CUSTOMER_ID = process.env.NEXT_PUBLIC_DEMO_CUSTOMER ?? 'edify';

/**
 * The runtime brand override is only honoured on the internal build — a
 * customer-facing deployment must never be switchable to another brand.
 */
export const isBrandSwitchable = ENV_CUSTOMER_ID === 'edify';

const BRAND_STORAGE_KEY = 'edify.demoBrand';

function readBrandOverride(): string | null {
  if (!isBrandSwitchable || typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(BRAND_STORAGE_KEY);
    return stored && CUSTOMERS[stored] ? stored : null;
  } catch {
    return null; // localStorage unavailable — stay on the env brand
  }
}

export const DEMO_CUSTOMER_ID = readBrandOverride() ?? ENV_CUSTOMER_ID;

export const demoCustomer: DemoCustomer =
  CUSTOMERS[DEMO_CUSTOMER_ID] ?? CUSTOMERS.edify;

/** All brands, for the demo-controls brand selector. */
export const DEMO_CUSTOMERS: DemoCustomer[] = Object.values(CUSTOMERS);

/**
 * Persist a runtime brand choice and reload. A full reload (not a router
 * navigation) is required: fixture modules read the brand at import time,
 * so the whole client bundle must re-initialise.
 */
export function setDemoBrand(id: string) {
  if (!isBrandSwitchable || typeof window === 'undefined' || !CUSTOMERS[id]) return;
  try {
    if (id === ENV_CUSTOMER_ID) window.localStorage.removeItem(BRAND_STORAGE_KEY);
    else window.localStorage.setItem(BRAND_STORAGE_KEY, id);
  } catch {
    return; // can't persist — reloading would just lose the choice
  }
  window.location.reload();
}

/** True when this build wears a customer brand (i.e. not the internal one). */
export const isDemoBuild = demoCustomer.id !== 'edify';

/**
 * True when this build demos the multi-currency purchasing journey
 * (per-supplier currency, dual display, FX attribution). Second Cup only.
 */
export const isMultiCurrencyDemo = demoCustomer.features?.multiCurrency === true;

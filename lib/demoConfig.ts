/**
 * demoConfig — per-customer branding for gated external demos.
 *
 * A single build serves every customer; which brand it wears is chosen at
 * build/deploy time via `NEXT_PUBLIC_DEMO_CUSTOMER`. Unset (or "edify")
 * means the normal internal prototype — no branding overrides, no gate,
 * demo controls visible. Any other id switches the prototype into a
 * customer-facing "demo build": branded, and (when a passcode is set) gated.
 *
 * This module is deliberately client-safe: it reads only NEXT_PUBLIC_*
 * values so it can be imported from client components and from middleware.
 * Secrets (the gate passcode) live in `lib/demoGate.ts`, never here.
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
};

export const DEMO_CUSTOMER_ID = process.env.NEXT_PUBLIC_DEMO_CUSTOMER ?? 'edify';

export const demoCustomer: DemoCustomer =
  CUSTOMERS[DEMO_CUSTOMER_ID] ?? CUSTOMERS.edify;

/** True when this build wears a customer brand (i.e. not the internal one). */
export const isDemoBuild = demoCustomer.id !== 'edify';

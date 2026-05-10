/**
 * Persona-themed labels for the production site selector.
 *
 * The fixture site graph (PRET_SITES) keeps its original Pret-style names
 * (London Central Hub, Clapham Junction, …) because lots of seeded data
 * references those rows. The demo, however, presents everything under
 * the "Fitzroy" persona naming — so the user-facing site picker maps
 * fixture site IDs to friendlier persona labels.
 *
 * Keeping the mapping in one place means every production sub-page reads
 * the same list of options and renders the same buttons.
 */

import type { SiteId } from './fixtures';

export type ProductionSiteOption = {
  /** Underlying fixture site id — what state/data layers actually use. */
  id: SiteId;
  /** Persona-friendly label shown on the picker button. */
  label: string;
  /** Right-side chip on the button (HUB / SPOKE / YOUR SITE). */
  tag: 'YOUR SITE' | 'HUB' | 'SPOKE';
};

export const PRODUCTION_SITE_OPTIONS: ProductionSiteOption[] = [
  { id: 'hub-central',           label: 'Fitzroy Espresso',     tag: 'YOUR SITE' },
  { id: 'site-spoke-south',      label: "Fitzroy King's Cross", tag: 'SPOKE' },
  { id: 'site-spoke-east',       label: 'Fitzroy Shoreditch',   tag: 'SPOKE' },
  { id: 'site-spoke-west',       label: 'Fitzroy Notting Hill', tag: 'SPOKE' },
  { id: 'site-hybrid-airport',   label: 'Fitzroy Heathrow',     tag: 'SPOKE' },
  { id: 'site-standalone-north', label: 'Fitzroy Islington',    tag: 'SPOKE' },
];

/**
 * Look up the persona-friendly display label for a fixture site id.
 * Falls back to the raw id when the site isn't in the picker (i.e.
 * a future fixture row that hasn't been mapped yet).
 */
export function productionSiteLabel(siteId: SiteId): string {
  return PRODUCTION_SITE_OPTIONS.find(o => o.id === siteId)?.label ?? siteId;
}

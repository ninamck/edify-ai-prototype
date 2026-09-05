/**
 * Source adapters: what Edify knows about a site for the rota skill.
 *
 * Forecast shape comes from data the prototype already holds (see
 * `shape.ts`). The per-site files under `siteData/` add what the rota
 * skill needs and the codebase did not hold before: labour standards,
 * fixed tasks, stations, last week's outcomes. Nothing here invents a
 * site: every id already exists in `ACTIVE_SITES` (or, for Chagee, in
 * the branch's fixture bundle).
 */

import type { SiteLabourData } from './types';
import { FITZROY_KINGS_CROSS_LABOUR } from './siteData/fitzroy-kings-cross';
import { CHAGEE_FLAGSHIP_LABOUR } from './siteData/chagee-flagship';

const SITE_LABOUR: Record<string, () => SiteLabourData> = {
  'fitzroy-kings-cross': FITZROY_KINGS_CROSS_LABOUR,
  'chagee-flagship': CHAGEE_FLAGSHIP_LABOUR,
};

export function siteLabourFor(siteId: string): SiteLabourData | undefined {
  return SITE_LABOUR[siteId]?.();
}

export function sitesWithLabourData(): string[] {
  return Object.keys(SITE_LABOUR);
}

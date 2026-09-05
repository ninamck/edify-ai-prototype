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
import { labourGuide } from './engine';
import { FITZROY_KINGS_CROSS_LABOUR } from './siteData/fitzroy-kings-cross';
import { CHAGEE_FLAGSHIP_LABOUR } from './siteData/chagee-flagship';
import { ESTATE_SUMMARY_ROWS, rowFromLastWeek, type EstateLabourRow } from './siteData/estate';

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

/** Last week across the estate for the given site ids, most under
 *  guide first. Sites with a full labour view are rolled up from their
 *  day parts; the rest come from the weekly summaries; anything else is
 *  left out so the page can say "No data" for it. */
export function estateLabourRows(siteIds: string[]): EstateLabourRow[] {
  const rows: EstateLabourRow[] = [];
  for (const id of siteIds) {
    const full = siteLabourFor(id);
    if (full) {
      const guide = labourGuide(full, []).reduce((s, r) => s + r.guideHours, 0);
      rows.push(rowFromLastWeek(id, full.lastWeek, guide));
      continue;
    }
    const summary = ESTATE_SUMMARY_ROWS.find((r) => r.siteId === id);
    if (summary) rows.push(summary);
  }
  return rows.sort((a, b) => a.hoursVsGuide - b.hoursVsGuide);
}

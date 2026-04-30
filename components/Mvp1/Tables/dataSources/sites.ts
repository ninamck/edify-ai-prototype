// Shared sites used by the in-memory mock sources (sales, waste, labour).
// flashReport.csv has its own opaque numeric `location` codes and is kept
// separate; cross-source joins between flashReport and these sources are not
// supported because the keys don't line up.

export type SiteMeta = {
  site_id: string;
  site_name: string;
  region: string;
};

export const SITES: SiteMeta[] = [
  { site_id: 'fitzroy', site_name: 'Fitzroy Espresso', region: 'Inner North' },
  { site_id: 'carlton', site_name: 'Carlton Roastery', region: 'Inner North' },
  { site_id: 'brunswick', site_name: 'Brunswick Brew', region: 'Inner North' },
  { site_id: 'northcote', site_name: 'Northcote Beans', region: 'North' },
  { site_id: 'richmond', site_name: 'Richmond Coffee Co', region: 'Inner East' },
];

// 14-day window ending today-ish — kept static so demos are reproducible.
export const SAMPLE_DATES: string[] = (() => {
  const out: string[] = [];
  // Anchor in a fixed window so the prototype renders consistently.
  const anchor = new Date('2026-04-28T00:00:00Z');
  for (let i = 13; i >= 0; i--) {
    const d = new Date(anchor.getTime() - i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
})();

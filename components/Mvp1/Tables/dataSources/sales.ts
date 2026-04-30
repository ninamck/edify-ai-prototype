import type { Column, DataSource } from './types';
import { SITES, SAMPLE_DATES } from './sites';

export type SalesRow = {
  site_id: string;
  site_name: string;
  region: string;
  date: string;
  revenue: number;
  covers: number;
  avg_ticket: number;
  breakfast_revenue: number;
  lunch_revenue: number;
  dinner_revenue: number;
};

export const SALES_COLUMNS: Column[] = [
  { key: 'site_id', header: 'Site ID', type: 'string', width: 110 },
  { key: 'site_name', header: 'Site', type: 'string', defaultVisible: true, width: 200 },
  { key: 'region', header: 'Region', type: 'string', defaultVisible: true, width: 130 },
  { key: 'date', header: 'Date', type: 'date', defaultVisible: true, width: 120 },
  { key: 'revenue', header: 'Revenue', type: 'currency', defaultVisible: true, width: 130 },
  { key: 'covers', header: 'Covers', type: 'integer', defaultVisible: true, width: 100 },
  { key: 'avg_ticket', header: 'Avg ticket', type: 'currency', defaultVisible: true, width: 120 },
  { key: 'breakfast_revenue', header: 'Breakfast', type: 'currency', width: 120 },
  { key: 'lunch_revenue', header: 'Lunch', type: 'currency', width: 120 },
  { key: 'dinner_revenue', header: 'Dinner', type: 'currency', width: 120 },
];

const SITE_PROFILES: Record<string, { base: number; weekendBoost: number; covers: number }> = {
  fitzroy: { base: 4200, weekendBoost: 1.35, covers: 220 },
  carlton: { base: 3650, weekendBoost: 1.2, covers: 190 },
  brunswick: { base: 3100, weekendBoost: 1.15, covers: 175 },
  northcote: { base: 2750, weekendBoost: 1.1, covers: 160 },
  richmond: { base: 5100, weekendBoost: 1.5, covers: 280 },
};

function seededWobble(siteId: string, date: string): number {
  // Deterministic pseudo-random in [0.85, 1.15] from string seed.
  let h = 2166136261;
  const seed = siteId + '|' + date;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = ((h >>> 0) % 1000) / 1000;
  return 0.85 + n * 0.3;
}

let cache: Promise<SalesRow[]> | null = null;

export function loadSales(): Promise<SalesRow[]> {
  if (cache) return cache;
  cache = Promise.resolve(
    SITES.flatMap((site) => {
      const profile = SITE_PROFILES[site.site_id];
      return SAMPLE_DATES.map((date) => {
        const day = new Date(date + 'T00:00:00Z').getUTCDay();
        const isWeekend = day === 0 || day === 6;
        const wobble = seededWobble(site.site_id, date);
        const revenue = Math.round(profile.base * (isWeekend ? profile.weekendBoost : 1) * wobble);
        const covers = Math.round(profile.covers * (isWeekend ? 1.25 : 1) * wobble);
        const avg = +(revenue / Math.max(1, covers)).toFixed(2);
        const breakfast = Math.round(revenue * 0.35);
        const lunch = Math.round(revenue * 0.4);
        const dinner = revenue - breakfast - lunch;
        return {
          site_id: site.site_id,
          site_name: site.site_name,
          region: site.region,
          date,
          revenue,
          covers,
          avg_ticket: avg,
          breakfast_revenue: breakfast,
          lunch_revenue: lunch,
          dinner_revenue: dinner,
        };
      });
    }),
  );
  return cache;
}

export const salesSource: DataSource<SalesRow> = {
  id: 'sales',
  label: 'Sales',
  description: 'Daily sales by site, with daypart breakdowns.',
  load: loadSales,
  columns: SALES_COLUMNS,
  joinKey: { site: 'site_id', date: 'date' },
};

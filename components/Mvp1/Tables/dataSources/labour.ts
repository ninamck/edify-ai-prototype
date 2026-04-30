import type { Column, DataSource } from './types';
import { SITES, SAMPLE_DATES } from './sites';

export type LabourRow = {
  site_id: string;
  site_name: string;
  date: string;
  hours: number;
  cost: number;
  shifts: number;
  manager_hours: number;
  barista_hours: number;
  kitchen_hours: number;
};

export const LABOUR_COLUMNS: Column[] = [
  { key: 'site_id', header: 'Site ID', type: 'string', width: 110 },
  { key: 'site_name', header: 'Site', type: 'string', defaultVisible: true, width: 200 },
  { key: 'date', header: 'Date', type: 'date', defaultVisible: true, width: 120 },
  { key: 'hours', header: 'Total hours', type: 'number', defaultVisible: true, width: 120 },
  { key: 'cost', header: 'Labour $', type: 'currency', defaultVisible: true, width: 120 },
  { key: 'shifts', header: 'Shifts', type: 'integer', defaultVisible: true, width: 90 },
  { key: 'manager_hours', header: 'Manager hrs', type: 'number', width: 130 },
  { key: 'barista_hours', header: 'Barista hrs', type: 'number', width: 130 },
  { key: 'kitchen_hours', header: 'Kitchen hrs', type: 'number', width: 130 },
];

const SITE_PROFILES: Record<string, { hours: number; rate: number }> = {
  fitzroy: { hours: 78, rate: 28 },
  carlton: { hours: 70, rate: 27 },
  brunswick: { hours: 62, rate: 26 },
  northcote: { hours: 55, rate: 26 },
  richmond: { hours: 92, rate: 29 },
};

function seededWobble(siteId: string, date: string): number {
  let h = 2166136261;
  const seed = siteId + '|' + date;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = ((h >>> 0) % 1000) / 1000;
  return 0.9 + n * 0.2;
}

let cache: Promise<LabourRow[]> | null = null;

export function loadLabour(): Promise<LabourRow[]> {
  if (cache) return cache;
  cache = Promise.resolve(
    SITES.flatMap((site) => {
      const profile = SITE_PROFILES[site.site_id];
      return SAMPLE_DATES.map((date) => {
        const day = new Date(date + 'T00:00:00Z').getUTCDay();
        const isWeekend = day === 0 || day === 6;
        const wobble = seededWobble(site.site_id, date);
        const hours = +(profile.hours * (isWeekend ? 1.2 : 1) * wobble).toFixed(1);
        const cost = +(hours * profile.rate).toFixed(2);
        const shifts = Math.max(3, Math.round(hours / 6));
        const manager = +(hours * 0.18).toFixed(1);
        const barista = +(hours * 0.5).toFixed(1);
        const kitchen = +(hours - manager - barista).toFixed(1);
        return {
          site_id: site.site_id,
          site_name: site.site_name,
          date,
          hours,
          cost,
          shifts,
          manager_hours: manager,
          barista_hours: barista,
          kitchen_hours: kitchen,
        };
      });
    }),
  );
  return cache;
}

export const labourSource: DataSource<LabourRow> = {
  id: 'labour',
  label: 'Labour',
  description: 'Daily labour hours and cost by site, with role breakdown.',
  load: loadLabour,
  columns: LABOUR_COLUMNS,
  joinKey: { site: 'site_id', date: 'date' },
};

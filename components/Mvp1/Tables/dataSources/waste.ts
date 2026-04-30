import type { Column, DataSource } from './types';
import { SITES, SAMPLE_DATES } from './sites';

export type WasteRow = {
  site_id: string;
  site_name: string;
  date: string;
  sku: string;
  category: string;
  qty: number;
  unit_cost: number;
  cost: number;
  reason: string;
};

export const WASTE_COLUMNS: Column[] = [
  { key: 'site_id', header: 'Site ID', type: 'string', width: 110 },
  { key: 'site_name', header: 'Site', type: 'string', defaultVisible: true, width: 200 },
  { key: 'date', header: 'Date', type: 'date', defaultVisible: true, width: 120 },
  { key: 'sku', header: 'SKU', type: 'string', defaultVisible: true, width: 200 },
  { key: 'category', header: 'Category', type: 'string', defaultVisible: true, width: 140 },
  { key: 'qty', header: 'Qty', type: 'number', defaultVisible: true, width: 90 },
  { key: 'unit_cost', header: 'Unit cost', type: 'currency', width: 120 },
  { key: 'cost', header: 'Cost', type: 'currency', defaultVisible: true, width: 110 },
  { key: 'reason', header: 'Reason', type: 'string', defaultVisible: true, width: 160 },
];

type SkuDef = { sku: string; category: string; unit_cost: number };

const SKUS: SkuDef[] = [
  { sku: 'Croissant — plain', category: 'Bakery', unit_cost: 1.4 },
  { sku: 'Croissant — almond', category: 'Bakery', unit_cost: 1.85 },
  { sku: 'Banana bread slice', category: 'Bakery', unit_cost: 1.1 },
  { sku: 'Sourdough loaf', category: 'Bakery', unit_cost: 3.2 },
  { sku: 'Whole milk 2L', category: 'Dairy', unit_cost: 2.4 },
  { sku: 'Oat milk 1L', category: 'Dairy', unit_cost: 3.1 },
  { sku: 'Avocado', category: 'Produce', unit_cost: 1.2 },
  { sku: 'Tomato', category: 'Produce', unit_cost: 0.6 },
  { sku: 'Smoked salmon 200g', category: 'Protein', unit_cost: 6.8 },
  { sku: 'Free-range egg', category: 'Protein', unit_cost: 0.5 },
];

const REASONS = ['Expired', 'Spoiled', 'Dropped', 'Over-prepped', 'Customer return', 'Spilled'];

function seedNum(parts: string, mod: number): number {
  let h = 2166136261;
  for (let i = 0; i < parts.length; i++) {
    h ^= parts.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % mod;
}

let cache: Promise<WasteRow[]> | null = null;

export function loadWaste(): Promise<WasteRow[]> {
  if (cache) return cache;
  const rows: WasteRow[] = [];
  for (const site of SITES) {
    for (const date of SAMPLE_DATES) {
      // 1-3 waste events per site per day, picked deterministically.
      const eventCount = 1 + (seedNum(site.site_id + date, 3));
      for (let i = 0; i < eventCount; i++) {
        const sku = SKUS[seedNum(site.site_id + date + i + 'sku', SKUS.length)];
        const reason = REASONS[seedNum(site.site_id + date + i + 'r', REASONS.length)];
        const qty = 1 + seedNum(site.site_id + date + i + 'q', 6);
        const cost = +(qty * sku.unit_cost).toFixed(2);
        rows.push({
          site_id: site.site_id,
          site_name: site.site_name,
          date,
          sku: sku.sku,
          category: sku.category,
          qty,
          unit_cost: sku.unit_cost,
          cost,
          reason,
        });
      }
    }
  }
  cache = Promise.resolve(rows);
  return cache;
}

export const wasteSource: DataSource<WasteRow> = {
  id: 'waste',
  label: 'Waste log',
  description: 'Per-event waste records with SKU, quantity, cost and reason.',
  load: loadWaste,
  columns: WASTE_COLUMNS,
  joinKey: { site: 'site_id', date: 'date' },
};

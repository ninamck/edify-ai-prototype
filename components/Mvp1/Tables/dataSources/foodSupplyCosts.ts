import { parseCsv } from '@/lib/csv';
import type { Column, DataSource } from './types';
import { toNumber } from './types';

export type FoodSupplyCostRow = {
  location: string;
  name: string;
  dm: string;
  cost_date: string;
  dcp_food: number | null;
  dcp_paper: number | null;
  dcp_supplies: number | null;
  br_supplies: number | null;
  sales_tax_dcp: number | null;
  for_the_week_end: number | null;
  production: number | null;
  total_food_cost: number | null;
  total_paper_cost: number | null;
  flash_food_total: number | null;
};

export const FOOD_SUPPLY_COST_COLUMNS: Column[] = [
  { key: 'location', header: 'Location', type: 'string', width: 90 },
  { key: 'name', header: 'Store', type: 'string', defaultVisible: true, width: 220 },
  { key: 'dm', header: 'DM', type: 'string', defaultVisible: true, width: 160 },
  { key: 'cost_date', header: 'Date', type: 'date', defaultVisible: true, width: 120 },
  { key: 'dcp_food', header: 'DCP food', type: 'currency', defaultVisible: true, width: 120 },
  { key: 'dcp_paper', header: 'DCP paper', type: 'currency', defaultVisible: true, width: 120 },
  { key: 'dcp_supplies', header: 'DCP supplies', type: 'currency', width: 130 },
  { key: 'br_supplies', header: 'BR supplies', type: 'currency', width: 130 },
  { key: 'sales_tax_dcp', header: 'DCP sales tax', type: 'currency', width: 130 },
  { key: 'for_the_week_end', header: 'Week-end total', type: 'currency', width: 140 },
  { key: 'production', header: 'Production', type: 'currency', defaultVisible: true, width: 130 },
  { key: 'total_food_cost', header: 'Total food', type: 'currency', defaultVisible: true, width: 130 },
  { key: 'total_paper_cost', header: 'Total paper', type: 'currency', width: 130 },
  { key: 'flash_food_total', header: 'Flash food total', type: 'currency', defaultVisible: true, width: 150 },
];

function coerce(raw: Record<string, string>): FoodSupplyCostRow {
  return {
    location: raw.location ?? '',
    name: raw.name ?? '',
    dm: raw.dm ?? '',
    cost_date: raw.cost_date ?? '',
    dcp_food: toNumber(raw.dcp_food),
    dcp_paper: toNumber(raw.dcp_paper),
    dcp_supplies: toNumber(raw.dcp_supplies),
    br_supplies: toNumber(raw.br_supplies),
    sales_tax_dcp: toNumber(raw.sales_tax_dcp),
    for_the_week_end: toNumber(raw.for_the_week_end),
    production: toNumber(raw.production),
    total_food_cost: toNumber(raw.total_food_cost),
    total_paper_cost: toNumber(raw.total_paper_cost),
    flash_food_total: toNumber(raw.flash_food_total),
  };
}

let cache: Promise<FoodSupplyCostRow[]> | null = null;

export function loadFoodSupplyCosts(): Promise<FoodSupplyCostRow[]> {
  if (!cache) {
    cache = fetch('/data/rpt_daily_food_supply_costs_by_site.csv')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load rpt_daily_food_supply_costs_by_site.csv: ${res.status}`);
        }
        return res.text();
      })
      .then((text) => parseCsv(text).map(coerce))
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

export const foodSupplyCostsSource: DataSource<FoodSupplyCostRow> = {
  id: 'foodSupplyCosts',
  label: 'Weekly Food & Supply Cost',
  description: 'Daily DCP food, paper and supply costs per store, plus production and flash totals.',
  load: loadFoodSupplyCosts,
  columns: FOOD_SUPPLY_COST_COLUMNS,
  joinKey: { site: 'location', date: 'cost_date' },
};

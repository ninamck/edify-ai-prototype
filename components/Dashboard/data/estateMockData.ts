export const ACCENT = 'var(--color-accent-deep)';
export const ACCENT_MID = 'var(--color-accent-mid)';
export const WARN = '#B45309';
export const OK = '#166534';

export const tipStyle = {
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
} as const;

export type SalesTrendPoint = { d: string; date: string; sales: number };

export const SALES_TREND: SalesTrendPoint[] = [
  { d: '17 Mar', date: '2026-03-17', sales: 44.2 },
  { d: '18 Mar', date: '2026-03-18', sales: 46.8 },
  { d: '19 Mar', date: '2026-03-19', sales: 45.1 },
  { d: '20 Mar', date: '2026-03-20', sales: 48.9 },
  { d: '21 Mar', date: '2026-03-21', sales: 52.4 },
  { d: '22 Mar', date: '2026-03-22', sales: 49.6 },
  { d: '23 Mar', date: '2026-03-23', sales: 47.3 },
  { d: '24 Mar', date: '2026-03-24', sales: 45.9 },
  { d: '25 Mar', date: '2026-03-25', sales: 48.2 },
  { d: '26 Mar', date: '2026-03-26', sales: 50.1 },
  { d: '27 Mar', date: '2026-03-27', sales: 53.8 },
  { d: '28 Mar', date: '2026-03-28', sales: 55.2 },
  { d: '29 Mar', date: '2026-03-29', sales: 51.0 },
  { d: '30 Mar', date: '2026-03-30', sales: 49.4 },
  { d: '31 Mar', date: '2026-03-31', sales: 50.6 },
  { d: '1 Apr', date: '2026-04-01', sales: 51.9 },
  { d: '2 Apr', date: '2026-04-02', sales: 53.1 },
  { d: '3 Apr', date: '2026-04-03', sales: 52.2 },
  { d: '4 Apr', date: '2026-04-04', sales: 50.4 },
  { d: '5 Apr', date: '2026-04-05', sales: 48.7 },
  { d: '6 Apr', date: '2026-04-06', sales: 49.9 },
  { d: '7 Apr', date: '2026-04-07', sales: 54.5 },
  { d: '8 Apr', date: '2026-04-08', sales: 55.7 },
  { d: '9 Apr', date: '2026-04-09', sales: 53.2 },
  { d: '10 Apr', date: '2026-04-10', sales: 56.0 },
  { d: '11 Apr', date: '2026-04-11', sales: 54.1 },
  { d: '12 Apr', date: '2026-04-12', sales: 52.8 },
  { d: '13 Apr', date: '2026-04-13', sales: 51.6 },
  { d: '14 Apr', date: '2026-04-14', sales: 53.4 },
];

export type SiteGpPoint = { site: string; gp: number };

export const SITE_GP: SiteGpPoint[] = [
  { site: 'Fitzroy', gp: 69.4 },
  { site: 'City Centre', gp: 66.1 },
  { site: 'Riverside', gp: 70.2 },
  { site: 'Canary', gp: 67.8 },
  { site: 'Shoreditch', gp: 65.3 },
  { site: 'Kings X', gp: 68.9 },
];

export type WastagePoint = { cat: string; k: number };

export const WASTAGE: WastagePoint[] = [
  { cat: 'Dairy & milk', k: 0.42 },
  { cat: 'Bakery', k: 0.31 },
  { cat: 'Produce', k: 0.28 },
  { cat: 'Coffee & dry', k: 0.19 },
  { cat: 'Packaging', k: 0.11 },
];

export type CogsVariancePoint = { line: string; var: number };

export const COGS_VAR: CogsVariancePoint[] = [
  { line: 'Coffee', var: 0.9 },
  { line: 'Dry goods', var: 2.4 },
  { line: 'Dairy', var: -0.3 },
  { line: 'Bakery', var: 1.8 },
  { line: 'Produce', var: 3.1 },
];

export type LabourPoint = { site: string; actual: number; plan: number };

export const LABOUR_VS_SALES: LabourPoint[] = [
  { site: 'Fitzroy', actual: 27.2, plan: 26.8 },
  { site: 'City Ctr', actual: 29.4, plan: 27.5 },
  { site: 'Riverside', actual: 26.1, plan: 26.0 },
  { site: 'Canary', actual: 28.0, plan: 27.2 },
  { site: 'Shoreditch', actual: 30.2, plan: 28.1 },
  { site: 'Kings X', actual: 27.8, plan: 27.4 },
];

export type Kpi = {
  label: string;
  value: string;
  delta: string;
  deltaLabel: string;
  positive: boolean;
};

export const KPI: Kpi[] = [
  { label: 'Net sales (7d)',     value: '£342.8k', delta: '+4.1%',        deltaLabel: 'vs prior week',     positive: true },
  { label: 'Gross profit',       value: '68.2%',   delta: '−0.4pp',       deltaLabel: 'vs target 68.6%',   positive: false },
  { label: 'COGS vs theoretical',value: '+1.2%',   delta: 'unfavourable', deltaLabel: 'estate blend',      positive: false },
  { label: 'Wastage',            value: '2.4%',    delta: 'of net sales', deltaLabel: '−0.2pp vs LW',      positive: true },
  { label: 'Labour % sales',     value: '28.1%',   delta: '+0.6pp',       deltaLabel: 'vs roster plan',    positive: false },
  { label: 'Stock accuracy',     value: '97.1%',   delta: 'cycle counts', deltaLabel: '3 sites under 95%', positive: false },
];

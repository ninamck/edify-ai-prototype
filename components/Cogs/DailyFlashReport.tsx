'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, ChevronDown, PiggyBank, ShoppingBag } from 'lucide-react';
import { gbp } from './format';

/**
 * Daily Flash Report — one trading day at the COGS hub. Mirrors the real
 * Edify flash report (net sales hero, metrics, margin cards, labour
 * breakdown, sales-vs-labour chart) with mock figures that reconcile with
 * the weekly COGS fixtures (£51,000 net sales, 27.8% actual COGS).
 */

const FLASH_DAY_LABEL = 'Wednesday, Jan 07 2026';

const FLASH = {
  netSales: 7610.0,
  atv: 8.65,
  discounts: 112.4,
  waste: 38.2,
  costOfSalesPct: 27.8,
  labourCost: 1930.0,
  labourHours: 142,
  hourlyHours: 128,
  hourlyCost: 1664.0,
  salaryHours: 14,
  salaryCost: 266.0,
} as const;

const COST_OF_SALES = (FLASH.netSales * FLASH.costOfSalesPct) / 100;
const GROSS_MARGIN = FLASH.netSales - COST_OF_SALES;
const OP_PROFIT = FLASH.netSales - COST_OF_SALES - FLASH.labourCost;

/** Sales per / transactions per / items per labour hour. */
const SPLH = FLASH.netSales / FLASH.labourHours;
const TPLH = FLASH.netSales / FLASH.atv / FLASH.labourHours;
const IPLH = TPLH * 2.4;

/** Week of the stocktake period — sums to the £51,000 in the fixtures. */
const WEEK_SALES_VS_LABOUR = [
  { day: 'Thu 01', labour: 1860, sales: 6180 },
  { day: 'Fri 02', labour: 2050, sales: 7950 },
  { day: 'Sat 03', labour: 2210, sales: 8640 },
  { day: 'Sun 04', labour: 1980, sales: 7310 },
  { day: 'Mon 05', labour: 1790, sales: 6420 },
  { day: 'Tue 06', labour: 1840, sales: 6890 },
  { day: 'Wed 07', labour: 1930, sales: 7610 },
];

const CARD: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  boxShadow: '0 2px 12px rgba(0, 28, 53,0.06)',
};

function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 16px',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>{children}</span>
      {right}
    </div>
  );
}

function MetricRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '9px 16px',
        borderTop: '1px solid var(--color-border-subtle)',
      }}
    >
      <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', fontWeight: 500 }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: accent ? 'var(--color-warning)' : 'var(--color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      style={{
        ...CARD,
        flex: '1 1 220px',
        minWidth: 200,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '18px 20px',
      }}
    >
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--color-badge-bg)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-accent-deep)',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)' }}>{value}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>{sub}</span>
      </div>
    </div>
  );
}

export default function DailyFlashReport() {
  const [mounted, setMounted] = useState(false);
  const [labourSource, setLabourSource] = useState<'scheduled' | 'timesheet'>('timesheet');
  useEffect(() => setMounted(true), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Day label */}
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-muted)' }}>
        {FLASH_DAY_LABEL} · Pret Hub Kitchen
      </div>

      {/* Net sales hero + metrics */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div
          style={{
            ...CARD,
            flex: '2 1 380px',
            minWidth: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            padding: '30px 24px',
          }}
        >
          <span
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--color-badge-bg)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent-deep)',
              flexShrink: 0,
            }}
          >
            <Banknote size={26} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
              }}
            >
              Total Net Sales
            </span>
            <span style={{ fontSize: 34, fontWeight: 800, color: 'var(--color-accent-deep)' }}>
              {gbp(FLASH.netSales, { decimals: 2 })}
            </span>
          </div>
        </div>

        <div style={{ ...CARD, flex: '1 1 300px', minWidth: 260 }}>
          <div style={{ padding: '12px 16px' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>Metrics</span>
          </div>
          <MetricRow label="ATV" value={gbp(FLASH.atv)} />
          <MetricRow label="Discounts" value={gbp(FLASH.discounts)} />
          <MetricRow label="Waste" value={gbp(FLASH.waste)} />
        </div>
      </div>

      {/* Margin cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <KpiCard
          icon={<PiggyBank size={20} />}
          label="Gross Margin"
          value={gbp(GROSS_MARGIN, { decimals: 0 })}
          sub={`${(100 - FLASH.costOfSalesPct).toFixed(1)}%`}
        />
        <KpiCard
          icon={<Banknote size={20} />}
          label="Operational Profit"
          value={gbp(OP_PROFIT, { decimals: 0 })}
          sub={`${((OP_PROFIT / FLASH.netSales) * 100).toFixed(1)}%`}
        />
        <KpiCard
          icon={<ShoppingBag size={20} />}
          label="Cost of Sales"
          value={gbp(COST_OF_SALES, { decimals: 0 })}
          sub={`${FLASH.costOfSalesPct.toFixed(1)}%`}
        />
      </div>

      {/* Labour breakdown */}
      <div style={CARD}>
        <SectionTitle
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Scheduled / Timesheet
              </span>
              <button
                type="button"
                onClick={() => setLabourSource((v) => (v === 'timesheet' ? 'scheduled' : 'timesheet'))}
                aria-label="Toggle labour source"
                style={{
                  width: 38,
                  height: 21,
                  borderRadius: 999,
                  border: 'none',
                  background:
                    labourSource === 'timesheet' ? 'var(--color-accent-deep)' : 'var(--color-border)',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: labourSource === 'timesheet' ? 19 : 2,
                    width: 17,
                    height: 17,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.15s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              </button>
            </div>
          }
        >
          Labour Breakdown
        </SectionTitle>
        <MetricRow
          label="Total Labour Cost"
          value={`${gbp(FLASH.labourCost, { decimals: 0 })} · ${((FLASH.labourCost / FLASH.netSales) * 100).toFixed(1)}%`}
          accent
        />
        <MetricRow label="Total Labour Hours" value={`${FLASH.labourHours} hrs`} />
        <MetricRow label="Hourly" value={`${FLASH.hourlyHours} hrs · ${gbp(FLASH.hourlyCost, { decimals: 0 })}`} />
        <MetricRow label="Salary" value={`${FLASH.salaryHours} hrs · ${gbp(FLASH.salaryCost, { decimals: 0 })}`} />
        <MetricRow label="SPLH (sales / labour hr)" value={gbp(SPLH)} />
        <MetricRow label="TPLH (transactions / labour hr)" value={TPLH.toFixed(1)} />
        <MetricRow label="IPLH (items / labour hr)" value={IPLH.toFixed(1)} />
      </div>

      {/* Sales vs labour */}
      <div style={CARD}>
        <SectionTitle
          right={
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
              }}
            >
              Daily
              <ChevronDown size={13} color="var(--color-text-muted)" />
            </span>
          }
        >
          Sales vs. Labour
        </SectionTitle>
        <div style={{ padding: '16px 12px 8px', height: 280 }}>
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WEEK_SALES_VS_LABOUR} barGap={3} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  axisLine={{ stroke: 'var(--color-border-subtle)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `£${(v / 1000).toFixed(v >= 1000 ? 0 : 1)}k`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    gbp(value, { decimals: 0 }),
                    name === 'labour' ? 'Labour Cost' : 'Net Sales',
                  ]}
                  contentStyle={{ fontSize: 12, fontFamily: 'var(--font-primary)', borderRadius: 8 }}
                />
                <Legend
                  formatter={(value: string) => (
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {value === 'labour' ? 'Labour Cost' : 'Net Sales'}
                    </span>
                  )}
                />
                <Bar dataKey="labour" fill="var(--color-accent-deep)" radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar dataKey="sales" fill="#b8c4bd" radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

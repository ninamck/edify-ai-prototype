'use client';

import { useState, type CSSProperties } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { tipStyle } from '@/components/Dashboard/data/estateMockData';
import {
  FIS_13_WEEK_SALES,
  FIS_HEADLINE,
  FIS_HEATMAPS,
  FIS_TRENDS_REVENUE_BY_OUTLET,
  FIS_TRENDS_WEEKS,
} from '@/components/Dashboard/CulinaryCollective/data/fisMockData';
import {
  FIS_AOV_COLUMNS,
  FIS_AOV_ROWS,
  FIS_BAR_INVENTORY_COLUMNS,
  FIS_BAR_INVENTORY_ROWS,
  FIS_FLASH_PNL_RATIO_COLUMNS,
  FIS_FLASH_PNL_RATIO_ROWS,
  FIS_FLASH_PNL_VALUE_COLUMNS,
  FIS_FLASH_PNL_VALUE_ROWS,
  FIS_HEATMAP_TABLE_COLUMNS,
  FIS_HEATMAP_TABLE_ROWS,
  FIS_ORDERS_COLUMNS,
  FIS_ORDERS_ROWS,
  FIS_REVENUE_BY_CATEGORY_COLUMNS,
  FIS_REVENUE_BY_CATEGORY_ROWS,
  FIS_REVENUE_BY_OUTLET_COLUMNS,
  FIS_REVENUE_BY_OUTLET_ROWS,
  FIS_REVENUE_PER_LABOUR_HOUR_COLUMNS,
  FIS_REVENUE_PER_LABOUR_HOUR_ROWS,
  FIS_REVENUE_VS_LY_COLUMNS,
  FIS_REVENUE_VS_LY_ROWS,
  FIS_SECURITY_AND_PROGRAMMING_COLUMNS,
  FIS_SECURITY_AND_PROGRAMMING_ROWS,
  FIS_TREND_TABLE_COLUMNS,
  FIS_TREND_TABLE_ROWS,
  FIS_TRENDS_COGS_MOVEMENTS_COLUMNS,
  FIS_TRENDS_COGS_MOVEMENTS_ROWS,
  FIS_TRENDS_GP_DETAIL_COLUMNS,
  FIS_TRENDS_GP_DETAIL_ROWS,
  FIS_TRENDS_INDIRECTS_COLUMNS,
  FIS_TRENDS_INDIRECTS_ROWS,
  FIS_TRENDS_REVENUE_BY_CATEGORY_COLUMNS,
  FIS_TRENDS_REVENUE_BY_CATEGORY_ROWS,
  FIS_TRENDS_REVENUE_TO_PNL_COLUMNS,
  FIS_TRENDS_REVENUE_TO_PNL_ROWS,
  FIS_TRENDS_WAGE_COST_COLUMNS,
  FIS_TRENDS_WAGE_COST_ROWS,
  FIS_WAGE_COST_COLUMNS,
  FIS_WAGE_COST_ROWS,
  FIS_WAGE_HOURS_COLUMNS,
  FIS_WAGE_HOURS_ROWS,
  FIS_YOY_SALES_BY_OUTLET_COLUMNS,
  FIS_YOY_SALES_BY_OUTLET_ROWS,
} from '@/components/Dashboard/CulinaryCollective/data/flatTables';
import {
  CC_OUTLET_COLORS,
  SectionCard,
  poundsKShort,
} from '@/components/Dashboard/CulinaryCollective/parts/format';
import HeatmapGrid from '@/components/Dashboard/CulinaryCollective/parts/HeatmapGrid';
import PnLGroupedView from '@/components/Dashboard/CulinaryCollective/parts/PnLGroupedView';
import {
  CategoryTrendChart,
  GpPercentChart,
  RevenueVsBudgetChart,
  WageCostStackedChart,
  YoyGrowthChart,
} from '@/components/Dashboard/CulinaryCollective/parts/TrendCharts';
import WaterfallChart from '@/components/Dashboard/CulinaryCollective/parts/WaterfallChart';
import DataTable from '@/components/Mvp1/Tables/DataTable';

// Stable references for the chart data so Recharts doesn't churn.
const WEEKLY_DATA = FIS_13_WEEK_SALES.map((w) => ({
  label: w.weekEnding,
  actual: w.actual,
  budget: w.budget,
  lastYear: w.lastYear,
}));

const OUTLET_TREND = FIS_TRENDS_WEEKS.map((week, idx) => {
  const get = (outlet: string) =>
    FIS_TRENDS_REVENUE_BY_OUTLET.find((s) => s.outlet === outlet)?.values[idx] ?? 0;
  return {
    week,
    Bar: get('Bar'),
    Flock: get('Flock'),
    Opa: get('Opa'),
    Dough: get('Dough'),
    Other: get('Other'),
  };
});

export default function FlashReport() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SalesSummarySection />
      <BudgetActualWaterfallSection />
      <ThirteenWeekSalesSection />
      <FlashPnLSection />
      <DailyDetailSection />
      <TrendsSection />
      <TrendsDetailSection />
      <YoYSalesSection />
      <BarInventorySection />
      <HeatmapsSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1b. Budget -> Actual waterfall (CHART DATA sheet) -- bridges this week's
// Budget contribution to overheads to the Actual via Sales/COGS/Indirects/Wages
// variance bars.
// ---------------------------------------------------------------------------

function BudgetActualWaterfallSection() {
  return (
    <SectionCard
      title="Budget → Actual · contribution to overheads"
      subtitle={`Week ending ${FIS_HEADLINE.weekEnding} · how each line moved the bottom line`}
    >
      <WaterfallChart />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// 1. Sales summary -- headline KPI strip.
// ---------------------------------------------------------------------------

function SalesSummarySection() {
  return (
    <SectionCard
      title="Sales summary"
      subtitle={`Flat Iron Square \u00b7 ${FIS_HEADLINE.weekEndingLong}`}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 8,
        }}
      >
        <SummaryStat label="Last week sales" value={FIS_HEADLINE.lastWeekSalesShort} />
        <SummaryStat
          label="Vs Budget"
          value={FIS_HEADLINE.lastWeekVsBudShort}
          tone={FIS_HEADLINE.lastWeekVsBud >= 0 ? 'positive' : 'negative'}
        />
        <SummaryStat label="Month to date" value={FIS_HEADLINE.monthToDateShort} />
        <SummaryStat label="Full month budget" value={FIS_HEADLINE.fullMonthBudgetShort} />
        <SummaryStat label="To go" value={FIS_HEADLINE.toGoShort} />
      </div>
    </SectionCard>
  );
}

function SummaryStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const color =
    tone === 'positive'
      ? '#14532d'
      : tone === 'negative'
        ? '#7f1d1d'
        : 'var(--color-text-primary)';
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        background: 'var(--color-bg-hover)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. 13-week sales chart (Actual / Budget / Last Year).
// ---------------------------------------------------------------------------

function ThirteenWeekSalesSection() {
  return (
    <SectionCard
      title="13-week sales"
      subtitle="Actual vs Budget vs Last Year · $k per week"
    >
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={WEEKLY_DATA} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              contentStyle={tipStyle}
              formatter={(v) => `\u00a3${Number(v).toFixed(1)}k`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="actual" name="Actual" fill="var(--color-accent-deep)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="budget" name="Budget" fill="var(--color-accent-mid)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="lastYear" name="Last Year" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// 3. Flash P&L -- value lines and ratio lines as two filterable tables.
// ---------------------------------------------------------------------------

function FlashPnLSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard
        title="Flash P&L · grouped view"
        subtitle={`Week ending ${FIS_HEADLINE.weekEnding} \u00b7 ${FIS_HEADLINE.monthLabel} MTD \u00b7 each section as in the spreadsheet`}
      >
        <PnLGroupedView
          weekEnding={FIS_HEADLINE.weekEnding}
          monthLabel={FIS_HEADLINE.monthLabel}
        />
      </SectionCard>

      <SectionCard
        title="Flash P&L · flat data"
        subtitle="All value rows in one searchable / filterable / exportable table"
      >
        <DataTable
          columns={FIS_FLASH_PNL_VALUE_COLUMNS}
          data={FIS_FLASH_PNL_VALUE_ROWS}
        />
      </SectionCard>

      <SectionCard
        title="Flash P&L · ratios"
        subtitle="Vs Revenue, GP %, Wage %"
      >
        <DataTable
          columns={FIS_FLASH_PNL_RATIO_COLUMNS}
          data={FIS_FLASH_PNL_RATIO_ROWS}
        />
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Daily detail -- one DataTable per logical block.
// ---------------------------------------------------------------------------

function DailyDetailSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard
        title="Revenue by outlet"
        subtitle={`Week ending ${FIS_HEADLINE.weekEnding} \u00b7 daily detail`}
      >
        <DataTable
          columns={FIS_REVENUE_BY_OUTLET_COLUMNS}
          data={FIS_REVENUE_BY_OUTLET_ROWS}
        />
      </SectionCard>

      <SectionCard
        title="Revenue vs last year"
        subtitle={`Week ending ${FIS_HEADLINE.weekEnding}`}
      >
        <DataTable
          columns={FIS_REVENUE_VS_LY_COLUMNS}
          data={FIS_REVENUE_VS_LY_ROWS}
        />
      </SectionCard>

      <SectionCard
        title="Revenue by category"
        subtitle={`Week ending ${FIS_HEADLINE.weekEnding}`}
      >
        <DataTable
          columns={FIS_REVENUE_BY_CATEGORY_COLUMNS}
          data={FIS_REVENUE_BY_CATEGORY_ROWS}
        />
      </SectionCard>

      <SectionCard title="Service mix & orders" subtitle="Quick service vs table service">
        <DataTable columns={FIS_ORDERS_COLUMNS} data={FIS_ORDERS_ROWS} />
      </SectionCard>

      <SectionCard title="AOV" subtitle="Average order value">
        <DataTable columns={FIS_AOV_COLUMNS} data={FIS_AOV_ROWS} />
      </SectionCard>

      <SectionCard
        title="Security & programming"
        subtitle={`Week ending ${FIS_HEADLINE.weekEnding}`}
      >
        <DataTable
          columns={FIS_SECURITY_AND_PROGRAMMING_COLUMNS}
          data={FIS_SECURITY_AND_PROGRAMMING_ROWS}
        />
      </SectionCard>

      <SectionCard title="Wage hours by department">
        <DataTable columns={FIS_WAGE_HOURS_COLUMNS} data={FIS_WAGE_HOURS_ROWS} />
      </SectionCard>

      <SectionCard title="Revenue per labour hour" subtitle="$ per hour">
        <DataTable
          columns={FIS_REVENUE_PER_LABOUR_HOUR_COLUMNS}
          data={FIS_REVENUE_PER_LABOUR_HOUR_ROWS}
        />
      </SectionCard>

      <SectionCard title="Wage cost & on-costs" subtitle={`Week ending ${FIS_HEADLINE.weekEnding}`}>
        <DataTable columns={FIS_WAGE_COST_COLUMNS} data={FIS_WAGE_COST_ROWS} />
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. 13-week revenue trend by outlet -- chart + flat data table.
// ---------------------------------------------------------------------------

function TrendsSection() {
  return (
    <SectionCard
      title="Trends · revenue by outlet"
      subtitle="13-week trailing window"
    >
      <div style={{ width: '100%', height: 300, marginBottom: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={OUTLET_TREND} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v) => `\u00a3${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip contentStyle={tipStyle} formatter={(v) => poundsKShort(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Bar" stroke={CC_OUTLET_COLORS.Bar} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Flock" stroke={CC_OUTLET_COLORS.Flock} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Opa" stroke={CC_OUTLET_COLORS.Opa} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Dough" stroke={CC_OUTLET_COLORS.Dough} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Other" stroke={CC_OUTLET_COLORS.Other} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTable columns={FIS_TREND_TABLE_COLUMNS} data={FIS_TREND_TABLE_ROWS} />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// 6. Trends sheet detail -- the rest of the 13-week trend slices that the
// Trends sheet packs in (revenue by category, revenue to P&L, COGS movements,
// GP detail by outlet, indirects, wage cost). One DataTable each so the user
// can search, filter by Group, and toggle weeks individually.
// ---------------------------------------------------------------------------

function TrendsDetailSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard
        title="Trends · revenue by category"
        subtitle="13-week trailing window · by drink / food category"
      >
        <div style={{ marginBottom: 12 }}>
          <CategoryTrendChart />
        </div>
        <DataTable
          columns={FIS_TRENDS_REVENUE_BY_CATEGORY_COLUMNS}
          data={FIS_TRENDS_REVENUE_BY_CATEGORY_ROWS}
        />
      </SectionCard>

      <SectionCard
        title="Trends · revenue to P&L"
        subtitle="Bar / Food / Discounts roll-up vs Budget"
      >
        <div style={{ marginBottom: 12 }}>
          <RevenueVsBudgetChart />
        </div>
        <DataTable
          columns={FIS_TRENDS_REVENUE_TO_PNL_COLUMNS}
          data={FIS_TRENDS_REVENUE_TO_PNL_ROWS}
        />
      </SectionCard>

      <SectionCard
        title="Trends · cost of sales movements"
        subtitle="Opening / Deliveries / Transfers / Closing · rolling 13 weeks"
      >
        <DataTable
          columns={FIS_TRENDS_COGS_MOVEMENTS_COLUMNS}
          data={FIS_TRENDS_COGS_MOVEMENTS_ROWS}
        />
      </SectionCard>

      <SectionCard
        title="Trends · GP detail (Bar & Food)"
        subtitle="Theoretical vs actual COGS, COS %, GP % · 13-week trend"
      >
        <div style={{ marginBottom: 12 }}>
          <GpPercentChart />
        </div>
        <DataTable
          columns={FIS_TRENDS_GP_DETAIL_COLUMNS}
          data={FIS_TRENDS_GP_DETAIL_ROWS}
        />
      </SectionCard>

      <SectionCard
        title="Trends · indirects & security"
        subtitle="Security hours, indirect costs, vs revenue · 13-week trend"
      >
        <DataTable
          columns={FIS_TRENDS_INDIRECTS_COLUMNS}
          data={FIS_TRENDS_INDIRECTS_ROWS}
        />
      </SectionCard>

      <SectionCard
        title="Trends · wage cost"
        subtitle="Outlet wages, on-costs, baked variable · 13-week trend"
      >
        <div style={{ marginBottom: 12 }}>
          <WageCostStackedChart />
        </div>
        <DataTable
          columns={FIS_TRENDS_WAGE_COST_COLUMNS}
          data={FIS_TRENDS_WAGE_COST_ROWS}
        />
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. YoY sales by outlet (YOY SALES sheet) -- This Year, Last Year, Growth
// values & %, broken down per outlet across 13 weeks.
// ---------------------------------------------------------------------------

function YoYSalesSection() {
  return (
    <SectionCard
      title="Year-on-year sales by outlet"
      subtitle="13-week rolling · This Year / Last Year / Growth $ / Growth %"
    >
      <div style={{ marginBottom: 12 }}>
        <YoyGrowthChart />
      </div>
      <DataTable
        columns={FIS_YOY_SALES_BY_OUTLET_COLUMNS}
        data={FIS_YOY_SALES_BY_OUTLET_ROWS}
      />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// 8. Bar weekly inventory & COGS (COGS - NORY sheet) -- one row per week.
// ---------------------------------------------------------------------------

function BarInventorySection() {
  return (
    <SectionCard
      title="Bar inventory & COGS (Nory)"
      subtitle="Opening / Deliveries / Transfers / Closing · actual food & beverage · 13 weeks"
    >
      <DataTable columns={FIS_BAR_INVENTORY_COLUMNS} data={FIS_BAR_INVENTORY_ROWS} />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// 9. Heatmap -- flattened to outlet x week rows so it slots into DataTable.
// ---------------------------------------------------------------------------

const HEATMAP_TAB_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 14px',
  borderRadius: 999,
  border: 'none',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
  transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
  whiteSpace: 'nowrap',
};

function HeatmapsSection() {
  const [activeOutlet, setActiveOutlet] = useState<string>(FIS_HEATMAPS[0]?.outlet ?? 'All');
  const activeMap =
    FIS_HEATMAPS.find((m) => m.outlet === activeOutlet) ?? FIS_HEATMAPS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionCard
        title="Variance vs last year · heatmap"
        subtitle="Pick an outlet · cells show daily $ variance vs prior year (green up, red down)"
        rightSlot={
          <div
            role="tablist"
            aria-label="Heatmap outlet"
            style={{
              display: 'inline-flex',
              flexWrap: 'wrap',
              gap: 6,
              padding: 4,
              borderRadius: 999,
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            {FIS_HEATMAPS.map((m) => {
              const active = m.outlet === activeOutlet;
              return (
                <button
                  key={m.outlet}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveOutlet(m.outlet)}
                  style={{
                    ...HEATMAP_TAB_STYLE,
                    background: active ? 'var(--color-accent-active)' : 'transparent',
                    color: active ? '#fff' : 'var(--color-text-muted)',
                    boxShadow: active ? '0 2px 8px rgba(34,68,68,0.25)' : 'none',
                  }}
                >
                  {m.outlet}
                </button>
              );
            })}
          </div>
        }
      >
        {activeMap && <HeatmapGrid heatmap={activeMap} />}
      </SectionCard>

      <SectionCard
        title="Variance vs last year · flat data"
        subtitle="All outlets in one searchable / filterable / exportable table"
      >
        <DataTable columns={FIS_HEATMAP_TABLE_COLUMNS} data={FIS_HEATMAP_TABLE_ROWS} />
      </SectionCard>
    </div>
  );
}

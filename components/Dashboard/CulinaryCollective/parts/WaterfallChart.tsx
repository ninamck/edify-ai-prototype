'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { tipStyle } from '@/components/Dashboard/data/estateMockData';
import {
  FIS_WATERFALL_STEPS,
  type WaterfallStep,
} from '@/components/Dashboard/CulinaryCollective/data/fisExtendedMockData';
import { formatPounds } from '@/components/Dashboard/CulinaryCollective/parts/format';

/** Recharts doesn't ship a waterfall component, so we fake it with a stacked
 *  BarChart: each step has an invisible `base` segment that sits underneath
 *  the visible `value` segment, positioning the visible bar at the right
 *  height. Total bars (Budget / Actual) sit on the floor with no base. */
type WaterfallChartRow = {
  label: string;
  /** Invisible spacer so the visible segment starts at the right height. */
  base: number;
  /** Visible segment height (always positive; sign is encoded in `delta`). */
  value: number;
  /** Original signed delta -- used for tooltip + colouring. */
  delta: number;
  /** True when this is a Budget / Actual total bar. */
  isTotal: boolean;
  /** Pre-formatted top-of-bar label so we don't need a custom formatter. */
  topLabel: string;
};

/** Compute the y range the bars actually cover so we can lift the chart
 *  floor up to just below it. With totals at £55k+ and deltas at £1-3k,
 *  starting the y-axis at 0 makes the variance bars look invisible. */
function computeYRange(steps: WaterfallStep[]): { minY: number; maxY: number } {
  let running = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const step of steps) {
    if (step.kind === 'total') {
      running = step.value;
      minY = Math.min(minY, step.value);
      maxY = Math.max(maxY, step.value);
    } else {
      const end = running + step.value;
      minY = Math.min(minY, running, end);
      maxY = Math.max(maxY, running, end);
      running = end;
    }
  }
  return { minY, maxY };
}

function pickFloor(minY: number, maxY: number): number {
  // Pad below minY by ~30% of the visible range, then round to a tidy
  // multiple so the y-axis ticks land on round numbers.
  const range = Math.max(maxY - minY, 1000);
  const raw = minY - range * 0.3;
  if (raw <= 0) return 0;
  // Round down to nearest 5,000 so axis ticks read as £50k, £55k, £60k etc.
  return Math.max(0, Math.floor(raw / 5000) * 5000);
}

function buildRows(steps: WaterfallStep[], floor: number): WaterfallChartRow[] {
  const rows: WaterfallChartRow[] = [];
  let running = 0;
  for (const step of steps) {
    if (step.kind === 'total') {
      running = step.value;
      // Total bars rest on the chart floor instead of 0, so they remain
      // visible alongside the small delta variances above the floor.
      rows.push({
        label: step.label,
        base: floor,
        value: Math.max(0, step.value - floor),
        delta: step.value,
        isTotal: true,
        topLabel: formatPounds(step.value),
      });
    } else {
      const end = running + step.value;
      const base = Math.min(running, end);
      const value = Math.abs(step.value);
      const sign = step.value >= 0 ? '+' : '';
      rows.push({
        label: step.label,
        base,
        value,
        delta: step.value,
        isTotal: false,
        topLabel: `${sign}${formatPounds(step.value)}`,
      });
      running = end;
    }
  }
  return rows;
}

const Y_RANGE = computeYRange(FIS_WATERFALL_STEPS);
const FLOOR = pickFloor(Y_RANGE.minY, Y_RANGE.maxY);
const Y_MAX = Math.ceil((Y_RANGE.maxY + (Y_RANGE.maxY - Y_RANGE.minY) * 0.15) / 1000) * 1000;
const ROWS = buildRows(FIS_WATERFALL_STEPS, FLOOR);

/** Connector lines bridge consecutive bars at the running total -- so the
 *  reader can see "Budget ends at £55,403, then Sales drops it to £54,205"
 *  without having to compare bar tops by eye. */
type Connector = { from: string; to: string; y: number };
function buildConnectors(steps: WaterfallStep[]): Connector[] {
  const out: Connector[] = [];
  let running = 0;
  for (let i = 0; i < steps.length - 1; i++) {
    const step = steps[i];
    if (step.kind === 'total') {
      running = step.value;
    } else {
      running = running + step.value;
    }
    out.push({ from: step.label, to: steps[i + 1].label, y: running });
  }
  return out;
}
const CONNECTORS = buildConnectors(FIS_WATERFALL_STEPS);

const TOTAL_FILL = '#1f2937';
const POSITIVE_FILL = 'var(--color-accent-deep)';
const NEGATIVE_FILL = '#b91c1c';

function valueColor(row: WaterfallChartRow): string {
  if (row.isTotal) return TOTAL_FILL;
  return row.delta >= 0 ? POSITIVE_FILL : NEGATIVE_FILL;
}

export default function WaterfallChart() {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={ROWS}
          margin={{ top: 24, right: 16, left: 0, bottom: 0 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            domain={[FLOOR, Y_MAX]}
            allowDataOverflow
            tickFormatter={(v) => `£${(Number(v) / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={tipStyle}
            formatter={(v, _key, ctx) => {
              const row = (ctx?.payload ?? {}) as Partial<WaterfallChartRow>;
              if (row.isTotal) return formatPounds(Number(v));
              const sign = (row.delta ?? 0) >= 0 ? '+' : '';
              return `${sign}${formatPounds(row.delta ?? 0)}`;
            }}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload as WaterfallChartRow | undefined;
              if (!row) return label;
              if (row.isTotal) return `${row.label}`;
              return `${row.label} variance vs Budget`;
            }}
          />
          <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="value" stackId="wf" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {ROWS.map((row, i) => (
              <Cell key={i} fill={valueColor(row)} />
            ))}
            <LabelList
              dataKey="topLabel"
              position="top"
              style={{ fontSize: 11, fontWeight: 600, fill: 'var(--color-text-primary)' }}
            />
          </Bar>
          {CONNECTORS.map((c, i) => (
            <ReferenceLine
              key={`connector-${i}`}
              ifOverflow="visible"
              segment={[
                { x: c.from, y: c.y },
                { x: c.to, y: c.y },
              ]}
              stroke="var(--color-text-muted)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

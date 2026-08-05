'use client';

import { Cell, Pie, PieChart } from 'recharts';
import { DollarSign, Info } from 'lucide-react';
import FxAttributionCard from './FxAttributionCard';
import { gbp } from './format';
import {
  COGS_CLASS_ROWS,
  COGS_CLASS_TOTALS,
  COGS_SUMMARY,
  type CogsClassRow,
} from './fixtures';

const OK = 'var(--color-success)';
const WARN = 'var(--color-warning)';
const TRACK = 'var(--color-border-subtle)';

function pct(n: number | null): string {
  if (n === null) return '\u2014';
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

/** Donut gauge showing a single COGS % with the gross margin beneath. */
function CogsGauge({
  label,
  cogsPct,
  grossMarginPct,
  cogsGbp,
  accent,
}: {
  label: string;
  cogsPct: number;
  grossMarginPct: number;
  cogsGbp: number;
  accent: string;
}) {
  const clamped = Math.max(0, Math.min(100, cogsPct));
  const data = [
    { name: 'cogs', value: clamped },
    { name: 'rest', value: 100 - clamped },
  ];
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: '16px 18px',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(0, 28, 53,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          alignSelf: 'flex-start',
        }}
      >
        {label}
      </span>
      <div style={{ position: 'relative', width: 132, height: 132 }}>
        <PieChart width={132} height={132} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          {/* Full track sits underneath so the value arc reads as a fill. */}
          <Pie
            data={[{ name: 'track', value: 100 }]}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={62}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
            fill={TRACK}
          />
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={62}
            startAngle={90}
            endAngle={-270}
            cornerRadius={7}
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill={accent} />
            <Cell fill="transparent" />
          </Pie>
        </PieChart>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 700, color: accent, lineHeight: 1 }}>
            {cogsPct.toFixed(1)}%
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', marginTop: 3, letterSpacing: '0.04em' }}>
            COGS
          </span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {gbp(cogsGbp)}
        </div>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
          Gross margin {grossMarginPct.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '7px 0',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: strong ? 700 : 600,
          color: 'var(--color-text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

const TH: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  padding: '10px 12px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

const TD: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  padding: '11px 12px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

const CLASS_COLORS: Record<string, string> = {
  Beverage: '#4a6cb5',
  Food: '#B45309',
  General: '#191484',
  Other: '#6B5E55',
  Unassigned: '#B01038',
};

function ClassCell({ row }: { row: CogsClassRow }) {
  return (
    <td style={{ ...TD, textAlign: 'left' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: CLASS_COLORS[row.productClass] ?? 'var(--color-text-muted)',
          }}
        />
        {row.productClass}
      </span>
    </td>
  );
}

export default function SingleSiteCogs() {
  const t = COGS_CLASS_TOTALS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Multi-currency demo only: Edify decomposes the period's cost
          movement into FX vs price vs volume. Renders null elsewhere. */}
      <FxAttributionCard />

      {/* Total net sales banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: '20px',
          borderRadius: 12,
          border: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-hover)',
        }}
      >
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <DollarSign size={20} color="var(--color-text-secondary)" />
        </span>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
            }}
          >
            Total Net Sales
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {gbp(COGS_SUMMARY.totalNetSales)}
          </div>
        </div>
      </div>

      {/* Gauges + summary */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 16, flex: '1 1 320px', minWidth: 280 }}>
          <CogsGauge
            label="Theoretical"
            cogsPct={COGS_SUMMARY.theoreticalPct}
            grossMarginPct={COGS_SUMMARY.theoreticalGrossMarginPct}
            cogsGbp={COGS_SUMMARY.theoreticalCogs}
            accent={OK}
          />
          <CogsGauge
            label="Actual"
            cogsPct={COGS_SUMMARY.actualPct}
            grossMarginPct={COGS_SUMMARY.actualGrossMarginPct}
            cogsGbp={COGS_SUMMARY.actualCogs}
            accent={WARN}
          />
        </div>

        <div
          style={{
            flex: '2 1 420px',
            minWidth: 320,
            padding: '16px 18px',
            borderRadius: 12,
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
            boxShadow: '0 2px 12px rgba(0, 28, 53,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Info size={16} color="var(--color-text-secondary)" />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                }}
              >
                Actual vs Theoretical
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Summary
              </div>
            </div>
          </div>

          <SummaryRow label="Opening Stock" value={gbp(COGS_SUMMARY.openingStock)} />
          <SummaryRow label="Purchases" value={gbp(COGS_SUMMARY.purchases)} />
          <SummaryRow label="Transfer" value={gbp(COGS_SUMMARY.transfersNet)} />
          <SummaryRow label="Closing Stock" value={gbp(COGS_SUMMARY.closingStock)} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              paddingTop: 10,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Variance vs theoretical
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: WARN }}>
              {gbp(COGS_SUMMARY.varianceCost, { sign: true })} ({COGS_SUMMARY.variancePp >= 0 ? '+' : ''}
              {COGS_SUMMARY.variancePp.toFixed(1)}pp)
            </span>
          </div>
        </div>
      </div>

      {/* COGS breakdown by class */}
      <div
        style={{
          borderRadius: 12,
          border: '1px solid var(--color-border-subtle)',
          background: '#fff',
          boxShadow: '0 2px 12px rgba(0, 28, 53,0.06)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 16px',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', flex: 1 }}>
            COGs Breakdown
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-hover)' }}>
                <th style={{ ...TH, textAlign: 'left' }}>Product Class</th>
                <th style={TH}>Opening Stock</th>
                <th style={TH}>Purchases</th>
                <th style={TH}>Transfers In</th>
                <th style={TH}>Transfers Out</th>
                <th style={TH}>Waste</th>
                <th style={TH}>Closing Stock</th>
                <th style={TH}>Actual COGS</th>
                <th style={TH}>Actual %</th>
                <th style={TH}>Gross Margin %</th>
                <th style={TH}>Sales</th>
              </tr>
            </thead>
            <tbody>
              {COGS_CLASS_ROWS.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  <ClassCell row={row} />
                  <td style={TD}>{gbp(row.openingStock)}</td>
                  <td style={TD}>{gbp(row.purchases)}</td>
                  <td style={TD}>{gbp(row.transfersIn)}</td>
                  <td style={TD}>{gbp(row.transfersOut)}</td>
                  <td style={TD}>{gbp(row.waste)}</td>
                  <td style={TD}>{gbp(row.closingStock)}</td>
                  <td style={{ ...TD, fontWeight: 700 }}>{gbp(row.actualCogs)}</td>
                  <td style={TD}>{pct(row.actualPct)}</td>
                  <td style={TD}>{pct(row.grossMarginPct)}</td>
                  <td style={TD}>{gbp(row.sales)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--color-accent-deep)' }}>
                <td style={{ ...TD, textAlign: 'left', color: '#fff', fontWeight: 700 }}>Total</td>
                <td style={{ ...TD, color: '#fff', fontWeight: 700 }}>{gbp(t.openingStock)}</td>
                <td style={{ ...TD, color: '#fff', fontWeight: 700 }}>{gbp(t.purchases)}</td>
                <td style={{ ...TD, color: '#fff', fontWeight: 700 }}>{gbp(t.transfersIn)}</td>
                <td style={{ ...TD, color: '#fff', fontWeight: 700 }}>{gbp(t.transfersOut)}</td>
                <td style={{ ...TD, color: '#fff', fontWeight: 700 }}>{gbp(t.waste)}</td>
                <td style={{ ...TD, color: '#fff', fontWeight: 700 }}>{gbp(t.closingStock)}</td>
                <td style={{ ...TD, color: '#fff', fontWeight: 700 }}>{gbp(t.actualCogs)}</td>
                <td style={{ ...TD, color: '#fff', fontWeight: 700 }}>{pct(t.actualPct)}</td>
                <td style={{ ...TD, color: '#fff', fontWeight: 700 }}>{pct(t.grossMarginPct)}</td>
                <td style={{ ...TD, color: '#fff', fontWeight: 700 }}>{gbp(t.sales)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

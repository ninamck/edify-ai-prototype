'use client';

import { useMemo, useState } from 'react';
import { Activity, Search, X } from 'lucide-react';
import {
  DEMO_TODAY,
  type ProductionRecipe,
} from '@/components/Production/fixtures';
import { DEMO_NOW_HHMM } from '@/components/Production/PlanStore';
import { useProductionSite } from '@/components/Production/ProductionSiteContext';
import {
  buildHourlySalesByRecipe,
  formatHour,
  KITCHEN_OPEN_HOUR,
  KITCHEN_CLOSE_HOUR,
} from '@/components/Production/salesActuals';

const CATEGORY_ORDER: ProductionRecipe['category'][] = [
  'Bakery',
  'Sandwich',
  'Salad',
  'Snack',
  'Beverage',
];

const MODE_LABEL: Record<string, string> = {
  run: 'RUN',
  variable: 'VAR',
  increment: 'SEG',
};

export default function LiveSalesPage() {
  const { siteId } = useProductionSite();
  const [categoryFilter, setCategoryFilter] = useState<'All' | ProductionRecipe['category']>('All');
  const [query, setQuery] = useState('');

  const data = useMemo(
    () => buildHourlySalesByRecipe(siteId, DEMO_TODAY, DEMO_NOW_HHMM),
    [siteId],
  );

  // Categories actually present in the result.
  const categories = useMemo(() => {
    const present = new Set<ProductionRecipe['category']>();
    for (const r of data.rows) present.add(r.line.recipe.category);
    return CATEGORY_ORDER.filter(c => present.has(c));
  }, [data.rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = categoryFilter === 'All' ? data.rows : data.rows.filter(r => r.line.recipe.category === categoryFilter);
    if (q) {
      base = base.filter(r => {
        if (r.line.recipe.name.toLowerCase().includes(q)) return true;
        if (r.line.recipe.selectionTags.some(t => t.toLowerCase().includes(q))) return true;
        return false;
      });
    }
    return base;
  }, [data.rows, categoryFilter, query]);

  // Variance % for header KPI.
  const variancePct =
    data.totalForecastSoFar > 0
      ? Math.round(((data.totalSoldSoFar - data.totalForecastSoFar) / data.totalForecastSoFar) * 100)
      : 0;
  const varianceColor =
    Math.abs(variancePct) < 5
      ? 'var(--color-text-muted)'
      : variancePct >= 0
        ? 'var(--color-success)'
        : 'var(--color-error)';

  // Per-row peak for inline mini-bars (uses row's own forecast peak so each
  // recipe's intensity reads relatively rather than getting drowned by
  // bestsellers).
  const rowPeak = (row: typeof data.rows[number]) =>
    Math.max(1, ...row.cells.map(c => Math.max(c.forecast, c.actual ?? 0)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header + KPI strip */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Live indicator caption — site picker lives in the layout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--color-success)',
                boxShadow: '0 0 0 3px color-mix(in srgb, var(--color-success) 25%, transparent)',
                animation: 'live-pulse 1.6s ease-in-out infinite',
              }}
            />
            Live · {DEMO_TODAY} (Thu) · {DEMO_NOW_HHMM}
          </span>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
          <Kpi
            label="Sold so far"
            value={data.totalSoldSoFar.toLocaleString()}
            sub={`vs ${data.totalForecastSoFar.toLocaleString()} fcst`}
          />
          <Kpi
            label="Tracking"
            value={`${variancePct >= 0 ? '+' : ''}${variancePct}%`}
            valueColor={varianceColor}
            sub={
              variancePct >= 0
                ? `+${data.totalSoldSoFar - data.totalForecastSoFar} ahead`
                : `${data.totalSoldSoFar - data.totalForecastSoFar} behind`
            }
          />
          <Kpi
            label="Day target"
            value={data.totalForecastDay.toLocaleString()}
            sub={`${Math.round((data.totalSoldSoFar / Math.max(1, data.totalForecastDay)) * 100)}% complete`}
          />
          <Kpi
            label="Recipes selling"
            value={String(data.rows.filter(r => r.soldSoFar > 0).length)}
            sub={`of ${data.rows.length} on plan`}
          />
        </div>
      </div>

      {/* Filter + search row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
        }}
      >
        <div
          role="tablist"
          aria-label="Filter by category"
          style={{
            display: 'flex',
            background: 'var(--color-bg-hover)',
            borderRadius: 100,
            padding: 3,
            width: 'fit-content',
          }}
        >
          {(['All', ...categories] as const).map(c => {
            const active = c === categoryFilter;
            const count = c === 'All' ? data.rows.length : data.rows.filter(r => r.line.recipe.category === c).length;
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategoryFilter(c)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 100,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                  background: active ? 'var(--color-accent-active)' : 'transparent',
                  color: active ? '#ffffff' : 'var(--color-text-secondary)',
                  transition: 'all 0.15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                }}
              >
                {c}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: 100,
                    fontSize: 12,
                    fontWeight: 700,
                    background: active ? 'rgba(255,255,255,0.25)' : 'var(--color-border-subtle)',
                    color: active ? '#ffffff' : 'var(--color-text-secondary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 8,
            background: '#ffffff',
            border: '1px solid var(--color-border)',
            minWidth: 220,
          }}
        >
          <Search size={12} color="var(--color-text-muted)" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search recipe or tag…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 12,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-primary)',
              background: 'transparent',
              padding: 0,
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0, display: 'inline-flex' }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Sales table */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {/* Scroll wrapper so the table can be wider than the page on small screens. */}
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                minWidth: 1100,
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontFamily: 'var(--font-primary)',
              }}
            >
              <thead>
                <tr>
                  <th style={headCellStyle({ left: true, sticky: true, minWidth: 240 })}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Recipe
                    </span>
                  </th>
                  {data.hourTotals.map(h => (
                    <th key={h.hour} style={headCellStyle({ current: h.isCurrent })} title={formatHour(h.hour)}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: h.isCurrent ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                          letterSpacing: '0.04em',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {String(h.hour).padStart(2, '0')}
                      </span>
                    </th>
                  ))}
                  <th style={headCellStyle({ right: true, minWidth: 80 })}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Sold
                    </span>
                  </th>
                  <th style={headCellStyle({ right: true, minWidth: 70 })}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Day fcst
                    </span>
                  </th>
                  <th style={headCellStyle({ right: true, minWidth: 70 })}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Var
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={data.hourTotals.length + 4} style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
                      No recipes match this filter.
                    </td>
                  </tr>
                )}
                {filteredRows.map(row => {
                  const peak = rowPeak(row);
                  const variancePctRow =
                    row.forecastSoFar > 0
                      ? Math.round(((row.soldSoFar - row.forecastSoFar) / row.forecastSoFar) * 100)
                      : 0;
                  const rowVarColor =
                    row.forecastSoFar === 0
                      ? 'var(--color-text-muted)'
                      : Math.abs(variancePctRow) < 5
                        ? 'var(--color-text-muted)'
                        : variancePctRow >= 0
                          ? 'var(--color-success)'
                          : 'var(--color-error)';
                  return (
                    <tr key={row.line.item.id}>
                      <td style={bodyCellStyle({ left: true, sticky: true })}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: 8,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: 'var(--color-bg-hover)',
                              color: 'var(--color-text-secondary)',
                              letterSpacing: '0.04em',
                              flexShrink: 0,
                            }}
                            title={`${row.line.item.mode} mode`}
                          >
                            {MODE_LABEL[row.line.item.mode] ?? row.line.item.mode.toUpperCase()}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: 'var(--color-text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {row.line.recipe.name}
                          </span>
                          <span style={{ fontSize: 9, color: 'var(--color-text-muted)', flexShrink: 0, marginLeft: 'auto', paddingLeft: 6 }}>
                            {row.line.recipe.category}
                          </span>
                        </div>
                      </td>
                      {row.cells.map(cell => (
                        <HourCell key={cell.hour} cell={cell} peak={peak} />
                      ))}
                      <td style={bodyCellStyle({ right: true })}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                            {row.soldSoFar}
                          </span>
                          <span style={{ fontSize: 9, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            so far
                          </span>
                        </div>
                      </td>
                      <td style={bodyCellStyle({ right: true })}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                          {row.forecastDay}
                        </span>
                      </td>
                      <td style={bodyCellStyle({ right: true })}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: rowVarColor, fontVariantNumeric: 'tabular-nums' }}>
                          {row.forecastSoFar === 0 ? '—' : `${variancePctRow >= 0 ? '+' : ''}${variancePctRow}%`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Site totals footer */}
              <tfoot>
                <tr>
                  <td style={footCellStyle({ left: true, sticky: true })}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Activity size={11} /> Site total
                    </span>
                  </td>
                  {data.hourTotals.map(h => {
                    const value = h.actual ?? h.forecast;
                    const variance = h.actual != null ? h.actual - h.forecast : 0;
                    const tone =
                      h.actual == null
                        ? 'forecast'
                        : Math.abs(variance) <= Math.max(2, h.forecast * 0.1)
                          ? 'on'
                          : variance > 0
                            ? 'over'
                            : 'under';
                    const color =
                      tone === 'forecast'
                        ? 'var(--color-text-muted)'
                        : tone === 'on'
                          ? 'var(--color-text-primary)'
                          : tone === 'over'
                            ? 'var(--color-success)'
                            : 'var(--color-error)';
                    return (
                      <td key={h.hour} style={footCellStyle({ current: h.isCurrent })} title={`${formatHour(h.hour)}: ${h.actual ?? '—'} sold (forecast ${h.forecast})`}>
                        <span style={{ fontSize: 12, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                          {value}
                        </span>
                      </td>
                    );
                  })}
                  <td style={footCellStyle({ right: true })}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {data.totalSoldSoFar}
                    </span>
                  </td>
                  <td style={footCellStyle({ right: true })}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {data.totalForecastDay}
                    </span>
                  </td>
                  <td style={footCellStyle({ right: true })}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: varianceColor, fontVariantNumeric: 'tabular-nums' }}>
                      {variancePct >= 0 ? '+' : ''}{variancePct}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer caption */}
        <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 10, lineHeight: 1.5 }}>
          Live actuals are synthesised from each SKU&rsquo;s by-phase forecast with a deterministic ±15% wobble — once a real till feed is wired in, this page swaps to the same shape with hourly POS data. Variance is calculated against the forecast share due by the current time, so it stays meaningful mid-hour.
        </p>
      </div>

      <style jsx>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function HourCell({ cell, peak }: { cell: ReturnType<typeof buildHourlySalesByRecipe>['rows'][number]['cells'][number]; peak: number }) {
  const value = cell.actual ?? cell.forecast;
  const heightPct = Math.max(8, Math.round((value / peak) * 100));
  const variance = cell.actual != null ? cell.actual - cell.forecast : 0;
  const tone =
    cell.actual == null
      ? 'forecast'
      : Math.abs(variance) <= Math.max(2, cell.forecast * 0.15)
        ? 'on'
        : variance > 0
          ? 'over'
          : 'under';

  const barBg =
    tone === 'forecast'
      ? 'var(--color-border)'
      : tone === 'on'
        ? 'var(--color-text-secondary)'
        : tone === 'over'
          ? 'var(--color-success)'
          : 'var(--color-error)';

  const numColor =
    cell.actual == null
      ? 'var(--color-text-muted)'
      : tone === 'on'
        ? 'var(--color-text-primary)'
        : tone === 'over'
          ? 'var(--color-success)'
          : 'var(--color-error)';

  return (
    <td
      style={bodyCellStyle({ current: cell.isCurrent })}
      title={
        cell.actual == null
          ? `${formatHour(cell.hour)}: forecast ${cell.forecast}`
          : `${formatHour(cell.hour)}: ${cell.actual} sold (forecast ${cell.forecast}, ${variance >= 0 ? '+' : ''}${variance})`
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0 }}>
        <div
          style={{
            width: '100%',
            maxWidth: 24,
            height: 18,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            background: 'var(--color-bg-surface)',
            borderRadius: 3,
            border: cell.isCurrent ? '1px solid var(--color-success)' : '1px solid transparent',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '100%',
              height: `${heightPct}%`,
              background: barBg,
              opacity: cell.actual == null ? 0.45 : 1,
            }}
          />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: numColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {cell.actual ?? cell.forecast}
        </span>
      </div>
    </td>
  );
}

function Kpi({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 140,
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 700, color: valueColor ?? 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ─── Cell style helpers ─────────────────────────────────────────────────────

function headCellStyle({ left, right, sticky, current, minWidth }: { left?: boolean; right?: boolean; sticky?: boolean; current?: boolean; minWidth?: number }): React.CSSProperties {
  return {
    padding: '10px 8px',
    background: current ? 'color-mix(in srgb, var(--color-success) 10%, white)' : 'var(--color-bg-surface)',
    borderBottom: '1px solid var(--color-border-subtle)',
    textAlign: left ? 'left' : right ? 'right' : 'center',
    position: sticky ? 'sticky' : undefined,
    left: sticky ? 0 : undefined,
    zIndex: sticky ? 2 : undefined,
    boxShadow: sticky ? '1px 0 0 var(--color-border-subtle)' : undefined,
    minWidth,
  };
}

function bodyCellStyle({ left, right, sticky, current }: { left?: boolean; right?: boolean; sticky?: boolean; current?: boolean }): React.CSSProperties {
  return {
    padding: '8px 8px',
    background: current ? 'color-mix(in srgb, var(--color-success) 5%, white)' : '#ffffff',
    borderBottom: '1px solid var(--color-border-subtle)',
    textAlign: left ? 'left' : right ? 'right' : 'center',
    position: sticky ? 'sticky' : undefined,
    left: sticky ? 0 : undefined,
    zIndex: sticky ? 1 : undefined,
    boxShadow: sticky ? '1px 0 0 var(--color-border-subtle)' : undefined,
    verticalAlign: 'middle',
  };
}

function footCellStyle({ left, right, sticky, current }: { left?: boolean; right?: boolean; sticky?: boolean; current?: boolean }): React.CSSProperties {
  return {
    padding: '10px 8px',
    background: current ? 'color-mix(in srgb, var(--color-success) 12%, white)' : 'var(--color-bg-surface)',
    borderTop: '1px solid var(--color-border)',
    textAlign: left ? 'left' : right ? 'right' : 'center',
    position: sticky ? 'sticky' : undefined,
    left: sticky ? 0 : undefined,
    zIndex: sticky ? 2 : undefined,
    boxShadow: sticky ? '1px 0 0 var(--color-border-subtle)' : undefined,
  };
}

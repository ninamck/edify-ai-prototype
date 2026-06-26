'use client';

/**
 * HorizonGrid — the working tool. SKUs × today + N future days.
 *
 * Reading order top-to-bottom:
 *   • Category filter pills + total count caption (and how many rows
 *     are currently selected by the filter).
 *   • Sticky table header: Recipe · DOW columns.
 *   • Row per SKU. Click a cell to:
 *       - select it (drives WhyPanel + AdjustmentRow contents)
 *       - expand the row to reveal the inline AdjustmentRow underneath.
 *   • Cell hover surface shows the per-phase split as a tooltip so the
 *     manager can see the morning/midday/afternoon shape without
 *     leaving the grid.
 *
 * Status dot: drafts get a quiet amber pip in the corner so the
 * operator can tell at a glance which forecast Quinn is still firming
 * up (vs. ones a manager has previously confirmed).
 */

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  DEMO_TODAY,
  dayOfWeek,
  siteBrand,
  type ProductionRecipe,
  type SiteId,
} from '@/components/Production/fixtures';
import AdjustmentRow from './AdjustmentRow';
import type { ForecastRow } from './accuracy';

const CATEGORY_ORDER: ProductionRecipe['category'][] = [
  'Bakery',
  'Sandwich',
  'Salad',
  'Snack',
  'Beverage',
];

// Burger King speaks a different menu language than Pret. The forecast SKUs
// reuse the shared category enum, so we relabel + reorder the filter pills for
// the BK brand only. (Pret keeps the enum values as-is.)
const BK_CATEGORY_ORDER: ProductionRecipe['category'][] = [
  'Sandwich',
  'Snack',
  'Beverage',
  'Bakery',
  'Salad',
];

const BK_CATEGORY_LABEL: Record<ProductionRecipe['category'], string> = {
  Sandwich: 'Burgers & chicken',
  Snack: 'Sides',
  Beverage: 'Drinks',
  Bakery: 'Desserts',
  Salad: 'Salads',
};

const MODE_LABEL: Record<string, string> = {
  run: 'RUN',
  variable: 'VAR',
  increment: 'DROP',
};

type CategoryFilter = 'All' | ProductionRecipe['category'];

/** Brand-aware label for a category filter (BK menu language; Pret = enum). */
function categoryLabel(c: CategoryFilter, brand: string): string {
  if (c === 'All') return 'All';
  return brand === 'bk' ? BK_CATEGORY_LABEL[c] : c;
}

type Selection = {
  skuId: string;
  date: string;
};

type Props = {
  siteId: SiteId;
  rows: ForecastRow[];
  dates: string[];
  /** Manager-applied per-SKU overrides, keyed via `overrideKey`. */
  overrides: Record<string, number>;
  overrideKey: (skuId: string, date: string) => string;
  /**
   * Total-level multipliers (one per date). The page lets the operator
   * nudge the whole-day forecast at the headline level; that nudge
   * cascades into every SKU's base value here, so SKU rows reflect the
   * updated baseline even before the operator interacts with this
   * grid. Per-SKU overrides still take precedence.
   */
  totalMultipliers: Record<string, number>;
  selection: Selection | null;
  /** Click on a specific date cell — sets the focused day for the adjuster. */
  onSelect: (skuId: string, date: string) => void;
  /** Click on the chevron — toggles the inline AdjustmentRow open / closed. */
  onToggleRow: (skuId: string) => void;
  /**
   * Click on the recipe-label area of a row — opens the hourly-breakdown
   * drawer for that SKU on the page's currently active date. The drawer
   * is the answer to "when in the day does this thing sell?", separate
   * from the inline adjuster (which is "how much should we make of it?").
   */
  onOpenHourly: (skuId: string) => void;
  /** Open the right-side WhyPanel for a given (skuId, date). */
  onOpenWhy: (skuId: string, date: string) => void;
  onOverride: (skuId: string, date: string, qty: number | null) => void;
};

export default function HorizonGrid({
  siteId,
  rows,
  dates,
  overrides,
  overrideKey,
  totalMultipliers,
  selection,
  onSelect,
  onToggleRow,
  onOpenHourly,
  onOpenWhy,
  onOverride,
}: Props) {
  const [category, setCategory] = useState<CategoryFilter>('All');
  const brand = siteBrand(siteId);

  const presentCategories = useMemo(() => {
    const set = new Set<ProductionRecipe['category']>();
    for (const r of rows) set.add(r.category);
    const order = brand === 'bk' ? BK_CATEGORY_ORDER : CATEGORY_ORDER;
    return order.filter(c => set.has(c));
  }, [rows, brand]);

  const filteredRows = useMemo(() => {
    return category === 'All' ? rows : rows.filter(r => r.category === category);
  }, [rows, category]);

  return (
    <section
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Header row — filter pills + caption */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: '0.01em',
          }}
        >
          What we expect to sell · next {dates.length} days
        </h2>
        <div
          role="tablist"
          aria-label="Category filter"
          style={{
            display: 'flex',
            background: 'var(--color-bg-hover)',
            borderRadius: 100,
            padding: 3,
          }}
        >
          {(['All', ...presentCategories] as const).map(c => {
            const active = c === category;
            const count = c === 'All' ? rows.length : rows.filter(r => r.category === c).length;
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(c)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 100,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                  background: active ? 'var(--color-accent-active)' : 'transparent',
                  color: active ? '#ffffff' : 'var(--color-text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                {categoryLabel(c, brand)}
                <span
                  style={{
                    minWidth: 16,
                    height: 16,
                    padding: '0 5px',
                    borderRadius: 100,
                    fontSize: 11,
                    fontWeight: 700,
                    background: active ? 'rgba(255,255,255,0.25)' : 'var(--color-border-subtle)',
                    color: active ? '#ffffff' : 'var(--color-text-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted)' }}>
          Click a recipe to see its hourly shape · use the chevron to adjust inline
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            minWidth: 760,
            borderCollapse: 'separate',
            borderSpacing: 0,
          }}
        >
          <thead>
            <tr>
              <th style={headCell({ left: true, sticky: true, minWidth: 240 })}>
                <span style={headLabel}>Recipe</span>
              </th>
              {dates.map(d => {
                const isToday = d === DEMO_TODAY;
                return (
                  <th
                    key={d}
                    style={headCell({ current: isToday, minWidth: 80 })}
                    title={d}
                  >
                    <span
                      style={{
                        ...headLabel,
                        color: isToday ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      {dayOfWeek(d)}
                      {isToday && <span style={{ marginLeft: 6, fontWeight: 600 }}>· today</span>}
                    </span>
                  </th>
                );
              })}
              <th style={headCell({ right: true, minWidth: 90 })}>
                <span style={headLabel}>Horizon</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td
                  colSpan={dates.length + 2}
                  style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  No recipes in this category for this site.
                </td>
              </tr>
            )}
            {filteredRows.map(row => {
              const isRowSelected = selection?.skuId === row.skuId;
              const selectedDate = isRowSelected ? selection!.date : null;
              return (
                <RowGroup
                  key={row.skuId}
                  row={row}
                  dates={dates}
                  overrides={overrides}
                  overrideKey={overrideKey}
                  totalMultipliers={totalMultipliers}
                  isRowSelected={isRowSelected}
                  selectedDate={selectedDate}
                  onSelect={onSelect}
                  onToggleRow={onToggleRow}
                  onOpenHourly={onOpenHourly}
                  onOpenWhy={onOpenWhy}
                  onOverride={onOverride}
                  siteId={siteId}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RowGroup({
  row,
  dates,
  overrides,
  overrideKey,
  totalMultipliers,
  isRowSelected,
  selectedDate,
  onSelect,
  onToggleRow,
  onOpenHourly,
  onOpenWhy,
  onOverride,
  siteId,
}: {
  row: ForecastRow;
  dates: string[];
  overrides: Record<string, number>;
  overrideKey: (skuId: string, date: string) => string;
  totalMultipliers: Record<string, number>;
  isRowSelected: boolean;
  selectedDate: string | null;
  onSelect: (skuId: string, date: string) => void;
  onToggleRow: (skuId: string) => void;
  onOpenHourly: (skuId: string) => void;
  onOpenWhy: (skuId: string, date: string) => void;
  onOverride: (skuId: string, date: string, qty: number | null) => void;
  siteId: SiteId;
}) {
  /** Apply the date-level total multiplier to a SKU's base projected units. */
  const scaledBaseFor = (date: string, projected: number): number => {
    const m = totalMultipliers[date];
    if (!m || !Number.isFinite(m) || m <= 0) return projected;
    return Math.round(projected * m);
  };
  return (
    <>
      <tr
        style={{
          background: isRowSelected ? 'color-mix(in srgb, var(--color-accent-active) 4%, white)' : '#ffffff',
        }}
      >
        <td
          style={bodyCell({ left: true, sticky: true, selected: isRowSelected, clickable: true })}
          onClick={() => onOpenHourly(row.skuId)}
          role="button"
          aria-label={`Open hourly forecast for ${row.recipe.name}`}
          title={`Open hourly forecast for ${row.recipe.name}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {/* Chevron stays as the inline-expand affordance — stopPropagation
                so it doesn't also fire the drawer-open above. */}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onToggleRow(row.skuId);
              }}
              aria-expanded={isRowSelected}
              aria-label={`${isRowSelected ? 'Collapse' : 'Expand'} adjuster for ${row.recipe.name}`}
              title={`${isRowSelected ? 'Hide' : 'Show'} the inline adjuster`}
              style={chevronButton}
            >
              {isRowSelected ? (
                <ChevronDown size={15} color="var(--color-text-secondary)" />
              ) : (
                <ChevronRight size={15} color="var(--color-text-secondary)" />
              )}
            </button>
            <span style={modeBadge}>{MODE_LABEL[row.recipe.defaultMode] ?? row.recipe.defaultMode.toUpperCase()}</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={row.recipe.name}
            >
              {row.recipe.name}
            </span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                marginLeft: 'auto',
                paddingLeft: 8,
                flexShrink: 0,
              }}
            >
              {categoryLabel(row.category, siteBrand(siteId))}
            </span>
          </div>
        </td>
        {row.byDate.map(({ date, forecast }) => {
          const isToday = date === DEMO_TODAY;
          const isCellSelected = isRowSelected && selectedDate === date;
          const override = overrides[overrideKey(row.skuId, date)];
          const scaledBase = scaledBaseFor(date, forecast?.projectedUnits ?? 0);
          const value = override ?? scaledBase;
          const isOverridden = override !== undefined;
          const isCascaded =
            !isOverridden && scaledBase !== (forecast?.projectedUnits ?? 0);
          return (
            <td
              key={date}
              style={bodyCell({ current: isToday, clickable: true, selected: isCellSelected })}
              onClick={() => onSelect(row.skuId, date)}
              title={
                forecast
                  ? buildCellTooltip(forecast, override, isCascaded ? scaledBase : undefined)
                  : 'No forecast for this date.'
              }
            >
              <CellNumber
                value={value}
                isDraft={forecast?.status === 'draft'}
                isOverridden={isOverridden}
                isCascaded={isCascaded}
                isMuted={!forecast || (forecast.projectedUnits === 0 && override == null)}
              />
            </td>
          );
        })}
        <td style={bodyCell({ right: true, selected: isRowSelected })}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {row.horizonTotal.toLocaleString()}
          </span>
        </td>
      </tr>
      {isRowSelected && selectedDate && (
        <tr>
          <td
            colSpan={dates.length + 2}
            style={{
              background: 'color-mix(in srgb, var(--color-accent-active) 3%, white)',
              borderBottom: '1px solid var(--color-border-subtle)',
              padding: 0,
            }}
          >
            <AdjustmentRow
              siteId={siteId}
              row={row}
              date={selectedDate}
              currentValue={
                overrides[overrideKey(row.skuId, selectedDate)] ??
                scaledBaseFor(
                  selectedDate,
                  row.byDate.find(b => b.date === selectedDate)?.forecast?.projectedUnits ?? 0,
                )
              }
              baseValue={scaledBaseFor(
                selectedDate,
                row.byDate.find(b => b.date === selectedDate)?.forecast?.projectedUnits ?? 0,
              )}
              onOverride={qty => onOverride(row.skuId, selectedDate, qty)}
              onOpenWhy={() => onOpenWhy(row.skuId, selectedDate)}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function CellNumber({
  value,
  isDraft,
  isOverridden,
  isCascaded,
  isMuted,
}: {
  value: number;
  isDraft?: boolean;
  isOverridden?: boolean;
  /** True when the cell value differs from Quinn's baseline solely
   *  because of a total-level edit (no per-SKU override). */
  isCascaded?: boolean;
  isMuted?: boolean;
}) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
        fontVariantNumeric: 'tabular-nums',
        minWidth: 48,
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: isMuted
            ? 'var(--color-text-muted)'
            : isOverridden
              ? 'var(--color-accent-active)'
              : isCascaded
                ? 'var(--color-accent-active)'
                : 'var(--color-text-primary)',
          textDecoration: isOverridden ? 'underline dotted' : 'none',
          textUnderlineOffset: 3,
          fontStyle: isCascaded && !isOverridden ? 'italic' : 'normal',
        }}
      >
        {value.toLocaleString()}
      </span>
      {isDraft && (
        <span
          aria-label="Draft"
          title="This forecast is still firming up."
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--color-warning)',
            flexShrink: 0,
          }}
        />
      )}
    </div>
  );
}

function buildCellTooltip(
  forecast: { projectedUnits: number; byPhase?: { morning: number; midday: number; afternoon: number }; status: 'draft' | 'confirmed' },
  override: number | undefined,
  cascadedBase?: number,
): string {
  const lines: string[] = [];
  lines.push(`Forecast: ${forecast.projectedUnits} ${forecast.status === 'draft' ? '(draft)' : '(confirmed)'}`);
  if (cascadedBase != null) lines.push(`Total-edit cascade: ${cascadedBase}`);
  if (override != null) lines.push(`Override: ${override}`);
  if (forecast.byPhase) {
    lines.push(`Phases — morning ${forecast.byPhase.morning} · midday ${forecast.byPhase.midday} · afternoon ${forecast.byPhase.afternoon}`);
  }
  return lines.join('\n');
}

// ─── Cell style helpers ──────────────────────────────────────────────────────

const headLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
};

const modeBadge: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: 4,
  background: 'var(--color-bg-hover)',
  color: 'var(--color-text-secondary)',
  letterSpacing: '0.04em',
  flexShrink: 0,
};

const chevronButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  borderRadius: 4,
  cursor: 'pointer',
  flexShrink: 0,
};

function headCell({
  left,
  right,
  sticky,
  current,
  minWidth,
}: {
  left?: boolean;
  right?: boolean;
  sticky?: boolean;
  current?: boolean;
  minWidth?: number;
}): React.CSSProperties {
  return {
    padding: '10px 10px',
    background: current ? 'color-mix(in srgb, var(--color-success) 10%, white)' : 'var(--color-bg-hover)',
    borderBottom: '1px solid var(--color-border-subtle)',
    textAlign: left ? 'left' : right ? 'right' : 'center',
    position: sticky ? 'sticky' : undefined,
    left: sticky ? 0 : undefined,
    zIndex: sticky ? 2 : undefined,
    boxShadow: sticky ? '1px 0 0 var(--color-border-subtle)' : undefined,
    minWidth,
    whiteSpace: 'nowrap',
  };
}

function bodyCell({
  left,
  right,
  sticky,
  current,
  clickable,
  selected,
}: {
  left?: boolean;
  right?: boolean;
  sticky?: boolean;
  current?: boolean;
  clickable?: boolean;
  selected?: boolean;
}): React.CSSProperties {
  const baseBg = selected
    ? 'color-mix(in srgb, var(--color-accent-active) 6%, white)'
    : current
      ? 'color-mix(in srgb, var(--color-success) 4%, white)'
      : '#ffffff';
  return {
    padding: '10px 12px',
    background: baseBg,
    borderBottom: '1px solid var(--color-border-subtle)',
    textAlign: left ? 'left' : right ? 'right' : 'center',
    position: sticky ? 'sticky' : undefined,
    left: sticky ? 0 : undefined,
    zIndex: sticky ? 1 : undefined,
    boxShadow: sticky ? '1px 0 0 var(--color-border-subtle)' : undefined,
    cursor: clickable ? 'pointer' : 'default',
    verticalAlign: 'middle',
  };
}

'use client';

import { Search, X as XIcon, Calendar } from 'lucide-react';
import type { TaskKind } from '@/components/Feed/taskHistoryStore';

export type ActivityFilter = 'all' | TaskKind;
export type ActivityDateRange = 'today' | 'week' | 'month' | 'all';

const FILTER_OPTIONS: { id: ActivityFilter; label: string }[] = [
  { id: 'all',          label: 'All' },
  { id: 'recipe-edit',  label: 'Recipes' },
  { id: 'product-swap', label: 'Products' },
  { id: 'menu',         label: 'Menu' },
  { id: 'production',   label: 'Production' },
  { id: 'supplier',     label: 'Suppliers' },
  { id: 'stock',        label: 'Stock' },
  { id: 'waste',        label: 'Waste' },
  { id: 'question',     label: 'Questions' },
  { id: 'chat',         label: 'Chat' },
];

const DATE_OPTIONS: { id: ActivityDateRange; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all',   label: 'All time' },
];

export interface ActivityFiltersProps {
  filter: ActivityFilter;
  onFilterChange: (f: ActivityFilter) => void;
  dateRange: ActivityDateRange;
  onDateRangeChange: (d: ActivityDateRange) => void;
  search: string;
  onSearchChange: (s: string) => void;
  /** Per-kind counts for the chip badges. */
  counts: Partial<Record<TaskKind, number>>;
  totalCount: number;
}

export default function ActivityFilters({
  filter,
  onFilterChange,
  dateRange,
  onDateRangeChange,
  search,
  onSearchChange,
  counts,
  totalCount,
}: ActivityFiltersProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div
          style={{
            position: 'relative',
            flex: '1 1 280px',
            minWidth: 240,
            maxWidth: 480,
          }}
        >
          <Search
            size={14}
            strokeWidth={2.2}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by recipe, supplier, change…"
            style={{
              width: '100%',
              padding: '9px 36px 9px 34px',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 10,
              fontFamily: 'var(--font-primary)',
              fontSize: 13,
              color: 'var(--color-text-primary)',
              background: '#fff',
              boxSizing: 'border-box',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                padding: 4,
              }}
            >
              <XIcon size={13} strokeWidth={2.4} />
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Date range"
          style={pickerTrayStyle}
        >
          <Calendar size={13} strokeWidth={2.2} color="var(--color-text-muted)" style={{ marginLeft: 8 }} />
          {DATE_OPTIONS.map((d) => {
            const active = dateRange === d.id;
            return (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onDateRangeChange(d.id)}
                style={pillStyle(active)}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Activity kind"
        style={{
          ...pickerTrayStyle,
          flexWrap: 'wrap',
          alignSelf: 'flex-start',
        }}
      >
        {FILTER_OPTIONS.map((f) => {
          const active = filter === f.id;
          const c = f.id === 'all' ? totalCount : (counts[f.id as TaskKind] ?? 0);
          // Hide kind chips with zero matches to keep the row tight —
          // showing all 10 even when 8 are empty makes the bar noisy.
          if (f.id !== 'all' && c === 0) return null;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFilterChange(f.id)}
              style={pillStyle(active)}
            >
              {f.label}
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: active ? 'rgba(255, 255, 255, 0.85)' : 'var(--color-text-muted)',
                  letterSpacing: 0,
                }}
              >
                {c}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared segmented-control style ───────────────────────────────────
//
// Matches the canonical site-wide segmented control (Shell top-bar
// Command-centre / Dashboard tabs): white tray with a navy border,
// 100px pill radius, navy-fill active state with white text + the same
// 2-axis soft shadow. Re-stating it here rather than importing the
// shell tab styles directly so the Activity filters can vary padding /
// gap if the row ever needs to be more compact.

const pickerTrayStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: 4,
  borderRadius: 100,
  background: '#ffffff',
  border: '1px solid var(--color-shell-tab-border, rgba(0, 28, 53, 1))',
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 100,
    border: 'none',
    background: active ? 'var(--color-accent-active)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text-muted)',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    boxShadow: active ? '0 2px 8px rgba(34, 68, 68, 0.25)' : 'none',
    transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
    whiteSpace: 'nowrap',
  };
}

'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { ChevronDown, Plus, X, Filter as FilterIcon } from 'lucide-react';
import { DATA_SOURCES, type DataSourceId } from './dataSources';

export type ViewFilter = {
  id: string;
  label: string;
  columnKey: string;
  type: 'string' | 'integer';
  /** Source whose distinct values populate the dropdown. */
  optionsSource: DataSourceId;
  /** Currently selected values. Empty = "All" (no constraint). */
  selected: Array<string | number>;
  /** When false, the filter cannot be removed from the bar. */
  removable?: boolean;
};

/**
 * Curated catalogue of filters the user can add via the "+ Add filter" menu.
 * Limited to columns that exist in real Dunkin sources we've registered.
 */
type FilterPreset = Omit<ViewFilter, 'selected'>;

const ADDABLE_FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'name',
    label: 'Store',
    columnKey: 'name',
    type: 'string',
    optionsSource: 'flashReport',
  },
  {
    id: 'year',
    label: 'Year',
    columnKey: 'year',
    type: 'integer',
    optionsSource: 'weeklyFlashTotals',
  },
  {
    id: 'brand',
    label: 'Brand',
    columnKey: 'brand',
    type: 'string',
    optionsSource: 'dailySalesByProductFamily',
  },
  {
    id: 'major_group_name',
    label: 'Major group',
    columnKey: 'major_group_name',
    type: 'string',
    optionsSource: 'dailySalesByProductFamily',
  },
  {
    id: 'family_group_name',
    label: 'Product family',
    columnKey: 'family_group_name',
    type: 'string',
    optionsSource: 'dailySalesByProductFamily',
  },
  {
    id: 'division_description',
    label: 'NDCP division',
    columnKey: 'division_description',
    type: 'string',
    optionsSource: 'ndcpDivisions',
  },
];

export const DEFAULT_VIEW_FILTERS: ViewFilter[] = [
  {
    id: 'dm',
    label: 'District Manager',
    columnKey: 'dm',
    type: 'string',
    optionsSource: 'flashReport',
    selected: [],
    removable: false,
  },
  {
    id: 'week_number',
    label: 'Week No.',
    columnKey: 'week_number',
    type: 'integer',
    optionsSource: 'weeklyFlashTotals',
    selected: [],
    removable: false,
  },
];

export default function ViewFilterBar({
  filters,
  onChange,
}: {
  filters: ViewFilter[];
  onChange: (next: ViewFilter[]) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!addMenuOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (addBtnRef.current?.contains(t) || addMenuRef.current?.contains(t)) return;
      setAddMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [addMenuOpen]);

  function update(id: string, patch: Partial<ViewFilter>) {
    onChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function remove(id: string) {
    onChange(filters.filter((f) => f.id !== id || f.removable === false));
  }

  function clearAll() {
    onChange(filters.map((f) => ({ ...f, selected: [] })));
  }

  const presetCandidates = ADDABLE_FILTER_PRESETS.filter(
    (preset) => !filters.some((f) => f.id === preset.id),
  );

  const anySelected = filters.some((f) => f.selected.length > 0);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        padding: '8px 10px',
        borderRadius: 10,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          paddingRight: 6,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <FilterIcon size={12} strokeWidth={2.4} />
        Filters
      </span>

      {filters.map((f) => (
        <FilterChip
          key={f.id}
          filter={f}
          open={openId === f.id}
          onOpenChange={(next) => setOpenId(next ? f.id : null)}
          onSelectedChange={(selected) => update(f.id, { selected })}
          onRemove={f.removable === false ? undefined : () => remove(f.id)}
        />
      ))}

      <div style={{ position: 'relative' }}>
        <button
          ref={addBtnRef}
          type="button"
          onClick={() => {
            if (presetCandidates.length === 0) return;
            setAddMenuOpen((v) => !v);
          }}
          disabled={presetCandidates.length === 0}
          style={{
            ...chipBase,
            cursor: presetCandidates.length === 0 ? 'not-allowed' : 'pointer',
            color: 'var(--color-text-muted)',
            background: '#fff',
            border: '1px dashed var(--color-border-subtle)',
            opacity: presetCandidates.length === 0 ? 0.5 : 1,
          }}
          title={
            presetCandidates.length === 0
              ? 'All preset filters added'
              : 'Add another filter'
          }
        >
          <Plus size={13} strokeWidth={2.4} />
          <span>Add filter</span>
        </button>
        {addMenuOpen && presetCandidates.length > 0 && (
          <div
            ref={addMenuRef}
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              zIndex: 30,
              minWidth: 200,
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 8,
              boxShadow: '0 6px 24px rgba(58,48,40,0.16)',
              padding: 4,
              fontFamily: 'var(--font-primary)',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                padding: '6px 10px 4px',
              }}
            >
              Add filter
            </div>
            {presetCandidates.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onChange([...filters, { ...preset, selected: [] }]);
                  setAddMenuOpen(false);
                }}
                style={menuItemStyle}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    'var(--color-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {anySelected && (
        <button
          type="button"
          onClick={clearAll}
          style={{
            marginLeft: 'auto',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function FilterChip({
  filter,
  open,
  onOpenChange,
  onSelectedChange,
  onRemove,
}: {
  filter: ViewFilter;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onSelectedChange: (selected: Array<string | number>) => void;
  onRemove?: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapperRef.current?.contains(e.target as Node)) return;
      onOpenChange(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false);
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  const summary =
    filter.selected.length === 0
      ? 'All'
      : filter.selected.length === 1
        ? String(filter.selected[0])
        : `${filter.selected.length} selected`;

  const active = filter.selected.length > 0;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        style={{
          ...chipBase,
          background: active ? 'rgba(34,68,68,0.08)' : '#fff',
          border: active
            ? '1px solid var(--color-accent-active)'
            : '1px solid var(--color-border-subtle)',
          color: active ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
        }}
      >
        <span style={{ fontWeight: 700 }}>{filter.label}</span>
        <span style={{ color: active ? 'var(--color-accent-active)' : 'var(--color-text-muted)' }}>
          : {summary}
        </span>
        <ChevronDown size={11} strokeWidth={2.2} />
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${filter.label} filter`}
          title="Remove filter"
          style={{
            marginLeft: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 999,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
          }}
        >
          <X size={12} strokeWidth={2.4} />
        </button>
      )}
      {open && (
        <FilterValuePicker
          filter={filter}
          onSelectedChange={onSelectedChange}
          onClose={() => onOpenChange(false)}
        />
      )}
    </div>
  );
}

function FilterValuePicker({
  filter,
  onSelectedChange,
  onClose,
}: {
  filter: ViewFilter;
  onSelectedChange: (selected: Array<string | number>) => void;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<Array<string | number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    DATA_SOURCES[filter.optionsSource]
      .load()
      .then((rows) => {
        if (cancelled) return;
        const seen = new Set<string | number>();
        for (const row of rows as Array<Record<string, unknown>>) {
          const v = row[filter.columnKey];
          if (v === null || v === undefined || v === '') continue;
          if (filter.type === 'integer') {
            if (typeof v === 'number' && Number.isFinite(v)) seen.add(v);
          } else {
            seen.add(String(v));
          }
        }
        const sorted = Array.from(seen).sort((a, b) => {
          if (typeof a === 'number' && typeof b === 'number') return a - b;
          return String(a).localeCompare(String(b));
        });
        setOptions(sorted);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load options');
      });
    return () => {
      cancelled = true;
    };
  }, [filter.optionsSource, filter.columnKey, filter.type]);

  const selectedSet = useMemo(() => new Set(filter.selected), [filter.selected]);

  const filteredOptions = useMemo(() => {
    if (!options) return [];
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o).toLowerCase().includes(q));
  }, [options, search]);

  function toggle(value: string | number) {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onSelectedChange(Array.from(next));
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        zIndex: 30,
        width: 240,
        maxHeight: 320,
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 10,
        boxShadow: '0 8px 28px rgba(58,48,40,0.16)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-primary)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${filter.label.toLowerCase()}…`}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: 12,
            fontFamily: 'var(--font-primary)',
            background: 'transparent',
            color: 'var(--color-text-primary)',
          }}
        />
        {filter.selected.length > 0 && (
          <button
            type="button"
            onClick={() => onSelectedChange([])}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text-muted)',
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div style={{ overflowY: 'auto', flex: 1, padding: 4 }}>
        {!options && !error && (
          <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--color-text-muted)' }}>
            Loading options…
          </div>
        )}
        {error && (
          <div style={{ padding: '8px 10px', fontSize: 12, color: '#d44d4d' }}>{error}</div>
        )}
        {options && filteredOptions.length === 0 && (
          <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--color-text-muted)' }}>
            No matches.
          </div>
        )}
        {filteredOptions.map((value) => {
          const isOn = selectedSet.has(value);
          return (
            <label
              key={String(value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--color-text-primary)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLLabelElement).style.background =
                  'var(--color-bg-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLLabelElement).style.background = 'transparent';
              }}
            >
              <input
                type="checkbox"
                checked={isOn}
                onChange={() => toggle(value)}
                style={{ accentColor: 'var(--color-accent-active)' }}
              />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {String(value)}
              </span>
            </label>
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderTop: '1px solid var(--color-border-subtle)',
          fontSize: 11,
          color: 'var(--color-text-muted)',
        }}
      >
        <span>
          {filter.selected.length} of {options?.length ?? 0} selected
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-accent-active)',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

const chipBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const menuItemStyle: CSSProperties = {
  all: 'unset',
  display: 'flex',
  alignItems: 'center',
  padding: '7px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  width: 'calc(100% - 4px)',
  boxSizing: 'border-box',
};

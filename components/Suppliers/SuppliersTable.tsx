'use client';

/**
 * Suppliers list table.
 *
 * Adds three column-anchored controls on top of the basic grid view:
 *
 *   1. Sort on Supplier name — chevron header cycles none → asc → desc → none.
 *   2. Filter on Categories — multi-select popover sourced from the
 *      categories actually present in the dataset.
 *   3. Filter on Status     — multi-select popover for Available / Pending /
 *      Unavailable (only statuses present in data are listed).
 *
 * Selection is by ID, so applying a filter doesn't drop user selections — items
 * already selected stay selected even if temporarily filtered out of view (the
 * BulkActionBar count remains accurate). When at least one filter or sort is
 * active a thin "Filtered view" strip appears with a Clear link so the user
 * always has a single-tap reset.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, ChevronsUpDown, Filter, Check } from 'lucide-react';
import {
  type Supplier, type Product,
  type ProductCategory, type SupplierStatus,
} from './fixtures';
import { Checkbox, RowQuinnButton, StatusPill, SmallButton } from './Primitives';

const COLUMNS = '32px 2fr 1.4fr 70px 80px 110px 90px';

type SortDir = 'asc' | 'desc' | null;

export default function SuppliersTable({
  suppliers,
  products,
  selectedIds,
  onToggleSelect,
  onToggleSelectMany,
  onOpenSupplier,
  onAskQuinn,
}: {
  suppliers: Supplier[];
  products: Product[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  /** Bulk-select handler used by the header "select all" checkbox. Passes the
   *  list of currently visible (post-filter) IDs and the desired state. The
   *  parent decides how to merge it into its selection set — typically:
   *    select=true  → add all of `ids` to the existing selection
   *    select=false → remove all of `ids` from the existing selection
   *  Selection in other (non-visible) rows is untouched, so a user filtering
   *  to "Pending" and clicking the header tick selects only the pending ones
   *  and leaves any prior selections from other categories intact. */
  onToggleSelectMany?: (ids: string[], select: boolean) => void;
  onOpenSupplier: (id: string) => void;
  onAskQuinn: (supplierId: string) => void;
}) {
  const router = useRouter();
  const productsBySupplier = (id: string) =>
    products.filter((p) => p.supplierId === id).length;

  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [categoryFilter, setCategoryFilter] = useState<Set<ProductCategory>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<SupplierStatus>>(new Set());

  // Only offer filter options that exist in the current data — saves the user
  // from picking a category that would always return zero rows.
  const availableCategories = useMemo<ProductCategory[]>(() => {
    const set = new Set<ProductCategory>();
    suppliers.forEach((s) => s.categories.forEach((c) => set.add(c)));
    return [...set].sort();
  }, [suppliers]);

  // Statuses are listed in a stable severity order rather than alphabetic so
  // the menu reads consistently across pages.
  const availableStatuses = useMemo<SupplierStatus[]>(() => {
    const present = new Set<SupplierStatus>();
    suppliers.forEach((s) => present.add(s.status));
    return (['Available', 'Pending', 'Unavailable'] as SupplierStatus[]).filter((s) => present.has(s));
  }, [suppliers]);

  const view = useMemo(() => {
    let xs = suppliers;
    if (categoryFilter.size > 0) {
      xs = xs.filter((s) => s.categories.some((c) => categoryFilter.has(c)));
    }
    if (statusFilter.size > 0) {
      xs = xs.filter((s) => statusFilter.has(s.status));
    }
    if (sortDir) {
      xs = [...xs].sort((a, b) => {
        const cmp = a.name.localeCompare(b.name);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return xs;
  }, [suppliers, categoryFilter, statusFilter, sortDir]);

  function cycleSort() {
    setSortDir((d) => d === null ? 'asc' : d === 'asc' ? 'desc' : null);
  }

  function clearAll() {
    setSortDir(null);
    setCategoryFilter(new Set());
    setStatusFilter(new Set());
  }

  const hasFilter = categoryFilter.size > 0 || statusFilter.size > 0;
  const hasSort = sortDir !== null;
  const totalCount = suppliers.length;
  const viewCount = view.length;

  // Header-checkbox tri-state derived from the currently visible rows. We
  // intentionally only count visible rows so the header reflects "select all
  // I can see right now", not the entire dataset hidden behind filters.
  const visibleSelectedCount = useMemo(
    () => view.reduce((n, s) => n + (selectedIds.has(s.id) ? 1 : 0), 0),
    [view, selectedIds],
  );
  const allVisibleSelected = viewCount > 0 && visibleSelectedCount === viewCount;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  function toggleAllVisible() {
    if (!onToggleSelectMany || viewCount === 0) return;
    onToggleSelectMany(view.map((s) => s.id), !allVisibleSelected);
  }

  return (
    <div style={{
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 14,
      overflow: 'hidden',
      background: '#fff',
    }}>
      {(hasFilter || hasSort) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-hover)',
          fontSize: 12, color: 'var(--color-text-secondary)',
        }}>
          <span style={{ fontWeight: 600 }}>
            Showing {viewCount} of {totalCount}
          </span>
          {hasFilter && (
            <span style={{ color: 'var(--color-text-muted)' }}>
              · {[
                categoryFilter.size > 0 && `${categoryFilter.size} ${categoryFilter.size === 1 ? 'category' : 'categories'}`,
                statusFilter.size > 0 && `${statusFilter.size} status`,
              ].filter(Boolean).join(' · ')}
            </span>
          )}
          {hasSort && (
            <span style={{ color: 'var(--color-text-muted)' }}>
              · Sorted by name {sortDir === 'asc' ? '(A-Z)' : '(Z-A)'}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button
            onClick={clearAll}
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--color-accent-active)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              padding: 0,
            }}
          >
            Clear
          </button>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: COLUMNS,
        gap: 14,
        padding: '10px 14px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: '#FBFAF8',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--color-text-muted)',
      }}>
        <Checkbox
          checked={allVisibleSelected}
          indeterminate={someVisibleSelected}
          onClick={toggleAllVisible}
          disabled={viewCount === 0 || !onToggleSelectMany}
          ariaLabel={
            allVisibleSelected ? `Deselect all ${viewCount} visible suppliers`
            : `Select all ${viewCount} visible suppliers`
          }
        />
        <SortableHeader label="Supplier name" sortDir={sortDir} onClick={cycleSort} />
        <FilterableHeader<ProductCategory>
          label="Categories"
          options={availableCategories}
          selected={categoryFilter}
          onChange={setCategoryFilter}
        />
        <span>Sites</span>
        <span>Products</span>
        <FilterableHeader<SupplierStatus>
          label="Status"
          options={availableStatuses}
          selected={statusFilter}
          onChange={setStatusFilter}
        />
        <span style={{ textAlign: 'right' }}>Actions</span>
      </div>

      {view.length === 0 && (
        <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          No suppliers match your filters.
        </div>
      )}

      {view.map((s) => {
        const selected = selectedIds.has(s.id);
        return (
          <div
            key={s.id}
            onClick={() => { onOpenSupplier(s.id); router.push(`/suppliers/${s.id}`); }}
            style={{
              display: 'grid',
              gridTemplateColumns: COLUMNS,
              gap: 14,
              padding: '12px 14px',
              alignItems: 'center',
              borderBottom: '1px solid var(--color-border-subtle)',
              cursor: 'pointer',
              background: '#fff',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
          >
            <Checkbox checked={selected} onClick={() => onToggleSelect(s.id)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{
                fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {s.name}
              </span>
              {s.shortCode && s.shortCode !== s.name && (
                <span style={{
                  padding: '2px 7px',
                  borderRadius: 6,
                  background: 'var(--color-bg-hover)',
                  color: 'var(--color-text-muted)',
                  fontSize: 10.5, fontWeight: 700,
                }}>
                  {s.shortCode}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 0 }}>
              {s.categories.length === 0 ? (
                <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>0 Categories</span>
              ) : (
                s.categories.slice(0, 3).map((c) => (
                  <span key={c} style={{
                    padding: '2px 7px',
                    borderRadius: 6,
                    background: 'var(--color-bg-hover)',
                    color: 'var(--color-text-secondary)',
                    fontSize: 11, fontWeight: 600,
                  }}>
                    {c}
                  </span>
                ))
              )}
              {s.categories.length > 3 && (
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  +{s.categories.length - 3}
                </span>
              )}
            </div>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
              {s.sites.length} site{s.sites.length === 1 ? '' : 's'}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              {productsBySupplier(s.id)}
            </span>
            <StatusPill status={s.status} />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <RowQuinnButton onClick={() => onAskQuinn(s.id)} ariaLabel={`Ask Quinn about ${s.name}`} />
              <SmallButton
                label="Edit"
                onClick={() => { onOpenSupplier(s.id); router.push(`/suppliers/${s.id}`); }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Header sub-components

function SortableHeader({
  label,
  sortDir,
  onClick,
}: {
  label: string;
  sortDir: SortDir;
  onClick: () => void;
}) {
  const Icon = sortDir === 'asc' ? ChevronUp
             : sortDir === 'desc' ? ChevronDown
             : ChevronsUpDown;
  const active = sortDir !== null;
  return (
    <button
      onClick={onClick}
      title={active ? `Sorted ${sortDir === 'asc' ? 'A-Z' : 'Z-A'} — click to ${sortDir === 'asc' ? 'reverse' : 'clear'}` : 'Sort by supplier name'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 'inherit',
        fontWeight: 'inherit',
        textTransform: 'inherit',
        letterSpacing: 'inherit',
        color: active ? 'var(--color-text-secondary)' : 'inherit',
        textAlign: 'left',
      }}
    >
      {label}
      <Icon
        size={11}
        strokeWidth={2.5}
        style={{ opacity: active ? 1 : 0.45, color: active ? 'var(--color-accent-active)' : 'currentColor' }}
      />
    </button>
  );
}

function FilterableHeader<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: T[];
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const active = selected.size > 0;

  function openMenu() {
    if (btnRef.current) setAnchorRect(btnRef.current.getBoundingClientRect());
    setOpen(true);
  }

  function toggle(o: T) {
    const next = new Set(selected);
    if (next.has(o)) next.delete(o); else next.add(o);
    onChange(next);
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openMenu(); }}
        aria-label={`Filter ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={active ? `Filtering by ${selected.size} ${label.toLowerCase()}` : `Filter by ${label.toLowerCase()}`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: 4,
          border: 'none',
          background: active ? 'var(--color-accent-active)' : 'transparent',
          color: active ? '#fff' : 'var(--color-text-muted)',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.background = 'var(--color-bg-hover)';
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = 'transparent';
        }}
      >
        <Filter size={11} strokeWidth={2.4} />
        {active && (
          <span style={{
            position: 'absolute',
            top: -3, right: -3,
            minWidth: 12, height: 12, padding: '0 3px',
            borderRadius: 100,
            background: '#fff',
            color: 'var(--color-accent-active)',
            border: '1px solid var(--color-accent-active)',
            fontSize: 9, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {selected.size}
          </span>
        )}
      </button>
      {open && anchorRect && (
        <FilterPopover
          anchor={anchorRect}
          title={label}
          options={options}
          selected={selected}
          onToggle={toggle}
          onClear={() => onChange(new Set())}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

function FilterPopover<T extends string>({
  anchor,
  title,
  options,
  selected,
  onToggle,
  onClear,
  onClose,
}: {
  anchor: DOMRect;
  title: string;
  options: T[];
  selected: Set<T>;
  onToggle: (o: T) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside-click, Escape, or any window scroll. Scroll-close keeps
  // us out of "stale anchor" territory without recomputing position; the user
  // just re-opens after scrolling, same as a native <select>.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (popoverRef.current && popoverRef.current.contains(t)) return;
      // Don't immediately re-close when the click came from the trigger
      // button itself; the trigger's onClick handles toggling.
      const triggerLabel = `Filter ${title}`;
      const trigger = document.querySelector<HTMLButtonElement>(`button[aria-label="${triggerLabel}"]`);
      if (trigger && trigger.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onScroll() { onClose(); }

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose, title]);

  if (typeof document === 'undefined') return null;

  const POPOVER_WIDTH = 240;
  const left = Math.max(
    8,
    Math.min(anchor.left - 8, window.innerWidth - POPOVER_WIDTH - 8),
  );
  const top = anchor.bottom + 6;

  return createPortal(
    <div
      ref={popoverRef}
      role="menu"
      style={{
        position: 'fixed',
        top, left,
        width: POPOVER_WIDTH,
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 10,
        boxShadow: '0 10px 30px rgba(58,48,40,0.14)',
        zIndex: 600,
        padding: 6,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 8px 4px',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          color: 'var(--color-text-muted)',
        }}>
          Filter by {title.toLowerCase()}
        </span>
        {selected.size > 0 && (
          <button
            onClick={onClear}
            style={{
              background: 'transparent', border: 'none', padding: 0,
              color: 'var(--color-accent-active)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {options.length === 0 ? (
          <div style={{
            padding: '12px 8px', fontSize: 12,
            color: 'var(--color-text-muted)',
          }}>
            Nothing to filter.
          </div>
        ) : (
          options.map((o) => {
            const isOn = selected.has(o);
            return (
              <button
                key={o}
                onClick={() => onToggle(o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%',
                  padding: '7px 8px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13, fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  textAlign: 'left',
                  fontFamily: 'var(--font-primary)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: 4,
                  border: '1.5px solid ' + (isOn ? 'var(--color-accent-active)' : 'var(--color-border)'),
                  background: isOn ? 'var(--color-accent-active)' : '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.12s',
                }}>
                  {isOn && <Check size={9} strokeWidth={3.5} color="#fff" />}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body,
  );
}

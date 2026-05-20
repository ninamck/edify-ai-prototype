'use client';

/**
 * MatchPicker — inline dropdown list anchored under whichever button
 * opened it. Used by the Item matching page's "Match to…" trigger in the
 * Linked target column and by the "Change link" button in the actions
 * column.
 *
 * The caller is responsible for wrapping its trigger in a relatively
 * positioned container; this component renders absolutely-positioned just
 * under it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Link2, Package, Boxes } from 'lucide-react';
import { useRecipes } from '@/components/Recipe/recipeStore';
import { useProducts, useMasterProducts, useSuppliers } from '@/components/Suppliers/store';
import { setMatchTarget, type MatchTarget, type MatchTargetType } from './overrideStore';

type Row = {
  type: MatchTargetType;
  id: string;
  name: string;
  sub: string;
};

export function MatchPicker({
  posItemId,
  currentTarget,
  onClose,
  align = 'left',
}: {
  posItemId: string;
  /** Reserved — keep for parity with the previous modal API. */
  posItemName?: string;
  currentTarget?: MatchTarget;
  onClose: () => void;
  /** Which edge of the dropdown aligns to the trigger. */
  align?: 'left' | 'right';
}) {
  const recipes = useRecipes();
  const products = useProducts();
  const masters = useMasterProducts();
  const suppliers = useSuppliers();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus search on open; close on Escape; close on outside click
  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onPointerDown(e: MouseEvent) {
      const panel = panelRef.current;
      if (!panel) return;
      if (panel.contains(e.target as Node)) return;
      // Allow clicks on the original trigger to toggle (Row handles that);
      // for any other outside click, close.
      onClose();
    }
    window.addEventListener('keydown', onKey);
    // Defer pointer-down listener so the click that opened us doesn't close us.
    const t = window.setTimeout(() => {
      window.addEventListener('mousedown', onPointerDown);
    }, 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [onClose]);

  const supplierName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of suppliers) m.set(s.id, s.shortCode || s.name);
    return m;
  }, [suppliers]);

  const allRows = useMemo<Row[]>(() => {
    const recipeRows: Row[] = recipes
      .filter((r) => r.status !== 'Archived')
      .map((r) => ({
        type: 'recipe' as const,
        id: r.id,
        name: r.name,
        sub: r.category,
      }));
    const productRows: Row[] = products.map((p) => ({
      type: 'product' as const,
      id: p.id,
      name: p.name,
      sub: p.source === 'made'
        ? 'Made in-house'
        : supplierName.get(p.supplierId) ?? 'Supplier',
    }));
    const masterRows: Row[] = masters.map((m) => ({
      type: 'master-product' as const,
      id: m.id,
      name: m.name,
      sub: m.unit,
    }));
    return [...recipeRows, ...productRows, ...masterRows];
  }, [recipes, products, masters, supplierName]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) =>
      r.name.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q),
    );
  }, [allRows, query]);

  const grouped = useMemo(() => ({
    recipe: filtered.filter((r) => r.type === 'recipe'),
    product: filtered.filter((r) => r.type === 'product'),
    'master-product': filtered.filter((r) => r.type === 'master-product'),
  }), [filtered]);

  function commit(row: Row) {
    setMatchTarget(posItemId, { type: row.type, id: row.id });
    onClose();
  }

  return (
    <div
      ref={panelRef}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        ...(align === 'right' ? { right: 0 } : { left: 0 }),
        width: 'min(420px, 92vw)',
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 12,
        boxShadow: '0 16px 32px -12px rgba(0, 28, 53, 0.28)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        maxHeight: 360,
        zIndex: 200,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div style={{
        padding: 10,
        borderBottom: '1px solid var(--color-border-subtle)',
        background: '#fff',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 8,
          background: '#FBFAF8',
          border: '1px solid var(--color-border-subtle)',
        }}>
          <Search size={14} color="var(--color-text-muted)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes, products, master products…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'var(--font-primary)', fontSize: 13,
              color: 'var(--color-text-primary)',
            }}
          />
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            No matches. Try a different search.
          </div>
        ) : (
          <>
            <Group
              label="Recipes"
              icon={<Link2 size={12} />}
              rows={grouped.recipe}
              currentTarget={currentTarget}
              onSelect={commit}
            />
            <Group
              label="Products"
              icon={<Package size={12} />}
              rows={grouped.product}
              currentTarget={currentTarget}
              onSelect={commit}
            />
            <Group
              label="Master products"
              icon={<Boxes size={12} />}
              rows={grouped['master-product']}
              currentTarget={currentTarget}
              onSelect={commit}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Group({
  label, icon, rows, currentTarget, onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  rows: Row[];
  currentTarget?: MatchTarget;
  onSelect: (row: Row) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px 4px',
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--color-text-muted)',
        background: '#FBFAF8',
        position: 'sticky', top: 0, zIndex: 1,
      }}>
        {icon}
        {label}
        <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: 0 }}>
          {rows.length}
        </span>
      </div>
      {rows.map((row) => {
        const selected = currentTarget?.type === row.type && currentTarget.id === row.id;
        return (
          <button
            key={`${row.type}-${row.id}`}
            onClick={() => onSelect(row)}
            style={{
              width: '100%', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px',
              border: 'none',
              borderBottom: '1px solid var(--color-border-subtle)',
              background: selected ? 'rgba(40, 175, 201, 0.10)' : '#fff',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {row.name}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {row.sub}
              </div>
            </div>
            {selected && (
              <span style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
                color: 'var(--color-accent-mid, #28AFC9)',
                textTransform: 'uppercase',
              }}>
                Current
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

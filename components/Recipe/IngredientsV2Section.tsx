'use client';

/**
 * Typed ingredient list section for the recipe editor.
 *
 * This is the "post-rethink" model: each row references a Master Product or
 * a Supplier / Made Product via a discriminated `ref`. The user picks
 * from a single unified search box that surfaces both kinds in one
 * ranked dropdown, so they never have to know up-front whether a master
 * product exists.
 *
 * Each row also supports per-site quantity overrides (problem 6 in the
 * recipes rethink — Site A uses 16g of coffee, Site B uses 18g, no recipe
 * fork required).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Plus, X, ArrowUp, ArrowDown, MapPin, Sparkles, Search, Check,
} from 'lucide-react';
import {
  useIngredientCatalogue,
  resolveIngredientRef,
  createMasterProductFromName,
  type IngredientCatalogueRow,
  type IngredientRef,
} from '@/components/Ingredients/catalogue';
import type {
  RecipeIngredient,
  RecipeIngredientQty,
} from './libraryFixtures';
import { lineCostGBP, formatLineCost } from './costing';

const UNITS = ['g', 'kg', 'ml', 'L', 'each', 'unit', 'slice', 'tsp', 'tbsp', 'cup'];

function newRowId(): string {
  return `ri-${Math.random().toString(36).slice(2, 8)}`;
}

export function IngredientsV2Section({
  rows, sites, onChange, itemLabel = 'ingredient',
}: {
  rows: RecipeIngredient[];
  /** Sites available on this recipe (drives the site-qty popover). */
  sites: string[];
  onChange: (next: RecipeIngredient[]) => void;
  /**
   * What kind of row this is, for copy purposes (column header, empty
   * state, add button, picker placeholder). The underlying data shape
   * and picker behaviour are identical — packaging is just-a-product,
   * same as an ingredient, so we share the picker and modifier-targeting
   * machinery.
   */
  itemLabel?: 'ingredient' | 'packaging';
}) {
  const labelSingular = itemLabel === 'packaging' ? 'packaging item' : 'ingredient';
  const labelPluralLower = itemLabel === 'packaging' ? 'packaging' : 'ingredients';
  const headerLabel = itemLabel === 'packaging' ? 'Packaging' : 'Ingredient';
  function update(id: string, patch: Partial<RecipeIngredient>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function remove(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }
  function move(id: string, dir: -1 | 1) {
    const i = rows.findIndex((r) => r.id === id);
    const t = i + dir;
    if (i < 0 || t < 0 || t >= rows.length) return;
    const next = [...rows];
    [next[i], next[t]] = [next[t], next[i]];
    onChange(next);
  }
  function add(ref: IngredientRef) {
    if (rows.some((r) => sameRef(r.ref, ref))) return;
    const resolved = resolveIngredientRef(ref);
    onChange([
      ...rows,
      {
        id: newRowId(),
        ref,
        baseQty: { value: 0, unit: resolved?.unit ?? 'g' },
      },
    ]);
  }

  return (
    <>
      <div style={tableHeaderStyle}>
        <span />
        <span>{headerLabel}</span>
        <span>Source</span>
        <span>Qty</span>
        <span>Unit</span>
        <span style={{ textAlign: 'right' }}>Cost</span>
        <span style={{ textAlign: 'center' }}>Site qty</span>
        <span />
      </div>

      {rows.length === 0 && (
        <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 13.5, color: 'var(--color-text-muted)' }}>
          No {labelPluralLower} yet. Search and add one below.
        </div>
      )}

      {rows.map((row, i) => (
        <IngredientV2Row
          key={row.id}
          row={row}
          index={i}
          total={rows.length}
          sites={sites}
          onPatch={(p) => update(row.id, p)}
          onRemove={() => remove(row.id)}
          onMoveUp={() => move(row.id, -1)}
          onMoveDown={() => move(row.id, 1)}
        />
      ))}

      <div style={{ marginTop: 10 }}>
        <UnifiedAddIngredient
          onPick={add}
          alreadyPickedRefs={rows.map((r) => r.ref)}
          buttonLabel={`Add ${labelSingular}`}
          placeholder={
            itemLabel === 'packaging'
              ? 'Search packaging (cups, lids, bags, labels)…'
              : 'Search ingredients (masters, supplier SKUs, sub-recipes)…'
          }
        />
      </div>
    </>
  );
}

function sameRef(a: IngredientRef, b: IngredientRef): boolean {
  if (a.kind === 'master' && b.kind === 'master') return a.masterProductId === b.masterProductId;
  if (a.kind === 'product' && b.kind === 'product') return a.productId === b.productId;
  if (a.kind === 'subrecipe' && b.kind === 'subrecipe') return a.recipeId === b.recipeId;
  return false;
}

function refKey(r: IngredientRef): string {
  if (r.kind === 'master') return r.masterProductId;
  if (r.kind === 'product') return r.productId;
  return r.recipeId;
}

// ────────────────────────────────────────────────────────────────────────────

function IngredientV2Row({
  row, index, total, sites, onPatch, onRemove, onMoveUp, onMoveDown,
}: {
  row: RecipeIngredient;
  index: number;
  total: number;
  sites: string[];
  onPatch: (p: Partial<RecipeIngredient>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const resolved = resolveIngredientRef(row.ref);
  const overrideCount = row.siteOverrides ? Object.keys(row.siteOverrides).length : 0;

  return (
    <div style={tableRowStyle}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'center' }}>
        {index + 1}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {resolved?.name ?? '(missing)'}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <KindChip ref={row.ref} resolved={resolved} />
      </span>
      <input
        type="number"
        min={0}
        step="any"
        value={row.baseQty.value}
        onChange={(e) => {
          const v = e.target.value;
          onPatch({ baseQty: { ...row.baseQty, value: v === '' ? 0 : Number(v) } });
        }}
        style={cellInput}
      />
      <select
        value={row.baseQty.unit}
        onChange={(e) => onPatch({ baseQty: { ...row.baseQty, unit: e.target.value } })}
        style={cellSelect}
      >
        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        {!UNITS.includes(row.baseQty.unit) && <option value={row.baseQty.unit}>{row.baseQty.unit}</option>}
      </select>
      <span
        title="Line cost — qty × current per-unit cost from the catalogue (WAC)"
        style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'right', whiteSpace: 'nowrap' }}
      >
        {formatLineCost(lineCostGBP(row))}
      </span>
      <SiteQtyPopover
        sites={sites}
        baseQty={row.baseQty}
        overrides={row.siteOverrides}
        overrideCount={overrideCount}
        onChange={(siteOverrides) => onPatch({ siteOverrides })}
      />
      <span style={{ display: 'inline-flex', gap: 2, justifyContent: 'flex-end' }}>
        <button onClick={onMoveUp} disabled={index === 0} aria-label="Move up" style={miniBtn(index === 0)}>
          <ArrowUp size={12} />
        </button>
        <button onClick={onMoveDown} disabled={index === total - 1} aria-label="Move down" style={miniBtn(index === total - 1)}>
          <ArrowDown size={12} />
        </button>
        <button onClick={onRemove} aria-label="Remove" style={miniBtn(false)}>
          <X size={12} />
        </button>
      </span>
    </div>
  );
}

function KindChip({ ref, resolved }: { ref: IngredientRef; resolved: ReturnType<typeof resolveIngredientRef> }) {
  if (ref.kind === 'master') {
    return <Chip tone="navy">Master</Chip>;
  }
  if (ref.kind === 'subrecipe') {
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1 }}>
        <Chip tone="green">Sub-recipe</Chip>
        {resolved?.subRecipe?.category && (
          <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
            {resolved.subRecipe.category}
          </span>
        )}
      </span>
    );
  }
  if (resolved?.productSource === 'made') {
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1 }}>
        <Chip tone="warm">Made</Chip>
        {resolved.product?.madeAtSite && (
          <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
            @ {resolved.product.madeAtSite.replace('PRET ', '')}
          </span>
        )}
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1 }}>
      <Chip tone="soft">{resolved?.product?.supplierId ? abbrevSupplier(resolved.product.supplierId) : 'Supplier'}</Chip>
      {resolved?.masterProductId && (
        <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
          → also in Master
        </span>
      )}
    </span>
  );
}

function abbrevSupplier(id: string): string {
  return id.replace(/^sup-/, '').slice(0, 12);
}

function Chip({ children, tone }: { children: React.ReactNode; tone: 'navy' | 'soft' | 'warm' | 'green' }) {
  const tones = {
    navy:  { bg: 'rgba(0, 28, 53,0.08)',   color: 'var(--color-accent-active)' },
    soft:  { bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' },
    warm:  { bg: 'rgba(241,180,52,0.18)', color: 'var(--color-warning)' },
    green: { bg: 'rgba(82,170,150,0.18)', color: 'var(--color-success, #347262)' },
  } as const;
  const t = tones[tone];
  return (
    <span style={{
      padding: '3px 8px', borderRadius: 100,
      background: t.bg, color: t.color,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>{children}</span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Site qty popover

function SiteQtyPopover({
  sites, baseQty, overrides, overrideCount, onChange,
}: {
  sites: string[];
  baseQty: RecipeIngredientQty;
  overrides: Record<string, RecipeIngredientQty> | undefined;
  overrideCount: number;
  onChange: (next: Record<string, RecipeIngredientQty> | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!ref.current?.contains(t)) setOpen(false);
    };
    const tid = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => { clearTimeout(tid); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  function setOverride(site: string, qty: number | '') {
    const next: Record<string, RecipeIngredientQty> = { ...(overrides ?? {}) };
    if (qty === '' || qty === baseQty.value) {
      delete next[site];
    } else {
      next[site] = { value: qty, unit: baseQty.unit };
    }
    onChange(Object.keys(next).length > 0 ? next : undefined);
  }
  function clearAll() {
    onChange(undefined);
  }

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', justifyContent: 'center' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={overrideCount > 0 ? `${overrideCount} site override${overrideCount === 1 ? '' : 's'}` : 'Set per-site quantities'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 9px', borderRadius: 100,
          border: '1px solid ' + (overrideCount > 0 ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'),
          background: overrideCount > 0 ? 'rgba(0, 28, 53,0.05)' : '#fff',
          color: overrideCount > 0 ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
          fontFamily: 'var(--font-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}
      >
        <MapPin size={12} />
        {overrideCount === 0 ? 'All sites' : `${overrideCount} site${overrideCount === 1 ? '' : 's'}`}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60,
            minWidth: 280, padding: 12, background: '#fff',
            border: '1px solid var(--color-border)', borderRadius: 10,
            boxShadow: '0 12px 32px rgba(3,15,58,0.16)',
            display: 'flex', flexDirection: 'column', gap: 8,
            fontFamily: 'var(--font-primary)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Per-site quantities
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 4 }}>
            Default: <strong style={{ color: 'var(--color-text-primary)' }}>{baseQty.value}{baseQty.unit}</strong>. Set a value below to override at that site.
          </div>
          {sites.map((site) => {
            const ov = overrides?.[site];
            const val = ov?.value ?? '';
            return (
              <div key={site} style={{ display: 'grid', gridTemplateColumns: '1fr 84px 36px', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site}</span>
                <input
                  type="number" step="any"
                  value={val}
                  placeholder={String(baseQty.value)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOverride(site, v === '' ? '' : Number(v));
                  }}
                  style={{
                    padding: '6px 9px', borderRadius: 6,
                    border: '1px solid var(--color-border-subtle)', background: '#fff',
                    fontFamily: 'var(--font-primary)', fontSize: 13, color: 'var(--color-text-primary)',
                    textAlign: 'right',
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{baseQty.unit}</span>
              </div>
            );
          })}
          {overrideCount > 0 && (
            <button
              onClick={clearAll}
              style={{
                marginTop: 4, padding: '6px 10px', borderRadius: 6,
                border: '1px solid var(--color-border-subtle)', background: '#fff',
                color: 'var(--color-text-secondary)',
                fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              Clear all overrides
            </button>
          )}
        </div>
      )}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Unified add-ingredient affordance + picker

function UnifiedAddIngredient({
  onPick, alreadyPickedRefs, buttonLabel = 'Add ingredient', placeholder = 'Search ingredients (master products + supplier SKUs)…',
}: {
  onPick: (ref: IngredientRef) => void;
  alreadyPickedRefs: IngredientRef[];
  buttonLabel?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);
  const { search } = useIngredientCatalogue();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!ref.current?.contains(t)) { setOpen(false); setQ(''); }
    };
    const tid = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => { clearTimeout(tid); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  const results: IngredientCatalogueRow[] = open ? search(q, { limit: 24 }) : [];
  const isPicked = (row: IngredientCatalogueRow) => alreadyPickedRefs.some((r) => {
    if (r.kind === 'master' && row.ref.kind === 'master') return r.masterProductId === row.ref.masterProductId;
    if (r.kind === 'product' && row.ref.kind === 'product') return r.productId === row.ref.productId;
    return false;
  });
  const exactMatch = results.some((r) => r.label.toLowerCase() === q.trim().toLowerCase());
  const showCreate = !!q.trim() && !exactMatch;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '9px 15px', borderRadius: 9,
            border: '1px dashed var(--color-border)', background: '#fff',
            color: 'var(--color-text-secondary)',
            fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer',
          }}
        >
          <Plus size={14} strokeWidth={2.2} /> {buttonLabel}
        </button>
      ) : (
        <div
          style={{
            background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10,
            boxShadow: '0 12px 32px rgba(3,15,58,0.12)', overflow: 'hidden',
            maxWidth: 560,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <Search size={15} color="var(--color-text-muted)" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: 'var(--font-primary)', fontSize: 14,
              }}
            />
            <button
              onClick={() => { setOpen(false); setQ(''); }}
              style={{
                padding: 4, border: 'none', background: 'transparent', cursor: 'pointer',
                color: 'var(--color-text-muted)',
              }}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
          <div style={{ maxHeight: 320, overflow: 'auto' }}>
            {results.map((row, i) => {
              const picked = isPicked(row);
              return (
                <button
                  key={`${row.ref.kind}:${refKey(row.ref)}-${i}`}
                  type="button"
                  disabled={picked}
                  onClick={() => { onPick(row.ref); setOpen(false); setQ(''); }}
                  style={{
                    width: '100%', padding: '9px 12px', border: 'none',
                    background: '#fff', cursor: picked ? 'not-allowed' : 'pointer', textAlign: 'left',
                    display: 'grid', gridTemplateColumns: '1fr auto', gap: 10,
                    alignItems: 'center', fontFamily: 'var(--font-primary)',
                    opacity: picked ? 0.5 : 1,
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {row.label}
                      {picked && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)' }}>· already added</span>}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {row.sublabel}
                      {row.kind === 'supplier' && row.hasMaster && (
                        <span style={{ marginLeft: 6, color: 'var(--color-text-muted)' }}>· → also in Master</span>
                      )}
                    </span>
                  </span>
                  <span style={pickerKindChip(row.kind)}>{row.kind === 'master' ? 'Master' : row.sourceLabel}</span>
                </button>
              );
            })}
            {results.length === 0 && !showCreate && (
              <div style={{ padding: 14, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                No matches. Type to search.
              </div>
            )}
            {showCreate && (
              <button
                type="button"
                onClick={() => {
                  const mp = createMasterProductFromName({ name: q.trim() });
                  onPick({ kind: 'master', masterProductId: mp.id });
                  setOpen(false); setQ('');
                }}
                style={{
                  width: '100%', padding: '12px 13px', border: 'none',
                  borderTop: results.length > 0 ? '1px solid var(--color-border-subtle)' : 'none',
                  background: 'rgba(0, 28, 53,0.04)', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-primary)',
                  color: 'var(--color-accent-active)', fontWeight: 700, fontSize: 13.5,
                }}
              >
                <Sparkles size={14} />
                Create new master product: <span style={{ fontWeight: 700 }}>"{q.trim()}"</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function pickerKindChip(kind: 'master' | 'supplier' | 'made' | 'subrecipe'): React.CSSProperties {
  const tones = {
    master:    { bg: 'rgba(0, 28, 53,0.08)',   color: 'var(--color-accent-active)' },
    supplier:  { bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' },
    made:      { bg: 'rgba(241,180,52,0.16)', color: 'var(--color-warning)' },
    subrecipe: { bg: 'rgba(82,170,150,0.18)', color: 'var(--color-success, #347262)' },
  } as const;
  const t = tones[kind];
  return {
    padding: '3px 9px', borderRadius: 100,
    background: t.bg, color: t.color,
    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Layout primitives matching the existing ComponentTable

const cols = ['28px', '2fr', '1.5fr', '78px', '78px', '64px', '128px', '82px'];

const tableHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: cols.join(' '),
  gap: 10,
  padding: '8px 12px',
  fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
};
const tableRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: cols.join(' '),
  gap: 10,
  alignItems: 'center',
  padding: '9px 12px',
  borderTop: '1px solid var(--color-border-subtle)',
};
const cellInput: React.CSSProperties = {
  width: '100%', padding: '7px 9px', borderRadius: 6,
  border: '1px solid var(--color-border-subtle)', background: '#fff',
  fontFamily: 'var(--font-primary)', fontSize: 13.5, color: 'var(--color-text-primary)',
};
const cellSelect: React.CSSProperties = { ...cellInput };
function miniBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 24, height: 24, padding: 0,
    borderRadius: 6, border: '1px solid var(--color-border-subtle)',
    background: '#fff', color: 'var(--color-text-secondary)',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
}

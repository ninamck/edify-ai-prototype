'use client';

import { useMemo, useRef, useState } from 'react';
import { Plus, Search, Sparkles, Check } from 'lucide-react';
import { useProducts } from '@/components/Suppliers/store';
import type { Product } from '@/components/Suppliers/fixtures';
import CardShell, { PillRow, type CardState } from './CardShell';

interface RecipeNewIngredientCardProps {
  /** Recipe name (subtitle context). */
  recipeName: string;
  /** When set, we're picking the "to" side of a swap. Otherwise it's a plain add. */
  swapFrom?: string;
  state: CardState;
  initialName?: string;
  initialQty?: number;
  initialUom?: string;
  onSubmit: (input: { name: string; qty?: number; uom?: string }) => void;
  onCancel: () => void;
}

const UOM_OPTIONS = ['g', 'ml', 'pcs', 'kg', 'l'];

/**
 * Step 4 of the Update-recipe wizard. The operator either picks an
 * existing product from the catalogue (typeahead) or chooses to
 * "create new" with a free-text name. Both paths feed the same
 * `onSubmit({ name, qty, uom })` shape so downstream logic doesn't
 * branch.
 *
 * Once a product is picked we collapse the picker into a confirmed
 * chip and surface the optional qty + UoM controls — qty defaults to
 * the product's natural unit when known.
 */
export default function RecipeNewIngredientCard({
  recipeName,
  swapFrom,
  state,
  initialName,
  initialQty,
  initialUom,
  onSubmit,
  onCancel,
}: RecipeNewIngredientCardProps) {
  const products = useProducts();

  // Two sub-modes for the selection:
  //   • picked  — selected an existing product
  //   • created — committed a brand-new name
  //   • null    — still searching
  type Selection =
    | { kind: 'picked'; product: Product }
    | { kind: 'created'; name: string };
  const [selection, setSelection] = useState<Selection | null>(
    initialName
      ? { kind: 'created', name: initialName }
      : null,
  );

  const [query, setQuery] = useState<string>(initialName ?? '');
  const [qty, setQty] = useState<string>(initialQty != null ? String(initialQty) : '');
  const [uom, setUom] = useState<string>(initialUom ?? 'g');
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo<Product[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 6);
    return products
      .filter((p) => p.status !== 'Archived')
      .filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [products, query]);

  const exactMatch = matches.find((p) => p.name.toLowerCase() === query.trim().toLowerCase());

  function pickProduct(p: Product) {
    setSelection({ kind: 'picked', product: p });
    setQuery(p.name);
    // Auto-pick a sensible default UoM from the product when the user
    // hasn't already started entering one.
    if (!uom || uom === 'g') {
      if (p.singleUnitType === 'kg' || p.singleUnitType === 'g') setUom('g');
      else if (p.singleUnitType === 'L' || p.singleUnitType === 'ml') setUom('ml');
      else if (p.singleUnitType === 'Each') setUom('pcs');
    }
  }
  function createNew(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSelection({ kind: 'created', name: trimmed });
  }
  function clearSelection() {
    setSelection(null);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const canSubmit = !!selection;
  const title = swapFrom ? `Swap ${swapFrom} for\u2026` : 'What would you like to add?';

  const selectedName = selection?.kind === 'picked' ? selection.product.name : selection?.name;

  return (
    <CardShell
      icon={Plus}
      title={title}
      subtitle={recipeName}
      state={state}
      confirmLabel={swapFrom ? 'Swap' : 'Add'}
      confirmDisabled={!canSubmit}
      onCancel={onCancel}
      onConfirm={() =>
        selection
          ? onSubmit({
              name: selectedName!,
              qty: qty.trim() ? Number(qty) : undefined,
              uom: qty.trim() ? uom : undefined,
            })
          : undefined
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* ── Selected chip ─────────────────────────────────────────── */}
        {selection ? (
          <div>
            <Label>Ingredient</Label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginTop: '6px',
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1.5px solid var(--color-accent-active, #001C35)',
                background: 'rgba(40,175,201,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '8px',
                    background: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {selection.kind === 'picked' ? (
                    <Check size={12} color="var(--color-accent-mid, #28AFC9)" strokeWidth={2.5} />
                  ) : (
                    <Sparkles size={12} color="var(--color-accent-mid, #28AFC9)" strokeWidth={2.2} />
                  )}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selectedName}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {selection.kind === 'picked'
                      ? `From catalogue · ${selection.product.category}`
                      : 'New ingredient — not in catalogue yet'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={state !== 'pending'}
                onClick={clearSelection}
                style={{
                  padding: '4px 10px',
                  borderRadius: '100px',
                  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                  background: '#fff',
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--color-text-secondary)',
                  cursor: state === 'pending' ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                }}
              >
                Change
              </button>
            </div>
          </div>
        ) : (
          // ── Picker (search + list + create-new footer) ────────────
          <div>
            <Label>Pick from list or create new</Label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '6px',
                padding: '8px 10px',
                borderRadius: '10px',
                border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                background: '#fff',
              }}
            >
              <Search size={14} color="var(--color-text-muted)" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                disabled={state !== 'pending'}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ingredients…"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && query.trim() && !exactMatch) {
                    e.preventDefault();
                    createNew(query);
                  }
                }}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            <div
              style={{
                marginTop: '8px',
                borderRadius: '10px',
                border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
                overflow: 'hidden',
                maxHeight: '220px',
                overflowY: 'auto',
              }}
            >
              {matches.length === 0 && (
                <div
                  style={{
                    padding: '12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--color-text-muted)',
                    textAlign: 'center',
                  }}
                >
                  No matches in the catalogue.
                </div>
              )}
              {matches.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={state !== 'pending'}
                  onClick={() => pickProduct(p)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '9px 12px',
                    border: 'none',
                    borderBottom:
                      i < matches.length - 1
                        ? '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))'
                        : 'none',
                    background: 'transparent',
                    cursor: state === 'pending' ? 'pointer' : 'not-allowed',
                    textAlign: 'left',
                    fontFamily: 'var(--font-primary)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(40,175,201,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        color: 'var(--color-text-muted)',
                        marginTop: '2px',
                      }}
                    >
                      {p.category}
                      {p.unitOfMeasure ? ` · ${p.unitOfMeasure}` : ''}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    Pick
                  </span>
                </button>
              ))}
            </div>

            {/* Create-new footer — surfaces when the typed text isn't
                an exact existing product (or when nothing matches). */}
            {query.trim() && !exactMatch && (
              <button
                type="button"
                disabled={state !== 'pending'}
                onClick={() => createNew(query)}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  gap: '10px',
                  marginTop: '8px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px dashed var(--color-accent-mid, #28AFC9)',
                  background: 'rgba(40,175,201,0.04)',
                  cursor: state === 'pending' ? 'pointer' : 'not-allowed',
                  textAlign: 'left',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                <Sparkles size={14} color="var(--color-accent-mid, #28AFC9)" strokeWidth={2.2} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Use &ldquo;{query.trim()}&rdquo; as a new ingredient
                </span>
              </button>
            )}
          </div>
        )}

        {/* ── Optional qty + UoM (shown once a selection exists) ──── */}
        {selection && (
          <div>
            <Label>
              Quantity{' '}
              <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--color-text-muted)' }}>
                (optional)
              </span>
            </Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <input
                type="number"
                value={qty}
                disabled={state !== 'pending'}
                onChange={(e) => setQty(e.target.value)}
                placeholder="—"
                style={{
                  width: '90px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--color-text-primary)',
                  background: '#fff',
                  outline: 'none',
                  textAlign: 'center',
                }}
              />
              <PillRow
                options={UOM_OPTIONS.map((u) => ({ value: u, label: u }))}
                selected={uom}
                onSelect={setUom}
                disabled={state !== 'pending' || !qty.trim()}
                small
              />
            </div>
          </div>
        )}
      </div>
    </CardShell>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
      }}
    >
      {children}
    </span>
  );
}

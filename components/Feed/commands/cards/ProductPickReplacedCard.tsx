'use client';

import { useMemo, useRef, useState } from 'react';
import { Search, Repeat, Check } from 'lucide-react';
import { useProducts, findSupplier } from '@/components/Suppliers/store';
import type { Product } from '@/components/Suppliers/fixtures';
import CardShell, { type CardState } from './CardShell';

interface ProductPickReplacedCardProps {
  state: CardState;
  /** Name of the new product the operator is bringing in — used as a
   *  subtitle so the picker reads "Which product is {newName}
   *  replacing?". */
  newProductName: string;
  /** Optional hint from the NL parser ("replace whole milk with…"). */
  initialQuery?: string;
  onPick: (input: {
    oldProductId: string;
    oldProductName: string;
    oldCategory: string;
    oldPackType: 'Pack' | 'Single';
    oldUnitType: Product['singleUnitType'];
  }) => void;
  onCancel: () => void;
}

/**
 * Step 3 of the Replace-a-product wizard. The operator picks the
 * existing product the new one is replacing. The picker is a
 * searchable list of all active products, grouped visually by
 * category. The selection drives downstream behaviour:
 *
 *   • The pack-details step pre-fills category / pack type / UoM
 *     from this product, so the operator usually just confirms.
 *   • The recipe-selection step scans recipes for this product
 *     (legacy free-text and v2 typed refs) to pre-populate the swap
 *     list.
 */
export default function ProductPickReplacedCard({
  state,
  newProductName,
  initialQuery,
  onPick,
  onCancel,
}: ProductPickReplacedCardProps) {
  const products = useProducts();
  const [query, setQuery] = useState<string>(initialQuery ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo<Product[]>(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => p.status !== 'Unavailable');
    if (!q) return list.slice(0, 8);
    return list
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .slice(0, 12);
  }, [products, query]);

  return (
    <CardShell
      icon={Repeat}
      title={`Which product is ${newProductName} replacing?`}
      subtitle="Step 3 of 4 — pick the existing item"
      state={state}
      // Confirmation happens via row-click directly; CardShell's
      // confirm button is hidden by omitting onConfirm.
      onCancel={onCancel}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
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
            placeholder="Search by product, category, or tag…"
            autoFocus
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
            borderRadius: '10px',
            border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
            overflow: 'hidden',
            maxHeight: '260px',
            overflowY: 'auto',
          }}
        >
          {matches.length === 0 && (
            <div
              style={{
                padding: '14px',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                textAlign: 'center',
              }}
            >
              No matches in the product catalogue.
            </div>
          )}
          {matches.map((p, i) => {
            const supplier = findSupplier(p.supplierId);
            return (
              <button
                key={p.id}
                type="button"
                disabled={state !== 'pending'}
                onClick={() =>
                  onPick({
                    oldProductId: p.id,
                    oldProductName: p.name,
                    oldCategory: p.category,
                    oldPackType: p.packType,
                    oldUnitType: p.singleUnitType,
                  })
                }
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '10px 12px',
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
                    {supplier ? ` · ${supplier.shortCode ?? supplier.name}` : ''}
                    {p.unitOfMeasure ? ` · ${p.unitOfMeasure}` : ''}
                  </div>
                </div>
                <Check
                  size={14}
                  color="var(--color-text-muted)"
                  strokeWidth={2}
                  style={{ flexShrink: 0 }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </CardShell>
  );
}

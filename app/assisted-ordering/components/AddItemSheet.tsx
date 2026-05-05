'use client';

import { useState, useMemo } from 'react';
import { INGREDIENTS, SUPPLIER_PRODUCTS, SUPPLIERS } from '../data/mockOrders';
import type { Ingredient, SupplierProduct } from '../types';
import QtyControl from './QtyControl';

type Step = 'ingredient' | 'supplier' | 'quantity';

interface Props {
  onClose: () => void;
  onAdd: (ingredientId: string, supplierId: string, qty: number) => void;
  existingSupplierIds: string[];
}

export default function AddItemSheet({ onClose, onAdd, existingSupplierIds }: Props) {
  const [step, setStep] = useState<Step>('ingredient');
  const [search, setSearch] = useState('');
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<SupplierProduct | null>(null);
  const [qty, setQty] = useState(1);

  const filteredIngredients = useMemo(() => {
    if (!search.trim()) return INGREDIENTS;
    const q = search.toLowerCase();
    return INGREDIENTS.filter(
      (i) => i.name.toLowerCase().includes(q) || i.variant.toLowerCase().includes(q),
    );
  }, [search]);

  const availableProducts = useMemo(() => {
    if (!selectedIngredient) return [];
    return SUPPLIER_PRODUCTS.filter(
      (p) => p.ingredientId === selectedIngredient.id && p.available,
    );
  }, [selectedIngredient]);

  const selectedSupplier = selectedProduct
    ? SUPPLIERS.find((s) => s.id === selectedProduct.supplierId) ?? null
    : null;

  function reset() {
    setStep('ingredient');
    setSearch('');
    setSelectedIngredient(null);
    setSelectedProduct(null);
    setQty(1);
  }

  function handleBack() {
    if (step === 'supplier') { setStep('ingredient'); setSelectedProduct(null); }
    else if (step === 'quantity') { setStep('supplier'); setSelectedProduct(null); setQty(1); }
  }

  function handleSelectIngredient(ingredient: Ingredient) {
    setSelectedIngredient(ingredient);
    setSelectedProduct(null);
    setQty(1);
    setStep('supplier');
  }

  function handleSelectProduct(product: SupplierProduct) {
    setSelectedProduct(product);
    setQty(1);
    setStep('quantity');
  }

  function handleConfirm() {
    if (!selectedIngredient || !selectedProduct) return;
    onAdd(selectedIngredient.id, selectedProduct.supplierId, qty);
    reset();
    onClose();
  }

  const total = selectedProduct ? qty * selectedProduct.unitCost : 0;
  const isNewSupplier =
    selectedProduct ? !existingSupplierIds.includes(selectedProduct.supplierId) : false;

  // ── Header breadcrumb ──────────────────────────────────────────────────────

  const breadcrumb = step === 'ingredient'
    ? 'Search for an ingredient'
    : step === 'supplier'
      ? selectedIngredient?.name
      : `${selectedIngredient?.name} — ${selectedSupplier?.name}`;

  return (
    <div
      style={{
        borderRadius: 'var(--radius-card)',
        border: '1.5px solid var(--color-accent-active)',
        background: 'var(--color-bg-surface)',
        boxShadow: '0 4px 20px rgba(58,48,40,0.10)',
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          {step !== 'ingredient' && (
            <button
              type="button"
              onClick={handleBack}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-secondary)',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '0 4px 0 0',
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ←
            </button>
          )}
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {breadcrumb}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['ingredient', 'supplier', 'quantity'] as Step[]).map((s, i) => (
              <span
                key={s}
                style={{
                  width: '20px',
                  height: '3px',
                  borderRadius: '2px',
                  background:
                    s === step
                      ? 'var(--color-accent-active)'
                      : i < (['ingredient', 'supplier', 'quantity'] as Step[]).indexOf(step)
                        ? 'var(--color-accent-active)'
                        : 'var(--color-border)',
                  opacity: s === step ? 1 : i < (['ingredient', 'supplier', 'quantity'] as Step[]).indexOf(step) ? 0.5 : 0.3,
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary)',
              fontSize: '14px',
              cursor: 'pointer',
              padding: '2px 4px',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* ── Step 1: ingredient search ────────────────────────────────────────── */}
      {step === 'ingredient' && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            autoFocus
            type="text"
            placeholder="Search ingredients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 'var(--radius-item)',
              border: '1.5px solid var(--color-border)',
              background: 'var(--color-bg-surface)',
              fontSize: '13px',
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              maxHeight: '280px',
              overflowY: 'auto',
            }}
          >
            {filteredIngredients.map((ingredient) => (
              <button
                key={ingredient.id}
                type="button"
                onClick={() => handleSelectIngredient(ingredient)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-item)',
                  border: '1px solid var(--color-border-subtle)',
                  background: 'var(--color-bg-surface)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.1s ease',
                  gap: '12px',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-surface)';
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-primary)' }}>
                    {ingredient.name}
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-primary)' }}>
                    {ingredient.variant}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-primary)' }}>
                    {ingredient.currentStock}{ingredient.stockUnit}
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-primary)' }}>
                    in stock
                  </p>
                </div>
              </button>
            ))}

            {filteredIngredients.length === 0 && (
              <p style={{ margin: '16px 0', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-primary)' }}>
                No results for &ldquo;{search}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2: supplier selection ───────────────────────────────────────── */}
      {step === 'supplier' && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {availableProducts.length === 0 ? (
            <p style={{ margin: '16px 0', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-primary)' }}>
              No suppliers carry this ingredient.
            </p>
          ) : (
            availableProducts.map((product) => {
              const supplier = SUPPLIERS.find((s) => s.id === product.supplierId);
              if (!supplier) return null;
              const isNew = !existingSupplierIds.includes(supplier.id);
              return (
                <button
                  key={product.supplierId}
                  type="button"
                  onClick={() => handleSelectProduct(product)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-card)',
                    border: isNew
                      ? '1.5px solid rgba(146,64,14,0.30)'
                      : '1.5px solid var(--color-border-subtle)',
                    background: isNew ? 'rgba(146,64,14,0.03)' : 'var(--color-bg-surface)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'border-color 0.12s ease, background 0.12s ease',
                    gap: '12px',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = 'var(--color-accent-active)';
                    el.style.background = 'var(--color-bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = isNew ? 'rgba(146,64,14,0.30)' : 'var(--color-border-subtle)';
                    el.style.background = isNew ? 'rgba(146,64,14,0.03)' : 'var(--color-bg-surface)';
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-primary)' }}>
                        {supplier.name}
                      </p>
                      {isNew ? (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#92400E', fontFamily: 'var(--font-primary)', letterSpacing: '0.04em' }}>
                          NOT ON THIS ORDER
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-accent-active)', fontFamily: 'var(--font-primary)' }}>
                          On this order
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-primary)' }}>
                      {product.unitName} · 📦 {supplier.deliveryDate} · cutoff {supplier.cutOffTime}
                    </p>
                    {isNew && (
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#92400E', fontFamily: 'var(--font-primary)' }}>
                        This will add a new supplier to your order
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-primary)' }}>
                      £{product.unitCost}
                    </p>
                    <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-primary)' }}>
                      per {product.unitName}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* ── Step 3: quantity ─────────────────────────────────────────────────── */}
      {step === 'quantity' && selectedIngredient && selectedProduct && selectedSupplier && (
        <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Product context */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-item)',
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border-subtle)',
              fontSize: '12px',
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <span>{selectedProduct.unitName}</span>
            <span>·</span>
            <span>£{selectedProduct.unitCost} each</span>
            <span>·</span>
            <span>📦 {selectedSupplier.deliveryDate}</span>
            <span>·</span>
            <span>cutoff {selectedSupplier.cutOffTime}</span>
            {isNewSupplier && (
              <>
                <span>·</span>
                <span style={{ color: '#92400E', fontWeight: 600 }}>New supplier on order</span>
              </>
            )}
          </div>

          {/* Qty + total row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <QtyControl value={qty} onChange={setQty} min={1} label={selectedIngredient.name} />
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-primary)' }}>
                {selectedProduct.unitName}
              </span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-primary)' }}>
                £{total.toFixed(0)}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-primary)' }}>
                {(qty * selectedProduct.unitSize).toFixed(1)}{selectedIngredient.stockUnit} ·{' '}
                {selectedIngredient.currentStock}{selectedIngredient.stockUnit} stock →{' '}
                <strong style={{ color: 'var(--color-text-primary)' }}>
                  {(selectedIngredient.currentStock + qty * selectedProduct.unitSize).toFixed(1)}
                  {selectedIngredient.stockUnit}
                </strong>
              </p>
            </div>
          </div>

          {/* Confirm */}
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              padding: '11px',
              borderRadius: 'var(--radius-card)',
              border: 'none',
              background: '#15803D',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(21,128,61,0.22)',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#166534'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#15803D'; }}
          >
            Add to order — £{total.toFixed(0)}
          </button>
        </div>
      )}
    </div>
  );
}

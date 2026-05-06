'use client';

import { type Product, type Supplier, formatPrice } from './fixtures';
import { Checkbox, Dash, RowQuinnButton, SmallButton, StatusPill } from './Primitives';
import { TrendingUp, AlertTriangle } from 'lucide-react';

const COLUMNS_WITH_SUPPLIER = '32px 2fr 90px 1fr 70px 80px 90px 80px 110px 110px';
const COLUMNS_NO_SUPPLIER   = '32px 2fr 90px 1fr 70px 80px 90px 110px 110px';

export default function ProductsTable({
  products,
  suppliers,
  selectedIds,
  onToggleSelect,
  onOpenProduct,
  onAskQuinn,
  showSupplierColumn = false,
}: {
  products: Product[];
  suppliers: Supplier[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpenProduct: (id: string) => void;
  onAskQuinn: (productId: string) => void;
  showSupplierColumn?: boolean;
}) {
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const cols = showSupplierColumn ? COLUMNS_WITH_SUPPLIER : COLUMNS_NO_SUPPLIER;

  return (
    <div style={{
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 14,
      overflow: 'hidden',
      background: '#fff',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: cols,
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
        <span />
        <span>Name</span>
        <span>Class</span>
        <span>Category</span>
        <span>Pack qty</span>
        <span>UoM</span>
        <span>Price</span>
        {showSupplierColumn && <span>Supplier</span>}
        <span>Status</span>
        <span style={{ textAlign: 'right' }}>Actions</span>
      </div>

      {products.length === 0 && (
        <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          No products match your filters.
        </div>
      )}

      {products.map((p) => {
        const selected = selectedIds.has(p.id);
        const supplier = supplierMap.get(p.supplierId);
        return (
          <div
            key={p.id}
            onClick={() => onOpenProduct(p.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: cols,
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
            <Checkbox checked={selected} onClick={() => onToggleSelect(p.id)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{
                fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {p.name}
              </span>
              {p.flag && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--color-warning)',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <AlertTriangle size={11} strokeWidth={2.4} /> {p.flag.label}
                </span>
              )}
            </div>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{p.productClass}</span>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{p.category}</span>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{p.packQty.toLocaleString()}</span>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
              {p.unitOfMeasure
                ? (p.singleUnitVolumeOrWeight
                    ? `${p.singleUnitVolumeOrWeight.toLocaleString()} ${p.unitOfMeasure}`
                    : p.unitOfMeasure)
                : <Dash />}
            </span>
            <span style={{
              fontSize: 12.5, color: 'var(--color-text-primary)', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {formatPrice(p.packCost)}
              <TrendingUp size={11} color="var(--color-text-muted)" strokeWidth={2} />
            </span>
            {showSupplierColumn && (
              <span style={{
                fontSize: 12, color: 'var(--color-text-secondary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {supplier?.name ?? '—'}
              </span>
            )}
            <StatusPill status={p.status} />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <RowQuinnButton onClick={() => onAskQuinn(p.id)} ariaLabel={`Ask Quinn about ${p.name}`} />
              <SmallButton label="Edit" onClick={() => onOpenProduct(p.id)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

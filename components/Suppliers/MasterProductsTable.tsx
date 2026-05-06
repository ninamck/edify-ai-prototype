'use client';

import { useRouter } from 'next/navigation';
import { type MasterProduct, type Product, formatPrice } from './fixtures';
import { Checkbox, RowQuinnButton, SmallButton, Dash } from './Primitives';

const COLUMNS = '32px 2fr 1fr 1fr 110px 110px 90px';

export default function MasterProductsTable({
  masters,
  products,
  selectedIds,
  onToggleSelect,
  onAskQuinn,
}: {
  masters: MasterProduct[];
  products: Product[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onAskQuinn: (masterId: string) => void;
}) {
  const router = useRouter();
  return (
    <div style={{
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 14,
      overflow: 'hidden',
      background: '#fff',
    }}>
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
        <span />
        <span>Master product</span>
        <span>Category</span>
        <span>Reference unit</span>
        <span>Suppliers</span>
        <span>Best price</span>
        <span style={{ textAlign: 'right' }}>Actions</span>
      </div>

      {masters.length === 0 && (
        <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          No master products yet. Quinn can create one for any product to start comparing across suppliers.
        </div>
      )}

      {masters.map((m) => {
        const linked = products.filter((p) => p.masterProductId === m.id);
        const supplierCount = new Set(linked.map((p) => p.supplierId)).size;
        const bestPrice = linked.length > 0
          ? Math.min(...linked.map((p) => p.packCost))
          : null;
        const selected = selectedIds.has(m.id);
        return (
          <div
            key={m.id}
            onClick={() => router.push(`/suppliers/master-products/${m.id}`)}
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
            <Checkbox checked={selected} onClick={() => onToggleSelect(m.id)} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {m.name}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{m.category}</span>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{m.unit}</span>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              {supplierCount === 0 ? <Dash /> : `${supplierCount} (${linked.length} SKU${linked.length === 1 ? '' : 's'})`}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-primary)', fontWeight: 600 }}>
              {bestPrice === null ? <Dash /> : formatPrice(bestPrice)}
            </span>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <RowQuinnButton onClick={() => onAskQuinn(m.id)} ariaLabel={`Ask Quinn about ${m.name}`} />
              <SmallButton label="Compare" onClick={() => router.push(`/suppliers/master-products/${m.id}`)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

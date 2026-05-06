'use client';

import { useRouter } from 'next/navigation';
import { Edit3 } from 'lucide-react';
import { type Supplier, type Product } from './fixtures';
import { Checkbox, RowQuinnButton, StatusPill, SmallButton } from './Primitives';

const COLUMNS = '32px 2fr 1.4fr 70px 80px 110px 90px';

export default function SuppliersTable({
  suppliers,
  products,
  selectedIds,
  onToggleSelect,
  onOpenSupplier,
  onAskQuinn,
}: {
  suppliers: Supplier[];
  products: Product[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpenSupplier: (id: string) => void;
  onAskQuinn: (supplierId: string) => void;
}) {
  const router = useRouter();
  const productsBySupplier = (id: string) => products.filter((p) => p.supplierId === id).length;

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
        <span>Supplier name</span>
        <span>Categories</span>
        <span>Sites</span>
        <span>Products</span>
        <span>Status</span>
        <span style={{ textAlign: 'right' }}>Actions</span>
      </div>

      {suppliers.length === 0 && (
        <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          No suppliers match your filters.
        </div>
      )}

      {suppliers.map((s) => {
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

void Edit3;

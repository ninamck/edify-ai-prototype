'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { type MasterProduct, type Product, type SupplierStatus, masterCompanyAvg } from './fixtures';
import { Checkbox } from './Primitives';

const COLUMNS = '32px 2.2fr 130px 1fr 1.4fr 130px';

function MasterStatusPill({ status }: { status?: SupplierStatus }) {
  const s = status ?? 'Available';
  const map: Record<SupplierStatus, { label: string; bg: string; color: string; border: string }> = {
    Available: { label: 'Active', bg: 'var(--color-success-light)', color: 'var(--color-success)', border: 'var(--color-success-border)' },
    Unavailable: { label: 'Suspended', bg: 'var(--color-error-light)', color: 'var(--color-error)', border: 'var(--color-error-border)' },
    Pending: { label: 'Pending', bg: 'var(--color-warning-light)', color: 'var(--color-warning)', border: 'var(--color-warning-border)' },
  };
  const c = map[s];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '3px 12px', borderRadius: 100,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  );
}

export default function MasterProductsTable({
  masters,
  products,
  selectedIds,
  onToggleSelect,
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
        padding: '12px 16px',
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
        <span style={{ textAlign: 'center' }}>Status</span>
        <span>Class</span>
        <span>Category</span>
        <span style={{ textAlign: 'right' }}>Action</span>
      </div>

      {masters.length === 0 && (
        <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          No master products yet. Create one to normalise SKUs across suppliers.
        </div>
      )}

      {masters.map((m) => {
        const linked = products.filter((p) => p.masterProductId === m.id);
        // "Needs attention" when there's nothing to cost against yet — no
        // linked supplier SKUs, or no real (non-estimated) weighted-average
        // cost recorded on any site.
        const needsAttention = linked.length === 0 || masterCompanyAvg(m) === null;
        const selected = selectedIds.has(m.id);
        return (
          <div
            key={m.id}
            onClick={() => router.push(`/suppliers/master-products/${m.id}`)}
            style={{
              display: 'grid',
              gridTemplateColumns: COLUMNS,
              gap: 14,
              padding: '14px 16px',
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
            <span style={{ textAlign: 'center' }}>
              <MasterStatusPill status={m.status} />
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
              {m.productClass ?? 'Food'}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{m.category}</span>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
              {needsAttention && (
                <AlertTriangle size={14} color="var(--color-warning)" aria-label="Needs attention" />
              )}
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/suppliers/master-products/${m.id}`); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-accent-deep)', fontSize: 13, fontWeight: 600,
                  fontFamily: 'var(--font-primary)', padding: 0,
                }}
              >
                View details
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

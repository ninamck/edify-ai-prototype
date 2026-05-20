'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, TrendingDown, AlertTriangle } from 'lucide-react';
import {
  useSuppliers, useProducts, useMasterProducts,
} from '@/components/Suppliers/store';
import { formatPrice } from '@/components/Suppliers/fixtures';
import { StatusPill, RowQuinnButton } from '@/components/Suppliers/Primitives';
import QuinnSheet, { type QuinnScope } from '@/components/Suppliers/QuinnSheet';

export default function MasterProductDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const masterProducts = useMasterProducts();
  const products = useProducts();
  const suppliers = useSuppliers();

  const master = masterProducts.find((m) => m.id === id);
  const linked = useMemo(() => products.filter((p) => p.masterProductId === id), [products, id]);

  const [quinn, setQuinn] = useState<{ open: boolean; scope: QuinnScope | null }>({ open: false, scope: null });

  if (!master) {
    return (
      <div style={{ padding: 40, fontFamily: 'var(--font-primary)' }}>
        <button onClick={() => router.push('/suppliers')} style={backBtnStyle}>
          <ArrowLeft size={14} /> Back
        </button>
        <p>Master product not found.</p>
      </div>
    );
  }

  const sorted = [...linked].sort((a, b) => unitCost(a) - unitCost(b));
  const cheapest = sorted[0];
  const cheapestUnit = cheapest ? unitCost(cheapest) : null;
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

  return (
    <div style={{
      padding: '20px clamp(20px, 3vw, 40px) 80px',
      maxWidth: 1180, margin: '0 auto',
      fontFamily: 'var(--font-primary)',
    }}>
      <button onClick={() => router.push('/suppliers')} style={backBtnStyle}>
        <ArrowLeft size={14} /> Back to suppliers
      </button>

      <div style={{
        marginTop: 8, padding: '18px 20px',
        borderRadius: 14, border: '1px solid var(--color-border-subtle)', background: '#fff',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            color: 'var(--color-accent-active)',
          }}>
            MASTER PRODUCT
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            {master.name}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {master.category} \u00b7 {master.unit}
          </div>
          <div style={{ flex: 1 }} />
          {linked.length >= 2 && cheapest && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px',
              borderRadius: 999,
              background: '#ffffff',
              border: '1.5px solid var(--color-success)',
              color: 'var(--color-success)',
              fontSize: 12, fontWeight: 700,
            }}>
              <TrendingDown size={12} /> Cheapest: {supplierMap.get(cheapest.supplierId)?.name}
            </span>
          )}
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div style={{ marginTop: 16 }}>
        <h2 style={{
          fontSize: 14, fontWeight: 700, margin: '0 0 8px',
          color: 'var(--color-text-primary)',
        }}>
          {linked.length} supplier SKU{linked.length === 1 ? '' : 's'} linked
        </h2>
        {linked.length === 0 ? (
          <div style={{
            padding: 24, borderRadius: 12,
            background: 'var(--color-bg-hover)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-muted)',
            fontSize: 13, textAlign: 'center',
          }}>
            No supplier products are linked to this Master Product yet.
          </div>
        ) : (
          <div style={{
            display: 'grid', gap: 10,
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          }}>
            {sorted.map((p) => {
              const supplier = supplierMap.get(p.supplierId);
              const u = unitCost(p);
              const deltaPct = cheapestUnit && cheapestUnit > 0 ? ((u - cheapestUnit) / cheapestUnit) * 100 : 0;
              const isCheapest = p.id === cheapest?.id;
              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/suppliers/products/${p.id}`)}
                  style={{
                    border: '1px solid ' + (isCheapest ? 'var(--color-success-border)' : 'var(--color-border-subtle)'),
                    background: isCheapest ? 'var(--color-success-light)' : '#fff',
                    borderRadius: 14,
                    padding: 14,
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 10,
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                        {supplier?.name ?? '\u2014'}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 2 }}>
                        {p.name}
                      </div>
                    </div>
                    <StatusPill status={p.status} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                        Per unit
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {formatPrice(u)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        Pack {formatPrice(p.packCost)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {p.packQty.toLocaleString()} per pack
                      </div>
                    </div>
                  </div>
                  {!isCheapest && deltaPct > 0 && (
                    <div style={{
                      fontSize: 11, fontWeight: 700,
                      color: deltaPct > 10 ? 'var(--color-warning)' : 'var(--color-text-muted)',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      {deltaPct > 10 && <AlertTriangle size={11} />}
                      +{deltaPct.toFixed(1)}% vs cheapest
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <RowQuinnButton
                      onClick={() => setQuinn({ open: true, scope: { kind: 'product', productId: p.id } })}
                      ariaLabel={`Ask Edify about ${p.name}`}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/suppliers/${p.supplierId}`); }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--color-border-subtle)',
                        background: '#fff',
                        color: 'var(--color-text-primary)',
                        fontSize: 12, fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      <ExternalLink size={11} /> Supplier
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <QuinnSheet
        open={quinn.open}
        scope={quinn.scope}
        onClose={() => setQuinn({ open: false, scope: null })}
      />
    </div>
  );
}

function unitCost(p: { packCost: number; packQty: number }): number {
  return p.packQty > 0 ? p.packCost / p.packQty : p.packCost;
}

const backBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'transparent', border: 'none',
  color: 'var(--color-text-muted)',
  fontSize: 13, fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer', padding: '6px 0',
};

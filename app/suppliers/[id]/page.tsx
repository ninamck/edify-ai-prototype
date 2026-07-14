'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Search, Plus, Edit3, Mail, Clock, Truck, Calendar, Upload } from 'lucide-react';
import {
  useSuppliers, useProducts,
  upsertProduct, genId,
} from '@/components/Suppliers/store';
import ProductsTable from '@/components/Suppliers/ProductsTable';
import SuppliersHero from '@/components/Suppliers/SuppliersHero';
import BulkActionBar from '@/components/Suppliers/BulkActionBar';
import QuinnSheet, { type QuinnScope } from '@/components/Suppliers/QuinnSheet';
import SupplierDrawer from '@/components/Suppliers/SupplierDrawer';
import { StatusPill } from '@/components/Suppliers/Primitives';
import type { Product } from '@/components/Suppliers/fixtures';
import { BASE_CURRENCY, CURRENCY_NAMES, formatMoney, fxRateLabel, FX_RATE_DATE } from '@/lib/currency';

export default function SupplierDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const supplierId = params?.id ?? '';

  const suppliers = useSuppliers();
  const products = useProducts();

  const supplier = suppliers.find((s) => s.id === supplierId);

  const supplierProducts = useMemo(
    () => products.filter((p) => p.supplierId === supplierId),
    [products, supplierId],
  );

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openSupplierEdit, setOpenSupplierEdit] = useState(false);
  const [quinn, setQuinn] = useState<{ open: boolean; scope: QuinnScope | null }>({ open: false, scope: null });

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return supplierProducts;
    const q = search.toLowerCase();
    return supplierProducts.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.supplierCode.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q),
    );
  }, [supplierProducts, search]);

  if (!supplier) {
    return (
      <div style={{ padding: 40, fontFamily: 'var(--font-primary)' }}>
        <button onClick={() => router.push('/suppliers')} style={backBtnStyle}>
          <ArrowLeft size={14} /> Back to suppliers
        </button>
        <p>Supplier not found.</p>
      </div>
    );
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  const clearSelection = () => setSelectedIds(new Set());

  function openQuinnGlobal(seed?: string) {
    setQuinn({ open: true, scope: { kind: 'global', seed } });
  }
  function openQuinnSupplier() {
    setQuinn({ open: true, scope: { kind: 'supplier', supplierId } });
  }
  function openQuinnProduct(productId: string) {
    setQuinn({ open: true, scope: { kind: 'product', productId } });
  }
  function openBulkQuinn() {
    setQuinn({ open: true, scope: { kind: 'bulk-products', selectedIds: [...selectedIds] } });
  }

  function addBlankProduct() {
    if (!supplier) return;
    const newId = genId('prd');
    const blank: Product = {
      id: newId,
      name: 'New product',
      supplierId,
      supplierCode: '',
      productClass: 'General',
      category: 'Other',
      tags: [],
      packType: 'Pack',
      packQty: 1,
      packCost: 0,
      taxRatePct: 5,
      singleUnitType: 'Each',
      altUoms: [],
      allergensContains: [],
      allergensTraces: [],
      nutrition: {},
      sites: [...supplier.sites],
      status: 'Pending',
    };
    upsertProduct(blank);
    router.push(`/suppliers/products/${newId}`);
  }

  // Suggestion chips scoped to this supplier so the chat opens with the
  // most useful actions for "I'm looking at Agility right now".
  const suggestions = [
    { label: `Mark every ${supplier.name} product unavailable`, seed: `Mark every ${supplier.name} product unavailable` },
    { label: 'Adjust all prices +5%', seed: `${supplier.name} price +5` },
    { label: `Update cut-off time`, seed: `Update ${supplier.name} cutoff` },
    { label: 'Find duplicate products', seed: 'Find duplicates' },
    { label: 'Re-categorise all packaging', seed: `Recategorise ${supplier.name} packaging` },
  ];

  return (
    <div style={{
      padding: '20px clamp(20px, 3vw, 40px) 120px',
      maxWidth: 1180, margin: '0 auto',
      fontFamily: 'var(--font-primary)',
    }}>
      <button onClick={() => router.push('/suppliers')} style={backBtnStyle}>
        <ArrowLeft size={14} /> Back to suppliers
      </button>

      {/* Header card */}
      <div style={{
        marginTop: 8,
        padding: '18px 20px',
        borderRadius: 14,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            {supplier.name}
          </h1>
          <StatusPill status={supplier.status} />
          <div style={{ flex: 1 }} />
          <button onClick={() => setOpenSupplierEdit(true)} style={ghostButtonStyle}>
            <Edit3 size={14} /> Edit supplier
          </button>
          <button onClick={() => router.push('/suppliers/import')} style={ghostButtonStyle}>
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={addBlankProduct} style={primaryButtonStyle}>
            <Plus size={14} /> Add product
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, color: 'var(--color-text-secondary)', fontSize: 12.5 }}>
          {supplier.email && <Stat icon={<Mail size={13} />} label={supplier.email} />}
          {supplier.cutOffTime && <Stat icon={<Clock size={13} />} label={`Cut-off ${supplier.cutOffTime}`} />}
          {typeof supplier.leadTimeDays === 'number' && <Stat icon={<Truck size={13} />} label={`Lead ${supplier.leadTimeDays}d`} />}
          {supplier.deliveryDays && supplier.deliveryDays.length > 0 && (
            <Stat icon={<Calendar size={13} />} label={supplier.deliveryDays.join(' \u00b7 ')} />
          )}
          <Stat icon={null} label={`${supplierProducts.length} product${supplierProducts.length === 1 ? '' : 's'}`} />
          <Stat icon={null} label={`${supplier.sites.length} site${supplier.sites.length === 1 ? '' : 's'}`} />
        </div>
        {supplier.currency && supplier.currency !== BASE_CURRENCY && (
          // Per-supplier currency (not account-level): this supplier bills in
          // its own currency; purchases convert to the base currency at the
          // daily rate, locked at goods receipt.
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '10px 12px', borderRadius: 10,
            background: 'var(--color-bg-hover)',
            fontSize: 12.5, color: 'var(--color-text-secondary)',
          }}>
            <span style={{
              padding: '3px 9px', borderRadius: 100,
              background: 'var(--color-accent-active)', color: '#fff',
              fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em',
            }}>
              Bills in {supplier.currency}
            </span>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {CURRENCY_NAMES[supplier.currency]}
            </span>
            <span>
              {supplier.fxContractRate
                ? `Contracted rate: 1 ${supplier.currency} = ${supplier.fxContractRate} GBP`
                : `${fxRateLabel(supplier.currency)} · auto-updated ${FX_RATE_DATE}`}
            </span>
            {typeof supplier.minimumOrderValue === 'number' && (
              <span>Minimum order {formatMoney(supplier.minimumOrderValue, supplier.currency)}</span>
            )}
            <span style={{ color: 'var(--color-text-muted)' }}>
              Rate locks at goods receipt
            </span>
          </div>
        )}
      </div>

      {/* Hero (Quinn) */}
      <div style={{ marginTop: 16 }}>
        <SuppliersHero
          title={`What do you want to do with ${supplier.name}?`}
          subtitle="Type a sentence or tap a shortcut. I'll preview every change before it commits."
          suggestions={suggestions}
          onAsk={openQuinnGlobal}
        />
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px',
          borderRadius: 8,
          background: 'var(--color-bg-hover)',
          flex: '1 0 220px',
          maxWidth: 360,
        }}>
          <Search size={14} color="var(--color-text-muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13, fontFamily: 'var(--font-primary)',
              flex: 1, minWidth: 0,
              color: 'var(--color-text-primary)',
            }}
          />
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
          {filteredProducts.length} of {supplierProducts.length} shown
        </span>
      </div>

      <ProductsTable
        products={filteredProducts}
        suppliers={suppliers}
        selectedIds={selectedIds}
        onToggleSelect={toggle}
        onOpenProduct={(id) => router.push(`/suppliers/products/${id}`)}
        onAskQuinn={openQuinnProduct}
      />

      <BulkActionBar
        selectedCount={selectedIds.size}
        onClear={clearSelection}
        onAskQuinn={openBulkQuinn}
        noun="product"
      />

      {openSupplierEdit && (
        <SupplierDrawer
          supplier={supplier}
          onClose={() => setOpenSupplierEdit(false)}
          onAskQuinn={() => {
            setOpenSupplierEdit(false);
            openQuinnSupplier();
          }}
        />
      )}

      <QuinnSheet
        open={quinn.open}
        scope={quinn.scope}
        onClose={() => setQuinn({ open: false, scope: null })}
      />
    </div>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {icon}
      {label}
    </span>
  );
}

const backBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'transparent', border: 'none',
  color: 'var(--color-text-muted)',
  fontSize: 13, fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer', padding: '6px 0',
};
const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '8px 14px', borderRadius: 10, border: 'none',
  background: 'var(--color-accent-active)',
  fontSize: 13, fontWeight: 600, color: '#fff',
  fontFamily: 'var(--font-primary)', cursor: 'pointer',
};
const ghostButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '8px 14px', borderRadius: 10,
  border: '1px solid var(--color-border)',
  background: '#fff',
  fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-primary)', cursor: 'pointer',
};

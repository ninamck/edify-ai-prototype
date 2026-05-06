'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Upload } from 'lucide-react';
import {
  useSuppliers, useProducts, useMasterProducts,
} from '@/components/Suppliers/store';
import SuppliersTable from '@/components/Suppliers/SuppliersTable';
import MasterProductsTable from '@/components/Suppliers/MasterProductsTable';
import SuppliersHero from '@/components/Suppliers/SuppliersHero';
import BulkActionBar from '@/components/Suppliers/BulkActionBar';
import QuinnSheet, { type QuinnScope } from '@/components/Suppliers/QuinnSheet';

type Tab = 'suppliers' | 'masters';

export default function SuppliersPage() {
  const router = useRouter();
  const suppliers = useSuppliers();
  const products = useProducts();
  const masterProducts = useMasterProducts();

  const [tab, setTab] = useState<Tab>('suppliers');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quinn, setQuinn] = useState<{ open: boolean; scope: QuinnScope | null }>({ open: false, scope: null });

  const filteredSuppliers = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.shortCode?.toLowerCase().includes(q) ||
      s.categories.some((c) => c.toLowerCase().includes(q)),
    );
  }, [suppliers, search]);

  const filteredMasters = useMemo(() => {
    if (!search.trim()) return masterProducts;
    const q = search.toLowerCase();
    return masterProducts.filter((m) =>
      m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q),
    );
  }, [masterProducts, search]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }

  function openQuinnGlobal(seed?: string) {
    setQuinn({ open: true, scope: { kind: 'global', seed } });
  }
  function openQuinnSupplier(supplierId: string) {
    setQuinn({ open: true, scope: { kind: 'supplier', supplierId } });
  }
  function openQuinnMaster(masterId: string) {
    // Master Products don't have a dedicated scoped flow yet \u2014 seed the
    // global flow with a sentence so Quinn picks up the context.
    const m = masterProducts.find((x) => x.id === masterId);
    setQuinn({ open: true, scope: { kind: 'global', seed: m ? `Edit Master Product ${m.name}` : undefined } });
  }
  function openBulkQuinn() {
    setQuinn({ open: true, scope: { kind: 'bulk-products', selectedIds: [...selectedIds] } });
  }

  // Suggestion chip set varies by tab. Each chip seeds the global flow with
  // a natural-language sentence Quinn knows how to route in flows.ts.
  const suggestions = tab === 'suppliers'
    ? [
        { label: 'Add a new supplier', seed: 'Add a new supplier' },
        { label: 'Mark Agility unavailable', seed: 'Mark Agility unavailable' },
        { label: 'Update Almarai cut-off to 14:00', seed: 'Update Almarai cutoff to 14:00' },
        { label: 'Adjust all Bidvest prices +5%', seed: 'Bidvest price +5' },
        { label: 'Find duplicate products', seed: 'Find duplicates' },
      ]
    : [
        { label: 'Show me cheapest milk SKU', seed: 'Compare whole milk prices' },
        { label: 'Find duplicate products', seed: 'Find duplicates' },
        { label: 'Create a Master Product', seed: 'Add a master product' },
        { label: 'Adjust all dairy prices +5%', seed: 'dairy price +5' },
        { label: 'Mark old SKUs unavailable', seed: 'Mark old skus unavailable' },
      ];

  const heroTitle = tab === 'suppliers'
    ? `Hi \u2014 you have ${suppliers.length} suppliers and ${products.length} products. What do you want to change?`
    : `${masterProducts.length} master products keep your supplier prices comparable. What do you want to do?`;
  const heroSubtitle = tab === 'suppliers'
    ? 'Type a sentence or tap a shortcut. Quinn will preview every change before it commits.'
    : 'Linking SKUs to a master product unlocks side-by-side price comparison across suppliers.';

  return (
    <div style={{ padding: '24px clamp(20px, 3vw, 40px) 120px', maxWidth: 1180, margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, flex: 1 }}>
          Suppliers
        </h1>
        <button
          onClick={() => router.push('/suppliers/import')}
          style={ghostButtonStyle}
        >
          <Upload size={14} strokeWidth={2.2} /> Import CSV
        </button>
        <button
          onClick={() => openQuinnGlobal('Add a new supplier')}
          style={primaryButtonStyle}
        >
          <Plus size={14} strokeWidth={2.2} /> Add supplier
        </button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 18px' }}>
        {suppliers.length} suppliers \u00b7 {products.length} products \u00b7 {masterProducts.length} master products
      </p>

      {/* Hero (Quinn) */}
      <div style={{ marginBottom: 16 }}>
        <SuppliersHero
          title={heroTitle}
          subtitle={heroSubtitle}
          suggestions={suggestions}
          onAsk={openQuinnGlobal}
        />
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 14,
        borderBottom: '1px solid var(--color-border-subtle)',
      }}>
        <TabButton label={`Suppliers (${suppliers.length})`} active={tab === 'suppliers'} onClick={() => { setTab('suppliers'); clearSelection(); }} />
        <TabButton label={`Master products (${masterProducts.length})`} active={tab === 'masters'} onClick={() => { setTab('masters'); clearSelection(); }} />
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
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
            placeholder={tab === 'suppliers' ? 'Search suppliers' : 'Search master products'}
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13, fontFamily: 'var(--font-primary)',
              flex: 1, minWidth: 0,
              color: 'var(--color-text-primary)',
            }}
          />
        </div>
      </div>

      {/* Table */}
      {tab === 'suppliers' ? (
        <SuppliersTable
          suppliers={filteredSuppliers}
          products={products}
          selectedIds={selectedIds}
          onToggleSelect={toggle}
          onOpenSupplier={() => { /* navigation handled inline */ }}
          onAskQuinn={openQuinnSupplier}
        />
      ) : (
        <MasterProductsTable
          masters={filteredMasters}
          products={products}
          selectedIds={selectedIds}
          onToggleSelect={toggle}
          onAskQuinn={openQuinnMaster}
        />
      )}

      <BulkActionBar
        selectedCount={selectedIds.size}
        onClear={clearSelection}
        onAskQuinn={openBulkQuinn}
        noun={tab === 'suppliers' ? 'supplier' : 'master product'}
      />

      <QuinnSheet
        open={quinn.open}
        scope={quinn.scope}
        onClose={() => setQuinn({ open: false, scope: null })}
      />
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 14px',
        background: 'transparent',
        border: 'none',
        borderBottom: '2px solid ' + (active ? 'var(--color-accent-active)' : 'transparent'),
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
        fontSize: 13, fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        cursor: 'pointer',
        marginBottom: -1,
      }}
    >
      {label}
    </button>
  );
}

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

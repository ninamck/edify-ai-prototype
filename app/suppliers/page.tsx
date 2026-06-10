'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Upload } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import {
  useSuppliers, useProducts, useMasterProducts,
  upsertMasterProduct, genId,
} from '@/components/Suppliers/store';
import {
  TOP_NAV_BAR_PADDING,
  TOP_NAV_PILL_ACTIVE,
  TOP_NAV_PILL_BASE,
  TOP_NAV_PILL_GAP,
  TOP_NAV_PILL_IDLE_TRANSPARENT,
} from '@/components/Production/topNavStyles';
import SuppliersTable from '@/components/Suppliers/SuppliersTable';
import MasterProductsTable from '@/components/Suppliers/MasterProductsTable';
import BulkActionBar from '@/components/Suppliers/BulkActionBar';
import QuinnSheet, { type QuinnScope } from '@/components/Suppliers/QuinnSheet';
import { SharedLibraryBanner } from '@/components/Franchise/SharedLibrary';

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
  function toggleMany(ids: string[], select: boolean) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (select) ids.forEach((id) => n.add(id));
      else ids.forEach((id) => n.delete(id));
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

  function createMaster() {
    const id = genId('mp');
    upsertMasterProduct({
      id,
      name: 'New master product',
      category: 'Other',
      unit: 'each',
      slug: `new-${id}`,
      productClass: 'Food',
      status: 'Available',
    });
    router.push(`/suppliers/master-products/${id}`);
  }

  // Suggestion chip set varies by tab. Each chip seeds the global flow with
  // a natural-language sentence Quinn knows how to route in flows.ts. The
  // chips render inside QuinnSheet (the right-side sidebar) as starter
  // prompts — see the `suggestions` prop on <QuinnSheet/> below.
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

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      {/* Sticky sub-tabs — Suppliers / Master products. Lives at the top
          of the page (not inside the centered content container) so it
          reads as a sub-nav directly under the layout header, matching
          the Manage menu and Production tab strips 1:1. Tab state stays
          local to this page because it drives the table below.

          The right-aligned "Ask Quinn" pill replaces the old SuppliersHero
          card — it's the single, persistent entry point into the agent
          sidebar. The starter prompts (suggestions) now live inside
          QuinnSheet itself so the page chrome stays quiet. */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 150,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: TOP_NAV_PILL_GAP,
          padding: TOP_NAV_BAR_PADDING,
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          overflowX: 'auto',
        }}
      >
        <TabButton label="Suppliers" active={tab === 'suppliers'} onClick={() => { setTab('suppliers'); clearSelection(); }} />
        <TabButton label="Master products" active={tab === 'masters'} onClick={() => { setTab('masters'); clearSelection(); }} />

        <div style={{ flex: 1 }} />

        <button
          onClick={() => openQuinnGlobal()}
          style={askQuinnButtonStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-accent-active-hover, var(--color-accent-active))'; e.currentTarget.style.opacity = '0.92'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-accent-active)'; e.currentTarget.style.opacity = '1'; }}
        >
          <EdifyMark size={13} /> Ask Edify
        </button>
      </nav>

      <div style={{ padding: '24px clamp(20px, 3vw, 40px) 120px', maxWidth: 1180, margin: '0 auto' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, flex: 1 }}>
            {tab === 'suppliers' ? 'Suppliers' : 'Master products'}
          </h1>
          {tab === 'suppliers' ? (
            <>
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
            </>
          ) : (
            <button onClick={createMaster} style={primaryButtonStyle}>
              <Plus size={14} strokeWidth={2.2} /> Create Master Product
            </button>
          )}
        </div>

        <SharedLibraryBanner noun={tab === 'suppliers' ? 'suppliers' : 'products'} />

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
            onToggleSelectMany={toggleMany}
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
      </div>

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
        suggestions={suggestions}
      />
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...TOP_NAV_PILL_BASE,
        ...(active ? TOP_NAV_PILL_ACTIVE : TOP_NAV_PILL_IDLE_TRANSPARENT),
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

// Compact accent pill that lives inside the sticky nav. Sized smaller
// than the tab pills (36px vs 44px) so it reads as an action, not a
// peer of the section tabs.
const askQuinnButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  minHeight: 36,
  padding: '8px 14px',
  borderRadius: 100,
  border: 'none',
  background: 'var(--color-accent-active)',
  color: '#fff',
  fontSize: 13, fontWeight: 700,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  transition: 'opacity 120ms ease',
};

'use client';

/**
 * Master product detail — mirrors the live product layout:
 *   - Basic information (editable name / class / category / unit / status)
 *   - Linked supplier products (with "Set as default")
 *   - Cost: company average + per-site weighted-average cost (WAC) table
 *   - Site exception for default product (structure)
 *
 * The Cost table is the destination for the receiving flow's captured WAC:
 * delivering an item against a site flips that site from "Estimated" to a
 * calculated weighted-average cost.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, ExternalLink, Plus, TrendingDown } from 'lucide-react';
import {
  useProducts, useSuppliers, useMasterProducts,
  upsertMasterProduct, setDefaultSupplierProduct,
} from '@/components/Suppliers/store';
import {
  ALL_CATEGORIES, ALL_CLASSES, ALL_SITES,
  formatPrice, masterCompanyAvg,
  type MasterProduct, type Product, type ProductCategory, type ProductClass, type SupplierStatus,
} from '@/components/Suppliers/fixtures';
import { StatusPill } from '@/components/Suppliers/Primitives';
import QuinnSheet, { type QuinnScope } from '@/components/Suppliers/QuinnSheet';

const STATUSES: SupplierStatus[] = ['Available', 'Unavailable', 'Pending'];

function unitCost(p: { packCost: number; packQty: number }): number {
  return p.packQty > 0 ? p.packCost / p.packQty : p.packCost;
}

export default function MasterProductDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const masterProducts = useMasterProducts();
  const products = useProducts();
  const suppliers = useSuppliers();

  const master = masterProducts.find((m) => m.id === id);
  const linked = useMemo(() => products.filter((p) => p.masterProductId === id), [products, id]);

  const [draft, setDraft] = useState<MasterProduct | null>(master ?? null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [quinn, setQuinn] = useState<{ open: boolean; scope: QuinnScope | null }>({ open: false, scope: null });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { setDraft(master ?? null); }, [master]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 2200);
    return () => clearTimeout(t);
  }, [savedAt]);

  if (!master || !draft) {
    return (
      <div style={{ padding: 40, fontFamily: 'var(--font-primary)' }}>
        <button onClick={() => router.push('/suppliers')} style={backBtnStyle}>
          <ArrowLeft size={14} /> Back
        </button>
        <p>Master product not found.</p>
      </div>
    );
  }

  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const sorted = [...linked].sort((a, b) => unitCost(a) - unitCost(b));
  const cheapest = sorted[0];
  const companyAvg = masterCompanyAvg(master);
  const dirty = JSON.stringify(draft) !== JSON.stringify(master);

  // Site rows = the standard estate plus any extra sites that already carry a
  // cost (e.g. a receiving site like "Fitzroy Espresso" not in the estate list).
  const extraSites = Object.keys(master.siteCosts ?? {}).filter((s) => !ALL_SITES.includes(s));
  const siteRows = [...ALL_SITES, ...extraSites];

  function update<K extends keyof MasterProduct>(key: K, value: MasterProduct[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }
  function save() {
    if (!draft || !dirty) return;
    upsertMasterProduct(draft);
    setSavedAt(Date.now());
  }

  return (
    <div style={{
      padding: '20px clamp(20px, 3vw, 40px) 80px',
      maxWidth: 1180, margin: '0 auto',
      fontFamily: 'var(--font-primary)',
    }}>
      <button onClick={() => router.push('/suppliers')} style={backBtnStyle}>
        <ArrowLeft size={14} /> Back to suppliers
      </button>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-accent-active)' }}>
            MASTER PRODUCT
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 0', color: 'var(--color-text-primary)' }}>
            {master.name}
          </h1>
        </div>
        {savedAt && (
          <span style={{ fontSize: 13, color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
            <Check size={14} strokeWidth={2.6} /> Saved
          </span>
        )}
        <button onClick={save} disabled={!dirty} style={{
          ...primaryBtnStyle,
          background: dirty ? 'var(--color-accent-active)' : 'var(--color-border)',
          cursor: dirty ? 'pointer' : 'not-allowed',
        }}>
          Save
        </button>
      </div>

      {/* Basic information */}
      <Card>
        <SectionHeading>Basic information</SectionHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <Field label="Product name">
            <input value={draft.name} onChange={(e) => update('name', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Product class">
            <select value={draft.productClass ?? 'General'} onChange={(e) => update('productClass', e.target.value as ProductClass)} style={inputStyle}>
              {ALL_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Product category">
            <select value={draft.category} onChange={(e) => update('category', e.target.value as ProductCategory)} style={inputStyle}>
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Unit of measure">
            <input value={draft.unit} onChange={(e) => update('unit', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Status">
            <select value={draft.status ?? 'Available'} onChange={(e) => update('status', e.target.value as SupplierStatus)} style={inputStyle}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      {/* Linked supplier products */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SectionHeading>Linked supplier products</SectionHeading>
          <span style={countSuffixStyle}>{linked.length} SKU{linked.length === 1 ? '' : 's'}</span>
          {linked.length >= 2 && cheapest && (
            <>
              <div style={{ flex: 1 }} />
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 999,
                border: '1.5px solid var(--color-success)', color: 'var(--color-success)',
                fontSize: 11.5, fontWeight: 700,
              }}>
                <TrendingDown size={12} /> Cheapest: {supplierMap.get(cheapest.supplierId)?.name ?? '—'}
              </span>
            </>
          )}
        </div>

        {linked.length === 0 ? (
          <EmptyBox>No supplier products are linked to this master product yet.</EmptyBox>
        ) : (
          <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ ...rowStyle, background: '#FBFAF8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
              <span>Supplier</span>
              <span>Product</span>
              <span style={{ textAlign: 'right' }}>Cost</span>
              <span style={{ textAlign: 'center' }}>Status</span>
              <span style={{ textAlign: 'center' }}>Default</span>
              <span style={{ textAlign: 'right' }}>Action</span>
            </div>
            {sorted.map((p) => {
              const isDefault = master.defaultProductId === p.id;
              const isCheapest = p.id === cheapest?.id;
              return (
                <div key={p.id} style={{ ...rowStyle, borderTop: '1px solid var(--color-border-subtle)', background: '#fff' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                    {supplierMap.get(p.supplierId)?.name ?? '—'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 600 }}>
                    {p.name}
                    {isCheapest && linked.length >= 2 && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--color-success)' }}>cheapest</span>
                    )}
                  </span>
                  <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {formatPrice(unitCost(p))}<span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> / {master.unit}</span>
                  </span>
                  <span style={{ textAlign: 'center' }}><StatusPill status={p.status} /></span>
                  <span style={{ textAlign: 'center' }}>
                    <DefaultToggle on={isDefault} onClick={() => setDefaultSupplierProduct(master.id, p.id)} />
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <button onClick={() => router.push(`/suppliers/products/${p.id}`)} style={viewBtnStyle}>
                      <ExternalLink size={11} /> View
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <button onClick={() => router.push('/suppliers')} style={addLinkStyle}>
          <Plus size={13} /> Add supplier products to the list
        </button>
      </Card>

      {/* Cost (per-site WAC) */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <SectionHeading>Cost</SectionHeading>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
              Company average
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {companyAvg != null ? `${formatPrice(companyAvg)} / ${master.unit}` : `${formatPrice(0)} / ${master.unit}`}
            </div>
          </div>
        </div>

        <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ ...costRowStyle, background: '#FBFAF8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
            <span>Site</span>
            <span style={{ textAlign: 'right' }}>WAC</span>
            <span style={{ textAlign: 'right' }}>Variance</span>
            <span style={{ textAlign: 'right' }}>Last calculated</span>
          </div>
          {siteRows.map((site) => {
            const c = master.siteCosts?.[site];
            const variance = c && companyAvg != null && companyAvg > 0
              ? ((c.wac - companyAvg) / companyAvg) * 100
              : null;
            return (
              <div key={site} style={{ ...costRowStyle, borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--color-text-primary)', fontWeight: 600 }}>{site}</span>
                <span style={{ textAlign: 'right', fontSize: 12.5, color: c ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                  {c ? `${formatPrice(c.wac)} / ${master.unit}` : `${formatPrice(0)} / ${master.unit}`}
                </span>
                <span style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: variance == null ? 'var(--color-text-muted)' : variance > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  {variance == null ? '—' : `${variance > 0 ? '+' : ''}${variance.toFixed(1)}%`}
                </span>
                <span style={{ textAlign: 'right' }}>
                  {c && c.lastCalculated !== 'estimated' ? (
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{c.lastCalculated}</span>
                  ) : (
                    <span style={estimatedPillStyle}>Estimated (no purchases)</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Site exception for default product */}
      <Card>
        <SectionHeading>Set site exception for default product</SectionHeading>
        <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ ...exceptionRowStyle, background: '#FBFAF8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
            <span>Site</span>
            <span>Default supplier product</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>
          <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            No data
          </div>
        </div>
        <button style={addLinkStyle}>
          <Plus size={13} /> Add another exception
        </button>
      </Card>

      <QuinnSheet
        open={quinn.open}
        scope={quinn.scope}
        onClose={() => setQuinn({ open: false, scope: null })}
      />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section style={{
      marginTop: 16, padding: '18px 20px',
      borderRadius: 14, border: '1px solid var(--color-border-subtle)', background: '#fff',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {children}
    </section>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: 24, borderRadius: 12, background: 'var(--color-bg-hover)',
      border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)',
      fontSize: 13, textAlign: 'center',
    }}>
      {children}
    </div>
  );
}

function DefaultToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        width: 38, height: 22, borderRadius: 100, border: 'none', position: 'relative',
        background: on ? 'var(--color-accent-active)' : 'var(--color-border)',
        cursor: 'pointer', transition: 'background 0.15s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
      }} />
    </button>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.2fr 2fr 1.1fr 0.9fr 0.7fr 0.8fr',
  gap: 12, padding: '11px 14px', alignItems: 'center',
};
const costRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr 1fr 1.4fr',
  gap: 12, padding: '11px 14px', alignItems: 'center',
};
const exceptionRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.5fr 2fr 1fr',
  gap: 12, padding: '11px 14px', alignItems: 'center',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: '#fff',
  fontSize: 14, fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)',
  outline: 'none', boxSizing: 'border-box',
};
const estimatedPillStyle: React.CSSProperties = {
  display: 'inline-block', padding: '3px 10px', borderRadius: 100,
  background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)',
  fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap',
};
const viewBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 10px', borderRadius: 8,
  border: '1px solid var(--color-border-subtle)', background: '#fff',
  color: 'var(--color-text-primary)', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-primary)',
};
const addLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--color-accent-deep)', fontSize: 13, fontWeight: 600,
  fontFamily: 'var(--font-primary)', padding: '4px 0', alignSelf: 'flex-start',
};
const backBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'transparent', border: 'none', color: 'var(--color-text-muted)',
  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer', padding: '6px 0',
};
const primaryBtnStyle: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 10, border: 'none',
  color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-primary)',
};
const countSuffixStyle: React.CSSProperties = {
  fontSize: 12.5, color: 'var(--color-text-muted)', fontWeight: 500,
};

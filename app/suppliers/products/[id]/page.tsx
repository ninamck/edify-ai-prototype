'use client';

/**
 * Full-page product editor.
 *
 * Replaces the earlier right-side drawer because product fields (eight
 * basics, six pack/price, a 14-allergen grid, a 9-field nutrition grid)
 * couldn't be set at a comfortable reading size in a 540px drawer.
 *
 * Layout:
 *   - Sticky header with back, page title, status pill, and Save / Archive /
 *     Ask Quinn actions
 *   - Hero card with the editable product name and supplier metadata
 *   - Two-column body on desktop:
 *       Left:  Basics, Pack & price
 *       Right: Food details, Advanced
 *     Sites picker spans both columns at the bottom of the left column.
 *
 * Type scale is bumped one step compared to the old drawer:
 *   field labels 13px / inputs 14px / section headings 13px uppercase.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import {
  useProducts, useSuppliers, useMasterProducts,
  upsertProduct, deleteProduct,
} from '@/components/Suppliers/store';
import {
  ALL_ALLERGENS, ALL_CATEGORIES, ALL_CLASSES, ALL_SITES,
  type Allergen, type AltUom, type Product, type ProductCategory, type ProductClass,
  type SupplierStatus,
  formatPrice,
} from '@/components/Suppliers/fixtures';
import { StatusPill } from '@/components/Suppliers/Primitives';
import QuinnSheet, { type QuinnScope } from '@/components/Suppliers/QuinnSheet';

const FOOD_CATS: ProductCategory[] = ['Dairy', 'Bakery', 'Produce', 'Meat', 'Seafood', 'Pantry', 'Beverage'];

export default function ProductEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const productId = params?.id ?? '';

  const products = useProducts();
  const suppliers = useSuppliers();
  const masterProducts = useMasterProducts();

  const product = useMemo(() => products.find((p) => p.id === productId) ?? null, [products, productId]);

  const [draft, setDraft] = useState<Product | null>(product);
  const [openFood, setOpenFood] = useState<boolean>(product ? FOOD_CATS.includes(product.category) : false);
  const [openAdvanced, setOpenAdvanced] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [quinn, setQuinn] = useState<{ open: boolean; scope: QuinnScope | null }>({ open: false, scope: null });

  // Keep the local draft in lock-step with the underlying product when the
  // route id changes (e.g. user navigates between siblings). The classic
  // "sync state from props" pattern \u2014 the rule warns about cascading
  // renders, but the cost is tiny here and the alternative (key remount)
  // would lose focus on the name input mid-edit.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDraft(product);
    setOpenFood(product ? FOOD_CATS.includes(product.category) : false);
  }, [product]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Auto-clear the "Saved" pill after a couple of seconds.
  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 2200);
    return () => clearTimeout(t);
  }, [savedAt]);

  if (!product || !draft) {
    return (
      <div style={{ padding: 40, fontFamily: 'var(--font-primary)' }}>
        <button onClick={() => router.push('/suppliers')} style={backBtnStyle}>
          <ArrowLeft size={14} /> Back to suppliers
        </button>
        <p>Product not found.</p>
      </div>
    );
  }

  const supplier = suppliers.find((s) => s.id === draft.supplierId);
  const dirty = JSON.stringify(draft) !== JSON.stringify(product);
  const unitCost = draft.packQty > 0 ? draft.packCost / draft.packQty : 0;

  function update<K extends keyof Product>(key: K, value: Product[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function setAltUom(i: number, patch: Partial<AltUom>) {
    setDraft((d) => {
      if (!d) return d;
      const next = [...d.altUoms];
      while (next.length <= i) next.push({ type: '', numberOfUnits: 0 });
      next[i] = { ...next[i], ...patch };
      return { ...d, altUoms: next };
    });
  }

  function save() {
    if (!draft) return;
    if (!dirty) return;
    upsertProduct(draft);
    setSavedAt(Date.now());
  }

  function archive() {
    if (!draft) return;
    if (!confirm('Archive this product? Open orders and historic invoices keep it; it just stops appearing on new orders.')) return;
    deleteProduct(draft.id);
    router.push(supplier ? `/suppliers/${supplier.id}` : '/suppliers');
  }

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      {/* Sticky action bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--color-border-subtle)',
        padding: '12px clamp(20px, 3vw, 40px)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={() => router.push(supplier ? `/suppliers/${supplier.id}` : '/suppliers')}
          style={backBtnStyle}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{
          fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)',
        }}>
          Edit product
        </div>
        <div style={{ flex: 1 }} />
        {savedAt && (
          <span style={{
            fontSize: 13, color: 'var(--color-success)',
            display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600,
          }}>
            <Check size={14} strokeWidth={2.6} /> Saved
          </span>
        )}
        <button
          onClick={() => setQuinn({ open: true, scope: { kind: 'product', productId: draft.id } })}
          style={quinnBtnStyle}
        >
          <EdifyMark size={13} color="var(--color-accent-active)" strokeWidth={2.4} />
          Ask Edify
        </button>
        <button onClick={archive} style={dangerBtnStyle}>
          <Trash2 size={13} /> Archive
        </button>
        <button
          onClick={() => router.push(supplier ? `/suppliers/${supplier.id}` : '/suppliers')}
          style={secondaryBtnStyle}
        >
          {dirty ? 'Discard' : 'Close'}
        </button>
        <button
          onClick={save}
          disabled={!dirty}
          style={{
            ...primaryBtnStyle,
            background: dirty ? 'var(--color-accent-active)' : 'var(--color-border)',
            cursor: dirty ? 'pointer' : 'not-allowed',
          }}
        >
          Save changes
        </button>
      </div>

      {/* Body */}
      <div style={{
        maxWidth: 1140, margin: '0 auto',
        padding: '24px clamp(20px, 3vw, 40px) 80px',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        {/* Hero card */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ ...sectionLabelStyle, marginBottom: 6 }}>Product name</div>
              <input
                value={draft.name}
                onChange={(e) => update('name', e.target.value)}
                style={{
                  width: '100%',
                  border: 'none', outline: 'none',
                  fontSize: 26, fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-primary)',
                  padding: 0, background: 'transparent',
                  letterSpacing: '-0.01em',
                }}
              />
              <div style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 6 }}>
                {supplier?.name ?? 'No supplier'} \u00b7 code <strong style={{ color: 'var(--color-text-secondary)' }}>{draft.supplierCode || '—'}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <StatusPill status={draft.status} />
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Unit cost <strong style={{ color: 'var(--color-text-primary)' }}>{formatPrice(unitCost)}</strong>
              </div>
            </div>
          </div>
        </Card>

        {/* Two columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
          gap: 18,
        }}>
          {/* Basics */}
          <Card>
            <SectionHeading>Basics</SectionHeading>
            <FieldGrid>
              <Field label="Supplier">
                <Select
                  value={draft.supplierId}
                  onChange={(v) => update('supplierId', v)}
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                />
              </Field>
              <Field label="Master product">
                <Select
                  value={draft.masterProductId ?? ''}
                  onChange={(v) => update('masterProductId', v || undefined)}
                  options={[
                    { value: '', label: 'Not linked' },
                    ...masterProducts.map((m) => ({ value: m.id, label: `${m.name} \u00b7 ${m.unit}` })),
                  ]}
                />
              </Field>
              <Field label="Supplier code">
                <TextInput value={draft.supplierCode} onChange={(v) => update('supplierCode', v)} />
              </Field>
              <Field label="Availability">
                <PillRadio
                  options={[
                    { value: 'Available', label: 'Available' },
                    { value: 'Unavailable', label: 'Unavailable' },
                    { value: 'Pending', label: 'Pending' },
                  ]}
                  value={draft.status}
                  onChange={(v) => update('status', v as SupplierStatus)}
                />
              </Field>
              <Field label="Class" span={2}>
                <PillRadio
                  options={ALL_CLASSES.map((c) => ({ value: c, label: c }))}
                  value={draft.productClass}
                  onChange={(v) => update('productClass', v as ProductClass)}
                />
              </Field>
              <Field label="Category" span={2}>
                <PillRadio
                  options={ALL_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  value={draft.category}
                  onChange={(v) => {
                    update('category', v as ProductCategory);
                    if (FOOD_CATS.includes(v as ProductCategory)) setOpenFood(true);
                  }}
                />
              </Field>
            </FieldGrid>
          </Card>

          {/* Pack & price */}
          <Card>
            <SectionHeading>Pack & price</SectionHeading>
            <FieldGrid>
              <Field label="Pack type" span={2}>
                <PillRadio
                  options={[{ value: 'Pack', label: 'Pack' }, { value: 'Single', label: 'Single' }]}
                  value={draft.packType}
                  onChange={(v) => update('packType', v as Product['packType'])}
                />
              </Field>
              <Field label="Pack quantity">
                <NumberInput value={draft.packQty} onChange={(v) => update('packQty', v)} />
              </Field>
              <Field label="Pack cost ex VAT (£)">
                <NumberInput value={draft.packCost} onChange={(v) => update('packCost', v)} step={0.01} />
              </Field>
              <Field label="Tax rate (%)">
                <NumberInput value={draft.taxRatePct} onChange={(v) => update('taxRatePct', v)} step={0.5} />
              </Field>
              <Field label="Single item volume or weight">
                <NumberInput
                  value={draft.singleUnitVolumeOrWeight ?? 0}
                  onChange={(v) => update('singleUnitVolumeOrWeight', v || undefined)}
                  step={0.01}
                />
              </Field>
              <Field label="Single unit type">
                <PillRadio
                  options={(['Each', 'kg', 'L', 'g', 'ml'] as const).map((u) => ({ value: u, label: u }))}
                  value={draft.singleUnitType}
                  onChange={(v) => update('singleUnitType', v as Product['singleUnitType'])}
                />
              </Field>
              <Field label="Unit of measure">
                <TextInput value={draft.unitOfMeasure ?? ''} onChange={(v) => update('unitOfMeasure', v || undefined)} />
              </Field>
            </FieldGrid>

            <FieldBlock label="Alternative units of measure">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[0, 1].map((i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center' }}>
                    <Select
                      value={draft.altUoms[i]?.type ?? ''}
                      onChange={(v) => setAltUom(i, { type: v })}
                      options={[
                        { value: '', label: `Alternative ${i + 1} — type` },
                        ...['Each', 'kg', 'L', 'g', 'ml', 'Box', 'Case', 'Pack'].map((u) => ({ value: u, label: u })),
                      ]}
                    />
                    <NumberInput
                      value={draft.altUoms[i]?.numberOfUnits ?? 0}
                      onChange={(v) => setAltUom(i, { numberOfUnits: v })}
                    />
                  </div>
                ))}
              </div>
            </FieldBlock>

            <div style={{
              marginTop: 14,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--color-bg-hover)',
              fontSize: 14,
              color: 'var(--color-text-secondary)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Unit cost</span>
              <strong style={{ color: 'var(--color-text-primary)', fontSize: 15 }}>
                {formatPrice(unitCost)}
              </strong>
            </div>
          </Card>
        </div>

        {/* Sites — full width because the option set is long */}
        <Card>
          <SectionHeading>
            Sites
            <span style={{ ...countSuffixStyle }}>{draft.sites.length} of {ALL_SITES.length}</span>
          </SectionHeading>
          <SitesPicker value={draft.sites} onChange={(v) => update('sites', v)} />
        </Card>

        {/* Food details */}
        <Card>
          <CollapsibleHeading
            label="Food details"
            count={`${draft.allergensContains.length} allergen${draft.allergensContains.length === 1 ? '' : 's'} \u00b7 ${Object.values(draft.nutrition).filter((v) => v != null).length} nutrition value${Object.values(draft.nutrition).filter((v) => v != null).length === 1 ? '' : 's'}`}
            open={openFood}
            onToggle={() => setOpenFood((v) => !v)}
          />
          {openFood && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <FieldBlock label="Contains">
                <AllergenGrid value={draft.allergensContains} onChange={(v) => update('allergensContains', v)} />
              </FieldBlock>
              <FieldBlock label="Traces of">
                <AllergenGrid value={draft.allergensTraces} onChange={(v) => update('allergensTraces', v)} />
              </FieldBlock>
              <FieldBlock label="Nutrition (per 100g)">
                <NutritionGrid value={draft.nutrition} onChange={(v) => update('nutrition', v)} />
              </FieldBlock>
            </div>
          )}
        </Card>

        {/* Advanced */}
        <Card>
          <CollapsibleHeading
            label="Advanced"
            count={[
              draft.excludeFromCogs ? 'COGS excluded' : null,
              draft.allowSplitPack ? 'split pack' : null,
              draft.forceMultiples ? 'force multiples' : null,
            ].filter(Boolean).join(' \u00b7 ') || 'All defaults'}
            open={openAdvanced}
            onToggle={() => setOpenAdvanced((v) => !v)}
          />
          {openAdvanced && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column' }}>
              <Toggle
                label="Exclude from COGS calculations"
                helper="Use for stickers, packaging, and other items that shouldn\u2019t roll into food cost."
                checked={!!draft.excludeFromCogs}
                onChange={(v) => update('excludeFromCogs', v)}
              />
              <Toggle
                label="Use Actual Use for Theoretical COGS"
                helper="Forces theoretical to track measured use rather than recipe yields."
                checked={!!draft.useActualUseForTheoreticalCogs}
                onChange={(v) => update('useActualUseForTheoreticalCogs', v)}
              />
              <Toggle
                label="Allow split pack ordering"
                helper="Lets users order in fractions of a pack \u2014 e.g. half a case."
                checked={!!draft.allowSplitPack}
                onChange={(v) => update('allowSplitPack', v)}
              />
              <Toggle
                label="Force ordering by pack quantity multiples"
                helper="Stops orders that aren\u2019t a whole multiple of pack qty."
                checked={!!draft.forceMultiples}
                onChange={(v) => update('forceMultiples', v)}
              />
            </div>
          )}
        </Card>
      </div>

      <QuinnSheet
        open={quinn.open}
        scope={quinn.scope}
        onClose={() => setQuinn({ open: false, scope: null })}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section style={{
      padding: '20px 22px',
      borderRadius: 14,
      border: '1px solid var(--color-border-subtle)',
      background: '#fff',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {children}
    </section>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 13, fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'var(--color-text-secondary)',
    }}>
      {children}
    </div>
  );
}

function CollapsibleHeading({ label, count, open, onToggle }: {
  label: string; count?: string; open: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', border: 'none', background: 'transparent',
        cursor: 'pointer', fontFamily: 'var(--font-primary)',
        padding: 0,
      }}
    >
      {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      <span style={{
        fontSize: 13, fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
      }}>
        {label}
      </span>
      {count && <span style={countSuffixStyle}>{count}</span>}
    </button>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: 14,
    }}>
      {children}
    </div>
  );
}

function Field({ label, span = 1, children }: { label: string; span?: 1 | 2; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <div style={fieldLabelStyle}>{label}</div>
      {children}
    </div>
  );
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ ...fieldLabelStyle, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={inputStyle}
    />
  );
}

function NumberInput({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      style={inputStyle}
    />
  );
}

function Select({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle, paddingRight: 32 }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function PillRadio({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: '7px 14px',
              borderRadius: 100,
              border: on ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
              background: on ? 'var(--color-accent-active)' : '#fff',
              color: on ? '#fff' : 'var(--color-text-secondary)',
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ label, helper, checked, onChange }: {
  label: string; helper?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
      padding: '12px 0',
      borderBottom: '1px solid var(--color-border-subtle)',
    }}>
      <span
        onClick={() => onChange(!checked)}
        style={{
          width: 42, height: 24, borderRadius: 100,
          background: checked ? 'var(--color-accent-active)' : 'var(--color-border)',
          position: 'relative', flexShrink: 0,
          transition: 'background 0.15s',
          marginTop: 1,
        }}
      >
        <span style={{
          position: 'absolute',
          top: 2, left: checked ? 20 : 2,
          width: 20, height: 20, borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s',
        }} />
      </span>
      <span style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.35 }}>
          {label}
        </div>
        {helper && (
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.45 }}>
            {helper}
          </div>
        )}
      </span>
    </label>
  );
}

function SitesPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const has = (s: string) => value.includes(s);
  function toggle(s: string) {
    onChange(has(s) ? value.filter((x) => x !== s) : [...value, s]);
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onChange([...ALL_SITES])} style={miniBtnStyle}>All sites</button>
        <button onClick={() => onChange([])} style={miniBtnStyle}>None</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ALL_SITES.map((s) => {
          const on = has(s);
          return (
            <button
              key={s}
              onClick={() => toggle(s)}
              style={{
                padding: '6px 12px',
                borderRadius: 100,
                border: on ? '1px solid var(--color-accent-active)' : '1px solid var(--color-border-subtle)',
                background: on ? 'rgba(34,68,68,0.06)' : '#fff',
                color: on ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
                fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
              }}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AllergenGrid({ value, onChange }: { value: Allergen[]; onChange: (v: Allergen[]) => void }) {
  function toggle(a: Allergen) {
    onChange(value.includes(a) ? value.filter((x) => x !== a) : [...value, a]);
  }
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: 6,
    }}>
      {ALL_ALLERGENS.map((a) => {
        const on = value.includes(a);
        return (
          <button
            key={a}
            onClick={() => toggle(a)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              borderRadius: 10,
              border: on ? '1px solid var(--color-accent-active)' : '1px solid var(--color-border-subtle)',
              background: on ? 'rgba(34,68,68,0.06)' : '#fff',
              color: on ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              textAlign: 'left',
            }}
          >
            <span style={{
              width: 16, height: 16, borderRadius: 4,
              border: '1.5px solid ' + (on ? 'var(--color-accent-active)' : 'var(--color-border)'),
              background: on ? 'var(--color-accent-active)' : '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {on && <Check size={11} color="#fff" strokeWidth={3} />}
            </span>
            {a}
          </button>
        );
      })}
    </div>
  );
}

function NutritionGrid({ value, onChange }: {
  value: Product['nutrition'];
  onChange: (v: Product['nutrition']) => void;
}) {
  const fields: { key: keyof Product['nutrition']; label: string }[] = [
    { key: 'energyKj', label: 'Energy (kJ)' },
    { key: 'energyKcal', label: 'Energy (kcal)' },
    { key: 'fat', label: 'Fat (g)' },
    { key: 'saturates', label: 'Saturates (g)' },
    { key: 'carbs', label: 'Carbohydrates (g)' },
    { key: 'totalSugar', label: 'Total sugar (g)' },
    { key: 'protein', label: 'Protein (g)' },
    { key: 'salt', label: 'Salt (g)' },
    { key: 'fibre', label: 'Fibre (g)' },
  ];
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: 12,
    }}>
      {fields.map((f) => (
        <div key={f.key as string}>
          <div style={{ ...fieldLabelStyle, fontSize: 12.5, marginBottom: 4 }}>{f.label}</div>
          <input
            type="number"
            value={value[f.key] ?? ''}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) })}
            style={inputStyle}
          />
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Style tokens

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--color-text-muted)',
};
const fieldLabelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)',
  marginBottom: 6,
};
const countSuffixStyle: React.CSSProperties = {
  fontSize: 12.5, color: 'var(--color-text-muted)', textTransform: 'none',
  letterSpacing: 0, fontWeight: 500,
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--color-border)',
  background: '#fff',
  fontSize: 14, fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  outline: 'none',
};
const backBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'transparent', border: 'none',
  color: 'var(--color-text-muted)',
  fontSize: 13, fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer', padding: '6px 0',
};
const primaryBtnStyle: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 10, border: 'none',
  color: '#fff', fontSize: 13, fontWeight: 700,
  fontFamily: 'var(--font-primary)',
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 10,
  border: '1px solid var(--color-border)', background: '#fff',
  color: 'var(--color-text-primary)',
  fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-primary)',
};
const dangerBtnStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--color-error-border)',
  background: '#fff',
  color: 'var(--color-error)',
  fontSize: 12.5, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-primary)',
  display: 'inline-flex', alignItems: 'center', gap: 5,
};
const quinnBtnStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-accent-active)',
  fontSize: 12.5, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'var(--font-primary)',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};
const miniBtnStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-text-secondary)',
  fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-primary)',
};

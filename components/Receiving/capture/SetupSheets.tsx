'use client';

import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Plus, Store, X } from 'lucide-react';
import { ALL_CATEGORIES, ALL_CLASSES, ALL_SITES } from '@/components/Suppliers/fixtures';
import {
  ALLERGEN_OPTIONS,
  ALTERNATIVE_UNIT_TYPE_OPTIONS,
  NUTRITION_KEYS,
  PACK_TYPE_OPTIONS,
  SINGLE_UNIT_TYPE_OPTIONS,
  STATUS_OPTIONS,
  TAG_OPTIONS,
  UNIT_OF_MEASURE_OPTIONS,
  type SelectOption,
} from './productOptions';
import { gbp } from './review';
import type { ProductMore, ProductSeed, Sample, SupplierDetails, SupplierSeed } from './samples';
import { C, Field, inputStyle, PrimaryButton, Segmented, Sheet } from './ui';

const ERROR = '#B42318';
const FOOD_CATEGORIES = ['Dairy', 'Bakery', 'Produce', 'Meat', 'Seafood', 'Pantry'];

function num(s: string): number {
  const n = Number(s.replace(/[£,\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

interface ProductForm {
  name: string;
  code: string;
  packType: string;
  packQty: string;
  packCost: string;
  vatRate: string;
  singleUnitType: string;
  unitSize: string;
  unitOfMeasure: string;
  master: string;
  more: ProductMore;
}

function toForm(p: ProductSeed, site: string): ProductForm {
  return {
    name: p.name,
    code: p.code,
    packType: p.packType,
    packQty: String(p.packQty),
    packCost: p.packCost.toFixed(2),
    vatRate: p.vatRate == null ? '' : String(p.vatRate),
    singleUnitType: p.singleUnitType,
    unitSize: p.unitSize ? String(p.unitSize) : '',
    unitOfMeasure: p.unitOfMeasure ?? '',
    master: p.master,
    more: {
      status: 'ACTIVE',
      productClass: 'General',
      category: 'Other',
      tags: [],
      allowSplitPack: false,
      forceMultiples: false,
      alternatives: [
        { type: '', units: '' },
        { type: '', units: '' },
      ],
      sites: [site],
      contains: [],
      traces: [],
      nutrition: {},
      excludeFromCogs: false,
      useActualCost: false,
      leftOffStocktakes: false,
      ...p.more,
    },
  };
}

/** The product page's rules, plus a master product so recipes can use it. */
function validate(f: ProductForm): Partial<Record<keyof ProductForm, string>> {
  const e: Partial<Record<keyof ProductForm, string>> = {};
  if (!f.name.trim()) e.name = 'Name is required';
  if (!f.code.trim()) e.code = 'Supplier product code is required';
  if (!f.packType) e.packType = 'Pack type is required';
  if (!f.packQty.trim()) e.packQty = 'Pack quantity is required';
  else if (!(num(f.packQty) >= 1)) e.packQty = 'Pack quantity must be at least 1';
  if (!f.packCost.trim()) e.packCost = 'Pack cost is required';
  else if (Number.isNaN(num(f.packCost))) e.packCost = 'Pack cost must be a number';
  if (f.vatRate.trim() && !(num(f.vatRate) >= 0 && num(f.vatRate) <= 100)) e.vatRate = 'Enter a VAT percentage between 0 and 100';
  if (!f.singleUnitType) e.singleUnitType = 'Single unit type is required';
  else if (f.singleUnitType === f.packType) e.singleUnitType = 'Single unit type must differ from pack type';
  if (f.unitSize.trim() && !(num(f.unitSize) > 0)) e.unitSize = 'Must be a positive number';
  else if (f.unitSize.trim() && !f.unitOfMeasure) e.unitOfMeasure = 'Pick a unit of measure for this size';
  else if (!f.unitSize.trim() && f.unitOfMeasure && f.unitOfMeasure !== 'EACH' && f.unitOfMeasure !== 'N/A') e.unitSize = 'Add the size for this unit';
  if (!f.master.trim()) e.master = 'Link a master product so recipes can use it';
  return e;
}

function selectStyle(invalid?: boolean): CSSProperties {
  return { ...inputStyle, borderColor: invalid ? ERROR : inputStyle.borderColor };
}

function Select({ value, options, onChange, placeholder, invalid, required }: { value: string; options: SelectOption[]; onChange: (v: string) => void; placeholder?: string; invalid?: boolean; required?: boolean }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-invalid={invalid || undefined} aria-required={required || undefined} style={selectStyle(invalid)}>
      {placeholder && (
        <option value="" disabled={required}>
          {placeholder}
        </option>
      )}
      {options.map(o => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted, whiteSpace: 'nowrap' }}>{children}</span>
      <span aria-hidden style={{ flex: 1, height: 1, background: C.subtle }} />
    </div>
  );
}

/** Two short fields side by side, stacking when there isn't room. */
function Pair({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18, alignItems: 'start' }}>{children}</div>;
}

/** Label and hint for a control that isn't a single input, so it can't sit inside a <label>. */
function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <div id={id} style={{ fontSize: 14, fontWeight: 600, marginBottom: hint ? 2 : 6 }}>
        {label}
      </div>
      {hint && <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.4, marginBottom: 8 }}>{hint}</div>}
      {children}
    </div>
  );
}

function Pills({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter(v => v !== o) : [...value, o])}
            style={{
              minHeight: 36,
              padding: '0 12px',
              borderRadius: 999,
              border: on ? `1.5px solid ${C.navy}` : `1.5px solid ${C.border}`,
              background: on ? C.navy : '#fff',
              color: on ? '#fff' : C.ink,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function SwitchRow({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        width: '100%',
        minHeight: 44,
        padding: '6px 0',
        border: 'none',
        background: 'transparent',
        textAlign: 'left',
        fontFamily: 'var(--font-primary)',
        color: C.ink,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span aria-hidden style={{ position: 'relative', flexShrink: 0, width: 44, height: 26, borderRadius: 999, background: checked ? C.navy : '#C9C4BE', marginTop: 1, transition: 'background 0.15s' }}>
        <span style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
      </span>
      <span>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>{label}</span>
        {hint && <span style={{ display: 'block', fontSize: 14, color: C.muted, lineHeight: 1.4, marginTop: 2 }}>{hint}</span>}
      </span>
    </button>
  );
}

function SmallButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ minHeight: 36, padding: '0 14px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: '#fff', color: C.ink, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer' }}
    >
      {children}
    </button>
  );
}

/** Set up a product that came in but isn't in the catalogue, with the product page's fields, filled in from the paper. */
export function ProductSetupSheet({
  sample,
  initial,
  isPhone,
  onSave,
  onClose,
}: {
  sample: Sample;
  initial: ProductSeed;
  isPhone: boolean;
  onSave: (p: ProductSeed) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(() => toForm(initial, sample.site));
  const [moreOpen, setMoreOpen] = useState(false);
  const [tried, setTried] = useState(false);
  const moreId = useId();

  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setF(p => ({ ...p, [k]: v }));
  const setMore = <K extends keyof ProductMore>(k: K, v: ProductMore[K]) => setF(p => ({ ...p, more: { ...p.more, [k]: v } }));
  const setAlt = (i: number, patch: Partial<ProductMore['alternatives'][number]>) =>
    setMore(
      'alternatives',
      f.more.alternatives.map((a, j) => (j === i ? { ...a, ...patch } : a)),
    );

  const errors = validate(f);
  const errorCount = Object.keys(errors).length;
  const err = (k: keyof ProductForm) => (tried ? errors[k] : undefined);
  const kind = sample.kind === 'receipt' ? 'receipt' : sample.kind === 'invoice' ? 'invoice' : 'delivery note';
  const master = f.master.trim();
  const masterIsNew = master === initial.master ? initial.masterIsNew : true;
  const qty = num(f.packQty);
  const cost = num(f.packCost);
  const m = f.more;

  const moreSummary = [
    m.status === 'ACTIVE' ? 'Available' : 'Unavailable',
    m.productClass,
    m.category,
    m.sites.length === 1 ? m.sites[0] : `${m.sites.length} sites`,
    m.contains.length ? `${m.contains.length} allergen${m.contains.length === 1 ? '' : 's'}` : FOOD_CATEGORIES.includes(m.category) ? 'No allergens set' : null,
  ]
    .filter(Boolean)
    .join(' \u00b7 ');

  function save() {
    if (errorCount) {
      setTried(true);
      setTimeout(() => (document.querySelector('[data-setup-sheet] [aria-invalid="true"]') as HTMLElement | null)?.focus(), 0);
      return;
    }
    onSave({
      name: f.name.trim(),
      code: f.code.trim(),
      codeOnPaper: f.code.trim() === initial.code ? initial.codeOnPaper : true,
      packType: f.packType,
      packQty: qty,
      packCost: cost,
      vatRate: f.vatRate.trim() ? num(f.vatRate) : null,
      singleUnitType: f.singleUnitType,
      unitSize: f.unitSize.trim() ? num(f.unitSize) : undefined,
      unitOfMeasure: f.unitOfMeasure || undefined,
      master,
      masterIsNew,
      more: m,
    });
  }

  return (
    <Sheet
      title={`Add ${initial.name}`}
      subtitle={`Filled in from the ${sample.supplier} ${kind}. Check it against the pack.`}
      isPhone={isPhone}
      width={600}
      onClose={onClose}
      footer={
        <>
          {tried && errorCount > 0 && (
            <div role="alert" style={{ fontSize: 14, fontWeight: 600, color: ERROR, marginBottom: 10 }}>
              {errorCount === 1 ? 'One field needs fixing.' : `${errorCount} fields need fixing.`}
            </div>
          )}
          <PrimaryButton onClick={save}>Add to catalogue</PrimaryButton>
        </>
      }
    >
      <div data-setup-sheet style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SectionHeading>Basics</SectionHeading>
        <Field label="Name" required error={err('name')}>
          <input value={f.name} onChange={e => set('name', e.target.value)} maxLength={150} aria-required aria-invalid={!!err('name') || undefined} style={selectStyle(!!err('name'))} />
        </Field>
        <Pair>
          <Field label="Supplier product code" required error={err('code')}>
            <input value={f.code} onChange={e => set('code', e.target.value)} maxLength={100} aria-required aria-invalid={!!err('code') || undefined} style={selectStyle(!!err('code'))} />
          </Field>
          <Field label="Master product" required error={err('master')}>
            <input value={f.master} onChange={e => set('master', e.target.value)} placeholder="Link a master product…" aria-required aria-invalid={!!err('master') || undefined} style={selectStyle(!!err('master'))} />
          </Field>
        </Pair>

        <SectionHeading>Pack &amp; price</SectionHeading>
        <Pair>
          <Field label="Pack type" required error={err('packType')}>
            <Select value={f.packType} options={PACK_TYPE_OPTIONS} onChange={v => set('packType', v)} placeholder="Select pack type…" required invalid={!!err('packType')} />
          </Field>
          <Field label="Pack quantity" required error={err('packQty')}>
            <input value={f.packQty} onChange={e => set('packQty', e.target.value)} inputMode="decimal" aria-required aria-invalid={!!err('packQty') || undefined} style={selectStyle(!!err('packQty'))} />
          </Field>
        </Pair>
        <Pair>
          <Field label="Pack cost" required error={err('packCost')}>
            <div style={{ position: 'relative' }}>
              <span aria-hidden style={{ position: 'absolute', left: 14, top: 13, fontSize: 16, color: C.muted }}>
                £
              </span>
              <input value={f.packCost} onChange={e => set('packCost', e.target.value)} inputMode="decimal" aria-required aria-invalid={!!err('packCost') || undefined} style={{ ...selectStyle(!!err('packCost')), paddingLeft: 30 }} />
            </div>
          </Field>
          <Field label="VAT (%)" error={err('vatRate')}>
            <input value={f.vatRate} onChange={e => set('vatRate', e.target.value)} inputMode="decimal" aria-invalid={!!err('vatRate') || undefined} style={selectStyle(!!err('vatRate'))} />
          </Field>
        </Pair>
        <Pair>
          <Field label="Single unit type" required error={err('singleUnitType')}>
            <Select value={f.singleUnitType} options={SINGLE_UNIT_TYPE_OPTIONS} onChange={v => set('singleUnitType', v)} placeholder="Select single unit type…" required invalid={!!err('singleUnitType')} />
          </Field>
          <Group label="Unit cost">
            <div aria-live="polite" style={{ ...inputStyle, display: 'flex', alignItems: 'center', background: C.page, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {qty >= 1 && cost > 0 ? gbp(cost / qty) : '\u2014'}
            </div>
          </Group>
        </Pair>
        <Pair>
          <Field label="Single item volume / weight" error={err('unitSize')}>
            <input value={f.unitSize} onChange={e => set('unitSize', e.target.value)} inputMode="decimal" aria-invalid={!!err('unitSize') || undefined} style={selectStyle(!!err('unitSize'))} />
          </Field>
          <Field label="Unit of measure" error={err('unitOfMeasure')}>
            <Select value={f.unitOfMeasure} options={UNIT_OF_MEASURE_OPTIONS} onChange={v => set('unitOfMeasure', v)} placeholder="Select unit of measure…" invalid={!!err('unitOfMeasure')} />
          </Field>
        </Pair>

        <div style={{ borderTop: `1px solid ${C.subtle}`, marginTop: 4 }}>
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls={moreId}
            onClick={() => setMoreOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', minHeight: 56, padding: '14px 0 4px', border: 'none', background: 'transparent', textAlign: 'left', fontFamily: 'var(--font-primary)', color: C.ink, cursor: 'pointer' }}
          >
            {moreOpen ? <ChevronDown size={20} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} /> : <ChevronRight size={20} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />}
            <span>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>More details</span>
              <span style={{ display: 'block', fontSize: 14, color: C.muted, lineHeight: 1.4, marginTop: 2 }}>
                Not on the {kind}. {moreSummary}
              </span>
            </span>
          </button>
        </div>

        {moreOpen && (
          <div id={moreId} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <SectionHeading>Basics</SectionHeading>
            <Group label="Status">
              <Segmented label="Status" value={m.status} onChange={v => setMore('status', v)} options={STATUS_OPTIONS.map(o => ({ id: o.id, label: o.label }))} />
            </Group>
            <Pair>
              <Field label="Class">
                <Select value={m.productClass} options={ALL_CLASSES.map(c => ({ id: c, label: c }))} onChange={v => setMore('productClass', v)} />
              </Field>
              <Field label="Category">
                <Select value={m.category} options={ALL_CATEGORIES.map(c => ({ id: c, label: c }))} onChange={v => setMore('category', v)} />
              </Field>
            </Pair>
            <Group label="Tags">
              <Pills options={TAG_OPTIONS} value={m.tags} onChange={v => setMore('tags', v)} />
            </Group>

            <SectionHeading>Ordering</SectionHeading>
            <SwitchRow label="Allow split pack" checked={m.allowSplitPack} disabled={m.forceMultiples} onChange={v => setMore('allowSplitPack', v)} />
            <SwitchRow label="Force ordering by pack quantity multiples" checked={m.forceMultiples} disabled={m.allowSplitPack} onChange={v => setMore('forceMultiples', v)} />

            <SectionHeading>Alternative units of measure</SectionHeading>
            {m.alternatives.map((a, i) => (
              <Pair key={i}>
                <Field label={`Alternative ${i + 1} unit type`}>
                  <Select value={a.type} options={ALTERNATIVE_UNIT_TYPE_OPTIONS} onChange={v => setAlt(i, { type: v })} />
                </Field>
                <Field label={`Alternative ${i + 1} number of units`}>
                  <input
                    value={a.type ? a.units : ''}
                    onChange={e => setAlt(i, { units: e.target.value })}
                    disabled={!a.type}
                    placeholder={a.type ? undefined : 'Select a unit type first'}
                    inputMode="decimal"
                    style={{ ...inputStyle, background: a.type ? '#fff' : C.page }}
                  />
                </Field>
              </Pair>
            ))}

            <SectionHeading>Site availability</SectionHeading>
            <Group label="Sites">
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <SmallButton onClick={() => setMore('sites', [...ALL_SITES])}>All</SmallButton>
                <SmallButton onClick={() => setMore('sites', [])}>None</SmallButton>
              </div>
              <Pills options={ALL_SITES} value={m.sites} onChange={v => setMore('sites', v)} />
            </Group>

            <SectionHeading>Food details</SectionHeading>
            <Group label="Contains allergens">
              <Pills options={ALLERGEN_OPTIONS} value={m.contains} onChange={v => setMore('contains', v)} />
            </Group>
            <Group label="Traces of allergens">
              <Pills options={ALLERGEN_OPTIONS} value={m.traces} onChange={v => setMore('traces', v)} />
            </Group>
            <Group label="Nutritional information (per 100 g)">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {NUTRITION_KEYS.map(n => (
                  <Field key={n.key} label={n.label}>
                    <input
                      value={m.nutrition[n.key] ?? ''}
                      onChange={e => {
                        const next = { ...m.nutrition };
                        if (e.target.value === '') delete next[n.key];
                        else next[n.key] = e.target.value;
                        setMore('nutrition', next);
                      }}
                      inputMode="decimal"
                      style={inputStyle}
                    />
                  </Field>
                ))}
              </div>
            </Group>

            <SectionHeading>Advanced</SectionHeading>
            <SwitchRow
              label="Exclude from COGS"
              hint="When on, this product’s cost is omitted from cost-of-goods-sold reporting."
              checked={m.excludeFromCogs}
              onChange={v => setMore('excludeFromCogs', v)}
            />
            <SwitchRow
              label="Use actual cost for theoretical COGS"
              hint="When on, theoretical COGS uses this product’s actual paid price instead of an averaged figure."
              checked={m.useActualCost}
              onChange={v => setMore('useActualCost', v)}
            />
            <SwitchRow
              label="Don’t count in stocktakes"
              hint="When on, nothing asks for a storage area for it. Putting it in an area counts it anyway."
              checked={m.leftOffStocktakes}
              onChange={v => setMore('leftOffStocktakes', v)}
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** Add a shop from a receipt. Shops are never ordered from. */
const SUPPLIER_CATEGORIES = ['Alcohol', 'Bakery', 'Beverage', 'Chilled', 'Cleaning', 'Coffee', 'Dairy', 'Dry', 'Frozen', 'Fruit & Veg', 'Meat', 'Packaging', 'Pastry', 'Retail', 'Seafood'];
const CURRENCY_OPTIONS: SelectOption[] = [
  { id: 'GBP', label: 'GBP \u00b7 British Pound' },
  { id: 'EUR', label: 'EUR \u00b7 Euro' },
  { id: 'USD', label: 'USD \u00b7 US Dollar' },
];
const PHONE_CODES: SelectOption[] = ['+44', '+353', '+33', '+49', '+1'].map(c => ({ id: c, label: c }));
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function shopDetails(s: SupplierSeed, site: string): SupplierDetails {
  const notes = [s.branch, s.vatNumber ? `VAT number ${s.vatNumber}` : ''].filter(Boolean).join('\n');
  return {
    status: 'ACTIVE',
    currency: 'GBP',
    categories: [],
    contactName: '',
    phones: [{ code: '+44', number: '' }],
    orderEmail: '',
    ccEmails: [],
    accountsEmails: [''],
    sendOrdersByEmail: false,
    sendOrdersByWebhook: false,
    webhookUrl: '',
    minimumOrderValue: '',
    autoUpdatePrices: false,
    allowDeliveryPriceAdjustments: true,
    includeInPredicted: false,
    cutOffs: Object.fromEntries(WEEKDAYS.map(d => [d, null])),
    sites: [site],
    companyAccountNumber: '',
    notes,
    ...s.details,
  };
}

/** The New supplier page's rules, except the order email: a shop has none, so it's only needed when orders go by email. */
function validateSupplier(name: string, d: SupplierDetails): Record<string, string> {
  const e: Record<string, string> = {};
  if (!name.trim()) e.name = 'Enter a supplier name';
  if (!d.currency) e.currency = 'Choose a currency';
  if (d.sendOrdersByEmail && !d.orderEmail.trim()) e.orderEmail = 'Add an order email to send orders by email';
  else if (d.orderEmail.trim() && !EMAIL.test(d.orderEmail.trim())) e.orderEmail = 'Enter a valid email';
  d.phones.forEach((p, i) => {
    if (p.number.trim() && !/^\d{6,15}$/.test(p.number.replace(/\s/g, ''))) e[`phone${i}`] = 'Enter a valid phone number';
  });
  d.ccEmails.forEach((v, i) => {
    if (!EMAIL.test(v.trim())) e[`cc${i}`] = 'Enter a valid email';
  });
  d.accountsEmails.forEach((v, i) => {
    if (v.trim() && !EMAIL.test(v.trim())) e[`acc${i}`] = 'Enter a valid email';
  });
  if (d.webhookUrl.trim() && !/^https?:\/\/\S+$/.test(d.webhookUrl.trim())) e.webhookUrl = 'Enter a valid URL';
  if (d.minimumOrderValue.trim() && !/^\d+(\.\d{1,2})?$/.test(d.minimumOrderValue.trim())) e.minimumOrderValue = 'Enter an amount like 50 or 50.00';
  return e;
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{ width: 44, height: 48, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer' }}
    >
      <X size={18} />
    </button>
  );
}

function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <SmallButton onClick={onClick}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Plus size={16} aria-hidden /> {children}
      </span>
    </SmallButton>
  );
}

function EmailRows({
  label,
  values,
  max,
  min = 0,
  addLabel,
  errorKey,
  errors,
  onChange,
}: {
  label: string;
  values: string[];
  max: number;
  min?: number;
  addLabel: string;
  errorKey: string;
  errors: Record<string, string>;
  onChange: (v: string[]) => void;
}) {
  return (
    <Group label={label}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {values.map((v, i) => (
          <div key={i}>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="email"
                aria-label={`${label} ${i + 1}`}
                value={v}
                onChange={e => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
                aria-invalid={!!errors[`${errorKey}${i}`] || undefined}
                style={selectStyle(!!errors[`${errorKey}${i}`])}
              />
              {values.length > min && <RemoveButton label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(values.filter((_, j) => j !== i))} />}
            </div>
            {errors[`${errorKey}${i}`] && <div style={{ fontSize: 14, fontWeight: 600, color: ERROR, marginTop: 6 }}>{errors[`${errorKey}${i}`]}</div>}
          </div>
        ))}
        {values.length < max && (
          <div>
            <AddButton onClick={() => onChange([...values, ''])}>{addLabel}</AddButton>
          </div>
        )}
      </div>
    </Group>
  );
}

/** Add a shop from a receipt, with the New supplier page's fields. A shop is a supplier nobody orders from. */
export function SupplierSheet({
  initial,
  site,
  isPhone,
  onSave,
  onClose,
}: {
  initial: SupplierSeed;
  site: string;
  isPhone: boolean;
  onSave: (s: SupplierSeed) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [d, setD] = useState(() => shopDetails(initial, site));
  const [moreOpen, setMoreOpen] = useState(false);
  const [tried, setTried] = useState(false);
  const moreId = useId();
  const set = <K extends keyof SupplierDetails>(k: K, v: SupplierDetails[K]) => setD(p => ({ ...p, [k]: v }));

  const errors = validateSupplier(name, d);
  const errorCount = Object.keys(errors).length;
  const shown = tried ? errors : {};
  const err = (k: string) => shown[k];
  const openDays = WEEKDAYS.filter(day => d.cutOffs[day]);
  const contactCount = [d.contactName, d.orderEmail, ...d.phones.map(p => p.number), ...d.ccEmails, ...d.accountsEmails].filter(v => v.trim()).length;

  const moreSummary = [
    d.status === 'ACTIVE' ? 'Available' : 'Unavailable',
    d.currency,
    d.sendOrdersByEmail || d.sendOrdersByWebhook || openDays.length ? 'Ordering on' : 'No ordering',
    contactCount ? `${contactCount} contact detail${contactCount === 1 ? '' : 's'}` : 'No contact details',
  ].join(' \u00b7 ');

  function save() {
    if (errorCount) {
      setTried(true);
      if (Object.keys(errors).some(k => k !== 'name')) setMoreOpen(true);
      setTimeout(() => (document.querySelector('[data-setup-sheet] [aria-invalid="true"]') as HTMLElement | null)?.focus(), 0);
      return;
    }
    onSave({ name: name.trim(), branch: initial.branch, vatNumber: initial.vatNumber, details: d });
  }

  return (
    <Sheet
      title={`Add ${initial.name}`}
      subtitle="Filled in from the receipt. Set up as a shop, so nobody orders from it."
      isPhone={isPhone}
      width={600}
      onClose={onClose}
      footer={
        <>
          {tried && errorCount > 0 && (
            <div role="alert" style={{ fontSize: 14, fontWeight: 600, color: ERROR, marginBottom: 10 }}>
              {errorCount === 1 ? 'One field needs fixing.' : `${errorCount} fields need fixing.`}
            </div>
          )}
          <PrimaryButton onClick={save}>Add {name.trim() || 'shop'}</PrimaryButton>
        </>
      }
    >
      <div data-setup-sheet style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SectionHeading>Basics</SectionHeading>
        <Field label="Name" required error={err('name')}>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={100} aria-required aria-invalid={!!err('name') || undefined} style={selectStyle(!!err('name'))} />
        </Field>
        <Group label="Categories">
          <Pills options={SUPPLIER_CATEGORIES} value={d.categories} onChange={v => set('categories', v)} />
        </Group>

        <SectionHeading>Sites</SectionHeading>
        <Group label="Sites that can use it">
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <SmallButton onClick={() => set('sites', [...ALL_SITES])}>All</SmallButton>
            <SmallButton onClick={() => set('sites', [])}>None</SmallButton>
          </div>
          <Pills options={ALL_SITES} value={d.sites} onChange={v => set('sites', v)} />
        </Group>

        <SectionHeading>Notes</SectionHeading>
        <Field label="Internal notes">
          <textarea value={d.notes} onChange={e => set('notes', e.target.value)} rows={3} maxLength={2000} style={{ ...inputStyle, height: 'auto', padding: '10px 14px', lineHeight: 1.45, resize: 'vertical' }} />
        </Field>

        <div style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12, background: C.page, fontSize: 14, lineHeight: 1.5 }}>
          <Store size={20} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <span style={{ fontWeight: 600 }}>No ordering.</span>{' '}It won&rsquo;t show up when you place orders, and what you buy here counts as off-contract spend.
          </span>
        </div>

        <div style={{ borderTop: `1px solid ${C.subtle}`, marginTop: 4 }}>
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls={moreId}
            onClick={() => setMoreOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', minHeight: 56, padding: '14px 0 4px', border: 'none', background: 'transparent', textAlign: 'left', fontFamily: 'var(--font-primary)', color: C.ink, cursor: 'pointer' }}
          >
            {moreOpen ? <ChevronDown size={20} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} /> : <ChevronRight size={20} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />}
            <span>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>More details</span>
              <span style={{ display: 'block', fontSize: 14, color: C.muted, lineHeight: 1.4, marginTop: 2 }}>Not on the receipt. {moreSummary}</span>
            </span>
          </button>
        </div>

        {moreOpen && (
          <div id={moreId} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <SectionHeading>Status &amp; currency</SectionHeading>
            <Pair>
              <Group label="Status">
                <Segmented label="Status" value={d.status} onChange={v => set('status', v)} options={STATUS_OPTIONS.map(o => ({ id: o.id, label: o.label }))} />
              </Group>
              <Field label="Currency" required error={err('currency')}>
                <Select value={d.currency} options={CURRENCY_OPTIONS} onChange={v => set('currency', v)} placeholder="Select a currency…" required invalid={!!err('currency')} />
              </Field>
            </Pair>

            <SectionHeading>Contact</SectionHeading>
            <Field label="Contact name">
              <input value={d.contactName} onChange={e => set('contactName', e.target.value)} maxLength={100} style={inputStyle} />
            </Field>
            <Group label="Phone numbers">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {d.phones.map((p, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ width: 96, flexShrink: 0 }}>
                        <Select value={p.code} options={PHONE_CODES} onChange={v => set('phones', d.phones.map((x, j) => (j === i ? { ...x, code: v } : x)))} />
                      </div>
                      <input
                        type="tel"
                        aria-label={`Phone number ${i + 1}`}
                        placeholder="Phone number"
                        value={p.number}
                        onChange={e => set('phones', d.phones.map((x, j) => (j === i ? { ...x, number: e.target.value } : x)))}
                        aria-invalid={!!err(`phone${i}`) || undefined}
                        style={selectStyle(!!err(`phone${i}`))}
                      />
                      {d.phones.length > 1 && <RemoveButton label={`Remove phone number ${i + 1}`} onClick={() => set('phones', d.phones.filter((_, j) => j !== i))} />}
                    </div>
                    {err(`phone${i}`) && <div style={{ fontSize: 14, fontWeight: 600, color: ERROR, marginTop: 6 }}>{err(`phone${i}`)}</div>}
                  </div>
                ))}
                {d.phones.length < 4 && (
                  <div>
                    <AddButton onClick={() => set('phones', [...d.phones, { code: '+44', number: '' }])}>Add phone</AddButton>
                  </div>
                )}
              </div>
            </Group>
            <Field label="Order email" required={d.sendOrdersByEmail} error={err('orderEmail')}>
              <input
                type="email"
                value={d.orderEmail}
                onChange={e => set('orderEmail', e.target.value)}
                placeholder={d.sendOrdersByEmail ? undefined : 'None. Leave blank for a shop'}
                aria-required={d.sendOrdersByEmail || undefined}
                aria-invalid={!!err('orderEmail') || undefined}
                style={selectStyle(!!err('orderEmail'))}
              />
            </Field>
            <EmailRows label="CC emails" values={d.ccEmails} max={25} addLabel="Add CC email" errorKey="cc" errors={shown} onChange={v => set('ccEmails', v)} />
            <EmailRows label="Accounts emails" values={d.accountsEmails} max={4} min={1} addLabel="Add accounts email" errorKey="acc" errors={shown} onChange={v => set('accountsEmails', v)} />

            <SectionHeading>Ordering</SectionHeading>
            <SwitchRow label="Send orders by email" checked={d.sendOrdersByEmail} onChange={v => set('sendOrdersByEmail', v)} />
            <SwitchRow label="Send orders by webhook" checked={d.sendOrdersByWebhook} onChange={v => set('sendOrdersByWebhook', v)} />
            {d.sendOrdersByWebhook && (
              <Field label="Webhook URL" error={err('webhookUrl')}>
                <input value={d.webhookUrl} onChange={e => set('webhookUrl', e.target.value)} inputMode="url" aria-invalid={!!err('webhookUrl') || undefined} style={selectStyle(!!err('webhookUrl'))} />
              </Field>
            )}
            <Pair>
              <Field label="Minimum order value" error={err('minimumOrderValue')}>
                <input value={d.minimumOrderValue} onChange={e => set('minimumOrderValue', e.target.value)} inputMode="decimal" aria-invalid={!!err('minimumOrderValue') || undefined} style={selectStyle(!!err('minimumOrderValue'))} />
              </Field>
              <Group label="Product price updates">
                <Segmented
                  label="Product price updates"
                  value={d.autoUpdatePrices ? 'auto' : 'manual'}
                  onChange={v => set('autoUpdatePrices', v === 'auto')}
                  options={[
                    { id: 'manual', label: 'Manual' },
                    { id: 'auto', label: 'Automatic' },
                  ]}
                />
              </Group>
            </Pair>
            <SwitchRow
              label="Allow employees and managers to adjust delivery prices"
              hint="Off means only admins can change a line price when receiving from this supplier."
              checked={d.allowDeliveryPriceAdjustments}
              onChange={v => set('allowDeliveryPriceAdjustments', v)}
            />
            <SwitchRow
              label="Include this supplier in predicted orders"
              hint="Off for a shop, so it never appears in predicted orders."
              checked={d.includeInPredicted}
              onChange={v => set('includeInPredicted', v)}
            />

            <SectionHeading>Cut-off times</SectionHeading>
            <div role="group" aria-label="Cut-off times" style={{ display: 'flex', flexDirection: 'column' }}>
              {WEEKDAYS.map(day => {
                const time = d.cutOffs[day];
                return (
                  <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, width: 150, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={time != null}
                        onChange={e => set('cutOffs', { ...d.cutOffs, [day]: e.target.checked ? '14:00' : null })}
                        style={{ width: 18, height: 18, margin: 0, accentColor: '#001C35' }}
                      />
                      {day}
                    </label>
                    {time != null ? (
                      <input
                        type="time"
                        aria-label={`${day} cut-off time`}
                        value={time}
                        onChange={e => set('cutOffs', { ...d.cutOffs, [day]: e.target.value })}
                        style={{ ...inputStyle, width: 140, height: 40 }}
                      />
                    ) : (
                      <span style={{ fontSize: 14, color: C.muted }}>No delivery</span>
                    )}
                  </div>
                );
              })}
            </div>

            <SectionHeading>Account numbers</SectionHeading>
            <Field label="Company account number">
              <input value={d.companyAccountNumber} onChange={e => set('companyAccountNumber', e.target.value)} maxLength={50} style={inputStyle} />
            </Field>
          </div>
        )}
      </div>
    </Sheet>
  );
}

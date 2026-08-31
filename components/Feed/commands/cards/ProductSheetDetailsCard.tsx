'use client';

import { useState } from 'react';
import { FileText, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import CardShell, { FieldRow, PillRow, type CardState } from './CardShell';
import {
  ALL_ALLERGENS,
  ALL_CATEGORIES,
  ALL_CLASSES,
  type Allergen,
  type AltUom,
} from '@/components/Suppliers/fixtures';

type UnitType = 'Each' | 'g' | 'kg' | 'ml' | 'L';
const UNIT_OPTIONS: UnitType[] = ['Each', 'g', 'kg', 'ml', 'L'];

/** What the operator confirms — the parsed values plus every base-
 *  product setting, corrected where the sheet or our assumptions got
 *  them wrong. Merged back into the flow args so the recipe sweep,
 *  the product record and the receipt all carry the fix. */
export interface ProductSheetDetailsSubmit {
  newProductName: string;
  /** Class and category are open strings: the operator can mint a new
   *  one inline, matching the production form's Manage buttons. */
  productClass: string;
  category: string;
  packQty: number;
  packCost: number;
  unitType: UnitType;
  unitOfMeasure: UnitType;
  singleUnitVolumeOrWeight?: number;
  allergens: Allergen[];
  supplierCode: string;
  taxRatePct: number;
  altUoms: AltUom[];
  allowSplitPack: boolean;
  forceMultiples: boolean;
  excludeFromCogs: boolean;
  useActualUseForTheoreticalCogs: boolean;
  /** True when the operator changed anything — drives the echo copy. */
  edited: boolean;
}

interface ProductSheetDetailsCardProps {
  state: CardState;
  /** The sheet we parsed the product from — shown as provenance. */
  fileName: string;
  newProductName: string;
  supplierName: string;
  productClass?: string;
  category: string;
  packType: 'Pack' | 'Single';
  packQty: number;
  packCost: number;
  unitType: string;
  /** Volume/weight of a single unit (e.g. 1 for a 1kg bag). */
  singleUnitVolumeOrWeight?: number;
  allergens: string[];
  /** The existing product this will swap out, for the "matches" note. */
  oldProductName: string;
  // ── Base-product settings: parsed from the sheet or assumed by rule.
  supplierCode?: string;
  taxRatePct?: number;
  altUoms?: AltUom[];
  allowSplitPack?: boolean;
  forceMultiples?: boolean;
  excludeFromCogs?: boolean;
  useActualUseForTheoreticalCogs?: boolean;
  onConfirm: (input: ProductSheetDetailsSubmit) => void;
  onCancel: () => void;
}

/**
 * First confirmation of the sheet-driven product swap. We've parsed the
 * supplier sheet and pulled every field — the operator sanity-checks
 * the new product before we go hunting for the recipes that use the
 * old one.
 *
 * Three layers, matching how sure we can be:
 *  - the headline read-out (name, pack, cost) — parsed, high stakes,
 *    always visible;
 *  - "How I'll set it up" — every remaining base-product setting the
 *    full product form asks for, each marked "from the sheet" or
 *    "assumed" with a one-line why in operator words. Collapsed by
 *    default so the fast confirm path stays fast;
 *  - edit mode — every value overridable in place, so a wrong parse or
 *    a wrong assumption is fixed here, not abandoned.
 *
 * The supplier stays fixed — it wasn't parsed from the sheet, it's
 * ours to hold the product until the real supplier is set up.
 */
export default function ProductSheetDetailsCard({
  state,
  fileName,
  newProductName,
  supplierName,
  productClass,
  category,
  packType,
  packQty,
  packCost,
  unitType,
  singleUnitVolumeOrWeight,
  allergens,
  oldProductName,
  supplierCode,
  taxRatePct,
  altUoms,
  allowSplitPack,
  forceMultiples,
  excludeFromCogs,
  useActualUseForTheoreticalCogs,
  onConfirm,
  onCancel,
}: ProductSheetDetailsCardProps) {
  const [editing, setEditing] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [name, setName] = useState(newProductName);
  // Class and category are open lists: the base options from fixtures
  // plus anything the operator mints inline. Held as plain strings so
  // a new value is a first-class choice, not a cast fight.
  const [cls, setCls] = useState<string>(productClass ?? 'Food');
  const [cat, setCat] = useState<string>(category || 'Other');
  const [classOptions, setClassOptions] = useState<string[]>(() =>
    (ALL_CLASSES as string[]).includes(productClass ?? 'Food')
      ? [...ALL_CLASSES]
      : [...ALL_CLASSES, productClass ?? 'Food'],
  );
  const [catOptions, setCatOptions] = useState<string[]>(() =>
    (ALL_CATEGORIES as string[]).includes(category) ? [...ALL_CATEGORIES] : [...ALL_CATEGORIES, category],
  );
  const [qtyStr, setQtyStr] = useState(String(packQty));
  const [costStr, setCostStr] = useState(String(packCost));
  const [unit, setUnit] = useState<UnitType>(
    (UNIT_OPTIONS as string[]).includes(unitType) ? (unitType as UnitType) : 'kg',
  );
  const [unitSizeStr, setUnitSizeStr] = useState(
    singleUnitVolumeOrWeight != null ? String(singleUnitVolumeOrWeight) : '',
  );
  const [allergenSet, setAllergenSet] = useState<Set<Allergen>>(
    () => new Set(allergens.filter((a): a is Allergen => (ALL_ALLERGENS as string[]).includes(a))),
  );
  // ── Base-product settings state ────────────────────────────────
  const [skuStr, setSkuStr] = useState(supplierCode ?? '');
  const [vatStr, setVatStr] = useState(String(taxRatePct ?? 0));
  const [alts, setAlts] = useState<AltUom[]>(() => (altUoms ?? []).map((a) => ({ ...a })));
  const [splitPack, setSplitPack] = useState(allowSplitPack ?? false);
  const [multiplesOnly, setMultiplesOnly] = useState(forceMultiples ?? false);
  const [outOfCogs, setOutOfCogs] = useState(excludeFromCogs ?? false);
  const [actualCost, setActualCost] = useState(useActualUseForTheoreticalCogs ?? false);

  const qtyNum = Number(qtyStr);
  const costNum = Number(costStr);
  const unitSizeNum = Number(unitSizeStr);
  const qtyValid = qtyStr.trim().length > 0 && Number.isFinite(qtyNum) && qtyNum > 0;
  const costValid = costStr.trim().length > 0 && Number.isFinite(costNum) && costNum > 0;
  const nameValid = name.trim().length > 0;
  const canConfirm = nameValid && qtyValid && costValid;

  const unitSize = unitSizeStr.trim() && Number.isFinite(unitSizeNum) && unitSizeNum > 0 ? unitSizeNum : undefined;
  const unitsInPack = qtyValid ? qtyNum * (unitSize ?? 1) : 0;
  const perUnitCost = unitsInPack > 0 && costValid ? costNum / unitsInPack : null;
  const packLabel = qtyValid && costValid
    ? packType === 'Pack'
      ? `${qtyNum} × ${unitSize ?? 1}${unit} · £${costNum.toFixed(2)}`
      : `${qtyNum}${unit} · £${costNum.toFixed(2)}`
    : '—';

  const cleanAlts = alts.filter((a) => a.type.trim().length > 0 && a.numberOfUnits > 0);

  const edited =
    name !== newProductName ||
    cls !== (productClass ?? 'Food') ||
    cat !== category ||
    qtyNum !== packQty ||
    costNum !== packCost ||
    unit !== unitType ||
    (unitSize ?? undefined) !== (singleUnitVolumeOrWeight ?? undefined) ||
    allergenSet.size !== allergens.length ||
    allergens.some((a) => !allergenSet.has(a as Allergen)) ||
    skuStr !== (supplierCode ?? '') ||
    Number(vatStr) !== (taxRatePct ?? 0) ||
    splitPack !== (allowSplitPack ?? false) ||
    multiplesOnly !== (forceMultiples ?? false) ||
    outOfCogs !== (excludeFromCogs ?? false) ||
    actualCost !== (useActualUseForTheoreticalCogs ?? false) ||
    JSON.stringify(cleanAlts) !== JSON.stringify(altUoms ?? []);

  function toggleAllergen(a: Allergen) {
    setAllergenSet((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a); else next.add(a);
      return next;
    });
  }

  function submit() {
    if (!canConfirm) return;
    onConfirm({
      newProductName: name.trim(),
      productClass: cls,
      category: cat,
      packQty: qtyNum,
      packCost: costNum,
      unitType: unit,
      unitOfMeasure: unit,
      singleUnitVolumeOrWeight: unitSize,
      allergens: Array.from(allergenSet),
      supplierCode: skuStr.trim(),
      taxRatePct: Number(vatStr) || 0,
      altUoms: cleanAlts,
      allowSplitPack: splitPack,
      forceMultiples: multiplesOnly,
      excludeFromCogs: outOfCogs,
      useActualUseForTheoreticalCogs: actualCost,
      edited,
    });
  }

  // ── "How I'll set it up" rows: the base-product settings the full
  //    product form asks for, in operator words. `from` marks whether
  //    the value was read off the sheet or assumed by rule — the
  //    operator should trust sheet values and glance at assumptions.
  const altSummary =
    cleanAlts.length > 0
      ? cleanAlts
          .map((a) => {
            const perPack = qtyValid ? unitsInPack / a.numberOfUnits : null;
            const size = perPack != null && perPack !== 1 ? `${perPack}${unit}` : `1${unit}`;
            return a.numberOfUnits === 1 ? `${a.type} (whole pack)` : `${a.type} (${size})`;
          })
          .join(' · ')
      : 'None';
  const setupRows: { label: string; value: string; from: 'sheet' | 'assumed'; why: string }[] = [
    {
      label: 'Supplier code',
      value: skuStr || 'Not on the sheet',
      from: 'sheet',
      why: 'How invoice lines match back to this product.',
    },
    {
      label: 'VAT',
      value: `${Number(vatStr) || 0}%`,
      from: 'assumed',
      why: 'Coffee beans are zero-rated food.',
    },
    {
      label: 'Counting units',
      value: altSummary,
      from: 'assumed',
      why: `Read from the ${qtyValid ? qtyNum : packQty} × ${unitSize ?? 1}${unit} pack, so orders and stocktakes can count either.`,
    },
    {
      label: 'Ordering',
      value: splitPack ? 'By the bag or the case' : multiplesOnly ? 'Whole cases only' : 'Whole packs',
      from: 'assumed',
      why: 'The case is 6 identical bags, so sites don\u2019t have to take 6kg at a time.',
    },
    {
      label: 'GP and cost reports',
      value: outOfCogs ? 'Left out' : 'Included',
      from: 'assumed',
      why: 'It goes into drinks you sell.',
    },
    {
      label: 'Recipe costing',
      value: actualCost ? 'Last price paid' : 'Averaged price',
      from: 'assumed',
      why: 'One dear delivery won\u2019t spike your drink costs.',
    },
    {
      label: 'Nutrition',
      value: 'Left blank',
      from: 'sheet',
      why: 'The sheet doesn\u2019t list it. Blank beats wrong.',
    },
  ];

  return (
    <CardShell
      icon={FileText}
      title={name.trim() || newProductName}
      subtitle={`Parsed from ${fileName}`}
      state={state}
      confirmLabel="Looks right, find recipes"
      onConfirm={submit}
      onCancel={onCancel}
      confirmDisabled={!canConfirm}
    >
      {!editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <FieldRow label="Supplier">
            {supplierName}{' '}
            <span
              style={{
                marginLeft: '4px',
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--color-text-muted)',
              }}
            >
              · existing
            </span>
          </FieldRow>
          <FieldRow label="Class">{cls}</FieldRow>
          <FieldRow label="Category">{cat}</FieldRow>
          <FieldRow label="Pack">{packLabel}</FieldRow>
          <FieldRow label="Unit cost">
            {perUnitCost != null ? `£${perUnitCost.toFixed(2)}/${unit}` : '—'}
          </FieldRow>
          <FieldRow label="Allergens">
            {allergenSet.size > 0 ? Array.from(allergenSet).join(', ') : 'None declared'}
          </FieldRow>

          {/* ── The rest of the product form, pre-answered. Collapsed so
              the fast confirm path stays fast. ─────────────────────── */}
          <div style={{ marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => setSetupOpen((v) => !v)}
              style={disclosureBtn}
            >
              {setupOpen ? <ChevronDown size={12} strokeWidth={2.4} /> : <ChevronRight size={12} strokeWidth={2.4} />}
              How I&rsquo;ll set it up · {setupRows.length} settings
            </button>
            {setupOpen && (
              <div
                style={{
                  marginTop: '8px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
                  overflow: 'hidden',
                }}
              >
                {setupRows.map((row, i) => (
                  <div
                    key={row.label}
                    style={{
                      padding: '8px 10px',
                      borderTop: i === 0 ? 'none' : '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: 'var(--color-text-secondary)',
                          flexShrink: 0,
                        }}
                      >
                        {row.label}
                      </span>
                      <span
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          textAlign: 'right',
                        }}
                      >
                        {row.value}{' '}
                        <span
                          style={{
                            marginLeft: '4px',
                            padding: '1px 7px',
                            borderRadius: '100px',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            verticalAlign: '1px',
                            background: row.from === 'sheet' ? 'rgba(45,106,79,0.10)' : 'rgba(40,175,201,0.12)',
                            color: row.from === 'sheet' ? '#2D6A4F' : '#0E7490',
                          }}
                        >
                          {row.from === 'sheet' ? 'From the sheet' : 'Assumed'}
                        </span>
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: '2px',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: 'var(--color-text-muted)',
                        lineHeight: 1.4,
                      }}
                    >
                      {row.why}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <Label>Product name</Label>
            <input
              type="text"
              value={name}
              disabled={state !== 'pending'}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <Label>Class</Label>
            <div style={{ marginTop: '6px' }}>
              <PillRowWithAdd
                options={classOptions}
                selected={cls}
                onSelect={setCls}
                onAdd={(v) => {
                  setClassOptions((prev) => (prev.includes(v) ? prev : [...prev, v]));
                  setCls(v);
                }}
                addLabel="New class"
                disabled={state !== 'pending'}
              />
            </div>
          </div>

          <div>
            <Label>Category</Label>
            <div style={{ marginTop: '6px' }}>
              <PillRowWithAdd
                options={catOptions}
                selected={cat}
                onSelect={setCat}
                onAdd={(v) => {
                  setCatOptions((prev) => (prev.includes(v) ? prev : [...prev, v]));
                  setCat(v);
                }}
                addLabel="New category"
                disabled={state !== 'pending'}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '110px' }}>
              <Label>{packType === 'Pack' ? 'Units per pack' : 'Quantity'}</Label>
              <input
                type="number"
                min={0}
                step="any"
                value={qtyStr}
                disabled={state !== 'pending'}
                onChange={(e) => setQtyStr(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1, minWidth: '110px' }}>
              <Label>Size per unit ({unit})</Label>
              <input
                type="number"
                min={0}
                step="any"
                value={unitSizeStr}
                disabled={state !== 'pending'}
                onChange={(e) => setUnitSizeStr(e.target.value)}
                placeholder="e.g. 1"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1, minWidth: '130px' }}>
              <Label>Pack cost (£, ex VAT)</Label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={costStr}
                disabled={state !== 'pending'}
                onChange={(e) => setCostStr(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <Label>Unit of measure</Label>
            <div style={{ marginTop: '6px' }}>
              <PillRow
                options={UNIT_OPTIONS.map((u) => ({ value: u, label: u }))}
                selected={unit}
                onSelect={(v) => setUnit(v)}
                disabled={state !== 'pending'}
                small
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '150px' }}>
              <Label>Supplier product code</Label>
              <input
                type="text"
                value={skuStr}
                disabled={state !== 'pending'}
                onChange={(e) => setSkuStr(e.target.value)}
                placeholder="From their catalogue or invoice"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1, minWidth: '90px' }}>
              <Label>VAT %</Label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={vatStr}
                disabled={state !== 'pending'}
                onChange={(e) => setVatStr(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* ── Counting units (alt UoMs) — the area that goes wrong
              most often, so each row reads back what it means. ────── */}
          <div>
            <Label>Other ways to count it</Label>
            <Hint>
              Orders and stocktakes can use these as well as {unit}. Set how many of
              each are in one pack.
            </Hint>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
              {alts.map((a, i) => {
                const perPack = qtyValid && a.numberOfUnits > 0 ? unitsInPack / a.numberOfUnits : null;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="text"
                      value={a.type}
                      disabled={state !== 'pending'}
                      onChange={(e) =>
                        setAlts((prev) => prev.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))
                      }
                      placeholder="e.g. Bag"
                      style={{ ...inputStyle, marginTop: 0, flex: 1 }}
                    />
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={a.numberOfUnits > 0 ? String(a.numberOfUnits) : ''}
                      disabled={state !== 'pending'}
                      onChange={(e) =>
                        setAlts((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, numberOfUnits: Number(e.target.value) || 0 } : x)),
                        )
                      }
                      placeholder="per pack"
                      style={{ ...inputStyle, marginTop: 0, width: '88px', flex: 'none' }}
                    />
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        color: 'var(--color-text-muted)',
                        width: '92px',
                        flexShrink: 0,
                      }}
                    >
                      {perPack != null && a.type.trim()
                        ? `1 ${a.type.trim().toLowerCase()} = ${perPack % 1 === 0 ? perPack : perPack.toFixed(2)}${unit}`
                        : 'per pack'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Ordering & costing behaviour, in operator words ────── */}
          <div>
            <Label>Ordering and costing</Label>
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ToggleRow
                label="Sites can order single bags"
                hint="Off means whole cases only."
                checked={splitPack}
                disabled={state !== 'pending' || multiplesOnly}
                onChange={setSplitPack}
              />
              <ToggleRow
                label="Orders must be whole cases"
                hint="Can't be on with single-bag ordering."
                checked={multiplesOnly}
                disabled={state !== 'pending' || splitPack}
                onChange={setMultiplesOnly}
              />
              <ToggleRow
                label="Leave out of GP and cost reports"
                hint="Only for things you don't sell, like cleaning stock."
                checked={outOfCogs}
                disabled={state !== 'pending'}
                onChange={setOutOfCogs}
              />
              <ToggleRow
                label="Cost recipes at the last price paid"
                hint="Off uses the averaged price. Most operators leave this off."
                checked={actualCost}
                disabled={state !== 'pending'}
                onChange={setActualCost}
              />
            </div>
          </div>

          <div>
            <Label>Contains allergens</Label>
            <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {ALL_ALLERGENS.map((a) => {
                const active = allergenSet.has(a);
                return (
                  <button
                    key={a}
                    type="button"
                    disabled={state !== 'pending'}
                    onClick={() => toggleAllergen(a)}
                    aria-pressed={active}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '100px',
                      border: active
                        ? '1.5px solid var(--color-accent-active, #001C35)'
                        : '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                      background: active ? 'var(--color-accent-active, #001C35)' : '#fff',
                      color: active ? '#fff' : 'var(--color-text-secondary)',
                      fontSize: '11px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-primary)',
                      cursor: state !== 'pending' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live unit-cost read-back — recipes cost from this number. */}
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: perUnitCost != null ? 'rgba(40,175,201,0.07)' : 'rgba(0,28,53,0.03)',
              fontSize: '12px',
              fontWeight: 600,
              color: perUnitCost != null ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            }}
          >
            {perUnitCost != null
              ? `Unit cost: £${perUnitCost.toFixed(perUnitCost < 0.1 ? 3 : 2)} per ${unit}. Recipes will cost from this number.`
              : 'Unit cost appears once pack quantity and cost are in.'}
          </div>
        </div>
      )}

      {/* Edit toggle — the sheet is usually right, so the read-out is
          the default and typing is the override. */}
      {state === 'pending' && (
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          style={{ ...disclosureBtn, marginTop: '10px' }}
        >
          {editing ? (
            <>
              <ChevronDown size={12} strokeWidth={2.4} /> Done editing
            </>
          ) : (
            <>
              <Pencil size={11} strokeWidth={2.2} /> Edit details
            </>
          )}
        </button>
      )}

      {/* "Matches your existing item" callout — sets up the next step. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          marginTop: '10px',
          padding: '8px 10px',
          borderRadius: '10px',
          background: 'rgba(40,175,201,0.08)',
          border: '1px solid rgba(40,175,201,0.18)',
        }}
      >
        <EdifyMark size={14} color="var(--color-accent-mid, #28AFC9)" style={{ marginTop: '1px' }} />
        <div
          style={{
            fontSize: '11.5px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.45,
          }}
        >
          {/* Explicit {' '} after </strong> — this Next build's JSX
              transform drops the literal space there. */}
          This matches your <strong>{oldProductName}</strong>. The sheet has no supplier
          terms, so it sits under <strong>{supplierName}</strong>{' '}until you set up the
          real one. Confirm and I&rsquo;ll find every recipe that uses it.
        </div>
      </div>
    </CardShell>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '6px',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};

const disclosureBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  borderRadius: '100px',
  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
  background: '#fff',
  fontSize: '11px',
  fontWeight: 700,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-secondary)',
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

/** Pill single-select with an inline "add new" affordance — the chat
 *  equivalent of the product form's Manage buttons. Typing a name and
 *  pressing Enter mints the option and selects it in one move. */
function PillRowWithAdd({
  options,
  selected,
  onSelect,
  onAdd,
  addLabel,
  disabled,
}: {
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onAdd: (v: string) => void;
  addLabel: string;
  disabled?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  function commit() {
    const v = draft.trim();
    if (v) onAdd(v);
    setDraft('');
    setAdding(false);
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
      {options.map((opt) => {
        const active = opt === selected;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(opt)}
            style={{
              padding: '4px 10px',
              borderRadius: '100px',
              border: active
                ? '1.5px solid var(--color-accent-active, #001C35)'
                : '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
              background: active ? 'var(--color-accent-active, #001C35)' : '#fff',
              color: active ? '#fff' : 'var(--color-text-secondary)',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {opt}
          </button>
        );
      })}
      {adding ? (
        <input
          type="text"
          autoFocus
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft('');
              setAdding(false);
            }
          }}
          onBlur={commit}
          placeholder={addLabel}
          style={{
            padding: '4px 10px',
            borderRadius: '100px',
            border: '1.5px solid var(--color-accent-mid, #28AFC9)',
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
            background: '#fff',
            outline: 'none',
            width: '130px',
          }}
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAdding(true)}
          style={{
            padding: '4px 10px',
            borderRadius: '100px',
            border: '1.5px dashed var(--color-border, rgba(0,28,53,0.28))',
            background: '#fff',
            color: 'var(--color-text-secondary)',
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          + {addLabel}
        </button>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
      }}
    >
      {children}
    </span>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '11px',
        fontWeight: 500,
        color: 'var(--color-text-muted)',
        marginTop: '4px',
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: 'var(--color-accent-active, #001C35)', marginTop: '2px' }}
      />
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: disabled && !checked ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--color-text-muted)',
            marginTop: '1px',
          }}
        >
          {hint}
        </span>
      </span>
    </label>
  );
}

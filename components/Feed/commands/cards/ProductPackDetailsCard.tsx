'use client';

import { useRef, useState } from 'react';
import { Package, Camera, X, ImagePlus, ChevronDown, ChevronRight } from 'lucide-react';
import CardShell, { PillRow, type CardState } from './CardShell';
import { ALL_ALLERGENS, ALL_SITES, type Allergen, type AltUom } from '@/components/Suppliers/fixtures';

type UnitType = 'Each' | 'kg' | 'L' | 'g' | 'ml';

export interface ProductPackDetailsSubmit {
  packType: 'Pack' | 'Single';
  packQty: number;
  packCost: number;
  unitType: UnitType;
  supplierCode: string;
  taxRatePct: number;
  sites: string[];
  allergensContains: Allergen[];
  allergensTraces: Allergen[];
  singleUnitVolumeOrWeight?: number;
  altUom?: AltUom;
  allowSplitPack: boolean;
  forceMultiples: boolean;
  excludeFromCogs: boolean;
  useActualUseForTheoreticalCogs: boolean;
  photoDataUrl?: string;
  /** Kept for the runner's echo copy; the card no longer offers a
   *  skip — pack structure is never defaultable. Always false. */
  skipped: boolean;
}

interface ProductPackDetailsCardProps {
  state: CardState;
  /** Which job the wizard is doing. Copy branches on it — only
   *  replace mode can honestly claim pre-filled defaults. */
  mode?: 'add' | 'replace';
  /** Display title context — the new product + supplier so the
   *  operator knows what they're filling in for. */
  newProductName: string;
  supplierName: string;
  /** Defaults inherited from the product being replaced (replace
   *  mode), or empty / lightly guessed (add mode). */
  initialPackType?: 'Pack' | 'Single';
  initialPackQty?: number;
  initialPackCost?: number;
  initialUnitType?: UnitType;
  initialSupplierCode?: string;
  initialTaxRatePct?: number;
  initialSites?: string[];
  initialAllergensContains?: Allergen[];
  initialAllergensTraces?: Allergen[];
  initialPhotoDataUrl?: string;
  onSubmit: (input: ProductPackDetailsSubmit) => void;
  onCancel: () => void;
}

const UNIT_OPTIONS: UnitType[] = ['Each', 'g', 'kg', 'ml', 'L'];

/**
 * The product wizard's field step. Captures everything a supplier
 * product needs to be orderable and costable: supplier code, pack
 * structure (pack vs single, qty per pack, cost), unit of measure
 * and VAT — with the unit cost read back live so the £-per-unit the
 * catalogue will carry is visible before confirm.
 *
 * Pack structure and supplier code are required — the card cannot be
 * skipped. A silently defaulted pack qty of 1 where a sleeve of 50
 * was meant is the classic COGS-corrupting error, and the supplier
 * code is how invoice lines reconcile back to this product.
 *
 * Everything else lives behind "More settings" — offered, never
 * forced: sites, allergens, volume/weight per unit, an alternative
 * ordering unit, and the advanced ordering/COGS flags.
 *
 * Photo upload is a first-class affordance: operators frequently
 * have the data in front of them on a phone (supplier email
 * screenshot, label on a pack). For the prototype the photo is just
 * attached as a reference image; production would route it through
 * OCR to auto-fill the fields.
 */
export default function ProductPackDetailsCard({
  state,
  mode = 'replace',
  newProductName,
  supplierName,
  initialPackType,
  initialPackQty,
  initialPackCost,
  initialUnitType,
  initialSupplierCode,
  initialTaxRatePct,
  initialSites,
  initialAllergensContains,
  initialAllergensTraces,
  initialPhotoDataUrl,
  onSubmit,
  onCancel,
}: ProductPackDetailsCardProps) {
  const [packType, setPackType] = useState<'Pack' | 'Single'>(initialPackType ?? 'Pack');
  const [packQty, setPackQty] = useState<string>(initialPackQty != null ? String(initialPackQty) : '');
  const [packCost, setPackCost] = useState<string>(
    initialPackCost != null ? String(initialPackCost) : '',
  );
  const [unitType, setUnitType] = useState<UnitType>(initialUnitType ?? 'g');
  const [supplierCode, setSupplierCode] = useState<string>(initialSupplierCode ?? '');
  const [taxRate, setTaxRate] = useState<string>(String(initialTaxRatePct ?? 0));
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(initialPhotoDataUrl);
  // ── "More settings" — offered, never forced ──────────────────
  const [moreOpen, setMoreOpen] = useState(false);
  const [sites, setSites] = useState<Set<string>>(
    () => new Set(initialSites && initialSites.length > 0 ? initialSites : ALL_SITES),
  );
  const [contains, setContains] = useState<Set<Allergen>>(() => new Set(initialAllergensContains ?? []));
  const [traces, setTraces] = useState<Set<Allergen>>(() => new Set(initialAllergensTraces ?? []));
  const [volumePerUnit, setVolumePerUnit] = useState<string>('');
  const [altUomType, setAltUomType] = useState<string>('');
  const [altUomUnits, setAltUomUnits] = useState<string>('');
  const [allowSplitPack, setAllowSplitPack] = useState(false);
  const [forceMultiples, setForceMultiples] = useState(false);
  const [excludeFromCogs, setExcludeFromCogs] = useState(false);
  const [useActual, setUseActual] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const qtyNum = Number(packQty);
  const costNum = Number(packCost);
  const qtyValid = packQty.trim().length > 0 && Number.isFinite(qtyNum) && qtyNum > 0;
  const costValid = packCost.trim().length > 0 && Number.isFinite(costNum) && costNum > 0;
  const codeValid = supplierCode.trim().length > 0;
  const canConfirm = qtyValid && costValid && codeValid;
  const unitCost = qtyValid && costValid ? costNum / qtyNum : null;

  function handleFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') setPhotoDataUrl(result);
    };
    reader.readAsDataURL(file);
  }

  function toggleIn<T>(set: Set<T>, value: T, apply: (next: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    apply(next);
  }

  function submit() {
    if (!canConfirm) return;
    const volNum = Number(volumePerUnit);
    const altUnitsNum = Number(altUomUnits);
    onSubmit({
      packType,
      packQty: qtyNum,
      packCost: costNum,
      unitType,
      supplierCode: supplierCode.trim(),
      taxRatePct: Number(taxRate) || 0,
      sites: Array.from(sites),
      allergensContains: Array.from(contains),
      allergensTraces: Array.from(traces),
      singleUnitVolumeOrWeight:
        volumePerUnit.trim() && Number.isFinite(volNum) && volNum > 0 ? volNum : undefined,
      altUom:
        altUomType.trim() && Number.isFinite(altUnitsNum) && altUnitsNum > 0
          ? { type: altUomType.trim(), numberOfUnits: altUnitsNum }
          : undefined,
      allowSplitPack,
      forceMultiples,
      excludeFromCogs,
      useActualUseForTheoreticalCogs: useActual,
      photoDataUrl,
      skipped: false,
    });
  }

  return (
    <CardShell
      icon={Package}
      title="Product details"
      subtitle={`Supplier product · ${newProductName} · from ${supplierName}`}
      state={state}
      confirmLabel="Next"
      onCancel={onCancel}
      onConfirm={submit}
      confirmDisabled={!canConfirm}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.45,
          }}
        >
          {mode === 'replace'
            ? "These make the product orderable and keep its cost right \u2014 I've pre-filled what I know from the product you\u2019re replacing. Double-check the pack structure: it drives every recipe cost this product touches."
            : "These make the product orderable and keep its cost right. I can\u2019t guess the pack structure \u2014 a pack of 1 saved where a sleeve of 50 was meant corrupts every recipe cost it touches, so this step can\u2019t be skipped."}
        </p>

        {/* ── Photo upload (top — it's the autofill superpower) ────── */}
        <div>
          <Label>Got a photo or email?</Label>
          <div style={{ marginTop: '6px' }}>
            {photoDataUrl ? (
              <div
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  borderRadius: '12px',
                  border: '1.5px solid var(--color-accent-mid, #28AFC9)',
                  background: 'rgba(40,175,201,0.06)',
                  padding: '8px',
                  gap: '10px',
                  alignItems: 'center',
                  maxWidth: '100%',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoDataUrl}
                  alt="Product reference"
                  style={{
                    width: '64px',
                    height: '64px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    background: '#fff',
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    Photo attached
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      color: 'var(--color-text-muted)',
                      marginTop: '2px',
                    }}
                  >
                    We&rsquo;ll keep it with the product for reference.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={state !== 'pending'}
                  onClick={() => setPhotoDataUrl(undefined)}
                  aria-label="Remove photo"
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: '1px solid var(--color-border, rgba(0,28,53,0.18))',
                    background: '#fff',
                    cursor: state === 'pending' ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <X size={12} color="var(--color-text-secondary)" strokeWidth={2.4} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  disabled={state !== 'pending'}
                  onClick={() => fileRef.current?.click()}
                  style={uploadBtn}
                >
                  <Camera size={14} strokeWidth={2.2} />
                  Take a photo
                </button>
                <button
                  type="button"
                  disabled={state !== 'pending'}
                  onClick={() => {
                    if (fileRef.current) {
                      fileRef.current.removeAttribute('capture');
                      fileRef.current.click();
                    }
                  }}
                  style={uploadBtnSecondary}
                >
                  <ImagePlus size={14} strokeWidth={2.2} />
                  Upload image
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                handleFile(e.target.files?.[0] ?? null);
                if (e.target) e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* ── Supplier code + VAT ───────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: '160px' }}>
            <Label>Supplier product code</Label>
            <input
              type="text"
              value={supplierCode}
              disabled={state !== 'pending'}
              onChange={(e) => setSupplierCode(e.target.value)}
              placeholder="e.g. FB-1042 — from their catalogue or invoice"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1, minWidth: '110px' }}>
            <Label>VAT %</Label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={taxRate}
              disabled={state !== 'pending'}
              onChange={(e) => setTaxRate(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* ── Pack type ─────────────────────────────────────────────── */}
        <div>
          <Label>How is it sold?</Label>
          <div style={{ marginTop: '6px' }}>
            <PillRow
              options={[
                { value: 'Pack' as const, label: 'Pack' },
                { value: 'Single' as const, label: 'Single' },
              ]}
              selected={packType}
              onSelect={(v) => setPackType(v)}
              disabled={state !== 'pending'}
            />
          </div>
        </div>

        {/* ── Pack qty + cost ───────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <Label>{packType === 'Pack' ? 'Units per pack' : 'Quantity'}</Label>
            <input
              type="number"
              min={0}
              step="any"
              value={packQty}
              disabled={state !== 'pending'}
              onChange={(e) => setPackQty(e.target.value)}
              placeholder="e.g. 6"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <Label>Pack cost (£, ex VAT)</Label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={packCost}
              disabled={state !== 'pending'}
              onChange={(e) => setPackCost(e.target.value)}
              placeholder="e.g. 24.50"
              style={inputStyle}
            />
          </div>
        </div>

        {/* ── Unit type ─────────────────────────────────────────────── */}
        <div>
          <Label>Unit of measure</Label>
          <div style={{ marginTop: '6px' }}>
            <PillRow
              options={UNIT_OPTIONS.map((u) => ({ value: u, label: u }))}
              selected={unitType}
              onSelect={(v) => setUnitType(v)}
              disabled={state !== 'pending'}
              small
            />
          </div>
        </div>

        {/* ── Live unit-cost read-back ──────────────────────────────── */}
        <div
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            background: unitCost != null ? 'rgba(40,175,201,0.07)' : 'rgba(0,28,53,0.03)',
            fontSize: '12px',
            fontWeight: 600,
            color: unitCost != null ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          }}
        >
          {unitCost != null
            ? `Unit cost: £${unitCost.toFixed(unitCost < 0.1 ? 3 : 2)} per ${unitType} — this is what recipes will be costed at.`
            : 'Unit cost appears here once pack quantity and cost are in — recipes cost from this number.'}
        </div>

        {/* ── More settings (offered, never forced) ─────────────────── */}
        <div>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            style={{
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
              cursor: 'pointer',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            {moreOpen ? <ChevronDown size={12} strokeWidth={2.4} /> : <ChevronRight size={12} strokeWidth={2.4} />}
            More settings · sites, allergens, units, ordering
          </button>

          {moreOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
              <div>
                <Label>Available at</Label>
                <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {ALL_SITES.map((site) => (
                    <TogglePill
                      key={site}
                      label={site}
                      active={sites.has(site)}
                      disabled={state !== 'pending'}
                      onToggle={() => toggleIn(sites, site, setSites)}
                    />
                  ))}
                </div>
                <Hint>Defaults to every site the supplier delivers to — untick to narrow.</Hint>
              </div>

              <div>
                <Label>Contains allergens</Label>
                <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {ALL_ALLERGENS.map((a) => (
                    <TogglePill
                      key={a}
                      label={a}
                      active={contains.has(a)}
                      disabled={state !== 'pending'}
                      onToggle={() => toggleIn(contains, a, setContains)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label>May contain traces of</Label>
                <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {ALL_ALLERGENS.map((a) => (
                    <TogglePill
                      key={a}
                      label={a}
                      active={traces.has(a)}
                      disabled={state !== 'pending'}
                      onToggle={() => toggleIn(traces, a, setTraces)}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <Label>Volume/weight per unit ({unitType})</Label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={volumePerUnit}
                    disabled={state !== 'pending'}
                    onChange={(e) => setVolumePerUnit(e.target.value)}
                    placeholder="e.g. 1000"
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <Label>Alternative unit</Label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      value={altUomType}
                      disabled={state !== 'pending'}
                      onChange={(e) => setAltUomType(e.target.value)}
                      placeholder="e.g. case"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={altUomUnits}
                      disabled={state !== 'pending'}
                      onChange={(e) => setAltUomUnits(e.target.value)}
                      placeholder="units"
                      style={{ ...inputStyle, width: '80px', flex: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Ordering & COGS</Label>
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <ToggleRow
                    label="Allow split pack ordering"
                    checked={allowSplitPack}
                    disabled={state !== 'pending' || forceMultiples}
                    onChange={(v) => setAllowSplitPack(v)}
                  />
                  <ToggleRow
                    label="Force ordering by pack multiples"
                    checked={forceMultiples}
                    disabled={state !== 'pending' || allowSplitPack}
                    onChange={(v) => setForceMultiples(v)}
                  />
                  <ToggleRow
                    label="Exclude from COGS"
                    checked={excludeFromCogs}
                    disabled={state !== 'pending'}
                    onChange={setExcludeFromCogs}
                  />
                  <ToggleRow
                    label="Use actual for theoretical COGS"
                    checked={useActual}
                    disabled={state !== 'pending'}
                    onChange={setUseActual}
                  />
                </div>
                <Hint>Split pack and pack multiples can&rsquo;t both be on — they contradict each other.</Hint>
              </div>
            </div>
          )}
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

const uploadBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1.5px solid var(--color-accent-active, #001C35)',
  background: 'var(--color-accent-active, #001C35)',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

const uploadBtnSecondary: React.CSSProperties = {
  ...uploadBtn,
  background: '#fff',
  color: 'var(--color-text-primary)',
};

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
        marginTop: '6px',
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}

function TogglePill({
  label,
  active,
  disabled,
  onToggle,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
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
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        fontWeight: 500,
        color: disabled && !checked ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
        fontFamily: 'var(--font-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: 'var(--color-accent-active, #001C35)' }}
      />
      {label}
    </label>
  );
}

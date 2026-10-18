'use client';

import { useState } from 'react';
import { Store } from 'lucide-react';
import { gbp, packWords, unitCost } from './review';
import type { ProductSeed, Sample, SupplierSeed, UnitType } from './samples';
import { C, Field, inputStyle, PrimaryButton, Segmented, Sheet } from './ui';

const UNITS: UnitType[] = ['g', 'kg', 'ml', 'L', 'Each'];
const VAT_RATES = [0, 5, 20];

function num(s: string): number {
  const n = Number(s.replace(/[£,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Set up a product that came in but isn't in the catalogue, filled in from the paper. */
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
  const [name, setName] = useState(initial.name);
  const [code, setCode] = useState(initial.code ?? '');
  const [packType, setPackType] = useState(initial.packType);
  const [packQty, setPackQty] = useState(String(initial.packQty));
  const [unitSize, setUnitSize] = useState(String(initial.unitSize));
  const [unitType, setUnitType] = useState<UnitType>(initial.unitType);
  const [packCost, setPackCost] = useState(initial.packCost.toFixed(2));
  const [vatRate, setVatRate] = useState(initial.vatRate);
  const [master, setMaster] = useState(initial.master);

  const draft: ProductSeed = {
    name: name.trim(),
    code: code.trim() || undefined,
    packType,
    packQty: packType === 'Single' ? 1 : Math.max(1, Math.round(num(packQty))),
    unitSize: unitType === 'Each' ? 1 : num(unitSize),
    unitType,
    packCost: num(packCost),
    vatRate,
    master: master.trim(),
    masterIsNew: master.trim() === initial.master ? initial.masterIsNew : true,
  };
  const valid = !!draft.name && !!draft.master && draft.packCost > 0 && draft.unitSize > 0;
  const kind = sample.kind === 'receipt' ? 'receipt' : sample.kind === 'invoice' ? 'invoice' : 'delivery note';
  const two = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } as const;

  return (
    <Sheet
      title={`Add ${initial.name}`}
      subtitle={`Filled in from the ${kind}. Check it against the pack.`}
      isPhone={isPhone}
      placement="right"
      onClose={onClose}
      footer={
        <>
          <div aria-live="polite" style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 10 }}>
            <span style={{ fontWeight: 600 }}>{packWords(draft)}</span>
            {draft.packCost > 0 && (
              <>
                {' '}
                at {gbp(draft.packCost)}
                {draft.unitSize > 0 && <span style={{ color: C.muted }}> &middot; {unitCost(draft)}</span>}
              </>
            )}
          </div>
          <PrimaryButton disabled={!valid} onClick={() => onSave(draft)}>
            Add to catalogue
          </PrimaryButton>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label="Name">
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </Field>

        <div style={two}>
          <Field label="Supplier">
            <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', background: C.page, borderColor: C.subtle }}>{sample.supplier}</div>
          </Field>
          <Field label="Their code">
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="None" style={inputStyle} />
          </Field>
        </div>

        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>How it comes</div>
          <Segmented
            label="How it comes"
            value={packType}
            onChange={setPackType}
            options={[
              { id: 'Single', label: 'Single item' },
              { id: 'Pack', label: 'Pack of several' },
            ]}
          />
        </div>

        <div style={two}>
          {packType === 'Pack' && (
            <Field label="Items in a pack">
              <input value={packQty} onChange={e => setPackQty(e.target.value)} inputMode="numeric" style={inputStyle} />
            </Field>
          )}
          <Field label="Each item is" style={packType === 'Single' ? { gridColumn: '1 / -1' } : undefined}>
            <div style={{ display: 'flex', gap: 8 }}>
              {unitType !== 'Each' && (
                <input value={unitSize} onChange={e => setUnitSize(e.target.value)} inputMode="decimal" aria-label="Size" style={{ ...inputStyle, flex: 1 }} />
              )}
              <select value={unitType} onChange={e => setUnitType(e.target.value as UnitType)} aria-label="Unit" style={{ ...inputStyle, width: unitType === 'Each' ? '100%' : 96, flex: 'none' }}>
                {UNITS.map(u => (
                  <option key={u} value={u}>
                    {u === 'Each' ? 'Counted each' : u}
                  </option>
                ))}
              </select>
            </div>
          </Field>
        </div>

        <div style={two}>
          <Field label={packType === 'Pack' ? 'Cost per pack' : 'Cost per item'}>
            <div style={{ position: 'relative' }}>
              <span aria-hidden style={{ position: 'absolute', left: 14, top: 13, fontSize: 16, color: C.muted }}>
                £
              </span>
              <input value={packCost} onChange={e => setPackCost(e.target.value)} inputMode="decimal" style={{ ...inputStyle, paddingLeft: 30 }} />
            </div>
          </Field>
          <Field label="VAT">
            <select value={vatRate} onChange={e => setVatRate(Number(e.target.value))} style={inputStyle}>
              {VAT_RATES.map(v => (
                <option key={v} value={v}>
                  {v}%
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Sits under"
          hint={
            draft.masterIsNew
              ? `New. Edify creates ${draft.master || 'it'} so your recipes can use it.`
              : `Recipes that use ${draft.master} can use this too.`
          }
        >
          <input value={master} onChange={e => setMaster(e.target.value)} style={inputStyle} />
        </Field>
      </div>
    </Sheet>
  );
}

/** Add a shop from a receipt. Shops are never ordered from. */
export function SupplierSheet({
  initial,
  isPhone,
  onSave,
  onClose,
}: {
  initial: SupplierSeed;
  isPhone: boolean;
  onSave: (s: SupplierSeed) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [branch, setBranch] = useState(initial.branch);
  const [vatNumber, setVatNumber] = useState(initial.vatNumber ?? '');
  const valid = !!name.trim();
  return (
    <Sheet
      title={`Add ${initial.name}`}
      subtitle="Filled in from the receipt."
      isPhone={isPhone}
      placement="right"
      onClose={onClose}
      footer={
        <PrimaryButton disabled={!valid} onClick={() => onSave({ name: name.trim(), branch: branch.trim(), vatNumber: vatNumber.trim() || undefined })}>
          Add {name.trim() || 'shop'}
        </PrimaryButton>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label="Name">
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Branch">
          <input value={branch} onChange={e => setBranch(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="VAT number" hint="Needed to claim the VAT back.">
          <input value={vatNumber} onChange={e => setVatNumber(e.target.value)} style={inputStyle} />
        </Field>
        <div style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12, background: C.page, fontSize: 14, lineHeight: 1.5 }}>
          <Store size={20} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <span style={{ fontWeight: 600 }}>Saved as a shop, with no ordering.</span> It won&rsquo;t show up when you place orders, and what you buy here counts as
            off-contract spend.
          </span>
        </div>
      </div>
    </Sheet>
  );
}

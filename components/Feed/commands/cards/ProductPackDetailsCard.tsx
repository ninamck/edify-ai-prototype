'use client';

import { useRef, useState } from 'react';
import { Package, Camera, X, SkipForward, ImagePlus } from 'lucide-react';
import CardShell, { PillRow, type CardState } from './CardShell';

type UnitType = 'Each' | 'kg' | 'L' | 'g' | 'ml';

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
  initialPhotoDataUrl?: string;
  onSubmit: (input: {
    packType: 'Pack' | 'Single';
    packQty: number;
    packCost: number;
    unitType: UnitType;
    photoDataUrl?: string;
    skipped: boolean;
  }) => void;
  onCancel: () => void;
}

const UNIT_OPTIONS: UnitType[] = ['Each', 'g', 'kg', 'ml', 'L'];

/**
 * Optional step in the product wizard. Captures the pack details
 * that make the new product orderable — pack vs single, qty per
 * pack, cost, and the unit of measure.
 *
 * Photo upload is a first-class affordance: operators frequently
 * have the data in front of them on a phone (supplier email
 * screenshot, label on a pack) and asking them to retype it is
 * friction. For the prototype the photo is just attached to the
 * product as a reference image; production would route it through
 * OCR to auto-fill the fields above.
 *
 * The whole card is skippable — partial / missing data is fine for
 * the prototype, and the product detail page is always the canonical
 * place to finish a product off.
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
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(initialPhotoDataUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') setPhotoDataUrl(result);
    };
    reader.readAsDataURL(file);
  }

  function submit(skipped: boolean) {
    onSubmit({
      packType,
      packQty: packQty.trim() ? Number(packQty) : 1,
      packCost: packCost.trim() ? Number(packCost) : 0,
      unitType,
      photoDataUrl,
      skipped,
    });
  }

  return (
    <CardShell
      icon={Package}
      title="Pack details"
      subtitle={`${newProductName} · from ${supplierName}`}
      state={state}
      confirmLabel="Next"
      onCancel={onCancel}
      onConfirm={() => submit(false)}
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
            ? "Add the pack details so this product is orderable. Most of this is pre-filled from the product you\u2019re replacing \u2014 double-check and adjust if your new supplier ships it differently."
            : "Add the pack details so this product is orderable \u2014 pack vs single, how many per pack, cost, and the unit you stock it in. Skip and finish later if you don\u2019t have it to hand."}
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
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                marginTop: '6px',
                lineHeight: 1.4,
              }}
            >
              Snap the pack, label, or supplier email and we&rsquo;ll
              keep it on the product. In future we&rsquo;ll auto-fill
              the fields below from what we read.
            </div>
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
            <Label>Pack cost (DH)</Label>
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

        {state === 'pending' && (
          <button
            type="button"
            onClick={() => submit(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '100px',
              border: '1.5px dashed var(--color-border, rgba(0,28,53,0.18))',
              background: 'transparent',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <SkipForward size={12} strokeWidth={2.2} />
            Skip — finish on the product page later
          </button>
        )}
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

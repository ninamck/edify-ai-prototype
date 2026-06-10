'use client';

import { FileText } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import CardShell, { FieldRow, type CardState } from './CardShell';

interface ProductSheetDetailsCardProps {
  state: CardState;
  /** The sheet we parsed the product from — shown as provenance. */
  fileName: string;
  newProductName: string;
  supplierName: string;
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
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * First confirmation of the sheet-driven product swap. We've parsed the
 * supplier sheet and pulled every field — the operator just sanity-
 * checks the new product before we go hunting for the recipes that use
 * the old one. Read-only on purpose: the sheet is the source of truth,
 * and the brief is "show the details and get the user to confirm".
 */
export default function ProductSheetDetailsCard({
  state,
  fileName,
  newProductName,
  supplierName,
  category,
  packType,
  packQty,
  packCost,
  unitType,
  singleUnitVolumeOrWeight,
  allergens,
  oldProductName,
  onConfirm,
  onCancel,
}: ProductSheetDetailsCardProps) {
  const unitsInPack = packQty * (singleUnitVolumeOrWeight ?? 1);
  const perUnitCost = unitsInPack > 0 ? packCost / unitsInPack : packCost;
  const packLabel =
    packType === 'Pack'
      ? `${packQty} × ${singleUnitVolumeOrWeight ?? 1}${unitType} · £${packCost.toFixed(2)}`
      : `${packQty}${unitType} · £${packCost.toFixed(2)}`;

  return (
    <CardShell
      icon={FileText}
      title={newProductName}
      subtitle={`Parsed from ${fileName}`}
      state={state}
      confirmLabel="Looks right — find recipes"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
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
        <FieldRow label="Category">{category}</FieldRow>
        <FieldRow label="Pack">{packLabel}</FieldRow>
        <FieldRow label="Unit cost">
          £{perUnitCost.toFixed(2)}/{unitType}
        </FieldRow>
        <FieldRow label="Allergens">
          {allergens.length > 0 ? allergens.join(', ') : 'None declared'}
        </FieldRow>
      </div>

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
          This matches your existing <strong>{oldProductName}</strong>. I&rsquo;ve kept it
          under <strong>{supplierName}</strong> for now — the sheet doesn&rsquo;t carry
          supplier terms, so you can set the real one up later. Confirm and I&rsquo;ll find
          every recipe that uses it so you can swap them all over in one go.
        </div>
      </div>
    </CardShell>
  );
}

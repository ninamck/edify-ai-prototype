'use client';

import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  WASTE_PRODUCTS,
  WASTE_REASONS,
  getProduct,
  type WasteReasonId,
} from '@/components/Waste/wasteData';
import CardShell, { FieldRow, QtyStepper, PillRow, type CardState } from './CardShell';
import type { WasteArgs } from '../parsers';

interface WasteCommandCardProps {
  initialArgs: WasteArgs;
  state: CardState;
  onConfirm: (final: { productId: string; qty: number; uom: string; reasonId: WasteReasonId }) => void;
  onCancel: () => void;
}

/**
 * Compact in-chat waste card. Echoes the visual language of
 * `WasteLogCard` on `/log-waste` so the user sees the same controls
 * (qty stepper, reason pills, UoM toggle) inline. Confirm calls back
 * with normalised args; the runner does the actual store write.
 */
export default function WasteCommandCard({ initialArgs, state, onConfirm, onCancel }: WasteCommandCardProps) {
  // If we don't have a product id yet, render an inline picker.
  const [productId, setProductId] = useState<string | undefined>(initialArgs.productId);
  const product = useMemo(() => (productId ? getProduct(productId) : undefined), [productId]);
  const [qty, setQty] = useState<number>(initialArgs.qty ?? 1);
  const [uom, setUom] = useState<string>(initialArgs.uom ?? product?.uomOptions[0] ?? 'unit');
  const [reasonId, setReasonId] = useState<WasteReasonId | undefined>(initialArgs.reasonId);

  const value = product ? (product.unitCost * qty).toFixed(2) : null;
  const canConfirm = !!product && qty > 0 && !!reasonId;

  return (
    <CardShell
      icon={Trash2}
      title="Log waste"
      subtitle={product ? product.name : 'Pick a product'}
      state={state}
      confirmLabel="Log it"
      confirmDisabled={!canConfirm}
      onConfirm={
        product && reasonId
          ? () => onConfirm({ productId: product.id, qty, uom, reasonId })
          : undefined
      }
      onCancel={onCancel}
    >
      {!product && (
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--color-text-secondary)',
              marginBottom: '6px',
            }}
          >
            Which product?
          </div>
          <PillRow
            options={WASTE_PRODUCTS.slice(0, 8).map((p) => ({ value: p.id, label: p.name }))}
            selected={productId}
            onSelect={(id) => {
              setProductId(id);
              const p = getProduct(id);
              if (p) setUom(p.uomOptions[0]);
            }}
            disabled={state !== 'pending'}
            small
          />
        </div>
      )}

      <FieldRow label="Quantity">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <QtyStepper value={qty} onChange={setQty} disabled={state !== 'pending'} />
          {product && product.uomOptions.length > 1 ? (
            <PillRow
              options={product.uomOptions.map((u) => ({ value: u, label: u }))}
              selected={uom}
              onSelect={setUom}
              disabled={state !== 'pending'}
              small
            />
          ) : (
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)' }}>{uom}</span>
          )}
        </div>
      </FieldRow>

      <div style={{ marginTop: '10px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
            marginBottom: '6px',
          }}
        >
          Reason
        </div>
        <PillRow
          options={WASTE_REASONS.map((r) => ({ value: r.id, label: r.label }))}
          selected={reasonId}
          onSelect={setReasonId}
          disabled={state !== 'pending'}
          small
        />
      </div>

      {value && (
        <div
          style={{
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px dashed var(--color-border-subtle, rgba(0,28,53,0.12))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
            Estimated value
          </span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>£{value}</span>
        </div>
      )}
    </CardShell>
  );
}

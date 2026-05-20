'use client';

import { useMemo, useState } from 'react';
import { Boxes } from 'lucide-react';
import { WASTE_PRODUCTS, getProduct } from '@/components/Waste/wasteData';
import CardShell, { FieldRow, QtyStepper, PillRow, type CardState } from './CardShell';
import type { StockArgs } from '../parsers';

interface StockCountCommandCardProps {
  initialArgs: StockArgs;
  state: CardState;
  onConfirm: (final: {
    itemId: string;
    itemName: string;
    qty: number;
    uom: string;
    location?: string;
    expectedQty: number | null;
  }) => void;
  onCancel: () => void;
}

/**
 * Stock-count card. The prototype's stock fixtures are big and
 * site-specific; we reuse the lightweight `WASTE_PRODUCTS` catalogue
 * as the pickable list for the command (those are the most "countable"
 * named SKUs in the demo). Expected qty is a synthetic value — we
 * pretend the system thinks there should be N+2 of whatever you typed
 * so the variance line has something interesting to show.
 */
export default function StockCountCommandCard({ initialArgs, state, onConfirm, onCancel }: StockCountCommandCardProps) {
  const [itemId, setItemId] = useState<string | undefined>(initialArgs.itemId);
  const item = useMemo(() => (itemId ? getProduct(itemId) : undefined), [itemId]);
  const [qty, setQty] = useState<number>(initialArgs.qty ?? 0);
  const [uom, setUom] = useState<string>(initialArgs.uom ?? item?.uomOptions[0] ?? 'unit');

  // Synthetic "expected" — deterministic from item id so it doesn't
  // bounce around between renders. Real system would derive this from
  // last stocktake + GRNs − POS.
  const expectedQty = useMemo<number | null>(() => {
    if (!item) return null;
    const seed = item.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return 4 + (seed % 12);
  }, [item]);

  const variance = item && expectedQty !== null ? qty - expectedQty : null;
  const variancePct = variance !== null && expectedQty ? Math.abs(variance) / expectedQty : 0;
  const showWarning = variance !== null && variancePct > 0.2;

  const canConfirm = !!item && qty >= 0;

  return (
    <CardShell
      icon={Boxes}
      title="Count stock"
      subtitle={item ? `${item.name}${initialArgs.location ? ` · ${initialArgs.location}` : ''}` : 'Pick an item'}
      state={state}
      confirmLabel="Save count"
      confirmDisabled={!canConfirm}
      warning={
        showWarning && variance !== null
          ? `Variance ${variance > 0 ? '+' : '−'}${Math.abs(variance)} ${uom} vs expected — Quinn will flag this for review.`
          : undefined
      }
      onConfirm={
        item
          ? () =>
              onConfirm({
                itemId: item.id,
                itemName: item.name,
                qty,
                uom,
                location: initialArgs.location,
                expectedQty,
              })
          : undefined
      }
      onCancel={onCancel}
    >
      {!item && (
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
            Which item?
          </div>
          <PillRow
            options={WASTE_PRODUCTS.slice(0, 8).map((p) => ({ value: p.id, label: p.name }))}
            selected={itemId}
            onSelect={(id) => {
              setItemId(id);
              const p = getProduct(id);
              if (p) setUom(p.uomOptions[0]);
            }}
            disabled={state !== 'pending'}
            small
          />
        </div>
      )}

      <FieldRow label="Expected">
        <span style={{ color: 'var(--color-text-muted)' }}>{expectedQty !== null ? `${expectedQty} ${uom}` : '—'}</span>
      </FieldRow>

      <FieldRow label="Actual count">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <QtyStepper value={qty} onChange={setQty} disabled={state !== 'pending'} />
          {item && item.uomOptions.length > 1 ? (
            <PillRow
              options={item.uomOptions.map((u) => ({ value: u, label: u }))}
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

      {variance !== null && (
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
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>Variance</span>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: variance === 0 ? 'var(--color-text-primary)' : variance > 0 ? '#2D6A4F' : '#9B2226',
            }}
          >
            {variance > 0 ? '+' : variance < 0 ? '−' : ''}
            {Math.abs(variance)} {uom}
          </span>
        </div>
      )}
    </CardShell>
  );
}

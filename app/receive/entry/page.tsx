'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState, useCallback } from 'react';
import ReceivingScreen from '@/components/Receiving/ReceivingScreen';
import { MOCK_POS, PO, recordCompletedDeliveryFromReceiving, applyReceiptToPOs } from '@/components/Receiving/mockData';
import { AddPOModal } from '@/components/Receiving/ReceivingModals';
import {
  upsertProduct,
  recordMasterDelivery,
  resolveOrCreateSupplier,
  findMasterProduct,
  findProduct,
  genId,
} from '@/components/Suppliers/store';

function EntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poParam = searchParams.get('pos') ?? '';

  const [selectedIds, setSelectedIds] = useState<string[]>(() => poParam.split(',').filter(Boolean));
  const [showAddPO, setShowAddPO] = useState(false);

  const selectedPOs: PO[] = useMemo(() => {
    return selectedIds.map(id => MOCK_POS.find(po => po.id === id)).filter(Boolean) as PO[];
  }, [selectedIds]);

  const handleAddPO = useCallback((poId: string) => {
    setSelectedIds(prev => [...prev, poId]);
  }, []);

  if (selectedPOs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', fontFamily: 'var(--font-primary)' }}>
        <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>No POs selected.</p>
        <button
          onClick={() => router.push('/receive')}
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            background: 'var(--color-accent-active)',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            fontSize: '14px',
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
          }}
        >
          Go to PO Selection
        </button>
      </div>
    );
  }

  return (
    <>
      <ReceivingScreen
        pos={selectedPOs}
        onConfirm={(data) => {
          // 1. Commit alternative / off-PO products: create a real supplier
          //    product under the resolved supplier and blend its cost into the
          //    linked master's per-site weighted-average cost.
          let affectedMasterId: string | undefined;
          data.alternatives.forEach(alt => {
            const supplier = resolveOrCreateSupplier(alt.supplierName);
            const master = findMasterProduct(alt.masterProductId);
            upsertProduct({
              id: genId('prd'),
              name: alt.productName,
              source: 'supplier',
              supplierId: supplier.id,
              masterProductId: alt.masterProductId,
              supplierCode: alt.supplierCode || genId('ALT').toUpperCase(),
              productClass: master?.productClass ?? 'General',
              category: master?.category ?? 'Other',
              tags: ['Alternative delivery'],
              packType: alt.packType,
              packQty: alt.packQty,
              packCost: alt.packCost,
              taxRatePct: 5,
              singleUnitType: alt.singleUnitType,
              singleUnitVolumeOrWeight: alt.packQty,
              unitOfMeasure: master?.unit ?? alt.masterUnit,
              altUoms: [],
              allergensContains: [],
              allergensTraces: [],
              nutrition: {},
              sites: [alt.site],
              status: 'Available',
              flag: null,
            });
            const perUnit = alt.packQty > 0 ? alt.packCost / alt.packQty : 0;
            const deliveredUnits = alt.receivedQty * alt.packQty;
            recordMasterDelivery(alt.masterProductId, alt.site, deliveredUnits, perUnit);
            affectedMasterId = affectedMasterId ?? alt.masterProductId;
          });

          // 2. Blend WAC for normal received lines linked to a master (skip any
          //    line that was replaced by an alternative above).
          data.lines.forEach(l => {
            if (data.alternatives.some(a => a.originPoLineId === l.poLineId)) return;
            const po = selectedPOs.find(p => p.lines.some(pl => pl.id === l.poLineId));
            const poLine = po?.lines.find(pl => pl.id === l.poLineId);
            if (!po || !poLine?.masterProductId || !poLine.unitsPerLineItem) return;
            const perUnit = poLine.price / poLine.unitsPerLineItem;
            const deliveredUnits = l.receivedQty * poLine.unitsPerLineItem;
            if (deliveredUnits > 0) {
              recordMasterDelivery(poLine.masterProductId, po.site, deliveredUnits, perUnit);
              affectedMasterId = affectedMasterId ?? poLine.masterProductId;
            }
          });

          // 2b. Catalogue items added at receiving (no PO line) — blend their
          //     delivered cost into the linked master's WAC the same way.
          data.extras.forEach(extra => {
            const product = findProduct(extra.productId);
            if (!product?.masterProductId || extra.qty <= 0) return;
            const perUnit = product.packQty > 0 ? product.packCost / product.packQty : 0;
            const deliveredUnits = extra.qty * product.packQty;
            recordMasterDelivery(product.masterProductId, selectedPOs[0].site, deliveredUnits, perUnit);
            affectedMasterId = affectedMasterId ?? product.masterProductId;
          });

          const recordedGRN = recordCompletedDeliveryFromReceiving({
            pos: selectedPOs,
            lines: data.lines,
            alternatives: data.alternatives,
            extras: data.extras,
            invoiceNumber: data.invoiceNumber,
          });

          // 3. Update the POs themselves — back-ordered lines stay on the PO
          //    at the remaining qty so the second delivery can be received
          //    against it; fully-settled POs flip to Fully Received.
          applyReceiptToPOs({
            pos: selectedPOs,
            lines: data.lines,
            alternatives: data.alternatives,
          });

          const substitutedLineIds = new Set(
            data.alternatives.map(a => a.originPoLineId).filter((id): id is string => !!id),
          );
          const variances = data.lines.filter(l => {
            if (substitutedLineIds.has(l.poLineId)) return false;
            const po = selectedPOs.flatMap(p => p.lines).find(pl => pl.id === l.poLineId);
            return po && l.receivedQty !== po.expectedQty;
          }).length;
          const supplier = selectedPOs[0].supplier;
          const poNums = selectedPOs.map(p => p.poNumber).join(',');
          const params = new URLSearchParams({
            supplier,
            pos: poNums,
            variances: String(variances),
            alts: String(data.alternatives.length),
          });
          if (recordedGRN) params.set('grn', recordedGRN.grnNumber);
          if (affectedMasterId) params.set('master', affectedMasterId);

          // Back-ordered lines → tell the confirmation screen which POs
          // stay open so it can explain the second-delivery story.
          const backOrdered = data.lines.filter(l => l.resolution === 'Coming in another delivery').length;
          if (backOrdered > 0) {
            // selectedPOs are the live MOCK_POS objects, so their status
            // already reflects applyReceiptToPOs above.
            const openPos = selectedPOs.filter(p => p.status === 'Partially Received').map(p => p.poNumber);
            params.set('backorders', String(backOrdered));
            params.set('openpos', openPos.join(','));
          }
          router.push(`/receive/confirmed?${params.toString()}`);
        }}
        onBack={() => router.push('/receive')}
        onAddPO={() => setShowAddPO(true)}
      />

      {showAddPO && (
        <AddPOModal
          excludeIds={selectedIds}
          onAdd={handleAddPO}
          onClose={() => setShowAddPO(false)}
        />
      )}
    </>
  );
}

export default function ReceiveEntryPage() {
  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: '920px', margin: '0 auto' }}>
      <Suspense>
        <EntryContent />
      </Suspense>
    </div>
  );
}

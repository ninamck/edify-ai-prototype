'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import WasteLogPicker from '@/components/Waste/WasteLogPicker';
import WasteLogCard from '@/components/Waste/WasteLogCard';
import { phaseFromHour } from '@/components/briefing';
import type { WasteReasonId } from '@/components/Waste/wasteData';
import { WASTE_REASONS } from '@/components/Waste/wasteData';

function LogWasteInner() {
  const params = useSearchParams();
  const itemId = params.get('itemId');
  const qtyParam = params.get('qty');
  const reasonParam = params.get('reason');
  const queueParam = params.get('queue');
  const iParam = params.get('i');

  if (itemId) {
    const qty = qtyParam && Number.isFinite(+qtyParam) ? Math.max(0, +qtyParam) : 1;
    const isValidReason = reasonParam && WASTE_REASONS.some((r) => r.id === reasonParam);
    const reason = (isValidReason ? (reasonParam as WasteReasonId) : null);
    const queue = queueParam ? queueParam.split(',').filter(Boolean) : undefined;
    const queueIndex = iParam && Number.isFinite(+iParam) ? Math.max(0, +iParam) : 0;
    return (
      <WasteLogCard
        itemId={itemId}
        initialQty={qty}
        initialReason={reason}
        queue={queue}
        queueIndex={queueIndex}
      />
    );
  }

  const phase = phaseFromHour(new Date().getHours());
  return <WasteLogPicker phase={phase} />;
}

export default function LogWastePage() {
  return (
    <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>}>
      <LogWasteInner />
    </Suspense>
  );
}

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ReceiveHome from '@/components/Receiving/ReceiveHome';
import { isSampleId } from '@/components/Receiving/capture/samples';

function PhotoDelivery() {
  const params = useSearchParams();
  const sample = params.get('sample');
  return <ReceiveHome initialCapture={{ sample: isSampleId(sample) ? sample : undefined, poId: params.get('po') ?? undefined }} />;
}

export default function PhotoDeliveryPage() {
  return (
    <Suspense fallback={null}>
      <PhotoDelivery />
    </Suspense>
  );
}

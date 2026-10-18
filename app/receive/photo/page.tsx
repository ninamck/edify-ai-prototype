'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DeliveryCapture from '@/components/Receiving/capture/DeliveryCapture';
import { isSampleId } from '@/components/Receiving/capture/samples';

function PhotoDelivery() {
  const router = useRouter();
  const params = useSearchParams();
  const sample = params.get('sample');
  return (
    <DeliveryCapture
      initialSample={isSampleId(sample) ? sample : undefined}
      poId={params.get('po') ?? undefined}
      onClose={() => router.push('/receive')}
      onViewAccepted={() => router.push('/receive/accepted')}
    />
  );
}

export default function PhotoDeliveryPage() {
  return (
    <Suspense fallback={null}>
      <PhotoDelivery />
    </Suspense>
  );
}

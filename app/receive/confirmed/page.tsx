'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import ConfirmationScreen from '@/components/Receiving/ConfirmationScreen';

function ConfirmedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const supplier = searchParams.get('supplier') ?? 'Unknown';
  const poNums = (searchParams.get('pos') ?? '').split(',').filter(Boolean);
  const variances = parseInt(searchParams.get('variances') ?? '0', 10);

  const grnNumber = `GRN-${1245 + Math.floor(Math.random() * 10)}`;

  return (
    <ConfirmationScreen
      grnNumber={grnNumber}
      supplier={supplier}
      poNumbers={poNums}
      varianceCount={variances}
      receivedBy="Ravi Patel"
      onBackToDeliveries={() => router.push('/receive')}
    />
  );
}

export default function ConfirmedPage() {
  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: '680px', margin: '0 auto' }}>
      <Suspense>
        <ConfirmedContent />
      </Suspense>
    </div>
  );
}

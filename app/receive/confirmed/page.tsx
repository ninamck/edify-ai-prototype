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
  const altCount = parseInt(searchParams.get('alts') ?? '0', 10);
  const masterId = searchParams.get('master') ?? undefined;
  const backOrderCount = parseInt(searchParams.get('backorders') ?? '0', 10);
  const openPoNumbers = (searchParams.get('openpos') ?? '').split(',').filter(Boolean);

  const grnNumber = searchParams.get('grn') ?? `GRN-${1245 + Math.floor(Math.random() * 10)}`;

  return (
    <ConfirmationScreen
      grnNumber={grnNumber}
      supplier={supplier}
      poNumbers={poNums}
      varianceCount={variances}
      altCount={altCount}
      masterId={masterId}
      backOrderCount={backOrderCount}
      openPoNumbers={openPoNumbers}
      receivedBy="Ed Barry"
      onBackToDeliveries={() => router.push('/receive/upcoming')}
      onViewAccepted={() => router.push('/receive/accepted')}
      onViewMaster={masterId ? () => router.push(`/suppliers/master-products/${masterId}`) : undefined}
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

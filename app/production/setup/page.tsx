'use client';

// /production/setup — Jana's central rules: yield, shelf life, make-on
// days, lines, containers and kit, published once to every shop.
// `?tab=kitchen|days|recipes|log` opens on that tab (the Command Centre
// links here from a setup change).

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SetupScreen from '@/components/Production/farmerj/SetupScreen';

function SetupWithTab() {
  const params = useSearchParams();
  return <SetupScreen initialTab={params.get('tab') ?? undefined} />;
}

export default function FjSetupPage() {
  return (
    <Suspense fallback={null}>
      <SetupWithTab />
    </Suspense>
  );
}

'use client';

// /production/order-sheet — Farmer J ordering moved to the Orders area
// (Predictive ordering), where suggested orders are built from the same
// day plans. Old links land here and are sent on.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FjOrderSheetRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/assisted-ordering');
  }, [router]);
  return null;
}

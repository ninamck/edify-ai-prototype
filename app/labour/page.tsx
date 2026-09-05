'use client';

import { Suspense } from 'react';
import LabourPage from '@/components/Labour/LabourPage';

// Suspense boundary for useSearchParams: the receipt deep-links here
// with ?site= and ?tab=.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <LabourPage />
    </Suspense>
  );
}

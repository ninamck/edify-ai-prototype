import { Suspense } from 'react';
import HomeShell from '@/components/HomeShell';

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeShell />
    </Suspense>
  );
}

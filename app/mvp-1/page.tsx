import { Suspense } from 'react';
import Mvp1Shell from '@/components/Mvp1/Mvp1Shell';

export default function Mvp1Page() {
  return (
    <Suspense fallback={null}>
      <Mvp1Shell />
    </Suspense>
  );
}

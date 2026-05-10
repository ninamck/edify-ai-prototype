import { Suspense } from 'react';
import HomeShell from '@/components/HomeShell';

/**
 * Prod 2.0 home — same shell as the Original home (`/page.tsx`). The
 * sidebar is shared chrome and detects `demoVersion === 'prod2'` to
 * route the production / dispatch nav into `/prod-2/*` instead of the
 * Original `/production/*` and `/dispatch` paths.
 */
export default function Prod2HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeShell />
    </Suspense>
  );
}

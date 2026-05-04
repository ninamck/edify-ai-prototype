import { Suspense } from 'react';
import HomeShell from '@/components/HomeShell';

/**
 * Mockup-only route: renders the home shell with the navy brand tokens
 * rebound to a brighter electric blue (#0013E2). Nothing in globals.css
 * changes — the override is scoped to this wrapper, so every other route
 * keeps the original navy.
 */
export default function MockupBluePage() {
  return (
    <div
      style={
        {
          height: '100vh',
          // Scoped token override. These mirror the navy entries in
          // app/globals.css but resolved to the new electric-blue palette.
          ['--color-bg-nav' as string]: '#0210AD',
          ['--color-accent-active' as string]: '#0211BB',
          ['--color-accent-deep' as string]: '#010974',
          ['--color-accent-mid' as string]: '#4956D8',
          ['--color-quinn-bg' as string]: '#0211BB',
          ['--color-dot' as string]: '#0211BB',
        } as React.CSSProperties
      }
    >
      <Suspense fallback={null}>
        <HomeShell />
      </Suspense>
    </div>
  );
}

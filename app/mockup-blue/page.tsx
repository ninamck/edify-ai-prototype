import { Suspense } from 'react';
import { Poppins } from 'next/font/google';
import HomeShell from '@/components/HomeShell';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
});

/**
 * Mockup-only route: renders the home shell with the navy brand tokens
 * rebound to a hot pink palette anchored on #FF0058, and swaps the type
 * stack to Poppins. Nothing in globals.css changes — the overrides are
 * scoped to this wrapper, so every other route keeps the original navy
 * + Plus Jakarta Sans.
 */
export default function MockupBluePage() {
  return (
    <div
      className={poppins.variable}
      style={
        {
          height: '100vh',
          fontFamily: 'var(--font-poppins), sans-serif',
          // Scoped token overrides. These mirror the navy entries in
          // app/globals.css but resolved to a hot-pink palette built
          // around #FF0058, and rebind --font-primary so any component
          // that reads it picks up Poppins inside this route only.
          ['--color-bg-nav' as string]: '#FF0058',
          ['--color-accent-active' as string]: '#FF0058',
          ['--color-accent-deep' as string]: '#B3003D',
          ['--color-accent-mid' as string]: '#FF6699',
          ['--color-quinn-bg' as string]: '#FF0058',
          ['--color-dot' as string]: '#FF0058',
          ['--font-primary' as string]: 'var(--font-poppins), sans-serif',
        } as React.CSSProperties
      }
    >
      <Suspense fallback={null}>
        <HomeShell />
      </Suspense>
    </div>
  );
}

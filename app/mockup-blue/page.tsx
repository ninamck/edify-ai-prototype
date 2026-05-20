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
 * rebound to an indigo palette anchored on #1A148A, and swaps the type
 * stack to Poppins. Nothing in globals.css changes — the overrides are
 * scoped to this wrapper, so every other route keeps the original navy
 * + Poppins.
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
          // app/globals.css but resolved to an indigo palette built
          // around #1A148A, and rebind --font-primary so any component
          // that reads it picks up Poppins inside this route only.
          // Main canvas + card surfaces flipped to cream so the FloorActionsBox
          // and the canvas behind the Quinn/Feed area read as one warm surface
          // instead of two stacked whites.
          ['--color-bg-main' as string]: '#FCF6EE',
          ['--color-bg-surface' as string]: '#FCF6EE',
          ['--color-bg-nav' as string]: '#001C35',
          ['--color-accent-active' as string]: '#001C35',
          ['--color-accent-deep' as string]: '#120E61',
          ['--color-accent-mid' as string]: '#655FBB',
          ['--color-accent-quinn' as string]: '#FF0058',
          ['--color-brand-mark' as string]: '#FFFFFF',
          ['--color-shell-tab-bg' as string]: '#FCF6EE',
          ['--color-site-switcher-bg' as string]: '#FCF6EE',
          ['--color-quinn-bg' as string]: '#1A148A',
          ['--color-dot' as string]: '#1A148A',
          ['--color-text-primary' as string]: '#001C35',
          ['--color-text-secondary' as string]: '#001C35',
          ['--color-text-muted' as string]: '#001C35',
          color: '#001C35',
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

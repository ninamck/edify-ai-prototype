import { Suspense } from 'react';
import { Poppins } from 'next/font/google';
import HomeShell from '@/components/HomeShell';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
});

/**
 * Mockup-only route — v2 of /mockup-blue.
 *
 * Same HomeShell, same Poppins, same token override pattern (scoped to
 * this wrapper so the rest of the prototype keeps its original chrome).
 * Only the bindings change, using the new brand palette:
 *
 *   #001C35  deep navy  → nav rail, active state, all body type
 *   #1A148A  royal blue → Quinn CTA (distinct from the nav)
 *   #28AFC9  cyan       → brand mark, mid accent, notification dot
 *   #FCF6EE  cream      → primary shell surface (tab bar background)
 *   #F8E8D6  sand       → secondary surface (site switcher)
 *   #000000  black      → deepest accent for hover/pressed emphasis
 *
 * Notes on the choices:
 * - Nav moves from royal (v1) to navy: the real brand "primary dark"
 *   is #001C35, so the rail should anchor there. Royal becomes the
 *   action accent for Quinn instead.
 * - The v1 hot-pink Quinn dot is replaced by cyan, which is the new
 *   palette's highlight colour. There is intentionally no red here —
 *   the brief doesn't include one, so semantic destructive treatments
 *   (Waste, etc.) live in the prototype's own error tokens and are
 *   not rebound by this mockup.
 * - Sand vs cream: cream goes on the larger tab surface, sand on the
 *   smaller site-switcher pill, so the two warm tones layer rather
 *   than compete.
 */
export default function MockupBlueV2Page() {
  return (
    <div
      className={poppins.variable}
      style={
        {
          height: '100vh',
          fontFamily: 'var(--font-poppins), sans-serif',
          ['--color-bg-nav' as string]: '#001C35',
          ['--color-accent-active' as string]: '#001C35',
          ['--color-accent-deep' as string]: '#000000',
          ['--color-accent-mid' as string]: '#28AFC9',
          ['--color-accent-quinn' as string]: '#FF0058',
          ['--color-brand-mark' as string]: '#FF0058',
          ['--color-shell-tab-bg' as string]: '#FCF6EE',
          ['--color-site-switcher-bg' as string]: '#F8E8D6',
          ['--color-quinn-bg' as string]: '#1A148A',
          ['--color-dot' as string]: '#28AFC9',
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

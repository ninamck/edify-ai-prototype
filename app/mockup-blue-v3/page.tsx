import { Suspense } from 'react';
import { Poppins } from 'next/font/google';
import HomeShell from '@/components/HomeShell';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
});

/**
 * Mockup-only route — v3 of /mockup-blue.
 *
 * Same setup as v2, with the warm tones swapped/expanded:
 *
 *   #F8E8D6  sand  → primary shell surface (page background)
 *   #FCF6EE  cream → "On the floor" actions box surface
 *
 * The rest of the brand palette is unchanged from v2.
 */
export default function MockupBlueV3Page() {
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
          ['--color-brand-mark' as string]: '#28AFC9',
          ['--color-shell-tab-bg' as string]: '#FFFFFF',
          ['--color-site-switcher-bg' as string]: '#FFFFFF',
          ['--color-shell-topbar-border' as string]: '#001C35',
          ['--color-shell-tab-border' as string]: '#001C35',
          ['--color-site-switcher-border' as string]: '#001C35',
          ['--color-quinn-bg' as string]: '#1A148A',
          ['--color-dot' as string]: '#28AFC9',
          ['--color-text-primary' as string]: '#001C35',
          ['--color-text-secondary' as string]: '#001C35',
          ['--color-text-muted' as string]: '#001C35',
          ['--color-bg-main' as string]: '#F8E8D6',
          ['--color-bg-surface' as string]: '#F8E8D6',
          ['--color-floor-actions-bg' as string]: '#FCF6EE',
          ['--color-briefing-timeline-bg' as string]: '#FCF6EE',
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

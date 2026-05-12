'use client';

/**
 * Manage menu — shared chrome for the four list-level surfaces that
 * together describe everything the POS sees:
 *
 *   • Recipes          — what gets fired
 *   • Modifier groups  — variations the POS can apply
 *   • POS connection   — system-level link state (which POS, last sync)
 *   • Item matching    — ongoing reconciliation of POS items ↔ recipes
 *
 * Uses the same sticky-tab pattern as Production (TOP_NAV_PILL_*
 * constants from `components/Production/topNavStyles.ts`) so the two
 * managed areas of the app feel like one system.
 *
 * Editor sub-pages (`/recipes/[id]/edit`, `/modifier-groups/[id]/edit`)
 * deliberately live OUTSIDE this route group — they have their own
 * focused sticky header (Back / Save), and a tab strip above that
 * would invite destructive cross-tab navigation mid-edit.
 */

import Sidebar from '@/components/Sidebar/Sidebar';
import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';
import DemoControls from '@/components/DemoControls/DemoControls';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useRouter, usePathname } from 'next/navigation';
import {
  TOP_NAV_BAR_PADDING,
  TOP_NAV_PILL_ACTIVE,
  TOP_NAV_PILL_BASE,
  TOP_NAV_PILL_GAP,
  TOP_NAV_PILL_IDLE_TRANSPARENT,
} from '@/components/Production/topNavStyles';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

type Tab = { id: string; label: string; href: string };

const MENU_TABS: Tab[] = [
  { id: 'recipes',         label: 'Recipes',         href: '/recipes' },
  { id: 'modifier-groups', label: 'Modifier groups', href: '/modifier-groups' },
  { id: 'pos-connection',  label: 'POS connection',  href: '/pos-connection' },
  { id: 'item-matching',   label: 'Item matching',   href: '/item-matching' },
];

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const router = useRouter();
  const pathname = usePathname() ?? '';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        minHeight: '100vh',
        background: 'var(--color-bg-surface)',
        fontFamily: 'var(--font-primary)',
        alignItems: 'flex-start',
      }}
    >
      {!isMobile && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            flexShrink: 0,
            zIndex: 100,
          }}
        >
          <Sidebar />
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* Top bar — matches the Production layout so the two managed
            areas of the app feel like one system. */}
        <header
          style={{
            flexShrink: 0,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            minHeight: 52,
            padding: '10px 16px 10px 12px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
          }}
        >
          <div style={{ minWidth: 0, maxWidth: 240 }}>
            <SiteSwitcher siteName="Fitzroy Espresso" compact={false} />
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: '0.01em',
              }}
            >
              Manage menu
            </span>
          </div>

          <div style={{ minWidth: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
            <DemoControls variant="inline" />
            <button
              onClick={() => router.push('/')}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                background: '#fff',
                border: '1px solid var(--color-border)',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ← Home
            </button>
          </div>
        </header>

        {/* Sticky sub-tabs — Recipes / Modifier groups / POS connection /
            Item matching. Matches the Production tab strip 1:1 so the
            two managed surfaces of the app read as one system. */}
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 150,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: TOP_NAV_PILL_GAP,
            padding: TOP_NAV_BAR_PADDING,
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
            overflowX: 'auto',
          }}
        >
          {MENU_TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <button
                key={tab.id}
                onClick={() => router.push(tab.href)}
                style={{
                  ...TOP_NAV_PILL_BASE,
                  ...(active ? TOP_NAV_PILL_ACTIVE : TOP_NAV_PILL_IDLE_TRANSPARENT),
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Page body — flows in normal document scroll so each tab page
            scrolls naturally rather than an inner container. */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--color-bg-surface)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

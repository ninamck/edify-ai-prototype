'use client';

/**
 * Manage menu — shared chrome for the four list-level surfaces that
 * together describe everything the POS sees:
 *
 *   • Recipes          — what gets fired
 *   • Modifier groups  — variations the POS can apply
 *   • POS connection   — system-level link state (which POS, last sync)
 *   • Item matching    — ongoing reconciliation of POS items ↔ recipes
 *   • Email orders     — orders Edify read from the inbox and sent to the till
 *   • Square menu      — what Edify publishes to Square (Square customers
 *                        with publishing on only)
 *
 * Uses the shared AreaTopBar (single bar: site switcher · title ·
 * compact tabs) so the managed areas of the app feel like one system.
 *
 * Editor sub-pages (`/recipes/[id]/edit`, `/modifier-groups/[id]/edit`)
 * deliberately live OUTSIDE this route group — they have their own
 * focused sticky header (Back / Save), and a tab strip above that
 * would invite destructive cross-tab navigation mid-edit.
 */

import Sidebar from '@/components/Sidebar/Sidebar';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import DemoControls from '@/components/DemoControls/DemoControls';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { squareChangeCount, useSquareMenu } from '@/components/SquareMenu/squareMenuStore';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

type Tab = { id: string; label: string; href: string };

const MENU_TABS: Tab[] = [
  { id: 'recipes',         label: 'Recipes',         href: '/recipes' },
  { id: 'modifier-groups', label: 'Modifier groups', href: '/modifier-groups' },
  { id: 'pos-connection',  label: 'POS connection',  href: '/pos-connection' },
  { id: 'item-matching',   label: 'Item matching',   href: '/item-matching' },
  { id: 'email-orders',    label: 'Email orders',    href: '/email-orders' },
];

/** Only Square customers with publishing turned on see this tab. */
const SQUARE_MENU_TAB: Tab = { id: 'square-menu', label: 'Square menu', href: '/square-menu' };

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const squareMenu = useSquareMenu();
  const changes = squareChangeCount(squareMenu);
  const squareTab = changes ? { ...SQUARE_MENU_TAB, label: `Square menu (${changes})` } : SQUARE_MENU_TAB;
  const tabs = squareMenu.settings.enabled
    ? [...MENU_TABS.slice(0, 4), squareTab, ...MENU_TABS.slice(4)]
    : MENU_TABS;

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
        {/* Single top bar — site switcher · "Menu" title · sub-tabs
            (Recipes / Modifier groups / POS connection / Item matching),
            matching the redesigned area chrome. */}
        <AreaTopBar
          title="Menu"
          tabs={tabs}
          siteName="Fitzroy Espresso"
          rightSlot={<DemoControls variant="inline" />}
          backTo="/"
        />

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

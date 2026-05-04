'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Home,
  CalendarClock,
  ClipboardList,
  Send,
  ShoppingCart,
  PackageSearch,
  FileCheck,
  Clock,
  FileX,
  ShieldCheck,
  LayoutDashboard,
  TrendingUp,
  Layers,
  Star,
  MapPin,
  User,
  Settings,
  Table2,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react';

import NavGroup from './NavGroup';
import NavItem from './NavItem';
import { useApprovals } from '@/components/Approvals/approvalsStore';
import { needsReviewCount } from '@/components/Invoicing/mockData';
import { useDemoVersion } from '@/components/DemoControls/demoStore';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const approvals = useApprovals();
  const pendingApprovals = approvals.filter(a => a.status === 'pending').length;
  const invoiceReviewCount = needsReviewCount();
  const demoVersion = useDemoVersion();
  const homeHref = demoVersion === 'mvp1' ? '/mvp-1' : '/';
  /**
   * Sidebar starts collapsed (icon-only rail, 68px). The toggle pinned
   * to the bottom of the rail expands it to the labelled view (240px).
   * Each refresh starts collapsed again so the demo always opens with
   * the trim shell.
   */
  const [compact, setCompact] = useState(true);
  const is = (href: string) => pathname === href || pathname.startsWith(href + '/');

  // Persona-aware nav. The HUB sees the full operator set; the SPOKE sees
  // a curated subset that matches what a satellite site actually does:
  // they place orders (Plan production → spokes order page), count stock,
  // review suggested orders, see approvals + history + dashboard. They
  // don't dispatch (the hub does), don't match invoices or own credit
  // notes (estate-level), and don't see analytics / compare-sites
  // (estate-level performance views).
  const { isSpoke } = useActiveSite();

  return (
    <aside
      style={{
        width: compact ? '68px' : '240px',
        minWidth: compact ? '68px' : '240px',
        height: '100%',
        background: 'var(--color-bg-nav)',
        display: 'flex',
        flexDirection: 'column',
        padding: compact ? '8px 8px' : '10px',
        gap: compact ? '2px' : '4px',
        overflowY: 'auto',
        overflowX: 'hidden',
        flexShrink: 0,
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Zone 1 — Home (site switcher lives in ShellTopBar) */}
      <div style={{ marginTop: compact ? 0 : '2px' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          <NavItem
            label="Home"
            icon={Home}
            active={pathname === homeHref}
            compact={compact}
            onClick={() => router.push(homeHref)}
          />
        </ul>
      </div>

      {/* Zone 2 — Nav groups (on-the-floor actions live in the feed header row) */}
      <div style={{ flex: 1 }}>

        {/* Group 1 — Make, plan & dispatch (Manager+)
            Spoke sees only "Plan production" (their own order form on
            /production/spokes) and "View production summary". Dispatch
            is hub-only — spokes receive, they don't send. */}
        <NavGroup title={isSpoke ? 'Plan & order' : 'Make, plan & dispatch'} showDivider={true} compact={compact}>
          {/* Demo: hardcoded badge mirrors the Quinn floating-button counter
              so the sidebar shows there's something needing attention inside
              Production. Spoke persona doesn't need the badge — the spoke's
              attention items live on cards inside their order page. */}
          <NavItem
            label="Plan production"
            icon={CalendarClock}
            compact={compact}
            badge={isSpoke ? undefined : 4}
            active={is('/production')}
            onClick={() => router.push('/production/amounts')}
          />
          <NavItem label="View production summary" icon={ClipboardList} compact={compact} active={is('/production-summary')} />
          {!isSpoke && (
            <NavItem label="Dispatch to stores" icon={Send} compact={compact} active={is('/dispatch')} />
          )}
        </NavGroup>

        {/* Group 2 — Stock & ordering (Manager+)
            Spoke sees: suggested orders, stock count, approvals, order
            history. They don't match invoices or own credit notes — those
            sit at the estate level. */}
        <NavGroup title="Stock & ordering" compact={compact}>
          <NavItem label="Review suggested orders" icon={ShoppingCart} compact={compact} badge={3} active={is('/assisted-ordering')} onClick={() => router.push('/assisted-ordering')} />
          <NavItem label="Count stock" icon={PackageSearch} compact={compact} active={is('/stock-count')} />
          {!isSpoke && (
            <NavItem label="Match invoices" icon={FileCheck} compact={compact} badge={invoiceReviewCount || undefined} active={is('/invoices')} onClick={() => router.push('/invoices')} />
          )}
          <NavItem label="Review approvals" icon={ShieldCheck} compact={compact} badge={pendingApprovals || undefined} active={is('/approvals')} onClick={() => router.push('/approvals')} />
          <NavItem label="View order history" icon={Clock} compact={compact} active={is('/order-history')} onClick={() => router.push('/order-history')} />
          {!isSpoke && (
            <NavItem label="Manage credit notes" icon={FileX} compact={compact} active={is('/credit-notes')} onClick={() => router.push('/credit-notes')} />
          )}
        </NavGroup>

        {/* Group 3 — Performance (Manager+)
            Spoke sees only their own dashboard. Analytics, Compare sites
            and the table builder are cross-site / estate views the spoke
            doesn't have access to. */}
        <NavGroup title="Performance" compact={compact}>
          <NavItem label="View dashboard" icon={LayoutDashboard} compact={compact} active={is('/dashboard')} />
          {!isSpoke && (
            <>
              <NavItem label="View analytics" icon={TrendingUp} compact={compact} active={is('/analytics')} />
              <NavItem label="Compare sites" icon={Layers} compact={compact} active={is('/compare')} />
              <NavItem
                label="Build a table"
                icon={Table2}
                compact={compact}
                onClick={() => router.push('/mvp-1?build=table')}
              />
            </>
          )}
        </NavGroup>

        {/* SETUP — full set for both personas (per the demo brief). */}
        <NavGroup title="SETUP" compact={compact}>
          <NavItem label="Manage recipes" icon={Star} compact={compact} active={is('/recipes')} onClick={() => router.push('/recipes')} />
          <NavItem label="Manage suppliers" icon={MapPin} compact={compact} active={is('/suppliers')} />
          <NavItem label="Manage users" icon={User} compact={compact} active={is('/users')} />
          <NavItem label="Manage checklists" icon={ClipboardList} compact={compact} active={is('/checklists')} onClick={() => router.push('/checklists')} />
          <NavItem label="Configure settings" icon={Settings} compact={compact} active={is('/settings')} onClick={() => router.push('/settings')} />
        </NavGroup>

      </div>

      {/* Expand / collapse toggle — pinned just above the brand mark.
          The icon flips to communicate the action's direction
          (PanelLeftOpen when collapsed, PanelLeftClose when expanded). */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: compact ? 'center' : 'flex-end',
          padding: compact ? '6px 0 4px' : '6px 4px 4px',
        }}
      >
        <button
          type="button"
          onClick={() => setCompact(c => !c)}
          aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-primary)',
          }}
        >
          {compact ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Brand mark — pinned to the bottom of the rail. Centred when
          the rail is collapsed; left-aligned when expanded so it sits
          flush with the nav labels. */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: compact ? 'center' : 'flex-start',
          padding: compact ? '8px 0 8px' : '8px 12px 8px',
        }}
      >
        <img
          src="/edify-logo.svg"
          alt="Edify"
          style={{
            display: 'block',
            width: compact ? 28 : 32,
            height: 'auto',
            color: '#ffffff',
            filter: 'brightness(0) invert(1)',
          }}
        />
      </div>
    </aside>
  );
}

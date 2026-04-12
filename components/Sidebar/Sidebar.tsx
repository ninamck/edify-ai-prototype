'use client';

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
  LayoutDashboard,
  TrendingUp,
  Layers,
  Star,
  MapPin,
  User,
  Settings,
} from 'lucide-react';

import NavGroup from './NavGroup';
import NavItem from './NavItem';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  /** Icon-only rail (labels via tooltips); always minimised. */
  const compact = true;
  const is = (href: string) => pathname === href || pathname.startsWith(href + '/');

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
          <NavItem label="Home" icon={Home} active={pathname === '/'} compact={compact} onClick={() => router.push('/')} />
        </ul>
      </div>

      {/* Zone 2 — Nav groups (on-the-floor actions live in the feed header row) */}
      <div style={{ flex: 1 }}>

        {/* Group 1 — Make, plan & dispatch (Manager+) */}
        <NavGroup title="Make, plan & dispatch" showDivider={true} compact={compact}>
          <NavItem label="Plan production" icon={CalendarClock} compact={compact} active={is('/plan-production')} />
          <NavItem label="View production summary" icon={ClipboardList} compact={compact} active={is('/production-summary')} />
          <NavItem label="Dispatch to stores" icon={Send} compact={compact} active={is('/dispatch')} />
        </NavGroup>

        {/* Group 3 — Stock & ordering (Manager+) */}
        <NavGroup title="Stock & ordering" compact={compact}>
          <NavItem label="Review suggested orders" icon={ShoppingCart} compact={compact} badge={3} active={is('/assisted-ordering')} onClick={() => router.push('/assisted-ordering')} />
          <NavItem label="Count stock" icon={PackageSearch} compact={compact} active={is('/stock-count')} />
          <NavItem label="Match invoices" icon={FileCheck} compact={compact} badge={2} active={is('/invoices')} onClick={() => router.push('/invoices')} />
          <NavItem label="View order history" icon={Clock} compact={compact} active={is('/order-history')} onClick={() => router.push('/order-history')} />
          <NavItem label="Manage credit notes" icon={FileX} compact={compact} active={is('/credit-notes')} onClick={() => router.push('/credit-notes')} />
        </NavGroup>

        {/* Group 4 — Performance (Manager+) */}
        <NavGroup title="Performance" compact={compact}>
          <NavItem label="View dashboard" icon={LayoutDashboard} compact={compact} active={is('/dashboard')} />
          <NavItem label="View analytics" icon={TrendingUp} compact={compact} active={is('/analytics')} />
          <NavItem label="Compare sites" icon={Layers} compact={compact} active={is('/compare')} />
        </NavGroup>

        {/* SETUP */}
        <NavGroup title="SETUP" compact={compact}>
          <NavItem label="Manage recipes" icon={Star} compact={compact} active={is('/recipes')} />
          <NavItem label="Manage suppliers" icon={MapPin} compact={compact} active={is('/suppliers')} />
          <NavItem label="Manage users" icon={User} compact={compact} active={is('/users')} />
          <NavItem label="Manage checklists" icon={ClipboardList} compact={compact} active={is('/checklists')} onClick={() => router.push('/checklists')} />
          <NavItem label="Configure settings" icon={Settings} compact={compact} active={is('/settings')} />
        </NavGroup>

      </div>
    </aside>
  );
}

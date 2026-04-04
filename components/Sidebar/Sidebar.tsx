'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

import QuinnButton from './QuinnButton';
import NavGroup from './NavGroup';
import NavItem from './NavItem';

type QuinnState = 'idle' | 'thinking' | 'ready';
const QUINN_CYCLE: QuinnState[] = ['idle', 'thinking', 'ready'];

export default function Sidebar() {
  const router = useRouter();
  const [quinnState, setQuinnState] = useState<QuinnState>('idle');
  /** Icon-only rail (labels via tooltips); always minimised. */
  const compact = true;

  function cycleQuinn() {
    setQuinnState((prev) => {
      const next = QUINN_CYCLE[(QUINN_CYCLE.indexOf(prev) + 1) % QUINN_CYCLE.length];
      return next;
    });
  }

  return (
    <aside
      style={{
        width: compact ? '72px' : '240px',
        minWidth: compact ? '72px' : '240px',
        height: 'calc(100% - 24px)',
        margin: '12px 0 12px 12px',
        borderRadius: 'var(--radius-nav)',
        background: 'var(--color-bg-nav)',
        display: 'flex',
        flexDirection: 'column',
        padding: compact ? '8px 6px' : '10px',
        gap: compact ? '2px' : '4px',
        overflowY: 'auto',
        overflowX: 'hidden',
        flexShrink: 0,
        boxShadow: '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.04)',
      }}
    >
      {/* Zone 1 — Home (site switcher lives in ShellTopBar) */}
      <div style={{ marginTop: compact ? 0 : '2px' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          <NavItem label="Home" icon={Home} active={true} compact={compact} tone="quinn" />
        </ul>
      </div>

      {/* Zone 2 — Ask Quinn */}
      <div style={{ marginTop: compact ? 0 : '2px' }}>
        <QuinnButton state={quinnState} onClick={cycleQuinn} compact={compact} />
      </div>

      {/* Zone 3 — Nav groups (on-the-floor actions live in the feed header row) */}
      <div style={{ flex: 1 }}>

        {/* Group 1 — Make, plan & dispatch (Manager+) */}
        <NavGroup title="Make, plan & dispatch" showDivider={true} compact={compact}>
          <NavItem label="Plan production" icon={CalendarClock} compact={compact} />
          <NavItem label="View production summary" icon={ClipboardList} compact={compact} />
          <NavItem label="Dispatch to stores" icon={Send} compact={compact} />
        </NavGroup>

        {/* Group 3 — Stock & ordering (Manager+) */}
        <NavGroup title="Stock & ordering" compact={compact}>
          <NavItem label="Review suggested orders" icon={ShoppingCart} compact={compact} />
          <NavItem label="Count stock" icon={PackageSearch} compact={compact} />
          <NavItem label="Match invoices" icon={FileCheck} compact={compact} badge={2} onClick={() => router.push('/invoices')} />
          <NavItem label="View order history" icon={Clock} compact={compact} />
          <NavItem label="Manage credit notes" icon={FileX} compact={compact} />
        </NavGroup>

        {/* Group 4 — Performance (Manager+) */}
        <NavGroup title="Performance" compact={compact}>
          <NavItem label="View dashboard" icon={LayoutDashboard} compact={compact} />
          <NavItem label="View analytics" icon={TrendingUp} compact={compact} />
          <NavItem label="Compare sites" icon={Layers} compact={compact} />
        </NavGroup>

        {/* SETUP */}
        <NavGroup title="SETUP" compact={compact}>
          <NavItem label="Manage recipes" icon={Star} compact={compact} />
          <NavItem label="Manage suppliers" icon={MapPin} compact={compact} />
          <NavItem label="Manage users" icon={User} compact={compact} />
          <NavItem label="Manage checklists" icon={ClipboardList} compact={compact} />
          <NavItem label="Configure settings" icon={Settings} compact={compact} />
        </NavGroup>

      </div>
    </aside>
  );
}

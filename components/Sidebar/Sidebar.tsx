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
  ShieldCheck,
  LayoutDashboard,
  TrendingUp,
  Layers,
  Star,
  MapPin,
  User,
  Settings,
  ChefHat,
  ClipboardCheck,
  PackageCheck,
  ShoppingBag,
  PackageOpen,
  Trash2,
  LineChart,
  type LucideIcon,
} from 'lucide-react';

import NavGroup from './NavGroup';
import NavItem from './NavItem';
import { useApprovals } from '@/components/Approvals/approvalsStore';
import { needsReviewCount } from '@/components/Invoicing/mockData';
import { useCurrentRole } from '@/components/DemoControls/demoStore';
import { canSeeRoute } from '@/components/Production/roleFilter';

type SidebarItem = {
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: number;
};

type SidebarGroup = {
  title: string;
  items: SidebarItem[];
};

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const approvals = useApprovals();
  const role = useCurrentRole();
  const pendingApprovals = approvals.filter(a => a.status === 'pending').length;
  const invoiceReviewCount = needsReviewCount();
  const compact = true;
  const is = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const groups: SidebarGroup[] = [
    {
      title: 'Make, plan & dispatch',
      items: [
        { label: 'Plan production', icon: CalendarClock, href: '/production/demand' },
        { label: 'View production plan', icon: ClipboardList, href: '/production/plan/2026-04-22' },
        { label: 'My bench', icon: ChefHat, href: '/production/bench/bench-bake/tasks' },
        { label: 'Run PCR', icon: ClipboardCheck, href: '/production/pcr' },
        { label: 'Pick list', icon: PackageCheck, href: '/production/pick/run-p2' },
        { label: 'Dispatch to stores', icon: Send, href: '/production/dispatch' },
      ],
    },
    {
      title: 'Spoke actions',
      items: [
        { label: 'Order for my site', icon: ShoppingBag, href: '/ordering' },
        { label: 'Receive a delivery', icon: PackageOpen, href: '/receive' },
        { label: 'Log waste', icon: Trash2, href: '/log-waste' },
      ],
    },
    {
      title: 'Stock & ordering',
      items: [
        { label: 'Review suggested orders', icon: ShoppingCart, href: '/assisted-ordering', badge: 3 },
        { label: 'Count stock', icon: PackageSearch, href: '/stock-count' },
        { label: 'Match invoices', icon: FileCheck, href: '/invoices', badge: invoiceReviewCount || undefined },
        { label: 'Review approvals', icon: ShieldCheck, href: '/approvals', badge: pendingApprovals || undefined },
        { label: 'View order history', icon: Clock, href: '/order-history' },
        { label: 'Manage credit notes', icon: FileX, href: '/credit-notes' },
      ],
    },
    {
      title: 'Performance',
      items: [
        { label: 'View dashboard', icon: LayoutDashboard, href: '/dashboard' },
        { label: 'Sales feedback', icon: LineChart, href: '/production/sales' },
        { label: 'View analytics', icon: TrendingUp, href: '/analytics' },
        { label: 'Compare sites', icon: Layers, href: '/compare' },
      ],
    },
    {
      title: 'SETUP',
      items: [
        { label: 'Manage recipes', icon: Star, href: '/recipes' },
        { label: 'Manage suppliers', icon: MapPin, href: '/suppliers' },
        { label: 'Manage users', icon: User, href: '/users' },
        { label: 'Manage checklists', icon: ClipboardList, href: '/checklists' },
        { label: 'Configure settings', icon: Settings, href: '/settings' },
      ],
    },
  ];

  const visibleGroups = groups
    .map(g => ({ ...g, items: g.items.filter(i => canSeeRoute(role, i.href)) }))
    .filter(g => g.items.length > 0);

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
      <div style={{ marginTop: compact ? 0 : '2px' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          <NavItem label="Home" icon={Home} active={pathname === '/'} compact={compact} onClick={() => router.push('/')} />
        </ul>
      </div>

      <div style={{ flex: 1 }}>
        {visibleGroups.map((group, idx) => (
          <NavGroup
            key={group.title}
            title={group.title}
            showDivider={idx > 0}
            compact={compact}
          >
            {group.items.map(item => (
              <NavItem
                key={item.href}
                label={item.label}
                icon={item.icon}
                active={is(item.href)}
                badge={item.badge}
                compact={compact}
                onClick={() => router.push(item.href)}
              />
            ))}
          </NavGroup>
        ))}
      </div>
    </aside>
  );
}

'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Home,
  ShoppingCart,
  FileCheck,
  FileX,
  ClipboardList,
  CalendarClock,
  Send,
  PackageSearch,
  Clock,
  TrendingUp,
  Layers,
  Star,
  MapPin,
  User,
  Settings,
} from 'lucide-react';
import SiteSwitcher from '@/components/Sidebar/SiteSwitcher';

function DrawerNavItem({
  icon: Icon,
  label,
  badge,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '11px 16px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        textAlign: 'left',
        borderRadius: '8px',
        transition: 'background 0.12s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      <Icon size={17} color="var(--color-text-secondary)" strokeWidth={1.8} style={{ flexShrink: 0 }} />
      <span style={{
        flex: 1,
        fontSize: '13.5px',
        fontWeight: 500,
        color: 'var(--color-text-primary)',
      }}>
        {label}
      </span>
      {badge != null && (
        <span style={{
          minWidth: '18px',
          height: '18px',
          padding: '0 5px',
          borderRadius: '100px',
          background: 'var(--color-accent-deep)',
          color: '#F4F1EC',
          fontSize: '12px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{
      padding: '10px 16px 4px',
      fontSize: '12px',
      fontWeight: 700,
      letterSpacing: '0.04em',
      color: 'var(--color-text-muted)',
    }}>
      {label}
    </div>
  );
}

export default function MobileHamburgerDrawer({
  open,
  onClose,
  siteName,
}: {
  open: boolean;
  onClose: () => void;
  siteName: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function go(path: string) {
    onClose();
    router.push(path);
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="hamburger-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(34,68,68,1)',
              zIndex: 1100,
            }}
          />

          {/* Drawer panel */}
          <motion.div
            key="hamburger-drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: 'min(300px, 85vw)',
              zIndex: 1101,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--color-bg-nav)',
              fontFamily: 'var(--font-primary)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              paddingTop: 'max(0px, env(safe-area-inset-top))',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
            }}
          >
            {/* Drawer header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 12px 12px 16px',
              borderBottom: '1px solid var(--color-border-subtle)',
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
              }}>
                Menu
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--color-bg-hover)',
                  cursor: 'pointer',
                }}
              >
                <X size={17} color="var(--color-text-muted)" />
              </button>
            </div>

            {/* Site switcher */}
            <div style={{ padding: '12px 12px 4px' }}>
              <SiteSwitcher siteName={siteName} compact={false} />
            </div>

            {/* Home */}
            <div style={{ padding: '4px 8px' }}>
              <DrawerNavItem icon={Home} label="Home" onClick={() => go('/')} />
            </div>

            {/* Make, plan & dispatch */}
            <SectionDivider label="Make, plan & dispatch" />
            <div style={{ padding: '0 8px' }}>
              <DrawerNavItem icon={CalendarClock} label="Plan production" onClick={() => go('/')} />
              <DrawerNavItem icon={ClipboardList} label="View production summary" onClick={() => go('/')} />
              <DrawerNavItem icon={Send} label="Dispatch to stores" onClick={() => go('/')} />
            </div>

            {/* Stock & ordering */}
            <SectionDivider label="Stock & ordering" />
            <div style={{ padding: '0 8px' }}>
              <DrawerNavItem icon={ShoppingCart} label="Review suggested orders" badge={3} onClick={() => go('/assisted-ordering')} />
              <DrawerNavItem icon={PackageSearch} label="Count stock" onClick={() => go('/')} />
              <DrawerNavItem icon={FileCheck} label="Match invoices" badge={2} onClick={() => go('/invoices')} />
              <DrawerNavItem icon={Clock} label="View order history" onClick={() => go('/')} />
              <DrawerNavItem icon={FileX} label="Manage credit notes" onClick={() => go('/credit-notes')} />
            </div>

            {/* Performance */}
            <SectionDivider label="Performance" />
            <div style={{ padding: '0 8px' }}>
              <DrawerNavItem icon={TrendingUp} label="View analytics" onClick={() => go('/')} />
              <DrawerNavItem icon={Layers} label="Compare sites" onClick={() => go('/')} />
            </div>

            {/* Setup */}
            <SectionDivider label="Setup" />
            <div style={{ padding: '0 8px' }}>
              <DrawerNavItem icon={Star} label="Manage recipes" onClick={() => go('/')} />
              <DrawerNavItem icon={MapPin} label="Manage suppliers" onClick={() => go('/')} />
              <DrawerNavItem icon={User} label="Manage users" onClick={() => go('/')} />
              <DrawerNavItem icon={Settings} label="Configure settings" onClick={() => go('/')} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

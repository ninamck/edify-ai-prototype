'use client';

import { Menu } from 'lucide-react';

export default function MobileTopBar({
  siteName,
  onHamburgerOpen,
}: {
  siteName: string;
  onHamburgerOpen: () => void;
}) {
  return (
    <header
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '52px',
        paddingTop: 'max(0px, env(safe-area-inset-top))',
        paddingLeft: '4px',
        paddingRight: '12px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-nav)',
        boxShadow: '0 1px 0 rgba(58,48,40,0.08)',
        fontFamily: 'var(--font-primary)',
        zIndex: 100,
        position: 'relative',
      }}
    >
      {/* Hamburger */}
      <button
        type="button"
        onClick={onHamburgerOpen}
        aria-label="Open menu"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <Menu size={22} color="var(--color-text-primary)" strokeWidth={2} />
      </button>

      {/* Site name */}
      <span style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '14px',
        fontWeight: 700,
        color: 'var(--color-text-primary)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 'calc(100% - 120px)',
        textAlign: 'center',
      }}>
        {siteName}
      </span>

      {/* GM role pill */}
      <span style={{
        padding: '5px 10px',
        borderRadius: '100px',
        fontSize: '11px',
        fontWeight: 700,
        border: '1.5px solid var(--color-accent-active)',
        background: 'rgba(34,68,68,0.08)',
        color: 'var(--color-accent-active)',
        letterSpacing: '0.02em',
        flexShrink: 0,
      }}>
        GM
      </span>
    </header>
  );
}

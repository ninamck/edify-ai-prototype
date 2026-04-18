'use client';

import { useEffect, useRef, useState } from 'react';
import { Menu, Check, ChevronDown } from 'lucide-react';
import { BRIEFING_ROLES, type BriefingRole } from '@/components/briefing';

export default function MobileTopBar({
  siteName,
  onHamburgerOpen,
  role,
  onRoleChange,
}: {
  siteName: string;
  onHamburgerOpen: () => void;
  role: BriefingRole;
  onRoleChange: (role: BriefingRole) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const activeRole = BRIEFING_ROLES.find((r) => r.id === role) ?? BRIEFING_ROLES[2];

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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
        <Menu size={22} color="#FFFFFF" strokeWidth={2} />
      </button>

      {/* Site name */}
      <span style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '14px',
        fontWeight: 700,
        color: '#FFFFFF',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 'calc(100% - 160px)',
        textAlign: 'center',
      }}>
        {siteName}
      </span>

      {/* Role pill + dropdown */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`Change role · ${activeRole.short}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 8px 5px 10px',
            borderRadius: '100px',
            fontSize: '12px',
            fontWeight: 700,
            border: '1.5px solid rgba(255,255,255,0.4)',
            background: 'rgba(255,255,255,0.1)',
            color: '#FFFFFF',
            letterSpacing: '0.02em',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {activeRole.short}
          <ChevronDown size={12} color="#FFFFFF" strokeWidth={2.2} />
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              minWidth: '150px',
              padding: '6px',
              borderRadius: '12px',
              background: '#FFFFFF',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: '0 8px 24px rgba(3,28,89,0.18)',
              zIndex: 150,
            }}
          >
            {BRIEFING_ROLES.map((r) => {
              const isActive = r.id === role;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onRoleChange(r.id);
                    setMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: isActive ? 'var(--color-bg-hover)' : 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                    fontSize: '14px',
                    fontWeight: isActive ? 700 : 500,
                    color: 'var(--color-text-primary)',
                    textAlign: 'left',
                  }}
                >
                  {r.label}
                  {isActive && <Check size={14} color="var(--color-accent-active)" strokeWidth={2.4} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}

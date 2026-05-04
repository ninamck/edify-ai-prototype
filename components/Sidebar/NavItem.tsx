'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { LucideIcon } from 'lucide-react';

interface NavItemProps {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  badge?: number;
  dot?: boolean;
  /** Icon-only row (narrow screens). */
  compact?: boolean;
  /** Match Ask Quinn control: navy background + accent label colour. */
  tone?: 'default' | 'quinn';
  onClick?: () => void;
}

export default function NavItem({
  label,
  icon: Icon,
  active = false,
  badge,
  dot,
  compact = false,
  tone = 'default',
  onClick,
}: NavItemProps) {
  const [hoverTip, setHoverTip] = useState<{ left: number; top: number } | null>(null);

  return (
    <li>
      <button
        type="button"
        className="nav-item"
        data-active={active}
        aria-label={label}
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: compact ? 'center' : 'flex-start',
          gap: compact ? 0 : '8px',
          width: '100%',
          padding: compact ? '9px 6px' : '7px 10px',
          borderRadius: 'var(--radius-item)',
          border: 'none',
          cursor: 'pointer',
          background: active
            ? '#ffffff'
            : 'transparent',
          color: active ? 'var(--color-bg-nav)' : '#ffffff',
          fontSize: '13px',
          fontWeight: active ? 600 : 400,
          fontFamily: 'var(--font-primary)',
          textAlign: 'left',
          transition: 'background 0.12s ease, opacity 0.12s ease',
          outline: 'none',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          if (compact) {
            const r = btn.getBoundingClientRect();
            setHoverTip({ left: r.right + 10, top: r.top + r.height / 2 });
          }
          if (!active) {
            btn.style.background = 'rgba(255,255,255,0.10)';
          }
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          if (compact) setHoverTip(null);
          if (!active) {
            btn.style.background = 'transparent';
          }
        }}
      >
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon
            size={compact ? 19 : 15}
            strokeWidth={active ? 2.2 : 1.8}
            style={{ flexShrink: 0 }}
          />
          {compact && badge !== undefined && badge > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-9px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '18px',
                height: '18px',
                padding: '0 5px',
                borderRadius: '999px',
                background: '#ffffff',
                color: 'var(--color-bg-nav)',
                fontSize: '12px',
                fontWeight: 700,
                lineHeight: 1,
                boxShadow: '0 0 0 2px var(--color-bg-nav)',
                fontFamily: 'var(--font-primary)',
              }}
            >
              {badge}
            </span>
          )}
          {compact && dot && !badge && (
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-4px',
                width: '7px',
                height: '7px',
                borderRadius: 'var(--radius-dot)',
                background: active ? 'var(--color-badge-active-text)' : 'var(--color-dot)',
              }}
            />
          )}
        </span>

        {!compact && <span style={{ flex: 1 }}>{label}</span>}

        {!compact && badge !== undefined && badge > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '18px',
              height: '16px',
              padding: '0 5px',
              borderRadius: 'var(--radius-badge)',
              background: '#ffffff',
              color: 'var(--color-bg-nav)',
              fontSize: '12px',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {badge}
          </span>
        )}

        {!compact && dot && !badge && (
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: 'var(--radius-dot)',
              background: active ? 'var(--color-badge-active-text)' : 'var(--color-dot)',
              flexShrink: 0,
            }}
          />
        )}
      </button>
      {compact &&
        hoverTip &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              left: hoverTip.left,
              top: hoverTip.top,
              transform: 'translateY(-50%)',
              zIndex: 10000,
              padding: '7px 11px',
              borderRadius: '8px',
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: '0 4px 20px rgba(58,48,40,0.14)',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-primary)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {label}
          </div>,
          document.body,
        )}
    </li>
  );
}

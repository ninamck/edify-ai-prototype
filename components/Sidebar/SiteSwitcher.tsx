'use client';

import { ChevronDown } from 'lucide-react';

interface SiteSwitcherProps {
  siteName: string;
  compact?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function SiteSwitcher({ siteName, compact = false }: SiteSwitcherProps) {
  return (
    <button
      type="button"
      title={compact ? `${siteName} · Switch site` : undefined}
      aria-label={`${siteName}, switch site`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: compact ? 'center' : 'flex-start',
        gap: compact ? 0 : '10px',
        width: '100%',
        padding: compact ? '10px 6px' : '10px 10px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-bg-hover)',
        border: '1px solid var(--color-border-subtle)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'opacity 0.12s ease',
        fontFamily: 'var(--font-primary)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
    >
      {/* Site avatar */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: compact ? '36px' : '32px',
          height: compact ? '36px' : '32px',
          borderRadius: 'var(--radius-avatar)',
          background: 'var(--color-accent-active)',
          color: '#ffffff',
          fontSize: compact ? '12px' : '11px',
          fontWeight: 700,
          flexShrink: 0,
          letterSpacing: '0.02em',
        }}
      >
        {getInitials(siteName)}
      </span>

      {!compact && (
        <>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {siteName}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 400,
                color: 'var(--color-text-secondary)',
                marginTop: '1px',
              }}
            >
              Switch site
            </span>
          </span>

          <ChevronDown size={14} strokeWidth={2} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
        </>
      )}
    </button>
  );
}

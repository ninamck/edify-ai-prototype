'use client';

/**
 * Shared visual primitives reused by every Suppliers list / drawer / hero.
 * Keeping them in one file means colour treatments and tap-target sizes stay
 * consistent across Suppliers, Products, and Master Products tables.
 */

import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { type SupplierStatus } from './fixtures';

export function StatusPill({ status }: { status: SupplierStatus }) {
  const map: Record<SupplierStatus, { bg: string; color: string; border: string }> = {
    Available: { bg: 'var(--color-success-light)', color: 'var(--color-success)', border: 'var(--color-success-border)' },
    Unavailable: { bg: 'var(--color-bg-hover)', color: 'var(--color-text-muted)', border: 'var(--color-border-subtle)' },
    Pending: { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', border: 'var(--color-warning-border)' },
  };
  const c = map[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '3px 10px',
      borderRadius: 100,
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
      fontSize: 11.5,
      fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}

/**
 * Inline "Ask Quinn about this row" button. Sits in every list row so a user
 * can invoke the agent scoped to that single supplier / product / master.
 * Renders the Edify mark in a small circle to signal it's the AI affordance.
 */
export function RowQuinnButton({ onClick, ariaLabel }: { onClick: (e: React.MouseEvent) => void; ariaLabel: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      aria-label={ariaLabel}
      title="Ask Quinn"
      style={{
        width: 30, height: 30, borderRadius: 8,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-quinn-bg)'; e.currentTarget.style.borderColor = 'var(--color-quinn-bg)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; }}
    >
      <EdifyMark size={13} color="var(--color-accent-active)" strokeWidth={2.2} />
    </button>
  );
}

export function SmallButton({ label, onClick, variant = 'secondary' }: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: 'primary' | 'secondary';
}) {
  const primary = variant === 'primary';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      style={{
        padding: '6px 12px',
        borderRadius: 8,
        border: primary ? 'none' : '1px solid var(--color-border)',
        background: primary ? 'var(--color-accent-active)' : '#fff',
        color: primary ? '#fff' : 'var(--color-text-primary)',
        fontSize: 12, fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {label}
    </button>
  );
}

export function Checkbox({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <span
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      role="checkbox"
      aria-checked={checked}
      style={{
        width: 18, height: 18, borderRadius: 5,
        border: '1.5px solid ' + (checked ? 'var(--color-accent-active)' : 'var(--color-border)'),
        background: checked ? 'var(--color-accent-active)' : '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        cursor: 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {checked && (
        <svg width={11} height={11} viewBox="0 0 11 11" fill="none">
          <path d="M2 5.5l2.5 2.5L9 2.5" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

export function Dash() {
  return <span style={{ color: 'var(--color-border)', fontSize: 13 }}>—</span>;
}

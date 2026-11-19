'use client';

/**
 * Shared pieces for the Square menu screens: the right-hand sheet, stat
 * tiles, buttons and small labels. Visual language matches Item matching
 * and the modifier group drawer.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { STATUS_LABEL, STATUS_TONE, type TillStatus } from './tillItems';

export const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 14px', borderRadius: 10,
  border: 'none', background: 'var(--color-accent-active)',
  color: '#fff', fontSize: 13, fontWeight: 600,
  fontFamily: 'var(--font-primary)', cursor: 'pointer',
  flexShrink: 0,
};

export const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 13px', borderRadius: 10,
  border: '1px solid var(--color-border-subtle)', background: '#fff',
  color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 600,
  fontFamily: 'var(--font-primary)', cursor: 'pointer',
  flexShrink: 0,
};

export const linkBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: 0, border: 'none', background: 'transparent',
  color: 'var(--color-accent-active)', fontSize: 12.5, fontWeight: 600,
  fontFamily: 'var(--font-primary)', cursor: 'pointer',
  textDecoration: 'underline', textUnderlineOffset: 2,
};

export const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--color-border-subtle)', background: '#fff',
  fontSize: 13, color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-primary)',
};

export const eyebrow: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--color-text-muted)',
};

export const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 12,
};

export function TillStatusPill({ status, size = 'sm' }: { status: TillStatus; size?: 'xs' | 'sm' }) {
  return (
    <StatusPill tone={STATUS_TONE[status]} size={size}>
      {STATUS_LABEL[status]}
    </StatusPill>
  );
}

export function SourceChip({ kind }: { kind: 'recipe' | 'product' | 'square' }) {
  const label = kind === 'recipe' ? 'Recipe' : kind === 'product' ? 'Product' : 'Square only';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '1px 7px', borderRadius: 6,
        border: '1px solid var(--color-border-subtle)',
        fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
        background: '#fff', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

export function StatTile({
  label, value, active, accent, onClick, hint,
}: {
  label: string;
  value: number;
  active: boolean;
  accent: string;
  onClick: () => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        textAlign: 'left',
        padding: '12px 14px',
        borderRadius: 12,
        border: active ? '1px solid var(--color-accent-active)' : '1px solid var(--color-border-subtle)',
        background: '#fff',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        display: 'flex', flexDirection: 'column', gap: 4,
        boxShadow: active ? '0 0 0 2px rgba(0, 28, 53, 0.08)' : 'none',
        transition: 'box-shadow 120ms ease, border-color 120ms ease',
        minWidth: 0,
      }}
    >
      <span style={eyebrow}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: accent }}>{value}</span>
      {hint && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{hint}</span>}
    </button>
  );
}

/**
 * Right-hand sheet. Portal, backdrop, Esc to close, focus moves into the
 * sheet on open and back to the opener on close.
 */
export function Sheet({
  eyebrowText, title, onClose, headerRight, footer, width = 760, children, labelledBy,
}: {
  eyebrowText?: string;
  title: React.ReactNode;
  onClose: () => void;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = labelledBy ?? 'square-sheet-title';

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!panelRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', justifyContent: 'flex-end',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          position: 'relative',
          width: `min(${width}px, 96vw)`,
          height: '100%',
          background: 'var(--color-bg-page, #f7f7f8)',
          boxShadow: '-12px 0 32px rgba(3,15,58,0.18)',
          display: 'flex', flexDirection: 'column',
          outline: 'none',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            background: '#fff',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {eyebrowText && <div style={eyebrow}>{eyebrowText}</div>}
            <h2 id={titleId} style={{ fontSize: 16, fontWeight: 700, margin: '2px 0 0', color: 'var(--color-text-primary)' }}>
              {title}
            </h2>
          </div>
          {headerRight}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid var(--color-border-subtle)', background: '#fff',
              color: 'var(--color-text-secondary)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px' }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: '12px 20px',
              background: '#fff',
              borderTop: '1px solid var(--color-border-subtle)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function Section({ title, hint, children, right }: { title: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section style={{ ...card, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>{title}</h3>
          {hint && <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '3px 0 0', lineHeight: 1.45 }}>{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function FieldLabel({ htmlFor, children, hint }: { htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', marginBottom: 5 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>{children}</span>
      {hint && <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 6 }}>{hint}</span>}
    </label>
  );
}

/** Number input that lets people type "3." on the way to "3.50". Blank means no value. */
export function NumberField({
  value, onChange, ariaLabel, placeholder, width = 90, decimals, id,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  ariaLabel: string;
  placeholder?: string;
  width?: number;
  decimals?: number;
  id?: string;
}) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const display = value == null ? '' : decimals != null ? value.toFixed(decimals) : String(value);
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      inputMode="decimal"
      placeholder={placeholder}
      style={{ ...inputStyle, width }}
      value={focused ? text : display}
      onFocus={() => { setText(value == null ? '' : String(value)); setFocused(true); }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        if (t.trim() === '') onChange(null);
        else if (!Number.isNaN(Number(t))) onChange(Number(t));
      }}
    />
  );
}

/** Toggle pill used for multi-select (sites, groups). */
export function PillToggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        padding: '6px 12px', borderRadius: 100,
        border: on ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
        background: on ? 'var(--color-accent-active)' : '#fff',
        color: on ? '#fff' : 'var(--color-text-secondary)',
        fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {children}
    </button>
  );
}

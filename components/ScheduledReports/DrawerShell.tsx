'use client';

/**
 * Right-hand slide-in drawer shell shared by the chart-chat and
 * schedule-report drawers. Same portal/backdrop/enter-transition
 * pattern as TaskHistoryDrawer.
 */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function DrawerShell({
  open,
  onClose,
  title,
  subtitle,
  width = 440,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      setEntered(false);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Drawers only open from client-side interaction, so `open` is always
  // false during SSR — the document guard is just belt and braces.
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 12, 24, 0.36)',
          opacity: entered ? 1 : 0,
          transition: 'opacity 180ms ease',
        }}
      />
      <aside
        role="dialog"
        aria-label={title}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: `min(92vw, ${width}px)`,
          background: '#fff',
          boxShadow: '-12px 0 32px rgba(0, 12, 24, 0.22)',
          borderLeft: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
          display: 'flex',
          flexDirection: 'column',
          transform: entered ? 'translateX(0)' : 'translateX(100%)',
          opacity: entered ? 1 : 0,
          transition: 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms ease',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '16px 16px 12px',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</div>
            {subtitle && (
              <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              color: 'var(--color-text-muted)',
              display: 'inline-flex',
            }}
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
        {footer && (
          <div style={{ borderTop: '1px solid var(--color-border-subtle)', padding: '12px 16px' }}>{footer}</div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';

export default function MobileChartFullscreen({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;
  if (!open) return null;

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'var(--color-bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <header
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 52,
          paddingTop: 'max(0px, env(safe-area-inset-top))',
          padding: '0 12px',
          background: 'var(--color-bg-nav)',
          borderBottom: '1px solid var(--color-border-subtle)',
          color: '#fff',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <ChevronLeft size={24} color="#fff" strokeWidth={2} />
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.75)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 16,
        }}
      >
        <div
          style={{
            width: '100%',
            height: 'min(60vh, 420px)',
            padding: 12,
            borderRadius: 12,
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
            boxShadow: '0 2px 12px rgba(58,48,40,0.1)',
          }}
        >
          {children}
        </div>
        <p
          style={{
            margin: '12px 4px 0',
            fontSize: 11,
            color: 'var(--color-text-muted)',
          }}
        >
          Rotate device for a wider view.
        </p>
      </div>
    </motion.div>,
    document.body,
  );
}

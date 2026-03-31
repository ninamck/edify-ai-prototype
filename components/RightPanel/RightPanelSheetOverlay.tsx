'use client';

import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function RightPanelSheetOverlay({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="rp-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-bg-surface)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            paddingTop: 'max(14px, env(safe-area-inset-top))',
            borderBottom: '1px solid var(--color-border-subtle)',
            flexShrink: 0,
            background: '#fff',
          }}>
            <span style={{
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}>
              {title}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--color-bg-surface)',
                cursor: 'pointer',
              }}
            >
              <X size={18} color="var(--color-text-muted)" />
            </button>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '12px 12px max(24px, env(safe-area-inset-bottom))',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

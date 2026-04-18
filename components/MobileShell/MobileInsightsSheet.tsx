'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import MorningBriefingTimeline from '@/components/Feed/MorningBriefingTimeline';

export default function MobileInsightsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="insights-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(34,68,68,0.4)',
              zIndex: 1100,
            }}
          />
          {/* Sheet */}
          <motion.div
            key="insights-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1101,
              height: '82vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--color-bg-surface)',
              borderRadius: '16px 16px 0 0',
              fontFamily: 'var(--font-primary)',
              overflow: 'hidden',
            }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
              <div style={{
                width: '36px',
                height: '4px',
                borderRadius: '2px',
                background: 'var(--color-border-subtle)',
              }} />
            </div>

            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 16px 12px',
              borderBottom: '1px solid var(--color-border-subtle)',
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
              }}>
                Quinn &amp; Review
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--color-bg-hover)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} color="var(--color-text-muted)" />
              </button>
            </div>

            {/* Content */}
            <div style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: '12px 12px max(24px, env(safe-area-inset-bottom))',
            }}>
              <MorningBriefingTimeline briefingRole="gm" phase="morning" layout="sheet" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

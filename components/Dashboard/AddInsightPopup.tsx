'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import Feed from '@/components/Feed/Feed';
import type { BriefingRole } from '@/components/briefing';
import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';

const SEED_PROMPT = 'Tell us about the insight you want to create.';

export default function AddInsightPopup({
  open,
  onClose,
  briefingRole,
  onAddToDashboard,
}: {
  open: boolean;
  onClose: () => void;
  briefingRole: BriefingRole;
  onAddToDashboard: (id: AnalyticsChartId) => void;
}) {
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
          <motion.div
            key="add-insight-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1200,
              background: 'rgba(3, 28, 89, 0.25)',
              backdropFilter: 'blur(2px)',
            }}
          />

          <div
            key="add-insight-center"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1201,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              pointerEvents: 'none',
            }}
          >
            <motion.div
              key="add-insight-panel"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{
                pointerEvents: 'auto',
                width: 'min(720px, 100%)',
                height: 'min(640px, 90vh)',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 16,
                background: '#fff',
                border: '1px solid var(--color-border-subtle)',
                boxShadow: '0 12px 40px rgba(3,28,89,0.18), 0 0 0 1px rgba(58,48,40,0.04)',
                fontFamily: 'var(--font-primary)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    Add an insight
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    Quinn will build and pin it to your dashboard
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--color-bg-hover)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} color="var(--color-text-muted)" />
                </button>
              </div>

              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                }}
              >
                <Feed
                  briefingRole={briefingRole}
                  noHeader
                  seedUserPrompt={SEED_PROMPT}
                  onAddToDashboard={(id) => {
                    onAddToDashboard(id);
                  }}
                />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

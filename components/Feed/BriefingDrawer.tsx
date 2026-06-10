'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { BriefingRole, BriefingPhase } from '@/components/briefing';
import { BriefingContent } from '@/components/Feed/MorningBriefingBody';

export function briefingLabelForPhase(phase: BriefingPhase): { title: string; subtitle: string } {
  switch (phase) {
    case 'morning':
      return { title: 'Morning briefing', subtitle: 'Calls before service.' };
    case 'midday':
      return { title: 'Midday update', subtitle: 'Pacing and floor calls.' };
    case 'afternoon':
      return { title: 'Afternoon briefing', subtitle: 'Wrap and prep tomorrow.' };
    case 'evening':
      return { title: 'Evening wrap', subtitle: 'Close and hand-off.' };
  }
}

export default function BriefingDrawer({
  open,
  onClose,
  briefingRole,
  phase,
}: {
  open: boolean;
  onClose: () => void;
  briefingRole: BriefingRole;
  phase: BriefingPhase;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  const { title, subtitle } = briefingLabelForPhase(phase);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 28, 53, 0.18)',
              zIndex: 1100,
            }}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            role="dialog"
            aria-label={title}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(460px, 100vw)',
              background: 'var(--color-briefing-timeline-bg, #fff)',
              boxShadow: '-20px 0 60px rgba(0, 28, 53, 0.16)',
              zIndex: 1101,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'var(--font-primary)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '14px 18px 12px',
                borderBottom: '1px solid var(--color-border-subtle)',
                flexShrink: 0,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      lineHeight: 1.25,
                      fontFamily: 'var(--font-display, var(--font-primary))',
                    }}
                  >
                    {title}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-muted)',
                      lineHeight: 1.3,
                      flexShrink: 0,
                    }}
                  >
                    {today}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.4,
                    marginTop: '2px',
                  }}
                >
                  {subtitle}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--color-bg-surface)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={16} color="var(--color-text-muted)" />
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
                padding: '12px 16px 20px',
              }}
            >
              <BriefingContent role={briefingRole} phase={phase} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { BriefingPhase } from '@/components/briefing';
import { NoteForEdify } from '@/components/Feed/MorningBriefingBody';

export default function NoteForEdifyPopup({
  open,
  onClose,
  phase,
}: {
  open: boolean;
  onClose: () => void;
  phase: BriefingPhase;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="note-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1200,
              background: 'rgba(0, 28, 53, 0.25)',
              backdropFilter: 'blur(2px)',
            }}
          />
          <div
            key="note-center"
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
              key="note-panel"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              role="dialog"
              aria-label="Note for Edify"
              style={{
                pointerEvents: 'auto',
                position: 'relative',
                width: 'min(440px, 100%)',
                maxHeight: '100%',
                overflowY: 'auto',
                fontFamily: 'var(--font-primary)',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--color-bg-hover)',
                  cursor: 'pointer',
                }}
              >
                <X size={15} color="var(--color-text-muted)" />
              </button>
              <NoteForEdify phase={phase} />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

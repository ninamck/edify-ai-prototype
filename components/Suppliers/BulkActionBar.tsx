'use client';

/**
 * Sticky bottom bar that appears whenever rows are checked. Pattern lifted
 * from app/recipes/page.tsx so the cognitive model stays the same across the
 * two areas.
 *
 * Right-hand action is "Ask Quinn" rather than a separate Bulk-edit menu \u2014
 * Quinn is now the single bulk-edit surface (per the design principle 3:
 * conversational over transactional).
 */

import { motion, AnimatePresence } from 'framer-motion';
import EdifyMark from '@/components/EdifyMark/EdifyMark';

export default function BulkActionBar({
  selectedCount,
  onClear,
  onAskQuinn,
  noun = 'item',
}: {
  selectedCount: number;
  onClear: () => void;
  onAskQuinn: () => void;
  noun?: string;
}) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed',
            left: 0, right: 0, bottom: 0,
            padding: '14px clamp(20px, 4vw, 60px)',
            background: 'rgba(255,255,255,0.96)',
            borderTop: '1px solid var(--color-border-subtle)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', justifyContent: 'center',
            zIndex: 150,
          }}
        >
          <div style={{
            maxWidth: 1180, width: '100%',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              <strong style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{selectedCount}</strong>{' '}
              {noun}{selectedCount === 1 ? '' : 's'} selected
            </div>
            <button
              onClick={onClear}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: '#fff',
                fontSize: 12.5, fontWeight: 600,
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
              }}
            >
              Clear
            </button>
            <button
              onClick={onAskQuinn}
              style={{
                padding: '8px 16px',
                borderRadius: 100,
                border: 'none',
                background: 'var(--color-accent-active)',
                color: '#fff',
                fontSize: 12.5, fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <EdifyMark size={12} color="#fff" strokeWidth={2.2} />
              Ask Quinn what to do
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

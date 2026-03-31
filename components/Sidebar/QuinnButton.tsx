'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import QuinnOrb from './QuinnOrb';

export type QuinnState = 'idle' | 'thinking' | 'ready';

interface QuinnButtonProps {
  state?: QuinnState;
  onClick?: () => void;
  compact?: boolean;
}

const LABEL: Record<QuinnState, string> = {
  idle:     'Ask Quinn',
  thinking: 'Quinn is thinking…',
  ready:    'Quinn is ready',
};

export default function QuinnButton({ state = 'idle', onClick, compact = false }: QuinnButtonProps) {
  const [hoverTip, setHoverTip] = useState<{ left: number; top: number } | null>(null);
  const tipText = LABEL[state];

  return (
    <>
    <button
      type="button"
      onClick={onClick}
      aria-label={tipText}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: compact ? 'center' : 'flex-start',
        gap: compact ? 0 : '10px',
        width: '100%',
        padding: compact ? '10px 6px' : '11px 14px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-quinn-bg)',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        transition: 'opacity 0.12s ease',
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.opacity = '0.9';
        if (compact) {
          const r = btn.getBoundingClientRect();
          setHoverTip({ left: r.right + 10, top: r.top + r.height / 2 });
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = '1';
        if (compact) setHoverTip(null);
      }}
    >
      {/* Geometric orb */}
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <QuinnOrb state={state} size={compact ? 30 : 26} />
      </span>

      {!compact && (
        <AnimatePresence mode="wait">
          <motion.span
            key={state}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-quinn-label)',
              letterSpacing: '0.01em',
            }}
          >
            {LABEL[state]}
          </motion.span>
        </AnimatePresence>
      )}
    </button>
    {compact &&
      hoverTip &&
      createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            left: hoverTip.left,
            top: hoverTip.top,
            transform: 'translateY(-50%)',
            zIndex: 10000,
            padding: '7px 11px',
            borderRadius: '8px',
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: '0 4px 20px rgba(58,48,40,0.14)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {tipText}
        </div>,
        document.body,
      )}
    </>
  );
}

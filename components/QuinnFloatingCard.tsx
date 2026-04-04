'use client';

import { useState } from 'react';
import { Minus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Feed from '@/components/Feed/Feed';
import QuinnOrb from '@/components/Sidebar/QuinnOrb';

export default function QuinnFloatingCard() {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '10px',
        fontFamily: 'var(--font-primary)',
        pointerEvents: 'none',
      }}
    >
      {/* ── Expanded chat card ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="quinn-card"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            style={{
              width: '400px',
              height: '560px',
              background: '#fff',
              borderRadius: '16px',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: '0 12px 48px rgba(34,68,68,0.18), 0 2px 12px rgba(34,68,68,0.10)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              pointerEvents: 'auto',
            }}
          >
            {/* Card header */}
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'var(--color-accent-deep)',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <QuinnOrb state="idle" size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                  Quinn
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', marginTop: '1px' }}>
                  AI kitchen assistant
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Minimise Quinn"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'rgba(255,255,255,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              >
                <Minus size={14} color="#fff" strokeWidth={2.5} />
              </button>
            </div>

            {/* Feed — no internal header since we provide our own */}
            <Feed
              briefingRole="ravi"
              noHeader={true}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating trigger button ─────────────────────────────────────────── */}
      <motion.button
        type="button"
        onClick={() => setOpen(v => !v)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        aria-label={open ? 'Minimise Quinn' : 'Open Quinn'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 18px 10px 12px',
          background: 'var(--color-accent-deep)',
          borderRadius: '100px',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(34,68,68,0.35)',
          color: '#fff',
          fontFamily: 'var(--font-primary)',
          fontSize: '14px',
          fontWeight: 700,
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <QuinnOrb state="idle" size={20} />
        </div>
        <span>Quinn</span>
      </motion.button>
    </div>
  );
}

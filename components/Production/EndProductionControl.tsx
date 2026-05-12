'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Power } from 'lucide-react';

/**
 * End production / Reopen control.
 *
 * Lives in the right-aligned slot of the production layout's sub-tab
 * nav so it's available across every Run-group surface (Today, Run
 * sheet, Benches, PCR queue, Live sales). The action is the same on
 * each page: a manager declares the day's bake done, the kitchen winds
 * down. Mounted by the layout (not per-page) so the control persists
 * across sub-tab navigation without flicker and the state survives the
 * route change.
 *
 * State is local React (Record<siteId-date, timestamp>) — same shape
 * the prod-2 AmountsView uses internally. Persisting per (site, date)
 * means switching personas / sites doesn't bleed one site's "ended"
 * state into another, and reopening is a one-click undo.
 *
 * `editable` (default true) lets the caller hide the action on read-
 * only days (past / future) without unmounting; we just render
 * nothing in that case so the nav row's right side stays empty rather
 * than carrying a disabled affordance.
 */
export default function EndProductionControl({
  siteId,
  date,
  editable = true,
}: {
  siteId: string;
  date: string;
  /** When false, the control renders nothing — past / future days. */
  editable?: boolean;
}) {
  const [endedRecord, setEndedRecord] = useState<Record<string, string | undefined>>({});
  const endedKey = `${siteId}-${date}`;
  const endedAt = endedRecord[endedKey];
  const [confirmOpen, setConfirmOpen] = useState(false);

  function endProduction() {
    const stamp = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    setEndedRecord(prev => ({ ...prev, [endedKey]: stamp }));
    setConfirmOpen(false);
  }
  function reopenProduction() {
    setEndedRecord(prev => {
      const next = { ...prev };
      delete next[endedKey];
      return next;
    });
  }

  if (!editable) return null;

  return (
    <>
      {endedAt ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 44,
            padding: '8px 14px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 700,
            background: '#ffffff',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
            fontFamily: 'var(--font-primary)',
          }}
          title={`Production ended at ${endedAt}`}
        >
          <CheckCircle2 size={14} color="var(--color-success)" />
          <span style={{ color: 'var(--color-text-primary)' }}>
            Production ended · {endedAt}
          </span>
          <button
            type="button"
            onClick={reopenProduction}
            style={{
              marginLeft: 4,
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 700,
              background: 'var(--color-bg-hover)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Reopen
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 44,
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            background: 'var(--color-accent-active)',
            color: 'var(--color-text-on-active)',
            border: '1px solid var(--color-accent-active)',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(12,20,44,0.08)',
            whiteSpace: 'nowrap',
          }}
          title="Lock today's plan and signal the kitchen to wind down"
        >
          <Power size={13} /> End production
        </button>
      )}

      <AnimatePresence>
        {confirmOpen && (
          <EndProductionConfirmModal
            date={date}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={endProduction}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Centred, low-chrome confirmation modal. Spells out what ending
 * production actually does so a manager doesn't trigger it by
 * accident; Reopen is one click from the nav badge that replaces the
 * button on confirm, so this stays a soft commit, not destructive.
 *
 * Mirrors the modal that prod-2 AmountsView ships — same copy, same
 * styling, lifted into a shared component so MVP1 and prod-2 can
 * eventually converge on one End-production surface.
 */
function EndProductionConfirmModal({
  date,
  onCancel,
  onConfirm,
}: {
  date: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (typeof window === 'undefined') return null;
  return createPortal(
    <>
      <motion.div
        key="end-production-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(12, 20, 44, 0.55)',
          zIndex: 1300,
        }}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1301,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          pointerEvents: 'none',
        }}
      >
        <motion.div
          key="end-production-card"
          role="dialog"
          aria-label="End production"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          style={{
            width: 'min(440px, 100%)',
            borderRadius: 'var(--radius-card)',
            background: '#ffffff',
            boxShadow: '0 24px 64px rgba(12,20,44,0.32)',
            fontFamily: 'var(--font-primary)',
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '20px 22px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--color-info-light)',
                color: 'var(--color-info)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Power size={18} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                End production for {date}?
              </h2>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
                Today's plan will be locked and the kitchen signalled to wind down. Batches in progress
                still complete; nothing new will be started. You can reopen the day at any time from the
                badge that replaces this button.
              </p>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '12px 16px',
              background: 'var(--color-bg-hover)',
              borderTop: '1px solid var(--color-border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '9px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                background: '#ffffff',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                background: 'var(--color-accent-active)',
                color: 'var(--color-text-on-active)',
                border: '1px solid var(--color-accent-active)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'var(--font-primary)',
              }}
            >
              <Power size={12} /> End production
            </button>
          </div>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}

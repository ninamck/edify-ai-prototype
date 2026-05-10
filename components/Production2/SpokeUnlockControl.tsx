'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Unlock, Lock, X, AlertOctagon } from 'lucide-react';
import {
  getSite,
  type SiteId,
  type SkuId,
  type SpokeSubmission,
} from './fixtures';
import { useHubUnlocks } from './hubUnlockStore';

/**
 * SpokeUnlockControl — the hub-side per-spoke "Unlock" affordance on
 * the dispatch matrix. Sits on each per-spoke control card next to the
 * Send button.
 *
 * States it can render:
 *  1. **Hidden** — the order is editable normally (still pre-cutoff or
 *     plain draft). Nothing to do; no override needed.
 *  2. **"Unlock" button** — cutoff has passed, the spoke's order is
 *     locked, the dispatch hasn't been sent yet. Click opens the reason
 *     modal. The hub manager picks a reason (mandatory) and confirms.
 *  3. **"🔓 Open · HH:mm" badge** — the spoke order is currently
 *     unlocked. Tooltip surfaces the reason + who unlocked it. The
 *     spoke can edit and resubmit. Send is intentionally hidden here so
 *     the hub doesn't accidentally dispatch on stale numbers.
 *  4. **"🔓 Resubmitted · HH:mm" badge** — the spoke has resubmitted
 *     after the unlock; the order is now ready to send and the audit
 *     trail stays visible until dispatch goes out.
 *
 * The component owns its own modal state — the parent matrix just
 * renders <SpokeUnlockControl /> and gets all of the above behaviour
 * for free.
 */

const REASONS = [
  'Spoke called — needs an emergency top-up',
  'New event walked in (catering / large group)',
  'Earlier delivery damaged — need to reorder',
  'Hub has spare capacity in this run',
  'Other (specify below)',
];

export default function SpokeUnlockControl({
  hubId,
  spokeId,
  forDate,
  submission,
  cutoffPassed,
  hasTransfer,
  unlockedBy,
}: {
  hubId: SiteId;
  spokeId: SiteId;
  forDate: string;
  submission: SpokeSubmission;
  /** True once the spoke's cutoff has passed. */
  cutoffPassed: boolean;
  /** True when the dispatch transfer has already been sent. */
  hasTransfer: boolean;
  /** Demo display name for "unlocked by" attribution. */
  unlockedBy: string;
}) {
  const { isActive, hasRecord, get, unlock } = useHubUnlocks();
  const [modalOpen, setModalOpen] = useState(false);

  const active = isActive(hubId, spokeId, forDate);
  const recorded = hasRecord(hubId, spokeId, forDate);
  const record = get(hubId, spokeId, forDate);

  const status = submission.status;
  const isDraft = status === 'draft';

  // Unlock is only meaningful when:
  //  - cutoff has passed (otherwise the spoke can edit normally)
  //  - the spoke isn't still in draft (locking is what we're overriding)
  //  - the dispatch hasn't been sent yet (after Send, the unlock is moot)
  //  - there's no existing unlock record (one at a time)
  const canUnlock = cutoffPassed && !isDraft && !hasTransfer && !recorded;

  if (!canUnlock && !active && !recorded) {
    return null;
  }

  function handleConfirm(reason: string) {
    const baselineBySku: Record<SkuId, number> = {};
    for (const ln of submission.lines) {
      const units = ln.confirmedUnits ?? ln.quinnProposedUnits;
      baselineBySku[ln.skuId] = units;
    }
    unlock({ hubId, spokeId, forDate, unlockedBy, reason, baselineBySku });
    setModalOpen(false);
  }

  if (active) {
    // Currently open for the spoke to edit
    return (
      <>
        <span
          title={
            record
              ? `Unlocked at ${formatClock(record.unlockedAtISO)} by ${record.unlockedBy} — "${record.reason}". The spoke can add more on top of the locked baseline; resubmit when they're done.`
              : 'Unlocked'
          }
          style={pillStyle('open')}
        >
          <Unlock size={11} />
          Open · {record ? formatClock(record.unlockedAtISO) : '—'}
        </span>
      </>
    );
  }

  if (recorded && record?.consumedAtISO) {
    // Spoke resubmitted — audit trail visible until dispatch closes the loop
    return (
      <span
        title={`Spoke resubmitted at ${formatClock(record.consumedAtISO)} — original reason: "${record.reason}".`}
        style={pillStyle('resubmitted')}
      >
        <Unlock size={11} />
        Resubmitted · {formatClock(record.consumedAtISO)}
      </span>
    );
  }

  // canUnlock — show the action button
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}
        title="Reopen this spoke's order past cutoff (with a reason). The spoke can add to it; the hub plan grows."
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '5px 10px',
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          background: '#ffffff',
          color: 'var(--color-warning)',
          border: '1px solid var(--color-warning-border)',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <Unlock size={11} />
        Unlock
      </button>

      <AnimatePresence>
        {modalOpen && (
          <UnlockReasonModal
            spokeId={spokeId}
            forDate={forDate}
            submission={submission}
            onCancel={() => setModalOpen(false)}
            onConfirm={handleConfirm}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reason modal
// ─────────────────────────────────────────────────────────────────────────────

function UnlockReasonModal({
  spokeId,
  forDate,
  submission,
  onCancel,
  onConfirm,
}: {
  spokeId: SiteId;
  forDate: string;
  submission: SpokeSubmission;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [presetIdx, setPresetIdx] = useState<number | null>(0);
  const [customReason, setCustomReason] = useState('');

  const reasonText = useMemo(() => {
    if (presetIdx === null) return customReason.trim();
    const preset = REASONS[presetIdx];
    if (preset.startsWith('Other')) return customReason.trim();
    return preset;
  }, [presetIdx, customReason]);

  const canConfirm = reasonText.length >= 5;
  const spoke = getSite(spokeId);
  const baselineTotal = submission.lines.reduce(
    (a, l) => a + (l.confirmedUnits ?? l.quinnProposedUnits),
    0,
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <motion.div
        key="unlock-backdrop"
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
      {/* Centering wrapper (see UrgentRemakeBanner.tsx for why this is split) */}
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
          key="unlock-card"
          role="dialog"
          aria-label={`Unlock ${spoke?.name ?? spokeId} past cutoff`}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          style={{
            width: 'min(540px, 100%)',
            maxHeight: 'calc(100vh - 32px)',
            overflow: 'hidden',
            borderRadius: 'var(--radius-card)',
            background: '#ffffff',
            boxShadow: '0 24px 64px rgba(12,20,44,0.32)',
            fontFamily: 'var(--font-primary)',
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 20px',
              background: 'var(--color-warning)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Unlock size={20} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  opacity: 0.9,
                  textTransform: 'uppercase',
                }}
              >
                Reopen past cutoff
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                Unlock {spoke?.name ?? spokeId} — {forDate}
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel"
              style={{
                width: 32,
                height: 32,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'transparent',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                background: 'var(--color-warning-light)',
                border: '1px solid var(--color-warning-border)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <AlertOctagon size={16} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                Locked baseline is <strong>{baselineTotal} units</strong> across{' '}
                <strong>{submission.lines.length} recipes</strong>. The spoke will be able to
                <strong> add to this</strong> — they can&apos;t reduce committed quantities.
                Your reason will be visible on the spoke side and on the audit trail.
              </div>
            </div>

            <div>
              <SectionLabel>Pick a reason</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {REASONS.map((preset, idx) => {
                  const active = presetIdx === idx;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPresetIdx(idx)}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: 'var(--font-primary)',
                        background: active ? 'var(--color-bg-hover)' : '#ffffff',
                        color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>

            {presetIdx !== null && REASONS[presetIdx].startsWith('Other') && (
              <div>
                <SectionLabel>Specify the reason</SectionLabel>
                <textarea
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  placeholder="What's going on? The spoke will see this verbatim."
                  rows={3}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid var(--color-border)',
                    fontSize: 13,
                    fontFamily: 'var(--font-primary)',
                    resize: 'vertical',
                  }}
                />
              </div>
            )}

            {presetIdx !== null && !REASONS[presetIdx].startsWith('Other') && (
              <div>
                <SectionLabel>Add a note (optional)</SectionLabel>
                <input
                  type="text"
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  placeholder="Optional context for the spoke"
                  style={{
                    width: '100%',
                    padding: 10,
                    fontSize: 13,
                    fontFamily: 'var(--font-primary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                  }}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-surface)',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '9px 14px',
                background: '#ffffff',
                border: '1px solid var(--color-border)',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                borderRadius: 8,
              }}
            >
              Cancel
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => {
                const note = customReason.trim();
                const finalReason =
                  presetIdx !== null && !REASONS[presetIdx].startsWith('Other')
                    ? note
                      ? `${REASONS[presetIdx]} — ${note}`
                      : REASONS[presetIdx]
                    : reasonText;
                onConfirm(finalReason);
              }}
              disabled={!canConfirm}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                background: canConfirm ? 'var(--color-warning)' : 'var(--color-bg-hover)',
                color: canConfirm ? '#ffffff' : 'var(--color-text-muted)',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--font-primary)',
                cursor: canConfirm ? 'pointer' : 'not-allowed',
              }}
            >
              <Unlock size={13} />
              Unlock spoke
            </button>
          </div>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function pillStyle(variant: 'open' | 'resubmitted'): React.CSSProperties {
  const isOpen = variant === 'open';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    background: isOpen ? 'var(--color-warning-light)' : 'var(--color-info-light)',
    color: isOpen ? 'var(--color-warning)' : 'var(--color-info)',
    border: `1px solid ${isOpen ? 'var(--color-warning-border)' : 'var(--color-info-border, var(--color-info))'}`,
    fontFamily: 'var(--font-primary)',
    whiteSpace: 'nowrap',
    cursor: 'help',
  };
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Re-export Lock for convenience callers (currently used internally; kept
// public so the matrix can render an inline lock chip if wanted).
export { Lock };

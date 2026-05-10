'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertOctagon,
  Thermometer,
  Clock,
  Truck,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  CheckCircle2,
  Factory,
  PackageCheck,
  ArrowRight,
} from 'lucide-react';
import {
  REMAKE_REASON_LABEL,
  getRecipe,
  getSite,
  type RemakeRequest,
  type SiteId,
} from './fixtures';
import { useRemakeRequests } from './remakeStore';

/**
 * UrgentRemakeBanner — hub-side surface for full-production-remake
 * incidents reported by spokes (cold-chain failure, contamination, etc.).
 *
 * Visual language matches `SpokeUrgentRemakeCard` deliberately so the
 * spoke and hub sides feel like two halves of the same conversation:
 *   - red 2px-bordered card pulled to the page edges
 *   - red-tinted header bar with chevron + alert icon + "URGENT" pill
 *   - inline status strip (always visible) showing the top-of-queue
 *     incident as a one-liner, with Review CTA
 *   - expanded body shows per-incident rich panels (evidence + notes)
 *     plus accepted / in-flight cards, each with their own Review CTA
 *
 * The "Review & respond" CTA opens a centered modal with the full
 * triage flow (recipe table + slot picker + accept/decline). Modal
 * lives in this file (`ReviewModal`).
 */
export default function UrgentRemakeBanner({
  hubId,
  recordedBy,
}: {
  hubId: SiteId;
  recordedBy: string;
}) {
  const { forHub } = useRemakeRequests();
  const requests = forHub(hubId);

  const pending = useMemo(
    () =>
      requests
        .filter(r => r.status === 'pending')
        .sort((a, b) => a.submittedAtISO.localeCompare(b.submittedAtISO)),
    [requests],
  );
  const inFlight = useMemo(
    () =>
      requests
        .filter(r => r.status === 'accepted' || r.status === 'in-production')
        .sort((a, b) =>
          (b.hubResponse?.respondedAtISO ?? '').localeCompare(a.hubResponse?.respondedAtISO ?? '')
        ),
    [requests],
  );

  // Modal state — null when closed, otherwise the index into `pending`.
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const activeRequest = modalIndex !== null ? pending[modalIndex] : undefined;

  // Card open/closed (matches SpokeUrgentRemakeCard pattern)
  const [open, setOpen] = useState(false);

  // If the active request resolves while the modal is open, advance or close.
  useEffect(() => {
    if (modalIndex === null) return;
    if (pending.length === 0) {
      setModalIndex(null);
    } else if (modalIndex >= pending.length) {
      setModalIndex(pending.length - 1);
    }
  }, [pending, modalIndex]);

  if (pending.length === 0 && inFlight.length === 0) return null;

  const hasPending = pending.length > 0;
  const topPending = pending[0];
  const summaryRight = hasPending
    ? `${pending.length} pending${inFlight.length > 0 ? ` · ${inFlight.length} in flight` : ''}`
    : `${inFlight.length} in flight`;

  return (
    <>
      <div
        style={{
          margin: '12px 16px 0',
          background: '#ffffff',
          border: `2px solid ${hasPending ? 'var(--color-error)' : 'var(--color-success)'}`,
          borderRadius: 'var(--radius-card)',
          overflow: 'hidden',
          boxShadow: hasPending
            ? '0 0 0 1px rgba(220, 38, 38, 0.05)'
            : '0 1px 0 rgba(0,0,0,0.02)',
        }}
      >
        {/* Header — always visible */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: hasPending ? 'var(--color-error-light)' : '#ffffff',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <AlertOctagon size={18} color={hasPending ? 'var(--color-error)' : 'var(--color-success)'} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {hasPending && <span style={URGENT_PILL}>URGENT</span>}
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                {hasPending
                  ? `${pending.length} critical incident${pending.length === 1 ? '' : 's'} awaiting your decision`
                  : `${inFlight.length} remake${inFlight.length === 1 ? '' : 's'} in flight`}
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {hasPending
                ? 'Cold-chain & contamination — review evidence and commit a delivery slot.'
                : 'Accepted incidents queued for production.'}
            </span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            {summaryRight}
          </span>
        </button>

        {/* Inline preview strip — always visible when there's a top pending */}
        {hasPending && !open && topPending && (
          <PendingInlineStrip
            request={topPending}
            extraCount={pending.length - 1}
            onReview={() => setModalIndex(0)}
          />
        )}

        {/* Expanded body */}
        {open && (
          <div
            style={{
              borderTop: '1px solid var(--color-border-subtle)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {pending.map((r, i) => (
              <PendingPanel
                key={r.id}
                request={r}
                onReview={() => setModalIndex(i)}
              />
            ))}
            {inFlight.map(r => (
              <InFlightPanel key={r.id} request={r} />
            ))}
          </div>
        )}
      </div>

      {/* Centered modal for the full triage flow */}
      <AnimatePresence>
        {activeRequest && (
          <ReviewModal
            request={activeRequest}
            recordedBy={recordedBy}
            position={{ index: modalIndex! + 1, total: pending.length }}
            canPrev={modalIndex! > 0}
            canNext={modalIndex! < pending.length - 1}
            onPrev={() => setModalIndex(i => Math.max(0, (i ?? 0) - 1))}
            onNext={() => setModalIndex(i => Math.min(pending.length - 1, (i ?? 0) + 1))}
            onClose={() => setModalIndex(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline preview strip — shows when card is collapsed and there's pending
// ─────────────────────────────────────────────────────────────────────────────

function PendingInlineStrip({
  request,
  extraCount,
  onReview,
}: {
  request: RemakeRequest;
  extraCount: number;
  onReview: () => void;
}) {
  const spoke = getSite(request.spokeId);
  return (
    <div
      style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--color-error-border)',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>
        <strong style={{ color: 'var(--color-text-primary)' }}>
          {spoke?.name ?? request.spokeId}
        </strong>
        {' · '}
        {REMAKE_REASON_LABEL[request.reason]}
        {' · '}
        <strong style={{ color: 'var(--color-text-primary)' }}>{request.totalUnits} units</strong>
        {' across '}
        {request.lines.length} recipes
        {extraCount > 0 && (
          <span style={{ marginLeft: 6, color: 'var(--color-text-muted)' }}>
            (+{extraCount} more incident{extraCount === 1 ? '' : 's'})
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onReview(); }}
        style={reviewButtonStyle}
      >
        Review &amp; respond <ArrowRight size={12} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending panel (in expanded card) — rich evidence + Review CTA
// ─────────────────────────────────────────────────────────────────────────────

function PendingPanel({
  request,
  onReview,
}: {
  request: RemakeRequest;
  onReview: () => void;
}) {
  const spoke = getSite(request.spokeId);

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-error)',
        borderRadius: 10,
        boxShadow: '0 1px 0 rgba(220, 38, 38, 0.05)',
        overflow: 'hidden',
      }}
    >
      {/* Headline row */}
      <div
        style={{
          padding: '10px 14px',
          background: 'var(--color-error-light)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--color-error-border)',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {spoke?.name ?? request.spokeId} · {REMAKE_REASON_LABEL[request.reason]}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            Source drop {request.sourceTransferDate} · {request.totalUnits} units across {request.lines.length} recipes
          </div>
        </div>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
          Submitted {formatRel(request.submittedAtISO)}
        </span>
      </div>

      {/* Evidence + spoke notes */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {request.evidence.temperatureC != null && (
            <EvidenceChip
              icon={<Thermometer size={13} color="var(--color-error)" />}
              label="Peak temp"
              value={`${request.evidence.temperatureC}°C`}
              critical
            />
          )}
          {request.evidence.holdTimeMinutes != null && (
            <EvidenceChip
              icon={<Clock size={13} color="var(--color-warning)" />}
              label="Above 5°C for"
              value={`${request.evidence.holdTimeMinutes} min`}
              critical
            />
          )}
          <EvidenceChip
            icon={<Truck size={13} color="var(--color-text-muted)" />}
            label="Submitted by"
            value={request.submittedBy ?? 'Spoke manager'}
          />
        </div>

        <div
          style={{
            padding: '10px 12px',
            background: 'var(--color-bg-surface)',
            borderRadius: 6,
            borderLeft: '3px solid var(--color-error)',
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--color-text-primary)',
          }}
        >
          <strong
            style={{
              fontSize: 10,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'block',
              marginBottom: 4,
            }}
          >
            Spoke notes
          </strong>
          {request.evidence.notes}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onReview} style={reviewButtonStyle}>
            Review &amp; respond <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

const URGENT_PILL: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 4,
  background: 'var(--color-error)',
  color: '#ffffff',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
};

const reviewButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  background: 'var(--color-error)',
  color: '#ffffff',
  border: 'none',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
  whiteSpace: 'nowrap',
};

// ─────────────────────────────────────────────────────────────────────────────
// Centered review modal — full triage flow + recipe table
// ─────────────────────────────────────────────────────────────────────────────
//
// Centering note: framer-motion's `y` animation writes to `transform`, so
// using `transform: translate(-50%, -50%)` for centering on the same node
// as `animate={{ y: 0 }}` causes the translate to be clobbered (bug — the
// modal ends up top-left of the viewport). Fix: a fixed flexbox wrapper
// handles centering, and the inner motion.div only handles its own y/opacity
// animation. This is the canonical safe pattern for portal'd modals.

function ReviewModal({
  request,
  recordedBy,
  position,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onClose,
}: {
  request: RemakeRequest;
  recordedBy: string;
  position: { index: number; total: number };
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const { accept, decline } = useRemakeRequests();
  const [mode, setMode] = useState<'idle' | 'declining'>('idle');
  const [hubNote, setHubNote] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const slots = useMemo(() => buildSlotOptions(), []);
  const [pickedSlot, setPickedSlot] = useState<string>(slots[0]?.id ?? '');

  // Reset form when navigating between incidents.
  useEffect(() => {
    setMode('idle');
    setHubNote('');
    setDeclineReason('');
    setPickedSlot(slots[0]?.id ?? '');
  }, [request.id, slots]);

  // ESC closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const spoke = getSite(request.spokeId);

  function onAccept() {
    const slot = slots.find(s => s.id === pickedSlot);
    if (!slot) return;
    accept(
      request.id,
      { proposedISO: slot.proposedISO, label: slot.label },
      { respondedBy: recordedBy, notes: hubNote.trim() || undefined },
    );
    onClose();
  }

  function onDecline() {
    if (declineReason.trim().length < 5) return;
    decline(request.id, declineReason.trim(), { respondedBy: recordedBy });
    onClose();
  }

  if (typeof window === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <motion.div
        key="remake-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(12, 20, 44, 0.55)',
          zIndex: 1300,
        }}
      />
      {/* Centering wrapper — flexbox centers the card so framer-motion's
          y animation on the inner card doesn't fight a translate transform. */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1301,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          pointerEvents: 'none', // backdrop handles clicks; only the card is interactive
        }}
      >
        <motion.div
          key="remake-card"
          role="dialog"
          aria-label="Review urgent remake request"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          style={{
            width: 'min(720px, 100%)',
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
          {/* Header — red urgent strip */}
          <div
            style={{
              padding: '14px 20px',
              background: 'var(--color-error)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <AlertOctagon size={20} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  opacity: 0.85,
                  textTransform: 'uppercase',
                }}
              >
                Urgent · Full production remake
                {position.total > 1 && ` · ${position.index} of ${position.total}`}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                {spoke?.name ?? request.spokeId} — {REMAKE_REASON_LABEL[request.reason]}
              </div>
            </div>

            {position.total > 1 && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={!canPrev}
                  aria-label="Previous incident"
                  style={navBtnStyle(canPrev)}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!canNext}
                  aria-label="Next incident"
                  style={navBtnStyle(canNext)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
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

          {/* Scrollable body */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Source transfer summary */}
            <div
              style={{
                padding: '10px 12px',
                background: 'var(--color-error-light)',
                border: '1px solid var(--color-error-border)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Truck size={16} color="var(--color-error)" />
              <div style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>
                Affecting drop <strong>{request.sourceTransferDate}</strong> ·{' '}
                <strong>{request.totalUnits} units</strong> across{' '}
                <strong>{request.lines.length} recipes</strong> · submitted{' '}
                {formatRel(request.submittedAtISO)} by {request.submittedBy ?? 'spoke manager'}
              </div>
            </div>

            {/* Recipe table — full list, properly scannable */}
            <div>
              <SectionLabel>
                Remake spec — {request.lines.length} recipes · {request.totalUnits} units
              </SectionLabel>
              <div
                style={{
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: 'var(--color-bg-surface)',
                        borderBottom: '1px solid var(--color-border-subtle)',
                      }}
                    >
                      <th style={thStyle('left')}>Recipe</th>
                      <th style={thStyle('left')}>Category</th>
                      <th style={thStyle('right')}>Units to remake</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.lines.map((l, i) => {
                      const recipe = getRecipe(l.recipeId);
                      return (
                        <tr
                          key={l.skuId}
                          style={{
                            borderBottom:
                              i === request.lines.length - 1
                                ? 'none'
                                : '1px solid var(--color-border-subtle)',
                          }}
                        >
                          <td style={{ ...tdStyle(), fontWeight: 600 }}>
                            {recipe?.name ?? l.recipeId}
                          </td>
                          <td
                            style={{
                              ...tdStyle(),
                              color: 'var(--color-text-muted)',
                              fontSize: 12,
                            }}
                          >
                            {recipe?.category ?? '—'}
                          </td>
                          <td
                            style={{
                              ...tdStyle('right'),
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {l.units}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--color-error-light)' }}>
                      <td style={{ ...tdStyle(), fontWeight: 700 }}>Total</td>
                      <td style={tdStyle()}></td>
                      <td
                        style={{
                          ...tdStyle('right'),
                          fontWeight: 700,
                          color: 'var(--color-error)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {request.totalUnits}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Decision body */}
            {mode === 'idle' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <SectionLabel>Commit to a delivery slot</SectionLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {slots.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setPickedSlot(s.id)}
                        style={pillStyle(pickedSlot === s.id)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionLabel>Note for the spoke (optional)</SectionLabel>
                  <input
                    type="text"
                    value={hubNote}
                    onChange={e => setHubNote(e.target.value)}
                    placeholder="e.g. Prioritising your line — driver re-route confirmed"
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
              </div>
            )}

            {mode === 'declining' && (
              <div>
                <SectionLabel>Reason for declining (visible to the spoke)</SectionLabel>
                <textarea
                  value={declineReason}
                  onChange={e => setDeclineReason(e.target.value)}
                  placeholder="e.g. Ingredient not on site until tomorrow; offering 50% partial remake at next available slot."
                  rows={3}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid var(--color-error-border)',
                    fontSize: 13,
                    fontFamily: 'var(--font-primary)',
                    resize: 'vertical',
                  }}
                />
              </div>
            )}
          </div>

          {/* Footer actions */}
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
            {mode === 'idle' ? (
              <>
                <button
                  type="button"
                  onClick={() => setMode('declining')}
                  style={secondaryActionStyle('danger')}
                >
                  <X size={13} />
                  Decline
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    marginLeft: 'auto',
                    padding: '9px 14px',
                    background: 'transparent',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  Triage later
                </button>
                <button
                  type="button"
                  onClick={onAccept}
                  style={primaryActionStyle(true, 'success')}
                >
                  <Check size={13} />
                  Accept &amp; commit slot
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMode('idle')}
                  style={secondaryActionStyle('neutral')}
                >
                  <ChevronLeft size={13} />
                  Back
                </button>
                <button
                  type="button"
                  onClick={onDecline}
                  disabled={declineReason.trim().length < 5}
                  style={{
                    ...primaryActionStyle(declineReason.trim().length >= 5, 'danger'),
                    marginLeft: 'auto',
                  }}
                >
                  <X size={13} />
                  Send decline
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// In-flight (accepted / in-production) — inline accordion below the alerts
// ─────────────────────────────────────────────────────────────────────────────

function InFlightPanel({ request }: { request: RemakeRequest }) {
  const { markStarted, markDispatched } = useRemakeRequests();
  const [open, setOpen] = useState(false);
  const spoke = getSite(request.spokeId);

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-success)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: 'var(--color-success-light)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <CheckCircle2 size={14} color="var(--color-success)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>
            {spoke?.name ?? request.spokeId} remake committed for{' '}
            {request.hubResponse?.slot?.label ?? 'next slot'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            {request.totalUnits} units · {REMAKE_REASON_LABEL[request.reason]} ·{' '}
            {request.status === 'in-production' ? 'In production now' : 'Queued for production'}
          </div>
        </div>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
          {request.hubResponse?.respondedAtISO ? formatRel(request.hubResponse.respondedAtISO) : ''}
        </span>
      </button>

      {open && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CompactLineList request={request} />
          <div style={{ display: 'flex', gap: 8 }}>
            {request.status === 'accepted' && (
              <button
                type="button"
                onClick={() => markStarted(request.id)}
                style={secondaryActionStyle('info')}
              >
                <Factory size={13} />
                Mark started
              </button>
            )}
            <button
              type="button"
              onClick={() => markDispatched(request.id)}
              style={primaryActionStyle(true, 'success')}
            >
              <PackageCheck size={13} />
              Mark dispatched
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CompactLineList({ request }: { request: RemakeRequest }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        padding: 6,
        background: 'var(--color-bg-surface)',
        borderRadius: 6,
      }}
    >
      {request.lines.map(l => (
        <span
          key={l.skuId}
          style={{
            padding: '3px 8px',
            borderRadius: 100,
            background: '#ffffff',
            border: '1px solid var(--color-border-subtle)',
            fontSize: 11,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {getRecipe(l.recipeId)?.name ?? l.recipeId}{' '}
          <span style={{ color: 'var(--color-text-muted)' }}>×{l.units}</span>
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared bits
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

function EvidenceChip({
  icon,
  label,
  value,
  critical,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  critical?: boolean;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 6,
        background: critical ? 'var(--color-error-light)' : 'var(--color-bg-surface)',
        border: critical
          ? '1px solid var(--color-error-border)'
          : '1px solid var(--color-border-subtle)',
      }}
    >
      {icon}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    background: active ? 'var(--color-accent-active)' : '#ffffff',
    color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
    border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

function primaryActionStyle(
  enabled: boolean,
  variant: 'success' | 'danger' | 'accent' = 'accent',
): React.CSSProperties {
  const bg =
    variant === 'success' ? 'var(--color-success)' :
    variant === 'danger'  ? 'var(--color-error)'   :
    'var(--color-accent-active)';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: enabled ? bg : 'var(--color-bg-hover)',
    color: enabled ? '#ffffff' : 'var(--color-text-muted)',
    border: 'none',
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

function secondaryActionStyle(variant: 'danger' | 'info' | 'neutral'): React.CSSProperties {
  const color =
    variant === 'danger' ? 'var(--color-error)' :
    variant === 'info'   ? 'var(--color-info)'  :
    'var(--color-text-secondary)';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: '#ffffff',
    color,
    border: `1px solid ${color}`,
    cursor: 'pointer',
  };
}

function navBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.3)',
    background: 'transparent',
    color: '#ffffff',
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.4,
  };
}

function thStyle(align: 'left' | 'right' = 'left'): React.CSSProperties {
  return {
    padding: '10px 12px',
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: align,
  };
}

function tdStyle(align: 'left' | 'right' = 'left'): React.CSSProperties {
  return {
    padding: '10px 12px',
    textAlign: align,
    color: 'var(--color-text-primary)',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildSlotOptions(): Array<{ id: string; label: string; proposedISO: string }> {
  const now = new Date();
  const out: Array<{ id: string; label: string; proposedISO: string }> = [];

  if (now.getHours() < 14) {
    const d = new Date(now);
    d.setHours(14, 0, 0, 0);
    out.push({ id: 'today-pm', label: 'Today 14:00 (afternoon run)', proposedISO: d.toISOString() });
  }
  if (now.getHours() < 18) {
    const d = new Date(now);
    d.setHours(18, 0, 0, 0);
    out.push({ id: 'today-eve', label: 'Today 18:00 (evening run)', proposedISO: d.toISOString() });
  }

  const tomEarly = new Date(now);
  tomEarly.setDate(tomEarly.getDate() + 1);
  tomEarly.setHours(6, 30, 0, 0);
  out.push({
    id: 'tom-early',
    label: 'Tomorrow 06:30 (next morning drop)',
    proposedISO: tomEarly.toISOString(),
  });

  const tomMid = new Date(tomEarly);
  tomMid.setHours(12, 0, 0, 0);
  out.push({
    id: 'tom-mid',
    label: 'Tomorrow 12:00 (midday top-up)',
    proposedISO: tomMid.toISOString(),
  });

  return out;
}

function formatRel(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}

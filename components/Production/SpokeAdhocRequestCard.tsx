'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Check,
  X,
  AlertCircle,
  Clock,
  RotateCcw,
  MessageSquarePlus,
} from 'lucide-react';
import QtyStepper from './QtyStepper';
import {
  ADHOC_REQUEST_REASON_LABEL,
  DEMO_TODAY,
  dayOffset,
  getRecipe,
  spokeOrderForDate,
  type AdhocRequest,
  type AdhocRequestReason,
  type SiteId,
  type SkuId,
} from './fixtures';
import { useAdhocRequests, buildAdhocRequest } from './adhocStore';

/**
 * SpokeAdhocRequestCard — sits at the top of /production/spokes.
 *
 * Lets a spoke manager send an ad-hoc top-up to the hub when they realise
 * they need MORE than they originally ordered (or want something they
 * didn't order at all). Shows the status of past requests inline so the
 * spoke can see exactly what the hub did.
 *
 * Collapsed by default — click to expand and start composing.
 *
 * Compose flow:
 *   1. Pick a target date (today, tomorrow, next-day-default)
 *   2. Pick a reason chip (unexpected demand / event / etc.)
 *   3. Add lines from the hub recipe set with qty steppers
 *   4. Optional notes
 *   5. Send → request lands in hub's IncomingAdhocRequestsStrip
 *
 * History list below the composer shows every request this spoke has sent
 * (or that's been seeded for them) with status chips and per-line breakdown.
 */

const REASON_OPTIONS: AdhocRequestReason[] = [
  'unexpected-demand',
  'event-booking',
  'shortage',
  'quality-issue',
  'other',
];

const STATUS_PALETTE = {
  pending:  { label: 'Pending hub review', bg: 'var(--color-warning-light)', color: 'var(--color-warning)' },
  approved: { label: 'Approved',           bg: 'var(--color-success-light)', color: 'var(--color-success)' },
  partial:  { label: 'Partially approved', bg: 'var(--color-info-light)',    color: 'var(--color-info)' },
  rejected: { label: 'Rejected',           bg: 'var(--color-error-light)',   color: 'var(--color-error)' },
} as const;

export default function SpokeAdhocRequestCard({
  spokeId,
  hubId,
  recordedBy,
}: {
  spokeId: SiteId;
  hubId: SiteId;
  recordedBy: string;
}) {
  const { submit, withdraw, forSpoke } = useAdhocRequests();
  const [open, setOpen] = useState(false);
  const [forDate, setForDate] = useState(dayOffset(1));
  const [reason, setReason] = useState<AdhocRequestReason>('unexpected-demand');
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState<Record<SkuId, number>>({});
  const [filterQuery, setFilterQuery] = useState('');

  // Hub recipe set is the same as the spoke's regular order menu.
  const hubLines = useMemo(
    () => spokeOrderForDate(spokeId, hubId, forDate).lines,
    [spokeId, hubId, forDate],
  );

  const filteredLines = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return hubLines;
    return hubLines.filter(ln => ln.recipe.name.toLowerCase().includes(q));
  }, [hubLines, filterQuery]);

  const myRequests = useMemo(
    () =>
      [...forSpoke(spokeId)].sort((a, b) =>
        b.submittedAtISO.localeCompare(a.submittedAtISO),
      ),
    [forSpoke, spokeId],
  );

  const totalRequestedUnits = Object.values(draft).reduce((a, n) => a + n, 0);
  const lineCount = Object.values(draft).filter(n => n > 0).length;
  const canSubmit = lineCount > 0;

  function adjust(skuId: SkuId, delta: number) {
    setDraft(prev => ({
      ...prev,
      [skuId]: Math.max(0, (prev[skuId] ?? 0) + delta),
    }));
  }

  function setQty(skuId: SkuId, n: number) {
    setDraft(prev => ({ ...prev, [skuId]: Math.max(0, n) }));
  }

  function send() {
    if (!canSubmit) return;
    const lines = Object.entries(draft)
      .filter(([, n]) => n > 0)
      .map(([skuId, n]) => {
        const ln = hubLines.find(l => l.skuId === skuId);
        return ln ? { skuId, recipeId: ln.recipeId, requestedUnits: n } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const req = buildAdhocRequest({
      spokeId,
      hubId,
      forDate,
      submittedBy: recordedBy,
      reason,
      notes: notes.trim() || undefined,
      lines,
    });
    submit(req);
    // Reset compose state but keep the panel open so the spoke sees
    // their just-sent request appear in the history list below.
    setDraft({});
    setNotes('');
  }

  const pendingCount = myRequests.filter(r => r.status === 'pending').length;

  return (
    <>
      {/* Trigger — standard secondary button (same shape/weight as the
          "← Home" / RoleSwitcher controls in the production header).
          No outer wrapper margin so the caller controls placement. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Send an ad-hoc request to the hub"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          borderRadius: 8,
          background: 'var(--color-accent-active)',
          border: '1px solid var(--color-accent-active)',
          color: 'var(--color-text-on-active)',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          fontSize: 12,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        <MessageSquarePlus size={13} />
        Send ad-hoc request
        {pendingCount > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 6px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.18)',
              color: 'var(--color-text-on-active)',
              fontSize: 9.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {pendingCount} pending
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <AdhocRequestModal onClose={() => setOpen(false)}>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Compose form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Date + reason chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
              <Field label="For day">
                <div style={{ display: 'flex', gap: 4 }}>
                  {[
                    { id: DEMO_TODAY,    label: 'Today (urgent)' },
                    { id: dayOffset(1),  label: 'Tomorrow' },
                    { id: dayOffset(2),  label: dayHumanLabel(dayOffset(2)) },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setForDate(opt.id)}
                      style={pillStyle(opt.id === forDate)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Reason">
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {REASON_OPTIONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      style={pillStyle(r === reason)}
                    >
                      {ADHOC_REQUEST_REASON_LABEL[r]}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            {/* Search */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 8,
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <input
                type="text"
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                placeholder="Search the hub menu…"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: 12,
                  fontFamily: 'var(--font-primary)',
                  background: 'transparent',
                }}
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery('')}
                  style={{ border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'inline-flex' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Recipe list */}
            <div
              style={{
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 8,
                maxHeight: 280,
                overflow: 'auto',
              }}
            >
              {filteredLines.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
                  No recipes match.
                </div>
              ) : (
                filteredLines.map(ln => {
                  const qty = draft[ln.skuId] ?? 0;
                  const active = qty > 0;
                  return (
                    <div
                      key={ln.skuId}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--color-border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: active ? 'var(--color-info-light)' : '#ffffff',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {ln.recipe.name}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                          {ln.recipe.category}
                          {ln.confirmed > 0 && (
                            <> · already on order: <strong style={{ color: 'var(--color-text-secondary)' }}>{ln.confirmed}</strong></>
                          )}
                        </div>
                      </div>
                      <Stepper
                        value={qty}
                        onDec={() => adjust(ln.skuId, -1)}
                        onInc={() => adjust(ln.skuId, +1)}
                        onSet={n => setQty(ln.skuId, n)}
                      />
                    </div>
                  );
                })
              )}
            </div>

            {/* Notes + summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add a note for the hub manager (optional)"
                rows={2}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 12,
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {lineCount === 0
                    ? 'Add at least one line to send.'
                    : `${lineCount} line${lineCount === 1 ? '' : 's'} · ${totalRequestedUnits} unit${totalRequestedUnits === 1 ? '' : 's'} for ${dayHumanLabel(forDate)}`}
                </span>
                <button
                  type="button"
                  onClick={send}
                  disabled={!canSubmit}
                  style={{
                    marginLeft: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'var(--font-primary)',
                    background: canSubmit ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
                    color: canSubmit ? 'var(--color-text-on-active)' : 'var(--color-text-muted)',
                    border: 'none',
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Send size={12} />
                  Send to hub
                </button>
              </div>
            </div>
          </div>

          {/* History */}
          {myRequests.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your recent requests
              </div>
              {myRequests.map(r => (
                <RequestSummary key={r.id} request={r} onWithdraw={() => withdraw(r.id)} />
              ))}
            </div>
          )}
            </div>
          </AdhocRequestModal>
        )}
      </AnimatePresence>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal shell                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Centered modal that hosts the ad-hoc compose form + history. Mirrors the
 * UrgentRemakeBanner pattern: backdrop + flex centering wrapper so framer's
 * y animation on the inner card doesn't fight a translate transform.
 */
function AdhocRequestModal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (typeof window === 'undefined') return null;

  return createPortal(
    <>
      <motion.div
        key="adhoc-backdrop"
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
          key="adhoc-card"
          role="dialog"
          aria-label="Send ad-hoc request to hub"
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 16px',
              borderBottom: '1px solid var(--color-border-subtle)',
              flexShrink: 0,
            }}
          >
            <Sparkles size={16} color="var(--color-info)" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Send an ad-hoc request to the hub</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Need extra after the cutoff? Top up with a one-off — hub reviews and approves.
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 28,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: '#ffffff',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</div>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Stepper({
  value, onDec, onInc, onSet,
}: {
  value: number;
  onDec: () => void;
  onInc: () => void;
  onSet: (n: number) => void;
}) {
  return (
    <QtyStepper
      size="compact"
      chromeless
      canDecrement={value > 0}
      onDecrement={onDec}
      onIncrement={onInc}
    >
      <input
        type="number"
        value={value}
        min={0}
        onChange={e => onSet(parseInt(e.target.value || '0', 10) || 0)}
        style={{
          width: 44,
          padding: '4px 6px',
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          fontFamily: 'var(--font-primary)',
        }}
      />
    </QtyStepper>
  );
}

function RequestSummary({
  request,
  onWithdraw,
}: {
  request: AdhocRequest;
  onWithdraw: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const palette = STATUS_PALETTE[request.status];
  return (
    <div
      style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 8,
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <StatusChip palette={palette} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          For <strong style={{ color: 'var(--color-text-primary)' }}>{dayHumanLabel(request.forDate)}</strong>
          {' · '}
          {request.lines.length} line{request.lines.length === 1 ? '' : 's'}
          {' · '}
          {request.totalRequestedUnits} requested
          {request.status !== 'pending' && (
            <>
              {' · '}
              <strong style={{ color: 'var(--color-text-primary)' }}>{request.totalApprovedUnits} approved</strong>
            </>
          )}
        </div>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clock size={10} />
          {formatRel(request.submittedAtISO)}
        </span>
      </button>
      {expanded && (
        <div style={{ padding: '0 12px 10px 32px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {request.notes && (
            <div style={{ padding: '6px 10px', background: 'var(--color-bg-surface)', borderRadius: 6, fontSize: 11, color: 'var(--color-text-secondary)' }}>
              <strong>You said:</strong> {request.notes}
            </div>
          )}
          {request.hubResponse?.notes && (
            <div style={{ padding: '6px 10px', background: 'var(--color-bg-surface)', borderRadius: 6, fontSize: 11, color: 'var(--color-text-secondary)' }}>
              <strong>Hub said:</strong> {request.hubResponse.notes}
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={cellHeader}>Recipe</th>
                <th style={{ ...cellHeader, textAlign: 'right' }}>Asked</th>
                <th style={{ ...cellHeader, textAlign: 'right' }}>Got</th>
                <th style={cellHeader}>Status</th>
              </tr>
            </thead>
            <tbody>
              {request.lines.map(ln => (
                <LineRow key={ln.id} line={ln} />
              ))}
            </tbody>
          </table>
          {request.status === 'pending' && (
            <button
              type="button"
              onClick={onWithdraw}
              style={{
                alignSelf: 'flex-end',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                background: '#ffffff',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={11} /> Withdraw
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LineRow({ line }: { line: AdhocRequest['lines'][number] }) {
  const recipeName = useMemo(() => {
    // Local lookup via fixtures to avoid re-passing recipes around
    return getRecipeName(line.recipeId);
  }, [line.recipeId]);
  const got = line.approvedUnits ?? 0;
  const tone =
    line.lineStatus === 'approved' ? 'good' :
    line.lineStatus === 'partial'  ? 'warn' :
    line.lineStatus === 'rejected' ? 'bad'  :
    'neutral';
  const color =
    tone === 'good' ? 'var(--color-success)' :
    tone === 'bad'  ? 'var(--color-error)'   :
    tone === 'warn' ? 'var(--color-warning)' :
    'var(--color-text-muted)';
  return (
    <tr>
      <td style={cellBody}>{recipeName}</td>
      <td style={{ ...cellBody, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{line.requestedUnits}</td>
      <td style={{ ...cellBody, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color }}>
        {line.lineStatus === 'pending' ? '—' : got}
      </td>
      <td style={cellBody}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {line.lineStatus === 'approved' && <Check size={11} />}
          {line.lineStatus === 'rejected' && <X size={11} />}
          {line.lineStatus === 'partial'  && <AlertCircle size={11} />}
          {line.lineStatus}
          {line.hubNote && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, textTransform: 'none' }}> · {line.hubNote}</span>}
        </span>
      </td>
    </tr>
  );
}

function StatusChip({ palette }: { palette: { label: string; bg: string; color: string } }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 100,
        fontSize: 10,
        fontWeight: 700,
        background: palette.bg,
        color: palette.color,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      {palette.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 10px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    background: active ? 'var(--color-accent-active)' : '#ffffff',
    color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
    border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

const cellHeader: React.CSSProperties = {
  padding: '6px 8px',
  textAlign: 'left',
  fontSize: 9,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--color-border-subtle)',
};

const cellBody: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--color-border-subtle)',
};

function dayHumanLabel(iso: string): string {
  if (iso === DEMO_TODAY) return 'Today';
  if (iso === dayOffset(1)) return 'Tomorrow';
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatRel(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  return `${diffD}d ago`;
}

function getRecipeName(recipeId: string): string {
  return getRecipe(recipeId)?.name ?? recipeId;
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquarePlus,
  Check,
  X,
  Clock,
  ArrowRight,
} from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import QtyStepper from './QtyStepper';
import {
  ADHOC_REQUEST_REASON_LABEL,
  DEMO_TODAY,
  dayOffset,
  getRecipe,
  getSite,
  type AdhocRequest,
  type AdhocRequestLine,
  type SiteId,
} from './fixtures';
import { useAdhocRequests } from './adhocStore';
import { useRole } from './RoleContext';

/**
 * IncomingAdhocRequestsStrip — compact trigger that opens a review modal.
 *
 * The hub manager sees a single pill at the top of the Today screen
 * summarising how many ad-hoc requests need attention. Tapping it opens
 * a centered modal listing every request from this hub's spokes; from
 * there each one expands into a per-line approval form (adjust qty, add
 * a hub note, approve / reject / send custom). Decisions flow back into
 * the dispatch matrix as before.
 *
 * Strip auto-hides if there are zero requests for the hub.
 */

type DraftLineDecision = {
  approvedUnits: number;
  hubNote?: string;
};

export default function IncomingAdhocRequestsStrip({ hubId }: { hubId: SiteId }) {
  const { forHub, respond } = useAdhocRequests();
  const { user } = useRole();
  const respondedBy = user?.name ?? 'Hub manager';
  const [open, setOpen] = useState(false);

  const requests = useMemo(
    () => [...forHub(hubId)].sort((a, b) => (a.submittedAtISO < b.submittedAtISO ? 1 : -1)),
    [forHub, hubId],
  );

  if (requests.length === 0) return null;

  const pending = requests.filter(r => r.status === 'pending');
  const totalPendingUnits = pending.reduce((a, r) => a + r.totalRequestedUnits, 0);
  const resolved = requests.length - pending.length;
  const needsAction = pending.length > 0;

  // Banner shell mirrors UrgentRemakeBanner so the two hub-side
  // notification strips read as siblings: same outer gutter
  // (`12px 16px 0`), same 2px-bordered card pulled to the page edges,
  // same full-width header button. Tone steps down from red →
  // amber-tinted (warning) since ad-hoc requests are time-sensitive
  // but not safety-critical like a cold-chain remake.
  return (
    <>
      <div
        style={{
          margin: '12px 16px 0',
          background: '#ffffff',
          border: `2px solid ${needsAction ? 'var(--color-warning)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-card)',
          overflow: 'hidden',
          boxShadow: needsAction
            ? '0 0 0 1px rgba(241, 180, 52, 0.05)'
            : '0 1px 0 rgba(0,0,0,0.02)',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            width: '100%',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: needsAction ? 'var(--color-warning-bg)' : '#ffffff',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
          }}
        >
          <MessageSquarePlus
            size={18}
            color={needsAction ? 'var(--color-warning)' : 'var(--color-text-muted)'}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {needsAction && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'var(--color-warning)',
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {pending.length} pending
                </span>
              )}
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                {needsAction
                  ? `${pending.length} ad-hoc request${pending.length === 1 ? '' : 's'} awaiting your decision`
                  : `${resolved} ad-hoc request${resolved === 1 ? '' : 's'} resolved`}
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {needsAction
                ? `${totalPendingUnits} unit${totalPendingUnits === 1 ? '' : 's'} requested across ${pending.length} spoke order${pending.length === 1 ? '' : 's'} — approve, adjust qty or reject.`
                : 'No outstanding spoke requests.'}
            </span>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-accent-active)',
              whiteSpace: 'nowrap',
            }}
          >
            Review <ArrowRight size={13} />
          </span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <ReviewModal onClose={() => setOpen(false)} pendingCount={pending.length} totalRequests={requests.length}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {requests.map(r => (
                <RequestRow
                  key={r.id}
                  request={r}
                  onRespond={(decisions, notes) =>
                    respond(r.id, decisions, { respondedBy, notes })
                  }
                />
              ))}
            </div>
          </ReviewModal>
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal shell — backdrop + centered card. Mirrors the SpokeAdhocRequestCard
// pattern so the popup has the same look + dismissal affordances across the
// hub and spoke surfaces.
// ─────────────────────────────────────────────────────────────────────────────

function ReviewModal({
  onClose,
  pendingCount,
  totalRequests,
  children,
}: {
  onClose: () => void;
  pendingCount: number;
  totalRequests: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <>
      <motion.div
        key="adhoc-review-backdrop"
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
          key="adhoc-review-card"
          role="dialog"
          aria-label="Review ad-hoc requests"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          style={{
            width: 'min(960px, 100%)',
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
              padding: '14px 20px',
              borderBottom: '1px solid var(--color-border-subtle)',
              flexShrink: 0,
            }}
          >
            <MessageSquarePlus
              size={16}
              color={pendingCount > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)'}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                Ad-hoc requests · {pendingCount} pending
                {totalRequests > pendingCount && (
                  <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>
                    {' · '}{totalRequests - pendingCount} resolved
                  </span>
                )}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Approve, adjust qty or reject. Decisions flow into the dispatch matrix.
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: '#ffffff',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {children}
          </div>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-request row
// ─────────────────────────────────────────────────────────────────────────────

function RequestRow({
  request,
  onRespond,
}: {
  request: AdhocRequest;
  onRespond: (decisions: Record<string, DraftLineDecision>, notes?: string) => void;
}) {
  const isPending = request.status === 'pending';
  const [decisions, setDecisions] = useState<Record<string, DraftLineDecision>>(() => {
    // Pre-fill with what the spoke asked for so the default action is "approve as-is".
    const init: Record<string, DraftLineDecision> = {};
    for (const ln of request.lines) {
      init[ln.id] = {
        approvedUnits: ln.approvedUnits ?? ln.requestedUnits,
        hubNote: ln.hubNote,
      };
    }
    return init;
  });
  const [notes, setNotes] = useState('');

  const spoke = getSite(request.spokeId);
  const totalApproved = Object.values(decisions).reduce((a, d) => a + d.approvedUnits, 0);

  function setQty(lineId: string, n: number) {
    setDecisions(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], approvedUnits: Math.max(0, n) },
    }));
  }
  function adjust(lineId: string, delta: number) {
    setDecisions(prev => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        approvedUnits: Math.max(0, (prev[lineId]?.approvedUnits ?? 0) + delta),
      },
    }));
  }
  function setLineNote(lineId: string, note: string) {
    setDecisions(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], hubNote: note || undefined },
    }));
  }
  function approveAll() {
    const next: Record<string, DraftLineDecision> = {};
    for (const ln of request.lines) {
      next[ln.id] = { approvedUnits: ln.requestedUnits };
    }
    setDecisions(next);
    onRespond(next, notes.trim() || undefined);
  }
  function rejectAll() {
    const next: Record<string, DraftLineDecision> = {};
    for (const ln of request.lines) {
      next[ln.id] = { approvedUnits: 0, hubNote: decisions[ln.id]?.hubNote };
    }
    setDecisions(next);
    onRespond(next, notes.trim() || 'Hub couldn\'t fulfil this request.');
  }
  function send() {
    onRespond(decisions, notes.trim() || undefined);
  }

  return (
    <div style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      {/* Static header — no longer collapsible since each request lives
          inside the modal already and the manager wants the form open. */}
      <div
        style={{
          padding: '12px 20px',
          background: isPending ? '#ffffff' : 'var(--color-bg-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <StatusChip status={request.status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {spoke?.name ?? request.spokeId}
            <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              {' · '}{request.lines.length} line{request.lines.length === 1 ? '' : 's'}
              {' · '}{request.totalRequestedUnits} requested
              {!isPending && (
                <>
                  {' · '}
                  <strong style={{ color: 'var(--color-text-primary)' }}>
                    {request.totalApprovedUnits} approved
                  </strong>
                </>
              )}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
            For {dayHumanLabel(request.forDate)} · {ADHOC_REQUEST_REASON_LABEL[request.reason]}
            {request.submittedBy && ` · ${request.submittedBy}`}
          </div>
        </div>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clock size={10} />
          {formatRel(request.submittedAtISO)}
        </span>
      </div>

      {/* Review form (pending) or read-only summary (responded). Sits flush
          to the modal width — no extra inset since the chevron is gone. */}
      <div
        style={{
          padding: '0 20px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: isPending ? 'var(--color-bg-surface)' : '#ffffff',
        }}
      >
          {request.notes && (
            <div
              style={{
                padding: '8px 10px',
                background: '#ffffff',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 6,
                fontSize: 12,
                color: 'var(--color-text-secondary)',
              }}
            >
              <EdifyMark size={11} color="var(--color-info)" style={{ marginRight: 6, verticalAlign: 'middle' }} />
              <strong>From the spoke:</strong> {request.notes}
            </div>
          )}

          {/* Per-line table */}
          <div
            style={{
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 6,
              background: '#ffffff',
              overflow: 'hidden',
            }}
          >
            {request.lines.map(line => (
              <LineDecisionRow
                key={line.id}
                line={line}
                isPending={isPending}
                decision={decisions[line.id]}
                onAdjust={(d) => adjust(line.id, d)}
                onSet={(n) => setQty(line.id, n)}
                onSetNote={(n) => setLineNote(line.id, n)}
              />
            ))}
          </div>

          {/* Notes + actions */}
          {isPending ? (
            <>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional response note for the spoke (visible on their page)"
                rows={2}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 6,
                  border: '1px solid var(--color-border)',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 12,
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Decision: <strong style={{ color: 'var(--color-text-primary)' }}>{totalApproved}</strong> of {request.totalRequestedUnits} units
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button type="button" onClick={rejectAll} style={btnSecondary('error')}>
                    <X size={12} /> Reject all
                  </button>
                  <button type="button" onClick={approveAll} style={btnSecondary('success')}>
                    <Check size={12} /> Approve all as asked
                  </button>
                  <button type="button" onClick={send} style={btnPrimary}>
                    Send decision
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                padding: '8px 10px',
                background: 'var(--color-bg-surface)',
                borderRadius: 6,
                fontSize: 11,
                color: 'var(--color-text-muted)',
              }}
            >
              Responded {request.hubResponse ? formatRel(request.hubResponse.respondedAtISO) : 'recently'}
              {request.hubResponse?.respondedBy && ` · ${request.hubResponse.respondedBy}`}
              {request.hubResponse?.notes && (
                <div style={{ marginTop: 4, color: 'var(--color-text-secondary)' }}>
                  &ldquo;{request.hubResponse.notes}&rdquo;
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );
}

function LineDecisionRow({
  line,
  isPending,
  decision,
  onAdjust,
  onSet,
  onSetNote,
}: {
  line: AdhocRequestLine;
  isPending: boolean;
  decision: DraftLineDecision;
  onAdjust: (delta: number) => void;
  onSet: (n: number) => void;
  onSetNote: (note: string) => void;
}) {
  const recipe = getRecipe(line.recipeId);
  const got = isPending ? decision.approvedUnits : (line.approvedUnits ?? 0);
  const tone =
    !isPending && line.lineStatus === 'approved' ? 'good' :
    !isPending && line.lineStatus === 'rejected' ? 'bad' :
    !isPending && line.lineStatus === 'partial'  ? 'warn' :
    'neutral';
  const color =
    tone === 'good' ? 'var(--color-success)' :
    tone === 'bad'  ? 'var(--color-error)'   :
    tone === 'warn' ? 'var(--color-warning)' :
    'var(--color-text-muted)';
  // Two layouts to keep the per-line approval form readable across viewports:
  //   - Pending → 3-column grid: recipe meta · qty stepper · hub note.
  //     Note input has a generous min-width so the recipe and stepper don't
  //     get squashed into nothing. Falls back to single-column on narrow
  //     screens via the `auto` track + flex inside.
  //   - Responded → 2-column grid: recipe meta · final approved qty/status.
  return (
    <div
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'grid',
        gridTemplateColumns: isPending
          ? 'minmax(180px, 1.4fr) auto minmax(220px, 2fr)'
          : 'minmax(180px, 1fr) auto',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {recipe?.name ?? line.recipeId}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          Requested <strong style={{ color: 'var(--color-text-secondary)' }}>{line.requestedUnits}</strong>
          {recipe && ` · ${recipe.category}`}
        </div>
      </div>
      {isPending ? (
        <>
          <QtyStepper
            size="compact"
            canDecrement={decision.approvedUnits > 0}
            canIncrement={decision.approvedUnits < line.requestedUnits}
            onDecrement={() => onAdjust(-1)}
            onIncrement={() => onAdjust(+1)}
          >
            <input
              type="number"
              value={decision.approvedUnits}
              min={0}
              max={line.requestedUnits}
              onChange={e => onSet(parseInt(e.target.value || '0', 10) || 0)}
              style={{
                width: 36,
                padding: 0,
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
          </QtyStepper>
          <input
            type="text"
            value={decision.hubNote ?? ''}
            onChange={e => onSetNote(e.target.value)}
            placeholder="Optional note (e.g. 'out of butter')"
            style={{
              padding: '7px 10px',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              fontFamily: 'var(--font-primary)',
              fontSize: 12,
              minWidth: 0,
              width: '100%',
            }}
          />
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
            {got} approved
          </span>
          <span style={{ fontSize: 10, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {line.lineStatus}
          </span>
          {line.hubNote && (
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{line.hubNote}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: AdhocRequest['status'] }) {
  const map = {
    pending:  { label: 'Pending',           bg: 'var(--color-warning-light)', color: 'var(--color-warning)' },
    approved: { label: 'Approved',          bg: 'var(--color-success-light)', color: 'var(--color-success)' },
    partial:  { label: 'Partial',           bg: 'var(--color-info-light)',    color: 'var(--color-info)' },
    rejected: { label: 'Rejected',          bg: 'var(--color-error-light)',   color: 'var(--color-error)' },
  } as const;
  const c = map[status];
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 100,
        fontSize: 10,
        fontWeight: 700,
        background: c.bg,
        color: c.color,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      {c.label}
    </span>
  );
}

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 14px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  fontFamily: 'var(--font-primary)',
  background: 'var(--color-accent-active)',
  color: 'var(--color-text-on-active)',
  border: 'none',
  cursor: 'pointer',
};

function btnSecondary(tone: 'success' | 'error'): React.CSSProperties {
  const color = tone === 'success' ? 'var(--color-success)' : 'var(--color-error)';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    background: '#ffffff',
    color,
    border: `1px solid ${color}`,
    cursor: 'pointer',
  };
}

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

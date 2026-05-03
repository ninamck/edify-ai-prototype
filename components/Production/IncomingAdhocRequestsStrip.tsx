'use client';

import { useMemo, useState } from 'react';
import {
  MessageSquarePlus,
  Check,
  X,
  Clock,
  ChevronDown,
  ChevronRight,
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
 * IncomingAdhocRequestsStrip — sits at the top of /production/dispatch.
 *
 * Hub manager sees every incoming ad-hoc request from their spokes. Each
 * pending request expands into a per-line approval row where they can:
 *  - Adjust the qty (default = what the spoke asked for)
 *  - Add a per-line note (e.g. "out of butter, can do 2 tomorrow")
 *  - Send the decision → flips status to approved / partial / rejected
 *
 * Already-decided requests stay on the strip in compact form so the spoke
 * relationship is transparent ("Hub responded 3h ago — approved 6/8").
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

  const requests = useMemo(
    () => [...forHub(hubId)].sort((a, b) => (a.submittedAtISO < b.submittedAtISO ? 1 : -1)),
    [forHub, hubId],
  );

  if (requests.length === 0) return null;

  const pending = requests.filter(r => r.status === 'pending');
  const totalPendingUnits = pending.reduce((a, r) => a + r.totalRequestedUnits, 0);
  const needsAction = pending.length > 0;

  return (
    <div
      style={{
        margin: '12px 16px 0',
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          background: needsAction ? 'var(--color-warning-bg)' : 'var(--color-bg-surface)',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <MessageSquarePlus
          size={14}
          color={needsAction ? 'var(--color-warning)' : 'var(--color-text-muted)'}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Ad-hoc requests · {pending.length} pending
            {pending.length > 0 && (
              <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                {' · '}{totalPendingUnits} unit{totalPendingUnits === 1 ? '' : 's'} requested
              </span>
            )}
            {requests.length > pending.length && (
              <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>
                {' · '}{requests.length - pending.length} resolved
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {needsAction
              ? 'Spokes have asked for top-ups. Approve, adjust qty or reject — each decision flows into the matrix below.'
              : 'All requests responded to. Approved qty is rolling into the dispatch matrix below.'}
          </div>
        </div>
      </div>

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
    </div>
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
  const [expanded, setExpanded] = useState(isPending);
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
      {/* Compact header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: isPending ? '#ffffff' : 'var(--color-bg-surface)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
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
      </button>

      {/* Expanded — review form (pending) or read-only summary (responded) */}
      {expanded && (
        <div
          style={{
            padding: '10px 14px 14px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: isPending ? 'var(--color-bg-surface)' : '#ffffff',
            borderTop: '1px solid var(--color-border-subtle)',
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
      )}
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
  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{recipe?.name ?? line.recipeId}</div>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
          Requested: <strong style={{ color: 'var(--color-text-secondary)' }}>{line.requestedUnits}</strong>
          {recipe && ` · ${recipe.category}`}
        </div>
      </div>
      {isPending ? (
        <>
          <QtyStepper
            size="compact"
            chromeless
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
                width: 50,
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
          <input
            type="text"
            value={decision.hubNote ?? ''}
            onChange={e => onSetNote(e.target.value)}
            placeholder="Optional note (e.g. ‘out of butter’)"
            style={{
              flex: 1,
              minWidth: 180,
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              fontFamily: 'var(--font-primary)',
              fontSize: 11,
            }}
          />
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
            {got} approved
          </span>
          <span style={{ fontSize: 10, color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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

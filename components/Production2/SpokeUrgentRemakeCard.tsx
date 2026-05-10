'use client';

import { useMemo, useState } from 'react';
import {
  AlertOctagon,
  Thermometer,
  Clock,
  Truck,
  ChevronDown,
  ChevronRight,
  Send,
  X,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import {
  REMAKE_REASON_LABEL,
  dayOffset,
  getRecipe,
  lastDispatchToSpoke,
  type DispatchTransfer,
  type RemakeReason,
  type RemakeRequest,
  type SiteId,
} from './fixtures';
import { useRemakeRequests, buildRemakeRequest } from './remakeStore';
import { useDispatchTransfers } from './dispatchStore';

/**
 * SpokeUrgentRemakeCard — sits at the top of /production/spokes, just
 * above the (lower-severity) rejects + ad-hoc cards. This is the spoke's
 * emergency button: the entire received drop is unsafe and needs a full
 * remake on the next available production run.
 *
 * Visually distinct from the regular cards — red border, alert icon,
 * "URGENT" pill — because it interrupts hub planning. The form mandates
 * an evidence note (compliance trail) and surfaces a temperature reading
 * field for the most common cold-chain failure case.
 *
 * Once submitted, the card flips to a status panel showing the hub's
 * proposed delivery slot (or decline reason).
 */

const REASON_OPTIONS: RemakeReason[] = [
  'temperature-breach',
  'contamination',
  'allergen-cross-contact',
  'vehicle-failure',
  'packaging-failure',
  'other',
];

export default function SpokeUrgentRemakeCard({
  spokeId,
  hubId,
  recordedBy,
}: {
  spokeId: SiteId;
  hubId: SiteId;
  recordedBy: string;
}) {
  const { submit, withdraw, forSpoke } = useRemakeRequests();
  const { transfersFor } = useDispatchTransfers();
  const [open, setOpen] = useState(false);

  // Find the most recent received transfer (runtime store first, then seed).
  const transfer = useMemo<DispatchTransfer | undefined>(() => {
    for (let off = 0; off >= -3; off--) {
      const date = dayOffset(off);
      const matches = transfersFor(hubId, date).filter(t => t.spokeId === spokeId);
      if (matches.length > 0) return matches[0];
    }
    return lastDispatchToSpoke(hubId, spokeId);
  }, [hubId, spokeId, transfersFor]);

  const myRequests = useMemo(
    () =>
      [...forSpoke(spokeId)].sort((a, b) =>
        b.submittedAtISO.localeCompare(a.submittedAtISO),
      ),
    [forSpoke, spokeId],
  );

  // Headline pending request gets pulled out so the status panel stays
  // visible even when the card is collapsed.
  const liveRequest = myRequests.find(r => r.status !== 'declined' && r.status !== 'dispatched');
  const hasOpen = !!liveRequest;
  const liveTone = liveRequest ? statusTone(liveRequest.status) : 'neutral';

  return (
    <div
      style={{
        margin: '12px 16px 0',
        background: '#ffffff',
        border: `2px solid ${hasOpen ? statusBorder(liveTone) : 'var(--color-error)'}`,
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        boxShadow: hasOpen ? '0 1px 0 rgba(0,0,0,0.02)' : '0 0 0 1px rgba(220, 38, 38, 0.05)',
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
          background: hasOpen ? '#ffffff' : 'var(--color-error-light)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <AlertOctagon size={18} color="var(--color-error)" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={URGENT_PILL}>URGENT</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              Critical incident — request a full production remake
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {hasOpen
              ? `Live: ${liveStatusLabel(liveRequest!)} · ${liveRequest!.totalUnits} units · ${liveRequest!.lines.length} lines`
              : 'Cold-chain failure, contamination, or any incident that makes a whole drop unsellable. The hub will commit to the next available delivery slot.'}
          </span>
        </div>
      </button>

      {/* Live status banner — always visible when there's an open request */}
      {hasOpen && !open && (
        <LiveStatusInline request={liveRequest!} />
      )}

      {open && (
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Compose form (only when no live request OR when latest is declined) */}
          {(!hasOpen) ? (
            transfer ? (
              <RemakeForm
                transfer={transfer}
                spokeId={spokeId}
                hubId={hubId}
                recordedBy={recordedBy}
                onSubmit={(req) => {
                  submit(req);
                }}
              />
            ) : (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--color-bg-surface)', fontSize: 12, color: 'var(--color-text-muted)' }}>
                No recent dispatch from the hub to flag. Once you receive a drop, the form will activate.
              </div>
            )
          ) : (
            <LiveStatusBlock request={liveRequest!} onWithdraw={() => withdraw(liveRequest!.id)} />
          )}

          {/* History */}
          {myRequests.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Incident history
              </div>
              {myRequests.map(r => (
                <HistoryRow key={r.id} request={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compose form
// ─────────────────────────────────────────────────────────────────────────────

function RemakeForm({
  transfer,
  spokeId,
  hubId,
  recordedBy,
  onSubmit,
}: {
  transfer: DispatchTransfer;
  spokeId: SiteId;
  hubId: SiteId;
  recordedBy: string;
  onSubmit: (req: RemakeRequest) => void;
}) {
  const [reason, setReason] = useState<RemakeReason>('temperature-breach');
  const [temperatureC, setTemperatureC] = useState<string>('8.5');
  const [holdTimeMinutes, setHoldTimeMinutes] = useState<string>('30');
  const [notes, setNotes] = useState('');

  const isTempReason = reason === 'temperature-breach';
  const canSubmit = notes.trim().length >= 10; // require a real evidence note

  function send() {
    if (!canSubmit) return;
    const req = buildRemakeRequest({
      spokeId,
      hubId,
      sourceTransferId: transfer.id,
      sourceTransferDate: transfer.forDate,
      lines: transfer.lines.map(l => ({
        skuId: l.skuId,
        recipeId: l.recipeId,
        units: l.units,
      })),
      reason,
      evidence: {
        temperatureC: isTempReason ? parseFloat(temperatureC) || undefined : undefined,
        holdTimeMinutes: isTempReason ? parseInt(holdTimeMinutes, 10) || undefined : undefined,
        notes: notes.trim(),
      },
      submittedBy: recordedBy,
    });
    onSubmit(req);
  }

  const totalUnits = transfer.lines.reduce((a, l) => a + l.units, 0);

  return (
    <>
      {/* Source transfer summary */}
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--color-error-light)',
          border: '1px solid var(--color-error-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Truck size={16} color="var(--color-error)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>
            Flagging the {transfer.forDate} drop ({transfer.totalUnits} units, {transfer.lines.length} lines)
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            Sent by {transfer.sentBy ?? 'hub'} · The whole shipment will be queued for remake.
          </div>
        </div>
      </div>

      {/* Reason chips */}
      <Field label="What happened?">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {REASON_OPTIONS.map(r => (
            <button key={r} type="button" onClick={() => setReason(r)} style={pillStyle(r === reason, 'critical')}>
              {REMAKE_REASON_LABEL[r]}
            </button>
          ))}
        </div>
      </Field>

      {/* Evidence */}
      {isTempReason && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Field label="Peak temperature">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Thermometer size={14} color="var(--color-error)" />
              <input
                type="number"
                step="0.1"
                value={temperatureC}
                onChange={e => setTemperatureC(e.target.value)}
                style={inputStyle(80)}
              />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>°C</span>
            </div>
          </Field>
          <Field label="Time above 5°C">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} color="var(--color-warning)" />
              <input
                type="number"
                value={holdTimeMinutes}
                onChange={e => setHoldTimeMinutes(e.target.value)}
                style={inputStyle(80)}
              />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>minutes</span>
            </div>
          </Field>
        </div>
      )}

      <Field label="Evidence notes (required)">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="What did you observe? Driver explanation, time of arrival, cold-chain logger reading, etc. The hub manager will see this verbatim."
          rows={3}
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            fontFamily: 'var(--font-primary)',
            fontSize: 12,
            resize: 'vertical',
          }}
        />
      </Field>

      {/* Mirrored lines preview */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Will request remake of
        </div>
        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 8,
            background: 'var(--color-bg-surface)',
            maxHeight: 200,
            overflow: 'auto',
          }}
        >
          {transfer.lines.map(l => (
            <div
              key={l.skuId}
              style={{
                padding: '6px 12px',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 12,
              }}
            >
              <span>{getRecipe(l.recipeId)?.name ?? l.recipeId}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{l.units}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {canSubmit
            ? `Ready · ${totalUnits} units across ${transfer.lines.length} lines`
            : 'Add at least 10 characters of evidence to enable Send.'}
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
            padding: '9px 16px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            background: canSubmit ? 'var(--color-error)' : 'var(--color-bg-hover)',
            color: canSubmit ? '#ffffff' : 'var(--color-text-muted)',
            border: 'none',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          <Send size={12} />
          Send urgent remake request
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live status (visible above the fold when there's an open request)
// ─────────────────────────────────────────────────────────────────────────────

function LiveStatusInline({ request }: { request: RemakeRequest }) {
  const tone = statusTone(request.status);
  return (
    <div
      style={{
        padding: '10px 16px',
        background: statusLightBg(tone),
        borderTop: '1px solid var(--color-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <StatusChip status={request.status} />
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
        {liveStatusLabel(request)}
        {request.hubResponse?.slot && (
          <>
            {' · '}
            <strong style={{ color: 'var(--color-text-primary)' }}>
              {request.hubResponse.slot.label}
            </strong>
          </>
        )}
      </span>
    </div>
  );
}

function LiveStatusBlock({
  request,
  onWithdraw,
}: {
  request: RemakeRequest;
  onWithdraw: () => void;
}) {
  const tone = statusTone(request.status);
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 8,
        background: statusLightBg(tone),
        border: `1px solid ${statusBorder(tone)}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <StatusChip status={request.status} />
        <span style={{ fontSize: 12, fontWeight: 700 }}>
          {liveStatusLabel(request)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
          {formatRel(request.submittedAtISO)} · {request.totalUnits} units
        </span>
      </div>

      {request.hubResponse?.slot && (
        <div
          style={{
            padding: '10px 12px',
            background: '#ffffff',
            borderRadius: 6,
            border: '1px solid var(--color-success)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <CheckCircle2 size={16} color="var(--color-success)" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>
              Hub committed: {request.hubResponse.slot.label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              Expected delivery: {formatSlot(request.hubResponse.slot.proposedISO)}
            </div>
          </div>
        </div>
      )}

      {request.hubResponse?.declineReason && (
        <div
          style={{
            padding: '10px 12px',
            background: '#ffffff',
            borderRadius: 6,
            border: '1px solid var(--color-error)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <X size={14} color="var(--color-error)" style={{ marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-error)' }}>
              Hub declined this request
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {request.hubResponse.declineReason}
            </div>
          </div>
        </div>
      )}

      {request.hubResponse?.notes && (
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
          Hub: &ldquo;{request.hubResponse.notes}&rdquo;
        </div>
      )}

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
  );
}

function HistoryRow({ request }: { request: RemakeRequest }) {
  const [expanded, setExpanded] = useState(false);
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
        <StatusChip status={request.status} />
        <div style={{ flex: 1, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <strong style={{ color: 'var(--color-text-primary)' }}>
            {REMAKE_REASON_LABEL[request.reason]}
          </strong>
          {' · '}
          {request.totalUnits} units · {request.lines.length} lines
          {' · '}drop {request.sourceTransferDate}
        </div>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
          {formatRel(request.submittedAtISO)}
        </span>
      </button>
      {expanded && (
        <div style={{ padding: '0 12px 10px 32px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
          {request.evidence.temperatureC != null && (
            <div style={{ color: 'var(--color-text-secondary)' }}>
              <strong>Reading:</strong> {request.evidence.temperatureC}°C for {request.evidence.holdTimeMinutes ?? '?'} mins
            </div>
          )}
          <div style={{ padding: '6px 8px', background: 'var(--color-bg-surface)', borderRadius: 4 }}>
            <strong>Notes:</strong> {request.evidence.notes}
          </div>
          {request.hubResponse?.slot && (
            <div style={{ color: 'var(--color-success)' }}>
              <strong>Hub committed:</strong> {request.hubResponse.slot.label}
            </div>
          )}
          {request.hubResponse?.declineReason && (
            <div style={{ color: 'var(--color-error)' }}>
              <strong>Declined:</strong> {request.hubResponse.declineReason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
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

function StatusChip({ status }: { status: RemakeRequest['status'] }) {
  const map = {
    pending:         { label: 'Awaiting hub', bg: 'var(--color-warning-light)', color: 'var(--color-warning)' },
    accepted:        { label: 'Accepted',      bg: 'var(--color-success-light)', color: 'var(--color-success)' },
    'in-production': { label: 'In production', bg: 'var(--color-info-light)',    color: 'var(--color-info)' },
    dispatched:      { label: 'On its way',    bg: 'var(--color-success-light)', color: 'var(--color-success)' },
    declined:        { label: 'Declined',      bg: 'var(--color-error-light)',   color: 'var(--color-error)' },
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

const URGENT_PILL: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 4,
  background: 'var(--color-error)',
  color: '#ffffff',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
};

function pillStyle(active: boolean, variant: 'standard' | 'critical' = 'standard'): React.CSSProperties {
  const activeBg = variant === 'critical' ? 'var(--color-error)' : 'var(--color-accent-active)';
  const activeColor = '#ffffff';
  return {
    padding: '6px 10px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    background: active ? activeBg : '#ffffff',
    color: active ? activeColor : 'var(--color-text-secondary)',
    border: `1px solid ${active ? activeBg : 'var(--color-border)'}`,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

function inputStyle(width: number): React.CSSProperties {
  return {
    width,
    padding: '6px 8px',
    fontSize: 12,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    fontFamily: 'var(--font-primary)',
  };
}

type StatusTone = 'warn' | 'success' | 'info' | 'error' | 'neutral';

function statusTone(status: RemakeRequest['status']): StatusTone {
  switch (status) {
    case 'pending':        return 'warn';
    case 'accepted':       return 'success';
    case 'in-production':  return 'info';
    case 'dispatched':     return 'success';
    case 'declined':       return 'error';
  }
}

function statusBorder(tone: StatusTone): string {
  switch (tone) {
    case 'warn':    return 'var(--color-warning-border)';
    case 'success': return 'var(--color-success)';
    case 'info':    return 'var(--color-info)';
    case 'error':   return 'var(--color-error-border)';
    case 'neutral': return 'var(--color-border)';
  }
}

function statusLightBg(tone: StatusTone): string {
  switch (tone) {
    case 'warn':    return 'var(--color-warning-bg)';
    case 'success': return 'var(--color-success-light)';
    case 'info':    return 'var(--color-info-light)';
    case 'error':   return 'var(--color-error-light)';
    case 'neutral': return 'var(--color-bg-surface)';
  }
}

function liveStatusLabel(r: RemakeRequest): string {
  switch (r.status) {
    case 'pending':        return `Awaiting hub triage (${REMAKE_REASON_LABEL[r.reason]})`;
    case 'accepted':       return 'Hub accepted — slot committed';
    case 'in-production':  return 'Hub is producing the remake batch now';
    case 'dispatched':     return 'Remake is on its way';
    case 'declined':       return 'Hub declined — see reason';
  }
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

function formatSlot(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  RotateCcw,
  Truck,
  Package,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react';
import QtyStepper from './QtyStepper';
import {
  dayOffset,
  dayOfWeek,
  getRecipe,
  lastDispatchToSpoke,
  SPOKE_REJECT_REASON_LABEL,
  type DispatchTransfer,
  type SiteId,
  type SkuId,
  type SpokeReject,
  type SpokeRejectLine,
  type SpokeRejectReason,
} from './fixtures';
import { useSpokeRejects, buildSpokeReject } from './rejectsStore';
import { useDispatchTransfers, formatSentClock } from './dispatchStore';

/**
 * SpokeRejectsCard — PAC140 surface mounted at the top of /production/spokes.
 * Lets the spoke manager record rejects against the most-recent dispatch
 * they received from the hub.
 *
 * Two modes, based on which yields a transfer to log against:
 *  - Runtime store (a dispatch the user just sent in-app this session)
 *  - Seed (a yesterday-dated transfer pre-loaded from fixtures so the
 *    demo has something to log against on first load)
 *
 * The card is collapsed by default; expanding reveals one row per
 * dispatched line with a stepper for `rejectedUnits` and a reason chip
 * group. Submit creates a `SpokeReject` in the store; the hub side
 * picks it up immediately on /production/dispatch.
 *
 * After submission, the card flips to a "Done" summary state that links
 * to the just-logged record (with an Undo affordance for accidents).
 */

type DraftLine = {
  skuId: SkuId;
  rejectedUnits: number;
  reason: SpokeRejectReason;
};

const REASON_OPTIONS: SpokeRejectReason[] = ['damaged', 'short-life', 'wrong-spec', 'other'];

export default function SpokeRejectsCard({
  spokeId,
  hubId,
  recordedBy,
}: {
  spokeId: SiteId;
  hubId: SiteId;
  recordedBy: string;
}) {
  const { recordReject, undo, forSpoke } = useSpokeRejects();
  const { transfersFor } = useDispatchTransfers();

  // Pull the most recent dispatch this spoke received. Prefer a runtime
  // store transfer for "today's drop" if one was sent in-session, else
  // fall back to the seeded yesterday shipment.
  const transfer = useMemo<DispatchTransfer | undefined>(() => {
    // Look back up to 3 days for a runtime store transfer to this spoke.
    for (let off = 0; off >= -3; off--) {
      const date = dayOffset(off);
      const matches = transfersFor(hubId, date).filter(t => t.spokeId === spokeId);
      if (matches.length > 0) return matches[0];
    }
    return lastDispatchToSpoke(hubId, spokeId);
  }, [hubId, spokeId, transfersFor]);

  // Existing reject record for this transfer? If so, the card flips into
  // its "submitted" state so the manager can see what was logged + undo.
  const existing = useMemo<SpokeReject | undefined>(() => {
    if (!transfer) return undefined;
    return forSpoke(spokeId).find(r => r.transferId === transfer.id);
  }, [forSpoke, spokeId, transfer]);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<SkuId, DraftLine>>({});
  const [globalReason, setGlobalReason] = useState<SpokeRejectReason>('damaged');

  // Nothing to log against (e.g. this spoke hasn't received a hub drop) —
  // hide the card entirely so we don't clutter the page.
  if (!transfer) return null;

  const totalRejected = Object.values(draft).reduce((a, l) => a + l.rejectedUnits, 0);
  const linesWithRejects = Object.values(draft).filter(l => l.rejectedUnits > 0);

  function bumpLine(skuId: SkuId, delta: number, max: number) {
    setDraft(prev => {
      const cur = prev[skuId]?.rejectedUnits ?? 0;
      const next = Math.max(0, Math.min(max, cur + delta));
      return {
        ...prev,
        [skuId]: { skuId, rejectedUnits: next, reason: prev[skuId]?.reason ?? globalReason },
      };
    });
  }

  function setLineReason(skuId: SkuId, reason: SpokeRejectReason) {
    setDraft(prev => ({
      ...prev,
      [skuId]: { skuId, rejectedUnits: prev[skuId]?.rejectedUnits ?? 0, reason },
    }));
  }

  function submit() {
    if (!transfer || linesWithRejects.length === 0) return;
    const lines: SpokeRejectLine[] = linesWithRejects
      .map(d => {
        const original = transfer.lines.find(l => l.skuId === d.skuId);
        if (!original) return null;
        return {
          skuId: d.skuId,
          recipeId: original.recipeId,
          rejectedUnits: d.rejectedUnits,
          reason: d.reason,
        } satisfies SpokeRejectLine;
      })
      .filter((l): l is SpokeRejectLine => l !== null);

    const record = buildSpokeReject({
      spokeId,
      hubId,
      forDate: transfer.forDate,
      recordedBy,
      transferId: transfer.id,
      lines,
    });
    recordReject(record);
    setDraft({});
    setOpen(false);
  }

  // ─── Submitted state ────────────────────────────────────────────────────
  if (existing) {
    return (
      <div
        style={{
          margin: '14px 16px 0',
          padding: '12px 14px',
          background: existing.hubAcknowledged ? 'var(--color-success-light)' : 'var(--color-info-light)',
          border: `1px solid ${existing.hubAcknowledged ? 'var(--color-success-border)' : 'var(--color-info-light)'}`,
          borderRadius: 'var(--radius-card)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Check size={16} color={existing.hubAcknowledged ? 'var(--color-success)' : 'var(--color-info)'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Rejects logged · {existing.totalRejectedUnits} unit{existing.totalRejectedUnits === 1 ? '' : 's'} from {dayOfWeek(transfer.forDate)}'s drop
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
            {existing.lines.map(ln => `${rejectLineLabel(ln)}`).join(' · ')}
            {existing.hubAcknowledged
              ? ' · Hub acknowledged'
              : ' · Hub will be notified, rolled into next drop'}
          </div>
        </div>
        <button
          onClick={() => undo(existing.id)}
          disabled={existing.hubAcknowledged}
          title={existing.hubAcknowledged ? 'Hub already acknowledged — undo not possible' : undefined}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: '#ffffff',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            cursor: existing.hubAcknowledged ? 'not-allowed' : 'pointer',
            opacity: existing.hubAcknowledged ? 0.5 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--font-primary)',
          }}
        >
          <RotateCcw size={11} /> Undo
        </button>
      </div>
    );
  }

  // ─── Empty / collapsed state ────────────────────────────────────────────
  return (
    <div
      style={{
        margin: '14px 16px 0',
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: open ? 'var(--color-bg-surface)' : '#ffffff',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textAlign: 'left',
        }}
      >
        {open ? (
          <ChevronDown size={14} color="var(--color-text-muted)" />
        ) : (
          <ChevronRight size={14} color="var(--color-text-muted)" />
        )}
        <Truck size={14} color="var(--color-accent-active)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Hub drop received · {dayOfWeek(transfer.forDate)} {transfer.forDate}
            <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>
              <Clock size={9} style={{ display: 'inline', verticalAlign: -1, marginRight: 3 }} />
              Sent {formatSentClock(transfer.sentAtISO)} · {transfer.totalUnits} units
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
            {open
              ? 'Step through what was rejectable. The hub picks this up on dispatch and rolls the qty into your next drop.'
              : 'Tap to log any rejects (damaged, short-life, wrong spec).'}
          </div>
        </div>
        {!open && (
          <span
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              background: 'var(--color-warning-bg)',
              border: '1px solid var(--color-warning-border)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-warning)',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Log rejects
          </span>
        )}
      </button>

      {open && (
        <div style={{ padding: '0 14px 12px' }}>
          {/* Bulk reason chip group — applies to the next stepper a manager touches. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 0',
              borderBottom: '1px dashed var(--color-border-subtle)',
              marginBottom: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 4 }}>
              Default reason
            </span>
            {REASON_OPTIONS.map(r => {
              const active = globalReason === r;
              return (
                <button
                  key={r}
                  onClick={() => setGlobalReason(r)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: 10.5,
                    fontWeight: 700,
                    fontFamily: 'var(--font-primary)',
                    background: active ? 'var(--color-warning-light)' : '#ffffff',
                    color: active ? 'var(--color-warning)' : 'var(--color-text-secondary)',
                    border: `1px solid ${active ? 'var(--color-warning-border)' : 'var(--color-border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  {SPOKE_REJECT_REASON_LABEL[r]}
                </button>
              );
            })}
          </div>

          {/* One row per dispatched line. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {transfer.lines.map(ln => {
              const recipe = getRecipe(ln.recipeId);
              const draftLine = draft[ln.skuId];
              const rejectedUnits = draftLine?.rejectedUnits ?? 0;
              const reason = draftLine?.reason ?? globalReason;
              const isActive = rejectedUnits > 0;
              return (
                <div
                  key={ln.skuId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(160px, 1.4fr) 60px auto 1fr',
                    gap: 10,
                    alignItems: 'center',
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: isActive ? 'var(--color-warning-bg)' : 'var(--color-bg-surface)',
                    border: `1px solid ${isActive ? 'var(--color-warning-border)' : 'transparent'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <Package size={11} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {recipe?.name ?? ln.skuId}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                    of {ln.units}
                  </span>
                  <QtyStepper
                    size="compact"
                    canDecrement={rejectedUnits > 0}
                    canIncrement={rejectedUnits < ln.units}
                    onDecrement={() => bumpLine(ln.skuId, -1, ln.units)}
                    onIncrement={() => bumpLine(ln.skuId, 1, ln.units)}
                    decrementLabel="Reject one fewer unit"
                    incrementLabel="Reject one more unit"
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        minWidth: 26,
                        textAlign: 'center',
                        fontVariantNumeric: 'tabular-nums',
                        color: rejectedUnits > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      {rejectedUnits}
                    </span>
                  </QtyStepper>
                  {/* Per-line reason override — shown only once a stepper is non-zero. */}
                  {rejectedUnits > 0 ? (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {REASON_OPTIONS.map(r => {
                        const active = reason === r;
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setLineReason(ln.skuId, r)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 6,
                              fontSize: 10.5,
                              fontWeight: 700,
                              background: active ? 'var(--color-warning)' : '#ffffff',
                              color: active ? '#ffffff' : 'var(--color-text-secondary)',
                              border: `1px solid ${active ? 'var(--color-warning)' : 'var(--color-border)'}`,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-primary)',
                            }}
                          >
                            {SPOKE_REJECT_REASON_LABEL[r]}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                      No rejects on this line.
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer: total + submit */}
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-text-secondary)',
                fontWeight: 600,
              }}
            >
              {totalRejected === 0 ? (
                <span style={{ color: 'var(--color-text-muted)' }}>
                  Step up any rejected qty to enable submit.
                </span>
              ) : (
                <>
                  <AlertTriangle size={11} color="var(--color-warning)" style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
                  {totalRejected} unit{totalRejected === 1 ? '' : 's'} flagged across {linesWithRejects.length} line{linesWithRejects.length === 1 ? '' : 's'}
                </>
              )}
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={totalRejected === 0}
              style={{
                marginLeft: 'auto',
                padding: '8px 14px',
                borderRadius: 8,
                border: `1px solid ${totalRejected === 0 ? 'var(--color-border)' : 'var(--color-accent-active)'}`,
                background: totalRejected === 0 ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
                color: totalRejected === 0 ? 'var(--color-text-muted)' : 'var(--color-text-on-active)',
                fontSize: 11,
                fontWeight: 700,
                cursor: totalRejected === 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-primary)',
              }}
            >
              Submit rejects to hub
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function rejectLineLabel(ln: SpokeRejectLine): string {
  const recipe = getRecipe(ln.recipeId);
  return `${ln.rejectedUnits} ${recipe?.name ?? ln.skuId} (${SPOKE_REJECT_REASON_LABEL[ln.reason].toLowerCase()})`;
}


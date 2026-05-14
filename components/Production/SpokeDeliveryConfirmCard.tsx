'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Package,
  PackageCheck,
  RotateCcw,
  Truck,
  X,
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
 * SpokeDeliveryConfirmCard — the spoke-side "today" surface for confirming
 * a hub→spoke delivery. Replaces the old SpokeRejectsCard which lived on
 * the spoke order page; the user flow is now anchored on Today where the
 * spoke manager naturally lands when they get a delivery.
 *
 * One unified card with four states:
 *
 *  1. idle (delivery arrived, awaiting confirmation)
 *     — Loud "Confirm delivery" CTA. Tap to enter the review flow.
 *
 *  2. review (in-flow confirmation screen)
 *     — Per-line review. Each line defaults to "received as expected".
 *       Tap "Flag issue" to expand a stepper + reason chips for that
 *       line. Footer "Confirm delivery" submits — and if any rejects
 *       were flagged, they're logged to the rejects store in the same
 *       shot. No separate reject submission step.
 *
 *  3. confirmed-clean (all units received as expected)
 *     — Compact green pill summary; the "Flag a missed reject" link
 *       reopens the review flow if the manager spots an issue later.
 *
 *  4. confirmed-with-rejects (existing reject record in the store)
 *     — Same shape as the old SpokeRejectsCard's submitted state so the
 *       hub-acknowledged / undo lifecycle is unchanged.
 */

type FlowStep = 'idle' | 'review';

type DraftLine = {
  skuId: SkuId;
  rejectedUnits: number;
  reason: SpokeRejectReason;
};

const REASON_OPTIONS: SpokeRejectReason[] = ['damaged', 'short-life', 'wrong-spec', 'other'];

export default function SpokeDeliveryConfirmCard({
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

  // Most recent dispatch this spoke received. Same lookup the original
  // rejects card used: prefer a runtime-store transfer (sent in-session)
  // for today, otherwise fall back to the seeded yesterday shipment.
  const transfer = useMemo<DispatchTransfer | undefined>(() => {
    for (let off = 0; off >= -3; off--) {
      const date = dayOffset(off);
      const matches = transfersFor(hubId, date).filter(t => t.spokeId === spokeId);
      if (matches.length > 0) return matches[0];
    }
    return lastDispatchToSpoke(hubId, spokeId);
  }, [hubId, spokeId, transfersFor]);

  // Existing reject record for this transfer? If so the card flips into
  // its "confirmed-with-rejects" state and exposes hub ack / undo.
  const existingReject = useMemo<SpokeReject | undefined>(() => {
    if (!transfer) return undefined;
    return forSpoke(spokeId).find(r => r.transferId === transfer.id);
  }, [forSpoke, spokeId, transfer]);

  // "All clear" confirmation state. Local-only — no rejects to write
  // means we have nothing to persist via the rejects store, so we keep
  // a per-transfer marker in component state. Reloads in the demo
  // restart the flow; that's fine.
  const [confirmedTransferIds, setConfirmedTransferIds] = useState<Set<string>>(new Set());

  // Confirm-flow state.
  const [step, setStep] = useState<FlowStep>('idle');
  const [draft, setDraft] = useState<Record<SkuId, DraftLine>>({});
  const [globalReason, setGlobalReason] = useState<SpokeRejectReason>('damaged');
  // Tracks which lines the manager has tapped "Flag issue" on. Lines
  // not in this set render as "Received as expected"; flipping a line
  // in reveals its stepper + reason chips. Keeps the review screen
  // compact for the common case (no rejects at all).
  const [flaggedLines, setFlaggedLines] = useState<Set<SkuId>>(new Set());

  if (!transfer) return null;

  const isConfirmedClean = confirmedTransferIds.has(transfer.id);

  // ─── Already-submitted with rejects ─────────────────────────────────────
  // Kept identical to the old SpokeRejectsCard summary so the hub-side
  // ack / undo cycle behaves the same.
  if (existingReject) {
    return <SubmittedSummary reject={existingReject} transfer={transfer} onUndo={() => undo(existingReject.id)} />;
  }

  // ─── Confirmed with no rejects ──────────────────────────────────────────
  if (isConfirmedClean) {
    return (
      <ConfirmedCleanSummary
        transfer={transfer}
        onReopen={() => {
          // Manager spotted a late issue — drop them straight into the
          // review screen so they can flag and confirm again.
          setConfirmedTransferIds(prev => {
            const next = new Set(prev);
            next.delete(transfer.id);
            return next;
          });
          setStep('review');
          setDraft({});
          setFlaggedLines(new Set());
        }}
      />
    );
  }

  // ─── Confirm flow (review screen) ───────────────────────────────────────
  if (step === 'review') {
    return (
      <ReviewScreen
        transfer={transfer}
        draft={draft}
        flaggedLines={flaggedLines}
        globalReason={globalReason}
        onSetGlobalReason={setGlobalReason}
        onFlagLine={(skuId, units) => {
          setFlaggedLines(prev => {
            const next = new Set(prev);
            next.add(skuId);
            return next;
          });
          // Seed the line at 1 unit so the stepper is immediately
          // meaningful — manager can step up/down from there.
          setDraft(prev => ({
            ...prev,
            [skuId]: {
              skuId,
              rejectedUnits: prev[skuId]?.rejectedUnits || 1,
              reason: prev[skuId]?.reason ?? globalReason,
            },
          }));
          // Keep stepper in bounds when the seeded 1 exceeds available.
          if (units < 1) {
            setDraft(prev => ({
              ...prev,
              [skuId]: { skuId, rejectedUnits: units, reason: prev[skuId]?.reason ?? globalReason },
            }));
          }
        }}
        onClearFlag={(skuId) => {
          setFlaggedLines(prev => {
            const next = new Set(prev);
            next.delete(skuId);
            return next;
          });
          setDraft(prev => {
            const { [skuId]: _omit, ...rest } = prev;
            return rest;
          });
        }}
        onBumpLine={(skuId, delta, max) => {
          setDraft(prev => {
            const cur = prev[skuId]?.rejectedUnits ?? 0;
            const next = Math.max(0, Math.min(max, cur + delta));
            return {
              ...prev,
              [skuId]: { skuId, rejectedUnits: next, reason: prev[skuId]?.reason ?? globalReason },
            };
          });
        }}
        onSetLineReason={(skuId, reason) => {
          setDraft(prev => ({
            ...prev,
            [skuId]: { skuId, rejectedUnits: prev[skuId]?.rejectedUnits ?? 0, reason },
          }));
        }}
        onCancel={() => {
          setStep('idle');
          setDraft({});
          setFlaggedLines(new Set());
        }}
        onConfirm={() => {
          const linesWithRejects = Object.values(draft).filter(
            d => flaggedLines.has(d.skuId) && d.rejectedUnits > 0,
          );
          if (linesWithRejects.length > 0) {
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
            // existingReject will pick this up on next render and the
            // card flips to the with-rejects summary state — no need
            // to also flag isConfirmedClean.
          } else {
            // Clean confirm — track locally so the card flips to the
            // green summary state.
            setConfirmedTransferIds(prev => {
              const next = new Set(prev);
              next.add(transfer.id);
              return next;
            });
          }
          setStep('idle');
          setDraft({});
          setFlaggedLines(new Set());
        }}
      />
    );
  }

  // ─── Idle: delivery awaiting confirmation ───────────────────────────────
  return <IdleAwaitingConfirm transfer={transfer} onStart={() => setStep('review')} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-views
// ─────────────────────────────────────────────────────────────────────────────

/** State 1: a delivery has landed and is waiting for the spoke to confirm. */
function IdleAwaitingConfirm({
  transfer,
  onStart,
}: {
  transfer: DispatchTransfer;
  onStart: () => void;
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-info)',
        borderLeft: '3px solid var(--color-info)',
        borderRadius: 'var(--radius-card)',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'var(--color-info-light)',
          color: 'var(--color-info)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Truck size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Hub drop arrived · {dayOfWeek(transfer.forDate)} {transfer.forDate}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            marginTop: 3,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} /> Sent {formatSentClock(transfer.sentAtISO)}
          </span>
          <span>· {transfer.totalUnits} units across {transfer.lines.length} line{transfer.lines.length === 1 ? '' : 's'}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onStart}
        style={{
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid var(--color-accent-active)',
          background: 'var(--color-accent-active)',
          color: 'var(--color-text-on-active)',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        Confirm delivery
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

/** State 2: per-line review screen. */
function ReviewScreen({
  transfer,
  draft,
  flaggedLines,
  globalReason,
  onSetGlobalReason,
  onFlagLine,
  onClearFlag,
  onBumpLine,
  onSetLineReason,
  onCancel,
  onConfirm,
}: {
  transfer: DispatchTransfer;
  draft: Record<SkuId, DraftLine>;
  flaggedLines: Set<SkuId>;
  globalReason: SpokeRejectReason;
  onSetGlobalReason: (r: SpokeRejectReason) => void;
  onFlagLine: (skuId: SkuId, units: number) => void;
  onClearFlag: (skuId: SkuId) => void;
  onBumpLine: (skuId: SkuId, delta: number, max: number) => void;
  onSetLineReason: (skuId: SkuId, reason: SpokeRejectReason) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const totalRejected = Object.values(draft)
    .filter(d => flaggedLines.has(d.skuId))
    .reduce((a, l) => a + l.rejectedUnits, 0);
  const flaggedCount = flaggedLines.size;
  const totalUnits = transfer.totalUnits;
  const receivedUnits = totalUnits - totalRejected;

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 14px',
          background: 'var(--color-bg-surface)',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: 'var(--color-info-light)',
            color: 'var(--color-info)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <PackageCheck size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Confirm delivery · {dayOfWeek(transfer.forDate)} {transfer.forDate}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
            Default is &ldquo;received as expected&rdquo;. Tap Flag issue on any line to log a reject.
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel confirmation"
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: 'transparent',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Action bar — status + Cancel + Confirm delivery. Sits at the top
          of the table (above bulk reason + lines) so the primary CTA is
          always visible without scrolling through long line lists. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-surface)',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {flaggedCount === 0 ? (
            <>
              <CheckCircle2 size={12} color="var(--color-success)" />
              All {totalUnits} units received as expected
            </>
          ) : (
            <>
              <AlertTriangle size={12} color="var(--color-warning)" />
              {receivedUnits} received · {totalRejected} reject{totalRejected === 1 ? '' : 's'} across{' '}
              {flaggedCount} line{flaggedCount === 1 ? '' : 's'}
            </>
          )}
        </span>
        <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: '#ffffff',
              color: 'var(--color-text-secondary)',
              fontSize: 11,
              fontWeight: 600,
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
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--color-accent-active)',
              background: 'var(--color-accent-active)',
              color: 'var(--color-text-on-active)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Check size={12} />
            Confirm delivery
          </button>
        </div>
      </div>

      {/* Bulk reason — only relevant once at least one issue is flagged. */}
      {flaggedCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderBottom: '1px dashed var(--color-border-subtle)',
            flexWrap: 'wrap',
            background: 'var(--color-bg-surface)',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginRight: 4,
            }}
          >
            Default reason
          </span>
          {REASON_OPTIONS.map(r => {
            const active = globalReason === r;
            return (
              <button
                key={r}
                onClick={() => onSetGlobalReason(r)}
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
      )}

      {/* Lines */}
      <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {transfer.lines.map(ln => {
          const recipe = getRecipe(ln.recipeId);
          const isFlagged = flaggedLines.has(ln.skuId);
          const draftLine = draft[ln.skuId];
          const rejectedUnits = isFlagged ? (draftLine?.rejectedUnits ?? 0) : 0;
          const reason = draftLine?.reason ?? globalReason;
          return (
            <div
              key={ln.skuId}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 7,
                background: isFlagged ? 'var(--color-warning-bg)' : 'var(--color-bg-surface)',
                border: `1px solid ${isFlagged ? 'var(--color-warning-border)' : 'transparent'}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Package size={12} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                <span
                  style={{
                    flex: 1,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {recipe?.name ?? ln.skuId}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {ln.units} unit{ln.units === 1 ? '' : 's'}
                </span>
                {!isFlagged ? (
                  <button
                    type="button"
                    onClick={() => onFlagLine(ln.skuId, ln.units)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--color-border)',
                      background: '#ffffff',
                      color: 'var(--color-text-secondary)',
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <AlertTriangle size={11} />
                    Flag issue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onClearFlag(ln.skuId)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--color-border)',
                      background: '#ffffff',
                      color: 'var(--color-text-secondary)',
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              {isFlagged && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: 10,
                    alignItems: 'center',
                    paddingLeft: 22,
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--color-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Reject
                    </span>
                    <QtyStepper
                      size="compact"
                      canDecrement={rejectedUnits > 0}
                      canIncrement={rejectedUnits < ln.units}
                      onDecrement={() => onBumpLine(ln.skuId, -1, ln.units)}
                      onIncrement={() => onBumpLine(ln.skuId, 1, ln.units)}
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
                          color: 'var(--color-warning)',
                          fontFamily: 'var(--font-primary)',
                        }}
                      >
                        {rejectedUnits}
                      </span>
                    </QtyStepper>
                    <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
                      of {ln.units}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {REASON_OPTIONS.map(r => {
                      const active = reason === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => onSetLineReason(ln.skuId, r)}
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** State 3: confirmed clean — pill summary with a "log a missed reject" link. */
function ConfirmedCleanSummary({
  transfer,
  onReopen,
}: {
  transfer: DispatchTransfer;
  onReopen: () => void;
}) {
  return (
    <div
      style={{
        padding: '12px 14px',
        background: 'var(--color-success-light)',
        border: '1px solid var(--color-success-border)',
        borderRadius: 'var(--radius-card)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <CheckCircle2 size={16} color="var(--color-success)" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Delivery confirmed · {transfer.totalUnits} unit{transfer.totalUnits === 1 ? '' : 's'} from {dayOfWeek(transfer.forDate)}&rsquo;s drop
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
          All lines received as expected.
        </div>
      </div>
      <button
        type="button"
        onClick={onReopen}
        style={{
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
          background: '#ffffff',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: 'var(--font-primary)',
        }}
      >
        <AlertTriangle size={11} /> Flag a missed reject
      </button>
    </div>
  );
}

/** State 4: confirmed with rejects — same shape as the old card's submitted state. */
function SubmittedSummary({
  reject,
  transfer,
  onUndo,
}: {
  reject: SpokeReject;
  transfer: DispatchTransfer;
  onUndo: () => void;
}) {
  return (
    <div
      style={{
        padding: '12px 14px',
        background: reject.hubAcknowledged ? 'var(--color-success-light)' : 'var(--color-info-light)',
        border: `1px solid ${reject.hubAcknowledged ? 'var(--color-success-border)' : 'var(--color-info-light)'}`,
        borderRadius: 'var(--radius-card)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <Check size={16} color={reject.hubAcknowledged ? 'var(--color-success)' : 'var(--color-info)'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Delivery confirmed with rejects · {reject.totalRejectedUnits} unit
          {reject.totalRejectedUnits === 1 ? '' : 's'} from {dayOfWeek(transfer.forDate)}&rsquo;s drop
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
          {reject.lines.map(ln => rejectLineLabel(ln)).join(' · ')}
          {reject.hubAcknowledged
            ? ' · Hub acknowledged'
            : ' · Hub will be notified, rolled into next drop'}
        </div>
      </div>
      <button
        type="button"
        onClick={onUndo}
        disabled={reject.hubAcknowledged}
        title={reject.hubAcknowledged ? 'Hub already acknowledged — undo not possible' : undefined}
        style={{
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
          background: '#ffffff',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          cursor: reject.hubAcknowledged ? 'not-allowed' : 'pointer',
          opacity: reject.hubAcknowledged ? 0.5 : 1,
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

// ─────────────────────────────────────────────────────────────────────────────

function rejectLineLabel(ln: SpokeRejectLine): string {
  const recipe = getRecipe(ln.recipeId);
  return `${ln.rejectedUnits} ${recipe?.name ?? ln.skuId} (${SPOKE_REJECT_REASON_LABEL[ln.reason].toLowerCase()})`;
}

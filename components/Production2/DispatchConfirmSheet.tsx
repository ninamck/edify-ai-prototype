'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, X, AlertTriangle, ChevronRight } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import QtyStepper from './QtyStepper';
import {
  dayOfWeek,
  getRecipe,
  getSite,
  type DispatchTransferLine,
  type ProductionRecipe,
  type SiteId,
  type SkuId,
} from './fixtures';

/**
 * One spoke's slice of the confirm sheet manifest. The matrix is responsible
 * for building this from its current submissions data so the sheet stays a
 * pure presentation/confirmation surface.
 */
export type DispatchManifestEntry = {
  spokeId: SiteId;
  /** Lines to dispatch. Each line is a single recipe with a unit count. */
  lines: DispatchTransferLine[];
  /** Total units across all lines (cached for header summary). */
  totalUnits: number;
  /**
   * Spoke's submission status at the time of building the manifest. Drives
   * the "fully confirmed" / "still draft" wording in the audit row.
   */
  submissionStatus?: string;
};

type Props = {
  hubId: SiteId;
  forDate: string;
  /** One entry per spoke. Single-spoke send → length 1; "Send all" → many. */
  manifest: DispatchManifestEntry[];
  /** Demo display name for "Sent by" attribution. */
  sentBy: string;
  onCancel: () => void;
  /**
   * Called when the manager confirms. The manifest may have been edited
   * line-by-line inside the sheet (the manager can dial each spoke's
   * units up or down with a stepper); the adjusted manifest is what
   * actually gets dispatched.
   */
  onConfirm: (note: string | undefined, adjustedManifest: DispatchManifestEntry[]) => void;
};

/**
 * DispatchConfirmSheet — modal shown when the hub manager hits "Send" on a
 * spoke (or "Send all submitted") on the dispatch matrix. Presents:
 *  - one collapsible manifest section per spoke (recipe × units)
 *  - a clear total-units summary with Quinn-flag count if any lines were
 *    auto-filled from Quinn's proposal vs the spoke's confirmed number
 *  - an optional override note (free text)
 *  - Cancel / Confirm dispatch buttons
 *
 * Confirm fires `onConfirm(note)`; the parent records the transfer(s) in the
 * dispatch store and dismisses the sheet.
 */
export default function DispatchConfirmSheet({
  hubId,
  forDate,
  manifest,
  sentBy,
  onCancel,
  onConfirm,
}: Props) {
  const [note, setNote] = useState('');
  const [openSpokes, setOpenSpokes] = useState<Set<SiteId>>(() => {
    // For single-spoke send, expand by default. For bulk, collapse so the
    // header stays scannable; the manager can drill in per spoke.
    return manifest.length === 1 ? new Set(manifest.map(m => m.spokeId)) : new Set();
  });

  // Per-line unit overrides — keyed by spokeId → skuId → units. Initialised
  // from the incoming manifest so the steppers start at exactly what the
  // matrix proposed; the manager can dial each line up or down before
  // confirming. The adjusted numbers are what gets dispatched.
  const [overrides, setOverrides] = useState<Record<SiteId, Record<SkuId, number>>>(() => {
    const init: Record<SiteId, Record<SkuId, number>> = {};
    for (const entry of manifest) {
      init[entry.spokeId] = {};
      for (const line of entry.lines) {
        init[entry.spokeId][line.skuId] = line.units;
      }
    }
    return init;
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const hubName = getSite(hubId)?.name ?? hubId;
  const isBulk = manifest.length > 1;

  // Apply overrides to produce the manifest that will actually be dispatched.
  // Lines dropped to 0 stay in the manifest so the spoke sees the full
  // intended list (with a "0 sent" line) — keeping the audit trail honest.
  const adjustedManifest: DispatchManifestEntry[] = useMemo(
    () =>
      manifest.map(entry => {
        const lines = entry.lines.map(l => ({
          ...l,
          units: overrides[entry.spokeId]?.[l.skuId] ?? l.units,
        }));
        return {
          ...entry,
          lines,
          totalUnits: lines.reduce((a, l) => a + l.units, 0),
        };
      }),
    [manifest, overrides],
  );

  const grandTotal = useMemo(
    () => adjustedManifest.reduce((a, m) => a + m.totalUnits, 0),
    [adjustedManifest],
  );
  const totalLines = useMemo(
    () => adjustedManifest.reduce((a, m) => a + m.lines.length, 0),
    [adjustedManifest],
  );
  const quinnLineCount = useMemo(
    () => adjustedManifest.reduce((a, m) => a + m.lines.filter(l => l.wasQuinnProposed).length, 0),
    [adjustedManifest],
  );

  function toggleSpoke(spokeId: SiteId) {
    setOpenSpokes(prev => {
      const next = new Set(prev);
      if (next.has(spokeId)) next.delete(spokeId);
      else next.add(spokeId);
      return next;
    });
  }

  function setLineUnits(spokeId: SiteId, skuId: SkuId, units: number) {
    setOverrides(prev => ({
      ...prev,
      [spokeId]: { ...(prev[spokeId] ?? {}), [skuId]: Math.max(0, units) },
    }));
  }

  // Render through a portal so the modal escapes any clipping ancestor.
  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="dispatch-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(12, 20, 44, 0.45)',
          zIndex: 1300,
        }}
      />
      {/* Outer flex wrapper centres the modal; the inner motion.div animates
          y without fighting a translate transform — same pattern as the
          UrgentRemakeBanner / ad-hoc review modal. */}
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
        key="dispatch-card"
        role="dialog"
        aria-label={isBulk ? 'Confirm dispatch to multiple spokes' : 'Confirm dispatch to spoke'}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
        style={{
          width: 'min(640px, 100%)',
          maxHeight: 'calc(100vh - 32px)',
          overflow: 'hidden',
          borderRadius: 'var(--radius-card)',
          background: '#ffffff',
          boxShadow: '0 24px 64px rgba(12,20,44,0.28)',
          fontFamily: 'var(--font-primary)',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px 12px',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Truck size={16} color="var(--color-accent-active)" />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Dispatch · {dayOfWeek(forDate)} {forDate}
              </span>
            </div>
            <button
              onClick={onCancel}
              aria-label="Cancel"
              style={{
                width: 32,
                height: 32,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: '1px solid var(--color-border-subtle)',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
              }}
            >
              <X size={16} />
            </button>
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              lineHeight: 1.3,
            }}
          >
            {isBulk
              ? `Send to ${manifest.length} spokes from ${hubName}`
              : `Send to ${getSite(manifest[0].spokeId)?.name ?? manifest[0].spokeId}`}
          </h2>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--color-text-muted)' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{totalLines} lines</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{grandTotal} units</span>
            {quinnLineCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: 'var(--color-warning)',
                }}
              >
                <EdifyMark size={11} /> {quinnLineCount} on Quinn proposal
              </span>
            )}
          </div>
        </div>

        {/* Body — manifest sections */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {adjustedManifest.map(entry => {
            const isOpen = openSpokes.has(entry.spokeId);
            const spoke = getSite(entry.spokeId);
            const quinnCount = entry.lines.filter(l => l.wasQuinnProposed).length;
            return (
              <div
                key={entry.spokeId}
                style={{
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-card)',
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => toggleSpoke(entry.spokeId)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: '#ffffff',
                    border: 'none',
                    borderBottom: isOpen ? '1px solid var(--color-border-subtle)' : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  <ChevronRight
                    size={14}
                    color="var(--color-text-muted)"
                    style={{
                      transform: isOpen ? 'rotate(90deg)' : 'none',
                      transition: 'transform 120ms ease',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      flex: 1,
                    }}
                  >
                    {spoke?.name ?? entry.spokeId}
                  </span>
                  {entry.submissionStatus && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {entry.submissionStatus}
                    </span>
                  )}
                  {quinnCount > 0 && (
                    <span
                      title={`${quinnCount} of ${entry.lines.length} lines came from Quinn's proposal`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 10,
                        color: 'var(--color-warning)',
                      }}
                    >
                      <EdifyMark size={10} /> {quinnCount}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {entry.totalUnits} units
                  </span>
                </button>

                {isOpen && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      background: 'var(--color-bg-surface)',
                    }}
                  >
                    {entry.lines.map(line => (
                      <ManifestLineRow
                        key={line.skuId}
                        line={line}
                        onChange={(units) => setLineUnits(entry.spokeId, line.skuId, units)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {quinnLineCount > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--color-warning-light)',
                border: '1px solid var(--color-warning-border)',
                color: 'var(--color-warning)',
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {quinnLineCount} {quinnLineCount === 1 ? 'line is' : 'lines are'} dispatching on
                Quinn's proposal — the spoke hadn't confirmed those numbers yet. They're flagged in
                the manifest above.
              </span>
            </div>
          )}

          {/* Optional override note */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Note (optional)
            </span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Anything the spoke should know about this dispatch — substitutions, partial fills, late items…"
              rows={2}
              style={{
                resize: 'vertical',
                padding: '8px 10px',
                fontSize: 12,
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-primary)',
                background: '#ffffff',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                outline: 'none',
              }}
            />
          </label>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#ffffff',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Sent by <strong style={{ color: 'var(--color-text-secondary)' }}>{sentBy}</strong>
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onCancel}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              background: '#ffffff',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note.trim() || undefined, adjustedManifest)}
            disabled={grandTotal === 0}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              background:
                grandTotal === 0 ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
              color:
                grandTotal === 0 ? 'var(--color-text-muted)' : 'var(--color-text-on-active)',
              border: '1px solid transparent',
              cursor: grandTotal === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Truck size={13} />
            {isBulk ? `Confirm dispatch · ${manifest.length} spokes` : 'Confirm dispatch'}
          </button>
        </div>
      </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}

function ManifestLineRow({
  line,
  onChange,
}: {
  line: DispatchTransferLine;
  onChange: (units: number) => void;
}) {
  const recipe: ProductionRecipe | undefined = getRecipe(line.recipeId);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 12,
        alignItems: 'center',
        padding: '8px 14px',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {recipe?.name ?? line.skuId}
        </span>
        {recipe && (
          <span
            style={{
              fontSize: 9,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              fontWeight: 600,
            }}
          >
            {recipe.category}
          </span>
        )}
        {line.wasQuinnProposed && (
          <span
            title="Spoke hadn't confirmed — Quinn's proposal used"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 9,
              color: 'var(--color-warning)',
              fontWeight: 700,
            }}
          >
            <EdifyMark size={9} /> Quinn
          </span>
        )}
      </div>
      <QtyStepper
        size="compact"
        canDecrement={line.units > 0}
        onDecrement={() => onChange(line.units - 1)}
        onIncrement={() => onChange(line.units + 1)}
      >
        <input
          type="number"
          value={line.units}
          min={0}
          onChange={e => onChange(parseInt(e.target.value || '0', 10) || 0)}
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
    </div>
  );
}

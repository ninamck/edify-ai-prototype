'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, X } from 'lucide-react';
import {
  getRecipe,
  getSite,
  SHORTFALL_REASON_LABELS,
  type ShortfallReason,
  type SiteId,
  type SkuId,
} from './fixtures';
import {
  computeAllocation,
  rebalanceAfterEdit,
  sumAllocated,
  type AllocationInput,
  type AllocationRow,
  type AllocationStrategy,
} from './dispatchShortfall';
import QtyStepper from './QtyStepper';

/**
 * One spoke's input row to the reallocation modal. The hub-side dispatch
 * surface (HubSpokeBreakdown) is responsible for assembling these from
 * its current cell values (confirmed or Quinn-proposed units). The modal
 * stays a pure presentation surface — it doesn't know about submissions.
 */
export type ShortfallReallocationInput = AllocationInput;

/**
 * Result handed back when the manager hits Apply. The dispatch page
 * stores this keyed by recipeId so the matrix banner can read "applied"
 * state and the DispatchConfirmSheet can stamp the per-line reason +
 * cut amount onto each outgoing line.
 */
export type ShortfallReallocationResult = {
  recipeId: string;
  skuId: SkuId;
  availableSupply: number;
  strategy: AllocationStrategy;
  rows: AllocationRow[];
  /** Captured when at least one row uses the manager-discretion reason. */
  managerNote?: string;
  /**
   * True when this result was generated automatically by the dispatch
   * surface (demand-led on Send) instead of being explicitly applied by
   * the manager. The matrix banner uses this to label the row "Auto
   * reallocated" vs "Reallocated", and the Confirm sheet flags how many
   * recipes were auto-cut so the manager has a clean review surface.
   * Manager-edited results always carry `autoApplied: false`.
   */
  autoApplied?: boolean;
};

type Props = {
  recipeId: string;
  skuId: SkuId;
  recipeName?: string;
  /** Sum of all spoke requests. Used to size the shortfall message. */
  totalRequested: number;
  /** Hub-available supply for this SKU on the dispatch day. */
  availableSupply: number;
  /** One row per spoke that ordered the recipe. */
  inputs: ShortfallReallocationInput[];
  /** Previously-applied result (if any) — pre-populates the modal. */
  initial?: ShortfallReallocationResult;
  onCancel: () => void;
  onApply: (result: ShortfallReallocationResult) => void;
};

const STRATEGY_OPTIONS: Array<{ id: AllocationStrategy; label: string; hint: string }> = [
  {
    id: 'demand-led',
    label: 'Demand-led',
    hint: 'Cut deepest where recent sell-through is weakest',
  },
  {
    id: 'pro-rata',
    label: 'Pro-rata',
    hint: 'Everyone takes the same percentage cut',
  },
  {
    id: 'manual',
    label: 'Manual',
    hint: "Start from the suggestion, you tune every row",
  },
];

const REASON_OPTIONS: ShortfallReason[] = [
  'lower-forecast',
  'lower-sell-through',
  'top-up-later-run',
  'hub-balancing',
  'manager-discretion',
];

/**
 * ShortfallReallocationModal — opens when the manager taps the "Reallocate"
 * banner on a recipe row in the dispatch matrix. Shows the per-spoke
 * suggestion, lets them switch strategy, tweak per-row, and pick a
 * spoke-facing reason for each cut. Applying writes the result back to
 * the dispatch page so the matrix and the confirm sheet both see it.
 */
export default function ShortfallReallocationModal({
  recipeId,
  skuId,
  recipeName,
  totalRequested,
  availableSupply,
  inputs,
  initial,
  onCancel,
  onApply,
}: Props) {
  const shortfall = Math.max(0, totalRequested - availableSupply);
  const recipe = useMemo(() => getRecipe(recipeId), [recipeId]);
  const title = recipeName ?? recipe?.name ?? skuId;

  // Strategy: either the previously-applied one or demand-led for a
  // first open. Switching strategy recomputes the rows from scratch,
  // unless we're switching INTO manual — that case preserves whatever
  // the manager had so they don't lose hand-tuned edits.
  const [strategy, setStrategy] = useState<AllocationStrategy>(
    initial?.strategy ?? 'demand-led',
  );
  const [rows, setRows] = useState<AllocationRow[]>(() =>
    initial?.rows ?? computeAllocation('demand-led', inputs, availableSupply),
  );
  const [note, setNote] = useState<string>(initial?.managerNote ?? '');

  // Recompute when strategy flips. The manual case is special: keep the
  // current rows (manager has been editing) and just relabel reasons to
  // discretion, so we don't lose work on an accidental click.
  function switchStrategy(next: AllocationStrategy) {
    if (next === strategy) return;
    setStrategy(next);
    if (next === 'manual') {
      setRows(prev => prev.map(r => ({ ...r, reason: 'manager-discretion' })));
    } else {
      setRows(computeAllocation(next, inputs, availableSupply));
    }
  }

  function editUnits(spokeId: SiteId, newValue: number) {
    setRows(prev => rebalanceAfterEdit(prev, spokeId, newValue, availableSupply));
    // Manual-edit a row → we're in manager territory, switch strategy
    // to Manual so the strategy chip reads honestly. The reasons set per
    // row aren't auto-changed — manager keeps whatever they picked.
    if (strategy !== 'manual') setStrategy('manual');
  }

  function setRowReason(spokeId: SiteId, reason: ShortfallReason) {
    setRows(prev =>
      prev.map(r => (r.spokeId === spokeId ? { ...r, reason } : r)),
    );
  }

  const allocated = sumAllocated(rows);
  const reconciled = allocated === availableSupply;
  const anyManagerDiscretion = rows.some(r => r.reason === 'manager-discretion');

  // Esc dismisses.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="shortfall-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(12, 20, 44, 0.45)',
          zIndex: 1400,
        }}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1401,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          pointerEvents: 'none',
        }}
      >
        <motion.div
          key="shortfall-card"
          role="dialog"
          aria-label={`Reallocate shortfall on ${title}`}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          style={{
            width: 'min(680px, 100%)',
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
                <AlertTriangle size={16} color="var(--color-warning)" />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Reallocate shortfall
                </span>
              </div>
              <button
                onClick={onCancel}
                aria-label="Close"
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
              {title}
            </h2>
            <div
              style={{
                display: 'flex',
                gap: 14,
                fontSize: 11,
                color: 'var(--color-text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>{availableSupply} produced</span>
              <span>·</span>
              <span>{totalRequested} promised</span>
              <span>·</span>
              <span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>
                {shortfall} short
              </span>
            </div>
          </div>

          {/* Strategy picker */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--color-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
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
              Strategy
            </span>
            {STRATEGY_OPTIONS.map(opt => {
              const active = opt.id === strategy;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => switchStrategy(opt.id)}
                  title={opt.hint}
                  style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    cursor: 'pointer',
                    background: active ? 'var(--color-accent-active)' : '#ffffff',
                    color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                    border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
                    transition: 'all 0.15s',
                    textAlign: 'left',
                  }}
                >
                  <span>{opt.label}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      opacity: 0.8,
                      marginTop: 1,
                    }}
                  >
                    {opt.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Per-spoke rows */}
          <div
            style={{
              flex: 1,
              // `min-height: 0` lets this scroll body actually shrink
              // below its content's natural height inside the flex
              // column. `overscroll-behavior: contain` keeps wheel
              // events from leaking through the modal to the page.
              minHeight: 0,
              overflow: 'auto',
              overscrollBehavior: 'contain',
              padding: '8px 20px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {/* Column header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 60px 60px 110px 180px',
                gap: 10,
                padding: '8px 0 6px',
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                borderBottom: '1px solid var(--color-border-subtle)',
              }}
            >
              <span>Spoke</span>
              <span style={{ textAlign: 'right' }}>Asked</span>
              <span style={{ textAlign: 'right' }}>Send</span>
              <span style={{ textAlign: 'right' }}>Δ</span>
              <span>Reason</span>
            </div>
            {rows.map(row => (
              <RowEditor
                key={row.spokeId}
                row={row}
                onEditUnits={(v) => editUnits(row.spokeId, v)}
                onReason={(r) => setRowReason(row.spokeId, r)}
              />
            ))}

            {/* Reconciliation status + optional manager note */}
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 8,
                background: reconciled ? 'var(--color-success-light)' : 'var(--color-warning-light)',
                border: `1px solid ${reconciled ? 'var(--color-success-border)' : 'var(--color-warning-border)'}`,
                fontSize: 11,
                color: reconciled ? 'var(--color-success)' : 'var(--color-warning)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ fontWeight: 700 }}>
                {allocated} of {availableSupply} allocated
              </span>
              {!reconciled && (
                <span>
                  {allocated > availableSupply
                    ? `${allocated - availableSupply} over supply — pull units back`
                    : `${availableSupply - allocated} more to distribute`}
                </span>
              )}
            </div>

            {anyManagerDiscretion && (
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
                  Manager note (visible to spoke)
                </span>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Optional — why you chose these cuts manually."
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
            )}
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
              Spokes see the reason on their inbound dispatch.
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
              onClick={() =>
                onApply({
                  recipeId,
                  skuId,
                  availableSupply,
                  strategy,
                  rows,
                  managerNote: anyManagerDiscretion ? note.trim() || undefined : undefined,
                  autoApplied: false,
                })
              }
              disabled={!reconciled}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--font-primary)',
                background: reconciled ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
                color: reconciled ? 'var(--color-text-on-active)' : 'var(--color-text-muted)',
                border: '1px solid transparent',
                cursor: reconciled ? 'pointer' : 'not-allowed',
              }}
            >
              Apply reallocation
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}

function RowEditor({
  row,
  onEditUnits,
  onReason,
}: {
  row: AllocationRow;
  onEditUnits: (units: number) => void;
  onReason: (reason: ShortfallReason) => void;
}) {
  const spoke = getSite(row.spokeId);
  const cut = row.delta < 0;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 60px 60px 110px 180px',
        gap: 10,
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
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
        {spoke?.name ?? row.spokeId}
      </span>
      <span
        style={{
          textAlign: 'right',
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {row.requested}
      </span>
      <QtyStepper
        size="compact"
        canDecrement={row.suggested > 0}
        onDecrement={() => onEditUnits(row.suggested - 1)}
        onIncrement={() => onEditUnits(row.suggested + 1)}
      >
        <input
          type="number"
          value={row.suggested}
          min={0}
          max={row.requested}
          onChange={e => onEditUnits(parseInt(e.target.value || '0', 10) || 0)}
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
      <span
        style={{
          textAlign: 'right',
          fontSize: 12,
          fontWeight: 700,
          color: cut ? 'var(--color-warning)' : 'var(--color-text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {row.delta > 0 ? `+${row.delta}` : row.delta}
      </span>
      <ReasonPicker value={row.reason} onChange={onReason} disabled={!cut} />
    </div>
  );
}

function ReasonPicker({
  value,
  onChange,
  disabled,
}: {
  value: ShortfallReason;
  onChange: (reason: ShortfallReason) => void;
  disabled: boolean;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value as ShortfallReason)}
        disabled={disabled}
        style={{
          appearance: 'none',
          width: '100%',
          padding: '6px 24px 6px 10px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
          background: disabled ? 'var(--color-bg-surface)' : '#ffffff',
          border: '1px solid var(--color-border)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
        }}
      >
        {REASON_OPTIONS.map(r => (
          <option key={r} value={r}>
            {SHORTFALL_REASON_LABELS[r]}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        color="var(--color-text-muted)"
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

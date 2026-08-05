'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, X, AlertTriangle, ChevronRight, Printer, Sparkles, Pencil, Check, Thermometer } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import QtyStepper from './QtyStepper';
import {
  dayOfWeek,
  getRecipe,
  getSite,
  SHORTFALL_REASON_LABELS,
  type DispatchTransferLine,
  type ProductionRecipe,
  type ShortfallReason,
  type SiteId,
  type SkuId,
} from './fixtures';
import {
  computeAllocation,
  type AllocationInput,
  type AllocationStrategy,
} from './dispatchShortfall';

type RecipeId = string;

/**
 * One affected recipe pulled from the manifest. Lives only inside this
 * sheet — the manifest still owns the wire format.
 */
type ShortfallContext = {
  recipeId: RecipeId;
  recipeName: string;
  skuId: SkuId;
  /** Locked at sheet open: hub-produced units for this recipe. */
  availableSupply: number;
  /** Sum of pre-cut requests across spokes that ordered this recipe. */
  totalRequested: number;
  /** Per-spoke pre-cut request, used as `inputs` for `computeAllocation`. */
  inputs: AllocationInput[];
};

const STRATEGY_OPTIONS: Array<{ id: AllocationStrategy; label: string; hint: string }> = [
  { id: 'demand-led', label: 'Demand-led', hint: 'Cut deepest where sell-through is weakest' },
  { id: 'pro-rata', label: 'Pro-rata', hint: 'Same percentage cut for everyone' },
  { id: 'manual', label: 'Manual', hint: 'Tune each spoke yourself below' },
];

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
  /**
   * Recipe display names that had a shortfall reallocation applied to
   * the lines below (auto or manual). Non-blocking — surfaced as an
   * info banner at the top of the sheet so the manager knows what was
   * cut at a glance without scanning every line. Each affected line
   * also carries its own reason chip in the manifest body.
   */
  reallocatedRecipes?: string[];
  /**
   * How many of `reallocatedRecipes` were auto-applied (demand-led
   * default at Send) vs manager-edited. The banner reads "Auto-cut N
   * of M recipes" when this is set; M − N is the manager-resolved
   * portion. Both numbers are informational only; nothing blocks Send.
   */
  autoReallocatedCount?: number;
  onCancel: () => void;
  /**
   * Called when the manager confirms. The manifest may have been edited
   * line-by-line inside the sheet (the manager can dial each spoke's
   * units up or down with a stepper); the adjusted manifest is what
   * actually gets dispatched. `dispatchTempC` is the temperature the
   * operator logged for this drop (°C) — forwarded onto the transfer so
   * it flows through to the external cold-chain / food-safety system.
   */
  onConfirm: (
    note: string | undefined,
    adjustedManifest: DispatchManifestEntry[],
    dispatchTempC?: number,
  ) => void;
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
  reallocatedRecipes = [],
  autoReallocatedCount = 0,
  onCancel,
  onConfirm,
}: Props) {
  const hasReallocations = reallocatedRecipes.length > 0;
  const manuallyAdjustedCount = Math.max(
    0,
    reallocatedRecipes.length - autoReallocatedCount,
  );
  const [note, setNote] = useState('');
  // Dispatch temperature (°C) the operator logs at Send. Kept as a raw
  // string so the field can be empty / mid-edit; parsed to a number only
  // when handed to `onConfirm`. Flows through to the cold-chain system.
  const [tempInput, setTempInput] = useState('');
  const parsedTemp = useMemo(() => {
    const t = tempInput.trim();
    if (t === '') return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }, [tempInput]);
  // Per-spoke section is now tab-based, not an accordion. One spoke is
  // active at a time, defaulting to the first in the manifest. The
  // manager can flip between spokes without scrolling, and each tab
  // surfaces a totals/quinn/cut summary so the comparison is at-a-glance.
  const [activeSpokeId, setActiveSpokeId] = useState<SiteId>(
    () => manifest[0]?.spokeId ?? ('' as SiteId),
  );
  // Per-recipe expansion state for the shortfall distribution section.
  // Recipe rows start collapsed (showing a one-line summary of the
  // current strategy + cut total); the manager opens a row to see the
  // strategy chips + per-spoke breakdown, and picking a strategy auto-
  // collapses it back so the section stays compact across decisions.
  const [expandedShortfallRecipes, setExpandedShortfallRecipes] = useState<Set<RecipeId>>(
    () => new Set(),
  );

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

  // ── Inline shortfall distribution ─────────────────────────────────────
  // The matrix builds the manifest with cuts already applied via the
  // matrix's `effectiveAllocations` (default: demand-led). The confirm
  // sheet re-derives the same per-recipe context here so the manager
  // can switch the strategy WITHOUT bouncing back to the matrix and
  // tapping a row banner. Switching writes new per-spoke unit numbers
  // straight into `overrides` so the per-spoke sections below update
  // in lockstep — and the per-line cut chips relabel via `lineReasons`.
  //
  // `shortfallContexts` is locked to the *initial* manifest so the
  // available-supply baseline doesn't drift if the manager hand-tunes
  // a line via stepper after the strategy is set. (Hand-tunes still
  // flip the recipe's strategy chip to "Manual" — see `setLineUnits`.)
  const shortfallContexts = useMemo<ShortfallContext[]>(() => {
    const byRecipe = new Map<RecipeId, ShortfallContext>();
    for (const entry of manifest) {
      for (const line of entry.lines) {
        const ctx = byRecipe.get(line.recipeId);
        // Pre-cut "requested" = whatever the spoke originally asked for.
        // For cut lines that's `originalRequested`; for un-cut lines
        // it's the line's current `units` (no cut means asked = sent).
        const requested = line.originalRequested ?? line.units;
        if (!ctx) {
          byRecipe.set(line.recipeId, {
            recipeId: line.recipeId,
            recipeName: getRecipe(line.recipeId)?.name ?? line.skuId,
            skuId: line.skuId,
            availableSupply: line.units,
            totalRequested: requested,
            inputs: [
              { spokeId: entry.spokeId, skuId: line.skuId, requested },
            ],
            // Mark whether THIS line was a cut. We promote the recipe to
            // "affected" status if any spoke's line shows a shortfall
            // reason, see filter pass below.
          });
        } else {
          ctx.availableSupply += line.units;
          ctx.totalRequested += requested;
          ctx.inputs.push({
            spokeId: entry.spokeId,
            skuId: line.skuId,
            requested,
          });
        }
      }
    }
    // Only keep recipes that were actually short — i.e. at least one
    // spoke received less than they asked for. Healthy recipes don't
    // need a strategy picker.
    const affectedIds = new Set<RecipeId>();
    for (const entry of manifest) {
      for (const line of entry.lines) {
        if (line.shortfallReason !== undefined) affectedIds.add(line.recipeId);
      }
    }
    return Array.from(byRecipe.values()).filter(c => affectedIds.has(c.recipeId));
  }, [manifest]);

  /**
   * Per-recipe strategy state. Defaults to demand-led (matches the
   * matrix's auto-cut). Flipping a chip recomputes the per-spoke split
   * and writes it into `overrides`. Manual-tuning a line below promotes
   * the strategy to 'manual' so the chip reads honestly.
   */
  const [recipeStrategies, setRecipeStrategies] = useState<
    Record<RecipeId, AllocationStrategy>
  >(() => {
    const init: Record<RecipeId, AllocationStrategy> = {};
    for (const ctx of shortfallContexts) init[ctx.recipeId] = 'demand-led';
    return init;
  });
  /**
   * Per-line override of the spoke-visible reason chip. Set when a
   * strategy switch produces a different default reason than what the
   * matrix initially baked into the line. Keyed spokeId → skuId.
   */
  const [lineReasons, setLineReasons] = useState<
    Record<SiteId, Record<SkuId, ShortfallReason>>
  >({});

  /**
   * Apply a strategy to one recipe: re-runs `computeAllocation`, then
   * writes per-spoke units + reasons into the local overrides. The
   * `adjustedManifest` derivation below consumes both maps.
   */
  function applyRecipeStrategy(recipeId: RecipeId, strategy: AllocationStrategy) {
    const ctx = shortfallContexts.find(c => c.recipeId === recipeId);
    if (!ctx) return;
    const allocRows = computeAllocation(strategy, ctx.inputs, ctx.availableSupply);
    setOverrides(prev => {
      const next: Record<SiteId, Record<SkuId, number>> = { ...prev };
      for (const row of allocRows) {
        next[row.spokeId] = {
          ...(next[row.spokeId] ?? {}),
          [ctx.skuId]: row.suggested,
        };
      }
      return next;
    });
    setLineReasons(prev => {
      const next: Record<SiteId, Record<SkuId, ShortfallReason>> = { ...prev };
      for (const row of allocRows) {
        next[row.spokeId] = {
          ...(next[row.spokeId] ?? {}),
          [ctx.skuId]: row.reason,
        };
      }
      return next;
    });
    setRecipeStrategies(prev => ({ ...prev, [recipeId]: strategy }));
  }

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
  // Reasons can also be overridden when a strategy flip changes the
  // default reason for a line ("demand-led" → lower-sell-through,
  // "pro-rata" → hub-balancing, "manual" → manager-discretion).
  const adjustedManifest: DispatchManifestEntry[] = useMemo(
    () =>
      manifest.map(entry => {
        const lines = entry.lines.map(l => {
          const overrideUnits = overrides[entry.spokeId]?.[l.skuId];
          const overrideReason = lineReasons[entry.spokeId]?.[l.skuId];
          const units = overrideUnits ?? l.units;
          // Pre-cut request: prefer the matrix-stamped value, fall back
          // to the line's incoming units when no cut was originally
          // applied (a strategy switch can newly trim such a line).
          const original = l.originalRequested ?? l.units;
          const next: DispatchTransferLine = { ...l, units };
          if (units < original) {
            next.originalRequested = original;
            next.shortfallReason =
              overrideReason ?? l.shortfallReason ?? 'lower-sell-through';
          } else if (units >= original) {
            // Strategy switch could push a previously-cut spoke back up
            // to (or above) their request; clear the cut chip in that
            // case so the line reads honestly.
            delete next.originalRequested;
            delete next.shortfallReason;
            delete next.shortfallNote;
          }
          return next;
        });
        return {
          ...entry,
          lines,
          totalUnits: lines.reduce((a, l) => a + l.units, 0),
        };
      }),
    [manifest, overrides, lineReasons],
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

  function toggleShortfallRecipe(recipeId: RecipeId) {
    setExpandedShortfallRecipes(prev => {
      const next = new Set(prev);
      if (next.has(recipeId)) next.delete(recipeId);
      else next.add(recipeId);
      return next;
    });
  }
  // Auto-collapse a recipe once the manager picks a strategy — they've
  // made their call, the row's job is done. They can always tap "Edit"
  // to re-open and switch.
  function applyStrategyAndCollapse(recipeId: RecipeId, strategy: AllocationStrategy) {
    applyRecipeStrategy(recipeId, strategy);
    setExpandedShortfallRecipes(prev => {
      if (!prev.has(recipeId)) return prev;
      const next = new Set(prev);
      next.delete(recipeId);
      return next;
    });
  }

  function setLineUnits(spokeId: SiteId, skuId: SkuId, units: number) {
    setOverrides(prev => ({
      ...prev,
      [spokeId]: { ...(prev[spokeId] ?? {}), [skuId]: Math.max(0, units) },
    }));
    // If this line belongs to a recipe under shortfall, hand-editing it
    // means the manager has gone off-strategy. Flip the recipe chip to
    // "Manual" so the picker reads honestly. Reasons on this specific
    // line also flip to manager-discretion since the cut depth was
    // chosen by the manager, not the strategy.
    const ctx = shortfallContexts.find(c => c.skuId === skuId);
    if (ctx) {
      setRecipeStrategies(prev =>
        prev[ctx.recipeId] === 'manual' ? prev : { ...prev, [ctx.recipeId]: 'manual' },
      );
      setLineReasons(prev => ({
        ...prev,
        [spokeId]: {
          ...(prev[spokeId] ?? {}),
          [skuId]: 'manager-discretion',
        },
      }));
    }
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
          width: 'min(760px, 100%)',
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
                <EdifyMark size={11} /> {quinnLineCount} on Edify proposal
              </span>
            )}
          </div>
        </div>

        {/* Body — manifest sections */}
        <div
          style={{
            flex: 1,
            // `min-height: 0` is the flex-scroll fix: without it, an
            // `overflow: auto` child can't actually shrink below its
            // natural content height, so the scroll never engages and
            // wheel events leak through to the page underneath.
            // `overscroll-behavior: contain` belt-and-braces stops any
            // residual leakage at the boundary even when the body IS
            // scrolling.
            minHeight: 0,
            overflow: 'auto',
            overscrollBehavior: 'contain',
            padding: '12px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {shortfallContexts.length > 0 && (
            <ShortfallDistributionSection
              contexts={shortfallContexts}
              strategies={recipeStrategies}
              expandedRecipes={expandedShortfallRecipes}
              onToggleRecipe={toggleShortfallRecipe}
              onStrategyChange={applyStrategyAndCollapse}
              adjustedManifest={adjustedManifest}
              autoReallocatedCount={autoReallocatedCount}
              manuallyAdjustedCount={manuallyAdjustedCount}
            />
          )}
          {/* Per-spoke section — tabs across the top + the active
              spoke's manifest below. One spoke at a time, no
              accordion. Tabs carry units, line count + small chips
              for quinn / cut so the manager can compare at a glance
              without flipping through. */}
          <SpokeManifestTabs
            manifest={adjustedManifest}
            activeSpokeId={activeSpokeId}
            onSelect={setActiveSpokeId}
          />
          {(() => {
            const entry =
              adjustedManifest.find(e => e.spokeId === activeSpokeId) ?? adjustedManifest[0];
            if (!entry) return null;
            const spoke = getSite(entry.spokeId);
            const quinnCount = entry.lines.filter(l => l.wasQuinnProposed).length;
            return (
              <div
                style={{
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-card)',
                  overflow: 'hidden',
                  background: 'var(--color-bg-surface)',
                  // Tall manifests (e.g. 21 lines for a flagship spoke)
                  // were being squeezed by the flex parent; lock the
                  // natural height so the body's overflow:auto can do
                  // the scrolling instead of the card clipping content.
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: '#ffffff',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      flex: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {spoke?.name ?? entry.spokeId}
                  </span>
                  {quinnCount > 0 && (
                    <span
                      title={`${quinnCount} of ${entry.lines.length} lines came from Edify's proposal`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--color-warning)',
                      }}
                    >
                      <EdifyMark size={10} /> {quinnCount}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {entry.lines.length} {entry.lines.length === 1 ? 'line' : 'lines'}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {entry.totalUnits} units
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {entry.lines.map(line => (
                    <ManifestLineRow
                      key={line.skuId}
                      line={line}
                      onChange={units => setLineUnits(entry.spokeId, line.skuId, units)}
                    />
                  ))}
                </div>
              </div>
            );
          })()}

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
                Edify's proposal — the spoke hadn't confirmed those numbers yet. They're flagged in
                the manifest above.
              </span>
            </div>
          )}

          {/* Dispatch temperature — logged at Send and forwarded to the
              external cold-chain / food-safety system on confirm. */}
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
              Dispatch temperature
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                background: '#ffffff',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                maxWidth: 200,
              }}
            >
              <Thermometer size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={tempInput}
                onChange={e => setTempInput(e.target.value)}
                placeholder="—"
                aria-label="Dispatch temperature in degrees Celsius"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--color-text-primary)',
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                °C
              </span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
              Recorded against this dispatch and sent to the cold-chain log.
            </span>
          </label>

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
            onClick={() =>
              printDispatchManifest({
                hubName,
                forDate,
                manifest: adjustedManifest,
                sentBy,
                note: note.trim() || undefined,
                grandTotal,
                totalLines,
                dispatchTempC: parsedTemp,
              })
            }
            disabled={grandTotal === 0}
            title="Open a printable summary of these dispatch amounts"
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              background: '#ffffff',
              color:
                grandTotal === 0
                  ? 'var(--color-text-muted)'
                  : 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              cursor: grandTotal === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Printer size={13} />
            Print
          </button>
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
            onClick={() => onConfirm(note.trim() || undefined, adjustedManifest, parsedTemp)}
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

// ─── Shortfall distribution section ──────────────────────────────────────────
//
// Inline replacement for the old "Auto-reallocated N short recipes"
// banner. Shows one card per affected recipe, each with a strategy
// picker (Demand-led / Pro-rata / Manual) and a per-spoke breakdown
// table. Switching the chip writes new units into the parent's
// `overrides` map, which feeds straight into the per-spoke manifest
// sections below — so the manager can pick the distribution method
// AND see the resulting numbers without leaving the sheet. The
// per-spoke sections still carry their own steppers for fine-tuning;
// hand-tuning a line auto-promotes the recipe's chip to "Manual".

function ShortfallDistributionSection({
  contexts,
  strategies,
  expandedRecipes,
  onToggleRecipe,
  onStrategyChange,
  adjustedManifest,
  autoReallocatedCount,
  manuallyAdjustedCount,
}: {
  contexts: ShortfallContext[];
  strategies: Record<RecipeId, AllocationStrategy>;
  expandedRecipes: Set<RecipeId>;
  onToggleRecipe: (recipeId: RecipeId) => void;
  onStrategyChange: (recipeId: RecipeId, strategy: AllocationStrategy) => void;
  adjustedManifest: DispatchManifestEntry[];
  autoReallocatedCount: number;
  manuallyAdjustedCount: number;
}) {
  const totalCount = contexts.length;
  // Build a quick lookup of each spoke's CURRENT units for a recipe so
  // the per-spoke breakdown reflects strategy switches and stepper
  // edits in real time.
  const currentUnitsByRecipe = useMemo(() => {
    const out = new Map<RecipeId, Map<SiteId, number>>();
    for (const entry of adjustedManifest) {
      for (const line of entry.lines) {
        const inner = out.get(line.recipeId) ?? new Map<SiteId, number>();
        inner.set(entry.spokeId, line.units);
        out.set(line.recipeId, inner);
      }
    }
    return out;
  }, [adjustedManifest]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 10,
        borderRadius: 8,
        background: 'var(--color-warning-light)',
        border: '1px solid var(--color-warning-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={13} color="var(--color-warning)" />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--color-warning)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Distribute shortfalls · {totalCount} {totalCount === 1 ? 'recipe' : 'recipes'}
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {autoReallocatedCount > 0 && manuallyAdjustedCount === 0
            ? 'auto-cut · demand-led'
            : autoReallocatedCount === 0
              ? 'all manager-resolved'
              : `${autoReallocatedCount} auto · ${manuallyAdjustedCount} manual`}
        </span>
      </div>
      {contexts.map(ctx => {
        const strategy = strategies[ctx.recipeId] ?? 'demand-led';
        const currentUnits = currentUnitsByRecipe.get(ctx.recipeId);
        const expanded = expandedRecipes.has(ctx.recipeId);
        return (
          <ShortfallRecipeRow
            key={ctx.recipeId}
            ctx={ctx}
            strategy={strategy}
            expanded={expanded}
            onToggle={() => onToggleRecipe(ctx.recipeId)}
            onStrategyChange={s => onStrategyChange(ctx.recipeId, s)}
            currentUnits={currentUnits}
          />
        );
      })}
    </div>
  );
}

/**
 * Single recipe inside the shortfall section. Two states:
 *
 *   - collapsed (default): one-line summary — recipe name, current
 *     strategy chip, cut total. Tap "Edit" to expand.
 *   - expanded            : the strategy picker + per-spoke breakdown.
 *     Picking a chip auto-collapses back to the summary so the section
 *     stays compact across multiple decisions.
 *
 * Why this shape: with many short recipes the original always-expanded
 * card stack pushed every per-spoke manifest below the fold. Treating
 * each recipe as a step in a flow ("decide, collapse, next") gets the
 * manager through the section quickly and reclaims the vertical space.
 */
function ShortfallRecipeRow({
  ctx,
  strategy,
  expanded,
  onToggle,
  onStrategyChange,
  currentUnits,
}: {
  ctx: ShortfallContext;
  strategy: AllocationStrategy;
  expanded: boolean;
  onToggle: () => void;
  onStrategyChange: (strategy: AllocationStrategy) => void;
  currentUnits?: Map<SiteId, number>;
}) {
  const shortfall = Math.max(0, ctx.totalRequested - ctx.availableSupply);
  const strategyLabel =
    STRATEGY_OPTIONS.find(o => o.id === strategy)?.label ?? strategy;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        style={{
          background: '#ffffff',
          border: '1px solid var(--color-warning-border)',
          borderRadius: 8,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          textAlign: 'left',
        }}
      >
        <Check size={11} color="var(--color-success)" aria-hidden />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {ctx.recipeName}
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          −{shortfall} units · {strategyLabel.toLowerCase()}
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
          }}
        >
          <Pencil size={11} aria-hidden /> Edit
        </span>
      </button>
    );
  }

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-warning-border)',
        borderRadius: 8,
        padding: '8px 10px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        title="Collapse"
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          flexWrap: 'wrap',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
          }}
        >
          {ctx.recipeName}
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {ctx.availableSupply} produced · {ctx.totalRequested} promised ·{' '}
          <span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>
            {shortfall} short
          </span>
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--color-text-muted)',
          }}
        >
          Tap to collapse
        </span>
      </button>
      <div
        role="tablist"
        aria-label={`Distribution for ${ctx.recipeName}`}
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
      >
        {STRATEGY_OPTIONS.map(opt => {
          const active = opt.id === strategy;
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onStrategyChange(opt.id)}
              title={opt.hint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
                background: active ? 'var(--color-accent-active)' : '#ffffff',
                color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                border: `1px solid ${
                  active ? 'var(--color-accent-active)' : 'var(--color-border)'
                }`,
                transition: 'all 0.15s',
              }}
            >
              {opt.id === 'demand-led' && active && (
                <Sparkles size={11} aria-hidden="true" />
              )}
              {opt.label}
            </button>
          );
        })}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 60px 60px 70px',
          gap: 8,
          alignItems: 'center',
          rowGap: 4,
          fontSize: 11,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span style={headRowStyle()}>Spoke</span>
        <span style={{ ...headRowStyle(), textAlign: 'right' }}>Asked</span>
        <span style={{ ...headRowStyle(), textAlign: 'right' }}>Sending</span>
        <span style={{ ...headRowStyle(), textAlign: 'right' }}>Δ</span>
        {ctx.inputs.map(inp => {
          const sending = currentUnits?.get(inp.spokeId) ?? 0;
          const delta = sending - inp.requested;
          const spoke = getSite(inp.spokeId);
          return (
            <Fragment key={inp.spokeId}>
              <span
                style={{
                  color: 'var(--color-text-secondary)',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {spoke?.name ?? inp.spokeId}
              </span>
              <span style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                {inp.requested}
              </span>
              <span
                style={{
                  textAlign: 'right',
                  fontWeight: 700,
                  color:
                    sending < inp.requested
                      ? 'var(--color-warning)'
                      : 'var(--color-text-primary)',
                }}
              >
                {sending}
              </span>
              <span
                style={{
                  textAlign: 'right',
                  fontWeight: 600,
                  color:
                    delta < 0
                      ? 'var(--color-warning)'
                      : delta > 0
                        ? 'var(--color-success)'
                        : 'var(--color-text-muted)',
                }}
              >
                {delta === 0 ? '0' : delta > 0 ? `+${delta}` : delta}
              </span>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function headRowStyle(): React.CSSProperties {
  return {
    fontSize: 9,
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };
}

// ─── Per-spoke tabs ─────────────────────────────────────────────────────────
//
// One tab per spoke in the manifest. Replaces the old expand/collapse
// accordion: with bulk sends covering 3-5+ spokes the accordion left
// the manifest body either too tall (everything open) or too sparse
// (everything closed). Tabs let the manager land on one spoke,
// scan/edit, then flip to the next without scrolling.
//
// Each tab carries the spoke name, units, and small chips for quinn
// proposal count + cut count so the comparison across spokes is
// visible without opening each one.

function SpokeManifestTabs({
  manifest,
  activeSpokeId,
  onSelect,
}: {
  manifest: DispatchManifestEntry[];
  activeSpokeId: SiteId;
  onSelect: (id: SiteId) => void;
}) {
  if (manifest.length <= 1) return null;
  // Canonical segmented-control treatment used across the app
  // (StocktakeList, OrderHistoryScreen, etc.): a single capsule with
  // a hover-bg fill, internal padding 3px, and pill-shaped tabs that
  // turn solid accent on active. Quinn / cut indicator chips ride
  // along but recolour against the accent fill so they stay legible.
  return (
    <div
      role="tablist"
      aria-label="Spoke manifests"
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        gap: 0,
        padding: 3,
        background: 'var(--color-bg-hover)',
        borderRadius: 100,
        width: 'fit-content',
        maxWidth: '100%',
      }}
    >
      {manifest.map(entry => {
        const active = entry.spokeId === activeSpokeId;
        const spoke = getSite(entry.spokeId);
        const quinnCount = entry.lines.filter(l => l.wasQuinnProposed).length;
        const cutCount = entry.lines.filter(l => l.shortfallReason !== undefined).length;
        return (
          <button
            key={entry.spokeId}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(entry.spokeId)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 32,
              padding: '0 12px',
              borderRadius: 100,
              border: 'none',
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              background: active ? 'var(--color-accent-active)' : 'transparent',
              color: active ? '#ffffff' : 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600 }}>
              {spoke?.name ?? entry.spokeId}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                opacity: active ? 0.95 : 0.7,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {entry.totalUnits}
            </span>
            {quinnCount > 0 && (
              <span
                title={`${quinnCount} Edify-proposed lines`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  fontSize: 10,
                  fontWeight: 700,
                  color: active ? '#ffffff' : 'var(--color-warning)',
                  opacity: active ? 0.95 : 1,
                }}
              >
                <EdifyMark size={10} color="currentColor" /> {quinnCount}
              </span>
            )}
            {cutCount > 0 && (
              <span
                title={`${cutCount} cut lines`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  fontSize: 10,
                  fontWeight: 700,
                  color: active ? '#ffffff' : 'var(--color-warning)',
                  opacity: active ? 0.95 : 1,
                }}
              >
                <AlertTriangle size={10} /> {cutCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
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
            title="Spoke hadn't confirmed — Edify's proposal used"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 9,
              color: 'var(--color-warning)',
              fontWeight: 700,
            }}
          >
            <EdifyMark size={9} /> Edify
          </span>
        )}
        {line.shortfallReason && line.originalRequested !== undefined && (
          <span
            title={`Cut from ${line.originalRequested}: ${SHORTFALL_REASON_LABELS[line.shortfallReason]}${
              line.shortfallNote ? ` — ${line.shortfallNote}` : ''
            }`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--color-warning)',
              background: 'var(--color-warning-light)',
              border: '1px solid var(--color-warning-border)',
              padding: '1px 6px',
              borderRadius: 999,
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <AlertTriangle size={9} />
            −{line.originalRequested - line.units} · {SHORTFALL_REASON_LABELS[line.shortfallReason]}
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

// ─── Print helper ────────────────────────────────────────────────────────────
//
// Opens a popup window with a self-contained print-friendly HTML page
// of the dispatch manifest, then triggers `window.print()`. The popup
// closes automatically after the print dialog is dismissed (or on
// `afterprint`) so the manager isn't left with an orphaned tab.
//
// Why a popup rather than `@media print` rules on the modal:
//  - The modal lives behind a backdrop, inside a portal, layered on
//    top of the production app chrome. Trying to mask everything else
//    with `display: none` for `@media print` would either miss
//    surfaces (sticky toolbars, banners) or accidentally hide the
//    sheet's own scrollable body.
//  - A popup gives us full control of the printable layout — we can
//    spread spokes across pages, drop the modal-only chrome (Cancel,
//    Note textarea, etc.) and use a high-density table that maps
//    cleanly to A4.
//  - The artifact survives the modal closing — useful for the
//    dispatch worker who's loading vans while the manager is back at
//    the matrix kicking off the next bulk send.
//
// If the popup is blocked by the browser, we silently fall back to a
// bare HTML data-URL link in a hidden anchor — the click handler
// hands control back to the user via `window.open` directly. (In the
// demo the user is on a desktop browser with popups allowed, so this
// is a defensive fallback only.)

type PrintInput = {
  hubName: string;
  forDate: string;
  manifest: DispatchManifestEntry[];
  sentBy: string;
  note?: string;
  grandTotal: number;
  totalLines: number;
  dispatchTempC?: number;
};

function printDispatchManifest(input: PrintInput) {
  if (typeof window === 'undefined') return;
  const w = window.open('', '_blank', 'width=860,height=1100');
  if (!w) {
    // Popup blocked — open in current tab as a fallback. The manager can
    // print and then back-button to the dispatch screen.
    const html = buildDispatchPrintHTML(input);
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.location.assign(blobUrl);
    return;
  }
  w.document.open();
  w.document.write(buildDispatchPrintHTML(input));
  w.document.close();
  // Wait one tick so layout settles before triggering print, then auto-close
  // when the dialog closes (Chrome/Safari fire `afterprint` reliably).
  w.onload = () => {
    w.focus();
    setTimeout(() => {
      w.print();
      w.onafterprint = () => w.close();
    }, 50);
  };
}

function buildDispatchPrintHTML(input: PrintInput): string {
  const { hubName, forDate, manifest, sentBy, note, grandTotal, totalLines, dispatchTempC } = input;
  const printedAt = new Date().toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const spokeSections = manifest
    .map(entry => {
      const spoke = getSite(entry.spokeId);
      const rows = entry.lines
        .map(line => {
          const recipe = getRecipe(line.recipeId);
          const cut =
            line.shortfallReason && line.originalRequested !== undefined
              ? `<span class="cut">−${line.originalRequested - line.units} · ${escape(
                  SHORTFALL_REASON_LABELS[line.shortfallReason],
                )}</span>`
              : '';
          const quinn = line.wasQuinnProposed
            ? '<span class="quinn">Edify proposal</span>'
            : '';
          return `<tr>
            <td class="recipe">${escape(recipe?.name ?? line.skuId)}${
              recipe?.category ? `<span class="category">${escape(recipe.category)}</span>` : ''
            }</td>
            <td class="meta">${quinn}${cut}</td>
            <td class="qty">${line.units}</td>
          </tr>`;
        })
        .join('');
      return `<section class="spoke">
        <header class="spoke-head">
          <h2>${escape(spoke?.name ?? entry.spokeId)}</h2>
          <span class="totals">${entry.lines.length} lines · <strong>${entry.totalUnits}</strong> units</span>
        </header>
        <table>
          <thead>
            <tr>
              <th class="recipe-col">Recipe</th>
              <th class="meta-col">Notes</th>
              <th class="qty-col">Units</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="signoff">
          <span class="sig">Loaded by</span>
          <span class="line"></span>
          <span class="sig">Received by</span>
          <span class="line"></span>
        </div>
      </section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Dispatch · ${escape(hubName)} · ${escape(forDate)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #0c142c; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
    }
    h1, h2, h3 { margin: 0; font-weight: 700; }
    .page { padding: 0; max-width: 100%; }
    header.page-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #0c142c;
      padding-bottom: 8px;
      margin-bottom: 18px;
    }
    .page-head h1 {
      font-size: 18pt;
      letter-spacing: -0.2px;
    }
    .page-head .meta {
      text-align: right;
      font-size: 9pt;
      color: #6b7280;
      line-height: 1.5;
    }
    .summary {
      display: flex;
      gap: 28px;
      padding: 10px 0 14px;
      font-size: 10pt;
      color: #475569;
    }
    .summary strong {
      color: #0c142c;
      font-size: 11pt;
      font-feature-settings: 'tnum';
    }
    .note {
      padding: 8px 12px;
      border-left: 3px solid #b45309;
      background: #fef6da;
      font-size: 10pt;
      margin-bottom: 14px;
      color: #422006;
    }
    section.spoke {
      page-break-inside: avoid;
      break-inside: avoid;
      margin-bottom: 22px;
    }
    .spoke-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px solid #cbd5e1;
      padding: 6px 0 4px;
      margin-bottom: 6px;
    }
    .spoke-head h2 { font-size: 13pt; }
    .spoke-head .totals { font-size: 10pt; color: #475569; font-feature-settings: 'tnum'; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
    }
    th, td {
      text-align: left;
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    th {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #64748b;
      font-weight: 700;
    }
    .recipe-col { width: 55%; }
    .meta-col { width: 30%; }
    .qty-col { width: 15%; text-align: right; }
    td.qty {
      text-align: right;
      font-weight: 700;
      font-feature-settings: 'tnum';
      font-size: 11pt;
    }
    td.recipe { font-weight: 600; }
    td.recipe .category {
      display: inline-block;
      margin-left: 6px;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #94a3b8;
      font-weight: 500;
    }
    td.meta { font-size: 9pt; color: #475569; }
    .quinn {
      display: inline-block;
      margin-right: 6px;
      font-size: 8pt;
      font-weight: 700;
      color: #b45309;
    }
    .cut {
      display: inline-block;
      font-size: 8pt;
      font-weight: 700;
      color: #b45309;
      background: #fef6da;
      border: 1px solid #ead173;
      border-radius: 3px;
      padding: 1px 5px;
      margin-right: 6px;
      font-feature-settings: 'tnum';
    }
    .signoff {
      display: grid;
      grid-template-columns: 80px 1fr 80px 1fr;
      gap: 12px;
      align-items: end;
      margin-top: 14px;
      padding-top: 10px;
      font-size: 9pt;
      color: #64748b;
    }
    .signoff .sig { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.05em; }
    .signoff .line { border-bottom: 1px solid #94a3b8; height: 22px; }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 8pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    @media screen {
      body { padding: 28px 32px; max-width: 820px; margin: 0 auto; background: #f8fafc; }
      .page { background: #ffffff; padding: 28px 32px; box-shadow: 0 6px 24px rgba(15,23,42,0.08); border-radius: 8px; }
    }
    @media print {
      a[href]:after { content: ''; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="page-head">
      <div>
        <h1>Dispatch — ${escape(hubName)}</h1>
        <div style="font-size:10pt;color:#475569;margin-top:4px;">For ${escape(dayOfWeek(forDate))} ${escape(forDate)}</div>
      </div>
      <div class="meta">
        Printed ${escape(printedAt)}<br/>
        Sent by <strong>${escape(sentBy)}</strong>
      </div>
    </header>
    <div class="summary">
      <span><strong>${manifest.length}</strong> ${manifest.length === 1 ? 'spoke' : 'spokes'}</span>
      <span><strong>${totalLines}</strong> lines</span>
      <span><strong>${grandTotal}</strong> total units</span>
      ${
        dispatchTempC !== undefined
          ? `<span>Temp <strong>${escape(String(dispatchTempC))}°C</strong></span>`
          : ''
      }
    </div>
    ${note ? `<div class="note"><strong>Note:</strong> ${escape(note)}</div>` : ''}
    ${spokeSections}
    <div class="footer">
      <span>Edify · Dispatch manifest</span>
      <span>${escape(hubName)} · ${escape(forDate)}</span>
    </div>
  </div>
</body>
</html>`;
}

// Tiny HTML-escape — the printable doc is rendered as raw HTML, so any
// caller-supplied string (recipe name, note, hub name) needs to be
// neutralised to avoid markup leaking through.
function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

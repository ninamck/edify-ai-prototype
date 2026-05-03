'use client';

import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  Package,
  AlertTriangle,
  ArrowRight,
  Combine,
  Info,
  Check,
} from 'lucide-react';
import type { PlanLine, FocusReason } from './PlanStore';

/**
 * PlanFocusPanel — the action-oriented landing surface for a Quinn deep-link
 * into Amounts. When the manager taps "Open Amounts" on a plan nudge, this
 * sheet slides in from the right with:
 *
 *  - A summary of the issue (reason-specific copy + live numbers)
 *  - One actionable card per affected recipe (not just the focused one) so
 *    the manager doesn't have to scroll the table to find the others — the
 *    nudge body might mention "3 recipes capped" but only one row is
 *    visible at a time, and it's easy to miss the rest.
 *  - Per-card primary action that mutates the plan in place (e.g. "Apply
 *    cap" sets planned = stockCap.cap on that one recipe) so the manager
 *    can fix a whole batch from one surface.
 *  - "Open in table" secondary action that scrolls + pulses the row in the
 *    table behind the panel for cases where a manual edit is preferred.
 *
 * The panel is the workflow; the table is the deep-dive view. After
 * dismissing the panel, the focused row stays expanded with its inline
 * stock-cap chip + ingredient breakdown so the manager can return to it.
 */

type Props = {
  /** All plan lines for the current site/date (so the panel can list every affected recipe). */
  lines: PlanLine[];
  /** The recipe Quinn linked to specifically — anchors the title and is highlighted in the list. */
  focusedItemId: string;
  /** Why we're here — drives copy + primary action labels. */
  reason: FocusReason;
  /** Mutate plan: set planned units for a recipe on this site/date. */
  onSetPlanned: (itemId: string, units: number) => void;
  /** Pop the panel and scroll to the row in the table (with the existing pulse highlight). */
  onOpenRow: (itemId: string) => void;
  /** Dismiss the panel completely. Also clears focus state on the host. */
  onClose: () => void;
};

export default function PlanFocusPanel({
  lines,
  focusedItemId,
  reason,
  onSetPlanned,
  onOpenRow,
  onClose,
}: Props) {
  // Esc to dismiss — same affordance as DispatchConfirmSheet.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Compute the set of "affected" lines for the current reason. The focused
  // line is always included (and pinned first) even if the issue has been
  // resolved since landing — so the panel never goes blank under the user.
  const affected = useMemo(() => buildAffected(lines, focusedItemId, reason), [lines, focusedItemId, reason]);
  const focusedLine = affected.find(l => l.item.id === focusedItemId) ?? affected[0];

  const palette = palettes[reason];
  const headline = headlineFor(reason, affected, focusedLine);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {/* Backdrop — semi-transparent so the table is dimly visible behind. */}
      <motion.div
        key="focus-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(12, 20, 44, 0.32)',
          zIndex: 1300,
        }}
      />
      <motion.div
        key="focus-panel"
        role="dialog"
        aria-label={`Quinn flagged: ${headline.title}`}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(460px, calc(100vw - 32px))',
          background: '#ffffff',
          boxShadow: '-12px 0 40px rgba(12,20,44,0.18)',
          zIndex: 1301,
          fontFamily: 'var(--font-primary)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px 14px',
            borderBottom: `1px solid ${palette.border}`,
            background: palette.bg,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Sparkles size={16} color={palette.icon} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: palette.icon,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Quinn flagged · {affected.length} {affected.length === 1 ? 'recipe' : 'recipes'}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 30,
                height: 30,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: '1px solid var(--color-border-subtle)',
                background: '#ffffff',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                flexShrink: 0,
              }}
            >
              <X size={16} />
            </button>
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 700,
              lineHeight: 1.3,
              color: 'var(--color-text-primary)',
            }}
          >
            {headline.title}
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            {headline.body}
          </p>
        </div>

        {/* Body — scrollable list of action cards. */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: 'var(--color-bg-surface)',
          }}
        >
          {affected.length === 0 && (
            <div
              style={{
                padding: 20,
                background: '#ffffff',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--color-border-subtle)',
                textAlign: 'center',
                color: 'var(--color-text-secondary)',
                fontSize: 12,
              }}
            >
              <Check size={20} color="var(--color-success)" style={{ marginBottom: 6 }} />
              <div style={{ fontWeight: 700 }}>All clear</div>
              <div style={{ fontSize: 11, marginTop: 4, color: 'var(--color-text-muted)' }}>
                Nothing to action — this issue has been resolved since Quinn raised it.
              </div>
            </div>
          )}
          {affected.map(line => (
            <ActionCard
              key={line.item.id}
              line={line}
              reason={reason}
              isFocused={line.item.id === focusedItemId}
              onApply={() => applyPrimaryAction(line, reason, onSetPlanned)}
              onOpenRow={() => onOpenRow(line.item.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {affected.length > 1 && canBatchApply(reason) && (
            <button
              type="button"
              onClick={() => {
                for (const l of affected) {
                  applyPrimaryAction(l, reason, onSetPlanned);
                }
              }}
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
              }}
            >
              Apply to all {affected.length}
            </button>
          )}
          <span
            style={{
              fontSize: 10,
              color: 'var(--color-text-muted)',
              flex: 1,
              fontStyle: 'italic',
            }}
          >
            Edits write straight to the plan. Close to keep working in the table.
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: '#ffffff',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Done
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-card content
// ─────────────────────────────────────────────────────────────────────────────

function ActionCard({
  line,
  reason,
  isFocused,
  onApply,
  onOpenRow,
}: {
  line: PlanLine;
  reason: FocusReason;
  isFocused: boolean;
  onApply: () => void;
  onOpenRow: () => void;
}) {
  const cta = primaryActionLabel(line, reason);
  const detail = cardDetail(line, reason);
  const resolved = isResolved(line, reason);

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 'var(--radius-card)',
        border: `1px solid ${isFocused ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: isFocused ? '0 4px 14px rgba(45,90,255,0.10)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                lineHeight: 1.3,
              }}
            >
              {line.recipe.name}
            </span>
            {isFocused && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'var(--color-accent-active)',
                  color: 'var(--color-text-on-active)',
                }}
              >
                From nudge
              </span>
            )}
            {resolved && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'var(--color-success-light)',
                  color: 'var(--color-success)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Check size={9} /> Done
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Numeric breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          padding: '8px 10px',
          background: 'var(--color-bg-surface)',
          borderRadius: 6,
        }}
      >
        {detail.cells.map((c, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {c.label}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: c.tone === 'error' ? 'var(--color-error)' : c.tone === 'success' ? 'var(--color-success)' : 'var(--color-text-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {c.value}
            </span>
          </div>
        ))}
      </div>

      {detail.note && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.45,
          }}
        >
          {detail.icon}
          <span>{detail.note}</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button
          type="button"
          disabled={resolved}
          onClick={onApply}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--color-accent-active)',
            background: resolved ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
            color: resolved ? 'var(--color-text-muted)' : 'var(--color-text-on-active)',
            fontSize: 11,
            fontWeight: 700,
            cursor: resolved ? 'default' : 'pointer',
            fontFamily: 'var(--font-primary)',
            opacity: resolved ? 0.6 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          {resolved ? 'Already applied' : cta}
        </button>
        <button
          type="button"
          onClick={onOpenRow}
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
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            marginLeft: 'auto',
          }}
        >
          Open row <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reason-specific helpers
// ─────────────────────────────────────────────────────────────────────────────

const palettes: Record<FocusReason, { bg: string; border: string; icon: string }> = {
  stockcap:        { bg: 'var(--color-error-light)',   border: 'var(--color-error-border)',   icon: 'var(--color-error)' },
  'assembly-short':{ bg: 'var(--color-error-light)',   border: 'var(--color-error-border)',   icon: 'var(--color-error)' },
  override:        { bg: 'var(--color-warning-light)', border: 'var(--color-warning-border)', icon: 'var(--color-warning)' },
  'draft-forecast':{ bg: 'var(--color-info-light)',    border: 'var(--color-info-light)',     icon: 'var(--color-info)' },
};

function buildAffected(lines: PlanLine[], focusedItemId: string, reason: FocusReason): PlanLine[] {
  let pool: PlanLine[];
  switch (reason) {
    case 'stockcap':
      pool = lines.filter(l => l.stockCap && l.effectivePlanned > l.stockCap.cap);
      break;
    case 'assembly-short':
      pool = lines.filter(l => l.assemblyDemand.totalUnits > l.planned);
      break;
    case 'override': {
      pool = lines.filter(l => {
        if (!l.isOverridden) return false;
        const base = l.quinnProposed || 1;
        return Math.abs(l.planned - l.quinnProposed) / base >= 0.25;
      });
      break;
    }
    case 'draft-forecast':
      pool = lines.filter(l => l.forecast?.status === 'draft');
      break;
  }
  // Always pin the focused line first — even if it's been resolved since
  // landing, so the manager keeps their bearings.
  const focused = lines.find(l => l.item.id === focusedItemId);
  const rest = pool.filter(l => l.item.id !== focusedItemId);
  return focused && !pool.includes(focused) ? [focused, ...rest] : focused ? [focused, ...rest] : pool;
}

function headlineFor(reason: FocusReason, affected: PlanLine[], focused: PlanLine | undefined): { title: string; body: string } {
  if (!focused) return { title: 'Quinn flagged a plan issue', body: 'Nothing to action right now.' };
  switch (reason) {
    case 'stockcap': {
      const binding = focused.stockCap?.bindingIngredients[0];
      const cap = focused.stockCap?.cap ?? 0;
      const single = affected.length === 1;
      return {
        title: single
          ? `${focused.recipe.name} capped at ${cap}`
          : `${affected.length} recipes capped by ingredient stock`,
        body: single && binding
          ? `${binding.ingredientName} stock only covers ${cap} units · plan ${focused.effectivePlanned}. Apply the cap to drop the plan, or open the row to adjust manually / top up stock.`
          : 'Each recipe below has a binding ingredient. Apply caps individually or use "Apply to all" to drop every plan to its stock cap.',
      };
    }
    case 'assembly-short': {
      const single = affected.length === 1;
      return {
        title: single
          ? `Short on ${focused.recipe.name}`
          : `${affected.length} components short on plan`,
        body: single
          ? `Assemblies need ${focused.assemblyDemand.totalUnits} but only ${focused.planned} are planned. Cover the demand to match, or open the row to adjust manually.`
          : 'Each component below is below its assembly demand. Cover one by one, or use "Apply to all" to match every plan to demand.',
      };
    }
    case 'override': {
      const single = affected.length === 1;
      return {
        title: single
          ? `${focused.recipe.name} is off forecast by ${Math.abs(focused.planned - focused.quinnProposed)}`
          : `${affected.length} recipes are ±25% off forecast`,
        body: 'Sanity-check the swings. Reset to Quinn\'s number per recipe, or open the row to keep your override and add a note.',
      };
    }
    case 'draft-forecast': {
      const single = affected.length === 1;
      return {
        title: single
          ? `Confirm forecast: ${focused.recipe.name}`
          : `${affected.length} forecasts still in draft`,
        body: 'Confirm each forecast before R1 so the plan locks for the floor. Open the row to inspect Quinn\'s signals first.',
      };
    }
  }
}

function cardDetail(line: PlanLine, reason: FocusReason): {
  cells: Array<{ label: string; value: string; tone?: 'error' | 'success' }>;
  note?: string;
  icon?: React.ReactNode;
} {
  switch (reason) {
    case 'stockcap': {
      const binding = line.stockCap?.bindingIngredients[0];
      const cap = line.stockCap?.cap ?? 0;
      return {
        cells: [
          { label: 'Plan', value: String(line.effectivePlanned), tone: line.effectivePlanned > cap ? 'error' : undefined },
          { label: 'Stock cap', value: String(cap) },
          { label: 'Over by', value: `+${Math.max(0, line.effectivePlanned - cap)}`, tone: 'error' },
        ],
        note: binding
          ? `Binding on ${binding.ingredientName} — ${formatStockUnits(binding.onHand, binding.unit)} on hand, ${formatStockUnits(binding.perUnit, binding.unit)} per unit.`
          : undefined,
        icon: <Package size={12} color="var(--color-text-muted)" style={{ marginTop: 2, flexShrink: 0 }} />,
      };
    }
    case 'assembly-short': {
      const need = line.assemblyDemand.totalUnits;
      return {
        cells: [
          { label: 'Plan', value: String(line.planned), tone: 'error' },
          { label: 'Needed by assemblies', value: String(need) },
          { label: 'Short by', value: `${need - line.planned}`, tone: 'error' },
        ],
        note:
          line.assemblyDemand.sources.length > 0
            ? `Driven by ${line.assemblyDemand.sources.length} assembly recipe${line.assemblyDemand.sources.length === 1 ? '' : 's'}.`
            : undefined,
        icon: <Combine size={12} color="var(--color-text-muted)" style={{ marginTop: 2, flexShrink: 0 }} />,
      };
    }
    case 'override': {
      const delta = line.planned - line.quinnProposed;
      return {
        cells: [
          { label: 'Quinn', value: String(line.quinnProposed) },
          { label: 'You set', value: String(line.planned) },
          { label: 'Delta', value: `${delta > 0 ? '+' : ''}${delta}`, tone: 'error' },
        ],
        icon: <AlertTriangle size={12} color="var(--color-warning)" style={{ marginTop: 2, flexShrink: 0 }} />,
      };
    }
    case 'draft-forecast': {
      return {
        cells: [
          { label: 'Forecast', value: String(line.forecast?.projectedUnits ?? 0) },
          { label: 'Status', value: 'Draft', tone: 'error' },
          { label: 'Plan', value: String(line.planned) },
        ],
        note: 'Open the row to read Quinn\'s signals before confirming.',
        icon: <Info size={12} color="var(--color-info)" style={{ marginTop: 2, flexShrink: 0 }} />,
      };
    }
  }
}

function primaryActionLabel(line: PlanLine, reason: FocusReason): string {
  switch (reason) {
    case 'stockcap': return `Apply cap (${line.stockCap?.cap ?? 0})`;
    case 'assembly-short': return `Cover (${line.assemblyDemand.totalUnits})`;
    case 'override': return `Reset to Quinn (${line.quinnProposed})`;
    case 'draft-forecast': return `Open row to confirm`;
  }
}

function applyPrimaryAction(line: PlanLine, reason: FocusReason, onSetPlanned: (id: string, n: number) => void) {
  switch (reason) {
    case 'stockcap':
      if (line.stockCap) onSetPlanned(line.item.id, line.stockCap.cap);
      return;
    case 'assembly-short':
      if (line.assemblyDemand.totalUnits > line.planned) {
        onSetPlanned(line.item.id, line.assemblyDemand.totalUnits);
      }
      return;
    case 'override':
      onSetPlanned(line.item.id, line.quinnProposed);
      return;
    case 'draft-forecast':
      // No mutating action — confirming a forecast is still a row-level
      // workflow; primary "Apply" is a no-op and the card relies on
      // "Open row" to take the manager there.
      return;
  }
}

function isResolved(line: PlanLine, reason: FocusReason): boolean {
  switch (reason) {
    case 'stockcap': return !line.stockCap || line.effectivePlanned <= line.stockCap.cap;
    case 'assembly-short': return line.assemblyDemand.totalUnits <= line.planned;
    case 'override': {
      const base = line.quinnProposed || 1;
      return Math.abs(line.planned - line.quinnProposed) / base < 0.25;
    }
    case 'draft-forecast': return line.forecast?.status !== 'draft';
  }
}

function canBatchApply(reason: FocusReason): boolean {
  return reason !== 'draft-forecast';
}

function formatStockUnits(qty: number, unit: string): string {
  if (unit === 'g') {
    return qty >= 1000 ? `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 1)}kg` : `${qty}g`;
  }
  if (unit === 'ml') {
    return qty >= 1000 ? `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 1)}L` : `${qty}ml`;
  }
  return `${qty}`;
}

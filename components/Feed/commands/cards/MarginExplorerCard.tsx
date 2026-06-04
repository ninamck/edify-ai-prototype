'use client';

/**
 * MarginExplorerCard — the wizard step that answers "what should I
 * price this at?".
 *
 * Driven by a `RecipeWizardTemplate` plus a target COGS%, the card
 * stacks four sections so an operator can move from cost build-up
 * to a defensible per-channel price in one read:
 *
 *   1. Ingredient roll-up (line cost + provenance per row)
 *   2. Target COGS picker + COGS ladder (price at 20/25/30/35%)
 *   3. Per-channel suggested price (dine in / takeaway / delivery)
 *   4. AI substitution nudges (swap to a cheaper alternative)
 *
 * Stateless rendering — the parent (Feed wizard) owns the target
 * and selected swaps, so going Back to the recipe-card editor and
 * coming forwards again replays cleanly.
 */

import { useMemo } from 'react';
import { ChefHat, ArrowRight } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import {
  applySwaps,
  deliveryNet,
  effectiveCogsPct,
  lineCostP,
  penceToPounds,
  srpExVatForCogs,
  srpIncVat,
  totalFoodCostP,
  type RecipeWizardTemplate,
  type TemplateIngredient,
} from '@/components/Feed/recipeWizardTemplates';

interface MarginExplorerCardProps {
  template: RecipeWizardTemplate;
  /** Whole-percent target (e.g. 25 means 25%). */
  targetCogsPct: number;
  /** ingredientId → swapId. Missing keys = no swap on that row. */
  selectedSwaps: Record<string, string>;
  /** Optional override of the template ingredients — used by the
   *  wizard when the user has edited the qty on the recipe-card
   *  editor before reaching this step. Falls back to template
   *  ingredients when absent. */
  liveIngredients?: TemplateIngredient[];
  /** When true, the picker + swap chips are disabled (after the
   *  user has confirmed and moved past this step). */
  locked?: boolean;
  onTargetChange: (pct: number) => void;
  onSwap: (ingredientId: string, swapId: string | null) => void;
  onConfirm: () => void;
}

const DELIVERY_COMMISSION_PCT = 30;
const COGS_PRESET_OPTIONS = [20, 25, 30, 35];

export default function MarginExplorerCard({
  template,
  targetCogsPct,
  selectedSwaps,
  liveIngredients,
  locked,
  onTargetChange,
  onSwap,
  onConfirm,
}: MarginExplorerCardProps) {
  // ── Resolve ingredient list with any applied swaps ────────────
  const resolved = useMemo<TemplateIngredient[]>(() => {
    const baseRows = liveIngredients ?? template.ingredients;
    // Re-apply swaps against the (possibly qty-edited) live rows
    // so the user's edits flow through to the cost numbers.
    return baseRows.map((row) => {
      const swapId = selectedSwaps[row.id];
      const original = template.ingredients.find((i) => i.id === row.id);
      if (!swapId || !original?.swaps) return row;
      const swap = original.swaps.find((s) => s.id === swapId);
      if (!swap) return row;
      return {
        ...row,
        name: swap.name,
        source: swap.source,
        unitCostP: swap.unitCostP,
      };
    });
  }, [template, selectedSwaps, liveIngredients]);

  const baselineRows = useMemo(() => applySwaps(template, {}), [template]);

  // ── Totals + ladder rungs ─────────────────────────────────────
  const totalCostP = totalFoodCostP(resolved);
  const totalCostGBP = penceToPounds(totalCostP);
  const baselineCostP = totalFoodCostP(baselineRows);
  const baselineCostGBP = penceToPounds(baselineCostP);

  const ladderRungs = useMemo(() => buildLadder(targetCogsPct), [targetCogsPct]);
  const srpExAtTarget = srpExVatForCogs(totalCostP, targetCogsPct);
  const vatPct = template.vatHot ? 20 : 0;

  // ── AI substitution nudges (ranked by £ saved on this recipe) ─
  const swapSuggestions = useMemo(() => {
    return buildSwapSuggestions(template, resolved, selectedSwaps);
  }, [template, resolved, selectedSwaps]);

  const projectedWeeklyGP = (() => {
    if (srpExAtTarget <= 0) return 0;
    const grossProfit = srpExAtTarget - totalCostGBP;
    return Math.round(grossProfit * template.servesPerDay * 7);
  })();

  return (
    <div
      style={{
        marginTop: '8px',
        borderRadius: '10px',
        border: '1px solid var(--color-border-subtle)',
        overflow: 'hidden',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Header ── recipe name + serves + on-target badge ────── */}
      <div
        style={{
          padding: '10px 14px',
          background: 'var(--color-bg-hover)',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <ChefHat size={14} color="var(--color-accent-active)" strokeWidth={2} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Cost & Margin · {template.name}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: '2px' }}>
          · Serves {template.yieldQty}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '12px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '100px',
            background: 'rgba(40,175,201,0.10)',
            color: 'var(--color-accent-deep)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          Target {targetCogsPct}%
        </span>
      </div>

      {/* 1. Ingredient roll-up ───────────────────────────────── */}
      {resolved.map((row, i) => {
        const lineP = lineCostP(row.qty, row.unitCostP);
        const swapped = !!selectedSwaps[row.id];
        return (
          <div
            key={row.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              gap: '8px',
              alignItems: 'center',
              padding: '7px 14px',
              borderBottom: i < resolved.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{row.name}</span>
                {swapped && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                      padding: '1px 6px',
                      borderRadius: '100px',
                      color: 'var(--color-accent-deep)',
                      background: 'rgba(40,175,201,0.12)',
                    }}
                  >
                    <EdifyMark size={9} color="var(--color-accent-deep)" /> Swapped
                  </span>
                )}
              </div>
              <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
                {row.source}
              </div>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', minWidth: '52px', textAlign: 'right' }}>
              {row.toTaste ? 'to taste' : `${formatQty(row.qty)}${row.uom}`}
            </span>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', minWidth: '52px', textAlign: 'right' }}>
              £{penceToPounds(lineP).toFixed(2)}
            </span>
          </div>
        );
      })}

      {/* Total food cost ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '9px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'rgba(0, 28, 53, 0.02)',
        }}
      >
        <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Food Cost
        </span>
        {totalCostP < baselineCostP && (
          <span
            style={{
              marginRight: '10px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-accent-deep)',
            }}
          >
            −£{(baselineCostGBP - totalCostGBP).toFixed(2)} vs baseline
          </span>
        )}
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          £{totalCostGBP.toFixed(2)}
        </span>
      </div>

      {/* 2. Target COGS picker + ladder ───────────────────────── */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--color-text-secondary)',
            }}
          >
            Target food cost %
          </span>
          <CustomTargetInput
            value={targetCogsPct}
            disabled={!!locked}
            onChange={onTargetChange}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {COGS_PRESET_OPTIONS.map((pct) => {
            const active = pct === targetCogsPct;
            return (
              <button
                key={pct}
                type="button"
                disabled={locked}
                onClick={() => onTargetChange(pct)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '100px',
                  border: active
                    ? '1.5px solid var(--color-accent-active)'
                    : '1.5px solid var(--color-border)',
                  background: active ? 'var(--color-accent-active)' : '#fff',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: locked ? 'not-allowed' : 'pointer',
                }}
              >
                {pct}%
              </button>
            );
          })}
        </div>

        {/* Ladder */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {ladderRungs.map((pct) => {
            const srp = srpExVatForCogs(totalCostP, pct);
            const gp = Math.max(0, srp - totalCostGBP);
            const isTarget = pct === targetCogsPct;
            return (
              <button
                key={pct}
                type="button"
                disabled={locked}
                onClick={() => onTargetChange(pct)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: isTarget
                    ? '1.5px solid var(--color-accent-active)'
                    : '1px solid var(--color-border-subtle)',
                  background: isTarget ? 'rgba(40,175,201,0.08)' : '#fff',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                <div
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: isTarget ? 'var(--color-accent-deep)' : 'var(--color-text-muted)',
                  }}
                >
                  {pct}% COGS
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                  £{srp.toFixed(2)}
                </div>
                <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
                  GP £{gp.toFixed(2)}
                </div>
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', margin: '8px 0 0', lineHeight: 1.4 }}>
          SRP ex VAT to land each food-cost target. Highlighted rung is your pick — tap another to switch the per-channel suggestions below.
        </p>
      </div>

      {/* 3. Per-channel suggested price ───────────────────────── */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
            marginBottom: '6px',
          }}
        >
          Suggested price · per channel at {targetCogsPct}% COGS
        </div>
        <ChannelRow
          label="Dine in"
          srpEx={srpExAtTarget}
          vatPct={vatPct}
          subtitle={template.vatHot ? 'Hot food · 20% VAT' : 'Cold eat-in · 20% VAT*'}
        />
        <ChannelRow
          label="Takeaway"
          srpEx={srpExAtTarget}
          vatPct={template.vatHot ? 20 : 0}
          subtitle={template.vatHot ? 'Hot takeaway · 20% VAT' : 'Cold takeaway · zero-rated'}
        />
        <ChannelRow
          label="Delivery"
          srpEx={srpExAtTarget}
          vatPct={20}
          commissionPct={DELIVERY_COMMISSION_PCT}
          subtitle={`Delivery platform · ${DELIVERY_COMMISSION_PCT}% commission`}
          totalCostGBP={totalCostGBP}
        />
        <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', margin: '8px 0 0', lineHeight: 1.4 }}>
          {template.vatHot
            ? 'Hot served food is VAT-rated at 20% across all UK channels.'
            : '* HMRC treats cold eat-in as standard-rated; cold takeaway is zero-rated.'}
        </p>
      </div>

      {/* 4. Substitution nudges ──────────────────────────────── */}
      {swapSuggestions.length > 0 && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--color-text-secondary)',
              marginBottom: '6px',
            }}
          >
            <EdifyMark size={11} color="var(--color-accent-deep)" />
            Cheaper swaps Edify spotted
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {swapSuggestions.map((sugg) => {
              const isActive = selectedSwaps[sugg.ingredientId] === sugg.swap.id;
              return (
                <button
                  key={`${sugg.ingredientId}:${sugg.swap.id}`}
                  type="button"
                  disabled={locked}
                  onClick={() => onSwap(sugg.ingredientId, isActive ? null : sugg.swap.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: isActive
                      ? '1.5px solid var(--color-accent-active)'
                      : '1px solid var(--color-border-subtle)',
                    background: isActive ? 'rgba(40,175,201,0.06)' : '#fff',
                    cursor: locked ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--font-primary)',
                    width: '100%',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        Swap {sugg.fromName}
                      </span>
                      <ArrowRight size={11} color="var(--color-text-muted)" strokeWidth={2} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-accent-deep)' }}>
                        {sugg.swap.name}
                      </span>
                    </div>
                    {sugg.swap.note && (
                      <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                        {sugg.swap.note}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      minWidth: '88px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: sugg.savingGBP > 0 ? 'var(--color-accent-deep)' : 'var(--color-text-muted)',
                      }}
                    >
                      −£{sugg.savingGBP.toFixed(2)}
                    </span>
                    <span style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
                      price → £{sugg.newSrpExAtTarget.toFixed(2)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer summary + confirm action ─────────────────────── */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 10px',
            borderRadius: '8px',
            background: 'rgba(40,175,201,0.06)',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            At £{srpExAtTarget.toFixed(2)} dine in, your food cost is {effectiveCogsPct(totalCostP, srpExAtTarget)}%.
          </span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
            {Object.keys(selectedSwaps).length > 0
              ? `${Object.keys(selectedSwaps).length} swap${Object.keys(selectedSwaps).length === 1 ? '' : 's'} applied`
              : 'Baseline costs'}
          </span>
        </div>
        <div
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            background: 'rgba(3,105,161,0.05)',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--color-info)' }}>Projected weekly:</span>{' '}
          At ~{template.servesPerDay} serves/day, that&apos;s{' '}
          <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>£{projectedWeeklyGP}</span>{' '}
          gross profit/week from this item alone.
        </div>
        {!locked && (
          <button
            type="button"
            onClick={onConfirm}
            style={{
              alignSelf: 'flex-end',
              padding: '8px 18px',
              borderRadius: '100px',
              border: 'none',
              background: 'var(--color-accent-active)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(34,68,68,0.25)',
            }}
          >
            Lock in £{srpExAtTarget.toFixed(2)}
          </button>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────

function ChannelRow({
  label,
  srpEx,
  vatPct,
  subtitle,
  commissionPct,
  totalCostGBP,
}: {
  label: string;
  srpEx: number;
  vatPct: number;
  subtitle: string;
  commissionPct?: number;
  /** Required when `commissionPct` is set, so we can show net margin. */
  totalCostGBP?: number;
}) {
  const inc = srpIncVat(srpEx, vatPct);
  const net = commissionPct !== undefined ? deliveryNet(inc, commissionPct) : inc;
  const cost = totalCostGBP ?? 0;
  const operatorMargin =
    commissionPct !== undefined && net > 0
      ? Math.round(((net - cost) / net) * 100)
      : null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '8px',
        alignItems: 'center',
        padding: '6px 0',
        borderTop: '1px solid rgba(0,28,53,0.05)',
      }}
    >
      <div>
        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {label}
        </div>
        <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
          {subtitle}
          {operatorMargin !== null && ` · operator margin ${operatorMargin}%`}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          £{inc.toFixed(2)}
        </div>
        <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
          {vatPct > 0 ? `inc ${vatPct}% VAT` : 'no VAT'}
          {commissionPct !== undefined && ` · net £${net.toFixed(2)}`}
        </div>
      </div>
    </div>
  );
}

function CustomTargetInput({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (pct: number) => void;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '8px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
      }}
    >
      <input
        type="number"
        min={5}
        max={95}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!Number.isFinite(next)) return;
          onChange(Math.max(5, Math.min(95, Math.round(next))));
        }}
        style={{
          width: '40px',
          border: 'none',
          outline: 'none',
          fontSize: '12px',
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-primary)',
          textAlign: 'right',
          background: 'transparent',
        }}
      />
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>%</span>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

/** Build a four-rung COGS ladder bracketing the target. The target
 *  is always included; the other three sit at ±5% steps around it,
 *  clamped to a sensible 10–60% band. */
function buildLadder(target: number): number[] {
  const candidates = [
    Math.max(10, target - 5),
    target,
    target + 5,
    target + 10,
  ];
  const deduped = Array.from(new Set(candidates)).sort((a, b) => a - b);
  while (deduped.length < 4) {
    deduped.push(deduped[deduped.length - 1] + 5);
  }
  return deduped.slice(0, 4);
}

interface SwapSuggestion {
  ingredientId: string;
  fromName: string;
  swap: NonNullable<TemplateIngredient['swaps']>[number];
  savingGBP: number;
  newSrpExAtTarget: number;
}

/**
 * For each ingredient that has swap candidates, surface the
 * cheapest candidate (or all of them, ranked by saving). We
 * recompute the recipe total assuming this swap is the only
 * change vs the currently-resolved rows — keeps each chip's
 * numbers independent so the user can stack them mentally.
 */
function buildSwapSuggestions(
  template: RecipeWizardTemplate,
  resolvedRows: TemplateIngredient[],
  selectedSwaps: Record<string, string>,
): SwapSuggestion[] {
  const suggestions: SwapSuggestion[] = [];
  const baselineP = totalFoodCostP(resolvedRows);

  for (const original of template.ingredients) {
    if (!original.swaps?.length) continue;
    const currentRow = resolvedRows.find((r) => r.id === original.id);
    if (!currentRow) continue;
    const activeSwapId = selectedSwaps[original.id];
    for (const swap of original.swaps) {
      const isActive = activeSwapId === swap.id;
      // Skip swaps that wouldn't save anything vs the current row,
      // unless they're already active (we still want to show the
      // chip so the user can un-toggle).
      if (!isActive && swap.unitCostP >= currentRow.unitCostP) continue;
      // Project the total cost with just this swap in place
      // (overriding any current swap on this row).
      const projectedRows = resolvedRows.map((r) =>
        r.id === original.id
          ? { ...r, unitCostP: swap.unitCostP, name: swap.name, source: swap.source }
          : r,
      );
      const projectedP = totalFoodCostP(projectedRows);
      const savingP = baselineP - projectedP;
      const savingGBP = Math.max(0, penceToPounds(savingP));
      const newSrpExAtTarget = srpExVatForCogs(projectedP, template.defaultTargetCogsPct);
      suggestions.push({
        ingredientId: original.id,
        fromName: currentRow.name,
        swap,
        savingGBP,
        newSrpExAtTarget,
      });
    }
  }

  return suggestions.sort((a, b) => b.savingGBP - a.savingGBP);
}

function formatQty(qty: number): string {
  if (Number.isInteger(qty)) return String(qty);
  // Strip trailing zeros after rounding to 2dp for the display.
  return Number(qty.toFixed(2)).toString();
}

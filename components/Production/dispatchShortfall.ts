// ─────────────────────────────────────────────────────────────────────────────
// Dispatch shortfall reallocation — strategies + helpers
//
// When a hub is short on a recipe at dispatch time, this module is the
// shared maths layer that turns "we promised 38, we have 28" into a
// concrete per-spoke suggestion. Two strategies for v1:
//
//   demand-led  — weight each spoke by recent sell-through × requested
//                 units, then proportionally allocate the available
//                 supply. Spokes wasting more lose more. Default.
//
//   pro-rata    — everyone takes the same percentage cut. Naive but
//                 defensible; useful when sell-through data is thin.
//
// The third strategy the modal exposes — `manual` — isn't computed here.
// It's just "show the demand-led suggestion as the starting point and
// let the manager drag every row themselves".
//
// The output shape (`AllocationRow[]`) is intentionally stable across
// strategies: same fields, same row count, same order. The modal can
// re-render diff-style when the strategy switches.
// ─────────────────────────────────────────────────────────────────────────────

import {
  spokeSellThrough,
  type ShortfallReason,
  type SiteId,
  type SkuId,
} from './fixtures';

export type AllocationStrategy = 'demand-led' | 'pro-rata' | 'manual';

/**
 * One spoke's slice of a recipe's reallocation. The modal renders this
 * shape directly: Requested · Suggested · Δ · Reason.
 */
export type AllocationRow = {
  spokeId: SiteId;
  /** What the spoke originally asked for (confirmed or Quinn-proposed). */
  requested: number;
  /** What we're proposing they receive after the shortfall cut. */
  suggested: number;
  /** suggested − requested (always ≤ 0 unless the manager overrides upward). */
  delta: number;
  /**
   * Why this row is being cut. Set to a sensible default per-strategy
   * (`lower-sell-through` for demand-led, `hub-balancing` for pro-rata,
   * `manager-discretion` for manual). The manager can change it per row.
   */
  reason: ShortfallReason;
};

/**
 * One spoke's input to the allocator. Encodes "this spoke is asking for
 * N units of this SKU"; sell-through is looked up by the helper so
 * callers don't have to wire it through. Pass the same array shape
 * regardless of strategy.
 */
export type AllocationInput = {
  spokeId: SiteId;
  skuId: SkuId;
  requested: number;
};

/**
 * Compute a per-spoke suggested allocation given a strategy and the
 * recipe's available supply. Suggested totals are guaranteed to be
 * ≤ availableSupply; individual rows are guaranteed to be 0..requested.
 *
 * Rounding: each row's "raw" share is computed as a float, floored to
 * a whole unit, and the remainder is distributed to the spokes with the
 * largest fractional remainders. This keeps the totals exact and is
 * stable across re-renders (no jitter when the modal re-computes).
 */
export function computeAllocation(
  strategy: AllocationStrategy,
  inputs: AllocationInput[],
  availableSupply: number,
): AllocationRow[] {
  if (inputs.length === 0) return [];

  const totalRequested = inputs.reduce((s, i) => s + i.requested, 0);
  // No shortfall? Everyone keeps their full request. We still emit rows
  // so the modal has something to render — `delta` will be 0 across the
  // board. Reason is set but moot.
  if (totalRequested <= availableSupply) {
    return inputs.map(i => ({
      spokeId: i.spokeId,
      requested: i.requested,
      suggested: i.requested,
      delta: 0,
      reason: defaultReasonFor(strategy),
    }));
  }

  // Manual = seed with demand-led as the starting point so the manager
  // has a reasonable baseline to drag from. Reason flips to discretion
  // so the spoke-visible label reads honestly.
  if (strategy === 'manual') {
    return computeDemandLed(inputs, availableSupply).map(row => ({
      ...row,
      reason: 'manager-discretion',
    }));
  }

  if (strategy === 'pro-rata') return computeProRata(inputs, availableSupply);
  return computeDemandLed(inputs, availableSupply);
}

function defaultReasonFor(strategy: AllocationStrategy): ShortfallReason {
  if (strategy === 'demand-led') return 'lower-sell-through';
  if (strategy === 'pro-rata') return 'hub-balancing';
  return 'manager-discretion';
}

/**
 * Demand-led: weight = sellThrough × requested (clamped so high sell-
 * through gets MORE supply protected, low sell-through gets cut first).
 * We compute each spoke's share of the protected supply rather than the
 * shortfall — it generalises cleanly when supply is much less than half
 * of demand, and the rounding pass at the end keeps totals exact.
 */
function computeDemandLed(
  inputs: AllocationInput[],
  availableSupply: number,
): AllocationRow[] {
  // Weight every spoke. The score for a (spoke, sku) is bounded 0.1..1
  // by `spokeSellThrough`, so weights are always positive.
  const weighted = inputs.map(i => {
    const score = spokeSellThrough(i.spokeId, i.skuId);
    return { ...i, weight: score * i.requested, score };
  });
  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);

  // Raw float share, then floor + remainder pass to reconcile to supply.
  const raw = weighted.map(w => {
    const share = totalWeight > 0 ? (w.weight / totalWeight) * availableSupply : 0;
    // Never propose more than what the spoke asked for — the cap matters
    // when sell-through is wildly imbalanced (e.g. one spoke at 0.95 vs
    // two at 0.2). Reasonable supply should still flow to the strong
    // performer up to their request; the rest pools to the others.
    return { ...w, share: Math.min(w.requested, share) };
  });

  return reconcileRows(raw, availableSupply, /*strategy*/ 'demand-led');
}

/** Pro-rata: same percentage cut applied to everyone. */
function computeProRata(
  inputs: AllocationInput[],
  availableSupply: number,
): AllocationRow[] {
  const totalRequested = inputs.reduce((s, i) => s + i.requested, 0);
  const ratio = totalRequested > 0 ? availableSupply / totalRequested : 0;
  const raw = inputs.map(i => ({ ...i, share: i.requested * ratio, score: 0, weight: 0 }));
  return reconcileRows(raw, availableSupply, 'pro-rata');
}

/**
 * Convert float "share" values into whole-unit suggestions that sum to
 * exactly `availableSupply`. Each row gets floor(share); leftover units
 * are distributed one-at-a-time to the rows with the largest fractional
 * remainder, then (if there are still leftovers and someone could
 * accept more) to the rows furthest below their request. The tie-break
 * is stable on spokeId so the modal doesn't reshuffle on every render.
 */
function reconcileRows(
  raw: Array<AllocationInput & { share: number }>,
  availableSupply: number,
  strategy: AllocationStrategy,
): AllocationRow[] {
  const floored = raw.map(r => ({
    ...r,
    floor: Math.floor(r.share),
    frac: r.share - Math.floor(r.share),
  }));

  let assigned = floored.reduce((s, r) => s + r.floor, 0);
  let remaining = Math.max(0, availableSupply - assigned);

  // Pass 1 — hand out remainders by fractional descending.
  const byFrac = [...floored].sort((a, b) => {
    if (b.frac !== a.frac) return b.frac - a.frac;
    return a.spokeId.localeCompare(b.spokeId);
  });
  for (const r of byFrac) {
    if (remaining <= 0) break;
    if (r.floor < r.requested) {
      r.floor += 1;
      remaining -= 1;
      assigned += 1;
    }
  }

  // Pass 2 — if there are still leftovers (supply > demand, edge case
  // after the modal pushes someone above their request), pad the rows
  // with the smallest current allocation. Not expected in normal flow
  // but defensible.
  if (remaining > 0) {
    const byLowest = [...floored].sort(
      (a, b) => a.floor - b.floor || a.spokeId.localeCompare(b.spokeId),
    );
    for (const r of byLowest) {
      if (remaining <= 0) break;
      if (r.floor < r.requested) {
        r.floor += 1;
        remaining -= 1;
        assigned += 1;
      }
    }
  }

  return floored.map(r => ({
    spokeId: r.spokeId,
    requested: r.requested,
    suggested: r.floor,
    delta: r.floor - r.requested,
    reason: defaultReasonFor(strategy),
  }));
}

/**
 * Sum the proposed allocations. Useful for the modal's reconciliation
 * indicator ("Allocated 28 of 28 · Δ 0") and the gate that decides
 * whether the apply button is enabled.
 */
export function sumAllocated(rows: AllocationRow[]): number {
  return rows.reduce((s, r) => s + r.suggested, 0);
}

/**
 * Rebalance a row that's been manually edited so the total still matches
 * the available supply. We adjust the other rows proportionally to their
 * delta-room (requested − suggested), in the direction needed. Used by
 * the modal's drag-to-edit logic.
 *
 * `editedSpokeId` is the row the manager just changed; `newValue` is its
 * new target. The function clamps the edit to 0..requested, then
 * redistributes the gap across the remaining rows.
 */
export function rebalanceAfterEdit(
  rows: AllocationRow[],
  editedSpokeId: SiteId,
  newValue: number,
  availableSupply: number,
): AllocationRow[] {
  const next = rows.map(r => ({ ...r }));
  const target = next.find(r => r.spokeId === editedSpokeId);
  if (!target) return rows;

  // Clamp edit to a sane range.
  const clamped = Math.max(0, Math.min(target.requested, Math.round(newValue)));
  target.suggested = clamped;
  target.delta = clamped - target.requested;

  // Compute how far off we are from the supply, then push the gap into
  // the other rows. Positive `gap` = we need to give MORE to others;
  // negative = we need to take some BACK from others.
  const others = next.filter(r => r.spokeId !== editedSpokeId);
  let gap = availableSupply - next.reduce((s, r) => s + r.suggested, 0);

  // Pass 1 — when gap > 0 we hand units to rows that have headroom
  // (suggested < requested), prioritising those furthest below request.
  if (gap > 0) {
    const byRoomDesc = [...others].sort((a, b) => (b.requested - b.suggested) - (a.requested - a.suggested));
    for (const r of byRoomDesc) {
      while (gap > 0 && r.suggested < r.requested) {
        r.suggested += 1;
        r.delta = r.suggested - r.requested;
        gap -= 1;
      }
    }
  }

  // Pass 2 — when gap < 0 we pull units from rows that have something
  // to give (suggested > 0), prioritising the largest suggestions so
  // we don't strip an already-thin row.
  if (gap < 0) {
    const byLargestSuggestion = [...others].sort((a, b) => b.suggested - a.suggested);
    for (const r of byLargestSuggestion) {
      while (gap < 0 && r.suggested > 0) {
        r.suggested -= 1;
        r.delta = r.suggested - r.requested;
        gap += 1;
      }
    }
  }

  return next;
}

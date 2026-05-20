'use client';

/**
 * Item-matching override store.
 *
 * The day-to-day item matching page derives the "matched / unmatched / review"
 * state for each POS button from `Recipe.posSourceId`. That's enough for the
 * default case (POS button → recipe), but the page also needs to support:
 *
 *   • Matching a POS button to a Product (supplier SKU or made-in-house) or
 *     a MasterProduct — not just a recipe.
 *   • Soft-hiding rows (test buttons, retired items) so they drop off the
 *     default view but can still be revealed via a "Show hidden" toggle.
 *
 * Neither of those fit on `Recipe.posSourceId`, so we keep a tiny in-memory
 * override map keyed by POS item id. Mirrors the `useSyncExternalStore`
 * pattern from `components/Suppliers/store.ts`.
 *
 * State is intentionally not persisted — the rest of the prototype lives in
 * memory and is reset on reload.
 */

import { useSyncExternalStore } from 'react';

export type MatchTargetType = 'recipe' | 'product' | 'master-product';

export type MatchTarget = {
  type: MatchTargetType;
  id: string;
};

export type MatchOverride = {
  /** When set, this overrides the `Recipe.posSourceId`-derived target. */
  target?: MatchTarget;
  /** When true, row is soft-hidden from the default view. */
  hidden?: boolean;
};

type State = {
  overrides: Map<string, MatchOverride>;
};

let state: State = { overrides: new Map() };

const listeners = new Set<() => void>();
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
function notify() { for (const l of listeners) l(); }

const getOverrides = () => state.overrides;

export function useMatchOverrides(): Map<string, MatchOverride> {
  return useSyncExternalStore(subscribe, getOverrides, getOverrides);
}

function patch(posItemId: string, mut: (prev: MatchOverride) => MatchOverride): void {
  const next = new Map(state.overrides);
  const prev = next.get(posItemId) ?? {};
  const updated = mut(prev);
  if (!updated.target && !updated.hidden) {
    next.delete(posItemId);
  } else {
    next.set(posItemId, updated);
  }
  state = { overrides: next };
  notify();
}

export function setMatchTarget(posItemId: string, target: MatchTarget): void {
  patch(posItemId, (prev) => ({ ...prev, target }));
}

export function clearMatchTarget(posItemId: string): void {
  patch(posItemId, (prev) => ({ ...prev, target: undefined }));
}

export function setHidden(posItemId: string, hidden: boolean): void {
  patch(posItemId, (prev) => ({ ...prev, hidden: hidden || undefined }));
}

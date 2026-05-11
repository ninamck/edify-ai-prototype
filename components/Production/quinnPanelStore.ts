'use client';

import { useSyncExternalStore } from 'react';

// Module-level store for the Quinn production panel.
//
// The trigger button now lives in the page header (next to Demo controls)
// while the slide-out panel still renders at the bottom of the layout
// tree. Both need to share `open` (so clicking the header trigger toggles
// the same aside) and `dismissed` (so the header trigger's badge count
// matches the list of nudges actually visible inside the panel).
//
// We deliberately use a plain module store + `useSyncExternalStore`
// rather than a React context: nothing here depends on per-tree
// providers, the consumers live in different layout slots, and the
// alternative — a context provider wrapping the whole layout — would
// just add noise. State resets on hard reload, which matches every
// other prototype-only piece of demo state in this app.

let openState = false;
let dismissedState: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getOpenSnapshot(): boolean {
  return openState;
}

function getOpenServerSnapshot(): boolean {
  return false;
}

function getDismissedSnapshot(): ReadonlySet<string> {
  return dismissedState;
}

const EMPTY_DISMISSED: ReadonlySet<string> = new Set();

function getDismissedServerSnapshot(): ReadonlySet<string> {
  return EMPTY_DISMISSED;
}

export function setQuinnOpen(value: boolean): void {
  if (openState === value) return;
  openState = value;
  emit();
}

export function toggleQuinnOpen(): void {
  openState = !openState;
  emit();
}

export function dismissQuinnNudge(id: string): void {
  if (dismissedState.has(id)) return;
  const next = new Set(dismissedState);
  next.add(id);
  dismissedState = next;
  emit();
}

export function useQuinnOpen(): boolean {
  return useSyncExternalStore(subscribe, getOpenSnapshot, getOpenServerSnapshot);
}

export function useQuinnDismissed(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getDismissedSnapshot, getDismissedServerSnapshot);
}

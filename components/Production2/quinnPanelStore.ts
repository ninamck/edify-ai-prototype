'use client';

import { useSyncExternalStore } from 'react';

// Module-level store for the Prod 2.0 Quinn production panel — sibling
// of `components/Production/quinnPanelStore.ts`. Kept deliberately
// separate so v1 and v2 don't share `open` or dismissal state: a
// manager toggling Quinn on /production shouldn't auto-open the panel
// after they switch to /prod-2/production, and item IDs may overlap
// between the two prototype variants.
//
// Same shape as the v1 store: a tiny module store + `useSyncExternalStore`
// rather than a React context, since the trigger lives in the page
// header and the panel mounts at the bottom of the layout body — wiring
// a provider around the whole tree would just be noise.

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

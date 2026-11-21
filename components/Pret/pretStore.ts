'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Saved walkthrough state shared across screens. A forecast change made on
 * /forecast has to show on the Spoke order and the Hub plan, and a count
 * started from an order has to come back to it, so these live in
 * localStorage rather than page state. "Reset walkthrough" in demo controls
 * clears the lot.
 */

const PREFIX = 'edify.pret.';
const listeners = new Set<() => void>();
const cache = new Map<string, unknown>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith(PREFIX)) {
      cache.delete(e.key.slice(PREFIX.length));
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function read<T>(key: string, seed: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  let value = seed;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw !== null) value = JSON.parse(raw) as T;
  } catch {
    // Unreadable or blocked storage: fall back to the seed.
  }
  cache.set(key, value);
  return value;
}

export function writePretState<T>(key: string, value: T) {
  cache.set(key, value);
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the change still holds for this tab.
  }
  emit();
}

export function readPretState<T>(key: string, seed: T): T {
  if (typeof window === 'undefined') return seed;
  return read(key, seed);
}

export function usePretState<T>(key: string, seed: T): [T, (next: T | ((prev: T) => T)) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, seed),
    () => seed,
  );
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = read(key, seed);
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      writePretState(key, resolved);
    },
    [key, seed],
  );
  return [value, set];
}

/** Demo setup, not walkthrough changes: survives "Reset walkthrough". */
const KEEP_ON_RESET = new Set(['cash-audience']);

/** Clears every saved walkthrough change so the next session starts clean. */
export function resetPretWalkthrough() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX) && !KEEP_ON_RESET.has(k.slice(PREFIX.length))) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {
    // Nothing to clear.
  }
  cache.clear();
  emit();
}

/** On by default: hides demo shortcuts such as "skip to cutoff" while walking Pret through. */
export function useWalkthroughMode() {
  return usePretState<boolean>('walkthrough-mode', true);
}

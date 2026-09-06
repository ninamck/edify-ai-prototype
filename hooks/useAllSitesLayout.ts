'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { ALL_SITES_DEFAULT_LAYOUT, type DashboardLayoutEntry } from '@/components/Dashboard/layoutTypes';

// Layout for the "All sites" home tab. Kept apart from useDashboardLayout
// because that store is keyed by briefing role and this tab is the same for
// every persona. A tiny module-level store read through useSyncExternalStore:
// the server snapshot is the default layout, the client snapshot is whatever
// is in localStorage, so there is no setState-in-effect and no hydration
// mismatch.

const STORAGE_KEY = 'edify:allSitesLayout:v1';

let cached: DashboardLayoutEntry[] | null = null;
const listeners = new Set<() => void>();

function mergeWithDefaults(stored: DashboardLayoutEntry[]): DashboardLayoutEntry[] {
  const storedIds = new Set(stored.map((e) => e.id));
  const missing = ALL_SITES_DEFAULT_LAYOUT.filter((e) => !storedIds.has(e.id));
  return missing.length === 0 ? stored : [...stored, ...missing];
}

function readStorage(): DashboardLayoutEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return ALL_SITES_DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? mergeWithDefaults(parsed as DashboardLayoutEntry[]) : ALL_SITES_DEFAULT_LAYOUT;
  } catch {
    return ALL_SITES_DEFAULT_LAYOUT;
  }
}

function getSnapshot(): DashboardLayoutEntry[] {
  if (cached === null) cached = readStorage();
  return cached;
}

function getServerSnapshot(): DashboardLayoutEntry[] {
  return ALL_SITES_DEFAULT_LAYOUT;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function write(next: DashboardLayoutEntry[]) {
  cached = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode: the change just won't persist */
  }
  listeners.forEach((l) => l());
}

export function useAllSitesLayout() {
  const layout = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setLayout = useCallback((next: DashboardLayoutEntry[]) => write(next), []);
  return { layout, setLayout };
}

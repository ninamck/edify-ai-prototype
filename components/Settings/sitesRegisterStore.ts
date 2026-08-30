'use client';

/**
 * sitesRegisterStore — in-session writable layer over the static
 * DIRECTORY_SITES fixture, so flows that create sites (the Command
 * Centre site-setup wizard) surface them on /settings/sites with an
 * editable row like everything else.
 *
 * No persistence — module-level array, lost on hard reload. Matches
 * every other prototype store.
 */

import { useSyncExternalStore } from 'react';
import { DIRECTORY_SITES, type DirectorySite } from './companyDirectory';

export interface RegisterSite extends DirectorySite {
  /** Optional status override for rows that aren't simply active /
   *  inactive — e.g. "Opening 22 September" for a site set up ahead
   *  of its go-live date. */
  statusLabel?: string;
}

let SITES: RegisterSite[] = [...DIRECTORY_SITES];
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function subscribeSites(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function getSites(): RegisterSite[] {
  return SITES;
}

export function addSites(sites: RegisterSite[]): void {
  const existing = new Set(SITES.map((s) => s.id));
  const additions = sites.filter((s) => !existing.has(s.id));
  if (additions.length === 0) return;
  SITES = [...additions, ...SITES];
  notify();
}

export function removeSites(ids: string[]): void {
  const drop = new Set(ids);
  const next = SITES.filter((s) => !drop.has(s.id));
  if (next.length === SITES.length) return;
  SITES = next;
  notify();
}

/** React hook — re-renders on register changes. */
export function useSitesRegister(): RegisterSite[] {
  return useSyncExternalStore(subscribeSites, getSites, getSites);
}

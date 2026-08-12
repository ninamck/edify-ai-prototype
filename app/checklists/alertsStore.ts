'use client';

/**
 * Alert routing settings — which roles get emailed when an audit
 * question fails, per severity. Configured per company as role
 * mappings (not hard-coded addresses: sites and people change).
 *
 * localStorage-backed like the other prototype stores. Actual email
 * delivery is out of scope; the settings page shows a preview of what
 * the email would contain.
 */

import { useSyncExternalStore } from 'react';
import { getSiteTeam } from './mockData';
import type { Severity } from './types';

const STORAGE_KEY = 'edify:alertRouting:v1';

/** Role keys that can receive alerts. Site-scoped roles resolve to the
 *  actual person at the failed audit's site. */
export type AlertRole =
  | 'head_of_franchise'
  | 'brand_ops'
  | 'area_manager'
  | 'outlet_manager'
  | 'store_account';

export const ALERT_ROLE_LABELS: Record<AlertRole, string> = {
  head_of_franchise: 'Head of franchise',
  brand_ops: 'Brand ops',
  area_manager: 'Area manager',
  outlet_manager: 'Site manager (that site)',
  store_account: 'Store account (that site)',
};

/** Demo people behind the company-level roles. */
const COMPANY_ROLE_PEOPLE: Record<'head_of_franchise' | 'brand_ops' | 'area_manager', string> = {
  head_of_franchise: 'Ryan Calder',
  brand_ops: 'Mel Okafor',
  area_manager: 'Dana Whitfield',
};

export type AlertRouting = Record<Severity, AlertRole[]>;

export const DEFAULT_ROUTING: AlertRouting = {
  critical: ['head_of_franchise', 'brand_ops', 'outlet_manager'],
  medium: ['outlet_manager', 'area_manager'],
  low: [],
};

// ── State + persistence ─────────────────────────────────────────────

let ROUTING: AlertRouting = DEFAULT_ROUTING;
let hydrated = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function hydrate(): void {
  if (hydrated || !isBrowser()) return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Array.isArray(parsed.critical) &&
      Array.isArray(parsed.medium) &&
      Array.isArray(parsed.low)
    ) {
      ROUTING = parsed;
    }
  } catch {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }
}

function persist(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ROUTING));
  } catch { /* in-memory still works */ }
}

// ── Subscription ────────────────────────────────────────────────────

const listeners = new Set<() => void>();

export function subscribeAlertRouting(l: () => void): () => void {
  hydrate();
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function getAlertRouting(): AlertRouting {
  hydrate();
  return ROUTING;
}

/** React hook — SSR-safe (server snapshot is the default mapping). */
export function useAlertRouting(): AlertRouting {
  return useSyncExternalStore(subscribeAlertRouting, getAlertRouting, () => DEFAULT_ROUTING);
}

export function setAlertRouting(severity: Severity, roles: AlertRole[]): void {
  hydrate();
  ROUTING = { ...ROUTING, [severity]: roles };
  persist();
  for (const l of listeners) l();
}

// ── Resolution ──────────────────────────────────────────────────────

/** Resolve a severity's role list to actual people for a given site. */
export function resolveRecipients(
  routing: AlertRouting,
  severity: Severity,
  site: string,
): string[] {
  return routing[severity].map((role) => {
    if (role === 'outlet_manager') return `${getSiteTeam(site).outletManager} (Site manager, ${site})`;
    if (role === 'store_account') return getSiteTeam(site).storeAccount;
    return `${COMPANY_ROLE_PEOPLE[role]} (${ALERT_ROLE_LABELS[role]})`;
  });
}

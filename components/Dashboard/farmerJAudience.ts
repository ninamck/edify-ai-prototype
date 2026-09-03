'use client';

/**
 * Who can see each Farmer J dashboard view. Same shape as the roles-model
 * audiences (role at sites, never named people) so the shared PublishDialog
 * drives it, but the estate is Farmer J's shops and the choice lives in its
 * own localStorage key, one entry per view.
 *
 * `null` means private: only the person looking at it. There is no second
 * persona on the Farmer J demo to enforce against, so the summary line and
 * the dialog carry the story rather than hiding tabs.
 */

import { useSyncExternalStore } from 'react';
import type { Audience, DemoDashboard } from '@/components/Dashboard/permissions/model';
import type { Site, Viewer } from '@/components/Dashboard/permissions/sites';
import { FJ_SHOPS } from '@/components/Production/farmerj/shops';

export type FjDashboardView = 'sales' | 'production';

export type FjAudiences = Record<FjDashboardView, Audience | null>;

const STORAGE_KEY = 'edify:fjDashboardAudience:v1';

export const FJ_VIEW_NAMES: Record<FjDashboardView, string> = {
  sales: 'Sales',
  production: 'Production',
};

/** Farmer J's shops in the shape the audience picker expects. */
export const FJ_AUDIENCE_SITES: Site[] = FJ_SHOPS.map(s => ({ id: s.id, name: s.name }));

/** Jana publishes: ops lead over every shop, so every shop is tickable. */
export const FJ_PUBLISHER: Viewer = {
  personaId: 'cheryl',
  role: 'admin',
  name: 'Jana',
  siteIds: FJ_SHOPS.map(s => s.id),
};

const EMPTY: FjAudiences = { sales: null, production: null };

function isAudience(v: unknown): v is Audience {
  if (!v || typeof v !== 'object') return false;
  const a = v as { roles?: unknown; siteIds?: unknown };
  return Array.isArray(a.roles) && Array.isArray(a.siteIds);
}

function loadFjAudiences(): FjAudiences {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Record<FjDashboardView, unknown>>;
    return {
      sales: isAudience(parsed.sales) ? parsed.sales : null,
      production: isAudience(parsed.production) ? parsed.production : null,
    };
  } catch {
    return EMPTY;
  }
}

function persistFjAudiences(next: FjAudiences) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
}

// Module-level store with useSyncExternalStore (same pattern as the roles
// dashboardStore). The server snapshot is always "private"; the client reads
// localStorage the first time a snapshot is asked for.
let audiences: FjAudiences = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): FjAudiences {
  if (!hydrated && typeof window !== 'undefined') {
    hydrated = true;
    audiences = loadFjAudiences();
  }
  return audiences;
}

function getServerSnapshot(): FjAudiences {
  return EMPTY;
}

export function useFjAudiences(): FjAudiences {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setFjAudience(view: FjDashboardView, audience: Audience | null) {
  audiences = { ...getSnapshot(), [view]: audience };
  persistFjAudiences(audiences);
  for (const l of listeners) l();
}

/** Synthetic dashboard so the shared dialog can title itself and read the
 *  current audience. Kind 'published' so `null` reads as a draft. */
export function fjDashboardStub(view: FjDashboardView, audience: Audience | null): DemoDashboard {
  return {
    id: `fj-${view}`,
    kind: 'published',
    name: `${FJ_VIEW_NAMES[view]} dashboard`,
    owner: 'cheryl',
    audience,
    insights: [],
  };
}

const ROLE_PLURAL: Record<Audience['roles'][number], string> = {
  manager: 'managers',
  employee: 'employees',
};

/** Header line under the title: who can see this view. Long shop lists are
 *  cut to the first two names and a count so the line stays one line. */
export function fjAudienceSummary(audience: Audience | null): string {
  if (!audience || audience.roles.length === 0 || audience.siteIds.length === 0) {
    return 'Only you can see this dashboard.';
  }
  const roles = audience.roles.map(r => ROLE_PLURAL[r]).join(' and ');
  const names = FJ_AUDIENCE_SITES.filter(s => audience.siteIds.includes(s.id)).map(s => s.name);
  let where: string;
  if (names.length >= FJ_AUDIENCE_SITES.length) where = `every shop`;
  else if (names.length <= 3) where = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  else where = `${names[0]}, ${names[1]} and ${names.length - 2} more shops`;
  return `Shared with all ${roles} at ${where}.`;
}

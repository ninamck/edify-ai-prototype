'use client';

// Shared client-side store for the mocked dashboards. Module-level state with
// useSyncExternalStore (same pattern as DemoControls/demoStore) so HomeShell
// and the dashboard surface stay in sync, persisted to localStorage.
//
// Storage starts from the seeds below; user changes are persisted and any
// seed dashboards the stored payload is missing are re-appended by id, so
// demo resets never require a manual localStorage wipe.

import { useSyncExternalStore } from 'react';
import { ALL_SITE_IDS, type RolesPersonaId, type SiteId } from './sites';
import { PERIOD_META, type Audience, type DashboardInsight, type DashboardPeriod, type DemoDashboard } from './model';

// v2: private dashboards renamed to their owner's name (no "Personal"
// wording) — bumping the key reseeds anyone with v1 state.
const STORAGE_KEY = 'edify:rolesDashboards:v2';

// ── Seeds ──────────────────────────────────────────────────────────────────

function insight(chartId: string, companyWide?: boolean): DashboardInsight {
  return { id: `${chartId}-${Math.random().toString(36).slice(2, 8)}`, chartId, companyWide };
}

/** Stable ids for seeded insights so re-seeding is deterministic. */
function seedInsight(id: string, chartId: string, companyWide?: boolean): DashboardInsight {
  return companyWide ? { id, chartId, companyWide } : { id, chartId };
}

const SEED_DASHBOARDS: DemoDashboard[] = [
  {
    id: 'personal-cheryl',
    kind: 'personal',
    name: 'Cheryl\u2019s dashboard',
    owner: 'cheryl',
    insights: [
      seedInsight('pc-1', 'scoped:sales-trend'),
      seedInsight('pc-2', 'scoped:gp-by-site'),
      seedInsight('pc-3', 'scoped:waste-by-site'),
    ],
  },
  {
    id: 'personal-ed',
    kind: 'personal',
    name: 'Ed\u2019s dashboard',
    owner: 'ed',
    insights: [
      seedInsight('pe-1', 'scoped:kpi-row'),
      seedInsight('pe-2', 'scoped:waste-by-site'),
      seedInsight('pe-3', 'scoped:sales-by-site'),
    ],
  },
  {
    id: 'company',
    kind: 'company',
    name: 'Company dashboard',
    owner: 'cheryl',
    insights: [
      seedInsight('co-1', 'scoped:million-milestone', true),
      seedInsight('co-2', 'scoped:kpi-row'),
      seedInsight('co-3', 'scoped:sales-trend'),
      seedInsight('co-4', 'scoped:sales-by-site'),
      seedInsight('co-5', 'scoped:waste-by-site'),
      seedInsight('co-6', 'scoped:labour-by-site'),
      seedInsight('co-7', 'scoped:gp-by-site'),
    ],
  },
  {
    id: 'pub-weekend',
    kind: 'published',
    name: 'Weekend trading',
    owner: 'cheryl',
    audience: { roles: ['manager'], siteIds: ['soho', 'borough'] },
    insights: [
      seedInsight('pw-1', 'scoped:sales-by-site'),
      seedInsight('pw-2', 'scoped:labour-by-site'),
    ],
  },
  {
    id: 'pub-daily-essentials',
    kind: 'published',
    name: 'Daily essentials',
    owner: 'cheryl',
    audience: { roles: ['employee'], siteIds: [...ALL_SITE_IDS] },
    insights: [
      seedInsight('pd-1', 'scoped:kpi-row'),
      seedInsight('pd-2', 'scoped:waste-by-site'),
    ],
  },
];

// ── Store plumbing ─────────────────────────────────────────────────────────

let dashboards: DemoDashboard[] = SEED_DASHBOARDS;
let hydrated = false;

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

function getSnapshot(): DemoDashboard[] {
  return dashboards;
}

function persist() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboards));
  } catch {
    /* quota / private mode — ignore */
  }
}

function isValidStored(parsed: unknown): parsed is DemoDashboard[] {
  if (!Array.isArray(parsed)) return false;
  return parsed.every((d) => {
    if (!d || typeof d !== 'object') return false;
    const dd = d as Partial<DemoDashboard>;
    return (
      typeof dd.id === 'string' &&
      typeof dd.name === 'string' &&
      (dd.kind === 'personal' || dd.kind === 'company' || dd.kind === 'published') &&
      Array.isArray(dd.insights)
    );
  });
}

/** Load persisted dashboards (call once from a client effect). Missing seed
 *  dashboards are re-appended so new demo content survives old storage. */
export function hydrateDashboards() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!isValidStored(parsed)) return;
    const storedIds = new Set(parsed.map((d) => d.id));
    const missingSeeds = SEED_DASHBOARDS.filter((d) => !storedIds.has(d.id));
    dashboards = [...parsed, ...missingSeeds].map((d) =>
      // Migrate the pre-rename default ("Company") — the name is now shown in
      // both the tab and the header, so it carries the full default label.
      d.id === 'company' && d.name === 'Company' ? { ...d, name: 'Company dashboard' } : d,
    );
    emit();
  } catch {
    /* corrupt payload — keep seeds */
  }
}

function update(next: DemoDashboard[]) {
  dashboards = next;
  persist();
  emit();
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useDemoDashboards(): DemoDashboard[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function createDashboard(
  owner: RolesPersonaId,
  name?: string,
  period?: DashboardPeriod,
): DemoDashboard {
  const count = dashboards.filter((d) => d.kind === 'published').length;
  const fallbackName = period ? PERIOD_META[period].defaultName : `New dashboard ${count + 1}`;
  const dashboard: DemoDashboard = {
    id: `pub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    kind: 'published',
    name: name?.trim() || fallbackName,
    owner,
    audience: null,
    ...(period ? { period } : {}),
    insights: [],
  };
  update([...dashboards, dashboard]);
  return dashboard;
}

export function renameDashboard(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  update(
    dashboards.map((d) =>
      d.id === id && (d.kind === 'published' || d.kind === 'company')
        ? { ...d, name: trimmed }
        : d,
    ),
  );
}

export function deleteDashboard(id: string) {
  update(dashboards.filter((d) => !(d.id === id && d.kind === 'published')));
}

export function addInsight(dashboardId: string, chartId: string) {
  update(
    dashboards.map((d) => {
      if (d.id !== dashboardId) return d;
      if (d.insights.some((i) => i.chartId === chartId)) return d;
      return { ...d, insights: [insight(chartId), ...d.insights] };
    }),
  );
}

export function removeInsight(dashboardId: string, insightId: string) {
  update(
    dashboards.map((d) =>
      d.id === dashboardId
        ? { ...d, insights: d.insights.filter((i) => i.id !== insightId) }
        : d,
    ),
  );
}

/** Move an insight one step earlier (-1) or later (+1) on the dashboard. */
export function moveInsight(dashboardId: string, insightId: string, direction: -1 | 1) {
  update(
    dashboards.map((d) => {
      if (d.id !== dashboardId) return d;
      const from = d.insights.findIndex((i) => i.id === insightId);
      const to = from + direction;
      if (from === -1 || to < 0 || to >= d.insights.length) return d;
      const next = d.insights.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...d, insights: next };
    }),
  );
}

export function setInsightWidth(dashboardId: string, insightId: string, width: 'full' | 'half') {
  update(
    dashboards.map((d) =>
      d.id === dashboardId
        ? {
            ...d,
            insights: d.insights.map((i) => (i.id === insightId ? { ...i, width } : i)),
          }
        : d,
    ),
  );
}

/** Admin-only in the UI: flip the "show company-wide" override on an insight. */
export function setInsightCompanyWide(dashboardId: string, insightId: string, companyWide: boolean) {
  update(
    dashboards.map((d) =>
      d.id === dashboardId
        ? {
            ...d,
            insights: d.insights.map((i) =>
              i.id === insightId ? { ...i, companyWide: companyWide || undefined } : i,
            ),
          }
        : d,
    ),
  );
}

export function publishDashboard(id: string, audience: Audience) {
  update(
    dashboards.map((d) =>
      d.id === id && (d.kind === 'published' || d.kind === 'company') ? { ...d, audience } : d,
    ),
  );
}

/** Unpublish = back to draft (owner + admins only). Nothing to clean up —
 *  viewers simply stop seeing it next time they look. For the company
 *  dashboard, clearing the audience means back to everyone. */
export function unpublishDashboard(id: string) {
  update(
    dashboards.map((d) =>
      d.id === id && (d.kind === 'published' || d.kind === 'company')
        ? { ...d, audience: null }
        : d,
    ),
  );
}

/** Demo helper: wipe stored state back to the seeds. */
export function resetDemoDashboards() {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  dashboards = SEED_DASHBOARDS;
  emit();
}

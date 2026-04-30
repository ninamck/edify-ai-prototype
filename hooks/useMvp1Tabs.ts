'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChartInstance, TableInstance } from '@/components/Mvp1/Tables/TablesTab';
import { fullSourceQuery, type TableQuery } from '@/components/Mvp1/Tables/query';

export type Mvp1TabKind = 'dashboard' | 'tables';

export type Mvp1Tab =
  | { id: string; name: string; kind: 'dashboard' }
  | {
      id: string;
      name: string;
      kind: 'tables';
      tables: TableInstance[];
      charts: ChartInstance[];
    };

type StoredState = {
  tabs: Mvp1Tab[];
  activeId: string;
};

// Bumped from v3 → v4 because TableInstance shape changed (sourceId → query).
// Migration of v3 payloads is handled in `loadStored` so existing users keep
// their tabs without losing them.
const STORAGE_KEY = 'edify-mvp1-tabs-v4';
const LEGACY_STORAGE_KEY_V3 = 'edify-mvp1-tabs-v3';

const DEFAULT_TABS: Mvp1Tab[] = [
  { id: 'dashboard', name: 'Dashboard', kind: 'dashboard' },
  {
    id: 'flash-report',
    name: 'Reports',
    kind: 'tables',
    tables: [
      {
        id: 'flash-report-default',
        query: fullSourceQuery('flashReport'),
      },
    ],
    charts: [],
  },
];

const DEFAULT_STATE: StoredState = {
  tabs: DEFAULT_TABS,
  activeId: 'dashboard',
};

function isValidStoredV4(parsed: unknown): parsed is StoredState {
  if (!parsed || typeof parsed !== 'object') return false;
  const p = parsed as { tabs?: unknown; activeId?: unknown };
  if (!Array.isArray(p.tabs) || typeof p.activeId !== 'string') return false;
  return p.tabs.every((t) => {
    if (!t || typeof t !== 'object') return false;
    const tab = t as { id?: unknown; name?: unknown; kind?: unknown; tables?: unknown };
    if (typeof tab.id !== 'string' || typeof tab.name !== 'string') return false;
    if (tab.kind === 'dashboard') return true;
    if (tab.kind === 'tables') {
      if (!Array.isArray(tab.tables)) return false;
      // `charts` is optional in older v4 payloads; we backfill it in
      // `ensureDashboardTab` rather than failing validation here.
      return tab.tables.every((entry) => {
        if (!entry || typeof entry !== 'object') return false;
        const ti = entry as { id?: unknown; query?: unknown };
        if (typeof ti.id !== 'string') return false;
        if (!ti.query || typeof ti.query !== 'object') return false;
        const q = ti.query as { sources?: unknown };
        return Array.isArray(q.sources);
      });
    }
    return false;
  });
}

type LegacyTableInstance = {
  id: string;
  sourceId: string;
  title?: string;
};

type LegacyMvp1Tab =
  | { id: string; name: string; kind: 'dashboard' }
  | { id: string; name: string; kind: 'tables'; tables: LegacyTableInstance[] };

function isValidLegacyV3(parsed: unknown): parsed is { tabs: LegacyMvp1Tab[]; activeId: string } {
  if (!parsed || typeof parsed !== 'object') return false;
  const p = parsed as { tabs?: unknown; activeId?: unknown };
  if (!Array.isArray(p.tabs) || typeof p.activeId !== 'string') return false;
  return p.tabs.every((t) => {
    if (!t || typeof t !== 'object') return false;
    const tab = t as { id?: unknown; name?: unknown; kind?: unknown; tables?: unknown };
    if (typeof tab.id !== 'string' || typeof tab.name !== 'string') return false;
    if (tab.kind === 'dashboard') return true;
    if (tab.kind === 'tables') return Array.isArray(tab.tables);
    return false;
  });
}

function migrateV3ToV4(state: { tabs: LegacyMvp1Tab[]; activeId: string }): StoredState {
  return {
    activeId: state.activeId,
    tabs: state.tabs.map((tab) => {
      if (tab.kind === 'dashboard') return tab;
      const tables: TableInstance[] = tab.tables.map((legacy) => {
        // Coerce known DataSourceIds; fall back to flashReport for unknowns
        // so the user still sees something rather than an empty table.
        const sourceId = ['flashReport', 'sales', 'waste', 'labour'].includes(legacy.sourceId)
          ? (legacy.sourceId as 'flashReport' | 'sales' | 'waste' | 'labour')
          : 'flashReport';
        return {
          id: legacy.id,
          title: legacy.title,
          query: fullSourceQuery(sourceId) as TableQuery,
        };
      });
      // Rename the legacy "Report" tab to "Reports" while we're here (matches
      // the rename done in 12:19 PM).
      const name = tab.id === 'flash-report' && tab.name === 'Report' ? 'Reports' : tab.name;
      return { ...tab, name, tables, charts: [] };
    }),
  };
}

function backfillCharts(state: StoredState): StoredState {
  return {
    ...state,
    tabs: state.tabs.map((tab) => {
      if (tab.kind !== 'tables') return tab;
      const maybeCharts = (tab as { charts?: unknown }).charts;
      const charts: ChartInstance[] = Array.isArray(maybeCharts)
        ? (maybeCharts.filter((c): c is ChartInstance => {
            if (!c || typeof c !== 'object') return false;
            const ci = c as { id?: unknown; chartId?: unknown };
            return typeof ci.id === 'string' && typeof ci.chartId === 'string';
          }))
        : [];
      return { ...tab, charts };
    }),
  };
}

function ensureDashboardTab(state: StoredState): StoredState {
  const hasDashboard = state.tabs.some((t) => t.kind === 'dashboard');
  const withCharts = backfillCharts(state);
  if (hasDashboard) {
    const activeId = withCharts.tabs.some((t) => t.id === state.activeId)
      ? state.activeId
      : withCharts.tabs[0].id;
    return { ...withCharts, activeId };
  }
  const tabs = [DEFAULT_TABS[0], ...withCharts.tabs];
  const activeId = tabs.some((t) => t.id === state.activeId) ? state.activeId : tabs[0].id;
  return { tabs, activeId };
}

function loadStored(): StoredState | null {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Prefer the current-version key.
    const rawV4 = window.localStorage.getItem(STORAGE_KEY);
    if (rawV4) {
      const parsed = JSON.parse(rawV4);
      if (isValidStoredV4(parsed)) return ensureDashboardTab(parsed);
    }

    // 2. Fall back to v3 and migrate forward.
    const rawV3 = window.localStorage.getItem(LEGACY_STORAGE_KEY_V3);
    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (isValidLegacyV3(parsed)) {
        const migrated = ensureDashboardTab(migrateV3ToV4(parsed));
        // Persist forward so we don't keep migrating on every load.
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function persist(state: StoredState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function useMvp1Tabs() {
  const [tabs, setTabs] = useState<Mvp1Tab[]>(DEFAULT_STATE.tabs);
  const [activeId, setActiveId] = useState<string>(DEFAULT_STATE.activeId);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadStored();
    if (stored) {
      setTabs(stored.tabs);
      setActiveId(stored.activeId);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persist({ tabs, activeId });
  }, [tabs, activeId, hydrated]);

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const addTablesTab = useCallback(
    (seed?: { name?: string; tables?: TableInstance[] }) => {
      const id = genId('tab');
      const existingTablesCount = tabs.filter((t) => t.kind === 'tables').length;
      const fallbackName = existingTablesCount === 0 ? 'View' : `View ${existingTablesCount + 1}`;
      const newTab: Mvp1Tab = {
        id,
        name: seed?.name ?? fallbackName,
        kind: 'tables',
        tables: seed?.tables ?? [],
        charts: [],
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveId(id);
      return id;
    },
    [tabs],
  );

  const removeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const target = prev.find((t) => t.id === id);
        if (!target || target.kind === 'dashboard') return prev;
        const next = prev.filter((t) => t.id !== id);
        return next.length > 0 ? next : DEFAULT_TABS;
      });
      setActiveId((prev) => {
        if (prev !== id) return prev;
        const remaining = tabs.filter((t) => t.id !== id);
        return remaining[0]?.id ?? 'dashboard';
      });
    },
    [tabs],
  );

  const renameTab = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setTabs((prev) =>
      prev.map((t) => (t.id === id && t.kind !== 'dashboard' ? { ...t, name: trimmed } : t)),
    );
  }, []);

  const updateTablesForTab = useCallback((id: string, tables: TableInstance[]) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id && t.kind === 'tables' ? { ...t, tables } : t)),
    );
  }, []);

  const appendTableToTab = useCallback((id: string, instance: TableInstance) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === id && t.kind === 'tables' ? { ...t, tables: [...t.tables, instance] } : t,
      ),
    );
  }, []);

  const updateChartsForTab = useCallback((id: string, charts: ChartInstance[]) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id && t.kind === 'tables' ? { ...t, charts } : t)),
    );
  }, []);

  const appendChartToTab = useCallback((id: string, instance: ChartInstance) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === id && t.kind === 'tables' ? { ...t, charts: [...t.charts, instance] } : t,
      ),
    );
  }, []);

  return {
    tabs,
    activeId,
    activeTab,
    setActiveId,
    addTablesTab,
    removeTab,
    renameTab,
    updateTablesForTab,
    appendTableToTab,
    updateChartsForTab,
    appendChartToTab,
    hydrated,
  };
}

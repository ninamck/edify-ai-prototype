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
    name: 'Dashboard 2',
    kind: 'tables',
    tables: [
      {
        id: 'flash-report-default',
        title: 'Weekly P&L',
        query: fullSourceQuery('flashReport'),
      },
      {
        id: 'weekly-flash-totals-default',
        title: 'Weekly P&L Totals',
        query: fullSourceQuery('weeklyFlashTotals'),
      },
      {
        id: 'weekly-sales-by-site-default',
        title: 'Weekly Sales',
        query: fullSourceQuery('weeklySalesBySite'),
      },
      {
        id: 'food-supply-costs-default',
        title: 'Weekly Food & Supply Cost',
        query: fullSourceQuery('foodSupplyCosts'),
      },
      {
        id: 'ndcp-divisions-default',
        title: 'Daily Cost Per Location & NDCP Division',
        query: fullSourceQuery('ndcpDivisions'),
      },
      {
        id: 'daily-sales-by-product-family-default',
        title: 'Daily Sales By Location & Product Family',
        query: fullSourceQuery('dailySalesByProductFamily'),
      },
      {
        id: 'weekly-labor-costs-default',
        title: 'Labor Costs',
        query: fullSourceQuery('weeklyLaborCosts'),
      },
    ],
    charts: [],
  },
  {
    id: 'summary-analysis',
    name: 'Summary Analysis',
    kind: 'tables',
    tables: [],
    charts: [],
  },
  {
    id: 'sales-deep-dive',
    name: 'Sales Deep Dive',
    kind: 'tables',
    tables: [
      {
        id: 'daily-sales-by-site-default',
        title: 'Daily Sales By Location',
        query: fullSourceQuery('dailySalesBySite'),
      },
      {
        id: 'daily-operations-by-site-default',
        title: 'Operations Daily Totals',
        query: fullSourceQuery('dailyOperationsBySite'),
      },
      {
        id: 'sales-deep-dive-product-family-default',
        title: 'Daily Sales By Menu Item',
        query: fullSourceQuery('dailySalesByProductFamily'),
      },
    ],
    charts: [],
  },
];

// Tabs the user is not allowed to remove. The Dashboard tab is enforced
// separately by its `kind === 'dashboard'` discriminator.
export const PINNED_TAB_IDS = new Set<string>([
  'flash-report',
  'summary-analysis',
  'sales-deep-dive',
]);

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
      // `ensurePinnedTabs` rather than failing validation here.
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
      // `refreshFlashReportName` (called from ensurePinnedTabs) brings the
      // legacy "Report"/"Reports" default in line with the current label.
      return { ...tab, tables, charts: [] };
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

// Older default names for the seeded "flash-report" tab. If a stored payload
// still has one of these, we treat it as "user hasn't renamed" and bring it
// in line with the current default ("Dashboard 2") so the live demo reflects
// the latest copy without forcing a localStorage wipe.
const FLASH_REPORT_LEGACY_NAMES = new Set<string>(['Report', 'Reports']);

function refreshFlashReportName(tabs: Mvp1Tab[]): Mvp1Tab[] {
  return tabs.map((t) => {
    if (t.id !== 'flash-report' || t.kind !== 'tables') return t;

    const renamedTab =
      FLASH_REPORT_LEGACY_NAMES.has(t.name) ? { ...t, name: 'Dashboard 2' } : t;

    // Title the seeded flash-report table "Weekly P&L" if the user hasn't
    // already given it a custom title. Older stored sessions seeded the
    // table with no title (it fell through to the source label "Flash report").
    const tables = renamedTab.tables.map((tableInstance) => {
      if (tableInstance.id !== 'flash-report-default') return tableInstance;
      if (tableInstance.title?.trim()) return tableInstance;
      return { ...tableInstance, title: 'Weekly P&L' };
    });

    return { ...renamedTab, tables };
  });
}

/**
 * For every pinned tables-tab that ships with seeded tables, append any seed
 * the user is missing (matched by table id). Append-only and id-keyed so this
 * is safe to re-run; the user's own additions and reorderings are preserved.
 */
function appendMissingPinnedSeeds(tabs: Mvp1Tab[]): Mvp1Tab[] {
  return tabs.map((t) => {
    if (t.kind !== 'tables') return t;
    if (!PINNED_TAB_IDS.has(t.id)) return t;
    const seedTab = DEFAULT_TABS.find(
      (def): def is Extract<Mvp1Tab, { kind: 'tables' }> =>
        def.kind === 'tables' && def.id === t.id,
    );
    if (!seedTab || seedTab.tables.length === 0) return t;
    const existingTableIds = new Set(t.tables.map((tableInstance) => tableInstance.id));
    const missingSeeds = seedTab.tables.filter((seed) => !existingTableIds.has(seed.id));
    if (missingSeeds.length === 0) return t;
    return { ...t, tables: [...t.tables, ...missingSeeds] };
  });
}

function ensurePinnedTabs(state: StoredState): StoredState {
  const seeded = appendMissingPinnedSeeds(refreshFlashReportName(state.tabs));
  const withCharts = backfillCharts({ ...state, tabs: seeded });
  const existingIds = new Set(withCharts.tabs.map((t) => t.id));
  const dashboardDefault = DEFAULT_TABS.find((t) => t.kind === 'dashboard');

  // Build the next tab list: dashboard first (preserved if present, otherwise
  // re-seeded from defaults), then existing tabs, then any missing pinned
  // defaults appended at the end so they're always reachable.
  let nextTabs: Mvp1Tab[];
  if (existingIds.has('dashboard')) {
    nextTabs = withCharts.tabs;
  } else if (dashboardDefault) {
    nextTabs = [dashboardDefault, ...withCharts.tabs];
  } else {
    nextTabs = withCharts.tabs;
  }

  const refreshedIds = new Set(nextTabs.map((t) => t.id));
  for (const def of DEFAULT_TABS) {
    if (def.id === 'dashboard') continue;
    if (!PINNED_TAB_IDS.has(def.id)) continue;
    if (refreshedIds.has(def.id)) continue;
    nextTabs = [...nextTabs, def];
  }

  const activeId = nextTabs.some((t) => t.id === state.activeId)
    ? state.activeId
    : (nextTabs[0]?.id ?? 'dashboard');

  return { tabs: nextTabs, activeId };
}

function loadStored(): StoredState | null {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Prefer the current-version key.
    const rawV4 = window.localStorage.getItem(STORAGE_KEY);
    if (rawV4) {
      const parsed = JSON.parse(rawV4);
      if (isValidStoredV4(parsed)) return ensurePinnedTabs(parsed);
    }

    // 2. Fall back to v3 and migrate forward.
    const rawV3 = window.localStorage.getItem(LEGACY_STORAGE_KEY_V3);
    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (isValidLegacyV3(parsed)) {
        const migrated = ensurePinnedTabs(migrateV3ToV4(parsed));
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
        if (PINNED_TAB_IDS.has(id)) return prev;
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

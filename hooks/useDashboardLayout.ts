'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ESTATE_DEFAULT_LAYOUT,
  MANAGER_DEFAULT_LAYOUT,
  defaultWidthForChart,
  pinnedId,
  type DashboardLayoutEntry,
} from '@/components/Dashboard/layoutTypes';
import type { BriefingRole } from '@/components/briefing';
import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';

type LayoutByRole = Record<BriefingRole, DashboardLayoutEntry[]>;

const STORAGE_KEY = 'edify:dashboardLayoutByRole';

const DEFAULT_LAYOUT_BY_ROLE: LayoutByRole = {
  ravi: MANAGER_DEFAULT_LAYOUT,
  gm: MANAGER_DEFAULT_LAYOUT,
  cheryl: ESTATE_DEFAULT_LAYOUT,
  playtomic: [],
};

function mergeWithDefaults(
  stored: DashboardLayoutEntry[],
  defaults: DashboardLayoutEntry[],
): DashboardLayoutEntry[] {
  const storedIds = new Set(stored.map((e) => e.id));
  const missing = defaults.filter((e) => !storedIds.has(e.id));
  return missing.length === 0 ? stored : [...stored, ...missing];
}

function loadStored(): LayoutByRole | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LayoutByRole>;
    if (!parsed || !parsed.ravi || !parsed.cheryl || !parsed.gm) return null;
    return {
      ravi: mergeWithDefaults(parsed.ravi, MANAGER_DEFAULT_LAYOUT),
      gm: mergeWithDefaults(parsed.gm, MANAGER_DEFAULT_LAYOUT),
      cheryl: mergeWithDefaults(parsed.cheryl, ESTATE_DEFAULT_LAYOUT),
      playtomic: parsed.playtomic ?? [],
    };
  } catch {
    return null;
  }
}

function persist(layout: LayoutByRole) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function useDashboardLayout() {
  const [layoutByRole, setLayoutByRole] = useState<LayoutByRole>(DEFAULT_LAYOUT_BY_ROLE);

  useEffect(() => {
    const stored = loadStored();
    if (stored) setLayoutByRole(stored);
  }, []);

  useEffect(() => {
    persist(layoutByRole);
  }, [layoutByRole]);

  const setLayoutForRole = useCallback((role: BriefingRole, next: DashboardLayoutEntry[]) => {
    setLayoutByRole((prev) => ({ ...prev, [role]: next }));
  }, []);

  const addPinnedChart = useCallback((role: BriefingRole, chartId: AnalyticsChartId) => {
    const entryId = pinnedId(chartId);
    setLayoutByRole((prev) => {
      const existing = prev[role];
      if (existing.some((e) => e.id === entryId)) return prev;
      // New pins land at the top of the dashboard, with a sensible default width.
      const newEntry: DashboardLayoutEntry = {
        id: entryId,
        visible: true,
        width: defaultWidthForChart(chartId),
      };
      return { ...prev, [role]: [newEntry, ...existing] };
    });
  }, []);

  const removePinnedChart = useCallback((role: BriefingRole, chartId: AnalyticsChartId) => {
    const entryId = pinnedId(chartId);
    setLayoutByRole((prev) => ({
      ...prev,
      [role]: prev[role].filter((e) => e.id !== entryId),
    }));
  }, []);

  return { layoutByRole, setLayoutForRole, addPinnedChart, removePinnedChart };
}

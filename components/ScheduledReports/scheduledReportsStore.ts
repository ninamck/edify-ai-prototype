'use client';

/**
 * Scheduled reports — the core object behind the per-card Email button.
 *
 * Two jobs share this machinery: "send this now" (one-off, from a card)
 * and "keep sending this" (recurring, managed, multi-insight). Both build
 * a report — recipients, contents, format, cadence, site scope, data
 * window — so a multi-insight digest is the same object as a one-chart
 * schedule, not a bolt-on.
 *
 * Prototype store: localStorage-backed so demos survive reloads; seeded
 * with example reports (including a paused lost-access row) so the
 * governance page never demos empty.
 */

import { useCallback, useEffect, useState } from 'react';

export type ReportFormat = 'pdf' | 'csv';

export type ReportCadence =
  | { kind: 'daily' }
  | { kind: 'weekly'; day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun' }
  | { kind: 'period-end' };

export type ScheduledReport = {
  id: string;
  name: string;
  /** Insight titles included in the report — one or many. */
  contents: string[];
  /** Plain emails; recipients don't need an Edify login. */
  recipients: string[];
  format: ReportFormat;
  cadence: ReportCadence;
  /** 24h "HH:MM", anchored to the site's timezone, not the creator's. */
  sendTime: string;
  /** v1: locked to the site the report was created from. */
  siteScope: string;
  /** Relative window, resolved at send time (never a fixed range). */
  dataWindow: string;
  /** Reports render with their owner's access at the moment of sending. */
  owner: string;
  active: boolean;
  /** Why a report is paused, when the system did it (e.g. lost access). */
  pausedReason?: string;
  lastSentLabel: string;
};

export function cadenceLabel(c: ReportCadence): string {
  if (c.kind === 'daily') return 'Daily';
  if (c.kind === 'weekly') return `Weekly · ${c.day}`;
  return 'Period end';
}

const STORAGE_KEY = 'edify-scheduled-reports-v1';

const SEED_REPORTS: ScheduledReport[] = [
  {
    id: 'seed-monday-digest',
    name: 'Monday ops digest',
    contents: ['Site league · sales and GP', 'Waste as % of sales · by site', 'Compliance strip'],
    recipients: ['jarek@fitzroy-espresso.co.uk', 'ops-leads@fitzroy-espresso.co.uk'],
    format: 'pdf',
    cadence: { kind: 'weekly', day: 'Mon' },
    sendTime: '07:00',
    siteScope: 'All sites (estate view)',
    dataWindow: 'Last complete week as of send date',
    owner: 'Nina McKenzie',
    active: true,
    lastSentLabel: 'Mon 20 Jul, 07:00',
  },
  {
    id: 'seed-waste-daily',
    name: 'Daily waste flash',
    contents: ['Waste logged · yesterday'],
    recipients: ['gm-fitzroy@fitzroy-espresso.co.uk'],
    format: 'csv',
    cadence: { kind: 'daily' },
    sendTime: '06:30',
    siteScope: 'Fitzroy',
    dataWindow: 'Yesterday, as of send date',
    owner: 'Nina McKenzie',
    active: true,
    lastSentLabel: 'Tue 21 Jul, 06:30',
  },
  {
    id: 'seed-paused-access',
    name: 'Shoreditch GP pack',
    contents: ['GP bridge · theoretical to actual', 'COGS variance · site × category'],
    recipients: ['franchisee-shoreditch@gmail.com'],
    format: 'pdf',
    cadence: { kind: 'period-end' },
    sendTime: '09:00',
    siteScope: 'Shoreditch',
    dataWindow: 'Last complete period as of send date',
    owner: 'Tom Harker',
    active: false,
    pausedReason: 'Paused automatically — owner no longer has access to Shoreditch',
    lastSentLabel: 'Mon 22 Jun, 09:00',
  },
];

function loadStored(): ScheduledReport[] {
  if (typeof window === 'undefined') return SEED_REPORTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_REPORTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return SEED_REPORTS;
    return parsed as ScheduledReport[];
  } catch {
    return SEED_REPORTS;
  }
}

function persist(reports: ScheduledReport[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch {
    /* ignore quota errors */
  }
}

// Module-level state shared across every hook consumer (drawer + page),
// with a tiny subscriber list so both update together. Rendering always
// starts from the seeds; localStorage hydrates in an effect so server and
// first client render agree.
let reportsState: ScheduledReport[] = SEED_REPORTS;
let hydrated = false;
const listeners = new Set<() => void>();

function getReports(): ScheduledReport[] {
  return reportsState;
}

function setReports(next: ScheduledReport[]) {
  reportsState = next;
  persist(next);
  listeners.forEach((l) => l());
}

function hydrateFromStorage() {
  if (hydrated) return;
  hydrated = true;
  const stored = loadStored();
  if (stored !== reportsState) {
    reportsState = stored;
    listeners.forEach((l) => l());
  }
}

export function genReportId(): string {
  return `report-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function useScheduledReports() {
  const [, force] = useState(0);

  useEffect(() => {
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    hydrateFromStorage();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const saveReport = useCallback((report: ScheduledReport) => {
    const current = getReports();
    const exists = current.some((r) => r.id === report.id);
    setReports(exists ? current.map((r) => (r.id === report.id ? report : r)) : [...current, report]);
  }, []);

  const removeReport = useCallback((id: string) => {
    setReports(getReports().filter((r) => r.id !== id));
  }, []);

  const toggleActive = useCallback((id: string) => {
    setReports(
      getReports().map((r) =>
        r.id === id
          ? { ...r, active: !r.active, pausedReason: r.active ? 'Paused by you' : undefined }
          : r,
      ),
    );
  }, []);

  return { reports: getReports(), saveReport, removeReport, toggleActive };
}

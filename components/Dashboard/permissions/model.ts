// Dashboard ownership model for the roles & permissions mock.
//
// Three kinds of dashboard (per the business rules doc):
//   personal  — private to its owner
//   company   — one shared dashboard, any admin edits, everyone views
//   published — created by an admin/manager and shared with an audience
//               defined as role-at-sites (never named individuals)
//
// A dashboard's insights are saved *questions*: every tile re-cuts its data
// to the viewer's sites at render time, so the same dashboard shows an admin
// 12 sites and a manager their 3. The only exception is an insight an admin
// marks "show company-wide".

import {
  siteListPhrase,
  type DemoRole,
  type RolesPersonaId,
  type SiteId,
  type Viewer,
} from './sites';

export type DashboardKind = 'personal' | 'company' | 'published';

/** A dashboard can be bound to a reporting cadence: every chart and table on
 *  it always shows that window's data. In the real build the data refreshes
 *  for the current date; in the prototype the window is just described. */
export type DashboardPeriod = 'daily' | 'weekly' | 'period-end';

export const PERIOD_META: Record<
  DashboardPeriod,
  {
    label: string;
    /** Default name for a new dashboard of this cadence. */
    defaultName: string;
    /** Header line describing the auto-refreshing window. */
    windowLine: string;
    /** Matching rolling window for emailed reports (see DATA_WINDOW_OPTIONS). */
    reportWindow: string;
  }
> = {
  daily: {
    label: 'Daily',
    defaultName: 'Daily dashboard',
    windowLine: 'Always shows yesterday \u2014 refreshes each morning.',
    reportWindow: 'Yesterday, as of send date',
  },
  weekly: {
    label: 'Weekly',
    defaultName: 'Weekly dashboard',
    windowLine: 'Always shows the current week so far \u2014 refreshes daily.',
    reportWindow: 'Last complete week as of send date',
  },
  'period-end': {
    label: 'Period end',
    defaultName: 'Period end dashboard',
    windowLine: 'Always shows the current period (P7) \u2014 finalises when the period closes.',
    reportWindow: 'Last complete period as of send date',
  },
};

/** Audiences are role-at-sites, never individuals. */
export type Audience = {
  roles: Exclude<DemoRole, 'admin'>[];
  siteIds: SiteId[];
};

export type DashboardInsight = {
  /** Unique per placement (the same chart can live on several dashboards). */
  id: string;
  /** Either a `scoped:*` insight (re-cut per viewer) or a legacy
   *  AnalyticsChartId pinned from chat. */
  chartId: string;
  /** Admin-only override: this insight ignores the viewer's site scope and
   *  always shows whole-company data. The single exception to idea 2. */
  companyWide?: boolean;
  /** Grid span; defaults to the insight's natural width when unset. */
  width?: 'full' | 'half';
};

export type DemoDashboard = {
  id: string;
  kind: DashboardKind;
  name: string;
  /** Persona of the creator. The company dashboard is collectively owned by
   *  admins; owner is only meaningful for personal + published. */
  owner: RolesPersonaId;
  /** Published only. `null` = draft — visible to its owner and admins until
   *  an audience is chosen. */
  audience?: Audience | null;
  /** When set, every insight on this dashboard is bound to this reporting
   *  window (chosen at set-up) and the data refreshes for the current date. */
  period?: DashboardPeriod;
  insights: DashboardInsight[];
};

// ── Visibility & permissions ───────────────────────────────────────────────

export function canSeeDashboard(viewer: Viewer, d: DemoDashboard): boolean {
  switch (d.kind) {
    case 'personal':
      // Private to the owner. A previewing admin loses their personal tab —
      // that's the point of the preview.
      return !viewer.previewing && d.owner === viewer.personaId;
    case 'company': {
      // Default (no audience): everyone sees it, each with their own data.
      // Admins can narrow it to role-at-sites like any other shared board.
      if (!viewer.previewing && viewer.role === 'admin') return true;
      if (!d.audience) return true;
      return (
        d.audience.roles.includes(viewer.role as Exclude<DemoRole, 'admin'>) &&
        d.audience.siteIds.some((s) => viewer.siteIds.includes(s))
      );
    }
    case 'published': {
      if (!viewer.previewing && d.owner === viewer.personaId) return true;
      if (!viewer.previewing && viewer.role === 'admin') return true;
      if (!d.audience) return false; // draft
      return (
        d.audience.roles.includes(viewer.role as Exclude<DemoRole, 'admin'>) &&
        d.audience.siteIds.some((s) => viewer.siteIds.includes(s))
      );
    }
  }
}

export function visibleDashboards(viewer: Viewer, all: DemoDashboard[]): DemoDashboard[] {
  const seen = all.filter((d) => canSeeDashboard(viewer, d));
  const rank = (d: DemoDashboard) => (d.kind === 'personal' ? 0 : d.kind === 'company' ? 1 : 2);
  return [...seen].sort((a, b) => rank(a) - rank(b));
}

export function canEditDashboard(viewer: Viewer, d: DemoDashboard): boolean {
  if (viewer.previewing) return false; // previews are strictly view-only
  switch (d.kind) {
    case 'personal':
      return d.owner === viewer.personaId;
    case 'company':
      return viewer.role === 'admin';
    case 'published':
      return d.owner === viewer.personaId || viewer.role === 'admin';
  }
}

/** Admins and managers can create dashboards; employees are view-only. */
export function canCreateDashboards(viewer: Viewer): boolean {
  return !viewer.previewing && (viewer.role === 'admin' || viewer.role === 'manager');
}

/** Asking Edify new questions stays admin-only (viewing vs asking). */
export function canAskQuestions(viewer: Viewer): boolean {
  return !viewer.previewing && viewer.role === 'admin';
}

/** Only admins may mark an insight "show company-wide", and only on shared
 *  dashboards (it means nothing on a private personal dashboard). */
export function canToggleCompanyWide(viewer: Viewer, d: DemoDashboard): boolean {
  return (
    !viewer.previewing &&
    viewer.role === 'admin' &&
    d.kind !== 'personal' &&
    canEditDashboard(viewer, d)
  );
}

export function canPublish(viewer: Viewer, d: DemoDashboard): boolean {
  return (d.kind === 'published' || d.kind === 'company') && canEditDashboard(viewer, d);
}

// ── Plain-English summaries ────────────────────────────────────────────────

const ROLE_PLURAL: Record<Exclude<DemoRole, 'admin'>, string> = {
  manager: 'managers',
  employee: 'employees',
};

/** "All managers at Soho, Borough and Fitzroy" — the who-can-see-this line. */
export function audienceSummary(d: DemoDashboard): string {
  switch (d.kind) {
    case 'personal':
      return 'Only you can see this dashboard.';
    case 'company': {
      if (d.audience && d.audience.roles.length > 0 && d.audience.siteIds.length > 0) {
        const roles = d.audience.roles.map((r) => ROLE_PLURAL[r]).join(' and ');
        return `All ${roles} at ${siteListPhrase(d.audience.siteIds)}.`;
      }
      return 'Everyone at the company — each person sees their own sites\u2019 data.';
    }
    case 'published': {
      if (!d.audience || d.audience.roles.length === 0 || d.audience.siteIds.length === 0) {
        return 'Not published yet — only you and admins can see this.';
      }
      const roles = d.audience.roles
        .map((r) => ROLE_PLURAL[r])
        .join(' and ');
      return `All ${roles} at ${siteListPhrase(d.audience.siteIds)}.`;
    }
  }
}

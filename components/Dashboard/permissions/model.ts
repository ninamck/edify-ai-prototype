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

import { resolveDateRange, type DateRange } from '@/lib/dateRange';
import type { RangeBinding } from '@/lib/chartRange';
import {
  siteListPhrase,
  type DemoRole,
  type RolesPersonaId,
  type SiteId,
  type Viewer,
} from './sites';

export type DashboardKind = 'personal' | 'company' | 'published';

/**
 * A dashboard can be bound to a reporting cadence: every chart and table on
 * it shows that window's data, re-resolved against the current date.
 *
 * The three cadences are now sugar over the general range model rather than
 * a parallel concept — each maps to a range token, and a dashboard can carry
 * any other range instead. Keeping the named cadences matters because
 * "Daily" is what people call the thing; the range is the implementation.
 */
export type DashboardPeriod = 'daily' | 'weekly' | 'period-end';

export const PERIOD_META: Record<
  DashboardPeriod,
  {
    label: string;
    /** Default name for a new dashboard of this cadence. */
    defaultName: string;
    /** The range token this cadence is shorthand for. */
    range: DateRange;
    /** Matching rolling window for emailed reports (see DATA_WINDOW_OPTIONS). */
    reportWindow: string;
    /** Trailing clause on the header line, after the resolved dates. */
    refreshClause: string;
  }
> = {
  daily: {
    label: 'Daily',
    defaultName: 'Daily dashboard',
    range: { kind: 'yesterday' },
    reportWindow: 'Yesterday, as of send date',
    refreshClause: 'refreshes each morning',
  },
  weekly: {
    label: 'Weekly',
    defaultName: 'Weekly dashboard',
    range: { kind: 'this_week' },
    reportWindow: 'Last complete week as of send date',
    refreshClause: 'refreshes daily',
  },
  'period-end': {
    label: 'Period end',
    defaultName: 'Period end dashboard',
    range: { kind: 'this_period' },
    reportWindow: 'Last complete period as of send date',
    refreshClause: 'finalises when the period closes',
  },
};

/**
 * The range a dashboard's tiles inherit. An explicit `range` wins over the
 * cadence shorthand; a dashboard with neither imposes nothing, and its tiles
 * fall back to their own native windows.
 */
export function dashboardRange(d: DemoDashboard): DateRange | undefined {
  if (d.range) return d.range;
  return d.period ? PERIOD_META[d.period].range : undefined;
}

/**
 * Header line describing the window, resolved live. The old copy hardcoded
 * "(P7)", which had already gone stale — deriving it means the header can
 * never drift from the data.
 */
export function dashboardWindowLine(
  d: DemoDashboard,
  anchor?: string,
): string | null {
  const range = dashboardRange(d);
  if (!range) return null;

  const resolved = resolveDateRange(range, { anchor });
  const dates = resolved.absoluteLabel;

  if (range.kind === 'custom') {
    return `Fixed range: ${dates} \u2014 does not move.`;
  }

  const clause = d.period ? PERIOD_META[d.period].refreshClause : null;
  const window = `Always shows ${resolved.label.toLowerCase()} (${dates})`;
  return clause ? `${window} \u2014 ${clause}.` : `${window}.`;
}

/** Short badge text for the dashboard header. */
export function dashboardRangeBadge(
  d: DemoDashboard,
  anchor?: string,
): string | null {
  if (d.period) return PERIOD_META[d.period].label;
  if (!d.range) return null;
  return resolveDateRange(d.range, { anchor }).label;
}

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
  /**
   * How this placement gets its date window. Unset means inherit — the
   * common case, and the default when a chart is added from Ask Edify.
   */
  binding?: RangeBinding;
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
  /** Named cadence shorthand. Resolves to a range via `PERIOD_META`. */
  period?: DashboardPeriod;
  /**
   * An explicit window, for dashboards that don't fit one of the three named
   * cadences. Takes precedence over `period` when both are set.
   */
  range?: DateRange;
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

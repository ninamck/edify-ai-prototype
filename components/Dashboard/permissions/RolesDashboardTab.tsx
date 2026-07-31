'use client';

// Content for one roles-model dashboard, rendered inside the shared home tab
// strip (the strip itself lives in HomeShell, where these dashboards sit
// alongside the original role dashboard, user views and Templates). Handles
// the header with the who-can-see line, publish & audience picker, and edit
// mode with the company-wide toggle. The workspace-level admin tools ("All
// published", "View as") live on the tab-strip row in HomeShell.

import { useEffect, useMemo, useState } from 'react';
import { Check, LayoutDashboard, ListChecks, Mail, Pencil, Plus, Radio, RefreshCw, Trash2 } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { ChoiceCard } from '@/components/Mvp1/Tables/TablesTab';
import AddInsightPopup from '@/components/Dashboard/AddInsightPopup';
import ScheduleReportDrawer from '@/components/ScheduledReports/ScheduleReportDrawer';
import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import { ANALYTICS_CONFIG } from '@/components/Analytics/AnalyticsCharts';
import InsightTile, { insightDefaultWidth, insightLabel } from './InsightTile';
import PublishDialog from './PublishDialog';
import InheritRangeDialog, {
  needsInheritPrompt,
  type PendingAdd,
} from './InheritRangeDialog';
import DateRangePicker from '@/components/Mvp1/DateRangePicker';
import {
  audienceSummary,
  canAskQuestions,
  canEditDashboard,
  canPublish,
  canToggleCompanyWide,
  dashboardRange,
  dashboardRangeBadge,
  dashboardWindowLine,
  PERIOD_META,
  visibleDashboards,
  type DemoDashboard,
} from './model';
import {
  addInsight,
  createDashboard,
  deleteDashboard,
  moveInsight,
  publishDashboard,
  removeInsight,
  renameDashboard,
  setDashboardRange,
  setInsightCompanyWide,
  setInsightWidth,
  unpublishDashboard,
  useDemoDashboards,
} from './dashboardStore';
import { effectiveViewer, useViewAs } from './viewAsStore';
import { ALL_SITE_IDS, ROLE_LABEL, siteListPhrase, type RolesPersonaId } from './sites';

const toolbarButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-text-primary)',
};

export default function RolesDashboardTab({
  briefingRole,
  dashboardId,
  onSelectDashboard,
}: {
  briefingRole: RolesPersonaId;
  dashboardId: string;
  /** Switch the home tab strip to another roles dashboard (by dashboard id). */
  onSelectDashboard: (dashboardId: string) => void;
}) {
  const dashboards = useDemoDashboards();
  const viewAs = useViewAs();
  const viewer = effectiveViewer(briefingRole, viewAs);

  const visible = useMemo(() => visibleDashboards(viewer, dashboards), [viewer, dashboards]);
  const active: DemoDashboard | null = visible.find((d) => d.id === dashboardId) ?? null;

  const [editing, setEditing] = useState(false);
  const [addInsightOpen, setAddInsightOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  // Switching dashboard, persona or preview always leaves edit mode — editing
  // shared things should be deliberate, never carried over by accident.
  useEffect(() => {
    setEditing(false);
    setRenaming(false);
  }, [dashboardId, briefingRole, viewAs]);

  const canEdit = active ? canEditDashboard(viewer, active) : false;
  const askAllowed = canAskQuestions(viewer);

  // Destinations for the "Pin to…" picker: every dashboard this viewer can
  // edit — their own one, Company (admins), and published ones they own.
  const pinTargets = useMemo(
    () =>
      visible
        .filter((d) => canEditDashboard(viewer, d))
        .map((d) => ({
          id: d.id,
          label: d.name,
        })),
    [visible, viewer],
  );

  const defaultPinTargetId =
    active && pinTargets.some((t) => t.id === active.id)
      ? active.id
      : pinTargets[0]?.id;

  const alreadyPinned = useMemo(() => {
    const ids = (active?.insights ?? [])
      .map((i) => i.chartId)
      .filter((id): id is AnalyticsChartId => id in ANALYTICS_CONFIG);
    return new Set<AnalyticsChartId>(ids);
  }, [active]);

  if (!active) return null;

  const headerName = active.name;
  const showAudienceLine = active.kind !== 'published' || canEditDashboard(viewer, active);
  // "Audience…" (already shared) vs "Publish…" (still a draft). The company
  // dashboard is always live — with no audience it's shared with everyone.
  const isLivePublished =
    active.kind === 'company' || (active.kind === 'published' && !!active.audience);
  const ownedPublished =
    active.kind === 'published' && active.owner === viewer.personaId && !viewer.previewing;
  const canRename =
    ownedPublished || (active.kind === 'company' && canEditDashboard(viewer, active));
  const isDraft = active.kind === 'published' && !active.audience;
  // Owners can always delete their published dashboards; admins can delete
  // anyone's. The company dashboard and private views are never deletable here.
  const canDelete =
    ownedPublished || (active.kind === 'published' && viewer.role === 'admin' && !viewer.previewing);

  function handleDelete() {
    if (
      isDraft ||
      window.confirm(`Delete \u201C${active!.name}\u201D? Everyone in its audience loses it.`)
    ) {
      deleteDashboard(active!.id);
    }
  }

  const period = active.period ? PERIOD_META[active.period] : null;
  const range = dashboardRange(active);
  const rangeBadge = dashboardRangeBadge(active);
  const windowLine = dashboardWindowLine(active);
  const insightTitles = active.insights.map((i) => insightLabel(i.chartId));
  // Site scope for emailed reports follows the viewer's scope, like the tiles.
  const emailSiteLabel =
    viewer.siteIds.length >= ALL_SITE_IDS.length
      ? 'All sites (estate view)'
      : siteListPhrase(viewer.siteIds);

  function commitRename() {
    if (nameDraft.trim()) renameDashboard(active!.id, nameDraft);
    setRenaming(false);
  }

  /**
   * Adding a chart to a dashboard that carries a window is the moment the
   * chart's own range gets overridden, so that is where we say so — but only
   * when the chart could actually inherit. Anything else goes straight on.
   */
  function requestAdd(chartId: string, targetId: string) {
    const target = visible.find((d) => d.id === targetId);
    const targetRange = target ? dashboardRange(target) : undefined;

    if (!target || !needsInheritPrompt(chartId, targetRange)) {
      addInsight(targetId, chartId);
      return;
    }
    setPendingAdd({
      chartId,
      targetId,
      targetName: target.name,
      targetRange: targetRange!,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-primary)' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          {renaming ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenaming(false);
              }}
              style={{
                fontFamily: 'var(--font-primary)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 6,
                padding: '2px 8px',
                outline: 'none',
                marginBottom: 4,
              }}
            />
          ) : (
            <h1
              onDoubleClick={
                canRename
                  ? () => {
                      setNameDraft(active.name);
                      setRenaming(true);
                    }
                  : undefined
              }
              title={canRename ? 'Double-click to rename' : undefined}
              style={{
                margin: '0 0 4px',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                cursor: canRename ? 'text' : 'default',
              }}
            >
              {headerName}
              {rangeBadge && (
                <span
                  title={`Every inheriting chart on this dashboard follows the ${rangeBadge.toLowerCase()} window, re-resolved against today\u2019s date.`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    marginLeft: 8,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: 'var(--color-info-light)',
                    color: 'var(--color-info)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <RefreshCw size={10} strokeWidth={2.4} />
                  {rangeBadge}
                </span>
              )}
            </h1>
          )}
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
            {showAudienceLine
              ? audienceSummary(active)
              : `Shared with you as ${ROLE_LABEL[viewer.role].toLowerCase()} — showing your sites\u2019 data.`}
            {windowLine ? ` ${windowLine}` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          {/* Only custom-range dashboards get a picker. A cadence dashboard's
              promise is that it always shows the same window, so handing it a
              free date control would quietly undo the thing it is for. */}
          {canEdit && active.range && (
            <DateRangePicker
              value={active.range}
              onChange={(next) => setDashboardRange(active.id, next)}
            />
          )}

          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              title={isDraft ? 'Delete this draft dashboard' : 'Delete this dashboard for everyone in its audience'}
              style={{ ...toolbarButtonStyle, fontSize: 12, color: 'var(--color-error)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-error-light, #fef2f2)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
            >
              <Trash2 size={13} strokeWidth={2.2} />
              {isDraft ? 'Delete draft' : 'Delete'}
            </button>
          )}

          {canPublish(viewer, active) && (
            <button
              type="button"
              onClick={() => setPublishOpen(true)}
              style={toolbarButtonStyle}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
            >
              <Radio size={14} strokeWidth={2.2} />
              {isLivePublished ? 'Audience…' : 'Publish…'}
            </button>
          )}

          {active.insights.length > 0 && (
            <button
              type="button"
              onClick={() => setEmailOpen(true)}
              title="Email this dashboard — send once or on a schedule"
              style={toolbarButtonStyle}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
            >
              <Mail size={14} strokeWidth={2.2} />
              Email…
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setAddInsightOpen(true)}
              style={toolbarButtonStyle}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
            >
              <Plus size={14} strokeWidth={2.5} />
              Add insight
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              aria-pressed={editing}
              style={{
                ...toolbarButtonStyle,
                border: editing ? '1px solid var(--color-accent-active)' : '1px solid var(--color-border-subtle)',
                background: editing ? 'var(--color-accent-active)' : '#fff',
                color: editing ? '#fff' : 'var(--color-text-primary)',
              }}
            >
              {editing ? <Check size={14} strokeWidth={2.5} /> : <Pencil size={14} strokeWidth={2.5} />}
              {editing ? 'Done' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {editing && active.kind === 'company' && (
        <div
          style={{
            padding: '9px 12px',
            borderRadius: 10,
            background: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning-border)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-warning)',
          }}
        >
          You’re editing the Company dashboard — changes appear for everyone at the
          company. “Show company-wide” overrides per-viewer site scoping for a single
          insight; only admins can set it.
        </div>
      )}

      {active.insights.length === 0 ? (
        canEdit ? (
          <div
            style={{
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              textAlign: 'center',
              border: '1px dashed var(--color-border)',
              borderRadius: 14,
              color: 'var(--color-text-muted)',
            }}
          >
            <LayoutDashboard size={20} strokeWidth={1.8} color="var(--color-text-muted)" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Build your first chart or table
              </div>
              <div style={{ fontSize: 12, marginTop: 4, fontWeight: 500 }}>
                Every viewer sees it answered with their own sites&rsquo; data.
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
                width: '100%',
                maxWidth: 520,
                marginTop: 4,
              }}
            >
              {askAllowed && (
                <ChoiceCard
                  icon={<EdifyMark size={16} strokeWidth={2.2} color="var(--color-accent-active)" />}
                  title="Ask Edify"
                  description="Describe the chart or table you want in your own words."
                  onClick={() => setAddInsightOpen(true)}
                />
              )}
              <ChoiceCard
                icon={<ListChecks size={16} strokeWidth={2.2} color="var(--color-text-secondary)" />}
                title="Pick a question"
                description="Start from a curated question — chart or table."
                onClick={() => setAddInsightOpen(true)}
              />
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              border: '1px dashed var(--color-border)',
              borderRadius: 14,
              color: 'var(--color-text-muted)',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            No charts or tables here yet.
          </div>
        )
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 14,
            gridAutoFlow: 'dense',
          }}
        >
          {active.insights.map((ins, index) => {
            const width = ins.width ?? insightDefaultWidth(ins.chartId);
            return (
              <div
                key={ins.id}
                style={{
                  gridColumn: `span ${width === 'full' ? 2 : 1} / span ${width === 'full' ? 2 : 1}`,
                  minWidth: 0,
                }}
              >
                <InsightTile
                  insight={ins}
                  viewer={viewer}
                  width={width}
                  editing={editing && canEdit}
                  canToggleCompanyWide={canToggleCompanyWide(viewer, active)}
                  siblingInsights={insightTitles}
                  dataWindowLabel={period?.reportWindow}
                  dashboardRange={range}
                  isFirst={index === 0}
                  isLast={index === active.insights.length - 1}
                  onMove={(dir) => moveInsight(active.id, ins.id, dir)}
                  onToggleWidth={() => setInsightWidth(active.id, ins.id, width === 'full' ? 'half' : 'full')}
                  onToggleCompanyWide={(next) => setInsightCompanyWide(active.id, ins.id, next)}
                  onRemove={() => removeInsight(active.id, ins.id)}
                />
              </div>
            );
          })}
        </div>
      )}

      <AddInsightPopup
        open={addInsightOpen}
        onClose={() => setAddInsightOpen(false)}
        briefingRole={briefingRole}
        layout="side-sheet"
        askLocked={!askAllowed}
        alreadyPinned={alreadyPinned}
        onAddToDashboard={(chartId) => {
          if (defaultPinTargetId) requestAdd(chartId, defaultPinTargetId);
        }}
        pinTarget="view"
        pinTargets={pinTargets}
        defaultPinTargetId={defaultPinTargetId}
        onAddChartToTarget={(chartId, targetId) => requestAdd(chartId, targetId)}
        onAddChartToNewView={(chartId) => {
          const d = createDashboard(viewer.personaId);
          addInsight(d.id, chartId);
          onSelectDashboard(d.id);
          return d.id;
        }}
      />

      <InheritRangeDialog
        pending={pendingAdd}
        fallbackLabel={pendingAdd ? insightLabel(pendingAdd.chartId) : undefined}
        onCancel={() => setPendingAdd(null)}
        onConfirm={(binding) => {
          if (pendingAdd) addInsight(pendingAdd.targetId, pendingAdd.chartId, binding);
          setPendingAdd(null);
        }}
      />

      <PublishDialog
        open={publishOpen}
        dashboard={active.kind === 'published' || active.kind === 'company' ? active : null}
        viewer={viewer}
        onClose={() => setPublishOpen(false)}
        onPublish={(audience) => publishDashboard(active.id, audience)}
        onUnpublish={() => unpublishDashboard(active.id)}
      />

      {/* Dashboard-level email: the whole dashboard pre-ticked, window bound
          to the dashboard's period when it has one. */}
      <ScheduleReportDrawer
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        initialSelection={insightTitles}
        siteLabel={emailSiteLabel}
        dataWindowLabel={period?.reportWindow}
      />
    </div>
  );
}

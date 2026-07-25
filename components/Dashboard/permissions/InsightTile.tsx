'use client';

// One insight on a roles-model dashboard. Renders the scoped chart for the
// effective viewer's sites (or company-wide when the admin override is on),
// with an explicit edit-mode control bar — editing shared dashboards should
// feel deliberate, so controls sit above the card rather than hiding behind
// hover states.

import { ArrowDown, ArrowUp, Globe2, Maximize2, Minimize2, Trash2 } from 'lucide-react';
import { ANALYTICS_CONFIG, renderAnalyticsChart, type AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import TileActions from '@/components/ScheduledReports/TileActions';
import type { WidgetWidth } from '@/components/Dashboard/layoutTypes';
import type { DashboardInsight } from './model';
import { ALL_SITE_IDS, siteListPhrase, type Viewer } from './sites';
import {
  isScopedInsightId,
  renderScopedInsight,
  SCOPED_INSIGHT_CONFIG,
} from './ScopedInsight';

export function insightLabel(chartId: string): string {
  if (isScopedInsightId(chartId)) return SCOPED_INSIGHT_CONFIG[chartId].label;
  return ANALYTICS_CONFIG[chartId as AnalyticsChartId]?.label ?? chartId;
}

export function insightDefaultWidth(chartId: string): WidgetWidth {
  if (isScopedInsightId(chartId)) return SCOPED_INSIGHT_CONFIG[chartId].defaultWidth;
  return 'half';
}

function scopeLine(insight: DashboardInsight, viewer: Viewer): string {
  if (insight.companyWide) return `Company-wide · all ${ALL_SITE_IDS.length} sites`;
  if (viewer.siteIds.length >= ALL_SITE_IDS.length) return `All ${ALL_SITE_IDS.length} sites`;
  const label = viewer.siteIds.length === 1 ? 'Your site' : 'Your sites';
  return `${label}: ${siteListPhrase(viewer.siteIds)}`;
}

export default function InsightTile({
  insight,
  viewer,
  width,
  editing,
  canToggleCompanyWide,
  siblingInsights = [],
  dataWindowLabel = 'Last 7 complete days as of send date',
  isFirst,
  isLast,
  onMove,
  onToggleWidth,
  onToggleCompanyWide,
  onRemove,
}: {
  insight: DashboardInsight;
  viewer: Viewer;
  width: WidgetWidth;
  editing: boolean;
  /** Admin editing a dashboard they can edit — shows the company-wide toggle. */
  canToggleCompanyWide: boolean;
  /** Labels of the other insights on this dashboard, for the email drawer. */
  siblingInsights?: string[];
  /** Rolling window for emailed reports — period dashboards pass their own. */
  dataWindowLabel?: string;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  onToggleWidth: () => void;
  onToggleCompanyWide: (next: boolean) => void;
  onRemove: () => void;
}) {
  const scoped = isScopedInsightId(insight.chartId);
  const effectiveSites = insight.companyWide ? ALL_SITE_IDS : viewer.siteIds;
  const isMilestone = insight.chartId === 'scoped:million-milestone';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {editing && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            aria-label="Move earlier"
            title="Move earlier"
            style={editButtonStyle(isFirst)}
          >
            <ArrowUp size={13} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            aria-label="Move later"
            title="Move later"
            style={editButtonStyle(isLast)}
          >
            <ArrowDown size={13} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={onToggleWidth}
            aria-label={width === 'full' ? 'Make half width' : 'Make full width'}
            title={width === 'full' ? 'Half width' : 'Full width'}
            style={editButtonStyle(false)}
          >
            {width === 'full' ? <Minimize2 size={13} strokeWidth={2.2} /> : <Maximize2 size={13} strokeWidth={2.2} />}
          </button>

          {canToggleCompanyWide && (
            <button
              type="button"
              onClick={() => onToggleCompanyWide(!insight.companyWide)}
              aria-pressed={!!insight.companyWide}
              title="Show every viewer whole-company data for this insight, instead of their own sites"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 999,
                border: insight.companyWide
                  ? '1px solid var(--color-accent-active)'
                  : '1px solid var(--color-border-subtle)',
                background: insight.companyWide ? 'var(--color-accent-active)' : '#fff',
                color: insight.companyWide ? '#fff' : 'var(--color-text-secondary)',
                fontFamily: 'var(--font-primary)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Globe2 size={12} strokeWidth={2.2} />
              {insight.companyWide ? 'Shown company-wide' : 'Show company-wide'}
            </button>
          )}

          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove insight"
            title="Remove"
            style={{ ...editButtonStyle(false), color: 'var(--color-error)' }}
          >
            <Trash2 size={13} strokeWidth={2.2} />
          </button>
        </div>
      )}

      <div
        style={{
          padding: isMilestone ? 0 : '14px 16px 10px',
          borderRadius: 12,
          border: '1px solid var(--color-border-subtle)',
          background: '#fff',
          boxShadow: '0 2px 12px rgba(0, 28, 53,0.07)',
          outline: editing ? '2px dashed var(--color-accent-mid)' : 'none',
          outlineOffset: 2,
          overflow: 'hidden',
        }}
      >
        {!isMilestone && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {insightLabel(insight.chartId)}
              </span>
              <TileActions
                insightTitle={insightLabel(insight.chartId)}
                siteLabel={scopeLine(insight, viewer)}
                siblingInsights={siblingInsights}
                dataWindowLabel={dataWindowLabel}
              />
              {insight.companyWide && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: 'var(--color-info-light)',
                    color: 'var(--color-info)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Globe2 size={11} strokeWidth={2.2} />
                  Company-wide
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {scopeLine(insight, viewer)}
              {scoped && isScopedInsightId(insight.chartId)
                ? ` · ${SCOPED_INSIGHT_CONFIG[insight.chartId].subtitle}`
                : ''}
            </div>
          </div>
        )}

        <div style={{ width: '100%', height: isMilestone ? 'auto' : 220 }}>
          {scoped && isScopedInsightId(insight.chartId)
            ? renderScopedInsight(insight.chartId, effectiveSites)
            : renderAnalyticsChart(insight.chartId as AnalyticsChartId)}
        </div>
      </div>
    </div>
  );
}

function editButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: 8,
    border: '1px solid var(--color-border-subtle)',
    background: '#fff',
    color: disabled ? 'var(--color-border)' : 'var(--color-text-secondary)',
    cursor: disabled ? 'default' : 'pointer',
  };
}

'use client';

import { useRef, useState, type ReactNode } from 'react';
import PlaytomicOverview from '@/components/Dashboard/Playtomic/PlaytomicOverview';
import ChainPulse from '@/components/Dashboard/Playtomic/ChainPulse';
import ManchesterDeepDive from '@/components/Dashboard/Playtomic/ManchesterDeepDive';
import DashboardEditToolbar from '@/components/Dashboard/DashboardEditToolbar';
import DashboardWidget from '@/components/Dashboard/DashboardWidget';
import QuinnInsightButton from '@/components/Dashboard/parts/QuinnInsightButton';
import {
  ANALYTICS_CONFIG,
  renderAnalyticsChart,
  type AnalyticsChartId,
} from '@/components/Analytics/AnalyticsCharts';
import {
  isHalfOnlyChart,
  pinnedChartIdOf,
  widthOf,
  type DashboardLayoutEntry,
  type WidgetWidth,
} from '@/components/Dashboard/layoutTypes';

type PlaytomicTab = 'overview' | 'chain' | 'manchester';

// Only Overview and Chain pulse appear in the tab strip. The Manchester
// deep-dive is reachable by clicking the Manchester row in the venue table.
const VISIBLE_TABS: { id: 'overview' | 'chain'; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'chain', label: 'Chain pulse' },
];

export default function PlaytomicDashboard({
  layout,
  editing,
  onLayoutChange,
  onToggleEdit,
  onAddInsight,
  onRemovePinned,
  toolbarLeadingControls,
  belowHeader,
  heroGreeting,
}: {
  layout: DashboardLayoutEntry[];
  editing: boolean;
  onLayoutChange: (next: DashboardLayoutEntry[]) => void;
  onToggleEdit: () => void;
  onAddInsight: () => void;
  onRemovePinned: (chartId: AnalyticsChartId) => void;
  toolbarLeadingControls?: ReactNode;
  belowHeader?: ReactNode;
  /** When provided, render the page header in hero style (large greeting + airy spacing). */
  heroGreeting?: string;
}) {
  const [tab, setTab] = useState<PlaytomicTab>('overview');
  const widgetRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Only pinned-chart entries appear on the Playtomic dashboard — the three
  // tabs already render the static padel content; pinning is the way to add
  // extra insights via the question library + Quinn flow.
  const pinnedEntries = layout.filter((e) => pinnedChartIdOf(e.id) !== null);
  const visiblePinned = editing ? pinnedEntries : pinnedEntries.filter((e) => e.visible);

  function toggleVisible(id: string) {
    onLayoutChange(layout.map((e) => (e.id === id ? { ...e, visible: !e.visible } : e)));
  }

  function toggleWidth(id: string) {
    onLayoutChange(
      layout.map((e) =>
        e.id === id
          ? { ...e, width: (widthOf(e) === 'full' ? 'half' : 'full') as WidgetWidth }
          : e,
      ),
    );
  }

  function removeEntry(id: string) {
    onLayoutChange(layout.filter((e) => e.id !== id));
  }

  function handleDragEnd(draggedId: string, dropPoint: { x: number; y: number }) {
    let targetId: string | null = null;
    widgetRefs.current.forEach((el, id) => {
      if (id === draggedId || !el) return;
      const r = el.getBoundingClientRect();
      if (
        dropPoint.x >= r.left &&
        dropPoint.x <= r.right &&
        dropPoint.y >= r.top &&
        dropPoint.y <= r.bottom
      ) {
        targetId = id;
      }
    });
    if (!targetId) return;
    const from = layout.findIndex((e) => e.id === draggedId);
    const to = layout.findIndex((e) => e.id === targetId);
    if (from === -1 || to === -1 || from === to) return;
    const next = layout.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onLayoutChange(next);
  }

  function renderPinnedWidget(chartId: AnalyticsChartId) {
    return (
      <div
        style={{
          padding: '14px 16px 10px',
          borderRadius: 12,
          border: '1px solid var(--color-border-subtle)',
          background: '#fff',
          boxShadow: '0 2px 12px rgba(58,48,40,0.07)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 11 }}>📌</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', flex: 1, minWidth: 0 }}>
            {ANALYTICS_CONFIG[chartId].label}
          </span>
          <QuinnInsightButton chartId={chartId} text={ANALYTICS_CONFIG[chartId].reasoning} />
        </div>
        {renderAnalyticsChart(chartId)}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: 'var(--font-primary)',
        maxWidth: 1400,
        margin: '0 auto',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          paddingTop: heroGreeting ? 20 : 0,
          paddingBottom: heroGreeting ? 12 : 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          {heroGreeting ? (
            <>
              <h1
                style={{
                  margin: 0,
                  fontSize: 30,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: 'var(--color-text-primary)',
                  lineHeight: 1.15,
                }}
              >
                {heroGreeting}
              </h1>
              <p
                style={{
                  margin: '8px 0 0',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.4,
                }}
              >
                7 open clubs across the chain · ask Quinn anything to add a chart
              </p>
            </>
          ) : (
            <>
              <h1 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Playtomic <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>· chain dashboard</span>
              </h1>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                Dummy data · 7 open clubs · ask Quinn anything to add a chart
              </p>
            </>
          )}
        </div>
        <DashboardEditToolbar
          editing={editing}
          onToggleEdit={onToggleEdit}
          onAddInsight={onAddInsight}
          leadingControls={toolbarLeadingControls}
        />
      </div>

      {belowHeader}

      {tab !== 'manchester' && (
        <div
          role="tablist"
          aria-label="Playtomic dashboard view"
          style={{
            alignSelf: 'flex-start',
            display: 'flex',
            gap: 4,
            padding: 4,
            borderRadius: 999,
            background: 'var(--color-bg-hover)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          {VISIBLE_TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                  background: active ? 'var(--color-accent-active)' : 'transparent',
                  color: active ? '#fff' : 'var(--color-text-muted)',
                  boxShadow: active ? '0 2px 8px rgba(34,68,68,0.25)' : 'none',
                  transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <div role="tabpanel">
        {tab === 'overview' && <PlaytomicOverview />}
        {tab === 'chain' && (
          <ChainPulse
            onVenueClick={(name) => {
              if (name === 'Manchester') setTab('manchester');
            }}
          />
        )}
        {tab === 'manchester' && <ManchesterDeepDive onBack={() => setTab('chain')} />}
      </div>

      {visiblePinned.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              marginTop: 4,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
              }}
            >
              Pinned insights
            </h2>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
              Charts you&apos;ve pinned from Quinn appear here.
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 14,
              gridAutoFlow: 'dense',
            }}
          >
            {visiblePinned.map((entry) => {
              const pinned = pinnedChartIdOf(entry.id);
              if (!pinned) return null;
              return (
                <div
                  key={entry.id}
                  ref={(el) => {
                    if (el) widgetRefs.current.set(entry.id, el);
                    else widgetRefs.current.delete(entry.id);
                  }}
                  style={{
                    gridColumn: `span ${widthOf(entry) === 'full' ? 2 : 1} / span ${widthOf(entry) === 'full' ? 2 : 1}`,
                    minWidth: 0,
                  }}
                >
                  <DashboardWidget
                    id={entry.id}
                    editing={editing}
                    visible={entry.visible}
                    width={widthOf(entry)}
                    onToggleVisible={() => toggleVisible(entry.id)}
                    onToggleWidth={isHalfOnlyChart(pinned) ? undefined : () => toggleWidth(entry.id)}
                    onDragEnd={(point) => handleDragEnd(entry.id, point)}
                    onRemove={() => {
                      onRemovePinned(pinned);
                      removeEntry(entry.id);
                    }}
                  >
                    {renderPinnedWidget(pinned)}
                  </DashboardWidget>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

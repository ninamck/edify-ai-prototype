'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Plus, X } from 'lucide-react';
import CulinaryOverview from '@/components/Dashboard/CulinaryCollective/CulinaryOverview';
import FlashReport from '@/components/Dashboard/CulinaryCollective/FlashReport';
import DashboardEditToolbar from '@/components/Dashboard/DashboardEditToolbar';
import DashboardWidget from '@/components/Dashboard/DashboardWidget';
import DateRangePicker, { type DateRange } from '@/components/Mvp1/DateRangePicker';
import DownloadMenu from '@/components/Dashboard/CulinaryCollective/parts/DownloadMenu';
import {
  DASHBOARD_EXPORT_SECTIONS,
  FLASH_EXPORT_SECTIONS,
} from '@/components/Dashboard/CulinaryCollective/data/exports';
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
import { FIS_HEADLINE } from '@/components/Dashboard/CulinaryCollective/data/fisMockData';

const BUILTIN_TABS: { id: string; label: string }[] = [
  { id: 'overview', label: 'Dashboard' },
  { id: 'flash', label: 'Flash' },
];

type CustomTab = { id: string; name: string };

const CUSTOM_TABS_STORAGE_KEY = 'edify:culinary-custom-tabs';

function genCustomTabId(): string {
  return `cc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Read persisted custom tabs from localStorage. SSR-safe. */
function loadStoredCustomTabs(): CustomTab[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_TABS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (t: unknown): t is CustomTab =>
          !!t &&
          typeof t === 'object' &&
          typeof (t as CustomTab).id === 'string' &&
          typeof (t as CustomTab).name === 'string',
      )
      .map((t) => ({ id: t.id, name: t.name }));
  } catch {
    return [];
  }
}

export default function CulinaryCollectiveDashboard({
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
  /** When provided, render the page header in hero style. */
  heroGreeting?: string;
}) {
  // Active tab id can be 'overview', 'flash', or any custom tab id (cc-*).
  const [tab, setTab] = useState<string>('overview');
  // Date range is a cosmetic control on this demo: the FIS spreadsheet is a
  // hand-extracted snapshot for week ending 17-May, not a live query, so
  // changing the picker doesn't refilter the tables. It mirrors the Dunkin
  // demo's affordance so the UI feels consistent.
  const [dateRange, setDateRange] = useState<DateRange>({ kind: 'week' });

  // Custom user-created tabs. Seeded from localStorage on mount so a demo
  // operator can build up a few pages and have them survive reloads. We
  // hydrate after first render to avoid SSR/CSR mismatch warnings.
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setCustomTabs(loadStoredCustomTabs());
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CUSTOM_TABS_STORAGE_KEY, JSON.stringify(customTabs));
    } catch {
      // localStorage might be unavailable (private mode, quota); silently skip.
    }
  }, [customTabs]);

  function handleAddCustomTab() {
    // Auto-name "New page", "New page 2", "New page 3" so two clicks in a
    // row don't produce two identically labelled tabs.
    const taken = new Set(customTabs.map((t) => t.name.toLowerCase()));
    let name = 'New page';
    let n = 2;
    while (taken.has(name.toLowerCase())) {
      name = `New page ${n++}`;
    }
    const next: CustomTab = { id: genCustomTabId(), name };
    setCustomTabs((prev) => [...prev, next]);
    setTab(next.id);
  }

  function handleRenameCustomTab(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCustomTabs((prev) => prev.map((t) => (t.id === id ? { ...t, name: trimmed } : t)));
  }

  function handleRemoveCustomTab(id: string) {
    setCustomTabs((prev) => prev.filter((t) => t.id !== id));
    // If we just removed the active tab, fall back to Dashboard.
    setTab((prev) => (prev === id ? 'overview' : prev));
  }

  const activeCustomTab = customTabs.find((t) => t.id === tab) ?? null;

  const widgetRefs = useRef<Map<string, HTMLElement>>(new Map());

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
          boxShadow: '0 2px 12px rgba(0, 28, 53,0.07)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 11 }}>📌</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              flex: 1,
              minWidth: 0,
            }}
          >
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
                Flat Iron Square · {FIS_HEADLINE.weekEndingLong}
              </p>
            </>
          ) : (
            <>
              <h1
                style={{
                  margin: '0 0 4px',
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                }}
              >
                Culinary Collective{' '}
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  · Flat Iron Square
                </span>
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                }}
              >
                Dummy data · {FIS_HEADLINE.weekEndingLong}
              </p>
            </>
          )}
        </div>
        <DashboardEditToolbar
          editing={editing}
          onToggleEdit={onToggleEdit}
          onAddInsight={onAddInsight}
          leadingControls={
            <>
              {toolbarLeadingControls}
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              {tab !== 'overview' && tab !== 'flash' ? null : (
                <DownloadMenu
                  sections={
                    tab === 'flash' ? FLASH_EXPORT_SECTIONS : DASHBOARD_EXPORT_SECTIONS
                  }
                  filenamePrefix={
                    tab === 'flash' ? 'culinary-collective-flash' : 'culinary-collective-dashboard'
                  }
                  perSectionHeader={
                    tab === 'flash' ? 'Flash sections' : 'Dashboard sections'
                  }
                />
              )}
            </>
          }
        />
      </div>

      {belowHeader}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div
          role="tablist"
          aria-label="Culinary Collective dashboard view"
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
          {BUILTIN_TABS.map((t) => (
            <BuiltinTabButton
              key={t.id}
              label={t.label}
              active={tab === t.id}
              onSelect={() => setTab(t.id)}
            />
          ))}
          {customTabs.map((t) => (
            <CustomTabPill
              key={t.id}
              tab={t}
              active={tab === t.id}
              onSelect={() => setTab(t.id)}
              onRename={(name) => handleRenameCustomTab(t.id, name)}
              onRemove={() => handleRemoveCustomTab(t.id)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddCustomTab}
          aria-label="Add new page"
          title="Add new page"
          style={addButtonStyle}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'var(--color-bg-hover)';
            (e.currentTarget as HTMLButtonElement).style.color =
              'var(--color-text-secondary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#fff';
            (e.currentTarget as HTMLButtonElement).style.color =
              'var(--color-text-muted)';
          }}
        >
          <Plus size={13} strokeWidth={2.4} />
        </button>
      </div>

      <div role="tabpanel">
        {tab === 'overview' && <CulinaryOverview />}
        {tab === 'flash' && <FlashReport />}
        {activeCustomTab && (
          <CustomTabEmptyState
            name={activeCustomTab.name}
            onAddInsight={onAddInsight}
            onToggleEdit={onToggleEdit}
          />
        )}
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
              Charts you&apos;ve pinned from Edify appear here.
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
                    onToggleWidth={
                      isHalfOnlyChart(pinned) ? undefined : () => toggleWidth(entry.id)
                    }
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

// ---------------------------------------------------------------------------
// Tab strip pieces
// ---------------------------------------------------------------------------

const tabBaseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  borderRadius: 999,
  border: 'none',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
  transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
  whiteSpace: 'nowrap',
};

function BuiltinTabButton({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      style={{
        ...tabBaseStyle,
        background: active ? 'var(--color-accent-active)' : 'transparent',
        color: active ? '#fff' : 'var(--color-text-muted)',
        boxShadow: active ? '0 2px 8px rgba(34,68,68,0.25)' : 'none',
      }}
    >
      {label}
    </button>
  );
}

function CustomTabPill({
  tab,
  active,
  onSelect,
  onRename,
  onRemove,
}: {
  tab: CustomTab;
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tab.name);
  const [hovered, setHovered] = useState(false);

  function commit() {
    if (draft.trim()) onRename(draft);
    else setDraft(tab.name);
    setEditing(false);
  }

  return (
    <div
      role="tab"
      aria-selected={active}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (!editing) onSelect();
      }}
      style={{
        ...tabBaseStyle,
        background: active ? 'var(--color-accent-active)' : 'transparent',
        color: active ? '#fff' : 'var(--color-text-muted)',
        boxShadow: active ? '0 2px 8px rgba(34,68,68,0.25)' : 'none',
      }}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(tab.name);
              setEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontFamily: 'var(--font-primary)',
            fontSize: 12,
            fontWeight: 600,
            padding: '2px 6px',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 4,
            outline: 'none',
            minWidth: 100,
            background: '#fff',
            color: 'var(--color-text-primary)',
          }}
        />
      ) : (
        <span
          onDoubleClick={(e) => {
            e.stopPropagation();
            setDraft(tab.name);
            setEditing(true);
          }}
          title="Double-click to rename"
        >
          {tab.name}
        </span>
      )}

      {hovered && !editing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${tab.name}`}
          title="Remove page"
          style={{
            all: 'unset',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            borderRadius: 999,
            cursor: 'pointer',
            color: active ? 'rgba(255,255,255,0.85)' : 'var(--color-text-muted)',
            marginLeft: 2,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = active
              ? 'rgba(255,255,255,0.18)'
              : 'rgba(0, 28, 53,0.08)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <X size={11} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

const addButtonStyle: CSSProperties = {
  all: 'unset',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 999,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  cursor: 'pointer',
  color: 'var(--color-text-muted)',
  fontFamily: 'var(--font-primary)',
};

function CustomTabEmptyState({
  name,
  onAddInsight,
  onToggleEdit,
}: {
  name: string;
  onAddInsight: () => void;
  onToggleEdit: () => void;
}) {
  return (
    <div
      style={{
        marginTop: 4,
        padding: '48px 24px',
        borderRadius: 14,
        border: '1.5px dashed var(--color-border-subtle)',
        background:
          'linear-gradient(180deg, var(--color-bg-surface) 0%, #ffffff 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}
      >
        New page
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
        }}
      >
        {name}
      </div>
      <p
        style={{
          margin: 0,
          maxWidth: 460,
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--color-text-muted)',
          lineHeight: 1.5,
        }}
      >
        This page is empty. Use{' '}
        <strong style={{ color: 'var(--color-text-secondary)' }}>Add insight</strong>{' '}
        to drop in a chart, or toggle{' '}
        <strong style={{ color: 'var(--color-text-secondary)' }}>Edit view</strong>{' '}
        to rearrange. Double-click the tab to rename it.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={onAddInsight} style={emptyStatePrimaryBtn}>
          Add insight
        </button>
        <button type="button" onClick={onToggleEdit} style={emptyStateSecondaryBtn}>
          Edit view
        </button>
      </div>
    </div>
  );
}

const emptyStatePrimaryBtn: CSSProperties = {
  all: 'unset',
  padding: '8px 14px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
  background: 'var(--color-accent-active)',
  color: '#fff',
  boxShadow: '0 2px 8px rgba(34,68,68,0.25)',
};

const emptyStateSecondaryBtn: CSSProperties = {
  all: 'unset',
  padding: '8px 14px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
  background: '#fff',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border-subtle)',
};

'use client';

// "All sites" home tab: the eight cross-estate charts. The tab only exists
// while the sidebar site switcher is on All sites (HomeShell adds it to the
// tab strip on `isAllSites`), because every tile compares sites, suppliers
// or recipes across the estate and a single site has nothing to show.
//
// Layout (order, hidden, half/full) is editable through the shared Edit view
// toggle and persists in localStorage via useAllSitesLayout. Chart drawing
// lives in parts/AllSitesCharts.tsx; the business rules behind each chart
// are documented in data/allSitesMockData.ts.

import { useRef, type ReactNode } from 'react';
import DashboardWidget from '@/components/Dashboard/DashboardWidget';
import TileActions from '@/components/ScheduledReports/TileActions';
import { widthOf, type DashboardLayoutEntry, type WidgetWidth } from '@/components/Dashboard/layoutTypes';
import { ALL_SITES } from '@/components/Dashboard/permissions/sites';
import { useAllSitesLayout } from '@/hooks/useAllSitesLayout';
import {
  ForecastVsActualChart,
  MenuContributionChart,
  PriceRisesChart,
  RecipeDriftChart,
  StocktakeHygieneChart,
  SupplierSpendChart,
  UsageGapChart,
  WasteBySiteChart,
} from '@/components/Dashboard/parts/AllSitesCharts';

type Tile = { title: string; height: number; window: string; chart: ReactNode };

const TILES: Record<string, Tile> = {
  'all-sites:supplier-spend': {
    title: 'Spend by supplier · this month vs last',
    height: 300,
    window: 'Month to date vs same days last month',
    chart: <SupplierSpendChart />,
  },
  'all-sites:price-rises': {
    title: 'Biggest ingredient price rises · 90 days',
    height: 300,
    window: 'Last 90 days',
    chart: <PriceRisesChart />,
  },
  'all-sites:recipe-drift': {
    title: 'Recipe cost drift past target GP',
    height: 320,
    window: 'Current recipe costs',
    chart: <RecipeDriftChart />,
  },
  'all-sites:stocktake-hygiene': {
    title: 'Stocktake hygiene · days since last count',
    height: 320,
    window: 'As of today',
    chart: <StocktakeHygieneChart />,
  },
  'all-sites:waste-by-site': {
    title: 'Waste £ by site and reason',
    height: 340,
    window: 'Month to date',
    chart: <WasteBySiteChart />,
  },
  'all-sites:forecast-vs-actual': {
    title: 'Forecast vs actual sales by site · POS',
    height: 280,
    window: 'This week',
    chart: <ForecastVsActualChart />,
  },
  'all-sites:usage-gap': {
    title: 'Theoretical vs actual usage · top 10 by £ gap',
    height: 380,
    window: 'Month to date',
    chart: <UsageGapChart />,
  },
  'all-sites:menu-contribution': {
    title: 'Menu contribution · volume vs GP per item · POS',
    height: 380,
    window: 'This week',
    chart: <MenuContributionChart />,
  },
};

// Offered as "include more insights" in the schedule-report drawer.
const TILE_TITLES = Object.values(TILES).map((t) => t.title);

function ChartCard({
  title,
  actions,
  children,
  height,
}: {
  title: string;
  /** Chat/Email chips, pinned to the right of the title. */
  actions?: ReactNode;
  children: ReactNode;
  height: number;
}) {
  return (
    <div
      style={{
        padding: '16px 16px 12px',
        borderRadius: '12px 0 12px 12px',
        border: '1px solid #001C35',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(0, 28, 53,0.1), 0 0 0 1px rgba(0, 28, 53,0.03)',
        minHeight: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', flex: 1, minWidth: 0 }}>
          {title}
        </div>
        {actions}
      </div>
      <div style={{ width: '100%', height }}>{children}</div>
    </div>
  );
}

export default function AllSitesDashboard({
  editing,
  controls,
}: {
  editing: boolean;
  /** Toolbar cluster (date range + Add insight + Edit view) from HomeShell. */
  controls?: ReactNode;
}) {
  const { layout, setLayout } = useAllSitesLayout();
  const widgetRefs = useRef<Map<string, HTMLElement>>(new Map());

  function renderTile(id: string): ReactNode {
    const tile = TILES[id];
    if (!tile) return null;
    return (
      <ChartCard
        title={tile.title}
        height={tile.height}
        actions={
          <TileActions
            insightTitle={tile.title}
            siteLabel={`All sites (${ALL_SITES.length})`}
            siblingInsights={TILE_TITLES}
            dataWindowLabel={tile.window}
          />
        }
      >
        {tile.chart}
      </ChartCard>
    );
  }

  function toggleVisible(id: string) {
    setLayout(layout.map((e) => (e.id === id ? { ...e, visible: !e.visible } : e)));
  }

  function toggleWidth(id: string) {
    setLayout(
      layout.map((e) =>
        e.id === id ? { ...e, width: (widthOf(e) === 'full' ? 'half' : 'full') as WidgetWidth } : e,
      ),
    );
  }

  function handleDragEnd(draggedId: string, dropPoint: { x: number; y: number }) {
    let targetId: string | null = null;
    widgetRefs.current.forEach((el, id) => {
      if (id === draggedId || !el) return;
      const r = el.getBoundingClientRect();
      if (dropPoint.x >= r.left && dropPoint.x <= r.right && dropPoint.y >= r.top && dropPoint.y <= r.bottom) {
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
    setLayout(next);
  }

  const entries: DashboardLayoutEntry[] = editing ? layout : layout.filter((e) => e.visible);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
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
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Across all sites
          </h1>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
            Dummy data · {ALL_SITES.length} sites · each tile states its own window
          </p>
        </div>
        {controls}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 14,
          gridAutoFlow: 'dense',
        }}
      >
        {entries.map((entry) => (
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
              onToggleWidth={() => toggleWidth(entry.id)}
              onDragEnd={(point) => handleDragEnd(entry.id, point)}
            >
              {renderTile(entry.id)}
            </DashboardWidget>
          </div>
        ))}
      </div>
    </div>
  );
}

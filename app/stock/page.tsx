'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import HealthStrip from '@/components/Stock/HealthStrip';
import AttentionList from '@/components/Stock/AttentionList';
import AllItemsTable from '@/components/Stock/AllItemsTable';
import EstateGrid from '@/components/Stock/EstateGrid';
import ItemDetailDrawer from '@/components/Stock/ItemDetailDrawer';
import StocktakeView from '@/components/Stock/StocktakeView';
import StocktakeList from '@/components/Stock/StocktakeList';
import StocktakeReviewView from '@/components/Stock/StocktakeReviewView';
import VoiceCountView from '@/components/Stock/VoiceCountView';
import { ESTATE_SITES } from '@/components/Stock/fixtures';
import {
  STOCK_LOCATION_ORDER,
  getStockStatus,
  locationForItem,
  stockValue,
  summariseSite,
  summariseEstate,
  type CountTarget,
  type ItemGroup,
  type StockItem,
  type StockLocation,
  type StocktakeRecord,
  type StocktakeStatus,
} from '@/components/Stock/status';
import {
  TOP_NAV_BAR_PADDING,
  TOP_NAV_PILL_ACTIVE,
  TOP_NAV_PILL_BASE,
  TOP_NAV_PILL_GAP,
  TOP_NAV_PILL_IDLE_TRANSPARENT,
} from '@/components/Production/topNavStyles';

// Single sticky pill strip — matches Production / Manage menu so all the
// managed areas of the app read as one system.
//
// View shape follows the active persona:
//   • All sites    → [Estate] · [Stocktake] (estate-wide read-only history)
//   • Any one site → [Stocktake] · [Live stock levels]
//
// Stocktake is the default landing surface for a site persona — it's
// the workflow operators actively use day-to-day; "Live stock levels"
// sits next to it as the comprehensive ledger reference.
//
// "Needs attention" no longer lives as its own tab — it's an always-
// visible notification pill on the right of the nav strip
// (`AttentionTrigger` below) that opens a right-anchored drawer
// listing the flagged items. Modelled on the Quinn header trigger in
// Production: the count is always on screen regardless of which tab
// you're on, so the operator never has to leave their current surface
// to see what needs a decision.
//
// The Stocktake tab has two internal modes: a list (open + completed
// records, controlled by `activeStocktakeId === null`) and the count
// flow (when an id is set). Past counts and the open count live in the
// same list so the operator never has to ask "where is my in-flight
// stocktake?".
//
// Drilling into a tile from the Estate grid auto-switches the active
// site to the clicked one, which naturally flips the view set to
// site-level since `isAllSites` becomes false.
type View = 'estate' | 'all' | 'stocktake';

type Tab = { id: View; label: string };

const SITE_VIEWS: ReadonlySet<View> = new Set(['all', 'stocktake']);

// Local edit overrides — the prototype has no real backend, but the
// user can still tweak "on hand" / "stock unit" from the table or
// drawer and see consistent values everywhere on screen. Keyed by item
// id; merged into the rendered items in the page.
type ItemOverride = { currentStock?: number; stockUnit?: string };

function applyOverrides(
  items: StockItem[],
  overrides: Record<string, ItemOverride>,
): StockItem[] {
  return items.map(item => {
    const patch = overrides[item.id];
    if (!patch) return item;
    return {
      ...item,
      currentStock: patch.currentStock ?? item.currentStock,
      stockUnit: patch.stockUnit ?? item.stockUnit,
    };
  });
}

// Inner component holds the actual page body. It reads from
// `useSearchParams`, which Next.js requires to sit inside a Suspense
// boundary during prerendering — otherwise `next build` bails on
// `/stock` with a prerender error. The default export below wraps
// this in <Suspense>, matching the pattern used by app/orders/page.tsx
// and the other deep-linked routes in this repo.
function StockPageInner() {
  const { isAllSites, activeSiteId, setActiveSiteId } = useActiveSite();
  const searchParams = useSearchParams();

  // Deep-link support: `?tab=stocktake` from item-detail CTAs and floor
  // actions. Only honoured for site-level personas; All-sites always
  // shows Estate regardless.
  const initialView: View = (() => {
    if (isAllSites) return 'estate';
    const tab = searchParams.get('tab');
    if (tab && SITE_VIEWS.has(tab as View)) return tab as View;
    // Stocktake is the default site-level surface — it's the workflow
    // operators reach for first, and the always-on AttentionTrigger
    // covers the "what needs a decision right now" question that
    // 'attention' used to answer.
    return 'stocktake';
  })();

  const [view, setView] = useState<View>(initialView);
  // Lazy-mount the item drawer the first time the operator selects an
  // item. Keeps the always-on portal + framer AnimatePresence out of
  // the tree on initial paint and during early tab flicking — which
  // for someone who never opens an item is the entire session — but
  // preserves the slide-out exit animation once it's been shown,
  // because AnimatePresence stays mounted thereafter.
  const [drawerEverShown, setDrawerEverShown] = useState(false);
  // Tab switches mount a fresh subtree (AllItemsTable has ~50 rows of
  // editable cells, StocktakeList ships its create-group drawer, etc.)
  // so we lift the swap into a transition. The pill responds to the
  // click immediately — `pendingView` paints active straight away —
  // while React reconciles the new content off the critical path. Keeps
  // the surface from feeling janky on the first switch into a tab the
  // user hasn't seen yet.
  const [pendingView, setPendingView] = useState<View>(initialView);
  const [, startViewTransition] = useTransition();
  const selectView = useCallback((next: View) => {
    setPendingView(next);
    startViewTransition(() => setView(next));
  }, []);
  const [overrides, setOverrides] = useState<Record<string, ItemOverride>>({});
  // Per-record status overrides — set by the variance-review surface
  // when the operator submits a needs-review stocktake. Lets the
  // Stocktake list show the row as Completed straight after submit,
  // without needing fixture rewrites. Keyed by record id; merged at
  // render time so the underlying fixtures stay untouched.
  const [stocktakeStatusOverrides, setStocktakeStatusOverrides] = useState<
    Record<string, StocktakeStatus>
  >({});
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  // Stocktake drill-in state. `null` (default) → the Stocktake tab
  // shows the list view. When set, the count flow renders against
  // this target — its `kind` decides scope:
  //   • continue → resume a stocktake by record id
  //   • full     → fresh count of every item at the site
  //   • area     → fresh count of one storage location
  //   • quick    → fresh count of currently-flagged items only
  const [activeTarget, setActiveTarget] = useState<CountTarget | null>(null);
  // Voice modality flag — orthogonal to scope. When true and a count
  // is in flight (activeTarget !== null), the page renders
  // VoiceCountView against the *same* item set the StocktakeView
  // would have shown, so swapping in/out doesn't lose the operator's
  // place. Cleared automatically when the site, view, or scope
  // changes — voice is always a "within this specific count" action.
  const [voiceMode, setVoiceMode] = useState(false);
  // User-added item groups, keyed by site id. Merged with fixture
  // defaults at render time so the operator's additions appear next
  // to "High-value items" / "Perishables" without overwriting them.
  // Client-state only (no backend in the prototype) — clears on page
  // reload, which is the intended behaviour for this iteration.
  const [userGroups, setUserGroups] = useState<Record<string, ItemGroup[]>>({});

  // Keep `view` in sync with the persona. When the user swaps between
  // "All sites" and a specific site via the SiteSwitcher, the tab set
  // changes underneath them — without this, an "attention" view could
  // leak into the All-sites persona (where no site-level data exists)
  // or vice versa. All-sites supports two tabs (estate + stocktake);
  // anything else snaps back to 'estate'.
  useEffect(() => {
    if (isAllSites && view !== 'estate' && view !== 'stocktake') {
      setView('estate');
      setPendingView('estate');
    }
    if (!isAllSites && !SITE_VIEWS.has(view)) {
      setView('stocktake');
      setPendingView('stocktake');
    }
  }, [isAllSites, view]);

  // Close the drawer whenever the active site changes — the open item
  // belongs to the previous site and would be stale. Same logic for
  // any open stocktake drill-in: the record id won't exist at the new
  // site.
  useEffect(() => {
    setSelectedItemId(null);
    setActiveTarget(null);
    setVoiceMode(false);
  }, [activeSiteId]);

  // Leaving the Stocktake tab abandons any open drill-in so revisiting
  // the tab lands you back on the list.
  useEffect(() => {
    if (view !== 'stocktake') {
      setActiveTarget(null);
      setVoiceMode(false);
    }
  }, [view]);

  // Closing the count entirely (back to the list) also clears voice
  // mode — it's never meaningful without an active scope.
  useEffect(() => {
    if (!activeTarget) setVoiceMode(false);
  }, [activeTarget]);

  // The active site's full snapshot. Falls back to the first snapshot
  // if the persona's site isn't in the fixture set so the prototype
  // never crashes.
  const activeSite = useMemo(() => {
    return ESTATE_SITES.find(s => s.siteId === activeSiteId) ?? ESTATE_SITES[0];
  }, [activeSiteId]);

  // Items for the *currently active* site, with the operator's local
  // edits merged in. "All sites" has no per-site items of its own; the
  // Estate view doesn't read this. Specific-site personas read it.
  const activeSiteItems = useMemo(
    () => applyOverrides(activeSite.items, overrides),
    [activeSite, overrides],
  );

  const siteSummary = useMemo(() => summariseSite(activeSiteItems), [activeSiteItems]);
  const estateSummary = useMemo(() => summariseEstate(ESTATE_SITES), []);
  const oldestSiteStocktake = useMemo(
    () => Math.max(...activeSiteItems.map(i => i.stockDataAgeDays), 0),
    [activeSiteItems],
  );

  const selectedItem = useMemo(
    () => activeSiteItems.find(i => i.id === selectedItemId) ?? null,
    [activeSiteItems, selectedItemId],
  );

  const handleItemEdit = useCallback(
    (id: string, patch: ItemOverride) => {
      setOverrides(prev => ({
        ...prev,
        [id]: { ...prev[id], ...patch },
      }));
    },
    [],
  );

  const handleSelectItem = useCallback((item: StockItem) => {
    setSelectedItemId(item.id);
    setDrawerEverShown(true);
  }, []);

  function handleSiteDrillIn(siteId: string) {
    setActiveSiteId(siteId);
    selectView('stocktake');
  }

  // Site-level tabs lead with the workflow surface ("Stocktake") —
  // it's where operators actually do work day-to-day. "Live stock
  // levels" follows as the comprehensive ledger reference. The
  // decision-oriented "Needs attention" view used to sit first; it's
  // now an always-visible drawer trigger on the right of the nav
  // instead, so the count is reachable from whichever tab the
  // operator is on.
  const tabs: Tab[] = isAllSites
    ? [
        { id: 'estate',    label: 'Estate' },
        { id: 'stocktake', label: 'Stocktake' },
      ]
    : [
        { id: 'stocktake', label: 'Stocktake' },
        { id: 'all',       label: 'Live stock levels' },
      ];

  // ── Stocktake derivations ──────────────────────────────────────────
  // The StocktakeList shows three "how do you want to count?" cards;
  // it needs a tiny bit of context from the site to render them:
  //   • flaggedItemCount  — drives the Quick-count card's badge and
  //     whether it's offered at all (zero ⇒ disabled).
  //   • availableLocations — drives the Area-count card's inline
  //     location-picker pills. Restricted to locations that actually
  //     have items at this site so we don't surface empty zones.
  const flaggedItemCount = useMemo(
    () => activeSiteItems.filter(i => getStockStatus(i) !== 'healthy').length,
    [activeSiteItems],
  );

  // ── Needs-attention drawer ─────────────────────────────────────────
  // Triggered from the pill on the right of the nav strip. Right-
  // anchored drawer (mirrors ItemDetailDrawer's portal + framer slide
  // pattern) so the surface is familiar across the page. Closed by
  // default; forced shut whenever the persona flips to All-sites
  // (there is no per-site attention list to show estate-wide) or the
  // active site changes (the open drawer would show items from the
  // previous site).
  const [attentionOpen, setAttentionOpen] = useState(false);

  useEffect(() => {
    if (isAllSites && attentionOpen) setAttentionOpen(false);
  }, [isAllSites, attentionOpen]);

  useEffect(() => {
    setAttentionOpen(false);
  }, [activeSiteId]);

  const availableLocations = useMemo<StockLocation[]>(() => {
    const present = new Set<StockLocation>();
    for (const item of activeSiteItems) present.add(locationForItem(item));
    return STOCK_LOCATION_ORDER.filter(loc => present.has(loc));
  }, [activeSiteItems]);

  // Merged list of item groups for the active site — fixture defaults
  // first, then anything the operator's added this session. The
  // StocktakeList button row renders straight off this so the user's
  // additions appear immediately on create.
  const siteGroups = useMemo<ItemGroup[]>(() => {
    return [
      ...activeSite.itemGroups,
      ...(userGroups[activeSite.siteId] ?? []),
    ];
  }, [activeSite.itemGroups, activeSite.siteId, userGroups]);

  // £-value rollups for the leading summary tile on the Stocktake
  // list. Per-site for the standalone Stocktake tab; estate-wide for
  // the All-sites Stocktake tab.
  const siteEstimatedStockValue = useMemo(
    () => activeSiteItems.reduce((sum, i) => sum + (stockValue(i) ?? 0), 0),
    [activeSiteItems],
  );

  const estateEstimatedStockValue = useMemo(
    () =>
      ESTATE_SITES.reduce(
        (total, site) =>
          total + site.items.reduce((s, i) => s + (stockValue(i) ?? 0), 0),
        0,
      ),
    [],
  );

  // Apply the operator's in-session status overrides to a record set.
  // Pure helper — both per-site and estate-wide histories run through
  // this so a submitted review reads as "Completed" on either view.
  const applyStatusOverrides = useCallback(
    (records: StocktakeRecord[]): StocktakeRecord[] => {
      return records.map(record => {
        const patched = stocktakeStatusOverrides[record.id];
        return patched ? { ...record, status: patched } : record;
      });
    },
    [stocktakeStatusOverrides],
  );

  const activeSiteHistory = useMemo(
    () => applyStatusOverrides(activeSite.stocktakeHistory),
    [activeSite.stocktakeHistory, applyStatusOverrides],
  );

  // Estate-wide stocktake history with each record's site denormalised
  // onto it. Sorted most recent first so the table reads as a single
  // timeline across the estate. Only consumed by the All-sites
  // Stocktake view.
  const estateHistory = useMemo<StocktakeRecord[]>(() => {
    const merged: StocktakeRecord[] = [];
    for (const site of ESTATE_SITES) {
      for (const record of site.stocktakeHistory) {
        merged.push({ ...record, siteName: site.siteName });
      }
    }
    const overridden = applyStatusOverrides(merged);
    return overridden.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [applyStatusOverrides]);

  // Persist a newly-created group against the active site. Called by
  // StocktakeList when the operator hits "Save" on the create panel.
  const handleCreateGroup = useCallback(
    (group: ItemGroup) => {
      setUserGroups(prev => ({
        ...prev,
        [activeSite.siteId]: [...(prev[activeSite.siteId] ?? []), group],
      }));
    },
    [activeSite.siteId],
  );

  // Resolve what to feed the count view based on the active target.
  // The page is the single place that knows how to translate a scope
  // intent into an item list + (optionally) a backing record, so the
  // view stays a pure renderer.
  const { countItems, countRecord } = useMemo<{
    countItems: StockItem[];
    countRecord: StocktakeRecord | null;
  }>(() => {
    if (!activeTarget) return { countItems: [], countRecord: null };
    switch (activeTarget.kind) {
      case 'continue':
        return {
          countItems: activeSiteItems,
          countRecord:
            activeSiteHistory.find(r => r.id === activeTarget.recordId) ?? null,
        };
      case 'full':
        return { countItems: activeSiteItems, countRecord: null };
      case 'area':
        return {
          countItems: activeSiteItems.filter(
            i => locationForItem(i) === activeTarget.location,
          ),
          countRecord: null,
        };
      case 'quick':
        return {
          countItems: activeSiteItems.filter(
            i => getStockStatus(i) !== 'healthy',
          ),
          countRecord: null,
        };
      case 'group': {
        const group = siteGroups.find(g => g.id === activeTarget.groupId);
        const ids = new Set(group?.itemIds ?? []);
        return {
          countItems: activeSiteItems.filter(i => ids.has(i.id)),
          countRecord: null,
        };
      }
    }
  }, [activeTarget, activeSiteHistory, activeSiteItems, siteGroups]);

  // Variance-review submit handlers. The review view emits one event
  // per stock-affecting resolution (accept-count / log-waste) and a
  // single summary event at the end. We translate the per-line events
  // into the same item-override map that powers manual edits, and the
  // summary event flips the record's status to 'completed' so the
  // Stocktake list reflects the decision on the next render.
  const handleReviewLineResolved = useCallback<
    React.ComponentProps<typeof StocktakeReviewView>['onLineResolved']
  >((line, resolution) => {
    if (resolution === 'recount') return;
    setOverrides(prev => ({
      ...prev,
      [line.itemId]: {
        ...prev[line.itemId],
        currentStock: line.countedQty,
      },
    }));
  }, []);

  const handleReviewSubmit = useCallback<
    React.ComponentProps<typeof StocktakeReviewView>['onSubmit']
  >(summary => {
    // Mark as completed only when there's nothing left to recount;
    // if the reviewer parked any lines for a recount the record
    // stays in 'needs-review' so it remains on the table's open
    // list.
    if (summary.pendingRecountCount === 0) {
      setStocktakeStatusOverrides(prev => ({
        ...prev,
        [summary.recordId]: 'completed',
      }));
    }
    // Give the inline "Review submitted" affordance a beat to play
    // before bouncing back to the list so the operator sees the
    // outcome land.
    window.setTimeout(() => setActiveTarget(null), 900);
  }, []);

  // Branch decision for the Stocktake tab body: review view kicks in
  // when continuing a record that's in needs-review and carries
  // per-line data. Anything else (no record, fresh count, in-progress
  // continue) keeps using the existing StocktakeView.
  const showReviewView =
    activeTarget?.kind === 'continue' &&
    countRecord?.status === 'needs-review' &&
    (countRecord.lines?.length ?? 0) > 0;

  return (
    <>
      {/* Sticky pill strip — mirrors Production / Manage menu (TOP_NAV_*
          constants from `components/Production/topNavStyles.ts`). */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 150,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: TOP_NAV_PILL_GAP,
          padding: TOP_NAV_BAR_PADDING,
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          overflowX: 'auto',
        }}
      >
        {tabs.map(tab => {
          // Active state follows `pendingView` so the pill flips
          // instantly on click; the actual content swap is driven by
          // `view` inside the transition below.
          const active = pendingView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectView(tab.id)}
              style={{
                ...TOP_NAV_PILL_BASE,
                ...(active ? TOP_NAV_PILL_ACTIVE : TOP_NAV_PILL_IDLE_TRANSPARENT),
              }}
            >
              {tab.label}
            </button>
          );
        })}

        {/* Right-aligned notification pill. Persona-gated to site-level
            views — estate-wide doesn't have a single attention list to
            show. Visually mirrors the QuinnTrigger pattern from the
            Production header: navy pill with a white roundel inside
            and a red count badge that lifts off the fill. */}
        {!isAllSites && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            <AttentionTrigger
              count={flaggedItemCount}
              open={attentionOpen}
              onClick={() => setAttentionOpen(o => !o)}
            />
          </div>
        )}
      </nav>

      {/* Drawer lives at page level so it slides over the whole
          content surface. Lazy-rendered by AnimatePresence inside the
          component so it costs nothing until the operator opens it
          for the first time. */}
      {!isAllSites && (
        <AttentionDrawer
          open={attentionOpen}
          count={flaggedItemCount}
          items={activeSiteItems}
          onClose={() => setAttentionOpen(false)}
        />
      )}

      <div
        style={{
          padding: '24px 28px 48px',
          // 1200px keeps the chrome controlled but gives the
          // Live stock levels table enough room to fit its full
          // column set without the filter funnels overlapping the
          // header labels (especially Category / Days cover /
          // Recipes which all sit alongside their filter icon).
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {view === 'estate' && isAllSites ? (
          <>
            <HealthStrip
              summary={estateSummary.aggregate}
              oldestStocktakeAgeDays={estateSummary.oldestStocktakeAgeDays}
              estateSiteCount={estateSummary.siteCount}
            />
            <EstateGrid sites={ESTATE_SITES} onSiteClick={handleSiteDrillIn} />
          </>
        ) : view === 'stocktake' && isAllSites ? (
          // Estate-wide read-only history. No count drill-in is
          // possible here — actions live on the per-site Stocktake
          // tab. The list renders in `aggregated` mode which hides
          // the per-site CTAs and surfaces a Site column.
          <StocktakeList
            history={estateHistory}
            siteName="All sites"
            siteId="estate"
            flaggedItemCount={0}
            totalItemCount={0}
            availableLocations={[]}
            estimatedStockValue={estateEstimatedStockValue}
            groups={[]}
            allItems={[]}
            onStart={() => { /* no-op in aggregated mode */ }}
            onCreateGroup={() => { /* no-op in aggregated mode */ }}
            aggregated
          />
        ) : view === 'stocktake' ? (
          activeTarget ? (
            // Three count surfaces share this slot:
            //   • Variance review when continuing a needs-review
            //     record (focused list of just the variance lines
            //     with per-line resolutions).
            //   • Voice when the operator toggled it on inside the
            //     manual surface.
            //   • Manual count for everything else (fresh count or
            //     resuming an in-progress one).
            // Closing review / voice returns to the manual surface so
            // the operator can keep working; only `onBack` from the
            // manual view exits the count entirely.
            showReviewView && countRecord ? (
              <StocktakeReviewView
                record={countRecord}
                siteName={activeSite.siteName}
                onBack={() => setActiveTarget(null)}
                onLineResolved={handleReviewLineResolved}
                onSubmit={handleReviewSubmit}
              />
            ) : voiceMode ? (
              <VoiceCountView
                items={countItems}
                siteName={activeSite.siteName}
                scope={activeTarget}
                onClose={() => setVoiceMode(false)}
              />
            ) : (
              <StocktakeView
                items={countItems}
                siteName={activeSite.siteName}
                stocktake={countRecord}
                scope={activeTarget}
                onBack={() => setActiveTarget(null)}
                onUseVoice={() => setVoiceMode(true)}
              />
            )
          ) : (
            <StocktakeList
              history={activeSiteHistory}
              siteName={activeSite.siteName}
              siteId={activeSite.siteId}
              flaggedItemCount={flaggedItemCount}
              totalItemCount={activeSiteItems.length}
              availableLocations={availableLocations}
              estimatedStockValue={siteEstimatedStockValue}
              groups={siteGroups}
              allItems={activeSiteItems}
              onStart={target => setActiveTarget(target)}
              onCreateGroup={handleCreateGroup}
            />
          )
        ) : (
          <>
            <HealthStrip
              summary={siteSummary}
              oldestStocktakeAgeDays={oldestSiteStocktake}
            />
            <AllItemsTable
              items={activeSiteItems}
              onItemSelect={handleSelectItem}
              onItemEdit={handleItemEdit}
            />
          </>
        )}
      </div>

      {/* See `drawerEverShown` above — the portal stays out of the
          tree until the operator opens the drawer for the first time. */}
      {drawerEverShown && (
        <ItemDetailDrawer
          item={selectedItem}
          onClose={() => setSelectedItemId(null)}
          onItemEdit={handleItemEdit}
        />
      )}
    </>
  );
}

/**
 * Notification pill that sits on the right of the stock nav. Mirrors
 * the QuinnTrigger pattern from the Production header so the two
 * surfaces read as one design system:
 *
 *   • Navy pill (border-radius 100) on a deep-accent border
 *   • White roundel inside holding the Edify brand mark — same glyph
 *     QuinnTrigger uses, so the two pills read as one family
 *   • Red count badge perched on the top-right corner with a thin
 *     white ring so it lifts off the navy fill at small sizes
 *
 * Active state deepens the fill for a clear pressed look; matches the
 * way QuinnTrigger flips while its panel is open.
 */
function AttentionTrigger({
  count,
  open,
  onClick,
}: {
  count: number;
  open: boolean;
  onClick: () => void;
}) {
  const hasAttention = count > 0;
  return (
    <button
      type="button"
      aria-label={
        hasAttention
          ? `${count} item${count === 1 ? '' : 's'} need attention`
          : 'No items need attention'
      }
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 44,
        padding: '0 16px 0 10px',
        borderRadius: 100,
        background: open ? 'var(--color-accent-deep)' : 'var(--color-accent-active)',
        border: '1px solid var(--color-accent-deep)',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        fontSize: 12,
        fontWeight: 600,
        color: '#ffffff',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#ffffff',
          color: 'var(--color-accent-active)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <EdifyMark size={14} />
      </span>
      {hasAttention && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            minWidth: 22,
            height: 22,
            padding: '0 6px',
            borderRadius: 11,
            background: 'var(--color-error)',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-primary)',
            fontVariantNumeric: 'tabular-nums',
            // Thin white ring lifts the badge off the navy fill so it
            // doesn't visually merge with the pill border at small sizes.
            boxShadow: '0 0 0 1.5px #ffffff',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Right-anchored drawer that lists the items the operator needs to
 * decide on. Same content the old "Needs attention" tab rendered —
 * the AttentionList component — wrapped in the same portal + framer
 * slide pattern as ItemDetailDrawer so the two drawers feel like
 * siblings of one system. Backdrop dims the page and dismisses on
 * click; Escape also closes.
 */
function AttentionDrawer({
  open,
  count,
  items,
  onClose,
}: {
  open: boolean;
  count: number;
  items: StockItem[];
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="attention-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(58,48,40,0.18)',
              zIndex: 700,
            }}
          />
          <motion.aside
            key="attention-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            role="dialog"
            aria-label="Items needing attention"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(560px, 100vw)',
              background: '#fff',
              boxShadow: '-20px 0 60px rgba(58,48,40,0.16)',
              zIndex: 701,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'var(--font-primary)',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  width: 32,
                  height: 32,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Needs attention
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    marginTop: 2,
                  }}
                >
                  {count === 0
                    ? 'Every item is on plan.'
                    : `${count} ${count === 1 ? 'item' : 'items'} flagged.`}
                </div>
              </div>
              {count > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 26,
                    height: 26,
                    padding: '0 8px',
                    borderRadius: 13,
                    background: 'var(--color-error)',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'var(--font-primary)',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}
                >
                  {count}
                </span>
              )}
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: 16,
                background: 'var(--color-bg-surface)',
              }}
            >
              <AttentionList items={items} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// Default export is a thin Suspense wrapper so the inner component
// can safely use `useSearchParams` during the static prerender step
// of `next build`. Fallback is `null` because the inner page hydrates
// almost instantly and any placeholder would flash on first load.
export default function StockPage() {
  return (
    <Suspense fallback={null}>
      <StockPageInner />
    </Suspense>
  );
}

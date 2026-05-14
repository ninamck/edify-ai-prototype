'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import HealthStrip from '@/components/Stock/HealthStrip';
import AttentionList from '@/components/Stock/AttentionList';
import AllItemsTable from '@/components/Stock/AllItemsTable';
import EstateGrid from '@/components/Stock/EstateGrid';
import ItemDetailDrawer from '@/components/Stock/ItemDetailDrawer';
import StocktakeView from '@/components/Stock/StocktakeView';
import StocktakeList from '@/components/Stock/StocktakeList';
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
// "Needs attention" no longer lives as its own tab — it's an always-
// visible notification pill on the right of the nav strip
// (`AttentionTrigger` below) that opens an inline popover listing the
// flagged items. Modelled on the Quinn header trigger in Production:
// the count is always on screen regardless of which tab you're on, so
// the operator never has to leave their current surface to see what
// needs a decision.
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
    // 'all' (Live stock levels) is the default site-level surface now
    // that 'attention' has been promoted to a header-level popover.
    return 'all';
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
      setView('all');
      setPendingView('all');
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
    selectView('all');
  }

  // Site-level tabs lead with the comprehensive ledger ("Live stock
  // levels"), then the workflow surface ("Stocktake"). The decision-
  // oriented "Needs attention" view used to sit first; it's now an
  // always-visible popover on the right of the nav instead, so the
  // count is reachable from whichever tab the operator is on.
  const tabs: Tab[] = isAllSites
    ? [
        { id: 'estate',    label: 'Estate' },
        { id: 'stocktake', label: 'Stocktake' },
      ]
    : [
        { id: 'all',       label: 'Live stock levels' },
        { id: 'stocktake', label: 'Stocktake' },
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

  // ── Needs-attention popover ────────────────────────────────────────
  // Triggered from the pill on the right of the nav strip. We keep it
  // closed by default, dismiss it on outside click + Escape, and force
  // it shut whenever the persona flips to All-sites (there is no
  // per-site attention list to show estate-wide). Anchoring is done
  // via `attentionWrapperRef` so the popover floats below the trigger
  // without needing a separate portal.
  const [attentionOpen, setAttentionOpen] = useState(false);
  const attentionWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isAllSites && attentionOpen) setAttentionOpen(false);
  }, [isAllSites, attentionOpen]);

  useEffect(() => {
    setAttentionOpen(false);
  }, [activeSiteId]);

  useEffect(() => {
    if (!attentionOpen) return;
    function onDocClick(e: MouseEvent) {
      const node = attentionWrapperRef.current;
      if (!node) return;
      if (!node.contains(e.target as Node)) setAttentionOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAttentionOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [attentionOpen]);

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
    return merged.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, []);

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
            activeSite.stocktakeHistory.find(r => r.id === activeTarget.recordId) ?? null,
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
  }, [activeTarget, activeSite.stocktakeHistory, activeSiteItems, siteGroups]);

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
            Production header: pill with a red badge that surfaces a
            count when there's something to look at. */}
        {!isAllSites && (
          <div
            ref={attentionWrapperRef}
            style={{ marginLeft: 'auto', position: 'relative' }}
          >
            <AttentionTrigger
              count={flaggedItemCount}
              open={attentionOpen}
              onClick={() => setAttentionOpen(o => !o)}
            />
            {attentionOpen && (
              <AttentionPopover
                count={flaggedItemCount}
                items={activeSiteItems}
              />
            )}
          </div>
        )}
      </nav>

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
            // Voice is a presentation modality layered over the same
            // count scope, not a separate scope of its own. Closing
            // voice returns to the manual surface so the operator can
            // review / submit; only `onBack` from the manual view
            // exits the count entirely.
            voiceMode ? (
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
              history={activeSite.stocktakeHistory}
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
 * Notification-style pill that sits on the right of the stock nav and
 * exposes the per-site "needs attention" list as a popover. Models its
 * shape on the existing tab pills (TOP_NAV_PILL_BASE) so the strip
 * still reads as a single bar, and borrows the red badge treatment
 * from QuinnTrigger so the count stays legible even when the pill
 * itself is in its default outlined state.
 *
 * Renders the AlertCircle glyph plus the literal "Needs attention"
 * label so the affordance is discoverable on cold landings (a bare
 * number badge would only make sense to someone who already knows
 * what it counts).
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
        ...TOP_NAV_PILL_BASE,
        background: open ? 'var(--color-accent-active)' : '#ffffff',
        color: open ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
        borderColor: open ? 'var(--color-accent-active)' : 'var(--color-border)',
      }}
    >
      <AlertCircle size={16} strokeWidth={2} style={{ opacity: 0.85 }} />
      Needs attention
      {hasAttention && (
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 22,
            height: 22,
            padding: '0 6px',
            borderRadius: 11,
            background: open ? 'rgba(255,255,255,0.22)' : 'var(--color-error)',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Floating panel anchored beneath the AttentionTrigger pill. Holds the
 * full AttentionList (same component the old tab used to render),
 * plus a header summarising "what am I looking at" and a friendly
 * empty state when nothing is flagged. Width is capped at ~520px so
 * it doesn't overrun smaller viewports and gets a max-height +
 * internal scroll so a long list never escapes the viewport.
 */
function AttentionPopover({
  count,
  items,
}: {
  count: number;
  items: StockItem[];
}) {
  return (
    <div
      role="dialog"
      aria-label="Items needing attention"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        zIndex: 200,
        width: 'min(540px, calc(100vw - 32px))',
        maxHeight: 'min(70vh, 640px)',
        overflowY: 'auto',
        background: '#ffffff',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        boxShadow: '0 16px 40px rgba(10, 20, 25, 0.18)',
        padding: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          padding: '0 2px 10px',
          borderBottom: '1px solid var(--color-border-subtle)',
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-primary)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}
          >
            Needs attention
          </div>
          <div
            style={{
              fontFamily: 'var(--font-primary)',
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
              minWidth: 24,
              height: 24,
              padding: '0 8px',
              borderRadius: 12,
              background: 'var(--color-error)',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {count}
          </span>
        )}
      </div>
      <AttentionList items={items} />
    </div>
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

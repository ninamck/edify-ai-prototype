'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, FileText, Layers, LayoutGrid, ListChecks, Scale, Wand2 } from 'lucide-react';
import BenchCardBoard from '@/components/Production/BenchCardBoard';
import BenchBalanceView from '@/components/Production/BenchBalanceView';
import CrewLineDisplay from '@/components/Production/CrewLineDisplay';
import BatchDetailPanel from '@/components/Production/BatchDetailPanel';
import CadenceDetailPanel from '@/components/Production/CadenceDetailPanel';
import BenchIngredientsPanel from '@/components/Production/BenchIngredientsPanel';
import StepperLauncher from '@/components/Production/StepperLauncher';
import type { ProductionItemId, ProductionMode } from '@/components/Production/fixtures';
import {
  DEMO_TODAY,
  PRET_SITES,
  getSite,
  getProductionItem,
  getRecipe,
  benchesAt,
} from '@/components/Production/fixtures';
import type { PlanLine } from '@/components/Production/PlanStore';
import { usePlan } from '@/components/Production/PlanStore';
import { useProductionSite } from '@/components/Production/ProductionSiteContext';
import {
  downloadAllBenchPlansPdf,
  downloadAllBenchSummariesPdf,
  downloadAllIngredientsPdf,
} from '@/lib/pdf/productionPdfs';

type BoardView = 'balance' | 'detail';

// The Bench mode filter (All / Run / Variable / Increment) is hidden for now:
// the Plan/Balance board doesn't yet have an increment-bench planner view, so
// the filter has nowhere useful to send the Variable/Increment slices. Kept in
// place behind this flag so it can be switched back on once those views exist.
const SHOW_MODE_FILTER = false;

// The Balance view is hidden for now — we only surface the Bench detail board.
// The Balance code path (and the BenchBalanceView component) is kept intact so
// the toggle can be switched back on later.
const SHOW_VIEW_TOGGLE = false;

type ModeTabId = 'all' | ProductionMode;

const MODE_TABS: Array<{ id: ModeTabId; label: string }> = [
  { id: 'all',       label: 'All' },
  { id: 'run',       label: 'Batches' },
  { id: 'variable',  label: 'Variable' },
  { id: 'increment', label: 'Increment' },
];

type RunTabId = 'all' | string;

/** Convert "HH:MM" to minutes-from-midnight for ordering run pills. */
function hhmmToMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export default function ProductionBoardPage() {
  const { siteId } = useProductionSite();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedCadenceId, setSelectedCadenceId] = useState<string | null>(null);
  const [selectedBenchId, setSelectedBenchId] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<ProductionItemId | null>(null);
  // Balance (per-run comparison) is the default lens; Bench detail is the
  // editable per-bench card board.
  const [view, setView] = useState<BoardView>('detail');
  const [modeTab, setModeTab] = useState<ModeTabId>('all');
  const [runTab, setRunTab] = useState<RunTabId>('all');
  const site = getSite(siteId) ?? PRET_SITES[0];

  // Counts per tab — based on bench primaryMode at the current site.
  const tabCounts = useMemo(() => {
    const counts: Record<ModeTabId, number> = { all: 0, run: 0, variable: 0, increment: 0 };
    const benches = benchesAt(site.id);
    counts.all = benches.length;
    for (const b of benches) {
      if (b.primaryMode) counts[b.primaryMode] += 1;
    }
    return counts;
  }, [site.id]);

  // Distinct run labels across all benches at this site, ordered by the
  // earliest start time we see for each label. So a site with a bakery N1
  // + R1/R2 and a prep N1 + R1/R2/R3 renders pills as N1 · R1 · R2 · R3.
  // Counts represent the number of benches that include a run with that
  // label (matches BenchCardBoard's run filter scope).
  const runTabs = useMemo(() => {
    const benches = benchesAt(site.id);
    const earliestStart = new Map<string, number>();
    const latestEnd = new Map<string, number>();
    const benchCount = new Map<string, number>();
    for (const b of benches) {
      const labelsOnBench = new Set<string>();
      for (const r of b.runs ?? []) {
        const cur = earliestStart.get(r.label);
        const startMins = hhmmToMins(r.startTime);
        const endMins = startMins + r.durationMinutes;
        if (cur === undefined || startMins < cur) earliestStart.set(r.label, startMins);
        const curEnd = latestEnd.get(r.label);
        if (curEnd === undefined || endMins > curEnd) latestEnd.set(r.label, endMins);
        labelsOnBench.add(r.label);
      }
      for (const label of labelsOnBench) {
        benchCount.set(label, (benchCount.get(label) ?? 0) + 1);
      }
    }
    const labels = Array.from(earliestStart.keys()).sort((a, b) => {
      const sa = earliestStart.get(a) ?? 0;
      const sb = earliestStart.get(b) ?? 0;
      return sa - sb;
    });
    return labels.map(label => ({
      id: label,
      label,
      count: benchCount.get(label) ?? 0,
      startMins: earliestStart.get(label) ?? 0,
      endMins: latestEnd.get(label) ?? 0,
    }));
  }, [site.id]);

  // Current demo time: Thursday 07:30 (only meaningful at the hub, which
  // drives the live clock; elsewhere we anchor the default to the start).
  const nowHHMM = '07:30';

  // On arrival the board opens on the first scheduled run (P1). Recipes are
  // balanced across each bench's runs so no single batch reads near-empty,
  // and the per-run pills let the manager step through P1 → P2 → P3.
  const defaultRun = useMemo<RunTabId>(() => runTabs[0]?.id ?? 'all', [runTabs]);

  // Keep a valid concrete run selected at all times: seed on first render and
  // recover whenever a site switch leaves the current selection pointing at a
  // run this site doesn't have. Sites with no scheduled runs hide the
  // selector entirely and keep the 'all' sentinel.
  useEffect(() => {
    if (runTabs.length === 0) return;
    if (!runTabs.some(t => t.id === runTab)) setRunTab(defaultRun);
  }, [runTabs, runTab, defaultRun]);

  // Clear focus when switching site so stale ids don't resolve on the wrong graph.
  useEffect(() => {
    setFocusedItemId(null);
  }, [siteId]);

  // Escape clears focus + any open detail panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setFocusedItemId(null);
      setSelectedBatchId(null);
      setSelectedBenchId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const focusedRecipeName = focusedItemId
    ? (() => {
        const item = getProductionItem(focusedItemId);
        return item ? getRecipe(item.recipeId)?.name ?? null : null;
      })()
    : null;

  // Pulled at the page level so the "Download all ingredients" toolbar button
  // sees the same plan snapshot — including manager overrides — that the
  // bench cards render from.
  const lines = usePlan(site.id, DEMO_TODAY);

  // Burger King is a standalone hot-production line — no benches. Its "Make"
  // surface is the crew line display (NOW / NEXT / HAVE per station) driven
  // by the live holding cabinet, not the Pret bench board.
  if (site.brand === 'bk') {
    return <CrewLineDisplay siteId={site.id} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Bench mode tabs — filter the bench grid by each bench's primary mode. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 32px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
        }}
      >
        {SHOW_VIEW_TOGGLE && <ViewToggle view={view} onChange={setView} />}
        {SHOW_MODE_FILTER && (
        <>
        <div style={{ width: 1, height: 22, background: 'var(--color-border-subtle)' }} />
        <div
          role="tablist"
          aria-label="Bench mode"
          style={{
            display: 'flex',
            background: 'var(--color-bg-hover)',
            borderRadius: '100px',
            padding: '3px',
            width: 'fit-content',
          }}
        >
          {MODE_TABS.map(t => {
            const active = t.id === modeTab;
            const count = tabCounts[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setModeTab(t.id)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '100px',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                  background: active ? 'var(--color-accent-active)' : 'transparent',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  transition: 'all 0.15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {t.label}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: 100,
                    fontSize: 12,
                    fontWeight: 700,
                    background: active ? 'rgba(255,255,255,0.25)' : 'var(--color-border-subtle)',
                    color: active ? '#fff' : 'var(--color-text-secondary)',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        </>
        )}
        <div style={{ flex: 1 }} />
        <StepperLauncher siteId={site.id} date={DEMO_TODAY} variant="ghost" />
        <PrefillBenchesButton />
        <DownloadMenuButton siteId={site.id} date={DEMO_TODAY} lines={lines} />
      </div>

      {/* Run-label filter — sits beneath the mode tabs and scopes the
          board to a single scheduled run (R1, R2, R3, N1, …). Composes
          with the mode tabs above: e.g. Mode=Run + Run=R1 narrows to
          run-mode benches' first run. Hidden if the site has no
          scheduled runs (rare; covers the make-to-order-only case). */}
      {runTabs.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 32px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-text-muted)',
              marginRight: 4,
            }}
          >
            Batches
          </span>
          <div
            role="tablist"
            aria-label="Run filter"
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            {runTabs.map(t => (
              <RunPill
                key={t.id}
                label={t.label}
                active={runTab === t.id}
                onClick={() => setRunTab(t.id)}
              />
            ))}
          </div>
        </div>
      )}

      {focusedRecipeName && (
        <FocusBar recipeName={focusedRecipeName} onClear={() => setFocusedItemId(null)} />
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {view === 'balance' ? (
          <BenchBalanceView site={site} date={DEMO_TODAY} runFilter={runTab} />
        ) : (
          <BenchCardBoard
            site={site}
            date={DEMO_TODAY}
            nowHHMM={site.id === 'hub-central' ? nowHHMM : undefined}
            focusedItemId={focusedItemId}
            onFocusChange={(id) => setFocusedItemId(id)}
            onClearFocus={() => setFocusedItemId(null)}
            modeFilter={modeTab}
            runFilter={runTab}
            onBenchClick={(id) => setSelectedBenchId(id)}
          />
        )}
      </div>

      <BatchDetailPanel batchId={selectedBatchId} onClose={() => setSelectedBatchId(null)} />
      <CadenceDetailPanel
        productionItemId={selectedCadenceId}
        date={DEMO_TODAY}
        onClose={() => setSelectedCadenceId(null)}
      />
      <BenchIngredientsPanel
        siteId={site.id}
        date={DEMO_TODAY}
        benchId={selectedBenchId}
        onClose={() => setSelectedBenchId(null)}
      />
    </div>
  );
}

/**
 * Board view toggle — Balance (per-run comparison, the default planning
 * lens) vs Bench detail (the editable per-bench card board). Segmented
 * control styled to sit left of the mode tabs so the page reads as
 * "which lens → which slice".
 */
function ViewToggle({
  view,
  onChange,
}: {
  view: BoardView;
  onChange: (v: BoardView) => void;
}) {
  const items: Array<{ id: BoardView; label: string; icon: typeof Scale }> = [
    { id: 'detail', label: 'Bench detail', icon: LayoutGrid },
    { id: 'balance', label: 'Balance', icon: Scale },
  ];
  return (
    <div
      role="tablist"
      aria-label="Board view"
      style={{
        display: 'flex',
        background: 'var(--color-bg-hover)',
        borderRadius: 100,
        padding: 3,
        width: 'fit-content',
      }}
    >
      {items.map(item => {
        const active = item.id === view;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 100,
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              background: active ? 'var(--color-accent-active)' : 'transparent',
              color: active ? '#fff' : 'var(--color-text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            <Icon size={14} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Visual-only "Prefill benches" toolbar button. Placeholder for the
 * upcoming auto-assignment flow that will spread the day's planned
 * recipes across the right benches based on capability, capacity and
 * batch rules. For now it's just the affordance — managers can see it
 * sitting next to Download so we can validate placement and copy
 * before the underlying behaviour ships.
 */
function PrefillBenchesButton() {
  return (
    <button
      type="button"
      onClick={() => {
        // No-op placeholder — auto-prefill logic will land here.
      }}
      aria-label="Prefill benches with the day's recipes"
      title="Prefill benches"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        background: '#ffffff',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border)',
        cursor: 'pointer',
      }}
    >
      <Wand2 size={14} /> Prefill benches
    </button>
  );
}

/**
 * Download split-button on the bench-board toolbar. Shows a popover with the
 * three printables a manager actually asks for in the morning huddle:
 *   1. Bench summaries — components + recipes per bench (one bench per page).
 *   2. Bench plans     — the recipes-scheduled view per bench (printable for
 *                        each station to clip up).
 *   3. All ingredients — the existing site-wide ingredient sheet with
 *                        component rollup.
 *
 * All three pull from the same `PlanLine[]` snapshot the on-screen cards
 * render from, so manager overrides flow through to the print.
 */
function DownloadMenuButton({
  siteId,
  date,
  lines,
}: {
  siteId: string;
  date: string;
  lines: PlanLine[];
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape, only while the menu is open so we
  // aren't tying up the keydown listener for nothing.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = useCallback(
    (handler: () => void) => {
      handler();
      setOpen(false);
    },
    [],
  );

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open download menu"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          background: '#ffffff',
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
        }}
      >
        <Download size={14} /> Download
        <ChevronDown size={12} style={{ opacity: 0.7 }} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Download options"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 60,
            minWidth: 280,
            background: '#ffffff',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(10, 20, 25, 0.18)',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <DownloadMenuItem
            icon={Layers}
            label="Bench summary"
            hint="Components + recipes for every bench, one per page"
            onSelect={() =>
              choose(() => downloadAllBenchSummariesPdf({ siteId, date, lines }))
            }
          />
          <DownloadMenuItem
            icon={ListChecks}
            label="All individual benches"
            hint="Recipes scheduled per bench, one per page"
            onSelect={() =>
              choose(() => downloadAllBenchPlansPdf({ siteId, date, lines }))
            }
          />
          <DownloadMenuItem
            icon={FileText}
            label="All ingredients PDF"
            hint="Site-wide component rollup for the day"
            onSelect={() =>
              choose(() => downloadAllIngredientsPdf({ siteId, date, lines }))
            }
          />
        </div>
      )}
    </div>
  );
}

function DownloadMenuItem({
  icon: Icon,
  label,
  hint,
  onSelect,
}: {
  icon: typeof Download;
  label: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        color: 'var(--color-text-primary)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <Icon size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-text-secondary)' }} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          {hint}
        </span>
      </span>
    </button>
  );
}

/**
 * Compact pill used by the run-filter row. Visually lighter than the mode
 * tabs above so the two layers read as related-but-secondary. Active pill
 * borrows the accent colour; the count badge is hidden when undefined (so
 * the "All" pill stays minimal).
 */
function RunPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 11px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        cursor: 'pointer',
        background: active ? 'var(--color-accent-active)' : '#ffffff',
        color: active ? '#ffffff' : 'var(--color-text-secondary)',
        border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
        fontVariantNumeric: 'tabular-nums',
        transition: 'all 0.15s',
      }}
    >
      {label}
      {count !== undefined && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 100,
            fontSize: 10,
            fontWeight: 700,
            background: active ? 'rgba(255,255,255,0.25)' : 'var(--color-border-subtle)',
            color: active ? '#fff' : 'var(--color-text-secondary)',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function FocusBar({ recipeName, onClear }: { recipeName: string; onClear: () => void }) {
  return (
    <div
      style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--color-border-subtle)',
        borderLeft: '3px solid var(--color-accent-active)',
        background: 'var(--color-bg-hover)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 12,
        color: 'var(--color-text-secondary)',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px',
          borderRadius: 999,
          background: '#ffffff',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border-subtle)',
          fontWeight: 700,
          fontSize: 11,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-text-secondary)' }} />
        {recipeName}
      </span>
      <span style={{ color: 'var(--color-text-muted)' }}>
        Showing this recipe&rsquo;s dependency chain. Related rows are highlighted; unrelated recipes are dimmed.
      </span>
      <button
        type="button"
        onClick={onClear}
        style={{
          marginLeft: 'auto',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        Clear
      </button>
    </div>
  );
}

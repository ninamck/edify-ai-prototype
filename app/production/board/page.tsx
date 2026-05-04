'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, FileText, Layers, ListChecks } from 'lucide-react';
import BenchCardBoard from '@/components/Production/BenchCardBoard';
import BatchDetailPanel from '@/components/Production/BatchDetailPanel';
import CadenceDetailPanel from '@/components/Production/CadenceDetailPanel';
import BenchIngredientsPanel from '@/components/Production/BenchIngredientsPanel';
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

type ModeTabId = 'all' | ProductionMode;

const MODE_TABS: Array<{ id: ModeTabId; label: string }> = [
  { id: 'all',       label: 'All' },
  { id: 'run',       label: 'Run' },
  { id: 'variable',  label: 'Variable' },
  { id: 'increment', label: 'Drops' },
];

export default function ProductionBoardPage() {
  const { siteId } = useProductionSite();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedCadenceId, setSelectedCadenceId] = useState<string | null>(null);
  const [selectedBenchId, setSelectedBenchId] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<ProductionItemId | null>(null);
  const [modeTab, setModeTab] = useState<ModeTabId>('all');
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

  // Current demo time: Thursday 07:30
  const nowHHMM = '07:30';

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
        <div style={{ flex: 1 }} />
        <DownloadMenuButton siteId={site.id} date={DEMO_TODAY} lines={lines} />
      </div>

      {focusedRecipeName && (
        <FocusBar recipeName={focusedRecipeName} onClear={() => setFocusedItemId(null)} />
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <BenchCardBoard
          site={site}
          date={DEMO_TODAY}
          nowHHMM={site.id === 'hub-central' ? nowHHMM : undefined}
          focusedItemId={focusedItemId}
          onFocusChange={(id) => setFocusedItemId(id)}
          onClearFocus={() => setFocusedItemId(null)}
          modeFilter={modeTab}
          onBenchClick={(id) => setSelectedBenchId(id)}
        />
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

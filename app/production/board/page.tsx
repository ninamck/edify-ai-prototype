'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
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
import { usePlan } from '@/components/Production/PlanStore';
import { downloadAllIngredientsPdf } from '@/lib/pdf/productionPdfs';

type ModeTabId = 'all' | ProductionMode;

const MODE_TABS: Array<{ id: ModeTabId; label: string }> = [
  { id: 'all',       label: 'All' },
  { id: 'run',       label: 'Run' },
  { id: 'variable',  label: 'Variable' },
  { id: 'increment', label: 'Segment' },
];

export default function ProductionBoardPage() {
  const [siteId] = useState('hub-central');
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
          padding: '10px 16px',
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
        <button
          type="button"
          onClick={() => downloadAllIngredientsPdf({ siteId: site.id, date: DEMO_TODAY, lines })}
          aria-label="Download all ingredients PDF for the production day"
          title="Download a PDF of every bench's ingredient list for today"
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
          <Download size={14} /> All ingredients PDF
        </button>
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

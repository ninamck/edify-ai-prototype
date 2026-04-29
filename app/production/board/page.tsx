'use client';

import { useEffect, useState } from 'react';
import BenchCardBoard from '@/components/Production/BenchCardBoard';
import BatchDetailPanel from '@/components/Production/BatchDetailPanel';
import CadenceDetailPanel from '@/components/Production/CadenceDetailPanel';
import { RangeTierIndicator } from '@/components/Production/RangeTierChips';
import PlanSummaryStrip from '@/components/Production/PlanSummaryStrip';
import type { ProductionItemId } from '@/components/Production/fixtures';
import {
  DEMO_TODAY,
  PRET_SITES,
  getSite,
  PRET_FORECAST,
  getProductionItem,
  getRecipe,
} from '@/components/Production/fixtures';

export default function ProductionBoardPage() {
  const [siteId, setSiteId] = useState('hub-central');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedCadenceId, setSelectedCadenceId] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<ProductionItemId | null>(null);
  const site = getSite(siteId) ?? PRET_SITES[0];

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

  // Current demo time: Thursday 07:30
  const nowHHMM = '07:30';

  // Quinn draft summary for the header
  const confirmed = PRET_FORECAST.filter(f => f.siteId === siteId && f.date === DEMO_TODAY && f.status === 'confirmed').length;
  const drafts = PRET_FORECAST.filter(f => f.siteId === siteId && f.date === DEMO_TODAY && f.status === 'draft').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Site selector strip */}
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Site
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {PRET_SITES.map(s => {
            const active = s.id === siteId;
            return (
              <button
                key={s.id}
                onClick={() => setSiteId(s.id)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  background: active ? 'var(--color-accent-active)' : '#ffffff',
                  color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                  border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.name} · {s.type}
              </button>
            );
          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <RangeTierIndicator siteId={site.id} date={DEMO_TODAY} />
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Quinn forecast · {confirmed} confirmed{drafts ? ` · ${drafts} awaiting review` : ''}
          </span>
        </div>
      </div>

      <PlanSummaryStrip siteId={site.id} date={DEMO_TODAY} />

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
        />
      </div>

      <BatchDetailPanel batchId={selectedBatchId} onClose={() => setSelectedBatchId(null)} />
      <CadenceDetailPanel
        productionItemId={selectedCadenceId}
        date={DEMO_TODAY}
        onClose={() => setSelectedCadenceId(null)}
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
        background: 'var(--color-info-light)',
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
          color: 'var(--color-accent-active)',
          fontWeight: 700,
          fontSize: 11,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent-active)' }} />
        {recipeName}
      </span>
      <span style={{ color: 'var(--color-text-muted)' }}>
        Showing this recipe&rsquo;s dependency chain. Upstream rows (components) are tinted blue, downstream rows (assemblies that use it) are tinted amber. Unrelated recipes are dimmed.
      </span>
      <button
        type="button"
        onClick={onClear}
        style={{
          marginLeft: 'auto',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-accent-active)',
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

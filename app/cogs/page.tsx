'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import SingleSiteCogs from '@/components/Cogs/SingleSiteCogs';
import CogsVarianceTable from '@/components/Cogs/CogsVarianceTable';
import CogsQuinnPanel from '@/components/Cogs/CogsQuinnPanel';
import CogsTopVariancesBoard from '@/components/Cogs/CogsTopVariancesBoard';
import CogsVarianceDetailPanel from '@/components/Cogs/CogsVarianceDetailPanel';
import DailyFlashReport from '@/components/Cogs/DailyFlashReport';
import ConsolidatedCogs from '@/components/Cogs/ConsolidatedCogs';
import LineLevelCogs from '@/components/Cogs/LineLevelCogs';
import { COGS_PERIOD } from '@/components/Cogs/fixtures';

type Tab = 'flash' | 'consolidated' | 'single' | 'variance' | 'line';

const TABS: { id: Tab; label: string }[] = [
  { id: 'flash', label: 'Daily Flash Report' },
  { id: 'consolidated', label: 'Consolidated COGs' },
  { id: 'single', label: 'Single Site COGs' },
  { id: 'variance', label: 'COGs Variance' },
  { id: 'line', label: 'Line Level COGs' },
];

function DateChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '4px 12px',
        borderRadius: 9,
        border: '1px solid var(--color-border)',
        background: '#fff',
        minWidth: 110,
      }}
    >
      <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
        {value}
        <ChevronDown size={13} color="var(--color-text-muted)" />
      </span>
    </div>
  );
}

export default function CogsPage() {
  const [tab, setTab] = useState<Tab>('flash');
  const [netGross, setNetGross] = useState<'net' | 'gross'>('net');
  const [quinnOpen, setQuinnOpen] = useState(false);
  const [highlightRowIds, setHighlightRowIds] = useState<string[]>([]);
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const highlightTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    };
  }, []);

  function highlightRows(ids: string[]) {
    setHighlightRowIds(ids);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightRowIds([]), 4000);
  }

  return (
    <>
      {/* Single top bar — site switcher · "COGS" title · report tabs,
          with Back pinned right. The tab state lives in this page, so
          the bar renders here rather than in the layout. */}
      <AreaTopBar
        title="COGS"
        ariaLabel="COGS reports"
        stateTabs={{
          items: TABS,
          value: tab,
          onChange: id => setTab(id as Tab),
        }}
        backTo="/"
      />

      {/* COGS-specific controls — sit on their own row beneath the tabs. */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          padding: '10px 24px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#fff',
        }}
      >
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Net / Gross toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              Net/Gross
            </span>
            <button
              type="button"
              onClick={() => setNetGross((v) => (v === 'net' ? 'gross' : 'net'))}
              aria-label="Toggle net or gross"
              style={{
                width: 44,
                height: 24,
                borderRadius: 999,
                border: 'none',
                background: netGross === 'gross' ? 'var(--color-accent-deep)' : 'var(--color-border)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: netGross === 'gross' ? 22 : 2,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.15s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
            </button>
          </div>

          <DateChip label="Opening Stocktake" value={COGS_PERIOD.openingLabel} />
          <DateChip label="Closing Stocktake" value={COGS_PERIOD.closingLabel} />
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: '20px 24px 96px',
          background: 'var(--color-bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {tab === 'variance' && (
          <>
            <CogsTopVariancesBoard
              onHighlightRows={highlightRows}
              onOpenDetail={setDetailRowId}
              onAskEdify={() => setQuinnOpen(true)}
            />

            {/* Full product table, tucked behind a dropdown */}
            <div
              style={{
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--color-border-subtle)',
                background: '#fff',
              }}
            >
              <button
                type="button"
                onClick={() => setTableOpen((v) => !v)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  border: 'none',
                  borderBottom: tableOpen ? '1px solid var(--color-border-subtle)' : 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Full variance table
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  every product line for the period
                </span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', color: 'var(--color-text-muted)' }}>
                  {tableOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </span>
              </button>
              {tableOpen && (
                <div style={{ padding: 16 }}>
                  <CogsVarianceTable
                    highlightRowIds={highlightRowIds}
                    onOpenDetail={setDetailRowId}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'single' && <SingleSiteCogs />}
        {tab === 'flash' && <DailyFlashReport />}
        {tab === 'consolidated' && <ConsolidatedCogs />}
        {tab === 'line' && <LineLevelCogs />}
      </div>

      <CogsVarianceDetailPanel rowId={detailRowId} onClose={() => setDetailRowId(null)} />

      <CogsQuinnPanel
        open={quinnOpen}
        onOpenChange={setQuinnOpen}
        onHighlightRows={highlightRows}
        onRequestVarianceTab={() => setTab('variance')}
      />
    </>
  );
}

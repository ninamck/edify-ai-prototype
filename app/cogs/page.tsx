'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  TOP_NAV_BAR_PADDING,
  TOP_NAV_PILL_ACTIVE,
  TOP_NAV_PILL_BASE,
  TOP_NAV_PILL_GAP,
  TOP_NAV_PILL_IDLE_TRANSPARENT,
} from '@/components/Production/topNavStyles';
import SingleSiteCogs from '@/components/Cogs/SingleSiteCogs';
import CogsVarianceTable from '@/components/Cogs/CogsVarianceTable';
import CogsQuinnPanel from '@/components/Cogs/CogsQuinnPanel';
import CogsInsightsBoard from '@/components/Cogs/CogsInsightsBoard';
import CogsTopVariancesBoard from '@/components/Cogs/CogsTopVariancesBoard';
import { COGS_PERIOD } from '@/components/Cogs/fixtures';

type Tab = 'flash' | 'consolidated' | 'single' | 'variance' | 'line';

const TABS: { id: Tab; label: string; ready?: boolean }[] = [
  { id: 'flash', label: 'Daily Flash Report' },
  { id: 'consolidated', label: 'Consolidated COGs' },
  { id: 'single', label: 'Single Site COGs', ready: true },
  { id: 'variance', label: 'COGs Variance', ready: true },
  { id: 'line', label: 'Line Level COGs' },
];

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '64px 24px',
        borderRadius: 'var(--radius-card)',
        border: '1px dashed var(--color-border)',
        background: '#fff',
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Coming soon</span>
    </div>
  );
}

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
  const [tab, setTab] = useState<Tab>('single');
  const [netGross, setNetGross] = useState<'net' | 'gross'>('net');
  const [quinnOpen, setQuinnOpen] = useState(false);
  const [highlightRowIds, setHighlightRowIds] = useState<string[]>([]);
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
      {/* Tab strip. The site-wide top bar lives in the layout; this band
          carries only the report's pages. */}
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
          background: '#fff',
          overflowX: 'auto',
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              ...TOP_NAV_PILL_BASE,
              ...(tab === t.id ? TOP_NAV_PILL_ACTIVE : TOP_NAV_PILL_IDLE_TRANSPARENT),
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

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
        {tab === 'single' && (
          <CogsInsightsBoard
            onHighlightRows={highlightRows}
            onViewVariance={() => setTab('variance')}
            onAskEdify={() => setQuinnOpen(true)}
          />
        )}
        {tab === 'variance' && (
          <CogsTopVariancesBoard
            onHighlightRows={highlightRows}
            onAskEdify={() => setQuinnOpen(true)}
          />
        )}

        {tab === 'single' && <SingleSiteCogs />}
        {tab === 'variance' && <CogsVarianceTable highlightRowIds={highlightRowIds} />}
        {tab !== 'single' && tab !== 'variance' && (
          <PlaceholderTab label={TABS.find((t) => t.id === tab)?.label ?? ''} />
        )}
      </div>

      <CogsQuinnPanel
        open={quinnOpen}
        onOpenChange={setQuinnOpen}
        onHighlightRows={highlightRows}
        onRequestVarianceTab={() => setTab('variance')}
      />
    </>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import SingleSiteCogs from '@/components/Cogs/SingleSiteCogs';
import CogsVarianceTable from '@/components/Cogs/CogsVarianceTable';
import CogsQuinnPanel from '@/components/Cogs/CogsQuinnPanel';
import CogsTopVariancesBoard from '@/components/Cogs/CogsTopVariancesBoard';
import CogsVarianceDetailPanel from '@/components/Cogs/CogsVarianceDetailPanel';
import DailyFlashReport from '@/components/Cogs/DailyFlashReport';
import ConsolidatedCogs from '@/components/Cogs/ConsolidatedCogs';
import LineLevelCogs from '@/components/Cogs/LineLevelCogs';
import QuickCountVarianceTable from '@/components/Cogs/QuickCountVarianceTable';
import { COGS_PERIOD } from '@/components/Cogs/fixtures';
import { DAY_LABELS, PERIOD_DAYS } from '@/components/Cogs/quickCounts';

type Tab = 'flash' | 'consolidated' | 'single' | 'variance' | 'line';
type CountView = 'full' | 'quick';

const COUNT_VIEWS: { id: CountView; label: string }[] = [
  { id: 'full', label: 'Full counts' },
  { id: 'quick', label: 'Quick counts' },
];

const NEXT_DAY_LABEL = '8 Jan';

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
  const [countView, setCountView] = useState<CountView>('full');
  const [closingAccepted, setClosingAccepted] = useState(false);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div
              role="group"
              aria-label="Variance by count type"
              style={{
                display: 'inline-flex',
                padding: 3,
                gap: 3,
                borderRadius: 10,
                border: '1px solid var(--color-border)',
                background: '#fff',
              }}
            >
              {COUNT_VIEWS.map((v) => {
                const active = countView === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCountView(v.id)}
                    style={{
                      minHeight: 36,
                      padding: '0 16px',
                      borderRadius: 7,
                      border: 'none',
                      background: active ? 'var(--color-accent-active)' : 'transparent',
                      color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'var(--font-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
              {countView === 'full'
                ? `Opening stocktake to closing stocktake, ${DAY_LABELS[0]} to ${DAY_LABELS[PERIOD_DAYS]}.`
                : `Quick and group counts since the ${DAY_LABELS[0]} opening stocktake, against the previous count and the opening stocktake.`}
            </span>
          </div>
        )}

        {tab === 'variance' && countView === 'full' && !closingAccepted && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              padding: '14px 16px',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-border-alert)',
              background: 'var(--color-bg-alert)',
            }}
          >
            <div style={{ flex: '1 1 320px', fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-primary)' }}>
              <strong>The {DAY_LABELS[PERIOD_DAYS]} full count is done.</strong> Accept it as the opening stocktake for
              the next period and quick counts from {NEXT_DAY_LABEL} will measure from it.
            </div>
            <button
              type="button"
              onClick={() => setClosingAccepted(true)}
              style={{
                minHeight: 40,
                padding: '0 16px',
                borderRadius: 9,
                border: 'none',
                background: 'var(--color-accent-active)',
                color: 'var(--color-text-on-active)',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
              }}
            >
              Accept as opening stocktake
            </button>
          </div>
        )}

        {tab === 'variance' && closingAccepted && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-success-border)',
              background: 'var(--color-success-light)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-success)',
            }}
          >
            <CheckCircle2 size={16} aria-hidden />
            Done. The {DAY_LABELS[PERIOD_DAYS]} full count is the opening stocktake for the next period. Quick counts
            from {NEXT_DAY_LABEL} measure from it.
          </div>
        )}

        {tab === 'variance' && countView === 'quick' && (
          <QuickCountVarianceTable onOpenDetail={setDetailRowId} />
        )}

        {tab === 'variance' && countView === 'full' && (
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

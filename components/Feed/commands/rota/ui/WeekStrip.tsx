'use client';

/**
 * The week in one row, one day at a time underneath.
 *
 * Seven columns carry the date, the forecast, the hour-by-hour cover
 * strip and how many changes land on that day. Clicking a day opens it
 * below at full width, so every shift shows with its full name and the
 * change drawn on, and the forecast explanation is one click further.
 * "By station" swaps the body for the station view, for the GM who
 * wants to see where the work lands rather than who is on.
 *
 * The full seven-column grid of every shift was the dense part of the
 * old card. Deputy already shows every shift; the GM needs the shape of
 * the week and the detail of the days she is changing.
 */

import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { DAY_KEYS, type DayAnalysis, type DayKey, type DeputyDraft, type Proposal, type Shift, type SiteLabourData } from '../types';
import { dayTotals, explainDay as explainForecastDay } from '../engine';
import { Chip, CoverStrip, DAY_NAME, chipsFor, dateLabel } from './chips';
import ExplainForecast from './ExplainForecast';
import StationView from './StationView';
import RotaGrid, { RotaGridDialog, RotaGridToolbar } from './RotaGrid';
import { label, segment, segmentedWrap, small, textButton } from './tokens';

export type WeekMode = 'week' | 'grid' | 'station';

function gbp(n: number): string {
  return `£${Math.round(n).toLocaleString('en-GB')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthShort(weekStart: string, day: DayKey): string {
  const d = new Date(`${weekStart}T00:00:00`);
  d.setDate(d.getDate() + DAY_KEYS.indexOf(day));
  return MONTHS[d.getMonth()];
}

function coverLine(a: DayAnalysis): string {
  const short = (a.gapSlots * 15) / 60;
  if (short === 0) return 'covered as ticked';
  return `${short % 1 === 0 ? short : short.toFixed(2).replace(/0$/, '')}h short as ticked`;
}

function hoursText(h: number): string {
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

/** Label left, figure right, in a day box. */
function Figure({ name, value, strong }: { name: string; value: string; strong?: boolean }) {
  return (
    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '4px', minWidth: 0 }}>
      <span style={{ ...small, fontSize: '10.5px' }}>{name}</span>
      <span style={{ fontSize: '11.5px', fontWeight: strong ? 700 : 600, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>{value}</span>
    </span>
  );
}

function Swatch({ color }: { color: string }) {
  return <span aria-hidden="true" style={{ display: 'inline-block', width: '10px', height: '6px', borderRadius: '1px', background: color, marginRight: '4px', verticalAlign: '1px' }} />;
}

/** The cover strip's two colours, named once beside the tabs. */
function CoverKey() {
  return (
    <span style={{ ...small, display: 'inline-flex', gap: '10px', alignItems: 'center', whiteSpace: 'nowrap' }}>
      <span>
        <Swatch color="var(--color-error)" />
        short
      </span>
      <span>
        <Swatch color="var(--color-text-secondary)" />
        idle
      </span>
    </span>
  );
}

export default function WeekStrip({
  draft,
  site,
  proposals,
  selected,
  analysis,
  shifts,
  openDay,
  onOpenDay,
  initialMode,
  fullScreenPanel,
}: {
  draft: DeputyDraft;
  site: SiteLabourData;
  proposals: Proposal[];
  selected: Set<string>;
  /** Analysis of the rota as ticked. */
  analysis: DayAnalysis[];
  /** Shifts as ticked, for the station view. */
  shifts: Shift[];
  openDay: DayKey | null;
  onOpenDay: (day: DayKey | null) => void;
  /** Open on the grid or station view when the prompt asked for it. */
  initialMode?: WeekMode;
  /** The checklist, shown beside the grid at full screen. */
  fullScreenPanel?: ReactNode;
}) {
  const [mode, setMode] = useState<WeekMode>(initialMode ?? 'week');
  const [why, setWhy] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  const open = openDay ? analysis.find((a) => a.day === openDay) : undefined;
  const gridProps = { draft, proposals, selected, analysis, shifts };

  return (
    <section aria-label="The week" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '12px' }}>
          <span style={label}>The week</span>
          {mode === 'week' && <CoverKey />}
        </span>
        <div style={segmentedWrap} role="tablist" aria-label="Week view">
          <button type="button" role="tab" aria-selected={mode === 'week'} style={segment(mode === 'week')} onClick={() => setMode('week')}>
            By day
          </button>
          <button type="button" role="tab" aria-selected={mode === 'grid'} style={segment(mode === 'grid')} onClick={() => setMode('grid')}>
            Rota
          </button>
          <button type="button" role="tab" aria-selected={mode === 'station'} style={segment(mode === 'station')} onClick={() => setMode('station')}>
            By station
          </button>
        </div>
      </div>

      {mode === 'grid' ? (
        <>
          <RotaGrid {...gridProps} size="sm" />
          <RotaGridToolbar onFullScreen={() => setFullScreen(true)} />
          <RotaGridDialog {...gridProps} open={fullScreen} onClose={() => setFullScreen(false)} panel={fullScreenPanel} />
        </>
      ) : mode === 'station' ? (
        <StationView site={site} analysis={analysis} shifts={shifts} draft={draft} />
      ) : (
        <>
          <div role="tablist" aria-label="Days" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px' }}>
            {DAY_KEYS.map((d) => {
              const a = analysis.find((x) => x.day === d)!;
              const n = proposals.filter((p) => p.day === d).length;
              const on = proposals.filter((p) => p.day === d && selected.has(p.id)).length;
              const active = openDay === d;
              const t = dayTotals(shifts, d, draft.hourlyCostGBP);
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`${DAY_NAME[d]} ${dateLabel(draft.weekStart, d)}, ${gbp(a.salesGBP)} sales, ${hoursText(t.hours)} scheduled, ${gbp(t.costGBP)} cost, ${n === 0 ? 'no changes' : `${on} of ${n} changes ticked`}, ${coverLine(a)}`}
                  onClick={() => onOpenDay(active ? null : d)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: '1px',
                    padding: '8px 8px 7px',
                    minWidth: 0,
                    borderRadius: '10px',
                    border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`,
                    background: active ? '#fff' : n > 0 ? '#fff' : 'rgba(0,28,53,0.015)',
                    boxShadow: active ? '0 0 0 1px var(--color-accent-active) inset' : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{d}</span>
                    <span style={small}>{dateLabel(draft.weekStart, d)}</span>
                  </div>
                  <Figure name="Sales" value={gbp(a.salesGBP)} />
                  <Figure name="Hours" value={hoursText(t.hours)} />
                  <Figure name="Cost" value={gbp(t.costGBP)} />
                  <CoverStrip a={a} height={7} />
                  <span
                    style={{
                      marginTop: '4px',
                      fontSize: '11.5px',
                      fontWeight: n > 0 ? 700 : 500,
                      color: n > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {n === 0 ? 'no change' : `${n} change${n === 1 ? '' : 's'}`}
                  </span>
                </button>
              );
            })}
          </div>

          {openDay && open ? (
            <div
              role="tabpanel"
              aria-label={`${DAY_NAME[openDay]} shifts`}
              style={{
                border: '1px solid var(--color-border-subtle)',
                borderRadius: '10px',
                padding: '10px 12px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                background: '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {DAY_NAME[openDay]} {dateLabel(draft.weekStart, openDay)} {monthShort(draft.weekStart, openDay)}
                  </span>
                  <span style={{ ...small, fontVariantNumeric: 'tabular-nums' }}>
                    {(() => {
                      const t = dayTotals(shifts, openDay, draft.hourlyCostGBP);
                      return `${gbp(open.salesGBP)} sales, ${hoursText(t.hours)}, ${gbp(t.costGBP)}. `;
                    })()}
                    {coverLine(open).charAt(0).toUpperCase() + coverLine(open).slice(1)}.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    aria-expanded={why}
                    style={{ ...textButton, padding: '4px 8px', color: why ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', textDecoration: 'underline dotted', textUnderlineOffset: '2px' }}
                    onClick={() => setWhy((v) => !v)}
                  >
                    Why {gbp(open.salesGBP)}
                  </button>
                  <button type="button" style={{ ...textButton, padding: '4px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => onOpenDay(null)} aria-label={`Close ${DAY_NAME[openDay]}`}>
                    <X size={13} aria-hidden="true" /> Close
                  </button>
                </div>
              </div>

              <div role="table" aria-label={`${DAY_NAME[openDay]} shifts by area`} style={{ display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', gap: '8px 10px', alignItems: 'start' }}>
                {draft.areas.map((area) => {
                  const chips = chipsFor(draft, proposals, selected, area, openDay);
                  return (
                    <div key={area} role="row" style={{ display: 'contents' }}>
                      <div role="rowheader" style={{ ...label, paddingTop: '8px', lineHeight: 1.3 }}>
                        {area}
                      </div>
                      <div role="cell" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {chips.length === 0 ? <span style={{ ...small, paddingTop: '8px' }}>Nobody on</span> : chips.map((c) => <Chip key={c.key} c={c} size="md" />)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {why && <ExplainForecast x={explainForecastDay(site, openDay)} onClose={() => setWhy(false)} />}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

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

import { useState } from 'react';
import { X } from 'lucide-react';
import { DAY_KEYS, type DayAnalysis, type DayKey, type DeputyDraft, type Proposal, type Shift, type SiteLabourData } from '../types';
import { explainDay as explainForecastDay, hhmm } from '../engine';
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
}) {
  const [mode, setMode] = useState<WeekMode>(initialMode ?? 'week');
  const [why, setWhy] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  const open = openDay ? analysis.find((a) => a.day === openDay) : undefined;
  const openProposals = openDay ? proposals.filter((p) => p.day === openDay) : [];
  const gridProps = { draft, proposals, selected, analysis, shifts };

  return (
    <section aria-label="The week" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={label}>The week</span>
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
          <RotaGridDialog {...gridProps} open={fullScreen} onClose={() => setFullScreen(false)} />
        </>
      ) : mode === 'station' ? (
        <>
          <StationView site={site} analysis={analysis} shifts={shifts} draft={draft} />
          <span style={small}>Work by station, hour by hour. Machine load shows where the kit, not the people, is the limit.</span>
        </>
      ) : (
        <>
          <div role="tablist" aria-label="Days" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px' }}>
            {DAY_KEYS.map((d) => {
              const a = analysis.find((x) => x.day === d)!;
              const n = proposals.filter((p) => p.day === d).length;
              const on = proposals.filter((p) => p.day === d && selected.has(p.id)).length;
              const active = openDay === d;
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`${DAY_NAME[d]} ${dateLabel(draft.weekStart, d)}, ${gbp(a.salesGBP)} forecast, ${n === 0 ? 'no changes' : `${on} of ${n} changes ticked`}, ${coverLine(a)}`}
                  onClick={() => onOpenDay(active ? null : d)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: '2px',
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
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{d}</span>
                    <span style={small}>{dateLabel(draft.weekStart, d)}</span>
                  </div>
                  <span style={{ ...small, fontVariantNumeric: 'tabular-nums' }}>{gbp(a.salesGBP)}</span>
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
                  <span style={small}>
                    {gbp(open.salesGBP)} forecast, {coverLine(open)}.{' '}
                    {openProposals.length === 0 ? 'No changes.' : `${openProposals.filter((p) => selected.has(p.id)).length} of ${openProposals.length} change${openProposals.length === 1 ? '' : 's'} ticked.`}
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

              <span style={small}>
                Open {hhmm(open.points[0]?.min ?? site.openMin)} to {hhmm((open.points[open.points.length - 1]?.min ?? site.closeMin - 15) + 15)}. Red under the day: short of the workload. Grey: a head idle.
              </span>

              {why && <ExplainForecast x={explainForecastDay(site, openDay)} onClose={() => setWhy(false)} />}
            </div>
          ) : (
            <span style={small}>Click a day for its shifts. Red under a day: short of the workload. Grey: a head idle.</span>
          )}
        </>
      )}
    </section>
  );
}

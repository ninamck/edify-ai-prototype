'use client';

/**
 * Week by area: the draft as Deputy lays it out (areas down, days
 * across), with the ticked proposals drawn onto it. A reading view, not
 * a deciding one: the card uses WeekStrip and expands one day at a time
 * so chips stay legible. This full grid is for a page with the room.
 */

import { Fragment } from 'react';
import { DAY_KEYS, type DayAnalysis, type DayKey, type DeputyDraft, type Proposal } from '../types';
import { Chip, CoverStrip, chipsFor, dateLabel } from './chips';
import { label, small } from './tokens';

export default function WeekGrid({
  draft,
  proposals,
  selected,
  analysis,
  explainDay,
  onExplain,
}: {
  draft: DeputyDraft;
  proposals: Proposal[];
  selected: Set<string>;
  analysis: DayAnalysis[];
  /** Day whose forecast explanation is open, if any. */
  explainDay?: DayKey | null;
  /** Clicking a day's forecast figure opens the explanation. */
  onExplain?: (day: DayKey) => void;
}) {
  const cols = `92px repeat(7, minmax(0, 1fr))`;
  return (
    <div role="table" aria-label={`Draft rota by area, ${draft.weekLabel}`} style={{ display: 'grid', gridTemplateColumns: cols, gap: '6px 6px', alignItems: 'start' }}>
      <div />
      {DAY_KEYS.map((d) => {
        const a = analysis.find((x) => x.day === d)!;
        return (
          <div key={d} role="columnheader" style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{d}</span>
              <span style={small}>{dateLabel(draft.weekStart, d)}</span>
            </div>
            {onExplain ? (
              <button
                type="button"
                onClick={() => onExplain(d)}
                aria-expanded={explainDay === d}
                aria-label={`Why £${Math.round(a.salesGBP).toLocaleString('en-GB')} on ${d}`}
                title="Why this forecast"
                style={{
                  ...small,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                  textDecoration: 'underline dotted',
                  textUnderlineOffset: '2px',
                  color: explainDay === d ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontWeight: explainDay === d ? 700 : 500,
                }}
              >
                £{Math.round(a.salesGBP).toLocaleString('en-GB')} forecast
              </button>
            ) : (
              <div style={small}>£{Math.round(a.salesGBP).toLocaleString('en-GB')} forecast</div>
            )}
            <CoverStrip a={a} />
          </div>
        );
      })}
      {draft.areas.map((area) => (
        <Fragment key={area}>
          <div role="rowheader" style={{ ...label, paddingTop: '6px', lineHeight: 1.3 }}>
            {area}
          </div>
          {DAY_KEYS.map((d) => (
            <div key={d} role="cell" style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
              {chipsFor(draft, proposals, selected, area, d).map((c) => (
                <Chip key={c.key} c={c} />
              ))}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

'use client';

/**
 * Week by area: the draft as Deputy lays it out (areas down, days
 * across), with the ticked proposals drawn onto it. Unchanged shifts
 * are plain chips. Amended chips show the old time struck through and
 * the new one beside it. Added chips are green with a dashed border.
 * Removed chips are struck and greyed. Every changed chip carries the
 * short reason ("forecast +18%", "11h rest").
 *
 * Under each day a cover strip shows the workload against the rota by
 * hour: red where required exceeds rostered, grey where a head is idle.
 */

import { Fragment } from 'react';
import { DAY_KEYS, type DayAnalysis, type DayKey, type DeputyDraft, type Proposal, type Shift } from '../types';
import { hhmm } from '../engine';
import { KIND_STYLE, label, small } from './tokens';

interface ChipModel {
  key: string;
  personName: string;
  kind: 'unchanged' | 'add' | 'amend' | 'remove';
  /** Applied or only suggested (unticked). */
  applied: boolean;
  before?: { start: number; end: number };
  after?: { start: number; end: number };
  reason?: string;
  start: number;
}

function dateLabel(weekStart: string, i: number): string {
  const d = new Date(`${weekStart}T00:00:00`);
  d.setDate(d.getDate() + i);
  return `${d.getDate()}`;
}

function chipsFor(draft: DeputyDraft, proposals: Proposal[], selected: Set<string>, area: string, day: DayKey): ChipModel[] {
  const byPerson = new Map(draft.people.map((p) => [p.id, p.name]));
  const out: ChipModel[] = [];
  const matches = (s: Shift, p: Proposal) => p.personId === s.personId && p.day === s.day && p.before?.start === s.start && p.before?.end === s.end;

  for (const s of draft.shifts.filter((x) => x.area === area && x.day === day)) {
    const p = proposals.find((x) => x.kind !== 'add' && matches(s, x));
    if (!p) {
      out.push({ key: s.id, personName: byPerson.get(s.personId) ?? s.personId, kind: 'unchanged', applied: true, before: { start: s.start, end: s.end }, start: s.start });
      continue;
    }
    out.push({
      key: s.id,
      personName: p.personName,
      kind: p.kind,
      applied: selected.has(p.id),
      before: p.before,
      after: p.after,
      reason: p.reason,
      start: s.start,
    });
  }
  for (const p of proposals.filter((x) => x.kind === 'add' && x.area === area && x.day === day)) {
    out.push({ key: p.id, personName: p.personName, kind: 'add', applied: selected.has(p.id), after: p.after, reason: p.reason, start: p.after?.start ?? 0 });
  }
  return out.sort((a, b) => a.start - b.start);
}

function Chip({ c }: { c: ChipModel }) {
  const applied = c.applied && c.kind !== 'unchanged';
  const style = applied ? KIND_STYLE[c.kind] : KIND_STYLE.unchanged;
  const ghostAdd = c.kind === 'add' && !c.applied;
  const struck = applied && c.kind === 'remove';
  return (
    <div
      style={{
        padding: '5px 7px',
        borderRadius: '7px',
        background: style.bg,
        border: `1px ${c.kind === 'add' ? 'dashed' : 'solid'} ${ghostAdd ? 'var(--color-border)' : style.border}`,
        opacity: ghostAdd ? 0.7 : struck ? 0.75 : 1,
        lineHeight: 1.25,
      }}
      title={c.reason}
    >
      <div
        style={{
          fontSize: '11.5px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          textDecoration: struck ? 'line-through' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {c.personName}
      </div>
      <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '1px' }}>
        {c.kind === 'amend' && c.applied && c.before && c.after ? (
          <>
            <span style={{ textDecoration: 'line-through' }}>
              {hhmm(c.before.start)} to {hhmm(c.before.end)}
            </span>
            <br />
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
              {hhmm(c.after.start)} to {hhmm(c.after.end)}
            </span>
          </>
        ) : c.kind === 'add' ? (
          <span style={{ textDecoration: struck ? 'line-through' : 'none' }}>
            {hhmm(c.after!.start)} to {hhmm(c.after!.end)}
          </span>
        ) : (
          <span style={{ textDecoration: struck ? 'line-through' : 'none' }}>
            {hhmm(c.before!.start)} to {hhmm(c.before!.end)}
          </span>
        )}
      </div>
      {c.kind !== 'unchanged' && (
        <div
          style={{
            marginTop: '3px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            color: c.applied ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          }}
        >
          {c.applied ? `${KIND_STYLE[c.kind].label}: ${c.reason}` : `Suggested: ${KIND_STYLE[c.kind].label.toLowerCase()}`}
        </div>
      )}
    </div>
  );
}

function CoverStrip({ a }: { a: DayAnalysis }) {
  // One segment per hour so the strip stays legible in a narrow column.
  const hours = new Map<number, { gap: number; idle: number; n: number }>();
  for (const p of a.points) {
    const h = Math.floor(p.min / 60);
    const cur = hours.get(h) ?? { gap: 0, idle: 0, n: 0 };
    cur.n++;
    if (p.required > p.rostered) cur.gap++;
    else if (p.rostered - p.required >= 1) cur.idle++;
    hours.set(h, cur);
  }
  const first = a.points[0]?.min ?? 0;
  const last = a.points[a.points.length - 1]?.min ?? 0;
  return (
    <div
      aria-label={`Cover by hour, ${a.day}: ${a.gapSlots} short slots, ${a.idleSlots} idle slots`}
      title={`${hhmm(first)} to ${hhmm(last + 15)}. Red: short of the workload. Grey: a head idle.`}
      style={{ display: 'flex', gap: '1px', height: '6px', marginTop: '4px' }}
    >
      {[...hours.entries()].map(([h, v]) => {
        const color = v.gap > 0 ? 'var(--color-error)' : v.idle > 0 ? 'var(--color-border)' : 'var(--color-success-border)';
        return <div key={h} style={{ flex: 1, background: color, borderRadius: '1px' }} />;
      })}
    </div>
  );
}

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
    <div
      role="table"
      aria-label={`Draft rota by area, ${draft.weekLabel}`}
      style={{ display: 'grid', gridTemplateColumns: cols, gap: '6px 6px', alignItems: 'start' }}
    >
      <div />
      {DAY_KEYS.map((d, i) => {
        const a = analysis.find((x) => x.day === d)!;
        return (
          <div key={d} role="columnheader" style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{d}</span>
              <span style={small}>{dateLabel(draft.weekStart, i)}</span>
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
                  fontSize: '10.5px',
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
              <div style={{ ...small, fontSize: '10.5px' }}>£{Math.round(a.salesGBP).toLocaleString('en-GB')} forecast</div>
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

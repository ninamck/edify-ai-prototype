'use client';

/**
 * Shared pieces for drawing a draft rota: the shift chip with a change
 * drawn on, the hour-by-hour cover strip under a day, and the chip
 * model that maps proposals onto Deputy's shifts.
 *
 * Two chip sizes. `sm` is for a seven-column week where every chip
 * shares 780px. `md` is for a single expanded day, where names can be
 * read in full and nothing drops below 12px.
 */

import { DAY_KEYS, type DayAnalysis, type DayKey, type DeputyDraft, type Proposal, type Shift } from '../types';
import { hhmm } from '../engine';
import { KIND_STYLE } from './tokens';

export interface ChipModel {
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

export function dateLabel(weekStart: string, day: DayKey): string {
  const d = new Date(`${weekStart}T00:00:00`);
  d.setDate(d.getDate() + DAY_KEYS.indexOf(day));
  return `${d.getDate()}`;
}

export const DAY_NAME: Record<DayKey, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

export function chipsFor(draft: DeputyDraft, proposals: Proposal[], selected: Set<string>, area: string, day: DayKey): ChipModel[] {
  return modelsFor(
    draft,
    proposals,
    selected,
    (s) => s.area === area && s.day === day,
    (p) => p.area === area && p.day === day,
  );
}

/** One person's cell in a people-down, days-across grid. */
export function chipsForPerson(draft: DeputyDraft, proposals: Proposal[], selected: Set<string>, personId: string, day: DayKey): ChipModel[] {
  return modelsFor(
    draft,
    proposals,
    selected,
    (s) => s.personId === personId && s.day === day,
    (p) => p.personId === personId && p.day === day,
  );
}

function modelsFor(draft: DeputyDraft, proposals: Proposal[], selected: Set<string>, keepShift: (s: Shift) => boolean, keepAdd: (p: Proposal) => boolean): ChipModel[] {
  const byPerson = new Map(draft.people.map((p) => [p.id, p.name]));
  const out: ChipModel[] = [];
  const matches = (s: Shift, p: Proposal) => p.personId === s.personId && p.day === s.day && p.before?.start === s.start && p.before?.end === s.end;

  for (const s of draft.shifts.filter(keepShift)) {
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
  for (const p of proposals.filter((x) => x.kind === 'add' && keepAdd(x))) {
    out.push({ key: p.id, personName: p.personName, kind: 'add', applied: selected.has(p.id), after: p.after, reason: p.reason, start: p.after?.start ?? 0 });
  }
  return out.sort((a, b) => a.start - b.start);
}

const range = (r?: { start: number; end: number }) => (r ? `${hhmm(r.start)} to ${hhmm(r.end)}` : '');

/** The change in words, for screen readers. Colour and strike-through
 *  carry it visually. */
export function spokenChip(c: ChipModel): string {
  if (c.kind === 'unchanged') return `${c.personName}, ${range(c.before)}`;
  if (!c.applied) return `${c.personName}, ${range(c.before ?? c.after)}. Suggested ${KIND_STYLE[c.kind].label.toLowerCase()}, not ticked`;
  if (c.kind === 'add') return `${c.personName}, added ${range(c.after)}: ${c.reason}`;
  if (c.kind === 'remove') return `${c.personName}, ${range(c.before)} removed: ${c.reason}`;
  return `${c.personName}, was ${range(c.before)}, now ${range(c.after)}: ${c.reason}`;
}

export function Chip({ c, size = 'sm' }: { c: ChipModel; size?: 'sm' | 'md' }) {
  const applied = c.applied && c.kind !== 'unchanged';
  const style = applied ? KIND_STYLE[c.kind] : KIND_STYLE.unchanged;
  const ghostAdd = c.kind === 'add' && !c.applied;
  const struck = applied && c.kind === 'remove';
  const md = size === 'md';
  const nameSize = md ? '12.5px' : '11.5px';
  const timeSize = md ? '12px' : '11px';
  const tagSize = md ? '11px' : '10px';

  return (
    <div
      role="group"
      aria-label={spokenChip(c)}
      style={{
        padding: md ? '7px 10px' : '5px 7px',
        borderRadius: '7px',
        background: style.bg,
        border: `1px ${c.kind === 'add' ? 'dashed' : 'solid'} ${ghostAdd ? 'var(--color-border)' : style.border}`,
        opacity: ghostAdd ? 0.7 : struck ? 0.75 : 1,
        lineHeight: 1.3,
        minWidth: md ? '150px' : undefined,
      }}
      title={c.reason}
    >
      <div
        style={{
          fontSize: nameSize,
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
      <div style={{ fontSize: timeSize, fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '1px' }}>
        {c.kind === 'amend' && c.applied && c.before && c.after ? (
          <>
            <span style={{ textDecoration: 'line-through' }}>{range(c.before)}</span>
            {md ? <span aria-hidden="true"> → </span> : <br />}
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{range(c.after)}</span>
          </>
        ) : c.kind === 'add' ? (
          <span style={{ textDecoration: struck ? 'line-through' : 'none' }}>{range(c.after)}</span>
        ) : (
          <span style={{ textDecoration: struck ? 'line-through' : 'none' }}>{range(c.before)}</span>
        )}
      </div>
      {c.kind !== 'unchanged' && (
        <div
          style={{
            marginTop: '3px',
            fontSize: tagSize,
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

export function CoverStrip({ a, height = 6 }: { a: DayAnalysis; height?: number }) {
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
      style={{ display: 'flex', gap: '1px', height: `${height}px`, marginTop: '4px' }}
    >
      {[...hours.entries()].map(([h, v]) => {
        // Quiet where the hour is right; colour only where it is not.
        // Grey and red both clear 3:1 against the quiet segment.
        const color = v.gap > 0 ? 'var(--color-error)' : v.idle > 0 ? 'var(--color-text-secondary)' : 'var(--color-border-subtle)';
        return <div key={h} style={{ flex: 1, background: color, borderRadius: '1px' }} />;
      })}
    </div>
  );
}

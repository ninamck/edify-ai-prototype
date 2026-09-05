'use client';

/**
 * The tickable changes, grouped by day in the order the week runs.
 * One line per change: tick, tag, what moves, then the evidence in
 * grey. Hours and pounds on the right so the GM sees the price of each
 * line before deciding. Lines that leave a rule in warning carry the
 * warning under the evidence and start unticked when the strain is
 * more than half a shift.
 *
 * Rule fixes are not in this list. They sit above it, applied.
 */

import { AlertTriangle } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { DAY_KEYS, type DayKey, type Proposal } from '../types';
import { DAY_NAME, dateLabel } from './chips';
import { TAG_LABEL, TAG_TONE, label, small, textButton } from './tokens';

const DAY_RE = '(Mon|Tue|Wed|Thu|Fri|Sat|Sun)';

/** Engine titles carry the day so they read alone in the receipt.
 *  Under a day header the day is noise, so it comes out. */
export function shortTitle(p: Proposal): string {
  return p.title
    .replace(new RegExp(` on ${DAY_RE}\\b`), '')
    .replace(new RegExp(` off ${DAY_RE}'s close`), ' off the close')
    .replace(new RegExp(`'s ${DAY_RE} `), "'s ")
    .replace(new RegExp(`, ${DAY_RE} `), ', ');
}

export function signedHours(h: number): string {
  return `${h > 0 ? '+' : ''}${h}h`;
}

export function signedGBP(h: number, hourlyCostGBP: number): string {
  const n = Math.round(h * hourlyCostGBP);
  if (n === 0) return '£0';
  return `${n > 0 ? '+' : '-'}£${Math.abs(n).toLocaleString('en-GB')}`;
}

/** Day down the left of a group of lines. Clicking it opens that day
 *  in the week strip, so the GM can see the shift she is deciding on. */
export function DayLabel({ day, weekStart, onShowDay }: { day: DayKey; weekStart: string; onShowDay?: (day: DayKey) => void }) {
  const inner = (
    <>
      <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{day}</span> <span style={small}>{dateLabel(weekStart, day)}</span>
    </>
  );
  if (!onShowDay) return <div style={{ paddingTop: '8px', lineHeight: 1.3 }}>{inner}</div>;
  return (
    <button
      type="button"
      onClick={() => onShowDay(day)}
      aria-label={`Show ${DAY_NAME[day]} in the week`}
      title={`Show ${DAY_NAME[day]} in the week`}
      style={{
        ...textButton,
        padding: '8px 0 0',
        lineHeight: 1.3,
        textAlign: 'left',
        textDecoration: 'underline dotted',
        textDecorationColor: 'var(--color-text-secondary)',
        textUnderlineOffset: '3px',
      }}
    >
      {inner}
    </button>
  );
}

export default function ChangeList({
  proposals,
  selected,
  onToggle,
  disabled,
  weekStart,
  hourlyCostGBP,
  onShowDay,
}: {
  /** Everything except rule fixes. */
  proposals: Proposal[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  disabled?: boolean;
  weekStart: string;
  hourlyCostGBP: number;
  /** Opens that day in the week strip above. */
  onShowDay?: (day: DayKey) => void;
}) {
  if (proposals.length === 0) return null;
  const on = proposals.filter((p) => selected.has(p.id)).length;
  const days = DAY_KEYS.filter((d) => proposals.some((p) => p.day === d));

  return (
    <section aria-label="Changes">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px', gap: '8px' }}>
        <span style={label}>Changes</span>
        <span style={small}>
          {on} of {proposals.length} ticked
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {days.map((d) => {
          const rows = proposals.filter((p) => p.day === d);
          return (
            <div key={d} style={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr)', gap: '8px', alignItems: 'start' }}>
              <DayLabel day={d} weekStart={weekStart} onShowDay={onShowDay} />
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderRadius: '8px', border: '1px solid var(--color-border-subtle)', overflow: 'hidden' }}>
                {rows.map((p, i) => {
                  const checked = selected.has(p.id);
                  const id = `rota-prop-${p.id}`;
                  return (
                    <li
                      key={p.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '18px 1fr auto',
                        gap: '8px',
                        alignItems: 'start',
                        padding: '8px 10px',
                        borderTop: i === 0 ? 'none' : '1px solid var(--color-border-subtle)',
                        background: checked ? '#fff' : 'var(--color-bg-hover)',
                        opacity: disabled && !checked ? 0.7 : 1,
                      }}
                    >
                      <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => onToggle(p.id)}
                        style={{ width: '15px', height: '15px', marginTop: '2px', accentColor: 'var(--color-accent-active)', cursor: disabled ? 'default' : 'pointer' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <label
                          htmlFor={id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            flexWrap: 'wrap',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                            cursor: disabled ? 'default' : 'pointer',
                            lineHeight: 1.35,
                          }}
                        >
                          <StatusPill tone={TAG_TONE[p.tag]} size="xs">
                            {TAG_LABEL[p.tag]}
                          </StatusPill>
                          <span>{shortTitle(p)}</span>
                        </label>
                        <div style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>{p.evidence}</div>
                        {p.warning && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', fontSize: '11.5px', fontWeight: 600, color: 'var(--color-badge-text)' }}>
                            <AlertTriangle size={11} strokeWidth={2.2} aria-hidden="true" /> {p.warning}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: p.hoursDelta > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                          {signedHours(p.hoursDelta)}
                        </span>
                        <span style={{ ...small, fontVariantNumeric: 'tabular-nums' }}>{signedGBP(p.hoursDelta, hourlyCostGBP)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

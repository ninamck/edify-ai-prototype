'use client';

/**
 * The tickable changes, grouped by day in the order the week runs.
 * Rule fixes are not in this list. They sit above it, applied.
 */

import { DAY_KEYS, type DayKey, type Proposal } from '../types';
import { effectiveProposal } from '../engine';
import { DAY_NAME, dateLabel } from './chips';
import ChangeRow from './ChangeRow';
import { label, small, textButton } from './tokens';

export { signedHours, signedGBP } from './ChangeRow';

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
  chosen,
  onToggle,
  onChoose,
  disabled,
  weekStart,
  hourlyCostGBP,
  onShowDay,
}: {
  /** Everything except rule fixes. */
  proposals: Proposal[];
  selected: Set<string>;
  chosen: Map<string, string>;
  onToggle: (id: string) => void;
  onChoose: (proposalId: string, altId: string | null) => void;
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
                    <ChangeRow
                      key={p.id}
                      p={p}
                      effective={effectiveProposal(p, chosen)}
                      groupDay={d}
                      first={i === 0}
                      labelId={`${id}-label`}
                      control={
                        <input
                          id={id}
                          type="checkbox"
                          aria-labelledby={`${id}-label`}
                          checked={checked}
                          disabled={disabled}
                          onChange={() => onToggle(p.id)}
                          style={{ width: '15px', height: '15px', margin: 0, accentColor: 'var(--color-accent-active)', cursor: disabled ? 'default' : 'pointer' }}
                        />
                      }
                      chosenId={chosen.get(p.id)}
                      onChoose={onChoose}
                      showAlternatives={checked}
                      disabled={disabled}
                      hourlyCostGBP={hourlyCostGBP}
                      muted={!checked}
                      background={checked ? '#fff' : 'var(--color-bg-hover)'}
                    />
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

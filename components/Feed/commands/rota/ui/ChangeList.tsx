'use client';

/**
 * The tickable changes as a grid of tiles, in the order the week runs.
 * Rule fixes are not in this list. They sit above it, applied.
 */

import { DAY_KEYS, type DayKey, type Proposal } from '../types';
import { effectiveProposal } from '../engine';
import ChangeTile, { TileGrid } from './ChangeTile';
import { KIND_STYLE, label, small } from './tokens';

export { signedHours, signedGBP } from './ChangeTile';

/** Week order, then start time within the day. */
export function byDayThenTime(a: Proposal, b: Proposal): number {
  const d = DAY_KEYS.indexOf(a.day) - DAY_KEYS.indexOf(b.day);
  if (d !== 0) return d;
  return (a.after?.start ?? a.before?.start ?? 0) - (b.after?.start ?? b.before?.start ?? 0);
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
  readOnly,
  title = 'Changes',
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
  /** No ticks: the list describes a whole, as with the agent's plan. */
  readOnly?: boolean;
  title?: string;
}) {
  if (proposals.length === 0) return null;
  const on = proposals.filter((p) => selected.has(p.id)).length;
  const sorted = [...proposals].sort(byDayThenTime);

  return (
    <section aria-label={title}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px', gap: '8px' }}>
        <span style={label}>{title}</span>
        <span style={small}>{readOnly ? proposals.length : `${on} of ${proposals.length} ticked`}</span>
      </div>
      <TileGrid ariaLabel={title}>
        {sorted.map((p) => {
          const checked = selected.has(p.id);
          const eff = effectiveProposal(p, chosen);
          const id = `rota-prop-${p.id}`;
          return (
            <ChangeTile
              key={p.id}
              p={p}
              effective={eff}
              weekStart={weekStart}
              onShowDay={onShowDay}
              labelId={`${id}-label`}
              control={
                readOnly ? undefined : (
                  <input
                    id={id}
                    type="checkbox"
                    aria-labelledby={`${id}-label`}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onToggle(p.id)}
                    style={{ width: '15px', height: '15px', margin: 0, accentColor: 'var(--color-accent-active)', cursor: disabled ? 'default' : 'pointer' }}
                  />
                )
              }
              chosenId={chosen.get(p.id)}
              onChoose={onChoose}
              showAlternatives={checked && !readOnly}
              disabled={disabled}
              hourlyCostGBP={hourlyCostGBP}
              muted={!checked}
              borderColor={checked ? KIND_STYLE[eff.kind].border : 'var(--color-border-subtle)'}
              background={checked ? '#fff' : 'var(--color-bg-hover)'}
            />
          );
        })}
      </TileGrid>
    </section>
  );
}

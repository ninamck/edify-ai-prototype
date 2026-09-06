'use client';

/**
 * Rule fixes are not a judgement call, so they do not get a tick box.
 * They are applied, and the GM can leave one as it is if she has a
 * reason Edify cannot see. A fix left off leaves the breach on the
 * draft, and the write stays blocked until it is dealt with, here or in
 * the workforce tool. That is the one thing this card should make hard.
 *
 * Where there is another way to satisfy the rule (finish earlier the
 * night before rather than start later), it is offered as a pill.
 */

import { AlertTriangle, Check } from 'lucide-react';
import type { DayKey, Proposal } from '../types';
import { effectiveProposal } from '../engine';
import ChangeTile, { KindBadge, TileGrid, verbFor } from './ChangeTile';
import { byDayThenTime } from './ChangeList';
import { KIND_STYLE, label, small, textButton } from './tokens';

export default function RuleFixes({
  fixes,
  selected,
  chosen,
  onToggle,
  onChoose,
  disabled,
  weekStart,
  onShowDay,
}: {
  fixes: Proposal[];
  selected: Set<string>;
  chosen: Map<string, string>;
  onToggle: (id: string) => void;
  onChoose: (proposalId: string, altId: string | null) => void;
  disabled?: boolean;
  weekStart: string;
  onShowDay?: (day: DayKey) => void;
}) {
  if (fixes.length === 0) return null;
  const left = fixes.filter((p) => !selected.has(p.id)).length;
  const sorted = [...fixes].sort(byDayThenTime);
  return (
    <section aria-label="Rule fixes">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px', gap: '8px' }}>
        <span style={label}>Rule fixes</span>
        <span style={{ ...small, color: left > 0 ? 'var(--color-error)' : 'var(--color-text-secondary)', fontWeight: left > 0 ? 600 : 500 }}>
          {left === 0 ? 'applied' : `${left} left in breach, write blocked`}
        </span>
      </div>
      <TileGrid ariaLabel="Rule fixes">
        {sorted.map((p) => {
          const applied = selected.has(p.id);
          const eff = effectiveProposal(p, chosen);
          return (
            <ChangeTile
              key={p.id}
              p={p}
              effective={applied ? eff : { ...eff, evidence: `${eff.evidence}. Left as drafted, so the breach stands.` }}
              weekStart={weekStart}
              onShowDay={onShowDay}
              badge={<KindBadge kind={eff.kind} text={`Rule fix: ${verbFor(eff).toLowerCase()}`} tone={applied ? undefined : 'breach'} />}
              control={applied ? <Check size={14} strokeWidth={2.5} color="var(--color-success)" aria-label="Applied" /> : <AlertTriangle size={14} strokeWidth={2.4} color="var(--color-error)" aria-label="In breach" />}
              chosenId={chosen.get(p.id)}
              onChoose={onChoose}
              showAlternatives={applied}
              disabled={disabled}
              borderColor={applied ? KIND_STYLE.amend.border : 'var(--color-error)'}
              background={applied ? KIND_STYLE.amend.bg : '#fff'}
              footer={
                !disabled ? (
                  <div>
                    <button type="button" style={{ ...textButton, padding: '1px 0', fontSize: '11.5px', textDecoration: 'underline dotted', textUnderlineOffset: '2px' }} onClick={() => onToggle(p.id)}>
                      {applied ? 'Leave as is' : 'Apply the fix'}
                    </button>
                  </div>
                ) : undefined
              }
            />
          );
        })}
      </TileGrid>
    </section>
  );
}

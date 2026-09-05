'use client';

/**
 * Rule fixes are not a judgement call, so they do not get a tick box.
 * They are applied, and the GM can leave one as it is if she has a
 * reason Edify cannot see. A fix left off leaves the breach on the
 * draft, and the write stays blocked until it is dealt with, here or in
 * Deputy. That is the one thing this card should make hard.
 *
 * Where there is another way to satisfy the rule (finish earlier the
 * night before rather than start later), it is offered as a pill.
 */

import { AlertTriangle, Check } from 'lucide-react';
import { DAY_KEYS, type DayKey, type Proposal } from '../types';
import { effectiveProposal } from '../engine';
import { DayLabel } from './ChangeList';
import ChangeRow from './ChangeRow';
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
  const days = DAY_KEYS.filter((d) => fixes.some((p) => p.day === d));
  return (
    <section aria-label="Rule fixes">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px', gap: '8px' }}>
        <span style={label}>Rule fixes</span>
        <span style={{ ...small, color: left > 0 ? 'var(--color-error)' : 'var(--color-text-secondary)', fontWeight: left > 0 ? 600 : 500 }}>
          {left === 0 ? 'applied' : `${left} left in breach, write blocked`}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {days.map((d) => {
          const rows = fixes.filter((p) => p.day === d);
          return (
            <div key={d} style={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr)', gap: '8px', alignItems: 'start' }}>
              <DayLabel day={d} weekStart={weekStart} onShowDay={onShowDay} />
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderRadius: '8px', border: `1px solid ${rows.some((p) => !selected.has(p.id)) ? 'var(--color-error)' : KIND_STYLE.amend.border}`, overflow: 'hidden' }}>
                {rows.map((p, i) => {
                  const applied = selected.has(p.id);
                  const eff = effectiveProposal(p, chosen);
                  return (
                    <ChangeRow
                      key={p.id}
                      p={p}
                      effective={applied ? eff : { ...eff, evidence: `${eff.evidence}. Left as drafted, so the breach stands.` }}
                      groupDay={d}
                      first={i === 0}
                      control={applied ? <Check size={14} strokeWidth={2.5} color="var(--color-success)" aria-label="Applied" /> : <AlertTriangle size={14} strokeWidth={2.4} color="var(--color-error)" aria-label="In breach" />}
                      chosenId={chosen.get(p.id)}
                      onChoose={onChoose}
                      showAlternatives={applied}
                      disabled={disabled}
                      background={applied ? KIND_STYLE.amend.bg : '#fff'}
                      aside={
                        !disabled ? (
                          <button type="button" style={{ ...textButton, padding: '1px 0', fontSize: '11.5px', textDecoration: 'underline dotted', textUnderlineOffset: '2px' }} onClick={() => onToggle(p.id)}>
                            {applied ? 'Leave as is' : 'Apply the fix'}
                          </button>
                        ) : undefined
                      }
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

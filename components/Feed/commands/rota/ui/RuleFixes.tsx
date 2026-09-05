'use client';

/**
 * Rule fixes are not a judgement call, so they do not get a tick box.
 * They are applied, and the GM can leave one as it is if she has a
 * reason Edify cannot see. A fix left off leaves the breach on the
 * draft, and the write stays blocked until it is dealt with, here or in
 * Deputy. That is the one thing this card should make hard.
 */

import { AlertTriangle, Check } from 'lucide-react';
import { DAY_KEYS, type DayKey, type Proposal } from '../types';
import { DayLabel, shortTitle, signedHours } from './ChangeList';
import { KIND_STYLE, label, small, textButton } from './tokens';

export default function RuleFixes({
  fixes,
  selected,
  onToggle,
  disabled,
  weekStart,
  onShowDay,
}: {
  fixes: Proposal[];
  selected: Set<string>;
  onToggle: (id: string) => void;
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
                        background: applied ? KIND_STYLE.amend.bg : '#fff',
                      }}
                    >
                      <span style={{ marginTop: '1px', display: 'inline-flex', justifyContent: 'center' }} aria-hidden="true">
                        {applied ? <Check size={14} strokeWidth={2.5} color="var(--color-success)" /> : <AlertTriangle size={14} strokeWidth={2.4} color="var(--color-error)" />}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.35 }}>{shortTitle(p)}</div>
                        <div style={{ fontSize: '11.5px', fontWeight: 500, color: applied ? 'var(--color-text-secondary)' : 'var(--color-error)', marginTop: '2px', lineHeight: 1.4 }}>
                          {applied ? p.evidence : `${p.evidence}. Left as drafted, so the breach stands.`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>{signedHours(p.hoursDelta)}</span>
                        {!disabled && (
                          <button type="button" style={{ ...textButton, padding: '1px 0', fontSize: '11.5px', textDecoration: 'underline dotted', textUnderlineOffset: '2px' }} onClick={() => onToggle(p.id)}>
                            {applied ? 'Leave as is' : 'Apply the fix'}
                          </button>
                        )}
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

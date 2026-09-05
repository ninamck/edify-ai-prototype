'use client';

/**
 * One change, built to be scanned rather than read:
 *
 *   [tick]  Sam Fry   11:00–23:00 → off                    −11.5h
 *           Third person not needed against covers …        −£172
 *           Instead:  (Proposed) (Finish 15:00) (Drop Alba)
 *
 * Line one is who and what moves, in the same time format as the grid.
 * Line two is the reason. The pills are the other ways to solve the
 * same problem; the GM picks one when she knows something the data
 * does not, and the grid and tiles redraw with her choice.
 */

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Alternative, DayKey, Proposal } from '../types';
import { hhmm } from '../engine';
import { small } from './tokens';

export function signedHours(h: number): string {
  return `${h > 0 ? '+' : ''}${h}h`;
}

export function signedGBP(h: number, hourlyCostGBP: number): string {
  const n = Math.round(h * hourlyCostGBP);
  if (n === 0) return '£0';
  return `${n > 0 ? '+' : '-'}£${Math.abs(n).toLocaleString('en-GB')}`;
}

const range = (r: { start: number; end: number }) => `${hhmm(r.start)}–${hhmm(r.end)}`;

/** The edit in the grid's own notation. */
export function changeText(p: Pick<Proposal, 'kind' | 'before' | 'after'>): ReactNode {
  if (p.kind === 'add' && p.after) return <span>+ {range(p.after)}</span>;
  if (p.kind === 'remove' && p.before)
    return (
      <span>
        <span style={{ color: 'var(--color-text-secondary)' }}>{range(p.before)}</span> → off
      </span>
    );
  if (p.before && p.after)
    return (
      <span>
        <span style={{ color: 'var(--color-text-secondary)' }}>{range(p.before)}</span> → {range(p.after)}
      </span>
    );
  return null;
}

/** Short pill label for an alternative, read against the proposal. */
export function altLabel(p: Proposal, a: Alternative): string {
  const samePerson = a.personId === p.personId;
  if (a.kind === 'add') return `Add ${a.personName}`;
  if (a.kind === 'remove') return `Drop ${a.personName}`;
  if (a.before && a.after) {
    const endMoved = a.after.end !== a.before.end;
    const when = endMoved ? `finish ${hhmm(a.after.end)}` : `start ${hhmm(a.after.start)}`;
    const dayNote = a.day !== p.day ? ` ${a.day}` : '';
    return samePerson ? `${when.charAt(0).toUpperCase()}${when.slice(1)}${dayNote}` : `${a.personName} ${when}${dayNote}`;
  }
  return a.title;
}

function Pill({ on, children, onClick, disabled }: { on: boolean; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '2px 9px',
        borderRadius: '100px',
        border: `1px solid ${on ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
        background: on ? 'var(--color-accent-active)' : '#fff',
        color: on ? '#fff' : 'var(--color-text-primary)',
        fontSize: '11.5px',
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        cursor: disabled ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

export default function ChangeRow({
  p,
  effective,
  groupDay,
  control,
  aside,
  chosenId,
  onChoose,
  showAlternatives,
  disabled,
  hourlyCostGBP,
  muted,
  background,
  first,
  labelId,
}: {
  /** The engine's proposal, with its alternatives. */
  p: Proposal;
  /** The proposal as chosen: p, or p with an alternative's edit. */
  effective: Proposal;
  /** Day of the group this row sits in; a different day is spelled out. */
  groupDay: DayKey;
  /** The tick box or status icon on the left. */
  control: ReactNode;
  /** Extra action under the figures on the right, if any. */
  aside?: ReactNode;
  chosenId?: string;
  onChoose?: (proposalId: string, altId: string | null) => void;
  showAlternatives: boolean;
  disabled?: boolean;
  hourlyCostGBP?: number;
  /** Unticked rows sit back. */
  muted?: boolean;
  background?: string;
  first?: boolean;
  /** id for the label so a checkbox can point at it. */
  labelId?: string;
}) {
  const alts = p.alternatives ?? [];
  const evidenceColor = 'var(--color-text-secondary)';
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: '18px 1fr auto',
        gap: '8px',
        alignItems: 'start',
        padding: '8px 10px',
        borderTop: first ? 'none' : '1px solid var(--color-border-subtle)',
        background: background ?? '#fff',
        opacity: muted ? 0.7 : 1,
      }}
    >
      <span style={{ marginTop: '1px', display: 'inline-flex', justifyContent: 'center' }}>{control}</span>
      <div style={{ minWidth: 0 }}>
        <div id={labelId} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', lineHeight: 1.35 }}>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{effective.personName}</span>
          <span style={{ fontSize: '12.5px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
            {effective.day !== groupDay && <span style={{ ...small, marginRight: '6px' }}>{effective.day}</span>}
            {changeText(effective)}
          </span>
        </div>
        <div style={{ fontSize: '11.5px', fontWeight: 500, color: evidenceColor, marginTop: '2px', lineHeight: 1.4 }}>{effective.evidence}</div>
        {effective.warning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', fontSize: '11.5px', fontWeight: 600, color: 'var(--color-badge-text)' }}>
            <AlertTriangle size={11} strokeWidth={2.2} aria-hidden="true" /> {effective.warning}
          </div>
        )}
        {showAlternatives && alts.length > 0 && onChoose && (
          <div role="radiogroup" aria-label="Instead" style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
            <span style={{ ...small, marginRight: '2px' }}>Instead</span>
            <Pill on={!chosenId} disabled={disabled} onClick={() => onChoose(p.id, null)}>
              Proposed
            </Pill>
            {alts.map((a) => (
              <Pill key={a.id} on={chosenId === a.id} disabled={disabled} onClick={() => onChoose(p.id, a.id)}>
                {altLabel(p, a)}
              </Pill>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: effective.hoursDelta > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
          {signedHours(effective.hoursDelta)}
        </span>
        {hourlyCostGBP !== undefined && <span style={{ ...small, fontVariantNumeric: 'tabular-nums' }}>{signedGBP(effective.hoursDelta, hourlyCostGBP)}</span>}
        {aside}
      </div>
    </li>
  );
}

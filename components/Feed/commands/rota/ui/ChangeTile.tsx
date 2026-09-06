'use client';

/**
 * One change as a tile, built to be scanned in a grid:
 *
 *   ┌───────────────────────────────────────────┐
 *   │ [Earlier start]  Fri 11              [✓]  │
 *   │ Inés Duarte                     +1h  +£15 │
 *   │ 12:00–20:00 → 11:00–20:00                 │
 *   │ Topping prep from the brew schedule       │
 *   │ Options (Start 11:00) (Add Mei Lin)       │
 *   └───────────────────────────────────────────┘
 *
 * The badge says what kind of change it is in plain words, in the same
 * colour the grid draws it. The headline is who, the second line is the
 * edit in the grid's own notation, the third is the reason. The pills
 * are the other ways to solve the same problem; the GM picks one when
 * she knows something the data does not.
 */

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Alternative, DayKey, Proposal, ProposalKind } from '../types';
import { hhmm } from '../engine';
import { DAY_NAME, dateLabel } from './chips';
import { KIND_STYLE, small, textButton } from './tokens';

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

/** What kind of change this is, in the GM's words. */
export function verbFor(p: Pick<Proposal, 'kind' | 'before' | 'after'>): string {
  if (p.kind === 'add') return 'Add shift';
  if (p.kind === 'remove') return 'Remove shift';
  if (!p.before || !p.after) return 'Amend shift';
  const startMoved = p.after.start !== p.before.start;
  const endMoved = p.after.end !== p.before.end;
  if (startMoved && endMoved) return p.after.end - p.after.start > p.before.end - p.before.start ? 'Longer shift' : p.after.end - p.after.start < p.before.end - p.before.start ? 'Shorter shift' : 'Move shift';
  if (startMoved) return p.after.start < p.before.start ? 'Earlier start' : 'Later start';
  if (endMoved) return p.after.end > p.before.end ? 'Later finish' : 'Earlier finish';
  return 'Amend shift';
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

function Pill({ on, children, onClick, disabled, title }: { on: boolean; children: ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      title={title}
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

/** The kind badge, in the grid's colour for that kind. */
export function KindBadge({ kind, text, tone }: { kind: ProposalKind; text: string; tone?: 'breach' }) {
  const k = KIND_STYLE[kind];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 7px',
        borderRadius: '5px',
        background: tone === 'breach' ? 'var(--color-error-light, #FBE9E7)' : k.bg,
        border: `1px solid ${tone === 'breach' ? 'var(--color-error)' : k.border}`,
        color: 'var(--color-text-primary)',
        fontSize: '10.5px',
        fontWeight: 700,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        lineHeight: 1.5,
      }}
    >
      {text}
    </span>
  );
}

/** The tile grid. Two across in the card, one in the narrow side panel. */
export function TileGrid({ children, ariaLabel }: { children: ReactNode; ariaLabel: string }) {
  return (
    <ul aria-label={ariaLabel} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
      {children}
    </ul>
  );
}

export default function ChangeTile({
  p,
  effective,
  badge,
  control,
  footer,
  chosenId,
  onChoose,
  showAlternatives,
  disabled,
  hourlyCostGBP,
  muted,
  borderColor,
  background,
  weekStart,
  onShowDay,
  labelId,
}: {
  /** The engine's proposal, with its alternatives. */
  p: Proposal;
  /** The proposal as chosen: p, or p with an alternative's edit. */
  effective: Proposal;
  /** Badge top left. Defaults to the verb for the effective edit. */
  badge?: ReactNode;
  /** The tick box or status icon, top right. */
  control?: ReactNode;
  /** An action under the tile's body, if any. */
  footer?: ReactNode;
  chosenId?: string;
  onChoose?: (proposalId: string, altId: string | null) => void;
  showAlternatives: boolean;
  disabled?: boolean;
  hourlyCostGBP?: number;
  /** Unticked tiles sit back. */
  muted?: boolean;
  borderColor?: string;
  background?: string;
  weekStart: string;
  /** Opens the day in the week strip above. */
  onShowDay?: (day: DayKey) => void;
  /** id for the label so a checkbox can point at it. */
  labelId?: string;
}) {
  const alts = p.alternatives ?? [];
  const dayText = `${effective.day} ${dateLabel(weekStart, effective.day)}`;
  return (
    <li
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        padding: '9px 11px 10px',
        borderRadius: '10px',
        border: `1px solid ${borderColor ?? 'var(--color-border-subtle)'}`,
        background: background ?? '#fff',
        opacity: muted ? 0.72 : 1,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {badge ?? <KindBadge kind={effective.kind} text={verbFor(effective)} />}
        {onShowDay ? (
          <button
            type="button"
            onClick={() => onShowDay(effective.day)}
            aria-label={`Show ${DAY_NAME[effective.day]} in the week`}
            title={`Show ${DAY_NAME[effective.day]} in the week`}
            style={{ ...textButton, padding: 0, fontSize: '11.5px', textDecoration: 'underline dotted', textUnderlineOffset: '3px' }}
          >
            {dayText}
          </button>
        ) : (
          <span style={small}>{dayText}</span>
        )}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>{control}</span>
      </div>

      <div id={labelId} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>{effective.personName}</div>
          <div style={{ fontSize: '12.5px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>{changeText(effective)}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>{signedHours(effective.hoursDelta)}</span>
          {hourlyCostGBP !== undefined && <span style={{ ...small, fontVariantNumeric: 'tabular-nums' }}>{signedGBP(effective.hoursDelta, hourlyCostGBP)}</span>}
        </div>
      </div>

      <div style={{ ...small, lineHeight: 1.4 }}>{effective.evidence}</div>

      {effective.warning && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 600, color: 'var(--color-badge-text)' }}>
          <AlertTriangle size={11} strokeWidth={2.2} aria-hidden="true" /> {effective.warning}
        </div>
      )}

      {showAlternatives && alts.length > 0 && onChoose && (
        <div role="radiogroup" aria-label="Ways to do this" style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginTop: '2px' }}>
          <span style={{ ...small, marginRight: '2px' }}>Options</span>
          <Pill on={!chosenId} disabled={disabled} onClick={() => onChoose(p.id, null)} title="Edify's pick">
            {altLabel(p, { ...p, id: p.id, evidence: p.evidence })}
          </Pill>
          {alts.map((a) => (
            <Pill key={a.id} on={chosenId === a.id} disabled={disabled} onClick={() => onChoose(p.id, a.id)}>
              {altLabel(p, a)}
            </Pill>
          ))}
        </div>
      )}

      {footer}
    </li>
  );
}

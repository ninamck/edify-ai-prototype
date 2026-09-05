'use client';

/**
 * The week as a rota: people down, days across, as Deputy lays it out.
 *
 * This is the "is it covered" view. It carries as little as it can:
 * names, times, a colour where a change lands, a cover strip under each
 * day and each person's hours for the week. No reasons, no tags, no
 * evidence. Those live in the list. Hover a cell for the reason.
 *
 * Renders inline in the card at `sm`, and fills the screen at `lg`
 * through RotaGridDialog for the GM who wants to read the whole week.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X } from 'lucide-react';
import { DAY_KEYS, type DayAnalysis, type DayKey, type DeputyDraft, type Person, type Proposal, type Shift } from '../types';
import { hhmm, shiftHours } from '../engine';
import { type ChipModel, CoverStrip, chipsForPerson, dateLabel, spokenChip } from './chips';
import { KIND_STYLE, label, small, textButton } from './tokens';

type Size = 'sm' | 'lg';

const SIZES: Record<Size, { name: string; time: string; nameCol: string; hoursCol: string; pad: string; gap: string }> = {
  sm: { name: '12px', time: '11.5px', nameCol: '112px', hoursCol: '56px', pad: '4px 6px', gap: '3px' },
  lg: { name: '13.5px', time: '13px', nameCol: '180px', hoursCol: '84px', pad: '8px 10px', gap: '4px' },
};

function range(r: { start: number; end: number }): string {
  return `${hhmm(r.start)}–${hhmm(r.end)}`;
}

/** People grouped under the area they mostly work, in Deputy's area
 *  order. People with nothing on and nothing proposed are left out. */
function rowsFor(draft: DeputyDraft, proposals: Proposal[]): { area: string; people: Person[] }[] {
  const areaOf = new Map<string, string>();
  for (const p of draft.people) {
    const counts = new Map<string, number>();
    for (const s of draft.shifts.filter((x) => x.personId === p.id)) counts.set(s.area, (counts.get(s.area) ?? 0) + 1);
    for (const x of proposals.filter((x) => x.kind === 'add' && x.personId === p.id)) counts.set(x.area, (counts.get(x.area) ?? 0) + 0.5);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) areaOf.set(p.id, top[0]);
  }
  return draft.areas
    .map((area) => ({ area, people: draft.people.filter((p) => areaOf.get(p.id) === area) }))
    .filter((g) => g.people.length > 0);
}

function Cell({ c, size }: { c: ChipModel; size: Size }) {
  const s = SIZES[size];
  const applied = c.applied && c.kind !== 'unchanged';
  const style = applied ? KIND_STYLE[c.kind] : KIND_STYLE.unchanged;
  const ghost = !c.applied && c.kind !== 'unchanged';
  const struck = applied && c.kind === 'remove';
  return (
    <div
      role="group"
      aria-label={spokenChip(c)}
      title={c.kind === 'unchanged' ? undefined : c.applied ? `${KIND_STYLE[c.kind].label}: ${c.reason}` : `Suggested, not ticked: ${c.reason}`}
      style={{
        padding: s.pad,
        borderRadius: '6px',
        background: style.bg,
        border: `1px ${c.kind === 'add' || ghost ? 'dashed' : 'solid'} ${ghost ? 'var(--color-border)' : style.border}`,
        opacity: ghost ? 0.65 : 1,
        fontSize: s.time,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        color: struck ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
        textDecoration: struck ? 'line-through' : 'none',
        fontWeight: applied && !struck ? 600 : 500,
      }}
    >
      {c.kind === 'amend' && c.applied && c.before && c.after ? (
        <>
          <div style={{ textDecoration: 'line-through', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{range(c.before)}</div>
          <div>{range(c.after)}</div>
        </>
      ) : (
        range((c.kind === 'add' ? c.after : c.before)!)
      )}
    </div>
  );
}

function Legend() {
  const sw = (bg: string, border: string, dashed?: boolean) => (
    <span aria-hidden="true" style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: bg, border: `1px ${dashed ? 'dashed' : 'solid'} ${border}`, verticalAlign: '-2px', marginRight: '5px' }} />
  );
  return (
    <div style={{ ...small, display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
      <span>{sw(KIND_STYLE.add.bg, KIND_STYLE.add.border, true)}Added</span>
      <span>{sw(KIND_STYLE.amend.bg, KIND_STYLE.amend.border)}Changed</span>
      <span>{sw(KIND_STYLE.remove.bg, KIND_STYLE.remove.border)}Removed</span>
      <span>{sw('#fff', 'var(--color-border)', true)}Suggested, not ticked</span>
      <span>Red under a day: short of cover. Grey: a head idle.</span>
    </div>
  );
}

export interface RotaGridProps {
  draft: DeputyDraft;
  proposals: Proposal[];
  selected: Set<string>;
  /** Analysis of the rota as ticked. */
  analysis: DayAnalysis[];
  /** Shifts as ticked, for each person's hours. */
  shifts: Shift[];
}

export default function RotaGrid({ draft, proposals, selected, analysis, shifts, size = 'sm' }: RotaGridProps & { size?: Size }) {
  const s = SIZES[size];
  const groups = rowsFor(draft, proposals);
  const hoursFor = (personId: string) => Math.round(shifts.filter((x) => x.personId === personId).reduce((t, x) => t + shiftHours(x), 0) * 2) / 2;
  const cols = `${s.nameCol} repeat(7, minmax(0, 1fr)) ${s.hoursCol}`;
  const rule = '1px solid var(--color-border-subtle)';

  return (
    <div role="table" aria-label={`Draft rota, ${draft.weekLabel}`} style={{ display: 'grid', gridTemplateColumns: cols, columnGap: '6px', alignItems: 'stretch' }}>
      <div role="row" style={{ display: 'contents' }}>
        <div role="columnheader" aria-label="Person" />
        {DAY_KEYS.map((d) => {
          const a = analysis.find((x) => x.day === d)!;
          return (
            <div key={d} role="columnheader" style={{ minWidth: 0, paddingBottom: '6px', alignSelf: 'end' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: s.name, fontWeight: 700, color: 'var(--color-text-primary)' }}>{d}</span>
                <span style={small}>{dateLabel(draft.weekStart, d)}</span>
              </div>
              <CoverStrip a={a} height={size === 'lg' ? 7 : 6} />
            </div>
          );
        })}
        <div role="columnheader" style={{ ...small, alignSelf: 'end', paddingBottom: '6px', textAlign: 'right' }}>
          Hours
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.area} role="rowgroup" style={{ display: 'contents' }}>
          <div role="row" style={{ display: 'contents' }}>
            <div role="rowheader" style={{ ...label, gridColumn: '1 / -1', padding: size === 'lg' ? '14px 0 6px' : '10px 0 4px', borderBottom: rule }}>
              {g.area}
            </div>
          </div>
          {g.people.map((p) => {
            const h = hoursFor(p.id);
            return (
              <div key={p.id} role="row" style={{ display: 'contents' }}>
                <div role="rowheader" style={{ padding: size === 'lg' ? '8px 0' : '6px 0', borderBottom: rule, minWidth: 0 }}>
                  <div style={{ fontSize: s.name, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>{p.name}</div>
                  {size === 'lg' && <div style={small}>{p.role}{p.age !== undefined && p.age < 18 ? ', under 18' : ''}</div>}
                </div>
                {DAY_KEYS.map((d: DayKey) => {
                  const cells = chipsForPerson(draft, proposals, selected, p.id, d);
                  const off = p.leave?.includes(d);
                  return (
                    <div key={d} role="cell" style={{ display: 'flex', flexDirection: 'column', gap: s.gap, padding: size === 'lg' ? '6px 0' : '4px 0', borderBottom: rule, minWidth: 0, justifyContent: 'center' }}>
                      {cells.map((c) => (
                        <Cell key={c.key} c={c} size={size} />
                      ))}
                      {cells.length === 0 && off && <span style={{ ...small, fontSize: s.time }}>Leave</span>}
                    </div>
                  );
                })}
                <div role="cell" style={{ padding: size === 'lg' ? '8px 0' : '6px 0', borderBottom: rule, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ fontSize: s.name, fontWeight: 600, color: 'var(--color-text-primary)' }}>{h}h</div>
                  <div style={{ ...small, fontSize: size === 'lg' ? '11.5px' : '11px' }}>{p.contractedHours > 0 ? `of ${p.contractedHours}` : 'casual'}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** The grid at full screen. Escape or the close button returns to the
 *  card; focus goes to the close button on open and back where it was
 *  on close. Nothing here is editable: ticks stay on the card. */
export function RotaGridDialog({ open, onClose, ...grid }: RotaGridProps & { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      returnTo.current?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Draft rota, ${grid.draft.siteName}, ${grid.draft.weekLabel}`}
      style={{ position: 'fixed', inset: 0, zIndex: 1300, background: '#fff', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 24px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {grid.draft.siteName}, {grid.draft.weekLabel}
          </div>
          <div style={small}>
            {grid.draft.tool} draft with the ticked changes drawn on. Read only: tick and untick on the card.
          </div>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close full screen"
          style={{ ...textButton, display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 12px', border: '1.5px solid var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <X size={15} aria-hidden="true" /> Close
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px 24px' }}>
        <RotaGrid {...grid} size="lg" />
        <div style={{ marginTop: '16px' }}>
          <Legend />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Inline header for the grid: legend and the full-screen control. */
export function RotaGridToolbar({ onFullScreen }: { onFullScreen: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
      <Legend />
      <button
        type="button"
        onClick={onFullScreen}
        style={{ ...textButton, display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 8px', color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}
      >
        <Maximize2 size={13} aria-hidden="true" /> Full screen
      </button>
    </div>
  );
}

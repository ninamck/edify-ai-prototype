'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { dayDate } from '../cashFixtures';

/** Days are offsets from today: 0 is today, -1 yesterday. */
export type DayRange = { lo: number; hi: number };

const short = (day: number, now: Date) => dayDate(day, now).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const offsetOf = (d: Date, now: Date) => Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000);

export const rangeLabel = ({ lo, hi }: DayRange, now = new Date()) => (lo === hi ? short(lo, now) : `${short(lo, now)} to ${short(hi, now)}`);

/** Pick a run of days from what the shop has on record. First click starts the range, the second ends it. */
export default function DayRangePicker({ value, onChange, min, max = 0, presets, now = new Date() }: {
  value: DayRange;
  onChange: (v: DayRange) => void;
  min: number;
  max?: number;
  presets: { label: string; range: DayRange }[];
  now?: Date;
}) {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<'left' | 'right'>('left');
  const [pending, setPending] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [month, setMonth] = useState(() => monthStart(dayDate(value.hi, now)));
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialogId = useId();

  const close = (focus = true) => {
    setOpen(false);
    setPending(null);
    setHover(null);
    if (focus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) close(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  });

  const pick = (day: number) => {
    if (pending === null) { setPending(day); return; }
    onChange({ lo: Math.min(pending, day), hi: Math.max(pending, day) });
    close();
  };

  const shown = pending === null ? value : { lo: Math.min(pending, hover ?? pending), hi: Math.max(pending, hover ?? pending) };
  const minMonth = monthStart(dayDate(min, now));
  const maxMonth = monthStart(dayDate(max, now));
  const cells = monthGrid(month);

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-label={`Dates, ${rangeLabel(value, now)}`}
        onClick={() => {
          if (open) { close(); return; }
          setMonth(monthStart(dayDate(value.hi, now)));
          const r = trigger.current?.getBoundingClientRect();
          setAlign(r && r.left + POPOVER_WIDTH > window.innerWidth - 8 ? 'right' : 'left');
          setOpen(true);
        }}
        style={{ ...control, gap: 8, padding: '0 12px 0 14px' }}
      >
        <Calendar size={16} aria-hidden />
        <span>{rangeLabel(value, now)}</span>
        <ChevronDown size={16} aria-hidden style={{ color: 'var(--color-text-secondary)' }} />
      </button>

      {open && (
        <div id={dialogId} role="dialog" aria-label="Choose dates" style={{ ...popover, [align]: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {presets.map(p => {
              const active = p.range.lo === value.lo && p.range.hi === value.hi;
              return (
                <button key={p.label} type="button" aria-pressed={active} onClick={() => { onChange(p.range); close(); }}
                  style={{ ...chip, background: active ? 'var(--color-text-primary)' : '#ffffff', color: active ? '#ffffff' : 'var(--color-text-primary)', borderColor: active ? 'var(--color-text-primary)' : 'var(--color-border)' }}>
                  {p.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button type="button" aria-label="Previous month" disabled={month <= minMonth} onClick={() => setMonth(shiftMonth(month, -1))} style={navBtn(month <= minMonth)}>
              <ChevronLeft size={18} aria-hidden />
            </button>
            <span aria-live="polite" style={{ fontSize: 14, fontWeight: 700 }}>
              {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" aria-label="Next month" disabled={month >= maxMonth} onClick={() => setMonth(shiftMonth(month, 1))} style={navBtn(month >= maxMonth)}>
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>

          <div onMouseLeave={() => setHover(null)} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 44px)', rowGap: 2 }}>
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
              <span key={d} aria-hidden style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', paddingBottom: 4 }}>{d}</span>
            ))}
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const day = offsetOf(d, now);
              const disabled = day < min || day > max;
              const edge = day === shown.lo || day === shown.hi;
              const inside = day > shown.lo && day < shown.hi;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  aria-pressed={edge || inside}
                  aria-label={d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  onClick={() => pick(day)}
                  onMouseEnter={() => setHover(day)}
                  onFocus={() => setHover(day)}
                  style={{
                    height: 44, border: day === 0 && !edge ? '1px solid var(--color-text-primary)' : '1px solid transparent',
                    borderRadius: edge ? 10 : inside ? 0 : 10, fontFamily: 'inherit', fontSize: 13, fontVariantNumeric: 'tabular-nums',
                    fontWeight: edge ? 700 : 500, cursor: disabled ? 'default' : 'pointer',
                    background: edge ? 'var(--color-text-primary)' : inside ? 'var(--color-bg-hover)' : 'transparent',
                    color: edge ? '#ffffff' : disabled ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                    opacity: disabled ? 0.45 : 1,
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <p role="status" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: 'var(--color-text-secondary)' }}>
            {pending === null ? 'Pick the first day, then the last.' : 'Now pick the last day.'} The demo holds {max - min + 1} days, from {short(min, now)}.
          </p>
        </div>
      )}
    </div>
  );
}

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function shiftMonth(d: Date, by: number) {
  return new Date(d.getFullYear(), d.getMonth() + by, 1);
}

/** Monday-first, padded with blanks so the 1st lands on its weekday. */
function monthGrid(month: Date): (Date | null)[] {
  const lead = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
}

/** The shared height for the controls in a report's header row. */
export const control: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 16px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: '#ffffff', color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-primary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};

const POPOVER_WIDTH = 338;

const popover: CSSProperties = {
  position: 'absolute', top: 'calc(100% + 6px)', zIndex: 50, width: POPOVER_WIDTH, padding: 15, display: 'flex', flexDirection: 'column', gap: 12,
  background: '#ffffff', border: '1px solid var(--color-border-subtle)', borderRadius: 14, boxShadow: '0 10px 30px rgba(0, 28, 53, 0.14)',
  fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)',
};

const chip: CSSProperties = {
  minHeight: 44, padding: '0 14px', borderRadius: 999, border: '1px solid', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
};

const navBtn = (disabled: boolean): CSSProperties => ({
  display: 'grid', placeItems: 'center', width: 44, height: 44, border: 'none', borderRadius: 10, background: 'transparent',
  color: 'var(--color-text-primary)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1,
});

'use client';

/**
 * DateRangePicker — the global date scope control.
 *
 * Two panes that are two views of the same value: a grouped preset list and
 * a range calendar. Picking a preset highlights its span in the calendar;
 * dragging out dates in the calendar switches the value to a custom range.
 *
 * Presets lead with trading periods rather than calendar months, because the
 * business closes on 4-week periods. Calendar months stay available for
 * anyone reconciling against a statutory month, but they are the second
 * group, not the first. `Last 4 weeks` and `This period` are deliberately
 * separated — they are different windows and treating them as synonyms is a
 * standard reporting mistake.
 *
 * The range model, resolution and labelling all live in `lib/dateRange`;
 * this file is presentation only.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  PRESET_GROUPS,
  addDays,
  compareIso,
  dayCount,
  formatRange,
  parseIso,
  rangesEqual,
  resolveDateRange,
  startOfWeek,
  toIso,
  todayIso,
  tradingPeriodFor,
  type DateRange,
  type DateRangeKind,
  type SimpleRangeKind,
} from '@/lib/dateRange';

export type { DateRange, DateRangeKind, SimpleRangeKind };

/** How far the calendar lets you travel. Two years back supports year-on-year. */
const HISTORY_DAYS = 730;
const FUTURE_DAYS = 14;

export default function DateRangePicker({
  value,
  onChange,
  anchor,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  /** Override "today". Used by demos and tests; defaults to the real day. */
  anchor?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const today = anchor ?? todayIso();
  const resolved = useMemo(
    () => resolveDateRange(value, { anchor: today }),
    [value, today],
  );

  // Half-finished calendar selection: the first click parks an anchor here
  // and the second click commits the range. Null means "not mid-selection".
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Which month the grid is showing. Reset when the menu opens rather than in
  // an effect, so opening doesn't cost a second render pass.
  const [visibleMonth, setVisibleMonth] = useState(() => monthOf(resolved.end));

  function openMenu() {
    setVisibleMonth(monthOf(resolved.end));
    setPendingStart(null);
    setHovered(null);
    setOpen(true);
  }

  function closeMenu() {
    setPendingStart(null);
    setHovered(null);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      closeMenu();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu();
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const minDate = addDays(today, -HISTORY_DAYS);
  const maxDate = addDays(today, FUTURE_DAYS);

  function pickPreset(kind: SimpleRangeKind) {
    onChange({ kind });
    closeMenu();
  }

  function pickDay(iso: string) {
    if (pendingStart === null) {
      setPendingStart(iso);
      return;
    }
    const [start, end] =
      compareIso(pendingStart, iso) <= 0 ? [pendingStart, iso] : [iso, pendingStart];
    onChange({ kind: 'custom', start, end });
    closeMenu();
  }

  // While mid-selection the calendar previews the range under the cursor
  // rather than the committed value, so the drag reads as direct.
  const preview = useMemo(() => {
    if (pendingStart === null) return { start: resolved.start, end: resolved.end };
    const other = hovered ?? pendingStart;
    return compareIso(pendingStart, other) <= 0
      ? { start: pendingStart, end: other }
      : { start: other, end: pendingStart };
  }, [pendingStart, hovered, resolved.start, resolved.end]);

  const trigger = triggerParts(value, resolved.label, resolved.absoluteLabel);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closeMenu() : openMenu())}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={triggerStyle}
      >
        <Calendar size={12} strokeWidth={2.2} color="var(--color-text-muted)" />
        <span>{trigger.primary}</span>
        {trigger.secondary && (
          <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
            {trigger.secondary}
          </span>
        )}
        <ChevronDown size={12} strokeWidth={2.2} color="var(--color-text-muted)" />
      </button>

      {open && (
        <div ref={menuRef} role="dialog" aria-label="Date range" style={menuStyle}>
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <div style={presetPaneStyle}>
              {PRESET_GROUPS.map(group => (
                <div key={group.heading}>
                  <div style={groupHeadingStyle}>{group.heading}</div>
                  {group.options.map(opt => (
                    <PresetItem
                      key={opt.kind}
                      label={opt.label}
                      hint={presetHint(opt.kind, today)}
                      active={rangesEqual(value, { kind: opt.kind })}
                      onClick={() => pickPreset(opt.kind)}
                    />
                  ))}
                </div>
              ))}
            </div>

            <div style={calendarPaneStyle}>
              <RangeCalendar
                visibleMonth={visibleMonth}
                onVisibleMonthChange={setVisibleMonth}
                start={preview.start}
                end={preview.end}
                today={today}
                minDate={minDate}
                maxDate={maxDate}
                selecting={pendingStart !== null}
                onPick={pickDay}
                onHover={setHovered}
              />
            </div>
          </div>

          <div style={footerStyle}>
            <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {resolved.absoluteLabel}
            </span>
            <span>{dayCount(resolved.start, resolved.end)} days</span>
            <span style={{ marginLeft: 'auto', textAlign: 'right' }}>
              {pendingStart !== null
                ? 'Pick an end date'
                : `${periodSpanLabel(resolved.start, resolved.end)} · ${
                    resolved.settlement === 'provisional' ? 'Provisional' : 'Settled'
                  }`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calendar ────────────────────────────────────────────────────────────────

function RangeCalendar({
  visibleMonth,
  onVisibleMonthChange,
  start,
  end,
  today,
  minDate,
  maxDate,
  selecting,
  onPick,
  onHover,
}: {
  visibleMonth: string;
  onVisibleMonthChange: (iso: string) => void;
  start: string;
  end: string;
  today: string;
  minDate: string;
  maxDate: string;
  selecting: boolean;
  onPick: (iso: string) => void;
  onHover: (iso: string | null) => void;
}) {
  const cells = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
  const month = parseIso(visibleMonth).getUTCMonth();

  const prevMonth = shiftMonth(visibleMonth, -1);
  const nextMonth = shiftMonth(visibleMonth, 1);
  const canPrev = compareIso(lastDayOfMonth(prevMonth), minDate) >= 0;
  const canNext = compareIso(nextMonth, maxDate) <= 0;

  return (
    <div onMouseLeave={() => onHover(null)}>
      <div style={calendarHeaderStyle}>
        <NavButton
          label="Previous month"
          disabled={!canPrev}
          onClick={() => onVisibleMonthChange(prevMonth)}
        >
          <ChevronLeft size={14} strokeWidth={2.4} />
        </NavButton>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {parseIso(visibleMonth).toLocaleDateString('en-GB', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })}
        </span>
        <NavButton
          label="Next month"
          disabled={!canNext}
          onClick={() => onVisibleMonthChange(nextMonth)}
        >
          <ChevronRight size={14} strokeWidth={2.4} />
        </NavButton>
      </div>

      <div style={weekdayRowStyle}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} style={weekdayCellStyle}>
            {d}
          </span>
        ))}
      </div>

      <div style={gridStyle}>
        {cells.map(cell => {
          const outside = cell.month !== month;
          const disabled =
            compareIso(cell.iso, minDate) < 0 || compareIso(cell.iso, maxDate) > 0;
          const inRange =
            compareIso(cell.iso, start) >= 0 && compareIso(cell.iso, end) <= 0;
          const isStart = cell.iso === start;
          const isEnd = cell.iso === end;
          const isEdge = isStart || isEnd;
          const period = tradingPeriodFor(cell.iso);
          const startsPeriod = period.start === cell.iso;

          return (
            <button
              key={cell.iso}
              type="button"
              disabled={disabled}
              onClick={() => onPick(cell.iso)}
              onMouseEnter={() => onHover(cell.iso)}
              aria-label={`${formatRange(cell.iso, cell.iso)} · ${period.code}`}
              style={{
                position: 'relative',
                height: 30,
                border:
                  cell.iso === today && !isEdge
                    ? '1px solid color-mix(in srgb, var(--color-accent-active) 35%, white)'
                    : '1px solid transparent',
                borderRadius: isEdge ? 7 : inRange ? 0 : 7,
                background: isEdge
                  ? 'var(--color-accent-active)'
                  : inRange
                    ? 'color-mix(in srgb, var(--color-accent-active) 9%, white)'
                    : 'transparent',
                color: isEdge
                  ? '#fff'
                  : disabled || outside
                    ? 'var(--color-text-muted)'
                    : 'var(--color-text-primary)',
                fontSize: 12,
                fontWeight: isEdge || cell.iso === today ? 700 : 500,
                fontFamily: 'var(--font-primary)',
                fontVariantNumeric: 'tabular-nums',
                opacity: outside && !inRange ? 0.4 : 1,
                cursor: disabled ? 'default' : selecting ? 'crosshair' : 'pointer',
                transition: 'background 80ms ease',
              }}
            >
              {cell.day}
              {/* Period boundaries are the spine of the trading calendar, so
                  the grid marks where each one opens. */}
              {startsPeriod && !isEdge && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 3,
                    height: 3,
                    borderRadius: '50%',
                    background: 'var(--color-accent-mid)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div style={calendarNoteStyle}>
        <span
          style={{
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: 'var(--color-accent-mid)',
            display: 'inline-block',
          }}
        />
        Period start
      </div>
    </div>
  );
}

// ── Small pieces ────────────────────────────────────────────────────────────

function PresetItem({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 1,
        width: '100%',
        padding: '5px 8px',
        border: 'none',
        borderRadius: 6,
        background: active
          ? 'color-mix(in srgb, var(--color-accent-active) 8%, white)'
          : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: active ? 700 : 500,
          color: 'var(--color-text-primary)',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{hint}</span>
    </button>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        borderRadius: 6,
        color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

// ── Derivations ─────────────────────────────────────────────────────────────

/** Resolved dates shown under each preset, so the window is never a guess. */
function presetHint(kind: SimpleRangeKind, anchor: string): string {
  const r = resolveDateRange({ kind }, { anchor });
  if (kind === 'this_period' || kind === 'last_period') {
    return `${tradingPeriodFor(r.start).code} · ${r.absoluteLabel}`;
  }
  return r.absoluteLabel;
}

function triggerParts(
  value: DateRange,
  label: string,
  absoluteLabel: string,
): { primary: string; secondary: string | null } {
  if (value.kind === 'custom') return { primary: absoluteLabel, secondary: null };
  // Strip the parenthetical period code from the trigger; the dates that
  // follow say the same thing more precisely.
  const primary = label.replace(/\s*\(.*\)$/, '');
  return { primary, secondary: absoluteLabel };
}

/** "P8" for a range inside one period, "P7–P8" when it straddles a close. */
function periodSpanLabel(start: string, end: string): string {
  const a = tradingPeriodFor(start);
  const b = tradingPeriodFor(end);
  return a.code === b.code ? a.code : `${a.code}–${b.code}`;
}

// ── Calendar maths (UTC, Monday-first — matches every other grid) ───────────

type Cell = { iso: string; day: number; month: number };

function monthOf(iso: string): string {
  const d = parseIso(iso);
  return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

function shiftMonth(monthIso: string, delta: number): string {
  const d = parseIso(monthIso);
  return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1)));
}

function lastDayOfMonth(monthIso: string): string {
  const d = parseIso(monthIso);
  return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

/** Always 42 cells so paging never shifts the layout. */
function buildMonthGrid(monthIso: string): Cell[] {
  const gridStart = startOfWeek(monthIso);
  return Array.from({ length: 42 }, (_, i) => {
    const iso = addDays(gridStart, i);
    const d = parseIso(iso);
    return { iso, day: d.getUTCDate(), month: d.getUTCMonth() };
  });
}

// ── Styles ──────────────────────────────────────────────────────────────────

const triggerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 100,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  whiteSpace: 'nowrap',
};

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: 0,
  zIndex: 300,
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 10,
  boxShadow: '0 8px 28px rgba(0, 28, 53,0.14), 0 0 0 1px rgba(0, 28, 53,0.04)',
  fontFamily: 'var(--font-primary)',
  overflow: 'hidden',
};

const presetPaneStyle: React.CSSProperties = {
  width: 168,
  padding: 6,
  borderRight: '1px solid var(--color-border-subtle)',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const calendarPaneStyle: React.CSSProperties = {
  width: 250,
  padding: 8,
};

const groupHeadingStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  padding: '6px 8px 3px',
};

const calendarHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 2px 6px',
};

const weekdayRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 1,
};

const weekdayCellStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  padding: '2px 0 4px',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 1,
};

const calendarNoteStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 10,
  color: 'var(--color-text-muted)',
  padding: '8px 2px 0',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 12px',
  borderTop: '1px solid var(--color-border-subtle)',
  background: 'color-mix(in srgb, var(--color-accent-active) 3%, white)',
  fontSize: 11,
  color: 'var(--color-text-secondary)',
};

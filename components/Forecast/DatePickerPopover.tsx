'use client';

/**
 * DatePickerPopover — small custom month-grid calendar used by the
 * Forecast page's date pill.
 *
 * Why custom and not <input type="date">?
 *  - Native pickers render with browser chrome we can't theme to the
 *    rest of the page, and the "open via showPicker()" dance is flaky
 *    on Safari. A custom popover lives in the same design system as the
 *    pills it sits next to and is testable end-to-end with React Testing
 *    Library if/when we add that.
 *  - The prototype only needs single-date picking inside a bounded
 *    range, so the surface stays small (no time, no ranges, no
 *    multi-select).
 *
 * Behaviour:
 *  - Mounts on demand and renders absolutely below the trigger.
 *  - Mon–Sun weekday header, 6-row grid (always — month layout is
 *    stable so the popover doesn't jump in size when you page).
 *  - Today carries a small dot; selected day is filled with the accent;
 *    days outside `[min, max]` are disabled (not just dimmed).
 *  - Click outside / Escape dismisses; ‹ › arrows step months. Disabled
 *    arrow when the next/prev month is entirely outside the range.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DEMO_TODAY } from '@/components/Production/fixtures';

type Props = {
  /** Currently picked date — also drives which month opens first. */
  selectedDate: string;
  /** Inclusive lower bound (ISO yyyy-mm-dd). */
  min: string;
  /** Inclusive upper bound (ISO yyyy-mm-dd). */
  max: string;
  onSelect: (date: string) => void;
  onClose: () => void;
};

export default function DatePickerPopover({
  selectedDate,
  min,
  max,
  onSelect,
  onClose,
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Which month is rendered. Initialised once from `selectedDate`; the
  // parent controls re-mounting (via a key change) so we don't need to
  // sync with `selectedDate` after mount — opening the popover always
  // starts in the month of the currently picked date.
  const [month, setMonth] = useState(() => firstOfMonth(selectedDate));

  const stepMonth = useCallback((delta: number) => {
    setMonth(prev => addMonths(prev, delta));
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!popoverRef.current) return;
      if (e.target instanceof Node && popoverRef.current.contains(e.target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // pointerdown rather than click — fires before any click handler on
    // the trigger that would otherwise reopen the popover.
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const monthLabel = useMemo(() => formatMonth(month), [month]);

  const prevDisabled = compareIso(addMonths(month, -1, true), min) < 0;
  const nextDisabled = compareIso(addMonths(month, 1), max) > 0;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Pick a date"
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        zIndex: 30,
        width: 280,
        background: '#ffffff',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)',
        padding: 12,
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Month header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <ArrowButton
          ariaLabel="Previous month"
          disabled={prevDisabled}
          onClick={() => stepMonth(-1)}
        >
          <ChevronLeft size={15} />
        </ArrowButton>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {monthLabel}
        </span>
        <ArrowButton
          ariaLabel="Next month"
          disabled={nextDisabled}
          onClick={() => stepMonth(1)}
        >
          <ChevronRight size={15} />
        </ArrowButton>
      </div>

      {/* Weekday header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          rowGap: 4,
          marginBottom: 4,
        }}
      >
        {WEEKDAY_LABELS.map(label => (
          <span
            key={label}
            style={{
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
        }}
      >
        {cells.map(cell => {
          const isOutsideMonth = cell.month !== monthIndex(month);
          const isOutsideRange =
            compareIso(cell.iso, min) < 0 || compareIso(cell.iso, max) > 0;
          const isSelected = cell.iso === selectedDate;
          const isToday = cell.iso === DEMO_TODAY;
          const disabled = isOutsideRange;

          return (
            <button
              key={cell.iso}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onSelect(cell.iso);
              }}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={isSelected}
              style={dayCellStyle({
                disabled,
                isOutsideMonth,
                isSelected,
                isToday,
              })}
            >
              {cell.day}
              {isToday && !isSelected && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    bottom: 3,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: 999,
                    background: 'var(--color-accent-active)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer — quick "Today" shortcut when today is inside the range. */}
      {compareIso(DEMO_TODAY, min) >= 0 && compareIso(DEMO_TODAY, max) <= 0 && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid var(--color-border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={() => onSelect(DEMO_TODAY)}
            style={{
              padding: '5px 10px',
              border: '1px solid var(--color-border-subtle)',
              background: '#ffffff',
              color: 'var(--color-text-secondary)',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Jump to today
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Small bits
// ────────────────────────────────────────────────────────────────────────────

function ArrowButton({
  children,
  ariaLabel,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
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

function dayCellStyle({
  disabled,
  isOutsideMonth,
  isSelected,
  isToday,
}: {
  disabled: boolean;
  isOutsideMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
}): React.CSSProperties {
  const color = disabled
    ? 'var(--color-text-muted)'
    : isOutsideMonth
      ? 'var(--color-text-muted)'
      : 'var(--color-text-primary)';
  return {
    position: 'relative',
    height: 32,
    border: isToday && !isSelected
      ? '1px solid color-mix(in srgb, var(--color-accent-active) 35%, white)'
      : '1px solid transparent',
    background: isSelected ? 'var(--color-accent-active)' : 'transparent',
    color: isSelected ? '#ffffff' : color,
    fontSize: 13,
    fontWeight: isSelected || isToday ? 700 : 500,
    fontFamily: 'var(--font-primary)',
    fontVariantNumeric: 'tabular-nums',
    cursor: disabled ? 'default' : 'pointer',
    borderRadius: 7,
    opacity: isOutsideMonth && !isSelected ? 0.45 : 1,
    transition: 'background 80ms ease, color 80ms ease',
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Date helpers — all UTC, ISO yyyy-mm-dd. Kept self-contained so the
// component doesn't drag in date-fns / luxon just for this surface.
// ────────────────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type Cell = {
  iso: string;
  day: number;
  month: number;
};

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function firstOfMonth(iso: string): string {
  const d = parseIso(iso);
  return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

function monthIndex(iso: string): number {
  return parseIso(iso).getUTCMonth();
}

/**
 * Add `delta` months to the first-of-month ISO. The optional `clampToStart`
 * flag returns the *first* of the resulting month — used by the arrow
 * disabled-state check so "any day in prev month ≥ min" is what we test.
 */
function addMonths(iso: string, delta: number, clampToStart = false): string {
  const d = parseIso(iso);
  const next = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, clampToStart ? 1 : 1),
  );
  return toIso(next);
}

function compareIso(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function formatMonth(iso: string): string {
  const d = parseIso(iso);
  return d.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Build a 6-row × 7-col grid for the given month, starting on Monday.
 * Includes trailing / leading days from neighbouring months so the grid
 * is always 42 cells (no layout jump when paging).
 */
function buildMonthGrid(monthIso: string): Cell[] {
  const first = parseIso(monthIso);
  // Monday-first: shift Sunday (0) to 7, then subtract 1 so Mon=0.
  const weekdayOfFirst = ((first.getUTCDay() + 6) % 7);
  const start = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1 - weekdayOfFirst),
  );
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i),
    );
    cells.push({
      iso: toIso(d),
      day: d.getUTCDate(),
      month: d.getUTCMonth(),
    });
  }
  return cells;
}

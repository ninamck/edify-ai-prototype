'use client';

/**
 * DateRangePicker — global home-page date scope.
 *
 * Three preset ranges (`today`, `week`, `last_4_weeks`) plus `custom`,
 * which when picked opens an inline range-builder with two date-picker
 * popovers (one for the start, one for the end). The popovers are the
 * same calendar surface used on /forecast — kept consistent so the
 * platform speaks one date-picking language.
 *
 * State shape: a single discriminated union is exposed to the parent,
 * so the consumer can branch cleanly on `kind`:
 *
 *   type DateRange =
 *     | { kind: 'today' | 'week' | 'last_4_weeks' }
 *     | { kind: 'custom', start: string, end: string };
 *
 * The picker is self-contained: it owns the dropdown open/close state,
 * which date-pill popover is open inside the menu, and the working
 * draft of the custom range while the user is in the menu. The parent
 * only ever sees a fully-resolved DateRange via `onChange`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import DatePickerPopover from '@/components/Forecast/DatePickerPopover';

// ────────────────────────────────────────────────────────────────────────────
// Types & constants
// ────────────────────────────────────────────────────────────────────────────

export type DateRangeKind = 'today' | 'week' | 'last_4_weeks' | 'custom';

export type DateRange =
  | { kind: 'today' }
  | { kind: 'week' }
  | { kind: 'last_4_weeks' }
  | { kind: 'custom'; start: string; end: string };

const PRESETS: { value: 'today' | 'week' | 'last_4_weeks'; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'last_4_weeks', label: 'Last 4 weeks' },
];

// Bounds for the custom date pickers. The prototype keeps a 90-day
// history window and lets you pick up to a fortnight into the future
// (matches the /forecast horizon, so the picker behaves the same way
// on both pages).
const HISTORY_DAYS = 90;
const FUTURE_DAYS = 14;

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export default function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Draft of the custom range while the menu is open. Lives in the
  // picker (not the parent) so the user can fiddle without committing —
  // we commit by calling onChange on every edit, which keeps the
  // pinned-on-top trigger label in sync with the menu.
  const initialCustom = useMemo<{ start: string; end: string }>(() => {
    if (value.kind === 'custom') return { start: value.start, end: value.end };
    // Default to "the last 7 days" — matches the existing 'week' preset
    // semantically so switching to Custom feels like a refinement rather
    // than a reset.
    return { start: isoDayOffset(-6), end: isoDayOffset(0) };
  }, [value]);
  const [customRange, setCustomRange] = useState(initialCustom);

  // Which inline popover (start or end) is open within the menu.
  // `null` means neither — both are anchored to their pill but only one
  // popover is rendered at a time so they don't overlap.
  const [openField, setOpenField] = useState<'start' | 'end' | null>(null);

  // Whenever the parent moves the value back into custom (e.g. after a
  // reload), re-seed the local draft so the menu opens in sync.
  useEffect(() => {
    if (value.kind === 'custom') {
      setCustomRange({ start: value.start, end: value.end });
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
      setOpenField(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setOpenField(null);
      }
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const currentKind: DateRangeKind = value.kind;
  const triggerLabel = useMemo(() => formatTriggerLabel(value), [value]);

  const handlePresetClick = (preset: 'today' | 'week' | 'last_4_weeks') => {
    onChange({ kind: preset });
    setOpenField(null);
    setOpen(false);
  };

  const handleCustomClick = () => {
    // Switching to Custom commits the current draft so the trigger
    // label updates immediately; the menu stays open so the user can
    // tweak the two dates.
    onChange({ kind: 'custom', start: customRange.start, end: customRange.end });
  };

  const handleStartChange = (start: string) => {
    const end =
      compareIso(start, customRange.end) > 0 ? start : customRange.end;
    setCustomRange({ start, end });
    onChange({ kind: 'custom', start, end });
    setOpenField(null);
  };

  const handleEndChange = (end: string) => {
    const start =
      compareIso(end, customRange.start) < 0 ? end : customRange.start;
    setCustomRange({ start, end });
    onChange({ kind: 'custom', start, end });
    setOpenField(null);
  };

  const minDate = isoDayOffset(-HISTORY_DAYS);
  const maxDate = isoDayOffset(FUTURE_DAYS);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        style={triggerStyle}
      >
        <Calendar size={12} strokeWidth={2.2} color="var(--color-text-muted)" />
        <span>{triggerLabel}</span>
        <ChevronDown size={12} strokeWidth={2.2} color="var(--color-text-muted)" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 300,
            minWidth: 220,
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 8,
            boxShadow:
              '0 4px 16px rgba(58,48,40,0.12), 0 0 0 1px rgba(58,48,40,0.04)',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            fontFamily: 'var(--font-primary)',
          }}
        >
          <div style={menuHeaderStyle}>Date range</div>

          {PRESETS.map(opt => (
            <MenuItem
              key={opt.value}
              active={currentKind === opt.value}
              onClick={() => handlePresetClick(opt.value)}
              label={opt.label}
            />
          ))}

          <MenuItem
            active={currentKind === 'custom'}
            onClick={handleCustomClick}
            label={
              currentKind === 'custom'
                ? `Custom · ${formatShortRange(customRange.start, customRange.end)}`
                : 'Custom\u2026'
            }
          />

          {currentKind === 'custom' && (
            <div
              style={{
                marginTop: 4,
                paddingTop: 8,
                paddingLeft: 6,
                paddingRight: 6,
                paddingBottom: 4,
                borderTop: '1px solid var(--color-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <RangeField
                label="From"
                value={customRange.start}
                min={minDate}
                max={customRange.end}
                open={openField === 'start'}
                onToggle={() =>
                  setOpenField(prev => (prev === 'start' ? null : 'start'))
                }
                onPick={handleStartChange}
                onClose={() => setOpenField(null)}
              />
              <RangeField
                label="To"
                value={customRange.end}
                min={customRange.start}
                max={maxDate}
                open={openField === 'end'}
                onToggle={() =>
                  setOpenField(prev => (prev === 'end' ? null : 'end'))
                }
                onPick={handleEndChange}
                onClose={() => setOpenField(null)}
              />
              <div
                style={{
                  fontSize: 10.5,
                  color: 'var(--color-text-muted)',
                  paddingTop: 2,
                  textAlign: 'right',
                }}
              >
                {dayCount(customRange.start, customRange.end)} day
                {dayCount(customRange.start, customRange.end) === 1 ? '' : 's'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-pieces
// ────────────────────────────────────────────────────────────────────────────

function MenuItem({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      style={{
        all: 'unset',
        fontFamily: 'var(--font-primary)',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        color: active ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
        padding: '7px 10px',
        borderRadius: 6,
        cursor: 'pointer',
        background: active ? 'rgba(34,68,68,0.08)' : 'transparent',
      }}
      onMouseEnter={e => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background =
            'var(--color-bg-hover)';
      }}
      onMouseLeave={e => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {label}
    </button>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  open,
  onToggle,
  onPick,
  onClose,
}: {
  label: string;
  value: string;
  min: string;
  max: string;
  open: boolean;
  onToggle: () => void;
  onPick: (date: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          width: 32,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span style={{ position: 'relative', flex: 1, display: 'inline-flex' }}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            border: `1px solid ${
              open ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'
            }`,
            background: open
              ? 'color-mix(in srgb, var(--color-accent-active) 6%, white)'
              : '#ffffff',
            borderRadius: 6,
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <Calendar size={11} color="var(--color-text-muted)" />
          {formatPretty(value)}
        </button>
        {open && (
          <DatePickerPopover
            key={value}
            selectedDate={value}
            min={min}
            max={max}
            onSelect={d => onPick(d)}
            onClose={onClose}
          />
        )}
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styling helpers
// ────────────────────────────────────────────────────────────────────────────

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

const menuHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  padding: '6px 10px 4px',
};

// ────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ────────────────────────────────────────────────────────────────────────────

function compareIso(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function isoDayOffset(offset: number): string {
  const today = new Date();
  // Strip to UTC midnight so the offset is whole-day; matches how the
  // /forecast page derives `dayOffset` from DEMO_TODAY.
  const utc = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + offset),
  );
  return utc.toISOString().slice(0, 10);
}

function formatPretty(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function formatShortRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  const sameMonth =
    s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth();
  if (sameMonth) {
    const day = (d: Date) => d.getUTCDate();
    const monthYear = e.toLocaleDateString('en-GB', {
      month: 'short',
      timeZone: 'UTC',
    });
    return `${day(s)}–${day(e)} ${monthYear}`;
  }
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${fmt(s)} – ${fmt(e)}`;
}

function formatTriggerLabel(value: DateRange): string {
  switch (value.kind) {
    case 'today':
      return 'Today';
    case 'week':
      return 'This week';
    case 'last_4_weeks':
      return 'Last 4 weeks';
    case 'custom':
      return formatShortRange(value.start, value.end);
  }
}

function dayCount(start: string, end: string): number {
  const ms = 24 * 60 * 60 * 1000;
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((e - s) / ms) + 1);
}

'use client';

import { useMemo } from 'react';
import { usePlan } from './PlanStore';
import {
  DEMO_TODAY,
  dayOfWeek,
  dayOffset,
  type SiteId,
} from './fixtures';

type Props = {
  siteId: SiteId;
  selectedDate: string;
  onSelect: (date: string) => void;
  /** Days to surface relative to today. Default D-2..D+2. */
  range?: number[];
};

/**
 * Compact 5-day strip used by the Plan page. Each card is a clickable
 * tile showing day-of-week, date, and a tiny "units" KPI rolled up live
 * from the current PlanStore overrides for that day.
 *
 * Cards stay visually small so the strip can sit above the editor body
 * without dominating it.
 */
export default function DaySelectorStrip({
  siteId,
  selectedDate,
  onSelect,
  range = [-2, -1, 0, 1, 2],
}: Props) {
  const dates = useMemo(() => range.map(d => dayOffset(d)), [range]);

  return (
    <div
      role="tablist"
      aria-label="Select day"
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'stretch',
        padding: '12px 16px',
        background: '#ffffff',
        borderBottom: '1px solid var(--color-border-subtle)',
        overflowX: 'auto',
      }}
    >
      {dates.map(date => (
        <DayCard
          key={date}
          siteId={siteId}
          date={date}
          selected={date === selectedDate}
          onSelect={() => onSelect(date)}
        />
      ))}
    </div>
  );
}

function DayCard({
  siteId,
  date,
  selected,
  onSelect,
}: {
  siteId: SiteId;
  date: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const lines = usePlan(siteId, date);
  const totalUnits = useMemo(
    () => lines.reduce((sum, l) => sum + l.effectivePlanned, 0),
    [lines],
  );
  const isToday = date === DEMO_TODAY;
  const isPast = date < DEMO_TODAY;
  const dow = dayOfWeek(date);
  const dayNum = date.slice(8, 10);

  // Highlight order: selected wins; today gets a soft accent if not selected;
  // past days are dimmed; future days are neutral.
  const borderColor = selected
    ? 'var(--color-accent-active)'
    : isToday
      ? 'var(--color-border)'
      : 'var(--color-border-subtle)';
  const background = selected ? 'var(--color-accent-active)' : '#ffffff';
  const labelColor = selected
    ? '#ffffff'
    : isPast
      ? 'var(--color-text-muted)'
      : 'var(--color-text-secondary)';
  const dayColor = selected ? '#ffffff' : 'var(--color-text-primary)';

  return (
    <button
      role="tab"
      aria-selected={selected}
      type="button"
      onClick={onSelect}
      style={{
        flex: '0 0 auto',
        minWidth: 96,
        padding: '10px 12px',
        borderRadius: 10,
        border: `1px solid ${borderColor}`,
        background,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        fontFamily: 'var(--font-primary)',
        textAlign: 'left',
        opacity: isPast && !selected ? 0.85 : 1,
        transition: 'background 0.15s, border-color 0.15s',
      }}
      title={`${dow} ${date}${isToday ? ' (today)' : ''} · ${totalUnits} units planned`}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: labelColor,
        }}
      >
        {isToday ? 'Today' : dow}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: dayColor,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {dayNum}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: selected ? 'rgba(255,255,255,0.85)' : 'var(--color-text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {totalUnits.toLocaleString()} units
      </span>
    </button>
  );
}

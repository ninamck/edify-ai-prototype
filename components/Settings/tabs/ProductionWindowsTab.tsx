'use client';

/**
 * ProductionWindowsTab — per-day-of-week P1/P2/VP schedule and matching
 * sales-forecast windows.
 *
 * Day pills act like radio buttons; only the active day expands so the
 * page doesn't drown the user in 7 × 6 = 42 time pickers (principle 5).
 * Quick-apply pills above the day grid let the manager copy a single
 * day's settings to all weekdays / the weekend / from Monday — that's
 * the "fewer clicks" answer to a job that's otherwise a 42-input slog
 * (principle 1).
 */

import { useMemo, useState } from 'react';
import StatusPill from '@/components/Production/StatusPill';
import {
  DAYS_OF_WEEK,
  type DayOfWeek,
} from '@/components/Production/fixtures';
import {
  useSiteSettings,
  type WindowsForDay,
  type TimeRange,
} from '../siteSettingsStore';
import {
  HealthAlertStrip,
  Section,
  TimeInput,
  type TabProps,
} from './_shared';

const WEEKDAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const WEEKEND: DayOfWeek[] = ['Sat', 'Sun'];

const DEFAULT_WINDOWS: WindowsForDay = {
  p1: { start: '05:30', end: '08:00' },
  p2: { start: '08:00', end: '11:00' },
  vp: { start: '11:30', end: '13:00' },
  p1Forecast: { start: '06:00', end: '12:00' },
  p2Forecast: { start: '12:00', end: '14:00' },
  vpForecast: { start: '14:00', end: '16:00' },
};

const SLOTS: Array<{
  id: keyof WindowsForDay;
  label: string;
  group: 'schedule' | 'forecast';
}> = [
  { id: 'p1', label: 'P1 schedule', group: 'schedule' },
  { id: 'p2', label: 'P2 schedule', group: 'schedule' },
  { id: 'vp', label: 'VP schedule', group: 'schedule' },
  { id: 'p1Forecast', label: 'P1 sales forecast', group: 'forecast' },
  { id: 'p2Forecast', label: 'P2 sales forecast', group: 'forecast' },
  { id: 'vpForecast', label: 'VP sales forecast', group: 'forecast' },
];

export default function ProductionWindowsTab({ siteId, editing, staged, onStage, health }: TabProps) {
  const { effective } = useSiteSettings(siteId);
  const [activeDay, setActiveDay] = useState<DayOfWeek>('Mon');

  // Merge effective + staged: a day becomes "effective" only if either
  // already has values; otherwise we fall back to the visual default
  // (so the editor shows a sensible starting point).
  const stagedWindows = staged.windows ?? {};
  const dayValue = useMemo<WindowsForDay>(() => {
    return {
      ...DEFAULT_WINDOWS,
      ...effective.windows[activeDay],
      ...stagedWindows[activeDay],
    };
  }, [effective.windows, stagedWindows, activeDay]);

  function setSlot(slot: keyof WindowsForDay, value: TimeRange) {
    onStage({
      windows: {
        [activeDay]: {
          [slot]: value,
        },
      },
    });
  }

  function applyToAll(days: DayOfWeek[]) {
    const patch: NonNullable<typeof staged.windows> = {};
    for (const d of days) {
      patch[d] = { ...dayValue };
    }
    onStage({ windows: patch });
  }

  function copyFromMon() {
    const monday: WindowsForDay = {
      ...DEFAULT_WINDOWS,
      ...effective.windows.Mon,
      ...stagedWindows.Mon,
    };
    onStage({ windows: { [activeDay]: { ...monday } } });
  }

  const dayHasOverrides = (d: DayOfWeek) =>
    Object.keys(stagedWindows[d] ?? {}).length > 0 ||
    Object.keys(effective.windows[d] ?? {}).length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1040 }}>
      <HealthAlertStrip items={health} />

      <Section
        title="Day-of-week windows"
        description="Each day has its own schedule. Apply a single day to many to cover the common case in one tap."
      >
        {/* Day picker */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DAYS_OF_WEEK.map(d => {
            const active = d === activeDay;
            const hasOverride = dayHasOverrides(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => setActiveDay(d)}
                style={dayPillStyle(active)}
              >
                {d}
                {hasOverride && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: active ? 'var(--color-text-on-active)' : 'var(--color-info)',
                      marginLeft: 6,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick-apply */}
        {editing && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Apply {activeDay} to
            </span>
            <button type="button" onClick={() => applyToAll(WEEKDAYS)} style={quickPillStyle()}>
              All weekdays
            </button>
            <button type="button" onClick={() => applyToAll(WEEKEND)} style={quickPillStyle()}>
              Weekend
            </button>
            <button type="button" onClick={() => applyToAll(DAYS_OF_WEEK)} style={quickPillStyle()}>
              Every day
            </button>
            {activeDay !== 'Mon' && (
              <button type="button" onClick={copyFromMon} style={quickPillStyle('info')}>
                Copy from Monday
              </button>
            )}
          </div>
        )}

        {/* Day editor */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-hover)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <StatusPill tone="brand" label={`Editing ${activeDay}`} size="sm" />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              Production windows feed Quinn's hourly bake plan; forecast windows feed sales vs forecast.
            </span>
          </div>

          <SlotGrid
            title="Production schedule"
            slots={SLOTS.filter(s => s.group === 'schedule')}
            day={dayValue}
            editing={editing}
            onChange={setSlot}
          />
          <SlotGrid
            title="Sales forecast windows"
            slots={SLOTS.filter(s => s.group === 'forecast')}
            day={dayValue}
            editing={editing}
            onChange={setSlot}
          />
        </div>
      </Section>
    </div>
  );
}

function SlotGrid({
  title,
  slots,
  day,
  editing,
  onChange,
}: {
  title: string;
  slots: typeof SLOTS;
  day: WindowsForDay;
  editing: boolean;
  onChange: (slot: keyof WindowsForDay, value: TimeRange) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {title}
      </span>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 10,
        }}
      >
        {slots.map(s => {
          const value = (day[s.id] as TimeRange | undefined) ?? { start: '', end: '' };
          const invalid =
            value.start && value.end && value.end <= value.start
              ? `End ${value.end} must be after start ${value.start}`
              : null;
          return (
            <div
              key={s.id}
              style={{
                padding: '10px 12px',
                background: '#ffffff',
                border: `1px solid ${invalid ? 'var(--color-error-border)' : 'var(--color-border-subtle)'}`,
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {s.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TimeInput
                  value={value.start}
                  disabled={!editing}
                  onChange={v => onChange(s.id, { start: v, end: value.end })}
                />
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>to</span>
                <TimeInput
                  value={value.end}
                  disabled={!editing}
                  onChange={v => onChange(s.id, { start: value.start, end: v })}
                />
              </div>
              {invalid && (
                <span
                  style={{
                    fontSize: 10.5,
                    color: 'var(--color-error)',
                    fontWeight: 700,
                  }}
                >
                  {invalid}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function dayPillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: active ? 'var(--color-accent-active)' : '#ffffff',
    color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
    border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
    cursor: 'pointer',
    minHeight: 36,
    display: 'inline-flex',
    alignItems: 'center',
  };
}

function quickPillStyle(tone: 'neutral' | 'info' = 'neutral'): React.CSSProperties {
  return {
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 10.5,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: tone === 'info' ? 'var(--color-info-light)' : '#ffffff',
    color: tone === 'info' ? 'var(--color-info)' : 'var(--color-text-secondary)',
    border: `1px solid ${tone === 'info' ? 'var(--color-info)' : 'var(--color-border)'}`,
    cursor: 'pointer',
  };
}

'use client';

/**
 * MakeOnDaysTab — Farmer J's production windows.
 *
 * Farmer J does not run P1/P2/VP. Its week is which shelf-life groups get
 * made on which day, plus the Thursday deep clean. Those live in the same
 * `windows` slot of the site settings store as Pret's time windows, so this
 * tab is the Farmer J face of "Production windows": the company default
 * (Jana, on Setup) shows faded, the shop's own days show solid, and a group
 * can be put back on the company default in one click.
 *
 * `MakeOnGrid` is shared with the Setup screen, which edits the company row
 * and any shop's row from one place.
 */

import type { CSSProperties } from 'react';
import { CheckCircle2, Lock } from 'lucide-react';
import type { DayOfWeek } from '@/components/Production/fixtures';
import { FJ_DAYS_OF_WEEK, weekdayToDay } from '@/components/Production/farmerj/fjFixtures';
import { GROUP_IDS, scheduleFromWindows, type MakeOnSchedule } from '@/components/Production/farmerj/makeOn';
import { SHELF_LIFE_GROUPS, WEEKDAY_LABELS, type ShelfLifeGroupId, type Weekday } from '@/components/Production/farmerj/recipes';
import { FJ_ALL_SHOPS_ID } from '@/components/Production/farmerj/shops';
import { useSiteSettings, useSiteSettingsStore, type WindowsForDay, type WindowsOverlay } from '../siteSettingsStore';
import { HealthAlertStrip, Section, type TabProps } from './_shared';

const GROUPS = GROUP_IDS.map(g => SHELF_LIFE_GROUPS[g]);

export default function MakeOnDaysTab({ siteId, editing, staged, onStage, health }: TabProps) {
  const store = useSiteSettingsStore();
  const { effective, overlay } = useSiteSettings(siteId);
  const isCompany = siteId === FJ_ALL_SHOPS_ID;
  const company = scheduleFromWindows(store.effectiveFor(FJ_ALL_SHOPS_ID).windows);

  // What the shop runs on if the staged edits were saved now.
  const stagedWindows = staged.windows ?? {};
  const merged = Object.fromEntries(
    FJ_DAYS_OF_WEEK.map(d => {
      const eff = effective.windows[d] ?? {};
      const st = stagedWindows[d] ?? {};
      return [d, { ...eff, ...st, makeOn: { ...(eff.makeOn ?? {}), ...(st.makeOn ?? {}) } }];
    }),
  ) as Record<DayOfWeek, WindowsForDay>;
  const schedule = scheduleFromWindows(merged);

  /** The shop's own `makeOn` for a day, staged edits first, then what is saved. */
  const ownMakeOn = (d: DayOfWeek): Record<string, boolean> =>
    ({ ...(overlay?.windows?.[d]?.makeOn ?? {}), ...(stagedWindows[d]?.makeOn ?? {}) });

  const toggle = (g: ShelfLifeGroupId, w: Weekday) => {
    const d = weekdayToDay(w);
    const on = schedule.days[g].includes(w);
    onStage({ windows: { [d]: { makeOn: { ...ownMakeOn(d), [g]: !on } } } });
  };

  const reset = (g: ShelfLifeGroupId) => {
    const patch: WindowsOverlay = {};
    for (const d of FJ_DAYS_OF_WEEK) {
      const own = ownMakeOn(d);
      if (!(g in own)) continue;
      const next = { ...own };
      delete next[g];
      patch[d] = { makeOn: next };
    }
    if (Object.keys(patch).length) onStage({ windows: patch });
  };

  const inherited = Object.fromEntries(
    GROUPS.map(g => [g.id, sameDays(schedule.days[g.id], company.days[g.id])]),
  ) as Record<ShelfLifeGroupId, boolean>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1040 }}>
      <HealthAlertStrip items={health} />
      <Section
        title="Make-on days"
        description={
          isCompany
            ? 'The days every shop makes each shelf-life group, unless the shop sets its own.'
            : 'Faded rows follow the company default set on Setup. Tap a day to give this shop its own; Use default puts it back.'
        }
      >
        <MakeOnGrid
          schedule={schedule}
          inherited={isCompany ? undefined : inherited}
          deepClean={company.deepClean}
          disabled={!editing}
          onToggle={toggle}
          onReset={isCompany ? undefined : reset}
        />
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lock size={11} aria-hidden />
          {company.deepClean.length
            ? `${company.deepClean.map(w => LONG_DAYS[w]).join(', ')} is the deep clean: nothing made ahead. Set on Setup for every shop.`
            : 'No deep clean day set. Set one on Setup for every shop.'}
        </div>
      </Section>
    </div>
  );
}

const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function sameDays(a: Weekday[], b: Weekday[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Group × weekday grid. `inherited[g]` fades a row that follows the level above. */
export function MakeOnGrid({
  schedule,
  inherited,
  deepClean,
  disabled,
  onToggle,
  onReset,
}: {
  schedule: MakeOnSchedule;
  inherited?: Record<ShelfLifeGroupId, boolean>;
  /** Weekdays locked for anything but daily groups. */
  deepClean: Weekday[];
  disabled?: boolean;
  onToggle: (g: ShelfLifeGroupId, w: Weekday) => void;
  onReset?: (g: ShelfLifeGroupId) => void;
}) {
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={th}>Group</th>
          {WEEKDAY_LABELS.map((w, i) => (
            <th key={w} style={{ ...th, textAlign: 'center', width: 64 }}>
              {w}{deepClean.includes(i as Weekday) && <Lock size={10} style={{ marginLeft: 4, verticalAlign: -1 }} aria-label="Deep clean" />}
            </th>
          ))}
          <th style={th}>Covers</th>
          {onReset && <th style={th} />}
        </tr>
      </thead>
      <tbody>
        {GROUPS.map(g => {
          const faded = inherited?.[g.id];
          return (
            <tr key={g.id}>
              <td style={td}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: g.colour, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{g.label}</span>
                </span>
              </td>
              {WEEKDAY_LABELS.map((w, i) => {
                const day = i as Weekday;
                const on = schedule.days[g.id].includes(day);
                const deep = deepClean.includes(day) && g.id !== 'daily';
                const locked = disabled || deep;
                return (
                  <td key={w} style={{ ...td, textAlign: 'center' }}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-label={`${g.label} ${w}`}
                      title={deep && on ? 'Deep clean day: not made, whatever the setting says' : undefined}
                      disabled={locked}
                      onClick={() => onToggle(g.id, day)}
                      style={{
                        width: 30, height: 30, borderRadius: 8, cursor: locked ? 'not-allowed' : 'pointer',
                        border: `1px solid ${on && !deep ? g.colour : 'var(--color-border)'}`,
                        background: on && !deep ? g.colour : deep ? 'var(--color-bg-hover)' : '#fff',
                        opacity: faded ? 0.55 : 1,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {on && !deep && <CheckCircle2 size={14} color="#fff" />}
                      {on && deep && <Lock size={12} color="var(--color-text-muted)" />}
                    </button>
                  </td>
                );
              })}
              <td style={td}>{g.days === 1 ? 'Same day' : `${g.days} days`}</td>
              {onReset && (
                <td style={{ ...td, textAlign: 'right' }}>
                  {!faded && !disabled && <button type="button" onClick={() => onReset(g.id)} style={linkBtn}>Use default</button>}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Weekday pills for the deep clean day. Company-level; one or none. */
export function DeepCleanPicker({ value, onChange, disabled }: { value: Weekday[]; onChange: (next: Weekday[]) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Deep clean day" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {WEEKDAY_LABELS.map((w, i) => {
        const day = i as Weekday;
        const on = value.includes(day);
        return (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(on ? [] : [day])}
            style={{
              padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)',
              border: `1px solid ${on ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
              background: on ? 'var(--color-accent-active)' : '#fff',
              color: on ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {w}
          </button>
        );
      })}
    </div>
  );
}

const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-primary)' };
const th: CSSProperties = { textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', padding: '6px 8px', borderBottom: '1px solid var(--color-border-subtle)' };
const td: CSSProperties = { padding: '8px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)', verticalAlign: 'middle' };
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-info)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-primary)', padding: 0 };

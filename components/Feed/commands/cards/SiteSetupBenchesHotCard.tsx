'use client';

/**
 * Site setup · step 7 — hot production.
 *
 * Mirrors the Hot production tab on the Production settings page:
 * production stations (hot-food recipes made together on a timed
 * batch cycle), full-selection times (at a set time, top up the
 * forecast with a fixed extra quantity of the chosen recipes), the
 * default planner window, Product Control Review, and the carry-over
 * setting. All copied from the chosen shop. Benches live on the
 * production step — they belong to the production runs.
 *
 * Times differ by day of week (Wojciech, Pret: one setting for the
 * whole week is wrong for weekends). The same multi-select day strip
 * as the production step sits at the top of each shop: pick days, and
 * the planner window, full-selection times and each station's batch
 * cycle below are read from and written to those days. Stations,
 * their recipes and min / max / multiple stay week-wide, as do the
 * two review switches.
 *
 * Each station carries the Edit-station settings from Edify main:
 * name, batch cycle, assigned recipes, and min / max / multiple
 * (0 = none). Recipes sit behind an "N recipes" disclosure — remove
 * with ×, add from a search over the hot recipe pool.
 *
 * Full-selection rows follow the real table: time, an "N recipes"
 * dropdown checklist, extra quantity to add, with add and delete.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Flame, Plus, Trash2, X } from 'lucide-react';
import CardShell from './CardShell';
import type { CardState } from './CardShell';
import { RangePill, Stepper, WindowEditor, labelStyle, timeInputStyle } from './timeControls';
import {
  ALL_HOT_RECIPES,
  DAY_KEYS,
  WEEKDAY_KEYS,
  WEEKEND_KEYS,
  defaultBenchesHot,
  getTemplateShop,
  getNewSite,
} from '../siteSetupFixtures';
import type { BenchesHotSetup, DayKey, FullSelectionRow, HotDaySettings, HotStation, SiteBenchesHot } from '../siteSetupFixtures';

interface SiteSetupBenchesHotCardProps {
  state: CardState;
  siteIds: string[];
  templates: Record<string, string>;
  initialBenchesHot?: SiteBenchesHot;
  onSubmit: (input: { benchesHot: SiteBenchesHot }) => void;
  onCancel: () => void;
  /** Reopen for edits after confirm — available until final go-live. */
  onEdit?: () => void;
}

function RecipeChip({ name, disabled, onRemove }: { name: string; disabled: boolean; onRemove: () => void }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 8px',
        borderRadius: '999px',
        background: 'var(--color-brand, #001c35)',
        color: '#fff',
        fontSize: '11px',
        fontWeight: 600,
      }}
    >
      {name}
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          style={{
            border: 'none',
            background: 'none',
            color: 'rgba(255,255,255,0.75)',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
          }}
        >
          <X size={11} strokeWidth={2.6} />
        </button>
      )}
    </span>
  );
}

function GroupBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '3px 9px',
        borderRadius: '999px',
        border: active
          ? '1.5px solid var(--color-brand, #001c35)'
          : '1.5px dashed var(--color-border, rgba(0,28,53,0.22))',
        background: '#fff',
        fontSize: '10.5px',
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        color: active ? 'var(--color-brand, #001c35)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

const disclosureBtnStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
  border: 'none',
  background: 'none',
  fontSize: '11.5px',
  fontWeight: 700,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-brand, #001c35)',
  cursor: disabled ? 'default' : 'pointer',
  padding: '2px 0',
});

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '8px 10px',
  borderRadius: '10px',
  border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
  background: '#fff',
};

export default function SiteSetupBenchesHotCard({
  state,
  siteIds,
  templates,
  initialBenchesHot,
  onSubmit,
  onCancel,
  onEdit,
}: SiteSetupBenchesHotCardProps) {
  const [benchesHot, setBenchesHot] = useState<SiteBenchesHot>(() => {
    const map: SiteBenchesHot = {};
    for (const id of siteIds) {
      map[id] = initialBenchesHot?.[id] ?? defaultBenchesHot(templates[id]);
    }
    return map;
  });

  /** Expanded station settings, keyed `${siteId}:${stationIdx}`. */
  const [openStations, setOpenStations] = useState<Record<string, boolean>>({});
  /** Add-recipe search text per open station. */
  const [addQuery, setAddQuery] = useState<Record<string, string>>({});
  /** Open full-selection recipe checklist, keyed `${siteId}:${rowIdx}`. */
  const [openFstRow, setOpenFstRow] = useState<string | null>(null);
  /** Open planner-window editor, keyed by siteId. */
  const [openPlanner, setOpenPlanner] = useState<string | null>(null);
  /** Which day pills are lit per site. Day-level edits apply to all of
   *  them. Weekdays first: that's where most of the settings live. */
  const [selectedDays, setSelectedDays] = useState<Record<string, DayKey[]>>(() =>
    Object.fromEntries(siteIds.map((id) => [id, [...WEEKDAY_KEYS]])),
  );

  const disabled = state !== 'pending';

  const daysFor = (siteId: string): DayKey[] => selectedDays[siteId] ?? [...WEEKDAY_KEYS];

  const toggleDay = (siteId: string, day: DayKey) => {
    setSelectedDays((prev) => {
      const current = prev[siteId] ?? [...WEEKDAY_KEYS];
      const next = current.includes(day)
        ? current.filter((d) => d !== day)
        : DAY_KEYS.filter((d) => current.includes(d) || d === day);
      if (next.length === 0) return prev; // keep at least one day lit
      return { ...prev, [siteId]: next };
    });
    setOpenPlanner(null);
    setOpenFstRow(null);
  };
  const selectGroup = (siteId: string, group: DayKey[]) => {
    setSelectedDays((prev) => ({ ...prev, [siteId]: [...group] }));
    setOpenPlanner(null);
    setOpenFstRow(null);
  };

  const patchSite = (siteId: string, patch: (s: BenchesHotSetup) => BenchesHotSetup) => {
    setBenchesHot((prev) => ({ ...prev, [siteId]: patch(prev[siteId]) }));
  };

  const patchStation = (siteId: string, stationIdx: number, patch: (st: HotStation) => HotStation) => {
    patchSite(siteId, (s) => ({
      ...s,
      stations: s.stations.map((st, i) => (i === stationIdx ? patch(st) : st)),
    }));
  };

  /** Set a station's batch cycle on every selected day. */
  const setStationSlot = (siteId: string, stationIdx: number, mins: number) => {
    const days = daysFor(siteId);
    patchStation(siteId, stationIdx, (st) => {
      const slotMins = { ...st.slotMins };
      for (const d of days) slotMins[d] = mins;
      return { ...st, slotMins };
    });
  };

  /** Apply a day-settings patch to every selected day of a site. */
  const patchDays = (siteId: string, patch: (d: HotDaySettings) => HotDaySettings) => {
    const days = daysFor(siteId);
    patchSite(siteId, (s) => {
      const byDay = { ...s.byDay };
      for (const d of days) byDay[d] = patch(byDay[d]);
      return { ...s, byDay };
    });
  };

  const patchFstRow = (siteId: string, rowIdx: number, patch: (row: FullSelectionRow) => FullSelectionRow) => {
    patchDays(siteId, (d) => ({
      ...d,
      fullSelectionTimes: d.fullSelectionTimes.map((r, i) => (i === rowIdx ? patch(r) : r)),
    }));
  };

  /** Read a value across the selected days: the first day's value,
   *  plus whether the days disagree. */
  const readDays = <T,>(siteId: string, get: (d: HotDaySettings) => T, same: (a: T, b: T) => boolean) => {
    const days = daysFor(siteId);
    const first = get(benchesHot[siteId].byDay[days[0]]);
    const mixed = days.some((d) => !same(get(benchesHot[siteId].byDay[d]), first));
    return { value: first, mixed };
  };

  /** Copy the first selected day's settings onto the other selected
   *  days, so the operator can edit them as one. */
  const unifyDays = (siteId: string) => {
    const days = daysFor(siteId);
    patchSite(siteId, (s) => {
      const src = s.byDay[days[0]];
      const byDay = { ...s.byDay };
      for (const d of days) {
        byDay[d] = {
          plannerWindow: { ...src.plannerWindow },
          fullSelectionTimes: src.fullSelectionTimes.map((r) => ({ ...r, recipes: [...r.recipes] })),
        };
      }
      return { ...s, byDay };
    });
  };

  return (
    <CardShell
      icon={Flame}
      title="Hot production"
      subtitle="Copied with each shop. Times can differ by day: pick days, then set the planner window, batch cycles and full-selection times"
      state={state}
      confirmLabel="Continue"
      onCancel={onCancel}
      onEdit={onEdit}
      onConfirm={() => onSubmit({ benchesHot })}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {siteIds.map((siteId) => {
          const site = getNewSite(siteId);
          if (!site) return null;
          const template = getTemplateShop(templates[siteId]);
          const setup = benchesHot[siteId];
          if (!setup) return null;
          const plannerOpen = openPlanner === siteId;
          const days = daysFor(siteId);
          const planner = readDays(siteId, (d) => d.plannerWindow, (a, b) => a.start === b.start && a.end === b.end);
          const fst = readDays(
            siteId,
            (d) => d.fullSelectionTimes,
            (a, b) => JSON.stringify(a) === JSON.stringify(b),
          );
          const isWeekend = days.every((d) => WEEKEND_KEYS.includes(d));
          const isWeekdays = days.length === WEEKDAY_KEYS.length && WEEKDAY_KEYS.every((d) => days.includes(d));
          const isAll = days.length === DAY_KEYS.length;
          return (
            <div
              key={siteId}
              style={{
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.10))',
                background: 'rgba(0,28,53,0.015)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {site.shortName}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                  Copied from {template?.name ?? 'the template'} · weekends from its weekend settings
                </span>
              </div>

              {/* Multi-select day pills + quick groups */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {DAY_KEYS.map((day) => {
                    const selected = days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleDay(siteId, day)}
                        aria-pressed={selected}
                        style={{
                          padding: '3px 9px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          fontFamily: 'var(--font-primary)',
                          cursor: disabled ? 'default' : 'pointer',
                          border: selected
                            ? '1.5px solid var(--color-brand, #001c35)'
                            : '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                          background: selected ? 'var(--color-brand, #001c35)' : '#fff',
                          color: selected ? '#fff' : 'var(--color-text-secondary)',
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                {!disabled && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <GroupBtn label="Mon–Fri" active={isWeekdays} onClick={() => selectGroup(siteId, WEEKDAY_KEYS)} />
                    <GroupBtn label="Sat–Sun" active={isWeekend && days.length === 2} onClick={() => selectGroup(siteId, WEEKEND_KEYS)} />
                    <GroupBtn label="All week" active={isAll} onClick={() => selectGroup(siteId, DAY_KEYS)} />
                  </div>
                )}
              </div>

              {/* Production stations */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {setup.stations.map((st, stationIdx) => {
                  const stationKey = `${siteId}:${stationIdx}`;
                  const isOpen = !!openStations[stationKey];
                  const query = addQuery[stationKey] ?? '';
                  const matches = query.trim()
                    ? ALL_HOT_RECIPES.filter(
                        (r) => r.toLowerCase().includes(query.trim().toLowerCase()) && !st.recipes.includes(r),
                      ).slice(0, 5)
                    : [];
                  return (
                    <div key={stationIdx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ width: '86px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          <Flame size={12} strokeWidth={2.2} style={{ color: 'var(--color-text-muted)' }} />
                          {st.name}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {(() => {
                            const first = st.slotMins[days[0]];
                            const mixed = days.some((d) => st.slotMins[d] !== first);
                            return mixed ? 'Mixed batch cycles' : `${first} min batches`;
                          })()}
                          {' · '}{st.recipes.length} recipes
                          {st.min > 0 || st.max > 0 ? ` · min ${st.min} · max ${st.max}` : ''}
                          {st.multiple > 0 ? ` · ×${st.multiple}` : ''}
                        </span>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => setOpenStations((prev) => ({ ...prev, [stationKey]: !prev[stationKey] }))}
                          style={disclosureBtnStyle(disabled)}
                        >
                          {isOpen ? 'Close' : 'Edit'}
                          {isOpen ? <ChevronUp size={13} strokeWidth={2.2} /> : <ChevronDown size={13} strokeWidth={2.2} />}
                        </button>
                      </div>

                      {isOpen && (
                        <div style={panelStyle}>
                          {/* Name + batch cycle, as on the Edit station modal */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <span style={labelStyle}>Name</span>
                              <input
                                type="text"
                                disabled={disabled}
                                value={st.name}
                                onChange={(e) => patchStation(siteId, stationIdx, (x) => ({ ...x, name: e.target.value }))}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '8px',
                                  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  fontFamily: 'var(--font-primary)',
                                  color: 'var(--color-text-primary)',
                                  background: '#fff',
                                  width: '120px',
                                }}
                              />
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <span style={labelStyle}>Batch cycle {days.length === 7 ? 'all week' : days.join(' ')}</span>
                              <select
                                disabled={disabled}
                                value={days.every((d) => st.slotMins[d] === st.slotMins[days[0]]) ? st.slotMins[days[0]] : ''}
                                onChange={(e) => {
                                  if (e.target.value) setStationSlot(siteId, stationIdx, Number(e.target.value));
                                }}
                                style={{
                                  padding: '3px 6px',
                                  borderRadius: '8px',
                                  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  fontFamily: 'var(--font-primary)',
                                  color: 'var(--color-text-primary)',
                                  background: '#fff',
                                }}
                              >
                                {!days.every((d) => st.slotMins[d] === st.slotMins[days[0]]) && (
                                  <option value="">Mixed</option>
                                )}
                                {[30, 45, 60, 90].map((mins) => (
                                  <option key={mins} value={mins}>
                                    {mins} min
                                  </option>
                                ))}
                              </select>
                            </span>
                          </div>

                          {/* Assigned recipes */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {st.recipes.map((r) => (
                              <RecipeChip
                                key={r}
                                name={r}
                                disabled={disabled}
                                onRemove={() =>
                                  patchStation(siteId, stationIdx, (x) => ({
                                    ...x,
                                    recipes: x.recipes.filter((y) => y !== r),
                                  }))
                                }
                              />
                            ))}
                          </div>
                          {!disabled && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              <input
                                type="text"
                                placeholder="Add a recipe…"
                                value={query}
                                onChange={(e) => setAddQuery((prev) => ({ ...prev, [stationKey]: e.target.value }))}
                                style={{
                                  padding: '5px 9px',
                                  borderRadius: '8px',
                                  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                                  fontSize: '11.5px',
                                  fontFamily: 'var(--font-primary)',
                                  color: 'var(--color-text-primary)',
                                  background: '#fff',
                                  maxWidth: '220px',
                                }}
                              />
                              {matches.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                  {matches.map((r) => (
                                    <button
                                      key={r}
                                      type="button"
                                      onClick={() => {
                                        patchStation(siteId, stationIdx, (x) => ({ ...x, recipes: [...x.recipes, r] }));
                                        setAddQuery((prev) => ({ ...prev, [stationKey]: '' }));
                                      }}
                                      style={{
                                        padding: '3px 8px',
                                        borderRadius: '999px',
                                        border: '1.5px dashed var(--color-border, rgba(0,28,53,0.22))',
                                        background: '#fff',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        fontFamily: 'var(--font-primary)',
                                        color: 'var(--color-text-secondary)',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      + {r}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Min / max / multiple, 0 = none */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <span style={labelStyle}>Min</span>
                              <Stepper
                                value={st.min}
                                min={0}
                                disabled={disabled}
                                onChange={(next) => patchStation(siteId, stationIdx, (x) => ({ ...x, min: next }))}
                              />
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <span style={labelStyle}>Max</span>
                              <Stepper
                                value={st.max}
                                min={0}
                                disabled={disabled}
                                onChange={(next) => patchStation(siteId, stationIdx, (x) => ({ ...x, max: next }))}
                              />
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <span style={labelStyle}>Multiple</span>
                              <Stepper
                                value={st.multiple}
                                min={0}
                                disabled={disabled}
                                onChange={(next) => patchStation(siteId, stationIdx, (x) => ({ ...x, multiple: next }))}
                              />
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>0 = none</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Full-selection times: time · N recipes ▾ · extra quantity */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.07))',
                }}
              >
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Full-selection times {days.length === 7 ? 'all week' : days.join(' ')} · top up the forecast with a fixed extra quantity at a set time
                </span>
                {fst.mixed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '11px', color: '#7A3800' }}>
                    The selected days have different full-selection times. Pick one day to edit it, or
                    {!disabled && (
                      <button type="button" onClick={() => unifyDays(siteId)} style={disclosureBtnStyle(disabled)}>
                        use {days[0]}&rsquo;s settings for all {days.length}
                      </button>
                    )}
                  </div>
                )}
                {!fst.mixed && fst.value.length === 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    None on {days.length === 7 ? 'any day' : days.join(', ')}. The forecast runs on its own.
                  </span>
                )}
                {!fst.mixed && fst.value.map((row, rowIdx) => {
                  const fstKey = `${siteId}:${rowIdx}`;
                  const listOpen = openFstRow === fstKey;
                  return (
                    <div key={rowIdx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <input
                          type="time"
                          disabled={disabled}
                          value={row.time}
                          onChange={(e) => patchFstRow(siteId, rowIdx, (x) => ({ ...x, time: e.target.value }))}
                          style={timeInputStyle(disabled)}
                        />
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => setOpenFstRow(listOpen ? null : fstKey)}
                          style={disclosureBtnStyle(disabled)}
                        >
                          {row.recipes.length} recipe{row.recipes.length === 1 ? '' : 's'}
                          {listOpen ? <ChevronUp size={13} strokeWidth={2.2} /> : <ChevronDown size={13} strokeWidth={2.2} />}
                        </button>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <span style={labelStyle}>Extra qty</span>
                          <Stepper
                            value={row.qty}
                            min={1}
                            disabled={disabled}
                            onChange={(next) => patchFstRow(siteId, rowIdx, (x) => ({ ...x, qty: next }))}
                          />
                        </span>
                        {!disabled && (
                          <button
                            type="button"
                            aria-label="Remove full-selection time"
                            onClick={() =>
                              patchDays(siteId, (d) => ({
                                ...d,
                                fullSelectionTimes: d.fullSelectionTimes.filter((_, i) => i !== rowIdx),
                              }))
                            }
                            style={{
                              border: 'none',
                              background: 'none',
                              color: 'var(--color-text-muted)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'inline-flex',
                            }}
                          >
                            <Trash2 size={13} strokeWidth={2} />
                          </button>
                        )}
                      </div>

                      {/* Recipe checklist, as on the real table's products dropdown */}
                      {listOpen && (
                        <div style={{ ...panelStyle, maxHeight: '180px', overflowY: 'auto' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
                            {ALL_HOT_RECIPES.map((r) => (
                              <label
                                key={r}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '11px',
                                  color: 'var(--color-text-secondary)',
                                  cursor: disabled ? 'default' : 'pointer',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  disabled={disabled}
                                  checked={row.recipes.includes(r)}
                                  onChange={(e) =>
                                    patchFstRow(siteId, rowIdx, (x) => ({
                                      ...x,
                                      recipes: e.target.checked
                                        ? [...x.recipes, r]
                                        : x.recipes.filter((y) => y !== r),
                                    }))
                                  }
                                />
                                {r}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!disabled && !fst.mixed && (
                  <button
                    type="button"
                    onClick={() =>
                      patchDays(siteId, (d) => ({
                        ...d,
                        fullSelectionTimes: [...d.fullSelectionTimes, { time: isWeekend ? '07:30' : '06:00', recipes: [], qty: 1 }],
                      }))
                    }
                    style={{ ...disclosureBtnStyle(disabled), alignSelf: 'flex-start' }}
                  >
                    <Plus size={13} strokeWidth={2.2} />
                    Add time {days.length === 7 ? 'all week' : `for ${days.join(', ')}`}
                  </button>
                )}
              </div>

              {/* Planner window + review settings */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.07))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ width: '86px', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Planner
                  </span>
                  <RangePill
                    text={planner.mixed ? 'Mixed' : `${planner.value.start} – ${planner.value.end}`}
                    open={plannerOpen}
                    disabled={disabled}
                    onClick={() => setOpenPlanner(plannerOpen ? null : siteId)}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {days.length === 7 ? 'all week' : days.join(' ')}
                  </span>
                </div>
                {plannerOpen && (
                  <WindowEditor
                    window={planner.value}
                    disabled={disabled}
                    onChange={(edge, value) =>
                      patchDays(siteId, (d) => ({ ...d, plannerWindow: { ...d.plannerWindow, [edge]: value } }))
                    }
                    onDone={() => setOpenPlanner(null)}
                  />
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: 'var(--color-text-secondary)', cursor: disabled ? 'default' : 'pointer' }}>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={setup.productControlReview}
                    onChange={(e) =>
                      patchSite(siteId, (s) => ({ ...s, productControlReview: e.target.checked }))
                    }
                  />
                  Allow PCR on hot production · quality-control finished batches through Product Control Review
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: 'var(--color-text-secondary)', cursor: disabled ? 'default' : 'pointer' }}>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={setup.carryOverBenchAssigned}
                    onChange={(e) =>
                      patchSite(siteId, (s) => ({ ...s, carryOverBenchAssigned: e.target.checked }))
                    }
                  />
                  Include bench-assigned productions in carry-over adjustments
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

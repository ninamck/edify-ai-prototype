'use client';

/**
 * Site setup · step 5 — production.
 *
 * Mirrors the Production settings page in Edify main: each day has
 * production runs, each run has a bench schedule (when the run is
 * made) and a sales-forecast window (the sales period used to predict
 * quantities), with per-category refinements of that window. The
 * copied shop brings all of it; this card lets the operator shift the
 * times to the new shop's hours.
 *
 * Days are multi-select pills: keep Mon–Fri selected to set the week
 * in one go, or pick a single day to give it its own times. Edits
 * apply to every selected day.
 *
 * Category forecasts arrive copied and sit behind a "By category"
 * disclosure per run, in case they want to change them.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import CardShell from './CardShell';
import type { CardState } from './CardShell';
import { RangePill, Stepper, WindowEditor, labelStyle } from './timeControls';
import {
  DAY_KEYS,
  defaultRunSchedules,
  getHub,
  getTemplateShop,
  getWorkdaySite,
} from '../siteSetupFixtures';
import type {
  DayKey,
  ProductionRun,
  SiteProductionSchedules,
  TimeWindow,
  WorkdaySite,
} from '../siteSetupFixtures';

interface SiteSetupProductionCardProps {
  state: CardState;
  siteIds: string[];
  templates: Record<string, string>;
  /** Per site: a hub id, or STANDALONE for no hub. */
  hubs?: Record<string, string>;
  initialProduction?: SiteProductionSchedules;
  initialBenches?: Record<string, number>;
  onSubmit: (input: { production: SiteProductionSchedules; benches: Record<string, number> }) => void;
  onCancel: () => void;
  /** Reopen for edits after confirm — available until final go-live. */
  onEdit?: () => void;
}

const WEEKDAYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function openFor(site: WorkdaySite, day: DayKey): string {
  if (day === 'Sat') return site.open.saturday;
  if (day === 'Sun') return site.open.sunday;
  return site.open.weekday;
}

export default function SiteSetupProductionCard({
  state,
  siteIds,
  templates,
  hubs,
  initialProduction,
  initialBenches,
  onSubmit,
  onCancel,
  onEdit,
}: SiteSetupProductionCardProps) {
  const [production, setProduction] = useState<SiteProductionSchedules>(() => {
    const map: SiteProductionSchedules = {};
    for (const id of siteIds) {
      map[id] = initialProduction?.[id] ?? defaultRunSchedules(templates[id]);
    }
    return map;
  });

  /** Benches the runs are assigned across — per site, from the copy. */
  const [benches, setBenches] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      siteIds.map((id) => [id, initialBenches?.[id] ?? getTemplateShop(templates[id])?.benches ?? 2]),
    ),
  );

  /** Which day pills are lit per site. Edits apply to all of them. */
  const [selectedDays, setSelectedDays] = useState<Record<string, DayKey[]>>(() =>
    Object.fromEntries(siteIds.map((id) => [id, [...WEEKDAYS]])),
  );

  /** One inline editor open at a time, keyed
   *  `${siteId}:${runIdx}:bench|forecast` or `${siteId}:${runIdx}:cat:${name}`. */
  const [openEditor, setOpenEditor] = useState<string | null>(null);
  /** Expanded "By category" disclosures, keyed `${siteId}:${runIdx}`. */
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const disabled = state !== 'pending';

  const daysFor = (siteId: string): DayKey[] => selectedDays[siteId] ?? [...WEEKDAYS];

  const toggleDay = (siteId: string, day: DayKey) => {
    setSelectedDays((prev) => {
      const current = prev[siteId] ?? [...WEEKDAYS];
      const next = current.includes(day)
        ? current.filter((d) => d !== day)
        : DAY_KEYS.filter((d) => current.includes(d) || d === day);
      if (next.length === 0) return prev; // keep at least one day lit
      return { ...prev, [siteId]: next };
    });
    setOpenEditor(null);
  };

  /** Apply a run patch to every selected day of a site. */
  const patchRun = (siteId: string, runIdx: number, patch: (r: ProductionRun) => ProductionRun) => {
    setProduction((prev) => {
      const site = { ...prev[siteId] };
      for (const d of daysFor(siteId)) {
        site[d] = site[d].map((r, i) => (i === runIdx ? patch(r) : r));
      }
      return { ...prev, [siteId]: site };
    });
  };

  /** Read a window across the selected days: first day's value, plus
   *  whether the days disagree. */
  const readWindow = (
    siteId: string,
    runIdx: number,
    get: (r: ProductionRun) => TimeWindow,
  ): { win: TimeWindow; mixed: boolean } => {
    const days = daysFor(siteId);
    const first = get(production[siteId][days[0]][runIdx]);
    const mixed = days.some((d) => {
      const w = get(production[siteId][d][runIdx]);
      return w.start !== first.start || w.end !== first.end;
    });
    return { win: first, mixed };
  };

  return (
    <CardShell
      icon={Clock}
      title="Production"
      subtitle="Copied per day. Pick days together or one at a time, then set the windows"
      state={state}
      confirmLabel="Continue"
      onCancel={onCancel}
      onEdit={onEdit}
      onConfirm={() => onSubmit({ production, benches })}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {siteIds.map((siteId) => {
          const site = getWorkdaySite(siteId);
          if (!site) return null;
          const template = getTemplateShop(templates[siteId]);
          const hubName = getHub(hubs?.[siteId] ?? '')?.name;
          const days = daysFor(siteId);
          const runs = production[siteId]?.[days[0]] ?? [];
          const weekLine = [
            `${runs.length} run${runs.length === 1 ? '' : 's'} a day from ${template?.name ?? 'the copy'}`,
            hubName ? `forecasts set what the shop requests from ${hubName}` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          const openTimes = [...new Set(days.map((d) => openFor(site, d)))];

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
                  {weekLine}
                </span>
              </div>

              {/* Multi-select day pills */}
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
                <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                  Opens {openTimes.join(' / ')}
                </span>
              </div>

              {/* Runs for the selected days */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {runs.map((run, runIdx) => {
                  const bench = readWindow(siteId, runIdx, (r) => r.bench);
                  const forecast = readWindow(siteId, runIdx, (r) => r.forecast);
                  const benchKey = `${siteId}:${runIdx}:bench`;
                  const forecastKey = `${siteId}:${runIdx}:forecast`;
                  const catToggleKey = `${siteId}:${runIdx}`;
                  const catsOpen = !!openCategories[catToggleKey];
                  return (
                    <div
                      key={run.name}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        paddingTop: runIdx === 0 ? 0 : '8px',
                        borderTop: runIdx === 0 ? 'none' : '1px solid var(--color-border-subtle, rgba(0,28,53,0.07))',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        <span style={{ width: '86px', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {run.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={labelStyle}>Bench</span>
                          <RangePill
                            text={bench.mixed ? 'Mixed' : `${bench.win.start} – ${bench.win.end}`}
                            open={openEditor === benchKey}
                            disabled={disabled}
                            onClick={() => setOpenEditor(openEditor === benchKey ? null : benchKey)}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={labelStyle}>Forecast</span>
                          <RangePill
                            text={forecast.mixed ? 'Mixed' : `${forecast.win.start} – ${forecast.win.end}`}
                            open={openEditor === forecastKey}
                            disabled={disabled}
                            onClick={() => setOpenEditor(openEditor === forecastKey ? null : forecastKey)}
                          />
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              setOpenCategories((prev) => ({ ...prev, [catToggleKey]: !prev[catToggleKey] }))
                            }
                            style={{
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
                            }}
                          >
                            By category
                            {catsOpen ? <ChevronUp size={13} strokeWidth={2.2} /> : <ChevronDown size={13} strokeWidth={2.2} />}
                          </button>
                        </div>
                      </div>

                      {openEditor === benchKey && (
                        <WindowEditor
                          window={bench.win}
                          disabled={disabled}
                          onChange={(edge, value) =>
                            patchRun(siteId, runIdx, (r) => ({ ...r, bench: { ...r.bench, [edge]: value } }))
                          }
                          onDone={() => setOpenEditor(null)}
                        />
                      )}
                      {openEditor === forecastKey && (
                        <WindowEditor
                          window={forecast.win}
                          disabled={disabled}
                          onChange={(edge, value) =>
                            patchRun(siteId, runIdx, (r) => ({ ...r, forecast: { ...r.forecast, [edge]: value } }))
                          }
                          onDone={() => setOpenEditor(null)}
                        />
                      )}

                      {/* Copied category forecasts, editable on demand */}
                      {catsOpen && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px',
                            padding: '8px 10px',
                            borderRadius: '10px',
                            border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
                            background: '#fff',
                          }}
                        >
                          {Object.keys(run.categories).map((cat) => {
                            const catWin = readWindow(siteId, runIdx, (r) => r.categories[cat]);
                            const catKey = `${siteId}:${runIdx}:cat:${cat}`;
                            return (
                              <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ width: '160px', fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
                                    {cat}
                                  </span>
                                  <RangePill
                                    text={catWin.mixed ? 'Mixed' : `${catWin.win.start} – ${catWin.win.end}`}
                                    open={openEditor === catKey}
                                    disabled={disabled}
                                    onClick={() => setOpenEditor(openEditor === catKey ? null : catKey)}
                                  />
                                </div>
                                {openEditor === catKey && (
                                  <WindowEditor
                                    window={catWin.win}
                                    disabled={disabled}
                                    onChange={(edge, value) =>
                                      patchRun(siteId, runIdx, (r) => ({
                                        ...r,
                                        categories: {
                                          ...r.categories,
                                          [cat]: { ...r.categories[cat], [edge]: value },
                                        },
                                      }))
                                    }
                                    onDone={() => setOpenEditor(null)}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Benches the runs are assigned across — per site, not per day */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.07))',
                }}
              >
                <span style={{ width: '86px', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Benches
                </span>
                <Stepper
                  value={benches[siteId] ?? 2}
                  min={1}
                  disabled={disabled}
                  onChange={(next) => setBenches((prev) => ({ ...prev, [siteId]: next }))}
                />
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  the runs above are assigned across these
                </span>
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Forecast windows and category refinements came with the copy. New products with no sales history hold a minimum of 1.
        </div>
      </div>
    </CardShell>
  );
}

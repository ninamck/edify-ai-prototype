'use client';

/**
 * Site setup · step 6 — hot production.
 *
 * Mirrors the Hot production tab on the Production settings page:
 * production stations (hot-food recipes made together on a timed
 * batch cycle), full-selection times (at a set time, top up the
 * forecast with a fixed extra quantity of the chosen recipes), the
 * default planner window, Product Control Review, and the carry-over
 * setting. All copied from the chosen shop. Benches live on the
 * production step — they belong to the production runs.
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
  defaultBenchesHot,
  getTemplateShop,
  getWorkdaySite,
} from '../siteSetupFixtures';
import type { BenchesHotSetup, HotStation, SiteBenchesHot } from '../siteSetupFixtures';

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

  const disabled = state !== 'pending';

  const patchSite = (siteId: string, patch: (s: BenchesHotSetup) => BenchesHotSetup) => {
    setBenchesHot((prev) => ({ ...prev, [siteId]: patch(prev[siteId]) }));
  };

  const patchStation = (siteId: string, stationIdx: number, patch: (st: HotStation) => HotStation) => {
    patchSite(siteId, (s) => ({
      ...s,
      stations: s.stations.map((st, i) => (i === stationIdx ? patch(st) : st)),
    }));
  };

  const patchFstRow = (
    siteId: string,
    rowIdx: number,
    patch: (row: BenchesHotSetup['fullSelectionTimes'][number]) => BenchesHotSetup['fullSelectionTimes'][number],
  ) => {
    patchSite(siteId, (s) => ({
      ...s,
      fullSelectionTimes: s.fullSelectionTimes.map((r, i) => (i === rowIdx ? patch(r) : r)),
    }));
  };

  return (
    <CardShell
      icon={Flame}
      title="Hot production"
      subtitle="Copied with each shop. Stations, recipes and full-selection times stay editable"
      state={state}
      confirmLabel="Continue"
      onCancel={onCancel}
      onEdit={onEdit}
      onConfirm={() => onSubmit({ benchesHot })}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {siteIds.map((siteId) => {
          const site = getWorkdaySite(siteId);
          if (!site) return null;
          const template = getTemplateShop(templates[siteId]);
          const setup = benchesHot[siteId];
          if (!setup) return null;
          const plannerOpen = openPlanner === siteId;
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
                  Copied from {template?.name ?? 'the template'}
                </span>
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
                          {st.slotMins} min batches · {st.recipes.length} recipes
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
                              <span style={labelStyle}>Batch cycle</span>
                              <select
                                disabled={disabled}
                                value={st.slotMins}
                                onChange={(e) =>
                                  patchStation(siteId, stationIdx, (x) => ({ ...x, slotMins: Number(e.target.value) }))
                                }
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
                  Full-selection times · top up the forecast with a fixed extra quantity at a set time
                </span>
                {setup.fullSelectionTimes.map((row, rowIdx) => {
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
                              patchSite(siteId, (s) => ({
                                ...s,
                                fullSelectionTimes: s.fullSelectionTimes.filter((_, i) => i !== rowIdx),
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
                {!disabled && (
                  <button
                    type="button"
                    onClick={() =>
                      patchSite(siteId, (s) => ({
                        ...s,
                        fullSelectionTimes: [...s.fullSelectionTimes, { time: '06:00', recipes: [], qty: 1 }],
                      }))
                    }
                    style={{ ...disclosureBtnStyle(disabled), alignSelf: 'flex-start' }}
                  >
                    <Plus size={13} strokeWidth={2.2} />
                    Add time
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
                    text={`${setup.plannerWindow.start} – ${setup.plannerWindow.end}`}
                    open={plannerOpen}
                    disabled={disabled}
                    onClick={() => setOpenPlanner(plannerOpen ? null : siteId)}
                  />
                </div>
                {plannerOpen && (
                  <WindowEditor
                    window={setup.plannerWindow}
                    disabled={disabled}
                    onChange={(edge, value) =>
                      patchSite(siteId, (s) => ({ ...s, plannerWindow: { ...s.plannerWindow, [edge]: value } }))
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

'use client';

/**
 * GeneralTab — the canonical "site setup" surface.
 *
 * Holds the site's core identity (name, format) + opening hours + hub
 * link, plus the production-setup block lifted up from the deep tabs
 * so a manager can see at a glance how the site is shaped without
 * tab-hopping:
 *   • Does this site have a kitchen?
 *   • Is it baking for other sites?
 *   • Optional hub it pulls from
 *   • Bench count (read-only summary; the Benches tab is still the
 *     editor for individual benches)
 *   • Which P-slots run + variable production
 *   • Per-day schedule + sales-forecast windows for each slot
 *
 * The P-slot / windows section reads + writes the same `staged.windows`
 * overlay the dedicated ProductionWindowsTab uses, so edits here
 * commit through the standard save bar and stay in sync if the user
 * jumps to that tab.
 *
 * Net-new fields that don't yet exist in the overlay model (kitchen
 * toggle, producing-for-others, P3 / P4 slots, flexible line items)
 * use local component state. They drive the visual + interaction
 * shape today; once the underlying data model lands they can be lifted
 * into `staged` with no UI change.
 */

import { useEffect, useMemo, useState } from 'react';
import QtyStepper, { getStepperValueStyle } from '@/components/Production/QtyStepper';
import StatusPill from '@/components/Production/StatusPill';
import {
  DAYS_OF_WEEK,
  PRET_FORMATS,
  PRET_SITES,
  PRET_RECIPES,
  type DayOfWeek,
  type FormatId,
  type RecipeId,
  type SiteId,
} from '@/components/Production/fixtures';
import {
  useSiteSettings,
  type TimeRange,
  type WindowsForDay,
} from '../siteSettingsStore';
import {
  FieldRow,
  HealthAlertStrip,
  PillMultiPicker,
  PillPicker,
  ReadOnlyValue,
  Section,
  TextInput,
  TimeInput,
  type TabProps,
} from './_shared';

// ─── Local-state slot model ──────────────────────────────────────────────────
//
// The production-runs picker offers four scheduled slots (P1..P4) plus
// variable production. The overlay store only models p1/p2/vp today,
// so P3 + P4 windows live in component-local state for now — see the
// `localExtraWindows` map below. The slot config carries the wiring
// so each row knows whether to read/write the overlay or the local
// fallback.

type SlotId = 'p1' | 'p2' | 'p3' | 'p4' | 'vp';

const SLOT_CONFIG: Array<{
  id: SlotId;
  label: string;
  /** Whether the slot's schedule + forecast windows are wired to the
   *  shared `staged.windows` overlay (true) or component-local state. */
  persisted: boolean;
}> = [
  { id: 'p1', label: 'Production 1', persisted: true },
  { id: 'p2', label: 'Production 2', persisted: true },
  { id: 'p3', label: 'Production 3', persisted: false },
  { id: 'p4', label: 'Production 4', persisted: false },
  { id: 'vp', label: 'Variable Production', persisted: true },
];

const PRODUCING_FOR_OTHERS_OPTIONS = [
  { id: 'self-only', label: 'No — only for my own shop' },
  { id: 'hub', label: 'Yes — I bake for other sites (hub mode)' },
] as const;
type ProducingForOthers = (typeof PRODUCING_FOR_OTHERS_OPTIONS)[number]['id'];

export default function GeneralTab({ siteId, editing, staged, onStage, health }: TabProps) {
  const { effective } = useSiteSettings(siteId);
  const core = effective.core;
  const stagedCore = staged.core ?? {};

  const isHub = core.type === 'HUB';
  const isSpoke = core.type === 'SPOKE';
  const hubOptions = PRET_SITES.filter(s => s.type === 'HUB').map(s => ({
    id: s.id,
    label: s.name,
  }));

  // Resolve the candidate values: staged → persisted overlay → fixture default
  const name = stagedCore.name ?? core.name;
  const formatId = stagedCore.formatId ?? core.formatId;
  const hubId = stagedCore.hubId === undefined ? core.hubId : stagedCore.hubId;
  const open = stagedCore.openingHours?.open ?? core.openingHours.open;
  const close = stagedCore.openingHours?.close ?? core.openingHours.close;
  const salesFactor = stagedCore.salesFactor ?? core.salesFactor;

  // ── Production setup (local UI state for fields not in the overlay) ──
  // Defaults derived from site type so the form starts in a sensible
  // shape per persona — managers shouldn't have to reset four fields
  // just to land on what's already true today.
  const [hasKitchen, setHasKitchen] = useState<'yes' | 'no'>(
    isSpoke ? 'no' : 'yes',
  );
  const [producingForOthers, setProducingForOthers] = useState<ProducingForOthers>(
    isHub ? 'hub' : 'self-only',
  );
  useEffect(() => {
    setHasKitchen(isSpoke ? 'no' : 'yes');
    setProducingForOthers(isHub ? 'hub' : 'self-only');
  }, [siteId, isSpoke, isHub]);

  const benchCount = effective.benches.length;

  // ── Production runs picker (local state) ──
  // Default selection: every slot the site has a non-empty schedule
  // for on Monday today, with P1/P2 falling back so the demo always
  // starts with something checked. VP is also enabled by default for
  // self-producing sites since they have a retail floor.
  const seededRuns = useMemo<SlotId[]>(() => {
    const set = new Set<SlotId>(['p1', 'p2']);
    if (!isSpoke) set.add('vp');
    return Array.from(set);
  }, [isSpoke]);
  const [activeRuns, setActiveRuns] = useState<SlotId[]>(seededRuns);
  useEffect(() => {
    setActiveRuns(seededRuns);
  }, [seededRuns]);

  // ── Flexible line items (local state) ──
  // Surface the site's existing range as the option set so the picker
  // is grounded in real recipes rather than a placeholder list.
  const lineItemOptions = useMemo(
    () =>
      PRET_RECIPES.slice(0, 12).map(r => ({
        id: r.id,
        label: r.name,
      })),
    [],
  );
  const [flexibleLineItems, setFlexibleLineItems] = useState<RecipeId[]>([]);

  // ── Production schedules ──
  // Day picker for the per-day schedule + sales forecast windows.
  // The active day's window values are merged from defaults + effective
  // (persisted overlay) + staged so the editor always renders against
  // the freshest snapshot.
  const [activeDay, setActiveDay] = useState<DayOfWeek>('Mon');
  const stagedWindows = staged.windows ?? {};
  const dayWindows: WindowsForDay = useMemo(
    () => ({
      ...effective.windows[activeDay],
      ...stagedWindows[activeDay],
    }),
    [effective.windows, stagedWindows, activeDay],
  );

  // P3 / P4 windows have no overlay slot yet — kept in component
  // state, keyed by day so each weekday gets its own values.
  type LocalExtras = Partial<Record<DayOfWeek, { p3?: TimeRange; p4?: TimeRange; p3Forecast?: TimeRange; p4Forecast?: TimeRange }>>;
  const [localExtraWindows, setLocalExtraWindows] = useState<LocalExtras>({});
  const localExtras = localExtraWindows[activeDay] ?? {};

  function setPersistedSlot(slot: keyof WindowsForDay, value: TimeRange) {
    onStage({ windows: { [activeDay]: { [slot]: value } } });
  }
  function setLocalSlot(slot: 'p3' | 'p4' | 'p3Forecast' | 'p4Forecast', value: TimeRange) {
    setLocalExtraWindows(prev => ({
      ...prev,
      [activeDay]: { ...(prev[activeDay] ?? {}), [slot]: value },
    }));
  }

  // ── Validation ──
  const openInvalid =
    open && close && close <= open
      ? `Close (${close}) must be after open (${open}). Did you mean ${suggestCloseTime(open)}?`
      : null;

  function setCore(patch: Partial<typeof stagedCore>) {
    onStage({ core: patch });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1040 }}>
      <HealthAlertStrip items={health} />

      <Section title="Site identity" description="The name shown across the app, plus where this site sits in the estate.">
        <FieldRow
          label="Site name"
          control={
            <TextInput
              value={name}
              disabled={!editing}
              onChange={v => setCore({ name: v })}
            />
          }
          fullWidthControl
          cascade={
            stagedCore.name === undefined && core.name === core.defaults.name
              ? `Default · ${core.defaults.name}`
              : undefined
          }
          isOverridden={
            (stagedCore.name !== undefined && stagedCore.name !== core.defaults.name) ||
            core.name !== core.defaults.name
          }
          onReset={() => setCore({ name: core.defaults.name })}
        />

        <FieldRow
          label="Site type"
          hint="Type is structural — change it via Quinn rather than a single-field edit."
          control={
            <ReadOnlyValue
              value={core.type}
              hint={
                isHub
                  ? `Acts as the hub for ${
                      PRET_SITES.filter(s => s.hubId === siteId).length
                    } site(s)`
                  : core.hubId
                  ? `Hub-linked · receives from ${core.hubId.replace(/-/g, ' ')}`
                  : 'Self-producing'
              }
            />
          }
        />

        <FieldRow
          label="Format"
          hint="Determines the cascade defaults — opening hours, cutoffs, run profile."
          control={
            <PillPicker<FormatId>
              options={PRET_FORMATS.map(f => ({ id: f.id, label: f.name }))}
              value={formatId}
              onChange={v => setCore({ formatId: v })}
              disabled={!editing}
            />
          }
          cascade={`Format default · ${
            PRET_FORMATS.find(f => f.id === core.defaults.formatId)?.name ?? core.defaults.formatId
          }`}
          isOverridden={formatId !== core.defaults.formatId}
          onReset={() => setCore({ formatId: core.defaults.formatId })}
        />
      </Section>

      <Section
        title="Production setup"
        description="The high-level shape of this site's production — kitchen, hub link, bench count. Detailed bench config lives in the Benches tab."
      >
        <FieldRow
          label="Does this location have a kitchen?"
          hint="No kitchen = receive-only spoke. Yes = bakes on its own benches (and may also receive from a hub)."
          control={
            <PillPicker<'yes' | 'no'>
              options={[
                { id: 'yes', label: 'Yes' },
                { id: 'no', label: 'No' },
              ]}
              value={hasKitchen}
              onChange={setHasKitchen}
              disabled={!editing}
            />
          }
        />

        <FieldRow
          label="Are you producing for other sites?"
          hint="Hub sites bake for a network of spokes and dispatch ahead of each cutoff."
          control={
            <Select<ProducingForOthers>
              value={producingForOthers}
              onChange={setProducingForOthers}
              disabled={!editing}
              options={PRODUCING_FOR_OTHERS_OPTIONS.map(o => ({ id: o.id, label: o.label }))}
            />
          }
        />

        <FieldRow
          label="Optional: Production HUB"
          hint={
            isSpoke
              ? 'Spokes always order from one hub. Switching here re-points future orders only.'
              : 'Hybrid + linked-standalone sites can pull part of their range from a hub. Leave empty for fully self-producing.'
          }
          control={
            <PillPicker<SiteId>
              options={[
                { id: '__none' as SiteId, label: 'Select a HUB' },
                ...hubOptions,
              ]}
              value={(hubId ?? '__none') as SiteId}
              onChange={v => setCore({ hubId: v === '__none' ? null : v })}
              disabled={!editing || isSpoke}
            />
          }
          cascade={
            core.defaults.hubId
              ? `Default · ${core.defaults.hubId.replace(/-/g, ' ')}`
              : 'Default · self-producing'
          }
          isOverridden={hubId !== core.defaults.hubId}
          onReset={() => setCore({ hubId: core.defaults.hubId })}
        />

        <FieldRow
          label="Number of benches"
          hint="The count comes from the Benches tab — open it to add, rename, or change capabilities."
          control={
            <ReadOnlyValue
              value={String(benchCount)}
              hint={benchCount === 1 ? '1 bench configured' : `${benchCount} benches configured`}
            />
          }
        />

        {hubId && !isHub && (
          <FieldRow
            label="Sales factor"
            hint="Demand share relative to the hub. Quinn uses this to derive a per-site forecast when none is set explicitly."
            control={
              <QtyStepper
                size="emphasized"
                disabled={!editing}
                onIncrement={() =>
                  setCore({
                    salesFactor: Math.min(2, round2(salesFactor + 0.05)),
                  })
                }
                onDecrement={() =>
                  setCore({
                    salesFactor: Math.max(0.05, round2(salesFactor - 0.05)),
                  })
                }
                decrementLabel="Lower factor"
                incrementLabel="Raise factor"
              >
                <span style={getStepperValueStyle('emphasized')}>{salesFactor.toFixed(2)}</span>
              </QtyStepper>
            }
            cascade={`Default · ${core.defaults.salesFactor.toFixed(2)}`}
            isOverridden={round2(salesFactor) !== round2(core.defaults.salesFactor)}
            onReset={() => setCore({ salesFactor: core.defaults.salesFactor })}
          />
        )}
      </Section>

      <Section
        title="Production runs"
        description="Which scheduled bakes run at this site, plus any recipes that should flex between them."
      >
        <FieldRow
          label="Production runs"
          hint="Select the P-slots the kitchen actually bakes on. Each slot gets its own schedule + sales-forecast window below."
          control={
            <PillMultiPicker<SlotId>
              options={SLOT_CONFIG.map(s => ({ id: s.id, label: s.label }))}
              value={activeRuns}
              onChange={setActiveRuns}
              disabled={!editing}
            />
          }
        />

        <FieldRow
          label="Flexible line items"
          hint="Recipes that can shift between scheduled slots when demand moves. Quinn rebalances them automatically."
          control={
            <PillMultiPicker<RecipeId>
              options={lineItemOptions}
              value={flexibleLineItems}
              onChange={setFlexibleLineItems}
              disabled={!editing}
            />
          }
        />
      </Section>

      <Section
        title="Production schedules"
        description="Per-day windows for each active run. Production schedule = when the bake happens; sales forecast = the floor demand window that bake is sized against."
      >
        {/* Day picker */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DAYS_OF_WEEK.map(d => {
            const active = d === activeDay;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setActiveDay(d)}
                style={dayPillStyle(active)}
              >
                {d}
              </button>
            );
          })}
        </div>

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
              {activeRuns.length === 0
                ? 'No runs selected above — pick one or more in Production runs to fill in this schedule.'
                : 'Each row covers one active run. Times are 24h.'}
            </span>
          </div>

          {/* Production schedule rows */}
          <SchedulesBlock
            title="Production schedule"
            activeRuns={activeRuns}
            editing={editing}
            getValue={slotId =>
              valueFor(slotId, 'schedule', dayWindows, localExtras)
            }
            onChange={(slotId, value) => {
              const slot = SLOT_CONFIG.find(s => s.id === slotId);
              if (!slot) return;
              if (slot.persisted) {
                setPersistedSlot(slotId as keyof WindowsForDay, value);
              } else {
                setLocalSlot(slotId === 'p3' ? 'p3' : 'p4', value);
              }
            }}
          />

          {/* Sales forecast rows */}
          <SchedulesBlock
            title="Sales forecast windows"
            activeRuns={activeRuns}
            editing={editing}
            getValue={slotId =>
              valueFor(slotId, 'forecast', dayWindows, localExtras)
            }
            onChange={(slotId, value) => {
              const slot = SLOT_CONFIG.find(s => s.id === slotId);
              if (!slot) return;
              if (slot.persisted) {
                const overlayKey = `${slotId}Forecast` as keyof WindowsForDay;
                setPersistedSlot(overlayKey, value);
              } else {
                setLocalSlot(slotId === 'p3' ? 'p3Forecast' : 'p4Forecast', value);
              }
            }}
          />
        </div>
      </Section>

      <Section title="Opening hours" description="Used by Quinn to schedule production windows and dispatch arrival times.">
        <FieldRow
          label="Open"
          control={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <TimeInput
                value={open}
                disabled={!editing}
                onChange={v => setCore({ openingHours: { open: v, close } })}
              />
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>to</span>
              <TimeInput
                value={close}
                disabled={!editing}
                onChange={v => setCore({ openingHours: { open, close: v } })}
              />
            </div>
          }
          cascade={`Default · ${core.defaults.openingHours.open}–${core.defaults.openingHours.close}`}
          isOverridden={
            open !== core.defaults.openingHours.open ||
            close !== core.defaults.openingHours.close
          }
          onReset={() =>
            setCore({
              openingHours: {
                open: core.defaults.openingHours.open,
                close: core.defaults.openingHours.close,
              },
            })
          }
        />
        {openInvalid && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--color-error-light)',
              border: '1px solid var(--color-error-border)',
              color: 'var(--color-error)',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {openInvalid}
          </div>
        )}
      </Section>

      {isHub && (
        <Section
          title="Hub coverage"
          description="The sites this hub bakes for. Manage links from each spoke's Production setup field."
        >
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            {PRET_SITES.filter(s => s.hubId === siteId).length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                No spokes linked yet. Add a hub link from a spoke site to wire it in.
              </span>
            ) : (
              PRET_SITES.filter(s => s.hubId === siteId).map(s => (
                <span
                  key={s.id}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: 'var(--color-bg-hover)',
                    border: '1px solid var(--color-border-subtle)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {s.name}
                </span>
              ))
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Schedule block ──────────────────────────────────────────────────────────

/**
 * Renders one start–end row per active P-slot for either the bake
 * schedule or the sales forecast window. Same shape both times so the
 * two blocks read as a clear pair.
 */
function SchedulesBlock({
  title,
  activeRuns,
  editing,
  getValue,
  onChange,
}: {
  title: string;
  activeRuns: SlotId[];
  editing: boolean;
  getValue: (slotId: SlotId) => TimeRange;
  onChange: (slotId: SlotId, value: TimeRange) => void;
}) {
  if (activeRuns.length === 0) return null;
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 10,
        }}
      >
        {activeRuns.map(slotId => {
          const slot = SLOT_CONFIG.find(s => s.id === slotId)!;
          const value = getValue(slotId);
          const invalid =
            value.start && value.end && value.end <= value.start
              ? `End ${value.end} must be after start ${value.start}`
              : null;
          return (
            <div
              key={slotId}
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
                {slot.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TimeInput
                  value={value.start}
                  disabled={!editing}
                  onChange={v => onChange(slotId, { start: v, end: value.end })}
                />
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>to</span>
                <TimeInput
                  value={value.end}
                  disabled={!editing}
                  onChange={v => onChange(slotId, { start: value.start, end: v })}
                />
              </div>
              {invalid && (
                <span style={{ fontSize: 10.5, color: 'var(--color-error)', fontWeight: 700 }}>
                  {invalid}
                </span>
              )}
              {!slot.persisted && (
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  Local preview · persistence wiring lands once the data model gains P3 / P4.
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function valueFor(
  slotId: SlotId,
  kind: 'schedule' | 'forecast',
  dayWindows: WindowsForDay,
  localExtras: { p3?: TimeRange; p4?: TimeRange; p3Forecast?: TimeRange; p4Forecast?: TimeRange },
): TimeRange {
  const persisted = (() => {
    if (slotId === 'p3' || slotId === 'p4') return undefined;
    const key = (kind === 'schedule' ? slotId : `${slotId}Forecast`) as keyof WindowsForDay;
    return dayWindows[key] as TimeRange | undefined;
  })();
  if (persisted) return persisted;
  if (slotId === 'p3') return (kind === 'schedule' ? localExtras.p3 : localExtras.p3Forecast) ?? { start: '', end: '' };
  if (slotId === 'p4') return (kind === 'schedule' ? localExtras.p4 : localExtras.p4Forecast) ?? { start: '', end: '' };
  return { start: '', end: '' };
}

// ─── Tiny select control (matches the rest of the form rhythm) ───────────────

function Select<T extends string>({
  value,
  onChange,
  disabled,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  options: Array<{ id: T; label: string }>;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value as T)}
      style={{
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        background: disabled ? 'var(--color-bg-hover)' : '#ffffff',
        fontSize: 13,
        fontFamily: 'var(--font-primary)',
        color: 'var(--color-text-primary)',
        minHeight: 38,
        minWidth: 280,
      }}
    >
      {options.map(o => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Day pill style (matches ProductionWindowsTab so the two reads as one feature) ──

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

function suggestCloseTime(open: string): string {
  // Bump open by 12h, capped at 23:59 — a sensible "did you mean".
  const [h, m] = open.split(':').map(n => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return '22:00';
  const totalMin = h * 60 + m + 12 * 60;
  const cappedMin = Math.min(totalMin, 23 * 60 + 59);
  const hh = String(Math.floor(cappedMin / 60)).padStart(2, '0');
  const mm = String(cappedMin % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

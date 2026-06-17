'use client';

/**
 * GeneralTab — the canonical "production setup" surface.
 *
 * The site's name lives elsewhere (company / sites admin) and the type is
 * no longer hand-picked here. Instead the manager answers three plain
 * questions and the site model is *derived* from them (see
 * `deriveSiteModel`): does it have a kitchen, is it producing for other
 * sites, and which hub (if any) it pulls from. Those three answers settle
 * the site into one of the five estate models — spoke, standalone, hybrid,
 * hub, or producing hybrid-hub — and the rest of the page (hub link
 * requirement, hub coverage, forecast seeding) keys off that.
 *
 * The tab also surfaces:
 *   • Bench count (read-only summary; the Benches tab is still the
 *     editor for individual benches)
 *   • Which P-slots run + variable production
 *   • Per-day schedule + sales-forecast windows for each slot
 *   • Opening hours and (for hubs) the spokes it covers
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
import { CheckCircle2, LineChart } from 'lucide-react';
import StatusPill from '@/components/Production/StatusPill';
import {
  DAYS_OF_WEEK,
  PRET_SITES,
  PRET_RECIPES,
  dayOffset,
  type DayOfWeek,
  type RecipeId,
  type SiteId,
  type SiteType,
} from '@/components/Production/fixtures';
import { usePlanStore } from '@/components/Production/PlanStore';
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

// The producing-for-others answer is the lever that — together with the
// "has a kitchen?" toggle and the optional hub link — derives which of the
// five site models this location is. See `deriveSiteModel` below.
const PRODUCING_FOR_OTHERS_OPTIONS = [
  { id: 'self-only', label: 'No — only for my own shop' },
  { id: 'exclusive', label: 'Yes — exclusively for other shops' },
  { id: 'own-plus-others', label: 'Yes' },
] as const;
type ProducingForOthers = (typeof PRODUCING_FOR_OTHERS_OPTIONS)[number]['id'];

/**
 * The five operating models a site can take. These map 1:1 onto the
 * `SiteType` union the rest of the app runs on, but the manager never picks
 * the type directly — it falls out of three plain-language questions:
 *
 *   1. Does this location have a kitchen?            (hasKitchen)
 *   2. Are you producing for other sites?            (producingForOthers)
 *   3. Optional: which hub does it pull from?        (hubId)
 *
 *   ┌─────────────┬──────────────────────┬──────────┬──────────────┐
 *   │ Kitchen     │ Producing for others │ Hub link │ Model        │
 *   ├─────────────┼──────────────────────┼──────────┼──────────────┤
 *   │ No          │ —                    │ required │ SPOKE        │
 *   │ Yes         │ No (own shop only)   │ none     │ STANDALONE   │
 *   │ Yes         │ No (own shop only)   │ set      │ HYBRID       │
 *   │ Yes         │ Exclusively others   │ —        │ HUB          │
 *   │ Yes         │ Also own production  │ —        │ HYBRID_HUB   │
 *   └─────────────┴──────────────────────┴──────────┴──────────────┘
 */
function deriveSiteModel(
  hasKitchen: 'yes' | 'no',
  producing: ProducingForOthers,
  hubId: SiteId | null,
): SiteType {
  if (hasKitchen === 'no') return 'SPOKE';
  switch (producing) {
    case 'exclusive':
      return 'HUB';
    case 'own-plus-others':
      return 'HYBRID_HUB';
    case 'self-only':
    default:
      return hubId ? 'HYBRID' : 'STANDALONE';
  }
}

/** Map a persisted site type back to the producing-for-others answer. */
function producingFromType(type: SiteType): ProducingForOthers {
  if (type === 'HUB') return 'exclusive';
  if (type === 'HYBRID_HUB') return 'own-plus-others';
  return 'self-only';
}

export default function GeneralTab({ siteId, editing, staged, onStage, health }: TabProps) {
  const { effective } = useSiteSettings(siteId);
  const core = effective.core;
  const stagedCore = staged.core ?? {};

  // Candidate parent hubs = any site already acting as a hub (a plain HUB or
  // a producing HYBRID_HUB), minus this site itself so it can't link to its
  // own kitchen.
  const hubOptions = PRET_SITES
    .filter(s => (s.type === 'HUB' || s.type === 'HYBRID_HUB') && s.id !== siteId)
    .map(s => ({ id: s.id, label: s.name }));

  // ── Apply forecast → plan ──
  // Hybrids + standalones plan their own production against their retail
  // forecast (hubs plan from spoke demand; spokes order from a hub), so
  // this one-click seed is offered only to those two personas. The plan's
  // baseline already derives from Edify's forecast, so "apply" means:
  // drop any manual overrides on the upcoming days so each day snaps back
  // to the latest forecast. Today's committed plan is intentionally left
  // untouched — managers re-forecast for tomorrow onward.
  const planStore = usePlanStore();
  const [forecastConfirmOpen, setForecastConfirmOpen] = useState(false);
  const [forecastApplied, setForecastApplied] = useState(false);
  const FORECAST_HORIZON_DAYS = 12;
  function applyForecastToPlan() {
    // Reset each upcoming day (tomorrow → +12) back to the forecast
    // baseline. Looping per-date keeps today / past plans intact.
    for (let d = 1; d <= FORECAST_HORIZON_DAYS; d += 1) {
      planStore.resetAll(dayOffset(d));
    }
    setForecastConfirmOpen(false);
    setForecastApplied(true);
  }
  useEffect(() => {
    setForecastConfirmOpen(false);
    setForecastApplied(false);
  }, [siteId]);

  // Resolve the candidate values: staged → persisted overlay → fixture default
  const hubId = stagedCore.hubId === undefined ? core.hubId : stagedCore.hubId;
  const open = stagedCore.openingHours?.open ?? core.openingHours.open;
  const close = stagedCore.openingHours?.close ?? core.openingHours.close;

  // ── Production setup (local UI state for fields not in the overlay) ──
  // Defaults derived from the current site type so the form starts in a
  // sensible shape per persona — managers shouldn't have to re-answer
  // questions just to land on what's already true today.
  const [hasKitchen, setHasKitchen] = useState<'yes' | 'no'>(
    core.type === 'SPOKE' ? 'no' : 'yes',
  );
  const [producingForOthers, setProducingForOthers] = useState<ProducingForOthers>(
    producingFromType(core.type),
  );
  useEffect(() => {
    setHasKitchen(core.type === 'SPOKE' ? 'no' : 'yes');
    setProducingForOthers(producingFromType(core.type));
  }, [siteId, core.type]);

  // The model is computed live from the three questions above — this is
  // what replaces the old hand-picked "Site type" field. Settling on a hub
  // model clears any inbound hub link (a hub doesn't order from itself);
  // dropping the kitchen forces a hub link (a spoke must order from one).
  const derivedModel = deriveSiteModel(hasKitchen, producingForOthers, hubId ?? null);
  const isHubModel = derivedModel === 'HUB' || derivedModel === 'HYBRID_HUB';
  const requiresHub = derivedModel === 'SPOKE';

  // The forecast→plan seed is for sites that bake their own retail range:
  // standalone, hybrid, and the producing hybrid-hub. Pure hubs plan from
  // spoke demand and spokes order from a hub, so neither gets the button.
  const showApplyForecast =
    derivedModel === 'HYBRID' ||
    derivedModel === 'STANDALONE' ||
    derivedModel === 'HYBRID_HUB';

  const benchCount = effective.benches.length;

  // ── Production runs picker (local state) ──
  // Default selection: every slot the site has a non-empty schedule
  // for on Monday today, with P1/P2 falling back so the demo always
  // starts with something checked. VP is also enabled by default for
  // self-producing sites since they have a retail floor.
  const seededRuns = useMemo<SlotId[]>(() => {
    const set = new Set<SlotId>(['p1', 'p2']);
    if (hasKitchen === 'yes') set.add('vp');
    return Array.from(set);
  }, [hasKitchen]);
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

  // ── Hub coverage (local state) ──
  // Which spokes this hub produces for. Candidate sites are the spokes +
  // hybrids in the estate (a hub bakes for receive-only spokes and the
  // order-portion of hybrids), minus this site itself. Seeds from whoever
  // already points their `hubId` here so the picker starts truthful.
  const spokeCandidates = useMemo(
    () =>
      PRET_SITES.filter(
        s => s.id !== siteId && (s.type === 'SPOKE' || s.type === 'HYBRID'),
      ).map(s => ({ id: s.id, label: s.name })),
    [siteId],
  );
  const servedDefault = useMemo(
    () => PRET_SITES.filter(s => s.hubId === siteId).map(s => s.id),
    [siteId],
  );
  const [servedSpokeIds, setServedSpokeIds] = useState<SiteId[]>(servedDefault);
  useEffect(() => {
    setServedSpokeIds(servedDefault);
  }, [servedDefault]);

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

      <Section
        title="Production setup"
        description="Answer these three questions and Edify works out how this site sits in the estate — whether it bakes, who it bakes for, and which hub (if any) it pulls from. The site model below updates as you go."
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

        {hasKitchen === 'yes' && (
          <FieldRow
            label="Are you producing for other sites?"
            hint="Drives whether this is a standalone, a hybrid, a hub, or a producing hybrid-hub."
            control={
              <Select<ProducingForOthers>
                value={producingForOthers}
                onChange={setProducingForOthers}
                disabled={!editing}
                options={PRODUCING_FOR_OTHERS_OPTIONS.map(o => ({ id: o.id, label: o.label }))}
              />
            }
          />
        )}

        {derivedModel !== 'HUB' && (
          <FieldRow
            label={requiresHub ? 'Production hub' : 'Optional: production hub'}
            hint={
              requiresHub
                ? 'A spoke has no kitchen, so it must order its full range from one hub.'
                : derivedModel === 'HYBRID_HUB'
                ? 'A producing hybrid-hub can still pull part of its own range from another hub. Leave empty to bake everything it sells.'
                : 'A Production Hub is a location that produces items on your behalf. Select one to delegate some or all of your production to it.'
            }
            control={
              <PillPicker<SiteId>
                options={[
                  { id: '__none' as SiteId, label: requiresHub ? 'Select a hub' : 'No hub — self-producing' },
                  ...hubOptions,
                ]}
                value={(hubId ?? '__none') as SiteId}
                onChange={v => setCore({ hubId: v === '__none' ? null : v })}
                disabled={!editing}
              />
            }
            cascade={
              requiresHub && !hubId
                ? '⚠ A spoke needs a hub to order from'
                : undefined
            }
            isOverridden={hubId !== core.defaults.hubId}
            onReset={() => setCore({ hubId: core.defaults.hubId })}
          />
        )}

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

      </Section>

      {isHubModel && (
        <Section
          title="Hub coverage"
          description={
            derivedModel === 'HYBRID_HUB'
              ? 'The spokes this producing hybrid-hub bakes for, on top of its own range. Pick which sites it supplies.'
              : 'The sites this hub bakes for. Pick which spokes it supplies — their orders flow into this hub\'s plan.'
          }
        >
          <FieldRow
            label="Spokes this hub produces for"
            hint="Select every spoke (and the order-portion of any hybrid) this hub bakes and dispatches to."
            control={
              spokeCandidates.length === 0 ? (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  No eligible spokes in this estate yet.
                </span>
              ) : (
                <PillMultiPicker<SiteId>
                  options={spokeCandidates}
                  value={servedSpokeIds}
                  onChange={setServedSpokeIds}
                  disabled={!editing}
                />
              )
            }
            cascade={
              servedSpokeIds.length === 0
                ? '⚠ A hub with no spokes has nothing to dispatch'
                : `Supplying ${servedSpokeIds.length} site${servedSpokeIds.length === 1 ? '' : 's'}`
            }
          />
        </Section>
      )}

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

      {showApplyForecast && (
        <Section
          title="Forecast → plan"
          description="Seed the upcoming production plan straight from Edify's demand forecast. Applies to every day from tomorrow onward — today's committed plan stays put. Fine-tune any day afterward on the Plan tab."
        >
          {forecastApplied ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--color-success-light)',
                border: '1px solid var(--color-success-border)',
                color: 'var(--color-success)',
              }}
            >
              <CheckCircle2 size={16} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>
                  Edify's forecast applied to the next {FORECAST_HORIZON_DAYS} days
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  Each upcoming day now matches the latest forecast. Open the Plan tab to review and confirm.
                </span>
              </div>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setForecastApplied(false)}
                style={ghostActionBtn()}
              >
                Apply again
              </button>
            </div>
          ) : forecastConfirmOpen ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--color-warning-bg)',
                border: '1px solid var(--color-warning-border)',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Replace the upcoming plan with the forecast?
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                Any manual edits you&apos;ve made for tomorrow onward will be overwritten with Edify&apos;s forecast. Today&apos;s plan is not affected.
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setForecastConfirmOpen(false)}
                  style={ghostActionBtn()}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyForecastToPlan}
                  style={primaryActionBtn()}
                >
                  <LineChart size={13} /> Apply forecast
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setForecastConfirmOpen(true)}
                style={primaryActionBtn()}
              >
                <LineChart size={13} /> Apply forecast to plan
              </button>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Populates tomorrow → +{FORECAST_HORIZON_DAYS} days from Edify&apos;s forecast.
              </span>
            </div>
          )}
        </Section>
      )}

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

function primaryActionBtn(): React.CSSProperties {
  return {
    padding: '9px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: 'var(--color-accent-active)',
    color: 'var(--color-text-on-active)',
    border: '1px solid var(--color-accent-active)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  };
}

function ghostActionBtn(): React.CSSProperties {
  return {
    padding: '9px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: '#ffffff',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
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


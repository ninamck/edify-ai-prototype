'use client';

/**
 * Stocktake — the in-line counting flow. Modelled on the production
 * counting UI: a tabbed location strip at the top, items grouped under
 * the active location, multi-UOM input rows for items that can be
 * counted in more than one unit (loose units, cases, etc.), and a
 * mocked auto-save indicator next to the Submit button.
 *
 * Nothing here actually persists — count values live in component
 * state — but the auto-save state machine fires on every keystroke so
 * the surface *feels* like a real save flow. Submit pops an alert.
 *
 * Key behaviours:
 *   • Location tabs derived from the items present at the active site
 *     (uses `locationForItem` from status.ts so we don't have to seed a
 *     `location` field on every fixture row).
 *   • Multi-UOM rows show one input per available unit. The primary
 *     unit is chip-tagged with the accent colour so the operator knows
 *     which unit drives the system's "on hand" figure. Each input is
 *     independent — a real stocktake often records "5 loose bottles +
 *     3 unopened cases" rather than collapsing to a single unit.
 *   • Auto-save: any keystroke flips state to "Saving…" then back to
 *     "Saved" after a 600ms debounce.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Mic, Plus } from 'lucide-react';
import UnitInput from './UnitInput';
import type {
  CountTarget,
  StockItem,
  StockLocation,
  StocktakeRecord,
} from './status';
import {
  STOCK_LOCATION_ORDER,
  formatPrice,
  formatStock,
  formatRelativeDate,
  locationForItem,
  rollupCounts,
  scopeLabel,
} from './status';

interface Props {
  items: StockItem[];
  siteName: string;
  /** The record we're counting against. `null` for a fresh count
   *  (full / area / quick) where no record exists yet. */
  stocktake: StocktakeRecord | null;
  /** The intent the operator chose on the way in. Drives the header
   *  label and whether the location tab strip is shown — for
   *  area/quick counts the scope already constrains the item set so
   *  the tabs would be confusing. */
  scope: CountTarget;
  /** Return to the Stocktake list. */
  onBack: () => void;
  /** Switch this count over to the voice modality. The voice surface
   *  operates on the *same* item set the operator's already scoped to
   *  (full / area / quick / group), so this is purely a presentation
   *  swap — no scope change. Optional: omit to hide the affordance. */
  onUseVoice?: () => void;
}

// Per-cell key in `counts`. We keep counts at (itemId, unit) level so
// the user can record a separate quantity per available unit on
// multi-UOM rows.
type CountKey = `${string}::${string}`;
const keyFor = (itemId: string, unit: string): CountKey =>
  `${itemId}::${unit}` as CountKey;

type SaveState = 'saved' | 'saving';

export default function StocktakeView({
  items,
  siteName,
  stocktake,
  scope,
  onBack,
  onUseVoice,
}: Props) {
  // Quick / group counts span every location at the venue (the items
  // could be anywhere), so we just render a flat list. Area counts
  // are locked to one location — no tabs needed. Only Full / Continue
  // counts show the tab strip.
  const showLocationTabs = scope.kind === 'full' || scope.kind === 'continue';
  // Build the location tab set from items actually present at this
  // site. Stable ordering via STOCK_LOCATION_ORDER so the tab strip
  // doesn't reshuffle if categories change.
  const locationGroups = useMemo(() => {
    const byLoc = new Map<StockLocation, StockItem[]>();
    for (const item of items) {
      const loc = locationForItem(item);
      const list = byLoc.get(loc) ?? [];
      list.push(item);
      byLoc.set(loc, list);
    }
    return STOCK_LOCATION_ORDER
      .filter(loc => byLoc.has(loc))
      .map(loc => ({
        location: loc,
        items: (byLoc.get(loc) ?? []).slice().sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      }));
  }, [items]);

  const [activeLocation, setActiveLocation] = useState<StockLocation>(
    locationGroups[0]?.location ?? 'Front of House',
  );

  // If the items array changes site (parent passes a new array) and
  // the previously active location no longer exists, snap to the first
  // available tab.
  useEffect(() => {
    if (!locationGroups.some(g => g.location === activeLocation)) {
      setActiveLocation(locationGroups[0]?.location ?? 'Front of House');
    }
  }, [locationGroups, activeLocation]);

  const [counts, setCounts] = useState<Record<CountKey, string>>({});
  const [saveState, setSaveState] = useState<SaveState>('saved');
  // Tracks the time of the last successful save so we can render
  // "Last saved 5s ago" style text. Defaults to "now" on mount so the
  // indicator reads "Saved" before the operator touches anything —
  // matches the production reference, where the surface always reads
  // as a known-good state on entry.
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() => new Date());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setCount(itemId: string, unit: string, value: string) {
    setCounts(prev => ({ ...prev, [keyFor(itemId, unit)]: value }));
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveState('saved');
      setLastSavedAt(new Date());
    }, 600);
  }

  // Cleanup the pending debounce on unmount so it doesn't fire into a
  // disposed state setter and flicker the indicator.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const activeGroup =
    locationGroups.find(g => g.location === activeLocation) ?? null;
  const activeItems = activeGroup?.items ?? [];

  // What actually lands in the row list. For full / continue counts
  // it's the items at the currently-active location tab; for area /
  // quick counts the page has already filtered `items` to the right
  // scope, so we render that flat (sorted by name for predictability).
  const displayItems = useMemo(() => {
    if (showLocationTabs) return activeItems;
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }, [showLocationTabs, activeItems, items]);

  // Header label for the row list. Mirrors the scope so the operator
  // always knows what the list of rows below represents.
  const sectionLabel =
    scope.kind === 'area'  ? scope.location
    : scope.kind === 'quick' ? 'Flagged items'
    : scope.kind === 'group' ? scope.groupName
    : activeLocation;

  // Counted-so-far in the displayed set — at least one cell has a
  // non-empty value.
  const countedInSection = useMemo(() => {
    let n = 0;
    for (const item of displayItems) {
      const anyEntry = [item.stockUnit, ...(item.alternateUnits ?? [])].some(
        u => (counts[keyFor(item.id, u)] ?? '').trim() !== '',
      );
      if (anyEntry) n += 1;
    }
    return n;
  }, [displayItems, counts]);

  const totalCounted = useMemo(() => {
    let n = 0;
    for (const item of items) {
      const anyEntry = [item.stockUnit, ...(item.alternateUnits ?? [])].some(
        u => (counts[keyFor(item.id, u)] ?? '').trim() !== '',
      );
      if (anyEntry) n += 1;
    }
    return n;
  }, [items, counts]);

  function handleSubmit() {
    if (totalCounted === 0) {
      alert('Enter at least one count before submitting.');
      return;
    }
    alert(
      `Submitted ${totalCounted} of ${items.length} items for ${siteName} (prototype — nothing persisted).`,
    );
  }

  // Live £ value of what's been counted so far. Each item's
  // multi-UOM entries are rolled up into a single quantity in the
  // item's primary stockUnit (via `rollupCounts` — mass/volume
  // conversions inferred, pack-style alts use the item's seeded
  // factors), then multiplied by `unitPrice`. That way a row counted
  // as "2 bags + 0.5 kg" of pasta correctly contributes
  // 2 × bagFactor + 0.5 = 2.5 kg × unit £, rather than ignoring the
  // bag cell. Items without a unitPrice (rare) skip the sum entirely.
  // Updates on every keystroke so the rollup tracks the count in
  // real-time.
  const countedValue = useMemo(() => {
    let total = 0;
    for (const item of items) {
      if (item.unitPrice == null) continue;
      const allUnits = [item.stockUnit, ...(item.alternateUnits ?? [])];
      const rawByUnit: Record<string, string> = {};
      for (const unit of allUnits) {
        rawByUnit[unit] = counts[keyFor(item.id, unit)] ?? '';
      }
      const rollup = rollupCounts(item, rawByUnit);
      if (!rollup.hasInput) continue;
      total += rollup.total * item.unitPrice;
    }
    return total;
  }, [items, counts]);

  // Subtitle line — when we're continuing an existing stocktake we
  // show its scope + who started it; for a fresh count the scope
  // label leads, then progress + £-value of what the operator has
  // actually counted (not theoretical on-hand) so the running
  // £-figure is a real signal as they go.
  const subtitle = stocktake
    ? `${stocktake.scope}${
        stocktake.sectionName ? ` · ${stocktake.sectionName}` : ''
      } · started ${formatRelativeDate(stocktake.date)} by ${stocktake.counterName}`
    : `${scopeLabel(scope)} · ${totalCounted} of ${items.length} items counted · ${formatPrice(countedValue)} counted`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Back link — returns to the stocktake list. Subtle so it
          doesn't compete with the Submit CTA. */}
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          marginLeft: -8,
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-primary)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          width: 'fit-content',
        }}
      >
        <ArrowLeft size={14} strokeWidth={2.4} /> Back to stocktakes
      </button>

      {/* Header — site + submit + auto-save */}
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: '0.01em',
              }}
            >
              {siteName.toUpperCase()}
            </h2>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 8px',
                borderRadius: 'var(--radius-badge)',
                background: 'transparent',
                color: 'var(--color-warning)',
                border: '1px solid var(--color-warning)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--color-warning)',
                }}
              />
              Open
            </span>
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 12,
              color: 'var(--color-text-secondary)',
            }}
          >
            {subtitle}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SaveIndicator state={saveState} lastSavedAt={lastSavedAt} />
          {/* Voice modality switch — same scope, different input
              surface. Outlined treatment in the brand accent so it
              reads as a secondary CTA next to Submit, not as a new
              destination. Disabled when there's nothing to count
              (an empty quick-flag set, for instance) since handing
              the voice flow an empty list would be confusing. */}
          {onUseVoice && (
            <button
              type="button"
              onClick={onUseVoice}
              disabled={items.length === 0}
              title={
                items.length === 0
                  ? 'Nothing to count yet.'
                  : 'Hand-free counting using the mic'
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 'var(--radius-item)',
                background: '#fff',
                color: items.length === 0
                  ? 'var(--color-text-secondary)'
                  : '#f55a00',
                border: items.length === 0
                  ? '1px solid var(--color-border)'
                  : '1px solid #f55a00',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: items.length === 0 ? 'not-allowed' : 'pointer',
                opacity: items.length === 0 ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              <Mic size={14} /> Use voice
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-item)',
              background: 'var(--color-accent-active)',
              color: 'var(--color-text-on-active)',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            Submit
          </button>
        </div>
      </header>

      {/* Location filter — segmented control, same shape as the
          Order History page's status tabs (bg-hover capsule, 3px inner
          padding, active segment gets the accent fill). Hidden for
          area/quick scopes since the scope already constrains the
          item set; showing tabs there would be confusing. */}
      {showLocationTabs && (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          role="tablist"
          style={{
            display: 'flex',
            background: 'var(--color-bg-hover)',
            borderRadius: 100,
            padding: 3,
            width: 'fit-content',
            maxWidth: '100%',
            overflowX: 'auto',
          }}
        >
          {locationGroups.map(({ location, items: locItems }) => {
            const active = location === activeLocation;
            return (
              <button
                key={location}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveLocation(location)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 100,
                  border: 'none',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: active
                    ? 'var(--color-accent-active)'
                    : 'transparent',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  transition: 'all 0.15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                {location}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: 100,
                    fontSize: 12,
                    fontWeight: 700,
                    background: active
                      ? 'rgba(255,255,255,0.25)'
                      : 'var(--color-border-subtle)',
                    color: active ? '#fff' : 'var(--color-text-secondary)',
                  }}
                >
                  {locItems.length}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          title="Edit items in this location (prototype — disabled)"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-item)',
            background: '#fff',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-primary)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Plus size={14} strokeWidth={2.4} /> Edit items
        </button>
      </div>
      )}

      {/* Items in the active section (location for full counts; the
          scoped set for area / quick counts). */}
      {displayItems.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-card)',
            color: 'var(--color-text-secondary)',
            fontSize: 13,
          }}
        >
          {scope.kind === 'quick'
            ? 'Nothing flagged right now — try a Full or Area count.'
            : scope.kind === 'group'
            ? 'This group has no items yet.'
            : 'No items configured for this scope.'}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 4px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span>
              {sectionLabel} · {countedInSection} of {displayItems.length}{' '}
              counted
            </span>
          </div>
          {displayItems.map(item => (
            <CountRow
              key={item.id}
              item={item}
              counts={counts}
              onChange={(unit, value) => setCount(item.id, unit, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SaveIndicator ────────────────────────────────────────────────────────────

function SaveIndicator({
  state,
  lastSavedAt,
}: {
  state: SaveState;
  lastSavedAt: Date | null;
}) {
  const isSaving = state === 'saving';
  // Tone: muted while saving, success-tinted once saved. Outlined treatment
  // matches the rest of the stock chips.
  const tone = isSaving
    ? 'var(--color-text-secondary)'
    : 'var(--color-success)';
  const label = isSaving
    ? 'Saving…'
    : lastSavedAt
      ? 'Saved'
      : 'No changes';
  return (
    <span
      title={lastSavedAt ? `Last saved ${lastSavedAt.toLocaleTimeString()}` : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 'var(--radius-item)',
        background: 'transparent',
        color: tone,
        border: `1px solid ${tone}`,
        fontFamily: 'var(--font-primary)',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {isSaving ? (
        <span
          style={{
            width: 10,
            height: 10,
            border: `2px solid ${tone}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'edify-spin 0.8s linear infinite',
          }}
        />
      ) : (
        <Check size={14} strokeWidth={2.6} />
      )}
      {label}
      <style>{'@keyframes edify-spin { to { transform: rotate(360deg); } }'}</style>
    </span>
  );
}

// ─── CountRow ────────────────────────────────────────────────────────────────

function CountRow({
  item,
  counts,
  onChange,
}: {
  item: StockItem;
  counts: Record<CountKey, string>;
  onChange: (unit: string, value: string) => void;
}) {
  const alternates = item.alternateUnits ?? [];
  const allUnits = [item.stockUnit, ...alternates];

  // Roll every cell on this row into a single quantity expressed in
  // the item's primary stockUnit. The rollup powers the "Count"
  // readout, the £-value line, and the variance — so an entry in any
  // unit (kg, g, bags, packs, loaves, …) influences the totals
  // exactly the same way the primary cell would.
  const rawByUnit: Record<string, string> = {};
  for (const u of allUnits) {
    rawByUnit[u] = counts[keyFor(item.id, u)] ?? '';
  }
  const rollup = rollupCounts(item, rawByUnit);

  const theoretical = item.theoreticalStock ?? item.currentStock;
  const variance = rollup.hasInput ? rollup.total - theoretical : null;
  const variancePct =
    rollup.hasInput && theoretical > 0
      ? Math.round((Math.abs(variance!) / theoretical) * 100)
      : null;

  const varianceTone = (() => {
    if (variancePct === null) return 'var(--color-text-secondary)';
    if (variancePct === 0) return 'var(--color-text-secondary)';
    if (variancePct < 10) return 'var(--color-info)';
    if (variancePct < 25) return 'var(--color-warning)';
    return 'var(--color-error)';
  })();

  const rowCounted = rollup.hasInput;

  return (
    <article
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 14,
        padding: '14px 16px',
        background: '#fff',
        border: rowCounted
          ? '1px solid var(--color-success)'
          : '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      {/* Left — title + UOM inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            <ChevronDown size={14} color="var(--color-text-secondary)" />
            {item.name} {item.variant && (
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                {item.variant}
              </span>
            )}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {item.supplierName}
          </div>
        </div>

        {/* UOM-aware input strip. Each available unit is its own
            discrete pill (no shared container) so a row with three
            options reads as three separate decisions. The pill's tone
            is driven by the *kind* of unit (count / mass / volume) —
            it lets the operator scan a multi-UOM row and pick the
            unit they're holding without reading every label. */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'stretch',
          }}
        >
          {allUnits.map(unit => (
            <UnitInput
              key={unit}
              unit={unit}
              value={counts[keyFor(item.id, unit)] ?? ''}
              onChange={v => onChange(unit, v)}
            />
          ))}
        </div>
      </div>

      {/* Right — category badge sitting above the Count / Theoretical
          pair, with variance underneath. Count and Theoretical share
          the same scale (label 11px / value 18px-700) so the eye
          treats them as a directly-comparable pair: the operator's
          tally vs. what the system thought was there. Count rolls up
          every UOM cell on the row (kg, g, bags, packs, …) into a
          single quantity in the item's primary stockUnit so an entry
          in any unit moves the dial. £-value line below count shows
          the live cash equivalent. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 8,
          minWidth: 140,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-secondary)',
          }}
        >
          {item.category} · {formatPrice(item.unitPrice, item.stockUnit)}
        </span>

        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start',
            textAlign: 'right',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: rollup.hasInput
                  ? 'var(--color-success)'
                  : 'var(--color-text-secondary)',
              }}
            >
              Count
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1.15,
                color: rollup.hasInput
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              {rollup.hasInput ? formatStock(rollup.total, item.stockUnit) : '—'}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              {rollup.hasInput && item.unitPrice != null
                ? `${formatPrice(rollup.total * item.unitPrice)} counted`
                : '— counted'}
              {rollup.hasUnconvertible ? ' · entry skipped' : ''}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--color-text-secondary)',
              }}
            >
              Theoretical
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1.15,
                color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap',
              }}
            >
              {item.theoreticalStock !== null
                ? formatStock(theoretical, item.stockUnit)
                : '—'}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: varianceTone,
                whiteSpace: 'nowrap',
              }}
            >
              {variance === null
                ? '—'
                : Math.abs(variance) < 0.01
                  ? 'on target'
                  : `${variance > 0 ? '+' : '−'}${Math.abs(variance).toFixed(1)} ${item.stockUnit}${
                      variancePct !== null ? ` · ${variancePct}%` : ''
                    }`}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

// UnitInput moved to ./UnitInput.tsx so the inline quick-count panel
// in the item detail drawer can reuse the same control.

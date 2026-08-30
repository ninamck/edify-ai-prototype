'use client';

/**
 * Site setup · step 4 — ranges and tiers.
 *
 * The model: a tier is a floor, not a folder. Tiers are ordered
 * supersets — tier 4 contains everything tier 3 does, plus more — so
 * a shop's food is two choices: its range, and a tier per day of the
 * week. Picking a tier gives the shop that whole menu; recipes are
 * never assigned to a site by hand. Counts are shown live so the
 * consequence of every pick is visible (blast radius in recipes, not
 * tier numbers).
 *
 * Interaction: select days (or a quick group), then tap a tier.
 * Patterns arrive prefilled from the copied shop; everything stays
 * editable.
 */

import { useState } from 'react';
import { Layers } from 'lucide-react';
import CardShell, { PillRow } from './CardShell';
import type { CardState } from './CardShell';
import {
  DAY_KEYS,
  RANGES,
  describeRecipeCounts,
  getRange,
  getWorkdaySite,
  recipesAtTier,
  type DayKey,
} from '../siteSetupFixtures';

export type TierPatterns = Record<string, Record<DayKey, number>>;
export type RangeChoices = Record<string, string>;

interface SiteSetupRangeTiersCardProps {
  state: CardState;
  siteIds: string[];
  /** Prefilled from the copied template shop. */
  initialRanges: RangeChoices;
  initialTiers: TierPatterns;
  onSubmit: (input: { rangeIds: RangeChoices; tiers: TierPatterns }) => void;
  onCancel: () => void;
  /** Reopen for edits after confirm — available until final go-live. */
  onEdit?: () => void;
}

export default function SiteSetupRangeTiersCard({
  state,
  siteIds,
  initialRanges,
  initialTiers,
  onSubmit,
  onCancel,
  onEdit,
}: SiteSetupRangeTiersCardProps) {
  const [rangeIds, setRangeIds] = useState<RangeChoices>(initialRanges);
  const [tiers, setTiers] = useState<TierPatterns>(initialTiers);
  /** Per-site set of selected days awaiting a tier pick. */
  const [selectedDays, setSelectedDays] = useState<Record<string, DayKey[]>>({});

  const disabled = state !== 'pending';

  function toggleDay(siteId: string, day: DayKey) {
    setSelectedDays((prev) => {
      const cur = prev[siteId] ?? [];
      return {
        ...prev,
        [siteId]: cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day],
      };
    });
  }

  function selectGroup(siteId: string, days: DayKey[]) {
    setSelectedDays((prev) => {
      const cur = prev[siteId] ?? [];
      const same = cur.length === days.length && days.every((d) => cur.includes(d));
      return { ...prev, [siteId]: same ? [] : days };
    });
  }

  /** Days stay selected after a tier pick so the chosen pill stays
   *  lit — clearing them made the selection invisible the moment it
   *  was made. */
  function applyTier(siteId: string, tier: number) {
    const days = selectedDays[siteId] ?? [];
    if (days.length === 0) return;
    setTiers((prev) => {
      const next = { ...(prev[siteId] ?? ({} as Record<DayKey, number>)) };
      for (const d of days) next[d] = tier;
      return { ...prev, [siteId]: next };
    });
  }

  return (
    <CardShell
      icon={Layers}
      title="Ranges and tiers"
      subtitle="A tier is a floor: it includes every tier below it"
      state={state}
      confirmLabel="Continue"
      onCancel={onCancel}
      onEdit={onEdit}
      onConfirm={() => onSubmit({ rangeIds, tiers })}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {siteIds.map((siteId) => {
          const site = getWorkdaySite(siteId);
          if (!site) return null;
          const rangeId = rangeIds[siteId];
          const range = getRange(rangeId);
          const pattern = tiers[siteId];
          if (!range || !pattern) return null;
          const days = selectedDays[siteId] ?? [];
          const tierCount = range.tierRecipes.length;

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
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', flex: 1 }}>
                  {site.shortName}
                </span>
                <PillRow
                  small
                  disabled={disabled}
                  options={RANGES.map((r) => ({ value: r.id, label: r.name }))}
                  selected={rangeId}
                  onSelect={(v) => setRangeIds((prev) => ({ ...prev, [siteId]: v }))}
                />
              </div>

              {/* Day strip — tap days, then tap a tier below. */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {DAY_KEYS.map((day) => {
                  const selected = days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleDay(siteId, day)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        padding: '6px 2px',
                        borderRadius: '10px',
                        border: selected
                          ? '1.5px solid var(--color-accent-active, #001C35)'
                          : '1.5px solid var(--color-border, rgba(0,28,53,0.14))',
                        background: selected ? 'rgba(0,28,53,0.05)' : '#fff',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                        {day}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {pattern[day]}
                      </span>
                      <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {recipesAtTier(rangeId, pattern[day])}
                      </span>
                    </button>
                  );
                })}
              </div>

              {!disabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <GroupButton label="Mon–Thu" onClick={() => selectGroup(siteId, ['Mon', 'Tue', 'Wed', 'Thu'])} />
                  <GroupButton label="Fri–Sun" onClick={() => selectGroup(siteId, ['Fri', 'Sat', 'Sun'])} />
                  <GroupButton label="All week" onClick={() => selectGroup(siteId, [...DAY_KEYS])} />
                  <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
                    {days.length === 0 ? 'Pick days, then a tier' : `Set ${days.length} day${days.length === 1 ? '' : 's'} to:`}
                  </span>
                </div>
              )}

              {/* Tier ladder — cumulative counts, delta vs the tier
                  below. A pill lights up when it's the tier every
                  selected day sits on, so tapping a day answers
                  "which tier is this?" at a glance. */}
              {!disabled && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {Array.from({ length: tierCount }, (_, i) => i + 1).map((tier) => {
                    const count = recipesAtTier(rangeId, tier);
                    const delta = tier > 1 ? count - recipesAtTier(rangeId, tier - 1) : null;
                    const canApply = days.length > 0;
                    const active = canApply && days.every((d) => pattern[d] === tier);
                    return (
                      <button
                        key={tier}
                        type="button"
                        disabled={!canApply}
                        onClick={() => applyTier(siteId, tier)}
                        title={delta !== null ? `Everything in tier ${tier - 1}, plus ${delta} more` : 'The core menu — every shop makes at least this'}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '1px',
                          padding: '5px 10px',
                          borderRadius: '10px',
                          border: active
                            ? '1.5px solid var(--color-accent-active, #001C35)'
                            : '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                          background: active ? 'var(--color-accent-active, #001C35)' : '#fff',
                          cursor: canApply ? 'pointer' : 'not-allowed',
                          opacity: canApply ? 1 : 0.5,
                          fontFamily: 'var(--font-primary)',
                        }}
                      >
                        <span style={{ fontSize: '11px', fontWeight: 700, color: active ? '#fff' : 'var(--color-text-primary)' }}>
                          Tier {tier}
                        </span>
                        <span style={{ fontSize: '10px', color: active ? 'rgba(255,255,255,0.75)' : 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {count}{delta !== null ? ` (+${delta})` : ' recipes'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                {describeRecipeCounts(rangeId, pattern)}
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Recipes come with the tier. Nothing to assign by hand.
        </div>
      </div>
    </CardShell>
  );
}

function GroupButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: '100px',
        border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
        background: '#fff',
        fontSize: '11px',
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

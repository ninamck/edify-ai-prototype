'use client';

/**
 * Site setup · step 3 — ranges and tiers.
 *
 * The model: a tier is a floor, not a folder. Tiers are ordered
 * supersets — tier 4 contains everything tier 3 does, plus more — so
 * a shop's food is two choices: its range, and a tier per day of the
 * week. Picking a tier gives the shop that whole menu; recipes are
 * never assigned to a site by hand (Wojciech, Pret: "assign the range
 * and tier to the shop and the recipes follow"). Counts are shown live
 * so the consequence of every pick is visible.
 *
 * Range is a searchable dropdown: Pret runs many ranges, so a pill
 * row would not scale. A day always has one tier; a shop can sit on
 * different tiers on different days (Natalia, Pret).
 *
 * Dated changes: a shop can move tier for a period and revert (Crown
 * Passage: Tier 2 Mon–Fri, Tier 1 for August). Each change is an
 * effective-from / effective-to window with its own day → tier
 * pattern, added per shop below the regular pattern.
 *
 * Interaction: select days (or a quick group), then tap a tier.
 * Patterns arrive prefilled from the copied shop; everything stays
 * editable.
 */

import { useEffect, useRef, useState } from 'react';
import { CalendarRange, ChevronDown, Layers, Plus, Search, Trash2 } from 'lucide-react';
import CardShell from './CardShell';
import type { CardState } from './CardShell';
import {
  DAY_KEYS,
  RANGES,
  addDays,
  describeRecipeCounts,
  describeTierPattern,
  formatDateRange,
  getRange,
  getNewSite,
  recipesAtTier,
  type DayKey,
  type TierSchedule,
  type TierSchedules,
} from '../siteSetupFixtures';

export type TierPatterns = Record<string, Record<DayKey, number>>;
export type RangeChoices = Record<string, string>;

interface SiteSetupRangeTiersCardProps {
  state: CardState;
  siteIds: string[];
  /** Prefilled from the copied template shop. */
  initialRanges: RangeChoices;
  initialTiers: TierPatterns;
  initialSchedules?: TierSchedules;
  onSubmit: (input: { rangeIds: RangeChoices; tiers: TierPatterns; tierSchedules: TierSchedules }) => void;
  onCancel: () => void;
  /** Reopen for edits after confirm — available until final go-live. */
  onEdit?: () => void;
}

export default function SiteSetupRangeTiersCard({
  state,
  siteIds,
  initialRanges,
  initialTiers,
  initialSchedules,
  onSubmit,
  onCancel,
  onEdit,
}: SiteSetupRangeTiersCardProps) {
  const [rangeIds, setRangeIds] = useState<RangeChoices>(initialRanges);
  const [tiers, setTiers] = useState<TierPatterns>(initialTiers);
  const [schedules, setSchedules] = useState<TierSchedules>(() => {
    const map: TierSchedules = {};
    for (const id of siteIds) {
      map[id] = (initialSchedules?.[id] ?? []).map((s) => ({ ...s, tiers: { ...s.tiers } }));
    }
    return map;
  });

  const scheduleSeq = useRef(0);

  const disabled = state !== 'pending';

  function addSchedule(siteId: string) {
    const site = getNewSite(siteId);
    // Default to a month starting the week after opening, on the tier
    // below the shop's usual weekday tier: the common summer dip.
    const base = tiers[siteId];
    const from = site ? addDays(site.openingDate, 7) : '2026-11-01';
    const to = addDays(from, 30);
    const dropped = Object.fromEntries(
      DAY_KEYS.map((d) => [d, Math.max(1, (base?.[d] ?? 1) - 1)]),
    ) as Record<DayKey, number>;
    scheduleSeq.current += 1;
    const id = `sched-${siteId}-${scheduleSeq.current}`;
    setSchedules((prev) => ({
      ...prev,
      [siteId]: [...(prev[siteId] ?? []), { id, from, to, tiers: dropped }],
    }));
  }

  function patchSchedule(siteId: string, scheduleId: string, patch: Partial<TierSchedule>) {
    setSchedules((prev) => ({
      ...prev,
      [siteId]: (prev[siteId] ?? []).map((s) => (s.id === scheduleId ? { ...s, ...patch } : s)),
    }));
  }

  function removeSchedule(siteId: string, scheduleId: string) {
    setSchedules((prev) => ({ ...prev, [siteId]: (prev[siteId] ?? []).filter((s) => s.id !== scheduleId) }));
  }

  const totalSchedules = siteIds.reduce((n, id) => n + (schedules[id]?.length ?? 0), 0);

  return (
    <CardShell
      icon={Layers}
      title="Ranges and tiers"
      subtitle={`A tier is a floor: it includes every tier below it${totalSchedules ? ` · ${totalSchedules} dated change${totalSchedules === 1 ? '' : 's'}` : ''}`}
      state={state}
      confirmLabel="Continue"
      onCancel={onCancel}
      onEdit={onEdit}
      onConfirm={() => onSubmit({ rangeIds, tiers, tierSchedules: schedules })}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {siteIds.map((siteId) => {
          const site = getNewSite(siteId);
          if (!site) return null;
          const rangeId = rangeIds[siteId];
          const range = getRange(rangeId);
          const pattern = tiers[siteId];
          if (!range || !pattern) return null;
          const siteSchedules = schedules[siteId] ?? [];

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', flex: 1 }}>
                  {site.shortName}
                </span>
                <RangeDropdown
                  value={rangeId}
                  disabled={disabled}
                  onChange={(v) => setRangeIds((prev) => ({ ...prev, [siteId]: v }))}
                />
              </div>

              <TierPatternEditor
                rangeId={rangeId}
                pattern={pattern}
                disabled={disabled}
                onChange={(next) => setTiers((prev) => ({ ...prev, [siteId]: next }))}
              />

              <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                {describeTierPattern(pattern)} · {describeRecipeCounts(rangeId, pattern)}
              </div>

              {/* Dated changes: a period on a different pattern, then back. */}
              {siteSchedules.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: '9px 10px',
                    borderRadius: '10px',
                    border: '1px dashed var(--color-border, rgba(0,28,53,0.22))',
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      <CalendarRange size={12} strokeWidth={2.2} style={{ color: 'var(--color-text-muted)' }} />
                      Dated change
                    </span>
                    <label style={dateLabel}>
                      From
                      <input
                        type="date"
                        value={s.from}
                        disabled={disabled}
                        onChange={(e) => patchSchedule(siteId, s.id, { from: e.target.value })}
                        style={dateInput}
                      />
                    </label>
                    <label style={dateLabel}>
                      To
                      <input
                        type="date"
                        value={s.to}
                        disabled={disabled}
                        min={s.from}
                        onChange={(e) => patchSchedule(siteId, s.id, { to: e.target.value })}
                        style={dateInput}
                      />
                    </label>
                    <span style={{ flex: 1 }} />
                    {!disabled && (
                      <button
                        type="button"
                        aria-label="Remove dated change"
                        onClick={() => removeSchedule(siteId, s.id)}
                        style={{ border: 'none', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '2px', display: 'inline-flex' }}
                      >
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                  <TierPatternEditor
                    rangeId={rangeId}
                    pattern={s.tiers}
                    disabled={disabled}
                    compact
                    onChange={(next) => patchSchedule(siteId, s.id, { tiers: next })}
                  />
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    {describeTierPattern(s.tiers)} · {formatDateRange(s.from, s.to)} · then back to {describeTierPattern(pattern).toLowerCase()}
                  </div>
                </div>
              ))}

              {!disabled && (
                <button
                  type="button"
                  onClick={() => addSchedule(siteId)}
                  style={{
                    alignSelf: 'flex-start',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 11px',
                    borderRadius: '100px',
                    border: '1.5px dashed var(--color-border, rgba(0,28,53,0.22))',
                    background: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={12} strokeWidth={2.4} />
                  Add a dated change
                </button>
              )}
            </div>
          );
        })}
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
          Recipes come with the tier and show on every production run. The forecast decides which run. Nothing to assign by hand.
        </div>
      </div>
    </CardShell>
  );
}

// ─── Tier pattern editor ─────────────────────────────────────────────────────

function TierPatternEditor({
  rangeId,
  pattern,
  disabled,
  compact,
  onChange,
}: {
  rangeId: string;
  pattern: Record<DayKey, number>;
  disabled: boolean;
  compact?: boolean;
  onChange: (next: Record<DayKey, number>) => void;
}) {
  const range = getRange(rangeId);
  const [days, setDays] = useState<DayKey[]>([]);
  if (!range) return null;
  const tierCount = range.tierRecipes.length;

  function toggleDay(day: DayKey) {
    setDays((cur) => (cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day]));
  }
  function selectGroup(group: DayKey[]) {
    setDays((cur) => {
      const same = cur.length === group.length && group.every((d) => cur.includes(d));
      return same ? [] : group;
    });
  }
  /** Days stay selected after a tier pick so the chosen pill stays
   *  lit — clearing them made the selection invisible the moment it
   *  was made. */
  function applyTier(tier: number) {
    if (days.length === 0) return;
    const next = { ...pattern };
    for (const d of days) next[d] = tier;
    onChange(next);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Day strip — tap days, then tap a tier below. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {DAY_KEYS.map((day) => {
          const selected = days.includes(day);
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => toggleDay(day)}
              aria-pressed={selected}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                padding: compact ? '4px 2px' : '6px 2px',
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
              <span style={{ fontSize: compact ? '13px' : '14px', fontWeight: 800, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {pattern[day]}
              </span>
              {!compact && (
                <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {recipesAtTier(rangeId, pattern[day])}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!disabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <GroupButton label="Mon–Thu" onClick={() => selectGroup(['Mon', 'Tue', 'Wed', 'Thu'])} />
          <GroupButton label="Fri–Sun" onClick={() => selectGroup(['Fri', 'Sat', 'Sun'])} />
          <GroupButton label="All week" onClick={() => selectGroup([...DAY_KEYS])} />
          <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
            {days.length === 0 ? 'Pick days, then a tier' : `Set ${days.length} day${days.length === 1 ? '' : 's'} to:`}
          </span>
        </div>
      )}

      {/* Tier ladder — cumulative counts, delta vs the tier below. A
          pill lights up when it's the tier every selected day sits on,
          so tapping a day answers "which tier is this?" at a glance. */}
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
                onClick={() => applyTier(tier)}
                aria-pressed={active}
                title={delta !== null ? `Everything in tier ${tier - 1}, plus ${delta} more` : 'The core menu — every shop makes at least this'}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1px',
                  padding: compact ? '4px 9px' : '5px 10px',
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
    </div>
  );
}

// ─── Range dropdown ──────────────────────────────────────────────────────────

function RangeDropdown({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (rangeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const current = getRange(value);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = RANGES.filter((r) => !q || r.name.toLowerCase().includes(q) || r.descriptor.toLowerCase().includes(q));

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Range: ${current?.name ?? 'none'}`}
        onClick={() => {
          setOpen((v) => !v);
          setQuery('');
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 8px 5px 11px',
          borderRadius: '10px',
          border: open
            ? '1.5px solid var(--color-accent-active, #001C35)'
            : '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
          background: '#fff',
          cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'var(--font-primary)',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {current?.name ?? 'Choose a range'}
          </span>
          {current && (
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
              {current.descriptor} · {current.tierRecipes.length} tiers
            </span>
          )}
        </span>
        <ChevronDown size={13} color="var(--color-text-muted)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s' }} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Ranges"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            zIndex: 20,
            width: '280px',
            borderRadius: '12px',
            border: '1.5px solid var(--color-border, rgba(0,28,53,0.14))',
            background: '#fff',
            boxShadow: '0 10px 30px rgba(0,28,53,0.16)',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderBottom: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))' }}>
            <Search size={12} color="var(--color-text-muted)" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${RANGES.length} ranges`}
              aria-label="Search ranges"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '12px', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', background: 'transparent' }}
            />
          </div>
          <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '4px' }}>
            {matches.length === 0 && (
              <div style={{ padding: '10px', fontSize: '11.5px', color: 'var(--color-text-muted)' }}>No range matches.</div>
            )}
            {matches.map((r) => {
              const selected = r.id === value;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(r.id);
                    setOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '1px',
                    padding: '7px 9px',
                    borderRadius: '8px',
                    border: 'none',
                    background: selected ? 'rgba(0,28,53,0.06)' : 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{r.name}</span>
                  <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
                    {r.descriptor} · {r.tierRecipes.length} tiers · up to {r.tierRecipes[r.tierRecipes.length - 1]} recipes
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────────

const dateLabel: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
};

const dateInput: React.CSSProperties = {
  padding: '3px 7px',
  borderRadius: '8px',
  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
  fontSize: '11.5px',
  fontWeight: 700,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  background: '#fff',
};

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

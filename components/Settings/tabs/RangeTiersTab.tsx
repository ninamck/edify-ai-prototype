'use client';

/**
 * RangeTiersTab — Quinn-led "proposed assortment" redesign.
 *
 * The previous Pret-shaped model — Range × Tier × per-site/per-DOW
 * assignment — is the part of setup managers actively dread (the user
 * literally called it "a nightmare to set up and keep updated"). Rather
 * than ship a v1 form for it, this tab inverts the flow:
 *
 *   1. Quinn proposes an assortment for THIS site, binned by time of day,
 *      using format + the recipe's selectionTags + a sprinkle of
 *      believable per-site rationale ("Top 3 in Corner format" /
 *      "Below 0.4/day at this site").
 *   2. The manager scans each slot and only intervenes where Quinn is
 *      wrong: each row toggles between Quinn / In / Out.
 *   3. Stats at the top tell you how many exceptions you've made; one
 *      click resets to Quinn.
 *
 * This is intentionally a UX prototype:
 *   - No edits to fixtures (Range / Tier / SiteTierAssignment).
 *   - No new slice on SiteSettingsOverlay; manager exceptions live in
 *     local component state and reset on reload. The Save bar in the
 *     editor shell stays out of this tab so we don't claim to persist
 *     something we don't yet wire into spoke order or amounts.
 *   - No bulk-across-sites or per-DOW variation in v1; both are
 *     signposted as "coming next" in the footer so the multi-site story
 *     is visible without us implementing it yet.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Sparkles, RotateCcw, Check, X, Layers } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import StatusPill from '@/components/Production/StatusPill';
import { SelectionTagChip } from '@/components/Production/RangeTierChips';
import {
  PRET_FORMATS,
  PRET_RECIPES,
  PRET_SITE_TIER_ASSIGNMENTS,
  getSite,
  type ProductionRecipe,
  type RecipeId,
  type SelectionTag,
  type SiteId,
} from '@/components/Production/fixtures';
import { Section, type TabProps } from './_shared';

// ─── Slot model ──────────────────────────────────────────────────────────────

type SlotId = 'breakfast' | 'late-morning' | 'lunch' | 'afternoon';

const SLOTS: Array<{
  id: SlotId;
  label: string;
  window: string;
  /** Which selectionTag wins recipes into this slot (priority order). */
  matchTag: SelectionTag;
}> = [
  { id: 'breakfast',    label: 'Breakfast',    window: '06:00 – 10:00', matchTag: 'breakfast' },
  { id: 'late-morning', label: 'Late morning', window: '10:00 – 11:30', matchTag: 'morning' },
  { id: 'lunch',        label: 'Lunch',        window: '11:30 – 14:30', matchTag: 'midday' },
  { id: 'afternoon',    label: 'Afternoon',    window: '14:30 – close', matchTag: 'afternoon' },
];

/**
 * Bin each customer-facing recipe into exactly one slot using a fixed
 * priority order: breakfast → morning → midday → afternoon. A croissant
 * tagged ('breakfast', 'morning') lands in Breakfast; a muffin tagged
 * ('morning', 'midday', 'afternoon') lands in Late morning. Recipes
 * without any of those tags (sub-recipe fillings tagged only 'core',
 * end-of-day prep tagged only 'closing') are excluded — they're not
 * customer-facing assortment decisions.
 */
function slotForRecipe(recipe: ProductionRecipe): SlotId | null {
  for (const slot of SLOTS) {
    if (recipe.selectionTags.includes(slot.matchTag)) return slot.id;
  }
  return null;
}

// ─── Quinn's per-site proposal ──────────────────────────────────────────────

type Action = 'keep' | 'drop';

type Proposal = {
  recipeId: RecipeId;
  action: Action;
  reason: string;
};

type SlotProposal = {
  slot: SlotId;
  recipes: Proposal[];
};

/**
 * Deterministic 0–1 noise from a string seed. Lets per-(site, recipe)
 * "drop or keep" decisions stay stable across reloads without us
 * needing to author one fixture row per pair. FNV-1a — same shape as
 * the synthesiser used in salesActuals.ts.
 */
function seededNoise(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const KEEP_REASONS = [
  'Top 3 sellers in {format}',
  'Bestseller at this site',
  'Steady mover · ~12/day',
  'On Quinn\u2019s core list for {format}',
  'Strong margin · keep on shelf',
];

const DROP_REASONS = [
  'Below 0.4 units/day at this site',
  'Low sales pattern vs format peers',
  'Better fit for {otherFormat} sites',
  'Underperforms here · drops to clearance most days',
  'Last 30 days: 0 sold before 11:00',
];

function buildQuinnProposal(siteId: SiteId): SlotProposal[] {
  const site = getSite(siteId);
  const format = site ? PRET_FORMATS.find(f => f.id === site.formatId) : undefined;
  const otherFormat = PRET_FORMATS.find(f => f.id !== format?.id);

  const fmtName = format?.name ?? 'this format';
  const otherName = otherFormat?.name ?? 'the other format';

  // Per-site drop probability — hubs bake everything (drop nothing),
  // standalones / hybrids curate lightly, spokes drop more.
  const dropRate =
    !site || site.type === 'HUB'
      ? 0
      : site.type === 'SPOKE'
      ? 0.22
      : 0.12;

  const bins: Record<SlotId, Proposal[]> = {
    breakfast: [],
    'late-morning': [],
    lunch: [],
    afternoon: [],
  };

  for (const recipe of PRET_RECIPES) {
    const slot = slotForRecipe(recipe);
    if (!slot) continue;

    const noise = seededNoise(`${siteId}|${recipe.id}`);
    const action: Action = noise < dropRate ? 'drop' : 'keep';

    const pool = action === 'keep' ? KEEP_REASONS : DROP_REASONS;
    // Use a second hash so reason choice doesn't correlate 1:1 with
    // the keep/drop boundary — it would always read as the same line.
    const reasonNoise = seededNoise(`${recipe.id}|${siteId}`);
    const template = pool[Math.floor(reasonNoise * pool.length)];
    const reason = template
      .replace('{format}', fmtName)
      .replace('{otherFormat}', otherName);

    bins[slot].push({ recipeId: recipe.id, action, reason });
  }

  return SLOTS.map(s => ({
    slot: s.id,
    recipes: bins[s.id].sort((a, b) => {
      const ra = PRET_RECIPES.find(r => r.id === a.recipeId)?.name ?? '';
      const rb = PRET_RECIPES.find(r => r.id === b.recipeId)?.name ?? '';
      return ra.localeCompare(rb);
    }),
  }));
}

// ─── Component ───────────────────────────────────────────────────────────────

type ManagerOverride = 'in' | 'out';

export default function RangeTiersTab({ siteId, editing }: TabProps) {
  const site = getSite(siteId);
  const format = site ? PRET_FORMATS.find(f => f.id === site.formatId) : undefined;
  const hasTierAssignment = PRET_SITE_TIER_ASSIGNMENTS.some(a => a.siteId === siteId);

  // Sites without a tier assignment in fixtures (e.g. Shoreditch East,
  // Notting Hill West) get an empty-state until the manager asks Quinn
  // to draft a starter proposal. Once "generated" we use the same
  // buildQuinnProposal as everywhere else.
  const [generated, setGenerated] = useState<boolean>(hasTierAssignment);

  const proposals = useMemo(() => buildQuinnProposal(siteId), [siteId]);

  // Manager overrides — keyed off recipeId. The /settings page lets the
  // manager swap sites without remounting the tab, so we explicitly
  // clear overrides + reset the empty-state flag whenever siteId
  // changes. Otherwise switching from a customised site to a fresh one
  // would carry the previous site's exceptions across, which is both
  // wrong-feeling and wrong-stat-counting.
  const [overrides, setOverrides] = useState<Record<RecipeId, ManagerOverride>>({});
  useEffect(() => {
    setOverrides({});
    setGenerated(hasTierAssignment);
  }, [siteId, hasTierAssignment]);

  function setOverride(recipeId: RecipeId, next: ManagerOverride | null) {
    setOverrides(prev => {
      const copy = { ...prev };
      if (next === null) delete copy[recipeId];
      else copy[recipeId] = next;
      return copy;
    });
  }

  function resetAll() {
    setOverrides({});
  }

  // Compute live stats — use proposal as the source of truth and apply
  // the manager's overrides on top.
  const { inCount, outCount, exceptionCount } = useMemo(() => {
    let inC = 0;
    let outC = 0;
    let exc = 0;
    for (const slot of proposals) {
      for (const p of slot.recipes) {
        const ovr = overrides[p.recipeId];
        const effective: Action =
          ovr === 'in' ? 'keep' : ovr === 'out' ? 'drop' : p.action;
        if (effective === 'keep') inC += 1;
        else outC += 1;
        if (ovr && (ovr === 'in' ? 'keep' : 'drop') !== p.action) exc += 1;
      }
    }
    return { inCount: inC, outCount: outC, exceptionCount: exc };
  }, [proposals, overrides]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 980 }}>
      {/* ─── Header strip ────────────────────────────────────────────── */}
      <div
        style={{
          padding: '14px 16px',
          borderRadius: 'var(--radius-card)',
          background:
            'linear-gradient(135deg, var(--color-info-light) 0%, var(--color-bg-hover) 100%)',
          border: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--color-accent-active)',
            color: 'var(--color-text-on-active)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <EdifyMark size={18} color="var(--color-text-on-active)" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 240 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Quinn’s proposed assortment for {site?.name ?? siteId}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            Built from {format?.name ?? 'this site’s format'} defaults and the last
            30 days of sales here. Take it as-is or flip individual recipes In / Out
            — those are your manager exceptions, everything else stays on Quinn.
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            {format && <StatusPill tone="brand" label={format.name} size="xs" />}
            <StatusPill tone="neutral" label="Every day" size="xs" />
            <StatusPill tone="neutral" label="30-day sales window" size="xs" />
          </div>
        </div>
      </div>

      {/* ─── Empty state for un-tiered sites ─────────────────────────── */}
      {!generated ? (
        <Section
          title="Quinn hasn’t built a proposal for this site yet"
          description="Newly opened sites don’t have an assortment until Quinn drafts one. We can do that now using sales from comparable sites in the same format."
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setGenerated(true)}
              disabled={!editing}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: editing ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
                color: editing ? 'var(--color-text-on-active)' : 'var(--color-text-muted)',
                border: '1px solid transparent',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--font-primary)',
                cursor: editing ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Sparkles size={13} /> Generate Quinn’s starter proposal
            </button>
            {!editing && (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Switch to Edit mode in the header to generate.
              </span>
            )}
          </div>
        </Section>
      ) : (
        <>
          {/* ─── Hero stat row ───────────────────────────────────────── */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-border-subtle)',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <Stat label="On sale" value={inCount} tone="success" />
            <Divider />
            <Stat label="Off shelf" value={outCount} tone="muted" />
            <Divider />
            <Stat
              label="Manager exceptions"
              value={exceptionCount}
              tone={exceptionCount > 0 ? 'warning' : 'muted'}
              hint={exceptionCount === 0 ? 'All on Quinn’s proposal' : 'Different from Quinn'}
            />
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={resetAll}
              disabled={!editing || exceptionCount === 0}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: '#ffffff',
                color:
                  editing && exceptionCount > 0
                    ? 'var(--color-info)'
                    : 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'var(--font-primary)',
                cursor: editing && exceptionCount > 0 ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                opacity: editing && exceptionCount > 0 ? 1 : 0.55,
              }}
            >
              <RotateCcw size={12} /> Reset to Quinn
            </button>
          </div>

          {/* ─── Time-of-day slot panels ────────────────────────────── */}
          {proposals.map(s => {
            const slotMeta = SLOTS.find(x => x.id === s.slot)!;
            return (
              <SlotPanel
                key={`${siteId}-${s.slot}`}
                label={slotMeta.label}
                window={slotMeta.window}
                tag={slotMeta.matchTag}
                proposals={s.recipes}
                overrides={overrides}
                editing={editing}
                onChange={setOverride}
              />
            );
          })}

          {/* ─── Bulk actions footer ────────────────────────────────── */}
          <Section
            title="Bulk actions"
            description="Coming next — today exceptions only apply to this site."
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <BulkActionButton
                label={`Apply to all ${format?.name ?? 'format'} sites`}
                disabled
              />
              <BulkActionButton label="Copy from another site…" disabled />
              <BulkActionButton label="Set weekday vs weekend variation…" disabled />
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

// ─── Slot panel ──────────────────────────────────────────────────────────────

function SlotPanel({
  label,
  window: windowLabel,
  tag,
  proposals,
  overrides,
  editing,
  onChange,
}: {
  label: string;
  window: string;
  tag: SelectionTag;
  proposals: Proposal[];
  overrides: Record<RecipeId, ManagerOverride>;
  editing: boolean;
  onChange: (recipeId: RecipeId, next: ManagerOverride | null) => void;
}) {
  const inThisSlot = proposals.filter(p => {
    const ovr = overrides[p.recipeId];
    const effective: Action = ovr === 'in' ? 'keep' : ovr === 'out' ? 'drop' : p.action;
    return effective === 'keep';
  }).length;

  return (
    <Section
      title={label}
      description={windowLabel}
      rightSlot={
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SelectionTagChip tag={tag} />
          <StatusPill
            tone="neutral"
            label={`${inThisSlot} of ${proposals.length} on sale`}
            size="xs"
          />
        </div>
      }
    >
      {proposals.length === 0 ? (
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--color-bg-hover)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--color-text-muted)',
          }}
        >
          No recipes match this slot yet.
        </div>
      ) : (
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {proposals.map(p => (
            <RecipeAssortmentRow
              key={p.recipeId}
              proposal={p}
              override={overrides[p.recipeId]}
              editing={editing}
              onChange={next => onChange(p.recipeId, next)}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

// ─── Recipe row ──────────────────────────────────────────────────────────────

function RecipeAssortmentRow({
  proposal,
  override,
  editing,
  onChange,
}: {
  proposal: Proposal;
  override: ManagerOverride | undefined;
  editing: boolean;
  onChange: (next: ManagerOverride | null) => void;
}) {
  const recipe = PRET_RECIPES.find(r => r.id === proposal.recipeId);
  if (!recipe) return null;

  const effective: Action =
    override === 'in' ? 'keep' : override === 'out' ? 'drop' : proposal.action;
  const isException = override !== undefined;

  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1.6fr) auto',
        gap: 12,
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: 8,
        background: isException ? 'var(--color-warning-light)' : 'var(--color-bg-hover)',
        border: isException
          ? '1px solid var(--color-warning-border)'
          : '1px solid transparent',
        opacity: effective === 'drop' && !isException ? 0.7 : 1,
      }}
    >
      {/* Recipe meta */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: effective === 'drop' ? 'line-through' : 'none',
          }}
        >
          {recipe.name}
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontWeight: 700,
          }}
        >
          {recipe.category}
        </span>
      </div>

      {/* Quinn rationale */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <Layers size={12} color="var(--color-info)" style={{ flexShrink: 0 }} />
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={proposal.reason}
        >
          {proposal.action === 'keep' ? 'Quinn keeps' : 'Quinn drops'} · {proposal.reason}
        </span>
      </div>

      {/* Quinn / In / Out segmented control */}
      <SegmentedControl
        value={override ?? 'quinn'}
        quinnLabel={proposal.action === 'keep' ? 'On' : 'Off'}
        editing={editing}
        onChange={next => onChange(next === 'quinn' ? null : next)}
      />
    </li>
  );
}

// ─── Segmented control ──────────────────────────────────────────────────────

type SegValue = 'quinn' | 'in' | 'out';

function SegmentedControl({
  value,
  quinnLabel,
  editing,
  onChange,
}: {
  value: SegValue;
  /** What "Quinn" resolves to today — shown as the smaller subtitle. */
  quinnLabel: string;
  editing: boolean;
  onChange: (next: SegValue) => void;
}) {
  const options: Array<{ id: SegValue; label: string; icon?: ReactNode; sublabel?: string }> = [
    { id: 'quinn', label: 'Quinn', sublabel: quinnLabel, icon: <EdifyMark size={11} /> },
    { id: 'in',    label: 'On',    icon: <Check size={11} /> },
    { id: 'out',   label: 'Off',   icon: <X size={11} /> },
  ];
  return (
    <div
      role="radiogroup"
      style={{
        display: 'inline-flex',
        background: '#ffffff',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 2,
        gap: 2,
      }}
    >
      {options.map(o => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            disabled={!editing}
            onClick={() => onChange(o.id)}
            role="radio"
            aria-checked={active}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              background: active ? 'var(--color-accent-active)' : 'transparent',
              color: active
                ? 'var(--color-text-on-active)'
                : editing
                ? 'var(--color-text-secondary)'
                : 'var(--color-text-muted)',
              border: 'none',
              cursor: editing ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              minHeight: 26,
              whiteSpace: 'nowrap',
            }}
            title={o.sublabel ? `${o.label} (${o.sublabel})` : o.label}
          >
            {o.icon}
            {o.label}
            {o.sublabel && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  opacity: 0.7,
                }}
              >
                · {o.sublabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Stat tiles + small helpers ─────────────────────────────────────────────

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: 'success' | 'muted' | 'warning';
  hint?: string;
}) {
  const color =
    tone === 'success'
      ? 'var(--color-success)'
      : tone === 'warning'
      ? 'var(--color-warning)'
      : 'var(--color-text-secondary)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 90 }}>
      <span
        style={{
          fontSize: 22,
          fontWeight: 800,
          color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </span>
      {hint && (
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{hint}</span>
      )}
    </div>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      style={{ width: 1, height: 32, background: 'var(--color-border-subtle)' }}
    />
  );
}

function BulkActionButton({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        background: '#ffffff',
        color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
        border: '1px solid var(--color-border)',
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'var(--font-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {label}
    </button>
  );
}

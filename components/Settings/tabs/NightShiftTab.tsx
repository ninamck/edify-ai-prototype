'use client';

/**
 * NightShiftTab — Support Centre's night-shift rule editor (P128 / PAC191).
 *
 * Unlike the per-site tabs in this editor, the night-shift policy is
 * estate-wide: one canonical set of rules, set once at the Support
 * Centre, inherited by every site running night shift. This tab
 * therefore opts out of the editor shell's staged-overlay flow and
 * commits straight to `nightShiftPolicyStore` on its own Save button.
 *
 * The three knobs match the PRD:
 *   • Time window — when "night shift" runs (wraps midnight).
 *   • First-order SKU priority — the explicit sequence of long-ferment
 *     / long-cool items that must come off the bench first.
 *   • Category priority — fallback ordering for everything else; within
 *     a category the bench card sorts by shelf-life ascending (handled
 *     by BenchCardBoard.sortNightBucket).
 *
 * The bench board reads the live policy on next render (no full
 * reload), satisfying PAC070's "without manual reordering by the GM"
 * acceptance.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  ChevronDown,
  Moon,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import StatusPill from '@/components/Production/StatusPill';
import {
  benchesAt,
  PRET_RECIPES,
  PRET_SITES,
  type NightShiftPolicy,
  type ProductionRecipe,
  type SkuId,
} from '@/components/Production/fixtures';
import {
  countPolicyOverrides,
  DEFAULT_NIGHT_SHIFT_POLICY,
  useNightShiftPolicy,
} from '../nightShiftPolicyStore';
import { Section, TimeInput, type TabProps } from './_shared';

// ─── Recipe lookup helpers ───────────────────────────────────────────────────

/** First recipe row that maps to the given SKU. Used to render names. */
function recipeForSku(skuId: SkuId): ProductionRecipe | undefined {
  return PRET_RECIPES.find(r => r.skuId === skuId);
}

/** Pretty label for a SKU. Falls back to the raw id if unknown. */
function labelForSku(skuId: SkuId): string {
  return recipeForSku(skuId)?.name ?? skuId;
}

/** All SKUs we know about, sorted alphabetically by display name. */
function allKnownSkus(): SkuId[] {
  const seen = new Set<SkuId>();
  for (const r of PRET_RECIPES) {
    if (!seen.has(r.skuId)) seen.add(r.skuId);
  }
  return [...seen].sort((a, b) => labelForSku(a).localeCompare(labelForSku(b)));
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

export default function NightShiftTab({ editing }: TabProps) {
  const { policy: live, isOverridden, replace, reset } = useNightShiftPolicy();

  // Local staged copy — committed via the in-tab Save button. Refreshed
  // whenever the live policy changes from underneath (e.g. someone hit
  // Reset elsewhere) so the editor doesn't show ghosted "unsaved"
  // changes after an external reset.
  const [staged, setStaged] = useState<NightShiftPolicy>(live);
  useEffect(() => {
    setStaged(live);
  }, [live]);

  const [savedAt, setSavedAt] = useState<number | null>(null);

  const diffCount = useMemo(() => countStagedDiff(live, staged), [live, staged]);
  const overrideCount = useMemo(() => countPolicyOverrides(staged), [staged]);

  const knownSkus = useMemo(() => allKnownSkus(), []);
  const addableSkus = useMemo(
    () => knownSkus.filter(s => !staged.firstOrder.includes(s)),
    [knownSkus, staged.firstOrder],
  );

  // Site count is just a believable demo callout: how many sites in the
  // estate currently have a night-shift run on at least one bench. The
  // number is informational only — the policy applies wherever night
  // runs exist.
  const siteCount = useMemo(() => countSitesWithNightShift(), []);

  function patch(p: Partial<NightShiftPolicy>) {
    setStaged(prev => ({ ...prev, ...p }));
    setSavedAt(null);
  }

  function commit() {
    replace(staged);
    setSavedAt(Date.now());
  }

  function discard() {
    setStaged(live);
    setSavedAt(null);
  }

  function resetToDefaults() {
    reset();
    setStaged(DEFAULT_NIGHT_SHIFT_POLICY);
    setSavedAt(null);
  }

  // First-order list operations.
  function moveFirstOrder(idx: number, delta: -1 | 1) {
    setStaged(prev => {
      const next = [...prev.firstOrder];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...prev, firstOrder: next };
    });
    setSavedAt(null);
  }
  function removeFirstOrder(idx: number) {
    setStaged(prev => ({
      ...prev,
      firstOrder: prev.firstOrder.filter((_, i) => i !== idx),
    }));
    setSavedAt(null);
  }
  function addFirstOrder(skuId: SkuId) {
    setStaged(prev =>
      prev.firstOrder.includes(skuId)
        ? prev
        : { ...prev, firstOrder: [...prev.firstOrder, skuId] },
    );
    setSavedAt(null);
  }

  // Category priority list operations.
  function moveCategory(idx: number, delta: -1 | 1) {
    setStaged(prev => {
      const next = [...prev.categoryOrder];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...prev, categoryOrder: next };
    });
    setSavedAt(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 980 }}>
      {/* ─── Support Centre framing — the "set once" half of the story ─── */}
      <CentralHeader
        siteCount={siteCount}
        overrideCount={overrideCount}
        isOverridden={isOverridden}
      />

      {/* ─── Saved confirmation ──────────────────────────────────────── */}
      {savedAt && (
        <SavedBanner onDismiss={() => setSavedAt(null)} />
      )}

      {/* ─── Time window ─────────────────────────────────────────────── */}
      <Section
        title="Night-shift time window"
        description="Any run that starts inside this window is treated as a night-shift run. The window wraps midnight."
        rightSlot={
          <StatusPill
            tone="neutral"
            label={`${staged.nightStart} → ${staged.nightEnd}`}
            size="xs"
          />
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 16,
          }}
        >
          <Field label="Window starts">
            <TimeInput
              value={staged.nightStart}
              disabled={!editing}
              onChange={v => patch({ nightStart: v })}
            />
            <FieldHint>
              First run after this time is tagged as night shift. Default{' '}
              <strong>{DEFAULT_NIGHT_SHIFT_POLICY.nightStart}</strong>.
            </FieldHint>
          </Field>
          <Field label="Window ends">
            <TimeInput
              value={staged.nightEnd}
              disabled={!editing}
              onChange={v => patch({ nightEnd: v })}
            />
            <FieldHint>
              First run on or after this time is day shift (typically R1). Default{' '}
              <strong>{DEFAULT_NIGHT_SHIFT_POLICY.nightEnd}</strong>.
            </FieldHint>
          </Field>
        </div>
      </Section>

      {/* ─── First-order SKU priority ────────────────────────────────── */}
      <Section
        title="First-order priority"
        description="These SKUs come off the night-shift bench in this exact sequence. Long ferments and items that need to chill before assembly belong here."
        rightSlot={
          <StatusPill
            tone="brand"
            label={`${staged.firstOrder.length} item${staged.firstOrder.length === 1 ? '' : 's'}`}
            size="xs"
          />
        }
      >
        {staged.firstOrder.length === 0 ? (
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--color-bg-hover)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--color-text-muted)',
            }}
          >
            No first-order SKUs. The night-shift bench will fall back to
            category priority for every recipe.
          </div>
        ) : (
          <ol
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {staged.firstOrder.map((sku, idx) => (
              <FirstOrderRow
                key={sku}
                index={idx}
                total={staged.firstOrder.length}
                skuId={sku}
                editing={editing}
                onMoveUp={() => moveFirstOrder(idx, -1)}
                onMoveDown={() => moveFirstOrder(idx, 1)}
                onRemove={() => removeFirstOrder(idx)}
              />
            ))}
          </ol>
        )}

        <AddSkuPicker
          options={addableSkus}
          disabled={!editing || addableSkus.length === 0}
          onAdd={addFirstOrder}
        />
      </Section>

      {/* ─── Category priority ───────────────────────────────────────── */}
      <Section
        title="Category priority"
        description="Fallback ordering for night-shift recipes that aren't in the first-order list. Within a category, the most fragile items (shortest shelf life) finish closest to the day shift handover."
      >
        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {staged.categoryOrder.map((cat, idx) => (
            <CategoryRow
              key={cat}
              index={idx}
              total={staged.categoryOrder.length}
              category={cat}
              editing={editing}
              onMoveUp={() => moveCategory(idx, -1)}
              onMoveDown={() => moveCategory(idx, 1)}
            />
          ))}
        </ol>
      </Section>

      {/* ─── In-tab save/discard/reset ───────────────────────────────── */}
      <CommitBar
        diffCount={diffCount}
        canSave={editing && diffCount > 0}
        canDiscard={editing && diffCount > 0}
        canReset={editing && (isOverridden || diffCount > 0)}
        onSave={commit}
        onDiscard={discard}
        onResetDefaults={resetToDefaults}
      />

      {!editing && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-bg-hover)',
            border: '1px dashed var(--color-border)',
            color: 'var(--color-text-muted)',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          Tap <strong>Enable edit mode</strong> in the header to change the
          night-shift rules. Edits don&apos;t take effect until you Save.
        </div>
      )}
    </div>
  );
}

// ─── Central header ─────────────────────────────────────────────────────────

function CentralHeader({
  siteCount,
  overrideCount,
  isOverridden,
}: {
  siteCount: number;
  overrideCount: number;
  isOverridden: boolean;
}) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 'var(--radius-card)',
        background:
          'linear-gradient(135deg, rgba(0, 28, 53,0.06) 0%, var(--color-bg-hover) 100%)',
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
        <Moon size={16} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 240 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Night-shift rules · set centrally for the estate
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          Saved rules apply to every site running night shift. The bench card
          board reads this policy on next render — no full reload, no GM
          reordering on the floor.
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2, alignItems: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'var(--color-accent-active)',
              color: 'var(--color-text-on-active)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <Building2 size={10} /> Support Centre
          </span>
          <StatusPill
            tone="info"
            label={`Inherited by ${siteCount} site${siteCount === 1 ? '' : 's'}`}
            size="xs"
          />
          {isOverridden ? (
            <StatusPill
              tone="info"
              label={`${overrideCount} override${overrideCount === 1 ? '' : 's'} vs default`}
              size="xs"
            />
          ) : (
            <StatusPill tone="neutral" label="On factory defaults" size="xs" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── First-order row ─────────────────────────────────────────────────────────

function FirstOrderRow({
  index,
  total,
  skuId,
  editing,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  index: number;
  total: number;
  skuId: SkuId;
  editing: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const recipe = recipeForSku(skuId);
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: '36px minmax(0, 1fr) auto',
        gap: 12,
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: 8,
        background: 'var(--color-bg-hover)',
        border: '1px solid transparent',
      }}
    >
      <RankBadge index={index} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {labelForSku(skuId)}
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
          {recipe ? `${recipe.category} · ${skuId}` : skuId}
        </span>
      </div>
      <div style={{ display: 'inline-flex', gap: 4 }}>
        <ReorderButton
          direction="up"
          disabled={!editing || index === 0}
          onClick={onMoveUp}
        />
        <ReorderButton
          direction="down"
          disabled={!editing || index === total - 1}
          onClick={onMoveDown}
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={!editing}
          aria-label={`Remove ${labelForSku(skuId)}`}
          style={iconBtn(editing, 'danger')}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );
}

// ─── Category row ────────────────────────────────────────────────────────────

function CategoryRow({
  index,
  total,
  category,
  editing,
  onMoveUp,
  onMoveDown,
}: {
  index: number;
  total: number;
  category: ProductionRecipe['category'];
  editing: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: '36px minmax(0, 1fr) auto',
        gap: 12,
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: 8,
        background: 'var(--color-bg-hover)',
        border: '1px solid transparent',
      }}
    >
      <RankBadge index={index} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}
        >
          {category}
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
          Tie-break by shelf life, ascending
        </span>
      </div>
      <div style={{ display: 'inline-flex', gap: 4 }}>
        <ReorderButton
          direction="up"
          disabled={!editing || index === 0}
          onClick={onMoveUp}
        />
        <ReorderButton
          direction="down"
          disabled={!editing || index === total - 1}
          onClick={onMoveDown}
        />
      </div>
    </li>
  );
}

// ─── Rank + reorder controls ─────────────────────────────────────────────────

function RankBadge({ index }: { index: number }) {
  return (
    <span
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 800,
        color: 'var(--color-text-secondary)',
        fontVariantNumeric: 'tabular-nums',
      }}
      aria-label={`Position ${index + 1}`}
    >
      {index + 1}
    </span>
  );
}

function ReorderButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'up' | 'down';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'up' ? 'Move up' : 'Move down'}
      style={iconBtn(!disabled, 'neutral')}
    >
      {direction === 'up' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
    </button>
  );
}

function iconBtn(
  active: boolean,
  variant: 'neutral' | 'danger',
): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 6,
    background: '#ffffff',
    border: '1px solid var(--color-border)',
    color: !active
      ? 'var(--color-text-muted)'
      : variant === 'danger'
      ? 'var(--color-danger)'
      : 'var(--color-text-secondary)',
    cursor: active ? 'pointer' : 'not-allowed',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: active ? 1 : 0.55,
  };
}

// ─── Add SKU picker ──────────────────────────────────────────────────────────

function AddSkuPicker({
  options,
  disabled,
  onAdd,
}: {
  options: SkuId[];
  disabled: boolean;
  onAdd: (skuId: SkuId) => void;
}) {
  const [value, setValue] = useState<string>('');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        paddingTop: 4,
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <select
          value={value}
          disabled={disabled}
          onChange={e => setValue(e.target.value)}
          style={{
            appearance: 'none',
            padding: '8px 32px 8px 12px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: disabled ? 'var(--color-bg-hover)' : '#ffffff',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: disabled
              ? 'var(--color-text-muted)'
              : 'var(--color-text-primary)',
            minWidth: 260,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <option value="">
            {options.length === 0
              ? 'All known SKUs are already in the list'
              : 'Add a SKU to the first-order list…'}
          </option>
          {options.map(o => (
            <option key={o} value={o}>
              {labelForSku(o)}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          style={{
            position: 'absolute',
            right: 10,
            color: 'var(--color-text-muted)',
            pointerEvents: 'none',
          }}
        />
      </div>
      <button
        type="button"
        disabled={disabled || !value}
        onClick={() => {
          if (!value) return;
          onAdd(value as SkuId);
          setValue('');
        }}
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          background:
            disabled || !value
              ? 'var(--color-bg-hover)'
              : 'var(--color-accent-active)',
          color:
            disabled || !value
              ? 'var(--color-text-muted)'
              : 'var(--color-text-on-active)',
          border: '1px solid transparent',
          fontSize: 11,
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
          cursor: disabled || !value ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Plus size={12} /> Add
      </button>
    </div>
  );
}

// ─── Commit bar ──────────────────────────────────────────────────────────────

function CommitBar({
  diffCount,
  canSave,
  canDiscard,
  canReset,
  onSave,
  onDiscard,
  onResetDefaults,
}: {
  diffCount: number;
  canSave: boolean;
  canDiscard: boolean;
  canReset: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onResetDefaults: () => void;
}) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 10,
        padding: '12px 14px',
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        boxShadow: '0 -8px 24px rgba(0, 28, 53,0.04)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700 }}>
        {diffCount > 0
          ? `${diffCount} unsaved change${diffCount === 1 ? '' : 's'}`
          : 'No unsaved changes'}
      </span>
      <span
        style={{
          fontSize: 11,
          color: 'var(--color-text-muted)',
        }}
      >
        {diffCount > 0
          ? 'Saving applies on the next render across every site.'
          : 'These rules are live across the estate.'}
      </span>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onResetDefaults}
        disabled={!canReset}
        style={ghostBtn(canReset)}
        title="Roll the policy back to the seeded Pret defaults"
      >
        <RotateCcw size={12} /> Reset to defaults
      </button>
      <button
        type="button"
        onClick={onDiscard}
        disabled={!canDiscard}
        style={ghostBtn(canDiscard)}
      >
        Discard
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        style={primaryBtn(canSave)}
      >
        <CheckCircle2 size={12} /> Save central rules
        {diffCount > 0 ? ` (${diffCount})` : ''}
      </button>
    </div>
  );
}

function SavedBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="status"
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-success-light)',
        border: '1px solid var(--color-success-border)',
        color: 'var(--color-success)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <CheckCircle2 size={16} />
      <span style={{ fontSize: 12, fontWeight: 700 }}>
        Central rules saved. Every site running night shift now follows them.
      </span>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: '1px solid transparent',
          background: 'transparent',
          color: 'var(--color-success)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Field row helper (local — Section's children area) ──────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
      {children}
    </span>
  );
}

// ─── Diff + estate-rollup helpers ────────────────────────────────────────────

function countStagedDiff(
  base: NightShiftPolicy,
  staged: NightShiftPolicy,
): number {
  let n = 0;
  if (base.nightStart !== staged.nightStart) n += 1;
  if (base.nightEnd !== staged.nightEnd) n += 1;
  if (!arraysEqual(base.firstOrder, staged.firstOrder)) n += 1;
  if (!arraysEqual(base.categoryOrder, staged.categoryOrder)) n += 1;
  return n;
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Rough estate-wide rollup: how many sites currently have a bench whose
 * run schedule contains a night-shift start time (00:00–05:00 inclusive).
 * We don't run the full `isNightShiftHHMM(... policy)` against every
 * site's benches here because this number is just an informational
 * callout — the actual policy applies wherever night runs exist.
 */
function countSitesWithNightShift(): number {
  let n = 0;
  for (const site of PRET_SITES) {
    const hasNightRun = benchesAt(site.id).some(b =>
      (b.runs ?? []).some(r => {
        const start = parseInt(r.startTime.split(':')[0] ?? '0', 10);
        return start >= 0 && start < 5;
      }),
    );
    if (hasNightRun) n += 1;
  }
  return n;
}

// ─── Button styles ───────────────────────────────────────────────────────────

function ghostBtn(active: boolean): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: '#ffffff',
    color: active ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
    border: '1px solid var(--color-border)',
    cursor: active ? 'pointer' : 'not-allowed',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
    opacity: active ? 1 : 0.6,
  };
}

function primaryBtn(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: active ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
    color: active ? 'var(--color-text-on-active)' : 'var(--color-text-muted)',
    border: '1px solid transparent',
    cursor: active ? 'pointer' : 'not-allowed',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
    opacity: active ? 1 : 0.7,
  };
}

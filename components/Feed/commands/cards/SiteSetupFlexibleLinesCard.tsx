'use client';

/**
 * Site setup · step 4 — flexible lines.
 *
 * Recipes are not chosen per shop: they follow the range and tier set
 * in the step before. Every shop on London Worker Tier 4 makes the
 * same 228 recipes, with ingredients, yields, allergens and costs,
 * and each one shows on every production run (the forecast decides
 * which run; Hot Chef recipes go to the Hot Chef station). Wojciech
 * (Pret): "our goal is to standardise and control centrally."
 *
 * The one shop-level choice is flexible lines: products carrying the
 * Flexible tag that a shop may decide not to sell after talking to
 * ops. So each shop shows a locked line for its core range and a
 * short tickable list of the flexible lines inside its tiers, all
 * ticked by default. Untick to leave one out.
 *
 * When several shops sit on the same range and reach the same tier,
 * one shop's unticks can be applied to the others in a tap, because a
 * rollout batch usually drops the same things everywhere.
 */

import { useState } from 'react';
import { ChevronDown, Lock, Tag } from 'lucide-react';
import CardShell, { type CardState } from './CardShell';
import {
  RECIPE_CATEGORIES,
  coreRecipeCount,
  describeTierPattern,
  flexibleLines,
  getNewSite,
  getRange,
  maxTier,
  type DayKey,
  type RecipeExclusions,
  type ShopRecipe,
} from '../siteSetupFixtures';

interface SiteSetupFlexibleLinesCardProps {
  state: CardState;
  siteIds: string[];
  rangeIds: Record<string, string>;
  tiers: Record<string, Record<DayKey, number>>;
  initialExclusions?: RecipeExclusions;
  onSubmit: (input: { recipeExclusions: RecipeExclusions }) => void;
  onCancel: () => void;
  onEdit?: () => void;
}

export default function SiteSetupFlexibleLinesCard({
  state,
  siteIds,
  rangeIds,
  tiers,
  initialExclusions,
  onSubmit,
  onCancel,
  onEdit,
}: SiteSetupFlexibleLinesCardProps) {
  const disabled = state !== 'pending';
  const [excluded, setExcluded] = useState<Record<string, Set<string>>>(() => {
    const map: Record<string, Set<string>> = {};
    for (const id of siteIds) map[id] = new Set(initialExclusions?.[id] ?? []);
    return map;
  });
  const [openSite, setOpenSite] = useState<string | null>(siteIds.length === 1 ? siteIds[0] : null);

  function toggle(siteId: string, recipeId: string) {
    setExcluded((prev) => {
      const next = new Set(prev[siteId]);
      if (next.has(recipeId)) next.delete(recipeId); else next.add(recipeId);
      return { ...prev, [siteId]: next };
    });
  }
  function setAll(siteId: string, ids: string[], include: boolean) {
    setExcluded((prev) => {
      const next = new Set(prev[siteId]);
      for (const id of ids) {
        if (include) next.delete(id); else next.add(id);
      }
      return { ...prev, [siteId]: next };
    });
  }
  /** Same range, same highest tier → same flexible lines on offer. */
  function siblingsOf(siteId: string): string[] {
    return siteIds.filter(
      (id) => id !== siteId && rangeIds[id] === rangeIds[siteId] && maxTier(tiers[id]) === maxTier(tiers[siteId]),
    );
  }
  function copyExclusions(fromSiteId: string) {
    setExcluded((prev) => {
      const next = { ...prev };
      for (const id of siblingsOf(fromSiteId)) next[id] = new Set(prev[fromSiteId]);
      return next;
    });
  }

  const totalFlex = siteIds.reduce((n, id) => n + flexibleLines(tiers[id]).length, 0);
  const totalKept = siteIds.reduce((n, id) => n + flexibleLines(tiers[id]).length - excluded[id].size, 0);

  return (
    <CardShell
      icon={Tag}
      title="Flexible lines"
      subtitle={`${totalKept} of ${totalFlex} flexible lines across ${siteIds.length} shop${siteIds.length === 1 ? '' : 's'} · the rest of the menu is set by the tier`}
      state={state}
      confirmLabel="Continue"
      onCancel={onCancel}
      onEdit={onEdit}
      onConfirm={() => {
        const recipeExclusions: RecipeExclusions = {};
        for (const id of siteIds) recipeExclusions[id] = Array.from(excluded[id]);
        onSubmit({ recipeExclusions });
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {siteIds.map((siteId) => {
          const site = getNewSite(siteId);
          const range = getRange(rangeIds[siteId]);
          const pattern = tiers[siteId];
          if (!site || !range || !pattern) return null;
          const core = coreRecipeCount(range.id, pattern);
          const flex = flexibleLines(pattern);
          const ex = excluded[siteId];
          const kept = flex.length - ex.size;
          const isOpen = openSite === siteId;
          const siblings = siblingsOf(siteId);

          return (
            <div
              key={siteId}
              style={{
                borderRadius: '12px',
                border: isOpen
                  ? '1.5px solid var(--color-accent-active, #001C35)'
                  : '1.5px solid var(--color-border, rgba(0,28,53,0.14))',
                background: '#fff',
                overflow: 'hidden',
              }}
            >
              {/* Site header: locked core line + flexible count */}
              <button
                type="button"
                onClick={() => setOpenSite(isOpen ? null : siteId)}
                aria-expanded={isOpen}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {site.shortName}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', flexWrap: 'wrap' }}>
                    <Lock size={10} strokeWidth={2.4} />
                    {core} recipes from {range.name} · {describeTierPattern(pattern)}, set by the tier
                  </span>
                  <span style={{ display: 'block', fontSize: '11px', color: ex.size > 0 ? '#7A3800' : 'var(--color-text-muted)', marginTop: '2px', fontWeight: ex.size > 0 ? 700 : 500 }}>
                    {kept === flex.length ? `All ${flex.length}` : `${kept} of ${flex.length}`} flexible lines
                    {ex.size > 0 && ` · ${ex.size} unticked`}
                  </span>
                </span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '100px',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    background: ex.size > 0 ? 'rgba(0,28,53,0.06)' : 'rgba(45,106,79,0.12)',
                    color: ex.size > 0 ? 'var(--color-text-secondary)' : '#2D6A4F',
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {core - ex.size}
                </span>
                <ChevronDown
                  size={14}
                  color="var(--color-text-muted)"
                  style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s' }}
                />
              </button>

              {isOpen && (
                <div
                  style={{
                    borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
                    background: 'rgba(0,28,53,0.015)',
                    padding: '10px 12px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', flex: 1 }}>
                      Tagged Flexible in the range. Untick to leave one out of this shop.
                    </span>
                    {!disabled && (
                      <span style={{ display: 'inline-flex', gap: '4px', flexShrink: 0 }}>
                        <MiniBtn label="All" active={ex.size === 0} onClick={() => setAll(siteId, flex.map((r) => r.id), true)} />
                        <MiniBtn label="None" active={ex.size === flex.length && flex.length > 0} onClick={() => setAll(siteId, flex.map((r) => r.id), false)} />
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      borderRadius: '10px',
                      border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.10))',
                      background: '#fff',
                      overflow: 'hidden',
                    }}
                  >
                    {RECIPE_CATEGORIES.map((cat, ci) => {
                      const inCat = flex.filter((r) => r.category === cat);
                      if (inCat.length === 0) return null;
                      return (
                        <div key={cat} style={{ borderTop: ci === 0 ? 'none' : '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))', padding: '7px 10px 8px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                            {cat}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
                            {inCat.map((r) => (
                              <RecipeRow key={r.id} recipe={r} included={!ex.has(r.id)} disabled={disabled} onToggle={() => toggle(siteId, r.id)} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Batch shortcut: same unticks for every shop on this range and tier */}
                  {!disabled && siblings.length > 0 && ex.size > 0 && (
                    <button
                      type="button"
                      onClick={() => copyExclusions(siteId)}
                      style={{
                        alignSelf: 'flex-start',
                        padding: '6px 12px',
                        borderRadius: '100px',
                        border: '1.5px dashed var(--color-border, rgba(0,28,53,0.22))',
                        background: '#fff',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-primary)',
                        color: 'var(--color-text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      Untick the same {ex.size} for the other {siblings.length} shop{siblings.length === 1 ? '' : 's'} on {range.name} Tier {maxTier(pattern)}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
          Every recipe in the tier shows on every production run; the forecast decides which run. Hot Chef recipes go to the Hot Chef station. An unticked flexible line stays in the range and can be switched on later from the shop&rsquo;s settings.
        </div>
      </div>
    </CardShell>
  );
}

function RecipeRow({
  recipe,
  included,
  disabled,
  onToggle,
}: {
  recipe: ShopRecipe;
  included: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        padding: '4px 0',
        minWidth: 0,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={included}
        disabled={disabled}
        onChange={onToggle}
        style={{ accentColor: 'var(--color-accent-active, #001C35)', flexShrink: 0 }}
      />
      <span
        style={{
          fontSize: '11.5px',
          fontWeight: 500,
          color: included ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          textDecoration: included ? 'none' : 'line-through',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={`${recipe.name} · Tier ${recipe.tier}`}
      >
        {recipe.name}
      </span>
      <span style={{ fontSize: '9.5px', color: 'var(--color-text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        T{recipe.tier}
      </span>
    </label>
  );
}

function MiniBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '2px 8px',
        borderRadius: '100px',
        border: active
          ? '1.5px solid var(--color-accent-active, #001C35)'
          : '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
        background: active ? 'var(--color-accent-active, #001C35)' : '#fff',
        color: active ? '#fff' : 'var(--color-text-secondary)',
        fontSize: '10px',
        fontWeight: 700,
        fontFamily: 'var(--font-primary)',
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

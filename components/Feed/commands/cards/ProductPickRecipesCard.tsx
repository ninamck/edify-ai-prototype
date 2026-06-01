'use client';

import { useMemo, useState } from 'react';
import { ChefHat, Search, Check } from 'lucide-react';
import { useRecipes } from '@/components/Recipe/recipeStore';
import { findProduct } from '@/components/Suppliers/store';
import type { Recipe } from '@/components/Recipe/libraryFixtures';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import CardShell, { PillRow, type CardState } from './CardShell';

interface ProductPickRecipesCardProps {
  state: CardState;
  /** Which job the wizard is doing. */
  mode?: 'add' | 'replace';
  /** Required for replace mode — what we're swapping out. Unused in add mode. */
  oldProductId?: string;
  oldProductName?: string;
  newProductName: string;
  /** New product's unit type (from pack details). Used to seed the
   *  per-recipe quantity input in add mode. */
  newProductUnitType?: string;
  /** Pre-selection from earlier (e.g. if the user came back to edit
   *  this step). Empty by default — we compute the default set from
   *  the matching scan or the category heuristic. */
  initialSelectedIds?: string[];
  /** Add-mode pre-fill, when the operator came back to edit this step. */
  initialAddQty?: number;
  initialAddUom?: string;
  onConfirm: (input: {
    recipeIds: string[];
    totalMatched: number;
    addQty?: number;
    addUom?: string;
  }) => void;
  onCancel: () => void;
}

/**
 * Step 5 of the product wizard — pick the recipes affected by this
 * change. Two modes, sharing one UI:
 *
 * **Replace mode** — scan the recipe library for rows that use the
 *   old product, pre-select them, and let the operator uncheck any
 *   they want to skip. Matching is product-link → master-link →
 *   legacy-name (with confidence pills shown inline).
 *
 * **Add mode** — show every recipe, pre-select recipes in categories
 *   the new product is "naturally" associated with (e.g. an oat-milk
 *   SKU pre-selects Coffee + Tea recipes). The operator can search
 *   to find anything we missed. Also collects the per-recipe
 *   quantity to add.
 *
 * The card stays decoupled from the runner so it can be reused
 * later by other product flows (e.g. "discontinue X" or "audit which
 * recipes use Y").
 */
export default function ProductPickRecipesCard({
  state,
  mode = 'replace',
  oldProductId,
  oldProductName,
  newProductName,
  newProductUnitType,
  initialSelectedIds,
  initialAddQty,
  initialAddUom,
  onConfirm,
  onCancel,
}: ProductPickRecipesCardProps) {
  const recipes = useRecipes();
  const [query, setQuery] = useState<string>('');

  // ── Replace mode: scan recipes for rows that use the old product ──
  type MatchKind = 'product' | 'master' | 'name';
  interface RecipeMatch {
    recipe: Recipe;
    kind: MatchKind;
    matchedLabel: string;
  }
  const masterId = useMemo(
    () => (oldProductId ? findProduct(oldProductId)?.masterProductId : undefined),
    [oldProductId],
  );

  const replaceMatches = useMemo<RecipeMatch[]>(() => {
    if (mode !== 'replace' || !oldProductId || !oldProductName) return [];
    const out: RecipeMatch[] = [];
    const nameLower = oldProductName.toLowerCase();
    for (const r of recipes) {
      let hit: RecipeMatch | null = null;
      for (const row of r.ingredientsV2 ?? []) {
        if (row.ref.kind === 'product' && row.ref.productId === oldProductId) {
          hit = { recipe: r, kind: 'product', matchedLabel: oldProductName };
          break;
        }
        if (masterId && row.ref.kind === 'master' && row.ref.masterProductId === masterId) {
          hit = { recipe: r, kind: 'master', matchedLabel: oldProductName };
          break;
        }
        if (row.ref.kind === 'product' && masterId) {
          const linked = findProduct(row.ref.productId);
          if (linked?.masterProductId === masterId) {
            hit = { recipe: r, kind: 'master', matchedLabel: linked.name };
            break;
          }
        }
      }
      if (!hit) {
        for (const ing of r.ingredients ?? []) {
          const ingName = ing.name.toLowerCase();
          if (
            ingName.includes(nameLower) ||
            nameLower.split(/\s+/).every((tok) => tok.length > 2 && ingName.includes(tok))
          ) {
            hit = { recipe: r, kind: 'name', matchedLabel: ing.name };
            break;
          }
        }
      }
      if (hit) out.push(hit);
    }
    return out;
  }, [mode, recipes, oldProductId, oldProductName, masterId]);

  // ── Add mode: category-based "naturally-associated" recipes ──────
  //
  // Pure heuristic for the prototype — keyword → recipe categories
  // we'd reasonably expect the new product to appear in. Misses are
  // cheap because the operator can pick anything via search.
  const addSuggestedCategoryByKeyword: { match: RegExp; categories: string[] }[] = useMemo(
    () => [
      { match: /\b(milk|cream|oat\s*milk|almond\s*milk|soy\s*milk|coconut\s*milk)\b/i, categories: ['Coffee', 'Tea'] },
      { match: /\b(syrup|honey|sugar|sweetener|vanilla)\b/i, categories: ['Coffee', 'Tea'] },
      { match: /\b(flour|yeast|butter|sourdough)\b/i, categories: ['Pastry'] },
      { match: /\b(tomato|cheese|lettuce|sauce|herb|spice|olive\s*oil|vinegar)\b/i, categories: ['Food'] },
      { match: /\b(wine|grape|merlot|chardonnay|sauv\b|cabernet)\b/i, categories: ['Wine'] },
      { match: /\b(vodka|gin|rum|tequila|whiskey|bourbon)\b/i, categories: ['Spirits'] },
    ],
    [],
  );

  const suggestedCategories = useMemo<string[]>(() => {
    if (mode !== 'add') return [];
    const hay = `${newProductName}`;
    const hits = new Set<string>();
    for (const rule of addSuggestedCategoryByKeyword) {
      if (rule.match.test(hay)) rule.categories.forEach((c) => hits.add(c));
    }
    return [...hits];
  }, [mode, newProductName, addSuggestedCategoryByKeyword]);

  // The "candidate list" the picker walks through:
  //   • replace mode → just the matches (the only relevant recipes)
  //   • add mode     → every recipe
  const candidates = useMemo<RecipeMatch[]>(() => {
    if (mode === 'replace') return replaceMatches;
    return recipes.map((r) => ({ recipe: r, kind: 'name' as MatchKind, matchedLabel: '' }));
  }, [mode, recipes, replaceMatches]);

  // Default selection:
  //   • replace mode → all matches (operator unchecks what they don't want)
  //   • add mode     → recipes in suggested categories (if any) so the
  //                    "agent picked these" feeling holds. Otherwise nothing.
  const defaultSelected = useMemo(() => {
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      return new Set(initialSelectedIds);
    }
    if (mode === 'replace') {
      return new Set(replaceMatches.map((m) => m.recipe.id));
    }
    if (suggestedCategories.length === 0) return new Set<string>();
    return new Set(
      recipes
        .filter((r) => suggestedCategories.includes(r.category))
        .map((r) => r.id),
    );
  }, [initialSelectedIds, mode, replaceMatches, recipes, suggestedCategories]);

  const [selected, setSelected] = useState<Set<string>>(defaultSelected);

  // Add-mode quantity input.
  const [addQty, setAddQty] = useState<string>(
    initialAddQty != null ? String(initialAddQty) : mode === 'add' ? defaultAddQty(newProductName, newProductUnitType) : '',
  );
  const [addUom, setAddUom] = useState<string>(
    initialAddUom ?? newProductUnitType ?? defaultAddUom(newProductName),
  );

  // Category filter chips (add mode only). Builds the unique set of
  // categories present in the recipe library so the operator can
  // quickly scope to e.g. "just coffees".
  const categoryFilters = useMemo<string[]>(() => {
    if (mode !== 'add') return [];
    const seen = new Set<string>();
    for (const r of recipes) seen.add(r.category);
    return [...seen].sort();
  }, [mode, recipes]);
  const [activeCategory, setActiveCategory] = useState<string | 'all'>(
    suggestedCategories[0] ?? 'all',
  );

  const filtered = useMemo<RecipeMatch[]>(() => {
    const q = query.trim().toLowerCase();
    let list = candidates;
    if (mode === 'add' && activeCategory !== 'all') {
      list = list.filter((m) => m.recipe.category === activeCategory);
    }
    if (!q) return list;
    return list.filter(
      (m) =>
        m.recipe.name.toLowerCase().includes(q) ||
        m.recipe.category.toLowerCase().includes(q) ||
        m.matchedLabel.toLowerCase().includes(q),
    );
  }, [candidates, mode, activeCategory, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllInView() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const m of filtered) next.add(m.recipe.id);
      return next;
    });
  }
  function selectNoneInView() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const m of filtered) next.delete(m.recipe.id);
      return next;
    });
  }

  const selectedCount = selected.size;
  const totalCount = candidates.length;
  const matchCount = mode === 'replace' ? replaceMatches.length : suggestedCategories.length > 0
    ? recipes.filter((r) => suggestedCategories.includes(r.category)).length
    : 0;

  // Headlines
  const cardTitle = (() => {
    if (mode === 'replace') {
      return totalCount === 0
        ? `${oldProductName ?? 'That product'} isn't in any recipes`
        : `Swap into ${selectedCount} of ${totalCount} recipes`;
    }
    return selectedCount === 0
      ? `Pick recipes to add ${newProductName} to`
      : `Add ${newProductName} to ${selectedCount} recipe${selectedCount === 1 ? '' : 's'}`;
  })();
  const cardSubtitle = (() => {
    if (mode === 'replace') {
      return totalCount === 0
        ? "We'll just add the new product — no recipes to change"
        : `Pre-selected by what uses ${oldProductName ?? 'the old product'}`;
    }
    if (suggestedCategories.length > 0) {
      return `Pre-selected ${matchCount} ${suggestedCategories.join(' / ').toLowerCase()} recipes`;
    }
    return 'Filter or search to find the recipes';
  })();

  // Submit gating: in add mode, must have a sensible quantity (>0)
  // and at least one recipe selected (otherwise the wizard has
  // nothing to do — the operator should cancel instead).
  const addQtyNum = Number(addQty);
  const canSubmit = (() => {
    if (mode === 'replace') return true;
    if (selectedCount === 0) return false;
    return Number.isFinite(addQtyNum) && addQtyNum > 0;
  })();

  return (
    <CardShell
      icon={ChefHat}
      title={cardTitle}
      subtitle={cardSubtitle}
      state={state}
      confirmLabel={mode === 'replace' && totalCount === 0 ? 'Skip — just add the product' : 'Next'}
      confirmDisabled={!canSubmit}
      onCancel={onCancel}
      onConfirm={() =>
        onConfirm({
          recipeIds: Array.from(selected),
          totalMatched: mode === 'replace' ? totalCount : matchCount,
          ...(mode === 'add'
            ? { addQty: addQtyNum, addUom }
            : {}),
        })
      }
    >
      {mode === 'replace' && totalCount === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.45,
          }}
        >
          No active recipes reference {oldProductName}. We can still
          add {newProductName} to your catalogue — you can wire it
          into recipes later.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* ── Add-mode: per-recipe quantity ─────────────────────── */}
          {mode === 'add' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                background: '#fff',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-secondary)',
                  flexShrink: 0,
                }}
              >
                Per recipe
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={addQty}
                disabled={state !== 'pending'}
                onChange={(e) => setAddQty(e.target.value)}
                placeholder="200"
                style={{
                  width: '72px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--color-text-primary)',
                  background: '#fff',
                  outline: 'none',
                }}
              />
              <PillRow
                options={UOM_OPTIONS.map((u) => ({ value: u, label: u }))}
                selected={addUom}
                onSelect={(v) => setAddUom(String(v))}
                disabled={state !== 'pending'}
                small
              />
            </div>
          )}

          {/* ── Search toolbar ───────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '10px',
              border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
              background: '#fff',
            }}
          >
            <Search size={14} color="var(--color-text-muted)" />
            <input
              type="text"
              value={query}
              disabled={state !== 'pending'}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === 'add' ? 'Search all recipes…' : 'Filter recipes…'}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          {/* ── Add-mode: category chips ──────────────────────────── */}
          {mode === 'add' && categoryFilters.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <CategoryChip
                label="All"
                active={activeCategory === 'all'}
                suggested={false}
                disabled={state !== 'pending'}
                onClick={() => setActiveCategory('all')}
              />
              {categoryFilters.map((c) => (
                <CategoryChip
                  key={c}
                  label={c}
                  active={activeCategory === c}
                  suggested={suggestedCategories.includes(c)}
                  disabled={state !== 'pending'}
                  onClick={() => setActiveCategory(c)}
                />
              ))}
            </div>
          )}

          {/* ── "Agent picked these" callout ──────────────────────── */}
          {mode === 'replace' ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '10px',
                background: 'rgba(40,175,201,0.08)',
                border: '1px solid rgba(40,175,201,0.18)',
              }}
            >
              <EdifyMark size={14} color="var(--color-accent-mid, #28AFC9)" style={{ marginTop: '1px' }} />
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.45,
                }}
              >
                I found {totalCount} recipe{totalCount === 1 ? '' : 's'}{' '}
                using {oldProductName ?? 'the old product'} and
                pre-selected them. Uncheck any you&rsquo;d rather skip
                — name-only matches are flagged so you can
                double-check them.
              </div>
            </div>
          ) : suggestedCategories.length > 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '10px',
                background: 'rgba(40,175,201,0.08)',
                border: '1px solid rgba(40,175,201,0.18)',
              }}
            >
              <EdifyMark size={14} color="var(--color-accent-mid, #28AFC9)" style={{ marginTop: '1px' }} />
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.45,
                }}
              >
                {newProductName} looks like a {suggestedCategories.join(' / ').toLowerCase()} ingredient — I&rsquo;ve pre-selected the {matchCount}{' '}
                {suggestedCategories.join(' / ').toLowerCase()} recipe{matchCount === 1 ? '' : 's'} on your menu. Adjust as needed.
              </div>
            </div>
          ) : null}

          {/* ── List ─────────────────────────────────────────────── */}
          <div
            style={{
              borderRadius: '10px',
              border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
              overflow: 'hidden',
            }}
          >
            {/* Header strip: selection count + select-all / none.
                Sits flush with the list, sharing the border so the
                two read as one component. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '7px 12px',
                background: 'rgba(0,28,53,0.025)',
                borderBottom: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {selected.size} selected
                {filtered.length !== totalCount && state === 'pending' && (
                  <span
                    style={{
                      marginLeft: '6px',
                      fontWeight: 500,
                      letterSpacing: 0,
                      textTransform: 'none',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    · {filtered.length} shown
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  disabled={state !== 'pending'}
                  onClick={selectAllInView}
                  style={miniBtnStyle}
                >
                  All
                </button>
                <button
                  type="button"
                  disabled={state !== 'pending'}
                  onClick={selectNoneInView}
                  style={miniBtnStyle}
                >
                  None
                </button>
              </div>
            </div>

            <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div
                style={{
                  padding: '14px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  textAlign: 'center',
                }}
              >
                No recipes match that filter.
              </div>
            )}
            {filtered.map((m, i) => {
              const isSelected = selected.has(m.recipe.id);
              return (
                <button
                  key={m.recipe.id}
                  type="button"
                  disabled={state !== 'pending'}
                  onClick={() => toggle(m.recipe.id)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    border: 'none',
                    borderBottom:
                      i < filtered.length - 1
                        ? '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))'
                        : 'none',
                    background: 'transparent',
                    cursor: state === 'pending' ? 'pointer' : 'not-allowed',
                    textAlign: 'left',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '5px',
                      border: isSelected
                        ? '1.5px solid var(--color-accent-active, #001C35)'
                        : '1.5px solid var(--color-border, rgba(0,28,53,0.32))',
                      background: isSelected
                        ? 'var(--color-accent-active, #001C35)'
                        : '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.recipe.name}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        color: 'var(--color-text-muted)',
                        marginTop: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.recipe.category}
                      {mode === 'replace' && m.matchedLabel
                        ? ` · matched: ${m.matchedLabel}`
                        : ''}
                    </div>
                  </div>
                  {mode === 'replace' && <MatchPill kind={m.kind} />}
                </button>
              );
            })}
            </div>
          </div>
        </div>
      )}
    </CardShell>
  );
}

const UOM_OPTIONS = ['g', 'kg', 'ml', 'L', 'each'];

/** Pick a sensible default quantity when the operator hasn't typed
 *  one. Heuristic only — most coffee recipes use 150–200ml of milk,
 *  most pastry recipes use grams of dry goods, etc. */
function defaultAddQty(productName: string, unitType?: string): string {
  const n = productName.toLowerCase();
  if (/\b(milk|cream)\b/.test(n)) return '180';
  if (/\b(syrup|honey)\b/.test(n)) return '15';
  if (/\b(sugar|salt|spice)\b/.test(n)) return '5';
  if (unitType === 'g' || unitType === 'kg') return '20';
  if (unitType === 'ml' || unitType === 'L') return '100';
  return '1';
}

function defaultAddUom(productName: string): string {
  const n = productName.toLowerCase();
  if (/\b(milk|cream|syrup|sauce|juice|water|oil)\b/.test(n)) return 'ml';
  if (/\b(flour|sugar|salt|spice|cheese|coffee|tea)\b/.test(n)) return 'g';
  return 'each';
}

function CategoryChip({
  label,
  active,
  suggested,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  suggested: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '5px 10px',
        borderRadius: '100px',
        border: active
          ? '1.5px solid var(--color-accent-active, #001C35)'
          : suggested
          ? '1.5px solid var(--color-accent-mid, #28AFC9)'
          : '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
        background: active
          ? 'var(--color-accent-active, #001C35)'
          : suggested
          ? 'rgba(40,175,201,0.06)'
          : '#fff',
        color: active ? '#fff' : 'var(--color-text-secondary)',
        fontSize: '11.5px',
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {label}
      {suggested && !active && (
        <EdifyMark size={10} color="var(--color-accent-mid, #28AFC9)" />
      )}
    </button>
  );
}

function MatchPill({ kind }: { kind: 'product' | 'master' | 'name' }) {
  const styles: Record<
    typeof kind,
    { label: string; bg: string; color: string }
  > = {
    product: { label: 'Linked', bg: 'rgba(45,106,79,0.12)', color: '#2D6A4F' },
    master: { label: 'Same item', bg: 'rgba(45,106,79,0.10)', color: '#2D6A4F' },
    name: { label: 'Via name', bg: 'rgba(122,56,0,0.10)', color: '#7A3800' },
  };
  const s = styles[kind];
  return (
    <span
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: '100px',
        background: s.bg,
        color: s.color,
        fontSize: '10.5px',
        fontWeight: 700,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {s.label}
    </span>
  );
}

const miniBtnStyle: React.CSSProperties = {
  padding: '3px 9px',
  borderRadius: '6px',
  border: '1px solid transparent',
  background: 'transparent',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};

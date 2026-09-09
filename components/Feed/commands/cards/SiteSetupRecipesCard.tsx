'use client';

/**
 * Site setup · step 3 — the recipes that come with the copy.
 *
 * Each new shop copies its mirror shop's production recipes (~95):
 * what lands on the bench and the hot stations, plus barista drinks.
 * Everything is ticked by default; the operator unticks what the new
 * shop won't make. Ninety-odd rows would swamp the card, so:
 *
 *  - one dropdown per site, closed by default, showing the count
 *    ("93 of 95 recipes from Manchester Market Street");
 *  - inside, recipes grouped by category, each group closed by
 *    default with its own count and an All / None switch;
 *  - a search box that opens every group with a match.
 *
 * When several shops copy the same mirror, one shop's unticks can be
 * applied to the others in a tap, because a rollout batch usually
 * drops the same things everywhere.
 */

import { useState } from 'react';
import { BookOpen, ChevronDown, Search } from 'lucide-react';
import CardShell, { type CardState } from './CardShell';
import {
  RECIPE_CATEGORIES,
  getNewSite,
  getTemplateShop,
  templateRecipes,
  type RecipeCategory,
  type RecipeExclusions,
  type ShopRecipe,
} from '../siteSetupFixtures';

interface SiteSetupRecipesCardProps {
  state: CardState;
  siteIds: string[];
  /** Per site: the template shop it copies. */
  templates: Record<string, string>;
  initialExclusions?: RecipeExclusions;
  onSubmit: (input: { recipeExclusions: RecipeExclusions }) => void;
  onCancel: () => void;
  onEdit?: () => void;
}

export default function SiteSetupRecipesCard({
  state,
  siteIds,
  templates,
  initialExclusions,
  onSubmit,
  onCancel,
  onEdit,
}: SiteSetupRecipesCardProps) {
  const disabled = state !== 'pending';
  const [excluded, setExcluded] = useState<Record<string, Set<string>>>(() => {
    const map: Record<string, Set<string>> = {};
    for (const id of siteIds) map[id] = new Set(initialExclusions?.[id] ?? []);
    return map;
  });
  const [openSite, setOpenSite] = useState<string | null>(null);
  const [openCats, setOpenCats] = useState<Set<RecipeCategory>>(new Set());
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();

  function toggle(siteId: string, recipeId: string) {
    setExcluded((prev) => {
      const next = new Set(prev[siteId]);
      if (next.has(recipeId)) next.delete(recipeId); else next.add(recipeId);
      return { ...prev, [siteId]: next };
    });
  }
  function setCategory(siteId: string, ids: string[], include: boolean) {
    setExcluded((prev) => {
      const next = new Set(prev[siteId]);
      for (const id of ids) {
        if (include) next.delete(id); else next.add(id);
      }
      return { ...prev, [siteId]: next };
    });
  }
  function copyExclusions(fromSiteId: string) {
    const templateId = templates[fromSiteId];
    setExcluded((prev) => {
      const next = { ...prev };
      for (const id of siteIds) {
        if (id !== fromSiteId && templates[id] === templateId) next[id] = new Set(prev[fromSiteId]);
      }
      return next;
    });
  }

  const totalRecipes = siteIds.reduce((n, id) => n + templateRecipes(templates[id]).length, 0);
  const totalKept = siteIds.reduce((n, id) => n + templateRecipes(templates[id]).length - excluded[id].size, 0);

  return (
    <CardShell
      icon={BookOpen}
      title="Recipes that come with the copy"
      subtitle={`${totalKept} of ${totalRecipes} recipes across ${siteIds.length} shop${siteIds.length === 1 ? '' : 's'} · untick what a shop won\u2019t make`}
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
          const template = getTemplateShop(templates[siteId]);
          if (!site || !template) return null;
          const list = templateRecipes(template.id);
          const ex = excluded[siteId];
          const kept = list.length - ex.size;
          const isOpen = openSite === siteId;
          const siblings = siteIds.filter((id) => id !== siteId && templates[id] === template.id);

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
              {/* Site dropdown header */}
              <button
                type="button"
                onClick={() => {
                  setOpenSite(isOpen ? null : siteId);
                  setOpenCats(new Set());
                  setQuery('');
                }}
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
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {kept === list.length ? `All ${list.length}` : `${kept} of ${list.length}`} recipes from {template.name}
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
                  }}
                >
                  {kept}
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
                  {/* Search */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 10px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                      background: '#fff',
                    }}
                  >
                    <Search size={12} color="var(--color-text-muted)" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={`Search ${list.length} recipes`}
                      aria-label="Search recipes"
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        fontSize: '12px',
                        fontFamily: 'var(--font-primary)',
                        color: 'var(--color-text-primary)',
                        background: 'transparent',
                      }}
                    />
                  </div>

                  {/* Category groups */}
                  <div
                    style={{
                      borderRadius: '10px',
                      border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.10))',
                      background: '#fff',
                      overflow: 'hidden',
                    }}
                  >
                    {RECIPE_CATEGORIES.map((cat, ci) => {
                      const inCat = list.filter((r) => r.category === cat);
                      if (inCat.length === 0) return null;
                      const matches = q ? inCat.filter((r) => r.name.toLowerCase().includes(q)) : inCat;
                      if (q && matches.length === 0) return null;
                      const catKept = inCat.filter((r) => !ex.has(r.id)).length;
                      const catOpen = q ? true : openCats.has(cat);
                      return (
                        <div key={cat} style={{ borderTop: ci === 0 ? 'none' : '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px' }}>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenCats((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(cat)) next.delete(cat); else next.add(cat);
                                  return next;
                                })
                              }
                              aria-expanded={catOpen}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: 0,
                                border: 'none',
                                background: 'transparent',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-primary)',
                              }}
                            >
                              <ChevronDown
                                size={12}
                                color="var(--color-text-muted)"
                                style={{ flexShrink: 0, transform: catOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 0.12s' }}
                              />
                              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{cat}</span>
                              <span style={{ fontSize: '11px', color: catKept === inCat.length ? 'var(--color-text-muted)' : '#7A3800', fontWeight: catKept === inCat.length ? 500 : 700 }}>
                                {catKept} of {inCat.length}
                              </span>
                            </button>
                            {!disabled && (
                              <span style={{ display: 'inline-flex', gap: '4px', flexShrink: 0 }}>
                                <MiniBtn label="All" active={catKept === inCat.length} onClick={() => setCategory(siteId, inCat.map((r) => r.id), true)} />
                                <MiniBtn label="None" active={catKept === 0} onClick={() => setCategory(siteId, inCat.map((r) => r.id), false)} />
                              </span>
                            )}
                          </div>
                          {catOpen && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px', padding: '0 10px 8px 28px' }}>
                              {matches.map((r) => (
                                <RecipeRow key={r.id} recipe={r} included={!ex.has(r.id)} disabled={disabled} onToggle={() => toggle(siteId, r.id)} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Batch shortcut: same unticks for every shop copying this mirror */}
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
                      Untick the same {ex.size} for the other {siblings.length} shop{siblings.length === 1 ? '' : 's'} copying {template.name}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
          Recipes copy with their ingredients, yields, allergens and costs. Anything unticked stays in the mirror shop and can be added later from Recipes.
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
        title={recipe.name}
      >
        {recipe.name}
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

'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  Search,
  Check,
  Edit3,
  Copy,
  Archive,
  X,
  ChevronDown,
  AlertTriangle,
  Tags,
  RefreshCw,
  Undo2,
} from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import {
  Recipe, RecipeCategory,
  buildUsedInIndex, formatCost,
} from '@/components/Recipe/libraryFixtures';
import {
  type WorkflowId,
  type WorkType,
  workTypesFromWorkflows,
  recipeWorkTypes,
  getRecipe,
} from '@/components/Production/fixtures';
import { WorkTypeChips } from '@/components/Production/WorkTypeChip';
import { useRecipes, setRecipes as storeSetRecipes } from '@/components/Recipe/recipeStore';
import {
  KindPill,
  MODIFIER_GROUPS,
  formatShelfLife,
} from '@/components/Recipe/RecipeEditors';

type BulkAction = 'attach-group' | 'detach-group' | 'update-category' | 'recompute' | 'archive' | null;

type CategoryFilter = 'All' | RecipeCategory;

const CATEGORY_ORDER: CategoryFilter[] = [
  'All',
  'Coffee', 'Tea', 'Pastry', 'Food', 'Wine', 'Spirits', 'Kids',
  'Bakery', 'Sandwich', 'Salad', 'Snack', 'Beverage',
];

export default function RecipesLibraryPage() {
  const router = useRouter();
  const recipes = useRecipes();
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [componentsOnly, setComponentsOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  const usedInIndex = useMemo(() => buildUsedInIndex(recipes), [recipes]);

  // Bulk edit
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [undoToast, setUndoToast] = useState<{ message: string; previous: Recipe[]; id: number } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
  }, []);

  const filtered = useMemo(() => {
    let list = recipes;
    if (categoryFilter !== 'All') list = list.filter((r) => r.category === categoryFilter);
    if (needsAttentionOnly) list = list.filter((r) => r.flag !== null);
    if (componentsOnly) list = list.filter((r) => r.kind === 'component' || r.isPrep === true);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }
    return list;
  }, [recipes, categoryFilter, needsAttentionOnly, componentsOnly, search]);

  const needsAttentionCount = recipes.filter((r) => r.flag !== null).length;
  const componentsCount = recipes.filter((r) => r.kind === 'component' || r.isPrep === true).length;
  const draftCount = recipes.filter((r) => r.status === 'Draft').length;
  const selectedCount = selectedIds.size;
  const openRecipe = openId ? recipes.find((r) => r.id === openId) ?? null : null;
  const selectedRecipes = recipes.filter((r) => selectedIds.has(r.id));

  function applyBulkMutation(
    mutate: (r: Recipe) => Recipe,
    message: string,
    affectOnly?: (r: Recipe) => boolean,
  ) {
    const previous = recipes;
    const applyPredicate = affectOnly ?? ((r: Recipe) => selectedIds.has(r.id));
    storeSetRecipes(recipes.map((r) => applyPredicate(r) ? mutate(r) : r));
    setBulkAction(null);
    setBulkMenuOpen(false);
    const id = Date.now();
    setUndoToast({ message, previous, id });
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => {
      setUndoToast((t) => (t && t.id === id ? null : t));
    }, 6000);
  }

  function undoBulk() {
    if (!undoToast) return;
    storeSetRecipes(undoToast.previous);
    setUndoToast(null);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
  }

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  return (
    <div style={{ padding: '24px 24px 120px', maxWidth: '1120px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, flex: 1 }}>
          Recipes
        </h1>
        <button
          onClick={() => router.push('/recipes/intake')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '8px 14px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--color-accent-active)',
            fontSize: '13px',
            fontWeight: 600,
            color: '#fff',
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
          }}
        >
          <Plus size={15} strokeWidth={2.2} /> Add recipes
        </button>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 20px' }}>
        {recipes.length} recipes · {componentsCount} components &amp; prep · 3 shared modifier groups
      </p>

      {/* Filter strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '8px',
            background: 'var(--color-bg-hover)',
            flex: '1 0 220px',
            maxWidth: '320px',
          }}
        >
          <Search size={14} color="var(--color-text-muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes"
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '13px',
              fontFamily: 'var(--font-primary)',
              flex: 1,
              minWidth: 0,
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {CATEGORY_ORDER.map((cat) => {
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '100px',
                  border: active ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
                  background: active ? 'var(--color-accent-active)' : '#fff',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setNeedsAttentionOnly((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '100px',
            border: needsAttentionOnly ? '1px solid var(--color-warning)' : '1px solid var(--color-border-subtle)',
            background: needsAttentionOnly ? 'var(--color-warning-light)' : '#fff',
            color: needsAttentionOnly ? 'var(--color-warning)' : 'var(--color-text-secondary)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: needsAttentionOnly ? 'var(--color-warning)' : 'var(--color-border)',
          }} />
          Needs attention ({needsAttentionCount})
        </button>
        <button
          onClick={() => setComponentsOnly((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '100px',
            border: componentsOnly ? '1px solid var(--color-accent-active)' : '1px solid var(--color-border-subtle)',
            background: componentsOnly ? 'rgba(3,28,89,0.05)' : '#fff',
            color: componentsOnly ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: componentsOnly ? 'var(--color-accent-active)' : 'var(--color-border)',
          }} />
          Components &amp; prep ({componentsCount})
        </button>
        {draftCount > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            · {draftCount} draft{draftCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '14px', overflow: 'hidden', background: '#fff' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '32px 2fr 1fr 130px 80px 80px 1fr 1fr',
            gap: '14px',
            padding: '10px 14px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#FBFAF8',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-text-muted)',
          }}
        >
          <span />
          <span>Name</span>
          <span>Category</span>
          <span>Type</span>
          <span>Cost</span>
          <span>Margin</span>
          <span>Status</span>
          <span>Flag</span>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            No recipes match your filters.
          </div>
        )}

        {filtered.map((r) => (
          <RecipeRow
            key={r.id}
            recipe={r}
            selected={selectedIds.has(r.id)}
            usedInCount={usedInIndex.get(r.id)?.length ?? 0}
            onToggle={() => toggleOne(r.id)}
            onOpen={() => setOpenId(r.id)}
          />
        ))}
      </div>

      {/* Sticky bulk action bar */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              padding: '14px 150px 14px 220px',
              background: 'rgba(255,255,255,0.96)',
              borderTop: '1px solid var(--color-border-subtle)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              justifyContent: 'center',
              zIndex: 150,
            }}
          >
            <div style={{ maxWidth: '1120px', width: '100%', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <strong style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{selectedCount}</strong>{' '}
                selected
              </div>
              <button
                onClick={clearSelection}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: '#fff',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                Clear
              </button>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setBulkMenuOpen((v) => !v)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: bulkMenuOpen ? 'var(--color-bg-hover)' : '#fff',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  Bulk edit <ChevronDown size={13} />
                </button>
                <AnimatePresence>
                  {bulkMenuOpen && (
                    <BulkMenu
                      onClose={() => setBulkMenuOpen(false)}
                      onPick={(a) => { setBulkAction(a); setBulkMenuOpen(false); }}
                    />
                  )}
                </AnimatePresence>
              </div>
              <button
                onClick={() => alert('Export (not wired)')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--color-accent-active)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                Export
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail drawer */}
      <AnimatePresence>
        {openRecipe && (
          <RecipeDrawer
            recipe={openRecipe}
            recipes={recipes}
            usedInIds={usedInIndex.get(openRecipe.id) ?? []}
            onClose={() => setOpenId(null)}
            onSelectRecipe={(id) => setOpenId(id)}
            onEdit={() => router.push(`/recipes/${openRecipe.id}/edit`)}
          />
        )}
      </AnimatePresence>

      {/* Bulk edit modals */}
      <AnimatePresence>
        {bulkAction === 'attach-group' && (
          <AttachGroupModal
            selectedRecipes={selectedRecipes}
            onCancel={() => setBulkAction(null)}
            onConfirm={(group) => {
              applyBulkMutation(
                (r) => r.modifierGroups.includes(group.name) ? r : { ...r, modifierGroups: [...r.modifierGroups, group.name] },
                `Attached "${group.name}" to ${selectedIds.size} recipe${selectedIds.size === 1 ? '' : 's'}`,
              );
            }}
          />
        )}
        {bulkAction === 'update-category' && (
          <UpdateCategoryModal
            selectedRecipes={selectedRecipes}
            onCancel={() => setBulkAction(null)}
            onConfirm={(cat) => {
              applyBulkMutation(
                (r) => ({ ...r, category: cat }),
                `Changed category to ${cat} on ${selectedIds.size} recipe${selectedIds.size === 1 ? '' : 's'}`,
              );
            }}
          />
        )}
        {bulkAction === 'archive' && (
          <ArchiveModal
            selectedRecipes={selectedRecipes}
            onCancel={() => setBulkAction(null)}
            onConfirm={() => {
              applyBulkMutation(
                (r) => ({ ...r, status: 'Archived' }),
                `Archived ${selectedIds.size} recipe${selectedIds.size === 1 ? '' : 's'}`,
              );
              setSelectedIds(new Set());
            }}
          />
        )}
        {bulkAction === 'recompute' && (
          <SimpleConfirmModal
            title={`Recompute costs on ${selectedIds.size} recipe${selectedIds.size === 1 ? '' : 's'}?`}
            body="I'll re-pull latest contract prices and recalculate ingredient cost + margin across each channel. No data is overwritten."
            confirmLabel="Recompute"
            onCancel={() => setBulkAction(null)}
            onConfirm={() => {
              applyBulkMutation(
                (r) => r,
                `Recomputed costs on ${selectedIds.size} recipe${selectedIds.size === 1 ? '' : 's'}`,
              );
            }}
          />
        )}
      </AnimatePresence>

      {/* Undo toast */}
      <AnimatePresence>
        {undoToast && (
          <UndoToastView message={undoToast.message} onUndo={undoBulk} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function RecipeRow({
  recipe, selected, usedInCount, onToggle, onOpen,
}: {
  recipe: Recipe;
  selected: boolean;
  usedInCount: number;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const noPrice = recipe.priceDineIn === 0;
  return (
    <div
      onClick={onOpen}
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 2fr 1fr 130px 80px 80px 1fr 1fr',
        gap: '14px',
        alignItems: 'center',
        padding: '12px 14px',
        borderBottom: '1px solid var(--color-border-subtle)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
    >
      <span
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        style={{
          width: '18px', height: '18px', borderRadius: '5px',
          border: '1.5px solid ' + (selected ? 'var(--color-accent-active)' : 'var(--color-border)'),
          background: selected ? 'var(--color-accent-active)' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'all 0.12s',
        }}
      >
        {selected && <Check size={12} color="#fff" strokeWidth={3} />}
      </span>
      <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{recipe.name}</span>
      <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>{recipe.category}</span>
      <TypeCell recipe={recipe} usedInCount={usedInCount} />
      <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
        {noPrice ? <Dash /> : formatCost(recipe.ingredientCost)}
      </span>
      <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
        {noPrice ? <Dash /> : `${recipe.marginPct}%`}
      </span>
      <StatusPill status={recipe.status} />
      <span>
        {recipe.flag ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 9px',
              borderRadius: '100px',
              background: 'var(--color-warning-light)',
              color: 'var(--color-warning)',
              fontSize: '11.5px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            <AlertTriangle size={11} strokeWidth={2.4} />
            {recipe.flag.label}
          </span>
        ) : (
          <Dash />
        )}
      </span>
    </div>
  );
}

function Dash() {
  return <span style={{ color: 'var(--color-border)', fontSize: '13px' }}>—</span>;
}

function TypeCell({ recipe, usedInCount }: { recipe: Recipe; usedInCount: number }) {
  // Mirror production's `recipeWorkTypes` walk so library + production
  // chips stay in lock-step. For Pret-derived library entries we go
  // through the production helper so we get sub-recipe stages + every
  // ingredient's effective prep work. For library-only entries (Fitzroy
  // standalones) fall back to the lower-level primitive that just walks
  // this recipe's own workflow.
  const prodRecipe = getRecipe(recipe.id);
  const workTypes: WorkType[] = prodRecipe
    ? recipeWorkTypes(prodRecipe)
    : workTypesFromWorkflows({
        workflowIds: recipe.workflowId ? [recipe.workflowId as WorkflowId] : [],
        hasIngredients: (recipe.ingredients?.length ?? 0) > 0,
      });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <KindPill kind={recipe.kind} isPrep={recipe.isPrep} />
      </div>
      {workTypes.length > 0 && <WorkTypeChips workTypes={workTypes} max={3} />}
      {recipe.kind === 'component' && usedInCount > 0 && (
        <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', fontWeight: 500, lineHeight: 1.3 }}>
          Make first · used by {usedInCount}
        </span>
      )}
      {recipe.kind === 'assembly' && recipe.subRecipes && recipe.subRecipes.length > 0 && (
        <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', fontWeight: 500, lineHeight: 1.3 }}>
          {recipe.subRecipes.length} sub-recipe{recipe.subRecipes.length === 1 ? '' : 's'}
        </span>
      )}
      {recipe.isPrep && (
        <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', fontWeight: 500, lineHeight: 1.3 }}>
          Day-end prep
        </span>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Recipe['status'] }) {
  const bg =
    status === 'Active' ? 'var(--color-success-light)' :
    status === 'Draft' ? 'var(--color-bg-hover)' :
    '#F0EFED';
  const color =
    status === 'Active' ? 'var(--color-success)' :
    status === 'Draft' ? 'var(--color-text-secondary)' :
    'var(--color-text-muted)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: '100px',
        background: bg,
        color,
        fontSize: '11.5px',
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Detail drawer

function RecipeDrawer({
  recipe, recipes, usedInIds, onClose, onSelectRecipe, onEdit,
}: {
  recipe: Recipe;
  recipes: Recipe[];
  usedInIds: string[];
  onClose: () => void;
  onSelectRecipe: (id: string) => void;
  onEdit: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const view = recipe;
  const noPrice = view.priceDineIn === 0;

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3,15,58,0.18)',
          zIndex: 600,
        }}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        role="dialog"
        aria-label={`${recipe.name} detail`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(460px, 100vw)',
          background: '#fff',
          boxShadow: '-20px 0 60px rgba(3,15,58,0.14)',
          zIndex: 601,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: '28px', height: '28px', border: 'none', background: 'transparent',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '6px', color: 'var(--color-text-muted)',
              }}
            >
              <X size={18} />
            </button>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, flex: 1, color: 'var(--color-text-primary)' }}>
              {view.name}
            </h2>
            <StatusPill status={view.status} />
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', marginTop: '4px', paddingLeft: '38px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <span>{view.category}</span>
            <span>·</span>
            <KindPill kind={view.kind} isPrep={view.isPrep} />
            {!noPrice && (
              <>
                <span>·</span>
                <span>Ingredient cost {formatCost(view.ingredientCost)}</span>
                <span>·</span>
                <span>Margin {view.marginPct}%</span>
              </>
            )}
            {view.production.shelfLifeMinutes != null && (
              <>
                <span>·</span>
                <span>Shelf life {formatShelfLife(view.production.shelfLifeMinutes)}</span>
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {view.menuItems.length > 0 && (
            <Section label="Menu items using this recipe">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {view.menuItems.map((mi) => (
                  <li
                    key={mi.name}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border-subtle)',
                      background: '#fff', fontSize: '13px',
                    }}
                  >
                    <span style={{ color: 'var(--color-text-primary)' }}>{mi.name}</span>
                    <span
                      style={{
                        fontSize: '11px', fontWeight: 600,
                        color: mi.posLinked ? 'var(--color-success)' : 'var(--color-text-muted)',
                      }}
                    >
                      {mi.posLinked ? 'POS linked' : 'Not on POS'}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {(view.ingredients.length > 0 || (view.subRecipes && view.subRecipes.length > 0)) && (
            <Section label="Recipe components">
              <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', overflow: 'hidden' }}>
                {/* Sub-recipes first (build order) */}
                {view.subRecipes?.map((sub, idx) => {
                  const subRec = recipesById.get(sub.recipeId);
                  const isLast =
                    idx === (view.subRecipes!.length - 1) &&
                    view.ingredients.length === 0;
                  return (
                    <button
                      key={`sub-${sub.recipeId}`}
                      onClick={() => subRec && onSelectRecipe(subRec.id)}
                      disabled={!subRec}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '20px 1fr auto auto',
                        gap: '10px',
                        padding: '8px 12px',
                        alignItems: 'center',
                        width: '100%',
                        border: 'none',
                        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
                        background: '#fff',
                        cursor: subRec ? 'pointer' : 'default',
                        textAlign: 'left',
                        fontFamily: 'var(--font-primary)',
                        fontSize: '12.5px',
                      }}
                      onMouseEnter={(e) => { if (subRec) e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                    >
                      <span
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: 'var(--color-bg-hover)',
                          color: 'var(--color-text-secondary)',
                          fontSize: '11px', fontWeight: 700, flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {subRec ? subRec.name : sub.recipeId}
                      </span>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                        {sub.quantityPerUnit}{sub.unit === 'unit' ? '' : ` ${sub.unit}`}
                      </span>
                      {subRec ? <KindPill kind={subRec.kind} isPrep={subRec.isPrep} /> : <span />}
                    </button>
                  );
                })}

                {/* Then raw ingredients */}
                {view.ingredients.map((ing, i) => {
                  const isLast = i === view.ingredients.length - 1;
                  const startIdx = (view.subRecipes?.length ?? 0) + i;
                  return (
                    <div
                      key={`ing-${ing.name}-${i}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '20px 1fr auto auto',
                        gap: '10px',
                        padding: '8px 12px',
                        alignItems: 'center',
                        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
                        fontSize: '12.5px',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: 'var(--color-bg-hover)',
                          color: 'var(--color-text-muted)',
                          fontSize: '11px', fontWeight: 700, flexShrink: 0,
                        }}
                      >
                        {startIdx + 1}
                      </span>
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ing.name}
                      </span>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{ing.qty}</span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '11.5px', textAlign: 'right' }}>{ing.supplier || '—'}</span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {view.modifierGroups.length > 0 && (
            <Section label="Attached modifier groups">
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {view.modifierGroups.map((g) => (
                  <span
                    key={g}
                    style={{
                      padding: '4px 10px', borderRadius: '8px', background: 'var(--color-bg-hover)',
                      color: 'var(--color-text-primary)', fontSize: '12px', fontWeight: 600,
                    }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {!noPrice && (
            <Section label="Price & margin">
              <PriceRow label="Dine in" price={view.priceDineIn} cost={view.ingredientCost} />
              <PriceRow label="Takeaway" price={view.priceTakeaway} cost={view.ingredientCost} />
              <PriceRow label="Delivery" price={view.priceDelivery} cost={view.ingredientCost} />
            </Section>
          )}

          {/* Production flow — Used in / Workflow DAG */}
          {usedInIds.length > 0 && (
            <Section label={`Used in (${usedInIds.length} assembl${usedInIds.length === 1 ? 'y' : 'ies'})`}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {usedInIds.map((id) => {
                  const parent = recipesById.get(id);
                  if (!parent) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => onSelectRecipe(id)}
                      style={{
                        padding: '5px 11px', borderRadius: '8px',
                        background: 'var(--color-bg-hover)',
                        border: '1px solid var(--color-border-subtle)',
                        color: 'var(--color-text-primary)',
                        fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      {parent.name}
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

        </div>

        <div style={{ borderTop: '1px solid var(--color-border-subtle)', padding: '12px 18px', display: 'flex', gap: '8px' }}>
          <DrawerButton icon={Edit3} label="Edit" onClick={onEdit} />
          <DrawerButton icon={Copy} label="Duplicate" />
          <DrawerButton icon={Archive} label="Archive" />
        </div>
      </motion.div>
    </>,
    document.body,
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <div
        style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--color-text-muted)', marginBottom: '8px',
        }}
      >
        {label}
      </div>
      {children}
    </section>
  );
}

function PriceRow({ label, price, cost }: { label: string; price: number; cost: number }) {
  const margin = Math.round(((price - cost) / price) * 100);
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 80px 70px', gap: '8px', padding: '6px 0',
      fontSize: '12.5px', color: 'var(--color-text-secondary)',
    }}>
      <span>{label}</span>
      <span style={{ textAlign: 'right', color: 'var(--color-text-primary)', fontWeight: 600 }}>{formatCost(price)}</span>
      <span style={{ textAlign: 'right' }}>margin {margin}%</span>
    </div>
  );
}

function DrawerButton({
  icon: Icon, label, onClick,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick ?? (() => alert(`${label} — not wired in this slice.`))}
      style={{
        flex: 1,
        padding: '9px 10px',
        borderRadius: '8px',
        border: '1px solid var(--color-border)',
        background: '#fff',
        fontSize: '12.5px',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
      }}
    >
      <Icon size={13} strokeWidth={2} />
      {label}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Bulk edit

function BulkMenu({
  onClose, onPick,
}: {
  onClose: () => void;
  onPick: (a: BulkAction) => void;
}) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-bulk-menu]')) onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [onClose]);

  const items: { id: BulkAction; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; hint?: string }[] = [
    { id: 'attach-group',    label: 'Attach modifier group\u2026', icon: EdifyMark, hint: 'e.g. Alt milks to every coffee' },
    { id: 'update-category', label: 'Change category\u2026',       icon: Tags },
    { id: 'recompute',       label: 'Recompute costs',            icon: RefreshCw, hint: 'Re-pull latest contract prices' },
    { id: 'archive',         label: 'Archive',                    icon: Archive },
  ];

  return (
    <motion.div
      data-bulk-menu
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.14 }}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        right: 0,
        width: '260px',
        borderRadius: '10px',
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 12px 32px rgba(3,15,58,0.14), 0 2px 8px rgba(3,15,58,0.06)',
        padding: '6px',
        zIndex: 210,
        fontFamily: 'var(--font-primary)',
      }}
    >
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button
            key={it.id}
            onClick={() => onPick(it.id)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              width: '100%', padding: '8px 10px',
              border: 'none', background: 'transparent',
              textAlign: 'left', cursor: 'pointer',
              borderRadius: '8px',
              fontFamily: 'var(--font-primary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Icon size={14} strokeWidth={2} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{it.label}</div>
              {it.hint && (
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{it.hint}</div>
              )}
            </div>
          </button>
        );
      })}
    </motion.div>
  );
}

function ModalShell({
  title, subtitle, children, onCancel, onConfirm, confirmLabel, confirmDisabled,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmDisabled?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: 'rgba(3,15,58,0.22)', zIndex: 700 }}
      />
      <div
        style={{
          position: 'fixed', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '40px 20px', zIndex: 701, pointerEvents: 'none',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          role="dialog"
          aria-label={title}
          style={{
            pointerEvents: 'auto',
            width: 'min(520px, 100%)',
            maxHeight: '100%',
            background: '#fff',
            borderRadius: '14px',
            boxShadow: '0 24px 60px rgba(3,15,58,0.22), 0 0 0 1px rgba(3,15,58,0.04)',
            overflow: 'auto',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, flex: 1, color: 'var(--color-text-primary)' }}>
                {title}
              </h3>
              <button onClick={onCancel} aria-label="Close" style={iconBtnStyle}>
                <X size={16} />
              </button>
            </div>
            {subtitle && (
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{subtitle}</div>
            )}
          </div>
          <div style={{ padding: '16px 18px' }}>{children}</div>
          <div style={{ display: 'flex', gap: '8px', padding: '12px 18px', borderTop: '1px solid var(--color-border-subtle)' }}>
            <button onClick={onCancel} style={{ ...modalBtnStyle, background: '#fff', color: 'var(--color-text-primary)' }}>
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={confirmDisabled}
              style={{
                ...modalBtnStyle, flex: 1,
                background: confirmDisabled ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
                color: confirmDisabled ? 'var(--color-text-muted)' : '#fff',
                border: 'none',
                cursor: confirmDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}

function AttachGroupModal({
  selectedRecipes, onCancel, onConfirm,
}: {
  selectedRecipes: Recipe[];
  onCancel: () => void;
  onConfirm: (group: typeof MODIFIER_GROUPS[number]) => void;
}) {
  const [pickedId, setPickedId] = useState<string>('mg-alt-milks');
  const picked = MODIFIER_GROUPS.find((g) => g.id === pickedId)!;
  const alreadyAttached = selectedRecipes.filter((r) => r.modifierGroups.includes(picked.name)).length;
  const toAttach = selectedRecipes.length - alreadyAttached;

  return (
    <ModalShell
      title="Attach modifier group"
      subtitle={`${selectedRecipes.length} recipe${selectedRecipes.length === 1 ? '' : 's'} selected`}
      onCancel={onCancel}
      onConfirm={() => onConfirm(picked)}
      confirmLabel={`Attach to ${toAttach} recipe${toAttach === 1 ? '' : 's'}`}
      confirmDisabled={toAttach === 0}
    >
      <div style={sectionLabelStyle}>Choose group</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
        {MODIFIER_GROUPS.map((g) => {
          const on = pickedId === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setPickedId(g.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '10px',
                border: on ? '1px solid var(--color-accent-active)' : '1px solid var(--color-border-subtle)',
                background: on ? 'rgba(3,28,89,0.05)' : '#fff',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  border: '1.5px solid ' + (on ? 'var(--color-accent-active)' : 'var(--color-border)'),
                  background: on ? 'var(--color-accent-active)' : '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {on && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>
                {g.name}
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                {g.optionsCount} options · already on {g.attachedCount}
              </span>
            </button>
          );
        })}
      </div>

      <ImpactPreview>
        <div>
          <strong style={{ color: 'var(--color-text-primary)' }}>{toAttach}</strong> new attachment{toAttach === 1 ? '' : 's'}
          {alreadyAttached > 0 && <> ({alreadyAttached} already reference &ldquo;{picked.name}&rdquo; and won&apos;t change)</>}
        </div>
        <div>Est. cost impact: <strong style={{ color: 'var(--color-text-primary)' }}>none</strong> — modifier groups only change cost at POS time.</div>
      </ImpactPreview>
    </ModalShell>
  );
}

function UpdateCategoryModal({
  selectedRecipes, onCancel, onConfirm,
}: {
  selectedRecipes: Recipe[];
  onCancel: () => void;
  onConfirm: (cat: RecipeCategory) => void;
}) {
  const options: RecipeCategory[] = ['Coffee', 'Tea', 'Pastry', 'Food', 'Wine', 'Spirits', 'Kids'];
  const [picked, setPicked] = useState<RecipeCategory>('Coffee');
  const changeCount = selectedRecipes.filter((r) => r.category !== picked).length;
  return (
    <ModalShell
      title="Change category"
      subtitle={`${selectedRecipes.length} recipe${selectedRecipes.length === 1 ? '' : 's'} selected`}
      onCancel={onCancel}
      onConfirm={() => onConfirm(picked)}
      confirmLabel={`Set ${changeCount} to ${picked}`}
      confirmDisabled={changeCount === 0}
    >
      <div style={sectionLabelStyle}>New category</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
        {options.map((c) => {
          const on = picked === c;
          return (
            <button
              key={c}
              onClick={() => setPicked(c)}
              style={{
                padding: '6px 12px', borderRadius: '100px',
                border: on ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
                background: on ? 'var(--color-accent-active)' : '#fff',
                color: on ? '#fff' : 'var(--color-text-secondary)',
                fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-primary)',
                display: 'inline-flex', alignItems: 'center', gap: '5px',
              }}
            >
              {on && <Check size={11} strokeWidth={2.6} />} {c}
            </button>
          );
        })}
      </div>
      <ImpactPreview>
        <div>
          <strong style={{ color: 'var(--color-text-primary)' }}>{changeCount}</strong> recipe{changeCount === 1 ? '' : 's'} will change category to <strong style={{ color: 'var(--color-text-primary)' }}>{picked}</strong>.
          {selectedRecipes.length - changeCount > 0 && <> {selectedRecipes.length - changeCount} already in {picked}.</>}
        </div>
      </ImpactPreview>
    </ModalShell>
  );
}

function ArchiveModal({
  selectedRecipes, onCancel, onConfirm,
}: {
  selectedRecipes: Recipe[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const count = selectedRecipes.length;
  return (
    <ModalShell
      title={`Archive ${count} recipe${count === 1 ? '' : 's'}?`}
      subtitle="Archived recipes stay in the library (filter to see them) but don't appear on production lists or POS exports. Reversible."
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmLabel={`Archive ${count}`}
    >
      <ImpactPreview variant="warn">
        <div><strong style={{ color: 'var(--color-text-primary)' }}>{count}</strong> recipe{count === 1 ? '' : 's'} will be set to Archived:</div>
        <div style={{ marginTop: '6px', maxHeight: '120px', overflow: 'auto', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {selectedRecipes.slice(0, 8).map((r) => r.name).join(' · ')}
          {selectedRecipes.length > 8 && <> · +{selectedRecipes.length - 8} more</>}
        </div>
      </ImpactPreview>
    </ModalShell>
  );
}

function SimpleConfirmModal({
  title, body, confirmLabel, onCancel, onConfirm,
}: {
  title: string; body: string; confirmLabel: string;
  onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <ModalShell
      title={title}
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmLabel={confirmLabel}
    >
      <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
        {body}
      </div>
    </ModalShell>
  );
}

function ImpactPreview({ children, variant }: { children: React.ReactNode; variant?: 'warn' }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: '10px',
        background: variant === 'warn' ? 'var(--color-warning-light)' : 'var(--color-bg-hover)',
        border: variant === 'warn' ? '1px solid var(--color-warning-border)' : '1px solid var(--color-border-subtle)',
        fontSize: '12.5px', color: 'var(--color-text-secondary)',
        lineHeight: 1.5,
      }}
    >
      <div
        style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: variant === 'warn' ? 'var(--color-warning)' : 'var(--color-text-muted)',
          marginBottom: '4px',
        }}
      >
        Impact preview
      </div>
      {children}
    </div>
  );
}

function UndoToastView({ message, onUndo }: { message: string; onUndo: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed',
        bottom: '80px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 800,
        padding: '10px 14px',
        borderRadius: '100px',
        background: 'var(--color-accent-deep)',
        color: '#fff',
        display: 'flex', alignItems: 'center', gap: '12px',
        boxShadow: '0 10px 30px rgba(3,15,58,0.25)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <Check size={14} strokeWidth={2.6} />
      <span style={{ fontSize: '13px', fontWeight: 600 }}>{message}</span>
      <button
        onClick={onUndo}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px',
          borderRadius: '100px',
          border: '1px solid rgba(255,255,255,0.3)',
          background: 'transparent',
          color: '#fff',
          fontSize: '12px', fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <Undo2 size={12} strokeWidth={2.4} /> Undo
      </button>
    </motion.div>,
    document.body,
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: '28px', height: '28px',
  border: 'none', background: 'transparent', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '6px', color: 'var(--color-text-muted)',
};

const modalBtnStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid var(--color-border)',
  fontSize: '13px', fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--color-text-muted)',
  marginBottom: '8px',
};


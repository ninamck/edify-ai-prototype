'use client';

/**
 * Full-page recipe editor.
 *
 * Mirrors the "Build recipe manually" intake page layout (Card / CollapsibleCard
 * sections, sticky PriceCard sidebar) and adds the workflow-aware sections
 * (Made from / Used in / Workflow stages) that exist for production recipes.
 *
 * Reads from and writes to the shared `recipeStore` so changes appear in the
 * recipes list when you return.
 */

import React, { useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Image as ImageIcon, Pencil, Plus } from 'lucide-react';
import {
  type Recipe,
  type RecipeCategory,
  type ComponentRow,
  type ItemComponent,
  type RecipeComponent,
  type RecipeIngredient,
  type RecipeSlot,
  buildUsedInIndex,
} from '@/components/Recipe/libraryFixtures';
import { IngredientsV2Section } from '@/components/Recipe/IngredientsV2Section';
import { useModifierGroups } from '@/components/Modifiers/store';
import type { ModifierGroup } from '@/components/Modifiers/types';
import { GroupEditorDrawer } from '@/components/Modifiers/GroupEditorDrawer';
import { applyModifiers, defaultSelectionFor } from '@/components/Recipe/resolver';
import { resolveIngredientRef, type IngredientRef } from '@/components/Ingredients/catalogue';
import { IngredientRefPicker } from '@/components/Recipe/IngredientRefPicker';
import {
  type ProductionWorkflow,
} from '@/components/Production/fixtures';
import {
  useRecipes,
  useWorkflows,
  updateRecipe,
  updateWorkflow,
  cloneWorkflow,
} from '@/components/Recipe/recipeStore';
import {
  KindPill,
  WorkflowDiagram,
  WorkflowEditor,
  formatShelfLife,
  kindToModeLabel,
} from '@/components/Recipe/RecipeEditors';
import {
  type FormCategory,
  type VariableRow,
  type PackagingRow,
  ALLERGENS,
  PRODUCT_CLASSES,
  STATUSES,
  YIELD_UOMS,
  SHELF_LIFE_UNITS,
  type ShelfLifeUnit,
  PRODUCTION_VIS,
  SITES,
  newId,
  emptyVariable,
  emptyPackaging,
  Card,
  CollapsibleCard,
  SectionHeader,
  FieldLabel,
  Soft,
  PillMulti,
  PillSingle,
  TagInput,
  CheckRow,
  ComponentTable,
  VariableTable,
  PackagingTable,
  PriceCard,
  inputStyle,
  nameInputStyle,
  selectStyle,
  textareaStyle,
  primaryBtnStyle,
  secondaryBtnStyle,
} from '@/components/Recipe/RecipeFormParts';

// All recipe categories — broader than the manual intake's set so existing
// Pret recipes (Bakery, Sandwich, Salad, Snack, Beverage) keep their category.
const ALL_CATEGORIES: FormCategory[] = [
  'Coffee', 'Tea', 'Pastry', 'Food', 'Wine', 'Spirits', 'Kids',
  'Bakery', 'Sandwich', 'Salad', 'Snack', 'Beverage',
];

// ── Recipe ↔ form draft conversion ───────────────────────────────────────────

type FormDraft = {
  name: string;
  category: FormCategory | '';
  yieldQty: number | '';
  yieldUom: string;
  sites: string[];
  instructions: string;
  allergens: string[];
  photoName: string | null;
  /**
   * Typed, master/product-aware ingredient list (post-rethink). The new
   * "Ingredients" card writes here. Saved to `Recipe.ingredientsV2`.
   */
  ingredientsV2: RecipeIngredient[];
  /**
   * Typed packaging list. Same shape as ingredients — packaging is just
   * another product the order consumes. Modifier `replace` / `add` /
   * `scale` effects target packaging the same way they target
   * ingredients (e.g. Large coffee swaps the 8oz cup for a 12oz cup).
   * Saved to `Recipe.packagingV2`.
   */
  packagingV2: RecipeIngredient[];
  // ── Sellability / modifier-driven composition (post-merge) ─────────────
  /** POS-linked? Drives the "Sellable on POS" filter on the recipes list
   *  and whether modifier groups should resolve. */
  posLinked: boolean;
  /** Upstream POS item id used to keep the link alive across POS-to-Edify
   *  reconciliations. Editable as a hidden link reference. */
  posSourceId: string;
  /** Catalogue-level modifier groups attached to this recipe. */
  modifierGroupIds: string[];
  /** Slot definitions — only used by spirit / wine / size-driven recipes. */
  slots: RecipeSlot[];
  /** Whether the advanced "Slots" collapsible is open. */
  showSlots: boolean;
  /** Live preview selection state, keyed by group id → option ids. Not
   *  persisted; resets when the editor remounts. */
  previewByGroup: Record<string, string[]>;
  components: ComponentRow[];
  variables: VariableRow[];
  packaging: PackagingRow[];
  // Production
  showVariable: boolean;
  showPackaging: boolean;
  showProduction: boolean;
  productionVis: string[];
  prepSec: number | '';
  productionRef: string;
  keyIngredients: string[];
  tags: string[];
  minBatch: number | '';
  maxBatch: number | '' | 'unlimited';
  batchMultiple: number | '';
  // Advanced
  showAdvanced: boolean;
  status: string;
  productClass: string;
  isSubRecipe: boolean;
  countInStockTake: boolean;
  excludeFromCogs: boolean;
  shelfLifeValue: number | '';
  shelfLifeUnit: ShelfLifeUnit;
  closingRange: string;
  bakeryHot: string;
  allowCarryOver: boolean;
  enablePcr: boolean;
  usedFor: string[];
  // Pricing
  desiredMargin: number | '';
  vatPct: number | '';
  hotCold: 'hot' | 'cold' | null;
  srpDineInEx: number | '';
  srpTakeawayEx: number | '';
  srpDeliveryEx: number | '';
  deliveryCommission: number | '';
};

// Try to split "180ml" / "7 g" / "1 unit" into quantity + uom.
function parseQty(qtyStr: string): { qty: number | ''; uom: string } {
  const m = qtyStr.match(/^([0-9]*\.?[0-9]+)\s*([a-zA-Z]+)?$/);
  if (!m) return { qty: '', uom: 'g' };
  const qty = Number(m[1]);
  const uom = (m[2] ?? 'g').toLowerCase();
  return { qty, uom };
}

/**
 * Build the unified component list for editing. Order: any sub-recipes first
 * (build order), then raw ingredients. If `formExtras.components` was already
 * populated by a previous save, that takes precedence (preserves user-set order
 * + cost data).
 */
function buildInitialComponents(r: Recipe): ComponentRow[] {
  const fx = r.formExtras ?? {};
  if (fx.components && fx.components.length) {
    return fx.components.map((c) => ({ ...c })) as ComponentRow[];
  }

  const out: ComponentRow[] = [];
  if (r.subRecipes) {
    for (const s of r.subRecipes) {
      const row: RecipeComponent = {
        id: newId(),
        kind: 'recipe',
        recipeId: s.recipeId,
        qty: s.quantityPerUnit,
        uom: s.unit,
      };
      out.push(row);
    }
  }
  if (fx.detailedIngredients && fx.detailedIngredients.length) {
    for (const ing of fx.detailedIngredients) {
      const row: ItemComponent = {
        id: newId(), kind: 'item',
        name: ing.name, supplier: ing.supplier,
        qty: ing.qty, uom: ing.uom, unitCostP: ing.unitCostP,
      };
      out.push(row);
    }
  } else if (r.ingredients?.length) {
    for (const ing of r.ingredients) {
      const { qty, uom } = parseQty(ing.qty);
      const row: ItemComponent = {
        id: newId(), kind: 'item',
        name: ing.name, supplier: ing.supplier,
        qty, uom, unitCostP: 0,
      };
      out.push(row);
    }
  }
  return out;
}

/**
 * Split the unified list back into the legacy shapes for storage. Order of
 * sub-recipes is preserved from the component list (build order).
 */
function splitComponents(rows: ComponentRow[]): {
  subRecipes?: Recipe['subRecipes'];
  ingredients: Recipe['ingredients'];
} {
  const subRecipes: NonNullable<Recipe['subRecipes']> = [];
  const ingredients: Recipe['ingredients'] = [];
  for (const r of rows) {
    if (r.kind === 'recipe') {
      subRecipes.push({
        recipeId: r.recipeId,
        quantityPerUnit: typeof r.qty === 'number' ? r.qty : 1,
        unit: r.uom,
      });
    } else if (r.name.trim()) {
      ingredients.push({
        name: r.name.trim(),
        qty: typeof r.qty === 'number' ? `${r.qty}${r.uom === 'unit' ? '' : r.uom}` : '',
        supplier: r.supplier,
      });
    }
  }
  return { subRecipes: subRecipes.length ? subRecipes : undefined, ingredients };
}

function shelfLifeToMinutes(value: number | '', unit: ShelfLifeUnit): number | null {
  if (value === '' || !Number.isFinite(value)) return null;
  if (unit === 'minutes') return value;
  if (unit === 'hours') return value * 60;
  return value * 60 * 24;
}

function minutesToShelfLife(min: number | null): { value: number | ''; unit: ShelfLifeUnit } {
  if (min == null) return { value: '', unit: 'minutes' };
  if (min % (60 * 24) === 0) return { value: min / (60 * 24), unit: 'days' };
  if (min % 60 === 0) return { value: min / 60, unit: 'hours' };
  return { value: min, unit: 'minutes' };
}

function deriveProductionVisibility(multi: string[]): Recipe['production']['visibility'] {
  const hasBar = multi.includes('Bar');
  const hasKitchen = multi.includes('Kitchen');
  if (hasBar && hasKitchen) return 'Both';
  if (hasBar) return 'Bar';
  if (hasKitchen) return 'Kitchen';
  return null;
}

function recipeToDraft(r: Recipe): FormDraft {
  const fx = r.formExtras ?? {};
  const sl = minutesToShelfLife(r.production.shelfLifeMinutes);
  return {
    name: r.name,
    category: r.category,
    yieldQty: fx.yieldQty ?? 1,
    yieldUom: fx.yieldUom ?? 'serving',
    sites: fx.sites ?? ['Fitzroy Espresso'],
    instructions: fx.instructions ?? '',
    allergens: fx.allergens ?? [],
    photoName: fx.photoName ?? null,
    ingredientsV2: r.ingredientsV2?.map((row) => ({
      ...row,
      siteOverrides: row.siteOverrides ? { ...row.siteOverrides } : undefined,
    })) ?? [],
    packagingV2: r.packagingV2?.map((row) => ({
      ...row,
      siteOverrides: row.siteOverrides ? { ...row.siteOverrides } : undefined,
    })) ?? [],
    posLinked: r.posLinked ?? false,
    posSourceId: r.posSourceId ?? '',
    modifierGroupIds: [...(r.modifierGroupIds ?? [])],
    slots: (r.slots ?? []).map((s) => ({ ...s })),
    showSlots: (r.slots?.length ?? 0) > 0,
    previewByGroup: {},
    components: buildInitialComponents(r),
    variables: fx.variableIngredients?.map((row) => ({ ...row })) ?? [],
    packaging: fx.packaging?.map((row) => ({ ...row })) ?? [],
    showVariable: (fx.variableIngredients?.length ?? 0) > 0,
    showPackaging: (fx.packaging?.length ?? 0) > 0,
    showProduction: false,
    productionVis: fx.productionExtras?.visibility ?? (
      r.production.visibility === 'Both' ? ['Bar', 'Kitchen'] :
      r.production.visibility ? [r.production.visibility] : []
    ),
    prepSec: fx.productionExtras?.prepSeconds ?? r.production.prepTimeSeconds ?? '',
    productionRef: fx.productionExtras?.productionRef ?? '',
    keyIngredients: fx.productionExtras?.keyIngredients ?? [],
    tags: fx.productionExtras?.tags ?? [],
    minBatch: fx.productionExtras?.minBatch ?? 1,
    maxBatch: fx.productionExtras?.maxBatch ?? 'unlimited',
    batchMultiple: fx.productionExtras?.batchMultiple ?? 1,
    showAdvanced: false,
    status: fx.advanced?.productClass != null
      ? r.status
      : r.status,
    productClass: fx.advanced?.productClass ?? '',
    isSubRecipe: fx.advanced?.isSubRecipe ?? r.kind === 'component',
    countInStockTake: fx.advanced?.countInStockTake ?? false,
    excludeFromCogs: fx.advanced?.excludeFromCogs ?? false,
    shelfLifeValue: fx.advanced?.shelfLifeValue ?? sl.value,
    shelfLifeUnit: fx.advanced?.shelfLifeUnit ?? sl.unit,
    closingRange: fx.advanced?.closingRange ?? '',
    bakeryHot: fx.advanced?.bakeryHot ?? 'None',
    allowCarryOver: fx.advanced?.allowCarryOver ?? false,
    enablePcr: fx.advanced?.enablePcr ?? false,
    usedFor: fx.advanced?.usedFor ?? [],
    desiredMargin: fx.pricing?.desiredMargin ?? 70,
    vatPct: fx.pricing?.vatPct ?? 20,
    hotCold: fx.pricing?.hotCold ?? null,
    srpDineInEx: fx.pricing?.srpDineInEx ?? '',
    srpTakeawayEx: fx.pricing?.srpTakeawayEx ?? '',
    srpDeliveryEx: fx.pricing?.srpDeliveryEx ?? '',
    deliveryCommission: fx.pricing?.deliveryCommission ?? '',
  };
}

function draftToRecipe(
  base: Recipe,
  draft: FormDraft,
  ingredientCost: number,
  packagingCost: number,
  channelPrices: { dineIn: number; takeaway: number; delivery: number },
  channelMargin: number,
): Recipe {
  const shelfLifeMinutes = shelfLifeToMinutes(draft.shelfLifeValue, draft.shelfLifeUnit);
  const productionVisibility = deriveProductionVisibility(draft.productionVis);
  const { subRecipes, ingredients } = splitComponents(draft.components);
  return {
    ...base,
    name: draft.name.trim() || base.name,
    category: (draft.category || base.category) as RecipeCategory,
    ingredientCost: Math.round((ingredientCost + packagingCost) * 100) / 100,
    priceDineIn: channelPrices.dineIn,
    priceTakeaway: channelPrices.takeaway,
    priceDelivery: channelPrices.delivery,
    marginPct: channelMargin,
    status: (draft.status as Recipe['status']) || base.status,
    ingredients,
    ingredientsV2: draft.ingredientsV2.length > 0 ? draft.ingredientsV2 : undefined,
    packagingV2: draft.packagingV2.length > 0 ? draft.packagingV2 : undefined,
    posLinked: draft.posLinked,
    posSourceId: draft.posSourceId.trim() || undefined,
    modifierGroupIds: draft.modifierGroupIds.length > 0 ? draft.modifierGroupIds : undefined,
    slots: draft.slots.length > 0 ? draft.slots : undefined,
    subRecipes,
    production: {
      visibility: productionVisibility,
      shelfLifeMinutes,
      prepTimeSeconds: typeof draft.prepSec === 'number' ? draft.prepSec : null,
    },
    formExtras: {
      yieldQty: draft.yieldQty,
      yieldUom: draft.yieldUom,
      sites: draft.sites,
      instructions: draft.instructions,
      allergens: draft.allergens,
      photoName: draft.photoName,
      components: draft.components,
      variableIngredients: draft.variables,
      packaging: draft.packaging,
      productionExtras: {
        visibility: draft.productionVis,
        prepSeconds: draft.prepSec,
        productionRef: draft.productionRef,
        keyIngredients: draft.keyIngredients,
        tags: draft.tags,
        minBatch: draft.minBatch,
        maxBatch: draft.maxBatch,
        batchMultiple: draft.batchMultiple,
      },
      advanced: {
        productClass: draft.productClass,
        isSubRecipe: draft.isSubRecipe,
        countInStockTake: draft.countInStockTake,
        excludeFromCogs: draft.excludeFromCogs,
        shelfLifeValue: draft.shelfLifeValue,
        shelfLifeUnit: draft.shelfLifeUnit,
        closingRange: draft.closingRange,
        bakeryHot: draft.bakeryHot,
        allowCarryOver: draft.allowCarryOver,
        enablePcr: draft.enablePcr,
        usedFor: draft.usedFor,
      },
      pricing: {
        desiredMargin: draft.desiredMargin,
        vatPct: draft.vatPct,
        hotCold: draft.hotCold,
        srpDineInEx: draft.srpDineInEx,
        srpTakeawayEx: draft.srpTakeawayEx,
        srpDeliveryEx: draft.srpDeliveryEx,
        deliveryCommission: draft.deliveryCommission,
      },
    },
  };
}

// ── Page wrapper ─────────────────────────────────────────────────────────────

export default function EditRecipePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const recipes = useRecipes();
  const workflows = useWorkflows();

  const original = useMemo(() => recipes.find((r) => r.id === id) ?? null, [recipes, id]);

  if (!original) {
    return (
      <div style={{ padding: '60px 24px', maxWidth: '720px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Recipe not found</h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
          The recipe id <code>{id}</code> doesn&apos;t match anything in the library.
        </p>
        <button onClick={() => router.push('/recipes')} style={{ ...primaryBtnStyle, marginTop: '20px' }}>
          Back to recipes
        </button>
      </div>
    );
  }

  // `key={original.id}` ensures the form remounts (and re-initialises its draft
  // state) when the user navigates sideways to a different recipe's edit page.
  return <EditRecipeForm key={original.id} original={original} allRecipes={recipes} allWorkflows={workflows} />;
}

// ── Form ─────────────────────────────────────────────────────────────────────

function EditRecipeForm({
  original,
  allRecipes,
  allWorkflows,
}: {
  original: Recipe;
  allRecipes: Recipe[];
  allWorkflows: Record<string, ProductionWorkflow>;
}) {
  const router = useRouter();

  const recipesById = useMemo(() => new Map(allRecipes.map((r) => [r.id, r])), [allRecipes]);
  const usedInIds = useMemo(() => buildUsedInIndex(allRecipes).get(original.id) ?? [], [allRecipes, original.id]);
  const allGroups = useModifierGroups();

  const [draft, setDraft] = useState<FormDraft>(() => recipeToDraft(original));
  const [draftKind, setDraftKind] = useState<Recipe['kind']>(original.kind);
  const [draftIsPrep, setDraftIsPrep] = useState<boolean>(original.isPrep ?? false);
  const [draftWorkflow, setDraftWorkflow] = useState<ProductionWorkflow | null>(
    () => (original.workflowId && allWorkflows[original.workflowId]
      ? cloneWorkflow(allWorkflows[original.workflowId])
      : null),
  );
  const [showWorkflowSections, setShowWorkflowSections] = useState<boolean>(
    !!(original.subRecipes?.length || original.workflowId),
  );

  // Sub-recipes are derived from BOTH (a) the legacy unified component
  // list (preserves seed-data order) and (b) any rows in the new
  // Ingredients section with `ref.kind === 'subrecipe'`. The new
  // typed picker is now the primary way to attach a sub-recipe, but
  // existing seed data still flows through `draft.components`.
  // Dedupe by recipeId so a sub-recipe added in both places counts once.
  const draftSubRecipes = useMemo<Recipe['subRecipes']>(() => {
    const seen = new Set<string>();
    const out: NonNullable<Recipe['subRecipes']> = [];
    for (const c of draft.components) {
      if (c.kind !== 'recipe') continue;
      if (seen.has(c.recipeId)) continue;
      seen.add(c.recipeId);
      out.push({
        recipeId: c.recipeId,
        quantityPerUnit: typeof c.qty === 'number' ? c.qty : 1,
        unit: c.uom,
      });
    }
    for (const ri of draft.ingredientsV2) {
      if (ri.ref.kind !== 'subrecipe') continue;
      if (seen.has(ri.ref.recipeId)) continue;
      seen.add(ri.ref.recipeId);
      out.push({
        recipeId: ri.ref.recipeId,
        quantityPerUnit: ri.baseQty.value,
        unit: ri.baseQty.unit,
      });
    }
    return out.length ? out : undefined;
  }, [draft.components, draft.ingredientsV2]);

  // Computed totals — item rows by unit cost, recipe rows by linked recipe's ingredientCost.
  const ingredientCost = useMemo(() => {
    return draft.components.reduce((sum, r) => {
      const q = typeof r.qty === 'number' ? r.qty : 0;
      if (r.kind === 'item') return sum + (q * r.unitCostP) / 100;
      const sub = recipesById.get(r.recipeId);
      return sum + q * (sub?.ingredientCost ?? 0);
    }, 0);
  }, [draft.components, recipesById]);

  const packagingCost = useMemo(() => {
    return draft.packaging.reduce((sum, r) => {
      const q = typeof r.qty === 'number' ? r.qty : 0;
      return sum + (q * r.unitCostP) / 100;
    }, 0);
  }, [draft.packaging]);

  const totalCost = ingredientCost + packagingCost;

  function marginPct(srpEx: number | '', commissionPct = 0): number | null {
    if (srpEx === '' || srpEx <= 0) return null;
    const net = Number(srpEx) * (1 - commissionPct / 100);
    if (net <= 0) return null;
    return Math.round(((net - totalCost) / net) * 100);
  }
  function srpInc(srpEx: number | '', vat: number | ''): number | null {
    if (srpEx === '' || vat === '') return null;
    return Math.round(Number(srpEx) * (1 + Number(vat) / 100) * 100) / 100;
  }

  function patch<K extends keyof FormDraft>(key: K, value: FormDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function applyCategoryDefaults(cat: FormCategory) {
    setDraft((d) => ({ ...d, category: cat }));
  }

  // Single setter for the unified component list. Keeps the Type pill in sync:
  // adding any sub-recipe row promotes the recipe to "assembly"; removing the
  // last one demotes it back to "stand-alone".
  function setComponents(next: ComponentRow[]) {
    const hasRecipe = next.some((c) => c.kind === 'recipe');
    setDraft((d) => ({ ...d, components: next }));
    setDraftKind((prev) => {
      if (hasRecipe && prev !== 'assembly') return 'assembly';
      if (!hasRecipe && prev === 'assembly') return 'standalone';
      return prev;
    });
  }

  function handleCancel() {
    router.push('/recipes');
  }

  function handleSave() {
    if (draft.name.trim().length === 0) return;

    const incDine = srpInc(draft.srpDineInEx, draft.vatPct) ?? original.priceDineIn;
    const incTake = srpInc(draft.srpTakeawayEx, draft.vatPct) ?? original.priceTakeaway;
    const incDel = srpInc(draft.srpDeliveryEx, draft.vatPct) ?? original.priceDelivery;
    const channelMargin = marginPct(draft.srpDineInEx) ?? original.marginPct;

    const updated = draftToRecipe(
      original,
      draft,
      ingredientCost,
      packagingCost,
      { dineIn: incDine, takeaway: incTake, delivery: incDel },
      channelMargin,
    );

    // splitComponents in draftToRecipe already populated subRecipes; just fix the
    // explicit fields the user controls separately.
    updated.kind = draftKind;
    updated.isPrep = draftIsPrep;
    // Persist the workflow attachment (or detachment). The previous
    // editor assumed workflowId was fixed; now the user can flip
    // attach/detach via the Production flow dropdown.
    updated.workflowId = draftWorkflow?.id;

    updateRecipe(updated);
    if (draftWorkflow) updateWorkflow(draftWorkflow);
    router.push('/recipes');
  }

  const isDirty =
    JSON.stringify(draft) !== JSON.stringify(recipeToDraft(original)) ||
    draftKind !== original.kind ||
    draftIsPrep !== (original.isPrep ?? false) ||
    (draftWorkflow && original.workflowId
      ? JSON.stringify(draftWorkflow) !== JSON.stringify(allWorkflows[original.workflowId])
      : false);

  const saveDisabled = draft.name.trim().length === 0;
  const canPublish =
    draft.name.trim() &&
    draft.category &&
    draft.components.some((c) => c.kind === 'recipe' || (c.kind === 'item' && c.name.trim()));

  const workflows = allWorkflows;

  return (
    <div style={{ padding: '20px 24px 130px', maxWidth: '1260px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      {/* Sticky header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          margin: '-20px -24px 14px',
          padding: '12px 24px',
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <button onClick={handleCancel} style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft size={14} /> Back
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
              Editing recipe
            </span>
            <KindPill kind={draftKind} isPrep={draftIsPrep} />
            {isDirty && (
              <span
                style={{
                  padding: '2px 8px', borderRadius: '100px',
                  background: 'rgba(241,180,52,0.18)', color: 'var(--color-warning)',
                  fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
                }}
              >
                Unsaved changes
              </span>
            )}
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {draft.name || <span style={{ color: 'var(--color-text-muted)' }}>Untitled recipe</span>}
          </div>
        </div>

        <button onClick={handleCancel} style={secondaryBtnStyle}>Cancel</button>
        <button
          onClick={handleSave}
          disabled={saveDisabled}
          style={{
            ...primaryBtnStyle,
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            opacity: saveDisabled ? 0.5 : 1, cursor: saveDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          <Save size={13} strokeWidth={2.4} /> Save changes
        </button>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 16px', lineHeight: 1.45 }}>
        Edit any field below. Workflow and sub-recipe sections appear if this recipe drives a production workflow or is built from components.
      </p>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

          {/* Core */}
          <Card>
            <FieldLabel required>Recipe name</FieldLabel>
            <input
              value={draft.name}
              onChange={(e) => patch('name', e.target.value)}
              placeholder="e.g. Flat white (8oz)"
              style={nameInputStyle}
            />

            <div style={{ marginTop: '16px' }}>
              <FieldLabel>Category</FieldLabel>
              <PillSingle
                options={ALL_CATEGORIES}
                selected={draft.category}
                onChange={(v) => {
                  patch('category', (v as FormCategory | ''));
                  if (v) applyCategoryDefaults(v as FormCategory);
                }}
                allowClear
              />
            </div>

            <div style={{ marginTop: '16px' }}>
              <FieldLabel>Yield</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  min={0}
                  value={draft.yieldQty}
                  onChange={(e) => patch('yieldQty', e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ ...inputStyle, width: '80px', flexShrink: 0 }}
                />
                <PillSingle options={YIELD_UOMS} selected={draft.yieldUom} onChange={(v) => patch('yieldUom', v)} />
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <FieldLabel>Sites</FieldLabel>
              <PillMulti options={SITES} selected={draft.sites} onChange={(v) => patch('sites', v)} />
            </div>

            <div style={{ marginTop: '16px' }}>
              <FieldLabel>Type</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(['standalone', 'component', 'assembly'] as Recipe['kind'][]).map((k) => {
                  const on = draftKind === k;
                  const disabled = k === 'assembly' && (draftSubRecipes?.length ?? 0) === 0;
                  const label = k === 'standalone' ? 'Stand-alone' : k === 'component' ? 'Component' : 'Assembly';
                  return (
                    <button
                      key={k}
                      onClick={() => !disabled && setDraftKind(k)}
                      disabled={disabled}
                      title={disabled ? 'Add a sub-recipe first to make this an assembly' : undefined}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '100px',
                        border: on ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
                        background: on ? 'var(--color-accent-active)' : '#fff',
                        color: on ? '#fff' : 'var(--color-text-secondary)',
                        fontSize: '12px', fontWeight: 600,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontFamily: 'var(--font-primary)',
                        opacity: disabled ? 0.5 : 1,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
                <CheckRow label="Day-end prep" checked={draftIsPrep} onChange={setDraftIsPrep} />
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <FieldLabel>Inventory &amp; costing</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  {
                    key: 'countInStockTake' as const,
                    label: 'Count in stock take',
                    on: draft.countInStockTake,
                    hint: 'Include this recipe when counting physical inventory at stock take.',
                  },
                  {
                    key: 'excludeFromCogs' as const,
                    label: 'Exclude from COGs',
                    on: draft.excludeFromCogs,
                    hint: 'Skip this recipe in cost-of-goods calculations (e.g. comps, parent-rolled items).',
                  },
                ].map(({ key, label, on, hint }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => patch(key, !on)}
                    title={hint}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '100px',
                      border: on ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
                      background: on ? 'var(--color-accent-active)' : '#fff',
                      color: on ? '#fff' : 'var(--color-text-secondary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Ingredients (post-rethink) — typed, master/product-aware rows.
              This is also where sub-recipes / components are pulled in
              (replaces the legacy "Build steps & sub-recipes" card).
              Build order is top → bottom; use the up/down arrows to
              reorder. */}
          <Card>
            <SectionHeader
              title="Ingredients"
              hint="Search across master products, supplier SKUs, and your own sub-recipes / components in one place — pick whichever you recognise and Edify resolves the rest. Build order is top → bottom (use the row arrows to reorder). Use the Site qty button to set per-site quantities (e.g. 16g at Site A, 18g at Site B)."
            />
            <IngredientsV2Section
              rows={draft.ingredientsV2}
              sites={draft.sites.length > 0 ? draft.sites : SITES}
              onChange={(next) => patch('ingredientsV2', next)}
            />
          </Card>

          {/* Packaging (post-rethink) — same shape as Ingredients. Packaging
              IS just-a-product, so modifier replace / add / scale effects
              can target it the same way (e.g. a Large coffee swaps the
              8oz cup for a 12oz cup automatically). */}
          <Card>
            <SectionHeader
              title="Packaging"
              hint="Cups, lids, bags, labels — anything physical the order consumes. Listed here so modifiers can swap or add packaging (e.g. Large coffee → 12oz cup) without you maintaining a separate matching table."
            />
            <IngredientsV2Section
              rows={draft.packagingV2}
              sites={draft.sites.length > 0 ? draft.sites : SITES}
              onChange={(next) => patch('packagingV2', next)}
              itemLabel="packaging"
            />
          </Card>

          {/* POS & modifiers — sellability + catalogue-level modifier-group
              attachments. This is where the recipe becomes "menu-item-like":
              flip on POS-linked and attach the alt-milks / cup-sizes groups
              you already maintain in Manage modifier groups. */}
          <Card>
            <SectionHeader
              title="POS & modifiers"
              hint="Sellability + attached modifier groups. Toggle POS-linked once this recipe is ready to fire from the till. Attach catalogue-level modifier groups instead of duplicating variable ingredients across recipes."
            />
            <PosAndModifiersSection
              posLinked={draft.posLinked}
              posSourceId={draft.posSourceId}
              modifierGroupIds={draft.modifierGroupIds}
              allGroups={allGroups}
              onPatchPosLinked={(v) => patch('posLinked', v)}
              onPatchPosSourceId={(v) => patch('posSourceId', v)}
              onPatchGroups={(v) => patch('modifierGroupIds', v)}
            />
          </Card>

          {/* Slot-driven (advanced) section is hidden from the editor for
              now — the concept of named slots driving shared modifier
              groups isn't earning its complexity in user testing. The
              `draft.slots` field and the `SlotsSection` helper below are
              kept intact so:
                • Existing recipes that already carry slot data continue
                  to round-trip cleanly on save (see the save payload
                  builders that still reference `draft.slots`).
                • Re-enabling the surface is a one-block paste — render
                  <CollapsibleCard label="Slot-driven (advanced)"…> back
                  here and the wiring still works.  */}

          {/* Packaging */}
          <CollapsibleCard
            label="Packaging"
            hint={draft.packaging.length ? `${draft.packaging.length} row${draft.packaging.length === 1 ? '' : 's'}` : 'Cups, lids, boxes — cost rolls into takeaway / delivery pricing'}
            open={draft.showPackaging}
            onToggle={() => patch('showPackaging', !draft.showPackaging)}
          >
            <PackagingTable
              rows={draft.packaging}
              onChange={(rid, p) => patch('packaging', draft.packaging.map((r) => r.id === rid ? { ...r, ...p } : r))}
              onRemove={(rid) => patch('packaging', draft.packaging.filter((r) => r.id !== rid))}
              onAdd={() => patch('packaging', [...draft.packaging, emptyPackaging()])}
            />
          </CollapsibleCard>

          {/* Instructions */}
          <Card>
            <FieldLabel>Instructions <Soft>(optional)</Soft></FieldLabel>
            <textarea
              value={draft.instructions}
              onChange={(e) => patch('instructions', e.target.value)}
              placeholder="How the team should make this — prep, build, finish."
              rows={3}
              style={textareaStyle}
            />
          </Card>

          {/* Allergens */}
          <Card>
            <FieldLabel>Allergens <Soft>(optional)</Soft></FieldLabel>
            <PillMulti options={ALLERGENS} selected={draft.allergens} onChange={(v) => patch('allergens', v)} />
          </Card>

          {/* Photo */}
          <Card>
            <FieldLabel>Photo <Soft>(optional)</Soft></FieldLabel>
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '14px 16px', borderRadius: '10px',
                border: '1.5px dashed var(--color-border)',
                cursor: 'pointer',
                background: draft.photoName ? 'var(--color-success-light)' : 'var(--color-bg-hover)',
              }}
            >
              <ImageIcon size={18} color={draft.photoName ? 'var(--color-success)' : 'var(--color-text-muted)'} strokeWidth={1.8} />
              <span style={{ fontSize: '13px', color: draft.photoName ? 'var(--color-success)' : 'var(--color-text-secondary)', flex: 1 }}>
                {draft.photoName ?? 'Drop an image or click to upload'}
              </span>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => patch('photoName', e.target.files?.[0]?.name ?? null)}
              />
            </label>
          </Card>

          {/* Production flow — combined card for workflow attachment +
              diagram + stage editor. Was previously two separate cards
              ("Workflow stages" + "Production flow") which were
              conceptually the same area; the dropdown makes the
              workflow itself optional on a recipe. */}
          <CollapsibleCard
            label="Production flow"
            hint={
              draftWorkflow
                ? `Workflow ${draftWorkflow.id} · ${draftWorkflow.stages.length} stage${draftWorkflow.stages.length === 1 ? '' : 's'} across D-2 / D-1 / D0`
                : (draftSubRecipes?.length ?? 0) > 0
                  ? `${draftSubRecipes!.length} sub-recipe${draftSubRecipes!.length === 1 ? '' : 's'} · no workflow attached`
                  : 'Optional. Attach a workflow to see stages cascade across D-2 / D-1 / D0.'
            }
            open={showWorkflowSections}
            onToggle={() => setShowWorkflowSections((v) => !v)}
          >
            {/* Workflow attach dropdown — None or any catalogue workflow.
                Edits to a workflow affect every recipe sharing it. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <FieldLabel>Workflow <Soft>(optional)</Soft></FieldLabel>
              <select
                value={draftWorkflow?.id ?? ''}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) {
                    setDraftWorkflow(null);
                  } else if (allWorkflows[id]) {
                    setDraftWorkflow(cloneWorkflow(allWorkflows[id]));
                  }
                }}
                style={{ ...selectStyle, width: 280 }}
              >
                <option value="">— None —</option>
                {Object.values(allWorkflows).map((wf) => (
                  <option key={wf.id} value={wf.id}>
                    {wf.id} ({wf.stages.length} stage{wf.stages.length === 1 ? '' : 's'})
                  </option>
                ))}
              </select>
              {draftWorkflow && (
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Edits apply to every recipe sharing this workflow.
                </span>
              )}
            </div>

            {/* Diagram — visible whenever there's something to draw
                (workflow attached OR sub-recipes present). */}
            {((draftSubRecipes?.length ?? 0) > 0 || draftWorkflow) ? (
              <>
                <WorkflowDiagram
                  recipe={{ ...original, subRecipes: draftSubRecipes }}
                  recipesById={recipesById}
                  workflows={
                    draftWorkflow
                      ? { ...workflows, [draftWorkflow.id]: draftWorkflow }
                      : workflows
                  }
                />
                <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {kindToModeLabel({ ...original, kind: draftKind, isPrep: draftIsPrep })}
                  {draft.shelfLifeValue !== '' && (
                    <> · Shelf life {formatShelfLife(shelfLifeToMinutes(draft.shelfLifeValue, draft.shelfLifeUnit) ?? 0)}</>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: '12px', fontSize: 12, color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)', borderRadius: 8 }}>
                No workflow attached and no sub-recipes in this recipe yet. Pick a workflow above to add stages, or add a sub-recipe in the Ingredients section.
              </div>
            )}

            {/* Stage editor — only when a workflow is attached. */}
            {draftWorkflow && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border-subtle)' }}>
                <SectionHeader
                  title="Stages"
                  hint="Reorder, rename, or add stages. Stages on a shared workflow affect every recipe using it."
                />
                <WorkflowEditor
                  workflow={draftWorkflow}
                  onChange={(updater) => setDraftWorkflow((wf) => (wf ? updater(wf) : wf))}
                />
              </div>
            )}
          </CollapsibleCard>

          {/* Production settings */}
          <CollapsibleCard
            label="Production settings"
            hint="Visibility, prep time, key ingredients, batch sizes"
            open={draft.showProduction}
            onToggle={() => patch('showProduction', !draft.showProduction)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <FieldLabel>Production visibility</FieldLabel>
                <PillMulti options={PRODUCTION_VIS} selected={draft.productionVis} onChange={(v) => patch('productionVis', v)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <FieldLabel>Preparation time (seconds)</FieldLabel>
                  <input
                    type="number"
                    value={draft.prepSec}
                    onChange={(e) => patch('prepSec', e.target.value === '' ? '' : Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel>Production reference</FieldLabel>
                  <input
                    type="text"
                    value={draft.productionRef}
                    onChange={(e) => patch('productionRef', e.target.value)}
                    placeholder="e.g. PR-FW-8OZ"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Key ingredients <Soft>(used for menu filtering)</Soft></FieldLabel>
                <TagInput value={draft.keyIngredients} onChange={(v) => patch('keyIngredients', v)} placeholder="Type and press Enter" />
              </div>

              <div>
                <FieldLabel>Recipe tags</FieldLabel>
                <TagInput value={draft.tags} onChange={(v) => patch('tags', v)} placeholder="Type and press Enter" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <FieldLabel>Min batch size</FieldLabel>
                  <input
                    type="number"
                    value={draft.minBatch}
                    onChange={(e) => patch('minBatch', e.target.value === '' ? '' : Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel>Max batch size</FieldLabel>
                  <input
                    type="text"
                    value={draft.maxBatch === 'unlimited' ? 'unlimited' : String(draft.maxBatch)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || v === 'unlimited') patch('maxBatch', v as '' | 'unlimited');
                      else if (!isNaN(Number(v))) patch('maxBatch', Number(v));
                    }}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel>Batch multiple</FieldLabel>
                  <input
                    type="number"
                    value={draft.batchMultiple}
                    onChange={(e) => patch('batchMultiple', e.target.value === '' ? '' : Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </CollapsibleCard>

          {/* Advanced */}
          <CollapsibleCard
            label="Advanced"
            hint="Status, shelf life, bakery/hot production, carry-over, PCR, used-for"
            open={draft.showAdvanced}
            onToggle={() => patch('showAdvanced', !draft.showAdvanced)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <FieldLabel>Status</FieldLabel>
                <select
                  value={draft.status}
                  onChange={(e) => patch('status', e.target.value)}
                  style={{ ...selectStyle, maxWidth: '220px' }}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Product class</FieldLabel>
                <PillSingle options={PRODUCT_CLASSES} selected={draft.productClass} onChange={(v) => patch('productClass', v)} allowClear />
              </div>

              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <CheckRow label="Sub-recipe" checked={draft.isSubRecipe} onChange={(v) => patch('isSubRecipe', v)} />
              </div>

              <div>
                <FieldLabel>Shelf life</FieldLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    value={draft.shelfLifeValue}
                    onChange={(e) => patch('shelfLifeValue', e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ ...inputStyle, width: '100px', flexShrink: 0 }}
                  />
                  <PillSingle options={SHELF_LIFE_UNITS} selected={draft.shelfLifeUnit} onChange={(v) => patch('shelfLifeUnit', v as ShelfLifeUnit)} />
                </div>
              </div>

              <div>
                <FieldLabel>Closing range</FieldLabel>
                <input
                  type="text"
                  value={draft.closingRange}
                  onChange={(e) => patch('closingRange', e.target.value)}
                  placeholder="e.g. 1–5"
                  style={{ ...inputStyle, maxWidth: '220px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <CheckRow label="Allow carry-over" checked={draft.allowCarryOver} onChange={(v) => patch('allowCarryOver', v)} />
                <CheckRow label="Enable preparation PCR" checked={draft.enablePcr} onChange={(v) => patch('enablePcr', v)} />
              </div>

              <div>
                <FieldLabel>Used for <Soft>(assembly names — which meals/combos use this)</Soft></FieldLabel>
                <TagInput value={draft.usedFor} onChange={(v) => patch('usedFor', v)} placeholder="Add assembly name and press Enter" />
              </div>
            </div>
          </CollapsibleCard>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────── */}
        <div style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <PriceCard
            totalCost={totalCost}
            ingredientCost={ingredientCost}
            packagingCost={packagingCost}
            desiredMargin={draft.desiredMargin}
            onDesiredMargin={(v) => patch('desiredMargin', v)}
            vatPct={draft.vatPct}
            onVat={(v) => patch('vatPct', v)}
            hotCold={draft.hotCold}
            onHotCold={(v) => patch('hotCold', v)}
            srpDineInEx={draft.srpDineInEx}
            onSrpDineIn={(v) => patch('srpDineInEx', v)}
            marginDineIn={marginPct(draft.srpDineInEx)}
            srpIncDineIn={srpInc(draft.srpDineInEx, draft.vatPct)}
            srpTakeawayEx={draft.srpTakeawayEx}
            onSrpTakeaway={(v) => patch('srpTakeawayEx', v)}
            marginTakeaway={marginPct(draft.srpTakeawayEx)}
            srpIncTakeaway={srpInc(draft.srpTakeawayEx, draft.vatPct)}
            srpDeliveryEx={draft.srpDeliveryEx}
            onSrpDelivery={(v) => patch('srpDeliveryEx', v)}
            deliveryCommission={draft.deliveryCommission}
            onDeliveryCommission={(v) => patch('deliveryCommission', v)}
            marginDelivery={marginPct(draft.srpDeliveryEx, Number(draft.deliveryCommission) || 0)}
            srpIncDelivery={srpInc(draft.srpDeliveryEx, draft.vatPct)}
          />

          {/* What gets sold — live preview of the resolved composition for
              the current modifier selection. Folds the recipe's
              ingredientsV2 + slots + attached modifier groups through the
              resolver so the user can sanity-check what fires when this
              recipe is ordered with various options. */}
          <WhatGetsSoldPreview
            recipe={original}
            draft={draft}
            allGroups={allGroups}
            onPreviewChange={(next) => patch('previewByGroup', next)}
          />

          {usedInIds.length > 0 && (
            <div
              style={{
                background: '#fff', border: '1px solid var(--color-border-subtle)',
                borderRadius: '12px', padding: '16px',
              }}
            >
              <div
                style={{
                  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '12px',
                }}
              >
                Used in (sub-recipe)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {usedInIds.map((parentId) => {
                  const parent = recipesById.get(parentId);
                  if (!parent) return null;
                  return (
                    <button
                      key={parentId}
                      onClick={() => router.push(`/recipes/${parentId}/edit`)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                        padding: '7px 11px', borderRadius: '8px',
                        border: '1px solid var(--color-border-subtle)',
                        background: '#fff', cursor: 'pointer',
                        fontFamily: 'var(--font-primary)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                    >
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{parent.name}</span>
                      <KindPill kind={parent.kind} isPrep={parent.isPrep} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Sticky bottom bar */}
      <div
        style={{
          position: 'fixed',
          left: 0, right: 0, bottom: 0,
          padding: '14px 24px',
          background: 'rgba(255,255,255,0.96)',
          borderTop: '1px solid var(--color-border-subtle)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', zIndex: 150,
        }}
      >
        <div style={{ maxWidth: '1260px', width: '100%', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
            {canPublish
              ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Ready to save</span>
              : 'Add a name, category, and at least one ingredient.'}
          </div>
          <button onClick={handleCancel} style={secondaryBtnStyle}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saveDisabled}
            style={{
              ...primaryBtnStyle,
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              opacity: saveDisabled ? 0.5 : 1, cursor: saveDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            <Save size={13} strokeWidth={2.4} /> Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── POS & modifiers section ──────────────────────────────────────────────────

function PosAndModifiersSection({
  posLinked, posSourceId, modifierGroupIds, allGroups,
  onPatchPosLinked, onPatchPosSourceId, onPatchGroups,
}: {
  posLinked: boolean;
  posSourceId: string;
  modifierGroupIds: string[];
  allGroups: ReturnType<typeof useModifierGroups>;
  onPatchPosLinked: (v: boolean) => void;
  onPatchPosSourceId: (v: string) => void;
  onPatchGroups: (v: string[]) => void;
}) {
  type DrawerState =
    | { open: false }
    | { open: true; mode: 'create' }
    | { open: true; mode: 'edit'; group: ModifierGroup };
  const [drawer, setDrawer] = useState<DrawerState>({ open: false });

  function toggle(id: string) {
    onPatchGroups(modifierGroupIds.includes(id)
      ? modifierGroupIds.filter((g) => g !== id)
      : [...modifierGroupIds, id]);
  }
  function openCreate() {
    setDrawer({ open: true, mode: 'create' });
  }
  function openEdit(group: ModifierGroup) {
    setDrawer({ open: true, mode: 'edit', group });
  }
  function handleSaved(group: ModifierGroup) {
    // Create mode: auto-attach the new group. Edit mode: catalogue
    // already updated via upsertGroup; pills re-render on the
    // useModifierGroups subscription.
    if (drawer.open && drawer.mode === 'create') {
      if (!modifierGroupIds.includes(group.id)) {
        onPatchGroups([...modifierGroupIds, group.id]);
      }
    }
  }
  function handleDeleted(id: string) {
    if (modifierGroupIds.includes(id)) {
      onPatchGroups(modifierGroupIds.filter((g) => g !== id));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'flex-end' }}>
        <div>
          <FieldLabel>POS link</FieldLabel>
          <label
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8,
              border: '1px solid var(--color-border-subtle)',
              background: posLinked ? 'rgba(3,28,89,0.05)' : '#fff',
              cursor: 'pointer', fontFamily: 'var(--font-primary)', fontSize: 13,
              color: posLinked ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={posLinked}
              onChange={(e) => onPatchPosLinked(e.target.checked)}
              style={{ margin: 0 }}
            />
            {posLinked ? 'Sellable on POS' : 'Internal / not sold'}
          </label>
        </div>
        <div>
          <FieldLabel>POS source id <Soft>(optional)</Soft></FieldLabel>
          <input
            value={posSourceId}
            onChange={(e) => onPatchPosSourceId(e.target.value)}
            placeholder="e.g. pos-mi-latte"
            style={inputStyle}
            disabled={!posLinked}
          />
        </div>
      </div>

      <div>
        <FieldLabel>Modifier groups <Soft>({modifierGroupIds.length} attached)</Soft></FieldLabel>
        {allGroups.length === 0 ? (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--color-bg-hover)',
              fontSize: 12.5, color: 'var(--color-text-muted)',
            }}
          >
            <span>No modifier groups yet.</span>
            <button type="button" onClick={openCreate} style={newGroupChip}>
              <Plus size={12} strokeWidth={2.4} /> Create one now
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {allGroups.map((g) => {
              const on = modifierGroupIds.includes(g.id);
              return (
                <span
                  key={g.id}
                  style={{
                    display: 'inline-flex', alignItems: 'stretch',
                    borderRadius: 100, overflow: 'hidden',
                    border: on ? '1px solid var(--color-accent-active)' : '1px solid var(--color-border-subtle)',
                    background: on ? 'rgba(3,28,89,0.06)' : '#fff',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggle(g.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 11px', border: 'none', background: 'transparent',
                      color: on ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
                      fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    <span style={{
                      width: 14, height: 14, borderRadius: 4,
                      border: '1.5px solid ' + (on ? 'var(--color-accent-active)' : 'var(--color-border)'),
                      background: on ? 'var(--color-accent-active)' : '#fff',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {on && <span style={{ width: 6, height: 6, borderRadius: 1, background: '#fff' }} />}
                    </span>
                    {g.name}
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      · {g.options.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(g)}
                    title={`Edit "${g.name}"`}
                    aria-label={`Edit ${g.name}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 9px', border: 'none',
                      borderLeft: '1px solid ' + (on ? 'rgba(3,28,89,0.20)' : 'var(--color-border-subtle)'),
                      background: 'transparent',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <Pencil size={11} />
                  </button>
                </span>
              );
            })}
            <button type="button" onClick={openCreate} style={newGroupChip}>
              <Plus size={12} strokeWidth={2.4} /> New modifier group
            </button>
          </div>
        )}
      </div>

      <GroupEditorDrawer
        open={drawer.open}
        mode={drawer.open && drawer.mode === 'edit' ? 'edit' : 'create'}
        initial={drawer.open && drawer.mode === 'edit' ? drawer.group : null}
        onClose={() => setDrawer({ open: false })}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </div>
  );
}

const newGroupChip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 11px', borderRadius: 100,
  border: '1px dashed var(--color-border)', background: '#fff',
  color: 'var(--color-text-secondary)',
  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

// ── Slots section (advanced) ─────────────────────────────────────────────────

function SlotsSection({
  slots, onChange,
}: {
  slots: RecipeSlot[];
  onChange: (next: RecipeSlot[]) => void;
}) {
  function patchAt(i: number, p: Partial<RecipeSlot>) {
    onChange(slots.map((s, idx) => idx === i ? { ...s, ...p } : s));
  }
  function removeAt(i: number) {
    onChange(slots.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([
      ...slots,
      { key: `slot-${slots.length + 1}`, label: `Slot ${slots.length + 1}` },
    ]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
        Slots are ingredient placeholders that <code>set-slot</code> modifier effects can target.
        Use this for the spirit (one Spirit measure group targets every spirit recipe), wine (no
        default pour size), or sized-portion patterns.
      </div>
      {slots.map((s, i) => (
        <div
          key={i}
          style={{
            border: '1px solid var(--color-border-subtle)', borderRadius: 10,
            padding: 12, background: 'var(--color-bg-hover)',
            display: 'grid', gridTemplateColumns: '180px 1fr 220px auto', gap: 10, alignItems: 'flex-end',
          }}
        >
          <div>
            <FieldLabel>Key</FieldLabel>
            <input
              value={s.key}
              onChange={(e) => patchAt(i, { key: e.target.value })}
              placeholder="e.g. spirit"
              style={inputStyle}
            />
          </div>
          <div>
            <FieldLabel>Label</FieldLabel>
            <input
              value={s.label}
              onChange={(e) => patchAt(i, { label: e.target.value })}
              placeholder="e.g. Spirit"
              style={inputStyle}
            />
          </div>
          <div>
            <FieldLabel>Default ingredient <Soft>(optional)</Soft></FieldLabel>
            <IngredientRefPicker
              value={s.defaultRef}
              onChange={(ref) => patchAt(i, { defaultRef: ref })}
              placeholder="Pick default…"
            />
          </div>
          <button
            type="button"
            onClick={() => removeAt(i)}
            style={{
              padding: '7px 10px', borderRadius: 8,
              border: '1px solid var(--color-border-subtle)', background: '#fff',
              fontSize: 12, fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-secondary)', cursor: 'pointer',
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        style={{
          alignSelf: 'flex-start',
          padding: '7px 12px', borderRadius: 8,
          border: '1px dashed var(--color-border)',
          background: '#fff', fontSize: 12.5, fontWeight: 600,
          color: 'var(--color-text-secondary)', cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
        }}
      >
        + Add slot
      </button>
    </div>
  );
}

// ── What gets sold (live resolver preview) ───────────────────────────────────

function WhatGetsSoldPreview({
  recipe, draft, allGroups, onPreviewChange,
}: {
  recipe: Recipe;
  draft: FormDraft;
  allGroups: ReturnType<typeof useModifierGroups>;
  onPreviewChange: (next: Record<string, string[]>) => void;
}) {
  // Build a draft Recipe from the current form state so the resolver sees
  // the editor's pending changes (not what's on disk).
  const draftRecipe: Recipe = useMemo(() => ({
    ...recipe,
    name: draft.name.trim() || recipe.name,
    ingredientsV2: draft.ingredientsV2.length > 0 ? draft.ingredientsV2 : undefined,
    packagingV2: draft.packagingV2.length > 0 ? draft.packagingV2 : undefined,
    modifierGroupIds: draft.modifierGroupIds.length > 0 ? draft.modifierGroupIds : undefined,
    slots: draft.slots.length > 0 ? draft.slots : undefined,
    posLinked: draft.posLinked,
  }), [recipe, draft.name, draft.ingredientsV2, draft.packagingV2, draft.modifierGroupIds, draft.slots, draft.posLinked]);

  const attached = useMemo(
    () => (draftRecipe.modifierGroupIds ?? [])
      .map((id) => allGroups.find((g) => g.id === id))
      .filter((g): g is NonNullable<typeof g> => !!g),
    [draftRecipe.modifierGroupIds, allGroups],
  );

  // Default-fill any group that has no explicit selection so the preview
  // matches what a customer with no modifier picks would see.
  const effectiveSelection: Record<string, string[]> = useMemo(() => {
    const out: Record<string, string[]> = { ...draft.previewByGroup };
    for (const g of attached) {
      if (out[g.id] !== undefined) continue;
      const defaults = g.options.filter((o) => o.isDefault).map((o) => o.id);
      out[g.id] = defaults;
    }
    return out;
  }, [attached, draft.previewByGroup]);

  const resolved = useMemo(() => applyModifiers({
    recipe: draftRecipe,
    selectedOptionIds: defaultSelectionFor(draftRecipe),
    selectedByGroup: effectiveSelection,
    siteId: draft.sites[0],
  }), [draftRecipe, effectiveSelection, draft.sites]);

  function toggleOption(group: ReturnType<typeof useModifierGroups>[number], optionId: string) {
    const current = effectiveSelection[group.id] ?? [];
    let next: string[];
    if (group.selection === 'one') {
      next = current.includes(optionId) ? [] : [optionId];
    } else {
      next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
    }
    onPreviewChange({ ...draft.previewByGroup, [group.id]: next });
  }

  return (
    <div
      style={{
        background: '#fff', border: '1px solid var(--color-border-subtle)',
        borderRadius: '12px', padding: '16px',
      }}
    >
      <div
        style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        What gets sold
        <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
          {resolved.lines.length} line{resolved.lines.length === 1 ? '' : 's'}
        </span>
      </div>

      {!draft.posLinked && (
        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 10 }}>
          Not POS-linked — modifier groups won&apos;t fire on the till. Toggle POS link in the
          &ldquo;POS &amp; modifiers&rdquo; section to enable.
        </div>
      )}

      {attached.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
          No modifier groups attached yet. Preview shows the base composition only.
        </div>
      )}

      {attached.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {attached.map((g) => {
            const selected = effectiveSelection[g.id] ?? [];
            return (
              <div key={g.id}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  {g.name}{' '}
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    · {g.selection === 'one' ? 'pick one' : 'pick many'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {g.options.map((opt) => {
                    const on = selected.includes(opt.id);
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => toggleOption(g, opt.id)}
                        style={{
                          padding: '4px 9px', borderRadius: 100,
                          border: on
                            ? '1px solid var(--color-accent-active)'
                            : '1px solid var(--color-border-subtle)',
                          background: on ? 'rgba(3,28,89,0.06)' : '#fff',
                          color: on ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
                          fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                          fontFamily: 'var(--font-primary)',
                        }}
                      >
                        {opt.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {resolved.lines.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            No resolved ingredients. Add ingredients above or fill in a slot default.
          </div>
        ) : (
          resolved.lines.map((ln) => (
            <PreviewLine key={ln.id} ingredient={ln.ref} name={ln.name} qty={ln.qty} source={ln.source} />
          ))
        )}
      </div>

      {resolved.warnings.length > 0 && (
        <div style={{
          marginTop: 10, padding: '8px 10px',
          background: 'rgba(241,180,52,0.12)', border: '1px solid rgba(241,180,52,0.4)',
          borderRadius: 8,
        }}>
          {resolved.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 11.5, color: 'var(--color-warning)' }}>{w}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewLine({
  ingredient, name, qty, source,
}: {
  ingredient: IngredientRef;
  name: string;
  qty: { value: number; unit: string };
  source: ReturnType<typeof applyModifiers>['lines'][number]['source'];
}) {
  const resolved = resolveIngredientRef(ingredient);
  const tone = source.kind === 'recipe-base'
    ? 'base'
    : source.kind === 'recipe-packaging'
      ? 'pkg'
      : source.kind === 'slot'
        ? 'slot'
        : 'mod';
  const toneStyles: Record<typeof tone, React.CSSProperties> = {
    base: { background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' },
    pkg:  { background: 'rgba(82,170,150,0.16)', color: 'var(--color-success, #347262)' },
    slot: { background: 'rgba(241,180,52,0.16)', color: 'var(--color-warning)' },
    mod:  { background: 'rgba(3,28,89,0.08)', color: 'var(--color-accent-active)' },
  };
  const label = source.kind === 'recipe-base'
    ? 'base'
    : source.kind === 'recipe-packaging'
      ? 'packaging'
      : source.kind === 'slot'
        ? `slot · ${source.slotKey}`
        : source.kind === 'modifier-add'
          ? 'add'
          : source.kind === 'modifier-replace'
            ? 'replace'
            : `× ${source.factor}`;
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center',
        padding: '6px 9px', borderRadius: 7,
        border: '1px solid var(--color-border-subtle)', background: '#fff',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
        {resolved?.master && !resolved.product && (
          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 500, color: 'var(--color-text-muted)' }}>master</span>
        )}
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
        {qty.value}{qty.unit}
      </span>
      <span style={{
        padding: '2px 7px', borderRadius: 100, fontSize: 9.5, fontWeight: 700,
        letterSpacing: '0.04em', textTransform: 'uppercase', ...toneStyles[tone],
      }}>
        {label}
      </span>
    </div>
  );
}

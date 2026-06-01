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
import { ArrowLeft, Save, Image as ImageIcon, Pencil, Plus, X } from 'lucide-react';
import {
  type Recipe,
  type RecipeCategory,
  type ComponentRow,
  type ItemComponent,
  type RecipeComponent,
  type RecipeIngredient,
  type RecipeSlot,
  type RecipeVariant,
  flattenDimensionsToVariants,
  buildUsedInIndex,
} from '@/components/Recipe/libraryFixtures';
import { IngredientsV2Section } from '@/components/Recipe/IngredientsV2Section';
import { VariantsSection } from '@/components/Recipe/VariantsSection';
import { RecipeCompositionSection } from '@/components/Recipe/RecipeCompositionSection';
import StyledSelect from '@/components/ui/StyledSelect';
import { useModifierGroups } from '@/components/Modifiers/store';
import type { ModifierGroup } from '@/components/Modifiers/types';
import { GroupEditorDrawer } from '@/components/Modifiers/GroupEditorDrawer';
import {
  applyModifiers,
  defaultSelectionFor,
} from '@/components/Recipe/resolver';
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
  STATUSES,
  YIELD_UOMS,
  SHELF_LIFE_UNITS,
  type ShelfLifeUnit,
  BAKERY_HOT_PRODUCTION,
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
  HelpTip,
  PillMulti,
  PillSingle,
  TagInput,
  CheckRow,
  ComponentTable,
  VariableTable,
  PackagingTable,
  PriceCard,
  CollapsibleSidebar,
  usePersistedBoolean,
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
  /** Variants (flat). Each variant is a full alternative composition
   *  of the recipe (its own ingredients, packaging, modifier groups,
   *  prices). When non-empty, the customer must pick exactly one for
   *  the recipe to be orderable. */
  variants: RecipeVariant[];
  /** Live preview selection state, keyed by group id → option ids. Not
   *  persisted; resets when the editor remounts. */
  previewByGroup: Record<string, string[]>;
  /** Live preview: which variant is currently selected in the preview.
   *  Empty string when no variants exist. Not persisted. */
  previewVariantId: string;
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
  expiryDate: string;
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

function cloneRecipeIngredient(ri: RecipeIngredient): RecipeIngredient {
  return {
    ...ri,
    baseQty: { ...ri.baseQty },
    siteOverrides: ri.siteOverrides ? { ...ri.siteOverrides } : undefined,
    tags: ri.tags ? [...ri.tags] : undefined,
  };
}

function cloneVariant(v: RecipeVariant): RecipeVariant {
  return {
    ...v,
    ingredients: v.ingredients.map(cloneRecipeIngredient),
    packaging: v.packaging.map(cloneRecipeIngredient),
    modifierGroupIds: [...v.modifierGroupIds],
  };
}

function recipeToDraft(r: Recipe): FormDraft {
  const fx = r.formExtras ?? {};
  const sl = minutesToShelfLife(r.production.shelfLifeMinutes);
  // Prefer the new flat `variants` shape. Legacy fixtures that still
  // carry `variantDimensions` get flattened into a working list here
  // — first dimension's options become variants; a second axis is
  // dropped on purpose (the new model intentionally caps at one
  // axis per recipe). The flatten is read-only; the migration is
  // committed on save.
  const seedVariants: RecipeVariant[] = r.variants && r.variants.length > 0
    ? r.variants.map(cloneVariant)
    : (flattenDimensionsToVariants(
        r.variantDimensions,
        r.ingredientsV2 ?? [],
        r.packagingV2 ?? [],
        r.modifierGroupIds ?? [],
        {
          dineIn: r.priceDineIn,
          takeaway: r.priceTakeaway,
          delivery: r.priceDelivery,
        },
      ) ?? []);
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
    variants: seedVariants,
    previewByGroup: {},
    previewVariantId: seedVariants.find((v) => v.isDefault)?.id ?? seedVariants[0]?.id ?? '',
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
    expiryDate: fx.advanced?.expiryDate ?? r.production.expiryDate ?? '',
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
    variants: draft.variants.length > 0 ? draft.variants : undefined,
    // Clear the legacy dimension shape on save — once a recipe is
    // edited through this UI it lives in `variants`. Without this the
    // resolver would still see the old dimensions and double up.
    variantDimensions: undefined,
    subRecipes,
    production: {
      visibility: productionVisibility,
      shelfLifeMinutes,
      prepTimeSeconds: typeof draft.prepSec === 'number' ? draft.prepSec : null,
      expiryDate: draft.expiryDate || null,
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
        expiryDate: draft.expiryDate,
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
  const [draftWorkflow, setDraftWorkflow] = useState<ProductionWorkflow | null>(
    () => (original.workflowId && allWorkflows[original.workflowId]
      ? cloneWorkflow(allWorkflows[original.workflowId])
      : null),
  );
  const [showWorkflowSections, setShowWorkflowSections] = useState<boolean>(
    !!(original.subRecipes?.length || original.workflowId),
  );

  // Right-column collapse — persisted across sessions so power users who
  // prefer the wide form don't have to re-collapse every visit. Shared key
  // with the manual-intake page so the preference carries between flows.
  // Default = collapsed: most of the time users are editing composition,
  // not tweaking margins, so the wide form is the better starting state.
  // Key is `.v2` to discard the earlier `false` default that some sessions
  // may have already persisted.
  const [priceCollapsed, setPriceCollapsed] = usePersistedBoolean('recipe.priceSidebar.collapsed.v2', true);

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
        <button onClick={handleCancel} style={{ ...secondaryBtnStyle, padding: '8px 13px', fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft size={15} /> Back
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
              Editing recipe
            </span>
            <KindPill kind={draftKind} isPrep={original.isPrep} />
            {isDirty && (
              <span
                style={{
                  padding: '3px 9px', borderRadius: '100px',
                  background: 'rgba(241,180,52,0.18)', color: 'var(--color-warning)',
                  fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em',
                }}
              >
                Unsaved changes
              </span>
            )}
          </div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          <Save size={14} strokeWidth={2.4} /> Save changes
        </button>
      </div>

      <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
        Edit any field below. Workflow and sub-recipe sections appear if this recipe drives a production workflow or is built from components.
      </p>

      {/* Two-column layout. The right column collapses to a 44px rail so
          users can reclaim ~300px of form width when they don't need the
          pricing panel. Grid-template-columns animates between the two
          widths for a smooth transition. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: priceCollapsed ? '1fr 44px' : '1fr 340px',
          gap: '24px', alignItems: 'start',
          transition: 'grid-template-columns 0.22s ease',
        }}
      >

        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

          {/* Core */}
          <Card>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <FieldLabel required>Recipe name</FieldLabel>
                <input
                  value={draft.name}
                  onChange={(e) => patch('name', e.target.value)}
                  placeholder="e.g. Flat white (8oz)"
                  style={nameInputStyle}
                />
              </div>
              <div style={{ minWidth: '180px' }}>
                <FieldLabel>Status</FieldLabel>
                <select
                  value={draft.status}
                  onChange={(e) => patch('status', e.target.value)}
                  style={{ ...selectStyle, width: '180px' }}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <FieldLabel>Product class</FieldLabel>
              <StyledSelect
                width={260}
                value={draft.category}
                onChange={(e) => {
                  const v = e.target.value;
                  patch('category', (v as FormCategory | ''));
                  if (v) applyCategoryDefaults(v as FormCategory);
                }}
              >
                <option value="">— None —</option>
                {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </StyledSelect>
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
                <StyledSelect
                  width={140}
                  value={draft.yieldUom}
                  onChange={(e) => patch('yieldUom', e.target.value)}
                >
                  {YIELD_UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
                </StyledSelect>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <FieldLabel>Sites</FieldLabel>
              <PillMulti
                options={SITES}
                selected={draft.sites}
                onChange={(v) => patch('sites', v)}
                size="sm"
                selectAll={{ allLabel: 'All sites', clearLabel: 'Clear all' }}
              />
            </div>

            <div style={{ marginTop: '16px' }}>
              <FieldLabel
                help={
                  <>
                    <strong>Stand-alone</strong>: sold on its own (most recipes).{' '}
                    <strong>Component</strong>: used inside other recipes (e.g. a sauce, a base mix).{' '}
                    <strong>Assembly</strong>: built from sub-recipes (e.g. a sandwich whose bread + filling are their own recipes).
                  </>
                }
              >
                Type
              </FieldLabel>
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
                        padding: '7px 13px',
                        borderRadius: '100px',
                        border: on ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
                        background: on ? 'var(--color-accent-active)' : '#fff',
                        color: on ? '#fff' : 'var(--color-text-secondary)',
                        fontSize: '13px', fontWeight: 600,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontFamily: 'var(--font-primary)',
                        opacity: disabled ? 0.5 : 1,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <FieldLabel
                help={
                  <>
                    <strong>Count in stock take</strong>: include when counting physical inventory.{' '}
                    <strong>Exclude from COGs</strong>: skip in cost-of-goods calculations (e.g. comps, parent-rolled items).
                  </>
                }
              >
                Inventory &amp; costing
              </FieldLabel>
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
                      padding: '7px 13px',
                      borderRadius: '100px',
                      border: on ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
                      background: on ? 'var(--color-accent-active)' : '#fff',
                      color: on ? '#fff' : 'var(--color-text-secondary)',
                      fontSize: '13px',
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

          {/* Composition — ingredients / packaging / modifiers / variants /
              allergens / instructions / photo.  All composition concerns
              live here; settings (type, costing, production) follow. */}
          <RecipeCompositionSection
            ingredients={draft.ingredientsV2}
            packaging={draft.packagingV2}
            modifierGroupIds={draft.modifierGroupIds}
            variants={draft.variants}
            basePrices={{
              dineIn: typeof draft.srpDineInEx === 'number' ? draft.srpDineInEx : 0,
              takeaway: typeof draft.srpTakeawayEx === 'number' ? draft.srpTakeawayEx : 0,
              delivery: typeof draft.srpDeliveryEx === 'number' ? draft.srpDeliveryEx : 0,
            }}
            allergens={draft.allergens}
            instructions={draft.instructions}
            photoName={draft.photoName}
            sites={draft.sites}
            onIngredientsChange={(next) => patch('ingredientsV2', next)}
            onPackagingChange={(next) => patch('packagingV2', next)}
            onModifierGroupsChange={(next) => patch('modifierGroupIds', next)}
            onVariantsChange={(next) => {
              // Keep the live preview pointed at a still-existing variant.
              if (next.length > 0 && !next.some((v) => v.id === draft.previewVariantId)) {
                const fallback = next.find((v) => v.isDefault)?.id ?? next[0].id;
                setDraft((d) => ({ ...d, variants: next, previewVariantId: fallback }));
                return;
              }
              if (next.length === 0 && draft.previewVariantId) {
                setDraft((d) => ({ ...d, variants: next, previewVariantId: '' }));
                return;
              }
              patch('variants', next);
            }}
            onAllergensChange={(next) => patch('allergens', next)}
            onInstructionsChange={(v) => patch('instructions', v)}
            onPhotoChange={(name) => patch('photoName', name)}
          />

          {/* Legacy free-text packaging — only shown for recipes that were
              saved before the packagingV2 model existed and have never
              been through the new editor. Hidden once packagingV2 or
              variants are in use. */}
          {draft.packaging.length > 0 && draft.packagingV2.length === 0 && draft.variants.length === 0 && (
            <CollapsibleCard
              label="Packaging (legacy)"
              hint={`${draft.packaging.length} row${draft.packaging.length === 1 ? '' : 's'} — migrate to the Packaging card above to use the new model`}
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
          )}

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

          {/* Production settings — everything operational: visibility,
              bakery/hot, prep time, key ingredients, tags, batch sizes,
              sub-recipe flag, shelf life, closing range, carry-over, PCR,
              used-for. Status (lifecycle) lives at the top of Basics; the
              former "Status & stocking" card is gone. */}
          <CollapsibleCard
            label="Production settings"
            hint="Visibility, prep time, batch sizes, shelf life, stocking & production flags"
            open={draft.showProduction}
            onToggle={() => patch('showProduction', !draft.showProduction)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <FieldLabel help="Where this recipe shows up in production — Bar (drinks), Kitchen (food), Pastry, or Variable (assigned at order time).">
                  Production visibility
                </FieldLabel>
                <PillMulti options={PRODUCTION_VIS} selected={draft.productionVis} onChange={(v) => patch('productionVis', v)} />
              </div>

              <div>
                <FieldLabel help="Does this recipe come from the bakery, from hot production, both, or neither? Drives production routing and KDS workflows.">
                  Bakery / hot production
                </FieldLabel>
                <PillSingle options={BAKERY_HOT_PRODUCTION} selected={draft.bakeryHot} onChange={(v) => patch('bakeryHot', v)} />
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
                  <FieldLabel help="Optional code used to cross-reference this recipe in upstream production systems or printed prep sheets.">
                    Production reference
                  </FieldLabel>
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
                  <FieldLabel help="The smallest run size production will accept. Useful when a recipe must be made in at least N units (e.g. minimum dough mix).">
                    Min batch size
                  </FieldLabel>
                  <input
                    type="number"
                    value={draft.minBatch}
                    onChange={(e) => patch('minBatch', e.target.value === '' ? '' : Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel help='The largest run production will accept in a single batch. Type "unlimited" to remove the cap.'>
                    Max batch size
                  </FieldLabel>
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
                  <FieldLabel help="Quantities are rounded to multiples of this number. e.g. 6 means batches always come in lots of 6.">
                    Batch multiple
                  </FieldLabel>
                  <input
                    type="number"
                    value={draft.batchMultiple}
                    onChange={(e) => patch('batchMultiple', e.target.value === '' ? '' : Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
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
                  <FieldLabel help="When this recipe retires from production. After this date the recipe is no longer available to produce — items already made keep their normal shelf life. Leave blank if there's no scheduled retirement.">
                    Expiry date <Soft>(optional)</Soft>
                  </FieldLabel>
                  <input
                    type="date"
                    value={draft.expiryDate}
                    onChange={(e) => patch('expiryDate', e.target.value)}
                    style={{ ...inputStyle, maxWidth: '220px' }}
                  />
                </div>
              </div>

              <div>
                <FieldLabel help='Day-of-week range when this item must be closed out / counted down at end of day. Format is "1–5" (Mon–Fri).'>
                  Closing range
                </FieldLabel>
                <input
                  type="text"
                  value={draft.closingRange}
                  onChange={(e) => patch('closingRange', e.target.value)}
                  placeholder="e.g. 1–5"
                  style={{ ...inputStyle, maxWidth: '220px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <CheckRow
                  label="Sub-recipe"
                  checked={draft.isSubRecipe}
                  onChange={(v) => patch('isSubRecipe', v)}
                  help="Flag this recipe as something used inside other recipes (e.g. a sauce, a base). Distinct from the Type pill in Basics — that one's about how this recipe is sold."
                />
                <CheckRow
                  label="Allow carry-over"
                  checked={draft.allowCarryOver}
                  onChange={(v) => patch('allowCarryOver', v)}
                  help="Leftover stock from one day can be sold the next. Off means anything unsold at close must be wasted."
                />
                <CheckRow
                  label="Enable preparation PCR"
                  checked={draft.enablePcr}
                  onChange={(v) => patch('enablePcr', v)}
                  help="Production Cost Reconciliation — require staff to log actual ingredient usage against the recipe so variance is tracked."
                />
              </div>

              <div>
                <FieldLabel>Used for <Soft>(assembly names — which meals/combos use this)</Soft></FieldLabel>
                <TagInput value={draft.usedFor} onChange={(v) => patch('usedFor', v)} placeholder="Add assembly name and press Enter" />
              </div>
            </div>
          </CollapsibleCard>

          {/* Production flow — combined card for workflow attachment +
              diagram + stage editor. Sits at the bottom because the
              workflow attaches recipe-level metadata that's most useful
              after composition + settings are dialled in. */}
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
                <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  {kindToModeLabel({ ...original, kind: draftKind, isPrep: original.isPrep })}
                  {draft.shelfLifeValue !== '' && (
                    <> · Shelf life {formatShelfLife(shelfLifeToMinutes(draft.shelfLifeValue, draft.shelfLifeUnit) ?? 0)}</>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: '12px', fontSize: 13, color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)', borderRadius: 8 }}>
                No workflow attached and no sub-recipes in this recipe yet. Pick a workflow above to add stages, or add a sub-recipe in the Ingredients section.
              </div>
            )}

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
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────── */}
        <CollapsibleSidebar
          collapsed={priceCollapsed}
          onToggle={() => setPriceCollapsed((v) => !v)}
          label="Pricing"
          top={80}
        >
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
              the current variant + modifier selection. Folds the recipe's
              ingredientsV2 + packagingV2 + variants + slots + attached
              modifier groups through the resolver so the user can
              sanity-check what fires when this recipe is ordered with
              various options. */}
          <WhatGetsSoldPreview
            recipe={original}
            draft={draft}
            allGroups={allGroups}
            onPreviewChange={(next) => patch('previewByGroup', next)}
            onVariantPreviewChange={(next) => patch('previewVariantId', next)}
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
                  fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
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
                        padding: '8px 12px', borderRadius: '8px',
                        border: '1px solid var(--color-border-subtle)',
                        background: '#fff', cursor: 'pointer',
                        fontFamily: 'var(--font-primary)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                    >
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{parent.name}</span>
                      <KindPill kind={parent.kind} isPrep={parent.isPrep} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </CollapsibleSidebar>
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
          <div style={{ flex: 1, fontSize: '13.5px', color: 'var(--color-text-muted)' }}>
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
            <Save size={14} strokeWidth={2.4} /> Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── POS & modifiers section ──────────────────────────────────────────────────

function PosAndModifiersSection({
  posLinked, posSourceId, modifierGroupIds, allGroups,
  showModifierGroups = true,
  onPatchPosLinked, onPatchPosSourceId, onPatchGroups,
}: {
  posLinked: boolean;
  posSourceId: string;
  modifierGroupIds: string[];
  allGroups: ReturnType<typeof useModifierGroups>;
  /** When false, only the POS sellability fields are rendered — the
   *  modifier-group attach UI is hidden because variants own their own
   *  modifier-group attachments in the matrix above. */
  showModifierGroups?: boolean;
  onPatchPosLinked: (v: boolean) => void;
  onPatchPosSourceId: (v: string) => void;
  onPatchGroups: (v: string[]) => void;
}) {
  // Drawer state — edit hosts an existing group, create opens a blank
  // one. Inline create is fine here: the drawer saves to the catalogue
  // via `upsertGroup` (same as the standalone /modifier-groups editor),
  // so groups stay library-level, and on save we auto-attach the new
  // group to this recipe.
  const [drawer, setDrawer] = useState<
    | { mode: 'closed' }
    | { mode: 'create' }
    | { mode: 'edit'; group: ModifierGroup }
  >({ mode: 'closed' });
  // Whether the "Attach existing" picker is open. Shows unattached
  // groups only — attached ones live in the chip strip above.
  const [pickerOpen, setPickerOpen] = useState(false);

  const attached = allGroups.filter((g) => modifierGroupIds.includes(g.id));
  const unattached = allGroups.filter((g) => !modifierGroupIds.includes(g.id));

  function detach(id: string) {
    onPatchGroups(modifierGroupIds.filter((g) => g !== id));
  }
  function attach(id: string) {
    if (modifierGroupIds.includes(id)) return;
    onPatchGroups([...modifierGroupIds, id]);
    setPickerOpen(false);
  }
  function handleDeleted(id: string) {
    if (modifierGroupIds.includes(id)) detach(id);
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
              background: posLinked ? 'rgba(0, 28, 53,0.05)' : '#fff',
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

      {showModifierGroups && (
      <div>
        <FieldLabel>
          Modifier groups <Soft>({attached.length} attached)</Soft>
        </FieldLabel>
        {attached.length === 0 ? (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '11px 13px', borderRadius: 8,
              background: 'var(--color-bg-hover)',
              fontSize: 13.5, color: 'var(--color-text-muted)',
            }}
          >
            <span>No modifier groups attached.</span>
            {unattached.length > 0 ? (
              <button type="button" onClick={() => setPickerOpen(true)} style={attachChip}>
                <Plus size={12} strokeWidth={2.4} /> Attach existing group
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDrawer({ mode: 'create' })}
                style={attachChip}
              >
                <Plus size={12} strokeWidth={2.4} /> Create modifier group
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {attached.map((g) => (
              <AttachedGroupChip
                key={g.id}
                group={g}
                onDetach={() => detach(g.id)}
                onEdit={() => setDrawer({ mode: 'edit', group: g })}
              />
            ))}
            {unattached.length > 0 && (
              <button type="button" onClick={() => setPickerOpen(true)} style={attachChip}>
                <Plus size={12} strokeWidth={2.4} /> Attach existing group
              </button>
            )}
          </div>
        )}
      </div>
      )}

      {showModifierGroups && pickerOpen && (
        <AttachGroupPicker
          unattached={unattached}
          onPick={(id) => attach(id)}
          onClose={() => setPickerOpen(false)}
          onCreate={() => { setPickerOpen(false); setDrawer({ mode: 'create' }); }}
        />
      )}

      <GroupEditorDrawer
        open={drawer.mode !== 'closed'}
        mode={drawer.mode === 'edit' ? 'edit' : 'create'}
        initial={drawer.mode === 'edit' ? drawer.group : null}
        onClose={() => setDrawer({ mode: 'closed' })}
        onSaved={(group) => {
          // In create mode the new group lands in the catalogue via
          // upsertGroup; auto-attach it so the user doesn't have to
          // re-open the picker to find their just-created group.
          if (drawer.mode === 'create' && !modifierGroupIds.includes(group.id)) {
            onPatchGroups([...modifierGroupIds, group.id]);
          }
          setDrawer({ mode: 'closed' });
        }}
        onDeleted={handleDeleted}
      />
    </div>
  );
}

function AttachedGroupChip({
  group, onDetach, onEdit,
}: {
  group: ModifierGroup;
  onDetach: () => void;
  onEdit: () => void;
}) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'stretch',
        borderRadius: 100, overflow: 'hidden',
        border: '1px solid var(--color-accent-active)',
        background: 'rgba(0, 28, 53,0.06)',
      }}
    >
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px',
          color: 'var(--color-accent-active)',
          fontSize: 13.5, fontWeight: 600,
          fontFamily: 'var(--font-primary)',
        }}
      >
        {group.name}
        <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
          · {group.options.length}
        </span>
      </span>
      <button
        type="button"
        onClick={onEdit}
        title={`Edit "${group.name}" in library`}
        aria-label={`Edit ${group.name}`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 10px', border: 'none',
          borderLeft: '1px solid rgba(0, 28, 53,0.20)',
          background: 'transparent', color: 'var(--color-text-muted)',
          cursor: 'pointer',
        }}
      >
        <Pencil size={12} />
      </button>
      <button
        type="button"
        onClick={onDetach}
        title={`Detach "${group.name}"`}
        aria-label={`Detach ${group.name}`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 9px', border: 'none',
          borderLeft: '1px solid rgba(0, 28, 53,0.20)',
          background: 'transparent', color: 'var(--color-text-muted)',
          cursor: 'pointer',
        }}
      >
        <X size={11} />
      </button>
    </span>
  );
}

function AttachGroupPicker({
  unattached, onPick, onClose, onCreate,
}: {
  unattached: ModifierGroup[];
  onPick: (id: string) => void;
  onClose: () => void;
  /** Opens the modifier-group editor drawer in create mode so the user
   *  can build a brand-new group without leaving the recipe. */
  onCreate: () => void;
}) {
  return (
    <div
      style={{
        padding: '12px 14px', borderRadius: 10,
        background: '#fff', border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 4px 16px rgba(3,15,58,0.06)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
          Attach existing modifier group
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onClose}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            padding: 4, color: 'var(--color-text-muted)',
          }}
        >
          <X size={15} />
        </button>
      </div>
      {unattached.length === 0 ? (
        <div style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>
          Every group in the library is already attached. Create a new one below.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {unattached.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onPick(g.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 11px', borderRadius: 8,
                border: '1px solid var(--color-border-subtle)',
                background: '#fff', cursor: 'pointer',
                textAlign: 'left', fontFamily: 'var(--font-primary)',
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>
                {g.name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {g.selection === 'one' ? 'pick one' : 'pick many'} · {g.options.length} options
              </span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flex: 1 }}>
          Need a new group?
        </span>
        <button
          type="button"
          onClick={onCreate}
          style={attachChip}
        >
          <Plus size={13} strokeWidth={2.4} /> New group
        </button>
      </div>
    </div>
  );
}

const attachChip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '7px 12px', borderRadius: 100,
  border: '1px dashed var(--color-border)', background: '#fff',
  color: 'var(--color-text-secondary)',
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
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
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
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
  recipe, draft, allGroups, onPreviewChange, onVariantPreviewChange,
}: {
  recipe: Recipe;
  draft: FormDraft;
  allGroups: ReturnType<typeof useModifierGroups>;
  onPreviewChange: (next: Record<string, string[]>) => void;
  onVariantPreviewChange: (next: string) => void;
}) {
  // Pick the active variant for the preview. When the recipe has no
  // variants, this is undefined and we resolve against the base.
  const activeVariant = useMemo(() => {
    if (draft.variants.length === 0) return undefined;
    return (
      draft.variants.find((v) => v.id === draft.previewVariantId)
      ?? draft.variants.find((v) => v.isDefault)
      ?? draft.variants[0]
    );
  }, [draft.variants, draft.previewVariantId]);

  // Build the draft Recipe the resolver should see. When a variant is
  // active, swap its ingredients / packaging / modifier groups into the
  // recipe — that's what makes the preview match "what fires for this
  // variant". Variant dimensions are gone from this code path entirely.
  const draftRecipe: Recipe = useMemo(() => ({
    ...recipe,
    name: draft.name.trim() || recipe.name,
    ingredientsV2: activeVariant
      ? (activeVariant.ingredients.length > 0 ? activeVariant.ingredients : undefined)
      : (draft.ingredientsV2.length > 0 ? draft.ingredientsV2 : undefined),
    packagingV2: activeVariant
      ? (activeVariant.packaging.length > 0 ? activeVariant.packaging : undefined)
      : (draft.packagingV2.length > 0 ? draft.packagingV2 : undefined),
    modifierGroupIds: activeVariant
      ? (activeVariant.modifierGroupIds.length > 0 ? activeVariant.modifierGroupIds : undefined)
      : (draft.modifierGroupIds.length > 0 ? draft.modifierGroupIds : undefined),
    slots: draft.slots.length > 0 ? draft.slots : undefined,
    variantDimensions: undefined,
    variants: draft.variants.length > 0 ? draft.variants : undefined,
    posLinked: draft.posLinked,
  }), [
    recipe, draft.name, draft.ingredientsV2, draft.packagingV2,
    draft.modifierGroupIds, draft.slots, draft.variants, draft.posLinked,
    activeVariant,
  ]);

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

  // Effective per-channel prices for the previewed variant. The variant
  // overrides per channel; unset channels fall back to the recipe's
  // base channel prices in the form.
  const effectivePrices = useMemo(() => {
    function fallback(formVal: number | '' | undefined): number | null {
      if (typeof formVal === 'number') return formVal;
      return null;
    }
    return {
      dineIn: activeVariant?.priceDineIn ?? fallback(draft.srpDineInEx),
      takeaway: activeVariant?.priceTakeaway ?? fallback(draft.srpTakeawayEx),
      delivery: activeVariant?.priceDelivery ?? fallback(draft.srpDeliveryEx),
    };
  }, [activeVariant, draft.srpDineInEx, draft.srpTakeawayEx, draft.srpDeliveryEx]);
  const hasVariantPricing = activeVariant !== undefined && (
    activeVariant.priceDineIn !== undefined
    || activeVariant.priceTakeaway !== undefined
    || activeVariant.priceDelivery !== undefined
  );

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
          fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
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
        <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 10 }}>
          Not POS-linked — modifier groups won&apos;t fire on the till. Toggle POS link in the
          &ldquo;POS &amp; modifiers&rdquo; section to enable.
        </div>
      )}

      {draft.variants.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'inline-flex', gap: 6 }}>
            Variant
            <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
              · pick one (mandatory)
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {draft.variants.map((v) => {
              const on = activeVariant?.id === v.id;
              return (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => onVariantPreviewChange(v.id)}
                  style={{
                    padding: '4px 9px', borderRadius: 100,
                    border: on
                      ? '1px solid var(--color-accent-active)'
                      : '1px solid var(--color-border-subtle)',
                    background: on ? 'rgba(0, 28, 53,0.06)' : '#fff',
                    color: on ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
                    fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  {v.name || '(unnamed)'}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasVariantPricing && (
        <div
          style={{
            marginBottom: 12, padding: '8px 10px', borderRadius: 8,
            background: 'rgba(0, 28, 53,0.05)',
            border: '1px solid rgba(0, 28, 53,0.12)',
            fontSize: 11.5, color: 'var(--color-accent-active)',
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3 }}>
            Variant price
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>Dine-in {formatChannelPrice(effectivePrices.dineIn)}</span>
            <span>·</span>
            <span>Takeaway {formatChannelPrice(effectivePrices.takeaway)}</span>
            <span>·</span>
            <span>Delivery {formatChannelPrice(effectivePrices.delivery)}</span>
          </div>
        </div>
      )}

      {attached.length === 0 && draft.variants.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
          No variants or modifier groups attached. Preview shows the base composition only.
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
                          background: on ? 'rgba(0, 28, 53,0.06)' : '#fff',
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

function formatChannelPrice(v: number | null): string {
  if (v == null) return '—';
  return `£${v.toFixed(2)}`;
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
  type Tone = 'base' | 'pkg' | 'variant' | 'slot' | 'mod';
  const tone: Tone =
    source.kind === 'recipe-base'
      ? 'base'
      : source.kind === 'recipe-packaging'
        ? 'pkg'
        : source.kind === 'variant-ingredient' || source.kind === 'variant-packaging'
          ? 'variant'
          : source.kind === 'slot'
            ? 'slot'
            : 'mod';
  const toneStyles: Record<Tone, React.CSSProperties> = {
    base:    { background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' },
    pkg:     { background: 'rgba(82,170,150,0.16)', color: 'var(--color-success, #347262)' },
    variant: { background: 'rgba(143,92,199,0.16)', color: '#6F3FB0' },
    slot:    { background: 'rgba(241,180,52,0.16)', color: 'var(--color-warning)' },
    mod:     { background: 'rgba(0, 28, 53,0.08)', color: 'var(--color-accent-active)' },
  };
  const label =
    source.kind === 'recipe-base'
      ? 'base'
      : source.kind === 'recipe-packaging'
        ? 'packaging'
        : source.kind === 'variant-ingredient'
          ? 'variant'
          : source.kind === 'variant-packaging'
            ? 'variant pkg'
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

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
import { ArrowLeft, Save, Image as ImageIcon } from 'lucide-react';
import {
  type Recipe,
  type RecipeCategory,
  type ComponentRow,
  type ItemComponent,
  type RecipeComponent,
  buildUsedInIndex,
} from '@/components/Recipe/libraryFixtures';
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

  // Sub-recipes are derived from the unified component list (preserves order).
  const draftSubRecipes = useMemo<Recipe['subRecipes']>(() => {
    const subs = draft.components
      .filter((c): c is RecipeComponent => c.kind === 'recipe')
      .map((c) => ({
        recipeId: c.recipeId,
        quantityPerUnit: typeof c.qty === 'number' ? c.qty : 1,
        unit: c.uom,
      }));
    return subs.length ? subs : undefined;
  }, [draft.components]);

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
          </Card>

          {/* Recipe components — unified ingredients + sub-recipes (build order) */}
          <Card>
            <SectionHeader
              title="Recipe components"
              hint="One ordered list. Add raw ingredients or pull in another recipe as a sub-recipe; build order is top → bottom. Sub-recipes auto-promote this to an Assembly."
            />
            <ComponentTable
              rows={draft.components}
              recipesById={recipesById}
              selfId={original.id}
              onChange={setComponents}
              onPromoteToStage={(workType, leadOffset, label) => {
                // Promote an implicit ingredient prep tag into an explicit
                // workflow stage on this recipe. The stage uses a sensible
                // default capability ('prep' covers most ingredient prep
                // work — author can refine in the Workflow editor below).
                setDraftWorkflow((wf) => {
                  if (!wf) return wf;
                  const newId = `stage-${Date.now().toString(36)}`;
                  const prevId = wf.stages[wf.stages.length - 1]?.id;
                  return {
                    ...wf,
                    stages: [
                      ...wf.stages,
                      {
                        id: newId,
                        label,
                        capability: 'prep',
                        workType,
                        leadOffset,
                        durationMinutes: 10,
                      },
                    ],
                    edges: prevId ? [...wf.edges, { from: prevId, to: newId }] : wf.edges,
                  };
                });
                setShowWorkflowSections(true);
              }}
            />
          </Card>

          {/* Variable */}
          <CollapsibleCard
            label="Variable ingredients"
            hint={draft.variables.length ? `${draft.variables.length} row${draft.variables.length === 1 ? '' : 's'}` : 'e.g. alt milks, size variations — usually better as a shared modifier group'}
            open={draft.showVariable}
            onToggle={() => patch('showVariable', !draft.showVariable)}
          >
            <VariableTable
              rows={draft.variables}
              onChange={(rid, p) => patch('variables', draft.variables.map((r) => r.id === rid ? { ...r, ...p } : r))}
              onRemove={(rid) => patch('variables', draft.variables.filter((r) => r.id !== rid))}
              onAdd={() => patch('variables', [...draft.variables, emptyVariable()])}
            />
          </CollapsibleCard>

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

          {/* Workflow stages */}
          {draftWorkflow && (
            <CollapsibleCard
              label="Workflow stages"
              hint={`${draftWorkflow.stages.length} stage${draftWorkflow.stages.length === 1 ? '' : 's'} across D-2 / D-1 / D0`}
              open={showWorkflowSections}
              onToggle={() => setShowWorkflowSections((v) => !v)}
            >
              <WorkflowEditor
                workflow={draftWorkflow}
                onChange={(updater) => setDraftWorkflow((wf) => (wf ? updater(wf) : wf))}
              />
            </CollapsibleCard>
          )}

          {/* Production flow — visual summary of sub-recipes + workflow */}
          {((draftSubRecipes?.length ?? 0) > 0 || draftWorkflow) && (
            <Card>
              <SectionHeader
                title="Production flow"
                hint="How components and stages cascade across D-2 / D-1 / D0."
              />
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
            </Card>
          )}

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
            hint="Status, stock-take, shelf life, bakery/hot production, carry-over, PCR, used-for"
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
                <CheckRow label="Count in stock-take" checked={draft.countInStockTake} onChange={(v) => patch('countInStockTake', v)} />
                <CheckRow label="Exclude from COGS" checked={draft.excludeFromCogs} onChange={(v) => patch('excludeFromCogs', v)} />
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

              <div>
                <FieldLabel>Bakery / hot production</FieldLabel>
                <PillSingle options={BAKERY_HOT_PRODUCTION} selected={draft.bakeryHot} onChange={(v) => patch('bakeryHot', v)} />
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
                Used in
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

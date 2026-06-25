export type RecipeCategory =
  | 'Coffee' | 'Tea' | 'Pastry' | 'Food' | 'Wine' | 'Spirits' | 'Kids'
  | 'Bakery' | 'Sandwich' | 'Salad' | 'Snack' | 'Beverage';
export type RecipeStatus = 'Active' | 'Draft' | 'Archived';
export type RecipeFlag =
  | { type: 'cost-drift'; label: string }
  | { type: 'missing-prod'; label: string }
  | { type: 'missing-size'; label: string }
  | null;

export type RecipeKind = 'standalone' | 'component' | 'assembly';

export type RecipeSubRecipe = {
  recipeId: string;
  quantityPerUnit: number;
  unit: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// New ingredient model (post-rethink)
//
// `RecipeIngredient` is the typed, master/product-aware ingredient row that
// replaces the legacy free-text `ingredients[]` array. It lives on a recipe
// as `Recipe.ingredientsV2` while we migrate; the resolver and the new
// editor picker read from this. The drawer and other read-only views still
// fall back to the legacy `ingredients` array for fixtures that haven't
// been migrated yet.
//
// `ref` is the discriminated union from the unified ingredient catalogue:
//   - { kind: 'master', masterProductId } — recipe binds to a Master
//   - { kind: 'product', productId }      — recipe binds to a specific
//                                           supplier SKU OR a made/CPU
//                                           product
//
// `siteOverrides` is the per-site quantity override map. Resolved by the
// `applyModifiers` resolver: a row's effective qty for site X is
// `siteOverrides[X] ?? baseQty`. Solves "Site A uses 16g of coffee, Site B
// uses 18g" without forking the recipe.
// ─────────────────────────────────────────────────────────────────────────────

export type IngredientRefShape =
  | { kind: 'master'; masterProductId: string }
  | { kind: 'product'; productId: string }
  // Sub-recipe / component recipe used as an ingredient (e.g. a
  // tahini sauce made in-house added into a wrap). Picked from the
  // same unified search as masters & supplier SKUs — the user doesn't
  // have to know up-front whether what they're looking for is a
  // master product, a supplier SKU, or another recipe.
  | { kind: 'subrecipe'; recipeId: string };

export type RecipeIngredientQty = { value: number; unit: string };

export type RecipeIngredient = {
  id: string;
  ref: IngredientRefShape;
  /** Default quantity for this ingredient. Used at every site unless
   *  overridden in `siteOverrides`. */
  baseQty: RecipeIngredientQty;
  /** Per-site overrides keyed by site id (or site label in the
   *  prototype, where there's no real site model yet). */
  siteOverrides?: Record<string, RecipeIngredientQty>;
  /** Free-form tags used by `scale` modifier effects to target a
   *  subset of ingredients (e.g. ["dose"] so a "Large" modifier can
   *  scale only the espresso dose, not the cup). Optional. */
  tags?: string[];
  /** Optional human note kept on the row (e.g. "use cold pressed"). */
  note?: string;
};

export function makeRecipeIngredient(
  ref: IngredientRefShape,
  baseQty: RecipeIngredientQty,
  extras?: Partial<Omit<RecipeIngredient, 'id' | 'ref' | 'baseQty'>>,
): RecipeIngredient {
  return {
    id: `ri-${Math.random().toString(36).slice(2, 8)}`,
    ref,
    baseQty,
    ...extras,
  };
}

/** Helper: best-effort master id resolution for an ingredient ref.
 *  Lazy-imports the Suppliers store at call time to avoid circular
 *  imports. Returns undefined if the ref is a Product without a
 *  `masterProductId` link. */
export function resolveMasterProductId(ref: IngredientRefShape): string | undefined {
  if (ref.kind === 'master') return ref.masterProductId;
  if (ref.kind === 'subrecipe') return undefined;
  // Lazy require to avoid pulling the Suppliers store into modules that
  // only need the type. The store is loaded by the time any caller runs.
  const { findProduct } = require('@/components/Suppliers/store') as typeof import('@/components/Suppliers/store');
  return findProduct(ref.productId)?.masterProductId;
}

/**
 * A named ingredient placeholder on a recipe. `set-slot` modifier effects
 * target a slot by `key`, allowing one shared modifier group (e.g.
 * "Spirit measure 25/50ml") to apply to many recipes without naming
 * each spirit explicitly. Most recipes don't need slots — they're the
 * advanced unlock for the spirit / wine / size-driven patterns.
 */
export type RecipeSlot = {
  /** Stable key targeted by `set-slot` modifier effects. */
  key: string;
  /** Human-readable label shown in the editor + preview. */
  label: string;
  /** Default ingredient filling this slot (e.g. "Smirnoff Vodka" for
   *  the spirit slot of the Smirnoff recipe). */
  defaultRef?: IngredientRefShape;
  /** Default quantity when no modifier sets one. Often blank for
   *  modifier-driven recipes (wine, where pour size is required). */
  defaultQty?: RecipeIngredientQty;
};

// ─────────────────────────────────────────────────────────────────────────────
// Variants — a named, mandatory dimension of a recipe (most commonly Size).
//
// Variants are deliberately distinct from modifiers and from slots:
//   - Variants are WITHIN a recipe: the customer must pick exactly one
//     option per dimension for the recipe to be orderable. Each option
//     overrides per-ingredient quantities, packaging, and price.
//   - Modifiers are OPTIONAL one-to-one changes (replace / add / scale).
//   - Slots are CROSS-recipe — one modifier group attaching to many
//     recipes via a named placeholder (spirit, wine).
//
// Naming the concept separately keeps cross-site reporting honest and
// maps cleanly onto POS-side "variations" (Square / Toast / Lightspeed).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-ingredient quantity override applied when this variant option is
 * picked. Targets a `RecipeIngredient.id` on the recipe's `ingredientsV2`
 * list. `constant: true` is a UI hint meaning "keep this ingredient the
 * same as base across all variants" — useful for coffee dose, which most
 * coffee shops hold constant across sizes.
 */
export type VariantIngredientOverride = {
  recipeIngredientId: string;
  qty: RecipeIngredientQty;
  constant?: boolean;
};

/**
 * Per-packaging override applied when this variant option is picked.
 * Targets a `RecipeIngredient.id` on the recipe's `packagingV2` list.
 * The `ref` swap is the headline behaviour (small coffee → 8oz cup,
 * large coffee → 12oz cup); `qty` is rarely needed but supported.
 */
export type VariantPackagingOverride = {
  recipePackagingId: string;
  ref: IngredientRefShape;
  qty?: RecipeIngredientQty;
};

/**
 * One option inside a variant dimension. Customers pick exactly one per
 * dimension. The option carries any per-ingredient / per-packaging
 * overrides and the channel prices for that variant.
 */
export type RecipeVariantOption = {
  id: string;
  name: string;
  /** When true, used as the preview default and the implicit pick when
   *  resolving without an explicit selection. Exactly one option per
   *  dimension should be `isDefault: true`; the resolver falls back to
   *  the first option otherwise. */
  isDefault?: boolean;
  ingredientOverrides: VariantIngredientOverride[];
  packagingOverrides: VariantPackagingOverride[];
  /** Per-channel price overrides. When unset, the recipe's base
   *  channel price is used. Cost is always derived from the resolved
   *  ingredient list — never overridden here. */
  priceDineIn?: number;
  priceTakeaway?: number;
  priceDelivery?: number;
  /** Upstream POS identifier for this variant option (e.g. Square
   *  variation id). Stored on the option itself rather than in a
   *  separate mapping table. */
  posSourceId?: string;
};

/**
 * A named dimension of a recipe (Size, Temperature, …). One or more
 * options must be picked at order time. Most recipes have one dimension;
 * v1 caps at two (e.g. size × temperature). The dimension is configured
 * per recipe — variant dimensions don't live in a library because the
 * sizes of a coffee aren't the sizes of a salad.
 *
 * @deprecated Superseded by the flat `Recipe.variants` model
 * (`RecipeVariant`). The dimension × option structure proved too busy
 * in the editor — most shops actually want "base recipe + N alternative
 * full variants" rather than a sparse-override matrix. Kept here so
 * legacy fixtures continue to load; the editor migrates them into
 * `variants` on first save.
 */
export type RecipeVariantDimension = {
  id: string;
  name: string;
  options: RecipeVariantOption[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Variants (post-rethink) — flat list of full alternative compositions.
//
// Replaces the dimension × option model with something closer to how
// operators actually think about variants: "Latte" is the recipe, and
// "Small / Medium / Large" are three full alternative compositions
// (each with their own ingredients, packaging, and modifier groups).
//
// Each variant carries the COMPLETE ingredient + packaging + modifier
// set for that variant — not a sparse override of a base. This makes
// the editor simpler (each variant looks like its own mini-recipe) at
// the cost of some duplication (the espresso row appears in Small,
// Medium and Large). The cost is acceptable: variants are bounded
// (typically ≤ 5 per recipe) and the duplication is what makes the
// "what gets sold" preview obvious without resolution gymnastics.
//
// The recipe's base `ingredientsV2` / `packagingV2` / `modifierGroupIds`
// still act as the default composition when `variants` is empty, AND
// as the seed when a new variant is added (the new variant starts as
// a copy of base, then the user diverges it).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One full alternative composition of a recipe. Variants are mutually
 * exclusive — the customer picks exactly one when the recipe has any.
 * When `recipe.variants` is empty the recipe is sold as a single SKU
 * using the recipe's base composition.
 */
export type RecipeVariant = {
  id: string;
  name: string;
  /** Pre-selected variant for the customer + the implicit pick when
   *  resolving without an explicit selection. Exactly one variant per
   *  recipe should be `isDefault: true`; the resolver falls back to
   *  the first variant otherwise. */
  isDefault?: boolean;
  /** Full ingredient list for this variant. Does NOT inherit from the
   *  recipe's base — each variant carries its own complete list. New
   *  variants are seeded as a copy of the base, then diverge. */
  ingredients: RecipeIngredient[];
  /** Full packaging list for this variant. Same model as ingredients. */
  packaging: RecipeIngredient[];
  /** Catalogue-level modifier groups attached to this variant. Same
   *  shape as `Recipe.modifierGroupIds`; the variant's groups REPLACE
   *  the recipe's base groups when this variant is selected. */
  modifierGroupIds: string[];
  /** Per-channel prices for this variant. When unset, the recipe's
   *  base channel price is used. Cost is always derived from the
   *  resolved ingredient list. */
  priceDineIn?: number;
  priceTakeaway?: number;
  priceDelivery?: number;
  /** Upstream POS identifier for this variant (e.g. Square variation
   *  id). Stored on the variant itself rather than a separate mapping
   *  table. */
  posSourceId?: string;
  /** Allergens that apply specifically to this variant, in addition to
   *  or instead of the recipe's base allergen set. When set, the UI
   *  shows the base set with per-variant additions/removals highlighted.
   *  Optional — when absent the variant inherits the recipe's base
   *  allergens with no changes. */
  allergens?: string[];
};

/**
 * Flatten a legacy `variantDimensions` structure into the new flat
 * `RecipeVariant[]` shape. Only the first dimension is consumed — a
 * second axis (e.g. temperature × size) is dropped with the
 * expectation that the operator promotes it to a separate recipe or
 * to a modifier group. The base ingredients / packaging / modifiers
 * are folded into each variant so the variant is self-contained.
 *
 * No-op when `dimensions` is empty — returns `undefined`.
 */
export function flattenDimensionsToVariants(
  dimensions: RecipeVariantDimension[] | undefined,
  baseIngredients: RecipeIngredient[],
  basePackaging: RecipeIngredient[],
  baseModifierGroupIds: string[],
  baseChannelPrices: { dineIn?: number; takeaway?: number; delivery?: number },
): RecipeVariant[] | undefined {
  if (!dimensions || dimensions.length === 0) return undefined;
  const dim = dimensions[0];
  if (!dim || dim.options.length === 0) return undefined;
  return dim.options.map((opt) => {
    const ingOverrideById = new Map(
      opt.ingredientOverrides.map((ov) => [ov.recipeIngredientId, ov.qty]),
    );
    const pkgOverrideById = new Map(
      opt.packagingOverrides.map((ov) => [ov.recipePackagingId, ov]),
    );
    return {
      id: opt.id,
      name: opt.name,
      isDefault: opt.isDefault,
      ingredients: baseIngredients.map((ri) => {
        const ov = ingOverrideById.get(ri.id);
        return ov ? { ...ri, baseQty: ov } : { ...ri };
      }),
      packaging: basePackaging.map((rp) => {
        const ov = pkgOverrideById.get(rp.id);
        return ov ? { ...rp, ref: ov.ref, baseQty: ov.qty ?? rp.baseQty } : { ...rp };
      }),
      modifierGroupIds: [...baseModifierGroupIds],
      priceDineIn: opt.priceDineIn ?? baseChannelPrices.dineIn,
      priceTakeaway: opt.priceTakeaway ?? baseChannelPrices.takeaway,
      priceDelivery: opt.priceDelivery ?? baseChannelPrices.delivery,
      posSourceId: opt.posSourceId,
    };
  });
}

/**
 * Rich row used by the new full-page editor (manual-intake-style). When set on
 * a recipe these take precedence over `ingredients` / `packaging` for editing.
 * The lighter `ingredients` array is still used by the read-only drawer view
 * for back-compat with existing fixtures.
 */
export type RichRow = {
  id: string;
  name: string;
  supplier: string;
  qty: number | '';
  uom: string;
  unitCostP: number;
};

export type RichVariableRow = RichRow & { type: string };

/**
 * Unified "what goes into this recipe" row. A recipe component is either:
 *   - a raw ingredient (kind: 'item') — name + supplier + qty + uom + cost, OR
 *   - a sub-recipe (kind: 'recipe') — references another Recipe by id.
 *
 * The order of rows is the build order (top → bottom in the UI). On save the
 * page splits these into the legacy `Recipe.ingredients` and `Recipe.subRecipes`
 * arrays for back-compat with read-only views.
 */
export type ItemComponent = {
  id: string;
  kind: 'item';
  name: string;
  supplier: string;
  qty: number | '';
  uom: string;
  unitCostP: number;
  /**
   * Optional link to the master ingredient (`PRET_INGREDIENTS`). When set,
   * the component inherits the ingredient's `defaultPrepWork` unless
   * `prepWorkOverride` below is non-empty. When unset, only `prepWorkOverride`
   * contributes prep-work chips for this row.
   */
  ingredientId?: string;
  /**
   * Per-recipe prep-work override. When non-empty, REPLACES the master
   * ingredient's `defaultPrepWork` for this row (e.g. "for THIS recipe
   * we want the tomato diced not sliced"). Each entry may carry an
   * optional `leadOffset` so the work is scheduled the day before
   * (`-1`) or two days before (`-2`) consumption.
   */
  prepWorkOverride?: import('@/components/Production/fixtures').PrepWorkEntry[];
};

export type RecipeComponent = {
  id: string;
  kind: 'recipe';
  recipeId: string;
  qty: number | '';
  uom: string;
};

export type ComponentRow = ItemComponent | RecipeComponent;

export type RecipeFormExtras = {
  yieldQty?: number | '';
  yieldUom?: string;
  sites?: string[];
  instructions?: string;
  allergens?: string[];
  photoName?: string | null;
  /** Unified component list (items + sub-recipes). When set, takes precedence
   *  over `Recipe.ingredients` and `Recipe.subRecipes` for editing purposes. */
  components?: ComponentRow[];
  /** @deprecated kept for back-compat; use `components` */
  detailedIngredients?: RichRow[];
  variableIngredients?: RichVariableRow[];
  packaging?: RichRow[];
  productionExtras?: {
    visibility?: string[];
    prepSeconds?: number | '';
    productionRef?: string;
    keyIngredients?: string[];
    tags?: string[];
    minBatch?: number | '';
    maxBatch?: number | '' | 'unlimited';
    batchMultiple?: number | '';
  };
  advanced?: {
    productClass?: string;
    isSubRecipe?: boolean;
    countInStockTake?: boolean;
    excludeFromCogs?: boolean;
    shelfLifeValue?: number | '';
    shelfLifeUnit?: 'minutes' | 'hours' | 'days';
    /** Mirror of `Recipe.production.expiryDate` (ISO `YYYY-MM-DD`).
     *  Kept on `formExtras.advanced` so the form's draft state
     *  round-trips cleanly. Empty string represents "not set". */
    expiryDate?: string;
    closingRange?: string;
    bakeryHot?: string;
    allowCarryOver?: boolean;
    enablePcr?: boolean;
    usedFor?: string[];
  };
  pricing?: {
    desiredMargin?: number | '';
    vatPct?: number | '';
    hotCold?: 'hot' | 'cold' | null;
    srpDineInEx?: number | '';
    srpTakeawayEx?: number | '';
    srpDeliveryEx?: number | '';
    deliveryCommission?: number | '';
  };
};

export type Recipe = {
  id: string;
  name: string;
  category: RecipeCategory;
  /**
   * Brand this library entry belongs to. Defaults to `'pret'` when unset so
   * the existing library stays Pret. The recipes page filters by the active
   * brand so the Burger King menu only shows when the BK persona is active.
   */
  brand?: import('@/components/Production/bkFixtures').Brand;
  ingredientCost: number;        // £ per serve
  priceDineIn: number;
  priceTakeaway: number;
  priceDelivery: number;
  marginPct: number;             // dine-in margin
  status: RecipeStatus;
  flag: RecipeFlag;
  /**
   * @deprecated Free-text ingredient list kept for back-compat with
   * the read-only drawer view + un-migrated fixtures. New writes go
   * to `ingredientsV2`. Resolver and editor read from `ingredientsV2`
   * when present. `price` is the £ line cost for this row at the
   * stated qty (display-only; typed rows derive cost from the
   * catalogue via components/Recipe/costing.ts instead).
   */
  ingredients: { name: string; qty: string; supplier: string; price?: number }[];
  /**
   * Typed, master/product-aware ingredient rows (post-rethink). When
   * present, this is the source of truth for the resolver, costing,
   * and the editor picker.
   */
  ingredientsV2?: RecipeIngredient[];
  /**
   * Typed, master/product-aware packaging rows. Same shape as
   * `ingredientsV2` — packaging is just "a different kind of product
   * the order consumes" so it shares the same `RecipeIngredient`
   * structure. Modifier `replace` / `add` / `scale` effects target
   * packaging the same way they target ingredients (e.g. a Large
   * coffee can swap the 8oz cup for the 12oz cup via Replace).
   *
   * The legacy free-text `formExtras.packaging` array is kept for
   * back-compat with imported recipes but is invisible to the
   * resolver — new packaging writes go here.
   */
  packagingV2?: RecipeIngredient[];
  // ── Sellability / menu-item fields ───────────────────────────────────────
  //
  // A Recipe IS the sellable unit. There is no separate MenuItem entity
  // any more — recipe and menu item are merged. `posLinked` is the
  // canonical "is this on a POS button?" flag.
  /**
   * Catalogue-level modifier groups attached to this recipe. References
   * `ModifierGroup.id` in `components/Modifiers/store.ts`. The same
   * group can be attached to many recipes — add an alt milk in one
   * place and every coffee picks it up.
   */
  modifierGroupIds?: string[];
  /**
   * Named ingredient placeholders that `set-slot` modifier effects can
   * target. Allows one shared modifier group (e.g. "Spirit measure")
   * to apply to many recipes (Smirnoff, Grey Goose, Tanqueray) without
   * naming each spirit. Mostly empty — only the spirit / wine / size
   * patterns use it.
   */
  slots?: RecipeSlot[];
  /**
   * Variant dimensions for this recipe.
   *
   * @deprecated Superseded by the flat `variants` field below. Read on
   * load and migrated to `variants` on first save. New writes should
   * go to `variants`.
   */
  variantDimensions?: RecipeVariantDimension[];
  /**
   * Flat list of full alternative compositions of this recipe (Small /
   * Medium / Large, Hot / Iced, …). When set, the customer must pick
   * exactly one variant for the recipe to be orderable; the chosen
   * variant's ingredients, packaging, and modifier groups replace the
   * recipe's base. Distinct from modifiers (optional one-to-one
   * changes) and slots (cross-recipe placeholders).
   *
   * When unset / empty the recipe is sold as a single SKU using the
   * recipe's base composition (`ingredientsV2` / `packagingV2` /
   * `modifierGroupIds`).
   */
  variants?: RecipeVariant[];
  /** Whether this recipe is linked to a POS button. Drives the
   *  "Sellable on POS" filter on the recipes list. Sub-recipes,
   *  components, made products, and prep items have this set to
   *  false (or undefined). */
  posLinked?: boolean;
  /** Identifier from the upstream POS used to keep the link alive
   *  across POS-to-Edify reconciliations. */
  posSourceId?: string;
  /**
   * Hook for the franchise / template workstream. When set, this
   * recipe was inherited from a parent template and local edits
   * become overrides. Unused in the recipe rebuild — placeholder.
   */
  templateId?: string;
  production: {
    visibility: 'Bar' | 'Kitchen' | 'Both' | null;
    shelfLifeMinutes: number | null;
    prepTimeSeconds: number | null;
    /** Optional retirement date for this recipe — ISO `YYYY-MM-DD`.
     *  When set, this recipe stops being available for new production
     *  on that date. Distinct from `shelfLifeMinutes` (which governs
     *  how long each produced unit stays sellable). Null means the
     *  recipe has no scheduled retirement. */
    expiryDate?: string | null;
  };
  /** Stand-alone / component / assembly. Drives the Type pill and Components filter. */
  kind: RecipeKind;
  /** When this recipe is an assembly: ordered components consumed per unit. */
  subRecipes?: RecipeSubRecipe[];
  /** Links to PRET_WORKFLOWS for the production-flow DAG view. */
  workflowId?: string;
  /** Orphan prep flag (e.g. end-of-day mise that no current assembly explicitly pulls). */
  isPrep?: boolean;
  /** Include this recipe when counting physical inventory at stock take.
   *  Defaults to true — opt out for items where on-hand counts don't
   *  make sense (made-to-order coffees, custom assemblies, etc.). */
  countInStockTake?: boolean;
  /** Exclude this recipe from cost-of-goods calculations. Useful for
   *  comp / staff items, complimentary tasters, or recipes whose cost
   *  is rolled up via a parent assembly. Defaults to false. */
  excludeFromCogs?: boolean;
  /** Rich form fields edited via the full-page recipe editor. All optional so
   *  existing fixtures don't need to fill them in. */
  formExtras?: RecipeFormExtras;
};

// Line prices use the same per-unit costs as the master catalogue
// (espresso £25/kg dosed at 18g ≈ £0.45; whole milk £2.20/L).
const coffeeIngs = (withMilkMl: number | null) => {
  const list: Recipe['ingredients'] = [
    { name: 'Espresso blend', qty: '7g', supplier: 'Bidvest', price: 0.45 },
  ];
  if (withMilkMl != null) {
    list.push({
      name: 'Whole milk',
      qty: `${withMilkMl}ml`,
      supplier: 'Fresh Earth Produce',
      price: Math.round(withMilkMl * 0.0022 * 100) / 100,
    });
  }
  return list;
};

// Demo helper — builds a Size variant dimension for a coffee recipe.
//
//   - Coffee dose is constant at 18g across sizes (most coffee shops
//     hold this fixed). The `constant: true` flag is informational.
//   - Milk volume scales per size (smallMl / mediumMl / largeMl).
//   - The takeaway cup is swapped for the appropriate size.
//   - Dine-in / takeaway / delivery prices step up by £0.40 / £0.80.
//
// The override targets reference the ingredient + packaging ids set up
// in `FITZROY_INGREDIENTSV2_BY_RECIPE` / `FITZROY_PACKAGINGV2_BY_RECIPE`
// (e.g. `ri-flat-espresso`, `rp-flat-cup`). The id prefix encodes the
// recipe so we can derive both halves from the recipe id.
function coffeeSizeDimension(
  recipeId: string,
  smallMl: number,
  mediumMl: number,
  largeMl: number,
): RecipeVariantDimension {
  // recipe id → ingredient id prefix used in the V2 maps. `rec-flat-white`
  // uses `ri-flat-*`; `rec-cappuccino` uses `ri-capp-*`; `rec-latte`
  // uses `ri-latte-*`. Keeping the lookup explicit avoids any "clever"
  // string magic that the next maintainer would have to reverse.
  const prefix =
    recipeId === 'rec-flat-white' ? 'flat' :
    recipeId === 'rec-cappuccino' ? 'capp' :
    recipeId === 'rec-latte' ? 'latte' :
    recipeId;
  const espressoId = `ri-${prefix}-espresso`;
  const milkId = `ri-${prefix}-milk`;
  const cupId = `rp-${prefix}-cup`;
  return {
    id: `vd-${prefix}-size`,
    name: 'Size',
    options: [
      {
        id: `vd-${prefix}-size-small`,
        name: 'Small (8oz)',
        isDefault: true,
        posSourceId: `pos-var-${prefix}-sm`,
        ingredientOverrides: [
          { recipeIngredientId: espressoId, qty: { value: 18, unit: 'g' }, constant: true },
          { recipeIngredientId: milkId, qty: { value: smallMl, unit: 'ml' } },
        ],
        packagingOverrides: [
          {
            recipePackagingId: cupId,
            ref: { kind: 'master', masterProductId: 'mp-cup-takeaway-8oz' },
          },
        ],
      },
      {
        id: `vd-${prefix}-size-medium`,
        name: 'Medium (12oz)',
        posSourceId: `pos-var-${prefix}-md`,
        ingredientOverrides: [
          { recipeIngredientId: espressoId, qty: { value: 18, unit: 'g' }, constant: true },
          { recipeIngredientId: milkId, qty: { value: mediumMl, unit: 'ml' } },
        ],
        packagingOverrides: [
          {
            recipePackagingId: cupId,
            ref: { kind: 'master', masterProductId: 'mp-cup-takeaway-12oz' },
          },
        ],
        priceDineIn: 4.40,
        priceTakeaway: 4.20,
        priceDelivery: 4.60,
      },
      {
        id: `vd-${prefix}-size-large`,
        name: 'Large (16oz)',
        posSourceId: `pos-var-${prefix}-lg`,
        ingredientOverrides: [
          { recipeIngredientId: espressoId, qty: { value: 18, unit: 'g' }, constant: true },
          { recipeIngredientId: milkId, qty: { value: largeMl, unit: 'ml' } },
        ],
        packagingOverrides: [
          {
            recipePackagingId: cupId,
            ref: { kind: 'master', masterProductId: 'mp-cup-takeaway-16oz' },
          },
        ],
        priceDineIn: 4.80,
        priceTakeaway: 4.60,
        priceDelivery: 5.00,
      },
    ],
  };
}

/**
 * Private seed shape — keeps the pre-merge `menuItems[]` / `modifierGroups[]`
 * fields locally so the existing fixture entries don't need to be rewritten
 * line by line. The `migrateLegacySeed` helper below converts each entry to
 * a clean `Recipe` (with `posLinked`, `modifierGroupIds`, `slots`) before
 * export.
 */
type LegacyFitzroySeed =
  Omit<Recipe, 'kind' | 'posLinked' | 'modifierGroupIds' | 'slots' | 'posSourceId' | 'variantDimensions'>
  & {
    menuItems: { name: string; posLinked: boolean }[];
    modifierGroups: string[];
    // Optional overrides for specific fixtures that want explicit values
    // post-merge (e.g. wine / spirit recipes that need slots).
    slots?: RecipeSlot[];
    posLinked?: boolean;
    posSourceId?: string;
    modifierGroupIds?: string[];
    variantDimensions?: RecipeVariantDimension[];
  };

const FITZROY_RECIPES: LegacyFitzroySeed[] = [
  {
    id: 'rec-flat-white',
    name: 'Flat white',
    category: 'Coffee',
    ingredientCost: 0.84,
    priceDineIn: 4.00,
    priceTakeaway: 3.80,
    priceDelivery: 4.20,
    marginPct: 79,
    status: 'Active',
    flag: null,
    menuItems: [
      { name: 'Flat white', posLinked: true },
      { name: 'Oat flat white', posLinked: true },
    ],
    ingredients: coffeeIngs(180),
    // Size is modelled as a first-class variant dimension below; we
    // deliberately don't attach the legacy "Cup sizes" modifier group.
    // Alt milks stays a modifier — it's an optional one-to-one swap.
    modifierGroups: ['Alt milks'],
    variantDimensions: [coffeeSizeDimension('rec-flat-white', 140, 180, 220)],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 90 },
  },
  {
    id: 'rec-cappuccino',
    name: 'Cappuccino',
    category: 'Coffee',
    ingredientCost: 0.81,
    priceDineIn: 4.00,
    priceTakeaway: 3.80,
    priceDelivery: 4.20,
    marginPct: 73,
    status: 'Active',
    flag: { type: 'cost-drift', label: 'cost drift' },
    menuItems: [{ name: 'Cappuccino', posLinked: true }],
    ingredients: coffeeIngs(150),
    modifierGroups: ['Alt milks'],
    variantDimensions: [coffeeSizeDimension('rec-cappuccino', 120, 150, 200)],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 95 },
  },
  {
    id: 'rec-latte',
    name: 'Latte',
    category: 'Coffee',
    ingredientCost: 0.82,
    priceDineIn: 4.20,
    priceTakeaway: 4.00,
    priceDelivery: 4.40,
    marginPct: 72,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Latte', posLinked: true }],
    ingredients: coffeeIngs(200),
    modifierGroups: ['Alt milks'],
    variantDimensions: [coffeeSizeDimension('rec-latte', 160, 200, 260)],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 100 },
  },
  {
    id: 'rec-americano',
    name: 'Americano',
    category: 'Coffee',
    ingredientCost: 0.45,
    priceDineIn: 3.20,
    priceTakeaway: 3.00,
    priceDelivery: 3.40,
    marginPct: 86,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Americano', posLinked: true }],
    ingredients: coffeeIngs(null),
    modifierGroups: ['Alt milks'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 60 },
  },
  {
    id: 'rec-mocha',
    name: 'Mocha',
    category: 'Coffee',
    ingredientCost: 0.95,
    priceDineIn: 4.60,
    priceTakeaway: 4.40,
    priceDelivery: 4.80,
    marginPct: 66,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Mocha', posLinked: true }],
    ingredients: [
      { name: 'Espresso blend', qty: '7g', supplier: 'Bidvest', price: 0.45 },
      { name: 'Whole milk', qty: '180ml', supplier: 'Fresh Earth Produce', price: 0.40 },
      { name: 'Chocolate syrup', qty: '20ml', supplier: 'Bidvest', price: 0.08 },
      { name: 'Cocoa powder', qty: '2g', supplier: 'Bidvest', price: 0.02 },
    ],
    modifierGroups: ['Alt milks', 'Cup sizes'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 110 },
  },
  {
    id: 'rec-cortado',
    name: 'Cortado',
    category: 'Coffee',
    ingredientCost: 0.68,
    priceDineIn: 3.60,
    priceTakeaway: 3.40,
    priceDelivery: 3.80,
    marginPct: 81,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Cortado', posLinked: true }],
    ingredients: coffeeIngs(90),
    modifierGroups: ['Alt milks'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 80 },
  },
  {
    id: 'rec-macchiato',
    name: 'Macchiato',
    category: 'Coffee',
    ingredientCost: 0.54,
    priceDineIn: 3.20,
    priceTakeaway: 3.00,
    priceDelivery: 3.40,
    marginPct: 83,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Macchiato', posLinked: true }],
    ingredients: coffeeIngs(30),
    modifierGroups: ['Alt milks'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 70 },
  },
  {
    id: 'rec-iced-latte',
    name: 'Iced latte',
    category: 'Coffee',
    ingredientCost: 0.94,
    priceDineIn: 4.60,
    priceTakeaway: 4.40,
    priceDelivery: 4.80,
    marginPct: 79,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Iced latte', posLinked: true }],
    ingredients: [
      { name: 'Espresso blend', qty: '14g', supplier: 'Bidvest', price: 0.45 },
      { name: 'Whole milk', qty: '200ml', supplier: 'Fresh Earth Produce', price: 0.44 },
      { name: 'Ice', qty: '80g', supplier: 'In-house', price: 0.05 },
    ],
    modifierGroups: ['Alt milks'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 85 },
  },
  {
    id: 'rec-english-breakfast',
    name: 'English breakfast',
    category: 'Tea',
    ingredientCost: 0.32,
    priceDineIn: 2.80,
    priceTakeaway: 2.60,
    priceDelivery: 3.00,
    marginPct: 89,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'English breakfast', posLinked: true }],
    ingredients: [
      { name: 'English breakfast tea', qty: '1 bag', supplier: 'Bidvest', price: 0.30 },
      { name: 'Hot water', qty: '250ml', supplier: 'In-house', price: 0.02 },
    ],
    modifierGroups: ['Cup sizes'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 40 },
  },
  {
    id: 'rec-earl-grey',
    name: 'Earl Grey',
    category: 'Tea',
    ingredientCost: 0.34,
    priceDineIn: 2.80,
    priceTakeaway: 2.60,
    priceDelivery: 3.00,
    marginPct: 88,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Earl Grey', posLinked: true }],
    ingredients: [
      { name: 'Earl Grey tea', qty: '1 bag', supplier: 'Bidvest', price: 0.32 },
      { name: 'Hot water', qty: '250ml', supplier: 'In-house', price: 0.02 },
    ],
    modifierGroups: ['Cup sizes'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 40 },
  },
  {
    id: 'rec-green-tea',
    name: 'Green tea',
    category: 'Tea',
    ingredientCost: 0.36,
    priceDineIn: 2.80,
    priceTakeaway: 2.60,
    priceDelivery: 3.00,
    marginPct: 87,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Green tea', posLinked: true }],
    ingredients: [
      { name: 'Green tea', qty: '1 bag', supplier: 'Bidvest', price: 0.34 },
      { name: 'Hot water', qty: '250ml', supplier: 'In-house', price: 0.02 },
    ],
    modifierGroups: ['Cup sizes'],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 40 },
  },
  {
    id: 'rec-blueberry-muffin',
    name: 'Blueberry muffin',
    category: 'Pastry',
    ingredientCost: 1.12,
    priceDineIn: 3.20,
    priceTakeaway: 3.00,
    priceDelivery: 3.40,
    marginPct: 63,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Blueberry muffin', posLinked: true }],
    ingredients: [
      { name: 'Blueberry muffin', qty: '1 unit', supplier: 'Rise Bakery', price: 1.12 },
    ],
    modifierGroups: [],
    production: { visibility: null, shelfLifeMinutes: 60 * 12, prepTimeSeconds: null },
  },
  {
    id: 'rec-croissant',
    name: 'Croissant',
    category: 'Pastry',
    ingredientCost: 0.85,
    priceDineIn: 2.80,
    priceTakeaway: 2.60,
    priceDelivery: 3.00,
    marginPct: 69,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Croissant', posLinked: true }],
    ingredients: [
      { name: 'Butter croissant', qty: '1 unit', supplier: 'Rise Bakery', price: 0.85 },
    ],
    modifierGroups: [],
    production: { visibility: null, shelfLifeMinutes: 60 * 8, prepTimeSeconds: null },
  },
  {
    id: 'rec-almond-croissant',
    name: 'Almond croissant',
    category: 'Pastry',
    ingredientCost: 1.08,
    priceDineIn: 3.40,
    priceTakeaway: 3.20,
    priceDelivery: 3.60,
    marginPct: 68,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Almond croissant', posLinked: true }],
    ingredients: [
      { name: 'Almond croissant', qty: '1 unit', supplier: 'Rise Bakery', price: 1.08 },
    ],
    modifierGroups: [],
    production: { visibility: null, shelfLifeMinutes: 60 * 8, prepTimeSeconds: null },
  },
  // Slot-driven spirit recipes — share the same Spirit measure + Mixer
  // modifier groups. The slot's `defaultRef` carries the specific spirit
  // so the POS gets one shared 25/50ml button rather than 100s of
  // spirit-specific buttons (fix for problem 8).
  {
    id: 'rec-smirnoff',
    name: 'Smirnoff Vodka',
    category: 'Spirits',
    ingredientCost: 0.95,
    priceDineIn: 4.50,
    priceTakeaway: 4.50,
    priceDelivery: 5.00,
    marginPct: 79,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Smirnoff Vodka', posLinked: true }],
    ingredients: [],
    modifierGroups: [],
    posLinked: true,
    posSourceId: 'pos-mi-smirnoff',
    modifierGroupIds: ['mg-spirit-measure', 'mg-mixer'],
    slots: [
      {
        key: 'spirit',
        label: 'Spirit',
        defaultRef: { kind: 'master', masterProductId: 'mp-smirnoff-vodka' },
      },
    ],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 30 },
  },
  {
    id: 'rec-grey-goose',
    name: 'Grey Goose Vodka',
    category: 'Spirits',
    ingredientCost: 2.30,
    priceDineIn: 6.50,
    priceTakeaway: 6.50,
    priceDelivery: 7.00,
    marginPct: 65,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Grey Goose Vodka', posLinked: true }],
    ingredients: [],
    modifierGroups: [],
    posLinked: true,
    posSourceId: 'pos-mi-grey-goose',
    modifierGroupIds: ['mg-spirit-measure', 'mg-mixer'],
    slots: [
      {
        key: 'spirit',
        label: 'Spirit',
        defaultRef: { kind: 'master', masterProductId: 'mp-grey-goose-vodka' },
      },
    ],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 30 },
  },
  {
    id: 'rec-tanqueray',
    name: 'Tanqueray Gin',
    category: 'Spirits',
    ingredientCost: 1.15,
    priceDineIn: 5.00,
    priceTakeaway: 5.00,
    priceDelivery: 5.50,
    marginPct: 77,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Tanqueray Gin', posLinked: true }],
    ingredients: [],
    modifierGroups: [],
    posLinked: true,
    posSourceId: 'pos-mi-tanqueray',
    modifierGroupIds: ['mg-spirit-measure', 'mg-mixer'],
    slots: [
      {
        key: 'spirit',
        label: 'Spirit',
        defaultRef: { kind: 'master', masterProductId: 'mp-tanqueray-gin' },
      },
    ],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 30 },
  },
  // Modifier-driven wine — no default ingredient row, composition is
  // fully delegated to the Wine pour-size modifier group via a slot.
  // This is the post-rethink fix for problem 7 (no fake placeholder
  // ingredient needed to publish the recipe).
  {
    id: 'rec-savvy-b',
    name: 'Marlborough Sauvignon Blanc',
    category: 'Wine',
    ingredientCost: 0,
    priceDineIn: 6.50,
    priceTakeaway: 6.50,
    priceDelivery: 7.00,
    marginPct: 60,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Marlborough Sauvignon Blanc', posLinked: true }],
    ingredients: [],
    modifierGroups: [],
    posLinked: true,
    posSourceId: 'pos-mi-savvy-b',
    modifierGroupIds: ['mg-wine-pour'],
    slots: [
      {
        key: 'wine',
        label: 'Wine',
        defaultRef: { kind: 'master', masterProductId: 'mp-savvy-b' },
      },
    ],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 30 },
  },
  {
    id: 'rec-house-red',
    name: 'House red (glass)',
    category: 'Wine',
    ingredientCost: 1.32,
    priceDineIn: 6.50,
    priceTakeaway: 6.50,
    priceDelivery: 7.00,
    marginPct: 80,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'House red', posLinked: true }],
    ingredients: [
      { name: 'House red', qty: '175ml', supplier: 'Bidvest', price: 1.32 },
    ],
    modifierGroups: [],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 30 },
  },
  {
    id: 'rec-avocado-toast',
    name: 'Avocado toast',
    category: 'Food',
    ingredientCost: 2.04,
    priceDineIn: 8.50,
    priceTakeaway: 7.80,
    priceDelivery: 9.00,
    marginPct: 76,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Avocado toast', posLinked: true }],
    ingredients: [
      { name: 'Sourdough', qty: '2 slices', supplier: 'Rise Bakery', price: 0.60 },
      { name: 'Avocado', qty: '1 unit', supplier: 'Fresh Earth Produce', price: 1.20 },
      { name: 'Lemon', qty: '0.25 unit', supplier: 'Fresh Earth Produce', price: 0.14 },
      { name: 'Chilli flakes', qty: '1g', supplier: 'Bidvest', price: 0.05 },
      { name: 'Sea salt', qty: '1g', supplier: 'Bidvest', price: 0.05 },
    ],
    modifierGroups: [],
    production: { visibility: 'Kitchen', shelfLifeMinutes: 20, prepTimeSeconds: 240 },
  },
  {
    id: 'rec-salmon-bagel',
    name: 'Smoked salmon bagel',
    category: 'Food',
    ingredientCost: 2.40,
    priceDineIn: 8.00,
    priceTakeaway: 7.20,
    priceDelivery: 8.50,
    marginPct: 70,
    status: 'Active',
    flag: { type: 'missing-prod', label: 'no prod' },
    menuItems: [{ name: 'Smoked salmon bagel', posLinked: true }],
    ingredients: [
      { name: 'Bagel', qty: '1 unit', supplier: 'Rise Bakery', price: 0.55 },
      { name: 'Smoked salmon', qty: '60g', supplier: 'Fresh Earth Produce', price: 1.40 },
      { name: 'Cream cheese', qty: '30g', supplier: 'The Cheese Board', price: 0.30 },
      { name: 'Red onion', qty: '10g', supplier: 'Fresh Earth Produce', price: 0.10 },
      { name: 'Dill', qty: '1g', supplier: 'Fresh Earth Produce', price: 0.05 },
    ],
    modifierGroups: [],
    production: { visibility: null, shelfLifeMinutes: 30, prepTimeSeconds: 180 },
  },
  {
    // Imported from the Another Broken Egg Cafe Olo menu. The four
    // ordering panels (Choose Side / Side 1 – Eggs / Egg Preparation /
    // Side 2 – Meat Option) map to the four `mg-*` groups attached via
    // modifierGroupIds — see components/Modifiers/fixtures.ts. The Olo
    // "Preferences → Made for" free-text box has no modifier-model
    // equivalent yet (free-text isn't an option type) so it's dropped.
    id: 'rec-rwc-pancakes',
    name: 'Raspberry White Chocolate Pancakes',
    category: 'Food',
    // Sum of the ingredient line costs below (derived from master WACs
    // in components/Suppliers/fixtures.ts via components/Recipe/costing.ts).
    ingredientCost: 2.56,
    priceDineIn: 13.99,
    priceTakeaway: 13.99,
    priceDelivery: 15.50,
    marginPct: 82,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Raspberry White Chocolate Pancakes', posLinked: true }],
    ingredients: [
      { name: 'Buttermilk pancake batter', qty: '220g', supplier: 'Rise Bakery', price: 0.88 },
      { name: 'Streusel crumble', qty: '25g', supplier: 'Rise Bakery', price: 0.20 },
      { name: 'White chocolate chips', qty: '40g', supplier: 'Bidvest', price: 0.48 },
      { name: 'Raspberry coulis (house-made)', qty: '60ml', supplier: 'In-house', price: 0.72 },
      { name: 'Whipping cream', qty: '30ml', supplier: 'Fresh Earth Produce', price: 0.15 },
      { name: 'Fresh mint', qty: '2g', supplier: 'Fresh Earth Produce', price: 0.13 },
    ],
    modifierGroups: [],
    posSourceId: 'pos-mi-rwc-pancakes',
    modifierGroupIds: ['mg-pancake-sides', 'mg-side-eggs', 'mg-egg-prep', 'mg-side-meat'],
    formExtras: {
      instructions:
        'Streusel crunch pancakes layered with white chocolate chips. Top with '
        + 'warm house-made raspberry coulis, white chocolate drizzle (melted '
        + 'chips), whipped cream & fresh mint. Two eggs any style & choice of '
        + 'meat side via the side modifier groups.',
      allergens: ['Cereals containing gluten', 'Dairy', 'Eggs', 'Soya'],
    },
    production: { visibility: 'Kitchen', shelfLifeMinutes: 15, prepTimeSeconds: 600 },
  },
  {
    id: 'rec-babyccino',
    name: 'Kids babyccino',
    category: 'Kids',
    ingredientCost: 0.18,
    priceDineIn: 1.20,
    priceTakeaway: 1.20,
    priceDelivery: 1.40,
    marginPct: 85,
    status: 'Active',
    flag: null,
    menuItems: [{ name: 'Kids babyccino', posLinked: true }],
    ingredients: [
      { name: 'Whole milk', qty: '80ml', supplier: 'Fresh Earth Produce', price: 0.16 },
      { name: 'Cocoa powder', qty: '1g', supplier: 'Bidvest', price: 0.02 },
    ],
    modifierGroups: [],
    production: { visibility: 'Bar', shelfLifeMinutes: null, prepTimeSeconds: 45 },
  },
];

export function flagVariant(flag: RecipeFlag): 'warning' | 'error' | null {
  if (!flag) return null;
  if (flag.type === 'cost-drift') return 'warning';
  return 'warning';
}

export function formatCost(n: number): string {
  return `£${n.toFixed(2)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pret library entries — derived from production fixtures so the Recipes page
// shows every product on the production board, with sub-recipe dependencies
// and a workflow id intact for the drawer DAG.
// ─────────────────────────────────────────────────────────────────────────────

import { PRET_RECIPES } from '@/components/Production/fixtures';

const PRET_CONSUMED_IDS: Set<string> = new Set(
  PRET_RECIPES.flatMap((r) => r.subRecipes?.map((s) => s.recipeId) ?? []),
);

function deriveKind(r: typeof PRET_RECIPES[number]): RecipeKind {
  if (r.subRecipes && r.subRecipes.length > 0) return 'assembly';
  if (PRET_CONSUMED_IDS.has(r.id)) return 'component';
  return 'standalone';
}

/**
 * Demo pricing for the Pret library entries on the Recipes page. Real
 * Pret menus price dine-in and takeaway the same and tack a small
 * surcharge onto delivery (delivery-platform commission). Components
 * (granary loaves, egg mayo fillings, etc.) aren't sold directly so
 * they keep £0 and the drawer hides the Price & margin section as
 * before. Margin uses a 30% food cost rule of thumb so the rendered
 * "margin %" reads sensibly without per-recipe ingredient costing.
 */
const PRET_DEMO_PRICE_BY_CATEGORY: Record<string, { dineIn: number; takeaway: number; delivery: number }> = {
  Sandwich: { dineIn: 4.50, takeaway: 4.50, delivery: 5.50 },
  Salad:    { dineIn: 6.00, takeaway: 6.00, delivery: 7.00 },
  Bakery:   { dineIn: 2.50, takeaway: 2.50, delivery: 3.00 },
  Snack:    { dineIn: 3.50, takeaway: 3.50, delivery: 4.00 },
  Beverage: { dineIn: 3.00, takeaway: 3.00, delivery: 3.50 },
};

function pricingFor(r: typeof PRET_RECIPES[number], kind: RecipeKind): {
  ingredientCost: number;
  priceDineIn: number;
  priceTakeaway: number;
  priceDelivery: number;
  marginPct: number;
} {
  // Components and prep items aren't sellable on their own — keep
  // them at £0 so the drawer's `noPrice` gate hides the section.
  if (kind === 'component' || r.isPrep) {
    return { ingredientCost: 0, priceDineIn: 0, priceTakeaway: 0, priceDelivery: 0, marginPct: 0 };
  }
  const tier = PRET_DEMO_PRICE_BY_CATEGORY[r.category];
  if (!tier) {
    return { ingredientCost: 0, priceDineIn: 0, priceTakeaway: 0, priceDelivery: 0, marginPct: 0 };
  }
  const ingredientCost = Math.round(tier.dineIn * 0.30 * 100) / 100;
  const marginPct = Math.round(((tier.dineIn - ingredientCost) / tier.dineIn) * 100);
  return {
    ingredientCost,
    priceDineIn: tier.dineIn,
    priceTakeaway: tier.takeaway,
    priceDelivery: tier.delivery,
    marginPct,
  };
}

export const PRET_LIBRARY_RECIPES: Recipe[] = PRET_RECIPES.map((r) => {
  const kind = deriveKind(r);
  const pricing = pricingFor(r, kind);
  // Components and prep items aren't sold directly — they're consumed by
  // assemblies. Stand-alone Pret items (sandwiches, salads, snacks) ARE
  // sellable on the POS.
  const sellable = kind === 'standalone' && !r.isPrep;
  return {
    id: r.id,
    name: r.name,
    category: r.category as RecipeCategory,
    ...pricing,
    status: 'Active' as RecipeStatus,
    flag: null,
    ingredients: [],
    posLinked: sellable,
    production: {
      visibility: null,
      shelfLifeMinutes: r.shelfLifeMinutes,
      prepTimeSeconds: null,
    },
    kind,
    subRecipes: r.subRecipes?.map((s) => ({
      recipeId: s.recipeId,
      quantityPerUnit: s.quantityPerUnit,
      unit: s.unit,
    })),
    workflowId: r.workflowId,
    isPrep: r.isPrep,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Demo seed for `ingredientsV2` — the typed, master/product-aware ingredient
// rows. Only a handful of demo recipes are migrated below so the new editor
// + the menu-item resolver have something concrete to render. The remaining
// recipes still rely on legacy `ingredients[]` strings until they're edited
// (the picker creates new ingredientsV2 rows on save).
//
// Site overrides on the espresso dose demonstrate problem 6 from the
// recipes rethink: Site A uses 16g, Site B uses 18g, no recipe fork.
// ─────────────────────────────────────────────────────────────────────────────

const FITZROY_INGREDIENTSV2_BY_RECIPE: Record<string, RecipeIngredient[]> = {
  'rec-flat-white': [
    {
      id: 'ri-flat-espresso',
      ref: { kind: 'master', masterProductId: 'mp-espresso-blend' },
      baseQty: { value: 18, unit: 'g' },
      siteOverrides: {
        'Brixton Outpost': { value: 16, unit: 'g' },
      },
      tags: ['dose'],
    },
    {
      id: 'ri-flat-milk',
      ref: { kind: 'master', masterProductId: 'mp-whole-milk-1l' },
      baseQty: { value: 180, unit: 'ml' },
    },
  ],
  'rec-latte': [
    {
      id: 'ri-latte-espresso',
      ref: { kind: 'master', masterProductId: 'mp-espresso-blend' },
      baseQty: { value: 18, unit: 'g' },
      siteOverrides: {
        'Brixton Outpost': { value: 16, unit: 'g' },
      },
      tags: ['dose'],
    },
    {
      id: 'ri-latte-milk',
      ref: { kind: 'master', masterProductId: 'mp-whole-milk-1l' },
      baseQty: { value: 200, unit: 'ml' },
    },
  ],
  'rec-cappuccino': [
    {
      id: 'ri-capp-espresso',
      ref: { kind: 'master', masterProductId: 'mp-espresso-blend' },
      baseQty: { value: 18, unit: 'g' },
      tags: ['dose'],
    },
    {
      id: 'ri-capp-milk',
      ref: { kind: 'master', masterProductId: 'mp-whole-milk-1l' },
      baseQty: { value: 150, unit: 'ml' },
    },
  ],
  // Base plate only — the eggs and meat sides arrive via `add` effects
  // on the mg-side-eggs / mg-side-meat modifier groups, so they
  // deliberately do NOT appear here.
  'rec-rwc-pancakes': [
    {
      id: 'ri-rwc-batter',
      ref: { kind: 'master', masterProductId: 'mp-pancake-batter' },
      baseQty: { value: 220, unit: 'g' },
    },
    {
      id: 'ri-rwc-streusel',
      ref: { kind: 'master', masterProductId: 'mp-streusel-crumble' },
      baseQty: { value: 25, unit: 'g' },
    },
    {
      id: 'ri-rwc-choc-chips',
      ref: { kind: 'master', masterProductId: 'mp-white-choc-chips' },
      baseQty: { value: 30, unit: 'g' },
      note: 'folded into the batter',
    },
    {
      id: 'ri-rwc-choc-drizzle',
      ref: { kind: 'master', masterProductId: 'mp-white-choc-chips' },
      baseQty: { value: 10, unit: 'g' },
      note: 'melted for the drizzle',
    },
    {
      id: 'ri-rwc-coulis',
      ref: { kind: 'master', masterProductId: 'mp-raspberry-coulis' },
      baseQty: { value: 60, unit: 'ml' },
      note: 'served warm',
    },
    {
      id: 'ri-rwc-cream',
      ref: { kind: 'master', masterProductId: 'mp-whipping-cream' },
      baseQty: { value: 30, unit: 'ml' },
      note: 'whipped to order',
    },
    {
      id: 'ri-rwc-mint',
      ref: { kind: 'master', masterProductId: 'mp-fresh-mint' },
      baseQty: { value: 2, unit: 'g' },
    },
  ],
  // Spirit recipes deliberately have NO base ingredients — composition
  // comes from the `spirit` slot + Spirit measure modifier. Same for
  // wine (rec-savvy-b).
};

// Typed packaging rows by recipe id. Same shape as ingredients —
// packaging IS just-a-product-the-order-consumes, so modifier
// effects (replace / add / scale) can target it the same way.
//
// Demonstrates: Large coffee modifier → Replace 8oz cup with 12oz cup
// (see `mg-coffee-size-large` in components/Modifiers/fixtures.ts).
const FITZROY_PACKAGINGV2_BY_RECIPE: Record<string, RecipeIngredient[]> = {
  'rec-flat-white': [
    {
      id: 'rp-flat-cup', ref: { kind: 'master', masterProductId: 'mp-cup-takeaway-8oz' },
      baseQty: { value: 1, unit: 'each' },
    },
    {
      id: 'rp-flat-lid', ref: { kind: 'master', masterProductId: 'mp-cup-lid' },
      baseQty: { value: 1, unit: 'each' },
    },
  ],
  'rec-latte': [
    {
      id: 'rp-latte-cup', ref: { kind: 'master', masterProductId: 'mp-cup-takeaway-8oz' },
      baseQty: { value: 1, unit: 'each' },
    },
    {
      id: 'rp-latte-lid', ref: { kind: 'master', masterProductId: 'mp-cup-lid' },
      baseQty: { value: 1, unit: 'each' },
    },
  ],
  'rec-cappuccino': [
    {
      id: 'rp-capp-cup', ref: { kind: 'master', masterProductId: 'mp-cup-takeaway-8oz' },
      baseQty: { value: 1, unit: 'each' },
    },
    {
      id: 'rp-capp-lid', ref: { kind: 'master', masterProductId: 'mp-cup-lid' },
      baseQty: { value: 1, unit: 'each' },
    },
  ],
};

function withIngredientsV2(r: Recipe): Recipe {
  const v2 = FITZROY_INGREDIENTSV2_BY_RECIPE[r.id];
  const pkg = FITZROY_PACKAGINGV2_BY_RECIPE[r.id];
  if (!v2 && !pkg) return r;
  return {
    ...r,
    ingredientsV2: v2 ?? r.ingredientsV2,
    packagingV2: pkg ?? r.packagingV2,
  };
}

// Map legacy free-text modifier-group names to catalogue-level
// ModifierGroup ids (`components/Modifiers/fixtures.ts`).
const LEGACY_MODGROUP_NAME_TO_ID: Record<string, string> = {
  'Alt milks': 'mg-alt-milks',
  'Cup sizes': 'mg-coffee-size',
  'Pour size': 'mg-spirit-measure',
};

/**
 * Convert a legacy seed entry to a clean Recipe (kind injected by caller).
 * Computes `posLinked` from the deprecated `menuItems[].posLinked` field
 * and resolves the free-text `modifierGroups[]` names to catalogue ids.
 * Fixture-level overrides (e.g. wine / spirit recipes that set their
 * own `posLinked`, `modifierGroupIds`, or `slots`) take precedence.
 */
function migrateLegacySeed(s: LegacyFitzroySeed): Omit<Recipe, 'kind'> {
  const { menuItems, modifierGroups, ...rest } = s;
  const derivedPosLinked = menuItems.length > 0
    ? menuItems.some((m) => m.posLinked)
    : false;
  const derivedGroupIds = modifierGroups
    .map((name) => LEGACY_MODGROUP_NAME_TO_ID[name])
    .filter((id): id is string => !!id);
  return {
    ...rest,
    posLinked: rest.posLinked ?? derivedPosLinked,
    modifierGroupIds: rest.modifierGroupIds ?? (derivedGroupIds.length > 0 ? derivedGroupIds : undefined),
    slots: rest.slots,
    posSourceId: rest.posSourceId,
    variantDimensions: rest.variantDimensions,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Burger King library entries — derived from the BK production fixtures the
// same way the Pret entries are, tagged `brand: 'bk'` so the recipes page
// can show the BK menu only when the Burger King persona is active.
// ─────────────────────────────────────────────────────────────────────────────

import { BK_RECIPES } from '@/components/Production/bkFixtures';

const BK_CONSUMED_IDS: Set<string> = new Set(
  BK_RECIPES.flatMap((r) => r.subRecipes?.map((s) => s.recipeId) ?? []),
);

export const BK_LIBRARY_RECIPES: Recipe[] = BK_RECIPES.map((r) => {
  const kind: RecipeKind =
    r.subRecipes && r.subRecipes.length > 0
      ? 'assembly'
      : BK_CONSUMED_IDS.has(r.id)
        ? 'component'
        : 'standalone';
  // Assembled burgers are the sellable POS items; cook components (patties,
  // chicken, bacon, …) are made-to-hold and consumed by assemblies.
  const sellable = kind === 'assembly';
  const dineIn = sellable ? 5.99 : 0;
  const ingredientCost = sellable ? Math.round(dineIn * 0.32 * 100) / 100 : 0;
  return {
    id: r.id,
    name: r.name,
    category: r.category as RecipeCategory,
    brand: 'bk',
    ingredientCost,
    priceDineIn: dineIn,
    priceTakeaway: dineIn,
    priceDelivery: sellable ? dineIn + 1 : 0,
    marginPct: sellable ? Math.round(((dineIn - ingredientCost) / dineIn) * 100) : 0,
    status: 'Active' as RecipeStatus,
    flag: null,
    ingredients: [],
    posLinked: sellable,
    production: {
      visibility: 'Kitchen' as const,
      shelfLifeMinutes: r.shelfLifeMinutes,
      prepTimeSeconds: null,
    },
    kind,
    subRecipes: r.subRecipes?.map((s) => ({
      recipeId: s.recipeId,
      quantityPerUnit: s.quantityPerUnit,
      unit: s.unit,
    })),
    workflowId: r.workflowId,
  } as Recipe;
});

export const ALL_LIBRARY_RECIPES: Recipe[] = [
  ...FITZROY_RECIPES.map((s): Recipe => withIngredientsV2({
    ...migrateLegacySeed(s),
    kind: 'standalone',
  })),
  ...PRET_LIBRARY_RECIPES,
  ...BK_LIBRARY_RECIPES,
];

/** Inverse of subRecipes: which recipes consume this one. */
export function buildUsedInIndex(recipes: Recipe[]): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  for (const r of recipes) {
    if (!r.subRecipes) continue;
    for (const sub of r.subRecipes) {
      const list = idx.get(sub.recipeId) ?? [];
      list.push(r.id);
      idx.set(sub.recipeId, list);
    }
  }
  return idx;
}

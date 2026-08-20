/**
 * Templates that drive the in-Feed "New recipe" chat wizard.
 *
 * Each template holds the ingredients + packaging the wizard should
 * pre-fill, along with realistic `unitCostP` per row (pence per uom)
 * and a small set of substitution candidates the Margin Explorer
 * surfaces as AI nudges ("swap to local avocado, save 23p").
 *
 * Costs are illustrative — they exist so the wizard's cost rollup,
 * COGS ladder, per-channel suggested prices, and swap recalcs all
 * land at numbers a hospitality operator would recognise as
 * plausible. They are NOT pulled from the live `recipeStore`; the
 * wizard is a demo surface.
 */

export interface SubstitutionCandidate {
  /** Stable id used as the swap selector value. */
  id: string;
  name: string;
  /** Pence per uom. Same uom as the parent ingredient row. */
  unitCostP: number;
  /** Short provenance label, e.g. "Local farm", "Costco bulk". */
  source: string;
  /** Optional one-line rationale shown under the swap chip. */
  note?: string;
}

export interface TemplateIngredient {
  /** Stable id used as the selected-swap key. */
  id: string;
  name: string;
  qty: number;
  uom: string;
  /** Pence per uom — `qty * unitCostP / 100` = $ per serve. */
  unitCostP: number;
  /** Provenance label shown alongside the row. */
  source: string;
  /** Optional alternatives the AI suggests. The first is the
   *  cheapest; the explorer ranks them by delta vs base. */
  swaps?: SubstitutionCandidate[];
  /** When true, the qty input is hidden ("to taste"). Cost still
   *  contributes (set qty + unitCostP to a plausible nominal). */
  toTaste?: boolean;
}

export interface RecipeWizardTemplate {
  id: string;
  /** User-facing name shown in the card header and used as the
   *  fallback user-echo text when the chip launches the flow. */
  name: string;
  /** Product class label fed into the sites copy + done summary
   *  ("under the **Food** product class"). */
  productClass: string;
  /** True when the item is hot food → dine-in VAT applies. Avocado
   *  toast is hot; cold sandwich (chicken-mayo) is not. */
  vatHot: boolean;
  /** Indicative serves/day for the weekly GP projection in the
   *  Margin Explorer card. */
  servesPerDay: number;
  /** Default seed for the COGS-target picker. */
  defaultTargetCogsPct: number;
  /** Serves per recipe — feeds the "Serves N" badge. */
  yieldQty: number;
  yieldUom: string;
  ingredients: TemplateIngredient[];
  /** Packaging rows the wizard offers in the packaging step.
   *  Costs are per-serve. */
  packaging: PackagingTemplate[];
  /** Pre-checked packaging ids (AI-suggested). */
  packagingDefaultIds: string[];
  /** Allergens the AI auto-detects from this template. */
  autoDetectedAllergens: string[];
  /** Headline for the supplier-link step ("I noticed you don't
   *  have a supplier set up for X — I'd recommend Y"). */
  supplierLinkMsg: string;
  /** Confirmation copy when the user clicks "Yes, add them". */
  supplierAddedFragment: string;
}

export interface PackagingTemplate {
  id: string;
  name: string;
  /** $ per serve. Kept as decimal pounds — matches the existing
   *  packaging picker maths in the wizard. */
  cost: number;
  unit: string;
}

// ───────────────────────────────────────────────────────────────
// Avocado toast (hot brunch item) — primary demo
// ───────────────────────────────────────────────────────────────

const AVOCADO_TOAST_TEMPLATE: RecipeWizardTemplate = {
  id: 'avocado-toast',
  name: 'Avocado Toast',
  productClass: 'Food',
  vatHot: true,
  servesPerDay: 28,
  defaultTargetCogsPct: 25,
  yieldQty: 1,
  yieldUom: 'each',
  ingredients: [
    {
      id: 'sourdough',
      name: 'Sourdough loaf (sliced, toasted)',
      qty: 90,
      uom: 'g',
      unitCostP: 0.85,
      source: 'Fitzroy Bakehouse',
      swaps: [
        {
          id: 'sourdough-supermarket',
          name: 'Supermarket sourdough loaf',
          unitCostP: 0.42,
          source: 'Costco bulk',
          note: 'Same gram weight, ~50% cheaper. Slight texture drop.',
        },
      ],
    },
    {
      id: 'avocado',
      name: 'Hass avocado (large)',
      qty: 1,
      uom: 'pc',
      unitCostP: 85,
      source: 'Imported · Peru',
      swaps: [
        {
          id: 'avocado-spanish',
          name: 'Hass avocado · Spanish (in season)',
          unitCostP: 62,
          source: 'EU import · seasonal',
          note: 'Cuts food miles. Available Apr–Sep.',
        },
        {
          id: 'avocado-mexican',
          name: 'Hass avocado · Mexican bulk pack',
          unitCostP: 71,
          source: 'Wholesale bulk',
          note: 'Volume buy, locks in price.',
        },
      ],
    },
    {
      id: 'olive-oil',
      name: 'Extra virgin olive oil',
      qty: 5,
      uom: 'ml',
      unitCostP: 1.6,
      source: 'House blend',
      swaps: [
        {
          id: 'rapeseed-oil',
          name: 'Cold-pressed rapeseed oil',
          unitCostP: 0.6,
          source: 'UK rapeseed',
          note: 'Same finish on hot toast at a third of the cost.',
        },
      ],
    },
    {
      id: 'lemon',
      name: 'Lemon (juice)',
      qty: 0.1,
      uom: 'pc',
      unitCostP: 30,
      source: 'Wholesale citrus',
    },
    {
      id: 'chilli-flakes',
      name: 'Aleppo chilli flakes',
      qty: 1,
      uom: 'g',
      unitCostP: 2.2,
      source: 'Spice rack',
    },
    {
      id: 'sea-salt',
      name: 'Maldon sea salt',
      qty: 1,
      uom: 'g',
      unitCostP: 1.1,
      source: 'Larder',
    },
    {
      id: 'microgreens',
      name: 'Microgreens (garnish)',
      qty: 5,
      uom: 'g',
      unitCostP: 8,
      source: 'Local farm',
      swaps: [
        {
          id: 'microgreens-skip',
          name: 'Skip microgreens · finish with chilli + salt only',
          unitCostP: 0,
          source: 'Omit',
          note: 'Most operators drop the garnish — keeps presentation tight.',
        },
      ],
    },
  ],
  packaging: [
    { id: 'box-kraft', name: 'Kraft takeaway box', cost: 0.32, unit: 'ea' },
    { id: 'box-paper', name: 'Recyclable paper wrap', cost: 0.18, unit: 'ea' },
    { id: 'napkin', name: 'Napkin', cost: 0.03, unit: 'ea' },
    { id: 'sticker', name: 'Branded label/sticker', cost: 0.05, unit: 'ea' },
  ],
  packagingDefaultIds: ['box-kraft', 'napkin'],
  autoDetectedAllergens: ['Cereals containing gluten'],
  supplierLinkMsg:
    "I've linked most of these to your existing Edify catalogue — olive oil, lemons, chilli and salt are all matched to current suppliers.\n\n" +
    "However, I noticed you don't have a supplier set up for **sourdough loaves** yet.\n\n" +
    "I'd recommend **Fitzroy Bakehouse** — they're already supplying two of your sites for pastries, deliver six mornings a week, and most operators on a similar menu shape source through them. Want me to add them as the sourdough supplier?",
  supplierAddedFragment:
    'Fitzroy Bakehouse is now set up as a supplier and linked to sourdough in your recipe.',
};

// ───────────────────────────────────────────────────────────────
// Chicken & mayo sandwich — preserves the original demo
// ───────────────────────────────────────────────────────────────

const CHICKEN_MAYO_TEMPLATE: RecipeWizardTemplate = {
  id: 'chicken-mayo-sandwich',
  name: 'Chicken & Mayo Sandwich',
  productClass: 'Food',
  vatHot: false,
  servesPerDay: 25,
  defaultTargetCogsPct: 35,
  yieldQty: 1,
  yieldUom: 'each',
  ingredients: [
    {
      id: 'chicken',
      name: 'Chicken breast (cooked, shredded)',
      qty: 150,
      uom: 'g',
      unitCostP: 1.9,
      source: 'Wholesale poultry',
      swaps: [
        {
          id: 'chicken-thigh',
          name: 'Cooked chicken thigh (shredded)',
          unitCostP: 1.35,
          source: 'Wholesale poultry',
          note: 'Same protein per serve, ~30% cheaper. More moisture.',
        },
      ],
    },
    {
      id: 'mayo',
      name: 'Mayonnaise',
      qty: 30,
      uom: 'g',
      unitCostP: 0.73,
      source: 'Larder',
    },
    {
      id: 'mustard',
      name: 'Dijon mustard',
      qty: 5,
      uom: 'g',
      unitCostP: 3,
      source: 'Larder',
    },
    {
      id: 'lettuce',
      name: 'Baby gem lettuce',
      qty: 20,
      uom: 'g',
      unitCostP: 0.9,
      source: 'Greengrocer',
    },
    {
      id: 'tomato',
      name: 'Vine tomato (sliced)',
      qty: 40,
      uom: 'g',
      unitCostP: 0.7,
      source: 'Greengrocer',
    },
    {
      id: 'brioche',
      name: 'Brioche bun',
      qty: 1,
      uom: 'pc',
      unitCostP: 110,
      source: 'Artisan Bakehouse',
      swaps: [
        {
          id: 'brioche-supermarket',
          name: 'Supermarket brioche bun',
          unitCostP: 65,
          source: 'Costco bulk',
          note: 'Half the price; lower bake quality.',
        },
      ],
    },
    {
      id: 'salt-pepper',
      name: 'Salt & pepper',
      qty: 1,
      uom: 'g',
      unitCostP: 2,
      source: 'Larder',
    },
  ],
  packaging: [
    { id: 'wrap', name: 'Greaseproof wrap', cost: 0.08, unit: 'sheet' },
    { id: 'bag', name: 'Brown paper bag', cost: 0.06, unit: 'ea' },
    { id: 'box', name: 'Kraft takeaway box', cost: 0.32, unit: 'ea' },
    { id: 'sticker', name: 'Branded label/sticker', cost: 0.05, unit: 'ea' },
    { id: 'napkin', name: 'Napkin', cost: 0.03, unit: 'ea' },
  ],
  packagingDefaultIds: ['wrap', 'sticker'],
  autoDetectedAllergens: ['Mustard', 'Eggs', 'Cereals containing gluten'],
  supplierLinkMsg:
    "I've linked most of these ingredients to your existing Edify catalogue — chicken, mayo, mustard, lettuce, and tomato are all matched to current suppliers.\n\n" +
    "However, I noticed you don't have a supplier set up for **brioche buns** yet.\n\n" +
    "I'd recommend **Artisan Bakehouse** — I picked them because they're trusted amongst our users for consistently good quality and reliable deliveries. Want me to add them as a supplier for you?",
  supplierAddedFragment:
    'Artisan Bakehouse is now set up as a supplier and linked to brioche buns in your recipe.',
};

export const RECIPE_WIZARD_TEMPLATES: RecipeWizardTemplate[] = [
  AVOCADO_TOAST_TEMPLATE,
  CHICKEN_MAYO_TEMPLATE,
];

/** The wizard's default when a chip or auto-start kicks the flow
 *  without naming an item — avocado toast is the demo. */
export const DEFAULT_WIZARD_TEMPLATE = AVOCADO_TOAST_TEMPLATE;

/**
 * Loose lookup — matches "avocado toast", "avo toast", "avocado",
 * "chicken and mayo", "chicken mayo sandwich" etc. Returns null
 * when nothing plausibly fits, so the caller can fall back to the
 * default and flag it to the user.
 */
export function findTemplateByName(input: string): RecipeWizardTemplate | null {
  if (!input) return null;
  const norm = input.toLowerCase();
  for (const t of RECIPE_WIZARD_TEMPLATES) {
    const tokens = t.name
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((token) => token.length >= 3);
    if (tokens.length === 0) continue;
    // Match if all multi-letter tokens from the template name are
    // present in the input, OR any single token matches the
    // template's own short aliases. Short aliases capture common
    // typed phrasings like "avo toast" or "chicken sandwich".
    const allTokensHit = tokens.every((tk) => norm.includes(tk));
    if (allTokensHit) return t;
  }
  // Aliases — permissive on purpose so free-text in the composer
  // ("avocado", "avo", "guac toast", "chicken", "chicken mayo",
  // "chicken sandwich") all resolve. The detector in Feed.tsx already
  // filters out analytical phrasings ("chicken sales last week",
  // "avocado cost trend") before this lookup, so loose aliases here
  // don't accidentally hijack analytics queries.
  if (/\b(?:avo(?:cado)?|guac)\b/.test(norm)) {
    return AVOCADO_TOAST_TEMPLATE;
  }
  if (/\bchicken\b/.test(norm)) {
    return CHICKEN_MAYO_TEMPLATE;
  }
  return null;
}

// ───────────────────────────────────────────────────────────────
// Cost math — shared between the Margin Explorer card and the
// wizard's downstream copy (so receipts can show the chosen
// channel price and target COGS).
// ───────────────────────────────────────────────────────────────

/**
 * Apply the user's selected swaps to a template's ingredient list,
 * returning rows that carry the resolved cost. `selectedSwaps` is
 * `{ ingredientId: swapId }` — entries pointing at swap ids that
 * don't exist on the template are ignored.
 */
export function applySwaps(
  template: RecipeWizardTemplate,
  selectedSwaps: Record<string, string>,
): TemplateIngredient[] {
  return template.ingredients.map((ing) => {
    const swapId = selectedSwaps[ing.id];
    if (!swapId || !ing.swaps) return ing;
    const swap = ing.swaps.find((s) => s.id === swapId);
    if (!swap) return ing;
    return {
      ...ing,
      name: swap.name,
      source: swap.source,
      unitCostP: swap.unitCostP,
    };
  });
}

/** `qty * unitCostP / 100` — pence-per-uom × uom-count → $. */
export function lineCostP(qty: number, unitCostP: number): number {
  return qty * unitCostP;
}

/** Sum line costs in pence. Decimal handling stays in pence so we
 *  don't accumulate floating-point drift on six-row totals. */
export function totalFoodCostP(rows: TemplateIngredient[]): number {
  return rows.reduce((sum, r) => sum + lineCostP(r.qty, r.unitCostP), 0);
}

/** Convert pence to $ rounded to the nearest penny. */
export function penceToPounds(p: number): number {
  return Math.round(p) / 100;
}

/** SRP ex VAT that hits a given COGS%. `costP` is total cost in
 *  pence, `targetPct` is the COGS target (e.g. 25 for 25%). */
export function srpExVatForCogs(costP: number, targetPct: number): number {
  if (targetPct <= 0) return 0;
  return penceToPounds(costP / (targetPct / 100));
}

/** SRP inc VAT for hot food (20%) vs cold takeaway (0%). */
export function srpIncVat(srpEx: number, vatPct: number): number {
  return Math.round(srpEx * (1 + vatPct / 100) * 100) / 100;
}

/** Operator-side net after a delivery platform's commission. */
export function deliveryNet(srp: number, commissionPct: number): number {
  return Math.round(srp * (1 - commissionPct / 100) * 100) / 100;
}

/** Effective COGS% at a given SRP ex VAT — the inverse used by the
 *  ladder so each rung can show its own COGS read-back. */
export function effectiveCogsPct(costP: number, srpEx: number): number {
  if (srpEx <= 0) return 0;
  return Math.round((costP / 100 / srpEx) * 100);
}

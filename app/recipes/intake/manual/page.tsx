'use client';

/**
 * Build recipe manually — the "from scratch" flow.
 *
 * All fields from the current Edify form are present (see DESIGN-PRINCIPLES.md),
 * but we reduce clicks via:
 *   • Smart defaults everywhere (Status=Draft, VAT=20, Batch min=1 max=∞ multiple=1,
 *     current site pre-selected, hot/cold/production defaults per category).
 *   • Single scrollable page — no tabs.
 *   • Inline row adds for ingredients / variable ingredients / packaging.
 *   • Pill multi-select for sites, allergens, tags, production visibility.
 *   • Auto-computed ingredient cost, packaging cost, SRP inc VAT, margin.
 *   • Quinn pattern-match on name → one-tap pre-fill for category/allergens/ingredients.
 *   • Progressive disclosure: Production settings + Advanced collapsed by default.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Check,
} from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import QuinnOrb from '@/components/Sidebar/QuinnOrb';
import {
  type Recipe,
  type RecipeVariant,
  type RecipeIngredient,
  makeRecipeIngredient,
} from '@/components/Recipe/libraryFixtures';
import { createMasterProductFromName } from '@/components/Ingredients/catalogue';
import { RecipeCompositionSection } from '@/components/Recipe/RecipeCompositionSection';
import StyledSelect from '@/components/ui/StyledSelect';
import { useWorkflows, cloneWorkflow } from '@/components/Recipe/recipeStore';
import { type ProductionWorkflow } from '@/components/Production/fixtures';
import { WorkflowEditor } from '@/components/Recipe/RecipeEditors';
import {
  type FormCategory as Category,
  FORM_CATEGORIES,
  STATUSES,
  YIELD_UOMS,
  SHELF_LIFE_UNITS,
  BAKERY_HOT_PRODUCTION,
  PRODUCTION_VIS,
  SITES,
  CATEGORY_DEFAULTS,
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
  PriceCard,
  CollapsibleSidebar,
  usePersistedBoolean,
  inputStyle,
  nameInputStyle,
  selectStyle,
  primaryBtnStyle,
  primaryBtnStyleSm,
  secondaryBtnStyle,
  dismissBtnStyle,
} from '@/components/Recipe/RecipeFormParts';

// Quinn pattern-match → pre-fill suggestion
type NameSuggestion = {
  match: string;
  display: string;
  category: Category;
  allergens: string[];
  ingredients: { name: string; qty: number; uom: string; supplier: string; unitCostP: number /* pence */ }[];
};

const NAME_SUGGESTIONS: NameSuggestion[] = [
  {
    match: 'flat white',
    display: 'Flat white',
    category: 'Coffee',
    allergens: ['Dairy'],
    ingredients: [
      { name: 'Espresso blend',  qty: 7,   uom: 'g',  supplier: 'Bidvest',             unitCostP: 3 },
      { name: 'Whole milk',      qty: 180, uom: 'ml', supplier: 'Fresh Earth Produce', unitCostP: 0.42 },
    ],
  },
  {
    match: 'cappuccino',
    display: 'Cappuccino',
    category: 'Coffee',
    allergens: ['Dairy'],
    ingredients: [
      { name: 'Espresso blend',  qty: 7,   uom: 'g',  supplier: 'Bidvest',             unitCostP: 3 },
      { name: 'Whole milk',      qty: 150, uom: 'ml', supplier: 'Fresh Earth Produce', unitCostP: 0.42 },
    ],
  },
  {
    match: 'latte',
    display: 'Latte',
    category: 'Coffee',
    allergens: ['Dairy'],
    ingredients: [
      { name: 'Espresso blend',  qty: 7,   uom: 'g',  supplier: 'Bidvest',             unitCostP: 3 },
      { name: 'Whole milk',      qty: 200, uom: 'ml', supplier: 'Fresh Earth Produce', unitCostP: 0.42 },
    ],
  },
  {
    match: 'americano',
    display: 'Americano',
    category: 'Coffee',
    allergens: [],
    ingredients: [
      { name: 'Espresso blend',  qty: 14,  uom: 'g',  supplier: 'Bidvest',             unitCostP: 3 },
      { name: 'Hot water',       qty: 150, uom: 'ml', supplier: 'In-house',            unitCostP: 0 },
    ],
  },
  {
    match: 'mocha',
    display: 'Mocha',
    category: 'Coffee',
    allergens: ['Dairy'],
    ingredients: [
      { name: 'Espresso blend',  qty: 7,   uom: 'g',  supplier: 'Bidvest',             unitCostP: 3 },
      { name: 'Whole milk',      qty: 180, uom: 'ml', supplier: 'Fresh Earth Produce', unitCostP: 0.42 },
      { name: 'Chocolate syrup', qty: 20,  uom: 'ml', supplier: 'Bidvest',             unitCostP: 0.85 },
    ],
  },
  {
    match: 'muffin',
    display: 'Blueberry muffin',
    category: 'Pastry',
    allergens: ['Dairy', 'Eggs', 'Cereals containing gluten'],
    ingredients: [
      { name: 'Blueberry muffin', qty: 1, uom: 'unit', supplier: 'Rise Bakery',        unitCostP: 112 },
    ],
  },
  {
    match: 'croissant',
    display: 'Croissant',
    category: 'Pastry',
    allergens: ['Dairy', 'Eggs', 'Cereals containing gluten'],
    ingredients: [
      { name: 'Butter croissant', qty: 1, uom: 'unit', supplier: 'Rise Bakery',        unitCostP: 85 },
    ],
  },
  {
    match: 'avocado toast',
    display: 'Avocado toast',
    category: 'Food',
    allergens: ['Cereals containing gluten'],
    ingredients: [
      { name: 'Sourdough',       qty: 2,   uom: 'slice', supplier: 'Rise Bakery',        unitCostP: 40 },
      { name: 'Avocado',         qty: 1,   uom: 'unit',  supplier: 'Fresh Earth Produce', unitCostP: 120 },
      { name: 'Lemon',           qty: 0.25, uom: 'unit', supplier: 'Fresh Earth Produce', unitCostP: 40 },
      { name: 'Chilli flakes',   qty: 1,   uom: 'g',     supplier: 'Bidvest',             unitCostP: 2 },
      { name: 'Sea salt',        qty: 1,   uom: 'g',     supplier: 'Bidvest',             unitCostP: 1 },
    ],
  },
];

function findNameSuggestion(name: string): NameSuggestion | null {
  const q = name.toLowerCase().trim();
  if (q.length < 3) return null;
  return NAME_SUGGESTIONS.find((s) => q.includes(s.match)) ?? null;
}

// ── Form page ────────────────────────────────────────────────────────────────

export default function ManualRecipePage() {
  const router = useRouter();

  // Right-column collapse — shares its persisted key with the edit page so
  // a user's preference carries across the create → edit flow. Defaults to
  // collapsed so a fresh recipe opens with the wide form. Key is `.v2` to
  // discard the earlier `false` default that some sessions may have
  // already persisted.
  const [priceCollapsed, setPriceCollapsed] = usePersistedBoolean('recipe.priceSidebar.collapsed.v2', true);

  // Core fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [yieldQty, setYieldQty] = useState<number | ''>(1);
  const [yieldUom, setYieldUom] = useState('serving');
  const [sites, setSites] = useState<string[]>(['Fitzroy Espresso']);
  const [kind, setKind] = useState<Recipe['kind']>('standalone');
  const [countInStockTake, setCountInStockTake] = useState(false);
  const [excludeFromCogs, setExcludeFromCogs] = useState(false);

  // Composition
  const [ingredientsV2, setIngredientsV2] = useState<RecipeIngredient[]>([]);
  const [packagingV2, setPackagingV2] = useState<RecipeIngredient[]>([]);
  const [variants, setVariants] = useState<RecipeVariant[]>([]);
  const [modifierGroupIds, setModifierGroupIds] = useState<string[]>([]);
  const [modeQuestionDismissed, setModeQuestionDismissed] = useState(false);

  // Describe
  const [instruction, setInstruction] = useState('');
  const [allergens, setAllergens] = useState<string[]>([]);
  const [photoName, setPhotoName] = useState<string | null>(null);

  // Pricing
  const [desiredMargin, setDesiredMargin] = useState<number | ''>(70);
  const [vatPct, setVatPct] = useState<number | ''>(20);
  const [hotCold, setHotCold] = useState<'hot' | 'cold' | null>(null);

  const [srpDineInEx, setSrpDineInEx] = useState<number | ''>('');
  const [srpTakeawayEx, setSrpTakeawayEx] = useState<number | ''>('');
  const [srpDeliveryEx, setSrpDeliveryEx] = useState<number | ''>('');
  const [deliveryCommission, setDeliveryCommission] = useState<number | ''>('');

  // Lifecycle / stocking — Status sits at the top of Basics; the rest are
  // inside the Production settings collapsible.
  const [status, setStatus] = useState('Draft');
  const [subRecipe, setSubRecipe] = useState(false);
  const [shelfLifeValue, setShelfLifeValue] = useState<number | ''>('');
  const [shelfLifeUnit, setShelfLifeUnit] = useState('minutes');
  const [expiryDate, setExpiryDate] = useState('');
  const [closingRange, setClosingRange] = useState('');
  const [allowCarryOver, setAllowCarryOver] = useState(false);
  const [enablePcr, setEnablePcr] = useState(false);

  // Production settings (collapsed by default)
  const [showProduction, setShowProduction] = useState(false);
  const [productionVis, setProductionVis] = useState<string[]>([]);
  const [prepSec, setPrepSec] = useState<number | ''>('');
  const [productionRef, setProductionRef] = useState('');
  const [keyIngredients, setKeyIngredients] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [minBatch, setMinBatch] = useState<number | ''>(1);
  const [maxBatch, setMaxBatch] = useState<number | '' | 'unlimited'>('unlimited');
  const [batchMultiple, setBatchMultiple] = useState<number | ''>(1);
  const [bakeryHot, setBakeryHot] = useState('None');
  const [usedFor, setUsedFor] = useState<string[]>([]);

  // Production flow (collapsed by default — workflow attach + stages)
  const [showWorkflowSections, setShowWorkflowSections] = useState(false);
  const [draftWorkflow, setDraftWorkflow] = useState<ProductionWorkflow | null>(null);
  const allWorkflows = useWorkflows();

  // Quinn pre-fill suggestion
  const [suggestion, setSuggestion] = useState<NameSuggestion | null>(null);
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (suggestionApplied) return;
    const found = findNameSuggestion(name);
    if (found && suggestionDismissed !== found.match) {
      setSuggestion(found);
    } else {
      setSuggestion(null);
    }
  }, [name, suggestionApplied, suggestionDismissed]);

  function applySuggestion() {
    if (!suggestion) return;
    setCategory(suggestion.category);
    setAllergens(Array.from(new Set([...allergens, ...suggestion.allergens])));
    // Pre-fill ingredients by creating / finding master products for each
    // suggestion item, then building RecipeIngredient rows.
    const newRows: RecipeIngredient[] = suggestion.ingredients.map((i) => {
      const mp = createMasterProductFromName({ name: i.name, unit: i.uom });
      return makeRecipeIngredient(
        { kind: 'master', masterProductId: mp.id },
        { value: i.qty, unit: i.uom },
      );
    });
    setIngredientsV2((prev) => [...prev, ...newRows]);
    applyCategoryDefaults(suggestion.category);
    setSuggestionApplied(true);
    setSuggestion(null);
  }

  function applyCategoryDefaults(cat: Category) {
    const d = CATEGORY_DEFAULTS[cat];
    setHotCold((prev) => prev ?? d.hotCold);
    setProductionVis((prev) => (prev.length ? prev : d.production));
    setPrepSec((prev) => (prev === '' ? d.prepSec : prev));
    setDesiredMargin((prev) => (prev === 70 || prev === '' ? d.desiredMargin : prev));
    if (d.shelfLifeMin !== null) {
      const defaultMin = d.shelfLifeMin;
      setShelfLifeValue((prev) => (prev === '' ? defaultMin : prev));
    }
  }

  // Cost is resolved from the ingredient catalogue. For brand-new
  // ingredients not yet in the catalogue the cost will show as 0 —
  // this is expected on a fresh intake form.
  const ingredientCost = 0;
  const packagingCost = 0;
  const totalCost = 0;

  function marginPct(srpEx: number | '', commissionPct: number = 0): number | null {
    if (srpEx === '' || srpEx <= 0) return null;
    const net = Number(srpEx) * (1 - commissionPct / 100);
    return Math.round(((net - totalCost) / net) * 100);
  }

  function srpInc(srpEx: number | ''): number | null {
    if (srpEx === '' || typeof vatPct !== 'number') return null;
    return Math.round(Number(srpEx) * (1 + vatPct / 100) * 100) / 100;
  }

  const canPublish = name.trim() && category && (ingredientsV2.length > 0 || variants.length > 0);

  return (
    <div style={{ padding: '20px 24px 120px', maxWidth: '1260px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      {/* Back link */}
      <button
        onClick={() => router.push('/recipes/intake')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'transparent', border: 'none', color: 'var(--color-text-muted)',
          fontSize: '14px', fontWeight: 600, cursor: 'pointer', padding: '6px 0',
          marginBottom: '14px', fontFamily: 'var(--font-primary)',
        }}
      >
        <ArrowLeft size={15} strokeWidth={2} /> Back to Add recipes
      </button>

      {/* Header */}
      <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text-primary)' }}>
        Build recipe manually
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
        Quinn has pre-filled sensible defaults. Only the name is required to save a draft.
      </p>

      {/* Two-column layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: priceCollapsed ? '1fr 44px' : '1fr 340px',
          gap: '24px', alignItems: 'start',
          transition: 'grid-template-columns 0.22s ease',
        }}
      >

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

          {/* Core card */}
          <Card>
            {/* Name + Status — Status is lifecycle metadata and benefits
                from top-level visibility, so it sits next to the name. */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <FieldLabel required>Recipe name</FieldLabel>
                <input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setSuggestionApplied(false); }}
                  placeholder="e.g. Flat white (8oz)"
                  style={nameInputStyle}
                />
              </div>
              <div style={{ minWidth: '180px' }}>
                <FieldLabel>Status</FieldLabel>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{ ...selectStyle, width: '180px' }}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Quinn suggestion chip */}
            <AnimatePresence>
              {suggestion && !suggestionApplied && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    marginTop: '10px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'linear-gradient(180deg, #FEFCF9 0%, #fff 100%)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}
                >
                  <QuinnOrb state="ready" size={22} />
                  <div style={{ flex: 1, fontSize: '14px', color: 'var(--color-text-primary)', lineHeight: 1.45 }}>
                    Looks like a <strong>{suggestion.display}</strong>. Want me to pre-fill category, allergens, and {suggestion.ingredients.length} ingredients?
                  </div>
                  <button
                    onClick={() => { setSuggestionDismissed(suggestion.match); setSuggestion(null); }}
                    style={dismissBtnStyle}
                  >
                    Not now
                  </button>
                  <button onClick={applySuggestion} style={primaryBtnStyleSm}>
                    <EdifyMark size={12} strokeWidth={2} />
                    Apply
                  </button>
                </motion.div>
              )}
              {suggestionApplied && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--color-success-light)',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '13.5px', color: 'var(--color-success)', fontWeight: 600,
                  }}
                >
                  <Check size={14} strokeWidth={2.5} />
                  Pre-filled. Tweak anything below.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Product class */}
            <div style={{ marginTop: '16px' }}>
              <FieldLabel>Product class</FieldLabel>
              <StyledSelect
                width={260}
                value={category}
                onChange={(e) => {
                  const v = e.target.value;
                  setCategory(v as Category | '');
                  if (v) applyCategoryDefaults(v as Category);
                }}
              >
                <option value="">— None —</option>
                {FORM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </StyledSelect>
            </div>

            {/* Yield */}
            <div style={{ marginTop: '16px' }}>
              <FieldLabel>Yield</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  min={0}
                  value={yieldQty}
                  onChange={(e) => setYieldQty(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ ...inputStyle, width: '80px', flexShrink: 0 }}
                />
                <StyledSelect
                  width={140}
                  value={yieldUom}
                  onChange={(e) => setYieldUom(e.target.value)}
                >
                  {YIELD_UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
                </StyledSelect>
              </div>
            </div>

            {/* Sites */}
            <div style={{ marginTop: '16px' }}>
              <FieldLabel>Sites</FieldLabel>
              <PillMulti
                options={SITES}
                selected={sites}
                onChange={setSites}
                size="sm"
                selectAll={{ allLabel: 'All sites', clearLabel: 'Clear all' }}
              />
            </div>

            {/* Type — Stand-alone / Component / Assembly. Assembly requires
                sub-recipes which a fresh recipe doesn't have yet, so it's
                disabled here until the user adds one. */}
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
                  const on = kind === k;
                  const disabled = k === 'assembly';
                  const label = k === 'standalone' ? 'Stand-alone' : k === 'component' ? 'Component' : 'Assembly';
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => !disabled && setKind(k)}
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

            {/* Inventory & costing */}
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
                    on: countInStockTake,
                    setter: setCountInStockTake,
                    hint: 'Include this recipe when counting physical inventory at stock take.',
                  },
                  {
                    key: 'excludeFromCogs' as const,
                    label: 'Exclude from COGs',
                    on: excludeFromCogs,
                    setter: setExcludeFromCogs,
                    hint: 'Skip this recipe in cost-of-goods calculations (e.g. comps, parent-rolled items).',
                  },
                ].map(({ key, label, on, setter, hint }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setter(!on)}
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

          {/* Composition — variants / ingredients / packaging / modifiers /
              allergens / instructions / photo.  Mode question appears first
              for brand-new recipes so the user declares their intent. */}
          <RecipeCompositionSection
            showModeQuestion={!modeQuestionDismissed}
            onModeQuestionDismissed={() => setModeQuestionDismissed(true)}
            ingredients={ingredientsV2}
            packaging={packagingV2}
            modifierGroupIds={modifierGroupIds}
            variants={variants}
            basePrices={{
              dineIn: typeof srpDineInEx === 'number' ? srpDineInEx : 0,
              takeaway: typeof srpTakeawayEx === 'number' ? srpTakeawayEx : 0,
              delivery: typeof srpDeliveryEx === 'number' ? srpDeliveryEx : 0,
            }}
            allergens={allergens}
            instructions={instruction}
            photoName={photoName}
            sites={sites}
            onIngredientsChange={setIngredientsV2}
            onPackagingChange={setPackagingV2}
            onModifierGroupsChange={setModifierGroupIds}
            onVariantsChange={setVariants}
            onAllergensChange={setAllergens}
            onInstructionsChange={setInstruction}
            onPhotoChange={setPhotoName}
          />

          {/* Production settings — everything operational: visibility,
              bakery/hot, prep time, key ingredients, tags, batch sizes,
              sub-recipe flag, shelf life, closing range, carry-over, PCR,
              used-for. Status (lifecycle) lives at the top of Basics. */}
          <CollapsibleCard
            label="Production settings"
            hint="Visibility, prep time, batch sizes, shelf life, stocking & production flags"
            open={showProduction}
            onToggle={() => setShowProduction((v) => !v)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <FieldLabel help="Where this recipe shows up in production — Bar (drinks), Kitchen (food), Pastry, or Variable (assigned at order time).">
                  Production visibility
                </FieldLabel>
                <PillMulti options={PRODUCTION_VIS} selected={productionVis} onChange={setProductionVis} />
              </div>

              <div>
                <FieldLabel help="Does this recipe come from the bakery, from hot production, both, or neither? Drives production routing and KDS workflows.">
                  Bakery / hot production
                </FieldLabel>
                <PillSingle options={BAKERY_HOT_PRODUCTION} selected={bakeryHot} onChange={setBakeryHot} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <FieldLabel>Preparation time (seconds)</FieldLabel>
                  <input
                    type="number"
                    value={prepSec}
                    onChange={(e) => setPrepSec(e.target.value === '' ? '' : Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel help="Optional code used to cross-reference this recipe in upstream production systems or printed prep sheets.">
                    Production reference
                  </FieldLabel>
                  <input
                    type="text"
                    value={productionRef}
                    onChange={(e) => setProductionRef(e.target.value)}
                    placeholder="e.g. PR-FW-8OZ"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Key ingredients <Soft>(used for menu filtering)</Soft></FieldLabel>
                <TagInput
                  value={keyIngredients}
                  onChange={setKeyIngredients}
                  placeholder="Type and press Enter"
                />
              </div>

              <div>
                <FieldLabel>Recipe tags</FieldLabel>
                <TagInput value={tags} onChange={setTags} placeholder="Type and press Enter" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <FieldLabel help="The smallest run size production will accept. Useful when a recipe must be made in at least N units (e.g. minimum dough mix).">
                    Min batch size
                  </FieldLabel>
                  <input
                    type="number"
                    value={minBatch}
                    onChange={(e) => setMinBatch(e.target.value === '' ? '' : Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel help='The largest run production will accept in a single batch. Type "unlimited" to remove the cap.'>
                    Max batch size
                  </FieldLabel>
                  <input
                    type="text"
                    value={maxBatch === 'unlimited' ? 'unlimited' : String(maxBatch)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || v === 'unlimited') setMaxBatch(v as ''|'unlimited');
                      else if (!isNaN(Number(v))) setMaxBatch(Number(v));
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
                    value={batchMultiple}
                    onChange={(e) => setBatchMultiple(e.target.value === '' ? '' : Number(e.target.value))}
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
                      value={shelfLifeValue}
                      onChange={(e) => setShelfLifeValue(e.target.value === '' ? '' : Number(e.target.value))}
                      style={{ ...inputStyle, width: '100px', flexShrink: 0 }}
                    />
                    <PillSingle options={SHELF_LIFE_UNITS} selected={shelfLifeUnit} onChange={setShelfLifeUnit} />
                  </div>
                </div>
                <div>
                  <FieldLabel help="When this recipe retires from production. After this date the recipe is no longer available to produce — items already made keep their normal shelf life. Leave blank if there's no scheduled retirement.">
                    Expiry date <Soft>(optional)</Soft>
                  </FieldLabel>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
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
                  value={closingRange}
                  onChange={(e) => setClosingRange(e.target.value)}
                  placeholder="e.g. 1–5"
                  style={{ ...inputStyle, maxWidth: '220px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <CheckRow
                  label="Sub-recipe"
                  checked={subRecipe}
                  onChange={setSubRecipe}
                  help="Flag this recipe as something used inside other recipes (e.g. a sauce, a base). Distinct from the Type pill in Basics — that one's about how this recipe is sold."
                />
                <CheckRow
                  label="Allow carry-over"
                  checked={allowCarryOver}
                  onChange={setAllowCarryOver}
                  help="Leftover stock from one day can be sold the next. Off means anything unsold at close must be wasted."
                />
                <CheckRow
                  label="Enable preparation PCR"
                  checked={enablePcr}
                  onChange={setEnablePcr}
                  help="Production Cost Reconciliation — require staff to log actual ingredient usage against the recipe so variance is tracked."
                />
              </div>

              <div>
                <FieldLabel>Used for <Soft>(assembly names — which meals/combos use this)</Soft></FieldLabel>
                <TagInput value={usedFor} onChange={setUsedFor} placeholder="Add assembly name and press Enter" />
              </div>
            </div>
          </CollapsibleCard>

          {/* Production flow — optional workflow attachment + stage editor.
              For a brand-new recipe there's nothing to draw until you attach
              a workflow; once you do, the stages editor appears. The diagram
              is omitted here because there's no saved recipe to render yet. */}
          <CollapsibleCard
            label="Production flow"
            hint={
              draftWorkflow
                ? `Workflow ${draftWorkflow.id} · ${draftWorkflow.stages.length} stage${draftWorkflow.stages.length === 1 ? '' : 's'} across D-2 / D-1 / D0`
                : 'Optional. Attach a workflow to define D-2 / D-1 / D0 stages.'
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

            {!draftWorkflow ? (
              <div style={{ padding: '12px', fontSize: 12, color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)', borderRadius: 8 }}>
                No workflow attached. Pick one above to add D-2 / D-1 / D0 stages — or leave blank and add later from the recipe page.
              </div>
            ) : (
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

        {/* ── RIGHT COLUMN (pricing) ─────────────────────────────────────── */}
        <CollapsibleSidebar
          collapsed={priceCollapsed}
          onToggle={() => setPriceCollapsed((v) => !v)}
          label="Pricing"
          top={16}
        >
          <PriceCard
            totalCost={totalCost}
            ingredientCost={ingredientCost}
            packagingCost={packagingCost}
            desiredMargin={desiredMargin}
            onDesiredMargin={setDesiredMargin}
            vatPct={vatPct}
            onVat={setVatPct}
            hotCold={hotCold}
            onHotCold={setHotCold}
            srpDineInEx={srpDineInEx}
            onSrpDineIn={setSrpDineInEx}
            marginDineIn={marginPct(srpDineInEx)}
            srpIncDineIn={srpInc(srpDineInEx)}
            srpTakeawayEx={srpTakeawayEx}
            onSrpTakeaway={setSrpTakeawayEx}
            marginTakeaway={marginPct(srpTakeawayEx)}
            srpIncTakeaway={srpInc(srpTakeawayEx)}
            srpDeliveryEx={srpDeliveryEx}
            onSrpDelivery={setSrpDeliveryEx}
            deliveryCommission={deliveryCommission}
            onDeliveryCommission={setDeliveryCommission}
            marginDelivery={marginPct(srpDeliveryEx, Number(deliveryCommission) || 0)}
            srpIncDelivery={srpInc(srpDeliveryEx)}
          />
        </CollapsibleSidebar>
      </div>

      {/* Sticky bottom bar */}
      <div
        style={{
          position: 'fixed',
          left: 0, right: 0, bottom: 0,
          padding: '14px 150px 14px 220px',
          background: 'rgba(255,255,255,0.96)',
          borderTop: '1px solid var(--color-border-subtle)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', zIndex: 150,
        }}
      >
        <div style={{ maxWidth: '1260px', width: '100%', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, fontSize: '13.5px', color: 'var(--color-text-muted)' }}>
            {canPublish
              ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Ready to publish</span>
              : 'Add a name, category, and at least one ingredient to publish.'}
          </div>
          <button onClick={() => router.push('/recipes/intake')} style={secondaryBtnStyle}>Cancel</button>
          <button
            onClick={() => { alert('Saved as draft'); router.push('/recipes'); }}
            disabled={!name.trim()}
            style={{ ...secondaryBtnStyle, opacity: name.trim() ? 1 : 0.5, cursor: name.trim() ? 'pointer' : 'not-allowed' }}
          >
            Save draft
          </button>
          <button
            onClick={() => { alert('Published'); router.push('/recipes'); }}
            disabled={!canPublish}
            style={{ ...primaryBtnStyle, opacity: canPublish ? 1 : 0.5, cursor: canPublish ? 'pointer' : 'not-allowed' }}
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}


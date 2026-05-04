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

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import QuinnOrb from '@/components/Sidebar/QuinnOrb';
import { useRecipes } from '@/components/Recipe/recipeStore';
import { type ComponentRow, type ItemComponent } from '@/components/Recipe/libraryFixtures';
import {
  type FormCategory as Category,
  type VariableRow,
  type PackagingRow,
  ALLERGENS,
  PRODUCT_CLASSES,
  STATUSES,
  YIELD_UOMS,
  SHELF_LIFE_UNITS,
  BAKERY_HOT_PRODUCTION,
  PRODUCTION_VIS,
  SITES,
  CATEGORY_DEFAULTS,
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
  primaryBtnStyleSm,
  secondaryBtnStyle,
  dismissBtnStyle,
} from '@/components/Recipe/RecipeFormParts';

// "Build recipe manually" only displays a subset of categories — keep the
// original 7 here so the UI doesn't grow Pret-only categories on this page.
const CATEGORIES: Category[] = ['Coffee', 'Tea', 'Pastry', 'Food', 'Wine', 'Spirits', 'Kids'];

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

  // Core fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [yieldQty, setYieldQty] = useState<number | ''>(1);
  const [yieldUom, setYieldUom] = useState('serving');
  const [sites, setSites] = useState<string[]>(['Fitzroy Espresso']);

  // Details
  const [instruction, setInstruction] = useState('');
  const [allergens, setAllergens] = useState<string[]>([]);
  const [photoName, setPhotoName] = useState<string | null>(null);

  // Components (ingredients + sub-recipes — unified)
  const allLibraryRecipes = useRecipes();
  const recipesById = useMemo(() => new Map(allLibraryRecipes.map((r) => [r.id, r])), [allLibraryRecipes]);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [showVariable, setShowVariable] = useState(false);
  const [variables, setVariables] = useState<VariableRow[]>([]);
  const [showPackaging, setShowPackaging] = useState(false);
  const [packaging, setPackaging] = useState<PackagingRow[]>([]);

  // Pricing
  const [desiredMargin, setDesiredMargin] = useState<number | ''>(70);
  const [vatPct, setVatPct] = useState<number | ''>(20);
  const [hotCold, setHotCold] = useState<'hot' | 'cold' | null>(null);

  const [srpDineInEx, setSrpDineInEx] = useState<number | ''>('');
  const [srpTakeawayEx, setSrpTakeawayEx] = useState<number | ''>('');
  const [srpDeliveryEx, setSrpDeliveryEx] = useState<number | ''>('');
  const [deliveryCommission, setDeliveryCommission] = useState<number | ''>('');

  // Production settings (collapsed by default)
  const [showProduction, setShowProduction] = useState(false);
  const [productionVis, setProductionVis] = useState<string[]>([]);
  const [prepSec, setPrepSec] = useState<number | ''>('');
  const [productionRef, setProductionRef] = useState('');
  const [keyIngredients, setKeyIngredients] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [minBatch, setMinBatch] = useState<number | ''>(1);
  const [maxBatch, setMaxBatch] = useState<number | '' | 'unlimited'>('unlimited');
  const [batchMultiple, setBatchMultiple] = useState<number | ''>(1);

  // Advanced (collapsed by default)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState('Draft');
  const [productClass, setProductClass] = useState('');
  const [subRecipe, setSubRecipe] = useState(false);
  const [countInStockTake, setCountInStockTake] = useState(false);
  const [excludeFromCogs, setExcludeFromCogs] = useState(false);
  const [shelfLifeValue, setShelfLifeValue] = useState<number | ''>('');
  const [shelfLifeUnit, setShelfLifeUnit] = useState('minutes');
  const [closingRange, setClosingRange] = useState('');
  const [bakeryHot, setBakeryHot] = useState('None');
  const [allowCarryOver, setAllowCarryOver] = useState(false);
  const [enablePcr, setEnablePcr] = useState(false);
  const [usedFor, setUsedFor] = useState<string[]>([]);

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
    // pre-fill components as item rows (append, don't clobber manual entries)
    const newRows: ItemComponent[] = suggestion.ingredients.map((i) => ({
      id: newId(),
      kind: 'item',
      name: i.name,
      supplier: i.supplier,
      qty: i.qty,
      uom: i.uom,
      unitCostP: i.unitCostP,
    }));
    setComponents((prev) => [
      ...prev.filter((p) => p.kind !== 'item' || (p as ItemComponent).name.trim()),
      ...newRows,
    ]);
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

  // Computed totals — sum item-row cost (qty × unitCostP/100) + sub-recipe cost (qty × that recipe's ingredientCost)
  const ingredientCost = useMemo(() => {
    return components.reduce((sum, r) => {
      const q = typeof r.qty === 'number' ? r.qty : 0;
      if (r.kind === 'item') return sum + (q * r.unitCostP) / 100;
      const sub = recipesById.get(r.recipeId);
      return sum + q * (sub?.ingredientCost ?? 0);
    }, 0);
  }, [components, recipesById]);

  const packagingCost = useMemo(() => {
    return packaging.reduce((sum, r) => {
      const q = typeof r.qty === 'number' ? r.qty : 0;
      return sum + (q * r.unitCostP) / 100;
    }, 0);
  }, [packaging]);

  const totalCost = ingredientCost + packagingCost;

  function marginPct(srpEx: number | '', commissionPct: number = 0): number | null {
    if (srpEx === '' || srpEx <= 0) return null;
    const net = Number(srpEx) * (1 - commissionPct / 100);
    return Math.round(((net - totalCost) / net) * 100);
  }

  function srpInc(srpEx: number | ''): number | null {
    if (srpEx === '' || typeof vatPct !== 'number') return null;
    return Math.round(Number(srpEx) * (1 + vatPct / 100) * 100) / 100;
  }

  function addTag() {
    const t = tagDraft.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagDraft('');
  }

  const canPublish = name.trim() && category && components.some((r) => r.kind === 'recipe' || (r.kind === 'item' && r.name.trim()));

  return (
    <div style={{ padding: '20px 24px 120px', maxWidth: '1260px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      {/* Back link */}
      <button
        onClick={() => router.push('/recipes/intake')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'transparent', border: 'none', color: 'var(--color-text-muted)',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '6px 0',
          marginBottom: '14px', fontFamily: 'var(--font-primary)',
        }}
      >
        <ArrowLeft size={14} strokeWidth={2} /> Back to Add recipes
      </button>

      {/* Header */}
      <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text-primary)' }}>
        Build recipe manually
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 16px', lineHeight: 1.45 }}>
        Quinn has pre-filled sensible defaults. Only the name is required to save a draft.
      </p>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

          {/* Core card */}
          <Card>
            {/* Name */}
            <FieldLabel required>Recipe name</FieldLabel>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setSuggestionApplied(false); }}
              placeholder="e.g. Flat white (8oz)"
              style={nameInputStyle}
            />

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
                  <div style={{ flex: 1, fontSize: '13px', color: 'var(--color-text-primary)' }}>
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
                    fontSize: '12.5px', color: 'var(--color-success)', fontWeight: 600,
                  }}
                >
                  <Check size={13} strokeWidth={2.5} />
                  Pre-filled. Tweak anything below.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Category (pills) */}
            <div style={{ marginTop: '16px' }}>
              <FieldLabel>Category</FieldLabel>
              <PillSingle
                options={CATEGORIES}
                selected={category}
                onChange={(v) => {
                  setCategory(v as Category | '');
                  if (v) applyCategoryDefaults(v as Category);
                }}
                allowClear
              />
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
                <PillSingle options={YIELD_UOMS} selected={yieldUom} onChange={setYieldUom} />
              </div>
            </div>

            {/* Sites */}
            <div style={{ marginTop: '16px' }}>
              <FieldLabel>Sites</FieldLabel>
              <PillMulti options={SITES} selected={sites} onChange={setSites} />
            </div>
          </Card>

          {/* Recipe components — unified ingredients + sub-recipes */}
          <Card>
            <SectionHeader
              title="Recipe components"
              hint="Add raw ingredients or pull in another recipe as a sub-recipe. Build order = top to bottom."
            />
            <ComponentTable
              rows={components}
              recipesById={recipesById}
              onChange={setComponents}
            />
          </Card>

          {/* Variable ingredients (collapsible) */}
          <CollapsibleCard
            label="Variable ingredients"
            hint={variables.length ? `${variables.length} row${variables.length === 1 ? '' : 's'}` : 'e.g. alt milks, size variations — usually better done as a shared modifier group'}
            open={showVariable}
            onToggle={() => setShowVariable((v) => !v)}
          >
            <VariableTable
              rows={variables}
              onChange={(id, patch) => setVariables((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r))}
              onRemove={(id) => setVariables((rs) => rs.filter((r) => r.id !== id))}
              onAdd={() => setVariables((rs) => [...rs, emptyVariable()])}
            />
          </CollapsibleCard>

          {/* Packaging (collapsible) */}
          <CollapsibleCard
            label="Packaging"
            hint={packaging.length ? `${packaging.length} row${packaging.length === 1 ? '' : 's'}` : 'Cups, lids, boxes — cost rolls into takeaway / delivery pricing'}
            open={showPackaging}
            onToggle={() => setShowPackaging((v) => !v)}
          >
            <PackagingTable
              rows={packaging}
              onChange={(id, patch) => setPackaging((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r))}
              onRemove={(id) => setPackaging((rs) => rs.filter((r) => r.id !== id))}
              onAdd={() => setPackaging((rs) => [...rs, emptyPackaging()])}
            />
          </CollapsibleCard>

          {/* Instruction */}
          <Card>
            <FieldLabel>Instructions <Soft>(optional)</Soft></FieldLabel>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="How the team should make this — prep, build, finish."
              rows={3}
              style={textareaStyle}
            />
          </Card>

          {/* Allergens */}
          <Card>
            <FieldLabel>Allergens <Soft>(optional)</Soft></FieldLabel>
            <PillMulti options={ALLERGENS} selected={allergens} onChange={setAllergens} />
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
                background: photoName ? 'var(--color-success-light)' : 'var(--color-bg-hover)',
              }}
            >
              <ImageIcon size={18} color={photoName ? 'var(--color-success)' : 'var(--color-text-muted)'} strokeWidth={1.8} />
              <span style={{ fontSize: '13px', color: photoName ? 'var(--color-success)' : 'var(--color-text-secondary)', flex: 1 }}>
                {photoName ?? 'Drop an image or click to upload'}
              </span>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => setPhotoName(e.target.files?.[0]?.name ?? null)}
              />
            </label>
          </Card>

          {/* Production settings (collapsible) */}
          <CollapsibleCard
            label="Production settings"
            hint="Visibility, prep time, key ingredients, batch sizes"
            open={showProduction}
            onToggle={() => setShowProduction((v) => !v)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <FieldLabel>Production visibility</FieldLabel>
                <PillMulti options={PRODUCTION_VIS} selected={productionVis} onChange={setProductionVis} />
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
                  <FieldLabel>Production reference</FieldLabel>
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
                  <FieldLabel>Min batch size</FieldLabel>
                  <input
                    type="number"
                    value={minBatch}
                    onChange={(e) => setMinBatch(e.target.value === '' ? '' : Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel>Max batch size</FieldLabel>
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
                  <FieldLabel>Batch multiple</FieldLabel>
                  <input
                    type="number"
                    value={batchMultiple}
                    onChange={(e) => setBatchMultiple(e.target.value === '' ? '' : Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </CollapsibleCard>

          {/* Advanced (collapsible) */}
          <CollapsibleCard
            label="Advanced"
            hint="Status, stock-take, shelf life, bakery/hot production, carry-over, PCR, used-for"
            open={showAdvanced}
            onToggle={() => setShowAdvanced((v) => !v)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <FieldLabel>Status</FieldLabel>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...selectStyle, maxWidth: '220px' }}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Product class</FieldLabel>
                <PillSingle options={PRODUCT_CLASSES} selected={productClass} onChange={setProductClass} allowClear />
              </div>

              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <CheckRow label="Sub-recipe" checked={subRecipe} onChange={setSubRecipe} />
                <CheckRow label="Count in stock-take" checked={countInStockTake} onChange={setCountInStockTake} />
                <CheckRow label="Exclude from COGS" checked={excludeFromCogs} onChange={setExcludeFromCogs} />
              </div>

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
                <FieldLabel>Closing range</FieldLabel>
                <input
                  type="text"
                  value={closingRange}
                  onChange={(e) => setClosingRange(e.target.value)}
                  placeholder="e.g. 1–5"
                  style={{ ...inputStyle, maxWidth: '220px' }}
                />
              </div>

              <div>
                <FieldLabel>Bakery / hot production</FieldLabel>
                <PillSingle options={BAKERY_HOT_PRODUCTION} selected={bakeryHot} onChange={setBakeryHot} />
              </div>

              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <CheckRow label="Allow carry-over" checked={allowCarryOver} onChange={setAllowCarryOver} />
                <CheckRow label="Enable preparation PCR" checked={enablePcr} onChange={setEnablePcr} />
              </div>

              <div>
                <FieldLabel>Used for <Soft>(assembly names — which meals/combos use this)</Soft></FieldLabel>
                <TagInput value={usedFor} onChange={setUsedFor} placeholder="Add assembly name and press Enter" />
              </div>
            </div>
          </CollapsibleCard>
        </div>

        {/* ── RIGHT COLUMN (pricing) ─────────────────────────────────────── */}
        <div style={{ position: 'sticky', top: 16 }}>
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
        </div>
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
          <div style={{ flex: 1, fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
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


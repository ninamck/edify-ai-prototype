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
  ArrowLeft, Plus, X, Check, Sparkles, ChevronRight, ChevronDown, Image as ImageIcon, AlertTriangle,
} from 'lucide-react';
import QuinnOrb from '@/components/Sidebar/QuinnOrb';

// ── Constants & types ────────────────────────────────────────────────────────

type Category = 'Coffee' | 'Tea' | 'Pastry' | 'Food' | 'Wine' | 'Spirits' | 'Kids';
const CATEGORIES: Category[] = ['Coffee', 'Tea', 'Pastry', 'Food', 'Wine', 'Spirits', 'Kids'];

const SITES = ['Fitzroy Espresso', 'Brixton Outpost', 'Shoreditch Roast', 'Soho Annex'];

const SUPPLIERS = ['Bidvest', 'Fresh Earth Produce', 'Rise Bakery', 'The Cheese Board', 'CPU — Central Kitchen', 'In-house'];

const UOMS = ['g', 'kg', 'ml', 'L', 'unit', 'slice', 'tsp', 'tbsp', 'cup'];

const ALLERGENS = [
  'Dairy', 'Eggs', 'Cereals containing gluten', 'Nuts', 'Peanuts',
  'Soya', 'Sesame Seeds', 'Mustard', 'Celery', 'Lupin',
  'Crustaceans', 'Fish', 'Molluscs', 'Sulphites',
];

const PRODUCT_CLASSES = ['Beverage', 'Food', 'Retail', 'Other'];
const STATUSES = ['Draft', 'Active', 'Archived'];
const YIELD_UOMS = ['serving', 'portion', 'kg', 'L', 'unit'];
const SHELF_LIFE_UNITS = ['minutes', 'hours', 'days'];
const BAKERY_HOT_PRODUCTION = ['None', 'Bakery', 'Hot production', 'Both'];
const PRODUCTION_VIS = ['Bar', 'Kitchen', 'Pastry', 'Variable'];

// Category-driven smart defaults
const CATEGORY_DEFAULTS: Record<Category, {
  hotCold: 'hot' | 'cold' | null;
  production: string[];
  shelfLifeMin: number | null;
  prepSec: number;
  desiredMargin: number;
}> = {
  Coffee:  { hotCold: 'hot',  production: ['Bar'],     shelfLifeMin: null,  prepSec: 90,  desiredMargin: 75 },
  Tea:     { hotCold: 'hot',  production: ['Bar'],     shelfLifeMin: null,  prepSec: 60,  desiredMargin: 85 },
  Pastry:  { hotCold: 'cold', production: ['Pastry'],  shelfLifeMin: 480,   prepSec: 30,  desiredMargin: 65 },
  Food:    { hotCold: 'hot',  production: ['Kitchen'], shelfLifeMin: 30,    prepSec: 240, desiredMargin: 70 },
  Wine:    { hotCold: 'cold', production: ['Bar'],     shelfLifeMin: null,  prepSec: 30,  desiredMargin: 60 },
  Spirits: { hotCold: 'cold', production: ['Bar'],     shelfLifeMin: null,  prepSec: 30,  desiredMargin: 78 },
  Kids:    { hotCold: 'hot',  production: ['Bar'],     shelfLifeMin: null,  prepSec: 45,  desiredMargin: 80 },
};

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

// ── Types for rows ────────────────────────────────────────────────────────────

type IngredientRow = {
  id: string;
  name: string;
  supplier: string;
  qty: number | '';
  uom: string;
  unitCostP: number; // pence per UoM unit (computed/fallback)
};

type VariableRow = IngredientRow & {
  type: string;
};

type PackagingRow = IngredientRow;

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyIngredient(): IngredientRow {
  return { id: newId(), name: '', supplier: '', qty: '', uom: 'g', unitCostP: 0 };
}

function emptyVariable(): VariableRow {
  return { id: newId(), name: '', supplier: '', qty: '', uom: 'g', unitCostP: 0, type: 'Alternative' };
}

function emptyPackaging(): PackagingRow {
  return { id: newId(), name: '', supplier: '', qty: '', uom: 'unit', unitCostP: 0 };
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

  // Ingredients
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
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
    // pre-fill ingredients (append, don't clobber manual entries)
    const newRows: IngredientRow[] = suggestion.ingredients.map((i) => ({
      id: newId(),
      name: i.name,
      supplier: i.supplier,
      qty: i.qty,
      uom: i.uom,
      unitCostP: i.unitCostP,
    }));
    setIngredients((prev) => [...prev.filter((p) => p.name.trim()), ...newRows]);
    // category-driven smart defaults
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

  // Computed totals
  const ingredientCost = useMemo(() => {
    return ingredients.reduce((sum, r) => {
      const q = typeof r.qty === 'number' ? r.qty : 0;
      return sum + (q * r.unitCostP) / 100;
    }, 0);
  }, [ingredients]);

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

  // Actions
  function addIngredient() {
    setIngredients((rows) => [...rows, emptyIngredient()]);
  }
  function updateIngredient(id: string, patch: Partial<IngredientRow>) {
    setIngredients((rows) => rows.map((r) => r.id === id ? { ...r, ...patch } : r));
  }
  function removeIngredient(id: string) {
    setIngredients((rows) => rows.filter((r) => r.id !== id));
  }

  function addTag() {
    const t = tagDraft.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagDraft('');
  }

  const canPublish = name.trim() && category && ingredients.some((r) => r.name.trim());

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
                    <Sparkles size={12} strokeWidth={2} />
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

          {/* Ingredients card */}
          <Card>
            <SectionHeader title="Ingredients" hint="Type a name to search your library. Quinn matches suppliers automatically." />
            <IngredientTable
              rows={ingredients}
              onChange={(id, patch) => updateIngredient(id, patch)}
              onRemove={removeIngredient}
              onAdd={addIngredient}
              onAddEnter={addIngredient}
              suggestionIngredients={suggestion?.ingredients.map((i) => i.name) ?? []}
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

// ── Sub-components ───────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
      }}
    >
      {children}
    </div>
  );
}

function CollapsibleCard({
  label, hint, open, onToggle, children,
}: {
  label: string; hint?: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: '12px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 16px', border: 'none', background: '#fff',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-primary)',
        }}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</span>
        {hint && <span style={{ flex: 1, fontSize: '12.5px', color: 'var(--color-text-muted)' }}>{hint}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden', borderTop: '1px solid var(--color-border-subtle)' }}
          >
            <div style={{ padding: '14px 16px' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
        {title}
      </div>
      {hint && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{hint}</div>}
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: 'var(--color-text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px',
    }}>
      {children}
      {required && <span style={{ color: 'var(--color-error)' }}>*</span>}
    </div>
  );
}

function Soft({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{children}</span>;
}

function PillMulti({
  options, selected, onChange,
}: {
  options: string[]; selected: string[]; onChange: (sel: string[]) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onChange(on ? selected.filter((s) => s !== opt) : [...selected, opt])}
            style={{
              padding: '6px 12px',
              borderRadius: '100px',
              border: on ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
              background: on ? 'var(--color-accent-active)' : '#fff',
              color: on ? '#fff' : 'var(--color-text-secondary)',
              fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-primary)',
              display: 'inline-flex', alignItems: 'center', gap: '5px',
            }}
          >
            {on && <Check size={11} strokeWidth={2.6} />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function PillSingle({
  options, selected, onChange, allowClear,
}: {
  options: readonly string[];
  selected: string;
  onChange: (v: string) => void;
  allowClear?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {options.map((opt) => {
        const on = selected === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(allowClear && on ? '' : opt)}
            style={{
              padding: '6px 12px',
              borderRadius: '100px',
              border: on ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
              background: on ? 'var(--color-accent-active)' : '#fff',
              color: on ? '#fff' : 'var(--color-text-secondary)',
              fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-primary)',
              display: 'inline-flex', alignItems: 'center', gap: '5px',
            }}
          >
            {on && <Check size={11} strokeWidth={2.6} />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function TagInput({
  value, onChange, placeholder,
}: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  function addDraft() {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  }
  return (
    <div
      style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center',
        padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--color-border)',
      }}
    >
      {value.map((t) => (
        <span
          key={t}
          style={{
            padding: '3px 8px 3px 10px',
            borderRadius: '100px',
            background: 'var(--color-bg-hover)',
            color: 'var(--color-text-primary)',
            fontSize: '12px', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}
        >
          {t}
          <button
            onClick={() => onChange(value.filter((v) => v !== t))}
            aria-label={`Remove ${t}`}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0, color: 'var(--color-text-muted)' }}
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDraft(); } }}
        onBlur={addDraft}
        placeholder={placeholder}
        style={{
          border: 'none', outline: 'none', background: 'transparent',
          flex: 1, minWidth: '120px', fontSize: '13px',
          fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)',
          padding: '4px 4px',
        }}
      />
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px',
        padding: '7px 12px', borderRadius: '8px',
        border: '1px solid ' + (checked ? 'transparent' : 'var(--color-border-subtle)'),
        background: checked ? 'var(--color-accent-active)' : '#fff',
        color: checked ? '#fff' : 'var(--color-text-secondary)',
        fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <span
        style={{
          width: '14px', height: '14px', borderRadius: '4px',
          border: '1.5px solid ' + (checked ? '#fff' : 'var(--color-border)'),
          background: checked ? 'transparent' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        {checked && <Check size={10} color="#fff" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

// Ingredient row tables

function IngredientTable({
  rows, onChange, onRemove, onAdd, onAddEnter, suggestionIngredients,
}: {
  rows: IngredientRow[];
  onChange: (id: string, patch: Partial<IngredientRow>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onAddEnter: () => void;
  suggestionIngredients: string[];
}) {
  return (
    <>
      <div style={tableHeaderStyle(['26px', '2fr', '1.5fr', '70px', '80px', '80px', '28px'])}>
        <span />
        <span>Name</span>
        <span>Supplier</span>
        <span>Qty</span>
        <span>UoM</span>
        <span style={{ textAlign: 'right' }}>Cost</span>
        <span />
      </div>
      {rows.length === 0 && (
        <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
          No ingredients yet.
        </div>
      )}
      {rows.map((row, i) => (
        <IngredientRowEdit
          key={row.id}
          row={row}
          onChange={(patch) => onChange(row.id, patch)}
          onRemove={() => onRemove(row.id)}
          onEnter={() => { if (i === rows.length - 1) onAddEnter(); }}
        />
      ))}
      <button
        onClick={onAdd}
        style={{
          marginTop: '10px',
          padding: '9px 12px',
          borderRadius: '8px',
          border: '1px dashed var(--color-border)',
          background: 'var(--color-bg-hover)',
          color: 'var(--color-text-primary)',
          fontSize: '12.5px', fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-primary)',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
        }}
      >
        <Plus size={13} strokeWidth={2.2} /> Add ingredient
      </button>
    </>
  );
}

function IngredientRowEdit({
  row, onChange, onRemove, onEnter,
}: {
  row: IngredientRow;
  onChange: (patch: Partial<IngredientRow>) => void;
  onRemove: () => void;
  onEnter: () => void;
}) {
  const cost = (typeof row.qty === 'number' ? row.qty : 0) * row.unitCostP / 100;
  return (
    <div style={tableRowStyle(['26px', '2fr', '1.5fr', '70px', '80px', '80px', '28px'])}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>•</span>
      <input
        value={row.name}
        onChange={(e) => onChange({ name: e.target.value })}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
        placeholder="Start typing..."
        style={cellInput}
      />
      <select value={row.supplier} onChange={(e) => onChange({ supplier: e.target.value })} style={cellSelect}>
        <option value="">—</option>
        {SUPPLIERS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <input
        type="number"
        min={0}
        step="any"
        value={row.qty}
        onChange={(e) => onChange({ qty: e.target.value === '' ? '' : Number(e.target.value) })}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
        style={cellInput}
      />
      <select value={row.uom} onChange={(e) => onChange({ uom: e.target.value })} style={cellSelect}>
        {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
      <span style={{ textAlign: 'right', fontSize: '12.5px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
        £{cost.toFixed(2)}
      </span>
      <button
        onClick={onRemove}
        aria-label="Remove"
        style={rowRemoveStyle}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function VariableTable({
  rows, onChange, onRemove, onAdd,
}: {
  rows: VariableRow[];
  onChange: (id: string, patch: Partial<VariableRow>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <>
      <div style={tableHeaderStyle(['26px', '2fr', '1fr', '1.5fr', '70px', '80px', '28px'])}>
        <span />
        <span>Name</span>
        <span>Type</span>
        <span>Supplier</span>
        <span>Qty</span>
        <span>UoM</span>
        <span />
      </div>
      {rows.length === 0 && (
        <div style={{ padding: '14px 8px', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
          Nothing yet. Add if this recipe has variations that sit inside it (e.g. milk alternatives for one coffee).
        </div>
      )}
      {rows.map((row) => (
        <div key={row.id} style={tableRowStyle(['26px', '2fr', '1fr', '1.5fr', '70px', '80px', '28px'])}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>•</span>
          <input
            value={row.name}
            onChange={(e) => onChange(row.id, { name: e.target.value })}
            placeholder="e.g. Oat milk"
            style={cellInput}
          />
          <select value={row.type} onChange={(e) => onChange(row.id, { type: e.target.value })} style={cellSelect}>
            <option>Alternative</option>
            <option>Add-on</option>
            <option>Upgrade</option>
          </select>
          <select value={row.supplier} onChange={(e) => onChange(row.id, { supplier: e.target.value })} style={cellSelect}>
            <option value="">—</option>
            {SUPPLIERS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            type="number"
            min={0}
            step="any"
            value={row.qty}
            onChange={(e) => onChange(row.id, { qty: e.target.value === '' ? '' : Number(e.target.value) })}
            style={cellInput}
          />
          <select value={row.uom} onChange={(e) => onChange(row.id, { uom: e.target.value })} style={cellSelect}>
            {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <button onClick={() => onRemove(row.id)} style={rowRemoveStyle} aria-label="Remove">
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={onAdd}
        style={{
          marginTop: '10px',
          padding: '9px 12px', borderRadius: '8px',
          border: '1px dashed var(--color-border)', background: 'var(--color-bg-hover)',
          color: 'var(--color-text-primary)', fontSize: '12.5px', fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-primary)',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
        }}
      >
        <Plus size={13} strokeWidth={2.2} /> Add variable ingredient
      </button>
      <div
        style={{
          marginTop: '10px',
          padding: '10px 12px',
          borderRadius: '8px',
          background: 'var(--color-bg-hover)',
          fontSize: '12px', color: 'var(--color-text-muted)',
          display: 'flex', alignItems: 'flex-start', gap: '8px',
        }}
      >
        <AlertTriangle size={13} strokeWidth={2} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>Variations that apply across many recipes (e.g. alt milks, cup sizes) are usually cleaner as a shared modifier group.</span>
      </div>
    </>
  );
}

function PackagingTable({
  rows, onChange, onRemove, onAdd,
}: {
  rows: PackagingRow[];
  onChange: (id: string, patch: Partial<PackagingRow>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <>
      <div style={tableHeaderStyle(['26px', '2fr', '1.5fr', '70px', '80px', '80px', '28px'])}>
        <span />
        <span>Name</span>
        <span>Supplier</span>
        <span>Qty</span>
        <span>UoM</span>
        <span style={{ textAlign: 'right' }}>Cost</span>
        <span />
      </div>
      {rows.length === 0 && (
        <div style={{ padding: '14px 8px', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
          Nothing yet. Add for takeaway / delivery-specific packaging.
        </div>
      )}
      {rows.map((row) => {
        const cost = (typeof row.qty === 'number' ? row.qty : 0) * row.unitCostP / 100;
        return (
          <div key={row.id} style={tableRowStyle(['26px', '2fr', '1.5fr', '70px', '80px', '80px', '28px'])}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>•</span>
            <input value={row.name} onChange={(e) => onChange(row.id, { name: e.target.value })} placeholder="e.g. 8oz cup" style={cellInput} />
            <select value={row.supplier} onChange={(e) => onChange(row.id, { supplier: e.target.value })} style={cellSelect}>
              <option value="">—</option>
              {SUPPLIERS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              type="number"
              min={0}
              step="any"
              value={row.qty}
              onChange={(e) => onChange(row.id, { qty: e.target.value === '' ? '' : Number(e.target.value) })}
              style={cellInput}
            />
            <select value={row.uom} onChange={(e) => onChange(row.id, { uom: e.target.value })} style={cellSelect}>
              {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <span style={{ textAlign: 'right', fontSize: '12.5px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              £{cost.toFixed(2)}
            </span>
            <button onClick={() => onRemove(row.id)} style={rowRemoveStyle} aria-label="Remove">
              <X size={14} />
            </button>
          </div>
        );
      })}
      <button
        onClick={onAdd}
        style={{
          marginTop: '10px',
          padding: '9px 12px', borderRadius: '8px',
          border: '1px dashed var(--color-border)', background: 'var(--color-bg-hover)',
          color: 'var(--color-text-primary)', fontSize: '12.5px', fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-primary)',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
        }}
      >
        <Plus size={13} strokeWidth={2.2} /> Add packaging
      </button>
    </>
  );
}

// Price card (right column)

function PriceCard({
  totalCost, ingredientCost, packagingCost,
  desiredMargin, onDesiredMargin, vatPct, onVat,
  hotCold, onHotCold,
  srpDineInEx, onSrpDineIn, marginDineIn, srpIncDineIn,
  srpTakeawayEx, onSrpTakeaway, marginTakeaway, srpIncTakeaway,
  srpDeliveryEx, onSrpDelivery, deliveryCommission, onDeliveryCommission, marginDelivery, srpIncDelivery,
}: {
  totalCost: number; ingredientCost: number; packagingCost: number;
  desiredMargin: number | ''; onDesiredMargin: (v: number | '') => void;
  vatPct: number | ''; onVat: (v: number | '') => void;
  hotCold: 'hot' | 'cold' | null; onHotCold: (v: 'hot' | 'cold' | null) => void;
  srpDineInEx: number | ''; onSrpDineIn: (v: number | '') => void;
  marginDineIn: number | null; srpIncDineIn: number | null;
  srpTakeawayEx: number | ''; onSrpTakeaway: (v: number | '') => void;
  marginTakeaway: number | null; srpIncTakeaway: number | null;
  srpDeliveryEx: number | ''; onSrpDelivery: (v: number | '') => void;
  deliveryCommission: number | ''; onDeliveryCommission: (v: number | '') => void;
  marginDelivery: number | null; srpIncDelivery: number | null;
}) {
  return (
    <div
      style={{
        borderRadius: '12px', border: '1px solid var(--color-border-subtle)',
        background: '#fff', padding: '16px',
      }}
    >
      <div
        style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '12px',
        }}
      >
        Price breakdown
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <div>
          <FieldLabel>Desired margin</FieldLabel>
          <div style={inputSuffixWrap}>
            <input
              type="number"
              value={desiredMargin}
              onChange={(e) => onDesiredMargin(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ ...inputStyle, paddingRight: '28px' }}
            />
            <span style={inputSuffix}>%</span>
          </div>
        </div>
        <div>
          <FieldLabel>VAT</FieldLabel>
          <div style={inputSuffixWrap}>
            <input
              type="number"
              value={vatPct}
              onChange={(e) => onVat(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ ...inputStyle, paddingRight: '28px' }}
            />
            <span style={inputSuffix}>%</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        <button
          onClick={() => onHotCold(hotCold === 'hot' ? null : 'hot')}
          style={smallToggleStyle(hotCold === 'hot')}
        >
          {hotCold === 'hot' && <Check size={11} strokeWidth={2.6} />} Hot
        </button>
        <button
          onClick={() => onHotCold(hotCold === 'cold' ? null : 'cold')}
          style={smallToggleStyle(hotCold === 'cold')}
        >
          {hotCold === 'cold' && <Check size={11} strokeWidth={2.6} />} Cold
        </button>
      </div>

      <PriceChannel
        label="Dine in"
        ingCost={ingredientCost}
        pkgCost={packagingCost}
        srpEx={srpDineInEx}
        onSrp={onSrpDineIn}
        srpInc={srpIncDineIn}
        margin={marginDineIn}
      />
      <PriceChannel
        label="Takeaway"
        ingCost={ingredientCost}
        pkgCost={packagingCost}
        srpEx={srpTakeawayEx}
        onSrp={onSrpTakeaway}
        srpInc={srpIncTakeaway}
        margin={marginTakeaway}
      />
      <PriceChannel
        label="Delivery"
        ingCost={ingredientCost}
        pkgCost={packagingCost}
        srpEx={srpDeliveryEx}
        onSrp={onSrpDelivery}
        srpInc={srpIncDelivery}
        margin={marginDelivery}
        commission={deliveryCommission}
        onCommission={onDeliveryCommission}
      />

      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border-subtle)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
        Totals auto-compute from ingredients + packaging. Enter an SRP, or leave blank to set from desired margin.
      </div>
    </div>
  );
}

function PriceChannel({
  label, ingCost, pkgCost, srpEx, onSrp, srpInc, margin, commission, onCommission,
}: {
  label: string; ingCost: number; pkgCost: number;
  srpEx: number | ''; onSrp: (v: number | '') => void;
  srpInc: number | null; margin: number | null;
  commission?: number | ''; onCommission?: (v: number | '') => void;
}) {
  return (
    <div
      style={{
        padding: '12px 10px',
        borderTop: '1px solid var(--color-border-subtle)',
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        <span>Ingredient cost</span>
        <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>£{ingCost.toFixed(2)}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        <span>Packaging cost</span>
        <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>£{pkgCost.toFixed(2)}</strong>
      </div>
      {onCommission && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', flex: 1 }}>Commission</span>
          <div style={{ ...inputSuffixWrap, width: '80px' }}>
            <input
              type="number"
              value={commission}
              onChange={(e) => onCommission(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ ...inputStyle, paddingRight: '24px', padding: '5px 24px 5px 8px', fontSize: '12px' }}
              placeholder="0"
            />
            <span style={{ ...inputSuffix, right: '8px', fontSize: '11px' }}>%</span>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', flex: 1 }}>SRP ex VAT</span>
        <div style={{ ...inputSuffixWrap, width: '96px' }}>
          <span style={{ ...inputSuffix, left: '8px', right: 'auto', fontSize: '11px' }}>£</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={srpEx}
            onChange={(e) => onSrp(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ ...inputStyle, padding: '5px 8px 5px 22px', fontSize: '12px' }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>SRP inc VAT</span>
        <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          {srpInc == null ? '—' : `£${srpInc.toFixed(2)}`}
        </strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>Margin</span>
        <strong
          style={{
            color: margin == null ? 'var(--color-text-muted)' :
                   margin >= 60 ? 'var(--color-success)' :
                   margin >= 40 ? 'var(--color-warning)' : 'var(--color-error)',
            fontWeight: 700,
          }}
        >
          {margin == null ? '—' : `${margin}%`}
        </strong>
      </div>
    </div>
  );
}

// ── Inline styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid var(--color-border)',
  fontSize: '13px',
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};

const nameInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontSize: '16px',
  fontWeight: 600,
  padding: '11px 12px',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: '70px',
  fontFamily: 'var(--font-primary)',
};

const cellInput: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: '6px',
  border: '1px solid var(--color-border-subtle)',
  fontSize: '12.5px',
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};

const cellSelect: React.CSSProperties = { ...cellInput };

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: '10px',
  border: 'none',
  background: 'var(--color-accent-active)',
  fontSize: '13px',
  fontWeight: 600,
  color: '#fff',
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

const primaryBtnStyleSm: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '8px',
  border: 'none',
  background: 'var(--color-accent-active)',
  fontSize: '12px',
  fontWeight: 600,
  color: '#fff',
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: '5px',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: '10px',
  border: '1px solid var(--color-border)',
  background: '#fff',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

const dismissBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  border: '1px solid var(--color-border-subtle)',
  background: 'transparent',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

const rowRemoveStyle: React.CSSProperties = {
  width: '26px', height: '26px',
  border: 'none', background: 'transparent',
  cursor: 'pointer', color: 'var(--color-text-muted)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '6px',
};

const inputSuffixWrap: React.CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  width: '100%',
};

const inputSuffix: React.CSSProperties = {
  position: 'absolute',
  right: '10px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '12px',
  color: 'var(--color-text-muted)',
  pointerEvents: 'none',
};

function smallToggleStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '7px 10px',
    borderRadius: '8px',
    border: active ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
    background: active ? 'var(--color-accent-active)' : '#fff',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-primary)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
  };
}

function tableHeaderStyle(cols: string[]): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: cols.join(' '),
    gap: '8px',
    padding: '8px 0',
    borderBottom: '1px solid var(--color-border-subtle)',
    fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: 'var(--color-text-muted)',
  };
}

function tableRowStyle(cols: string[]): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: cols.join(' '),
    gap: '8px',
    padding: '8px 0',
    alignItems: 'center',
    borderBottom: '1px solid var(--color-border-subtle)',
  };
}

'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import {
  Send,
  Sparkles,
  Maximize2,
  Minimize2,
  Plus,
  Mic,
  ChevronDown,
  ChefHat,
  BarChart3,
  ClipboardList,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  LayoutDashboard,
  Pin,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import QuinnOrb from '@/components/Sidebar/QuinnOrb';
import type { BriefingRole } from '@/components/briefing';
import { timeAwareGreeting } from '@/components/briefing';
import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import { renderAnalyticsChart, ANALYTICS_CONFIG } from '@/components/Analytics/AnalyticsCharts';

function QuinnAvatar({
  size = 30,
  mode = 'sparkle',
}: {
  size?: number;
  mode?: 'sparkle' | 'thinking' | 'ready';
}) {
  if (mode === 'thinking' || mode === 'ready') {
    return (
      <div style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <QuinnOrb state={mode} size={size} />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--color-quinn-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Sparkles size={size * 0.45} color="var(--color-accent-quinn)" strokeWidth={2} />
    </div>
  );
}

function Hi({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
      {children}
    </span>
  );
}

const PLACEHOLDER = 'How can I help you today?';

// ─── Analytics autocomplete suggestions ──────────────────────────────────────

const ANALYTICS_SUGGESTIONS: { trigger: string; full: string }[] = [
  { trigger: 'What were',       full: 'What were total sales across all sites last week?' },
  { trigger: 'Which hour',      full: 'Which hour of the day drives the most revenue on weekdays?' },
  { trigger: 'How has',         full: 'How has revenue trended over the last 12 weeks?' },
  { trigger: 'Which site has',  full: 'Which site has shown the strongest month-on-month growth?' },
  { trigger: 'What is',         full: 'What is the revenue per labour hour across each site?' },
  { trigger: 'Which sites are', full: 'Which sites are consistently over their COGS budget?' },
];

function getGhostSuggestion(value: string): string {
  if (!value.trim()) return '';
  for (const s of ANALYTICS_SUGGESTIONS) {
    if (s.full.startsWith(value) && value.length < s.full.length) {
      return s.full.slice(value.length);
    }
  }
  return '';
}

const PROMPT_CHIPS: {
  label: string;
  icon: typeof ChefHat;
  text: string;
  action?: 'recipe' | 'integrity';
}[] = [
  {
    label: 'New recipe',
    icon: ChefHat,
    text: 'I want to add a new recipe for our weekend brunch menu.',
    action: 'recipe',
  },
  {
    label: 'Food cost',
    icon: BarChart3,
    text: 'Help me understand our food cost % vs target for this week.',
  },
  {
    label: 'Floor priority',
    icon: ClipboardList,
    text: 'What should the floor team prioritise this morning?',
  },
  {
    label: 'Check data integrity',
    icon: ShieldCheck,
    text: '',
    action: 'integrity',
  },
];

// ─── Data integrity checks ────────────────────────────────────────────────────

type IntegrityStatus = 'issue' | 'warning' | 'ok';

type IntegrityCheck = {
  id: string;
  label: string;
  detail: string;
  status: IntegrityStatus;
  action?: string;
};

const INTEGRITY_CHECKS: IntegrityCheck[] = [
  { id: 'unavailable-ing', label: 'Unavailable ingredients', detail: '4 items flagged as unavailable in active recipes', status: 'issue', action: 'Review' },
  { id: 'inactive-items', label: 'Inactive or discontinued items in recipes', detail: '2 discontinued items still referenced', status: 'issue', action: 'Review' },
  { id: 'inactive-suppliers', label: 'Inactive suppliers still listed', detail: '1 inactive supplier linked to active items', status: 'issue', action: 'Review' },
  { id: 'yield-outdated', label: 'Yield assumptions outdated', detail: 'Last reviewed 6+ months ago on 7 recipes', status: 'warning', action: 'Update' },
  { id: 'price-margin', label: 'Margin shifted after yield update', detail: 'Menu price unchanged on 3 items — margins may be off', status: 'warning', action: 'Review' },
  { id: 'sub-recipes', label: 'Sub-recipes not linked correctly', detail: '2 sub-recipes missing parent links', status: 'warning', action: 'Fix' },
  { id: 'unit-measure', label: 'Wrong unit of measure on supplier items', detail: '1 item has mismatched units', status: 'warning', action: 'Fix' },
  { id: 'archived-ing', label: 'Inactive ingredients archived', detail: 'All archived correctly', status: 'ok' },
  { id: 'pos-linked', label: 'Every POS item has a linked recipe', detail: 'All 42 POS items linked', status: 'ok' },
  { id: 'modifiers-mapped', label: 'Modifiers and variants mapped', detail: 'All mapped correctly', status: 'ok' },
  { id: 'no-archived-ref', label: 'No recipes referencing archived ingredients', detail: 'No issues found', status: 'ok' },
];

type ChatMsg = { id: string; role: 'user' | 'quinn'; text: string; msgType?: string; chartId?: string };

type RecipeIngredient = { name: string; qty: string; unit: string };

const INITIAL_RECIPE_INGREDIENTS: RecipeIngredient[] = [
  { name: 'Chicken breast (cooked, shredded)', qty: '150', unit: 'g' },
  { name: 'Mayonnaise', qty: '30', unit: 'g' },
  { name: 'Dijon mustard', qty: '5', unit: 'g' },
  { name: 'Baby gem lettuce', qty: '20', unit: 'g' },
  { name: 'Vine tomato (sliced)', qty: '40', unit: 'g' },
  { name: 'Brioche bun', qty: '1', unit: 'pc' },
  { name: 'Salt & pepper', qty: '\u2014', unit: '' },
];

const RECIPE_GREETING = "Hey, happy to add a recipe. What is it of?";
const RECIPE_CARD_INTRO = "Great choice! Here's a suggested recipe for a **Chicken & Mayo Sandwich**. Adjust the quantities to match your serving size:";
const RECIPE_LINK_MSG =
  "I've linked most of these ingredients to your existing Edify catalogue \u2014 chicken, mayo, mustard, lettuce, and tomato are all matched to current suppliers.\n\n" +
  "However, I noticed you don't have a supplier set up for **brioche buns** yet.\n\n" +
  "I'd recommend **Artisan Bakehouse** \u2014 I picked them because they're trusted amongst our users for consistently good quality and reliable deliveries. Want me to add them as a supplier for you?";
const RECIPE_COST_MSG =
  "Here's the cost and margin breakdown based on your current supplier prices:";

type IngredientCost = { name: string; qty: string; unit: string; cost: number };

const INGREDIENT_COSTS: IngredientCost[] = [
  { name: 'Chicken breast (cooked, shredded)', qty: '150', unit: 'g', cost: 2.85 },
  { name: 'Mayonnaise', qty: '30', unit: 'g', cost: 0.22 },
  { name: 'Dijon mustard', qty: '5', unit: 'g', cost: 0.15 },
  { name: 'Baby gem lettuce', qty: '20', unit: 'g', cost: 0.18 },
  { name: 'Vine tomato (sliced)', qty: '40', unit: 'g', cost: 0.28 },
  { name: 'Brioche bun', qty: '1', unit: 'pc', cost: 1.10 },
  { name: 'Salt & pepper', qty: '\u2014', unit: '', cost: 0.02 },
];

const TOTAL_FOOD_COST = INGREDIENT_COSTS.reduce((s, i) => s + i.cost, 0);
const DESIRED_MARGIN_PCT = 65;
const VAT_RATE = 0.20;
const SRP_EX_VAT = parseFloat((TOTAL_FOOD_COST / (1 - DESIRED_MARGIN_PCT / 100)).toFixed(2));
const DINE_IN_INC_VAT = parseFloat((SRP_EX_VAT * (1 + VAT_RATE)).toFixed(2));
const TAKEAWAY_PRICE = SRP_EX_VAT; // cold food = 0% VAT in UK
const FOOD_COST_PCT = Math.round((TOTAL_FOOD_COST / SRP_EX_VAT) * 100);
const GROSS_PROFIT_EX_VAT = parseFloat((SRP_EX_VAT - TOTAL_FOOD_COST).toFixed(2));
const TARGET_FOOD_COST_PCT = 35;

const RECIPE_PACKAGING_MSG =
  "Would you like to include any packaging in the recipe cost? Here are common options for a sandwich:";

type PackagingOption = { id: string; name: string; cost: number; unit: string };

const PACKAGING_OPTIONS: PackagingOption[] = [
  { id: 'wrap', name: 'Greaseproof wrap', cost: 0.08, unit: 'sheet' },
  { id: 'bag', name: 'Brown paper bag', cost: 0.06, unit: 'ea' },
  { id: 'box', name: 'Kraft takeaway box', cost: 0.32, unit: 'ea' },
  { id: 'sticker', name: 'Branded label/sticker', cost: 0.05, unit: 'ea' },
  { id: 'napkin', name: 'Napkin', cost: 0.03, unit: 'ea' },
];

const RECIPE_ALLERGEN_MSG =
  "I've detected the following allergens based on the ingredients. Please review and confirm — you can add or remove any that apply:";

const ALL_ALLERGENS = [
  'Mustard', 'Peanuts', 'Crustaceans', 'Fish', 'Nuts', 'Cereals containing gluten',
  'Molluscs', 'Sesame Seeds', 'Celery', 'Lupin', 'Soya', 'Sulphites', 'Eggs', 'Dairy',
];

const AUTO_DETECTED_ALLERGENS = new Set(['Mustard', 'Eggs', 'Cereals containing gluten']);

const RECIPE_SITES_MSG =
  "Almost there! I've put this under the **Food** product class — this looks like a cold eat-in & takeaway item.\n\nWhich sites should this recipe be available at?";

type Site = { id: string; name: string };

const MOCK_SITES: Site[] = [
  { id: 'fitzroy', name: 'Fitzroy Espresso' },
  { id: 'city', name: 'City Centre' },
  { id: 'south-yarra', name: 'South Yarra' },
  { id: 'richmond', name: 'Richmond' },
  { id: 'airport', name: 'Airport Lounge' },
];

function buildDoneMsg(siteNames: string[]): string {
  const sitesStr = siteNames.length === 1
    ? `**${siteNames[0]}**`
    : siteNames.slice(0, -1).map(s => `**${s}**`).join(', ') + ` and **${siteNames[siteNames.length - 1]}**`;
  return (
    `**Done!** Artisan Bakehouse is now set up as a supplier and linked to brioche buns in your recipe.\n\n` +
    `Your **Chicken & Mayo Sandwich** recipe is live in Edify under the **Food** class, assigned to ${sitesStr}. You'll find it under Recipes \u2192 Food. The recipe is ready to add to any production plan.`
  );
}

// ─── Production flow constants ───────────────────────────────────────────────

const PROD_PREP_MSG =
  "Let's get your **Chicken & Mayo Sandwich** onto a production schedule — I'll ask a few quick questions, with sensible defaults already filled in. First up: what's the prep time per unit?";
const PROD_SHELF_MSG =
  "Got it. How long does it stay fresh once made? This sets the shelf life for waste tracking and production cutoffs.";
const PROD_BATCH_MSG =
  "How many do you typically make in a batch? You can also decide whether any unsold stock should carry over to the next period.";
const PROD_CATEGORY_MSG =
  "Almost done — which category does this fall under, and how far before closing should production stop?";

const PREP_TIME_OPTIONS = ['2 min', '5 min', '10 min', '15 min', '20 min'];
const SHELF_LIFE_OPTIONS = ['30 min', '1 hour', '2 hours', '4 hours', 'End of day'];
const CATEGORY_OPTIONS = ['Sandwiches & Wraps', 'Cold Food', 'Salads', 'Snacks', 'Hot Food'];
const CLOSING_RANGE_OPTIONS = ['30 min', '45 min', '60 min', '90 min', 'No limit'];

type ProdSettings = {
  prepTime: string;
  shelfLife: string;
  batchMin: number;
  batchMax: number | 'unlimited';
  batchMultiple: number;
  allowCarryOver: boolean;
  category: string;
  closingRange: string;
};

const DEFAULT_PROD_SETTINGS: ProdSettings = {
  prepTime: '5 min',
  shelfLife: '2 hours',
  batchMin: 1,
  batchMax: 10,
  batchMultiple: 1,
  allowCarryOver: false,
  category: 'Sandwiches & Wraps',
  closingRange: '60 min',
};

// ─────────────────────────────────────────────────────────────────────────────

function RecipeCardEditor({
  ingredients,
  onChange,
}: {
  ingredients: RecipeIngredient[];
  onChange: (idx: number, qty: string) => void;
}) {
  return (
    <div style={{
      marginTop: '8px',
      borderRadius: '10px',
      border: '1px solid var(--color-border-subtle)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px',
        background: 'var(--color-bg-hover)',
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <ChefHat size={14} color="var(--color-accent-active)" strokeWidth={2} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Chicken & Mayo Sandwich
        </span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
          Serves 1
        </span>
      </div>
      {ingredients.map((ing, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 14px',
            borderBottom: i < ingredients.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            fontSize: '13px',
            gap: '8px',
          }}
        >
          <span style={{ flex: 1, color: 'var(--color-text-secondary)' }}>{ing.name}</span>
          {ing.qty === '\u2014' ? (
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', width: '64px', textAlign: 'right' }}>to taste</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                value={ing.qty}
                onChange={(e) => onChange(i, e.target.value)}
                style={{
                  width: '48px',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  textAlign: 'right',
                  color: 'var(--color-text-primary)',
                  background: '#fff',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', minWidth: '16px' }}>{ing.unit}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CostBreakdownCard() {
  const withinTarget = FOOD_COST_PCT <= TARGET_FOOD_COST_PCT;

  const pricingRows = [
    { label: 'Ingredient Cost', dineIn: `£${TOTAL_FOOD_COST.toFixed(2)}`, takeaway: `£${TOTAL_FOOD_COST.toFixed(2)}` },
    { label: 'Packaging Cost', dineIn: '£0.00', takeaway: '£0.00' },
    { label: 'Desired Margin', dineIn: `${DESIRED_MARGIN_PCT}%`, takeaway: `${DESIRED_MARGIN_PCT}%` },
    { label: 'SRP ex VAT', dineIn: `£${SRP_EX_VAT.toFixed(2)}`, takeaway: `£${TAKEAWAY_PRICE.toFixed(2)}` },
    { label: 'VAT', dineIn: `${Math.round(VAT_RATE * 100)}%`, takeaway: '0%*' },
    { label: 'SRP inc VAT', dineIn: `£${DINE_IN_INC_VAT.toFixed(2)}`, takeaway: `£${TAKEAWAY_PRICE.toFixed(2)}`, bold: true },
  ];

  return (
    <div style={{ marginTop: '8px', borderRadius: '10px', border: '1px solid var(--color-border-subtle)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', background: 'var(--color-bg-hover)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BarChart3 size={14} color="var(--color-accent-active)" strokeWidth={2} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Cost & Margin Breakdown</span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: '2px' }}>· Cold · Serves 1</span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: withinTarget ? 'rgba(21,128,61,0.1)' : 'rgba(185,28,28,0.1)', color: withinTarget ? '#15803D' : '#B91C1C' }}>
          {withinTarget ? 'Within target' : 'Above target'}
        </span>
      </div>

      {/* Ingredient rows */}
      {INGREDIENT_COSTS.map((ing, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', borderBottom: '1px solid var(--color-border-subtle)', fontSize: '12px', fontWeight: 500, gap: '8px' }}>
          <span style={{ flex: 1, color: 'var(--color-text-secondary)' }}>{ing.name}</span>
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', minWidth: '44px', textAlign: 'right' }}>
            {ing.qty === '\u2014' ? 'to taste' : `${ing.qty}${ing.unit}`}
          </span>
          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', minWidth: '44px', textAlign: 'right' }}>£{ing.cost.toFixed(2)}</span>
        </div>
      ))}

      {/* Total food cost */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid var(--color-border-subtle)', background: 'rgba(58,48,40,0.02)' }}>
        <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Food Cost</span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>£{TOTAL_FOOD_COST.toFixed(2)}</span>
      </div>

      {/* Dine In / Takeaway pricing table */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 82px 82px', gap: '2px', marginBottom: '6px' }}>
          <div />
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Dine In</div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Takeaway</div>
        </div>
        {pricingRows.map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 82px 82px', gap: '2px', padding: '4px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(58,48,40,0.05)' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{row.label}</span>
            <span style={{ fontSize: '12px', fontWeight: row.bold ? 700 : 500, color: row.bold ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', textAlign: 'center' }}>{row.dineIn}</span>
            <span style={{ fontSize: '12px', fontWeight: row.bold ? 700 : 500, color: row.bold ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', textAlign: 'center' }}>{row.takeaway}</span>
          </div>
        ))}
        <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', margin: '6px 0 0' }}>* Cold takeaway sandwiches are zero-rated for VAT in the UK</p>
      </div>

      {/* Food cost % + weekly projection */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: '8px', background: withinTarget ? 'rgba(21,128,61,0.06)' : 'rgba(185,28,28,0.06)' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Food cost % (ex VAT)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: withinTarget ? '#15803D' : '#B91C1C' }}>{FOOD_COST_PCT}%</span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>target {TARGET_FOOD_COST_PCT}%</span>
          </div>
        </div>
        <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(3,105,161,0.05)', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700, color: 'var(--color-info)' }}>Projected weekly:</span> At ~25 serves/day, that&apos;s <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>£{(GROSS_PROFIT_EX_VAT * 25 * 7).toFixed(0)}</span> gross profit/week from this item alone.
        </div>
      </div>
    </div>
  );
}

function PackagingPicker({ selected, onToggle, onConfirm, onSkip }: {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  const totalPackaging = PACKAGING_OPTIONS
    .filter(p => selected.has(p.id))
    .reduce((s, p) => s + p.cost, 0);

  return (
    <div style={{
      marginTop: '8px',
      borderRadius: '10px',
      border: '1px solid var(--color-border-subtle)',
      overflow: 'hidden',
    }}>
      {PACKAGING_OPTIONS.map((pkg, i) => {
        const isSelected = selected.has(pkg.id);
        return (
          <button
            key={pkg.id}
            type="button"
            onClick={() => onToggle(pkg.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '10px 14px',
              gap: '10px',
              borderBottom: i < PACKAGING_OPTIONS.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              background: isSelected ? 'rgba(34,68,68,0.04)' : '#fff',
              border: 'none',
              borderLeft: isSelected ? '3px solid var(--color-accent-active)' : '3px solid transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              textAlign: 'left',
              transition: 'all 0.12s',
            }}
          >
            <span style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              border: isSelected ? '2px solid var(--color-accent-active)' : '2px solid var(--color-border)',
              background: isSelected ? 'var(--color-accent-active)' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.12s',
            }}>
              {isSelected && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
            <span style={{ flex: 1, fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: isSelected ? 600 : 400 }}>
              {pkg.name}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
              per {pkg.unit}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: isSelected ? 'var(--color-accent-active)' : 'var(--color-text-secondary)', minWidth: '42px', textAlign: 'right' }}>
              £{pkg.cost.toFixed(2)}
            </span>
          </button>
        );
      })}

      {selected.size > 0 && (
        <div style={{
          padding: '8px 14px',
          background: 'rgba(34,68,68,0.04)',
          borderTop: '1px solid var(--color-border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px', fontWeight: 500,
        }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>Packaging adds</span>
          <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>+£{totalPackaging.toFixed(2)}/serve</span>
        </div>
      )}

      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid var(--color-border-subtle)',
        display: 'flex',
        gap: '8px',
        justifyContent: 'flex-end',
      }}>
        <button
          type="button"
          onClick={onSkip}
          style={{
            padding: '7px 16px',
            borderRadius: '100px',
            border: '1px solid var(--color-border)',
            background: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          No packaging needed
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '7px 16px',
              borderRadius: '100px',
              border: 'none',
              background: 'var(--color-accent-active)',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(34,68,68,0.25)',
            }}
          >
            Add selected ({selected.size})
          </button>
        )}
      </div>
    </div>
  );
}

function SiteSelectionCard({ selected, onToggle, onConfirm }: { selected: Set<string>; onToggle: (id: string) => void; onConfirm: () => void }) {
  return (
    <div style={{ marginTop: '8px', borderRadius: '10px', border: '1px solid var(--color-border-subtle)', overflow: 'hidden' }}>
      <div style={{ padding: '9px 14px', background: 'var(--color-bg-hover)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Select Sites</span>
        <button
          type="button"
          onClick={() => {
            const allSelected = MOCK_SITES.every(s => selected.has(s.id));
            if (allSelected) {
              MOCK_SITES.forEach(s => { if (s.id !== 'fitzroy') onToggle(s.id); });
            } else {
              MOCK_SITES.forEach(s => { if (!selected.has(s.id)) onToggle(s.id); });
            }
          }}
          style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-accent-active)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-primary)', padding: 0 }}
        >
          {MOCK_SITES.every(s => selected.has(s.id)) ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {MOCK_SITES.map(site => {
          const isSelected = selected.has(site.id);
          return (
            <button
              key={site.id}
              type="button"
              onClick={() => onToggle(site.id)}
              style={{
                padding: '7px 16px',
                borderRadius: '100px',
                border: isSelected ? '2px solid var(--color-accent-active)' : '1.5px solid var(--color-border)',
                background: isSelected ? 'var(--color-accent-active)' : '#fff',
                color: isSelected ? '#fff' : 'var(--color-text-secondary)',
                fontSize: '13px',
                fontWeight: isSelected ? 700 : 400,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {site.name}
            </button>
          );
        })}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>{selected.size} site{selected.size !== 1 ? 's' : ''} selected</span>
        <button
          type="button"
          onClick={onConfirm}
          disabled={selected.size === 0}
          style={{ padding: '7px 18px', borderRadius: '100px', border: 'none', background: selected.size > 0 ? 'var(--color-accent-active)' : 'var(--color-bg-hover)', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: selected.size > 0 ? '#fff' : 'var(--color-text-muted)', cursor: selected.size > 0 ? 'pointer' : 'not-allowed', boxShadow: selected.size > 0 ? '0 2px 8px rgba(34,68,68,0.25)' : 'none' }}
        >
          Confirm sites
        </button>
      </div>
    </div>
  );
}

function AllergenCard({ confirmed, onToggle, onConfirm }: { confirmed: Set<string>; onToggle: (a: string) => void; onConfirm: () => void }) {
  return (
    <div style={{ marginTop: '8px', borderRadius: '10px', border: '1px solid var(--color-border-subtle)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', background: 'var(--color-warning-light)', borderBottom: '1px solid var(--color-warning-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-warning)' }}>Allergens</span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-warning)', marginLeft: 'auto' }}>
          {confirmed.size} selected · {AUTO_DETECTED_ALLERGENS.size} auto-detected from ingredients
        </span>
      </div>
      <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
        {ALL_ALLERGENS.map(allergen => {
          const isDetected = AUTO_DETECTED_ALLERGENS.has(allergen);
          const isSelected = confirmed.has(allergen);
          return (
            <button
              key={allergen}
              type="button"
              onClick={() => onToggle(allergen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                borderRadius: '6px',
                border: 'none',
                background: isSelected ? (isDetected ? 'rgba(234,88,12,0.07)' : 'rgba(34,68,68,0.05)') : 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                textAlign: 'left',
              }}
            >
              <span style={{
                width: '15px', height: '15px', borderRadius: '3px', flexShrink: 0,
                border: isSelected ? '2px solid var(--color-accent-active)' : '2px solid var(--color-border)',
                background: isSelected ? 'var(--color-accent-active)' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isSelected && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3 5.5L8 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-primary)', fontWeight: isDetected && isSelected ? 600 : 400 }}>
                {allergen}
                {isDetected && (
                  <span style={{ fontSize: '12px', color: 'var(--color-warning)', marginLeft: '4px', fontWeight: 700 }}>auto</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>Based on UK Food Information Regulations 2014</span>
        <button
          type="button"
          onClick={onConfirm}
          style={{ padding: '7px 18px', borderRadius: '100px', border: 'none', background: 'var(--color-accent-active)', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(34,68,68,0.25)' }}
        >
          Confirm allergens ({confirmed.size})
        </button>
      </div>
    </div>
  );
}

// ─── Production flow components ──────────────────────────────────────────────

function PillPicker({ options, selected, onSelect, onConfirm }: { options: string[]; selected: string; onSelect: (o: string) => void; onConfirm: () => void }) {
  const [customVal, setCustomVal] = useState('');
  const isCustomSelected = selected !== '' && !options.includes(selected);
  return (
    <div style={{ marginTop: '8px', borderRadius: '10px', border: '1px solid var(--color-border-subtle)', overflow: 'hidden', background: '#fff' }}>
      <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        {options.map(opt => {
          const on = selected === opt && !isCustomSelected;
          return (
            <button key={opt} type="button" onClick={() => { setCustomVal(''); onSelect(opt); }} style={{ padding: '7px 16px', borderRadius: '100px', border: on ? '2px solid var(--color-accent-active)' : '1.5px solid var(--color-border)', background: on ? 'var(--color-accent-active)' : '#fff', color: on ? '#fff' : 'var(--color-text-secondary)', fontSize: '13px', fontWeight: on ? 700 : 400, fontFamily: 'var(--font-primary)', cursor: 'pointer', transition: 'all 0.12s' }}>
              {opt}
            </button>
          );
        })}
        <input
          type="text"
          value={customVal}
          onChange={(e) => { setCustomVal(e.target.value); if (e.target.value.trim()) onSelect(e.target.value.trim()); }}
          placeholder="Other…"
          style={{ width: '82px', padding: '6px 12px', borderRadius: '100px', border: isCustomSelected ? '2px solid var(--color-accent-active)' : '1.5px solid var(--color-border)', background: isCustomSelected ? 'rgba(34,68,68,0.04)' : '#fff', fontSize: '13px', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', outline: 'none' }}
        />
      </div>
      <div style={{ padding: '0 14px 12px', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onConfirm} style={{ padding: '7px 18px', borderRadius: '100px', border: 'none', background: 'var(--color-accent-active)', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(34,68,68,0.25)' }}>
          Confirm
        </button>
      </div>
    </div>
  );
}

function BatchAndCarryCard({ settings, onUpdate, onConfirm }: { settings: ProdSettings; onUpdate: (u: Partial<ProdSettings>) => void; onConfirm: () => void }) {
  const btnStyle: React.CSSProperties = { width: '28px', height: '28px', borderRadius: '8px', border: '1px solid var(--color-border)', background: '#fff', fontFamily: 'var(--font-primary)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-primary)', flexShrink: 0 };
  return (
    <div style={{ marginTop: '8px', borderRadius: '10px', border: '1px solid var(--color-border-subtle)', overflow: 'hidden', background: '#fff' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', borderBottom: '1px solid var(--color-border-subtle)' }}>
        {[{ label: 'Min batch', key: 'batchMin' as const }, { label: 'Max batch', key: 'batchMax' as const }].map(({ label, key }, i) => (
          <div key={key} style={{ padding: '12px 14px', borderRight: i === 0 ? '1px solid var(--color-border-subtle)' : 'none' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {settings[key] === 'unlimited' ? (
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', flex: 1 }}>Unlimited</span>
              ) : (
                <>
                  <button style={btnStyle} onClick={() => onUpdate({ [key]: Math.max(key === 'batchMax' ? settings.batchMin : 1, (settings[key] as number) - 1) })}>−</button>
                  <span style={{ fontWeight: 700, fontSize: '18px', minWidth: '28px', textAlign: 'center' }}>{settings[key]}</span>
                  <button style={btnStyle} onClick={() => onUpdate({ [key]: (settings[key] as number) + 1 })}>+</button>
                </>
              )}
              {key === 'batchMax' && (
                <button onClick={() => onUpdate({ batchMax: settings.batchMax === 'unlimited' ? 10 : 'unlimited' })} style={{ fontSize: '12px', color: 'var(--color-accent-active)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-primary)', fontWeight: 600, marginLeft: '2px' }}>
                  {settings.batchMax === 'unlimited' ? 'Set limit' : 'No limit'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Batch multiplier</div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>Production must be made in multiples of this number</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button style={btnStyle} onClick={() => onUpdate({ batchMultiple: Math.max(1, settings.batchMultiple - 1) })}>−</button>
          <span style={{ fontWeight: 700, fontSize: '16px', minWidth: '24px', textAlign: 'center' }}>{settings.batchMultiple}</span>
          <button style={btnStyle} onClick={() => onUpdate({ batchMultiple: settings.batchMultiple + 1 })}>+</button>
        </div>
      </div>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Allow carry over</div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>Unsold stock rolls to the next production period</div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['Write off', 'Allow carry over'] as const).map(opt => {
            const on = opt === 'Allow carry over' ? settings.allowCarryOver : !settings.allowCarryOver;
            return (
              <button key={opt} type="button" onClick={() => onUpdate({ allowCarryOver: opt === 'Allow carry over' })} style={{ padding: '6px 12px', borderRadius: '100px', border: on ? '2px solid var(--color-accent-active)' : '1.5px solid var(--color-border)', background: on ? 'var(--color-accent-active)' : '#fff', color: on ? '#fff' : 'var(--color-text-secondary)', fontSize: '12px', fontWeight: on ? 700 : 400, fontFamily: 'var(--font-primary)', cursor: 'pointer', transition: 'all 0.12s' }}>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onConfirm} style={{ padding: '7px 18px', borderRadius: '100px', border: 'none', background: 'var(--color-accent-active)', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(34,68,68,0.25)' }}>
          Confirm
        </button>
      </div>
    </div>
  );
}

function CategoryClosingCard({ settings, onUpdate, onConfirm }: { settings: ProdSettings; onUpdate: (u: Partial<ProdSettings>) => void; onConfirm: () => void }) {
  return (
    <div style={{ marginTop: '8px', borderRadius: '10px', border: '1px solid var(--color-border-subtle)', overflow: 'hidden', background: '#fff' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Recipe category</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {CATEGORY_OPTIONS.map(opt => {
            const on = settings.category === opt;
            return <button key={opt} type="button" onClick={() => onUpdate({ category: opt })} style={{ padding: '6px 14px', borderRadius: '100px', border: on ? '2px solid var(--color-accent-active)' : '1.5px solid var(--color-border)', background: on ? 'var(--color-accent-active)' : '#fff', color: on ? '#fff' : 'var(--color-text-secondary)', fontSize: '12px', fontWeight: on ? 700 : 400, fontFamily: 'var(--font-primary)', cursor: 'pointer', transition: 'all 0.12s' }}>{opt}</button>;
          })}
        </div>
      </div>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Stop production before closing</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {CLOSING_RANGE_OPTIONS.map(opt => {
            const on = settings.closingRange === opt;
            return <button key={opt} type="button" onClick={() => onUpdate({ closingRange: opt })} style={{ padding: '6px 14px', borderRadius: '100px', border: on ? '2px solid var(--color-accent-active)' : '1.5px solid var(--color-border)', background: on ? 'var(--color-accent-active)' : '#fff', color: on ? '#fff' : 'var(--color-text-secondary)', fontSize: '12px', fontWeight: on ? 700 : 400, fontFamily: 'var(--font-primary)', cursor: 'pointer', transition: 'all 0.12s' }}>{opt}</button>;
          })}
        </div>
      </div>
      <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onConfirm} style={{ padding: '7px 18px', borderRadius: '100px', border: 'none', background: 'var(--color-accent-active)', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(34,68,68,0.25)' }}>
          Confirm
        </button>
      </div>
    </div>
  );
}

function ProductionSummaryCard({ settings }: { settings: ProdSettings }) {
  const rows = [
    { label: 'Recipe', value: 'Chicken & Mayo Sandwich', bold: true },
    { label: 'Product class', value: 'Food' },
    { label: 'Category', value: settings.category },
    { label: 'Prep time', value: settings.prepTime },
    { label: 'Shelf life', value: settings.shelfLife },
    { label: 'Min batch', value: String(settings.batchMin) },
    { label: 'Max batch', value: settings.batchMax === 'unlimited' ? 'Unlimited' : String(settings.batchMax) },
    { label: 'Batch multiplier', value: String(settings.batchMultiple) },
    { label: 'Carry over', value: settings.allowCarryOver ? 'Allowed' : 'Write off' },
    { label: 'Stop production', value: settings.closingRange === 'No limit' ? 'No limit' : `${settings.closingRange} before close` },
  ];
  return (
    <div style={{ marginTop: '8px', borderRadius: '10px', border: '1px solid var(--color-success-border)', overflow: 'hidden', background: 'var(--color-success-light)' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-success-border)', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(21,128,61,0.06)' }}>
        <span style={{ fontSize: '14px' }}>✓</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-success)' }}>Production plan configured</span>
      </div>
      <div style={{ padding: '10px 14px', background: '#fff' }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{row.label}</span>
            <span style={{ fontSize: '12px', fontWeight: row.bold ? 700 : 600, color: 'var(--color-text-primary)' }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          padding: '9px 18px',
          borderRadius: '100px',
          border: 'none',
          background: 'var(--color-accent-active)',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(34,68,68,0.25)',
          transition: 'opacity 0.12s ease',
        }}
      >
        {label}
      </button>
    </div>
  );
}

function QuinnMessageBody({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((seg, i) => {
        const bold = seg.match(/^\*\*(.+)\*\*$/);
        if (bold) return <Hi key={i}>{bold[1]}</Hi>;
        return <span key={i}>{seg}</span>;
      })}
    </>
  );
}

function ChatBubble({ msg, children }: { msg: ChatMsg; children?: ReactNode }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '12px',
    }}>
      <div style={{
        maxWidth: '88%',
        padding: '11px 14px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: isUser ? '#F5F4F2' : '#fff',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: isUser ? 'none' : '0 2px 8px rgba(58,48,40,0.08), 0 0 0 1px rgba(58,48,40,0.03)',
        fontSize: '13.5px',
        lineHeight: 1.6,
        color: 'var(--color-text-secondary)',
        whiteSpace: 'pre-wrap',
      }}>
        {!isUser && (
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-accent-active)', marginBottom: '6px', letterSpacing: '0.04em' }}>
            QUINN
          </div>
        )}
        {isUser ? msg.text : <QuinnMessageBody text={msg.text} />}
        {children}
      </div>
    </div>
  );
}

type ComposerProps = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onAcceptSuggestion?: (full: string) => void;
  disabled: boolean;
  placeholder: string;
  minHeight: number;
};

function ClaudeComposer({
  value,
  onChange,
  onSend,
  onAcceptSuggestion,
  disabled,
  placeholder,
  minHeight,
}: ComposerProps) {
  const hasText = value.trim().length > 0;
  const ghost = getGhostSuggestion(value);
  const fullSuggestion = ghost ? value + ghost : '';

  return (
    <div
      style={{
        width: '100%',
      background: '#fff',
      borderRadius: '20px',
      border: ghost ? '1.5px solid var(--color-accent-mid, rgba(34,68,68,0.35))' : '1.5px solid rgba(217, 215, 212, 1)',
      boxShadow: '0 4px 20px rgba(58,48,40,0.09)',
      overflow: 'hidden',
      transition: 'border-color 0.15s ease',
      }}
    >
      {/* Ghost text + textarea wrapper */}
      <div style={{ position: 'relative' }}>
        {/* Ghost overlay — renders behind textarea text */}
        {ghost && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              padding: '12px 16px 8px',
              fontSize: '14px',
              fontFamily: 'var(--font-primary)',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              pointerEvents: 'none',
              userSelect: 'none',
              boxSizing: 'border-box',
              minHeight,
              zIndex: 0,
            }}
          >
            <span style={{ color: 'transparent' }}>{value}</span>
            <span style={{ color: 'rgba(58,48,40,0.3)', fontStyle: 'normal' }}>{ghost}</span>
          </div>
        )}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && ghost && onAcceptSuggestion) {
              e.preventDefault();
              onAcceptSuggestion(fullSuggestion);
              return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={ghost ? '' : placeholder}
          disabled={disabled}
          rows={2}
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            boxSizing: 'border-box',
            minHeight,
            padding: '12px 16px 8px',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontSize: '14px',
            color: 'var(--color-text-primary)',
            background: 'transparent',
            fontFamily: 'var(--font-primary)',
            lineHeight: 1.55,
          }}
        />
      </div>
      {/* Tab hint strip */}
      {ghost && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 16px 6px',
          borderTop: '1px solid var(--color-border-subtle)',
        }}>
          <kbd style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '1px 6px',
            borderRadius: '4px',
            border: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-surface, #f7f6f4)',
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-muted)',
            lineHeight: 1.5,
          }}>Tab</kbd>
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', fontFamily: 'var(--font-primary)' }}>
            to accept suggestion
          </span>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px 8px 10px',
          gap: '6px',
          borderTop: '1px solid var(--color-border-subtle)',
        }}
      >
        <button
          type="button"
          aria-label="Add attachment"
          disabled={disabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            border: 'none',
            background: 'transparent',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: 'var(--color-text-muted)',
          }}
        >
          <Plus size={18} strokeWidth={2} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'flex-end' }}>
          <button
            type="button"
            aria-label="Model"
            disabled={disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              borderRadius: '100px',
              border: 'none',
              background: 'transparent',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Quinn
            <ChevronDown size={14} color="var(--color-text-muted)" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            aria-label="Voice input"
            disabled={disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              border: 'none',
              background: 'transparent',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: 'var(--color-text-muted)',
            }}
          >
            <Mic size={16} strokeWidth={2} />
          </button>
          {hasText && (
            <button
              type="button"
              onClick={onSend}
              disabled={disabled}
              aria-label="Send"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--color-accent-deep)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                flexShrink: 0,
              }}
            >
              <Send size={14} color="#F4F1EC" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Data integrity components ────────────────────────────────────────────────

function CheckRow({ check }: { check: IntegrityCheck }) {
  const config = {
    issue: { color: '#DC2626', bg: 'rgba(220,38,38,0.05)', Icon: AlertCircle },
    warning: { color: '#D97706', bg: 'rgba(217,119,6,0.05)', Icon: AlertTriangle },
    ok: { color: '#15803D', bg: 'transparent', Icon: CheckCircle2 },
  }[check.status];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '9px 14px',
      gap: '10px',
      borderTop: '1px solid var(--color-border-subtle)',
      background: config.bg,
    }}>
      <config.Icon size={14} color={config.color} strokeWidth={2} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
          {check.label}
        </div>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px', lineHeight: 1.4 }}>
          {check.detail}
        </div>
      </div>
      {check.action && (
        <button
          type="button"
          style={{
            padding: '4px 11px',
            borderRadius: '100px',
            border: '1px solid var(--color-border)',
            background: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {check.action}
        </button>
      )}
    </div>
  );
}

function DataIntegrityCard({ onFixWithQuinn }: { onFixWithQuinn: () => void }) {
  const issues = INTEGRITY_CHECKS.filter(c => c.status === 'issue');
  const warnings = INTEGRITY_CHECKS.filter(c => c.status === 'warning');
  const passing = INTEGRITY_CHECKS.filter(c => c.status === 'ok');

  return (
    <div style={{
      marginTop: '8px',
      borderRadius: '10px',
      border: '1px solid var(--color-border-subtle)',
      overflow: 'hidden',
    }}>
      {/* Header with summary pills */}
      <div style={{
        padding: '10px 14px',
        background: 'var(--color-bg-hover)',
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        <ShieldCheck size={14} color="#D97706" strokeWidth={2} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Data Integrity
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '5px', alignItems: 'center' }}>
          <span style={{
            fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px',
            background: 'rgba(220,38,38,0.1)', color: '#DC2626',
          }}>
            {issues.length} issues
          </span>
          <span style={{
            fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px',
            background: 'rgba(217,119,6,0.1)', color: '#D97706',
          }}>
            {warnings.length} warnings
          </span>
          <span style={{
            fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px',
            background: 'rgba(21,128,61,0.1)', color: '#15803D',
          }}>
            {passing.length} ok
          </span>
        </div>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <>
          <div style={{ padding: '8px 14px 4px', fontSize: '12px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Needs attention
          </div>
          {issues.map(check => <CheckRow key={check.id} check={check} />)}
        </>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <>
          <div style={{ padding: '8px 14px 4px', fontSize: '12px', fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Review recommended
          </div>
          {warnings.map(check => <CheckRow key={check.id} check={check} />)}
        </>
      )}

      {/* Passing */}
      {passing.length > 0 && (
        <>
          <div style={{ padding: '8px 14px 4px', fontSize: '12px', fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            All good
          </div>
          {passing.map(check => <CheckRow key={check.id} check={check} />)}
        </>
      )}

      {/* Footer CTA */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-hover)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}>
        <button
          type="button"
          onClick={onFixWithQuinn}
          style={{
            padding: '7px 16px', borderRadius: '100px',
            border: 'none',
            background: 'var(--color-accent-active)',
            fontSize: '12px', fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: '#fff', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(34,68,68,0.25)',
          }}
        >
          Walk me through fixing these
        </button>
      </div>
    </div>
  );
}

// ─── Analytics thinking bubble ───────────────────────────────────────────────

const THINKING_PHRASES = [
  'Pulling your data\u2026',
  'Crunching numbers\u2026',
  'Building your chart\u2026',
];

function QuinnThinkingContent() {
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setPhraseIdx(i => (i + 1) % THINKING_PHRASES.length);
    }, 900);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0 2px' }}>
      <QuinnAvatar size={28} mode="thinking" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <AnimatePresence mode="wait">
          <motion.span
            key={phraseIdx}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-primary)',
            }}
          >
            {THINKING_PHRASES[phraseIdx]}
          </motion.span>
        </AnimatePresence>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              style={{
                display: 'inline-block',
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: 'var(--color-accent-quinn)',
              }}
              animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 0.7,
                delay: i * 0.14,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Analytics chart bubble content ─────────────────────────────────────────

function AnalyticsChartContent({
  chartId,
  isPinned,
  onAdd,
}: {
  chartId: AnalyticsChartId;
  isPinned: boolean;
  onAdd: () => void;
}) {
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{
        borderRadius: '10px',
        border: '1px solid var(--color-border-subtle)',
        overflow: 'hidden',
        background: '#fff',
        padding: '12px 8px 8px',
      }}>
        {renderAnalyticsChart(chartId)}
        {analyticsChartLegend(chartId)}
      </div>
      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onAdd}
          disabled={isPinned}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '100px',
            border: isPinned ? 'none' : '1.5px solid var(--color-border)',
            background: isPinned ? 'var(--color-success-light, #f0fdf4)' : '#fff',
            color: isPinned ? '#166534' : 'var(--color-text-secondary)',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: isPinned ? 'default' : 'pointer',
          }}
        >
          <Pin size={12} strokeWidth={2} />
          {isPinned ? 'Added to dashboard' : 'Add to dashboard'}
        </button>
      </div>
    </div>
  );
}

function analyticsChartLegend(chartId: AnalyticsChartId) {
  if (chartId === 'sales') {
    return (
      <div style={{ display: 'flex', gap: '12px', padding: '6px 8px 0', justifyContent: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-primary)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-border-subtle)', display: 'inline-block' }} />
          Prior week
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-primary)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-accent-deep)', display: 'inline-block' }} />
          Last week
        </span>
      </div>
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Feed({
  briefingRole,
  quinnExpanded = false,
  onToggleQuinnExpand,
  onChatStateChange,
  noHeader = false,
  onAddToDashboard,
  onViewDashboard,
  seedUserPrompt,
  autoSendPrompt,
  autoSendChartId,
  alreadyPinned,
  autoStartFlow,
}: {
  briefingRole: BriefingRole;
  quinnExpanded?: boolean;
  onToggleQuinnExpand?: () => void;
  onChatStateChange?: (active: boolean) => void;
  noHeader?: boolean;
  onAddToDashboard?: (id: AnalyticsChartId) => void;
  onViewDashboard?: () => void;
  seedUserPrompt?: string;
  /** If set, Feed simulates a user send with this text on mount. */
  autoSendPrompt?: string;
  /** Explicit chart for autoSendPrompt: id to force a chart, null for text-only, undefined to fall back to prefix detection. */
  autoSendChartId?: AnalyticsChartId | null;
  /** Charts already pinned to the dashboard — their "Add to dashboard" buttons render as already-pinned. */
  alreadyPinned?: Set<AnalyticsChartId>;
  /** If set, auto-start the named guided flow on mount (e.g. from an external "Ask Quinn" entry point). */
  autoStartFlow?: 'recipe' | 'integrity';
}) {
  const [chatStarted, setChatStarted] = useState(!!seedUserPrompt || !!autoSendPrompt);
  const [messages, setMessages] = useState<ChatMsg[]>(() =>
    seedUserPrompt && !autoSendPrompt
      ? [{ id: 'q-seed', role: 'quinn', text: seedUserPrompt }]
      : [],
  );
  const [input, setInput] = useState('');
  const [recipeFlow, setRecipeFlow] = useState(0);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>(INITIAL_RECIPE_INGREDIENTS);
  const [selectedPackaging, setSelectedPackaging] = useState<Set<string>>(new Set());
  const [selectedAllergens, setSelectedAllergens] = useState<Set<string>>(new Set(AUTO_DETECTED_ALLERGENS));
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set(['fitzroy']));
  const doneSiteNamesRef = useRef<string[]>(['Fitzroy Espresso']);
  const [productionFlow, setProductionFlow] = useState(0);
  const [prodSettings, setProdSettings] = useState<ProdSettings>({ ...DEFAULT_PROD_SETTINGS });
  const [chatMinimized, setChatMinimized] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [analyticsType, setAnalyticsType] = useState<AnalyticsChartId | null>(null);
  const [analyticsStep, setAnalyticsStep] = useState(0);
  const [pinnedChartIds, setPinnedChartIds] = useState<Set<AnalyticsChartId>>(
    () => new Set(alreadyPinned ?? []),
  );

  const greeting = timeAwareGreeting(briefingRole);

  useEffect(() => {
    onChatStateChange?.(chatStarted && !chatMinimized);
  }, [chatStarted, chatMinimized, onChatStateChange]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, recipeFlow, productionFlow]);

  // Auto-send the seeded prompt once on mount (used by AddInsightPopup).
  const didAutoSendRef = useRef(false);
  useEffect(() => {
    if (didAutoSendRef.current) return;
    if (!autoSendPrompt) return;
    didAutoSendRef.current = true;
    sendMessage(autoSendPrompt, autoSendChartId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSendPrompt]);

  // Auto-start a guided flow once on mount (used by the /recipes/intake "Ask Quinn" entry point).
  const didAutoStartRef = useRef(false);
  useEffect(() => {
    if (didAutoStartRef.current) return;
    if (!autoStartFlow) return;
    didAutoStartRef.current = true;
    if (autoStartFlow === 'recipe') startRecipeFlow();
    else if (autoStartFlow === 'integrity') startIntegrityCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartFlow]);

  useEffect(() => {
    if (recipeFlow === 1) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, { id: `u-recipe-${Date.now()}`, role: 'user', text: 'Chicken and mayo sandwich' }]);
        setRecipeFlow(2);
      }, 1500);
      return () => clearTimeout(t);
    }
    if (recipeFlow === 2) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-recipe-card-${Date.now()}`,
          role: 'quinn',
          text: RECIPE_CARD_INTRO,
          msgType: 'recipe-card',
        }]);
        setRecipeFlow(3);
      }, 1200);
      return () => clearTimeout(t);
    }
    if (recipeFlow === 3) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-cost-${Date.now()}`,
          role: 'quinn',
          text: RECIPE_COST_MSG,
          msgType: 'cost-breakdown',
        }]);
        setRecipeFlow(4);
      }, 1000);
      return () => clearTimeout(t);
    }
    if (recipeFlow === 4) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-packaging-${Date.now()}`,
          role: 'quinn',
          text: RECIPE_PACKAGING_MSG,
          msgType: 'packaging-picker',
        }]);
        setRecipeFlow(5);
      }, 900);
      return () => clearTimeout(t);
    }
    if (recipeFlow === 6) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-allergen-${Date.now()}`,
          role: 'quinn',
          text: RECIPE_ALLERGEN_MSG,
          msgType: 'allergen-check',
        }]);
        setRecipeFlow(7);
      }, 800);
      return () => clearTimeout(t);
    }
    if (recipeFlow === 8) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-sites-${Date.now()}`,
          role: 'quinn',
          text: RECIPE_SITES_MSG,
          msgType: 'site-selection',
        }]);
        setRecipeFlow(9);
      }, 700);
      return () => clearTimeout(t);
    }
    if (recipeFlow === 11) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-supplier-${Date.now()}`,
          role: 'quinn',
          text: RECIPE_LINK_MSG,
        }]);
        setRecipeFlow(12);
      }, 800);
      return () => clearTimeout(t);
    }
    if (recipeFlow === 13) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-done-${Date.now()}`,
          role: 'quinn',
          text: buildDoneMsg(doneSiteNamesRef.current),
        }]);
        setRecipeFlow(14);
      }, 800);
      return () => clearTimeout(t);
    }
    if (recipeFlow === 14) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-prod-offer-${Date.now()}`,
          role: 'quinn',
          text: "Want to add it to a production plan while we're here? I can walk you through the settings in a couple of quick questions.",
        }]);
        setRecipeFlow(15);
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [recipeFlow]);

  useEffect(() => {
    if (productionFlow === 3) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, { id: `q-shelf-${Date.now()}`, role: 'quinn', text: PROD_SHELF_MSG, msgType: 'prod-shelf' }]);
        setProductionFlow(4);
      }, 700);
      return () => clearTimeout(t);
    }
    if (productionFlow === 5) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, { id: `q-batch-${Date.now()}`, role: 'quinn', text: PROD_BATCH_MSG, msgType: 'prod-batch' }]);
        setProductionFlow(6);
      }, 700);
      return () => clearTimeout(t);
    }
    if (productionFlow === 7) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, { id: `q-category-${Date.now()}`, role: 'quinn', text: PROD_CATEGORY_MSG, msgType: 'prod-category' }]);
        setProductionFlow(8);
      }, 700);
      return () => clearTimeout(t);
    }
    if (productionFlow === 9) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, { id: `q-prod-done-${Date.now()}`, role: 'quinn', text: 'All done! Here\'s the production plan I\'ve set up for your **Chicken & Mayo Sandwich**:', msgType: 'prod-summary' }]);
        setProductionFlow(10);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [productionFlow]);

  // ─── Analytics flow ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!analyticsType || analyticsStep === 0 || analyticsStep >= 3) return;
    if (analyticsStep === 1) {
      const t = setTimeout(() => {
        setMessages(prev => [
          ...prev.filter(m => m.msgType !== 'analytics-thinking'),
          {
            id: `q-analytics-chart-${analyticsType}-${Date.now()}`,
            role: 'quinn' as const,
            text: ANALYTICS_CONFIG[analyticsType].chartLabel,
            msgType: 'analytics-chart',
            chartId: analyticsType,
          },
        ]);
        setAnalyticsStep(2);
      }, 1600);
      return () => clearTimeout(t);
    }
    if (analyticsStep === 2) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-analytics-reasoning-${analyticsType}-${Date.now()}`,
          role: 'quinn' as const,
          text: ANALYTICS_CONFIG[analyticsType].reasoning,
        }]);
        setAnalyticsStep(3);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [analyticsType, analyticsStep]);

  function handleAddChart(chartId: AnalyticsChartId) {
    if (pinnedChartIds.has(chartId)) return;
    setPinnedChartIds(prev => new Set([...prev, chartId]));
    onAddToDashboard?.(chartId);
    setMessages(prev => [...prev, {
      id: `q-analytics-pinned-${chartId}-${Date.now()}`,
      role: 'quinn',
      text: `Done — I've pinned **${ANALYTICS_CONFIG[chartId].label}** to your dashboard.`,
      msgType: 'analytics-pinned',
    }]);
  }

  function startRecipeFlow() {
    setChatMinimized(false);
    setChatStarted(true);
    setMessages([{ id: `q-greeting-${Date.now()}`, role: 'quinn', text: RECIPE_GREETING }]);
    setRecipeFlow(1);
  }

  function startIntegrityCheck() {
    setChatMinimized(false);
    setChatStarted(true);
    setMessages([{ id: `u-integrity-${Date.now()}`, role: 'user', text: 'Check my data integrity' }]);
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: `q-integrity-${Date.now()}`,
        role: 'quinn',
        text: "I've scanned your setup. You've got **3 things that need attention**, **4 worth a review**, and **4 checks that are all clear**. Here's the full picture:",
        msgType: 'integrity-check',
      }]);
    }, 2000);
  }

  function confirmPackaging() {
    const chosen = PACKAGING_OPTIONS.filter(p => selectedPackaging.has(p.id));
    const total = chosen.reduce((s, p) => s + p.cost, 0);
    const names = chosen.map(p => p.name).join(', ');
    setMessages(prev => [...prev, {
      id: `u-packaging-${Date.now()}`,
      role: 'user',
      text: `Add ${names} (+£${total.toFixed(2)}/serve)`,
    }]);
    setRecipeFlow(6);
  }

  function skipPackaging() {
    setMessages(prev => [...prev, {
      id: `u-packaging-skip-${Date.now()}`,
      role: 'user',
      text: 'No packaging needed',
    }]);
    setRecipeFlow(6);
  }

  function confirmAllergens() {
    const list = Array.from(selectedAllergens).join(', ');
    setMessages(prev => [...prev, {
      id: `u-allergens-${Date.now()}`,
      role: 'user',
      text: `Confirmed — ${list}`,
    }]);
    setRecipeFlow(8);
  }

  function confirmSites() {
    const names = MOCK_SITES.filter(s => selectedSites.has(s.id)).map(s => s.name);
    doneSiteNamesRef.current = names;
    const sitesStr = names.join(', ');
    setMessages(prev => [...prev, {
      id: `u-sites-${Date.now()}`,
      role: 'user',
      text: `Assign to: ${sitesStr}`,
    }]);
    setRecipeFlow(10);
  }

  function confirmRecipe() {
    setMessages(prev => [...prev, { id: `u-confirm-${Date.now()}`, role: 'user', text: 'Looks good, save it' }]);
    setRecipeFlow(11);
  }

  function confirmSupplier() {
    setMessages(prev => [...prev, { id: `u-supplier-${Date.now()}`, role: 'user', text: 'Yes, add them' }]);
    setRecipeFlow(13);
  }

  // ─── Production flow actions ──────────────────────────────────────────────

  function startProductionFlow() {
    setMessages(prev => [...prev,
      { id: `u-prod-yes-${Date.now()}`, role: 'user', text: 'Yes, set it up' },
      { id: `q-prod-start-${Date.now()}`, role: 'quinn', text: PROD_PREP_MSG, msgType: 'prod-prep' },
    ]);
    setRecipeFlow(16);
    setProdSettings({ ...DEFAULT_PROD_SETTINGS });
    setProductionFlow(2);
  }

  function skipProductionOffer() {
    setMessages(prev => [...prev, { id: `u-prod-skip-${Date.now()}`, role: 'user', text: 'Not now, thanks' }]);
    setRecipeFlow(16);
  }

  function confirmPrepTime(time: string) {
    setProdSettings(s => ({ ...s, prepTime: time }));
    setMessages(prev => [...prev, { id: `u-prep-${Date.now()}`, role: 'user', text: `${time} prep time` }]);
    setProductionFlow(3);
  }

  function confirmShelfLife(life: string) {
    setProdSettings(s => ({ ...s, shelfLife: life }));
    setMessages(prev => [...prev, { id: `u-shelf-${Date.now()}`, role: 'user', text: `Shelf life: ${life}` }]);
    setProductionFlow(5);
  }

  function confirmBatch() {
    const maxStr = prodSettings.batchMax === 'unlimited' ? 'no max' : `max ${prodSettings.batchMax}`;
    const multipleStr = prodSettings.batchMultiple > 1 ? `, ×${prodSettings.batchMultiple} multiple` : '';
    const carryStr = prodSettings.allowCarryOver ? 'allow carry over' : 'write off unsold';
    setMessages(prev => [...prev, { id: `u-batch-${Date.now()}`, role: 'user', text: `Batch: ${prodSettings.batchMin}–${maxStr}${multipleStr}, ${carryStr}` }]);
    setProductionFlow(7);
  }

  function confirmCategoryAndClosing() {
    const closingStr = prodSettings.closingRange === 'No limit' ? 'no production cutoff' : `stop ${prodSettings.closingRange} before close`;
    setMessages(prev => [...prev, { id: `u-cat-${Date.now()}`, role: 'user', text: `${prodSettings.category} · ${closingStr}` }]);
    setProductionFlow(9);
  }

  // ─────────────────────────────────────────────────────────────────────────

  function sendMessage(overrideText?: string, explicitChart?: AnalyticsChartId | null) {
    const raw = overrideText !== undefined ? overrideText : input;
    const text = raw.trim();
    if (!text) return;

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', text };
    setChatStarted(true);
    setChatMinimized(false);
    setInput('');

    let detected: AnalyticsChartId | null = null;
    if (explicitChart !== undefined) {
      detected = explicitChart;
    } else {
      // Prefix detection for typed input. Order matters (more specific first).
      if (text.startsWith('Which site has'))      detected = 'growth';
      else if (text.startsWith('Which sites are')) detected = 'cogs';
      else if (text.startsWith('Which hour'))      detected = 'hour';
      else if (text.startsWith('What were'))       detected = 'sales';
      else if (text.startsWith('How has'))         detected = 'trend';
      else if (text.startsWith('What is'))         detected = 'labour';
    }

    if (detected) {
      setMessages(prev => [...prev, userMsg, {
        id: `q-thinking-${Date.now()}`,
        role: 'quinn' as const,
        text: '',
        msgType: 'analytics-thinking',
      }]);
      setAnalyticsType(detected);
      setAnalyticsStep(1);
    } else {
      // No canned chart — Quinn responds with a brief text answer after a short beat.
      setMessages(prev => [...prev, userMsg, {
        id: `q-thinking-text-${Date.now()}`,
        role: 'quinn' as const,
        text: '',
        msgType: 'analytics-thinking',
      }]);
      const placeholderId = `q-text-${Date.now()}`;
      window.setTimeout(() => {
        setMessages(prev => {
          // Replace the thinking bubble with a text reply
          const withoutThinking = prev.filter(m => m.msgType !== 'analytics-thinking');
          return [
            ...withoutThinking,
            {
              id: placeholderId,
              role: 'quinn' as const,
              text: `Looking at that now. I don't have a canned chart for this one yet, but here's the shape of the answer from the last 30 days of data:\n\n• Strongest signal: patterns consistent across sites, with a clear outlier worth a deeper look.\n• What to do next: tell me which site or timeframe you want to drill into, or ask it differently and I'll pull the relevant numbers.\n\nI can also draft a custom chart if you want to pin something to the dashboard — just tell me what axes you'd like.`,
            },
          ];
        });
      }, 900);
    }
  }

  const analyticsActive = analyticsStep > 0 && analyticsStep < 3;
  const composerDisabled = (recipeFlow > 0 && recipeFlow < 16) || (productionFlow > 0 && productionFlow < 10) || analyticsActive;
  const composerPlaceholder = composerDisabled
    ? (productionFlow > 0
        ? 'Quinn is setting up your production plan\u2026'
        : analyticsActive
          ? 'Quinn is analysing your data\u2026'
          : 'Quinn is working on your recipe\u2026')
    : PLACEHOLDER;
  const composerMinH = chatStarted ? 40 : 72;

  const showHeader = !noHeader && (quinnExpanded || chatStarted) && !chatMinimized;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      minWidth: 0,
      height: '100%',
      width: '100%',
      maxWidth: noHeader ? '100%' : (chatStarted ? '100%' : 'min(680px, 100%)'),
      margin: '0 auto',
      background: noHeader ? '#fff' : (quinnExpanded || chatStarted ? '#fff' : 'transparent'),
      borderRadius: noHeader ? 0 : ((quinnExpanded || chatStarted) ? 0 : 'var(--radius-nav)'),
      overflow: 'hidden',
      fontFamily: 'var(--font-primary)',
      boxShadow: (quinnExpanded || chatStarted) ? 'none' : undefined,
      position: 'relative',
    }}>

      {showHeader && (
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
          background: quinnExpanded ? 'var(--color-bg-nav)' : 'transparent',
        }}>
          <QuinnAvatar mode="sparkle" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Quinn
            </div>
            {quinnExpanded && !chatStarted && (
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
                Full screen · chat
              </div>
            )}
          </div>
          {chatStarted && (
            <button
              type="button"
              onClick={() => setChatMinimized(true)}
              title="Minimise chat"
              aria-label="Minimise chat"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: '1px solid var(--color-border-subtle)',
                background: '#fff',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <ChevronDown size={17} color="var(--color-text-secondary)" strokeWidth={2} />
            </button>
          )}
          {onToggleQuinnExpand && (
            <button
              type="button"
              onClick={onToggleQuinnExpand}
              title={quinnExpanded ? 'Exit full screen' : 'Expand Quinn to full screen'}
              aria-label={quinnExpanded ? 'Exit full screen' : 'Expand Quinn to full screen'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: '1px solid var(--color-border-subtle)',
                background: '#fff',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {quinnExpanded
                ? <Minimize2 size={17} color="var(--color-text-secondary)" strokeWidth={2} />
                : <Maximize2 size={17} color="var(--color-text-secondary)" strokeWidth={2} />}
            </button>
          )}
        </div>
      )}

      {!showHeader && onToggleQuinnExpand && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
          <button
            type="button"
            onClick={onToggleQuinnExpand}
            title="Expand Quinn to full screen"
            aria-label="Expand Quinn to full screen"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(58,48,40,0.08)',
            }}
          >
            <Maximize2 size={17} color="var(--color-text-secondary)" strokeWidth={2} />
          </button>
        </div>
      )}

      <div style={{
        flex: 1,
        overflowY: 'auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}>
        {(!chatStarted || chatMinimized) ? (
          <div style={{
            flex: chatMinimized ? 0 : 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: chatMinimized ? 'flex-start' : 'center',
            padding: chatMinimized ? '28px 16px 0' : '20px 16px 24px',
            boxSizing: 'border-box',
            background: 'transparent',
          }}>
            <div style={{ width: '100%', maxWidth: '560px' }}>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  Edify
                </span>
                <div style={{
                  marginTop: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}>
                  <Sparkles size={22} color="var(--color-accent-quinn)" strokeWidth={2} style={{ flexShrink: 0 }} />
                  <span style={{
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontSize: 'clamp(22px, 4vw, 28px)',
                    fontWeight: 400,
                    color: 'var(--color-text-primary)',
                    lineHeight: 1.25,
                    margin: 0,
                  }}
                  >
                    {greeting}
                  </span>
                </div>
              </div>

              <ClaudeComposer
                value={input}
                onChange={setInput}
                onSend={() => sendMessage()}
                onAcceptSuggestion={(full) => sendMessage(full)}
                disabled={false}
                placeholder={PLACEHOLDER}
                minHeight={72}
              />

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                justifyContent: 'center',
                marginTop: '20px',
              }}>
                {PROMPT_CHIPS.map((chip, i) => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (chip.action === 'recipe') {
                          startRecipeFlow();
                        } else if (chip.action === 'integrity') {
                          startIntegrityCheck();
                        } else {
                          sendMessage(chip.text);
                        }
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 14px',
                        borderRadius: '100px',
                        border: '1px solid var(--color-border-subtle)',
                        background: '#fff',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      <Icon
                        size={15}
                        strokeWidth={2}
                        color="var(--color-text-muted)"
                      />
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              {/* Chat history — shown only when minimised and there are messages */}
              {chatMinimized && messages.length > 0 && (
                <div style={{ marginTop: '32px' }}>
                  {/* Section header */}
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(prev => !prev)}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 0',
                      border: 'none',
                      borderTop: '1px solid var(--color-border-subtle)',
                      background: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--color-text-secondary)',
                      letterSpacing: '0.04em',
                    }}>
                      Chat History
                    </span>
                    <ChevronDown
                      size={14}
                      color="var(--color-text-muted)"
                      strokeWidth={2.5}
                      style={{
                        transform: historyOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.18s ease',
                      }}
                    />
                  </button>

                  {historyOpen && (
                    <div>
                      {/* Single conversation entry — clicking restores the chat */}
                      <button
                        type="button"
                        onClick={() => setChatMinimized(false)}
                        style={{
                          display: 'flex',
                          width: '100%',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 0',
                          border: 'none',
                          borderTop: '1px solid var(--color-border-subtle)',
                          background: 'none',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-primary)',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{
                          width: 30, height: 30, borderRadius: '8px',
                          background: 'var(--color-quinn-bg)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Sparkles size={14} color="var(--color-accent-quinn)" strokeWidth={2} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '13px', fontWeight: 600,
                            color: 'var(--color-text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {(() => {
                              const t = messages.find(m => m.role === 'user')?.text ?? 'Conversation';
                              return t.length > 52 ? t.slice(0, 52) + '…' : t;
                            })()}
                          </div>
                          <div style={{
                            fontSize: '12px', fontWeight: 500,
                            color: 'var(--color-text-muted)',
                            marginTop: '2px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {(() => {
                              const t = messages.find(m => m.role === 'quinn')?.text.replace(/\*\*/g, '') ?? '';
                              return t.length > 64 ? t.slice(0, 64) + '…' : t;
                            })()}
                          </div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          just now
                        </span>
                        <ChevronDown
                          size={14}
                          color="var(--color-text-muted)"
                          strokeWidth={2}
                          style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}
                        />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              justifyContent: 'center',
            }}>
              <div style={{
                width: '100%',
                maxWidth: '680px',
                padding: '16px 24px 16px',
              }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {messages.map((m) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                      >
                      <ChatBubble key={m.id} msg={m}>
                        {m.msgType === 'analytics-thinking' && (
                          <QuinnThinkingContent />
                        )}
                        {m.msgType === 'recipe-card' && (
                          <RecipeCardEditor
                            ingredients={recipeIngredients}
                            onChange={(idx, qty) => {
                              setRecipeIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, qty } : ing));
                            }}
                          />
                        )}
                        {m.msgType === 'cost-breakdown' && (
                          <CostBreakdownCard />
                        )}
                        {m.msgType === 'integrity-check' && (
                          <DataIntegrityCard
                            onFixWithQuinn={() => sendMessage('Walk me through fixing the data integrity issues — let\'s start with the 3 that need immediate attention.')}
                          />
                        )}
                        {m.msgType === 'packaging-picker' && recipeFlow === 5 && (
                          <PackagingPicker
                            selected={selectedPackaging}
                            onToggle={(id) => setSelectedPackaging(prev => {
                              const next = new Set(prev);
                              if (next.has(id)) next.delete(id); else next.add(id);
                              return next;
                            })}
                            onConfirm={confirmPackaging}
                            onSkip={skipPackaging}
                          />
                        )}
                        {m.msgType === 'allergen-check' && recipeFlow === 7 && (
                          <AllergenCard
                            confirmed={selectedAllergens}
                            onToggle={(a) => setSelectedAllergens(prev => {
                              const next = new Set(prev);
                              if (next.has(a)) next.delete(a); else next.add(a);
                              return next;
                            })}
                            onConfirm={confirmAllergens}
                          />
                        )}
                        {m.msgType === 'site-selection' && recipeFlow === 9 && (
                          <SiteSelectionCard
                            selected={selectedSites}
                            onToggle={(id) => setSelectedSites(prev => {
                              const next = new Set(prev);
                              if (next.has(id)) next.delete(id); else next.add(id);
                              return next;
                            })}
                            onConfirm={confirmSites}
                          />
                        )}
                        {m.msgType === 'prod-prep' && productionFlow === 2 && (
                          <PillPicker
                            options={PREP_TIME_OPTIONS}
                            selected={prodSettings.prepTime}
                            onSelect={(v) => setProdSettings(s => ({ ...s, prepTime: v }))}
                            onConfirm={() => confirmPrepTime(prodSettings.prepTime)}
                          />
                        )}
                        {m.msgType === 'prod-shelf' && productionFlow === 4 && (
                          <PillPicker
                            options={SHELF_LIFE_OPTIONS}
                            selected={prodSettings.shelfLife}
                            onSelect={(v) => setProdSettings(s => ({ ...s, shelfLife: v }))}
                            onConfirm={() => confirmShelfLife(prodSettings.shelfLife)}
                          />
                        )}
                        {m.msgType === 'prod-batch' && productionFlow === 6 && (
                          <BatchAndCarryCard
                            settings={prodSettings}
                            onUpdate={(u) => setProdSettings(s => ({ ...s, ...u }))}
                            onConfirm={confirmBatch}
                          />
                        )}
                        {m.msgType === 'prod-category' && productionFlow === 8 && (
                          <CategoryClosingCard
                            settings={prodSettings}
                            onUpdate={(u) => setProdSettings(s => ({ ...s, ...u }))}
                            onConfirm={confirmCategoryAndClosing}
                          />
                        )}
                        {m.msgType === 'prod-summary' && productionFlow === 10 && (
                          <ProductionSummaryCard settings={prodSettings} />
                        )}
                        {m.msgType === 'analytics-chart' && m.chartId && (
                          <AnalyticsChartContent
                            chartId={m.chartId as AnalyticsChartId}
                            isPinned={pinnedChartIds.has(m.chartId as AnalyticsChartId)}
                            onAdd={() => handleAddChart(m.chartId as AnalyticsChartId)}
                          />
                        )}
                        {m.msgType === 'analytics-pinned' && (
                          <button
                            type="button"
                            onClick={() => onViewDashboard?.()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginTop: '10px',
                              padding: '7px 14px',
                              borderRadius: '100px',
                              border: 'none',
                              background: 'var(--color-accent-active)',
                              color: '#fff',
                              fontSize: '12px',
                              fontWeight: 600,
                              fontFamily: 'var(--font-primary)',
                              cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(34,68,68,0.22)',
                            }}
                          >
                            <LayoutDashboard size={13} strokeWidth={2} />
                            View dashboard
                          </button>
                        )}
                      </ChatBubble>
                      </motion.div>
                    ))}

                    {recipeFlow === 10 && (
                      <ActionButton label="Looks good, save it" onClick={confirmRecipe} />
                    )}
                    {recipeFlow === 12 && (
                      <ActionButton label="Yes, add them" onClick={confirmSupplier} />
                    )}
                    {recipeFlow === 15 && (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', maxWidth: '88%' }}>
                        <button type="button" onClick={skipProductionOffer} style={{ padding: '8px 18px', borderRadius: '100px', border: '1.5px solid var(--color-border)', background: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                          Not now
                        </button>
                        <button type="button" onClick={startProductionFlow} style={{ padding: '8px 18px', borderRadius: '100px', border: 'none', background: 'var(--color-accent-active)', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(34,68,68,0.25)' }}>
                          Yes, set it up
                        </button>
                      </div>
                    )}

                    <div ref={chatEndRef} style={{ height: '32px' }} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            <div style={{
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
              marginTop: '20px',
              borderTop: '1px solid var(--color-border-subtle)',
              opacity: composerDisabled ? 0.55 : 1,
              pointerEvents: composerDisabled ? 'none' : 'auto',
            }}>
              <div style={{
                width: '100%',
                maxWidth: '680px',
                padding: '12px 24px 8px',
              }}>
                <ClaudeComposer
                  value={input}
                  onChange={setInput}
                  onSend={() => sendMessage()}
                  onAcceptSuggestion={(full) => sendMessage(full)}
                  disabled={composerDisabled}
                  placeholder={composerPlaceholder}
                  minHeight={composerMinH}
                />
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

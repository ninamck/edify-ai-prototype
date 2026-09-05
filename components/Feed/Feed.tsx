'use client';

import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Send,
  Maximize2,
  Minimize2,
  Plus,
  Mic,
  ChevronDown,
  ChevronRight,
  ChefHat,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  LayoutDashboard,
  Pin,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  MessageSquare,
  Clock,
  X,
  Paperclip,
  FileText,
  Package,
  Check,
  Target,
  Box,
  Utensils,
  MapPin,
  Timer,
  Layers,
  ClipboardList,
  Search,
} from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import EdifyMarkThinking from '@/components/EdifyMark/EdifyMarkThinking';
import { motion, AnimatePresence } from 'framer-motion';
import QuinnOrb from '@/components/Sidebar/QuinnOrb';
import type { BriefingRole } from '@/components/briefing';
import { timeAwareGreeting } from '@/components/briefing';
import { addNotebookNote } from '@/components/notebookStore';
import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import { renderAnalyticsChart, ANALYTICS_CONFIG } from '@/components/Analytics/AnalyticsCharts';
import { getDunkinInsight } from '@/components/Analytics/DunkinAnalyticsInsights';
import {
  runQuery,
  type TableQuery,
} from '@/components/Mvp1/Tables/query';
import DataTable from '@/components/Mvp1/Tables/DataTable';
import type { Column } from '@/components/Mvp1/Tables/dataSources';
import { parseCommand } from '@/components/Feed/commands/parsers';
import { COMMAND_REGISTRY, getCommand } from '@/components/Feed/commands/registry';
import { useCommandRunner } from '@/components/Feed/commands/useCommandRunner';
import SlashMenu from '@/components/Feed/commands/SlashMenu';
import TaskHistoryList from '@/components/Feed/TaskHistoryList';
import { PROMPT_CHIPS } from '@/components/Feed/suggestedPrompts';
import TaskHistoryDrawer from '@/components/Feed/TaskHistoryDrawer';
import { logEntry as logHistoryEntry, getTasks as getHistoryTasks, updateTask as updateHistoryTask } from '@/components/Feed/taskHistoryStore';
import { ACTIVITY_REPLAY_KEY, type ActivityReplayIntent } from '@/components/Activity/ActivityPage';
import WasteCommandCard from '@/components/Feed/commands/cards/WasteCommandCard';
import StockCountCommandCard from '@/components/Feed/commands/cards/StockCountCommandCard';
import RecipePickerCard from '@/components/Feed/commands/cards/RecipePickerCard';
import RecipeActionPickerCard from '@/components/Feed/commands/cards/RecipeActionPickerCard';
import RecipeIngredientPickerCard from '@/components/Feed/commands/cards/RecipeIngredientPickerCard';
import RecipeNewIngredientCard from '@/components/Feed/commands/cards/RecipeNewIngredientCard';
import RecipeEditSummaryCard from '@/components/Feed/commands/cards/RecipeEditSummaryCard';
import ProductionFieldCard from '@/components/Feed/commands/cards/ProductionFieldCard';
import MenuActionCard from '@/components/Feed/commands/cards/MenuActionCard';
import SupplierFieldCard from '@/components/Feed/commands/cards/SupplierFieldCard';
import ProductPurposeCard from '@/components/Feed/commands/cards/ProductPurposeCard';
import ProductNewInfoCard from '@/components/Feed/commands/cards/ProductNewInfoCard';
import ProductNewSupplierCard from '@/components/Feed/commands/cards/ProductNewSupplierCard';
import ProductPickReplacedCard from '@/components/Feed/commands/cards/ProductPickReplacedCard';
import ProductPackDetailsCard from '@/components/Feed/commands/cards/ProductPackDetailsCard';
import ProductPickRecipesCard from '@/components/Feed/commands/cards/ProductPickRecipesCard';
import ProductSwapSummaryCard from '@/components/Feed/commands/cards/ProductSwapSummaryCard';
import ProductSheetDetailsCard from '@/components/Feed/commands/cards/ProductSheetDetailsCard';
import SiteSetupPickSitesCard from '@/components/Feed/commands/cards/SiteSetupPickSitesCard';
import SiteSetupCopyCard from '@/components/Feed/commands/cards/SiteSetupCopyCard';
import SiteSetupTeamCard from '@/components/Feed/commands/cards/SiteSetupTeamCard';
import SiteSetupRangeTiersCard from '@/components/Feed/commands/cards/SiteSetupRangeTiersCard';
import SiteSetupProductionCard from '@/components/Feed/commands/cards/SiteSetupProductionCard';
import SiteSetupBenchesHotCard from '@/components/Feed/commands/cards/SiteSetupBenchesHotCard';
import SiteSetupGoLiveCard from '@/components/Feed/commands/cards/SiteSetupGoLiveCard';
import RotaRebalanceCard from '@/components/Feed/commands/cards/RotaRebalanceCard';
import AmbiguityPicker from '@/components/Feed/commands/cards/AmbiguityPicker';
import ReceiptCard from '@/components/Feed/commands/cards/ReceiptCard';
import MarginExplorerCard from '@/components/Feed/commands/cards/MarginExplorerCard';
import CardShell, { PillRow, type CardState } from '@/components/Feed/commands/cards/CardShell';
import { demoCustomer } from '@/lib/demoConfig';
import BatchReviewCard, { type BatchReviewRow, type BatchRowResult, type BatchReviewSubmission } from '@/components/Feed/commands/cards/BatchReviewCard';
import type { AmbiguityChoice } from '@/components/Feed/commands/types';
import {
  DEFAULT_WIZARD_TEMPLATE,
  deliveryNet,
  effectiveCogsPct,
  findTemplateByName,
  penceToPounds,
  srpExVatForCogs,
  srpIncVat,
  totalFoodCostP,
  type PackagingTemplate,
  type RecipeWizardTemplate,
  type TemplateIngredient,
} from '@/components/Feed/recipeWizardTemplates';
import {
  useIngredientCatalogue,
  type IngredientRef,
  type IngredientCatalogueRow,
  type ResolvedIngredient,
} from '@/components/Ingredients/catalogue';
import {
  useProducts,
  findMasterProduct,
  upsertProduct,
  upsertSupplier,
  genId,
  snapshot as snapshotSuppliersStore,
} from '@/components/Suppliers/store';
import { useRecipes, addRecipe, updateRecipe, findRecipe } from '@/components/Recipe/recipeStore';
import type { Recipe } from '@/components/Recipe/libraryFixtures';
import { TypeChip as PosTypeChip, PosKindChip, type EntityType as POSTargetType } from '@/components/ItemMatching/TypeChip';
import {
  masterCompanyAvg,
  ALL_SITES as ALL_SUPPLIER_SITES,
  type Product,
  type Allergen,
  type DayOfWeek,
  type ProductCategory,
  type ProductClass,
} from '@/components/Suppliers/fixtures';
import {
  setMatchTarget,
  useMatchOverrides,
} from '@/components/ItemMatching/overrideStore';
import { FITZROY_POS_INTAKE } from '@/components/Recipe/intakeFixtures';

function QuinnAvatar({
  size = 30,
  mode = 'sparkle',
}: {
  size?: number;
  mode?: 'sparkle' | 'thinking' | 'ready';
}) {
  if (mode === 'thinking') {
    return <EdifyMarkThinking size={size} />;
  }
  if (mode === 'ready') {
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
      <EdifyMark size={size * 0.45} color="var(--color-accent-quinn)" strokeWidth={2} />
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

// Commands intentionally hidden from the in-chat menus. The parser still
// recognises them (so /waste and natural language like "waste 3 muffins"
// keep working) — they just don't surface as quick-action chips or
// slash-menu entries. Waste sits up in the floor-actions strip, so
// duplicating it in chat would be noisy.
const HIDDEN_FROM_MENU_COMMAND_IDS = new Set<string>(['waste']);

// User-facing verb for each task kind. Used when synthesising a stub
// thread for history entries that pre-date the snapshot feature.
const KIND_VERB: Record<string, string> = {
  waste: 'Logged waste',
  stock: 'Added to stock count',
  'recipe-edit': 'Updated a recipe',
  production: 'Updated production settings',
  menu: 'Updated a menu',
  supplier: 'Updated a supplier',
  'product-swap': 'Replaced a product across recipes',
  question: 'Asked Edify a question',
  chat: 'Chatted with Edify',
};

/**
 * Build a minimal chat thread from a task's stored metadata, for
 * entries that don't carry a full snapshot. The synthesised thread
 * is intentionally lightweight — a user echo and either the
 * receipt card (for command tasks) or a brief note (for questions
 * and chats). Lets older history entries still "open" instead of
 * being dead clicks.
 */
function synthesiseThreadFromTask(
  task: import('@/components/Feed/taskHistoryStore').Task,
): import('@/components/Feed/taskHistoryStore').StoredChatMessage[] {
  const verb = KIND_VERB[task.kind] ?? 'Worked on this';
  const stamp = task.completedAt ?? task.startedAt;
  const userMsg: import('@/components/Feed/taskHistoryStore').StoredChatMessage = {
    id: `synth-user-${task.id}`,
    role: 'user',
    text: task.kind === 'question' || task.kind === 'chat' ? task.title : verb,
  };
  if (task.receipt) {
    return [
      userMsg,
      {
        id: `synth-rcpt-${task.id}`,
        role: 'quinn',
        text: task.receipt.headline,
        msgType: 'cmd-receipt',
        cmdId: `synth-${task.id}`,
        cmdReceiptData: { ...task.receipt },
      },
    ];
  }
  const noteSuffix = task.subtitle ? ` (${task.subtitle})` : '';
  return [
    userMsg,
    {
      id: `synth-note-${task.id}`,
      role: 'quinn',
      text:
        task.kind === 'question'
          ? `I answered this on ${new Date(stamp).toLocaleString()}${noteSuffix}. Ask again to see fresh data.`
          : `Logged from your history on ${new Date(stamp).toLocaleString()}${noteSuffix}.`,
    },
  ];
}

// Quick-actions row — one chip per chat command. Click opens an empty
// confirmation card and Quinn prompts for the missing detail.
const QUICK_ACTION_CHIPS: {
  commandId: string;
  label: string;
  icon: typeof ChefHat;
}[] = [
  ...COMMAND_REGISTRY
    .filter((c) => !HIDDEN_FROM_MENU_COMMAND_IDS.has(c.id))
    .map((c) => ({
      commandId: c.id,
      label: c.chipLabel,
      icon: c.chipIcon,
    })),
  // Not a registry command — a guided flow. Special-cased in
  // `handleQuickAction`, which routes it to `startPosMatchCheck`.
  { commandId: 'pos-match-check', label: 'Check my POS matches', icon: Target },
];

// ─── Data integrity checks ────────────────────────────────────────────────────
//
// Modelled on the real Soho recipe & cost review (Aug 2026): findings are
// ranked by what they do to cost, written in plain English, and split into
// FIX (moves the numbers), CHECK (ask the kitchen first) and TIDY (hygiene).

type IntegritySeverity = 'fix' | 'check' | 'tidy';

type IntegrityFinding = {
  id: string;
  /** 1-based priority — the list is worked top to bottom. */
  priority: number;
  title: string;
  severity: IntegritySeverity;
  /** One short line — the cost impact or the gist. Shown always. */
  summary: string;
  /** Longer plain-English explanation, behind the Details toggle. */
  detail?: string;
  /** Named recipes / lines affected, behind the Details toggle. */
  affected?: string;
  /** Label for the inline fix button. Absent = no batch rows to seed
   *  (tidy-ups handled at the next menu review). */
  fixLabel?: string;
};

const INTEGRITY_STATS = [
  { value: '456', label: 'Live recipes checked' },
  { value: '12', label: 'Clear fixes' },
  { value: '~9', label: 'Worth double-checking' },
  { value: '99%+', label: 'Of lines look correct' },
];

const INTEGRITY_FINDINGS: IntegrityFinding[] = [
  {
    id: 'wrong-cup',
    priority: 1,
    title: 'Four iced drinks on the wrong cup',
    severity: 'fix',
    summary: '£3.42 a cup instead of about 7p: the whole sleeve is charged to every drink.',
    detail:
      'All four point at Disp SOHO 16oz Smoothie Cups, priced as a single cup rather than the sleeve of 50. That product is no longer active, so it shouldn\u2019t be in a live recipe at all. Relink to 16oz Smoothie Cups New, the pack of 50.',
    affected: 'Iced Brown Sugar Latte · Iced Latte · Iced Long Black · Strawberry & Blueberry Smoothie',
    fixLabel: 'Fix 4 cups',
  },
  {
    id: 'wrong-units',
    priority: 2,
    title: 'Eight ingredients in the wrong kind of unit',
    severity: 'fix',
    summary: 'Grams on counted items and liquids: these recipes look cheaper than they are.',
    detail:
      'Use \u201ceach\u201d for the counted items, \u201cml\u201d for the liquids, and set grams on the honey line, which has no unit at all and so costs nothing today. Six lines are named; the other two sit in the full 112-row audit list.',
    affected: 'Cucumber Diced · Add Mushrooms · Ketchup · Knorr Cheese Sauce · Whipped Cream · Honey',
    fixLabel: 'Fix 6 units',
  },
  {
    id: 'brown-sauce',
    priority: 3,
    title: 'Brown sauce set to 15 sachets on four recipes',
    severity: 'check',
    summary: '£1.37 a portion instead of 9p. The norm everywhere else is 1.',
    detail:
      'Ask the kitchen whether 15 is real before editing: a single jacket potato almost certainly wants 1, but a sharing platter might genuinely want a few.',
    fixLabel: 'Review',
  },
  {
    id: 'archived-minis',
    priority: 4,
    title: 'Five live recipes rely on archived mini-recipes',
    severity: 'tidy',
    summary: 'Their cost is built on sub-recipes nobody is maintaining any more.',
    detail: 'Either un-archive the mini-recipes or rebuild these five on current components.',
    affected: 'Strawberries & Cream Syrup · Biscoff Filling · Ultimate Blueberry Muffin · Strawberry Jelly · Almond Croissant',
  },
  {
    id: 'cold-foam',
    priority: 5,
    title: 'Vanilla Cold Foam pulled in as \u201c30 items\u201d',
    severity: 'check',
    summary: 'Could mean 30 ml or 30 whole batches, and we can\u2019t tell which.',
    detail: 'Confirm it means 30 ml with whoever built the recipe, then set the unit to ml on each drink that uses it.',
  },
  {
    id: 'unit-families',
    priority: 6,
    title: '52 mini-recipe lines mix unit families',
    severity: 'tidy',
    summary: 'Almost all cosmetic and cost nothing. Clean up at the next menu review.',
    detail: 'Weight against volume, or volume against count. Nothing this week; tidying them stops the flag list crying wolf.',
  },
];

/** Batch-review rows per finding — each inline fix button seeds only its
 *  own finding's rows, so the review stays small and scannable. The
 *  brown-sauce row starts unticked because the kitchen has to confirm
 *  15 sachets isn't real first. Two rows are rigged to fail on apply so
 *  the partial-failure path is visible. */
const WRONG_CUP_WAS = {
  was: { name: 'Disp SOHO - 16oz Smoothie Cups', qty: '1', unit: 'each', cost: '£3.42' },
  note: 'No longer active and priced as a single cup, so the whole sleeve is charged to every drink',
};

const INTEGRITY_FIX_GROUPS: Record<string, BatchReviewRow[]> = {
  'wrong-cup': [
    // The root cause is the PRODUCT's setup, not any recipe — surfaced
    // first so the operator sees why, but unticked: the product is
    // suspended, so the audit's recommendation is the relinks below.
    { id: 'fix-cup-product', entity: 'Disp SOHO - 16oz Smoothie Cups', entityMeta: 'The root cause. It\u2019s no longer active, so relinking below is the better fix', confidence: 'low', impact: 'root cause', field: 'Pack quantity', before: '1', after: '50', product: { section: 'Product setup', fields: [
      { label: 'Supplier', value: 'Disposables Direct' },
      { label: 'Pack quantity', value: '50', flagged: { was: '1', note: 'A pack of 1 means the whole £3.42 sleeve is charged to every single drink' } },
      { label: 'Pack price', value: '£3.42' },
      { label: 'Status', value: 'Suspended' },
    ] } },
    { id: 'fix-cup-bsl', entity: 'Iced Brown Sugar Latte', confidence: 'high', impact: '−£3.35/drink', field: 'Relink to', before: 'Disp SOHO - 16oz Smoothie Cups', after: '16oz Smoothie Cups New', recipe: { section: 'Packaging', lines: [
      { name: 'Espresso — double shot', qty: '1', unit: 'each', cost: '£0.28' },
      { name: 'Oat Milk', qty: '200', unit: 'ml', cost: '£0.22' },
      { name: 'Brown Sugar Syrup', qty: '20', unit: 'ml', cost: '£0.11' },
      { name: '16oz Smoothie Cups New', qty: '1', unit: 'each', cost: '£0.07', flagged: WRONG_CUP_WAS },
      { name: 'Paper Straw', qty: '1', unit: 'each', cost: '£0.02' },
    ] } },
    { id: 'fix-cup-latte', entity: 'Iced Latte', confidence: 'high', impact: '−£3.35/drink', field: 'Relink to', before: 'Disp SOHO - 16oz Smoothie Cups', after: '16oz Smoothie Cups New', recipe: { section: 'Packaging', lines: [
      { name: 'Espresso — double shot', qty: '1', unit: 'each', cost: '£0.28' },
      { name: 'Whole Milk', qty: '200', unit: 'ml', cost: '£0.14' },
      { name: '16oz Smoothie Cups New', qty: '1', unit: 'each', cost: '£0.07', flagged: WRONG_CUP_WAS },
      { name: 'Sip Lid — clear', qty: '1', unit: 'each', cost: '£0.03' },
    ] } },
    { id: 'fix-cup-black', entity: 'Iced Long Black', confidence: 'high', impact: '−£3.35/drink', field: 'Relink to', before: 'Disp SOHO - 16oz Smoothie Cups', after: '16oz Smoothie Cups New', recipe: { section: 'Packaging', lines: [
      { name: 'Espresso — double shot', qty: '2', unit: 'each', cost: '£0.56' },
      { name: 'Filtered Water', qty: '150', unit: 'ml', cost: '—' },
      { name: '16oz Smoothie Cups New', qty: '1', unit: 'each', cost: '£0.07', flagged: WRONG_CUP_WAS },
    ] } },
    { id: 'fix-cup-smoothie', entity: 'Strawberry & Blueberry Smoothie', confidence: 'high', impact: '−£3.35/drink', field: 'Relink to', before: 'Disp SOHO - 16oz Smoothie Cups', after: '16oz Smoothie Cups New', recipe: { section: 'Packaging', lines: [
      { name: 'Strawberries — frozen', qty: '80', unit: 'gram', cost: '£0.44' },
      { name: 'Blueberries — frozen', qty: '60', unit: 'gram', cost: '£0.52' },
      { name: 'Banana', qty: '1', unit: 'each', cost: '£0.18' },
      { name: '16oz Smoothie Cups New', qty: '1', unit: 'each', cost: '£0.07', flagged: WRONG_CUP_WAS },
    ] } },
  ],
  'wrong-units': [
    { id: 'fix-unit-cucumber', entity: 'Club Sandwich', entityMeta: 'Cucumber line', confidence: 'high', impact: 'understated', field: 'Unit', before: '60 gram', after: '60 each', recipe: { section: 'Ingredients', lines: [
      { name: 'Toasted Bloomer', qty: '3', unit: 'slice', cost: '£0.24' },
      { name: 'Chicken Mayo', qty: '80', unit: 'gram', cost: '£0.62' },
      { name: 'Cucumber Diced', qty: '60', unit: 'each', flagged: { was: { name: 'Cucumber Diced', qty: '60', unit: 'gram' }, note: 'The product is priced per item — counted, not weighed' } },
      { name: 'Butter — unsalted', qty: '10', unit: 'gram', cost: '£0.08' },
    ] } },
    { id: 'fix-unit-mushrooms', entity: 'Big Breakfast', entityMeta: 'Mushroom line', confidence: 'high', impact: 'understated', field: 'Unit', before: '75 gram', after: '75 each', recipe: { section: 'Ingredients', lines: [
      { name: 'Free-Range Eggs', qty: '2', unit: 'each', cost: '£0.36' },
      { name: 'Cumberland Sausage', qty: '2', unit: 'each', cost: '£0.58' },
      { name: 'Add Mushrooms', qty: '75', unit: 'each', flagged: { was: { name: 'Add Mushrooms', qty: '75', unit: 'gram' }, note: 'The product is priced per item — counted, not weighed' } },
      { name: 'Baked Beans', qty: '120', unit: 'gram', cost: '£0.22' },
    ] } },
    { id: 'fix-unit-ketchup', entity: 'Bacon Roll', entityMeta: 'Ketchup line', confidence: 'high', impact: 'understated', field: 'Unit', before: '15 gram', after: '15 ml', recipe: { section: 'Ingredients', lines: [
      { name: 'Soft White Roll', qty: '1', unit: 'each', cost: '£0.32' },
      { name: 'Back Bacon', qty: '3', unit: 'rasher', cost: '£0.66' },
      { name: 'Ketchup', qty: '15', unit: 'ml', flagged: { was: { name: 'Ketchup', qty: '15', unit: 'gram' }, note: 'A liquid, priced by volume — gram lines are dropped or scaled wrongly' } },
    ] } },
    { id: 'fix-unit-cheese', entity: 'Jacket Potato — Cheese', entityMeta: 'Sauce line', confidence: 'high', impact: 'understated', field: 'Unit', before: '150 gram', after: '150 ml', recipe: { section: 'Ingredients', lines: [
      { name: 'Jacket Potato', qty: '1', unit: 'each', cost: '£0.35' },
      { name: 'Knorr Cheese Sauce', qty: '150', unit: 'ml', flagged: { was: { name: 'Knorr Cheese Sauce', qty: '150', unit: 'gram' }, note: 'A liquid, priced by volume — gram lines are dropped or scaled wrongly' } },
      { name: 'Chives — fresh', qty: '5', unit: 'gram', cost: '£0.04' },
    ] } },
    { id: 'fix-unit-cream', entity: 'Hot Chocolate', entityMeta: 'Cream line', confidence: 'high', impact: 'understated', field: 'Unit', before: '30 g', after: '30 ml', recipe: { section: 'Ingredients', lines: [
      { name: 'Whole Milk', qty: '250', unit: 'ml', cost: '£0.18' },
      { name: 'Chocolate Powder', qty: '28', unit: 'gram', cost: '£0.30' },
      { name: 'Whipped Cream', qty: '30', unit: 'ml', flagged: { was: { name: 'Whipped Cream', qty: '30', unit: 'g' }, note: 'A liquid, priced by volume — gram lines are dropped or scaled wrongly' } },
      { name: 'Mini Marshmallows', qty: '10', unit: 'gram', cost: '£0.09' },
    ] } },
    { id: 'fix-unit-honey', entity: 'Porridge', entityMeta: 'Honey line', confidence: 'medium', impact: 'line ignored', field: 'Unit', before: '—', after: 'gram', recipe: { section: 'Ingredients', lines: [
      { name: 'Rolled Oats', qty: '60', unit: 'gram', cost: '£0.14' },
      { name: 'Whole Milk', qty: '200', unit: 'ml', cost: '£0.14' },
      { name: 'Honey', qty: '15', unit: 'gram', flagged: { was: { name: 'Honey', qty: '15', unit: '(no unit)', cost: '£0.00' }, note: 'No unit set — the line is ignored and costs nothing today' } },
    ] } },
  ],
  'brown-sauce': [
    { id: 'fix-brown-sauce', entity: 'Jacket Potato & Beans', entityMeta: 'Same change on 3 more recipes', confidence: 'low', impact: '−£1.28/portion', field: 'Qty per portion', before: '15 sachets', after: '1 sachet', recipe: { section: 'Ingredients', lines: [
      { name: 'Jacket Potato', qty: '1', unit: 'each', cost: '£0.35' },
      { name: 'Baked Beans', qty: '120', unit: 'gram', cost: '£0.22' },
      { name: 'Brown Sauce', qty: '1', unit: 'sachet', cost: '£0.09', flagged: { was: { name: 'Brown Sauce', qty: '15', unit: 'sachets', cost: '£1.37' }, note: 'Norm everywhere else is 1 — confirm with the kitchen before applying' } },
    ] } },
  ],
};

/** Everything at once — the card-level "Fix all" path. */
const INTEGRITY_FIX_ROWS: BatchReviewRow[] = Object.values(INTEGRITY_FIX_GROUPS).flat();

/** Copy + blast radius for each fix flow: the user echo, Quinn's short
 *  intro, the batch card's title/subtitle, and the Impact summary stats
 *  (rule #3). Keyed by finding id, plus 'all'. */
const INTEGRITY_BATCH_META: Record<string, {
  echo: string;
  intro: string;
  title: string;
  subtitle: string;
  impact: Array<{ value: string; label: string }>;
}> = {
  'wrong-cup': {
    echo: 'Fix the cups',
    intro: 'The root cause is the **product\u2019s setup**: the cup is priced as a pack of 1, so the whole £3.42 sleeve is charged to every drink. That product is no longer active, so the better fix is relinking the four recipes. The product row is **unticked** in case you\u2019d rather correct it instead, and every value is editable.',
    title: 'Relink four iced drinks',
    subtitle: 'Off the old single-cup price, onto the pack of 50',
    impact: [
      { value: '4', label: 'recipes affected' },
      { value: '−£3.35', label: 'per drink, per sale' },
      { value: '7p', label: 'true cup cost (was £3.42)' },
    ],
  },
  'wrong-units': {
    echo: 'Fix the units',
    intro: 'Each line below shows the recipe it sits in and how it\u2019s measured today. **\u201cEach\u201d** for the counted items, **\u201cml\u201d** for the liquids, grams on the honey line. All editable before you apply.',
    title: 'Correct six units',
    subtitle: 'Counted items to \u201ceach\u201d, liquids to \u201cml\u201d, honey gets a unit',
    impact: [
      { value: '6', label: 'lines corrected here' },
      { value: '2', label: 'more in the 112-row audit' },
      { value: 'Low', label: 'these recipes read cheaper than real' },
    ],
  },
  'brown-sauce': {
    echo: 'Review the brown sauce',
    intro: 'Here\u2019s the line as it stands: **15 sachets a portion** against a norm of 1. It\u2019s unticked until the kitchen confirms; tick and apply once they do.',
    title: 'Brown sauce quantity',
    subtitle: 'Needs the kitchen\u2019s confirmation before applying',
    impact: [
      { value: '4', label: 'recipes affected' },
      { value: '£1.37', label: 'per portion today' },
      { value: '9p', label: 'after the fix' },
    ],
  },
  all: {
    echo: 'Fix everything for me',
    intro: 'Everything that moves your numbers in one list. Each row shows the recipe line as it reads today and the change we suggest, and every value is editable. The brown-sauce row is **unticked** until the kitchen confirms.',
    title: 'Soho recipe fixes',
    subtitle: 'Cup relinks and unit corrections. Brown sauce waits on the kitchen.',
    impact: [
      { value: '12', label: 'changes prepared' },
      { value: '9+', label: 'recipes touched' },
      { value: '−£3.35', label: 'biggest per-drink correction' },
    ],
  },
};

type ChatMsg = {
  id: string;
  role: 'user' | 'quinn';
  text: string;
  msgType?: string;
  /** When set on a user message, renders an attached-file chip inside
   *  the user bubble (small paperclip + filename pill). Used by the
   *  chat-driven "import product from sheet" flow so the conversation
   *  visibly carries the supplier sheet the operator attached. */
  attachmentName?: string;
  chartId?: string;
  tableQuery?: TableQuery;
  tableTitle?: string;
  /** For command cards — serialised args the card was opened with. */
  cmdArgsJson?: string;
  /** For ambiguity pickers — serialised candidate choices. */
  cmdChoicesJson?: string;
  /** Which command this message belongs to (for command cards / receipts). */
  cmdId?: string;
  /** When true, the Quinn text is revealed character-by-character on
   *  mount, with a blinking caret. Lets the bridge text between
   *  wizard steps feel like a real-time AI response rather than an
   *  instant insert. Self-completing — no further state to manage. */
  streaming?: boolean;
  /** Frozen card state baked into the message — used when a snapshot
   *  is restored from history and the runtime cmdStates map is empty.
   *  Live messages don't need this; the runner's state map wins. */
  cmdState?: 'pending' | 'confirmed' | 'cancelled';
  /** Frozen receipt payload (no undo closure) used the same way as
   *  `cmdState` — the receipt renderer falls back to this when the
   *  runtime ref doesn't have an entry. */
  cmdReceiptData?: {
    headline: string;
    detail?: string;
    href?: string;
    hrefLabel?: string;
  };
};

/** Message types whose interactive card renders in the right-hand
 *  workspace panel (Claude-artifacts style) when the chat surface is
 *  wide enough. Conversational bubbles, thinking placeholders,
 *  ambiguity pickers and receipts stay in the chat stream — only the
 *  "work surfaces" (wizard steps, import cards, charts, tables)
 *  migrate to the side. */
const WORKSPACE_MSG_TYPES = new Set<string>([
  'new-supplier-import',
  'product-sheet-import',
  'chagee-tea-supplier',
  'chagee-tea-recipe',
  'stock-review',
  'stock-sites',
  'storage-area',
  'pos-match-suggestions',
  'recipe-card',
  'yield-loss',
  'variable-ingredients',
  'cogs-target',
  'margin-explorer',
  'integrity-check',
  'integrity-batch-review',
  'packaging-picker',
  'allergen-check',
  'site-selection',
  'recipe-save-summary',
  'prod-prep',
  'prod-shelf',
  'prod-batch',
  'prod-category',
  'prod-summary',
  'analytics-chart',
  'table-result',
  'cmd-waste-card',
  'cmd-stock-card',
  'cmd-recipe-pick-recipe',
  'cmd-recipe-pick-action',
  'cmd-recipe-pick-ingredient',
  'cmd-recipe-new-ingredient',
  'cmd-recipe-summary',
  'cmd-prod-card',
  'cmd-menu-card',
  'cmd-supplier-card',
  'cmd-product-purpose',
  'cmd-product-new-info',
  'cmd-product-new-supplier',
  'cmd-product-pick-replaced',
  'cmd-product-pack-details',
  'cmd-product-sheet-details',
  'cmd-product-pick-recipes',
  'cmd-product-swap-summary',
  'cmd-site-pick',
  'cmd-site-copy',
  'cmd-site-team',
  'cmd-site-tiers',
  'cmd-site-production',
  'cmd-site-benches-hot',
  'cmd-site-golive',
  'cmd-rota-rebalance',
]);

/** Cards that need the full workspace width: the rota grid lays seven
 *  days across and does not read at 640px. */
const WIDE_WORKSPACE_MSG_TYPES = new Set<string>(['cmd-rota-rebalance']);

function isWorkspaceMsg(m: ChatMsg): boolean {
  return !!m.msgType && WORKSPACE_MSG_TYPES.has(m.msgType);
}

/** Labels for the in-stream Workspace pointer — the small marker left
 *  in the conversation when a module opens on the right, so history and
 *  narrow layouts stay coherent. Falls back to "Working on this". */
const WORKSPACE_POINTER_LABELS: Record<string, string> = {
  'integrity-check': 'Recipe & cost review',
  'integrity-batch-review': 'Reviewing prepared fixes',
  'pos-match-suggestions': 'Matching POS items',
  'product-sheet-import': 'Reviewing the product sheet',
  'new-supplier-import': 'Reviewing the supplier import',
  'recipe-card': 'Building the recipe',
  'yield-loss': 'Setting yield loss',
  'variable-ingredients': 'Adding variable ingredients',
  'cogs-target': 'Setting the cost target',
  'margin-explorer': 'Pricing per channel',
  'packaging-picker': 'Choosing packaging',
  'allergen-check': 'Checking allergens',
  'site-selection': 'Choosing sites',
  'recipe-save-summary': 'Reviewing before save',
  'storage-area': 'Updating storage areas',
  'stock-review': 'Reviewing stock takes',
  'stock-sites': 'Choosing stock sites',
  'chagee-tea-supplier': 'Adding the supplier & product',
  'chagee-tea-recipe': 'Updating the recipe',
  'analytics-chart': 'Charting your data',
  'table-result': 'Building the table',
  'cmd-site-pick': 'Choosing the sites',
  'cmd-site-copy': 'Copying a shop setup',
  'cmd-site-team': 'Loading the people',
  'cmd-site-tiers': 'Setting ranges & tiers',
  'cmd-site-production': 'Setting production times',
  'cmd-site-benches-hot': 'Setting hot production',
  'cmd-site-golive': 'Check and go live',
  'cmd-rota-rebalance': 'Rebalancing the rota',
};

/** Working-state row for the in-Feed wizard. Mirrors
 *  `TemplateIngredient` but allows qty to be edited as a string
 *  (so the editor doesn't clamp the user's keystrokes). */
type RecipeIngredient = {
  id: string;
  name: string;
  qty: string;
  uom: string;
  unitCostP: number;
  source: string;
  toTaste?: boolean;
  /** Yield loss % (0–99), mirroring web-v2's per-ingredient field.
   *  The qty stays net (what lands on the plate); costing grosses
   *  it up by 1/(1−loss). */
  yieldLossPct?: string;
};

/** A variable ingredient captured in the wizard — mirrors web-v2's
 *  model: EXTRA layers on top of the base build when picked;
 *  REPLACEMENT swaps out one base ingredient. No own price, no
 *  channel flags, no min/max — those don't exist in production. */
type VariableIngredientRow = {
  id: string;
  type: 'Extra' | 'Replacement';
  /** Base-ingredient id this row replaces (Replacement only). */
  replacesId?: string;
  replacesName?: string;
  name: string;
  qty: string;
  uom: string;
  yieldLossPct?: string;
};

/** Per-channel flags on a packaging row — matches web-v2's
 *  `dineIn` / `takeAway` / `delivery` booleans. Each channel's
 *  price includes only the packaging flagged for it. */
type PackagingChannels = { dineIn: boolean; takeaway: boolean; delivery: boolean };

const DEFAULT_PACKAGING_CHANNELS: PackagingChannels = { dineIn: false, takeaway: true, delivery: true };

/** Working packaging row in the wizard. The template's rows arrive
 *  as AI suggestions (name + qty pre-filled); the operator can edit
 *  qty and unit, and add more from the packaging catalogue. */
type PackagingRow = {
  id: string;
  name: string;
  /** £ per unit. */
  cost: number;
  unit: string;
  qty: string;
  aiSuggested?: boolean;
};

/** Web-v2's packaging unit list, trimmed to the prototype's casing. */
const PACKAGING_UOM_OPTIONS = ['ea', 'sheet', 'pack', 'box', 'bag', 'roll', 'sleeve'];

function packagingUomOptions(unit: string): string[] {
  return PACKAGING_UOM_OPTIONS.includes(unit) ? PACKAGING_UOM_OPTIONS : [unit, ...PACKAGING_UOM_OPTIONS];
}

/** £ per serve for one packaging row — qty × unit cost. */
function packagingLineGBP(row: PackagingRow): number {
  return (Number(row.qty) || 0) * row.cost;
}

/** Compatible-unit pairs for the UoM select on the ingredient card.
 *  Metric pairs convert (qty and unit cost together, so the line
 *  cost never moves); count-style units stay fixed. */
function uomOptionsFor(uom: string): string[] {
  switch (uom) {
    case 'g': case 'kg': return ['g', 'kg'];
    case 'ml': case 'L': return ['ml', 'L'];
    default: return [uom];
  }
}

/** g↔kg and ml↔L conversion applied to a working row when the UoM
 *  select changes. Qty scales down and unit cost scales up (or vice
 *  versa) so the line cost is identical either way. */
function convertRowUom(row: RecipeIngredient, nextUom: string): RecipeIngredient {
  if (row.uom === nextUom) return row;
  const up = (row.uom === 'g' && nextUom === 'kg') || (row.uom === 'ml' && nextUom === 'L');
  const down = (row.uom === 'kg' && nextUom === 'g') || (row.uom === 'L' && nextUom === 'ml');
  if (!up && !down) return { ...row, uom: nextUom };
  const factor = up ? 1000 : 1 / 1000;
  const qtyNum = Number(row.qty);
  return {
    ...row,
    uom: nextUom,
    qty: Number.isFinite(qtyNum) ? String(Number((qtyNum / factor).toFixed(4))) : row.qty,
    unitCostP: row.unitCostP * factor,
  };
}

/** Empty seed — the actual rows are pushed by `startRecipeFlow`
 *  once we know which template the user is building. */
const INITIAL_RECIPE_INGREDIENTS: RecipeIngredient[] = [];

/** Compute a per-uom cost (in pence) for an ingredient ref the
 *  operator picked from the catalogue. Priority order:
 *    1. Supplier product → packCost ÷ (packQty × singleUnitVolumeOrWeight).
 *    2. Master product   → the maintained weighted-average cost (WAC) when a
 *                          delivery has been recorded; otherwise the cheapest
 *                          linked supplier product.
 *    3. Sub-recipe       → no cost on file in the prototype; return 0.
 *  Returns whole-pence (rounded) for parity with TemplateIngredient. */
function perUomCostP(
  ref: IngredientRef,
  resolved: ResolvedIngredient,
  allProducts: Product[],
): number {
  function fromProduct(p: Product): number {
    const sizePerUnit = p.singleUnitVolumeOrWeight || 1;
    const totalUnits = p.packQty * sizePerUnit;
    if (totalUnits <= 0) return 0;
    return Math.round((p.packCost / totalUnits) * 100);
  }
  if (ref.kind === 'product' && resolved.product) {
    return fromProduct(resolved.product);
  }
  if (ref.kind === 'master') {
    // Prefer the master's blended weighted-average cost once real deliveries
    // have landed — this is what keeps COGS in step with what was actually paid.
    const wac = resolved.master ? masterCompanyAvg(resolved.master) : null;
    if (wac != null && wac > 0) return Math.round(wac * 100);
    const linked = allProducts.filter((p) => p.masterProductId === ref.masterProductId);
    if (!linked.length) return 0;
    const costs = linked.map(fromProduct).filter((c) => c > 0);
    if (!costs.length) return 0;
    return Math.min(...costs);
  }
  return 0;
}

/** Short label for the kind-chip in the typeahead dropdown. */
function kindBadgeLabel(kind: IngredientCatalogueRow['kind']): string {
  switch (kind) {
    case 'master': return 'Master';
    case 'supplier': return 'Supplier';
    case 'made': return 'Made';
    case 'subrecipe': return 'Sub-recipe';
  }
}

function kindBadgeColor(kind: IngredientCatalogueRow['kind']): { bg: string; fg: string } {
  switch (kind) {
    case 'master':
      return { bg: 'rgba(40,175,201,0.14)', fg: 'var(--color-accent-active)' };
    case 'supplier':
      return { bg: 'rgba(0,28,53,0.08)', fg: 'var(--color-text-secondary)' };
    case 'made':
      return { bg: 'rgba(34,68,68,0.12)', fg: 'var(--color-text-primary)' };
    case 'subrecipe':
      return { bg: 'rgba(231,184,0,0.18)', fg: '#8a6900' };
  }
}

const RECIPE_GREETING =
  "Let's build this recipe. Send a photo, voice note me, or describe it here, even just the dish name, and I'll draft the ingredients. Or build it yourself in the workspace on the left.";
const RECIPE_ASK_MSG =
  "Sure — what kind of recipe would you like to update? Type the dish and I\u2019ll pull it up.";
const RECIPE_COST_MSG =
  "Here's the price per channel at your target. Tap a different % to see how the prices move:";
const RECIPE_COGS_TARGET_MSG =
  "What's the **target food cost %** you want to aim for? 25% is a typical brunch-item target.";
const RECIPE_YIELD_LOSS_MSG =
  "Do any of these ingredients have **yield loss** — trim, peel or cooking loss? Set a % where it applies, or skip if everything is used as bought.";
const RECIPE_VARIABLE_MSG =
  "Any **variable ingredients**? These are extras the customer can add, or swaps for a base ingredient — like adding halloumi or switching the bread.";
const RECIPE_PRODUCTION_OFFER_MSG =
  "Want to set the **production settings** now — prep time, shelf life, batch sizes? You can also do this later from the recipe page.";

function buildRecipeCardIntro(template: RecipeWizardTemplate): string {
  return `Great — here's a starting build for **${template.name}**. Adjust the quantities and units to match your serve; we'll cover yield loss, options and packaging before I price it.`;
}

function buildPackagingMsg(template: RecipeWizardTemplate): string {
  return `Which packaging does ${template.name.toLowerCase()} leave the pass in? I've suggested the likely items with quantities — adjust qty and unit, set the channels, and search below to add anything I've missed. Takeaway packaging changes the takeaway price:`;
}

function buildSitesMsg(template: RecipeWizardTemplate): string {
  return (
    `Almost there! I've put this under the **${template.productClass}** product class.\n\n` +
    `Which sites should this recipe be available at?`
  );
}

const RECIPE_ALLERGEN_MSG =
  "I've detected the following allergens based on the ingredients. Please review and confirm — you can add or remove any that apply:";

const ALL_ALLERGENS = [
  'Mustard', 'Peanuts', 'Crustaceans', 'Fish', 'Nuts', 'Cereals containing gluten',
  'Molluscs', 'Sesame Seeds', 'Celery', 'Lupin', 'Soya', 'Sulphites', 'Eggs', 'Dairy',
];

type Site = { id: string; name: string };

const MOCK_SITES: Site[] = [
  { id: 'fitzroy', name: 'Fitzroy Espresso' },
  { id: 'city', name: 'City Centre' },
  { id: 'south-yarra', name: 'South Yarra' },
  { id: 'richmond', name: 'Richmond' },
  { id: 'airport', name: 'Airport Lounge' },
];

/** Everything the margin-explorer lock captures, so the save summary
 *  and the persisted recipe carry the full channel economics rather
 *  than just the dine-in headline. */
type LockedPricing = {
  /** Dine-in SRP ex VAT at the target %. */
  srpExVat: number;
  targetCogsPct: number;
  /** Ingredient cost per serve in £ at lock time (ex packaging). */
  foodCostGBP: number;
  /** VAT % applied to the dine-in / takeaway channels. */
  vatPct: number;
  /** Per-channel ex-VAT SRPs — each channel's cost includes only
   *  the packaging flagged for that channel, so they can differ. */
  takeawayExVat: number;
  deliveryExVat: number;
  dineInIncVat: number;
  takeawayIncVat: number;
  deliveryIncVat: number;
  deliveryNetGBP: number;
};

function buildDoneMsg(
  recipeName: string,
  template: RecipeWizardTemplate,
  siteNames: string[],
  pricing: LockedPricing | null,
  supplierLinked: boolean,
  productionConfigured: boolean,
  stocktakeReconciled: boolean,
): string {
  const sitesStr = siteNames.length === 1
    ? `**${siteNames[0]}**`
    : siteNames.slice(0, -1).map(s => `**${s}**`).join(', ') + ` and **${siteNames[siteNames.length - 1]}**`;
  const pricingLine = pricing
    ? `Locked in at **\u00a3${pricing.srpExVat.toFixed(2)} dine in** — that's a **${pricing.targetCogsPct}% food cost**.\n\n`
    : '';
  const supplierLine = supplierLinked ? `${template.supplierAddedFragment}\n\n` : '';
  const productionTail = productionConfigured
    ? 'production settings included.'
    : 'You can add production settings from the recipe page whenever you need them.';
  // Only rendered when the walkthrough overrode an explicit untick of
  // count-in-stocktake: a changed user choice is always stated, with
  // the route to reverse it. The common path never mentions the flag.
  const stocktakeLine = stocktakeReconciled
    ? `\n\nOne thing I changed: **count in stocktake** is back on, because items on the production plan are tracked as stock. If this recipe shouldn't be, untick it on the recipe page.`
    : '';
  return (
    `**Done!** ${supplierLine}` +
    pricingLine +
    `Your **${recipeName}** recipe is live in Edify under the **${template.productClass}** class, assigned to ${sitesStr}. You'll find it under Recipes \u2192 ${template.productClass}${productionConfigured ? ', ' : '. '}${productionTail}${stocktakeLine}`
  );
}

/** Convert a template row to the wizard's mutable working row. */
function templateRowToRecipeIngredient(t: TemplateIngredient): RecipeIngredient {
  return {
    id: t.id,
    name: t.name,
    qty: String(t.qty),
    uom: t.uom,
    unitCostP: t.unitCostP,
    source: t.source,
    toTaste: t.toTaste,
  };
}

/** Convert wizard working rows back to the template-shape rows
 *  the pricing step consumes. Non-numeric qty entries fall back
 *  to 0 so the cost rollup degrades gracefully. Yield loss
 *  grosses up the unit cost (you pay for what you prep, not what
 *  lands on the plate) while the displayed qty stays net — the
 *  same net-in, gross-costed model web-v2 uses. */
function recipeIngredientsToTemplateRows(rows: RecipeIngredient[]): TemplateIngredient[] {
  return rows.map((r) => {
    const loss = Math.min(99, Math.max(0, Number(r.yieldLossPct) || 0));
    return {
      id: r.id,
      name: r.name,
      qty: Number(r.qty) || 0,
      uom: r.uom,
      unitCostP: loss > 0 ? r.unitCostP / (1 - loss / 100) : r.unitCostP,
      source: r.source,
      toTaste: r.toTaste,
    };
  });
}

/** "chicken caesar wrap" → "Chicken Caesar Wrap" for the recipe name
 *  when no template matched the typed dish. */
function titleCaseDishName(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** "5 min" → 300 seconds. Unparseable values fall back to null. */
function prepTimeToSeconds(label: string): number | null {
  const m = /(\d+)/.exec(label);
  return m ? Number(m[1]) * 60 : null;
}

/** "30 min" / "2 hours" / "End of day" → minutes for the recipe's
 *  production block. End of day approximates to a 12-hour service. */
function shelfLifeToMinutes(label: string): number | null {
  if (/end of day/i.test(label)) return 720;
  const m = /(\d+)\s*(min|hour)/i.exec(label);
  if (!m) return null;
  const n = Number(m[1]);
  return /hour/i.test(m[2]) ? n * 60 : n;
}

/** Production-category pill → the recipe library's category enum. */
function prodCategoryToRecipeCategory(label: string): Recipe['category'] {
  switch (label) {
    case 'Sandwiches & Wraps': return 'Sandwich';
    case 'Salads': return 'Salad';
    case 'Snacks': return 'Snack';
    case 'Cold Food':
    case 'Hot Food':
    default:
      return 'Food';
  }
}

// ─── Production flow constants ───────────────────────────────────────────────

function buildProdPrepMsg(recipeName: string): string {
  return (
    `Before I save **${recipeName}**, I need its production settings \u2014 the production planner relies on them, so I can't skip this bit. ` +
    `I've filled in sensible defaults; confirm or adjust each one. First up: what's the prep time per unit?`
  );
}
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

/** Tier-three recipe settings from the conversational contract:
 *  offered on the card behind one tap, never forced. Mirrors the
 *  production profile section's Type + Inventory & Costing pills. */
type RecipeCardSettings = {
  subRecipe: boolean;
  countInStockTake: boolean;
  excludeFromCogs: boolean;
};

const DEFAULT_RECIPE_CARD_SETTINGS: RecipeCardSettings = {
  subRecipe: false,
  countInStockTake: true,
  excludeFromCogs: false,
};

/** One setting with its explanation always visible — these flags are
 *  accounting jargon to most operators, so a hover-only hint isn't
 *  enough. */
function RecipeCardSettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: 'var(--color-accent-active, #001C35)', marginTop: '2px', flexShrink: 0 }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {label}
        </span>
        <span style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px', lineHeight: 1.45 }}>
          {description}
        </span>
      </span>
    </label>
  );
}

function RecipeCardEditor({
  recipeName,
  onNameChange,
  servesQty,
  onServesChange,
  servesUom,
  ingredients,
  onChange,
  onUomChange,
  onAdd,
  onRemove,
  onStartNewProduct,
  settings,
  onSettingsChange,
}: {
  recipeName: string;
  /** Name and yield are asked, not assumed — both editable in the
   *  header. Yield especially: it divides into every per-portion
   *  number downstream, so it is kitchen knowledge the flow must
   *  collect rather than a template default it displays. */
  onNameChange: (name: string) => void;
  servesQty: string;
  onServesChange: (qty: string) => void;
  servesUom: string;
  ingredients: RecipeIngredient[];
  onChange: (idx: number, qty: string) => void;
  /** UoM select per row — metric pairs (g↔kg, ml↔L) convert qty and
   *  unit cost together so the line cost is unchanged. */
  onUomChange: (idx: number, uom: string) => void;
  onAdd: (row: RecipeIngredient) => void;
  onRemove: (id: string) => void;
  /** Called when the operator wants to add a product that doesn't yet
   *  exist in the catalogue. We route them to the existing new-product
   *  wizard rather than letting them type a name + cost free-form, so
   *  the new SKU is created against suppliers/MPs properly. */
  onStartNewProduct: (query: string) => void;
  /** Sub-recipe / stocktake / COGS flags — tier three, so they sit
   *  behind a collapsed expander with defaults stated. */
  settings: RecipeCardSettings;
  onSettingsChange: (patch: Partial<RecipeCardSettings>) => void;
}) {
  const { search: searchCatalogue, resolveRef } = useIngredientCatalogue();
  const allProducts = useProducts();

  const [draftName, setDraftName] = useState('');
  const [draftQty, setDraftQty] = useState('');
  /** Set once the user picks a row from the typeahead. Carries the
   *  resolved name, uom, source kind and (if known) the per-uom cost. */
  const [pickedRef, setPickedRef] = useState<IngredientRef | null>(null);
  const [pickedMeta, setPickedMeta] = useState<{
    name: string;
    uom: string;
    unitCostP: number;
    sourceLabel: string;
    kindLabel: string;
  } | null>(null);
  /** Hide the dropdown after a pick OR after `Escape`; reopens when
   *  the user edits the search input again. */
  const [searchFocused, setSearchFocused] = useState(false);
  /** Recipe-settings expander, collapsed by default: the flags are
   *  offered, not asked, and the defaults suit most recipes. */
  const [settingsOpen, setSettingsOpen] = useState(false);

  const trimmedQuery = draftName.trim();
  const showDropdown = !pickedRef && searchFocused && trimmedQuery.length > 0;
  const matches = showDropdown ? searchCatalogue(trimmedQuery, { limit: 6 }) : [];

  const canAdd = !!pickedMeta && Number(draftQty) > 0;

  function clearPick() {
    setPickedRef(null);
    setPickedMeta(null);
    setDraftName('');
  }

  function pickRow(row: IngredientCatalogueRow) {
    const resolved = resolveRef(row.ref);
    if (!resolved) return;
    const cost = perUomCostP(row.ref, resolved, allProducts);
    const uom = resolved.unit || row.sublabel || 'each';
    setPickedRef(row.ref);
    setPickedMeta({
      name: resolved.name,
      uom,
      unitCostP: cost,
      sourceLabel: row.sourceLabel ?? '',
      kindLabel: kindBadgeLabel(row.kind),
    });
    setDraftName(resolved.name);
    setSearchFocused(false);
  }

  function commitAdd() {
    if (!canAdd || !pickedMeta) return;
    onAdd({
      // `user-` prefix so the wizard can distinguish operator-added
      // rows from template seed rows (e.g. for swap suggestions,
      // remove affordances, downstream copy).
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: pickedMeta.name,
      qty: draftQty,
      uom: pickedMeta.uom,
      unitCostP: pickedMeta.unitCostP,
      source: pickedMeta.sourceLabel || 'Added in chat',
    });
    setDraftName('');
    setDraftQty('');
    setPickedRef(null);
    setPickedMeta(null);
    setSearchFocused(false);
  }

  return (
    <div style={{
      marginTop: '8px',
      position: 'relative',
    }}>
    <div style={{
      borderRadius: '10px',
      border: '1px solid var(--color-border-subtle)',
      overflow: 'hidden',
      background: '#fff',
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
        <input
          type="text"
          value={recipeName}
          onChange={(e) => onNameChange(e.target.value)}
          aria-label="Recipe name"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '4px 8px',
            borderRadius: '6px',
            border: '1px solid transparent',
            fontSize: '13px',
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
            background: 'transparent',
            outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.border = '1px solid var(--color-border-subtle)'; e.currentTarget.style.background = '#fff'; }}
          onBlur={(e) => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.background = 'transparent'; }}
        />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>Serves</span>
          <input
            type="text"
            inputMode="numeric"
            value={servesQty}
            onChange={(e) => onServesChange(e.target.value)}
            aria-label="Yield (serves)"
            style={{
              width: '36px',
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
          {servesUom !== 'each' && (
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>{servesUom}</span>
          )}
        </span>
      </div>

      {ingredients.map((ing, i) => {
        const loss = Math.min(99, Math.max(0, Number(ing.yieldLossPct) || 0));
        const grossUnitCostP = loss > 0 ? ing.unitCostP / (1 - loss / 100) : ing.unitCostP;
        const lineGBP = ((Number(ing.qty) || 0) * grossUnitCostP) / 100;
        return (
        <div
          key={ing.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 48px 52px 56px 22px',
            alignItems: 'center',
            padding: '8px 14px',
            borderBottom: '1px solid var(--color-border-subtle)',
            fontSize: '13px',
            gap: '6px',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--color-text-secondary)' }}>{ing.name}</div>
            <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
              {ing.source}
            </div>
          </div>
          {ing.toTaste ? (
            <span style={{ gridColumn: '2 / 4', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', textAlign: 'right' }}>to taste</span>
          ) : (
            <>
              <input
                type="text"
                value={ing.qty}
                onChange={(e) => onChange(i, e.target.value)}
                aria-label={`Quantity for ${ing.name}`}
                style={{
                  width: '100%',
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
                  boxSizing: 'border-box',
                }}
              />
              {/* Always a select — single-unit rows just have one
                  option — so the columns line up row to row. */}
              <select
                value={ing.uom}
                disabled={uomOptionsFor(ing.uom).length < 2}
                onChange={(e) => onUomChange(i, e.target.value)}
                aria-label={`Unit for ${ing.name}`}
                style={{
                  width: '100%',
                  padding: '4px 2px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: '12px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--color-text-secondary)',
                  background: '#fff',
                  outline: 'none',
                  cursor: uomOptionsFor(ing.uom).length > 1 ? 'pointer' : 'default',
                  boxSizing: 'border-box',
                }}
              >
                {uomOptionsFor(ing.uom).map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </>
          )}
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'right' }}>
            £{lineGBP.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={() => onRemove(ing.id)}
            aria-label={`Remove ${ing.name}`}
            title="Remove"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '22px',
              height: '22px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(0,28,53,0.06)';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
            }}
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>
        );
      })}

      {/* Live food cost — updates as quantities, units and rows
          change, so the price is visible from the first card. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '9px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'rgba(0, 28, 53, 0.02)',
        }}
      >
        <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Food cost / serve
        </span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginRight: '28px' }}>
          £{(ingredients.reduce((s, ing) => {
            const loss = Math.min(99, Math.max(0, Number(ing.yieldLossPct) || 0));
            const gross = loss > 0 ? ing.unitCostP / (1 - loss / 100) : ing.unitCostP;
            return s + (Number(ing.qty) || 0) * gross;
          }, 0) / 100).toFixed(2)}
        </span>
      </div>

      {/* Add-ingredient row — always visible at the bottom so the
          operator can extend the template without flipping a mode.
          Typing here surfaces a typeahead over masters / supplier
          products / sub-recipes; the cost comes from whichever entity
          they pick. If nothing matches they fall through to a "+ Add
          as new product" row that launches the full new-product
          wizard via the parent's onStartNewProduct callback. */}
      <div
        style={{
          padding: '8px 14px',
          background: 'rgba(0,28,53,0.02)',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: pickedMeta ? '1fr 60px 56px 28px' : '1fr 60px 28px',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {pickedMeta ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 8px',
                borderRadius: '8px',
                border: '1px solid var(--color-border-subtle)',
                background: '#fff',
                minWidth: 0,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pickedMeta.name}
                </div>
                <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
                  {pickedMeta.sourceLabel}
                  {pickedMeta.unitCostP > 0
                    ? ` · ${penceToPounds(pickedMeta.unitCostP)}/${pickedMeta.uom}`
                    : ' · no cost on file'}
                </div>
              </div>
              <button
                type="button"
                onClick={clearPick}
                aria-label="Change ingredient"
                title="Change"
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <X size={12} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={draftName}
              onChange={(e) => { setDraftName(e.target.value); setSearchFocused(true); }}
              onFocus={() => setSearchFocused(true)}
              // We don't close on blur — clicking a dropdown row would
              // otherwise race with the blur and the pick would never
              // fire. Closing is handled by row click / Escape / pick.
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchFocused(false);
                if (e.key === 'Enter' && matches.length > 0) {
                  e.preventDefault();
                  pickRow(matches[0]);
                }
              }}
              placeholder="Add ingredient — search products…"
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid var(--color-border-subtle)',
                fontSize: '12px',
                fontWeight: 500,
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-primary)',
                background: '#fff',
                outline: 'none',
                minWidth: 0,
              }}
            />
          )}
          <input
            type="text"
            inputMode="decimal"
            value={draftQty}
            onChange={(e) => setDraftQty(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canAdd) commitAdd(); }}
            placeholder="qty"
            disabled={!pickedMeta}
            style={{
              padding: '6px 6px',
              borderRadius: '6px',
              border: '1px solid var(--color-border-subtle)',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: pickedMeta ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              background: pickedMeta ? '#fff' : 'rgba(0,28,53,0.03)',
              outline: 'none',
              textAlign: 'right',
            }}
          />
          {pickedMeta && (
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                textAlign: 'center',
              }}
            >
              {pickedMeta.uom}
            </span>
          )}
          <button
            type="button"
            onClick={commitAdd}
            disabled={!canAdd}
            aria-label="Add ingredient"
            title={canAdd ? `Add ${pickedMeta?.name ?? 'ingredient'}` : 'Pick a product and enter a quantity'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '26px',
              height: '26px',
              borderRadius: '8px',
              border: 'none',
              background: canAdd ? 'var(--color-accent-active)' : 'rgba(0,28,53,0.08)',
              color: canAdd ? '#fff' : 'var(--color-text-muted)',
              cursor: canAdd ? 'pointer' : 'not-allowed',
              padding: 0,
              boxShadow: canAdd ? '0 1px 4px rgba(34,68,68,0.25)' : 'none',
            }}
          >
            <Plus size={14} strokeWidth={2.2} />
          </button>
        </div>

      </div>

      {/* Recipe settings — the three tier-three flags production keeps
          on the recipe profile (Sub-Recipe under Type; Count in
          Stocktake and Exclude from COGS under Inventory & Costing).
          Collapsed by default; when a flag differs from its default
          the collapsed row names it so nothing hides. */}
      <div style={{ borderTop: '1px solid var(--color-border-subtle)', background: '#fff' }}>
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          aria-expanded={settingsOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            width: '100%',
            padding: '9px 14px',
            border: 'none',
            background: 'transparent',
            fontSize: '10.5px',
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            textAlign: 'left',
          }}
        >
          {settingsOpen ? <ChevronDown size={12} strokeWidth={2.4} /> : <ChevronRight size={12} strokeWidth={2.4} />}
          {(() => {
            const changed = [
              settings.subRecipe ? 'sub-recipe' : null,
              !settings.countInStockTake ? 'not counted in stocktake' : null,
              settings.excludeFromCogs ? 'excluded from COGS' : null,
            ].filter(Boolean);
            return changed.length > 0
              ? `Recipe settings · ${changed.join(', ')}`
              : 'Recipe settings · sub-recipe, stocktake, COGS';
          })()}
        </button>
        {settingsOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '2px 14px 12px' }}>
            <RecipeCardSettingRow
              label="Sub-recipe"
              description="Used inside other recipes, like a sauce or a base mix, rather than sold on its own."
              checked={settings.subRecipe}
              onChange={(v) => onSettingsChange({ subRecipe: v })}
            />
            <RecipeCardSettingRow
              label="Count in stocktake"
              description="The team counts this recipe when they do a stocktake. Turn off for made-to-order items that never sit on a shelf."
              checked={settings.countInStockTake}
              onChange={(v) => onSettingsChange({ countInStockTake: v })}
            />
            <RecipeCardSettingRow
              label="Exclude from COGS"
              description="Leaves this recipe's cost out of cost-of-goods reporting. For staff meals, comps, and items whose cost is already counted in a parent recipe."
              checked={settings.excludeFromCogs}
              onChange={(v) => onSettingsChange({ excludeFromCogs: v })}
            />
          </div>
        )}
      </div>
    </div>
    {/* Dropdown sits OUTSIDE the rounded/clipped editor wrapper so it
        isn't clipped by `overflow: hidden`; it's anchored to the
        outer relative wrapper and floats below the card. */}
    {showDropdown && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% - 4px)',
              left: '14px',
              right: '14px',
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,28,53,0.12)',
              zIndex: 10,
              overflow: 'hidden',
              maxHeight: '240px',
              overflowY: 'auto',
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {matches.length === 0 && (
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                }}
              >
                No matches in your products.
              </div>
            )}
            {matches.map((row) => {
              const colors = kindBadgeColor(row.kind);
              return (
                <button
                  key={`${row.kind}-${row.ref.kind === 'master' ? row.ref.masterProductId : row.ref.kind === 'product' ? row.ref.productId : row.ref.recipeId}`}
                  type="button"
                  onClick={() => pickRow(row)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '7px 12px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,28,53,0.04)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: colors.bg,
                      color: colors.fg,
                      flexShrink: 0,
                    }}
                  >
                    {kindBadgeLabel(row.kind)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {row.label}
                    </div>
                    <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                      {[row.sourceLabel, row.sublabel].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                onStartNewProduct(trimmedQuery);
                setSearchFocused(false);
                setDraftName('');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                borderTop: matches.length > 0 ? '1px solid var(--color-border-subtle)' : 'none',
                background: 'rgba(40,175,201,0.06)',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(40,175,201,0.12)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(40,175,201,0.06)'; }}
            >
              <Plus size={14} strokeWidth={2.2} color="var(--color-accent-active)" />
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-accent-active)' }}>
                Add &ldquo;{trimmedQuery}&rdquo; as a new product
              </span>
            </button>
          </div>
        )}
    </div>
  );
}

/** Quick "what's your target food-cost %?" picker shown before
 *  the Margin Explorer. Preset pills + a custom input so an
 *  operator can land on a number they have in mind from the brief. */
function CogsTargetPicker({
  value,
  onChange,
  onConfirm,
  disabled,
}: {
  value: number;
  onChange: (pct: number) => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const presets = [20, 25, 30, 35];
  return (
    <CardShell
      icon={Target}
      title="Target food cost %"
      state={disabled ? 'confirmed' : 'pending'}
      confirmLabel={`Use ${value}% target`}
      onConfirm={onConfirm}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {presets.map((pct) => {
          const active = pct === value;
          return (
            <button
              key={pct}
              type="button"
              disabled={disabled}
              onClick={() => onChange(pct)}
              style={{
                padding: '6px 14px',
                borderRadius: '100px',
                border: active
                  ? '1.5px solid var(--color-accent-active)'
                  : '1.5px solid var(--color-border)',
                background: active ? 'var(--color-accent-active)' : '#fff',
                color: active ? '#fff' : 'var(--color-text-secondary)',
                fontSize: '12.5px',
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {pct}%
            </button>
          );
        })}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '100px',
            border: presets.includes(value)
              ? '1.5px solid var(--color-border)'
              : '1.5px solid var(--color-accent-active)',
            background: '#fff',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            Custom
          </span>
          <input
            type="number"
            min={5}
            max={95}
            step={1}
            value={value}
            disabled={disabled}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              onChange(Math.max(5, Math.min(95, Math.round(next))));
            }}
            style={{
              width: '40px',
              border: 'none',
              outline: 'none',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-primary)',
              textAlign: 'right',
              background: 'transparent',
            }}
          />
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>%</span>
        </div>
      </div>
    </CardShell>
  );
}

/** Post-ingredient step: per-ingredient yield loss %. Mirrors
 *  web-v2's field (net qty in, gross qty costed) — the wizard asks
 *  once, here, rather than burying an input on every row. */
function YieldLossCard({ ingredients, values, onChange, onConfirm, onSkip, state }: {
  ingredients: RecipeIngredient[];
  values: Record<string, string>;
  onChange: (id: string, v: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
  state: CardState;
}) {
  const disabled = state !== 'pending';
  const rows = ingredients.filter((i) => !i.toTaste);
  const anySet = rows.some((r) => (Number(values[r.id]) || 0) > 0);
  return (
    <CardShell
      icon={ChefHat}
      title="Yield loss"
      subtitle="Trim, peel or cooking loss — the cost grosses up to what you actually prep"
      state={state}
      confirmLabel="Apply yield loss"
      confirmDisabled={!anySet}
      cancelLabel="No yield loss"
      onConfirm={onConfirm}
      onCancel={onSkip}
    >
      <div style={{ margin: '-12px', borderRadius: 0 }}>
        {rows.map((ing, i) => (
          <div
            key={ing.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 14px',
              gap: '10px',
              borderBottom: i < rows.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              fontSize: '13px',
            }}
          >
            <span style={{ flex: 1, color: 'var(--color-text-secondary)', minWidth: 0 }}>{ing.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                min={0}
                max={99}
                value={values[ing.id] ?? ''}
                disabled={disabled}
                placeholder="0"
                onChange={(e) => onChange(ing.id, e.target.value)}
                aria-label={`Yield loss % for ${ing.name}`}
                style={{
                  width: '52px',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  textAlign: 'right',
                  color: 'var(--color-text-primary)',
                  background: disabled ? 'rgba(0,28,53,0.03)' : '#fff',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>%</span>
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

const VARIABLE_UOM_OPTIONS = ['g', 'kg', 'ml', 'L', 'pc', 'each', 'slice'];

/** Variable-ingredients step — the web-v2 model: an Extra layers on
 *  top of the base build; a Replacement swaps a named base
 *  ingredient. Qty, UoM and yield loss per row; no own price, no
 *  channel flags (neither exists in production). */
function VariableIngredientsCard({ baseIngredients, rows, onAdd, onRemove, onConfirm, onSkip, state }: {
  baseIngredients: RecipeIngredient[];
  rows: VariableIngredientRow[];
  onAdd: (row: VariableIngredientRow) => void;
  onRemove: (id: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
  state: CardState;
}) {
  const disabled = state !== 'pending';
  const [draftType, setDraftType] = useState<'Extra' | 'Replacement'>('Extra');
  const [draftReplacesId, setDraftReplacesId] = useState<string>('');
  const [draftName, setDraftName] = useState('');
  const [draftQty, setDraftQty] = useState('');
  const [draftUom, setDraftUom] = useState('g');
  const [draftLoss, setDraftLoss] = useState('');

  const canAdd =
    draftName.trim().length > 0 &&
    Number(draftQty) > 0 &&
    (draftType === 'Extra' || draftReplacesId !== '');

  function commitDraft() {
    if (!canAdd) return;
    const replaced = baseIngredients.find((b) => b.id === draftReplacesId);
    onAdd({
      id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: draftType,
      replacesId: draftType === 'Replacement' ? draftReplacesId : undefined,
      replacesName: draftType === 'Replacement' ? replaced?.name : undefined,
      name: draftName.trim(),
      qty: draftQty,
      uom: draftUom,
      yieldLossPct: Number(draftLoss) > 0 ? draftLoss : undefined,
    });
    setDraftName('');
    setDraftQty('');
    setDraftLoss('');
    setDraftReplacesId('');
  }

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: '100px',
    border: active ? '1.5px solid var(--color-accent-active)' : '1.5px solid var(--color-border)',
    background: active ? 'var(--color-accent-active)' : '#fff',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
  });
  const fieldStyle: React.CSSProperties = {
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid var(--color-border-subtle)',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: 'var(--font-primary)',
    color: 'var(--color-text-primary)',
    background: disabled ? 'rgba(0,28,53,0.03)' : '#fff',
    outline: 'none',
  };

  return (
    <CardShell
      icon={ChefHat}
      title="Variable ingredients"
      subtitle="Extras the customer can add, or swaps for a base ingredient"
      state={state}
      confirmLabel={`Add ${rows.length} variable ingredient${rows.length === 1 ? '' : 's'}`}
      confirmDisabled={rows.length === 0}
      cancelLabel="None needed"
      onConfirm={onConfirm}
      onCancel={onSkip}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {rows.length > 0 && (
          <div style={{ borderRadius: '8px', border: '1px solid var(--color-border-subtle)', overflow: 'hidden' }}>
            {rows.map((row, i) => (
              <div
                key={row.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 10px',
                  borderBottom: i < rows.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                  fontSize: '12.5px',
                }}
              >
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                    padding: '1px 7px',
                    borderRadius: '100px',
                    background: row.type === 'Extra' ? 'rgba(40,175,201,0.12)' : 'rgba(231,184,0,0.16)',
                    color: row.type === 'Extra' ? 'var(--color-accent-deep)' : '#8a6900',
                    flexShrink: 0,
                  }}
                >
                  {row.type}
                </span>
                <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text-primary)', fontWeight: 600 }}>
                  {row.name}
                  {row.type === 'Replacement' && row.replacesName && (
                    <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}> · replaces {row.replacesName}</span>
                  )}
                </span>
                <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  {row.qty}{row.uom}
                  {row.yieldLossPct ? ` · ${row.yieldLossPct}% loss` : ''}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onRemove(row.id)}
                    aria-label={`Remove ${row.name}`}
                    style={{ border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '2px', display: 'inline-flex' }}
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!disabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" disabled={disabled} onClick={() => setDraftType('Extra')} style={pillStyle(draftType === 'Extra')}>Extra</button>
              <button type="button" disabled={disabled} onClick={() => setDraftType('Replacement')} style={pillStyle(draftType === 'Replacement')}>Replacement</button>
            </div>
            {draftType === 'Replacement' && (
              <select
                value={draftReplacesId}
                disabled={disabled}
                onChange={(e) => setDraftReplacesId(e.target.value)}
                aria-label="Replaces which base ingredient"
                style={{ ...fieldStyle, cursor: 'pointer' }}
              >
                <option value="">Replaces…</option>
                {baseIngredients.filter((b) => !b.toTaste).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={draftName}
                disabled={disabled}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder={draftType === 'Extra' ? 'e.g. Halloumi (grilled)' : 'e.g. Gluten-free bread'}
                aria-label="Variable ingredient name"
                style={{ ...fieldStyle, flex: 1, minWidth: '160px' }}
              />
              <input
                type="number"
                min={0}
                value={draftQty}
                disabled={disabled}
                onChange={(e) => setDraftQty(e.target.value)}
                placeholder="qty"
                aria-label="Quantity"
                style={{ ...fieldStyle, width: '56px', textAlign: 'right' }}
              />
              <select
                value={draftUom}
                disabled={disabled}
                onChange={(e) => setDraftUom(e.target.value)}
                aria-label="Unit"
                style={{ ...fieldStyle, cursor: 'pointer' }}
              >
                {VARIABLE_UOM_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={draftLoss}
                  disabled={disabled}
                  onChange={(e) => setDraftLoss(e.target.value)}
                  placeholder="loss"
                  aria-label="Yield loss %"
                  style={{ ...fieldStyle, width: '52px', textAlign: 'right' }}
                />
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)' }}>%</span>
              </div>
              <button
                type="button"
                disabled={!canAdd}
                onClick={commitDraft}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: canAdd ? 'var(--color-accent-active)' : 'rgba(0,28,53,0.08)',
                  color: canAdd ? '#fff' : 'var(--color-text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: canAdd ? 'pointer' : 'not-allowed',
                }}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </CardShell>
  );
}

function PackagingPicker({ rows, catalogue, selected, channels, onToggle, onToggleChannel, onQtyChange, onUomChange, onAddRow, onConfirm, onSkip, state }: {
  rows: PackagingRow[];
  /** Packaging-category products the operator can add beyond the
   *  AI-suggested rows. Unit cost pre-derived (£/each). */
  catalogue: { id: string; name: string; cost: number; unit: string }[];
  selected: Set<string>;
  /** Per-row channel flags (web-v2's dineIn/takeAway/delivery). */
  channels: Record<string, PackagingChannels>;
  onToggle: (id: string) => void;
  onToggleChannel: (id: string, channel: keyof PackagingChannels) => void;
  onQtyChange: (id: string, qty: string) => void;
  onUomChange: (id: string, uom: string) => void;
  onAddRow: (row: PackagingRow) => void;
  onConfirm: () => void;
  onSkip: () => void;
  state: CardState;
}) {
  const totalPackaging = rows
    .filter(p => selected.has(p.id))
    .reduce((s, p) => s + packagingLineGBP(p), 0);
  const disabled = state !== 'pending';
  const [query, setQuery] = useState('');
  const trimmed = query.trim().toLowerCase();
  const existingIds = new Set(rows.map((r) => r.id));
  const matches = trimmed.length > 0
    ? catalogue.filter((c) => !existingIds.has(c.id) && c.name.toLowerCase().includes(trimmed)).slice(0, 5)
    : [];
  const CHANNEL_LABELS: { key: keyof PackagingChannels; label: string }[] = [
    { key: 'dineIn', label: 'Dine in' },
    { key: 'takeaway', label: 'Takeaway' },
    { key: 'delivery', label: 'Delivery' },
  ];
  const inputStyle: React.CSSProperties = {
    padding: '4px 6px',
    borderRadius: '6px',
    border: '1px solid var(--color-border-subtle)',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    color: 'var(--color-text-primary)',
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <CardShell
      icon={Box}
      title="Packaging"
      subtitle={selected.size > 0 ? `Packaging adds +£${totalPackaging.toFixed(2)}/serve` : 'Pick anything the recipe leaves the pass in'}
      state={state}
      confirmLabel={`Add selected (${selected.size})`}
      confirmDisabled={selected.size === 0}
      cancelLabel="No packaging needed"
      onConfirm={onConfirm}
      onCancel={onSkip}
    >
      <div style={{ margin: '-12px', borderRadius: '0' }}>
      {rows.map((pkg) => {
        const isSelected = selected.has(pkg.id);
        const rowChannels = channels[pkg.id] ?? DEFAULT_PACKAGING_CHANNELS;
        return (
          <div
            key={pkg.id}
            style={{
              borderBottom: '1px solid var(--color-border-subtle)',
              background: isSelected ? 'rgba(34,68,68,0.04)' : '#fff',
              borderLeft: isSelected ? '3px solid var(--color-accent-active)' : '3px solid transparent',
              transition: 'all 0.12s',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '18px 1fr 48px 68px 52px',
                alignItems: 'center',
                padding: '10px 14px',
                gap: '8px',
              }}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggle(pkg.id)}
                aria-label={`${isSelected ? 'Remove' : 'Include'} ${pkg.name}`}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '4px',
                  border: isSelected ? '2px solid var(--color-accent-active)' : '2px solid var(--color-border)',
                  background: isSelected ? 'var(--color-accent-active)' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  padding: 0,
                  transition: 'all 0.12s',
                }}
              >
                {isSelected && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: isSelected ? 600 : 400 }}>
                  {pkg.name}
                </span>
                <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
                  {pkg.aiSuggested ? 'Suggested · ' : ''}£{pkg.cost.toFixed(2)} per {pkg.unit}
                </div>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={pkg.qty}
                disabled={disabled || !isSelected}
                onChange={(e) => onQtyChange(pkg.id, e.target.value)}
                aria-label={`Quantity of ${pkg.name}`}
                style={{ ...inputStyle, width: '100%', textAlign: 'right', opacity: isSelected ? 1 : 0.5 }}
              />
              <select
                value={pkg.unit}
                disabled={disabled || !isSelected}
                onChange={(e) => onUomChange(pkg.id, e.target.value)}
                aria-label={`Unit for ${pkg.name}`}
                style={{ ...inputStyle, width: '100%', fontWeight: 500, color: 'var(--color-text-secondary)', cursor: disabled || !isSelected ? 'default' : 'pointer', opacity: isSelected ? 1 : 0.5, padding: '4px 2px' }}
              >
                {packagingUomOptions(pkg.unit).map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <span style={{ fontSize: '12px', fontWeight: 600, color: isSelected ? 'var(--color-accent-active)' : 'var(--color-text-muted)', textAlign: 'right' }}>
                £{packagingLineGBP(pkg).toFixed(2)}
              </span>
            </div>
            {isSelected && (
              <div style={{ display: 'flex', gap: '6px', padding: '0 14px 10px 40px' }}>
                {CHANNEL_LABELS.map(({ key, label }) => {
                  const on = rowChannels[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled}
                      onClick={() => onToggleChannel(pkg.id, key)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '100px',
                        border: on ? '1.5px solid var(--color-accent-active)' : '1.5px solid var(--color-border)',
                        background: on ? 'rgba(40,175,201,0.10)' : '#fff',
                        color: on ? 'var(--color-accent-deep)' : 'var(--color-text-muted)',
                        fontSize: '11px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-primary)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Add more — typeahead over the packaging catalogue, so the
          four AI suggestions above are a starting point, not a cap. */}
      {!disabled && (
        <div style={{ padding: '8px 14px', background: 'rgba(0,28,53,0.02)' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Add packaging — search the catalogue…"
            aria-label="Search packaging catalogue"
            style={{ ...inputStyle, width: '100%', fontWeight: 500 }}
          />
          {matches.length > 0 && (
            <div style={{ marginTop: '6px', borderRadius: '8px', border: '1px solid var(--color-border-subtle)', overflow: 'hidden', background: '#fff' }}>
              {matches.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onAddRow({ id: c.id, name: c.name, cost: c.cost, unit: c.unit, qty: '1' });
                    setQuery('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    borderBottom: i < matches.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                    background: '#fff',
                    fontFamily: 'var(--font-primary)',
                    fontSize: '12.5px',
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>{c.name}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>£{c.cost.toFixed(2)}/{c.unit}</span>
                </button>
              ))}
            </div>
          )}
          {trimmed.length > 1 && matches.length === 0 && (
            <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
              Nothing in the catalogue matches — add it as a product first and it&rsquo;ll be available here.
            </div>
          )}
        </div>
      )}

      </div>
    </CardShell>
  );
}

function SiteSelectionCard({ selected, onToggle, onConfirm, state }: { selected: Set<string>; onToggle: (id: string) => void; onConfirm: () => void; state: CardState }) {
  const disabled = state !== 'pending';
  const allSelected = MOCK_SITES.every(s => selected.has(s.id));
  return (
    <CardShell
      icon={MapPin}
      title="Select sites"
      subtitle={`${selected.size} site${selected.size !== 1 ? 's' : ''} selected`}
      state={state}
      confirmLabel="Confirm sites"
      confirmDisabled={selected.size === 0}
      onConfirm={onConfirm}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (allSelected) {
              MOCK_SITES.forEach(s => { if (s.id !== 'fitzroy') onToggle(s.id); });
            } else {
              MOCK_SITES.forEach(s => { if (!selected.has(s.id)) onToggle(s.id); });
            }
          }}
          style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-accent-active)', background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-primary)', padding: 0 }}
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {MOCK_SITES.map(site => {
          const isSelected = selected.has(site.id);
          return (
            <button
              key={site.id}
              type="button"
              disabled={disabled}
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
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {site.name}
            </button>
          );
        })}
      </div>
    </CardShell>
  );
}

function AllergenCard({ confirmed, detected, onToggle, onConfirm, state }: {
  confirmed: Set<string>;
  detected: Set<string>;
  onToggle: (a: string) => void;
  onConfirm: () => void;
  state: CardState;
}) {
  const disabled = state !== 'pending';
  return (
    <CardShell
      icon={ShieldCheck}
      title="Allergens"
      subtitle={`${confirmed.size} selected · ${detected.size} auto-detected from ingredients`}
      state={state}
      confirmLabel={`Confirm allergens (${confirmed.size})`}
      onConfirm={onConfirm}
      warning="Based on UK Food Information Regulations 2014 — check auto-detected entries before confirming"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
        {ALL_ALLERGENS.map(allergen => {
          const isDetected = detected.has(allergen);
          const isSelected = confirmed.has(allergen);
          return (
            <button
              key={allergen}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(allergen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                borderRadius: '6px',
                border: 'none',
                background: isSelected ? (isDetected ? '#FEF6DA' : 'rgba(34,68,68,0.05)') : 'transparent',
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
    </CardShell>
  );
}

// ─── Product-sheet import flow ───────────────────────────────────────────────

/** All the fields a parsed supplier sheet would carry — these come
 *  directly off the mock extraction, no operator input required. */
type ExtractedProductSheet = {
  productName: string;
  supplierName: string;
  category: 'Meat' | 'Dairy' | 'Bakery' | 'Produce' | 'Pantry' | 'Beverage' | 'Other';
  packType: 'Pack' | 'Single';
  packQty: number;
  packCost: number;
  singleUnitType: 'Each' | 'kg' | 'L' | 'g' | 'ml';
  singleUnitVolumeOrWeight?: number;
  unitOfMeasure?: string;
  taxRatePct: number;
  allergens: Allergen[];
  /** Master we auto-matched the sheet against. The flow assumes a
   *  hit — the demo seed includes a Bacon master so this always
   *  resolves; in production this would be a fuzzy lookup with a
   *  "create new master" fallback. */
  matchedMasterId: string;
};

/** Mock the LLM/parser output. The brief is "the file already has
 *  everything", so this returns a complete, plausible bacon sheet
 *  regardless of what the user actually picked — the demo is about
 *  the *flow speed*, not the parser. */
function mockExtractFromSheet(_fileName: string): ExtractedProductSheet {
  return {
    productName: 'Smoked Streaky Bacon 1kg',
    supplierName: 'Hawkshead Smokehouse',
    category: 'Meat',
    packType: 'Pack',
    packQty: 10,
    packCost: 48.00,
    singleUnitType: 'kg',
    singleUnitVolumeOrWeight: 1,
    unitOfMeasure: 'kg',
    taxRatePct: 0,
    allergens: ['Sulphites'],
    matchedMasterId: 'mp-bacon',
  };
}

/** Compact card the import flow renders into the chat. Shows the
 *  parsed fields (read-only — operator can't tweak; the brief says
 *  the sheet has it all), the master-product match badge, and a
 *  site-picker that defaults to ALL sites checked so the only
 *  required interaction is "click Add product". */
function ProductSheetImportCard({
  data,
  fileName,
  sites,
  onToggleSite,
  onToggleAll,
  confirmed,
  onConfirm,
}: {
  data: ExtractedProductSheet;
  fileName: string;
  sites: Set<string>;
  onToggleSite: (site: string) => void;
  onToggleAll: (all: boolean) => void;
  confirmed: boolean;
  onConfirm: () => void;
}) {
  const allProducts = useProducts();
  const existingSuppliers = allProducts
    .filter((p) => p.masterProductId === data.matchedMasterId)
    .length;
  const matched = findMasterProduct(data.matchedMasterId);
  const pricePerUom =
    data.packQty > 0 && data.singleUnitVolumeOrWeight
      ? data.packCost / (data.packQty * data.singleUnitVolumeOrWeight)
      : null;

  const allOn = sites.size === ALL_SUPPLIER_SITES.length;

  return (
    <CardShell
      icon={FileText}
      title="Adding new product from sheet"
      subtitle={`Parsed in 1.2s · ${fileName}`}
      state={confirmed ? 'confirmed' : 'pending'}
      confirmLabel={`Add product${sites.size > 0 ? ` to ${sites.size} ${sites.size === 1 ? 'site' : 'sites'}` : ''}`}
      confirmDisabled={sites.size === 0}
      onConfirm={onConfirm}
    >
      {/* Extracted fields */}
      <div style={{ padding: '0 2px 4px' }}>
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <EdifyMark size={11} />
          Auto-detected
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px 16px',
            fontSize: '12.5px',
          }}
        >
          <DetailRow label="Product" value={data.productName} />
          <DetailRow label="Category" value={data.category} />
          <DetailRow
            label="Pack"
            value={`${data.packQty} × ${data.singleUnitVolumeOrWeight ?? 1}${data.unitOfMeasure ?? data.singleUnitType.toLowerCase()} · £${data.packCost.toFixed(2)}`}
          />
          <DetailRow
            label="Price per uom"
            value={pricePerUom !== null ? `£${pricePerUom.toFixed(2)} / ${data.unitOfMeasure ?? data.singleUnitType.toLowerCase()}` : '—'}
          />
          <DetailRow label="VAT" value={`${data.taxRatePct}%`} />
          <DetailRow label="Allergens" value={data.allergens.length ? data.allergens.join(', ') : 'None'} />
        </div>
      </div>

      {/* Master match */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border-subtle)' }}>
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <EdifyMark size={11} />
          Master product
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: '10px',
            background: '#fff',
            border: '1.5px solid var(--color-accent-active)',
          }}
        >
          <Package size={14} strokeWidth={1.9} color="var(--color-accent-active)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Matched to <strong>{matched?.name ?? 'Bacon'}</strong> master
            </div>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
              {existingSuppliers} existing supplier{existingSuppliers === 1 ? '' : 's'} · this sheet adds <strong>{data.supplierName}</strong> as a new one
            </div>
          </div>
        </div>
      </div>

      {/* Sites picker */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border-subtle)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px',
          }}
        >
          <div
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
            }}
          >
            Which stores will use this?
          </div>
          <button
            type="button"
            onClick={() => onToggleAll(!allOn)}
            disabled={confirmed}
            style={{
              padding: '3px 10px',
              borderRadius: '999px',
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-secondary)',
              cursor: confirmed ? 'not-allowed' : 'pointer',
            }}
          >
            {allOn ? 'None' : 'All'}
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {ALL_SUPPLIER_SITES.map((site) => {
            const on = sites.has(site);
            return (
              <button
                key={site}
                type="button"
                onClick={() => onToggleSite(site)}
                disabled={confirmed}
                style={{
                  padding: '5px 12px',
                  borderRadius: '999px',
                  border: on ? '2px solid var(--color-accent-active)' : '1.5px solid var(--color-border)',
                  background: on ? 'var(--color-accent-active)' : '#fff',
                  fontSize: '12px',
                  fontWeight: on ? 700 : 500,
                  fontFamily: 'var(--font-primary)',
                  color: on ? '#fff' : 'var(--color-text-secondary)',
                  cursor: confirmed ? 'not-allowed' : 'pointer',
                  transition: 'background 0.12s ease, border-color 0.12s ease',
                }}
              >
                {site}
              </button>
            );
          })}
        </div>
      </div>
    </CardShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: '12.5px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginTop: '1px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Chagee tea-leaf swap demo ────────────────────────────────────────────────
//
// Fully scripted two-step flow for the Chagee franchise scenario:
// "update a recipe across all my franchises to use whole tea leaves
// from a new supplier — here's their product list". Step 1 adds the
// supplier + product (mock — nothing is written to the stores), step
// 2 swaps the ingredient on the recipe across the selected
// franchises. All data below is display-only mock data.

const CHAGEE_TEA_SWAP = {
  fileName: 'golden-leaf-supplier-list.pdf',
  supplier: {
    name: 'Yunnan Golden Leaf Tea Co.',
    shortCode: 'Golden Leaf',
    contact: 'orders@goldenleaf-tea.com',
    cutOff: '14:00',
    leadTime: '5 days',
    minOrder: '£500',
    deliveryDays: 'Mon, Thu',
  },
  product: {
    name: 'Whole Tea Leaves — Jasmine Green Grade A',
    category: 'Tea',
    pack: '4 × 5kg · £180.00',
    pricePerUom: '£9.00 / kg',
    vat: '0%',
    allergens: 'None',
  },
  master: {
    name: 'Whole Tea Leaves',
    note: 'currently supplied by Meadow Tea Supply — Golden Leaf becomes the new source',
  },
  recipe: {
    name: 'Jasmine Green Milk Tea (Signature)',
    oldIngredient: 'Jasmine Tea Leaves — Loose Grade B · Meadow Tea Supply',
    newIngredient: 'Whole Tea Leaves — Jasmine Green Grade A · Golden Leaf',
    qtyNote: '12g per serve · unchanged',
    oldCost: '£0.14',
    newCost: '£0.11',
    costDelta: '−21% per serve',
  },
  franchises: [
    'Westfield London',
    'Oxford Circus',
    'Soho',
    'Camden Market',
    'Battersea',
    'Canary Wharf',
    'Kingston',
    'Croydon',
    'Manchester Arndale',
    'Birmingham Bullring',
    'Leeds Trinity',
    'Glasgow Buchanan',
  ],
};

const DEMO_SECTION_LABEL: React.CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  marginBottom: '6px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

/** Step 1 — the parsed supplier + their whole-tea-leaves product. */
function ChageeTeaSupplierCard({ confirmed, onConfirm }: { confirmed: boolean; onConfirm: () => void }) {
  const d = CHAGEE_TEA_SWAP;
  return (
    <CardShell
      icon={FileText}
      title="Adding new supplier + product"
      subtitle={`Parsed in 1.4s · ${d.fileName}`}
      state={confirmed ? 'confirmed' : 'pending'}
      confirmLabel="Add supplier + product"
      onConfirm={onConfirm}
    >
      <div style={{ padding: '0 2px 4px' }}>
        <div style={DEMO_SECTION_LABEL}>
          <EdifyMark size={11} />
          Supplier details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '12.5px' }}>
          <DetailRow label="Supplier" value={d.supplier.name} />
          <DetailRow label="Contact" value={d.supplier.contact} />
          <DetailRow label="Order cut-off" value={d.supplier.cutOff} />
          <DetailRow label="Lead time" value={d.supplier.leadTime} />
          <DetailRow label="Minimum order" value={d.supplier.minOrder} />
          <DetailRow label="Delivery days" value={d.supplier.deliveryDays} />
        </div>
      </div>

      <div style={{ padding: '10px 14px 4px', borderTop: '1px solid var(--color-border-subtle)', marginTop: '10px' }}>
        <div style={DEMO_SECTION_LABEL}>
          <EdifyMark size={11} />
          Product
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '12.5px' }}>
          <DetailRow label="Product" value={d.product.name} />
          <DetailRow label="Category" value={d.product.category} />
          <DetailRow label="Pack" value={d.product.pack} />
          <DetailRow label="Price per uom" value={d.product.pricePerUom} />
          <DetailRow label="VAT" value={d.product.vat} />
          <DetailRow label="Allergens" value={d.product.allergens} />
        </div>
      </div>

      <div style={{ padding: '10px 14px' }}>
        <div style={DEMO_SECTION_LABEL}>
          <EdifyMark size={11} />
          Master product
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', background: '#fff', border: '1.5px solid var(--color-accent-active)' }}>
          <Package size={14} strokeWidth={1.9} color="var(--color-accent-active)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Matched to <strong>{d.master.name}</strong> master
            </div>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
              {d.master.note}
            </div>
          </div>
        </div>
      </div>

    </CardShell>
  );
}

/** Step 2 — the recipe ingredient swap across franchises. */
function ChageeTeaRecipeCard({
  franchises,
  onToggleFranchise,
  onToggleAll,
  confirmed,
  onConfirm,
}: {
  franchises: Set<string>;
  onToggleFranchise: (f: string) => void;
  onToggleAll: (all: boolean) => void;
  confirmed: boolean;
  onConfirm: () => void;
}) {
  const d = CHAGEE_TEA_SWAP;
  const allOn = franchises.size === d.franchises.length;
  return (
    <CardShell
      icon={ChefHat}
      title={`Update recipe — ${d.recipe.name}`}
      subtitle="Ingredient swap · whole tea leaves"
      state={confirmed ? 'confirmed' : 'pending'}
      confirmLabel={`Update recipe across ${franchises.size} franchise${franchises.size === 1 ? '' : 's'}`}
      confirmDisabled={franchises.size === 0}
      onConfirm={onConfirm}
    >
      <div style={{ padding: '0 2px' }}>
        <div style={DEMO_SECTION_LABEL}>
          <EdifyMark size={11} />
          Ingredient swap
        </div>
        <div style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--color-accent-active)', background: '#fff' }}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
            {d.recipe.oldIngredient}
          </div>
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '4px' }}>
            → {d.recipe.newIngredient}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {d.recipe.qtyNote}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '12.5px', marginTop: '10px' }}>
          <DetailRow label="Cost per serve" value={`${d.recipe.oldCost} → ${d.recipe.newCost}`} />
          <DetailRow label="Impact" value={d.recipe.costDelta} />
        </div>
      </div>

      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ ...DEMO_SECTION_LABEL, marginBottom: 0 }}>
            Which franchises?
          </div>
          <button
            type="button"
            onClick={() => onToggleAll(!allOn)}
            disabled={confirmed}
            style={{ padding: '3px 10px', borderRadius: '999px', border: '1px solid var(--color-border-subtle)', background: '#fff', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-text-secondary)', cursor: confirmed ? 'not-allowed' : 'pointer' }}
          >
            {allOn ? 'None' : 'All'}
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {CHAGEE_TEA_SWAP.franchises.map((site) => {
            const on = franchises.has(site);
            return (
              <button
                key={site}
                type="button"
                onClick={() => onToggleFranchise(site)}
                disabled={confirmed}
                style={{
                  padding: '5px 12px',
                  borderRadius: '999px',
                  border: on ? '2px solid var(--color-accent-active)' : '1.5px solid var(--color-border)',
                  background: on ? 'var(--color-accent-active)' : '#fff',
                  fontSize: '12px',
                  fontWeight: on ? 700 : 500,
                  fontFamily: 'var(--font-primary)',
                  color: on ? '#fff' : 'var(--color-text-secondary)',
                  cursor: confirmed ? 'not-allowed' : 'pointer',
                  transition: 'background 0.12s ease, border-color 0.12s ease',
                }}
              >
                {site}
              </button>
            );
          })}
        </div>
      </div>

    </CardShell>
  );
}

// ─── Stock-take review demo ───────────────────────────────────────────────────
//
// Scripted two-step flow: "update my stock takes — review all the
// products that aren't in a stock area". Step 1 lists the unassigned
// products and lets the operator tick which ones to add; step 2 picks
// the storage area they should live in. Generic (default-profile)
// mock data — nothing is written to the product or stock-take stores.

const STOCK_TAKE_REVIEW = {
  // `suggestedArea` seeds the per-product picker on step 2 — Quinn's
  // best guess from the product type, which the operator can change.
  products: [
    { id: 'espresso-beans', name: 'Espresso Beans — House Blend', supplier: 'Riverbank Roasters', pack: '6 × 1kg', lastDelivery: 'Tue 30 Jun', suggestedArea: 'dry-store' },
    { id: 'oat-milk', name: 'Oat Milk — Barista Edition', supplier: 'Minor Figures', pack: '12 × 1L', lastDelivery: 'Thu 2 Jul', suggestedArea: 'dry-store' },
    { id: 'sourdough', name: 'Sourdough Loaf — Sliced', supplier: 'Northside Bakery', pack: '10 loaves', lastDelivery: 'Fri 3 Jul', suggestedArea: 'freezer' },
    { id: 'bacon', name: 'Smoked Streaky Bacon', supplier: 'Meadow Farm', pack: '4 × 2.5kg', lastDelivery: 'Mon 29 Jun', suggestedArea: 'walk-in' },
    { id: 'avocados', name: 'Avocados — Ready to Eat', supplier: 'Fresh Direct', pack: '2 × 24', lastDelivery: 'Thu 2 Jul', suggestedArea: 'walk-in' },
    { id: 'maple-syrup', name: 'Maple Syrup — Grade A', supplier: 'Fresh Direct', pack: '6 × 1L', lastDelivery: 'Fri 26 Jun', suggestedArea: 'dry-store' },
    { id: 'takeaway-cups', name: '12oz Takeaway Cups', supplier: 'PackRight', pack: '10 × 500', lastDelivery: 'Wed 1 Jul', suggestedArea: 'packaging' },
    { id: 'napkins', name: 'Recycled Napkins', supplier: 'PackRight', pack: '20 × 250', lastDelivery: 'Wed 1 Jul', suggestedArea: 'packaging' },
  ],
  areas: [
    { id: 'dry-store', name: 'Dry Store', items: 52 },
    { id: 'walk-in', name: 'Walk-in Fridge', items: 38 },
    { id: 'freezer', name: 'Freezer', items: 21 },
    { id: 'front-of-house', name: 'Front of House', items: 27 },
    { id: 'packaging', name: 'Packaging Store', items: 14 },
  ],
};

/** Step 1 — review the products missing a storage area and tick
 *  which ones to add to the stock take. */
function StockReviewCard({
  selected,
  onToggle,
  onToggleAll,
  confirmed,
  onConfirm,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (all: boolean) => void;
  confirmed: boolean;
  onConfirm: () => void;
}) {
  const d = STOCK_TAKE_REVIEW;
  const allOn = selected.size === d.products.length;
  return (
    <CardShell
      icon={Package}
      title="Products missing a storage area"
      subtitle={`${d.products.length} products aren't counted on any stock take`}
      state={confirmed ? 'confirmed' : 'pending'}
      confirmLabel={`Add ${selected.size} product${selected.size === 1 ? '' : 's'} to stock take`}
      confirmDisabled={selected.size === 0}
      onConfirm={onConfirm}
    >
      <div style={{ padding: '0 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ ...DEMO_SECTION_LABEL, marginBottom: 0 }}>
            <EdifyMark size={11} />
            Choose products to add
          </div>
          <button
            type="button"
            onClick={() => onToggleAll(!allOn)}
            disabled={confirmed}
            style={{ padding: '3px 10px', borderRadius: '999px', border: '1px solid var(--color-border-subtle)', background: '#fff', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-text-secondary)', cursor: confirmed ? 'not-allowed' : 'pointer' }}
          >
            {allOn ? 'None' : 'All'}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {d.products.map((p) => {
            const on = selected.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onToggle(p.id)}
                disabled={confirmed}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: on ? '1.5px solid var(--color-accent-active)' : '1.5px solid var(--color-border-subtle)',
                  background: '#fff',
                  textAlign: 'left',
                  fontFamily: 'var(--font-primary)',
                  cursor: confirmed ? 'not-allowed' : 'pointer',
                  transition: 'border-color 0.12s ease',
                }}
              >
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '5px',
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: on ? 'none' : '1.5px solid var(--color-border)',
                    background: on ? 'var(--color-accent-active)' : '#fff',
                  }}
                >
                  {on && <Check size={12} strokeWidth={3} color="#fff" />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {p.name}
                  </span>
                  <span style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
                    {p.supplier} · {p.pack} · last delivery {p.lastDelivery}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

    </CardShell>
  );
}

/** Step 2 — choose which sites the stock-take update applies to.
 *  Multi-select pills, all sites pre-selected. Storage areas come
 *  after this step (they can differ site to site, so the operator
 *  needs to know the scope first). */
function StockSitesCard({
  sites,
  onToggleSite,
  onToggleAll,
  confirmed,
  onConfirm,
}: {
  sites: Set<string>;
  onToggleSite: (site: string) => void;
  onToggleAll: (all: boolean) => void;
  confirmed: boolean;
  onConfirm: () => void;
}) {
  const allOn = sites.size === ALL_SUPPLIER_SITES.length;
  return (
    <CardShell
      icon={Package}
      title="Which sites?"
      subtitle="The products join the stock take at the selected sites"
      state={confirmed ? 'confirmed' : 'pending'}
      confirmLabel={`Confirm ${sites.size} site${sites.size === 1 ? '' : 's'}`}
      confirmDisabled={sites.size === 0}
      onConfirm={onConfirm}
    >
      <div style={{ padding: '0 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ ...DEMO_SECTION_LABEL, marginBottom: 0 }}>
            <EdifyMark size={11} />
            Sites
          </div>
          <button
            type="button"
            onClick={() => onToggleAll(!allOn)}
            disabled={confirmed}
            style={{ padding: '3px 10px', borderRadius: '999px', border: '1px solid var(--color-border-subtle)', background: '#fff', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-text-secondary)', cursor: confirmed ? 'not-allowed' : 'pointer' }}
          >
            {allOn ? 'None' : 'All'}
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {ALL_SUPPLIER_SITES.map((site) => {
            const on = sites.has(site);
            return (
              <button
                key={site}
                type="button"
                onClick={() => onToggleSite(site)}
                disabled={confirmed}
                style={{
                  padding: '5px 12px',
                  borderRadius: '999px',
                  border: on ? '2px solid var(--color-accent-active)' : '1.5px solid var(--color-border)',
                  background: on ? 'var(--color-accent-active)' : '#fff',
                  fontSize: '12px',
                  fontWeight: on ? 700 : 500,
                  fontFamily: 'var(--font-primary)',
                  color: on ? '#fff' : 'var(--color-text-secondary)',
                  cursor: confirmed ? 'not-allowed' : 'pointer',
                  transition: 'background 0.12s ease, border-color 0.12s ease',
                }}
              >
                {site}
              </button>
            );
          })}
        </div>
      </div>

    </CardShell>
  );
}

/** Step 3 — assign each chosen product to a storage area. Rows come
 *  pre-filled with Quinn's suggestion (`suggestedArea`); the operator
 *  can re-pick per product. The CTA stays disabled until every
 *  product has an area. */
function StorageAreaCard({
  productIds,
  choices,
  onPickArea,
  confirmed,
  onConfirm,
}: {
  productIds: string[];
  choices: Record<string, string>;
  onPickArea: (productId: string, areaId: string) => void;
  confirmed: boolean;
  onConfirm: () => void;
}) {
  const d = STOCK_TAKE_REVIEW;
  const rows = d.products.filter((p) => productIds.includes(p.id));
  const allAssigned = rows.every((p) => !!choices[p.id]);
  return (
    <CardShell
      icon={Package}
      title="Choose storage areas"
      subtitle="I've suggested an area for each product — adjust any, then confirm"
      state={confirmed ? 'confirmed' : 'pending'}
      confirmLabel={
        allAssigned
          ? `Add ${rows.length} product${rows.length === 1 ? '' : 's'} to storage areas`
          : 'Assign an area to every product'
      }
      confirmDisabled={!allAssigned}
      onConfirm={onConfirm}
    >
      <div style={{ padding: '0 2px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {rows.map((p) => (
          <div
            key={p.id}
            style={{
              padding: '8px 10px',
              borderRadius: '10px',
              border: '1.5px solid var(--color-border-subtle)',
              background: '#fff',
            }}
          >
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {p.name}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px' }}>
              {d.areas.map((a) => {
                const on = choices[p.id] === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onPickArea(p.id, a.id)}
                    disabled={confirmed}
                    style={{
                      padding: '4px 11px',
                      borderRadius: '999px',
                      border: on ? '2px solid var(--color-accent-active)' : '1.5px solid var(--color-border)',
                      background: on ? 'var(--color-accent-active)' : '#fff',
                      fontSize: '11.5px',
                      fontWeight: on ? 700 : 500,
                      fontFamily: 'var(--font-primary)',
                      color: on ? '#fff' : 'var(--color-text-secondary)',
                      cursor: confirmed ? 'not-allowed' : 'pointer',
                      transition: 'background 0.12s ease, border-color 0.12s ease',
                    }}
                  >
                    {a.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

    </CardShell>
  );
}

// ─── POS-match follow-up (chat-side) ─────────────────────────────────────────

/** A POS button ↔ just-imported product pairing we surface in the
 *  chat after an import lands. The operator confirms (or skips) each
 *  one without leaving the conversation; "applied" rows write to the
 *  same override store the Item matching page reads from. */
type POSMatchCandidate = { id: string; name: string; type: POSTargetType };

type POSMatchSuggestion = {
  posItemId: string;
  posItemName: string;
  /** What kind of POS button this is (Menu item vs Modifier). */
  posType?: 'Menu item' | 'Modifier';
  productId: string;
  productName: string;
  /** What kind of entity the suggested target is. Defaults to Product. */
  targetType?: POSTargetType;
  /** Other plausible targets, offered in the change-target dropdown so
   *  a wrong suggestion can be corrected in place (rule #6). */
  alternatives?: POSMatchCandidate[];
  /** Similarity score (0–1). Drives the High / Likely / Not sure pill. */
  score: number;
};

function normalizePosName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
}

function scorePosName(a: string, b: string): number {
  const na = normalizePosName(a);
  const nb = normalizePosName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : shared / union;
}

/** Threshold mirrors the Item matching page so the suggestions the
 *  user accepts in chat match what they'd see on the matching page
 *  if they navigated there directly. */
const POS_SUGGESTION_THRESHOLD = 0.2;

/** Compute the cross-product of unmatched Drinks-category POS buttons
 *  and just-imported Beverage products. Returns at most one suggestion
 *  per POS button — the highest-scoring product candidate. */
function computePOSDrinkSuggestions(
  justAddedProducts: { id: string; name: string; category: ProductCategory }[],
  alreadyMatchedPosIds: Set<string>,
): POSMatchSuggestion[] {
  const beverages = justAddedProducts.filter((p) => p.category === 'Beverage');
  if (beverages.length === 0) return [];
  const out: POSMatchSuggestion[] = [];
  for (const pos of FITZROY_POS_INTAKE.menuItems) {
    if (pos.category !== 'Drinks') continue;
    if (alreadyMatchedPosIds.has(pos.id)) continue;
    const candidates = beverages
      .map((prd) => ({ id: prd.id, name: prd.name, s: scorePosName(pos.name, prd.name) }))
      .filter((c) => c.s >= POS_SUGGESTION_THRESHOLD)
      .sort((a, b) => b.s - a.s);
    const best = candidates[0];
    if (best) {
      out.push({
        posItemId: pos.id,
        posItemName: pos.name,
        posType: 'Menu item',
        productId: best.id,
        productName: best.name,
        targetType: 'Product',
        // Runners-up feed the change-target dropdown.
        alternatives: candidates.slice(1, 4).map((c) => ({ id: c.id, name: c.name, type: 'Product' as const })),
        score: best.s,
      });
    }
  }
  return out;
}

// ─── New-supplier import flow ────────────────────────────────────────────────

/** One product parsed off the supplier's catalogue file. Mirrors the
 *  shape of `Product` but holds only what the catalogue knows — the
 *  flow fills in the supplier id, sites, status etc. at confirm time. */
type ExtractedSupplierProduct = {
  name: string;
  supplierCode: string;
  category: ProductCategory;
  productClass: ProductClass;
  packType: 'Pack' | 'Single';
  packQty: number;
  packCost: number;
  singleUnitType: 'Each' | 'kg' | 'L' | 'g' | 'ml';
  singleUnitVolumeOrWeight?: number;
  unitOfMeasure?: string;
  taxRatePct: number;
  allergens: Allergen[];
};

/** Everything we read off the two attached files (supplier sheet +
 *  catalogue spreadsheet). The flow assumes both files have already
 *  been parsed cleanly — the brief is to show how fast the flow can
 *  feel when nothing is missing, not how to handle parse errors. */
type ExtractedSupplierSheet = {
  name: string;
  shortCode: string;
  categories: ProductCategory[];
  email?: string;
  phone?: string;
  contactName?: string;
  accountsEmail?: string;
  companyAccountNumber?: string;
  cutOffTime?: string;
  leadTimeDays?: number;
  minimumOrderValue?: number;
  deliveryDays?: DayOfWeek[];
  /** Per-supplier filenames so the chat surface can show both chips
   *  in the user bubble + the card subtitle. */
  supplierFileName: string;
  catalogueFileName: string;
  products: ExtractedSupplierProduct[];
};

/** Builds a plausible 20-SKU beverage distributor — Atlas Drinks Co.
 *  Used by the chat-driven "new supplier" demo so the card has
 *  enough realistic variation to be worth scrolling through. Mixes
 *  waters, mixers, kombuchas, coffees and juices — wide enough
 *  category spread that the catalogue feels real. */
function mockSupplierSheet(): ExtractedSupplierSheet {
  // Helper to keep each row terse — every product is canned/bottled
  // and reports the same shape, so a builder is cleaner than spelling
  // out the same defaults 20 times.
  const drink = (
    over: Pick<ExtractedSupplierProduct, 'name' | 'supplierCode' | 'packQty' | 'packCost' | 'singleUnitVolumeOrWeight'> &
      Partial<ExtractedSupplierProduct>,
  ): ExtractedSupplierProduct => ({
    category: 'Beverage',
    productClass: 'Beverage',
    packType: 'Pack',
    singleUnitType: 'Each',
    unitOfMeasure: 'L',
    taxRatePct: 20,
    allergens: [],
    ...over,
  });
  return {
    name: 'Atlas Drinks Co.',
    shortCode: 'Atlas',
    categories: ['Beverage'],
    email: 'wholesale@atlasdrinks.co',
    phone: '+44 20 7946 1280',
    contactName: 'Priya Shah',
    accountsEmail: 'accounts@atlasdrinks.co',
    companyAccountNumber: 'EDF-4471',
    cutOffTime: '14:00',
    leadTimeDays: 2,
    minimumOrderValue: 220,
    deliveryDays: ['Mon', 'Wed', 'Fri'],
    supplierFileName: 'atlas-supplier-details.pdf',
    catalogueFileName: 'atlas-catalogue-2026.xlsx',
    products: [
      drink({ name: 'Atlas Sparkling Water 330ml', supplierCode: 'AT-SPK-330', packQty: 24, packCost: 18.00, singleUnitVolumeOrWeight: 0.33 }),
      drink({ name: 'Atlas Still Water 500ml', supplierCode: 'AT-STL-500', packQty: 24, packCost: 22.00, singleUnitVolumeOrWeight: 0.5 }),
      drink({ name: 'Atlas Tonic Water 200ml', supplierCode: 'AT-TON-200', packQty: 24, packCost: 28.80, singleUnitVolumeOrWeight: 0.2 }),
      drink({ name: 'Atlas Cola Mixer 200ml', supplierCode: 'AT-COL-200', packQty: 24, packCost: 26.40, singleUnitVolumeOrWeight: 0.2 }),
      drink({ name: 'Atlas Ginger Beer 200ml', supplierCode: 'AT-GNG-200', packQty: 24, packCost: 30.00, singleUnitVolumeOrWeight: 0.2 }),
      drink({ name: 'Atlas Bitter Lemon 200ml', supplierCode: 'AT-BIT-200', packQty: 24, packCost: 28.80, singleUnitVolumeOrWeight: 0.2 }),
      drink({ name: 'Atlas Lemon Soda 330ml', supplierCode: 'AT-LEM-330', packQty: 24, packCost: 32.40, singleUnitVolumeOrWeight: 0.33 }),
      drink({ name: 'Atlas Cucumber Soda 330ml', supplierCode: 'AT-CUC-330', packQty: 24, packCost: 32.40, singleUnitVolumeOrWeight: 0.33 }),
      drink({ name: 'Atlas Kombucha Original 330ml', supplierCode: 'AT-KMB-ORG-330', packQty: 12, packCost: 36.00, singleUnitVolumeOrWeight: 0.33 }),
      drink({ name: 'Atlas Kombucha Ginger 330ml', supplierCode: 'AT-KMB-GNG-330', packQty: 12, packCost: 36.00, singleUnitVolumeOrWeight: 0.33 }),
      drink({ name: 'Atlas Kombucha Hibiscus 330ml', supplierCode: 'AT-KMB-HIB-330', packQty: 12, packCost: 36.00, singleUnitVolumeOrWeight: 0.33 }),
      drink({ name: 'Atlas Cold Brew Coffee 250ml', supplierCode: 'AT-CBR-250', packQty: 12, packCost: 33.60, singleUnitVolumeOrWeight: 0.25 }),
      drink({ name: 'Atlas Iced Latte 330ml', supplierCode: 'AT-LAT-330', packQty: 12, packCost: 30.00, singleUnitVolumeOrWeight: 0.33, allergens: ['Dairy'] }),
      drink({ name: 'Atlas Matcha Latte 330ml', supplierCode: 'AT-MCH-330', packQty: 12, packCost: 33.00, singleUnitVolumeOrWeight: 0.33, allergens: ['Dairy'] }),
      drink({ name: 'Atlas Energy Original 250ml', supplierCode: 'AT-ENG-ORG-250', packQty: 24, packCost: 36.00, singleUnitVolumeOrWeight: 0.25 }),
      drink({ name: 'Atlas Energy Watermelon 250ml', supplierCode: 'AT-ENG-WAT-250', packQty: 24, packCost: 36.00, singleUnitVolumeOrWeight: 0.25 }),
      drink({ name: 'Atlas Coconut Water 330ml', supplierCode: 'AT-COC-330', packQty: 24, packCost: 42.00, singleUnitVolumeOrWeight: 0.33 }),
      drink({ name: 'Atlas Apple Juice 330ml', supplierCode: 'AT-APL-330', packQty: 24, packCost: 33.60, singleUnitVolumeOrWeight: 0.33 }),
      drink({ name: 'Atlas Orange Juice 330ml', supplierCode: 'AT-ORG-330', packQty: 24, packCost: 33.60, singleUnitVolumeOrWeight: 0.33 }),
      drink({ name: 'Atlas Lemonade 330ml', supplierCode: 'AT-LMD-330', packQty: 24, packCost: 30.00, singleUnitVolumeOrWeight: 0.33 }),
    ],
  };
}

const SUPPLIER_PRODUCT_CATEGORIES: ProductCategory[] = [
  'Beverage', 'Bakery', 'Dairy', 'Produce', 'Meat', 'Seafood',
  'Pantry', 'Cleaning', 'Packaging', 'Other',
];

const SUPPLIER_PRODUCT_CLASSES: ProductClass[] = ['Food', 'Beverage', 'Non-food', 'General'];

const SUPPLIER_UNIT_TYPES: ExtractedSupplierProduct['singleUnitType'][] = [
  'Each', 'kg', 'g', 'L', 'ml',
];

/** Inline edit panel for a single product inside the supplier
 *  catalogue. Rendered directly under the row that opened it so
 *  the operator stays in the same scroll position. Every field
 *  edits in-place via `onEdit` (no draft buffer) — this matches
 *  the "fast, low-friction review" tone of the wider import flow. */
function SupplierProductEditPanel({
  product,
  confirmed,
  onEdit,
  onRemove,
  onClose,
}: {
  product: ExtractedSupplierProduct;
  confirmed: boolean;
  onEdit: (patch: Partial<ExtractedSupplierProduct>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const unitSize = product.singleUnitVolumeOrWeight ?? 1;
  // Catalogue cost shown per unit of the chosen UoM. Helps the
  // operator sanity-check that "£48 / 24 × 1L = £2.00 per L" — a
  // very common transcription error class for catalogue uploads.
  const perUom = product.packCost / Math.max(0.001, product.packQty * unitSize);

  const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--color-text-muted)',
    marginBottom: '4px',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 9px',
    borderRadius: '7px',
    border: '1px solid var(--color-border-subtle)',
    background: confirmed ? 'rgba(0,28,53,0.03)' : '#fff',
    fontSize: '12.5px',
    fontFamily: 'var(--font-primary)',
    color: 'var(--color-text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  };
  const fieldRow: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginBottom: '8px',
  };

  return (
    <div
      style={{
        padding: '10px 14px 12px',
        borderTop: '1px dashed var(--color-border-subtle)',
        background: 'rgba(0,28,53,0.015)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          marginBottom: '8px',
        }}
      >
        <EdifyMark size={10} />
        AI-parsed · edit to adjust
      </div>

      <div style={fieldRow}>
        <div>
          <div style={labelStyle}>Name</div>
          <input
            type="text"
            value={product.name}
            disabled={confirmed}
            onChange={(e) => onEdit({ name: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Supplier code</div>
          <input
            type="text"
            value={product.supplierCode}
            disabled={confirmed}
            onChange={(e) => onEdit({ supplierCode: e.target.value })}
            style={{
              ...inputStyle,
              fontFamily: 'var(--font-mono, ui-monospace, "SF Mono", monospace)',
            }}
          />
        </div>
      </div>

      <div style={fieldRow}>
        <div>
          <div style={labelStyle}>Category</div>
          <select
            value={product.category}
            disabled={confirmed}
            onChange={(e) => onEdit({ category: e.target.value as ProductCategory })}
            style={inputStyle}
          >
            {SUPPLIER_PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Product class</div>
          <select
            value={product.productClass}
            disabled={confirmed}
            onChange={(e) => onEdit({ productClass: e.target.value as ProductClass })}
            style={inputStyle}
          >
            {SUPPLIER_PRODUCT_CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={fieldRow}>
        <div>
          <div style={labelStyle}>Pack qty</div>
          <input
            type="number"
            min={1}
            step={1}
            value={product.packQty}
            disabled={confirmed}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              onEdit({ packQty: Number.isFinite(v) && v > 0 ? v : 1 });
            }}
            style={inputStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Pack cost (£)</div>
          <input
            type="number"
            min={0}
            step={0.01}
            value={product.packCost}
            disabled={confirmed}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onEdit({ packCost: Number.isFinite(v) && v >= 0 ? v : 0 });
            }}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={fieldRow}>
        <div>
          <div style={labelStyle}>Unit size</div>
          <input
            type="number"
            min={0}
            step={0.001}
            value={product.singleUnitVolumeOrWeight ?? ''}
            disabled={confirmed}
            placeholder="—"
            onChange={(e) => {
              if (e.target.value === '') {
                onEdit({ singleUnitVolumeOrWeight: undefined });
                return;
              }
              const v = parseFloat(e.target.value);
              onEdit({ singleUnitVolumeOrWeight: Number.isFinite(v) ? v : undefined });
            }}
            style={inputStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Unit of measure</div>
          <select
            value={product.singleUnitType}
            disabled={confirmed}
            onChange={(e) => {
              const v = e.target.value as ExtractedSupplierProduct['singleUnitType'];
              // Keep `unitOfMeasure` in sync so the row summary, the
              // downstream Product.unitOfMeasure, and the per-UoM
              // cost preview all line up after edits.
              onEdit({ singleUnitType: v, unitOfMeasure: v });
            }}
            style={inputStyle}
          >
            {SUPPLIER_UNIT_TYPES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={fieldRow}>
        <div>
          <div style={labelStyle}>VAT %</div>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={product.taxRatePct}
            disabled={confirmed}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onEdit({ taxRatePct: Number.isFinite(v) && v >= 0 ? v : 0 });
            }}
            style={inputStyle}
          />
        </div>
        <div>
          <div style={labelStyle}>Per-UoM cost (auto)</div>
          <div
            style={{
              ...inputStyle,
              background: 'transparent',
              border: '1px dashed var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
              fontWeight: 600,
            }}
          >
            £{perUom.toFixed(perUom < 1 ? 3 : 2)} / {product.singleUnitType}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <div style={labelStyle}>Allergens</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {ALL_ALLERGENS.map((al) => {
            const allergen = al as Allergen;
            const on = product.allergens.includes(allergen);
            return (
              <button
                key={al}
                type="button"
                disabled={confirmed}
                onClick={() => {
                  const next = on
                    ? product.allergens.filter((x) => x !== allergen)
                    : [...product.allergens, allergen];
                  onEdit({ allergens: next });
                }}
                style={{
                  padding: '3px 9px',
                  borderRadius: '999px',
                  border: on
                    ? '1px solid var(--color-accent-active)'
                    : '1px solid var(--color-border-subtle)',
                  background: on ? 'var(--color-accent-active)' : '#fff',
                  fontSize: '11px',
                  fontWeight: on ? 700 : 500,
                  fontFamily: 'var(--font-primary)',
                  color: on ? '#fff' : 'var(--color-text-secondary)',
                  cursor: confirmed ? 'not-allowed' : 'pointer',
                }}
              >
                {al}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '4px',
        }}
      >
        <button
          type="button"
          disabled={confirmed}
          onClick={onRemove}
          style={{
            padding: '5px 11px',
            borderRadius: '999px',
            border: '1px solid var(--color-border)',
            background: '#fff',
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: confirmed ? 'var(--color-text-muted)' : '#B01038',
            cursor: confirmed ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <X size={11} strokeWidth={2.2} />
          Drop from import
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '5px 16px',
            borderRadius: '999px',
            border: '1px solid var(--color-accent-active)',
            background: 'var(--color-accent-active)',
            fontSize: '11.5px',
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

/** Follow-up card that appears in chat right after an import finishes,
 *  surfacing unmatched Drinks-category POS buttons that look like the
 *  SKUs we just added. The operator can apply each suggestion (or all
 *  in one go) without leaving the conversation — the writes go to the
 *  same override store the Item matching page reads from. */
/** High / Likely / Not sure tier off the similarity score. Not-sure
 *  rows are excluded from bulk linking (rule #5). */
function posMatchTier(score: number): 'high' | 'likely' | 'unsure' {
  if (score >= 0.7) return 'high';
  if (score >= 0.55) return 'likely';
  return 'unsure';
}

function POSMatchSuggestionsCard({
  suggestions,
  decisions,
  catalogue,
  onApply,
  onSkip,
  onApplyAll,
  onUndo,
}: {
  suggestions: POSMatchSuggestion[];
  /** Per-row decision keyed by `posItemId`. Undefined = pending. */
  decisions: Record<string, 'applied' | 'skipped'>;
  /** The full searchable list behind "None of these" — every product
   *  and recipe in the account, not just the suggested candidates. */
  catalogue: POSMatchCandidate[];
  onApply: (suggestion: POSMatchSuggestion) => void;
  onSkip: (posItemId: string) => void;
  /** Bulk-link: receives the resolved rows (with any dropdown
   *  corrections). Not-sure rows are never included. */
  onApplyAll: (rows: POSMatchSuggestion[]) => void;
  onUndo: (posItemId: string) => void;
}) {
  /** Per-row target correction picked from the dropdown. */
  const [chosen, setChosen] = useState<Record<string, POSMatchCandidate>>({});
  const [dropdownFor, setDropdownFor] = useState<string | null>(null);
  /** Row currently in "browse the full list" mode (subset of dropdownFor). */
  const [browseFor, setBrowseFor] = useState<string | null>(null);
  const [browseQuery, setBrowseQuery] = useState('');

  const closeDropdown = () => {
    setDropdownFor(null);
    setBrowseFor(null);
    setBrowseQuery('');
  };

  const total = suggestions.length;
  const appliedCount = suggestions.filter((s) => decisions[s.posItemId] === 'applied').length;
  const skippedCount = suggestions.filter((s) => decisions[s.posItemId] === 'skipped').length;
  const pendingCount = total - appliedCount - skippedCount;
  const allHandled = pendingCount === 0;

  /** The row with any dropdown correction folded in. */
  const resolved = (s: POSMatchSuggestion): POSMatchSuggestion => {
    const pick = chosen[s.posItemId];
    if (!pick) return s;
    return { ...s, productId: pick.id, productName: pick.name, targetType: pick.type };
  };

  const confidentPending = suggestions.filter(
    (s) => !decisions[s.posItemId] && posMatchTier(s.score) !== 'unsure',
  );
  const unsurePending = pendingCount - confidentPending.length;

  return (
    <CardShell
      icon={EdifyMark}
      title="POS matches found"
      subtitle={
        allHandled
          ? `${appliedCount} linked · ${skippedCount} skipped`
          : `${total} to review. Link one by one, or all the confident ones at once.${unsurePending > 0 ? ` ${unsurePending} need${unsurePending === 1 ? 's' : ''} your call.` : ''}`
      }
      state={allHandled ? 'confirmed' : 'pending'}
      confirmLabel={
        confidentPending.length === 1
          ? 'Link 1 confident match'
          : `Link ${confidentPending.length} confident matches`
      }
      confirmDisabled={confidentPending.length === 0}
      onConfirm={() => onApplyAll(confidentPending.map(resolved))}
    >
      {/* Suggestion rows */}
      <div style={{ margin: '-12px' }}>
        {suggestions.map((s, i) => {
          const decision = decisions[s.posItemId];
          const isApplied = decision === 'applied';
          const isSkipped = decision === 'skipped';
          const tier = posMatchTier(s.score);
          const rs = resolved(s);
          const target: POSMatchCandidate = { id: rs.productId, name: rs.productName, type: rs.targetType ?? 'Product' };
          const candidates: POSMatchCandidate[] = [
            { id: s.productId, name: s.productName, type: s.targetType ?? 'Product' },
            ...(s.alternatives ?? []),
          ];
          const dropdownOpen = dropdownFor === s.posItemId;
          const browsing = browseFor === s.posItemId;
          const query = browseQuery.trim().toLowerCase();
          const browseResults = (query
            ? catalogue.filter((c) => c.name.toLowerCase().includes(query))
            : catalogue
          ).slice(0, 30);
          return (
            <div
              key={s.posItemId}
              style={{
                padding: '10px 14px',
                borderBottom:
                  i < suggestions.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                background: isSkipped ? '#FBFAF8' : '#fff',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {/* One readable line: POS name · kind · confidence · target
                  field · actions — same anatomy as the Sync & match sheet. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, fontSize: '12.5px' }}>
                <span
                  style={{
                    flex: '1 1 30%',
                    minWidth: 0,
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.posItemName}
                </span>
                <PosKindChip kind={s.posType ?? 'Menu item'} />
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color:
                      tier === 'high'
                        ? 'var(--color-accent-active)'
                        : tier === 'likely'
                          ? 'var(--color-text-muted)'
                          : '#B45309',
                    padding: '1px 6px',
                    borderRadius: 100,
                    border: `1px solid ${
                      tier === 'high'
                        ? 'var(--color-accent-active)'
                        : tier === 'likely'
                          ? 'var(--color-border-subtle)'
                          : '#E8A03D'
                    }`,
                    background: tier === 'unsure' ? '#FFF9F0' : '#fff',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {tier === 'high' ? 'High' : tier === 'likely' ? 'Likely' : 'Not sure'}
                </span>
                {decision ? (
                  <span
                    style={{
                      flex: '1 1 40%',
                      minWidth: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 8px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border-subtle)',
                      background: isSkipped ? 'transparent' : '#F4FBF6',
                    }}
                  >
                    {isApplied && (
                      <CheckCircle2 size={12} strokeWidth={2.2} color="#166534" style={{ flexShrink: 0 }} />
                    )}
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textDecoration: isSkipped ? 'line-through' : 'none',
                      }}
                    >
                      {target.name}
                    </span>
                    <PosTypeChip type={target.type} />
                  </span>
                ) : (
                  /* Change-target trigger — the suggestion is editable in
                     place (rule #6): pick a different product / recipe /
                     master product if the match is wrong. The candidate
                     list expands inline below (never floats over the card). */
                  <span style={{ flex: '1 1 40%', minWidth: 0, display: 'inline-flex' }}>
                    <button
                      type="button"
                      onClick={() => (dropdownOpen ? closeDropdown() : setDropdownFor(s.posItemId))}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                        minWidth: 0,
                        padding: '3px 8px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.14))',
                        background: dropdownOpen ? 'rgba(0,28,53,0.04)' : '#fff',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {target.name}
                      </span>
                      <PosTypeChip type={target.type} />
                      <ChevronDown
                        size={12}
                        strokeWidth={2.2}
                        color="var(--color-text-muted)"
                        style={{ flexShrink: 0, transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
                      />
                    </button>
                  </span>
                )}
                {decision && (
                  <button
                    type="button"
                    onClick={() => {
                      onUndo(s.posItemId);
                      if (isApplied) setDropdownFor(s.posItemId);
                    }}
                    style={{
                      flexShrink: 0,
                      padding: 0,
                      background: 'transparent',
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {isApplied ? 'Change' : 'Undo'}
                  </button>
                )}
              </div>

              {/* Actions on their own row so the match line stays readable. */}
              {!decision && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => onApply(resolved(s))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 12px',
                      borderRadius: '999px',
                      border: 'none',
                      background: 'var(--color-accent-active)',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <Check size={10} strokeWidth={2.6} />
                    Link
                  </button>
                  <button
                    type="button"
                    onClick={() => onSkip(s.posItemId)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '999px',
                      border: '1px solid var(--color-border-subtle)',
                      background: '#fff',
                      color: 'var(--color-text-secondary)',
                      fontSize: '11px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    Skip
                  </button>
                </div>
              )}

              {/* Inline candidate list — expands within the row and pushes
                  the actions down instead of floating over the card.
                  Two modes: my suggestions, or browse the full list. */}
              {!decision && dropdownOpen && (
                <div style={{
                  background: '#fff',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.12))',
                  overflow: 'hidden',
                }}>
                  {!browsing ? (
                    <>
                      {candidates.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setChosen((prev) => ({ ...prev, [s.posItemId]: c }));
                            closeDropdown();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            padding: '7px 10px',
                            border: 'none',
                            borderBottom: '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))',
                            background: c.id === target.id ? 'rgba(0,28,53,0.04)' : '#fff',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: 'var(--font-primary)',
                          }}
                        >
                          <span style={{ flex: 1, minWidth: 0, fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name}
                          </span>
                          <PosTypeChip type={c.type} />
                          {c.id === target.id && <Check size={12} strokeWidth={2.6} color="var(--color-accent-active, #001C35)" />}
                        </button>
                      ))}
                      {/* Escape hatch: my shortlist is wrong — search everything. */}
                      <button
                        type="button"
                        onClick={() => setBrowseFor(s.posItemId)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          width: '100%',
                          padding: '8px 10px',
                          border: 'none',
                          background: 'rgba(0,28,53,0.02)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'var(--font-primary)',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--color-accent-active, #001C35)',
                        }}
                      >
                        <Search size={12} strokeWidth={2.2} />
                        None of these? Browse the full list
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Browse header: back link + live search over everything. */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 10px',
                        borderBottom: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
                        background: 'rgba(0,28,53,0.02)',
                      }}>
                        <button
                          type="button"
                          onClick={() => { setBrowseFor(null); setBrowseQuery(''); }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: 0,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--color-text-muted)',
                          }}
                          aria-label="Back to suggestions"
                        >
                          <ChevronDown size={13} strokeWidth={2.2} style={{ transform: 'rotate(90deg)' }} />
                        </button>
                        <input
                          autoFocus
                          value={browseQuery}
                          onChange={(e) => setBrowseQuery(e.target.value)}
                          placeholder="Search your recipes and products…"
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontSize: '12.5px',
                            fontFamily: 'var(--font-primary)',
                            color: 'var(--color-text-primary)',
                          }}
                        />
                      </div>
                      <div style={{ maxHeight: '204px', overflowY: 'auto' }}>
                        {browseResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setChosen((prev) => ({ ...prev, [s.posItemId]: c }));
                              closeDropdown();
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              width: '100%',
                              padding: '7px 10px',
                              border: 'none',
                              borderBottom: '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))',
                              background: c.id === target.id ? 'rgba(0,28,53,0.04)' : '#fff',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontFamily: 'var(--font-primary)',
                            }}
                          >
                            <span style={{ flex: 1, minWidth: 0, fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.name}
                            </span>
                            <PosTypeChip type={c.type} />
                          </button>
                        ))}
                        {browseResults.length === 0 && (
                          <div style={{ padding: '10px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            Nothing matches “{browseQuery}”.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

/** Card pushed into the chat once the new-supplier flow has "parsed"
 *  both attached files. Shows the supplier-detail grid, an
 *  expandable 20-product catalogue inspector, and the site picker.
 *  One CTA confirms the supplier + every product in one go. */
function NewSupplierImportCard({
  data,
  products,
  expandedIndex,
  onToggleExpandRow,
  onEditProduct,
  onRemoveProduct,
  sites,
  onToggleSite,
  onToggleAll,
  catalogueOpen,
  onToggleCatalogue,
  confirmed,
  onConfirm,
}: {
  data: ExtractedSupplierSheet;
  /** Live mutable product list — operator edits/removals are
   *  applied here, not on `data.products`. Falls back to the parsed
   *  catalogue at the call-site. */
  products: ExtractedSupplierProduct[];
  /** Index of the currently-expanded edit row (single row at a time),
   *  or `null` if everything is collapsed. */
  expandedIndex: number | null;
  onToggleExpandRow: (index: number) => void;
  onEditProduct: (index: number, patch: Partial<ExtractedSupplierProduct>) => void;
  onRemoveProduct: (index: number) => void;
  sites: Set<string>;
  onToggleSite: (site: string) => void;
  onToggleAll: (all: boolean) => void;
  catalogueOpen: boolean;
  onToggleCatalogue: () => void;
  confirmed: boolean;
  onConfirm: () => void;
}) {
  const allOn = sites.size === ALL_SUPPLIER_SITES.length;
  const previewProducts = products.slice(0, 3);
  const remaining = products.length - previewProducts.length;
  return (
    <CardShell
      icon={FileText}
      title="Adding new supplier"
      subtitle={`Parsed in 1.8s · ${data.supplierFileName} + ${data.catalogueFileName}`}
      state={confirmed ? 'confirmed' : 'pending'}
      confirmLabel={`Add supplier + ${products.length} products${sites.size > 0 ? ` to ${sites.size} ${sites.size === 1 ? 'site' : 'sites'}` : ''}`}
      confirmDisabled={sites.size === 0 || products.length === 0}
      onConfirm={onConfirm}
    >
      {/* Supplier details */}
      <div style={{ padding: '0 2px 4px' }}>
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <EdifyMark size={11} />
          Supplier details
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px 16px',
            fontSize: '12.5px',
          }}
        >
          <DetailRow label="Name" value={data.name} />
          <DetailRow label="Short code" value={data.shortCode} />
          <DetailRow label="Categories" value={data.categories.join(', ')} />
          <DetailRow label="Order email" value={data.email ?? '—'} />
          <DetailRow label="Contact" value={data.contactName ?? '—'} />
          <DetailRow label="Phone" value={data.phone ?? '—'} />
          <DetailRow label="Accounts email" value={data.accountsEmail ?? '—'} />
          <DetailRow label="Account number" value={data.companyAccountNumber ?? '—'} />
          <DetailRow
            label="Cut-off · lead time"
            value={`${data.cutOffTime ?? '—'} · ${data.leadTimeDays ?? '—'}d`}
          />
          <DetailRow
            label="Min order"
            value={data.minimumOrderValue ? `£${data.minimumOrderValue.toFixed(0)}` : '—'}
          />
          <DetailRow
            label="Delivery days"
            value={data.deliveryDays && data.deliveryDays.length ? data.deliveryDays.join(', ') : '—'}
          />
        </div>
      </div>

      {/* Catalogue — collapsible */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border-subtle)' }}>
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <EdifyMark size={11} />
          Catalogue
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: '10px',
            background: '#fff',
            border: '1.5px solid var(--color-accent-active)',
          }}
        >
          <Package size={14} strokeWidth={1.9} color="var(--color-accent-active)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              <strong>{products.length} products</strong> parsed from {data.catalogueFileName}
            </div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                marginTop: '1px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {previewProducts.map((p) => p.name.replace(/ \d.+$/, '')).join(' · ')}
              {remaining > 0 ? ` · +${remaining} more` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleCatalogue}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 11px',
              borderRadius: '999px',
              border: '1px solid var(--color-accent-active)',
              background: catalogueOpen ? 'var(--color-accent-active)' : '#fff',
              fontSize: '11.5px',
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              color: catalogueOpen ? '#fff' : 'var(--color-accent-active)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 0.12s ease, color 0.12s ease',
            }}
          >
            {catalogueOpen ? 'Hide' : `View all ${products.length}`}
            <ChevronDown
              size={12}
              strokeWidth={2.2}
              style={{
                transform: catalogueOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>
        </div>

        {/* Expanded product list */}
        {catalogueOpen && (
          <div
            style={{
              marginTop: '8px',
              borderRadius: '10px',
              border: '1px solid var(--color-border-subtle)',
              overflow: 'hidden',
              fontSize: '12px',
            }}
          >
            {/* Header row — extra trailing column reserves space for
                the per-row expand chevron so summary + header line up. */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr 90px 110px 80px 22px',
                gap: '8px',
                padding: '8px 12px',
                background: 'var(--color-bg-hover)',
                borderBottom: '1px solid var(--color-border-subtle)',
                fontSize: '10.5px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
              }}
            >
              <span>#</span>
              <span>Product</span>
              <span>Code</span>
              <span>Pack</span>
              <span style={{ textAlign: 'right' }}>£/pack</span>
              <span />
            </div>
            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {products.map((p, i) => {
                const isOpen = expandedIndex === i;
                return (
                  <div
                    key={p.supplierCode + ':' + i}
                    style={{
                      borderBottom:
                        i < products.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                      background: isOpen ? 'rgba(0,28,53,0.03)' : '#fff',
                    }}
                  >
                    {/* Summary row — the whole row is the click target
                        so operators don't have to aim for the chevron. */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onToggleExpandRow(i)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onToggleExpandRow(i);
                        }
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '32px 1fr 90px 110px 80px 22px',
                        gap: '8px',
                        alignItems: 'center',
                        padding: '8px 12px',
                        cursor: confirmed ? 'default' : 'pointer',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isOpen && !confirmed) {
                          (e.currentTarget as HTMLDivElement).style.background =
                            'var(--color-bg-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isOpen) {
                          (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                        }
                      }}
                    >
                      <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {p.name}
                        </div>
                        {p.allergens.length > 0 && (
                          <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
                            Allergens: {p.allergens.join(', ')}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-mono, ui-monospace, "SF Mono", monospace)', color: 'var(--color-text-secondary)' }}>
                        {p.supplierCode}
                      </span>
                      <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                        {p.packQty} × {p.singleUnitVolumeOrWeight ?? 1}{p.unitOfMeasure === 'L' ? 'L' : (p.unitOfMeasure ?? '')}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'right' }}>
                        £{p.packCost.toFixed(2)}
                      </span>
                      <ChevronDown
                        size={13}
                        strokeWidth={2.2}
                        color="var(--color-text-muted)"
                        style={{
                          justifySelf: 'end',
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s ease',
                        }}
                      />
                    </div>
                    {isOpen && (
                      <SupplierProductEditPanel
                        product={p}
                        confirmed={confirmed}
                        onEdit={(patch) => onEditProduct(i, patch)}
                        onRemove={() => onRemoveProduct(i)}
                        onClose={() => onToggleExpandRow(i)}
                      />
                    )}
                  </div>
                );
              })}
              {products.length === 0 && (
                <div
                  style={{
                    padding: '14px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--color-text-muted)',
                    textAlign: 'center',
                  }}
                >
                  All products removed from this import.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sites picker */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border-subtle)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px',
          }}
        >
          <div
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
            }}
          >
            Which stores will use this supplier?
          </div>
          <button
            type="button"
            onClick={() => onToggleAll(!allOn)}
            disabled={confirmed}
            style={{
              padding: '3px 10px',
              borderRadius: '999px',
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-secondary)',
              cursor: confirmed ? 'not-allowed' : 'pointer',
            }}
          >
            {allOn ? 'None' : 'All'}
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {ALL_SUPPLIER_SITES.map((site) => {
            const on = sites.has(site);
            return (
              <button
                key={site}
                type="button"
                onClick={() => onToggleSite(site)}
                disabled={confirmed}
                style={{
                  padding: '5px 12px',
                  borderRadius: '999px',
                  border: on ? '2px solid var(--color-accent-active)' : '1.5px solid var(--color-border)',
                  background: on ? 'var(--color-accent-active)' : '#fff',
                  fontSize: '12px',
                  fontWeight: on ? 700 : 500,
                  fontFamily: 'var(--font-primary)',
                  color: on ? '#fff' : 'var(--color-text-secondary)',
                  cursor: confirmed ? 'not-allowed' : 'pointer',
                  transition: 'background 0.12s ease, border-color 0.12s ease',
                }}
              >
                {site}
              </button>
            );
          })}
        </div>
      </div>

    </CardShell>
  );
}

// ─── Production flow components ──────────────────────────────────────────────

function PillPicker({ title, options, selected, onSelect, onConfirm, state }: { title: string; options: string[]; selected: string; onSelect: (o: string) => void; onConfirm: () => void; state: CardState }) {
  const [customVal, setCustomVal] = useState('');
  const isCustomSelected = selected !== '' && !options.includes(selected);
  const disabled = state !== 'pending';
  return (
    <CardShell
      icon={Timer}
      title={title}
      state={state}
      confirmLabel={selected ? `Confirm ${selected}` : 'Confirm'}
      confirmDisabled={!selected}
      onConfirm={onConfirm}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <PillRow
          options={options.map(o => ({ value: o, label: o }))}
          selected={isCustomSelected ? undefined : selected}
          onSelect={(o) => { setCustomVal(''); onSelect(o); }}
          disabled={disabled}
        />
        <input
          type="text"
          value={customVal}
          disabled={disabled}
          onChange={(e) => { setCustomVal(e.target.value); if (e.target.value.trim()) onSelect(e.target.value.trim()); }}
          placeholder="Other…"
          style={{ width: '82px', padding: '6px 12px', borderRadius: '100px', border: isCustomSelected ? '2px solid var(--color-accent-active)' : '1.5px solid var(--color-border)', background: isCustomSelected ? 'rgba(34,68,68,0.04)' : '#fff', fontSize: '13px', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', outline: 'none' }}
        />
      </div>
    </CardShell>
  );
}

function BatchAndCarryCard({ settings, onUpdate, onConfirm, state }: { settings: ProdSettings; onUpdate: (u: Partial<ProdSettings>) => void; onConfirm: () => void; state: CardState }) {
  const disabled = state !== 'pending';
  const btnStyle: React.CSSProperties = { width: '28px', height: '28px', borderRadius: '8px', border: '1px solid var(--color-border)', background: '#fff', fontFamily: 'var(--font-primary)', fontSize: '16px', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-primary)', flexShrink: 0 };
  return (
    <CardShell
      icon={Layers}
      title="Batch & carry-over"
      state={state}
      confirmLabel="Confirm"
      onConfirm={onConfirm}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', borderBottom: '1px solid var(--color-border-subtle)' }}>
        {[{ label: 'Min batch', key: 'batchMin' as const }, { label: 'Max batch', key: 'batchMax' as const }].map(({ label, key }, i) => (
          <div key={key} style={{ padding: '12px 14px', borderRight: i === 0 ? '1px solid var(--color-border-subtle)' : 'none' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {settings[key] === 'unlimited' ? (
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', flex: 1 }}>Unlimited</span>
              ) : (
                <>
                  <button style={btnStyle} disabled={disabled} onClick={() => onUpdate({ [key]: Math.max(key === 'batchMax' ? settings.batchMin : 1, (settings[key] as number) - 1) })}>−</button>
                  <span style={{ fontWeight: 700, fontSize: '18px', minWidth: '28px', textAlign: 'center' }}>{settings[key]}</span>
                  <button style={btnStyle} disabled={disabled} onClick={() => onUpdate({ [key]: (settings[key] as number) + 1 })}>+</button>
                </>
              )}
              {key === 'batchMax' && (
                <button disabled={disabled} onClick={() => onUpdate({ batchMax: settings.batchMax === 'unlimited' ? 10 : 'unlimited' })} style={{ fontSize: '12px', color: 'var(--color-accent-active)', background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-primary)', fontWeight: 600, marginLeft: '2px' }}>
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
          <button style={btnStyle} disabled={disabled} onClick={() => onUpdate({ batchMultiple: Math.max(1, settings.batchMultiple - 1) })}>−</button>
          <span style={{ fontWeight: 700, fontSize: '16px', minWidth: '24px', textAlign: 'center' }}>{settings.batchMultiple}</span>
          <button style={btnStyle} disabled={disabled} onClick={() => onUpdate({ batchMultiple: settings.batchMultiple + 1 })}>+</button>
        </div>
      </div>
      <div style={{ padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Allow carry over</div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>Unsold stock rolls to the next production period</div>
        </div>
        <PillRow
          options={(['Write off', 'Allow carry over'] as const).map(o => ({ value: o, label: o }))}
          selected={settings.allowCarryOver ? 'Allow carry over' : 'Write off'}
          onSelect={(opt) => onUpdate({ allowCarryOver: opt === 'Allow carry over' })}
          disabled={disabled}
          small
        />
      </div>
    </CardShell>
  );
}

function CategoryClosingCard({ settings, onUpdate, onConfirm, state }: { settings: ProdSettings; onUpdate: (u: Partial<ProdSettings>) => void; onConfirm: () => void; state: CardState }) {
  const disabled = state !== 'pending';
  return (
    <CardShell
      icon={Utensils}
      title="Category & closing"
      state={state}
      confirmLabel="Confirm"
      onConfirm={onConfirm}
    >
      <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Recipe category</div>
        <PillRow
          options={CATEGORY_OPTIONS.map(o => ({ value: o, label: o }))}
          selected={settings.category}
          onSelect={(opt) => onUpdate({ category: opt })}
          disabled={disabled}
          small
        />
      </div>
      <div style={{ paddingTop: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Stop production before closing</div>
        <PillRow
          options={CLOSING_RANGE_OPTIONS.map(o => ({ value: o, label: o }))}
          selected={settings.closingRange}
          onSelect={(opt) => onUpdate({ closingRange: opt })}
          disabled={disabled}
          small
        />
      </div>
    </CardShell>
  );
}

function ProductionSummaryCard({ settings, recipeName = 'Chicken & Mayo Sandwich', productClass = 'Food' }: { settings: ProdSettings; recipeName?: string; productClass?: string }) {
  const rows = [
    { label: 'Recipe', value: recipeName, bold: true },
    { label: 'Product class', value: productClass },
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
    <CardShell
      icon={ClipboardList}
      title="Production plan configured"
      state="confirmed"
    >
      <div>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{row.label}</span>
            <span style={{ fontSize: '12px', fontWeight: row.bold ? 700 : 600, color: 'var(--color-text-primary)' }}>{row.value}</span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/** The pre-save review — everything the recipe will be created with,
 *  economics included, on one card. The one field it collects fresh
 *  is the optional method/instructions note ("offer, don't force"). */
function RecipeSaveSummaryCard({
  recipeName,
  productClass,
  yieldQty,
  yieldUom,
  siteNames,
  allergens,
  packaging,
  variableIngredients,
  pricing,
  instructions,
  onInstructionsChange,
  state,
  onConfirm,
}: {
  recipeName: string;
  productClass: string;
  yieldQty: number;
  yieldUom: string;
  siteNames: string[];
  allergens: string[];
  packaging: PackagingRow[];
  variableIngredients: VariableIngredientRow[];
  pricing: LockedPricing | null;
  instructions: string;
  onInstructionsChange: (v: string) => void;
  state: CardState;
  onConfirm: () => void;
}) {
  const disabled = state !== 'pending';
  const packagingCost = packaging.reduce((s, p) => s + packagingLineGBP(p), 0);
  const detailRows: { label: string; value: string }[] = [
    { label: 'Product class', value: productClass },
    { label: 'Yield', value: `${yieldQty} ${yieldUom}` },
    { label: 'Sites', value: siteNames.join(', ') || 'None selected' },
    { label: 'Allergens', value: allergens.length > 0 ? allergens.join(', ') : 'None' },
    {
      label: 'Packaging',
      value: packaging.length > 0
        ? `${packaging.map((p) => (Number(p.qty) || 0) > 1 ? `${p.qty}× ${p.name}` : p.name).join(', ')} · £${packagingCost.toFixed(2)}/serve`
        : 'None',
    },
    ...(variableIngredients.length > 0
      ? [{
          label: 'Variable ingredients',
          value: variableIngredients.map((v) => `${v.name} (${v.type.toLowerCase()})`).join(', '),
        }]
      : []),
    { label: 'Status', value: 'Active on save' },
  ];
  const econRows: { label: string; value: string }[] = pricing
    ? [
        { label: 'Food cost / serve', value: `£${pricing.foodCostGBP.toFixed(2)}` },
        ...(packagingCost > 0 ? [{ label: 'Packaging / serve', value: `£${packagingCost.toFixed(2)}` }] : []),
        { label: `Food cost vs target ${pricing.targetCogsPct}%`, value: `£${pricing.srpExVat.toFixed(2)} SRP ex VAT` },
        { label: `Dine in${pricing.vatPct > 0 ? ` · inc ${pricing.vatPct}% VAT` : ''}`, value: `£${pricing.dineInIncVat.toFixed(2)}` },
        { label: `Takeaway${pricing.vatPct > 0 ? ` · inc ${pricing.vatPct}% VAT` : ' · zero-rated'}`, value: `£${pricing.takeawayIncVat.toFixed(2)}` },
        { label: 'Delivery · inc 20% VAT, net after 30% commission', value: `£${pricing.deliveryIncVat.toFixed(2)} · net £${pricing.deliveryNetGBP.toFixed(2)}` },
      ]
    : [];
  return (
    <CardShell
      icon={ChefHat}
      title={`Save ${recipeName}`}
      state={state}
      confirmLabel="Save recipe"
      onConfirm={onConfirm}
    >
      <div>
        {detailRows.map((row, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', padding: '5px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', flexShrink: 0 }}>{row.label}</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'right' }}>{row.value}</span>
          </div>
        ))}
        {econRows.length > 0 && (
          <div style={{ margin: '10px 0 0', padding: '8px 10px', borderRadius: '8px', background: 'rgba(40,175,201,0.06)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              Economics
            </div>
            {econRows.map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', padding: '3px 0' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{row.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>{row.value}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Method / instructions <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· optional</span>
          </div>
          <textarea
            value={instructions}
            disabled={disabled}
            onChange={(e) => onInstructionsChange(e.target.value)}
            placeholder="e.g. Toast the sourdough, smash the avocado with lemon and salt, finish with chilli flakes…"
            rows={3}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border-subtle)',
              fontSize: '12px',
              fontWeight: 500,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-primary)',
              background: disabled ? 'rgba(0,28,53,0.03)' : '#fff',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>
    </CardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  // End-of-flow confirmation — the app-standard primary button
  // (rounded rect, brand fill, no drop shadow) so it matches every
  // other primary action in the prototype rather than reading as a
  // shoutier one-off. Right-aligned with a check icon.
  return (
    <div
      style={{
        marginBottom: '14px',
        marginTop: '4px',
        display: 'flex',
        justifyContent: 'flex-end',
        maxWidth: '88%',
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '8px 14px',
          borderRadius: '10px',
          border: 'none',
          background: 'var(--color-accent-active)',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          cursor: 'pointer',
        }}
      >
        <CheckCircle2 size={14} strokeWidth={2.4} />
        {label}
      </button>
    </div>
  );
}

// Per-character reveal speed for the streaming bridge text. Tuned so a
// 60-char Quinn sentence takes ~1.1s — long enough to feel like the
// AI is composing the response, short enough that the wizard doesn't
// drag. The caret blinks once or twice during this window.
const STREAM_CHAR_MS = 18;

function useTypewriter(text: string, enabled: boolean): { visible: string; done: boolean } {
  const [count, setCount] = useState(enabled ? 0 : text.length);
  useEffect(() => {
    if (!enabled) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) clearInterval(t);
    }, STREAM_CHAR_MS);
    return () => clearInterval(t);
  }, [text, enabled]);
  return { visible: text.slice(0, count), done: count >= text.length };
}

function StreamingCaret() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: '2px',
        height: '1em',
        marginLeft: '2px',
        verticalAlign: '-0.15em',
        background: 'var(--color-accent-active)',
        animation: 'edify-caret-blink 1s steps(2, start) infinite',
        opacity: 0.85,
      }}
    />
  );
}

function QuinnMessageBody({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const { visible, done } = useTypewriter(text, streaming);
  const parts = visible.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((seg, i) => {
        const bold = seg.match(/^\*\*(.+)\*\*$/);
        if (bold) return <Hi key={i}>{bold[1]}</Hi>;
        return <span key={i}>{seg}</span>;
      })}
      {streaming && !done && <StreamingCaret />}
    </>
  );
}

// ── Eval-harness instrumentation ────────────────────────────────────────────
// Lightweight, prototype-only feedback channel. Every interaction with a
// Quinn response (rate, retry, comment) is mirrored to `window.__quinnEvalLog`
// AND dispatched as a `quinn-eval-feedback` CustomEvent so an external eval
// harness can observe outcomes without reaching into React state.

type EvalRating = 'up' | 'down';

type EvalFeedback = {
  rating?: EvalRating;
  comment?: string;
  /** Number of times the user clicked Retry on this response. */
  retried?: number;
};

type EvalHarnessEntry = {
  ts: number;
  messageId: string;
  action: 'rating' | 'comment' | 'retry';
  rating?: EvalRating | null;
  comment?: string;
};

function recordEvalFeedback(entry: Omit<EvalHarnessEntry, 'ts'>) {
  if (typeof window === 'undefined') return;
  const payload: EvalHarnessEntry = { ts: Date.now(), ...entry };
  const w = window as unknown as { __quinnEvalLog?: EvalHarnessEntry[] };
  w.__quinnEvalLog = w.__quinnEvalLog ?? [];
  w.__quinnEvalLog.push(payload);
  window.dispatchEvent(new CustomEvent('quinn-eval-feedback', { detail: payload }));
}

function ResponseControlButton({
  title,
  active = false,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      style={{
        width: '26px',
        height: '26px',
        borderRadius: '6px',
        border: '1px solid transparent',
        background: active ? 'var(--color-accent-active)' : 'transparent',
        color: active ? '#fff' : 'var(--color-text-muted)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.12s, color 0.12s, border-color 0.12s',
        padding: 0,
      }}
      onMouseEnter={e => {
        if (active) return;
        e.currentTarget.style.background = 'var(--color-bg-hover)';
        e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
      }}
      onMouseLeave={e => {
        if (active) return;
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function ResponseControls({
  messageId,
  feedback,
  commentOpen,
  onRate,
  onRetry,
  onToggleComment,
  onCommentChange,
}: {
  messageId: string;
  feedback?: EvalFeedback;
  commentOpen: boolean;
  onRate: (rating: EvalRating) => void;
  onRetry: () => void;
  onToggleComment: () => void;
  onCommentChange: (text: string) => void;
}) {
  const rating = feedback?.rating;
  const comment = feedback?.comment ?? '';
  const hasComment = comment.trim().length > 0;

  return (
    <div
      data-eval-harness="response-controls"
      data-eval-message-id={messageId}
      style={{
        // Stretch to match the parent (ChatBubble) column so the feedback
        // panel below can run full-width up to the bubble's own cap.
        alignSelf: 'stretch',
        width: '100%',
        maxWidth: '88%',
        display: 'flex', flexDirection: 'column', gap: '6px',
        marginTop: '6px', paddingLeft: '4px',
      }}
    >
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <ResponseControlButton
          title={rating === 'up' ? 'Marked helpful' : 'Helpful'}
          active={rating === 'up'}
          onClick={() => onRate('up')}
        >
          <ThumbsUp size={13} strokeWidth={2} />
        </ResponseControlButton>
        <ResponseControlButton
          title={rating === 'down' ? 'Marked not helpful' : 'Not helpful'}
          active={rating === 'down'}
          onClick={() => onRate('down')}
        >
          <ThumbsDown size={13} strokeWidth={2} />
        </ResponseControlButton>
        <ResponseControlButton title="Retry" onClick={onRetry}>
          <RotateCw size={13} strokeWidth={2} />
        </ResponseControlButton>
        <ResponseControlButton
          title={hasComment ? 'Edit your feedback' : 'Leave feedback'}
          active={commentOpen || hasComment}
          onClick={onToggleComment}
        >
          <MessageSquare size={13} strokeWidth={2} />
        </ResponseControlButton>
        {hasComment && !commentOpen && (
          <span
            style={{
              fontFamily: 'var(--font-primary)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: 'var(--color-accent-active)',
              marginLeft: '4px',
              textTransform: 'uppercase',
            }}
          >
            Thanks — feedback sent
          </span>
        )}
      </div>

      {commentOpen && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: '100%',
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '12px',
            padding: '14px 16px',
            boxShadow: '0 2px 8px rgba(0, 28, 53,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <div
              style={{
                fontFamily: 'var(--font-primary)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
              }}
            >
              Your feedback
            </div>
            <span
              style={{
                fontFamily: 'var(--font-primary)',
                fontSize: '12px',
                color: 'var(--color-text-muted)',
              }}
            >
              What landed, what we could do better.
            </span>
          </div>
          <textarea
            data-eval-harness="response-comment"
            data-eval-message-id={messageId}
            value={comment}
            onChange={e => onCommentChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onToggleComment();
              }
            }}
            placeholder="Tell us how this answer landed — what was useful, what we could do better."
            rows={3}
            autoFocus
            style={{
              width: '100%',
              resize: 'vertical',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontFamily: 'var(--font-primary)',
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'var(--color-text-primary)',
              background: 'var(--color-bg-hover)',
              outline: 'none',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-accent-active)';
              e.currentTarget.style.background = '#fff';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
              e.currentTarget.style.background = 'var(--color-bg-hover)';
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                flex: 1,
                fontFamily: 'var(--font-primary)',
                fontSize: '11px',
                color: 'var(--color-text-muted)',
              }}
            >
              ⌘+Enter to send
            </span>
            <button
              type="button"
              onClick={onToggleComment}
              style={{
                fontFamily: 'var(--font-primary)',
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '7px 12px',
                borderRadius: '8px',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onToggleComment}
              disabled={!comment.trim()}
              style={{
                fontFamily: 'var(--font-primary)',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#fff',
                background: comment.trim()
                  ? 'var(--color-accent-active)'
                  : 'var(--color-border)',
                border: 'none',
                cursor: comment.trim() ? 'pointer' : 'not-allowed',
                padding: '7px 16px',
                borderRadius: '8px',
                transition: 'background 0.15s',
              }}
            >
              Send feedback
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatBubble({
  msg,
  children,
  showSignature = false,
  feedback,
  commentOpen = false,
  onRate,
  onRetry,
  onToggleComment,
  onCommentChange,
}: {
  msg: ChatMsg;
  children?: ReactNode;
  showSignature?: boolean;
  feedback?: EvalFeedback;
  commentOpen?: boolean;
  onRate?: (rating: EvalRating) => void;
  onRetry?: () => void;
  onToggleComment?: () => void;
  onCommentChange?: (text: string) => void;
}) {
  const isUser = msg.role === 'user';
  const showControls =
    !isUser &&
    msg.msgType !== 'analytics-thinking' &&
    msg.msgType !== 'cmd-thinking' &&
    !!onRate &&
    !!onRetry &&
    !!onToggleComment &&
    !!onCommentChange;
  // Only the most recent Quinn response gets the signature, and never the
  // thinking placeholder (which already shows the animated mark inline).
  const showQuinnSignature =
    !isUser &&
    msg.msgType !== 'analytics-thinking' &&
    msg.msgType !== 'cmd-thinking' &&
    showSignature;
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '12px',
    }}>
      <div style={{
        maxWidth: '88%',
        padding: '11px 14px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: isUser ? '#F5F4F2' : '#fff',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: isUser ? 'none' : '0 2px 8px rgba(0, 28, 53,0.08), 0 0 0 1px rgba(0, 28, 53,0.03)',
        fontSize: '13.5px',
        lineHeight: 1.6,
        color: 'var(--color-text-secondary)',
        whiteSpace: 'pre-wrap',
      }}>
        {!isUser && (
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-accent-active)', marginBottom: '6px', letterSpacing: '0.04em' }}>
            EDIFY
          </div>
        )}
        {isUser ? (
          (() => {
            // The new-supplier flow attaches a second filename via
            // cmdArgsJson; parse defensively so unrelated user
            // messages that happen to use cmdArgsJson don't crash.
            let secondAttachment: string | undefined;
            if (msg.cmdArgsJson) {
              try {
                const parsed = JSON.parse(msg.cmdArgsJson) as { secondAttachment?: string };
                secondAttachment = parsed.secondAttachment;
              } catch {
                // ignore — message body still renders normally
              }
            }
            const chips: string[] = [];
            if (msg.attachmentName) chips.push(msg.attachmentName);
            if (secondAttachment) chips.push(secondAttachment);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: chips.length > 0 && msg.text ? '6px' : 0 }}>
                {chips.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {chips.map((chip) => (
                      <div
                        key={chip}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 9px 4px 7px',
                          borderRadius: '999px',
                          background: '#fff',
                          border: '1px solid var(--color-border, rgba(0,28,53,0.18))',
                        }}
                      >
                        <FileText size={12} strokeWidth={1.9} color="var(--color-accent-active)" />
                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-primary)' }}>
                          {chip}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {msg.text && <span>{msg.text}</span>}
              </div>
            );
          })()
        ) : (
          <QuinnMessageBody text={msg.text} streaming={msg.streaming} />
        )}
        {children}
      </div>
      {showControls && onRate && onRetry && onToggleComment && onCommentChange && (
        <ResponseControls
          messageId={msg.id}
          feedback={feedback}
          commentOpen={commentOpen}
          onRate={onRate}
          onRetry={onRetry}
          onToggleComment={onToggleComment}
          onCommentChange={onCommentChange}
        />
      )}
      {showQuinnSignature && (
        <motion.div
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2, ease: 'easeOut' }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '6px',
            paddingLeft: '4px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <EdifyMark size={12} color="var(--color-accent-deep)" strokeWidth={2.2} />
          Edify
        </motion.div>
      )}
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
  /** Called when the user picks a quick-action command from the
   *  `+` popover. The receiver is responsible for running the
   *  command via the command runner. */
  onQuickAction?: (commandId: string) => void;
  /** Shows a "Note for Edify" row in the quick-actions menu that
   *  prefills the composer with "Note: " and focuses it. */
  enableNote?: boolean;
  /** Currently-attached file (from the paperclip button). When set,
   *  the composer renders a chip above the textarea and the Send
   *  button enables even with empty text. */
  attachedFileName?: string | null;
  /** Called when the user picks a file via the paperclip. We pass
   *  only the filename — actual parsing is mocked downstream. */
  onAttachFile?: (fileName: string) => void;
  /** Called when the user clears the attached file chip. */
  onClearAttachment?: () => void;
};

function ClaudeComposer({
  value,
  onChange,
  onSend,
  onAcceptSuggestion,
  disabled,
  placeholder,
  minHeight,
  onQuickAction,
  enableNote,
  attachedFileName,
  onAttachFile,
  onClearAttachment,
}: ComposerProps) {
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  /** Hidden file input — opened by the paperclip button. Any
   *  filename the user picks is mocked into the chat as a supplier
   *  sheet; we never read the file's contents. */
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Local ref to the textarea so the "Note for Edify" quick action
   *  can prefill "Note: " and drop the cursor at the end. */
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function startNote() {
    setQuickActionsOpen(false);
    onChange('Note: ');
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
  }

  // The popover is portalled to document.body so it can escape the
  // composer's `overflow: hidden` rounded wrapper. We compute its
  // position from the trigger button's bounding rect, recomputing on
  // open (also on window resize / scroll for safety).
  const quickActionsTriggerRef = useRef<HTMLButtonElement>(null);
  const quickActionsPopoverRef = useRef<HTMLDivElement>(null);
  const [quickActionsPos, setQuickActionsPos] = useState<{ left: number; bottom: number } | null>(null);

  useEffect(() => {
    if (!quickActionsOpen) {
      setQuickActionsPos(null);
      return;
    }
    function recompute() {
      const btn = quickActionsTriggerRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      setQuickActionsPos({
        left: r.left,
        // `bottom` here is the distance from the viewport bottom — so the
        // popover sits flush with the top of the trigger button + 8px gap.
        bottom: window.innerHeight - r.top + 8,
      });
    }
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [quickActionsOpen]);

  // Click-outside dismissal — applies to both the trigger and the
  // portalled popover.
  useEffect(() => {
    if (!quickActionsOpen) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (quickActionsTriggerRef.current?.contains(target)) return;
      if (quickActionsPopoverRef.current?.contains(target)) return;
      setQuickActionsOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [quickActionsOpen]);
  const hasText = value.trim().length > 0;
  const ghost = getGhostSuggestion(value);
  const fullSuggestion = ghost ? value + ghost : '';

  return (
    <div
      style={{
        width: '100%',
      background: '#fff',
      borderRadius: '20px',
      border: ghost ? '1.5px solid var(--color-accent-mid, rgba(34,68,68,0.35))' : '1.5px solid rgba(0, 28, 53, 1)',
      boxShadow: '0 4px 20px rgba(0, 28, 53,0.09)',
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
            <span style={{ color: 'rgba(0, 28, 53,0.3)', fontStyle: 'normal' }}>{ghost}</span>
          </div>
        )}
        <textarea
          ref={textareaRef}
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
      {/* Attached-file chip — appears between the textarea and the
          button strip when the operator has paperclipped a sheet. */}
      {attachedFileName && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 14px 8px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 8px 5px 10px',
              borderRadius: '999px',
              background: '#fff',
              border: '1px solid var(--color-border, rgba(0,28,53,0.18))',
              maxWidth: '100%',
              minWidth: 0,
            }}
          >
            <FileText size={13} strokeWidth={1.9} color="var(--color-accent-active)" style={{ flexShrink: 0 }} />
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
              }}
            >
              {attachedFileName}
            </span>
            {onClearAttachment && (
              <button
                type="button"
                onClick={onClearAttachment}
                aria-label="Remove attachment"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <X size={11} strokeWidth={2.2} />
              </button>
            )}
          </div>
        </div>
      )}
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
          ref={quickActionsTriggerRef}
          type="button"
          aria-label="Quick actions"
          aria-expanded={quickActionsOpen}
          disabled={disabled}
          onClick={() => setQuickActionsOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            border: 'none',
            background: quickActionsOpen ? 'rgba(40,175,201,0.12)' : 'transparent',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: quickActionsOpen ? 'var(--color-accent-mid, #28AFC9)' : 'var(--color-text-muted)',
            transition: 'background 0.12s ease, color 0.12s ease',
          }}
        >
          <Plus
            size={18}
            strokeWidth={2}
            style={{
              transform: quickActionsOpen ? 'rotate(45deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}
          />
        </button>
        {/* Paperclip — opens a file picker. The actual file isn't
            parsed; the chat-driven "import product from sheet" flow
            mocks an extraction off the filename. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*,.csv,.xlsx,.xls,.txt"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && onAttachFile) onAttachFile(f.name);
            // Clear the input so picking the same file twice still fires.
            e.target.value = '';
          }}
        />
        <button
          type="button"
          aria-label="Attach a file"
          title="Attach a product sheet, email or document"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            border: 'none',
            background: attachedFileName ? 'rgba(40,175,201,0.12)' : 'transparent',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: attachedFileName ? 'var(--color-accent-mid, #28AFC9)' : 'var(--color-text-muted)',
            transition: 'background 0.12s ease, color 0.12s ease',
          }}
        >
          <Paperclip size={16} strokeWidth={2} />
        </button>
        {quickActionsOpen && onQuickAction && quickActionsPos && typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={quickActionsPopoverRef}
              role="menu"
              style={{
                position: 'fixed',
                left: quickActionsPos.left,
                bottom: quickActionsPos.bottom,
                minWidth: '240px',
                zIndex: 9999,
                background: '#fff',
                borderRadius: '14px',
                border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.12))',
                boxShadow: '0 12px 28px rgba(0, 28, 53,0.18)',
                overflow: 'hidden',
                fontFamily: 'var(--font-primary)',
              }}
            >
              {/* Header label matches the "SUGGESTED" / "RECENT
                  CHATS" treatment used in the command-centre two-
                  column block. */}
              <div
                style={{
                  padding: '10px 10px 6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Quick actions
              </div>
              {/* Rows mirror the Suggested column row treatment:
                  bare 15px muted icon, no chip behind it, a 13px /
                  500-weight label, and a neutral hover wash. The
                  popover stays roomier than the inline list with a
                  6px horizontal inset so it feels like its own card,
                  not a list squeezed into a tooltip. */}
              <div style={{ padding: '0 6px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {enableNote && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={startNote}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '6px 8px',
                      border: 'none',
                      borderRadius: '6px',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'var(--font-primary)',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(0,28,53,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <Mic
                      size={15}
                      strokeWidth={1.8}
                      color="var(--color-text-muted)"
                      style={{ flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      Note for Edify
                    </span>
                  </button>
                )}
                {QUICK_ACTION_CHIPS.map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={chip.commandId}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setQuickActionsOpen(false);
                        onQuickAction(chip.commandId);
                      }}
                      style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '6px 8px',
                        border: 'none',
                        borderRadius: '6px',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'var(--font-primary)',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(0,28,53,0.04)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <Icon
                        size={15}
                        strokeWidth={1.8}
                        color="var(--color-text-muted)"
                        style={{ flexShrink: 0 }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {chip.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'flex-end' }}>
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
          {(hasText || !!attachedFileName) && (
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

const SEVERITY_BADGE: Record<IntegritySeverity, { label: string; color: string; bg: string }> = {
  fix: { label: 'Fix', color: '#B01038', bg: 'rgba(220,38,38,0.08)' },
  check: { label: 'Check', color: '#B45309', bg: 'rgba(234, 209, 115, 0.2)' },
  tidy: { label: 'Tidy', color: '#475569', bg: 'rgba(71,85,105,0.08)' },
};

function FindingRow({
  finding,
  live,
  started,
  onFix,
}: {
  finding: IntegrityFinding;
  /** Whether the parent card is still pending (buttons active). */
  live: boolean;
  /** This finding's fix has already been sent to review. */
  started: boolean;
  onFix?: () => void;
}) {
  const badge = SEVERITY_BADGE[finding.severity];
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!(finding.detail || finding.affected);

  return (
    <div style={{ padding: '9px 14px', borderTop: '1px solid var(--color-border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)',
          width: '14px', flexShrink: 0, textAlign: 'right',
        }}>
          {finding.priority}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
              {finding.title}
            </span>
            <span style={{
              padding: '1px 7px', borderRadius: '999px', background: badge.bg,
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em',
              textTransform: 'uppercase', color: badge.color, flexShrink: 0,
            }}>
              {badge.label}
            </span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
            {finding.summary}
          </div>
        </div>
        {finding.fixLabel && (
          started ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0,
              fontSize: '11.5px', fontWeight: 600, color: '#2D6A4F',
            }}>
              <Check size={12} strokeWidth={2.6} /> In review
            </span>
          ) : (
            <button
              type="button"
              disabled={!live}
              onClick={onFix}
              style={{
                padding: '4px 12px', borderRadius: '999px', flexShrink: 0,
                border: 'none',
                background: live ? 'var(--color-accent-active, #001C35)' : 'rgba(0,28,53,0.08)',
                fontSize: '11.5px', fontWeight: 600, fontFamily: 'var(--font-primary)',
                color: live ? '#fff' : 'var(--color-text-muted)',
                cursor: live ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
              }}
            >
              {finding.fixLabel}
            </button>
          )
        )}
      </div>
      {hasDetails && (
        <div style={{ marginLeft: '24px' }}>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              marginTop: '4px', padding: 0, border: 'none', background: 'none',
              fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-muted)', cursor: 'pointer',
            }}
          >
            {expanded ? 'Hide details' : 'Details'}
            <ChevronDown size={11} strokeWidth={2.4} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          {expanded && (
            <div style={{ marginTop: '4px' }}>
              {finding.detail && (
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                  {finding.detail}
                </div>
              )}
              {finding.affected && (
                <div style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '3px', lineHeight: 1.4 }}>
                  {finding.affected}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DataIntegrityCard({
  state,
  isFindingStarted,
  onFixFinding,
  onFixAll,
}: {
  state: CardState;
  isFindingStarted: (findingId: string) => boolean;
  onFixFinding: (findingId: string) => void;
  onFixAll: () => void;
}) {
  const live = state === 'pending';

  return (
    <CardShell
      icon={ShieldCheck}
      title="Recipe & cost review: Soho"
      subtitle="Mostly clean. Work the list top to bottom."
      state={state}
      confirmLabel="Fix these"
      onConfirm={onFixAll}
    >
      <div style={{ margin: '-12px' }}>
        {/* Headline stats — the "your recipes are mostly clean" reassurance
            before the to-do list. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--color-border-subtle)' }}>
          {INTEGRITY_STATS.map((s) => (
            <div key={s.label} style={{ background: '#fff', padding: '10px 12px' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.15 }}>
                {s.value}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
        {INTEGRITY_FINDINGS.map((f) => (
          <FindingRow
            key={f.id}
            finding={f}
            live={live}
            started={isFindingStarted(f.id)}
            onFix={f.fixLabel ? () => onFixFinding(f.id) : undefined}
          />
        ))}
        {/* Trust caveat from the audit appendix — ranking reliable, exact £ not. */}
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border-subtle)', fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          £ figures are supplier list prices, not your real cost. Read them as a ranking.
        </div>
      </div>
    </CardShell>
  );
}

// ─── Analytics thinking bubble ───────────────────────────────────────────────

const THINKING_PHRASES_ANALYTICS = [
  'Pulling your data\u2026',
  'Crunching numbers\u2026',
  'Building your chart\u2026',
];

// Used between wizard/command steps. Same animated mark, but the
// copy reads as "I'm preparing your next question" rather than
// "I'm running an analytical query".
const THINKING_PHRASES_STEP = [
  'Setting up the next step\u2026',
  'Lining up your next question\u2026',
];

function QuinnThinkingContent({ variant = 'analytics' }: { variant?: 'analytics' | 'step' }) {
  const phrases =
    variant === 'step' ? THINKING_PHRASES_STEP : THINKING_PHRASES_ANALYTICS;
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setPhraseIdx(i => (i + 1) % phrases.length);
    }, 2400);
    return () => clearInterval(t);
  }, [phrases.length]);

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
            {phrases[phraseIdx]}
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

export type ChartPinTarget = {
  id: string;
  label: string;
};

function AnalyticsChartContent({
  chartId,
  pinnedTargetIds,
  pinTargets,
  defaultPinTargetId,
  onAddToTarget,
  onAddToNewView,
  pinLabel,
  pinnedLabel,
}: {
  chartId: AnalyticsChartId;
  /** Targets this chart is already pinned into during this session. */
  pinnedTargetIds: Set<string>;
  /** When set, render a dropdown of view targets. Otherwise show the simple
   *  single-target button (legacy dashboard flow). */
  pinTargets?: ChartPinTarget[];
  defaultPinTargetId?: string;
  onAddToTarget: (targetId: string) => void;
  onAddToNewView?: () => void;
  pinLabel: string;
  pinnedLabel: string;
}) {
  const hasMultiTarget = !!pinTargets && pinTargets.length > 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const defaultTarget =
    pinTargets?.find((t) => t.id === defaultPinTargetId) ?? pinTargets?.[0] ?? null;
  const isDefaultPinned = defaultTarget ? pinnedTargetIds.has(defaultTarget.id) : false;
  const allPinned =
    hasMultiTarget && pinTargets!.every((t) => pinnedTargetIds.has(t.id));

  // Single-target mode: simple Add-to-dashboard button (legacy / non-MVP1 flows).
  if (!hasMultiTarget) {
    const isPinned = isDefaultPinned || pinnedTargetIds.size > 0;
    return (
      <div style={{ marginTop: '10px' }}>
        <div style={chartFrameStyle}>
          {renderAnalyticsChart(chartId)}
          {analyticsChartLegend(chartId)}
        </div>
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => onAddToTarget(defaultPinTargetId ?? 'dashboard')}
            disabled={isPinned}
            style={pinButtonStyle(isPinned)}
          >
            <Pin size={12} strokeWidth={2} />
            {isPinned ? pinnedLabel : pinLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '10px' }}>
      <div style={chartFrameStyle}>
        {renderAnalyticsChart(chartId)}
        {analyticsChartLegend(chartId)}
      </div>
      <div
        ref={wrapperRef}
        style={{
          marginTop: '10px',
          display: 'flex',
          justifyContent: 'flex-end',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          disabled={allPinned}
          style={pinButtonStyle(allPinned, true)}
        >
          <Pin size={12} strokeWidth={2} />
          <span>
            {allPinned
              ? 'Pinned to all views'
              : isDefaultPinned
                ? `Pin to another view`
                : pinLabel}
          </span>
          <ChevronDown size={12} strokeWidth={2.2} />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                right: 0,
                zIndex: 10,
                background: '#fff',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 10,
                boxShadow: '0 10px 30px rgba(0, 28, 53,0.12)',
                padding: 4,
                minWidth: 200,
                fontFamily: 'var(--font-primary)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                  padding: '6px 10px 4px',
                }}
              >
                Pin to view
              </div>
              {pinTargets!.map((t) => {
                const pinned = pinnedTargetIds.has(t.id);
                const isDefault = t.id === defaultPinTargetId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={pinned}
                    onClick={() => {
                      onAddToTarget(t.id);
                      setMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: pinned ? 'var(--color-success-light, #e3f2e8)' : '#fff',
                      color: pinned ? '#166534' : 'var(--color-text-primary)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: pinned ? 'default' : 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (!pinned) e.currentTarget.style.background = 'var(--color-bg-surface, #f8fafc)';
                    }}
                    onMouseLeave={(e) => {
                      if (!pinned) e.currentTarget.style.background = '#fff';
                    }}
                  >
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {t.label}
                      {isDefault && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            fontWeight: 600,
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          · current
                        </span>
                      )}
                    </span>
                    {pinned && (
                      <CheckCircle2 size={13} strokeWidth={2.2} color="#166534" />
                    )}
                  </button>
                );
              })}
              {onAddToNewView && (
                <>
                  <div
                    style={{
                      height: 1,
                      background: 'var(--color-border-subtle)',
                      margin: '4px 0',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onAddToNewView();
                      setMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#fff',
                      color: 'var(--color-text-primary)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-bg-surface, #f8fafc)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
                    }}
                  >
                    <Plus size={13} strokeWidth={2.2} />
                    <span>New view…</span>
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const chartFrameStyle: React.CSSProperties = {
  borderRadius: '10px',
  border: '1px solid var(--color-border-subtle)',
  overflow: 'hidden',
  background: '#fff',
  padding: '12px 8px 8px',
};

function pinButtonStyle(isPinned: boolean, withChevron = false): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: withChevron ? '5px' : '6px',
    padding: '7px 14px',
    borderRadius: '100px',
    border: isPinned ? 'none' : '1.5px solid var(--color-border)',
    background: isPinned ? 'var(--color-success-light, #e3f2e8)' : '#fff',
    color: isPinned ? '#166534' : 'var(--color-text-secondary)',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    cursor: isPinned ? 'default' : 'pointer',
  };
}

/**
 * Returns a short, source-aware "what stands out" insight for a Quinn-built
 * table preview. We don't actually inspect the rows in this prototype — we
 * just pick a canned observation per primary data source so the chat feels
 * like Quinn is reading the result.
 */
function insightForTableQuery(query: TableQuery): string {
  const primary = query.sources[0];
  const isMultiSource = query.sources.length > 1;
  if (isMultiSource) {
    return [
      "I joined these sources on **site** and **date** so you can compare them side-by-side.",
      "A couple of things to look at: which sites show waste creeping up alongside flat sales, and where labour spend is rising faster than revenue.",
      "Want me to add a filter, group by region, or surface the worst-performing rows?",
    ].join(' ');
  }
  switch (primary) {
    case 'flashReport':
      return [
        "A few things stand out from the flash report: most sites are tracking close to plan, but **Carlton's food cost** has crept up about 3 points week-on-week — worth a closer look.",
        "Want me to add a margin column, filter to underperformers, or compare against last week?",
      ].join(' ');
    case 'sales':
      return [
        "Weekend trade is your bright spot here — Saturday afternoons consistently lead the week, especially at **Fitzroy**.",
        "Want me to group this by daypart, add a 7-day moving average, or split out by site?",
      ].join(' ');
    case 'waste':
      return [
        "**Bakery** is your largest waste category by value, and a couple of stores show repeat overproduction late in the week.",
        "Want me to filter to bakery only, group by site, or rank by total waste cost?",
      ].join(' ');
    case 'labour':
      return [
        "Labour ratio is climbing fastest at **Fitzroy**, and on Tuesdays your staffing peaks aren't quite lining up with sales peaks.",
        "Want me to add a sales-vs-labour ratio, group by daypart, or filter to overstaffed shifts?",
      ].join(' ');
    default:
      return "Looks like a clean dataset to start from. Tell me what you'd like to slice — by site, by date, by category — and I'll rebuild it.";
  }
}

function TableResultBlock({
  title,
  tableQuery,
  prompt,
  onPinTable,
  onOpenTableInNewView,
}: {
  title: string;
  tableQuery: TableQuery;
  prompt: string;
  onPinTable?: (info: { title: string; query: TableQuery; prompt: string }) => void;
  onOpenTableInNewView?: (info: { title: string; query: TableQuery; prompt: string }) => void;
}) {
  const [columns, setColumns] = useState<Column[] | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    runQuery(tableQuery)
      .then((result) => {
        if (cancelled) return;
        setColumns(result.columns);
        setRows(result.rows);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to run query';
        setError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [tableQuery]);

  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          borderRadius: 10,
          border: '1px solid var(--color-border-subtle)',
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        <div style={{ maxHeight: 280, overflow: 'auto' }}>
          <DataTable
            columns={columns ?? []}
            data={rows ?? []}
            loading={(rows === null || columns === null) && !error}
            error={error}
          />
        </div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {onOpenTableInNewView && (
          <button
            type="button"
            onClick={() =>
              onOpenTableInNewView({ title, query: tableQuery, prompt })
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 100,
              border: '1.5px solid var(--color-border)',
              background: '#fff',
              color: 'var(--color-text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            <LayoutDashboard size={12} strokeWidth={2} />
            Open as new view
          </button>
        )}
        {onPinTable && (
          <button
            type="button"
            onClick={() => {
              if (pinned) return;
              onPinTable({ title, query: tableQuery, prompt });
              setPinned(true);
            }}
            disabled={pinned}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 100,
              border: pinned ? 'none' : '1.5px solid var(--color-border)',
              background: pinned ? 'var(--color-success-light, #e3f2e8)' : '#fff',
              color: pinned ? '#166534' : 'var(--color-text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: pinned ? 'default' : 'pointer',
            }}
          >
            <Pin size={12} strokeWidth={2} />
            {pinned ? 'Pinned to view' : 'Pin to current view'}
          </button>
        )}
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
  autoSendTableQuery,
  autoSendTableTitle,
  alreadyPinned,
  autoStartFlow,
  enableNoteCapture,
  onUserMessageCountChange,
  onPinTable,
  onOpenTableInNewView,
  pinTarget = 'dashboard',
  pinTargets,
  defaultPinTargetId,
  onAddChartToTarget,
  onAddChartToNewView,
}: {
  briefingRole: BriefingRole;
  quinnExpanded?: boolean;
  onToggleQuinnExpand?: () => void;
  onChatStateChange?: (active: boolean) => void;
  noHeader?: boolean;
  onAddToDashboard?: (id: AnalyticsChartId) => void;
  onViewDashboard?: () => void;
  /** Where chat-pinned charts go: the legacy dashboard layout or the
   *  currently-active MVP1 view. Drives button copy and post-pin CTA. */
  pinTarget?: 'dashboard' | 'view';
  /** When provided, the pin button becomes a dropdown over these targets
   *  (one entry per dashboard / view). Only relevant in MVP1. */
  pinTargets?: ChartPinTarget[];
  /** Default-highlighted target in the pin dropdown (typically the active view). */
  defaultPinTargetId?: string;
  /** Called when the user picks a target from the pin dropdown. */
  onAddChartToTarget?: (chartId: AnalyticsChartId, targetId: string) => void;
  /** Called when the user picks "New view…" from the pin dropdown. Should
   *  return the new target id so Feed can mark it as pinned in the dropdown. */
  onAddChartToNewView?: (chartId: AnalyticsChartId) => string | undefined;
  seedUserPrompt?: string;
  /** If set, Feed simulates a user send with this text on mount. */
  autoSendPrompt?: string;
  /** Explicit chart for autoSendPrompt: id to force a chart, null for text-only, undefined to fall back to prefix detection. */
  autoSendChartId?: AnalyticsChartId | null;
  /** Explicit table query for autoSendPrompt. When set, Quinn replies with a
   *  table-result message instead of a chart/text. Takes precedence over
   *  autoSendChartId. */
  autoSendTableQuery?: TableQuery;
  /** Optional friendly title for the auto-sent table (e.g. the question text). */
  autoSendTableTitle?: string;
  /** Charts already pinned to the dashboard — their "Add to dashboard" buttons render as already-pinned. */
  alreadyPinned?: Set<AnalyticsChartId>;
  /** If set, auto-start the named guided flow on mount (e.g. from an external "Ask Quinn" entry point). */
  autoStartFlow?: 'recipe' | 'integrity' | 'pos-match';
  /** Shows the "Note for Edify" quick action in the composer. Sending a
   *  message that starts with "Note:" logs it straight to the notebook. */
  enableNoteCapture?: boolean;
  /**
   * Fires whenever the count of user-role messages in the chat changes.
   * Used by AddInsightPopup to detect follow-up activity for history saving.
   */
  onUserMessageCountChange?: (count: number) => void;
  /** Pin a Quinn-built table to the currently active view. */
  onPinTable?: (info: { title: string; query: TableQuery; prompt: string }) => void;
  /** Open a Quinn-built table as its own new view tab. */
  onOpenTableInNewView?: (info: { title: string; query: TableQuery; prompt: string }) => void;
}) {
  const [chatStarted, setChatStarted] = useState(
    !!seedUserPrompt || !!autoSendPrompt || !!autoSendTableQuery,
  );
  const [messages, setMessages] = useState<ChatMsg[]>(() =>
    seedUserPrompt && !autoSendPrompt
      ? [{ id: 'q-seed', role: 'quinn', text: seedUserPrompt }]
      : [],
  );
  const [input, setInput] = useState('');
  /** Filename of the paperclip-attached file. Pure UI state — we
   *  never read the actual file. When set, the composer renders an
   *  attached-file chip and `sendMessage` mocks a supplier-sheet
   *  import flow from this name. */
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  // Anchors for the slash-command typeahead. Two wrappers exist —
  // one in the empty/initial state (above the briefing) and one in
  // the active chat state (the bottom composer dock). Each rendering
  // gets its own ref; SlashMenu portals out of the parent's
  // `overflow: auto` boundary and uses the anchor to position itself.
  const initialComposerWrapperRef = useRef<HTMLDivElement>(null);
  const dockComposerWrapperRef = useRef<HTMLDivElement>(null);
  const [recipeFlow, setRecipeFlow] = useState(0);
  /** "Update recipe" suggestion asks which recipe first; while true the
   *  next composer message is treated as the recipe name and seeded into
   *  the builder (see sendMessage) rather than routed normally. */
  const [awaitingRecipeName, setAwaitingRecipeName] = useState(false);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>(INITIAL_RECIPE_INGREDIENTS);
  /** Per-card site selections for the chat-driven "import product
   *  from sheet" flow. Keyed by the card's message id so multiple
   *  imports stay independent. The selection is seeded to all sites
   *  on card mount — matches the "super fast, ALL stores by default"
   *  brief; the operator only tweaks if they want a subset. */
  const [productImportSites, setProductImportSites] = useState<Record<string, Set<string>>>({});
  /** Per-card confirmed flag. Once an import is confirmed, the card
   *  flips to a `confirmed` style and the bottom CTA becomes "Added". */
  const [productImportConfirmed, setProductImportConfirmed] = useState<Record<string, boolean>>({});
  /** Sibling state for the new-supplier import card. Same key shape
   *  as the product-sheet flow — each card carries its own sites,
   *  catalogue-expanded toggle, and confirmed flag. */
  const [supplierImportSites, setSupplierImportSites] = useState<Record<string, Set<string>>>({});
  const [supplierImportConfirmed, setSupplierImportConfirmed] = useState<Record<string, boolean>>({});
  const [supplierCatalogueOpen, setSupplierCatalogueOpen] = useState<Record<string, boolean>>({});
  /** Live product list per card. Seeded from the parsed catalogue on
   *  flow start; any row-level edits or removals mutate this so the
   *  confirm handler persists the operator's adjustments rather than
   *  the original mock. */
  const [supplierImportProducts, setSupplierImportProducts] = useState<Record<string, ExtractedSupplierProduct[]>>({});
  /** Which row inside the catalogue table is currently expanded for
   *  inline edit. Single index per card (operator focuses on one
   *  product at a time); `null` collapses everything. */
  const [supplierExpandedRow, setSupplierExpandedRow] = useState<Record<string, number | null>>({});
  /** Per-row decisions on the POS-match follow-up card. Outer key is
   *  the card's message id; inner key is the POS button id; value is
   *  the operator's decision. Lets the operator step through, undo,
   *  or pick up later without losing state on re-render. */
  const [posMatchDecisions, setPosMatchDecisions] = useState<Record<string, Record<string, 'applied' | 'skipped'>>>({});
  /** Data-integrity fix flow. `integrityFixStarted` flips the source
   *  integrity card to Done once the operator kicks off the fix;
   *  `batchReviewStates` holds each batch-review card's lifecycle
   *  (pending → confirmed/partial) plus per-row apply results, keyed
   *  by the card's message id. */
  const [integrityFixStarted, setIntegrityFixStarted] = useState<Record<string, boolean>>({});
  const [batchReviewStates, setBatchReviewStates] = useState<Record<string, { state: CardState; results?: BatchRowResult[] }>>({});
  /** Chagee tea-swap demo flow state — per-card confirmation flags
   *  and the franchise selection on the recipe step. Keyed by card
   *  message id, mirroring the other import flows. */
  const [chageeSupplierConfirmed, setChageeSupplierConfirmed] = useState<Record<string, boolean>>({});
  const [chageeRecipeConfirmed, setChageeRecipeConfirmed] = useState<Record<string, boolean>>({});
  const [chageeFranchises, setChageeFranchises] = useState<Record<string, Set<string>>>({});
  /** Stock-take review demo flow state — per-card confirmation
   *  flags, the product selection on the review step, and the
   *  per-product storage-area choices on step 2. Keyed by card
   *  message id. `stockAreaProducts` carries the step-1 selection
   *  (product ids) through to the step-2 card; `stockAreaChoice` maps
   *  productId → areaId inside each card, pre-seeded from Quinn's
   *  suggestions. */
  const [stockReviewSelected, setStockReviewSelected] = useState<Record<string, Set<string>>>({});
  const [stockReviewConfirmed, setStockReviewConfirmed] = useState<Record<string, boolean>>({});
  /** Site-selection step (between product review and storage areas).
   *  `stockSitesProducts` carries the step-1 product ids through this
   *  card to the storage-area step. */
  const [stockSitesSelected, setStockSitesSelected] = useState<Record<string, Set<string>>>({});
  const [stockSitesConfirmed, setStockSitesConfirmed] = useState<Record<string, boolean>>({});
  const [stockSitesProducts, setStockSitesProducts] = useState<Record<string, string[]>>({});
  const [stockAreaChoice, setStockAreaChoice] = useState<Record<string, Record<string, string>>>({});
  const [stockAreaConfirmed, setStockAreaConfirmed] = useState<Record<string, boolean>>({});
  const [stockAreaProducts, setStockAreaProducts] = useState<Record<string, string[]>>({});
  /** Sites chosen on the previous step — carried to the storage-area
   *  card so the final receipt can say how many sites were updated. */
  const [stockAreaSites, setStockAreaSites] = useState<Record<string, string[]>>({});
  /** Snapshot of existing match overrides so we can skip POS buttons
   *  that have already been linked (either by Sync & match, by a
   *  previous chat suggestion, or by hand on the Item matching page). */
  const matchOverrides = useMatchOverrides();
  /** Full live product catalogue — the standalone "Check my POS
   *  matches" flow scans all of it, not just freshly-imported rows. */
  const allProducts = useProducts();
  const allRecipes = useRecipes();
  /** Packaging-category products the packaging picker's "add more"
   *  search offers, priced per each (pack cost ÷ pack qty). */
  const packagingCatalogue = useMemo(
    () =>
      allProducts
        .filter((p) => p.category === 'Packaging' && p.packQty > 0)
        .map((p) => ({
          id: `pkg-${p.id}`,
          name: p.name,
          cost: Math.round((p.packCost / p.packQty) * 100) / 100,
          unit: 'ea',
        })),
    [allProducts],
  );
  /** Everything a POS button could point at — feeds the "None of
   *  these — browse the full list" escape hatch in match triage. */
  const posCatalogue = useMemo<POSMatchCandidate[]>(
    () =>
      [
        ...allProducts.map((p) => ({ id: p.id, name: p.name, type: 'Product' as const })),
        ...allRecipes.map((r) => ({ id: r.id, name: r.name, type: 'Recipe' as const })),
      ].sort((a, b) => a.name.localeCompare(b.name)),
    [allProducts, allRecipes],
  );
  /** Cards that already emitted their completion receipt (rule #2) —
   *  guards against a second receipt when rows are undone/redone. */
  const posMatchReceiptSentRef = useRef<Set<string>>(new Set());
  const [selectedPackaging, setSelectedPackaging] = useState<Set<string>>(new Set());
  /** Working packaging list — the template's rows land as AI
   *  suggestions with a qty; the operator edits qty/unit and can
   *  add more from the packaging catalogue. */
  const [packagingRows, setPackagingRows] = useState<PackagingRow[]>([]);
  /** Per-row channel flags for selected packaging (dine in /
   *  takeaway / delivery). Only the flagged channels carry that
   *  row's cost into their price. */
  const [packagingChannels, setPackagingChannels] = useState<Record<string, PackagingChannels>>({});
  /** True when the operator chose "No packaging needed" — the persisted
   *  packaging card then shows Cancelled instead of Done. */
  const [packagingSkipped, setPackagingSkipped] = useState(false);
  /** Draft yield-loss % per ingredient id, captured on the yield-loss
   *  card then written onto `recipeIngredients` on confirm. */
  const [yieldLossDraft, setYieldLossDraft] = useState<Record<string, string>>({});
  /** True when the yield-loss step was skipped ("no yield loss"). */
  const [yieldLossSkipped, setYieldLossSkipped] = useState(false);
  /** Variable ingredients added in the wizard (extras / replacements). */
  const [variableIngredients, setVariableIngredients] = useState<VariableIngredientRow[]>([]);
  const [variableSkipped, setVariableSkipped] = useState(false);
  const [selectedAllergens, setSelectedAllergens] = useState<Set<string>>(new Set());
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set(['fitzroy']));
  const doneSiteNamesRef = useRef<string[]>(['Fitzroy Espresso']);
  // Recipe wizard: the active template + pricing state. Set on
  // `startRecipeFlow`; consumed by the recipe-card editor, margin
  // explorer, packaging picker, sites copy, and done summary.
  const [activeTemplate, setActiveTemplate] = useState<RecipeWizardTemplate>(DEFAULT_WIZARD_TEMPLATE);
  const [targetCogsPct, setTargetCogsPct] = useState<number>(DEFAULT_WIZARD_TEMPLATE.defaultTargetCogsPct);
  const [selectedSwaps, setSelectedSwaps] = useState<Record<string, string>>({});
  /** Editable recipe name — seeded from the matched template, or from
   *  whatever the user typed when no template matched, so an unknown
   *  dish keeps its own name rather than saving as "Avocado Toast". */
  const [recipeName, setRecipeName] = useState<string>(DEFAULT_WIZARD_TEMPLATE.name);
  /** Editable yield — the spec treats yield as kitchen knowledge, so
   *  the card asks for it (with the template's value as the suggestion)
   *  rather than displaying it read-only. */
  const [recipeYieldQty, setRecipeYieldQty] = useState<string>(String(DEFAULT_WIZARD_TEMPLATE.yieldQty));
  /** Optional method / instructions captured on the save summary. */
  const [recipeInstructions, setRecipeInstructions] = useState<string>('');
  /** Tier-three recipe settings (sub-recipe flag, count in stocktake,
   *  exclude from COGS) — surfaced on the ingredient card behind a
   *  "Recipe settings" expander, per the contract: offered in one tap,
   *  never forced. Defaults are the common case: sold on its own,
   *  counted at stocktake, included in COGS. */
  const [recipeSettings, setRecipeSettings] = useState<RecipeCardSettings>({ ...DEFAULT_RECIPE_CARD_SETTINGS });
  /** Whether the operator accepted the supplier-link offer — drives
   *  the done-message copy. */
  const supplierLinkedRef = useRef<boolean>(false);
  /** Whether the operator took the optional post-save production
   *  walkthrough — drives the done copy and the receipt detail. */
  const productionConfiguredRef = useRef<boolean>(false);
  /** True when the walkthrough had to turn count-in-stocktake back on
   *  against an explicit untick (planner eligibility) — drives one
   *  stated line in the done message. */
  const stocktakeReconciledRef = useRef<boolean>(false);
  /** Id of the recipe written by `confirmRecipeSave`, so the optional
   *  production walkthrough can patch it after the fact. */
  const savedRecipeIdRef = useRef<string | null>(null);
  /** Final pricing snapshot taken at the moment the user locks in
   *  on the Margin Explorer. Feeds the save summary's economics block,
   *  the persisted recipe and the done copy. */
  const lockedPricingRef = useRef<LockedPricing | null>(null);
  /** Seed text shown as the user's first turn after the greeting.
   *  Defaults to the template name; can be overridden when the chip
   *  passes its own copy through `startRecipeFlow(text)`. */
  const recipeSeedRef = useRef<string>(DEFAULT_WIZARD_TEMPLATE.name);
  /** Whether `findTemplateByName` resolved a template from the seed
   *  text. When false, the wizard adds a "starting from avocado
   *  toast as a baseline" caveat so the operator knows it didn't
   *  recognise their typed item. */
  const recipeTemplateMatchedRef = useRef<boolean>(true);
  const [productionFlow, setProductionFlow] = useState(0);
  const [prodSettings, setProdSettings] = useState<ProdSettings>({ ...DEFAULT_PROD_SETTINGS });
  const [chatMinimized, setChatMinimized] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Eval-harness feedback state — keyed by message id, kept separate from
  // ChatMsg so we don't mutate the message stream when an evaluator rates a
  // response. See `recordEvalFeedback` for the side-channel surface.
  const [evalFeedback, setEvalFeedback] = useState<Record<string, EvalFeedback>>({});
  const [evalCommentOpenFor, setEvalCommentOpenFor] = useState<string | null>(null);

  const handleEvalRate = (messageId: string, rating: EvalRating) => {
    setEvalFeedback(prev => {
      const current = prev[messageId];
      const nextRating = current?.rating === rating ? undefined : rating;
      recordEvalFeedback({ messageId, action: 'rating', rating: nextRating ?? null });
      return { ...prev, [messageId]: { ...current, rating: nextRating } };
    });
  };

  const handleEvalRetry = (messageId: string) => {
    setEvalFeedback(prev => {
      const current = prev[messageId];
      const nextCount = (current?.retried ?? 0) + 1;
      recordEvalFeedback({ messageId, action: 'retry' });
      return { ...prev, [messageId]: { ...current, retried: nextCount } };
    });
  };

  const handleEvalToggleComment = (messageId: string) => {
    setEvalCommentOpenFor(prev => (prev === messageId ? null : messageId));
  };

  const handleEvalCommentChange = (messageId: string, comment: string) => {
    setEvalFeedback(prev => ({
      ...prev,
      [messageId]: { ...prev[messageId], comment },
    }));
    recordEvalFeedback({ messageId, action: 'comment', comment });
  };
  const [analyticsType, setAnalyticsType] = useState<AnalyticsChartId | null>(null);
  const [analyticsStep, setAnalyticsStep] = useState(0);
  /** Task id to snapshot once the multi-step analytics flow lands its
   *  final reasoning card. The chart card takes ~11s to appear so we
   *  can't time the snapshot from sendMessage — we hook off the
   *  step→3 transition instead. */
  const pendingAnalyticsTaskRef = useRef<string | null>(null);
  const [pinnedChartIds, setPinnedChartIds] = useState<Set<AnalyticsChartId>>(
    () => new Set(alreadyPinned ?? []),
  );
  /**
   * Tracks chart→target pin pairs (key = `${chartId}:${targetId}`) so a single
   * chart can be pinned into multiple views and each per-target row in the
   * pin dropdown can show its own "pinned" state.
   */
  const [pinnedChartTargets, setPinnedChartTargets] = useState<Set<string>>(new Set());

  // ── Chat-command framework ──────────────────────────────────────────────
  // Drives the in-chat command cards (waste, stock, recipe, production,
  // menu, supplier). The hook owns the per-message state map and
  // exposes confirm/cancel handlers used by each card's render branch.
  const commandRunner = useCommandRunner({
    setMessages,
    setChatStarted,
    setChatMinimized,
    // Reset any in-flight task flows so a fresh command isn't polluted
    // by leftover recipe / production / analytics state.
    onFreshTask: () => {
      setRecipeFlow(0);
      setProductionFlow(0);
      setPackagingSkipped(false);
      setAnalyticsType(null);
      setAnalyticsStep(0);
      setInput('');
      // A pending "what kind of recipe?" ask mustn't swallow the next
      // message once the user has moved on to a different command.
      setAwaitingRecipeName(false);
    },
  });

  // Shared handler for the composer's `+` popover.
  const handleQuickAction = (commandId: string) => {
    if (commandId === 'pos-match-check') {
      startPosMatchCheck();
      return;
    }
    const cmd = getCommand(commandId);
    if (!cmd) return;
    commandRunner.runCommand({ commandId: cmd.id, args: {}, confidence: 1 });
  };

  // Re-open a task's saved conversation in the chat surface. Used by
  // the inline history list and the drawer. Also unwinds any
  // in-flight non-command flows (recipe wizard, production setup,
  // analytics step) so the replayed thread isn't fighting them for
  // visual real estate.
  const openTaskInChat = (task: import('@/components/Feed/taskHistoryStore').Task) => {
    setRecipeFlow(0);
    setProductionFlow(0);
    setPackagingSkipped(false);
    setAnalyticsType(null);
    setAnalyticsStep(0);
    setInput('');
    setAwaitingRecipeName(false);
    // Tasks recorded after the snapshot feature shipped carry a full
    // thread. Older entries (or any task that never got snapshotted)
    // fall back to a synthesised stub built from the metadata so the
    // operator always sees something.
    const snapshot =
      task.snapshotMessages && task.snapshotMessages.length > 0
        ? task.snapshotMessages
        : synthesiseThreadFromTask(task);
    commandRunner.restoreMessages(snapshot);
    // Bump the task's recency so it sorts to the top of the
    // Recent chats column the next time the operator returns to
    // the command centre. The list sorts by completedAt ?? startedAt,
    // so updating completedAt is the right knob — it tracks "most
    // recently touched" which is exactly what the user expects.
    updateHistoryTask(task.id, { completedAt: Date.now() });
    setHistoryDrawerOpen(false);
  };

  const greeting = timeAwareGreeting(briefingRole);

  useEffect(() => {
    onChatStateChange?.(chatStarted && !chatMinimized);
  }, [chatStarted, chatMinimized, onChatStateChange]);

  // Sidebar "Home" tap while a chat is open (incl. the split
  // workspace view) → minimise back to the command centre. The
  // sidebar broadcasts a window event since it has no direct line
  // to this component.
  useEffect(() => {
    const onMinimise = () => {
      // No-op when there's no open chat — keeps the untouched start
      // screen from picking up the minimised-layout styles.
      if (chatStarted) setChatMinimized(true);
    };
    window.addEventListener('edify:minimise-chat', onMinimise);
    return () => window.removeEventListener('edify:minimise-chat', onMinimise);
  }, [chatStarted]);

  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  useEffect(() => {
    onUserMessageCountChange?.(userMessageCount);
  }, [userMessageCount, onUserMessageCountChange]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, recipeFlow, productionFlow]);

  // Auto-send the seeded prompt once on mount (used by AddInsightPopup).
  const didAutoSendRef = useRef(false);
  useEffect(() => {
    if (didAutoSendRef.current) return;
    if (!autoSendPrompt && !autoSendTableQuery) return;
    didAutoSendRef.current = true;
    sendMessage(
      autoSendPrompt ?? autoSendTableTitle ?? 'Build me a table',
      autoSendTableQuery ? null : autoSendChartId,
      autoSendTableQuery
        ? { tableQuery: autoSendTableQuery, tableTitle: autoSendTableTitle }
        : undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSendPrompt, autoSendTableQuery]);

  // Auto-start a guided flow once on mount (used by the /recipes/intake "Ask Quinn" entry point).
  const didAutoStartRef = useRef(false);
  useEffect(() => {
    if (didAutoStartRef.current) return;
    if (!autoStartFlow) return;
    didAutoStartRef.current = true;
    if (autoStartFlow === 'recipe') startRecipeFlow();
    else if (autoStartFlow === 'integrity') startIntegrityCheck();
    else if (autoStartFlow === 'pos-match') startPosMatchCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartFlow]);

  // Activity-page Revert / Edit handoff. The Activity page writes an
  // intent into localStorage and routes the user back to home; we read
  // it once on mount and replay the original command through the
  // runner. The intent is deleted after the read so a hard refresh
  // doesn't keep re-firing it. Stale intents (> 60s) are dropped — by
  // that point the user has moved on and a surprise replay would be
  // worse than a no-op.
  const didConsumeReplayRef = useRef(false);
  useEffect(() => {
    if (didConsumeReplayRef.current) return;
    if (typeof window === 'undefined') return;
    didConsumeReplayRef.current = true;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(ACTIVITY_REPLAY_KEY);
      if (raw) window.localStorage.removeItem(ACTIVITY_REPLAY_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let intent: ActivityReplayIntent | null = null;
    try {
      intent = JSON.parse(raw) as ActivityReplayIntent;
    } catch {
      return;
    }
    if (!intent || Date.now() - intent.requestedAt > 60_000) return;
    const task = getHistoryTasks().find((t) => t.id === intent!.taskId);
    if (!task) return;
    if (intent.mode === 'revert') commandRunner.revertTask(task);
    else commandRunner.editTask(task);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // ── 1: simulated user echo of the typed item name ──────────
    if (recipeFlow === 1) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, { id: `u-recipe-${Date.now()}`, role: 'user', text: recipeSeedRef.current }]);
        setRecipeFlow(2);
      }, 1500);
      return () => clearTimeout(t);
    }
    // ── 2: post the recipe-card editor (with a brief caveat if
    //       we couldn't resolve the typed name into a template) ─
    if (recipeFlow === 2) {
      const t = setTimeout(() => {
        const intro = recipeTemplateMatchedRef.current
          ? buildRecipeCardIntro(activeTemplate)
          : `I don\u2019t have a recipe template for **${recipeSeedRef.current}** yet \u2014 starting from **${activeTemplate.name}** as a baseline you can tweak.`;
        setMessages(prev => [...prev, {
          id: `q-recipe-card-${Date.now()}`,
          role: 'quinn',
          text: intro,
          msgType: 'recipe-card',
        }]);
        setRecipeFlow(3);
      }, 1200);
      return () => clearTimeout(t);
    }
    // ── 3: yield-loss ask ──────────────────────────────────────
    if (recipeFlow === 3) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-yield-loss-${Date.now()}`,
          role: 'quinn',
          text: RECIPE_YIELD_LOSS_MSG,
          msgType: 'yield-loss',
        }]);
        setRecipeFlow(4);
      }, 1000);
      return () => clearTimeout(t);
    }
    // ── 5: variable ingredients offer ──────────────────────────
    if (recipeFlow === 5) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-variable-${Date.now()}`,
          role: 'quinn',
          text: RECIPE_VARIABLE_MSG,
          msgType: 'variable-ingredients',
        }]);
        setRecipeFlow(6);
      }, 900);
      return () => clearTimeout(t);
    }
    // ── 7: packaging picker — before pricing, because takeaway
    //       and delivery packaging feed those channels' prices. ──
    if (recipeFlow === 7) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-packaging-${Date.now()}`,
          role: 'quinn',
          text: buildPackagingMsg(activeTemplate),
          msgType: 'packaging-picker',
        }]);
        setRecipeFlow(8);
      }, 900);
      return () => clearTimeout(t);
    }
    // ── 9: ask for the target food-cost % ──────────────────────
    if (recipeFlow === 9) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-cogs-target-${Date.now()}`,
          role: 'quinn',
          text: RECIPE_COGS_TARGET_MSG,
          msgType: 'cogs-target',
        }]);
        setRecipeFlow(10);
      }, 1000);
      return () => clearTimeout(t);
    }
    // ── 11: pricing card once the COGS target is set ───────────
    if (recipeFlow === 11) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-margin-${Date.now()}`,
          role: 'quinn',
          text: RECIPE_COST_MSG,
          msgType: 'margin-explorer',
        }]);
        setRecipeFlow(12);
      }, 1000);
      return () => clearTimeout(t);
    }
    // ── 13: allergen check ─────────────────────────────────────
    if (recipeFlow === 13) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-allergen-${Date.now()}`,
          role: 'quinn',
          text: RECIPE_ALLERGEN_MSG,
          msgType: 'allergen-check',
        }]);
        setRecipeFlow(14);
      }, 800);
      return () => clearTimeout(t);
    }
    // ── 15: sites selection ────────────────────────────────────
    if (recipeFlow === 15) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-sites-${Date.now()}`,
          role: 'quinn',
          text: buildSitesMsg(activeTemplate),
          msgType: 'site-selection',
        }]);
        setRecipeFlow(16);
      }, 700);
      return () => clearTimeout(t);
    }
    // ── 17: pre-save summary ───────────────────────────────────
    if (recipeFlow === 17) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-save-summary-${Date.now()}`,
          role: 'quinn',
          text: "Here's everything I'm about to save. Check the numbers, add method notes if you want them on the recipe, then save:",
          msgType: 'recipe-save-summary',
        }]);
        setRecipeFlow(18);
      }, 900);
      return () => clearTimeout(t);
    }
    // ── 19: supplier-link offer (post-save) ────────────────────
    if (recipeFlow === 19) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-supplier-${Date.now()}`,
          role: 'quinn',
          text: activeTemplate.supplierLinkMsg,
        }]);
        setRecipeFlow(20);
      }, 800);
      return () => clearTimeout(t);
    }
    // ── 21: production offer — optional, never forced. Skipping
    //       saves the recipe with defaults; settings live on the
    //       recipe page whenever the kitchen needs them. ─────────
    if (recipeFlow === 21) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-prod-offer-${Date.now()}`,
          role: 'quinn',
          text: RECIPE_PRODUCTION_OFFER_MSG,
        }]);
        setRecipeFlow(22);
      }, 800);
      return () => clearTimeout(t);
    }
    // ── 24: done summary ──────────────────────────────────────
    if (recipeFlow === 24) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-done-${Date.now()}`,
          role: 'quinn',
          text: buildDoneMsg(recipeName, activeTemplate, doneSiteNamesRef.current, lockedPricingRef.current, supplierLinkedRef.current, productionConfiguredRef.current, stocktakeReconciledRef.current),
        }]);
        const sitesLabel = doneSiteNamesRef.current.join(', ');
        const pricing = lockedPricingRef.current;
        pushFlowReceipt({
          headline: `Saved ${recipeName}`,
          detail: `Live at ${sitesLabel}${pricing ? ` · £${pricing.srpExVat.toFixed(2)} at ${pricing.targetCogsPct}% food cost` : ''}`,
        });
        setRecipeFlow(25);
      }, 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeFlow, activeTemplate, recipeName]);

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
      const inRecipeWizard = recipeFlow === 23;
      const t = setTimeout(() => {
        setMessages(prev => [...prev, { id: `q-prod-done-${Date.now()}`, role: 'quinn', text: `Production settings confirmed for **${recipeName}**:`, msgType: 'prod-summary' }]);
        if (!inRecipeWizard) {
          pushFlowReceipt({
            headline: `Production plan configured — ${recipeName}`,
            detail: `${prodSettings.prepTime} prep · ${prodSettings.shelfLife} shelf life · batches of ${prodSettings.batchMultiple}`,
          });
        }
        setProductionFlow(10);
      }, 800);
      return () => clearTimeout(t);
    }
    // ── 10 inside the create flow: the optional post-save
    //     walkthrough finished — patch the saved recipe with the
    //     answers, then hand back to the wizard's done summary. ──
    if (productionFlow === 10 && recipeFlow === 23) {
      const saved = savedRecipeIdRef.current ? findRecipe(savedRecipeIdRef.current) : undefined;
      if (saved) {
        // Configuring production means this recipe is batch-made stock,
        // and the planner only lists recipes counted at stocktake (the
        // backend gates every planner query on `countInStockTake`).
        // Reconcile in the background rather than explaining the
        // coupling on the toggle: the flag can only be off here if the
        // user explicitly unticked it, so when we flip it back the done
        // message states the change with the route to reverse it.
        stocktakeReconciledRef.current = saved.countInStockTake === false;
        if (stocktakeReconciledRef.current) {
          setRecipeSettings(prev => ({ ...prev, countInStockTake: true }));
        }
        updateRecipe({
          ...saved,
          countInStockTake: true,
          category: prodCategoryToRecipeCategory(prodSettings.category),
          production: {
            ...saved.production,
            shelfLifeMinutes: shelfLifeToMinutes(prodSettings.shelfLife),
            prepTimeSeconds: prepTimeToSeconds(prodSettings.prepTime),
          },
          formExtras: {
            ...saved.formExtras,
            productionExtras: {
              ...saved.formExtras?.productionExtras,
              minBatch: prodSettings.batchMin,
              maxBatch: prodSettings.batchMax,
              batchMultiple: prodSettings.batchMultiple,
            },
            advanced: {
              ...saved.formExtras?.advanced,
              countInStockTake: true,
              allowCarryOver: prodSettings.allowCarryOver,
              closingRange: prodSettings.closingRange,
            },
          },
        });
      }
      productionConfiguredRef.current = true;
      const t = setTimeout(() => setRecipeFlow(24), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productionFlow, recipeFlow, recipeName]);

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
      }, 11000);
      return () => clearTimeout(t);
    }
    if (analyticsStep === 2) {
      let cancelled = false;
      const fallback = ANALYTICS_CONFIG[analyticsType].reasoning;
      const insightPromise = getDunkinInsight(analyticsType);
      const t = setTimeout(async () => {
        // For Dunkin chart ids the narrative is computed from the live CSV
        // data so it actually tells the user what's in the chart. Other chart
        // ids fall through to the static `reasoning` string instantly.
        let text = fallback;
        if (insightPromise) {
          try {
            const dynamic = await insightPromise;
            if (dynamic && dynamic.trim().length > 0) text = dynamic;
          } catch {
            // Swallow — keep fallback narrative.
          }
        }
        if (cancelled) return;
        setMessages(prev => [...prev, {
          id: `q-analytics-reasoning-${analyticsType}-${Date.now()}`,
          role: 'quinn' as const,
          text,
        }]);
        setAnalyticsStep(3);
      }, 800);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
  }, [analyticsType, analyticsStep]);

  // Once the analytics flow has finished (chart + reasoning both in
  // the thread), snapshot the conversation into the question task so
  // clicking it from history later replays the whole exchange.
  useEffect(() => {
    if (analyticsStep !== 3) return;
    const taskId = pendingAnalyticsTaskRef.current;
    if (!taskId) return;
    pendingAnalyticsTaskRef.current = null;
    // setTimeout 0 lets the step-3 setMessages flush first.
    const t = window.setTimeout(() => commandRunner.snapshotTask(taskId), 0);
    return () => window.clearTimeout(t);
  }, [analyticsStep, commandRunner]);

  /**
   * Pin a chart to a specific target. In multi-target mode (MVP1) we keep the
   * legacy `pinnedChartIds` Set in sync so that the conversation-history
   * "pinned count" heuristic still fires. The destination label is read from
   * the matching `pinTargets` entry so the confirmation message names the
   * actual view (e.g. "Reports" or "View 2").
   */
  function handleAddChart(chartId: AnalyticsChartId, targetId?: string) {
    if (pinTargets && pinTargets.length > 0 && targetId) {
      const key = `${chartId}:${targetId}`;
      if (pinnedChartTargets.has(key)) return;
      const target = pinTargets.find((t) => t.id === targetId);
      const destinationLabel = target?.label ?? 'this view';
      setPinnedChartTargets((prev) => new Set([...prev, key]));
      setPinnedChartIds((prev) => new Set([...prev, chartId]));
      onAddChartToTarget?.(chartId, targetId);
      setMessages((prev) => [
        ...prev,
        {
          id: `q-analytics-pinned-${chartId}-${targetId}-${Date.now()}`,
          role: 'quinn',
          text: `Done — I've pinned **${ANALYTICS_CONFIG[chartId].label}** to **${destinationLabel}**.`,
          msgType: 'analytics-pinned',
        },
      ]);
      return;
    }

    // Legacy single-target path (e.g. HomeShell).
    if (pinnedChartIds.has(chartId)) return;
    setPinnedChartIds((prev) => new Set([...prev, chartId]));
    onAddToDashboard?.(chartId);
    const destination = pinTarget === 'view' ? 'this view' : 'your dashboard';
    setMessages((prev) => [
      ...prev,
      {
        id: `q-analytics-pinned-${chartId}-${Date.now()}`,
        role: 'quinn',
        text: `Done — I've pinned **${ANALYTICS_CONFIG[chartId].label}** to ${destination}.`,
        msgType: 'analytics-pinned',
      },
    ]);
  }

  function handleAddChartToNewView(chartId: AnalyticsChartId) {
    const newTargetId = onAddChartToNewView?.(chartId);
    if (newTargetId) {
      setPinnedChartTargets((prev) => new Set([...prev, `${chartId}:${newTargetId}`]));
    }
    setPinnedChartIds((prev) => new Set([...prev, chartId]));
    setMessages((prev) => [
      ...prev,
      {
        id: `q-analytics-pinned-${chartId}-newview-${Date.now()}`,
        role: 'quinn',
        text: `Done — I've added **${ANALYTICS_CONFIG[chartId].label}** to a new view.`,
        msgType: 'analytics-pinned',
      },
    ]);
  }

  /** Ask which recipe before opening the builder. Used by the "Update
   *  recipe" suggestion: Quinn posts the question, the composer stays
   *  live, and the operator's reply is picked up in sendMessage
   *  (`awaitingRecipeName`) and seeded into startRecipeFlow. */
  function startRecipeAsk(question?: string) {
    setChatMinimized(false);
    setChatStarted(true);
    setRecipeFlow(0);
    const q = question && question.trim().length > 0 ? question.trim() : RECIPE_ASK_MSG;
    setMessages([{ id: `q-recipe-ask-${Date.now()}`, role: 'quinn', text: q }]);
    setAwaitingRecipeName(true);
  }

  function startRecipeFlow(seedText?: string, opts?: { userEcho?: string; append?: boolean }) {
    setChatMinimized(false);
    setChatStarted(true);
    const resolved = seedText ? findTemplateByName(seedText) : null;
    const template = resolved ?? DEFAULT_WIZARD_TEMPLATE;
    setActiveTemplate(template);
    setRecipeIngredients(template.ingredients.map(templateRowToRecipeIngredient));
    setTargetCogsPct(template.defaultTargetCogsPct);
    setSelectedSwaps({});
    setSelectedPackaging(new Set(template.packagingDefaultIds));
    setPackagingRows(template.packaging.map((p) => ({ ...p, qty: '1', aiSuggested: true })));
    setPackagingChannels(Object.fromEntries(template.packaging.map((p) => [p.id, { ...DEFAULT_PACKAGING_CHANNELS }])));
    setPackagingSkipped(false);
    setYieldLossDraft({});
    setYieldLossSkipped(false);
    setVariableIngredients([]);
    setVariableSkipped(false);
    setSelectedAllergens(new Set(template.autoDetectedAllergens));
    setSelectedSites(new Set(['fitzroy']));
    // Unknown dishes keep the operator's own name; the template is
    // only a baseline for ingredients and costs.
    setRecipeName(resolved || !seedText ? template.name : titleCaseDishName(seedText));
    setRecipeYieldQty(String(template.yieldQty));
    setRecipeInstructions('');
    setRecipeSettings({ ...DEFAULT_RECIPE_CARD_SETTINGS });
    supplierLinkedRef.current = false;
    productionConfiguredRef.current = false;
    stocktakeReconciledRef.current = false;
    savedRecipeIdRef.current = null;
    lockedPricingRef.current = null;
    recipeSeedRef.current = seedText && seedText.trim().length > 0 ? seedText.trim() : template.name;
    recipeTemplateMatchedRef.current = !!resolved || !seedText;
    // Two staging paths:
    //
    //  • Typed-input path (`echo` set): user message first, then a
    //    5s "thinking" bubble, then the greeting streams in, then
    //    the recipe-card editor lands. Mirrors the product-sheet
    //    import flow's cadence so flows that start from a typed
    //    message feel like Quinn is actually working on them.
    //  • Chip-click path: skip the thinking beat — the operator
    //    just clicked an explicit affordance, so showing Quinn
    //    "thinking" reads as artificial. The greeting renders
    //    instantly and the simulated-echo stage (state 1) handles
    //    the rest of the pacing.
    const echo = opts?.userEcho?.trim();
    if (echo) {
      const userMsgId = `u-recipe-seed-${Date.now()}`;
      const thinkingId = `q-recipe-thinking-${Date.now()}`;
      const greetingId = `q-greeting-${Date.now()}`;
      const seedMsgs: ChatMsg[] = [
        { id: userMsgId, role: 'user', text: echo },
        { id: thinkingId, role: 'quinn', text: '', msgType: 'cmd-thinking' },
      ];
      // `append` keeps a preceding exchange (e.g. the "which recipe?"
      // question from startRecipeAsk) in the transcript instead of
      // resetting to a fresh thread.
      if (opts?.append) setMessages((prev) => [...prev, ...seedMsgs]);
      else setMessages(seedMsgs);

      // 5s "thinking" hold → swap to the streaming greeting.
      window.setTimeout(() => {
        setMessages((prev) => {
          const without = prev.filter((m) => m.id !== thinkingId);
          return [
            ...without,
            {
              id: greetingId,
              role: 'quinn',
              text: RECIPE_GREETING,
              streaming: true,
            },
          ];
        });
        // After the greeting finishes typing + a small breath,
        // advance the wizard so the recipe-card editor appears.
        // STREAM_CHAR_MS is 18ms — buffer for the natural pause
        // between bubbles keeps it from snapping in.
        const streamMs = RECIPE_GREETING.length * 18 + 600;
        window.setTimeout(() => setRecipeFlow(2), streamMs);
      }, 5000);
      return;
    }

    setMessages([{
      id: `q-greeting-${Date.now()}`,
      role: 'quinn',
      text: RECIPE_GREETING,
    }]);
    setRecipeFlow(1);
  }

  /** Permissive "did the user just ask for a new recipe?" detector,
   *  run before parseCommand so phrases like "add an avocado toast",
   *  "new avocado toast recipe", or even a bare "avocado toast" route
   *  to the wizard instead of falling through to the generic Quinn
   *  reply. The heuristic prefers false negatives over false positives:
   *  if the message looks at all analytical (question marks, "cost
   *  of", "trend", "% / %s", "vs", "compare", date words), we bail
   *  and let the analytics path handle it.
   *
   *  Returns the seed text (for findTemplateByName) when matched. */
  function detectNewRecipeIntent(text: string): string | null {
    const lower = text.toLowerCase().trim();
    if (!lower) return null;
    const analyticsSmell =
      /[?%]/.test(lower) ||
      /\b(?:cost of|how much|how many|how's|trend|trending|vs\.?|versus|compare|compared|report|by site|by store|per site|per store|this week|last week|this month|last month|today|yesterday|month-on-month|year-on-year|forecast|sales|revenue|covers?)\b/.test(lower);
    if (analyticsSmell) return null;

    const creationVerb =
      /\b(?:new|add|create|build|make|design|launch|do|start|set\s*up)\b/.test(lower) ||
      /^let'?s\b/.test(lower);
    const recipeKeyword = /\brecipe\b/.test(lower);
    const templateHit = findTemplateByName(lower);

    // Case 1: explicit "recipe" keyword + creation verb. ("new recipe",
    // "create a recipe", "build me a recipe", "let's do a recipe")
    if (creationVerb && recipeKeyword) return text;
    // Case 2: creation verb + a known template name. ("add avocado
    // toast", "create chicken mayo sandwich")
    if (creationVerb && templateHit) return text;
    // Case 3: bare-ish template phrase, ≤6 words, no analytics smell.
    // ("avocado toast", "avo toast", "chicken & mayo")
    if (templateHit && lower.split(/\s+/).length <= 6) return text;
    // Case 4: just the word "recipe" on its own.
    if (recipeKeyword && lower.split(/\s+/).length <= 3) return text;
    return null;
  }

  /** Did the user just ask to import a product from a sheet/file?
   *
   *  Two paths kick the flow:
   *    1. A file is paperclipped — the attachment alone is treated
   *       as an explicit "process this sheet" signal regardless of
   *       what the user typed (or even if they typed nothing).
   *    2. No attachment, but the text reads like an import request:
   *       a creation verb + a "sheet / file / document" word.
   *
   *  The keyword set is intentionally loose so phrasings like
   *  "Add this product of a new bacon from this product sheet" hit
   *  alongside "import bacon from sheet", "upload supplier sheet",
   *  "add a new product from this document", etc.
   *
   *  IMPORTANT: this runs AFTER detectNewSupplierImport in
   *  sendMessage so the more specific "new supplier" intent wins
   *  when both detectors would fire. */
  function detectProductSheetImport(text: string, hasAttachment: boolean): boolean {
    if (hasAttachment) return true;
    const lower = text.toLowerCase().trim();
    if (!lower) return false;
    const verb = /\b(?:add|adding|import|importing|upload|uploading|create|creating|set\s*up|setup|new|attach|attaching)\b/.test(lower);
    if (!verb) return false;
    const productWord = /\b(?:product|sku|item|bacon|supplier)\b/.test(lower);
    const sourceWord = /\b(?:sheet|file|document|spreadsheet|csv|pdf|email|attachment|attach|invoice)\b/.test(lower);
    // Verb + a "sheet/file" word is the strongest signal — also
    // accept verb + product word + "from" preposition (covers "add
    // bacon from this sheet" when the sheet word is dropped).
    if (sourceWord) return true;
    if (productWord && /\b(?:from|via|using|out\s+of)\b/.test(lower)) return true;
    return false;
  }

  /** Did the user just ask to add a new product and swap it across the
   *  recipes that use the existing one? This is the sheet-driven
   *  product-swap flow (parse a supplier sheet → confirm the new
   *  product → confirm the recipes → done). It must be checked BEFORE
   *  the generic product-sheet importer so an attached coffee-bean
   *  sheet lands here rather than on the single-product importer.
   *
   *  Scoped deliberately tight: the coffee-bean scenario, or the
   *  generic "swap/replace a product (in a/across) recipe(s)" phrasing
   *  with no other specifically-named product. A specific inline swap
   *  ("replace whole milk with oat milk") still falls through to the
   *  command parser so it isn't served the coffee mock. */
  function detectProductSwapAcrossRecipes(text: string): boolean {
    const lower = text.toLowerCase().trim();
    if (!lower) return false;
    // "Update a recipe across all my franchises/sites to use a
    // different ingredient / a new supplier" — the ingredient-swap
    // ask phrased without a swap verb. On the Chagee build this is
    // intercepted by detectChageeTeaSwap first; everywhere else it
    // belongs to this generic product-swap flow.
    const recipeAcrossSites =
      /\brecipes?\b/.test(lower) &&
      /\b(?:across|all)\b/.test(lower) &&
      /\b(?:franchises?|sites?|stores?|locations?)\b/.test(lower);
    if (recipeAcrossSites && /\b(?:ingredient|supplier|product)\b/.test(lower)) return true;
    const swapVerb = /\b(?:swap|swapping|replace|replacing|switch|switching)\b/.test(lower);
    if (!swapVerb) return false;
    // Coffee-bean scenario — explicit.
    if (/\b(?:coffee\s*beans?|espresso(?:\s*blend)?|beans?)\b/.test(lower)) return true;
    // Generic "swap/replace a product …" (the wording the old manual
    // wizard used) — no other named product to confuse the mock.
    if (/\b(?:swap|replace|switch)\b\s+(?:a|an|the|my|our)?\s*product\b/.test(lower)) return true;
    return false;
  }

  /** Mock the parsed coffee-bean sheet + the swap context (which
   *  existing item it maps to). The brief is "the sheet has all the
   *  product details", so this returns a complete, believable new bean
   *  and points it at the existing Espresso Blend master the coffee
   *  recipes use.
   *
   *  We deliberately do NOT mint a new supplier — a product sheet
   *  doesn't carry the supplier onboarding details (cut-off, lead time,
   *  MOV, delivery days), so we attach the new bean to an existing
   *  supplier and leave setting up the real one for later. */
  function coffeeBeanSwapArgs(fileName: string): Record<string, unknown> {
    // Resolve an existing supplier to hang the new bean off — first an
    // Available one that already carries Beverage, else the first
    // available supplier in the book.
    const suppliers = snapshotSuppliersStore().suppliers;
    const existing =
      suppliers.find((s) => s.status === 'Available' && s.categories.includes('Beverage')) ??
      suppliers.find((s) => s.status === 'Available') ??
      suppliers[0];
    return {
      fileName,
      newProductName: 'Single-Origin Colombian Beans 1kg',
      // Existing supplier — not a new one (we don't have its details).
      supplierMode: 'existing',
      supplierId: existing?.id,
      supplierName: existing?.shortCode ?? existing?.name ?? 'Existing supplier',
      category: 'Beverage',
      packType: 'Pack',
      packQty: 6,
      packCost: 132.0,
      unitType: 'kg',
      singleUnitVolumeOrWeight: 1,
      unitOfMeasure: 'kg',
      taxRatePct: 0,
      allergens: [],
      sites: [...ALL_SUPPLIER_SITES],
      // ── Base-product settings the production form asks for. Each is
      // either read off the sheet or assumed by rule; the card shows
      // which and why, and every one is editable before confirm.
      supplierCode: 'RR-COL-1KG',
      productClass: 'Food',
      // Alt UoMs derived from the pack structure ("6 × 1kg"): a bag is
      // 1kg, a case is 6 bags. numberOfUnits = how many of that unit
      // one pack contains, matching the production form's semantics.
      altUoms: [
        { type: 'Bag', numberOfUnits: 6 },
        { type: 'Case', numberOfUnits: 1 },
      ],
      // The case is 6 identical retail-sized bags → sites may order by
      // the bag. Force-multiples contradicts split pack, so off.
      allowSplitPack: true,
      forceMultiples: false,
      // It's an ingredient in drinks that sell → counts in COGS, and
      // recipes cost on the averaged price so one dear delivery
      // doesn't spike GP.
      excludeFromCogs: false,
      useActualUseForTheoreticalCogs: false,
      // What we're swapping out — the coffee recipes reference this via
      // a master ref (typed rows) and a legacy "Espresso blend" row.
      oldProductName: 'Espresso blend',
      oldMasterId: 'mp-espresso-blend',
      oldPackCost: 30.0,
      oldPackQty: 1,
    };
  }

  /** Kick the sheet-driven product swap. Same cinematic as the single-
   *  product importer (user echo with attachment chip → thinking hold →
   *  streaming summary), then hands off to the command runner which
   *  opens the task + the new-product confirmation card. */
  function startBeanSwapFromSheet(opts: { fileName: string; userText: string }) {
    setChatMinimized(false);
    setChatStarted(true);
    setAttachedFileName(null);

    const args = coffeeBeanSwapArgs(opts.fileName);
    const userMsgId = `u-beanswap-${Date.now()}`;
    const thinkingId = `q-beanswap-thinking-${Date.now()}`;
    const summaryId = `q-beanswap-summary-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        text: opts.userText || `Add this coffee bean and swap it in from ${opts.fileName}`,
        attachmentName: opts.fileName,
      },
      { id: thinkingId, role: 'quinn', text: '', msgType: 'cmd-thinking' },
    ]);

    const summaryText =
      `Parsed **${opts.fileName}**: a new coffee bean, **${args.newProductName as string}**, at £${((args.packCost as number) / (args.packQty as number)).toFixed(2)}/kg. ` +
      `It matches the espresso blend your coffees already use, so I can swap it across all of them. ` +
      `Check the details, fix anything the sheet got wrong, and I'll line up the recipes.`;

    window.setTimeout(() => {
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== thinkingId);
        return [...without, { id: summaryId, role: 'quinn', text: summaryText, streaming: true }];
      });
      const streamingDurationMs = summaryText.length * 18;
      window.setTimeout(() => {
        commandRunner.startProductSwapFromSheet(args);
      }, streamingDurationMs + 400);
    }, 3500);
  }

  /** Chagee demo — "update a recipe across all my franchises with a
   *  different ingredient from a new supplier… it's for our whole tea
   *  leaves". Detects the tea-leaf phrasing (or the franchise +
   *  supplier + recipe combination) and runs the scripted two-step
   *  flow. Checked BEFORE the generic supplier/product importers so
   *  "add the new supplier and the product" in the same breath
   *  doesn't get hijacked by those.
   *
   *  CHAGEE-BRAND ONLY: on the internal / default build this always
   *  returns false, so the same phrasing falls through to the generic
   *  product-swap flow (the coffee-bean scenario) instead of the
   *  Chagee-branded script. */
  function detectChageeTeaSwap(text: string): boolean {
    if (demoCustomer.id !== 'chagee') return false;
    const lower = text.toLowerCase().trim();
    if (!lower) return false;
    const teaLeaves = /\btea\s+leaves\b/.test(lower);
    const franchise = /\bfranchises?\b/.test(lower);
    const supplier = /\b(?:supplier|vendor)\b/.test(lower);
    const recipe = /\brecipe\b/.test(lower);
    if (teaLeaves && (supplier || recipe || franchise)) return true;
    return franchise && supplier && recipe;
  }

  /** Kick the Chagee flow: user echo with the supplier-list chip,
   *  a thinking hold, Quinn's parse summary, then the step-1 card
   *  (supplier + product). Step 2 is pushed by
   *  `confirmChageeSupplier` once step 1 is confirmed. */
  function startChageeTeaSwap(opts: { fileName: string | null; userText: string }) {
    setChatMinimized(false);
    setChatStarted(true);
    setAttachedFileName(null);

    const fileName = opts.fileName ?? CHAGEE_TEA_SWAP.fileName;
    const userMsgId = `u-chagee-${Date.now()}`;
    const thinkingId = `q-chagee-thinking-${Date.now()}`;
    const cardId = `q-chagee-supplier-${Date.now()}`;

    setChageeSupplierConfirmed((prev) => ({ ...prev, [cardId]: false }));

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        text: opts.userText,
        attachmentName: fileName,
      },
      { id: thinkingId, role: 'quinn', text: '', msgType: 'cmd-thinking' },
    ]);

    const summaryText =
      `Got it — three things to do here: add **${CHAGEE_TEA_SWAP.supplier.name}** as a supplier, ` +
      `bring in their **${CHAGEE_TEA_SWAP.product.name}**, then swap it into ` +
      `**${CHAGEE_TEA_SWAP.recipe.name}** across your franchises. ` +
      `I've parsed **${fileName}** — here's the supplier and product first. ` +
      `Confirm and I'll line up the recipe change.`;
    const summaryId = `q-chagee-summary-${Date.now()}`;
    window.setTimeout(() => {
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== thinkingId);
        return [
          ...without,
          { id: summaryId, role: 'quinn', text: summaryText, streaming: true },
        ];
      });
      const streamMs = summaryText.length * 18;
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: cardId, role: 'quinn', text: '', msgType: 'chagee-tea-supplier' },
        ]);
      }, streamMs + 400);
    }, 5000);
  }

  /** Step 1 confirmed — mark the supplier card done, then push the
   *  recipe-update card after a thinking beat. Mock only: nothing is
   *  written to the suppliers/products stores. */
  /** Push a receipt bubble into the chat stream at the end of a
   *  scripted flow. Same message shape the command runner uses
   *  (`cmd-receipt` + baked `cmdReceiptData`) so every flow —
   *  commands, demos, imports, wizards — ends with the identical
   *  receipt chrome. No undo closure: these are demo writes. */
  function pushFlowReceipt(receipt: { headline: string; detail?: string; href?: string; hrefLabel?: string }) {
    setMessages((prev) => [
      ...prev,
      {
        id: `q-rcpt-flow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'quinn',
        text: receipt.headline,
        msgType: 'cmd-receipt',
        cmdReceiptData: receipt,
      },
    ]);
  }

  function confirmChageeSupplier(cardId: string) {
    if (chageeSupplierConfirmed[cardId]) return;
    setChageeSupplierConfirmed((prev) => ({ ...prev, [cardId]: true }));
    pushFlowReceipt({
      headline: `Added ${CHAGEE_TEA_SWAP.supplier.name} + ${CHAGEE_TEA_SWAP.product.name}`,
      detail: `Matched to ${CHAGEE_TEA_SWAP.master.name} master · cut-off ${CHAGEE_TEA_SWAP.supplier.cutOff}`,
    });

    const thinkingId = `q-chagee-thinking2-${Date.now()}`;
    const recipeCardId = `q-chagee-recipe-${Date.now()}`;
    setChageeRecipeConfirmed((prev) => ({ ...prev, [recipeCardId]: false }));
    setChageeFranchises((prev) => ({ ...prev, [recipeCardId]: new Set(CHAGEE_TEA_SWAP.franchises) }));

    setMessages((prev) => [
      ...prev,
      { id: thinkingId, role: 'quinn', text: '', msgType: 'cmd-thinking' },
    ]);

    const bridgeText =
      `**${CHAGEE_TEA_SWAP.supplier.shortCode}** and their whole tea leaves are in. ` +
      `Now the recipe — **${CHAGEE_TEA_SWAP.recipe.name}** uses the old leaves at every franchise. ` +
      `Here's the swap; all ${CHAGEE_TEA_SWAP.franchises.length} franchises are selected, ` +
      `untick any that should stay on the old supplier.`;
    const bridgeId = `q-chagee-bridge-${Date.now()}`;
    window.setTimeout(() => {
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== thinkingId);
        return [
          ...without,
          { id: bridgeId, role: 'quinn', text: bridgeText, streaming: true },
        ];
      });
      const streamMs = bridgeText.length * 18;
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: recipeCardId, role: 'quinn', text: '', msgType: 'chagee-tea-recipe' },
        ]);
      }, streamMs + 400);
    }, 2200);
  }

  /** Step 2 confirmed — wrap up with a success message and a history
   *  entry. */
  function confirmChageeRecipe(cardId: string) {
    if (chageeRecipeConfirmed[cardId]) return;
    setChageeRecipeConfirmed((prev) => ({ ...prev, [cardId]: true }));

    const count = (chageeFranchises[cardId] ?? new Set(CHAGEE_TEA_SWAP.franchises)).size;
    const doneText =
      `**Done!** ${CHAGEE_TEA_SWAP.recipe.name} now uses ` +
      `**${CHAGEE_TEA_SWAP.product.name}** from ${CHAGEE_TEA_SWAP.supplier.shortCode} ` +
      `across **${count} franchise${count === 1 ? '' : 's'}**. ` +
      `Cost per serve drops ${CHAGEE_TEA_SWAP.recipe.oldCost} → ${CHAGEE_TEA_SWAP.recipe.newCost}, ` +
      `and ordering switches to ${CHAGEE_TEA_SWAP.supplier.shortCode} from the next cycle ` +
      `(cut-off ${CHAGEE_TEA_SWAP.supplier.cutOff}, ${CHAGEE_TEA_SWAP.supplier.leadTime} lead).`;
    logHistoryEntry({
      kind: 'chat',
      title: `Updated ${CHAGEE_TEA_SWAP.recipe.name} across ${count} franchises`,
      subtitle: `New supplier · ${CHAGEE_TEA_SWAP.supplier.shortCode}`,
    });
    setMessages((prev) => [
      ...prev,
      { id: `q-chagee-done-${Date.now()}`, role: 'quinn', text: doneText, streaming: true },
    ]);
    pushFlowReceipt({
      headline: `Updated ${CHAGEE_TEA_SWAP.recipe.name} across ${count} franchise${count === 1 ? '' : 's'}`,
      detail: `Cost per serve ${CHAGEE_TEA_SWAP.recipe.oldCost} → ${CHAGEE_TEA_SWAP.recipe.newCost} · supplier ${CHAGEE_TEA_SWAP.supplier.shortCode}`,
    });
  }

  /** Stock-take review demo — "update my stock takes… review all the
   *  products that aren't in a stock area". Detects stock-take /
   *  stock-area / storage-area phrasing and runs the scripted
   *  two-step flow. Checked BEFORE parseCommand so the word "stock"
   *  doesn't get hijacked by the stock-count command. */
  function detectStockTakeReview(text: string): boolean {
    const lower = text.toLowerCase().trim();
    if (!lower) return false;
    const stockTake = /\bstock\s*-?\s*takes?\b/.test(lower);
    const area = /\b(?:stock|storage)\s+areas?\b/.test(lower);
    const review = /\b(?:review|update|check|tidy|sort)\b/.test(lower);
    if (area) return true;
    return stockTake && review;
  }

  /** Kick the stock-take flow: user echo, a thinking hold, Quinn's
   *  review summary, then the step-1 card (products missing a
   *  storage area). Step 2 is pushed by `confirmStockReview` once
   *  the selection is confirmed. */
  function startStockTakeReview(opts: { userText: string }) {
    setChatMinimized(false);
    setChatStarted(true);
    setAttachedFileName(null);

    const userMsgId = `u-stock-${Date.now()}`;
    const thinkingId = `q-stock-thinking-${Date.now()}`;
    const cardId = `q-stock-review-${Date.now()}`;

    setStockReviewConfirmed((prev) => ({ ...prev, [cardId]: false }));
    setStockReviewSelected((prev) => ({
      ...prev,
      [cardId]: new Set(STOCK_TAKE_REVIEW.products.map((p) => p.id)),
    }));

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', text: opts.userText },
      { id: thinkingId, role: 'quinn', text: '', msgType: 'cmd-thinking' },
    ]);

    const summaryText =
      `I've been through your product catalogue — ` +
      `**${STOCK_TAKE_REVIEW.products.length} products** aren't assigned to a storage area, ` +
      `so they're never counted on a stock take. Mostly recent additions. ` +
      `Here's the list — untick anything you don't want counted, ` +
      `then confirm and I'll ask where they live.`;
    const summaryId = `q-stock-summary-${Date.now()}`;
    window.setTimeout(() => {
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== thinkingId);
        return [
          ...without,
          { id: summaryId, role: 'quinn', text: summaryText, streaming: true },
        ];
      });
      const streamMs = summaryText.length * 18;
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: cardId, role: 'quinn', text: '', msgType: 'stock-review' },
        ]);
      }, streamMs + 400);
    }, 5000);
  }

  /** Step 1 confirmed — carry the selection through to the
   *  site-selection card after a thinking beat. Mock only: nothing is
   *  written to the product or stock-take stores. */
  function confirmStockReview(cardId: string) {
    if (stockReviewConfirmed[cardId]) return;
    const sel = stockReviewSelected[cardId] ?? new Set(STOCK_TAKE_REVIEW.products.map((p) => p.id));
    if (sel.size === 0) return;
    setStockReviewConfirmed((prev) => ({ ...prev, [cardId]: true }));

    const picked = STOCK_TAKE_REVIEW.products.filter((p) => sel.has(p.id));
    const thinkingId = `q-stock-thinking2-${Date.now()}`;
    const sitesCardId = `q-stock-sites-${Date.now()}`;
    setStockSitesConfirmed((prev) => ({ ...prev, [sitesCardId]: false }));
    setStockSitesSelected((prev) => ({ ...prev, [sitesCardId]: new Set(ALL_SUPPLIER_SITES) }));
    setStockSitesProducts((prev) => ({ ...prev, [sitesCardId]: picked.map((p) => p.id) }));

    setMessages((prev) => [
      ...prev,
      { id: thinkingId, role: 'quinn', text: '', msgType: 'cmd-thinking' },
    ]);

    const bridgeText =
      `**${picked.length} product${picked.length === 1 ? '' : 's'}** to add. ` +
      `Which sites does this apply to? All of them are selected — ` +
      `untick any that shouldn't change, and I'll sort storage areas next ` +
      `(they can differ site to site).`;
    const bridgeId = `q-stock-bridge-${Date.now()}`;
    window.setTimeout(() => {
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== thinkingId);
        return [
          ...without,
          { id: bridgeId, role: 'quinn', text: bridgeText, streaming: true },
        ];
      });
      const streamMs = bridgeText.length * 18;
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: sitesCardId, role: 'quinn', text: '', msgType: 'stock-sites' },
        ]);
      }, streamMs + 400);
    }, 2200);
  }

  /** Step 2 confirmed — carry the products + chosen sites through to
   *  the storage-area card after a thinking beat. */
  function confirmStockSites(cardId: string) {
    if (stockSitesConfirmed[cardId]) return;
    const sites = [...(stockSitesSelected[cardId] ?? new Set(ALL_SUPPLIER_SITES))];
    if (sites.length === 0) return;
    setStockSitesConfirmed((prev) => ({ ...prev, [cardId]: true }));

    const productIds = stockSitesProducts[cardId] ?? [];
    const picked = STOCK_TAKE_REVIEW.products.filter((p) => productIds.includes(p.id));
    const thinkingId = `q-stock-thinking3-${Date.now()}`;
    const areaCardId = `q-stock-area-${Date.now()}`;
    setStockAreaConfirmed((prev) => ({ ...prev, [areaCardId]: false }));
    // Pre-seed every product with Quinn's suggested area — the card
    // renders these as already-selected pills the operator can change.
    setStockAreaChoice((prev) => ({
      ...prev,
      [areaCardId]: Object.fromEntries(picked.map((p) => [p.id, p.suggestedArea])),
    }));
    setStockAreaProducts((prev) => ({ ...prev, [areaCardId]: productIds }));
    setStockAreaSites((prev) => ({ ...prev, [areaCardId]: sites }));

    setMessages((prev) => [
      ...prev,
      { id: thinkingId, role: 'quinn', text: '', msgType: 'cmd-thinking' },
    ]);

    const allSites = sites.length === ALL_SUPPLIER_SITES.length;
    const bridgeText =
      `${allSites ? 'All' : ''} **${sites.length} site${sites.length === 1 ? '' : 's'}** it is. ` +
      `Last thing — where does each product live? I've suggested a storage ` +
      `area for each based on the product type; change any that are wrong, ` +
      `then confirm and they'll join those count sheets at every selected site.`;
    const bridgeId = `q-stock-bridge2-${Date.now()}`;
    window.setTimeout(() => {
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== thinkingId);
        return [
          ...without,
          { id: bridgeId, role: 'quinn', text: bridgeText, streaming: true },
        ];
      });
      const streamMs = bridgeText.length * 18;
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: areaCardId, role: 'quinn', text: '', msgType: 'storage-area' },
        ]);
      }, streamMs + 400);
    }, 2200);
  }

  /** Step 3 confirmed — wrap up with a success message and a history
   *  entry. */
  function confirmStorageArea(cardId: string) {
    if (stockAreaConfirmed[cardId]) return;
    const choices = stockAreaChoice[cardId] ?? {};
    const productIds = stockAreaProducts[cardId] ?? [];
    if (!productIds.every((id) => !!choices[id])) return;
    setStockAreaConfirmed((prev) => ({ ...prev, [cardId]: true }));

    // Group the assignments by area for the receipt: "4 to Dry
    // Store, 2 to Walk-in Fridge, 2 to Packaging Store".
    const byArea = new Map<string, number>();
    for (const id of productIds) {
      byArea.set(choices[id], (byArea.get(choices[id]) ?? 0) + 1);
    }
    const breakdown = STOCK_TAKE_REVIEW.areas
      .filter((a) => byArea.has(a.id))
      .map((a) => `**${byArea.get(a.id)} to ${a.name}**`)
      .join(', ');

    const count = productIds.length;
    const siteCount = (stockAreaSites[cardId] ?? []).length;
    const allSites = siteCount === ALL_SUPPLIER_SITES.length;
    const siteBlurb = allSites
      ? `across **all ${siteCount} sites**`
      : `across **${siteCount} site${siteCount === 1 ? '' : 's'}**`;
    const doneText =
      `**Done!** ${count} product${count === 1 ? '' : 's'} added to your ` +
      `storage areas ${siteBlurb} — ${breakdown}. They'll appear on those ` +
      `count sheets from your next stock take, and I've flagged them for ` +
      `an opening count so variances track properly from day one.`;
    logHistoryEntry({
      kind: 'chat',
      title: `Added ${count} products to ${byArea.size} storage area${byArea.size === 1 ? '' : 's'} at ${siteCount} site${siteCount === 1 ? '' : 's'}`,
      subtitle: 'Stock take · storage areas',
    });
    setMessages((prev) => [
      ...prev,
      { id: `q-stock-done-${Date.now()}`, role: 'quinn', text: doneText, streaming: true },
    ]);
    pushFlowReceipt({
      headline: `Added ${count} product${count === 1 ? '' : 's'} to ${byArea.size} storage area${byArea.size === 1 ? '' : 's'}`,
      detail: `${siteCount} site${siteCount === 1 ? '' : 's'} · flagged for an opening count`,
    });
  }

  /** Did the user just ask to onboard a new supplier (with their
   *  details + a product catalogue)? Distinct from the product-sheet
   *  detector because:
   *    • the wizard creates a Supplier + many Products at once
   *      rather than a single Product against an existing master.
   *    • the demo expects two attached files (supplier sheet + 20-SKU
   *      catalogue), so we surface two chips in the user bubble.
   *
   *  Loose keyword detection so phrasings like "I want to add a new
   *  supplier", "import supplier with their catalogue", "onboard a
   *  new vendor and their SKUs" all route here. */
  function detectNewSupplierImport(text: string): boolean {
    const lower = text.toLowerCase().trim();
    if (!lower) return false;
    const supplierWord = /\b(?:supplier|vendor)\b/.test(lower);
    if (!supplierWord) return false;
    const supplierVerb =
      /\b(?:add|adding|import|importing|onboard|onboarding|create|creating|set\s*up|setup|new|register|registering)\b/.test(lower);
    if (!supplierVerb) return false;
    // Corroborate — "supplier" near a creation verb on its own is too
    // loose. Require at least one of: catalogue word, sheet/file word,
    // products word, OR the literal phrase "new supplier".
    const corroborate =
      /\bnew\s+supplier\b/.test(lower) ||
      /\b(?:catalogue|catalog|sku|skus|products?|details?)\b/.test(lower) ||
      /\b(?:sheet|file|document|spreadsheet|csv|pdf|attachment|attach)\b/.test(lower);
    return corroborate;
  }

  /** Kick the sheet-import wizard. Pushes a user echo with the
   *  attached-filename chip, a "parsing…" thinking bubble, then —
   *  after a short delay — the extracted-summary message and the
   *  import card. The card lives in the chat as an interactive
   *  message; clicking "Add product" runs `confirmProductImport`. */
  function startProductSheetImport(opts: { fileName: string; userText: string }) {
    setChatMinimized(false);
    setChatStarted(true);
    setAttachedFileName(null);

    const data = mockExtractFromSheet(opts.fileName);
    const userMsgId = `u-sheet-${Date.now()}`;
    const thinkingId = `q-sheet-thinking-${Date.now()}`;
    const cardId = `q-sheet-card-${Date.now()}`;

    // Default site selection — all sites checked. Brief says "the
    // only thing the user needs to decide is what stores will use
    // this product", so the fastest path is all-on with the operator
    // ticking off any they want to exclude.
    setProductImportSites((prev) => ({ ...prev, [cardId]: new Set(ALL_SUPPLIER_SITES) }));
    setProductImportConfirmed((prev) => ({ ...prev, [cardId]: false }));

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        text: opts.userText || `Add this product from ${opts.fileName}`,
        attachmentName: opts.fileName,
      },
      { id: thinkingId, role: 'quinn', text: '', msgType: 'cmd-thinking' },
    ]);

    // Staggered reveal:
    //   1. After a 5s "thinking" hold, the thinking bubble is swapped
    //      for the streaming summary message. This feels like the LLM
    //      is actually parsing the sheet rather than instantly
    //      snapping to a result.
    //   2. The import card only appears *after* the summary text has
    //      finished streaming, so the operator reads the framing
    //      before the card slides in underneath. Delay is computed
    //      from the message length × STREAM_CHAR_MS + a small buffer
    //      so it adapts if the copy ever changes.
    const summaryText =
      `Got it — I parsed **${opts.fileName}** and pulled all the details. ` +
      `It matches your existing **Bacon** master product (already has 2 suppliers), ` +
      `so I'll add this as a 3rd supplier. The only thing I need from you is which stores will stock it.`;
    const summaryId = `q-sheet-summary-${Date.now()}`;
    window.setTimeout(() => {
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== thinkingId);
        return [
          ...without,
          {
            id: summaryId,
            role: 'quinn',
            text: summaryText,
            streaming: true,
          },
        ];
      });
      const streamingDurationMs = summaryText.length * 18; // matches STREAM_CHAR_MS
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: cardId,
            role: 'quinn',
            text: '',
            msgType: 'product-sheet-import',
            cmdId: cardId,
            cmdArgsJson: JSON.stringify({ data, fileName: opts.fileName }),
          },
        ]);
      }, streamingDurationMs + 400);
    }, 5000);
  }

  /** Commit the import: persists the new supplier (de-duped by name)
   *  and the new Product (linked to the matched master) into the
   *  Suppliers store, then pushes a confirmation message into the
   *  chat. Subsequent renders of the card flip to the `confirmed`
   *  state so the operator can't double-add. */
  /** Shared follow-up: take the products that just landed in the
   *  store, find unmatched Drinks-category POS buttons that look
   *  like them, and queue a chat card so the operator can link them
   *  without leaving the conversation. Staggered after the success
   *  message so they read as two distinct beats. */
  function queuePosMatchFollowUp(
    justAddedProducts: { id: string; name: string; category: ProductCategory }[],
  ) {
    // Build a skip-set of POS buttons that have already been
    // linked/hidden so we don't re-surface a row the operator
    // already actioned on the Item matching page or in a previous
    // chat turn. Drinks buttons start life with no recipe match
    // (matchStatus === 'no-modifiers'), so checking just the
    // override store covers the relevant cases.
    const alreadyMatchedPosIds = new Set<string>();
    for (const [posId, ov] of matchOverrides) {
      if (ov.target || ov.hidden) alreadyMatchedPosIds.add(posId);
    }

    const suggestions = computePOSDrinkSuggestions(justAddedProducts, alreadyMatchedPosIds);
    if (suggestions.length === 0) return;

    const intro =
      suggestions.length === 1
        ? `One of these lines up with an unmatched **POS button** on your menu — want me to link it so sales start depleting the right stock?`
        : `${suggestions.length} of these line up with unmatched **POS buttons** on your menu — want me to link them so sales start depleting the right stock?`;

    // Intro text first (typed-out streaming), then the card.
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `q-pos-suggest-intro-${Date.now()}`,
          role: 'quinn',
          text: `While I was at it — ${intro}`,
          streaming: true,
        },
      ]);
    }, 1800);
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `q-pos-suggest-card-${Date.now()}`,
          role: 'quinn',
          text: '',
          msgType: 'pos-match-suggestions',
          cmdArgsJson: JSON.stringify({ suggestions }),
        },
      ]);
    }, 3200);
  }

  /** "Check my POS matches" quick action — the standalone match-triage
   *  entry point. Scans the whole product catalogue against unmatched
   *  POS buttons using the same scorer and card as the import
   *  follow-ups, so the triage surface is identical wherever it's
   *  reached from. */
  function startPosMatchCheck() {
    setChatMinimized(false);
    setChatStarted(true);

    const thinkingId = `q-pos-check-thinking-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `u-pos-check-${Date.now()}`, role: 'user', text: 'Check my POS matches' },
      { id: thinkingId, role: 'quinn', text: '', msgType: 'cmd-thinking' },
    ]);

    const alreadyMatchedPosIds = new Set<string>();
    for (const [posId, ov] of matchOverrides) {
      if (ov.target || ov.hidden) alreadyMatchedPosIds.add(posId);
    }
    const suggestions = computePOSDrinkSuggestions(
      allProducts.map((p) => ({ id: p.id, name: p.name, category: p.category })),
      alreadyMatchedPosIds,
    );

    // Matches the model is genuinely unsure about — mixed target entity
    // types, each with alternatives so the operator can correct the
    // target from the dropdown before linking. Never bulk-linked.
    // Typed before the .filter() below — otherwise TS widens the literal
    // posType/targetType fields to plain strings and the build fails.
    const uncertainAll: POSMatchSuggestion[] = [
      {
        posItemId: 'mi-iced-latte-euph',
        posItemName: 'Iced Latte (EUPH) EI - Regular',
        posType: 'Menu item',
        productId: 'rcp-iced-latte',
        productName: 'Iced Latte',
        targetType: 'Recipe',
        score: 0.48,
        alternatives: [
          { id: 'rcp-iced-latte-oat', name: 'Iced Latte — Oat', type: 'Recipe' },
          { id: 'sub-espresso-double', name: 'Double Espresso Base', type: 'Sub-recipe' },
          { id: 'mp-iced-coffee-rtd', name: 'Iced Coffee RTD 250ml', type: 'Master product' },
        ],
      },
      {
        posItemId: 'mod-add-vanilla-syrup',
        posItemName: 'Add Vanilla Syrup',
        posType: 'Modifier',
        productId: 'prd-vanilla-syrup-750',
        productName: 'Vanilla Syrup 750ml — Monin',
        targetType: 'Product',
        score: 0.44,
        alternatives: [
          { id: 'sub-vanilla-cold-foam', name: 'Vanilla Cold Foam', type: 'Sub-recipe' },
          { id: 'mp-vanilla-syrup-1l', name: 'Vanilla Syrup 1L — Routin', type: 'Master product' },
        ],
      },
    ];
    const uncertain = uncertainAll.filter((u) => !alreadyMatchedPosIds.has(u.posItemId));

    const allSuggestions = [...suggestions, ...uncertain];

    window.setTimeout(() => {
      if (allSuggestions.length === 0) {
        setMessages((prev) => {
          const without = prev.filter((msg) => msg.id !== thinkingId);
          return [
            ...without,
            {
              id: `q-pos-check-none-${Date.now()}`,
              role: 'quinn' as const,
              text: 'Every POS button is already matched to a recipe or product. Nothing to do here, just letting you know. We\u2019ll flag it if a new button lands unmatched.',
              streaming: true,
            },
          ];
        });
        return;
      }

      const n = allSuggestions.length;
      const introText =
        `**${n} POS button${n === 1 ? ' isn\u2019t' : 's aren\u2019t'} linked to anything**, so ${n === 1 ? 'its' : 'their'} sales aren\u2019t coming out of stock.` +
        (uncertain.length > 0 && suggestions.length > 0
          ? ` ${suggestions.length} match things you already have; **${uncertain.length} we\u2019re not sure about**, so those wait for your call. Want us to link the ${suggestions.length} confident ones?`
          : uncertain.length > 0
            ? ` We\u2019re not sure about ${uncertain.length === 1 ? 'it' : 'any of them'}, so each needs your call. Pick the right match on each row.`
            : ` All ${n} match things you already have. Want us to link them?`);
      const introId = `q-pos-check-intro-${Date.now()}`;
      setMessages((prev) => {
        const without = prev.filter((msg) => msg.id !== thinkingId);
        return [...without, { id: introId, role: 'quinn' as const, text: introText, streaming: true }];
      });
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `q-pos-check-card-${Date.now()}`,
            role: 'quinn',
            text: '',
            msgType: 'pos-match-suggestions',
            cmdArgsJson: JSON.stringify({ suggestions: allSuggestions }),
          },
        ]);
      }, introText.length * 18 + 400);
    }, 1800);
  }

  function confirmProductImport(cardId: string, data: ExtractedProductSheet, fileName: string) {
    if (productImportConfirmed[cardId]) return;
    setProductImportConfirmed((prev) => ({ ...prev, [cardId]: true }));

    const sites = [...(productImportSites[cardId] ?? new Set<string>())];

    // De-duplicate the supplier by name so re-running the demo
    // doesn't stack identical "Hawkshead Smokehouse" rows.
    const supplierName = data.supplierName.trim();
    // We could call `resolveOrCreateSupplier` from the store, but the
    // demo needs the new supplier to carry category + sites, so build
    // explicitly here.
    const supplierId = genId('sup');
    upsertSupplier({
      id: supplierId,
      name: supplierName,
      shortCode: supplierName,
      categories: [data.category],
      sites: [...ALL_SUPPLIER_SITES],
      status: 'Available',
    });

    const newProductId = genId('prd');
    upsertProduct({
      id: newProductId,
      name: data.productName,
      source: 'supplier',
      supplierId,
      masterProductId: data.matchedMasterId,
      supplierCode: 'SHEET-IMPORT',
      productClass: 'Food',
      category: data.category,
      tags: [],
      packType: data.packType,
      packQty: data.packQty,
      packCost: data.packCost,
      taxRatePct: data.taxRatePct,
      singleUnitType: data.singleUnitType,
      singleUnitVolumeOrWeight: data.singleUnitVolumeOrWeight,
      unitOfMeasure: data.unitOfMeasure,
      altUoms: [],
      allergensContains: data.allergens,
      allergensTraces: [],
      nutrition: {},
      sites,
      status: 'Available',
      flag: null,
    });

    const siteSummary =
      sites.length === ALL_SUPPLIER_SITES.length
        ? 'all sites'
        : `${sites.length} ${sites.length === 1 ? 'site' : 'sites'}`;
    void fileName; // currently unused in copy; kept for future "see sheet" link

    setMessages((prev) => [
      ...prev,
      {
        id: `u-sheet-confirm-${Date.now()}`,
        role: 'user',
        text:
          sites.length === ALL_SUPPLIER_SITES.length
            ? 'Add it everywhere'
            : `Add it to ${sites.length} ${sites.length === 1 ? 'store' : 'stores'}`,
      },
      {
        id: `q-sheet-done-${Date.now()}`,
        role: 'quinn',
        text:
          `Done. **${data.productName}** is in your catalogue, linked to the ` +
          `**Bacon** master product, with **${data.supplierName}** added as a ` +
          `new supplier. Live at ${siteSummary}.`,
        streaming: true,
      },
    ]);

    pushFlowReceipt({
      headline: `Added ${data.productName} to your catalogue`,
      detail: `Linked to Bacon master · ${data.supplierName} added as supplier · live at ${siteSummary}`,
      href: '/products',
      hrefLabel: 'View in Products',
    });

    // No-ops when the product isn't a beverage — but cheap to call,
    // and means a future single-product import of, say, a sparkling
    // water would naturally surface POS matches here too.
    queuePosMatchFollowUp([
      { id: newProductId, name: data.productName, category: data.category },
    ]);
  }

  /** Kick the new-supplier flow. Same staged reveal as the product-
   *  sheet flow (user echo → 5s thinking → streaming summary →
   *  card after streaming completes) but the user bubble carries
   *  TWO attachment chips (supplier sheet + catalogue) — the brief
   *  is that both are paperclipped. */
  function startNewSupplierImport(opts: { primaryFileName: string | null; userText: string }) {
    setChatMinimized(false);
    setChatStarted(true);
    setAttachedFileName(null);

    const data = mockSupplierSheet();
    // The user might have paperclipped one file or none. The flow
    // always renders the supplier-sheet + catalogue filenames the
    // mock provides — if the operator did attach a file we surface
    // their filename as the supplier sheet for continuity, and we
    // mock the catalogue alongside it.
    const supplierFileName = opts.primaryFileName ?? data.supplierFileName;
    const catalogueFileName = data.catalogueFileName;
    const sealed: ExtractedSupplierSheet = {
      ...data,
      supplierFileName,
      catalogueFileName,
    };

    const userMsgId = `u-supplier-${Date.now()}`;
    const thinkingId = `q-supplier-thinking-${Date.now()}`;
    const cardId = `q-supplier-card-${Date.now()}`;

    // Default site selection — all sites checked; matches the
    // "minimal interaction" brief from the product-sheet flow.
    setSupplierImportSites((prev) => ({ ...prev, [cardId]: new Set(ALL_SUPPLIER_SITES) }));
    setSupplierImportConfirmed((prev) => ({ ...prev, [cardId]: false }));
    setSupplierCatalogueOpen((prev) => ({ ...prev, [cardId]: false }));
    // Seed the editable product list — any row-level edits or
    // removals mutate this rather than the original mock so the
    // operator's adjustments survive into the persisted Products.
    setSupplierImportProducts((prev) => ({ ...prev, [cardId]: sealed.products }));
    setSupplierExpandedRow((prev) => ({ ...prev, [cardId]: null }));

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        text: opts.userText || 'I want to add a new supplier with their catalogue.',
        attachmentName: supplierFileName,
        // Second attachment chip — the catalogue. ChatMsg only has
        // one attachment slot today, so we serialise the second
        // file as a sibling chip via cmdArgsJson (read by the user
        // bubble render below). Kept narrow so the ChatMsg shape
        // doesn't need a list-typed field for one rare flow.
        cmdArgsJson: JSON.stringify({ secondAttachment: catalogueFileName }),
      },
      { id: thinkingId, role: 'quinn', text: '', msgType: 'cmd-thinking' },
    ]);

    // 5s thinking hold (matches the product-sheet flow's pacing —
    // two files take a beat longer to "parse" than one in real life,
    // but keeping the timing identical keeps the demo predictable).
    const summaryText =
      `Got it — I parsed **${supplierFileName}** for the supplier details ` +
      `and **${catalogueFileName}** for the catalogue. ` +
      `That's **${sealed.products.length} products** ready to add under ` +
      `**${sealed.name}**. You can click through to confirm each product, ` +
      `or just pick which stores will use them and I'll set it all up.`;
    const summaryId = `q-supplier-summary-${Date.now()}`;
    window.setTimeout(() => {
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== thinkingId);
        return [
          ...without,
          { id: summaryId, role: 'quinn', text: summaryText, streaming: true },
        ];
      });
      const streamingDurationMs = summaryText.length * 18; // STREAM_CHAR_MS
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: cardId,
            role: 'quinn',
            text: '',
            msgType: 'new-supplier-import',
            cmdId: cardId,
            cmdArgsJson: JSON.stringify({ data: sealed }),
          },
        ]);
      }, streamingDurationMs + 400);
    }, 5000);
  }

  /** Commit the new supplier + all 20 (or however many remain after
   *  any operator removals) products to the store in one go. Each
   *  product uses the freshly-created supplier id; sites come from
   *  the operator's selection (defaulted to all). */
  function confirmNewSupplierImport(cardId: string, data: ExtractedSupplierSheet) {
    if (supplierImportConfirmed[cardId]) return;
    setSupplierImportConfirmed((prev) => ({ ...prev, [cardId]: true }));

    const sites = [...(supplierImportSites[cardId] ?? new Set<string>())];
    // Use the LIVE product list — picks up any inline edits or
    // operator-dropped rows. Falls back to the seed catalogue if
    // the live list ref is somehow missing (e.g. card restored from
    // a history snapshot in the future).
    const products = supplierImportProducts[cardId] ?? data.products;

    const supplierId = genId('sup');
    upsertSupplier({
      id: supplierId,
      name: data.name,
      shortCode: data.shortCode,
      categories: data.categories,
      sites: sites.length > 0 ? sites : [...ALL_SUPPLIER_SITES],
      status: 'Available',
      email: data.email,
      phone: data.phone,
      contactName: data.contactName,
      accountsEmail: data.accountsEmail,
      companyAccountNumber: data.companyAccountNumber,
      cutOffTime: data.cutOffTime,
      leadTimeDays: data.leadTimeDays,
      minimumOrderValue: data.minimumOrderValue,
      deliveryDays: data.deliveryDays,
    });

    // Capture the persisted product IDs alongside their names so the
    // POS-match follow-up can reference them by id when the operator
    // confirms a suggestion (writes to the override store keyed by id).
    const persistedProducts: { id: string; name: string; category: ProductCategory }[] = [];
    for (const p of products) {
      const id = genId('prd');
      upsertProduct({
        id,
        name: p.name,
        source: 'supplier',
        supplierId,
        supplierCode: p.supplierCode,
        productClass: p.productClass,
        category: p.category,
        tags: [],
        packType: p.packType,
        packQty: p.packQty,
        packCost: p.packCost,
        taxRatePct: p.taxRatePct,
        singleUnitType: p.singleUnitType,
        singleUnitVolumeOrWeight: p.singleUnitVolumeOrWeight,
        unitOfMeasure: p.unitOfMeasure,
        altUoms: [],
        allergensContains: p.allergens,
        allergensTraces: [],
        nutrition: {},
        sites,
        status: 'Available',
        flag: null,
      });
      persistedProducts.push({ id, name: p.name, category: p.category });
    }

    const siteSummary =
      sites.length === ALL_SUPPLIER_SITES.length
        ? 'all sites'
        : `${sites.length} ${sites.length === 1 ? 'site' : 'sites'}`;

    setMessages((prev) => [
      ...prev,
      {
        id: `u-supplier-confirm-${Date.now()}`,
        role: 'user',
        text:
          sites.length === ALL_SUPPLIER_SITES.length
            ? 'Add them everywhere'
            : `Add them to ${sites.length} ${sites.length === 1 ? 'store' : 'stores'}`,
      },
      {
        id: `q-supplier-done-${Date.now()}`,
        role: 'quinn',
        text:
          `Done. **${data.name}** is now a supplier with **${products.length} products** ` +
          `in your catalogue. Live at ${siteSummary}. You can review the SKUs anytime under ` +
          `Suppliers → ${data.name}.`,
        streaming: true,
      },
    ]);

    pushFlowReceipt({
      headline: `Added ${data.name} + ${products.length} products`,
      detail: `Live at ${siteSummary} · cut-off ${data.cutOffTime ?? '—'}, ${data.leadTimeDays ?? '—'}d lead`,
      href: '/suppliers',
      hrefLabel: 'View in Suppliers',
    });

    // POS-match follow-up — runs after the done message has had a
    // moment to type, so the suggestion card lands as a deliberate
    // second beat rather than fighting the confirmation for attention.
    queuePosMatchFollowUp(persistedProducts);
  }

  function startIntegrityCheck() {
    setChatMinimized(false);
    setChatStarted(true);
    setMessages([{ id: `u-integrity-${Date.now()}`, role: 'user', text: 'Check my recipes and costs' }]);
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: `q-integrity-${Date.now()}`,
        role: 'quinn',
        text: "We've checked all **456 live recipes** and the 2,600 ingredient lines inside them. Mostly clean: **12 clear fixes**, a couple of things to check with the kitchen, and some tidy-ups. In priority order:",
        msgType: 'integrity-check',
      }]);
    }, 2000);
  }

  /** A fix button on the review card → seed a batch-review card with
   *  that finding's rows (or everything, for the card-level button).
   *  The finding flips to "In review" on the source card; the batch
   *  card owns the rest of the flow. */
  function startIntegrityFix(sourceMsgId: string, findingId: string = 'all') {
    const key = `${sourceMsgId}:${findingId}`;
    if (integrityFixStarted[key] || integrityFixStarted[`${sourceMsgId}:all`]) return;
    setIntegrityFixStarted((prev) => ({ ...prev, [key]: true }));

    const meta = INTEGRITY_BATCH_META[findingId] ?? INTEGRITY_BATCH_META.all;
    const thinkingId = `q-integrity-fix-thinking-${Date.now()}`;
    const batchCardId = `q-integrity-batch-${Date.now()}`;
    setBatchReviewStates((prev) => ({ ...prev, [batchCardId]: { state: 'pending' } }));

    setMessages((prev) => [
      ...prev,
      { id: `u-integrity-fix-${Date.now()}`, role: 'user', text: meta.echo },
      { id: thinkingId, role: 'quinn', text: '', msgType: 'cmd-thinking' },
    ]);

    const introId = `q-integrity-fix-intro-${Date.now()}`;
    window.setTimeout(() => {
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== thinkingId);
        return [
          ...without,
          { id: introId, role: 'quinn', text: meta.intro, streaming: true },
        ];
      });
      const streamMs = meta.intro.length * 18;
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: batchCardId,
            role: 'quinn',
            text: '',
            msgType: 'integrity-batch-review',
            cmdArgsJson: JSON.stringify({ findingId }),
          },
        ]);
      }, streamMs + 400);
    }, 1600);
  }

  /** Apply the ticked fixes. Two rows are rigged to fail so the
   *  partial-failure path renders: failed rows stay listed with a
   *  reason, everything else commits, and the receipt reports both
   *  numbers. */
  function confirmIntegrityBatch(cardId: string, submitted: BatchReviewSubmission[]) {
    const cur = batchReviewStates[cardId];
    if (cur && cur.state !== 'pending') return;

    const FAILURES: Record<string, string> = {
      'fix-cup-smoothie': 'This recipe is locked by an open menu review. Retry once it\u2019s published.',
      'fix-unit-honey': 'Two live honey products match this line, so it needs a manual pick.',
    };
    const results: BatchRowResult[] = submitted.map((row) => (
      FAILURES[row.id]
        ? { id: row.id, ok: false, error: FAILURES[row.id] }
        : { id: row.id, ok: true }
    ));
    const failed = results.filter((r) => !r.ok).length;
    const applied = results.length - failed;

    setBatchReviewStates((prev) => ({
      ...prev,
      [cardId]: { state: failed > 0 ? 'partial' : 'confirmed', results },
    }));

    logHistoryEntry({
      kind: 'chat',
      title: `Fixed ${applied} recipe cost issue${applied === 1 ? '' : 's'}`,
      subtitle: failed > 0 ? `${failed} didn't save, needs follow-up` : 'All fixes applied',
    });
    pushFlowReceipt({
      headline: `Done: ${applied} of ${results.length} fixes applied`,
      detail: failed > 0
        ? `${failed} didn't save; those lines are exactly as they were, and the rows above say why.`
        : 'All selected fixes applied.',
    });
  }

  /** Packaging cost (£/serve) for one channel — only rows flagged
   *  for that channel count, mirroring web-v2's channel maths. */
  function packagingCostForChannel(channel: keyof PackagingChannels): number {
    return packagingRows
      .filter((p) => selectedPackaging.has(p.id) && (packagingChannels[p.id] ?? DEFAULT_PACKAGING_CHANNELS)[channel])
      .reduce((s, p) => s + packagingLineGBP(p), 0);
  }

  /** State 4 → 5. Yield-loss values applied to the working rows. */
  function confirmYieldLoss() {
    setRecipeIngredients(prev => prev.map((ing) => {
      const v = yieldLossDraft[ing.id];
      return Number(v) > 0 ? { ...ing, yieldLossPct: v } : { ...ing, yieldLossPct: undefined };
    }));
    const parts = recipeIngredients
      .filter((ing) => Number(yieldLossDraft[ing.id]) > 0)
      .map((ing) => `${ing.name} ${yieldLossDraft[ing.id]}%`);
    setMessages(prev => [...prev, {
      id: `u-yield-loss-${Date.now()}`,
      role: 'user',
      text: parts.length > 0 ? `Yield loss: ${parts.join(', ')}` : 'No yield loss',
    }]);
    setRecipeFlow(5);
  }

  function skipYieldLoss() {
    setYieldLossSkipped(true);
    setMessages(prev => [...prev, { id: `u-yield-skip-${Date.now()}`, role: 'user', text: 'No yield loss' }]);
    setRecipeFlow(5);
  }

  /** State 6 → 7. Variable ingredients confirmed (or none). */
  function confirmVariableIngredients() {
    const parts = variableIngredients.map((v) =>
      v.type === 'Extra' ? `add ${v.name}` : `${v.name} for ${v.replacesName ?? 'a base ingredient'}`,
    );
    setMessages(prev => [...prev, {
      id: `u-variable-${Date.now()}`,
      role: 'user',
      text: `Variable ingredients: ${parts.join(', ')}`,
    }]);
    setRecipeFlow(7);
  }

  function skipVariableIngredients() {
    setVariableSkipped(true);
    setMessages(prev => [...prev, { id: `u-variable-skip-${Date.now()}`, role: 'user', text: 'No variable ingredients' }]);
    setRecipeFlow(7);
  }

  function confirmPackaging() {
    const chosen = packagingRows.filter(p => selectedPackaging.has(p.id));
    const total = chosen.reduce((s, p) => s + packagingLineGBP(p), 0);
    const names = chosen.map(p => (Number(p.qty) || 0) > 1 ? `${p.qty}× ${p.name}` : p.name).join(', ');
    setMessages(prev => [...prev, {
      id: `u-packaging-${Date.now()}`,
      role: 'user',
      text: chosen.length > 0
        ? `Add ${names} (+£${total.toFixed(2)}/serve)`
        : 'No packaging needed',
    }]);
    setRecipeFlow(9);
  }

  function skipPackaging() {
    setPackagingSkipped(true);
    setMessages(prev => [...prev, {
      id: `u-packaging-skip-${Date.now()}`,
      role: 'user',
      text: 'No packaging needed',
    }]);
    setRecipeFlow(9);
  }

  /** State 10 → 11. User picked a target food-cost %. */
  function confirmCogsTarget() {
    setMessages(prev => [...prev, {
      id: `u-cogs-target-${Date.now()}`,
      role: 'user',
      text: `Target ${targetCogsPct}% food cost`,
    }]);
    setRecipeFlow(11);
  }

  /** State 12 → 13. Price locked. Each channel's SRP works forward
   *  from that channel's cost — food cost plus the packaging flagged
   *  for the channel — at the target %, the way web-v2 prices. */
  function confirmMarginExplorer() {
    const liveRows = recipeIngredientsToTemplateRows(recipeIngredients);
    const costP = totalFoodCostP(liveRows);
    const vatPct = activeTemplate.vatHot ? 20 : 0;
    const dineInEx = srpExVatForCogs(costP + Math.round(packagingCostForChannel('dineIn') * 100), targetCogsPct);
    const takeawayEx = srpExVatForCogs(costP + Math.round(packagingCostForChannel('takeaway') * 100), targetCogsPct);
    const deliveryEx = srpExVatForCogs(costP + Math.round(packagingCostForChannel('delivery') * 100), targetCogsPct);
    const deliveryInc = srpIncVat(deliveryEx, 20);
    lockedPricingRef.current = {
      srpExVat: dineInEx,
      targetCogsPct,
      foodCostGBP: penceToPounds(costP),
      vatPct,
      takeawayExVat: takeawayEx,
      deliveryExVat: deliveryEx,
      dineInIncVat: srpIncVat(dineInEx, vatPct),
      takeawayIncVat: srpIncVat(takeawayEx, vatPct),
      deliveryIncVat: deliveryInc,
      deliveryNetGBP: deliveryNet(deliveryInc, 30),
    };
    setMessages(prev => [...prev, {
      id: `u-margin-${Date.now()}`,
      role: 'user',
      text: `Price it at £${dineInEx.toFixed(2)} dine in (${targetCogsPct}% food cost, £${penceToPounds(costP).toFixed(2)} cost)`,
    }]);
    setRecipeFlow(13);
  }

  function confirmAllergens() {
    const list = Array.from(selectedAllergens).join(', ');
    setMessages(prev => [...prev, {
      id: `u-allergens-${Date.now()}`,
      role: 'user',
      text: list.length > 0 ? `Confirmed — ${list}` : 'Confirmed — no allergens',
    }]);
    setRecipeFlow(15);
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
    setRecipeFlow(17);
  }

  /** State 18 → 19. The pre-save summary confirmed — this is the one
   *  write in the flow. The recipe lands in `recipeStore` with every
   *  field the wizard collected, so it shows up in the recipes list
   *  exactly like a manually built one. Production settings save as
   *  defaults; the optional walkthrough after the supplier offer
   *  patches them if taken. */
  function confirmRecipeSave() {
    const pricing = lockedPricingRef.current;
    const rows = recipeIngredientsToTemplateRows(recipeIngredients);
    const chosenPackaging = packagingRows.filter((p) => selectedPackaging.has(p.id));
    const siteNames = MOCK_SITES.filter((s) => selectedSites.has(s.id)).map((s) => s.name);
    const foodCostGBP = pricing?.foodCostGBP ?? penceToPounds(totalFoodCostP(rows));
    const srpEx = pricing?.srpExVat ?? 0;
    const yieldQty = Number(recipeYieldQty) || activeTemplate.yieldQty;
    const trimmedInstructions = recipeInstructions.trim();
    const recipeId = `recipe-cc-${Date.now()}`;

    const newRecipe: Recipe = {
      id: recipeId,
      name: recipeName,
      category: prodCategoryToRecipeCategory(DEFAULT_PROD_SETTINGS.category),
      ingredientCost: foodCostGBP,
      priceDineIn: srpEx,
      priceTakeaway: pricing?.takeawayExVat ?? srpEx,
      priceDelivery: pricing?.deliveryExVat ?? srpEx,
      marginPct: srpEx > 0 ? Math.max(0, 100 - effectiveCogsPct(Math.round(foodCostGBP * 100), srpEx)) : 0,
      status: 'Active',
      flag: null,
      ingredients: recipeIngredients.map((r) => {
        const loss = Number(r.yieldLossPct) || 0;
        const grossUnitCostP = loss > 0 ? r.unitCostP / (1 - loss / 100) : r.unitCostP;
        return {
          name: loss > 0 ? `${r.name} (${loss}% yield loss)` : r.name,
          qty: r.toTaste ? 'to taste' : `${r.qty}${r.uom}`,
          supplier: r.source,
          price: penceToPounds((Number(r.qty) || 0) * grossUnitCostP),
        };
      }),
      posLinked: false,
      production: {
        visibility: 'Kitchen',
        shelfLifeMinutes: shelfLifeToMinutes(DEFAULT_PROD_SETTINGS.shelfLife),
        prepTimeSeconds: prepTimeToSeconds(DEFAULT_PROD_SETTINGS.prepTime),
        expiryDate: null,
      },
      // Sub-recipe stays on `advanced.isSubRecipe` (production's shape);
      // `kind` still describes how the recipe is sold, matching the
      // manual builder's split between the two.
      kind: 'standalone',
      countInStockTake: recipeSettings.countInStockTake,
      excludeFromCogs: recipeSettings.excludeFromCogs,
      formExtras: {
        yieldQty,
        yieldUom: activeTemplate.yieldUom,
        sites: siteNames,
        allergens: Array.from(selectedAllergens),
        ...(trimmedInstructions ? { instructions: trimmedInstructions } : {}),
        packaging: chosenPackaging.map((p) => ({
          id: p.id,
          name: p.name,
          supplier: 'Packaging',
          qty: Number(p.qty) || 1,
          uom: p.unit,
          unitCostP: Math.round(p.cost * 100),
        })),
        ...(variableIngredients.length > 0
          ? {
              variableIngredients: variableIngredients.map((v) => ({
                id: v.id,
                name: v.replacesName ? `${v.name} (replaces ${v.replacesName})` : v.name,
                supplier: 'Added in chat',
                qty: Number(v.qty) || '',
                uom: v.uom,
                unitCostP: 0,
                type: v.type,
              })),
            }
          : {}),
        advanced: {
          productClass: activeTemplate.productClass,
          isSubRecipe: recipeSettings.subRecipe,
          countInStockTake: recipeSettings.countInStockTake,
          excludeFromCogs: recipeSettings.excludeFromCogs,
        },
        pricing: {
          vatPct: pricing?.vatPct ?? 20,
          hotCold: activeTemplate.vatHot ? 'hot' : 'cold',
          srpDineInEx: srpEx,
          srpTakeawayEx: pricing?.takeawayExVat ?? srpEx,
          srpDeliveryEx: pricing?.deliveryExVat ?? srpEx,
          deliveryCommission: 30,
        },
      },
    };
    addRecipe(newRecipe);
    savedRecipeIdRef.current = recipeId;
    doneSiteNamesRef.current = siteNames;
    setMessages(prev => [...prev, { id: `u-confirm-${Date.now()}`, role: 'user', text: 'Looks good, save it' }]);
    setRecipeFlow(19);
  }

  function confirmSupplier() {
    supplierLinkedRef.current = true;
    setMessages(prev => [...prev, { id: `u-supplier-${Date.now()}`, role: 'user', text: 'Yes, add them' }]);
    setRecipeFlow(21);
  }

  function skipSupplierOffer() {
    supplierLinkedRef.current = false;
    setMessages(prev => [...prev, { id: `u-supplier-skip-${Date.now()}`, role: 'user', text: 'Not now, thanks' }]);
    setRecipeFlow(21);
  }

  /** State 22 → 23. Optional production walkthrough accepted. */
  function acceptProductionOffer() {
    setMessages(prev => [...prev, { id: `u-prod-yes-${Date.now()}`, role: 'user', text: 'Yes, set them now' }]);
    setProdSettings({ ...DEFAULT_PROD_SETTINGS });
    setRecipeFlow(23);
    window.setTimeout(() => {
      setMessages(prev => [...prev, {
        id: `q-prod-start-${Date.now()}`,
        role: 'quinn',
        text: buildProdPrepMsg(recipeName),
        msgType: 'prod-prep',
      }]);
      setProductionFlow(2);
    }, 700);
  }

  /** State 22 → 24. Production declined — defaults stand. */
  function skipProductionOffer() {
    productionConfiguredRef.current = false;
    setMessages(prev => [...prev, { id: `u-prod-skip-${Date.now()}`, role: 'user', text: "Not now — I'll set them later" }]);
    setRecipeFlow(24);
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

  function sendMessage(
    overrideText?: string,
    explicitChart?: AnalyticsChartId | null,
    tableOpts?: { tableQuery: TableQuery; tableTitle?: string },
  ) {
    const raw = overrideText !== undefined ? overrideText : input;
    const text = raw.trim();
    // Allow a send with empty text when there's an attached file —
    // the paperclip itself carries intent (the chat-driven product
    // sheet import flow handles the empty-text path).
    if (!text && !attachedFileName) return;

    // Starting fresh from the command-centre composer? Clear the
    // previous thread first so a new send doesn't pile onto whatever
    // conversation was running just before the user minimised. The
    // prior chat is preserved in the history drawer via
    // `logHistoryEntry`, so dropping it from in-memory state here is
    // safe. Functional setMessages calls below still see the cleared
    // array because React applies queued updates in order before
    // running each functional updater.
    if (chatMinimized) {
      setMessages([]);
    }

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', text };
    setChatStarted(true);
    setChatMinimized(false);
    setInput('');

    // Recipe-name answer — the "Update recipe" suggestion asks "what kind
    // of recipe?" first (startRecipeAsk), then routes the operator's reply
    // into the recipe builder seeded with whatever they named. `append`
    // keeps the question + answer in the transcript.
    //
    // Escape hatch: if the "reply" is actually a fully-formed command
    // ("update Agility lead time to 3 days and MOV to £350"), the
    // operator has moved on — route it like any other message instead
    // of force-feeding it to the recipe builder as a recipe name.
    if (awaitingRecipeName) {
      setAwaitingRecipeName(false);
      if (explicitChart === undefined && !tableOpts && detectChageeTeaSwap(text)) {
        startChageeTeaSwap({ fileName: attachedFileName, userText: text });
        return;
      }
      if (explicitChart === undefined && !tableOpts && detectStockTakeReview(text)) {
        startStockTakeReview({ userText: text });
        return;
      }
      if (explicitChart === undefined && !tableOpts && detectProductSwapAcrossRecipes(text)) {
        startBeanSwapFromSheet({ fileName: attachedFileName ?? 'riverbank-roasters-beans.pdf', userText: text });
        return;
      }
      const escaped = explicitChart === undefined && !tableOpts ? parseCommand(text) : null;
      if (escaped && escaped.confidence >= 0.8) {
        commandRunner.runCommand(escaped, { userText: text });
        return;
      }
      startRecipeFlow(text, { userEcho: text, append: true });
      return;
    }

    // "Note:" capture — a note the operator jots from the composer's
    // "Note for Edify" quick action. Logs straight to the notebook
    // (/notebook) and gets a short Edify confirmation, skipping the
    // normal command / analytics routing below.
    if (explicitChart === undefined && !tableOpts) {
      const noteMatch = /^note\s*:/i.exec(text);
      if (noteMatch) {
        const body = text.slice(noteMatch[0].length).trim();
        if (body) {
          const reply =
            "Logged to your notebook. I'll thread it through your themes and flag if it connects to anything in your data.";
          addNotebookNote({ text: body, reply });
          logHistoryEntry({
            kind: 'chat',
            title: body.length > 60 ? `${body.slice(0, 57)}…` : body,
            subtitle: 'Note · notebook',
          });
          setMessages((prev) => [
            ...prev,
            userMsg,
            { id: `q-note-${Date.now()}`, role: 'quinn' as const, text: reply, streaming: true },
          ]);
          return;
        }
      }
    }

    // New-supplier onboarding — runs FIRST so phrasings like "add a
    // new supplier with their catalogue" don't get hijacked by the
    // product-sheet detector below (which also matches "supplier" +
    // "sheet"). The flow expects two attached files conceptually
    // (supplier sheet + catalogue) — either one paperclip or none
    // is enough because the demo mocks the second file.
    // Sheet-driven product swap — "add a new coffee bean and swap it
    // across the recipes that use it". Checked before the generic
    // sheet importer so an attached bean sheet lands here. Mocks the
    // sheet filename when the operator described it in words but didn't
    // actually paperclip anything.
    // Chagee tea-leaf demo — the "new supplier + product + recipe
    // swap across franchises" scenario. Checked before every other
    // importer because its phrasing ("add the new supplier and the
    // product then update the recipe") would otherwise trip the
    // generic supplier/product detectors.
    if (explicitChart === undefined && !tableOpts) {
      if (detectChageeTeaSwap(text)) {
        startChageeTeaSwap({ fileName: attachedFileName, userText: text });
        return;
      }
    }

    // Stock-take review demo — "update my stock takes, review the
    // products that aren't in a stock area". Checked before
    // parseCommand because "stock" phrasing would otherwise trip the
    // generic stock-count command.
    if (explicitChart === undefined && !tableOpts) {
      if (detectStockTakeReview(text)) {
        startStockTakeReview({ userText: text });
        return;
      }
    }

    if (explicitChart === undefined && !tableOpts) {
      if (detectProductSwapAcrossRecipes(text)) {
        const fileName = attachedFileName ?? 'riverbank-roasters-beans.pdf';
        startBeanSwapFromSheet({ fileName, userText: text });
        return;
      }
    }

    if (explicitChart === undefined && !tableOpts) {
      if (detectNewSupplierImport(text)) {
        startNewSupplierImport({ primaryFileName: attachedFileName, userText: text });
        return;
      }
    }

    // Product-sheet import — short-circuits the rest. Fires when:
    //   • a file is paperclipped to this message (the attachment alone
    //     is the intent signal), OR
    //   • the text reads like an "add a product from a sheet/file/
    //     document" ask. When the operator says it in words but
    //     didn't actually paperclip anything, we mock a filename so
    //     the demo still flows.
    if (explicitChart === undefined && !tableOpts) {
      const hasAttachment = !!attachedFileName;
      if (detectProductSheetImport(text, hasAttachment)) {
        const fileName = attachedFileName ?? 'bacon-supplier-sheet.pdf';
        startProductSheetImport({ fileName, userText: text });
        return;
      }
    }

    // "New recipe" intent — sits BEFORE parseCommand because the recipe
    // wizard is its own state machine (not a registered Command), and
    // we want flexible phrasing ("add an avocado toast", "new recipe",
    // bare "avocado toast") to land on the wizard rather than the
    // generic text reply.
    if (explicitChart === undefined && !tableOpts) {
      const seed = detectNewRecipeIntent(text);
      if (seed !== null) {
        startRecipeFlow(seed, { userEcho: text });
        return;
      }
    }

    // Chat-command detection — runs before analytics so phrases like
    // "waste 3 muffins" don't get routed to a fallback text reply.
    // Skip when an explicit chart / table query was forced by the caller
    // (auto-send / pinned chart re-runs).
    if (explicitChart === undefined && !tableOpts) {
      const intent = parseCommand(text);
      if (intent) {
        commandRunner.runCommand(intent, { userText: text });
        return;
      }
    }

    // Table flow takes precedence when an explicit table query was provided.
    if (tableOpts) {
      // Record this in history as a question. We don't have a stable
      // deep-link for ad-hoc tables, so the entry surfaces the text
      // the user asked plus the table's title as the subtitle.
      const tableTask = logHistoryEntry({
        kind: 'question',
        title: text,
        subtitle: tableOpts.tableTitle ? `Table · ${tableOpts.tableTitle}` : 'Table',
      });
      const thinkingId = `q-table-thinking-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: thinkingId, role: 'quinn' as const, text: '', msgType: 'analytics-thinking' },
      ]);
      window.setTimeout(() => {
        setMessages((prev) => {
          const withoutThinking = prev.filter((m) => m.id !== thinkingId);
          return [
            ...withoutThinking,
            {
              id: `q-table-result-${Date.now()}`,
              role: 'quinn' as const,
              text:
                tableOpts.tableTitle
                  ? `Here's a table for "${tableOpts.tableTitle}". Pin it to a view, or tell me what you'd like to change.`
                  : "Here's a table built from your data. Pin it to a view, or tell me what you'd like to change.",
              msgType: 'table-result',
              tableQuery: tableOpts.tableQuery,
              tableTitle: tableOpts.tableTitle ?? text,
            },
          ];
        });
      }, 700);
      // Follow up shortly after with a Quinn insight + suggestions, mirroring
      // the chart flow's "what stands out" commentary.
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `q-table-insight-${Date.now()}`,
            role: 'quinn' as const,
            text: insightForTableQuery(tableOpts.tableQuery),
          },
        ]);
        // The thread is now complete — snapshot it into the question
        // task so clicking it from history replays the exchange.
        commandRunner.snapshotTask(tableTask.id);
      }, 1500);
      return;
    }

    let detected: AnalyticsChartId | null = null;
    if (explicitChart !== undefined) {
      detected = explicitChart;
    } else {
      // Prefix detection for typed input. Order matters (more specific first).
      const lower = text.toLowerCase();
      const looksLikeCogsPct =
        lower.includes('cogs') &&
        (lower.includes('% of revenue') ||
          lower.includes('percentage of revenue') ||
          lower.includes('as a %') ||
          lower.includes('as a percentage'));
      const looksLikeTopIngredientsByCost =
        lower.includes('ingredient') &&
        (lower.includes('cost') || lower.includes('spend')) &&
        (lower.includes('top') || lower.includes('biggest') || lower.includes('most'));
      const looksLikeLowestMarginItems =
        (lower.includes('lowest') ||
          lower.includes('worst') ||
          lower.includes('thinnest') ||
          lower.includes('smallest')) &&
        (lower.includes('margin') || lower.includes('gross margin') || lower.includes('gm '));
      // Follow-up phrasings the user types after the weekly sales chart.
      // We deliberately match short, conversational variants ("per day",
      // "by hour", "now per hour") because the demo flow drills:
      //   sales (by site) → sales-by-day → hour
      const looksLikeBreakdownByDay =
        (lower.includes('per day') ||
          lower.includes('by day') ||
          lower.includes('daily breakdown') ||
          lower.includes('day by day')) &&
        !lower.includes('per hour') &&
        !lower.includes('by hour');
      const looksLikeBreakdownByHour =
        lower.includes('per hour') ||
        lower.includes('by hour') ||
        lower.includes('hourly') ||
        lower.includes('hour by hour');
      if (looksLikeCogsPct)                        detected = 'cogs-pct';
      else if (looksLikeTopIngredientsByCost)      detected = 'cogs-top-ingredients';
      else if (looksLikeLowestMarginItems)         detected = 'low-gross-margin-items';
      else if (looksLikeBreakdownByDay)            detected = 'sales-by-day';
      else if (looksLikeBreakdownByHour)           detected = 'hour';
      else if (text.startsWith('Which site has'))  detected = 'growth';
      else if (text.startsWith('Which sites are')) detected = 'cogs';
      else if (text.startsWith('Which hour'))      detected = 'hour';
      else if (text.startsWith('What were'))       detected = 'sales';
      else if (text.startsWith('How has'))         detected = 'trend';
      else if (text.startsWith('What is'))         detected = 'labour';
    }

    if (detected) {
      // Persist the question to history. The chart id is the most
      // stable description we have for the subtitle.
      const chartTask = logHistoryEntry({
        kind: 'question',
        title: text,
        subtitle: `Chart · ${detected}`,
      });
      setMessages(prev => [...prev, userMsg, {
        id: `q-thinking-${Date.now()}`,
        role: 'quinn' as const,
        text: '',
        msgType: 'analytics-thinking',
      }]);
      setAnalyticsType(detected);
      setAnalyticsStep(1);
      // The chart + insight land asynchronously across two timeouts;
      // see the effect on `analyticsStep === 3` which finalises the
      // snapshot for this task.
      pendingAnalyticsTaskRef.current = chartTask.id;
    } else {
      // No canned chart — Quinn responds with a brief text answer
      // after a short beat. File the exchange under "chat" so the
      // history still picks it up.
      const chatTask = logHistoryEntry({
        kind: 'chat',
        title: text,
      });
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
        // Thread complete — snapshot for history replay.
        commandRunner.snapshotTask(chatTask.id);
      }, 900);
    }
  }

  // ── Workspace split view ─────────────────────────────────────────
  // Claude-artifacts style: when the chat surface is wide enough and
  // the conversation has produced interactive cards, the chat stream
  // stays on the left and the cards stack in a workspace panel on the
  // right. Width is measured on the root element so the split only
  // engages on the expanded/full-page chat — the narrow aside keeps
  // cards inline.
  const feedRootRef = useRef<HTMLDivElement | null>(null);
  const [feedWidth, setFeedWidth] = useState(0);
  useEffect(() => {
    const el = feedRootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setFeedWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wizard cards render from their step onwards — once completed they
  // persist greyed-out with a Done/Cancelled badge rather than
  // vanishing, so the panel doubles as the session's audit trail.
  const isWorkspaceCardLive = (m: ChatMsg): boolean => {
    switch (m.msgType) {
      case 'yield-loss': return recipeFlow >= 4;
      case 'variable-ingredients': return recipeFlow >= 6;
      case 'packaging-picker': return recipeFlow >= 8;
      case 'allergen-check': return recipeFlow >= 14;
      case 'site-selection': return recipeFlow >= 16;
      case 'recipe-save-summary': return recipeFlow >= 18;
      case 'prod-prep': return productionFlow >= 2;
      case 'prod-shelf': return productionFlow >= 4;
      case 'prod-batch': return productionFlow >= 6;
      case 'prod-category': return productionFlow >= 8;
      case 'prod-summary': return productionFlow >= 10;
      default: return true;
    }
  };
  const workspaceMessages = messages.filter(
    (m) => isWorkspaceMsg(m) && isWorkspaceCardLive(m),
  );
  const splitView =
    chatStarted && !chatMinimized && workspaceMessages.length > 0 && feedWidth >= 960;
  const wideWorkspace = workspaceMessages.some((m) => !!m.msgType && WIDE_WORKSPACE_MSG_TYPES.has(m.msgType));

  // Keep the workspace panel pinned to the newest card.
  const workspaceEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!splitView) return;
    workspaceEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [splitView, workspaceMessages.length]);

  /** Renders the interactive card for a message (or nothing if the
   *  message isn't a card / its wizard step has passed). Used by both
   *  the inline chat stream (narrow view) and the workspace panel
   *  (split view) so the card logic lives in exactly one place. */
  function renderWorkspaceCard(m: ChatMsg): ReactNode {
    return (
      <>
        {m.msgType === 'chagee-tea-supplier' && (
          <ChageeTeaSupplierCard
            confirmed={!!chageeSupplierConfirmed[m.id]}
            onConfirm={() => confirmChageeSupplier(m.id)}
          />
        )}
        {m.msgType === 'chagee-tea-recipe' && (
          <ChageeTeaRecipeCard
            franchises={chageeFranchises[m.id] ?? new Set(CHAGEE_TEA_SWAP.franchises)}
            confirmed={!!chageeRecipeConfirmed[m.id]}
            onToggleFranchise={(site) => {
              setChageeFranchises((prev) => {
                const cur = new Set(prev[m.id] ?? new Set(CHAGEE_TEA_SWAP.franchises));
                if (cur.has(site)) cur.delete(site);
                else cur.add(site);
                return { ...prev, [m.id]: cur };
              });
            }}
            onToggleAll={(allOn) => {
              setChageeFranchises((prev) => ({
                ...prev,
                [m.id]: allOn ? new Set(CHAGEE_TEA_SWAP.franchises) : new Set<string>(),
              }));
            }}
            onConfirm={() => confirmChageeRecipe(m.id)}
          />
        )}
        {m.msgType === 'stock-review' && (
          <StockReviewCard
            selected={stockReviewSelected[m.id] ?? new Set(STOCK_TAKE_REVIEW.products.map((p) => p.id))}
            confirmed={!!stockReviewConfirmed[m.id]}
            onToggle={(id) => {
              setStockReviewSelected((prev) => {
                const cur = new Set(prev[m.id] ?? new Set(STOCK_TAKE_REVIEW.products.map((p) => p.id)));
                if (cur.has(id)) cur.delete(id);
                else cur.add(id);
                return { ...prev, [m.id]: cur };
              });
            }}
            onToggleAll={(allOn) => {
              setStockReviewSelected((prev) => ({
                ...prev,
                [m.id]: allOn ? new Set(STOCK_TAKE_REVIEW.products.map((p) => p.id)) : new Set<string>(),
              }));
            }}
            onConfirm={() => confirmStockReview(m.id)}
          />
        )}
        {m.msgType === 'stock-sites' && (
          <StockSitesCard
            sites={stockSitesSelected[m.id] ?? new Set(ALL_SUPPLIER_SITES)}
            confirmed={!!stockSitesConfirmed[m.id]}
            onToggleSite={(site) => {
              setStockSitesSelected((prev) => {
                const cur = new Set(prev[m.id] ?? new Set(ALL_SUPPLIER_SITES));
                if (cur.has(site)) cur.delete(site);
                else cur.add(site);
                return { ...prev, [m.id]: cur };
              });
            }}
            onToggleAll={(allOn) => {
              setStockSitesSelected((prev) => ({
                ...prev,
                [m.id]: allOn ? new Set(ALL_SUPPLIER_SITES) : new Set<string>(),
              }));
            }}
            onConfirm={() => confirmStockSites(m.id)}
          />
        )}
        {m.msgType === 'storage-area' && (
          <StorageAreaCard
            productIds={stockAreaProducts[m.id] ?? []}
            choices={stockAreaChoice[m.id] ?? {}}
            confirmed={!!stockAreaConfirmed[m.id]}
            onPickArea={(productId, areaId) => {
              setStockAreaChoice((prev) => ({
                ...prev,
                [m.id]: { ...(prev[m.id] ?? {}), [productId]: areaId },
              }));
            }}
            onConfirm={() => confirmStorageArea(m.id)}
          />
        )}
        {m.msgType === 'new-supplier-import' && (() => {
                          let parsed: { data: ExtractedSupplierSheet } | null = null;
                          try {
                            parsed = m.cmdArgsJson ? JSON.parse(m.cmdArgsJson) : null;
                          } catch {
                            parsed = null;
                          }
                          if (!parsed) return null;
                          const sites = supplierImportSites[m.id] ?? new Set<string>(ALL_SUPPLIER_SITES);
                          const confirmed = !!supplierImportConfirmed[m.id];
                          const open = !!supplierCatalogueOpen[m.id];
                          // Live product list — falls back to the
                          // sealed catalogue if state hasn't been
                          // seeded yet (mostly for safety on remounts).
                          const liveProducts =
                            supplierImportProducts[m.id] ?? parsed.data.products;
                          const expandedIdx =
                            supplierExpandedRow[m.id] ?? null;
                          return (
                            <NewSupplierImportCard
                              data={parsed.data}
                              products={liveProducts}
                              expandedIndex={expandedIdx}
                              onToggleExpandRow={(idx) => {
                                setSupplierExpandedRow((prev) => ({
                                  ...prev,
                                  [m.id]: prev[m.id] === idx ? null : idx,
                                }));
                              }}
                              onEditProduct={(idx, patch) => {
                                setSupplierImportProducts((prev) => {
                                  const rows = prev[m.id] ?? parsed!.data.products;
                                  const next = rows.map((row, i) =>
                                    i === idx ? { ...row, ...patch } : row,
                                  );
                                  return { ...prev, [m.id]: next };
                                });
                              }}
                              onRemoveProduct={(idx) => {
                                setSupplierImportProducts((prev) => {
                                  const rows = prev[m.id] ?? parsed!.data.products;
                                  const next = rows.filter((_, i) => i !== idx);
                                  return { ...prev, [m.id]: next };
                                });
                                // Collapse the panel since the row
                                // it was anchored to is gone.
                                setSupplierExpandedRow((prev) => ({
                                  ...prev,
                                  [m.id]: null,
                                }));
                              }}
                              sites={sites}
                              confirmed={confirmed}
                              catalogueOpen={open}
                              onToggleCatalogue={() => {
                                setSupplierCatalogueOpen((prev) => ({ ...prev, [m.id]: !prev[m.id] }));
                              }}
                              onToggleSite={(site) => {
                                setSupplierImportSites((prev) => {
                                  const cur = new Set(prev[m.id] ?? new Set<string>(ALL_SUPPLIER_SITES));
                                  if (cur.has(site)) cur.delete(site);
                                  else cur.add(site);
                                  return { ...prev, [m.id]: cur };
                                });
                              }}
                              onToggleAll={(allOn) => {
                                setSupplierImportSites((prev) => ({
                                  ...prev,
                                  [m.id]: allOn ? new Set(ALL_SUPPLIER_SITES) : new Set<string>(),
                                }));
                              }}
                              onConfirm={() => {
                                if (!parsed) return;
                                confirmNewSupplierImport(m.id, parsed.data);
                              }}
                            />
                          );
                        })()}
                        {m.msgType === 'product-sheet-import' && (() => {
                          // Parse the args we baked into the message
                          // when the flow created it. The card reads
                          // selections from `productImportSites` keyed
                          // by the message id (== the card id).
                          let parsed: { data: ExtractedProductSheet; fileName: string } | null = null;
                          try {
                            parsed = m.cmdArgsJson ? JSON.parse(m.cmdArgsJson) : null;
                          } catch {
                            parsed = null;
                          }
                          if (!parsed) return null;
                          const sites = productImportSites[m.id] ?? new Set<string>(ALL_SUPPLIER_SITES);
                          const confirmed = !!productImportConfirmed[m.id];
                          return (
                            <ProductSheetImportCard
                              data={parsed.data}
                              fileName={parsed.fileName}
                              sites={sites}
                              confirmed={confirmed}
                              onToggleSite={(site) => {
                                setProductImportSites((prev) => {
                                  const cur = new Set(prev[m.id] ?? new Set<string>(ALL_SUPPLIER_SITES));
                                  if (cur.has(site)) cur.delete(site);
                                  else cur.add(site);
                                  return { ...prev, [m.id]: cur };
                                });
                              }}
                              onToggleAll={(allOn) => {
                                setProductImportSites((prev) => ({
                                  ...prev,
                                  [m.id]: allOn ? new Set(ALL_SUPPLIER_SITES) : new Set<string>(),
                                }));
                              }}
                              onConfirm={() => {
                                if (!parsed) return;
                                confirmProductImport(m.id, parsed.data, parsed.fileName);
                              }}
                            />
                          );
                        })()}
                        {m.msgType === 'pos-match-suggestions' && (() => {
                          let parsed: { suggestions: POSMatchSuggestion[] } | null = null;
                          try {
                            parsed = m.cmdArgsJson ? JSON.parse(m.cmdArgsJson) : null;
                          } catch {
                            parsed = null;
                          }
                          if (!parsed || parsed.suggestions.length === 0) return null;
                          const decisions = posMatchDecisions[m.id] ?? {};

                          // Rule #2: once every row is decided, the flow ends
                          // with a receipt. Ref-guarded so undo/redo can't
                          // emit a second one.
                          const maybeReceipt = (next: Record<string, 'applied' | 'skipped'>) => {
                            if (posMatchReceiptSentRef.current.has(m.id)) return;
                            if (parsed!.suggestions.some((s) => !next[s.posItemId])) return;
                            posMatchReceiptSentRef.current.add(m.id);
                            const applied = parsed!.suggestions.filter((s) => next[s.posItemId] === 'applied').length;
                            const skipped = parsed!.suggestions.length - applied;
                            pushFlowReceipt({
                              headline: `Done: ${applied} POS button${applied === 1 ? '' : 's'} linked`,
                              detail: skipped > 0
                                ? `Sales on ${applied === 1 ? 'it' : 'them'} now come out of the right stock. ${skipped} skipped; ${skipped === 1 ? 'it stays' : 'they stay'} on the Item matching page.`
                                : 'Sales on these buttons now come out of the right stock.',
                              href: '/item-matching',
                              hrefLabel: 'Open Item matching',
                            });
                          };

                          const apply = (s: POSMatchSuggestion) => {
                            // Write through to the same override store the
                            // Item matching page reads from — so the row
                            // there will reflect the link instantly.
                            setMatchTarget(s.posItemId, { type: 'product', id: s.productId });
                            setPosMatchDecisions((prev) => ({
                              ...prev,
                              [m.id]: { ...(prev[m.id] ?? {}), [s.posItemId]: 'applied' },
                            }));
                            maybeReceipt({ ...decisions, [s.posItemId]: 'applied' });
                          };
                          const skip = (posItemId: string) => {
                            setPosMatchDecisions((prev) => ({
                              ...prev,
                              [m.id]: { ...(prev[m.id] ?? {}), [posItemId]: 'skipped' },
                            }));
                            maybeReceipt({ ...decisions, [posItemId]: 'skipped' });
                          };
                          const undo = (posItemId: string) => {
                            setPosMatchDecisions((prev) => {
                              const cur = { ...(prev[m.id] ?? {}) };
                              delete cur[posItemId];
                              return { ...prev, [m.id]: cur };
                            });
                          };
                          // Bulk-link the confident rows the card hands over
                          // (dropdown corrections folded in; not-sure rows
                          // excluded per rule #5).
                          const applyAll = (rows: POSMatchSuggestion[]) => {
                            const next = { ...decisions };
                            for (const s of rows) {
                              if (!next[s.posItemId]) {
                                setMatchTarget(s.posItemId, { type: 'product', id: s.productId });
                                next[s.posItemId] = 'applied';
                              }
                            }
                            setPosMatchDecisions((prev) => ({ ...prev, [m.id]: next }));
                            maybeReceipt(next);
                          };

                          return (
                            <POSMatchSuggestionsCard
                              suggestions={parsed.suggestions}
                              decisions={decisions}
                              catalogue={posCatalogue}
                              onApply={apply}
                              onSkip={skip}
                              onUndo={undo}
                              onApplyAll={applyAll}
                            />
                          );
                        })()}
                        {m.msgType === 'recipe-card' && (
                          <RecipeCardEditor
                            recipeName={recipeName}
                            onNameChange={setRecipeName}
                            settings={recipeSettings}
                            onSettingsChange={(patch) => setRecipeSettings(prev => ({ ...prev, ...patch }))}
                            servesQty={recipeYieldQty}
                            onServesChange={setRecipeYieldQty}
                            servesUom={activeTemplate.yieldUom}
                            ingredients={recipeIngredients}
                            onChange={(idx, qty) => {
                              setRecipeIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, qty } : ing));
                            }}
                            onUomChange={(idx, uom) => {
                              setRecipeIngredients(prev => prev.map((ing, i) => i === idx ? convertRowUom(ing, uom) : ing));
                            }}
                            onAdd={(row) => {
                              setRecipeIngredients(prev => [...prev, row]);
                              // Clear any selected swap on a row id that
                              // happens to collide — defensive: shouldn't
                              // happen given the `user-` prefix, but keeps
                              // the explorer consistent if a template
                              // ingredient is re-added under its old id.
                              setSelectedSwaps(prev => {
                                if (!(row.id in prev)) return prev;
                                const next = { ...prev };
                                delete next[row.id];
                                return next;
                              });
                            }}
                            onRemove={(id) => {
                              setRecipeIngredients(prev => prev.filter(r => r.id !== id));
                              setSelectedSwaps(prev => {
                                if (!(id in prev)) return prev;
                                const next = { ...prev };
                                delete next[id];
                                return next;
                              });
                            }}
                            onStartNewProduct={(query) => {
                              // Route through the existing product-swap
                              // wizard in `add` mode. Seeding the name
                              // skips the purpose card and lands the
                              // user straight on the Add-new-product
                              // info step with the typed query
                              // pre-filled.
                              commandRunner.runCommand({
                                commandId: 'product-swap',
                                args: { mode: 'add', newProductName: query },
                                confidence: 1,
                              });
                            }}
                          />
                        )}
                        {m.msgType === 'yield-loss' && recipeFlow >= 4 && (
                          <YieldLossCard
                            ingredients={recipeIngredients}
                            values={yieldLossDraft}
                            onChange={(id, v) => setYieldLossDraft(prev => ({ ...prev, [id]: v }))}
                            state={recipeFlow > 4 ? (yieldLossSkipped ? 'cancelled' : 'confirmed') : 'pending'}
                            onConfirm={confirmYieldLoss}
                            onSkip={skipYieldLoss}
                          />
                        )}
                        {m.msgType === 'variable-ingredients' && recipeFlow >= 6 && (
                          <VariableIngredientsCard
                            baseIngredients={recipeIngredients}
                            rows={variableIngredients}
                            onAdd={(row) => setVariableIngredients(prev => [...prev, row])}
                            onRemove={(id) => setVariableIngredients(prev => prev.filter(r => r.id !== id))}
                            state={recipeFlow > 6 ? (variableSkipped ? 'cancelled' : 'confirmed') : 'pending'}
                            onConfirm={confirmVariableIngredients}
                            onSkip={skipVariableIngredients}
                          />
                        )}
                        {m.msgType === 'cogs-target' && (
                          <CogsTargetPicker
                            value={targetCogsPct}
                            onChange={setTargetCogsPct}
                            onConfirm={confirmCogsTarget}
                            disabled={recipeFlow !== 10}
                          />
                        )}
                        {m.msgType === 'margin-explorer' && (
                          <MarginExplorerCard
                            recipeName={recipeName}
                            serves={Number(recipeYieldQty) || activeTemplate.yieldQty}
                            vatHot={activeTemplate.vatHot}
                            targetCogsPct={targetCogsPct}
                            foodCostP={totalFoodCostP(recipeIngredientsToTemplateRows(recipeIngredients))}
                            packagingCostGBP={{
                              dineIn: packagingCostForChannel('dineIn'),
                              takeaway: packagingCostForChannel('takeaway'),
                              delivery: packagingCostForChannel('delivery'),
                            }}
                            locked={recipeFlow !== 12}
                            onTargetChange={setTargetCogsPct}
                            onConfirm={confirmMarginExplorer}
                          />
                        )}
                        {m.msgType === 'integrity-check' && (
                          <DataIntegrityCard
                            state={integrityFixStarted[`${m.id}:all`] ? 'confirmed' : 'pending'}
                            isFindingStarted={(fid) =>
                              !!integrityFixStarted[`${m.id}:${fid}`] || !!integrityFixStarted[`${m.id}:all`]
                            }
                            onFixFinding={(fid) => startIntegrityFix(m.id, fid)}
                            onFixAll={() => startIntegrityFix(m.id)}
                          />
                        )}
                        {m.msgType === 'integrity-batch-review' && (() => {
                          const findingId: string = JSON.parse(m.cmdArgsJson ?? '{}').findingId ?? 'all';
                          const meta = INTEGRITY_BATCH_META[findingId] ?? INTEGRITY_BATCH_META.all;
                          const rows = findingId === 'all'
                            ? INTEGRITY_FIX_ROWS
                            : INTEGRITY_FIX_GROUPS[findingId] ?? INTEGRITY_FIX_ROWS;
                          return (
                            <BatchReviewCard
                              icon={ShieldCheck}
                              title={meta.title}
                              subtitle={meta.subtitle}
                              rows={rows}
                              impactSummary={meta.impact}
                              state={batchReviewStates[m.id]?.state ?? 'pending'}
                              results={batchReviewStates[m.id]?.results}
                              onConfirm={(submitted) => confirmIntegrityBatch(m.id, submitted)}
                              onCancel={() => setBatchReviewStates((prev) => ({ ...prev, [m.id]: { state: 'cancelled' } }))}
                            />
                          );
                        })()}
                        {m.msgType === 'packaging-picker' && recipeFlow >= 8 && (
                          <PackagingPicker
                            rows={packagingRows}
                            catalogue={packagingCatalogue}
                            selected={selectedPackaging}
                            channels={packagingChannels}
                            state={recipeFlow > 8 ? (packagingSkipped ? 'cancelled' : 'confirmed') : 'pending'}
                            onToggle={(id) => setSelectedPackaging(prev => {
                              const next = new Set(prev);
                              if (next.has(id)) next.delete(id); else next.add(id);
                              return next;
                            })}
                            onToggleChannel={(id, channel) => setPackagingChannels(prev => {
                              const current = prev[id] ?? DEFAULT_PACKAGING_CHANNELS;
                              return { ...prev, [id]: { ...current, [channel]: !current[channel] } };
                            })}
                            onQtyChange={(id, qty) => setPackagingRows(prev => prev.map(r => r.id === id ? { ...r, qty } : r))}
                            onUomChange={(id, uom) => setPackagingRows(prev => prev.map(r => r.id === id ? { ...r, unit: uom } : r))}
                            onAddRow={(row) => {
                              setPackagingRows(prev => [...prev, row]);
                              setSelectedPackaging(prev => new Set(prev).add(row.id));
                              setPackagingChannels(prev => ({ ...prev, [row.id]: { ...DEFAULT_PACKAGING_CHANNELS } }));
                            }}
                            onConfirm={confirmPackaging}
                            onSkip={skipPackaging}
                          />
                        )}
                        {m.msgType === 'allergen-check' && recipeFlow >= 14 && (
                          <AllergenCard
                            confirmed={selectedAllergens}
                            detected={new Set(activeTemplate.autoDetectedAllergens)}
                            state={recipeFlow > 14 ? 'confirmed' : 'pending'}
                            onToggle={(a) => setSelectedAllergens(prev => {
                              const next = new Set(prev);
                              if (next.has(a)) next.delete(a); else next.add(a);
                              return next;
                            })}
                            onConfirm={confirmAllergens}
                          />
                        )}
                        {m.msgType === 'site-selection' && recipeFlow >= 16 && (
                          <SiteSelectionCard
                            selected={selectedSites}
                            state={recipeFlow > 16 ? 'confirmed' : 'pending'}
                            onToggle={(id) => setSelectedSites(prev => {
                              const next = new Set(prev);
                              if (next.has(id)) next.delete(id); else next.add(id);
                              return next;
                            })}
                            onConfirm={confirmSites}
                          />
                        )}
                        {m.msgType === 'recipe-save-summary' && recipeFlow >= 18 && (
                          <RecipeSaveSummaryCard
                            recipeName={recipeName}
                            productClass={activeTemplate.productClass}
                            yieldQty={Number(recipeYieldQty) || activeTemplate.yieldQty}
                            yieldUom={activeTemplate.yieldUom}
                            siteNames={MOCK_SITES.filter(s => selectedSites.has(s.id)).map(s => s.name)}
                            allergens={Array.from(selectedAllergens)}
                            packaging={packagingRows.filter(p => selectedPackaging.has(p.id))}
                            variableIngredients={variableIngredients}
                            pricing={lockedPricingRef.current}
                            instructions={recipeInstructions}
                            onInstructionsChange={setRecipeInstructions}
                            state={recipeFlow > 18 ? 'confirmed' : 'pending'}
                            onConfirm={confirmRecipeSave}
                          />
                        )}
                        {m.msgType === 'prod-prep' && productionFlow >= 2 && (
                          <PillPicker
                            title="Prep time"
                            options={PREP_TIME_OPTIONS}
                            selected={prodSettings.prepTime}
                            state={productionFlow > 2 ? 'confirmed' : 'pending'}
                            onSelect={(v) => setProdSettings(s => ({ ...s, prepTime: v }))}
                            onConfirm={() => confirmPrepTime(prodSettings.prepTime)}
                          />
                        )}
                        {m.msgType === 'prod-shelf' && productionFlow >= 4 && (
                          <PillPicker
                            title="Shelf life"
                            options={SHELF_LIFE_OPTIONS}
                            selected={prodSettings.shelfLife}
                            state={productionFlow > 4 ? 'confirmed' : 'pending'}
                            onSelect={(v) => setProdSettings(s => ({ ...s, shelfLife: v }))}
                            onConfirm={() => confirmShelfLife(prodSettings.shelfLife)}
                          />
                        )}
                        {m.msgType === 'prod-batch' && productionFlow >= 6 && (
                          <BatchAndCarryCard
                            settings={prodSettings}
                            state={productionFlow > 6 ? 'confirmed' : 'pending'}
                            onUpdate={(u) => setProdSettings(s => ({ ...s, ...u }))}
                            onConfirm={confirmBatch}
                          />
                        )}
                        {m.msgType === 'prod-category' && productionFlow >= 8 && (
                          <CategoryClosingCard
                            settings={prodSettings}
                            state={productionFlow > 8 ? 'confirmed' : 'pending'}
                            onUpdate={(u) => setProdSettings(s => ({ ...s, ...u }))}
                            onConfirm={confirmCategoryAndClosing}
                          />
                        )}
                        {m.msgType === 'prod-summary' && productionFlow >= 10 && (
                          <ProductionSummaryCard settings={prodSettings} recipeName={recipeName} productClass={activeTemplate.productClass} />
                        )}
                        {m.msgType === 'analytics-chart' && m.chartId && (
                          <AnalyticsChartContent
                            chartId={m.chartId as AnalyticsChartId}
                            pinnedTargetIds={(() => {
                              const chartId = m.chartId as AnalyticsChartId;
                              const set = new Set<string>();
                              for (const k of pinnedChartTargets) {
                                if (k.startsWith(`${chartId}:`)) {
                                  set.add(k.slice(chartId.length + 1));
                                }
                              }
                              return set;
                            })()}
                            pinTargets={pinTargets}
                            defaultPinTargetId={defaultPinTargetId}
                            onAddToTarget={(targetId) =>
                              handleAddChart(m.chartId as AnalyticsChartId, targetId)
                            }
                            onAddToNewView={
                              onAddChartToNewView
                                ? () => handleAddChartToNewView(m.chartId as AnalyticsChartId)
                                : undefined
                            }
                            pinLabel={
                              pinTarget === 'view' ? 'Pin to view' : 'Add to dashboard'
                            }
                            pinnedLabel={
                              pinTarget === 'view' ? 'Pinned to view' : 'Added to dashboard'
                            }
                          />
                        )}
                        {m.msgType === 'table-result' && m.tableQuery && (
                          <TableResultBlock
                            title={m.tableTitle ?? m.text}
                            tableQuery={m.tableQuery}
                            prompt={
                              messages
                                .slice(0, messages.indexOf(m))
                                .reverse()
                                .find((p) => p.role === 'user')?.text ?? ''
                            }
                            onPinTable={onPinTable}
                            onOpenTableInNewView={onOpenTableInNewView}
                          />
                        )}
                        {/* ── Chat-command cards ───────────────────────── */}
                        {m.msgType === 'cmd-waste-card' && (
                          <WasteCommandCard
                            initialArgs={m.cmdArgsJson ? JSON.parse(m.cmdArgsJson) : {}}
                            state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                            onConfirm={(final) => commandRunner.confirmWaste(m.id, final)}
                            onCancel={() => commandRunner.cancelCard(m.id)}
                          />
                        )}
                        {m.msgType === 'cmd-stock-card' && (
                          <StockCountCommandCard
                            initialArgs={m.cmdArgsJson ? JSON.parse(m.cmdArgsJson) : {}}
                            state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                            onConfirm={(final) => commandRunner.confirmStock(m.id, final)}
                            onCancel={() => commandRunner.cancelCard(m.id)}
                          />
                        )}
                        {m.msgType === 'cmd-recipe-pick-recipe' && (
                          <RecipePickerCard
                            state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                            onPick={(recipeId, recipeName) =>
                              commandRunner.pickRecipeForEdit(m.id, recipeId, recipeName)
                            }
                            onCancel={() => commandRunner.cancelCard(m.id)}
                          />
                        )}
                        {m.msgType === 'cmd-recipe-pick-action' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            recipeId: string;
                            recipeName: string;
                          };
                          return (
                            <RecipeActionPickerCard
                              recipeName={args.recipeName}
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              onPick={(kind) => commandRunner.pickRecipeActionForEdit(m.id, args, kind)}
                              onCancel={() => commandRunner.cancelCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-recipe-pick-ingredient' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            recipeId: string;
                            recipeName: string;
                            kind: 'swap' | 'remove';
                          };
                          return (
                            <RecipeIngredientPickerCard
                              recipeId={args.recipeId}
                              recipeName={args.recipeName}
                              action={args.kind}
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              onPick={(name) => commandRunner.pickRecipeIngredientForEdit(m.id, args, name)}
                              onCancel={() => commandRunner.cancelCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-recipe-new-ingredient' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            recipeId: string;
                            recipeName: string;
                            kind: 'swap' | 'add';
                            fromName?: string;
                          };
                          return (
                            <RecipeNewIngredientCard
                              recipeName={args.recipeName}
                              swapFrom={args.kind === 'swap' ? args.fromName : undefined}
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              onSubmit={(input) => commandRunner.submitRecipeNewIngredient(m.id, args, input)}
                              onCancel={() => commandRunner.cancelCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-recipe-summary' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            recipeId: string;
                            recipeName: string;
                            kind: 'swap' | 'add' | 'remove';
                            fromName?: string;
                            toName?: string;
                            qty?: number;
                            uom?: string;
                          };
                          return (
                            <RecipeEditSummaryCard
                              recipeId={args.recipeId}
                              recipeName={args.recipeName}
                              kind={args.kind}
                              fromName={args.fromName}
                              toName={args.toName}
                              qty={args.qty}
                              uom={args.uom}
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              onConfirm={(final) => commandRunner.confirmRecipeEdit(m.id, final)}
                              onCancel={() => commandRunner.cancelCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-prod-card' && (
                          <ProductionFieldCard
                            initialArgs={m.cmdArgsJson ? JSON.parse(m.cmdArgsJson) : {}}
                            state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                            onConfirm={(final) => commandRunner.confirmProduction(m.id, final)}
                            onCancel={() => commandRunner.cancelCard(m.id)}
                          />
                        )}
                        {m.msgType === 'cmd-menu-card' && (
                          <MenuActionCard
                            initialArgs={m.cmdArgsJson ? JSON.parse(m.cmdArgsJson) : {}}
                            state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                            onConfirm={(final) => commandRunner.confirmMenu(m.id, final)}
                            onCancel={() => commandRunner.cancelCard(m.id)}
                          />
                        )}
                        {m.msgType === 'cmd-supplier-card' && (
                          <SupplierFieldCard
                            initialArgs={m.cmdArgsJson ? JSON.parse(m.cmdArgsJson) : {}}
                            state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                            onConfirm={(final) => commandRunner.confirmSupplier(m.id, final)}
                            onCancel={() => commandRunner.cancelCard(m.id)}
                          />
                        )}
                        {m.msgType === 'cmd-rota-rebalance' && (
                          <RotaRebalanceCard
                            initialArgs={m.cmdArgsJson ? JSON.parse(m.cmdArgsJson) : {}}
                            state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                            onConfirm={(final) => commandRunner.confirmRotaRebalance(m.id, final)}
                            onCancel={() => commandRunner.cancelCard(m.id)}
                            onSwitchSite={(siteId) => commandRunner.switchRotaSite(m.id, siteId)}
                          />
                        )}
                        {/* ── Product wizard (add or replace) ─────────── */}
                        {m.msgType === 'cmd-product-purpose' && (() => {
                          const args = m.cmdArgsJson ? (JSON.parse(m.cmdArgsJson) as {
                            mode?: 'add' | 'replace';
                          }) : {};
                          return (
                            <ProductPurposeCard
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              initialMode={args.mode}
                              onPick={(input) => commandRunner.submitProductPurpose(m.id, args, input)}
                              onCancel={() => commandRunner.cancelCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-product-new-info' && (() => {
                          const args = m.cmdArgsJson ? (JSON.parse(m.cmdArgsJson) as {
                            mode?: 'add' | 'replace';
                            newProductName?: string;
                            supplierId?: string;
                            supplierName?: string;
                          }) : {};
                          return (
                            <ProductNewInfoCard
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              initialName={args.newProductName}
                              initialSupplierId={args.supplierId}
                              initialSupplierName={args.supplierName}
                              onSubmit={(input) => commandRunner.submitProductNewInfo(m.id, args, input)}
                              onCancel={() => commandRunner.cancelCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-product-new-supplier' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            supplierName: string;
                            email?: string;
                          };
                          return (
                            <ProductNewSupplierCard
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              supplierName={args.supplierName}
                              initialEmail={args.email}
                              onSubmit={(input) => commandRunner.submitProductNewSupplier(m.id, args, input)}
                              onCancel={() => commandRunner.cancelCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-product-pick-replaced' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            newProductName: string;
                            oldProductHint?: string;
                          };
                          return (
                            <ProductPickReplacedCard
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              newProductName={args.newProductName}
                              initialQuery={args.oldProductHint}
                              onPick={(input) => commandRunner.pickProductReplaced(m.id, args, input)}
                              onCancel={() => commandRunner.cancelCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-product-pack-details' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            mode?: 'add' | 'replace';
                            newProductName: string;
                            supplierName: string;
                            defaultPackType?: 'Pack' | 'Single';
                            defaultPackQty?: number;
                            defaultPackCost?: number;
                            defaultUnitType?: 'Each' | 'kg' | 'L' | 'g' | 'ml';
                            defaultTaxRatePct?: number;
                            defaultSites?: string[];
                            defaultAllergensContains?: Allergen[];
                            defaultAllergensTraces?: Allergen[];
                            packType?: 'Pack' | 'Single';
                            packQty?: number;
                            packCost?: number;
                            unitType?: 'Each' | 'kg' | 'L' | 'g' | 'ml';
                            supplierCode?: string;
                            taxRatePct?: number;
                            photoDataUrl?: string;
                          };
                          return (
                            <ProductPackDetailsCard
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              mode={args.mode}
                              newProductName={args.newProductName}
                              supplierName={args.supplierName}
                              initialPackType={args.packType ?? args.defaultPackType}
                              initialPackQty={args.packQty ?? args.defaultPackQty}
                              initialPackCost={args.packCost ?? args.defaultPackCost}
                              initialUnitType={args.unitType ?? args.defaultUnitType}
                              initialSupplierCode={args.supplierCode}
                              initialTaxRatePct={args.taxRatePct ?? args.defaultTaxRatePct}
                              initialSites={args.defaultSites}
                              initialAllergensContains={args.defaultAllergensContains}
                              initialAllergensTraces={args.defaultAllergensTraces}
                              initialPhotoDataUrl={args.photoDataUrl}
                              onSubmit={(input) => commandRunner.submitProductPackDetails(m.id, args, input)}
                              onCancel={() => commandRunner.cancelCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-product-sheet-details' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            fileName: string;
                            newProductName: string;
                            supplierName: string;
                            category: string;
                            packType: 'Pack' | 'Single';
                            packQty: number;
                            packCost: number;
                            unitType: string;
                            singleUnitVolumeOrWeight?: number;
                            allergens?: string[];
                            oldProductName: string;
                            productClass?: string;
                            supplierCode?: string;
                            taxRatePct?: number;
                            altUoms?: { type: string; numberOfUnits: number }[];
                            allowSplitPack?: boolean;
                            forceMultiples?: boolean;
                            excludeFromCogs?: boolean;
                            useActualUseForTheoreticalCogs?: boolean;
                          };
                          return (
                            <ProductSheetDetailsCard
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              fileName={args.fileName}
                              newProductName={args.newProductName}
                              supplierName={args.supplierName}
                              productClass={args.productClass}
                              category={args.category}
                              packType={args.packType}
                              packQty={args.packQty}
                              packCost={args.packCost}
                              unitType={args.unitType}
                              singleUnitVolumeOrWeight={args.singleUnitVolumeOrWeight}
                              allergens={args.allergens ?? []}
                              oldProductName={args.oldProductName}
                              supplierCode={args.supplierCode}
                              taxRatePct={args.taxRatePct}
                              altUoms={args.altUoms}
                              allowSplitPack={args.allowSplitPack}
                              forceMultiples={args.forceMultiples}
                              excludeFromCogs={args.excludeFromCogs}
                              useActualUseForTheoreticalCogs={args.useActualUseForTheoreticalCogs}
                              onConfirm={(input) =>
                                // Merge the operator's corrections over the parsed
                                // values so the recipe sweep, product record and
                                // receipt all carry the fix.
                                commandRunner.confirmProductSheetDetails(m.id, { ...args, ...input })
                              }
                              onCancel={() => commandRunner.cancelCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-product-pick-recipes' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            mode?: 'add' | 'replace';
                            oldProductId?: string;
                            oldProductName?: string;
                            oldMasterId?: string;
                            newProductName: string;
                            unitType?: 'Each' | 'kg' | 'L' | 'g' | 'ml';
                            recipeIds?: string[];
                            addQty?: number;
                            addUom?: string;
                            fromSheet?: boolean;
                          };
                          return (
                            <ProductPickRecipesCard
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              mode={args.mode}
                              oldProductId={args.oldProductId}
                              oldProductName={args.oldProductName}
                              oldMasterId={args.oldMasterId}
                              newProductName={args.newProductName}
                              newProductUnitType={args.unitType}
                              initialSelectedIds={args.recipeIds}
                              initialAddQty={args.addQty}
                              initialAddUom={args.addUom}
                              confirmLabelOverride={args.fromSheet ? 'Swap them all' : undefined}
                              onConfirm={(input) =>
                                args.fromSheet
                                  ? commandRunner.confirmProductSwapFromSheetRecipes(m.id, args, input)
                                  : commandRunner.submitProductPickRecipes(m.id, args, input)
                              }
                              onCancel={() => commandRunner.cancelCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-product-swap-summary' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            mode?: 'add' | 'replace';
                            newProductName: string;
                            supplierMode: 'existing' | 'new';
                            supplierId?: string;
                            supplierName: string;
                            email?: string;
                            leadTimeDays?: number;
                            oldProductId?: string;
                            oldProductName?: string;
                            oldCategory?: string;
                            packType?: 'Pack' | 'Single';
                            packQty?: number;
                            packCost?: number;
                            unitType?: 'Each' | 'kg' | 'L' | 'g' | 'ml';
                            supplierCode?: string;
                            taxRatePct?: number;
                            sites?: string[];
                            allergensContains?: Allergen[];
                            allergensTraces?: Allergen[];
                            photoDataUrl?: string;
                            skipped?: boolean;
                            recipeIds: string[];
                            totalMatched?: number;
                            addQty?: number;
                            addUom?: string;
                            sampleRecipeNames?: string[];
                          };
                          return (
                            <ProductSwapSummaryCard
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              mode={args.mode}
                              newProductName={args.newProductName}
                              supplierMode={args.supplierMode}
                              supplierName={args.supplierName}
                              packType={args.packType}
                              packQty={args.packQty}
                              packCost={args.packCost}
                              unitType={args.unitType}
                              supplierCode={args.supplierCode}
                              taxRatePct={args.taxRatePct}
                              sites={args.sites}
                              allergensContains={args.allergensContains}
                              allergensTraces={args.allergensTraces}
                              photoAttached={!!args.photoDataUrl}
                              oldProductId={args.oldProductId}
                              oldProductName={args.oldProductName}
                              selectedRecipeIds={args.recipeIds}
                              totalMatched={args.totalMatched ?? 0}
                              addQty={args.addQty}
                              addUom={args.addUom}
                              sampleRecipeNames={args.sampleRecipeNames}
                              onConfirm={(final) =>
                                commandRunner.confirmProductSwap(m.id, {
                                  ...args,
                                  ...final,
                                  totalMatched: args.totalMatched ?? 0,
                                })
                              }
                              onCancel={() => commandRunner.cancelCard(m.id)}
                            />
                          );
                        })()}
                        {/* ── Site-setup wizard ────────────────────────── */}
                        {m.msgType === 'cmd-site-pick' && (() => {
                          const args = m.cmdArgsJson ? (JSON.parse(m.cmdArgsJson) as {
                            requestedCount?: number;
                            siteIds?: string[];
                          }) : {};
                          return (
                            <SiteSetupPickSitesCard
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              requestedCount={args.requestedCount}
                              initialSiteIds={args.siteIds}
                              onSubmit={(input) => commandRunner.submitSiteSetupPick(m.id, args, input)}
                              onCancel={() => commandRunner.cancelCard(m.id)}
                              onEdit={commandRunner.siteSetupDone ? undefined : () => commandRunner.reopenSiteSetupCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-site-copy' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            siteIds: string[];
                            templates?: Record<string, string>;
                            hubs?: Record<string, string>;
                          };
                          return (
                            <SiteSetupCopyCard
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              siteIds={args.siteIds}
                              initialTemplates={args.templates}
                              initialHubs={args.hubs}
                              onSubmit={(input) => commandRunner.submitSiteSetupCopy(m.id, args, input)}
                              onCancel={() => commandRunner.cancelCard(m.id)}
                              onEdit={commandRunner.siteSetupDone ? undefined : () => commandRunner.reopenSiteSetupCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-site-team' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            siteIds: string[];
                            roles?: Record<string, import('@/components/Feed/commands/siteSetupFixtures').EdifyRole>;
                          };
                          return (
                            <SiteSetupTeamCard
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              siteIds={args.siteIds}
                              initialRoles={args.roles}
                              onSubmit={(input) => commandRunner.submitSiteSetupTeam(m.id, args, input)}
                              onCancel={() => commandRunner.cancelCard(m.id)}
                              onEdit={commandRunner.siteSetupDone ? undefined : () => commandRunner.reopenSiteSetupCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-site-tiers' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            siteIds: string[];
                            rangeIds: Record<string, string>;
                            tiers: Record<string, Record<import('@/components/Feed/commands/siteSetupFixtures').DayKey, number>>;
                          };
                          return (
                            <SiteSetupRangeTiersCard
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              siteIds={args.siteIds}
                              initialRanges={args.rangeIds}
                              initialTiers={args.tiers}
                              onSubmit={(input) => commandRunner.submitSiteSetupTiers(m.id, args, input)}
                              onCancel={() => commandRunner.cancelCard(m.id)}
                              onEdit={commandRunner.siteSetupDone ? undefined : () => commandRunner.reopenSiteSetupCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-site-production' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            siteIds: string[];
                            templates: Record<string, string>;
                            hubs?: Record<string, string>;
                            production?: import('@/components/Feed/commands/siteSetupFixtures').SiteProductionSchedules;
                            benches?: Record<string, number>;
                          };
                          return (
                            <SiteSetupProductionCard
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              siteIds={args.siteIds}
                              templates={args.templates}
                              hubs={args.hubs}
                              initialProduction={args.production}
                              initialBenches={args.benches}
                              onSubmit={(input) => commandRunner.submitSiteSetupProduction(m.id, args, input)}
                              onCancel={() => commandRunner.cancelCard(m.id)}
                              onEdit={commandRunner.siteSetupDone ? undefined : () => commandRunner.reopenSiteSetupCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-site-benches-hot' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            siteIds: string[];
                            templates: Record<string, string>;
                            benchesHot?: import('@/components/Feed/commands/siteSetupFixtures').SiteBenchesHot;
                          };
                          return (
                            <SiteSetupBenchesHotCard
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              siteIds={args.siteIds}
                              templates={args.templates}
                              initialBenchesHot={args.benchesHot}
                              onSubmit={(input) => commandRunner.submitSiteSetupBenchesHot(m.id, args, input)}
                              onCancel={() => commandRunner.cancelCard(m.id)}
                              onEdit={commandRunner.siteSetupDone ? undefined : () => commandRunner.reopenSiteSetupCard(m.id)}
                            />
                          );
                        })()}
                        {m.msgType === 'cmd-site-golive' && m.cmdArgsJson && (() => {
                          const args = JSON.parse(m.cmdArgsJson) as {
                            siteIds: string[];
                            templates: Record<string, string>;
                            hubs: Record<string, string>;
                            roles: Record<string, import('@/components/Feed/commands/siteSetupFixtures').EdifyRole>;
                            rangeIds: Record<string, string>;
                            tiers: Record<string, Record<import('@/components/Feed/commands/siteSetupFixtures').DayKey, number>>;
                            production?: import('@/components/Feed/commands/siteSetupFixtures').SiteProductionSchedules;
                            benches?: Record<string, number>;
                            benchesHot?: import('@/components/Feed/commands/siteSetupFixtures').SiteBenchesHot;
                            goLiveDates?: Record<string, string>;
                          };
                          return (
                            <SiteSetupGoLiveCard
                              state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                              siteIds={args.siteIds}
                              templates={args.templates}
                              hubs={args.hubs}
                              roles={args.roles ?? {}}
                              rangeIds={args.rangeIds}
                              tiers={args.tiers}
                              production={args.production}
                              benches={args.benches}
                              benchesHot={args.benchesHot}
                              initialDates={args.goLiveDates}
                              onConfirm={(input) =>
                                commandRunner.confirmSiteSetup(m.id, {
                                  siteIds: args.siteIds,
                                  templates: args.templates,
                                  goLiveDates: input.goLiveDates,
                                })
                              }
                              onCancel={() => commandRunner.cancelCard(m.id)}
                            />
                          );
                        })()}
      </>
    );
  }

  const analyticsActive = analyticsStep > 0 && analyticsStep < 3;
  const composerDisabled = (recipeFlow > 0 && recipeFlow < 25) || (productionFlow > 0 && productionFlow < 10) || analyticsActive;
  const composerPlaceholder = composerDisabled
    ? (productionFlow > 0
        ? 'Edify is setting up your production plan\u2026'
        : analyticsActive
          ? 'Edify is analysing your data\u2026'
          : 'Edify is working on your recipe\u2026')
    : PLACEHOLDER;
  const composerMinH = chatStarted ? 40 : 72;

  const showHeader = !noHeader && (quinnExpanded || chatStarted) && !chatMinimized;

  return (
    <div ref={feedRootRef} style={{
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
              Ask Edify
            </div>
            {quinnExpanded && !chatStarted && (
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
                Full screen · chat
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setHistoryDrawerOpen(true)}
            title="Open history"
            aria-label="Open history"
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
            <Clock size={16} color="var(--color-text-secondary)" strokeWidth={2} />
          </button>
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
              title={quinnExpanded ? 'Exit full screen' : 'Expand Edify to full screen'}
              aria-label={quinnExpanded ? 'Exit full screen' : 'Expand Edify to full screen'}
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
            title="Expand Edify to full screen"
            aria-label="Expand Edify to full screen"
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
              boxShadow: '0 2px 6px rgba(0, 28, 53,0.08)',
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
            // Extra top padding so the logo sits clear of the
            // "On the floor" tasks strip above. The old 20/28px
            // values made the logo crowd the floor-action panel —
            // a comfortable 48px gives the brand mark room to
            // breathe on both the start screen and the minimised
            // command-centre view.
            padding: chatMinimized ? '48px 16px 0' : '48px 16px 24px',
            boxSizing: 'border-box',
            background: 'transparent',
          }}>
            <div style={{ width: '100%', maxWidth: '560px' }}>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <img
                  src="/edify-logo.png"
                  alt="Edify"
                  style={{
                    display: 'inline-block',
                    height: '72px',
                    width: 'auto',
                    verticalAlign: 'middle',
                  }}
                />
                <div style={{
                  marginTop: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  flexWrap: 'wrap',
                }}>
                  <EdifyMark size={22} color="var(--color-accent-quinn)" strokeWidth={2} style={{ flexShrink: 0 }} />
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

              <div ref={initialComposerWrapperRef} style={{ position: 'relative' }}>
                <SlashMenu
                  value={input}
                  visible={input.trimStart().startsWith('/')}
                  anchorEl={initialComposerWrapperRef.current}
                  onPick={(slash) => setInput(slash)}
                  onClose={() => setInput('')}
                />
                <ClaudeComposer
                  value={input}
                  onChange={setInput}
                  onSend={() => sendMessage()}
                  onAcceptSuggestion={(full) => sendMessage(full)}
                  disabled={false}
                  placeholder={PLACEHOLDER}
                  minHeight={72}
                  onQuickAction={handleQuickAction}
                  enableNote={enableNoteCapture}
                  attachedFileName={attachedFileName}
                  onAttachFile={setAttachedFileName}
                  onClearAttachment={() => setAttachedFileName(null)}
                />
              </div>

              {/* The "Current chat | Resume →" banner used to live
                  here. Removed: it duplicates the top entry in the
                  Recent chats column (since opening a chat now bumps
                  its timestamp), and the user didn't want a second
                  affordance pointing at the active conversation. */}

              {/* Command-centre two-column block — Notion-style.
                  Left column = what the operator did recently
                  (persisted across sessions); right column =
                  suggested next moves. Both columns share the same
                  bare-icon row treatment so the eye reads them as
                  one quiet surface instead of competing widgets.
                  The "View all" trigger on the left opens the side
                  drawer; clicking a left-side row replays the
                  saved conversation. */}
              <div style={{
                marginTop: '28px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '32px',
                alignItems: 'start',
              }}>
                {/* Wrap the left list so we can pin `min-width: 0`
                    on the grid item itself. Grid items default to
                    `min-width: auto`, which lets long titles push
                    the column past its `1fr` share — that's what
                    was making the two columns unequal. With both
                    cells at min-width 0, 1fr 1fr actually wins. */}
                <div style={{ minWidth: 0 }}>
                  {/* defaultExpanded stays false here regardless of
                      chatMinimized — the user wants the same calm
                      compact list in both states. The drawer is the
                      only place that opts into the expanded view
                      (filters + pinned section). */}
                  <TaskHistoryList
                    defaultExpanded={false}
                    onExpand={() => setHistoryDrawerOpen(true)}
                    onOpenTask={openTaskInChat}
                    sectionLabel="Recent chats"
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--color-text-secondary)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}>
                      Suggested
                    </span>
                  </div>
                  <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}>
                    {PROMPT_CHIPS.map((chip, i) => {
                      const Icon = chip.icon;
                      const hasCount = chip.count !== undefined && chip.count > 0;
                      return (
                        <button
                          key={i}
                          type="button"
                          aria-label={
                            hasCount
                              ? `${chip.label}: ${chip.count} waiting for you`
                              : chip.label
                          }
                          onClick={() => {
                            if (chip.action === 'recipe') {
                              startRecipeFlow(chip.text);
                            } else if (chip.action === 'recipe-ask') {
                              startRecipeAsk(chip.text);
                            } else if (chip.action === 'integrity') {
                              startIntegrityCheck();
                            } else if (chip.commandId) {
                              handleQuickAction(chip.commandId);
                            } else {
                              sendMessage(chip.text);
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'transparent',
                            width: '100%',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-primary)',
                            transition: 'background 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'rgba(0,28,53,0.04)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          <Icon
                            size={15}
                            strokeWidth={1.8}
                            color="var(--color-text-muted)"
                            style={{ flexShrink: 0 }}
                          />
                          <span style={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: '13px',
                            fontWeight: 500,
                            color: 'var(--color-text-primary)',
                          }}>
                            {chip.label}
                          </span>
                          {/* Notification count — pending items behind this
                              chip. Canonical outline pill per
                              .cursor/rules/status-pills.mdc: white background,
                              1.5px coloured border, warning tone (navy ink)
                              for work that's waiting. White bg keeps it crisp
                              over the row's hover wash. */}
                          {hasCount && (
                            <span
                              aria-hidden
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '22px',
                                padding: '2px 7px',
                                borderRadius: '999px',
                                background: '#ffffff',
                                color: 'var(--color-warning)',
                                border: '1.5px solid var(--color-warning)',
                                fontSize: '10px',
                                fontWeight: 700,
                                lineHeight: 1.4,
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              {chip.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row' }}>
            {/* Left column — the conversation stream + composer. In
                split view the interactive cards move to the workspace
                panel on the right, Claude-artifacts style. */}
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
                    {(() => {
                      // Index of the most recent Quinn response that isn't the
                      // thinking placeholder — only that bubble gets the
                      // signature footer.
                      let lastQuinnSignatureId: string | null = null;
                      for (let i = messages.length - 1; i >= 0; i--) {
                        const cand = messages[i];
                        if (
                          cand.role === 'quinn' &&
                          cand.msgType !== 'analytics-thinking' &&
                          cand.msgType !== 'cmd-thinking'
                        ) {
                          lastQuinnSignatureId = cand.id;
                          break;
                        }
                      }
                      return messages.map((m) => {
                      // In split view the interactive card lives in
                      // the workspace panel — a message that exists
                      // only to host a card would render as an empty
                      // bubble here — instead leave a small Workspace
                      // pointer in the stream ("opened on the right →")
                      // so the conversation stays coherent in history
                      // and narrow layouts. Messages that carry text
                      // (the question / intro line) still render as a
                      // normal bubble.
                      if (splitView && isWorkspaceMsg(m) && !m.text) {
                        return (
                          <motion.div
                            key={m.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.24, ease: [0.25, 0.1, 0.25, 1] }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 12px',
                              margin: '2px 0',
                              borderRadius: '999px',
                              border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.10))',
                              background: 'rgba(0,28,53,0.025)',
                              width: 'fit-content',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            {WORKSPACE_POINTER_LABELS[m.msgType ?? ''] ?? 'Working on this'} · in the workspace
                            <ChevronDown size={12} strokeWidth={2.4} style={{ transform: 'rotate(-90deg)' }} />
                          </motion.div>
                        );
                      }
                      return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                      >
                      <ChatBubble
                        key={m.id}
                        msg={m}
                        showSignature={m.id === lastQuinnSignatureId}
                        feedback={evalFeedback[m.id]}
                        commentOpen={evalCommentOpenFor === m.id}
                        onRate={(rating) => handleEvalRate(m.id, rating)}
                        onRetry={() => handleEvalRetry(m.id)}
                        onToggleComment={() => handleEvalToggleComment(m.id)}
                        onCommentChange={(text) => handleEvalCommentChange(m.id, text)}
                      >
                        {m.msgType === 'analytics-thinking' && (
                          <QuinnThinkingContent />
                        )}
                        {m.msgType === 'cmd-thinking' && (
                          <QuinnThinkingContent variant="step" />
                        )}
                        {!splitView && renderWorkspaceCard(m)}
                        {m.msgType === 'cmd-ambiguity' && m.cmdChoicesJson && m.cmdId && (
                          <AmbiguityPicker
                            prompt={m.text}
                            choices={JSON.parse(m.cmdChoicesJson) as AmbiguityChoice[]}
                            state={commandRunner.cmdStates[m.id] ?? m.cmdState ?? 'pending'}
                            onPick={(choice) => commandRunner.pickAmbiguity(m.id, m.cmdId!, choice)}
                            onCancel={() => commandRunner.cancelCard(m.id)}
                          />
                        )}
                        {m.msgType === 'cmd-receipt' && (() => {
                          // Prefer the live receipt (carries the undo
                          // closure); fall back to the baked-in copy
                          // for restored snapshots.
                          const live = commandRunner.getReceipt(m.id);
                          const receipt = live ?? m.cmdReceiptData;
                          if (!receipt) return null;
                          return (
                            <ReceiptCard
                              receipt={receipt}
                              undone={!!commandRunner.cmdUndone[m.id]}
                              // Restored receipts have no undo closure
                              // — hide the undo affordance rather than
                              // pretending it still works.
                              onUndo={live ? () => commandRunner.undoReceipt(m.id) : undefined}
                            />
                          );
                        })()}
                        {m.msgType === 'analytics-pinned' && pinTarget !== 'view' && (
                          <button
                            type="button"
                            onClick={() => onViewDashboard?.()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginTop: '10px',
                              padding: '8px 14px',
                              borderRadius: '10px',
                              border: 'none',
                              background: 'var(--color-accent-active)',
                              color: '#fff',
                              fontSize: '12px',
                              fontWeight: 600,
                              fontFamily: 'var(--font-primary)',
                              cursor: 'pointer',
                            }}
                          >
                            <LayoutDashboard size={13} strokeWidth={2} />
                            View dashboard
                          </button>
                        )}
                      </ChatBubble>
                      </motion.div>
                      );
                    });
                    })()}

                    {recipeFlow === 20 && (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', maxWidth: '88%' }}>
                        <button type="button" onClick={skipSupplierOffer} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--color-border)', background: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                          Not now, thanks
                        </button>
                        <button type="button" onClick={confirmSupplier} style={{ padding: '8px 14px', borderRadius: '10px', border: 'none', background: 'var(--color-accent-active)', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: '#fff', cursor: 'pointer' }}>
                          Yes, add them
                        </button>
                      </div>
                    )}

                    {recipeFlow === 22 && (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', maxWidth: '88%' }}>
                        <button type="button" onClick={skipProductionOffer} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--color-border)', background: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                          Not now — later
                        </button>
                        <button type="button" onClick={acceptProductionOffer} style={{ padding: '8px 14px', borderRadius: '10px', border: 'none', background: 'var(--color-accent-active)', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: '#fff', cursor: 'pointer' }}>
                          Yes, set them now
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
              <div
                ref={dockComposerWrapperRef}
                style={{
                  width: '100%',
                  maxWidth: '680px',
                  padding: '12px 24px 8px',
                  position: 'relative',
                }}
              >
                <SlashMenu
                  value={input}
                  visible={!composerDisabled && input.trimStart().startsWith('/')}
                  anchorEl={dockComposerWrapperRef.current}
                  onPick={(slash) => setInput(slash)}
                  onClose={() => setInput('')}
                />
                <ClaudeComposer
                  value={input}
                  onChange={setInput}
                  onSend={() => sendMessage()}
                  onAcceptSuggestion={(full) => sendMessage(full)}
                  disabled={composerDisabled}
                  placeholder={composerPlaceholder}
                  minHeight={composerMinH}
                  onQuickAction={handleQuickAction}
                  enableNote={enableNoteCapture}
                  attachedFileName={attachedFileName}
                  onAttachFile={setAttachedFileName}
                  onClearAttachment={() => setAttachedFileName(null)}
                />
              </div>
            </div>
            </div>

            {/* Workspace panel — the interactive cards from this chat
                (imports, wizard steps, charts, tables) stacked on the
                right so the conversation stays readable on the left. */}
            {splitView && (
              <div style={{
                width: wideWorkspace ? '64%' : '52%',
                minWidth: '420px',
                maxWidth: wideWorkspace ? '1040px' : '780px',
                minHeight: 0,
                borderLeft: '1px solid var(--color-border-subtle)',
                // Warm cream — the workspace canvas behind every card.
                background: '#FEFBEE',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <div style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '13px 24px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  background: '#fff',
                }}>
                  <EdifyMark size={16} color="var(--color-accent-quinn)" strokeWidth={2} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Workspace
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                    · what we&apos;re building in this chat
                  </span>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px 32px' }}>
                  <div style={{ maxWidth: wideWorkspace ? '960px' : '640px', margin: '0 auto' }}>
                    {workspaceMessages.map((wm) => (
                      <motion.div
                        key={wm.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                        style={{ marginBottom: '14px' }}
                      >
                        {renderWorkspaceCard(wm)}
                      </motion.div>
                    ))}
                    <div ref={workspaceEndRef} style={{ height: '8px' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task history drawer — portalled, always available. Triggered
          from the inline list "View all" pill, the chat-header clock
          icon, or the resume-chat banner. Slides over everything. */}
      <TaskHistoryDrawer
        open={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        onOpenTask={openTaskInChat}
      />

    </div>
  );
}

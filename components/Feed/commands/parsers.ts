/**
 * Natural-language parsers for the six chat commands.
 *
 * Each parser returns a `CommandIntent` when the text looks like an
 * invocation of its command, or `null` to let the framework fall
 * through to the next parser. Parsers are forgiving — they pull what
 * they can, mark the rest as missing, and let the runner ask follow-up
 * questions.
 *
 * Implementation notes:
 *   - Verbs / keywords drive the first-pass match.
 *   - Numeric extraction tolerates phrases like "log 3 blueberry
 *     muffins", "waste 2x croissants", "set batch min 8".
 *   - Product / recipe / supplier name matching is token-prefix +
 *     substring fuzzy. We deliberately keep it simple — the user
 *     confirms in the card, so a wrong match doesn't apply blindly.
 */

import { WASTE_PRODUCTS, WASTE_REASONS } from '@/components/Waste/wasteData';
import { snapshotRecipes } from '@/components/Recipe/recipeStore';
import { snapshot as snapshotSuppliers } from '@/components/Suppliers/store';
import type { Recipe } from '@/components/Recipe/libraryFixtures';
import type { CommandIntent, AmbiguityChoice } from './types';
import { parseRotaRebalance } from './rota/parseRota';
import { parseVarianceSweep } from './rota/parseSweep';

// ─── Shared helpers ─────────────────────────────────────────────────────────

/** Token-aware fuzzy match. Returns a score 0–1; 0 = no match. */
function matchScore(label: string, query: string): number {
  if (!query) return 0;
  const a = label.toLowerCase();
  const b = query.toLowerCase().trim();
  if (a === b) return 1;
  if (a.startsWith(b)) return 0.85;
  if (a.includes(b)) return 0.7;
  const aTokens = a.split(/[\s-]+/);
  const bTokens = b.split(/[\s-]+/);
  const matched = bTokens.filter((bt) => aTokens.some((at) => at.startsWith(bt) || at.includes(bt))).length;
  if (matched === 0) return 0;
  return 0.4 + 0.5 * (matched / bTokens.length);
}

/** Pull the first integer / decimal from a string. */
function extractQty(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/** Pull a unit-of-measure hint from a string. Returns the matched
 *  token verbatim ("g", "ml", "kg", "litre", …) or null. */
function extractUom(text: string): string | null {
  const m = text.match(/\b(g|kg|ml|l|litre|litres|unit|units|each|slice|slices|pc|pcs|oz)\b/i);
  if (!m) return null;
  const u = m[1].toLowerCase();
  if (u === 'l' || u === 'litres') return 'litre';
  if (u === 'units' || u === 'pcs' || u === 'pc' || u === 'each') return 'unit';
  if (u === 'slices') return 'slice';
  return u;
}

/** Pull a duration in minutes from common phrasings: "4h", "4 hours",
 *  "90 min", "2 days". */
function extractMinutes(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|d|day|days)/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith('h')) return n * 60;
  if (unit.startsWith('d')) return n * 60 * 24;
  return n;
}

/** Pull a £ price (or pence) from a string. Returns pounds as a
 *  number, or null. Handles "£4.50", "4.50", "20p". */
function extractPrice(text: string): number | null {
  const pence = text.match(/(\d+)\s*p\b/i);
  if (pence) return Number(pence[1]) / 100;
  const pound = text.match(/£\s*(\d+(?:\.\d+)?)/);
  if (pound) return Number(pound[1]);
  // Last resort — bare decimal that looks like money
  const bare = text.match(/\b(\d+\.\d{2})\b/);
  if (bare) return Number(bare[1]);
  return null;
}

function pickBest<T>(items: T[], scoreOf: (item: T) => number): { item: T; score: number; runners: T[] } | null {
  if (items.length === 0) return null;
  const scored = items
    .map((item) => ({ item, score: scoreOf(item) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  const best = scored[0];
  const runners = scored.slice(1, 4).filter((s) => s.score >= best.score - 0.15).map((s) => s.item);
  return { item: best.item, score: best.score, runners };
}

/**
 * Normalise progressive/gerund command verbs to their imperative base
 * so the verb regexes fire on natural phrasings like "swapping a
 * product" or "adding a new product". Operators describe what they're
 * doing ("I'm swapping…", "adding coffee beans…") at least as often
 * as they bark an imperative ("swap…", "add…"); without this the
 * parsers silently no-match the -ing forms and the chat shows nothing.
 *
 * Only known command verbs are mapped, so this can't accidentally
 * mangle a product name that happens to end in "ing".
 */
const GERUND_TO_BASE: Record<string, string> = {
  swapping: 'swap',
  adding: 'add',
  replacing: 'replace',
  changing: 'change',
  removing: 'remove',
  switching: 'switch',
  updating: 'update',
  importing: 'import',
};

function normalizeVerbs(text: string): string {
  return text.replace(
    /\b(swapping|adding|replacing|changing|removing|switching|updating|importing)\b/gi,
    (m) => GERUND_TO_BASE[m.toLowerCase()] ?? m,
  );
}

// ─── Waste ──────────────────────────────────────────────────────────────────

const WASTE_VERBS = /^\s*(\/waste\b|waste\b|bin\b|trash\b|toss\b|threw out\b|chuck\b)/i;
const WASTE_REASON_KEYWORDS: { id: typeof WASTE_REASONS[number]['id']; patterns: RegExp[] }[] = [
  { id: 'expired',         patterns: [/expired?/i, /past expir/i, /beyond expir/i, /out of date/i] },
  { id: 'damaged',         patterns: [/damaged?/i, /broken/i, /crushed/i, /dropped/i] },
  { id: 'not-fresh',       patterns: [/not fresh/i, /stale/i, /off\b/i, /going off/i] },
  { id: 'rd',              patterns: [/\br&d\b/i, /research/i, /trial/i, /testing/i] },
  { id: 'food-waste-app',  patterns: [/too good to go/i, /olio/i, /food waste app/i, /third[- ]party/i] },
  { id: 'staff-used',      patterns: [/staff/i, /team meal/i, /family meal/i, /staff used/i] },
];

function detectWasteReason(text: string): typeof WASTE_REASONS[number]['id'] | null {
  for (const r of WASTE_REASON_KEYWORDS) {
    if (r.patterns.some((p) => p.test(text))) return r.id;
  }
  return null;
}

export interface WasteArgs {
  productId?: string;
  productName?: string; // original phrasing, kept for fallback
  qty?: number;
  uom?: string;
  reasonId?: typeof WASTE_REASONS[number]['id'];
}

function parseSingleWasteItem(text: string): { args: WasteArgs; ambiguous?: AmbiguityChoice[]; confidence: number } {
  const qty = extractQty(text);
  const uom = extractUom(text);
  const reasonId = detectWasteReason(text) ?? undefined;

  // Strip the verb / leading slash and the number from the query so the
  // remainder is the product name candidate.
  const remainder = text
    .replace(WASTE_VERBS, '')
    .replace(/^\s*\/waste\s*/i, '')
    .replace(/\b\d+(?:\.\d+)?\s*(g|kg|ml|l|litres?|units?|each|slices?|pcs?|oz)?\b/i, ' ')
    .replace(/\b(of|for|by|by an|by the|as|because|reason)\b/gi, ' ')
    .replace(/expired|damaged|not fresh|stale|broken|crushed|staff|r&d/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let productId: string | undefined;
  let productName: string | undefined;
  let ambiguous: AmbiguityChoice[] | undefined;
  let confidence = 0.6; // base — verb matched, that alone is meaningful

  if (remainder) {
    const best = pickBest(WASTE_PRODUCTS, (p) => matchScore(p.name, remainder));
    if (best) {
      productId = best.item.id;
      productName = best.item.name;
      confidence = Math.min(1, confidence + best.score * 0.4);
      if (best.runners.length > 0 && best.score < 0.85) {
        ambiguous = [best.item, ...best.runners].map((p) => ({
          id: p.id,
          label: p.name,
          sublabel: p.category,
          args: { productId: p.id, productName: p.name, qty, uom: uom ?? p.uomOptions[0], reasonId },
        }));
      }
    } else {
      productName = remainder;
    }
  }

  return {
    args: {
      productId,
      productName,
      qty: qty ?? undefined,
      uom: uom ?? (productId ? WASTE_PRODUCTS.find((p) => p.id === productId)?.uomOptions[0] : undefined),
      reasonId,
    },
    ambiguous,
    confidence,
  };
}

export function parseWaste(text: string): CommandIntent | null {
  if (!WASTE_VERBS.test(text)) return null;

  // Multi-item: split on commas / "and" — but only when each segment
  // looks like its own product mention (contains a number or token).
  const cleaned = text.replace(WASTE_VERBS, '').trim();
  const segments = cleaned.split(/\s*(?:,|;|\sand\s)\s*/).filter((s) => s.length > 0);

  if (segments.length > 1) {
    const queue: WasteArgs[] = [];
    let acc = 0.6;
    for (const seg of segments) {
      const parsed = parseSingleWasteItem(`waste ${seg}`);
      queue.push(parsed.args);
      acc = Math.max(acc, parsed.confidence);
    }
    return {
      commandId: 'waste',
      args: queue[0] as Record<string, unknown>,
      queue: queue as Record<string, unknown>[],
      confidence: acc,
    };
  }

  const single = parseSingleWasteItem(text);
  return {
    commandId: 'waste',
    args: single.args as Record<string, unknown>,
    ambiguous: single.ambiguous,
    confidence: single.confidence,
  };
}

// ─── Stock count ────────────────────────────────────────────────────────────

const STOCK_VERBS = /^\s*(\/stock\b|\/count\b|count\b|stocktake\b|stock take\b|got\b|i (?:have|count)\b)/i;

export interface StockArgs {
  itemId?: string;
  itemName?: string;
  qty?: number;
  uom?: string;
  location?: string;
  expectedQty?: number | null;
}

// We use the WASTE_PRODUCTS catalogue as a stand-in for "things you
// might count" — it's the only fixture with friendly short names in
// the prototype. The card resolves to a proper expected-qty from the
// stock layer when it can.
function parseSingleStockItem(text: string): { args: StockArgs; ambiguous?: AmbiguityChoice[]; confidence: number } {
  const qty = extractQty(text);
  const uom = extractUom(text);
  const locMatch = text.match(/\b(?:in|on|at|from)\s+(?:the\s+)?([a-z][a-z\s-]+?)(?:$|\s+(?:and|,))/i);
  const location = locMatch ? locMatch[1].trim() : undefined;

  const remainder = text
    .replace(STOCK_VERBS, '')
    .replace(/^\s*\/(?:stock|count)\s*/i, '')
    .replace(/\b\d+(?:\.\d+)?\s*(g|kg|ml|l|litres?|units?|each|slices?|pcs?|oz)?\b/i, ' ')
    .replace(/\b(?:in|on|at|from)\s+(?:the\s+)?[a-z][a-z\s-]+/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let itemId: string | undefined;
  let itemName: string | undefined;
  let ambiguous: AmbiguityChoice[] | undefined;
  let confidence = 0.6;

  if (remainder) {
    const best = pickBest(WASTE_PRODUCTS, (p) => matchScore(p.name, remainder));
    if (best) {
      itemId = best.item.id;
      itemName = best.item.name;
      confidence = Math.min(1, confidence + best.score * 0.4);
      if (best.runners.length > 0 && best.score < 0.85) {
        ambiguous = [best.item, ...best.runners].map((p) => ({
          id: p.id,
          label: p.name,
          sublabel: p.category,
          args: { itemId: p.id, itemName: p.name, qty, uom: uom ?? p.uomOptions[0], location },
        }));
      }
    } else {
      itemName = remainder;
    }
  }

  return {
    args: {
      itemId,
      itemName,
      qty: qty ?? undefined,
      uom: uom ?? (itemId ? WASTE_PRODUCTS.find((p) => p.id === itemId)?.uomOptions[0] : undefined),
      location,
    },
    ambiguous,
    confidence,
  };
}

export function parseStock(text: string): CommandIntent | null {
  if (!STOCK_VERBS.test(text)) return null;
  const cleaned = text.replace(STOCK_VERBS, '').trim();
  const segments = cleaned.split(/\s*(?:,|;|\sand\s)\s*/).filter((s) => s.length > 0);
  if (segments.length > 1) {
    const queue: StockArgs[] = [];
    let acc = 0.6;
    for (const seg of segments) {
      const parsed = parseSingleStockItem(`count ${seg}`);
      queue.push(parsed.args);
      acc = Math.max(acc, parsed.confidence);
    }
    return {
      commandId: 'stock',
      args: queue[0] as Record<string, unknown>,
      queue: queue as Record<string, unknown>[],
      confidence: acc,
    };
  }
  const single = parseSingleStockItem(text);
  return {
    commandId: 'stock',
    args: single.args as Record<string, unknown>,
    ambiguous: single.ambiguous,
    confidence: single.confidence,
  };
}

// ─── Recipe edits ───────────────────────────────────────────────────────────

const RECIPE_VERBS = /^\s*(\/recipe\b|swap\b|replace\b|change\b|remove\b|add\b|update\b)/i;

export type RecipeEditKind = 'swap' | 'add' | 'remove';

export interface RecipeEditArgs {
  recipeId?: string;
  recipeName?: string;
  kind?: RecipeEditKind;
  /** The ingredient currently on the recipe we're acting against
   *  (for swap / remove). Free-form name. */
  fromName?: string;
  /** New ingredient name (for swap / add). */
  toName?: string;
  /** Quantity that comes with `toName` for add. */
  qty?: number;
  uom?: string;
}

export function parseRecipeEdit(text: string): CommandIntent | null {
  if (!RECIPE_VERBS.test(text)) return null;
  const lower = text.toLowerCase();

  // Identify the action verb
  let kind: RecipeEditKind | undefined;
  if (/\b(swap|replace|change)\b/.test(lower)) kind = 'swap';
  else if (/\bremove\b|\btake\s+off\b|\bdrop\b/.test(lower)) kind = 'remove';
  else if (/\badd\b/.test(lower)) kind = 'add';

  // "swap X for Y" / "replace X with Y" / "change X to Y"
  let fromName: string | undefined;
  let toName: string | undefined;
  const swapMatch = text.match(/(?:swap|replace|change)\s+(.+?)\s+(?:for|with|to)\s+([^,]+?)(?:\s+(?:in|on)\s+|$)/i);
  if (swapMatch) {
    fromName = swapMatch[1].trim();
    toName = swapMatch[2].trim();
  } else {
    // "remove X from <recipe>" / "remove X in <recipe>"
    const removeMatch = text.match(/(?:remove|take\s+off|drop)\s+(.+?)\s+(?:from|in|on)\s+/i);
    if (removeMatch) fromName = removeMatch[1].trim();
    // "add X to <recipe>"
    const addMatch = text.match(/add\s+(?:(\d+(?:\.\d+)?)\s*([a-z]+)?\s+(?:of\s+)?)?(.+?)\s+to\s+/i);
    if (addMatch) toName = addMatch[3].trim();
  }

  // Recipe name — everything after "in <recipe>" / "on <recipe>" / "to
  // <recipe>" / "from <recipe>".
  const recMatch = text.match(/\b(?:in|on|to|from)\s+(?:the\s+|our\s+)?(.+)$/i);
  let recipeName: string | undefined = recMatch ? recMatch[1].trim().replace(/[.!?]+$/, '') : undefined;

  // A generic placeholder ("a recipe", "the recipe", "my recipe") names
  // no real recipe — fuzzy-matching it would pin a random recipe and
  // wrongly outrank the product wizard for asks like "swap a product in
  // a recipe". Treat it as "no recipe yet" so the wizard asks instead.
  if (recipeName && /^(?:a|an|the|my|our|this|that)?\s*recipe$/i.test(recipeName)) {
    recipeName = undefined;
  }

  // Resolve recipe by fuzzy match.
  let recipeId: string | undefined;
  let ambiguous: AmbiguityChoice[] | undefined;
  if (recipeName) {
    const recipes = snapshotRecipes();
    const best = pickBest(recipes, (r) => matchScore(r.name, recipeName!));
    if (best) {
      recipeId = best.item.id;
      recipeName = best.item.name;
      if (best.runners.length > 0 && best.score < 0.85) {
        ambiguous = [best.item, ...best.runners].map((r: Recipe) => ({
          id: r.id,
          label: r.name,
          sublabel: r.category,
          args: { recipeId: r.id, recipeName: r.name, kind, fromName, toName },
        }));
      }
    }
  }

  const qty = toName ? extractQty(toName) ?? undefined : undefined;
  const uom = toName ? extractUom(toName) ?? undefined : undefined;

  // Confidence: low without recipe id, higher with everything resolved.
  let confidence = 0.5;
  if (kind) confidence += 0.15;
  if (recipeId) confidence += 0.2;
  if (fromName || toName) confidence += 0.15;

  return {
    commandId: 'recipe-edit',
    args: { recipeId, recipeName, kind, fromName, toName, qty, uom } as Record<string, unknown>,
    ambiguous,
    confidence,
  };
}

// ─── Production settings ────────────────────────────────────────────────────

const PRODUCTION_KEYWORDS = /\b(batch|shelf\s*life|prep|carry[- ]?over|cut[- ]?off|closing|production)\b/i;

export type ProductionField =
  | 'batchMin'
  | 'batchMax'
  | 'shelfLife'
  | 'prepTime'
  | 'carryOver'
  | 'closingCutoff';

export interface ProductionArgs {
  recipeId?: string;
  recipeName?: string;
  field?: ProductionField;
  /** Numeric value when applicable. Minutes for shelfLife/prepTime,
   *  count for batchMin/Max, minutes-before-close for closingCutoff. */
  value?: number;
  /** Boolean for `carryOver`. */
  boolValue?: boolean;
}

export function parseProduction(text: string): CommandIntent | null {
  if (!/^\s*(\/production\b|\/prod\b|set\b|change\b)/i.test(text) || !PRODUCTION_KEYWORDS.test(text)) {
    return null;
  }

  const lower = text.toLowerCase();
  let field: ProductionField | undefined;
  if (/batch\s*(min|minimum)/.test(lower))            field = 'batchMin';
  else if (/batch\s*(max|maximum|size)/.test(lower))  field = 'batchMax';
  else if (/shelf\s*life/.test(lower))                field = 'shelfLife';
  else if (/prep\s*time/.test(lower) || /^prep\b/.test(lower)) field = 'prepTime';
  else if (/carry[- ]?over/.test(lower))              field = 'carryOver';
  else if (/cut[- ]?off|closing/.test(lower))         field = 'closingCutoff';

  let value: number | undefined;
  let boolValue: boolean | undefined;
  if (field === 'shelfLife' || field === 'prepTime' || field === 'closingCutoff') {
    value = extractMinutes(text) ?? undefined;
  } else if (field === 'batchMin' || field === 'batchMax') {
    value = extractQty(text) ?? undefined;
  } else if (field === 'carryOver') {
    if (/\bon\b|\benable\b|\ballow\b|\byes\b/.test(lower)) boolValue = true;
    else if (/\boff\b|\bdisable\b|\bno\b/.test(lower)) boolValue = false;
  }

  // Recipe name — best effort. Try "for <recipe>" / "on <recipe>" /
  // a trailing recipe-name token.
  const forMatch = text.match(/\b(?:for|on)\s+(?:the\s+|our\s+)?(.+?)(?:\s+to\b|\s+at\b|$)/i);
  let recipeName: string | undefined = forMatch ? forMatch[1].trim().replace(/[.!?]+$/, '') : undefined;
  if (!recipeName) {
    // Fallback — strip the keyword + value and take the rest
    const stripped = text
      .replace(/^\s*(set|change|update)\s+/i, '')
      .replace(PRODUCTION_KEYWORDS, ' ')
      .replace(/\b(min|max|minimum|maximum|size|time)\b/gi, ' ')
      .replace(/\b(to|at)\b.*$/i, ' ')
      .replace(/\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours|m|min|mins|minute|minutes|d|day|days)?/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (stripped.length > 2) recipeName = stripped;
  }

  let recipeId: string | undefined;
  let ambiguous: AmbiguityChoice[] | undefined;
  if (recipeName) {
    const recipes = snapshotRecipes();
    const best = pickBest(recipes, (r) => matchScore(r.name, recipeName!));
    if (best) {
      recipeId = best.item.id;
      recipeName = best.item.name;
      if (best.runners.length > 0 && best.score < 0.85) {
        ambiguous = [best.item, ...best.runners].map((r: Recipe) => ({
          id: r.id,
          label: r.name,
          sublabel: r.category,
          args: { recipeId: r.id, recipeName: r.name, field, value, boolValue },
        }));
      }
    }
  }

  let confidence = 0.5;
  if (field) confidence += 0.2;
  if (recipeId) confidence += 0.2;
  if (value !== undefined || boolValue !== undefined) confidence += 0.1;

  return {
    commandId: 'production',
    args: { recipeId, recipeName, field, value, boolValue } as Record<string, unknown>,
    ambiguous,
    confidence,
  };
}

// ─── Menu ───────────────────────────────────────────────────────────────────

const MENU_VERBS = /^\s*(\/menu\b|84\b|eighty[- ]?four\b|raise\b|lower\b|reprice\b|price\b|make\b|set\b|put\b)/i;

export type MenuAction =
  | 'availability-off'  // 84
  | 'availability-on'
  | 'price-set'         // explicit new price
  | 'price-delta'       // up/down by amount
  | 'category-change';

export interface MenuArgs {
  recipeId?: string;
  recipeName?: string;
  action?: MenuAction;
  /** New absolute price (for price-set) — in pounds. */
  price?: number;
  /** Delta in pounds, positive or negative (for price-delta). */
  priceDelta?: number;
  /** Target category (for category-change). */
  category?: string;
}

export function parseMenu(text: string): CommandIntent | null {
  if (!MENU_VERBS.test(text) && !/\b(available|unavailable|on the menu|off the menu)\b/i.test(text)) {
    return null;
  }
  const lower = text.toLowerCase();

  let action: MenuAction | undefined;
  if (/\b84\b|eighty[- ]?four|off the menu|make.*unavailable|unavailable/.test(lower)) action = 'availability-off';
  else if (/back on|on the menu|make.*available|available/.test(lower)) action = 'availability-on';
  else if (/\braise\b|\bup\b\s+by|\bincrease\b/.test(lower)) action = 'price-delta';
  else if (/\blower\b|\bdrop\b|\bdown\b\s+by|\bdecrease\b/.test(lower)) action = 'price-delta';
  else if (/\bprice\b|\bset\b.*\bprice\b|\breprice\b/.test(lower)) action = 'price-set';

  let price: number | undefined;
  let priceDelta: number | undefined;
  if (action === 'price-set') {
    price = extractPrice(text) ?? undefined;
  } else if (action === 'price-delta') {
    const v = extractPrice(text);
    if (v !== null) {
      priceDelta = /lower|drop|down|decrease/i.test(lower) ? -v : v;
    }
  }

  // Recipe name parse — strip the action verbs, prices, and connectors.
  let recipeName = text
    .replace(MENU_VERBS, '')
    .replace(/\b84\b/i, ' ')
    .replace(/(?:by|to|for|of|the)\s+/gi, ' ')
    .replace(/\b(today|now|on the menu|off the menu|available|unavailable|price|raise|lower|drop)\b/gi, ' ')
    .replace(/£\s*\d+(?:\.\d+)?|\d+\s*p\b|\d+\.\d{2}/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (recipeName.length === 0) recipeName = undefined as unknown as string;

  let recipeId: string | undefined;
  let ambiguous: AmbiguityChoice[] | undefined;
  if (recipeName) {
    const recipes = snapshotRecipes();
    const best = pickBest(recipes, (r) => matchScore(r.name, recipeName));
    if (best) {
      recipeId = best.item.id;
      recipeName = best.item.name;
      if (best.runners.length > 0 && best.score < 0.85) {
        ambiguous = [best.item, ...best.runners].map((r: Recipe) => ({
          id: r.id,
          label: r.name,
          sublabel: r.category,
          args: { recipeId: r.id, recipeName: r.name, action, price, priceDelta },
        }));
      }
    }
  }

  let confidence = 0.5;
  if (action) confidence += 0.2;
  if (recipeId) confidence += 0.2;
  if (price !== undefined || priceDelta !== undefined) confidence += 0.1;

  return {
    commandId: 'menu',
    args: { recipeId, recipeName, action, price, priceDelta } as Record<string, unknown>,
    ambiguous,
    confidence,
  };
}

// ─── Supplier ───────────────────────────────────────────────────────────────

const SUPPLIER_KEYWORDS = /\b(cut[- ]?off|lead\s*time|mov|minimum\s*order|delivery\s*days?|email|phone|contact|account\s*number|notes?)\b/i;

export type SupplierField =
  | 'cutOffTime'
  | 'leadTimeDays'
  | 'minimumOrderValue'
  | 'deliveryDays'
  | 'email'
  | 'phone'
  | 'contactName'
  | 'accountsEmail'
  | 'companyAccountNumber'
  | 'notes';

export interface SupplierArgs {
  supplierId?: string;
  supplierName?: string;
  field?: SupplierField;
  /** New value as a string (the card normalises it to the right type). */
  value?: string;
  /** All fields mentioned in the sentence, when there's more than one
   *  ("update Agility lead time and MOV to 3 days and £350"). The
   *  card multi-selects these and pre-fills each value. `field`/
   *  `value` still carry the first hit for backwards compatibility. */
  fields?: { field: SupplierField; value?: string }[];
}

export function parseSupplier(text: string): CommandIntent | null {
  // A /supplier slash, or a supplier-set sentence. The verb can sit
  // behind conversational filler ("I want to update…", "can you
  // change…") — the supplier keyword gate keeps this from
  // over-triggering.
  if (!/^\s*\/supplier\b/i.test(text) && !/\b(set|change|update)\b/i.test(text)) {
    return null;
  }
  if (!SUPPLIER_KEYWORDS.test(text)) return null;

  const suppliers = snapshotSuppliers().suppliers;

  const lower = text.toLowerCase();

  // Detect every field mentioned, not just the first — operators
  // often batch edits ("lead time and minimum order value…").
  const detected: SupplierField[] = [];
  if (/cut[- ]?off/.test(lower))              detected.push('cutOffTime');
  if (/lead\s*time/.test(lower))              detected.push('leadTimeDays');
  if (/\bmov\b|minimum\s*order/.test(lower))  detected.push('minimumOrderValue');
  if (/delivery\s*days?/.test(lower))         detected.push('deliveryDays');
  // "accounts email" is its own field — strip those phrases before
  // the generic email test so one phrase doesn't fire both.
  if (/accounts?\s*email/.test(lower))        detected.push('accountsEmail');
  if (/\bemail\b/.test(lower.replace(/accounts?\s*email/g, ''))) detected.push('email');
  if (/phone/.test(lower))                    detected.push('phone');
  if (/contact\s*(?:name|person)/.test(lower)) detected.push('contactName');
  if (/account\s*number/.test(lower))         detected.push('companyAccountNumber');
  if (/\bnotes?\b/.test(lower))               detected.push('notes');

  // Per-field value extraction. Each field looks for its own
  // signature pattern so several values can coexist in one sentence
  // ("…to 3 days and £350").
  const valueOf = (f: SupplierField): string | undefined => {
    if (f === 'cutOffTime') {
      const m = text.match(/\b(\d{1,2})(?::(\d{2}))\s*(am|pm)?\b/i) ?? text.match(/\b(\d{1,2})()\s*(am|pm)\b/i);
      if (!m) return undefined;
      let hours = Number(m[1]);
      const mins = m[2] ? Number(m[2]) : 0;
      if (m[3]?.toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (m[3]?.toLowerCase() === 'am' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
    if (f === 'leadTimeDays') {
      // Prefer a "3 days"-style number; fall back to a bare number
      // that isn't a £ amount.
      const m = text.match(/(\d+)\s*(?:day|days|d)\b/i) ?? text.match(/(?<!£\s?)\b(\d+)\b/);
      return m?.[1];
    }
    if (f === 'minimumOrderValue') {
      const m = text.match(/£\s*(\d+(?:\.\d+)?)/);
      if (m) return m[1];
      const v = extractPrice(text);
      return v !== null ? String(v) : undefined;
    }
    if (f === 'deliveryDays') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const hit = days.filter((d) => new RegExp(`\\b${d}|${d.toLowerCase()}day`, 'i').test(text));
      return hit.length > 0 ? hit.join(',') : undefined;
    }
    if (f === 'email' || f === 'accountsEmail') {
      return text.match(/[\w._-]+@[\w.-]+/)?.[0];
    }
    if (f === 'contactName') {
      // "contact name to Jane Doe" — capture the trailing name.
      return text.match(/contact\s*(?:name|person)\s*(?:to|is|:)?\s+([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)?)/)?.[1];
    }
    if (f === 'companyAccountNumber') {
      return text.match(/account\s*number\s*(?:to|is|:)?\s*([A-Za-z0-9-]{3,})/i)?.[1];
    }
    if (f === 'notes') {
      // Notes are free text — the card collects them; don't guess.
      return undefined;
    }
    // phone
    return text.match(/[+\d][\d\s-]{6,}/)?.[0]?.trim();
  };

  const fields = detected.map((f) => ({ field: f, value: valueOf(f) }));
  const field = fields[0]?.field;
  const value = fields[0]?.value;

  // Supplier resolution. First try direct containment — the catalogue
  // names are distinctive enough ("agility", "borough") that a plain
  // substring hit beats fuzzy heuristics on conversational sentences.
  let supplierId: string | undefined;
  let supplierName: string | undefined;
  let ambiguous: AmbiguityChoice[] | undefined;

  const direct = suppliers.find(
    (s) =>
      (s.shortCode && lower.includes(s.shortCode.toLowerCase())) ||
      lower.includes(s.name.toLowerCase()),
  );
  if (direct) {
    supplierId = direct.id;
    supplierName = direct.shortCode ?? direct.name;
  } else {
    // Fuzzy fallback: "for <name>" / "on <name>", else strip the verbs
    // and keywords and try what's left.
    const forMatch = text.match(/\b(?:for|on|to)\s+(?:the\s+)?(.+?)(?:\s+to\b|\s+at\b|$)/i);
    if (forMatch) supplierName = forMatch[1].trim();
    if (!supplierName) {
      const stripped = text
        .replace(/^\s*(set|change|update|\/supplier)\s*/i, '')
        .replace(SUPPLIER_KEYWORDS, ' ')
        .replace(/\b(to|at|of|for|the|by)\b/gi, ' ')
        .replace(/\d+(?::\d+)?(?:\s*(?:am|pm|days?|d|min|mins))?/gi, ' ')
        .replace(/£\d+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (stripped.length > 1) supplierName = stripped;
    }
    if (supplierName) {
      const best = pickBest(suppliers, (s) => Math.max(matchScore(s.name, supplierName!), matchScore(s.shortCode ?? '', supplierName!)));
      if (best) {
        supplierId = best.item.id;
        supplierName = best.item.shortCode ?? best.item.name;
        if (best.runners.length > 0 && best.score < 0.85) {
          ambiguous = [best.item, ...best.runners].map((s) => ({
            id: s.id,
            label: s.shortCode ?? s.name,
            sublabel: s.categories.join(', '),
            args: { supplierId: s.id, supplierName: s.shortCode ?? s.name, field, value, fields },
          }));
        }
      }
    }
  }

  let confidence = 0.5;
  if (field) confidence += 0.2;
  if (supplierId) confidence += 0.2;
  if (value) confidence += 0.1;

  return {
    commandId: 'supplier',
    args: { supplierId, supplierName, field, value, fields } as Record<string, unknown>,
    ambiguous,
    confidence,
  };
}

// ─── product-swap ───────────────────────────────────────────────────────────

/**
 * Parser for the product wizard ("add a new product and optionally
 * replace another across many recipes"). The wizard walks the
 * operator through everything, so we don't need to extract a lot up
 * front — we just recognise the intent, infer the `mode` (add vs
 * replace) where the phrasing makes it clear, and capture an
 * `oldProductName` / `newProductName` when the operator named them.
 * The rest is collected card-by-card.
 *
 * Patterns we want to catch:
 *   • "replace X with Y across (all) recipes"       → mode=replace
 *   • "swap X for Y across (all) recipes"           → mode=replace
 *   • "switch coffee bean from X to Y"              → mode=replace
 *   • "add a new product"                           → mode=add (when "to X recipes")
 *   • "add oat milk to all coffees"                 → mode=add
 *   • "add a new product from a new supplier"       → mode=add
 *   • bare "swap product" / "/add-product"          → mode=unknown (show purpose card)
 */
const PRODUCT_SWAP_VERBS =
  /^\s*(\/swap-product\b|\/replace-product\b|\/add-product\b|replace\s+a?\s*product\b|swap\s+a?\s*product\b|add\s+a?\s*(?:new\s+)?product\b|switch\s+suppliers?\b|add\s+\S.*?\s+to\s+(?:all\s+|every\s+|my\s+|the\s+)?[a-z]+|(?:replace|swap|switch)\s+.+?\s+(?:with|for|to)\s+.+?\s+across\b)/i;

// Common conversational preambles the operator might prepend
// ("I want to add a new product..."). Stripped before matching.
const PRODUCT_SWAP_PREAMBLE =
  /^\s*(?:i\s+(?:want|need|would\s+like|'?d\s+like)\s+to\s+|can\s+you\s+|please\s+|let'?s\s+)/i;

export function parseProductSwap(text: string): CommandIntent | null {
  const stripped = text.replace(PRODUCT_SWAP_PREAMBLE, '');
  if (!PRODUCT_SWAP_VERBS.test(stripped)) return null;
  // Use the stripped text for further extraction so phrasings like
  // "I want to replace whole milk with oat milk across all drinks"
  // still surface the named products.
  text = stripped;
  const lower = text.toLowerCase();

  // Infer mode from the verb. We only set `mode` when the phrasing
  // is unambiguous; otherwise the wizard renders the purpose card
  // and asks the operator to choose.
  let mode: 'add' | 'replace' | undefined;
  if (/\b(?:replace|swap|switch)\b.*?\b(?:with|for|to|from)\b/i.test(text)) {
    mode = 'replace';
  } else if (/^\/replace-product\b|^\/swap-product\b|^replace\s+a\b|^swap\s+a\b/i.test(text)) {
    // Bare slash / "replace a product" → operator explicitly chose
    // replace even without a target. Honour it.
    mode = 'replace';
  } else if (
    /\badd\b.*?\bto\s+(?:all|every|my|the)?\s*\w+/i.test(text) ||
    /^\/add-product\b/i.test(text) ||
    /^add\s+a?\s*(?:new\s+)?product\b/i.test(text)
  ) {
    mode = 'add';
  }

  // Try to pull the old + new product names from common phrasings.
  // We don't need to fuzzy-resolve them here — the wizard's picker
  // will handle that. Passing the names as hints lets the wizard
  // pre-select / pre-fill where possible.
  let oldProductName: string | undefined;
  let newProductName: string | undefined;
  // "replace X with Y" or "swap X for Y" (must come before "across" if present)
  const acrossSplit = text.split(/\bacross\b/i)[0];
  const swap = acrossSplit.match(/\b(?:replace|swap|switch)\s+(.+?)\s+(?:with|for|to)\s+(.+?)\s*$/i);
  if (swap) {
    oldProductName = swap[1].trim().replace(/^the\s+/i, '').replace(/^our\s+/i, '');
    newProductName = swap[2].trim();
  } else {
    // "from X to Y" pattern ("switch coffee bean from house blend to fair-trade")
    const fromTo = acrossSplit.match(/\bfrom\s+(.+?)\s+to\s+(.+?)\s*$/i);
    if (fromTo) {
      oldProductName = fromTo[1].trim();
      newProductName = fromTo[2].trim();
    } else if (mode === 'add') {
      // "add oat milk to all coffees" — the noun between "add" and
      // "to" is the new product name; the rest names the target
      // recipe category (handled in the picker, not here).
      const addMatch = lower.match(/\badd\s+(?!a\b|an\b|the\b)(.+?)\s+to\b/);
      if (addMatch) {
        newProductName = addMatch[1].trim();
      }
    }
  }

  // Confidence: just enough to clear the 0.6 threshold when the verb
  // matches. Bump it up if we extracted named products / mode.
  let confidence = 0.6;
  if (mode) confidence += 0.1;
  if (oldProductName) confidence += 0.15;
  if (newProductName) confidence += 0.1;

  return {
    commandId: 'product-swap',
    args: {
      ...(mode ? { mode } : {}),
      ...(oldProductName ? { oldProductName } : {}),
      ...(newProductName ? { newProductName } : {}),
    },
    confidence,
  };
}

// ─── Site setup ─────────────────────────────────────────────────────────────

const COUNT_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/**
 * "I want to set up three new Pret sites", "open 2 new shops",
 * "add a new site", "setting up new sites". Extracts the count when
 * one is present (word or digit); the wizard defaults sensibly when
 * it isn't.
 */
export function parseSiteSetup(text: string): CommandIntent | null {
  const lower = text.toLowerCase();

  const noun = /\b(sites?|shops?|stores?|locations?)\b/.test(lower);
  if (!noun) return null;

  const verb = /\b(set(?:ting)?\s+up|setup|open(?:ing)?|add(?:ing)?|creat(?:e|ing)|launch(?:ing)?|onboard(?:ing)?)\b/.test(lower);
  if (!verb) return null;

  // Guard against production-settings phrasing ("change the site's
  // cutoff") — require "new" or an explicit count to be confident.
  const isNew = /\bnew\b/.test(lower);
  let count: number | undefined;
  const digit = lower.match(/\b(\d{1,2})\s+(?:new\s+)?(?:pret\s+)?(?:sites?|shops?|stores?|locations?)\b/);
  if (digit) count = Number(digit[1]);
  if (count === undefined) {
    const word = lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:new\s+)?(?:pret\s+)?(?:sites?|shops?|stores?|locations?)\b/);
    if (word) count = COUNT_WORDS[word[1]];
  }

  if (!isNew && count === undefined) return null;

  return {
    commandId: 'site-setup',
    args: { ...(count !== undefined ? { count } : {}) },
    confidence: 0.95,
  };
}

// ─── Top-level multiplexer ──────────────────────────────────────────────────

/** Run every parser, return the highest-confidence match. Returns null
 *  if no parser fired or the best confidence is below the threshold —
 *  in which case the caller falls through to the existing analytics
 *  detection or the text reply. */
export function parseCommand(text: string): CommandIntent | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Slash-prefix forces the matching parser (skip threshold) — if the
  // user typed `/waste` they want waste, even if the rest is missing.
  if (trimmed.startsWith('/')) {
    if (/^\/waste\b/i.test(trimmed))        return parseWaste(trimmed) ?? { commandId: 'waste', args: {}, confidence: 1 };
    if (/^\/(stock|count)\b/i.test(trimmed)) return parseStock(trimmed) ?? { commandId: 'stock', args: {}, confidence: 1 };
    if (/^\/recipe\b/i.test(trimmed))       return parseRecipeEdit(trimmed) ?? { commandId: 'recipe-edit', args: {}, confidence: 1 };
    if (/^\/(production|prod)\b/i.test(trimmed)) return parseProduction(trimmed) ?? { commandId: 'production', args: {}, confidence: 1 };
    if (/^\/menu\b/i.test(trimmed))         return parseMenu(trimmed) ?? { commandId: 'menu', args: {}, confidence: 1 };
    if (/^\/supplier\b/i.test(trimmed))     return parseSupplier(trimmed) ?? { commandId: 'supplier', args: {}, confidence: 1 };
    if (/^\/(swap|replace|add)-product\b/i.test(trimmed)) return parseProductSwap(trimmed) ?? { commandId: 'product-swap', args: {}, confidence: 1 };
    if (/^\/sites?\b/i.test(trimmed))       return parseSiteSetup(trimmed) ?? { commandId: 'site-setup', args: {}, confidence: 1 };
    if (/^\/(rota|roster|labour)\b/i.test(trimmed)) return parseRotaRebalance(trimmed) ?? { commandId: 'rota-rebalance', args: {}, confidence: 1 };
    if (/^\/sweep\b/i.test(trimmed))        return parseVarianceSweep(trimmed) ?? { commandId: 'variance-sweep', args: {}, confidence: 1 };
  }

  // Natural-language path: normalise gerund verbs ("swapping" →
  // "swap", "adding" → "add") so phrasings like "swapping a product in
  // a recipe" or "adding a new product" reach the right parser instead
  // of silently no-matching.
  const nl = normalizeVerbs(trimmed);
  const candidates: (CommandIntent | null)[] = [
    parseWaste(nl),
    parseStock(nl),
    parseRecipeEdit(nl),
    parseProduction(nl),
    parseMenu(nl),
    parseSupplier(nl),
    parseProductSwap(nl),
    parseSiteSetup(nl),
    // Sweep before rota: "labour against plan yesterday" is yesterday's
    // clock data, not next week's draft.
    parseVarianceSweep(nl),
    parseRotaRebalance(nl),
  ];
  const hits = candidates.filter((c): c is CommandIntent => c !== null);
  if (hits.length === 0) return null;
  hits.sort((a, b) => b.confidence - a.confidence);
  // Threshold — below 0.6, the verb might have matched but we're not
  // sure enough to take over. Let it fall through.
  if (hits[0].confidence < 0.6) return null;
  return hits[0];
}

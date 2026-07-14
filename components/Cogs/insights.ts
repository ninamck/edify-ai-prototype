/**
 * Scripted Edify/Quinn insights for the COGS demo. There is no live LLM
 * here — every narrative is hand-authored and matched deterministically so
 * the demo always tells the same story. Two surfaces consume this:
 *   • Per-row insight popovers on the variance table (getCogsRowInsight)
 *   • The COGS chat panel (getCogsChatAnswer)
 *
 * Narratives use the same lightweight `**bold**` markdown convention the
 * existing QuinnInsightButton renders, so they style consistently.
 */

import {
  COGS_SUMMARY,
  COGS_CLASS_TOTALS,
  COGS_VARIANCE_ROWS,
  COGS_SITE_NAME,
  type CogsVarianceRow,
} from './fixtures';
import { isMultiCurrencyDemo } from '@/lib/demoConfig';

/** Threshold (absolute variance %) above which a row gets the Edify chip. */
export const VARIANCE_INSIGHT_THRESHOLD = 10;

/** A row qualifies for an inline insight if it has an authored narrative or
 *  its variance is large enough to be worth flagging. */
export function rowHasInsight(varPct: number, insightId?: string): boolean {
  return Boolean(insightId) || Math.abs(varPct) >= VARIANCE_INSIGHT_THRESHOLD;
}

/** One-line "why we think this is happening" for the top-variances board.
 *  Keyed by the scripted insightId; rows without one fall back to a heuristic. */
const VARIANCE_REASONS: Record<string, string> = {
  avocado: 'New avocado recipe not yet costed, plus likely unlogged waste',
  'smoked-salmon': 'Short delivery — invoiced for more than was received',
  'house-red-wine': 'Bottle count down more than sales — over-measures or breakage',
  'sourdough-loaf': 'Staff sandwiches not rung into the till',
  'chicken-breast': 'Portions made heavier than the recipe',
  'basil-leaves': 'Fresh herb spoiling faster than the recipe allows',
  'oat-milk': 'Free-poured when frothing coffee',
  'whole-milk': 'Steamed-milk over-pour when frothing',
  'bagel-vegan': 'Baked to a tray count, not to forecast',
  'beans-red-kidney': 'Scoops not weighed to spec',
};

export function getVarianceReason(row: CogsVarianceRow): string {
  if (row.insightId && VARIANCE_REASONS[row.insightId]) {
    return VARIANCE_REASONS[row.insightId];
  }
  if (row.actualUsage < 0 || row.varPct === -100) {
    return 'Negative usage — likely an un-logged transfer or return';
  }
  if (Math.abs(row.varPct) < VARIANCE_INSIGHT_THRESHOLD) {
    return 'Within tolerance — normal week-to-week movement';
  }
  return row.varCost >= 0
    ? 'Used more than the recipe predicts'
    : 'Used less than the recipe predicts';
}

/** Top variance rows by absolute £ impact, for the variance-tab board. */
export function getTopVariances(limit = 10): CogsVarianceRow[] {
  return [...COGS_VARIANCE_ROWS]
    .sort((a, b) => Math.abs(b.varCost) - Math.abs(a.varCost))
    .slice(0, limit);
}

/** The suggested fix for a variance row: the action (and optional deep-link)
 *  from the insight card that points at this row, when one exists. */
export type CogsRowAction = {
  action: string;
  link?: { href: string; label: string };
};

export function getVarianceAction(rowId: string): CogsRowAction | undefined {
  const card = COGS_INSIGHT_CARDS.find((c) => c.rowIds?.includes(rowId));
  if (!card) return undefined;
  return { action: card.action, link: card.link };
}

/** Authored narratives keyed by `insightId` on the variance rows. Kept as
 *  short bullet lines (one point each) so the popover stays scannable. */
const ROW_INSIGHTS: Record<string, string> = {
  avocado:
    '- **Biggest variance** this period\n- Used 128 kg vs 52 kg recipe\n- New avocado dish not yet costed + unlogged waste\n- **Fix:** cost the new recipe, log waste, recount',
  'smoked-salmon':
    '- +25% over recipe (+£154)\n- Stock lower than the invoice says\n- Likely a short delivery\n- **Fix:** check delivery vs invoice, raise credit',
  'house-red-wine':
    '- +25% over recipe (+£78)\n- Bottles down more than sales\n- Over-measures or breakage\n- **Fix:** use measures, log breakages',
  'sourdough-loaf':
    '- +16% over recipe (+£40)\n- Used more than sales explain\n- Staff sandwiches not rung in\n- **Fix:** ring in staff food / comps',
  'bagel-vegan':
    '- +12.2% over recipe (50 units)\n- Baking to tray count, not forecast\n- **Fix:** trim standing par ~15%',
  'basil-leaves':
    '- +31.6% over recipe (£18.60)\n- Fresh herb spoiling before use\n- **Fix:** order smaller, more often',
  'beans-red-kidney':
    '- +18.8% over recipe (£7.20)\n- Scoops not weighed to spec\n- Spot-check portioning',
  'whole-milk':
    '- +9.6% over recipe\n- Steamed-milk waste on the bar (8 L)\n- Watch the espresso bar',
  'oat-milk':
    '- +18.8% over recipe\n- Free-pour on flat whites\n- **Fix:** marked pitcher line',
  'chicken-breast':
    '- +16% over recipe (+£117)\n- Made heavier than recipe + trim loss\n- **Fix:** weigh portions vs recipe card',
};

/** Returns the authored narrative for a variance row, or a generated
 *  fallback driven off the row's own numbers when none is authored. */
export function getCogsRowInsight(rowId: string): string {
  const row = COGS_VARIANCE_ROWS.find((r) => r.id === rowId);
  if (!row) return 'No insight available for this line.';
  if (row.insightId && ROW_INSIGHTS[row.insightId]) {
    return ROW_INSIGHTS[row.insightId];
  }
  const dir = row.varCost >= 0 ? 'over' : 'under';
  const mag = Math.abs(row.varPct).toFixed(1);
  const cost = Math.abs(row.varCost).toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (Math.abs(row.varPct) < VARIANCE_INSIGHT_THRESHOLD) {
    return `- ${mag}% ${dir} theoretical (£${cost})\n- Within tolerance — no action`;
  }
  return `- ${mag}% ${dir} theoretical (£${cost})\n- Check counts, portioning & transfers`;
}

/** Cross-cutting patterns Edify has noticed — shown in a summary card. */
export type CogsPattern = {
  id: string;
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
};

export const COGS_PATTERNS: CogsPattern[] = [
  {
    id: 'uncosted-recipe',
    title: 'A new recipe not yet costed is the #1 driver',
    detail:
      'Avocado alone accounts for ~£320 of the gap — a new avocado dish is selling but its recipe isn\u2019t costed yet, so theoretical under-counts it, and some avocado waste went unlogged. Cost the recipe and the variance largely closes.',
    severity: 'high',
  },
  {
    id: 'short-deliveries',
    title: 'Deliveries not matching invoices',
    detail:
      'Smoked Salmon is 25% over recipe because stock on hand is lower than the invoice claims — a classic short delivery. Checking goods-in against invoices and raising credits recovers spend that otherwise reads as kitchen variance.',
    severity: 'medium',
  },
  {
    id: 'free-pour',
    title: 'Plant milks consistently over-poured',
    detail:
      'Oat (+18.8%) and whole milk (+9.6%) over-run recipe three weeks running on the espresso bar — a free-pour habit, not a data issue.',
    severity: 'medium',
  },
  {
    id: 'protein-portioning',
    title: 'Protein portions creeping up',
    detail:
      'Chicken (+16%) is being made heavier than the recipe on hot sandwiches. Protein is the highest-value variance per gram, so a portioning spot-check pays back fastest.',
    severity: 'low',
  },
];

// ── Insight cards (proactive dashboard) ─────────────────────────────────
// Surfaced at the top of the COGS area so discrepancies and the action to
// fix/avoid them are front-and-centre, rather than hidden behind row chips.

export type CogsInsightCard = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  /** What Edify sees (the diagnosis). */
  diagnosis: string;
  /** The concrete thing the operator can do to fix / avoid it. */
  action: string;
  /** GBP cost impact of the discrepancy (null when not a clean number). */
  impactDh: number | null;
  /** Whether the impact is mostly a data fix vs a genuine operational loss. */
  kind: 'Data fix' | 'Operations' | 'Setup';
  /** Variance rows this card points at, for the "view lines" jump. */
  rowIds?: string[];
  /** Deep-link to where the fix actually happens (stocktake, item matching,
   *  products, …). When set, "Review" navigates here instead of just
   *  highlighting rows in the variance table. */
  link?: { href: string; label: string };
};

export const COGS_INSIGHT_CARDS: CogsInsightCard[] = [
  {
    id: 'avocado-recipe',
    severity: 'high',
    title: 'New avocado recipe not yet costed',
    diagnosis:
      'Actual usage (128 kg) is well above the 52 kg theoretical, because a new avocado dish is selling but its recipe isn\u2019t costed in the library yet \u2014 so theory under-counts it. Some avocado waste (browning) also went unlogged.',
    action: 'Cost the new avocado recipe in the library, log the waste, then recount the avocado bin before locking the stocktake.',
    impactDh: 319.2,
    kind: 'Setup',
    rowIds: ['avocado'],
    link: { href: '/stock?tab=stocktake', label: 'Open stocktake' },
  },
  {
    id: 'salmon-short-delivery',
    severity: 'high',
    title: 'Smoked salmon short delivery',
    diagnosis:
      'Salmon is 25% over recipe because the stock on hand is lower than the delivery note and invoice claim \u2014 the case looks like a short delivery, so the missing cost reads as kitchen usage.',
    action: 'Check goods-in against the invoice and raise a supplier credit for the shortfall.',
    impactDh: 154.0,
    kind: 'Data fix',
    rowIds: ['smoked-salmon'],
    link: { href: '/suppliers', label: 'Open suppliers' },
  },
  {
    id: 'milk-free-pour',
    severity: 'medium',
    title: 'Milk over-poured when frothing coffee',
    diagnosis:
      'Oat (+18.8%) and whole milk (+9.6%) run over recipe every week \u2014 too much milk poured when frothing/steaming for coffees, not a data error.',
    action: 'Add a marked pour line to the milk pitchers and brief baristas; typically recovers ~10% of the variance.',
    impactDh: 67.65,
    kind: 'Operations',
    rowIds: ['oat-milk', 'whole-milk'],
  },
  {
    id: 'protein-portioning',
    severity: 'medium',
    title: 'Protein portions creeping up',
    diagnosis:
      'Chicken is 16% over theoretical \u2014 the largest protein variance \u2014 from making hot sandwiches heavier than the recipe plus trim yield loss.',
    action: 'Weigh a sample of hot sandwiches against the recipe card and re-brief the line.',
    impactDh: 117.0,
    kind: 'Operations',
    rowIds: ['chicken-breast'],
  },
  {
    id: 'wine-shrinkage',
    severity: 'medium',
    title: 'House wine down more than sales',
    diagnosis:
      'House Red is 25% over recipe \u2014 bottle count dropped more than the till explains. That points to free-poured measures, comps, or unlogged breakage at the bar rather than a data error.',
    action: 'Pour to a measure, log breakages, and ring in any comps so usage and sales line up.',
    impactDh: 78.0,
    kind: 'Operations',
    rowIds: ['house-red-wine'],
  },
  {
    id: 'sourdough-staff',
    severity: 'low',
    title: 'Sourdough used beyond sales',
    diagnosis:
      'Sourdough runs 16% over recipe \u2014 more loaves are going out than menu sales explain, typically staff sandwiches and comps that never hit the till.',
    action: 'Ring staff food and comps through the till (at zero price) so they leave the variance.',
    impactDh: 40.0,
    kind: 'Operations',
    rowIds: ['sourdough-loaf'],
  },
  {
    id: 'basil-spoilage',
    severity: 'low',
    title: 'Basil spoiling faster than the recipe',
    diagnosis:
      'Basil Leaves runs 31.6% over recipe \u2014 a fast-perishing fresh herb being binned before it\u2019s used, so usage outruns what the menu mix predicts.',
    action: 'Order basil in smaller, more frequent drops and prep to order to cut spoilage.',
    impactDh: 18.6,
    kind: 'Operations',
    rowIds: ['basil-leaves'],
  },
  {
    id: 'unassigned-spend',
    severity: 'low',
    title: 'Unmatched POS items hiding costs',
    diagnosis:
      'Several POS sale items aren\u2019t matched to a recipe or product, so their cost lands in Unassigned (£140) instead of a menu category.',
    action: 'Match the POS items to their recipes/products so the cost is attributed correctly.',
    impactDh: 110.0,
    kind: 'Setup',
    link: { href: '/item-matching', label: 'Open item matching' },
  },
];

// ── Chat (scripted Q&A) ─────────────────────────────────────────────────

export type CogsChatAnswer = {
  text: string;
  /** Optional variance row ids the answer is pointing at, so the UI can
   *  offer to scroll/highlight them. */
  rowIds?: string[];
};

/** Suggested prompts seeded into the chat panel. */
export const COGS_SUGGESTED_QUESTIONS: string[] = [
  'Where did the biggest discrepancy come from?',
  'Why is our food cost above theoretical?',
  'Show me the over-portioned items',
  'What should I check first?',
  'Summarise this week\u2019s COGS story',
  // Multi-currency build only: the FX-vs-price attribution moment.
  ...(isMultiCurrencyDemo ? ['Is the beans cost rise real or just the exchange rate?'] : []),
];

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

/** Keyword-matched, deterministic answers. Mirrors the prototype's other
 *  scripted "AI" surfaces (e.g. insightForTableQuery in the Feed). */
export function getCogsChatAnswer(question: string): CogsChatAnswer {
  const q = question.toLowerCase();

  // Multi-currency build only: FX-vs-price attribution answer. Checked
  // first so currency wording doesn't fall through to the supplier branch.
  if (
    isMultiCurrencyDemo &&
    (q.includes('exchange') || q.includes(' fx') || q.startsWith('fx') || q.includes('currency') || q.includes('cad') || q.includes('rate'))
  ) {
    return {
      text: `Mostly the exchange rate. Coffee & beans is up **6.2% (£214)** vs last period, and Edify splits it three ways: **+4.1pp (£142) is FX** — the pound weakened against the Canadian dollar across this period's receipts — **+1.8pp (£62) is a genuine supplier increase** (Espresso Forte rose CA$1.20/case at source), and **+0.3pp is volume**. Purchases from Second Cup Central Supply are billed in CAD and booked at the rate locked at each goods receipt, which is what lets me separate the two. Only the 1.8pp is worth raising with the supplier; if the FX drag persists, consider a **contracted rate** on the supplier record.`,
    };
  }

  if (q.includes('biggest') || q.includes('largest') || q.includes('worst')) {
    return {
      text: `The biggest single discrepancy is **Avocado** — about **£320** of unfavourable variance. Actual usage (128 kg) far outruns the 52 kg theoretical because a **new avocado dish isn't costed in the recipe library yet**, so theory under-counts it, and some avocado waste went unlogged. Cost the recipe, log the waste and recount before locking. Next worst is **Smoked Salmon** (+£154) — stock is lower than the invoice, a likely short delivery.`,
      rowIds: ['avocado', 'smoked-salmon'],
    };
  }

  if (
    (q.includes('food cost') || q.includes('above') || q.includes('over theoretical') || q.includes('high')) &&
    !q.includes('item')
  ) {
    return {
      text: `Actual COGS is **${COGS_SUMMARY.actualPct.toFixed(1)}%** vs a theoretical **${COGS_SUMMARY.theoreticalPct.toFixed(1)}%** — that's **+${COGS_SUMMARY.variancePp.toFixed(1)}pp**, or about **£${fmt(COGS_SUMMARY.varianceCost)}** unfavourable. **Food** is the driver (31.5% vs 28% target). Roughly three causes, in order: a new uncosted recipe (Avocado), a supplier short delivery (Salmon), and over-portioning on milks and protein.`,
    };
  }

  if (q.includes('portion') || q.includes('over-pour') || q.includes('over pour') || q.includes('item')) {
    return {
      text: `The clearest over-portioning lines are **Oat Milk (+18.8%)**, **Chicken Breast (+16%)**, **Vegan bagels (+12.2%)** and **Whole Milk (+9.6%)**. Milks are free-pour on the bar; chicken is made heavier than the recipe on hot sandwiches; bagels look like baking to a tray count rather than forecast. A marked pitcher line and a portioning spot-check recover most of it.`,
      rowIds: ['oat-milk', 'chicken-breast', 'bagel-vegan-multigrain', 'whole-milk'],
    };
  }

  if (q.includes('check first') || q.includes('priorit') || q.includes('what should') || q.includes('action')) {
    return {
      text: `In priority order: **1)** Cost the new **Avocado** recipe in the library and recount it — that's the single biggest number. **2)** Check the **Smoked Salmon** delivery against the invoice and raise a credit. **3)** Pour **House Red** to a measure and ring in staff sandwiches. The first two are data/setup fixes, not kitchen problems, and clear most of the gap.`,
      rowIds: ['avocado', 'smoked-salmon', 'house-red-wine'],
    };
  }

  if (q.includes('transfer')) {
    return {
      text: `Transfers are clean this period — no one-sided movements driving the gap. The biggest items are a **new Avocado recipe that isn't costed yet** and a **Smoked Salmon short delivery**. Both are data/setup fixes rather than kitchen or transfer problems.`,
      rowIds: ['avocado', 'smoked-salmon'],
    };
  }

  if (q.includes('deliver') || q.includes('invoice') || q.includes('supplier') || q.includes('match') || q.includes('salmon')) {
    return {
      text: `Two supply-side issues stand out. **Smoked Salmon** is +£154 over recipe because stock on hand is below the invoice — a likely **short delivery** to check against goods-in and credit. Separately, several **POS sale items aren't matched to a recipe**, so ~£140 of cost lands in Unassigned. Both are data fixes, not kitchen problems.`,
      rowIds: ['smoked-salmon'],
    };
  }

  if (q.includes('waste')) {
    return {
      text: `Logged waste is modest this period (**£${fmt(COGS_CLASS_TOTALS.waste)}** total, mostly steamed milk on the bar and a little produce). The one watch-out is **avocado and basil**, where some spoilage looks unlogged — but the variance is dominated by a new uncosted recipe and portioning, not bin loss.`,
    };
  }

  if (q.includes('beverage') || q.includes('milk') || q.includes('coffee') || q.includes('drink')) {
    return {
      text: `Beverage actual is **25%** vs **21.5%** theoretical. It's all free-pour: **Oat Milk +18.8%** and **Whole Milk +9.6%**. Coffee beans are basically on spec (+2.8%). A marked pitcher line on the bar is the single highest-ROI fix here.`,
      rowIds: ['oat-milk', 'whole-milk'],
    };
  }

  if (q.includes('summar') || q.includes('story') || q.includes('overview') || q.includes('explain')) {
    return {
      text: `This period actual COGS landed at **${COGS_SUMMARY.actualPct.toFixed(1)}%** against a **${COGS_SUMMARY.theoreticalPct.toFixed(1)}%** theoretical — **£${fmt(COGS_SUMMARY.varianceCost)}** unfavourable. The headline isn't the kitchen: **roughly two-thirds of the gap is data/setup** (a new Avocado recipe not yet costed and a Smoked Salmon short delivery). The genuine operational slice is **milk over-pour, wine measures and protein portions**. Fix the data issues first, then run a portioning spot-check.`,
    };
  }

  return {
    text: `I can break down the COGS variance for you. Try asking about the **biggest discrepancy**, **why food cost is above theoretical**, **over-portioned items**, or **what to check first**. I'm reading from this period's stocktake for ${COGS_SITE_NAME}.`,
  };
}

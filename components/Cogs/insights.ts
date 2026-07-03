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
  avocado: 'New pearl drink not yet costed, plus likely unlogged cooked-pearl waste',
  'smoked-salmon': 'Short delivery — invoiced for more leaf than was received',
  'house-red-wine': 'Syrup down more than sales — free-poured pumps or spillage',
  'sourdough-loaf': 'Staff milk teas not rung into the till',
  'chicken-breast': 'Leaf ladled heavier than the recipe',
  'basil-leaves': 'Fresh purée spoiling faster than the recipe allows',
  'oat-milk': 'Free-poured when building milk teas',
  'whole-milk': 'Milk over-pour when building milk teas',
  'bagel-vegan': 'Batch-prepped to a standing par, not to forecast',
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
    '- **Biggest variance** this period\n- Used 128 kg vs 52 kg recipe\n- New pearl drink not yet costed + unlogged waste\n- **Fix:** cost the new recipe, log cooked-pearl waste, recount',
  'smoked-salmon':
    '- +25% over recipe (+£154)\n- Leaf stock lower than the invoice says\n- Likely a short delivery\n- **Fix:** check delivery vs invoice, raise credit',
  'house-red-wine':
    '- +25% over recipe (+£78)\n- Syrup down more than sales\n- Free-poured pumps or spillage\n- **Fix:** use a dosing pump, log spillage',
  'sourdough-loaf':
    '- +16% over recipe (+£40)\n- Used more than sales explain\n- Staff milk teas not rung in\n- **Fix:** ring in staff drinks / comps',
  'bagel-vegan':
    '- +12.2% over recipe (50 portions)\n- Batch-prepping to a par, not forecast\n- **Fix:** trim standing par ~15%',
  'basil-leaves':
    '- +31.6% over recipe (£18.60)\n- Fresh purée spoiling before use\n- **Fix:** order smaller, more often',
  'beans-red-kidney':
    '- +18.8% over recipe (£7.20)\n- Scoops not weighed to spec\n- Spot-check portioning',
  'whole-milk':
    '- +9.6% over recipe\n- Milk over-pour on the bar (8 L)\n- Watch the milk-tea station',
  'oat-milk':
    '- +18.8% over recipe\n- Free-pour on milk teas\n- **Fix:** marked pitcher line',
  'chicken-breast':
    '- +16% over recipe (+£117)\n- Ladled heavier than recipe + brew loss\n- **Fix:** weigh leaf doses vs recipe card',
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
      'Tapioca pearls alone account for ~£320 of the gap — a new pearl drink is selling but its recipe isn\u2019t costed yet, so theoretical under-counts it, and some cooked-pearl waste went unlogged. Cost the recipe and the variance largely closes.',
    severity: 'high',
  },
  {
    id: 'short-deliveries',
    title: 'Deliveries not matching invoices',
    detail:
      'Orchid oolong leaf is 25% over recipe because stock on hand is lower than the invoice claims — a classic short delivery. Checking goods-in against invoices and raising credits recovers spend that otherwise reads as bar variance.',
    severity: 'medium',
  },
  {
    id: 'free-pour',
    title: 'Milks consistently over-poured',
    detail:
      'Oat (+18.8%) and whole milk (+9.6%) over-run recipe three weeks running on the milk-tea station — a free-pour habit, not a data issue.',
    severity: 'medium',
  },
  {
    id: 'protein-portioning',
    title: 'Premium leaf doses creeping up',
    detail:
      'Aged pu\u2019er (+16%) is being ladled heavier than the recipe on milk teas. Premium leaf is the highest-value variance per gram, so a dosing spot-check pays back fastest.',
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
    title: 'New pearl drink recipe not yet costed',
    diagnosis:
      'Actual usage (128 kg) is well above the 52 kg theoretical, because a new pearl-topped drink is selling but its recipe isn\u2019t costed in the library yet \u2014 so theory under-counts it. Some cooked-pearl waste (over-batching, discarded past hold time) also went unlogged.',
    action: 'Cost the new pearl drink recipe in the library, log the cooked-pearl waste, then recount the pearl bin before locking the stocktake.',
    impactDh: 319.2,
    kind: 'Setup',
    rowIds: ['avocado'],
    link: { href: '/stock?tab=stocktake', label: 'Open stocktake' },
  },
  {
    id: 'salmon-short-delivery',
    severity: 'high',
    title: 'Orchid oolong leaf short delivery',
    diagnosis:
      'Orchid oolong leaf is 25% over recipe because the stock on hand is lower than the delivery note and invoice claim \u2014 the case looks like a short delivery, so the missing cost reads as bar usage.',
    action: 'Check goods-in against the invoice and raise a supplier credit for the shortfall.',
    impactDh: 154.0,
    kind: 'Data fix',
    rowIds: ['smoked-salmon'],
    link: { href: '/suppliers', label: 'Open suppliers' },
  },
  {
    id: 'milk-free-pour',
    severity: 'medium',
    title: 'Milk over-poured when building milk teas',
    diagnosis:
      'Oat (+18.8%) and whole milk (+9.6%) run over recipe every week \u2014 too much milk poured when finishing milk teas, not a data error.',
    action: 'Add a marked pour line to the milk pitchers and brief the bar; typically recovers ~10% of the variance.',
    impactDh: 67.65,
    kind: 'Operations',
    rowIds: ['oat-milk', 'whole-milk'],
  },
  {
    id: 'protein-portioning',
    severity: 'medium',
    title: 'Premium leaf doses creeping up',
    diagnosis:
      'Aged pu\u2019er is 16% over theoretical \u2014 the largest premium-leaf variance \u2014 from ladling milk teas heavier than the recipe plus brew yield loss.',
    action: 'Weigh a sample of leaf doses against the recipe card and re-brief the bar.',
    impactDh: 117.0,
    kind: 'Operations',
    rowIds: ['chicken-breast'],
  },
  {
    id: 'wine-shrinkage',
    severity: 'medium',
    title: 'Brown sugar syrup down more than sales',
    diagnosis:
      'Brown sugar syrup is 25% over recipe \u2014 the count dropped more than the till explains. That points to free-poured pumps, comps, or unlogged spillage at the bar rather than a data error.',
    action: 'Pour to a dosing pump, log spillage, and ring in any comps so usage and sales line up.',
    impactDh: 78.0,
    kind: 'Operations',
    rowIds: ['house-red-wine'],
  },
  {
    id: 'sourdough-staff',
    severity: 'low',
    title: 'Bold black leaf used beyond sales',
    diagnosis:
      'Bold black tea leaf runs 16% over recipe \u2014 more is going out than menu sales explain, typically staff milk teas and comps that never hit the till.',
    action: 'Ring staff drinks and comps through the till (at zero price) so they leave the variance.',
    impactDh: 40.0,
    kind: 'Operations',
    rowIds: ['sourdough-loaf'],
  },
  {
    id: 'basil-spoilage',
    severity: 'low',
    title: 'Peach purée spoiling faster than the recipe',
    diagnosis:
      'Peach purée runs 31.6% over recipe \u2014 a fast-perishing fresh ingredient being binned before it\u2019s used, so usage outruns what the menu mix predicts.',
    action: 'Order peach purée in smaller, more frequent drops and open to order to cut spoilage.',
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
];

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

/** Keyword-matched, deterministic answers. Mirrors the prototype's other
 *  scripted "AI" surfaces (e.g. insightForTableQuery in the Feed). */
export function getCogsChatAnswer(question: string): CogsChatAnswer {
  const q = question.toLowerCase();

  if (q.includes('biggest') || q.includes('largest') || q.includes('worst')) {
    return {
      text: `The biggest single discrepancy is **Tapioca Pearls** — about **£320** of unfavourable variance. Actual usage (128 kg) far outruns the 52 kg theoretical because a **new pearl drink isn't costed in the recipe library yet**, so theory under-counts it, and some cooked-pearl waste went unlogged. Cost the recipe, log the waste and recount before locking. Next worst is **Orchid Oolong Leaf** (+£154) — stock is lower than the invoice, a likely short delivery.`,
      rowIds: ['avocado', 'smoked-salmon'],
    };
  }

  if (
    (q.includes('food cost') || q.includes('above') || q.includes('over theoretical') || q.includes('high')) &&
    !q.includes('item')
  ) {
    return {
      text: `Actual COGS is **${COGS_SUMMARY.actualPct.toFixed(1)}%** vs a theoretical **${COGS_SUMMARY.theoreticalPct.toFixed(1)}%** — that's **+${COGS_SUMMARY.variancePp.toFixed(1)}pp**, or about **£${fmt(COGS_SUMMARY.varianceCost)}** unfavourable. **Beverage** is the driver (26.0% vs 23.0% target). Roughly three causes, in order: a new uncosted recipe (pearls), a supplier short delivery (orchid oolong leaf), and over-pour on milks and premium leaf.`,
    };
  }

  if (q.includes('portion') || q.includes('over-pour') || q.includes('over pour') || q.includes('item')) {
    return {
      text: `The clearest over-portioning lines are **Barista Oat Milk (+18.8%)**, **Aged Pu'er Leaf (+16%)**, **Grass Jelly (+12.2%)** and **Fresh Whole Milk (+9.6%)**. Milks are free-pour on the bar; pu'er is ladled heavier than the recipe on milk teas; grass jelly looks batch-prepped to a par rather than forecast. A marked pitcher line and a dosing spot-check recover most of it.`,
      rowIds: ['oat-milk', 'chicken-breast', 'bagel-vegan-multigrain', 'whole-milk'],
    };
  }

  if (q.includes('check first') || q.includes('priorit') || q.includes('what should') || q.includes('action')) {
    return {
      text: `In priority order: **1)** Cost the new **pearl drink** recipe in the library and recount the pearls — that's the single biggest number. **2)** Check the **Orchid Oolong Leaf** delivery against the invoice and raise a credit. **3)** Dose **Brown Sugar Syrup** to a pump and ring in staff drinks. The first two are data/setup fixes, not bar problems, and clear most of the gap.`,
      rowIds: ['avocado', 'smoked-salmon', 'house-red-wine'],
    };
  }

  if (q.includes('transfer')) {
    return {
      text: `Transfers are clean this period — no one-sided movements driving the gap. The biggest items are a **new pearl drink recipe that isn't costed yet** and an **Orchid Oolong Leaf short delivery**. Both are data/setup fixes rather than bar or transfer problems.`,
      rowIds: ['avocado', 'smoked-salmon'],
    };
  }

  if (q.includes('deliver') || q.includes('invoice') || q.includes('supplier') || q.includes('match') || q.includes('salmon') || q.includes('leaf') || q.includes('oolong')) {
    return {
      text: `Two supply-side issues stand out. **Orchid Oolong Leaf** is +£154 over recipe because stock on hand is below the invoice — a likely **short delivery** to check against goods-in and credit. Separately, several **POS sale items aren't matched to a recipe**, so ~£140 of cost lands in Unassigned. Both are data fixes, not bar problems.`,
      rowIds: ['smoked-salmon'],
    };
  }

  if (q.includes('waste')) {
    return {
      text: `Logged waste is modest this period (**£${fmt(COGS_CLASS_TOTALS.waste)}** total, mostly milk on the bar and a little fruit). The one watch-out is **pearls and peach purée**, where some spoilage looks unlogged — but the variance is dominated by a new uncosted recipe and over-pour, not bin loss.`,
    };
  }

  if (q.includes('beverage') || q.includes('milk') || q.includes('tea') || q.includes('drink')) {
    return {
      text: `Beverage actual is **26.0%** vs **23.0%** theoretical. Most of it is free-pour: **Barista Oat Milk +18.8%** and **Fresh Whole Milk +9.6%**. Roasted oolong leaf is basically on spec (+2.8%). A marked pitcher line on the bar is the single highest-ROI fix here.`,
      rowIds: ['oat-milk', 'whole-milk'],
    };
  }

  if (q.includes('summar') || q.includes('story') || q.includes('overview') || q.includes('explain')) {
    return {
      text: `This period actual COGS landed at **${COGS_SUMMARY.actualPct.toFixed(1)}%** against a **${COGS_SUMMARY.theoreticalPct.toFixed(1)}%** theoretical — **£${fmt(COGS_SUMMARY.varianceCost)}** unfavourable. The headline isn't the bar: **roughly two-thirds of the gap is data/setup** (a new pearl drink recipe not yet costed and an Orchid Oolong Leaf short delivery). The genuine operational slice is **milk over-pour, syrup measures and premium-leaf doses**. Fix the data issues first, then run a dosing spot-check.`,
    };
  }

  return {
    text: `I can break down the COGS variance for you. Try asking about the **biggest discrepancy**, **why food cost is above theoretical**, **over-portioned items**, or **what to check first**. I'm reading from this period's stocktake for ${COGS_SITE_NAME}.`,
  };
}

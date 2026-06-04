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

import { COGS_SUMMARY, COGS_CLASS_TOTALS, COGS_VARIANCE_ROWS, COGS_SITE_NAME } from './fixtures';

/** Threshold (absolute variance %) above which a row gets the Edify chip. */
export const VARIANCE_INSIGHT_THRESHOLD = 10;

/** A row qualifies for an inline insight if it has an authored narrative or
 *  its variance is large enough to be worth flagging. */
export function rowHasInsight(varPct: number, insightId?: string): boolean {
  return Boolean(insightId) || Math.abs(varPct) >= VARIANCE_INSIGHT_THRESHOLD;
}

/** Authored narratives keyed by `insightId` on the variance rows. */
const ROW_INSIGHTS: Record<string, string> = {
  avocado:
    '**Avocado is the single biggest discrepancy this period** — actual usage (128 kg) is well above the **52 kg** the recipe predicts. 70 kg was logged as transferred out to spokes, but the receiving side never confirmed it, so it reads as usage here and the closing count was taken against the old figure. **Fix:** confirm the inter-site transfer was logged on both ends, and recount the avocado bin before locking the stocktake.',
  'arabic-protein-bread':
    'Arabic Protein bread shows up as **two separate master products** with opposite variances (+£153 and −£76.50). One copy carries the purchases, the other carries the recipe usage — so neither reconciles on its own. This is an **item-matching problem, not a kitchen problem**: the supplier line and the recipe ingredient are pointing at different master records. **Fix:** merge the duplicate master products and the variance largely nets out.',
  'bagel-vegan':
    'Vegan Multi Grain bagels used **50 units more than the recipe forecast (+12.2%)**. Purchases and counts look clean, so this is **over-production or over-portioning at the bench** rather than a data error — likely baking to a round tray count instead of to forecast. **Fix:** check the production plan vs. actual bake; trimming the standing par by ~15% recovers ~£23.',
  'basil-leaves':
    'Basil Leaves has **recipe usage of 14 packs but zero stock movement** — no opening, no purchase, no count. The herb is being **consumed in recipes but never received into stock**, so it silently inflates theoretical cost and never shows as a real spend. **Fix:** add basil to the stock count and the standing order so theoretical and actual line up.',
  'beans-red-kidney':
    'Red Kidney Beans used **18.8% more than theoretical**. Small absolute value (£7.20) but a consistent pattern across pulses this month — usually **scoops not weighed to spec**. Worth a portioning spot-check rather than urgent action.',
  'whole-milk':
    'Whole Milk is **9.6% over theoretical**. Most of the gap tracks **steamed-milk wastage on the bar** (8 L logged as waste). Within tolerance, but the espresso bar is the place to watch if beverage cost keeps drifting.',
  'oat-milk':
    'Oat Milk is **18.8% over recipe**. Plant milks are the classic **free-pour culprit** — baristas tend to fill to the jug line rather than to spec on flat whites. **Fix:** a marked pitcher line typically claws back ~10% of the variance.',
  'chicken-breast':
    'Chicken Breast is **16% over theoretical (+£117)** — the largest protein variance. Yield loss on trimming plus generous build weights on hot sandwiches. **Fix:** weigh a sample of builds against the recipe card; protein is where over-portioning costs the most.',
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
    return `**${row.name}** is within tolerance — ${mag}% ${dir} theoretical (£${cost}). No action needed; this is normal week-to-week noise.`;
  }
  return `**${row.name}** ran **${mag}% ${dir} theoretical**, a £${cost} swing. Worth a quick check of counts, portioning and any un-logged transfers for this line.`;
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
    id: 'transfer-leak',
    title: 'Un-logged transfers are the #1 driver',
    detail:
      'Avocado alone accounts for ~£320 of the gap, and the pattern repeats on items with one-sided transfers. Closing the transfer-logging loop would remove most of the unfavourable variance.',
    severity: 'high',
  },
  {
    id: 'duplicate-masters',
    title: 'Duplicate master products distort variance',
    detail:
      'Arabic Protein bread (and two other lines) appear twice — purchases land on one record, recipe usage on the other, so neither reconciles. An item-matching clean-up flatters the numbers without any kitchen change.',
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
    title: 'Protein build weights creeping up',
    detail:
      'Chicken (+16%) shows generous build weights on hot sandwiches. Protein is the highest-value variance per gram, so a portioning spot-check pays back fastest.',
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
    id: 'avocado-transfer',
    severity: 'high',
    title: 'Avocado transfer never received',
    diagnosis:
      'Actual usage (128 kg) is well above the 52 kg the recipe predicts. 70 kg was logged out to spokes but never confirmed at the receiving site, so it reads as usage and the stocktake was counted against the old figure.',
    action: 'Reconcile the inter-site transfer on both ends, then recount the avocado bin before locking the stocktake.',
    impactDh: 319.2,
    kind: 'Data fix',
    rowIds: ['avocado'],
    link: { href: '/stock?tab=stocktake', label: 'Open stocktake' },
  },
  {
    id: 'duplicate-master',
    severity: 'high',
    title: 'Duplicate "Arabic Protein bread" master product',
    diagnosis:
      'The item exists as two master products \u2014 purchases land on one, recipe usage on the other \u2014 so neither line reconciles and the variance looks far worse than reality.',
    action: 'Merge the duplicate master products in Item Matching so purchases and usage sit on one record.',
    impactDh: 153.0,
    kind: 'Data fix',
    rowIds: ['arabic-protein-bread-a', 'arabic-protein-bread-b'],
    link: { href: '/item-matching', label: 'Open item matching' },
  },
  {
    id: 'milk-free-pour',
    severity: 'medium',
    title: 'Plant & dairy milk over-poured on the bar',
    diagnosis:
      'Oat (+18.8%) and whole milk (+9.6%) run over recipe every week \u2014 a free-pour habit on flat whites, not a data error.',
    action: 'Add a marked pour line to the milk pitchers and brief the bar; typically recovers ~10% of the variance.',
    impactDh: 67.65,
    kind: 'Operations',
    rowIds: ['oat-milk', 'whole-milk'],
  },
  {
    id: 'protein-portioning',
    severity: 'medium',
    title: 'Protein build weights creeping up',
    diagnosis:
      'Chicken is 16% over theoretical \u2014 the largest protein variance \u2014 from generous build weights on hot sandwiches plus trim yield loss.',
    action: 'Weigh a sample of hot-sandwich builds against the recipe card and re-brief the line.',
    impactDh: 117.0,
    kind: 'Operations',
    rowIds: ['chicken-breast'],
  },
  {
    id: 'basil-not-stocked',
    severity: 'low',
    title: 'Basil used in recipes but never stocked',
    diagnosis:
      'Basil Leaves shows recipe usage with zero stock movement \u2014 it is consumed but never received, so it silently inflates theoretical cost and hides real spend.',
    action: 'Add Basil Leaves to the stock count and the standing order so theoretical and actual line up.',
    impactDh: 43.4,
    kind: 'Setup',
    rowIds: ['basil-leaves'],
    link: { href: '/stock?tab=stocktake', label: 'Open stocktake' },
  },
  {
    id: 'unassigned-spend',
    severity: 'low',
    title: 'Uncategorised purchases hiding cost',
    diagnosis:
      'The Unassigned class holds £140 of purchases with no product-class mapping, so that spend never shows against a menu category.',
    action: 'Categorise the unassigned purchases to a product class so the cost is attributed correctly.',
    impactDh: 110.0,
    kind: 'Setup',
    link: { href: '/suppliers', label: 'Open products' },
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
      text: `The biggest single discrepancy is **Avocado** — about **£320** of unfavourable variance. Actual usage (128 kg) far outruns the 52 kg the recipe predicts, and 70 kg was transferred out but never confirmed — a **transfer sent but not received**, with the stocktake then counted against the old figure. Sort it on both ends and recount before locking. Next worst is the **duplicate Arabic Protein bread** master product.`,
      rowIds: ['avocado', 'arabic-protein-bread-b'],
    };
  }

  if (
    (q.includes('food cost') || q.includes('above') || q.includes('over theoretical') || q.includes('high')) &&
    !q.includes('item')
  ) {
    return {
      text: `Actual COGS is **${COGS_SUMMARY.actualPct.toFixed(1)}%** vs a theoretical **${COGS_SUMMARY.theoreticalPct.toFixed(1)}%** — that's **+${COGS_SUMMARY.variancePp.toFixed(1)}pp**, or about **£${fmt(COGS_SUMMARY.varianceCost)}** unfavourable. **Food** is the driver (31.5% vs 28% target). Roughly three causes, in order: un-logged transfers (Avocado), duplicate master products (Arabic bread), and over-portioning on milks and protein.`,
    };
  }

  if (q.includes('portion') || q.includes('over-pour') || q.includes('over pour') || q.includes('item')) {
    return {
      text: `The clearest over-portioning lines are **Oat Milk (+18.8%)**, **Chicken Breast (+16%)**, **Vegan bagels (+12.2%)** and **Whole Milk (+9.6%)**. Milks are free-pour on the bar; chicken is build weight on hot sandwiches; bagels look like baking to a tray count rather than forecast. A marked pitcher line and a build-weight spot-check recover most of it.`,
      rowIds: ['oat-milk', 'chicken-breast', 'bagel-vegan-multigrain', 'whole-milk'],
    };
  }

  if (q.includes('check first') || q.includes('priorit') || q.includes('what should') || q.includes('action')) {
    return {
      text: `In priority order: **1)** Confirm the Avocado transfer logged on both ends and recount it — that's the single biggest number. **2)** Merge the duplicate **Arabic Protein bread** master products. **3)** Add **Basil Leaves** to the stock count (used in recipes, never received). The first two are data fixes, not kitchen problems, and clear most of the gap.`,
      rowIds: ['avocado', 'arabic-protein-bread-b', 'basil-leaves'],
    };
  }

  if (q.includes('transfer')) {
    return {
      text: `Transfers are the biggest theme. **Avocado** shows 70 kg moved out with only 52 kg of theoretical usage, and several lines carry one-sided transfers. When a transfer is logged on the sending side but not received, it reads as phantom usage and inflates COGS. Reconciling transfers on both ends would remove most of the unfavourable variance.`,
      rowIds: ['avocado'],
    };
  }

  if (q.includes('duplicate') || q.includes('match') || q.includes('arabic') || q.includes('bread')) {
    return {
      text: `**Arabic Protein bread** exists as two master products. One holds the purchases (+£153), the other holds the recipe usage (−£76.50), so neither reconciles alone. This is an **item-matching** issue — merge the two master records and the variance largely cancels out. Two other lines show the same pattern.`,
      rowIds: ['arabic-protein-bread-a', 'arabic-protein-bread-b'],
    };
  }

  if (q.includes('waste')) {
    return {
      text: `Logged waste is modest this period (**£${fmt(COGS_CLASS_TOTALS.waste)}** total, mostly steamed milk on the bar and a little produce). Waste isn't your problem right now — the variance is dominated by transfers and portioning, not bin loss.`,
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
      text: `This period actual COGS landed at **${COGS_SUMMARY.actualPct.toFixed(1)}%** against a **${COGS_SUMMARY.theoreticalPct.toFixed(1)}%** theoretical — **£${fmt(COGS_SUMMARY.varianceCost)}** unfavourable. The headline isn't the kitchen: **~70% of the gap is data** (an un-logged Avocado transfer and a duplicate bread master). The genuine operational slice is **milk free-pour and protein build weights**. Fix the two data issues first, then run a portioning spot-check.`,
    };
  }

  return {
    text: `I can break down the COGS variance for you. Try asking about the **biggest discrepancy**, **why food cost is above theoretical**, **over-portioned items**, or **what to check first**. I'm reading from this period's stocktake for ${COGS_SITE_NAME}.`,
  };
}

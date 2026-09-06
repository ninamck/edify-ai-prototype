/**
 * Morning variance sweep: the engine.
 *
 * Pure and deterministic. Takes yesterday's per-site records (planned
 * cost from the rota, actual cost from the clock data and pay rules,
 * Edify's sales for the day, the causes) and answers three questions:
 *
 *   1. How far off plan was each site, in pounds and in labour points?
 *   2. Where did every pound go? Causes are summed and anything the
 *      clock data does not account for is shown as unattributed, never
 *      hidden.
 *   3. Which sites matter? Ranked by what the variance means, not its
 *      size. Hours that rose with sales the forecast missed are the
 *      trade. The same pounds on flat sales are a rota problem. An
 *      unfilled shift that saved money while sales fell is a service
 *      problem. A missed break or an under-18 past 22:00 is a legal
 *      problem at any price, and a repeat of one goes to the top.
 *
 * Nothing here writes anywhere. The sweep reads and reports.
 */

import type { Materiality, SiteDayVariance, SweepResult, SweptSite, VarianceCause, VarianceCauseKind } from './types';
import { SWEEP_DATE_LABEL, SWEEP_PULLED_AT, varianceFor } from './siteData/variance';

export const CAUSE_LABEL: Record<VarianceCauseKind, string> = {
  overtime: 'Overtime',
  'missed-break': 'Break not taken',
  'late-clock-out': 'Late clock-out',
  'early-clock-in': 'Early clock-in',
  'unfilled-shift': 'Unfilled shift',
  'extra-shift': 'Shift added',
  'early-finish': 'Early finish',
};

export const MATERIALITY_LABEL: Record<Materiality, string> = {
  matters: 'Matters',
  watch: 'Watch',
  explained: 'Explained',
};

const BAND_ORDER: Record<Materiality, number> = { matters: 0, watch: 1, explained: 2 };

/** Thresholds. Labour points are actual labour % minus planned; pounds
 *  keep a tiny site's two points from outranking a big site's fifty
 *  pounds of the same thing. */
const MATTERS_PTS = 1.5;
const MATTERS_GBP = 50;
const WATCH_PTS = 0.75;
/** For sites with no sales to set cost against (a hub kitchen). */
const MATTERS_GBP_NO_SALES = 100;
const WATCH_GBP_NO_SALES = 50;
/** Sales this far under forecast with a shift unfilled is a service miss. */
const UNFILLED_SALES_MISS_PCT = -5;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (num: number, den: number) => (den > 0 ? round1((num / den) * 100) : 0);

export function signedGBP(gbp: number): string {
  const r = Math.round(gbp);
  if (r === 0) return '£0';
  return `${r > 0 ? '+' : '-'}£${Math.abs(r).toLocaleString('en-GB')}`;
}

export function gbp(n: number): string {
  return `£${Math.round(Math.abs(n)).toLocaleString('en-GB')}`;
}

/** "sales 14% over forecast", "sales on forecast", "sales 4% under forecast". */
export function salesLine(salesVsForecastPct: number): string {
  const p = Math.round(Math.abs(salesVsForecastPct));
  if (p < 1) return 'sales on forecast';
  return `sales ${p}% ${salesVsForecastPct > 0 ? 'over' : 'under'} forecast`;
}

function possessive(name: string): string {
  const first = name.split(' ')[0];
  return first.endsWith('s') ? `${first}'` : `${first}'s`;
}

function decide(v: SiteDayVariance, varianceGBP: number, unexplainedPts: number, salesVsForecastPct: number): Materiality {
  const compliance = v.causes.filter((c) => c.compliance);
  const noSales = v.salesGBP <= 0;
  if (compliance.some((c) => c.repeat)) return 'matters';
  if (v.causes.some((c) => c.kind === 'unfilled-shift') && salesVsForecastPct <= UNFILLED_SALES_MISS_PCT) return 'matters';
  if (!noSales && unexplainedPts >= MATTERS_PTS && varianceGBP >= MATTERS_GBP) return 'matters';
  if (noSales && Math.abs(varianceGBP) >= MATTERS_GBP_NO_SALES) return 'matters';
  if (compliance.length > 0) return 'watch';
  if (!noSales && Math.abs(unexplainedPts) >= WATCH_PTS) return 'watch';
  if (noSales && Math.abs(varianceGBP) >= WATCH_GBP_NO_SALES) return 'watch';
  return 'explained';
}

/** "Freya's break not taken." "Kai Wong out at 22:20 against 22:00,
 *  second time in a fortnight." */
function complianceLine(c: VarianceCause): string {
  let what: string;
  if (c.kind === 'missed-break') {
    what = c.personName ? `${possessive(c.personName)} break not taken` : 'Breaks not taken';
  } else {
    const fact = c.detail.split('. ')[0];
    what = c.personName ? `${c.personName} ${fact.charAt(0).toLowerCase()}${fact.slice(1)}` : fact;
  }
  return c.repeat ? `${what}, ${c.repeat}.` : `${what}.`;
}

function why(v: SiteDayVariance, m: Materiality, varianceGBP: number, plannedPct: number, actualPct: number, salesVsForecastPct: number): string {
  const compliance = v.causes.filter((c) => c.compliance);
  const repeat = compliance.find((c) => c.repeat);
  const unfilled = v.causes.find((c) => c.kind === 'unfilled-shift');
  const noSales = v.salesGBP <= 0;
  const labour = noSales ? '' : `Labour ${actualPct}% against ${plannedPct}% planned`;
  const parts: string[] = [];

  if (m === 'matters') {
    if (repeat) {
      parts.push(complianceLine(repeat));
      if (labour) parts.push(`${labour}, ${salesLine(salesVsForecastPct)}.`);
    } else if (unfilled) {
      parts.push(`Saved ${gbp(unfilled.gbp)} on an unfilled shift while ${salesLine(salesVsForecastPct)}.`);
      if (v.context) parts.push(v.context);
    } else if (labour) {
      parts.push(`${labour}, ${salesLine(salesVsForecastPct)}. The trade does not explain it.`);
    } else {
      parts.push(`${signedGBP(varianceGBP)} against plan with no sales to set it against.`);
    }
    return parts.join(' ');
  }

  if (m === 'watch') {
    if (compliance.length > 0) {
      parts.push(complianceLine(compliance[0]));
      parts.push(labour ? `${labour}, ${salesLine(salesVsForecastPct)}.` : 'Otherwise on plan.');
    } else if (labour) {
      parts.push(`${labour}, ${salesLine(salesVsForecastPct)}.`);
    } else {
      parts.push(`${signedGBP(varianceGBP)} against plan.`);
    }
    return parts.join(' ');
  }

  if (noSales) {
    return `${v.context ?? 'No sales to set it against.'} ${signedGBP(varianceGBP)} against plan.`;
  }
  if (varianceGBP > 0 && salesVsForecastPct >= 3) {
    return `Sales ${Math.round(salesVsForecastPct)}% over forecast covered the hours: labour ${actualPct}% against ${plannedPct}% planned.`;
  }
  return `${labour}, ${salesLine(salesVsForecastPct)}.`;
}

export function sweepSite(v: SiteDayVariance, siteName: string, hasDraft: boolean): SweptSite {
  const varianceGBP = round2(v.actualCostGBP - v.plannedCostGBP);
  const plannedLabourPct = pct(v.plannedCostGBP, v.forecastGBP);
  const actualLabourPct = pct(v.actualCostGBP, v.salesGBP);
  const unexplainedPts = v.salesGBP > 0 ? round1(actualLabourPct - plannedLabourPct) : 0;
  const salesVsForecastPct = v.forecastGBP > 0 ? round1(((v.salesGBP - v.forecastGBP) / v.forecastGBP) * 100) : 0;
  const attributed = v.causes.reduce((s, c) => s + c.gbp, 0);
  const materiality = decide(v, varianceGBP, unexplainedPts, salesVsForecastPct);
  return {
    ...v,
    siteName,
    varianceGBP,
    plannedLabourPct,
    actualLabourPct,
    unexplainedPts,
    salesVsForecastPct,
    materiality,
    why: why(v, materiality, varianceGBP, plannedLabourPct, actualLabourPct, salesVsForecastPct),
    unattributedGBP: round2(varianceGBP - attributed),
    hasDraft,
  };
}

/** The estate, ranked. Sites without a record are left out so the card
 *  can say how many it swept. */
export function sweepEstate(siteIds: string[], nameOf: (id: string) => string, hasDraft: (id: string) => boolean): SweepResult {
  const sites = siteIds
    .map((id) => {
      const v = varianceFor(id);
      return v ? sweepSite(v, nameOf(id), hasDraft(id)) : undefined;
    })
    .filter((s): s is SweptSite => !!s)
    .sort((a, b) => {
      const band = BAND_ORDER[a.materiality] - BAND_ORDER[b.materiality];
      if (band !== 0) return band;
      const pts = Math.abs(b.unexplainedPts) - Math.abs(a.unexplainedPts);
      if (pts !== 0) return pts;
      return Math.abs(b.varianceGBP) - Math.abs(a.varianceGBP);
    });

  const sum = (xs: SweptSite[], f: (s: SweptSite) => number) => round2(xs.reduce((t, s) => t + f(s), 0));
  const plannedCostGBP = sum(sites, (s) => s.plannedCostGBP);
  const actualCostGBP = sum(sites, (s) => s.actualCostGBP);
  const salesGBP = sum(sites, (s) => s.salesGBP);
  const forecastGBP = sum(sites, (s) => s.forecastGBP);
  // Labour % only over sites that sell: a hub kitchen's cost with no
  // counter would inflate the estate figure.
  const selling = sites.filter((s) => s.salesGBP > 0);

  const byCauseMap = new Map<VarianceCauseKind, { gbp: number; count: number }>();
  for (const s of sites) {
    for (const c of s.causes) {
      const cur = byCauseMap.get(c.kind) ?? { gbp: 0, count: 0 };
      byCauseMap.set(c.kind, { gbp: round2(cur.gbp + c.gbp), count: cur.count + 1 });
    }
  }
  const byCause = [...byCauseMap.entries()].map(([kind, x]) => ({ kind, ...x })).sort((a, b) => Math.abs(b.gbp) - Math.abs(a.gbp));

  return {
    dateLabel: SWEEP_DATE_LABEL,
    pulledAt: SWEEP_PULLED_AT,
    tool: sites[0]?.tool ?? 'Workforce.com',
    sites,
    totals: {
      plannedCostGBP,
      actualCostGBP,
      varianceGBP: round2(actualCostGBP - plannedCostGBP),
      salesGBP,
      forecastGBP,
      plannedLabourPct: pct(sum(selling, (s) => s.plannedCostGBP), forecastGBP),
      actualLabourPct: pct(sum(selling, (s) => s.actualCostGBP), salesGBP),
    },
    byCause,
  };
}

/** The one-sentence answer at the top of the card and in the chat line. */
export function sweepVerdict(r: SweepResult): string {
  const n = r.sites.length;
  if (n === 0) return 'No site in this build has yesterday\'s clock data, so there is nothing to sweep.';
  const matters = r.sites.filter((s) => s.materiality === 'matters');
  const watch = r.sites.filter((s) => s.materiality === 'watch');
  const money = `${signedGBP(r.totals.varianceGBP)} against plan on ${gbp(r.totals.salesGBP)} sales`;
  if (n === 1) {
    const s = r.sites[0];
    const first = s.why.split('. ')[0].replace(/\.$/, '');
    if (s.materiality === 'matters') return `${money}. ${first}. Fix today.`;
    if (s.materiality === 'watch') return `${money}. ${first}. Worth a mention.`;
    return `${money}. The trade explains it.`;
  }
  if (matters.length === 0 && watch.length === 0) return `${money}. The trade explains all of it.`;
  const names = (xs: SweptSite[]) => xs.map((s) => s.siteName).join(' and ');
  if (matters.length === 0) return `${money}. Nothing needs a call; ${names(watch)} worth a look.`;
  return `${money}. ${matters.length === 1 ? `${names(matters)} needs a call` : `${names(matters)} need a call`}; the rest is the trade.`;
}

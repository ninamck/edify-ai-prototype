/**
 * Canned "what Ask Edify noticed" takeaways per insight, used by the email
 * preview. In the product these come from the same AI layer that
 * annotates the charts when they're built — the email leads with them so
 * the reader gets the point before (or instead of) opening a chart.
 */

export type EmailInsight = {
  /** One-sentence AI takeaway shown in the summary block and section. */
  takeaway: string;
  /** Placeholder chart flavour for the mock snapshot. */
  chart: 'bars' | 'line' | 'table';
};

export const EMAIL_INSIGHTS: Record<string, EmailInsight> = {
  // Dashboard · In shift
  'Sales v staff v forecast · hour by hour': {
    takeaway: 'Trading 7.6% ahead of forecast so far — the 8–10am peak carried it; staffing matches the curve.',
    chart: 'line',
  },
  'Weather · now vs forecast': {
    takeaway: 'Dry until 4pm, then rain — expect the afternoon walk-in dip an hour earlier than usual.',
    chart: 'line',
  },
  'Waste watch': {
    takeaway: 'Waste is running 70% above typical for this time of day — ham & cheese baguettes are the outlier.',
    chart: 'bars',
  },
  'Deliveries': {
    takeaway: 'Two drops still due today; week-to-date spend is tracking 4% under the trailing average.',
    chart: 'table',
  },
  'Checklist compliance': {
    takeaway: 'Opening checks complete at every site except Shoreditch — its fridge-temp log is 40 minutes overdue.',
    chart: 'table',
  },

  // Dashboard · Estate
  'Net sales — estate ($k / day)': {
    takeaway: 'Estate sales up 3.2% on last week, led by Riverside; no site is more than 4% off forecast.',
    chart: 'line',
  },
  'Gross profit % by site': {
    takeaway: 'GP spread across sites is 4.9pp — Canary is the drag at 65.4% actual against a 67.8% theoretical.',
    chart: 'bars',
  },
  'Wastage value by category': {
    takeaway: 'Bakery is 38% of wastage value this week — double its share of sales.',
    chart: 'bars',
  },
  'COGS variance vs theoretical': {
    takeaway: 'Dairy is the biggest overrun vs recipe cost (+6.1%) — consistent with the oat milk price rise.',
    chart: 'bars',
  },
  'Labour vs sales — by site': {
    takeaway: 'Labour is inside plan everywhere except City Centre, which is 1.8pp over on a soft sales day.',
    chart: 'bars',
  },

  // Templates · Daily
  'Sales · yesterday': {
    takeaway: 'Yesterday closed 7.6% ahead of forecast and 4.9% up on the same day last week.',
    chart: 'line',
  },
  'GP% flash · yesterday': {
    takeaway: 'Theoretical GP held at 69.4% — flat on last week despite the supplier price moves.',
    chart: 'line',
  },
  'Waste logged · yesterday': {
    takeaway: '$146 logged against $86 typical (+70%) — whole milk steaming jugs are the repeat offender.',
    chart: 'bars',
  },
  'Exceptions queue': {
    takeaway: '9 exceptions need attention: 4 unmatched invoices, 3 un-receipted GRNs, 2 items below par.',
    chart: 'table',
  },
  'Anomaly flags': {
    takeaway: 'Edify flagged an 8% oat milk price rise on yesterday\u2019s Brakes invoice — third rise this quarter.',
    chart: 'table',
  },

  // Templates · Weekly flash
  'Site league · sales and GP': {
    takeaway: 'Riverside tops the league again; Shoreditch skipped its stocktake, so its actual GP is blank — not fine.',
    chart: 'table',
  },
  'Waste as % of sales · by site': {
    takeaway: 'Shoreditch waste hit 2.8% of sales — nearly double the 1.5% target the rest of the estate holds.',
    chart: 'bars',
  },
  'Purchasing spend as % of sales · by site': {
    takeaway: 'Spend ratios are stable except Canary at 32.6% — drifting up for the third straight week.',
    chart: 'bars',
  },
  'Spend vs trailing 4-week average': {
    takeaway: 'Canary (+6.8%) and Shoreditch (+5.2%) are both spending well above their own four-week baseline.',
    chart: 'bars',
  },
  'Top 5 price movers': {
    takeaway: 'Net $130/week of price creep — the oat milk rise alone is ~$1,120 annualised across the estate.',
    chart: 'table',
  },
  'Compliance strip': {
    takeaway: '92% of invoices matched and 5 of 6 stocktakes done — Shoreditch is the gap on both.',
    chart: 'table',
  },

  // Templates · Period end
  'GP bridge · theoretical to actual': {
    takeaway: 'Of the 3.1pp gap between theoretical and actual GP, waste explains 1.2pp; unexplained shrank again to 1.4pp.',
    chart: 'bars',
  },
  'Data confidence': {
    takeaway: '5 of 6 sites counted and 97% of POS sales are recipe-mapped — trust the page, except Shoreditch.',
    chart: 'table',
  },
  'COGS variance · site × category': {
    takeaway: 'Canary dairy is the single biggest variance line (+$1.2k) — start the five-step diagnostic there.',
    chart: 'table',
  },
  'Menu profitability · margin vs volume': {
    takeaway: 'Three delist candidates sit below 45% margin and 1,500 units; the flat white remains the star.',
    chart: 'bars',
  },
  'Stock holding · value and days of cover': {
    takeaway: 'Kings X is holding 12.4 days of cover — $3.1k more stock than its sales rate justifies.',
    chart: 'table',
  },
  'Dead and slow-moving stock': {
    takeaway: '$312 of stock had zero usage this period — seasonal syrups dominate; transfer before write-down.',
    chart: 'table',
  },
  'Supplier inflation impact': {
    takeaway: 'Brakes carries nearly half the period\u2019s price effect; La Boulangerie\u2019s tier discount is the only deflation.',
    chart: 'table',
  },
  'CPU transfer reconciliation': {
    takeaway: '$0.8k left the CPU that Kings X and Shoreditch never booked in — their GP is flattered until receipted.',
    chart: 'table',
  },
  'Trend · four periods': {
    takeaway: 'Unexplained variance is down 1.1pp over three periods — the controls are working.',
    chart: 'line',
  },
};

export const GENERIC_EMAIL_INSIGHT: EmailInsight = {
  takeaway: 'Latest figures for the selected window, cut the way this view is set up in Edify.',
  chart: 'table',
};

export function emailInsightFor(title: string): EmailInsight {
  return EMAIL_INSIGHTS[title] ?? GENERIC_EMAIL_INSIGHT;
}

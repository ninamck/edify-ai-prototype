import type { AnalyticsChartId, DunkinAnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import type { TableQuery } from '@/components/Mvp1/Tables/query';

export type QuestionShape = 'chart' | 'table' | 'both';

export type QuestionSegment =
  | 'sales'
  | 'cogs'
  | 'labour'
  | 'waste'
  | 'production'
  | 'padel';

export type ProductionSubsegment =
  | 'general'
  | 'produced-v-sold'
  | 'availability'
  | 'closing-range'
  | 'efficiency';

export interface QuestionEntry {
  id: string;
  segment: QuestionSegment;
  subsegment?: ProductionSubsegment;
  text: string;
  /** Non-exhaustive — only the 6 canonical exact-match questions carry a chart hint. */
  suggestedChartId?: AnalyticsChartId;
}

export const SEGMENT_LABELS: Record<QuestionSegment, string> = {
  sales: 'Sales',
  cogs: 'COGS',
  labour: 'Labour',
  waste: 'Waste',
  production: 'Production',
  padel: 'Padel & cafe',
};

export const PRODUCTION_SUBSEGMENT_LABELS: Record<ProductionSubsegment, string> = {
  general: 'General',
  'produced-v-sold': 'Produced v sold',
  availability: 'Availability',
  'closing-range': 'Closing range',
  efficiency: 'Efficiency',
};

export const SEGMENT_ORDER: QuestionSegment[] = ['sales', 'cogs', 'labour', 'waste', 'production', 'padel'];
export const PRODUCTION_SUBSEGMENT_ORDER: ProductionSubsegment[] = [
  'general',
  'produced-v-sold',
  'availability',
  'closing-range',
  'efficiency',
];

export const QUESTION_LIBRARY: QuestionEntry[] = [
  {
    id: 'sales-what-were-total-sales-across',
    segment: 'sales',
    text: 'What were total sales across all sites last week?',
    suggestedChartId: 'sales',
  },
  {
    id: 'sales-which-site-had-the-highest',
    segment: 'sales',
    text: 'Which site had the highest revenue in the last 30 days?',
    suggestedChartId: 'sales',
  },
  {
    id: 'sales-how-did-sales-perform-this',
    segment: 'sales',
    text: 'How did sales perform this week vs the same week last year?',
    suggestedChartId: 'lfl',
  },
  {
    id: 'sales-what-is-the-average-transaction',
    segment: 'sales',
    text: 'What is the average transaction value per site this month?',
    suggestedChartId: 'labour',
  },
  {
    id: 'sales-which-hour-of-the-day',
    segment: 'sales',
    text: 'Which hour of the day drives the most revenue on weekdays?',
    suggestedChartId: 'hour',
  },
  {
    id: 'sales-how-has-revenue-trended-over',
    segment: 'sales',
    text: 'How has revenue trended over the last 12 weeks?',
    suggestedChartId: 'trend',
  },
  {
    id: 'sales-what-is-the-sales-split',
    segment: 'sales',
    text: 'What is the sales split between eat-in and takeaway?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'sales-which-product-category-generates-the',
    segment: 'sales',
    text: 'Which product category generates the most revenue?',
    suggestedChartId: 'waste-category-treemap',
  },
  {
    id: 'sales-what-are-the-top-10',
    segment: 'sales',
    text: 'What are the top 10 best-selling items across all sites?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'sales-how-do-weekend-sales-compare',
    segment: 'sales',
    text: 'How do weekend sales compare to weekday sales on average?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'sales-which-site-has-shown-the',
    segment: 'sales',
    text: 'Which site has shown the strongest month-on-month growth?',
    suggestedChartId: 'growth',
  },
  {
    id: 'sales-what-percentage-of-revenue-comes',
    segment: 'sales',
    text: 'What percentage of revenue comes from our loyalty customers?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'sales-how-did-the-recent-menu',
    segment: 'sales',
    text: 'How did the recent menu change impact sales mix?',
    suggestedChartId: 'lfl',
  },
  {
    id: 'sales-what-is-the-revenue-per',
    segment: 'sales',
    text: 'What is the revenue per labour hour across each site?',
    suggestedChartId: 'labour',
  },
  {
    id: 'sales-which-new-product-has-had',
    segment: 'sales',
    text: 'Which new product has had the best sales performance since launch?',
    suggestedChartId: 'trend',
  },
  {
    id: 'sales-what-is-the-average-basket',
    segment: 'sales',
    text: 'What is the average basket size per customer visit?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'sales-how-does-site-performance-rank',
    segment: 'sales',
    text: 'How does site performance rank against the network average?',
    suggestedChartId: 'growth',
  },
  {
    id: 'sales-what-were-sales-during-the',
    segment: 'sales',
    text: 'What were sales during the breakfast vs lunch vs afternoon daypart?',
    suggestedChartId: 'daypart',
  },
  {
    id: 'sales-which-sites-underperformed-against-their',
    segment: 'sales',
    text: 'Which sites underperformed against their sales target this month?',
    suggestedChartId: 'cogs',
  },
  {
    id: 'sales-how-has-our-average-transaction',
    segment: 'sales',
    text: 'How has our average transaction value changed over the last quarter?',
    suggestedChartId: 'trend',
  },
  {
    id: 'cogs-what-is-our-cogs-as',
    segment: 'cogs',
    text: 'What is our COGS as a percentage of revenue across all sites this month?',
    suggestedChartId: 'labour',
  },
  {
    id: 'cogs-which-site-has-the-highest',
    segment: 'cogs',
    text: 'Which site has the highest COGS variance against theoretical this week?',
    suggestedChartId: 'cogs',
  },
  {
    id: 'cogs-what-are-the-top-5',
    segment: 'cogs',
    text: 'What are the top 5 ingredients driving the most cost this month?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'cogs-how-has-our-overall-cogs',
    segment: 'cogs',
    text: 'How has our overall COGS % trended over the last 12 weeks?',
    suggestedChartId: 'trend',
  },
  {
    id: 'cogs-which-menu-items-have-the',
    segment: 'cogs',
    text: 'Which menu items have the lowest gross margin?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'cogs-what-is-the-theoretical-vs',
    segment: 'cogs',
    text: 'What is the theoretical vs actual COGS gap at each site?',
    suggestedChartId: 'labour-hours',
  },
  {
    id: 'cogs-which-supplier-invoices-have-the',
    segment: 'cogs',
    text: 'Which supplier invoices have the largest price variance vs contract rates?',
    suggestedChartId: 'growth',
  },
  {
    id: 'cogs-how-much-did-coffee-bean',
    segment: 'cogs',
    text: 'How much did coffee bean costs change after our last supplier review?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'cogs-what-is-the-cost-per',
    segment: 'cogs',
    text: 'What is the cost per serving for our top 10 selling items?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'cogs-which-sites-are-consistently-over',
    segment: 'cogs',
    text: 'Which sites are consistently over their COGS budget?',
    suggestedChartId: 'cogs',
  },
  {
    id: 'cogs-what-is-the-ingredient-cost',
    segment: 'cogs',
    text: 'What is the ingredient cost breakdown for our signature latte?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'cogs-how-does-dairy-cost-as',
    segment: 'cogs',
    text: 'How does dairy cost as a % of COGS compare site to site?',
    suggestedChartId: 'labour',
  },
  {
    id: 'cogs-which-recipes-show-the-biggest',
    segment: 'cogs',
    text: 'Which recipes show the biggest gap between actual and theoretical usage?',
    suggestedChartId: 'produced-sold',
  },
  {
    id: 'cogs-what-is-our-average-food',
    segment: 'cogs',
    text: 'What is our average food cost % vs drink cost %?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'cogs-how-much-has-our-cogs',
    segment: 'cogs',
    text: 'How much has our COGS increased in absolute terms vs the same period last year?',
    suggestedChartId: 'lfl',
  },
  {
    id: 'cogs-which-ingredient-has-seen-the',
    segment: 'cogs',
    text: 'Which ingredient has seen the biggest price increase in the last 6 months?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'cogs-what-is-the-cogs-impact',
    segment: 'cogs',
    text: 'What is the COGS impact if we switch to oat milk as our default alt milk?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'cogs-which-sites-have-the-most',
    segment: 'cogs',
    text: 'Which sites have the most accurate portion control based on COGS variance?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'cogs-how-does-our-cogs-compare',
    segment: 'cogs',
    text: 'How does our COGS % compare across different dayparts?',
    suggestedChartId: 'daypart',
  },
  {
    id: 'cogs-what-would-our-cogs-be',
    segment: 'cogs',
    text: 'What would our COGS % be if we removed our three lowest-margin items?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'labour-what-is-labour-as-a',
    segment: 'labour',
    text: 'What is labour as a percentage of sales across all sites this month?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'labour-which-site-has-the-highest',
    segment: 'labour',
    text: 'Which site has the highest labour cost per transaction?',
    suggestedChartId: 'labour',
  },
  {
    id: 'labour-how-does-actual-vs-scheduled',
    segment: 'labour',
    text: 'How does actual vs scheduled hours compare across the network this week?',
    suggestedChartId: 'labour-hours',
  },
  {
    id: 'labour-which-day-of-the-week',
    segment: 'labour',
    text: 'Which day of the week has the highest labour cost relative to revenue?',
    suggestedChartId: 'labour-day-radial',
  },
  {
    id: 'labour-what-is-the-average-hourly',
    segment: 'labour',
    text: 'What is the average hourly labour cost per site?',
    suggestedChartId: 'labour',
  },
  {
    id: 'labour-which-sites-are-consistently-over',
    segment: 'labour',
    text: 'Which sites are consistently over their labour budget?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'labour-how-does-our-labour-compare',
    segment: 'labour',
    text: 'How does our labour % compare in the morning rush vs the afternoon?',
    suggestedChartId: 'daypart',
  },
  {
    id: 'labour-what-is-the-revenue-per',
    segment: 'labour',
    text: 'What is the revenue per team member across each site?',
    suggestedChartId: 'labour',
  },
  {
    id: 'labour-how-many-overtime-hours-were',
    segment: 'labour',
    text: 'How many overtime hours were recorded across the network last month?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'labour-which-role-type-accounts-for',
    segment: 'labour',
    text: 'Which role type accounts for the most labour cost — barista, shift lead, or manager?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'labour-how-has-our-labour-trended',
    segment: 'labour',
    text: 'How has our labour % trended since the minimum wage increase?',
    suggestedChartId: 'trend',
  },
  {
    id: 'labour-which-site-has-the-best',
    segment: 'labour',
    text: 'Which site has the best revenue-to-labour ratio?',
    suggestedChartId: 'labour',
  },
  {
    id: 'labour-what-is-the-variance-between',
    segment: 'labour',
    text: 'What is the variance between scheduled and actual hours at our busiest site?',
    suggestedChartId: 'labour-hours',
  },
  {
    id: 'labour-how-does-weekend-labour-cost',
    segment: 'labour',
    text: 'How does weekend labour cost compare to weekday labour cost?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'labour-which-sites-have-the-highest',
    segment: 'labour',
    text: 'Which sites have the highest staff turnover cost in the last 6 months?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'labour-what-is-our-total-weekly',
    segment: 'labour',
    text: 'What is our total weekly labour cost broken down by site?',
    suggestedChartId: 'sales',
  },
  {
    id: 'labour-how-does-our-labour-efficiency',
    segment: 'labour',
    text: 'How does our labour efficiency compare during peak vs off-peak hours?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'labour-which-sites-would-benefit-most',
    segment: 'labour',
    text: 'Which sites would benefit most from a shift in staffing patterns?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'labour-what-is-the-labour-cost',
    segment: 'labour',
    text: 'What is the labour cost impact of staying open an extra hour on Sundays?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'labour-how-does-our-labour-benchmark',
    segment: 'labour',
    text: 'How does our labour % benchmark against the industry standard for QSR?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'waste-what-is-our-total-recorded',
    segment: 'waste',
    text: 'What is our total recorded waste value across all sites this week?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'waste-which-site-has-the-highest',
    segment: 'waste',
    text: 'Which site has the highest waste as a percentage of food and drink cost?',
    suggestedChartId: 'labour',
  },
  {
    id: 'waste-what-are-the-top-10',
    segment: 'waste',
    text: 'What are the top 10 most wasted items across the network?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'waste-how-does-waste-volume-compare',
    segment: 'waste',
    text: 'How does waste volume compare on Mondays vs Fridays?',
    suggestedChartId: 'labour-day-radial',
  },
  {
    id: 'waste-which-category-generates-the-most',
    segment: 'waste',
    text: 'Which category generates the most waste — food, drink, or packaging?',
    suggestedChartId: 'waste-category-treemap',
  },
  {
    id: 'waste-what-percentage-of-our-waste',
    segment: 'waste',
    text: 'What percentage of our waste is recorded at end of day vs during service?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'waste-how-has-total-waste-trended',
    segment: 'waste',
    text: 'How has total waste trended over the last 12 weeks?',
    suggestedChartId: 'waste-trend-stacked',
  },
  {
    id: 'waste-which-sites-are-logging-waste',
    segment: 'waste',
    text: 'Which sites are logging waste consistently and which have gaps in recording?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'waste-what-is-the-financial-impact',
    segment: 'waste',
    text: 'What is the financial impact of waste at each site per month?',
    suggestedChartId: 'sales',
  },
  {
    id: 'waste-which-day-of-the-week',
    segment: 'waste',
    text: 'Which day of the week sees the most waste across the network?',
    suggestedChartId: 'labour-day-radial',
  },
  {
    id: 'waste-how-does-waste-compare-between',
    segment: 'waste',
    text: 'How does waste compare between high-volume and low-volume trading days?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'waste-what-is-the-waste-rate',
    segment: 'waste',
    text: 'What is the waste rate for our fresh pastry range?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'waste-which-sites-have-reduced-waste',
    segment: 'waste',
    text: 'Which sites have reduced waste the most following the new production planning rules?',
    suggestedChartId: 'growth',
  },
  {
    id: 'waste-how-much-waste-could-be',
    segment: 'waste',
    text: 'How much waste could be prevented if production accuracy improved by 10%?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'waste-what-is-the-average-waste',
    segment: 'waste',
    text: 'What is the average waste cost per customer transaction?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'waste-which-items-are-most-frequently',
    segment: 'waste',
    text: 'Which items are most frequently wasted due to overproduction vs spoilage?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'waste-how-does-waste-recording-compliance',
    segment: 'waste',
    text: 'How does waste recording compliance compare across site managers?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'waste-what-is-the-waste-trend',
    segment: 'waste',
    text: 'What is the waste trend for our made-to-order vs pre-made range?',
    suggestedChartId: 'lfl',
  },
  {
    id: 'waste-how-much-of-our-total',
    segment: 'waste',
    text: 'How much of our total waste is attributable to the last hour of trading?',
    suggestedChartId: 'waste-heatmap',
  },
  {
    id: 'waste-what-would-reducing-waste-by',
    segment: 'waste',
    text: 'What would reducing waste by 20% mean for COGS % across the network?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'production-what-did-we-plan-to',
    segment: 'production',
    subsegment: 'general',
    text: 'What did we plan to produce vs what we actually made across all sites yesterday?',
    suggestedChartId: 'labour-hours',
  },
  {
    id: 'production-which-sites-consistently-over-produce',
    segment: 'production',
    subsegment: 'general',
    text: 'Which sites consistently over-produce against their production plan?',
    suggestedChartId: 'growth',
  },
  {
    id: 'production-how-has-production-accuracy-trended',
    segment: 'production',
    subsegment: 'general',
    text: 'How has production accuracy trended over the last 8 weeks?',
    suggestedChartId: 'trend',
  },
  {
    id: 'production-which-products-have-the-highest',
    segment: 'production',
    subsegment: 'general',
    text: 'Which products have the highest variance between planned and actual production?',
    suggestedChartId: 'produced-sold',
  },
  {
    id: 'production-what-is-the-average-sell',
    segment: 'production',
    subsegment: 'general',
    text: 'What is the average sell-through rate for our fresh range by end of day?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'production-which-site-is-most-accurately',
    segment: 'production',
    subsegment: 'general',
    text: 'Which site is most accurately matching production to sales demand?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'production-how-does-production-volume-on',
    segment: 'production',
    subsegment: 'general',
    text: 'How does production volume on Mondays compare to the rest of the week?',
    suggestedChartId: 'labour-day-radial',
  },
  {
    id: 'production-which-items-are-we-regularly',
    segment: 'production',
    subsegment: 'general',
    text: 'Which items are we regularly running out of before close of trading?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-what-percentage-of-production-is',
    segment: 'production',
    subsegment: 'general',
    text: 'What percentage of production is being wasted vs sold across the network?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'production-how-does-production-accuracy-differ',
    segment: 'production',
    subsegment: 'general',
    text: 'How does production accuracy differ between morning prep and afternoon batches?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'production-which-sites-are-producing-to',
    segment: 'production',
    subsegment: 'general',
    text: 'Which sites are producing to a plan vs producing from habit?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'production-what-is-the-gap-between',
    segment: 'production',
    subsegment: 'general',
    text: 'What is the gap between production plan and actual for our top 5 SKUs?',
    suggestedChartId: 'produced-sold',
  },
  {
    id: 'production-how-has-the-introduction-of',
    segment: 'production',
    subsegment: 'general',
    text: 'How has the introduction of production planning targets affected waste at each site?',
    suggestedChartId: 'trend',
  },
  {
    id: 'production-which-products-have-the-shortest',
    segment: 'production',
    subsegment: 'general',
    text: 'Which products have the shortest shelf life and highest risk of waste?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-what-would-the-waste-saving',
    segment: 'production',
    subsegment: 'general',
    text: 'What would the waste saving be if all sites hit their production plan accuracy?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'production-how-does-weekend-production-planning',
    segment: 'production',
    subsegment: 'general',
    text: 'How does weekend production planning accuracy compare to weekday?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'production-which-site-managers-have-the',
    segment: 'production',
    subsegment: 'general',
    text: 'Which site managers have the best record for following production plans?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'production-what-is-the-average-time',
    segment: 'production',
    subsegment: 'general',
    text: 'What is the average time between production and sale for our fresh bakery range?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'production-how-much-are-we-over',
    segment: 'production',
    subsegment: 'general',
    text: 'How much are we over-producing in the last hour of trading across the network?',
    suggestedChartId: 'waste-heatmap',
  },
  {
    id: 'production-which-new-menu-items-have',
    segment: 'production',
    subsegment: 'general',
    text: 'Which new menu items have the least reliable production planning data?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-which-items-had-the-biggest',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'Which items had the biggest gap between units produced and units sold yesterday?',
    suggestedChartId: 'produced-sold',
  },
  {
    id: 'production-what-is-the-average-sell-2',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'What is the average sell-through rate per item across all sites this week?',
    suggestedChartId: 'labour',
  },
  {
    id: 'production-which-sites-consistently-sell-out',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'Which sites consistently sell out of produced items before close?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-how-many-units-of-our',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'How many units of our top 10 products were produced vs sold last Monday?',
    suggestedChartId: 'produced-sold',
  },
  {
    id: 'production-which-items-have-a-sell',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'Which items have a sell-through rate below 80% on a regular basis?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-what-is-the-produced-vs',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'What is the produced vs sold ratio for our fresh bakery range this month?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'production-which-day-of-the-week',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'Which day of the week has the worst sell-through performance across the network?',
    suggestedChartId: 'labour-day-radial',
  },
  {
    id: 'production-how-does-produced-vs-sold',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'How does produced vs sold compare between high-volume and low-volume sites?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'production-which-items-are-we-producing',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'Which items are we producing more than 20% above what we actually sell?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-what-would-our-waste-cost',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'What would our waste cost be if produced vs sold was within 5% for every item?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'production-how-has-the-produced-vs',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'How has the produced vs sold gap changed since we introduced production planning targets?',
    suggestedChartId: 'trend',
  },
  {
    id: 'production-which-site-has-the-tightest',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'Which site has the tightest produced vs sold ratio across all products?',
    suggestedChartId: 'labour',
  },
  {
    id: 'production-how-does-produced-vs-sold-2',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'How does produced vs sold performance vary across dayparts?',
    suggestedChartId: 'daypart',
  },
  {
    id: 'production-which-new-product-launches-have',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'Which new product launches have the worst produced vs sold accuracy?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-what-is-the-financial-value',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'What is the financial value of unsold produced items across the network per week?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'production-which-items-regularly-sell-more',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'Which items regularly sell more than produced, suggesting we are under-planning?',
    suggestedChartId: 'produced-sold',
  },
  {
    id: 'production-how-does-the-produced-vs',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'How does the produced vs sold ratio for hot food compare to cold food?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'production-which-sites-have-improved-their',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'Which sites have improved their produced vs sold accuracy the most in the last 3 months?',
    suggestedChartId: 'growth',
  },
  {
    id: 'production-what-is-the-produced-vs-2',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'What is the produced vs sold trend for seasonal items vs core range?',
    suggestedChartId: 'waste-trend-stacked',
  },
  {
    id: 'production-if-we-reduced-over-production',
    segment: 'production',
    subsegment: 'produced-v-sold',
    text: 'If we reduced over-production by 15%, what would the COGS saving be per site?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'production-which-items-are-most-frequently',
    segment: 'production',
    subsegment: 'availability',
    text: 'Which items are most frequently out of stock before the end of trading?',
    suggestedChartId: 'oos-pareto',
  },
  {
    id: 'production-what-time-of-day-do',
    segment: 'production',
    subsegment: 'availability',
    text: 'What time of day do we typically run out of our top 5 selling products?',
    suggestedChartId: 'hour',
  },
  {
    id: 'production-which-sites-have-the-most',
    segment: 'production',
    subsegment: 'availability',
    text: 'Which sites have the most availability failures in the last 30 days?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-how-many-times-did-we',
    segment: 'production',
    subsegment: 'availability',
    text: 'How many times did we run out of a core range item during peak trading hours this week?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'production-what-percentage-of-our-menu',
    segment: 'production',
    subsegment: 'availability',
    text: 'What percentage of our menu is available at 2pm vs when we open?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'production-which-sites-are-under-producing',
    segment: 'production',
    subsegment: 'availability',
    text: 'Which sites are under-producing and causing the most availability gaps?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-how-does-availability-of-fresh',
    segment: 'production',
    subsegment: 'availability',
    text: 'How does availability of fresh items compare between morning and afternoon?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'production-which-product-category-has-the',
    segment: 'production',
    subsegment: 'availability',
    text: 'Which product category has the most frequent stockouts — food, drink, or bakery?',
    suggestedChartId: 'waste-category-treemap',
  },
  {
    id: 'production-what-is-the-lost-revenue',
    segment: 'production',
    subsegment: 'availability',
    text: 'What is the lost revenue estimate from availability failures last month?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'production-how-does-availability-performance-differ',
    segment: 'production',
    subsegment: 'availability',
    text: 'How does availability performance differ between weekdays and weekends?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'production-which-items-should-we-be',
    segment: 'production',
    subsegment: 'availability',
    text: 'Which items should we be producing in a second batch based on sell-through speed?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-how-often-do-we-run',
    segment: 'production',
    subsegment: 'availability',
    text: 'How often do we run out of a product within 2 hours of opening?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'production-which-sites-maintain-the-best',
    segment: 'production',
    subsegment: 'availability',
    text: 'Which sites maintain the best full-range availability throughout the trading day?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'production-what-is-the-correlation-between',
    segment: 'production',
    subsegment: 'availability',
    text: 'What is the correlation between low production plan adherence and availability failures?',
    suggestedChartId: 'prod-avail-scatter',
  },
  {
    id: 'production-how-has-availability-improved-or',
    segment: 'production',
    subsegment: 'availability',
    text: 'How has availability improved or declined since introducing production planning?',
    suggestedChartId: 'trend',
  },
  {
    id: 'production-which-high-margin-items-are',
    segment: 'production',
    subsegment: 'availability',
    text: 'Which high-margin items are most at risk of availability failures?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-how-many-customer-facing-availability',
    segment: 'production',
    subsegment: 'availability',
    text: 'How many customer-facing availability gaps occurred across the network this week?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'production-which-day-of-the-week-2',
    segment: 'production',
    subsegment: 'availability',
    text: 'Which day of the week sees the most availability failures across all sites?',
    suggestedChartId: 'labour-day-radial',
  },
  {
    id: 'production-what-is-the-average-duration',
    segment: 'production',
    subsegment: 'availability',
    text: 'What is the average duration of an out-of-stock event per site per day?',
    suggestedChartId: 'labour',
  },
  {
    id: 'production-which-items-need-a-minimum',
    segment: 'production',
    subsegment: 'availability',
    text: 'Which items need a minimum production floor to prevent availability failures?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-how-many-skus-are-still',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'How many SKUs are still available at close of trading across all sites?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'production-which-sites-consistently-have-too',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'Which sites consistently have too much range left at close?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-what-is-the-average-number',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'What is the average number of items remaining at close vs planned close range?',
    suggestedChartId: 'labour-hours',
  },
  {
    id: 'production-which-items-are-most-commonly',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'Which items are most commonly left over at end of day?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-how-does-closing-range-compare',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'How does closing range compare between a Monday and a Friday?',
    suggestedChartId: 'labour-day-radial',
  },
  {
    id: 'production-which-sites-are-hitting-their',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'Which sites are hitting their target closing range most consistently?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'production-what-is-the-value-of',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'What is the value of closing range waste across the network per week?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'production-how-many-items-in-the',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'How many items in the closing range could have been avoided with better production planning?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'production-which-product-categories-contribute-most',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'Which product categories contribute most to excess closing range — hot food, cold food, or bakery?',
    suggestedChartId: 'waste-category-treemap',
  },
  {
    id: 'production-how-does-closing-range-at',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'How does closing range at our top-performing site differ from our worst?',
    suggestedChartId: 'labour-hours',
  },
  {
    id: 'production-what-time-do-sites-typically',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'What time do sites typically fall below their target closing range?',
    suggestedChartId: 'hour',
  },
  {
    id: 'production-which-items-are-regularly-in',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'Which items are regularly in the closing range despite low demand signals?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-how-has-closing-range-waste',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'How has closing range waste trended since production planning was introduced?',
    suggestedChartId: 'trend',
  },
  {
    id: 'production-which-sites-have-reduced-their',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'Which sites have reduced their closing range the most in the last quarter?',
    suggestedChartId: 'growth',
  },
  {
    id: 'production-what-would-the-financial-impact',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'What would the financial impact be of reducing closing range by 20% network-wide?',
    suggestedChartId: 'waste-kpi',
  },
  {
    id: 'production-how-does-closing-range-on',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'How does closing range on a bank holiday compare to a regular trading day?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'production-which-managers-have-the-best',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'Which managers have the best record for hitting target closing range?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'production-what-is-the-relationship-between',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'What is the relationship between closing range volume and waste cost per site?',
    suggestedChartId: 'prod-avail-scatter',
  },
  {
    id: 'production-are-there-items-we-should',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'Are there items we should stop producing after a certain time to reduce closing range?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-how-does-our-closing-range',
    segment: 'production',
    subsegment: 'closing-range',
    text: 'How does our closing range compare to our production plan targets for end of day?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'production-how-long-does-it-take',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'How long does it take each site to complete their morning production run on average?',
    suggestedChartId: 'labour',
  },
  {
    id: 'production-which-sites-are-completing-production',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'Which sites are completing production tasks within the planned time window?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'production-what-is-the-output-per',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'What is the output per production hour across each site this week?',
    suggestedChartId: 'labour',
  },
  {
    id: 'production-which-products-take-the-most',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'Which products take the most time to produce relative to their sales volume?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-how-does-production-efficiency-vary',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'How does production efficiency vary between weekday and weekend shifts?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'production-which-site-produces-the-most',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'Which site produces the most units per labour hour?',
    suggestedChartId: 'labour',
  },
  {
    id: 'production-what-percentage-of-production-is-2',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'What percentage of production is completed before the first customer rush?',
    suggestedChartId: 'labour-pct',
  },
  {
    id: 'production-how-does-production-efficiency-change',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'How does production efficiency change when a site is running below target staffing?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'production-which-items-have-the-highest',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'Which items have the highest production cost per unit when labour is factored in?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-how-many-production-runs-are',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'How many production runs are completed on time vs late across the network per week?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'production-which-sites-have-the-most-2',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'Which sites have the most consistent production output day to day?',
    suggestedChartId: 'labour',
  },
  {
    id: 'production-what-is-the-labour-cost',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'What is the labour cost per unit produced for our top 10 products?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-how-does-batch-size-affect',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'How does batch size affect production efficiency across different site formats?',
    suggestedChartId: 'prod-avail-scatter',
  },
  {
    id: 'production-which-items-take-the-longest',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'Which items take the longest to produce and are they worth it based on margin?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-how-has-production-efficiency-changed',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'How has production efficiency changed since the new production planning process was introduced?',
    suggestedChartId: 'trend',
  },
  {
    id: 'production-what-is-the-ratio-of',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'What is the ratio of production time to total shift length across each site?',
    suggestedChartId: 'labour',
  },
  {
    id: 'production-which-sites-are-re-producing',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'Which sites are re-producing items mid-shift most frequently?',
    suggestedChartId: 'waste-top10',
  },
  {
    id: 'production-how-does-efficiency-differ-between',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'How does efficiency differ between experienced site managers and newer ones?',
    suggestedChartId: 'eatin',
  },
  {
    id: 'production-what-is-the-production-output',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'What is the production output per team member during the morning prep window?',
    suggestedChartId: 'labour',
  },
  {
    id: 'production-which-products-should-we-consider',
    segment: 'production',
    subsegment: 'efficiency',
    text: 'Which products should we consider batch-producing centrally based on unit production time?',
    suggestedChartId: 'waste-top10',
  },

  // ── Padel & cafe ─────────────────────────────────────────────────
  // Curated for a padel-club operator that also runs cafes on site.
  {
    id: 'padel-which-courts-and-slots-below-historical',
    segment: 'padel',
    text: 'Which courts and slots are running below historical fill this month?',
  },
  {
    id: 'padel-which-clubs-occupancy-dropped-most',
    segment: 'padel',
    text: 'Which clubs had the biggest occupancy drop this week?',
  },
  {
    id: 'padel-peak-hours-by-day-this-month',
    segment: 'padel',
    text: 'What are the peak court hours by day of the week this month?',
  },
  {
    id: 'padel-no-show-rate-by-slot',
    segment: 'padel',
    text: 'Which slots have the highest no-show rate over the last 30 days?',
  },
  {
    id: 'padel-cancellation-by-club',
    segment: 'padel',
    text: 'How does the cancellation rate compare across clubs?',
  },
  {
    id: 'padel-new-vs-returning-this-week',
    segment: 'padel',
    text: 'How many new vs returning players booked this week?',
  },
  {
    id: 'padel-players-at-risk-of-lapsing',
    segment: 'padel',
    text: 'Which players are at risk of lapsing in the next two weeks?',
  },
  {
    id: 'padel-lapsed-players-where-else-they-play',
    segment: 'padel',
    text: 'Where do lapsed Manchester players also play, and how far away?',
  },
  {
    id: 'padel-coach-utilisation',
    segment: 'padel',
    text: 'Which coaches are over- or under-booked, and where?',
  },
  {
    id: 'padel-coach-classes-attendance',
    segment: 'padel',
    text: 'Which coach classes drove the most repeat bookings last month?',
  },
  {
    id: 'padel-cafe-attach-rate-by-club',
    segment: 'padel',
    text: 'What is the cafe attach rate per booking, by club?',
  },
  {
    id: 'padel-cafe-spend-after-session',
    segment: 'padel',
    text: 'What is the average cafe spend after a 90-minute session?',
  },
  {
    id: 'padel-cafe-best-selling-weekend-mornings',
    segment: 'padel',
    text: 'Top selling cafe items on weekend mornings, by club?',
  },
  {
    id: 'padel-cafe-coffee-vs-cold-drinks',
    segment: 'padel',
    text: 'Coffee vs cold drinks split by site this month?',
  },
  {
    id: 'padel-food-revenue-per-booking',
    segment: 'padel',
    text: 'F&B revenue per booking, ranked across clubs?',
  },
  {
    id: 'padel-dwell-time-after-booking',
    segment: 'padel',
    text: 'How long do players stay on site after their booking ends?',
  },
  {
    id: 'padel-compare-manchester-stockport-evenings',
    segment: 'padel',
    text: 'How does Manchester compare to Stockport on weekday evenings?',
  },
  {
    id: 'padel-pricing-where-to-lift-price',
    segment: 'padel',
    text: 'Where could we lift price-per-hour without hurting bookings?',
  },
  {
    id: 'padel-discount-impact-on-occupancy',
    segment: 'padel',
    text: 'What was the occupancy lift after the last off-peak discount?',
  },
  {
    id: 'padel-weather-impact-on-cafe',
    segment: 'padel',
    text: 'How does rain affect cafe revenue on Sundays?',
  },
  {
    id: 'padel-forward-pipeline-vs-typical',
    segment: 'padel',
    text: 'How is the forward 14-day pipeline tracking vs typical?',
  },
  {
    id: 'padel-app-vs-web-booking-mix',
    segment: 'padel',
    text: 'iOS vs Android vs web booking mix, by club?',
  },
  {
    id: 'padel-membership-tier-revenue',
    segment: 'padel',
    text: 'Which membership tier drives the most court revenue?',
  },
  {
    id: 'padel-top-players-by-spend',
    segment: 'padel',
    text: 'Who are our top 20 players by 90-day spend?',
  },
  {
    id: 'padel-tournament-impact-on-bookings',
    segment: 'padel',
    text: 'What is the bookings uplift on weekends with a tournament running?',
  },
];

export function countsBySegment(
  visibleIds?: ReadonlySet<string>,
): Record<QuestionSegment, number> {
  const out: Record<QuestionSegment, number> = {
    sales: 0, cogs: 0, labour: 0, waste: 0, production: 0, padel: 0,
  };
  for (const q of QUESTION_LIBRARY) {
    if (visibleIds && !visibleIds.has(q.id)) continue;
    out[q.segment] += 1;
  }
  return out;
}

export function countsByProductionSubsegment(
  visibleIds?: ReadonlySet<string>,
): Record<ProductionSubsegment, number> {
  const out: Record<ProductionSubsegment, number> = {
    general: 0, 'produced-v-sold': 0, availability: 0, 'closing-range': 0, efficiency: 0,
  };
  for (const q of QUESTION_LIBRARY) {
    if (visibleIds && !visibleIds.has(q.id)) continue;
    if (q.segment === 'production' && q.subsegment) out[q.subsegment] += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Table-shaped questions
// ---------------------------------------------------------------------------
//
// A subset of the curated questions can be answered as a *table* (versus
// today's chart flow). Each entry below maps a question id to a canned
// `TableQuery` over the in-memory mock data sources. Picking a tagged
// question routes through the table flow (Quinn auto-builds the table or the
// library picker hands it directly to the active view).
//
// Coverage is intentionally small (~20 entries) — enough to make the toggle
// useful without aspiring to be exhaustive. Missing questions still work as
// charts via `suggestedChartId` (or fall back to free-text answers).

export const QUESTION_TABLE_QUERIES: Record<string, TableQuery> = {
  // ─── Sales ────────────────────────────────────────────────────────────────
  'sales-what-were-total-sales-across': {
    sources: ['sales'],
    columns: [
      { kind: 'field', field: { source: 'sales', key: 'date' }, header: 'Date' },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'sales', key: 'revenue' },
        header: 'Total revenue',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'sales', key: 'covers' },
        header: 'Covers',
        type: 'integer',
      },
    ],
    groupBy: [{ source: 'sales', key: 'date' }],
    sort: [{ key: 'sales.date', dir: 'desc' }],
    limit: 7,
  },
  'sales-which-site-had-the-highest': {
    sources: ['sales'],
    columns: [
      { kind: 'field', field: { source: 'sales', key: 'site_name' }, header: 'Site' },
      { kind: 'field', field: { source: 'sales', key: 'region' }, header: 'Region' },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'sales', key: 'revenue' },
        header: 'Revenue (30d)',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'avg',
        field: { source: 'sales', key: 'avg_ticket' },
        header: 'Avg ticket',
        type: 'currency',
      },
    ],
    groupBy: [
      { source: 'sales', key: 'site_name' },
      { source: 'sales', key: 'region' },
    ],
    sort: [{ key: 'Revenue (30d)', dir: 'desc' }],
  },
  'sales-what-is-the-average-transaction': {
    sources: ['sales'],
    columns: [
      { kind: 'field', field: { source: 'sales', key: 'site_name' }, header: 'Site' },
      {
        kind: 'agg',
        agg: 'avg',
        field: { source: 'sales', key: 'avg_ticket' },
        header: 'Avg transaction',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'sales', key: 'covers' },
        header: 'Covers',
        type: 'integer',
      },
    ],
    groupBy: [{ source: 'sales', key: 'site_name' }],
    sort: [{ key: 'Avg transaction', dir: 'desc' }],
  },
  'sales-how-does-site-performance-rank': {
    sources: ['sales'],
    columns: [
      { kind: 'field', field: { source: 'sales', key: 'site_name' }, header: 'Site' },
      { kind: 'field', field: { source: 'sales', key: 'region' }, header: 'Region' },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'sales', key: 'revenue' },
        header: 'Revenue',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'sales', key: 'covers' },
        header: 'Covers',
        type: 'integer',
      },
    ],
    groupBy: [
      { source: 'sales', key: 'site_name' },
      { source: 'sales', key: 'region' },
    ],
    sort: [{ key: 'Revenue', dir: 'desc' }],
  },

  // ─── Waste ────────────────────────────────────────────────────────────────
  'waste-what-is-our-total-recorded': {
    sources: ['waste'],
    columns: [
      { kind: 'field', field: { source: 'waste', key: 'site_name' }, header: 'Site' },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'waste', key: 'cost' },
        header: 'Waste cost',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'waste', key: 'qty' },
        header: 'Units',
        type: 'integer',
      },
    ],
    groupBy: [{ source: 'waste', key: 'site_name' }],
    sort: [{ key: 'Waste cost', dir: 'desc' }],
  },
  'waste-what-are-the-top-10': {
    sources: ['waste'],
    columns: [
      { kind: 'field', field: { source: 'waste', key: 'sku' }, header: 'SKU' },
      { kind: 'field', field: { source: 'waste', key: 'category' }, header: 'Category' },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'waste', key: 'cost' },
        header: 'Waste cost',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'waste', key: 'qty' },
        header: 'Units',
        type: 'integer',
      },
    ],
    groupBy: [
      { source: 'waste', key: 'sku' },
      { source: 'waste', key: 'category' },
    ],
    sort: [{ key: 'Waste cost', dir: 'desc' }],
    limit: 10,
  },
  'waste-which-category-generates-the-most': {
    sources: ['waste'],
    columns: [
      { kind: 'field', field: { source: 'waste', key: 'category' }, header: 'Category' },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'waste', key: 'cost' },
        header: 'Waste cost',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'waste', key: 'qty' },
        header: 'Units',
        type: 'integer',
      },
    ],
    groupBy: [{ source: 'waste', key: 'category' }],
    sort: [{ key: 'Waste cost', dir: 'desc' }],
  },
  'waste-which-items-are-most-frequently': {
    sources: ['waste'],
    columns: [
      { kind: 'field', field: { source: 'waste', key: 'reason' }, header: 'Reason' },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'waste', key: 'cost' },
        header: 'Waste cost',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'count',
        field: { source: 'waste', key: 'sku' },
        header: 'Events',
        type: 'integer',
      },
    ],
    groupBy: [{ source: 'waste', key: 'reason' }],
    sort: [{ key: 'Waste cost', dir: 'desc' }],
  },

  // ─── Labour ───────────────────────────────────────────────────────────────
  'labour-what-is-our-total-weekly': {
    sources: ['labour'],
    columns: [
      { kind: 'field', field: { source: 'labour', key: 'site_name' }, header: 'Site' },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'labour', key: 'hours' },
        header: 'Hours',
        type: 'number',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'labour', key: 'cost' },
        header: 'Labour cost',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'labour', key: 'shifts' },
        header: 'Shifts',
        type: 'integer',
      },
    ],
    groupBy: [{ source: 'labour', key: 'site_name' }],
    sort: [{ key: 'Labour cost', dir: 'desc' }],
  },
  'labour-which-role-type-accounts-for': {
    sources: ['labour'],
    columns: [
      { kind: 'field', field: { source: 'labour', key: 'site_name' }, header: 'Site' },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'labour', key: 'manager_hours' },
        header: 'Manager hrs',
        type: 'number',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'labour', key: 'barista_hours' },
        header: 'Barista hrs',
        type: 'number',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'labour', key: 'kitchen_hours' },
        header: 'Kitchen hrs',
        type: 'number',
      },
    ],
    groupBy: [{ source: 'labour', key: 'site_name' }],
    sort: [{ key: 'Barista hrs', dir: 'desc' }],
  },
  'labour-which-site-has-the-best': {
    // Cross-source: revenue per labour hour. Joins sales + labour on site/date,
    // then aggregates per site.
    sources: ['sales', 'labour'],
    joins: [
      {
        rightSource: 'labour',
        on: [
          { leftKey: 'site_id', rightKey: 'site_id' },
          { leftKey: 'date', rightKey: 'date' },
        ],
      },
    ],
    columns: [
      { kind: 'field', field: { source: 'sales', key: 'site_name' }, header: 'Site' },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'sales', key: 'revenue' },
        header: 'Revenue',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'labour', key: 'cost' },
        header: 'Labour cost',
        type: 'currency',
      },
    ],
    groupBy: [{ source: 'sales', key: 'site_name' }],
    sort: [{ key: 'Revenue', dir: 'desc' }],
  },

  // ─── COGS / Flash report (single-source) ──────────────────────────────────
  'cogs-which-sites-are-consistently-over': {
    sources: ['flashReport'],
    columns: [
      { kind: 'field', field: { source: 'flashReport', key: 'name' }, header: 'Name' },
      { kind: 'field', field: { source: 'flashReport', key: 'dm' }, header: 'DM' },
      {
        kind: 'field',
        field: { source: 'flashReport', key: 'food_supply_cost_sales_pct' },
        header: 'Food cost %',
      },
      {
        kind: 'field',
        field: { source: 'flashReport', key: 'total_sales' },
        header: 'Total sales',
      },
    ],
    filters: [
      {
        field: { source: 'flashReport', key: 'food_supply_cost_sales_pct' },
        op: 'gt',
        value: 30,
      },
    ],
    sort: [{ key: 'flashReport.food_supply_cost_sales_pct', dir: 'desc' }],
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Dunkin demo overlay (MVP-1 only)
// ────────────────────────────────────────────────────────────────────────────
//
// The Dunkin persona's question library should ONLY surface questions that
// can be answered with the uploaded Dunkin franchise CSVs. The objects below
// carry the table queries and chart-id overrides for that persona.
//
// At runtime, the helpers in this file accept an optional `BriefingRole`
// argument: when role === 'dunkin', the overlay is consulted first; otherwise
// every other demo (Estate, Manager, Playtomic, …) sees zero behaviour
// change. Keep the legacy `QUESTION_LIBRARY` and `QUESTION_TABLE_QUERIES`
// untouched.

export const DUNKIN_QUESTION_TABLE_QUERIES: Record<string, TableQuery> = {
  // ── Sales ────────────────────────────────────────────────────────────────
  'sales-what-were-total-sales-across': {
    sources: ['weeklyFlashTotals'],
    columns: [
      { kind: 'field', field: { source: 'weeklyFlashTotals', key: 'week_number' }, header: 'Week No.' },
      { kind: 'field', field: { source: 'weeklyFlashTotals', key: 'week_start_date' }, header: 'Start Date' },
      { kind: 'field', field: { source: 'weeklyFlashTotals', key: 'week_end_date' }, header: 'End Date' },
      { kind: 'field', field: { source: 'weeklyFlashTotals', key: 'overall_total' }, header: 'Overall total' },
      { kind: 'field', field: { source: 'weeklyFlashTotals', key: 'ec_total' }, header: 'EC total' },
      { kind: 'field', field: { source: 'weeklyFlashTotals', key: 'non_ec_total' }, header: 'Non-EC total' },
    ],
    sort: [{ key: 'weeklyFlashTotals.week_start_date', dir: 'desc' }],
    limit: 12,
  },
  'sales-which-site-had-the-highest': {
    sources: ['weeklySalesBySite'],
    columns: [
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'location' }, header: 'Location' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'name' }, header: 'Name' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'dm' }, header: 'DM' },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'weeklySalesBySite', key: 'total_sales' },
        header: 'Total sales',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'weeklySalesBySite', key: 'customer_count' },
        header: 'Customers',
        type: 'integer',
      },
      {
        kind: 'agg',
        agg: 'avg',
        field: { source: 'weeklySalesBySite', key: 'average_ticket' },
        header: 'Avg ticket',
        type: 'currency',
      },
    ],
    groupBy: [
      { source: 'weeklySalesBySite', key: 'location' },
      { source: 'weeklySalesBySite', key: 'name' },
      { source: 'weeklySalesBySite', key: 'dm' },
    ],
    sort: [{ key: 'Total sales', dir: 'desc' }],
    limit: 50,
  },
  'sales-how-did-sales-perform-this': {
    sources: ['weeklySalesBySite'],
    columns: [
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'location' }, header: 'Location' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'name' }, header: 'Name' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'dm' }, header: 'DM' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'week_number' }, header: 'Week No.' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'total_sales' }, header: 'Total sales' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'total_sales_ly' }, header: 'Total sales LY' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'total_sales_ly_pct' }, header: 'Total LY %' },
    ],
    sort: [
      { key: 'weeklySalesBySite.week_start_date', dir: 'desc' },
      { key: 'weeklySalesBySite.total_sales', dir: 'desc' },
    ],
    limit: 60,
  },
  'sales-what-is-the-average-transaction': {
    sources: ['flashReport'],
    columns: [
      { kind: 'field', field: { source: 'flashReport', key: 'location' }, header: 'Location' },
      { kind: 'field', field: { source: 'flashReport', key: 'name' }, header: 'Name' },
      {
        kind: 'agg',
        agg: 'avg',
        field: { source: 'flashReport', key: 'average_ticket' },
        header: 'Avg transaction',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'flashReport', key: 'customer_count' },
        header: 'Customers',
        type: 'integer',
      },
    ],
    groupBy: [
      { source: 'flashReport', key: 'location' },
      { source: 'flashReport', key: 'name' },
    ],
    sort: [{ key: 'Avg transaction', dir: 'desc' }],
    limit: 50,
  },
  'sales-how-has-revenue-trended-over': {
    sources: ['weeklyFlashTotals'],
    columns: [
      { kind: 'field', field: { source: 'weeklyFlashTotals', key: 'week_number' }, header: 'Week No.' },
      { kind: 'field', field: { source: 'weeklyFlashTotals', key: 'week_start_date' }, header: 'Start Date' },
      { kind: 'field', field: { source: 'weeklyFlashTotals', key: 'overall_total' }, header: 'Overall total' },
    ],
    sort: [{ key: 'weeklyFlashTotals.week_start_date', dir: 'desc' }],
    limit: 12,
  },
  'sales-which-product-category-generates-the': {
    sources: ['dailySalesByProductFamily'],
    columns: [
      {
        kind: 'field',
        field: { source: 'dailySalesByProductFamily', key: 'major_group_name' },
        header: 'Major group',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'dailySalesByProductFamily', key: 'gross_sales' },
        header: 'Gross sales',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'dailySalesByProductFamily', key: 'qty' },
        header: 'Quantity',
        type: 'integer',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'dailySalesByProductFamily', key: 'transaction_count' },
        header: 'Transactions',
        type: 'integer',
      },
    ],
    groupBy: [{ source: 'dailySalesByProductFamily', key: 'major_group_name' }],
    sort: [{ key: 'Gross sales', dir: 'desc' }],
  },
  'sales-which-site-has-shown-the': {
    sources: ['weeklySalesBySite'],
    columns: [
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'location' }, header: 'Location' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'name' }, header: 'Name' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'dm' }, header: 'DM' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'week_number' }, header: 'Week No.' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'total_sales_ly_pct' }, header: 'Growth vs LY %' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'total_sales' }, header: 'Total sales' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'total_sales_ly' }, header: 'Total sales LY' },
    ],
    sort: [
      { key: 'weeklySalesBySite.total_sales_ly_pct', dir: 'desc' },
    ],
    limit: 25,
  },
  'sales-what-is-the-revenue-per': {
    sources: ['flashReport'],
    columns: [
      { kind: 'field', field: { source: 'flashReport', key: 'location' }, header: 'Location' },
      { kind: 'field', field: { source: 'flashReport', key: 'name' }, header: 'Name' },
      { kind: 'field', field: { source: 'flashReport', key: 'week_number' }, header: 'Week No.' },
      { kind: 'field', field: { source: 'flashReport', key: 'total_sales' }, header: 'Total sales' },
      { kind: 'field', field: { source: 'flashReport', key: 'labor_hours' }, header: 'Labor hrs' },
      { kind: 'field', field: { source: 'flashReport', key: 'labor_earnings' }, header: 'Labor $' },
      { kind: 'field', field: { source: 'flashReport', key: 'labor_sales_pct' }, header: 'Labor %' },
    ],
    sort: [
      { key: 'flashReport.week_number', dir: 'desc' },
      { key: 'flashReport.total_sales', dir: 'desc' },
    ],
    limit: 60,
  },
  'sales-what-is-the-average-basket': {
    sources: ['flashReport'],
    columns: [
      { kind: 'field', field: { source: 'flashReport', key: 'location' }, header: 'Location' },
      { kind: 'field', field: { source: 'flashReport', key: 'name' }, header: 'Name' },
      {
        kind: 'agg',
        agg: 'avg',
        field: { source: 'flashReport', key: 'average_ticket' },
        header: 'Avg basket',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'flashReport', key: 'customer_count' },
        header: 'Customers',
        type: 'integer',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'flashReport', key: 'total_sales' },
        header: 'Total sales',
        type: 'currency',
      },
    ],
    groupBy: [
      { source: 'flashReport', key: 'location' },
      { source: 'flashReport', key: 'name' },
    ],
    sort: [{ key: 'Avg basket', dir: 'desc' }],
    limit: 50,
  },
  'sales-how-does-site-performance-rank': {
    sources: ['weeklySalesBySite'],
    columns: [
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'location' }, header: 'Location' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'name' }, header: 'Name' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'dm' }, header: 'DM' },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'weeklySalesBySite', key: 'total_sales' },
        header: 'Total sales',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'avg',
        field: { source: 'weeklySalesBySite', key: 'average_ticket' },
        header: 'Avg ticket',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'weeklySalesBySite', key: 'customer_count' },
        header: 'Customers',
        type: 'integer',
      },
    ],
    groupBy: [
      { source: 'weeklySalesBySite', key: 'location' },
      { source: 'weeklySalesBySite', key: 'name' },
      { source: 'weeklySalesBySite', key: 'dm' },
    ],
    sort: [{ key: 'Total sales', dir: 'desc' }],
    limit: 50,
  },
  'sales-which-sites-underperformed-against-their': {
    sources: ['weeklySalesBySite'],
    columns: [
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'location' }, header: 'Location' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'name' }, header: 'Name' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'dm' }, header: 'DM' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'week_number' }, header: 'Week No.' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'total_sales' }, header: 'Total sales' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'total_sales_ly' }, header: 'Total sales LY' },
      { kind: 'field', field: { source: 'weeklySalesBySite', key: 'total_sales_ly_pct' }, header: 'Total LY %' },
    ],
    filters: [
      {
        field: { source: 'weeklySalesBySite', key: 'total_sales_ly_pct' },
        op: 'lt',
        value: 0,
      },
    ],
    sort: [{ key: 'weeklySalesBySite.total_sales_ly_pct', dir: 'asc' }],
    limit: 50,
  },
  'sales-how-has-our-average-transaction': {
    sources: ['flashReport'],
    columns: [
      { kind: 'field', field: { source: 'flashReport', key: 'week_number' }, header: 'Week No.' },
      { kind: 'field', field: { source: 'flashReport', key: 'week_start_date' }, header: 'Start Date' },
      {
        kind: 'agg',
        agg: 'avg',
        field: { source: 'flashReport', key: 'average_ticket' },
        header: 'Avg ticket',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'flashReport', key: 'customer_count' },
        header: 'Customers',
        type: 'integer',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'flashReport', key: 'total_sales' },
        header: 'Total sales',
        type: 'currency',
      },
    ],
    groupBy: [
      { source: 'flashReport', key: 'week_number' },
      { source: 'flashReport', key: 'week_start_date' },
    ],
    sort: [{ key: 'flashReport.week_start_date', dir: 'desc' }],
    limit: 13,
  },
  // ── COGS ─────────────────────────────────────────────────────────────────
  'cogs-what-is-our-cogs-as': {
    sources: ['flashReport'],
    columns: [
      { kind: 'field', field: { source: 'flashReport', key: 'location' }, header: 'Location' },
      { kind: 'field', field: { source: 'flashReport', key: 'name' }, header: 'Name' },
      {
        kind: 'agg',
        agg: 'avg',
        field: { source: 'flashReport', key: 'food_supply_cost_sales_pct' },
        header: 'Food cost %',
        type: 'percent',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'flashReport', key: 'food_supply_cost' },
        header: 'Food cost $',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'flashReport', key: 'total_sales' },
        header: 'Total sales',
        type: 'currency',
      },
    ],
    groupBy: [
      { source: 'flashReport', key: 'location' },
      { source: 'flashReport', key: 'name' },
    ],
    sort: [{ key: 'Food cost %', dir: 'desc' }],
    limit: 50,
  },
  'cogs-how-has-our-overall-cogs': {
    sources: ['flashReport'],
    columns: [
      { kind: 'field', field: { source: 'flashReport', key: 'week_number' }, header: 'Week No.' },
      { kind: 'field', field: { source: 'flashReport', key: 'week_start_date' }, header: 'Start Date' },
      {
        kind: 'agg',
        agg: 'avg',
        field: { source: 'flashReport', key: 'food_supply_cost_sales_pct' },
        header: 'Food cost %',
        type: 'percent',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'flashReport', key: 'food_supply_cost' },
        header: 'Food cost $',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'flashReport', key: 'total_sales' },
        header: 'Total sales',
        type: 'currency',
      },
    ],
    groupBy: [
      { source: 'flashReport', key: 'week_number' },
      { source: 'flashReport', key: 'week_start_date' },
    ],
    sort: [{ key: 'flashReport.week_start_date', dir: 'desc' }],
    limit: 12,
  },
  'cogs-which-sites-are-consistently-over': {
    sources: ['flashReport'],
    columns: [
      { kind: 'field', field: { source: 'flashReport', key: 'location' }, header: 'Location' },
      { kind: 'field', field: { source: 'flashReport', key: 'name' }, header: 'Name' },
      { kind: 'field', field: { source: 'flashReport', key: 'dm' }, header: 'DM' },
      { kind: 'field', field: { source: 'flashReport', key: 'week_number' }, header: 'Week No.' },
      {
        kind: 'field',
        field: { source: 'flashReport', key: 'food_supply_cost' },
        header: 'Food cost $',
      },
      {
        kind: 'field',
        field: { source: 'flashReport', key: 'food_supply_cost_sales_pct' },
        header: 'Food cost %',
      },
      { kind: 'field', field: { source: 'flashReport', key: 'total_sales' }, header: 'Total sales' },
    ],
    filters: [
      {
        field: { source: 'flashReport', key: 'food_supply_cost_sales_pct' },
        op: 'gt',
        value: 30,
      },
    ],
    sort: [{ key: 'flashReport.food_supply_cost_sales_pct', dir: 'desc' }],
    limit: 50,
  },
  // ── Labour ───────────────────────────────────────────────────────────────
  'labour-what-is-labour-as-a': {
    sources: ['flashReport'],
    columns: [
      { kind: 'field', field: { source: 'flashReport', key: 'location' }, header: 'Location' },
      { kind: 'field', field: { source: 'flashReport', key: 'name' }, header: 'Name' },
      {
        kind: 'agg',
        agg: 'avg',
        field: { source: 'flashReport', key: 'labor_sales_pct' },
        header: 'Labor %',
        type: 'percent',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'flashReport', key: 'labor_earnings' },
        header: 'Labor $',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'flashReport', key: 'total_sales' },
        header: 'Total sales',
        type: 'currency',
      },
    ],
    groupBy: [
      { source: 'flashReport', key: 'location' },
      { source: 'flashReport', key: 'name' },
    ],
    sort: [{ key: 'Labor %', dir: 'desc' }],
    limit: 50,
  },
  'labour-which-site-has-the-highest': {
    sources: ['flashReport'],
    columns: [
      { kind: 'field', field: { source: 'flashReport', key: 'location' }, header: 'Location' },
      { kind: 'field', field: { source: 'flashReport', key: 'name' }, header: 'Name' },
      { kind: 'field', field: { source: 'flashReport', key: 'week_number' }, header: 'Week No.' },
      { kind: 'field', field: { source: 'flashReport', key: 'labor_earnings' }, header: 'Labor $' },
      { kind: 'field', field: { source: 'flashReport', key: 'customer_count' }, header: 'Customers' },
      { kind: 'field', field: { source: 'flashReport', key: 'labor_sales_pct' }, header: 'Labor %' },
    ],
    sort: [{ key: 'flashReport.labor_earnings', dir: 'desc' }],
    limit: 50,
  },
  'labour-what-is-the-average-hourly': {
    sources: ['weeklyLaborCosts'],
    columns: [
      { kind: 'field', field: { source: 'weeklyLaborCosts', key: 'location' }, header: 'Location' },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'weeklyLaborCosts', key: 'gross_pay' },
        header: 'Gross pay',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'weeklyLaborCosts', key: 'total_hours' },
        header: 'Total hrs',
        type: 'number',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'weeklyLaborCosts', key: 'overtime_hours_total' },
        header: 'OT hrs',
        type: 'number',
      },
    ],
    groupBy: [{ source: 'weeklyLaborCosts', key: 'location' }],
    sort: [{ key: 'Total hrs', dir: 'desc' }],
    limit: 50,
  },
  'labour-how-many-overtime-hours-were': {
    sources: ['weeklyLaborCosts'],
    columns: [
      { kind: 'field', field: { source: 'weeklyLaborCosts', key: 'location' }, header: 'Location' },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'weeklyLaborCosts', key: 'overtime_hours_total' },
        header: 'OT hrs',
        type: 'number',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'weeklyLaborCosts', key: 'overtime_earnings_total' },
        header: 'OT $',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'weeklyLaborCosts', key: 'total_hours' },
        header: 'Total hrs',
        type: 'number',
      },
    ],
    groupBy: [{ source: 'weeklyLaborCosts', key: 'location' }],
    sort: [{ key: 'OT hrs', dir: 'desc' }],
    limit: 50,
  },
  'labour-which-site-has-the-best': {
    sources: ['flashReport'],
    columns: [
      { kind: 'field', field: { source: 'flashReport', key: 'location' }, header: 'Location' },
      { kind: 'field', field: { source: 'flashReport', key: 'name' }, header: 'Name' },
      { kind: 'field', field: { source: 'flashReport', key: 'week_number' }, header: 'Week No.' },
      { kind: 'field', field: { source: 'flashReport', key: 'total_sales' }, header: 'Total sales' },
      { kind: 'field', field: { source: 'flashReport', key: 'labor_earnings' }, header: 'Labor $' },
      { kind: 'field', field: { source: 'flashReport', key: 'labor_sales_pct' }, header: 'Labor %' },
    ],
    sort: [{ key: 'flashReport.labor_sales_pct', dir: 'asc' }],
    limit: 50,
  },
  'labour-what-is-our-total-weekly': {
    sources: ['weeklyLaborCosts'],
    columns: [
      { kind: 'field', field: { source: 'weeklyLaborCosts', key: 'location' }, header: 'Location' },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'weeklyLaborCosts', key: 'gross_pay' },
        header: 'Gross pay',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'weeklyLaborCosts', key: 'total_hours' },
        header: 'Total hrs',
        type: 'number',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'weeklyLaborCosts', key: 'overtime_earnings_total' },
        header: 'OT $',
        type: 'currency',
      },
    ],
    groupBy: [{ source: 'weeklyLaborCosts', key: 'location' }],
    sort: [{ key: 'Gross pay', dir: 'desc' }],
    limit: 50,
  },
  'labour-how-has-our-labour-trended': {
    sources: ['flashReport'],
    columns: [
      { kind: 'field', field: { source: 'flashReport', key: 'week_number' }, header: 'Week No.' },
      { kind: 'field', field: { source: 'flashReport', key: 'week_start_date' }, header: 'Start Date' },
      {
        kind: 'agg',
        agg: 'avg',
        field: { source: 'flashReport', key: 'labor_sales_pct' },
        header: 'Labor %',
        type: 'percent',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'flashReport', key: 'labor_earnings' },
        header: 'Labor $',
        type: 'currency',
      },
      {
        kind: 'agg',
        agg: 'sum',
        field: { source: 'flashReport', key: 'total_sales' },
        header: 'Total sales',
        type: 'currency',
      },
    ],
    groupBy: [
      { source: 'flashReport', key: 'week_number' },
      { source: 'flashReport', key: 'week_start_date' },
    ],
    sort: [{ key: 'flashReport.week_start_date', dir: 'desc' }],
    limit: 12,
  },
};

/** Chart-id overrides applied for the Dunkin demo only. Each id matches a
 *  CSV-backed chart in `DunkinAnalyticsCharts.tsx`. */
export const DUNKIN_QUESTION_CHART_OVERRIDES: Record<string, DunkinAnalyticsChartId> = {
  // Sales
  'sales-what-were-total-sales-across': 'dunkin-total-sales-last-week',
  'sales-which-site-had-the-highest': 'dunkin-top-stores-30d',
  'sales-how-did-sales-perform-this': 'dunkin-lfl-vs-ly',
  'sales-what-is-the-average-transaction': 'dunkin-avg-ticket-by-site',
  'sales-how-has-revenue-trended-over': 'dunkin-revenue-trend-12wk',
  'sales-which-product-category-generates-the': 'dunkin-product-category-sales',
  'sales-which-site-has-shown-the': 'dunkin-mom-growth-by-site',
  'sales-what-is-the-revenue-per': 'dunkin-revenue-per-labour-hour',
  'sales-what-is-the-average-basket': 'dunkin-basket-size-by-site',
  'sales-how-does-site-performance-rank': 'dunkin-site-rank-vs-network',
  'sales-which-sites-underperformed-against-their': 'dunkin-underperformers',
  'sales-how-has-our-average-transaction': 'dunkin-avg-ticket-trend',
  // COGS
  'cogs-what-is-our-cogs-as': 'dunkin-food-cost-pct-by-site',
  'cogs-how-has-our-overall-cogs': 'dunkin-food-cost-pct-trend',
  'cogs-which-sites-are-consistently-over': 'dunkin-food-cost-over-30',
  // Labour
  'labour-what-is-labour-as-a': 'dunkin-labour-pct-by-site',
  'labour-which-site-has-the-highest': 'dunkin-labour-cost-per-txn',
  'labour-what-is-the-average-hourly': 'dunkin-avg-hourly-labour-cost',
  'labour-how-many-overtime-hours-were': 'dunkin-overtime-by-week',
  'labour-which-site-has-the-best': 'dunkin-revenue-to-labour',
  'labour-what-is-our-total-weekly': 'dunkin-weekly-labour-by-site',
  'labour-how-has-our-labour-trended': 'dunkin-labour-pct-trend',
};

/** Set of question ids the Dunkin demo can answer end-to-end. Used by the
 *  question-library picker to filter the visible list when role==='dunkin'. */
export const DUNKIN_WIRED_QUESTION_IDS: ReadonlySet<string> = new Set(
  Object.keys(DUNKIN_QUESTION_TABLE_QUERIES),
);

/** Persona type — kept narrow here to avoid pulling the full BriefingRole
 *  union into this file (it's strict-equal compared as a string). */
type PersonaRole = string | undefined;

function isDunkin(role: PersonaRole): boolean {
  return role === 'dunkin';
}

export function getQuestionTableQuery(
  id: string,
  role?: PersonaRole,
): TableQuery | null {
  if (isDunkin(role) && id in DUNKIN_QUESTION_TABLE_QUERIES) {
    return DUNKIN_QUESTION_TABLE_QUERIES[id]!;
  }
  return QUESTION_TABLE_QUERIES[id] ?? null;
}

/** Returns the chart id to use for a given entry, layered for the Dunkin
 *  persona. Other roles always see the curated `suggestedChartId`. */
export function resolveSuggestedChartId(
  entry: QuestionEntry,
  role?: PersonaRole,
): AnalyticsChartId | null {
  if (isDunkin(role) && entry.id in DUNKIN_QUESTION_CHART_OVERRIDES) {
    return DUNKIN_QUESTION_CHART_OVERRIDES[entry.id]!;
  }
  return entry.suggestedChartId ?? null;
}

export function questionShape(
  entry: QuestionEntry,
  role?: PersonaRole,
): QuestionShape {
  if (isDunkin(role)) {
    const hasTable = entry.id in DUNKIN_QUESTION_TABLE_QUERIES;
    const hasChart = entry.id in DUNKIN_QUESTION_CHART_OVERRIDES;
    if (hasTable && hasChart) return 'both';
    if (hasTable) return 'table';
    if (hasChart) return 'chart';
    // Dunkin-unwired questions fall through to the legacy hint so the popup's
    // generic "ask Quinn in chat" path can still pick them up if they slip in.
  }
  const hasTable = entry.id in QUESTION_TABLE_QUERIES;
  const hasChart = Boolean(entry.suggestedChartId);
  if (hasTable && hasChart) return 'both';
  if (hasTable) return 'table';
  return 'chart';
}

export function searchQuestions(
  query: string,
  segment?: QuestionSegment,
  subsegment?: ProductionSubsegment,
  shape?: QuestionShape,
  role?: PersonaRole,
): QuestionEntry[] {
  const q = query.trim().toLowerCase();
  return QUESTION_LIBRARY.filter((entry) => {
    // Dunkin demo only surfaces questions we have CSV data for. Every other
    // demo continues to see the full curated library.
    if (isDunkin(role) && !DUNKIN_WIRED_QUESTION_IDS.has(entry.id)) return false;
    if (segment && entry.segment !== segment) return false;
    if (subsegment && entry.subsegment !== subsegment) return false;
    if (shape) {
      const s = questionShape(entry, role);
      if (shape === 'table' && s === 'chart') return false;
      if (shape === 'chart' && s === 'table') return false;
      // 'both' filter is unusual; treat as "no shape filter"
    }
    if (!q) return true;
    return entry.text.toLowerCase().includes(q);
  });
}

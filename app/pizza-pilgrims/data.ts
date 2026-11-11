import {
  Banknote,
  BookOpen,
  CalendarDays,
  ChartColumn,
  ChartPie,
  ClipboardCheck,
  Clock,
  FileText,
  Layers,
  MessageSquare,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Smile,
  Star,
  Store,
  Thermometer,
  Trash2,
  TrendingUp,
  Truck,
  UserRound,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type Tone = 'blue' | 'navy' | 'red' | 'green' | 'amber' | 'edify';

export type Tile = {
  title: string;
  description: string;
  icon: LucideIcon;
  tone: Tone;
  /** Prototype route. Only Edify tiles have one; Joshua's own reports stay put. */
  href?: string;
};

export type TileGroup = {
  heading: string;
  edify?: boolean;
  intro?: string;
  /** Header link to another portal view, e.g. the full Edify page. */
  more?: { label: string; view: ViewId };
  tiles: Tile[];
};

export type ViewId =
  | 'dashboard'
  | 'people'
  | 'feedback'
  | 'operations'
  | 'edify'
  | 'bot'
  | 'settings';

export const EDIFY_TILES: Tile[] = [
  {
    title: 'Command Centre',
    description: 'What needs doing today across every pizzeria',
    icon: Layers,
    tone: 'edify',
    href: '/',
  },
  {
    title: 'Stocktakes',
    description: 'Count stock by voice or tap, one storage area at a time',
    icon: ClipboardCheck,
    tone: 'edify',
    href: '/stock',
  },
  {
    title: 'Ordering',
    description: 'Suggested orders from par levels and the sales forecast',
    icon: ShoppingCart,
    tone: 'edify',
    href: '/assisted-ordering',
  },
  {
    title: 'Deliveries',
    description: 'Photo the delivery note, check it against the order',
    icon: Truck,
    tone: 'edify',
    href: '/receive',
  },
  {
    title: 'Invoices',
    description: 'Match supplier invoices to deliveries and spot price changes',
    icon: Receipt,
    tone: 'edify',
    href: '/invoices',
  },
  {
    title: 'Recipes and Costing',
    description: 'Dough, sauces and pizzas costed to the gram, with allergens',
    icon: BookOpen,
    tone: 'edify',
    href: '/recipes',
  },
  {
    title: 'GP and COGS',
    description: 'Theoretical vs actual GP by pizzeria',
    icon: ChartPie,
    tone: 'edify',
    href: '/cogs',
  },
  {
    title: 'Waste',
    description: 'Log waste in seconds and see what it costs',
    icon: Trash2,
    tone: 'edify',
    href: '/log-waste',
  },
  {
    title: 'Checklists and HACCP',
    description: 'Opening, closing and fridge temperature checks',
    icon: Thermometer,
    tone: 'edify',
    href: '/checklists',
  },
  {
    title: 'Finance Controls',
    description: 'Contract price alerts, month-end accruals and the audit trail',
    icon: ShieldCheck,
    tone: 'edify',
    href: '/finance-controls',
  },
];

const OPERATIONS_EDIFY_TILES = ['Command Centre', 'Stocktakes', 'Ordering', 'GP and COGS'];

const OPERATIONS_EDIFY_GROUP: TileGroup = {
  heading: 'Kitchen and Stock',
  edify: true,
  more: { label: `See all ${EDIFY_TILES.length}`, view: 'edify' },
  tiles: EDIFY_TILES.filter((t) => OPERATIONS_EDIFY_TILES.includes(t.title)),
};

const EDIFY_GROUP: TileGroup = {
  heading: 'Edify',
  intro:
    'Stock, ordering, recipes and GP for every pizzeria. Edify runs the kitchen side, Joshua keeps it all in one place.',
  tiles: EDIFY_TILES,
};

export const VIEW_GROUPS: Record<Exclude<ViewId, 'bot' | 'settings'>, TileGroup[]> = {
  operations: [
    OPERATIONS_EDIFY_GROUP,
    {
      heading: 'Energy Reporting',
      tiles: [
        { title: 'Cap Energy Report', description: 'View energy usage by location', icon: FileText, tone: 'blue' },
      ],
    },
    {
      heading: 'Other',
      tiles: [
        { title: 'Daily Morning Report', description: 'Daily morning report with forecast accuracy', icon: Store, tone: 'navy' },
        { title: 'Day Part Report', description: 'View net and covers by day part with Order Type split', icon: CalendarDays, tone: 'red' },
        { title: 'Discounts By Profit Centre', description: 'View discounts per day by location', icon: Banknote, tone: 'red' },
        { title: 'Ops KPIs 2025', description: 'Ops KPI report for FY 2025', icon: Store, tone: 'green' },
        { title: 'Sales vs Budget', description: 'Weekly net sales against budget by location', icon: TrendingUp, tone: 'amber' },
        { title: 'Delivery Platforms', description: 'Deliveroo, Uber Eats and Just Eat sales by location', icon: Zap, tone: 'blue' },
      ],
    },
  ],
  edify: [EDIFY_GROUP],
  dashboard: [
    {
      heading: 'Finance',
      edify: true,
      tiles: EDIFY_TILES.filter((t) => t.title === 'Finance Controls'),
    },
    {
      heading: 'Trading',
      tiles: [
        { title: 'Weekly Flash', description: 'Net sales, covers and spend per head by location', icon: ChartColumn, tone: 'navy' },
        { title: 'Like for Like', description: 'This year vs last year by location', icon: TrendingUp, tone: 'green' },
        { title: 'Covers by Hour', description: 'Covers by hour for the last 7 days', icon: Clock, tone: 'amber' },
        { title: 'Average Spend', description: 'Spend per head by location and day part', icon: Banknote, tone: 'red' },
      ],
    },
  ],
  people: [
    {
      heading: 'Labour',
      tiles: [
        { title: 'Labour vs Sales', description: 'Labour cost as a % of net sales by location', icon: Users, tone: 'navy' },
        { title: 'Rota vs Actual', description: 'Scheduled hours against clocked hours', icon: CalendarDays, tone: 'red' },
        { title: 'Headcount', description: 'Team members by location and role', icon: UserRound, tone: 'green' },
        { title: 'Holiday Tracker', description: 'Holiday booked and remaining by team member', icon: Clock, tone: 'amber' },
      ],
    },
  ],
  feedback: [
    {
      heading: 'Reviews',
      tiles: [
        { title: 'Google Reviews', description: 'Star rating and new reviews by location', icon: Star, tone: 'amber' },
        { title: 'Feedback by Location', description: 'Guest feedback themes by location', icon: MessageSquare, tone: 'navy' },
        { title: 'Delivery Ratings', description: 'Ratings across delivery platforms', icon: Smile, tone: 'green' },
      ],
    },
  ],
};

export type BotAnswer = {
  id: string;
  question: string;
  /** Lowercase words that route a typed question to this answer. */
  keywords: string[];
  answer: string;
  source: string;
  href: string;
};

export const BOT_ANSWERS: BotAnswer[] = [
  {
    id: 'gp',
    question: 'Which pizzerias missed GP target last week?',
    keywords: ['gp', 'margin', 'target', 'profit'],
    answer:
      'Three pizzerias came in under the 74% target last week: Shoreditch at 71.8%, Camden at 72.4% and Canary Wharf at 73.1%. Most of the Shoreditch gap is fior di latte, where usage ran 9% over what the recipes say it should be.',
    source: 'GP and COGS',
    href: '/cogs',
  },
  {
    id: 'order',
    question: 'What do I need to order for Kingly Court tomorrow?',
    keywords: ['order', 'kingly', 'tomorrow', 'buy'],
    answer:
      'Kingly Court has a suggested order ready: 6 cases of fior di latte, 4 tins of San Marzano tomatoes, 2 sacks of 00 flour and 1 case of nduja. It comes from par levels and Saturday\'s forecast, so it only needs a check before it goes to the supplier.',
    source: 'Ordering',
    href: '/assisted-ordering',
  },
  {
    id: 'stocktake',
    question: 'Has every site finished its stocktake?',
    keywords: ['stocktake', 'stock', 'count', 'counted'],
    answer:
      '7 of 8 pizzerias finished Sunday\'s count. Brighton hasn\'t started yet, and its GP for the week can\'t close until it does.',
    source: 'Stocktakes',
    href: '/stock',
  },
  {
    id: 'waste',
    question: 'What did we waste most this week?',
    keywords: ['waste', 'wasted', 'binned', 'bin'],
    answer:
      'Dough balls, by a distance: 214 binned across the group, worth £96. Covent Garden accounts for 40% of that, mostly at close on Tuesday and Wednesday.',
    source: 'Waste',
    href: '/log-waste',
  },
  {
    id: 'price',
    question: 'Has the price of fior di latte gone up?',
    keywords: ['price', 'fior', 'mozzarella', 'cost', 'invoice'],
    answer:
      'Yes. The last invoice charged £8.90 a kg, up from £8.40. That adds about 4p to every Margherita, and Edify has already updated the recipe costs.',
    source: 'Invoices',
    href: '/invoices',
  },
];

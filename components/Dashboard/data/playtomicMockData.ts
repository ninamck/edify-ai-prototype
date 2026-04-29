// Mock data for the Playtomic padel demo dashboard.
// Numbers and labels are tuned to match the two reference screenshots so the
// pitch dashboard reads as a believable, real chain.

export type VenueStatus = 'red' | 'amber' | 'green';

export interface ChainKpi {
  id: 'revenue' | 'bookings' | 'occupancy' | 'cancellation' | 'active-players';
  label: string;
  value: string;
  delta: string;
  /** Direction tells us whether the delta should render as positive or negative. */
  direction: 'up' | 'down';
  /** "Bad" deltas (rising cancellation, falling occupancy) flip green/red colouring. */
  invert?: boolean;
}

export const CHAIN_KPIS: ChainKpi[] = [
  { id: 'revenue', label: 'Revenue', value: '£122,940', delta: '+4.2%', direction: 'up' },
  { id: 'bookings', label: 'Bookings', value: '2,830', delta: '+1.8%', direction: 'up' },
  { id: 'occupancy', label: 'Occupancy', value: '70%', delta: '−2.1 pts', direction: 'down', invert: true },
  { id: 'cancellation', label: 'Cancellation', value: '6.4%', delta: '+0.9 pts', direction: 'up', invert: true },
  { id: 'active-players', label: 'Active players', value: '7,840', delta: '+184', direction: 'up' },
];

export interface VenueRow {
  name: string;
  status: VenueStatus;
  occPct: number;
  revenue: number;
  pricePerHr: number;
  cancelPct: number;
  newPlayers: number;
  repeatPct: number;
  /** Week-over-week delta in points. Positive = improving. */
  wow: number;
}

export const VENUES: VenueRow[] = [
  { name: 'Manchester',   status: 'red',   occPct: 54, revenue: 14210, pricePerHr: 18, cancelPct: 11.2, newPlayers: 23, repeatPct: 38, wow: -9 },
  { name: 'Nottingham',   status: 'amber', occPct: 62, revenue: 15820, pricePerHr: 22, cancelPct: 7.8,  newPlayers: 52, repeatPct: 44, wow: 8 },
  { name: 'Darlington',   status: 'amber', occPct: 67, revenue: 16400, pricePerHr: 24, cancelPct: 6.1,  newPlayers: 18, repeatPct: 58, wow: 1 },
  { name: 'Lightwater',   status: 'green', occPct: 69, revenue: 17140, pricePerHr: 24, cancelPct: 5.4,  newPlayers: 31, repeatPct: 61, wow: 4 },
  { name: 'Stockport',    status: 'green', occPct: 73, revenue: 18220, pricePerHr: 26, cancelPct: 5.1,  newPlayers: 24, repeatPct: 64, wow: 2 },
  { name: 'Alderley Park',status: 'green', occPct: 78, revenue: 19640, pricePerHr: 27, cancelPct: 4.8,  newPlayers: 22, repeatPct: 67, wow: 2 },
  { name: 'North Leeds',  status: 'green', occPct: 84, revenue: 21510, pricePerHr: 31, cancelPct: 3.6,  newPlayers: 28, repeatPct: 73, wow: 1 },
];

export const HEATMAP_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const HEATMAP_HOURS = ['7am', '9am', '11am', '1pm', '3pm', '5pm', '7pm', '9pm'] as const;

/**
 * Court utilisation %, rows = hours, cols = days. Mirrors image 2: clear cool
 * cells in Tue/Thu evenings with a few low-30s, otherwise high 60s–90s.
 */
export const MANCHESTER_HEATMAP: number[][] = [
  // Mon  Tue  Wed  Thu  Fri  Sat  Sun
  [  62,  48,  70,  78,  60,  88,  92 ], // 7am
  [  70,  60,  78,  82,  72,  90,  86 ], // 9am
  [  58,  42,  64,  60,  68,  84,  78 ], // 11am
  [  68,  50,  72,  66,  74,  88,  80 ], // 1pm
  [  78,  64,  80,  70,  82,  92,  84 ], // 3pm
  [  88,  26,  90,  22,  92,  94,  86 ], // 5pm
  [  92,  22,  94,  18,  90,  96,  82 ], // 7pm
  [  74,  38,  76,  32,  80,  90,  70 ], // 9pm
];

export interface BookingOriginSlice {
  channel: string;
  pct: number;
  colour: string;
}

export const BOOKING_ORIGIN: BookingOriginSlice[] = [
  { channel: 'iOS',     pct: 58, colour: 'var(--color-accent-active)' },
  { channel: 'Android', pct: 22, colour: 'var(--color-accent-deep)' },
  { channel: 'Web',     pct: 12, colour: 'var(--color-text-secondary)' },
  { channel: 'Other',   pct: 8,  colour: 'var(--color-border-subtle)' },
];

export interface ForwardPipeline {
  bookedPct: number;
  typicalPct: number;
  /** Headline copy, e.g. "−22% vs typical fill at this lead time". */
  vsTypicalLabel: string;
}

export const FORWARD_PIPELINE: ForwardPipeline = {
  bookedPct: 54,
  typicalPct: 76,
  vsTypicalLabel: '−22%',
};

export interface PlayerRow {
  name: string;
  bookings: number;
  spend: number;
}

export const TOP_PLAYERS: PlayerRow[] = [
  { name: 'Sofia Almeida',  bookings: 14, spend: 312 },
  { name: 'Ben Carter',     bookings: 12, spend: 268 },
  { name: 'Priya Shah',     bookings: 11, spend: 241 },
  { name: 'James Owusu',    bookings: 9,  spend: 198 },
  { name: 'Lucy Bramwell',  bookings: 9,  spend: 192 },
];

export interface CoachRow {
  name: string;
  classes: number;
  attendees: number;
}

export const COACH_ACTIVITY: CoachRow[] = [
  { name: 'Diego Molina',   classes: 18, attendees: 142 },
  { name: 'Isabel Ortega',  classes: 14, attendees: 108 },
  { name: 'Marco Reali',    classes: 9,  attendees: 64 },
];

export interface LapsedPlayers {
  count: number;
  deltaLabel: string; // e.g. "+72 vs a fortnight ago"
}

export const LAPSED_PLAYERS: LapsedPlayers = {
  count: 312,
  deltaLabel: '+72 vs a fortnight ago',
};

export const AI_TAKE_CHAIN: string[] = [
  'Manchester occupancy fell 9 points this week, the largest drop in the chain',
  'Drop is concentrated in Tue, Wed, Thu evening slots',
  'Nottingham added 52 new players, the highest since opening',
];

export const AI_TAKE_MANCHESTER: string[] = [
  'Tue and Thu evening slots running 41% under historical fill',
  'Forward pipeline tracking 22% under typical at this lead time',
  '9 of the lapsed Manchester players also play at Stockport, 12 minutes away',
];

export const AI_TAKE_OVERVIEW: string[] = [
  '7 clubs trading, chain revenue up 4.2% week-on-week',
  'Cafe attach is highest at North Leeds (62%), lowest at Manchester (38%)',
  'Coach-led classes drove 18% of bookings — coaches are the strongest retention lever',
];

// Padel-flavoured overview KPIs (used by the first tab).
export const OVERVIEW_KPIS: ChainKpi[] = [
  { id: 'revenue', label: 'Court revenue · this week', value: '£122,940', delta: '+4.2%', direction: 'up' },
  { id: 'bookings', label: 'Cafe revenue · this week', value: '£28,310', delta: '+6.1%', direction: 'up' },
  { id: 'occupancy', label: 'Cafe attach rate', value: '47%', delta: '+2.0 pts', direction: 'up' },
  { id: 'cancellation', label: 'Avg session length', value: '88 min', delta: '+3 min', direction: 'up' },
  { id: 'active-players', label: 'New members · week', value: '198', delta: '+24', direction: 'up' },
];

/** Hourly booking volume across the chain — used by an overview chart. */
export const HOURLY_BOOKINGS = [
  { hour: '7am', bookings: 86,  cafe: 24 },
  { hour: '8am', bookings: 102, cafe: 38 },
  { hour: '9am', bookings: 124, cafe: 52 },
  { hour: '10am', bookings: 118, cafe: 68 },
  { hour: '11am', bookings: 96,  cafe: 74 },
  { hour: '12pm', bookings: 138, cafe: 96 },
  { hour: '1pm', bookings: 142, cafe: 92 },
  { hour: '2pm', bookings: 108, cafe: 70 },
  { hour: '3pm', bookings: 126, cafe: 64 },
  { hour: '4pm', bookings: 158, cafe: 78 },
  { hour: '5pm', bookings: 218, cafe: 96 },
  { hour: '6pm', bookings: 252, cafe: 114 },
  { hour: '7pm', bookings: 274, cafe: 128 },
  { hour: '8pm', bookings: 232, cafe: 116 },
  { hour: '9pm', bookings: 168, cafe: 84 },
  { hour: '10pm', bookings: 92, cafe: 38 },
];

export interface SiteRevenueRow {
  site: string;
  courts: number;
  cafe: number;
}

export type WeatherCondition = 'sun' | 'part-cloud' | 'cloud' | 'rain';

export interface WeatherDay {
  /** Short label, e.g. 'Mon'. */
  day: string;
  condition: WeatherCondition;
  /** °C, daytime high. */
  tempC: number;
  /** Probability of precipitation, 0-100. */
  precipPct: number;
  /** Expected total bookings across the chain on that day. */
  expectedBookings: number;
}

export const WEEKLY_WEATHER: WeatherDay[] = [
  { day: 'Mon', condition: 'sun',         tempC: 22, precipPct: 5,  expectedBookings: 412 },
  { day: 'Tue', condition: 'part-cloud',  tempC: 21, precipPct: 15, expectedBookings: 398 },
  { day: 'Wed', condition: 'cloud',       tempC: 19, precipPct: 35, expectedBookings: 372 },
  { day: 'Thu', condition: 'rain',        tempC: 17, precipPct: 75, expectedBookings: 298 },
  { day: 'Fri', condition: 'rain',        tempC: 16, precipPct: 80, expectedBookings: 326 },
  { day: 'Sat', condition: 'part-cloud',  tempC: 18, precipPct: 25, expectedBookings: 482 },
  { day: 'Sun', condition: 'sun',         tempC: 20, precipPct: 10, expectedBookings: 524 },
];

export interface RevenueTrendWeek {
  /** ISO-ish label, e.g. 'W41'. */
  week: string;
  courts: number;
  cafe: number;
}

export const REVENUE_TREND_12W: RevenueTrendWeek[] = [
  { week: 'W30', courts: 96400,  cafe: 19200 },
  { week: 'W31', courts: 99100,  cafe: 19800 },
  { week: 'W32', courts: 102400, cafe: 20800 },
  { week: 'W33', courts: 105600, cafe: 21600 },
  { week: 'W34', courts: 108300, cafe: 22400 },
  { week: 'W35', courts: 110800, cafe: 23200 },
  { week: 'W36', courts: 112900, cafe: 24100 },
  { week: 'W37', courts: 115400, cafe: 24800 },
  { week: 'W38', courts: 117800, cafe: 25600 },
  { week: 'W39', courts: 119500, cafe: 26400 },
  { week: 'W40', courts: 121200, cafe: 27300 },
  { week: 'W41', courts: 122940, cafe: 28310 },
];

export interface MemberGrowthWeek {
  week: string;
  active: number;
  new: number;
  churned: number;
}

export const MEMBER_GROWTH_12W: MemberGrowthWeek[] = [
  { week: 'W30', active: 6420, new: 142, churned: 64 },
  { week: 'W31', active: 6498, new: 156, churned: 78 },
  { week: 'W32', active: 6584, new: 172, churned: 86 },
  { week: 'W33', active: 6678, new: 188, churned: 94 },
  { week: 'W34', active: 6772, new: 184, churned: 90 },
  { week: 'W35', active: 6886, new: 206, churned: 92 },
  { week: 'W36', active: 7002, new: 214, churned: 98 },
  { week: 'W37', active: 7148, new: 232, churned: 86 },
  { week: 'W38', active: 7298, new: 240, churned: 90 },
  { week: 'W39', active: 7456, new: 252, churned: 94 },
  { week: 'W40', active: 7642, new: 274, churned: 88 },
  { week: 'W41', active: 7840, new: 290, churned: 92 },
];

export interface LeadTimeBucket {
  bucket: string;
  pct: number;
}

export const LEAD_TIME_DIST: LeadTimeBucket[] = [
  { bucket: 'Same day', pct: 18 },
  { bucket: '1–2 days', pct: 31 },
  { bucket: '3–7 days', pct: 28 },
  { bucket: '8–14 days', pct: 15 },
  { bucket: '15+ days', pct: 8 },
];

export interface RetentionRow {
  /** Player tier label. */
  tier: string;
  /** % of players in that tier still active 90 days later. */
  pct: number;
  /** Headcount in tier. */
  count: number;
}

export const RETENTION_BY_TIER: RetentionRow[] = [
  { tier: 'Coached members', pct: 84, count: 1240 },
  { tier: 'Frequent (4+/mo)', pct: 78, count: 1820 },
  { tier: 'Casual (1–3/mo)',  pct: 51, count: 3160 },
  { tier: 'New (≤30 days)',   pct: 38, count: 1620 },
];

export const SITE_REVENUE: SiteRevenueRow[] = [
  { site: 'North Leeds',  courts: 21510, cafe: 6820 },
  { site: 'Alderley Park',courts: 19640, cafe: 5980 },
  { site: 'Stockport',    courts: 18220, cafe: 4710 },
  { site: 'Lightwater',   courts: 17140, cafe: 4220 },
  { site: 'Darlington',   courts: 16400, cafe: 3640 },
  { site: 'Nottingham',   courts: 15820, cafe: 3140 },
  { site: 'Manchester',   courts: 14210, cafe: 1940 },
];

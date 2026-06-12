// ── Platō Coffee persona mock data ──
// Tab 1: Flow "Met Recipe" telemetry (Platō Elarduspark, Fri 05 June 2026)
// Tab 2: Store check sheet (Platō Tokai, 21 May 2026)
// Tab 3: Barista evaluation framework (updated 27.10.2025)

/* ──────────────────────────── Stores ──────────────────────────── */

export const PLATO_STORES = [
  'Platō Elarduspark',
  'Platō Lyttelton Spar',
  'Platō Bakenkop',
  'Platō Tokai',
];

/* ──────────────────────────── Flow · Met Recipe ──────────────────────────── */

export const FLOW_META = {
  store: 'Platō Elarduspark',
  showing: 'Friday 05 June, 2026',
  timezone: 'Africa/Johannesburg',
  activeViewers: 2,
  updated: '14s ago',
};

export const FLOW_SHOTS = {
  total: 214,
  binnedPct: 0,
  split: [
    { name: 'Espresso', pct: 43.5 },
    { name: 'Ristretto', pct: 56.5 },
  ],
};

export const FLOW_BEAN_USAGE = {
  todayKg: 4.1,
  sevenDayAvgKg: 4.8,
  split: [
    { name: 'Espresso', kg: 1.71 },
    { name: 'Ristretto', kg: 2.22 },
  ],
};

export const FLOW_MET_RECIPE = {
  metPct: 86.9,
  perfectPct: 67.1,
  okPct: 20.3,
  byRecipe: [
    { name: 'Espresso', pct: 83.3 },
    { name: 'Ristretto', pct: 90.6 },
  ],
  byGroupHead: [
    { name: 'LM Linea Classic: Gr.1', pct: 86.8 },
    { name: 'LM Linea Classic: Gr.2', pct: 88.2 },
  ],
};

export const FLOW_MISSED_TIME = {
  pct: 10.7,
  tooSlowPct: 1.4,
  tooSlowAvg: '1.4s',
  tooFastPct: 9.2,
  tooFastAvg: '1.4s',
};

export const FLOW_MISSED_VOLUME = {
  pct: 2.3,
  byGroupHead: [{ name: 'LM Linea Classic: Gr.1', pct: 3.5 }],
};

export const FLOW_LEADERBOARD = [
  { rank: 1, site: 'Platō Elarduspark', pct: 87 },
  { rank: 2, site: 'Platō Lyttelton Spar', pct: 81 },
  { rank: 3, site: 'Platō Bakenkop', pct: 77 },
  { rank: 4, site: 'Platō Tokai', pct: 74 },
];

/** The day the canonical Flow snapshot was taken — other days get seeded variations. */
export const FLOW_BASE_DATE = '2026-06-05';

export interface FlowDayData {
  shots: typeof FLOW_SHOTS;
  beanUsage: typeof FLOW_BEAN_USAGE;
  metRecipe: typeof FLOW_MET_RECIPE;
  missedTime: typeof FLOW_MISSED_TIME;
  missedVolume: typeof FLOW_MISSED_VOLUME;
  leaderboard: typeof FLOW_LEADERBOARD;
}

/** Deterministic 0..1 random stream seeded from an ISO date string. */
function seededRandom(iso: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < iso.length; i++) {
    h ^= iso.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Met-recipe % for any store/day — keeps the leaderboard consistent across stores. */
function metPctForStore(store: string, iso: string): number {
  if (iso === FLOW_BASE_DATE) {
    const base: Record<string, number> = {
      'Platō Elarduspark': 86.9,
      'Platō Lyttelton Spar': 81.2,
      'Platō Bakenkop': 77.4,
      'Platō Tokai': 74.1,
    };
    if (base[store] !== undefined) return base[store];
  }
  const rnd = seededRandom(`${store}|${iso}|met`);
  return round1(76 + rnd() * 15);
}

function leaderboardFor(iso: string): typeof FLOW_LEADERBOARD {
  return PLATO_STORES.map((site) => ({ site, pct: Math.round(metPctForStore(site, iso)) }))
    .sort((a, b) => b.pct - a.pct)
    .map((entry, i) => ({ rank: i + 1, ...entry }));
}

/**
 * Flow telemetry for a given day and store. Platō Elarduspark on the base
 * date returns the canonical screenshot numbers; everything else returns a
 * plausible seeded variation so the date/store selectors feel live in demos.
 */
export function flowDataForDate(iso: string, store: string = PLATO_STORES[0]): FlowDayData {
  if (iso === FLOW_BASE_DATE && store === 'Platō Elarduspark') {
    return {
      shots: FLOW_SHOTS,
      beanUsage: FLOW_BEAN_USAGE,
      metRecipe: FLOW_MET_RECIPE,
      missedTime: FLOW_MISSED_TIME,
      missedVolume: FLOW_MISSED_VOLUME,
      leaderboard: FLOW_LEADERBOARD,
    };
  }

  const rnd = seededRandom(`${store}|${iso}`);
  // Weekends trade a little quieter than weekdays.
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  const weekendFactor = day === 0 || day === 6 ? 0.82 : 1;

  const total = Math.round((185 + rnd() * 75) * weekendFactor);
  const espressoPct = round1(40 + rnd() * 10);
  const ristrettoPct = round1(100 - espressoPct);
  const binnedPct = rnd() < 0.65 ? 0 : round1(rnd() * 1.5);

  const todayKg = round1((3.6 + rnd() * 1.4) * weekendFactor);
  const espressoKg = round1(todayKg * (espressoPct / 100) * 0.95);
  const ristrettoKg = round1(todayKg - espressoKg - 0.1 - rnd() * 0.1);

  const metPct = metPctForStore(store, iso);
  const perfectPct = round1(metPct * (0.72 + rnd() * 0.08));
  const okPct = round1(metPct - perfectPct);
  const espressoMet = round1(metPct - 4 + rnd() * 4);
  const ristrettoMet = round1(Math.min(96, metPct + 1 + rnd() * 5));
  const gr1 = round1(metPct - 1 + rnd() * 2);
  const gr2 = round1(metPct + rnd() * 2);

  const missedTimePct = round1(Math.max(3, 100 - metPct - (1.5 + rnd() * 2)));
  const tooSlow = round1(missedTimePct * (0.1 + rnd() * 0.25));
  const tooFast = round1(missedTimePct - tooSlow - 0.1);
  const missedVolumePct = round1(1.2 + rnd() * 2.4);

  return {
    shots: {
      total,
      binnedPct,
      split: [
        { name: 'Espresso', pct: espressoPct },
        { name: 'Ristretto', pct: ristrettoPct },
      ],
    },
    beanUsage: {
      todayKg,
      sevenDayAvgKg: FLOW_BEAN_USAGE.sevenDayAvgKg,
      split: [
        { name: 'Espresso', kg: espressoKg },
        { name: 'Ristretto', kg: ristrettoKg },
      ],
    },
    metRecipe: {
      metPct,
      perfectPct,
      okPct,
      byRecipe: [
        { name: 'Espresso', pct: espressoMet },
        { name: 'Ristretto', pct: ristrettoMet },
      ],
      byGroupHead: [
        { name: 'LM Linea Classic: Gr.1', pct: gr1 },
        { name: 'LM Linea Classic: Gr.2', pct: gr2 },
      ],
    },
    missedTime: {
      pct: missedTimePct,
      tooSlowPct: tooSlow,
      tooSlowAvg: `${round1(0.8 + rnd() * 1.4)}s`,
      tooFastPct: tooFast,
      tooFastAvg: `${round1(0.8 + rnd() * 1.4)}s`,
    },
    missedVolume: {
      pct: missedVolumePct,
      byGroupHead: [{ name: 'LM Linea Classic: Gr.1', pct: round1(missedVolumePct + 0.6 + rnd()) }],
    },
    leaderboard: leaderboardFor(iso),
  };
}

/* ──────────────────────────── Store check sheet ──────────────────────────── */

export type StoreCheckRating = 'great' | 'average' | 'urgent';

export interface StoreCheckItem {
  item: string;
  detail?: string;
  rating: StoreCheckRating;
  note?: string;
}

export interface StoreCheckSection {
  title: string;
  /** 'quality' renders Great/Average/Urgent; 'stock' renders Yes/No */
  scale: 'quality' | 'stock';
  items: StoreCheckItem[];
}

export const STORE_CHECK_META = {
  store: 'Platō Tokai',
  date: '21 May 2026',
};

export const STORE_CHECK_SECTIONS: StoreCheckSection[] = [
  {
    title: 'Store',
    scale: 'quality',
    items: [
      {
        item: "'PLATO' signage",
        detail: 'Interior & exterior',
        rating: 'great',
        note: 'Great to see the ceiling light installations illuminated, really does set this space apart.',
      },
      { item: 'Lights', rating: 'great', note: 'The new lights installed look very clean and modern, thanks.' },
      { item: 'Plants', rating: 'great', note: 'Plants in the store are looking great.' },
      { item: 'Menu board', rating: 'great', note: 'The menu board was working and clean.' },
      {
        item: 'A5 stands',
        detail: 'Correct pamphlets',
        rating: 'great',
        note: 'All the A5 stands were in front of the counter.',
      },
      {
        item: 'Retail display',
        detail: 'Including shelving',
        rating: 'great',
        note: 'The retail display looks clean and nicely stocked.',
      },
      { item: 'Furniture', rating: 'great', note: 'All the furniture is in good condition.' },
      {
        item: 'Condiment stand',
        rating: 'average',
        note: 'The written stickers can be replaced with clean labels indicating the size of the cup lids.',
      },
      {
        item: 'Coffee bar',
        detail: 'Counter & cupboards',
        rating: 'great',
        note: 'Baristas kept the counter area clean throughout the shift, cupboards were stocked.',
      },
      {
        item: 'Structure',
        detail: 'Walls, windows, ceiling, floors, doors',
        rating: 'average',
        note: 'As per the abovementioned feedback; this will be looked into as soon as possible.',
      },
      {
        item: 'Paint',
        detail: 'Interior & exterior',
        rating: 'great',
        note: 'The paint is in good condition both interior and exterior.',
      },
      {
        item: 'Water filters',
        rating: 'great',
        note: 'BWT water filters were changed both for the espresso and ice machine on 22/04/2026.',
      },
      { item: 'Taps', detail: 'FOH and BOH if applicable', rating: 'great' },
    ],
  },
  {
    title: 'Store cleanliness',
    scale: 'quality',
    items: [
      {
        item: 'Back of store',
        detail: 'Storeroom & behind bar',
        rating: 'great',
        note: 'The storeroom was organised and clean.',
      },
      {
        item: 'Front of store',
        detail: 'Seating/standing area',
        rating: 'great',
        note: 'The seating area was clean when I arrived at the store.',
      },
      { item: 'Sanitary', detail: 'No off smells', rating: 'great', note: 'No off smells.' },
      {
        item: 'Pest-free',
        detail: 'No ants, bees, flies, cockroaches',
        rating: 'great',
        note: 'There were no flies in the store.',
      },
    ],
  },
  {
    title: 'Electronics',
    scale: 'quality',
    items: [
      { item: 'YOCO POS', detail: 'Table, neo touch, printer', rating: 'great' },
      { item: 'YOYO scanner', rating: 'great' },
      { item: 'iPad', detail: 'Functional stand & displaying Flow', rating: 'great' },
      {
        item: 'FLOW',
        detail: 'Device & cables',
        rating: 'average',
        note: 'Flow device installed but still not 100% operational. Once the Flow software gets rolled out on the Tempesta machines, I will pass by to ensure everything works and the team understands the system.',
      },
      {
        item: 'SONOS speaker',
        detail: 'Playing Plato Radio/playlist',
        rating: 'great',
        note: 'The speakers are working perfectly.',
      },
      { item: 'WiFi', rating: 'great', note: 'Working.' },
    ],
  },
  {
    title: 'Barista tools',
    scale: 'quality',
    items: [
      { item: 'Coffee scale', rating: 'great', note: 'The scale is working perfectly.' },
      { item: 'NCD', rating: 'great', note: 'NCD was still working well and was set on 8mm on arrival.' },
      { item: 'Tamp mat', rating: 'great', note: 'The tamp mat is in good condition.' },
      { item: 'Counter brush', rating: 'great', note: 'The counter brush is also in good condition.' },
      { item: 'Knockbox', rating: 'great', note: 'The knockbox is also in good condition.' },
      { item: 'Thermometer', rating: 'great', note: 'The thermometer is working perfectly as well.' },
      {
        item: 'Shot glasses',
        detail: 'Minimum of 2',
        rating: 'great',
        note: 'There are three shot glasses at the store currently.',
      },
      { item: 'Spoons', detail: '1x coffee, 1x condensed milk, 1x matcha', rating: 'great' },
      {
        item: 'Toolbox',
        detail: 'Shifting spanner, screwdriver set, caffeine wrench',
        rating: 'average',
        note: 'I would recommend storing spare c-clips in the toolbox, allowing baristas to easily swap out a broken clip during a shift.',
      },
    ],
  },
  {
    title: 'Equipment',
    scale: 'quality',
    items: [
      {
        item: 'Espresso machine',
        detail: 'Astoria Tempesta, including servicing',
        rating: 'great',
        note: 'Tempesta machine — service date was 22/04/2026. Next service date 22/10/2026.',
      },
      {
        item: 'Portafilters & steamwand condition',
        rating: 'great',
        note: 'Portafilters are still in good condition — handles, c-clips and baskets all good. Showed the team how to clean the spouts. The team might need a spare portafilter for red espresso.',
      },
      {
        item: 'Blend grinder',
        detail: 'Mahlkönig E65GBW, including servicing',
        rating: 'great',
        note: 'Servicing is done yearly and the grinder burr can be changed every 18 months.',
      },
      {
        item: 'Decaf grinder',
        detail: 'Eureka, including servicing',
        rating: 'great',
        note: 'Servicing is done yearly and the grinder burr can be changed every 18 months.',
      },
      { item: 'PUQ press', rating: 'great' },
      {
        item: 'Blenders',
        rating: 'average',
        note: 'Good condition. Aware of the one blender that has a blade gear that seems damaged — will reach out on this as I have not seen this happen before.',
      },
      { item: 'Airfryer', rating: 'great' },
      {
        item: 'Ice machine',
        detail: 'Including servicing',
        rating: 'great',
        note: 'Glad to hear the ice machine is working well again. Please reach out if it is not consistent in producing ice.',
      },
      { item: 'Refrigerator', detail: 'Including servicing', rating: 'great' },
      { item: 'Sandwich press', detail: 'If applicable', rating: 'great' },
      {
        item: 'Pastry fridge',
        detail: 'If applicable',
        rating: 'average',
        note: 'Pastry cabinet — aware of the touch-up needed, will feed this through to Ash and Harry.',
      },
      { item: 'Pitcher rinser', detail: 'If applicable', rating: 'great', note: 'The pitcher rinser is working perfectly.' },
      { item: 'Hydroboil', detail: 'If applicable', rating: 'great' },
    ],
  },
  {
    title: 'Miscellaneous',
    scale: 'quality',
    items: [
      { item: 'Pastry blocks', rating: 'great' },
      { item: 'Correct cup markers', rating: 'great' },
      { item: 'Cloths', rating: 'great' },
      { item: 'Powder tubs', detail: 'Correct scoops', rating: 'great' },
      { item: 'Powder shakers', detail: 'Chocolate & cinnamon', rating: 'great' },
      { item: 'Steel tumblers', detail: 'Markers & thermometer', rating: 'great' },
      {
        item: 'Squeeze bottle',
        detail: 'Minimum of 2 for condensed milk',
        rating: 'average',
        note: 'One more squeeze bottle for the condensed milk can be ordered please, allowing bottles to be rotated and cleaned more effectively.',
      },
      { item: 'Mango jug', rating: 'great' },
      { item: 'Cream gun', detail: 'With a date', rating: 'great' },
      { item: 'Paper towel dispenser', rating: 'great' },
      { item: 'COA', detail: 'Correctly displayed', rating: 'great', note: 'The COA is nicely displayed in front.' },
      { item: 'Fire extinguisher', rating: 'great' },
      { item: 'Gresham license', rating: 'great', note: 'The music license is nicely displayed as well.' },
    ],
  },
  {
    title: 'Basic stock',
    scale: 'stock',
    items: [
      { item: 'Beans', detail: 'Blend, decaf, retail', rating: 'great' },
      { item: 'Milks & cream', detail: '8 variants of milk', rating: 'great' },
      {
        item: 'Syrups',
        detail: '13 variants with correct pumps',
        rating: 'great',
        note: 'Bottles and surrounding counterspace to be checked and cleaned more often.',
      },
      { item: 'Powders', detail: '9 variants and none expired', rating: 'great' },
      {
        item: 'Condiments',
        detail: 'Plato sugars, honey, cinnamon, condensed milk',
        rating: 'great',
        note: 'The condensed milk and honey bottles need to please be wiped clean before being placed back on top of the espresso machine — any syrup/honey that leaks onto the heating plate becomes a challenge to clean, thanks.',
      },
      { item: 'Cookies', detail: '3 variants and none expired', rating: 'great' },
      { item: 'Water', detail: 'Preferably Mountain Falls', rating: 'great' },
      { item: 'Retail items', detail: 'Luxury treats, coffee beans & pods, USN range', rating: 'great' },
      { item: 'Pastries', detail: 'If applicable', rating: 'great' },
      {
        item: 'Cups & lids',
        detail: 'Espresso, cortado, small, medium, large, clear medium, clear large',
        rating: 'great',
      },
      {
        item: 'Packaging',
        detail: 'Wooden stirrers, straws, serviettes, croissant bags, 2 & 4 cup carriers, shopper bags',
        rating: 'great',
      },
      {
        item: 'Sundries',
        detail: 'Hand soap, hand sanitiser, sunlight, pine gel, all purpose cleaner, roller towel, bin bags',
        rating: 'great',
      },
      { item: 'Smalls', detail: 'Nitrogen bombs, elastic bands, GRINDZ, CAFIZA', rating: 'great' },
    ],
  },
];

const STORE_CHECK_DATES: Record<string, string> = {
  'Platō Tokai': '21 May 2026',
  'Platō Elarduspark': '29 May 2026',
  'Platō Lyttelton Spar': '15 May 2026',
  'Platō Bakenkop': '08 May 2026',
};

/**
 * Store check sheet for a given store. Platō Tokai returns the canonical
 * 21 May visit (real notes); other stores return a seeded variation of the
 * same walkthrough so the store filter feels live in demos.
 */
export function storeCheckForStore(store: string): {
  meta: { store: string; date: string };
  sections: StoreCheckSection[];
} {
  const meta = { store, date: STORE_CHECK_DATES[store] ?? '21 May 2026' };
  if (store === 'Platō Tokai') {
    return { meta, sections: STORE_CHECK_SECTIONS };
  }
  const rnd = seededRandom(`${store}|storecheck`);
  const sections = STORE_CHECK_SECTIONS.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      const flagged = rnd() < (section.scale === 'stock' ? 0.05 : 0.1);
      if (!flagged) return { ...item, rating: 'great' as StoreCheckRating, note: undefined };
      return {
        ...item,
        rating: (section.scale === 'stock' ? 'urgent' : 'average') as StoreCheckRating,
        note:
          section.scale === 'stock'
            ? 'Out of stock on this visit — order placed with the store team.'
            : 'Flagged during the walkthrough — follow-up raised with the store team.',
      };
    }),
  }));
  return { meta, sections };
}

/* ──────────────────────────── Barista evaluation ─────────────────────────── */

export interface EvalCriterion {
  name: string;
  max: number;
}

export interface EvalDiscipline {
  id: string;
  name: string;
  weight: number;
  criteria: EvalCriterion[];
  /** Demo score for the current month's sample evaluation */
  sampleScore: number;
}

const EVAL_BARISTAS: Record<string, string> = {
  'Platō Elarduspark': 'Thando M.',
  'Platō Lyttelton Spar': 'Naledi K.',
  'Platō Bakenkop': 'Pieter v.d.M.',
  'Platō Tokai': 'Ayanda S.',
};

export const EVAL_DISCIPLINES: EvalDiscipline[] = [
  {
    id: 'recipe',
    name: 'Recipe',
    weight: 0.12,
    sampleScore: 11,
    criteria: [
      { name: 'Espresso machine programmed', max: 2 },
      { name: 'Knows and follows blend espresso (19g in ; 40g out)', max: 1 },
      { name: 'Knows and follows blend ristretto (19g in ; 30g out)', max: 1 },
      { name: 'Knows and follows decaf espresso (19g in ; 40g out)', max: 1 },
      { name: 'Knows and follows decaf ristretto (19g in ; 30g out)', max: 1 },
      { name: 'Follows drinks recipes', max: 1 },
      { name: 'Follows Freezo recipes', max: 1 },
      { name: 'Flow score for the day', max: 5 },
    ],
  },
  {
    id: 'puck',
    name: 'Puck prep / extraction',
    weight: 0.12,
    sampleScore: 10,
    criteria: [
      { name: 'Mid/post grind cycle tap', max: 2 },
      { name: 'Grounds tap distribution', max: 1 },
      { name: 'NCD use', max: 1 },
      { name: 'PuqPress + correct setting', max: 2 },
      { name: 'Able to explain grind size vs time relationship', max: 1 },
      { name: 'Able to execute grinder dial-in accurately', max: 1 },
      { name: 'Meets 29–33s espresso extraction', max: 1 },
      { name: 'Meets 23–27s ristretto extraction', max: 1 },
      { name: 'Meets 29–33s espresso extraction — decaf', max: 1 },
      { name: 'Meets 23–27s ristretto extraction — decaf', max: 1 },
    ],
  },
  {
    id: 'milk',
    name: 'Milk',
    weight: 0.12,
    sampleScore: 8,
    criteria: [
      { name: 'Thermometer used', max: 1 },
      { name: 'Temperature espresso-based executed', max: 1 },
      { name: 'Temperature powder-based executed', max: 1 },
      { name: 'Texture', max: 1 },
      { name: 'Microfoam (0.5cm foam depth)', max: 1 },
      { name: 'Frothed milk (1cm foam depth)', max: 1 },
      { name: 'Purges steamwand before', max: 1 },
      { name: 'Cleans steamwands immediately', max: 1 },
      { name: 'Purges steamwand after', max: 1 },
    ],
  },
  {
    id: 'workflow',
    name: 'Work flow',
    weight: 0.08,
    sampleScore: 6,
    criteria: [
      { name: 'Works in a sequential/logical fashion', max: 1 },
      { name: 'Directs customers accordingly from POS', max: 1 },
      { name: 'Appropriately cleans as they go', max: 1 },
      { name: 'Cleans bar surface after serving customers', max: 1 },
      { name: 'Cleans fridge/pastry box frequently', max: 1 },
      { name: 'Closes ice machine', max: 1 },
      { name: 'Puts milk away when done', max: 1 },
    ],
  },
  {
    id: 'hygiene',
    name: 'Bar hygiene',
    weight: 0.09,
    sampleScore: 18,
    criteria: [
      { name: 'Dries/cleans basket', max: 1 },
      { name: 'Flushes grouphead', max: 1 },
      { name: 'Cleans portafilter before extraction', max: 1 },
      { name: 'Knocks spent puck out after use', max: 1 },
      { name: 'Wipes portafilter after puck knocked out', max: 1 },
      { name: 'Portafilter cloth use', max: 1 },
      { name: 'Driptray cloth: use/placement', max: 2 },
      { name: 'Milk cloth: use/placement', max: 2 },
      { name: 'Everything cloth: use/placement', max: 2 },
      { name: 'Rinses cloths frequently', max: 1 },
      { name: 'Backflushes machine regularly', max: 3 },
      { name: 'Distribution flapper cleaned weekly', max: 2 },
      { name: 'Ice machine cleanliness', max: 3 },
    ],
  },
  {
    id: 'service',
    name: 'Service',
    weight: 0.15,
    sampleScore: 11,
    criteria: [
      { name: 'Greets customers first', max: 1 },
      { name: 'Friendly — start to finish', max: 1 },
      { name: 'Engaging', max: 1 },
      { name: 'Solution focused', max: 1 },
      { name: 'Name on cup', max: 1 },
      { name: 'Message on cup', max: 1 },
      { name: 'Order noted on cup', max: 1 },
      { name: 'Calls name and order out', max: 2 },
      { name: 'Upsells', max: 1 },
      { name: 'Cellphones', max: 1 },
      { name: 'Initiative', max: 2 },
    ],
  },
  {
    id: 'uniform',
    name: 'Uniform',
    weight: 0.07,
    sampleScore: 12,
    criteria: [
      { name: 'Shirt + condition', max: 2 },
      { name: 'Jersey + condition', max: 2 },
      { name: 'Apron + condition', max: 2 },
      { name: 'Headwear + condition', max: 2 },
      { name: 'Jacket + condition', max: 2 },
      { name: 'Correct pants', max: 2 },
    ],
  },
  {
    id: 'menu',
    name: 'Menu / POS knowledge',
    weight: 0.08,
    sampleScore: 12,
    criteria: [
      { name: 'Freezos flavours', max: 3 },
      { name: 'Signature drinks cup sizes', max: 5 },
      { name: 'General cup sizes', max: 2 },
      { name: 'Product knowledge — allergens', max: 1 },
      { name: 'Discount item', max: 1 },
      { name: 'Refund item', max: 1 },
      { name: 'Extras', max: 1 },
    ],
  },
  {
    id: 'general',
    name: 'General knowledge',
    weight: 0.05,
    sampleScore: 9,
    criteria: [
      { name: 'Company history', max: 3 },
      { name: 'Origins', max: 3 },
      { name: 'Flavour descriptors', max: 3 },
      { name: 'Franchisor', max: 3 },
    ],
  },
  {
    id: 'shop',
    name: 'Shop (baristas)',
    weight: 0.12,
    sampleScore: 14,
    criteria: [
      { name: 'Tidy', max: 1 },
      { name: 'Sanitary', max: 1 },
      { name: 'Clean', max: 1 },
      { name: 'Sugar caddy (re)filled', max: 6 },
      { name: 'Correct food items sold', max: 1 },
      { name: 'Well stocked (everything available)', max: 2 },
      { name: 'Correct music playing', max: 1 },
      { name: 'Top of espresso machine clean', max: 1 },
      { name: 'Cups stacked on machine', max: 2 },
    ],
  },
];

export function disciplineMax(d: EvalDiscipline): number {
  return d.criteria.reduce((sum, c) => sum + c.max, 0);
}

/** Weighted total score (%) for a set of per-discipline scores. */
function weightedScore(scores: Record<string, number>): number {
  const total = EVAL_DISCIPLINES.reduce(
    (sum, d) => sum + ((scores[d.id] ?? 0) / disciplineMax(d)) * d.weight * 100,
    0,
  );
  return round1(total);
}

export const EVAL_BANDS = [
  { range: '0–59%', label: 'Unacceptable performance', color: '#d44d4d' },
  { range: '60–79%', label: 'Unsatisfactory performance', color: '#d4904d' },
  { range: '80–89%', label: 'Good performance', color: '#21a87a' },
  { range: '90–100%', label: 'Exemplary performance', color: '#1d7a5f' },
];

export function bandForScore(score: number): (typeof EVAL_BANDS)[number] {
  if (score < 60) return EVAL_BANDS[0];
  if (score < 80) return EVAL_BANDS[1];
  if (score < 90) return EVAL_BANDS[2];
  return EVAL_BANDS[3];
}

export interface BaristaEvalData {
  meta: { barista: string; store: string; date: string };
  /** Per-discipline scores keyed by discipline id. */
  scores: Record<string, number>;
  weightedScore: number;
  /** Monthly tracking from the "Summary & Tracking" sheet (Jul–Dec not yet evaluated). */
  monthly: { month: string; score: number | null }[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Months Jan–May for the canonical (Elarduspark) tracker; other stores get seeded jitter. */
const BASE_MONTHLY = [72, 78, 81, 84, 88];

/**
 * Barista evaluation for a given store. Platō Elarduspark returns the
 * canonical demo evaluation; other stores return a seeded variation with
 * their own barista.
 */
export function baristaEvalForStore(store: string): BaristaEvalData {
  const canonical = store === 'Platō Elarduspark';
  const rnd = seededRandom(`${store}|eval`);

  const scores: Record<string, number> = {};
  for (const d of EVAL_DISCIPLINES) {
    const max = disciplineMax(d);
    scores[d.id] = canonical
      ? d.sampleScore
      : Math.max(0, Math.min(max, Math.round(d.sampleScore * (0.78 + rnd() * 0.32))));
  }
  const june = weightedScore(scores);

  const monthly: { month: string; score: number | null }[] = MONTHS.map((month, i) => {
    if (i < 5) {
      const base = BASE_MONTHLY[i];
      return { month, score: canonical ? base : Math.round(base + (rnd() * 10 - 5)) };
    }
    if (i === 5) return { month, score: june };
    return { month, score: null };
  });

  return {
    meta: { barista: EVAL_BARISTAS[store] ?? 'Barista', store, date: '05 June 2026' },
    scores,
    weightedScore: june,
    monthly,
  };
}

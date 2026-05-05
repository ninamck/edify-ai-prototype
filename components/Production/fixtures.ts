// ─────────────────────────────────────────────────────────────────────────────
// Edify production fixtures — slice C
//
// Shape-first fixtures for the foundation rebuild of production. Covers every
// entity named in PRODUCTION_BRIEF.md / the scoping plan:
//
//   estate → formats → sites (4 types) → benches
//   recipes (incl. assembly) + production items (mode per SKU)
//   workflows (DAG w/ leadOffset up to D-2)
//   ranges + tiers + selection tags + intra-day availability
//   forecast → plan → planned instance → batch → PCR → transfer
//   carry-over, spoke submission, settings health, Quinn setup interview
//   users (Manager / Staff)
//
// All data is in-memory mock data; no persistence. Dates are anchored on
// DEMO_TODAY so the scenario stays stable across reloads.
// ─────────────────────────────────────────────────────────────────────────────

// ───── IDs (brand types kept loose so fixtures stay readable) ─────
export type EstateId = string;
export type FormatId = string;
export type SiteId = string;
export type BenchId = string;
export type RecipeId = string;
export type ProductionItemId = string;
export type SkuId = string;
export type WorkflowId = string;
export type StageId = string;
export type RangeId = string;
export type TierId = string;
export type UserId = string;
export type BatchId = string;

// ───── Core enums ─────
export type SiteType = 'STANDALONE' | 'HUB' | 'SPOKE' | 'HYBRID';
export type Role = 'Manager' | 'Staff';

export type ProductionMode = 'run' | 'variable' | 'increment';

export type BenchCapability =
  | 'oven'
  | 'prep'
  | 'pack'
  | 'proofing'
  | 'cold-prep'
  | 'front-of-house'
  | 'assemble';

// ─────────────────────────────────────────────────────────────────────────────
// Work types & equipment
//
// `WorkType` is the canonical activity taxonomy shared across recipes,
// workflow stages, and benches. It answers "what kind of work is this?"
// and is generic enough to apply to any hub / café / dark kitchen
// (intentionally not Pret-specific). The Run sheet pivots on this.
//
// `Equipment` is an optional refinement — a physical machine/space that a
// stage may require beyond just its work type. e.g. a "Cook" stage might
// further require an `oven` or a `proofer`. Routing a stage to a bench
// becomes:
//   bench.workTypes.includes(stage.workType) &&
//   (stage.requiresEquipment ?? []).every(e => bench.equipment?.includes(e))
//
// Existing `BenchCapability` overlaps with both but conflates activity
// (assemble/pack/prep) and equipment (oven/proofing/cold-prep). We're
// keeping it for now to avoid a bigger refactor — see the migration map
// in `workTypeFromCapability` / `equipmentFromCapability` below.
// ─────────────────────────────────────────────────────────────────────────────

// Canonical work types — initial set of 16. Grouped (in order) by when in
// the day the work tends to happen:
//   pre-shift:   weigh-up, thaw, mise
//   cold prep:   wash, sanitise, slice
//   mix/shape:   mix, proof
//   hot work:    bake, grill
//   set/cool:    chill
//   build:       assemble, portion
//   finish:      label, pack
//   clean:       wash-down
// The list is intentionally flat at the type level — the grouping above is
// just for human ordering. Add to this list as new operational shapes
// emerge; the chip rendering, Run sheet pivot, and ingredient prep popover
// all read from this enum so new entries flow through automatically.
export type WorkType =
  | 'weigh-up'
  | 'thaw'
  | 'mise'
  | 'wash'
  | 'sanitise'
  | 'slice'
  | 'mix'
  | 'proof'
  | 'bake'
  | 'grill'
  | 'chill'
  | 'assemble'
  | 'portion'
  | 'label'
  | 'pack'
  | 'wash-down';

// Canonical equipment — initial set of 19. Used by `Bench.equipment` and
// `WorkflowStage.requiresEquipment`. Authoring a stage with
// `requiresEquipment: ['mandoline']` lets the Run sheet land its
// aggregated slice work on a bench whose `equipment` list includes the
// mandoline.
export type Equipment =
  | 'oven'
  | 'combi-oven'
  | 'proofer'
  | 'mixer-planetary'
  | 'mixer-spiral'
  | 'slicer'
  | 'mandoline'
  | 'blender'
  | 'food-processor'
  | 'hob'
  | 'griddle'
  | 'panini-press'
  | 'microwave'
  | 'blast-chiller'
  | 'walk-in-chiller'
  | 'freezer'
  | 'sanitise-sink'
  | 'prep-table'
  | 'counter';

/** Display order for work types — earliest in the day first. Drives the
 *  Run sheet section order and the order chips render in. */
export const WORK_TYPE_ORDER: WorkType[] = [
  'weigh-up', 'thaw', 'mise',
  'wash', 'sanitise', 'slice',
  'mix', 'proof',
  'bake', 'grill',
  'chill',
  'assemble', 'portion',
  'label', 'pack',
  'wash-down',
];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  'weigh-up':  'Weigh up',
  'thaw':      'Thaw',
  'mise':      'Mise',
  'wash':      'Wash',
  'sanitise':  'Sanitise',
  'slice':     'Slice',
  'mix':       'Mix',
  'proof':     'Proof',
  'bake':      'Bake',
  'grill':     'Grill',
  'chill':     'Chill',
  'assemble':  'Assemble',
  'portion':   'Portion',
  'label':     'Label',
  'pack':      'Pack',
  'wash-down': 'Wash-down',
};

/** Tonal colors per work type. Subtle backgrounds + a matching foreground
 *  text color. Cold-leaning work uses cool tones, hot-leaning work uses
 *  warm tones, finishing/clean work uses neutrals. */
export const WORK_TYPE_COLORS: Record<WorkType, { bg: string; color: string }> = {
  // Pre-shift — warm yellows/ambers, the "before service" tone.
  'weigh-up':  { bg: 'rgba(241,180,52,0.16)', color: 'var(--color-warning)' },
  'thaw':      { bg: 'rgba(3,105,161,0.10)',  color: 'var(--color-info)' },
  'mise':      { bg: 'rgba(3,28,89,0.07)',    color: 'var(--color-accent-active)' },
  // Cold prep — cool blues/teals.
  'wash':      { bg: 'rgba(3,105,161,0.10)',  color: 'var(--color-info)' },
  'sanitise':  { bg: 'rgba(74,108,181,0.14)', color: 'var(--color-accent-mid)' },
  'slice':     { bg: 'rgba(74,108,181,0.14)', color: 'var(--color-accent-mid)' },
  // Mix / shape — accent navy.
  'mix':       { bg: 'rgba(3,28,89,0.07)',    color: 'var(--color-accent-active)' },
  'proof':     { bg: 'rgba(241,180,52,0.16)', color: 'var(--color-warning)' },
  // Hot work — reds.
  'bake':      { bg: 'rgba(220,38,38,0.10)',  color: 'var(--color-error)' },
  'grill':     { bg: 'rgba(220,38,38,0.10)',  color: 'var(--color-error)' },
  // Set / cool — light blue.
  'chill':     { bg: 'rgba(3,105,161,0.10)',  color: 'var(--color-info)' },
  // Build — info blue.
  'assemble':  { bg: 'rgba(3,105,161,0.12)',  color: 'var(--color-info)' },
  'portion':   { bg: 'rgba(21,128,61,0.10)',  color: 'var(--color-success)' },
  // Finish — green/neutral.
  'label':     { bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' },
  'pack':      { bg: 'rgba(21,128,61,0.10)',  color: 'var(--color-success)' },
  // Clean — neutral grey.
  'wash-down': { bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' },
};

/** Default work-type for an existing `BenchCapability`. Used to derive
 *  `WorkflowStage.workType` and `Bench.workTypes` when not set explicitly,
 *  so we can ship the new vocabulary without touching every fixture.
 *  Note: capabilities are coarser than work types — `oven` covers both
 *  bake and grill in our model; we default to `bake` and let stages
 *  override with `workType: 'grill'` where it matters. */
export function workTypeFromCapability(cap: BenchCapability): WorkType {
  switch (cap) {
    case 'oven':           return 'bake';
    case 'proofing':       return 'proof';
    case 'cold-prep':      return 'mise';
    case 'prep':           return 'mise';
    case 'assemble':       return 'assemble';
    case 'pack':           return 'pack';
    case 'front-of-house': return 'pack';
  }
}

/** Default equipment hint for an existing `BenchCapability`. */
export function equipmentFromCapability(cap: BenchCapability): Equipment | undefined {
  switch (cap) {
    case 'oven':           return 'oven';
    case 'proofing':       return 'proofer';
    case 'cold-prep':      return 'walk-in-chiller';
    case 'front-of-house': return 'counter';
    default:               return undefined;
  }
}

/** Display labels for equipment — used in editors + chips. */
export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  'oven':            'Oven',
  'combi-oven':      'Combi oven',
  'proofer':         'Proofer',
  'mixer-planetary': 'Planetary mixer',
  'mixer-spiral':    'Spiral mixer',
  'slicer':          'Slicer',
  'mandoline':       'Mandoline',
  'blender':         'Blender',
  'food-processor':  'Food processor',
  'hob':             'Hob',
  'griddle':         'Griddle',
  'panini-press':    'Panini press',
  'microwave':       'Microwave',
  'blast-chiller':   'Blast chiller',
  'walk-in-chiller': 'Walk-in chiller',
  'freezer':         'Freezer',
  'sanitise-sink':   'Sanitise sink',
  'prep-table':      'Prep table',
  'counter':         'Counter',
};

/** Canonical ordering for equipment chips — same flow as work types
 *  (cold/cool first, hot middle, then chill/cool, then space). */
export const EQUIPMENT_ORDER: Equipment[] = [
  'oven', 'combi-oven', 'proofer',
  'mixer-planetary', 'mixer-spiral',
  'slicer', 'mandoline', 'blender', 'food-processor',
  'hob', 'griddle', 'panini-press', 'microwave',
  'blast-chiller', 'walk-in-chiller', 'freezer',
  'sanitise-sink',
  'prep-table', 'counter',
];

/** Resolve the effective work types for a bench — explicit `workTypes` if
 *  authored, else derived from `capabilities`. Always deduped. */
export function benchWorkTypes(b: Pick<Bench, 'workTypes' | 'capabilities'>): WorkType[] {
  if (b.workTypes && b.workTypes.length > 0) return Array.from(new Set(b.workTypes));
  return Array.from(new Set(b.capabilities.map(workTypeFromCapability)));
}

/** Resolve the effective equipment for a bench — explicit `equipment` if
 *  authored, else derived from `capabilities`. */
export function benchEquipment(b: Pick<Bench, 'equipment' | 'capabilities'>): Equipment[] {
  if (b.equipment && b.equipment.length > 0) return Array.from(new Set(b.equipment));
  const derived = b.capabilities
    .map(equipmentFromCapability)
    .filter((e): e is Equipment => !!e);
  return Array.from(new Set(derived));
}

/** Resolve the effective work type for a workflow stage — explicit if
 *  authored, else derived from `capability`. */
export function stageWorkType(s: Pick<WorkflowStage, 'workType' | 'capability'>): WorkType {
  return s.workType ?? workTypeFromCapability(s.capability);
}

export type SelectionTag =
  | 'breakfast'
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'closing'
  | 'core';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export const DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ───── Date anchor (stable demo scenario) ─────
/** Demo "today" — a Thursday. All timing in fixtures is relative to this. */
export const DEMO_TODAY = '2026-04-23'; // Thursday

/** Offset a day (-2 for D-2, 0 for today, +1 for tomorrow, etc.). Returns ISO yyyy-mm-dd. */
export function dayOffset(days: number, anchor: string = DEMO_TODAY): string {
  const d = new Date(`${anchor}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Day-of-week for a given ISO date. */
export function dayOfWeek(iso: string): DayOfWeek {
  const d = new Date(`${iso}T00:00:00Z`);
  return DAYS_OF_WEEK[(d.getUTCDay() + 6) % 7];
}

// ─────────────────────────────────────────────────────────────────────────────
// Estate + format
// ─────────────────────────────────────────────────────────────────────────────

export type Estate = {
  id: EstateId;
  name: string;
  /** Template defaults cascade from estate → format → site. */
  defaults: {
    cutoffTimeForSpokeSubmissions: string; // HH:MM (24h)
    forecastHorizonDays: number;
    carryOverEnabled: boolean;
  };
};

export type Format = {
  id: FormatId;
  estateId: EstateId;
  name: string;
  /** Format-level override of estate defaults (optional). */
  overrides?: Partial<Estate['defaults']>;
  /** Site shape fingerprint — "corner shop", "airport concourse", etc. */
  description: string;
};

export const PRET_ESTATE: Estate = {
  id: 'estate-pret',
  name: 'Pret a Manger',
  defaults: {
    cutoffTimeForSpokeSubmissions: '15:00',
    forecastHorizonDays: 5,
    carryOverEnabled: true,
  },
};

export const PRET_FORMATS: Format[] = [
  {
    id: 'format-corner',
    estateId: 'estate-pret',
    name: 'Corner shop',
    description: 'High-street format. 06:00–22:00 opening. Standard run profile.',
  },
  {
    id: 'format-airport',
    estateId: 'estate-pret',
    name: 'Airport concourse',
    description: 'Extended hours (04:30–23:00). Commuter-heavy. Longer increment runs.',
    overrides: {
      cutoffTimeForSpokeSubmissions: '14:00',
      forecastHorizonDays: 7,
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sites
// ─────────────────────────────────────────────────────────────────────────────

export type Site = {
  id: SiteId;
  estateId: EstateId;
  formatId: FormatId;
  name: string;
  type: SiteType;
  /** Opening hours (HH:MM). */
  openingHours: { open: string; close: string };
  /**
   * For SPOKE + HYBRID sites: the hub they pull from.
   * For STANDALONE sites with `linkType: 'linked'` (PAC139 dark-kitchen
   * pattern): the hub that produces on their behalf so the hub gets full
   * visibility on what must be produced and can transfer in bulk.
   */
  hubId?: SiteId;
  /**
   * Whether a STANDALONE site is fully self-producing or has been linked to
   * a hub kitchen for some / all production. SPOKE sites are always linked
   * by definition; HYBRID sites are always partially linked. STANDALONE
   * defaults to 'self' when omitted.
   */
  linkType?: 'self' | 'linked';
  /** For HUB + HYBRID sites: spokes / linked-standalones they supply. */
  servesSiteIds?: SiteId[];
  /**
   * Demand size relative to the parent hub for hub-linked sites. Used to
   * derive a per-site forecast from the hub's hand-authored forecast when
   * no site-specific entry exists. Roughly:
   *   linkedForecast = hubForecast × salesFactor
   * Defaults to 0.4 when not set.
   */
  salesFactor?: number;
};

export const PRET_SITES: Site[] = [
  {
    id: 'hub-central',
    estateId: 'estate-pret',
    formatId: 'format-corner',
    name: 'London Central Hub',
    type: 'HUB',
    openingHours: { open: '04:30', close: '22:00' },
    servesSiteIds: [
      'site-spoke-south',
      'site-spoke-east',
      'site-spoke-west',
      'site-standalone-north',
    ],
  },
  {
    id: 'site-standalone-north',
    estateId: 'estate-pret',
    formatId: 'format-corner',
    name: 'Islington North',
    type: 'STANDALONE',
    openingHours: { open: '06:00', close: '22:00' },
    // PAC139 — dark-kitchen pattern. Site keeps its own counter + minimal
    // prep kit but the bakery range is produced by the hub and dispatched
    // overnight. Sales factor is higher than a typical spoke because this
    // is its own front-of-house, not a satellite.
    hubId: 'hub-central',
    linkType: 'linked',
    salesFactor: 0.55,
  },
  {
    id: 'site-spoke-south',
    estateId: 'estate-pret',
    formatId: 'format-corner',
    name: 'Clapham Junction',
    type: 'SPOKE',
    openingHours: { open: '06:00', close: '22:00' },
    hubId: 'hub-central',
    salesFactor: 0.30,
  },
  {
    id: 'site-spoke-east',
    estateId: 'estate-pret',
    formatId: 'format-corner',
    name: 'Shoreditch East',
    type: 'SPOKE',
    openingHours: { open: '06:30', close: '21:30' },
    hubId: 'hub-central',
    salesFactor: 0.45,
  },
  {
    id: 'site-spoke-west',
    estateId: 'estate-pret',
    formatId: 'format-corner',
    name: 'Notting Hill West',
    type: 'SPOKE',
    openingHours: { open: '06:30', close: '21:00' },
    hubId: 'hub-central',
    salesFactor: 0.40,
  },
  {
    id: 'site-hybrid-airport',
    estateId: 'estate-pret',
    formatId: 'format-airport',
    name: 'Heathrow T5',
    type: 'HYBRID',
    openingHours: { open: '04:30', close: '23:00' },
    hubId: 'hub-central', // still pulls proofed dough from hub
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Benches (stations)
// ─────────────────────────────────────────────────────────────────────────────

export type BatchRules = {
  min: number;
  max: number;
  multipleOf: number;
};

/**
 * A scheduled production "run" on a bench — a fixed time slot during which the
 * team works through a planned batch of recipes (R1 morning bake, R2 lunch
 * bake, etc). Only meaningful on benches with primaryMode='run'. Rows are
 * bucketed into runs at render time based on when their demand lands across
 * the day (morning vs midday vs afternoon).
 */
export type RunSchedule = {
  id: string;
  /** Short label ("R1"). Full label composes from bench + time window. */
  label: string;
  /** HH:MM — start of the run. */
  startTime: string;
  /** Planned length of this run (minutes). */
  durationMinutes: number;
};

export type Bench = {
  id: BenchId;
  siteId: SiteId;
  name: string;
  /**
   * Legacy capability list — mixes activity (`prep`, `assemble`, `pack`)
   * with equipment (`oven`, `proofing`, `cold-prep`). Still used by
   * existing routing logic; will gradually shrink to pure equipment as
   * `workTypes` + `equipment` take over.
   */
  capabilities: BenchCapability[];
  /**
   * Activity buckets this bench supports — the canonical taxonomy. If
   * not set, derives from `capabilities` via `benchWorkTypes`. Set
   * explicitly to broaden a bench beyond its capability defaults
   * (e.g. an assembly bench that also handles slice work).
   */
  workTypes?: WorkType[];
  /**
   * Specific equipment present at this bench. If not set, derives from
   * `capabilities` via `benchEquipment`. Used together with `workTypes`
   * to route stages with `requiresEquipment` set.
   */
  equipment?: Equipment[];
  /** Bench-level batch rules (hardware limits). Recipe rules win if set. */
  batchRules?: BatchRules;
  /** Whether bench is currently online (false = out of service). */
  online: boolean;
  /**
   * The mode this bench is set up for during service. Pret (and most kitchens
   * we've seen) run one mode per bench so the team, station and tooling are
   * predictable across the day. Other-mode work (e.g. next-day filling prep)
   * only happens after the primary mode's runs are done and is rendered
   * separately as an "After service" tail on the card.
   */
  primaryMode?: ProductionMode;
  /**
   * Scheduled runs for run-mode benches. The board buckets recipes into each
   * run based on when their demand lands and surfaces "Next run" in the card
   * header.
   */
  runs?: RunSchedule[];
};

export const PRET_BENCHES: Bench[] = [
  // hub-central
  // ─── hub-central: 7 benches — one variable, three runs, one increment,
  //                  one grill, one assembly. Matches the layout we're
  //                  prototyping for Pret-style hub kitchens.
  {
    id: 'bench-variable',
    siteId: 'hub-central',
    name: 'Variable bench',
    capabilities: ['cold-prep', 'pack'],
    online: true,
    primaryMode: 'variable',
  },
  {
    id: 'bench-run-bakery',
    siteId: 'hub-central',
    name: 'Bakery oven',
    capabilities: ['oven', 'proofing'],
    batchRules: { min: 6, max: 24, multipleOf: 6 },
    online: true,
    primaryMode: 'run',
    runs: [
      // Night shift — long-ferment doughs and overnight-cool items get
      // started here so they're ready for handover by 05:00. Order within
      // this run is governed by PRET_NIGHT_SHIFT_POLICY (PAC070).
      { id: 'n1', label: 'N1', startTime: '00:00', durationMinutes: 300 },
      { id: 'r1', label: 'R1', startTime: '05:00', durationMinutes: 180 },
      { id: 'r2', label: 'R2', startTime: '10:30', durationMinutes: 90 },
    ],
  },
  {
    id: 'bench-run-cold-prep',
    siteId: 'hub-central',
    name: 'Cold prep (fillings)',
    capabilities: ['cold-prep', 'prep'],
    online: true,
    primaryMode: 'run',
    runs: [
      // Night shift on cold prep handles fillings that need to chill several
      // hours before assembly hits R1 sandwich build at 05:30.
      { id: 'n1', label: 'N1', startTime: '00:00', durationMinutes: 240 },
      { id: 'r1', label: 'R1', startTime: '05:30', durationMinutes: 150 },
      { id: 'r2', label: 'R2', startTime: '10:30', durationMinutes: 90 },
    ],
  },
  {
    id: 'bench-run-hot-prep',
    siteId: 'hub-central',
    name: 'Hot prep (roasts)',
    capabilities: ['prep'],
    online: true,
    primaryMode: 'run',
    runs: [
      { id: 'r1', label: 'R1', startTime: '06:00', durationMinutes: 180 },
    ],
  },
  {
    id: 'bench-increment-hot',
    siteId: 'hub-central',
    name: 'Hot shelf increments',
    capabilities: ['oven', 'prep'],
    batchRules: { min: 4, max: 18, multipleOf: 2 },
    online: true,
    primaryMode: 'increment',
  },
  {
    id: 'bench-grill',
    siteId: 'hub-central',
    name: 'Grill (sandwich components)',
    capabilities: ['prep'],
    online: true,
    primaryMode: 'run',
    runs: [
      { id: 'r1', label: 'R1', startTime: '08:00', durationMinutes: 120 },
      { id: 'r2', label: 'R2', startTime: '11:00', durationMinutes: 90 },
    ],
  },
  {
    id: 'bench-assembly',
    siteId: 'hub-central',
    name: 'Sandwich & salad assembly',
    capabilities: ['assemble'],
    online: true,
    primaryMode: 'variable',
  },

  // site-standalone-north
  {
    id: 'bench-north-oven',
    siteId: 'site-standalone-north',
    name: 'Convection oven',
    capabilities: ['oven'],
    batchRules: { min: 4, max: 12, multipleOf: 4 },
    online: true,
    primaryMode: 'run',
  },
  {
    id: 'bench-north-prep',
    siteId: 'site-standalone-north',
    name: 'Prep bench',
    capabilities: ['prep', 'assemble'],
    online: true,
    primaryMode: 'variable',
  },
  {
    id: 'bench-north-counter',
    siteId: 'site-standalone-north',
    name: 'Front counter',
    capabilities: ['front-of-house'],
    online: true,
  },

  // site-spoke-south (receives from hub — minimal kit)
  {
    id: 'bench-south-counter',
    siteId: 'site-spoke-south',
    name: 'Front counter',
    capabilities: ['front-of-house'],
    online: true,
  },

  // site-hybrid-airport
  {
    id: 'bench-airport-oven',
    siteId: 'site-hybrid-airport',
    name: 'Airport oven',
    capabilities: ['oven'],
    batchRules: { min: 4, max: 12, multipleOf: 4 },
    online: true,
    primaryMode: 'increment',
  },
  {
    id: 'bench-airport-prep',
    siteId: 'site-hybrid-airport',
    name: 'Airport prep',
    capabilities: ['prep', 'cold-prep'],
    online: true,
    primaryMode: 'run',
  },
  {
    id: 'bench-airport-assemble',
    siteId: 'site-hybrid-airport',
    name: 'Airport assemble',
    capabilities: ['assemble', 'pack'],
    online: true,
    primaryMode: 'variable',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Recipes (production view — narrower than full Recipe in libraryFixtures)
// ─────────────────────────────────────────────────────────────────────────────

export type SubRecipeRef = {
  recipeId: RecipeId;
  /** Quantity of the sub-recipe consumed per one unit of the parent assembly. */
  quantityPerUnit: number;
  unit: string; // 'unit', 'g', 'ml', etc.
};

export type ProductionRecipe = {
  id: RecipeId;
  name: string;
  category: 'Bakery' | 'Sandwich' | 'Snack' | 'Beverage' | 'Salad';
  /** Canonical shelf life from bake/assemble point. null = no shelf constraint. */
  shelfLifeMinutes: number | null;
  /** Recipe-level batch rules (wins over bench rules when present). */
  batchRules?: BatchRules;
  /** SKU equivalence — V1 is 1:1 (post-V1 a Product overlay resolves 1:N). */
  skuId: SkuId;
  /** Assembly? When non-empty this is an AssemblyRecipe. */
  subRecipes?: SubRecipeRef[];
  /** Whether today's unsolds can carry into tomorrow's plan. */
  allowCarryOver: boolean;
  /** Tags used by Quinn when scheduling within a tier. */
  selectionTags: SelectionTag[];
  /** Canonical workflow id. */
  workflowId: WorkflowId;
  /** Default mode — but still per-SKU authoritative on ProductionItem. */
  defaultMode: ProductionMode;
  /**
   * Marks the recipe as a prep / sub-recipe component even when no current
   * assembly explicitly pulls it (e.g. day-end mise for tomorrow). The
   * Today view groups it under the Components tab so a manager can find
   * all prep work in one place. Items that ARE pulled by today's
   * assemblies surface as components automatically — this flag is only
   * needed for orphan prep batches.
   */
  isPrep?: boolean;
};

export const PRET_RECIPES: ProductionRecipe[] = [
  {
    id: 'prec-croissant',
    name: 'All-butter croissant',
    category: 'Bakery',
    shelfLifeMinutes: 8 * 60,
    batchRules: { min: 6, max: 24, multipleOf: 6 },
    skuId: 'sku-croissant',
    allowCarryOver: true,
    selectionTags: ['breakfast', 'morning'],
    workflowId: 'wf-croissant',
    defaultMode: 'run',
  },
  {
    id: 'prec-pain-au-chocolat',
    name: 'Pain au chocolat',
    category: 'Bakery',
    shelfLifeMinutes: 8 * 60,
    batchRules: { min: 6, max: 24, multipleOf: 6 },
    skuId: 'sku-pain-au-choc',
    allowCarryOver: true,
    selectionTags: ['breakfast', 'morning'],
    workflowId: 'wf-croissant', // shares shape with croissant
    defaultMode: 'run',
  },
  {
    id: 'prec-cookie',
    name: 'Double chocolate cookie',
    category: 'Bakery',
    shelfLifeMinutes: 120,
    // Recipe-level cap tighter than oven's 12 → surfaces the "recipe wins" rule
    batchRules: { min: 4, max: 8, multipleOf: 4 },
    skuId: 'sku-cookie',
    allowCarryOver: false,
    selectionTags: ['midday', 'afternoon', 'closing'],
    workflowId: 'wf-cookie',
    defaultMode: 'increment',
  },
  {
    id: 'prec-brewed-coffee',
    name: 'Brewed filter coffee (2L urn)',
    category: 'Beverage',
    shelfLifeMinutes: 60,
    batchRules: { min: 1, max: 1, multipleOf: 1 },
    skuId: 'sku-brewed-coffee',
    allowCarryOver: false,
    selectionTags: ['breakfast', 'morning', 'afternoon'],
    workflowId: 'wf-brewed-coffee',
    defaultMode: 'increment',
  },
  {
    id: 'prec-ciabatta',
    name: 'Ciabatta loaf',
    category: 'Bakery',
    shelfLifeMinutes: 12 * 60,
    batchRules: { min: 6, max: 24, multipleOf: 6 },
    skuId: 'sku-ciabatta',
    allowCarryOver: false, // consumed internally by assembly, not sold as-is
    selectionTags: ['core'],
    workflowId: 'wf-ciabatta',
    defaultMode: 'run',
  },
  {
    id: 'prec-chicken-mayo-filling',
    name: 'Chicken & mayo filling',
    category: 'Sandwich',
    shelfLifeMinutes: 4 * 60,
    batchRules: { min: 1, max: 4, multipleOf: 1 }, // 1 batch = 4kg tray
    skuId: 'sku-chicken-mayo-filling',
    allowCarryOver: false,
    selectionTags: ['core'],
    workflowId: 'wf-filling',
    defaultMode: 'run',
  },
  {
    id: 'prec-club-sandwich',
    name: 'Classic club sandwich',
    category: 'Sandwich',
    shelfLifeMinutes: 8 * 60,
    skuId: 'sku-club-sandwich',
    subRecipes: [
      { recipeId: 'prec-ciabatta', quantityPerUnit: 1, unit: 'unit' },
      { recipeId: 'prec-chicken-mayo-filling', quantityPerUnit: 80, unit: 'g' },
      // 1 strip of crispy bacon per club sandwich — wires the bacon prep
      // line into the assembly cascade so its production qty is derived.
      { recipeId: 'prec-crispy-bacon', quantityPerUnit: 1, unit: 'unit' },
    ],
    allowCarryOver: true,
    selectionTags: ['core', 'midday'],
    workflowId: 'wf-sandwich',
    defaultMode: 'variable',
  },
  {
    id: 'prec-salad-bowl',
    name: 'Super-greens salad bowl',
    category: 'Salad',
    shelfLifeMinutes: 6 * 60,
    skuId: 'sku-salad-bowl',
    allowCarryOver: false,
    selectionTags: ['core', 'midday'],
    workflowId: 'wf-salad',
    defaultMode: 'variable',
  },

  // ─── Additional bakery ───────────────────────────────────────────────────
  { id: 'prec-almond-croissant', name: 'Almond croissant', category: 'Bakery', shelfLifeMinutes: 8 * 60, batchRules: { min: 6, max: 18, multipleOf: 6 }, skuId: 'sku-almond-croissant', allowCarryOver: true, selectionTags: ['breakfast', 'morning'], workflowId: 'wf-croissant', defaultMode: 'run' },
  { id: 'prec-cinnamon-swirl',   name: 'Cinnamon swirl',    category: 'Bakery', shelfLifeMinutes: 8 * 60, batchRules: { min: 6, max: 12, multipleOf: 6 }, skuId: 'sku-cinnamon-swirl',   allowCarryOver: true,  selectionTags: ['breakfast', 'morning'],            workflowId: 'wf-croissant', defaultMode: 'run' },
  { id: 'prec-baguette',         name: 'White baguette',    category: 'Bakery', shelfLifeMinutes: 12 * 60, batchRules: { min: 6, max: 18, multipleOf: 6 }, skuId: 'sku-baguette',         allowCarryOver: false, selectionTags: ['core'],                             workflowId: 'wf-ciabatta',  defaultMode: 'run' },
  { id: 'prec-granary',          name: 'Granary loaf',      category: 'Bakery', shelfLifeMinutes: 12 * 60, batchRules: { min: 4, max: 12, multipleOf: 2 }, skuId: 'sku-granary',          allowCarryOver: false, selectionTags: ['core'],                             workflowId: 'wf-ciabatta',  defaultMode: 'run' },
  { id: 'prec-focaccia',         name: 'Rosemary focaccia', category: 'Bakery', shelfLifeMinutes: 8 * 60,  batchRules: { min: 4, max: 8,  multipleOf: 2 }, skuId: 'sku-focaccia',         allowCarryOver: false, selectionTags: ['core'],                             workflowId: 'wf-ciabatta',  defaultMode: 'run' },
  { id: 'prec-blueberry-muffin', name: 'Blueberry muffin',  category: 'Bakery', shelfLifeMinutes: 24 * 60, batchRules: { min: 6, max: 12, multipleOf: 6 }, skuId: 'sku-blueberry-muffin', allowCarryOver: true,  selectionTags: ['morning', 'midday', 'afternoon'],   workflowId: 'wf-cookie',    defaultMode: 'run' },
  { id: 'prec-banana-bread',     name: 'Banana bread slice',category: 'Bakery', shelfLifeMinutes: 24 * 60, batchRules: { min: 8, max: 16, multipleOf: 8 }, skuId: 'sku-banana-bread',     allowCarryOver: true,  selectionTags: ['midday', 'afternoon'],              workflowId: 'wf-cookie',    defaultMode: 'run' },
  { id: 'prec-brownie',          name: 'Chocolate brownie', category: 'Bakery', shelfLifeMinutes: 48 * 60, batchRules: { min: 8, max: 16, multipleOf: 8 }, skuId: 'sku-brownie',          allowCarryOver: true,  selectionTags: ['midday', 'afternoon', 'closing'],   workflowId: 'wf-cookie',    defaultMode: 'run' },

  // ─── Sub-recipes / fillings ──────────────────────────────────────────────
  { id: 'prec-egg-mayo-filling',  name: 'Egg mayo filling',  category: 'Sandwich', shelfLifeMinutes: 4 * 60,  batchRules: { min: 1, max: 4, multipleOf: 1 }, skuId: 'sku-egg-mayo-filling',  allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },
  { id: 'prec-tuna-mayo-filling', name: 'Tuna mayo filling', category: 'Sandwich', shelfLifeMinutes: 4 * 60,  batchRules: { min: 1, max: 4, multipleOf: 1 }, skuId: 'sku-tuna-mayo-filling', allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },
  { id: 'prec-hummus',            name: 'Classic hummus',    category: 'Sandwich', shelfLifeMinutes: 12 * 60, batchRules: { min: 1, max: 3, multipleOf: 1 }, skuId: 'sku-hummus',            allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },

  // ─── Assembly sandwiches ─────────────────────────────────────────────────
  { id: 'prec-egg-mayo-sandwich',   name: 'Egg mayo sandwich',        category: 'Sandwich', shelfLifeMinutes: 8 * 60, skuId: 'sku-egg-mayo-sandwich',   subRecipes: [{ recipeId: 'prec-granary',  quantityPerUnit: 1,  unit: 'unit' }, { recipeId: 'prec-egg-mayo-filling',  quantityPerUnit: 80, unit: 'g' }], allowCarryOver: true, selectionTags: ['core', 'midday'], workflowId: 'wf-sandwich', defaultMode: 'variable' },
  { id: 'prec-ham-cheese-baguette', name: 'Ham & cheese baguette',    category: 'Sandwich', shelfLifeMinutes: 8 * 60, skuId: 'sku-ham-cheese-baguette', subRecipes: [{ recipeId: 'prec-baguette', quantityPerUnit: 1,  unit: 'unit' }],                                                                          allowCarryOver: true, selectionTags: ['core', 'midday'], workflowId: 'wf-sandwich', defaultMode: 'variable' },
  { id: 'prec-tuna-sandwich',       name: 'Tuna & sweetcorn sandwich',category: 'Sandwich', shelfLifeMinutes: 8 * 60, skuId: 'sku-tuna-sandwich',       subRecipes: [{ recipeId: 'prec-granary',  quantityPerUnit: 1,  unit: 'unit' }, { recipeId: 'prec-tuna-mayo-filling', quantityPerUnit: 80, unit: 'g' }], allowCarryOver: true, selectionTags: ['core', 'midday'], workflowId: 'wf-sandwich', defaultMode: 'variable' },
  { id: 'prec-hummus-wrap',         name: 'Hummus & roasted veg wrap',category: 'Sandwich', shelfLifeMinutes: 8 * 60, skuId: 'sku-hummus-wrap',         subRecipes: [{ recipeId: 'prec-hummus',   quantityPerUnit: 60, unit: 'g' }],                                                                           allowCarryOver: true, selectionTags: ['core', 'midday'], workflowId: 'wf-sandwich', defaultMode: 'variable' },
  { id: 'prec-turkey-brie-baguette',name: 'Turkey & brie baguette',   category: 'Sandwich', shelfLifeMinutes: 8 * 60, skuId: 'sku-turkey-brie-baguette',subRecipes: [{ recipeId: 'prec-baguette', quantityPerUnit: 1,  unit: 'unit' }],                                                                          allowCarryOver: true, selectionTags: ['core', 'midday'], workflowId: 'wf-sandwich', defaultMode: 'variable' },

  // ─── Salads ──────────────────────────────────────────────────────────────
  { id: 'prec-chicken-caesar', name: 'Chicken Caesar salad',       category: 'Salad', shelfLifeMinutes: 6 * 60, skuId: 'sku-chicken-caesar', allowCarryOver: false, selectionTags: ['core', 'midday'], workflowId: 'wf-salad', defaultMode: 'variable' },
  { id: 'prec-med-grain-bowl', name: 'Mediterranean grain bowl',   category: 'Salad', shelfLifeMinutes: 6 * 60, skuId: 'sku-med-grain-bowl', allowCarryOver: false, selectionTags: ['core', 'midday'], workflowId: 'wf-salad', defaultMode: 'variable' },
  { id: 'prec-chicken-pasta',  name: 'Chicken pesto pasta',        category: 'Salad', shelfLifeMinutes: 6 * 60, skuId: 'sku-chicken-pasta',  allowCarryOver: false, selectionTags: ['core', 'midday'], workflowId: 'wf-salad', defaultMode: 'variable' },
  { id: 'prec-falafel-bowl',   name: 'Falafel & hummus bowl',      category: 'Salad', shelfLifeMinutes: 6 * 60, skuId: 'sku-falafel-bowl',   allowCarryOver: false, selectionTags: ['core', 'midday'], workflowId: 'wf-salad', defaultMode: 'variable' },

  // ─── Pots & snacks ───────────────────────────────────────────────────────
  { id: 'prec-fruit-pot',   name: 'Fresh fruit pot',       category: 'Snack', shelfLifeMinutes: 24 * 60, batchRules: { min: 4, max: 12, multipleOf: 2 }, skuId: 'sku-fruit-pot',   allowCarryOver: true, selectionTags: ['morning', 'midday', 'afternoon'], workflowId: 'wf-filling', defaultMode: 'variable' },
  { id: 'prec-yogurt-pot',  name: 'Greek yogurt & honey',  category: 'Snack', shelfLifeMinutes: 24 * 60, batchRules: { min: 4, max: 12, multipleOf: 2 }, skuId: 'sku-yogurt-pot',  allowCarryOver: true, selectionTags: ['breakfast', 'morning'],           workflowId: 'wf-filling', defaultMode: 'variable' },
  { id: 'prec-granola-pot', name: 'Granola & berries pot', category: 'Snack', shelfLifeMinutes: 24 * 60, batchRules: { min: 4, max: 10, multipleOf: 2 }, skuId: 'sku-granola-pot', allowCarryOver: true, selectionTags: ['breakfast', 'morning'],           workflowId: 'wf-filling', defaultMode: 'variable' },

  // ─── Beverages ───────────────────────────────────────────────────────────
  { id: 'prec-iced-coffee',    name: 'Iced caramel latte (2L)', category: 'Beverage', shelfLifeMinutes: 4 * 60, batchRules: { min: 1, max: 1, multipleOf: 1 }, skuId: 'sku-iced-coffee',    allowCarryOver: false, selectionTags: ['midday', 'afternoon'],               workflowId: 'wf-brewed-coffee', defaultMode: 'increment' },
  { id: 'prec-green-smoothie', name: 'Green smoothie',          category: 'Beverage', shelfLifeMinutes: 4 * 60, batchRules: { min: 1, max: 2, multipleOf: 1 }, skuId: 'sku-green-smoothie', allowCarryOver: false, selectionTags: ['breakfast', 'morning', 'midday'], workflowId: 'wf-brewed-coffee', defaultMode: 'increment' },
  { id: 'prec-porridge',       name: 'Oat porridge pot',        category: 'Bakery',   shelfLifeMinutes: 90,     batchRules: { min: 2, max: 6, multipleOf: 2 }, skuId: 'sku-porridge',       allowCarryOver: false, selectionTags: ['breakfast', 'morning'],             workflowId: 'wf-brewed-coffee', defaultMode: 'increment' },

  // ─── Hot-prep runs ───────────────────────────────────────────────────────
  { id: 'prec-roast-chicken', name: 'Pulled roast chicken (tray)', category: 'Sandwich', shelfLifeMinutes: 12 * 60, batchRules: { min: 1, max: 4, multipleOf: 1 }, skuId: 'sku-roast-chicken', allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },
  { id: 'prec-bolognese',     name: 'Slow-cooked bolognese',       category: 'Sandwich', shelfLifeMinutes: 12 * 60, batchRules: { min: 1, max: 3, multipleOf: 1 }, skuId: 'sku-bolognese',     allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },
  { id: 'prec-pulled-pork',   name: 'Pulled pork (tray)',          category: 'Sandwich', shelfLifeMinutes: 12 * 60, batchRules: { min: 1, max: 3, multipleOf: 1 }, skuId: 'sku-pulled-pork',   allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },

  // ─── Grill bench: hot components that feed sandwich assembly ────────────
  { id: 'prec-grilled-chicken',  name: 'Grilled chicken strips', category: 'Sandwich', shelfLifeMinutes: 4 * 60, batchRules: { min: 1, max: 3, multipleOf: 1 }, skuId: 'sku-grilled-chicken',  allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },
  { id: 'prec-grilled-halloumi', name: 'Chargrilled halloumi',   category: 'Sandwich', shelfLifeMinutes: 4 * 60, batchRules: { min: 1, max: 3, multipleOf: 1 }, skuId: 'sku-grilled-halloumi', allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },
  { id: 'prec-chargrilled-veg',  name: 'Chargrilled peppers & veg', category: 'Sandwich', shelfLifeMinutes: 4 * 60, batchRules: { min: 1, max: 3, multipleOf: 1 }, skuId: 'sku-chargrilled-veg', allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },
  { id: 'prec-crispy-bacon',     name: 'Crispy bacon',           category: 'Sandwich', shelfLifeMinutes: 4 * 60, batchRules: { min: 1, max: 3, multipleOf: 1 }, skuId: 'sku-crispy-bacon',     allowCarryOver: false, selectionTags: ['core'], workflowId: 'wf-filling', defaultMode: 'run' },

  // ─── Hot shelf increments (short shelf-life, baked through the day) ─────
  { id: 'prec-hot-croissant',  name: 'Hot croissant refresh',   category: 'Bakery', shelfLifeMinutes: 90,     batchRules: { min: 4, max: 12, multipleOf: 2 }, skuId: 'sku-hot-croissant',  allowCarryOver: false, selectionTags: ['morning', 'midday'],             workflowId: 'wf-cookie', defaultMode: 'increment' },
  { id: 'prec-cheese-twist',   name: 'Cheese & marmite twist',  category: 'Bakery', shelfLifeMinutes: 3 * 60, batchRules: { min: 4, max: 12, multipleOf: 2 }, skuId: 'sku-cheese-twist',   allowCarryOver: false, selectionTags: ['morning', 'midday', 'afternoon'], workflowId: 'wf-cookie', defaultMode: 'increment' },
  { id: 'prec-sausage-roll',   name: 'Sausage roll',            category: 'Bakery', shelfLifeMinutes: 4 * 60, batchRules: { min: 4, max: 12, multipleOf: 2 }, skuId: 'sku-sausage-roll',   allowCarryOver: false, selectionTags: ['midday', 'afternoon'],           workflowId: 'wf-cookie', defaultMode: 'increment' },
  { id: 'prec-soup-day',       name: 'Soup of the day (2L)',    category: 'Sandwich',shelfLifeMinutes: 4 * 60, batchRules: { min: 1, max: 2,  multipleOf: 1 }, skuId: 'sku-soup-day',       allowCarryOver: false, selectionTags: ['midday', 'afternoon'],           workflowId: 'wf-filling', defaultMode: 'increment' },
  { id: 'prec-pizza-slice',    name: 'Pizza slice',             category: 'Bakery', shelfLifeMinutes: 90,     batchRules: { min: 4, max: 12, multipleOf: 2 }, skuId: 'sku-pizza-slice',    allowCarryOver: false, selectionTags: ['midday', 'afternoon'],           workflowId: 'wf-cookie', defaultMode: 'increment' },

  // ─── End-of-day next-day prep (off-mode on run benches) ─────────────────
  { id: 'prec-eod-chicken-prep', name: 'Tomorrow: chicken filling mise', category: 'Sandwich', shelfLifeMinutes: 12 * 60, batchRules: { min: 1, max: 4, multipleOf: 1 }, skuId: 'sku-eod-chicken-prep', allowCarryOver: false, selectionTags: ['closing'], workflowId: 'wf-filling', defaultMode: 'variable', isPrep: true },
  { id: 'prec-eod-dough-prep',   name: 'Tomorrow: dough proof',          category: 'Bakery',   shelfLifeMinutes: 18 * 60, batchRules: { min: 1, max: 6, multipleOf: 1 }, skuId: 'sku-eod-dough-prep',   allowCarryOver: false, selectionTags: ['closing'], workflowId: 'wf-filling', defaultMode: 'variable', isPrep: true },
  { id: 'prec-eod-roast-prep',   name: 'Tomorrow: roast & stock prep',   category: 'Sandwich', shelfLifeMinutes: 18 * 60, batchRules: { min: 1, max: 4, multipleOf: 1 }, skuId: 'sku-eod-roast-prep',   allowCarryOver: false, selectionTags: ['closing'], workflowId: 'wf-filling', defaultMode: 'variable', isPrep: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Workflows (DAG)
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowStage = {
  id: StageId;
  label: string;
  capability: BenchCapability;
  /**
   * Activity bucket for the Run sheet and stage-level tag chips. Optional
   * — if omitted we derive it from `capability` via
   * `workTypeFromCapability`. Set explicitly when the default is wrong
   * (e.g. coffee `brew` runs on `cold-prep` capability but is really
   * `cook` work).
   */
  workType?: WorkType;
  /**
   * Specific equipment this stage needs *beyond* its work type. Most
   * stages won't set this — it's the escape hatch for stages whose work
   * type alone doesn't pin down a bench (e.g. a "Cook" stage that needs
   * a `proofer` specifically).
   */
  requiresEquipment?: Equipment[];
  /** -2 = D-2, -1 = D-1, 0 = D0 (same day as consumption). V1 max = -2. */
  leadOffset: -2 | -1 | 0;
  /** Estimated duration for planning a batch of default size (minutes). */
  durationMinutes: number;
  optional?: boolean;
  /** Stages in the same parallelGroup can run concurrently. */
  parallelGroup?: string;
};

export type WorkflowEdge = { from: StageId; to: StageId };

export type ProductionWorkflow = {
  id: WorkflowId;
  stages: WorkflowStage[];
  edges: WorkflowEdge[];
};

export const PRET_WORKFLOWS: Record<WorkflowId, ProductionWorkflow> = {
  'wf-croissant': {
    id: 'wf-croissant',
    stages: [
      // Proofing capability defaults to `proof` work type; explicit
      // `proofer` equipment so the Run sheet routes to the proofing
      // bench rather than any cold bench.
      { id: 'ferment', label: 'Overnight ferment', capability: 'proofing', workType: 'proof', requiresEquipment: ['proofer'], leadOffset: -1, durationMinutes: 8 * 60 },
      { id: 'bake', label: 'Bake', capability: 'oven', workType: 'bake', requiresEquipment: ['oven'], leadOffset: 0, durationMinutes: 18 },
      // Cool runs on a cold-prep bench but the *work* is `chill` — it's
      // a passive cool-down, not active mise. Explicit `chill` keeps it
      // out of the Mise bucket on the Run sheet.
      { id: 'cool', label: 'Cool', capability: 'cold-prep', workType: 'chill', requiresEquipment: ['walk-in-chiller'], leadOffset: 0, durationMinutes: 12 },
      { id: 'pack', label: 'Pack', capability: 'pack', workType: 'pack', leadOffset: 0, durationMinutes: 10 },
    ],
    edges: [
      { from: 'ferment', to: 'bake' },
      { from: 'bake', to: 'cool' },
      { from: 'cool', to: 'pack' },
    ],
  },
  'wf-cookie': {
    id: 'wf-cookie',
    stages: [
      { id: 'bake', label: 'Bake', capability: 'oven', workType: 'bake', requiresEquipment: ['oven'], leadOffset: 0, durationMinutes: 12 },
    ],
    edges: [],
  },
  'wf-brewed-coffee': {
    id: 'wf-brewed-coffee',
    stages: [
      // `brew` runs on a cold-prep bench (no oven needed) but is hot
      // mixing — combining hot water with grounds. Closest fit in the
      // current canonical work-type set is `mix`. If brewing becomes a
      // common enough operational shape to deserve its own bucket on
      // the Run sheet, add a `boil` / `brew` work type to WorkType.
      { id: 'brew', label: 'Brew', capability: 'cold-prep', workType: 'mix', leadOffset: 0, durationMinutes: 6 },
    ],
    edges: [],
  },
  'wf-ciabatta': {
    id: 'wf-ciabatta',
    stages: [
      { id: 'ferment', label: 'Overnight ferment', capability: 'proofing', workType: 'proof', requiresEquipment: ['proofer'], leadOffset: -1, durationMinutes: 10 * 60 },
      { id: 'bake', label: 'Bake', capability: 'oven', workType: 'bake', requiresEquipment: ['oven'], leadOffset: 0, durationMinutes: 25 },
    ],
    edges: [{ from: 'ferment', to: 'bake' }],
  },
  'wf-filling': {
    id: 'wf-filling',
    stages: [
      // Filling prep is hands-on cold work — `mix` (combining ingredients
      // into a uniform spread) rather than the generic `mise` default
      // from the cold-prep capability.
      { id: 'prep', label: 'Prep filling', capability: 'cold-prep', workType: 'mix', leadOffset: 0, durationMinutes: 30 },
    ],
    edges: [],
  },
  'wf-sandwich': {
    // demonstrates D-2 depth: ciabatta ferment is a dependency two days out for some hubs
    id: 'wf-sandwich',
    stages: [
      { id: 'assemble', label: 'Assemble', capability: 'assemble', workType: 'assemble', leadOffset: 0, durationMinutes: 4 },
    ],
    edges: [],
  },
  'wf-salad': {
    id: 'wf-salad',
    stages: [
      // Plating a salad is assembly work, not generic prep. Explicit
      // `assemble` keeps it in the Build bucket on the Run sheet.
      { id: 'prep', label: 'Plate to order', capability: 'prep', workType: 'assemble', leadOffset: 0, durationMinutes: 3 },
    ],
    edges: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Production items — per-SKU attachment: which site makes which recipe, how
// ─────────────────────────────────────────────────────────────────────────────

export type IncrementCadence = {
  /** How often a fresh batch should drop. */
  intervalMinutes: number;
  /** Start/end within the day (inclusive). HH:MM. */
  startTime: string;
  endTime: string;
  /** Quinn's proposal — the hub can override at the site level. */
  quinnProposed: boolean;
};

export type ProductionItem = {
  id: ProductionItemId;
  siteId: SiteId;
  recipeId: RecipeId;
  skuId: SkuId;
  mode: ProductionMode;
  /** Default batch size for planning (subject to batch rules + forecast). */
  batchSize: number;
  /** Only populated when mode === 'increment'. */
  cadence?: IncrementCadence;
  /**
   * Explicit bench override. When set, this bench is used as the item's
   * primary bench regardless of workflow capability or mode match. Used for
   * intentional off-mode work like next-day prep that happens on a run bench
   * after service, or for grouping hot components onto a dedicated grill
   * bench even though they have generic 'prep' capability.
   */
  preferredBenchId?: BenchId;
  /**
   * Bench-time target for a single default-sized batch (minutes).
   * Used by the productivity report (PAC169/172) to compute "vs target %"
   * for completed batches. Scales linearly with actualQty / batchSize for
   * batches that were larger or smaller than default.
   */
  targetMinutes?: number;
};

export const PRET_PRODUCTION_ITEMS: ProductionItem[] = [
  // hub-central — full bakery
  // ─── hub-central — 7-bench layout ────────────────────────────────────────
  // Bakery runs (all preferredBenchId: bench-run-bakery) -----------------
  { id: 'pi-central-croissant',        siteId: 'hub-central', recipeId: 'prec-croissant',        skuId: 'sku-croissant',        mode: 'run', batchSize: 12, preferredBenchId: 'bench-run-bakery', targetMinutes: 16 },
  { id: 'pi-central-pain',             siteId: 'hub-central', recipeId: 'prec-pain-au-chocolat', skuId: 'sku-pain-au-choc',     mode: 'run', batchSize: 12, preferredBenchId: 'bench-run-bakery', targetMinutes: 18 },
  { id: 'pi-central-ciabatta',         siteId: 'hub-central', recipeId: 'prec-ciabatta',         skuId: 'sku-ciabatta',         mode: 'run', batchSize: 18, preferredBenchId: 'bench-run-bakery', targetMinutes: 22 },
  { id: 'pi-central-almond-croissant', siteId: 'hub-central', recipeId: 'prec-almond-croissant', skuId: 'sku-almond-croissant', mode: 'run', batchSize: 12, preferredBenchId: 'bench-run-bakery', targetMinutes: 18 },
  { id: 'pi-central-cinnamon-swirl',   siteId: 'hub-central', recipeId: 'prec-cinnamon-swirl',   skuId: 'sku-cinnamon-swirl',   mode: 'run', batchSize: 12, preferredBenchId: 'bench-run-bakery', targetMinutes: 17 },
  { id: 'pi-central-baguette',         siteId: 'hub-central', recipeId: 'prec-baguette',         skuId: 'sku-baguette',         mode: 'run', batchSize: 18, preferredBenchId: 'bench-run-bakery', targetMinutes: 24 },
  { id: 'pi-central-granary',          siteId: 'hub-central', recipeId: 'prec-granary',          skuId: 'sku-granary',          mode: 'run', batchSize: 12, preferredBenchId: 'bench-run-bakery', targetMinutes: 18 },
  { id: 'pi-central-focaccia',         siteId: 'hub-central', recipeId: 'prec-focaccia',         skuId: 'sku-focaccia',         mode: 'run', batchSize: 8,  preferredBenchId: 'bench-run-bakery', targetMinutes: 14 },
  { id: 'pi-central-blueberry-muffin', siteId: 'hub-central', recipeId: 'prec-blueberry-muffin', skuId: 'sku-blueberry-muffin', mode: 'run', batchSize: 12, preferredBenchId: 'bench-run-bakery', targetMinutes: 12 },
  { id: 'pi-central-banana-bread',     siteId: 'hub-central', recipeId: 'prec-banana-bread',     skuId: 'sku-banana-bread',     mode: 'run', batchSize: 16, preferredBenchId: 'bench-run-bakery', targetMinutes: 20 },
  { id: 'pi-central-brownie',          siteId: 'hub-central', recipeId: 'prec-brownie',          skuId: 'sku-brownie',          mode: 'run', batchSize: 16, preferredBenchId: 'bench-run-bakery', targetMinutes: 18 },

  // Cold-prep runs: fillings, dips, dressings → bench-run-cold-prep ------
  { id: 'pi-central-filling',      siteId: 'hub-central', recipeId: 'prec-chicken-mayo-filling', skuId: 'sku-chicken-mayo-filling', mode: 'run', batchSize: 2, preferredBenchId: 'bench-run-cold-prep', targetMinutes: 14 },
  { id: 'pi-central-egg-filling',  siteId: 'hub-central', recipeId: 'prec-egg-mayo-filling',     skuId: 'sku-egg-mayo-filling',     mode: 'run', batchSize: 2, preferredBenchId: 'bench-run-cold-prep', targetMinutes: 12 },
  { id: 'pi-central-tuna-filling', siteId: 'hub-central', recipeId: 'prec-tuna-mayo-filling',    skuId: 'sku-tuna-mayo-filling',    mode: 'run', batchSize: 2, preferredBenchId: 'bench-run-cold-prep', targetMinutes: 10 },
  { id: 'pi-central-hummus',       siteId: 'hub-central', recipeId: 'prec-hummus',               skuId: 'sku-hummus',               mode: 'run', batchSize: 2, preferredBenchId: 'bench-run-cold-prep', targetMinutes: 12 },

  // Hot-prep runs: roasts, slow-cooks → bench-run-hot-prep ---------------
  { id: 'pi-central-roast-chicken', siteId: 'hub-central', recipeId: 'prec-roast-chicken', skuId: 'sku-roast-chicken', mode: 'run', batchSize: 8,  preferredBenchId: 'bench-run-hot-prep', targetMinutes: 35 },
  { id: 'pi-central-bolognese',     siteId: 'hub-central', recipeId: 'prec-bolognese',     skuId: 'sku-bolognese',     mode: 'run', batchSize: 12, preferredBenchId: 'bench-run-hot-prep', targetMinutes: 45 },
  { id: 'pi-central-pulled-pork',   siteId: 'hub-central', recipeId: 'prec-pulled-pork',   skuId: 'sku-pulled-pork',   mode: 'run', batchSize: 6,  preferredBenchId: 'bench-run-hot-prep', targetMinutes: 40 },

  // Grill bench: hot components for sandwich assembly → bench-grill ------
  { id: 'pi-central-grilled-chicken',  siteId: 'hub-central', recipeId: 'prec-grilled-chicken',  skuId: 'sku-grilled-chicken',  mode: 'run', batchSize: 10, preferredBenchId: 'bench-grill', targetMinutes: 16 },
  { id: 'pi-central-grilled-halloumi', siteId: 'hub-central', recipeId: 'prec-grilled-halloumi', skuId: 'sku-grilled-halloumi', mode: 'run', batchSize: 8,  preferredBenchId: 'bench-grill', targetMinutes: 12 },
  { id: 'pi-central-chargrilled-veg',  siteId: 'hub-central', recipeId: 'prec-chargrilled-veg',  skuId: 'sku-chargrilled-veg',  mode: 'run', batchSize: 8,  preferredBenchId: 'bench-grill', targetMinutes: 14 },
  { id: 'pi-central-crispy-bacon',     siteId: 'hub-central', recipeId: 'prec-crispy-bacon',     skuId: 'sku-crispy-bacon',     mode: 'run', batchSize: 10, preferredBenchId: 'bench-grill', targetMinutes: 10 },

  // Assembly (variable): sandwiches + salads → bench-assembly ------------
  { id: 'pi-central-club',         siteId: 'hub-central', recipeId: 'prec-club-sandwich',         skuId: 'sku-club-sandwich',        mode: 'variable', batchSize: 10, preferredBenchId: 'bench-assembly', targetMinutes: 8 },
  { id: 'pi-central-egg-mayo-sw',  siteId: 'hub-central', recipeId: 'prec-egg-mayo-sandwich',     skuId: 'sku-egg-mayo-sandwich',    mode: 'variable', batchSize: 10, preferredBenchId: 'bench-assembly', targetMinutes: 6 },
  { id: 'pi-central-ham-cheese',   siteId: 'hub-central', recipeId: 'prec-ham-cheese-baguette',   skuId: 'sku-ham-cheese-baguette',  mode: 'variable', batchSize: 8,  preferredBenchId: 'bench-assembly', targetMinutes: 7 },
  { id: 'pi-central-tuna-sw',      siteId: 'hub-central', recipeId: 'prec-tuna-sandwich',         skuId: 'sku-tuna-sandwich',        mode: 'variable', batchSize: 10, preferredBenchId: 'bench-assembly', targetMinutes: 7 },
  { id: 'pi-central-hummus-wrap',  siteId: 'hub-central', recipeId: 'prec-hummus-wrap',           skuId: 'sku-hummus-wrap',          mode: 'variable', batchSize: 8,  preferredBenchId: 'bench-assembly', targetMinutes: 6 },
  { id: 'pi-central-turkey-brie',  siteId: 'hub-central', recipeId: 'prec-turkey-brie-baguette',  skuId: 'sku-turkey-brie-baguette', mode: 'variable', batchSize: 8,  preferredBenchId: 'bench-assembly', targetMinutes: 7 },
  { id: 'pi-central-salad',        siteId: 'hub-central', recipeId: 'prec-salad-bowl',            skuId: 'sku-salad-bowl',           mode: 'variable', batchSize: 1,  preferredBenchId: 'bench-assembly', targetMinutes: 4 },
  { id: 'pi-central-caesar',       siteId: 'hub-central', recipeId: 'prec-chicken-caesar',        skuId: 'sku-chicken-caesar',       mode: 'variable', batchSize: 1,  preferredBenchId: 'bench-assembly' },
  { id: 'pi-central-grain',        siteId: 'hub-central', recipeId: 'prec-med-grain-bowl',        skuId: 'sku-med-grain-bowl',       mode: 'variable', batchSize: 1,  preferredBenchId: 'bench-assembly' },
  { id: 'pi-central-pasta',        siteId: 'hub-central', recipeId: 'prec-chicken-pasta',         skuId: 'sku-chicken-pasta',        mode: 'variable', batchSize: 1,  preferredBenchId: 'bench-assembly' },
  { id: 'pi-central-falafel',      siteId: 'hub-central', recipeId: 'prec-falafel-bowl',          skuId: 'sku-falafel-bowl',         mode: 'variable', batchSize: 1,  preferredBenchId: 'bench-assembly' },

  // Variable bench: pots & sides (built through service) → bench-variable -
  { id: 'pi-central-fruit-pot',   siteId: 'hub-central', recipeId: 'prec-fruit-pot',   skuId: 'sku-fruit-pot',   mode: 'variable', batchSize: 1, preferredBenchId: 'bench-variable' },
  { id: 'pi-central-yogurt-pot',  siteId: 'hub-central', recipeId: 'prec-yogurt-pot',  skuId: 'sku-yogurt-pot',  mode: 'variable', batchSize: 1, preferredBenchId: 'bench-variable' },
  { id: 'pi-central-granola-pot', siteId: 'hub-central', recipeId: 'prec-granola-pot', skuId: 'sku-granola-pot', mode: 'variable', batchSize: 1, preferredBenchId: 'bench-variable' },

  // Hot shelf increments (10 total, short shelf-life) → bench-increment-hot
  {
    id: 'pi-central-cookie',
    siteId: 'hub-central', recipeId: 'prec-cookie', skuId: 'sku-cookie',
    mode: 'increment', batchSize: 8,
    cadence: { intervalMinutes: 45, startTime: '08:00', endTime: '18:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
    targetMinutes: 12,
  },
  {
    id: 'pi-central-coffee',
    siteId: 'hub-central', recipeId: 'prec-brewed-coffee', skuId: 'sku-brewed-coffee',
    mode: 'increment', batchSize: 1,
    cadence: { intervalMinutes: 30, startTime: '06:00', endTime: '20:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
    targetMinutes: 5,
  },
  {
    id: 'pi-central-iced-coffee',
    siteId: 'hub-central', recipeId: 'prec-iced-coffee', skuId: 'sku-iced-coffee',
    mode: 'increment', batchSize: 1,
    cadence: { intervalMinutes: 90, startTime: '08:00', endTime: '18:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-green-smoothie',
    siteId: 'hub-central', recipeId: 'prec-green-smoothie', skuId: 'sku-green-smoothie',
    mode: 'increment', batchSize: 1,
    cadence: { intervalMinutes: 60, startTime: '07:00', endTime: '15:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-porridge',
    siteId: 'hub-central', recipeId: 'prec-porridge', skuId: 'sku-porridge',
    mode: 'increment', batchSize: 4,
    cadence: { intervalMinutes: 45, startTime: '06:30', endTime: '10:30', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-hot-croissant',
    siteId: 'hub-central', recipeId: 'prec-hot-croissant', skuId: 'sku-hot-croissant',
    mode: 'increment', batchSize: 6,
    cadence: { intervalMinutes: 60, startTime: '07:00', endTime: '14:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-cheese-twist',
    siteId: 'hub-central', recipeId: 'prec-cheese-twist', skuId: 'sku-cheese-twist',
    mode: 'increment', batchSize: 8,
    cadence: { intervalMinutes: 60, startTime: '08:00', endTime: '16:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-sausage-roll',
    siteId: 'hub-central', recipeId: 'prec-sausage-roll', skuId: 'sku-sausage-roll',
    mode: 'increment', batchSize: 10,
    cadence: { intervalMinutes: 45, startTime: '09:00', endTime: '17:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-soup-day',
    siteId: 'hub-central', recipeId: 'prec-soup-day', skuId: 'sku-soup-day',
    mode: 'increment', batchSize: 8,
    cadence: { intervalMinutes: 90, startTime: '11:00', endTime: '16:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },
  {
    id: 'pi-central-pizza-slice',
    siteId: 'hub-central', recipeId: 'prec-pizza-slice', skuId: 'sku-pizza-slice',
    mode: 'increment', batchSize: 6,
    cadence: { intervalMinutes: 60, startTime: '11:00', endTime: '17:00', quinnProposed: true },
    preferredBenchId: 'bench-increment-hot',
  },

  // End-of-day next-day prep (variable mode landing on run benches → tail)
  { id: 'pi-central-eod-chicken-prep', siteId: 'hub-central', recipeId: 'prec-eod-chicken-prep', skuId: 'sku-eod-chicken-prep', mode: 'variable', batchSize: 4, preferredBenchId: 'bench-run-cold-prep' },
  { id: 'pi-central-eod-dough-prep',   siteId: 'hub-central', recipeId: 'prec-eod-dough-prep',   skuId: 'sku-eod-dough-prep',   mode: 'variable', batchSize: 6, preferredBenchId: 'bench-run-bakery' },
  { id: 'pi-central-eod-roast-prep',   siteId: 'hub-central', recipeId: 'prec-eod-roast-prep',   skuId: 'sku-eod-roast-prep',   mode: 'variable', batchSize: 4, preferredBenchId: 'bench-run-hot-prep' },

  // site-standalone-north — fully self-producing
  { id: 'pi-north-croissant', siteId: 'site-standalone-north', recipeId: 'prec-croissant', skuId: 'sku-croissant', mode: 'run', batchSize: 8 },
  { id: 'pi-north-club', siteId: 'site-standalone-north', recipeId: 'prec-club-sandwich', skuId: 'sku-club-sandwich', mode: 'variable', batchSize: 6 },
  { id: 'pi-north-salad', siteId: 'site-standalone-north', recipeId: 'prec-salad-bowl', skuId: 'sku-salad-bowl', mode: 'variable', batchSize: 1 },
  {
    id: 'pi-north-coffee',
    siteId: 'site-standalone-north',
    recipeId: 'prec-brewed-coffee',
    skuId: 'sku-brewed-coffee',
    mode: 'increment',
    batchSize: 1,
    cadence: { intervalMinutes: 45, startTime: '06:30', endTime: '19:00', quinnProposed: true },
  },

  // site-hybrid-airport — bakes some, receives some, assembles on-site
  { id: 'pi-airport-croissant', siteId: 'site-hybrid-airport', recipeId: 'prec-croissant', skuId: 'sku-croissant', mode: 'run', batchSize: 12 },
  { id: 'pi-airport-club', siteId: 'site-hybrid-airport', recipeId: 'prec-club-sandwich', skuId: 'sku-club-sandwich', mode: 'variable', batchSize: 8 },
  {
    id: 'pi-airport-coffee',
    siteId: 'site-hybrid-airport',
    recipeId: 'prec-brewed-coffee',
    skuId: 'sku-brewed-coffee',
    mode: 'increment',
    batchSize: 1,
    // airport override: Quinn proposed 30-min; hub overrode to 20-min for commuter peak
    cadence: { intervalMinutes: 20, startTime: '04:30', endTime: '22:30', quinnProposed: false },
  },

  // site-spoke-south — receive-only, no production items of its own
];

// ─────────────────────────────────────────────────────────────────────────────
// Effective batch rules — recipe wins, bench is the fallback
// ─────────────────────────────────────────────────────────────────────────────

export type EffectiveBatchRules = BatchRules & {
  /** Which side is currently the binding cap. */
  binding: 'recipe' | 'bench' | 'recipe+bench' | 'none';
  /** Plain-language explanation for the tooltip. */
  explain: string;
};

/**
 * Quinn's proposed batch split for a target quantity under given rules.
 * Packs full max-sized batches first, then rounds the remainder up to the
 * nearest multiple (capped at max; if that spills, splits in half).
 */
export function proposeBatchSplit(
  qty: number,
  rules: BatchRules,
): { batches: number[]; total: number; overshoot: number; undershoot: number } {
  const { min, max, multipleOf } = rules;
  if (qty <= 0 || max <= 0) {
    return { batches: [], total: 0, overshoot: 0, undershoot: Math.max(0, qty) };
  }
  const fullCount = Math.floor(qty / max);
  const batches: number[] = Array(fullCount).fill(max);
  const remainder = qty - fullCount * max;
  if (remainder > 0) {
    const rounded = Math.max(min, Math.ceil(remainder / multipleOf) * multipleOf);
    if (rounded <= max) {
      batches.push(rounded);
    } else {
      // Shouldn't happen under normal rules, but split in half defensively.
      const half = Math.max(min, Math.ceil(remainder / 2 / multipleOf) * multipleOf);
      batches.push(half, half);
    }
  }
  const total = batches.reduce((a, b) => a + b, 0);
  return {
    batches,
    total,
    overshoot: Math.max(0, total - qty),
    undershoot: Math.max(0, qty - total),
  };
}

/** Resolves the effective {min,max,multipleOf} when both a recipe and a bench define rules. */
export function effectiveBatchRules(
  recipeRules: BatchRules | undefined,
  benchRules: BatchRules | undefined,
): EffectiveBatchRules {
  if (!recipeRules && !benchRules) {
    return { min: 1, max: Infinity, multipleOf: 1, binding: 'none', explain: 'No batch rules set.' };
  }
  if (recipeRules && !benchRules) {
    return { ...recipeRules, binding: 'recipe', explain: `Recipe caps at ${recipeRules.min}–${recipeRules.max} in multiples of ${recipeRules.multipleOf}.` };
  }
  if (!recipeRules && benchRules) {
    return { ...benchRules, binding: 'bench', explain: `Bench holds ${benchRules.min}–${benchRules.max} in multiples of ${benchRules.multipleOf}.` };
  }
  // Both set — recipe wins on max. Take tightest min/max; lcm-ish multiple (take max for safety in V1).
  const r = recipeRules!;
  const b = benchRules!;
  const min = Math.max(r.min, b.min);
  const max = Math.min(r.max, b.max);
  const multipleOf = Math.max(r.multipleOf, b.multipleOf);
  const bindingMin = r.min >= b.min ? 'recipe' : 'bench';
  const bindingMax = r.max <= b.max ? 'recipe' : 'bench';
  const binding: EffectiveBatchRules['binding'] =
    bindingMin === bindingMax ? bindingMin : 'recipe+bench';
  const explain =
    `Bench holds ${b.min}–${b.max} in ${b.multipleOf}s; recipe caps at ${r.min}–${r.max} in ${r.multipleOf}s. ` +
    `Effective: ${min}–${max} in ${multipleOf}s (recipe wins on max).`;
  return { min, max, multipleOf, binding, explain };
}

// ─────────────────────────────────────────────────────────────────────────────
// Assortment — Ranges + Tiers (single shape, two roles)
// ─────────────────────────────────────────────────────────────────────────────

export type TimeWindow = {
  start: string; // HH:MM
  end: string;   // HH:MM
  /** Granularity hint — how this window was authored. */
  granularity: 'hour' | 'run' | 'phase' | 'custom';
};

export type AvailabilityRule = {
  /** Days the SKU is available within this range. */
  daysOfWeek: DayOfWeek[];
  /** Intra-day windows; empty = all-day. Multiple windows allowed. */
  windows: TimeWindow[];
};

export type RangeEntry = {
  skuId: SkuId;
  recipeId: RecipeId;
  availability: AvailabilityRule;
};

export type Range = {
  id: RangeId;
  name: string;
  estateId: EstateId;
  /** SKUs in this range + per-SKU availability. */
  entries: RangeEntry[];
  /** Optional format constraint — when set, only sites in this format may use it. */
  formatFilter?: FormatId[];
};

export type Tier = {
  id: TierId;
  name: string;
  estateId: EstateId;
  /** Ranges this tier composes (stackable). */
  rangeIds: RangeId[];
  /** Explicit priority when ranges overlap on the same SKU; higher wins.
   *  Falls back to "more permissive window wins" if omitted. */
  priority?: Record<RangeId, number>;
};

export type SiteTierAssignment = {
  siteId: SiteId;
  /** Per-day tier assignment. */
  byDayOfWeek: Record<DayOfWeek, TierId>;
};

export const PRET_RANGES: Range[] = [
  {
    id: 'range-core',
    name: 'Core',
    estateId: 'estate-pret',
    entries: [
      { skuId: 'sku-croissant',         recipeId: 'prec-croissant',         availability: { daysOfWeek: DAYS_OF_WEEK, windows: [] } },
      { skuId: 'sku-pain-au-choc',      recipeId: 'prec-pain-au-chocolat',  availability: { daysOfWeek: DAYS_OF_WEEK, windows: [{ start: '06:00', end: '12:00', granularity: 'phase' }] } },
      { skuId: 'sku-cookie',            recipeId: 'prec-cookie',            availability: { daysOfWeek: DAYS_OF_WEEK, windows: [{ start: '08:00', end: '20:00', granularity: 'phase' }] } },
      { skuId: 'sku-brewed-coffee',     recipeId: 'prec-brewed-coffee',     availability: { daysOfWeek: DAYS_OF_WEEK, windows: [] } },
      { skuId: 'sku-club-sandwich',     recipeId: 'prec-club-sandwich',     availability: { daysOfWeek: DAYS_OF_WEEK, windows: [{ start: '10:00', end: '20:00', granularity: 'custom' }] } },
      { skuId: 'sku-salad-bowl',        recipeId: 'prec-salad-bowl',        availability: { daysOfWeek: DAYS_OF_WEEK, windows: [{ start: '11:00', end: '16:00', granularity: 'custom' }] } },
    ],
  },
  {
    id: 'range-brunch',
    name: 'Brunch (Sun)',
    estateId: 'estate-pret',
    entries: [
      // Stacked on Sunday — expands croissant window, adds pain au choc all morning
      { skuId: 'sku-croissant',    recipeId: 'prec-croissant',        availability: { daysOfWeek: ['Sun'], windows: [{ start: '09:00', end: '13:00', granularity: 'phase' }] } },
      { skuId: 'sku-pain-au-choc', recipeId: 'prec-pain-au-chocolat', availability: { daysOfWeek: ['Sun'], windows: [{ start: '09:00', end: '13:00', granularity: 'phase' }] } },
    ],
  },
  {
    id: 'range-airport-commuter',
    name: 'Airport commuter',
    estateId: 'estate-pret',
    formatFilter: ['format-airport'],
    entries: [
      { skuId: 'sku-brewed-coffee', recipeId: 'prec-brewed-coffee', availability: { daysOfWeek: DAYS_OF_WEEK, windows: [{ start: '04:30', end: '10:00', granularity: 'hour' }] } },
      { skuId: 'sku-croissant',     recipeId: 'prec-croissant',     availability: { daysOfWeek: DAYS_OF_WEEK, windows: [{ start: '04:30', end: '10:00', granularity: 'hour' }] } },
    ],
  },
];

export const PRET_TIERS: Tier[] = [
  { id: 'tier-weekday', name: 'Weekday',  estateId: 'estate-pret', rangeIds: ['range-core'] },
  { id: 'tier-weekend', name: 'Weekend',  estateId: 'estate-pret', rangeIds: ['range-core', 'range-brunch'] },
  { id: 'tier-airport', name: 'Airport',  estateId: 'estate-pret', rangeIds: ['range-core', 'range-airport-commuter'] },
];

export const PRET_SITE_TIER_ASSIGNMENTS: SiteTierAssignment[] = [
  {
    siteId: 'hub-central',
    byDayOfWeek: { Mon: 'tier-weekday', Tue: 'tier-weekday', Wed: 'tier-weekday', Thu: 'tier-weekday', Fri: 'tier-weekday', Sat: 'tier-weekday', Sun: 'tier-weekend' },
  },
  {
    siteId: 'site-standalone-north',
    byDayOfWeek: { Mon: 'tier-weekday', Tue: 'tier-weekday', Wed: 'tier-weekday', Thu: 'tier-weekday', Fri: 'tier-weekday', Sat: 'tier-weekday', Sun: 'tier-weekend' },
  },
  {
    siteId: 'site-spoke-south',
    byDayOfWeek: { Mon: 'tier-weekday', Tue: 'tier-weekday', Wed: 'tier-weekday', Thu: 'tier-weekday', Fri: 'tier-weekday', Sat: 'tier-weekday', Sun: 'tier-weekend' },
  },
  {
    siteId: 'site-hybrid-airport',
    byDayOfWeek: { Mon: 'tier-airport', Tue: 'tier-airport', Wed: 'tier-airport', Thu: 'tier-airport', Fri: 'tier-airport', Sat: 'tier-airport', Sun: 'tier-airport' },
  },
];

/** Is a SKU sellable/producible at a site on a given day+time? The hard gate. */
export function isSkuAvailable(
  skuId: SkuId,
  siteId: SiteId,
  iso: string,
  timeHHMM: string,
): { available: boolean; reason: string } {
  const dow = dayOfWeek(iso);
  const assignment = PRET_SITE_TIER_ASSIGNMENTS.find(a => a.siteId === siteId);
  if (!assignment) return { available: false, reason: `Site ${siteId} has no tier assignment.` };
  const tier = PRET_TIERS.find(t => t.id === assignment.byDayOfWeek[dow]);
  if (!tier) return { available: false, reason: `Tier missing for ${dow}.` };
  const site = PRET_SITES.find(s => s.id === siteId);
  const ranges = tier.rangeIds
    .map(rid => PRET_RANGES.find(r => r.id === rid))
    .filter((r): r is Range => !!r)
    .filter(r => !r.formatFilter || (site && r.formatFilter.includes(site.formatId)));
  for (const range of ranges) {
    for (const entry of range.entries.filter(e => e.skuId === skuId)) {
      if (!entry.availability.daysOfWeek.includes(dow)) continue;
      if (entry.availability.windows.length === 0) return { available: true, reason: `All-day in ${range.name}.` };
      for (const w of entry.availability.windows) {
        if (timeHHMM >= w.start && timeHHMM <= w.end) {
          return { available: true, reason: `Active window ${w.start}–${w.end} in ${range.name}.` };
        }
      }
    }
  }
  return { available: false, reason: `Outside tier windows for ${dow} at ${timeHHMM}.` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Forecast + Plan + PlannedInstance + Batch + PCR
// ─────────────────────────────────────────────────────────────────────────────

export type DemandSignal =
  | 'sales-history'
  | 'weather'
  | 'stock-on-hand'
  | 'online-orders'
  | 'waste-history'
  | 'event'
  | 'promo';

export type DemandForecastEntry = {
  siteId: SiteId;
  skuId: SkuId;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  /** Projected units for the day. */
  projectedUnits: number;
  /** Per-phase breakdown (morning/midday/afternoon). Optional. */
  byPhase?: { morning: number; midday: number; afternoon: number };
  /** Signals contributing to the projection, with their relative weight (0–1). */
  signals: { signal: DemandSignal; weight: number; note?: string }[];
  /** Quinn-drafted; Manager confirms. */
  status: 'draft' | 'confirmed';
};

export const PRET_FORECAST: DemandForecastEntry[] = [
  // hub-central — Thursday (D0)
  {
    siteId: 'hub-central', skuId: 'sku-croissant', date: DEMO_TODAY, projectedUnits: 48,
    byPhase: { morning: 30, midday: 12, afternoon: 6 },
    signals: [
      { signal: 'sales-history', weight: 0.6, note: '4-week median for Thu' },
      { signal: 'weather', weight: 0.2, note: 'Dry, 14°C — commute normal' },
      { signal: 'waste-history', weight: 0.2, note: 'Avg 4/day last 2 weeks' },
    ],
    status: 'confirmed',
  },
  {
    siteId: 'hub-central', skuId: 'sku-pain-au-choc', date: DEMO_TODAY, projectedUnits: 36,
    byPhase: { morning: 24, midday: 8, afternoon: 4 },
    signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'weather', weight: 0.2 }],
    status: 'confirmed',
  },
  {
    siteId: 'hub-central', skuId: 'sku-club-sandwich', date: DEMO_TODAY, projectedUnits: 120,
    byPhase: { morning: 10, midday: 80, afternoon: 30 },
    signals: [
      { signal: 'sales-history', weight: 0.5 },
      { signal: 'online-orders', weight: 0.3, note: '18 pre-orders already in' },
      { signal: 'event', weight: 0.2, note: 'Conference 500m away' },
    ],
    status: 'confirmed',
  },
  {
    siteId: 'hub-central', skuId: 'sku-salad-bowl', date: DEMO_TODAY, projectedUnits: 40,
    byPhase: { morning: 2, midday: 28, afternoon: 10 },
    signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'weather', weight: 0.3 }],
    status: 'confirmed',
  },
  {
    siteId: 'hub-central', skuId: 'sku-cookie', date: DEMO_TODAY, projectedUnits: 72,
    byPhase: { morning: 12, midday: 30, afternoon: 30 },
    signals: [{ signal: 'sales-history', weight: 1 }],
    status: 'draft',
  },

  // site-hybrid-airport — Thursday
  {
    siteId: 'site-hybrid-airport', skuId: 'sku-croissant', date: DEMO_TODAY, projectedUnits: 60,
    byPhase: { morning: 48, midday: 8, afternoon: 4 },
    signals: [{ signal: 'sales-history', weight: 0.5 }, { signal: 'event', weight: 0.5, note: 'Outbound travel peak' }],
    status: 'confirmed',
  },

  // ─── hub-central: expanded SKU set for Thursday ──────────────────────────
  // Bakery (viennoiserie + breads + cakes)
  { siteId: 'hub-central', skuId: 'sku-almond-croissant', date: DEMO_TODAY, projectedUnits: 24, byPhase: { morning: 18, midday: 4,  afternoon: 2  }, signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'waste-history', weight: 0.3, note: 'Steady 2/day waste' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-cinnamon-swirl',   date: DEMO_TODAY, projectedUnits: 18, byPhase: { morning: 14, midday: 3,  afternoon: 1  }, signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'weather', weight: 0.2 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-baguette',         date: DEMO_TODAY, projectedUnits: 42, byPhase: { morning: 12, midday: 24, afternoon: 6  }, signals: [{ signal: 'sales-history', weight: 0.9, note: 'Driven by sandwich assembly' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-granary',          date: DEMO_TODAY, projectedUnits: 36, byPhase: { morning: 8,  midday: 24, afternoon: 4  }, signals: [{ signal: 'sales-history', weight: 0.9, note: 'Driven by sandwich assembly' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-focaccia',         date: DEMO_TODAY, projectedUnits: 12, byPhase: { morning: 2,  midday: 8,  afternoon: 2  }, signals: [{ signal: 'sales-history', weight: 0.8 }], status: 'draft' },
  { siteId: 'hub-central', skuId: 'sku-blueberry-muffin', date: DEMO_TODAY, projectedUnits: 30, byPhase: { morning: 14, midday: 10, afternoon: 6  }, signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'weather', weight: 0.3 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-banana-bread',     date: DEMO_TODAY, projectedUnits: 24, byPhase: { morning: 6,  midday: 10, afternoon: 8  }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-brownie',          date: DEMO_TODAY, projectedUnits: 32, byPhase: { morning: 2,  midday: 14, afternoon: 16 }, signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'event', weight: 0.2, note: 'Conference nearby' }], status: 'confirmed' },

  // Fillings (drive assembly)
  { siteId: 'hub-central', skuId: 'sku-egg-mayo-filling',  date: DEMO_TODAY, projectedUnits: 6, byPhase: { morning: 4, midday: 2, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Trays of 4kg, derived from assembly forecasts' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-tuna-mayo-filling', date: DEMO_TODAY, projectedUnits: 5, byPhase: { morning: 3, midday: 2, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Derived from tuna sandwich forecast' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-hummus',            date: DEMO_TODAY, projectedUnits: 3, byPhase: { morning: 2, midday: 1, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Drives hummus wrap assembly' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-ciabatta',          date: DEMO_TODAY, projectedUnits: 120, byPhase: { morning: 30, midday: 70, afternoon: 20 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Sub-recipe for club sandwich' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-chicken-mayo-filling', date: DEMO_TODAY, projectedUnits: 7, byPhase: { morning: 5, midday: 2, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Drives club sandwich' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-brewed-coffee',     date: DEMO_TODAY, projectedUnits: 22, byPhase: { morning: 14, midday: 6, afternoon: 2 }, signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'weather', weight: 0.2, note: 'Cool morning' }], status: 'confirmed' },

  // Assembly sandwiches
  { siteId: 'hub-central', skuId: 'sku-egg-mayo-sandwich',    date: DEMO_TODAY, projectedUnits: 80,  byPhase: { morning: 20, midday: 50, afternoon: 10 }, signals: [{ signal: 'sales-history', weight: 0.6 }, { signal: 'online-orders', weight: 0.4, note: '12 pre-orders' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-ham-cheese-baguette',  date: DEMO_TODAY, projectedUnits: 60,  byPhase: { morning: 10, midday: 38, afternoon: 12 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-tuna-sandwich',        date: DEMO_TODAY, projectedUnits: 50,  byPhase: { morning: 8,  midday: 34, afternoon: 8 },  signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-hummus-wrap',          date: DEMO_TODAY, projectedUnits: 42,  byPhase: { morning: 4,  midday: 28, afternoon: 10 }, signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'event', weight: 0.3, note: 'Vegan-friendly tag trending' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-turkey-brie-baguette', date: DEMO_TODAY, projectedUnits: 36,  byPhase: { morning: 4,  midday: 26, afternoon: 6 },  signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },

  // Salads
  { siteId: 'hub-central', skuId: 'sku-chicken-caesar', date: DEMO_TODAY, projectedUnits: 45, byPhase: { morning: 2, midday: 34, afternoon: 9  }, signals: [{ signal: 'sales-history', weight: 0.6 }, { signal: 'weather', weight: 0.4, note: 'Warm at lunchtime' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-med-grain-bowl', date: DEMO_TODAY, projectedUnits: 32, byPhase: { morning: 2, midday: 24, afternoon: 6  }, signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'weather', weight: 0.3 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-chicken-pasta',  date: DEMO_TODAY, projectedUnits: 38, byPhase: { morning: 2, midday: 28, afternoon: 8  }, signals: [{ signal: 'sales-history', weight: 0.8 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-falafel-bowl',   date: DEMO_TODAY, projectedUnits: 28, byPhase: { morning: 1, midday: 22, afternoon: 5  }, signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'promo', weight: 0.3, note: 'Featured on home screen' }], status: 'draft' },

  // Pots & snacks
  { siteId: 'hub-central', skuId: 'sku-fruit-pot',   date: DEMO_TODAY, projectedUnits: 30, byPhase: { morning: 10, midday: 14, afternoon: 6 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-yogurt-pot',  date: DEMO_TODAY, projectedUnits: 24, byPhase: { morning: 18, midday: 4,  afternoon: 2 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-granola-pot', date: DEMO_TODAY, projectedUnits: 20, byPhase: { morning: 16, midday: 3,  afternoon: 1 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },

  // Beverages
  { siteId: 'hub-central', skuId: 'sku-iced-coffee',    date: DEMO_TODAY, projectedUnits: 7,  byPhase: { morning: 1, midday: 4,  afternoon: 2 }, signals: [{ signal: 'sales-history', weight: 0.5 }, { signal: 'weather', weight: 0.5, note: 'Warming up at lunch' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-green-smoothie', date: DEMO_TODAY, projectedUnits: 9,  byPhase: { morning: 5, midday: 4,  afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 0.7 }, { signal: 'promo', weight: 0.3 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-porridge',       date: DEMO_TODAY, projectedUnits: 18, byPhase: { morning: 18, midday: 0, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'weather', weight: 0.2 }], status: 'confirmed' },

  // Hot-prep runs (new)
  { siteId: 'hub-central', skuId: 'sku-roast-chicken', date: DEMO_TODAY, projectedUnits: 3, byPhase: { morning: 3, midday: 0, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Trays — drives hot sandwich assembly' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-bolognese',     date: DEMO_TODAY, projectedUnits: 2, byPhase: { morning: 2, midday: 0, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-pulled-pork',   date: DEMO_TODAY, projectedUnits: 2, byPhase: { morning: 2, midday: 0, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },

  // Grill bench (new) — drives sandwich assembly
  { siteId: 'hub-central', skuId: 'sku-grilled-chicken',  date: DEMO_TODAY, projectedUnits: 3, byPhase: { morning: 2, midday: 1, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Drives chicken caesar, club, hot wraps' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-grilled-halloumi', date: DEMO_TODAY, projectedUnits: 2, byPhase: { morning: 1, midday: 1, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-chargrilled-veg',  date: DEMO_TODAY, projectedUnits: 2, byPhase: { morning: 1, midday: 1, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-crispy-bacon',     date: DEMO_TODAY, projectedUnits: 3, byPhase: { morning: 2, midday: 1, afternoon: 0 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Drives BLT + club' }], status: 'confirmed' },

  // Hot shelf increments (new)
  { siteId: 'hub-central', skuId: 'sku-hot-croissant', date: DEMO_TODAY, projectedUnits: 36, byPhase: { morning: 24, midday: 10, afternoon: 2 }, signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'weather', weight: 0.2 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-cheese-twist',  date: DEMO_TODAY, projectedUnits: 28, byPhase: { morning: 12, midday: 12, afternoon: 4 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-sausage-roll',  date: DEMO_TODAY, projectedUnits: 42, byPhase: { morning: 8,  midday: 26, afternoon: 8 }, signals: [{ signal: 'sales-history', weight: 1 }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-soup-day',      date: DEMO_TODAY, projectedUnits: 3,  byPhase: { morning: 0,  midday: 2,  afternoon: 1 }, signals: [{ signal: 'sales-history', weight: 1, note: '2L batches, refreshed through service' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-pizza-slice',   date: DEMO_TODAY, projectedUnits: 24, byPhase: { morning: 0,  midday: 18, afternoon: 6 }, signals: [{ signal: 'sales-history', weight: 0.8 }, { signal: 'weather', weight: 0.2 }], status: 'confirmed' },

  // End-of-day next-day prep (new — variable mode, lands on run benches as tail)
  { siteId: 'hub-central', skuId: 'sku-eod-chicken-prep', date: DEMO_TODAY, projectedUnits: 3, byPhase: { morning: 0, midday: 0, afternoon: 3 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Mise for tomorrow — 3 trays' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-eod-dough-prep',   date: DEMO_TODAY, projectedUnits: 4, byPhase: { morning: 0, midday: 0, afternoon: 4 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Tomorrow\'s dough to cold-proof overnight' }], status: 'confirmed' },
  { siteId: 'hub-central', skuId: 'sku-eod-roast-prep',   date: DEMO_TODAY, projectedUnits: 2, byPhase: { morning: 0, midday: 0, afternoon: 2 }, signals: [{ signal: 'sales-history', weight: 1, note: 'Overnight roast / stock reduction' }], status: 'confirmed' },
];

export type PlannedInstance = {
  id: string;
  productionItemId: ProductionItemId;
  /** The stage this instance is for (a recipe with multi-stage workflow spans multiple instances). */
  stageId: StageId;
  /** ISO date of the stage (D-1, D0, etc.). */
  date: string;
  /** HH:MM start on that date. */
  startTime: string;
  /** HH:MM end on that date. */
  endTime: string;
  benchId: BenchId;
  plannedQty: number;
  /** Which forecast entry this was derived from (for traceability). */
  forecastRef?: { siteId: SiteId; skuId: SkuId; date: string };
};

export type BatchStatus =
  | 'planned'
  | 'in-progress'
  | 'complete'
  | 'failed'
  | 'reviewed'
  | 'dispatched';

export type ProductionBatch = {
  id: BatchId;
  plannedInstanceId?: string; // undefined = on-demand (unplanned)
  productionItemId: ProductionItemId;
  benchId: BenchId;
  date: string;
  startTime: string;
  endTime: string;
  actualQty: number;
  status: BatchStatus;
  /** When failed, the reason. */
  failureReason?: 'burnt' | 'under-proofed' | 'allergen-cross-contact' | 'equipment' | 'other';
  /**
   * Employee who ran the batch. Captured when the staffer hits "Start" on
   * the bench card; surfaced in PCR queue and the productivity report
   * (PAC169 / PAC172).
   */
  assignedUserId?: UserId;
};

export type PCRType = 'batch' | 'on-demand' | 'preparation' | 'repackaging';

export type PCRRecord = {
  id: string;
  batchId: BatchId;
  type: PCRType;
  qualityCheck: boolean | null;
  labelCheck: boolean | null;
  signedBy?: UserId;
  signedAt?: string; // ISO datetime
  notes?: string;
};

export type ProductionPlan = {
  id: string;
  siteId: SiteId;
  /** The plan's anchor date (D0). */
  date: string;
  plannedInstances: PlannedInstance[];
  batches: ProductionBatch[];
  pcrRecords: PCRRecord[];
  /** Manager approval gate. */
  status: 'draft' | 'approved';
};

export const PRET_PLAN: ProductionPlan = {
  id: 'plan-central-thursday',
  siteId: 'hub-central',
  date: DEMO_TODAY,
  status: 'approved',
  plannedInstances: [
    // --- Croissant: D-1 ferment → D0 bake → D0 pack
    {
      id: 'pi-instance-croissant-ferment',
      productionItemId: 'pi-central-croissant',
      stageId: 'ferment',
      date: dayOffset(-1),
      startTime: '22:00',
      endTime: '06:00',
      benchId: 'bench-central-proof',
      plannedQty: 48,
      forecastRef: { siteId: 'hub-central', skuId: 'sku-croissant', date: DEMO_TODAY },
    },
    {
      id: 'pi-instance-croissant-bake-0530',
      productionItemId: 'pi-central-croissant',
      stageId: 'bake',
      date: DEMO_TODAY,
      startTime: '05:30',
      endTime: '05:48',
      benchId: 'bench-central-oven',
      plannedQty: 24,
    },
    {
      id: 'pi-instance-croissant-bake-0600',
      productionItemId: 'pi-central-croissant',
      stageId: 'bake',
      date: DEMO_TODAY,
      startTime: '06:00',
      endTime: '06:18',
      benchId: 'bench-central-oven',
      plannedQty: 24,
    },
    {
      id: 'pi-instance-croissant-pack',
      productionItemId: 'pi-central-croissant',
      stageId: 'pack',
      date: DEMO_TODAY,
      startTime: '06:30',
      endTime: '06:45',
      benchId: 'bench-central-pack',
      plannedQty: 48,
    },

    // --- Pain au chocolat: D-1 ferment → D0 bake
    {
      id: 'pi-instance-pain-ferment',
      productionItemId: 'pi-central-pain',
      stageId: 'ferment',
      date: dayOffset(-1),
      startTime: '22:00',
      endTime: '06:00',
      benchId: 'bench-central-proof',
      plannedQty: 36,
    },
    {
      id: 'pi-instance-pain-bake',
      productionItemId: 'pi-central-pain',
      stageId: 'bake',
      date: DEMO_TODAY,
      startTime: '06:30',
      endTime: '06:48',
      benchId: 'bench-central-oven',
      plannedQty: 36,
    },

    // --- Ciabatta: D-2 ferment → D-1 bake  (demonstrates D-2 depth)
    {
      id: 'pi-instance-ciabatta-ferment',
      productionItemId: 'pi-central-ciabatta',
      stageId: 'ferment',
      date: dayOffset(-2),
      startTime: '20:00',
      endTime: '06:00',
      benchId: 'bench-central-proof',
      plannedQty: 18,
    },
    {
      id: 'pi-instance-ciabatta-bake',
      productionItemId: 'pi-central-ciabatta',
      stageId: 'bake',
      date: dayOffset(-1),
      startTime: '07:00',
      endTime: '07:25',
      benchId: 'bench-central-oven',
      plannedQty: 18,
    },

    // --- Chicken-mayo filling: D0 prep (sub-recipe for club)
    {
      id: 'pi-instance-filling',
      productionItemId: 'pi-central-filling',
      stageId: 'prep',
      date: DEMO_TODAY,
      startTime: '08:30',
      endTime: '09:00',
      benchId: 'bench-central-prep',
      plannedQty: 2,
    },

    // --- Club sandwich: D0 assemble (variable)
    {
      id: 'pi-instance-club',
      productionItemId: 'pi-central-club',
      stageId: 'assemble',
      date: DEMO_TODAY,
      startTime: '09:30',
      endTime: '11:30',
      benchId: 'bench-central-prep',
      plannedQty: 120,
    },

    // --- Cookies: increment cadence, seeded with three planned drops
    {
      id: 'pi-instance-cookie-0800',
      productionItemId: 'pi-central-cookie',
      stageId: 'bake',
      date: DEMO_TODAY,
      startTime: '08:00',
      endTime: '08:12',
      benchId: 'bench-central-oven',
      plannedQty: 8,
    },
    {
      id: 'pi-instance-cookie-0845',
      productionItemId: 'pi-central-cookie',
      stageId: 'bake',
      date: DEMO_TODAY,
      startTime: '08:45',
      endTime: '08:57',
      benchId: 'bench-central-oven',
      plannedQty: 8,
    },
    {
      id: 'pi-instance-cookie-0930',
      productionItemId: 'pi-central-cookie',
      stageId: 'bake',
      date: DEMO_TODAY,
      startTime: '09:30',
      endTime: '09:42',
      benchId: 'bench-central-oven',
      plannedQty: 8,
    },

    // --- Brewed coffee: increment, one seeded drop
    {
      id: 'pi-instance-coffee-0700',
      productionItemId: 'pi-central-coffee',
      stageId: 'brew',
      date: DEMO_TODAY,
      startTime: '07:00',
      endTime: '07:06',
      benchId: 'bench-central-prep',
      plannedQty: 1,
    },

    // ─── Forward planning: tonight's ferment for Friday + Saturday's breads ───
    {
      id: 'pi-instance-croissant-ferment-tonight',
      productionItemId: 'pi-central-croissant',
      stageId: 'ferment',
      date: DEMO_TODAY,
      startTime: '22:00',
      endTime: '06:00',
      benchId: 'bench-central-proof',
      plannedQty: 48,
      forecastRef: { siteId: 'hub-central', skuId: 'sku-croissant', date: dayOffset(1) },
    },
    {
      id: 'pi-instance-croissant-bake-friday',
      productionItemId: 'pi-central-croissant',
      stageId: 'bake',
      date: dayOffset(1),
      startTime: '05:30',
      endTime: '06:18',
      benchId: 'bench-central-oven',
      plannedQty: 48,
    },
    {
      id: 'pi-instance-ciabatta-ferment-today',
      productionItemId: 'pi-central-ciabatta',
      stageId: 'ferment',
      date: DEMO_TODAY,
      startTime: '20:00',
      endTime: '06:00',
      benchId: 'bench-central-proof',
      plannedQty: 24,
      forecastRef: { siteId: 'hub-central', skuId: 'sku-ciabatta', date: dayOffset(1) },
    },
    {
      id: 'pi-instance-ciabatta-bake-friday',
      productionItemId: 'pi-central-ciabatta',
      stageId: 'bake',
      date: dayOffset(1),
      startTime: '07:00',
      endTime: '07:25',
      benchId: 'bench-central-oven',
      plannedQty: 24,
    },
    {
      id: 'pi-instance-club-friday',
      productionItemId: 'pi-central-club',
      stageId: 'assemble',
      date: dayOffset(1),
      startTime: '09:30',
      endTime: '11:30',
      benchId: 'bench-central-prep',
      plannedQty: 130,
    },
    {
      id: 'pi-instance-croissant-ferment-friday',
      productionItemId: 'pi-central-croissant',
      stageId: 'ferment',
      date: dayOffset(1),
      startTime: '22:00',
      endTime: '06:00',
      benchId: 'bench-central-proof',
      plannedQty: 60,
      forecastRef: { siteId: 'hub-central', skuId: 'sku-croissant', date: dayOffset(2) },
    },
    {
      id: 'pi-instance-croissant-bake-saturday',
      productionItemId: 'pi-central-croissant',
      stageId: 'bake',
      date: dayOffset(2),
      startTime: '05:30',
      endTime: '06:30',
      benchId: 'bench-central-oven',
      plannedQty: 60,
    },
  ],

  batches: [
    // Croissant bake 05:30 — done and signed off
    {
      id: 'batch-croissant-0530',
      plannedInstanceId: 'pi-instance-croissant-bake-0530',
      productionItemId: 'pi-central-croissant',
      benchId: 'bench-central-oven',
      date: DEMO_TODAY,
      startTime: '05:32',
      endTime: '05:50',
      actualQty: 24,
      status: 'reviewed',
      assignedUserId: 'user-staff-central',
    },
    // Croissant bake 06:00 — in progress
    {
      id: 'batch-croissant-0600',
      plannedInstanceId: 'pi-instance-croissant-bake-0600',
      productionItemId: 'pi-central-croissant',
      benchId: 'bench-central-oven',
      date: DEMO_TODAY,
      startTime: '06:00',
      endTime: '06:18',
      actualQty: 24,
      status: 'in-progress',
      assignedUserId: 'user-staff-central',
    },
    // Pain au choc bake — FAILED (burnt) → will route through waste
    {
      id: 'batch-pain-0630',
      plannedInstanceId: 'pi-instance-pain-bake',
      productionItemId: 'pi-central-pain',
      benchId: 'bench-central-oven',
      date: DEMO_TODAY,
      startTime: '06:30',
      endTime: '06:51',
      actualQty: 36,
      status: 'failed',
      failureReason: 'burnt',
      assignedUserId: 'user-staff-central-3',
    },
    // Cookie 08:00 bake — planned (not yet started)
    {
      id: 'batch-cookie-0800',
      plannedInstanceId: 'pi-instance-cookie-0800',
      productionItemId: 'pi-central-cookie',
      benchId: 'bench-central-oven',
      date: DEMO_TODAY,
      startTime: '08:00',
      endTime: '08:12',
      actualQty: 0,
      status: 'planned',
    },
    // Coffee 07:00 — complete, awaiting PCR
    {
      id: 'batch-coffee-0700',
      plannedInstanceId: 'pi-instance-coffee-0700',
      productionItemId: 'pi-central-coffee',
      benchId: 'bench-central-prep',
      date: DEMO_TODAY,
      startTime: '07:00',
      endTime: '07:06',
      actualQty: 1,
      status: 'complete',
      assignedUserId: 'user-staff-central-2',
    },
    // On-demand batch — customer walked in, no planned instance
    {
      id: 'batch-salad-on-demand-1100',
      productionItemId: 'pi-central-salad',
      benchId: 'bench-central-prep',
      date: DEMO_TODAY,
      startTime: '11:00',
      endTime: '11:04',
      actualQty: 1,
      status: 'reviewed',
      assignedUserId: 'user-staff-central-4',
    },

    // ─── Yesterday (D-1) — historical run for productivity trend ────────
    // Bakery oven — Dev knocked out the early bakes consistently on/under
    {
      id: 'batch-y-croissant-0530',
      productionItemId: 'pi-central-croissant',
      benchId: 'bench-run-bakery',
      date: dayOffset(-1),
      startTime: '05:30', endTime: '05:44',
      actualQty: 24, status: 'reviewed',
      assignedUserId: 'user-staff-central',
    },
    {
      id: 'batch-y-pain-0600',
      productionItemId: 'pi-central-pain',
      benchId: 'bench-run-bakery',
      date: dayOffset(-1),
      startTime: '06:00', endTime: '06:14',
      actualQty: 12, status: 'reviewed',
      assignedUserId: 'user-staff-central',
    },
    {
      id: 'batch-y-almond-0620',
      productionItemId: 'pi-central-almond-croissant',
      benchId: 'bench-run-bakery',
      date: dayOffset(-1),
      startTime: '06:20', endTime: '06:36',
      actualQty: 12, status: 'reviewed',
      assignedUserId: 'user-staff-central',
    },
    {
      id: 'batch-y-cinnamon-0700',
      productionItemId: 'pi-central-cinnamon-swirl',
      benchId: 'bench-run-bakery',
      date: dayOffset(-1),
      startTime: '07:00', endTime: '07:21',
      actualQty: 12, status: 'reviewed',
      assignedUserId: 'user-staff-central-3',
    },
    {
      id: 'batch-y-baguette-0730',
      productionItemId: 'pi-central-baguette',
      benchId: 'bench-run-bakery',
      date: dayOffset(-1),
      startTime: '07:30', endTime: '08:05',
      actualQty: 18, status: 'reviewed',
      assignedUserId: 'user-staff-central-3',
    },
    // Cold prep — Sara on fillings
    {
      id: 'batch-y-egg-0530',
      productionItemId: 'pi-central-egg-filling',
      benchId: 'bench-run-cold-prep',
      date: dayOffset(-1),
      startTime: '05:30', endTime: '05:41',
      actualQty: 2, status: 'reviewed',
      assignedUserId: 'user-staff-central-2',
    },
    {
      id: 'batch-y-tuna-0545',
      productionItemId: 'pi-central-tuna-filling',
      benchId: 'bench-run-cold-prep',
      date: dayOffset(-1),
      startTime: '05:45', endTime: '05:54',
      actualQty: 2, status: 'reviewed',
      assignedUserId: 'user-staff-central-2',
    },
    {
      id: 'batch-y-chicken-mayo-0600',
      productionItemId: 'pi-central-filling',
      benchId: 'bench-run-cold-prep',
      date: dayOffset(-1),
      startTime: '06:00', endTime: '06:13',
      actualQty: 2, status: 'reviewed',
      assignedUserId: 'user-staff-central-2',
    },
    // Hot prep — Marco roast tray, ran a touch long
    {
      id: 'batch-y-roast-0600',
      productionItemId: 'pi-central-roast-chicken',
      benchId: 'bench-run-hot-prep',
      date: dayOffset(-1),
      startTime: '06:00', endTime: '06:42',
      actualQty: 8, status: 'reviewed',
      assignedUserId: 'user-staff-central-3',
    },
    // Grill — Marco on chicken
    {
      id: 'batch-y-grilled-0830',
      productionItemId: 'pi-central-grilled-chicken',
      benchId: 'bench-grill',
      date: dayOffset(-1),
      startTime: '08:30', endTime: '08:49',
      actualQty: 10, status: 'reviewed',
      assignedUserId: 'user-staff-central-3',
    },
    // Assembly — Ade fast on club + egg-mayo
    {
      id: 'batch-y-club-0900',
      productionItemId: 'pi-central-club',
      benchId: 'bench-assembly',
      date: dayOffset(-1),
      startTime: '09:00', endTime: '09:07',
      actualQty: 10, status: 'reviewed',
      assignedUserId: 'user-staff-central-4',
    },
    {
      id: 'batch-y-egg-sw-0915',
      productionItemId: 'pi-central-egg-mayo-sw',
      benchId: 'bench-assembly',
      date: dayOffset(-1),
      startTime: '09:15', endTime: '09:20',
      actualQty: 10, status: 'reviewed',
      assignedUserId: 'user-staff-central-4',
    },
    {
      id: 'batch-y-tuna-sw-0930',
      productionItemId: 'pi-central-tuna-sw',
      benchId: 'bench-assembly',
      date: dayOffset(-1),
      startTime: '09:30', endTime: '09:36',
      actualQty: 10, status: 'reviewed',
      assignedUserId: 'user-staff-central-4',
    },
    {
      id: 'batch-y-hummus-wrap-0945',
      productionItemId: 'pi-central-hummus-wrap',
      benchId: 'bench-assembly',
      date: dayOffset(-1),
      startTime: '09:45', endTime: '09:52',
      actualQty: 8, status: 'reviewed',
      assignedUserId: 'user-staff-central-4',
    },
    // Cookie increments through the day
    {
      id: 'batch-y-cookie-0900',
      productionItemId: 'pi-central-cookie',
      benchId: 'bench-increment-hot',
      date: dayOffset(-1),
      startTime: '09:00', endTime: '09:13',
      actualQty: 8, status: 'reviewed',
      assignedUserId: 'user-staff-central-3',
    },
    {
      id: 'batch-y-cookie-1100',
      productionItemId: 'pi-central-cookie',
      benchId: 'bench-increment-hot',
      date: dayOffset(-1),
      startTime: '11:00', endTime: '11:18',
      actualQty: 8, status: 'reviewed',
      assignedUserId: 'user-staff-central-3',
    },
    // Coffee restocks — fast
    {
      id: 'batch-y-coffee-0700',
      productionItemId: 'pi-central-coffee',
      benchId: 'bench-increment-hot',
      date: dayOffset(-1),
      startTime: '07:00', endTime: '07:04',
      actualQty: 1, status: 'reviewed',
      assignedUserId: 'user-staff-central-2',
    },
    {
      id: 'batch-y-coffee-0930',
      productionItemId: 'pi-central-coffee',
      benchId: 'bench-increment-hot',
      date: dayOffset(-1),
      startTime: '09:30', endTime: '09:33',
      actualQty: 1, status: 'reviewed',
      assignedUserId: 'user-staff-central-2',
    },
  ],

  pcrRecords: [
    {
      id: 'pcr-croissant-0530',
      batchId: 'batch-croissant-0530',
      type: 'batch',
      qualityCheck: true,
      labelCheck: true,
      signedBy: 'user-manager-central',
      signedAt: `${DEMO_TODAY}T05:52:00Z`,
      notes: 'Good colour, even bake.',
    },
    {
      id: 'pcr-pain-0630',
      batchId: 'batch-pain-0630',
      type: 'batch',
      qualityCheck: false,
      labelCheck: null,
      signedBy: 'user-manager-central',
      signedAt: `${DEMO_TODAY}T06:55:00Z`,
      notes: 'Over-baked. Routed to waste log; remake batch queued.',
    },
    {
      id: 'pcr-salad-on-demand',
      batchId: 'batch-salad-on-demand-1100',
      type: 'on-demand',
      qualityCheck: true,
      labelCheck: true,
      signedBy: 'user-staff-central',
      signedAt: `${DEMO_TODAY}T11:06:00Z`,
    },
    {
      id: 'pcr-filling-prep',
      // preparation PCR attaches to prep-stage batch (filling not yet baked into a parent)
      batchId: 'batch-coffee-0700', // placeholder to keep shape valid; in real life links to prep batch
      type: 'preparation',
      qualityCheck: true,
      labelCheck: true,
      signedBy: 'user-staff-central',
      signedAt: `${DEMO_TODAY}T09:05:00Z`,
      notes: 'Filling temp 4°C on completion.',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Carry-over — yesterday's unsold adjusts today's plan
// ─────────────────────────────────────────────────────────────────────────────

export type CarryOverEntry = {
  id: string;
  siteId: SiteId;
  skuId: SkuId;
  recipeId: RecipeId;
  /** Units carried from D-1 into D0. */
  carriedUnits: number;
  /** Impact on today's plan (reducing planned qty). */
  planAdjustment: number;
  /** Quinn's proposal → Manager confirms. */
  status: 'draft' | 'confirmed';
  reason: string;
};

export const PRET_CARRY_OVER: CarryOverEntry[] = [
  {
    id: 'co-central-croissant',
    siteId: 'hub-central',
    skuId: 'sku-croissant',
    recipeId: 'prec-croissant',
    carriedUnits: 4,
    planAdjustment: -4,
    status: 'draft',
    reason: '4 croissants unsold yesterday, within 8h shelf. Net plan: 48 → 44.',
  },
  {
    id: 'co-central-pain',
    siteId: 'hub-central',
    skuId: 'sku-pain-au-choc',
    recipeId: 'prec-pain-au-chocolat',
    carriedUnits: 6,
    planAdjustment: -6,
    status: 'draft',
    reason: '6 pain au choc within shelf. Net plan: 36 → 30.',
  },
  {
    id: 'co-central-club',
    siteId: 'hub-central',
    skuId: 'sku-club-sandwich',
    recipeId: 'prec-club-sandwich',
    carriedUnits: 0, // expired — goes to waste not carry-over
    planAdjustment: 0,
    status: 'confirmed',
    reason: '2 sandwiches expired (>8h shelf). Logged to waste, no carry-over.',
  },
  // Spoke carry-over — small numbers because spokes don't bake but they do
  // hold a thin overnight buffer of long-shelf bakery items received late
  // in the day yesterday. Used by the spoke order page to show "you've
  // already got N from yesterday — Quinn nets that out of today's order".
  {
    id: 'co-spoke-east-croissant',
    siteId: 'site-spoke-east',
    skuId: 'sku-croissant',
    recipeId: 'prec-croissant',
    carriedUnits: 3,
    planAdjustment: -3,
    status: 'draft',
    reason: '3 croissants from late drop yesterday, within shelf. Net order: −3.',
  },
  {
    id: 'co-spoke-west-pain',
    siteId: 'site-spoke-west',
    skuId: 'sku-pain-au-choc',
    recipeId: 'prec-pain-au-chocolat',
    carriedUnits: 2,
    planAdjustment: -2,
    status: 'draft',
    reason: '2 pain au choc from late drop yesterday. Net order: −2.',
  },
  {
    id: 'co-spoke-south-baguette',
    siteId: 'site-spoke-south',
    skuId: 'sku-baguette',
    recipeId: 'prec-baguette',
    carriedUnits: 4,
    planAdjustment: -4,
    status: 'draft',
    reason: '4 baguettes left over from yesterday. Net order: −4.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SPOKE submission — site-spoke-south → hub-central for tomorrow's dispatch
// ─────────────────────────────────────────────────────────────────────────────

export type SpokeSubmissionLine = {
  skuId: SkuId;
  recipeId: RecipeId;
  /** Quinn's proposed quantity. */
  quinnProposedUnits: number;
  /** Spoke manager's confirmed quantity (may differ). */
  confirmedUnits: number | null;
};

export type SpokeSubmission = {
  id: string;
  fromSiteId: SiteId;
  toHubId: SiteId;
  /** Date the spoke is ordering FOR. */
  forDate: string;
  /** Cutoff — must submit before this. */
  cutoffDateTime: string; // ISO datetime
  lines: SpokeSubmissionLine[];
  status: 'draft' | 'submitted' | 'acknowledged' | 'modified-by-hub' | 'auto-finalised';
  /** If hub modified, reasons + deltas. */
  hubModifications?: {
    byLine: Record<SkuId, { fromUnits: number; toUnits: number; reason: string }>;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Hub unlock past cutoff
// ─────────────────────────────────────────────────────────────────────────────
//
// PAC-unlock — hub-side override that re-opens a spoke's locked order
// after cutoff. Per the brief: "HUB manager can unlock a SPOKE past
// cutoff (`ignoreCutoff`). Post-unlock, spoke quantities are added to
// the hub's existing plan (not replaced). Unlock auto-resets after
// submission."
//
// We capture the audit trail (who unlocked, when, why) so the spoke can
// see context and the hub has a record. The "added not replaced"
// semantic is enforced UX-side: the spoke's stepper floor for each line
// becomes the locked baseline, so they can only ADD to what's already
// committed — never reduce.
// ─────────────────────────────────────────────────────────────────────────────

export type SpokeUnlock = {
  /** Composite key components — one unlock per (hub, spoke, date). */
  hubId: SiteId;
  spokeId: SiteId;
  forDate: string;
  /** Audit. */
  unlockedAtISO: string;
  unlockedBy: string;
  reason: string;
  /**
   * Snapshot of the locked baseline at unlock time, per SKU. Used
   * spoke-side as the floor on the additive steppers so the spoke can
   * only add — not reduce committed quantities.
   */
  baselineBySku: Record<SkuId, number>;
  /** When the spoke resubmits, we keep the audit but mark it consumed. */
  consumedAtISO?: string;
  /** When the hub sends the dispatch, the unlock is closed entirely. */
  closedAtISO?: string;
};

/**
 * Spoke submissions destined for the central hub. Two cohorts so both the
 * Today amounts view and the Dispatch matrix have something to show:
 *  - "Today" cohort: Spoke East has an acknowledged order for today, so
 *    the hub's Today amounts already include dispatch on top of counter sales.
 *  - "Tomorrow" cohort: South / East / West are all ordering for tomorrow
 *    in a mix of statuses so the Dispatch tab demo flow stays rich.
 */
export const PRET_SPOKE_SUBMISSIONS: SpokeSubmission[] = [
  {
    id: 'spoke-sub-east-today',
    fromSiteId: 'site-spoke-east',
    toHubId: 'hub-central',
    forDate: DEMO_TODAY,
    cutoffDateTime: `${dayOffset(-1)}T15:00:00Z`,
    status: 'acknowledged',
    lines: [
      { skuId: 'sku-croissant',     recipeId: 'prec-croissant',        quinnProposedUnits: 18, confirmedUnits: 18 },
      { skuId: 'sku-pain-au-choc',  recipeId: 'prec-pain-au-chocolat', quinnProposedUnits: 12, confirmedUnits: 12 },
      { skuId: 'sku-baguette',      recipeId: 'prec-baguette',         quinnProposedUnits: 10, confirmedUnits: 10 },
      { skuId: 'sku-tuna-sandwich', recipeId: 'prec-tuna-sandwich',    quinnProposedUnits: 14, confirmedUnits: 14 },
    ],
  },
  {
    // Today's drop — acknowledged by the hub overnight, currently in
    // transit to the South spoke. Gives the spoke's Today panel a
    // realistic "Arriving today" payload across all categories.
    id: 'spoke-sub-south-today',
    fromSiteId: 'site-spoke-south',
    toHubId: 'hub-central',
    forDate: DEMO_TODAY,
    cutoffDateTime: `${dayOffset(-1)}T15:00:00Z`,
    status: 'acknowledged',
    lines: [
      { skuId: 'sku-croissant',           recipeId: 'prec-croissant',           quinnProposedUnits: 22, confirmedUnits: 22 },
      { skuId: 'sku-pain-au-choc',        recipeId: 'prec-pain-au-chocolat',    quinnProposedUnits: 14, confirmedUnits: 14 },
      { skuId: 'sku-almond-croissant',    recipeId: 'prec-almond-croissant',    quinnProposedUnits: 10, confirmedUnits: 10 },
      { skuId: 'sku-cinnamon-swirl',      recipeId: 'prec-cinnamon-swirl',      quinnProposedUnits: 6,  confirmedUnits: 6  },
      { skuId: 'sku-blueberry-muffin',    recipeId: 'prec-blueberry-muffin',    quinnProposedUnits: 12, confirmedUnits: 12 },
      { skuId: 'sku-banana-bread',        recipeId: 'prec-banana-bread',        quinnProposedUnits: 8,  confirmedUnits: 8  },
      { skuId: 'sku-brownie',             recipeId: 'prec-brownie',             quinnProposedUnits: 8,  confirmedUnits: 8  },
      { skuId: 'sku-baguette',            recipeId: 'prec-baguette',            quinnProposedUnits: 12, confirmedUnits: 12 },
      { skuId: 'sku-granary',             recipeId: 'prec-granary',             quinnProposedUnits: 6,  confirmedUnits: 6  },
      { skuId: 'sku-egg-mayo-sandwich',   recipeId: 'prec-egg-mayo-sandwich',   quinnProposedUnits: 16, confirmedUnits: 16 },
      { skuId: 'sku-tuna-sandwich',       recipeId: 'prec-tuna-sandwich',       quinnProposedUnits: 12, confirmedUnits: 12 },
      { skuId: 'sku-ham-cheese-baguette', recipeId: 'prec-ham-cheese-baguette', quinnProposedUnits: 10, confirmedUnits: 10 },
      { skuId: 'sku-turkey-brie-baguette',recipeId: 'prec-turkey-brie-baguette',quinnProposedUnits: 8,  confirmedUnits: 8  },
      { skuId: 'sku-hummus-wrap',         recipeId: 'prec-hummus-wrap',         quinnProposedUnits: 10, confirmedUnits: 10 },
      { skuId: 'sku-chicken-caesar',      recipeId: 'prec-chicken-caesar',      quinnProposedUnits: 10, confirmedUnits: 10 },
      { skuId: 'sku-med-grain-bowl',      recipeId: 'prec-med-grain-bowl',      quinnProposedUnits: 8,  confirmedUnits: 8  },
      { skuId: 'sku-falafel-bowl',        recipeId: 'prec-falafel-bowl',        quinnProposedUnits: 6,  confirmedUnits: 6  },
      { skuId: 'sku-fruit-pot',           recipeId: 'prec-fruit-pot',           quinnProposedUnits: 12, confirmedUnits: 12 },
      { skuId: 'sku-yogurt-pot',          recipeId: 'prec-yogurt-pot',          quinnProposedUnits: 10, confirmedUnits: 10 },
      { skuId: 'sku-granola-pot',         recipeId: 'prec-granola-pot',         quinnProposedUnits: 8,  confirmedUnits: 8  },
    ],
  },
  {
    id: 'spoke-sub-south-friday',
    fromSiteId: 'site-spoke-south',
    toHubId: 'hub-central',
    forDate: dayOffset(1),
    cutoffDateTime: `${DEMO_TODAY}T15:00:00Z`,
    status: 'draft',
    lines: [
      // Bakery
      { skuId: 'sku-croissant',           recipeId: 'prec-croissant',           quinnProposedUnits: 30, confirmedUnits: null },
      { skuId: 'sku-pain-au-choc',        recipeId: 'prec-pain-au-chocolat',    quinnProposedUnits: 20, confirmedUnits: null },
      { skuId: 'sku-almond-croissant',    recipeId: 'prec-almond-croissant',    quinnProposedUnits: 12, confirmedUnits: null },
      { skuId: 'sku-cinnamon-swirl',      recipeId: 'prec-cinnamon-swirl',      quinnProposedUnits: 8,  confirmedUnits: null },
      { skuId: 'sku-blueberry-muffin',    recipeId: 'prec-blueberry-muffin',    quinnProposedUnits: 12, confirmedUnits: null },
      { skuId: 'sku-banana-bread',        recipeId: 'prec-banana-bread',        quinnProposedUnits: 8,  confirmedUnits: null },
      { skuId: 'sku-brownie',             recipeId: 'prec-brownie',             quinnProposedUnits: 8,  confirmedUnits: null },
      { skuId: 'sku-baguette',            recipeId: 'prec-baguette',            quinnProposedUnits: 12, confirmedUnits: null },
      { skuId: 'sku-granary',             recipeId: 'prec-granary',             quinnProposedUnits: 8,  confirmedUnits: null },
      // Sandwich
      { skuId: 'sku-club-sandwich',       recipeId: 'prec-club-sandwich',       quinnProposedUnits: 18, confirmedUnits: null },
      { skuId: 'sku-egg-mayo-sandwich',   recipeId: 'prec-egg-mayo-sandwich',   quinnProposedUnits: 18, confirmedUnits: null },
      { skuId: 'sku-tuna-sandwich',       recipeId: 'prec-tuna-sandwich',       quinnProposedUnits: 14, confirmedUnits: null },
      { skuId: 'sku-ham-cheese-baguette', recipeId: 'prec-ham-cheese-baguette', quinnProposedUnits: 12, confirmedUnits: null },
      { skuId: 'sku-turkey-brie-baguette',recipeId: 'prec-turkey-brie-baguette',quinnProposedUnits: 10, confirmedUnits: null },
      { skuId: 'sku-hummus-wrap',         recipeId: 'prec-hummus-wrap',         quinnProposedUnits: 12, confirmedUnits: null },
      // Salad
      { skuId: 'sku-chicken-caesar',      recipeId: 'prec-chicken-caesar',      quinnProposedUnits: 12, confirmedUnits: null },
      { skuId: 'sku-med-grain-bowl',      recipeId: 'prec-med-grain-bowl',      quinnProposedUnits: 10, confirmedUnits: null },
      { skuId: 'sku-falafel-bowl',        recipeId: 'prec-falafel-bowl',        quinnProposedUnits: 8,  confirmedUnits: null },
      // Snack
      { skuId: 'sku-fruit-pot',           recipeId: 'prec-fruit-pot',           quinnProposedUnits: 12, confirmedUnits: null },
      { skuId: 'sku-yogurt-pot',          recipeId: 'prec-yogurt-pot',          quinnProposedUnits: 10, confirmedUnits: null },
      { skuId: 'sku-granola-pot',         recipeId: 'prec-granola-pot',         quinnProposedUnits: 8,  confirmedUnits: null },
    ],
  },
  {
    id: 'spoke-sub-east-friday',
    fromSiteId: 'site-spoke-east',
    toHubId: 'hub-central',
    forDate: dayOffset(1),
    cutoffDateTime: `${DEMO_TODAY}T15:00:00Z`,
    status: 'submitted',
    lines: [
      { skuId: 'sku-croissant',     recipeId: 'prec-croissant',        quinnProposedUnits: 24, confirmedUnits: 24 },
      { skuId: 'sku-baguette',      recipeId: 'prec-baguette',         quinnProposedUnits: 12, confirmedUnits: 18 },
      { skuId: 'sku-tuna-sandwich', recipeId: 'prec-tuna-sandwich',    quinnProposedUnits: 18, confirmedUnits: 18 },
      { skuId: 'sku-club-sandwich', recipeId: 'prec-club-sandwich',    quinnProposedUnits: 32, confirmedUnits: 28 },
    ],
  },
  {
    id: 'spoke-sub-west-friday',
    fromSiteId: 'site-spoke-west',
    toHubId: 'hub-central',
    forDate: dayOffset(1),
    cutoffDateTime: `${DEMO_TODAY}T15:00:00Z`,
    status: 'acknowledged',
    lines: [
      { skuId: 'sku-pain-au-choc',     recipeId: 'prec-pain-au-chocolat', quinnProposedUnits: 18, confirmedUnits: 18 },
      { skuId: 'sku-almond-croissant', recipeId: 'prec-almond-croissant', quinnProposedUnits: 12, confirmedUnits: 12 },
      { skuId: 'sku-granary',          recipeId: 'prec-granary',          quinnProposedUnits: 8,  confirmedUnits: 8  },
      { skuId: 'sku-egg-mayo-sandwich', recipeId: 'prec-egg-mayo-sandwich', quinnProposedUnits: 22, confirmedUnits: 22 },
      { skuId: 'sku-hummus-wrap',      recipeId: 'prec-hummus-wrap',      quinnProposedUnits: 14, confirmedUnits: 14 },
    ],
  },
  // PAC139 — Islington North is now a linked standalone (dark-kitchen
  // pattern). Same submission shape as a spoke; the dispatch matrix
  // treats it as another receiver column.
  {
    id: 'sub-north-friday',
    fromSiteId: 'site-standalone-north',
    toHubId: 'hub-central',
    forDate: dayOffset(1),
    cutoffDateTime: `${DEMO_TODAY}T15:00:00Z`,
    status: 'submitted',
    lines: [
      { skuId: 'sku-croissant',        recipeId: 'prec-croissant',        quinnProposedUnits: 22, confirmedUnits: 22 },
      { skuId: 'sku-pain-au-choc',     recipeId: 'prec-pain-au-chocolat', quinnProposedUnits: 14, confirmedUnits: 16 },
      { skuId: 'sku-almond-croissant', recipeId: 'prec-almond-croissant', quinnProposedUnits: 10, confirmedUnits: 10 },
      { skuId: 'sku-baguette',         recipeId: 'prec-baguette',         quinnProposedUnits: 8,  confirmedUnits: 8  },
      { skuId: 'sku-tuna-sandwich',    recipeId: 'prec-tuna-sandwich',    quinnProposedUnits: 12, confirmedUnits: 12 },
    ],
  },
];

/**
 * Back-compat alias so existing single-submission consumers keep working
 * unchanged. Points at South's draft for tomorrow — that's the submission
 * the spoke-flow page surfaces as "the active draft to send".
 */
export const PRET_SPOKE_SUBMISSION: SpokeSubmission =
  PRET_SPOKE_SUBMISSIONS.find(s => s.id === 'spoke-sub-south-friday') ?? PRET_SPOKE_SUBMISSIONS[0];

/**
 * All submissions destined for the given hub on the given date (or any
 * date if `forDate` is omitted). Submissions are returned in the order
 * they appear in `PRET_SPOKE_SUBMISSIONS` (typically South / East / West).
 */
export function submissionsForHub(hubId: SiteId, forDate?: string): SpokeSubmission[] {
  return PRET_SPOKE_SUBMISSIONS.filter(s => {
    if (s.toHubId !== hubId) return false;
    if (forDate && s.forDate !== forDate) return false;
    return true;
  });
}

/**
 * Find the seeded submission a spoke has placed (or is drafting) with a
 * given hub for a given date. Returns undefined when the spoke hasn't
 * touched that day yet — callers should treat that as "Quinn-only draft,
 * spoke hasn't started yet".
 */
export function submissionFor(spokeId: SiteId, hubId: SiteId, forDate: string): SpokeSubmission | undefined {
  return PRET_SPOKE_SUBMISSIONS.find(
    s => s.fromSiteId === spokeId && s.toHubId === hubId && s.forDate === forDate,
  );
}

/**
 * All sites that pull from the given hub — regular SPOKEs and STANDALONEs
 * with `linkType: 'linked'` (PAC139 dark-kitchen pattern). HYBRIDs are
 * included too since they also receive partial production. Used by the
 * spoke-flow page selector and any UI that needs to enumerate the hub's
 * downstream receivers.
 *
 * Returned in the order they appear in `PRET_SITES`.
 */
export function linkedReceiversFor(hubId: SiteId): Site[] {
  return PRET_SITES.filter(s => {
    if (s.hubId !== hubId) return false;
    if (s.type === 'SPOKE' || s.type === 'HYBRID') return true;
    if (s.type === 'STANDALONE' && s.linkType === 'linked') return true;
    return false;
  });
}

/** True when a site receives some / all production from a hub. */
export function isHubLinked(site: Site | undefined): boolean {
  if (!site || !site.hubId) return false;
  if (site.type === 'SPOKE' || site.type === 'HYBRID') return true;
  if (site.type === 'STANDALONE' && site.linkType === 'linked') return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spoke order ledger — the spoke-side equivalent of `amountsForSiteOnDate`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row on the spoke order page: the recipe the spoke could ask the hub
 * for, the spoke's own forecast for it, any carry-over they're sitting on,
 * Quinn's proposed order, plus whatever the spoke has currently dialled in
 * (from a seeded submission line if one exists, otherwise the Quinn default).
 */
export type SpokeOrderLine = {
  recipe: ProductionRecipe;
  skuId: SkuId;
  recipeId: RecipeId;
  forecast?: DemandForecastEntry;
  carryOver?: CarryOverEntry;
  /** Forecast minus carry-over, never below zero. */
  quinnProposed: number;
  /**
   * What the spoke is currently asking for. Comes from the seeded submission's
   * `confirmedUnits` when present, falls back to `quinnProposedUnits`, and
   * falls back to the derived `quinnProposed` when there's no seeded line at
   * all (i.e. spoke hasn't touched this recipe).
   */
  confirmed: number;
  /** True when the line came from a seeded submission (spoke has touched it). */
  hasSeeded: boolean;
};

export type SpokeOrderSummary = {
  spokeId: SiteId;
  hubId: SiteId;
  date: string;
  /** The seeded submission backing this date, if any. */
  submission?: SpokeSubmission;
  cutoffDateTime: string;
  status: SpokeSubmission['status'] | 'derived';
  lines: SpokeOrderLine[];
};

/**
 * Build the full ledger of recipes a spoke could order from its hub for a
 * given date. Recipes are sourced from the hub's `productionItemsAt(hub)`
 * (i.e. anything the hub bakes), each annotated with the spoke's derived
 * forecast and any carry-over they have. Seeded submission lines (when
 * present) override the Quinn default for that line so the spoke sees the
 * numbers they (or Quinn-on-their-behalf) actually committed.
 *
 * `cutoffDateTime` is taken from a seeded submission when one exists; the
 * fallback is "15:00 UTC the day before `forDate`", matching the seeded
 * pattern.
 */
export function spokeOrderForDate(spokeId: SiteId, hubId: SiteId, forDate: string): SpokeOrderSummary {
  const submission = submissionFor(spokeId, hubId, forDate);
  const seededBySku = new Map<SkuId, SpokeSubmissionLine>();
  if (submission) {
    for (const ln of submission.lines) seededBySku.set(ln.skuId, ln);
  }

  // The spoke's order menu = whatever the hub bakes. We dedupe by SKU to
  // collapse any duplicate hub items.
  const hubItems = productionItemsAt(hubId);
  const seenSku = new Set<SkuId>();
  const lines: SpokeOrderLine[] = [];
  for (const item of hubItems) {
    if (seenSku.has(item.skuId)) continue;
    seenSku.add(item.skuId);
    const recipe = getRecipe(item.recipeId);
    if (!recipe) continue;

    const forecast = forecastFor(spokeId, item.skuId, forDate);
    const carryOver = carryOverFor(spokeId, item.skuId);
    const base = forecast?.projectedUnits ?? 0;
    const carried = carryOver?.carriedUnits ?? 0;
    const quinnProposed = Math.max(0, base - carried);

    const seeded = seededBySku.get(item.skuId);
    const confirmed = seeded
      ? (seeded.confirmedUnits ?? seeded.quinnProposedUnits)
      : quinnProposed;

    lines.push({
      recipe,
      skuId: item.skuId,
      recipeId: item.recipeId,
      forecast,
      carryOver,
      quinnProposed,
      confirmed,
      hasSeeded: !!seeded,
    });
  }

  // Stable category order, then recipe name.
  const CATEGORY_ORDER: ProductionRecipe['category'][] = ['Bakery', 'Sandwich', 'Salad', 'Snack', 'Beverage'];
  lines.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.recipe.category);
    const bi = CATEGORY_ORDER.indexOf(b.recipe.category);
    if (ai !== bi) return ai - bi;
    return a.recipe.name.localeCompare(b.recipe.name);
  });

  const defaultCutoff = `${dayOffset(-1, forDate)}T15:00:00Z`;
  return {
    spokeId,
    hubId,
    date: forDate,
    submission,
    cutoffDateTime: submission?.cutoffDateTime ?? defaultCutoff,
    status: submission?.status ?? 'derived',
    lines,
  };
}

/**
 * Hub-level policy knobs the Support Centre owns. The prototype only honours
 * `spokeCutoffPolicy` so far:
 *  - 'lock' (default): when `cutoffDateTime` passes and a spoke draft hasn't
 *    been submitted yet, lock the steppers and auto-promote the status to
 *    `'auto-finalised'` using Quinn's proposed numbers. This is what real
 *    Pret hubs need so a missed cutoff doesn't leave the bake order unknown.
 *  - 'soft': just badge the page as overdue but stay editable. Useful for
 *    smaller hubs that prefer a softer reminder loop.
 */
export type HubSettings = {
  hubId: SiteId;
  spokeCutoffPolicy: 'lock' | 'soft';
};

export const PRET_HUB_SETTINGS: HubSettings[] = [
  { hubId: 'hub-central', spokeCutoffPolicy: 'lock' },
];

export function hubSettingsFor(hubId: SiteId): HubSettings | undefined {
  return PRET_HUB_SETTINGS.find(s => s.hubId === hubId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Night-shift policy (PAC070)
//
// Pret-style night shift handles overnight prep: long-ferment doughs, items
// that need to bake then cool before pack, slow roasts. The "correct order"
// of work on a night-shift run is set centrally — Quinn applies it on the
// bench cards so a new GM doesn't have to remember the sequence.
//
// The policy has two parts:
//   • firstOrder — explicit SKUs that MUST go first (long ferments, things
//     that need overnight cooling). Sorted in this exact sequence so cooling
//     items hit the rack before they block other work.
//   • categoryOrder — fallback priority for everything else. Within a
//     category we tie-break by shelf-life ascending so the most fragile
//     items finish closest to handover.
// ─────────────────────────────────────────────────────────────────────────────

export type NightShiftPolicy = {
  /** HH:MM start of the night-shift window (inclusive). */
  nightStart: string;
  /** HH:MM end of the night-shift window (exclusive). */
  nightEnd: string;
  /**
   * Recipes that must be produced first within a night-shift run, in this
   * exact sequence. Catches long-ferment / long-cool / long-roast items.
   */
  firstOrder: SkuId[];
  /**
   * Category priority within a night-shift run for everything not in
   * firstOrder. Within the same category, tie-break by shelf-life ascending.
   */
  categoryOrder: ProductionRecipe['category'][];
};

export const PRET_NIGHT_SHIFT_POLICY: NightShiftPolicy = {
  nightStart: '22:00',
  nightEnd: '05:00',
  firstOrder: [
    'sku-granary',           // overnight-fermented loaf — needs long proof
    'sku-baguette',          // overnight-fermented baguette
    'sku-egg-mayo-filling',  // needs 4h+ chill before assembly
    'sku-tuna-mayo-filling', // needs 4h+ chill before assembly
    'sku-granola-pot',       // bake & cool overnight before pack
    'sku-roast-chicken',     // slow-roast tray — cool before slice
  ],
  categoryOrder: ['Bakery', 'Snack', 'Sandwich', 'Salad', 'Beverage'],
};

/**
 * True when an HH:MM time falls inside the night-shift window. Window may
 * wrap midnight (e.g. 22:00 → 05:00) — we handle that by checking either
 * side of the wrap.
 */
export function isNightShiftHHMM(hhmm: string, policy: NightShiftPolicy = PRET_NIGHT_SHIFT_POLICY): boolean {
  const toMins = (h: string) => {
    const [hh, mm] = h.split(':').map(Number);
    return hh * 60 + mm;
  };
  const start = toMins(policy.nightStart);
  const end = toMins(policy.nightEnd);
  const now = toMins(hhmm);
  if (start <= end) return now >= start && now < end;
  // Wraps midnight — anything from start..23:59 OR 00:00..end counts.
  return now >= start || now < end;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch transfers — hub-side action recording (PAC137)
//
// When a hub manager hits "Send" on the dispatch matrix, we record a
// DispatchTransfer summarising what physically left the hub for that spoke
// on that day. The store lives in components/Production/dispatchStore.tsx
// (provider + hook); these types are the shared schema.
// ─────────────────────────────────────────────────────────────────────────────

export type DispatchTransferLine = {
  skuId: SkuId;
  recipeId: RecipeId;
  units: number;
  /**
   * True when the source quantity was Quinn's proposal (the spoke hadn't
   * confirmed yet). False when the spoke confirmed the number themselves.
   * Used by the audit panel and the Sent toast so the hub manager knows
   * which lines went out on best-guess vs explicit confirmation.
   */
  wasQuinnProposed: boolean;
};

export type DispatchTransfer = {
  id: string;
  hubId: SiteId;
  spokeId: SiteId;
  /** Date the dispatch is for (the spoke's order day). */
  forDate: string;
  /** ISO timestamp when the manager confirmed Send. */
  sentAtISO: string;
  /** Display name of the operator who sent it (demo). */
  sentBy: string;
  lines: DispatchTransferLine[];
  totalUnits: number;
  /** Optional override note — surfaced on the audit panel. */
  note?: string;
};

/**
 * Seeded dispatch transfers (yesterday only) so the spoke-side rejects
 * card has a concrete shipment to log against on first load. The runtime
 * `dispatchStore` overlays additional transfers a manager creates in-app.
 *
 * Lines mirror the spoke's previous-day submission so the demo feels
 * coherent ("hub sent 18 croissants → spoke rejected 3 of them").
 */
export const PRET_DISPATCH_TRANSFER_SEEDS: DispatchTransfer[] = [
  {
    id: 'transfer-seed-clapham-yesterday',
    hubId: 'hub-central',
    spokeId: 'site-spoke-south',
    forDate: dayOffset(-1),
    sentAtISO: `${dayOffset(-1)}T05:30:00Z`,
    sentBy: 'Hub manager (demo)',
    lines: [
      // Bakery — opening peak
      { skuId: 'sku-croissant',          recipeId: 'prec-croissant',          units: 18, wasQuinnProposed: false },
      { skuId: 'sku-pain-au-choc',       recipeId: 'prec-pain-au-chocolat',   units: 12, wasQuinnProposed: false },
      { skuId: 'sku-almond-croissant',   recipeId: 'prec-almond-croissant',   units: 8,  wasQuinnProposed: false },
      { skuId: 'sku-cinnamon-swirl',     recipeId: 'prec-cinnamon-swirl',     units: 6,  wasQuinnProposed: false },
      { skuId: 'sku-blueberry-muffin',   recipeId: 'prec-blueberry-muffin',   units: 12, wasQuinnProposed: false },
      { skuId: 'sku-banana-bread',       recipeId: 'prec-banana-bread',       units: 8,  wasQuinnProposed: false },
      { skuId: 'sku-brownie',            recipeId: 'prec-brownie',            units: 8,  wasQuinnProposed: false },
      { skuId: 'sku-baguette',           recipeId: 'prec-baguette',           units: 12, wasQuinnProposed: false },
      { skuId: 'sku-granary',            recipeId: 'prec-granary',            units: 6,  wasQuinnProposed: false },
      // Sandwich — lunch core
      { skuId: 'sku-egg-mayo-sandwich',  recipeId: 'prec-egg-mayo-sandwich',  units: 14, wasQuinnProposed: false },
      { skuId: 'sku-tuna-sandwich',      recipeId: 'prec-tuna-sandwich',      units: 10, wasQuinnProposed: false },
      { skuId: 'sku-ham-cheese-baguette',recipeId: 'prec-ham-cheese-baguette',units: 10, wasQuinnProposed: false },
      { skuId: 'sku-turkey-brie-baguette',recipeId: 'prec-turkey-brie-baguette',units: 8, wasQuinnProposed: false },
      { skuId: 'sku-hummus-wrap',        recipeId: 'prec-hummus-wrap',        units: 10, wasQuinnProposed: false },
      // Salad — midday
      { skuId: 'sku-chicken-caesar',     recipeId: 'prec-chicken-caesar',     units: 8,  wasQuinnProposed: false },
      { skuId: 'sku-med-grain-bowl',     recipeId: 'prec-med-grain-bowl',     units: 6,  wasQuinnProposed: false },
      { skuId: 'sku-falafel-bowl',       recipeId: 'prec-falafel-bowl',       units: 6,  wasQuinnProposed: false },
      // Snacks
      { skuId: 'sku-fruit-pot',          recipeId: 'prec-fruit-pot',          units: 10, wasQuinnProposed: false },
      { skuId: 'sku-yogurt-pot',         recipeId: 'prec-yogurt-pot',         units: 8,  wasQuinnProposed: false },
      { skuId: 'sku-granola-pot',        recipeId: 'prec-granola-pot',        units: 6,  wasQuinnProposed: false },
    ],
    totalUnits: 186,
  },
  {
    id: 'transfer-seed-east-yesterday',
    hubId: 'hub-central',
    spokeId: 'site-spoke-east',
    forDate: dayOffset(-1),
    sentAtISO: `${dayOffset(-1)}T05:35:00Z`,
    sentBy: 'Hub manager (demo)',
    lines: [
      { skuId: 'sku-croissant',         recipeId: 'prec-croissant',         units: 24, wasQuinnProposed: false },
      { skuId: 'sku-almond-croissant',  recipeId: 'prec-almond-croissant',  units: 8,  wasQuinnProposed: false },
      { skuId: 'sku-egg-mayo-sandwich', recipeId: 'prec-egg-mayo-sandwich', units: 16, wasQuinnProposed: false },
    ],
    totalUnits: 48,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Spoke rejects — PAC140 / PAC141 / PAC142
//
// When a spoke receives a hub dispatch, some units may arrive damaged, with
// short shelf life or wrong-spec. The spoke records these rejections, the
// hub sees them on its dispatch surface (and in waste totals), and the
// rejected qty is auto-rolled into the next drop so the spoke isn't short.
//
// Data model goals:
//  - One reject record per (spoke, hub, transferId) — i.e. per shipment
//  - Multiple lines per record (1 line per SKU rejected)
//  - Lifecycle: 'recorded' → 'acknowledged' (hub has seen it)
//  - Roll-forward: when the next transfer is sent for that spoke + sku,
//    the reject's `rolledIntoNext` flips so it isn't double-counted.
// ─────────────────────────────────────────────────────────────────────────────

export type SpokeRejectId = string;

export type SpokeRejectReason = 'damaged' | 'short-life' | 'wrong-spec' | 'other';

export const SPOKE_REJECT_REASON_LABEL: Record<SpokeRejectReason, string> = {
  damaged: 'Damaged in transit',
  'short-life': 'Short shelf life',
  'wrong-spec': 'Wrong spec',
  other: 'Other',
};

export type SpokeRejectLine = {
  skuId: SkuId;
  recipeId: RecipeId;
  /** How many units arrived rejectable. */
  rejectedUnits: number;
  reason: SpokeRejectReason;
  note?: string;
};

export type SpokeReject = {
  id: SpokeRejectId;
  spokeId: SiteId;
  hubId: SiteId;
  /**
   * Date the rejected dispatch was for. The reject record itself was
   * `recordedAtISO` later (typically the same day, after receipt).
   */
  forDate: string;
  recordedAtISO: string;
  recordedBy?: string;
  /** Source dispatch transfer (when known). Optional for ad-hoc records. */
  transferId?: string;
  lines: SpokeRejectLine[];
  /** Sum of `lines[].rejectedUnits` — cached for header summaries. */
  totalRejectedUnits: number;
  /** True once the hub manager has marked it seen on the dispatch page. */
  hubAcknowledged: boolean;
  /**
   * True once the rejected qty has been folded into a subsequent dispatch
   * (so the matrix doesn't keep adding the same rejects to every future
   * day's drop).
   */
  rolledIntoNext: boolean;
};

/**
 * One seeded reject so the demo opens with the loop populated:
 * Clapham received yesterday's drop, 3 of the 18 croissants arrived
 * damaged. The hub side surfaces it on dispatch; tomorrow's drop will
 * show "+3 (rejects from Thu)" until rolled.
 */
export const PRET_SPOKE_REJECT_SEEDS: SpokeReject[] = [
  {
    id: 'reject-seed-clapham-yesterday',
    spokeId: 'site-spoke-south',
    hubId: 'hub-central',
    forDate: dayOffset(-1),
    recordedAtISO: `${dayOffset(-1)}T08:15:00Z`,
    recordedBy: 'Spoke manager (demo)',
    transferId: 'transfer-seed-clapham-yesterday',
    lines: [
      {
        skuId: 'sku-croissant',
        recipeId: 'prec-croissant',
        rejectedUnits: 3,
        reason: 'damaged',
        note: 'Crushed in tray — likely stacking issue at the hub.',
      },
    ],
    totalRejectedUnits: 3,
    hubAcknowledged: false,
    rolledIntoNext: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Spoke ad-hoc requests (PAC-adhoc)
// ─────────────────────────────────────────────────────────────────────────────
// Story:
//  - A spoke needs MORE than they originally ordered (or didn't order
//    something and needs it now). They send an ad-hoc request to their hub.
//  - The hub manager reviews on /production/dispatch and either approves
//    as-is, approves with a smaller qty, or rejects with a reason.
//  - Approved units flow into the dispatch matrix as an augmentation
//    (visible alongside the regular order + rejects roll-forward).
//  - Lifecycle per record: 'pending' → 'approved' | 'partial' | 'rejected'
//  - Per-line: 'pending' → 'approved' | 'partial' | 'rejected'
// ─────────────────────────────────────────────────────────────────────────────

export type AdhocRequestId = string;

export type AdhocRequestReason =
  | 'unexpected-demand'
  | 'event-booking'
  | 'shortage'
  | 'quality-issue'
  | 'other';

export const ADHOC_REQUEST_REASON_LABEL: Record<AdhocRequestReason, string> = {
  'unexpected-demand': 'Unexpected demand',
  'event-booking':     'Event / pre-order',
  'shortage':          'Ran out earlier than planned',
  'quality-issue':     'Quality issue with stock on hand',
  'other':             'Other',
};

export type AdhocRequestLineStatus = 'pending' | 'approved' | 'partial' | 'rejected';

export type AdhocRequestLine = {
  id: string;
  skuId: SkuId;
  recipeId: RecipeId;
  /** What the spoke originally asked for. */
  requestedUnits: number;
  /**
   * What the hub agreed to send. Undefined while the request is still
   * pending. When `lineStatus === 'partial'` this is < requestedUnits;
   * when 'approved' it equals requestedUnits; 'rejected' = 0.
   */
  approvedUnits?: number;
  lineStatus: AdhocRequestLineStatus;
  /** Hub's note when partial/rejected (e.g. "out of butter"). */
  hubNote?: string;
};

export type AdhocRequestStatus = 'pending' | 'approved' | 'partial' | 'rejected';

export type AdhocRequest = {
  id: AdhocRequestId;
  spokeId: SiteId;
  hubId: SiteId;
  /** Day the units are needed. Drives which dispatch matrix the approval lands in. */
  forDate: string;
  /** When the spoke submitted. */
  submittedAtISO: string;
  submittedBy?: string;
  reason: AdhocRequestReason;
  /** Optional free-text context from the spoke. */
  notes?: string;
  lines: AdhocRequestLine[];
  /** Sum of `lines[].requestedUnits` — cached for headers. */
  totalRequestedUnits: number;
  /** Sum of `lines[].approvedUnits` (treats undefined as 0) — cached. */
  totalApprovedUnits: number;
  status: AdhocRequestStatus;
  /** Hub-side response metadata, set when status moves off 'pending'. */
  hubResponse?: {
    respondedAtISO: string;
    respondedBy?: string;
    notes?: string;
  };
};

/**
 * One pending request so the demo opens with the loop populated:
 * Clapham Junction had a busy lunch and needs another 6 croissants +
 * 4 egg-mayo sandwiches for tomorrow's drop. Hub sees it on dispatch.
 */
export const PRET_ADHOC_REQUEST_SEEDS: AdhocRequest[] = [
  {
    id: 'adhoc-seed-clapham-tomorrow',
    spokeId: 'site-spoke-south',
    hubId: 'hub-central',
    forDate: dayOffset(1),
    submittedAtISO: `${DEMO_TODAY}T13:42:00Z`,
    submittedBy: 'Spoke manager (demo)',
    reason: 'unexpected-demand',
    notes: 'Lunch trade was 30% up — looks like the new office across the road is busier than expected.',
    lines: [
      {
        id: 'adhoc-seed-line-1',
        skuId: 'sku-croissant',
        recipeId: 'prec-croissant',
        requestedUnits: 6,
        lineStatus: 'pending',
      },
      {
        id: 'adhoc-seed-line-2',
        skuId: 'sku-egg-mayo-sandwich',
        recipeId: 'prec-egg-mayo-sandwich',
        requestedUnits: 4,
        lineStatus: 'pending',
      },
    ],
    totalRequestedUnits: 10,
    totalApprovedUnits: 0,
    status: 'pending',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Spoke urgent remake requests (PAC-remake)
// ─────────────────────────────────────────────────────────────────────────────
// Critical-incident loop, distinct from rejects + ad-hoc:
//  - Spoke receives a drop, discovers the WHOLE shipment is unsafe (e.g.
//    the cold chain broke and the temperature exceeded 5°C in transit).
//  - The spoke submits an urgent remake request against the source
//    transfer. Every line + qty from that transfer is duplicated as the
//    remake spec — they're not picking, the whole drop has to be remade.
//  - The hub manager sees a high-priority banner at the top of dispatch.
//    They either ACCEPT (committing to a specific delivery slot — next
//    available production run) or DECLINE with a reason (e.g. ingredient
//    shortage means same-day remake isn't possible).
//  - Once accepted, the slot shows on the spoke side so the spoke knows
//    when to expect the make-up shipment. The original transfer flips to
//    a "remade-by" reference for the audit trail.
// ─────────────────────────────────────────────────────────────────────────────

export type RemakeRequestId = string;

export type RemakeReason =
  | 'temperature-breach'
  | 'contamination'
  | 'allergen-cross-contact'
  | 'vehicle-failure'
  | 'packaging-failure'
  | 'other';

export const REMAKE_REASON_LABEL: Record<RemakeReason, string> = {
  'temperature-breach':     'Temperature breach (>5°C)',
  'contamination':          'Contamination',
  'allergen-cross-contact': 'Allergen cross-contact',
  'vehicle-failure':        'Vehicle failure / late arrival',
  'packaging-failure':      'Packaging compromised',
  'other':                  'Other critical issue',
};

export type RemakeStatus =
  | 'pending'        // spoke submitted, hub hasn't responded
  | 'accepted'       // hub has committed to a delivery slot
  | 'declined'       // hub can't fulfil
  | 'in-production'  // hub manager started the remake batches
  | 'dispatched';    // remake transfer sent — closes the loop

export type RemakeDeliverySlot = {
  /** ISO datetime the hub commits to. */
  proposedISO: string;
  /** Plain-English label e.g. "Today 14:00 run". */
  label: string;
};

export type RemakeRequestLine = {
  skuId: SkuId;
  recipeId: RecipeId;
  /** Units copied from the source transfer line. */
  units: number;
};

export type RemakeEvidence = {
  /** Highest temperature reading observed on the load. */
  temperatureC?: number;
  /** Time the load was held above safe temperature (minutes). */
  holdTimeMinutes?: number;
  /** Free-text additional context (mandatory). */
  notes: string;
};

export type RemakeRequest = {
  id: RemakeRequestId;
  spokeId: SiteId;
  hubId: SiteId;
  /** The dispatch transfer that arrived bad. */
  sourceTransferId: string;
  /** When that transfer was originally for. */
  sourceTransferDate: string;
  submittedAtISO: string;
  submittedBy?: string;
  reason: RemakeReason;
  evidence: RemakeEvidence;
  /** Lines + qty mirrored from the source transfer. */
  lines: RemakeRequestLine[];
  totalUnits: number;
  status: RemakeStatus;
  /** Hub-side response — populated when status leaves 'pending'. */
  hubResponse?: {
    respondedAtISO: string;
    respondedBy?: string;
    notes?: string;
    /** Set when accepted — the delivery slot the hub commits to. */
    slot?: RemakeDeliverySlot;
    /** Set when declined — reason for the decline. */
    declineReason?: string;
  };
  /** When dispatched, the new transfer that fulfilled the remake. */
  fulfilmentTransferId?: string;
};

/**
 * One pending remake to demo the critical-incident loop:
 * Clapham Junction received yesterday's drop and the cold-chain logger
 * showed the load held at 8.5°C for 47 minutes (vehicle compressor
 * failure). The whole shipment is unsafe and a full remake is needed.
 */
export const PRET_REMAKE_REQUEST_SEEDS: RemakeRequest[] = [
  {
    id: 'remake-seed-clapham-yesterday',
    spokeId: 'site-spoke-south',
    hubId: 'hub-central',
    sourceTransferId: 'transfer-seed-clapham-yesterday',
    sourceTransferDate: dayOffset(-1),
    submittedAtISO: `${DEMO_TODAY}T07:42:00Z`,
    submittedBy: 'Spoke manager (demo)',
    reason: 'temperature-breach',
    evidence: {
      temperatureC: 8.5,
      holdTimeMinutes: 47,
      notes: 'Refrigeration unit on the van failed between drop 2 and our delivery. Driver flagged it on arrival; cold-chain logger confirmed 47 mins above 5°C. Stock cannot be sold.',
    },
    lines: [
      { skuId: 'sku-croissant',           recipeId: 'prec-croissant',           units: 18 },
      { skuId: 'sku-pain-au-choc',        recipeId: 'prec-pain-au-chocolat',    units: 12 },
      { skuId: 'sku-egg-mayo-sandwich',   recipeId: 'prec-egg-mayo-sandwich',   units: 14 },
      { skuId: 'sku-club-sandwich',       recipeId: 'prec-club-sandwich',       units: 10 },
      { skuId: 'sku-tuna-sandwich',       recipeId: 'prec-tuna-sandwich',       units: 8  },
      { skuId: 'sku-chicken-mayo-filling',recipeId: 'prec-chicken-mayo-filling',units: 2  },
    ],
    totalUnits: 64,
    status: 'pending',
  },
];

// ─── Lookups ────────────────────────────────────────────────────────────────

/**
 * Convenience seed-only lookup: returns the dispatch transfer recorded in
 * fixtures (NOT including any in-flight transfers from the runtime store).
 * UI consumers should also overlay store transfers via `useDispatchTransfers`
 * so a freshly-sent shipment becomes log-against-able immediately.
 */
export function dispatchTransferSeed(
  hubId: SiteId,
  spokeId: SiteId,
  forDate: string,
): DispatchTransfer | undefined {
  return PRET_DISPATCH_TRANSFER_SEEDS.find(
    t => t.hubId === hubId && t.spokeId === spokeId && t.forDate === forDate,
  );
}

/** Most-recent dispatch transfer (seeded) the spoke could log rejects against. */
export function lastDispatchToSpoke(
  hubId: SiteId,
  spokeId: SiteId,
): DispatchTransfer | undefined {
  return [...PRET_DISPATCH_TRANSFER_SEEDS]
    .filter(t => t.hubId === hubId && t.spokeId === spokeId)
    .sort((a, b) => (a.forDate < b.forDate ? 1 : -1))[0];
}

/** All seeded rejects for a given hub (for the IncomingRejectsStrip). */
export function rejectSeedsForHub(hubId: SiteId): SpokeReject[] {
  return PRET_SPOKE_REJECT_SEEDS.filter(r => r.hubId === hubId);
}

/** All seeded rejects this spoke recorded (for the spoke history list). */
export function rejectSeedsForSpoke(spokeId: SiteId): SpokeReject[] {
  return PRET_SPOKE_REJECT_SEEDS.filter(r => r.spokeId === spokeId);
}

/**
 * Compute the unrolled reject units for a (hub, spoke, sku) combo. Used by
 * the dispatch matrix + amounts feed-through to add a "+N (rejects)" floor
 * to the next dispatch demand. Walks BOTH the seeded rejects and any
 * runtime store-created records (passed in by the caller — fixtures.ts has
 * no view of React state).
 */
export function unrolledRejectUnits(
  rejects: SpokeReject[],
  hubId: SiteId,
  spokeId: SiteId,
  skuId: SkuId,
): number {
  let total = 0;
  for (const r of rejects) {
    if (r.hubId !== hubId || r.spokeId !== spokeId || r.rolledIntoNext) continue;
    for (const ln of r.lines) {
      if (ln.skuId === skuId) total += ln.rejectedUnits;
    }
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings health — stale / unused / suspect cards
// ─────────────────────────────────────────────────────────────────────────────

export type SettingsHealthStatus = 'stale' | 'unused' | 'suspect';

export type SettingsHealthItem = {
  id: string;
  status: SettingsHealthStatus;
  /** Surface in which this setting lives. */
  surface: 'batch-rules' | 'selection-tags' | 'cutoffs' | 'bench-capabilities' | 'ranges';
  /** Scope — estate, format, or site. */
  scope: { kind: 'estate' | 'format' | 'site'; id: string };
  title: string;
  body: string;
  /** One-tap remediations. */
  remediations: Array<{ id: string; label: string; kind: 'archive' | 'refresh' | 'edit' | 'ask-quinn' }>;
  /** Approximate dollar/unit impact if available. */
  impactSummary?: string;
};

export const PRET_SETTINGS_HEALTH: SettingsHealthItem[] = [
  {
    id: 'sh-1',
    status: 'stale',
    surface: 'batch-rules',
    scope: { kind: 'site', id: 'site-standalone-north' },
    title: 'Cookie batch rules not reviewed in 180 days',
    body: 'Recipe says max 8 but the oven at Islington North takes 12 comfortably. Likely a tuning opportunity.',
    remediations: [
      { id: 'r1', label: 'Refresh to 12', kind: 'refresh' },
      { id: 'r2', label: 'Ask Quinn to propose', kind: 'ask-quinn' },
    ],
    impactSummary: '~50 extra cookies/day if lifted.',
  },
  {
    id: 'sh-2',
    status: 'unused',
    surface: 'selection-tags',
    scope: { kind: 'site', id: 'site-standalone-north' },
    title: 'Selection tag “closing” unused for 45 days',
    body: 'No scheduled runs have been tagged closing at Islington North in the last 45 days. Tag may be redundant here.',
    remediations: [
      { id: 'r1', label: 'Archive tag', kind: 'archive' },
      { id: 'r2', label: 'Edit rules', kind: 'edit' },
    ],
  },
  {
    id: 'sh-3',
    status: 'suspect',
    surface: 'cutoffs',
    scope: { kind: 'site', id: 'site-spoke-south' },
    title: 'Spoke cutoff drifting',
    body: 'Cutoff is 15:00 but 62% of the last 20 submissions landed between 15:05 and 15:45.',
    remediations: [
      { id: 'r1', label: 'Move cutoff to 15:30', kind: 'edit' },
      { id: 'r2', label: 'Ask Quinn', kind: 'ask-quinn' },
    ],
    impactSummary: '12 late acknowledgements/month.',
  },
  {
    id: 'sh-4',
    status: 'unused',
    surface: 'bench-capabilities',
    scope: { kind: 'site', id: 'site-standalone-north' },
    title: 'Proofing capability never used on prep bench',
    body: 'bench-north-prep is tagged proofing but no scheduled stage has used that capability in 90 days.',
    remediations: [
      { id: 'r1', label: 'Remove capability', kind: 'edit' },
    ],
  },
  {
    id: 'sh-5',
    status: 'unused',
    surface: 'ranges',
    scope: { kind: 'estate', id: 'estate-pret' },
    title: 'Range “range-airport-commuter” used by 1 site',
    body: 'Only Heathrow T5 uses this range. Fine if intentional — flagged to confirm.',
    remediations: [
      { id: 'r1', label: 'Leave as-is', kind: 'archive' },
      { id: 'r2', label: 'Edit range', kind: 'edit' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Quinn setup interview — "opening a new site" scenario
// ─────────────────────────────────────────────────────────────────────────────

export type InterviewStepKind = 'single-select' | 'multi-select' | 'confirm-summary' | 'numeric';

export type InterviewStep = {
  id: string;
  kind: InterviewStepKind;
  prompt: string;
  /** For single/multi select. */
  options?: { id: string; label: string; detail?: string }[];
  /** Pre-selected option (Quinn's draft). */
  defaultOptionIds?: string[];
  /** For numeric steps. */
  numericDefault?: number;
  /** Help text shown below the prompt. */
  hint?: string;
};

export type SetupInterviewScenario = {
  id: string;
  title: string;
  subtitle: string;
  steps: InterviewStep[];
  /** Content of the final summary card; populated at runtime from step answers. */
  summaryTemplate: string;
};

export const PRET_QUINN_SETUP_INTERVIEW: SetupInterviewScenario = {
  id: 'setup-opening-new-site',
  title: 'Opening a new site',
  subtitle: 'I’ll ask a few questions and draft the production setup. You can tweak at the end.',
  steps: [
    {
      id: 'q-site-type',
      kind: 'single-select',
      prompt: 'What kind of site is this?',
      options: [
        { id: 'STANDALONE', label: 'Standalone', detail: 'Self-producing, no hub' },
        { id: 'HUB',        label: 'Hub',        detail: 'Produces for other sites' },
        { id: 'SPOKE',      label: 'Spoke',      detail: 'Receives from a hub' },
        { id: 'HYBRID',     label: 'Hybrid',     detail: 'Produces + receives' },
      ],
      defaultOptionIds: ['SPOKE'],
      hint: 'Most new sites in Pret’s estate this year are spokes.',
    },
    {
      id: 'q-format',
      kind: 'single-select',
      prompt: 'Which format is closest?',
      options: [
        { id: 'format-corner',  label: 'Corner shop',        detail: '06:00–22:00, standard run' },
        { id: 'format-airport', label: 'Airport concourse',  detail: '04:30–23:00, longer increment runs' },
      ],
      defaultOptionIds: ['format-corner'],
    },
    {
      id: 'q-hub',
      kind: 'single-select',
      prompt: 'Which hub will supply this site?',
      options: [
        { id: 'hub-central', label: 'London Central', detail: '4 benches, weekday tier' },
      ],
      defaultOptionIds: ['hub-central'],
      hint: 'Only hub in range right now.',
    },
    {
      id: 'q-tier',
      kind: 'single-select',
      prompt: 'Default tier for Mon–Sat?',
      options: [
        { id: 'tier-weekday', label: 'Weekday', detail: 'range-core' },
        { id: 'tier-weekend', label: 'Weekend', detail: 'range-core + range-brunch' },
      ],
      defaultOptionIds: ['tier-weekday'],
    },
    {
      id: 'q-cutoff',
      kind: 'numeric',
      prompt: 'Cutoff time for hub submissions (24h)?',
      numericDefault: 15,
      hint: 'Estate default is 15:00 — the hub will expect submissions before this.',
    },
    {
      id: 'q-summary',
      kind: 'confirm-summary',
      prompt: 'Ready to save?',
    },
  ],
  summaryTemplate:
    'Creating SPOKE site on corner format, supplied by London Central, tier-weekday Mon–Sat, tier-weekend Sun, cutoff 15:00. 1 front counter bench. No production items yet — Quinn will propose the first plan once 14 days of sales land.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Users (Role model)
// ─────────────────────────────────────────────────────────────────────────────

export type User = {
  id: UserId;
  name: string;
  role: Role;
  /** Primary site assignment. */
  siteId?: SiteId;
};

export const PRET_USERS: User[] = [
  { id: 'user-manager-central', name: 'Priya — Manager, London Central', role: 'Manager', siteId: 'hub-central' },
  { id: 'user-staff-central',   name: 'Dev — Staff, London Central',    role: 'Staff',   siteId: 'hub-central' },
  { id: 'user-staff-central-2', name: 'Sara — Staff, London Central',   role: 'Staff',   siteId: 'hub-central' },
  { id: 'user-staff-central-3', name: 'Marco — Staff, London Central',  role: 'Staff',   siteId: 'hub-central' },
  { id: 'user-staff-central-4', name: 'Ade — Staff, London Central',    role: 'Staff',   siteId: 'hub-central' },
  { id: 'user-manager-south',   name: 'Nia — Manager, Clapham Junction', role: 'Manager', siteId: 'site-spoke-south' },
  { id: 'user-manager-north',   name: 'Jules — Manager, Islington North', role: 'Manager', siteId: 'site-standalone-north' },
  { id: 'user-staff-airport',   name: 'Rae — Staff, Heathrow T5',        role: 'Staff',   siteId: 'site-hybrid-airport' },
];

/** Convenience: the "current user" for demo. Defaults to Central's manager. */
export const DEMO_CURRENT_USER_ID: UserId = 'user-manager-central';

// ─────────────────────────────────────────────────────────────────────────────
// Convenience lookups
// ─────────────────────────────────────────────────────────────────────────────

export function getSite(id: SiteId): Site | undefined {
  return PRET_SITES.find(s => s.id === id);
}

export function getBench(id: BenchId): Bench | undefined {
  return PRET_BENCHES.find(b => b.id === id);
}

export function getRecipe(id: RecipeId): ProductionRecipe | undefined {
  return PRET_RECIPES.find(r => r.id === id);
}

export function getProductionItem(id: ProductionItemId): ProductionItem | undefined {
  return PRET_PRODUCTION_ITEMS.find(p => p.id === id);
}

export function getWorkflow(id: WorkflowId): ProductionWorkflow | undefined {
  return PRET_WORKFLOWS[id];
}

/**
 * Optional resolver for per-workflow-id stage lookup. The default
 * implementation reads from the static `PRET_WORKFLOWS` fixture; callers
 * (notably the recipe editor) can pass a store-aware resolver so chips
 * reflect in-memory edits made via `recipeStore.updateWorkflow`.
 */
export type WorkflowResolver = (id: WorkflowId) => ProductionWorkflow | undefined;

/** Static fallback — reads PRET_WORKFLOWS directly. */
const staticWorkflowResolver: WorkflowResolver = (id) => PRET_WORKFLOWS[id];

let activeWorkflowResolver: WorkflowResolver = staticWorkflowResolver;

/**
 * Override the default workflow resolver used by `recipeWorkTypes` /
 * `workTypesFromWorkflows`. The recipe editor's `recipeStore` calls
 * this on module load with a closure over its mutable state, so
 * production-side chip rendering automatically reflects in-memory
 * workflow edits without every caller having to plumb a resolver.
 *
 * Pass `null` to reset to the static `PRET_WORKFLOWS` resolver. Last
 * writer wins; the prototype only ever has one writer (recipeStore).
 */
export function setWorkflowResolver(resolver: WorkflowResolver | null): void {
  activeWorkflowResolver = resolver ?? staticWorkflowResolver;
}

/** Default resolver — defers to whichever resolver is currently active. */
export const defaultWorkflowResolver: WorkflowResolver = (id) => activeWorkflowResolver(id);

/**
 * Lower-level primitive for both ProductionRecipe and library Recipe.
 * Walks the supplied workflow ids + any per-recipe ingredient prep work
 * and returns a deduped, ordered set of work types.
 */
export function workTypesFromWorkflows(input: {
  workflowIds: WorkflowId[];
  /**
   * Effective prep work for every ingredient consumed by this recipe
   * (and its sub-recipes), already resolved by `componentPrepWork`. Pass
   * an empty list when the recipe has no ingredients. The implicit
   * `weigh-up` rule (every recipe with ingredients needs a pre-shift
   * weigh) is applied here so callers don't need to remember it.
   */
  ingredientPrep?: PrepWorkEntry[];
  /** @deprecated use `ingredientPrep` — retained for callers that
   *  haven't been migrated yet. When `true`, contributes a single
   *  `weigh-up` chip and nothing else. */
  hasIngredients?: boolean;
  /** Override for testing / store-aware contexts. */
  workflowResolver?: WorkflowResolver;
}): WorkType[] {
  const resolver = input.workflowResolver ?? defaultWorkflowResolver;
  const set = new Set<WorkType>();
  for (const wfId of input.workflowIds) {
    const wf = resolver(wfId);
    if (!wf) continue;
    for (const stage of wf.stages) set.add(stageWorkType(stage));
  }
  const prep = input.ingredientPrep ?? [];
  if (prep.length > 0) {
    set.add('weigh-up');
    for (const entry of prep) set.add(entry.workType);
  } else if (input.hasIngredients) {
    set.add('weigh-up');
  }
  return WORK_TYPE_ORDER.filter(w => set.has(w));
}

/**
 * The unique set of work types a recipe touches across the full chain
 * of work that produces it. Walks:
 *   1. The recipe's own workflow stages
 *   2. All sub-recipes' workflow stages (one level — sub-recipes are
 *      already flattened in `subRecipes`, no need to recurse further
 *      for the prototype's depth)
 *   3. Every consumed ingredient's effective prep work — master
 *      `Ingredient.defaultPrepWork` unless the per-recipe
 *      `IngredientUsage.prepWorkOverride` is set.
 *   4. An implicit `weigh-up` if the recipe (or any of its sub-recipes)
 *      has any ingredients — every recipe with ingredients needs a
 *      pre-shift weigh
 *
 * Returned in `WORK_TYPE_ORDER` so chip rendering is deterministic.
 *
 * Pass `workflowResolver` from a context that has the latest workflow
 * edits (e.g. the recipe editor) so chips refresh as stages change.
 */
export function recipeWorkTypes(
  recipe: ProductionRecipe,
  opts?: { workflowResolver?: WorkflowResolver },
): WorkType[] {
  const subRecipeIds = (recipe.subRecipes ?? []).map(s => s.recipeId);
  const resolver = opts?.workflowResolver ?? defaultWorkflowResolver;
  const subWorkflows = subRecipeIds
    .map(id => PRET_RECIPES.find(r => r.id === id)?.workflowId)
    .filter((w): w is WorkflowId => !!w);
  const recipeIds = [recipe.id, ...subRecipeIds];
  const usages = PRET_INGREDIENT_USAGE.filter(u => recipeIds.includes(u.recipeId));
  const ingredientPrep: PrepWorkEntry[] = usages.flatMap((u) =>
    componentPrepWork(u.prepWorkOverride, getIngredient(u.ingredientId)),
  );
  return workTypesFromWorkflows({
    workflowIds: [recipe.workflowId, ...subWorkflows],
    ingredientPrep: usages.length > 0 ? ingredientPrep : [],
    hasIngredients: usages.length > 0,
    workflowResolver: resolver,
  });
}

/**
 * Walk the same ingredient-prep set used by `recipeWorkTypes`, but
 * return the per-ingredient breakdown so callers (e.g. the Run sheet
 * aggregator) can group by `(ingredientId, workType, leadOffset)`
 * across multiple recipes.
 */
export type RecipeIngredientPrep = {
  ingredientId: IngredientId;
  ingredient: Ingredient | undefined;
  /** The recipe id contributing this prep entry — needed by the Run
   *  sheet so it can show "for: Club +5, BLT +7" on each aggregated row. */
  sourceRecipeId: RecipeId;
  /** Per-unit consumption from `IngredientUsage` — multiplied by the
   *  recipe's planned quantity for the day to get the aggregated total. */
  quantityPerUnit: number;
  unit: 'g' | 'ml' | 'unit';
  prep: PrepWorkEntry;
};

export function recipeIngredientPrep(recipe: ProductionRecipe): RecipeIngredientPrep[] {
  const subRecipeIds = (recipe.subRecipes ?? []).map(s => s.recipeId);
  const recipeIds = [recipe.id, ...subRecipeIds];
  const out: RecipeIngredientPrep[] = [];
  for (const usage of PRET_INGREDIENT_USAGE) {
    if (!recipeIds.includes(usage.recipeId)) continue;
    const ingredient = getIngredient(usage.ingredientId);
    const effective = componentPrepWork(usage.prepWorkOverride, ingredient);
    for (const entry of effective) {
      out.push({
        ingredientId: usage.ingredientId,
        ingredient,
        sourceRecipeId: usage.recipeId,
        quantityPerUnit: usage.quantityPerUnit,
        unit: usage.unit,
        prep: entry,
      });
    }
  }
  return out;
}

export function getUser(id: UserId): User | undefined {
  return PRET_USERS.find(u => u.id === id);
}

export function benchesAt(siteId: SiteId): Bench[] {
  return PRET_BENCHES.filter(b => b.siteId === siteId);
}

export function productionItemsAt(siteId: SiteId): ProductionItem[] {
  return PRET_PRODUCTION_ITEMS.filter(p => p.siteId === siteId);
}

export function tierForSiteOnDate(siteId: SiteId, iso: string): Tier | undefined {
  const dow = dayOfWeek(iso);
  const assignment = PRET_SITE_TIER_ASSIGNMENTS.find(a => a.siteId === siteId);
  if (!assignment) return undefined;
  return PRET_TIERS.find(t => t.id === assignment.byDayOfWeek[dow]);
}

/** Forecast lookup for (site, sku, date). */
/**
 * Day-of-week multiplier applied to today's forecast when projecting future
 * (or past) days. Eyeballed to a Pret-style trade pattern: midweek peak,
 * Sunday softer. Manager-confirmed forecasts in `PRET_FORECAST` always win
 * over this projection.
 */
export const DOW_MULTIPLIER: Record<DayOfWeek, number> = {
  Mon: 0.95,
  Tue: 1.00,
  Wed: 1.05,
  Thu: 1.05,
  Fri: 1.10,
  Sat: 0.85,
  Sun: 0.65,
};

export function forecastFor(
  siteId: SiteId,
  skuId: SkuId,
  date: string,
): DemandForecastEntry | undefined {
  const exact = PRET_FORECAST.find(f => f.siteId === siteId && f.skuId === skuId && f.date === date);
  if (exact) return exact;

  // Same-site anchor — synthesise from today's hand-authored forecast for
  // the same SKU at the same site, scaled by the day-of-week multiplier.
  const sameSiteAnchor = PRET_FORECAST.find(f => f.siteId === siteId && f.skuId === skuId && f.date === DEMO_TODAY);
  if (sameSiteAnchor) return projectAnchor(sameSiteAnchor, siteId, date);

  // Hub-linked fallback — sites that pull from a hub (regular spokes and
  // linked standalones / dark kitchens, PAC139) don't carry their own
  // per-SKU forecast in fixtures. Recurse into the hub for a date-projected
  // number, then scale by the site's sales factor so the spoke order page
  // can show a forecast for the full hub recipe range without us having to
  // hand-author every fixture row.
  const site = getSite(siteId);
  const isHubLinked =
    !!site?.hubId &&
    (site.type === 'SPOKE' ||
      site.type === 'HYBRID' ||
      (site.type === 'STANDALONE' && site.linkType === 'linked'));
  if (site && isHubLinked) {
    const hubProjected = forecastFor(site.hubId!, skuId, date);
    if (!hubProjected) return undefined;
    const factor = site.salesFactor ?? 0.4;
    const scale = (n: number) => Math.max(0, Math.round(n * factor));
    const linkLabel =
      site.type === 'STANDALONE' ? 'Linked standalone' : site.type === 'HYBRID' ? 'Hybrid' : 'Spoke';
    return {
      ...hubProjected,
      siteId,
      projectedUnits: scale(hubProjected.projectedUnits),
      byPhase: hubProjected.byPhase
        ? {
            morning:   scale(hubProjected.byPhase.morning),
            midday:    scale(hubProjected.byPhase.midday),
            afternoon: scale(hubProjected.byPhase.afternoon),
          }
        : undefined,
      signals: [
        ...hubProjected.signals,
        {
          signal: 'sales-history',
          weight: 1,
          note: `${linkLabel} factor ${factor.toFixed(2)} × ${getSite(site.hubId!)?.name ?? 'hub'} forecast`,
        },
      ],
      status: 'draft',
    };
  }

  return undefined;
}

function projectAnchor(
  anchor: DemandForecastEntry,
  siteId: SiteId,
  date: string,
): DemandForecastEntry {
  if (date === DEMO_TODAY) return { ...anchor, siteId, date };
  const multiplier = DOW_MULTIPLIER[dayOfWeek(date)] / DOW_MULTIPLIER[dayOfWeek(DEMO_TODAY)];
  const scale = (n: number) => Math.max(0, Math.round(n * multiplier));
  return {
    siteId,
    skuId: anchor.skuId,
    date,
    projectedUnits: scale(anchor.projectedUnits),
    byPhase: anchor.byPhase
      ? {
          morning: scale(anchor.byPhase.morning),
          midday: scale(anchor.byPhase.midday),
          afternoon: scale(anchor.byPhase.afternoon),
        }
      : undefined,
    signals: [
      {
        signal: 'sales-history',
        weight: 1,
        note: `Projected from ${dayOfWeek(DEMO_TODAY)} ${DEMO_TODAY} × ${dayOfWeek(date)} factor (${multiplier.toFixed(2)}×)`,
      },
    ],
    status: 'draft',
  };
}

/** Carry-over lookup (most recent entry for site/sku). */
export function carryOverFor(siteId: SiteId, skuId: SkuId): CarryOverEntry | undefined {
  return PRET_CARRY_OVER.find(c => c.siteId === siteId && c.skuId === skuId);
}

/** Pick the primary bench for a production item based on workflow's final stage. */
export function primaryBenchForItem(item: ProductionItem): Bench | undefined {
  const siteBenches = benchesAt(item.siteId);
  // Explicit override wins: used for intentional off-mode work (EOD prep on
  // a run bench) and for routing grill/hot-component work onto a dedicated
  // bench even though its capability is generic 'prep'.
  if (item.preferredBenchId) {
    const pinned = siteBenches.find(b => b.id === item.preferredBenchId);
    if (pinned) return pinned;
  }
  const recipe = getRecipe(item.recipeId);
  if (!recipe) return undefined;
  const wf = getWorkflow(recipe.workflowId);
  if (!wf || wf.stages.length === 0) return undefined;
  const finalStage = wf.stages[wf.stages.length - 1];
  const candidates = siteBenches.filter(b =>
    b.capabilities.includes(finalStage.capability),
  );
  if (candidates.length === 0) return undefined;
  // Prefer a bench whose configured primaryMode matches the item's mode.
  // If none match (e.g. tail prep work landing on a run-mode oven bench),
  // fall back to the first capable bench so the work still renders, and the
  // card will show it in the "After service" tail.
  const modeMatch = candidates.find(b => b.primaryMode === item.mode);
  return modeMatch ?? candidates[0];
}

/** All benches a production item touches across its workflow stages. */
export function benchesForItem(item: ProductionItem): Bench[] {
  const recipe = getRecipe(item.recipeId);
  if (!recipe) return [];
  const wf = getWorkflow(recipe.workflowId);
  if (!wf) return [];
  const siteBenches = benchesAt(item.siteId);
  const seen = new Set<BenchId>();
  const out: Bench[] = [];
  for (const stage of wf.stages) {
    const bench = siteBenches.find(b => b.capabilities.includes(stage.capability));
    if (bench && !seen.has(bench.id)) {
      seen.add(bench.id);
      out.push(bench);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan amounts — derive Quinn's suggested qty per SKU from forecast + carry-over
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-spoke breakdown of how many units this hub owes a single spoke on the
 * planned date. `units` uses the spoke's `confirmedUnits` when set, otherwise
 * Quinn's proposed number — the same "effective" rule the dispatch matrix uses.
 */
export type DispatchDemandLine = {
  spokeId: SiteId;
  spokeName: string;
  units: number;
  /** True when the spoke hasn't confirmed yet — number is still Quinn-proposed. */
  isQuinn: boolean;
  status: SpokeSubmission['status'];
};

// ─────────────────────────────────────────────────────────────────────────────
// Ingredient stock — F3 + PAC045
//
// A first-pass inventory model: raw ingredients (flour, butter, eggs, …) +
// per-recipe consumption + per-site stock-on-hand snapshot. Lets the plan
// surface a "stock cap" — the max units of each base recipe producible
// from current ingredient stock — and flag the binding ingredient when
// Quinn's forecast-driven proposal exceeds it.
//
// Scope: applies to BASE recipes (no subRecipes). Assemblies inherit the
// constraint via the existing assembly-demand cascade — if ciabatta caps
// at 30 loaves, club sandwich automatically shows the cascade shortfall.
// ─────────────────────────────────────────────────────────────────────────────

export type IngredientId = string;

export type IngredientCategory =
  | 'flour'
  | 'dairy'
  | 'protein'
  | 'produce'
  | 'pantry'
  | 'packaging';

/**
 * A single piece of authored prep work — either at the ingredient master
 * level (`Ingredient.defaultPrepWork`) or per-recipe override
 * (`ItemComponent.prepWorkOverride`). Each entry binds a `WorkType` to an
 * optional `leadOffset` so authors can mark "weigh up the day before" /
 * "thaw two days before" at the ingredient level — not just the stage
 * level. Default leadOffset is `0` (same day as consumption) when
 * omitted.
 */
export type PrepWorkEntry = {
  workType: WorkType;
  /** Days before consumption this prep happens. -2/-1/0; default 0. */
  leadOffset?: -2 | -1 | 0;
};

export type Ingredient = {
  id: IngredientId;
  name: string;
  /** Canonical unit for stock-on-hand and per-unit consumption. */
  canonicalUnit: 'g' | 'ml' | 'unit';
  category: IngredientCategory;
  /**
   * Master-level prep work this ingredient typically requires before it
   * can be consumed by a recipe. e.g. `tomato → [sanitise, slice]`.
   * Inherited by every recipe that uses this ingredient unless the
   * per-recipe component row sets `prepWorkOverride`. Empty/undefined
   * means "no implicit prep — already shelf-stable / ready-to-use".
   */
  defaultPrepWork?: PrepWorkEntry[];
};

export const PRET_INGREDIENTS: Ingredient[] = [
  { id: 'ing-flour',       name: 'Strong white flour',  canonicalUnit: 'g',    category: 'flour'   },
  { id: 'ing-butter',      name: 'Cultured butter',     canonicalUnit: 'g',    category: 'dairy'   },
  { id: 'ing-egg',         name: 'Free-range eggs',     canonicalUnit: 'unit', category: 'protein' },
  { id: 'ing-mayo',        name: 'Mayonnaise',          canonicalUnit: 'g',    category: 'pantry'  },
  { id: 'ing-tuna',        name: 'Tuna (skipjack)',     canonicalUnit: 'g',    category: 'protein' },
  // Roast chicken: master defaults the weigh-up to the day before so
  // mises bake the schedule into "do this tonight, not tomorrow morning".
  // Every recipe that uses chicken inherits this unless it overrides.
  {
    id: 'ing-chicken',
    name: 'Roast chicken',
    canonicalUnit: 'g',
    category: 'protein',
    defaultPrepWork: [{ workType: 'weigh-up', leadOffset: -1 }],
  },
  { id: 'ing-chocolate',   name: 'Dark chocolate batons', canonicalUnit: 'g',  category: 'pantry'  },
  { id: 'ing-cocoa-powder', name: 'Cocoa powder',       canonicalUnit: 'g',    category: 'pantry'  },
  // Tomato — the canonical "ingredient prep" demo. Master defaults to
  // sanitise + slice so every sandwich/salad that uses tomato gets the
  // two prep chips automatically. The Run sheet aggregates the sliced
  // tomatoes across all recipes onto a single "Slice tomatoes" row.
  {
    id: 'ing-tomato',
    name: 'Vine tomatoes',
    canonicalUnit: 'unit',
    category: 'produce',
    defaultPrepWork: [
      { workType: 'sanitise' },
      { workType: 'slice' },
    ],
  },
];

export type IngredientUsage = {
  recipeId: RecipeId;
  ingredientId: IngredientId;
  /** Quantity of the ingredient consumed per ONE produced unit of the recipe. */
  quantityPerUnit: number;
  /** Unit (must match the ingredient's canonicalUnit). */
  unit: 'g' | 'ml' | 'unit';
  /**
   * Per-recipe prep-work override. When set, REPLACES the master
   * `Ingredient.defaultPrepWork` for this specific recipe — useful when
   * one recipe needs the ingredient prepared differently (e.g. tomato
   * sliced for a sandwich vs diced for a salad). When undefined the
   * ingredient inherits its master defaults.
   */
  prepWorkOverride?: PrepWorkEntry[];
};

/**
 * Resolve the effective prep work for an ingredient on a given recipe —
 * the per-recipe override wins if non-empty, otherwise the ingredient's
 * master defaults. Returns an empty array if neither is set (treated as
 * "no implicit prep needed"). Used by `recipeWorkTypes` to walk
 * ingredient prep into a recipe's chips and by the Run sheet to drive
 * cross-recipe aggregation.
 *
 * Note: `getIngredient` itself is defined further down with the other
 * lookup helpers; we reference it from `recipeWorkTypes` /
 * `recipeIngredientPrep` below by name (function declaration is hoisted
 * within the module).
 */
export function componentPrepWork(
  override: PrepWorkEntry[] | undefined,
  ingredient: Ingredient | undefined,
): PrepWorkEntry[] {
  if (override && override.length > 0) return override;
  return ingredient?.defaultPrepWork ?? [];
}

/**
 * Per-recipe ingredient consumption. Defined for base (non-assembly) recipes
 * only. Assemblies' constraints flow through their sub-recipes via the
 * existing assembly-demand cascade in PlanStore.resolvePlan.
 */
export const PRET_INGREDIENT_USAGE: IngredientUsage[] = [
  // Bakery — viennoiserie use a lot of butter, which is the demo bottleneck.
  { recipeId: 'prec-croissant',         ingredientId: 'ing-flour',  quantityPerUnit: 60, unit: 'g' },
  { recipeId: 'prec-croissant',         ingredientId: 'ing-butter', quantityPerUnit: 35, unit: 'g' },
  { recipeId: 'prec-pain-au-chocolat',  ingredientId: 'ing-flour',  quantityPerUnit: 60, unit: 'g' },
  { recipeId: 'prec-pain-au-chocolat',  ingredientId: 'ing-butter', quantityPerUnit: 35, unit: 'g' },
  { recipeId: 'prec-pain-au-chocolat',  ingredientId: 'ing-chocolate', quantityPerUnit: 12, unit: 'g' },
  { recipeId: 'prec-almond-croissant',  ingredientId: 'ing-flour',  quantityPerUnit: 60, unit: 'g' },
  { recipeId: 'prec-almond-croissant',  ingredientId: 'ing-butter', quantityPerUnit: 40, unit: 'g' },
  // Loaves — flour-heavy, no butter so they don't compete.
  { recipeId: 'prec-baguette',          ingredientId: 'ing-flour',  quantityPerUnit: 250, unit: 'g' },
  { recipeId: 'prec-granary',           ingredientId: 'ing-flour',  quantityPerUnit: 350, unit: 'g' },
  { recipeId: 'prec-ciabatta',          ingredientId: 'ing-flour',  quantityPerUnit: 220, unit: 'g' },
  // Cookies — chocolate + cocoa heavy, share butter pool.
  { recipeId: 'prec-cookie',            ingredientId: 'ing-flour',     quantityPerUnit: 35, unit: 'g' },
  { recipeId: 'prec-cookie',            ingredientId: 'ing-butter',    quantityPerUnit: 25, unit: 'g' },
  { recipeId: 'prec-cookie',            ingredientId: 'ing-chocolate', quantityPerUnit: 20, unit: 'g' },
  { recipeId: 'prec-cookie',            ingredientId: 'ing-cocoa-powder', quantityPerUnit: 8, unit: 'g' },
  // Fillings — protein-driven.
  { recipeId: 'prec-egg-mayo-filling',   ingredientId: 'ing-egg',  quantityPerUnit: 28, unit: 'unit' }, // per tray (~4kg)
  { recipeId: 'prec-egg-mayo-filling',   ingredientId: 'ing-mayo', quantityPerUnit: 600, unit: 'g' },
  { recipeId: 'prec-tuna-mayo-filling',  ingredientId: 'ing-tuna', quantityPerUnit: 2400, unit: 'g' },
  { recipeId: 'prec-tuna-mayo-filling',  ingredientId: 'ing-mayo', quantityPerUnit: 800, unit: 'g' },
  { recipeId: 'prec-chicken-mayo-filling', ingredientId: 'ing-chicken', quantityPerUnit: 2800, unit: 'g' },
  { recipeId: 'prec-chicken-mayo-filling', ingredientId: 'ing-mayo',    quantityPerUnit: 600, unit: 'g' },
  // Roasts.
  { recipeId: 'prec-roast-chicken',      ingredientId: 'ing-chicken', quantityPerUnit: 1800, unit: 'g' }, // per tray

  // ─── Tomato (ingredient-prep demo) ─────────────────────────────────────
  // Three sandwiches inherit the master tomato prep (sanitise + slice).
  // The Run sheet aggregates these onto a single "Slice tomatoes" row
  // with the source recipes called out — replacing the three separate
  // entries you'd otherwise see by recipe.
  { recipeId: 'prec-club-sandwich',     ingredientId: 'ing-tomato', quantityPerUnit: 1, unit: 'unit' }, // 1 tomato/sandwich (~5 slices)
  { recipeId: 'prec-tuna-sandwich',     ingredientId: 'ing-tomato', quantityPerUnit: 1, unit: 'unit' },
  { recipeId: 'prec-egg-mayo-sandwich', ingredientId: 'ing-tomato', quantityPerUnit: 1, unit: 'unit' },
  // One salad overrides the master prep — supplier delivers pre-sanitised
  // vine tomatoes already destined for this recipe, so we only wash + slice
  // (no full sanitise step). Demonstrates the per-recipe override beating
  // the master defaults.
  {
    recipeId: 'prec-chicken-caesar',
    ingredientId: 'ing-tomato',
    quantityPerUnit: 2,
    unit: 'unit',
    prepWorkOverride: [
      { workType: 'wash' },
      { workType: 'slice' },
    ],
  },
];

export type IngredientStock = {
  siteId: SiteId;
  ingredientId: IngredientId;
  /** Quantity on hand right now in the ingredient's canonicalUnit. */
  onHand: number;
  /** Last counted/updated timestamp — for stale-stock callouts later. */
  lastUpdatedISO: string;
};

/**
 * Site stock-on-hand. The hub's butter total is intentionally tight: croissant
 * + pain au choc + almond croissant + cookie all draw from the same butter
 * pool, so ramping bakery items quickly hits the cap and Quinn flags it.
 */
export const PRET_INGREDIENT_STOCK: IngredientStock[] = [
  // hub-central
  { siteId: 'hub-central', ingredientId: 'ing-flour',        onHand: 28000, lastUpdatedISO: `${DEMO_TODAY}T05:00:00Z` }, // 28kg
  // 2.2kg butter — intentionally tight. Croissant @ 35g/ea caps at 62 units;
  // hub Quinn proposal for today is 66 (48 own + 18 spoke dispatch), so the
  // stock-cap chip visibly bites on the croissant row from the Today tab.
  { siteId: 'hub-central', ingredientId: 'ing-butter',       onHand:  2200, lastUpdatedISO: `${DEMO_TODAY}T05:00:00Z` },
  { siteId: 'hub-central', ingredientId: 'ing-egg',          onHand:   180, lastUpdatedISO: `${DEMO_TODAY}T05:00:00Z` }, // 180 eggs
  { siteId: 'hub-central', ingredientId: 'ing-mayo',         onHand:  6000, lastUpdatedISO: `${DEMO_TODAY}T05:00:00Z` }, // 6kg
  { siteId: 'hub-central', ingredientId: 'ing-tuna',         onHand:  4800, lastUpdatedISO: `${DEMO_TODAY}T05:00:00Z` }, // 4.8kg (~2 trays worth)
  { siteId: 'hub-central', ingredientId: 'ing-chicken',      onHand:  9000, lastUpdatedISO: `${DEMO_TODAY}T05:00:00Z` }, // 9kg
  { siteId: 'hub-central', ingredientId: 'ing-chocolate',    onHand:  2400, lastUpdatedISO: `${DEMO_TODAY}T05:00:00Z` }, // 2.4kg
  { siteId: 'hub-central', ingredientId: 'ing-cocoa-powder', onHand:   600, lastUpdatedISO: `${DEMO_TODAY}T05:00:00Z` }, // 600g
  // site-standalone-north (own kitchen, smaller scale)
  { siteId: 'site-standalone-north', ingredientId: 'ing-flour',  onHand: 8000, lastUpdatedISO: `${DEMO_TODAY}T05:00:00Z` },
  { siteId: 'site-standalone-north', ingredientId: 'ing-butter', onHand: 1200, lastUpdatedISO: `${DEMO_TODAY}T05:00:00Z` },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sales-vs-forecast bias (demo only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-SKU demand bias used by the sales actuals synthesiser to make some
 * recipes consistently outperform or underperform their forecast. Without
 * this, the noise wobble averages out close to zero across a day and the
 * Sales report reads as "everything on target", which isn't a useful demo.
 *
 * Bias is a multiplier applied on top of the forecast before the per-hour
 * wobble is added. `1.18` = roughly 18% over forecast, `0.78` = ~22%
 * under. SKUs not listed default to 1.0 (forecast bang-on).
 */
export const PRET_SKU_DEMAND_BIAS: Record<SkuId, number> = {
  // Strong overshooters — Quinn should suggest uplifting these
  'sku-croissant':           1.22,
  'sku-almond-croissant':    1.18,
  'sku-cookie':              1.16,
  'sku-flat-white':          1.12,
  // Mild overshooters
  'sku-egg-mayo-sandwich':   1.08,
  'sku-iced-coffee':         1.10,
  // Strong undershooters — Quinn should suggest scaling back
  'sku-tuna-sandwich':       0.78,
  'sku-banana-bread':        0.82,
  'sku-hummus-wrap':         0.84,
  'sku-falafel-bowl':        0.80,
  // Mild undershooters
  'sku-pain-au-choc':        0.92,
  'sku-fruit-pot':           0.91,
};

/** Returns the demand bias for a SKU, defaulting to 1.0 (no bias). */
export function demandBiasFor(skuId: SkuId): number {
  return PRET_SKU_DEMAND_BIAS[skuId] ?? 1.0;
}

export function getIngredient(id: IngredientId): Ingredient | undefined {
  return PRET_INGREDIENTS.find(i => i.id === id);
}

export function ingredientUsageFor(recipeId: RecipeId): IngredientUsage[] {
  return PRET_INGREDIENT_USAGE.filter(u => u.recipeId === recipeId);
}

export function ingredientStockFor(siteId: SiteId, ingredientId: IngredientId): IngredientStock | undefined {
  return PRET_INGREDIENT_STOCK.find(s => s.siteId === siteId && s.ingredientId === ingredientId);
}

/**
 * Return the maximum number of units of `recipeId` that the given site can
 * produce from its current ingredient stock, plus a list of ingredients
 * that are at (or close to) the binding limit.
 *
 * Returns `cap = Infinity` when the recipe has no declared ingredient usage
 * (we can't constrain what we don't model). Returns `cap = 0` when at
 * least one declared ingredient is fully out.
 *
 * Assembly recipes (those with subRecipes) always return Infinity — their
 * constraint flows through the assembly-demand cascade by design, not via
 * a direct ingredient cap.
 */
export type StockCapBinding = {
  ingredientId: IngredientId;
  ingredientName: string;
  /** Stock on hand in the ingredient's canonical unit. */
  onHand: number;
  /** Quantity required per ONE unit of the recipe. */
  perUnit: number;
  /** Units of the recipe this ingredient alone allows (floor). */
  unitsAvailable: number;
  unit: string;
};

export type StockCap = {
  /** Max units producible. Infinity when no usage is declared. */
  cap: number;
  /** All ingredients drawn on, with their per-ingredient cap, ordered ascending. */
  ingredients: StockCapBinding[];
  /** The most-binding ingredient(s) — those at the floor. */
  bindingIngredients: StockCapBinding[];
};

export function maxUnitsFromStock(siteId: SiteId, recipeId: RecipeId): StockCap {
  const recipe = getRecipe(recipeId);
  if (!recipe || (recipe.subRecipes && recipe.subRecipes.length > 0)) {
    return { cap: Infinity, ingredients: [], bindingIngredients: [] };
  }
  const usage = ingredientUsageFor(recipeId);
  if (usage.length === 0) {
    return { cap: Infinity, ingredients: [], bindingIngredients: [] };
  }

  const bindings: StockCapBinding[] = [];
  for (const u of usage) {
    const ing = getIngredient(u.ingredientId);
    if (!ing) continue;
    const stock = ingredientStockFor(siteId, u.ingredientId);
    const onHand = stock?.onHand ?? 0;
    const unitsAvailable = u.quantityPerUnit > 0 ? Math.floor(onHand / u.quantityPerUnit) : Infinity;
    bindings.push({
      ingredientId: u.ingredientId,
      ingredientName: ing.name,
      onHand,
      perUnit: u.quantityPerUnit,
      unitsAvailable,
      unit: u.unit,
    });
  }

  bindings.sort((a, b) => a.unitsAvailable - b.unitsAvailable);
  const cap = bindings.length === 0 ? Infinity : bindings[0].unitsAvailable;
  const bindingIngredients = bindings.filter(b => b.unitsAvailable === cap);
  return { cap, ingredients: bindings, bindingIngredients };
}

// ─────────────────────────────────────────────────────────────────────────────

export type AmountsLine = {
  item: ProductionItem;
  recipe: ProductionRecipe;
  forecast?: DemandForecastEntry;
  carryOver?: CarryOverEntry;
  /** Quinn-proposed quantity after considering forecast, carry-over and dispatch. */
  quinnProposed: number;
  /**
   * Total units this site needs to dispatch to its spokes on `date` for this
   * SKU. Always 0 for spoke sites (or hubs with no submissions for the date).
   * Already factored into `quinnProposed`.
   */
  dispatchDemand: number;
  /**
   * Per-spoke breakdown when `dispatchDemand > 0`. Same order as
   * `submissionsForHub()` returns submissions (typically South / East / West).
   */
  dispatchBySpoke?: DispatchDemandLine[];
  /**
   * F3 + PAC045 — max units producible from current ingredient stock.
   * `undefined` when the recipe has no declared ingredient usage (i.e.
   * we can't constrain it). Assemblies are always undefined here — their
   * constraint flows through the assembly-demand cascade.
   */
  stockCap?: StockCap;
  /** Primary bench (final stage). */
  primaryBench?: Bench;
  /** All benches in workflow order. */
  benches: Bench[];
};

/**
 * Build the ledger of recipes to plan for a given site/date.
 * Returns everything needed to render the Amounts view without further lookups.
 *
 * For HUB sites we additionally fold in spoke dispatch demand for `date`:
 * each SKU's Quinn proposal becomes `max(0, counterSales + dispatch − carry)`,
 * and per-line `dispatchDemand` + `dispatchBySpoke` carry the breakdown so
 * the UI can show "Counter X · Dispatch Y" without re-querying submissions.
 */
export function amountsForSiteOnDate(siteId: SiteId, date: string): AmountsLine[] {
  const items = productionItemsAt(siteId);
  const site = getSite(siteId);
  // Pre-build dispatch demand per SKU for this hub+date so each line is a
  // simple Map lookup rather than a re-scan of all submissions.
  const dispatchBySku = new Map<SkuId, DispatchDemandLine[]>();
  if (site?.type === 'HUB') {
    const subs = submissionsForHub(siteId, date);
    for (const sub of subs) {
      const spoke = getSite(sub.fromSiteId);
      const spokeName = spoke?.name ?? sub.fromSiteId;
      for (const ln of sub.lines) {
        const isQuinn = ln.confirmedUnits === null;
        const units = ln.confirmedUnits ?? ln.quinnProposedUnits;
        if (units <= 0) continue;
        const arr = dispatchBySku.get(ln.skuId) ?? [];
        arr.push({
          spokeId: sub.fromSiteId,
          spokeName,
          units,
          isQuinn,
          status: sub.status,
        });
        dispatchBySku.set(ln.skuId, arr);
      }
    }
  }

  const lines: AmountsLine[] = [];
  for (const item of items) {
    const recipe = getRecipe(item.recipeId);
    if (!recipe) continue;
    const forecast = forecastFor(siteId, item.skuId, date);
    const carryOver = carryOverFor(siteId, item.skuId);
    const counter = forecast?.projectedUnits ?? 0;
    const carried = carryOver ? carryOver.carriedUnits : 0;
    const dispatchLines = dispatchBySku.get(item.skuId);
    const dispatchDemand = dispatchLines
      ? dispatchLines.reduce((a, l) => a + l.units, 0)
      : 0;
    // Quinn proposal: own counter sales + dispatch − carry-over, never < 0.
    const quinnProposed = Math.max(0, counter + dispatchDemand - carried);
    // F3 + PAC045 — cap by ingredient stock when the recipe has declared
    // usage. `undefined` keeps the existing UI behaviour for un-modelled
    // recipes; assemblies are always undefined here on purpose.
    const stockCapResult = maxUnitsFromStock(siteId, item.recipeId);
    const stockCap = stockCapResult.cap === Infinity ? undefined : stockCapResult;
    lines.push({
      item,
      recipe,
      forecast,
      carryOver,
      quinnProposed,
      dispatchDemand,
      dispatchBySpoke: dispatchLines,
      stockCap,
      primaryBench: primaryBenchForItem(item),
      benches: benchesForItem(item),
    });
  }
  return lines;
}

/**
 * Rota rebalance: shared types.
 *
 * The skill reads a site's draft rota from its workforce tool (Deputy
 * first), compares it with the work Edify knows is coming, proposes
 * shift edits as tickable lines, checks labour rules and writes an
 * amended draft back. The rota stays in the workforce tool. Edify never
 * publishes, never notifies staff, never touches payroll.
 *
 * Two kinds of input feed the engine:
 *   • `DeputyDraft`: what the workforce tool holds: people, shifts,
 *                        contracted hours, age, leave, and the site's
 *                        labour rules (rules are configuration, they
 *                        differ by country).
 *   • `SiteLabourData`: what Edify knows about the site: forecast,
 *                        labour standards per product type, fixed tasks
 *                        (deliveries, prep, stocktakes, cleaning, group
 *                        orders), stations, last week's outcomes.
 */

export type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export const DAY_KEYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Engine resolution. Fifteen-minute slots. */
export const SLOT_MIN = 15;

// ─── Deputy side ────────────────────────────────────────────────────────────

export interface Person {
  id: string;
  name: string;
  /** Role label as Deputy holds it ("Barista", "Team leader"). */
  role: string;
  contractedHours: number;
  /** Age matters for under-18 rules. Undefined means adult. */
  age?: number;
  keyholder?: boolean;
  /** Days on booked leave. Not available for adds. */
  leave?: DayKey[];
  /** Days marked unavailable in Deputy. Not available for adds. */
  unavailable?: DayKey[];
  /** Plain note shown in the people list ("annual leave Mon to Thu"). */
  note?: string;
}

export interface Shift {
  id: string;
  personId: string;
  day: DayKey;
  /** Minutes from midnight. */
  start: number;
  end: number;
  /** Rota area as the site labels it ("Opening", "Closing / Support"). */
  area: string;
  /** Station the person mostly covers. Optional; the engine infers
   *  from area when absent. */
  stationId?: string;
  /** Unpaid break inside the shift, minutes. Deputy holds this. */
  breakMin?: number;
}

export type LabourRuleKind =
  | 'rest-between-shifts'
  | 'under18-latest-finish'
  | 'under18-max-daily-hours'
  | 'weekly-average'
  | 'break-after'
  | 'contracted-hours';

export interface LabourRule {
  id: string;
  kind: LabourRuleKind;
  /** Label as the rules panel shows it. */
  label: string;
  /** Threshold in the unit the kind implies (hours, or minutes from
   *  midnight for latest finish). */
  value: number;
}

export interface DeputyDraft {
  siteId: string;
  siteName: string;
  /** ISO date of the Monday. */
  weekStart: string;
  /** "Mon 7 to Sun 13 Sep" */
  weekLabel: string;
  /** Deputy area order, top to bottom on the grid. */
  areas: string[];
  people: Person[];
  shifts: Shift[];
  rules: LabourRule[];
  /** Blended hourly cost including on-costs, used for labour %. */
  hourlyCostGBP: number;
  /** When Edify last pulled this draft, shown on re-check. */
  lastSynced: string;
  /** Name of the workforce tool, so copy can say "Write to Deputy". */
  tool: string;
}

// ─── Edify side ─────────────────────────────────────────────────────────────

export interface Station {
  id: string;
  name: string;
  /** True where a machine does part of the work (tea machine, oven).
   *  Machine seconds go to a separate capacity curve. */
  hasMachine?: boolean;
  /** Units the machine can finish per hour at full tilt. */
  machineUnitsPerHour?: number;
  /** Share of sales-driven human work this station carries (0 to 1).
   *  Shares sum to 1 across stations. */
  demandShare: number;
}

export interface LabourStandard {
  /** Product type the standard applies to ("hot drink", "food to go"). */
  productType: string;
  /** Share of transactions this type represents (0 to 1). */
  mix: number;
  humanSeconds: number;
  machineSeconds: number;
  /** Where the number came from. Shown on the explain card. */
  provenance: string;
}

export type FixedTaskSource = 'grn' | 'prep' | 'stocktake' | 'clean' | 'checklist' | 'order' | 'brew';

export interface FixedTask {
  id: string;
  label: string;
  /** A day, every day, or Monday to Friday. Daily and weekday windows
   *  are written against the weekday hours and move with a day's open
   *  or close where it trades different hours. */
  day: DayKey | 'daily' | 'weekdays';
  start: number;
  end: number;
  /** Human minutes of work inside the window. */
  humanMinutes: number;
  /** Machine minutes inside the window, if a machine is tied up. */
  machineMinutes?: number;
  stationId: string;
  source: FixedTaskSource;
  /** Where in Edify this came from ("GRN due 07:00, Brakes"). */
  evidence: string;
}

export interface ForecastSignal {
  label: string;
  /** Signed percentage effect on the window, for the explain card. */
  effectPct: number;
  detail: string;
  /** Window the signal applies to, minutes from midnight. Whole day
   *  when absent. */
  start?: number;
  end?: number;
}

export interface DayPartOutcome {
  dayPart: string;
  /** Hours rostered against the labour guide last week. Negative is under. */
  hoursVsGuide: number;
  wasteGBP: number;
  /** Multiple of the weekday average. 1.0 is normal. */
  wasteVsWeekday: number;
  stockVariancePct: number;
  /** Checklist steps completed as a fraction. */
  checklistCompletion: number;
  /** Average speed of service in seconds. */
  speedOfServiceSec: number;
}

export interface LastWeek {
  weekLabel: string;
  byDay: Record<DayKey, DayPartOutcome[]>;
  /** One sentence per site: observation first, then what it cost. */
  attribution: string;
}

export interface SiteLabourData {
  siteId: string;
  openMin: number;
  closeMin: number;
  /** Days that trade different hours from the weekday default. */
  hoursByDay?: Partial<Record<DayKey, { open: number; close: number }>>;
  /** Forecast sales for the week, pounds. */
  weeklySalesGBP: number;
  avgTicketGBP: number;
  /** Multiplier per day. Sums to 7 across the week when balanced. */
  dayMultiplier: Record<DayKey, number>;
  /** Relative sales weight per hour of day (0 to 23). Any scale; the
   *  engine normalises. Comes from the site's hourly trading data. */
  hourShape: Record<number, number>;
  /** Named intraday adjustments the forecast already carries, for
   *  the explain card and for evidence lines ("forecast up 18% on
   *  Saturday lunch"). */
  signals: Partial<Record<DayKey, ForecastSignal[]>>;
  /** Per-day, per-hour multipliers layered on the base shape. Keyed
   *  by day then hour of day. */
  hourAdjust?: Partial<Record<DayKey, Record<number, number>>>;
  standards: LabourStandard[];
  stations: Station[];
  fixedTasks: FixedTask[];
  /** Minimum heads on the floor while open. */
  floorMinimum: number;
  /** Labour % of sales the site is held to. */
  targetLabourPct: number;
  lastWeek: LastWeek;
}

// ─── Engine outputs ─────────────────────────────────────────────────────────

export type ProposalKind = 'add' | 'amend' | 'remove';
/** demand: sales forecast. workload: fixed work (prep, GRN, stocktake,
 *  pre-orders). capacity: a machine or hopper is the constraint.
 *  rule-fix: a labour rule breach on the draft. */
export type ProposalTag = 'demand' | 'workload' | 'capacity' | 'rule-fix';

export interface Proposal {
  id: string;
  kind: ProposalKind;
  tag: ProposalTag;
  personId: string;
  personName: string;
  day: DayKey;
  area: string;
  stationId?: string;
  /** Shift as the draft has it. Absent on adds. */
  before?: { start: number; end: number };
  /** Shift as proposed. Absent on removes. */
  after?: { start: number; end: number };
  /** One line in the proposals list ("Add Alba, Sat 11:00 to 17:00"). */
  title: string;
  /** Short reason on the shift chip ("forecast +18%"). */
  reason: string;
  /** Grey evidence in the list ("Forecast up 18% on Saturday lunch"). */
  evidence: string;
  /** Lines that create a rules warning start unticked. */
  defaultSelected: boolean;
  /** Signed hours this line adds to the week. */
  hoursDelta: number;
  /** Rule this line fixes or, on a warning, the rule it strains. */
  ruleId?: string;
  /** Present when ticking this line leaves a rule in warning. */
  warning?: string;
  /** Other ways to close the same gap or cut the same idle, for the GM
   *  who knows something the data does not. The first is the engine's
   *  pick; these are the runners-up, in order. */
  alternatives?: Alternative[];
}

/** A different edit that solves the same problem as its proposal.
 *  Choosing one replaces the proposal's edit, not its reason. */
export interface Alternative {
  id: string;
  kind: ProposalKind;
  personId: string;
  personName: string;
  day: DayKey;
  area: string;
  stationId?: string;
  before?: { start: number; end: number };
  after?: { start: number; end: number };
  /** One line in the receipt ("Add Freya, Thu 07:00 to 11:00"). */
  title: string;
  /** Why this is second, or what it trades ("Freya is 4h under contract"). */
  evidence: string;
  hoursDelta: number;
  warning?: string;
}

export type RuleStatus = 'pass' | 'warn' | 'fail';

export interface RuleResult {
  ruleId: string;
  label: string;
  status: RuleStatus;
  /** Plain sentence when not a pass. */
  detail?: string;
}

export interface Tiles {
  scheduledHours: number;
  /** Signed change against the draft. */
  hoursDelta: number;
  labourPct: number;
  targetPct: number;
  peakGaps: number;
  peakGapsBefore: number;
  /** One line under the labour tile when the target is missed. */
  constraintLine?: string;
}

export interface SlotPoint {
  /** Minutes from midnight. */
  min: number;
  required: number;
  rostered: number;
  /** Machine load as a fraction of capacity, where a station has one. */
  machineLoad?: number;
}

export interface StationCurve {
  stationId: string;
  stationName: string;
  hasMachine: boolean;
  points: SlotPoint[];
}

export interface DayAnalysis {
  day: DayKey;
  /** Whole-site required vs rostered per slot. */
  points: SlotPoint[];
  stations: StationCurve[];
  /** Slots where required exceeds rostered. */
  gapSlots: number;
  /** Slots where rostered exceeds required by two or more. */
  idleSlots: number;
  salesGBP: number;
}

export interface LabourGuideRow {
  day: DayKey;
  /** Hours the workload says the day part needs. */
  byDayPart: { dayPart: string; guideHours: number; rosteredHours: number }[];
  guideHours: number;
  rosteredHours: number;
}

/** Why a day's forecast is what it is, and how it becomes hours. */
export interface ForecastExplanation {
  day: DayKey;
  open: number;
  close: number;
  /** Forecast for the day after named adjustments. */
  salesGBP: number;
  /** The day-of-week pattern alone, before adjustments. */
  baseGBP: number;
  /** Signed percentage the adjustments move the day. */
  adjustPct: number;
  transactions: number;
  signals: ForecastSignal[];
  tasks: FixedTask[];
  standards: LabourStandard[];
  /** Blended human seconds per transaction across the product mix. */
  humanSecondsPerTransaction: number;
  /** Hours of work the sales alone create. */
  salesHours: number;
  /** Hours of work the fixed tasks create. */
  taskHours: number;
  /** Hours the floor minimum holds regardless of sales. */
  floorHours: number;
  /** Hours the guide says the day needs, after the floor. */
  guideHours: number;
  peak: { start: number; end: number; heads: number };
}

/** A window where a machine, not the people, is the limit. Not a shift
 *  edit: another head would stand in the same queue. */
export interface CapacityNote {
  day: DayKey;
  start: number;
  end: number;
  stationNames: string[];
  /** Peak machine load in the window, 1 is capacity. */
  peakLoad: number;
  /** What is driving it, if a fixed task or signal sits in the window. */
  driver?: string;
  /** What to do about it, in one line. */
  advice: string;
}

export interface RebalanceResult {
  draft: DeputyDraft;
  site: SiteLabourData;
  /** Requested target, if the prompt carried one. */
  requestedTargetPct?: number;
  proposals: Proposal[];
  /** Analysis of the draft as it stands. */
  before: DayAnalysis[];
  /** Rules on the draft as it stands. */
  rulesBefore: RuleResult[];
  guide: LabourGuideRow[];
  /** Windows where a machine, not the rota, is the limit. */
  capacity: CapacityNote[];
}

/** A window the planner could not staff: nobody available who passes
 *  the rules. The GM fixes these by hand. */
export interface UnfilledWindow {
  day: DayKey;
  start: number;
  end: number;
  /** Heads short at the worst point. */
  depth: number;
}

/** The agent's plan for the week, built from the forecast and the team
 *  with the GM's shifts set aside. Shaped like a rebalance so the card
 *  draws it with the same grid, tiles and rules: the proposals are the
 *  difference between the plan and the GM's draft, all selected. */
export interface PlanResult extends RebalanceResult {
  planned: true;
  /** The plan itself, every shift. */
  plannedShifts: Shift[];
  unfilled: UnfilledWindow[];
  /** Things the plan could not honour that are not cover gaps: an open
   *  or close with no keyholder on. */
  notes: string[];
}

// ── Morning variance sweep ──────────────────────────────────────────
//
// Yesterday, one site at a time: what the rota planned to spend, what
// the clock data says was spent, and where every pound of the gap went.
// Read from the workforce tool after the overnight pay run; nothing is
// ever written back.

export type VarianceCauseKind =
  /** Hours past the weekly contract, paid at the overtime band. */
  | 'overtime'
  /** A statutory break not taken or not recorded, so paid. */
  | 'missed-break'
  | 'late-clock-out'
  | 'early-clock-in'
  /** A rostered shift nobody worked and nobody covered. */
  | 'unfilled-shift'
  /** A shift added on the day that was not on the rota. */
  | 'extra-shift'
  /** Sent home or clocked out early. */
  | 'early-finish';

export interface VarianceCause {
  kind: VarianceCauseKind;
  /** Cost against plan in pounds. Positive is over, negative under. */
  gbp: number;
  /** Minutes against plan, signed the same way. */
  minutes: number;
  personName?: string;
  /** The subject when it is not one person: "Both closers", "Three
   *  shifts". The row headline falls back to the detail without it. */
  who?: string;
  /** One line, the fact: "clocked out 20:50, rostered 20:15". */
  detail: string;
  /** Set when this is a pattern, not a one-off: "third Saturday running". */
  repeat?: string;
  /** Legal exposure, not just cost: a missed statutory break, an
   *  under-18 past 22:00. These rank above money. */
  compliance?: boolean;
}

export interface SiteDayVariance {
  siteId: string;
  /** Where the clock data came from. */
  tool: string;
  plannedHours: number;
  plannedCostGBP: number;
  actualHours: number;
  actualCostGBP: number;
  /** Edify's sales for the same day. */
  salesGBP: number;
  forecastGBP: number;
  causes: VarianceCause[];
  /** What the floor felt, from Edify's own data: speed of service, a
   *  queue, waste. Adds to the ranking line when set. */
  context?: string;
  /** Where the clock data is incomplete: a shift still open at the pull. */
  dataNote?: string;
}

/** How much a site's variance matters, which is not the same as how big
 *  it is. Hours that served sales the forecast missed are the trade;
 *  the same pounds with flat sales are a rota problem; a missed break
 *  is a legal problem at any price. */
export type Materiality = 'matters' | 'watch' | 'explained';

export interface SweptSite extends SiteDayVariance {
  siteName: string;
  /** Actual minus planned cost. */
  varianceGBP: number;
  plannedLabourPct: number;
  actualLabourPct: number;
  /** Actual labour % minus planned labour %. Hours that rose with the
   *  sales leave this near zero; the same hours on flat sales do not.
   *  The part of the variance the trade does not explain. */
  unexplainedPts: number;
  salesVsForecastPct: number;
  materiality: Materiality;
  /** The reason in a few words, no numbers: "Breaks not taken, third
   *  Saturday running." The row header. */
  lead: string;
  /** Why it sits where it does in the ranking, one line with the
   *  numbers. The chat line. */
  why: string;
  /** Pounds no cause accounts for, after rounding and pay rules. */
  unattributedGBP: number;
  /** True when the site has a draft for next week the rebalance can open. */
  hasDraft: boolean;
}

export interface SweepResult {
  /** "Saturday 5 Sep" */
  dateLabel: string;
  /** "06:00" */
  pulledAt: string;
  tool: string;
  /** Ranked: matters first, then watch, then explained; biggest
   *  unexplained variance first within a band. */
  sites: SweptSite[];
  totals: {
    plannedCostGBP: number;
    actualCostGBP: number;
    varianceGBP: number;
    salesGBP: number;
    forecastGBP: number;
    plannedLabourPct: number;
    actualLabourPct: number;
  };
  /** Pounds by cause across the estate, biggest first. */
  byCause: { kind: VarianceCauseKind; gbp: number; count: number }[];
}

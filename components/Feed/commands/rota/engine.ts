/**
 * Rota rebalance engine. Pure and deterministic: no React, no clock
 * reads, so the card can re-run it on every tick and untick and the
 * demo tells the same story every time.
 *
 * Pipeline
 *   1. Workload curve per day per station, in 15-minute slots:
 *        sales forecast × human seconds per unit (by product mix)
 *      + fixed task minutes spread across their windows.
 *      Machine seconds go to a separate capacity curve.
 *   2. Required heads per slot = ceil(human seconds / (slot × utilisation)),
 *      never below the floor minimum.
 *   3. Gap analysis = required minus rostered. Positive is a cover gap,
 *      negative is idle time.
 *   4. Propose the smallest set of shift edits that closes peak gaps
 *      and removes long idle runs: extend before add, add before remove.
 *   5. Rules on the draft, then on the proposed rota. Breaches on the
 *      draft become rule-fix proposals. A proposal that strains a rule
 *      starts unticked and carries a warning.
 */

import {
  DAY_KEYS,
  SLOT_MIN,
  type CapacityNote,
  type DayAnalysis,
  type DayKey,
  type DeputyDraft,
  type FixedTask,
  type FixedTaskSource,
  type ForecastExplanation,
  type LabourGuideRow,
  type Person,
  type Alternative,
  type PlanResult,
  type Proposal,
  type ProposalTag,
  type RebalanceResult,
  type RuleResult,
  type Shift,
  type SiteLabourData,
  type SlotPoint,
  type StationCurve,
  type Tiles,
  type UnfilledWindow,
} from './types';

/** People are not busy every second of a slot. */
export const UTILISATION = 0.8;
/** A gap run shorter than this is noise, not a cover gap. */
const MIN_GAP_SLOTS = 2;
/** Idle runs shorter than this (2 hours) are left alone. */
const MIN_IDLE_SLOTS = 8;
/** Never propose a shift shorter than this on an add. */
const MIN_ADD_MIN = 4 * 60;
/** Never extend a shift by more than this. */
const MAX_EXTEND_MIN = 3 * 60;

export const DAY_PARTS: { name: string; start: number; end: number }[] = [
  { name: 'Morning', start: 6 * 60, end: 11 * 60 },
  { name: 'Midday', start: 11 * 60, end: 15 * 60 },
  { name: 'Afternoon', start: 15 * 60, end: 19 * 60 },
  { name: 'Evening', start: 19 * 60, end: 24 * 60 },
];

// ─── Small helpers ──────────────────────────────────────────────────────────

export function hhmm(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function shiftHours(s: { start: number; end: number; breakMin?: number }): number {
  return (s.end - s.start - (s.breakMin ?? 0)) / 60;
}

function roundDownHour(min: number): number {
  return Math.floor(min / 60) * 60;
}
function roundUpHour(min: number): number {
  return Math.ceil(min / 60) * 60;
}

export function hoursFor(site: SiteLabourData, day: DayKey): { open: number; close: number } {
  return site.hoursByDay?.[day] ?? { open: site.openMin, close: site.closeMin };
}

function slotsFor(site: SiteLabourData, day: DayKey): number[] {
  const { open, close } = hoursFor(site, day);
  const out: number[] = [];
  for (let m = open; m < close; m += SLOT_MIN) out.push(m);
  return out;
}

/** A fixed task's window on a given day. Daily tasks are written
 *  against the weekday hours; on a day that trades different hours,
 *  opening tasks move with the open and closing tasks with the close,
 *  so Saturday's prep still happens at Saturday's open. */
export function taskWindow(site: SiteLabourData, task: FixedTask, day: DayKey): { start: number; end: number } {
  if (task.day !== 'daily' && task.day !== 'weekdays') return { start: task.start, end: task.end };
  const { open, close } = hoursFor(site, day);
  const midday = (site.openMin + site.closeMin) / 2;
  const shift = task.start < midday ? open - site.openMin : close - site.closeMin;
  return { start: task.start + shift, end: task.end + shift };
}

/** Fixed tasks that fall inside the day's trading hours, with their
 *  windows for that day. */
export function tasksOn(site: SiteLabourData, day: DayKey): (FixedTask & { start: number; end: number })[] {
  const { open, close } = hoursFor(site, day);
  const weekday = day !== 'Sat' && day !== 'Sun';
  return site.fixedTasks
    .filter((t) => t.day === day || t.day === 'daily' || (t.day === 'weekdays' && weekday))
    .map((t) => ({ ...t, ...taskWindow(site, t, day) }))
    .filter((t) => t.start < close && t.end > open)
    // Specific days first so a Thursday GRN, not the daily prep, is
    // the reason given for a Thursday gap.
    .sort((a, b) => (a.day === day ? 0 : 1) - (b.day === day ? 0 : 1));
}

/** A line that leaves someone more than this far under contract starts
 *  unticked. Smaller shortfalls stay ticked and carry the warning. */
const UNTICK_UNDER_CONTRACT_HOURS = 4;

function dayIndex(day: DayKey): number {
  return DAY_KEYS.indexOf(day);
}

// ─── Workload ───────────────────────────────────────────────────────────────

function daySalesGBP(site: SiteLabourData, day: DayKey): number {
  const sum = DAY_KEYS.reduce((a, d) => a + site.dayMultiplier[d], 0);
  return (site.weeklySalesGBP * site.dayMultiplier[day]) / sum;
}

/** Pounds of forecast sales per slot for a day. */
function salesCurve(site: SiteLabourData, day: DayKey): Map<number, number> {
  const slots = slotsFor(site, day);
  const base = daySalesGBP(site, day);
  const weights = new Map<number, number>();
  let total = 0;
  for (const m of slots) {
    const hour = Math.floor(m / 60);
    const w = site.hourShape[hour] ?? 0;
    weights.set(m, w);
    total += w;
  }
  const out = new Map<number, number>();
  for (const m of slots) {
    const hour = Math.floor(m / 60);
    const adj = site.hourAdjust?.[day]?.[hour] ?? 1;
    out.set(m, total > 0 ? (base * (weights.get(m) ?? 0)) / total * adj : 0);
  }
  return out;
}

function humanSecondsPerUnit(site: SiteLabourData): number {
  return site.standards.reduce((a, s) => a + s.mix * s.humanSeconds, 0);
}
function machineSecondsPerUnit(site: SiteLabourData): number {
  return site.standards.reduce((a, s) => a + s.mix * s.machineSeconds, 0);
}

interface Workload {
  /** Human seconds per slot per station. */
  human: Map<string, Map<number, number>>;
  /** Machine load fraction per slot per machine station. */
  machine: Map<string, Map<number, number>>;
  salesGBP: number;
}

function workloadFor(site: SiteLabourData, day: DayKey): Workload {
  const slots = slotsFor(site, day);
  const sales = salesCurve(site, day);
  const hsu = humanSecondsPerUnit(site);
  const msu = machineSecondsPerUnit(site);
  const machineStations = site.stations.filter((s) => s.hasMachine);

  const human = new Map<string, Map<number, number>>();
  const machine = new Map<string, Map<number, number>>();
  for (const st of site.stations) {
    human.set(st.id, new Map(slots.map((m) => [m, 0])));
    if (st.hasMachine) machine.set(st.id, new Map(slots.map((m) => [m, 0])));
  }

  let salesGBP = 0;
  for (const m of slots) {
    const gbp = sales.get(m) ?? 0;
    salesGBP += gbp;
    const units = gbp / site.avgTicketGBP;
    for (const st of site.stations) {
      const row = human.get(st.id)!;
      row.set(m, (row.get(m) ?? 0) + units * hsu * st.demandShare);
    }
    if (machineStations.length > 0 && msu > 0) {
      const perMachineUnits = units / machineStations.length;
      for (const st of machineStations) {
        const capPerSlot = ((st.machineUnitsPerHour ?? 1) * SLOT_MIN) / 60;
        const row = machine.get(st.id)!;
        row.set(m, (row.get(m) ?? 0) + perMachineUnits / capPerSlot);
      }
    }
  }

  for (const task of tasksOn(site, day)) {
    const taskSlots = slots.filter((m) => m >= task.start && m < task.end);
    if (taskSlots.length === 0) continue;
    const perSlotHuman = (task.humanMinutes * 60) / taskSlots.length;
    const row = human.get(task.stationId) ?? human.get(site.stations[0].id)!;
    for (const m of taskSlots) row.set(m, (row.get(m) ?? 0) + perSlotHuman);
    if (task.machineMinutes && machine.has(task.stationId)) {
      const mrow = machine.get(task.stationId)!;
      const perSlotMachine = task.machineMinutes / taskSlots.length / SLOT_MIN;
      for (const m of taskSlots) mrow.set(m, (mrow.get(m) ?? 0) + perSlotMachine);
    }
  }

  return { human, machine, salesGBP };
}

function rosteredAt(shifts: Shift[], day: DayKey, min: number): number {
  let n = 0;
  for (const s of shifts) if (s.day === day && s.start <= min && min < s.end) n++;
  return n;
}

export function analyseDay(site: SiteLabourData, shifts: Shift[], day: DayKey): DayAnalysis {
  const slots = slotsFor(site, day);
  const wl = workloadFor(site, day);
  const slotSeconds = SLOT_MIN * 60 * UTILISATION;

  const points: SlotPoint[] = [];
  const stationCurves: StationCurve[] = site.stations.map((st) => ({
    stationId: st.id,
    stationName: st.name,
    hasMachine: !!st.hasMachine,
    points: [],
  }));

  let gapSlots = 0;
  let idleSlots = 0;
  for (const m of slots) {
    let totalHuman = 0;
    site.stations.forEach((st, i) => {
      const h = wl.human.get(st.id)?.get(m) ?? 0;
      totalHuman += h;
      stationCurves[i].points.push({
        min: m,
        required: h / slotSeconds,
        rostered: rosteredAt(shifts.filter((s) => (s.stationId ?? '') === st.id), day, m),
        machineLoad: st.hasMachine ? wl.machine.get(st.id)?.get(m) ?? 0 : undefined,
      });
    });
    const required = Math.max(site.floorMinimum, Math.ceil(totalHuman / slotSeconds - 0.05));
    const rostered = rosteredAt(shifts, day, m);
    if (required > rostered) gapSlots++;
    if (rostered - required >= 1) idleSlots++;
    points.push({ min: m, required, rostered });
  }

  return { day, points, stations: stationCurves, gapSlots, idleSlots, salesGBP: wl.salesGBP };
}

export function analyseWeek(site: SiteLabourData, shifts: Shift[]): DayAnalysis[] {
  return DAY_KEYS.map((d) => analyseDay(site, shifts, d));
}

/** Contiguous runs where a predicate holds over the slot points. */
function runs(points: SlotPoint[], pred: (p: SlotPoint) => boolean): { start: number; end: number; slots: number; depth: number }[] {
  const out: { start: number; end: number; slots: number; depth: number }[] = [];
  let cur: { start: number; end: number; slots: number; depth: number } | null = null;
  for (const p of points) {
    if (pred(p)) {
      const d = Math.abs(p.required - p.rostered);
      if (!cur) cur = { start: p.min, end: p.min + SLOT_MIN, slots: 1, depth: d };
      else {
        cur.end = p.min + SLOT_MIN;
        cur.slots++;
        cur.depth = Math.max(cur.depth, d);
      }
    } else if (cur) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Peak cover gaps across the week: gap runs of at least 30 minutes. */
export function countPeakGaps(analysis: DayAnalysis[]): number {
  return analysis.reduce(
    (a, d) => a + runs(d.points, (p) => p.required > p.rostered).filter((r) => r.slots >= MIN_GAP_SLOTS).length,
    0,
  );
}

// ─── Rules ──────────────────────────────────────────────────────────────────

function weeklyHours(shifts: Shift[], personId: string): number {
  return shifts.filter((s) => s.personId === personId).reduce((a, s) => a + shiftHours(s), 0);
}

export function checkRules(draft: DeputyDraft, shifts: Shift[]): RuleResult[] {
  const byPerson = new Map<string, Person>(draft.people.map((p) => [p.id, p]));
  const results: RuleResult[] = [];

  for (const rule of draft.rules) {
    const fails: string[] = [];
    const warns: string[] = [];

    if (rule.kind === 'rest-between-shifts') {
      for (const p of draft.people) {
        const mine = shifts.filter((s) => s.personId === p.id).sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || a.start - b.start);
        for (let i = 1; i < mine.length; i++) {
          const prev = mine[i - 1];
          const next = mine[i];
          const dayGap = dayIndex(next.day) - dayIndex(prev.day);
          if (dayGap !== 1) continue;
          const rest = 24 * 60 - prev.end + next.start;
          if (rest < rule.value * 60) {
            fails.push(`${p.name} has ${Math.round(rest / 60)}h between ${prev.day} close and ${next.day} start`);
          }
        }
      }
    }

    if (rule.kind === 'under18-latest-finish') {
      for (const s of shifts) {
        const p = byPerson.get(s.personId);
        if (p?.age !== undefined && p.age < 18 && s.end > rule.value) {
          fails.push(`${p.name} is under 18 and finishes ${hhmm(s.end)} on ${s.day}`);
        }
      }
    }

    if (rule.kind === 'under18-max-daily-hours') {
      for (const s of shifts) {
        const p = byPerson.get(s.personId);
        if (p?.age !== undefined && p.age < 18 && shiftHours(s) > rule.value) {
          fails.push(`${p.name} is under 18 and works ${shiftHours(s)}h on ${s.day}`);
        }
      }
    }

    if (rule.kind === 'weekly-average') {
      for (const p of draft.people) {
        const h = weeklyHours(shifts, p.id);
        if (h > rule.value) fails.push(`${p.name} is rostered ${h}h`);
      }
    }

    if (rule.kind === 'break-after') {
      for (const s of shifts) {
        if (s.end - s.start > rule.value * 60 && (s.breakMin ?? 0) < 20) {
          const p = byPerson.get(s.personId);
          fails.push(`${p?.name ?? s.personId} has no break on ${s.day}`);
        }
      }
    }

    if (rule.kind === 'contracted-hours') {
      for (const p of draft.people) {
        if (p.contractedHours <= 0) continue;
        if (p.leave && p.leave.length >= 4) continue;
        const h = weeklyHours(shifts, p.id);
        const diff = Math.round((h - p.contractedHours) * 10) / 10;
        if (diff < 0) warns.push(`${p.name} is ${Math.abs(diff)}h under contract`);
      }
    }

    if (fails.length > 0) {
      results.push({ ruleId: rule.id, label: rule.label, status: 'fail', detail: fails.join('. ') });
    } else if (warns.length > 0) {
      results.push({ ruleId: rule.id, label: rule.label, status: 'warn', detail: warns.join(', ') });
    } else {
      results.push({ ruleId: rule.id, label: rule.label, status: 'pass' });
    }
  }
  return results;
}

// ─── Proposals ──────────────────────────────────────────────────────────────

function withBreak(s: Shift): Shift {
  const dur = s.end - s.start;
  return { ...s, breakMin: dur > 6 * 60 ? Math.max(s.breakMin ?? 0, 30) : (s.breakMin ?? 0) };
}

/** The proposal as the GM has it: the engine's pick, or the alternative
 *  she chose in its place. Keeps the id and the reason; swaps the edit. */
export function effectiveProposal(p: Proposal, chosen?: Map<string, string>): Proposal {
  const altId = chosen?.get(p.id);
  const alt = altId ? p.alternatives?.find((a) => a.id === altId) : undefined;
  if (!alt) return p;
  return {
    ...p,
    kind: alt.kind,
    personId: alt.personId,
    personName: alt.personName,
    day: alt.day,
    area: alt.area,
    stationId: alt.stationId,
    before: alt.before,
    after: alt.after,
    title: alt.title,
    evidence: alt.evidence,
    hoursDelta: alt.hoursDelta,
    warning: alt.warning,
  };
}

export function applyProposals(shifts: Shift[], proposals: Proposal[], selected: Set<string>, chosen?: Map<string, string>): Shift[] {
  let out = shifts.map((s) => ({ ...s }));
  for (const raw of proposals) {
    if (!selected.has(raw.id)) continue;
    const p = effectiveProposal(raw, chosen);
    if (p.kind === 'remove') {
      out = out.filter((s) => !(s.personId === p.personId && s.day === p.day && s.start === p.before?.start && s.end === p.before?.end));
    } else if (p.kind === 'amend' && p.after) {
      out = out.map((s) =>
        s.personId === p.personId && s.day === p.day && s.start === p.before?.start && s.end === p.before?.end
          ? withBreak({ ...s, start: p.after!.start, end: p.after!.end })
          : s,
      );
    } else if (p.kind === 'add' && p.after) {
      out.push(withBreak({
        id: `add-${p.id}`,
        personId: p.personId,
        day: p.day,
        start: p.after.start,
        end: p.after.end,
        area: p.area,
        stationId: p.stationId,
      }));
    }
  }
  return out;
}

function personAvailable(p: Person, day: DayKey, shifts: Shift[]): boolean {
  if (p.leave?.includes(day)) return false;
  if (p.unavailable?.includes(day)) return false;
  return !shifts.some((s) => s.personId === p.id && s.day === day);
}

/** Forecast signal whose window overlaps the slot range, if any. */
function signalFor(site: SiteLabourData, day: DayKey, start: number, end: number) {
  const sigs = site.signals[day] ?? [];
  const hit = sigs.find((s) => (s.start ?? 0) < end && (s.end ?? 24 * 60) > start);
  if (!hit) return null;
  const pct = `${hit.effectPct > 0 ? '+' : ''}${hit.effectPct}%`;
  return { reason: `forecast ${pct}`, evidence: `${hit.label} ${hit.detail}`.trim(), pct };
}

function fixedTaskFor(site: SiteLabourData, day: DayKey, start: number, end: number) {
  return tasksOn(site, day).find((t) => t.start < end && t.end > start && t.source !== 'clean' && t.source !== 'checklist');
}

function tagForTask(source: FixedTaskSource): ProposalTag {
  return source === 'brew' ? 'capacity' : 'workload';
}

/** Rest either side of a shift on `day` for this person, against the
 *  neighbouring days' shifts. Null when there is no neighbour. */
function restAround(shifts: Shift[], personId: string, day: DayKey, start: number, end: number): number | null {
  const idx = dayIndex(day);
  let worst: number | null = null;
  if (idx > 0) {
    const prev = shifts.filter((s) => s.personId === personId && s.day === DAY_KEYS[idx - 1]).sort((a, b) => b.end - a.end)[0];
    if (prev) worst = 24 * 60 - prev.end + start;
  }
  if (idx < 6) {
    const next = shifts.filter((s) => s.personId === personId && s.day === DAY_KEYS[idx + 1]).sort((a, b) => a.start - b.start)[0];
    if (next) {
      const r = 24 * 60 - end + next.start;
      worst = worst === null ? r : Math.min(worst, r);
    }
  }
  return worst;
}

function restOk(shifts: Shift[], restHours: number | undefined, personId: string, day: DayKey, start: number, end: number): boolean {
  if (restHours === undefined) return true;
  const r = restAround(shifts, personId, day, start, end);
  return r === null || r >= restHours * 60;
}

function headsAt(a: DayAnalysis, min: number): number {
  return a.points.find((p) => p.min === min)?.rostered ?? 0;
}

export function propose(draft: DeputyDraft, site: SiteLabourData): Proposal[] {
  const proposals: Proposal[] = [];
  const byPerson = new Map<string, Person>(draft.people.map((p) => [p.id, p]));
  const restRule = draft.rules.find((r) => r.kind === 'rest-between-shifts');
  const u18Rule = draft.rules.find((r) => r.kind === 'under18-latest-finish');
  const u18DailyRule = draft.rules.find((r) => r.kind === 'under18-max-daily-hours');
  const contractRule = draft.rules.find((r) => r.kind === 'contracted-hours');
  const restHours = restRule?.value;

  // Working copy: rule fixes first so demand proposals see the fixed rota.
  let working = draft.shifts.map((s) => ({ ...s }));
  let n = 0;
  const nextId = () => `p${++n}`;

  const underAfter = (p: Person, hoursAfter: number) => Math.round((p.contractedHours - hoursAfter) * 10) / 10;

  /** Where a person stands against contract, for an alternative's
   *  evidence line. */
  const standing = (p: Person, extraHours = 0): string => {
    if (p.contractedHours === 0) return `${p.name} is casual`;
    const slack = Math.round((p.contractedHours - weeklyHours(working, p.id) - extraHours) * 10) / 10;
    if (slack > 0) return `${p.name} is ${slack}h under contract`;
    if (slack === 0) return `${p.name} is on contract`;
    return `${p.name} is ${-slack}h over contract`;
  };

  /** A shift sized to a gap: never under four hours, inside opening hours. */
  const addWindow = (day: DayKey, start: number, end: number) => {
    const { open, close } = hoursFor(site, day);
    let addEnd = Math.min(close, Math.max(end, start + MIN_ADD_MIN));
    const addStart = Math.max(open, Math.min(start, addEnd - MIN_ADD_MIN));
    addEnd = Math.min(close, Math.max(addEnd, addStart + MIN_ADD_MIN));
    return { addStart, addEnd };
  };

  /** Who could take a new shift, best first: furthest under contract,
   *  then casuals, then least over. Rest and under-18 rules respected. */
  const addCandidates = (day: DayKey, addStart: number, addEnd: number) =>
    draft.people
      .filter((p) => personAvailable(p, day, working))
      .filter((p) => !(p.age !== undefined && p.age < 18 && u18Rule && addEnd > u18Rule.value))
      .filter((p) => restOk(working, restHours, p.id, day, addStart, addEnd))
      .map((p) => {
        const slack = p.contractedHours - weeklyHours(working, p.id);
        const tier = slack > 0 ? 0 : p.contractedHours === 0 ? 1 : 2;
        return { p, slack, tier };
      })
      .sort((a, b) => a.tier - b.tier || b.slack - a.slack);

  const addAlt = (id: string, p: Person, day: DayKey, addStart: number, addEnd: number, area: string, stationId: string | undefined, instead: boolean): Alternative => ({
    id,
    kind: 'add',
    personId: p.id,
    personName: p.name,
    day,
    area,
    stationId,
    after: { start: addStart, end: addEnd },
    title: `Add ${p.name}, ${day} ${hhmm(addStart)} to ${hhmm(addEnd)}`,
    evidence: instead ? `${standing(p)}. A new shift rather than a longer one` : standing(p),
    hoursDelta: shiftHours(withBreak({ id: '', personId: '', day, start: addStart, end: addEnd, area })),
  });

  // 1. Rule fixes on the draft.
  for (const p of draft.people) {
    const mine = working.filter((s) => s.personId === p.id).sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || a.start - b.start);
    for (let i = 1; i < mine.length && restRule; i++) {
      const prev = mine[i - 1];
      const next = mine[i];
      if (dayIndex(next.day) - dayIndex(prev.day) !== 1) continue;
      const rest = 24 * 60 - prev.end + next.start;
      if (rest >= restRule.value * 60) continue;
      const newStart = roundUpHour(prev.end + restRule.value * 60 - 24 * 60);
      // The other way round: finish earlier the night before and keep
      // the morning start.
      const prevNewEnd = roundDownHour(next.start + 24 * 60 - restRule.value * 60);
      const id = nextId();
      const alternatives: Alternative[] =
        prevNewEnd - prev.start >= MIN_ADD_MIN
          ? [
              {
                id: `${id}-a1`,
                kind: 'amend',
                personId: p.id,
                personName: p.name,
                day: prev.day,
                area: prev.area,
                stationId: prev.stationId,
                before: { start: prev.start, end: prev.end },
                after: { start: prev.start, end: prevNewEnd },
                title: `${p.name} finishes ${hhmm(prevNewEnd)} on ${prev.day}, not ${hhmm(prev.end)}`,
                evidence: `Keeps ${next.day}'s ${hhmm(next.start)} start. ${prev.day}'s close then needs cover from ${hhmm(prevNewEnd)}`,
                hoursDelta: -(prev.end - prevNewEnd) / 60,
              },
            ]
          : [];
      proposals.push({
        alternatives,
        id,
        kind: 'amend',
        tag: 'rule-fix',
        personId: p.id,
        personName: p.name,
        day: next.day,
        area: next.area,
        stationId: next.stationId,
        before: { start: next.start, end: next.end },
        after: { start: newStart, end: next.end },
        title: `${p.name} starts ${hhmm(newStart)} on ${next.day}, not ${hhmm(next.start)}`,
        reason: `${restRule.value}h rest`,
        evidence: `Only ${Math.round(rest / 60)}h rest after ${prev.day}'s close`,
        defaultSelected: true,
        hoursDelta: -(newStart - next.start) / 60,
        ruleId: restRule.id,
      });
      next.start = newStart;
    }
  }
  if (u18Rule) {
    for (const s of working) {
      const p = byPerson.get(s.personId);
      if (!p || p.age === undefined || p.age >= 18 || s.end <= u18Rule.value) continue;
      const newEnd = u18Rule.value;
      proposals.push({
        id: nextId(),
        kind: 'amend',
        tag: 'rule-fix',
        personId: p.id,
        personName: p.name,
        day: s.day,
        area: s.area,
        stationId: s.stationId,
        before: { start: s.start, end: s.end },
        after: { start: s.start, end: newEnd },
        title: `${p.name} moved off ${s.day}'s close`,
        reason: 'under 18',
        evidence: `Under 18, cannot work past ${hhmm(u18Rule.value)}`,
        defaultSelected: true,
        hoursDelta: -(s.end - newEnd) / 60,
        ruleId: u18Rule.id,
      });
      s.end = newEnd;
    }
  }

  // 2. Demand and workload: close gaps, then trim idle, day by day.
  for (const day of DAY_KEYS) {
    const addedToday: { start: number; end: number }[] = [];
    // Re-analyse after every edit so a shift added for one gap can be
    // extended into the next rather than a second person added.
    // A gap two deep takes two edits, so a run may be attempted twice.
    const attempted = new Map<number, number>();
    for (let guard = 0; guard < 12; guard++) {
      const analysis = analyseDay(site, working, day);
      const run = runs(analysis.points, (p) => p.required > p.rostered)
        .filter((r) => r.slots >= MIN_GAP_SLOTS)
        .find((r) => (attempted.get(r.start) ?? 0) < 2);
      if (!run) break;
      attempted.set(run.start, (attempted.get(run.start) ?? 0) + 1);
      const start = roundDownHour(run.start);
      const end = roundUpHour(run.end);
      const task = fixedTaskFor(site, day, run.start, run.end);
      const sig = signalFor(site, day, run.start, run.end);
      const openedByFix = proposals.find(
        (p) => p.tag === 'rule-fix' && p.day === day && p.before && p.after && p.before.end > run.start && p.after.end <= run.start,
      );
      // The reason given is the most specific thing that explains the
      // gap: an event-sized task (a delivery, a group order), then a
      // named forecast signal, then the bare workload. A long background
      // task such as hopper refills is never the headline; it is part
      // of the workload figure.
      const eventTask = task && task.end - task.start <= 4 * 60 ? task : undefined;
      const why = eventTask
        ? { reason: eventTask.label.toLowerCase(), evidence: eventTask.evidence, tag: tagForTask(eventTask.source) }
        : openedByFix
          ? { reason: 'cover the close', evidence: `${openedByFix.personName} finishing ${hhmm(openedByFix.after!.end)} leaves ${headsAt(analysis, run.start)} on from ${hhmm(run.start)} to ${hhmm(run.end)}`, tag: 'demand' as ProposalTag }
          : sig
            ? { reason: sig.reason, evidence: sig.evidence, tag: 'demand' as ProposalTag }
            : { reason: 'cover gap', evidence: `Workload needs ${Math.ceil(run.depth)} more from ${hhmm(run.start)} to ${hhmm(run.end)}`, tag: 'demand' as ProposalTag };

      // Extend a neighbouring shift first: one that ends where the gap
      // starts, or starts where it ends.
      const dayShifts = working.filter((s) => s.day === day);
      const endsBefore = dayShifts
        .filter((s) => s.end <= start && start - s.end <= 60 && end - s.end <= MAX_EXTEND_MIN)
        .filter((s) => {
          const p = byPerson.get(s.personId);
          if (!p) return false;
          if (p.age !== undefined && p.age < 18) {
            if (u18Rule && end > u18Rule.value) return false;
            if (u18DailyRule && end - s.start > u18DailyRule.value * 60) return false;
          }
          return restOk(working, restHours, p.id, day, s.start, end);
        })
        .sort((a, b) => b.end - a.end)[0];
      const startsAfter = dayShifts
        .filter((s) => s.start >= end && s.start - end <= 60 && s.start - start <= MAX_EXTEND_MIN)
        .filter((s) => {
          const p = byPerson.get(s.personId);
          if (p?.age !== undefined && p.age < 18 && u18DailyRule && s.end - start > u18DailyRule.value * 60) return false;
          return restOk(working, restHours, s.personId, day, start, s.end);
        })
        .sort((a, b) => a.start - b.start)[0];

      // Someone new for the same window, offered beside any extension.
      const win = addWindow(day, start, end);
      const area0 = win.addStart < 12 * 60 ? draft.areas[0] : draft.areas[draft.areas.length - 1];
      const station0 = task?.stationId ?? site.stations[0]?.id;
      const insteadOfExtend = (id: string, exclude: string) =>
        addCandidates(day, win.addStart, win.addEnd)
          .filter((c) => c.p.id !== exclude)
          .slice(0, 1)
          .map((c) => addAlt(`${id}-a1`, c.p, day, win.addStart, win.addEnd, area0, station0, true));

      if (endsBefore) {
        const p = byPerson.get(endsBefore.personId)!;
        // Extending a shift this pass added is one proposal, not two.
        const ownAdd = endsBefore.id.startsWith('w-add-')
          ? proposals.find((x) => x.kind === 'add' && x.personId === p.id && x.day === day && x.after?.start === endsBefore.start)
          : undefined;
        if (ownAdd && ownAdd.after) {
          ownAdd.after = { start: ownAdd.after.start, end };
          ownAdd.title = `Add ${p.name}, ${day} ${hhmm(ownAdd.after.start)} to ${hhmm(end)}`;
          if (why.evidence !== ownAdd.evidence) ownAdd.evidence = `${ownAdd.evidence}. Then ${why.evidence.charAt(0).toLowerCase()}${why.evidence.slice(1)}`;
          endsBefore.end = end;
          Object.assign(endsBefore, withBreak(endsBefore));
          ownAdd.hoursDelta = shiftHours(endsBefore);
          // The runners-up take the longer shift too.
          for (const a of ownAdd.alternatives ?? []) {
            if (a.kind === 'add' && a.after) {
              a.after = { start: a.after.start, end };
              a.title = `Add ${a.personName}, ${day} ${hhmm(a.after.start)} to ${hhmm(end)}`;
              a.hoursDelta = shiftHours(withBreak({ id: '', personId: '', day, start: a.after.start, end, area: a.area }));
            }
          }
          const a = addedToday.find((x) => x.start === endsBefore.start);
          if (a) a.end = end;
          continue;
        }
        const id = nextId();
        proposals.push({
          id,
          alternatives: insteadOfExtend(id, p.id),
          kind: 'amend',
          tag: why.tag,
          personId: p.id,
          personName: p.name,
          day,
          area: endsBefore.area,
          stationId: endsBefore.stationId,
          before: { start: endsBefore.start, end: endsBefore.end },
          after: { start: endsBefore.start, end },
          title: `${p.name} finishes ${hhmm(end)} on ${day}, not ${hhmm(endsBefore.end)}`,
          reason: why.reason,
          evidence: why.evidence,
          defaultSelected: true,
          hoursDelta: (end - endsBefore.end) / 60,
        });
        endsBefore.end = end;
        Object.assign(endsBefore, withBreak(endsBefore));
        continue;
      }
      if (startsAfter) {
        const p = byPerson.get(startsAfter.personId)!;
        const id = nextId();
        proposals.push({
          id,
          alternatives: insteadOfExtend(id, p.id),
          kind: 'amend',
          tag: why.tag,
          personId: p.id,
          personName: p.name,
          day,
          area: startsAfter.area,
          stationId: startsAfter.stationId,
          before: { start: startsAfter.start, end: startsAfter.end },
          after: { start, end: startsAfter.end },
          title: `${p.name} starts ${hhmm(start)} on ${day}, not ${hhmm(startsAfter.start)}`,
          reason: why.reason,
          evidence: why.evidence,
          defaultSelected: true,
          hoursDelta: (startsAfter.start - start) / 60,
        });
        startsAfter.start = start;
        Object.assign(startsAfter, withBreak(startsAfter));
        continue;
      }

      // Otherwise add someone. Order: whoever is furthest under contract,
      // then casuals (no contracted hours to protect), then whoever is
      // least over. Rest and under-18 rules respected, never a shift
      // under four hours.
      const { addStart, addEnd } = win;
      const candidates = addCandidates(day, addStart, addEnd);
      const pick = candidates[0];
      if (!pick) continue;
      const area = area0;
      const stationId = station0;
      const id = nextId();
      proposals.push({
        id,
        alternatives: candidates.slice(1, 3).map((c, i) => addAlt(`${id}-a${i + 1}`, c.p, day, addStart, addEnd, area, stationId, false)),
        kind: 'add',
        tag: why.tag,
        personId: pick.p.id,
        personName: pick.p.name,
        day,
        area,
        stationId,
        after: { start: addStart, end: addEnd },
        title: `Add ${pick.p.name}, ${day} ${hhmm(addStart)} to ${hhmm(addEnd)}`,
        reason: why.reason,
        evidence: why.evidence,
        defaultSelected: true,
        hoursDelta: shiftHours(withBreak({ id: '', personId: '', day, start: addStart, end: addEnd, area })),
      });
      working.push(withBreak({ id: `w-add-${n}`, personId: pick.p.id, day, start: addStart, end: addEnd, area, stationId }));
      addedToday.push({ start: addStart, end: addEnd });
    }

    // Idle: long runs with a spare head. Remove a non-keyholder shift
    // that sits wholly inside the run, or trim the tail of the shift
    // that ends with it. One edit per run: smallest set, not cleanest.
    const after = analyseDay(site, working, day);
    const idleRuns = runs(after.points, (p) => p.rostered - p.required >= 1)
      .filter((r) => r.slots >= MIN_IDLE_SLOTS)
      // An add sized to the four-hour minimum can leave a spare head
      // either side of the gap it closed. That is the cost of the add,
      // not a second problem.
      .filter((r) => !addedToday.some((a) => a.start < r.end && a.end > r.start));
    for (const run of idleRuns) {
      const dayShifts = working.filter((s) => s.day === day);
      const heads = headsAt(after, run.start);
      const sig = signalFor(site, day, run.start, run.end);

      const whollyAll = dayShifts
        .filter((s) => s.start >= run.start - SLOT_MIN && s.end <= run.end + SLOT_MIN)
        .map((s) => ({ s, p: byPerson.get(s.personId)! }))
        .filter(({ p }) => !p.keyholder)
        .sort((a, b) => shiftHours(b.s) - shiftHours(a.s));
      const wholly = whollyAll[0];
      if (wholly) {
        const { s, p } = wholly;
        const under = underAfter(p, weeklyHours(working, p.id) - shiftHours(s));
        const strains = !!contractRule && under > UNTICK_UNDER_CONTRACT_HOURS;
        const id = nextId();
        const alternatives: Alternative[] = [];
        // Keep the busiest part of the shift rather than all of it.
        if (s.end - s.start >= 6 * 60) {
          const keepEnd = s.start + MIN_ADD_MIN;
          const cut = (s.end - keepEnd) / 60;
          const underKeep = underAfter(p, weeklyHours(working, p.id) - cut);
          alternatives.push({
            id: `${id}-a1`,
            kind: 'amend',
            personId: p.id,
            personName: p.name,
            day,
            area: s.area,
            stationId: s.stationId,
            before: { start: s.start, end: s.end },
            after: { start: s.start, end: keepEnd },
            title: `${p.name} finishes ${hhmm(keepEnd)} on ${day}, not ${hhmm(s.end)}`,
            evidence: `Cuts ${cut}h, not ${shiftHours(s)}h. ${ordinalWord(heads)} head stays ${hhmm(s.start)} to ${hhmm(keepEnd)}`,
            hoursDelta: -cut,
            warning: underKeep > 0 ? `Leaves ${p.name} ${underKeep}h under contract` : undefined,
          });
        }
        // Or drop someone else's shift in the same run.
        const other = whollyAll[1];
        if (other) {
          const underOther = underAfter(other.p, weeklyHours(working, other.p.id) - shiftHours(other.s));
          alternatives.push({
            id: `${id}-a2`,
            kind: 'remove',
            personId: other.p.id,
            personName: other.p.name,
            day,
            area: other.s.area,
            stationId: other.s.stationId,
            before: { start: other.s.start, end: other.s.end },
            title: `Drop ${other.p.name}'s ${day} ${hhmm(other.s.start)} to ${hhmm(other.s.end)}`,
            evidence: underOther > 0 ? `Leaves ${other.p.name} ${underOther}h under contract` : standing(other.p),
            hoursDelta: -shiftHours(other.s),
            warning: underOther > 0 ? `Leaves ${other.p.name} ${underOther}h under contract` : undefined,
          });
        }
        proposals.push({
          id,
          alternatives,
          kind: 'remove',
          tag: 'demand',
          personId: p.id,
          personName: p.name,
          day,
          area: s.area,
          stationId: s.stationId,
          before: { start: s.start, end: s.end },
          title: `Drop ${p.name}'s ${day} ${hhmm(s.start)} to ${hhmm(s.end)}`,
          reason: `${ordinalWord(heads).toLowerCase()} ${heads === 2 ? 'person' : 'closer'} not needed`,
          evidence: sig
            ? `${sig.evidence}. ${ordinalWord(heads)} person not needed against covers ${hhmm(run.start)} to ${hhmm(run.end)}`
            : `${ordinalWord(heads)} person not needed against covers ${hhmm(run.start)} to ${hhmm(run.end)}`,
          defaultSelected: !strains,
          hoursDelta: -shiftHours(s),
          ruleId: under > 0 && contractRule ? contractRule.id : undefined,
          warning: under > 0 ? `Leaves ${p.name} ${under}h under contract` : undefined,
        });
        if (!strains) working = working.filter((w) => w.id !== s.id);
        continue;
      }

      // Tail trim: the shift ends with the run, the run sits in the
      // shift's second half, the cut is three hours or less.
      const trimAll = dayShifts
        .filter((s) => Math.abs(s.end - run.end) <= SLOT_MIN && run.start > s.start + (s.end - s.start) / 2)
        .filter((s) => roundUpHour(run.start) < s.end && s.end - roundUpHour(run.start) <= 3 * 60)
        .map((s) => ({ s, p: byPerson.get(s.personId)! }))
        .filter(({ p }) => !p.keyholder)
        .sort((a, b) => (b.s.end - run.start) - (a.s.end - run.start));
      const trim = trimAll[0];
      if (trim) {
        const { s, p } = trim;
        const newEnd = roundUpHour(run.start);
        const cut = (s.end - newEnd) / 60;
        const under = underAfter(p, weeklyHours(working, p.id) - cut);
        const strains = !!contractRule && under > UNTICK_UNDER_CONTRACT_HOURS;
        const id = nextId();
        const alternatives: Alternative[] = [];
        // Somebody else who is also on to the end of the run.
        const other = dayShifts
          .filter((o) => o.id !== s.id && o.end >= s.end - SLOT_MIN && o.start < newEnd)
          .map((o) => ({ s: o, p: byPerson.get(o.personId)! }))
          .filter(({ p: q }) => !q.keyholder && !(q.age !== undefined && q.age < 18))
          .sort((a, b) => weeklyHours(working, b.p.id) - b.p.contractedHours - (weeklyHours(working, a.p.id) - a.p.contractedHours))[0];
        if (other) {
          const oEnd = Math.min(newEnd, other.s.end);
          const oCut = (other.s.end - oEnd) / 60;
          const underOther = underAfter(other.p, weeklyHours(working, other.p.id) - oCut);
          if (oCut > 0 && oEnd - other.s.start >= MIN_ADD_MIN) {
            alternatives.push({
              id: `${id}-a1`,
              kind: 'amend',
              personId: other.p.id,
              personName: other.p.name,
              day,
              area: other.s.area,
              stationId: other.s.stationId,
              before: { start: other.s.start, end: other.s.end },
              after: { start: other.s.start, end: oEnd },
              title: `${other.p.name} finishes ${hhmm(oEnd)} on ${day}, not ${hhmm(other.s.end)}`,
              evidence: underOther > 0 ? `Leaves ${other.p.name} ${underOther}h under contract` : standing(other.p),
              hoursDelta: -oCut,
              warning: underOther > 0 ? `Leaves ${other.p.name} ${underOther}h under contract` : undefined,
            });
          }
        }
        // A smaller cut.
        if (cut >= 2) {
          const softEnd = s.end - 60;
          const underSoft = underAfter(p, weeklyHours(working, p.id) - 1);
          alternatives.push({
            id: `${id}-a2`,
            kind: 'amend',
            personId: p.id,
            personName: p.name,
            day,
            area: s.area,
            stationId: s.stationId,
            before: { start: s.start, end: s.end },
            after: { start: s.start, end: softEnd },
            title: `${p.name} finishes ${hhmm(softEnd)} on ${day}, not ${hhmm(s.end)}`,
            evidence: `Cuts 1h, not ${cut}h. ${heads} still on until ${hhmm(softEnd)}`,
            hoursDelta: -1,
            warning: underSoft > 0 ? `Leaves ${p.name} ${underSoft}h under contract` : undefined,
          });
        }
        proposals.push({
          id,
          alternatives,
          kind: 'amend',
          tag: 'demand',
          personId: p.id,
          personName: p.name,
          day,
          area: s.area,
          stationId: s.stationId,
          before: { start: s.start, end: s.end },
          after: { start: s.start, end: newEnd },
          title: `${p.name} finishes ${hhmm(newEnd)} on ${day}, not ${hhmm(s.end)}`,
          reason: sig ? `forecast ${sig.pct}` : `idle after ${hhmm(newEnd)}`,
          evidence: sig
            ? `${sig.evidence}, ${heads} staff on after ${hhmm(newEnd)} for ${heads - 1}`
            : `${heads} staff on after ${hhmm(newEnd)}, workload needs ${heads - 1}`,
          defaultSelected: !strains,
          hoursDelta: -cut,
          ruleId: under > 0 && contractRule ? contractRule.id : undefined,
          warning: under > 0 ? `Leaves ${p.name} ${under}h under contract` : undefined,
        });
        if (!strains) {
          s.end = newEnd;
          Object.assign(s, withBreak(s));
        }
      }
    }
  }

  return proposals;
}

function ordinalWord(n: number): string {
  return ['Zeroth', 'First', 'Second', 'Third', 'Fourth', 'Fifth'][n] ?? `${n}th`;
}

// ─── Tiles and guide ────────────────────────────────────────────────────────

export function totalHours(shifts: Shift[]): number {
  return Math.round(shifts.reduce((a, s) => a + shiftHours(s), 0) * 10) / 10;
}

/** Hours and cost rostered on one day, from the shifts as ticked. */
export function dayTotals(shifts: Shift[], day: DayKey, hourlyCostGBP: number): { hours: number; costGBP: number } {
  const hours = totalHours(shifts.filter((s) => s.day === day));
  return { hours, costGBP: Math.round(hours * hourlyCostGBP) };
}

export function weekSalesGBP(site: SiteLabourData): number {
  return DAY_KEYS.reduce((a, d) => a + analyseDay(site, [], d).salesGBP, 0);
}

export function labourPct(draft: DeputyDraft, site: SiteLabourData, shifts: Shift[]): number {
  const sales = weekSalesGBP(site);
  if (sales <= 0) return 0;
  return Math.round(((totalHours(shifts) * draft.hourlyCostGBP) / sales) * 1000) / 10;
}

export function computeTiles(
  result: RebalanceResult,
  selected: Set<string>,
  chosen?: Map<string, string>,
): { tiles: Tiles; shifts: Shift[]; analysis: DayAnalysis[]; rules: RuleResult[] } {
  const { draft, site } = result;
  const proposals = result.proposals.map((p) => effectiveProposal(p, chosen));
  // A plan is whole: its shifts are the truth, not the draft plus edits.
  const shifts = 'planned' in result && result.planned ? (result as PlanResult).plannedShifts : applyProposals(draft.shifts, proposals, selected);
  const analysis = analyseWeek(site, shifts);
  const rules = checkRules(draft, shifts);
  const hours = totalHours(shifts);
  const beforeHours = totalHours(draft.shifts);
  const pct = labourPct(draft, site, shifts);
  const target = result.requestedTargetPct ?? site.targetLabourPct;

  let constraintLine: string | undefined;
  if (pct > target) {
    const sales = weekSalesGBP(site);
    const hoursOut = Math.ceil(((pct - target) / 100) * sales / draft.hourlyCostGBP);
    // Cheapest honest route under target: the unticked remove with the
    // most hours, or otherwise the shortest single shift that covers it.
    const unticked = proposals.filter((p) => !selected.has(p.id) && p.hoursDelta < 0).sort((a, b) => a.hoursDelta - b.hoursDelta)[0];
    if (unticked) {
      constraintLine = `${pct}% is the lowest without a rule breach. Under ${target}% needs ${hoursOut}h out: ticking "${unticked.title}" does it and ${unticked.warning ? unticked.warning.charAt(0).toLowerCase() + unticked.warning.slice(1) : 'breaks a rule'}.`;
    } else {
      const candidate = shifts
        .map((s) => ({ s, p: draft.people.find((x) => x.id === s.personId)! }))
        .filter(({ s }) => shiftHours(s) >= hoursOut)
        .sort((a, b) => shiftHours(a.s) - shiftHours(b.s))[0];
      constraintLine = candidate
        ? `${pct}% is the lowest without a rule breach. Under ${target}% needs ${hoursOut}h out: dropping ${candidate.p.name}'s ${candidate.s.day} takes them below contracted hours.`
        : `${pct}% is the lowest without a rule breach. Under ${target}% needs ${hoursOut}h out and no single shift covers it.`;
    }
  }

  return {
    tiles: {
      scheduledHours: hours,
      hoursDelta: Math.round((hours - beforeHours) * 10) / 10,
      labourPct: pct,
      targetPct: target,
      peakGaps: countPeakGaps(analysis),
      peakGapsBefore: countPeakGaps(result.before),
      constraintLine,
    },
    shifts,
    analysis,
    rules,
  };
}

export function labourGuide(site: SiteLabourData, shifts: Shift[]): LabourGuideRow[] {
  return DAY_KEYS.map((day) => {
    const a = analyseDay(site, shifts, day);
    const byDayPart = DAY_PARTS.map((dp) => {
      const pts = a.points.filter((p) => p.min >= dp.start && p.min < dp.end);
      const guideHours = Math.round(pts.reduce((s, p) => s + p.required, 0) * (SLOT_MIN / 60) * 2) / 2;
      const rosteredHours = Math.round(pts.reduce((s, p) => s + p.rostered, 0) * (SLOT_MIN / 60) * 2) / 2;
      return { dayPart: dp.name, guideHours, rosteredHours };
    });
    return {
      day,
      byDayPart,
      guideHours: byDayPart.reduce((s, r) => s + r.guideHours, 0),
      rosteredHours: byDayPart.reduce((s, r) => s + r.rosteredHours, 0),
    };
  });
}

// ─── Explain the forecast ───────────────────────────────────────────────────

/** Why the day's forecast is what it is, and how it turns into hours.
 *  Everything here is read from the site data, so the card can show the
 *  provenance of each number rather than assert precision it lacks. */
export function explainDay(site: SiteLabourData, day: DayKey): ForecastExplanation {
  const a = analyseDay(site, [], day);
  const base = daySalesGBP(site, day);
  const { open, close } = hoursFor(site, day);
  const transactions = a.salesGBP / site.avgTicketGBP;
  const hsu = humanSecondsPerUnit(site);
  const salesHours = (transactions * hsu) / 3600 / UTILISATION;
  const tasks = tasksOn(site, day);
  const taskHours = tasks.reduce((s, t) => s + t.humanMinutes, 0) / 60 / UTILISATION;
  const guideHours = Math.round(a.points.reduce((s, p) => s + p.required, 0) * (SLOT_MIN / 60) * 2) / 2;
  const peak = a.points.reduce((best, p) => (p.required > best.required ? p : best), a.points[0]);
  const peakHour = Math.floor(peak.min / 60) * 60;
  return {
    day,
    open,
    close,
    salesGBP: a.salesGBP,
    baseGBP: base,
    adjustPct: base > 0 ? Math.round(((a.salesGBP - base) / base) * 100) : 0,
    transactions: Math.round(transactions),
    signals: site.signals[day] ?? [],
    tasks,
    standards: site.standards,
    humanSecondsPerTransaction: Math.round(hsu),
    salesHours: Math.round(salesHours * 2) / 2,
    taskHours: Math.round(taskHours * 2) / 2,
    floorHours: Math.round(((close - open) / 60) * site.floorMinimum * 2) / 2,
    guideHours,
    peak: { start: peakHour, end: peakHour + 60, heads: peak.required },
  };
}

// ─── Capacity ───────────────────────────────────────────────────────────────

/** Machine load over capacity means a queue no extra head clears. */
const CAPACITY_LIMIT = 1;

/**
 * Windows where a machine station runs over capacity. Machine load
 * depends on sales and fixed tasks, not on who is rostered, so these
 * notes do not move when proposals are ticked. They sit beside the
 * proposals so the GM does not add a body to a queue the kit created.
 */
export function capacityNotes(site: SiteLabourData, analysis: DayAnalysis[]): CapacityNote[] {
  const notes: CapacityNote[] = [];
  for (const a of analysis) {
    const machines = a.stations.filter((s) => s.hasMachine);
    if (machines.length === 0) continue;
    // Over capacity on any machine, slot by slot.
    const points: SlotPoint[] = machines[0].points.map((p, i) => {
      const load = Math.max(...machines.map((m) => m.points[i]?.machineLoad ?? 0));
      return { min: p.min, required: load, rostered: CAPACITY_LIMIT };
    });
    for (const run of runs(points, (p) => p.required > p.rostered).filter((r) => r.slots >= MIN_GAP_SLOTS)) {
      const peak = Math.max(...points.filter((p) => p.min >= run.start && p.min < run.end).map((p) => p.required));
      const hot = machines.filter((m) => m.points.some((p) => p.min >= run.start && p.min < run.end && (p.machineLoad ?? 0) > CAPACITY_LIMIT));
      const order = tasksOn(site, a.day).find((t) => t.source === 'order' && t.start < run.end + 60 && t.end > run.start - 60);
      const sig = signalFor(site, a.day, run.start, run.end);
      const driver = order ? order.evidence : sig ? sig.evidence : undefined;
      const advice = order
        ? `A head will not clear it. Brew the ${order.label.split(',')[0].toLowerCase()} before ${hhmm(order.start)}.`
        : 'A head will not clear it. Pre-brew into the window or accept the queue.';
      notes.push({ day: a.day, start: run.start, end: run.end, stationNames: hot.map((m) => m.stationName), peakLoad: peak, driver, advice });
    }
  }
  return notes;
}

// ─── Entry ──────────────────────────────────────────────────────────────────

export function rebalance(draft: DeputyDraft, site: SiteLabourData, requestedTargetPct?: number): RebalanceResult {
  const before = analyseWeek(site, draft.shifts);
  const rulesBefore = checkRules(draft, draft.shifts);
  const proposals = propose(draft, site);
  const guide = labourGuide(site, draft.shifts);
  const capacity = capacityNotes(site, before);
  return { draft, site, requestedTargetPct, proposals, before, rulesBefore, guide, capacity };
}

// ─── Plan from scratch ──────────────────────────────────────────────────────

/** Longest shift the planner writes. */
const MAX_PLAN_SHIFT_MIN = 9 * 60;

const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/**
 * Build the week from the forecast and the team, with the GM's shifts
 * set aside. Monday to Sunday, each day the same way: find the earliest
 * cover gap, extend a shift that already ends or starts there if that
 * closes it, otherwise add the person furthest under contract who passes
 * the rules. Openers and closers are keyholders where the team has one.
 * Repeat until the day has no gap or nobody can take it.
 *
 * Deterministic: the same draft and site give the same plan.
 */
export function planWeek(draft: DeputyDraft, site: SiteLabourData, requestedTargetPct?: number): PlanResult {
  const byPerson = new Map<string, Person>(draft.people.map((p) => [p.id, p]));
  const restHours = draft.rules.find((r) => r.kind === 'rest-between-shifts')?.value;
  const u18Rule = draft.rules.find((r) => r.kind === 'under18-latest-finish');
  const u18DailyRule = draft.rules.find((r) => r.kind === 'under18-max-daily-hours');
  const weeklyCap = draft.rules.find((r) => r.kind === 'weekly-average')?.value;
  const hasKeyholders = draft.people.some((p) => p.keyholder);

  const planned: Shift[] = [];
  const why = new Map<string, string>();
  const unfilled: UnfilledWindow[] = [];
  let n = 0;

  /** Nobody on a contract is planned far past it: a fifth over, or a
   *  day's worth, whichever is more. Lifted only when nobody else fits. */
  const softCap = (p: Person) => (p.contractedHours > 0 ? Math.max(p.contractedHours * 1.2, p.contractedHours + 8) : Infinity);

  const fits = (p: Person, day: DayKey, start: number, end: number, strict: boolean): boolean => {
    if (!personAvailable(p, day, planned)) return false;
    if (p.age !== undefined && p.age < 18) {
      if (u18Rule && end > u18Rule.value) return false;
      if (u18DailyRule && end - start > u18DailyRule.value * 60) return false;
    }
    if (!restOk(planned, restHours, p.id, day, start, end)) return false;
    const hours = shiftHours(withBreak({ id: '', personId: p.id, day, start, end, area: '' }));
    const after = weeklyHours(planned, p.id) + hours;
    if (weeklyCap !== undefined && after > weeklyCap) return false;
    if (strict && after > softCap(p)) return false;
    return true;
  };

  /** Best person for a window: under contract first, then casual, then
   *  least over. Keyholders first when the window opens or closes. */
  const pickFor = (day: DayKey, start: number, end: number, needKeyholder: boolean): Person | undefined => {
    const strictList = rank(day, start, end, true);
    if (needKeyholder) {
      // A keyholder a little over the soft cap beats no keyholder; one
      // heading for the legal limit does not.
      const kh =
        strictList.find((c) => c.p.keyholder) ??
        rank(day, start, end, false).find((c) => c.p.keyholder && weeklyHours(planned, c.p.id) + (end - start) / 60 <= c.p.contractedHours + 8);
      if (kh) return kh.p;
    }
    return strictList[0]?.p ?? rank(day, start, end, false)[0]?.p;
  };

  const rank = (day: DayKey, start: number, end: number, strict: boolean) =>
    draft.people
      .filter((p) => fits(p, day, start, end, strict))
      .map((p) => {
        const slack = p.contractedHours - weeklyHours(planned, p.id);
        const tier = slack > 0 ? 0 : p.contractedHours === 0 ? 1 : 2;
        // Share of contract still to fill, so a 20h contract is not
        // starved by a 38h one that always has more hours left.
        const share = p.contractedHours > 0 ? slack / p.contractedHours : 0;
        return { p, slack, share, tier };
      })
      .sort((a, b) => a.tier - b.tier || b.share - a.share || b.slack - a.slack || a.p.name.localeCompare(b.p.name));

  /** Station with the biggest shortfall in the window. */
  const stationFor = (a: DayAnalysis, start: number, end: number): string | undefined => {
    let best: { id: string; short: number } | undefined;
    for (const st of a.stations) {
      const short = st.points.filter((p) => p.min >= start && p.min < end).reduce((acc, p) => acc + Math.max(0, p.required - p.rostered), 0);
      if (!best || short > best.short) best = { id: st.stationId, short };
    }
    return best?.id;
  };

  const keyholderOn = (day: DayKey, at: number) => planned.some((s) => s.day === day && s.start <= at && at < s.end && byPerson.get(s.personId)?.keyholder);

  for (const day of DAY_KEYS) {
    const { open, close } = hoursFor(site, day);
    const attempted = new Map<number, number>();
    for (let guard = 0; guard < 40; guard++) {
      const analysis = analyseDay(site, planned, day);
      const run = runs(analysis.points, (p) => p.required > p.rostered)
        .filter((r) => r.slots >= MIN_GAP_SLOTS)
        .find((r) => (attempted.get(r.start) ?? 0) < 4);
      if (!run) break;
      attempted.set(run.start, (attempted.get(run.start) ?? 0) + 1);

      const start = roundDownHour(run.start);
      const end = roundUpHour(run.end);
      const reason = `Workload needs ${Math.ceil(run.depth)} more from ${hhmm(run.start)} to ${hhmm(run.end)}`;
      const dayShifts = planned.filter((s) => s.day === day);

      // Extend a shift that ends at the gap, or starts at its end.
      const endsBefore = dayShifts
        .filter((s) => s.end <= start && start - s.end <= 60 && end - s.start <= MAX_PLAN_SHIFT_MIN)
        .filter((s) => {
          const p = byPerson.get(s.personId)!;
          const others = planned.filter((x) => x !== s);
          if (p.age !== undefined && p.age < 18 && ((u18Rule && end > u18Rule.value) || (u18DailyRule && end - s.start > u18DailyRule.value * 60))) return false;
          if (!restOk(others, restHours, p.id, day, s.start, end)) return false;
          const grown = shiftHours(withBreak({ ...s, end })) - shiftHours(s);
          return weeklyCap === undefined || weeklyHours(planned, p.id) + grown <= weeklyCap;
        })
        .sort((a, b) => b.end - a.end)[0];
      if (endsBefore) {
        endsBefore.end = Math.min(end, close);
        Object.assign(endsBefore, withBreak(endsBefore));
        why.set(endsBefore.id, `${why.get(endsBefore.id) ?? ''}. Then ${lower(reason)}`);
        continue;
      }
      const startsAfter = dayShifts
        .filter((s) => s.start >= end && s.start - end <= 60 && s.end - start <= MAX_PLAN_SHIFT_MIN)
        .filter((s) => {
          const p = byPerson.get(s.personId)!;
          const others = planned.filter((x) => x !== s);
          if (p.age !== undefined && p.age < 18 && u18DailyRule && s.end - start > u18DailyRule.value * 60) return false;
          if (!restOk(others, restHours, p.id, day, start, s.end)) return false;
          const grown = shiftHours(withBreak({ ...s, start })) - shiftHours(s);
          return weeklyCap === undefined || weeklyHours(planned, p.id) + grown <= weeklyCap;
        })
        .sort((a, b) => a.start - b.start)[0];
      if (startsAfter) {
        startsAfter.start = Math.max(start, open);
        Object.assign(startsAfter, withBreak(startsAfter));
        why.set(startsAfter.id, `${reason}. Then ${lower(why.get(startsAfter.id) ?? '')}`);
        continue;
      }

      // Otherwise a new shift over the gap: at least four hours, at most
      // nine, inside opening hours.
      let addStart = Math.max(open, start);
      let addEnd = Math.min(close, Math.max(end, addStart + MIN_ADD_MIN), addStart + MAX_PLAN_SHIFT_MIN);
      if (addEnd - addStart < MIN_ADD_MIN) addStart = Math.max(open, addEnd - MIN_ADD_MIN);
      if (addEnd - addStart < MIN_ADD_MIN) addEnd = Math.min(close, addStart + MIN_ADD_MIN);

      const opensOrCloses = addStart <= open || addEnd >= close;
      const needKeyholder = hasKeyholders && opensOrCloses && !((addStart <= open && keyholderOn(day, open)) || (addEnd >= close && keyholderOn(day, close - SLOT_MIN)));
      let pick = pickFor(day, addStart, addEnd, needKeyholder);
      // An under-18 cannot close; shorten to their latest finish if that
      // still covers a real shift, else look past them.
      if (pick && pick.age !== undefined && pick.age < 18 && u18Rule && addEnd > u18Rule.value) {
        const adults = draft.people.filter((p) => !(p.age !== undefined && p.age < 18));
        pick = adults.find((p) => fits(p, day, addStart, addEnd, true)) ?? adults.find((p) => fits(p, day, addStart, addEnd, false));
      }
      if (!pick) {
        unfilled.push({ day, start: run.start, end: run.end, depth: Math.ceil(run.depth) });
        continue;
      }
      const id = `plan-${++n}`;
      const area = addStart < 12 * 60 ? draft.areas[0] : draft.areas[draft.areas.length - 1];
      planned.push(withBreak({ id, personId: pick.id, day, start: addStart, end: addEnd, area, stationId: stationFor(analysis, addStart, addEnd) }));
      why.set(id, reason);
    }

    // Trim: a four-hour minimum shift added for a short peak can leave a
    // spare head either side of it. Take whole idle hours off the ends
    // of the day's shifts, latest finish first, never under four hours.
    for (let guard = 0; guard < 40; guard++) {
      const analysis = analyseDay(site, planned, day);
      const idleHour = (from: number) => {
        const pts = analysis.points.filter((p) => p.min >= from && p.min < from + 60);
        return pts.length === 4 && pts.every((p) => p.rostered - p.required >= 1);
      };
      // The only keyholder at open or close stays put.
      const soleKeyholder = (s: Shift, at: number) =>
        !!byPerson.get(s.personId)?.keyholder && !planned.some((x) => x !== s && x.day === day && x.start <= at && at < x.end && byPerson.get(x.personId)?.keyholder);
      const dayShifts = planned.filter((s) => s.day === day && s.end - s.start > MIN_ADD_MIN);
      const tail = dayShifts
        .filter((s) => idleHour(s.end - 60) && !(s.end >= close && soleKeyholder(s, close - SLOT_MIN)))
        .sort((a, b) => b.end - a.end)[0];
      if (tail) {
        tail.end -= 60;
        Object.assign(tail, withBreak({ ...tail, breakMin: undefined }));
        continue;
      }
      const head = dayShifts
        .filter((s) => idleHour(s.start) && !(s.start <= open && soleKeyholder(s, open)))
        .sort((a, b) => a.start - b.start)[0];
      if (head) {
        head.start += 60;
        Object.assign(head, withBreak({ ...head, breakMin: undefined }));
        continue;
      }
      break;
    }
  }

  // A window recorded as unfilled may have been covered by a later
  // extension; keep only the ones still short.
  const finalAnalysis = analyseWeek(site, planned);
  const notes: string[] = [];
  if (hasKeyholders) {
    for (const day of DAY_KEYS) {
      const { open, close } = hoursFor(site, day);
      const noOpen = !keyholderOn(day, open);
      const noClose = !keyholderOn(day, close - SLOT_MIN);
      if (noOpen && noClose) notes.push(`${day}: no keyholder on to open or close`);
      else if (noOpen) notes.push(`${day}: no keyholder on at ${hhmm(open)} open`);
      else if (noClose) notes.push(`${day}: no keyholder on at ${hhmm(close)} close`);
    }
  }
  const stillShort = unfilled.filter((u) => {
    const a = finalAnalysis.find((x) => x.day === u.day)!;
    return a.points.some((p) => p.min >= u.start && p.min < u.end && p.required > p.rostered);
  });
  const dedup = new Map<string, UnfilledWindow>();
  for (const u of stillShort) dedup.set(`${u.day}-${u.start}`, u);

  // The plan as the difference from the GM's draft, so the grid, tiles
  // and receipt read it the way they read a rebalance.
  const proposals: Proposal[] = [];
  let k = 0;
  for (const p of draft.people) {
    for (const day of DAY_KEYS) {
      const was = draft.shifts.filter((s) => s.personId === p.id && s.day === day).sort((a, b) => a.start - b.start);
      const now = planned.filter((s) => s.personId === p.id && s.day === day).sort((a, b) => a.start - b.start);
      const m = Math.max(was.length, now.length);
      for (let i = 0; i < m; i++) {
        const b = was[i];
        const a = now[i];
        if (b && a && b.start === a.start && b.end === a.end) continue;
        const id = `plan-diff-${++k}`;
        if (b && a) {
          proposals.push({
            id,
            kind: 'amend',
            tag: 'demand',
            personId: p.id,
            personName: p.name,
            day,
            area: a.area,
            stationId: a.stationId,
            before: { start: b.start, end: b.end },
            after: { start: a.start, end: a.end },
            title: `${p.name} works ${hhmm(a.start)} to ${hhmm(a.end)} on ${day}, not ${hhmm(b.start)} to ${hhmm(b.end)}`,
            reason: 'plan',
            evidence: why.get(a.id) ?? 'Moved to where the work is',
            defaultSelected: true,
            hoursDelta: Math.round((shiftHours(a) - shiftHours(b)) * 10) / 10,
          });
        } else if (a) {
          proposals.push({
            id,
            kind: 'add',
            tag: 'demand',
            personId: p.id,
            personName: p.name,
            day,
            area: a.area,
            stationId: a.stationId,
            after: { start: a.start, end: a.end },
            title: `Add ${p.name}, ${day} ${hhmm(a.start)} to ${hhmm(a.end)}`,
            reason: 'plan',
            evidence: why.get(a.id) ?? 'Covers the workload',
            defaultSelected: true,
            hoursDelta: shiftHours(a),
          });
        } else if (b) {
          proposals.push({
            id,
            kind: 'remove',
            tag: 'demand',
            personId: p.id,
            personName: p.name,
            day,
            area: b.area,
            stationId: b.stationId,
            before: { start: b.start, end: b.end },
            title: `${p.name} off on ${day}`,
            reason: 'plan',
            evidence: 'The workload is covered without this shift',
            defaultSelected: true,
            hoursDelta: -shiftHours(b),
          });
        }
      }
    }
  }

  const before = analyseWeek(site, draft.shifts);
  return {
    planned: true,
    plannedShifts: planned,
    unfilled: [...dedup.values()],
    notes,
    draft,
    site,
    requestedTargetPct,
    proposals,
    before,
    rulesBefore: checkRules(draft, draft.shifts),
    guide: labourGuide(site, planned),
    capacity: capacityNotes(site, finalAnalysis),
  };
}

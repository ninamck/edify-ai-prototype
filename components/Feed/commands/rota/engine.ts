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
  type DayAnalysis,
  type DayKey,
  type DeputyDraft,
  type FixedTask,
  type FixedTaskSource,
  type ForecastExplanation,
  type LabourGuideRow,
  type Person,
  type Proposal,
  type ProposalTag,
  type RebalanceResult,
  type RuleResult,
  type Shift,
  type SiteLabourData,
  type SlotPoint,
  type StationCurve,
  type Tiles,
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

export function applyProposals(shifts: Shift[], proposals: Proposal[], selected: Set<string>): Shift[] {
  let out = shifts.map((s) => ({ ...s }));
  for (const p of proposals) {
    if (!selected.has(p.id)) continue;
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
      proposals.push({
        id: nextId(),
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
    const attempted = new Set<number>();
    for (let guard = 0; guard < 12; guard++) {
      const analysis = analyseDay(site, working, day);
      const run = runs(analysis.points, (p) => p.required > p.rostered)
        .filter((r) => r.slots >= MIN_GAP_SLOTS)
        .find((r) => !attempted.has(r.start));
      if (!run) break;
      attempted.add(run.start);
      const start = roundDownHour(run.start);
      const end = roundUpHour(run.end);
      const task = fixedTaskFor(site, day, run.start, run.end);
      const sig = signalFor(site, day, run.start, run.end);
      const openedByFix = proposals.find(
        (p) => p.tag === 'rule-fix' && p.day === day && p.before && p.after && p.before.end > run.start && p.after.end <= run.start,
      );
      const why = task
        ? { reason: task.label.toLowerCase(), evidence: task.evidence, tag: tagForTask(task.source) }
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

      if (endsBefore) {
        const p = byPerson.get(endsBefore.personId)!;
        // Extending a shift this pass added is one proposal, not two.
        const ownAdd = endsBefore.id.startsWith('w-add-')
          ? proposals.find((x) => x.kind === 'add' && x.personId === p.id && x.day === day && x.after?.start === endsBefore.start)
          : undefined;
        if (ownAdd && ownAdd.after) {
          ownAdd.after = { start: ownAdd.after.start, end };
          ownAdd.title = `Add ${p.name}, ${day} ${hhmm(ownAdd.after.start)} to ${hhmm(end)}`;
          ownAdd.evidence = `${ownAdd.evidence}. Then ${why.evidence.charAt(0).toLowerCase()}${why.evidence.slice(1)}`;
          endsBefore.end = end;
          Object.assign(endsBefore, withBreak(endsBefore));
          ownAdd.hoursDelta = shiftHours(endsBefore);
          const a = addedToday.find((x) => x.start === endsBefore.start);
          if (a) a.end = end;
          continue;
        }
        proposals.push({
          id: nextId(),
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
        proposals.push({
          id: nextId(),
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

      // Otherwise add someone: most hours under contract first, rest
      // and under-18 rules respected, never a shift under four hours.
      const { open, close } = hoursFor(site, day);
      let addEnd = Math.min(close, Math.max(end, start + MIN_ADD_MIN));
      const addStart = Math.max(open, Math.min(start, addEnd - MIN_ADD_MIN));
      addEnd = Math.min(close, Math.max(addEnd, addStart + MIN_ADD_MIN));
      const candidates = draft.people
        .filter((p) => personAvailable(p, day, working))
        .filter((p) => !(p.age !== undefined && p.age < 18 && u18Rule && addEnd > u18Rule.value))
        .filter((p) => restOk(working, restHours, p.id, day, addStart, addEnd))
        .map((p) => ({ p, slack: p.contractedHours - weeklyHours(working, p.id) }))
        .sort((a, b) => b.slack - a.slack);
      const pick = candidates[0];
      if (!pick) continue;
      const area = addStart < 12 * 60 ? draft.areas[0] : draft.areas[draft.areas.length - 1];
      const stationId = task?.stationId ?? site.stations[0]?.id;
      proposals.push({
        id: nextId(),
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

      const wholly = dayShifts
        .filter((s) => s.start >= run.start - SLOT_MIN && s.end <= run.end + SLOT_MIN)
        .map((s) => ({ s, p: byPerson.get(s.personId)! }))
        .filter(({ p }) => !p.keyholder)
        .sort((a, b) => shiftHours(b.s) - shiftHours(a.s))[0];
      if (wholly) {
        const { s, p } = wholly;
        const under = underAfter(p, weeklyHours(working, p.id) - shiftHours(s));
        const strains = !!contractRule && under > UNTICK_UNDER_CONTRACT_HOURS;
        proposals.push({
          id: nextId(),
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
      const trim = dayShifts
        .filter((s) => Math.abs(s.end - run.end) <= SLOT_MIN && run.start > s.start + (s.end - s.start) / 2)
        .filter((s) => roundUpHour(run.start) < s.end && s.end - roundUpHour(run.start) <= 3 * 60)
        .map((s) => ({ s, p: byPerson.get(s.personId)! }))
        .filter(({ p }) => !p.keyholder)
        .sort((a, b) => (b.s.end - run.start) - (a.s.end - run.start))[0];
      if (trim) {
        const { s, p } = trim;
        const newEnd = roundUpHour(run.start);
        const cut = (s.end - newEnd) / 60;
        const under = underAfter(p, weeklyHours(working, p.id) - cut);
        const strains = !!contractRule && under > UNTICK_UNDER_CONTRACT_HOURS;
        proposals.push({
          id: nextId(),
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
): { tiles: Tiles; shifts: Shift[]; analysis: DayAnalysis[]; rules: RuleResult[] } {
  const { draft, site, proposals } = result;
  const shifts = applyProposals(draft.shifts, proposals, selected);
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

// ─── Entry ──────────────────────────────────────────────────────────────────

export function rebalance(draft: DeputyDraft, site: SiteLabourData, requestedTargetPct?: number): RebalanceResult {
  const before = analyseWeek(site, draft.shifts);
  const rulesBefore = checkRules(draft, draft.shifts);
  const proposals = propose(draft, site);
  const guide = labourGuide(site, draft.shifts);
  return { draft, site, requestedTargetPct, proposals, before, rulesBefore, guide };
}

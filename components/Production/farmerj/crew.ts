'use client';

import { useEffect, useMemo } from 'react';
import { FJ_DEMO_TODAY } from './calendar';
import { useFjClock } from './fjClock';
import { useFjPlanStore, type DayRecord, type MadeEntry } from './FjPlanStore';
import type { SectionsDay, SectionTask } from './sections';

/**
 * The modelled crew. Nobody has stood in the Marylebone kitchen ticking
 * tasks on this prototype, so a Record for yesterday would read as blank
 * and today would never fill in. The crew stands in for the people on the
 * benches: when a shop-day is on screen, every task whose finish time has
 * passed is ticked as made, by the person on that bench, at the time the
 * sheet says it came out.
 *
 *   Past days    every task is ticked; the day happened.
 *   Today        follows the kitchen clock on Sections. Play the clock
 *                forward and the Record fills in load by load. Rewind it
 *                and the crew's ticks come back off.
 *   Future days  nothing; the plan is still a plan.
 *
 * Rules:
 *  - A tick a person made on Sections is never touched. Only entries the
 *    crew wrote (`made.modelled`) are removed on a rewind.
 *  - `crewMins` on the record is a watermark. Tasks finishing before it
 *    were already offered once, so a task someone un-ticks stays un-ticked.
 *  - A task with a running timer, or one Ed has started by hand, is his to
 *    finish; the crew leaves it.
 *  - Made batches are the plan. About one cook load in nine on a past day
 *    comes out half a batch short, so the Record's "differs from plan"
 *    reading has something real to show.
 */

const END_OF_DAY = 24 * 60;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h >>> 0);
}

/** Minutes from midnight when the crew ticks this task: when a cook load
 *  is out of the oven, or when hands-on work ends, plus a few minutes for
 *  the person to get to the screen. */
export function crewDoneMins(task: SectionTask, seed: string): number {
  const finished = task.readyMins ?? task.startMins + task.durationMins;
  return finished + (hash(`${seed}|${task.id}|when`) % 9);
}

/** Batches the crew records as made. */
function crewBatches(task: SectionTask, seed: string): number {
  const planned = task.batches ?? 0;
  if (task.kind !== 'cook' || planned < 1) return planned;
  return hash(`${seed}|${task.id}|made`) % 9 === 0 ? planned - 0.5 : planned;
}

function minsOfISO(iso: string): number {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? Number(m[1]) * 60 + Number(m[2]) : END_OF_DAY;
}

function stamp(date: string, mins: number): string {
  const m = Math.max(0, Math.min(END_OF_DAY - 1, Math.round(mins)));
  return `${date}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
}

/**
 * The record after the crew has worked up to `uptoMins`. Returns null when
 * nothing needs to change, so callers can skip a store write.
 */
export function applyCrew(day: SectionsDay, record: DayRecord, uptoMins: number, skip: ReadonlySet<string>): DayRecord | null {
  const seed = `${day.shopId}|${day.date}`;
  const from = record.crewMins ?? -1;
  const ticks = { ...(record.ticks ?? {}) };
  const made = { ...(record.made ?? {}) };
  let changed = false;

  if (uptoMins < from) {
    // Clock rewound: the crew's ticks after the new time come off.
    for (const [id, entry] of Object.entries(made)) {
      if (!entry.modelled || minsOfISO(entry.atISO) <= uptoMins) continue;
      delete ticks[id];
      delete made[id];
      changed = true;
    }
  } else {
    const personOn = new Map(day.cards.map(c => [c.section.id, c.section.person]));
    for (const task of day.tasks) {
      if (ticks[task.id] || skip.has(task.id)) continue;
      const at = crewDoneMins(task, seed);
      if (at <= from || at > uptoMins) continue;
      const atISO = stamp(day.date, at);
      ticks[task.id] = atISO;
      const entry: MadeEntry = { batches: crewBatches(task, seed), by: personOn.get(task.sectionId) ?? '', atISO, modelled: true };
      made[task.id] = entry;
      changed = true;
    }
  }

  if (!changed && from === uptoMins) return null;
  return { ...record, ticks, made, crewMins: uptoMins };
}

/**
 * Keep the crew working on one shop-day while it is on screen. Mount it
 * wherever ticks are read for a day (Sections, Record). Reads the kitchen
 * clock for today; past days are finished in one pass.
 */
export function useModelledCrew(shopId: string, date: string, day: SectionsDay) {
  const store = useFjPlanStore();
  const clock = useFjClock();
  const record = store.get(shopId, date);
  const uptoMins = date < FJ_DEMO_TODAY ? END_OF_DAY : date === FJ_DEMO_TODAY ? clock.mins : undefined;
  const skip = useMemo(() => new Set([...Object.keys(clock.timers), ...clock.started]), [clock.timers, clock.started]);

  useEffect(() => {
    if (!store.hydrated || uptoMins === undefined) return;
    if (!applyCrew(day, record, uptoMins, skip)) return;
    store.update(shopId, date, r => applyCrew(day, r, uptoMins, skip) ?? r);
  }, [store, shopId, date, day, record, uptoMins, skip]);
}

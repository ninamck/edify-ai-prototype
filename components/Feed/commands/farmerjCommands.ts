/**
 * Farmer J chat commands. Only parsed when the active brand is Farmer J
 * (Feed checks `isFarmerJ` before calling), so the verbs here can be
 * plain kitchen language without fighting the menu-price parser.
 *
 *   "drop Saturday 20%"            → flex Saturday −20
 *   "reduce tomorrow by 15 percent" → flex tomorrow −15
 *   "increase today 10%"            → flex today +10
 *   "flex Friday down 25"           → flex Friday −25
 */

import { FJ_DAY_STRIP_DATES, FJ_DEMO_TODAY, addDays, weekdayOf } from '@/components/Production/farmerj/calendar';
import type { CommandIntent } from './types';

export type FjFlexArgs = {
  /** ISO date being flexed. */
  date?: string;
  /** Signed percentage: −20 drops the day a fifth. */
  pct?: number;
};

const DOWN = /\b(drop|reduce|cut|lower|down|less|take .* off)\b/i;
const UP = /\b(increase|raise|up|boost|more|add .* on)\b/i;
/** Monday = 0, matching `weekdayOf`. */
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Resolve "today", "tomorrow", a weekday name or an ISO date to a date in
 *  the planning strip. Weekdays resolve to the next occurrence from the
 *  demo today. */
export function resolveFjDay(word: string): string | undefined {
  const w = word.trim().toLowerCase();
  if (!w) return undefined;
  if (w === 'today') return FJ_DEMO_TODAY;
  if (w === 'tomorrow') return addDays(FJ_DEMO_TODAY, 1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return w;
  const idx = WEEKDAYS.findIndex(d => d.startsWith(w.slice(0, 3)));
  if (idx >= 0) {
    for (let i = 0; i < 8; i++) {
      const d = addDays(FJ_DEMO_TODAY, i);
      if (weekdayOf(d) === idx && FJ_DAY_STRIP_DATES.includes(d)) return d;
    }
  }
  return undefined;
}

export function parseFjFlex(text: string): CommandIntent | null {
  const t = text.trim();
  if (!t) return null;
  const slash = /^\/flex\b/i.test(t);
  const hasVerb = slash || /\b(flex|drop|reduce|cut|lower|increase|raise|boost)\b/i.test(t);
  if (!hasVerb) return null;

  const pctMatch = t.match(/(-?\d+(?:\.\d+)?)\s*(%|percent|per cent|pc)\b/i) ?? t.match(/\bby\s+(-?\d+(?:\.\d+)?)\b/i) ?? t.match(/\b(\d{1,2})\b(?!:)/);
  const magnitude = pctMatch ? Math.abs(Number(pctMatch[1])) : undefined;
  const dayWord = t.match(/\b(today|tomorrow|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|\d{4}-\d{2}-\d{2})\b/i)?.[1];
  const date = dayWord ? resolveFjDay(dayWord) : undefined;

  // A sentence about the plan needs at least a day or a percentage to be
  // a flex and not a price change or a stock line.
  if (!slash && !date && magnitude === undefined) return null;
  if (!slash && !date && !/\b(plan|production|day|flex)\b/i.test(t)) return null;

  const direction = DOWN.test(t) ? -1 : UP.test(t) ? 1 : -1;
  const pct = magnitude !== undefined ? direction * Math.min(60, magnitude) : undefined;
  const args: FjFlexArgs = { date, pct };
  return { commandId: 'fj-flex', args, confidence: slash ? 1 : date && pct !== undefined ? 0.95 : 0.75 };
}

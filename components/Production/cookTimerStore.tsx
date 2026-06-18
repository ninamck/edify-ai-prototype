'use client';

/**
 * cookTimerStore — live cook timers that outlive the stepper modal.
 *
 * When a crew member starts the Flame-broil (or Hold) timer in `StepperViewBK`
 * the timer has to keep running after they close the card — so the line screen
 * can show "Whopper patty · Flame-broil · 2:34" and, when it lands, "Ready —
 * into the cabinet". That means the timer can't be local modal state; it lives
 * here, keyed by recipe (one active cook step per component at a time).
 *
 * Timers run on the wall clock (real seconds), independent of the stepped demo
 * clock, so a started timer behaves like a real kitchen timer.
 */

import { useEffect, useState } from 'react';
import type { RecipeId } from './fixtures';

export type CookTimerStatus = 'running' | 'paused' | 'done';

export type CookTimer = {
  recipeId: RecipeId;
  /** Which step the timer belongs to — we key on the step label. */
  stepId: string;
  /** Human label of what the timer is doing, e.g. "Flame-broil". */
  label: string;
  totalSeconds: number;
  /** Wall-clock ms when it finishes (running only). */
  endsAt: number | null;
  /** Authoritative remaining ms while paused. */
  remainingMs: number;
  status: CookTimerStatus;
  /** Batch size — how many units this cook represents (for the line + cabinet). */
  qty: number;
  /** Wall-clock ms the cook finished, so the cabinet can age it. */
  doneAt: number | null;
};

let timers: Record<string, CookTimer> = {};
const listeners = new Set<() => void>();
let intervalId: number | null = null;

function emit() {
  for (const l of listeners) l();
}

function hasRunning(): boolean {
  return Object.values(timers).some(t => t.status === 'running');
}

function ensureTicking() {
  if (intervalId != null || typeof window === 'undefined') return;
  intervalId = window.setInterval(() => {
    const now = Date.now();
    let mutated = false;
    for (const key of Object.keys(timers)) {
      const t = timers[key];
      if (t.status === 'running' && t.endsAt != null && now >= t.endsAt) {
        // Cook complete — it leaves the broiler and lands in the cabinet.
        timers = {
          ...timers,
          [key]: { ...t, status: 'done', remainingMs: 0, endsAt: null, doneAt: now },
        };
        mutated = true;
      }
    }
    // Always emit so countdowns re-render each tick; stop once nothing runs.
    emit();
    if (!hasRunning() && intervalId != null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    void mutated;
  }, 250);
}

export function startCookTimer(
  recipeId: RecipeId,
  stepId: string,
  label: string,
  seconds: number,
  qty = 1,
) {
  timers = {
    ...timers,
    [recipeId]: {
      recipeId,
      stepId,
      label,
      totalSeconds: seconds,
      endsAt: Date.now() + seconds * 1000,
      remainingMs: seconds * 1000,
      status: 'running',
      qty,
      doneAt: null,
    },
  };
  ensureTicking();
  emit();
}

/**
 * Add units to a recipe's cook (a manual "large order just came in"):
 *  - if a cook is already on the line, bump its batch size so the extra units
 *    ride the same broiler pass;
 *  - otherwise start a fresh cook for the order.
 */
export function addToCookTimer(
  recipeId: RecipeId,
  stepId: string,
  label: string,
  seconds: number,
  qty: number,
) {
  const t = timers[recipeId];
  if (t && t.status !== 'done') {
    timers = { ...timers, [recipeId]: { ...t, qty: t.qty + qty } };
    emit();
    return;
  }
  startCookTimer(recipeId, stepId, label, seconds, qty);
}

/** Force a cook to finish now — the batch lands in the cabinet immediately. */
export function completeCookTimer(recipeId: RecipeId) {
  const t = timers[recipeId];
  if (!t || t.status === 'done') return;
  timers = {
    ...timers,
    [recipeId]: { ...t, status: 'done', remainingMs: 0, endsAt: null, doneAt: Date.now() },
  };
  emit();
}

export function pauseCookTimer(recipeId: RecipeId) {
  const t = timers[recipeId];
  if (!t || t.status !== 'running') return;
  const rem = Math.max(0, (t.endsAt ?? 0) - Date.now());
  timers = { ...timers, [recipeId]: { ...t, status: 'paused', endsAt: null, remainingMs: rem } };
  emit();
}

export function resumeCookTimer(recipeId: RecipeId) {
  const t = timers[recipeId];
  if (!t || t.status !== 'paused') return;
  timers = {
    ...timers,
    [recipeId]: { ...t, status: 'running', endsAt: Date.now() + t.remainingMs },
  };
  ensureTicking();
  emit();
}

export function clearCookTimer(recipeId: RecipeId) {
  if (!(recipeId in timers)) return;
  const next = { ...timers };
  delete next[recipeId];
  timers = next;
  emit();
}

export function clearAllCookTimers() {
  if (Object.keys(timers).length === 0) return;
  timers = {};
  emit();
}

export function getCookTimers(): Record<string, CookTimer> {
  return timers;
}

/** Remaining whole seconds for a timer, derived live from the wall clock. */
export function remainingSeconds(t: CookTimer): number {
  if (t.status === 'done') return 0;
  const ms = t.status === 'paused' ? t.remainingMs : Math.max(0, (t.endsAt ?? 0) - Date.now());
  return Math.ceil(ms / 1000);
}

function useSubscribe() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(n => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
}

/** All active timers (re-renders every ~250ms while any run). */
export function useCookTimers(): CookTimer[] {
  useSubscribe();
  return Object.values(timers);
}

/** The active timer for a single recipe, if any. */
export function useCookTimer(recipeId: RecipeId | null): CookTimer | null {
  useSubscribe();
  if (!recipeId) return null;
  return timers[recipeId] ?? null;
}

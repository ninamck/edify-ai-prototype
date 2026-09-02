'use client';

/**
 * Simulated kitchen clock for the Farmer J demo. Ed runs it forward to
 * show timing prompts landing during service. Cook timers hang off the
 * same clock so they move when it moves. Module store, not persisted.
 */

import { useSyncExternalStore } from 'react';

export type FjTimer = { taskId: string; startMins: number; durationMins: number; label: string };

type ClockState = {
  mins: number;
  playing: boolean;
  timers: Record<string, FjTimer>;
  dismissed: string[];
  started: string[];
};

export const FJ_CLOCK_START = 10 * 60 + 15;
const SESSION_KEY = 'edify.farmerj.clock.v1';

const initial = (): ClockState => ({ mins: FJ_CLOCK_START, playing: false, timers: {}, dismissed: [], started: [] });

/** The clock survives a page refresh within the tab so a demo does not
 *  snap back to 10:15 between screens. */
function load(): ClockState {
  if (typeof window === 'undefined') return initial();
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw) return { ...initial(), ...(JSON.parse(raw) as Partial<ClockState>), playing: false };
  } catch {
    // ignore
  }
  return initial();
}

let state: ClockState = load();
const listeners = new Set<() => void>();
let interval: number | null = null;

function emit() {
  for (const l of listeners) l();
}

function set(next: Partial<ClockState>) {
  state = { ...state, ...next };
  try {
    const { playing: _playing, ...rest } = state;
    void _playing;
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(rest));
  } catch {
    // ignore
  }
  emit();
}

function tick() {
  if (!state.playing) return;
  set({ mins: Math.min(23 * 60 + 59, state.mins + 1) });
}

export function clockSet(mins: number) {
  set({ mins: Math.max(0, Math.min(23 * 60 + 59, mins)) });
}

export function clockNudge(deltaMins: number) {
  clockSet(state.mins + deltaMins);
}

export function clockPlay(playing: boolean) {
  set({ playing });
  if (playing && interval == null && typeof window !== 'undefined') {
    interval = window.setInterval(tick, 120);
  }
  if (!playing && interval != null) {
    window.clearInterval(interval);
    interval = null;
  }
}

export function clockReset() {
  clockPlay(false);
  set({ mins: FJ_CLOCK_START, timers: {}, dismissed: [], started: [] });
}

export function startTimer(taskId: string, durationMins: number, label: string) {
  set({
    timers: { ...state.timers, [taskId]: { taskId, startMins: state.mins, durationMins, label } },
    started: state.started.includes(taskId) ? state.started : [...state.started, taskId],
  });
}

export function clearTimer(taskId: string) {
  const timers = { ...state.timers };
  delete timers[taskId];
  set({ timers });
}

export function dismissNudge(id: string) {
  if (!state.dismissed.includes(id)) set({ dismissed: [...state.dismissed, id] });
}

export function timerRemaining(t: FjTimer, nowMins: number): number {
  return Math.max(0, t.startMins + t.durationMins - nowMins);
}

export function hhmm(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getSnapshot = () => state;
const serverSnapshot: ClockState = initial();

export function useFjClock(): ClockState {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
}

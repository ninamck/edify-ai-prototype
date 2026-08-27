'use client';

/**
 * In-session store for user-created (and edited) checklist templates.
 *
 * Makes the builder's "Create checklist" real within the prototype's
 * rules: saving a template stores it here, schedules one pending
 * instance per assigned site into the complete inbox, and records
 * completion so the record shows up in history — all client-side,
 * mirrored to localStorage like correctiveActionsStore.
 *
 * Fixture templates can be edited too: the edited copy is stored under
 * the same id and the runtime lookups below prefer the stored version.
 */

import { useSyncExternalStore } from 'react';
import {
  MOCK_TEMPLATES,
  MOCK_INSTANCES,
  getAllHistoryInstances,
  getTemplateById as getFixtureTemplateById,
  getInstanceById as getFixtureInstanceById,
} from './mockData';
import type { AuditScoreResult, ChecklistAnswer, ChecklistInstance, ChecklistTemplate } from './types';

// v3: audit scoring moved from severity-weighted points to plain
// counting (checksPassed/checksTotal) — key bumped so stored templates
// and score results re-seed in the new shape.
const STORAGE_KEY = 'edify:checklistTemplates:v3';

/** The demo world's "today" (matches history date-heading fixtures). */
const DEMO_TODAY = '2026-04-04';

interface StoreState {
  templates: ChecklistTemplate[];
  instances: ChecklistInstance[];
}

// ── State + persistence ─────────────────────────────────────────────

let STATE: StoreState = { templates: [], instances: [] };
let hydrated = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function hydrate(): void {
  if (hydrated || !isBrowser()) return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.templates) && Array.isArray(parsed.instances)) {
      STATE = { templates: parsed.templates, instances: parsed.instances };
    }
  } catch {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }
}

function persist(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
  } catch {
    // Storage full or blocked — in-memory still works for the session.
  }
}

// ── Subscription ────────────────────────────────────────────────────

const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function subscribeChecklistStore(l: () => void): () => void {
  hydrate();
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function getChecklistStore(): StoreState {
  hydrate();
  return STATE;
}

const EMPTY_STATE: StoreState = { templates: [], instances: [] };

/** React hook — SSR-safe (server snapshot is empty; fixtures still apply). */
export function useChecklistStore(): StoreState {
  return useSyncExternalStore(subscribeChecklistStore, getChecklistStore, () => EMPTY_STATE);
}

// ── Runtime lookups (store first, then fixtures) ────────────────────

export function findTemplateById(id: string): ChecklistTemplate | undefined {
  hydrate();
  return STATE.templates.find((t) => t.id === id) ?? getFixtureTemplateById(id);
}

export function findInstanceById(id: string): ChecklistInstance | undefined {
  hydrate();
  return STATE.instances.find((i) => i.id === id) ?? getFixtureInstanceById(id);
}

/** Fixture templates with stored edits applied, plus customs appended. */
export function mergeTemplates(stored: ChecklistTemplate[]): ChecklistTemplate[] {
  const overridden = MOCK_TEMPLATES.map(
    (t) => stored.find((s) => s.id === t.id) ?? t,
  );
  const customs = stored.filter((s) => !MOCK_TEMPLATES.some((t) => t.id === s.id));
  return [...customs, ...overridden];
}

/**
 * Today's inbox: fixture instances (replaced by their store copy when
 * one exists, e.g. after live completion) plus store-scheduled ones.
 */
export function mergeInstances(stored: ChecklistInstance[]): ChecklistInstance[] {
  const overridden = MOCK_INSTANCES.map(
    (i) => stored.find((s) => s.id === i.id) ?? i,
  );
  const extras = stored.filter((s) => !MOCK_INSTANCES.some((i) => i.id === s.id));
  return [...overridden, ...extras];
}

/** All completed records: live completions first, then fixture history. */
export function mergeHistoryInstances(stored: ChecklistInstance[]): ChecklistInstance[] {
  const completedStore = stored.filter((i) => i.status === 'complete');
  const fixtureHistory = getAllHistoryInstances().filter(
    (h) => !completedStore.some((s) => s.id === h.id),
  );
  return [...completedStore, ...fixtureHistory].sort((a, b) => {
    const dateA = a.completedDate ?? '0000-00-00';
    const dateB = b.completedDate ?? '0000-00-00';
    return dateB.localeCompare(dateA);
  });
}

// ── Mutators ────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function formatTimeOfDay(t: string): string {
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${mStr}${ampm}`;
}

function dueLabelFor(template: ChecklistTemplate): string {
  switch (template.frequency) {
    case 'daily':   return `Due today · ${formatTimeOfDay(template.timeOfDay)}`;
    case 'weekly':  return 'Due this week';
    case 'monthly': return 'Due this month';
    case 'once':    return `Due once · ${formatTimeOfDay(template.timeOfDay)}`;
  }
}

/**
 * Create or update a template. New active templates are scheduled
 * immediately: one pending instance per assigned site lands in the
 * complete inbox. Edits update the name on any still-pending instances.
 * Returns how many tasks were scheduled (0 on edit).
 */
export function saveTemplate(template: ChecklistTemplate): { scheduledCount: number } {
  hydrate();

  const existingIdx = STATE.templates.findIndex((t) => t.id === template.id);
  const templates = existingIdx >= 0
    ? STATE.templates.map((t, i) => (i === existingIdx ? template : t))
    : [...STATE.templates, template];

  const rootQuestionCount = template.questions.filter((q) => !q.parentQuestionId).length;

  let instances = STATE.instances.map((inst) =>
    inst.templateId === template.id && inst.status !== 'complete'
      ? { ...inst, templateName: template.name, questionCount: rootQuestionCount }
      : inst,
  );

  const isFixtureTemplate = MOCK_TEMPLATES.some((t) => t.id === template.id);
  const alreadyScheduled =
    isFixtureTemplate || instances.some((inst) => inst.templateId === template.id);

  let scheduledCount = 0;
  if (!alreadyScheduled && template.active) {
    const scheduled: ChecklistInstance[] = template.sites.map((site) => ({
      id: `inst-${uid()}`,
      templateId: template.id,
      templateName: template.name,
      site,
      status: 'pending',
      dueLabel: dueLabelFor(template),
      assignedRole: template.assignedRoles[0] ?? 'manager',
      questionCount: rootQuestionCount,
      answers: [],
    }));
    instances = [...instances, ...scheduled];
    scheduledCount = scheduled.length;
  }

  STATE = { templates, instances };
  persist();
  notify();
  return { scheduledCount };
}

/**
 * Record completion of an instance so it moves to "Completed today"
 * and is viewable in history. Store-scheduled instances are updated in
 * place; fixture instances get a completed shadow copy in the store
 * (runtime lookups prefer the store, so the record wins everywhere).
 */
export function completeStoreInstance(
  instanceId: string,
  answers: ChecklistAnswer[],
  completedBy: string,
  scoreResult?: AuditScoreResult,
): boolean {
  hydrate();

  const time = new Date()
    .toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
    .replace(/\s/g, '')
    .toLowerCase();

  const completedFields = {
    status: 'complete' as const,
    dueLabel: `Completed today · ${time}`,
    answers,
    completedAt: time,
    completedDate: DEMO_TODAY,
    completedBy,
    ...(scoreResult ? { scoreResult } : {}),
  };

  const idx = STATE.instances.findIndex((i) => i.id === instanceId);
  let instances: ChecklistInstance[];
  if (idx >= 0) {
    instances = [...STATE.instances];
    instances[idx] = { ...instances[idx], ...completedFields };
  } else {
    const fixture = getFixtureInstanceById(instanceId);
    if (!fixture) return false;
    instances = [...STATE.instances, { ...fixture, ...completedFields }];
  }

  STATE = { ...STATE, instances };
  persist();
  notify();
  return true;
}

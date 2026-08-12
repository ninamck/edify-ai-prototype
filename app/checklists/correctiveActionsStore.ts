'use client';

/**
 * In-session store for corrective actions.
 *
 * A "No" on a question with `correctiveActionConfig` spawns a
 * CorrectiveAction at checklist submit time. The action is a separate
 * work item owned by the store (outlet manager or store account), with
 * its own open → resolved lifecycle, linked back to the source
 * checklist instance + question.
 *
 * Storage mirrors taskHistoryStore: a module-level array for sync
 * reads, mirrored to localStorage so the demo survives a refresh.
 * First run seeds two actions from last month's Richmond ops audit so
 * the inbox is never empty.
 */

import { useSyncExternalStore } from 'react';
import type { CorrectiveAction } from './types';

// v4: points now come from the template's severity weight map (10/5/2)
// — key bumped so existing demo browsers re-seed with consistent numbers.
const STORAGE_KEY = 'edify:correctiveActions:v4';

/** Placeholder evidence photo for seeded fixtures (tiny inline SVG). */
const SEED_PHOTO =
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='240'%3E%3Crect width='320' height='240' fill='%23D8D3CB'/%3E%3Ctext x='160' y='126' font-family='sans-serif' font-size='15' fill='%23555' text-anchor='middle'%3EEvidence photo%3C/text%3E%3C/svg%3E";

const SEED_ACTIONS: CorrectiveAction[] = [
  {
    id: 'ca-seed-1',
    sourceInstanceId: 'hist-monthly-ops',
    sourceQuestionId: 'qm-2',
    templateName: 'Monthly ops audit',
    site: 'Richmond',
    questionText: 'Pest control log up to date with no signs of activity?',
    issueSummary:
      'March entry missing from the pest control log. Droppings found behind dry-store shelving — contractor visit needed before next audit.',
    raisedBy: 'Ed Mehta',
    raisedDate: '2026-03-28',
    raisedAtLabel: '10:40am · 28 Mar',
    assigneeType: 'outlet_manager',
    assigneeName: 'Jordan Beck',
    requirePhotoEvidence: true,
    status: 'open',
  },
  {
    id: 'ca-seed-2',
    sourceInstanceId: 'hist-monthly-ops',
    sourceQuestionId: 'qm-4',
    templateName: 'Monthly ops audit',
    site: 'Richmond',
    questionText: 'First aid kit fully stocked and in date?',
    issueSummary: 'First aid kit missing burn dressings; plasters below minimum count.',
    raisedBy: 'Ed Mehta',
    raisedDate: '2026-03-28',
    raisedAtLabel: '10:40am · 28 Mar',
    assigneeType: 'outlet_manager',
    assigneeName: 'Jordan Beck',
    requirePhotoEvidence: true,
    status: 'resolved',
    resolutionText:
      'Restocked from the Carlton spare kit same day; full replacement kit ordered and fitted 2 Apr. Photo of restocked kit attached.',
    resolutionPhotoDataUrl: SEED_PHOTO,
    resolvedBy: 'Jordan Beck',
    resolvedAtLabel: '4:15pm · 2 Apr',
  },
  // ── Brand standards audit (Richmond, 30 Mar) — one action per failed
  //    scored question, across all three lifecycle states. ──
  {
    id: 'ca-audit-1',
    sourceInstanceId: 'hist-brand-audit',
    sourceQuestionId: 'qa-1',
    templateName: 'Brand standards audit',
    site: 'Richmond',
    questionText: 'Storefront glass and windows intact, clean and free of damage?',
    issueSummary:
      'Left-hand front window smashed overnight — glass swept but pane boarded up. Glazier needed urgently; storefront visibly damaged.',
    issuePhotoDataUrl: SEED_PHOTO,
    raisedBy: 'Ed Mehta',
    raisedDate: '2026-03-30',
    raisedAtLabel: '9:35am · 30 Mar',
    assigneeType: 'outlet_manager',
    assigneeName: 'Jordan Beck',
    requirePhotoEvidence: true,
    status: 'open',
    severity: 'critical',
    pointsLost: 10,
  },
  {
    id: 'ca-audit-2',
    sourceInstanceId: 'hist-brand-audit',
    sourceQuestionId: 'qa-7',
    templateName: 'Brand standards audit',
    site: 'Richmond',
    questionText: 'Date labels present on all open products?',
    issueSummary: 'Open sauces and two prepped containers in the walk-in with no date labels.',
    raisedBy: 'Ed Mehta',
    raisedDate: '2026-03-30',
    raisedAtLabel: '9:35am · 30 Mar',
    assigneeType: 'outlet_manager',
    assigneeName: 'Jordan Beck',
    requirePhotoEvidence: false,
    status: 'in_progress',
    severity: 'medium',
    pointsLost: 5,
  },
  {
    id: 'ca-audit-3',
    sourceInstanceId: 'hist-brand-audit',
    sourceQuestionId: 'qa-8',
    templateName: 'Brand standards audit',
    site: 'Richmond',
    questionText: 'Menu boards current with no handwritten amendments?',
    issueSummary: 'Winter specials still on the main board; two handwritten price corrections.',
    raisedBy: 'Ed Mehta',
    raisedDate: '2026-03-30',
    raisedAtLabel: '9:35am · 30 Mar',
    assigneeType: 'outlet_manager',
    assigneeName: 'Jordan Beck',
    requirePhotoEvidence: false,
    status: 'resolved',
    severity: 'low',
    pointsLost: 2,
    resolutionText: 'Board wiped and reprinted with the autumn menu set; handwritten corrections removed.',
    resolutionPhotoDataUrl: SEED_PHOTO,
    resolvedBy: 'Jordan Beck',
    resolvedAtLabel: '2:10pm · 31 Mar',
  },
];

// ── State + persistence ─────────────────────────────────────────────

let ACTIONS: CorrectiveAction[] = [];
let hydrated = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isActionShape(a: unknown): a is CorrectiveAction {
  if (!a || typeof a !== 'object') return false;
  const x = a as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    typeof x.sourceInstanceId === 'string' &&
    typeof x.issueSummary === 'string' &&
    typeof x.status === 'string'
  );
}

function hydrate(): void {
  if (hydrated || !isBrowser()) return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        ACTIONS = parsed.filter(isActionShape);
        return;
      }
    }
  } catch {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }
  ACTIONS = [...SEED_ACTIONS];
}

function persist(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ACTIONS));
  } catch {
    // Storage full or blocked — in-memory still works for the session.
  }
}

// ── Subscription ────────────────────────────────────────────────────

const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function subscribeCorrectiveActions(l: () => void): () => void {
  hydrate();
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function getCorrectiveActions(): CorrectiveAction[] {
  hydrate();
  return ACTIONS;
}

const EMPTY: CorrectiveAction[] = [];

/** React hook — SSR-safe (server snapshot is an empty list). */
export function useCorrectiveActions(): CorrectiveAction[] {
  return useSyncExternalStore(subscribeCorrectiveActions, getCorrectiveActions, () => EMPTY);
}

// ── Reads ───────────────────────────────────────────────────────────

export function getCorrectiveActionById(id: string): CorrectiveAction | undefined {
  hydrate();
  return ACTIONS.find((a) => a.id === id);
}

export function getActionsForInstance(instanceId: string): CorrectiveAction[] {
  hydrate();
  return ACTIONS.filter((a) => a.sourceInstanceId === instanceId);
}

// ── Mutators ────────────────────────────────────────────────────────

export function addCorrectiveActions(actions: CorrectiveAction[]): void {
  hydrate();
  if (actions.length === 0) return;
  ACTIONS = [...actions, ...ACTIONS];
  persist();
  notify();
}

export function resolveCorrectiveAction(
  id: string,
  resolution: { resolutionText: string; resolutionPhotoDataUrl?: string; resolvedBy: string },
): void {
  hydrate();
  const idx = ACTIONS.findIndex((a) => a.id === id);
  if (idx < 0) return;
  const now = new Date();
  const time = now
    .toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
    .replace(/\s/g, '')
    .toLowerCase();
  const date = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  ACTIONS = [...ACTIONS];
  ACTIONS[idx] = {
    ...ACTIONS[idx],
    status: 'resolved',
    resolutionText: resolution.resolutionText,
    resolutionPhotoDataUrl: resolution.resolutionPhotoDataUrl,
    resolvedBy: resolution.resolvedBy,
    resolvedAtLabel: `${time} · ${date}`,
  };
  persist();
  notify();
}

/** Open → In progress: the assignee has started work on the fix. */
export function markActionInProgress(id: string): void {
  hydrate();
  const idx = ACTIONS.findIndex((a) => a.id === id);
  if (idx < 0 || ACTIONS[idx].status !== 'open') return;
  ACTIONS = [...ACTIONS];
  ACTIONS[idx] = { ...ACTIONS[idx], status: 'in_progress' };
  persist();
  notify();
}

export function newCorrectiveActionId(): string {
  return `ca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

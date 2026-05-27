'use client';

/**
 * Persisted task history for the chat surface.
 *
 * Every chat command run by the operator (waste, stock, recipe edit,
 * production setting, menu change, supplier update) is recorded here
 * with enough metadata to render a scannable history list. Free-text
 * chats can also be filed under `kind: 'chat'` so the same list works
 * as a general "what did I do" log.
 *
 * Storage:
 *   • In-memory tasks live in a module-level array so React subscribers
 *     get sync reads.
 *   • State is mirrored to localStorage on every mutation under the
 *     `edify:taskHistory:v1` key. Re-hydrated on first import. Cap at
 *     200 entries so the store doesn't grow unbounded.
 *
 * Closures (e.g. the undo callback on a CommandReceipt) can't be
 * serialised, so we store the receipt's plain copy only. Re-running
 * undo from a previous session isn't supported — by the time you're
 * looking at history that's a different lifecycle anyway.
 */

const STORAGE_KEY = 'edify:taskHistory:v1';
const MAX_ENTRIES = 200;

export type TaskStatus = 'pending' | 'completed' | 'cancelled' | 'undone';
export type TaskKind =
  | 'waste'
  | 'stock'
  | 'recipe-edit'
  | 'production'
  | 'menu'
  | 'supplier'
  /** Data questions the operator asked Edify (analytics, table
   *  queries — anything that produced an answer rather than a
   *  mutation). */
  | 'question'
  /** Free-form chat that didn't resolve into a command or a chart. */
  | 'chat';

export interface TaskReceipt {
  headline: string;
  detail?: string;
  href?: string;
  hrefLabel?: string;
}

/**
 * Self-contained, JSON-serialisable copy of a chat message. Used for
 * the persisted conversation snapshot on each Task. Mirrors the
 * `ChatMsg` shape Feed.tsx defines locally; we redeclare it here so
 * the store doesn't import from a UI module (and so renaming or
 * trimming fields in Feed doesn't accidentally break stored data).
 *
 * Two extra fields — `cmdState` and `cmdReceiptData` — bake the
 * rendering data that normally lives in the runner's refs into the
 * message itself. That way restoring a snapshot is a one-liner
 * (`setMessages(snapshot)`) and we don't have to repopulate any
 * runtime maps.
 */
export interface StoredChatMessage {
  id: string;
  role: 'user' | 'quinn';
  text: string;
  msgType?: string;
  chartId?: string;
  tableQuery?: unknown;
  tableTitle?: string;
  cmdId?: string;
  cmdArgsJson?: string;
  cmdChoicesJson?: string;
  /** Frozen card state at snapshot time — keeps cards reading as
   *  Done / Cancelled when the thread is re-opened from history. */
  cmdState?: 'pending' | 'confirmed' | 'cancelled';
  /** Frozen receipt payload (no undo closure — that's session-only). */
  cmdReceiptData?: TaskReceipt;
}

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  subtitle?: string;
  status: TaskStatus;
  pinned: boolean;
  startedAt: number;
  completedAt?: number;
  receipt?: TaskReceipt;
  /** Snapshot of the chat thread that produced this task, written at
   *  completion/cancellation time (and updated again on undo). When
   *  present, clicking the history row replays this thread instead of
   *  jumping to the receipt's deep-link. */
  snapshotMessages?: StoredChatMessage[];
}

// ── State + persistence ─────────────────────────────────────────────

let TASKS: Task[] = [];
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
    if (Array.isArray(parsed)) {
      TASKS = parsed.filter(isTaskShape).slice(0, MAX_ENTRIES);
    }
  } catch {
    // Corrupted blob — wipe and move on.
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }
}

function isTaskShape(t: unknown): t is Task {
  if (!t || typeof t !== 'object') return false;
  const x = t as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    typeof x.kind === 'string' &&
    typeof x.title === 'string' &&
    typeof x.status === 'string' &&
    typeof x.startedAt === 'number'
  );
}

function persist(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(TASKS.slice(0, MAX_ENTRIES)));
  } catch {
    // Storage full or blocked — silently drop the persist; in-memory
    // tasks still work for the session.
  }
}

// ── Subscription ────────────────────────────────────────────────────

const listeners = new Set<() => void>();
function notify(): void {
  for (const l of listeners) l();
}
export function subscribeTasks(l: () => void): () => void {
  hydrate();
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export function getTasks(): Task[] {
  hydrate();
  return TASKS;
}

// ── Mutators ────────────────────────────────────────────────────────

export interface StartTaskInput {
  id?: string;
  kind: TaskKind;
  title: string;
  subtitle?: string;
}

export function startTask(input: StartTaskInput): Task {
  hydrate();
  const id = input.id ?? `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const task: Task = {
    id,
    kind: input.kind,
    title: input.title,
    subtitle: input.subtitle,
    status: 'pending',
    pinned: false,
    startedAt: Date.now(),
  };
  TASKS = [task, ...TASKS].slice(0, MAX_ENTRIES);
  persist();
  notify();
  return task;
}

export function updateTask(id: string, patch: Partial<Omit<Task, 'id'>>): void {
  hydrate();
  const idx = TASKS.findIndex((t) => t.id === id);
  if (idx < 0) return;
  TASKS = [...TASKS];
  TASKS[idx] = { ...TASKS[idx], ...patch };
  persist();
  notify();
}

export function completeTask(
  id: string,
  patch: { title?: string; subtitle?: string; receipt?: TaskReceipt },
): void {
  updateTask(id, {
    ...patch,
    status: 'completed',
    pinned: true,
    completedAt: Date.now(),
  });
}

export function cancelTask(id: string): void {
  updateTask(id, { status: 'cancelled', completedAt: Date.now() });
}

export function markTaskUndone(id: string): void {
  updateTask(id, { status: 'undone' });
}

export function setTaskSnapshot(id: string, snapshotMessages: StoredChatMessage[]): void {
  updateTask(id, { snapshotMessages });
}

export function togglePin(id: string): void {
  hydrate();
  const t = TASKS.find((x) => x.id === id);
  if (!t) return;
  updateTask(id, { pinned: !t.pinned });
}

export function removeTask(id: string): void {
  hydrate();
  TASKS = TASKS.filter((t) => t.id !== id);
  persist();
  notify();
}

export function clearAllTasks(): void {
  TASKS = [];
  persist();
  notify();
}

// ── One-shot loggers ────────────────────────────────────────────────
//
// For interactions that have no multi-step lifecycle (a question that
// returns an answer in one beat, a free-form chat reply). Creates the
// task already in `completed` state. Optional receipt lets the caller
// attach a deep-link if the answer lives somewhere else (e.g. a
// pinned chart).

export interface LogEntryInput {
  kind: TaskKind;
  title: string;
  subtitle?: string;
  receipt?: TaskReceipt;
  /** Whether to auto-pin. Defaults to false — questions and chats are
   *  usually too noisy to pin. */
  pinned?: boolean;
}

export function logEntry(input: LogEntryInput): Task {
  hydrate();
  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const task: Task = {
    id,
    kind: input.kind,
    title: input.title,
    subtitle: input.subtitle,
    status: 'completed',
    pinned: input.pinned ?? false,
    startedAt: now,
    completedAt: now,
    receipt: input.receipt,
  };
  TASKS = [task, ...TASKS].slice(0, MAX_ENTRIES);
  persist();
  notify();
  return task;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Re-derive the title from a fresh receipt — used when a task is
 *  upgraded from "started" to "completed" and the receipt headline is
 *  the most descriptive thing we've got. */
export function titleFromReceipt(receipt: TaskReceipt): string {
  return receipt.headline;
}

/** Human-friendly relative time. Local to this file so the list and
 *  any other consumer share the same wording. */
export function formatRelativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

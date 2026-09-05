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
  /** Add a new product + replace an existing one across recipes. */
  | 'product-swap'
  /** Rota rebalance: draft rota checked against workload, written back
   *  to the workforce tool. */
  | 'rota-rebalance'
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
 * A single field-level change captured against a Task.
 *
 * The store keeps these JSON-serialisable so they survive a localStorage
 * round-trip. `before` / `after` are typed as `unknown` deliberately — every
 * command differ knows the shape of the value it's writing; the renderer
 * (`ChangeDiff`) is the only consumer that has to guess at runtime.
 *
 * `valueKind` is a hint to the renderer for how to format scalar diffs.
 * Defaults to `text` when omitted. Array / object diffs are detected by
 * `Array.isArray(before)` and rendered as a row count summary rather than
 * field-by-field reconciliation (full structural diffing is a v2 problem).
 */
export interface ChangeRecord {
  entityType:
    | 'recipe'
    | 'recipe-variant'
    | 'modifier-group'
    | 'product'
    | 'master-product'
    | 'supplier'
    | 'par'
    | 'production-setting'
    | 'waste-entry'
    | 'stock-count'
    /** A shift in the workforce tool's draft rota. */
    | 'rota-shift';
  entityId: string;
  /** Human label used in the diff renderer. e.g. "Egg mayo sandwich · Large". */
  entityLabel: string;
  /** Dotted path into the entity — useful when one entity has multiple
   *  fields touched on the same Task (e.g. price + availability). */
  fieldPath: string;
  /** Human label for the field. e.g. "Dine-in price", "Oat milk qty". */
  fieldLabel: string;
  before: unknown;
  after: unknown;
  /** Optional unit suffix for scalar values ("g", "£", "%"). */
  unit?: string;
  /** Hint to the renderer. */
  valueKind?: 'number' | 'currency' | 'text' | 'boolean' | 'array';
}

/**
 * A single line of computed blast radius — what a Task changed downstream
 * of the direct edits. e.g. "Croissant: GP 64% → 61% (-3pp)". Sorted by
 * |delta| in the renderer so the worst hits are at the top.
 */
export interface BlastRadiusLine {
  metric: 'gp_pct' | 'cogs_daily' | 'allergen_exposure' | 'sites_affected' | 'recipes_affected';
  /** What the metric is computed against — usually a recipe name, sometimes
   *  "All sites" for an aggregate. */
  entityLabel: string;
  before: number | string;
  after: number | string;
  /** Signed delta. Lets the renderer sort by impact and colour
   *  positive / negative consistently. */
  delta?: number;
  /** Optional unit suffix. */
  unit?: string;
}

/** Who-and-how a Task came to exist. Sets the chip label on each row. */
export type TaskActor = { userId: string; userName: string };
export type TaskProvenance =
  /** Quinn proposed the change; a human confirmed. The default for every
   *  command going through useCommandRunner today. */
  | 'ai-suggested-human-approved'
  /** Quinn applied the change on its own (no confirm step). Reserved for
   *  low-stakes auto-actions; not used in the prototype yet. */
  | 'ai-autonomous'
  /** A human made the change through a normal form, no AI involved.
   *  Not captured in the prototype yet — schema is ready for when manual
   *  instrumentation lands. */
  | 'human';

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
  /** Who-and-how the Task came to exist. Optional on older persisted
   *  entries — the renderer falls back to "Quinn" when missing. */
  actor?: TaskActor;
  provenance?: TaskProvenance;
  /** Structured per-field diff captured at confirm time. Optional —
   *  pre-upgrade entries and commands without a differ wired up leave
   *  this undefined; the activity page shows a "No detail captured"
   *  placeholder in that case. */
  changes?: ChangeRecord[];
  /** Computed downstream impact (GP%, COGs, etc.) of the Task. */
  blastRadius?: BlastRadiusLine[];
  /** For commands re-run from the Activity page. Append-only history —
   *  see `recordChanges` + `markSuperseded` for the invariants. */
  supersedes?: string;
  supersededBy?: string;
  revertOf?: string;
  revertedBy?: string;
  /** Frozen snapshot of the args that drove the original command —
   *  written so Revert / Edit can reconstruct the intent without
   *  walking the chat thread. JSON-serialisable. */
  commandIntent?: {
    commandId: string;
    cardMsgType: string;
    args: Record<string, unknown>;
  };
  /** Batch grouping — set when a single operator action fans out into
   *  multiple Tasks so the audit log can show per-target rows but
   *  still tell the user they're part of one intent.
   *
   *  Set on both the parent ("Replaced whole milk with oat milk in 11
   *  recipes — created supplier + product") and on each child ("Added
   *  oat milk to Egg mayo sandwich"). Same `groupId` on parent and all
   *  children; `groupRole` distinguishes them.
   *
   *  Used today by the product-swap command. Reverting a child only
   *  rolls that one target back — the parent's atomic snapshot undo
   *  is still available for batch rollback. */
  groupId?: string;
  groupRole?: 'parent' | 'child';
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

// ── Audit-log mutators ──────────────────────────────────────────────
//
// Each Quinn command calls `recordChanges` immediately before its
// `pushReceipt` step so the receipt headline and the structured diff
// land in the same persisted entry. Pre-upgrade Tasks (and any command
// without a differ wired up) leave `changes` undefined; the Activity
// page handles both cases.

export interface RecordChangesInput {
  changes: ChangeRecord[];
  blastRadius?: BlastRadiusLine[];
  actor?: TaskActor;
  provenance?: TaskProvenance;
}

export function recordChanges(id: string, input: RecordChangesInput): void {
  updateTask(id, {
    changes: input.changes,
    blastRadius: input.blastRadius,
    actor: input.actor ?? DEFAULT_ACTOR,
    provenance: input.provenance ?? 'ai-suggested-human-approved',
  });
}

/** Stash the original command intent against a Task. Used by Revert /
 *  Edit on the Activity page to reconstruct the wizard without walking
 *  the chat thread. */
export function setCommandIntent(
  id: string,
  intent: { commandId: string; cardMsgType: string; args: Record<string, unknown> },
): void {
  updateTask(id, { commandIntent: intent });
}

/**
 * Link a successor Task back to its predecessor. Both rows survive so
 * history reads as a chain (append-only). The predecessor's status
 * stays `completed` — it really happened, it just got refined.
 */
export function markSuperseded(originalTaskId: string, newTaskId: string): void {
  updateTask(originalTaskId, { supersededBy: newTaskId });
  updateTask(newTaskId, { supersedes: originalTaskId });
}

/**
 * Link a revert Task back to the one it undoes. Flips the original's
 * status to `undone` (matching what `undoReceipt` already does for the
 * in-session toast path) so the row reads consistently.
 */
export function markReverted(originalTaskId: string, newTaskId: string): void {
  updateTask(originalTaskId, { revertedBy: newTaskId, status: 'undone' });
  updateTask(newTaskId, { revertOf: originalTaskId });
}

/** Single-user prototype — stub actor used until proper auth is wired. */
const DEFAULT_ACTOR: TaskActor = { userId: 'demo', userName: 'You' };

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

// ── Child-task logger (batch fan-out) ───────────────────────────────
//
// Used when one operator action touches many targets and we want each
// target to be its own row in the audit log so it can be reverted
// independently. The parent Task captures the aggregate (receipt,
// supplier/product creation, atomic batch undo); each child captures
// one target's diff + a focused commandIntent the revert path can
// replay.
//
// Children are written already-completed because the underlying
// mutation happened atomically as part of the parent's confirm step
// — there's no separate pending → confirmed lifecycle for each.
// They're not auto-pinned (the parent is); pinning every child of an
// 11-recipe swap would drown the pinned section.

export interface LogChildTaskInput {
  kind: TaskKind;
  title: string;
  subtitle?: string;
  receipt?: TaskReceipt;
  changes?: ChangeRecord[];
  blastRadius?: BlastRadiusLine[];
  commandIntent?: {
    commandId: string;
    cardMsgType: string;
    args: Record<string, unknown>;
  };
  groupId: string;
  actor?: TaskActor;
  provenance?: TaskProvenance;
}

export function logChildTask(input: LogChildTaskInput): Task {
  hydrate();
  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const task: Task = {
    id,
    kind: input.kind,
    title: input.title,
    subtitle: input.subtitle,
    status: 'completed',
    pinned: false,
    startedAt: now,
    completedAt: now,
    receipt: input.receipt,
    changes: input.changes,
    blastRadius: input.blastRadius,
    commandIntent: input.commandIntent,
    groupId: input.groupId,
    groupRole: 'child',
    actor: input.actor ?? DEFAULT_ACTOR,
    provenance: input.provenance ?? 'ai-suggested-human-approved',
  };
  TASKS = [task, ...TASKS].slice(0, MAX_ENTRIES);
  persist();
  notify();
  return task;
}

/** Mark an existing Task as the parent of a batch. The id is reused
 *  as the groupId so children only need to know the parent's id. */
export function markGroupParent(parentId: string): void {
  updateTask(parentId, { groupId: parentId, groupRole: 'parent' });
}

/** Read all children of a parent task, ordered by recency (most
 *  recent first — matches the Activity page's overall sort). */
export function getGroupChildren(parentId: string, all: Task[]): Task[] {
  return all
    .filter((t) => t.groupRole === 'child' && t.groupId === parentId)
    .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt));
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Re-derive the title from a fresh receipt — used when a task is
 *  upgraded from "started" to "completed" and the receipt headline is
 *  the most descriptive thing we've got. */
export function titleFromReceipt(receipt: TaskReceipt): string {
  return receipt.headline;
}

// ── Demo seeding (prototype only) ────────────────────────────────────
//
// Helps reviewers see the "Added Oat Milk → 11 recipes" batch surface
// without re-running a product-swap from chat (which would skip recipes
// that already carry the new product). The shape mirrors what
// `useCommandRunner` writes on a real confirm: one parent + N children,
// linked by `groupId`, with each child carrying a `recipe-edit` revert
// intent so the per-recipe Revert button on the Activity row works.
//
// Note: this only seeds the activity log. The underlying recipes /
// products / suppliers stores are NOT mutated — clicking Revert on a
// seeded child will replay through chat and produce a no-op or a "field
// already in expected state" outcome, which is fine for a UX demo.

export interface SeedActivityDemoInput {
  /** When `true`, clears any existing tasks before seeding so the
   *  demo batch sits on top of an empty log. Defaults to `true`. */
  clear?: boolean;
}

export function seedActivityDemo(input: SeedActivityDemoInput = {}): void {
  hydrate();
  if (input.clear !== false) {
    TASKS = [];
  }

  const supplierName = 'Plant Pantry';
  const newProductName = 'Oat Milk';
  const oldProductName = 'Whole Milk';

  // Eleven recipes drawn from libraryFixtures so the names ring true
  // even though we don't deep-link to them here. Each child gets a
  // plausible GP delta clustered around -2pp (oat milk being a bit
  // more expensive than dairy in the demo's pricing).
  const recipes: { id: string; name: string; gpDelta: number }[] = [
    { id: 'rec-flat-white',  name: 'Flat white',     gpDelta: -2.4 },
    { id: 'rec-cappuccino',  name: 'Cappuccino',     gpDelta: -2.1 },
    { id: 'rec-latte',       name: 'Latte',          gpDelta: -2.8 },
    { id: 'rec-mocha',       name: 'Mocha',          gpDelta: -1.9 },
    { id: 'rec-cortado',     name: 'Cortado',        gpDelta: -1.6 },
    { id: 'rec-macchiato',   name: 'Macchiato',      gpDelta: -1.4 },
    { id: 'rec-iced-latte',  name: 'Iced latte',     gpDelta: -2.6 },
    { id: 'rec-babyccino',   name: 'Kids babyccino', gpDelta: -1.2 },
    { id: 'rec-chai-latte',  name: 'Chai latte',     gpDelta: -2.3 },
    { id: 'rec-hot-choc',    name: 'Hot chocolate',  gpDelta: -1.8 },
    { id: 'rec-matcha',      name: 'Matcha latte',   gpDelta: -2.0 },
  ];

  const now = Date.now();
  const parentTs = now - 1000 * 60 * 60 * 2; // 2h ago
  const parentId = `task-demo-parent-${Math.random().toString(36).slice(2, 6)}`;
  const productId = `prd-demo-oat-${Math.random().toString(36).slice(2, 6)}`;
  const supplierId = `sup-demo-plant-${Math.random().toString(36).slice(2, 6)}`;
  const headline = `Added ${newProductName} · added to ${recipes.length} recipes`;

  // Aggregate GP delta = simple mean of child deltas (matches what the
  // existing diff helpers do today).
  const aggDelta =
    Math.round(
      (recipes.reduce((s, r) => s + r.gpDelta, 0) / recipes.length) * 10,
    ) / 10;

  const parent: Task = {
    id: parentId,
    kind: 'product-swap',
    title: headline,
    subtitle: supplierName,
    status: 'completed',
    pinned: true,
    startedAt: parentTs,
    completedAt: parentTs,
    receipt: {
      headline,
      detail: `new supplier · ${supplierName} · Saved to all sites`,
      href: `/suppliers/products/${productId}`,
      hrefLabel: 'Open product',
    },
    actor: DEFAULT_ACTOR,
    provenance: 'ai-suggested-human-approved',
    changes: [
      {
        entityType: 'supplier',
        entityId: supplierId,
        entityLabel: supplierName,
        fieldPath: '__created__',
        fieldLabel: 'New supplier added',
        before: null,
        after: supplierName,
        valueKind: 'text',
      },
      {
        entityType: 'product',
        entityId: productId,
        entityLabel: newProductName,
        fieldPath: '__created__',
        fieldLabel: 'New product added',
        before: null,
        after: newProductName,
        valueKind: 'text',
      },
    ],
    blastRadius: [
      {
        metric: 'gp_pct',
        entityLabel: `All ${recipes.length} recipes (mean)`,
        before: 68.2,
        after: +(68.2 + aggDelta).toFixed(1),
        delta: aggDelta,
        unit: 'pp',
      },
      {
        metric: 'recipes_affected',
        entityLabel: 'Across menu',
        before: 0,
        after: recipes.length,
        delta: recipes.length,
      },
    ],
    commandIntent: {
      commandId: 'product-swap',
      cardMsgType: 'cmd-product-swap-summary',
      args: {
        mode: 'add',
        newProductName,
        supplierName,
        supplierMode: 'new',
        recipeIds: recipes.map((r) => r.id),
        scope: 'all',
        addQty: 200,
        addUom: 'ml',
      },
    },
    groupId: parentId,
    groupRole: 'parent',
  };

  const children: Task[] = recipes.map((r, idx) => {
    const childTs = parentTs + idx * 50; // children land microseconds after parent
    const childId = `task-demo-child-${idx}-${Math.random().toString(36).slice(2, 6)}`;
    return {
      id: childId,
      kind: 'product-swap',
      title: `Added ${newProductName} · ${r.name}`,
      subtitle: supplierName,
      status: 'completed',
      pinned: false,
      startedAt: childTs,
      completedAt: childTs,
      receipt: {
        headline: `Added ${newProductName} · ${r.name}`,
        detail: `Part of "${headline}"`,
        href: `/recipes/${r.id}/edit`,
        hrefLabel: 'Open recipe',
      },
      actor: DEFAULT_ACTOR,
      provenance: 'ai-suggested-human-approved',
      changes: [
        {
          entityType: 'recipe',
          entityId: r.id,
          entityLabel: r.name,
          fieldPath: 'ingredients',
          fieldLabel: `Added ${newProductName}`,
          before: [{ name: oldProductName, qty: '180ml' }],
          after: [
            { name: oldProductName, qty: '180ml' },
            { name: newProductName, qty: '200ml' },
          ],
          valueKind: 'array',
        },
      ],
      blastRadius: [
        {
          metric: 'gp_pct',
          entityLabel: r.name,
          before: 68.2,
          after: +(68.2 + r.gpDelta).toFixed(1),
          delta: r.gpDelta,
          unit: 'pp',
        },
      ],
      commandIntent: {
        commandId: 'recipe-edit',
        cardMsgType: 'cmd-recipe-summary',
        args: {
          recipeId: r.id,
          recipeName: r.name,
          kind: 'add',
          toName: newProductName,
          scope: 'all',
        },
      },
      groupId: parentId,
      groupRole: 'child',
    };
  });

  // A spread of standalone examples — one per kind — so the Activity
  // log reads like a real week of work rather than a single batch.
  // Each is a top-level row (no groupRole) timed earlier than the oat
  // milk batch so they stack below it. The underlying stores aren't
  // mutated; Revert / Edit replay through chat the same way the batch
  // children do.
  const hr = 1000 * 60 * 60;
  const extras: Task[] = [
    {
      id: `task-demo-waste-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'waste',
      title: 'Logged waste · Croissants (12)',
      subtitle: 'End of day',
      status: 'completed',
      pinned: false,
      startedAt: now - 5 * hr,
      completedAt: now - 5 * hr,
      receipt: {
        headline: 'Logged 12 croissants as waste',
        detail: 'Reason: overproduction · £14.40 cost',
        href: '/waste',
        hrefLabel: 'Open waste log',
      },
      actor: DEFAULT_ACTOR,
      provenance: 'ai-suggested-human-approved',
      changes: [
        {
          entityType: 'waste-entry',
          entityId: 'waste-croissant',
          entityLabel: 'Croissant',
          fieldPath: 'qty',
          fieldLabel: 'Waste qty',
          before: 0,
          after: 12,
          unit: 'units',
          valueKind: 'number',
        },
      ],
      blastRadius: [
        {
          metric: 'cogs_daily',
          entityLabel: "Today's COGS",
          before: 312.5,
          after: 326.9,
          delta: 14.4,
          unit: '£',
        },
      ],
      commandIntent: {
        commandId: 'waste',
        cardMsgType: 'cmd-waste-summary',
        args: { itemName: 'Croissant', qty: 12, reason: 'overproduction' },
      },
    },
    {
      id: `task-demo-recipe-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'recipe-edit',
      title: 'Raised dine-in price · Egg mayo sandwich',
      subtitle: 'Menu pricing',
      status: 'completed',
      pinned: false,
      startedAt: now - 26 * hr,
      completedAt: now - 26 * hr,
      receipt: {
        headline: 'Egg mayo sandwich · £4.20 → £4.60',
        detail: 'GP 61% → 65% · applied to all sites',
        href: '/recipes/rec-egg-mayo/edit',
        hrefLabel: 'Open recipe',
      },
      actor: DEFAULT_ACTOR,
      provenance: 'ai-suggested-human-approved',
      changes: [
        {
          entityType: 'recipe',
          entityId: 'rec-egg-mayo',
          entityLabel: 'Egg mayo sandwich',
          fieldPath: 'priceDineIn',
          fieldLabel: 'Dine-in price',
          before: 4.2,
          after: 4.6,
          unit: '£',
          valueKind: 'currency',
        },
      ],
      blastRadius: [
        {
          metric: 'gp_pct',
          entityLabel: 'Egg mayo sandwich',
          before: 61,
          after: 65,
          delta: 4,
          unit: 'pp',
        },
      ],
      commandIntent: {
        commandId: 'recipe-edit',
        cardMsgType: 'cmd-recipe-summary',
        args: { recipeId: 'rec-egg-mayo', recipeName: 'Egg mayo sandwich', kind: 'price', scope: 'all' },
      },
    },
    {
      id: `task-demo-production-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'production',
      title: 'Updated par level · Sourdough loaf',
      subtitle: 'Production planning',
      status: 'completed',
      pinned: false,
      startedAt: now - 28 * hr,
      completedAt: now - 28 * hr,
      receipt: {
        headline: 'Sourdough loaf par · 24 → 30 / day',
        detail: 'Based on 4-week demand trend',
        href: '/production/plan',
        hrefLabel: 'Open plan',
      },
      actor: DEFAULT_ACTOR,
      provenance: 'ai-suggested-human-approved',
      changes: [
        {
          entityType: 'production-setting',
          entityId: 'par-sourdough',
          entityLabel: 'Sourdough loaf',
          fieldPath: 'par',
          fieldLabel: 'Daily par',
          before: 24,
          after: 30,
          unit: 'units',
          valueKind: 'number',
        },
      ],
      commandIntent: {
        commandId: 'production',
        cardMsgType: 'cmd-production-summary',
        args: { itemId: 'par-sourdough', par: 30 },
      },
    },
    {
      id: `task-demo-question-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'question',
      title: 'Asked · Which drinks dropped GP this month?',
      subtitle: 'Analytics',
      status: 'completed',
      pinned: false,
      startedAt: now - 30 * hr,
      completedAt: now - 30 * hr,
      receipt: {
        headline: '5 drinks below 60% GP',
        detail: 'Latte, Mocha and Iced latte led the drop after the oat milk switch',
      },
      actor: DEFAULT_ACTOR,
      provenance: 'ai-suggested-human-approved',
    },
    {
      id: `task-demo-supplier-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'supplier',
      title: 'Updated supplier price · Bacon (Smithfield)',
      subtitle: 'Suppliers',
      status: 'completed',
      pinned: false,
      startedAt: now - 50 * hr,
      completedAt: now - 50 * hr,
      receipt: {
        headline: 'Bacon · £6.80 → £7.40 / kg',
        detail: 'Smithfield Meats · affects 6 recipes',
        href: '/suppliers',
        hrefLabel: 'Open supplier',
      },
      actor: DEFAULT_ACTOR,
      provenance: 'ai-suggested-human-approved',
      changes: [
        {
          entityType: 'product',
          entityId: 'prd-bacon',
          entityLabel: 'Bacon',
          fieldPath: 'unitPrice',
          fieldLabel: 'Unit price',
          before: 6.8,
          after: 7.4,
          unit: '£/kg',
          valueKind: 'currency',
        },
      ],
      blastRadius: [
        {
          metric: 'recipes_affected',
          entityLabel: 'Across menu',
          before: 0,
          after: 6,
          delta: 6,
        },
      ],
    },
    {
      id: `task-demo-menu-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'menu',
      title: 'Marked unavailable · Avocado toast',
      subtitle: 'Menu',
      status: 'completed',
      pinned: false,
      startedAt: now - 52 * hr,
      completedAt: now - 52 * hr,
      receipt: {
        headline: 'Avocado toast hidden from menu',
        detail: 'Out of stock · all sites',
        href: '/recipes/rec-avo-toast/edit',
        hrefLabel: 'Open recipe',
      },
      actor: DEFAULT_ACTOR,
      provenance: 'ai-suggested-human-approved',
      changes: [
        {
          entityType: 'recipe',
          entityId: 'rec-avo-toast',
          entityLabel: 'Avocado toast',
          fieldPath: 'available',
          fieldLabel: 'Available',
          before: true,
          after: false,
          valueKind: 'boolean',
        },
      ],
    },
    {
      id: `task-demo-stock-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'stock',
      title: 'Counted stock · Dry store',
      subtitle: 'Weekly count',
      status: 'completed',
      pinned: false,
      startedAt: now - 74 * hr,
      completedAt: now - 74 * hr,
      receipt: {
        headline: 'Dry store count submitted',
        detail: '42 lines counted · 3 variances flagged',
        href: '/count',
        hrefLabel: 'Open count',
      },
      actor: DEFAULT_ACTOR,
      provenance: 'ai-suggested-human-approved',
      changes: [
        {
          entityType: 'stock-count',
          entityId: 'count-dry-store',
          entityLabel: 'Dry store',
          fieldPath: 'lines',
          fieldLabel: 'Lines counted',
          before: 0,
          after: 42,
          unit: 'lines',
          valueKind: 'number',
        },
      ],
    },
  ];

  // Most-recent-first inside the store; the activity page re-sorts anyway.
  TASKS = [parent, ...children, ...extras, ...TASKS].slice(0, MAX_ENTRIES);
  persist();
  notify();
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

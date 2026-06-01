'use client';

/**
 * Persistent, task-typed history surface for the chat. Replaces the
 * old "Chat History" accordion that only ever held the live thread.
 *
 * Design:
 *   • Filter chip row at the top — All / Recipes / Stock / Suppliers /
 *     Menu / Production / Waste / Chat. Density control without losing
 *     the at-a-glance signal.
 *   • Pinned section (collapsed if empty). Anything that resulted in
 *     a successful command receipt auto-pins, so this column reads as
 *     "things I changed".
 *   • Recent section, chronological. Capped at TASK_RECENT_LIMIT with
 *     a "Show all" link that bumps to a larger ceiling.
 *
 * Click behaviour:
 *   • If the task has a receipt with an href, clicking opens the
 *     deep-link — the most useful thing to do with a completed task
 *     is jump to where the change landed.
 *   • Otherwise no-ops (kept for future "replay" affordance).
 *
 * No drawer / overlay — the list lives inline under the prompt chips.
 * If density turns out to be a problem we'll lift this same component
 * straight into a drawer with no contract changes.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  X as XIcon,
  ArrowUpRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  getTasks,
  subscribeTasks,
  removeTask,
  type Task,
  type TaskKind,
} from './taskHistoryStore';

const TASK_RECENT_LIMIT = 5;
const TASK_RECENT_EXPANDED_LIMIT = 30;

// ── Filter taxonomy ─────────────────────────────────────────────────

type Filter = 'all' | TaskKind;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',          label: 'All' },
  { id: 'question',     label: 'Questions' },
  { id: 'recipe-edit',  label: 'Recipes' },
  { id: 'product-swap', label: 'Products' },
  { id: 'stock',        label: 'Stock' },
  { id: 'supplier',     label: 'Suppliers' },
  { id: 'menu',         label: 'Menu' },
  { id: 'production',   label: 'Production' },
  { id: 'waste',        label: 'Waste' },
  { id: 'chat',         label: 'Chat' },
];

// Every row in this list is, conceptually, a saved chat with the
// agent. We use a single speech-bubble glyph for all of them — the
// per-kind differentiation lives in the Suggested column's action
// icons (ChefHat, BarChart3, etc.) and in the drawer's filter chips.
// Mixing kind-specific icons here was making the chats column read
// as "another row of actions" instead of "things I've talked about".
const CHAT_ICON: LucideIcon = MessageSquare;

// ── Public component ────────────────────────────────────────────────

export interface TaskHistoryListProps {
  /** When the user clicks a task that has no deep-link, this fires so
   *  the parent surface can do something app-specific (e.g. restore
   *  the chat thread once we support that). Optional. */
  onOpenTask?: (task: Task) => void;
  /** Container hint — controls the default expanded state. The home
   *  surface keeps it tight; the drawer pre-expands. */
  defaultExpanded?: boolean;
  /** When set, the foot "show more" button opens the side drawer
   *  instead of routing to /activity. The inline command-centre
   *  list passes this so the user stays in the chat context; the
   *  drawer itself omits it (you're already in the drawer) and the
   *  button falls back to launching the full /activity page. */
  onExpand?: () => void;
  /** When set, this fires after a task is navigated to via its href.
   *  The drawer uses this to dismiss itself so the user lands on the
   *  deep-link cleanly without an open overlay. */
  onCloseAfterNavigate?: () => void;
  /** Override the uppercase section header text. The command-centre
   *  inline list passes "Recent chats" to match the Notion-style
   *  two-column treatment; the drawer keeps the default "Recent". */
  sectionLabel?: string;
}

export default function TaskHistoryList({
  onOpenTask,
  defaultExpanded = false,
  onExpand,
  onCloseAfterNavigate,
  sectionLabel = 'Recent',
}: TaskHistoryListProps) {
  const router = useRouter();
  const tasks = useSubscribedTasks();
  const [filter, setFilter] = useState<Filter>('all');

  // Inline (command-centre) vs drawer view. The inline list is the
  // glance view — no filters. The drawer keeps the kind filters
  // for power-user slicing.
  const isInline = !defaultExpanded;

  // Sort by recency (completedAt > startedAt) so the most recently
  // touched items sit at the top. Pinning has been retired — every
  // task is just "recent", one continuous chronological list.
  const { recent, allCount, kindCounts } = useMemo(() => {
    const filtered = tasks.filter((t) => filter === 'all' || t.kind === filter);
    const sortKey = (t: Task) => t.completedAt ?? t.startedAt;
    const sorted = [...filtered].sort((a, b) => sortKey(b) - sortKey(a));

    const counts: Partial<Record<TaskKind, number>> = {};
    for (const t of tasks) counts[t.kind] = (counts[t.kind] ?? 0) + 1;

    return { recent: sorted, allCount: tasks.length, kindCounts: counts };
  }, [tasks, filter]);

  // Inline list is the glance view — stays capped at the small limit.
  // The drawer surface (TaskHistoryDrawer) passes `defaultExpanded` and
  // we honour that with the larger cap so a single component serves
  // both surfaces. For depth-of-audit the user goes to /activity.
  const visibleLimit = defaultExpanded ? TASK_RECENT_EXPANDED_LIMIT : TASK_RECENT_LIMIT;
  const recentVisible = recent.slice(0, visibleLimit);
  if (allCount === 0) {
    return (
      <div>
        <SectionHeader label={sectionLabel} />
        <EmptyState />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader label={sectionLabel} />

      {/* Filter chip row — drawer only. On the command-centre glance
          view the filters add density without helping the operator
          who is just glancing for "what did I do recently"; the
          power-user filter UX lives in the drawer and on /activity. */}
      {!isInline && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginTop: '10px',
            marginBottom: '12px',
          }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const c = f.id === 'all' ? allCount : (kindCounts[f.id as TaskKind] ?? 0);
            if (f.id !== 'all' && c === 0) return null;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 11px',
                  borderRadius: '100px',
                  border: active
                    ? '1px solid transparent'
                    : '1px solid var(--color-border-subtle, rgba(0,28,53,0.10))',
                  background: active ? 'var(--color-accent-active, #001C35)' : '#fff',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                }}
              >
                {f.label}
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '100px',
                    background: active ? 'rgba(255,255,255,0.18)' : 'rgba(0,28,53,0.05)',
                    color: active ? '#fff' : 'var(--color-text-muted)',
                    minWidth: '16px',
                    textAlign: 'center',
                    letterSpacing: 0,
                  }}
                >
                  {c}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Single chronological list. The "RECENT" sub-heading that
          used to surface here when there were pinned items has gone
          along with the pinning concept itself — one heading at the
          top of the column (the section label) is enough. */}
      {recentVisible.length > 0 && (
        <Section title="" subtle>
          {recentVisible.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onOpen={onOpenTask}
              onCloseAfterNavigate={onCloseAfterNavigate}
            />
          ))}
        </Section>
      )}

      {/* Always offer a hook into the full Activity page. The inline
          list stays a glance view (recents only); deep audit work —
          field diffs, blast radius, revert, edit — lives at /activity. */}
      <button
        type="button"
        onClick={() => {
          // Inline list keeps the user in the chat context by
          // escalating to the side drawer. Only when there's no
          // drawer hook (e.g. the drawer itself rendering this
          // component) do we route to the full /activity page.
          if (onExpand) {
            onExpand();
            return;
          }
          onCloseAfterNavigate?.();
          router.push('/activity');
        }}
        style={{
          display: 'flex',
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 0 6px',
          border: 'none',
          background: 'none',
          fontFamily: 'var(--font-primary)',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
          marginTop: '6px',
        }}
      >
        {onExpand ? 'Show all' : 'Open Activity'}
        <ArrowUpRight size={12} strokeWidth={2} />
      </button>
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  // Header is just the uppercase label now. The "X saved" badge
  // and the legacy onExpand chip were both removed — the count
  // adds noise to a glance view, and the open-drawer / open-
  // activity affordance is offered at the foot of the list
  // instead, so there aren't two competing "see more" entry
  // points at the top of the column.
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 700,
          color: 'var(--color-text-secondary)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Section({ title, subtle, children }: { title: string; subtle?: boolean; children: React.ReactNode }) {
  // 8px top margin when there's no sub-title — that matches the gap
  // the Suggested column on the right uses between its header and
  // first row, so the two lists line up row-for-row across the grid.
  return (
    <div style={{ marginTop: title ? '10px' : '8px' }}>
      {title && (
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            color: subtle ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            margin: '6px 0',
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onOpen,
  onCloseAfterNavigate,
}: {
  task: Task;
  onOpen?: (t: Task) => void;
  onCloseAfterNavigate?: () => void;
}) {
  const Icon = CHAT_ICON;
  const [hovered, setHovered] = useState(false);

  const handleClick = () => {
    // Replay the conversation in the chat surface. The parent
    // synthesises a minimal thread if the task pre-dates the
    // snapshot feature, so this branch always works when an `onOpen`
    // handler is supplied. The receipt's deep-link is reachable from
    // inside the restored ReceiptCard, so we don't need a direct
    // window.location jump here anymore.
    if (onOpen) {
      onCloseAfterNavigate?.();
      onOpen(task);
      return;
    }
    if (task.receipt?.href) {
      onCloseAfterNavigate?.();
      window.location.assign(task.receipt.href);
    }
  };

  const clickable = !!(onOpen || task.receipt?.href);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 8px',
        borderRadius: '6px',
        background: hovered ? 'rgba(0,28,53,0.04)' : 'transparent',
        transition: 'background 0.12s ease',
        cursor: clickable ? 'pointer' : 'default',
      }}
      onClick={handleClick}
    >
      {/* Bare outline icon — Notion-style, no chip behind it. The
          per-kind glyph (chef hat, truck, chat bubble, etc.) is the
          only differentiator, all rendered in the same muted colour
          so the list reads as one quiet surface instead of a colour-
          coded grid. */}
      <Icon
        size={15}
        color="var(--color-text-muted)"
        strokeWidth={1.8}
        style={{ flexShrink: 0 }}
      />

      {/* Title — fills the row, truncates with an ellipsis. No
          status pill, no timestamp, no inline icons. The drawer
          surface offers the full meta when the operator wants it. */}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {task.title}
      </span>

      {/* Remove (×) action — fades in on row hover with reserved
          width so the title doesn't reflow. The pin/unpin button
          was here too and has been retired; we only keep × so an
          operator can tidy up an entry that no longer matters. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          flexShrink: 0,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.12s ease',
          pointerEvents: hovered ? 'auto' : 'none',
        }}
      >
        <IconButton
          aria-label="Remove task"
          onClick={(e) => {
            e.stopPropagation();
            removeTask(task.id);
          }}
        >
          <XIcon size={12} color="var(--color-text-muted)" strokeWidth={2} />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  'aria-label': string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: '6px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        padding: 0,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(0,28,53,0.06)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        marginTop: '12px',
        padding: '20px 16px',
        textAlign: 'center',
        borderRadius: '12px',
        background: 'rgba(0,28,53,0.025)',
        border: '1px dashed var(--color-border-subtle, rgba(0,28,53,0.10))',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div
        style={{
          fontSize: '12.5px',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
        }}
      >
        Nothing here yet
      </div>
      <div
        style={{
          fontSize: '11.5px',
          fontWeight: 500,
          color: 'var(--color-text-muted)',
          marginTop: '4px',
        }}
      >
        Ask a question, run <code style={{ fontFamily: 'inherit', fontWeight: 700 }}>/recipe</code>, or{' '}
        <code style={{ fontFamily: 'inherit', fontWeight: 700 }}>/count</code> to get started.
      </div>
    </div>
  );
}

// ── Hook ────────────────────────────────────────────────────────────

function useSubscribedTasks(): Task[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = subscribeTasks(() => setTick((n) => n + 1));
    // Re-render once on mount so SSR-hydrated empty state catches up
    // with localStorage after rehydration in the store.
    setTick((n) => n + 1);
    return unsub;
  }, []);
  return getTasks();
}

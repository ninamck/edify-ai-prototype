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
import {
  Trash2,
  Boxes,
  ChefHat,
  Settings2,
  Utensils,
  Truck,
  MessageSquare,
  BarChart3,
  Pin,
  PinOff,
  X as XIcon,
  ChevronRight,
  RotateCcw,
  Maximize2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  getTasks,
  subscribeTasks,
  togglePin,
  removeTask,
  formatRelativeTime,
  type Task,
  type TaskKind,
  type TaskStatus,
} from './taskHistoryStore';

const TASK_RECENT_LIMIT = 6;
const TASK_RECENT_EXPANDED_LIMIT = 30;

// ── Filter taxonomy ─────────────────────────────────────────────────

type Filter = 'all' | TaskKind;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',         label: 'All' },
  { id: 'question',    label: 'Questions' },
  { id: 'recipe-edit', label: 'Recipes' },
  { id: 'stock',       label: 'Stock' },
  { id: 'supplier',    label: 'Suppliers' },
  { id: 'menu',        label: 'Menu' },
  { id: 'production',  label: 'Production' },
  { id: 'waste',       label: 'Waste' },
  { id: 'chat',        label: 'Chat' },
];

// ── Per-kind icon + accent ──────────────────────────────────────────

const KIND_VISUALS: Record<TaskKind, { icon: LucideIcon; accent: string; bg: string }> = {
  'waste':       { icon: Trash2,        accent: '#A8401C', bg: 'rgba(168, 64, 28, 0.10)' },
  'stock':       { icon: Boxes,         accent: '#1F6B73', bg: 'rgba(31, 107, 115, 0.10)' },
  'recipe-edit': { icon: ChefHat,       accent: '#2D6A4F', bg: 'rgba(45, 106, 79, 0.10)' },
  'production':  { icon: Settings2,     accent: '#5A4A8A', bg: 'rgba(90, 74, 138, 0.10)' },
  'menu':        { icon: Utensils,      accent: '#C16E2C', bg: 'rgba(193, 110, 44, 0.10)' },
  'supplier':    { icon: Truck,         accent: '#1F4A8A', bg: 'rgba(31, 74, 138, 0.10)' },
  'question':    { icon: BarChart3,     accent: '#28AFC9', bg: 'rgba(40, 175, 201, 0.10)' },
  'chat':        { icon: MessageSquare, accent: '#5C6B73', bg: 'rgba(92, 107, 115, 0.10)' },
};

// ── Status pill copy ────────────────────────────────────────────────

const STATUS_PILL: Record<TaskStatus, { label: string; bg: string; fg: string }> = {
  pending:   { label: 'In progress', bg: 'rgba(193, 130, 28, 0.14)', fg: '#7C5410' },
  completed: { label: 'Done',        bg: 'rgba(45, 106, 79, 0.14)',  fg: '#22573F' },
  cancelled: { label: 'Cancelled',   bg: 'rgba(58, 48, 40, 0.08)',   fg: 'var(--color-text-muted)' },
  undone:    { label: 'Undone',      bg: 'rgba(58, 48, 40, 0.08)',   fg: 'var(--color-text-muted)' },
};

// ── Public component ────────────────────────────────────────────────

export interface TaskHistoryListProps {
  /** When the user clicks a task that has no deep-link, this fires so
   *  the parent surface can do something app-specific (e.g. restore
   *  the chat thread once we support that). Optional. */
  onOpenTask?: (task: Task) => void;
  /** Container hint — controls the default expanded state. The home
   *  surface keeps it tight; the drawer pre-expands. */
  defaultExpanded?: boolean;
  /** When set, an "Open full history" link surfaces in the section
   *  header. Used by the inline list to launch the drawer. */
  onExpand?: () => void;
  /** When set, this fires after a task is navigated to via its href.
   *  The drawer uses this to dismiss itself so the user lands on the
   *  deep-link cleanly without an open overlay. */
  onCloseAfterNavigate?: () => void;
}

export default function TaskHistoryList({
  onOpenTask,
  defaultExpanded = false,
  onExpand,
  onCloseAfterNavigate,
}: TaskHistoryListProps) {
  const tasks = useSubscribedTasks();
  const [filter, setFilter] = useState<Filter>('all');
  const [showAll, setShowAll] = useState<boolean>(defaultExpanded);

  // Sort & partition by filter + pinned status. Sort by recency
  // (completedAt > startedAt) so the most recently touched items sit
  // at the top of each section.
  const { pinned, recent, allCount, kindCounts } = useMemo(() => {
    const filtered = tasks.filter((t) => filter === 'all' || t.kind === filter);
    const sortKey = (t: Task) => t.completedAt ?? t.startedAt;
    const sorted = [...filtered].sort((a, b) => sortKey(b) - sortKey(a));
    const pinnedTasks = sorted.filter((t) => t.pinned);
    const recentTasks = sorted.filter((t) => !t.pinned);

    const counts: Partial<Record<TaskKind, number>> = {};
    for (const t of tasks) counts[t.kind] = (counts[t.kind] ?? 0) + 1;
    return { pinned: pinnedTasks, recent: recentTasks, allCount: tasks.length, kindCounts: counts };
  }, [tasks, filter]);

  const recentVisible = showAll ? recent.slice(0, TASK_RECENT_EXPANDED_LIMIT) : recent.slice(0, TASK_RECENT_LIMIT);
  const hasMore = recent.length > recentVisible.length;

  if (allCount === 0) {
    return (
      <div style={{ marginTop: '24px' }}>
        <SectionHeader label="Recent" count={0} onExpand={onExpand} />
        <EmptyState />
      </div>
    );
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <SectionHeader label="Recent" count={allCount} onExpand={onExpand} />

      {/* Filter chip row */}
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

      {/* Pinned section */}
      {pinned.length > 0 && (
        <Section title="Pinned" subtle>
          {pinned.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onOpen={onOpenTask}
              onCloseAfterNavigate={onCloseAfterNavigate}
            />
          ))}
        </Section>
      )}

      {/* Recent section */}
      {recentVisible.length > 0 && (
        <Section title={pinned.length > 0 ? 'Recent' : ''} subtle>
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

      {/* Show all / Show less */}
      {(hasMore || (showAll && recent.length > TASK_RECENT_LIMIT)) && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          style={{
            display: 'flex',
            width: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 0',
            border: 'none',
            background: 'none',
            fontFamily: 'var(--font-primary)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
          }}
        >
          {showAll ? 'Show less' : `Show all (${recent.length})`}
        </button>
      )}
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────

function SectionHeader({
  label,
  count,
  onExpand,
}: {
  label: string;
  count: number;
  onExpand?: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {count > 0 && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
            }}
          >
            {count} saved
          </span>
        )}
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            aria-label="Open full history"
            title="Open full history"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 9px',
              borderRadius: '100px',
              border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.10))',
              background: '#fff',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
            }}
          >
            <Maximize2 size={11} strokeWidth={2.2} color="var(--color-text-muted)" />
            View all
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, subtle, children }: { title: string; subtle?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: title ? '10px' : '0' }}>
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
  const { icon: Icon, accent, bg } = KIND_VISUALS[task.kind];
  const status = STATUS_PILL[task.status];
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
        padding: '10px 8px',
        borderRadius: '10px',
        background: hovered ? 'rgba(40,175,201,0.05)' : 'transparent',
        transition: 'background 0.12s ease',
        cursor: clickable ? 'pointer' : 'default',
      }}
      onClick={handleClick}
    >
      {/* Icon chip */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '10px',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={15} color={accent} strokeWidth={2.2} />
      </div>

      {/* Title + subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: 1,
            }}
          >
            {task.title}
          </span>
          {task.status !== 'completed' && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '100px',
                background: status.bg,
                color: status.fg,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                flexShrink: 0,
                fontFamily: 'var(--font-primary)',
              }}
            >
              {status.label}
            </span>
          )}
        </div>
        {task.subtitle && (
          <div
            style={{
              fontSize: '11.5px',
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-primary)',
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {task.subtitle}
          </div>
        )}
      </div>

      {/* Right meta + hover actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flexShrink: 0,
        }}
      >
        {!hovered ? (
          <>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-primary)',
                marginRight: '4px',
              }}
            >
              {formatRelativeTime(task.completedAt ?? task.startedAt)}
            </span>
            {task.status === 'undone' && <RotateCcw size={12} color="var(--color-text-muted)" />}
            {clickable && <ChevronRight size={14} color="var(--color-text-muted)" strokeWidth={2} />}
          </>
        ) : (
          <>
            <IconButton
              aria-label={task.pinned ? 'Unpin task' : 'Pin task'}
              onClick={(e) => {
                e.stopPropagation();
                togglePin(task.id);
              }}
            >
              {task.pinned
                ? <PinOff size={13} color="var(--color-text-muted)" strokeWidth={2} />
                : <Pin size={13} color="var(--color-text-muted)" strokeWidth={2} />}
            </IconButton>
            <IconButton
              aria-label="Remove task"
              onClick={(e) => {
                e.stopPropagation();
                removeTask(task.id);
              }}
            >
              <XIcon size={13} color="var(--color-text-muted)" strokeWidth={2} />
            </IconButton>
          </>
        )}
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
        width: 24,
        height: 24,
        borderRadius: '8px',
        border: 'none',
        background: 'rgba(0,28,53,0.06)',
        cursor: 'pointer',
        padding: 0,
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

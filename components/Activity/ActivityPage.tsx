'use client';

/**
 * /activity — the deep audit surface.
 *
 * Lists every Edify-driven Task in the persisted history store with a
 * per-field diff, blast radius, and revert / edit actions. The
 * sidebar's TaskHistoryList is the glance view; this page is where the
 * operator goes to investigate ("what changed on the egg mayo?",
 * "show me everything Edify did this week").
 *
 * Routing for Revert / Edit:
 *   • Both bounce back into the home chat surface so the operator
 *     confirms in the same place they first approved the action.
 *   • We persist the click intent into localStorage and the chat
 *     reads it on mount (see ACTIVITY_REPLAY_KEY).
 *   • This keeps the Activity page itself read-only of the chat
 *     runtime — no need to portal the entire Feed in here.
 *
 * Scope (v1, matches the plan):
 *   • AI-only — manual form edits aren't captured yet. We say so in
 *     the empty-state copy so the page reads honestly.
 *   • Append-only history — Edit + Revert create successor Tasks
 *     linked via supersedes / revertOf rather than rewriting the
 *     original row.
 *   • No bulk revert.
 *   • No per-entity drilldown (recipe / supplier History tabs).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, RefreshCw } from 'lucide-react';
import { getTasks, seedActivityDemo, type Task } from '@/components/Feed/taskHistoryStore';
import ActivityRow from './ActivityRow';
import ActivityFilters, {
  type ActivityFilter,
  type ActivityDateRange,
} from './ActivityFilters';
import { dayBucketLabel } from './format';
import { useSubscribedTasks } from './useSubscribedTasks';

export const ACTIVITY_REPLAY_KEY = 'edify:activityReplay:v1';

export interface ActivityReplayIntent {
  taskId: string;
  mode: 'revert' | 'edit';
  /** Set by the page when the click fires so the chat surface ignores
   *  stale replays from a previous session. */
  requestedAt: number;
}

const DATE_WINDOWS: Record<ActivityDateRange, number | null> = {
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  all: null,
};

export default function ActivityPage() {
  const router = useRouter();
  const tasks = useSubscribedTasks();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [dateRange, setDateRange] = useState<ActivityDateRange>('week');
  const [search, setSearch] = useState('');

  // Seed the demo entries on first visit so the log is never empty —
  // the operator sees a populated, realistic week without having to
  // press the Reset & seed button. Runs once, and only when the store
  // is genuinely empty (after localStorage hydration), so it never
  // clobbers real activity the user has accumulated.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (getTasks().length === 0) {
      seedActivityDemo({ clear: false });
    }
  }, []);

  const { kindCounts, totalForRange } = useMemo(() => {
    const now = Date.now();
    const window = DATE_WINDOWS[dateRange];
    const inWindow = (t: Task) =>
      window == null ? true : (t.completedAt ?? t.startedAt) >= now - window;

    // Counts reflect the collapsed view — one entry per batch, not one
    // per child slice — so the "Products · 1" chip matches what the
    // operator actually sees as a top-level row.
    const inWindowIds = new Set(tasks.filter(inWindow).map((t) => t.id));
    const counts: Partial<Record<Task['kind'], number>> = {};
    let total = 0;
    for (const t of tasks) {
      if (!inWindow(t)) continue;
      if (t.groupRole === 'child' && t.groupId && inWindowIds.has(t.groupId)) continue;
      counts[t.kind] = (counts[t.kind] ?? 0) + 1;
      total += 1;
    }
    return { kindCounts: counts, totalForRange: total };
  }, [tasks, dateRange]);

  const filteredTasks = useMemo(() => {
    const now = Date.now();
    const window = DATE_WINDOWS[dateRange];
    const inWindow = (t: Task) =>
      window == null ? true : (t.completedAt ?? t.startedAt) >= now - window;
    const matchesFilter = (t: Task) => filter === 'all' || t.kind === filter;
    const haystack = (t: Task) => {
      const parts = [t.title, t.subtitle ?? '', t.receipt?.headline ?? '', t.receipt?.detail ?? ''];
      for (const c of t.changes ?? []) {
        parts.push(c.entityLabel, c.fieldLabel);
      }
      return parts.join(' ').toLowerCase();
    };
    const term = search.trim().toLowerCase();
    const matchesSearch = (t: Task) => (term ? haystack(t).includes(term) : true);

    const passing = [...tasks]
      .filter((t) => inWindow(t) && matchesFilter(t) && matchesSearch(t))
      .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt));

    // Collapse batch children under their parent when the parent is also
    // in the visible set — they render inline in the parent's expanded
    // view (see ActivityRow's "Per-recipe changes" section). If the
    // parent is filtered out (e.g. operator widened to a kind the
    // parent doesn't match), children still appear as top-level rows
    // so nothing silently disappears from the audit log.
    const visibleIds = new Set(passing.map((t) => t.id));
    return passing.filter((t) => {
      if (t.groupRole !== 'child' || !t.groupId) return true;
      return !visibleIds.has(t.groupId);
    });
  }, [tasks, dateRange, filter, search]);

  const grouped = useMemo(() => groupByDay(filteredTasks), [filteredTasks]);

  const bounceToChat = (intent: ActivityReplayIntent) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(ACTIVITY_REPLAY_KEY, JSON.stringify(intent));
    } catch {
      /* localStorage full / blocked — push anyway, chat will no-op silently */
    }
    router.push('/');
  };

  const handleRevert = (task: Task): boolean => {
    if (!task.commandIntent) return false;
    bounceToChat({ taskId: task.id, mode: 'revert', requestedAt: Date.now() });
    return true;
  };

  const handleEdit = (task: Task): boolean => {
    if (!task.commandIntent) return false;
    bounceToChat({ taskId: task.id, mode: 'edit', requestedAt: Date.now() });
    return true;
  };

  const handleOpenChat = (task: Task) => {
    if (task.snapshotMessages && task.snapshotMessages.length > 0) {
      bounceToChat({ taskId: task.id, mode: 'edit', requestedAt: Date.now() });
      return;
    }
    if (task.receipt?.href) {
      router.push(task.receipt.href);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: '24px 28px 64px',
        maxWidth: 1080,
        margin: '0 auto',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-primary)',
              letterSpacing: '-0.005em',
            }}
          >
            Activity
          </h1>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.55,
              maxWidth: 640,
            }}
          >
            Every change Edify has made — before / after, downstream impact, and a way to
            roll it back or refine it. Manual edits aren&apos;t captured here yet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (
              typeof window !== 'undefined' &&
              !window.confirm(
                'Reset the activity log and seed a demo "Added Oat Milk · 11 recipes" batch? (Underlying recipes / products aren\u2019t touched.)',
              )
            ) {
              return;
            }
            seedActivityDemo({ clear: true });
          }}
          title="Prototype-only: clears the activity log and seeds a fully-wired batch example so the per-recipe breakdown can be demoed without re-running a swap."
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px dashed var(--color-border, rgba(0,28,53,0.18))',
            background: '#fff',
            color: 'var(--color-text-secondary)',
            fontSize: 11.5,
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          <RefreshCw size={12} strokeWidth={2.4} />
          Reset to demo
        </button>
      </header>

      <ActivityFilters
        filter={filter}
        onFilterChange={setFilter}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        search={search}
        onSearchChange={setSearch}
        counts={kindCounts}
        totalCount={totalForRange}
      />

      {filteredTasks.length === 0 ? (
        <EmptyState search={search} dateRange={dateRange} filter={filter} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {grouped.map((group) => (
            <section key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                <span>{group.label}</span>
                <span
                  style={{
                    flex: 1,
                    height: 1,
                    background: 'var(--color-border-subtle)',
                  }}
                />
                <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
                  {group.tasks.length} entr{group.tasks.length === 1 ? 'y' : 'ies'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.tasks.map((task) => (
                  <ActivityRow
                    key={task.id}
                    task={task}
                    allTasks={tasks}
                    defaultExpanded={false}
                    onRevert={handleRevert}
                    onEdit={handleEdit}
                    onOpenChat={handleOpenChat}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

interface DayGroup {
  label: string;
  tasks: Task[];
}

function groupByDay(tasks: Task[]): DayGroup[] {
  const groups: DayGroup[] = [];
  let current: DayGroup | null = null;
  for (const t of tasks) {
    const label = dayBucketLabel(t.completedAt ?? t.startedAt);
    if (!current || current.label !== label) {
      current = { label, tasks: [] };
      groups.push(current);
    }
    current.tasks.push(t);
  }
  return groups;
}

function EmptyState({
  search,
  dateRange,
  filter,
}: {
  search: string;
  dateRange: ActivityDateRange;
  filter: ActivityFilter;
}) {
  const filteredCopy =
    search || filter !== 'all' || dateRange !== 'all'
      ? 'No activity matches the current filters. Try widening the date range or clearing the search.'
      : "Nothing here yet. Ask Edify to make a change — like updating a recipe's price or swapping a supplier — and it'll show up here.";

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '40px 24px',
        borderRadius: 12,
        background: '#fff',
        border: '1px dashed var(--color-border-subtle)',
        fontFamily: 'var(--font-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Info size={16} color="var(--color-text-muted)" strokeWidth={2.2} />
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          marginTop: 4,
        }}
      >
        {search || filter !== 'all' ? 'No matches' : 'Activity log is empty'}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--color-text-muted)',
          maxWidth: 360,
          lineHeight: 1.55,
        }}
      >
        {filteredCopy}
      </p>
    </div>
  );
}

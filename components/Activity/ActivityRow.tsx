'use client';

/**
 * One row in the Activity page. Collapsed by default — header reads
 * actor, title, status, time, and the count of changes captured.
 * Click the row (or the chevron) to expand into the per-field diff
 * + blast radius + actions.
 *
 * Actions:
 *   • Revert  — replays an inverse of the change through the chat.
 *   • Edit    — re-opens the original confirm card with the same
 *               args so the user can adjust.
 *   • Pin/Unpin
 *   • Open chat — restores the saved thread snapshot in the chat
 *               surface (deep-link if no snapshot was captured).
 *   • Remove from history
 *
 * Revert and Edit both jump back into the chat surface to confirm.
 * That keeps a single "preview → confirm" pattern (trust in the
 * moment) regardless of where the action started.
 */

import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Boxes,
  ChefHat,
  Settings2,
  Utensils,
  Truck,
  MessageSquare,
  BarChart3,
  ArrowLeftRight,
  Building2,
  CalendarClock,
  Sunrise,
  RotateCcw,
  Pencil,
  Pin,
  PinOff,
  ExternalLink,
  X as XIcon,
  User,
  Clock,
  Layers,
  Link2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  togglePin,
  removeTask,
  type Task,
  type TaskKind,
  type TaskStatus,
} from '@/components/Feed/taskHistoryStore';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import ChangeDiff from './ChangeDiff';
import BlastRadiusBlock from './BlastRadiusBlock';
import { formatTimestamp } from './format';

// All kinds share the same neutral icon container. The icon shape
// still varies so a scroller can pattern-match a row at a glance, but
// the per-kind accent colours that used to live here were too
// decorative for a page meant to read as a record.
const KIND_VISUALS: Record<TaskKind, { icon: LucideIcon; label: string }> = {
  'waste':        { icon: Trash2,         label: 'Waste' },
  'stock':        { icon: Boxes,          label: 'Stock' },
  'recipe-edit':  { icon: ChefHat,        label: 'Recipe' },
  'production':   { icon: Settings2,      label: 'Production' },
  'menu':         { icon: Utensils,       label: 'Menu' },
  'supplier':     { icon: Truck,          label: 'Supplier' },
  'product-swap': { icon: ArrowLeftRight, label: 'Product' },
  'site-setup':   { icon: Building2,      label: 'Sites' },
  'rota-rebalance': { icon: CalendarClock, label: 'Rota' },
  'variance-sweep': { icon: Sunrise,       label: 'Sweep' },
  'question':     { icon: BarChart3,      label: 'Question' },
  'chat':         { icon: MessageSquare,  label: 'Chat' },
};

// Outline-only status pills per the project's status-pills rule.
// Colour is only on the border + text; background stays white so the
// page reads as a quiet ledger rather than a dashboard.
const STATUS_PILL: Record<TaskStatus, { label: string; border: string; fg: string }> = {
  pending:   { label: 'In progress', border: 'var(--color-warning, #C1821C)', fg: 'var(--color-warning, #C1821C)' },
  completed: { label: 'Applied',     border: 'var(--color-border, rgba(0,28,53,0.18))', fg: 'var(--color-text-secondary)' },
  cancelled: { label: 'Cancelled',   border: 'var(--color-border-subtle, rgba(0,28,53,0.10))', fg: 'var(--color-text-muted)' },
  undone:    { label: 'Reverted',    border: 'var(--color-error, #A8401C)', fg: 'var(--color-error, #A8401C)' },
};

export interface ActivityRowProps {
  task: Task;
  /** All tasks — used to resolve supersedes / revertedBy chips into
   *  their newer counterparts so the chip can link through. */
  allTasks: Task[];
  /** Default-open the row. The page passes `true` on the most recent
   *  row so the operator sees the diff without an extra click. */
  defaultExpanded?: boolean;
  /** Replay the task as a Revert into the chat. Returns whether the
   *  command type supports a clean revert; the row uses that to
   *  surface a tooltip when revert is unsupported. */
  onRevert?: (task: Task) => boolean;
  /** Replay the task as an Edit into the chat. */
  onEdit?: (task: Task) => boolean;
  /** Open the saved chat thread for this task (or jump to the
   *  receipt deep-link if no snapshot is stored). */
  onOpenChat?: (task: Task) => void;
}

export default function ActivityRow({
  task,
  allTasks,
  defaultExpanded = false,
  onRevert,
  onEdit,
  onOpenChat,
}: ActivityRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [revertHint, setRevertHint] = useState<string | null>(null);

  useEffect(() => {
    if (!revertHint) return;
    const t = setTimeout(() => setRevertHint(null), 3200);
    return () => clearTimeout(t);
  }, [revertHint]);

  const visuals = KIND_VISUALS[task.kind];
  const status = STATUS_PILL[task.status];
  const Icon = visuals.icon;
  const changeCount = task.changes?.length ?? 0;
  const blastCount = task.blastRadius?.length ?? 0;
  const isAiOrigin = task.provenance !== 'human';

  const linkChip = (() => {
    if (task.supersededBy) {
      const target = allTasks.find((t) => t.id === task.supersededBy);
      return target
        ? { label: `Superseded by "${target.title}"`, taskId: target.id, kind: 'supersededBy' as const }
        : null;
    }
    if (task.supersedes) {
      const target = allTasks.find((t) => t.id === task.supersedes);
      return target
        ? { label: `Edit of "${target.title}"`, taskId: target.id, kind: 'supersedes' as const }
        : null;
    }
    if (task.revertedBy) {
      const target = allTasks.find((t) => t.id === task.revertedBy);
      return target
        ? { label: `Reverted in "${target.title}"`, taskId: target.id, kind: 'revertedBy' as const }
        : null;
    }
    if (task.revertOf) {
      const target = allTasks.find((t) => t.id === task.revertOf);
      return target
        ? { label: `Reverts "${target.title}"`, taskId: target.id, kind: 'revertOf' as const }
        : null;
    }
    return null;
  })();

  // Batch grouping — surfaced as a small chip on both ends of the
  // relationship so the operator can see at a glance that this row is
  // either an aggregate (parent) or one slice of a batch (child).
  // Children resolve to their parent by groupId; parents count their
  // own children by scanning `allTasks` (cheap — typical batch is
  // single-digit recipes, log capped at 200).
  const groupChip = (() => {
    if (task.groupRole === 'child' && task.groupId) {
      const parent = allTasks.find((t) => t.id === task.groupId);
      return parent
        ? { kind: 'child' as const, label: `Part of "${parent.title}"`, taskId: parent.id }
        : null;
    }
    if (task.groupRole === 'parent') {
      const count = allTasks.filter(
        (t) => t.groupRole === 'child' && t.groupId === task.id,
      ).length;
      if (count === 0) return null;
      return {
        kind: 'parent' as const,
        label: `Batch · ${count} per-recipe entr${count === 1 ? 'y' : 'ies'}`,
        taskId: task.id,
      };
    }
    return null;
  })();

  const tryRevert = () => {
    if (!onRevert) return;
    const ok = onRevert(task);
    if (!ok) {
      setRevertHint(
        "This change can't be auto-reverted from history yet. Open the original chat and use Undo there, or apply the inverse manually.",
      );
    }
  };

  return (
    <article
      style={{
        borderRadius: 10,
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={15} color="var(--color-text-secondary)" strokeWidth={2.2} />
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
            >
              {task.title}
            </span>
            <span
              style={{
                ...pillBase,
                background: '#fff',
                color: status.fg,
                border: `1.5px solid ${status.border}`,
              }}
            >
              {status.label}
            </span>
            <span
              style={{
                ...pillBase,
                background: '#fff',
                color: 'var(--color-text-secondary)',
                border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
              }}
            >
              {isAiOrigin ? (
                <>
                  <EdifyMark size={9} /> Edify
                </>
              ) : (
                <>
                  <User size={9} strokeWidth={2.6} /> Manual
                </>
              )}
            </span>
            {groupChip && (
              <span
                style={{
                  ...pillBase,
                  background: '#fff',
                  color: 'var(--color-text-secondary)',
                  border: '1.5px dashed var(--color-border, rgba(0,28,53,0.18))',
                  textTransform: 'none',
                  letterSpacing: 0,
                  fontWeight: 600,
                }}
                title={groupChip.label}
              >
                {groupChip.kind === 'parent' ? (
                  <>
                    <Layers size={9} strokeWidth={2.6} /> {groupChip.label}
                  </>
                ) : (
                  <>
                    <Link2 size={9} strokeWidth={2.6} /> Part of batch
                  </>
                )}
              </span>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 11.5,
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-primary)',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} strokeWidth={2.2} />
              {formatTimestamp(task.completedAt ?? task.startedAt)}
            </span>
            <span style={{ color: 'var(--color-border)' }}>·</span>
            <span>{visuals.label}</span>
            {changeCount > 0 && (
              <>
                <span style={{ color: 'var(--color-border)' }}>·</span>
                <span>{changeCount} change{changeCount === 1 ? '' : 's'}</span>
              </>
            )}
            {blastCount > 0 && (
              <>
                <span style={{ color: 'var(--color-border)' }}>·</span>
                <span>{blastCount} impact line{blastCount === 1 ? '' : 's'}</span>
              </>
            )}
            {task.actor && (
              <>
                <span style={{ color: 'var(--color-border)' }}>·</span>
                <span>{task.actor.userName}</span>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            color: 'var(--color-text-muted)',
          }}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {linkChip && !expanded && (
        <div style={{ padding: '0 14px 10px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 9px',
              borderRadius: 100,
              background: 'rgba(0, 28, 53, 0.05)',
              color: 'var(--color-text-secondary)',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
            }}
          >
            <RotateCcw size={10} strokeWidth={2.4} />
            {linkChip.label}
          </span>
        </div>
      )}

      {expanded && (
        <div
          style={{
            borderTop: '1px solid var(--color-border-subtle)',
            padding: '14px 14px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            background: '#fff',
          }}
        >
          {task.changes && task.changes.length > 0 ? (
            <section>
              <SectionLabel>What changed</SectionLabel>
              <div style={{ marginTop: 4 }}>
                {task.changes.map((c, i) => (
                  <ChangeDiff key={`${c.entityId}-${c.fieldPath}-${i}`} change={c} />
                ))}
              </div>
            </section>
          ) : (
            <section>
              <SectionLabel>What changed</SectionLabel>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 12.5,
                  color: 'var(--color-text-muted)',
                  fontStyle: 'italic',
                  lineHeight: 1.5,
                }}
              >
                No structured diff captured for this entry — it predates the audit upgrade or
                the command type doesn&apos;t emit a diff yet. The receipt below is the
                authoritative record.
              </p>
              {task.receipt && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: '#fff',
                    border: '1px solid var(--color-border-subtle)',
                    fontSize: 12.5,
                    color: 'var(--color-text-primary)',
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{task.receipt.headline}</div>
                  {task.receipt.detail && (
                    <div style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {task.receipt.detail}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {task.blastRadius && task.blastRadius.length > 0 && (
            <section>
              <SectionLabel>Impact</SectionLabel>
              <div style={{ marginTop: 6 }}>
                <BlastRadiusBlock lines={task.blastRadius} />
              </div>
            </section>
          )}

          {task.groupRole === 'parent' && (() => {
            const children = allTasks
              .filter((t) => t.groupRole === 'child' && t.groupId === task.id)
              .sort((a, b) => {
                // Active rows before reverted ones; within each bucket
                // sort by the recipe name so the list reads alphabetically.
                const undoneA = a.status === 'undone' ? 1 : 0;
                const undoneB = b.status === 'undone' ? 1 : 0;
                if (undoneA !== undoneB) return undoneA - undoneB;
                const labelA = a.changes?.[0]?.entityLabel ?? a.title;
                const labelB = b.changes?.[0]?.entityLabel ?? b.title;
                return labelA.localeCompare(labelB);
              });
            if (children.length === 0) return null;
            const liveCount = children.filter((c) => c.status !== 'undone').length;
            return (
              <section>
                <SectionLabel>
                  Per-recipe changes · {liveCount}
                  {liveCount !== children.length ? ` of ${children.length}` : ''}
                </SectionLabel>
                <div style={{ marginTop: 6 }}>
                  {children.map((child) => (
                    <ChildRecipeRow
                      key={child.id}
                      child={child}
                      onRevert={onRevert}
                    />
                  ))}
                </div>
                <p
                  style={{
                    margin: '8px 0 0',
                    fontSize: 11.5,
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  Each row reverts only that recipe — the chat re-opens so
                  you can confirm. The Revert button at the bottom rolls
                  all {children.length} back in one go.
                </p>
              </section>
            );
          })()}

          {(linkChip || (groupChip && groupChip.kind !== 'parent')) && (
            <section>
              <SectionLabel>Linked entries</SectionLabel>
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {linkChip && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      borderRadius: 100,
                      background: '#fff',
                      border: '1px solid var(--color-border-subtle)',
                      color: 'var(--color-text-secondary)',
                      fontSize: 11.5,
                      fontWeight: 600,
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    <RotateCcw size={10} strokeWidth={2.4} />
                    {linkChip.label}
                  </span>
                )}
                {groupChip && groupChip.kind !== 'parent' && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      borderRadius: 100,
                      background: '#fff',
                      border: '1px dashed var(--color-border, rgba(0,28,53,0.18))',
                      color: 'var(--color-text-secondary)',
                      fontSize: 11.5,
                      fontWeight: 600,
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    <Link2 size={10} strokeWidth={2.4} />
                    {groupChip.label}
                  </span>
                )}
              </div>
            </section>
          )}

          {revertHint && (
            <div
              style={{
                padding: '8px 11px',
                borderRadius: 8,
                background: 'rgba(193, 110, 44, 0.08)',
                border: '1px solid rgba(193, 110, 44, 0.30)',
                fontSize: 12,
                color: '#7C4710',
                lineHeight: 1.45,
              }}
            >
              {revertHint}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              paddingTop: 4,
              borderTop: '1px dashed var(--color-border-subtle)',
            }}
          >
            <ActionButton
              icon={RotateCcw}
              label={(() => {
                if (task.groupRole !== 'parent') return 'Revert';
                const childCount = allTasks.filter(
                  (t) => t.groupRole === 'child' && t.groupId === task.id,
                ).length;
                return childCount > 0 ? `Revert all (${childCount})` : 'Revert';
              })()}
              disabled={task.status === 'undone'}
              onClick={tryRevert}
            />
            <ActionButton
              icon={Pencil}
              label="Edit"
              onClick={() => onEdit?.(task)}
              disabled={!onEdit || !task.commandIntent}
            />
            <ActionButton
              icon={ExternalLink}
              label="Open chat"
              onClick={() => onOpenChat?.(task)}
            />
            <div style={{ flex: 1 }} />
            <ActionButton
              icon={task.pinned ? PinOff : Pin}
              label={task.pinned ? 'Unpin' : 'Pin'}
              subtle
              onClick={() => togglePin(task.id)}
            />
            <ActionButton
              icon={XIcon}
              label="Remove"
              subtle
              onClick={() => {
                if (
                  typeof window !== 'undefined' &&
                  !window.confirm('Remove this entry from history? (The underlying change is not reverted.)')
                ) {
                  return;
                }
                removeTask(task.id);
              }}
            />
          </div>
        </div>
      )}
    </article>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--color-text-muted)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {children}
    </div>
  );
}

/**
 * One child of a batch (e.g. one recipe inside a "Added oat milk to 11
 * recipes" parent). Rendered inline in the parent's expanded view so the
 * operator can revert a single recipe without scrolling the log to find
 * the child row.
 */
function ChildRecipeRow({
  child,
  onRevert,
}: {
  child: Task;
  onRevert?: (task: Task) => boolean;
}) {
  const change = child.changes?.[0];
  const recipeName = change?.entityLabel ?? child.title;
  const verb = change?.fieldLabel;
  const undone = child.status === 'undone';
  const gpLine = child.blastRadius?.find((l) => l.metric === 'gp_pct');
  const gpDelta = gpLine?.delta ?? 0;
  const gpVisible = Math.abs(gpDelta) >= 0.05;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto auto',
        gap: 12,
        alignItems: 'center',
        padding: '8px 0',
        borderTop: '1px dashed var(--color-border-subtle)',
      }}
    >
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: undone ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
            textDecoration: undone ? 'line-through' : 'none',
            fontFamily: 'var(--font-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {recipeName}
        </span>
        {verb && (
          <span
            style={{
              fontSize: 11.5,
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {verb}
          </span>
        )}
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {gpVisible && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 100,
              background: '#fff',
              color: gpDelta > 0 ? '#22573F' : '#A8401C',
              border: `1px solid ${gpDelta > 0 ? '#22573F' : '#A8401C'}`,
              fontFamily: 'var(--font-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            GP {gpDelta > 0 ? '+' : '−'}
            {Math.abs(gpDelta)}
            {gpLine?.unit ?? 'pp'}
          </span>
        )}
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifySelf: 'end' }}>
        {undone ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: '2px 8px',
              borderRadius: 100,
              border: '1.5px solid var(--color-error, #A8401C)',
              color: 'var(--color-error, #A8401C)',
              background: '#fff',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Reverted
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onRevert?.(child)}
            disabled={!onRevert}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 9px',
              borderRadius: 6,
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              color: onRevert ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
              fontSize: 11.5,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: onRevert ? 'pointer' : 'not-allowed',
            }}
          >
            <RotateCcw size={11} strokeWidth={2.4} />
            Revert
          </button>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  subtle = false,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  subtle?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 11px',
        borderRadius: 8,
        background: disabled ? 'rgba(0, 28, 53, 0.03)' : subtle ? 'transparent' : '#fff',
        border: subtle ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
        color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <Icon size={12} strokeWidth={2.2} />
      {label}
    </button>
  );
}

const pillBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 100,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-primary)',
};

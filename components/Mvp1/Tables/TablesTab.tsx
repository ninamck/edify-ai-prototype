'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Plus,
  Trash2,
  Database,
  Sparkles,
  ListChecks,
  Pencil,
  GripVertical,
} from 'lucide-react';
import DataTable from './DataTable';
import { DATA_SOURCES, type Column } from './dataSources';
import { fullSourceQuery, runQuery, type Filter, type TableQuery } from './query';
import ViewFilterBar, {
  DEFAULT_VIEW_FILTERS,
  type ViewFilter,
} from './ViewFilterBar';
import {
  ANALYTICS_CONFIG,
  renderAnalyticsChart,
  type AnalyticsChartId,
} from '@/components/Analytics/AnalyticsCharts';
import QuinnInsightButton from '@/components/Dashboard/parts/QuinnInsightButton';
import type { BriefingRole } from '@/components/briefing';

export type TableOrigin =
  | { kind: 'preset'; questionId: string; questionText: string }
  | { kind: 'quinn'; prompt: string }
  | { kind: 'manual' };

export type TableInstance = {
  id: string;
  title?: string;
  query: TableQuery;
  origin?: TableOrigin;
  /**
   * If set, this table only renders when the current demo role is in the list.
   * Filtering happens at render time in `Mvp1Shell`; the entry stays in
   * persisted state regardless of role so toggling the role pill is reversible.
   */
  roleScope?: BriefingRole[];
};

export type ChartInstance = {
  id: string;
  chartId: AnalyticsChartId;
  title?: string;
  origin?: { kind: 'quinn'; prompt: string };
};

export type EmptyStateActions = {
  onAskQuinn?: () => void;
  onBrowseLibrary?: () => void;
  onOpenBuilder?: () => void;
};

type Props = {
  /** When true, drag handles and remove affordances are visible. */
  editing?: boolean;
  tables: TableInstance[];
  onChange: (next: TableInstance[]) => void;
  onEditQuery?: (instance: TableInstance) => void;
  charts?: ChartInstance[];
  onChartsChange?: (next: ChartInstance[]) => void;
  /** Initial view-level filters for this tab. Defaults to the standard preset
   *  (District Manager, Week No.). Pass `[]` for tabs that should start clean. */
  defaultFilters?: ViewFilter[];
} & EmptyStateActions;

export function genTableId(): string {
  return `tbl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function genChartId(): string {
  return `cht-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function defaultBlankInstance(): TableInstance {
  return {
    id: genTableId(),
    query: fullSourceQuery('sales'),
    origin: { kind: 'manual' },
  };
}

/**
 * Merge view-level filters into a table's query. A filter only applies if at
 * least one of the query's underlying sources actually has a column with that
 * key — otherwise we silently skip it (e.g. Week No. doesn't apply to the
 * NDCP daily table because that table doesn't have a `week_number` column).
 */
function applyViewFilters(query: TableQuery, viewFilters: ViewFilter[]): TableQuery {
  const extras: Filter[] = [];
  for (const vf of viewFilters) {
    if (vf.selected.length === 0) continue;
    const hasColumn = query.sources.some((sid) =>
      DATA_SOURCES[sid].columns.some((c) => c.key === vf.columnKey),
    );
    if (!hasColumn) continue;
    extras.push({
      field: { key: vf.columnKey },
      op: 'in',
      value: vf.selected.slice(),
    });
  }
  if (extras.length === 0) return query;
  return {
    ...query,
    filters: [...(query.filters ?? []), ...extras],
  };
}

export default function TablesTab({
  editing = false,
  tables,
  onChange,
  charts = [],
  onChartsChange,
  onAskQuinn,
  onBrowseLibrary,
  onOpenBuilder,
  onEditQuery,
  defaultFilters = DEFAULT_VIEW_FILTERS,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [viewFilters, setViewFilters] = useState<ViewFilter[]>(defaultFilters);

  function addBlankTable() {
    onChange([...tables, defaultBlankInstance()]);
  }

  function removeTable(id: string) {
    onChange(tables.filter((t) => t.id !== id));
  }

  function renameTable(id: string, title: string) {
    onChange(tables.map((t) => (t.id === id ? { ...t, title } : t)));
  }

  function reorderTables(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const fromIdx = tables.findIndex((t) => t.id === sourceId);
    const toIdx = tables.findIndex((t) => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = tables.slice();
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onChange(next);
  }

  function removeChart(id: string) {
    onChartsChange?.(charts.filter((c) => c.id !== id));
  }

  const isEmpty = tables.length === 0 && charts.length === 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 1400,
        margin: '0 auto',
        width: '100%',
      }}
    >
      {isEmpty ? (
        <EmptyState
          onAskQuinn={onAskQuinn}
          onBrowseLibrary={onBrowseLibrary}
          onOpenBuilder={onOpenBuilder}
          onAddBlank={addBlankTable}
        />
      ) : (
        <>
          <ViewFilterBar filters={viewFilters} onChange={setViewFilters} />
          {tables.map((t, idx) => (
            <TableCard
              key={t.id}
              instance={t}
              viewFilters={viewFilters}
              index={idx}
              editing={editing}
              canRemove={editing && tables.length + charts.length > 1}
              canReorder={editing && tables.length > 1}
              isDragging={draggingId === t.id}
              isDropTarget={dropTargetId === t.id && draggingId !== null && draggingId !== t.id}
              onRemove={() => removeTable(t.id)}
              onRename={(title) => renameTable(t.id, title)}
              onEditQuery={onEditQuery ? () => onEditQuery(t) : undefined}
              onDragStart={() => setDraggingId(t.id)}
              onDragEnter={() => {
                if (draggingId && draggingId !== t.id) setDropTargetId(t.id);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDropTargetId(null);
              }}
              onDrop={(sourceId) => {
                reorderTables(sourceId, t.id);
                setDraggingId(null);
                setDropTargetId(null);
              }}
            />
          ))}
          {charts.map((c) => (
            <ChartCard
              key={c.id}
              instance={c}
              canRemove={editing && tables.length + charts.length > 1}
              onRemove={() => removeChart(c.id)}
            />
          ))}
        </>
      )}

      {!isEmpty && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={addBlankTable} style={addButton}>
            <Plus size={13} strokeWidth={2.4} />
            <span>Add table</span>
          </button>
          {onBrowseLibrary && (
            <button type="button" onClick={onBrowseLibrary} style={addButton}>
              <ListChecks size={13} strokeWidth={2.4} />
              <span>Pick a question</span>
            </button>
          )}
          {onAskQuinn && (
            <button type="button" onClick={onAskQuinn} style={addButton}>
              <Sparkles size={13} strokeWidth={2.4} />
              <span>Ask Quinn</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const DRAG_MIME = 'application/x-edify-table-id';

function TableCard({
  instance,
  viewFilters,
  index,
  editing,
  canRemove,
  canReorder,
  isDragging,
  isDropTarget,
  onRemove,
  onRename,
  onEditQuery,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
}: {
  instance: TableInstance;
  viewFilters: ViewFilter[];
  index: number;
  /** Parent edit mode. When true, the title is always shown as an editable
   *  input — no need to double-click. */
  editing: boolean;
  canRemove: boolean;
  canReorder: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onRemove: () => void;
  onRename: (title: string) => void;
  onEditQuery?: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDrop: (sourceId: string) => void;
}) {
  const [columns, setColumns] = useState<Column[] | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(instance.title ?? '');
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Keep the draft in sync if the title changes from elsewhere (e.g. Quinn
  // chat replaces this table) and reset double-click edit mode whenever the
  // parent's edit toggle flips off.
  useEffect(() => {
    setDraftTitle(instance.title ?? '');
  }, [instance.title]);
  useEffect(() => {
    if (!editing) setEditingTitle(false);
  }, [editing]);

  // In parent edit mode the title is always shown as an input. Outside edit
  // mode, double-clicking the title flips this on locally.
  const showTitleInput = editing || editingTitle;
  // Only draggable while the user is actively grabbing the grip handle. This
  // prevents accidental drags from the title button or row content.
  const [dragArmed, setDragArmed] = useState(false);

  // Re-run when either the table's own query OR the view-level filters change.
  // We pre-compute a stable signature for the filter set so referential
  // identity changes (new array on every keystroke) don't cause spurious reloads.
  const filterSignature = useMemo(() => {
    return viewFilters
      .filter((f) => f.selected.length > 0)
      .map((f) => `${f.columnKey}:${f.selected.slice().sort().join(',')}`)
      .sort()
      .join('|');
  }, [viewFilters]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRows(null);
    setColumns(null);
    const effectiveQuery = applyViewFilters(instance.query, viewFilters);
    runQuery(effectiveQuery)
      .then((result) => {
        if (cancelled) return;
        setColumns(result.columns);
        setRows(result.rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load data';
        setError(msg);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.query, filterSignature]);

  const primarySource = DATA_SOURCES[instance.query.sources[0]];
  const fallbackTitle = primarySource?.label ?? 'Table';
  const displayTitle =
    instance.title?.trim() || `${fallbackTitle}${index === 0 ? '' : ` ${index + 1}`}`;

  const originLabel = describeOrigin(instance);

  const header = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {canReorder && (
          <span
            role="button"
            aria-label="Drag to reorder table"
            title="Drag to reorder"
            onMouseDown={() => setDragArmed(true)}
            onMouseUp={() => setDragArmed(false)}
            onMouseLeave={() => setDragArmed(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: 4,
              cursor: 'grab',
              color: 'var(--color-text-muted)',
              flexShrink: 0,
            }}
          >
            <GripVertical size={14} strokeWidth={2.2} />
          </span>
        )}
        {showTitleInput ? (
          <input
            autoFocus={editingTitle && !editing}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={() => {
              const trimmed = draftTitle.trim();
              if (trimmed && trimmed !== (instance.title ?? '')) onRename(trimmed);
              else setDraftTitle(instance.title ?? '');
              if (!editing) setEditingTitle(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === 'Escape') {
                setDraftTitle(instance.title ?? '');
                if (!editing) setEditingTitle(false);
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder={fallbackTitle}
            style={{
              fontFamily: 'var(--font-primary)',
              fontSize: 13,
              fontWeight: 700,
              padding: '3px 8px',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 6,
              background: '#fff',
              color: 'var(--color-text-primary)',
              outline: 'none',
              minWidth: 200,
            }}
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => {
              setDraftTitle(instance.title ?? '');
              setEditingTitle(true);
            }}
            title="Double-click to rename"
            style={{
              all: 'unset',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              cursor: 'text',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayTitle}
          </button>
        )}
        {originLabel && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            · {originLabel}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {onEditQuery && (
          <button
            type="button"
            onClick={onEditQuery}
            style={iconButton}
            aria-label="Edit query"
            title="Edit query"
          >
            <Pencil size={13} strokeWidth={2.2} />
          </button>
        )}
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            style={iconButton}
            aria-label="Remove table"
            title="Remove table"
          >
            <Trash2 size={13} strokeWidth={2.2} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div
      ref={cardRef}
      draggable={canReorder && dragArmed}
      onDragStart={(e) => {
        if (!canReorder || !dragArmed) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(DRAG_MIME, instance.id);
        // Fallback for browsers that won't fire drop without text/plain.
        e.dataTransfer.setData('text/plain', instance.id);
        if (cardRef.current) {
          // Use the card itself as the drag preview so the user sees what's moving.
          e.dataTransfer.setDragImage(cardRef.current, 24, 24);
        }
        onDragStart();
      }}
      onDragEnter={() => {
        if (canReorder) onDragEnter();
      }}
      onDragOver={(e) => {
        if (!canReorder) return;
        if (Array.from(e.dataTransfer.types).includes(DRAG_MIME) || e.dataTransfer.types.includes('text/plain')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }
      }}
      onDrop={(e) => {
        if (!canReorder) return;
        const sourceId =
          e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
        if (!sourceId) return;
        e.preventDefault();
        onDrop(sourceId);
      }}
      onDragEnd={() => {
        setDragArmed(false);
        onDragEnd();
      }}
      style={{
        opacity: isDragging ? 0.4 : 1,
        transition: 'opacity 0.12s ease, box-shadow 0.12s ease, outline 0.12s ease',
        borderRadius: 12,
        outline: isDropTarget ? '2px solid var(--color-accent-active)' : '2px solid transparent',
        outlineOffset: -2,
      }}
    >
      <DataTable
        columns={columns ?? []}
        data={rows ?? []}
        loading={(rows === null || columns === null) && !error}
        error={error}
        header={header}
      />
    </div>
  );
}

function describeOrigin(instance: TableInstance): string | null {
  if (!instance.origin) return null;
  if (instance.origin.kind === 'preset') return `From: ${instance.origin.questionText}`;
  if (instance.origin.kind === 'quinn') {
    const trimmed = instance.origin.prompt.trim();
    return trimmed ? `Asked Quinn: ${trimmed}` : 'Built with Quinn';
  }
  return null;
}

function ChartCard({
  instance,
  canRemove,
  onRemove,
}: {
  instance: ChartInstance;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const cfg = ANALYTICS_CONFIG[instance.chartId];
  const title = instance.title?.trim() || cfg?.label || 'Chart';
  const originLabel = instance.origin?.kind === 'quinn' && instance.origin.prompt.trim()
    ? `Asked Quinn: ${instance.origin.prompt.trim()}`
    : null;
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </span>
          {originLabel && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              · {originLabel}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cfg?.reasoning && (
            <QuinnInsightButton
              chartId={instance.chartId}
              text={cfg.reasoning}
              placement="left"
            />
          )}
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              style={iconButton}
              aria-label="Remove chart"
              title="Remove chart"
            >
              <Trash2 size={13} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>
      <div
        style={{
          padding: 8,
          background: '#fff',
          borderRadius: 8,
        }}
      >
        {renderAnalyticsChart(instance.chartId)}
      </div>
    </div>
  );
}

function EmptyState({
  onAskQuinn,
  onBrowseLibrary,
  onOpenBuilder,
  onAddBlank,
}: {
  onAskQuinn?: () => void;
  onBrowseLibrary?: () => void;
  onOpenBuilder?: () => void;
  onAddBlank: () => void;
}) {
  const hasAdvancedActions = Boolean(onAskQuinn || onBrowseLibrary || onOpenBuilder);

  if (!hasAdvancedActions) {
    return (
      <div style={emptyShell}>
        <Database size={20} strokeWidth={1.8} color="var(--color-text-muted)" />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            No tables yet
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Add a table to view your data here.</div>
        </div>
        <button type="button" onClick={onAddBlank} style={addButton}>
          <Plus size={13} strokeWidth={2.4} />
          <span>Add table</span>
        </button>
      </div>
    );
  }

  return (
    <div style={emptyShell}>
      <Database size={20} strokeWidth={1.8} color="var(--color-text-muted)" />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Build your first table
        </div>
        <div style={{ fontSize: 12, marginTop: 4 }}>
          Ask Quinn, pick a question, or build one manually.
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
          width: '100%',
          maxWidth: 720,
          marginTop: 4,
        }}
      >
        {onAskQuinn && (
          <ChoiceCard
            icon={<Sparkles size={16} strokeWidth={2.2} color="var(--color-accent-active)" />}
            title="Ask Quinn"
            description="Describe the table you want in your own words."
            onClick={onAskQuinn}
          />
        )}
        {onBrowseLibrary && (
          <ChoiceCard
            icon={<ListChecks size={16} strokeWidth={2.2} color="var(--color-text-secondary)" />}
            title="Pick a question"
            description="Start from a curated table-shaped question."
            onClick={onBrowseLibrary}
          />
        )}
        {onOpenBuilder && (
          <ChoiceCard
            icon={<Database size={16} strokeWidth={2.2} color="var(--color-text-secondary)" />}
            title="Build from scratch"
            description="Quinn opens with a starter table you can refine in chat."
            onClick={onOpenBuilder}
          />
        )}
      </div>
      <button
        type="button"
        onClick={onAddBlank}
        style={{
          ...addButton,
          marginTop: 4,
          background: 'transparent',
          border: '1px dashed var(--color-border-subtle)',
        }}
      >
        <Plus size={13} strokeWidth={2.4} />
        <span>Or just add a blank table</span>
      </button>
    </div>
  );
}

function ChoiceCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        padding: 14,
        borderRadius: 10,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        textAlign: 'left',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = '#fff';
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 6,
          background: 'var(--color-bg-hover)',
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</div>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
        {description}
      </div>
    </button>
  );
}

const emptyShell: CSSProperties = {
  padding: 32,
  textAlign: 'center',
  background: '#fff',
  border: '1px dashed var(--color-border-subtle)',
  borderRadius: 12,
  color: 'var(--color-text-muted)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 14,
};

const addButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  borderRadius: 100,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
};

const iconButton: CSSProperties = {
  all: 'unset',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  borderRadius: 6,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  cursor: 'pointer',
  color: 'var(--color-text-muted)',
};

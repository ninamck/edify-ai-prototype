'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Plus, Trash2, Database, Sparkles, ListChecks, Pencil } from 'lucide-react';
import DataTable from './DataTable';
import { DATA_SOURCES, type Column } from './dataSources';
import { fullSourceQuery, runQuery, type TableQuery } from './query';
import {
  ANALYTICS_CONFIG,
  renderAnalyticsChart,
  type AnalyticsChartId,
} from '@/components/Analytics/AnalyticsCharts';

export type TableOrigin =
  | { kind: 'preset'; questionId: string; questionText: string }
  | { kind: 'quinn'; prompt: string }
  | { kind: 'manual' };

export type TableInstance = {
  id: string;
  title?: string;
  query: TableQuery;
  origin?: TableOrigin;
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
  tables: TableInstance[];
  onChange: (next: TableInstance[]) => void;
  onEditQuery?: (instance: TableInstance) => void;
  charts?: ChartInstance[];
  onChartsChange?: (next: ChartInstance[]) => void;
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

export default function TablesTab({
  tables,
  onChange,
  charts = [],
  onChartsChange,
  onAskQuinn,
  onBrowseLibrary,
  onOpenBuilder,
  onEditQuery,
}: Props) {
  function addBlankTable() {
    onChange([...tables, defaultBlankInstance()]);
  }

  function removeTable(id: string) {
    onChange(tables.filter((t) => t.id !== id));
  }

  function renameTable(id: string, title: string) {
    onChange(tables.map((t) => (t.id === id ? { ...t, title } : t)));
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
          {tables.map((t, idx) => (
            <TableCard
              key={t.id}
              instance={t}
              index={idx}
              canRemove={tables.length + charts.length > 1}
              onRemove={() => removeTable(t.id)}
              onRename={(title) => renameTable(t.id, title)}
              onEditQuery={onEditQuery ? () => onEditQuery(t) : undefined}
            />
          ))}
          {charts.map((c) => (
            <ChartCard
              key={c.id}
              instance={c}
              canRemove={tables.length + charts.length > 1}
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

function TableCard({
  instance,
  index,
  canRemove,
  onRemove,
  onRename,
  onEditQuery,
}: {
  instance: TableInstance;
  index: number;
  canRemove: boolean;
  onRemove: () => void;
  onRename: (title: string) => void;
  onEditQuery?: () => void;
}) {
  const [columns, setColumns] = useState<Column[] | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(instance.title ?? '');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRows(null);
    setColumns(null);
    runQuery(instance.query)
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
  }, [instance.query]);

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
        {editingTitle ? (
          <input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={() => {
              onRename(draftTitle);
              setEditingTitle(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onRename(draftTitle);
                setEditingTitle(false);
              }
              if (e.key === 'Escape') {
                setDraftTitle(instance.title ?? '');
                setEditingTitle(false);
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
    <DataTable
      columns={columns ?? []}
      data={rows ?? []}
      loading={(rows === null || columns === null) && !error}
      error={error}
      header={header}
    />
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
            title="Build manually"
            description="Pick sources, columns, filters and group-by yourself."
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

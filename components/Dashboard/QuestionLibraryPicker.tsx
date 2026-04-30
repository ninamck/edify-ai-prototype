'use client';

import { useMemo } from 'react';
import { ChevronRight, Sparkles, ArrowUp, MessageSquare, X as XIcon, BarChart3, Table2 } from 'lucide-react';
import {
  QUESTION_LIBRARY,
  SEGMENT_LABELS,
  SEGMENT_ORDER,
  PRODUCTION_SUBSEGMENT_LABELS,
  PRODUCTION_SUBSEGMENT_ORDER,
  countsBySegment,
  countsByProductionSubsegment,
  searchQuestions,
  questionShape,
  DUNKIN_WIRED_QUESTION_IDS,
  type QuestionEntry,
  type QuestionSegment,
  type ProductionSubsegment,
} from '@/components/Dashboard/data/questionLibrary';
import type { BriefingRole } from '@/components/briefing';
import type { ConversationEntry } from '@/hooks/useConversationHistory';

const ACCENT = 'var(--color-accent-deep)';

export type SegmentKey = QuestionSegment | 'all';
export type ShapeFilter = 'all' | 'chart' | 'table';

export default function QuestionLibraryPicker({
  query,
  onQueryChange,
  onSubmit,
  segment,
  subsegment,
  shape = 'all',
  onShapeChange,
  onSegmentChange,
  onSubsegmentChange,
  briefingRole,
  onPick,
  recentConversations,
  onResumeConversation,
  onRemoveConversation,
  onClearConversations,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  /** Fires when the user submits the chat input (Enter or Send). */
  onSubmit: (text: string) => void;
  segment: SegmentKey;
  subsegment: ProductionSubsegment | null;
  /** Filter the list to only questions that produce a chart or a table. */
  shape?: ShapeFilter;
  onShapeChange?: (next: ShapeFilter) => void;
  onSegmentChange: (next: SegmentKey) => void;
  onSubsegmentChange: (next: ProductionSubsegment | null) => void;
  /** Active briefing role. When 'dunkin', the library is filtered to the
   *  questions we can answer with Dunkin franchise CSVs. */
  briefingRole?: BriefingRole;
  /** Fires when the user clicks a library question. */
  onPick: (entry: QuestionEntry) => void;
  /** Optional list of past conversations to show at the bottom of the rail. */
  recentConversations?: ConversationEntry[];
  onResumeConversation?: (entry: ConversationEntry) => void;
  onRemoveConversation?: (id: string) => void;
  onClearConversations?: () => void;
}) {
  const segCounts = useMemo(
    () => countsBySegment(briefingRole === 'dunkin' ? DUNKIN_WIRED_QUESTION_IDS : undefined),
    [briefingRole],
  );
  const subCounts = useMemo(
    () =>
      countsByProductionSubsegment(
        briefingRole === 'dunkin' ? DUNKIN_WIRED_QUESTION_IDS : undefined,
      ),
    [briefingRole],
  );

  const filtered = useMemo(() => {
    const shapeArg = shape === 'all' ? undefined : shape;
    return searchQuestions(
      query,
      segment === 'all' ? undefined : segment,
      segment === 'production' && subsegment ? subsegment : undefined,
      shapeArg,
      briefingRole,
    );
  }, [query, segment, subsegment, shape, briefingRole]);

  const canSend = query.trim().length > 0;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Prominent chat input — the primary way in */}
      <div
        style={{
          padding: '24px 24px 20px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#fff',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 10,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          <Sparkles size={11} color={ACCENT} strokeWidth={2.4} />
          Ask Quinn
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) onSubmit(query.trim());
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 14,
            border: '1.5px solid var(--color-border-subtle)',
            background: '#fff',
            boxShadow: '0 2px 10px rgba(58,48,40,0.06)',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLFormElement).style.borderColor = ACCENT as string;
            (e.currentTarget as HTMLFormElement).style.boxShadow = '0 2px 14px rgba(3,28,89,0.12)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLFormElement).style.borderColor = 'var(--color-border-subtle)';
            (e.currentTarget as HTMLFormElement).style.boxShadow = '0 2px 10px rgba(58,48,40,0.06)';
          }}
        >
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Ask anything about your data…"
            autoFocus
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-primary)',
            }}
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Ask Quinn"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 999,
              border: 'none',
              background: canSend ? 'var(--color-nav-primary)' : 'var(--color-bg-hover)',
              color: canSend ? '#fff' : 'var(--color-text-muted)',
              cursor: canSend ? 'pointer' : 'not-allowed',
              transition: 'background 0.12s',
            }}
          >
            <ArrowUp size={16} strokeWidth={2.4} />
          </button>
        </form>

        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 22,
            marginBottom: 4,
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'var(--color-border-subtle)' }} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
            }}
          >
            Or browse
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border-subtle)' }} />
        </div>

        <div
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-primary)',
              }}
            >
              {QUESTION_LIBRARY.length} curated operator questions
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-muted)',
              }}
            >
              Pick a category to narrow down, or scan the list below.
            </div>
          </div>
          {onShapeChange && (
            <ShapeToggle value={shape} onChange={onShapeChange} />
          )}
        </div>
      </div>

      {/* Rail + list */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 232,
            flexShrink: 0,
            borderRight: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-canvas)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '10px 8px',
            gap: 1,
          }}
        >
          <SegmentRow
            label="All"
            count={QUESTION_LIBRARY.length}
            active={segment === 'all'}
            onClick={() => {
              onSegmentChange('all');
              onSubsegmentChange(null);
            }}
          />
          {SEGMENT_ORDER.map((s) => (
            <div key={s}>
              <SegmentRow
                label={SEGMENT_LABELS[s]}
                count={segCounts[s]}
                active={segment === s && !subsegment}
                onClick={() => {
                  onSegmentChange(s);
                  onSubsegmentChange(null);
                }}
              />
              {s === 'production' && segment === 'production' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 1 }}>
                  {PRODUCTION_SUBSEGMENT_ORDER.map((sub) => (
                    <SegmentRow
                      key={sub}
                      label={PRODUCTION_SUBSEGMENT_LABELS[sub]}
                      count={subCounts[sub]}
                      active={subsegment === sub}
                      indent
                      onClick={() => onSubsegmentChange(sub)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {recentConversations && recentConversations.length > 0 && (
            <RailRecentList
              entries={recentConversations}
              onResume={(e) => onResumeConversation?.(e)}
              onRemove={(id) => onRemoveConversation?.(id)}
              onClear={onClearConversations}
            />
          )}
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
            overflowY: 'auto',
            padding: '6px 8px 12px',
          }}
        >
          {filtered.length === 0 ? (
            <EmptyState query={query} onAsk={() => onSubmit(query.trim())} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {filtered.map((entry) => (
                <QuestionRow
                  key={entry.id}
                  entry={entry}
                  briefingRole={briefingRole}
                  onPick={() => onPick(entry)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SegmentRow({
  label,
  count,
  active,
  indent,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  indent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px',
        paddingLeft: indent ? 22 : 10,
        borderRadius: 8,
        border: 'none',
        background: active ? 'var(--color-bg-hover)' : 'transparent',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        fontSize: 13,
        fontWeight: active ? 700 : 600,
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <span>{label}</span>
      <span
        style={{
          fontSize: 11,
          fontWeight: active ? 700 : 500,
          color: 'var(--color-text-muted)',
        }}
      >
        {count}
      </span>
    </button>
  );
}

function QuestionRow({
  entry,
  briefingRole,
  onPick,
}: {
  entry: QuestionEntry;
  briefingRole?: BriefingRole;
  onPick: () => void;
}) {
  const shape = questionShape(entry, briefingRole);
  return (
    <button
      type="button"
      onClick={onPick}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 10,
        alignItems: 'center',
        padding: '11px 14px',
        borderRadius: 8,
        border: 'none',
        background: 'transparent',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
        {entry.text}
      </span>
      <ShapeBadge shape={shape} />
      <ChevronRight size={14} color="var(--color-text-muted)" strokeWidth={2} />
    </button>
  );
}

function ShapeToggle({
  value,
  onChange,
}: {
  value: ShapeFilter;
  onChange: (next: ShapeFilter) => void;
}) {
  const options: { id: ShapeFilter; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All', icon: null },
    {
      id: 'chart',
      label: 'Charts',
      icon: <BarChart3 size={11} strokeWidth={2.4} />,
    },
    {
      id: 'table',
      label: 'Tables',
      icon: <Table2 size={11} strokeWidth={2.4} />,
    },
  ];
  return (
    <div
      role="tablist"
      aria-label="Filter by shape"
      style={{
        display: 'inline-flex',
        padding: 3,
        borderRadius: 999,
        background: 'var(--color-bg-hover)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              color: active ? '#fff' : 'var(--color-text-muted)',
              background: active ? 'var(--color-accent-active)' : 'transparent',
            }}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ShapeBadge({ shape }: { shape: 'chart' | 'table' | 'both' }) {
  const items: { icon: React.ReactNode; title: string }[] =
    shape === 'both'
      ? [
          { icon: <BarChart3 size={11} strokeWidth={2.2} />, title: 'Chart available' },
          { icon: <Table2 size={11} strokeWidth={2.2} />, title: 'Table available' },
        ]
      : shape === 'table'
      ? [{ icon: <Table2 size={11} strokeWidth={2.2} />, title: 'Table available' }]
      : [{ icon: <BarChart3 size={11} strokeWidth={2.2} />, title: 'Chart available' }];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 6px',
        borderRadius: 999,
        background: 'var(--color-bg-hover)',
        color: 'var(--color-text-muted)',
      }}
    >
      {items.map((item, i) => (
        <span key={i} title={item.title} style={{ display: 'inline-flex' }}>
          {item.icon}
        </span>
      ))}
    </span>
  );
}

function EmptyState({ query, onAsk }: { query: string; onAsk: () => void }) {
  const q = query.trim();
  return (
    <div
      style={{
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'var(--color-bg-hover)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Sparkles size={20} color={ACCENT} strokeWidth={2} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          No library match{q ? ` for "${q}"` : ''}.
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--color-text-muted)',
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          Quinn can still answer. Try the question directly.
        </div>
      </div>
      {q && (
        <button
          type="button"
          onClick={onAsk}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 14px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--color-nav-primary)',
            color: '#fff',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Ask Quinn: &ldquo;{q.length > 40 ? q.slice(0, 40) + '…' : q}&rdquo;
        </button>
      )}
    </div>
  );
}

function RailRecentList({
  entries,
  onResume,
  onRemove,
  onClear,
}: {
  entries: ConversationEntry[];
  onResume: (entry: ConversationEntry) => void;
  onRemove: (id: string) => void;
  onClear?: () => void;
}) {
  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: '1px solid var(--color-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px 6px',
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          Recent
        </span>
        {onClear && entries.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              padding: '2px 4px',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {entries.map((entry) => (
        <RailRecentRow
          key={entry.id}
          entry={entry}
          onResume={() => onResume(entry)}
          onRemove={() => onRemove(entry.id)}
        />
      ))}
    </div>
  );
}

function RailRecentRow({
  entry,
  onResume,
  onRemove,
}: {
  entry: ConversationEntry;
  onResume: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 8,
        transition: 'background 0.1s',
      }}
      className="rail-recent-row"
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'var(--color-bg-hover)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      <button
        type="button"
        onClick={onResume}
        title={entry.question}
        style={{
          all: 'unset',
          flex: 1,
          minWidth: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 30px 7px 10px',
        }}
      >
        <MessageSquare
          size={12}
          strokeWidth={2.2}
          color="var(--color-text-muted)"
          style={{ flexShrink: 0 }}
        />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {entry.question}
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove conversation"
        style={{
          position: 'absolute',
          right: 4,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 22,
          height: 22,
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(58,48,40,0.08)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        <XIcon size={11} strokeWidth={2.2} />
      </button>
    </div>
  );
}

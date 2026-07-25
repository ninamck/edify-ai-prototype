'use client';

import { useMemo } from 'react';
import { ChevronRight, ArrowUp, BarChart3, Table2, Clock, Lock } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
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
  recentCount = 0,
  onShowRecent,
  askLocked = false,
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
  /** Number of saved past conversations — drives the count badge on the
   *  "Recent chats" pill. The pill is hidden when this is 0 (or when no
   *  `onShowRecent` callback is provided). */
  recentCount?: number;
  /** Fires when the user clicks the "Recent chats" pill. The parent swaps
   *  the side-sheet body to a full-panel recents view (no nested drawer). */
  onShowRecent?: () => void;
  /** Viewing vs asking: when true the free-text ask input is replaced with a
   *  locked notice (asking new questions is admin-only for now) and the user
   *  can only pick from the curated library. */
  askLocked?: boolean;
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
  const showRecentPill = !!onShowRecent && recentCount > 0;

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
          <EdifyMark size={11} color={ACCENT} strokeWidth={2.4} />
          Ask Edify
        </div>

        {askLocked ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderRadius: 14,
              border: '1.5px dashed var(--color-border)',
              background: 'var(--color-bg-hover)',
            }}
          >
            <Lock size={15} strokeWidth={2.2} color="var(--color-text-muted)" />
            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
              <strong>Asking Edify new questions is admin-only for now.</strong>{' '}
              You can pin any of the curated questions below — they always answer
              with your own sites’ data.
            </div>
          </div>
        ) : (
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
            boxShadow: '0 2px 10px rgba(0, 28, 53,0.06)',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLFormElement).style.borderColor = ACCENT as string;
            (e.currentTarget as HTMLFormElement).style.boxShadow = '0 2px 14px rgba(0, 28, 53,0.12)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLFormElement).style.borderColor = 'var(--color-border-subtle)';
            (e.currentTarget as HTMLFormElement).style.boxShadow = '0 2px 10px rgba(0, 28, 53,0.06)';
          }}
        >
          <EdifyMark size={16} color={ACCENT} strokeWidth={2.2} />
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
            aria-label="Ask Edify"
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
        )}

        {showRecentPill && (
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="button"
              onClick={onShowRecent}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 11px 6px 10px',
                borderRadius: 999,
                border: '1px solid var(--color-border-subtle)',
                background: '#fff',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                transition: 'background 0.12s, border-color 0.12s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  'var(--color-accent-deep)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#fff';
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  'var(--color-border-subtle)';
              }}
            >
              <Clock size={12} strokeWidth={2.2} />
              Recent chats
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 18,
                  height: 18,
                  padding: '0 6px',
                  borderRadius: 999,
                  background: 'var(--color-bg-hover)',
                  color: 'var(--color-text-muted)',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {recentCount}
              </span>
            </button>
          </div>
        )}

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
        <EdifyMark size={20} color={ACCENT} strokeWidth={2} />
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
          Edify can still answer. Try the question directly.
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
          Ask Edify: &ldquo;{q.length > 40 ? q.slice(0, 40) + '…' : q}&rdquo;
        </button>
      )}
    </div>
  );
}


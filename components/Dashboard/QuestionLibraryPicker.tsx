'use client';

import { useMemo } from 'react';
import { ChevronRight, ArrowUp } from 'lucide-react';
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
  type QuestionEntry,
  type QuestionSegment,
  type ProductionSubsegment,
} from '@/components/Dashboard/data/questionLibrary';

const ACCENT = 'var(--color-accent-deep)';

export type SegmentKey = QuestionSegment | 'all';

export default function QuestionLibraryPicker({
  query,
  onQueryChange,
  onSubmit,
  segment,
  subsegment,
  onSegmentChange,
  onSubsegmentChange,
  onPick,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  /** Fires when the user submits the chat input (Enter or Send). */
  onSubmit: (text: string) => void;
  segment: SegmentKey;
  subsegment: ProductionSubsegment | null;
  onSegmentChange: (next: SegmentKey) => void;
  onSubsegmentChange: (next: ProductionSubsegment | null) => void;
  /** Fires when the user clicks a library question. */
  onPick: (entry: QuestionEntry) => void;
}) {
  const segCounts = useMemo(countsBySegment, []);
  const subCounts = useMemo(countsByProductionSubsegment, []);

  const filtered = useMemo(() => {
    return searchQuestions(
      query,
      segment === 'all' ? undefined : segment,
      segment === 'production' && subsegment ? subsegment : undefined,
    );
  }, [query, segment, subsegment]);

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
          padding: '16px 20px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#fff',
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) onSubmit(query.trim());
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
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
          <EdifyMark size={16} color={ACCENT} strokeWidth={2.2} />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Ask Quinn anything about your data…"
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
          style={{
            marginTop: 10,
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--color-text-muted)',
          }}
        >
          Or pick one of {QUESTION_LIBRARY.length} curated operator questions below.
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
  onPick,
}: {
  entry: QuestionEntry;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
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
      <ChevronRight size={14} color="var(--color-text-muted)" strokeWidth={2} />
    </button>
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

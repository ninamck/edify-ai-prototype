'use client';

/**
 * Full-panel "Recent chats" body for AddInsightPopup.
 *
 * Visually a sibling of `TaskHistoryList` — bare outline glyph + title
 * row, Notion-style uppercase section header, hover-only × control,
 * neutral hairline empty state. The drawer shell (header, padding,
 * width) lives in AddInsightPopup so this file owns only the body so
 * it can stay swap-friendly.
 */

import { useState } from 'react';
import { MessageSquare, X as XIcon } from 'lucide-react';
import type { ConversationEntry } from '@/hooks/useConversationHistory';

export default function RecentChatsView({
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
  if (entries.length === 0) {
    return (
      <div>
        <SectionHeader label="Recent" />
        <EmptyState />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader label="Recent" />

      <div
        style={{
          marginTop: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {entries.map((entry) => (
          <ChatRow
            key={entry.id}
            entry={entry}
            onResume={() => onResume(entry)}
            onRemove={() => onRemove(entry.id)}
          />
        ))}
      </div>

      {onClear && (
        <button
          type="button"
          onClick={onClear}
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
          Clear all
        </button>
      )}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
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

function ChatRow({
  entry,
  onResume,
  onRemove,
}: {
  entry: ConversationEntry;
  onResume: () => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onResume}
      title={entry.question}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 8px',
        borderRadius: '6px',
        background: hovered ? 'rgba(0,28,53,0.04)' : 'transparent',
        transition: 'background 0.12s ease',
        cursor: 'pointer',
      }}
    >
      <MessageSquare
        size={15}
        color="var(--color-text-muted)"
        strokeWidth={1.8}
        style={{ flexShrink: 0 }}
      />

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
        {entry.question}
      </span>

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
          aria-label="Remove chat"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
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
        Ask Edify a question and follow up — saved chats land here so you can
        pick them up again.
      </div>
    </div>
  );
}

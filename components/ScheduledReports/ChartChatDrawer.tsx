'use client';

/**
 * Per-chart chat — prototype dead end.
 *
 * Opens with an Ask Edify greeting about the chart plus suggested prompts.
 * Every user message gets a canned, typing-delayed acknowledgement; the
 * loop never resolves further. The point is to show where the
 * chat-with-this-chart entry point lives, not to answer anything.
 * Bubble UI is a small local copy — Feed's bubbles aren't exported and
 * embedding the whole Feed here would be far too heavy.
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import DrawerShell from './DrawerShell';

const NAVY = '#001C35';
const BRAND_PINK = '#FF0058';

type ChatMsg = { id: number; role: 'quinn' | 'user'; text: string };

const SUGGESTED_PROMPTS = [
  'Why is this trending down?',
  'Show last 4 weeks',
  'Break down by site',
];

const CANNED_REPLIES = [
  'Good question — I\u2019d pull the underlying lines apart and compare against the trailing four weeks. In the live product this is where I\u2019d run that analysis and update the chart for you.',
  'I\u2019ve noted that. In the live product I\u2019d re-cut this view and offer to pin the result to your dashboard.',
  'That needs a look at the item-level data behind this chart. This prototype stops here, but this is exactly the kind of question the chat answers in the product.',
];

export default function ChartChatDrawer({
  open,
  onClose,
  insightTitle,
}: {
  open: boolean;
  onClose: () => void;
  insightTitle: string;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Fresh greeting every time the drawer opens — reset during render (the
  // "adjusting state when props change" pattern) rather than in an effect.
  const sessionKey = open ? insightTitle : null;
  const [prevSessionKey, setPrevSessionKey] = useState<string | null>(null);
  if (sessionKey !== prevSessionKey) {
    setPrevSessionKey(sessionKey);
    if (sessionKey !== null) {
      setDraft('');
      setTyping(false);
      setMessages([
        {
          id: 1,
          role: 'quinn',
          text: `You're looking at "${insightTitle}". Ask me anything about it — what's driving it, a different cut, or a change to the view.`,
        },
      ]);
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    // IDs and the canned-reply rotation both derive from the message list,
    // so a fresh greeting (one message) resets them for free.
    const reply = CANNED_REPLIES[messages.filter((m) => m.role === 'user').length % CANNED_REPLIES.length];
    setMessages((prev) => [...prev, { id: prev.length + 1, role: 'user', text: trimmed }]);
    setDraft('');
    setTyping(true);
    window.setTimeout(() => {
      setMessages((prev) => [...prev, { id: prev.length + 1, role: 'quinn', text: reply }]);
      setTyping(false);
    }, 900);
  }

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      title={`Chat about: ${insightTitle}`}
      subtitle="Prototype — replies are canned"
      width={420}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '14px 14px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '9px 12px',
                borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: m.role === 'user' ? NAVY : 'var(--color-bg-surface, #F5F6F8)',
                color: m.role === 'user' ? '#fff' : 'var(--color-text-primary)',
                fontSize: 12.5,
                lineHeight: 1.5,
              }}
            >
              {m.role === 'quinn' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 11, marginBottom: 3, color: 'var(--color-text-muted)' }}>
                  <EdifyMark size={11} color={BRAND_PINK} /> Ask Edify
                </span>
              )}
              <div>{m.text}</div>
            </div>
          ))}
          {typing && (
            <div
              style={{
                alignSelf: 'flex-start',
                padding: '9px 12px',
                borderRadius: '12px 12px 12px 2px',
                background: 'var(--color-bg-surface, #F5F6F8)',
                fontSize: 12.5,
                color: 'var(--color-text-muted)',
              }}
            >
              Ask Edify is typing…
            </div>
          )}
        </div>

        {/* Suggested prompts */}
        <div style={{ padding: '6px 14px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              style={{
                border: '1px solid var(--color-border-subtle)',
                background: '#fff',
                borderRadius: 999,
                padding: '5px 10px',
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Composer */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '10px 14px 14px',
            borderTop: '1px solid var(--color-border-subtle)',
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send(draft);
            }}
            placeholder="Ask about this chart…"
            style={{
              flex: 1,
              minWidth: 0,
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 10,
              padding: '9px 12px',
              fontSize: 12.5,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <button
            onClick={() => send(draft)}
            aria-label="Send"
            disabled={!draft.trim() || typing}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: 'none',
              background: draft.trim() && !typing ? NAVY : 'var(--color-border-subtle)',
              color: '#fff',
              cursor: draft.trim() && !typing ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ArrowUp size={16} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </DrawerShell>
  );
}

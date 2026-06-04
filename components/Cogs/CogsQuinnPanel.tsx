'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, X } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import EdifyMarkThinking from '@/components/EdifyMark/EdifyMarkThinking';
import { renderMarkdownLite } from './markdownLite';
import { COGS_PATTERNS, COGS_SUGGESTED_QUESTIONS, getCogsChatAnswer } from './insights';

type ChatMessage = {
  id: string;
  role: 'user' | 'quinn';
  text: string;
  thinking?: boolean;
  rowIds?: string[];
};

const GREETING =
  "I've read this period's stocktake for Pret Hub Kitchen. Ask me where the COGS variance is coming from and I'll point you at the lines that matter.";

export default function CogsQuinnPanel({
  open,
  onOpenChange,
  onHighlightRows,
  onRequestVarianceTab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHighlightRows?: (ids: string[]) => void;
  onRequestVarianceTab?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'greeting', role: 'quinn', text: GREETING },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setDraft('');
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: q };
    const thinkingId = `t-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: thinkingId, role: 'quinn', text: '', thinking: true },
    ]);

    const answer = getCogsChatAnswer(q);
    window.setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? { id: thinkingId, role: 'quinn', text: answer.text, rowIds: answer.rowIds }
            : m,
        ),
      );
      setBusy(false);
      if (answer.rowIds && answer.rowIds.length > 0) {
        onHighlightRows?.(answer.rowIds);
      }
    }, 1400);
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label="Ask Edify about COGS"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 300,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 18px',
          borderRadius: 999,
          border: 'none',
          background: 'var(--color-quinn-bg)',
          color: 'var(--color-quinn-label)',
          fontFamily: 'var(--font-primary)',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 8px 28px rgba(0, 28, 53,0.28)',
        }}
      >
        <EdifyMark size={16} color="#fff" />
        Ask Edify
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => onOpenChange(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 28, 53, 0.18)',
                zIndex: 310,
              }}
            />
            <motion.aside
              key="panel"
              initial={{ x: 420, opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 420, opacity: 0.4 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                height: '100vh',
                width: 'min(420px, 100vw)',
                background: '#fff',
                borderLeft: '1px solid var(--color-border-subtle)',
                boxShadow: '-12px 0 36px rgba(0, 28, 53,0.16)',
                zIndex: 320,
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'var(--font-primary)',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '16px 18px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--color-accent-deep)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <EdifyMark size={16} color="#fff" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Edify · COGS analyst
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    Pret Hub Kitchen · this period
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    border: 'none',
                    background: 'var(--color-bg-hover)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={14} color="var(--color-text-muted)" />
                </button>
              </div>

              {/* Patterns summary */}
              <div
                style={{
                  padding: '12px 18px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  background: 'var(--color-bg-hover)',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                    marginBottom: 8,
                  }}
                >
                  Patterns Edify spotted
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {COGS_PATTERNS.map((p) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span
                        style={{
                          marginTop: 5,
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background:
                            p.severity === 'high'
                              ? 'var(--color-error)'
                              : p.severity === 'medium'
                                ? 'var(--color-warning)'
                                : 'var(--color-success)',
                        }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {p.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '88%',
                        padding: '10px 13px',
                        borderRadius: 12,
                        fontSize: 13,
                        lineHeight: 1.55,
                        background:
                          m.role === 'user' ? 'var(--color-accent-deep)' : 'var(--color-bg-hover)',
                        color: m.role === 'user' ? '#fff' : 'var(--color-text-secondary)',
                        border:
                          m.role === 'user' ? 'none' : '1px solid var(--color-border-subtle)',
                      }}
                    >
                      {m.thinking ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            fontStyle: 'italic',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          <EdifyMarkThinking size={18} color="var(--color-accent-deep)" />
                          Reading the stocktake…
                        </span>
                      ) : (
                        renderMarkdownLite(m.text)
                      )}
                    </div>
                    {!m.thinking && m.rowIds && m.rowIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          onHighlightRows?.(m.rowIds!);
                          onRequestVarianceTab?.();
                        }}
                        style={{
                          marginTop: 6,
                          padding: '5px 10px',
                          borderRadius: 7,
                          border: '1px solid var(--color-border)',
                          background: '#fff',
                          color: 'var(--color-accent-deep)',
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: 'var(--font-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        Show {m.rowIds.length} line{m.rowIds.length > 1 ? 's' : ''} in variance table
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Suggested chips */}
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  flexWrap: 'wrap',
                  padding: '10px 18px 0',
                }}
              >
                {COGS_SUGGESTED_QUESTIONS.map((qstn) => (
                  <button
                    key={qstn}
                    type="button"
                    onClick={() => ask(qstn)}
                    disabled={busy}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      border: '1px solid var(--color-border)',
                      background: '#fff',
                      color: 'var(--color-text-secondary)',
                      fontSize: 11.5,
                      fontWeight: 600,
                      fontFamily: 'var(--font-primary)',
                      cursor: busy ? 'default' : 'pointer',
                      opacity: busy ? 0.5 : 1,
                    }}
                  >
                    {qstn}
                  </button>
                ))}
              </div>

              {/* Composer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(draft);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 18px 16px',
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask about the COGS variance…"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--color-border)',
                    outline: 'none',
                    fontSize: 13,
                    fontFamily: 'var(--font-primary)',
                    color: 'var(--color-text-primary)',
                  }}
                />
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  aria-label="Send"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--color-accent-deep)',
                    color: '#fff',
                    cursor: busy || !draft.trim() ? 'default' : 'pointer',
                    opacity: busy || !draft.trim() ? 0.5 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Send size={16} />
                </button>
              </form>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { getDunkinInsight } from '@/components/Analytics/DunkinAnalyticsInsights';

/**
 * A small EdifyMark icon button shown on charts that have a Quinn comment.
 * Click to toggle a popover with the insight text. Click outside / Esc to close.
 *
 * When a `chartId` is provided and that id has a registered live-insight
 * builder (Dunkin charts only at the moment), the popover hydrates with a
 * data-driven narrative computed from the underlying CSV. Other chart ids
 * keep the static `text` prop as the popover content — so legacy demos are
 * unaffected.
 */
export default function QuinnInsightButton({
  text,
  chartId,
  placement = 'below',
}: {
  text: string;
  /** Optional chart id; when matched by a live-insight builder the popover
   *  will replace `text` with a CSV-backed narrative on first open. */
  chartId?: string;
  /** Where the popover opens relative to the button. */
  placement?: 'below' | 'left';
}) {
  const [open, setOpen] = useState(false);
  // Live insight (only used when `chartId` resolves through the registry).
  // `null` means "not yet requested", `''` means "loading", anything else
  // is the resolved narrative.
  const [liveInsight, setLiveInsight] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Lazily fetch a live insight the first time the popover opens. Subsequent
  // opens reuse the cached narrative; if the chartId changes we re-fetch.
  useEffect(() => {
    if (!open || !chartId) return;
    if (liveInsight !== null) return; // already loaded for this chartId
    const promise = getDunkinInsight(chartId);
    if (!promise) return; // legacy chart id — fall back to static text
    let cancelled = false;
    setLiveInsight('');
    promise
      .then((value) => {
        if (cancelled) return;
        setLiveInsight(value && value.trim().length > 0 ? value : text);
      })
      .catch(() => {
        if (!cancelled) setLiveInsight(text);
      });
    return () => {
      cancelled = true;
    };
  }, [open, chartId, liveInsight, text]);

  // Reset cached insight if the consumer swaps the chartId in place.
  useEffect(() => {
    setLiveInsight(null);
  }, [chartId]);

  const isLoading = liveInsight === '';
  const popoverText = liveInsight && liveInsight.length > 0 ? liveInsight : text;

  const popoverStyle =
    placement === 'left'
      ? { top: 0, right: 38 }
      : { top: 36, right: 0 };

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Quinn insight"
        title="Quinn insight"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          borderRadius: 999,
          border: `1px solid ${open ? 'var(--color-accent-deep)' : 'var(--color-border-subtle)'}`,
          background: open ? 'var(--color-bg-hover)' : '#fff',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--color-accent-deep)',
          letterSpacing: '0.02em',
          transition: 'background 0.12s, border-color 0.12s',
        }}
      >
        <EdifyMark size={12} strokeWidth={2.2} />
        Quinn
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="popover"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            style={{
              position: 'absolute',
              zIndex: 50,
              width: 320,
              maxWidth: 'min(320px, 80vw)',
              padding: '14px 16px',
              borderRadius: 12,
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: '0 12px 36px rgba(3,28,89,0.18)',
              fontFamily: 'var(--font-primary)',
              ...popoverStyle,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <EdifyMark size={13} color="var(--color-accent-deep)" strokeWidth={2.2} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                  Quinn · What I&rsquo;m seeing
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
                aria-label="Close"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--color-bg-hover)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={11} color="var(--color-text-muted)" />
              </button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
              {isLoading ? (
                <span style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                  Crunching the numbers…
                </span>
              ) : (
                renderMarkdownLite(popoverText)
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Minimal **bold** renderer for the reasoning strings stored in ANALYTICS_CONFIG. */
function renderMarkdownLite(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={i} style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { renderMarkdownLite } from './markdownLite';

const POPOVER_WIDTH = 320;

/**
 * Edify insight pill for the COGS surfaces. Identical in look to the shared
 * QuinnInsightButton, but the popover is rendered into a portal on
 * document.body with fixed positioning so it escapes the table's overflow
 * scroll containers (and the breakdown card's overflow:hidden) instead of
 * being clipped. Position is measured from the trigger's bounding rect and
 * flips above the trigger when there isn't room below.
 */
export default function CogsInsightButton({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Measure once the popover is in the DOM so we know its real height and
  // can flip it above the trigger if it would overflow the viewport.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const popH = popRef.current?.offsetHeight ?? 180;
    const margin = 8;

    let left = r.right - POPOVER_WIDTH; // align right edges with the pill
    left = Math.max(margin, Math.min(left, window.innerWidth - POPOVER_WIDTH - margin));

    let top = r.bottom + 6;
    if (top + popH > window.innerHeight - margin) {
      const above = r.top - popH - 6;
      top = above >= margin ? above : Math.max(margin, window.innerHeight - popH - margin);
    }
    setCoords({ top, left });
  }, [open, text]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    // A fixed popover can't follow content that scrolls underneath it, so
    // close on any scroll/resize rather than leave it detached.
    function onReflow() {
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Edify insight"
        title="Edify insight"
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
        Edify
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              zIndex: 1000,
              width: POPOVER_WIDTH,
              maxWidth: 'min(320px, 90vw)',
              padding: '14px 16px',
              borderRadius: 12,
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: '0 12px 36px rgba(0, 28, 53,0.18)',
              fontFamily: 'var(--font-primary)',
              visibility: coords ? 'visible' : 'hidden',
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
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Edify · What I&rsquo;m seeing
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
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                lineHeight: 1.55,
              }}
            >
              {renderMarkdownLite(text)}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

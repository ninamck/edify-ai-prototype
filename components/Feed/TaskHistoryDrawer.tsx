'use client';

/**
 * Slide-in panel variant of TaskHistoryList.
 *
 * The inline list under the prompt chips is great for "what did I just
 * do" — but when an operator wants to scroll through everything they've
 * touched, they need a roomier surface. This drawer renders the same
 * TaskHistoryList in `defaultExpanded` mode, anchored to the right
 * edge, with a backdrop for dismiss.
 *
 * Implementation notes:
 *   • Rendered through a React portal into document.body so it can
 *     escape any clipping parents (the chat panel uses overflow:hidden
 *     in places). Same trick as the quick-actions popover.
 *   • Locks body scroll while open.
 *   • ESC + backdrop click close it.
 *   • Slide animation uses requestAnimationFrame double-frame so the
 *     "enter" transition is reliable without a layout effect dance.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import TaskHistoryList from './TaskHistoryList';
import type { Task } from './taskHistoryStore';

const DRAWER_WIDTH = 420;

export interface TaskHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Forwarded to the underlying list — fires when a task should be
   *  re-opened in the chat surface. The list takes care of closing
   *  the drawer afterwards via the `onCloseAfterNavigate` callback. */
  onOpenTask?: (task: Task) => void;
}

export default function TaskHistoryDrawer({ open, onClose, onOpenTask }: TaskHistoryDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);

  // Mount only on client (createPortal needs document).
  useEffect(() => {
    setMounted(true);
  }, []);

  // Drive the enter transition on every open.
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    // Double-rAF guarantees the initial styles (opacity 0,
    // translateX(100%)) get flushed before we toggle to the entered
    // state, so the transition actually plays.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [open]);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        pointerEvents: 'auto',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 12, 24, 0.36)',
          opacity: entered ? 1 : 0,
          transition: 'opacity 180ms ease',
        }}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Task history"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(92vw, ' + DRAWER_WIDTH + 'px)',
          background: '#fff',
          boxShadow: '-12px 0 32px rgba(0, 12, 24, 0.22)',
          borderLeft: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-primary)',
          transform: entered ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Header — Notion-style. Just the title in muted-bold and a
            close button. No coloured chip, no subtitle clutter; the
            drawer's whole purpose is "your history", spelling that
            out a second time in a tagline doesn't earn its weight. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 18px',
            borderBottom: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--color-text-secondary)',
            }}
          >
            History
          </div>
          <button
            type="button"
            aria-label="Close history"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              flexShrink: 0,
              padding: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(0,28,53,0.06)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <X size={15} color="var(--color-text-secondary)" strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '0 18px 24px',
          }}
        >
          <div style={{ marginTop: '12px' }}>
            <TaskHistoryList
              defaultExpanded
              onCloseAfterNavigate={onClose}
              onOpenTask={onOpenTask}
            />
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

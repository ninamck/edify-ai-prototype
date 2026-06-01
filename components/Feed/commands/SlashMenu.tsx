'use client';

/**
 * Slash-command typeahead. Opens when the composer value starts with
 * `/` and shows a filterable list of the six commands. Picking one
 * inserts its slash form (e.g. `/waste `) so the user can keep typing
 * the args; Tab also accepts.
 *
 * Rendered via `createPortal` to `document.body` so the popover can
 * escape ancestor `overflow: hidden | auto` clipping — same approach
 * as the `+` popover. Position is computed from a caller-provided
 * `anchorEl` (the composer wrapper) on every open + resize + scroll
 * so the menu stays glued to the composer.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { COMMAND_REGISTRY } from './registry';

// Commands hidden from the slash menu (same set as the `+` popover).
// They still get parsed if the user types the slash form directly —
// this just keeps the discovery surface tidy.
const HIDDEN_FROM_MENU = new Set<string>(['waste']);

interface SlashMenuProps {
  value: string;
  visible: boolean;
  /** Element the popover should sit on top of. The popover renders in
   *  a portal, so without this we'd have no positioning context. */
  anchorEl: HTMLElement | null;
  onPick: (slash: string) => void;
  onClose: () => void;
}

export default function SlashMenu({ value, visible, anchorEl, onPick, onClose }: SlashMenuProps) {
  const query = useMemo(() => {
    const m = value.match(/^\s*\/(\S*)/);
    return m ? m[1].toLowerCase() : '';
  }, [value]);

  const filtered = useMemo(() => {
    const list = COMMAND_REGISTRY.filter((c) => !HIDDEN_FROM_MENU.has(c.id));
    if (!query) return list;
    return list.filter(
      (c) =>
        c.slash.slice(1).startsWith(query) ||
        c.chipLabel.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query),
    );
  }, [query]);

  // Keyed by the live query so the hover index resets when the user
  // types — without us needing to call setState inside an effect.
  const [hoverState, setHoverState] = useState<{ key: string; idx: number }>({
    key: query,
    idx: 0,
  });
  const hover = hoverState.key === query ? hoverState.idx : 0;
  const setHover = useCallback(
    (next: number | ((prev: number) => number)) => {
      setHoverState((prev) => ({
        key: query,
        idx: typeof next === 'function' ? (next as (p: number) => number)(prev.key === query ? prev.idx : 0) : next,
      }));
    },
    [query],
  );

  // Popover position — mirrors the `+` popover's approach. The
  // `bottom` value is measured from the viewport bottom so the menu
  // sits flush with the top of the anchor + 8px gap; `left` aligns
  // with the anchor's left edge; `width` matches the anchor so the
  // typeahead has a predictable footprint.
  const [pos, setPos] = useState<{ left: number; bottom: number; width: number } | null>(null);

  useEffect(() => {
    if (!visible || !anchorEl) {
      setPos(null);
      return;
    }
    function recompute() {
      if (!anchorEl) return;
      const r = anchorEl.getBoundingClientRect();
      setPos({
        left: r.left,
        bottom: window.innerHeight - r.top + 8,
        width: r.width,
      });
    }
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [visible, anchorEl]);

  useEffect(() => {
    if (!visible) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHover((h) => Math.min(filtered.length - 1, h + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHover((h) => Math.max(0, h - 1));
      } else if (e.key === 'Tab' || (e.key === 'Enter' && filtered[hover] && value.trim() === `/${query}`)) {
        // Tab accepts; Enter only accepts when the line is bare `/foo`.
        // (Once the user has typed args, Enter sends.)
        if (filtered[hover]) {
          e.preventDefault();
          onPick(`${filtered[hover].slash} `);
        }
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, filtered, hover, onClose, onPick, value, query, setHover]);

  if (!visible || filtered.length === 0 || !pos || typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: pos.left,
        bottom: pos.bottom,
        width: pos.width,
        maxWidth: '420px',
        // Above the floor-actions box and any other in-page panels.
        // Below modal overlays (which typically live in the 1000+ band).
        zIndex: 80,
        background: '#fff',
        borderRadius: '14px',
        border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.12))',
        boxShadow: '0 12px 28px rgba(0, 28, 53,0.18)',
        overflow: 'hidden',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-secondary)',
          borderBottom: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
        }}
      >
        Quick commands · {filtered.length}
      </div>
      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
        {filtered.map((cmd, i) => {
          const Icon = cmd.chipIcon;
          const active = i === hover;
          return (
            <button
              key={cmd.id}
              type="button"
              onMouseEnter={() => setHover(i)}
              onClick={() => onPick(`${cmd.slash} `)}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 12px',
                border: 'none',
                background: active ? 'rgba(40,175,201,0.08)' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-primary)',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'var(--color-quinn-bg, rgba(40,175,201,0.12))',
                  flexShrink: 0,
                }}
              >
                <Icon size={13} color="var(--color-accent-mid, #28AFC9)" strokeWidth={2.2} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <code
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {cmd.slash}
                  </code>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    {cmd.chipLabel}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--color-text-muted)',
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cmd.description} · e.g. <em style={{ fontStyle: 'normal', opacity: 0.85 }}>{cmd.examples[0]}</em>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div
        style={{
          padding: '6px 12px',
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--color-text-muted)',
          borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
          background: 'rgba(0,28,53,0.02)',
        }}
      >
        ↑↓ to navigate · Tab to insert · Esc to dismiss
      </div>
    </div>,
    document.body,
  );
}

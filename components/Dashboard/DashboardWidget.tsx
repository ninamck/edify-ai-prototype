'use client';

import type { ReactNode } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Eye, EyeOff, Trash2 } from 'lucide-react';

export interface DashboardWidgetProps {
  id: string;
  editing: boolean;
  visible: boolean;
  onToggleVisible: () => void;
  onRemove?: () => void;
  children: ReactNode;
}

/**
 * Wraps a dashboard widget so that — in edit mode — it can be
 * drag-reordered (via a dedicated grip handle so recharts hover
 * isn't swallowed), hidden, and (for pinned charts) removed.
 * Outside edit mode, renders children as-is.
 */
export default function DashboardWidget({
  id,
  editing,
  visible,
  onToggleVisible,
  onRemove,
  children,
}: DashboardWidgetProps) {
  const controls = useDragControls();

  if (!editing) {
    if (!visible) return null;
    return <>{children}</>;
  }

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      whileDrag={{
        boxShadow: '0 12px 32px rgba(3,28,89,0.18)',
        scale: 1.01,
        cursor: 'grabbing',
        zIndex: 2,
      }}
      style={{
        position: 'relative',
        listStyle: 'none',
        opacity: visible ? 1 : 0.45,
      }}
    >
      {visible ? (
        <div style={{ position: 'relative' }}>
          {/* Grip overlay — top-left, starts drag */}
          <button
            type="button"
            onPointerDown={(e) => controls.start(e)}
            aria-label="Drag to reorder"
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              zIndex: 3,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              cursor: 'grab',
              touchAction: 'none',
              boxShadow: '0 2px 6px rgba(58,48,40,0.08)',
            }}
          >
            <GripVertical size={14} color="var(--color-text-muted)" strokeWidth={2} />
          </button>

          {/* Eye / Trash — top-right */}
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 3,
              display: 'flex',
              gap: 6,
            }}
          >
            <button
              type="button"
              onClick={onToggleVisible}
              aria-label="Hide widget"
              title="Hide"
              style={editButtonStyle}
            >
              <Eye size={14} color="var(--color-text-muted)" strokeWidth={2} />
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                aria-label="Remove widget"
                title="Remove"
                style={editButtonStyle}
              >
                <Trash2 size={14} color="var(--color-error)" strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Subtle outline so edit mode is visible */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 12,
              border: '2px dashed var(--color-accent-mid)',
              pointerEvents: 'none',
              zIndex: 2,
              opacity: 0.55,
            }}
          />

          {/* Dim overlay to block chart interactions while editing */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.35)',
              zIndex: 1,
              cursor: 'grab',
            }}
            onPointerDown={(e) => controls.start(e)}
          />

          {children}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px dashed var(--color-border)',
            background: 'var(--color-bg-surface)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <button
            type="button"
            onPointerDown={(e) => controls.start(e)}
            aria-label="Drag to reorder"
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              cursor: 'grab',
              touchAction: 'none',
              flexShrink: 0,
            }}
          >
            <GripVertical size={14} color="var(--color-text-muted)" strokeWidth={2} />
          </button>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>
            Hidden — tap the eye to show
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={onToggleVisible}
              aria-label="Show widget"
              title="Show"
              style={editButtonStyle}
            >
              <EyeOff size={14} color="var(--color-text-muted)" strokeWidth={2} />
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                aria-label="Remove widget"
                title="Remove"
                style={editButtonStyle}
              >
                <Trash2 size={14} color="var(--color-error)" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      )}
    </Reorder.Item>
  );
}

const editButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  cursor: 'pointer',
  boxShadow: '0 2px 6px rgba(58,48,40,0.08)',
};

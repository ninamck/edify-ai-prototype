'use client';

import type { ReactNode } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { GripVertical, Eye, EyeOff, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import type { WidgetWidth } from '@/components/Dashboard/layoutTypes';

export interface DashboardWidgetProps {
  id: string;
  editing: boolean;
  visible: boolean;
  width: WidgetWidth;
  onToggleVisible: () => void;
  /** When omitted, the width toggle button is hidden (the widget's width is locked). */
  onToggleWidth?: () => void;
  onRemove?: () => void;
  onDragEnd?: (point: { x: number; y: number }) => void;
  children: ReactNode;
}

/**
 * Wraps a dashboard widget. In edit mode it can be:
 *  - dragged in any direction (vertical + horizontal) — parent consumes the drop position
 *  - toggled between full-width and half-width
 *  - hidden
 *  - removed (only for pinned charts)
 */
export default function DashboardWidget({
  id,
  editing,
  visible,
  width,
  onToggleVisible,
  onToggleWidth,
  onRemove,
  onDragEnd,
  children,
}: DashboardWidgetProps) {
  const controls = useDragControls();

  if (!editing) {
    if (!visible) return null;
    return <>{children}</>;
  }

  return (
    <motion.div
      layout
      layoutId={id}
      drag
      dragListener={false}
      dragControls={controls}
      dragSnapToOrigin
      onDragEnd={(_, info) => {
        onDragEnd?.({ x: info.point.x, y: info.point.y });
      }}
      whileDrag={{
        boxShadow: '0 16px 40px rgba(3,28,89,0.22)',
        scale: 1.015,
        cursor: 'grabbing',
        zIndex: 4,
      }}
      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      style={{
        position: 'relative',
        opacity: visible ? 1 : 0.45,
        touchAction: 'none',
      }}
    >
      {visible ? (
        <div style={{ position: 'relative' }}>
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
            {onToggleWidth && (
              <button
                type="button"
                onClick={onToggleWidth}
                aria-label={width === 'full' ? 'Make half width' : 'Make full width'}
                title={width === 'full' ? 'Half width' : 'Full width'}
                style={editButtonStyle}
              >
                {width === 'full' ? (
                  <Minimize2 size={14} color="var(--color-text-muted)" strokeWidth={2} />
                ) : (
                  <Maximize2 size={14} color="var(--color-text-muted)" strokeWidth={2} />
                )}
              </button>
            )}
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
    </motion.div>
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

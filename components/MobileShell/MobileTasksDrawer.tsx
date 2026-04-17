'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckSquare,
  ListChecks,
  ArrowLeftRight,
  ShoppingCart,
} from 'lucide-react';

function TaskRow({
  icon: Icon,
  label,
  badge,
  dot,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  badge?: number;
  dot?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        width: '100%',
        padding: '14px 16px',
        borderRadius: '12px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(58,48,40,0.06)',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        textAlign: 'left',
        transition: 'background 0.12s ease',
        position: 'relative',
      }}
    >
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        background: 'var(--color-bg-surface)',
        flexShrink: 0,
        position: 'relative',
      }}>
        <Icon size={18} color="var(--color-text-secondary)" strokeWidth={2} />
        {badge != null && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-7px',
            minWidth: '18px',
            height: '18px',
            padding: '0 5px',
            borderRadius: '100px',
            background: 'var(--color-accent-deep)',
            color: '#F4F1EC',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {badge}
          </span>
        )}
        {dot && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-4px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--color-accent-active)',
            border: '2px solid #fff',
          }} />
        )}
      </span>
      <span style={{
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        flex: 1,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: '18px',
        color: 'var(--color-text-muted)',
        lineHeight: 1,
      }}>›</span>
    </button>
  );
}

export default function MobileTasksDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function go(path: string) {
    onClose();
    router.push(path);
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="tasks-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(34,68,68,0.4)',
              zIndex: 1100,
            }}
          />
          <motion.div
            key="tasks-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1101,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--color-bg-surface)',
              borderRadius: '16px 16px 0 0',
              fontFamily: 'var(--font-primary)',
              overflow: 'hidden',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
            }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
              <div style={{
                width: '36px',
                height: '4px',
                borderRadius: '2px',
                background: 'var(--color-border-subtle)',
              }} />
            </div>

            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 16px 12px',
              borderBottom: '1px solid var(--color-border-subtle)',
              flexShrink: 0,
            }}>
              <div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--color-text-muted)',
                  marginBottom: '2px',
                }}>
                  On the floor
                </div>
                <span style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                }}>
                  Tasks
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--color-bg-hover)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} color="var(--color-text-muted)" />
              </button>
            </div>

            {/* Task list */}
            <div style={{
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              <TaskRow
                icon={CheckSquare}
                label="Complete tasks"
                badge={4}
                onClick={() => go('/checklists/complete')}
              />
              <TaskRow
                icon={ListChecks}
                label="Complete your checklists"
                onClick={() => go('/checklists/complete')}
              />
              <TaskRow
                icon={ShoppingCart}
                label="Review orders"
                onClick={() => go('/')}
              />
              <TaskRow
                icon={ArrowLeftRight}
                label="Transfer stock"
                onClick={() => go('/')}
              />
              <TaskRow
                icon={ShoppingCart}
                label="Suggested orders"
                badge={3}
                onClick={() => go('/assisted-ordering')}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

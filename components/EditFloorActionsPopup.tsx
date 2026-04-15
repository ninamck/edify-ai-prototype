'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  X,
  GripVertical,
  Plus,
  Trash2,
  ListChecks,
  Utensils,
  Truck,
  ArrowLeftRight,
  ClipboardList,
  Package,
  ShoppingCart,
  Thermometer,
  Scale,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react';

/* ── Available icons to pick from ── */
const ICON_OPTIONS: { key: string; Icon: LucideIcon; label: string }[] = [
  { key: 'ListChecks', Icon: ListChecks, label: 'Checklists' },
  { key: 'Utensils', Icon: Utensils, label: 'Utensils' },
  { key: 'Trash2', Icon: Trash2, label: 'Waste' },
  { key: 'Truck', Icon: Truck, label: 'Delivery' },
  { key: 'ArrowLeftRight', Icon: ArrowLeftRight, label: 'Transfer' },
  { key: 'ClipboardList', Icon: ClipboardList, label: 'Clipboard' },
  { key: 'Package', Icon: Package, label: 'Package' },
  { key: 'ShoppingCart', Icon: ShoppingCart, label: 'Cart' },
  { key: 'Thermometer', Icon: Thermometer, label: 'Temperature' },
  { key: 'Scale', Icon: Scale, label: 'Scale' },
  { key: 'Clock', Icon: Clock, label: 'Clock' },
  { key: 'FileText', Icon: FileText, label: 'Document' },
  { key: 'AlertTriangle', Icon: AlertTriangle, label: 'Alert' },
  { key: 'CheckCircle', Icon: CheckCircle, label: 'Complete' },
];

function getIconComponent(key: string): LucideIcon {
  return ICON_OPTIONS.find((o) => o.key === key)?.Icon ?? ListChecks;
}

export interface FloorAction {
  id: string;
  label: string;
  iconKey: string;
  visible: boolean;
}

export const DEFAULT_FLOOR_ACTIONS: FloorAction[] = [
  { id: 'checklists', label: 'Checklists', iconKey: 'ListChecks', visible: true },
  { id: 'run-production', label: 'Run production', iconKey: 'Utensils', visible: true },
  { id: 'log-waste', label: 'Log waste', iconKey: 'Trash2', visible: true },
  { id: 'receive-delivery', label: 'Receive delivery', iconKey: 'Truck', visible: true },
  { id: 'transfer-stock', label: 'Transfer stock', iconKey: 'ArrowLeftRight', visible: true },
];

/* ── Icon picker mini-popup ── */
function IconPicker({
  currentKey,
  onSelect,
  onClose,
}: {
  currentKey: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 4,
        padding: 8,
        background: '#fff',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 8px 24px rgba(58,48,40,0.15)',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 4,
        zIndex: 1300,
        width: 210,
      }}
    >
      {ICON_OPTIONS.map(({ key, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => {
            onSelect(key);
            onClose();
          }}
          title={key}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            background: key === currentKey ? 'var(--color-accent-active)' : 'transparent',
          }}
        >
          <Icon
            size={16}
            color={key === currentKey ? '#fff' : 'var(--color-text-secondary)'}
            strokeWidth={2}
          />
        </button>
      ))}
    </div>
  );
}

/* ── Single action row ── */
function ActionRow({
  action,
  onUpdate,
  onDelete,
}: {
  action: FloorAction;
  onUpdate: (patch: Partial<FloorAction>) => void;
  onDelete: () => void;
}) {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const IconComp = getIconComponent(action.iconKey);

  return (
    <Reorder.Item
      value={action}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 4px',
        borderRadius: 10,
        background: '#fff',
        cursor: 'grab',
        listStyle: 'none',
      }}
      whileDrag={{
        boxShadow: '0 4px 16px rgba(58,48,40,0.13)',
        scale: 1.02,
        cursor: 'grabbing',
      }}
    >
      <GripVertical size={16} color="var(--color-border)" style={{ flexShrink: 0 }} />

      {/* Icon button */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setShowIconPicker(!showIconPicker)}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            border: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-surface)',
            cursor: 'pointer',
          }}
        >
          <IconComp size={16} color="var(--color-text-secondary)" strokeWidth={2} />
        </button>
        {showIconPicker && (
          <IconPicker
            currentKey={action.iconKey}
            onSelect={(key) => onUpdate({ iconKey: key })}
            onClose={() => setShowIconPicker(false)}
          />
        )}
      </div>

      {/* Label input */}
      <input
        type="text"
        value={action.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
        placeholder="Task name"
        style={{
          flex: 1,
          minWidth: 0,
          padding: '7px 10px',
          borderRadius: 8,
          border: '1px solid var(--color-border-subtle)',
          background: '#fff',
          fontSize: 14,
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-primary)',
          outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent-active)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-subtle)')}
      />

      {/* Toggle visibility */}
      <button
        type="button"
        onClick={() => onUpdate({ visible: !action.visible })}
        title={action.visible ? 'Visible — click to hide' : 'Hidden — click to show'}
        style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: 'none',
          background: action.visible ? 'var(--color-success-light)' : 'var(--color-bg-hover)',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: 14 }}>{action.visible ? '👁' : '🚫'}</span>
      </button>

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        title="Remove task"
        style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Trash2 size={15} color="var(--color-error)" strokeWidth={2} />
      </button>
    </Reorder.Item>
  );
}

/* ── Main popup ── */
export default function EditFloorActionsPopup({
  open,
  onClose,
  actions,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  actions: FloorAction[];
  onSave: (updated: FloorAction[]) => void;
}) {
  const [draft, setDraft] = useState<FloorAction[]>(actions);

  // Sync draft when opened
  useEffect(() => {
    if (open) setDraft(actions);
  }, [open, actions]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function updateAction(id: string, patch: Partial<FloorAction>) {
    setDraft((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function deleteAction(id: string) {
    setDraft((prev) => prev.filter((a) => a.id !== id));
  }

  function addAction() {
    const newId = `custom-${Date.now()}`;
    setDraft((prev) => [
      ...prev,
      { id: newId, label: '', iconKey: 'ClipboardList', visible: true },
    ]);
  }

  function handleSave() {
    // Strip empty labels
    const cleaned = draft.filter((a) => a.label.trim() !== '');
    onSave(cleaned);
    onClose();
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="edit-floor-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1200,
              background: 'rgba(3, 28, 89, 0.25)',
              backdropFilter: 'blur(2px)',
            }}
          />

          {/* Panel */}
          <motion.div
            key="edit-floor-panel"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1201,
              width: 'min(420px, calc(100vw - 32px))',
              maxHeight: 'calc(100vh - 64px)',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 16,
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: '0 12px 40px rgba(3,28,89,0.18), 0 0 0 1px rgba(58,48,40,0.04)',
              fontFamily: 'var(--font-primary)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--color-border-subtle)',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                }}
              >
                Edit floor tasks
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--color-bg-hover)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} color="var(--color-text-muted)" />
              </button>
            </div>

            {/* Task list */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 16px',
                minHeight: 0,
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-muted)',
                  margin: '0 0 12px',
                  lineHeight: 1.4,
                }}
              >
                Drag to reorder, tap an icon to change it, or add new tasks.
              </p>

              <Reorder.Group
                axis="y"
                values={draft}
                onReorder={setDraft}
                style={{ padding: 0, margin: 0 }}
              >
                {draft.map((action) => (
                  <ActionRow
                    key={action.id}
                    action={action}
                    onUpdate={(patch) => updateAction(action.id, patch)}
                    onDelete={() => deleteAction(action.id)}
                  />
                ))}
              </Reorder.Group>

              {/* Add button */}
              <button
                type="button"
                onClick={addAction}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '10px 12px',
                  marginTop: 8,
                  borderRadius: 10,
                  border: '1px dashed var(--color-border)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--color-accent-active)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Plus size={16} strokeWidth={2.5} />
                Add task
              </button>
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                padding: '14px 20px',
                borderTop: '1px solid var(--color-border-subtle)',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  background: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                style={{
                  padding: '8px 22px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--color-accent-active)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#fff',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Save
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

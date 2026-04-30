'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  X,
  GripVertical,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Search,
  ChevronLeft,
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
  CalendarClock,
  Send,
  PackageSearch,
  FileCheck,
  FileX,
  LayoutDashboard,
  TrendingUp,
  Layers,
  Star,
  MapPin,
  User,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { BRIEFING_ROLES, type BriefingRole } from '@/components/briefing';

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
  { key: 'CalendarClock', Icon: CalendarClock, label: 'Schedule' },
  { key: 'Send', Icon: Send, label: 'Send' },
  { key: 'PackageSearch', Icon: PackageSearch, label: 'Stock count' },
  { key: 'FileCheck', Icon: FileCheck, label: 'Match' },
  { key: 'FileX', Icon: FileX, label: 'Credit note' },
  { key: 'LayoutDashboard', Icon: LayoutDashboard, label: 'Dashboard' },
  { key: 'TrendingUp', Icon: TrendingUp, label: 'Analytics' },
  { key: 'Layers', Icon: Layers, label: 'Compare' },
  { key: 'Star', Icon: Star, label: 'Recipes' },
  { key: 'MapPin', Icon: MapPin, label: 'Suppliers' },
  { key: 'User', Icon: User, label: 'Users' },
  { key: 'Settings', Icon: Settings, label: 'Settings' },
];

function getIconComponent(key: string): LucideIcon {
  return ICON_OPTIONS.find((o) => o.key === key)?.Icon ?? ListChecks;
}

/* ── Site destinations (shortcuts to bypass sidebar navigation) ── */
export interface SiteDestination {
  id: string;
  label: string;
  iconKey: string;
  href: string;
  group: string;
}

export const SITE_DESTINATIONS: SiteDestination[] = [
  { id: 'plan-production', label: 'Plan production', iconKey: 'CalendarClock', href: '/plan-production', group: 'Make, plan & dispatch' },
  { id: 'production-summary', label: 'View production summary', iconKey: 'ClipboardList', href: '/production-summary', group: 'Make, plan & dispatch' },
  { id: 'dispatch', label: 'Dispatch to stores', iconKey: 'Send', href: '/dispatch', group: 'Make, plan & dispatch' },
  { id: 'review-orders', label: 'Review suggested orders', iconKey: 'ShoppingCart', href: '/assisted-ordering', group: 'Stock & ordering' },
  { id: 'count-stock', label: 'Count stock', iconKey: 'PackageSearch', href: '/stock-count', group: 'Stock & ordering' },
  { id: 'match-invoices', label: 'Match invoices', iconKey: 'FileCheck', href: '/invoices', group: 'Stock & ordering' },
  { id: 'order-history', label: 'View order history', iconKey: 'Clock', href: '/order-history', group: 'Stock & ordering' },
  { id: 'credit-notes', label: 'Manage credit notes', iconKey: 'FileX', href: '/credit-notes', group: 'Stock & ordering' },
  { id: 'view-dashboard', label: 'View dashboard', iconKey: 'LayoutDashboard', href: '/dashboard', group: 'Performance' },
  { id: 'view-analytics', label: 'View analytics', iconKey: 'TrendingUp', href: '/analytics', group: 'Performance' },
  { id: 'compare-sites', label: 'Compare sites', iconKey: 'Layers', href: '/compare', group: 'Performance' },
  { id: 'recipes', label: 'Manage recipes', iconKey: 'Star', href: '/recipes', group: 'Setup' },
  { id: 'suppliers', label: 'Manage suppliers', iconKey: 'MapPin', href: '/suppliers', group: 'Setup' },
  { id: 'users', label: 'Manage users', iconKey: 'User', href: '/users', group: 'Setup' },
  { id: 'checklists', label: 'Manage checklists', iconKey: 'ClipboardList', href: '/checklists', group: 'Setup' },
  { id: 'settings', label: 'Configure settings', iconKey: 'Settings', href: '/settings', group: 'Setup' },
];

export interface FloorAction {
  id: string;
  label: string;
  iconKey: string;
  visible: boolean;
  /** Destination for picker-added shortcuts. Built-in ids are routed via FloorActionsBox's switch. */
  href?: string;
}

export const DEFAULT_FLOOR_ACTIONS: FloorAction[] = [
  { id: 'checklists', label: 'Checklists', iconKey: 'ListChecks', visible: true },
  { id: 'review-orders', label: 'Review orders', iconKey: 'ShoppingCart', visible: true },
  { id: 'log-waste', label: 'Log waste', iconKey: 'Trash2', visible: true },
  { id: 'receive-delivery', label: 'Receive delivery', iconKey: 'Truck', visible: true },
  { id: 'transfer-stock', label: 'Transfer stock', iconKey: 'ArrowLeftRight', visible: true },
];

export const DEFAULT_FLOOR_ACTIONS_BY_ROLE: Record<BriefingRole, FloorAction[]> = {
  ed: DEFAULT_FLOOR_ACTIONS,
  cheryl: [
    { id: 'review-orders', label: 'Review orders', iconKey: 'ShoppingCart', visible: true },
    { id: 'receive-delivery', label: 'Receive delivery', iconKey: 'Truck', visible: true },
    { id: 'transfer-stock', label: 'Transfer stock', iconKey: 'ArrowLeftRight', visible: true },
    { id: 'match-invoices', label: 'Match invoices', iconKey: 'FileText', visible: true },
    { id: 'log-waste', label: 'Log waste', iconKey: 'Trash2', visible: true },
  ],
  gm: [
    { id: 'checklists', label: 'Checklists', iconKey: 'ListChecks', visible: true },
    { id: 'log-waste', label: 'Log waste', iconKey: 'Trash2', visible: true },
    { id: 'receive-delivery', label: 'Receive delivery', iconKey: 'Truck', visible: true },
  ],
  playtomic: DEFAULT_FLOOR_ACTIONS,
  dunkin: DEFAULT_FLOOR_ACTIONS,
};

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
          background: 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
      >
        {action.visible ? (
          <Eye size={16} color="var(--color-text-secondary)" strokeWidth={2} />
        ) : (
          <EyeOff size={16} color="var(--color-text-muted)" strokeWidth={2} />
        )}
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

/* ── Destination picker (replaces the task list when adding a shortcut) ── */
function DestinationPicker({
  query,
  onQueryChange,
  takenIds,
  onPick,
  onBack,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  takenIds: Set<string>;
  onPick: (dest: SiteDestination) => void;
  onBack: () => void;
}) {
  const q = query.trim().toLowerCase();
  const filtered = SITE_DESTINATIONS.filter((d) => !takenIds.has(d.id)).filter(
    (d) => !q || d.label.toLowerCase().includes(q) || d.group.toLowerCase().includes(q)
  );

  const byGroup = filtered.reduce<Record<string, SiteDestination[]>>((acc, d) => {
    (acc[d.group] ||= []).push(d);
    return acc;
  }, {});
  const groupOrder = ['Make, plan & dispatch', 'Stock & ordering', 'Performance', 'Setup'];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to tasks"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 8,
            border: 'none',
            background: 'var(--color-bg-hover)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={16} color="var(--color-text-muted)" strokeWidth={2} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          Pick a destination
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          marginBottom: 10,
          borderRadius: 10,
          border: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-surface)',
        }}
      >
        <Search size={14} color="var(--color-text-muted)" strokeWidth={2} />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search destinations"
          autoFocus
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: 14,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '12px 4px' }}>
          No destinations match.
        </p>
      ) : (
        groupOrder
          .filter((g) => byGroup[g])
          .map((g) => (
            <div key={g} style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                  padding: '4px 4px 6px',
                }}
              >
                {g}
              </div>
              {byGroup[g].map((dest) => {
                const Icon = getIconComponent(dest.iconKey);
                return (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => onPick(dest)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '8px 8px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--color-text-primary)',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--color-bg-hover)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: 'var(--color-bg-surface)',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={15} color="var(--color-text-secondary)" strokeWidth={2} />
                    </span>
                    {dest.label}
                  </button>
                );
              })}
            </div>
          ))
      )}
    </div>
  );
}

/* ── Main popup ── */
export default function EditFloorActionsPopup({
  open,
  onClose,
  actions,
  onSave,
  role,
}: {
  open: boolean;
  onClose: () => void;
  actions: FloorAction[];
  onSave: (updated: FloorAction[]) => void;
  role: BriefingRole;
}) {
  const [draft, setDraft] = useState<FloorAction[]>(actions);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const roleLabel = BRIEFING_ROLES.find((r) => r.id === role)?.label ?? 'Manager';

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

  function addFromDestination(dest: SiteDestination) {
    setDraft((prev) => [
      ...prev,
      {
        id: dest.id,
        label: dest.label,
        iconKey: dest.iconKey,
        visible: true,
        href: dest.href,
      },
    ]);
    setPickerOpen(false);
    setPickerQuery('');
  }

  function resetToDefault() {
    setDraft(DEFAULT_FLOOR_ACTIONS_BY_ROLE[role]);
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

          {/* Centering wrapper — flexbox so motion can animate scale/opacity without breaking centering */}
          <div
            key="edit-floor-center"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1201,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              pointerEvents: 'none',
            }}
          >
          {/* Panel */}
          <motion.div
            key="edit-floor-panel"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{
              pointerEvents: 'auto',
              width: 'min(420px, 100%)',
              maxHeight: '100%',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Edit floor tasks
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Editing {roleLabel}'s strip
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

            {/* Task list / Destination picker */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 16px',
                minHeight: 0,
              }}
            >
              {pickerOpen ? (
                <DestinationPicker
                  query={pickerQuery}
                  onQueryChange={setPickerQuery}
                  takenIds={new Set(draft.map((a) => a.id))}
                  onPick={addFromDestination}
                  onBack={() => {
                    setPickerOpen(false);
                    setPickerQuery('');
                  }}
                />
              ) : (
                <>
                  <p
                    style={{
                      fontSize: 13,
                      color: 'var(--color-text-muted)',
                      margin: '0 0 12px',
                      lineHeight: 1.4,
                    }}
                  >
                    Drag to reorder, tap an icon to change it, or add a shortcut.
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

                  {/* Add shortcut button */}
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
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
                    Add shortcut
                  </button>
                </>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '14px 20px',
                borderTop: '1px solid var(--color-border-subtle)',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={resetToDefault}
                style={{
                  padding: '8px 4px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                Reset to default
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
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
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

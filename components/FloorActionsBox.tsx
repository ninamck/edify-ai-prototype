'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ListChecks,
  Utensils,
  Trash2,
  Truck,
  ArrowLeftRight,
  Pencil,
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
import type { BriefingRole } from '@/components/briefing';
import EditFloorActionsPopup, {
  type FloorAction,
  DEFAULT_FLOOR_ACTIONS_BY_ROLE,
} from '@/components/EditFloorActionsPopup';

const STORAGE_KEY = 'edify:floorActionsByRole';

function loadStoredActions(): Record<BriefingRole, FloorAction[]> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<BriefingRole, FloorAction[]>;
    if (!parsed || !parsed.ravi || !parsed.cheryl || !parsed.gm) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeActions(actions: Record<BriefingRole, FloorAction[]>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  } catch {
    /* quota / private mode — ignore */
  }
}

const ICON_MAP: Record<string, LucideIcon> = {
  ListChecks,
  Utensils,
  Trash2,
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
};

function FloorActionSquare({
  label,
  icon: Icon,
  onClick,
  badge,
  dot,
}: {
  label: ReactNode;
  icon: React.ElementType;
  onClick: () => void;
  badge?: number;
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '88px',
        minWidth: '88px',
        minHeight: '88px',
        padding: '10px 7px',
        borderRadius: '12px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(58,48,40,0.08), 0 0 0 1px rgba(58,48,40,0.03)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '6px',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        position: 'relative',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '34px',
          height: '34px',
          borderRadius: '8px',
          background: 'var(--color-bg-surface)',
        }}>
          <Icon size={17} color="var(--color-text-secondary)" strokeWidth={2} />
        </span>
        {badge != null && (
          <span style={{
            position: 'absolute',
            top: '-6px',
            right: '-10px',
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
            right: '-6px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--color-accent-active)',
            border: '2px solid #fff',
          }} />
        )}
      </span>
      <span style={{
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        textAlign: 'center',
        lineHeight: 1.25,
        maxWidth: '100%',
      }}>
        {label}
      </span>
    </button>
  );
}

export default function FloorActionsBox({
  onReceiveDelivery,
  briefingRole,
}: {
  onReceiveDelivery?: () => void;
  /** Picks which per-role action set to render + edit. */
  briefingRole?: BriefingRole;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [actionsByRole, setActionsByRole] =
    useState<Record<BriefingRole, FloorAction[]>>(DEFAULT_FLOOR_ACTIONS_BY_ROLE);

  // Hydrate from localStorage after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    const stored = loadStoredActions();
    if (stored) setActionsByRole(stored);
  }, []);

  const role: BriefingRole = briefingRole ?? 'ravi';
  const actions = actionsByRole[role];
  const visibleActions = actions.filter((a) => a.visible);

  /* Route handler: built-ins use the switch; picker-added shortcuts use action.href. */
  function handleActionClick(action: FloorAction) {
    switch (action.id) {
      case 'checklists':
        router.push('/checklists/complete');
        return;
      case 'receive-delivery':
        onReceiveDelivery?.();
        return;
      case 'log-waste':
        router.push('/log-waste');
        return;
      case 'review-orders':
        router.push('/assisted-ordering');
        return;
      case 'match-invoices':
        router.push('/invoices');
        return;
    }
    if (action.href) router.push(action.href);
  }

  return (
    <div
      style={{
        flexShrink: 0,
        width: '100%',
        padding: '14px 20px',
        borderRadius: '12px',
        background: '#fff',
        border: '2px solid rgba(217, 215, 212, 1)',
        boxShadow: '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.03)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <span style={{
          fontSize: '15px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: 'var(--color-text-muted)',
        }}>
          On the floor
        </span>
        <button
          type="button"
          aria-label="Edit floor actions"
          onClick={() => setEditOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '22px',
            height: '22px',
            borderRadius: '6px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Pencil size={11} color="var(--color-text-muted)" strokeWidth={2} />
        </button>
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'flex-start',
      }}>
        {visibleActions.map((action) => {
          const IconComp = ICON_MAP[action.iconKey] ?? ListChecks;
          return (
            <FloorActionSquare
              key={action.id}
              label={action.label}
              icon={IconComp}
              dot={action.id === 'receive-delivery'}
              onClick={() => handleActionClick(action)}
            />
          );
        })}
      </div>

      <EditFloorActionsPopup
        open={editOpen}
        onClose={() => setEditOpen(false)}
        actions={actions}
        role={role}
        onSave={(updated) =>
          setActionsByRole((prev) => {
            const next = { ...prev, [role]: updated };
            storeActions(next);
            return next;
          })
        }
      />
    </div>
  );
}

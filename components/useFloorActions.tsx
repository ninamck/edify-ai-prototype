'use client';

/**
 * Shared state + handlers for the floor-actions feature.
 *
 * Both the card variant (`FloorActionsBox`) and the inline chip variant
 * (`HomeUtilityBar`) consume this so they stay in sync on data, click
 * routing, and the edit popup.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
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
  type LucideIcon,
} from 'lucide-react';
import type { BriefingRole } from '@/components/briefing';
import EditFloorActionsPopup, {
  type FloorAction,
  DEFAULT_FLOOR_ACTIONS_BY_ROLE,
} from '@/components/EditFloorActionsPopup';

const STORAGE_KEY = 'edify:floorActionsByRole';

export const FLOOR_ACTION_ICON_MAP: Record<string, LucideIcon> = {
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

function loadStoredActions(): Record<BriefingRole, FloorAction[]> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<BriefingRole, FloorAction[]>;
    if (!parsed || !parsed.ed || !parsed.cheryl || !parsed.gm) return null;
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

export interface UseFloorActions {
  /** Visible floor actions for the active role, in order. */
  visibleActions: FloorAction[];
  /** Built-in route handler + fallback to action.href for picker-added items. */
  handleActionClick: (action: FloorAction) => void;
  /** Whether the edit popup is open. */
  editOpen: boolean;
  /** Open or close the edit popup. */
  setEditOpen: (open: boolean) => void;
  /** Mount this somewhere in your tree (it portals itself) to render the editor. */
  editPopup: ReactNode;
}

export function useFloorActions(
  role: BriefingRole,
  onReceiveDelivery?: () => void,
): UseFloorActions {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [actionsByRole, setActionsByRole] =
    useState<Record<BriefingRole, FloorAction[]>>(DEFAULT_FLOOR_ACTIONS_BY_ROLE);

  useEffect(() => {
    const stored = loadStoredActions();
    if (stored) setActionsByRole(stored);
  }, []);

  const actions = actionsByRole[role];
  const visibleActions = actions.filter((a) => a.visible);

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

  const editPopup = (
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
  );

  return { visibleActions, handleActionClick, editOpen, setEditOpen, editPopup };
}

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
  NotebookPen,
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
  Camera,
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
  NotebookPen,
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
  Camera,
};

/**
 * Actions added to the defaults after people had already saved a layout.
 * Each is slotted in once, after the action named in `after`, so someone
 * who later deletes it doesn't see it come back.
 */
const BACKFILL_ACTIONS: { id: string; after: string }[] = [
  { id: 'photo-delivery', after: 'receive-delivery' },
];
const BACKFILL_KEY = 'edify:floorActionsBackfilled';

function backfill(merged: Record<BriefingRole, FloorAction[]>): Record<BriefingRole, FloorAction[]> {
  let done: string[] = [];
  try {
    done = JSON.parse(window.localStorage.getItem(BACKFILL_KEY) ?? '[]') as string[];
  } catch {
    done = [];
  }
  const pending = BACKFILL_ACTIONS.filter(b => !done.includes(b.id));
  if (pending.length === 0) return merged;
  const next = { ...merged };
  for (const role of Object.keys(next) as BriefingRole[]) {
    for (const b of pending) {
      const def = DEFAULT_FLOOR_ACTIONS_BY_ROLE[role]?.find(a => a.id === b.id);
      if (!def || next[role].some(a => a.id === b.id)) continue;
      const list = [...next[role]];
      const at = list.findIndex(a => a.id === b.after);
      list.splice(at >= 0 ? at + 1 : list.length, 0, def);
      next[role] = list;
    }
  }
  try {
    window.localStorage.setItem(BACKFILL_KEY, JSON.stringify([...done, ...pending.map(b => b.id)]));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota or private mode, ignore */
  }
  return next;
}

function loadStoredActions(): Record<BriefingRole, FloorAction[]> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<BriefingRole, FloorAction[]>>;
    if (!parsed || !parsed.ed || !parsed.cheryl || !parsed.gm) return null;
    // Backfill any roles added since the payload was written so newer
    // personas (e.g. 'culinary') don't render as undefined and crash the
    // downstream `.filter` call.
    const merged = { ...DEFAULT_FLOOR_ACTIONS_BY_ROLE } as Record<BriefingRole, FloorAction[]>;
    for (const key of Object.keys(merged) as BriefingRole[]) {
      const stored = parsed[key];
      if (stored) merged[key] = stored;
    }
    return backfill(merged);
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
  onNote?: () => void,
): UseFloorActions {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [actionsByRole, setActionsByRole] =
    useState<Record<BriefingRole, FloorAction[]>>(DEFAULT_FLOOR_ACTIONS_BY_ROLE);

  useEffect(() => {
    const stored = loadStoredActions();
    if (stored) setActionsByRole(stored);
  }, []);

  // Defensive lookup: a stale localStorage payload from before a role was
  // added would otherwise leave `actions` as undefined and crash `.filter`.
  const actions = actionsByRole[role] ?? DEFAULT_FLOOR_ACTIONS_BY_ROLE[role] ?? [];
  const visibleActions = actions.filter((a) => a.visible);

  function handleActionClick(action: FloorAction) {
    switch (action.id) {
      case 'note-to-edify':
        onNote?.();
        return;
      case 'checklists':
        router.push('/checklists/complete');
        return;
      case 'receive-delivery':
        onReceiveDelivery?.();
        return;
      case 'photo-delivery':
        router.push('/receive/photo');
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

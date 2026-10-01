'use client';

/**
 * Shared POS connection state.
 *
 * The POS connection tab and the Email orders tab both need to know
 * which till Edify is talking to and whether it is live: the first to
 * manage it, the second because nothing gets sent without it. One store
 * means the two tabs can never disagree.
 *
 * Mirrors the `useSyncExternalStore` pattern used elsewhere in the
 * prototype. Not persisted; resets on reload like the rest of the app.
 */

import { useSyncExternalStore } from 'react';

export type ConnectionStatus = 'connected' | 'attention' | 'disconnected';

export type PosConnection = {
  id: string;
  name: string;
  vendor: string;
  site: string;
  status: ConnectionStatus;
  lastSyncedAt: string;
  cadence: 'hourly' | '15-min' | 'manual';
  pulled: {
    menuItems: number;
    modifierGroups: number;
    salesDays: number;
  };
  notes?: string;
};

export const SEED_POS_CONNECTIONS: PosConnection[] = [
  {
    id: 'pos-1',
    name: 'Square for Restaurants',
    vendor: 'Square',
    site: 'Fitzroy Espresso',
    status: 'connected',
    lastSyncedAt: '2 min ago',
    cadence: '15-min',
    pulled: { menuItems: 124, modifierGroups: 11, salesDays: 30 },
  },
];

type State = { connections: PosConnection[] };

let state: State = { connections: SEED_POS_CONNECTIONS };

const listeners = new Set<() => void>();
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
function notify() { for (const l of listeners) l(); }

const getConnections = () => state.connections;

export function usePosConnections(): PosConnection[] {
  return useSyncExternalStore(subscribe, getConnections, getConnections);
}

/** The till this site sends to. Undefined when nothing is connected. */
export function usePrimaryPosConnection(): PosConnection | undefined {
  const connections = usePosConnections();
  return connections[0];
}

export function setPosConnections(next: PosConnection[]): void {
  state = { connections: next };
  notify();
}

export function updatePosConnection(id: string, patch: Partial<PosConnection>): void {
  setPosConnections(state.connections.map((c) => (c.id === id ? { ...c, ...patch } : c)));
}

export function removePosConnection(id: string): void {
  setPosConnections(state.connections.filter((c) => c.id !== id));
}

export const CADENCE_LABEL: Record<PosConnection['cadence'], string> = {
  '15-min': 'every 15 min',
  hourly: 'hourly',
  manual: 'manual sync only',
};

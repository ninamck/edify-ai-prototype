'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { DispatchTransfer, SiteId } from './fixtures';

/**
 * In-memory store for hub dispatch transfers (PAC137 — one-click bulk
 * transfer to spokes). Mirrors the shape of `PlanStore`: a provider the page
 * mounts once, plus a `useDispatchTransfers()` hook with a no-op fallback so
 * components rendered outside the provider don't crash.
 *
 * Transfers are keyed by `${hubId}|${spokeId}|${forDate}` — at most one
 * dispatch per (hub, spoke, day) at a time. "Undo" deletes the entry so the
 * UI snaps back to its pre-send state.
 */

type Key = string;
const keyFor = (hubId: SiteId, spokeId: SiteId, forDate: string): Key =>
  `${hubId}|${spokeId}|${forDate}`;

type DispatchTransferStore = {
  transfers: Record<Key, DispatchTransfer>;
  recordTransfer: (transfer: DispatchTransfer) => void;
  recordBulkTransfer: (transfers: DispatchTransfer[]) => void;
  undoTransfer: (hubId: SiteId, spokeId: SiteId, forDate: string) => void;
  transferFor: (hubId: SiteId, spokeId: SiteId, forDate: string) => DispatchTransfer | undefined;
  transfersFor: (hubId: SiteId, forDate: string) => DispatchTransfer[];
};

const DispatchTransferContext = createContext<DispatchTransferStore | null>(null);

export function DispatchTransferStoreProvider({ children }: { children: React.ReactNode }) {
  const [transfers, setTransfers] = useState<Record<Key, DispatchTransfer>>({});

  const recordTransfer = useCallback((transfer: DispatchTransfer) => {
    setTransfers(prev => ({
      ...prev,
      [keyFor(transfer.hubId, transfer.spokeId, transfer.forDate)]: transfer,
    }));
  }, []);

  const recordBulkTransfer = useCallback((newTransfers: DispatchTransfer[]) => {
    setTransfers(prev => {
      const next = { ...prev };
      for (const t of newTransfers) {
        next[keyFor(t.hubId, t.spokeId, t.forDate)] = t;
      }
      return next;
    });
  }, []);

  const undoTransfer = useCallback((hubId: SiteId, spokeId: SiteId, forDate: string) => {
    setTransfers(prev => {
      const k = keyFor(hubId, spokeId, forDate);
      if (!(k in prev)) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }, []);

  const transferFor = useCallback(
    (hubId: SiteId, spokeId: SiteId, forDate: string) =>
      transfers[keyFor(hubId, spokeId, forDate)],
    [transfers],
  );

  const transfersFor = useCallback(
    (hubId: SiteId, forDate: string) =>
      Object.values(transfers).filter(t => t.hubId === hubId && t.forDate === forDate),
    [transfers],
  );

  const value = useMemo<DispatchTransferStore>(
    () => ({
      transfers,
      recordTransfer,
      recordBulkTransfer,
      undoTransfer,
      transferFor,
      transfersFor,
    }),
    [transfers, recordTransfer, recordBulkTransfer, undoTransfer, transferFor, transfersFor],
  );

  return (
    <DispatchTransferContext.Provider value={value}>
      {children}
    </DispatchTransferContext.Provider>
  );
}

export function useDispatchTransfers(): DispatchTransferStore {
  const ctx = useContext(DispatchTransferContext);
  if (!ctx) {
    return {
      transfers: {},
      recordTransfer: () => {},
      recordBulkTransfer: () => {},
      undoTransfer: () => {},
      transferFor: () => undefined,
      transfersFor: () => [],
    };
  }
  return ctx;
}

/**
 * Format the time portion of an ISO timestamp as a compact `HH:mm` for
 * display in the matrix ("Sent 14:32"). Stays in the user's local timezone
 * which is what the demo wants.
 */
export function formatSentClock(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

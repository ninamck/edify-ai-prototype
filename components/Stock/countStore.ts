'use client';

/**
 * In-session writable store for stock counts logged from the chat
 * command. The dedicated /stock?tab=stocktake page keeps its own
 * working state for an active count session; this store is the surface
 * the chat surfaces use when an operator says "count 12 croissants in
 * the pastry case". Entries here are read back by the receipt link and
 * by anything else that wants to display recent chat-logged counts.
 *
 * No persistence — module-level array, lost on hard reload. Matches
 * every other prototype store.
 */

export interface CountEntry {
  id: string;
  /** Stock item id from `components/Stock/fixtures.ts`. May be a
   *  synthetic id when the chat couldn't resolve a real one — in that
   *  case `itemName` carries the typed name verbatim. */
  itemId: string;
  itemName: string;
  qty: number;
  uom: string;
  /** Optional location label (e.g. "Pastry case", "Bar"). Free-form
   *  string — we don't enforce the StockLocation taxonomy on chat
   *  input. */
  location?: string;
  /** Snapshot of the expected count at the time of logging, if we had
   *  one. Used for the variance receipt copy. */
  expectedQty?: number | null;
  /** Display-ready timestamp ("HH:mm"). */
  timestamp: string;
}

const ENTRIES: CountEntry[] = [];
const listeners = new Set<() => void>();

export function subscribeCounts(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function notify() {
  for (const l of listeners) l();
}

function formatNowTime(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function saveCount(input: Omit<CountEntry, 'id' | 'timestamp'> & { timestamp?: string }): CountEntry {
  const full: CountEntry = {
    id: `cnt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: input.timestamp ?? formatNowTime(),
    ...input,
  };
  ENTRIES.unshift(full);
  notify();
  return full;
}

export function removeCount(id: string): void {
  const idx = ENTRIES.findIndex((e) => e.id === id);
  if (idx >= 0) {
    ENTRIES.splice(idx, 1);
    notify();
  }
}

export function getCount(itemId: string): CountEntry | undefined {
  return ENTRIES.find((e) => e.itemId === itemId);
}

export function allCounts(): CountEntry[] {
  return ENTRIES;
}

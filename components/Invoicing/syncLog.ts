export interface SyncLogEntry {
  id: string;
  invoiceIds: string[];
  invoiceNumbers: string[];
  timestamp: string;
  by: string;
  batchSize: number;
  total: number;
}

const log: SyncLogEntry[] = [];

export function recordSync(invoiceIds: string[], invoiceNumbers: string[], total: number, by = 'Priya Naidoo'): SyncLogEntry {
  const entry: SyncLogEntry = {
    id: `sync-${Date.now()}`,
    invoiceIds,
    invoiceNumbers,
    timestamp: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·'),
    by,
    batchSize: invoiceIds.length,
    total,
  };
  log.unshift(entry);
  if (typeof console !== 'undefined') {
    console.info('[syncLog]', entry);
  }
  return entry;
}

export function readSyncLog(): readonly SyncLogEntry[] {
  return log;
}
